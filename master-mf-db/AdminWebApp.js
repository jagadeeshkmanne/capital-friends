/**
 * ============================================================================
 * ADMIN WEB APP — Remote admin endpoint for Master DB
 * ============================================================================
 *
 * Allows gas-webapp to trigger admin operations on the Master DB via
 * UrlFetchApp POST requests, authenticated with a shared secret.
 *
 * Supported actions:
 *   refreshTrendlyne  — enrichWatchlistFromTrendlyne()
 *   refreshNifty      — refreshNiftyData()
 *   rescoreWatchlist   — _scoreAllWatchlistStocks()
 *   fullPipeline       — all three in sequence
 *
 * Setup:
 *   1. Run setAdminSecret() once from Script Editor
 *   2. Deploy as web app (Execute as: me, Access: Anyone)
 *   3. Store the secret + deployment URL in gas-webapp Script Properties
 */

// ============================================================================
// doPost — Main entry point
// ============================================================================

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
  } catch (parseErr) {
    return _jsonResponse({ success: false, error: 'Invalid JSON body' });
  }

  var secret = body.secret;
  var action = body.action;

  // --- Validate secret ---
  var storedSecret = PropertiesService.getScriptProperties().getProperty('ADMIN_API_SECRET');
  if (!storedSecret || secret !== storedSecret) {
    return _jsonResponse({ success: false, error: 'Unauthorized' });
  }

  if (!action) {
    return _jsonResponse({ success: false, error: 'Missing action parameter' });
  }

  // --- Route to action ---
  switch (action) {
    case 'refreshTrendlyne':
      return _runAction('refreshTrendlyne', function() {
        enrichWatchlistFromTrendlyne();
        return { refreshed: true };
      });

    case 'refreshNifty':
      return _runAction('refreshNifty', function() {
        refreshNiftyData();
        return { refreshed: true };
      });

    case 'rescoreWatchlist':
      return _runAction('rescoreWatchlist', function() {
        _scoreAllWatchlistStocks();
        return { rescored: true };
      });

    case 'fullPipeline':
      return _runFullPipeline();

    case 'status':
      return _runAction('status', function() {
        return getAdminStatus();
      });

    default:
      return _jsonResponse({ success: false, error: 'Unknown action: ' + action });
  }
}

// ============================================================================
// Action runners with timing
// ============================================================================

function _runAction(name, fn) {
  var start = new Date();
  try {
    var data = fn();
    var elapsed = ((new Date() - start) / 1000).toFixed(1);
    return _jsonResponse({
      success: true,
      action: name,
      data: data,
      elapsedSeconds: parseFloat(elapsed)
    });
  } catch (err) {
    var elapsed = ((new Date() - start) / 1000).toFixed(1);
    Logger.log('AdminWebApp error [' + name + ']: ' + err.message);
    return _jsonResponse({
      success: false,
      action: name,
      error: err.message,
      elapsedSeconds: parseFloat(elapsed)
    });
  }
}

function _runFullPipeline() {
  var start = new Date();
  var results = {};

  // Step 1: Trendlyne
  var t1 = new Date();
  try {
    enrichWatchlistFromTrendlyne();
    results.trendlyne = { success: true, seconds: parseFloat(((new Date() - t1) / 1000).toFixed(1)) };
  } catch (err) {
    results.trendlyne = { success: false, error: err.message, seconds: parseFloat(((new Date() - t1) / 1000).toFixed(1)) };
  }

  // Step 2: Nifty
  var t2 = new Date();
  try {
    refreshNiftyData();
    results.nifty = { success: true, seconds: parseFloat(((new Date() - t2) / 1000).toFixed(1)) };
  } catch (err) {
    results.nifty = { success: false, error: err.message, seconds: parseFloat(((new Date() - t2) / 1000).toFixed(1)) };
  }

  // Step 3: Score
  var t3 = new Date();
  try {
    _scoreAllWatchlistStocks();
    results.score = { success: true, seconds: parseFloat(((new Date() - t3) / 1000).toFixed(1)) };
  } catch (err) {
    results.score = { success: false, error: err.message, seconds: parseFloat(((new Date() - t3) / 1000).toFixed(1)) };
  }

  var totalElapsed = ((new Date() - start) / 1000).toFixed(1);
  var allOk = results.trendlyne.success && results.nifty.success && results.score.success;

  return _jsonResponse({
    success: allOk,
    action: 'fullPipeline',
    data: results,
    elapsedSeconds: parseFloat(totalElapsed)
  });
}

// ============================================================================
// getAdminStatus — Watchlist stats and last-update timestamps
// ============================================================================

function getAdminStatus() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var status = {
    lastTrendlyneUpdate: null,
    lastNiftyUpdate: null,
    watchlistCount: 0,
    eligibleCount: 0,
    coolingCount: 0,
    staleCount: 0,
    expiredCount: 0
  };

  // --- Read timestamps from Screener_Config ---
  try {
    var configSheet = ss.getSheetByName(SCREENER_CONFIG.sheets.config);
    if (configSheet) {
      var lastRow = configSheet.getLastRow();
      if (lastRow >= 2) {
        var configData = configSheet.getRange(2, 1, lastRow - 1, 2).getValues();
        for (var i = 0; i < configData.length; i++) {
          if (configData[i][0] === 'TRENDLYNE_LAST_UPDATED') {
            status.lastTrendlyneUpdate = configData[i][1];
          } else if (configData[i][0] === 'NIFTY_LAST_UPDATED') {
            status.lastNiftyUpdate = configData[i][1];
          }
        }
      }
    }
  } catch (e) {
    Logger.log('getAdminStatus config error: ' + e.message);
  }

  // --- Read watchlist stats ---
  try {
    var wlSheet = ss.getSheetByName(SCREENER_CONFIG.sheets.watchlist);
    if (wlSheet) {
      var lastRow = wlSheet.getLastRow();
      if (lastRow >= 2) {
        // Find Status column header
        var headers = wlSheet.getRange(1, 1, 1, wlSheet.getLastColumn()).getValues()[0];
        var statusCol = -1;
        for (var h = 0; h < headers.length; h++) {
          if (String(headers[h]).toLowerCase() === 'status') {
            statusCol = h;
            break;
          }
        }

        status.watchlistCount = lastRow - 1;

        if (statusCol >= 0) {
          var statuses = wlSheet.getRange(2, statusCol + 1, lastRow - 1, 1).getValues();
          for (var j = 0; j < statuses.length; j++) {
            var s = String(statuses[j][0]).toUpperCase();
            if (s === 'ELIGIBLE') status.eligibleCount++;
            else if (s === 'COOLING') status.coolingCount++;
            else if (s === 'STALE') status.staleCount++;
            else if (s === 'EXPIRED') status.expiredCount++;
          }
        }
      }
    }
  } catch (e) {
    Logger.log('getAdminStatus watchlist error: ' + e.message);
  }

  return status;
}

// ============================================================================
// setAdminSecret — One-time setup (run from Script Editor)
// ============================================================================

/**
 * Run this once from the Script Editor to generate and store the admin secret.
 * Copy the logged secret and store it in gas-webapp Script Properties as MASTER_DB_ADMIN_SECRET.
 */
function setAdminSecret() {
  var secret = Utilities.getUuid();
  PropertiesService.getScriptProperties().setProperty('ADMIN_API_SECRET', secret);
  Logger.log('Admin secret set: ' + secret);
  Logger.log('Store this in gas-webapp Script Properties as MASTER_DB_ADMIN_SECRET');
  return secret;
}

// ============================================================================
// Helper
// ============================================================================

function _jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
