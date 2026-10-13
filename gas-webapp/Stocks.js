/**
 * ============================================================================
 * STOCKS.GS - Stock Portfolio Management
 * ============================================================================
 * Handles stock portfolios, transactions, holdings, and master data management
 * Last Updated: 2025-10-25 - Fixed portfolio loading and added Fuse.js search
 */

// ============================================================================
// STOCK MASTER DATA
// ============================================================================
// Note: Stock data is copied from Master Database during setup
// and refreshed daily via dailyUserSync trigger

// ============================================================================
// STOCK SEARCH
// ============================================================================

/**
 * Search stocks by company name or symbol
 * Returns array of matching stocks
 */
function searchStocks(query) {
  try {
    if (!query || query.trim() === '') {
      return [];
    }

    const sheet = getSheet(CONFIG.stockMasterDataSheet);
    if (!sheet) {
      throw new Error('StockMasterData sheet not found');
    }

    const lastRow = sheet.getLastRow();
    if (lastRow <= 2) {
      return [];
    }

    // Get all stock data (columns A-J)
    const data = sheet.getRange(3, 1, lastRow - 2, 10).getValues();

    const searchTerm = query.toLowerCase().trim();
    const results = [];

    data.forEach(row => {
      const symbol = row[0] ? row[0].toString().toLowerCase() : '';
      const companyName = row[2] ? row[2].toString().toLowerCase() : '';
      const status = row[8] ? row[8].toString() : '';

      // Skip inactive/delisted stocks
      if (status !== 'Active') return;

      // Match on symbol or company name
      if (symbol.includes(searchTerm) || companyName.includes(searchTerm)) {
        results.push({
          symbol: row[0],              // A: Symbol
          bseCode: row[1],             // B: BSE Code
          companyName: row[2],         // C: Company Name
          exchange: row[3],            // D: Exchange
          gfNSE: row[4],               // E: Google Finance NSE
          gfBSE: row[5],               // F: Google Finance BSE
          sector: row[6],              // G: Sector
          industry: row[7],            // H: Industry
          status: row[8],              // I: Status
          isin: row[9]                 // J: ISIN
        });
      }
    });

    // Sort by relevance (exact symbol match first, then alphabetically)
    results.sort((a, b) => {
      const aSymbol = a.symbol.toLowerCase();
      const bSymbol = b.symbol.toLowerCase();

      // Exact match first
      if (aSymbol === searchTerm && bSymbol !== searchTerm) return -1;
      if (bSymbol === searchTerm && aSymbol !== searchTerm) return 1;

      // Starts with search term
      if (aSymbol.startsWith(searchTerm) && !bSymbol.startsWith(searchTerm)) return -1;
      if (bSymbol.startsWith(searchTerm) && !aSymbol.startsWith(searchTerm)) return 1;

      // Alphabetical
      return a.companyName.localeCompare(b.companyName);
    });

    // Return top 50 results
    return results.slice(0, 50);

  } catch (error) {
    log('Error searching stocks: ' + error.toString());
    return [];
  }
}

/**
 * Get ALL stocks for client-side search (Fuse.js)
 * Returns all active NSE stocks for local fuzzy search
 */
function getAllStocksForClientSearch() {
  try {
    const sheet = getSheet(CONFIG.stockMasterDataSheet);
    if (!sheet) {
      log('StockMasterData sheet not found');
      return [];
    }

    const lastRow = sheet.getLastRow();
    if (lastRow <= 2) {
      log('No stock data available');
      return [];
    }

    // Get all stock data (columns A-J)
    const data = sheet.getRange(3, 1, lastRow - 2, 10).getValues();

    const stocks = [];

    data.forEach(row => {
      const status = row[8] ? row[8].toString() : '';

      // Skip inactive/delisted stocks
      if (status !== 'Active') return;

      stocks.push({
        symbol: row[0],              // A: Symbol
        bseCode: row[1],             // B: BSE Code
        companyName: row[2],         // C: Company Name
        exchange: row[3],            // D: Exchange
        gfNSE: row[4],               // E: Google Finance NSE
        gfBSE: row[5],               // F: Google Finance BSE
        sector: row[6],              // G: Sector
        industry: row[7],            // H: Industry
        status: row[8],              // I: Status
        isin: row[9]                 // J: ISIN
      });
    });

    log(`Returning ${stocks.length} active stocks for client search`);
    return stocks;

  } catch (error) {
    log('Error getting all stocks for client search: ' + error.toString());
    return [];
  }
}

/**
 * Get stock details by symbol
 */
function getStockBySymbol(symbol) {
  try {
    if (!symbol) return null;

    const sheet = getSheet(CONFIG.stockMasterDataSheet);
    if (!sheet) return null;

    const lastRow = sheet.getLastRow();
    if (lastRow <= 2) return null;

    const data = sheet.getRange(3, 1, lastRow - 2, 10).getValues();

    for (let i = 0; i < data.length; i++) {
      if (data[i][0] && data[i][0].toString().toUpperCase() === symbol.toUpperCase()) {
        return {
          symbol: data[i][0],
          bseCode: data[i][1],
          companyName: data[i][2],
          exchange: data[i][3],
          gfNSE: data[i][4],
          gfBSE: data[i][5],
          sector: data[i][6],
          industry: data[i][7],
          status: data[i][8],
          isin: data[i][9],
          currency: 'INR'
        };
      }
    }

    // not in the list: a direct Google Finance symbol (NASDAQ:AAPL, LON:VOD, BOM:517015 …)
    if (normDirect_(symbol)) return getDirectStock_(symbol);
    return null;

  } catch (error) {
    log('Error getting stock by symbol: ' + error.toString());
    return null;
  }
}


// ============================================================================
// STOCKS FROM ANY EXCHANGE (direct Google Finance symbols)
// Indian stocks normally come from the stock list (NSE rows and BSE-only rows). Anything else is written
// the Google Finance way, EXCHANGE:TICKER: NASDAQ:AAPL, NYSE:KO, NYSEARCA:VOO, LON:VOD, TYO:7203 … and
// also BOM:517015 / NSE:XYZ for an Indian stock that is not in the list yet.
// Every amount in the sheets stays in rupees: a foreign buy price is saved in ₹ (price × that currency's
// rupee rate on the buy date), and the live price formula is GOOGLEFINANCE(ticker) × the rate today. So
// values, P&L, net worth, goals and the email work as for Indian stocks (P&L includes the rupee's move).
// ============================================================================
var DIRECT_SYMBOL_RE_ = /^([A-Z]{2,14}):([A-Z0-9][A-Z0-9.\-&]{0,19})$/;
var INDIAN_EXCHANGES_ = { NSE: 1, BOM: 1, BSE: 1 };
var US_EXCHANGES_ = { NASDAQ: 1, NYSE: 1, NYSEARCA: 1, NYSEAMERICAN: 1, NYSEMKT: 1, BATS: 1, CBOE: 1 };
// quoted in 1/100 of the currency (London pence, Johannesburg cents, Tel Aviv agorot)
var MINOR_CCY_ = { GBX: 'GBP', GBp: 'GBP', ZAC: 'ZAR', ZAc: 'ZAR', ILA: 'ILS' };

function normDirect_(symbol) {
  var s = String(symbol || '').trim().toUpperCase();
  if (/^BSE:\d{6}$/.test(s)) s = 'BOM:' + s.slice(4);
  return DIRECT_SYMBOL_RE_.test(s) ? s : '';
}
function directExchange_(symbol) { var s = normDirect_(symbol); return s ? s.split(':')[0] : ''; }
/** A foreign (non-Indian) symbol, e.g. NASDAQ:AAPL or LON:VOD. */
function isForeignSymbol_(symbol) { var ex = directExchange_(symbol); return !!ex && !INDIAN_EXCHANGES_[ex]; }
// kept for older callers
function isUsSymbol_(symbol) { return !!US_EXCHANGES_[directExchange_(symbol)]; }

/** Formula for "1 unit of this currency in ₹" (blank/INR → 1). Pence-style currencies are divided by 100. */
function fxFormula_(currency, dateExpr) {
  var c = String(currency || 'INR');
  var minor = MINOR_CCY_[c] || MINOR_CCY_[c.toUpperCase()];
  var base = (minor || c).toUpperCase();
  if (base === 'INR') return minor ? '0.01' : '1';
  var div = minor ? '/100' : '';
  if (!dateExpr) return 'GOOGLEFINANCE("CURRENCY:' + base + 'INR")' + div;
  var hist = 'GOOGLEFINANCE("CURRENCY:' + base + 'INR", "price", ' + dateExpr + '-6, ' + dateExpr + ')';
  return 'INDEX(' + hist + ', ROWS(' + hist + '), 2)' + div; // last close on or before that day
}
function sheetDate_(d) { return 'DATE(' + d.getFullYear() + ',' + (d.getMonth() + 1) + ',' + d.getDate() + ')'; }

/** Live ₹ price formula for a holding. */
function priceFormulaFor_(gfSymbol, currency) {
  if (!currency && isForeignSymbol_(gfSymbol)) // currency not known here: let the sheet ask Google Finance
    return '=IFERROR(GOOGLEFINANCE("' + gfSymbol + '", "price")*GOOGLEFINANCE("CURRENCY:"&GOOGLEFINANCE("' + gfSymbol + '", "currency")&"INR"), 0)';
  var fx = fxFormula_(currency);
  return '=IFERROR(GOOGLEFINANCE("' + gfSymbol + '", "price")' + (fx === '1' ? '' : '*' + fx) + ', 0)';
}
// kept for older callers
function usPriceFormula_(gfSymbol) { return priceFormulaFor_(gfSymbol, 'USD'); }

/** Several GOOGLEFINANCE values at once through temp cells (they work only as formulas). */
function gfValues_(formulas) {
  if (!formulas.length) return [];
  var sheet = getSheet(CONFIG.settingsSheet);
  if (!sheet) return formulas.map(function () { return ''; });
  var range = sheet.getRange(1, 26, formulas.length, 1); // Z1:Z…, far from the settings
  range.setFormulas(formulas.map(function (f) { return [f]; }));
  flushSheets_();
  var vals = range.getValues().map(function (r) { return r[0]; });
  range.clearContent();
  return vals;
}

/**
 * Quotes for direct symbols in one go (cached 6 h): name, price in its own currency, the currency,
 * today's rupee rate and ₹ price.  dates (optional): { SYMBOL: 'yyyy-mm-dd' } → fxOnDate for that day.
 * @returns {Object} { SYMBOL: { valid, symbol, companyName, currency, priceLocal, fx, fxOnDate, price, exchange, error? } }
 */
function getQuotes_(symbols, dates) {
  var cache = CacheService.getScriptCache(), out = {}, todo = [];
  dates = dates || {};
  (symbols || []).forEach(function (raw) {
    var sym = normDirect_(raw);
    if (!sym || out[sym]) return;
    var d = dates[raw] || dates[sym] || '';
    var hit = cache.get('gq2:' + sym + ':' + d);
    if (hit) out[sym] = JSON.parse(hit); else todo.push({ sym: sym, d: d });
  });
  // pass 1: name, price, currency
  var f1 = [];
  todo.forEach(function (t) {
    f1.push('=IFERROR(GOOGLEFINANCE("' + t.sym + '", "name"), "")', '=IFERROR(GOOGLEFINANCE("' + t.sym + '", "price"), 0)', '=IFERROR(GOOGLEFINANCE("' + t.sym + '", "currency"), "")');
  });
  var v1 = gfValues_(f1);
  // pass 2: rupee rates (today and on the date) for the currencies found
  var f2 = [];
  todo.forEach(function (t, i) {
    var ex = t.sym.split(':')[0];
    t.name = String(v1[i * 3] || ''); t.priceLocal = Number(v1[i * 3 + 1]) || 0;
    t.currency = String(v1[i * 3 + 2] || '') || (INDIAN_EXCHANGES_[ex] ? 'INR' : US_EXCHANGES_[ex] ? 'USD' : '');
    var dd = t.d ? new Date(t.d) : null;
    t.fxAt = f2.length; f2.push('=IFERROR(' + fxFormula_(t.currency) + ', 0)');
    if (dd && !isNaN(dd.getTime())) { t.fxDateAt = f2.length; f2.push('=IFERROR(' + fxFormula_(t.currency, sheetDate_(dd)) + ', 0)'); }
  });
  var v2 = gfValues_(f2);
  todo.forEach(function (t) {
    var ex = t.sym.split(':')[0];
    var fx = Number(v2[t.fxAt]) || 0;
    var fxOnDate = t.fxDateAt !== undefined ? (Number(v2[t.fxDateAt]) || fx) : fx;
    var q = {
      valid: t.priceLocal > 0 && fx > 0, symbol: t.sym, companyName: t.name || t.sym.split(':')[1],
      currency: t.currency, priceLocal: t.priceLocal, fx: fx, fxOnDate: fxOnDate, price: t.priceLocal * fx,
      exchange: INDIAN_EXCHANGES_[ex] ? (ex === 'NSE' ? 'NSE' : 'BSE') : US_EXCHANGES_[ex] ? 'US' : ex,
      sector: INDIAN_EXCHANGES_[ex] ? '' : US_EXCHANGES_[ex] ? 'US equity' : 'Foreign equity'
    };
    if (!q.valid) q.error = 'Google Finance has no price for ' + t.sym + '. Check the exchange and ticker.';
    out[t.sym] = q;
    try { cache.put('gq2:' + t.sym + ':' + t.d, JSON.stringify(q), q.valid ? 21600 : 600); } catch (e) { /* ignore */ }
  });
  return out;
}

/**
 * Look up one direct symbol (any exchange). Same answer shape as before plus currency / priceLocal;
 * priceUsd is kept for US symbols (older screens read it).
 */
function getQuote(symbol, date) {
  var sym = normDirect_(symbol);
  if (!sym) return { valid: false, symbol: String(symbol || ''), error: 'Write it as EXCHANGE:TICKER, e.g. NASDAQ:AAPL or LON:VOD' };
  var dates = {}; if (date) dates[sym] = String(date).slice(0, 10);
  var q = getQuotes_([sym], dates)[sym];
  if (q && q.currency === 'USD') q.priceUsd = q.priceLocal;
  return q;
}
// kept for older callers (the 'stock:us-quote' action)
function getUsQuote(symbol, date) { return getQuote(symbol, date); }

/** A direct symbol as a stock record (same shape as a master-data stock), or null when it has no price. */
function getDirectStock_(symbol) {
  var q = getQuote(symbol);
  if (!q || !q.valid) return null;
  var indian = !isForeignSymbol_(q.symbol);
  return {
    symbol: q.symbol, bseCode: '', companyName: q.companyName, exchange: q.exchange,
    gfNSE: indian && q.exchange === 'NSE' ? q.symbol : (indian ? '' : q.symbol), gfBSE: indian && q.exchange === 'BSE' ? q.symbol : '',
    sector: q.sector, industry: '', status: 'Active', isin: '', currency: q.currency
  };
}
function getUsStock_(symbol) { return getDirectStock_(symbol); }

/**
 * Get current stock price using GOOGLEFINANCE via a temp cell.
 * @param {string} gfSymbol - Google Finance symbol (e.g., "NSE:RELIANCE")
 * @returns {number} Current price or 0 if unavailable
 */
function getStockPrice(gfSymbol) {
  try {
    if (!gfSymbol) return 0;

    var sheet = getSheet(CONFIG.settingsSheet);
    if (!sheet) return 0;

    // Use cell Z1 as temp cell (far from settings data)
    var cell = sheet.getRange('Z1');
    cell.setFormula('=IFERROR(GOOGLEFINANCE("' + gfSymbol + '", "price"), 0)');
    flushSheets_();
    var price = cell.getValue();
    cell.clearContent();

    return typeof price === 'number' ? price : 0;
  } catch (e) {
    log('getStockPrice error: ' + e.toString());
    return 0;
  }
}

/**
 * Get stock price by symbol (looks up gfNSE symbol, then fetches price).
 * Called from frontend after user selects a stock.
 * @param {string} symbol - Stock symbol (e.g., "RELIANCE")
 * @returns {Object} { symbol, price }
 */
function fetchStockPrice(symbol) {
  var stock = getStockBySymbol(symbol);
  if (!stock) return { symbol: symbol, price: 0 };

  var gfSymbol = stock.gfNSE || stock.gfBSE || '';
  if (isForeignSymbol_(gfSymbol)) {
    var q = getQuote(gfSymbol);
    return { symbol: stock.symbol, price: q.price || 0, priceLocal: q.priceLocal || 0, currency: q.currency, fx: q.fx || 0, priceUsd: q.currency === 'USD' ? q.priceLocal : 0, companyName: q.companyName, valid: q.valid };
  }
  var price = getStockPrice(gfSymbol);
  if (!(price > 0) && stock.gfNSE && stock.gfBSE) price = getStockPrice(stock.gfBSE); // no NSE price: try BSE

  return { symbol: stock.symbol, price: price, currency: 'INR' };
}

// ============================================================================
// STOCK PORTFOLIOS
// ============================================================================

/**
 * Get all stock portfolios
 */
function getAllStockPortfolios(strict) {
  try {
    log('getAllStockPortfolios() called');

    const sheet = getSheet(CONFIG.stockPortfoliosSheet);
    if (!sheet) {
      log('ERROR: StockPortfolios sheet not found');
      return [];
    }

    log('StockPortfolios sheet found');

    const lastRow = sheet.getLastRow();
    log('Last row: ' + lastRow);

    // StockPortfolios has only 1 header row (row 2), so data starts at row 3
    if (lastRow < 3) {
      log('No portfolios data (lastRow < 3), returning empty array');
      return [];
    }

    const data = sheet.getRange(3, 1, lastRow - 2, 14).getValues();
    log('Data rows read: ' + data.length);
    log('First row data: ' + JSON.stringify(data[0]));

    const portfolios = [];

    data.forEach((row, index) => {
      log(`Row ${index}: Portfolio ID = ${row[0]}, Name = ${row[1]}, Status = ${row[12]}`);
      if (row[0]) { // Has Portfolio ID
        portfolios.push({
          portfolioId: row[0],              // A
          portfolioName: row[1],            // B
          investmentAccountId: row[2],       // C (stores account ID like IA-001)
          investmentAccountName: '',        // Not stored — resolved via investmentAccountId lookup
          ownerId: row[3],                  // D (stores member ID like FM-001)
          ownerName: '',                    // Not stored — resolved via ownerId lookup
          totalInvestment: row[4],          // E
          currentValue: row[5],             // F
          unrealizedPL: row[6],             // G
          unrealizedPLPct: row[7],          // H
          realizedPL: row[8],               // I
          realizedPLPct: row[9],            // J
          totalPL: row[10],                 // K
          totalPLPct: row[11],              // L
          status: row[12],                  // M
          createdDate: row[13] ? row[13].toString() : ''  // N - Convert Date to String
        });
        log(`Portfolio added: ${row[0]} - ${row[1]}`);
      } else {
        log(`Row ${index} skipped - no Portfolio ID`);
      }
    });

    log('Returning ' + portfolios.length + ' stock portfolios');
    return portfolios;

  } catch (error) {
    log('Error getting stock portfolios: ' + error.toString());
    if (strict) throw error; // app load: report the failed read instead of "no portfolios"
    return [];
  }
}

/** For loadAllData: a failed read is reported (in _errors), not shown as "no portfolios". */
function getAllStockPortfoliosStrict_() {
  return getAllStockPortfolios(true);
}

/**
 * Get active stock portfolios only (for dropdowns)
 * Returns only essential fields to avoid serialization issues
 */
function getActiveStockPortfolios() {
  try {
    Logger.log('getActiveStockPortfolios called');

    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName('StockPortfolios');

    if (!sheet) {
      Logger.log('StockPortfolios sheet not found');
      return [];
    }

    const lastRow = sheet.getLastRow();
    Logger.log('Last row: ' + lastRow);

    if (lastRow < 3) {
      Logger.log('No data rows (lastRow < 3)');
      return [];
    }

    // Read only first 5 columns to avoid formula issues
    const data = sheet.getRange(3, 1, lastRow - 2, 5).getValues();
    Logger.log('Read ' + data.length + ' rows');

    // Get status from column M (13th column)
    const statusData = sheet.getRange(3, 13, lastRow - 2, 1).getValues();

    const activePortfolios = [];

    data.forEach((row, idx) => {
      const status = statusData[idx][0];
      Logger.log('Row ' + (idx + 3) + ': ID=' + row[0] + ', Name=' + row[1] + ', Status=' + status);

      if (row[0] && status === 'Active') {
        const portfolio = {
          portfolioId: String(row[0]),           // A - Convert to string
          portfolioName: String(row[1]),         // B - Convert to string
          investmentAccount: String(row[2]),     // C - Convert to string
          owner: String(row[3]),                 // D - Convert to string
          status: 'Active'
        };
        activePortfolios.push(portfolio);
        Logger.log('Added: ' + JSON.stringify(portfolio));
      }
    });

    Logger.log('Returning ' + activePortfolios.length + ' portfolios');
    Logger.log('Result: ' + JSON.stringify(activePortfolios));
    return activePortfolios;

  } catch (error) {
    Logger.log('ERROR: ' + error.toString());
    Logger.log('Stack: ' + error.stack);
    return [];
  }
}

/**
 * Generate next stock portfolio ID
 */
function generateStockPortfolioId() {
  const portfolios = getAllStockPortfolios();
  const existingIds = portfolios.map(p => p.portfolioId);
  return generateId('PFL-STK', existingIds);
}

/**
 * Create a new stock portfolio
 */
function createStockPortfolio(portfolioName, investmentAccount, owner) {
  try {
    if (!portfolioName || portfolioName.trim() === '') {
      throw new Error('Portfolio name is required');
    }

    if (!investmentAccount || investmentAccount.trim() === '') {
      throw new Error('Investment account is required');
    }

    if (!owner || owner.trim() === '') {
      throw new Error('Owner is required');
    }

    const sheet = getSheet(CONFIG.stockPortfoliosSheet);
    if (!sheet) {
      throw new Error('StockPortfolios sheet not found');
    }

    const portfolioId = generateStockPortfolioId();
    const createdDate = new Date();

    // Formulas for P&L calculations (will calculate after transactions are added)
    const totalInvestmentFormula = `=SUMIFS(StockTransactions!$N:$N, StockTransactions!$B:$B, A${sheet.getLastRow() + 1}, StockTransactions!$H:$H, "BUY") - SUMIFS(StockTransactions!$N:$N, StockTransactions!$B:$B, A${sheet.getLastRow() + 1}, StockTransactions!$H:$H, "SELL")`;
    const currentValueFormula = `=SUMIFS(StockHoldings!$K:$K, StockHoldings!$A:$A, A${sheet.getLastRow() + 1})`;
    const unrealizedPLFormula = `=F${sheet.getLastRow() + 1} - E${sheet.getLastRow() + 1}`;
    const unrealizedPLPctFormula = `=IF(E${sheet.getLastRow() + 1}>0, G${sheet.getLastRow() + 1}/E${sheet.getLastRow() + 1}, 0)`;
    const realizedPLFormula = `=SUMIFS(StockTransactions!$P:$P, StockTransactions!$B:$B, A${sheet.getLastRow() + 1})`;
    const realizedPLPctFormula = `=IF(E${sheet.getLastRow() + 1}>0, I${sheet.getLastRow() + 1}/E${sheet.getLastRow() + 1}, 0)`;
    const totalPLFormula = `=G${sheet.getLastRow() + 1} + I${sheet.getLastRow() + 1}`;
    const totalPLPctFormula = `=IF(E${sheet.getLastRow() + 1}>0, K${sheet.getLastRow() + 1}/E${sheet.getLastRow() + 1}, 0)`;

    sheet.appendRow([
      portfolioId,                  // A: Portfolio ID
      portfolioName,                // B: Portfolio Name
      investmentAccount,            // C: Investment Account
      owner,                        // D: Owner
      totalInvestmentFormula,       // E: Total Investment ₹ (formula)
      currentValueFormula,          // F: Current Value ₹ (formula)
      unrealizedPLFormula,          // G: Unrealized P&L ₹ (formula)
      unrealizedPLPctFormula,       // H: Unrealized P&L % (formula)
      realizedPLFormula,            // I: Realized P&L ₹ (formula)
      realizedPLPctFormula,         // J: Realized P&L % (formula)
      totalPLFormula,               // K: Total P&L ₹ (formula)
      totalPLPctFormula,            // L: Total P&L % (formula)
      'Active',                     // M: Status
      createdDate                   // N: Created Date
    ]);

    log(`Stock portfolio created: ${portfolioId} - ${portfolioName}`);

    return {
      success: true,
      portfolioId: portfolioId,
      portfolioName: portfolioName
    };

  } catch (error) {
    log('Error creating stock portfolio: ' + error.toString());
    return {
      success: false,
      error: error.message
    };
  }
}

// ============================================================================
// STOCK TRANSACTIONS
// ============================================================================

/**
 * Buy stocks - adds transaction and updates holdings
 */
function buyStock(portfolioId, stockSymbol, quantity, pricePerShare, transactionDate, brokerage, notes) {
  try {
    // Validate inputs
    if (!portfolioId) throw new Error('Portfolio ID is required');
    if (!stockSymbol) throw new Error('Stock symbol is required');
    if (!quantity || quantity <= 0) throw new Error('Quantity must be greater than 0');
    if (!pricePerShare || pricePerShare <= 0) throw new Error('Price must be greater than 0');
    if (!transactionDate) throw new Error('Transaction date is required');

    // Convert date string to Date object if needed
    if (typeof transactionDate === 'string') {
      transactionDate = new Date(transactionDate);
    }

    // Get stock details
    const stock = getStockBySymbol(stockSymbol);
    if (!stock) {
      throw new Error(`Stock not found: ${stockSymbol}`);
    }

    // Get portfolio details
    const portfolios = getAllStockPortfolios();
    const portfolio = portfolios.find(p => p.portfolioId === portfolioId);
    if (!portfolio) {
      throw new Error(`Portfolio not found: ${portfolioId}`);
    }

    const transactionsSheet = getSheet(CONFIG.stockTransactionsSheet);
    if (!transactionsSheet) {
      throw new Error('StockTransactions sheet not found');
    }

    // Generate transaction ID
    const lastRow = transactionsSheet.getLastRow();
    const existingIds = lastRow > 2
      ? transactionsSheet.getRange(3, 1, lastRow - 2, 1).getValues().flat()
      : [];
    const transactionId = generateId('TXN-STK', existingIds);

    // Calculate amounts
    const totalAmount = quantity * pricePerShare;
    const brokerageAmount = brokerage || 0;
    const netAmount = totalAmount + brokerageAmount;

    // Determine which Google Finance symbol to use (prefer NSE)
    const gfSymbol = stock.gfNSE || stock.gfBSE || '';

    // Add transaction
    transactionsSheet.appendRow([
      transactionId,                // A: Transaction ID
      portfolioId,                  // B: Portfolio ID
      portfolio.portfolioName,      // C: Portfolio Name
      stock.symbol,                 // D: Stock Symbol
      stock.companyName,            // E: Company Name
      stock.exchange,               // F: Exchange
      gfSymbol,                     // G: Google Finance Symbol
      'BUY',                        // H: Transaction Type
      transactionDate,              // I: Date
      quantity,                     // J: Quantity
      pricePerShare,                // K: Price per Share ₹
      totalAmount,                  // L: Total Amount ₹
      brokerageAmount,              // M: Brokerage ₹
      netAmount,                    // N: Net Amount ₹
      notes || '',                  // O: Notes
      ''                            // P: Realized P&L ₹ (blank for BUY)
    ]);

    log(`Stock purchased: ${transactionId} - ${quantity} shares of ${stockSymbol} @ ₹${pricePerShare}`);

    // Update holdings
    recalculateStockHoldings(portfolioId, stockSymbol);

    return {
      success: true,
      transactionId: transactionId,
      message: `Successfully purchased ${quantity} shares of ${stock.companyName} (${stockSymbol})`
    };

  } catch (error) {
    log('Error buying stock: ' + error.toString());
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Sell stocks - adds transaction with FIFO P&L calculation and updates holdings
 */
function sellStock(portfolioId, stockSymbol, quantity, pricePerShare, transactionDate, brokerage, notes) {
  try {
    // Validate inputs
    if (!portfolioId) throw new Error('Portfolio ID is required');
    if (!stockSymbol) throw new Error('Stock symbol is required');
    if (!quantity || quantity <= 0) throw new Error('Quantity must be greater than 0');
    if (!pricePerShare || pricePerShare <= 0) throw new Error('Price must be greater than 0');
    if (!transactionDate) throw new Error('Transaction date is required');

    // Convert date string to Date object if needed
    if (typeof transactionDate === 'string') {
      transactionDate = new Date(transactionDate);
    }

    // Get stock details
    const stock = getStockBySymbol(stockSymbol);
    if (!stock) {
      throw new Error(`Stock not found: ${stockSymbol}`);
    }

    // Get portfolio details
    const portfolios = getAllStockPortfolios();
    const portfolio = portfolios.find(p => p.portfolioId === portfolioId);
    if (!portfolio) {
      throw new Error(`Portfolio not found: ${portfolioId}`);
    }

    // Check current holdings
    const holdingsSheet = getSheet(CONFIG.stockHoldingsSheet);
    if (!holdingsSheet) {
      throw new Error('StockHoldings sheet not found');
    }

    const holdingsLastRow = holdingsSheet.getLastRow();
    let currentHolding = null;

    if (holdingsLastRow > 2) {
      const holdingsData = holdingsSheet.getRange(3, 1, holdingsLastRow - 2, 15).getValues();
      currentHolding = holdingsData.find(row =>
        row[0] === portfolioId && row[2] === stockSymbol
      );
    }

    if (!currentHolding) {
      throw new Error(`You don't own any shares of ${stockSymbol} in this portfolio`);
    }

    const availableQuantity = currentHolding[6]; // Column G: Total Quantity
    if (quantity > availableQuantity) {
      throw new Error(`Insufficient shares. Available: ${availableQuantity}, Requested: ${quantity}`);
    }

    // Calculate FIFO-based realized P&L
    const transactionsSheet = getSheet(CONFIG.stockTransactionsSheet);
    if (!transactionsSheet) {
      throw new Error('StockTransactions sheet not found');
    }

    const transLastRow = transactionsSheet.getLastRow();
    const transactions = transLastRow > 2
      ? transactionsSheet.getRange(3, 1, transLastRow - 2, 16).getValues()
      : [];

    // Get all BUY transactions for this stock in this portfolio (sorted by date)
    const buyTransactions = transactions
      .filter(row =>
        row[1] === portfolioId &&
        row[3] === stockSymbol &&
        row[7] === 'BUY'
      )
      .map(row => ({
        date: row[8],
        quantity: row[9],
        pricePerShare: row[10]
      }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    // Calculate FIFO cost basis
    let remainingToSell = quantity;
    let totalCostBasis = 0;

    for (const buy of buyTransactions) {
      if (remainingToSell <= 0) break;

      const qtyFromThisBuy = Math.min(remainingToSell, buy.quantity);
      totalCostBasis += qtyFromThisBuy * buy.pricePerShare;
      remainingToSell -= qtyFromThisBuy;
    }

    const avgCostBasis = totalCostBasis / quantity;
    const saleAmount = quantity * pricePerShare;
    const brokerageAmount = brokerage || 0;
    const netSaleAmount = saleAmount - brokerageAmount;
    const realizedPL = netSaleAmount - totalCostBasis;

    // Generate transaction ID
    const existingIds = transLastRow > 2
      ? transactionsSheet.getRange(3, 1, transLastRow - 2, 1).getValues().flat()
      : [];
    const transactionId = generateId('TXN-STK', existingIds);

    // Determine which Google Finance symbol to use
    const gfSymbol = stock.gfNSE || stock.gfBSE || '';

    // Add SELL transaction
    transactionsSheet.appendRow([
      transactionId,                // A: Transaction ID
      portfolioId,                  // B: Portfolio ID
      portfolio.portfolioName,      // C: Portfolio Name
      stock.symbol,                 // D: Stock Symbol
      stock.companyName,            // E: Company Name
      stock.exchange,               // F: Exchange
      gfSymbol,                     // G: Google Finance Symbol
      'SELL',                       // H: Transaction Type
      transactionDate,              // I: Date
      quantity,                     // J: Quantity
      pricePerShare,                // K: Price per Share ₹
      saleAmount,                   // L: Total Amount ₹
      brokerageAmount,              // M: Brokerage ₹
      netSaleAmount,                // N: Net Amount ₹
      notes || '',                  // O: Notes
      realizedPL                    // P: Realized P&L ₹ (FIFO calculation)
    ]);

    log(`Stock sold: ${transactionId} - ${quantity} shares of ${stockSymbol} @ ₹${pricePerShare}, Realized P&L: ₹${realizedPL.toFixed(2)}`);

    // Update holdings
    recalculateStockHoldings(portfolioId, stockSymbol);

    return {
      success: true,
      transactionId: transactionId,
      realizedPL: realizedPL,
      message: `Successfully sold ${quantity} shares of ${stock.companyName} (${stockSymbol}). Realized P&L: ₹${realizedPL.toFixed(2)}`
    };

  } catch (error) {
    log('Error selling stock: ' + error.toString());
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Edit a stock transaction — updates date, quantity, price, brokerage, notes
 * then recalculates holdings
 */
function editStockTransaction(transactionId, data) {
  try {
    if (!transactionId) throw new Error('Transaction ID is required');

    var sheet = getSheet(CONFIG.stockTransactionsSheet);
    if (!sheet) throw new Error('StockTransactions sheet not found');

    var lastRow = sheet.getLastRow();
    if (lastRow < 3) throw new Error('Transaction not found');

    var rows = sheet.getRange(3, 1, lastRow - 2, 16).getValues();
    var rowIndex = -1;
    for (var i = 0; i < rows.length; i++) {
      if (rows[i][0] === transactionId) { rowIndex = i; break; }
    }
    if (rowIndex < 0) throw new Error('Transaction not found: ' + transactionId);

    var sheetRow = rowIndex + 3;
    var row = rows[rowIndex];
    var portfolioId = row[1];
    var symbol = row[3];

    // Update editable fields
    var date = data.date ? new Date(data.date) : row[8];
    var quantity = data.quantity ? parseFloat(data.quantity) : row[9];
    var price = data.pricePerShare ? parseFloat(data.pricePerShare) : row[10];
    var brokerage = data.brokerage !== undefined ? parseFloat(data.brokerage) || 0 : row[12];
    var notes = data.notes !== undefined ? data.notes : row[14];

    if (quantity <= 0) throw new Error('Quantity must be > 0');
    if (price <= 0) throw new Error('Price must be > 0');

    var totalAmount = quantity * price;
    var type = row[7]; // BUY or SELL
    var netAmount = type === 'BUY' ? totalAmount + brokerage : totalAmount - brokerage;

    // Write updated values
    sheet.getRange(sheetRow, 9).setValue(date);           // I: Date
    sheet.getRange(sheetRow, 10).setValue(quantity);       // J: Quantity
    sheet.getRange(sheetRow, 11).setValue(price);          // K: Price
    sheet.getRange(sheetRow, 12).setValue(totalAmount);    // L: Total Amount
    sheet.getRange(sheetRow, 13).setValue(brokerage);      // M: Brokerage
    sheet.getRange(sheetRow, 14).setValue(netAmount);      // N: Net Amount
    sheet.getRange(sheetRow, 15).setValue(notes);          // O: Notes

    log('Stock transaction edited: ' + transactionId);

    // Recalculate holdings
    recalculateStockHoldings(portfolioId, symbol);

    return { success: true, message: 'Transaction updated' };
  } catch (error) {
    log('Error editing stock transaction: ' + error.toString());
    return { success: false, error: error.message };
  }
}

/**
 * Delete a stock transaction and recalculate holdings
 */
function deleteStockTransaction(transactionId) {
  try {
    if (!transactionId) throw new Error('Transaction ID is required');

    var sheet = getSheet(CONFIG.stockTransactionsSheet);
    if (!sheet) throw new Error('StockTransactions sheet not found');

    var lastRow = sheet.getLastRow();
    if (lastRow < 3) throw new Error('Transaction not found');

    var rows = sheet.getRange(3, 1, lastRow - 2, 16).getValues();
    var rowIndex = -1;
    for (var i = 0; i < rows.length; i++) {
      if (rows[i][0] === transactionId) { rowIndex = i; break; }
    }
    if (rowIndex < 0) throw new Error('Transaction not found: ' + transactionId);

    var portfolioId = rows[rowIndex][1];
    var symbol = rows[rowIndex][3];

    // Delete the row
    sheet.deleteRow(rowIndex + 3);

    log('Stock transaction deleted: ' + transactionId);

    // Recalculate holdings
    recalculateStockHoldings(portfolioId, symbol);

    return { success: true, message: 'Transaction deleted' };
  } catch (error) {
    log('Error deleting stock transaction: ' + error.toString());
    return { success: false, error: error.message };
  }
}

// ============================================================================
// STOCK HOLDINGS
// ============================================================================

/**
 * Bulk import holdings from a broker file or a CDSL / NSDL statement. Each row becomes one BUY transaction
 * (note "Imported …"), then holdings are recalculated.
 * Rows are matched by symbol, then ISIN, in the stock list; anything else written EXCHANGE:TICKER
 * (NASDAQ:AAPL, LON:VOD, BOM:517015) is checked with Google Finance.
 * A foreign row's average price is in its own currency (row.currency, else the stock's currency) and is
 * saved in ₹ at that currency's rupee rate on the row's buy date (today when no date).
 * Never throws for a bad row: unknown symbols / bad numbers are returned in `skipped`.
 * @param {Object} params { portfolioId, date, rows: [{ symbol, quantity, avgPrice, sourceSymbol, isin?, currency?, date?, note? }] }
 * @returns {Object} { success, imported: [{symbol, quantity, avgPrice}], skipped: [{symbol, reason}] }
 */
function importStockHoldings(params) {
  try {
    var portfolioId = params && params.portfolioId;
    var rows = (params && params.rows) || [];
    if (!portfolioId) throw new Error('Portfolio ID is required');
    if (!rows.length) throw new Error('No rows to import');
    if (rows.length > 500) throw new Error('Too many rows (max 500 per import)');
    var txnDate = params.date ? new Date(params.date) : new Date();
    if (isNaN(txnDate.getTime())) txnDate = new Date();
    var ymd = function (d) { return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd'); };
    var todayYmd = ymd(new Date());

    var portfolio = getAllStockPortfolios().find(function (p) { return p.portfolioId === portfolioId; });
    if (!portfolio) throw new Error('Portfolio not found: ' + portfolioId);

    // Master data, read once
    var master = getSheet(CONFIG.stockMasterDataSheet);
    if (!master) throw new Error('StockMasterData sheet not found');
    var mLast = master.getLastRow();
    var mData = mLast > 2 ? master.getRange(3, 1, mLast - 2, 10).getValues() : [];
    var bySymbol = {}, byIsin = {};
    mData.forEach(function (r) {
      if (r[0]) bySymbol[r[0].toString().toUpperCase()] = r;
      if (r[9] && String(r[8]) === 'Active') byIsin[r[9].toString().toUpperCase()] = r;
    });

    // pass 1: match each row; direct symbols are quoted together
    var prepared = rows.map(function (row) {
      var sym = String((row && row.symbol) || '').trim().toUpperCase();
      var isin = String((row && row.isin) || '').trim().toUpperCase();
      var m = bySymbol[sym] || (isin && byIsin[isin]) || null;
      var d = row && row.date ? new Date(row.date) : null;
      if (!d || isNaN(d.getTime())) d = txnDate;
      return { row: row, sym: sym, m: m, direct: !m && normDirect_(sym) ? normDirect_(sym) : '', date: d };
    });
    var quotes = getQuotes_(prepared.filter(function (p) { return p.direct; }).map(function (p) { return p.direct; }));

    // pass 2: rupee rates on the buy dates (one batch)
    var fxNeed = {}, fxKeys = [];
    prepared.forEach(function (p) {
      var q = p.direct ? quotes[p.direct] : null;
      if (!q || !q.valid || !isForeignSymbol_(p.direct)) return;
      p.ccy = String(p.row.currency || q.currency || '').trim();
      if (!p.ccy || p.ccy.toUpperCase() === 'INR') return;
      p.dateYmd = ymd(p.date);
      if (p.dateYmd === todayYmd && p.ccy === q.currency) return; // today's rate is in the quote
      var k = p.ccy + '|' + p.dateYmd;
      if (!fxNeed[k]) { fxNeed[k] = true; fxKeys.push(k); }
    });
    var fxVals = gfValues_(fxKeys.map(function (k) {
      var parts = k.split('|'), d = new Date(parts[1] + 'T12:00:00');
      return '=IFERROR(' + fxFormula_(parts[0], parts[1] === todayYmd ? '' : sheetDate_(d)) + ', 0)';
    }));
    var fxOn = {}; fxKeys.forEach(function (k, i) { fxOn[k] = Number(fxVals[i]) || 0; });

    var txSheet = getSheet(CONFIG.stockTransactionsSheet);
    if (!txSheet) throw new Error('StockTransactions sheet not found');
    var tLast = txSheet.getLastRow();
    var existingIds = tLast > 2 ? txSheet.getRange(3, 1, tLast - 2, 1).getValues().flat() : [];

    var imported = [], skipped = [], newRows = [], symbols = {};
    prepared.forEach(function (p) {
      var row = p.row || {};
      var label = row.sourceSymbol || row.symbol || row.isin || '(blank)';
      try {
        var qty = parseFloat(row.quantity);
        var price = parseFloat(row.avgPrice);
        var m = p.m;
        var note = row.note ? String(row.note) : 'Imported from holdings file';
        if (!m && p.direct) {
          var q = quotes[p.direct];
          if (!q || !q.valid) { skipped.push({ symbol: label, reason: (q && q.error) || 'No price on Google Finance' }); return; }
          m = [q.symbol, '', q.companyName, q.exchange, q.symbol, '', q.sector, '', 'Active', ''];
          if (isForeignSymbol_(p.direct) && p.ccy && p.ccy.toUpperCase() !== 'INR' && price > 0) {
            var fx = (p.dateYmd === todayYmd && p.ccy === q.currency) ? q.fx : fxOn[p.ccy + '|' + p.dateYmd];
            if (!(fx > 0)) { skipped.push({ symbol: label, reason: 'Could not get the ' + p.ccy + ' rate for ' + p.dateYmd }); return; }
            note = 'Imported · ' + p.ccy + ' ' + price + ' at ₹' + fx.toFixed(2) + ' (' + p.dateYmd + ')';
            price = price * fx;
          }
        }
        if (!m) { skipped.push({ symbol: label, reason: 'Not found in the stock list' }); return; }
        if (!(qty > 0)) { skipped.push({ symbol: label, reason: 'Quantity is missing or zero' }); return; }
        if (!(price > 0)) { skipped.push({ symbol: label, reason: 'Average price is missing or zero' }); return; }
        var id = generateId('TXN-STK', existingIds);
        existingIds.push(id);
        var gf = m[4] || m[5] || '';
        var total = qty * price;
        newRows.push([id, portfolioId, portfolio.portfolioName, m[0], m[2], m[3], gf, 'BUY', p.date, qty, price, total, 0, total, note, '']);
        symbols[m[0]] = true;
        imported.push({ symbol: m[0], quantity: qty, avgPrice: price });
      } catch (e) {
        skipped.push({ symbol: label, reason: e.message || 'Could not read this row' });
      }
    });

    if (newRows.length) {
      txSheet.getRange(txSheet.getLastRow() + 1, 1, newRows.length, 16).setValues(newRows);
      flushSheets_();
      Object.keys(symbols).forEach(function (s) {
        try { recalculateStockHoldings(portfolioId, s); }
        catch (e) { log('importStockHoldings: recalc failed for ' + s + ': ' + e); }
      });
    }
    log('Stock import: ' + imported.length + ' imported, ' + skipped.length + ' skipped into ' + portfolioId);
    return { success: true, imported: imported, skipped: skipped };
  } catch (error) {
    log('Error importing stocks: ' + error.toString());
    return { success: false, error: error.message };
  }
}

/**
 * Delete ALL stock data of this family (for starting over after testing): every stock portfolio, transaction
 * and holding, and goal links to stock portfolios. Cannot be undone. Needs confirm === 'DELETE'.
 */
function deleteAllStocks(params) {
  try {
    if (!params || params.confirm !== 'DELETE') throw new Error('Type DELETE to confirm');
    var counts = {};
    [['transactions', CONFIG.stockTransactionsSheet], ['holdings', CONFIG.stockHoldingsSheet], ['portfolios', CONFIG.stockPortfoliosSheet]].forEach(function (t) {
      var sh = getSheet(t[1]);
      var n = sh ? Math.max(0, sh.getLastRow() - 2) : 0;
      if (n > 0) sh.getRange(3, 1, n, sh.getMaxColumns()).clearContent(); // clear (not delete) so formulas that point at these tabs keep their ranges
      counts[t[0]] = n;
    });
    // goal links to stock portfolios (column G = "Stock")
    var gm = getSheet(CONFIG.goalPortfolioMappingSheet);
    counts.goalLinks = 0;
    if (gm && gm.getLastRow() > 2) {
      var v = gm.getRange(3, 1, gm.getLastRow() - 2, 7).getValues();
      for (var i = v.length - 1; i >= 0; i--) {
        if (String(v[i][6]) === 'Stock' || String(v[i][3]).indexOf('PFL-STK-') === 0) { gm.deleteRow(i + 3); counts.goalLinks++; }
      }
    }
    log('deleteAllStocks: ' + JSON.stringify(counts));
    return { success: true, deleted: counts };
  } catch (error) {
    log('Error deleting all stocks: ' + error.toString());
    return { success: false, error: error.message };
  }
}

/**
 * Recalculate stock holdings for a specific portfolio and stock
 * Called after each BUY or SELL transaction
 */
function recalculateStockHoldings(portfolioId, stockSymbol) {
  try {
    const transactionsSheet = getSheet(CONFIG.stockTransactionsSheet);
    const holdingsSheet = getSheet(CONFIG.stockHoldingsSheet);

    if (!transactionsSheet || !holdingsSheet) {
      throw new Error('Required sheets not found');
    }

    // Get all transactions for this portfolio and stock
    const transLastRow = transactionsSheet.getLastRow();
    const transactions = transLastRow > 2
      ? transactionsSheet.getRange(3, 1, transLastRow - 2, 16).getValues()
      : [];

    const relevantTransactions = transactions.filter(row =>
      row[1] === portfolioId && row[3] === stockSymbol
    );

    if (relevantTransactions.length === 0) {
      return; // No transactions, nothing to do
    }

    // Calculate total quantity and weighted average price
    let totalQuantity = 0;
    let totalInvestment = 0;
    let buyQuantity = 0;

    relevantTransactions.forEach(row => {
      const type = row[7];           // H: Transaction Type
      const quantity = row[9];       // J: Quantity
      const pricePerShare = row[10]; // K: Price per Share

      if (type === 'BUY') {
        buyQuantity += quantity;
        totalQuantity += quantity;
        totalInvestment += (quantity * pricePerShare);
      } else if (type === 'SELL') {
        totalQuantity -= quantity;
      }
    });

    // If all sold, remove from holdings
    if (totalQuantity <= 0) {
      const holdingsLastRow = holdingsSheet.getLastRow();
      if (holdingsLastRow > 2) {
        const holdingsData = holdingsSheet.getRange(3, 1, holdingsLastRow - 2, 15).getValues();

        for (let i = 0; i < holdingsData.length; i++) {
          if (holdingsData[i][0] === portfolioId && holdingsData[i][2] === stockSymbol) {
            holdingsSheet.deleteRow(i + 3); // +3 because row 1 is header, row 2 is column headers, data starts at row 3
            log(`Removed holding: ${stockSymbol} (fully sold)`);
            return;
          }
        }
      }
      return;
    }

    // Calculate weighted average buy price
    const avgBuyPrice = buyQuantity > 0 ? totalInvestment / buyQuantity : 0;
    const currentInvestment = totalQuantity * avgBuyPrice;

    // Get stock details (if the list / Google Finance can't tell us right now, use what the transaction saved)
    let stock = getStockBySymbol(stockSymbol);
    if (!stock) {
      const t0 = relevantTransactions[0];
      if (!t0[6]) { log(`Warning: Stock not found in master data: ${stockSymbol}`); return; }
      stock = { symbol: t0[3], companyName: t0[4], exchange: t0[5], gfNSE: t0[6], gfBSE: '', sector: '', currency: '' };
    }

    // Get portfolio name
    const portfolios = getAllStockPortfolios();
    const portfolio = portfolios.find(p => p.portfolioId === portfolioId);
    const portfolioName = portfolio ? portfolio.portfolioName : '';

    // Determine which Google Finance symbol to use
    const gfSymbol = stock.gfNSE || stock.gfBSE || '';

    // Check if holding already exists
    const holdingsLastRow = holdingsSheet.getLastRow();
    let existingRowIndex = -1;

    if (holdingsLastRow > 2) {
      const holdingsData = holdingsSheet.getRange(3, 1, holdingsLastRow - 2, 15).getValues();

      for (let i = 0; i < holdingsData.length; i++) {
        if (holdingsData[i][0] === portfolioId && holdingsData[i][2] === stockSymbol) {
          existingRowIndex = i + 3; // +3 for header rows
          break;
        }
      }
    }

    const rowNum = existingRowIndex > 0 ? existingRowIndex : holdingsLastRow + 1;

    // Formulas for live price and P&L calculations
    // Indian: NSE price, else BSE. Foreign: price × that currency's rupee rate today.
    const currentPriceFormula = !gfSymbol ? 0
      : isForeignSymbol_(gfSymbol) ? priceFormulaFor_(gfSymbol, stock.currency)
      : (stock.gfNSE && stock.gfBSE && gfSymbol === stock.gfNSE)
        ? `=IFERROR(GOOGLEFINANCE("${stock.gfNSE}", "price"), IFERROR(GOOGLEFINANCE("${stock.gfBSE}", "price"), 0))`
        : `=IFERROR(GOOGLEFINANCE("${gfSymbol}", "price"), 0)`;
    const currentValueFormula = `=G${rowNum}*J${rowNum}`;
    const unrealizedPLFormula = `=K${rowNum}-I${rowNum}`;
    const unrealizedPLPctFormula = `=IF(I${rowNum}>0, L${rowNum}/I${rowNum}, 0)`;

    const rowData = [
      portfolioId,                  // A: Portfolio ID
      portfolioName,                // B: Portfolio Name
      stock.symbol,                 // C: Stock Symbol
      stock.companyName,            // D: Company Name
      stock.exchange,               // E: Exchange
      gfSymbol,                     // F: Google Finance Symbol
      totalQuantity,                // G: Total Quantity
      avgBuyPrice,                  // H: Average Buy Price ₹
      currentInvestment,            // I: Total Investment ₹
      currentPriceFormula,          // J: Current Price ₹ (GOOGLEFINANCE formula)
      currentValueFormula,          // K: Current Value ₹ (formula)
      unrealizedPLFormula,          // L: Unrealized P&L ₹ (formula)
      unrealizedPLPctFormula,       // M: Unrealized P&L % (formula)
      stock.sector || '',           // N: Sector
      new Date()                    // O: Last Updated
    ];

    if (existingRowIndex > 0) {
      // Update existing holding
      holdingsSheet.getRange(rowNum, 1, 1, 15).setValues([rowData]);
      log(`Updated holding: ${stockSymbol} in ${portfolioId} - Qty: ${totalQuantity}`);
    } else {
      // Add new holding
      holdingsSheet.appendRow(rowData);
      log(`Added holding: ${stockSymbol} in ${portfolioId} - Qty: ${totalQuantity}`);
    }

  } catch (error) {
    log('Error recalculating holdings: ' + error.toString());
    throw error;
  }
}

/**
 * Get stock holdings for a specific portfolio (for Sell dialog)
 */
function getStockHoldingsByPortfolio(portfolioId) {
  try {
    const sheet = getSheet(CONFIG.stockHoldingsSheet);
    if (!sheet) return [];

    const lastRow = sheet.getLastRow();
    if (lastRow <= 2) return [];

    const data = sheet.getRange(3, 1, lastRow - 2, 15).getValues();
    const holdings = [];

    data.forEach(row => {
      if (row[0] === portfolioId && row[6] > 0) { // Portfolio ID matches and has quantity
        holdings.push({
          portfolioId: row[0],          // A
          portfolioName: row[1],        // B
          symbol: row[2],               // C
          companyName: row[3],          // D
          exchange: row[4],             // E
          gfSymbol: row[5],             // F
          quantity: row[6],             // G
          avgBuyPrice: row[7],          // H
          totalInvestment: row[8],      // I
          currentPrice: row[9],         // J
          currentValue: row[10],        // K
          unrealizedPL: row[11],        // L
          unrealizedPLPct: row[12],     // M
          sector: row[13],              // N
          lastUpdated: row[14]          // O
        });
      }
    });

    return holdings;

  } catch (error) {
    log('Error getting stock holdings by portfolio: ' + error.toString());
    return [];
  }
}

// ============================================================================
// END OF STOCKS.GS
// ============================================================================
