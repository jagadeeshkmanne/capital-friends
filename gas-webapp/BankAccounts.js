/**
 * ============================================================================
 * BANKACCOUNTS.GS - Bank Accounts Management for Capital Friends V2
 * ============================================================================
 */

/**
 * Add new bank account
 * @param {Object} data - Account data object
 * @returns {Object} - Success/error response
 */
function addBankAccount(data) {
  try {
    // Validate required fields
    isRequired(data.accountName, 'Account Name');
    isRequired(data.memberId, 'Family Member');
    isRequired(data.bankName, 'Bank Name');
    isRequired(data.accountNumber, 'Account Number');
    isRequired(data.ifscCode, 'IFSC Code');
    isRequired(data.branchName, 'Branch Name');
    isRequired(data.accountType, 'Account Type');

    // Get sheet
    const sheet = getSheet(CONFIG.bankAccountsSheet);
    if (!sheet) {
      throw new Error('BankAccounts sheet not found. Please run ONE-CLICK SETUP first.');
    }

    // Check for duplicate account number
    const existingData = sheet.getRange(3, 1, Math.max(1, sheet.getLastRow() - 2), 12).getValues();
    for (let i = 0; i < existingData.length; i++) {
      if (existingData[i][5] && existingData[i][5].toString() === data.accountNumber.toString()) {
        throw new Error('Account Number already exists');
      }
    }

    // Generate Record ID (BA-001, BA-002, etc.)
    const existingIds = existingData.map(row => row[0]);
    const accountId = generateId('BA', existingIds);

    // Get member name from member ID
    const member = getFamilyMemberById(data.memberId);
    if (!member) {
      throw new Error('Selected family member not found');
    }
    const memberName = member.memberName;

    // Add account
    const now = getCurrentTimestamp();

    sheet.appendRow([
      accountId,           // Column A: Record ID (BA-001, BA-002...)
      data.accountName,    // Column B: Account Name
      data.memberId,       // Column C: Member ID
      memberName,          // Column D: Member Name
      data.bankName,       // Column E: Bank Name
      data.accountNumber,  // Column F: Account Number
      data.ifscCode.toUpperCase(),  // Column G: IFSC Code
      data.branchName,              // Column H: Branch Name
      data.accountType,             // Column I: Account Type
      'Active',            // Column J: Status
      now,                 // Column K: Created Date
      now                  // Column L: Last Updated
    ]);

    // Apply formatting to the new row (borders only, no background)
    const newRow = sheet.getLastRow();
    applyDataRowFormatting(sheet, newRow, newRow, 12);

    log(`Bank account added: ${accountId} - ${data.accountName}`);

    return {
      success: true,
      message: `Bank account "${data.accountName}" added successfully!`,
      accountId: accountId
    };

  } catch (error) {
    log('Error adding bank account: ' + error.toString());
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * Get all bank accounts
 * @returns {Array} - Array of account objects
 */
function getAllBankAccounts() {
  try {
    log('getAllBankAccounts() called');

    const sheet = getSheet(CONFIG.bankAccountsSheet);
    if (!sheet) {
      log('ERROR: BankAccounts sheet not found');
      return [];
    }
    log('BankAccounts sheet found');

    const lastRow = sheet.getLastRow();
    log('Last row: ' + lastRow);

    if (lastRow <= 2) {
      log('No accounts data (lastRow <= 2), returning empty array');
      return []; // No accounts yet
    }

    const data = sheet.getRange(3, 1, lastRow - 2, 12).getValues();
    log('Data rows read: ' + data.length);

    const accounts = [];

    data.forEach(row => {
      if (row[0]) { // If Record ID exists (Column A)
        accounts.push({
          accountId: row[0],       // Column A
          accountName: row[1],     // Column B
          memberId: row[2],        // Column C
          memberName: row[3],      // Column D
          bankName: row[4],        // Column E
          accountNumber: row[5],   // Column F
          ifscCode: row[6],        // Column G
          branchName: row[7],      // Column H
          accountType: row[8],     // Column I
          status: row[9],          // Column J
          createdDate: row[10] ? row[10].toString() : '',  // Column K - Convert Date to String
          lastUpdated: row[11] ? row[11].toString() : ''   // Column L - Convert Date to String
        });
      }
    });

    log('Returning ' + accounts.length + ' accounts');
    return accounts;

  } catch (error) {
    log('ERROR in getAllBankAccounts: ' + error.toString());
    log('Stack trace: ' + error.stack);
    // Return empty array instead of null to avoid issues in UI
    return [];
  }
}

/**
 * Get bank account by ID
 * @param {string} accountId - Account ID
 * @returns {Object|null} - Account object or null
 */
function getBankAccountById(accountId) {
  try {
    const accounts = getAllBankAccounts();
    return accounts.find(a => a.accountId === accountId) || null;
  } catch (error) {
    log('Error getting bank account: ' + error.toString());
    return null;
  }
}

/**
 * Update bank account
 * @param {Object} data - Updated account data
 * @returns {Object} - Success/error response
 */
function updateBankAccount(data) {
  try {
    // Validate required fields
    isRequired(data.accountId, 'Record ID');
    isRequired(data.accountName, 'Account Name');
    isRequired(data.memberId, 'Family Member');
    isRequired(data.bankName, 'Bank Name');
    isRequired(data.accountNumber, 'Account Number');
    isRequired(data.ifscCode, 'IFSC Code');
    isRequired(data.branchName, 'Branch Name');
    isRequired(data.accountType, 'Account Type');

    // Get sheet
    const sheet = getSheet(CONFIG.bankAccountsSheet);
    if (!sheet) {
      throw new Error('BankAccounts sheet not found');
    }

    // Find account row (Record ID is in Column A)
    const lastRow = sheet.getLastRow();
    const accountIds = sheet.getRange(3, 1, lastRow - 2, 1).getValues(); // Column A
    let rowIndex = -1;

    for (let i = 0; i < accountIds.length; i++) {
      if (accountIds[i][0] === data.accountId) {
        rowIndex = i + 3; // +3 because of credit row + header row + 0-index
        break;
      }
    }

    if (rowIndex === -1) {
      throw new Error('Account not found');
    }

    // Check for duplicate account number (excluding current account)
    const existingData = sheet.getRange(3, 1, lastRow - 2, 12).getValues();
    for (let i = 0; i < existingData.length; i++) {
      if (existingData[i][0] !== data.accountId) { // Column A is Record ID
        if (existingData[i][5] && existingData[i][5].toString() === data.accountNumber.toString()) { // Column F is Account Number
          throw new Error('Account Number already exists for another account');
        }
      }
    }

    // Get member name from member ID
    const member = getFamilyMemberById(data.memberId);
    if (!member) {
      throw new Error('Selected family member not found');
    }
    const memberName = member.memberName;

    // Update account (keep Record ID, Created Date, update rest)
    const createdDate = sheet.getRange(rowIndex, 11).getValue(); // Column K is Created Date

    sheet.getRange(rowIndex, 1, 1, 12).setValues([[
      data.accountId,                   // Column A: Record ID
      data.accountName,                 // Column B: Account Name
      data.memberId,                    // Column C: Member ID
      memberName,                       // Column D: Member Name
      data.bankName,                    // Column E: Bank Name
      data.accountNumber,               // Column F: Account Number
      data.ifscCode.toUpperCase(),      // Column G: IFSC Code
      data.branchName,                  // Column H: Branch Name
      data.accountType,                 // Column I: Account Type
      data.status || 'Active',          // Column J: Status
      createdDate,                      // Column K: Created Date
      getCurrentTimestamp()             // Column L: Last Updated
    ]]);

    log(`Bank account updated: ${data.accountId} - ${data.accountName}`);

    return {
      success: true,
      message: `Bank account "${data.accountName}" updated successfully!`
    };

  } catch (error) {
    log('Error updating bank account: ' + error.toString());
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * Delete bank account (set status to Inactive)
 * @param {string} accountId - Account ID
 * @returns {Object} - Success/error response
 */
function deleteBankAccount(accountId) {
  try {
    isRequired(accountId, 'Account ID');

    const sheet = getSheet(CONFIG.bankAccountsSheet);
    if (!sheet) {
      throw new Error('BankAccounts sheet not found');
    }

    // Find account row
    const lastRow = sheet.getLastRow();
    const accountIds = sheet.getRange(3, 1, lastRow - 2, 1).getValues();
    let rowIndex = -1;
    let accountName = '';

    for (let i = 0; i < accountIds.length; i++) {
      if (accountIds[i][0] === accountId) {
        rowIndex = i + 3;
        accountName = sheet.getRange(rowIndex, 2).getValue();
        break;
      }
    }

    if (rowIndex === -1) {
      throw new Error('Account not found');
    }

    // Set status to Inactive
    sheet.getRange(rowIndex, 10).setValue('Inactive');  // Column J
    sheet.getRange(rowIndex, 12).setValue(getCurrentTimestamp());  // Column L

    log(`Bank account deleted (status=Inactive): ${accountId} - ${accountName}`);

    return {
      success: true,
      message: `Bank account "${accountName}" deleted successfully!`
    };

  } catch (error) {
    log('Error deleting bank account: ' + error.toString());
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * Get bank account dropdown options for other forms
 * @returns {Array} - Array of {id, name} objects
 */
function getBankAccountOptions() {
  const accounts = getAllBankAccounts();
  return accounts
    .filter(a => a.status === 'Active')
    .map(a => ({
      id: a.accountId,
      name: `${a.accountName} - ${a.bankName}`
    }));
}

// ============================================================================
// END OF BANKACCOUNTS.GS
// ============================================================================
