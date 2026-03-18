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
    ['HIGH_CONVICTION_PCT', 15, 'Max allocation for 3+ screener stocks (%)'],
    ['MEDIUM_CONVICTION_PCT', 10, 'Max allocation for 2 screener stocks (%)'],
    ['COMPOUNDER_PCT', 12, 'Max allocation for Screener 4 stocks (%)'],
    ['TRAILING_STOP_0_20', 25, 'Trailing stop % for 0-20% gain'],
    ['TRAILING_STOP_20_50', 20, 'Trailing stop % for 20-50% gain'],
    ['TRAILING_STOP_50_100', 15, 'Trailing stop % for 50-100% gain'],
    ['TRAILING_STOP_100_PLUS', 12, 'Trailing stop % for 100%+ gain'],
    ['HARD_STOP_LOSS', 30, 'Hard stop loss from entry (%)'],
    ['PAPER_TRADING', 'TRUE', 'Paper trading mode — no real signals'],
    ['COMPOUNDER_STOP_40_100', 25, 'Compounder trailing stop at +40-99% gain'],
    ['COMPOUNDER_STOP_100_200', 20, 'Compounder trailing stop at +100-199% gain'],
    ['COMPOUNDER_STOP_200_PLUS', 15, 'Compounder trailing stop at +200%+ gain'],
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

// --- Screener_Watchlist (25 columns A-Y) ---
function createScreenerWatchlistSheet() {
  return _getOrCreateSheet(
    SCREENER_CONFIG.sheets.watchlist,
    [
      'Symbol', 'Stock Name', 'Date Found', 'Found Price',
      'Screeners Passing', 'Conviction', 'Cooling End Date', 'Status',
      'Current Price', 'Price Change %', 'RSI(14)',
      '50DMA', '200DMA', 'Golden Cross', '6M Return %',
      'Nifty 6M Return %', 'Relative Strength', 'Sector',
      'Nifty >200DMA', 'All BUY Met', 'Failed Conditions',
      'Last Updated', 'Notes',
      'Market Cap (Cr)', 'Cap Class',
      '1W Return %', '1M Return %', '1Y Return %'
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
      80, 80, 80
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
 * ONE-TIME BULK IMPORT — Manually seed the watchlist with stocks from all 4 screeners.
 * Run from Script Editor after setupScreenerSheets().
 * Maps NSE codes to screener numbers, deduplicates, and calls addToWatchlist().
 */
function bulkImportToWatchlist() {
  // --- Paste your stocks here: [NSE_CODE, Stock_Name, Screener_Numbers_Array] ---
  var stocks = [
    // Screener 1: CF-Multibagger-DNA
    ['ECLERX', 'eClerx Services', [1,3]],
    ['J&KBANK', 'Jammu & Kashmir Bank', [1]],
    ['JINDALSAW', 'Jindal Saw', [1]],
    ['INDIAMART', 'IndiaMART InterMESH', [1,2]],
    ['PRIVISCL', 'Privi Speciality', [1,2]],
    ['RAINBOW', 'Rainbow Childrens Medicare', [1,2]],
    ['LUMAXTECH', 'Lumax Auto Tech', [1]],
    ['BBTC', 'BBTC', [1]],
    ['ACE', 'ACE', [1]],
    ['WAAREERTL', 'Waaree Renewable', [1]],
    ['ELECON', 'Elecon Engineering', [1]],
    ['ESABINDIA', 'Esab', [1]],
    ['SYMPHONY', 'Symphony', [1]],
    ['FIEMIND', 'FIEM Industries', [1,2]],
    ['SWARAJENG', 'Swaraj Engines', [1]],
    ['EPIGRAL', 'Epigral', [1]],
    ['ROLEXRINGS', 'Rolex Rings', [1]],
    ['KRISHANA', 'Krishana Phoschem', [1,3]],
    ['POKARNA', 'Pokarna', [1]],
    ['MAYURUNIQ', 'Mayur Uniquoters', [1]],
    ['CANTABIL', 'Cantabil Retail', [1]],
    ['ANTELOPUS', 'Antelopus Selan Energy', [1]],
    ['EIHAHOTELS', 'EIH Asso Hotels', [1]],
    ['ACCELYA', 'Accelya Solutions', [1]],
    ['EXPLEOSOL', 'Expleo Solutions', [1]],
    ['ALLDIGI', 'Allsec Technologies', [1]],
    ['RAJOOENG', 'Rajoo Engineers', [1]],
    ['MAMATA', 'Mamata Machinery', [1]],
    ['AMAL', 'Amal', [1]],

    // Screener 2 only (not in 1): CF-SmartMoney-Flow
    ['HAL', 'Hindustan Aeronautics', [2]],
    ['BRITANNIA', 'Britannia Industries', [2]],
    ['VBL', 'Varun Beverages', [2]],
    ['PETRONET', 'Petronet LNG', [2]],
    ['NBCC', 'NBCC', [2]],
    ['LALPATHLAB', 'Dr. Lal Pathlabs', [2]],
    ['VIJAYA', 'Vijaya Diagnostic Centre', [2]],
    ['DODLA', 'Dodla Dairy', [2]],

    // Screener 3 only (not in 1): CF-Insider-Buying
    ['RATEGAIN', 'RateGain Travel', [3]],
    ['GATEWAY', 'Gateway Distriparks', [3]],
    ['JINDRILL', 'Jindal Drilling', [3]],
    ['INDSWFTLAB', 'Ind-Swift Laboratories', [3]],

    // Screener 4: CF-Compounder
    ['TORNTPHARM', 'Torrent Pharma', [4]]
  ];

  // Convert to addToWatchlist format
  var formatted = [];
  for (var i = 0; i < stocks.length; i++) {
    formatted.push({
      symbol: stocks[i][0],
      name: stocks[i][1],
      screeners: stocks[i][2]
    });
  }

  addToWatchlist(formatted);
  Logger.log('Bulk import complete: ' + stocks.length + ' stocks processed');
  SpreadsheetApp.getUi().alert('Bulk import complete!\n\n' + stocks.length + ' stocks added to watchlist.\n\nNext: Run "Update Watchlist Data" to fetch prices, RSI, and DMA.');
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
