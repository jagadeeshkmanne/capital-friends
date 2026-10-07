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

  // Read from the public master DB (no spreadsheets scope / Sheets API quota needed)
  var data = masterRows_(CONFIG.masterMFDataSheet, 8); // Max 8 columns (A-H)
  if (!data.length) { log('Master DB MF_Data is empty'); return 0; }
  var lastCol = data[0].length;

  // Write to user's sheet (starting at row 2, after headers)
  if (data.length > 0) {
    targetSheet.getRange(2, 1, data.length, lastCol).setValues(data);
  }

  log('Copied ' + data.length + ' MF records from master DB');
  return data.length;
}

/**
 * Copy ATH data from master DB to user's MF_ATH_Data sheet.
 * @param {Sheet} targetSheet - The user's MF_ATH_Data sheet
 */
function copyATHDataFromMasterDB(targetSheet) {
  log('Copying ATH data from master DB...');

  // Columns A-G (F and G are formula results in the master DB; we get their values)
  var data = masterRows_(CONFIG.masterATHSheet, 7);
  if (!data.length) { log('Master DB MF_ATH is empty'); return 0; }

  // Write to user's sheet (all 7 columns as plain values)
  if (data.length > 0) {
    targetSheet.getRange(2, 1, data.length, data[0].length).setValues(data);
  }

  log('Copied ' + data.length + ' ATH records from master DB');
  return data.length;
}

/**
 * Copy stock data from master DB to user's StockMasterData sheet.
 * @param {Sheet} targetSheet - The user's StockMasterData sheet
 */
function copyStockDataFromMasterDB(targetSheet) {
  log('Copying stock data from master DB...');

  var data = masterRows_(CONFIG.masterStockDataSheet, 10); // Max 10 columns (A-J)
  if (!data.length) { log('Master DB Stock_Data is empty'); return 0; }
  var lastCol = data[0].length;

  // Write to user's sheet
  if (data.length > 0) {
    targetSheet.getRange(2, 1, data.length, lastCol).setValues(data);
  }

  log('Copied ' + data.length + ' stock records from master DB');
  return data.length;
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

  // Clear existing data below the header (no need to read the big tab first)
  if (sheet.getMaxRows() > 1) {
    sheet.getRange(2, 1, sheet.getMaxRows() - 1, Math.min(8, sheet.getMaxColumns())).clearContent(); // data columns only
  }

  // Re-copy from master DB
  var count = copyMFDataFromMasterDB(sheet) || 0;
  return { success: true, count: count };
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

  // Clear existing data below the header (no need to read the big tab first)
  if (sheet.getMaxRows() > 1) {
    sheet.getRange(2, 1, sheet.getMaxRows() - 1, Math.min(7, sheet.getMaxColumns())).clearContent(); // data columns only
  }

  // Re-copy from master DB
  var count = copyATHDataFromMasterDB(sheet) || 0;
  return { success: true, count: count };
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

  // Clear existing data below the header (no need to read the big tab first)
  if (sheet.getMaxRows() > 1) {
    sheet.getRange(2, 1, sheet.getMaxRows() - 1, Math.min(10, sheet.getMaxColumns())).clearContent(); // data columns only
  }

  // Re-copy from master DB
  var count = copyStockDataFromMasterDB(sheet) || 0;
  return { success: true, count: count };
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

/**
 * Ensure user sync triggers match the current schedule (10, 13, 16).
 * If the user has old triggers (e.g., 6, 9, 12, 15), re-install them.
 * Uses a Settings flag to avoid checking every single load.
 */
function ensureSyncTriggersUpdated() {
  try {
    var sheet = getSheet(CONFIG.settingsSheet);
    if (!sheet) return;

    // Check if we already migrated triggers
    var lastRow = sheet.getLastRow();
    if (lastRow >= 2) {
      var data = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
      for (var i = 0; i < data.length; i++) {
        if (data[i][0] === 'syncTriggersVersion' && data[i][1] === 'v2') {
          return; // Already updated
        }
      }
    }

    // Re-install triggers with new schedule
    log('Migrating sync triggers to v2 schedule (10, 13, 16)...');
    installDailyTriggerForUser();

    // Mark as migrated
    var newRow = Math.max(sheet.getLastRow() + 1, 2);
    sheet.getRange(newRow, 1, 1, 2).setValues([['syncTriggersVersion', 'v2']]);
    log('Sync triggers migrated successfully');
  } catch (e) {
    log('ensureSyncTriggersUpdated error (non-blocking): ' + e.toString());
  }
}

// ============================================================================
// DAILY TRIGGER (runs automatically for each user)
// ============================================================================

/**
 * Install data sync triggers for the current user.
 * Runs 3 times daily: 10 AM, 1 PM, 4 PM (30 min after master DB refresh).
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

  // Create 3 daily sync triggers: 10 AM, 1 PM, 4 PM
  // Staggered 30 min after master DB refresh (9, 12, 15) to ensure fresh data
  var syncHours = [10, 13, 16];
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
 * Data sync handler — runs automatically via time-driven trigger (3x daily).
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
// SAFETY NET: refresh on app open when this user's copy is older than the master
// ============================================================================

/**
 * Called by the app in the background after the dashboard loads ('data:sync-if-stale').
 * Refreshes this user's MutualFundData / MF_ATH_Data / StockMasterData only if the master DB has
 * been refreshed since this user's last copy. Covers users whose background triggers did not run.
 * @returns {Object} { refreshed: boolean, reason, ...refreshAllMasterData() result when refreshed }
 */
function syncMasterDataIfStale() {
  var lastSync = getMasterDataLastSync_();
  var masterUpdated = null;
  try { masterUpdated = getMasterLastUpdated_(); } catch (e) { log('syncMasterDataIfStale: master time unavailable: ' + e.message); }

  var stale, reason;
  if (!lastSync) { stale = true; reason = 'never synced'; }
  else if (masterUpdated) { stale = masterUpdated.getTime() > lastSync.getTime(); reason = stale ? 'master updated ' + masterUpdated.toISOString() : 'up to date'; }
  else { stale = (Date.now() - lastSync.getTime()) > 8 * 3600 * 1000; reason = stale ? 'older than 8h' : 'recent'; } // master time unknown
  if (!stale) return { refreshed: false, reason: reason };

  // One refresh at a time per user (two open tabs must not both copy 15,000 rows)
  var lock = LockService.getUserLock();
  if (!lock.tryLock(1000)) return { refreshed: false, reason: 'refresh already running' };
  try {
    var result = refreshAllMasterData();
    result.refreshed = true;
    result.reason = reason;
    return result;
  } finally {
    lock.releaseLock();
  }
}

/** This user's last master-data copy time (Settings 'masterDataLastSync'), or null. */
function getMasterDataLastSync_() {
  try {
    var sheet = getSheet(CONFIG.settingsSheet);
    if (!sheet || sheet.getLastRow() < 2) return null;
    var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
    for (var i = 0; i < data.length; i++) {
      if (data[i][0] === 'masterDataLastSync') {
        var d = new Date(data[i][1]);
        return isNaN(d.getTime()) ? null : d;
      }
    }
  } catch (e) { log('getMasterDataLastSync_: ' + e.message); }
  return null;
}

/** When the master DB last refreshed its MF data (MF_Metadata 'Last Updated'). Cached 10 min for all users. */
function getMasterLastUpdated_() {
  var cache = CacheService.getScriptCache(), key = 'masterLastUpdated_v1';
  var hit = cache.get(key);
  if (hit) return new Date(+hit);
  var rows = masterRows_('MF_Metadata', 2);
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === 'Last Updated') {
      var d = rows[i][1] instanceof Date ? rows[i][1] : new Date(rows[i][1]);
      if (isNaN(d.getTime())) return null;
      cache.put(key, String(d.getTime()), 600);
      return d;
    }
  }
  return null;
}

// ============================================================================
// END OF MASTERDATASYNC.JS
// ============================================================================
