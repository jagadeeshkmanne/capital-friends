/**
 * ============================================================================
 * MENU.GS - Menu Structure for Capital Friends V2
 * ============================================================================
 */

/**
 * Create custom menu when spreadsheet opens
 */
function createCustomMenu() {
  const ui = SpreadsheetApp.getUi();

  ui.createMenu('💰 Capital Friends')

    // ========== SETUP & HEALTH CHECK ==========
    .addItem('⚡ ONE-CLICK SETUP', 'oneClickSetup')
    .addItem('💚 Financial Health Check', 'updateQuestionnaire')

    .addSeparator()

    // ========== DASHBOARD & REPORTS ==========
    .addItem('📊 Dashboard', 'viewEmailReportDialog')
    .addItem('📧 Send Email Report', 'sendDailySummaryEmail')
    .addItem('⚙️ Email Settings', 'showEmailSettingsDialog')

    .addSeparator()

    // ========== GOALS (TOP PRIORITY) ==========
    .addSubMenu(ui.createMenu('🎯 Goals')
      .addItem('🎯 Goal Planner (Wizard)', 'showGoalPlannerDialog')
      .addItem('📊 Goals Dashboard', 'showGoalsDashboardDialog')
      .addItem('💸 Withdrawal Planning', 'showGoalWithdrawalPlanDialog')
      .addSeparator()
      .addItem('➕ Add Goal', 'showAddGoalDialog')
      .addItem('✏️ Edit Goal', 'showEditGoalDialog')
      .addItem('🔗 Map Portfolios to Goal', 'showMapPortfoliosToGoalDialog')
      .addSeparator()
      .addItem('👁️ View All Goals', 'showAllGoalsSheet'))

    // ========== FAMILY MEMBERS ==========
    .addSubMenu(ui.createMenu('👥 Family Members')
      .addItem('➕ Add Member', 'showAddFamilyMemberDialog')
      .addItem('✏️ Edit Member', 'showEditFamilyMemberDialog')
      .addItem('👁️ View All', 'showAllFamilyMembersSheet'))

    // ========== BANK ACCOUNTS ==========
    .addSubMenu(ui.createMenu('🏦 Bank Accounts')
      .addItem('➕ Add Account', 'showAddBankAccountDialog')
      .addItem('✏️ Edit Account', 'showEditBankAccountDialog')
      .addItem('👁️ View All', 'showAllBankAccountsSheet'))

    // ========== INVESTMENT ACCOUNTS ==========
    .addSubMenu(ui.createMenu('💼 Investment Accounts')
      .addItem('➕ Add Account', 'showAddInvestmentAccountDialog')
      .addItem('✏️ Edit Account', 'showEditInvestmentAccountDialog')
      .addItem('👁️ View All', 'showAllInvestmentAccountsSheet'))

    .addSeparator()

    // ========== MUTUAL FUNDS ==========
    .addSubMenu(ui.createMenu('📊 Mutual Funds')
      .addItem('➕ Create Portfolio', 'showAddPortfolioDialog')
      .addItem('✏️ Edit Portfolio', 'showEditPortfolioDialog')
      .addItem('🎯 Manage Portfolio Allocation', 'showPortfolioRebalancePlanDialog')
      .addItem('👁️ View All', 'showAllPortfoliosSheet')
      .addSeparator()
      .addItem('📥 Migrate Holdings', 'showMigrateExistingHoldingsDialog')
      .addSeparator()
      .addItem('💵 Buy (SIP)', 'showBuySIPDialog')
      .addItem('💰 Buy (Lumpsum)', 'showBuyLumpsumDialog')
      .addItem('💸 Sell/Redeem', 'showSellDialog')
      .addItem('🔄 Switch Funds', 'showSwitchFundsDialog')
      .addSeparator()
      .addItem('🔍 Fund Composition Breakdown', 'showManageAssetAllocationDialog'))

    // ========== STOCKS ==========
    .addSubMenu(ui.createMenu('📈 Stocks')
      .addItem('➕ Create Stock Portfolio', 'showAddStockPortfolioDialog')
      .addItem('👁️ View All Portfolios', 'showAllStockPortfoliosSheet')
      .addSeparator()
      .addItem('💰 Buy Stocks', 'showBuyStockDialog')
      .addItem('💸 Sell Stocks', 'showSellStockDialog')
      .addSeparator()
      .addItem('📊 View Holdings', 'showStockHoldingsSheet')
      .addItem('📈 View Transactions', 'showStockTransactionsSheet')
      .addItem('🔍 View Stock Database', 'showStockMasterDataSheet'))

    // ========== OTHER INVESTMENTS (Gold, Real Estate, PPF, etc.) ==========
    .addSubMenu(ui.createMenu('💎 Other Investments')
      .addItem('➕ Add Investment', 'showAddInvestmentDialog')
      .addItem('✏️ Edit Investment', 'showEditInvestmentDialog')
      .addItem('👁️ View All', 'showAllInvestmentsSheet'))

    // ========== LIABILITIES ==========
    .addSubMenu(ui.createMenu('💳 Liabilities')
      .addItem('➕ Add Liability', 'showAddLiabilityDialog')
      .addItem('✏️ Edit Liability', 'showEditLiabilityDialog')
      .addItem('👁️ View All', 'showAllLiabilitiesSheet'))

    // ========== INSURANCE ==========
    .addSubMenu(ui.createMenu('🛡️ Insurance')
      .addItem('➕ Add Insurance Policy', 'showAddInsurancePolicyDialog')
      .addItem('✏️ Edit Insurance Policy', 'showEditInsurancePolicyDialog')
      .addItem('👁️ View All Policies', 'showAllInsurancePoliciesSheet'))

    .addSeparator()

    // ========== REMINDERS ==========
    .addSubMenu(ui.createMenu('⏰ Reminders')
      .addItem('➕ Add Reminder', 'showAddReminderDialog')
      .addItem('✏️ Edit Reminder', 'showEditReminderDialog')
      .addItem('👁️ View All Reminders', 'showAllRemindersSheet')
      .addSeparator()
      .addItem('⚙️ Setup Daily Check', 'setupReminderTriggerFromMenu')
      .addItem('🧪 Test Reminder Email', 'testReminderEmailFromMenu'))

    .addSeparator()

    // ========== ABOUT & SUPPORT ==========
    .addItem('ℹ️ About', 'showAboutDialog')
    .addItem('☕ Support Developer', 'showDonateDialog')

    .addToUi();
}

// ============================================================================
// MENU ACTION PLACEHOLDERS (Will be implemented in respective modules)
// ============================================================================

// Getting Started - NAV Import is now implemented in NAV.gs
// showImportNAVDialog() shows a progress dialog (used in menu)
// importNAVData() is legacy function for auto-import when NAV data is missing

/**
 * Update Questionnaire - Allows user to retake/update security check
 * Pre-populates existing answers
 */
function updateQuestionnaire() {
  const template = HtmlService.createTemplateFromFile('QuestionnaireUpdate');
  const htmlOutput = template.evaluate()
    .setWidth(800)
    .setHeight(650);

  SpreadsheetApp.getUi().showModalDialog(htmlOutput, '💚 Family Financial Health Check');
}

/**
 * Get existing questionnaire data from the sheet
 */
function getQuestionnaireData() {
  const sheet = getSheet('Questionnaire');
  if (!sheet) {
    return null;
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 3) {
    return null;
  }

  // Read the LAST row with data (most recent questionnaire)
  const data = sheet.getRange(lastRow, 1, 1, 10).getValues()[0];

  return {
    date: data[0],
    healthInsurance: data[1],
    termInsurance: data[2],
    emergencyFund: data[3],
    familyAwareness: data[4],
    will: data[5],
    nominees: data[6],
    goals: data[7],
    score: data[8],
    total: data[9]
  };
}

// Family Details - Family Members
function showAddFamilyMemberDialog() {
  const template = HtmlService.createTemplateFromFile('AddFamilyMember');
  const htmlOutput = template.evaluate()
    .setWidth(800)
    .setHeight(650);

  SpreadsheetApp.getUi().showModalDialog(htmlOutput, '👤 Add Family Member');
}

function showEditFamilyMemberDialog() {
  // Show dialog with dropdown selection and edit form in same window
  const template = HtmlService.createTemplateFromFile('EditFamilyMember');
  const htmlOutput = template.evaluate()
    .setWidth(800)
    .setHeight(650);

  SpreadsheetApp.getUi().showModalDialog(htmlOutput, '✏️ View/Edit Family Member');
}

function showAllFamilyMembersSheet() {
  const sheet = getSheet(CONFIG.familyMembersSheet);
  if (sheet) {
    sheet.activate();
  } else {
    showError('FamilyMembers sheet not found. Please run ONE-CLICK SETUP first.');
  }
}

// Family Details - Bank Accounts
function showAddBankAccountDialog() {
  const template = HtmlService.createTemplateFromFile('AddBankAccount');
  const htmlOutput = template.evaluate()
    .setWidth(800)
    .setHeight(500);

  SpreadsheetApp.getUi().showModalDialog(htmlOutput, '🏦 Add Bank Account');
}

function showEditBankAccountDialog() {
  const template = HtmlService.createTemplateFromFile('EditBankAccount');
  const htmlOutput = template.evaluate()
    .setWidth(800)
    .setHeight(550);

  SpreadsheetApp.getUi().showModalDialog(htmlOutput, '✏️ View/Edit Bank Account');
}

function showAllBankAccountsSheet() {
  const sheet = getSheet(CONFIG.bankAccountsSheet);
  if (sheet) {
    sheet.activate();
  } else {
    showError('BankAccounts sheet not found. Please run ONE-CLICK SETUP first.');
  }
}

// Legacy function name for backwards compatibility
function showAllBankAccountsDialog() {
  showAllBankAccountsSheet();
}

// Family Details - Investment Accounts
function showAddInvestmentAccountDialog() {
  const template = HtmlService.createTemplateFromFile('AddInvestmentAccount');
  const htmlOutput = template.evaluate()
    .setWidth(800)
    .setHeight(550);

  SpreadsheetApp.getUi().showModalDialog(htmlOutput, '💼 Add Investment Account');
}

function showEditInvestmentAccountDialog() {
  const template = HtmlService.createTemplateFromFile('EditInvestmentAccount');
  const htmlOutput = template.evaluate()
    .setWidth(800)
    .setHeight(600);

  SpreadsheetApp.getUi().showModalDialog(htmlOutput, '✏️ View/Edit Investment Account');
}

function showAllInvestmentAccountsSheet() {
  const sheet = getSheet(CONFIG.investmentAccountsSheet);
  if (sheet) {
    sheet.activate();
  } else {
    showError('InvestmentAccounts sheet not found. Please run ONE-CLICK SETUP first.');
  }
}

// Legacy function name for backwards compatibility
function showAllInvestmentAccountsDialog() {
  showAllInvestmentAccountsSheet();
}

// Mutual Funds
function showAddPortfolioDialog() {
  const template = HtmlService.createTemplateFromFile('AddPortfolio');
  const htmlOutput = template.evaluate()
    .setWidth(800)
    .setHeight(450);

  SpreadsheetApp.getUi().showModalDialog(htmlOutput, '📊 Create Portfolio');
}

function showEditPortfolioDialog() {
  const template = HtmlService.createTemplateFromFile('EditPortfolio');
  const htmlOutput = template.evaluate()
    .setWidth(800)
    .setHeight(500);

  SpreadsheetApp.getUi().showModalDialog(htmlOutput, '✏️ View/Edit Portfolio');
}

function showAllPortfoliosSheet() {
  const sheet = getSheet(CONFIG.portfolioMetadataSheet);
  if (sheet) {
    sheet.activate();
  } else {
    showError('AllPortfolios sheet not found. Please run ONE-CLICK SETUP first.');
  }
}

// Migrate Existing Holdings (renamed from Add Fund to Portfolio)
function showMigrateExistingHoldingsDialog() {
  const template = HtmlService.createTemplateFromFile('AddExistingHoldings');
  const htmlOutput = template.evaluate()
    .setWidth(800)
    .setHeight(550);

  SpreadsheetApp.getUi().showModalDialog(htmlOutput, '📥 Migrate Existing Holdings');
}

// Buy (SIP) - renamed from Buy Units
function showBuySIPDialog() {
  const template = HtmlService.createTemplateFromFile('InvestViaSIP');
  const htmlOutput = template.evaluate()
    .setWidth(800)
    .setHeight(500);

  SpreadsheetApp.getUi().showModalDialog(htmlOutput, '💵 Buy (SIP)');
}

// Buy (Lumpsum) - new function
function showBuyLumpsumDialog() {
  const template = HtmlService.createTemplateFromFile('InvestLumpsum');
  const htmlOutput = template.evaluate()
    .setWidth(800)
    .setHeight(500);

  SpreadsheetApp.getUi().showModalDialog(htmlOutput, '💰 Buy (Lumpsum)');
}

// Sell - renamed from Sell Units
function showSellDialog() {
  const template = HtmlService.createTemplateFromFile('Redeem');
  const htmlOutput = template.evaluate()
    .setWidth(800)
    .setHeight(550);

  SpreadsheetApp.getUi().showModalDialog(htmlOutput, '💸 Redeem/Sell');
}

function showSwitchFundsDialog() {
  const template = HtmlService.createTemplateFromFile('SwitchFunds');
  const htmlOutput = template.evaluate()
    .setWidth(800)
    .setHeight(650);

  SpreadsheetApp.getUi().showModalDialog(htmlOutput, '🔄 Switch Funds');
}

function showManageAssetAllocationDialog() {
  const template = HtmlService.createTemplateFromFile('ManageAssetAllocation');
  const htmlOutput = template.evaluate()
    .setWidth(800)
    .setHeight(650);

  SpreadsheetApp.getUi().showModalDialog(htmlOutput, '📊 Fund Asset & Market Cap Allocation');
}

/**
 * TEST: Show test search dialog
 */
function showTestSearchDialog() {
  const htmlOutput = HtmlService.createHtmlOutputFromFile('TestSearchFromHTML')
    .setWidth(600)
    .setHeight(500);
  SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Test Search Function');
}

// Other Investments - Functions are implemented in OtherInvestments.gs
// showAddInvestmentDialog()
// showEditInvestmentDialog()
// showManageInvestmentTypesDialog()

// View All Investments - Navigate to sheet
function showAllInvestmentsSheet() {
  const sheet = getSheet(CONFIG.otherInvestmentsSheet);
  if (sheet) {
    sheet.activate();
  } else {
    showError('OtherInvestments sheet not found. Please run ONE-CLICK SETUP first.');
  }
}

// Liabilities - Functions are implemented in Liabilities.gs
// showAddLiabilityDialog()
// showEditLiabilityDialog()
// showManageLiabilityTypesDialog()

// View All Liabilities - Navigate to sheet
function showAllLiabilitiesSheet() {
  const sheet = getSheet(CONFIG.liabilitiesSheet);
  if (sheet) {
    sheet.activate();
  } else {
    showError('Liabilities sheet not found. Please run ONE-CLICK SETUP first.');
  }
}

// Dashboard Functions
function openDashboard() {
  try {
    const template = HtmlService.createTemplateFromFile('Dashboard');
    const htmlOutput = template.evaluate()
      .setWidth(1200)
      .setHeight(800);
    SpreadsheetApp.getUi().showModalDialog(htmlOutput, '💰 Family Wealth Dashboard');
  } catch (error) {
    log('Error opening dashboard: ' + error.toString());
    showError('Error opening dashboard: ' + error.message);
  }
}

function manualRefreshDashboard() {
  try {
    const result = refreshDashboard();
    if (result.success) {
      showSuccess('Dashboard refreshed successfully!');
      openDashboard();
    } else {
      showError('Failed to refresh dashboard: ' + (result.error || 'Unknown error'));
    }
  } catch (error) {
    showError('Error refreshing dashboard: ' + error.message);
  }
}

// Insurance Menu Functions
function showAddInsurancePolicyDialog() {
  const template = HtmlService.createTemplateFromFile('AddInsurancePolicy');
  const htmlOutput = template.evaluate()
    .setWidth(800)
    .setHeight(650);

  SpreadsheetApp.getUi().showModalDialog(htmlOutput, '🛡️ Add Insurance Policy');
}

function showEditInsurancePolicyDialog() {
  const template = HtmlService.createTemplateFromFile('EditInsurancePolicy');
  const htmlOutput = template.evaluate()
    .setWidth(800)
    .setHeight(650);

  SpreadsheetApp.getUi().showModalDialog(htmlOutput, '✏️ Edit Insurance Policy');
}

function showAllInsurancePoliciesSheet() {
  const sheet = getSheet(CONFIG.insuranceSheet);
  if (sheet) {
    sheet.activate();
  } else {
    showError('Insurance sheet not found. Please run ONE-CLICK SETUP first.');
  }
}

// Legacy function name for backwards compatibility
function showAddInsuranceDialog() {
  showAddInsurancePolicyDialog();
}

function openInsuranceSheet() {
  showAllInsurancePoliciesSheet();
}

// Loans (Legacy - kept for backward compatibility)
// ✅ Redirects to Liabilities sheet (unified module)
function showAddLoanDialog() {
  showInfo('Loan management has moved to Liabilities section');
}

function openLoansSheet() {
  // ✅ Redirect to Liabilities sheet instead
  const sheet = getSheet(CONFIG.liabilitiesSheet);
  if (sheet) {
    sheet.activate();
  } else {
    showError('Liabilities sheet not found. Please run ONE-CLICK SETUP first.');
  }
}

// View Email Report in Dialog (Dashboard)
function viewEmailReportDialog() {
  try {
    // Show loading dialog with spinner
    const template = HtmlService.createTemplateFromFile('DashboardLoader');
    const htmlOutput = template.evaluate()
      .setWidth(1200)
      .setHeight(800);

    SpreadsheetApp.getUi().showModalDialog(htmlOutput, '📊 Family Wealth Dashboard');
  } catch (error) {
    Logger.log('Error viewing dashboard: ' + error.toString());
    showError('Error viewing dashboard: ' + error.message);
  }
}

// Send Email Report (from menu - with UI)
function sendDailySummaryEmail() {
  try {
    // Show confirmation dialog
    const ui = SpreadsheetApp.getUi();
    const response = ui.alert(
      'Send Email Report',
      'Send family wealth report via email now?\n\nThis will send the report to all family members with "Include in Email Reports" = Yes.',
      ui.ButtonSet.YES_NO
    );

    if (response === ui.Button.YES) {
      // Show progress dialog
      const progressHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <base target="_top">
          <script src="https://cdn.tailwindcss.com"></script>
        </head>
        <body class="m-0 p-0 bg-white">
          <div class="flex items-center justify-center min-h-[200px] bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
            <div class="bg-white p-8 rounded-lg shadow-xl text-center min-w-[400px]">
              <div class="w-16 h-16 border-4 border-gray-200 border-t-indigo-600 rounded-full mx-auto mb-4 animate-spin"></div>
              <div class="text-xl font-bold text-gray-800 mb-2">Sending Email Report</div>
              <div class="text-sm text-gray-600 mb-4">Generating and sending your family wealth report...</div>
              <div class="text-xs text-gray-500">This may take 10-30 seconds</div>
            </div>
          </div>
          <script>
            window.addEventListener('DOMContentLoaded', function() {
              google.script.run
                .withSuccessHandler(function(result) {
                  if (result.success) {
                    // Show success message and auto-close after 2 seconds
                    document.body.innerHTML = '<div class="flex items-center justify-center min-h-[200px] bg-green-50"><div class="bg-white p-8 rounded-lg shadow-lg text-center max-w-md border-l-4 border-green-500"><div class="text-5xl mb-4">✅</div><div class="text-xl font-bold text-gray-900 mb-2">Email Sent Successfully!</div><div class="text-sm text-gray-700 mb-4">Recipients: ' + result.recipients.join(', ') + '<br>Time: ' + result.duration.toFixed(1) + ' seconds</div><div class="text-xs text-gray-500">Closing automatically...</div></div></div>';
                    setTimeout(function() { google.script.host.close(); }, 2000);
                  } else {
                    // Show error with close button (don't auto-close on error)
                    document.body.innerHTML = '<div class="flex items-center justify-center min-h-[200px] bg-red-50"><div class="bg-white p-8 rounded-lg shadow-lg text-center max-w-md border-l-4 border-red-500"><div class="text-5xl mb-4">❌</div><div class="text-xl font-bold text-gray-900 mb-2">Error Sending Email</div><div class="text-sm text-gray-700 mb-4">' + result.error + '</div><button onclick="google.script.host.close()" class="px-6 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors">Close</button></div></div>';
                  }
                })
                .withFailureHandler(function(error) {
                  // Show error with close button (don't auto-close on error)
                  document.body.innerHTML = '<div class="flex items-center justify-center min-h-[200px] bg-red-50"><div class="bg-white p-8 rounded-lg shadow-lg text-center max-w-md border-l-4 border-red-500"><div class="text-5xl mb-4">❌</div><div class="text-xl font-bold text-gray-900 mb-2">Error Sending Email</div><div class="text-sm text-gray-700 mb-4">' + error.message + '</div><button onclick="google.script.host.close()" class="px-6 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors">Close</button></div></div>';
                })
                .sendCompleteWealthReportEmailSilent();
            });
          </script>
        </body>
        </html>
      `;

      const htmlOutput = HtmlService.createHtmlOutput(progressHtml)
        .setWidth(500)
        .setHeight(250);

      // Use modeless dialog with empty title for cleaner look (just loading spinner)
      ui.showModelessDialog(htmlOutput, ' ');
    }
  } catch (error) {
    Logger.log('Error in sendDailySummaryEmail: ' + error.toString());
    SpreadsheetApp.getUi().alert('Error', 'Failed to send email: ' + error.message, SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

// Silent email send (for triggers - no UI)
function sendCompleteWealthReportEmailSilent() {
  return sendCompleteWealthReportEmail();
}

// Email Settings Dialog
function showEmailSettingsDialog() {
  try {
    const template = HtmlService.createTemplateFromFile('EmailSettings');
    const htmlOutput = template.evaluate()
      .setWidth(700)
      .setHeight(650);

    SpreadsheetApp.getUi().showModalDialog(htmlOutput, '⚙️ Email Report Settings');
  } catch (error) {
    Logger.log('Error opening email settings: ' + error.toString());
    showError('Error opening email settings: ' + error.message);
  }
}

/**
 * Get email settings for dialog
 * @returns {Object} - Settings and recipient count
 */
function getEmailSettings() {
  try {
    // Get raw values and convert to strings
    const emailConfigured = getSetting('EmailConfigured');
    const emailFrequency = getSetting('EmailFrequency');
    const emailHour = getSetting('EmailHour');
    const emailMinute = getSetting('EmailMinute');
    const emailDayOfWeek = getSetting('EmailDayOfWeek');
    const emailDayOfMonth = getSetting('EmailDayOfMonth');

    const settings = {
      EmailConfigured: String(emailConfigured || 'FALSE').toUpperCase(),
      EmailFrequency: String(emailFrequency || 'Daily'),
      EmailHour: String(emailHour || '9'),
      EmailMinute: String(emailMinute || '0'),
      EmailDayOfWeek: String(emailDayOfWeek || '0'),
      EmailDayOfMonth: String(emailDayOfMonth || '1')
    };

    // Debug logging
    Logger.log('Email settings loaded: ' + JSON.stringify(settings));

    const recipients = getEmailRecipients();

    return {
      success: true,
      settings: settings,
      recipientCount: recipients.length
    };
  } catch (error) {
    Logger.log('Error getting email settings: ' + error.toString());
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Save email settings from dialog
 * @param {Object} settings - Settings object
 * @returns {Object} - Success/error response
 */
function saveEmailSettings(settings) {
  try {
    // Update all settings
    updateSetting('EmailConfigured', settings.EmailConfigured);
    updateSetting('EmailFrequency', settings.EmailFrequency);
    updateSetting('EmailHour', settings.EmailHour);
    updateSetting('EmailMinute', settings.EmailMinute);
    updateSetting('EmailDayOfWeek', settings.EmailDayOfWeek);
    updateSetting('EmailDayOfMonth', settings.EmailDayOfMonth);

    // Update triggers based on new settings
    installEmailScheduleTrigger();

    const message = settings.EmailConfigured === 'TRUE'
      ? 'Email settings saved! Automated reports are now enabled.'
      : 'Email settings saved! Automated reports are now disabled.';

    return {
      success: true,
      message: message
    };
  } catch (error) {
    Logger.log('Error saving email settings: ' + error.toString());
    return {
      success: false,
      error: error.message
    };
  }
}

// Preferences
function showSettingsDialog() {
  showInfo('Settings feature coming soon');
}

// Utilities
function autoAdjustAllSheets() {
  const spreadsheet = getSpreadsheet();
  const sheets = spreadsheet.getSheets();

  let count = 0;
  sheets.forEach(sheet => {
    sheet.autoResizeColumns(1, sheet.getLastColumn());
    count++;
  });

  showSuccess(`Auto-adjusted ${count} sheets successfully!`);
}

function autoAdjustCurrentSheet() {
  const sheet = SpreadsheetApp.getActiveSheet();
  sheet.autoResizeColumns(1, sheet.getLastColumn());
  showSuccess(`Auto-adjusted columns in "${sheet.getName()}" sheet!`);
}

// Support
function showDonateDialog() {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <base target="_top">
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 20px;
            text-align: center;
          }
          h2 {
            color: #6366f1;
          }
          .info {
            background: #f3f4f6;
            padding: 15px;
            border-radius: 8px;
            margin: 15px 0;
          }
          .upi {
            font-size: 1.2em;
            font-weight: bold;
            color: #059669;
            margin: 10px 0;
          }
        </style>
      </head>
      <body>
        <h2>☕ Support the Developer</h2>
        <p>If you find Capital Friends helpful, consider buying me a coffee!</p>

        <div class="info">
          <img src="https://capitalfriends.in/upi-qr-code.png" alt="UPI QR Code" style="max-width: 200px; height: auto; margin: 10px auto; display: block; border-radius: 8px;">
          <p style="font-size: 11px; color: #6b7280; margin-top: 8px;">Scan with any UPI app</p>
        </div>

        <p>Your support helps me maintain and improve this tool!</p>

        <p style="margin-top: 30px;">
          <button onclick="google.script.host.close()" style="padding: 10px 20px; background: #6366f1; color: white; border: none; border-radius: 6px; cursor: pointer;">Close</button>
        </p>
      </body>
    </html>
  `;

  const htmlOutput = HtmlService.createHtmlOutput(html)
    .setWidth(400)
    .setHeight(300);

  SpreadsheetApp.getUi().showModalDialog(htmlOutput, '☕ Support Developer');
}

// Stocks Menu Functions
function showAddStockPortfolioDialog() {
  try {
    const html = HtmlService.createTemplateFromFile('AddStockPortfolio').evaluate();
    html.setWidth(800).setHeight(400);
    SpreadsheetApp.getUi().showModalDialog(html, '📈 Create Stock Portfolio');
  } catch (error) {
    showError('Error: ' + error.message);
  }
}

function showAllStockPortfoliosSheet() {
  const sheet = getSheet(CONFIG.stockPortfoliosSheet);
  if (sheet) {
    sheet.activate();
  } else {
    showError('StockPortfolios sheet not found. Please run ONE-CLICK SETUP first.');
  }
}

function showBuyStockDialog() {
  try {
    const html = HtmlService.createTemplateFromFile('BuyStock').evaluate();
    html.setWidth(900).setHeight(650);
    SpreadsheetApp.getUi().showModalDialog(html, '💰 Buy Stocks');
  } catch (error) {
    showError('Error: ' + error.message);
  }
}

function showSellStockDialog() {
  try {
    const html = HtmlService.createTemplateFromFile('SellStock').evaluate();
    html.setWidth(900).setHeight(700);
    SpreadsheetApp.getUi().showModalDialog(html, '💸 Sell Stocks');
  } catch (error) {
    showError('Error: ' + error.message);
  }
}

function showStockHoldingsSheet() {
  const sheet = getSheet(CONFIG.stockHoldingsSheet);
  if (sheet) {
    sheet.activate();
  } else {
    showError('StockHoldings sheet not found. Please run ONE-CLICK SETUP first.');
  }
}

function showStockTransactionsSheet() {
  const sheet = getSheet(CONFIG.stockTransactionsSheet);
  if (sheet) {
    sheet.activate();
  } else {
    showError('StockTransactions sheet not found. Please run ONE-CLICK SETUP first.');
  }
}

function showStockMasterDataSheet() {
  const sheet = getSheet(CONFIG.stockMasterDataSheet);
  if (sheet) {
    sheet.activate();
  } else {
    showError('StockMasterData sheet not found. Please run ONE-CLICK SETUP first.');
  }
}

// Reminders Menu Functions
function showAddReminderDialog() {
  const template = HtmlService.createTemplateFromFile('AddReminder');
  const htmlOutput = template.evaluate()
    .setWidth(800)
    .setHeight(650);

  SpreadsheetApp.getUi().showModalDialog(htmlOutput, '⏰ Add Reminder');
}

function showEditReminderDialog() {
  const template = HtmlService.createTemplateFromFile('EditReminder');
  const htmlOutput = template.evaluate()
    .setWidth(800)
    .setHeight(650);

  SpreadsheetApp.getUi().showModalDialog(htmlOutput, '✏️ Edit Reminder');
}

function showAllRemindersSheet() {
  const sheet = getRemindersSheet();
  if (sheet) {
    sheet.activate();
  } else {
    showError('Reminders sheet not found.');
  }
}

function setupReminderTriggerFromMenu() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    'Setup Daily Reminder Check',
    'This will create a daily trigger that checks for reminders at 8 AM every day.\n\n' +
    'Do you want to proceed?',
    ui.ButtonSet.YES_NO
  );

  if (response === ui.Button.YES) {
    const result = setupReminderTrigger();
    if (result.success) {
      showSuccess(result.message);
    } else {
      showError(result.message);
    }
  }
}

function testReminderEmailFromMenu() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    'Test Reminder Email',
    'This will send a test reminder email to your email address.\n\n' +
    'Do you want to proceed?',
    ui.ButtonSet.YES_NO
  );

  if (response === ui.Button.YES) {
    try {
      testReminderEmail();
      showSuccess('Test reminder email sent successfully! Check your inbox.');
    } catch (error) {
      showError('Failed to send test email: ' + error.message);
    }
  }
}

// ============================================================================
// GOALS MENU FUNCTIONS
// ============================================================================

/**
 * Show Goal Planner Wizard
 */
function showGoalPlannerDialog() {
  const template = HtmlService.createTemplateFromFile('GoalPlanner');
  const htmlOutput = template.evaluate()
    .setWidth(900)
    .setHeight(750);

  SpreadsheetApp.getUi().showModalDialog(htmlOutput, '🎯 Goal Planner - Plan Your Financial Future');
}

/**
 * Show Goals Dashboard
 */
function showGoalsDashboardDialog() {
  const template = HtmlService.createTemplateFromFile('GoalsDashboard');
  const htmlOutput = template.evaluate()
    .setWidth(1000)
    .setHeight(800);

  SpreadsheetApp.getUi().showModalDialog(htmlOutput, '📊 Goals Dashboard');
}

/**
 * Show Add Goal Dialog
 */
function showAddGoalDialog() {
  const template = HtmlService.createTemplateFromFile('AddGoal');
  const htmlOutput = template.evaluate()
    .setWidth(800)
    .setHeight(700);

  SpreadsheetApp.getUi().showModalDialog(htmlOutput, '➕ Add New Goal');
}

/**
 * Show Edit Goal Dialog
 */
function showEditGoalDialog() {
  const template = HtmlService.createTemplateFromFile('EditGoal');
  const htmlOutput = template.evaluate()
    .setWidth(800)
    .setHeight(750);

  SpreadsheetApp.getUi().showModalDialog(htmlOutput, '✏️ Edit Goal');
}

/**
 * Show Map Portfolios to Goal Dialog
 */
function showMapPortfoliosToGoalDialog() {
  const template = HtmlService.createTemplateFromFile('MapPortfoliosToGoal');
  const htmlOutput = template.evaluate()
    .setWidth(900)
    .setHeight(700);

  SpreadsheetApp.getUi().showModalDialog(htmlOutput, '🔗 Map Portfolios to Goal');
}

/**
 * Show Goal Withdrawal Plan Dialog
 */
function showGoalWithdrawalPlanDialog() {
  const template = HtmlService.createTemplateFromFile('GoalWithdrawalPlan');
  const htmlOutput = template.evaluate()
    .setWidth(900)
    .setHeight(750);

  SpreadsheetApp.getUi().showModalDialog(htmlOutput, '💸 Goal Withdrawal Planning');
}

/**
 * Show All Goals Sheet
 */
function showAllGoalsSheet() {
  const sheet = getSheet('Goals');
  if (sheet) {
    sheet.activate();
  } else {
    showError('Goals sheet not found. Please run ONE-CLICK SETUP first.');
  }
}

/**
 * Show Goal Achieved Celebration Dialog
 */
function showGoalAchievedDialog() {
  const template = HtmlService.createTemplateFromFile('GoalAchieved');
  const htmlOutput = template.evaluate()
    .setWidth(700)
    .setHeight(750);

  SpreadsheetApp.getUi().showModalDialog(htmlOutput, '🎉 Goal Achieved!');
}

// ============================================================================
// END OF MENU.GS
// ============================================================================
