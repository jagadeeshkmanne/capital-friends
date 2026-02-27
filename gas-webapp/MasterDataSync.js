/**
 * ============================================================================
 * MASTER DATA SYNC - Copy & Refresh Reference Data from Master DB
 * ============================================================================
 *
 * The master database (owned by the developer) contains public market data:
 * - MF_Data: ~8,500+ mutual fund NAVs, names, categories
 * - MF_ATH: All-Time High NAV tracking for mutual funds
 * - Stock_Data: ~5,292 NSE stocks
 *
 * IMPORTANT: Master DB must be shared as "Anyone with the link can view"
 * so that any authenticated user can read it via SpreadsheetApp.openById().
 *
 * Data flow:
 * 1. Master DB is updated daily by scheduled triggers (mfapi.in, NSE data)
 * 2. User's sheet gets a SNAPSHOT during signup (createAllSheets)
 * 3. On each app load (loadAllData), we check freshness and auto-refresh
 * 4. Users can also manually trigger a refresh
 *
 * ============================================================================
 */

// ============================================================================
// FRESHNESS CHECK
// ============================================================================

/**
 * Check if master data needs refreshing (older than 24 hours).
 * Uses the Settings sheet to track last sync timestamp.
 * @returns {boolean} true if data is stale and needs refresh
 */
function isMasterDataStale() {
  try {
    var sheet = getSheet(CONFIG.settingsSheet);
    if (!sheet) return true;

    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return true;

    var data = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
    for (var i = 0; i < data.length; i++) {
      if (data[i][0] === 'masterDataLastSync') {
        var lastSync = new Date(data[i][1]);
        var hoursSince = (Date.now() - lastSync.getTime()) / (1000 * 60 * 60);
        return hoursSince > 24;
      }
    }

    return true; // No sync timestamp found — needs refresh
  } catch (e) {
    log('Error checking data freshness: ' + e.message);
    return true;
  }
}

/**
 * Update the last sync timestamp in Settings sheet.
 */
function updateSyncTimestamp() {
  try {
    var sheet = getSheet(CONFIG.settingsSheet);
    if (!sheet) return;

    var lastRow = sheet.getLastRow();
    var found = false;

    if (lastRow >= 2) {
      var data = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
      for (var i = 0; i < data.length; i++) {
        if (data[i][0] === 'masterDataLastSync') {
          sheet.getRange(i + 2, 2).setValue(new Date().toISOString());
          found = true;
          break;
        }
      }
    }

    if (!found) {
      var newRow = Math.max(lastRow + 1, 2);
      sheet.getRange(newRow, 1, 1, 2).setValues([['masterDataLastSync', new Date().toISOString()]]);
    }
  } catch (e) {
    log('Error updating sync timestamp: ' + e.message);
  }
}

// ============================================================================
// OPEN MASTER DB (read-only)
// ============================================================================

/**
 * Open the master database spreadsheet (read-only).
 * Master DB must be shared as "Anyone with the link can view".
 * @returns {Spreadsheet} The master DB spreadsheet
 */
function openMasterDB() {
  return SpreadsheetApp.openById(CONFIG.masterDbId);
}

// ============================================================================
// COPY FUNCTIONS (called during sheet setup)
// ============================================================================

/**
 * Copy mutual fund data from master DB to user's MutualFundData sheet.
 * @param {Sheet} targetSheet - The user's MutualFundData sheet
 */
function copyMFDataFromMasterDB(targetSheet) {
  log('Copying MF data from master DB...');

  var masterDB = openMasterDB();
  var sourceSheet = masterDB.getSheetByName(CONFIG.masterMFDataSheet);

  if (!sourceSheet) {
    throw new Error('MF_Data sheet not found in master database');
  }

  var lastRow = sourceSheet.getLastRow();
  if (lastRow < 2) {
    log('Master DB MF_Data is empty');
    return;
  }

  var lastCol = Math.min(sourceSheet.getLastColumn(), 8); // Max 8 columns (A-H)

  // Read all data (skip header row — we already have headers)
  var data = sourceSheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  // Write to user's sheet (starting at row 2, after headers)
  if (data.length > 0) {
    targetSheet.getRange(2, 1, data.length, lastCol).setValues(data);
  }

  log('Copied ' + data.length + ' MF records from master DB');
}

/**
 * Copy ATH data from master DB to user's MF_ATH_Data sheet.
 * @param {Sheet} targetSheet - The user's MF_ATH_Data sheet
 */
function copyATHDataFromMasterDB(targetSheet) {
  log('Copying ATH data from master DB...');

  var masterDB = openMasterDB();
  var sourceSheet = masterDB.getSheetByName(CONFIG.masterATHSheet);

  if (!sourceSheet) {
    log('MF_ATH sheet not found in master DB — ATH data will be empty');
    return;
  }

  var lastRow = sourceSheet.getLastRow();
  if (lastRow < 2) {
    log('Master DB MF_ATH is empty');
    return;
  }

  // Read columns A-E (Scheme Code, Fund Name, ATH NAV, ATH Date, Last Checked)
  // Columns F (Current NAV) and G (% Below ATH) are ARRAYFORMULA in master DB
  // We'll read F and G as values (the formula result) and write as plain values
  var data = sourceSheet.getRange(2, 1, lastRow - 1, 7).getValues();

  // Write to user's sheet (all 7 columns as plain values)
  if (data.length > 0) {
    targetSheet.getRange(2, 1, data.length, 7).setValues(data);
  }

  log('Copied ' + data.length + ' ATH records from master DB');
}

/**
 * Copy stock data from master DB to user's StockMasterData sheet.
 * @param {Sheet} targetSheet - The user's StockMasterData sheet
 */
function copyStockDataFromMasterDB(targetSheet) {
  log('Copying stock data from master DB...');

  var masterDB = openMasterDB();
  var sourceSheet = masterDB.getSheetByName(CONFIG.masterStockDataSheet);

  if (!sourceSheet) {
    throw new Error('Stock_Data sheet not found in master database');
  }

  var lastRow = sourceSheet.getLastRow();
  if (lastRow < 2) {
    log('Master DB Stock_Data is empty');
    return;
  }

  var lastCol = Math.min(sourceSheet.getLastColumn(), 10); // Max 10 columns (A-J)

  // Read all data (skip header)
  var data = sourceSheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  // Write to user's sheet
  if (data.length > 0) {
    targetSheet.getRange(2, 1, data.length, lastCol).setValues(data);
  }

  log('Copied ' + data.length + ' stock records from master DB');
}

// ============================================================================
// REFRESH FUNCTIONS (called on demand or auto-refresh)
// ============================================================================

/**
 * Refresh mutual fund data from master DB.
 * Clears existing data and re-copies from master DB.
 * @returns {Object} { success, count }
 */
function refreshMutualFundData() {
  var sheet = getSheet(CONFIG.mutualFundDataSheet);
  if (!sheet) {
    throw new Error('MutualFundData sheet not found');
  }

  // Clear existing data (keep headers in row 1)
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clearContent();
  }

  // Re-copy from master DB
  copyMFDataFromMasterDB(sheet);

  var newLastRow = sheet.getLastRow();
  return { success: true, count: Math.max(0, newLastRow - 1) };
}

/**
 * Refresh ATH data from master DB.
 * @returns {Object} { success, count }
 */
function refreshATHData() {
  var sheet = getSheet(CONFIG.mfATHDataSheet);
  if (!sheet) {
    throw new Error('MF_ATH_Data sheet not found');
  }

  // Clear existing data (keep headers)
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clearContent();
  }

  // Re-copy from master DB
  copyATHDataFromMasterDB(sheet);

  var newLastRow = sheet.getLastRow();
  return { success: true, count: Math.max(0, newLastRow - 1) };
}

/**
 * Refresh stock data from master DB.
 * @returns {Object} { success, count }
 */
function refreshStockData() {
  var sheet = getSheet(CONFIG.stockMasterDataSheet);
  if (!sheet) {
    throw new Error('StockMasterData sheet not found');
  }

  // Clear existing data (keep headers)
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clearContent();
  }

  // Re-copy from master DB
  copyStockDataFromMasterDB(sheet);

  var newLastRow = sheet.getLastRow();
  return { success: true, count: Math.max(0, newLastRow - 1) };
}

/**
 * Refresh ALL master data (MF + ATH + Stocks).
 * Called automatically when data is stale (>24h), or manually by user.
 * @returns {Object} { success, mf, ath, stocks, duration }
 */
function refreshAllMasterData() {
  var startTime = Date.now();
  log('Starting full master data refresh...');

  var results = {
    mf: { success: false, count: 0 },
    ath: { success: false, count: 0 },
    stocks: { success: false, count: 0 }
  };

  try {
    results.mf = refreshMutualFundData();
  } catch (e) {
    log('Error refreshing MF data: ' + e.message);
    results.mf = { success: false, error: e.message };
  }

  try {
    results.ath = refreshATHData();
  } catch (e) {
    log('Error refreshing ATH data: ' + e.message);
    results.ath = { success: false, error: e.message };
  }

  try {
    results.stocks = refreshStockData();
  } catch (e) {
    log('Error refreshing stock data: ' + e.message);
    results.stocks = { success: false, error: e.message };
  }

  // Update sync timestamp
  updateSyncTimestamp();

  var duration = Math.round((Date.now() - startTime) / 1000);
  log('Master data refresh complete in ' + duration + 's');

  return {
    success: true,
    mf: results.mf,
    ath: results.ath,
    stocks: results.stocks,
    duration: duration + 's'
  };
}

/**
 * Auto-refresh master data if stale.
 * Called during loadAllData() — transparent to the user.
 * @returns {Object|null} Refresh results if refreshed, null if data was fresh
 */
function autoRefreshMasterDataIfStale() {
  if (!isMasterDataStale()) {
    return null; // Data is fresh, no refresh needed
  }

  log('Master data is stale (>24h). Auto-refreshing...');
  return refreshAllMasterData();
}

// ============================================================================
// DAILY TRIGGER (runs automatically for each user)
// ============================================================================

/**
 * Install data sync triggers for the current user.
 * Runs 4 times daily: 6 AM, 9 AM, 12 PM, 3 PM.
 * This ensures NAV data is always fresh throughout the trading day.
 * The trigger runs as the user who installed it — so it has access
 * to their spreadsheet automatically.
 *
 * Email is handled separately by sendScheduledDailyEmail trigger (Triggers.js).
 */
function installDailyTriggerForUser() {
  // Remove any existing sync triggers to avoid duplicates
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'dailyUserSync') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  // Create 4 daily sync triggers: 6 AM, 9 AM, 12 PM, 3 PM
  var syncHours = [6, 9, 12, 15];
  for (var h = 0; h < syncHours.length; h++) {
    ScriptApp.newTrigger('dailyUserSync')
      .timeBased()
      .atHour(syncHours[h])
      .nearMinute(0)
      .everyDays(1)
      .create();
  }
}

/**
 * Data sync handler — runs automatically via time-driven trigger (4x daily).
 * When triggered, Session.getEffectiveUser() returns the user who installed it.
 * This function ONLY syncs data — email is handled by a separate trigger.
 */
function dailyUserSync() {
  try {
    var email = Session.getEffectiveUser().getEmail();
    if (!email) {
      log('dailyUserSync: No user email available');
      return;
    }

    log('Data sync started for: ' + email);

    // Look up user in registry
    var userRecord = findUserByEmail(email);
    if (!userRecord || userRecord.status !== 'Active') {
      log('dailyUserSync: User not found or not active: ' + email);
      return;
    }

    // Set spreadsheet context
    _currentUserSpreadsheetId = userRecord.spreadsheetId;

    // Refresh master data (MF NAVs, ATH, Stocks)
    var result = refreshAllMasterData();
    log('Data sync complete for ' + email + ': ' + JSON.stringify(result));

  } catch (e) {
    log('dailyUserSync error: ' + e.toString());
  }
}

// ============================================================================
// END OF MASTERDATASYNC.JS
// ============================================================================
