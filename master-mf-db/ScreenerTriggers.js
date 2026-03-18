/**
 * ============================================================================
 * SCREENER TRIGGERS — Daily/weekly/monthly/quarterly trigger setup + main entry
 * ============================================================================
 *
 * SAFE: Only creates triggers for screener functions.
 * Does NOT modify existing triggers (refreshMutualFundData, dailyATHUpdate, etc.)
 */

/**
 * MAIN DAILY ENTRY POINT — Called by daily trigger at 9:30 AM IST
 *
 * Flow:
 * 1. Parse Trendlyne alert emails → add new stocks to watchlist
 * 2. Update market data for watchlist + holdings
 * 3. Check watchlist for BUY signals (all 11 conditions)
 * 4. Check holdings for ADD/EXIT signals
 * 5. Check portfolio-level conditions
 * 6. Send email for any new signals
 */
function dailyScreenerCheck() {
  const startTime = new Date();
  Logger.log('=== Daily Screener Check Started at ' + startTime + ' ===');

  try {
    const config = getAllScreenerConfig();

    // 1. DISCOVERY — Parse Trendlyne alert emails
    Logger.log('Step 1: Parsing Trendlyne emails...');
    const newStocks = parseTrendlyneAlerts();
    addToWatchlist(newStocks);

    // 2. MARKET DATA — Update prices, RSI, DMA for watchlist + holdings
    Logger.log('Step 2: Updating watchlist market data...');
    updateWatchlistMarketData();

    Logger.log('Step 2b: Updating holdings market data...');
    updateHoldingsMarketData();

    // 3. Get Nifty data (needed for BUY conditions + portfolio checks)
    Logger.log('Step 3: Fetching Nifty data...');
    const niftyData = getNiftyData();

    // 3b. Persist Nifty data to Screener_Config (for gas-webapp to read)
    _persistNiftyData(niftyData);

    // 4. BUY SIGNALS — Check watchlist (all 11 conditions)
    Logger.log('Step 4: Checking watchlist for BUY signals...');
    checkWatchlistForBuySignals(niftyData, config);

    // 5. ADD/EXIT SIGNALS — Check holdings
    Logger.log('Step 5: Checking holdings for ADD signals...');
    checkHoldingsForAddSignals(config);

    Logger.log('Step 5b: Checking holdings for EXIT signals...');
    checkHoldingsForExitSignals(config);

    // 6. PORTFOLIO-LEVEL — Freeze, crash, sector
    Logger.log('Step 6: Checking portfolio-level conditions...');
    checkPortfolioLevel(niftyData, config);

    // 7. BSE ANNOUNCEMENTS — keyword scan for holdings
    Logger.log('Step 7: Checking BSE announcements...');
    try {
      checkAnnouncementsForAllHoldings();
    } catch (bseErr) {
      Logger.log('BSE parser error (non-fatal): ' + bseErr.message);
    }

    // 8. SEND EMAILS — For any new pending signals
    Logger.log('Step 8: Sending signal emails...');
    sendSignalEmails();

    const duration = Math.round((new Date() - startTime) / 1000);
    Logger.log('=== Daily Screener Check Complete in ' + duration + 's ===');

  } catch (error) {
    Logger.log('ERROR in dailyScreenerCheck: ' + error.message);
    Logger.log('Stack: ' + error.stack);

    // Send error notification
    try {
      const email = Session.getEffectiveUser().getEmail();
      if (email) {
        MailApp.sendEmail({
          to: email,
          subject: '[Stock Screener] Daily Check Failed',
          body: 'Error: ' + error.message + '\n\nTime: ' + new Date() + '\n\nCheck Apps Script logs.'
        });
      }
    } catch (e) {
      Logger.log('Failed to send error email: ' + e.message);
    }
  }
}

/**
 * WEEKLY CHECK — Run on Sundays
 * Re-checks which screeners each holding still passes
 * Checks soft exits #1-6
 */
function weeklyScreenerRecheck() {
  Logger.log('=== Weekly Screener Recheck ===');

  try {
    // Update market data for holdings
    updateHoldingsMarketData();
    updateWatchlistMarketData();

    // Check soft exits via screener deterioration (holdings losing screener coverage)
    // This is a lighter check than quarterly — just price-based + BSE announcements
    const config = getAllScreenerConfig();
    checkHoldingsForExitSignals(config);

    // BSE announcements (catches auditor changes, SEBI, KMP etc.)
    checkAnnouncementsForAllHoldings();

    // Send any new signals
    sendSignalEmails();

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
  Logger.log('=== Monthly Sector Check ===');
  const config = getAllScreenerConfig();
  const niftyData = getNiftyData();
  checkPortfolioLevel(niftyData, config);
  sendSignalEmails();
  Logger.log('Monthly sector check complete');
}

/**
 * QUARTERLY CHECK — Run every 3 months
 * Full fundamental re-check via Screener.in
 */
function quarterlyFundamentalCheck() {
  // Only run full check in Jan, Apr, Jul, Oct (quarter months)
  const month = new Date().getMonth(); // 0-indexed
  if (month !== 0 && month !== 3 && month !== 6 && month !== 9) {
    Logger.log('Not a quarter month (' + (month + 1) + '), skipping quarterly check');
    return;
  }

  Logger.log('=== Quarterly Fundamental Check ===');

  try {
    // Full Screener.in fundamental check for all holdings
    quarterlyFundamentalCheckAll();

    // Portfolio rebalance check
    const config = getAllScreenerConfig();
    const niftyData = getNiftyData();
    checkPortfolioLevel(niftyData, config);

    // Send signals
    sendSignalEmails();

    Logger.log('Quarterly fundamental check complete');
  } catch (error) {
    Logger.log('ERROR in quarterlyFundamentalCheck: ' + error.message);
  }
}

// ============================================================================
// TRIGGER MANAGEMENT
// ============================================================================

/**
 * Install all screener triggers
 * - Daily at 9:30 AM IST (after market opens)
 * - Weekly on Sunday
 * - Monthly on 1st
 */
function installScreenerTriggers() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    'Install Screener Triggers',
    'This will install:\n\n' +
    '• Daily trigger at 9:30 AM (main screener check)\n' +
    '• Weekly trigger on Sundays (screener recheck)\n' +
    '• Monthly trigger on 1st (sector check)\n\n' +
    'Existing MF/ATH triggers will NOT be affected.\n\n' +
    'Continue?',
    ui.ButtonSet.YES_NO
  );

  if (response !== ui.Button.YES) return;

  // Remove existing screener triggers first
  _removeScreenerTriggers();

  // Daily at 9:30 AM
  ScriptApp.newTrigger('dailyScreenerCheck')
    .timeBased()
    .atHour(9)
    .nearMinute(30)
    .everyDays(1)
    .create();

  // Weekly on Sunday
  ScriptApp.newTrigger('weeklyScreenerRecheck')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.SUNDAY)
    .atHour(10)
    .create();

  // Monthly on 1st
  ScriptApp.newTrigger('monthlySectorCheck')
    .timeBased()
    .onMonthDay(1)
    .atHour(10)
    .create();

  // Quarterly on 1st of Jan, Apr, Jul, Oct (use monthly trigger + check month)
  ScriptApp.newTrigger('quarterlyFundamentalCheck')
    .timeBased()
    .onMonthDay(1)
    .atHour(11)
    .create();

  Logger.log('All screener triggers installed');

  ui.alert(
    'Triggers Installed',
    'Stock screener triggers are now active:\n\n' +
    '• Daily check at ~9:30 AM\n' +
    '• Weekly recheck on Sundays\n' +
    '• Monthly sector check on 1st\n' +
    '• Quarterly fundamental check on 1st (runs monthly, full check quarterly)\n\n' +
    'Paper trading is ON by default. Check Screener_Config to adjust.',
    ui.ButtonSet.OK
  );
}

/**
 * Remove all screener triggers (doesn't touch MF/ATH triggers)
 */
function removeScreenerTriggers() {
  _removeScreenerTriggers();
  SpreadsheetApp.getUi().alert('All screener triggers removed.');
}

function _removeScreenerTriggers() {
  const screenerFunctions = [
    'dailyScreenerCheck',
    'weeklyScreenerRecheck',
    'monthlySectorCheck',
    'quarterlyFundamentalCheck'
  ];

  const triggers = ScriptApp.getProjectTriggers();
  let removed = 0;

  for (let i = 0; i < triggers.length; i++) {
    if (screenerFunctions.indexOf(triggers[i].getHandlerFunction()) !== -1) {
      ScriptApp.deleteTrigger(triggers[i]);
      removed++;
    }
  }

  Logger.log('Removed ' + removed + ' screener triggers');
}

/**
 * Persist Nifty data to Screener_Config so gas-webapp can read it
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
 * Run daily check manually (for testing)
 */
function manualDailyCheck() {
  dailyScreenerCheck();
}
