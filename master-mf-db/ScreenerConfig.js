/**
 * ============================================================================
 * SCREENER CONFIG — Constants, thresholds, screener definitions
 * ============================================================================
 */

const SCREENER_CONFIG = {
  // --- Sheet names ---
  sheets: {
    watchlist: 'Screener_Watchlist',
    holdings: 'Screener_Holdings',
    signals: 'Screener_Signals',
    history: 'Screener_History',
    nearMiss: 'Screener_NearMiss',
    config: 'Screener_Config',
    stockData: 'Stock_Data'
  },

  // --- Default config values (written to Screener_Config sheet) ---
  defaults: {
    STOCK_BUDGET: 300000,
    CASH_RESERVE_PCT: 15,
    MAX_STOCKS: 8,
    MAX_PER_SECTOR: 2,
    SECTOR_PCT_CAP: 30,
    SECTOR_ALERT_PCT: 35,
    ALLOC_HIGH: 15,           // MF QoQ > 1%
    ALLOC_MODERATE: 12,       // MF QoQ 0.5-1%
    ALLOC_BASE: 10,           // No MF signal
    MF_HIGH_THRESHOLD: 1,     // MF QoQ % for HIGH conviction
    MF_MODERATE_THRESHOLD: 0.5, // MF QoQ % for MODERATE conviction
    TRAILING_STOP_0_20: 25,
    TRAILING_STOP_20_50: 20,
    TRAILING_STOP_50_100: 15,
    TRAILING_STOP_100_PLUS: 12,
    HARD_STOP_LOSS: 30,
    PAPER_TRADING: true,
    NIFTY_BELOW_200DMA_ALLOCATION: 50,  // % of normal allocation when Nifty below 200DMA
    ADD1_GAIN_PCT: 12,
    ADD1_MAX_GAIN_PCT: 25,
    ADD2_GAIN_PCT: 30,
    ADD_MIN_WEEKS: 2,
    DIP_BUY_MIN_DROP: 10,
    DIP_BUY_MAX_DROP: 20,
    DIP_BUY_RSI_MAX: 30,
    PRICE_RUNUP_EXPIRE_PCT: 20,
    RSI_BUY_MAX: 65,
    RSI_OVERBOUGHT: 70,              // Block entry if RSI > 70 (overbought)
    PORTFOLIO_FREEZE_PCT: 25,
    NIFTY_CRASH_PCT: 20,
    SYSTEMIC_EXIT_COUNT: 3,
    MIN_MARKET_CAP_CR: 500,         // Minimum market cap in Cr — skip micro caps
    MIN_AVG_TRADED_VALUE_CR: 3,     // Safety net — primary liquidity filter is on Trendlyne screener side
    // Factor-based allocation (replaces conviction-based)
    ALLOC_TOP5: 8,                   // Top 5 by factor rank → 8% of budget each
    ALLOC_NEXT5: 5,                  // Rank 6-10 → 5% each
    ALLOC_REST: 3,                   // Rank 11+ → 3% each
    FACTOR_BUY_MIN: 50              // Minimum factor score to generate BUY signal
  },

  // --- 3-screener architecture for multibagger discovery ---
  // Universe: Nifty Total Market (750 stocks). Each screener is a different lens.
  // Overlap = higher conviction. Screener names must match Trendlyne alert subjects.
  // Filters are intentionally relaxed — factor scoring does the real ranking.
  screeners: [
    {
      num: 1,
      name: 'CF-Compounder',
      coolingDays: 30,
      alertFrequency: 'weekly',
      description: 'Quality compounders — steady growers at ₹500-20000 Cr stage',
      filters: {
        marketCap: { min: 500, max: 20000 },
        salesGrowth3Y: { min: 15 },    // ~5% CAGR — wide net, scoring ranks the best
        profitGrowth3Y: { min: 15 },
        roe: { min: 15 },
        debtToEquity: { max: 0.5 },
        promoterHolding: { min: 40 },
        promoterPledge: { max: 15 },
        piotroski: { min: 5 }
      }
    },
    {
      num: 2,
      name: 'CF-Momentum',
      coolingDays: 14,                  // shorter cooling — momentum is time-sensitive
      alertFrequency: 'weekly',
      description: 'Breakouts & early institutional entry — timing confirmation',
      filters: {
        marketCap: { min: 500, max: 20000 },
        return6m: { min: 10 },          // HY Change % on Trendlyne
        return1m: { max: 20 },          // prevents buying blow-off tops
        discountTo52wHigh: { max: 25 }, // within 25% of 52W high
        roe: { min: 10 },
        profitGrowth3Y: { min: 10 },
        piotroski: { min: 4 },
        promoterHolding: { min: 30 }
      }
    },
    {
      num: 3,
      name: 'CF-Growth',
      coolingDays: 21,
      alertFrequency: 'weekly',
      description: 'Emerging leaders — aggressive growth hunting up to ₹10000 Cr',
      filters: {
        marketCap: { min: 500, max: 10000 },
        salesGrowth3Y: { min: 20 },
        profitGrowth3Y: { min: 15 },
        roe: { min: 12 },
        debtToEquity: { max: 0.7 },
        piotroski: { min: 4 },
        promoterHolding: { min: 40 },
        promoterPledge: { max: 25 }
      }
    }
  ],

  // Legacy single screener reference (backward compat — points to first screener)
  get screener() {
    return this.screeners[0];
  },

  // --- Overlap boost: stocks appearing in multiple screeners ---
  // 2 screeners → score × 1.10, 3 screeners → score × 1.20
  getOverlapBoost: function(screenerCount) {
    if (screenerCount >= 3) return 1.20;
    if (screenerCount >= 2) return 1.10;
    return 1.0;
  },

  // --- Overlap-based position sizing ---
  // 1 screener → 0.8x, 2 screeners → 1.0x, 3 screeners → 1.2x
  getOverlapAllocationMultiplier: function(screenerCount) {
    if (screenerCount >= 3) return 1.2;
    if (screenerCount >= 2) return 1.0;
    return 0.8;
  },

  // Maximum momentum-only stocks in portfolio (prevents hype-driven portfolio)
  MAX_MOMENTUM_ONLY_STOCKS: 2,

  // --- Signal priorities ---
  signalPriority: {
    HARD_EXIT: 1,
    TRAILING_STOP: 2,
    SOFT_EXIT: 3,
    ADD1: 4,
    ADD2: 4,
    DIP_BUY: 4,
    BUY_STARTER: 5,
    REBALANCE: 6,
    LTCG_ALERT: 6,
    SECTOR_ALERT: 6,
    FREEZE: 1,
    CRASH_ALERT: 2,
    SYSTEMIC_EXIT: 1,
    MANUAL_REVIEW: 6
  },

  // --- Factor scoring weights by market regime (5-factor model, each sums to 100) ---
  // Regime determined by Nifty vs 200DMA + 6M return
  // 5 factors: momentum, quality, trend, value, lowVol
  // (relStr merged into momentum — was double-counting return-based signals)
  //
  // Bull:       Momentum dominant — ride winners, lowVol protects from blow-offs
  // Caution:    Balanced — momentum leads but quality gains importance
  // Correction: Quality + Trend dominant — find survivors, value opportunities emerge
  // Bear:       Quality + Value dominant — momentum crashes, protect capital
  factorWeightsByRegime: {
    bull:       { momentum: 40, quality: 15, trend: 20, value: 5,  lowVol: 20 },
    caution:    { momentum: 35, quality: 20, trend: 20, value: 10, lowVol: 15 },
    correction: { momentum: 25, quality: 25, trend: 25, value: 15, lowVol: 10 },
    bear:       { momentum: 15, quality: 30, trend: 15, value: 25, lowVol: 15 }
  },

  // Fallback (used if Nifty data unavailable)
  factorWeights: {
    momentum: 35, quality: 20, trend: 20, value: 10, lowVol: 15
  },

  // --- Factor score → allocation tier ---
  // Replaces old conviction-based sizing.
  // Signal engine uses factor rank for position sizing.
  getAllocationByRank: function(rank, config) {
    // Top 5 → 7-8%, Next 5 → 5-6%, Rest → 3-4%
    if (rank <= 5) return (config && config.ALLOC_TOP5) || 8;
    if (rank <= 10) return (config && config.ALLOC_NEXT5) || 5;
    return (config && config.ALLOC_REST) || 3;
  },

  // --- Factor score → signal action ---
  getSignalAction: function(factorScore) {
    if (factorScore >= 70) return 'STRONG_BUY';
    if (factorScore >= 50) return 'BUY';
    if (factorScore >= 35) return 'WATCH';
    return 'AVOID';
  },

  // --- Market regime modifier ---
  // Adjusts allocation based on Nifty position relative to 200DMA
  getMarketRegimeMultiplier: function(niftyData) {
    if (!niftyData) return 1.0;
    if (niftyData.aboveDMA200 === true) {
      // Bull: above 200DMA
      return (niftyData.return6m || 0) >= 0 ? 1.0 : 0.75;
    }
    // Below 200DMA: how far below?
    var niftyPrice = niftyData.price || 0;
    var niftyDMA = niftyData.dma200 || 0;
    if (niftyDMA > 0) {
      var pctBelow = ((niftyPrice - niftyDMA) / niftyDMA) * 100;
      if (pctBelow > -5) return 0.50;   // Correction: < 5% below
      return 0.25;                       // Bear: > 5% below
    }
    return 0.50;
  },

  // --- MF overlay conviction (kept for backward compat + DII boost) ---
  getConviction: function(mfHoldingChangeQoQ, config) {
    var highThreshold = (config && config.MF_HIGH_THRESHOLD) || 1;
    var modThreshold = (config && config.MF_MODERATE_THRESHOLD) || 0.5;
    if (mfHoldingChangeQoQ >= highThreshold) return 'HIGH';
    if (mfHoldingChangeQoQ >= modThreshold) return 'MODERATE';
    return 'BASE';
  },

  // --- Legacy: max allocation by conviction (used by gas-webapp until migrated) ---
  getMaxAllocationPct: function(conviction, config) {
    switch (conviction) {
      case 'HIGH': return (config && config.ALLOC_HIGH) || 15;
      case 'MODERATE': return (config && config.ALLOC_MODERATE) || 12;
      case 'BASE': return (config && config.ALLOC_BASE) || 10;
      default: return (config && config.ALLOC_BASE) || 10;
    }
  }
};

/**
 * Read config from Screener_Config sheet (key-value pairs)
 * Falls back to SCREENER_CONFIG.defaults if sheet/key missing
 */
function getScreenerConfigValue(key) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SCREENER_CONFIG.sheets.config);
    if (!sheet) return SCREENER_CONFIG.defaults[key];

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return SCREENER_CONFIG.defaults[key];

    const data = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
    for (let i = 0; i < data.length; i++) {
      if (data[i][0] === key) {
        const val = data[i][1];
        if (val === 'TRUE' || val === true) return true;
        if (val === 'FALSE' || val === false) return false;
        return val;
      }
    }
    return SCREENER_CONFIG.defaults[key];
  } catch (e) {
    Logger.log('Error reading config key ' + key + ': ' + e.message);
    return SCREENER_CONFIG.defaults[key];
  }
}

/**
 * Read all config values into an object
 */
function getAllScreenerConfig() {
  const config = {};
  const keys = Object.keys(SCREENER_CONFIG.defaults);
  for (let i = 0; i < keys.length; i++) {
    config[keys[i]] = getScreenerConfigValue(keys[i]);
  }
  return config;
}

/**
 * Update a config value in the Screener_Config sheet
 */
function setScreenerConfigValue(key, value) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SCREENER_CONFIG.sheets.config);
  if (!sheet) return false;

  const lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    const data = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
    for (let i = 0; i < data.length; i++) {
      if (data[i][0] === key) {
        sheet.getRange(i + 2, 2).setValue(value);
        return true;
      }
    }
  }
  // Key not found — append
  sheet.appendRow([key, value]);
  return true;
}
