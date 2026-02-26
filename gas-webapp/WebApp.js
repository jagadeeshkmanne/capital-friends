/**
 * ============================================================================
 * CAPITAL FRIENDS - Web App API Router
 * ============================================================================
 *
 * Two entry points:
 *   1. apiRouter() — called via Apps Script Execution API (runs as USER)
 *   2. doGet()     — health check via web app URL (runs as DEPLOYER)
 *
 * With the Execution API, each function call runs as the authenticated user.
 * This means DriveApp, SpreadsheetApp etc. operate on the USER's account.
 * True privacy — the app developer cannot access user data.
 *
 * ============================================================================
 */

// ============================================================================
// WEB APP CONFIGURATION
// ============================================================================

var WEBAPP_CONFIG = {
  // Template spreadsheet ID (clean template with all sheets set up)
  // Must be shared as "Anyone with the link" (Viewer) so users can copy it
  templateSpreadsheetId: '1k_GFpn0ZVRNfxBpgFzCU1zvux7apw9axIP5vIn5NR74'
};

// ============================================================================
// EXECUTION API ENTRY POINT
// ============================================================================

/**
 * Main API entry point — called via Apps Script Execution API.
 * The function runs as the authenticated user (not the deployer).
 *
 * @param {Object} request - { action: string, params: object, userName: string }
 * @returns {Object} - { success: boolean, data: any, error: string }
 */
function apiRouter(request) {
  try {
    // With Execution API, Session.getActiveUser() returns the calling user
    var email = Session.getActiveUser().getEmail();
    if (!email) {
      return { success: false, error: 'Not authenticated. Please sign in again.', code: 401 };
    }

    var action = request.action;
    var params = request.params || {};
    var userName = request.userName || email.split('@')[0];

    if (!action) {
      return { success: false, error: 'Missing action', code: 400 };
    }

    // Look up or create user in registry (Script Properties)
    var userRecord = getOrCreateUser(email, userName);
    if (!userRecord || userRecord.status === 'Suspended') {
      return { success: false, error: 'Account suspended or unavailable.', code: 403 };
    }

    // Set spreadsheet context for all business logic functions
    _currentUserSpreadsheetId = userRecord.spreadsheetId;

    // Route to action handler
    var result = routeAction(action, params, userRecord);

    // Sanitize: strip non-serializable types (Date, Range, Sheet) for Execution API
    return JSON.parse(JSON.stringify({ success: true, data: result }));

  } catch (error) {
    log('apiRouter error: ' + error.toString());
    return { success: false, error: error.message || 'Internal server error', code: 500 };
  }
}

// ============================================================================
// WEB APP ENTRY POINTS (health check / backward compat)
// ============================================================================

/**
 * Handle GET requests (health check only)
 */
function doGet(e) {
  var result = {
    status: 'ok',
    app: 'Capital Friends',
    version: CONFIG.appVersion,
    timestamp: new Date().toISOString()
  };
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================================
// ACTION ROUTER
// ============================================================================

/**
 * Route API action to the appropriate business logic function
 */
function routeAction(action, params, userRecord) {
  switch (action) {

    // ── Auth / User ──
    case 'auth:me':
      return {
        email: userRecord.email,
        name: userRecord.displayName,
        role: userRecord.role,
        spreadsheetId: userRecord.spreadsheetId
      };

    case 'auth:shared-members':
      return getSharedMembers(userRecord.spreadsheetId);

    case 'auth:invite':
      requireOwner(userRecord);
      return inviteToFamily(userRecord, params.email, params.name);

    case 'auth:remove-member':
      requireOwner(userRecord);
      return removeFromFamily(userRecord, params.email);

    // ── Bulk Load (fetch all data at once for initial load) ──
    case 'data:load-all':
      return loadAllData();

    // ── Family Members ──
    case 'members:list':
      return getAllFamilyMembers();

    case 'member:create':
      return addFamilyMember(params);

    case 'member:update':
      return updateFamilyMember(params);

    case 'member:delete':
      return deleteFamilyMember(params.memberId);

    // ── Bank Accounts ──
    case 'banks:list':
      return getAllBankAccounts();

    case 'bank:create':
      return addBankAccount(params);

    case 'bank:update':
      return updateBankAccount(params);

    case 'bank:delete':
      return deleteBankAccount(params.accountId);

    // ── Investment Accounts ──
    case 'invaccounts:list':
      return getAllInvestmentAccounts();

    case 'invacct:create':
      return addInvestmentAccount(params);

    case 'invacct:update':
      return updateInvestmentAccount(params);

    case 'invacct:delete':
      return deleteInvestmentAccount(params.accountId);

    // ── MF Portfolios ──
    case 'portfolios:list':
      return getAllPortfolios();

    case 'portfolio:create':
      return processAddPortfolio(params);

    case 'portfolio:update':
      return updatePortfolio(params);

    case 'portfolio:delete':
      return deletePortfolio(params.portfolioId);

    // ── MF Holdings / Funds ──
    case 'portfolio:holdings':
      return getPortfolioFunds(params.portfolioId);

    case 'mf:invest':
      return processInvestment(params, params.transactionType || 'LUMPSUM');

    case 'mf:redeem':
      return processRedeem(params);

    case 'mf:switch':
      return processSwitchFunds(params);

    case 'mf:allocations-update': {
      var portfolio = getPortfolioById(params.portfolioId);
      if (!portfolio) throw new Error('Portfolio not found: ' + params.portfolioId);
      var allocs = params.allocations || [];
      return savePortfolioAllocation({
        portfolioName: portfolio.portfolioName,
        fundsToUpdate: allocs.filter(function(a) { return !a.isNew; }).map(function(a) {
          return { schemeCode: a.schemeCode, fundName: a.fundName, targetPercent: a.targetAllocationPct };
        }),
        fundsToAdd: allocs.filter(function(a) { return a.isNew; }).map(function(a) {
          return { schemeCode: a.schemeCode, fundName: a.fundName, targetPercent: a.targetAllocationPct };
        })
      });
    }

    case 'funds:search':
      return searchFunds(params.query);

    case 'funds:all':
      return getAllFundsForClientSearch();

    // ── Goals ──
    case 'goals:list':
      return getAllGoals();

    case 'goal:create':
      return addGoal(params);

    case 'goal:update':
      return editGoal(params.goalId, params);

    case 'goal:delete':
      return deleteGoal(params.goalId);

    case 'goal:mappings-list':
      return getGoalPortfolioMappings();

    case 'goal:mappings-update':
      return updateGoalPortfolioMappings(params.goalId, params.mappings);

    // ── Insurance ──
    case 'insurance:list':
      return getAllInsurancePolicies();

    case 'insurance:create':
      return addInsurancePolicy(params);

    case 'insurance:update':
      return updateInsurancePolicy(params);

    case 'insurance:delete':
      return deleteInsurancePolicy(params.policyId);

    // ── Liabilities ──
    case 'liabilities:list':
      return getAllLiabilities();

    case 'liability:create':
      return addLiability(params);

    case 'liability:update':
      return updateLiability(params);

    case 'liability:delete':
      return deleteLiability(params.liabilityId);

    // ── Other Investments ──
    case 'otherinv:list':
      return getAllInvestments();

    case 'otherinv:create':
      return processAddInvestment(params);

    case 'otherinv:update':
      return processEditInvestment(params);

    case 'otherinv:delete':
      return deleteInvestment(params.investmentId);

    // ── Stock Portfolios ──
    case 'stock-portfolios:list':
      return getAllStockPortfolios();

    case 'stock-portfolio:create':
      return processAddStockPortfolio(params);

    case 'stock-portfolio:update':
      return processEditStockPortfolio(params);

    case 'stock-portfolio:delete':
      return deleteStockPortfolio(params.portfolioId);

    // ── Stock Transactions ──
    case 'stock:buy':
      return processBuyStock(params);

    case 'stock:sell':
      return processSellStock(params);

    case 'stock:holdings':
      return getStockHoldings(params.portfolioId);

    case 'stock:transactions':
      return getStockTransactions(params.portfolioId);

    // ── Reminders ──
    case 'reminders:list':
      return getAllReminders();

    case 'reminder:create':
      return addReminder(params);

    case 'reminder:update':
      return updateReminder(params);

    case 'reminder:delete':
      return deleteReminder(params.reminderId);

    // ── Health Check ──
    case 'healthcheck:status':
      return getHealthCheckStatus();

    case 'healthcheck:save':
      return saveHealthCheck(params);

    case 'healthcheck:get':
      return getLatestHealthCheckResponses();

    // ── Settings ──
    case 'settings:list':
      return getAllSettings();

    case 'settings:update':
      return updateAllSettings(params);

    // ── Master Data Refresh ──
    case 'data:refresh-master':
      return refreshAllMasterData();

    case 'data:check-freshness':
      return { stale: isMasterDataStale() };

    // ── Market Data ──
    case 'market:data':
      return getMarketData();

    // ── Bulk Data (for targeted refresh) ──
    case 'mf-holdings:list':
      return getAllMFHoldings();

    case 'mf-transactions:list':
      return getAllMFTransactions();

    case 'stock-holdings:list-all':
      return getAllStockHoldingsData();

    case 'stock-transactions:list-all':
      return getAllStockTransactionsData();

    // ── Diagnostics (for testing) ──
    case 'test:diagnose':
      return runDiagnostics();

    case 'test:echo':
      return { echo: params, timestamp: new Date().toISOString() };

    case 'test:triggers':
      return checkUserTriggers();

    // ── Unknown action ──
    default:
      throw new Error('Unknown action: ' + action);
  }
}

// ============================================================================
// BULK DATA LOADER
// ============================================================================

/**
 * Load all data for initial app load (reduces round trips).
 * Also auto-refreshes master data (MF NAVs, ATH, stocks) if stale (>24h).
 */
function loadAllData() {
  // Auto-refresh master data if stale (runs in background, transparent to user)
  var refreshResult = null;
  try {
    refreshResult = autoRefreshMasterDataIfStale();
  } catch (e) {
    log('Auto-refresh failed (non-blocking): ' + e.message);
  }

  return {
    members: safeCall(getAllFamilyMembers),
    bankAccounts: safeCall(getAllBankAccounts),
    investments: safeCall(getAllInvestmentAccounts),
    mfPortfolios: safeCall(getAllPortfolios),
    mfHoldings: safeCall(getAllMFHoldings),
    mfTransactions: safeCall(getAllMFTransactions),
    goals: safeCall(getAllGoals),
    goalPortfolioMappings: safeCall(getGoalPortfolioMappings),
    insurancePolicies: safeCall(getAllInsurancePolicies),
    liabilities: safeCall(getAllLiabilities),
    otherInvestments: safeCall(getAllInvestments),
    stockPortfolios: safeCall(getAllStockPortfolios),
    stockHoldings: safeCall(getAllStockHoldingsData),
    stockTransactions: safeCall(getAllStockTransactionsData),
    reminders: safeCall(getAllReminders),
    _masterDataRefreshed: refreshResult !== null
  };
}

/**
 * Safely call a function, returning empty array on error.
 * In diagnostic mode, errors are collected for reporting.
 */
var _safeCallErrors = [];

function safeCall(fn) {
  try {
    var result = fn();
    return result || [];
  } catch (e) {
    _safeCallErrors.push({ fn: fn.name, error: e.toString() });
    log('safeCall error for ' + fn.name + ': ' + e.toString());
    return [];
  }
}

/**
 * Get all MF holdings across all portfolios
 */
function getAllMFHoldings() {
  var portfolios = getAllPortfolios();
  var allHoldings = [];
  for (var i = 0; i < portfolios.length; i++) {
    if (portfolios[i].status !== 'Inactive') {
      try {
        var holdings = getPortfolioFunds(portfolios[i].portfolioId);
        if (holdings && holdings.length) {
          allHoldings = allHoldings.concat(holdings);
        }
      } catch (e) {
        log('Error getting holdings for ' + portfolios[i].portfolioId + ': ' + e.toString());
      }
    }
  }
  return allHoldings;
}

/**
 * Get all MF transactions across all portfolios
 */
function getAllMFTransactions() {
  var sheet = getSheet(CONFIG.transactionHistorySheet);
  if (!sheet) return [];
  var lastRow = sheet.getLastRow();
  if (lastRow < 3) return [];
  var data = sheet.getRange(3, 1, lastRow - 2, sheet.getLastColumn()).getValues();
  var transactions = [];
  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    if (!row[0]) continue;
    transactions.push({
      date: row[0] ? formatDate(row[0]) : '',
      portfolioId: row[1],
      portfolioName: row[2] || '',
      fundCode: row[3] || '',
      fundName: row[4] || '',
      type: row[5] || '',
      transactionType: row[6] || '',
      units: parseFloat(row[7]) || 0,
      price: parseFloat(row[8]) || 0,
      totalAmount: parseFloat(row[9]) || 0,
      notes: row[10] || '',
      timestamp: row[11] ? formatDate(row[11]) : '',
      gainLoss: parseFloat(row[12]) || 0,
      transactionId: row[13] || ''
    });
  }
  return transactions;
}

/**
 * Get all stock holdings across all portfolios
 */
function getAllStockHoldingsData() {
  var sheet = getSheet(CONFIG.stockHoldingsSheet);
  if (!sheet) return [];
  var lastRow = sheet.getLastRow();
  if (lastRow < 3) return [];
  var data = sheet.getRange(3, 1, lastRow - 2, sheet.getLastColumn()).getValues();
  var holdings = [];
  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    if (!row[0]) continue;
    holdings.push({
      holdingId: row[0],
      portfolioId: row[1],
      symbol: row[2] || '',
      companyName: row[3] || '',
      exchange: row[4] || 'NSE',
      quantity: parseFloat(row[5]) || 0,
      avgBuyPrice: parseFloat(row[6]) || 0,
      totalInvestment: parseFloat(row[7]) || 0,
      currentPrice: parseFloat(row[8]) || 0,
      currentValue: parseFloat(row[9]) || 0,
      unrealizedPL: parseFloat(row[10]) || 0,
      unrealizedPLPct: parseFloat(row[11]) || 0
    });
  }
  return holdings;
}

/**
 * Get all stock transactions across all portfolios
 */
function getAllStockTransactionsData() {
  var sheet = getSheet(CONFIG.stockTransactionsSheet);
  if (!sheet) return [];
  var lastRow = sheet.getLastRow();
  if (lastRow < 3) return [];
  var data = sheet.getRange(3, 1, lastRow - 2, sheet.getLastColumn()).getValues();
  var transactions = [];
  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    if (!row[0]) continue;
    transactions.push({
      transactionId: row[0],
      portfolioId: row[1],
      portfolioName: row[2] || '',
      symbol: row[3] || '',
      companyName: row[4] || '',
      type: row[5] || '',
      date: row[6] ? formatDate(row[6]) : '',
      quantity: parseFloat(row[7]) || 0,
      pricePerShare: parseFloat(row[8]) || 0,
      totalAmount: parseFloat(row[9]) || 0,
      brokerage: parseFloat(row[10]) || 0,
      netAmount: parseFloat(row[11]) || 0,
      realizedPL: parseFloat(row[12]) || 0,
      notes: row[13] || ''
    });
  }
  return transactions;
}

// ============================================================================
// SETTINGS HELPERS
// ============================================================================

/**
 * Get all settings as a flat key-value object.
 * Also includes masterDataLastSync from MasterDataSync.
 */
function getAllSettings() {
  var sheet = getSheet(CONFIG.settingsSheet);
  var result = {};

  if (sheet) {
    var lastRow = sheet.getLastRow();
    if (lastRow > 2) {
      var data = sheet.getRange(3, 1, lastRow - 2, 2).getValues();
      for (var i = 0; i < data.length; i++) {
        if (data[i][0]) {
          result[data[i][0]] = data[i][1];
        }
      }
    }
  }

  // Include sync freshness info
  result._stale = isMasterDataStale();

  // Include latest NAV date from MutualFundData
  try {
    var mfSheet = getSheet(CONFIG.mutualFundDataSheet);
    if (mfSheet && mfSheet.getLastRow() > 1) {
      // Read a sample of dates from column E (don't read all 8500 rows)
      var sampleDates = mfSheet.getRange(2, 5, Math.min(10, mfSheet.getLastRow() - 1), 1).getValues();
      for (var j = 0; j < sampleDates.length; j++) {
        if (sampleDates[j][0]) {
          var d = sampleDates[j][0];
          result._navDataDate = d instanceof Date ? d.toLocaleDateString('en-IN') : String(d);
          break;
        }
      }
    }
  } catch (e) {
    log('Error reading NAV date: ' + e.message);
  }

  return result;
}

/**
 * Update multiple settings at once.
 * @param {Object} params - key-value pairs, e.g. { EmailFrequency: 'Weekly', EmailHour: '10' }
 * @returns {Object} { updated: number }
 */
function updateAllSettings(params) {
  var emailSettings = ['EmailConfigured', 'EmailFrequency', 'EmailHour', 'EmailMinute', 'EmailDayOfWeek', 'EmailDayOfMonth'];
  var emailChanged = false;
  var count = 0;

  for (var key in params) {
    if (key.charAt(0) === '_') continue; // skip internal keys
    updateSetting(key, params[key]);
    count++;
    if (emailSettings.indexOf(key) !== -1) {
      emailChanged = true;
    }
  }

  // Reinstall email trigger if email settings changed
  if (emailChanged) {
    try {
      installEmailScheduleTrigger();
    } catch (e) {
      log('Error reinstalling email trigger: ' + e.message);
    }
  }

  return { updated: count };
}

// ============================================================================
// DIAGNOSTICS
// ============================================================================

/**
 * Run comprehensive diagnostics on the user's spreadsheet.
 * Checks sheet existence, structure, and sample data for each entity.
 */
function runDiagnostics() {
  var ss = getSpreadsheet();
  var diag = {
    spreadsheetId: ss.getId(),
    spreadsheetName: ss.getName(),
    spreadsheetUrl: ss.getUrl(),
    sheets: {},
    safeCallErrors: _safeCallErrors,
    dataTests: {}
  };

  // Check each expected sheet
  var sheetNames = [
    CONFIG.familyMembersSheet,
    CONFIG.bankAccountsSheet,
    CONFIG.investmentAccountsSheet,
    CONFIG.portfolioMetadataSheet,
    CONFIG.goalsSheet,
    CONFIG.insuranceSheet,
    CONFIG.liabilitiesSheet,
    CONFIG.otherInvestmentsSheet,
    CONFIG.remindersSheet,
    CONFIG.stockPortfoliosSheet,
    CONFIG.stockHoldingsSheet,
    CONFIG.transactionHistorySheet,
    CONFIG.stockTransactionsSheet,
    CONFIG.goalPortfolioMappingSheet,
    CONFIG.settingsSheet,
    CONFIG.mutualFundDataSheet,
    CONFIG.mfATHDataSheet,
    CONFIG.assetAllocationsSheet
  ];

  for (var i = 0; i < sheetNames.length; i++) {
    var name = sheetNames[i];
    var sheet = ss.getSheetByName(name);
    if (sheet) {
      var lastRow = sheet.getLastRow();
      var lastCol = sheet.getLastColumn();
      var row1 = lastRow >= 1 ? sheet.getRange(1, 1, 1, Math.min(lastCol || 1, 3)).getValues()[0] : [];
      var row2 = lastRow >= 2 ? sheet.getRange(2, 1, 1, Math.min(lastCol || 1, 5)).getValues()[0] : [];
      diag.sheets[name] = {
        exists: true,
        lastRow: lastRow,
        lastCol: lastCol,
        row1Preview: row1.map(String).join(' | '),
        row2Preview: row2.map(String).join(' | '),
        dataRows: Math.max(0, lastRow - 2)
      };
    } else {
      diag.sheets[name] = { exists: false };
    }
  }

  // Test each data function individually and capture errors
  var dataFunctions = {
    members: getAllFamilyMembers,
    bankAccounts: getAllBankAccounts,
    investments: getAllInvestmentAccounts,
    mfPortfolios: getAllPortfolios,
    goals: getAllGoals,
    insurancePolicies: getAllInsurancePolicies,
    liabilities: getAllLiabilities,
    otherInvestments: getAllInvestments,
    stockPortfolios: getAllStockPortfolios,
    reminders: getAllReminders
  };

  for (var key in dataFunctions) {
    try {
      var result = dataFunctions[key]();
      diag.dataTests[key] = {
        success: true,
        count: Array.isArray(result) ? result.length : (result ? 1 : 0)
      };
    } catch (e) {
      diag.dataTests[key] = {
        success: false,
        error: e.toString(),
        stack: e.stack || ''
      };
    }
  }

  // Add trigger info
  diag.triggers = checkUserTriggers();

  return diag;
}

/**
 * Check what triggers exist for the current user.
 * Each user can only see their own triggers.
 */
function checkUserTriggers() {
  var triggers = ScriptApp.getProjectTriggers();
  var result = {
    total: triggers.length,
    list: []
  };

  for (var i = 0; i < triggers.length; i++) {
    var t = triggers[i];
    result.list.push({
      function: t.getHandlerFunction(),
      type: t.getEventType().toString(),
      source: t.getTriggerSource().toString()
    });
  }

  result.hasDailySync = result.list.some(function(t) {
    return t.function === 'dailyUserSync';
  });

  return result;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Require owner role for an action
 */
function requireOwner(userRecord) {
  if (userRecord.role !== 'owner') {
    throw new Error('Only the family owner can perform this action.');
  }
}

// ============================================================================
// ADMIN UTILITIES (run from Script Editor by deployer)
// ============================================================================

/**
 * Set up the template spreadsheet with all sheets.
 * Run this once after creating a blank template spreadsheet.
 * Must be run by the deployer (who owns the template).
 */
function setupTemplateSpreadsheet() {
  _currentUserSpreadsheetId = WEBAPP_CONFIG.templateSpreadsheetId;
  log('Setting up template spreadsheet: ' + WEBAPP_CONFIG.templateSpreadsheetId);
  var results = createAllSheets();
  log('Template setup complete: ' + JSON.stringify(results));
}

/**
 * List all registered users in Script Properties.
 * Run from Script Editor → View > Logs to see output.
 */
function listAllUsers() {
  var props = PropertiesService.getScriptProperties();
  var all = props.getProperties();
  var users = [];

  for (var key in all) {
    if (key.indexOf('user:') === 0) {
      try {
        var record = JSON.parse(all[key]);
        var email = key.substring(5);
        users.push({
          email: email,
          displayName: record.displayName,
          role: record.role,
          status: record.status,
          spreadsheetId: record.spreadsheetId,
          createdDate: record.createdDate,
          lastLogin: record.lastLogin
        });
        Logger.log('User: ' + email + ' | Role: ' + record.role + ' | Status: ' + record.status + ' | Sheet: ' + record.spreadsheetId);
      } catch (e) {
        Logger.log('Malformed entry: ' + key);
      }
    }
  }

  Logger.log('Total users: ' + users.length);
  return users;
}

/**
 * Test triggers for the deployer's own account.
 * Shows all triggers installed on the project.
 * Run from Script Editor → View > Logs.
 */
function testMyTriggers() {
  var triggers = ScriptApp.getProjectTriggers();
  Logger.log('=== TRIGGER CHECK ===');
  Logger.log('Total triggers: ' + triggers.length);

  var hasDailySync = false;

  for (var i = 0; i < triggers.length; i++) {
    var t = triggers[i];
    var info = {
      handler: t.getHandlerFunction(),
      eventType: t.getEventType().toString(),
      triggerSource: t.getTriggerSource().toString(),
      id: t.getUniqueId()
    };
    Logger.log('Trigger ' + (i + 1) + ': ' + JSON.stringify(info));

    if (t.getHandlerFunction() === 'dailyUserSync') {
      hasDailySync = true;
    }
  }

  Logger.log('Has dailyUserSync trigger: ' + hasDailySync);

  if (!hasDailySync) {
    Logger.log('⚠ No dailyUserSync trigger found! Data will NOT auto-refresh.');
    Logger.log('Run testInstallDailyTrigger() to install it.');
  } else {
    Logger.log('✓ dailyUserSync trigger is active. Data will refresh daily at ~6:30 AM.');
  }

  return { total: triggers.length, hasDailySync: hasDailySync };
}

/**
 * Install the daily trigger for the deployer (for testing).
 * Run this if testMyTriggers() shows no dailyUserSync trigger.
 */
function testInstallDailyTrigger() {
  installDailyTriggerForUser();
  Logger.log('Daily trigger installed. Run testMyTriggers() to verify.');
}

/**
 * Test data refresh for a specific user by email.
 * Simulates what dailyUserSync() does for that user.
 * Run from Script Editor → View > Logs.
 *
 * @param {string} email - The user's email address
 */
function testRefreshForUser(email) {
  if (!email) {
    // Default to deployer's email
    email = Session.getEffectiveUser().getEmail();
  }

  Logger.log('=== TEST REFRESH FOR: ' + email + ' ===');

  // Look up user
  var userRecord = findUserByEmail(email);
  if (!userRecord) {
    Logger.log('ERROR: User not found in registry: ' + email);
    Logger.log('Run listAllUsers() to see all registered users.');
    return { success: false, error: 'User not found' };
  }

  Logger.log('User found: ' + userRecord.displayName + ' | Role: ' + userRecord.role + ' | Sheet: ' + userRecord.spreadsheetId);

  // Set context
  _currentUserSpreadsheetId = userRecord.spreadsheetId;

  // Check freshness
  var stale = isMasterDataStale();
  Logger.log('Data stale: ' + stale);

  // Check current data counts BEFORE refresh
  var beforeCounts = getDataCounts();
  Logger.log('BEFORE refresh — MF: ' + beforeCounts.mf + ' | ATH: ' + beforeCounts.ath + ' | Stocks: ' + beforeCounts.stocks);

  // Refresh
  Logger.log('Refreshing all master data...');
  var result = refreshAllMasterData();
  Logger.log('Refresh result: ' + JSON.stringify(result));

  // Check counts AFTER refresh
  var afterCounts = getDataCounts();
  Logger.log('AFTER refresh — MF: ' + afterCounts.mf + ' | ATH: ' + afterCounts.ath + ' | Stocks: ' + afterCounts.stocks);

  Logger.log('=== TEST COMPLETE ===');
  return {
    success: true,
    user: email,
    spreadsheetId: userRecord.spreadsheetId,
    wasStale: stale,
    before: beforeCounts,
    after: afterCounts,
    refreshResult: result
  };
}

/**
 * Helper: Get current row counts for master data sheets.
 */
function getDataCounts() {
  var ss = getSpreadsheet();
  var counts = { mf: 0, ath: 0, stocks: 0 };

  var mfSheet = ss.getSheetByName(CONFIG.mutualFundDataSheet);
  if (mfSheet) counts.mf = Math.max(0, mfSheet.getLastRow() - 1);

  var athSheet = ss.getSheetByName(CONFIG.mfATHDataSheet);
  if (athSheet) counts.ath = Math.max(0, athSheet.getLastRow() - 1);

  var stockSheet = ss.getSheetByName(CONFIG.stockMasterDataSheet);
  if (stockSheet) counts.stocks = Math.max(0, stockSheet.getLastRow() - 1);

  return counts;
}

/**
 * Full end-to-end test: signup → triggers → data refresh.
 * Run from Script Editor → View > Logs.
 */
function testFullFlow() {
  var email = Session.getEffectiveUser().getEmail();
  Logger.log('=== FULL FLOW TEST ===');
  Logger.log('Running as: ' + email);

  // Step 1: Check user registry
  Logger.log('\n--- Step 1: User Registry ---');
  var user = findUserByEmail(email);
  if (user) {
    Logger.log('✓ User registered: ' + user.displayName + ' (' + user.role + ')');
    Logger.log('  Spreadsheet: ' + user.spreadsheetId);
    Logger.log('  Status: ' + user.status);
    Logger.log('  Last login: ' + user.lastLogin);
  } else {
    Logger.log('✗ User NOT registered. Sign in via the app first.');
    return { success: false, error: 'Not registered' };
  }

  // Step 2: Check triggers
  Logger.log('\n--- Step 2: Triggers ---');
  var triggerResult = testMyTriggers();

  // Step 3: Check spreadsheet access
  Logger.log('\n--- Step 3: Spreadsheet Access ---');
  _currentUserSpreadsheetId = user.spreadsheetId;
  try {
    var ss = getSpreadsheet();
    Logger.log('✓ Can access spreadsheet: ' + ss.getName());
    var sheets = ss.getSheets();
    Logger.log('  Total sheets: ' + sheets.length);
    Logger.log('  Sheet names: ' + sheets.map(function(s) { return s.getName(); }).join(', '));
  } catch (e) {
    Logger.log('✗ Cannot access spreadsheet: ' + e.message);
    return { success: false, error: 'Spreadsheet access failed' };
  }

  // Step 4: Check data freshness & counts
  Logger.log('\n--- Step 4: Data Status ---');
  var stale = isMasterDataStale();
  Logger.log('Data stale: ' + stale);
  var counts = getDataCounts();
  Logger.log('MF records: ' + counts.mf);
  Logger.log('ATH records: ' + counts.ath);
  Logger.log('Stock records: ' + counts.stocks);

  // Step 5: Test refresh (only if stale or data is missing)
  if (stale || counts.mf === 0) {
    Logger.log('\n--- Step 5: Data Refresh ---');
    var refreshResult = refreshAllMasterData();
    Logger.log('Refresh result: ' + JSON.stringify(refreshResult));
    var afterCounts = getDataCounts();
    Logger.log('After refresh — MF: ' + afterCounts.mf + ' | ATH: ' + afterCounts.ath + ' | Stocks: ' + afterCounts.stocks);
  } else {
    Logger.log('\n--- Step 5: Skipped (data is fresh) ---');
  }

  Logger.log('\n=== FULL FLOW TEST COMPLETE ===');
  return { success: true, user: email, triggers: triggerResult, dataCounts: counts, stale: stale };
}

// ============================================================================
// END OF WEBAPP.JS
// ============================================================================
