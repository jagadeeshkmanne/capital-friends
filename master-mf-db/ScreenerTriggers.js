/**
 * ============================================================================
 * SCREENER TRIGGERS — Split architecture to stay within GAS 6-minute limit
 * ============================================================================
 *
 * Old: dailyScreenerCheck() did everything in one run → timeout at 43+ stocks.
 *
 * New: Two-phase approach with auto-continuation:
 *   Phase 1 — screenerUpdateMarketData() at 9:00 AM
 *     Emails → watchlist prices → watchlist history (chunked) →
 *     holdings prices → holdings history (chunked) → Nifty data
 *     If time runs out, saves state and creates a 1-min continuation trigger.
 *
 *   Phase 2 — screenerGenerateSignals() at 9:45 AM
 *     Reads persisted Nifty data → BUY/ADD/EXIT signals →
 *     portfolio checks → BSE announcements → send emails
 *
 * SAFE: Only creates triggers for screener functions.
 * Does NOT modify existing triggers (refreshMutualFundData, dailyATHUpdate, etc.)
 */

// State key used in ScriptProperties for chunked continuation
var _MKT_STATE_KEY = 'SCREENER_MKT_STATE';
var _DATA_READY_KEY = 'SCREENER_DATA_READY';

// ============================================================================
// PHASE 1: MARKET DATA UPDATE (chunked, auto-continues)
// ============================================================================

/**
 * PHASE 1 ENTRY POINT — Called by daily trigger at 9:00 AM IST
 *
 * Processes market data in chunks. If it can't finish within 5 minutes,
 * it saves its position and creates a 1-minute continuation trigger.
 *
 * Phases: emails → trendlyne → watchlist (GOOGLEFINANCE fallback) → holdings → nifty → scoring → done
 */
function screenerUpdateMarketData() {
  var startTime = new Date();
  var MAX_MS = 300000; // 5 minutes (1 min buffer before GAS 6-min limit)
  var props = PropertiesService.getScriptProperties();

  // Load or initialize state
  var stateJson = props.getProperty(_MKT_STATE_KEY);
  var state = stateJson ? JSON.parse(stateJson) : { phase: 'emails', idx: 0 };

  Logger.log('=== screenerUpdateMarketData — phase: ' + state.phase + ', idx: ' + state.idx + ' ===');

  try {
    // --- PHASE: Email parsing — REPLACED by Trendlyne API ---
    // Old: parseTrendlyneAlerts() parsed screener alert emails to discover new stocks.
    // New: Trendlyne API download handles discovery, enrichment, and stale detection.
    if (state.phase === 'emails') {
      state.phase = 'trendlyne';
      state.idx = 0;
    }

    // --- PHASE: Trendlyne enrichment (fast — ~10s for all 3 screeners via API) ---
    // Does everything in one step:
    //   1. Fetches all 3 screeners (~4s each, 37 columns of data)
    //   2. Auto-discovers NEW stocks not yet in watchlist → adds with cooling period
    //   3. Enriches existing stocks: price, RSI, SMA50/200, returns, PE, ROE,
    //      Piotroski, D/E, sector, market cap, FII, promoter, and 10+ more columns
    //   4. Marks STALE stocks (not in any screener for 30+ days)
    //   5. Re-activates STALE stocks that re-appear in a screener
    // Stocks enriched here skip the slow GOOGLEFINANCE phase below.
    if (state.phase === 'trendlyne') {
      var remaining = MAX_MS - (new Date() - startTime);
      if (remaining < 30000) { _saveAndContinue(props, state); return; }

      if (hasTrendlyneCredentials()) {
        Logger.log('Enriching watchlist from Trendlyne (3 screeners)...');
        var tResult = enrichWatchlistFromTrendlyne();
        props.setProperty('TRENDLYNE_ENRICHED', JSON.stringify(tResult.enrichedSymbols));
        Logger.log('Trendlyne: ' + tResult.totalEnriched + ' enriched, ' +
          tResult.newStocks + ' new, ' + tResult.staleMarked + ' stale');

        // Send summary email if there were watchlist changes
        if (tResult.newStocks > 0 || tResult.staleMarked > 0) {
          _sendTrendlyneSummaryEmail(tResult);
        }
      } else {
        Logger.log('Trendlyne credentials not set — skipping, all stocks use GOOGLEFINANCE');
        props.setProperty('TRENDLYNE_ENRICHED', '[]');
      }
      state.phase = 'watchlist';
      state.idx = 0;
    }

    // --- PHASE: Watchlist market data via GOOGLEFINANCE (slow — ~6.5s per stock) ---
    // Only processes stocks NOT already enriched by Trendlyne.
    if (state.phase === 'watchlist') {
      var remaining = MAX_MS - (new Date() - startTime);
      if (remaining < 15000) { _saveAndContinue(props, state); return; }

      // Read Trendlyne skip list (symbols already enriched — skip GOOGLEFINANCE for these)
      var skipJson = props.getProperty('TRENDLYNE_ENRICHED');
      var skipSymbols = skipJson ? JSON.parse(skipJson) : [];

      Logger.log('Updating watchlist market data from index ' + state.idx +
        ' (skipping ' + skipSymbols.length + ' Trendlyne-enriched stocks)...');
      var wResult = updateMarketDataChunked(SCREENER_CONFIG.sheets.watchlist, {
        symbolCol: 1, priceCol: 9, rsiCol: 11, dma50Col: 12,
        dma200Col: 13, return6mCol: 15, return1wCol: 26, return1mCol: 27, return1yCol: 28,
        high52wCol: 36, drawdownCol: 37,  // AJ: 52W High, AK: Drawdown %
        avgTradedValCol: 40               // AN: Avg Daily Traded Value (Cr)
      }, state.idx, remaining - 10000, skipSymbols); // leave 10s buffer

      if (!wResult.done) {
        state.idx += wResult.processed;
        Logger.log('Watchlist paused at ' + state.idx + '/' + wResult.total);
        _saveAndContinue(props, state);
        return;
      }

      // Watchlist done — update found prices + price change %
      _updateWatchlistComputedColumns();

      state.phase = 'holdings';  // Skip mf_enrichment — Trendlyne handles fundamentals
      state.idx = 0;
    }

    // --- PHASE: Screener.in enrichment — REMOVED ---
    // Trendlyne now provides all fundamentals (PE, ROE, Piotroski, D/E, DII, etc.)
    // plus technical indicators (RSI, SMA50, SMA200) in a single fast API call.
    // Legacy Screener.in phase kept for manual re-enrichment only (reRunEnrichment).
    if (state.phase === 'mf_enrichment') {
      Logger.log('Screener.in enrichment skipped — Trendlyne handles fundamentals now');
      state.phase = 'holdings';
      state.idx = 0;
    }

    // Holdings phase removed — master DB no longer tracks holdings.
    // Per-user holdings are managed by gas-webapp/Screener.js
    if (state.phase === 'holdings') {
      state.phase = 'nifty';
      state.idx = 0;
    }

    // --- PHASE: Nifty + index data (~20s for 3 indices) ---
    if (state.phase === 'nifty') {
      var remaining = MAX_MS - (new Date() - startTime);
      if (remaining < 30000) { _saveAndContinue(props, state); return; }

      Logger.log('Fetching Nifty data...');
      var niftyData = getNiftyData();
      _persistNiftyData(niftyData);

      // Update watchlist columns P (Nifty 6M Return %) and Q (Relative Strength)
      _updateWatchlistBenchmarkColumns(niftyData);

      state.phase = 'scoring';
    }

    // --- PHASE: Factor scoring (fast — all data already in sheet) ---
    if (state.phase === 'scoring') {
      Logger.log('Scoring all watchlist stocks...');
      _scoreAllWatchlistStocks();
      state.phase = 'done';
    }

    // --- ALL DONE ---
    props.deleteProperty(_MKT_STATE_KEY);
    props.deleteProperty('TRENDLYNE_ENRICHED'); // clean up skip list
    props.setProperty(_DATA_READY_KEY, new Date().toISOString());

    // Clean up any leftover continuation triggers
    _removeContinuationTriggers();

    var duration = Math.round((new Date() - startTime) / 1000);
    Logger.log('=== Market data update complete in ' + duration + 's ===');

  } catch (error) {
    Logger.log('ERROR in screenerUpdateMarketData: ' + error.message);
    Logger.log('Stack: ' + error.stack);
    // Save state so next continuation can retry from where we failed
    _saveAndContinue(props, state);
    _sendErrorEmail('Market Data Update Failed', error.message);
  }
}

/**
 * Save state and create a 1-minute continuation trigger
 */
function _saveAndContinue(props, state) {
  props.setProperty(_MKT_STATE_KEY, JSON.stringify(state));
  Logger.log('Scheduling continuation in 1 min — phase: ' + state.phase + ', idx: ' + state.idx);

  // Clean up old continuation triggers before creating a new one
  _removeContinuationTriggers();

  // Create a one-off trigger to continue in 1 minute
  ScriptApp.newTrigger('screenerUpdateMarketData')
    .timeBased()
    .after(1 * 60 * 1000)
    .create();
}

/**
 * Remove one-off continuation triggers (created by _saveAndContinue).
 * Preserves the daily time-based trigger by checking trigger ID stored during install.
 */
function _removeContinuationTriggers() {
  var props = PropertiesService.getScriptProperties();
  var dailyTriggerId = props.getProperty('SCREENER_DAILY_TRIGGER_ID') || '';
  var triggers = ScriptApp.getProjectTriggers();
  var removed = 0;
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'screenerUpdateMarketData' &&
        triggers[i].getUniqueId() !== dailyTriggerId) {
      ScriptApp.deleteTrigger(triggers[i]);
      removed++;
    }
  }
  if (removed > 0) Logger.log('Removed ' + removed + ' continuation triggers (preserved daily ID: ' + dailyTriggerId + ')');
}

/**
 * Manual trigger cleanup — run this from Script Editor if you hit
 * "This script has too many triggers" error.
 * Only deletes screener-related triggers. Keeps ATH and other triggers intact.
 */
function cleanupScreenerTriggers() {
  var SCREENER_FUNCTIONS = [
    'screenerUpdateMarketData',
    'screenerGenerateSignals',
    'dailyScreenerCheck',
    'weeklyScreenerRecheck',
    'monthlySectorCheck'
  ];
  var triggers = ScriptApp.getProjectTriggers();
  var removed = 0;
  for (var i = 0; i < triggers.length; i++) {
    if (SCREENER_FUNCTIONS.indexOf(triggers[i].getHandlerFunction()) !== -1) {
      ScriptApp.deleteTrigger(triggers[i]);
      removed++;
    }
  }
  Logger.log('Removed ' + removed + ' screener triggers (kept ATH and other triggers)');
}

/**
 * Update watchlist computed columns (found price, price change %)
 * Extracted from updateWatchlistMarketData() in HoldingsMonitor.js
 */
function _updateWatchlistComputedColumns() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SCREENER_CONFIG.sheets.watchlist);
  if (!sheet) return;

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  var runupLimit = SCREENER_CONFIG.defaults.PRICE_RUNUP_EXPIRE_PCT || 20;
  var data = sheet.getRange(2, 1, lastRow - 1, 21).getValues(); // A-U (need col H=status, col U=notes)
  for (var i = 0; i < data.length; i++) {
    var row = i + 2;
    var foundPrice = parseFloat(data[i][3]);   // D: Found Price
    var status = String(data[i][7]).trim();     // H: Status
    var currentPrice = parseFloat(data[i][8]);  // I: Current Price

    // Set found price if missing
    if ((!foundPrice || foundPrice === 0) && currentPrice > 0) {
      sheet.getRange(row, 4).setValue(currentPrice);
      foundPrice = currentPrice;
    }

    // Compute price change since found
    if (foundPrice > 0 && currentPrice > 0) {
      var sinceFoundPct = Math.round(((currentPrice - foundPrice) / foundPrice) * 10000) / 100;
      sheet.getRange(row, 10).setValue(sinceFoundPct); // J: Price Change %

      // Expire stocks that ran up >20% — check during COOLING and NEW too (not just after cooling ends)
      if ((status === 'COOLING' || status === 'NEW' || status === 'ELIGIBLE') && sinceFoundPct > runupLimit) {
        sheet.getRange(row, 8).setValue('EXPIRED');  // H: Status
        sheet.getRange(row, 21).setValue('Price ran up ' + Math.round(sinceFoundPct) + '% since found'); // U: Notes
      }
    }
  }
}

/**
 * Update watchlist benchmark columns after Nifty data is available:
 *   P (col 16) = Nifty 6M Return %
 *   Q (col 17) = Relative Strength ("PASS" if stock 6M > Nifty 6M, else "FAIL")
 *   N (col 14) = Golden Cross ("YES" if 50DMA > 200DMA, else "NO")
 */
function _updateWatchlistBenchmarkColumns(niftyData) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SCREENER_CONFIG.sheets.watchlist);
  if (!sheet) return;

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  var nifty6m = niftyData.return6m;
  var midcap6m = niftyData.midcapReturn6m;
  var smallcap6m = niftyData.smallcapReturn6m;
  var aboveDMA200 = niftyData.aboveDMA200 === true ? 'YES' : (niftyData.aboveDMA200 === false ? 'NO' : '');

  // Read cols: O=15 (6M Return %), L=12 (50DMA), M=13 (200DMA), Y=25 (Cap Class)
  var data = sheet.getRange(2, 1, lastRow - 1, 28).getValues();
  var numRows = data.length;

  // Batch arrays: N=14, P=16, Q=17, S=19
  var colN = []; // Golden Cross
  var colP = []; // Nifty 6M Return %
  var colQ = []; // Relative Strength
  var colS = []; // Nifty >200DMA

  for (var i = 0; i < numRows; i++) {
    var stock6m = parseFloat(data[i][14]) || 0;      // O: 6M Return %
    var dma50 = parseFloat(data[i][11]) || 0;          // L: 50DMA
    var dma200 = parseFloat(data[i][12]) || 0;         // M: 200DMA
    var capClass = String(data[i][24]).trim().toUpperCase(); // Y: Cap Class

    // N: Golden Cross (50DMA > 200DMA)
    colN.push([dma50 > 0 && dma200 > 0 ? (dma50 > dma200 ? 'YES' : 'NO') : (data[i][13] || '')]);

    // P: Nifty 6M Return %
    colP.push([nifty6m !== null && nifty6m !== undefined ? nifty6m : '']);

    // Q: Relative Strength
    if (nifty6m !== null) {
      var beatsNifty = stock6m > nifty6m;
      var benchmark = nifty6m;
      if (capClass === 'MID' && midcap6m !== null) benchmark = midcap6m;
      else if (capClass === 'SMALL' && smallcap6m !== null) benchmark = smallcap6m;
      colQ.push([beatsNifty && (stock6m > benchmark) ? 'PASS' : 'FAIL']);
    } else {
      colQ.push([data[i][16] || '']);
    }

    // S: Nifty >200DMA
    colS.push([aboveDMA200]);
  }

  // Batch write all columns at once
  sheet.getRange(2, 14, numRows, 1).setValues(colN);  // N: Golden Cross
  sheet.getRange(2, 16, numRows, 1).setValues(colP);  // P: Nifty 6M
  sheet.getRange(2, 17, numRows, 1).setValues(colQ);  // Q: Relative Strength
  sheet.getRange(2, 19, numRows, 1).setValues(colS);  // S: Nifty >200DMA

  Logger.log('Watchlist benchmark columns updated (Golden Cross, Nifty 6M, Relative Strength, Nifty >200DMA)');
}

// _updateHoldingsComputedColumns() removed — master DB no longer tracks holdings.
// Per-user holdings computed columns are managed by gas-webapp/Screener.js


// ============================================================================
// PHASE 2: SIGNAL GENERATION (fast — no GOOGLEFINANCE calls)
// ============================================================================

/**
 * PHASE 2 — Signal generation removed from master DB.
 * Signals are now generated per-user by gas-webapp/Screener.js.
 *
 * This function is kept as a no-op so existing triggers don't error out.
 * Remove the 9:45 AM trigger when convenient (re-run installScreenerTriggers).
 */
function screenerGenerateSignals() {
  Logger.log('screenerGenerateSignals() — DEPRECATED. Signals are now per-user via gas-webapp.');
  var props = PropertiesService.getScriptProperties();
  props.deleteProperty(_DATA_READY_KEY);
}

/**
 * Read Nifty data from Screener_Config (persisted by Phase 1).
 * Avoids any GOOGLEFINANCE calls.
 */
function _readNiftyDataFromConfig() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SCREENER_CONFIG.sheets.config);
  if (!sheet) return _emptyNiftyData();

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return _emptyNiftyData();

  var data = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
  var kv = {};
  for (var i = 0; i < data.length; i++) {
    kv[String(data[i][0]).trim()] = data[i][1];
  }

  var price = parseFloat(kv['NIFTY_PRICE']) || null;
  var dma200 = parseFloat(kv['NIFTY_200DMA']) || null;

  return {
    price: price,
    dma200: dma200,
    aboveDMA200: price && dma200 ? price > dma200 : null,
    return1m: parseFloat(kv['NIFTY_RETURN_1M']) || null,
    return6m: parseFloat(kv['NIFTY_RETURN_6M']) || null,
    midcapReturn6m: parseFloat(kv['MIDCAP150_RETURN_6M']) || null,
    smallcapReturn6m: parseFloat(kv['SMALLCAP250_RETURN_6M']) || null
  };
}

function _emptyNiftyData() {
  return { price: null, dma200: null, aboveDMA200: null, return1m: null,
           return6m: null, midcapReturn6m: null, smallcapReturn6m: null };
}


// ============================================================================
// LEGACY WRAPPER (kept for manual testing — may timeout with 40+ stocks)
// ============================================================================

/**
 * Legacy single-run daily check — just runs market data update now.
 */
function dailyScreenerCheck() {
  screenerUpdateMarketData();
}


// ============================================================================
// WEEKLY / MONTHLY / QUARTERLY (unchanged)
// ============================================================================

/**
 * WEEKLY CHECK — Run on Sundays
 * Uses chunked market data to avoid timeout
 */
function weeklyScreenerRecheck() {
  Logger.log('=== Weekly Screener Recheck ===');

  try {
    // Reset state to start fresh
    var props = PropertiesService.getScriptProperties();
    props.deleteProperty(_MKT_STATE_KEY);
    props.deleteProperty(_DATA_READY_KEY);

    // Refresh watchlist market data
    screenerUpdateMarketData();
    Logger.log('Weekly recheck complete');
  } catch (error) {
    Logger.log('ERROR in weeklyScreenerRecheck: ' + error.message);
  }
}

/**
 * MONTHLY CHECK — Run on 1st of each month
 * Sector concentration alert at 35%
 */
function monthlySectorCheck() {
  Logger.log('=== Monthly Sector Check — DEPRECATED (per-user via gas-webapp) ===');
}

/**
 * QUARTERLY CHECK — Run every 3 months
 * Full fundamental re-check via Screener.in
 */
function quarterlyFundamentalCheck() {
  Logger.log('=== Quarterly Fundamental Check — DEPRECATED (per-user via gas-webapp) ===');
}


// ============================================================================
// TRIGGER MANAGEMENT
// ============================================================================

/**
 * Install all screener triggers (new split architecture)
 * - Phase 1: 9:00 AM — market data update (chunked)
 * - Phase 2: 9:45 AM — signal generation (fast)
 * - Weekly on Sunday, Monthly on 1st, Quarterly on 1st
 */
function installScreenerTriggers() {
  var ui = SpreadsheetApp.getUi();
  var response = ui.alert(
    'Install Screener Triggers',
    'This will install:\n\n' +
    'DAILY: 9:00 AM — Watchlist market data update (chunked, auto-continues)\n' +
    'WEEKLY: Sundays at 10:00 AM — Full recheck\n\n' +
    'Signal generation is per-user (gas-webapp).\n' +
    'Existing MF/ATH triggers will NOT be affected.\n\n' +
    'Continue?',
    ui.ButtonSet.YES_NO
  );

  if (response !== ui.Button.YES) return;

  _removeScreenerTriggers();

  // Daily: Market data at 9:00 AM
  var dailyTrigger = ScriptApp.newTrigger('screenerUpdateMarketData')
    .timeBased()
    .atHour(9)
    .nearMinute(0)
    .everyDays(1)
    .create();
  // Store trigger ID so _removeContinuationTriggers can preserve it
  PropertiesService.getScriptProperties().setProperty('SCREENER_DAILY_TRIGGER_ID', dailyTrigger.getUniqueId());

  // Weekly on Sunday
  ScriptApp.newTrigger('weeklyScreenerRecheck')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.SUNDAY)
    .atHour(10)
    .create();

  Logger.log('Screener triggers installed (watchlist + market data only)');

  ui.alert(
    'Triggers Installed',
    'Screener triggers are now active:\n\n' +
    'Daily: ~9:00 AM — Watchlist market data + Trendlyne enrichment\n' +
    'Weekly: Sundays — Full recheck\n\n' +
    'Signal generation is per-user via gas-webapp.',
    ui.ButtonSet.OK
  );
}

/**
 * Remove all screener triggers (doesn't touch MF/ATH triggers)
 */
function removeScreenerTriggers() {
  _removeScreenerTriggers();
  // Also clean up any state
  var props = PropertiesService.getScriptProperties();
  props.deleteProperty(_MKT_STATE_KEY);
  props.deleteProperty(_DATA_READY_KEY);
  SpreadsheetApp.getUi().alert('All screener triggers removed.');
}

function _removeScreenerTriggers() {
  var screenerFunctions = [
    'dailyScreenerCheck',
    'screenerUpdateMarketData',
    'screenerGenerateSignals',
    'weeklyScreenerRecheck',
    'monthlySectorCheck',
    'quarterlyFundamentalCheck'
  ];

  var triggers = ScriptApp.getProjectTriggers();
  var removed = 0;

  for (var i = 0; i < triggers.length; i++) {
    if (screenerFunctions.indexOf(triggers[i].getHandlerFunction()) !== -1) {
      ScriptApp.deleteTrigger(triggers[i]);
      removed++;
    }
  }

  Logger.log('Removed ' + removed + ' screener triggers');
}


// ============================================================================
// HELPERS
// ============================================================================

/**
 * Enrich watchlist with Screener.in fundamentals (one fetch per stock).
 * Writes: PE(AC=29), ROE(AD=30), Piotroski(AE=31), Profit Growth(AF=32),
 *         Debt/Equity(AG=33), DII%(AH=34), DII Change(AI=35)
 * Also updates Conviction (F=6) based on DII QoQ as MF overlay.
 * Chunked: processes stocks starting from startIdx within timeLimit.
 */

/** Public wrapper — run from Script Editor to re-enrich all stocks (Market Cap, Sector, fundamentals) */
function reRunEnrichment() {
  var result = _enrichWatchlistWithFundamentals(0, 300000);
  Logger.log('Enrichment result: ' + JSON.stringify(result));
  if (result.done) {
    Logger.log('All done! Now run _scoreAllWatchlistStocks() to re-score.');
  }
}

function _enrichWatchlistWithFundamentals(startIdx, timeLimitMs) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SCREENER_CONFIG.sheets.watchlist);
  if (!sheet) return { done: true, processed: 0, total: 0 };

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return { done: true, processed: 0, total: 0 };

  var total = lastRow - 1;
  var data = sheet.getRange(2, 1, total, 30).getValues(); // A-AD (includes Market Cap col X=24, PE col AC=29)
  var config = getAllScreenerConfig();
  var startTime = new Date();
  var processed = 0;
  var skipped = 0;

  for (var i = startIdx; i < total; i++) {
    if (new Date() - startTime > timeLimitMs) {
      return { done: false, processed: processed, total: total };
    }

    var sym = String(data[i][0]).trim();
    var status = String(data[i][7]).trim();
    if (!sym || status === 'EXPIRED') { processed++; continue; }

    // Skip stocks that already have Market Cap + PE filled (already enriched)
    var existingMcap = data[i][23]; // col X (0-indexed 23)
    var existingPE = data[i][28] || ''; // col AC (0-indexed 28)
    if (existingMcap && parseFloat(existingMcap) > 0) { processed++; skipped++; continue; }

    var row = i + 2;

    try {
      // One fetch per stock — gets PE, ROE, Piotroski, growth, D/E, DII all at once
      var f = fetchFundamentals(sym);
      if (!f) { processed++; continue; }

      // Write Market Cap + Cap Class (cols X=24, Y=25) — from same Screener.in fetch
      if (f.marketCapCr !== null) {
        sheet.getRange(row, 24).setValue(f.marketCapCr);                              // X: Market Cap (Cr)
        sheet.getRange(row, 25).setValue(f.capClass || '');                            // Y: Cap Class
      }

      // Write Sector (col R=18) if missing — from same Screener.in page
      if (f.sector) {
        var existingSector = String(sheet.getRange(row, 18).getValue()).trim();
        if (!existingSector) sheet.getRange(row, 18).setValue(f.sector);              // R: Sector
      }

      // Write fundamental columns AC-AI (cols 29-35)
      if (f.pe !== null) sheet.getRange(row, 29).setValue(f.pe);                     // AC: PE
      if (f.roe !== null) sheet.getRange(row, 30).setValue(f.roe);                   // AD: ROE %
      if (f.piotroski !== null) sheet.getRange(row, 31).setValue(f.piotroski);       // AE: Piotroski
      if (f.profitGrowth !== null) sheet.getRange(row, 32).setValue(f.profitGrowth); // AF: Profit Growth %
      if (f.debtToEquity !== null) sheet.getRange(row, 33).setValue(f.debtToEquity); // AG: Debt/Equity
      if (f.mfHolding !== null) sheet.getRange(row, 34).setValue(f.mfHolding);       // AH: DII Holding %
      if (f.mfChange !== null) sheet.getRange(row, 35).setValue(f.mfChange);         // AI: DII Change QoQ

      // MF overlay: update conviction column (F) for backward compatibility
      if (f.mfChange !== null) {
        var conviction = SCREENER_CONFIG.getConviction(f.mfChange, config);
        sheet.getRange(row, 6).setValue(conviction);
      }

      Logger.log(sym + ' → PE:' + f.pe + ' ROE:' + f.roe + ' Pio:' + f.piotroski +
        ' PG:' + f.profitGrowth + ' DE:' + f.debtToEquity + ' DII:' + f.mfHolding +
        ' DII∆:' + f.mfChange);
    } catch (e) {
      Logger.log('Enrichment failed for ' + sym + ': ' + e.message);
    }

    processed++;
    Utilities.sleep(2000); // Rate limiting for Screener.in
  }

  Logger.log('Screener.in enrichment complete: ' + processed + ' stocks processed');
  return { done: true, processed: processed, total: total };
}

/**
 * Score all watchlist stocks using 6-factor model.
 * Reads all data from sheet, calculates factor scores, writes Factor Score (AL=38) and Rank (AM=39).
 *
 * 5-Factor Model (weights from SCREENER_CONFIG.factorWeightsByRegime):
 *   Momentum — vol-adjusted 6M return (return / (1 + abs(drawdown)/100))
 *   Quality  — Piotroski + ROE + profit growth + D/E + promoter holding + revenue growth
 *   Trend    — RSI zone + golden cross + price vs 200DMA
 *   Value    — PE + P/B (inverted percentile, lower = better)
 *   LowVol   — small drawdown from 52W high
 *
 * Overlays: DII QoQ ±5-10% multiplier, multi-screener overlap boost.
 */

/**
 * Standalone: fetch Nifty data, persist to Screener_Config, update watchlist benchmarks.
 * Run this after fresh setup or when Nifty data is missing.
 */
function refreshNiftyData() {
  Logger.log('Fetching Nifty + benchmark data...');
  var niftyData = getNiftyData();
  Logger.log('Nifty: ₹' + niftyData.price + ', 200DMA: ' + niftyData.dma200 +
    ', Above: ' + niftyData.aboveDMA200 + ', 1M: ' + niftyData.return1m + '%, 6M: ' + niftyData.return6m + '%');
  Logger.log('Midcap 6M: ' + niftyData.midcapReturn6m + '%, Smallcap 6M: ' + niftyData.smallcapReturn6m + '%');
  _persistNiftyData(niftyData);
  _updateWatchlistBenchmarkColumns(niftyData);
  Logger.log('Nifty data persisted and watchlist benchmarks updated.');
}

function _scoreAllWatchlistStocks() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SCREENER_CONFIG.sheets.watchlist);
  if (!sheet) return;

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  var total = lastRow - 1;
  // Read all columns A-AX (50 cols) for scoring — includes Trendlyne enrichment
  // Column E (index 4) = Screeners Passing (e.g., "1", "1,2", "1,2,3")
  var data = sheet.getRange(2, 1, total, 50).getValues();

  var config = getAllScreenerConfig();

  // --- Determine market regime for dynamic factor weights ---
  var regime = 'caution'; // default fallback
  try {
    var configSheet = ss.getSheetByName(SCREENER_CONFIG.sheets.config);
    if (configSheet) {
      var cfgLastRow = configSheet.getLastRow();
      if (cfgLastRow >= 2) {
        var cfgData = configSheet.getRange(2, 1, cfgLastRow - 1, 2).getValues();
        var niftyPrice = null, niftyDma200 = null, niftyReturn6m = null, niftyAbove200 = null;
        for (var c = 0; c < cfgData.length; c++) {
          var key = String(cfgData[c][0]).trim();
          if (key === 'NIFTY_PRICE') niftyPrice = parseFloat(cfgData[c][1]) || null;
          else if (key === 'NIFTY_200DMA') niftyDma200 = parseFloat(cfgData[c][1]) || null;
          else if (key === 'NIFTY_RETURN_6M') niftyReturn6m = parseFloat(cfgData[c][1]) || null;
          else if (key === 'NIFTY_ABOVE_200DMA') niftyAbove200 = String(cfgData[c][1]).trim();
        }
        if (niftyAbove200 === 'TRUE') {
          regime = (niftyReturn6m !== null && niftyReturn6m >= 0) ? 'bull' : 'caution';
        } else if (niftyPrice && niftyDma200 && niftyDma200 > 0) {
          var pctBelow = ((niftyPrice - niftyDma200) / niftyDma200) * 100;
          regime = pctBelow > -5 ? 'correction' : 'bear';
        }
      }
    }
  } catch (e) {
    Logger.log('Regime detection failed, using caution: ' + e.message);
  }

  var regimeWeights = SCREENER_CONFIG.factorWeightsByRegime || {};
  var weights = regimeWeights[regime] || SCREENER_CONFIG.factorWeights || { momentum: 35, quality: 20, trend: 20, value: 10, lowVol: 15 };
  Logger.log('Market regime: ' + regime.toUpperCase() + ' → Weights: Mom=' + weights.momentum +
    ' Qual=' + weights.quality + ' Trend=' + weights.trend +
    ' Val=' + weights.value + ' LowVol=' + weights.lowVol);

  // --- Step 1: Collect raw values for relative scoring ---
  var stocks = [];
  for (var i = 0; i < total; i++) {
    var sym = String(data[i][0]).trim();
    if (!sym) continue;
    var status = String(data[i][7]).trim();
    if (status === 'EXPIRED') continue;

    // Count how many screeners this stock appears in (col E: "1", "1,2", "1,2,3")
    var screenersStr = String(data[i][4]).trim();
    var screenerCount = 0;
    if (screenersStr && screenersStr !== 'CF-Stock-Screener') {
      screenerCount = screenersStr.split(',').filter(function(s) { return s.trim() !== ''; }).length;
    } else if (screenersStr === 'CF-Stock-Screener') {
      screenerCount = 1; // legacy single screener
    }

    stocks.push({
      idx: i,
      symbol: sym,
      screenerCount: screenerCount,
      screenersStr: screenersStr,
      return6m: parseFloat(data[i][14]) || 0,       // O: 6M Return %
      rsi: parseFloat(data[i][10]) || 50,            // K: RSI
      dma50: parseFloat(data[i][11]) || 0,           // L: 50DMA
      dma200: parseFloat(data[i][12]) || 0,          // M: 200DMA
      currentPrice: parseFloat(data[i][8]) || 0,     // I: Current Price
      goldenCross: String(data[i][13]).trim(),        // N: YES/NO
      sector: String(data[i][17]).trim(),             // R: Sector
      pe: parseFloat(data[i][28]) || null,            // AC: PE
      roe: parseFloat(data[i][29]) || null,           // AD: ROE %
      piotroski: parseFloat(data[i][30]) || null,     // AE: Piotroski
      profitGrowth: parseFloat(data[i][31]) || null,  // AF: Profit Growth %
      debtToEquity: parseFloat(data[i][32]) || null,  // AG: Debt/Equity
      diiChange: parseFloat(data[i][34]) || null,     // AI: DII Change QoQ
      high52w: parseFloat(data[i][35]) || null,       // AJ: 52W High
      drawdown: parseFloat(data[i][36]) || null,      // AK: Drawdown %
      return1m: parseFloat(data[i][26]) || 0,           // AA: 1M Return %
      return1y: parseFloat(data[i][27]) || 0,         // AB: 1Y Return %
      // Trendlyne enrichment columns (AO-AX)
      priceToBook: parseFloat(data[i][45]) || null,   // AT: Price to Book
      opmQtr: parseFloat(data[i][46]) || null,        // AU: OPM Qtr %
      promoterHolding: parseFloat(data[i][48]) || null // AW: Promoter Holding %
    });
  }

  if (stocks.length === 0) return;

  // --- Step 2: Compute percentile ranks for relative factors ---

  // FIX 2: Pure blended momentum — NO drawdown here (LowVol owns volatility)
  var blendedReturnValues = stocks.map(function(s) {
    return 0.5 * s.return6m + 0.5 * s.return1y;
  });

  // FIX 3: Build sector-relative PE/PB pools for fair value comparison
  var sectorPE = {};  // { 'IT': [25,30,35], 'Banking': [8,10,12] }
  var sectorPB = {};
  for (var p = 0; p < stocks.length; p++) {
    var sec = stocks[p].sector || 'Unknown';
    if (!sectorPE[sec]) { sectorPE[sec] = []; sectorPB[sec] = []; }
    if (stocks[p].pe !== null && stocks[p].pe > 0) sectorPE[sec].push(stocks[p].pe);
    if (stocks[p].priceToBook !== null && stocks[p].priceToBook > 0) sectorPB[sec].push(stocks[p].priceToBook);
  }
  // Fallback: global pools for sectors with < 3 stocks
  var globalPE = stocks.filter(function(s) { return s.pe !== null && s.pe > 0; }).map(function(s) { return s.pe; });
  var globalPB = stocks.filter(function(s) { return s.priceToBook !== null && s.priceToBook > 0; }).map(function(s) { return s.priceToBook; });

  var drawdownValues = stocks.filter(function(s) { return s.drawdown !== null; }).map(function(s) { return s.drawdown; });

  // FIX 6: Compute return volatility (std dev of multi-period returns) for LowVol factor
  // Uses 1M, 6M, 1Y returns as a proxy for price choppiness
  var volatilityValues = stocks.map(function(s) {
    var returns = [s.return1m, s.return6m / 6, s.return1y / 12]; // normalize to monthly scale
    var mean = (returns[0] + returns[1] + returns[2]) / 3;
    var variance = returns.reduce(function(sum, r) { return sum + (r - mean) * (r - mean); }, 0) / 3;
    return Math.sqrt(variance); // monthly return std dev
  });

  // --- Step 3: Score each stock ---
  for (var j = 0; j < stocks.length; j++) {
    var s = stocks[j];

    // MOMENTUM (0-100): pure blended return — 50% × 6M + 50% × 1Y
    // FIX 2: Drawdown removed from momentum (LowVol is sole owner of volatility)
    // FIX 5: Cap at 80 if 1M return > 25% — prevents chasing late-stage vertical spikes
    var blendedReturn = 0.5 * s.return6m + 0.5 * s.return1y;
    var momentumScore = _percentileRank(blendedReturn, blendedReturnValues);
    if (s.return1m > 25) momentumScore = Math.min(momentumScore, 80);

    // QUALITY (0-100): 6 sub-factors — business strength & efficiency
    //   Piotroski (0-9 → 0-100)       weight: 0.25   — financial health
    //   ROE (capped at 30%)            weight: 0.20   — profitability
    //   Profit Growth %                weight: 0.15   — earnings power
    //   Debt/Equity (lower = better)   weight: 0.15   — leverage safety
    //   Promoter Holding (cap 75%)     weight: 0.15   — skin in the game
    //   OPM Qtr % (operating margin)   weight: 0.10   — FIX 4: replaces revenue growth (avoids growth double-count)
    var pioScore = s.piotroski !== null ? Math.min(s.piotroski / 9, 1) * 100 : 50;
    var roeScore = s.roe !== null ? Math.min(Math.max(s.roe, 0), 30) / 30 * 100 : 50;
    var pgScore = s.profitGrowth !== null ? Math.min(Math.max(s.profitGrowth, -20), 100) / 100 * 80 + 20 : 50;
    var deScore = s.debtToEquity !== null ? Math.max(0, 100 - s.debtToEquity * 100) : 50;
    var promScore = s.promoterHolding !== null ? Math.min(s.promoterHolding, 75) / 75 * 100 : 50;
    // FIX 4: OPM (operating margin) — measures efficiency, robust in bear markets
    var opmScore = s.opmQtr !== null ? Math.min(Math.max(s.opmQtr, 0), 40) / 40 * 100 : 50; // cap at 40%
    var qualityScore = (pioScore * 0.25 + roeScore * 0.20 + pgScore * 0.15 + deScore * 0.15 + promScore * 0.15 + opmScore * 0.10);

    // TREND (0-100): RSI zone + golden cross + price vs 200DMA
    // FIX 1: RSI scoring is regime-aware — smooth curves, no cliff effects
    //   Bull/Caution:     RSI 55-65 = best (strong trend), <30 = weak stock
    //   Correction/Bear:  RSI <30 = best (oversold reversal), >70 = overbought trap
    var rsiScore;
    if (regime === 'bull' || regime === 'caution') {
      // Bull: reward strength (trending stocks), penalize weakness
      if (s.rsi >= 55 && s.rsi <= 65) rsiScore = 95;
      else if (s.rsi >= 50 && s.rsi < 55) rsiScore = 85;
      else if (s.rsi > 65 && s.rsi <= 70) rsiScore = 75;
      else if (s.rsi >= 40 && s.rsi < 50) rsiScore = 55;
      else if (s.rsi > 70) rsiScore = 30;   // overbought — risky entry even in bull
      else if (s.rsi >= 30 && s.rsi < 40) rsiScore = 25;
      else rsiScore = 10;                    // RSI < 30 in bull = broken stock
    } else {
      // Correction/Bear: reward oversold (reversal opportunity), penalize overbought
      if (s.rsi < 30) rsiScore = 95;        // deeply oversold — best reversal entry
      else if (s.rsi >= 30 && s.rsi < 40) rsiScore = 85;
      else if (s.rsi >= 40 && s.rsi < 50) rsiScore = 65;
      else if (s.rsi >= 50 && s.rsi < 60) rsiScore = 45;
      else if (s.rsi >= 60 && s.rsi < 70) rsiScore = 25;
      else rsiScore = 10;                    // RSI > 70 in bear = overbought trap
    }

    var gcScore = s.goldenCross === 'YES' ? 100 : 0;
    var dmaScore = (s.dma200 > 0 && s.currentPrice > s.dma200) ? 100 : 0;
    var trendScore = (rsiScore * 0.40 + gcScore * 0.35 + dmaScore * 0.25);

    // VALUE (0-100): sector-relative PE + P/B (FIX 3)
    // Compare within sector, not across entire watchlist (banks vs IT is unfair)
    // Fallback to global pool if sector has < 3 stocks
    var sec = s.sector || 'Unknown';
    var pePool = (sectorPE[sec] && sectorPE[sec].length >= 3) ? sectorPE[sec] : globalPE;
    var pbPool = (sectorPB[sec] && sectorPB[sec].length >= 3) ? sectorPB[sec] : globalPB;

    var peScore = 50;
    if (s.pe !== null && s.pe > 0 && pePool.length > 0) {
      peScore = 100 - _percentileRank(s.pe, pePool);
    }
    var pbScore = 50;
    if (s.priceToBook !== null && s.priceToBook > 0 && pbPool.length > 0) {
      pbScore = 100 - _percentileRank(s.priceToBook, pbPool);
    }
    var valueScore = (peScore * 0.6 + pbScore * 0.4);

    // LOW VOLATILITY (0-100): 70% drawdown + 30% return volatility
    // FIX 6: Added choppiness measure — drawdown alone misses stocks that swing wildly but recover
    // Sole owner of volatility/risk measurement (removed from momentum in FIX 2)
    var drawdownScore = 50;
    if (s.drawdown !== null && drawdownValues.length > 0) {
      drawdownScore = 100 - _percentileRank(Math.abs(s.drawdown), drawdownValues.map(function(d) { return Math.abs(d); }));
    }
    var volScore = 50;
    if (volatilityValues.length > 0) {
      var returns = [s.return1m, s.return6m / 6, s.return1y / 12];
      var mean = (returns[0] + returns[1] + returns[2]) / 3;
      var variance = returns.reduce(function(sum, r) { return sum + (r - mean) * (r - mean); }, 0) / 3;
      var stdDev = Math.sqrt(variance);
      volScore = 100 - _percentileRank(stdDev, volatilityValues);
    }
    var lowVolScore = drawdownScore * 0.70 + volScore * 0.30;

    // --- Weighted composite score (5-factor, regime-aware) ---
    var rawScore = (
      momentumScore * weights.momentum +
      qualityScore * weights.quality +
      trendScore * weights.trend +
      valueScore * weights.value +
      lowVolScore * weights.lowVol
    ) / 100; // Normalize: sum of weights = 100

    // --- DII overlay: institutional flow as confidence signal ---
    // Raised thresholds to reduce noise (was ±0.5/1%, now ±2%)
    // FIX 7: Only apply DII boost if rawScore ≥ 60 — prevents weak stocks getting artificial boost
    // DII selling penalty (-5%) still applies to all stocks regardless of score
    var mfMultiplier = 1.0;
    if (s.diiChange !== null) {
      if (s.diiChange >= 2 && rawScore >= 60) mfMultiplier = 1.10;       // strong DII buying → +10%
      else if (s.diiChange >= 1 && rawScore >= 60) mfMultiplier = 1.05;   // moderate DII buying → +5%
      else if (s.diiChange < -2) mfMultiplier = 0.95;                     // DII selling → -5% (always applies)
    }

    // --- Overlap boost: stocks in multiple screeners get conviction boost ---
    // 2 screeners → ×1.10, 3 screeners → ×1.20
    var overlapBoost = SCREENER_CONFIG.getOverlapBoost(s.screenerCount);

    var finalScore = Math.round(Math.min(rawScore * mfMultiplier * overlapBoost, 100) * 10) / 10;
    stocks[j].factorScore = finalScore;
    // Store sub-scores for portfolio factor breakdown
    stocks[j].momentumScore = Math.round(momentumScore * 10) / 10;
    stocks[j].qualityScore = Math.round(qualityScore * 10) / 10;
    stocks[j].trendScore = Math.round(trendScore * 10) / 10;
    stocks[j].valueScore = Math.round(valueScore * 10) / 10;
    stocks[j].lowVolScore = Math.round(lowVolScore * 10) / 10;
  }

  // --- Step 4: Rank by factor score (descending) ---
  var ranked = stocks.slice().sort(function(a, b) { return b.factorScore - a.factorScore; });
  var rankMap = {};
  for (var r = 0; r < ranked.length; r++) {
    rankMap[ranked[r].symbol] = r + 1;
  }

  // --- Step 5: Batch write scores, ranks + sub-scores to sheet ---
  // AL=factorScore, AM=rank, AY=momentum, AZ=quality, BA=trend, BB=value, BC=lowVol
  var scoreData = [];
  var subScoreData = [];
  for (var k = 0; k < total; k++) {
    scoreData.push([null, null]);
    subScoreData.push([null, null, null, null, null]);
  }
  for (var k = 0; k < stocks.length; k++) {
    var st = stocks[k];
    scoreData[st.idx] = [st.factorScore, rankMap[st.symbol]];
    subScoreData[st.idx] = [st.momentumScore, st.qualityScore, st.trendScore, st.valueScore, st.lowVolScore];
  }
  sheet.getRange(2, 38, total, 2).setValues(scoreData); // AL-AM batch write
  sheet.getRange(2, 51, total, 5).setValues(subScoreData); // AY-BC batch write

  Logger.log('Factor scoring complete (5-factor v2.1, regime=' + regime + '): ' + stocks.length + ' stocks scored. Top 5: ' +
    ranked.slice(0, 5).map(function(s) { return s.symbol + '(' + s.factorScore + ')'; }).join(', '));
}

/**
 * Calculate percentile rank of a value within an array (0-100).
 * Higher = better rank among peers.
 */
function _percentileRank(value, allValues) {
  if (!allValues || allValues.length === 0) return 50;
  var below = 0;
  for (var i = 0; i < allValues.length; i++) {
    if (allValues[i] < value) below++;
  }
  return Math.round((below / allValues.length) * 100);
}

/**
 * Persist Nifty data to Screener_Config so gas-webapp + Phase 2 can read it
 */
function _persistNiftyData(niftyData) {
  try {
    var niftyKeys = [
      ['NIFTY_PRICE', niftyData.price, 'Nifty 50 current price'],
      ['NIFTY_200DMA', niftyData.dma200, 'Nifty 50 200-day moving average'],
      ['NIFTY_ABOVE_200DMA', niftyData.aboveDMA200 ? 'TRUE' : 'FALSE', 'Is Nifty above 200DMA'],
      ['NIFTY_RETURN_1M', niftyData.return1m, 'Nifty 1-month return %'],
      ['NIFTY_RETURN_6M', niftyData.return6m, 'Nifty 6-month return %'],
      ['MIDCAP150_RETURN_6M', niftyData.midcapReturn6m, 'Nifty Midcap 150 6-month return %'],
      ['SMALLCAP250_RETURN_6M', niftyData.smallcapReturn6m, 'Nifty Smallcap 250 6-month return %'],
      ['NIFTY_LAST_UPDATED', new Date().toISOString(), 'Last Nifty data update timestamp']
    ];

    for (var i = 0; i < niftyKeys.length; i++) {
      setScreenerConfigValue(niftyKeys[i][0], niftyKeys[i][1]);
    }

    Logger.log('Nifty data persisted to Screener_Config');
  } catch (e) {
    Logger.log('Error persisting Nifty data (non-fatal): ' + e.message);
  }
}

/**
 * Send daily Trendlyne summary email — what changed in the watchlist.
 * Only sent when there are new stocks, stale stocks, or re-activations.
 */
function _sendTrendlyneSummaryEmail(tResult) {
  try {
    var email = Session.getEffectiveUser().getEmail();
    if (!email) return;

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SCREENER_CONFIG.sheets.watchlist);
    if (!sheet) return;

    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return;

    // Read watchlist to find recently changed rows
    var data = sheet.getRange(2, 1, lastRow - 1, 23).getValues();
    var today = new Date();
    var todayStr = today.toDateString();

    var newStocks = [];
    var staleStocks = [];
    var reactivated = [];

    for (var i = 0; i < data.length; i++) {
      var sym = String(data[i][0]).trim();
      var name = String(data[i][1]).trim();
      var status = String(data[i][7]).trim();
      var notes = String(data[i][22]).trim();
      var lastUpdated = data[i][21];
      var screeners = String(data[i][4]).trim();

      // Check if updated today
      var isToday = lastUpdated instanceof Date && lastUpdated.toDateString() === todayStr;

      if (status === 'NEW' && notes === 'Auto-discovered from Trendlyne' && isToday) {
        newStocks.push(sym + ' (' + name + ') — ' + screeners);
      } else if (status === 'STALE' && isToday) {
        staleStocks.push(sym + ' (' + name + ')');
      } else if (status === 'ELIGIBLE' && String(data[i][20]).indexOf('Re-appeared') !== -1 && isToday) {
        reactivated.push(sym + ' (' + name + ')');
      }
    }

    if (newStocks.length === 0 && staleStocks.length === 0 && reactivated.length === 0) return;

    var body = 'Stock Screener Watchlist Update — ' + today.toLocaleDateString('en-IN') + '\n\n';
    body += 'Total enriched: ' + tResult.totalEnriched + ' stocks from Trendlyne\n\n';

    if (newStocks.length > 0) {
      body += '🟢 NEW STOCKS ADDED (' + newStocks.length + '):\n';
      body += newStocks.map(function(s) { return '  • ' + s; }).join('\n');
      body += '\n\n';
    }

    if (staleStocks.length > 0) {
      body += '🔴 MARKED STALE (' + staleStocks.length + '):\n';
      body += staleStocks.map(function(s) { return '  • ' + s; }).join('\n');
      body += '\n\n';
    }

    if (reactivated.length > 0) {
      body += '🔵 RE-ACTIVATED (' + reactivated.length + '):\n';
      body += reactivated.map(function(s) { return '  • ' + s; }).join('\n');
      body += '\n\n';
    }

    body += 'Check the Screener_Watchlist sheet for full details.';

    MailApp.sendEmail({
      to: email,
      subject: '[Stock Screener] ' +
        (newStocks.length > 0 ? newStocks.length + ' new' : '') +
        (newStocks.length > 0 && staleStocks.length > 0 ? ', ' : '') +
        (staleStocks.length > 0 ? staleStocks.length + ' stale' : '') +
        (reactivated.length > 0 ? ', ' + reactivated.length + ' re-activated' : ''),
      body: body
    });

    Logger.log('Trendlyne summary email sent');
  } catch (e) {
    Logger.log('Failed to send Trendlyne summary email: ' + e.message);
  }
}

/**
 * Send error notification email
 */
function _sendErrorEmail(subject, errorMsg) {
  try {
    var email = Session.getEffectiveUser().getEmail();
    if (email) {
      MailApp.sendEmail({
        to: email,
        subject: '[Stock Screener] ' + subject,
        body: 'Error: ' + errorMsg + '\n\nTime: ' + new Date() + '\n\nCheck Apps Script logs.'
      });
    }
  } catch (e) {
    Logger.log('Failed to send error email: ' + e.message);
  }
}

/**
 * Run Phase 1 manually (for testing)
 */
function manualUpdateMarketData() {
  // Clear any stale state first
  var props = PropertiesService.getScriptProperties();
  props.deleteProperty(_MKT_STATE_KEY);
  props.deleteProperty(_DATA_READY_KEY);
  screenerUpdateMarketData();
}

/**
 * Run Phase 2 manually (for testing)
 */
function manualGenerateSignals() {
  screenerGenerateSignals();
}

/**
 * Run both phases manually (may timeout with large watchlists)
 */
function manualDailyCheck() {
  dailyScreenerCheck();
}
