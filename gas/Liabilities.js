/**
 * ============================================================================
 * LIABILITIES.GS - Dynamic Liabilities Module for Capital Friends V2
 * ============================================================================
 * Manages all types of liabilities (loans, debts, etc.) with customizable
 * liability types and dynamic fields stored as JSON.
 *
 * Sheet Structure (10 columns):
 * A: Liability ID
 * B: Liability Type
 * C: Lender/Bank Name (MANDATORY)
 * D: Family Member
 * E: Outstanding Balance (MANDATORY)
 * F: Dynamic Fields (JSON)
 * G: Notes
 * H: Last Updated
 * I: Status
 * J: Linked Investment ID
 */

/**
 * Show dialog to add a new liability
 */
function showAddLiabilityDialog() {
  const template = HtmlService.createTemplateFromFile('AddLiability');
  const htmlOutput = template.evaluate()
    .setWidth(800)
    .setHeight(650);

  SpreadsheetApp.getUi().showModalDialog(htmlOutput, '💳 Add Liability');
}

/**
 * Show dialog to edit an existing liability
 */
function showEditLiabilityDialog() {
  const template = HtmlService.createTemplateFromFile('EditLiability');
  const htmlOutput = template.evaluate()
    .setWidth(800)
    .setHeight(650);

  SpreadsheetApp.getUi().showModalDialog(htmlOutput, '✏️ Edit Liability');
}

/**
 * Show dialog to manage liability types
 */
function showManageLiabilityTypesDialog() {
  const template = HtmlService.createTemplateFromFile('ManageLiabilityTypes');
  const htmlOutput = template.evaluate()
    .setWidth(800)
    .setHeight(650);

  SpreadsheetApp.getUi().showModalDialog(htmlOutput, '⚙️ Manage Liability Types');
}

// ============================================================================
// BACKEND FUNCTIONS - Liability Operations
// ============================================================================

/**
 * Decode HTML entities from JSON strings
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

/**
 * Get all liabilities from Liabilities sheet
 * @returns {Array} Array of liability objects
 */
function getAllLiabilities() {
  try {
    const sheet = getSheet(CONFIG.liabilitiesSheet);
    if (!sheet) {
      return [];
    }

    const lastRow = sheet.getLastRow();
    if (lastRow < 3) {
      return []; // Only watermark and header rows
    }

    // Get data starting from row 3 (after watermark and headers)
    const dataRange = sheet.getRange(3, 1, lastRow - 2, 11); // 11 columns (added Family Member Name)
    const data = dataRange.getValues();

    const liabilities = [];
    data.forEach((row, index) => {
      // Skip empty rows
      if (!row[0]) return;

      // Parse dynamic fields JSON
      let dynamicFields = {};
      try {
        if (row[6]) {
          // Decode HTML entities before parsing
          const decodedJson = decodeHtmlEntities(row[6]);
          dynamicFields = JSON.parse(decodedJson);
        }
      } catch (e) {
        Logger.log('Error parsing dynamic fields for row ' + (index + 3) + ': ' + e.message);
        dynamicFields = {};
      }

      liabilities.push({
        rowIndex: index + 3, // Actual row number in sheet
        liabilityId: row[0],
        liabilityType: row[1],
        lenderName: row[2],
        familyMemberId: row[3] || '',      // Column D: Family Member ID
        familyMemberName: row[4] || '',    // Column E: Family Member Name
        outstandingBalance: row[5] || 0,
        emiAmount: parseFloat(dynamicFields['EMI Amount'] || dynamicFields['emiAmount'] || dynamicFields['EMI']) || 0,  // Extracted from dynamicFields (React field)
        interestRate: parseFloat(dynamicFields['Interest Rate'] || dynamicFields['interestRate'] || dynamicFields['Rate']) || 0,  // Extracted from dynamicFields (React field)
        dynamicFields: dynamicFields,
        notes: row[7] || '',
        lastUpdated: row[8] ? formatDate(row[8]) : '',
        status: row[9] || 'Active',
        linkedInvestmentId: row[10] || ''
      });
    });

    return liabilities;
  } catch (error) {
    Logger.log('Error in getAllLiabilities: ' + error.message);
    return [];
  }
}

/**
 * Get liability by ID
 * @param {string} liabilityId - Liability ID to search for
 * @returns {Object|null} Liability object or null if not found
 */
function getLiabilityById(liabilityId) {
  try {
    const liabilities = getAllLiabilities();
    return liabilities.find(liability => liability.liabilityId === liabilityId) || null;
  } catch (error) {
    Logger.log('Error in getLiabilityById: ' + error.message);
    return null;
  }
}

/**
 * Process add liability request from dialog
 * @param {Object} data - Liability data from form
 * @returns {Object} Success/error response
 */
function processAddLiability(data) {
  try {
    const sheet = getSheet(CONFIG.liabilitiesSheet);
    if (!sheet) {
      return { success: false, error: 'Liabilities sheet not found. Please run ONE-CLICK SETUP first.' };
    }

    // Validate required fields
    if (!data.liabilityType || !data.lenderName || !data.outstandingBalance) {
      return { success: false, error: 'Liability Type, Lender Name, and Outstanding Balance are required.' };
    }

    // Generate new Liability ID
    const liabilityId = generateLiabilityId();

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
      liabilityId,                                  // A: Liability ID
      data.liabilityType,                           // B: Liability Type
      data.lenderName,                              // C: Lender/Bank Name
      data.familyMember || '',                      // D: Family Member ID
      familyMemberName,                             // E: Family Member Name
      parseFloat(data.outstandingBalance) || 0,     // F: Outstanding Balance
      JSON.stringify(data.dynamicFields || {}),     // G: Dynamic Fields (JSON)
      data.notes || '',                             // H: Notes
      now,                                          // I: Last Updated
      'Active',                                     // J: Status
      data.linkedInvestmentId || ''                 // K: Linked Investment ID
    ];

    // Write to sheet
    sheet.getRange(nextRow, 1, 1, rowData.length).setValues([rowData]);

    // Format the row
    formatLiabilityRow(sheet, nextRow);

    // Sync bidirectional link if needed
    if (data.linkedInvestmentId) {
      syncInvestmentLiabilityLink(data.linkedInvestmentId, liabilityId);
    }

    return {
      success: true,
      message: `Liability "${data.liabilityType} - ${data.lenderName}" added successfully!`,
      liabilityId: liabilityId
    };

  } catch (error) {
    Logger.log('Error in processAddLiability: ' + error.message);
    return {
      success: false,
      error: 'Failed to add liability: ' + error.message
    };
  }
}

/**
 * Process edit liability request from dialog
 * @param {Object} data - Updated liability data from form
 * @returns {Object} Success/error response
 */
function processEditLiability(data) {
  try {
    const sheet = getSheet(CONFIG.liabilitiesSheet);
    if (!sheet) {
      return { success: false, error: 'Liabilities sheet not found.' };
    }

    // Validate required fields
    if (!data.liabilityId || !data.liabilityType || !data.lenderName || !data.outstandingBalance) {
      return { success: false, error: 'Liability ID, Type, Lender Name, and Outstanding Balance are required.' };
    }

    // Find the row with this liability ID
    const liability = getLiabilityById(data.liabilityId);
    if (!liability) {
      return { success: false, error: 'Liability not found.' };
    }

    const rowIndex = liability.rowIndex;
    const now = new Date();

    // Get family member name if ID is provided
    let familyMemberName = '';
    if (data.familyMember) {
      familyMemberName = getFamilyMemberName(data.familyMember) || '';
    }

    // Prepare updated row data
    const rowData = [
      data.liabilityId,                             // A: Liability ID (unchanged)
      data.liabilityType,                           // B: Liability Type
      data.lenderName,                              // C: Lender/Bank Name
      data.familyMember || '',                      // D: Family Member ID
      familyMemberName,                             // E: Family Member Name
      parseFloat(data.outstandingBalance) || 0,     // F: Outstanding Balance
      JSON.stringify(data.dynamicFields || {}),     // G: Dynamic Fields (JSON)
      data.notes || '',                             // H: Notes
      now,                                          // I: Last Updated
      data.status || 'Active',                      // J: Status
      data.linkedInvestmentId || ''                 // K: Linked Investment ID
    ];

    // Update the row
    sheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);

    // Format the row
    formatLiabilityRow(sheet, rowIndex);

    // If status changed to "Closed", unlink from ALL investments
    if (data.status === 'Closed' && liability.status !== 'Closed') {
      unlinkAllInvestmentsFromLiability(data.liabilityId);
      Logger.log(`Liability ${data.liabilityId} marked as Closed - unlinked from all investments`);
    }
    // Otherwise, update investment link if changed
    else if (liability.linkedInvestmentId !== data.linkedInvestmentId) {
      // Remove old link (remove this liability from old investment's comma-separated list)
      if (liability.linkedInvestmentId) {
        removeInvestmentLiabilityLink(liability.linkedInvestmentId, data.liabilityId);
      }
      // Add new link (add this liability to new investment's comma-separated list)
      if (data.linkedInvestmentId) {
        syncInvestmentLiabilityLink(data.linkedInvestmentId, data.liabilityId);
      }
    }

    return {
      success: true,
      message: `Liability "${data.liabilityType} - ${data.lenderName}" updated successfully!`
    };

  } catch (error) {
    Logger.log('Error in processEditLiability: ' + error.message);
    return {
      success: false,
      error: 'Failed to update liability: ' + error.message
    };
  }
}

/**
 * Delete a liability by ID
 * @param {string} liabilityId - Liability ID to delete
 * @returns {Object} Success/error response
 */
function deleteLiability(liabilityId) {
  try {
    const sheet = getSheet(CONFIG.liabilitiesSheet);
    if (!sheet) {
      return { success: false, error: 'Liabilities sheet not found.' };
    }

    // Find the row with this liability ID
    const liability = getLiabilityById(liabilityId);
    if (!liability) {
      return { success: false, error: 'Liability not found.' };
    }

    // Remove investment link if exists (remove this liability from investment's comma-separated list)
    if (liability.linkedInvestmentId) {
      removeInvestmentLiabilityLink(liability.linkedInvestmentId, liability.liabilityId);
    }

    // Delete the row
    sheet.deleteRow(liability.rowIndex);

    return {
      success: true,
      message: `Liability "${liability.liabilityType} - ${liability.lenderName}" deleted successfully!`
    };

  } catch (error) {
    Logger.log('Error in deleteLiability: ' + error.message);
    return {
      success: false,
      error: 'Failed to delete liability: ' + error.message
    };
  }
}

// ============================================================================
// LIABILITY TYPES MANAGEMENT
// ============================================================================

/**
 * Get all liability types from LiabilityTypes sheet
 * @returns {Array} Array of liability type objects
 */
function getAllLiabilityTypes() {
  try {
    const sheet = getSheet(CONFIG.liabilityTypesSheet);
    if (!sheet) {
      return getDefaultLiabilityTypes(); // Return defaults if sheet not found
    }

    const lastRow = sheet.getLastRow();
    if (lastRow < 3) {
      return getDefaultLiabilityTypes(); // Return defaults if no data
    }

    // Get data starting from row 3 (after watermark and headers)
    const dataRange = sheet.getRange(3, 1, lastRow - 2, 5); // 5 columns
    const data = dataRange.getValues();

    const types = [];
    data.forEach((row, index) => {
      // Skip empty rows or inactive types
      if (!row[0] || row[4] === 'Inactive') return;

      types.push({
        rowIndex: index + 3,
        typeId: row[0],
        typeName: row[1],
        category: row[2],
        icon: row[3],
        status: row[4] || 'Active'
      });
    });

    return types;
  } catch (error) {
    Logger.log('Error in getAllLiabilityTypes: ' + error.message);
    return getDefaultLiabilityTypes();
  }
}

/**
 * Get default liability types (fallback)
 * @returns {Array} Array of default liability types
 */
function getDefaultLiabilityTypes() {
  return [
    { typeName: 'Home Loan', category: 'Secured', icon: '🏠' },
    { typeName: 'Auto Loan', category: 'Secured', icon: '🚗' },
    { typeName: 'Personal Loan', category: 'Unsecured', icon: '💰' },
    { typeName: 'Education Loan', category: 'Secured', icon: '🎓' },
    { typeName: 'Credit Card', category: 'Unsecured', icon: '💳' },
    { typeName: 'Business Loan', category: 'Secured', icon: '🏪' },
    { typeName: 'Gold Loan', category: 'Secured', icon: '🥇' },
    { typeName: 'Overdraft', category: 'Unsecured', icon: '🏦' },
    { typeName: 'Custom', category: 'Other', icon: '📝' }
  ];
}

/**
 * Add a new liability type
 * @param {Object} data - Liability type data
 * @returns {Object} Success/error response
 */
function addLiabilityType(data) {
  try {
    const sheet = getSheet(CONFIG.liabilityTypesSheet);
    if (!sheet) {
      return { success: false, error: 'LiabilityTypes sheet not found.' };
    }

    // Validate
    if (!data.typeName) {
      return { success: false, error: 'Type Name is required.' };
    }

    // Generate new Type ID
    const typeId = 'LT-' + new Date().getTime();

    // Get next available row
    const nextRow = sheet.getLastRow() + 1;

    // Prepare row data
    const rowData = [
      typeId,
      data.typeName,
      data.category || 'Other',
      data.icon || '📝',
      'Active'
    ];

    // Write to sheet
    sheet.getRange(nextRow, 1, 1, rowData.length).setValues([rowData]);

    return {
      success: true,
      message: `Liability type "${data.typeName}" added successfully!`,
      typeId: typeId
    };

  } catch (error) {
    Logger.log('Error in addLiabilityType: ' + error.message);
    return {
      success: false,
      error: 'Failed to add liability type: ' + error.message
    };
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate unique Liability ID
 * @returns {string} Unique liability ID in format LIA-timestamp
 */
function generateLiabilityId() {
  return 'LIA-' + new Date().getTime();
}

/**
 * Format liability row with borders and alignment
 * @param {Sheet} sheet - Sheet object
 * @param {number} rowIndex - Row number to format
 */
function formatLiabilityRow(sheet, rowIndex) {
  try {
    const range = sheet.getRange(rowIndex, 1, 1, 11); // 11 columns now (added Family Member Name)

    // Add borders
    range.setBorder(true, true, true, true, true, true, '#cbd5e1', SpreadsheetApp.BorderStyle.SOLID);

    // Align columns
    sheet.getRange(rowIndex, 1, 1, 3).setHorizontalAlignment('left');    // ID, Type, Lender
    sheet.getRange(rowIndex, 4).setHorizontalAlignment('center');        // Family Member ID
    sheet.getRange(rowIndex, 5).setHorizontalAlignment('left');          // Family Member Name
    sheet.getRange(rowIndex, 6).setHorizontalAlignment('right');         // Outstanding Balance
    sheet.getRange(rowIndex, 7, 1, 2).setHorizontalAlignment('left');    // Dynamic Fields, Notes
    sheet.getRange(rowIndex, 9).setHorizontalAlignment('center');        // Last Updated
    sheet.getRange(rowIndex, 10).setHorizontalAlignment('center');       // Status
    sheet.getRange(rowIndex, 11).setHorizontalAlignment('center');       // Linked Investment ID

    // Format currency column
    sheet.getRange(rowIndex, 6).setNumberFormat('₹#,##0.00');           // Outstanding Balance

    // Format date column
    sheet.getRange(rowIndex, 9).setNumberFormat('dd-MMM-yyyy HH:mm');   // Last Updated

  } catch (error) {
    Logger.log('Error in formatLiabilityRow: ' + error.message);
  }
}

// ============================================================================
// END OF LIABILITIES.GS
// ============================================================================
