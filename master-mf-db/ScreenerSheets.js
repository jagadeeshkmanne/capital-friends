/**
 * ============================================================================
 * SCREENER SHEETS — Create and manage screener sheets
 * ============================================================================
 *
 * Creates: Screener_Config, Screener_Watchlist
 *
 * SAFE: Never modifies existing sheets (MF_Data, MF_ATH, Stock_Data, etc.)
 */

/**
 * ONE-TIME SETUP — Create screener sheets + populate config defaults
 * Run this once from Script Editor or menu
 */
function setupScreenerSheets() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    'Setup Stock Screener',
    'This will create screener sheets:\n\n' +
    '• Screener_Config (settings)\n' +
    '• Screener_Watchlist (discovered stocks)\n\n' +
    'Existing sheets will NOT be modified.\n\n' +
    'Continue?',
    ui.ButtonSet.YES_NO
  );

  if (response !== ui.Button.YES) return;

  createScreenerConfigSheet();
  createScreenerWatchlistSheet();

  ui.alert(
    'Screener Setup Complete',
    'Screener sheets created.\n\n' +
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
    ['MAX_STOCKS', 8, 'Base max individual stocks in portfolio'],
    ['BONUS_SCORE_THRESHOLD', 75, 'Factor score threshold for bonus portfolio slots'],
    ['MAX_BONUS_SLOTS', 5, 'Max extra slots for high-conviction stocks'],
    ['MAX_PER_SECTOR', 2, 'Max stocks per sector'],
    ['ALLOC_TOP5', 10, 'Allocation % for top 5 factor-ranked stocks'],
    ['ALLOC_NEXT5', 7, 'Allocation % for rank 6-10 stocks'],
    ['ALLOC_REST', 5, 'Allocation % for rank 11+ stocks'],
    ['FACTOR_BUY_MIN', 50, 'Min factor score to generate BUY signal'],
    ['ALLOC_HIGH', 15, 'Max allocation for HIGH conviction ADD signals (%)'],
    ['ALLOC_MODERATE', 12, 'Max allocation for MODERATE conviction ADD signals (%)'],
    ['ALLOC_BASE', 10, 'Max allocation for BASE conviction ADD signals (%)'],
    ['RSI_OVERBOUGHT', 70, 'Block entry if RSI above this (overbought)'],
    ['MIN_MARKET_CAP_CR', 500, 'Min market cap in Cr — skip micro caps'],
    ['MIN_AVG_TRADED_VALUE_CR', 3, 'Min avg daily traded value (Cr) — liquidity filter'],
    ['TRAILING_STOP_0_20', 25, 'Trailing stop % for 0-20% gain'],
    ['TRAILING_STOP_20_50', 20, 'Trailing stop % for 20-50% gain'],
    ['TRAILING_STOP_50_100', 15, 'Trailing stop % for 50-100% gain'],
    ['TRAILING_STOP_100_PLUS', 12, 'Trailing stop % for 100%+ gain'],
    ['HARD_STOP_LOSS', 30, 'Hard stop loss from entry (%)'],
    ['ADD1_GAIN_PCT', 12, 'Min gain % for Add #1 trigger'],
    ['ADD1_MAX_GAIN_PCT', 25, 'Max gain % for Add #1 (above this wait for Add #2)'],
    ['ADD2_GAIN_PCT', 30, 'Min gain % for Add #2 trigger'],
    ['ADD_MIN_WEEKS', 2, 'Min weeks between adds'],
    ['DIP_BUY_MIN_DROP', 10, 'Min drop % for dip buy'],
    ['DIP_BUY_MAX_DROP', 20, 'Max drop % for dip buy (beyond = hard stop territory)'],
    ['DIP_BUY_RSI_MAX', 30, 'Max RSI for dip buy'],
    ['NIFTY_BELOW_200DMA_ALLOCATION', 120, 'Allocation % when Nifty below 200DMA — accumulate more (120% = buy 20% more)'],
    ['NIFTY_CRASH_PCT', 20, 'Crash alert if Nifty drops this % in 1 month'],
    ['SYSTEMIC_EXIT_COUNT', 3, 'Exit all if this many hard exits at same time'],
    ['SECTOR_ALERT_PCT', 35, 'Monthly sector concentration alert threshold (%)'],
    ['PORTFOLIO_FREEZE_PCT', 25, 'Freeze new buys if portfolio down this %']
  ];

  sheet.getRange(2, 1, rows.length, 3).setValues(rows);
  sheet.setColumnWidth(1, 260);
  sheet.setColumnWidth(2, 100);
  sheet.setColumnWidth(3, 350);
  sheet.setFrozenRows(1);

  Logger.log(name + ' created with ' + rows.length + ' config values');
  return sheet;
}

// --- Screener_Watchlist (50 columns A-AX) ---
// A-AB: Original columns (28)
// AC-AN: Factor scoring + liquidity columns (12)
// AO-AX: Trendlyne enrichment columns (10)
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
