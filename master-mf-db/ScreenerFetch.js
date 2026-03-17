/**
 * ============================================================================
 * SCREENER FETCH — Scrape Screener.in for quarterly fundamental data
 * ============================================================================
 *
 * Fetches fundamental data from Screener.in for active stock holdings.
 * Used by the signal engine to check hard exit (#1-6, #12) and soft exit
 * (#3-10) conditions based on quarterly fundamental changes.
 *
 * Key functions:
 *   fetchFundamentals(symbol) → fundamental data object
 *   checkHardExitFundamentals(symbol, fundamentals) → hard exit signals
 *   checkSoftExitFundamentals(symbol, fundamentals) → soft exit signals
 *   quarterlyFundamentalCheckAll() → iterate all holdings, check fundamentals
 */

var SCREENER_BASE_URL = 'https://www.screener.in/company/';

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
      mfHolding: _extractNumberFromScreener(html, 'DII holding'),
      mfHoldingPrev: _extractPrevQuarterValue(html, 'DII holding'),
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

/**
 * Run quarterly fundamental checks on all active holdings.
 * Fetches fundamentals from Screener.in and creates HARD_EXIT / SOFT_EXIT signals.
 *
 * Call this from a weekly/monthly trigger or manually from Script Editor.
 */
function quarterlyFundamentalCheckAll() {
  Logger.log('========================================');
  Logger.log('Starting quarterly fundamental check...');
  Logger.log('========================================');

  var holdings = _getActiveHoldings();

  if (holdings.length === 0) {
    Logger.log('No active holdings found. Skipping fundamental check.');
    return;
  }

  Logger.log('Checking fundamentals for ' + holdings.length + ' active holdings');

  var results = {
    checked: 0,
    hardExits: 0,
    softExits: 0,
    errors: 0
  };

  for (var i = 0; i < holdings.length; i++) {
    var h = holdings[i];
    var symbol = h.symbol;

    if (!symbol) continue;

    try {
      Logger.log('--- Checking ' + symbol + ' (' + (i + 1) + '/' + holdings.length + ') ---');

      // Fetch fundamentals from Screener.in
      var fundamentals = fetchFundamentals(symbol);

      if (!fundamentals) {
        Logger.log('Could not fetch fundamentals for ' + symbol + ', skipping');
        results.errors++;
        continue;
      }

      results.checked++;

      // Check hard exits
      var hardExits = checkHardExitFundamentals(symbol, fundamentals);
      for (var he = 0; he < hardExits.length; he++) {
        _createSignal({
          type: 'HARD_EXIT',
          symbol: symbol,
          name: h.name,
          amount: (h.currentPrice || 0) * (h.totalShares || 0),
          shares: h.totalShares || 0,
          triggerDetail: '[Fundamental] ' + hardExits[he].rule + ': ' + hardExits[he].detail
        });
        results.hardExits++;
        Logger.log('HARD EXIT triggered for ' + symbol + ': ' + hardExits[he].rule);
      }

      // Check soft exits
      var softExits = checkSoftExitFundamentals(symbol, fundamentals);
      for (var se = 0; se < softExits.length; se++) {
        _createSignal({
          type: 'SOFT_EXIT',
          symbol: symbol,
          name: h.name,
          triggerDetail: '[Fundamental] ' + softExits[se].rule + ': ' + softExits[se].detail
        });
        results.softExits++;
        Logger.log('SOFT EXIT triggered for ' + symbol + ': ' + softExits[se].rule);
      }

      // Store fundamentals JSON in the signal for reference
      if (hardExits.length > 0 || softExits.length > 0) {
        _storeFundamentalsSnapshot(symbol, fundamentals);
      }

    } catch (e) {
      Logger.log('Error checking fundamentals for ' + symbol + ': ' + e.message);
      results.errors++;
    }

    // Rate limiting: 500ms delay between requests to Screener.in
    if (i < holdings.length - 1) {
      Utilities.sleep(500);
    }
  }

  Logger.log('========================================');
  Logger.log('Quarterly fundamental check complete.');
  Logger.log('Checked: ' + results.checked + '/' + holdings.length);
  Logger.log('Hard exits: ' + results.hardExits);
  Logger.log('Soft exits: ' + results.softExits);
  Logger.log('Errors: ' + results.errors);
  Logger.log('========================================');
}

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
