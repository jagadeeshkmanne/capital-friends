/**
 * ============================================================================
 * CAPITAL FRIENDS - Market Data Service
 * ============================================================================
 *
 * Fetches market indices, gold, and silver prices.
 * Caches in CacheService for 5 minutes to avoid rate limits.
 *
 * Data sources:
 *   - Indices: NSE India API (primary), GOOGLEFINANCE (fallback)
 *   - Gold/Silver: GOOGLEFINANCE for USD/INR + metalpriceapi
 *   - Crypto: Fetched client-side from CoinGecko (CORS-friendly)
 *
 * ============================================================================
 */

var MARKET_CACHE_KEY = 'market_data_cache';

/**
 * Get cached market data or fetch fresh data.
 */
function getMarketData() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get(MARKET_CACHE_KEY);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (e) {
      // Cache corrupted, fetch fresh
    }
  }

  var data = fetchMarketData();

  // Cache for 5 minutes (300 seconds)
  try {
    cache.put(MARKET_CACHE_KEY, JSON.stringify(data), 300);
  } catch (e) {
    log('Market data cache put failed: ' + e.message);
  }

  return data;
}

/**
 * Fetch all market data from various sources
 */
function fetchMarketData() {
  var result = {
    indices: [],
    metals: [],
    crypto: [],
    lastUpdated: new Date().toISOString()
  };

  try {
    result.indices = fetchIndianIndices();
  } catch (e) {
    log('Indices fetch failed: ' + e.message);
  }

  try {
    result.metals = fetchMetalPrices();
  } catch (e) {
    log('Metals fetch failed: ' + e.message);
  }

  return result;
}

// ── Index name mapping for NSE API ──
var NSE_INDEX_NAMES = {
  'NIFTY 50': 'Nifty 50',
  'NIFTY NEXT 50': 'Nifty Next 50',
  'NIFTY 100': 'Nifty 100',
  'NIFTY MIDCAP 150': 'Midcap 150',
  'NIFTY SMLCAP 250': 'Smallcap 250',
  'NIFTY BANK': 'Bank Nifty',
  'NIFTY IT': 'Nifty IT',
  'NIFTY PHARMA': 'Nifty Pharma',
  'NIFTY AUTO': 'Nifty Auto',
  'NIFTY FINANCIAL SERVICES': 'Fin Services',
  'NIFTY FMCG': 'Nifty FMCG',
  'NIFTY METAL': 'Nifty Metal',
  'NIFTY REALTY': 'Nifty Realty',
  'NIFTY ENERGY': 'Nifty Energy'
};

// Desired display order
var INDEX_ORDER = [
  'NIFTY 50', 'NIFTY NEXT 50', 'NIFTY 100', 'NIFTY MIDCAP 150', 'NIFTY SMLCAP 250',
  'NIFTY BANK', 'NIFTY IT', 'NIFTY PHARMA', 'NIFTY AUTO', 'NIFTY FINANCIAL SERVICES',
  'NIFTY FMCG', 'NIFTY METAL', 'NIFTY REALTY', 'NIFTY ENERGY'
];

/**
 * Fetch Indian market indices — NSE API (primary), GOOGLEFINANCE (fallback)
 */
function fetchIndianIndices() {
  // Try NSE India API first
  try {
    var results = fetchIndicesFromNSE();
    if (results.length > 0) return results;
  } catch (e) {
    log('NSE API failed: ' + e.message);
  }

  // Fallback: GOOGLEFINANCE via user's spreadsheet
  try {
    var results2 = fetchIndicesViaGoogleFinance();
    if (results2.length > 0) return results2;
  } catch (e) {
    log('GOOGLEFINANCE fallback failed: ' + e.message);
  }

  // Last resort: Yahoo Finance for key indices
  return fetchIndicesViaYahoo();
}

/**
 * Primary: Fetch indices from NSE India API
 */
function fetchIndicesFromNSE() {
  var url = 'https://www.nseindia.com/api/allIndices';
  var response = UrlFetchApp.fetch(url, {
    muteHttpExceptions: true,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json',
      'Accept-Language': 'en-US,en;q=0.9'
    }
  });

  if (response.getResponseCode() !== 200) {
    throw new Error('NSE API returned ' + response.getResponseCode());
  }

  var json = JSON.parse(response.getContentText());
  var data = json.data || [];

  // Build a map of NSE index name → data
  var indexMap = {};
  for (var i = 0; i < data.length; i++) {
    var item = data[i];
    var key = (item.index || item.indexSymbol || '').toUpperCase();
    if (NSE_INDEX_NAMES[key]) {
      indexMap[key] = item;
    }
  }

  // Return in desired order
  var results = [];
  for (var j = 0; j < INDEX_ORDER.length; j++) {
    var name = INDEX_ORDER[j];
    var item2 = indexMap[name];
    if (item2) {
      var price = parseFloat(item2.last || item2.closePrice) || 0;
      var changePct = parseFloat(item2.percentChange) || 0;
      if (price > 0) {
        results.push({
          name: NSE_INDEX_NAMES[name],
          symbol: name,
          price: price,
          changePct: changePct,
          type: 'index'
        });
      }
    }
  }

  return results;
}

/**
 * Fallback: Fetch indices via GOOGLEFINANCE (uses user's spreadsheet)
 */
function fetchIndicesViaGoogleFinance() {
  var gfIndices = [
    { symbol: 'INDEXNSE:NIFTY_50', name: 'Nifty 50' },
    { symbol: 'INDEXNSE:NIFTY_NEXT_50', name: 'Nifty Next 50' },
    { symbol: 'INDEXNSE:NIFTY_100', name: 'Nifty 100' },
    { symbol: 'INDEXNSE:NIFTY_MIDCAP_150', name: 'Midcap 150' },
    { symbol: 'INDEXNSE:NIFTY_SMLCAP_250', name: 'Smallcap 250' },
    { symbol: 'INDEXNSE:NIFTY_BANK', name: 'Bank Nifty' },
    { symbol: 'INDEXNSE:NIFTY_IT', name: 'Nifty IT' },
    { symbol: 'INDEXNSE:NIFTY_PHARMA', name: 'Nifty Pharma' },
    { symbol: 'INDEXNSE:NIFTY_AUTO', name: 'Nifty Auto' },
    { symbol: 'INDEXNSE:NIFTY_FIN_SERVICE', name: 'Fin Services' },
    { symbol: 'INDEXNSE:NIFTY_FMCG', name: 'Nifty FMCG' },
    { symbol: 'INDEXNSE:NIFTY_METAL', name: 'Nifty Metal' },
    { symbol: 'INDEXNSE:NIFTY_REALTY', name: 'Nifty Realty' },
    { symbol: 'INDEXNSE:NIFTY_ENERGY', name: 'Nifty Energy' }
  ];

  var ss = getSpreadsheet(); // Uses openById (works via Execution API)
  var tempSheetName = '_MarketTemp';
  var tempSheet = ss.getSheetByName(tempSheetName);
  if (!tempSheet) {
    tempSheet = ss.insertSheet(tempSheetName);
    tempSheet.hideSheet();
  }

  var formulas = [];
  for (var i = 0; i < gfIndices.length; i++) {
    formulas.push([
      '=IFERROR(GOOGLEFINANCE("' + gfIndices[i].symbol + '", "price"), 0)',
      '=IFERROR(GOOGLEFINANCE("' + gfIndices[i].symbol + '", "changepct"), 0)'
    ]);
  }

  tempSheet.getRange(1, 1, formulas.length, 2).setFormulas(formulas);
  SpreadsheetApp.flush();

  var values = tempSheet.getRange(1, 1, gfIndices.length, 2).getValues();

  var results = [];
  for (var j = 0; j < gfIndices.length; j++) {
    var price = parseFloat(values[j][0]) || 0;
    var changePct = parseFloat(values[j][1]) || 0;
    if (price > 0) {
      results.push({
        name: gfIndices[j].name,
        symbol: gfIndices[j].symbol,
        price: price,
        changePct: changePct,
        type: 'index'
      });
    }
  }

  try {
    ss.deleteSheet(tempSheet);
  } catch (e) {
    tempSheet.clear();
  }

  return results;
}

/**
 * Last resort: Yahoo Finance for key indices only
 */
function fetchIndicesViaYahoo() {
  var symbols = [
    { yahoo: '^NSEI', name: 'Nifty 50' },
    { yahoo: '^NSEBANK', name: 'Bank Nifty' }
  ];
  var results = [];

  for (var i = 0; i < symbols.length; i++) {
    try {
      var url = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(symbols[i].yahoo) + '?range=1d&interval=1d';
      var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
      if (response.getResponseCode() === 200) {
        var json = JSON.parse(response.getContentText());
        var meta = json.chart.result[0].meta;
        var price = meta.regularMarketPrice || 0;
        var prevClose = meta.chartPreviousClose || meta.previousClose || price;
        var changePct = prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0;

        results.push({
          name: symbols[i].name,
          symbol: symbols[i].yahoo,
          price: price,
          changePct: changePct,
          type: 'index'
        });
      }
    } catch (e) {
      log('Yahoo Finance fetch failed for ' + symbols[i].yahoo + ': ' + e.message);
    }
  }

  return results;
}

/**
 * Fetch gold and silver prices in INR via Yahoo Finance futures
 */
function fetchMetalPrices() {
  var results = [];

  // Get USD/INR rate via GOOGLEFINANCE
  var usdInr = 83; // default fallback
  try {
    var ss = getSpreadsheet();
    var tempSheetName = '_MetalTemp';
    var tempSheet = ss.getSheetByName(tempSheetName);
    if (!tempSheet) {
      tempSheet = ss.insertSheet(tempSheetName);
      tempSheet.hideSheet();
    }

    tempSheet.getRange(1, 1).setFormula('=IFERROR(GOOGLEFINANCE("CURRENCY:USDINR"), 0)');
    SpreadsheetApp.flush();

    var rate = parseFloat(tempSheet.getRange(1, 1).getValue());
    if (rate > 0) usdInr = rate;

    try {
      ss.deleteSheet(tempSheet);
    } catch (e) {
      tempSheet.clear();
    }
  } catch (e) {
    log('USD/INR fetch failed: ' + e.message);
  }

  // Fetch gold & silver via Yahoo Finance futures (GC=F, SI=F)
  var metals = [
    { yahoo: 'GC=F', name: 'Gold (24K)', symbol: 'XAU', gramsPerOz: 31.1035 },
    { yahoo: 'SI=F', name: 'Silver', symbol: 'XAG', gramsPerOz: 31.1035 },
  ];

  for (var i = 0; i < metals.length; i++) {
    try {
      var url = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(metals[i].yahoo) + '?range=1d&interval=1d';
      var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
      if (resp.getResponseCode() === 200) {
        var json = JSON.parse(resp.getContentText());
        var meta = json.chart.result[0].meta;
        var priceUsd = meta.regularMarketPrice || 0;
        var prevClose = meta.chartPreviousClose || meta.previousClose || priceUsd;
        var changePct = prevClose > 0 ? ((priceUsd - prevClose) / prevClose) * 100 : 0;

        if (priceUsd > 0) {
          var pricePerGramInr = (priceUsd * usdInr) / metals[i].gramsPerOz;
          results.push({
            name: metals[i].name,
            symbol: metals[i].symbol,
            price: Math.round(pricePerGramInr),
            changePct: Math.round(changePct * 100) / 100,
            unit: '₹/gram',
            type: 'metal'
          });
        }
      }
    } catch (e) {
      log('Yahoo metal fetch failed for ' + metals[i].yahoo + ': ' + e.message);
    }
  }

  return results;
}
