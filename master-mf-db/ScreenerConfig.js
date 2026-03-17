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
    HIGH_CONVICTION_PCT: 15,
    MEDIUM_CONVICTION_PCT: 10,
    COMPOUNDER_PCT: 12,
    TRAILING_STOP_0_20: 25,
    TRAILING_STOP_20_50: 20,
    TRAILING_STOP_50_100: 15,
    TRAILING_STOP_100_PLUS: 12,
    HARD_STOP_LOSS: 30,
    PAPER_TRADING: true,
    COMPOUNDER_STOP_40_100: 25,
    COMPOUNDER_STOP_100_200: 20,
    COMPOUNDER_STOP_200_PLUS: 15,
    NIFTY_BELOW_200DMA_ALLOCATION: 50,  // % of normal allocation when Nifty below 200DMA
    ADD1_GAIN_PCT: 12,
    ADD1_MAX_GAIN_PCT: 25,
    ADD2_GAIN_PCT: 30,
    ADD_MIN_WEEKS: 2,
    DIP_BUY_MIN_DROP: 10,
    DIP_BUY_MAX_DROP: 20,
    DIP_BUY_RSI_MAX: 30,
    PRICE_RUNUP_EXPIRE_PCT: 20,
    RSI_BUY_MAX: 45,
    PORTFOLIO_FREEZE_PCT: 25,
    NIFTY_CRASH_PCT: 20,
    SYSTEMIC_EXIT_COUNT: 3,
    MIN_MARKET_CAP_CR: 500          // Minimum market cap in Cr — skip micro caps
  },

  // --- Screener definitions ---
  screeners: {
    1: {
      name: 'CF-Multibagger-DNA',
      coolingDays: 30,
      alertFrequency: 'weekly',
      filters: {
        salesGrowth3Y: { min: 20 },
        profitGrowth3Y: { min: 20 },
        roe: { min: 18 },
        debtToEquity: { max: 0.5 },
        promoterHolding: { min: 50 },
        marketCap: { max: 15000 },
        opm: { min: 12 },
        pe: { max: 35 },
        pegTTM: { max: 1.5 },
        piotroski: { min: 6 },
        promoterPledge: { max: 10 },
        ocfGrowth3Y: { min: 10 },
        cfoGtProfit: true
      }
    },
    2: {
      name: 'CF-SmartMoney-Flow',
      coolingDays: 20,
      alertFrequency: 'weekly',
      filters: {
        instHolding: { min: 10 },
        mfHoldingChangeQoQ: { min: 0.5 },
        promoterHolding: { min: 45 },
        roe: { min: 15 },
        debtToEquity: { max: 0.5 },
        salesGrowth3Y: { min: 15 },
        profitGrowth3Y: { min: 15 },
        instHoldingChange4Q: { min: 1 },
        promoterPledge: { max: 15 },
        piotroski: { min: 5 },
        cfoGtProfit: true
      }
    },
    3: {
      name: 'CF-Insider-Buying',
      coolingDays: 14,
      alertFrequency: 'daily',
      filters: {
        promoterChangeQoQ: { min: 0.25 },
        salesGrowth: { min: 15 },
        roe: { min: 12 },
        debtToEquity: { max: 0.7 },
        marketCap: { max: 20000 },
        promoterPledge: { max: 5 },
        interestCoverage: { min: 3 },
        sastBuys: { min: 1 }
      }
    },
    4: {
      name: 'CF-Compounder',
      coolingDays: 30,
      alertFrequency: 'weekly',
      filters: {
        salesGrowth5Y: { min: 12 },
        salesGrowth3Y: { min: 12 },
        salesGrowthTTM: { min: 10 },
        profitGrowth5Y: { min: 12 },
        roe5YAvg: { min: 18 },
        debtToEquity: { max: 0.3 },
        promoterHolding: { min: 55 },
        marketCap: { min: 5000 },
        piotroski: { min: 7 },
        roce5YAvg: { min: 18 },
        ocfGrowth5Y: { min: 10 },
        altmanZ: { min: 3 },
        promoterPledge: { max: 0 },
        interestCoverage: { min: 5 },
        cfoGtProfit: true
      }
    }
  },

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

  // --- Conviction mapping ---
  getConviction: function(screenersPassingArr) {
    if (!screenersPassingArr || screenersPassingArr.length === 0) return 'NONE';
    if (screenersPassingArr.includes(4)) return 'COMPOUNDER';
    if (screenersPassingArr.length >= 3) return 'HIGH';
    if (screenersPassingArr.length >= 2) return 'MEDIUM';
    return 'LOW';
  },

  // --- Max allocation by conviction ---
  getMaxAllocationPct: function(conviction) {
    switch (conviction) {
      case 'HIGH': return 15;
      case 'MEDIUM': return 10;
      case 'COMPOUNDER': return 12;
      default: return 10;
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
