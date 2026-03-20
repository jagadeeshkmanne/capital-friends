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
    const gfSym = _toGoogleFinanceSymbol(sym);
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

    // --- Fetch benchmark returns for Midcap 150 and Smallcap 250 via Yahoo Finance ---
    // GOOGLEFINANCE doesn't support Indian midcap/smallcap index symbols.
    // Yahoo Finance chart API reliably returns historical data for these.
    var midcapReturn6m = _fetchIndexReturn6mViaYahoo('NIFTYMIDCAP150.NS', 'Midcap150');
    var smallcapReturn6m = _fetchIndexReturn6mViaYahoo('HDFCSML250.NS', 'Smallcap250');

    if (midcapReturn6m === null) Logger.log('Midcap benchmark unavailable — will use Nifty 50');
    if (smallcapReturn6m === null) Logger.log('Smallcap benchmark unavailable — will use Nifty 50');

    return {
      price: price,
      dma200: dma200,
      aboveDMA200: price && dma200 ? price > dma200 : null,
      return1m: return1m,
      return6m: return6m,
      midcapReturn6m: midcapReturn6m,
      smallcapReturn6m: smallcapReturn6m
    };
  } catch (e) {
    Logger.log('Error fetching Nifty data: ' + e.message);
    return { price: null, dma200: null, aboveDMA200: null, return1m: null, return6m: null, midcapReturn6m: null, smallcapReturn6m: null };
  }
}

/**
 * Fetch historical closing prices using GOOGLEFINANCE via helper sheet
 * Returns array of prices sorted oldest → newest, or null on failure
 */
function _fetchHistoricalPrices(symbol, tradingDays) {
  return _fetchHistoricalPricesForIndex(_toGoogleFinanceSymbol(symbol), tradingDays);
}

/**
 * Convert a stock symbol to GOOGLEFINANCE format.
 * NSE symbols (alphabetic) → "NSE:SYMBOL"
 * BSE codes (numeric) → "BOM:CODE"
 */
function _toGoogleFinanceSymbol(symbol) {
  if (/^\d+$/.test(symbol)) return 'BOM:' + symbol;
  return 'NSE:' + symbol;
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
    const maxRows = tradingDays + 10;

    // Clear stale data FIRST and flush to ensure clean slate
    sheet.getRange(tempRow, tempCol, maxRows, 2).clearContent();
    SpreadsheetApp.flush();
    Utilities.sleep(1000);

    const formula = '=IFERROR(GOOGLEFINANCE("' + gfSymbol + '","close",TODAY()-' + calendarDays + ',TODAY()),"")';
    sheet.getRange(tempRow, tempCol).setFormula(formula);
    SpreadsheetApp.flush();
    Utilities.sleep(5000); // wait for GOOGLEFINANCE to resolve (was 3s, too fast)

    // Read the output — GOOGLEFINANCE can expand to many rows
    const output = sheet.getRange(tempRow, tempCol, maxRows, 2).getValues();

    // Clean up
    sheet.getRange(tempRow, tempCol, maxRows, 2).clearContent();
    SpreadsheetApp.flush();

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
 * Fetch 6M return for an index via Yahoo Finance chart API.
 * Works for Indian indices that GOOGLEFINANCE doesn't support.
 * @param {string} yahooSymbol - Yahoo Finance symbol (e.g., 'NIFTY_MIDCAP_150.NS')
 * @param {string} label - Display label for logging
 * @returns {number|null} - 6M return percentage or null
 */
function _fetchIndexReturn6mViaYahoo(yahooSymbol, label) {
  try {
    var url = 'https://query1.finance.yahoo.com/v8/finance/chart/' +
      encodeURIComponent(yahooSymbol) + '?range=6mo&interval=1d';
    var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });

    if (response.getResponseCode() !== 200) {
      Logger.log(label + ' Yahoo fetch failed: HTTP ' + response.getResponseCode());
      return null;
    }

    var json = JSON.parse(response.getContentText());
    var result = json.chart && json.chart.result && json.chart.result[0];
    if (!result) return null;

    var closes = result.indicators &&
      result.indicators.adjclose &&
      result.indicators.adjclose[0] &&
      result.indicators.adjclose[0].adjclose;

    if (!closes || closes.length < 10) {
      // Try regular close if adjclose not available
      closes = result.indicators &&
        result.indicators.quote &&
        result.indicators.quote[0] &&
        result.indicators.quote[0].close;
    }

    if (!closes || closes.length < 10) return null;

    // Find first and last valid prices
    var firstPrice = null, lastPrice = null;
    for (var i = 0; i < closes.length; i++) {
      if (closes[i] != null && closes[i] > 0) { firstPrice = closes[i]; break; }
    }
    for (var j = closes.length - 1; j >= 0; j--) {
      if (closes[j] != null && closes[j] > 0) { lastPrice = closes[j]; break; }
    }

    if (!firstPrice || !lastPrice) return null;

    var ret = Math.round(((lastPrice - firstPrice) / firstPrice) * 10000) / 100;
    Logger.log(label + ' 6M return: ' + ret + '% (via Yahoo Finance, ' + closes.length + ' data points)');
    return ret;
  } catch (e) {
    Logger.log(label + ' Yahoo Finance error: ' + e.message);
    return null;
  }
}

/**
 * Calculate RSI, DMA, and 6M return from a single historical price array.
 * Avoids 3 separate GOOGLEFINANCE calls per stock.
 *
 * @param {Array<number>} prices - closing prices oldest→newest (210+ days)
 * @returns {{rsi: number|null, dma50: number|null, dma200: number|null, return6m: number|null}}
 */
function _calculateAllFromPrices(prices) {
  const result = { rsi: null, dma50: null, dma200: null, return6m: null, return1w: null, return1m: null, return1y: null, high52w: null };
  if (!prices || prices.length < 30) return result;

  // 52-week high (~250 trading days, or all available)
  var lookback = Math.min(prices.length, 250);
  result.high52w = Math.round(Math.max.apply(null, prices.slice(prices.length - lookback)) * 100) / 100;

  // RSI(14) — needs 14+16 = 30 prices minimum
  const days = 14;
  if (prices.length >= days + 1) {
    let gains = 0, losses = 0;
    for (let i = 1; i <= days; i++) {
      const change = prices[prices.length - (days + 16) + i] - prices[prices.length - (days + 16) + i - 1];
      if (isNaN(change)) continue;
      if (change > 0) gains += change;
      else losses += Math.abs(change);
    }
    let avgGain = gains / days;
    let avgLoss = losses / days;
    const startIdx = prices.length - (days + 16) + days + 1;
    for (let i = startIdx; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      if (isNaN(change)) continue;
      if (change > 0) {
        avgGain = (avgGain * (days - 1) + change) / days;
        avgLoss = (avgLoss * (days - 1)) / days;
      } else {
        avgGain = (avgGain * (days - 1)) / days;
        avgLoss = (avgLoss * (days - 1) + Math.abs(change)) / days;
      }
    }
    if (avgLoss === 0) result.rsi = 100;
    else {
      const rs = avgGain / avgLoss;
      result.rsi = Math.round((100 - (100 / (1 + rs))) * 100) / 100;
    }
  }

  // 50DMA
  if (prices.length >= 50) {
    result.dma50 = Math.round(prices.slice(prices.length - 50).reduce(function(a, b) { return a + b; }, 0) / 50 * 100) / 100;
  }

  // 200DMA
  if (prices.length >= 200) {
    result.dma200 = Math.round(prices.slice(prices.length - 200).reduce(function(a, b) { return a + b; }, 0) / 200 * 100) / 100;
  }

  // Returns — all use currentPrice vs price N trading days ago
  const currentPrice = prices[prices.length - 1];

  // 1W return (~5 trading days)
  if (prices.length >= 5) {
    const oldPrice = prices[prices.length - 5];
    if (oldPrice > 0) {
      result.return1w = Math.round(((currentPrice - oldPrice) / oldPrice) * 10000) / 100;
    }
  }

  // 1M return (~22 trading days)
  if (prices.length >= 22) {
    const oldPrice = prices[prices.length - 22];
    if (oldPrice > 0) {
      result.return1m = Math.round(((currentPrice - oldPrice) / oldPrice) * 10000) / 100;
    }
  }

  // 6M return (~130 trading days)
  if (prices.length >= 130) {
    const oldPrice = prices[prices.length - 130];
    if (oldPrice > 0) {
      result.return6m = Math.round(((currentPrice - oldPrice) / oldPrice) * 10000) / 100;
    }
  }

  // 1Y return (~250 trading days)
  if (prices.length >= 250) {
    const oldPrice = prices[prices.length - 250];
    if (oldPrice > 0) {
      result.return1y = Math.round(((currentPrice - oldPrice) / oldPrice) * 10000) / 100;
    }
  }

  return result;
}

/**
 * Update market data for all stocks in a given sheet (watchlist or holdings)
 * Writes: Current Price, RSI, 50DMA, 200DMA to appropriate columns
 *
 * OPTIMIZED: Fetches 210 days of historical data ONCE per stock,
 * then calculates RSI, DMA, 6M return from the same array.
 * Before: 3 GOOGLEFINANCE calls × 3s each = 9s/stock
 * After:  1 GOOGLEFINANCE call × 3s = 3s/stock
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

  // Batch fetch current prices + volume
  const marketData = getMarketDataBatch(symbols);

  // For each stock: ONE historical fetch → calculate RSI + DMA + 6M return
  for (let i = 0; i < symbols.length; i++) {
    const sym = symbols[i];
    const row = i + 2;

    const md = marketData[sym] || {};

    // Current price
    if (colMap.priceCol && md.price) {
      sheet.getRange(row, colMap.priceCol).setValue(md.price);
    }

    // Fetch history ONCE — calculate everything from it
    // Use 260 days if 1Y return needed, else 210
    var needsHistory = colMap.rsiCol || colMap.dma50Col || colMap.dma200Col || colMap.return6mCol || colMap.return1wCol || colMap.return1mCol || colMap.return1yCol;
    if (needsHistory) {
      var histDays = colMap.return1yCol ? 260 : 210;
      var prices = _fetchHistoricalPrices(sym, histDays);
      if (prices && prices.length > 0) {
        var calc = _calculateAllFromPrices(prices);

        if (colMap.rsiCol && calc.rsi !== null) {
          sheet.getRange(row, colMap.rsiCol).setValue(calc.rsi);
        }
        if (colMap.dma50Col && calc.dma50 !== null) {
          sheet.getRange(row, colMap.dma50Col).setValue(calc.dma50);
        }
        if (colMap.dma200Col && calc.dma200 !== null) {
          sheet.getRange(row, colMap.dma200Col).setValue(calc.dma200);
        }
        if (colMap.return6mCol && calc.return6m !== null) {
          sheet.getRange(row, colMap.return6mCol).setValue(calc.return6m);
        }
        if (colMap.return1wCol && calc.return1w !== null) {
          sheet.getRange(row, colMap.return1wCol).setValue(calc.return1w);
        }
        if (colMap.return1mCol && calc.return1m !== null) {
          sheet.getRange(row, colMap.return1mCol).setValue(calc.return1m);
        }
        if (colMap.return1yCol && calc.return1y !== null) {
          sheet.getRange(row, colMap.return1yCol).setValue(calc.return1y);
        }
      }
    }

    // Small delay between stocks to avoid GOOGLEFINANCE rate limiting
    if (i < symbols.length - 1) Utilities.sleep(500);
  }

  Logger.log('Updated market data for ' + symbols.length + ' stocks in ' + sheetName);
}

/**
 * CHUNKED market data update — processes stocks from startIdx until time runs out.
 * Used by screenerUpdateMarketData() to stay within 6-minute GAS limit.
 *
 * Phase 1 (startIdx === 0): Batch-fetches current prices for ALL symbols (fast, ~3s).
 * Phase 2: Fetches historical data ONE stock at a time (~6.5s each), resumable.
 *
 * @param {string} sheetName - Sheet to update
 * @param {Object} colMap - Column mapping (same as updateMarketDataForSheet)
 * @param {number} startIdx - Index of first stock to process historical data for
 * @param {number} timeBudgetMs - Max milliseconds to spend (e.g. 280000 for ~4.5 min)
 * @param {string[]} [skipSymbols] - Optional list of symbols to skip (e.g. already enriched by Trendlyne)
 * @returns {{ processed: number, total: number, done: boolean }}
 */
function updateMarketDataChunked(sheetName, colMap, startIdx, timeBudgetMs, skipSymbols) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { processed: 0, total: 0, done: true };

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return { processed: 0, total: 0, done: true };

  // Build skip set for O(1) lookups
  var skipSet = {};
  if (skipSymbols && skipSymbols.length > 0) {
    for (var s = 0; s < skipSymbols.length; s++) {
      skipSet[skipSymbols[s].toUpperCase()] = true;
    }
  }
  var skipCount = Object.keys(skipSet).length;

  // Read all symbols
  var symbols = [];
  var symbolData = sheet.getRange(2, colMap.symbolCol, lastRow - 1, 1).getValues();
  for (var i = 0; i < symbolData.length; i++) {
    var sym = String(symbolData[i][0]).trim();
    if (sym) symbols.push(sym);
  }

  if (symbols.length === 0) return { processed: 0, total: 0, done: true };

  var chunkStart = new Date();

  // On first call (startIdx === 0): batch-fetch current prices (only non-skipped stocks)
  if (startIdx === 0) {
    // Filter out Trendlyne-enriched stocks — they already have price + volume
    var batchSymbols = skipCount > 0
      ? symbols.filter(function(sym) { return !skipSet[sym.toUpperCase()]; })
      : symbols;

    if (batchSymbols.length > 0) {
      var marketData = getMarketDataBatch(batchSymbols);
      for (var j = 0; j < symbols.length; j++) {
        if (skipSet[symbols[j].toUpperCase()]) continue;
        var md = marketData[symbols[j]] || {};
        if (colMap.priceCol && md.price) {
          sheet.getRange(j + 2, colMap.priceCol).setValue(md.price);
        }
        if (colMap.avgTradedValCol && md.avgDailyTradedValueCr) {
          sheet.getRange(j + 2, colMap.avgTradedValCol).setValue(
            Math.round(md.avgDailyTradedValueCr * 100) / 100
          );
        }
      }
      Logger.log('Batch prices written for ' + batchSymbols.length + '/' + symbols.length +
        ' stocks in ' + sheetName + (skipCount > 0 ? ' (' + skipCount + ' skipped — Trendlyne)' : ''));
    } else {
      Logger.log('All ' + symbols.length + ' stocks enriched by Trendlyne — skipping GOOGLEFINANCE batch');
    }
  }

  // Process historical data starting from startIdx
  var needsHistory = colMap.rsiCol || colMap.dma50Col || colMap.dma200Col ||
                     colMap.return6mCol || colMap.return1wCol || colMap.return1mCol || colMap.return1yCol;

  var processed = 0;
  var skipped = 0;

  if (needsHistory) {
    var histDays = colMap.return1yCol ? 260 : 210;

    for (var k = startIdx; k < symbols.length; k++) {
      // Skip Trendlyne-enriched stocks (already have RSI, DMA, returns)
      if (skipSet[symbols[k].toUpperCase()]) {
        processed++;
        skipped++;
        continue;
      }

      // Check time budget before starting next stock
      var elapsed = new Date() - chunkStart;
      if (elapsed > timeBudgetMs) {
        Logger.log('Time budget exhausted after ' + processed + ' stocks (' + Math.round(elapsed / 1000) + 's)');
        return { processed: processed, total: symbols.length, done: false };
      }

      var s = symbols[k];
      var row = k + 2;
      var prices = _fetchHistoricalPrices(s, histDays);

      if (prices && prices.length > 0) {
        var calc = _calculateAllFromPrices(prices);
        if (colMap.rsiCol && calc.rsi !== null) sheet.getRange(row, colMap.rsiCol).setValue(calc.rsi);
        if (colMap.dma50Col && calc.dma50 !== null) sheet.getRange(row, colMap.dma50Col).setValue(calc.dma50);
        if (colMap.dma200Col && calc.dma200 !== null) sheet.getRange(row, colMap.dma200Col).setValue(calc.dma200);
        if (colMap.return6mCol && calc.return6m !== null) sheet.getRange(row, colMap.return6mCol).setValue(calc.return6m);
        if (colMap.return1wCol && calc.return1w !== null) sheet.getRange(row, colMap.return1wCol).setValue(calc.return1w);
        if (colMap.return1mCol && calc.return1m !== null) sheet.getRange(row, colMap.return1mCol).setValue(calc.return1m);
        if (colMap.return1yCol && calc.return1y !== null) sheet.getRange(row, colMap.return1yCol).setValue(calc.return1y);
        if (colMap.high52wCol && calc.high52w !== null) {
          sheet.getRange(row, colMap.high52wCol).setValue(calc.high52w);
          // Calculate drawdown from 52W high
          var currentPrice = prices[prices.length - 1];
          if (colMap.drawdownCol && calc.high52w > 0) {
            var drawdown = Math.round(((currentPrice - calc.high52w) / calc.high52w) * 10000) / 100;
            sheet.getRange(row, colMap.drawdownCol).setValue(drawdown);
          }
        }
      }

      processed++;
      if (k < symbols.length - 1) Utilities.sleep(500);
    }
  }

  Logger.log('Chunked update complete: ' + processed + ' stocks in ' + sheetName +
    (skipped > 0 ? ' (' + skipped + ' skipped — Trendlyne)' : ''));
  return { processed: processed, total: symbols.length, done: true };
}
