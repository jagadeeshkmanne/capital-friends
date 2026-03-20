/**
 * ============================================================================
 * SCREENER — Per-user signal engine for stock screener integration
 * ============================================================================
 *
 * Reads shared data from Master DB (watchlist, Nifty, config defaults).
 * Reads user holdings from their StockHoldings sheet.
 * Reads screener metadata from their Screener_StockMeta sheet.
 * Generates BUY/ADD/EXIT signals into their Screener_Signals sheet.
 *
 * NEVER writes to Master DB. NEVER modifies StockHoldings/Transactions.
 */

// ============================================================================
// READ FROM MASTER DB (shared, read-only)
// ============================================================================

/**
 * Read the screener watchlist from Master DB.
 * Returns array of watchlist stock objects with market data.
 */
function readScreenerWatchlist() {
  ensureScreenerSheets();
  try {
    var masterDb = openMasterDB();
    var sheet = masterDb.getSheetByName(CONFIG.masterScreenerWatchlistSheet);
    if (!sheet) return [];

    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];

    var data = sheet.getRange(2, 1, lastRow - 1, 55).getValues(); // A-BC (55 cols, includes sub-scores)
    var stocks = [];

    for (var i = 0; i < data.length; i++) {
      var sym = String(data[i][0]).trim();
      if (!sym) continue;

      stocks.push({
        symbol: sym,
        name: String(data[i][1]).trim(),
        dateFound: data[i][2],
        foundPrice: parseFloat(data[i][3]) || 0,
        screeners: String(data[i][4]).trim(),           // E: "1", "1,2", "1,2,3" (screener numbers)
        conviction: String(data[i][5]).trim() || '',    // F: Conviction (MF overlay)
        coolingEnd: data[i][6],                          // G: Cooling End Date
        status: String(data[i][7]).trim(),               // H: NEW, COOLING, ELIGIBLE, EXPIRED
        currentPrice: parseFloat(data[i][8]) || 0,       // I: Current Price
        priceChangePct: parseFloat(data[i][9]) || 0,     // J: Since Found %
        rsi: parseFloat(data[i][10]) || 50,              // K: RSI
        dma50: parseFloat(data[i][11]) || 0,             // L: 50DMA
        dma200: parseFloat(data[i][12]) || 0,            // M: 200DMA
        goldenCross: String(data[i][13]).trim(),         // N: YES/NO
        return6m: parseFloat(data[i][14]) || 0,          // O: 6M Return %
        niftyReturn6m: parseFloat(data[i][15]) || 0,     // P: Nifty 6M Return %
        relativeStrength: String(data[i][16]).trim(),    // Q: PASS/FAIL
        sector: String(data[i][17]).trim(),              // R: Sector
        niftyAbove200DMA: String(data[i][18]).trim(),    // S: YES/NO
        allBuyMet: String(data[i][19]).trim(),           // T: YES/NO
        failedConditions: String(data[i][20]).trim(),    // U: Failed Conditions
        lastUpdated: data[i][21],                        // V: Last Updated
        marketCapCr: parseFloat(data[i][23]) || 0,       // X: Market Cap (Cr)
        capClass: String(data[i][24]).trim() || '',      // Y: Cap Class
        return1w: parseFloat(data[i][25]) || null,       // Z: 1W Return %
        return1m: parseFloat(data[i][26]) || null,       // AA: 1M Return %
        return1y: parseFloat(data[i][27]) || null,       // AB: 1Y Return %
        // Factor scoring columns (AC-AN)
        pe: parseFloat(data[i][28]) || null,             // AC: PE
        roe: parseFloat(data[i][29]) || null,            // AD: ROE %
        piotroski: parseFloat(data[i][30]) || null,      // AE: Piotroski
        profitGrowth: parseFloat(data[i][31]) || null,   // AF: Profit Growth %
        debtToEquity: parseFloat(data[i][32]) || null,   // AG: Debt/Equity
        diiHolding: parseFloat(data[i][33]) || null,     // AH: DII Holding %
        diiChange: parseFloat(data[i][34]) || null,      // AI: DII Change QoQ
        high52w: parseFloat(data[i][35]) || null,        // AJ: 52W High
        drawdown: parseFloat(data[i][36]) || null,       // AK: Drawdown %
        factorScore: parseFloat(data[i][37]) || 0,       // AL: Factor Score
        factorRank: parseInt(data[i][38]) || 99,         // AM: Factor Rank
        avgTradedValCr: parseFloat(data[i][39]) || 0,    // AN: Avg Daily Traded Value (Cr)
        // Trendlyne enrichment columns (AO-AX)
        promoterPledge: parseFloat(data[i][40]) || null,  // AO: Promoter Pledge %
        fiiHolding: parseFloat(data[i][41]) || null,      // AP: FII Holding %
        fiiChange: parseFloat(data[i][42]) || null,       // AQ: FII Change QoQ
        interestCoverage: parseFloat(data[i][43]) || null, // AR: Interest Coverage
        epsGrowth: parseFloat(data[i][44]) || null,       // AS: EPS Growth TTM %
        priceToBook: parseFloat(data[i][45]) || null,     // AT: Price to Book
        opmQtr: parseFloat(data[i][46]) || null,          // AU: OPM Qtr %
        revenueGrowth3y: parseFloat(data[i][47]) || null, // AV: Revenue Growth 3Y %
        promoterHolding: parseFloat(data[i][48]) || null,  // AW: Promoter Holding %
        mcapClass: String(data[i][49]).trim() || '',       // AX: MCAP Class
        // Factor sub-scores (AY-BC) — computed by Master DB scoring
        momentumScore: parseFloat(data[i][50]) || null,    // AY: Momentum Score
        qualityScore: parseFloat(data[i][51]) || null,     // AZ: Quality Score
        trendScore: parseFloat(data[i][52]) || null,       // BA: Trend Score
        valueScore: parseFloat(data[i][53]) || null,       // BB: Value Score
        lowVolScore: parseFloat(data[i][54]) || null       // BC: Low Vol Score
      });
    }

    return stocks;
  } catch (e) {
    Logger.log('Error reading screener watchlist: ' + e.message);
    return [];
  }
}

/**
 * Read Nifty data from Master DB's Screener_Config (persisted by daily check).
 */
function readNiftyDataFromMasterDB() {
  try {
    var masterDb = openMasterDB();
    var sheet = masterDb.getSheetByName(CONFIG.masterScreenerConfigSheet);
    if (!sheet) return _defaultNiftyData();

    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return _defaultNiftyData();

    var data = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
    var config = {};
    for (var i = 0; i < data.length; i++) {
      config[String(data[i][0])] = data[i][1];
    }

    var dma200 = parseFloat(config.NIFTY_200DMA) || null;

    // Use live Nifty price from MarketData (GOOGLEFINANCE/NSE API, 5-min cache)
    // Fall back to Master DB's stale price if live fetch fails
    var livePrice = null;
    try {
      var marketData = getMarketData();
      if (marketData && marketData.indices) {
        for (var j = 0; j < marketData.indices.length; j++) {
          if (marketData.indices[j].name === 'Nifty 50') {
            livePrice = marketData.indices[j].price;
            break;
          }
        }
      }
    } catch (e) {
      Logger.log('Live Nifty price fetch failed, using Master DB: ' + e.message);
    }

    var price = livePrice || parseFloat(config.NIFTY_PRICE) || null;
    var aboveDMA200 = (price && dma200) ? price > dma200 : (config.NIFTY_ABOVE_200DMA === 'TRUE' || config.NIFTY_ABOVE_200DMA === true);

    return {
      price: price,
      dma200: dma200,
      aboveDMA200: aboveDMA200,
      return1m: parseFloat(config.NIFTY_RETURN_1M) || null,
      return6m: parseFloat(config.NIFTY_RETURN_6M) || null,
      midcapReturn6m: parseFloat(config.MIDCAP150_RETURN_6M) || null,
      smallcapReturn6m: parseFloat(config.SMALLCAP250_RETURN_6M) || null,
      lastUpdated: livePrice ? new Date().toISOString() : (config.NIFTY_LAST_UPDATED || null),
      isLive: !!livePrice
    };
  } catch (e) {
    Logger.log('Error reading Nifty data from Master DB: ' + e.message);
    return _defaultNiftyData();
  }
}

function _defaultNiftyData() {
  return { price: null, dma200: null, aboveDMA200: null, return1m: null, return6m: null, midcapReturn6m: null, smallcapReturn6m: null, lastUpdated: null };
}

// ============================================================================
// READ FROM USER SHEET
// ============================================================================

/**
 * Default screener config values — single source of truth.
 * Used for reading config and auto-creating missing keys in user sheet.
 */
var SCREENER_DEFAULTS = {
  STOCK_BUDGET: 300000,
  MAX_STOCKS: 8,
  BONUS_SCORE_THRESHOLD: 75,
  MAX_BONUS_SLOTS: 5,
  MAX_PER_SECTOR: 2,
  // BUY allocation by factor rank (% of budget)
  ALLOC_TOP5: 10,
  ALLOC_NEXT5: 7,
  ALLOC_REST: 5,
  FACTOR_BUY_MIN: 50,
  // ADD allocation by conviction (% of budget)
  ALLOC_HIGH: 15,
  ALLOC_MODERATE: 12,
  ALLOC_BASE: 10,
  RSI_OVERBOUGHT: 70,
  MIN_MARKET_CAP_CR: 500,
  MIN_AVG_TRADED_VALUE_CR: 3,
  HARD_STOP_LOSS: 30,
  TRAILING_STOP_0_20: 25,
  TRAILING_STOP_20_50: 20,
  TRAILING_STOP_50_100: 15,
  TRAILING_STOP_100_PLUS: 12,
  ADD1_GAIN_PCT: 12,
  ADD1_MAX_GAIN_PCT: 25,
  ADD2_GAIN_PCT: 30,
  ADD_MIN_WEEKS: 2,
  DIP_BUY_MIN_DROP: 10,
  DIP_BUY_MAX_DROP: 20,
  DIP_BUY_RSI_MAX: 30,
  SKIP_NIFTY_GATE: false,
  SKIP_COOLING_PERIOD: false,
  NIFTY_BELOW_200DMA_ALLOCATION: 120,
  NIFTY_CRASH_PCT: 20,
  SYSTEMIC_EXIT_COUNT: 3,
  SECTOR_ALERT_PCT: 35,
  PORTFOLIO_FREEZE_PCT: 25,
  STALE_AFTER_DAYS: 30,
  // Paper trading & holding lock
  PAPER_TRADING: true,
  HOLDING_PERIOD_DAYS: 30,
  PAPER_HOLDING_PERIOD_DAYS: 1,
  // Triggers
  HOURLY_PRICE_CHECK: true,
  // Signal tracking
  SIGNAL_TRACK_DAYS: '7,14,30'
};

/**
 * Read user's screener config.
 * Priority: User sheet > Master DB > Code defaults
 * Auto-creates missing keys (from code defaults + Master DB) into user sheet.
 */
function readScreenerConfig() {
  ensureScreenerSheets();

  // 1. Start with code defaults
  var allDefaults = {};
  for (var k in SCREENER_DEFAULTS) {
    allDefaults[k] = SCREENER_DEFAULTS[k];
  }

  // 2. Merge Master DB config (picks up new keys added to Master DB before code update)
  try {
    var masterDb = openMasterDB();
    var masterSheet = masterDb.getSheetByName(CONFIG.masterScreenerConfigSheet);
    if (masterSheet) {
      var masterLastRow = masterSheet.getLastRow();
      if (masterLastRow >= 2) {
        var masterData = masterSheet.getRange(2, 1, masterLastRow - 1, 2).getValues();
        for (var i = 0; i < masterData.length; i++) {
          var mKey = String(masterData[i][0]).trim();
          if (mKey && mKey.indexOf('NIFTY_') !== 0) { // Skip Nifty data rows
            allDefaults[mKey] = _parseConfigValue(masterData[i][1]);
          }
        }
      }
    }
  } catch (e) {
    Logger.log('Error reading master config (non-blocking): ' + e.message);
  }

  // 3. Read user sheet — user values take final priority
  var config = {};
  for (var dk in allDefaults) {
    config[dk] = allDefaults[dk];
  }

  var ss = getSpreadsheet();
  var userSheet = ss.getSheetByName(CONFIG.screenerUserConfigSheet);
  if (!userSheet) return config;

  var userLastRow = userSheet.getLastRow();
  var existingKeys = {};

  if (userLastRow > 2) { // Row 1=credit, Row 2=header, Row 3+=data
    var userData = userSheet.getRange(3, 1, userLastRow - 2, 2).getValues();
    for (var j = 0; j < userData.length; j++) {
      var uKey = String(userData[j][0]).trim();
      if (uKey) {
        existingKeys[uKey] = true;
        config[uKey] = _parseConfigValue(userData[j][1]);
      }
    }
  }

  // 4. Auto-create missing keys in user sheet (from code defaults + Master DB)
  var missingRows = [];
  for (var ak in allDefaults) {
    if (!existingKeys[ak]) {
      var val = allDefaults[ak];
      if (val === true) val = 'TRUE';
      if (val === false) val = 'FALSE';
      missingRows.push([ak, val, '']);
    }
  }
  if (missingRows.length > 0) {
    for (var m = 0; m < missingRows.length; m++) {
      userSheet.appendRow(missingRows[m]);
    }
    Logger.log('Auto-created ' + missingRows.length + ' missing config keys: ' + missingRows.map(function(r) { return r[0]; }).join(', '));
  }

  return config;
}

function _parseConfigValue(val) {
  if (val === 'TRUE' || val === true) return true;
  if (val === 'FALSE' || val === false) return false;
  var num = parseFloat(val);
  if (!isNaN(num) && String(val).trim() !== '') return num;
  return val;
}

/**
 * Smart share calculation: rounds up if buying 1 more share is within 20% overshoot.
 * E.g., ₹9K budget / ₹5444 price = 1.65 → floor=1 (wastes ₹3556). Ceil=2 costs ₹10888 (21% over).
 * At 20% threshold: 1.65 rounds up to 2 since 2*5444=10888 < 9000*1.2=10800... actually 10888>10800 so stays 1.
 * But ₹9K/₹255 = 35.3 → stays 35 (rounding up to 36 costs ₹9180, only 2% over → rounds up).
 * Ensures minimum 1 share if price <= allocation * 1.2.
 */
function _smartShares(allocation, price) {
  if (!price || price <= 0) return 0;
  var exact = allocation / price;
  var floored = Math.floor(exact);
  var ceiled = floored + 1;

  // If we can't afford even 1 share, check if price is within 20% overshoot
  if (floored === 0) {
    return price <= allocation * 1.2 ? 1 : 0;
  }

  // If rounding up is within 20% of allocation, round up
  if (ceiled * price <= allocation * 1.2) {
    return ceiled;
  }
  return floored;
}

/**
 * Read user's Screener_StockMeta sheet.
 * Returns object keyed by symbol for easy lookup.
 */
function getScreenerStockMeta() {
  ensureScreenerSheets();
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.screenerStockMetaSheet);
  if (!sheet) return {};

  var lastRow = sheet.getLastRow();
  if (lastRow < 3) return {}; // Row 1=credit, Row 2=header

  var data = sheet.getRange(3, 1, lastRow - 2, 19).getValues();
  var meta = {};

  for (var i = 0; i < data.length; i++) {
    var sym = String(data[i][0]).trim();
    if (!sym) continue;

    meta[sym] = {
      row: i + 3,
      symbol: sym,
      name: String(data[i][1]).trim(),
      sector: String(data[i][2]).trim(),
      entryDate: data[i][3],
      entryPrice: parseFloat(data[i][4]) || 0,
      peakPrice: parseFloat(data[i][5]) || 0,
      pyramidStage: String(data[i][6]).trim() || 'STARTER',
      dipBuyUsed: String(data[i][7]).trim() === 'YES',
      screenersStr: String(data[i][8]).trim(),
      conviction: String(data[i][9]).trim(),
      isCompounder: String(data[i][10]).trim() === 'YES',
      trailingStopPrice: parseFloat(data[i][11]) || 0,
      stopTier: String(data[i][12]).trim(),
      lastFundamentalCheck: data[i][13],
      notes: String(data[i][14]).trim(),
      lockedBudget: parseFloat(data[i][15]) || 0,
      lockedAllocation: parseFloat(data[i][16]) || 0,
      add1Amount: parseFloat(data[i][17]) || 0,
      add2Amount: parseFloat(data[i][18]) || 0
    };
  }

  return meta;
}

/**
 * Bridge function: Read user's StockHoldings + join with Screener_StockMeta.
 * Returns holdings in the format the signal engine expects.
 */
function _getUserHoldingsForScreener() {
  var ss = getSpreadsheet();
  var holdingsSheet = ss.getSheetByName(CONFIG.stockHoldingsSheet);
  if (!holdingsSheet) return [];

  var lastRow = holdingsSheet.getLastRow();
  if (lastRow < 3) return []; // Row 1=credit, Row 2=header

  var data = holdingsSheet.getRange(3, 1, lastRow - 2, 15).getValues();
  var meta = getScreenerStockMeta();

  var holdings = [];
  for (var i = 0; i < data.length; i++) {
    var sym = String(data[i][2]).trim(); // Column C = Stock Symbol
    if (!sym) continue;

    var qty = parseFloat(data[i][6]) || 0; // Column G = Total Quantity
    if (qty <= 0) continue;

    var avgPrice = parseFloat(data[i][7]) || 0;   // Column H = Average Buy Price
    var currentPrice = parseFloat(data[i][9]) || 0; // Column J = Current Price
    var sector = String(data[i][13]).trim();         // Column N = Sector

    // Join with screener metadata
    var m = meta[sym] || {};

    holdings.push({
      symbol: sym,
      name: String(data[i][3]).trim(),        // Column D = Company Name
      sector: sector || m.sector || '',
      entryDate: m.entryDate || null,
      entryPrice: m.entryPrice || avgPrice,
      totalShares: qty,
      totalInvested: parseFloat(data[i][8]) || 0, // Column I = Total Investment
      avgPrice: avgPrice,
      currentPrice: currentPrice,
      peakPrice: m.peakPrice || currentPrice,
      pyramidStage: m.pyramidStage || 'STARTER',
      dipBuyUsed: m.dipBuyUsed || false,
      screenersStr: m.screenersStr || '',
      conviction: m.conviction || '',
      isCompounder: m.isCompounder || false,
      rsi: 50, // Not available from StockHoldings — would need market data
      dma50: 0,
      dma200: 0,
      hasScreenerMeta: !!meta[sym],
      lockedBudget: m.lockedBudget || 0,
      lockedAllocation: m.lockedAllocation || 0,
      add1Amount: m.add1Amount || 0,
      add2Amount: m.add2Amount || 0
    });
  }

  return holdings;
}

// ============================================================================
// SIGNAL GENERATION
// ============================================================================

/**
 * Main signal generation — the core function called by React app.
 * Reads watchlist from Master DB, holdings from user sheet, generates signals.
 */
function generateUserSignals() {
  ensureScreenerSheets();
  var startTime = new Date();
  Logger.log('=== Generate User Signals Started ===');

  var config = readScreenerConfig();

  // Clean up stale PENDING signals older than STALE_AFTER_DAYS
  _cleanupStaleSignals(config.STALE_AFTER_DAYS || 30);

  var niftyData = readNiftyDataFromMasterDB();
  var watchlist = readScreenerWatchlist();
  var holdings = _getUserHoldingsForScreener();

  // Build watchlist lookup for enriching holdings with live market data (RSI, DMA)
  var watchlistBySymbol = {};
  for (var wi = 0; wi < watchlist.length; wi++) {
    watchlistBySymbol[watchlist[wi].symbol] = watchlist[wi];
  }

  // Enrich holdings with live RSI/DMA from watchlist (if stock is in watchlist)
  for (var hi = 0; hi < holdings.length; hi++) {
    var wData = watchlistBySymbol[holdings[hi].symbol];
    if (wData) {
      holdings[hi].rsi = wData.rsi;
      holdings[hi].dma50 = wData.dma50;
      holdings[hi].dma200 = wData.dma200;
    }
  }

  // If paper trading is enabled, merge paper positions into holdings for signal generation.
  // This prevents duplicate BUY signals for stocks already paper-held.
  if (config.PAPER_TRADING) {
    var paperPositions = _getPaperPositions('OPEN');
    for (var pSym in paperPositions) {
      var pp = paperPositions[pSym];
      // Only add if NOT already in real holdings
      var alreadyHeld = false;
      for (var rh = 0; rh < holdings.length; rh++) {
        if (holdings[rh].symbol === pSym) { alreadyHeld = true; break; }
      }
      if (!alreadyHeld) {
        var wlData = watchlistBySymbol[pSym] || {};
        holdings.push({
          symbol: pp.symbol,
          name: pp.name,
          sector: wlData.sector || '',
          entryDate: pp.date,
          entryPrice: pp.price,
          totalShares: pp.shares,
          totalInvested: pp.amount,
          avgPrice: pp.price,
          currentPrice: wlData.currentPrice || pp.price,
          peakPrice: Math.max(wlData.currentPrice || 0, pp.price),
          pyramidStage: pp.signalType === 'ADD1' ? 'ADD1' : pp.signalType === 'ADD2' ? 'ADD2' : 'STARTER',
          dipBuyUsed: pp.signalType === 'DIP_BUY',
          screenersStr: wlData.screeners || '',
          conviction: wlData.conviction || 'BASE',
          isCompounder: false,
          rsi: wlData.rsi || 50,
          dma50: wlData.dma50 || 0,
          dma200: wlData.dma200 || 0,
          hasScreenerMeta: true,
          isPaperPosition: true, // flag to distinguish from real holdings
          lockedBudget: 0, lockedAllocation: 0, add1Amount: 0, add2Amount: 0
        });
      }
    }
  }

  // Build quick lookup of owned symbols (real + paper)
  var ownedSymbols = {};
  for (var h = 0; h < holdings.length; h++) {
    ownedSymbols[holdings[h].symbol] = holdings[h];
  }

  // Count holdings and sectors for BUY checks
  var holdingCount = holdings.length;
  var sectorCounts = {};
  var totalInvested = 0;
  for (var s = 0; s < holdings.length; s++) {
    var sect = holdings[s].sector || 'Unknown';
    sectorCounts[sect] = (sectorCounts[sect] || 0) + 1;
    totalInvested += holdings[s].totalInvested || 0;
  }

  var budget = config.STOCK_BUDGET || 300000;
  var cashAvailable = budget - totalInvested;

  // --- CHECK WATCHLIST FOR BUY SIGNALS (stocks NOT owned) ---
  // Two-pass: collect candidates, then rank-select top N (remaining portfolio slots)
  var buyCandidates = [];
  for (var w = 0; w < watchlist.length; w++) {
    var stock = watchlist[w];
    if (stock.status === 'EXPIRED') continue; // always skip expired
    if (stock.status !== 'ELIGIBLE' && !config.SKIP_COOLING_PERIOD) continue;
    if (ownedSymbols[stock.symbol]) continue; // already owned → skip BUY (check ADD instead)

    // Factor-based allocation: rank determines size, overlap adjusts, regime scales
    var factorScore = stock.factorScore || 0;
    var factorRank = stock.factorRank || 99;
    var maxAllocPct = _getAllocationByRank(factorRank, config);

    // Overlap-based position sizing: 1 screener → 0.8x, 2 → 1.0x, 3 → 1.2x
    var screenersStr = stock.screeners || '';
    var screenerCount = 0;
    if (screenersStr && screenersStr !== 'CF-Stock-Screener') {
      screenerCount = screenersStr.split(',').filter(function(s) { return s.trim() !== ''; }).length;
    } else if (screenersStr === 'CF-Stock-Screener') {
      screenerCount = 1;
    }
    var overlapMultiplier = _getOverlapAllocationMultiplier(screenerCount);
    var starterAmount = budget * (maxAllocPct / 100) * 0.65 * overlapMultiplier;

    // Market regime multiplier (graduated, not binary)
    var regimeMultiplier = _getMarketRegimeMultiplier(niftyData, config);

    // Momentum-only guard: max 2 momentum-only stocks in portfolio + candidates
    var isMomentumOnly = screenersStr === 'CF-Momentum';
    if (isMomentumOnly) {
      var momentumOnlyHeld = holdings.filter(function(h) { return h.screenersStr === 'CF-Momentum'; }).length;
      var momentumOnlyCandidates = buyCandidates.filter(function(c) { return c.screenersStr === 'CF-Momentum'; }).length;
      if (momentumOnlyHeld + momentumOnlyCandidates >= 2) {
        continue; // skip — momentum-only limit reached
      }
    }

    var failed = _checkBuyConditions(stock, config, niftyData, holdingCount, sectorCounts, cashAvailable, starterAmount, factorScore, regimeMultiplier);

    if (failed.length === 0) {
      buyCandidates.push({
        stock: stock, factorScore: factorScore, factorRank: factorRank,
        maxAllocPct: maxAllocPct, starterAmount: starterAmount, regimeMultiplier: regimeMultiplier,
        screenersStr: screenersStr, screenerCount: screenerCount, overlapMultiplier: overlapMultiplier
      });
    }
  }

  // Rank-select: sort by factor score (highest first), take top N slots
  // Dynamic slots: base MAX_STOCKS + bonus for high-conviction candidates (score >= threshold)
  var baseMax = config.MAX_STOCKS || 10;
  var bonusThreshold = config.BONUS_SCORE_THRESHOLD || 75;
  var maxBonus = config.MAX_BONUS_SLOTS || 5;
  buyCandidates.sort(function(a, b) { return b.factorScore - a.factorScore; });
  var highConvictionCount = buyCandidates.filter(function(c) { return c.factorScore >= bonusThreshold; }).length;
  var bonusSlots = Math.min(highConvictionCount, maxBonus);
  var effectiveMax = baseMax + bonusSlots;
  var remainingSlots = Math.max(0, effectiveMax - holdingCount);
  if (bonusSlots > 0) {
    log('Dynamic slots: base ' + baseMax + ' + ' + bonusSlots + ' bonus (≥' + bonusThreshold + ' score) = ' + effectiveMax + ' effective max');
  }
  var topBuys = buyCandidates.slice(0, remainingSlots);

  for (var tb = 0; tb < topBuys.length; tb++) {
    var cand = topBuys[tb];
    var adjustedAllocation = Math.round(cand.starterAmount * cand.regimeMultiplier);
    var shares = _smartShares(adjustedAllocation, cand.stock.currentPrice);

    // Skip if allocation too small for even 1 share
    if (shares <= 0) {
      Logger.log('Skipping ' + cand.stock.symbol + ' — allocation ₹' + adjustedAllocation +
        ' too small for price ₹' + cand.stock.currentPrice);
      continue;
    }

    var actualAmount = shares * cand.stock.currentPrice;
    var liqStr = cand.stock.avgTradedValCr > 0 ? (', Liq: ₹' + cand.stock.avgTradedValCr.toFixed(1) + 'Cr/day') : '';

    _createUserSignal({
      type: 'BUY_STARTER',
      symbol: cand.stock.symbol,
      name: cand.stock.name,
      amount: Math.round(actualAmount),
      shares: shares,
      currentPrice: cand.stock.currentPrice,
      triggerDetail: 'Factor: ' + cand.factorScore + ' (Rank #' + cand.factorRank + '), ' +
        'Screeners: ' + (cand.screenersStr || 'N/A') + ' (' + cand.screenerCount + '×, alloc ' + Math.round(cand.overlapMultiplier * 100) + '%), ' +
        'RSI: ' + cand.stock.rsi +
        ', Golden Cross: ' + cand.stock.goldenCross +
        ', 6M vs Nifty: ' + cand.stock.return6m + '% vs ' + (niftyData.return6m || 'N/A') + '%' +
        ', Regime: ' + Math.round(cand.regimeMultiplier * 100) + '%' + liqStr,
      conviction: cand.stock.conviction || 'BASE',
      factorScore: cand.factorScore,
      factorRank: cand.factorRank
    }, config);

    // Auto-write Screener_StockMeta with locked allocation amounts
    var totalAllocation = budget * (cand.maxAllocPct / 100);
    _createOrUpdateStockMeta(cand.stock.symbol, {
      name: cand.stock.name,
      sector: cand.stock.sector,
      screeners: cand.screenersStr || cand.stock.screeners || '',
      conviction: cand.stock.conviction || 'BASE',
      factorScore: cand.factorScore,
      factorRank: cand.factorRank,
      lockedBudget: budget,
      lockedAllocation: totalAllocation,
      add1Amount: totalAllocation * 0.25,
      add2Amount: totalAllocation * 0.25
    });
  }

  if (buyCandidates.length > topBuys.length) {
    Logger.log('Rank selection: ' + buyCandidates.length + ' candidates, took top ' + topBuys.length +
      '. Skipped: ' + buyCandidates.slice(topBuys.length).map(function(c) { return c.stock.symbol + '(' + c.factorScore + ')'; }).join(', '));
  }

  // --- CHECK OWNED STOCKS FOR ADD SIGNALS (stocks in watchlist AND owned) ---
  // Pre-check: portfolio freeze and Nifty gate apply to ADD signals too
  var portfolioFrozen = false;
  if (totalInvested > 0) {
    var totalCurrentVal = 0;
    for (var pf = 0; pf < holdings.length; pf++) {
      totalCurrentVal += (holdings[pf].currentPrice || 0) * (holdings[pf].totalShares || 0);
    }
    var pfPnlPct = ((totalCurrentVal - totalInvested) / totalInvested) * 100;
    if (pfPnlPct <= -(config.PORTFOLIO_FREEZE_PCT || 25)) portfolioFrozen = true;
  }

  for (var a = 0; a < holdings.length; a++) {
    var holding = holdings[a];
    if (!holding.hasScreenerMeta) continue; // Only check stocks tracked by screener
    if (!holding.currentPrice || !holding.entryPrice) continue;

    var costBasis = holding.avgPrice > 0 ? holding.avgPrice : holding.entryPrice;
    var gainPct = ((holding.currentPrice - costBasis) / costBasis) * 100;
    var timeSinceEntry = holding.entryDate ? (new Date() - new Date(holding.entryDate)) / (1000 * 60 * 60 * 24) : 999;

    // --- ADD #1 ---
    if (holding.pyramidStage === 'STARTER' && !holding.dipBuyUsed) {
      var add1Min = config.ADD1_GAIN_PCT || 12;
      var add1Max = config.ADD1_MAX_GAIN_PCT || 25;
      var minWeeks = config.ADD_MIN_WEEKS || 2;

      if (gainPct >= add1Min && gainPct <= add1Max && timeSinceEntry >= minWeeks * 7) {
        // Guard: skip ADD if portfolio frozen, Nifty below 200DMA (unless gate skipped), or no cash
        if (portfolioFrozen) continue;
        if (niftyData.aboveDMA200 === false && !config.SKIP_NIFTY_GATE) continue;

        // Use locked ADD1 amount from StockMeta, fallback to current budget calculation
        var addAmount = holding.add1Amount;
        if (!addAmount || addAmount <= 0) {
          var addConviction = holding.conviction || 'BASE';
          var addAllocPct = _getMaxAllocationPct(addConviction, config);
          addAmount = budget * (addAllocPct / 100) * 0.25;
        }
        if (addAmount > cashAvailable) continue; // Not enough cash

        var addShares = _smartShares(addAmount, holding.currentPrice);

        _createUserSignal({
          type: 'ADD1',
          symbol: holding.symbol,
          name: holding.name,
          amount: Math.round(addShares * holding.currentPrice),
          shares: addShares,
          currentPrice: holding.currentPrice,
          triggerDetail: 'Gain: +' + Math.round(gainPct) + '%, ' +
            Math.round(timeSinceEntry) + ' days since entry, Conviction: ' + (holding.conviction || 'BASE')
        }, config);
      }
    }

    // --- ADD #2 ---
    if (holding.pyramidStage === 'ADD1') {
      var add2Min = config.ADD2_GAIN_PCT || 30;
      if (gainPct >= add2Min && timeSinceEntry >= (config.ADD_MIN_WEEKS || 2) * 7) {
        // Guard: skip ADD if portfolio frozen, Nifty below 200DMA (unless gate skipped), or no cash
        if (portfolioFrozen) continue;
        if (niftyData.aboveDMA200 === false && !config.SKIP_NIFTY_GATE) continue;

        // Use locked ADD2 amount from StockMeta, fallback to current budget calculation
        var add2Amount = holding.add2Amount;
        if (!add2Amount || add2Amount <= 0) {
          var add2Conv = holding.conviction || 'BASE';
          add2Amount = budget * (_getMaxAllocationPct(add2Conv, config) / 100) * 0.25;
        }
        if (add2Amount > cashAvailable) continue; // Not enough cash

        var add2Shares = _smartShares(add2Amount, holding.currentPrice);

        _createUserSignal({
          type: 'ADD2',
          symbol: holding.symbol,
          name: holding.name,
          amount: Math.round(add2Shares * holding.currentPrice),
          shares: add2Shares,
          currentPrice: holding.currentPrice,
          triggerDetail: 'Gain: +' + Math.round(gainPct) + '%, Conviction: ' + (holding.conviction || 'BASE')
        }, config);
      }
    }

    // --- DIP BUY ---
    if (!holding.dipBuyUsed && holding.pyramidStage === 'STARTER' && gainPct < 0) {
      if (portfolioFrozen) continue;

      var dropPct = Math.abs(gainPct);
      var dipMin = config.DIP_BUY_MIN_DROP || 10;
      var dipMax = config.DIP_BUY_MAX_DROP || 20;
      var dipRsiMax = config.DIP_BUY_RSI_MAX || 30;

      if (dropPct >= dipMin && dropPct <= dipMax && holding.rsi <= dipRsiMax) {
        // Use locked ADD1 amount for dip buy (same 25% allocation)
        var dipAmount = holding.add1Amount;
        if (!dipAmount || dipAmount <= 0) {
          dipAmount = budget * (_getMaxAllocationPct(holding.conviction || 'BASE', config) / 100) * 0.25;
        }
        var dipShares = _smartShares(dipAmount, holding.currentPrice);

        _createUserSignal({
          type: 'DIP_BUY',
          symbol: holding.symbol,
          name: holding.name,
          amount: Math.round(dipShares * holding.currentPrice),
          shares: dipShares,
          currentPrice: holding.currentPrice,
          triggerDetail: 'Drop: -' + Math.round(dropPct) + '%, RSI: ' + holding.rsi + ', Conviction: ' + (holding.conviction || 'BASE')
        }, config);
      }
    }
  }

  // --- CHECK HOLDINGS FOR EXIT SIGNALS ---
  var hardExitCount = 0;
  for (var e = 0; e < holdings.length; e++) {
    var h = holdings[e];
    if (!h.hasScreenerMeta || !h.currentPrice) continue;

    var cost = h.avgPrice > 0 ? h.avgPrice : h.entryPrice;
    var gain = cost ? ((h.currentPrice - cost) / cost) * 100 : 0;

    // Holding period lock: use paper period for paper positions, real period for real
    var holdingPeriodDays = h.isPaperPosition ? (config.PAPER_HOLDING_PERIOD_DAYS || 1) : (config.HOLDING_PERIOD_DAYS || 30);
    var daysHeldForLock = h.entryDate ? Math.floor((new Date() - new Date(h.entryDate)) / (1000 * 60 * 60 * 24)) : 999;
    var isLocked = daysHeldForLock < holdingPeriodDays;
    var lockDaysRemaining = Math.max(0, holdingPeriodDays - daysHeldForLock);

    // Hard stop loss
    var hardStopPct = config.HARD_STOP_LOSS || 30;
    if (gain <= -hardStopPct) {
      if (isLocked) {
        _createUserSignal({
          type: 'HARD_EXIT',
          symbol: h.symbol,
          name: h.name,
          amount: h.currentPrice * h.totalShares,
          shares: h.totalShares,
          triggerDetail: '🔒 LOCKED (' + lockDaysRemaining + ' days left) — Hard stop: -' + Math.round(Math.abs(gain)) + '% from entry ₹' + h.entryPrice + '. Sell after ' + _formatDate(_addDays(h.entryDate, holdingPeriodDays))
        }, config);
      } else {
        _createUserSignal({
          type: 'HARD_EXIT',
          symbol: h.symbol,
          name: h.name,
          amount: h.currentPrice * h.totalShares,
          shares: h.totalShares,
          triggerDetail: 'Hard stop: -' + Math.round(Math.abs(gain)) + '% from entry ₹' + h.entryPrice
        }, config);
      }
      hardExitCount++;
      continue;
    }

    // Trailing stop
    var stop = _calculateTrailingStop(h, config, gain);
    if (stop.stopPrice && h.currentPrice <= stop.stopPrice) {
      if (isLocked) {
        _createUserSignal({
          type: 'TRAILING_STOP',
          symbol: h.symbol,
          name: h.name,
          amount: h.currentPrice * h.totalShares,
          shares: h.totalShares,
          triggerDetail: '🔒 LOCKED (' + lockDaysRemaining + ' days left) — Trailing stop: ₹' + h.currentPrice + ' <= ₹' + stop.stopPrice +
            ' (' + stop.description + '). Gain: ' + Math.round(gain) + '%. Sell after ' + _formatDate(_addDays(h.entryDate, holdingPeriodDays))
        }, config);
      } else {
        _createUserSignal({
          type: 'TRAILING_STOP',
          symbol: h.symbol,
          name: h.name,
          amount: h.currentPrice * h.totalShares,
          shares: h.totalShares,
          triggerDetail: 'Trailing stop: ₹' + h.currentPrice + ' <= ₹' + stop.stopPrice +
            ' (' + stop.description + '). Gain: ' + Math.round(gain) + '%'
        }, config);
      }
      continue;
    }

    // LTCG alert
    if (h.entryDate) {
      var daysHeld = Math.floor((new Date() - new Date(h.entryDate)) / (1000 * 60 * 60 * 24));
      var daysToLTCG = 365 - daysHeld;
      if (daysToLTCG > 0 && daysToLTCG <= 60) {
        var ltcgAction = gain >= 0
          ? 'In profit — holding past 1 year qualifies for lower LTCG tax (12.5%).'
          : 'At a loss — consider waiting for LTCG tax benefit or harvesting loss before 1 year.';
        _createUserSignal({
          type: 'LTCG_ALERT',
          symbol: h.symbol,
          name: h.name,
          triggerDetail: daysToLTCG + ' days to LTCG. P&L: ' + (gain >= 0 ? '+' : '') + Math.round(gain) +
            '%. ' + ltcgAction
        }, config);
      }
    }

    // Soft exit — fundamentals deteriorated: stock no longer on watchlist or marked STALE/EXPIRED
    var wlEntry = watchlistBySymbol[h.symbol];
    if (h.hasScreenerMeta && gain > 0) {
      if (!wlEntry || wlEntry.status === 'EXPIRED' || wlEntry.status === 'STALE') {
        // Stock removed from watchlist, expired, or stale — consider exiting while in profit
        var reason = !wlEntry ? 'removed from' : (wlEntry.status === 'STALE' ? 'stale on' : 'expired on');
        _createUserSignal({
          type: 'SOFT_EXIT',
          symbol: h.symbol,
          name: h.name,
          amount: h.currentPrice * h.totalShares,
          shares: h.totalShares,
          currentPrice: h.currentPrice,
          triggerDetail: 'Stock ' + reason + ' watchlist. P&L: +' +
            Math.round(gain) + '%. Consider taking profits.'
        }, config);
      }
    }

    // Update peak price + trailing stop in StockMeta
    _updatePeakAndStop(h, config, gain);
  }

  // Systemic risk
  if (hardExitCount >= (config.SYSTEMIC_EXIT_COUNT || 3)) {
    _createUserSignal({
      type: 'SYSTEMIC_EXIT',
      symbol: 'ALL',
      name: 'SYSTEMIC RISK',
      triggerDetail: hardExitCount + ' hard exits simultaneously. Consider exiting all positions.'
    }, config);
  }

  // --- PORTFOLIO-LEVEL CHECKS ---
  if (holdings.length > 0) {
    _checkPortfolioLevel(holdings, niftyData, config, budget);
  }

  // Return all pending signals
  var signals = getScreenerSignals('PENDING');
  var duration = Math.round((new Date() - startTime) / 1000);
  Logger.log('=== Signal generation complete in ' + duration + 's. ' + signals.length + ' pending signals ===');

  return {
    signals: signals,
    niftyData: niftyData,
    portfolioSummary: {
      holdingCount: holdingCount,
      totalInvested: totalInvested,
      budget: budget,
      cashAvailable: cashAvailable,
      maxStocks: config.MAX_STOCKS || 10,
      effectiveMax: effectiveMax || (config.MAX_STOCKS || 10),
      bonusSlots: bonusSlots || 0
    },
    generatedAt: new Date().toISOString(),
    durationSeconds: duration
  };
}

// ============================================================================
// BUY CONDITIONS (8 checks)
// ============================================================================

function _checkBuyConditions(stock, config, niftyData, holdingCount, sectorCounts, cashAvailable, starterAmount, factorScore, regimeMultiplier) {
  var failed = [];

  // Philosophy: Factor score is the primary gate. Hard gates only for
  // portfolio constraints, extreme RSI, and fundamental filters.
  // Technical conditions (golden cross, price vs 200DMA, relative strength)
  // are INSIDE the factor score — not hard gates.

  // 1 — Factor score minimum (core gate — embeds trend, momentum, quality, etc.)
  var factorBuyMin = config.FACTOR_BUY_MIN || 50;
  if (factorScore < factorBuyMin) {
    failed.push('Factor score too low (' + factorScore + ', min ' + factorBuyMin + ')');
  }

  // 2 — RSI overbought block — only hard gate at 70+
  // RSI 60-69 already penalized inside factor score (Trend factor: rsiScore = 20 or 10)
  // No soft gate at 65 — avoids double punishment
  var rsiOverbought = config.RSI_OVERBOUGHT || 70;
  if (stock.rsi > rsiOverbought) {
    failed.push('RSI overbought (' + stock.rsi + ', max ' + rsiOverbought + ')');
  }

  // 3 — Portfolio < effective MAX_STOCKS (soft cap — rank-select enforces dynamic limit)
  // Only hard-block at MAX_STOCKS + MAX_BONUS_SLOTS (absolute ceiling)
  var maxStocks = config.MAX_STOCKS || 10;
  var absoluteMax = maxStocks + (config.MAX_BONUS_SLOTS || 5);
  if (holdingCount >= absoluteMax) {
    failed.push('Portfolio full (' + holdingCount + '/' + absoluteMax + ')');
  }

  // 4 — Sector limit
  var maxPerSector = config.MAX_PER_SECTOR || 2;
  if (stock.sector && (sectorCounts[stock.sector] || 0) >= maxPerSector) {
    failed.push(stock.sector + ' sector full');
  }

  // 5 — Budget room
  if (cashAvailable < starterAmount) {
    failed.push('Low cash (need ₹' + Math.round(starterAmount / 1000) + 'K)');
  }

  // 6 — Market regime: scales allocation, NEVER blocks
  // (regimeMultiplier applied to allocation amount, not a pass/fail gate)

  // 7 — Market cap minimum
  var minMcap = config.MIN_MARKET_CAP_CR || 500;
  if (stock.marketCapCr > 0 && stock.marketCapCr < minMcap) {
    failed.push('Small cap (₹' + Math.round(stock.marketCapCr) + 'Cr)');
  }

  // 8 — Liquidity filter: avg daily traded value >= minimum
  var minTradedVal = config.MIN_AVG_TRADED_VALUE_CR || 3;
  if (stock.avgTradedValCr > 0 && stock.avgTradedValCr < minTradedVal) {
    failed.push('Low liquidity (₹' + stock.avgTradedValCr.toFixed(1) + 'Cr/day, min ₹' + minTradedVal + 'Cr)');
  }

  return failed;
}

// ============================================================================
// TRAILING STOP CALCULATION
// ============================================================================

function _calculateTrailingStop(holding, config, pnlPct) {
  var peakPrice = holding.peakPrice || holding.currentPrice || holding.entryPrice;
  var entryPrice = holding.entryPrice || 0;
  // Use MAX gain (from peak) for tier selection — tiers NEVER downgrade
  var maxGainPct = entryPrice > 0 ? ((peakPrice - entryPrice) / entryPrice * 100) : pnlPct;

  var stopPct, tier;
  if (maxGainPct >= 100) { stopPct = config.TRAILING_STOP_100_PLUS || 12; tier = '100%+'; }
  else if (maxGainPct >= 50) { stopPct = config.TRAILING_STOP_50_100 || 15; tier = '50-100%'; }
  else if (maxGainPct >= 20) { stopPct = config.TRAILING_STOP_20_50 || 20; tier = '20-50%'; }
  else {
    stopPct = config.TRAILING_STOP_0_20 || 25;
    var entryStop = entryPrice * (1 - stopPct / 100);
    return {
      stopPrice: Math.round(entryStop * 100) / 100,
      stopPct: stopPct, tier: '0-20%',
      description: '-' + stopPct + '% from entry ₹' + entryPrice
    };
  }

  return {
    stopPrice: Math.round(peakPrice * (1 - stopPct / 100) * 100) / 100,
    stopPct: stopPct, tier: tier,
    description: '-' + stopPct + '% from peak ₹' + peakPrice
  };
}

// ============================================================================
// PORTFOLIO-LEVEL CHECKS
// ============================================================================

function _checkPortfolioLevel(holdings, niftyData, config, budget) {
  var totalInvested = 0;
  var totalCurrentValue = 0;
  var sectorAllocations = {};

  for (var i = 0; i < holdings.length; i++) {
    totalInvested += holdings[i].totalInvested || 0;
    var value = (holdings[i].currentPrice || 0) * (holdings[i].totalShares || 0);
    totalCurrentValue += value;
    var sector = holdings[i].sector || 'Unknown';
    sectorAllocations[sector] = (sectorAllocations[sector] || 0) + value;
  }

  // Portfolio freeze
  var portfolioPnlPct = totalInvested > 0 ? ((totalCurrentValue - totalInvested) / totalInvested) * 100 : 0;
  var freezePct = config.PORTFOLIO_FREEZE_PCT || 25;
  if (portfolioPnlPct <= -freezePct) {
    _createUserSignal({
      type: 'FREEZE',
      symbol: 'PORTFOLIO',
      name: 'PORTFOLIO FREEZE',
      triggerDetail: 'Portfolio down ' + Math.round(Math.abs(portfolioPnlPct)) + '%. Stop all new buys.'
    }, config);
  }

  // Nifty crash
  var crashPct = config.NIFTY_CRASH_PCT || 20;
  if (niftyData.return1m !== null && niftyData.return1m <= -crashPct) {
    _createUserSignal({
      type: 'CRASH_ALERT',
      symbol: 'NIFTY',
      name: 'NIFTY CRASH ALERT',
      triggerDetail: 'Nifty down ' + Math.round(Math.abs(niftyData.return1m)) + '% in 1 month.'
    }, config);
  }

  // Sector concentration
  var sectorAlertPct = config.SECTOR_ALERT_PCT || 35;
  for (var sec in sectorAllocations) {
    var pct = totalCurrentValue > 0 ? (sectorAllocations[sec] / totalCurrentValue) * 100 : 0;
    if (pct > sectorAlertPct) {
      _createUserSignal({
        type: 'SECTOR_ALERT',
        symbol: sec,
        name: 'SECTOR ALERT: ' + sec,
        triggerDetail: sec + ' at ' + Math.round(pct) + '% of portfolio (limit: ' + sectorAlertPct + '%).'
      }, config);
    }
  }

  // Single stock > 20%
  for (var r = 0; r < holdings.length; r++) {
    var val = (holdings[r].currentPrice || 0) * (holdings[r].totalShares || 0);
    var allocPct = totalCurrentValue > 0 ? (val / totalCurrentValue) * 100 : 0;
    if (allocPct > 20) {
      _createUserSignal({
        type: 'REBALANCE',
        symbol: holdings[r].symbol,
        name: holdings[r].name,
        triggerDetail: 'Stock at ' + Math.round(allocPct) + '% of portfolio (max 20%). Trim to 15%.'
      }, config);
    }
  }
}

// ============================================================================
// SIGNAL CRUD
// ============================================================================

/**
 * Read signals from user's Screener_Signals sheet.
 * @param {string} statusFilter - optional: 'PENDING', 'EXECUTED', 'SKIPPED', or null for all
 */
function getScreenerSignals(statusFilter) {
  ensureScreenerSheets();
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.screenerSignalsSheet);
  if (!sheet) return [];

  var lastRow = sheet.getLastRow();
  if (lastRow < 3) return []; // Row 1=credit, Row 2=header

  var data = sheet.getRange(3, 1, lastRow - 2, 16).getValues();
  var signals = [];

  for (var i = 0; i < data.length; i++) {
    var status = String(data[i][11]).trim();
    if (statusFilter && status !== statusFilter) continue;

    signals.push({
      signalId: String(data[i][0]).trim(),
      date: data[i][1],
      type: String(data[i][2]).trim(),
      priority: parseFloat(data[i][3]) || 6,
      symbol: String(data[i][4]).trim(),
      name: String(data[i][5]).trim(),
      action: String(data[i][6]).trim(),
      amount: parseFloat(data[i][7]) || 0,
      shares: parseFloat(data[i][8]) || 0,
      triggerDetail: String(data[i][9]).trim(),
      fundamentals: String(data[i][10]).trim(),
      status: status,
      executedDate: data[i][12],
      executedPrice: parseFloat(data[i][13]) || 0,
      emailSent: String(data[i][14]).trim(),
      notes: String(data[i][15]).trim()
    });
  }

  // Sort by priority (lowest number = highest priority)
  signals.sort(function(a, b) { return a.priority - b.priority; });
  return signals;
}

/**
 * Clean up PENDING signals older than staleDays. Marks them STALE.
 */
function _cleanupStaleSignals(staleDays) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.screenerSignalsSheet);
  if (!sheet) return;

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  var data = sheet.getRange(2, 1, lastRow - 1, 16).getValues();
  var now = new Date();
  var changed = 0;

  for (var i = 0; i < data.length; i++) {
    var status = data[i][11]; // Column L = Status
    var dateVal = data[i][1]; // Column B = Date
    if (status !== 'PENDING' || !dateVal) continue;

    var signalDate = new Date(dateVal);
    var daysOld = Math.floor((now - signalDate) / (1000 * 60 * 60 * 24));
    if (daysOld > staleDays) {
      sheet.getRange(i + 2, 12).setValue('STALE'); // Column L
      changed++;
    }
  }

  if (changed > 0) {
    Logger.log('Cleaned up ' + changed + ' stale signals (>' + staleDays + ' days)');
  }
}

/**
 * Create a signal in user's Screener_Signals sheet (with deduplication).
 */
function _createUserSignal(params, config) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.screenerSignalsSheet);
  if (!sheet) return;

  var today = new Date();
  var todayStr = Utilities.formatDate(today, Session.getScriptTimeZone(), 'yyyy-MM-dd');

  // Dedup: skip if a PENDING signal already exists for same symbol + type (any date)
  var lastRow = sheet.getLastRow();
  if (lastRow > 2) {
    var existing = sheet.getRange(3, 1, lastRow - 2, 12).getValues(); // read through status col (L)
    for (var i = 0; i < existing.length; i++) {
      var existStatus = String(existing[i][11]).trim().toUpperCase();
      if (existStatus === 'PENDING' &&
          String(existing[i][2]) === params.type &&
          String(existing[i][4]) === params.symbol) {
        return; // pending signal already exists for this symbol+type
      }
    }
  }

  var signalId = 'SIG-' + todayStr.replace(/-/g, '') + '-' + (lastRow || 2);
  var priority = _getSignalPriority(params.type);

  var action = '';
  if (params.type === 'BUY_STARTER') {
    action += 'Buy ' + (params.shares || '?') + ' shares of ' + params.symbol + ' @ ~₹' +
      Math.round(params.currentPrice || (params.shares ? params.amount / params.shares : 0));
  } else if (params.type === 'ADD1' || params.type === 'ADD2' || params.type === 'DIP_BUY') {
    action += 'Add ' + (params.shares || '?') + ' shares of ' + params.symbol + ' @ ~₹' +
      Math.round(params.currentPrice || (params.shares ? params.amount / params.shares : 0));
  } else if (params.type === 'TRAILING_STOP' || params.type === 'HARD_EXIT' || params.type === 'SYSTEMIC_EXIT' || params.type === 'SOFT_EXIT') {
    action += 'SELL all ' + (params.shares || '') + ' shares of ' + params.symbol;
    if (params.currentPrice) action += ' @ ~₹' + Math.round(params.currentPrice);
  } else if (params.type === 'FREEZE') {
    action += 'FREEZE — stop all new buys until portfolio recovers';
  } else if (params.type === 'CRASH_ALERT') {
    action += 'CRASH ALERT — market in sharp decline, review all positions';
  } else if (params.type === 'SECTOR_ALERT') {
    action += 'SECTOR OVERWEIGHT — reduce ' + params.symbol + ' exposure';
  } else if (params.type === 'LTCG_ALERT') {
    action += 'TAX ALERT — ' + params.symbol + ' approaching 1-year LTCG threshold';
  } else if (params.type === 'REBALANCE') {
    action += 'REBALANCE — ' + params.symbol + ' allocation drifted from target';
  } else {
    action += params.type + ': ' + params.symbol;
  }

  sheet.appendRow([
    signalId,
    today,
    params.type,
    priority,
    params.symbol,
    params.name || '',
    action,
    params.amount || '',
    params.shares || '',
    params.triggerDetail || '',
    params.fundamentals || '',
    'PENDING',
    '',  // Executed Date
    '',  // Executed Price
    'NO',
    ''   // Notes
  ]);
}

function _getSignalPriority(type) {
  var priorities = {
    HARD_EXIT: 1, FREEZE: 1, SYSTEMIC_EXIT: 1,
    TRAILING_STOP: 2, CRASH_ALERT: 2,
    SOFT_EXIT: 3,
    ADD1: 4, ADD2: 4, DIP_BUY: 4,
    BUY_STARTER: 5,
    REBALANCE: 6, LTCG_ALERT: 6, SECTOR_ALERT: 6
  };
  return priorities[type] || 6;
}

/**
 * Update signal status (EXECUTED or SKIPPED).
 */
function updateSignalStatus(signalId, status, executedPrice) {
  ensureScreenerSheets();
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.screenerSignalsSheet);
  if (!sheet) return { success: false, error: 'Sheet not found' };

  var lastRow = sheet.getLastRow();
  if (lastRow < 3) return { success: false, error: 'No signals found' };

  var ids = sheet.getRange(3, 1, lastRow - 2, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]).trim() === signalId) {
      var row = i + 3;
      sheet.getRange(row, 12).setValue(status);           // L: Status
      sheet.getRange(row, 13).setValue(new Date());        // M: Executed Date
      if (executedPrice) {
        sheet.getRange(row, 14).setValue(executedPrice);   // N: Executed Price
      }
      return { success: true };
    }
  }
  return { success: false, error: 'Signal not found: ' + signalId };
}

// ============================================================================
// RECORD BUY (after user executes a BUY signal)
// ============================================================================

/**
 * Record a screener buy — creates/updates Screener_StockMeta row.
 * Called AFTER the user has already bought via the normal stock:buy route.
 */
function recordScreenerBuy(symbol, data) {
  ensureScreenerSheets();
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.screenerStockMetaSheet);
  if (!sheet) return { success: false, error: 'Screener_StockMeta sheet not found' };

  var lastRow = sheet.getLastRow();
  var existingRow = -1;

  // Check if symbol already exists
  if (lastRow >= 3) {
    var symbols = sheet.getRange(3, 1, lastRow - 2, 1).getValues();
    for (var i = 0; i < symbols.length; i++) {
      if (String(symbols[i][0]).trim() === symbol) {
        existingRow = i + 3;
        break;
      }
    }
  }

  if (existingRow > 0) {
    // Update existing row — upgrade pyramid stage
    var currentStage = String(sheet.getRange(existingRow, 7).getValue()).trim();
    var newStage = currentStage;
    if (data.signalType === 'BUY_STARTER') newStage = 'STARTER';
    else if (data.signalType === 'ADD1') newStage = 'ADD1';
    else if (data.signalType === 'ADD2') newStage = 'ADD2';
    else if (data.signalType === 'DIP_BUY') {
      sheet.getRange(existingRow, 8).setValue('YES'); // Dip Buy Used
    }
    sheet.getRange(existingRow, 7).setValue(newStage);
    return { success: true, action: 'updated', pyramidStage: newStage };
  } else {
    // New row
    sheet.appendRow([
      symbol,                                  // A: Symbol
      data.name || '',                         // B: Stock Name
      data.sector || '',                       // C: Sector
      new Date(),                              // D: Entry Date
      data.entryPrice || 0,                    // E: Entry Price
      data.entryPrice || 0,                    // F: Peak Price (starts at entry)
      'STARTER',                               // G: Pyramid Stage
      'NO',                                    // H: Dip Buy Used
      data.screeners || '',                    // I: Screeners Passing
      data.conviction || 'BASE',               // J: Conviction
      'NO',                                    // K: Is Compounder (deprecated)
      '',                                      // L: Trailing Stop Price (calculated later)
      '',                                      // M: Stop Tier
      '',                                      // N: Last Fundamental Check
      ''                                       // O: Notes
    ]);
    return { success: true, action: 'created' };
  }
}

// ============================================================================
// CONFIG UPDATE
// ============================================================================

/**
 * Update a user config override.
 */
function updateScreenerConfig(key, value) {
  ensureScreenerSheets();
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.screenerUserConfigSheet);
  if (!sheet) return { success: false, error: 'Config sheet not found' };

  var lastRow = sheet.getLastRow();
  if (lastRow >= 3) {
    var data = sheet.getRange(3, 1, lastRow - 2, 1).getValues();
    for (var i = 0; i < data.length; i++) {
      if (String(data[i][0]).trim() === key) {
        sheet.getRange(i + 3, 2).setValue(value);
        return { success: true, action: 'updated' };
      }
    }
  }

  // Key not found — should not happen since all defaults are pre-populated
  sheet.appendRow([key, value, '']);
  return { success: true, action: 'appended' };
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Get conviction level. In single-screener system, conviction comes from
 * MF holding QoQ change (computed by Master DB, stored in watchlist col F).
 * This function normalizes the value.
 */
function _getConviction(conviction) {
  if (conviction === 'HIGH' || conviction === 'MODERATE' || conviction === 'BASE') return conviction;
  return 'BASE';
}

function _getMaxAllocationPct(conviction, config) {
  switch (conviction) {
    case 'HIGH': return (config && config.ALLOC_HIGH) || 15;
    case 'MODERATE': return (config && config.ALLOC_MODERATE) || 12;
    case 'BASE': return (config && config.ALLOC_BASE) || 10;
    default: return (config && config.ALLOC_BASE) || 10;
  }
}

/**
 * Factor-based allocation by rank. Top 5 get 10%, next 5 get 7%, rest get 5%.
 */
function _getAllocationByRank(rank, config) {
  if (rank <= 5) return (config && config.ALLOC_TOP5) || 10;
  if (rank <= 10) return (config && config.ALLOC_NEXT5) || 7;
  return (config && config.ALLOC_REST) || 5;
}

/**
 * Overlap-based position sizing.
 * 1 screener → 0.8x, 2 screeners → 1.0x, 3 screeners → 1.2x
 */
function _getOverlapAllocationMultiplier(screenerCount) {
  if (screenerCount >= 3) return 1.2;
  if (screenerCount >= 2) return 1.0;
  return 0.8;
}

/**
 * Market regime multiplier — accumulation strategy.
 * When market drops, quality stocks (already filtered by factor score) are cheaper.
 * Buy MORE during fear, not less. Safety nets (PORTFOLIO_FREEZE, NIFTY_CRASH) still protect.
 *
 * Bull (above 200DMA, +ve returns) → 100% (normal)
 * Caution (above 200DMA, -ve returns) → 90% (slight pullback)
 * Correction (below 200DMA < 5%) → 110% (start accumulating)
 * Deep Bear (below 200DMA > 5%) → NIFTY_BELOW_200DMA_ALLOCATION% (default 120%)
 */
function _getMarketRegimeMultiplier(niftyData, config) {
  if (!niftyData) return 1.0;
  var bearAlloc = ((config && config.NIFTY_BELOW_200DMA_ALLOCATION) || 120) / 100;
  if (niftyData.aboveDMA200 === true) {
    return (niftyData.return6m || 0) >= 0 ? 1.0 : 0.90;
  }
  var niftyPrice = niftyData.price || 0;
  var niftyDMA = niftyData.dma200 || 0;
  if (niftyDMA > 0) {
    var pctBelow = ((niftyPrice - niftyDMA) / niftyDMA) * 100;
    if (pctBelow > -5) return 1.10; // correction — start accumulating
    return bearAlloc; // deep bear — aggressive accumulation
  }
  return 1.10; // default to correction
}

/**
 * Create or update Screener_StockMeta row with locked allocation.
 * Called at BUY_STARTER signal generation time (not when user clicks Buy).
 */
function _createOrUpdateStockMeta(symbol, data) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.screenerStockMetaSheet);
  if (!sheet) return;

  var lastRow = sheet.getLastRow();
  var existingRow = -1;

  if (lastRow >= 3) {
    var symbols = sheet.getRange(3, 1, lastRow - 2, 1).getValues();
    for (var i = 0; i < symbols.length; i++) {
      if (String(symbols[i][0]).trim() === symbol) {
        existingRow = i + 3;
        break;
      }
    }
  }

  if (existingRow > 0) {
    // Only update locked amounts if not already set (don't overwrite on re-generation)
    var existing = sheet.getRange(existingRow, 16, 1, 4).getValues()[0];
    if (!existing[0] || existing[0] === 0) {
      sheet.getRange(existingRow, 16).setValue(data.lockedBudget);
      sheet.getRange(existingRow, 17).setValue(data.lockedAllocation);
      sheet.getRange(existingRow, 18).setValue(data.add1Amount);
      sheet.getRange(existingRow, 19).setValue(data.add2Amount);
    }
  } else {
    sheet.appendRow([
      symbol,                                  // A: Symbol
      data.name || '',                         // B: Stock Name
      data.sector || '',                       // C: Sector
      '',                                      // D: Entry Date (set when user actually buys)
      '',                                      // E: Entry Price (set when user actually buys)
      '',                                      // F: Peak Price
      'PENDING',                               // G: Pyramid Stage (not bought yet)
      'NO',                                    // H: Dip Buy Used
      data.screeners || '',                    // I: Screeners Passing
      data.conviction || 'BASE',               // J: Conviction
      'NO',                                    // K: Is Compounder (deprecated)
      '',                                      // L: Trailing Stop Price
      '',                                      // M: Stop Tier
      '',                                      // N: Last Fundamental Check
      '',                                      // O: Notes
      data.lockedBudget || 0,                  // P: Locked Budget
      data.lockedAllocation || 0,              // Q: Locked Allocation
      data.add1Amount || 0,                    // R: ADD1 Amount
      data.add2Amount || 0                     // S: ADD2 Amount
    ]);
  }
}

/**
 * Update peak price and trailing stop in Screener_StockMeta.
 */
function _updatePeakAndStop(holding, config, gainPct) {
  if (!holding.hasScreenerMeta) return;

  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.screenerStockMetaSheet);
  if (!sheet) return;

  var lastRow = sheet.getLastRow();
  if (lastRow < 3) return;

  var symbols = sheet.getRange(3, 1, lastRow - 2, 1).getValues();
  for (var i = 0; i < symbols.length; i++) {
    if (String(symbols[i][0]).trim() === holding.symbol) {
      var row = i + 3;
      // Update peak price (never decreases)
      var newPeak = Math.max(holding.peakPrice || 0, holding.currentPrice || 0);
      sheet.getRange(row, 6).setValue(newPeak);

      // Update trailing stop
      var stop = _calculateTrailingStop(holding, config, gainPct);
      if (stop.stopPrice) {
        sheet.getRange(row, 12).setValue(stop.stopPrice);
        sheet.getRange(row, 13).setValue(stop.tier);
      }
      break;
    }
  }
}

// ============================================================================
// ADMIN FUNCTIONS
// ============================================================================

/**
 * Check if the current user is the admin.
 */
function isAdmin() {
  return Session.getActiveUser().getEmail() === CONFIG.adminEmail;
}

/**
 * Call the Master DB admin web app with the given action.
 * @param {string} action - The action to invoke on Master DB
 * @returns {Object} Parsed JSON response from Master DB
 */
function _callMasterDbAdmin(action) {
  if (!isAdmin()) {
    throw new Error('Unauthorized: admin access required.');
  }

  var props = PropertiesService.getScriptProperties();
  var url = props.getProperty('MASTER_DB_ADMIN_URL');
  var secret = props.getProperty('MASTER_DB_ADMIN_SECRET');

  if (!url || !secret) {
    throw new Error('Master DB admin not configured. Run setMasterDbAdminConfig() first.');
  }

  var response = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ secret: secret, action: action }),
    muteHttpExceptions: true,
    timeoutInMillis: 300000
  });

  var code = response.getResponseCode();
  var body = response.getContentText();

  if (code !== 200) {
    throw new Error('Master DB returned HTTP ' + code + ': ' + body);
  }

  return JSON.parse(body);
}

/**
 * Admin: Refresh Trendlyne data in Master DB.
 */
function adminRefreshTrendlyne() {
  return _callMasterDbAdmin('refreshTrendlyne');
}

/**
 * Admin: Refresh Nifty data in Master DB.
 */
function adminRefreshNifty() {
  return _callMasterDbAdmin('refreshNifty');
}

/**
 * Admin: Rescore watchlist in Master DB.
 */
function adminRescoreWatchlist() {
  return _callMasterDbAdmin('rescoreWatchlist');
}

/**
 * Admin: Run full pipeline (refresh + rescore) in Master DB.
 */
function adminRunFullPipeline() {
  return _callMasterDbAdmin('fullPipeline');
}

/**
 * Admin: Get screener status — timestamps and watchlist stats from Master DB.
 */
function getAdminStatus() {
  if (!isAdmin()) {
    throw new Error('Unauthorized: admin access required.');
  }

  var masterDb = openMasterDB();

  // Read Screener_Config for timestamps
  var configSheet = masterDb.getSheetByName(CONFIG.masterScreenerConfigSheet);
  var lastTrendlyneUpdate = null;
  var lastNiftyUpdate = null;
  if (configSheet) {
    var lastRow = configSheet.getLastRow();
    if (lastRow >= 2) {
      var rows = configSheet.getRange(2, 1, lastRow - 1, 2).getValues();
      for (var i = 0; i < rows.length; i++) {
        var key = String(rows[i][0]).trim();
        if (key === 'TRENDLYNE_LAST_UPDATED') lastTrendlyneUpdate = rows[i][1];
        else if (key === 'NIFTY_LAST_UPDATED') lastNiftyUpdate = rows[i][1];
      }
    }
  }

  // Read Screener_Watchlist stats + status distribution
  var watchlistSheet = masterDb.getSheetByName(CONFIG.masterScreenerWatchlistSheet);
  var watchlistCount = 0;
  var statusDistribution = {};
  if (watchlistSheet) {
    var wlLastRow = watchlistSheet.getLastRow();
    if (wlLastRow >= 2) {
      watchlistCount = wlLastRow - 1;
      var statuses = watchlistSheet.getRange(2, 8, watchlistCount, 1).getValues(); // H = Status column
      for (var j = 0; j < statuses.length; j++) {
        var s = String(statuses[j][0]).trim().toUpperCase();
        if (s) statusDistribution[s] = (statusDistribution[s] || 0) + 1;
      }
    }
  }

  return {
    lastTrendlyneUpdate: lastTrendlyneUpdate,
    lastNiftyUpdate: lastNiftyUpdate,
    watchlistCount: watchlistCount,
    statusDistribution: statusDistribution
  };
}

/**
 * One-time setup: store Master DB admin URL and shared secret in Script Properties.
 * Run from Script Editor: setMasterDbAdminConfig('https://script.google.com/...', 'your-secret')
 */
function setMasterDbAdminConfig(url, secret) {
  var props = PropertiesService.getScriptProperties();
  props.setProperty('MASTER_DB_ADMIN_URL', url);
  props.setProperty('MASTER_DB_ADMIN_SECRET', secret);
  Logger.log('Master DB admin config saved. URL: ' + url);
  return { success: true };
}

// ============================================================================
// PAPER TRADING — Fully automated, completely separate from real holdings
// ============================================================================

/**
 * Auto-execute paper trades from signals.
 * Called by trigger — processes all PENDING signals automatically.
 * BUY signals → create paper position. EXIT signals → close paper position.
 * Respects holding period lock for sells.
 * NEVER touches StockHoldings/StockTransactions.
 */
function executePaperTrades() {
  ensureScreenerSheets();
  var config = readScreenerConfig();

  if (!config.PAPER_TRADING) {
    Logger.log('Paper trading disabled, skipping auto-execution');
    return { executed: 0 };
  }

  var signals = getScreenerSignals('PENDING');
  if (signals.length === 0) return { executed: 0 };

  var ss = getSpreadsheet();
  var ptSheet = ss.getSheetByName(CONFIG.screenerPaperTradesSheet);
  if (!ptSheet) return { executed: 0, error: 'Screener_PaperTrades sheet not found' };

  // Read existing open paper positions
  var openPositions = _getPaperPositions('OPEN');
  var holdingPeriodDays = config.PAPER_HOLDING_PERIOD_DAYS || 1;
  var executed = 0;
  var now = new Date();

  for (var i = 0; i < signals.length; i++) {
    var s = signals[i];

    // BUY signals → open new paper position (if not already held)
    if (s.type === 'BUY_STARTER' || s.type === 'ADD1' || s.type === 'ADD2' || s.type === 'DIP_BUY') {
      // For ADD/DIP, must have open position. For BUY_STARTER, must NOT have one.
      var hasPosition = !!openPositions[s.symbol];
      if (s.type === 'BUY_STARTER' && hasPosition) continue; // already paper-holding
      if ((s.type === 'ADD1' || s.type === 'ADD2' || s.type === 'DIP_BUY') && !hasPosition) continue; // nothing to add to

      var price = s.amount && s.shares ? Math.round(s.amount / s.shares) : 0;
      if (!price || !s.shares) continue;

      var tradeId = 'PT-' + Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyyMMdd') + '-' + (ptSheet.getLastRow() || 2);
      ptSheet.appendRow([
        tradeId,                    // A: Trade ID
        now,                        // B: Date
        'BUY',                      // C: Type
        s.type,                     // D: Signal Type (BUY_STARTER, ADD1, etc.)
        s.symbol,                   // E: Symbol
        s.name,                     // F: Stock Name
        price,                      // G: Price
        s.shares,                   // H: Shares
        Math.round(price * s.shares), // I: Amount
        s.signalId,                 // J: Signal ID
        'OPEN',                     // K: Status (OPEN/CLOSED)
        '',                         // L: Exit Date
        '',                         // M: Exit Price
        '',                         // N: P&L ₹
        '',                         // O: P&L %
        '',                         // P: Holding Days
        s.triggerDetail || ''       // Q: Notes
      ]);

      // Don't mark signal as EXECUTED — leave PENDING so user can also act on it manually.
      // Dedup in _createUserSignal prevents duplicates, and paper positions are merged
      // into holdings via _getUserHoldingsForScreener so ADD/EXIT signals generate correctly.
      executed++;

    // EXIT signals → close paper position (with holding lock)
    } else if (s.type === 'HARD_EXIT' || s.type === 'TRAILING_STOP' || s.type === 'SOFT_EXIT') {
      var pos = openPositions[s.symbol];
      if (!pos) continue; // no paper position to close

      // Check holding period lock
      var daysHeld = Math.floor((now - new Date(pos.date)) / (1000 * 60 * 60 * 24));
      if (daysHeld < holdingPeriodDays) {
        Logger.log('Paper sell locked for ' + s.symbol + ': ' + daysHeld + '/' + holdingPeriodDays + ' days');
        continue; // skip — still locked
      }

      var exitPrice = s.amount && s.shares ? Math.round(s.amount / s.shares) : 0;
      if (!exitPrice) continue;

      // Close the position
      _closePaperPosition(ptSheet, pos, exitPrice, now);

      // Don't mark signal as EXECUTED — leave PENDING for manual action.
      executed++;
    }
  }

  Logger.log('Paper trades auto-executed: ' + executed);
  return { executed: executed };
}

/**
 * Close a paper position — update the row with exit data.
 */
function _closePaperPosition(ptSheet, position, exitPrice, exitDate) {
  var row = position.row;
  var entryPrice = position.price;
  var shares = position.shares;
  var pnl = Math.round((exitPrice - entryPrice) * shares);
  var pnlPct = entryPrice > 0 ? Math.round(((exitPrice - entryPrice) / entryPrice) * 10000) / 100 : 0;
  var holdingDays = Math.floor((exitDate - new Date(position.date)) / (1000 * 60 * 60 * 24));

  ptSheet.getRange(row, 11).setValue('CLOSED');    // K: Status
  ptSheet.getRange(row, 12).setValue(exitDate);    // L: Exit Date
  ptSheet.getRange(row, 13).setValue(exitPrice);   // M: Exit Price
  ptSheet.getRange(row, 14).setValue(pnl);         // N: P&L ₹
  ptSheet.getRange(row, 15).setValue(pnlPct);      // O: P&L %
  ptSheet.getRange(row, 16).setValue(holdingDays); // P: Holding Days
}

/**
 * Read paper positions from Screener_PaperTrades sheet.
 * @param {string} statusFilter - 'OPEN', 'CLOSED', or null for all
 * @returns {Object} keyed by symbol (for OPEN), or array (for all/CLOSED)
 */
function _getPaperPositions(statusFilter) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.screenerPaperTradesSheet);
  if (!sheet) return statusFilter === 'OPEN' ? {} : [];

  var lastRow = sheet.getLastRow();
  if (lastRow < 3) return statusFilter === 'OPEN' ? {} : [];

  var data = sheet.getRange(3, 1, lastRow - 2, 17).getValues();
  var positions = statusFilter === 'OPEN' ? {} : [];

  for (var i = 0; i < data.length; i++) {
    var status = String(data[i][10]).trim();
    if (statusFilter && status !== statusFilter) continue;

    var pos = {
      row: i + 3,
      tradeId: String(data[i][0]).trim(),
      date: data[i][1],
      tradeType: String(data[i][2]).trim(),
      signalType: String(data[i][3]).trim(),
      symbol: String(data[i][4]).trim(),
      name: String(data[i][5]).trim(),
      price: parseFloat(data[i][6]) || 0,
      shares: parseFloat(data[i][7]) || 0,
      amount: parseFloat(data[i][8]) || 0,
      signalId: String(data[i][9]).trim(),
      status: status,
      exitDate: data[i][11],
      exitPrice: parseFloat(data[i][12]) || 0,
      pnl: parseFloat(data[i][13]) || 0,
      pnlPct: parseFloat(data[i][14]) || 0,
      holdingDays: parseFloat(data[i][15]) || 0,
      notes: String(data[i][16]).trim()
    };

    if (statusFilter === 'OPEN') {
      // For OPEN, aggregate by symbol (multiple buys → sum shares/amount)
      if (!positions[pos.symbol]) {
        positions[pos.symbol] = pos;
      } else {
        // Add shares/amount for ADD/DIP trades
        positions[pos.symbol].shares += pos.shares;
        positions[pos.symbol].amount += pos.amount;
        positions[pos.symbol].price = positions[pos.symbol].amount / positions[pos.symbol].shares; // weighted avg
      }
    } else {
      positions.push(pos);
    }
  }

  return positions;
}

/**
 * Get paper trading portfolio — open positions with current P&L.
 * Uses watchlist data for current prices.
 */
/**
 * Batch-fetch live stock prices via GOOGLEFINANCE using temp cells.
 * @param {string[]} symbols - Array of stock symbols (e.g., ["RELIANCE", "TCS"])
 * @returns {Object} Map of symbol → price
 */
function _batchFetchLivePrices(symbols) {
  if (!symbols || symbols.length === 0) return {};
  try {
    var sheet = getSheet(CONFIG.settingsSheet);
    if (!sheet) return {};

    // Use row 50+ as temp area (far from settings data), columns A-J
    var startRow = 50;
    var formulas = [];
    for (var i = 0; i < symbols.length; i++) {
      formulas.push(['=IFERROR(GOOGLEFINANCE("NSE:' + symbols[i] + '", "price"), 0)']);
    }
    var range = sheet.getRange(startRow, 26, symbols.length, 1); // Column Z
    range.setFormulas(formulas);
    SpreadsheetApp.flush();

    var values = range.getValues();
    range.clearContent();

    var priceMap = {};
    for (var j = 0; j < symbols.length; j++) {
      var price = typeof values[j][0] === 'number' ? values[j][0] : 0;
      if (price > 0) priceMap[symbols[j]] = price;
    }
    return priceMap;
  } catch (e) {
    log('_batchFetchLivePrices error: ' + e.message);
    return {};
  }
}

function getPaperPortfolio() {
  ensureScreenerSheets();
  var config = readScreenerConfig();
  var openPositions = _getPaperPositions('OPEN');
  var watchlist = readScreenerWatchlist();

  // Build price + factor lookup from watchlist
  var priceMap = {};
  var factorMap = {};
  for (var w = 0; w < watchlist.length; w++) {
    var wl = watchlist[w];
    priceMap[wl.symbol] = wl.currentPrice;
    factorMap[wl.symbol] = {
      factorScore: wl.factorScore,
      factorRank: wl.factorRank,
      sector: wl.sector,
      rsi: wl.rsi,
      screeners: wl.screeners,
      conviction: wl.conviction,
      capClass: wl.capClass,
      return1w: wl.return1w,
      return1m: wl.return1m,
      return6m: wl.return6m,
      return1y: wl.return1y,
      pe: wl.pe,
      roe: wl.roe,
      piotroski: wl.piotroski,
      drawdown: wl.drawdown,
      high52w: wl.high52w,
      goldenCross: wl.goldenCross,
      momentumScore: wl.momentumScore,
      qualityScore: wl.qualityScore,
      trendScore: wl.trendScore,
      valueScore: wl.valueScore,
      lowVolScore: wl.lowVolScore
    };
  }

  // Fetch live prices for open positions via GOOGLEFINANCE
  var openSymbols = Object.keys(openPositions);
  if (openSymbols.length > 0) {
    var livePrices = _batchFetchLivePrices(openSymbols);
    for (var s in livePrices) {
      if (livePrices[s] > 0) priceMap[s] = livePrices[s]; // override with live
    }
  }

  var holdings = [];
  var totalInvested = 0;
  var totalCurrentValue = 0;

  for (var sym in openPositions) {
    var pos = openPositions[sym];
    var currentPrice = priceMap[sym] || pos.price; // fallback to entry price
    var currentValue = currentPrice * pos.shares;
    var pnl = currentValue - pos.amount;
    var pnlPct = pos.amount > 0 ? (pnl / pos.amount) * 100 : 0;
    var daysHeld = pos.date ? Math.floor((new Date() - new Date(pos.date)) / (1000 * 60 * 60 * 24)) : 0;
    var holdingPeriodDays = config.PAPER_HOLDING_PERIOD_DAYS || 1;

    var factors = factorMap[sym] || {};
    holdings.push({
      symbol: sym,
      name: pos.name,
      entryDate: pos.date,
      entryPrice: pos.price,
      shares: pos.shares,
      invested: pos.amount,
      currentPrice: currentPrice,
      currentValue: Math.round(currentValue),
      pnl: Math.round(pnl),
      pnlPct: Math.round(pnlPct * 100) / 100,
      daysHeld: daysHeld,
      isLocked: daysHeld < holdingPeriodDays,
      lockDaysRemaining: Math.max(0, holdingPeriodDays - daysHeld),
      signalType: pos.signalType,
      // Factor data from watchlist
      factorScore: factors.factorScore || null,
      factorRank: factors.factorRank || null,
      sector: factors.sector || '',
      rsi: factors.rsi || null,
      screeners: factors.screeners || '',
      conviction: factors.conviction || '',
      capClass: factors.capClass || '',
      return1w: factors.return1w,
      return1m: factors.return1m,
      return6m: factors.return6m,
      return1y: factors.return1y,
      pe: factors.pe,
      roe: factors.roe,
      piotroski: factors.piotroski,
      drawdown: factors.drawdown,
      high52w: factors.high52w,
      goldenCross: factors.goldenCross || '',
      momentumScore: factors.momentumScore,
      qualityScore: factors.qualityScore,
      trendScore: factors.trendScore,
      valueScore: factors.valueScore,
      lowVolScore: factors.lowVolScore
    });

    totalInvested += pos.amount;
    totalCurrentValue += currentValue;
  }

  // Sort by P&L % descending
  holdings.sort(function(a, b) { return b.pnlPct - a.pnlPct; });

  // Compute portfolio-level weighted-average factor scores (weighted by invested amount)
  var factorTotals = { momentum: 0, quality: 0, trend: 0, value: 0, lowVol: 0 };
  var factorWeight = 0;
  for (var f = 0; f < holdings.length; f++) {
    var h = holdings[f];
    var w = h.invested || 0;
    if (h.momentumScore != null) {
      factorTotals.momentum += h.momentumScore * w;
      factorTotals.quality += (h.qualityScore || 0) * w;
      factorTotals.trend += (h.trendScore || 0) * w;
      factorTotals.value += (h.valueScore || 0) * w;
      factorTotals.lowVol += (h.lowVolScore || 0) * w;
      factorWeight += w;
    }
  }
  var portfolioFactors = factorWeight > 0 ? {
    momentum: Math.round(factorTotals.momentum / factorWeight * 10) / 10,
    quality: Math.round(factorTotals.quality / factorWeight * 10) / 10,
    trend: Math.round(factorTotals.trend / factorWeight * 10) / 10,
    value: Math.round(factorTotals.value / factorWeight * 10) / 10,
    lowVol: Math.round(factorTotals.lowVol / factorWeight * 10) / 10,
    composite: Math.round((factorTotals.momentum + factorTotals.quality + factorTotals.trend + factorTotals.value + factorTotals.lowVol) / (factorWeight * 5) * 10) / 10
  } : null;

  // Compute factor allocation — each holding's invested amount distributed proportionally across its factor scores
  var factorAlloc = { momentum: 0, quality: 0, trend: 0, value: 0, lowVol: 0 };
  var allocTotal = 0;
  for (var fa = 0; fa < holdings.length; fa++) {
    var fh = holdings[fa];
    var fw = fh.invested || 0;
    if (fw > 0 && fh.momentumScore != null) {
      var fSum = (fh.momentumScore || 0) + (fh.qualityScore || 0) + (fh.trendScore || 0) + (fh.valueScore || 0) + (fh.lowVolScore || 0);
      if (fSum > 0) {
        factorAlloc.momentum += (fh.momentumScore || 0) / fSum * fw;
        factorAlloc.quality += (fh.qualityScore || 0) / fSum * fw;
        factorAlloc.trend += (fh.trendScore || 0) / fSum * fw;
        factorAlloc.value += (fh.valueScore || 0) / fSum * fw;
        factorAlloc.lowVol += (fh.lowVolScore || 0) / fSum * fw;
        allocTotal += fw;
      }
    }
  }
  var factorAllocation = allocTotal > 0 ? {
    momentum: Math.round(factorAlloc.momentum / allocTotal * 1000) / 10,
    quality: Math.round(factorAlloc.quality / allocTotal * 1000) / 10,
    trend: Math.round(factorAlloc.trend / allocTotal * 1000) / 10,
    value: Math.round(factorAlloc.value / allocTotal * 1000) / 10,
    lowVol: Math.round(factorAlloc.lowVol / allocTotal * 1000) / 10
  } : null;

  return {
    holdings: holdings,
    summary: {
      totalPositions: holdings.length,
      totalInvested: Math.round(totalInvested),
      totalCurrentValue: Math.round(totalCurrentValue),
      totalPnl: Math.round(totalCurrentValue - totalInvested),
      totalPnlPct: totalInvested > 0 ? Math.round(((totalCurrentValue - totalInvested) / totalInvested) * 10000) / 100 : 0
    },
    portfolioFactors: portfolioFactors,
    factorAllocation: factorAllocation
  };
}

/**
 * Get paper trading performance — aggregate stats from closed + open trades.
 * Includes: CAGR, realized P&L, unrealized P&L, total P&L, win rate.
 */
function getPaperPerformance() {
  ensureScreenerSheets();
  var allTrades = _getPaperPositions(null);
  var closed = allTrades.filter(function(t) { return t.status === 'CLOSED'; });

  // Get open positions with current prices for unrealized P&L
  var portfolio = getPaperPortfolio();
  var openHoldings = portfolio.holdings || [];

  // Realized P&L (from closed trades)
  var realizedPnl = closed.reduce(function(sum, t) { return sum + t.pnl; }, 0);
  var realizedInvested = closed.reduce(function(sum, t) { return sum + t.amount; }, 0);

  // Unrealized P&L (from open positions)
  var unrealizedPnl = portfolio.summary ? portfolio.summary.totalPnl : 0;
  var unrealizedInvested = portfolio.summary ? portfolio.summary.totalInvested : 0;

  // Total P&L
  var totalPnl = realizedPnl + unrealizedPnl;
  var totalInvested = realizedInvested + unrealizedInvested;
  var totalPnlPct = totalInvested > 0 ? Math.round((totalPnl / totalInvested) * 10000) / 100 : 0;

  // CAGR calculation — from first trade date to now
  var firstTradeDate = null;
  for (var ft = 0; ft < allTrades.length; ft++) {
    if (allTrades[ft].date) {
      var d = new Date(allTrades[ft].date);
      if (!firstTradeDate || d < firstTradeDate) firstTradeDate = d;
    }
  }
  var cagr = 0;
  if (firstTradeDate && totalInvested > 0) {
    var years = (new Date() - firstTradeDate) / (1000 * 60 * 60 * 24 * 365.25);
    if (years >= 0.05) { // at least ~18 days
      cagr = Math.round((Math.pow((totalInvested + totalPnl) / totalInvested, 1 / years) - 1) * 10000) / 100;
    }
  }

  if (closed.length === 0 && openHoldings.length === 0) {
    return {
      totalTrades: 0, winners: 0, losers: 0, winRate: 0,
      avgReturn: 0, avgWin: 0, avgLoss: 0,
      realizedPnl: 0, unrealizedPnl: 0, totalPnl: 0, totalPnlPct: 0, cagr: 0,
      avgHoldingDays: 0, bestTrade: null, worstTrade: null,
      openCount: 0, openHoldings: [],
      recentTrades: [], firstTradeDate: null
    };
  }

  var winners = closed.filter(function(t) { return t.pnl > 0; });
  var losers = closed.filter(function(t) { return t.pnl <= 0; });
  var avgReturn = closed.length > 0 ? closed.reduce(function(sum, t) { return sum + t.pnlPct; }, 0) / closed.length : 0;
  var avgWin = winners.length > 0 ? winners.reduce(function(sum, t) { return sum + t.pnlPct; }, 0) / winners.length : 0;
  var avgLoss = losers.length > 0 ? losers.reduce(function(sum, t) { return sum + t.pnlPct; }, 0) / losers.length : 0;
  var avgDays = closed.length > 0 ? closed.reduce(function(sum, t) { return sum + t.holdingDays; }, 0) / closed.length : 0;

  // Sort by P&L for best/worst
  var sorted = closed.slice().sort(function(a, b) { return b.pnlPct - a.pnlPct; });

  return {
    totalTrades: closed.length,
    winners: winners.length,
    losers: losers.length,
    winRate: closed.length > 0 ? Math.round((winners.length / closed.length) * 100) : 0,
    avgReturn: Math.round(avgReturn * 100) / 100,
    avgWin: Math.round(avgWin * 100) / 100,
    avgLoss: Math.round(avgLoss * 100) / 100,
    realizedPnl: Math.round(realizedPnl),
    unrealizedPnl: Math.round(unrealizedPnl),
    totalPnl: Math.round(totalPnl),
    totalPnlPct: totalPnlPct,
    cagr: cagr,
    avgHoldingDays: Math.round(avgDays),
    bestTrade: sorted.length > 0 ? { symbol: sorted[0].symbol, pnlPct: sorted[0].pnlPct, pnl: sorted[0].pnl } : null,
    worstTrade: sorted.length > 0 ? { symbol: sorted[sorted.length - 1].symbol, pnlPct: sorted[sorted.length - 1].pnlPct, pnl: sorted[sorted.length - 1].pnl } : null,
    openCount: openHoldings.length,
    openHoldings: openHoldings,
    recentTrades: sorted.slice(0, 10).map(function(t) {
      return { symbol: t.symbol, name: t.name, pnl: t.pnl, pnlPct: t.pnlPct, holdingDays: t.holdingDays, exitDate: t.exitDate };
    }),
    firstTradeDate: firstTradeDate ? Utilities.formatDate(firstTradeDate, Session.getScriptTimeZone(), 'dd MMM yyyy') : null
  };
}

// ============================================================================
// SIGNAL OUTCOME TRACKING
// ============================================================================

/**
 * Track signal outcomes — update price columns for EXECUTED signals after 7/14/30 days.
 * Called daily by trigger. Updates Screener_Signals column P (Notes) with outcome JSON.
 */
function trackSignalOutcomes() {
  ensureScreenerSheets();
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.screenerSignalsSheet);
  if (!sheet) return { tracked: 0 };

  var lastRow = sheet.getLastRow();
  if (lastRow < 3) return { tracked: 0 };

  var data = sheet.getRange(3, 1, lastRow - 2, 16).getValues();
  var watchlist = readScreenerWatchlist();
  var priceMap = {};
  for (var w = 0; w < watchlist.length; w++) {
    priceMap[watchlist[w].symbol] = watchlist[w].currentPrice;
  }

  var now = new Date();
  var tracked = 0;
  var config = readScreenerConfig();
  var trackDays = String(config.SIGNAL_TRACK_DAYS || '7,14,30').split(',').map(function(d) { return parseInt(d.trim()); });

  for (var i = 0; i < data.length; i++) {
    var type = String(data[i][2]).trim();
    var status = String(data[i][11]).trim().toUpperCase();
    // Only track executed BUY/ADD signals
    if (type !== 'BUY_STARTER' && type !== 'ADD1' && type !== 'ADD2' && type !== 'DIP_BUY') continue;
    if (status !== 'EXECUTED') continue;

    var signalDate = data[i][1];
    if (!signalDate) continue;
    var daysOld = Math.floor((now - new Date(signalDate)) / (1000 * 60 * 60 * 24));

    var symbol = String(data[i][4]).trim();
    var currentPrice = priceMap[symbol];
    if (!currentPrice) continue;

    var signalPrice = parseFloat(data[i][7]) && parseFloat(data[i][8])
      ? parseFloat(data[i][7]) / parseFloat(data[i][8])
      : 0;
    if (!signalPrice) continue;

    // Parse existing tracking from Notes column
    var notes = String(data[i][15]).trim();
    var tracking = {};
    if (notes && notes.indexOf('{') === 0) {
      try { tracking = JSON.parse(notes); } catch (e) { tracking = {}; }
    }

    var updated = false;
    for (var d = 0; d < trackDays.length; d++) {
      var day = trackDays[d];
      var key = day + 'D';
      if (!tracking[key] && daysOld >= day) {
        var returnPct = Math.round(((currentPrice - signalPrice) / signalPrice) * 10000) / 100;
        tracking[key] = { price: currentPrice, returnPct: returnPct, trackedAt: Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd') };
        updated = true;
      }
    }

    if (updated) {
      sheet.getRange(i + 3, 16).setValue(JSON.stringify(tracking));
      tracked++;
    }
  }

  Logger.log('Signal outcomes tracked: ' + tracked);
  return { tracked: tracked };
}

/**
 * Get signal tracking summary — accuracy and returns for BUY signals.
 */
function getSignalTracking() {
  ensureScreenerSheets();
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.screenerSignalsSheet);
  if (!sheet) return { total: 0 };

  var lastRow = sheet.getLastRow();
  if (lastRow < 3) return { total: 0 };

  var data = sheet.getRange(3, 1, lastRow - 2, 16).getValues();
  var results = { '7D': { total: 0, positive: 0, totalReturn: 0 }, '14D': { total: 0, positive: 0, totalReturn: 0 }, '30D': { total: 0, positive: 0, totalReturn: 0 } };
  var signals = [];

  for (var i = 0; i < data.length; i++) {
    var type = String(data[i][2]).trim();
    if (type !== 'BUY_STARTER' && type !== 'ADD1' && type !== 'ADD2' && type !== 'DIP_BUY') continue;

    var notes = String(data[i][15]).trim();
    if (!notes || notes.indexOf('{') !== 0) continue;

    var tracking = {};
    try { tracking = JSON.parse(notes); } catch (e) { continue; }

    var sig = {
      signalId: String(data[i][0]).trim(),
      date: data[i][1],
      type: type,
      symbol: String(data[i][4]).trim(),
      name: String(data[i][5]).trim(),
      status: String(data[i][11]).trim()
    };

    for (var key in results) {
      if (tracking[key]) {
        results[key].total++;
        results[key].totalReturn += tracking[key].returnPct;
        if (tracking[key].returnPct > 0) results[key].positive++;
        sig[key] = tracking[key].returnPct;
      }
    }
    signals.push(sig);
  }

  // Compute averages
  for (var k in results) {
    var r = results[k];
    r.avgReturn = r.total > 0 ? Math.round((r.totalReturn / r.total) * 100) / 100 : 0;
    r.accuracy = r.total > 0 ? Math.round((r.positive / r.total) * 100) : 0;
    delete r.totalReturn;
  }

  return {
    summary: results,
    signals: signals.slice(0, 50) // last 50 tracked signals
  };
}

// ============================================================================
// HOURLY PRICE CHECK — Lightweight trigger for exit signals only
// ============================================================================

/**
 * Hourly price check during market hours (9:30 AM - 3:30 PM IST).
 * Only checks exit conditions (trailing stop, hard exit) for held stocks.
 * Does NOT re-score — uses existing watchlist data.
 * For paper trading: auto-executes sell signals.
 */
function hourlyPriceCheck() {
  try {
    Logger.log('=== HOURLY PRICE CHECK at ' + new Date().toLocaleTimeString('en-IN') + ' ===');

    // Time-based trigger — set spreadsheet context
    var email = Session.getEffectiveUser().getEmail();
    if (!email) return;
    var userRecord = findUserByEmail(email);
    if (!userRecord || userRecord.status !== 'Active') return;
    _currentUserSpreadsheetId = userRecord.spreadsheetId;

    var config = readScreenerConfig();
    if (!config.HOURLY_PRICE_CHECK) {
      Logger.log('Hourly price check disabled');
      return;
    }

    // Only check during market hours (9-16 IST)
    var hour = new Date().getHours();
    if (hour < 9 || hour > 16) {
      Logger.log('Outside market hours, skipping');
      return;
    }

    var holdings = _getUserHoldingsForScreener();
    if (holdings.length === 0) {
      Logger.log('No holdings to check');
      return;
    }

    // Get latest prices from watchlist
    var watchlist = readScreenerWatchlist();
    var priceMap = {};
    for (var w = 0; w < watchlist.length; w++) {
      priceMap[watchlist[w].symbol] = watchlist[w];
    }

    var realHoldingPeriod = config.HOLDING_PERIOD_DAYS || 30;
    var paperHoldingPeriod = config.PAPER_HOLDING_PERIOD_DAYS || 1;
    var exitSignals = 0;

    for (var i = 0; i < holdings.length; i++) {
      var h = holdings[i];
      if (!h.hasScreenerMeta) continue;

      // Use latest price from watchlist if available
      var wData = priceMap[h.symbol];
      if (wData) {
        h.currentPrice = wData.currentPrice;
        h.rsi = wData.rsi;
      }
      if (!h.currentPrice) continue;

      var cost = h.avgPrice > 0 ? h.avgPrice : h.entryPrice;
      var gain = cost ? ((h.currentPrice - cost) / cost) * 100 : 0;

      var holdingPeriodDays = h.isPaperPosition ? paperHoldingPeriod : realHoldingPeriod;
      var daysHeld = h.entryDate ? Math.floor((new Date() - new Date(h.entryDate)) / (1000 * 60 * 60 * 24)) : 999;
      var isLocked = daysHeld < holdingPeriodDays;
      var lockDaysRemaining = Math.max(0, holdingPeriodDays - daysHeld);

      // Hard stop check
      var hardStopPct = config.HARD_STOP_LOSS || 30;
      if (gain <= -hardStopPct) {
        var lockNote = isLocked ? '🔒 LOCKED (' + lockDaysRemaining + ' days left) — ' : '';
        _createUserSignal({
          type: 'HARD_EXIT',
          symbol: h.symbol,
          name: h.name,
          amount: h.currentPrice * h.totalShares,
          shares: h.totalShares,
          triggerDetail: lockNote + 'Hard stop: -' + Math.round(Math.abs(gain)) + '% from entry ₹' + h.entryPrice + ' [hourly check]'
        }, config);
        exitSignals++;
        continue;
      }

      // Trailing stop check
      var stop = _calculateTrailingStop(h, config, gain);
      if (stop.stopPrice && h.currentPrice <= stop.stopPrice) {
        var tLockNote = isLocked ? '🔒 LOCKED (' + lockDaysRemaining + ' days left) — ' : '';
        _createUserSignal({
          type: 'TRAILING_STOP',
          symbol: h.symbol,
          name: h.name,
          amount: h.currentPrice * h.totalShares,
          shares: h.totalShares,
          triggerDetail: tLockNote + 'Trailing stop: ₹' + h.currentPrice + ' <= ₹' + stop.stopPrice +
            ' (' + stop.description + '). Gain: ' + Math.round(gain) + '% [hourly check]'
        }, config);
        exitSignals++;
      }

      // Update peak price
      _updatePeakAndStop(h, config, gain);
    }

    // Auto-execute paper trades if enabled
    if (config.PAPER_TRADING && exitSignals > 0) {
      executePaperTrades();
    }

    Logger.log('Hourly check done. Exit signals: ' + exitSignals);
  } catch (error) {
    Logger.log('Error in hourly price check: ' + error.toString());
  }
}

// ============================================================================
// DATE HELPERS
// ============================================================================

function _addDays(date, days) {
  var d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function _formatDate(date) {
  return Utilities.formatDate(new Date(date), Session.getScriptTimeZone(), 'dd MMM yyyy');
}

// ============================================================================
// RESET / CLEAR DATA
// ============================================================================

/**
 * Clear all paper trades (keeps header rows, deletes data).
 * Also clears Screener_StockMeta since it tracks paper positions.
 */
function resetPaperTrades() {
  var cleared = [];

  var ptSheet = getSheet(CONFIG.screenerPaperTradesSheet);
  if (ptSheet && ptSheet.getLastRow() > 2) {
    ptSheet.deleteRows(3, ptSheet.getLastRow() - 2);
    cleared.push('PaperTrades');
  }

  var metaSheet = getSheet(CONFIG.screenerStockMetaSheet);
  if (metaSheet && metaSheet.getLastRow() > 2) {
    metaSheet.deleteRows(3, metaSheet.getLastRow() - 2);
    cleared.push('StockMeta');
  }

  log('Reset paper trades: cleared ' + cleared.join(', '));
  return { cleared: cleared };
}

/**
 * Clear all screener signals (keeps header rows, deletes data).
 */
function resetSignals() {
  var sheet = getSheet(CONFIG.screenerSignalsSheet);
  if (!sheet || sheet.getLastRow() <= 2) {
    return { cleared: [] };
  }
  sheet.deleteRows(3, sheet.getLastRow() - 2);
  log('Reset signals: all signals cleared');
  return { cleared: ['Signals'] };
}

/**
 * Full screener reset — clears signals, paper trades, and stock meta.
 */
function resetScreenerAll() {
  var r1 = resetSignals();
  var r2 = resetPaperTrades();
  var cleared = (r1.cleared || []).concat(r2.cleared || []);
  log('Full screener reset: cleared ' + cleared.join(', '));
  return { cleared: cleared };
}

/**
 * Reset everything and re-run signal generation + paper trades.
 * Convenience function: clears all data, then runs a fresh cycle.
 */
function resetAndRerun() {
  // 1. Clear all data
  var resetResult = resetScreenerAll();
  log('Reset complete: ' + JSON.stringify(resetResult));

  // 2. Generate fresh signals
  var signalResult = generateUserSignals();
  var signalCount = (signalResult.signals || []).length;

  // 3. Auto-execute paper trades if enabled
  var paperCount = 0;
  var config = readScreenerConfig();
  if (config.PAPER_TRADING) {
    var ptResult = executePaperTrades();
    paperCount = ptResult.executed || 0;
  }

  return {
    cleared: resetResult.cleared,
    signalsGenerated: signalCount,
    paperTradesExecuted: paperCount
  };
}

