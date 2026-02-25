/**
 * ============================================================================
 * SETUP.GS - Sheet Setup Functions for Capital Friends V2
 * ============================================================================
 */

/**
 * ONE-CLICK SETUP
 * Shows questionnaire first (only on first-time), then creates all required sheets
 */
function oneClickSetup() {
  const ui = SpreadsheetApp.getUi();

  // Check if questionnaire has been completed
  const questionnaireSheet = getSheet(CONFIG.questionnaireSheet);
  const hasQuestionnaireData = questionnaireSheet && questionnaireSheet.getLastRow() > 2;

  if (!hasQuestionnaireData) {
    // Questionnaire NOT answered - show questionnaire dialog (first-time setup)
    const template = HtmlService.createTemplateFromFile('QuestionnaireSetup');
    const htmlOutput = template.evaluate()
      .setWidth(800)
      .setHeight(650);
    ui.showModalDialog(htmlOutput, '💚 Family Financial Health Check');
  } else {
    // Questionnaire already filled, create missing sheets (if any)
    // Show progress dialog
    const htmlTemplate = `
      <!DOCTYPE html>
      <html>
      <head>
        <base target="_top">
        <style>
          body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            margin: 0;
            padding: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 200px;
            background: white;
          }
          .container {
            text-align: center;
            padding: 2rem;
          }
          .spinner {
            width: 50px;
            height: 50px;
            margin: 0 auto 1.5rem;
            border: 4px solid #e5e7eb;
            border-top-color: #0284c7;
            border-radius: 50%;
            animation: spin 1s linear infinite;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
          .title {
            font-size: 1.125rem;
            font-weight: 700;
            color: #0f172a;
            margin-bottom: 0.5rem;
          }
          .subtitle {
            font-size: 0.875rem;
            color: #64748b;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="spinner"></div>
          <div class="title">Setting up your system...</div>
          <div class="subtitle">Please wait while we create the required sheets</div>
        </div>
        <script>
          // Auto-trigger sheet creation
          google.script.run
            .withSuccessHandler(function(results) {
              // Hide spinner, show results
              document.querySelector('.spinner').style.display = 'none';

              let message = '';
              let icon = '';

              if (results.created.length > 0) {
                icon = '✅';
                message = '<div style="font-weight: 600; margin-bottom: 0.5rem;">Created ' + results.created.length + ' new sheet(s):</div>';
                results.created.forEach(function(name) {
                  message += '<div style="margin-left: 1rem;">✓ ' + name + '</div>';
                });
                message += '<div style="margin-top: 0.75rem; color: #10b981;">🎉 Setup complete! Your sheets are ready to use.</div>';
              } else if (results.existing.length > 0) {
                icon = '✅';
                message = '<div style="font-weight: 600; margin-bottom: 0.5rem;">System Already Set Up</div>';
                message += '<div style="margin-top: 0.5rem; font-size: 0.875rem;">All <strong>' + results.existing.length + ' sheets</strong> already exist:</div>';
                message += '<div style="margin-left: 1rem; font-size: 0.75rem; color: #64748b; margin-top: 0.25rem;">';
                results.existing.forEach(function(name) {
                  message += '✓ ' + name + '<br>';
                });
                message += '</div>';
                message += '<div style="color: #10b981; margin-top: 0.75rem; font-weight: 600;">Your Capital Friends system is ready to use!</div>';
              }

              if (results.errors.length > 0) {
                icon = '❌';
                message += '<div style="color: #dc2626; font-weight: 600; margin-top: 1rem;">' + results.errors.length + ' error(s) occurred:</div>';
                results.errors.forEach(function(error) {
                  message += '<div style="margin-left: 1rem; color: #dc2626;">✗ ' + error + '</div>';
                });
              }

              document.querySelector('.title').innerHTML = icon + ' Setup Complete';
              document.querySelector('.subtitle').innerHTML = message;

              // Close dialog after 5 seconds (increased from 3s for better visibility)
              setTimeout(function() {
                google.script.host.close();
              }, 5000);
            })
            .withFailureHandler(function(error) {
              document.querySelector('.spinner').style.display = 'none';
              document.querySelector('.title').textContent = '❌ Error';
              document.querySelector('.subtitle').innerHTML = '<div style="color: #dc2626;">' + error.message + '</div>';

              setTimeout(function() {
                google.script.host.close();
              }, 5000);
            })
            .performSheetCreation();
        </script>
      </body>
      </html>
    `;

    const htmlOutput = HtmlService.createHtmlOutput(htmlTemplate)
      .setWidth(500)
      .setHeight(450);
    ui.showModalDialog(htmlOutput, '⚙️ Setup in Progress');
  }
}

/**
 * Perform sheet creation and return results
 * Called from progress dialog after questionnaire is already answered
 * Returns results object to be displayed in the progress dialog
 */
function performSheetCreation() {
  const createResults = createAllSheets();
  return createResults;
}

/**
 * Create all sheets after questionnaire completion
 * Called from questionnaire after successful submission OR from performSheetCreation()
 */
function createAllSheets() {
  const results = {
    created: [],
    existing: [],
    errors: []
  };

  // Set spreadsheet locale to India for proper Indian numbering format
  const spreadsheet = getSpreadsheet();
  spreadsheet.setSpreadsheetLocale('en_IN');  // India (English)
  spreadsheet.setSpreadsheetTimeZone('Asia/Kolkata');  // Indian Standard Time

  const sheetsToCreate = [
    // ✅ REMOVED: Dashboard sheet - now using HTML dashboard only
    { name: 'FamilyMembers', func: setupFamilyMembersSheet },
    { name: 'BankAccounts', func: setupBankAccountsSheet },
    { name: 'InvestmentAccounts', func: setupInvestmentAccountsSheet },
    { name: 'OtherInvestments', func: setupOtherInvestmentsSheet },
    { name: 'InvestmentTypes', func: setupInvestmentTypesSheet },
    { name: 'Insurance', func: setupInsuranceSheet },
    // ✅ REMOVED: Loans sheet (now unified into Liabilities)
    { name: 'Liabilities', func: setupLiabilitiesSheet },
    { name: 'LiabilityTypes', func: setupLiabilityTypesSheet },
    { name: 'AllPortfolios', func: setupPortfolioMetadataSheet },
    { name: 'AssetAllocations', func: setupAssetAllocationsSheet },
    { name: 'MutualFundData', func: setupMutualFundDataSheet },
    { name: 'TransactionHistory', func: setupTransactionHistorySheet },
    // Stock sheets
    { name: 'StockPortfolios', func: setupStockPortfoliosSheet },
    { name: 'StockTransactions', func: setupStockTransactionsSheet },
    { name: 'StockHoldings', func: setupStockHoldingsSheet },
    { name: 'StockMasterData', func: setupStockMasterDataSheet },
    { name: 'Reminders', func: setupRemindersSheet },
    { name: 'Settings', func: setupSettingsSheet }
  ];

  // Create each sheet
  sheetsToCreate.forEach(item => {
    try {
      if (sheetExists(item.name)) {
        results.existing.push(item.name);
      } else {
        item.func();
        results.created.push(item.name);
      }
    } catch (error) {
      results.errors.push(`${item.name}: ${error.message}`);
      log(`Error creating ${item.name}: ${error.message}`);
    }
  });

  // Install triggers automatically after creating sheets
  try {
    installTriggers(false); // false = don't show popup message
    log('Triggers installed successfully');
  } catch (error) {
    log('Error installing triggers: ' + error.message);
    // Don't fail setup if trigger installation fails
  }

  // Auto-configure email to Daily 9 AM (users can change later)
  try {
    const emailResult = updateEmailSchedule('daily', 9);
    if (emailResult.success) {
      log('Email schedule configured: Daily 9 AM');
    } else {
      log('Email configuration warning: ' + (emailResult.error || 'Unknown error'));
    }
  } catch (error) {
    log('Error configuring email schedule: ' + error.message);
    // Don't fail setup if email configuration fails
  }

  return results;
}

// ============================================================================
// SHEET SETUP FUNCTIONS
// ============================================================================

/**
 * Setup FamilyMembers Sheet
 * Structure: 11 columns (A-K) with mandatory fields
 */
function setupFamilyMembersSheet() {
  const spreadsheet = getSpreadsheet();
  const sheet = spreadsheet.insertSheet(CONFIG.familyMembersSheet);

  // Add developer credit
  addDeveloperCredit(sheet, 12);

  // Add headers
  sheet.appendRow([
    'Member ID',
    'Member Name',
    'Relationship',
    'PAN',
    'Aadhar',
    'Email',
    'Mobile',
    'Include in Email Reports',
    'Status',
    'Created Date',
    'Last Updated',
    'Dynamic Fields'
  ]);

  // Format header
  formatHeaderRow(sheet, sheet.getRange('A2:L2'), 40);

  // Set column widths
  sheet.setColumnWidth(1, 100);  // Member ID
  sheet.setColumnWidth(2, 180);  // Member Name
  sheet.setColumnWidth(3, 120);  // Relationship
  sheet.setColumnWidth(4, 110);  // PAN
  sheet.setColumnWidth(5, 130);  // Aadhar
  sheet.setColumnWidth(6, 200);  // Email
  sheet.setColumnWidth(7, 110);  // Mobile
  sheet.setColumnWidth(8, 150);  // Include in Email Reports
  sheet.setColumnWidth(9, 80);   // Status
  sheet.setColumnWidth(10, 130); // Created Date
  sheet.setColumnWidth(11, 130); // Last Updated
  sheet.setColumnWidth(12, 300); // Dynamic Fields

  applyStandardFormatting(sheet);

  // Protect Member ID column (Column A) - warning only
  const memberIdColumn = sheet.getRange('A3:A1000');
  const memberIdProtection = memberIdColumn.protect().setDescription('Member ID is auto-generated and cannot be edited');
  memberIdProtection.setWarningOnly(true);

  // Set tab color (Blue for family-related sheets)
  sheet.setTabColor('#3b82f6');

  log('FamilyMembers sheet created');
  return sheet;
}

/**
 * Setup BankAccounts Sheet
 * Simplified structure: 10 columns (A-J)
 */
function setupBankAccountsSheet() {
  const spreadsheet = getSpreadsheet();
  const sheet = spreadsheet.insertSheet(CONFIG.bankAccountsSheet);

  addDeveloperCredit(sheet, 12);

  sheet.appendRow([
    'Record ID',
    'Account Name',
    'Member ID',
    'Member Name',
    'Bank Name',
    'Account Number',
    'IFSC Code',
    'Branch Name',
    'Account Type',
    'Status',
    'Created Date',
    'Last Updated'
  ]);

  formatHeaderRow(sheet, sheet.getRange('A2:L2'), 40);

  sheet.setColumnWidth(1, 100);  // Record ID
  sheet.setColumnWidth(2, 180);  // Account Name
  sheet.setColumnWidth(3, 100);  // Member ID
  sheet.setColumnWidth(4, 150);  // Member Name
  sheet.setColumnWidth(5, 150);  // Bank Name
  sheet.setColumnWidth(6, 150);  // Account Number
  sheet.setColumnWidth(7, 120);  // IFSC Code
  sheet.setColumnWidth(8, 150);  // Branch Name
  sheet.setColumnWidth(9, 120);  // Account Type
  sheet.setColumnWidth(10, 80);  // Status
  sheet.setColumnWidth(11, 130); // Created Date
  sheet.setColumnWidth(12, 130); // Last Updated

  applyStandardFormatting(sheet);

  // Set tab color (Green for account-related sheets)
  sheet.setTabColor('#10b981');

  log('BankAccounts sheet created');
  return sheet;
}

/**
 * Setup InvestmentAccounts Sheet
 * Structure: 15 columns (A-O)
 * For Demat, Mutual Fund Platforms, Trading Accounts, Direct AMC, Broker Accounts
 */
function setupInvestmentAccountsSheet() {
  const spreadsheet = getSpreadsheet();
  const sheet = spreadsheet.insertSheet(CONFIG.investmentAccountsSheet);

  addDeveloperCredit(sheet, 15);

  sheet.appendRow([
    'Record ID',          // A: IA-001, IA-002...
    'Account Name',       // B: User-defined name
    'Member ID',          // C: From Family Members
    'Member Name',        // D: Auto-filled
    'Bank Account ID',    // E: From Bank Accounts (for transfers)
    'Bank Account Name',  // F: Auto-filled from Bank Account ID
    'Account Type',       // G: Demat/MF Platform/Trading/Direct AMC/Broker
    'Platform/Broker',    // H: Zerodha, Groww, etc.
    'Account/Client ID',  // I: Account number
    'Demat DP ID',        // J: 16-digit DP ID (optional)
    'Registered Email',   // K: Email for this account
    'Registered Phone',   // L: Phone for this account
    'Status',             // M: Active/Inactive
    'Created Date',       // N: Timestamp
    'Last Updated'        // O: Timestamp
  ]);

  formatHeaderRow(sheet, sheet.getRange('A2:O2'), 40);

  sheet.setColumnWidth(1, 110);   // Record ID
  sheet.setColumnWidth(2, 180);   // Account Name
  sheet.setColumnWidth(3, 100);   // Member ID
  sheet.setColumnWidth(4, 150);   // Member Name
  sheet.setColumnWidth(5, 120);   // Bank Account ID
  sheet.setColumnWidth(6, 180);   // Bank Account Name
  sheet.setColumnWidth(7, 160);   // Account Type
  sheet.setColumnWidth(8, 160);   // Platform/Broker
  sheet.setColumnWidth(9, 140);   // Account/Client ID
  sheet.setColumnWidth(10, 160);  // Demat DP ID
  sheet.setColumnWidth(11, 200);  // Registered Email
  sheet.setColumnWidth(12, 130);  // Registered Phone
  sheet.setColumnWidth(13, 80);   // Status
  sheet.setColumnWidth(14, 150);  // Created Date
  sheet.setColumnWidth(15, 150);  // Last Updated

  applyStandardFormatting(sheet);

  // Set tab color (Teal for investment-related sheets)
  sheet.setTabColor('#14b8a6');

  log('InvestmentAccounts sheet created');
  return sheet;
}

/**
 * Setup OtherInvestments Sheet
 * Structure: 13 columns (A-M) for Gold, Real Estate, PPF, EPF, NPS, FD, Crypto, etc.
 */
function setupOtherInvestmentsSheet() {
  const spreadsheet = getSpreadsheet();
  const sheet = spreadsheet.insertSheet(CONFIG.otherInvestmentsSheet);

  addDeveloperCredit(sheet, 14);

  sheet.appendRow([
    'Investment ID',         // A
    'Investment Type',       // B: Gold, Real Estate, PPF, etc.
    'Investment Category',   // C: Equity/Debt/Gold/Real Estate/Alternative/Other
    'Investment Name',       // D: User description
    'Family Member ID',      // E: Member ID (FM-001, FM-002, etc.) - for system use
    'Family Member Name',    // F: Member Name (for display/readability)
    'Investment Account',    // G: Investment account (optional - for demat/bank accounts)
    'Invested Amount (₹)',   // H: Optional
    'Current Value (₹)',     // I: Mandatory
    'Linked Liability ID',   // J: For loans linked to this investment
    'Dynamic Fields',        // K: JSON for custom fields
    'Notes',                 // L: Optional notes
    'Last Updated',          // M: Timestamp
    'Status'                 // N: Active/Sold/Matured
  ]);

  formatHeaderRow(sheet, sheet.getRange('A2:N2'), 40);

  // Set column widths
  sheet.setColumnWidth(1, 120);  // Investment ID
  sheet.setColumnWidth(2, 140);  // Investment Type
  sheet.setColumnWidth(3, 140);  // Investment Category
  sheet.setColumnWidth(4, 220);  // Investment Name
  sheet.setColumnWidth(5, 120);  // Family Member ID
  sheet.setColumnWidth(6, 150);  // Family Member Name
  sheet.setColumnWidth(7, 180);  // Investment Account
  sheet.setColumnWidth(8, 140);  // Invested Amount
  sheet.setColumnWidth(9, 140);  // Current Value
  sheet.setColumnWidth(10, 130); // Linked Liability ID
  sheet.setColumnWidth(11, 300); // Dynamic Fields
  sheet.setColumnWidth(12, 200); // Notes
  sheet.setColumnWidth(13, 150); // Last Updated
  sheet.setColumnWidth(14, 100); // Status

  applyStandardFormatting(sheet);

  // Set tab color (Orange for other investments)
  sheet.setTabColor('#f97316');

  log('OtherInvestments sheet created');
  return sheet;
}

/**
 * Setup Insurance Sheet
 * Track insurance policies and sum assured for family awareness
 * Essential fields only - optional details in Dynamic Fields JSON
 */
function setupInsuranceSheet() {
  const spreadsheet = getSpreadsheet();
  const sheet = spreadsheet.insertSheet(CONFIG.insuranceSheet);

  addDeveloperCredit(sheet, 13);

  // Column headers (13 columns: A to M)
  // Policy Number is MANDATORY field
  // Member ID added for easy linking with FamilyMembers sheet
  sheet.appendRow([
    'Policy ID',           // A: POL-INS-001 (auto-generated)
    'Policy Type',         // B: Life, Health, Term, Motor, etc. (MANDATORY)
    'Insurance Company',   // C: HDFC Life, ICICI Lombard (MANDATORY)
    'Policy Number',       // D: Unique policy number (MANDATORY)
    'Policy Name',         // E: Short description (MANDATORY)
    'Insured Member',      // F: Member Name (MANDATORY)
    'Member ID',           // G: FM-001, FM-002, etc. (MANDATORY) - For linking
    'Sum Assured (₹)',     // H: Coverage amount (MANDATORY)
    'Nominee',             // I: Beneficiary (Optional but important)
    'Policy Status',       // J: Active, Expired, Surrendered, Lapsed
    'Dynamic Fields',      // K: JSON for Premium, Start/Maturity Dates, Agent Name/Contact
    'Last Updated',        // L: Timestamp
    'Notes'                // M: Additional information
  ]);

  formatHeaderRow(sheet, sheet.getRange('A2:M2'), 40);
  applyStandardFormatting(sheet);

  // Set column widths for better readability
  sheet.setColumnWidth(1, 120);  // A: Policy ID
  sheet.setColumnWidth(2, 150);  // B: Policy Type
  sheet.setColumnWidth(3, 180);  // C: Insurance Company
  sheet.setColumnWidth(4, 180);  // D: Policy Number
  sheet.setColumnWidth(5, 220);  // E: Policy Name
  sheet.setColumnWidth(6, 150);  // F: Insured Member (Name)
  sheet.setColumnWidth(7, 100);  // G: Member ID
  sheet.setColumnWidth(8, 140);  // H: Sum Assured
  sheet.setColumnWidth(9, 150);  // I: Nominee
  sheet.setColumnWidth(10, 110); // J: Policy Status
  sheet.setColumnWidth(11, 300); // K: Dynamic Fields
  sheet.setColumnWidth(12, 150); // L: Last Updated
  sheet.setColumnWidth(13, 200); // M: Notes

  // Freeze header rows (Row 1: Developer credit, Row 2: Headers)
  sheet.setFrozenRows(2);

  // Set tab color (Blue for insurance)
  sheet.setTabColor('#3b82f6');

  log('Insurance sheet created with 12 columns (Policy Number now mandatory)');
  return sheet;
}

/**
 * Setup Loans Sheet (Placeholder)
 */
/**
 * ✅ DEPRECATED: setupLoansSheet()
 * This function is no longer used - Loans have been unified into Liabilities sheet
 * Kept for backward compatibility only
 */
/*
function setupLoansSheet() {
  const spreadsheet = getSpreadsheet();
  const sheet = spreadsheet.insertSheet(CONFIG.loansSheet);

  addDeveloperCredit(sheet, 8);

  sheet.appendRow([
    'Loan ID',
    'Loan Name',
    'Member ID',
    'Type',
    'Amount',
    'Interest Rate',
    'Status',
    'Dynamic Fields'
  ]);

  formatHeaderRow(sheet, sheet.getRange('A2:H2'), 40);
  applyStandardFormatting(sheet);

  // Set tab color (Red for loans/debt)
  sheet.setTabColor('#ef4444');

  log('Loans sheet created');
  return sheet;
}
*/

/**
 * Setup Assets Sheet
 * Structure: Asset ID, Asset Type, Asset Name, Purchase Date, Purchase Value, Current Value,
 * Quantity/Units, Location/Details, Notes, Last Updated, Status
 */
function setupAssetsSheet() {
  const spreadsheet = getSpreadsheet();
  const sheet = spreadsheet.insertSheet(CONFIG.assetsSheet);

  // Row 1: Developer Credit (watermark)
  addDeveloperCredit(sheet, 11);

  // Row 2: Column headers
  sheet.appendRow([
    'Asset ID',
    'Asset Type',
    'Asset Name',
    'Purchase Date',
    'Purchase Value (₹)',
    'Current Value (₹)',
    'Quantity/Units',
    'Location/Details',
    'Notes',
    'Last Updated',
    'Status'
  ]);

  // Format header row
  formatHeaderRow(sheet, sheet.getRange('A2:K2'), 40);

  // Set column widths
  sheet.setColumnWidth(1, 120);  // Asset ID
  sheet.setColumnWidth(2, 150);  // Asset Type
  sheet.setColumnWidth(3, 200);  // Asset Name
  sheet.setColumnWidth(4, 120);  // Purchase Date
  sheet.setColumnWidth(5, 140);  // Purchase Value
  sheet.setColumnWidth(6, 140);  // Current Value
  sheet.setColumnWidth(7, 120);  // Quantity
  sheet.setColumnWidth(8, 180);  // Location
  sheet.setColumnWidth(9, 200);  // Notes
  sheet.setColumnWidth(10, 150); // Last Updated
  sheet.setColumnWidth(11, 100); // Status

  // Apply standard formatting
  applyStandardFormatting(sheet);

  // Set tab color (Purple for assets)
  sheet.setTabColor('#9333ea');

  log('Assets sheet created');
  return sheet;
}

/**
 * Setup AssetTypes Sheet (Reference sheet for dynamic asset types)
 * Structure: Type ID, Type Name, Category, Icon, Fields Required (JSON), Status
 */
function setupAssetTypesSheet() {
  const spreadsheet = getSpreadsheet();
  const sheet = spreadsheet.insertSheet(CONFIG.assetTypesSheet);

  // Row 1: Developer Credit (watermark)
  addDeveloperCredit(sheet, 6);

  // Row 2: Column headers
  sheet.appendRow([
    'Type ID',
    'Type Name',
    'Category',
    'Icon',
    'Fields Required',
    'Status'
  ]);

  // Format header row
  formatHeaderRow(sheet, sheet.getRange('A2:F2'), 40);

  // Add default asset types
  const defaultTypes = [
    ['AT-1', 'Stocks', 'Financial', '📈', '{}', 'Active'],
    ['AT-2', 'Bonds', 'Financial', '📜', '{}', 'Active'],
    ['AT-3', 'Gold', 'Financial', '🥇', '{}', 'Active'],
    ['AT-4', 'Fixed Deposits', 'Financial', '🏦', '{}', 'Active'],
    ['AT-5', 'PPF', 'Financial', '💰', '{}', 'Active'],
    ['AT-6', 'NPS', 'Financial', '🏛️', '{}', 'Active'],
    ['AT-7', 'EPF', 'Financial', '🏢', '{}', 'Active'],
    ['AT-8', 'Crypto', 'Financial', '₿', '{}', 'Active'],
    ['AT-9', 'Real Estate', 'Physical', '🏠', '{}', 'Active'],
    ['AT-10', 'Vehicle', 'Physical', '🚗', '{}', 'Active'],
    ['AT-11', 'Jewelry', 'Physical', '💎', '{}', 'Active'],
    ['AT-12', 'Art & Collectibles', 'Physical', '🎨', '{}', 'Active'],
    ['AT-13', 'Business', 'Other', '🏪', '{}', 'Active'],
    ['AT-14', 'Custom', 'Other', '📦', '{}', 'Active']
  ];

  // Add default types starting from row 3
  sheet.getRange(3, 1, defaultTypes.length, 6).setValues(defaultTypes);

  // Set column widths
  sheet.setColumnWidth(1, 100);  // Type ID
  sheet.setColumnWidth(2, 180);  // Type Name
  sheet.setColumnWidth(3, 120);  // Category
  sheet.setColumnWidth(4, 80);   // Icon
  sheet.setColumnWidth(5, 150);  // Fields Required
  sheet.setColumnWidth(6, 100);  // Status

  // Apply standard formatting
  applyStandardFormatting(sheet);

  // Format data rows
  const lastRow = sheet.getLastRow();
  if (lastRow > 2) {
    const dataRange = sheet.getRange(3, 1, lastRow - 2, 6);
    dataRange.setBorder(true, true, true, true, true, true, '#cbd5e1', SpreadsheetApp.BorderStyle.SOLID);

    // Center align Type ID, Category, Icon, Status
    sheet.getRange(3, 1, lastRow - 2, 1).setHorizontalAlignment('center'); // Type ID
    sheet.getRange(3, 3, lastRow - 2, 1).setHorizontalAlignment('center'); // Category
    sheet.getRange(3, 4, lastRow - 2, 1).setHorizontalAlignment('center'); // Icon
    sheet.getRange(3, 6, lastRow - 2, 1).setHorizontalAlignment('center'); // Status
  }

  // Set tab color (Light Purple for reference)
  sheet.setTabColor('#c084fc');

  log('AssetTypes sheet created with default types');
  return sheet;
}

/**
 * Setup InvestmentTypes Sheet (Reference sheet for dynamic investment types)
 * Structure: Type ID, Type Name, Default Category, Icon, Suggested Fields, Status
 */
function setupInvestmentTypesSheet() {
  const spreadsheet = getSpreadsheet();
  const sheet = spreadsheet.insertSheet(CONFIG.investmentTypesSheet);

  // Row 1: Developer Credit (watermark)
  addDeveloperCredit(sheet, 6);

  // Row 2: Column headers
  sheet.appendRow([
    'Type ID',
    'Type Name',
    'Default Category',
    'Icon',
    'Suggested Fields',
    'Status'
  ]);

  // Format header row
  formatHeaderRow(sheet, sheet.getRange('A2:F2'), 40);

  // Add default investment types
  const defaultTypes = [
    ['IT-1', 'Stocks (Equity - Direct)', 'Equity', '📈', 'Stock Symbol, Quantity, Avg Buy Price, Broker', 'Active'],
    ['IT-2', 'Gold', 'Gold', '🥇', 'Quantity (grams), Purity, Locker Number', 'Active'],
    ['IT-3', 'Real Estate', 'Real Estate', '🏠', 'Property Type, Area (sq ft), Location', 'Active'],
    ['IT-4', 'PPF', 'Debt', '💰', 'Account Number, Bank, Maturity Date, Interest Rate', 'Active'],
    ['IT-5', 'EPF', 'Debt', '🏢', 'UAN Number, Employer Name', 'Active'],
    ['IT-6', 'NPS', 'Equity', '🏛️', 'PRAN Number, Equity Allocation %', 'Active'],
    ['IT-7', 'Fixed Deposit', 'Debt', '🏦', 'FD Number, Bank, Maturity Date, Interest Rate', 'Active'],
    ['IT-8', 'Bonds', 'Debt', '📜', 'Bond Type, Issuer, Maturity Date', 'Active'],
    ['IT-9', 'Crypto', 'Alternative', '₿', 'Wallet Address, Exchange', 'Active'],
    ['IT-10', 'Custom', 'Other', '📦', '', 'Active']
  ];

  // Add default types starting from row 3
  sheet.getRange(3, 1, defaultTypes.length, 6).setValues(defaultTypes);

  // Set column widths
  sheet.setColumnWidth(1, 100);  // Type ID
  sheet.setColumnWidth(2, 150);  // Type Name
  sheet.setColumnWidth(3, 120);  // Default Category
  sheet.setColumnWidth(4, 80);   // Icon
  sheet.setColumnWidth(5, 250);  // Suggested Fields
  sheet.setColumnWidth(6, 100);  // Status

  // Apply standard formatting
  applyStandardFormatting(sheet);

  // Format data rows
  const lastRow = sheet.getLastRow();
  if (lastRow > 2) {
    const dataRange = sheet.getRange(3, 1, lastRow - 2, 6);
    dataRange.setBorder(true, true, true, true, true, true, '#cbd5e1', SpreadsheetApp.BorderStyle.SOLID);

    // Center align Type ID, Default Category, Icon, Status
    sheet.getRange(3, 1, lastRow - 2, 1).setHorizontalAlignment('center'); // Type ID
    sheet.getRange(3, 3, lastRow - 2, 1).setHorizontalAlignment('center'); // Default Category
    sheet.getRange(3, 4, lastRow - 2, 1).setHorizontalAlignment('center'); // Icon
    sheet.getRange(3, 6, lastRow - 2, 1).setHorizontalAlignment('center'); // Status
  }

  // Set tab color (Light Purple for reference)
  sheet.setTabColor('#c084fc');

  log('InvestmentTypes sheet created with default types');
  return sheet;
}

/**
 * Setup Liabilities Sheet
 * Simplified structure with dynamic fields (similar to OtherInvestments)
 * Structure: 11 columns (A-K)
 */
function setupLiabilitiesSheet() {
  const spreadsheet = getSpreadsheet();
  const sheet = spreadsheet.insertSheet(CONFIG.liabilitiesSheet);

  // Row 1: Developer Credit (watermark)
  addDeveloperCredit(sheet, 11);

  // Row 2: Column headers
  sheet.appendRow([
    'Liability ID',            // A
    'Liability Type',          // B: Home Loan, Personal Loan, etc.
    'Lender/Bank Name',        // C: MANDATORY
    'Family Member ID',        // D: Member ID (FM-001, FM-002, etc.) - for system use
    'Family Member Name',      // E: Member Name (for display/readability)
    'Outstanding Balance (₹)', // F: MANDATORY
    'Dynamic Fields',          // G: JSON for optional fields (Loan Amount, Interest Rate, EMI, etc.)
    'Notes',                   // H: Optional notes
    'Last Updated',            // I: Timestamp
    'Status',                  // J: Active/Closed/Settled
    'Linked Investment ID'     // K: For bidirectional linking with investments
  ]);

  // Format header row
  formatHeaderRow(sheet, sheet.getRange('A2:K2'), 40);

  // Set column widths
  sheet.setColumnWidth(1, 120);  // Liability ID
  sheet.setColumnWidth(2, 150);  // Liability Type
  sheet.setColumnWidth(3, 180);  // Lender/Bank Name
  sheet.setColumnWidth(4, 120);  // Family Member ID
  sheet.setColumnWidth(5, 150);  // Family Member Name
  sheet.setColumnWidth(6, 150);  // Outstanding Balance
  sheet.setColumnWidth(7, 300);  // Dynamic Fields
  sheet.setColumnWidth(8, 200);  // Notes
  sheet.setColumnWidth(9, 150);  // Last Updated
  sheet.setColumnWidth(10, 100); // Status
  sheet.setColumnWidth(11, 150); // Linked Investment ID

  // Apply standard formatting
  applyStandardFormatting(sheet);

  // Set tab color (Red for liabilities)
  sheet.setTabColor('#ef4444');

  log('Liabilities sheet created');
  return sheet;
}

/**
 * Setup LiabilityTypes Sheet (Reference sheet for dynamic liability types)
 * Structure: Type ID, Type Name, Category, Icon, Status
 */
function setupLiabilityTypesSheet() {
  const spreadsheet = getSpreadsheet();
  const sheet = spreadsheet.insertSheet(CONFIG.liabilityTypesSheet);

  // Row 1: Developer Credit (watermark)
  addDeveloperCredit(sheet, 5);

  // Row 2: Column headers
  sheet.appendRow([
    'Type ID',
    'Type Name',
    'Category',
    'Icon',
    'Status'
  ]);

  // Format header row
  formatHeaderRow(sheet, sheet.getRange('A2:E2'), 40);

  // Add default liability types
  const defaultTypes = [
    ['LT-1', 'Home Loan', 'Secured', '🏠', 'Active'],
    ['LT-2', 'Auto Loan', 'Secured', '🚗', 'Active'],
    ['LT-3', 'Personal Loan', 'Unsecured', '💰', 'Active'],
    ['LT-4', 'Education Loan', 'Secured', '🎓', 'Active'],
    ['LT-5', 'Credit Card', 'Unsecured', '💳', 'Active'],
    ['LT-6', 'Business Loan', 'Secured', '🏪', 'Active'],
    ['LT-7', 'Gold Loan', 'Secured', '🥇', 'Active'],
    ['LT-8', 'Overdraft', 'Unsecured', '🏦', 'Active'],
    ['LT-9', 'Custom', 'Other', '📝', 'Active']
  ];

  // Add default types starting from row 3
  sheet.getRange(3, 1, defaultTypes.length, 5).setValues(defaultTypes);

  // Set column widths
  sheet.setColumnWidth(1, 100);  // Type ID
  sheet.setColumnWidth(2, 180);  // Type Name
  sheet.setColumnWidth(3, 120);  // Category
  sheet.setColumnWidth(4, 80);   // Icon
  sheet.setColumnWidth(5, 100);  // Status

  // Apply standard formatting
  applyStandardFormatting(sheet);

  // Format data rows
  const lastRow = sheet.getLastRow();
  if (lastRow > 2) {
    const dataRange = sheet.getRange(3, 1, lastRow - 2, 5);
    dataRange.setBorder(true, true, true, true, true, true, '#cbd5e1', SpreadsheetApp.BorderStyle.SOLID);

    // Center align Type ID, Category, Icon, Status
    sheet.getRange(3, 1, lastRow - 2, 1).setHorizontalAlignment('center'); // Type ID
    sheet.getRange(3, 3, lastRow - 2, 1).setHorizontalAlignment('center'); // Category
    sheet.getRange(3, 4, lastRow - 2, 1).setHorizontalAlignment('center'); // Icon
    sheet.getRange(3, 5, lastRow - 2, 1).setHorizontalAlignment('center'); // Status
  }

  // Set tab color (Light Red for reference)
  sheet.setTabColor('#fca5a5');

  log('LiabilityTypes sheet created with default types');
  return sheet;
}

/**
 * Setup Portfolio Metadata Sheet (Placeholder)
 */
/**
 * Setup AllPortfolios Sheet (formerly PortfolioMetadata)
 * Structure: Portfolio ID, Portfolio Name, Investment Account, Initial Investment, Total Investment (formula),
 * SIP Target, Lumpsum Target, Rebalance Threshold, Current Value (formula),
 * Unrealized P&L ₹ (formula), Unrealized P&L % (formula),
 * Realized P&L ₹ (formula), Realized P&L % (formula),
 * Total P&L ₹ (formula), Total P&L % (formula), Status
 */
function setupPortfolioMetadataSheet() {
  const spreadsheet = getSpreadsheet();
  const sheet = spreadsheet.insertSheet(CONFIG.portfolioMetadataSheet);

  addDeveloperCredit(sheet, 16);  // 16 columns with grouped P&L headers

  // Row 2: Merged group headers for P&L columns (similar to portfolio sheet structure)
  const groupHeaders = [
    '', '', '', '', '', '', '', '', '',  // A-I: No group headers
    'Unrealized P&L', '',                // J-K: Unrealized P&L (2 columns)
    'Realized P&L', '',                  // L-M: Realized P&L (2 columns)
    'Total P&L', '',                     // N-O: Total P&L (2 columns)
    ''                                   // P: Status (no group header)
  ];
  sheet.appendRow(groupHeaders);

  // Merge group headers in Row 2
  sheet.getRange(2, 10, 1, 2).merge();  // Unrealized P&L (J-K)
  sheet.getRange(2, 12, 1, 2).merge();  // Realized P&L (L-M)
  sheet.getRange(2, 14, 1, 2).merge();  // Total P&L (N-O)

  // Format group headers with colors (matching portfolio detail sheet style)
  sheet.getRange(2, 10, 1, 2).setBackground("#3b82f6").setFontColor("#ffffff").setFontWeight("bold").setHorizontalAlignment("center").setFontSize(10);  // Unrealized - Blue
  sheet.getRange(2, 12, 1, 2).setBackground("#34d399").setFontColor("#ffffff").setFontWeight("bold").setHorizontalAlignment("center").setFontSize(10);  // Realized - Light Green
  sheet.getRange(2, 14, 1, 2).setBackground("#f59e0b").setFontColor("#ffffff").setFontWeight("bold").setHorizontalAlignment("center").setFontSize(10);  // Total - Orange

  // Row 2 uses default height (no setRowHeight needed, same as portfolio detail sheets)

  // Row 3: Column headers (16 columns)
  sheet.appendRow([
    'Portfolio ID',
    'Portfolio Name',
    'Investment Account',
    'Original Investment (₹)',
    'Total Investment (₹)',
    'SIP Target (₹)',
    'Lumpsum Target (₹)',
    'Rebalance Threshold (%)',
    'Current Value (₹)',
    'Amount (₹)',             // Column J - Unrealized P&L Amount
    'Percent (%)',            // Column K - Unrealized P&L Percent
    'Amount (₹)',             // Column L - Realized P&L Amount
    'Percent (%)',            // Column M - Realized P&L Percent
    'Amount (₹)',             // Column N - Total P&L Amount
    'Percent (%)',            // Column O - Total P&L Percent
    'Status'                  // Column P
  ]);

  formatHeaderRow(sheet, sheet.getRange('A3:P3'), 40);

  // Set row height for Row 3 (column headers)
  sheet.setRowHeight(3, 30);

  // NOTE: Background colors for data rows will be applied when portfolios are added (see processAddPortfolio)
  // We don't pre-apply colors to empty data rows to keep the sheet clean

  // Format currency columns
  sheet.getRange('D:D').setNumberFormat('#,##0.00');  // Original Investment
  sheet.getRange('E:E').setNumberFormat('#,##0.00');  // Total Investment
  sheet.getRange('F:F').setNumberFormat('#,##0.00');  // SIP Target
  sheet.getRange('G:G').setNumberFormat('#,##0.00');  // Lumpsum Target
  sheet.getRange('H:H').setNumberFormat('0.00%');     // Rebalance Threshold
  sheet.getRange('I:I').setNumberFormat('#,##0.00');  // Current Value
  sheet.getRange('J:J').setNumberFormat('#,##0.00');  // Unrealized P&L ₹
  sheet.getRange('K:K').setNumberFormat('0.00%');     // Unrealized P&L %
  sheet.getRange('L:L').setNumberFormat('#,##0.00');  // Realized P&L ₹
  sheet.getRange('M:M').setNumberFormat('0.00%');     // Realized P&L %
  sheet.getRange('N:N').setNumberFormat('#,##0.00');  // Total P&L ₹
  sheet.getRange('O:O').setNumberFormat('0.00%');     // Total P&L %

  applyStandardFormatting(sheet);

  // Set tab color (Indigo for portfolio)
  sheet.setTabColor('#6366f1');

  log('AllPortfolios sheet created');
  return sheet;
}

/**
 * Setup Asset Allocations Sheet
 * Stores fund-level asset allocation and market cap data as JSON
 */
function setupAssetAllocationsSheet() {
  const spreadsheet = getSpreadsheet();
  const sheet = spreadsheet.insertSheet(CONFIG.assetAllocationsSheet);

  // Add developer credit (Row 1)
  addDeveloperCredit(sheet, 4);

  // Add headers (Row 2)
  sheet.appendRow([
    'Fund Code',
    'Fund Name',
    'Asset Allocation JSON',
    'Equity Allocation JSON'
  ]);

  formatHeaderRow(sheet, sheet.getRange('A2:D2'), 40);

  // Set column widths
  sheet.setColumnWidth(1, 120);  // Fund Code
  sheet.setColumnWidth(2, 300);  // Fund Name
  sheet.setColumnWidth(3, 400);  // Asset Allocation JSON
  sheet.setColumnWidth(4, 400);  // Equity Allocation JSON

  // Apply standard formatting
  applyStandardFormatting(sheet);

  // Set tab color (Purple for asset allocations)
  sheet.setTabColor('#a78bfa');

  log('AssetAllocations sheet created successfully');
  return sheet;
}

/**
 * Setup Mutual Fund Data Sheet (Placeholder)
 */
function setupMutualFundDataSheet() {
  const spreadsheet = getSpreadsheet();
  const sheet = spreadsheet.insertSheet(CONFIG.mutualFundDataSheet);

  // Import data from Master MF Database via IMPORTRANGE
  const masterDbId = '1pSvGDFTgcCkW6Fk9P2mZ5FSpROVClz7Vu0sW9JnPz9s';
  const importFormula = `=IMPORTRANGE("${masterDbId}", "MF_Data!A:H")`;

  sheet.getRange('A1').setFormula(importFormula);

  // Add note about IMPORTRANGE
  sheet.getRange('J1').setValue('📊 MF Data imported from Master Database');
  sheet.getRange('J2').setValue('Auto-updates daily from central source');
  sheet.getRange('J3').setValue('Do NOT edit this sheet manually!');
  sheet.getRange('J1:J3').setFontWeight('bold').setBackground('#fff3cd');

  // Set tab color (Yellow for mutual fund data)
  sheet.setTabColor('#eab308');

  log('MutualFundData sheet created with IMPORTRANGE formula');

  // Show alert to user about granting permission
  SpreadsheetApp.getUi().alert(
    '📊 MF Database Setup',
    'Click "Allow access" when prompted to connect to the master mutual fund database.\n\n' +
    'This is a one-time setup. Data will auto-update daily from the central database.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );

  return sheet;
}

/**
 * Setup Transaction History Sheet (Placeholder)
 */
function setupTransactionHistorySheet() {
  const spreadsheet = getSpreadsheet();
  const sheet = spreadsheet.insertSheet(CONFIG.transactionHistorySheet);

  addDeveloperCredit(sheet, 13);  // 13 columns total (added Gain/Loss)

  // TransactionHistory Structure (13 columns)
  // Column M: Gain/Loss ₹ - Realized P&L for SELL transactions
  sheet.appendRow([
    'Date',
    'Portfolio ID',
    'Portfolio',
    'Fund Code',
    'Fund',
    'Type',
    'Transaction Type',
    'Units',
    'Price',
    'Total Amount',
    'Notes',
    'Timestamp',
    'Gain/Loss (₹)'
  ]);

  formatHeaderRow(sheet, sheet.getRange('A2:M2'), 40);
  applyStandardFormatting(sheet);

  // Set tab color (Pink for transactions)
  sheet.setTabColor('#ec4899');

  log('TransactionHistory sheet created');
  return sheet;
}

/**
 * Setup Settings Sheet (Placeholder)
 */
function setupSettingsSheet() {
  const spreadsheet = getSpreadsheet();
  const sheet = spreadsheet.insertSheet(CONFIG.settingsSheet);

  addDeveloperCredit(sheet, 3);

  sheet.appendRow([
    'Setting',
    'Value',
    'Description'
  ]);

  formatHeaderRow(sheet, sheet.getRange('A2:C2'), 40);
  applyStandardFormatting(sheet);

  // Add default settings
  sheet.appendRow(['Email', '', 'Email address for reports']);
  sheet.appendRow(['Currency', '₹', 'Default currency symbol']);
  sheet.appendRow(['DateFormat', 'dd/MM/yyyy', 'Date format for display']);
  sheet.appendRow(['EmailConfigured', 'TRUE', 'Whether user has configured email settings (TRUE/FALSE)']);
  sheet.appendRow(['EmailFrequency', 'Daily', 'Email report frequency (Daily/Weekly/Monthly)']);
  sheet.appendRow(['EmailHour', '9', 'Hour for email reports (0-23)']);
  sheet.appendRow(['EmailMinute', '0', 'Minute for email reports (0/15/30/45)']);
  sheet.appendRow(['EmailDayOfWeek', '0', 'Day of week for weekly reports (0=Sunday, 6=Saturday)']);
  sheet.appendRow(['EmailDayOfMonth', '1', 'Day of month for monthly reports (1-28)']);

  // Set column widths
  sheet.setColumnWidth(1, 180);  // Setting
  sheet.setColumnWidth(2, 180);  // Value
  sheet.setColumnWidth(3, 350);  // Description

  // Set tab color (Gray for settings)
  sheet.setTabColor('#6b7280');

  log('Settings sheet created');
  return sheet;
}

/**
 * Apply formatting to all existing data rows in all sheets
 * This adds borders to data rows (no background colors to preserve P&L indicators)
 * Call this manually from Apps Script editor: formatAllDataRows()
 */
function formatAllDataRows() {
  const spreadsheet = getSpreadsheet();
  const results = {
    formatted: [],
    skipped: [],
    errors: []
  };

  const sheetsToFormat = [
    { name: CONFIG.familyMembersSheet, cols: 12 },
    { name: CONFIG.bankAccountsSheet, cols: 12 },
    { name: CONFIG.investmentAccountsSheet, cols: 15 },
    { name: CONFIG.otherInvestmentsSheet, cols: 14 },  // ✅ Updated: 14 columns (added Family Member Name)
    { name: CONFIG.liabilitiesSheet, cols: 11 },       // ✅ Updated: 11 columns (added Family Member Name)
    { name: CONFIG.insuranceSheet, cols: 11 },
    // ✅ REMOVED: CONFIG.loansSheet - unified into Liabilities
    { name: CONFIG.portfolioMetadataSheet, cols: 16 },
    { name: CONFIG.assetAllocationsSheet, cols: 4 },
    { name: CONFIG.mutualFundDataSheet, cols: 8 },
    { name: CONFIG.transactionHistorySheet, cols: 13 },
    // Stock sheets
    { name: CONFIG.stockPortfoliosSheet, cols: 14 },
    { name: CONFIG.stockTransactionsSheet, cols: 16 },
    { name: CONFIG.stockHoldingsSheet, cols: 15 },
    { name: CONFIG.settingsSheet, cols: 3 }
  ];

  sheetsToFormat.forEach(item => {
    try {
      const sheet = spreadsheet.getSheetByName(item.name);
      if (!sheet) {
        results.skipped.push(item.name + ' (sheet not found)');
        return;
      }

      const lastRow = sheet.getLastRow();
      if (lastRow <= 2) {
        results.skipped.push(item.name + ' (no data rows)');
        return;
      }

      // Format data rows (from row 3 onwards)
      applyDataRowFormatting(sheet, 3, lastRow, item.cols);
      results.formatted.push(item.name + ` (${lastRow - 2} rows)`);

    } catch (error) {
      results.errors.push(item.name + ': ' + error.message);
      log('Error formatting ' + item.name + ': ' + error.message);
    }
  });

  // Show summary
  let message = '';
  if (results.formatted.length > 0) {
    message += '✅ Formatted:\n' + results.formatted.join('\n') + '\n\n';
  }
  if (results.skipped.length > 0) {
    message += '⏭️ Skipped:\n' + results.skipped.join('\n') + '\n\n';
  }
  if (results.errors.length > 0) {
    message += '❌ Errors:\n' + results.errors.join('\n');
  }

  SpreadsheetApp.getUi().alert('Data Row Formatting Complete', message, SpreadsheetApp.getUi().ButtonSet.OK);

  return results;
}

/**
 * Setup StockMasterData Sheet
 * Uses IMPORTRANGE to import from Master Database (same as MutualFundData)
 */
function setupStockMasterDataSheet() {
  const spreadsheet = getSpreadsheet();
  const sheet = spreadsheet.insertSheet(CONFIG.stockMasterDataSheet);

  // Import data from Master Database via IMPORTRANGE
  const masterDbId = '1pSvGDFTgcCkW6Fk9P2mZ5FSpROVClz7Vu0sW9JnPz9s';
  const importFormula = `=IMPORTRANGE("${masterDbId}", "Stock_Data!A:J")`;

  sheet.getRange('A1').setFormula(importFormula);

  // Add note about IMPORTRANGE
  sheet.getRange('L1').setValue('📊 Stock Data imported from Master Database');
  sheet.getRange('L2').setValue('Auto-updates daily from central source');
  sheet.getRange('L3').setValue('~5,292 NSE stocks available for search');
  sheet.getRange('L4').setValue('Do NOT edit this sheet manually!');
  sheet.getRange('L1:L4').setFontWeight('bold').setBackground('#fff3cd');

  // Set tab color (Purple for stock master data)
  sheet.setTabColor('#9333ea');

  log('StockMasterData sheet created with IMPORTRANGE formula');

  // Show alert to user about granting permission
  SpreadsheetApp.getUi().alert(
    '📊 Stock Database Setup',
    'Click "Allow access" when prompted to connect to the master stock database.\n\n' +
    'This is a one-time setup. Stock data will auto-update daily from the central database.\n\n' +
    '~5,292 NSE stocks will be available for search and trading.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );

  return sheet;
}

/**
 * Setup StockPortfolios Sheet
 * Structure: 14 columns (A-N) - simpler than mutual fund portfolios
 */
function setupStockPortfoliosSheet() {
  const spreadsheet = getSpreadsheet();
  const sheet = spreadsheet.insertSheet(CONFIG.stockPortfoliosSheet);

  addDeveloperCredit(sheet, 14);

  sheet.appendRow([
    'Portfolio ID',           // A: PFL-STK-001
    'Portfolio Name',         // B: User-defined name
    'Investment Account',     // C: Ref to InvestmentAccounts
    'Owner',                  // D: Ref to FamilyMembers
    'Total Investment ₹',     // E: Formula (sum of BUY - SELL)
    'Current Value ₹',        // F: Formula (from StockHoldings)
    'Unrealized P&L ₹',       // G: Formula
    'Unrealized P&L %',       // H: Formula
    'Realized P&L ₹',         // I: Formula (sum of SELL gains)
    'Realized P&L %',         // J: Formula
    'Total P&L ₹',            // K: Formula (unrealized + realized)
    'Total P&L %',            // L: Formula
    'Status',                 // M: Active/Inactive
    'Created Date'            // N: Timestamp
  ]);

  formatHeaderRow(sheet, sheet.getRange('A2:N2'), 40);

  sheet.setColumnWidth(1, 120);  // Portfolio ID
  sheet.setColumnWidth(2, 200);  // Portfolio Name
  sheet.setColumnWidth(3, 180);  // Investment Account
  sheet.setColumnWidth(4, 150);  // Owner
  sheet.setColumnWidth(5, 130);  // Total Investment
  sheet.setColumnWidth(6, 130);  // Current Value
  sheet.setColumnWidth(7, 130);  // Unrealized P&L ₹
  sheet.setColumnWidth(8, 120);  // Unrealized P&L %
  sheet.setColumnWidth(9, 130);  // Realized P&L ₹
  sheet.setColumnWidth(10, 120); // Realized P&L %
  sheet.setColumnWidth(11, 130); // Total P&L ₹
  sheet.setColumnWidth(12, 120); // Total P&L %
  sheet.setColumnWidth(13, 90);  // Status
  sheet.setColumnWidth(14, 130); // Created Date

  // Format currency columns
  sheet.getRange('E:E').setNumberFormat('#,##0.00');  // Total Investment
  sheet.getRange('F:F').setNumberFormat('#,##0.00');  // Current Value
  sheet.getRange('G:G').setNumberFormat('#,##0.00');  // Unrealized P&L ₹
  sheet.getRange('H:H').setNumberFormat('0.00%');     // Unrealized P&L %
  sheet.getRange('I:I').setNumberFormat('#,##0.00');  // Realized P&L ₹
  sheet.getRange('J:J').setNumberFormat('0.00%');     // Realized P&L %
  sheet.getRange('K:K').setNumberFormat('#,##0.00');  // Total P&L ₹
  sheet.getRange('L:L').setNumberFormat('0.00%');     // Total P&L %

  applyStandardFormatting(sheet);

  // Set tab color (Green for stock portfolios)
  sheet.setTabColor('#10b981');

  log('StockPortfolios sheet created');
  return sheet;
}

/**
 * Setup StockTransactions Sheet
 * Structure: 16 columns (A-P) for all stock transactions
 */
function setupStockTransactionsSheet() {
  const spreadsheet = getSpreadsheet();
  const sheet = spreadsheet.insertSheet(CONFIG.stockTransactionsSheet);

  addDeveloperCredit(sheet, 16);

  sheet.appendRow([
    'Transaction ID',         // A: TXN-STK-001
    'Portfolio ID',           // B: Ref to StockPortfolios
    'Portfolio Name',         // C: For display
    'Stock Symbol',           // D: RELIANCE, TCS, INFY
    'Company Name',           // E: Full name
    'Exchange',               // F: NSE/BSE
    'Google Finance Symbol',  // G: NSE:RELIANCE or BOM:500325
    'Transaction Type',       // H: BUY, SELL, BONUS, SPLIT, DIVIDEND
    'Date',                   // I: Transaction date
    'Quantity',               // J: Number of shares
    'Price per Share ₹',      // K: Price
    'Total Amount ₹',         // L: Quantity × Price
    'Brokerage ₹',            // M: Charges
    'Net Amount ₹',           // N: Total + Brokerage
    'Notes',                  // O: Optional notes
    'Realized P&L ₹'          // P: For SELL only (FIFO calculation)
  ]);

  formatHeaderRow(sheet, sheet.getRange('A2:P2'), 40);

  sheet.setColumnWidth(1, 130);  // Transaction ID
  sheet.setColumnWidth(2, 120);  // Portfolio ID
  sheet.setColumnWidth(3, 180);  // Portfolio Name
  sheet.setColumnWidth(4, 110);  // Stock Symbol
  sheet.setColumnWidth(5, 220);  // Company Name
  sheet.setColumnWidth(6, 90);   // Exchange
  sheet.setColumnWidth(7, 160);  // Google Finance Symbol
  sheet.setColumnWidth(8, 130);  // Transaction Type
  sheet.setColumnWidth(9, 110);  // Date
  sheet.setColumnWidth(10, 100); // Quantity
  sheet.setColumnWidth(11, 120); // Price per Share
  sheet.setColumnWidth(12, 130); // Total Amount
  sheet.setColumnWidth(13, 110); // Brokerage
  sheet.setColumnWidth(14, 130); // Net Amount
  sheet.setColumnWidth(15, 200); // Notes
  sheet.setColumnWidth(16, 130); // Realized P&L

  // Format currency and number columns
  sheet.getRange('J:J').setNumberFormat('#,##0');      // Quantity
  sheet.getRange('K:K').setNumberFormat('#,##0.00');   // Price per Share
  sheet.getRange('L:L').setNumberFormat('#,##0.00');   // Total Amount
  sheet.getRange('M:M').setNumberFormat('#,##0.00');   // Brokerage
  sheet.getRange('N:N').setNumberFormat('#,##0.00');   // Net Amount
  sheet.getRange('P:P').setNumberFormat('#,##0.00');   // Realized P&L

  applyStandardFormatting(sheet);

  // Set tab color (Blue for transactions)
  sheet.setTabColor('#3b82f6');

  log('StockTransactions sheet created');
  return sheet;
}

/**
 * Setup StockHoldings Sheet
 * Structure: 15 columns (A-O) - calculated sheet with Google Finance formulas
 */
function setupStockHoldingsSheet() {
  const spreadsheet = getSpreadsheet();
  const sheet = spreadsheet.insertSheet(CONFIG.stockHoldingsSheet);

  addDeveloperCredit(sheet, 15);

  sheet.appendRow([
    'Portfolio ID',           // A
    'Portfolio Name',         // B
    'Stock Symbol',           // C: RELIANCE
    'Company Name',           // D
    'Exchange',               // E: NSE/BSE
    'Google Finance Symbol',  // F: NSE:RELIANCE (for formula)
    'Total Quantity',         // G: Calculated
    'Average Buy Price ₹',    // H: Calculated
    'Total Investment ₹',     // I: Calculated
    'Current Price ₹',        // J: =GOOGLEFINANCE(F4, "price") ⭐
    'Current Value ₹',        // K: =G4*J4
    'Unrealized P&L ₹',       // L: =K4-I4
    'Unrealized P&L %',       // M: =L4/I4
    'Sector',                 // N: From StockMasterData
    'Last Updated'            // O: Timestamp
  ]);

  formatHeaderRow(sheet, sheet.getRange('A2:O2'), 40);

  sheet.setColumnWidth(1, 120);  // Portfolio ID
  sheet.setColumnWidth(2, 180);  // Portfolio Name
  sheet.setColumnWidth(3, 110);  // Stock Symbol
  sheet.setColumnWidth(4, 220);  // Company Name
  sheet.setColumnWidth(5, 90);   // Exchange
  sheet.setColumnWidth(6, 160);  // Google Finance Symbol
  sheet.setColumnWidth(7, 110);  // Total Quantity
  sheet.setColumnWidth(8, 130);  // Average Buy Price
  sheet.setColumnWidth(9, 130);  // Total Investment
  sheet.setColumnWidth(10, 120); // Current Price
  sheet.setColumnWidth(11, 130); // Current Value
  sheet.setColumnWidth(12, 130); // Unrealized P&L ₹
  sheet.setColumnWidth(13, 120); // Unrealized P&L %
  sheet.setColumnWidth(14, 130); // Sector
  sheet.setColumnWidth(15, 150); // Last Updated

  // Format currency and number columns
  sheet.getRange('G:G').setNumberFormat('#,##0');      // Quantity
  sheet.getRange('H:H').setNumberFormat('#,##0.00');   // Avg Buy Price
  sheet.getRange('I:I').setNumberFormat('#,##0.00');   // Total Investment
  sheet.getRange('J:J').setNumberFormat('#,##0.00');   // Current Price
  sheet.getRange('K:K').setNumberFormat('#,##0.00');   // Current Value
  sheet.getRange('L:L').setNumberFormat('#,##0.00');   // Unrealized P&L ₹
  sheet.getRange('M:M').setNumberFormat('0.00%');      // Unrealized P&L %

  applyStandardFormatting(sheet);

  // Set tab color (Orange for holdings)
  sheet.setTabColor('#f97316');

  log('StockHoldings sheet created');
  return sheet;
}

/**
 * Setup CryptoMasterData Sheet
 * Uses IMPORTRANGE to import from Master Database (same as StockMasterData)
 */

/**
 * Setup Reminders Sheet
 * Structure: 16 columns (A-P) for managing reminders
 * This calls the setupRemindersSheet function from Reminders.gs
 */
function setupRemindersSheet() {
  const spreadsheet = getSpreadsheet();
  const sheet = spreadsheet.insertSheet('Reminders');

  // Set headers
  const headers = [
    'Reminder ID',
    'Type',
    'Family Member',
    'Title',
    'Description',
    'Due Date',
    'Advance Notice (Days)',
    'Frequency',
    'Recurrence End Date',
    'Priority',
    'Status',
    'Recipient Email',
    'Last Sent Date',
    'Next Send Date',
    'Created Date',
    'Is Active'
  ];

  // Add developer credit (Row 1)
  addDeveloperCredit(sheet, headers.length);

  // Add headers (Row 2)
  sheet.appendRow(headers);

  // Format header row
  formatHeaderRow(sheet, sheet.getRange(2, 1, 1, headers.length), 40);

  // Set column widths
  sheet.setColumnWidth(1, 120); // Reminder ID
  sheet.setColumnWidth(2, 150); // Type
  sheet.setColumnWidth(3, 130); // Family Member
  sheet.setColumnWidth(4, 250); // Title
  sheet.setColumnWidth(5, 200); // Description
  sheet.setColumnWidth(6, 110); // Due Date
  sheet.setColumnWidth(7, 150); // Advance Notice
  sheet.setColumnWidth(8, 110); // Frequency
  sheet.setColumnWidth(9, 150); // Recurrence End Date
  sheet.setColumnWidth(10, 90); // Priority
  sheet.setColumnWidth(11, 100); // Status
  sheet.setColumnWidth(12, 250); // Recipient Email (wider for multiple emails)
  sheet.setColumnWidth(13, 130); // Last Sent Date
  sheet.setColumnWidth(14, 130); // Next Send Date
  sheet.setColumnWidth(15, 130); // Created Date
  sheet.setColumnWidth(16, 80); // Is Active

  // Freeze header rows
  sheet.setFrozenRows(2);

  // Add data validation for Status column
  const statusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Pending', 'Sent', 'Completed', 'Cancelled'])
    .build();
  sheet.getRange(3, 11, 1000, 1).setDataValidation(statusRule);

  // Add data validation for Priority column
  const priorityRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Low', 'Medium', 'High'])
    .build();
  sheet.getRange(3, 10, 1000, 1).setDataValidation(priorityRule);

  // Add data validation for Is Active column
  const activeRule = SpreadsheetApp.newDataValidation()
    .requireCheckbox()
    .build();
  sheet.getRange(3, 16, 1000, 1).setDataValidation(activeRule);

  // Format date columns
  sheet.getRange('F:F').setNumberFormat('yyyy-mm-dd'); // Due Date
  sheet.getRange('I:I').setNumberFormat('yyyy-mm-dd'); // Recurrence End Date
  sheet.getRange('M:M').setNumberFormat('yyyy-mm-dd'); // Last Sent Date
  sheet.getRange('N:N').setNumberFormat('yyyy-mm-dd'); // Next Send Date
  sheet.getRange('O:O').setNumberFormat('yyyy-mm-dd hh:mm:ss'); // Created Date

  // Add conditional formatting for priority colors
  const priorityColumn = 10;
  const priorityRange = sheet.getRange(3, priorityColumn, 1000, 1);

  // High Priority - Red background
  const highRule = SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('High')
    .setBackground('#fee2e2')
    .setFontColor('#991b1b')
    .setRanges([priorityRange])
    .build();

  // Medium Priority - Yellow background
  const mediumRule = SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('Medium')
    .setBackground('#fef3c7')
    .setFontColor('#92400e')
    .setRanges([priorityRange])
    .build();

  // Low Priority - Green background
  const lowRule = SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('Low')
    .setBackground('#d1fae5')
    .setFontColor('#065f46')
    .setRanges([priorityRange])
    .build();

  // Add conditional formatting for status colors
  const statusColumn = 11;
  const statusRange = sheet.getRange(3, statusColumn, 1000, 1);

  // Pending - Blue
  const pendingRule = SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('Pending')
    .setBackground('#dbeafe')
    .setFontColor('#1e40af')
    .setRanges([statusRange])
    .build();

  // Sent - Green
  const sentRule = SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('Sent')
    .setBackground('#d1fae5')
    .setFontColor('#065f46')
    .setRanges([statusRange])
    .build();

  // Completed - Gray
  const completedRule = SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('Completed')
    .setBackground('#f3f4f6')
    .setFontColor('#6b7280')
    .setRanges([statusRange])
    .build();

  // Cancelled - Red
  const cancelledRule = SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('Cancelled')
    .setBackground('#fee2e2')
    .setFontColor('#991b1b')
    .setRanges([statusRange])
    .build();

  // Apply all conditional formatting rules
  const rules = sheet.getConditionalFormatRules();
  rules.push(highRule, mediumRule, lowRule, pendingRule, sentRule, completedRule, cancelledRule);
  sheet.setConditionalFormatRules(rules);

  // Apply standard formatting
  applyStandardFormatting(sheet);

  // Set tab color (Violet for reminders)
  sheet.setTabColor('#8b5cf6');

  log('Reminders sheet created and formatted successfully');
  return sheet;
}

// ============================================================================
// END OF SETUP.GS
// ============================================================================
