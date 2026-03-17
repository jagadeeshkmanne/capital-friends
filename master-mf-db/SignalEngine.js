/**
 * ============================================================================
 * SIGNAL ENGINE — BUY, ADD, EXIT, REBALANCE signal generation
 * ============================================================================
 *
 * Core logic:
 * - checkWatchlistForBuySignals(): All 11 BUY conditions
 * - checkHoldingsForAddSignals(): ADD #1, ADD #2, DIP BUY
 * - checkHoldingsForExitSignals(): Hard exits, trailing stops
 * - checkPortfolioLevel(): Freeze, crash, systemic, sector alerts
 */

/**
 * Check all watchlist stocks for BUY signals
 * Evaluates all 11 conditions per stock
 *
 * @param {Object} niftyData - from getNiftyData()
 * @param {Object} config - from getAllScreenerConfig()
 */
function checkWatchlistForBuySignals(niftyData, config) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SCREENER_CONFIG.sheets.watchlist);
  if (!sheet) return;

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  const data = sheet.getRange(2, 1, lastRow - 1, 25).getValues();
  const today = new Date();

  // Get current holdings count and sector breakdown
  const holdings = _getActiveHoldings();
  const holdingCount = holdings.length;
  const sectorCounts = _getSectorCounts(holdings);
  const totalInvested = holdings.reduce(function(sum, h) { return sum + (h.totalInvested || 0); }, 0);
  const budget = config.STOCK_BUDGET || 300000;
  const cashAvailable = budget - totalInvested;

  for (let i = 0; i < data.length; i++) {
    const row = i + 2;
    const sym = String(data[i][0]).trim();
    if (!sym) continue;

    const status = String(data[i][7]).trim(); // col H
    // Only check NEW or COOLING stocks
    if (status !== 'NEW' && status !== 'COOLING' && status !== 'ELIGIBLE') continue;

    const dateFound = data[i][2]; // col C
    const foundPrice = parseFloat(data[i][3]) || 0;
    const screenersStr = String(data[i][4]); // col E
    const coolingEnd = data[i][6]; // col G
    const currentPrice = parseFloat(data[i][8]) || 0;
    const rsi = parseFloat(data[i][10]) || 50; // col K
    const dma50 = parseFloat(data[i][11]) || 0; // col L
    const dma200 = parseFloat(data[i][12]) || 0; // col M
    const return6m = parseFloat(data[i][14]) || 0; // col O
    const niftyReturn6m = niftyData.return6m || 0;
    const sector = String(data[i][17]).trim(); // col R
    const marketCapCr = parseFloat(data[i][23]) || 0; // col X
    const capClass = String(data[i][24]).trim(); // col Y

    const screeners = screenersStr.split(',').map(function(s) { return parseInt(s); }).filter(function(s) { return !isNaN(s); });

    // --- Check cooling period ---
    if (coolingEnd && today < new Date(coolingEnd)) {
      if (status !== 'COOLING') {
        sheet.getRange(row, 8).setValue('COOLING'); // col H: Status
      }
      continue;
    }

    // --- Check price runup (expire if >20% since found) ---
    if (foundPrice > 0 && currentPrice > 0) {
      const priceChange = ((currentPrice - foundPrice) / foundPrice) * 100;
      sheet.getRange(row, 10).setValue(Math.round(priceChange * 100) / 100); // col J

      const runupLimit = config.PRICE_RUNUP_EXPIRE_PCT || 20;
      if (priceChange > runupLimit) {
        sheet.getRange(row, 8).setValue('EXPIRED');
        sheet.getRange(row, 21).setValue('Price ran up ' + Math.round(priceChange) + '% since found');
        continue;
      }
    }

    // Update status to ELIGIBLE if past cooling
    if (status !== 'ELIGIBLE') {
      sheet.getRange(row, 8).setValue('ELIGIBLE');
    }

    // --- Evaluate ALL 11 BUY conditions ---
    const failed = [];

    // 1. Cooling period passed ✅ (we're here, so it passed)

    // 2. Passes 2+ screeners
    if (screeners.length < 2) {
      failed.push('#2: Only ' + screeners.length + ' screener(s)');
    }

    // 3. RSI < 45
    const rsiMax = config.RSI_BUY_MAX || 45;
    if (rsi >= rsiMax) {
      failed.push('#3: RSI=' + rsi + ' (need <' + rsiMax + ')');
    }

    // 4. Price change < 20%
    // Already checked above (expired if > 20%)

    // 5. Portfolio < 8 stocks
    const maxStocks = config.MAX_STOCKS || 8;
    if (holdingCount >= maxStocks) {
      failed.push('#5: Portfolio full (' + holdingCount + '/' + maxStocks + ')');
    }

    // 6. < 2 stocks in same sector
    const maxPerSector = config.MAX_PER_SECTOR || 2;
    if (sector && (sectorCounts[sector] || 0) >= maxPerSector) {
      failed.push('#6: Sector ' + sector + ' full (' + sectorCounts[sector] + '/' + maxPerSector + ')');
    }

    // 7. Budget has room
    const conviction = SCREENER_CONFIG.getConviction(screeners);
    const maxAllocPct = SCREENER_CONFIG.getMaxAllocationPct(conviction);
    const starterAmount = budget * (maxAllocPct / 100) * 0.5; // 50% of allocation
    if (cashAvailable < starterAmount) {
      failed.push('#7: Not enough cash (need ₹' + Math.round(starterAmount) + ', have ₹' + Math.round(cashAvailable) + ')');
    }

    // 8. Nifty above 200DMA
    const niftyAbove = niftyData.aboveDMA200;
    if (niftyAbove === false) {
      // Not a hard block — half allocation
      failed.push('#8: Nifty below 200DMA (half allocation)');
    }

    // 9. Golden cross (50DMA > 200DMA)
    const hasGoldenCross = dma50 > 0 && dma200 > 0 && dma50 > dma200;
    sheet.getRange(row, 14).setValue(hasGoldenCross ? 'YES' : 'NO'); // col N

    if (!hasGoldenCross) {
      // Exception: Screener 1+3 overlap + RSI < 30
      const hasException = screeners.includes(1) && screeners.includes(3) && rsi < 30;
      if (!hasException) {
        failed.push('#9: No golden cross (50DMA=' + dma50 + ', 200DMA=' + dma200 + ')');
      }
    }

    // 10. Relative strength (6M return > Nifty 6M return)
    sheet.getRange(row, 16).setValue(niftyReturn6m); // col P
    const relStrength = return6m > niftyReturn6m;
    sheet.getRange(row, 17).setValue(relStrength ? 'PASS' : 'FAIL'); // col Q
    if (!relStrength) {
      failed.push('#10: 6M return ' + return6m + '% < Nifty ' + niftyReturn6m + '%');
    }

    // 11. Market cap >= minimum (skip micro caps)
    const minMcap = config.MIN_MARKET_CAP_CR || 500;
    if (marketCapCr > 0 && marketCapCr < minMcap) {
      failed.push('#11: Market cap ₹' + Math.round(marketCapCr) + ' Cr < ₹' + minMcap + ' Cr (' + capClass + ')');
    } else if (capClass === 'MICRO') {
      failed.push('#11: Micro cap — below ₹500 Cr');
    }

    // Update Nifty >200DMA column
    sheet.getRange(row, 19).setValue(niftyAbove ? 'YES' : 'NO'); // col S

    // --- Result ---
    const allMet = failed.length === 0;
    sheet.getRange(row, 20).setValue(allMet ? 'YES' : 'NO'); // col T
    sheet.getRange(row, 21).setValue(failed.join(' | ')); // col U
    sheet.getRange(row, 22).setValue(today); // col V: Last Updated

    if (allMet) {
      // Generate BUY_STARTER signal
      const adjustedAllocation = niftyAbove === false
        ? starterAmount * (config.NIFTY_BELOW_200DMA_ALLOCATION || 50) / 100
        : starterAmount;

      const shares = currentPrice > 0 ? Math.floor(adjustedAllocation / currentPrice) : 0;

      _createSignal({
        type: 'BUY_STARTER',
        symbol: sym,
        name: String(data[i][1]),
        amount: adjustedAllocation,
        shares: shares,
        triggerDetail: 'Screeners: ' + screenersStr + ', RSI: ' + rsi +
          ', Golden Cross: ' + (hasGoldenCross ? 'YES' : 'EXCEPTION(1+3)') +
          ', 6M vs Nifty: ' + return6m + '% vs ' + niftyReturn6m + '%' +
          ', Cap: ' + (capClass || 'N/A') + ' (₹' + Math.round(marketCapCr) + ' Cr)',
        conviction: conviction
      });

      Logger.log('BUY signal generated for ' + sym + ' (' + conviction + ')');
    }
  }
}

/**
 * Check holdings for ADD and DIP BUY signals
 */
function checkHoldingsForAddSignals(config) {
  const holdings = _getActiveHoldings();

  for (let i = 0; i < holdings.length; i++) {
    const h = holdings[i];

    // Skip if no current price
    if (!h.currentPrice || !h.entryPrice) continue;

    // Use avgPrice (blended cost after pyramiding) for gain calculation
    const costBasis = h.avgPrice > 0 ? h.avgPrice : h.entryPrice;
    const gainPct = ((h.currentPrice - costBasis) / costBasis) * 100;
    const timeSinceEntry = (new Date() - new Date(h.entryDate)) / (1000 * 60 * 60 * 24);

    // --- ADD #1 ---
    if (h.pyramidStage === 'STARTER' && !h.dipBuyUsed) {
      const add1Min = config.ADD1_GAIN_PCT || 12;
      const add1Max = config.ADD1_MAX_GAIN_PCT || 25;
      const minWeeks = config.ADD_MIN_WEEKS || 2;

      if (gainPct >= add1Min && gainPct <= add1Max && timeSinceEntry >= minWeeks * 7) {
        // Check still passes 2+ screeners
        const screeners = h.screenersStr ? h.screenersStr.split(',').length : 0;
        if (screeners >= 2 && h.currentPrice > (h.dma200 || 0)) {
          const conviction = h.conviction || 'MEDIUM';
          const maxAllocPct = SCREENER_CONFIG.getMaxAllocationPct(conviction);
          const budget = config.STOCK_BUDGET || 300000;
          const addAmount = budget * (maxAllocPct / 100) * 0.25; // 25% of allocation
          const addShares = Math.floor(addAmount / h.currentPrice);

          _createSignal({
            type: 'ADD1',
            symbol: h.symbol,
            name: h.name,
            amount: addAmount,
            shares: addShares,
            triggerDetail: 'Gain: +' + Math.round(gainPct) + '%, ' + timeSinceEntry.toFixed(0) +
              ' days since entry, Screeners: ' + h.screenersStr
          });
        }
      }
    }

    // --- ADD #2 ---
    if (h.pyramidStage === 'ADD1') {
      const add2Min = config.ADD2_GAIN_PCT || 30;
      const minWeeks = config.ADD_MIN_WEEKS || 2;
      const lastAddDate = h.lastAddDate || h.entryDate;
      const timeSinceLastAdd = (new Date() - new Date(lastAddDate)) / (1000 * 60 * 60 * 24);

      if (gainPct >= add2Min && timeSinceLastAdd >= minWeeks * 7) {
        const screeners = h.screenersStr ? h.screenersStr.split(',').length : 0;
        if (screeners >= 2 && h.currentPrice > (h.dma200 || 0)) {
          const conviction = h.conviction || 'MEDIUM';
          const maxAllocPct = SCREENER_CONFIG.getMaxAllocationPct(conviction);
          const budget = config.STOCK_BUDGET || 300000;
          const addAmount = budget * (maxAllocPct / 100) * 0.25;
          const addShares = Math.floor(addAmount / h.currentPrice);

          _createSignal({
            type: 'ADD2',
            symbol: h.symbol,
            name: h.name,
            amount: addAmount,
            shares: addShares,
            triggerDetail: 'Gain: +' + Math.round(gainPct) + '%, ' +
              timeSinceLastAdd.toFixed(0) + ' days since Add #1, Screeners: ' + h.screenersStr
          });
        }
      }
    }

    // --- DIP BUY (one-time only, Screener 1+3 overlap, RSI < 30, above 200DMA) ---
    if (!h.dipBuyUsed && h.pyramidStage === 'STARTER') {
      const dropPct = Math.abs(gainPct);
      const dipMin = config.DIP_BUY_MIN_DROP || 10;
      const dipMax = config.DIP_BUY_MAX_DROP || 20;
      const dipRsiMax = config.DIP_BUY_RSI_MAX || 30;

      if (gainPct < 0 && dropPct >= dipMin && dropPct <= dipMax) {
        // Must pass Screener 1 + 3
        const screeners = h.screenersStr ? h.screenersStr.split(',').map(Number) : [];
        const has1and3 = screeners.includes(1) && screeners.includes(3);

        if (has1and3 && h.rsi <= dipRsiMax && h.currentPrice > (h.dma200 || 0)) {
          const conviction = h.conviction || 'MEDIUM';
          const maxAllocPct = SCREENER_CONFIG.getMaxAllocationPct(conviction);
          const budget = config.STOCK_BUDGET || 300000;
          const dipAmount = budget * (maxAllocPct / 100) * 0.25;
          const dipShares = Math.floor(dipAmount / h.currentPrice);

          _createSignal({
            type: 'DIP_BUY',
            symbol: h.symbol,
            name: h.name,
            amount: dipAmount,
            shares: dipShares,
            triggerDetail: 'Drop: -' + Math.round(dropPct) + '%, RSI: ' + h.rsi +
              ', Screeners 1+3: YES, Above 200DMA: YES'
          });
        }
      }
    }
  }
}

/**
 * Check holdings for EXIT signals (hard exits + trailing stops)
 */
function checkHoldingsForExitSignals(config) {
  const holdings = _getActiveHoldings();
  let hardExitCount = 0;

  for (let i = 0; i < holdings.length; i++) {
    const h = holdings[i];
    if (!h.currentPrice) continue;

    // Use avgPrice (blended cost after pyramiding) for gain calculation
    const costBasis = h.avgPrice > 0 ? h.avgPrice : h.entryPrice;
    const gainPct = costBasis ? ((h.currentPrice - costBasis) / costBasis) * 100 : 0;

    // --- Hard stop loss: -30% from entry ---
    const hardStopPct = config.HARD_STOP_LOSS || 30;
    if (gainPct <= -hardStopPct) {
      _createSignal({
        type: 'HARD_EXIT',
        symbol: h.symbol,
        name: h.name,
        amount: h.currentPrice * h.totalShares,
        shares: h.totalShares,
        triggerDetail: 'Hard stop: -' + Math.round(Math.abs(gainPct)) + '% from entry ₹' + h.entryPrice
      });
      hardExitCount++;
      continue;
    }

    // --- Trailing stop ---
    const stop = calculateTrailingStopForHolding({
      entryPrice: h.entryPrice,
      currentPrice: h.currentPrice,
      peakPrice: h.peakPrice,
      pnlPct: gainPct,
      isCompounder: h.isCompounder
    }, config);

    if (stop.stopPrice && h.currentPrice <= stop.stopPrice) {
      _createSignal({
        type: 'TRAILING_STOP',
        symbol: h.symbol,
        name: h.name,
        amount: h.currentPrice * h.totalShares,
        shares: h.totalShares,
        triggerDetail: 'Trailing stop hit: ₹' + h.currentPrice + ' <= ₹' + stop.stopPrice +
          ' (' + stop.description + '). Gain from entry: ' + Math.round(gainPct) + '%'
      });
      continue;
    }

    // --- LTCG alert (within 60 days of 1 year) ---
    if (h.entryDate) {
      const daysHeld = Math.floor((new Date() - new Date(h.entryDate)) / (1000 * 60 * 60 * 24));
      const daysToLTCG = 365 - daysHeld;
      if (daysToLTCG > 0 && daysToLTCG <= 60 && gainPct < 0) {
        _createSignal({
          type: 'LTCG_ALERT',
          symbol: h.symbol,
          name: h.name,
          triggerDetail: daysToLTCG + ' days to LTCG. Current P&L: ' + Math.round(gainPct) +
            '%. Consider waiting for tax benefit before selling.'
        });
      }
    }
  }

  // --- Systemic risk: 3+ hard exits at same time ---
  const systemic = config.SYSTEMIC_EXIT_COUNT || 3;
  if (hardExitCount >= systemic) {
    _createSignal({
      type: 'SYSTEMIC_EXIT',
      symbol: 'ALL',
      name: 'SYSTEMIC RISK',
      triggerDetail: hardExitCount + ' hard exits triggered simultaneously. Consider exiting all positions.'
    });
  }
}

/**
 * Check portfolio-level conditions: freeze, crash, sector concentration
 */
function checkPortfolioLevel(niftyData, config) {
  const holdings = _getActiveHoldings();
  if (holdings.length === 0) return;

  const budget = config.STOCK_BUDGET || 300000;
  const totalInvested = holdings.reduce(function(s, h) { return s + (h.totalInvested || 0); }, 0);
  const totalCurrentValue = holdings.reduce(function(s, h) {
    return s + ((h.currentPrice || 0) * (h.totalShares || 0));
  }, 0);

  // --- Portfolio freeze: -25% from peak ---
  // We'd need to track portfolio peak value — for now, check vs total invested
  const portfolioPnlPct = totalInvested > 0 ? ((totalCurrentValue - totalInvested) / totalInvested) * 100 : 0;
  const freezePct = config.PORTFOLIO_FREEZE_PCT || 25;
  if (portfolioPnlPct <= -freezePct) {
    _createSignal({
      type: 'FREEZE',
      symbol: 'PORTFOLIO',
      name: 'PORTFOLIO FREEZE',
      triggerDetail: 'Portfolio down ' + Math.round(Math.abs(portfolioPnlPct)) + '% from invested. ' +
        'Stop all new buys and adds until recovery.'
    });
  }

  // --- Nifty crash alert: -20% in 1 month ---
  const crashPct = config.NIFTY_CRASH_PCT || 20;
  if (niftyData.return1m !== null && niftyData.return1m <= -crashPct) {
    _createSignal({
      type: 'CRASH_ALERT',
      symbol: 'NIFTY',
      name: 'NIFTY CRASH ALERT',
      triggerDetail: 'Nifty 50 down ' + Math.round(Math.abs(niftyData.return1m)) + '% in 1 month. ' +
        'Review all positions. Market in distress.'
    });
  }

  // --- Sector concentration check ---
  const sectorAllocations = {};
  for (let i = 0; i < holdings.length; i++) {
    const sector = holdings[i].sector || 'Unknown';
    const value = (holdings[i].currentPrice || 0) * (holdings[i].totalShares || 0);
    sectorAllocations[sector] = (sectorAllocations[sector] || 0) + value;
  }

  const sectorAlertPct = config.SECTOR_ALERT_PCT || 35;
  for (const sector in sectorAllocations) {
    const pct = totalCurrentValue > 0 ? (sectorAllocations[sector] / totalCurrentValue) * 100 : 0;
    if (pct > sectorAlertPct) {
      _createSignal({
        type: 'SECTOR_ALERT',
        symbol: sector,
        name: 'SECTOR ALERT: ' + sector,
        triggerDetail: sector + ' sector at ' + Math.round(pct) + '% of portfolio (limit: ' + sectorAlertPct + '%). ' +
          'Consider trimming.'
      });
    }
  }

  // --- Rebalance check: single stock > 20% ---
  for (let i = 0; i < holdings.length; i++) {
    const value = (holdings[i].currentPrice || 0) * (holdings[i].totalShares || 0);
    const allocPct = totalCurrentValue > 0 ? (value / totalCurrentValue) * 100 : 0;
    if (allocPct > 20) {
      _createSignal({
        type: 'REBALANCE',
        symbol: holdings[i].symbol,
        name: holdings[i].name,
        triggerDetail: 'Stock at ' + Math.round(allocPct) + '% of portfolio (max 20%). Trim to 15%.'
      });
    }
  }
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Get active holdings from Screener_Holdings sheet
 */
function _getActiveHoldings() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SCREENER_CONFIG.sheets.holdings);
  if (!sheet) return [];

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const data = sheet.getRange(2, 1, lastRow - 1, 30).getValues();
  const holdings = [];

  for (let i = 0; i < data.length; i++) {
    const status = String(data[i][25]).trim(); // col Z (26th, 0-indexed = 25)
    if (status === 'SOLD') continue;

    holdings.push({
      row: i + 2,
      symbol: String(data[i][0]).trim(),
      name: String(data[i][1]).trim(),
      sector: String(data[i][2]).trim(),
      entryDate: data[i][3],
      entryPrice: parseFloat(data[i][4]) || 0,
      totalShares: parseFloat(data[i][5]) || 0,
      totalInvested: parseFloat(data[i][6]) || 0,
      avgPrice: parseFloat(data[i][7]) || 0,
      currentPrice: parseFloat(data[i][8]) || 0,
      peakPrice: parseFloat(data[i][11]) || 0,
      pyramidStage: String(data[i][14]).trim(),
      dipBuyUsed: String(data[i][15]).trim() === 'YES',
      screenersStr: String(data[i][16]).trim(),
      conviction: String(data[i][17]).trim(),
      isCompounder: String(data[i][18]).trim() === 'YES',
      rsi: parseFloat(data[i][21]) || 50,
      dma50: parseFloat(data[i][22]) || 0,
      dma200: parseFloat(data[i][23]) || 0,
      status: status,
      lastAddDate: data[i][29] || null  // col AD
    });
  }

  return holdings;
}

/**
 * Count stocks per sector from holdings
 */
function _getSectorCounts(holdings) {
  const counts = {};
  for (let i = 0; i < holdings.length; i++) {
    const sector = holdings[i].sector || 'Unknown';
    counts[sector] = (counts[sector] || 0) + 1;
  }
  return counts;
}

/**
 * Create a signal in Screener_Signals sheet
 * Deduplicates: won't create duplicate signal for same stock + type on same day
 */
function _createSignal(params) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SCREENER_CONFIG.sheets.signals);
  if (!sheet) return;

  const today = new Date();
  const todayStr = Utilities.formatDate(today, Session.getScriptTimeZone(), 'yyyy-MM-dd');

  // Check for duplicate (same symbol + type + date)
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    const existing = sheet.getRange(2, 1, lastRow - 1, 5).getValues();
    for (let i = 0; i < existing.length; i++) {
      const existDate = existing[i][1] ? Utilities.formatDate(new Date(existing[i][1]), Session.getScriptTimeZone(), 'yyyy-MM-dd') : '';
      if (String(existing[i][2]) === params.type &&
          String(existing[i][4]) === params.symbol &&
          existDate === todayStr) {
        Logger.log('Duplicate signal skipped: ' + params.type + ' ' + params.symbol);
        return;
      }
    }
  }

  // Generate signal ID
  const signalId = 'SIG-' + todayStr.replace(/-/g, '') + '-' + (lastRow || 1);

  const priority = SCREENER_CONFIG.signalPriority[params.type] || 6;

  const isPaper = getScreenerConfigValue('PAPER_TRADING');
  const prefix = isPaper ? '[PAPER] ' : '';

  // Human-readable action text
  let action = prefix;
  if (params.type === 'BUY_STARTER') {
    action += 'Buy ' + (params.shares || '?') + ' shares of ' + params.symbol + ' @ ~₹' +
      Math.round(params.amount / (params.shares || 1));
  } else if (params.type.startsWith('ADD') || params.type === 'DIP_BUY') {
    action += 'Add ' + (params.shares || '?') + ' shares of ' + params.symbol + ' @ ~₹' +
      Math.round(params.amount / (params.shares || 1));
  } else if (params.type === 'TRAILING_STOP' || params.type === 'HARD_EXIT' || params.type === 'SYSTEMIC_EXIT') {
    action += 'SELL all ' + (params.shares || '') + ' shares of ' + params.symbol;
  } else {
    action += params.type + ': ' + params.symbol;
  }

  const row = [
    signalId,                  // A: Signal ID
    today,                     // B: Date
    params.type,               // C: Signal Type
    priority,                  // D: Priority
    params.symbol,             // E: Symbol
    params.name || '',         // F: Stock Name
    action,                    // G: Action
    params.amount || '',       // H: Amount ₹
    params.shares || '',       // I: Shares
    params.triggerDetail || '',// J: Trigger Detail
    '',                        // K: Fundamentals JSON
    'PENDING',                 // L: Status
    '',                        // M: Executed Date
    '',                        // N: Executed Price
    'NO',                      // O: Email Sent
    ''                         // P: Notes
  ];

  sheet.appendRow(row);
  Logger.log('Signal created: ' + signalId + ' — ' + params.type + ' ' + params.symbol);
}
