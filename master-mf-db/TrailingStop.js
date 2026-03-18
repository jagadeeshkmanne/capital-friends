/**
 * ============================================================================
 * TRAILING STOP — Peak price tracking, stop calculation, tier logic
 * ============================================================================
 */

/**
 * Calculate trailing stop price and tier for a holding
 *
 * @param {Object} holding - { entryPrice, currentPrice, peakPrice, pnlPct, isCompounder }
 * @param {Object} config - from getAllScreenerConfig()
 * @returns {Object} { stopPrice, stopPct, tier, description }
 */
function calculateTrailingStopForHolding(holding, config) {
  const pnlPct = holding.pnlPct || 0;
  const peakPrice = holding.peakPrice || holding.currentPrice || holding.entryPrice;
  const isCompounder = holding.isCompounder;

  // --- Compounder exception ---
  if (isCompounder) {
    return _calculateCompounderStop(holding, config, pnlPct, peakPrice);
  }

  // Use MAX gain (from peak) for tier selection — tiers NEVER downgrade
  // Even if current gain drops, stop tier stays at highest level reached
  const entryPrice = holding.entryPrice || 0;
  const maxGainPct = entryPrice > 0 ? ((peakPrice - entryPrice) / entryPrice * 100) : pnlPct;

  // --- Normal trailing stop ---
  let stopPct;
  let tier;

  if (maxGainPct >= 100) {
    stopPct = config.TRAILING_STOP_100_PLUS || 12;
    tier = '100%+';
  } else if (maxGainPct >= 50) {
    stopPct = config.TRAILING_STOP_50_100 || 15;
    tier = '50-100%';
  } else if (maxGainPct >= 20) {
    stopPct = config.TRAILING_STOP_20_50 || 20;
    tier = '20-50%';
  } else {
    // 0-20% max gain: stop is from ENTRY price (not peak)
    stopPct = config.TRAILING_STOP_0_20 || 25;
    tier = '0-20%';
    const stopPrice = holding.entryPrice * (1 - stopPct / 100);
    return {
      stopPrice: Math.round(stopPrice * 100) / 100,
      stopPct: stopPct,
      tier: tier,
      description: '-' + stopPct + '% from entry ₹' + holding.entryPrice
    };
  }

  // For 20%+ max gain: stop is from PEAK price
  const stopPrice = peakPrice * (1 - stopPct / 100);
  return {
    stopPrice: Math.round(stopPrice * 100) / 100,
    stopPct: stopPct,
    tier: tier,
    description: '-' + stopPct + '% from peak ₹' + peakPrice
  };
}

/**
 * Compounder trailing stop — wider stops, no stop below +40%
 */
function _calculateCompounderStop(holding, config, pnlPct, peakPrice) {
  // Use MAX gain (from peak) for tier selection — tiers NEVER downgrade
  const entryPrice = holding.entryPrice || 0;
  const maxGainPct = entryPrice > 0 ? ((peakPrice - entryPrice) / entryPrice * 100) : pnlPct;

  if (maxGainPct < 40) {
    // No trailing stop below +40% max gain — only hard exits apply
    return {
      stopPrice: null,
      stopPct: null,
      tier: 'COMPOUNDER <40%',
      description: 'No trailing stop (only hard exits apply)'
    };
  }

  let stopPct;
  let tier;

  if (maxGainPct >= 200) {
    stopPct = config.COMPOUNDER_STOP_200_PLUS || 15;
    tier = 'COMPOUNDER 200%+';
  } else if (maxGainPct >= 100) {
    stopPct = config.COMPOUNDER_STOP_100_200 || 20;
    tier = 'COMPOUNDER 100-200%';
  } else {
    stopPct = config.COMPOUNDER_STOP_40_100 || 25;
    tier = 'COMPOUNDER 40-100%';
  }

  const stopPrice = peakPrice * (1 - stopPct / 100);
  return {
    stopPrice: Math.round(stopPrice * 100) / 100,
    stopPct: stopPct,
    tier: tier,
    description: 'Compounder -' + stopPct + '% from peak ₹' + peakPrice
  };
}

/**
 * Check if trailing stop has been hit
 * Returns true if current price <= stop price
 */
function isTrailingStopHit(holding, config) {
  const stop = calculateTrailingStopForHolding(holding, config);
  if (!stop.stopPrice) return false; // no stop set (compounder below +40%)
  return holding.currentPrice <= stop.stopPrice;
}

/**
 * Update peak price for a holding — peak NEVER goes down
 * Returns the new peak price
 */
function updatePeakPrice(currentPeak, currentPrice) {
  if (!currentPeak || currentPrice > currentPeak) {
    return currentPrice;
  }
  return currentPeak;
}
