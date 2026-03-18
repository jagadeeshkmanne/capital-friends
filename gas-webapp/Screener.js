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

    var data = sheet.getRange(2, 1, lastRow - 1, 28).getValues();
    var stocks = [];

    for (var i = 0; i < data.length; i++) {
      var sym = String(data[i][0]).trim();
      if (!sym) continue;

      stocks.push({
        symbol: sym,
        name: String(data[i][1]).trim(),
        dateFound: data[i][2],
        foundPrice: parseFloat(data[i][3]) || 0,
        screeners: String(data[i][4]).trim(),           // E: "1,2" etc
        conviction: String(data[i][5]).trim() || '',    // F: Conviction
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
        return1y: parseFloat(data[i][27]) || null        // AB: 1Y Return %
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

    var price = parseFloat(config.NIFTY_PRICE) || null;
    var dma200 = parseFloat(config.NIFTY_200DMA) || null;

    return {
      price: price,
      dma200: dma200,
      aboveDMA200: config.NIFTY_ABOVE_200DMA === 'TRUE' || config.NIFTY_ABOVE_200DMA === true,
      return1m: parseFloat(config.NIFTY_RETURN_1M) || null,
      return6m: parseFloat(config.NIFTY_RETURN_6M) || null,
      lastUpdated: config.NIFTY_LAST_UPDATED || null
    };
  } catch (e) {
    Logger.log('Error reading Nifty data from Master DB: ' + e.message);
    return _defaultNiftyData();
  }
}

function _defaultNiftyData() {
  return { price: null, dma200: null, aboveDMA200: null, return1m: null, return6m: null, lastUpdated: null };
}

// ============================================================================
// READ FROM USER SHEET
// ============================================================================

/**
 * Read user's screener config (overrides).
 * Falls back to Master DB defaults for missing keys.
 */
function readScreenerConfig() {
  ensureScreenerSheets();
  var config = {};

  // Read Master DB defaults first
  try {
    var masterDb = openMasterDB();
    var masterSheet = masterDb.getSheetByName(CONFIG.masterScreenerConfigSheet);
    if (masterSheet) {
      var masterLastRow = masterSheet.getLastRow();
      if (masterLastRow >= 2) {
        var masterData = masterSheet.getRange(2, 1, masterLastRow - 1, 2).getValues();
        for (var i = 0; i < masterData.length; i++) {
          var key = String(masterData[i][0]).trim();
          if (key && key.indexOf('NIFTY_') !== 0) { // Skip Nifty data rows
            config[key] = _parseConfigValue(masterData[i][1]);
          }
        }
      }
    }
  } catch (e) {
    Logger.log('Error reading master config defaults: ' + e.message);
  }

  // Override with user values
  try {
    var ss = getSpreadsheet();
    var userSheet = ss.getSheetByName(CONFIG.screenerUserConfigSheet);
    if (userSheet) {
      var userLastRow = userSheet.getLastRow();
      if (userLastRow > 2) { // Row 1=credit, Row 2=header, Row 3+=data
        var userData = userSheet.getRange(3, 1, userLastRow - 2, 2).getValues();
        for (var j = 0; j < userData.length; j++) {
          var uKey = String(userData[j][0]).trim();
          if (uKey) {
            config[uKey] = _parseConfigValue(userData[j][1]);
          }
        }
      }
    }
  } catch (e) {
    Logger.log('Error reading user config: ' + e.message);
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

  var data = sheet.getRange(3, 1, lastRow - 2, 15).getValues();
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
      notes: String(data[i][14]).trim()
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
      hasScreenerMeta: !!meta[sym]
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
  var niftyData = readNiftyDataFromMasterDB();
  var watchlist = readScreenerWatchlist();
  var holdings = _getUserHoldingsForScreener();

  // Build quick lookup of owned symbols
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
  for (var w = 0; w < watchlist.length; w++) {
    var stock = watchlist[w];
    if (stock.status !== 'ELIGIBLE') continue;
    if (ownedSymbols[stock.symbol]) continue; // already owned → skip BUY (check ADD instead)

    var screeners = stock.screeners.split(',').map(function(s) { return parseInt(s); }).filter(function(s) { return !isNaN(s); });
    var conviction = _getConviction(screeners);
    var maxAllocPct = _getMaxAllocationPct(conviction);
    var starterAmount = budget * (maxAllocPct / 100) * 0.5;

    var failed = _checkBuyConditions(stock, screeners, config, niftyData, holdingCount, sectorCounts, cashAvailable, starterAmount);

    if (failed.length === 0) {
      var adjustedAllocation = niftyData.aboveDMA200 === false
        ? starterAmount * ((config.NIFTY_BELOW_200DMA_ALLOCATION || 50) / 100)
        : starterAmount;
      var shares = stock.currentPrice > 0 ? Math.floor(adjustedAllocation / stock.currentPrice) : 0;

      _createUserSignal({
        type: 'BUY_STARTER',
        symbol: stock.symbol,
        name: stock.name,
        amount: adjustedAllocation,
        shares: shares,
        triggerDetail: 'Screeners: ' + stock.screeners + ', RSI: ' + stock.rsi +
          ', Golden Cross: ' + stock.goldenCross + ', Conviction: ' + conviction +
          ', 6M vs Nifty: ' + stock.return6m + '% vs ' + (niftyData.return6m || 'N/A') + '%',
        conviction: conviction
      }, config);
    }
  }

  // --- CHECK OWNED STOCKS FOR ADD SIGNALS (stocks in watchlist AND owned) ---
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
        var scrs = holding.screenersStr ? holding.screenersStr.split(',').length : 0;
        if (scrs >= 2) {
          var addConviction = holding.conviction || 'MEDIUM';
          var addAllocPct = _getMaxAllocationPct(addConviction);
          var addAmount = budget * (addAllocPct / 100) * 0.25;
          var addShares = Math.floor(addAmount / holding.currentPrice);

          _createUserSignal({
            type: 'ADD1',
            symbol: holding.symbol,
            name: holding.name,
            amount: addAmount,
            shares: addShares,
            triggerDetail: 'Gain: +' + Math.round(gainPct) + '%, ' +
              Math.round(timeSinceEntry) + ' days since entry, Screeners: ' + holding.screenersStr
          }, config);
        }
      }
    }

    // --- ADD #2 ---
    if (holding.pyramidStage === 'ADD1') {
      var add2Min = config.ADD2_GAIN_PCT || 30;
      if (gainPct >= add2Min && timeSinceEntry >= (config.ADD_MIN_WEEKS || 2) * 7) {
        var scrs2 = holding.screenersStr ? holding.screenersStr.split(',').length : 0;
        if (scrs2 >= 2) {
          var add2Conv = holding.conviction || 'MEDIUM';
          var add2Alloc = budget * (_getMaxAllocationPct(add2Conv) / 100) * 0.25;
          var add2Shares = Math.floor(add2Alloc / holding.currentPrice);

          _createUserSignal({
            type: 'ADD2',
            symbol: holding.symbol,
            name: holding.name,
            amount: add2Alloc,
            shares: add2Shares,
            triggerDetail: 'Gain: +' + Math.round(gainPct) + '%, Screeners: ' + holding.screenersStr
          }, config);
        }
      }
    }

    // --- DIP BUY ---
    if (!holding.dipBuyUsed && holding.pyramidStage === 'STARTER' && gainPct < 0) {
      var dropPct = Math.abs(gainPct);
      var dipMin = config.DIP_BUY_MIN_DROP || 10;
      var dipMax = config.DIP_BUY_MAX_DROP || 20;
      var dipRsiMax = config.DIP_BUY_RSI_MAX || 30;
      var screenersList = holding.screenersStr ? holding.screenersStr.split(',').map(Number) : [];
      var has1and3 = screenersList.indexOf(1) !== -1 && screenersList.indexOf(3) !== -1;

      if (dropPct >= dipMin && dropPct <= dipMax && has1and3) {
        var dipAmount = budget * (_getMaxAllocationPct(holding.conviction || 'MEDIUM') / 100) * 0.25;
        var dipShares = Math.floor(dipAmount / holding.currentPrice);

        _createUserSignal({
          type: 'DIP_BUY',
          symbol: holding.symbol,
          name: holding.name,
          amount: dipAmount,
          shares: dipShares,
          triggerDetail: 'Drop: -' + Math.round(dropPct) + '%, Screeners 1+3: YES'
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

    // Hard stop loss
    var hardStopPct = config.HARD_STOP_LOSS || 30;
    if (gain <= -hardStopPct) {
      _createUserSignal({
        type: 'HARD_EXIT',
        symbol: h.symbol,
        name: h.name,
        amount: h.currentPrice * h.totalShares,
        shares: h.totalShares,
        triggerDetail: 'Hard stop: -' + Math.round(Math.abs(gain)) + '% from entry ₹' + h.entryPrice
      }, config);
      hardExitCount++;
      continue;
    }

    // Trailing stop
    var stop = _calculateTrailingStop(h, config, gain);
    if (stop.stopPrice && h.currentPrice <= stop.stopPrice) {
      _createUserSignal({
        type: 'TRAILING_STOP',
        symbol: h.symbol,
        name: h.name,
        amount: h.currentPrice * h.totalShares,
        shares: h.totalShares,
        triggerDetail: 'Trailing stop: ₹' + h.currentPrice + ' <= ₹' + stop.stopPrice +
          ' (' + stop.description + '). Gain: ' + Math.round(gain) + '%'
      }, config);
      continue;
    }

    // LTCG alert
    if (h.entryDate) {
      var daysHeld = Math.floor((new Date() - new Date(h.entryDate)) / (1000 * 60 * 60 * 24));
      var daysToLTCG = 365 - daysHeld;
      if (daysToLTCG > 0 && daysToLTCG <= 60 && gain < 0) {
        _createUserSignal({
          type: 'LTCG_ALERT',
          symbol: h.symbol,
          name: h.name,
          triggerDetail: daysToLTCG + ' days to LTCG. Current P&L: ' + Math.round(gain) +
            '%. Consider waiting for tax benefit.'
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
      maxStocks: config.MAX_STOCKS || 8
    },
    generatedAt: new Date().toISOString(),
    durationSeconds: duration
  };
}

// ============================================================================
// BUY CONDITIONS (11 checks)
// ============================================================================

function _checkBuyConditions(stock, screeners, config, niftyData, holdingCount, sectorCounts, cashAvailable, starterAmount) {
  var failed = [];

  // 2 — Passes 2+ screeners
  if (screeners.length < 2) {
    failed.push('Only ' + screeners.length + ' screener — need 2+');
  }

  // 3 — RSI < 45
  var rsiMax = config.RSI_BUY_MAX || 45;
  if (stock.rsi >= rsiMax) {
    failed.push('RSI too high (' + stock.rsi + ', max ' + rsiMax + ')');
  }

  // 5 — Portfolio < MAX_STOCKS
  var maxStocks = config.MAX_STOCKS || 8;
  if (holdingCount >= maxStocks) {
    failed.push('Portfolio full (' + holdingCount + '/' + maxStocks + ')');
  }

  // 6 — Sector limit
  var maxPerSector = config.MAX_PER_SECTOR || 2;
  if (stock.sector && (sectorCounts[stock.sector] || 0) >= maxPerSector) {
    failed.push(stock.sector + ' sector full');
  }

  // 7 — Budget room
  if (cashAvailable < starterAmount) {
    failed.push('Low cash (need ₹' + Math.round(starterAmount / 1000) + 'K)');
  }

  // 8 — Nifty above 200DMA
  if (niftyData.aboveDMA200 === false) {
    failed.push('Nifty below 200DMA');
  }

  // 9 — Golden cross
  if (stock.goldenCross !== 'YES') {
    var hasException = screeners.indexOf(1) !== -1 && screeners.indexOf(3) !== -1 && stock.rsi < 30;
    if (!hasException) {
      failed.push('No golden cross');
    }
  }

  // 10 — Relative strength
  if (stock.relativeStrength !== 'PASS') {
    failed.push('Weak vs Nifty (' + stock.return6m + '% vs ' + (niftyData.return6m || 'N/A') + '%)');
  }

  // 11 — Market cap minimum
  var minMcap = config.MIN_MARKET_CAP_CR || 500;
  if (stock.marketCapCr > 0 && stock.marketCapCr < minMcap) {
    failed.push('Small cap (₹' + Math.round(stock.marketCapCr) + 'Cr)');
  }

  return failed;
}

// ============================================================================
// TRAILING STOP CALCULATION
// ============================================================================

function _calculateTrailingStop(holding, config, pnlPct) {
  var peakPrice = holding.peakPrice || holding.currentPrice || holding.entryPrice;

  if (holding.isCompounder) {
    if (pnlPct < 40) {
      return { stopPrice: null, stopPct: null, tier: 'COMPOUNDER <40%', description: 'No trailing stop' };
    }
    var cStopPct;
    var cTier;
    if (pnlPct >= 200) { cStopPct = config.COMPOUNDER_STOP_200_PLUS || 15; cTier = 'COMPOUNDER 200%+'; }
    else if (pnlPct >= 100) { cStopPct = config.COMPOUNDER_STOP_100_200 || 20; cTier = 'COMPOUNDER 100-200%'; }
    else { cStopPct = config.COMPOUNDER_STOP_40_100 || 25; cTier = 'COMPOUNDER 40-100%'; }
    return {
      stopPrice: Math.round(peakPrice * (1 - cStopPct / 100) * 100) / 100,
      stopPct: cStopPct, tier: cTier,
      description: 'Compounder -' + cStopPct + '% from peak ₹' + peakPrice
    };
  }

  var stopPct, tier;
  if (pnlPct >= 100) { stopPct = config.TRAILING_STOP_100_PLUS || 12; tier = '100%+'; }
  else if (pnlPct >= 50) { stopPct = config.TRAILING_STOP_50_100 || 15; tier = '50-100%'; }
  else if (pnlPct >= 20) { stopPct = config.TRAILING_STOP_20_50 || 20; tier = '20-50%'; }
  else {
    stopPct = config.TRAILING_STOP_0_20 || 25;
    var entryStop = holding.entryPrice * (1 - stopPct / 100);
    return {
      stopPrice: Math.round(entryStop * 100) / 100,
      stopPct: stopPct, tier: '0-20%',
      description: '-' + stopPct + '% from entry ₹' + holding.entryPrice
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
 * Create a signal in user's Screener_Signals sheet (with deduplication).
 */
function _createUserSignal(params, config) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.screenerSignalsSheet);
  if (!sheet) return;

  var today = new Date();
  var todayStr = Utilities.formatDate(today, Session.getScriptTimeZone(), 'yyyy-MM-dd');

  // Dedup: same symbol + type + date
  var lastRow = sheet.getLastRow();
  if (lastRow > 2) {
    var existing = sheet.getRange(3, 1, lastRow - 2, 5).getValues();
    for (var i = 0; i < existing.length; i++) {
      var existDate = existing[i][1] ? Utilities.formatDate(new Date(existing[i][1]), Session.getScriptTimeZone(), 'yyyy-MM-dd') : '';
      if (String(existing[i][2]) === params.type &&
          String(existing[i][4]) === params.symbol &&
          existDate === todayStr) {
        return; // duplicate
      }
    }
  }

  var signalId = 'SIG-' + todayStr.replace(/-/g, '') + '-' + (lastRow || 2);
  var priority = _getSignalPriority(params.type);

  var isPaper = config && config.PAPER_TRADING;
  var prefix = isPaper ? '[PAPER] ' : '';

  var action = prefix;
  if (params.type === 'BUY_STARTER') {
    action += 'Buy ' + (params.shares || '?') + ' shares of ' + params.symbol + ' @ ~₹' +
      (params.shares ? Math.round(params.amount / params.shares) : '?');
  } else if (params.type === 'ADD1' || params.type === 'ADD2' || params.type === 'DIP_BUY') {
    action += 'Add ' + (params.shares || '?') + ' shares of ' + params.symbol;
  } else if (params.type === 'TRAILING_STOP' || params.type === 'HARD_EXIT' || params.type === 'SYSTEMIC_EXIT') {
    action += 'SELL all ' + (params.shares || '') + ' shares of ' + params.symbol;
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
    if (data.signalType === 'ADD1') newStage = 'ADD1';
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
      data.conviction || 'LOW',                // J: Conviction
      data.isCompounder ? 'YES' : 'NO',       // K: Is Compounder
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

function _getConviction(screeners) {
  if (!screeners || screeners.length === 0) return 'NONE';
  if (screeners.indexOf(4) !== -1) return 'COMPOUNDER';
  if (screeners.length >= 3) return 'HIGH';
  if (screeners.length >= 2) return 'MEDIUM';
  return 'LOW';
}

function _getMaxAllocationPct(conviction) {
  switch (conviction) {
    case 'HIGH': return 15;
    case 'MEDIUM': return 10;
    case 'COMPOUNDER': return 12;
    default: return 10;
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
