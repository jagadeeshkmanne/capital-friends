/**
 * ============================================================================
 * SCREENER SHEETS — Create and manage all 6 screener sheets
 * ============================================================================
 *
 * Creates: Screener_Config, Screener_Watchlist, Screener_Holdings,
 *          Screener_Signals, Screener_History, Screener_NearMiss
 *
 * SAFE: Never modifies existing sheets (MF_Data, MF_ATH, Stock_Data, etc.)
 */

/**
 * ONE-TIME SETUP — Create all screener sheets + populate config defaults
 * Run this once from Script Editor or menu
 */
function setupScreenerSheets() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    'Setup Stock Screener',
    'This will create 6 new sheets for the stock screener system:\n\n' +
    '• Screener_Config (settings)\n' +
    '• Screener_Watchlist (discovered stocks)\n' +
    '• Screener_Holdings (owned stocks)\n' +
    '• Screener_Signals (pending actions)\n' +
    '• Screener_History (completed trades)\n' +
    '• Screener_NearMiss (almost-passed stocks)\n\n' +
    'Existing sheets will NOT be modified.\n\n' +
    'Continue?',
    ui.ButtonSet.YES_NO
  );

  if (response !== ui.Button.YES) return;

  createScreenerConfigSheet();
  createScreenerWatchlistSheet();
  createScreenerHoldingsSheet();
  createScreenerSignalsSheet();
  createScreenerHistorySheet();
  createScreenerNearMissSheet();

  ui.alert(
    'Screener Setup Complete',
    'All 6 screener sheets created.\n\n' +
    'Next: Run "Daily Screener Check" or wait for the daily trigger.',
    ui.ButtonSet.OK
  );
}

// --- Helper: get or create sheet (never deletes existing data) ---
function _getOrCreateSheet(name, headers, colWidths) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);

  if (sheet) {
    Logger.log(name + ' already exists, skipping creation');
    return sheet;
  }

  sheet = ss.insertSheet(name);
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  // Format header
  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#1a202c')
    .setFontColor('#ffffff')
    .setHorizontalAlignment('center');

  // Set column widths
  if (colWidths) {
    for (let i = 0; i < colWidths.length; i++) {
      sheet.setColumnWidth(i + 1, colWidths[i]);
    }
  }

  sheet.setFrozenRows(1);
  Logger.log(name + ' created');
  return sheet;
}

// --- Screener_Config ---
function createScreenerConfigSheet() {
  const name = SCREENER_CONFIG.sheets.config;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);

  if (sheet) {
    Logger.log(name + ' already exists');
    return sheet;
  }

  sheet = ss.insertSheet(name);
  sheet.getRange('A1:C1').setValues([['Key', 'Value', 'Description']]);
  sheet.getRange('A1:C1')
    .setFontWeight('bold')
    .setBackground('#1a202c')
    .setFontColor('#ffffff');

  // Populate defaults with descriptions
  const rows = [
    ['STOCK_BUDGET', 300000, 'Total stock budget (₹)'],
    ['CASH_RESERVE_PCT', 15, 'Cash reserve target (%)'],
    ['MAX_STOCKS', 8, 'Max individual stocks in portfolio'],
    ['MAX_PER_SECTOR', 2, 'Max stocks per sector'],
    ['SECTOR_PCT_CAP', 30, 'Max sector allocation (%)'],
    ['SECTOR_ALERT_PCT', 35, 'Monthly sector alert threshold (%)'],
    ['ALLOC_HIGH', 15, 'Max allocation for HIGH conviction stocks (MF QoQ >= 1%)'],
    ['ALLOC_MODERATE', 12, 'Max allocation for MODERATE conviction stocks (MF QoQ 0.5-1%)'],
    ['ALLOC_BASE', 10, 'Max allocation for BASE conviction stocks (no MF signal)'],
    ['MF_HIGH_THRESHOLD', 1, 'MF holding QoQ change % for HIGH conviction'],
    ['MF_MODERATE_THRESHOLD', 0.5, 'MF holding QoQ change % for MODERATE conviction'],
    ['TRAILING_STOP_0_20', 25, 'Trailing stop % for 0-20% gain'],
    ['TRAILING_STOP_20_50', 20, 'Trailing stop % for 20-50% gain'],
    ['TRAILING_STOP_50_100', 15, 'Trailing stop % for 50-100% gain'],
    ['TRAILING_STOP_100_PLUS', 12, 'Trailing stop % for 100%+ gain'],
    ['HARD_STOP_LOSS', 30, 'Hard stop loss from entry (%)'],
    ['PAPER_TRADING', 'TRUE', 'Paper trading mode — no real signals'],
    ['NIFTY_BELOW_200DMA_ALLOCATION', 50, 'Allocation % when Nifty below 200DMA'],
    ['ADD1_GAIN_PCT', 12, 'Min gain % for Add #1 trigger'],
    ['ADD1_MAX_GAIN_PCT', 25, 'Max gain % for Add #1 (above this wait for Add #2)'],
    ['ADD2_GAIN_PCT', 30, 'Min gain % for Add #2 trigger'],
    ['ADD_MIN_WEEKS', 2, 'Min weeks between adds'],
    ['DIP_BUY_MIN_DROP', 10, 'Min drop % for dip buy'],
    ['DIP_BUY_MAX_DROP', 20, 'Max drop % for dip buy (beyond = hard stop territory)'],
    ['DIP_BUY_RSI_MAX', 30, 'Max RSI for dip buy'],
    ['PRICE_RUNUP_EXPIRE_PCT', 20, 'Expire from watchlist if price up this much'],
    ['RSI_BUY_MAX', 45, 'Max RSI for BUY signal'],
    ['PORTFOLIO_FREEZE_PCT', 25, 'Freeze new buys if portfolio down this %'],
    ['NIFTY_CRASH_PCT', 20, 'Crash alert if Nifty drops this % in 1 month'],
    ['SYSTEMIC_EXIT_COUNT', 3, 'Exit all if this many hard exits at same time'],
    ['MIN_MARKET_CAP_CR', 500, 'Min market cap in Cr — skip micro caps']
  ];

  sheet.getRange(2, 1, rows.length, 3).setValues(rows);
  sheet.setColumnWidth(1, 260);
  sheet.setColumnWidth(2, 100);
  sheet.setColumnWidth(3, 350);
  sheet.setFrozenRows(1);

  Logger.log(name + ' created with ' + rows.length + ' config values');
  return sheet;
}

// --- Screener_Watchlist (40 columns A-AN) ---
// A-AB: Original columns (28)
// AC-AN: Factor scoring + liquidity columns (12)
function createScreenerWatchlistSheet() {
  return _getOrCreateSheet(
    SCREENER_CONFIG.sheets.watchlist,
    [
      // A-AB: Original 28 columns
      'Symbol', 'Stock Name', 'Date Found', 'Found Price',
      'Screeners Passing', 'Conviction', 'Cooling End Date', 'Status',
      'Current Price', 'Price Change %', 'RSI(14)',
      '50DMA', '200DMA', 'Golden Cross', '6M Return %',
      'Nifty 6M Return %', 'Relative Strength', 'Sector',
      'Nifty >200DMA', 'All BUY Met', 'Failed Conditions',
      'Last Updated', 'Notes',
      'Market Cap (Cr)', 'Cap Class',
      '1W Return %', '1M Return %', '1Y Return %',
      // AC-AN: Factor scoring + liquidity columns (12)
      'PE', 'ROE %', 'Piotroski', 'Profit Growth %', 'Debt/Equity',
      'DII Holding %', 'DII Change QoQ',
      '52W High', 'Drawdown %',
      'Factor Score', 'Factor Rank',
      'Avg Traded Val (Cr)',
      // AO-AX: Trendlyne enrichment columns (10)
      'Promoter Pledge %', 'FII Holding %', 'FII Change QoQ',
      'Interest Coverage', 'EPS Growth TTM %', 'Price to Book',
      'OPM Qtr %', 'Revenue Growth 3Y %', 'Promoter Holding %',
      'MCAP Class'
    ],
    [
      90, 180, 100, 90,
      120, 90, 110, 90,
      90, 90, 70,
      80, 80, 80, 90,
      100, 90, 120,
      80, 80, 180,
      110, 150,
      100, 80,
      80, 80, 80,
      // Factor scoring + liquidity widths
      70, 70, 70, 90, 80,
      80, 90,
      80, 80,
      80, 80,
      90,
      // Trendlyne enrichment widths
      80, 80, 80,
      80, 80, 80,
      80, 90, 80,
      80
    ]
  );
}

// --- Screener_Holdings (30 columns A-AD) ---
function createScreenerHoldingsSheet() {
  return _getOrCreateSheet(
    SCREENER_CONFIG.sheets.holdings,
    [
      'Symbol', 'Stock Name', 'Sector', 'Entry Date', 'Entry Price',
      'Total Shares', 'Total Invested', 'Avg Price',
      'Current Price', 'P&L %', 'P&L ₹',
      'Peak Price', 'Trailing Stop', 'Stop Tier',
      'Pyramid Stage', 'Dip Buy Used', 'Screeners Passing',
      'Conviction', 'Is Compounder', 'LTCG Date', 'Days to LTCG',
      'RSI(14)', '50DMA', '200DMA',
      'Last Fundamental Check', 'Status',
      'Allocation %', 'Sector Alloc %', 'Notes',
      'Last Add Date'
    ],
    [
      90, 180, 100, 100, 90,
      80, 100, 90,
      90, 70, 90,
      90, 90, 80,
      90, 80, 120,
      90, 80, 100, 80,
      70, 80, 80,
      120, 80,
      80, 90, 150,
      100
    ]
  );
}

// --- Screener_Signals (16 columns A-P) ---
function createScreenerSignalsSheet() {
  return _getOrCreateSheet(
    SCREENER_CONFIG.sheets.signals,
    [
      'Signal ID', 'Date', 'Signal Type', 'Priority',
      'Symbol', 'Stock Name', 'Action',
      'Amount ₹', 'Shares', 'Trigger Detail',
      'Fundamentals', 'Status', 'Executed Date',
      'Executed Price', 'Email Sent', 'Notes'
    ],
    [
      80, 100, 110, 60,
      80, 180, 300,
      90, 70, 250,
      200, 80, 100,
      90, 70, 150
    ]
  );
}

// --- Screener_History (18 columns A-R) ---
function createScreenerHistorySheet() {
  return _getOrCreateSheet(
    SCREENER_CONFIG.sheets.history,
    [
      'Symbol', 'Stock Name', 'Entry Date', 'Exit Date',
      'Avg Entry Price', 'Exit Price', 'Shares',
      'Invested ₹', 'Exit Value ₹', 'P&L ₹', 'P&L %',
      'Holding Days', 'Tax Type', 'Exit Reason',
      'Screeners At Entry', 'Screeners At Exit',
      'Max Gain %', 'Notes'
    ],
    [
      80, 180, 100, 100,
      100, 90, 70,
      100, 100, 90, 70,
      80, 70, 120,
      110, 110,
      80, 150
    ]
  );
}

/**
 * MIGRATION: Clear old 4-screener watchlist and import fresh from CF-Stock-Screener CSV.
 *
 * Steps:
 *   1. Upload Trendlyne CSV to a sheet named "CSV_Import" (paste or File > Import)
 *   2. Run this function from Script Editor
 *   3. It reads NSE codes from the CSV, clears old watchlist, imports fresh
 *   4. All stocks start as ELIGIBLE (no cooling — they already passed the screener)
 *   5. Delete "CSV_Import" sheet after running
 *
 * CSV columns expected (Trendlyne export):
 *   A: Sl No, B: Stock, C: Market Cap, ..., N: NSE Code, O: BSE Code, P: ISIN
 */
function migrateWatchlistFromCSV() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // --- Read CSV_Import sheet ---
  var csvSheet = ss.getSheetByName('CSV_Import');
  if (!csvSheet) {
    SpreadsheetApp.getUi().alert('Sheet "CSV_Import" not found.\n\nPaste the Trendlyne CSV into a sheet named "CSV_Import" first.');
    return;
  }

  var csvData = csvSheet.getDataRange().getValues();
  if (csvData.length < 2) {
    SpreadsheetApp.getUi().alert('CSV_Import sheet is empty.');
    return;
  }

  // Parse header to find NSE Code column
  var header = csvData[0].map(function(h) { return String(h).trim().toLowerCase(); });
  var nseIdx = header.indexOf('nse code');
  var nameIdx = header.indexOf('stock');
  var mcapIdx = header.indexOf('market cap');

  if (nseIdx === -1) {
    SpreadsheetApp.getUi().alert('Column "NSE Code" not found in CSV header.\nFound: ' + header.join(', '));
    return;
  }

  // Extract stocks
  var stocks = [];
  for (var i = 1; i < csvData.length; i++) {
    var nse = String(csvData[i][nseIdx]).trim();
    if (!nse) continue;
    stocks.push({
      symbol: nse,
      name: nameIdx !== -1 ? String(csvData[i][nameIdx]).trim() : '',
      marketCapCr: mcapIdx !== -1 ? parseFloat(csvData[i][mcapIdx]) || null : null
    });
  }

  if (stocks.length === 0) {
    SpreadsheetApp.getUi().alert('No stocks found in CSV.');
    return;
  }

  // --- Confirm with user ---
  var ui = SpreadsheetApp.getUi();
  var confirm = ui.alert(
    'Migrate Watchlist',
    'This will:\n' +
    '  1. CLEAR all rows in Screener_Watchlist\n' +
    '  2. Import ' + stocks.length + ' stocks from CF-Stock-Screener CSV\n' +
    '  3. All start as ELIGIBLE (no cooling period)\n\n' +
    'Stocks: ' + stocks.map(function(s) { return s.symbol; }).join(', ') + '\n\n' +
    'Continue?',
    ui.ButtonSet.YES_NO
  );
  if (confirm !== ui.Button.YES) return;

  // --- Clear old watchlist ---
  var sheet = ss.getSheetByName(SCREENER_CONFIG.sheets.watchlist);
  if (!sheet) {
    ui.alert('Screener_Watchlist sheet not found. Run setupScreenerSheets() first.');
    return;
  }

  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, sheet.getMaxColumns()).clearContent();
    Logger.log('Cleared ' + (lastRow - 1) + ' old watchlist rows');
  }

  // --- Import new stocks ---
  var today = new Date();
  var rows = [];

  for (var j = 0; j < stocks.length; j++) {
    var stock = stocks[j];

    // Fetch sector from Screener.in
    var mcapData = { marketCapCr: stock.marketCapCr, capClass: null, sector: null };
    try {
      mcapData = fetchMarketCapOnly(stock.symbol);
    } catch (e) {
      Logger.log('Fetch failed for ' + stock.symbol + ': ' + e.message);
    }

    // Classify cap
    var capClass = '';
    var mc = mcapData.marketCapCr || stock.marketCapCr || 0;
    if (mc >= 20000) capClass = 'LARGE';
    else if (mc >= 5000) capClass = 'MID';
    else if (mc >= 500) capClass = 'SMALL';
    else capClass = 'MICRO';

    rows.push([
      stock.symbol,                           // A: Symbol
      stock.name || '',                       // B: Stock Name
      today,                                  // C: Date Found
      '',                                     // D: Found Price (market data update fills this)
      'CF-Stock-Screener',                    // E: Screener
      'BASE',                                 // F: Conviction (MF enrichment updates this)
      '',                                     // G: Cooling End Date (empty = no cooling)
      'ELIGIBLE',                             // H: Status (skip cooling for migration)
      '', '', '',                             // I-K: Price, Change%, RSI
      '', '', '', '', '', '',                 // L-Q: DMA50, DMA200, GoldenCross, 6M Return, Nifty6M, RelStrength
      mcapData.sector || '',                  // R: Sector
      '',                                     // S: Nifty >200DMA
      'NO',                                   // T: All BUY Met
      '',                                     // U: Failed Conditions
      today,                                  // V: Last Updated
      'Migrated from CSV',                    // W: Notes
      mc || '',                               // X: Market Cap (Cr)
      capClass                                // Y: Cap Class
    ]);

    // Rate limit Screener.in fetches
    if (j < stocks.length - 1) {
      Utilities.sleep(500);
    }
  }

  // Batch write all rows
  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
  }

  Logger.log('Migration complete: ' + rows.length + ' stocks imported');
  ui.alert(
    'Migration Complete!',
    rows.length + ' stocks imported from CF-Stock-Screener.\n\n' +
    'Next steps:\n' +
    '1. Run "Update Watchlist Data" to fetch prices, RSI, DMA\n' +
    '2. Run "MF Enrichment" to set conviction levels\n' +
    '3. Delete the "CSV_Import" sheet',
    ui.ButtonSet.OK
  );
}

/**
 * Backfill sector for all watchlist stocks missing sector data.
 * Uses Screener.in (same page already fetched for market cap).
 * Normalizes to Nifty-style broad sectors.
 */
function backfillWatchlistSectors() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SCREENER_CONFIG.sheets.watchlist);
  if (!sheet) { Logger.log('No watchlist sheet'); return; }

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  var data = sheet.getRange(2, 1, lastRow - 1, 18).getValues();
  var filled = 0;
  var failed = 0;

  for (var i = 0; i < data.length; i++) {
    var symbol = String(data[i][0]).trim();
    var existingSector = String(data[i][17]).trim();
    if (!symbol || existingSector) continue;

    var result = null;
    for (var attempt = 1; attempt <= 2; attempt++) {
      try {
        result = fetchMarketCapOnly(symbol);
        if (result.sector) break;
      } catch (e) {
        Logger.log(symbol + ' → attempt ' + attempt + ' error: ' + e.message);
        if (attempt < 2) Utilities.sleep(3000); // longer wait before retry
      }
    }

    if (result && result.sector) {
      sheet.getRange(i + 2, 18).setValue(result.sector);
      filled++;
      Logger.log(symbol + ' → ' + result.sector);
    } else {
      failed++;
      Logger.log(symbol + ' → sector not found');
    }
    Utilities.sleep(2000); // 2s between requests to avoid rate limiting
  }

  Logger.log('Backfill complete: ' + filled + ' filled, ' + failed + ' failed');
  SpreadsheetApp.getUi().alert('Sector backfill complete!\n\n' + filled + ' sectors filled, ' + failed + ' failed.\n\nCheck logs for details.');
}

// --- Screener_NearMiss (8 columns A-H) ---
function createScreenerNearMissSheet() {
  return _getOrCreateSheet(
    SCREENER_CONFIG.sheets.nearMiss,
    [
      'Date', 'Symbol', 'Stock Name', 'Screener',
      'Failed Filter', 'Actual Value', 'Required Value', 'How Close %'
    ],
    [100, 80, 180, 100, 150, 100, 100, 80]
  );
}
