/**
 * ============================================================================
 * MARKET DATA — Price, RSI, DMA, returns via GOOGLEFINANCE formulas + API
 * ============================================================================
 *
 * GOOGLEFINANCE works in spreadsheet formulas but NOT in Apps Script directly.
 * Strategy:
 *   - Use a hidden helper sheet "_MarketCalc" with GOOGLEFINANCE formulas
 *   - Write stock symbols → formulas auto-calculate → read results
 *   - Fallback: UrlFetchApp to Google Finance / Yahoo Finance for bulk data
 *
 * For RSI: Fetch 30 days of closing prices, calculate manually.
 * For DMA: Fetch 200 days of closing prices, calculate 50DMA and 200DMA.
 */

const MARKET_CALC_SHEET = '_MarketCalc';

/**
 * Ensure the hidden helper sheet exists for GOOGLEFINANCE calculations
 */
function _ensureMarketCalcSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(MARKET_CALC_SHEET);
  if (sheet) return sheet;

  sheet = ss.insertSheet(MARKET_CALC_SHEET);
  sheet.hideSheet();

  // Layout: A=Symbol, B=Current Price, C=50DMA, D=200DMA, E=6M Return %, F=Volume
  sheet.getRange('A1:F1').setValues([['Symbol', 'Price', '50DMA', '200DMA', '6M Return %', 'Avg Volume']]);
  sheet.setFrozenRows(1);
  Logger.log('Created hidden ' + MARKET_CALC_SHEET + ' sheet');
  return sheet;
}

/**
 * Fetch current price for a single NSE stock using GOOGLEFINANCE via helper sheet
 * Returns number or null
 */
function getStockPrice(symbol) {
  const data = getMarketDataBatch([symbol]);
  return data[symbol] ? data[symbol].price : null;
}

/**
 * Fetch market data for multiple stocks in one batch
 * Uses the _MarketCalc helper sheet with GOOGLEFINANCE formulas
 *
 * Returns: { symbol: { price, dma50, dma200, return6m, avgVolume } }
 */
function getMarketDataBatch(symbols) {
  if (!symbols || symbols.length === 0) return {};

  const sheet = _ensureMarketCalcSheet();

  // Clear old data
  const maxRows = Math.max(sheet.getLastRow(), 2);
  if (maxRows > 1) {
    sheet.getRange(2, 1, maxRows - 1, 6).clearContent();
  }

  // Write symbols and GOOGLEFINANCE formulas
  const rows = [];
  for (let i = 0; i < symbols.length; i++) {
    const sym = symbols[i];
    const gfSym = 'NSE:' + sym;
    rows.push([
      sym,
      '=IFERROR(GOOGLEFINANCE("' + gfSym + '","price"),"")',
      '', // 50DMA — calculated separately from historical data
      '', // 200DMA — calculated separately from historical data
      '', // 6M return — calculated separately
      '=IFERROR(GOOGLEFINANCE("' + gfSym + '","volumeavg"),"")'
    ]);
  }

  sheet.getRange(2, 1, rows.length, 6).setValues(rows);
  SpreadsheetApp.flush();

  // Wait for GOOGLEFINANCE to resolve (they're async)
  Utilities.sleep(3000);

  // Read results
  const results = sheet.getRange(2, 1, rows.length, 6).getValues();
  const data = {};

  for (let i = 0; i < results.length; i++) {
    const sym = String(results[i][0]);
    const price = parseFloat(results[i][1]) || null;
    const avgVolume = parseFloat(results[i][5]) || 0;

    data[sym] = {
      price: price,
      dma50: null,   // calculated below
      dma200: null,  // calculated below
      return6m: null, // calculated below
      avgVolume: avgVolume,
      avgDailyTradedValueCr: price && avgVolume ? (price * avgVolume) / 10000000 : 0
    };
  }

  return data;
}

/**
 * Calculate RSI(14) for a stock using historical closing prices
 * Fetches 30 trading days of data from GOOGLEFINANCE
 *
 * Returns: RSI value (0-100) or null on failure
 */
function calculateRSI(symbol, days) {
  days = days || 14;
  const closePrices = _fetchHistoricalPrices(symbol, days + 16); // need extra days for calculation

  if (!closePrices || closePrices.length < days + 1) return null;

  // Calculate RSI
  let gains = 0;
  let losses = 0;

  // First average: use first `days` periods
  for (let i = 1; i <= days; i++) {
    const change = closePrices[i] - closePrices[i - 1];
    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }

  let avgGain = gains / days;
  let avgLoss = losses / days;

  // Smooth for remaining periods
  for (let i = days + 1; i < closePrices.length; i++) {
    const change = closePrices[i] - closePrices[i - 1];
    if (change > 0) {
      avgGain = (avgGain * (days - 1) + change) / days;
      avgLoss = (avgLoss * (days - 1)) / days;
    } else {
      avgGain = (avgGain * (days - 1)) / days;
      avgLoss = (avgLoss * (days - 1) + Math.abs(change)) / days;
    }
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return Math.round((100 - (100 / (1 + rs))) * 100) / 100;
}

/**
 * Calculate 50DMA and 200DMA for a stock
 * Returns: { dma50: number, dma200: number } or null
 */
function calculateDMA(symbol) {
  const prices = _fetchHistoricalPrices(symbol, 210); // 200 + buffer

  if (!prices || prices.length < 50) return null;

  const dma50 = prices.length >= 50
    ? prices.slice(prices.length - 50).reduce(function(a, b) { return a + b; }, 0) / 50
    : null;

  const dma200 = prices.length >= 200
    ? prices.slice(prices.length - 200).reduce(function(a, b) { return a + b; }, 0) / 200
    : null;

  return {
    dma50: dma50 ? Math.round(dma50 * 100) / 100 : null,
    dma200: dma200 ? Math.round(dma200 * 100) / 100 : null
  };
}

/**
 * Calculate 6-month return for a stock
 * Returns: percentage or null
 */
function calculate6MReturn(symbol) {
  const prices = _fetchHistoricalPrices(symbol, 130); // ~6 months of trading days
  if (!prices || prices.length < 100) return null;

  const currentPrice = prices[prices.length - 1];
  const oldPrice = prices[0];

  if (!oldPrice || oldPrice === 0) return null;
  return Math.round(((currentPrice - oldPrice) / oldPrice) * 10000) / 100;
}

/**
 * Get Nifty 50 market data
 * Returns: { price, dma200, return1m, return6m }
 */
function getNiftyData() {
  try {
    const sheet = _ensureMarketCalcSheet();

    // Use a dedicated row for Nifty (row after stock data, let's use last 3 rows area)
    const niftyRow = 500; // safe row far from stock data
    sheet.getRange(niftyRow, 1, 1, 4).setValues([
      [
        'NIFTY50',
        '=IFERROR(GOOGLEFINANCE("INDEXNSE:NIFTY_50","price"),"")',
        '=IFERROR(GOOGLEFINANCE("INDEXNSE:NIFTY_50","low52"),"")',  // placeholder
        '=IFERROR(GOOGLEFINANCE("INDEXNSE:NIFTY_50","high52"),"")'  // placeholder
      ]
    ]);
    SpreadsheetApp.flush();
    Utilities.sleep(2000);

    const result = sheet.getRange(niftyRow, 1, 1, 4).getValues()[0];
    const price = parseFloat(result[1]) || null;

    // Calculate Nifty 200DMA and 6M return from historical data
    const niftyPrices = _fetchHistoricalPricesForIndex('INDEXNSE:NIFTY_50', 210);
    let dma200 = null;
    let return6m = null;
    let return1m = null;

    if (niftyPrices && niftyPrices.length >= 200) {
      dma200 = niftyPrices.slice(niftyPrices.length - 200).reduce(function(a, b) { return a + b; }, 0) / 200;
      dma200 = Math.round(dma200 * 100) / 100;
    }

    if (niftyPrices && niftyPrices.length >= 22) {
      const price1mAgo = niftyPrices[niftyPrices.length - 22];
      if (price1mAgo > 0) {
        return1m = Math.round(((price - price1mAgo) / price1mAgo) * 10000) / 100;
      }
    }

    if (niftyPrices && niftyPrices.length >= 130) {
      const price6mAgo = niftyPrices[0];
      if (price6mAgo > 0) {
        return6m = Math.round(((price - price6mAgo) / price6mAgo) * 10000) / 100;
      }
    }

    // Clean up
    sheet.getRange(niftyRow, 1, 1, 4).clearContent();

    return {
      price: price,
      dma200: dma200,
      aboveDMA200: price && dma200 ? price > dma200 : null,
      return1m: return1m,
      return6m: return6m
    };
  } catch (e) {
    Logger.log('Error fetching Nifty data: ' + e.message);
    return { price: null, dma200: null, aboveDMA200: null, return1m: null, return6m: null };
  }
}

/**
 * Fetch historical closing prices using GOOGLEFINANCE via helper sheet
 * Returns array of prices sorted oldest → newest, or null on failure
 */
function _fetchHistoricalPrices(symbol, tradingDays) {
  return _fetchHistoricalPricesForIndex('NSE:' + symbol, tradingDays);
}

/**
 * Fetch historical prices for any GOOGLEFINANCE-compatible symbol
 */
function _fetchHistoricalPricesForIndex(gfSymbol, tradingDays) {
  try {
    const sheet = _ensureMarketCalcSheet();
    const calendarDays = Math.ceil(tradingDays * 1.5); // rough conversion

    // Use a temporary area in the sheet for GOOGLEFINANCE historical data
    const tempRow = 502;
    const tempCol = 1;

    // GOOGLEFINANCE returns a 2D array: header row + data rows with [date, close]
    const formula = '=IFERROR(GOOGLEFINANCE("' + gfSymbol + '","close",TODAY()-' + calendarDays + ',TODAY()),"")';
    sheet.getRange(tempRow, tempCol).setFormula(formula);
    SpreadsheetApp.flush();
    Utilities.sleep(3000); // wait for GOOGLEFINANCE to resolve

    // Read the output — GOOGLEFINANCE can expand to many rows
    const maxRows = tradingDays + 10;
    const output = sheet.getRange(tempRow, tempCol, maxRows, 2).getValues();

    // Clean up
    sheet.getRange(tempRow, tempCol, maxRows, 2).clearContent();

    // Parse: skip header row, extract close prices
    const prices = [];
    for (let i = 1; i < output.length; i++) {
      const price = parseFloat(output[i][1]);
      if (price > 0) prices.push(price);
    }

    return prices.length > 0 ? prices : null;
  } catch (e) {
    Logger.log('Error fetching historical prices for ' + gfSymbol + ': ' + e.message);
    return null;
  }
}

/**
 * Update market data for all stocks in a given sheet (watchlist or holdings)
 * Writes: Current Price, RSI, 50DMA, 200DMA to appropriate columns
 *
 * @param {string} sheetName - Sheet to update
 * @param {Object} colMap - { symbolCol, priceCol, rsiCol, dma50Col, dma200Col, return6mCol }
 */
function updateMarketDataForSheet(sheetName, colMap) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return;

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  // Read all symbols
  const symbols = [];
  const symbolData = sheet.getRange(2, colMap.symbolCol, lastRow - 1, 1).getValues();
  for (let i = 0; i < symbolData.length; i++) {
    const sym = String(symbolData[i][0]).trim();
    if (sym) symbols.push(sym);
  }

  if (symbols.length === 0) return;

  // Batch fetch current prices
  const marketData = getMarketDataBatch(symbols);

  // For each stock, calculate RSI, DMA, 6M return
  for (let i = 0; i < symbols.length; i++) {
    const sym = symbols[i];
    const row = i + 2;

    const md = marketData[sym] || {};

    // Current price
    if (colMap.priceCol && md.price) {
      sheet.getRange(row, colMap.priceCol).setValue(md.price);
    }

    // RSI(14)
    if (colMap.rsiCol) {
      const rsi = calculateRSI(sym);
      if (rsi !== null) {
        sheet.getRange(row, colMap.rsiCol).setValue(rsi);
      }
    }

    // 50DMA and 200DMA
    if (colMap.dma50Col || colMap.dma200Col) {
      const dma = calculateDMA(sym);
      if (dma) {
        if (colMap.dma50Col && dma.dma50) sheet.getRange(row, colMap.dma50Col).setValue(dma.dma50);
        if (colMap.dma200Col && dma.dma200) sheet.getRange(row, colMap.dma200Col).setValue(dma.dma200);
      }
    }

    // 6M Return
    if (colMap.return6mCol) {
      const ret = calculate6MReturn(sym);
      if (ret !== null) {
        sheet.getRange(row, colMap.return6mCol).setValue(ret);
      }
    }

    // Small delay between stocks to avoid GOOGLEFINANCE rate limiting
    if (i < symbols.length - 1) Utilities.sleep(500);
  }

  Logger.log('Updated market data for ' + symbols.length + ' stocks in ' + sheetName);
}
