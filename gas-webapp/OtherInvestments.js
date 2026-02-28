/**
 * ============================================================================
 * OTHERINVESTMENTS.GS - Other Investments Module for Capital Friends V2
 * ============================================================================
 * Manages Gold, Real Estate, PPF, EPF, NPS, FD, Crypto, and other investment
 * types with dynamic properties and flexible categorization.
 */

/**
 * Show dialog to add a new investment
 */
function showAddInvestmentDialog() {
  const template = HtmlService.createTemplateFromFile('AddInvestment');
  const htmlOutput = template.evaluate()
    .setWidth(800)
    .setHeight(650);

  SpreadsheetApp.getUi().showModalDialog(htmlOutput, '💎 Add Investment');
}

/**
 * Show dialog to edit an existing investment
 */
function showEditInvestmentDialog() {
  const template = HtmlService.createTemplateFromFile('EditInvestment');
  const htmlOutput = template.evaluate()
    .setWidth(800)
    .setHeight(650);

  SpreadsheetApp.getUi().showModalDialog(htmlOutput, '✏️ Edit Investment');
}

/**
 * Show dialog to manage investment types
 */
function showManageInvestmentTypesDialog() {
  const template = HtmlService.createTemplateFromFile('ManageInvestmentTypes');
  const htmlOutput = template.evaluate()
    .setWidth(800)
    .setHeight(650);

  SpreadsheetApp.getUi().showModalDialog(htmlOutput, '⚙️ Manage Investment Types');
}

// ============================================================================
// BACKEND FUNCTIONS - Investment Operations
// ============================================================================

/**
 * Get all investments from OtherInvestments sheet
 * @returns {Array} Array of investment objects
 */
function getAllInvestments() {
  try {
    const sheet = getSheet(CONFIG.otherInvestmentsSheet);
    if (!sheet) {
      return [];
    }

    const lastRow = sheet.getLastRow();
    if (lastRow < 3) {
      return []; // Only watermark and header rows
    }

    // Get data starting from row 3 (after watermark and headers)
    const dataRange = sheet.getRange(3, 1, lastRow - 2, 14); // 14 columns (added Family Member Name)
    const data = dataRange.getValues();

    const investments = [];
    data.forEach((row, index) => {
      // Skip empty rows
      if (!row[0]) return;

      // Parse dynamic fields JSON
      let dynamicFields = {};
      try {
        if (row[10]) {
          // Decode HTML entities before parsing
          const decodedJson = decodeHtmlEntities(row[10]);
          dynamicFields = JSON.parse(decodedJson);
        }
      } catch (e) {
        Logger.log('Error parsing dynamic fields for row ' + (index + 3) + ': ' + e.message);
        dynamicFields = {};
      }

      investments.push({
        rowIndex: index + 3, // Actual row number in sheet
        investmentId: row[0],
        investmentType: row[1],
        investmentCategory: row[2],
        investmentName: row[3],
        familyMemberId: row[4] || '',      // Column E: Family Member ID
        familyMemberName: row[5] || '',    // Column F: Family Member Name
        investmentAccount: row[6] || '',
        investedAmount: row[7] || 0,
        currentValue: row[8] || 0,
        linkedLiabilityId: row[9] || '',
        dynamicFields: dynamicFields,
        notes: row[11] || '',
        lastUpdated: row[12] ? formatDate(row[12]) : '',
        status: row[13] || 'Active'
      });
    });

    return investments;
  } catch (error) {
    Logger.log('Error in getAllInvestments: ' + error.message);
    return [];
  }
}

/**
 * Get investment by ID
 * @param {string} investmentId - Investment ID to search for
 * @returns {Object|null} Investment object or null if not found
 */
function getInvestmentById(investmentId) {
  try {
    const investments = getAllInvestments();
    return investments.find(inv => inv.investmentId === investmentId) || null;
  } catch (error) {
    Logger.log('Error in getInvestmentById: ' + error.message);
    return null;
  }
}

/**
 * Process add investment request from dialog
 * @param {Object} data - Investment data from form
 * @returns {Object} Success/error response
 */
function processAddInvestment(data) {
  try {
    const sheet = getSheet(CONFIG.otherInvestmentsSheet);
    if (!sheet) {
      return { success: false, error: 'OtherInvestments sheet not found. Please run ONE-CLICK SETUP first.' };
    }

    // Validate required fields
    if (!data.investmentType || !data.investmentName || !data.currentValue) {
      return { success: false, error: 'Investment Type, Name, and Current Value are required.' };
    }

    // Generate new Investment ID
    const investmentId = generateInvestmentId();

    // Get next available row
    const nextRow = sheet.getLastRow() + 1;

    const now = new Date();

    // Get family member name if ID is provided
    let familyMemberName = '';
    if (data.familyMember) {
      familyMemberName = getFamilyMemberName(data.familyMember) || '';
    }

    // Prepare row data
    const rowData = [
      investmentId,                                // A: Investment ID
      data.investmentType,                         // B: Investment Type
      data.investmentCategory || 'Other',          // C: Investment Category
      data.investmentName,                         // D: Investment Name
      data.familyMember || '',                     // E: Family Member ID
      familyMemberName,                            // F: Family Member Name
      data.investmentAccount || '',                // G: Investment Account
      parseFloat(data.investedAmount) || 0,        // H: Invested Amount (optional)
      parseFloat(data.currentValue) || 0,          // I: Current Value (mandatory)
      data.linkedLiabilityId || '',                // J: Linked Liability ID
      JSON.stringify(data.dynamicFields || {}),    // K: Dynamic Fields (JSON) - properly stringified
      data.notes || '',                            // L: Notes
      now,                                         // M: Last Updated
      'Active'                                     // N: Status
    ];

    // Write to sheet
    sheet.getRange(nextRow, 1, 1, rowData.length).setValues([rowData]);

    // Format the row
    formatInvestmentRow(sheet, nextRow);

    // Handle quick loan creation (for any investment type)
    if (data.quickLoan && data.quickLoan.lender && data.quickLoan.outstanding) {
      const suggestedLoanType = getLoanTypeSuggestion(data.investmentType);
      const loanData = {
        liabilityType: data.quickLoan.loanType || suggestedLoanType,
        lenderName: data.quickLoan.lender,
        familyMember: data.familyMember || '',
        outstandingBalance: data.quickLoan.outstanding,
        dynamicFields: {},
        notes: 'Auto-created for ' + data.investmentType + ': ' + data.investmentName,
        linkedInvestmentId: investmentId  // Link back to this investment
      };

      const loanResult = processAddLiability(loanData);
      if (loanResult.success) {
        // Update the investment row with the new liability ID
        sheet.getRange(nextRow, 10).setValue(loanResult.liabilityId); // Column J: Linked Liability ID
        // Sync bidirectional link (updates liability to point to investment)
        syncInvestmentLiabilityLink(investmentId, loanResult.liabilityId);
      } else {
        // Log error but don't fail the investment creation
        Logger.log('Warning: Failed to create quick loan: ' + (loanResult.error || 'Unknown error'));
      }
    }
    // If linked to an existing liability, sync bidirectional link
    else if (data.linkedLiabilityId) {
      syncInvestmentLiabilityLink(investmentId, data.linkedLiabilityId);
    }

    return {
      success: true,
      message: `Investment "${data.investmentName}" added successfully!`,
      investmentId: investmentId
    };

  } catch (error) {
    Logger.log('Error in processAddInvestment: ' + error.message);
    return {
      success: false,
      error: 'Failed to add investment: ' + error.message
    };
  }
}

/**
 * Process edit investment request from dialog
 * @param {Object} data - Updated investment data from form
 * @returns {Object} Success/error response
 */
function processEditInvestment(data) {
  try {
    const sheet = getSheet(CONFIG.otherInvestmentsSheet);
    if (!sheet) {
      return { success: false, error: 'OtherInvestments sheet not found.' };
    }

    // Validate required fields
    if (!data.investmentId || !data.investmentType || !data.investmentName || !data.currentValue) {
      return { success: false, error: 'Investment ID, Type, Name, and Current Value are required.' };
    }

    // Find the row with this investment ID
    const investment = getInvestmentById(data.investmentId);
    if (!investment) {
      return { success: false, error: 'Investment not found.' };
    }

    const rowIndex = investment.rowIndex;
    const now = new Date();

    // Get family member name if ID is provided
    let familyMemberName = '';
    if (data.familyMember) {
      familyMemberName = getFamilyMemberName(data.familyMember) || '';
    }

    // Prepare updated row data
    const rowData = [
      data.investmentId,                           // A: Investment ID (unchanged)
      data.investmentType,                         // B: Investment Type
      data.investmentCategory || 'Other',          // C: Investment Category
      data.investmentName,                         // D: Investment Name
      data.familyMember || '',                     // E: Family Member ID
      familyMemberName,                            // F: Family Member Name
      data.investmentAccount || '',                // G: Investment Account
      parseFloat(data.investedAmount) || 0,        // H: Invested Amount
      parseFloat(data.currentValue) || 0,          // I: Current Value
      data.linkedLiabilityId || '',                // J: Linked Liability ID
      JSON.stringify(data.dynamicFields || {}),    // K: Dynamic Fields (JSON)
      data.notes || '',                            // L: Notes
      now,                                         // M: Last Updated
      data.status || 'Active'                      // N: Status
    ];

    // Update the row
    sheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);

    // Format the row
    formatInvestmentRow(sheet, rowIndex);

    // Update liability links if changed (handles comma-separated multi-loan linking)
    var oldIds = investment.linkedLiabilityId ? investment.linkedLiabilityId.split(',').map(function(s) { return s.trim(); }).filter(Boolean) : [];
    var newIds = data.linkedLiabilityId ? data.linkedLiabilityId.split(',').map(function(s) { return s.trim(); }).filter(Boolean) : [];

    // Find removed links
    oldIds.forEach(function(oldId) {
      if (newIds.indexOf(oldId) === -1) {
        updateLiabilityInvestmentLink(oldId, ''); // Remove back-link
      }
    });
    // Find added links
    newIds.forEach(function(newId) {
      if (oldIds.indexOf(newId) === -1) {
        updateLiabilityInvestmentLink(newId, data.investmentId); // Add back-link
      }
    });

    return {
      success: true,
      message: `Investment "${data.investmentName}" updated successfully!`
    };

  } catch (error) {
    Logger.log('Error in processEditInvestment: ' + error.message);
    return {
      success: false,
      error: 'Failed to update investment: ' + error.message
    };
  }
}

/**
 * Delete an investment by ID
 * @param {string} investmentId - Investment ID to delete
 * @returns {Object} Success/error response
 */
function deleteInvestment(investmentId) {
  try {
    const sheet = getSheet(CONFIG.otherInvestmentsSheet);
    if (!sheet) {
      return { success: false, error: 'OtherInvestments sheet not found.' };
    }

    // Find the row with this investment ID
    const investment = getInvestmentById(investmentId);
    if (!investment) {
      return { success: false, error: 'Investment not found.' };
    }

    // Remove liability links if exist (handles comma-separated multi-loan linking)
    if (investment.linkedLiabilityId) {
      var linkedIds = investment.linkedLiabilityId.split(',').map(function(s) { return s.trim(); }).filter(Boolean);
      linkedIds.forEach(function(liabilityId) {
        updateLiabilityInvestmentLink(liabilityId, '');
      });
    }

    // Delete the row
    sheet.deleteRow(investment.rowIndex);

    return {
      success: true,
      message: `Investment "${investment.investmentName}" deleted successfully!`
    };

  } catch (error) {
    Logger.log('Error in deleteInvestment: ' + error.message);
    return {
      success: false,
      error: 'Failed to delete investment: ' + error.message
    };
  }
}

// ============================================================================
// INVESTMENT TYPES MANAGEMENT
// ============================================================================

/**
 * Get all investment types from InvestmentTypes sheet
 * @returns {Array} Array of investment type objects
 */
function getAllInvestmentTypes() {
  try {
    const sheet = getSheet(CONFIG.investmentTypesSheet);
    if (!sheet) {
      return getDefaultInvestmentTypes(); // Return defaults if sheet not found
    }

    const lastRow = sheet.getLastRow();
    if (lastRow < 3) {
      return getDefaultInvestmentTypes(); // Return defaults if no data
    }

    // Get data starting from row 3 (after watermark and headers)
    const dataRange = sheet.getRange(3, 1, lastRow - 2, 6); // 6 columns
    const data = dataRange.getValues();

    const types = [];
    data.forEach((row, index) => {
      // Skip empty rows or inactive types
      if (!row[0] || row[5] === 'Inactive') return;

      types.push({
        rowIndex: index + 3,
        typeId: row[0],
        typeName: row[1],
        defaultCategory: row[2],
        icon: row[3],
        suggestedFields: row[4] || '',
        status: row[5] || 'Active'
      });
    });

    return types;
  } catch (error) {
    Logger.log('Error in getAllInvestmentTypes: ' + error.message);
    return getDefaultInvestmentTypes();
  }
}

/**
 * Get default investment types (fallback)
 * @returns {Array} Array of default investment types
 */
function getDefaultInvestmentTypes() {
  return [
    { typeName: 'Gold', defaultCategory: 'Gold', icon: '🥇' },
    { typeName: 'Real Estate', defaultCategory: 'Real Estate', icon: '🏠' },
    { typeName: 'PPF', defaultCategory: 'Debt', icon: '💰' },
    { typeName: 'EPF', defaultCategory: 'Debt', icon: '🏢' },
    { typeName: 'NPS', defaultCategory: 'Equity', icon: '🏛️' },
    { typeName: 'Fixed Deposit', defaultCategory: 'Debt', icon: '🏦' },
    { typeName: 'Bonds', defaultCategory: 'Debt', icon: '📜' },
    { typeName: 'Crypto', defaultCategory: 'Alternative', icon: '₿' },
    { typeName: 'Custom', defaultCategory: 'Other', icon: '📦' }
  ];
}

/**
 * Add a new investment type
 * @param {Object} data - Investment type data
 * @returns {Object} Success/error response
 */
function addInvestmentType(data) {
  try {
    const sheet = getSheet(CONFIG.investmentTypesSheet);
    if (!sheet) {
      return { success: false, error: 'InvestmentTypes sheet not found.' };
    }

    // Validate
    if (!data.typeName) {
      return { success: false, error: 'Type Name is required.' };
    }

    // Generate new Type ID
    const typeId = 'IT-' + new Date().getTime();

    // Get next available row
    const nextRow = sheet.getLastRow() + 1;

    // Prepare row data
    const rowData = [
      typeId,
      data.typeName,
      data.defaultCategory || 'Other',
      data.icon || '📦',
      data.suggestedFields || '',
      'Active'
    ];

    // Write to sheet
    sheet.getRange(nextRow, 1, 1, rowData.length).setValues([rowData]);

    return {
      success: true,
      message: `Investment type "${data.typeName}" added successfully!`,
      typeId: typeId
    };

  } catch (error) {
    Logger.log('Error in addInvestmentType: ' + error.message);
    return {
      success: false,
      error: 'Failed to add investment type: ' + error.message
    };
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate unique Investment ID
 * @returns {string} Unique investment ID in format INV-timestamp
 */
function generateInvestmentId() {
  return 'INV-' + new Date().getTime();
}

/**
 * Format investment row with borders and alignment
 * @param {Sheet} sheet - Sheet object
 * @param {number} rowIndex - Row number to format
 */
function formatInvestmentRow(sheet, rowIndex) {
  try {
    const range = sheet.getRange(rowIndex, 1, 1, 14); // 14 columns now (added Family Member Name)

    // Add borders
    range.setBorder(true, true, true, true, true, true, '#cbd5e1', SpreadsheetApp.BorderStyle.SOLID);

    // Align columns
    sheet.getRange(rowIndex, 1, 1, 4).setHorizontalAlignment('left');   // ID, Type, Category, Name
    sheet.getRange(rowIndex, 5).setHorizontalAlignment('center');       // Family Member ID
    sheet.getRange(rowIndex, 6, 1, 2).setHorizontalAlignment('left');   // Family Member Name, Investment Account
    sheet.getRange(rowIndex, 8, 1, 2).setHorizontalAlignment('right');  // Amounts (Invested, Current)
    sheet.getRange(rowIndex, 10).setHorizontalAlignment('center');      // Linked Liability
    sheet.getRange(rowIndex, 11, 1, 2).setHorizontalAlignment('left');  // Dynamic Fields, Notes
    sheet.getRange(rowIndex, 13).setHorizontalAlignment('center');      // Last Updated
    sheet.getRange(rowIndex, 14).setHorizontalAlignment('center');      // Status

    // Format currency columns
    sheet.getRange(rowIndex, 8, 1, 2).setNumberFormat('₹#,##0.00');

    // Format date column
    sheet.getRange(rowIndex, 13).setNumberFormat('dd-MMM-yyyy HH:mm');

  } catch (error) {
    Logger.log('Error in formatInvestmentRow: ' + error.message);
  }
}

/**
 * Get loan type suggestion based on investment type
 * @param {string} investmentType - Investment type
 * @returns {string} Suggested loan type or default "Personal Loan"
 */
function getLoanTypeSuggestion(investmentType) {
  const suggestions = {
    'Real Estate': 'Home Loan',
    'Gold': 'Gold Loan',
    'Stocks (Equity - Direct)': 'Margin Loan',
    'Fixed Deposit': 'Loan Against FD',
    'PPF': 'Personal Loan',
    'EPF': 'Personal Loan'
  };

  return suggestions[investmentType] || 'Personal Loan';
}

/**
 * Decode HTML entities
 * @param {string} text - Text with HTML entities
 * @returns {string} Decoded text
 */
function decodeHtmlEntities(text) {
  if (!text) return '';

  return text
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}


// ============================================================================
// END OF OTHERINVESTMENTS.GS
// ============================================================================
