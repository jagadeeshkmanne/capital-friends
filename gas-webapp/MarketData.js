/**
 * ============================================================================
 * CAPITAL FRIENDS - Market Data Service
 * ============================================================================
 *
 * Fetches market indices, gold, and silver prices.
 * Caches in Script Properties for 5 minutes to avoid rate limits.
 *
 * Data sources:
 *   - Indices: Google Finance (via UrlFetchApp scraping)
 *   - Gold/Silver: metals-api alternatives / RBI reference rates
 *
 * ============================================================================
 */

var MARKET_CACHE_KEY = 'market_data_cache';
var MARKET_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get cached market data or fetch fresh data.
 * Called via apiRouter → routeAction → getMarketData
 */
function getMarketData() {
  // Check cache first
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

  // Fetch indices
  try {
    result.indices = fetchIndianIndices();
  } catch (e) {
    log('Indices fetch failed: ' + e.message);
  }

  // Fetch metals (gold/silver)
  try {
    result.metals = fetchMetalPrices();
  } catch (e) {
    log('Metals fetch failed: ' + e.message);
  }

  // Note: Crypto (BTC) is fetched directly from frontend via CoinGecko (CORS-friendly)
  // We don't need to proxy it through GAS

  return result;
}

/**
 * Fetch Indian market indices using Google Finance
 * Uses a temporary sheet with GOOGLEFINANCE formulas
 */
function fetchIndianIndices() {
  var indices = [
    // Broad market
    { symbol: 'INDEXNSE:NIFTY_50', name: 'Nifty 50' },
    { symbol: 'INDEXNSE:NIFTY_NEXT_50', name: 'Nifty Next 50' },
    { symbol: 'INDEXNSE:NIFTY_100', name: 'Nifty 100' },
    { symbol: 'INDEXNSE:NIFTY_MIDCAP_150', name: 'Midcap 150' },
    { symbol: 'INDEXNSE:NIFTY_SMLCAP_250', name: 'Smallcap 250' },
    // Sector indices
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

  // Use a temporary sheet with GOOGLEFINANCE formulas
  var ss = SpreadsheetApp.getActive();
  if (!ss) {
    // Fallback: use deployer's spreadsheet or any accessible one
    return fetchIndicesViaUrl();
  }

  var tempSheetName = '_MarketTemp';
  var tempSheet = ss.getSheetByName(tempSheetName);
  if (!tempSheet) {
    tempSheet = ss.insertSheet(tempSheetName);
    tempSheet.hideSheet();
  }

  // Set up GOOGLEFINANCE formulas for price and change
  var formulas = [];
  for (var i = 0; i < indices.length; i++) {
    formulas.push([
      '=IFERROR(GOOGLEFINANCE("' + indices[i].symbol + '", "price"), 0)',
      '=IFERROR(GOOGLEFINANCE("' + indices[i].symbol + '", "changepct"), 0)'
    ]);
  }

  tempSheet.getRange(1, 1, formulas.length, 2).setFormulas(formulas);
  SpreadsheetApp.flush(); // Force calculation

  // Read values
  var values = tempSheet.getRange(1, 1, indices.length, 2).getValues();

  var results = [];
  for (var j = 0; j < indices.length; j++) {
    var price = parseFloat(values[j][0]) || 0;
    var changePct = parseFloat(values[j][1]) || 0;
    if (price > 0) {
      results.push({
        name: indices[j].name,
        symbol: indices[j].symbol,
        price: price,
        changePct: changePct,
        type: 'index'
      });
    }
  }

  // Clean up temp sheet
  try {
    ss.deleteSheet(tempSheet);
  } catch (e) {
    // If can't delete, just clear it
    tempSheet.clear();
  }

  return results;
}

/**
 * Fallback: Fetch indices via URL (less reliable)
 */
function fetchIndicesViaUrl() {
  // Yahoo Finance API endpoint for Indian indices
  var symbols = ['^NSEI', '^NSEBANK'];
  var results = [];

  for (var i = 0; i < symbols.length; i++) {
    try {
      var url = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(symbols[i]) + '?range=1d&interval=1d';
      var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
      if (response.getResponseCode() === 200) {
        var json = JSON.parse(response.getContentText());
        var meta = json.chart.result[0].meta;
        var price = meta.regularMarketPrice || 0;
        var prevClose = meta.chartPreviousClose || meta.previousClose || price;
        var changePct = prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0;

        var nameMap = {
          '^NSEI': 'Nifty 50',
          '^NSEBANK': 'Bank Nifty'
        };

        results.push({
          name: nameMap[symbols[i]] || symbols[i],
          symbol: symbols[i],
          price: price,
          changePct: changePct,
          type: 'index'
        });
      }
    } catch (e) {
      log('Yahoo Finance fetch failed for ' + symbols[i] + ': ' + e.message);
    }
  }

  return results;
}

/**
 * Fetch gold and silver prices in INR
 * Uses a combination of sources
 */
function fetchMetalPrices() {
  var results = [];

  // Try fetching from a public gold price API
  try {
    // Use Google Finance for gold via GAS
    var ss = SpreadsheetApp.getActive();
    if (ss) {
      var tempSheetName = '_MetalTemp';
      var tempSheet = ss.getSheetByName(tempSheetName);
      if (!tempSheet) {
        tempSheet = ss.insertSheet(tempSheetName);
        tempSheet.hideSheet();
      }

      // Gold price in USD per troy ounce, then convert
      // GOOGLEFINANCE for commodities may not work, so use currency approach
      // Gold: 1 troy ounce = 31.1035 grams
      // We'll get XAU/INR directly or USD gold + USD/INR
      tempSheet.getRange(1, 1).setFormula('=IFERROR(GOOGLEFINANCE("CURRENCY:USDINR"), 0)');
      SpreadsheetApp.flush();

      var usdInr = parseFloat(tempSheet.getRange(1, 1).getValue()) || 83;

      try {
        ss.deleteSheet(tempSheet);
      } catch (e) {
        tempSheet.clear();
      }

      // Fetch gold price in USD from a free API
      try {
        var goldUrl = 'https://api.metalpriceapi.com/v1/latest?api_key=demo&base=USD&currencies=XAU,XAG';
        var goldResp = UrlFetchApp.fetch(goldUrl, { muteHttpExceptions: true });
        if (goldResp.getResponseCode() === 200) {
          var goldJson = JSON.parse(goldResp.getContentText());
          if (goldJson.rates) {
            // XAU rate is USD per troy ounce (inverted)
            var goldOzUsd = goldJson.rates.USDXAU ? (1 / goldJson.rates.USDXAU) : 0;
            var silverOzUsd = goldJson.rates.USDXAG ? (1 / goldJson.rates.USDXAG) : 0;

            if (goldOzUsd > 0) {
              var goldGramInr = (goldOzUsd * usdInr) / 31.1035;
              results.push({
                name: 'Gold (24K)',
                symbol: 'XAU',
                price: Math.round(goldGramInr),
                unit: '₹/gram',
                type: 'metal'
              });
            }

            if (silverOzUsd > 0) {
              var silverGramInr = (silverOzUsd * usdInr) / 31.1035;
              results.push({
                name: 'Silver',
                symbol: 'XAG',
                price: Math.round(silverGramInr),
                unit: '₹/gram',
                type: 'metal'
              });
            }
          }
        }
      } catch (e) {
        log('Metal price API failed: ' + e.message);
      }
    }
  } catch (e) {
    log('Metal prices fetch failed: ' + e.message);
  }

  return results;
}
