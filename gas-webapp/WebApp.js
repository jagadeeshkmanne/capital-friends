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
  // No template needed — createNewUser() creates a fresh spreadsheet
  // and runs createAllSheets() to build all sheets from code.
  // This ensures sheet structures are always in sync with the latest code.
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
  _inApiRequest = true; // Sheets API adapter batches all writes of this request
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

    // Family member who hasn't picked the owner's sheet in the Google Picker yet
    // (drive.file permission). React shows the Picker, then retries the same call.
    if (userRecord.needsFilePicker) {
      // Owner who really deleted their sheet: start over with a new one (asked in the app)
      if (action === 'auth:recreate-sheet' && userRecord.canRecreate && userRecord.role === 'owner') {
        var fresh = createNewUser(email, userRecord.displayName || userName);
        flushSheets_(); // send the new sheet's queued writes before answering
        return JSON.parse(JSON.stringify({ success: true, data: { recreated: true, spreadsheetId: fresh.spreadsheetId } }));
      }
      var isMember = userRecord.role === 'member';
      var owner = isMember && userRecord.invitedBy ? findUserByEmail(userRecord.invitedBy) : null;
      var titleName = isMember ? (owner && owner.displayName) : userRecord.displayName;
      return {
        success: false, code: 428, error: 'NEEDS_FILE_PICKER',
        needsFilePicker: true,
        spreadsheetId: userRecord.spreadsheetId,
        sheetTitle: titleName ? 'Capital Friends - ' + titleName : 'Capital Friends',
        ownerEmail: isMember ? (userRecord.invitedBy || '') : '',
        isOwner: !isMember,
        canRecreate: !!userRecord.canRecreate
      };
    }

    // Set spreadsheet context for all business logic functions
    _currentUserSpreadsheetId = userRecord.spreadsheetId;

    // Route to action handler
    var result = routeAction(action, params, userRecord);
    // a fund just bought / switched into / imported gets its row in the family's small fund list
    if (FUND_WRITE_ACTIONS_[action]) { try { ensureHeldFundsListed_(); } catch (e) { log('ensureHeldFundsListed_ after ' + action + ': ' + e.message); } }
    flushSheets_(); // send all queued sheet writes in one go

    // A save also sends back the updated lists it changed, so the app shows them without a second call
    // (and a separate reload can't race with the save). Old app versions simply ignore 'fresh'.
    var fresh = freshAfterWrite_(action);

    // Sanitize: strip non-serializable types (Date, Range, Sheet) for Execution API
    return JSON.parse(JSON.stringify(fresh ? { success: true, data: result, fresh: fresh } : { success: true, data: result }));

  } catch (error) {
    try { if (_ssAdapter) _ssAdapter.flush(); } catch (e2) { log('flush after error failed: ' + e2); }
    log('apiRouter error: ' + error.toString());
    return { success: false, error: error.message || 'Internal server error', stack: error.stack, code: 500 };
  }
}

var FUND_WRITE_ACTIONS_ = { 'mf:invest': 1, 'mf:switch': 1, 'mf:plan-batch': 1, 'mf:allocations-update': 1, 'portfolio:create': 1, 'portfolio:update': 1, 'import:save': 1, 'import:undo': 1, 'import:move-fund': 1 };

// Lists a save sends back: action prefix -> { app key: reader }. Mutual funds and stocks are not here
// (their values come from sheet formulas; the app reloads them as before).
var FRESH_AFTER_WRITE_ = {
  'member:': { members: 'getAllFamilyMembers' },
  'bank:': { bankAccounts: 'getAllBankAccounts' },
  'invacct:': { investments: 'getAllInvestmentAccounts' },
  'insurance:': { insurancePolicies: 'getAllInsurancePolicies' },
  'liability:': { liabilities: 'getAllLiabilities', otherInvestments: 'getAllInvestments' },
  'otherinv:': { otherInvestments: 'getAllInvestments', liabilities: 'getAllLiabilities' },
  'goal:create': { goals: 'getAllGoals', goalPortfolioMappings: 'getGoalPortfolioMappings' },
  'goal:update': { goals: 'getAllGoals', goalPortfolioMappings: 'getGoalPortfolioMappings' },
  'goal:delete': { goals: 'getAllGoals', goalPortfolioMappings: 'getGoalPortfolioMappings' },
  'goal:mappings-update': { goalPortfolioMappings: 'getGoalPortfolioMappings' },
  'reminder:': { reminders: 'getAllReminders' },
  'settings:update': { settings: 'getAllSettings' },
  'survey:': { settings: 'getAllSettings' },
  'income:': { otherInvestments: 'getAllInvestments', settings: 'getAllSettings' }
};

function FRESH_READERS_() {
  return {
    getAllFamilyMembers: getAllFamilyMembers, getAllBankAccounts: getAllBankAccounts, getAllInvestmentAccounts: getAllInvestmentAccounts,
    getAllInsurancePolicies: getAllInsurancePolicies, getAllLiabilities: getAllLiabilities, getAllInvestments: getAllInvestments,
    getAllGoals: getAllGoals, getGoalPortfolioMappings: getGoalPortfolioMappings, getAllReminders: getAllReminders, getAllSettings: getAllSettings
  };
}

/** The updated lists for a save (null for reads and for actions not listed). A failed read is just left out. */
function freshAfterWrite_(action) {
  var spec = null;
  for (var k in FRESH_AFTER_WRITE_) {
    if (k.charAt(k.length - 1) === ':' ? action.indexOf(k) === 0 && !/:list$/.test(action) : action === k) { spec = FRESH_AFTER_WRITE_[k]; break; }
  }
  if (!spec) return null;
  var out = {}, any = false;
  for (var key in spec) {
    try {
      var fn = FRESH_READERS_()[spec[key]];
      if (typeof fn !== 'function') continue;
      var v = fn();
      if (v !== undefined && v !== null) { out[key] = v; any = true; }
    } catch (e) { log('freshAfterWrite_ ' + key + ': ' + e.message); }
  }
  return any ? out : null;
}

// ============================================================================
// WEB APP ENTRY POINTS (health check / backward compat)
// ============================================================================

/**
 * Handle GET requests (health check and trigger installation popup)
 */
function doGet(e) {
  // Trigger Installation Popup Handler (the only place triggers can be created: the Apps Script API cannot create them)
  if (e && e.parameter && e.parameter.action === 'installTriggers') {
    return installTriggersPage_(e.parameter.expected || '');
  }

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
        spreadsheetId: userRecord.spreadsheetId,
        isNew: !!userRecord.isNew,
        isAdmin: Session.getActiveUser().getEmail() === CONFIG.adminEmail
      };

    case 'admin:paper-live':   // hidden admin page: live prices (Yahoo Finance) for the paper holdings and top-40 charts
      if (Session.getActiveUser().getEmail() !== CONFIG.adminEmail) throw new Error('Not available');
      return getPaperLive_(params.symbols || []);

    case 'admin:paper-book':   // hidden admin page: private paper-trading book (admin email only)
      if (Session.getActiveUser().getEmail() !== CONFIG.adminEmail) throw new Error('Not available');
      return getPaperBook_();

    case 'auth:shared-members':
      return getSharedMembers(userRecord.spreadsheetId);

    case 'auth:invite':
      requireOwner(userRecord);
      return inviteToFamily(userRecord, params.email, params.name);

    case 'auth:remove-member':
      requireOwner(userRecord);
      return removeFromFamily(userRecord, params.email);

    // ── Fast init: verify/create user spreadsheet, return immediately ──
    case 'data:init':
      return { spreadsheetId: userRecord.spreadsheetId, ready: true, isNewUser: userRecord.isNew === true };

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
    case 'portfolio:holdings': {
      var holdings = getPortfolioFunds(params.portfolioId);
      var catMap = buildFundCategoryMap();
      for (var ci = 0; ci < holdings.length; ci++) {
        holdings[ci].category = catMap[holdings[ci].fundCode] || 'Other';
      }
      return holdings;
    }

    case 'mf:invest':
      return processInvestment(params, params.transactionType || 'LUMPSUM');

    case 'mf:redeem':
      return processRedeem(params);

    case 'mf:redeem-bulk':
      return processRedeemBulk(params);

    case 'mf:switch':
      return processSwitchFunds(params);

    case 'mf:plan-batch':
      return processMutualFundPlan(params);

    case 'mf:allocations-update': {
      var portfolio = getPortfolioById(params.portfolioId);
      if (!portfolio) throw new Error('Portfolio not found: ' + params.portfolioId);
      var allocs = params.allocations || [];
      return savePortfolioAllocation({
        portfolioId: params.portfolioId,
        portfolioName: portfolio.portfolioName,
        fundsToUpdate: allocs.filter(function (a) { return !a.isNew; }).map(function (a) {
          return { schemeCode: a.schemeCode, fundName: a.fundName, targetPercent: a.targetAllocationPct };
        }),
        fundsToAdd: allocs.filter(function (a) { return a.isNew; }).map(function (a) {
          return { schemeCode: a.schemeCode, fundName: a.fundName, targetPercent: a.targetAllocationPct };
        })
      });
    }

    case 'mf:original-targets':
      return originalTargets(params.portfolioId, params.mode);

    case 'asset-allocation:save':
      return processAssetAllocation(params);

    case 'mf:lumpsum-restricted':
      return toggleFundLumpsumRestricted(params.portfolioId, params.fundCode, params.restricted);

    case 'mf:sip-restricted':
      return toggleFundSipRestricted(params.portfolioId, params.fundCode, params.restricted);

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
      return updateInsurancePolicy(params.policyId, params);

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

    case 'stocks:all':
      return getAllStocksForClientSearch();

    case 'stock:import':
      return importStockHoldings(params);

    case 'stock:import-trades':
      return importStockTrades(params);

    case 'stock:price':
      return fetchStockPrice(params.symbol);

    case 'stock:us-quote':
      return getUsQuote(params.symbol, params.date);

    case 'stock:quote':
      return getQuote(params.symbol, params.date);

    case 'stocks:us-list':
      return getUsStocksList();

    case 'stocks:delete-all':
      return deleteAllStocks(params);

    case 'stock-transaction:edit':
      return editStockTransaction(params.transactionId, params);

    case 'stock-transaction:delete':
      return deleteStockTransaction(params.transactionId);

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

    // ── Monthly retirement income (IncomePlan.js) ──
    case 'income:apply':        // take this month's income from savings / sweep-in FD (also run by the daily job)
      return applyMonthlyIncome(params);

    case 'income:refill-done':  // "Mark done" on a refill; money into savings is added to its balance
      return markRefillDone(params);

    // ── Settings ──
    case 'settings:list':
      return getAllSettings();

    case 'settings:update':
      return updateAllSettings(params);

    case 'survey:found-us':   // how did you hear about us, once per family (FoundUs.js)
      return saveFoundUs_(params, userRecord);

    case 'feedback:send':     // report a bug / request a feature, sent with the user's Gmail (FoundUs.js)
      return sendFeedback_(params, userRecord);

    // ── Master Data Refresh ──
    case 'data:refresh-master':
      return refreshAllMasterData();

    case 'data:check-freshness':
      return { stale: isMasterDataStale() };

    case 'data:sync-if-stale': { // background safety net on app open (see MasterDataSync.js)
      var syncRes = syncMasterDataIfStale();
      publishAppStats_(false); // at most every 6 h: landing page "families using" count (AppStats.js)
      return syncRes;
    }

    case 'triggers:status':      // are this user's daily update / email jobs switched on?
      return getMyDailyJobsStatus();

    case 'data:market': {
      var mp = getLiveMetalPrices();
      return {
        metals: [
          { name: 'Gold (24K/1g)', price: mp.gold24, changePct: 0 },
          { name: 'Silver (999/1g)', price: mp.silver999, changePct: 0 }
        ],
        asOf: mp.asOf, stale: !!mp.stale
      };
    }

    // ── Bulk Data (for targeted refresh) ──
    case 'mf-holdings:list':
      return getAllMFHoldings();

    case 'mf-transactions:list':
      return getAllMFTransactions();

    case 'mf-transaction:delete':
      return deleteTransaction(params.transactionId);

    case 'mf-transaction:edit':
      return editTransaction(params);

    case 'mf:delete-fund':
      return deleteFundFromPortfolio(params);

    case 'stock-holdings:list-all':
      return getAllStockHoldingsData();

    case 'stock-transactions:list-all':
      return getAllStockTransactionsData();

    // ── Reminder Notifications ──
    case 'reminder:test-email':
      return testReminderEmail();

    case 'reminder:check-now':
      checkAndSendReminders();
      return { success: true, message: 'Reminder check completed' };

    // ── Email Report (on-demand) ──
    case 'email:send-report-now':
      return sendDashboardEmailReport('manual', true);

    case 'email:send-dashboard-pdf': {
      // Accept base64 PDF from client and email to all configured recipients
      var pdfBase64 = params.pdfBase64;
      var fileName = params.fileName || 'Capital-Friends-Dashboard.pdf';
      if (!pdfBase64) return { success: false, error: 'No PDF data provided' };
      var recipients = getEmailRecipients();
      if (!recipients || recipients.length === 0) return { success: false, error: 'No email recipients configured' };
      var pdfBytes = Utilities.base64Decode(pdfBase64);
      var pdfBlob = Utilities.newBlob(pdfBytes, 'application/pdf', fileName);
      var pdfSizeKB = Math.round(pdfBytes.length / 1024);
      log('Dashboard PDF email: ' + pdfSizeKB + 'KB, recipients: ' + recipients.length);
      var subject = 'Capital Friends - Dashboard Report (' + new Date().toLocaleDateString('en-IN') + ')';
      var sent = 0;
      var errors = [];
      recipients.forEach(function (r) {
        try {
          GmailApp.sendEmail(r.email, subject, '', {
            htmlBody: '<p>Hi ' + (r.name || '') + ',</p><p>Please find attached your Capital Friends dashboard report.</p><p style="color:#888;font-size:12px;">Generated from <a href="https://capitalfriends.in">capitalfriends.in</a></p>',
            attachments: [pdfBlob]
          });
          sent++;
        } catch (e) {
          errors.push(r.email + ': ' + e.message);
          log('Email send failed to ' + r.email + ': ' + e.message);
        }
      });
      if (sent === 0 && errors.length > 0) {
        return { success: false, error: 'Failed to send: ' + errors[0], pdfSizeKB: pdfSizeKB };
      }
      return { success: true, sentCount: sent, totalRecipients: recipients.length, pdfSizeKB: pdfSizeKB };
    }

    // ── Statement import (beta, see CasImport.js; every action checks IMPORT_BETA_EMAILS) ──
    case 'import:enabled':
    case 'import:preview':
    case 'import:save':
    case 'import:status':
    case 'import:undo':
    case 'import:move-fund':
      return casImportRoute_(action, params);

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
  // Reset error collector for this load
  _safeCallErrors = [];

  // NOTE: Master data refresh (NAV, ATH) is no longer done here — it runs on a
  // scheduled daily trigger. This keeps loadAllData fast for all users.
  // Use 'data:refresh-master' action to trigger manually from the client.

  // Upgrade older Goals sheets before loading goal records.
  try {
    migrateGoalRetirementFields();
  } catch (e) {
    log('Goal retirement-field migration (non-blocking): ' + e.message);
  }

  // Realized P&L counts switch / STP profit too (one-time formula upgrade)
  try {
    migratePortfolioRealizedFormula_();
  } catch (e) {
    log('Realized P&L migration (non-blocking): ' + e.message);
  }

  // Sale profit uses the average cost of units still held (one-time recompute of past sales)
  try {
    migrateSellGainRunningAvg_();
  } catch (e) {
    log('Sale profit migration (non-blocking): ' + e.message);
  }

  // Ongoing SIP respects "SIP restricted" funds (one-time formula upgrade)
  try {
    migrateOngoingSipFormula_();
  } catch (e) {
    log('Ongoing SIP migration (non-blocking): ' + e.message);
  }

  // Migrate GoalPortfolioMapping to 7-column format if needed (transparent)
  try {
    migrateGoalMappingSheet();
  } catch (e) {
    log('Goal mapping migration (non-blocking): ' + e.message);
  }

  return {
    members: safeCall(getAllFamilyMembers),
    bankAccounts: safeCall(getAllBankAccounts),
    investments: safeCall(getAllInvestmentAccounts),
    mfPortfolios: safeCall(getAllPortfoliosStrict_),
    mfHoldings: safeCall(getAllMFHoldings),
    mfTransactions: safeCall(getAllMFTransactions),
    goals: safeCall(getAllGoals),
    goalPortfolioMappings: safeCall(getGoalPortfolioMappings),
    insurancePolicies: safeCall(getAllInsurancePolicies),
    liabilities: safeCall(getAllLiabilities),
    otherInvestments: safeCall(getAllInvestmentsStrict_),
    stockPortfolios: safeCall(getAllStockPortfoliosStrict_),
    stockHoldings: safeCall(getAllStockHoldingsData),
    stockTransactions: safeCall(getAllStockTransactionsData),
    reminders: safeCall(getAllReminders),
    assetAllocations: safeCall(getAllAssetAllocationsData),
    _errors: _safeCallErrors
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
 * Build a map of schemeCode → category from MutualFundData sheet
 */
function buildFundCategoryMap() {
  var sheet = getSheet(CONFIG.mutualFundDataSheet);
  if (!sheet || sheet.getLastRow() < 2) return {};
  var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 3).getValues(); // A=SchemeCode, B=Name, C=Category
  var map = {};
  for (var i = 0; i < data.length; i++) {
    if (data[i][0]) map[data[i][0].toString()] = data[i][2] || 'Other';
  }
  return map;
}

/** scheme code -> 'YYYY-MM-DD' of the NAV in the user's own MutualFundData tab ({} if it can't be read). */
function userNavDates_() {
  try {
    var res = casRetry_(function () {
      return Sheets.Spreadsheets.Values.batchGet(_currentUserSpreadsheetId, { ranges: ["'" + CONFIG.mutualFundDataSheet + "'!A2:A", "'" + CONFIG.mutualFundDataSheet + "'!E2:E"], valueRenderOption: 'UNFORMATTED_VALUE', dateTimeRenderOption: 'SERIAL_NUMBER' });
    });
    var a = (res.valueRanges[0] && res.valueRanges[0].values) || [], e = (res.valueRanges[1] && res.valueRanges[1].values) || [];
    var out = {};
    for (var i = 0; i < a.length; i++) {
      var code = a[i] && a[i][0], d = e[i] && e[i][0];
      if (code === undefined || code === '' || d === undefined || d === '') continue;
      var iso = '';
      if (typeof d === 'number') iso = new Date(Math.round((d - 25569) * 86400000)).toISOString().slice(0, 10);
      else { var t = new Date(d); if (!isNaN(t.getTime())) iso = Utilities.formatDate(t, Session.getScriptTimeZone(), 'yyyy-MM-dd'); }
      if (iso) out[String(parseInt(String(code), 10))] = iso;
    }
    return out;
  } catch (err) { log('userNavDates_: ' + err.message); return {}; }
}

/**
 * Get all MF holdings across all portfolios
 */
function getAllMFHoldings() {
  var portfolios = getAllPortfolios();
  log('getAllMFHoldings: found ' + portfolios.length + ' portfolios');

  var categoryMap = buildFundCategoryMap();
  var navDates = userNavDates_(); // the date of the NAV in the family's own fund list (shows if it is up to date)

  var allHoldings = [];
  for (var i = 0; i < portfolios.length; i++) {
    var p = portfolios[i];
    log('Portfolio ' + p.portfolioId + ' (' + p.portfolioName + ') status=' + p.status);
    if (p.status !== 'Inactive') {
      try {
        var holdings = getPortfolioFunds(p.portfolioId, portfolios);
        log('  -> holdings: ' + (holdings ? holdings.length : 'null'));
        if (holdings && holdings.length) {
          for (var j = 0; j < holdings.length; j++) {
            holdings[j].category = categoryMap[holdings[j].fundCode] || 'Other';
            var nd = navDates[String(parseInt(String(holdings[j].fundCode), 10))];
            if (nd) holdings[j].navDate = nd;
          }
          allHoldings = allHoldings.concat(holdings);
        }
      } catch (e) {
        log('Error getting holdings for ' + p.portfolioId + ': ' + e.toString());
      }
    }
  }
  log('getAllMFHoldings: returning ' + allHoldings.length + ' total holdings');
  return allHoldings;
}

/**
 * Get all asset allocation data from AssetAllocations sheet
 * Returns array of { fundCode, fundName, assetAllocation, equityAllocation }
 */
function getAllAssetAllocationsData() {
  var sheet = getSheet(CONFIG.assetAllocationsSheet);
  if (!sheet || sheet.getLastRow() < 3) return [];
  var cols = Math.max(sheet.getLastColumn(), 5);
  var data = sheet.getRange(3, 1, sheet.getLastRow() - 2, cols).getValues();
  var allocations = [];
  for (var i = 0; i < data.length; i++) {
    if (!data[i][0]) continue;
    var assetAlloc = null, equityAlloc = null, geoAlloc = null;
    try { if (data[i][2]) assetAlloc = JSON.parse(data[i][2]); } catch (e) { }
    try { if (data[i][3]) equityAlloc = JSON.parse(data[i][3]); } catch (e) { }
    try { if (data[i][4]) geoAlloc = JSON.parse(data[i][4]); } catch (e) { }
    allocations.push({
      fundCode: data[i][0].toString(),
      fundName: data[i][1] || '',
      assetAllocation: assetAlloc,
      equityAllocation: equityAlloc,
      geoAllocation: geoAlloc
    });
  }
  return allocations;
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
      portfolioId: row[0],                       // A
      portfolioName: row[1] || '',               // B
      symbol: row[2] || '',                      // C
      companyName: row[3] || '',                 // D
      exchange: row[4] || 'NSE',                 // E
      gfSymbol: row[5] || '',                    // F
      quantity: parseFloat(row[6]) || 0,         // G
      avgBuyPrice: parseFloat(row[7]) || 0,      // H
      totalInvestment: parseFloat(row[8]) || 0,  // I
      currentPrice: parseFloat(row[9]) || 0,     // J
      currentValue: parseFloat(row[10]) || 0,    // K
      unrealizedPL: parseFloat(row[11]) || 0,    // L
      unrealizedPLPct: parseFloat(row[12]) || 0, // M
      sector: row[13] || '',                     // N
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
      transactionId: row[0],       // A
      portfolioId: row[1],         // B
      portfolioName: row[2] || '', // C
      symbol: row[3] || '',        // D
      companyName: row[4] || '',   // E
      exchange: row[5] || '',      // F
      gfSymbol: row[6] || '',      // G
      type: row[7] || '',          // H
      date: row[8] ? formatDate(row[8]) : '', // I
      quantity: parseFloat(row[9]) || 0,       // J
      pricePerShare: parseFloat(row[10]) || 0, // K
      totalAmount: parseFloat(row[11]) || 0,   // L
      brokerage: parseFloat(row[12]) || 0,     // M
      netAmount: parseFloat(row[13]) || 0,     // N
      notes: row[14] || '',                    // O
      realizedPL: parseFloat(row[15]) || 0     // P
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
  var reminderSettings = ['ReminderNotificationsEnabled', 'ReminderCheckHour'];
  var emailChanged = false;
  var reminderChanged = false;
  var count = 0;

  for (var key in params) {
    if (key.charAt(0) === '_') continue; // skip internal keys
    updateSetting(key, params[key]);
    count++;
    if (emailSettings.indexOf(key) !== -1) {
      emailChanged = true;
    }
    if (reminderSettings.indexOf(key) !== -1) {
      reminderChanged = true;
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

  // Reinstall reminder trigger if reminder settings changed
  if (reminderChanged) {
    try {
      installReminderTrigger();
    } catch (e) {
      log('Error reinstalling reminder trigger: ' + e.message);
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

  result.hasDailySync = result.list.some(function (t) {
    return t.function === 'dailyUserSync';
  });
  result.hasEmailTrigger = result.list.some(function (t) {
    return t.function === 'sendScheduledDailyEmail';
  });
  result.hasReminderTrigger = result.list.some(function (t) {
    return t.function === 'checkAndSendReminders';
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
// END OF WEBAPP.JS
// ============================================================================


// ============================================================================
// TRIGGER INSTALL PAGE
// ============================================================================
// Opened from the app in a new window/tab while signed in. Runs as the accessing user, so the triggers land in
// that user's account. It checks the account matches the one signed into the app, installs the daily sync, the
// email schedule and the reminders, and then shows what is actually installed (never "Setup complete" blindly).
function installTriggersPage_(expected) {
  var P = 'font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;background:#0c1222;color:#e2e8f0;margin:0;padding:28px 22px;text-align:center';
  var box = function (title, color, body) {
    return '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Capital Friends</title></head><body style="' + P + '">' +
      '<div style="font-size:13px;letter-spacing:2px;color:#64748b;margin-bottom:10px">CAPITAL FRIENDS</div><h2 style="color:' + color + ';margin:0 0 12px;font-size:20px">' + title + '</h2>' + body + '</body></html>';
  };
  var esc = function (t) { return String(t || '').replace(/&/g, '&amp;').replace(/</g, '&lt;'); };
  try {
    var email = Session.getActiveUser().getEmail();
    if (!email) return HtmlService.createHtmlOutput(box('Please sign in', '#f59e0b', '<p>This window must be signed into a Google account. Sign in and try again from the app.</p>'));
    var self = ScriptApp.getService().getUrl() + '?action=installTriggers&expected=' + encodeURIComponent(expected || '');
    if (expected && expected.toLowerCase() !== email.toLowerCase()) {
      var chooser = 'https://accounts.google.com/AccountChooser?Email=' + encodeURIComponent(expected) + '&continue=' + encodeURIComponent(self);
      return HtmlService.createHtmlOutput(box('Wrong Google account', '#f59e0b',
        '<p style="color:#94a3b8">This window opened as <b style="color:#fff">' + esc(email) + '</b>, but the app is signed in as <b style="color:#fff">' + esc(expected) + '</b>. The daily updates must be installed on the same account.</p>' +
        '<p><a href="' + chooser + '" style="display:inline-block;background:#10b981;color:#06281b;font-weight:700;padding:10px 18px;border-radius:8px;text-decoration:none">Switch to ' + esc(expected) + '</a></p>'));
    }
    var userRecord = findUserByEmail(email);
    if (!userRecord || !userRecord.spreadsheetId) {
      return HtmlService.createHtmlOutput(box('Account not set up yet', '#f59e0b', '<p style="color:#94a3b8">Open the app once with <b style="color:#fff">' + esc(email) + '</b> so your sheet is created, then press Turn on again.</p>'));
    }
    _currentUserSpreadsheetId = userRecord.spreadsheetId;

    // permissions: if the user unticked a scope on Google's consent screen, triggers would fail silently later
    var auth = ScriptApp.getAuthorizationInfo(ScriptApp.AuthMode.FULL);
    if (auth.getAuthorizationStatus() === ScriptApp.AuthorizationStatus.REQUIRED) {
      return HtmlService.createHtmlOutput(box('One more permission needed', '#f59e0b',
        '<p style="color:#94a3b8">Google needs your OK for the app to run in the background and send the family email.</p>' +
        '<p><a href="' + auth.getAuthorizationUrl() + '" target="_blank" style="display:inline-block;background:#10b981;color:#06281b;font-weight:700;padding:10px 18px;border-radius:8px;text-decoration:none">Allow and continue</a></p>' +
        '<p style="color:#64748b;font-size:13px">Tick every box on the Google screen, then come back here and <a href="' + self + '" style="color:#34d399">check again</a>.</p>'));
    }

    // email schedule needs the EmailConfigured setting; older sheets never had it -> default to daily 9 AM
    var cfg = getSetting('EmailConfigured');
    if (cfg === null || cfg === '') { updateSetting('EmailConfigured', 'TRUE'); if (!getSetting('EmailFrequency')) updateSetting('EmailFrequency', 'Daily'); }

    var problems = [];
    try { installDailyTriggerForUser(); } catch (e1) { problems.push('Price updates: ' + e1.message); }
    try { installTriggers(false); } catch (e2) { problems.push('Email / reminders: ' + e2.message); }

    var st = checkUserTriggers();
    var row = function (ok, label, sub) {
      return '<tr><td style="padding:8px 10px;text-align:left"><span style="display:inline-block;width:10px;height:10px;border-radius:5px;background:' + (ok ? '#34d399' : '#f59e0b') + ';margin-right:10px"></span><b>' + label + '</b><div style="color:#94a3b8;font-size:12px;margin-left:20px">' + sub + '</div></td><td style="padding:8px 10px;color:' + (ok ? '#34d399' : '#f59e0b') + ';font-weight:700">' + (ok ? 'ON' : 'OFF') + '</td></tr>';
    };
    var emailOff = (String(getSetting('EmailConfigured')).toUpperCase() !== 'TRUE');
    var html = '<p style="color:#94a3b8;margin:0 0 14px">Installed for <b style="color:#fff">' + esc(email) + '</b></p>' +
      '<table style="margin:0 auto;border-collapse:collapse;background:#111c33;border-radius:10px;min-width:300px">' +
      row(st.hasDailySync, 'Daily price updates', 'fund NAVs, highs and the gold rate, 3 times a day') +
      row(st.hasEmailTrigger, 'Family email', emailOff ? 'switched off in Settings > Email reports' : 'at the time you chose in Settings') +
      row(st.hasReminderTrigger, 'Reminders', 'SIP dates, premiums, FD maturities') + '</table>';
    if (problems.length) html += '<p style="color:#fca5a5;font-size:13px;margin-top:14px">' + problems.map(esc).join('<br>') + '</p>';
    var allOk = st.hasDailySync && st.hasReminderTrigger && (st.hasEmailTrigger || emailOff) && !problems.length;
    html += allOk
      ? '<p style="color:#94a3b8;font-size:13px;margin-top:16px">All set. This window closes by itself.</p><script>setTimeout(function(){ try { window.close(); } catch(e){} }, 3500);</script>'
      : '<p style="color:#94a3b8;font-size:13px;margin-top:16px">Something is still off. <a href="' + self + '" style="color:#34d399">Try again</a> or write to capital.friends.dev@gmail.com with this screen.</p>';
    return HtmlService.createHtmlOutput(box(allOk ? 'Daily updates are on' : 'Partly installed', allOk ? '#4ade80' : '#f59e0b', html));
  } catch (err) {
    log('Trigger popup error: ' + err.toString());
    return HtmlService.createHtmlOutput(box('Could not install', '#f87171', '<p style="color:#94a3b8">' + esc(err.message) + '</p><p style="color:#64748b;font-size:13px">Try again from Settings. If it keeps failing, write to capital.friends.dev@gmail.com.</p>'));
  }
}
