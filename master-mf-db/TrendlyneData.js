/**
 * ============================================================================
 * TRENDLYNE DATA — Fetch fundamental data from Trendlyne (paid subscription)
 * ============================================================================
 *
 * Uses Trendlyne's internal data-downloader API to fetch enriched fundamental
 * data: Piotroski F-Score, Debt/Equity, ROE, PE, Interest Coverage, etc.
 *
 * Auth: Session cookie + CSRF token stored in Script Properties (never in code).
 * Setup: Run setTrendlyneCredentials() once from Script Editor.
 *
 * Usage:
 *   1. setTrendlyneCredentials(session, csrf) — one-time setup
 *   2. fetchTrendlyneScreenerData(screenId) — fetch data for a screener
 *   3. enrichWatchlistFromTrendlyne() — update watchlist with Trendlyne data
 */

// ============================================================================
// CREDENTIAL MANAGEMENT (Script Properties — encrypted, not in code)
// ============================================================================

/**
 * One-time setup — run from Script Editor with your Trendlyne cookies.
 * Values are stored in Script Properties, never pushed to git.
 *
 * Usage: setTrendlyneCredentials('akdlu56h...', 'U0N2IkNL...')
 *
 * @param {string} sessionCookie - value of .trendlyne cookie
 * @param {string} csrfToken - value of csrftoken cookie
 */
function setTrendlyneCredentials(sessionCookie, csrfToken) {
  var props = PropertiesService.getScriptProperties();
  props.setProperty('TRENDLYNE_SESSION', sessionCookie);
  props.setProperty('TRENDLYNE_CSRF', csrfToken);
  Logger.log('Trendlyne credentials saved to Script Properties.');
  Logger.log('Session cookie length: ' + sessionCookie.length);
  Logger.log('CSRF token length: ' + csrfToken.length);
}

/**
 * Check if Trendlyne credentials are configured.
 */
function hasTrendlyneCredentials() {
  var props = PropertiesService.getScriptProperties();
  return !!(props.getProperty('TRENDLYNE_SESSION') && props.getProperty('TRENDLYNE_CSRF'));
}

/**
 * Clear Trendlyne credentials (run when subscription expires).
 */
function clearTrendlyneCredentials() {
  var props = PropertiesService.getScriptProperties();
  props.deleteProperty('TRENDLYNE_SESSION');
  props.deleteProperty('TRENDLYNE_CSRF');
  Logger.log('Trendlyne credentials cleared.');
}

// ============================================================================
// SCREENER IDS — Configure your Trendlyne screener IDs here
// ============================================================================

var TRENDLYNE_SCREENERS = {
  // Update these with your actual Trendlyne screener IDs (from URL)
  // e.g., trendlyne.com/fundamentals/stock-screener/794420/cf-momentum/
  'CF-Momentum': null,    // Set via setTrendlyneScreenerIds()
  'CF-Compounder': null,
  'CF-Growth': null
};

/**
 * Set Trendlyne screener IDs. Run once from Script Editor.
 * Usage: setTrendlyneScreenerIds(123456, 234567, 345678)
 */
function setTrendlyneScreenerIds(momentumId, compounderId, growthId) {
  var props = PropertiesService.getScriptProperties();
  var ids = {
    'CF-Momentum': momentumId || null,
    'CF-Compounder': compounderId || null,
    'CF-Growth': growthId || null
  };
  props.setProperty('TRENDLYNE_SCREEN_IDS', JSON.stringify(ids));
  Logger.log('Trendlyne screener IDs saved: ' + JSON.stringify(ids));
}

function _getTrendlyneScreenerIds() {
  var props = PropertiesService.getScriptProperties();
  var raw = props.getProperty('TRENDLYNE_SCREEN_IDS');
  if (!raw) return {};
  try { return JSON.parse(raw); } catch (e) { return {}; }
}

// ============================================================================
// FETCH DATA FROM TRENDLYNE
// ============================================================================

/**
 * Fetch screener data from Trendlyne as XLSX → convert to array of objects.
 * @param {number} screenId - Trendlyne screener ID
 * @returns {Array<Object>} Array of stock data objects with column headers as keys
 */
function fetchTrendlyneScreenerData(screenId) {
  var props = PropertiesService.getScriptProperties();
  var session = props.getProperty('TRENDLYNE_SESSION');
  var csrf = props.getProperty('TRENDLYNE_CSRF');

  if (!session || !csrf) {
    throw new Error('Trendlyne credentials not set. Run setTrendlyneCredentials() first.');
  }

  var url = 'https://trendlyne.com/tools/data-downloader-popup/';
  var payload = {
    'csrfmiddlewaretoken': csrf,
    'screenId': String(screenId),
    'stock_group': 'index/NFTYTOTMKT/nifty-total-market/',
    'param_group': 'This screen param List'
  };

  var options = {
    method: 'post',
    contentType: 'application/x-www-form-urlencoded',
    payload: payload,
    headers: {
      'Cookie': '.trendlyne=' + session + '; csrftoken=' + csrf,
      'X-CSRFToken': csrf,
      'Referer': 'https://trendlyne.com/fundamentals/stock-screener/' + screenId + '/index/NFTYTOTMKT/nifty-total-market/',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept': '*/*',
      'Origin': 'https://trendlyne.com'
    },
    muteHttpExceptions: true
  };

  Logger.log('Fetching Trendlyne screener ' + screenId + '...');
  var response = UrlFetchApp.fetch(url, options);
  var code = response.getResponseCode();

  if (code === 403 || code === 401) {
    throw new Error('Trendlyne auth failed (HTTP ' + code + '). Cookies may have expired. Run setTrendlyneCredentials() with fresh values.');
  }
  if (code !== 200) {
    throw new Error('Trendlyne returned HTTP ' + code);
  }

  // Response is XLSX blob — convert via Drive
  var blob = response.getBlob().setName('trendlyne_screen_' + screenId + '.xlsx');
  var data = _parseXlsxBlob(blob);

  Logger.log('Trendlyne screener ' + screenId + ': ' + data.length + ' stocks fetched');
  return data;
}

/**
 * Parse XLSX blob by uploading to Drive as Google Sheet, reading, then deleting.
 * @param {Blob} blob - XLSX file blob
 * @returns {Array<Object>} Array of objects with header keys
 */
function _parseXlsxBlob(blob) {
  // Create temp Google Sheet from XLSX
  var resource = {
    title: '_trendlyne_temp_' + new Date().getTime(),
    mimeType: MimeType.GOOGLE_SHEETS
  };

  var file = Drive.Files.insert(resource, blob, { convert: true });
  var tempSs = SpreadsheetApp.openById(file.id);

  try {
    var sheet = tempSs.getSheets()[0];
    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();

    if (lastRow < 2 || lastCol < 2) {
      Logger.log('Trendlyne XLSX is empty or has no data rows');
      return [];
    }

    var allData = sheet.getRange(1, 1, lastRow, lastCol).getValues();
    var headers = allData[0].map(function(h) { return String(h).trim(); });

    var results = [];
    for (var i = 1; i < allData.length; i++) {
      var row = {};
      for (var j = 0; j < headers.length; j++) {
        if (headers[j]) {
          row[headers[j]] = allData[i][j];
        }
      }
      // Skip empty rows
      if (row[headers[0]] || row[headers[1]]) {
        results.push(row);
      }
    }

    Logger.log('Parsed ' + results.length + ' rows with ' + headers.length + ' columns');
    Logger.log('Column headers: ' + headers.join(', '));
    return results;

  } finally {
    // Always clean up temp file
    Drive.Files.remove(file.id);
    Logger.log('Temp XLSX file deleted from Drive');
  }
}

// ============================================================================
// TEST — Fetch one screener and log results
// ============================================================================

/**
 * Test function — fetch one screener and log the first 3 stocks.
 * Run from Script Editor after setting credentials and screener IDs.
 *
 * Usage: testTrendlyneFetch(794420)
 */
function testTrendlyneFetch(screenId) {
  if (!screenId) {
    var ids = _getTrendlyneScreenerIds();
    screenId = ids['CF-Momentum'] || ids['CF-Compounder'] || ids['CF-Growth'];
    if (!screenId) {
      Logger.log('No screener ID provided. Run setTrendlyneScreenerIds() first or pass an ID.');
      return;
    }
  }

  var data = fetchTrendlyneScreenerData(screenId);

  if (data.length === 0) {
    Logger.log('No data returned. Check if cookies are valid.');
    return;
  }

  // Log column names
  var cols = Object.keys(data[0]);
  Logger.log('=== COLUMNS (' + cols.length + ') ===');
  Logger.log(cols.join('\n'));

  // Log first 3 stocks
  Logger.log('\n=== FIRST 3 STOCKS ===');
  for (var i = 0; i < Math.min(3, data.length); i++) {
    Logger.log('\n--- Stock ' + (i + 1) + ' ---');
    for (var j = 0; j < cols.length; j++) {
      var val = data[i][cols[j]];
      if (val !== '' && val !== null && val !== undefined) {
        Logger.log('  ' + cols[j] + ': ' + val);
      }
    }
  }
}

// ============================================================================
// ENRICH WATCHLIST — Map Trendlyne data to our watchlist columns
// ============================================================================

/**
 * Column mapping: Trendlyne header → our watchlist column number.
 * This will be populated after we see the actual Trendlyne column headers.
 * For now, common Trendlyne column names mapped to our sheet columns.
 */
var TRENDLYNE_COL_MAP = {
  // Trendlyne XLSX header → { col: watchlist column number }
  // Verified from testTrendlyneFetch() output on 2026-03-19
  //
  // --- Existing watchlist columns (overwrite with fresh Trendlyne data) ---
  'PE TTM Price to Earnings': { col: 29 },         // AC: PE
  'ROE Annual %': { col: 30 },                     // AD: ROE %
  'Piotroski Score': { col: 31 },                   // AE: Piotroski
  'Net Profit 3Yr Growth %': { col: 32 },           // AF: Profit Growth %
  'Total Debt to Total Equity Annual': { col: 33 }, // AG: Debt/Equity
  'Institutional holding current Qtr %': { col: 34 }, // AH: DII Holding % (institutional = DII proxy)
  'Institutional holding change QoQ %': { col: 35 }, // AI: DII Change QoQ
  'Market Capitalization': { col: 24 },              // X: Market Cap (Cr)
  'sector_name': { col: 18 },                       // R: Sector
  '1Yr High': { col: 36 },                          // AJ: 52W High
  'Day RSI': { col: 11 },                           // K: RSI(14)
  'Day SMA50': { col: 12 },                         // L: 50DMA
  'Day SMA200': { col: 13 },                        // M: 200DMA
  'Half Yr Change %': { col: 15 },                  // O: 6M Return %
  'Week change %': { col: 26 },                      // Z: 1W Return % (lowercase 'c' in Trendlyne XLSX)
  'Month Change %': { col: 27 },                    // AA: 1M Return %
  '1Yr change %': { col: 28 },                      // AB: 1Y Return % (no space, lowercase 'c' in XLSX)
  'Discount to 52Week High %': { col: 37 },         // AK: Drawdown %
  //
  // --- New Trendlyne enrichment columns (AO-AX = cols 41-50) ---
  'Promoter holding pledge percentage % Qtr': { col: 41 }, // AO: Promoter Pledge %
  'FII holding current Qtr %': { col: 42 },                // AP: FII Holding %
  'FII holding change QoQ %': { col: 43 },                 // AQ: FII Change QoQ
  'Interest Coverage Ratio Annual': { col: 44 },            // AR: Interest Coverage
  'EPS TTM Growth %': { col: 45 },                         // AS: EPS Growth TTM %
  'Price to Book Value Adjusted': { col: 46 },              // AT: Price to Book
  'Operating Profit Margin Qtr %': { col: 47 },             // AU: OPM Qtr %
  'Revenue Annual 3Yr Growth %': { col: 48 },               // AV: Revenue Growth 3Y %
  'Promoter holding latest %': { col: 49 },                 // AW: Promoter Holding %
  'mcap_q_category': { col: 50 },                           // AX: MCAP Class
};

/**
 * Enrich watchlist with data from all configured Trendlyne screeners.
 * Fetches each screener, merges by stock name/symbol, writes to watchlist.
 *
 * Also handles:
 *   - NEW STOCK DISCOVERY: stocks in Trendlyne but not in watchlist → auto-add
 *   - STALE DETECTION: watchlist stocks not in any screener for 30+ days → mark STALE
 *   - STALE RE-ACTIVATION: stale stocks that re-appear in a screener → ELIGIBLE
 *
 * Returns: { enrichedSymbols: string[], totalEnriched: number, newStocks: number, staleMarked: number }
 */
function enrichWatchlistFromTrendlyne() {
  if (!hasTrendlyneCredentials()) {
    Logger.log('Trendlyne credentials not set. Run setTrendlyneCredentials() first.');
    return { enrichedSymbols: [], totalEnriched: 0, newStocks: 0, staleMarked: 0 };
  }

  var ids = _getTrendlyneScreenerIds();
  var allScreenerNames = ['CF-Momentum', 'CF-Compounder', 'CF-Growth'];
  var allStockData = {}; // symbol → merged data (first screener wins)
  var screenerMap = {};  // symbol → [screener names] — tracks multi-screener membership

  for (var s = 0; s < allScreenerNames.length; s++) {
    var name = allScreenerNames[s];
    var screenId = ids[name];
    if (!screenId) {
      Logger.log('Skipping ' + name + ' — no screener ID configured');
      continue;
    }

    try {
      var data = fetchTrendlyneScreenerData(screenId);
      Logger.log(name + ': ' + data.length + ' stocks');

      for (var i = 0; i < data.length; i++) {
        var stock = data[i];
        var symbol = _extractTrendlyneSymbol(stock);
        if (!symbol) continue;
        if (!allStockData[symbol]) {
          allStockData[symbol] = stock;
        }
        if (!screenerMap[symbol]) screenerMap[symbol] = [];
        screenerMap[symbol].push(name);
      }
    } catch (e) {
      Logger.log('Error fetching ' + name + ': ' + e.message);
    }

    Utilities.sleep(2000); // Rate limit between screeners
  }

  var symbolCount = Object.keys(allStockData).length;
  Logger.log('Total unique stocks from Trendlyne: ' + symbolCount);

  if (symbolCount === 0) {
    Logger.log('No data to enrich. Check screener IDs and credentials.');
    return { enrichedSymbols: [], totalEnriched: 0, newStocks: 0, staleMarked: 0 };
  }

  // Step 1: Add new stocks that are in Trendlyne but not yet in watchlist
  var newStocks = _addNewTrendlyneStocks(allStockData, screenerMap);

  // Step 2: Enrich existing watchlist stocks with Trendlyne data
  var enrichedSymbols = _writeTrendlyneDataToWatchlist(allStockData, screenerMap);

  // Step 3: Mark stale stocks (in watchlist but not in any Trendlyne screener for 30+ days)
  var staleMarked = _markStaleStocks(allStockData);

  // Persist last update timestamp to Screener_Config
  setScreenerConfigValue('TRENDLYNE_LAST_UPDATED', new Date().toISOString());

  Logger.log('Trendlyne summary: ' + enrichedSymbols.length + ' enriched, ' +
    newStocks + ' new, ' + staleMarked + ' stale');
  return {
    enrichedSymbols: enrichedSymbols,
    totalEnriched: enrichedSymbols.length,
    newStocks: newStocks,
    staleMarked: staleMarked
  };
}

/**
 * Auto-add stocks from Trendlyne that are not yet in the watchlist.
 * Replaces the old email-based discovery — Trendlyne API is the single source of truth.
 *
 * For each new stock, uses Trendlyne data for sector, market cap, cap class, price
 * (no separate Screener.in fetch needed).
 *
 * @returns {number} Count of newly added stocks
 */
function _addNewTrendlyneStocks(allStockData, screenerMap) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SCREENER_CONFIG.sheets.watchlist);
  if (!sheet) return 0;

  // Read existing symbols
  var lastRow = sheet.getLastRow();
  var existingSymbols = {};
  if (lastRow > 1) {
    var symData = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < symData.length; i++) {
      var sym = String(symData[i][0]).trim().toUpperCase();
      if (sym) existingSymbols[sym] = true;
    }
  }

  var today = new Date();
  var added = 0;

  for (var symbol in allStockData) {
    if (existingSymbols[symbol]) continue; // already in watchlist

    var tData = allStockData[symbol];
    var screeners = screenerMap[symbol] || [];

    // Extract data from Trendlyne (no separate fetch needed!)
    var stockName = tData['Stock Name'] || tData['stock'] || '';
    if (typeof stockName === 'string') {
      stockName = stockName.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    }
    var sector = tData['sector_name'] || '';
    if (typeof sector === 'string') {
      sector = sector.replace(/&amp;/g, '&');
    }
    var marketCapCr = parseFloat(tData['Market Capitalization']) || '';
    var price = parseFloat(tData['Current Price']) || '';

    // Cap class from market cap thresholds (SEBI-like)
    var capClass = 'MICRO';
    if (marketCapCr >= 20000) capClass = 'LARGE';
    else if (marketCapCr >= 5000) capClass = 'MID';
    else if (marketCapCr >= 500) capClass = 'SMALL';

    // Cooling period (30 days default)
    var coolingDays = 30;
    var coolingEndDate = new Date(today.getTime() + coolingDays * 24 * 60 * 60 * 1000);

    // Conviction from DII change
    var conviction = 'BASE';
    var diiChange = parseFloat(tData['Institutional holding change QoQ %']);
    if (!isNaN(diiChange)) {
      if (diiChange >= 1) conviction = 'HIGH';
      else if (diiChange >= 0.5) conviction = 'MODERATE';
    }

    var newRow = [
      symbol,                               // A: Symbol
      stockName,                            // B: Stock Name
      today,                                // C: Date Found
      price || '',                          // D: Found Price (from Trendlyne LTP)
      screeners.join(','),                  // E: Screeners Passing
      conviction,                           // F: Conviction
      coolingEndDate,                       // G: Cooling End Date
      'NEW',                                // H: Status
      price || '',                          // I: Current Price
      '', '',                               // J-K: Change%, RSI (filled by enrichment below)
      '', '', '', '', '', '',               // L-Q: DMA, GC, returns, etc.
      sector,                               // R: Sector
      '',                                   // S: Nifty >200DMA
      'NO',                                 // T: All BUY Met
      '',                                   // U: Failed Conditions
      today,                                // V: Last Updated
      'Auto-discovered from Trendlyne',     // W: Notes
      marketCapCr,                          // X: Market Cap (Cr)
      capClass                              // Y: Cap Class
    ];

    sheet.appendRow(newRow);
    added++;
    Logger.log('NEW: ' + symbol + ' (' + stockName + ') from ' + screeners.join('+'));
  }

  if (added > 0) Logger.log('Added ' + added + ' new stocks from Trendlyne screeners');
  return added;
}

/**
 * Mark watchlist stocks as STALE if they haven't appeared in any Trendlyne screener
 * for 30+ days. STALE stocks skip buy signal evaluation but keep monitoring.
 *
 * Also re-activates previously STALE stocks that re-appeared in a screener.
 *
 * @param {Object} allStockData - symbol → Trendlyne data (stocks currently in screeners)
 * @returns {number} Count of newly stale stocks
 */
function _markStaleStocks(allStockData) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SCREENER_CONFIG.sheets.watchlist);
  if (!sheet) return 0;

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;

  // Read symbol (A), status (H), last updated (V)
  var data = sheet.getRange(2, 1, lastRow - 1, 22).getValues();
  var today = new Date();
  var staleDays = 30;
  var staleMarked = 0;
  var reactivated = 0;

  for (var i = 0; i < data.length; i++) {
    var sym = String(data[i][0]).trim().toUpperCase();
    if (!sym) continue;

    var status = String(data[i][7]).trim();  // H: Status
    var lastUpdated = data[i][21];           // V: Last Updated
    var row = i + 2;
    var inTrendlyne = !!allStockData[sym];

    // Re-activate STALE stocks that re-appeared
    if (status === 'STALE' && inTrendlyne) {
      sheet.getRange(row, 8).setValue('ELIGIBLE');  // H: Status
      sheet.getRange(row, 21).setValue('Re-appeared in Trendlyne screener'); // U: Failed Conditions
      reactivated++;
      Logger.log(sym + ' STALE → ELIGIBLE (re-appeared in screener)');
      continue;
    }

    // Skip stocks that are in Trendlyne, already STALE, EXPIRED, or BOUGHT
    if (inTrendlyne || status === 'STALE' || status === 'EXPIRED' || status === 'BOUGHT') continue;

    // Check if last updated is >30 days ago
    if (lastUpdated instanceof Date) {
      var daysSinceUpdate = Math.floor((today - lastUpdated) / (1000 * 60 * 60 * 24));
      if (daysSinceUpdate > staleDays) {
        sheet.getRange(row, 8).setValue('STALE');  // H: Status
        sheet.getRange(row, 21).setValue('Not in any Trendlyne screener for ' + daysSinceUpdate + ' days'); // U: Failed Conditions
        staleMarked++;
        Logger.log(sym + ' marked STALE (last seen ' + daysSinceUpdate + ' days ago)');
      }
    }
  }

  if (reactivated > 0) Logger.log(reactivated + ' stocks re-activated from STALE');
  if (staleMarked > 0) Logger.log(staleMarked + ' stocks marked STALE');
  return staleMarked;
}

/**
 * Extract NSE/BSE symbol from a Trendlyne data row.
 * Trendlyne uses various column names — try common ones.
 */
function _extractTrendlyneSymbol(row) {
  // Priority 1: NSE symbol/code (always prefer NSE over BSE)
  var nseCandidates = ['NSE Code', 'NSE Symbol', 'NSE code', 'nse_code', 'Symbol', 'Ticker'];
  for (var i = 0; i < nseCandidates.length; i++) {
    var val = row[nseCandidates[i]];
    if (val && String(val).trim()) {
      var sym = String(val).trim().toUpperCase();
      // Skip if it's purely numeric (that's a BSE code, not NSE symbol)
      if (/^\d+$/.test(sym)) continue;
      return sym;
    }
  }

  // Priority 2: Case-insensitive search for any column containing "NSE" in header
  var keys = Object.keys(row);
  for (var j = 0; j < keys.length; j++) {
    if (/nse/i.test(keys[j]) && !/bse/i.test(keys[j])) {
      var v = row[keys[j]];
      if (v && String(v).trim() && !/^\d+$/.test(String(v).trim())) {
        return String(v).trim().toUpperCase();
      }
    }
  }

  // BSE-only stocks are NOT in Nifty Total Market (NSE index) — skip them
  Logger.log('SKIPPED: No NSE symbol for ' + (row['Stock Name'] || 'unknown') + ' — BSE-only stock');
  return null;
}

/**
 * Write Trendlyne enrichment data to Screener_Watchlist.
 * Matches by symbol (col A) and writes to fundamental + technical columns.
 * Also computes derived columns: Golden Cross, Cap Class, Avg Traded Val.
 * Updates screener membership (col E) and Last Updated (col V).
 *
 * @param {Object} allStockData - symbol → Trendlyne data row
 * @param {Object} screenerMap - symbol → [screener names] (which screeners the stock appears in)
 * @returns {string[]} List of watchlist symbols that were enriched
 */
function _writeTrendlyneDataToWatchlist(allStockData, screenerMap) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SCREENER_CONFIG.sheets.watchlist);
  if (!sheet) { Logger.log('Screener_Watchlist not found'); return []; }

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  var symbols = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  var updated = 0;
  var enrichedSymbols = [];
  var today = new Date();

  for (var i = 0; i < symbols.length; i++) {
    var sym = String(symbols[i][0]).trim().toUpperCase();
    if (!sym) continue;

    var tData = allStockData[sym];
    if (!tData) continue;

    var row = i + 2;

    // Write each mapped column
    for (var tHeader in TRENDLYNE_COL_MAP) {
      var val = tData[tHeader];
      if (val !== undefined && val !== null && val !== '' && val !== '-') {
        var colNum = TRENDLYNE_COL_MAP[tHeader].col;
        // Decode HTML entities in text fields (Trendlyne sometimes has &amp; etc.)
        if (typeof val === 'string') {
          val = val.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
        }
        sheet.getRange(row, colNum).setValue(val);
      }
    }

    // --- Derived columns ---

    // Golden Cross (col N=14): from Trendlyne "Golden Cross Day" (True/False string)
    var gcVal = tData['Golden Cross Day'];
    if (gcVal !== undefined && gcVal !== null) {
      var isGoldenCross = String(gcVal).toLowerCase() === 'true';
      sheet.getRange(row, 14).setValue(isGoldenCross ? 'YES' : 'NO');
    }

    // Cap Class (col Y=25): derive from Market Cap thresholds (SEBI-like)
    // Trendlyne's mcap_q_category is unreliable (labels everything "Small Cap")
    var marketCapVal = parseFloat(tData['Market Capitalization']) || 0;
    if (marketCapVal > 0) {
      var cls = 'MICRO';
      if (marketCapVal >= 20000) cls = 'LARGE';
      else if (marketCapVal >= 5000) cls = 'MID';
      else if (marketCapVal >= 500) cls = 'SMALL';
      sheet.getRange(row, 25).setValue(cls);
    }

    // Avg Traded Val (col AN=40): volume × price / 1 Cr
    var avgVol = parseFloat(tData['Consolidated 30day average end of day volume']) || 0;
    var price = parseFloat(tData['Current Price']) || 0;
    if (avgVol > 0 && price > 0) {
      var avgTradedValCr = Math.round((avgVol * price) / 10000000 * 100) / 100;
      sheet.getRange(row, 40).setValue(avgTradedValCr);
    }

    // Current Price (col I=9): use Trendlyne LTP
    if (price > 0) {
      sheet.getRange(row, 9).setValue(price);
    }

    // Screeners Passing (col E=5): track which screeners this stock appears in
    if (screenerMap && screenerMap[sym]) {
      sheet.getRange(row, 5).setValue(screenerMap[sym].join(','));
    }

    // Conviction (col F=6): derived from Institutional holding QoQ change (DII proxy)
    var diiChange = parseFloat(tData['Institutional holding change QoQ %']);
    if (!isNaN(diiChange)) {
      var conviction = 'BASE';
      if (diiChange >= 1) conviction = 'HIGH';
      else if (diiChange >= 0.5) conviction = 'MODERATE';
      sheet.getRange(row, 6).setValue(conviction);
    }

    // Last Updated (col V=22): stamp today's date
    sheet.getRange(row, 22).setValue(today);

    enrichedSymbols.push(sym);
    updated++;
  }

  Logger.log('Trendlyne enrichment complete: ' + updated + '/' + symbols.length + ' stocks updated');
  return enrichedSymbols;
}

// ============================================================================
// TEMP SETUP — Replace placeholder values in Script Editor, run, then delete
// ============================================================================

function _tempSetup() {
  setTrendlyneCredentials('PASTE_SESSION_COOKIE_HERE', 'PASTE_CSRF_TOKEN_HERE');
  setTrendlyneScreenerIds(794420, 794418, 794422);
  // CF-Momentum: 794420, CF-Compounder: 794418, CF-Growth: 794422
}
