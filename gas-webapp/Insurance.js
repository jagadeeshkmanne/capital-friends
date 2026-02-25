/**
 * ============================================================================
 * INSURANCE.GS - Insurance Policy Tracking Module
 * ============================================================================
 * Purpose: Track insurance policies and sum assured for family awareness
 * Simple tracking with essential fields + Dynamic Fields JSON
 */

/**
 * Get all insurance policies
 * @returns {Array} Array of insurance policy objects
 */
function getAllInsurancePolicies() {
  Logger.log('getAllInsurancePolicies START');
  try {
    const ss = getSpreadsheet();
    Logger.log('Spreadsheet: ' + ss.getName());

    const sheet = ss.getSheetByName('Insurance');
    if (!sheet) {
      Logger.log('Insurance sheet not found - returning empty array');
      return [];
    }
    Logger.log('Sheet found successfully');

    const lastRow = sheet.getLastRow();
    Logger.log('Insurance sheet last row: ' + lastRow);

    // Row 1: Developer credit, Row 2: Headers, Row 3+: Data
    if (lastRow < 3) {
      Logger.log('No insurance policies found (lastRow < 3) - returning empty array');
      return [];
    }

    // Read data (columns A to M - 13 columns)
    Logger.log('Reading data from row 3, columns 1-13, row count: ' + (lastRow - 2));
    const data = sheet.getRange(3, 1, lastRow - 2, 13).getValues();
    Logger.log('Data retrieved, processing ' + data.length + ' rows');
    const policies = [];

    data.forEach((row, index) => {
      Logger.log('Processing row ' + (index + 3) + ', Policy ID: ' + row[0]);
      if (row[0]) { // If Policy ID exists
        // Parse dynamic fields JSON
        let dynamicFields = {};
        try {
          if (row[10]) {
            Logger.log('Parsing dynamic fields: ' + row[10]);
            dynamicFields = JSON.parse(row[10]);
          }
        } catch (e) {
          Logger.log('Error parsing dynamic fields for ' + row[0] + ': ' + e.toString());
        }

        const policy = {
          policyId: String(row[0]),              // A: Policy ID
          policyType: String(row[1] || ''),      // B: Policy Type
          company: String(row[2] || ''),         // C: Insurance Company
          policyNumber: String(row[3] || ''),    // D: Policy Number
          policyName: String(row[4] || ''),      // E: Policy Name
          insuredMember: String(row[5] || ''),   // F: Insured Member (Name)
          memberId: String(row[6] || ''),        // G: Member ID (FM-001, etc.)
          sumAssured: parseFloat(row[7]) || 0,   // H: Sum Assured
          nominee: String(row[8] || ''),         // I: Nominee
          status: String(row[9] || 'Active'),    // J: Policy Status
          premium: parseFloat(dynamicFields['Premium'] || dynamicFields['premium']) || 0,  // Extracted from dynamicFields (React field)
          premiumFrequency: dynamicFields['Premium Frequency'] || dynamicFields['PremiumFrequency'] || dynamicFields['premiumFrequency'] || '',  // Extracted from dynamicFields (React field)
          dynamicFields: dynamicFields,          // K: Dynamic Fields (JSON)
          lastUpdated: row[11] ? row[11].toString() : '', // L: Last Updated
          notes: String(row[12] || '')           // M: Notes
        };
        Logger.log('Created policy object: ' + JSON.stringify(policy));
        policies.push(policy);
      }
    });

    Logger.log('Successfully returning ' + policies.length + ' insurance policies');
    Logger.log('Policies array: ' + JSON.stringify(policies));
    return policies;
  } catch (error) {
    Logger.log('ERROR in getAllInsurancePolicies: ' + error.toString());
    Logger.log('Error stack: ' + error.stack);
    return [];
  }
}

/**
 * Get active insurance policies only
 * @returns {Array} Array of active insurance policy objects
 */
function getActiveInsurancePolicies() {
  try {
    const allPolicies = getAllInsurancePolicies();
    const activePolicies = allPolicies.filter(p => p.status === 'Active');
    Logger.log('Returning ' + activePolicies.length + ' active insurance policies');
    return activePolicies;
  } catch (error) {
    Logger.log('ERROR in getActiveInsurancePolicies: ' + error.toString());
    return [];
  }
}

/**
 * Generate next Policy ID
 * @returns {string} New policy ID (POL-INS-001, POL-INS-002, etc.)
 */
function generatePolicyId() {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName('Insurance');
    if (!sheet) {
      return 'POL-INS-001';
    }

    const lastRow = sheet.getLastRow();
    if (lastRow < 3) {
      return 'POL-INS-001';
    }

    // Get all existing policy IDs
    const policyIds = sheet.getRange(3, 1, lastRow - 2, 1).getValues();
    let maxNumber = 0;

    policyIds.forEach(row => {
      const id = String(row[0]);
      if (id.startsWith('POL-INS-')) {
        const num = parseInt(id.replace('POL-INS-', ''));
        if (!isNaN(num) && num > maxNumber) {
          maxNumber = num;
        }
      }
    });

    const nextNumber = maxNumber + 1;
    const newId = 'POL-INS-' + String(nextNumber).padStart(3, '0');
    Logger.log('Generated new Policy ID: ' + newId);
    return newId;
  } catch (error) {
    Logger.log('ERROR generating policy ID: ' + error.toString());
    return 'POL-INS-001';
  }
}

/**
 * Add new insurance policy
 * @param {Object} policyData - Policy details
 * @returns {Object} Success/error response
 */
function addInsurancePolicy(policyData) {
  try {
    Logger.log('addInsurancePolicy called with: ' + JSON.stringify(policyData));

    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName('Insurance');
    if (!sheet) {
      return { success: false, error: 'Insurance sheet not found' };
    }

    // Validate required fields
    if (!policyData.policyType) {
      return { success: false, error: 'Policy type is required' };
    }
    if (!policyData.company) {
      return { success: false, error: 'Insurance company is required' };
    }
    if (!policyData.policyNumber) {
      return { success: false, error: 'Policy number is required' };
    }
    if (!policyData.policyName) {
      return { success: false, error: 'Policy name is required' };
    }
    if (!policyData.insuredMember) {
      return { success: false, error: 'Insured member is required' };
    }
    if (!policyData.sumAssured || policyData.sumAssured <= 0) {
      return { success: false, error: 'Valid sum assured is required' };
    }

    // Generate new Policy ID
    const policyId = generatePolicyId();

    const now = new Date();

    // Use dynamic fields from policyData (sent as object from HTML)
    const dynamicFields = policyData.dynamicFields || {};

    // Prepare row data (13 columns: A to M)
    const rowData = [
      policyId,                                    // A: Policy ID
      policyData.policyType,                       // B: Policy Type
      policyData.company,                          // C: Insurance Company
      policyData.policyNumber,                     // D: Policy Number
      policyData.policyName,                       // E: Policy Name
      policyData.insuredMember,                    // F: Insured Member (Name)
      policyData.memberId || '',                   // G: Member ID (FM-001, etc.)
      policyData.sumAssured,                       // H: Sum Assured
      policyData.nominee || '',                    // I: Nominee
      policyData.status || 'Active',               // J: Policy Status
      JSON.stringify(dynamicFields),               // K: Dynamic Fields
      now,                                         // L: Last Updated
      policyData.notes || ''                       // M: Notes
    ];

    // Append to sheet
    sheet.appendRow(rowData);

    // CRITICAL FIX: Force immediate flush to prevent delayed row insertion
    SpreadsheetApp.flush();

    // Format the new row
    const lastRow = sheet.getLastRow();
    applyDataRowFormatting(sheet, lastRow, lastRow, 13);

    // Format currency column (H: Sum Assured)
    sheet.getRange(lastRow, 8).setNumberFormat('₹#,##,##0.00');

    // Format timestamp column (L: Last Updated)
    sheet.getRange(lastRow, 12).setNumberFormat('dd-MMM-yyyy hh:mm');

    // Update Questionnaire if Term or Health Insurance
    updateQuestionnaireForInsurance(policyData.policyType);

    Logger.log('Insurance policy added successfully: ' + policyId);
    return {
      success: true,
      message: 'Insurance policy added successfully!',
      policyId: policyId
    };

  } catch (error) {
    Logger.log('ERROR in addInsurancePolicy: ' + error.toString());
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * Get insurance policy by ID
 * @param {string} policyId - Policy ID to find
 * @returns {Object|null} Policy object or null
 */
function getInsurancePolicyById(policyId) {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName('Insurance');
    if (!sheet) {
      Logger.log('Insurance sheet not found');
      return null;
    }

    const lastRow = sheet.getLastRow();
    if (lastRow < 3) {
      return null;
    }

    const data = sheet.getRange(3, 1, lastRow - 2, 13).getValues();

    for (let i = 0; i < data.length; i++) {
      if (String(data[i][0]) === policyId) {
        const row = data[i];

        // Parse dynamic fields
        let dynamicFields = {};
        try {
          if (row[10]) {
            dynamicFields = JSON.parse(row[10]);
          }
        } catch (e) {
          Logger.log('Error parsing dynamic fields: ' + e.toString());
        }

        return {
          policyId: String(row[0]),              // A: Policy ID
          policyType: String(row[1] || ''),      // B: Policy Type
          company: String(row[2] || ''),         // C: Insurance Company
          policyNumber: String(row[3] || ''),    // D: Policy Number
          policyName: String(row[4] || ''),      // E: Policy Name
          insuredMember: String(row[5] || ''),   // F: Insured Member (Name)
          memberId: String(row[6] || ''),        // G: Member ID
          sumAssured: parseFloat(row[7]) || 0,   // H: Sum Assured
          nominee: String(row[8] || ''),         // I: Nominee
          status: String(row[9] || 'Active'),    // J: Policy Status
          dynamicFields: dynamicFields,          // K: Dynamic Fields (JSON)
          notes: String(row[12] || ''),          // M: Notes
          rowIndex: i + 3 // Actual sheet row number
        };
      }
    }

    return null;
  } catch (error) {
    Logger.log('ERROR in getInsurancePolicyById: ' + error.toString());
    return null;
  }
}

/**
 * Update existing insurance policy
 * @param {string} policyId - Policy ID to update
 * @param {Object} policyData - Updated policy data
 * @returns {Object} Success/error response
 */
function updateInsurancePolicy(policyId, policyData) {
  try {
    Logger.log('updateInsurancePolicy called for: ' + policyId);

    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName('Insurance');
    if (!sheet) {
      return { success: false, error: 'Insurance sheet not found' };
    }

    // Find the policy
    const policy = getInsurancePolicyById(policyId);
    if (!policy) {
      return { success: false, error: 'Policy not found: ' + policyId };
    }

    const rowIndex = policy.rowIndex;

    // Use dynamic fields from policyData (sent as object from HTML)
    const dynamicFields = policyData.dynamicFields || {};

    const now = new Date();

    // Update row data (13 columns: A to M)
    const rowData = [
      policyId,                                    // A: Policy ID (unchanged)
      policyData.policyType,                       // B: Policy Type
      policyData.company,                          // C: Insurance Company
      policyData.policyNumber,                     // D: Policy Number
      policyData.policyName,                       // E: Policy Name
      policyData.insuredMember,                    // F: Insured Member (Name)
      policyData.memberId || '',                   // G: Member ID
      policyData.sumAssured,                       // H: Sum Assured
      policyData.nominee || '',                    // I: Nominee
      policyData.status || 'Active',               // J: Policy Status
      JSON.stringify(dynamicFields),               // K: Dynamic Fields
      now,                                         // L: Last Updated
      policyData.notes || ''                       // M: Notes
    ];

    // Update the row
    sheet.getRange(rowIndex, 1, 1, 13).setValues([rowData]);

    // CRITICAL FIX: Force immediate flush to prevent delayed update
    SpreadsheetApp.flush();

    // Re-apply formatting
    applyDataRowFormatting(sheet, rowIndex, rowIndex, 13);
    sheet.getRange(rowIndex, 8).setNumberFormat('₹#,##,##0.00');
    sheet.getRange(rowIndex, 12).setNumberFormat('dd-MMM-yyyy hh:mm');

    Logger.log('Insurance policy updated successfully: ' + policyId);
    return {
      success: true,
      message: 'Insurance policy updated successfully!'
    };

  } catch (error) {
    Logger.log('ERROR in updateInsurancePolicy: ' + error.toString());
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * Format date for HTML input (YYYY-MM-DD)
 * @param {Date|string} date - Date object or string
 * @returns {string} Formatted date string
 */
function formatDateForInput(date) {
  if (!date) return '';

  // If it's already a string in YYYY-MM-DD format, return it
  if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return date;
  }

  const d = new Date(date);
  if (isNaN(d.getTime())) return '';

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Update Questionnaire sheet when insurance is added
 * Sets Health Insurance or Term Insurance to "Yes" based on policy type
 */
function updateQuestionnaireForInsurance(policyType) {
  try {
    if (!policyType) return;

    const type = policyType.toString().trim();

    // Only update for Term or Health Insurance
    if (type !== 'Term Insurance' && type !== 'Health Insurance') {
      return;
    }

    const questionnaireSheet = getSheet(CONFIG.questionnaireSheet);
    if (!questionnaireSheet) {
      Logger.log('Questionnaire sheet not found - skipping update');
      return;
    }

    const lastRow = questionnaireSheet.getLastRow();
    if (lastRow < 3) {
      Logger.log('No questionnaire data found - skipping update');
      return;
    }

    // Get current values
    const currentValues = questionnaireSheet.getRange(lastRow, 1, 1, 11).getValues()[0];

    // Update the appropriate column
    if (type === 'Health Insurance') {
      // Column C (index 2): Health Insurance
      questionnaireSheet.getRange(lastRow, 3).setValue('Yes');
      Logger.log('Updated Questionnaire: Health Insurance = Yes');
    } else if (type === 'Term Insurance') {
      // Column D (index 3): Term Insurance
      questionnaireSheet.getRange(lastRow, 4).setValue('Yes');
      Logger.log('Updated Questionnaire: Term Insurance = Yes');
    }

    // Recalculate score
    const q1 = currentValues[1] || ''; // Family Awareness
    const q2 = (type === 'Health Insurance') ? 'Yes' : (currentValues[2] || ''); // Health Insurance
    const q3 = (type === 'Term Insurance') ? 'Yes' : (currentValues[3] || ''); // Term Insurance
    const q4 = currentValues[4] || ''; // Will
    const q5 = currentValues[5] || ''; // Nominees
    const q6 = currentValues[6] || ''; // Emergency Fund
    const q7 = currentValues[7] || ''; // Documents Organized
    const q8 = currentValues[8] || ''; // Access Shared

    let newScore = 0;
    if (q1.toLowerCase() === 'yes') newScore++;
    if (q2.toLowerCase() === 'yes') newScore++;
    if (q3.toLowerCase() === 'yes') newScore++;
    if (q4.toLowerCase() === 'yes') newScore++;
    if (q5.toLowerCase() === 'yes') newScore++;
    if (q6.toLowerCase() === 'yes') newScore++;
    if (q7.toLowerCase() === 'yes') newScore++;
    if (q8.toLowerCase() === 'yes') newScore++;

    // Update score in column J (index 10)
    questionnaireSheet.getRange(lastRow, 10).setValue(newScore);
    Logger.log('Updated Questionnaire Score: ' + newScore + '/8');

    SpreadsheetApp.flush();

  } catch (error) {
    Logger.log('Error updating questionnaire for insurance: ' + error.toString());
    // Don't throw error - this is a non-critical update
  }
}

// ============================================================================
// END OF INSURANCE.GS
// ============================================================================
