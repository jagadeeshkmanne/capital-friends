/**
 * ============================================================================
 * SCREENER FETCH — Scrape Screener.in for fundamental data
 * ============================================================================
 *
 * Fetches fundamental data from Screener.in.
 *
 * Key functions:
 *   fetchFundamentals(symbol) → fundamental data object
 *   checkHardExitFundamentals(symbol, fundamentals) → hard exit signals
 *   checkSoftExitFundamentals(symbol, fundamentals) → soft exit signals
 */

var SCREENER_BASE_URL = 'https://www.screener.in/company/';

/** Debug: test market cap extraction for a single stock */
function debugMarketCap() {
  var symbol = 'TCI';
  var url = SCREENER_BASE_URL + encodeURIComponent(symbol) + '/';
  var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  var html = response.getContentText();

  // Log the area around "Market Cap"
  var idx = html.indexOf('Market Cap');
  if (idx === -1) idx = html.indexOf('market cap');
  if (idx === -1) idx = html.indexOf('market-cap');
  Logger.log('Found "Market Cap" at index: ' + idx);
  if (idx !== -1) {
    Logger.log('Context (500 chars): ' + html.substring(idx, idx + 500));
  }

  var result = _extractMarketCapCr(html);
  Logger.log('Extracted market cap: ' + result);

  var fullResult = fetchMarketCapOnly(symbol);
  Logger.log('fetchMarketCapOnly result: ' + JSON.stringify(fullResult));
}

// ============================================================================
// FETCH FUNDAMENTALS
// ============================================================================

/**
 * Fetch fundamental data for a stock from Screener.in
 * Parses the HTML page to extract key metrics from structured tables.
 *
 * @param {string} symbol - NSE stock symbol (e.g. 'RELIANCE')
 * @returns {Object|null} - fundamental data object, or null on failure
 */
function fetchFundamentals(symbol) {
  try {
    var url = SCREENER_BASE_URL + encodeURIComponent(symbol) + '/';
    Logger.log('Fetching fundamentals for ' + symbol + ' from ' + url);

    var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    var statusCode = response.getResponseCode();

    if (statusCode !== 200) {
      Logger.log('Screener.in returned HTTP ' + statusCode + ' for ' + symbol);
      return null;
    }

    var html = response.getContentText();

    var fundamentals = {
      symbol: symbol,
      fetchDate: new Date(),

      // Promoter data
      promoterHolding: _extractNumberFromScreener(html, 'Promoter holding'),
      promoterPledge: _extractPromoterPledge(html),
      promoterHoldingPrev: _extractPrevQuarterValue(html, 'Promoter holding'),
      promoterHoldingChange: null, // calculated below

      // Institutional holdings
      fiiHolding: _extractNumberFromScreener(html, 'FII holding'),
      fiiHoldingPrev: _extractPrevQuarterValue(html, 'FII holding'),
      fiiChange: null, // calculated below
      mfHolding: _extractNumberFromScreener(html, 'DIIs') || _extractNumberFromScreener(html, 'DII holding'),
      mfHoldingPrev: _extractPrevQuarterValue(html, 'DIIs') || _extractPrevQuarterValue(html, 'DII holding'),
      mfChange: null, // calculated below

      // Debt & solvency
      debtToEquity: _extractRatioFromScreener(html, 'Debt to equity'),
      interestCoverage: _extractRatioFromScreener(html, 'Interest coverage'),

      // Quality scores
      piotroski: _extractRatioFromScreener(html, 'Piotroski'),

      // Profitability
      roe: _extractRatioFromScreener(html, 'Return on equity'),
      opm: _extractOPM(html),

      // Growth
      salesGrowth: _extractRatioFromScreener(html, 'Sales growth'),
      profitGrowth: _extractRatioFromScreener(html, 'Profit growth'),
      revenueGrowthQ1: _extractQuarterlyRevenueGrowth(html, 0),
      revenueGrowthQ2: _extractQuarterlyRevenueGrowth(html, 1),

      // Market cap & classification
      marketCapCr: _extractMarketCapCr(html),
      capClass: null, // calculated below

      // Sector (from same page)
      sector: _extractSector(html),

      // Valuation
      pe: _extractRatioFromScreener(html, 'Stock P/E'),

      // Working capital quality
      inventoryChangeYoY: _extractInventoryChangeYoY(html),
      receivablesChangeYoY: _extractReceivablesChangeYoY(html),
      receivableDays: _extractRatioFromScreener(html, 'Debtor days'),

      // Cash flow quality
      cfoVsNetProfit: _extractCFOvsNetProfit(html),

      // Governance
      relatedPartyPct: _extractRelatedPartyPct(html),
      promoterSalaryPct: _extractPromoterSalaryPct(html),

      // Pledge change (QoQ)
      promoterPledgePrev: _extractPrevQuarterPledge(html),
      promoterPledgeChange: null // calculated below
    };

    // Calculate QoQ changes
    if (fundamentals.promoterHolding !== null && fundamentals.promoterHoldingPrev !== null) {
      fundamentals.promoterHoldingChange = fundamentals.promoterHolding - fundamentals.promoterHoldingPrev;
    }
    if (fundamentals.fiiHolding !== null && fundamentals.fiiHoldingPrev !== null) {
      fundamentals.fiiChange = fundamentals.fiiHolding - fundamentals.fiiHoldingPrev;
    }
    if (fundamentals.mfHolding !== null && fundamentals.mfHoldingPrev !== null) {
      fundamentals.mfChange = fundamentals.mfHolding - fundamentals.mfHoldingPrev;
    }
    if (fundamentals.promoterPledge !== null && fundamentals.promoterPledgePrev !== null) {
      fundamentals.promoterPledgeChange = fundamentals.promoterPledge - fundamentals.promoterPledgePrev;
    }

    // Classify market cap
    if (fundamentals.marketCapCr !== null) {
      fundamentals.capClass = _classifyMarketCap(fundamentals.marketCapCr);
    }

    Logger.log('Fundamentals fetched for ' + symbol + ': PE=' + fundamentals.pe +
      ', D/E=' + fundamentals.debtToEquity + ', Promoter=' + fundamentals.promoterHolding + '%');

    return fundamentals;

  } catch (e) {
    Logger.log('Error fetching fundamentals for ' + symbol + ': ' + e.message);
    return null;
  }
}

// ============================================================================
// HTML PARSING HELPERS
// ============================================================================

/**
 * Extract market cap in Crores from Screener.in HTML.
 * Screener.in shows "Market Cap" in the top section as "₹ XX,XXX Cr."
 *
 * @param {string} html
 * @returns {number|null} market cap in Cr
 */
function _extractMarketCapCr(html) {
  try {
    var patterns = [
      // "Market Cap" ... <span class="number">12,345</span>
      /Market\s*Cap[^<]*<[^>]*>[^<]*<[^>]*class="number"[^>]*>([\d,\.]+)/i,
      /Market\s*Cap[\s\S]{0,200}?class="number"[^>]*>([\d,\.]+)/i,
      // "Market Cap ₹ 12,345 Cr"
      /Market\s*Cap[^₹]*₹\s*([\d,\.]+)\s*Cr/i
    ];

    for (var i = 0; i < patterns.length; i++) {
      var match = html.match(patterns[i]);
      if (match && match[1]) {
        var val = parseFloat(match[1].replace(/,/g, ''));
        if (!isNaN(val)) return val;
      }
    }
    return null;
  } catch (e) {
    Logger.log('Error extracting Market Cap: ' + e.message);
    return null;
  }
}

/**
 * Classify market cap into Large/Mid/Small/Micro
 * SEBI definitions: Large ≥ 20,000 Cr, Mid 5,000-20,000, Small 500-5,000, Micro < 500
 *
 * @param {number} marketCapCr - market cap in Crores
 * @returns {string} 'LARGE' | 'MID' | 'SMALL' | 'MICRO'
 */
function _classifyMarketCap(marketCapCr) {
  if (marketCapCr >= 20000) return 'LARGE';
  if (marketCapCr >= 5000) return 'MID';
  if (marketCapCr >= 500) return 'SMALL';
  return 'MICRO';
}

/**
 * Fetch MF holding QoQ change for a stock from Screener.in.
 * Uses the same HTML parsing as fetchFundamentals() but only extracts MF data.
 * Called during daily market data enrichment to determine conviction.
 *
 * @param {string} symbol - NSE symbol
 * @returns {{mfHolding: number|null, mfHoldingPrev: number|null, mfChangeQoQ: number|null}}
 */
function fetchMFHoldingChange(symbol) {
  try {
    var url = SCREENER_BASE_URL + encodeURIComponent(symbol) + '/';
    var response;
    // Retry once on failure (Screener.in sometimes blocks rapid requests)
    for (var attempt = 0; attempt < 2; attempt++) {
      try {
        response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
        if (response.getResponseCode() === 200) break;
      } catch (fetchErr) {
        if (attempt === 0) { Utilities.sleep(3000); continue; }
        throw fetchErr;
      }
    }
    if (!response || response.getResponseCode() !== 200) return { mfHolding: null, mfHoldingPrev: null, mfChangeQoQ: null };

    var html = response.getContentText();
    // Screener.in uses "DIIs" label (not "DII holding") in shareholding table
    var current = _extractNumberFromScreener(html, 'DIIs');
    var prev = _extractPrevQuarterValue(html, 'DIIs');
    // Fallback: try "DII" if "DIIs" not found
    if (current === null) {
      current = _extractNumberFromScreener(html, 'DII');
      prev = _extractPrevQuarterValue(html, 'DII');
    }
    var change = (current !== null && prev !== null) ? Math.round((current - prev) * 100) / 100 : null;

    Logger.log('MF holding for ' + symbol + ': ' + current + '% (prev: ' + prev + '%, change: ' + change + '%)');
    return { mfHolding: current, mfHoldingPrev: prev, mfChangeQoQ: change };
  } catch (e) {
    Logger.log('Error fetching MF holding for ' + symbol + ': ' + e.message);
    return { mfHolding: null, mfHoldingPrev: null, mfChangeQoQ: null };
  }
}

/**
 * Lightweight market cap fetch — only grabs market cap from Screener.in
 * Used when adding stocks to watchlist (doesn't need full fundamentals)
 *
 * @param {string} symbol - NSE symbol
 * @returns {{marketCapCr: number|null, capClass: string|null}}
 */
function fetchMarketCapOnly(symbol) {
  try {
    var url = SCREENER_BASE_URL + encodeURIComponent(symbol) + '/';
    var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (response.getResponseCode() !== 200) return { marketCapCr: null, capClass: null, sector: null };

    var html = response.getContentText();
    var marketCapCr = _extractMarketCapCr(html);
    var capClass = marketCapCr ? _classifyMarketCap(marketCapCr) : null;

    // Sector from Screener.in (same page, no extra call) + normalized
    var sector = _extractSector(html);

    Logger.log('Market cap for ' + symbol + ': ₹' + marketCapCr + ' Cr (' + capClass + '), Sector: ' + sector);
    return { marketCapCr: marketCapCr, capClass: capClass, sector: sector };
  } catch (e) {
    Logger.log('Error fetching market cap for ' + symbol + ': ' + e.message);
    return { marketCapCr: null, capClass: null, sector: null };
  }
}

/**
 * Extract sector/industry from Screener.in company page.
 * Screener.in shows sector in the sub-heading as a link to compare page.
 * Returns normalized Nifty-style sector name.
 */
function _extractSector(html) {
  try {
    // Screener.in uses /market/ links with title attributes for classification:
    //   <a href="/market/IN09/" title="Broad Sector">Services</a>
    //   <a href="/market/IN09/IN0901/" title="Sector">Services</a>
    //   <a href="/market/IN09/IN0901/IN090104/" title="Broad Industry">Commercial Services</a>
    //   <a href="/market/IN09/IN0901/IN090104/IN090104005/" title="Industry">BPO/KPO</a>

    // Try "Industry" first (most specific — e.g. "Internet & Catalogue Retail" vs just "Retailing")
    var industry = html.match(/<a[^>]*href="\/market\/[^"]*"[^>]*title="Industry"[^>]*>([^<]+)<\/a>/i);
    if (industry && industry[1]) {
      return _normalizeSector(industry[1].trim());
    }

    // Fall back to "Broad Industry"
    var broadIndustry = html.match(/<a[^>]*href="\/market\/[^"]*"[^>]*title="Broad Industry"[^>]*>([^<]+)<\/a>/i);
    if (broadIndustry && broadIndustry[1]) {
      return _normalizeSector(broadIndustry[1].trim());
    }

    // Fall back to "Sector"
    var sector = html.match(/<a[^>]*href="\/market\/[^"]*"[^>]*title="Sector"[^>]*>([^<]+)<\/a>/i);
    if (sector && sector[1]) {
      return _normalizeSector(sector[1].trim());
    }

    return null;
  } catch (e) {
    Logger.log('Error extracting sector: ' + e.message);
    return null;
  }
}

/**
 * Normalize Screener.in granular sectors into Nifty-style broad sectors.
 * Maps ~100+ sub-industries to ~15 standard sectors.
 */
function _normalizeSector(raw) {
  var s = raw.toLowerCase();
  Logger.log('  _normalizeSector raw: "' + raw + '"');

  // Consumer Durables (granite, appliances, leather goods — NOT FMCG)
  // Must be before FMCG since 'consumer' would match FMCG
  if (s.indexOf('consumer durable') >= 0 || s.indexOf('granite') >= 0 || s.indexOf('marble') >= 0 ||
      s.indexOf('appliance') >= 0 || s.indexOf('furnishing') >= 0 || s.indexOf('flooring') >= 0) return 'Capital Goods';

  // Internet Retail / Online Marketplace (B2B/B2C platforms — IT, not FMCG)
  // Must be before FMCG since 'retail' would match FMCG
  if (s.indexOf('internet') >= 0 || s.indexOf('catalogue retail') >= 0 || s.indexOf('online') >= 0) return 'IT';

  // IT & Services
  if (s.indexOf('software') >= 0 || s.indexOf('it ') >= 0 || s.indexOf('information tech') >= 0 ||
      s.indexOf('digital') >= 0 || s.indexOf('cloud') >= 0 || s.indexOf('saas') >= 0 ||
      s.indexOf('commercial services') >= 0 || s.indexOf('consulting') >= 0 ||
      s.indexOf('bpo') >= 0 || s.indexOf('outsourcing') >= 0 || s.indexOf('staffing') >= 0) return 'IT';

  // Banking
  if (s.indexOf('bank') >= 0 || s.indexOf('nbfc') >= 0 || s.indexOf('microfinance') >= 0 ||
      s.indexOf('housing finance') >= 0) return 'Banking';

  // Financial Services (non-banking)
  if (s.indexOf('finance') >= 0 || s.indexOf('insurance') >= 0 || s.indexOf('capital market') >= 0 ||
      s.indexOf('stock exchange') >= 0 || s.indexOf('wealth') >= 0 || s.indexOf('credit') >= 0 ||
      s.indexOf('asset management') >= 0) return 'Fin Services';

  // Pharma & Healthcare
  if (s.indexOf('pharma') >= 0 || s.indexOf('drug') >= 0 || s.indexOf('healthcare') >= 0 ||
      s.indexOf('hospital') >= 0 || s.indexOf('diagnostic') >= 0 || s.indexOf('medical') >= 0 ||
      s.indexOf('biotech') >= 0 || s.indexOf('api ') >= 0 || s.indexOf('clinical') >= 0) return 'Pharma';

  // Auto
  if (s.indexOf('auto') >= 0 || s.indexOf('vehicle') >= 0 || s.indexOf('tyre') >= 0 ||
      s.indexOf('tire') >= 0 || s.indexOf('tractor') >= 0 || s.indexOf('two wheeler') >= 0 ||
      s.indexOf('car ') >= 0 || s.indexOf('engine') >= 0 || s.indexOf('ancillary') >= 0) return 'Auto';

  // FMCG
  if (s.indexOf('fmcg') >= 0 || s.indexOf('consumer') >= 0 || s.indexOf('food') >= 0 ||
      s.indexOf('beverage') >= 0 || s.indexOf('dairy') >= 0 || s.indexOf('personal care') >= 0 ||
      s.indexOf('tobacco') >= 0 || s.indexOf('liquor') >= 0 || s.indexOf('brewery') >= 0 ||
      s.indexOf('retail') >= 0 || s.indexOf('sugar') >= 0 || s.indexOf('edible oil') >= 0 ||
      s.indexOf('packaged') >= 0) return 'FMCG';

  // Metal & Mining
  if (s.indexOf('metal') >= 0 || s.indexOf('steel') >= 0 || s.indexOf('iron') >= 0 ||
      s.indexOf('aluminium') >= 0 || s.indexOf('copper') >= 0 || s.indexOf('zinc') >= 0 ||
      s.indexOf('mining') >= 0) return 'Metal';

  // Energy & Oil
  if (s.indexOf('oil') >= 0 || s.indexOf('gas ') >= 0 || s.indexOf('energy') >= 0 ||
      s.indexOf('petroleum') >= 0 || s.indexOf('refiner') >= 0 || s.indexOf('lng') >= 0 ||
      s.indexOf('power') >= 0 || s.indexOf('electric util') >= 0 || s.indexOf('solar') >= 0 ||
      s.indexOf('renewable') >= 0 || s.indexOf('wind') >= 0) return 'Energy';

  // Realty & Construction
  if (s.indexOf('real estate') >= 0 || s.indexOf('construction') >= 0 || s.indexOf('infra') >= 0 ||
      s.indexOf('cement') >= 0 || s.indexOf('building') >= 0 ||
      (s.indexOf('housing') >= 0 && s.indexOf('finance') < 0)) return 'Realty';

  // Telecom & Media
  if (s.indexOf('telecom') >= 0 || s.indexOf('media') >= 0 || s.indexOf('entertainment') >= 0 ||
      s.indexOf('broadcast') >= 0) return 'Telecom';

  // Chemicals
  if (s.indexOf('chemical') >= 0 || s.indexOf('fertilizer') >= 0 || s.indexOf('pesticide') >= 0 ||
      s.indexOf('agrochemical') >= 0 || s.indexOf('specialty chem') >= 0 || s.indexOf('dye') >= 0 ||
      s.indexOf('pigment') >= 0) return 'Chemicals';

  // Capital Goods / Industrial
  if (s.indexOf('capital goods') >= 0 || s.indexOf('industrial') >= 0 || s.indexOf('engineering') >= 0 ||
      s.indexOf('machinery') >= 0 || s.indexOf('equipment') >= 0 || s.indexOf('electrical') >= 0 ||
      s.indexOf('welding') >= 0 || s.indexOf('pipe') >= 0 || s.indexOf('cable') >= 0 ||
      s.indexOf('defence') >= 0 || s.indexOf('defense') >= 0 || s.indexOf('aerospace') >= 0) return 'Capital Goods';

  // Logistics & Transport
  if (s.indexOf('logistics') >= 0 || s.indexOf('shipping') >= 0 || s.indexOf('transport') >= 0 ||
      s.indexOf('courier') >= 0 || s.indexOf('port') >= 0 || s.indexOf('aviation') >= 0 ||
      s.indexOf('airline') >= 0 || s.indexOf('warehouse') >= 0 || s.indexOf('drilling') >= 0) return 'Logistics';

  // Textiles & Apparel
  if (s.indexOf('textile') >= 0 || s.indexOf('apparel') >= 0 || s.indexOf('garment') >= 0 ||
      s.indexOf('fabric') >= 0 || s.indexOf('leather') >= 0) return 'Textiles';

  // Hotels & Travel
  if (s.indexOf('hotel') >= 0 || s.indexOf('travel') >= 0 || s.indexOf('tourism') >= 0 ||
      s.indexOf('hospitality') >= 0 || s.indexOf('restaurant') >= 0 || s.indexOf('leisure') >= 0) return 'Hotels';

  // Ceramics, Glass, Paper (misc manufacturing)
  if (s.indexOf('ceramic') >= 0 || s.indexOf('glass') >= 0 || s.indexOf('paper') >= 0 ||
      s.indexOf('forest') >= 0 || s.indexOf('packaging') >= 0 || s.indexOf('container') >= 0) return 'Capital Goods';

  // Trading / Marketplace (B2B platforms, exchanges)
  if (s.indexOf('trading') >= 0 || s.indexOf('marketplace') >= 0 || s.indexOf('e-commerce') >= 0 ||
      s.indexOf('exchange') >= 0) return 'IT';

  // Fallback: return raw but title-cased
  return raw.split(' - ')[0].trim();
}

/**
 * Extract a numeric value from Screener.in HTML for a given label.
 * Screener uses <span class="name">Label</span> ... <span class="number">Value</span> pattern
 * in the top ratios section and <li> items.
 *
 * @param {string} html - Full page HTML
 * @param {string} label - Label text to search for (e.g. 'Promoter holding')
 * @returns {number|null}
 */
function _extractNumberFromScreener(html, label) {
  try {
    // Pattern: label appears near a number value in the same li or row
    var escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    var patterns = [
      // Top ratios: <li><span class="name">Label</span><span class="nowrap value"><span class="number">42.5</span>
      new RegExp(escapedLabel + '[^<]*<[^>]*>[^<]*<[^>]*class="number"[^>]*>([\\d,\\.]+)', 'i'),
      // Alternate: Label ... <span class="number">Value</span> (within 200 chars)
      new RegExp(escapedLabel + '[\\s\\S]{0,200}?class="number"[^>]*>([\\d,\\.]+)', 'i'),
      // Simple: Label followed by number in a td
      new RegExp(escapedLabel + '[\\s\\S]{0,150}?<td[^>]*>\\s*([\\d,\\.]+)\\s*%?\\s*</td>', 'i')
    ];

    for (var i = 0; i < patterns.length; i++) {
      var match = html.match(patterns[i]);
      if (match && match[1]) {
        var val = parseFloat(match[1].replace(/,/g, ''));
        if (!isNaN(val)) return val;
      }
    }
    return null;
  } catch (e) {
    Logger.log('Error extracting ' + label + ': ' + e.message);
    return null;
  }
}

/**
 * Extract a ratio value from the top ratios section.
 * Similar to _extractNumberFromScreener but also handles negative values.
 *
 * @param {string} html
 * @param {string} label
 * @returns {number|null}
 */
function _extractRatioFromScreener(html, label) {
  try {
    var escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    var patterns = [
      new RegExp(escapedLabel + '[^<]*<[^>]*>[^<]*<[^>]*class="number"[^>]*>(-?[\\d,\\.]+)', 'i'),
      new RegExp(escapedLabel + '[\\s\\S]{0,200}?class="number"[^>]*>(-?[\\d,\\.]+)', 'i'),
      new RegExp(escapedLabel + '[\\s\\S]{0,150}?<td[^>]*>\\s*(-?[\\d,\\.]+)\\s*%?\\s*</td>', 'i')
    ];

    for (var i = 0; i < patterns.length; i++) {
      var match = html.match(patterns[i]);
      if (match && match[1]) {
        var val = parseFloat(match[1].replace(/,/g, ''));
        if (!isNaN(val)) return val;
      }
    }
    return null;
  } catch (e) {
    Logger.log('Error extracting ratio ' + label + ': ' + e.message);
    return null;
  }
}

/**
 * Extract promoter pledge percentage from shareholding section.
 * Screener shows pledge info in the shareholding pattern table.
 *
 * @param {string} html
 * @returns {number|null}
 */
function _extractPromoterPledge(html) {
  try {
    // Look for "Pledged" or "pledge" percentage in shareholding section
    var patterns = [
      /[Pp]ledged[^<]*<[^>]*>[^<]*<[^>]*class="number"[^>]*>([\d,.]+)/,
      /[Pp]ledge[d]?\s*percentage[\s\S]{0,100}?([\d,.]+)\s*%/i,
      /[Pp]romoter\s*pledge[\s\S]{0,100}?([\d,.]+)\s*%/i,
      /pledge[\s\S]{0,200}?<td[^>]*>\s*([\d,.]+)\s*%?\s*<\/td>/i
    ];

    for (var i = 0; i < patterns.length; i++) {
      var match = html.match(patterns[i]);
      if (match && match[1]) {
        var val = parseFloat(match[1].replace(/,/g, ''));
        if (!isNaN(val)) return val;
      }
    }
    return null;
  } catch (e) {
    Logger.log('Error extracting promoter pledge: ' + e.message);
    return null;
  }
}

/**
 * Extract previous quarter's promoter pledge for QoQ change.
 *
 * @param {string} html
 * @returns {number|null}
 */
function _extractPrevQuarterPledge(html) {
  try {
    // Shareholding pattern table has multiple quarters as columns.
    // The previous quarter pledge is the second-to-last value in the pledge row.
    var pledgeMatch = html.match(/[Pp]ledge[\s\S]{0,500}?<\/tr>/);
    if (!pledgeMatch) return null;

    var row = pledgeMatch[0];
    var numbers = [];
    var numPattern = /<td[^>]*>\s*(-?[\d,.]+)\s*%?\s*<\/td>/g;
    var m;
    while ((m = numPattern.exec(row)) !== null) {
      numbers.push(parseFloat(m[1].replace(/,/g, '')));
    }

    // Previous quarter = second to last
    if (numbers.length >= 2) {
      return numbers[numbers.length - 2];
    }
    return null;
  } catch (e) {
    Logger.log('Error extracting prev quarter pledge: ' + e.message);
    return null;
  }
}

/**
 * Extract the previous quarter's value for a shareholding metric.
 * Screener's shareholding table has quarters as columns.
 *
 * @param {string} html
 * @param {string} label - e.g. 'Promoter holding', 'FII holding', 'DII holding'
 * @returns {number|null}
 */
function _extractPrevQuarterValue(html, label) {
  try {
    var escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Find the row containing this label, then extract all td numbers
    var rowPattern = new RegExp(escapedLabel + '[\\s\\S]{0,500}?<\\/tr>', 'i');
    var rowMatch = html.match(rowPattern);
    if (!rowMatch) return null;

    var row = rowMatch[0];
    var numbers = [];
    var numPattern = /<td[^>]*>\s*(-?[\d,.]+)\s*%?\s*<\/td>/g;
    var m;
    while ((m = numPattern.exec(row)) !== null) {
      var val = parseFloat(m[1].replace(/,/g, ''));
      if (!isNaN(val)) numbers.push(val);
    }

    // Previous quarter = second to last value
    if (numbers.length >= 2) {
      return numbers[numbers.length - 2];
    }
    return null;
  } catch (e) {
    Logger.log('Error extracting prev quarter for ' + label + ': ' + e.message);
    return null;
  }
}

/**
 * Extract OPM (Operating Profit Margin) from the profit & loss or ratios section.
 *
 * @param {string} html
 * @returns {number|null}
 */
function _extractOPM(html) {
  try {
    var patterns = [
      /OPM[\s\S]{0,200}?class="number"[^>]*>(-?[\d,.]+)/i,
      /Operating\s*[Pp]rofit\s*[Mm]argin[\s\S]{0,200}?(-?[\d,.]+)\s*%/i,
      /OPM\s*%[\s\S]{0,200}?<td[^>]*>\s*(-?[\d,.]+)\s*%?\s*<\/td>/i
    ];

    for (var i = 0; i < patterns.length; i++) {
      var match = html.match(patterns[i]);
      if (match && match[1]) {
        var val = parseFloat(match[1].replace(/,/g, ''));
        if (!isNaN(val)) return val;
      }
    }
    return null;
  } catch (e) {
    Logger.log('Error extracting OPM: ' + e.message);
    return null;
  }
}

/**
 * Extract quarterly revenue growth from the quarterly results table.
 * Screener shows quarterly results with Sales/Revenue as the first row.
 *
 * @param {string} html
 * @param {number} quartersAgo - 0 for latest quarter, 1 for previous quarter
 * @returns {number|null} - YoY growth % for that quarter, or null
 */
function _extractQuarterlyRevenueGrowth(html, quartersAgo) {
  try {
    // Find quarterly results section
    var qSection = html.match(/Quarterly\s*Results[\s\S]{0,10000}?<\/table>/i);
    if (!qSection) {
      // Try alternate section markers
      qSection = html.match(/id="quarters"[\s\S]{0,10000}?<\/table>/i);
    }
    if (!qSection) return null;

    var table = qSection[0];

    // Find Sales/Revenue row
    var salesMatch = table.match(/(?:Sales|Revenue)[\s\S]{0,1000}?<\/tr>/i);
    if (!salesMatch) return null;

    var salesRow = salesMatch[0];
    var numbers = [];
    var numPattern = /<td[^>]*>\s*(-?[\d,.]+)\s*<\/td>/g;
    var m;
    while ((m = numPattern.exec(salesRow)) !== null) {
      numbers.push(parseFloat(m[1].replace(/,/g, '')));
    }

    // Need at least 5 quarters to calculate YoY growth for latest quarter
    // (current Q and same Q last year = 4 quarters apart)
    var idx = numbers.length - 1 - quartersAgo;
    var idxYoY = idx - 4; // same quarter last year

    if (idx >= 0 && idxYoY >= 0 && numbers[idxYoY] > 0) {
      return Math.round(((numbers[idx] - numbers[idxYoY]) / numbers[idxYoY]) * 10000) / 100;
    }
    return null;
  } catch (e) {
    Logger.log('Error extracting quarterly revenue growth: ' + e.message);
    return null;
  }
}

/**
 * Extract YoY inventory change from balance sheet section.
 *
 * @param {string} html
 * @returns {number|null} - YoY % change, or null
 */
function _extractInventoryChangeYoY(html) {
  try {
    return _extractBalanceSheetItemChangeYoY(html, 'Inventory');
  } catch (e) {
    Logger.log('Error extracting inventory change: ' + e.message);
    return null;
  }
}

/**
 * Extract YoY receivables change from balance sheet section.
 *
 * @param {string} html
 * @returns {number|null} - YoY % change, or null
 */
function _extractReceivablesChangeYoY(html) {
  try {
    // Try multiple labels: "Trade receivables", "Debtors", "Receivables"
    var labels = ['Trade [Rr]eceivables', 'Debtors', 'Receivables', 'Sundry [Dd]ebtors'];
    for (var i = 0; i < labels.length; i++) {
      var result = _extractBalanceSheetItemChangeYoY(html, labels[i]);
      if (result !== null) return result;
    }
    return null;
  } catch (e) {
    Logger.log('Error extracting receivables change: ' + e.message);
    return null;
  }
}

/**
 * Extract YoY change for a balance sheet line item.
 * Screener's balance sheet table has years as columns (latest on the right).
 *
 * @param {string} html
 * @param {string} label - Row label pattern (regex-safe)
 * @returns {number|null} - YoY % change
 */
function _extractBalanceSheetItemChangeYoY(html, label) {
  try {
    // Find balance sheet section
    var bsSection = html.match(/(?:Balance\s*Sheet|id="balance-sheet")[\s\S]{0,30000}?<\/table>/i);
    if (!bsSection) return null;

    var table = bsSection[0];
    var rowPattern = new RegExp(label + '[\\s\\S]{0,1000}?<\\/tr>', 'i');
    var rowMatch = table.match(rowPattern);
    if (!rowMatch) return null;

    var row = rowMatch[0];
    var numbers = [];
    var numPattern = /<td[^>]*>\s*(-?[\d,.]+)\s*<\/td>/g;
    var m;
    while ((m = numPattern.exec(row)) !== null) {
      numbers.push(parseFloat(m[1].replace(/,/g, '')));
    }

    // Last two values = current year and previous year
    if (numbers.length >= 2) {
      var current = numbers[numbers.length - 1];
      var previous = numbers[numbers.length - 2];
      if (previous > 0) {
        return Math.round(((current - previous) / previous) * 10000) / 100;
      }
    }
    return null;
  } catch (e) {
    Logger.log('Error extracting balance sheet item ' + label + ': ' + e.message);
    return null;
  }
}

/**
 * Extract CFO (Cash Flow from Operations) vs Net Profit.
 * Returns true if CFO > Net Profit (healthy), false otherwise, null if data not found.
 *
 * @param {string} html
 * @returns {boolean|null}
 */
function _extractCFOvsNetProfit(html) {
  try {
    var cfSection = html.match(/(?:Cash\s*Flow|id="cash-flow")[\s\S]{0,15000}?<\/table>/i);
    if (!cfSection) return null;

    var table = cfSection[0];

    // CFO row
    var cfoMatch = table.match(/(?:Cash\s*from\s*Operating|Operating\s*Activity|CFO)[\s\S]{0,500}?<\/tr>/i);
    if (!cfoMatch) return null;

    var cfoNumbers = _extractRowNumbers(cfoMatch[0]);
    var cfo = cfoNumbers.length > 0 ? cfoNumbers[cfoNumbers.length - 1] : null;

    // Net Profit - look in P&L section
    var plSection = html.match(/(?:Profit\s*&\s*Loss|id="profit-loss")[\s\S]{0,15000}?<\/table>/i);
    if (!plSection) return null;

    var npMatch = plSection[0].match(/Net\s*[Pp]rofit[\s\S]{0,500}?<\/tr>/i);
    if (!npMatch) return null;

    var npNumbers = _extractRowNumbers(npMatch[0]);
    var netProfit = npNumbers.length > 0 ? npNumbers[npNumbers.length - 1] : null;

    if (cfo !== null && netProfit !== null && netProfit !== 0) {
      return cfo > netProfit;
    }
    return null;
  } catch (e) {
    Logger.log('Error extracting CFO vs Net Profit: ' + e.message);
    return null;
  }
}

/**
 * Extract related party transactions as % of revenue.
 * Screener may not always have this prominently — check notes or ratios.
 *
 * @param {string} html
 * @returns {number|null}
 */
function _extractRelatedPartyPct(html) {
  try {
    var patterns = [
      /[Rr]elated\s*[Pp]arty[\s\S]{0,300}?([\d,.]+)\s*%/,
      /[Rr]elated\s*[Pp]arty\s*[Tt]ransaction[\s\S]{0,300}?([\d,.]+)\s*%/
    ];

    for (var i = 0; i < patterns.length; i++) {
      var match = html.match(patterns[i]);
      if (match && match[1]) {
        var val = parseFloat(match[1].replace(/,/g, ''));
        if (!isNaN(val)) return val;
      }
    }

    // Fallback: try to compute from absolute values if available
    // Related party transactions amount / revenue
    var rptMatch = html.match(/[Rr]elated\s*[Pp]arty[\s\S]{0,500}?<\/tr>/i);
    if (rptMatch) {
      var rptNumbers = _extractRowNumbers(rptMatch[0]);
      if (rptNumbers.length > 0) {
        var rptAmount = rptNumbers[rptNumbers.length - 1];
        var revenue = _getLatestRevenue(html);
        if (revenue && revenue > 0) {
          return Math.round((Math.abs(rptAmount) / revenue) * 10000) / 100;
        }
      }
    }

    return null;
  } catch (e) {
    Logger.log('Error extracting related party %: ' + e.message);
    return null;
  }
}

/**
 * Extract promoter salary/remuneration as % of net profits.
 *
 * @param {string} html
 * @returns {number|null}
 */
function _extractPromoterSalaryPct(html) {
  try {
    // Look for director/promoter remuneration patterns
    var patterns = [
      /[Dd]irector[s']?\s*[Rr]emuneration[\s\S]{0,300}?([\d,.]+)\s*%/,
      /[Pp]romoter\s*[Ss]alary[\s\S]{0,300}?([\d,.]+)\s*%/,
      /[Mm]anagerial\s*[Rr]emuneration[\s\S]{0,300}?([\d,.]+)\s*%/
    ];

    for (var i = 0; i < patterns.length; i++) {
      var match = html.match(patterns[i]);
      if (match && match[1]) {
        var val = parseFloat(match[1].replace(/,/g, ''));
        if (!isNaN(val)) return val;
      }
    }

    // Fallback: extract absolute amount and compute vs net profit
    var salaryLabels = ['[Dd]irector[s\']?\\s*[Rr]emuneration', '[Mm]anagerial\\s*[Rr]emuneration'];
    for (var j = 0; j < salaryLabels.length; j++) {
      var rowPattern = new RegExp(salaryLabels[j] + '[\\s\\S]{0,500}?<\\/tr>', 'i');
      var rowMatch = html.match(rowPattern);
      if (rowMatch) {
        var salaryNumbers = _extractRowNumbers(rowMatch[0]);
        if (salaryNumbers.length > 0) {
          var salary = salaryNumbers[salaryNumbers.length - 1];
          var netProfit = _getLatestNetProfit(html);
          if (netProfit && netProfit > 0) {
            return Math.round((Math.abs(salary) / netProfit) * 10000) / 100;
          }
        }
      }
    }

    return null;
  } catch (e) {
    Logger.log('Error extracting promoter salary %: ' + e.message);
    return null;
  }
}

/**
 * Extract all numbers from a table row string.
 *
 * @param {string} rowHtml
 * @returns {number[]}
 */
function _extractRowNumbers(rowHtml) {
  var numbers = [];
  var numPattern = /<td[^>]*>\s*(-?[\d,.]+)\s*<\/td>/g;
  var m;
  while ((m = numPattern.exec(rowHtml)) !== null) {
    var val = parseFloat(m[1].replace(/,/g, ''));
    if (!isNaN(val)) numbers.push(val);
  }
  return numbers;
}

/**
 * Get latest annual revenue from P&L section.
 *
 * @param {string} html
 * @returns {number|null}
 */
function _getLatestRevenue(html) {
  try {
    var plSection = html.match(/(?:Profit\s*&\s*Loss|id="profit-loss")[\s\S]{0,15000}?<\/table>/i);
    if (!plSection) return null;

    var salesMatch = plSection[0].match(/(?:Sales|Revenue)[\s\S]{0,500}?<\/tr>/i);
    if (!salesMatch) return null;

    var numbers = _extractRowNumbers(salesMatch[0]);
    return numbers.length > 0 ? numbers[numbers.length - 1] : null;
  } catch (e) {
    return null;
  }
}

/**
 * Get latest annual net profit from P&L section.
 *
 * @param {string} html
 * @returns {number|null}
 */
function _getLatestNetProfit(html) {
  try {
    var plSection = html.match(/(?:Profit\s*&\s*Loss|id="profit-loss")[\s\S]{0,15000}?<\/table>/i);
    if (!plSection) return null;

    var npMatch = plSection[0].match(/Net\s*[Pp]rofit[\s\S]{0,500}?<\/tr>/i);
    if (!npMatch) return null;

    var numbers = _extractRowNumbers(npMatch[0]);
    return numbers.length > 0 ? numbers[numbers.length - 1] : null;
  } catch (e) {
    return null;
  }
}

// ============================================================================
// HARD EXIT CHECKS (#1-6, #12)
// ============================================================================

/**
 * Check hard exit conditions based on fundamentals.
 * Hard exits require immediate action — sell entire position.
 *
 * @param {string} symbol
 * @param {Object} f - fundamentals from fetchFundamentals()
 * @returns {Object[]} - array of triggered exit objects { rule, detail }
 */
function checkHardExitFundamentals(symbol, f) {
  var triggered = [];

  if (!f) {
    Logger.log('No fundamentals available for hard exit check: ' + symbol);
    return triggered;
  }

  // Hard Exit #1: Promoter holding < 35%
  if (f.promoterHolding !== null && f.promoterHolding < 35) {
    triggered.push({
      rule: 'HARD_EXIT_1',
      detail: 'Promoter holding ' + f.promoterHolding + '% < 35% threshold'
    });
  }

  // Hard Exit #2: Promoter pledge > 30%
  if (f.promoterPledge !== null && f.promoterPledge > 30) {
    triggered.push({
      rule: 'HARD_EXIT_2',
      detail: 'Promoter pledge ' + f.promoterPledge + '% > 30% threshold'
    });
  }

  // Hard Exit #3: Promoter pledge QoQ increase > 2%
  if (f.promoterPledgeChange !== null && f.promoterPledgeChange > 2) {
    triggered.push({
      rule: 'HARD_EXIT_3',
      detail: 'Promoter pledge increased by ' + f.promoterPledgeChange.toFixed(1) +
        '% QoQ (prev: ' + (f.promoterPledgePrev || '?') + '%, now: ' + (f.promoterPledge || '?') + '%)'
    });
  }

  // Hard Exit #4: Debt/Equity > 1.5
  if (f.debtToEquity !== null && f.debtToEquity > 1.5) {
    triggered.push({
      rule: 'HARD_EXIT_4',
      detail: 'Debt/Equity ' + f.debtToEquity + ' > 1.5 threshold'
    });
  }

  // Hard Exit #5: Interest coverage < 1.5
  if (f.interestCoverage !== null && f.interestCoverage < 1.5) {
    triggered.push({
      rule: 'HARD_EXIT_5',
      detail: 'Interest coverage ' + f.interestCoverage + ' < 1.5 threshold'
    });
  }

  // Hard Exit #6: Piotroski score <= 2
  if (f.piotroski !== null && f.piotroski <= 2) {
    triggered.push({
      rule: 'HARD_EXIT_6',
      detail: 'Piotroski score ' + f.piotroski + ' <= 2 (severe fundamental weakness)'
    });
  }

  // Hard Exit #12: Related party transactions > 25% of revenue
  if (f.relatedPartyPct !== null && f.relatedPartyPct > 25) {
    triggered.push({
      rule: 'HARD_EXIT_12',
      detail: 'Related party transactions ' + f.relatedPartyPct + '% of revenue > 25% threshold'
    });
  }

  return triggered;
}

// ============================================================================
// SOFT EXIT CHECKS (#3-10)
// ============================================================================

/**
 * Check soft exit conditions based on fundamentals.
 * Soft exits are warning signals — flag for review, not necessarily immediate sell.
 *
 * @param {string} symbol
 * @param {Object} f - fundamentals from fetchFundamentals()
 * @returns {Object[]} - array of triggered exit objects { rule, detail }
 */
function checkSoftExitFundamentals(symbol, f) {
  var triggered = [];

  if (!f) {
    Logger.log('No fundamentals available for soft exit check: ' + symbol);
    return triggered;
  }

  // Soft Exit #3: Promoter holding decreased > 3% QoQ
  if (f.promoterHoldingChange !== null && f.promoterHoldingChange < -3) {
    triggered.push({
      rule: 'SOFT_EXIT_3',
      detail: 'Promoter holding decreased by ' + Math.abs(f.promoterHoldingChange).toFixed(1) +
        '% QoQ (prev: ' + (f.promoterHoldingPrev || '?') + '%, now: ' + (f.promoterHolding || '?') + '%)'
    });
  }

  // Soft Exit #4: Both FII and MF reduced holdings QoQ
  if (f.fiiChange !== null && f.mfChange !== null && f.fiiChange < 0 && f.mfChange < 0) {
    triggered.push({
      rule: 'SOFT_EXIT_4',
      detail: 'Both FII (' + f.fiiChange.toFixed(1) + '%) and DII/MF (' + f.mfChange.toFixed(1) +
        '%) reduced holdings QoQ'
    });
  }

  // Soft Exit #5: 2 consecutive quarters of negative revenue growth (YoY)
  if (f.revenueGrowthQ1 !== null && f.revenueGrowthQ2 !== null &&
      f.revenueGrowthQ1 < 0 && f.revenueGrowthQ2 < 0) {
    triggered.push({
      rule: 'SOFT_EXIT_5',
      detail: 'Revenue declined 2 consecutive quarters YoY: Q1=' + f.revenueGrowthQ1.toFixed(1) +
        '%, Q2=' + f.revenueGrowthQ2.toFixed(1) + '%'
    });
  }

  // Soft Exit #7: Inventory increased > 40% YoY (without matching revenue growth)
  if (f.inventoryChangeYoY !== null && f.inventoryChangeYoY > 40) {
    var revenueOk = f.salesGrowth !== null && f.salesGrowth >= f.inventoryChangeYoY * 0.5;
    if (!revenueOk) {
      triggered.push({
        rule: 'SOFT_EXIT_7',
        detail: 'Inventory surged ' + f.inventoryChangeYoY.toFixed(1) +
          '% YoY without matching revenue growth (sales growth: ' + (f.salesGrowth || '?') + '%)'
      });
    }
  }

  // Soft Exit #8: Receivables increased > 50% YoY (without matching revenue growth)
  if (f.receivablesChangeYoY !== null && f.receivablesChangeYoY > 50) {
    var revOk = f.salesGrowth !== null && f.salesGrowth >= f.receivablesChangeYoY * 0.5;
    if (!revOk) {
      triggered.push({
        rule: 'SOFT_EXIT_8',
        detail: 'Receivables surged ' + f.receivablesChangeYoY.toFixed(1) +
          '% YoY without matching revenue growth (sales growth: ' + (f.salesGrowth || '?') + '%)'
      });
    }
  }

  // Soft Exit #9: Receivable days > 120
  if (f.receivableDays !== null && f.receivableDays > 120) {
    triggered.push({
      rule: 'SOFT_EXIT_9',
      detail: 'Receivable days ' + f.receivableDays + ' > 120 threshold (collection efficiency concern)'
    });
  }

  // Soft Exit #10: Promoter salary > 5% of net profits
  if (f.promoterSalaryPct !== null && f.promoterSalaryPct > 5) {
    triggered.push({
      rule: 'SOFT_EXIT_10',
      detail: 'Promoter salary/remuneration ' + f.promoterSalaryPct.toFixed(1) +
        '% of net profits > 5% threshold'
    });
  }

  return triggered;
}

// ============================================================================
// QUARTERLY CHECK — MAIN ENTRY POINT
// ============================================================================

// quarterlyFundamentalCheckAll() removed — depended on master DB holdings + SignalEngine.
// Quarterly fundamental checks for per-user holdings can be added to gas-webapp if needed.

/**
 * Store a snapshot of fundamental data in the Stock_Data sheet for audit trail.
 * Creates or updates a row for each symbol with the latest fundamental JSON.
 *
 * @param {string} symbol
 * @param {Object} fundamentals
 */
function _storeFundamentalsSnapshot(symbol, fundamentals) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SCREENER_CONFIG.sheets.stockData);
    if (!sheet) {
      Logger.log('Stock_Data sheet not found, skipping snapshot storage');
      return;
    }

    var lastRow = sheet.getLastRow();
    var found = false;

    // Check if symbol already has a row
    if (lastRow > 1) {
      var symbols = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
      for (var i = 0; i < symbols.length; i++) {
        if (String(symbols[i][0]).trim() === symbol) {
          // Update existing row — store JSON in a fundamentals column
          sheet.getRange(i + 2, _getStockDataFundamentalsCol()).setValue(JSON.stringify(fundamentals));
          sheet.getRange(i + 2, _getStockDataFundamentalsCol() + 1).setValue(new Date());
          found = true;
          break;
        }
      }
    }

    if (!found) {
      // Don't append to Stock_Data — it's a curated list of 5000+ stocks.
      // If symbol not found, just log and skip.
      Logger.log('Symbol ' + symbol + ' not found in Stock_Data, skipping snapshot');
    }
  } catch (e) {
    Logger.log('Error storing fundamentals snapshot for ' + symbol + ': ' + e.message);
  }
}

/**
 * Get the column index for fundamentals JSON in Stock_Data sheet.
 * Returns column 6 (F) by default — adjust if Stock_Data layout differs.
 *
 * @returns {number}
 */
function _getStockDataFundamentalsCol() {
  return 11; // Column K (after existing 10 columns A-J in Stock_Data)
}
