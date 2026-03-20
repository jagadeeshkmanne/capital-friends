/**
 * ============================================================================
 * SIGNAL ENGINE — BUY, ADD, EXIT, REBALANCE signal generation
 * ============================================================================
 *
 * Core logic:
 * - checkWatchlistForBuySignals(): Factor score + 8 BUY conditions
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

  const data = sheet.getRange(2, 1, lastRow - 1, 40).getValues(); // A-AN (40 cols, includes factor score/rank + liquidity)
  const today = new Date();

  // Get current holdings count and sector breakdown
  const holdings = _getActiveHoldings();
  const holdingCount = holdings.length;
  const sectorCounts = _getSectorCounts(holdings);
  const totalInvested = holdings.reduce(function(sum, h) { return sum + (h.totalInvested || 0); }, 0);
  const budget = config.STOCK_BUDGET || 300000;
  const cashAvailable = budget - totalInvested;
  const candidates = []; // Collect passing stocks, then rank-select top N

  for (let i = 0; i < data.length; i++) {
    const row = i + 2;
    const sym = String(data[i][0]).trim();
    if (!sym) continue;

    const status = String(data[i][7]).trim(); // col H
    // Only check NEW or COOLING stocks
    if (status !== 'NEW' && status !== 'COOLING' && status !== 'ELIGIBLE') continue;

    const dateFound = data[i][2]; // col C
    const foundPrice = parseFloat(data[i][3]) || 0;
    const conviction = String(data[i][5]).trim() || 'BASE'; // col F: kept for backward compat
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
    const factorScore = parseFloat(data[i][37]) || 0; // AL: Factor Score
    const factorRank = parseInt(data[i][38]) || 99;    // AM: Factor Rank
    const avgTradedValCr = parseFloat(data[i][39]) || 0; // AN: Avg Daily Traded Value (Cr)

    // --- Screener overlap data (col E) ---
    const screenersStr = String(data[i][4]).trim(); // col E: e.g. "1", "1,2", "1,2,3"
    let screenerCount = 0;
    if (screenersStr && screenersStr !== 'CF-Stock-Screener') {
      screenerCount = screenersStr.split(',').filter(function(s) { return s.trim() !== ''; }).length;
    } else if (screenersStr === 'CF-Stock-Screener') {
      screenerCount = 1; // legacy format
    }
    const isMomentumOnly = screenersStr === '2'; // only in CF-Momentum

    const lastSeenInScreener = data[i][21]; // col V: Last Updated (set by addToWatchlist from email parsing)

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
      // Reset "last seen" timer when transitioning COOLING → ELIGIBLE
      // Prevents false STALE for stocks with long cooling periods
      sheet.getRange(row, 22).setValue(today); // col V
    }

    // --- STALE detection ---
    // Col V tracks when stock was last seen in a Trendlyne screener email.
    // If ELIGIBLE and not seen in any screener for 30+ days → mark STALE.
    // STALE stocks skip buy evaluation but stay on watchlist.
    // If stock re-appears in screener emails, addToWatchlist() resets to ELIGIBLE.
    if (lastSeenInScreener) {
      const daysSinceLastSeen = Math.floor((today - new Date(lastSeenInScreener)) / (24 * 60 * 60 * 1000));
      const staleDays = config.STALE_AFTER_DAYS || 30;
      if (daysSinceLastSeen > staleDays) {
        sheet.getRange(row, 8).setValue('STALE');
        sheet.getRange(row, 21).setValue('Not in any screener for ' + daysSinceLastSeen + ' days');
        Logger.log(sym + ' → STALE (last seen ' + daysSinceLastSeen + ' days ago)');
        continue;
      }
    }

    // --- Evaluate BUY conditions ---
    // Philosophy: Factor score is the primary gate. Hard gates only for
    // portfolio constraints, extreme RSI, and fundamental filters.
    // Technical conditions (golden cross, price vs 200DMA, relative strength)
    // are INSIDE the factor score — not hard gates.
    const failed = [];

    // 1. Factor score minimum — core gate (embeds trend, momentum, quality, etc.)
    const factorBuyMin = config.FACTOR_BUY_MIN || 50;
    if (factorScore < factorBuyMin) {
      failed.push('Factor score too low (' + factorScore + ', min ' + factorBuyMin + ')');
    }

    // 2. RSI overbought block — only hard gate at 70+
    // RSI 60-69 already penalized inside factor score (Trend factor: rsiScore = 20 or 10)
    // No soft gate at 65 — avoids double punishment
    const rsiOverbought = config.RSI_OVERBOUGHT || 70;
    if (rsi > rsiOverbought) {
      failed.push('RSI overbought (' + rsi + ', max ' + rsiOverbought + ')');
    }

    // 3. Portfolio < MAX_STOCKS
    const maxStocks = config.MAX_STOCKS || 8;
    if (holdingCount >= maxStocks) {
      failed.push('Portfolio full (' + holdingCount + '/' + maxStocks + ')');
    }

    // 4. Sector limit
    const maxPerSector = config.MAX_PER_SECTOR || 2;
    if (sector && (sectorCounts[sector] || 0) >= maxPerSector) {
      failed.push(sector + ' sector full');
    }

    // 5. Budget has room — allocation by factor rank × overlap multiplier
    const maxAllocPct = SCREENER_CONFIG.getAllocationByRank(factorRank, config);
    const overlapMultiplier = SCREENER_CONFIG.getOverlapAllocationMultiplier(screenerCount);
    const starterAmount = budget * (maxAllocPct / 100) * 0.5 * overlapMultiplier; // 50% of allocation × overlap sizing
    if (cashAvailable < starterAmount) {
      failed.push('Low cash (need ₹' + Math.round(starterAmount / 1000) + 'K)');
    }

    // 9. Momentum-only guard — max 2 momentum-only stocks in portfolio
    if (isMomentumOnly) {
      const momentumOnlyCount = holdings.filter(function(h) { return h.screenersStr === '2'; }).length;
      if (momentumOnlyCount >= (SCREENER_CONFIG.MAX_MOMENTUM_ONLY_STOCKS || 2)) {
        failed.push('Momentum-only limit reached (' + momentumOnlyCount + '/' + SCREENER_CONFIG.MAX_MOMENTUM_ONLY_STOCKS + ')');
      }
    }

    // 6. Market regime — scales allocation, NEVER blocks
    const niftyAbove = niftyData.aboveDMA200;
    const regimeMultiplier = SCREENER_CONFIG.getMarketRegimeMultiplier(niftyData);
    // No hard block. Bear regime → 25% allocation (still trades, just smaller).

    // 7. Market cap >= minimum (skip micro caps)
    const minMcap = config.MIN_MARKET_CAP_CR || 500;
    if (marketCapCr > 0 && marketCapCr < minMcap) {
      failed.push('Small cap (₹' + Math.round(marketCapCr) + 'Cr)');
    } else if (capClass === 'MICRO') {
      failed.push('Micro cap');
    }

    // 8. Liquidity filter — avg daily traded value >= minimum
    const minTradedVal = config.MIN_AVG_TRADED_VALUE_CR || 3;
    if (avgTradedValCr > 0 && avgTradedValCr < minTradedVal) {
      failed.push('Low liquidity (₹' + avgTradedValCr.toFixed(1) + 'Cr/day, min ₹' + minTradedVal + 'Cr)');
    }

    // --- Informational columns (NOT gates, just tracking) ---
    const hasGoldenCross = dma50 > 0 && dma200 > 0 && dma50 > dma200;
    sheet.getRange(row, 14).setValue(hasGoldenCross ? 'YES' : 'NO'); // col N

    sheet.getRange(row, 16).setValue(niftyData.return6m || 0); // col P: Nifty 6M return
    const beatsNifty = return6m > (niftyData.return6m || 0);
    let benchmarkReturn = niftyData.return6m || 0;
    if (capClass === 'MID' && niftyData.midcapReturn6m != null) benchmarkReturn = niftyData.midcapReturn6m;
    else if ((capClass === 'SMALL' || capClass === 'MICRO') && niftyData.smallcapReturn6m != null) benchmarkReturn = niftyData.smallcapReturn6m;
    sheet.getRange(row, 17).setValue(beatsNifty && return6m > benchmarkReturn ? 'PASS' : 'FAIL'); // col Q

    sheet.getRange(row, 19).setValue(niftyAbove ? 'YES' : 'NO'); // col S

    // --- Result ---
    const allMet = failed.length === 0;
    sheet.getRange(row, 20).setValue(allMet ? 'YES' : 'NO'); // col T
    sheet.getRange(row, 21).setValue(failed.join(' | ')); // col U
    // col V: NOT updated here — only addToWatchlist() writes it (tracks "last seen in screener email")

    if (allMet) {
      // Collect candidate — rank-based selection happens after the loop
      candidates.push({
        sym: sym, name: String(data[i][1]), conviction: conviction,
        currentPrice: currentPrice, rsi: rsi, factorScore: factorScore,
        factorRank: factorRank, hasGoldenCross: hasGoldenCross,
        return6m: return6m, niftyReturn6m: niftyReturn6m,
        capClass: capClass, marketCapCr: marketCapCr,
        starterAmount: starterAmount, regimeMultiplier: regimeMultiplier,
        screenersStr: screenersStr, screenerCount: screenerCount,
        overlapMultiplier: overlapMultiplier
      });
    }
  }

  // --- RANK-BASED SELECTION: only generate signals for top N candidates ---
  // N = remaining portfolio slots (MAX_STOCKS - current holdings)
  const remainingSlots = Math.max(0, (config.MAX_STOCKS || 8) - holdingCount);
  candidates.sort(function(a, b) { return b.factorScore - a.factorScore; }); // highest score first

  const topN = candidates.slice(0, remainingSlots);
  for (let c = 0; c < topN.length; c++) {
    const cand = topN[c];
    const signalAction = SCREENER_CONFIG.getSignalAction(cand.factorScore);
    const adjustedAllocation = Math.round(cand.starterAmount * cand.regimeMultiplier);
    const shares = cand.currentPrice > 0 ? Math.floor(adjustedAllocation / cand.currentPrice) : 0;

    _createSignal({
      type: 'BUY_STARTER',
      symbol: cand.sym,
      name: cand.name,
      amount: adjustedAllocation,
      shares: shares,
      triggerDetail: 'Factor: ' + cand.factorScore + ' (Rank #' + cand.factorRank + '), ' +
        'Screeners: ' + (cand.screenersStr || 'N/A') + ' (' + cand.screenerCount + '×, alloc ' + Math.round(cand.overlapMultiplier * 100) + '%), ' +
        'RSI: ' + cand.rsi + ', Golden Cross: ' + (cand.hasGoldenCross ? 'YES' : 'NO') +
        ', 6M vs Nifty: ' + cand.return6m + '% vs ' + cand.niftyReturn6m + '%' +
        ', Regime: ' + Math.round(cand.regimeMultiplier * 100) + '%' +
        ', Cap: ' + (cand.capClass || 'N/A') + ' (₹' + Math.round(cand.marketCapCr) + ' Cr)',
      conviction: cand.conviction,
      factorScore: cand.factorScore,
      factorRank: cand.factorRank
    });

    Logger.log('BUY signal: ' + cand.sym + ' (Score:' + cand.factorScore + ', Rank:#' + cand.factorRank +
      ', Screeners:' + (cand.screenersStr || 'N/A') + ' (' + cand.screenerCount + '×)' +
      ', Alloc:₹' + adjustedAllocation + ', Regime:' + Math.round(cand.regimeMultiplier * 100) + '%)');
  }

  if (candidates.length > topN.length) {
    Logger.log('Rank selection: ' + candidates.length + ' candidates, took top ' + topN.length +
      ' (slots: ' + remainingSlots + '). Skipped: ' +
      candidates.slice(topN.length).map(function(c) { return c.sym + '(' + c.factorScore + ')'; }).join(', '));
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
        // Must be above 200DMA
        if (h.currentPrice > (h.dma200 || 0)) {
          const conviction = h.conviction || 'BASE';
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
              ' days since entry, Conviction: ' + conviction
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
        // Must be above 200DMA
        if (h.currentPrice > (h.dma200 || 0)) {
          const conviction = h.conviction || 'BASE';
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
              timeSinceLastAdd.toFixed(0) + ' days since Add #1, Conviction: ' + conviction
          });
        }
      }
    }

    // --- DIP BUY (one-time only, RSI oversold, above 200DMA) ---
    if (!h.dipBuyUsed && h.pyramidStage === 'STARTER') {
      const dropPct = Math.abs(gainPct);
      const dipMin = config.DIP_BUY_MIN_DROP || 10;
      const dipMax = config.DIP_BUY_MAX_DROP || 20;
      const dipRsiMax = config.DIP_BUY_RSI_MAX || 30;

      if (gainPct < 0 && dropPct >= dipMin && dropPct <= dipMax) {
        if (h.rsi <= dipRsiMax && h.currentPrice > (h.dma200 || 0)) {
          const conviction = h.conviction || 'BASE';
          const maxAllocPct = SCREENER_CONFIG.getMaxAllocationPct(conviction, config);
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
              ', Above 200DMA: YES, Conviction: ' + conviction
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
      pnlPct: gainPct
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
      // col S: isCompounder deprecated, always false
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
