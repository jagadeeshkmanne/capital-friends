/**
 * ============================================================================
 * INVESTMENTACCOUNTS.GS - Investment Accounts Management for Capital Friends V2
 * ============================================================================
 * Handles Demat Accounts, Mutual Fund Platforms, Trading Accounts, Direct AMC, Broker Accounts
 */

/**
 * Add new investment account
 * @param {Object} data - Account data object
 * @returns {Object} - Success/error response
 */
function addInvestmentAccount(data) {
  try {
    // Validate required fields
    isRequired(data.accountName, 'Account Name');
    isRequired(data.memberId, 'Family Member');
    isRequired(data.bankAccountId, 'Bank Account');
    isRequired(data.accountType, 'Account Type');
    isRequired(data.platformBroker, 'Platform/Broker');
    // accountClientId is optional (broker accounts may not have one)
    isRequired(data.registeredEmail, 'Registered Email');
    isRequired(data.registeredPhone, 'Registered Phone');

    // Validate email format
    if (!isValidEmail(data.registeredEmail)) {
      throw new Error('Invalid email format');
    }

    // Get sheet
    const sheet = getSheet(CONFIG.investmentAccountsSheet);
    if (!sheet) {
      throw new Error('InvestmentAccounts sheet not found. Please run ONE-CLICK SETUP first.');
    }

    const existingData = sheet.getRange(3, 1, Math.max(1, sheet.getLastRow() - 2), 15).getValues();

    // Generate Record ID (IA-001, IA-002, etc.)
    const existingIds = existingData.map(row => row[0]);
    const accountId = generateId('IA', existingIds);

    // Get member name from member ID
    const member = getFamilyMemberById(data.memberId);
    if (!member) {
      throw new Error('Selected family member not found');
    }
    const memberName = member.memberName;

    // Get bank account name from bank account ID
    const bankAccount = getBankAccountById(data.bankAccountId);
    if (!bankAccount) {
      throw new Error('Selected bank account not found');
    }
    const bankAccountName = bankAccount.accountName;

    // Add account
    const now = getCurrentTimestamp();

    sheet.appendRow([
      accountId,                      // Column A: Record ID (IA-001, IA-002...)
      data.accountName,               // Column B: Account Name
      data.memberId,                  // Column C: Member ID
      memberName,                     // Column D: Member Name
      data.bankAccountId,             // Column E: Bank Account ID
      bankAccountName,                // Column F: Bank Account Name
      data.accountType,               // Column G: Account Type
      data.platformBroker,            // Column H: Platform/Broker
      data.accountClientId,           // Column I: Account/Client ID
      data.dematDpId || '',           // Column J: Demat DP ID (optional)
      data.registeredEmail,           // Column K: Registered Email
      data.registeredPhone,           // Column L: Registered Phone
      'Active',                       // Column M: Status
      now,                            // Column N: Created Date
      now                             // Column O: Last Updated
    ]);

    // Apply formatting to the new row (borders only, no background)
    const newRow = sheet.getLastRow();
    applyDataRowFormatting(sheet, newRow, newRow, 15);

    log(`Investment account added: ${accountId} - ${data.accountName}`);

    return {
      success: true,
      message: `Investment account "${data.accountName}" added successfully!`,
      accountId: accountId
    };

  } catch (error) {
    log('Error adding investment account: ' + error.toString());
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * Get all investment accounts
 * @returns {Array} - Array of account objects
 */
function getAllInvestmentAccounts() {
  try {
    log('getAllInvestmentAccounts() called');

    const sheet = getSheet(CONFIG.investmentAccountsSheet);
    if (!sheet) {
      log('ERROR: InvestmentAccounts sheet not found');
      return [];
    }
    log('InvestmentAccounts sheet found');

    const lastRow = sheet.getLastRow();
    log('Last row: ' + lastRow);

    if (lastRow <= 2) {
      log('No accounts data (lastRow <= 2), returning empty array');
      return []; // No accounts yet
    }

    const data = sheet.getRange(3, 1, lastRow - 2, 15).getValues();
    log('Data rows read: ' + data.length);

    const accounts = [];

    // DEBUG: Log first to see what we're getting
    console.log('DEBUG getAllInvestmentAccounts - Total rows:', data.length);
    data.forEach((row, index) => {
      console.log('DEBUG - Row', index, 'Account ID:', row[0], 'columns[8-11]:', row[8], row[9], row[10], row[11]);
    });

    data.forEach(row => {
      if (row[0]) { // If Record ID exists (Column A)
        accounts.push({
          accountId: row[0],           // Column A
          accountName: row[1],         // Column B
          memberId: row[2],            // Column C
          memberName: row[3],          // Column D
          bankAccountId: row[4],       // Column E
          bankAccountName: row[5],     // Column F
          accountType: row[6],         // Column G
          platformBroker: row[7],      // Column H
          accountClientId: row[8],     // Column I
          dematDpId: row[9],           // Column J
          registeredEmail: row[10],    // Column K
          registeredPhone: row[11],    // Column L
          status: row[12],             // Column M
          createdDate: row[13] ? row[13].toString() : '',  // Column N - Convert Date to String
          lastUpdated: row[14] ? row[14].toString() : ''   // Column O - Convert Date to String
        });
      }
    });

    log('Returning ' + accounts.length + ' accounts');
    return accounts;

  } catch (error) {
    log('ERROR in getAllInvestmentAccounts: ' + error.toString());
    log('Stack trace: ' + error.stack);
    // Return empty array instead of null to avoid issues in UI
    return [];
  }
}

/**
 * Get investment account by ID
 * @param {string} accountId - Account ID
 * @returns {Object|null} - Account object or null
 */
function getInvestmentAccountById(accountId) {
  try {
    const accounts = getAllInvestmentAccounts();
    const foundAccount = accounts.find(a => a.accountId === accountId) || null;

    // DEBUG: Log account lookup
    console.log('DEBUG getInvestmentAccountById - Looking for:', accountId);
    console.log('DEBUG - Found account:', foundAccount ? foundAccount.accountName : 'NOT FOUND');
    if (foundAccount) {
      console.log('DEBUG - Account details:', {
        platformBroker: foundAccount.platformBroker,
        accountClientId: foundAccount.accountClientId,
        registeredEmail: foundAccount.registeredEmail,
        registeredPhone: foundAccount.registeredPhone
      });
    }

    return foundAccount;
  } catch (error) {
    log('Error getting investment account: ' + error.toString());
    return null;
  }
}

/**
 * Update investment account
 * @param {Object} data - Updated account data
 * @returns {Object} - Success/error response
 */
function updateInvestmentAccount(data) {
  try {
    // Validate required fields
    isRequired(data.accountId, 'Record ID');
    isRequired(data.accountName, 'Account Name');
    isRequired(data.memberId, 'Family Member');
    isRequired(data.bankAccountId, 'Bank Account');
    isRequired(data.accountType, 'Account Type');
    isRequired(data.platformBroker, 'Platform/Broker');
    // accountClientId is optional (broker accounts may not have one)
    isRequired(data.registeredEmail, 'Registered Email');
    isRequired(data.registeredPhone, 'Registered Phone');

    // Validate email format
    if (!isValidEmail(data.registeredEmail)) {
      throw new Error('Invalid email format');
    }

    // Get sheet
    const sheet = getSheet(CONFIG.investmentAccountsSheet);
    if (!sheet) {
      throw new Error('InvestmentAccounts sheet not found');
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

    // Get member name from member ID
    const member = getFamilyMemberById(data.memberId);
    if (!member) {
      throw new Error('Selected family member not found');
    }
    const memberName = member.memberName;

    // Get bank account name from bank account ID
    const bankAccount = getBankAccountById(data.bankAccountId);
    if (!bankAccount) {
      throw new Error('Selected bank account not found');
    }
    const bankAccountName = bankAccount.accountName;

    // Update account (keep Record ID, Created Date, update rest)
    const createdDate = sheet.getRange(rowIndex, 14).getValue(); // Column N is Created Date

    sheet.getRange(rowIndex, 1, 1, 15).setValues([[
      data.accountId,                   // Column A: Record ID
      data.accountName,                 // Column B: Account Name
      data.memberId,                    // Column C: Member ID
      memberName,                       // Column D: Member Name
      data.bankAccountId,               // Column E: Bank Account ID
      bankAccountName,                  // Column F: Bank Account Name
      data.accountType,                 // Column G: Account Type
      data.platformBroker,              // Column H: Platform/Broker
      data.accountClientId,             // Column I: Account/Client ID
      data.dematDpId || '',             // Column J: Demat DP ID
      data.registeredEmail,             // Column K: Registered Email
      data.registeredPhone,             // Column L: Registered Phone
      data.status || 'Active',          // Column M: Status
      createdDate,                      // Column N: Created Date
      getCurrentTimestamp()             // Column O: Last Updated
    ]]);

    log(`Investment account updated: ${data.accountId} - ${data.accountName}`);

    return {
      success: true,
      message: `Investment account "${data.accountName}" updated successfully!`
    };

  } catch (error) {
    log('Error updating investment account: ' + error.toString());
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * Delete investment account (set status to Inactive)
 * @param {string} accountId - Account ID
 * @returns {Object} - Success/error response
 */
function deleteInvestmentAccount(accountId) {
  try {
    isRequired(accountId, 'Account ID');

    const sheet = getSheet(CONFIG.investmentAccountsSheet);
    if (!sheet) {
      throw new Error('InvestmentAccounts sheet not found');
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
    sheet.getRange(rowIndex, 13).setValue('Inactive');  // Column M
    sheet.getRange(rowIndex, 15).setValue(getCurrentTimestamp());  // Column O

    log(`Investment account deleted (status=Inactive): ${accountId} - ${accountName}`);

    return {
      success: true,
      message: `Investment account "${accountName}" deleted successfully!`
    };

  } catch (error) {
    log('Error deleting investment account: ' + error.toString());
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * Get investment account dropdown options for other forms
 * @returns {Array} - Array of {id, name, type} objects
 */
function getInvestmentAccountOptions() {
  const accounts = getAllInvestmentAccounts();
  return accounts
    .filter(a => a.status === 'Active')
    .map(a => ({
      id: a.accountId,
      name: `${a.accountName} - ${a.platformBroker}`,
      type: a.accountType
    }));
}

// ============================================================================
// END OF INVESTMENTACCOUNTS.GS
// ============================================================================
