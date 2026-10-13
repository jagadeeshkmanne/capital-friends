/**
 * ============================================================================
 * MasterDB_GlobalStocks.js — BSE-only stocks and US stocks for the stock search
 * ============================================================================
 *
 * 1. importBseStocks()  — adds stocks listed ONLY on BSE to Stock_Data (matched by ISIN), and fills the
 *    blank BSE code / BOM: symbol of NSE rows that are also on BSE. Existing rows are never removed or
 *    renamed, so holdings that point at a symbol keep working.
 *      Source: BSE's "List of Scrips" API. If BSE blocks Google's servers, download the list from
 *      bseindia.com (Markets → Equity → List of Scrips → Equity, Active), paste it into a tab called
 *      BSE_Import (header row included) and run importBseStocks() again.
 *
 * 2. importUsStocks()   — writes the US_Stocks tab: every US stock and ETF from Nasdaq Trader's public
 *    symbol directory (Nasdaq, NYSE, NYSE American, NYSE Arca, Cboe), SEC ticker file as a fallback. Rebuilt each run (it is a separate
 *    tab, nothing in Stock_Data changes).
 *      Columns: A Symbol (Google Finance form, e.g. NASDAQ:AAPL) · B Ticker · C Name · D Exchange ·
 *               E Type (Stock / ETF) · F Currency (USD)
 *
 * Run both once by hand, then installGlobalStocksDailyTrigger() keeps them fresh (every day, 3 AM).
 * ============================================================================
 */

var BSE_IMPORT_TAB = 'BSE_Import';
var US_STOCKS_TAB = 'US_Stocks';

// ── BSE ──────────────────────────────────────────────────────────────────────

function importBseStocks() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Stock_Data');
  if (!sheet) throw new Error('Stock_Data sheet not found. Run initialStockImport() first.');

  var scrips = bseScripsFromApi_();
  var source = 'BSE API';
  if (!scrips.length) { scrips = bseScripsFromTab_(ss); source = BSE_IMPORT_TAB + ' tab'; }
  if (!scrips.length) {
    Logger.log('No BSE list: the API returned nothing and the ' + BSE_IMPORT_TAB + ' tab is empty. Nothing changed.');
    return { success: false, error: 'No BSE list' };
  }

  var last = sheet.getLastRow();
  var data = last > 1 ? sheet.getRange(2, 1, last - 1, 10).getValues() : [];
  var byIsin = {}, symbols = {};
  data.forEach(function (r, i) {
    if (r[9]) byIsin[String(r[9]).trim().toUpperCase()] = i;
    if (r[0]) symbols[String(r[0]).trim().toUpperCase()] = true;
  });

  var filled = 0, added = [];
  scrips.forEach(function (s) {
    var i = byIsin[s.isin];
    if (i !== undefined) {
      // NSE row that is also on BSE: fill only the BSE columns, and only when blank
      var r = data[i], changed = false;
      if (!r[1]) { r[1] = s.code; changed = true; }
      if (!r[5]) { r[5] = 'BOM:' + s.code; changed = true; }
      if (changed) { data[i]._dirty = true; filled++; }
      return;
    }
    // BSE-only stock: its BSE id as the symbol, unless an NSE stock already uses that name
    var sym = s.id && !symbols[s.id] ? s.id : 'BOM:' + s.code;
    symbols[sym] = true;
    byIsin[s.isin] = -1;
    added.push([sym, s.code, s.name, 'BSE', '', 'BOM:' + s.code, '', s.industry, 'Active', s.isin]);
  });

  // write back only the columns B and F of the changed rows (one batch per column)
  if (filled) {
    var colB = data.map(function (r) { return [r[1]]; }), colF = data.map(function (r) { return [r[5]]; });
    sheet.getRange(2, 2, data.length, 1).setValues(colB);
    sheet.getRange(2, 6, data.length, 1).setValues(colF);
  }
  if (added.length) sheet.getRange(sheet.getLastRow() + 1, 1, added.length, 10).setValues(added);

  var msg = 'BSE (' + source + '): ' + scrips.length + ' scrips read, ' + added.length + ' BSE-only stocks added, ' + filled + ' NSE rows got their BSE code';
  Logger.log(msg);
  return { success: true, added: added.length, filled: filled, read: scrips.length };
}

/** Active equity scrips from BSE's API: [{ code, id, name, isin, industry }] ([] when blocked). */
function bseScripsFromApi_() {
  try {
    var url = 'https://api.bseindia.com/BseIndiaAPI/api/ListofScripData/w?Group=&Scripcode=&industry=&segment=Equity&status=Active';
    var res = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.bseindia.com/', 'Origin': 'https://www.bseindia.com', 'Accept': 'application/json' }
    });
    if (res.getResponseCode() !== 200) { Logger.log('BSE API: HTTP ' + res.getResponseCode()); return []; }
    var json = JSON.parse(res.getContentText());
    var list = Array.isArray(json) ? json : (json && (json.Table || json.data)) || [];
    return list.map(bseScrip_).filter(Boolean);
  } catch (e) {
    Logger.log('BSE API failed: ' + e);
    return [];
  }
}

/** Same list from the pasted BSE_Import tab (BSE's "List of Scrips" download). */
function bseScripsFromTab_(ss) {
  var tab = ss.getSheetByName(BSE_IMPORT_TAB);
  if (!tab || tab.getLastRow() < 2) return [];
  var v = tab.getDataRange().getValues();
  var head = v[0].map(function (h) { return String(h); });
  return v.slice(1).map(function (row) {
    var o = {}; head.forEach(function (h, i) { o[h] = row[i]; });
    return bseScrip_(o);
  }).filter(Boolean);
}

/** One BSE record (API or CSV column names) → { code, id, name, isin, industry }, or null to skip. */
function bseScrip_(o) {
  var pick = function (names) {
    for (var k in o) {
      var n = String(k).toLowerCase().replace(/[^a-z]/g, '');
      if (names.indexOf(n) >= 0 && o[k] !== null && o[k] !== undefined && String(o[k]).trim() !== '') return String(o[k]).trim();
    }
    return '';
  };
  var code = pick(['scripcd', 'securitycode', 'scripcode', 'code']);
  var isin = pick(['isinnumber', 'isinno', 'isin']).toUpperCase();
  var status = pick(['status']);
  var segment = pick(['segment', 'instrument']);
  if (!/^\d{6}$/.test(code) || !/^IN[EF][A-Z0-9]{9}$/.test(isin)) return null;
  if (status && !/^active$/i.test(status)) return null;
  if (segment && !/equity/i.test(segment)) return null;
  var id = pick(['scripid', 'securityid']).toUpperCase().replace(/\s+/g, '');
  var name = pick(['scripname', 'securityname', 'issuername', 'companyname']) || id || code;
  return { code: code, id: id, name: name, isin: isin, industry: pick(['industry', 'industrynewname', 'sector']) };
}

// ── US ───────────────────────────────────────────────────────────────────────

var SEC_EXCHANGE_TO_GF_ = { 'NASDAQ': 'NASDAQ', 'NYSE': 'NYSE', 'CBOE': 'BATS', 'NYSE AMERICAN': 'NYSEAMERICAN', 'NYSE ARCA': 'NYSEARCA' };

// Popular US ETFs (the SEC company file lists companies, not ETF share classes)
var US_ETFS_ = [
  ['NYSEARCA', 'VOO', 'Vanguard S&P 500 ETF'], ['NYSEARCA', 'SPY', 'SPDR S&P 500 ETF Trust'], ['NYSEARCA', 'IVV', 'iShares Core S&P 500 ETF'],
  ['NYSEARCA', 'VTI', 'Vanguard Total Stock Market ETF'], ['NASDAQ', 'QQQ', 'Invesco QQQ Trust (Nasdaq-100)'], ['NASDAQ', 'QQQM', 'Invesco Nasdaq 100 ETF'],
  ['NYSEARCA', 'VT', 'Vanguard Total World Stock ETF'], ['NYSEARCA', 'VEA', 'Vanguard FTSE Developed Markets ETF'], ['NYSEARCA', 'VWO', 'Vanguard FTSE Emerging Markets ETF'],
  ['NASDAQ', 'VXUS', 'Vanguard Total International Stock ETF'], ['NYSEARCA', 'SCHD', 'Schwab US Dividend Equity ETF'], ['NYSEARCA', 'VYM', 'Vanguard High Dividend Yield ETF'],
  ['NYSEARCA', 'VIG', 'Vanguard Dividend Appreciation ETF'], ['NYSEARCA', 'VUG', 'Vanguard Growth ETF'], ['NYSEARCA', 'VTV', 'Vanguard Value ETF'],
  ['NYSEARCA', 'IWM', 'iShares Russell 2000 ETF'], ['NYSEARCA', 'IJH', 'iShares Core S&P Mid-Cap ETF'], ['NYSEARCA', 'IJR', 'iShares Core S&P Small-Cap ETF'],
  ['NYSEARCA', 'DIA', 'SPDR Dow Jones Industrial Average ETF'], ['NYSEARCA', 'RSP', 'Invesco S&P 500 Equal Weight ETF'], ['NYSEARCA', 'SPLG', 'SPDR Portfolio S&P 500 ETF'],
  ['NYSEARCA', 'SCHX', 'Schwab US Large-Cap ETF'], ['NYSEARCA', 'SCHB', 'Schwab US Broad Market ETF'], ['NYSEARCA', 'SCHG', 'Schwab US Large-Cap Growth ETF'],
  ['NYSEARCA', 'XLK', 'Technology Select Sector SPDR'], ['NYSEARCA', 'XLF', 'Financial Select Sector SPDR'], ['NYSEARCA', 'XLV', 'Health Care Select Sector SPDR'],
  ['NYSEARCA', 'XLE', 'Energy Select Sector SPDR'], ['NYSEARCA', 'XLY', 'Consumer Discretionary Select Sector SPDR'], ['NYSEARCA', 'XLP', 'Consumer Staples Select Sector SPDR'],
  ['NYSEARCA', 'VGT', 'Vanguard Information Technology ETF'], ['NASDAQ', 'SMH', 'VanEck Semiconductor ETF'], ['NASDAQ', 'SOXX', 'iShares Semiconductor ETF'],
  ['NYSEARCA', 'ARKK', 'ARK Innovation ETF'], ['NYSEARCA', 'GLD', 'SPDR Gold Shares'], ['NYSEARCA', 'IAU', 'iShares Gold Trust'],
  ['NYSEARCA', 'SLV', 'iShares Silver Trust'], ['NASDAQ', 'BND', 'Vanguard Total Bond Market ETF'], ['NYSEARCA', 'AGG', 'iShares Core US Aggregate Bond ETF'],
  ['NASDAQ', 'TLT', 'iShares 20+ Year Treasury Bond ETF'], ['NASDAQ', 'SHY', 'iShares 1-3 Year Treasury Bond ETF'], ['NYSEARCA', 'BIL', 'SPDR Bloomberg 1-3 Month T-Bill ETF'],
  ['NYSEARCA', 'VNQ', 'Vanguard Real Estate ETF'], ['NYSEARCA', 'EFA', 'iShares MSCI EAFE ETF'], ['NYSEARCA', 'EEM', 'iShares MSCI Emerging Markets ETF'],
  ['NYSEARCA', 'IEMG', 'iShares Core MSCI Emerging Markets ETF'], ['NYSEARCA', 'IEFA', 'iShares Core MSCI EAFE ETF'], ['NYSEARCA', 'ACWI', 'iShares MSCI ACWI ETF'],
  ['NYSEARCA', 'INDA', 'iShares MSCI India ETF'], ['NYSEARCA', 'MCHI', 'iShares MSCI China ETF'], ['NYSEARCA', 'EWJ', 'iShares MSCI Japan ETF'],
  ['NYSEARCA', 'JEPI', 'JPMorgan Equity Premium Income ETF'], ['NASDAQ', 'JEPQ', 'JPMorgan Nasdaq Equity Premium Income ETF'], ['NYSEARCA', 'VB', 'Vanguard Small-Cap ETF'],
  ['NYSEARCA', 'VO', 'Vanguard Mid-Cap ETF'], ['NYSEARCA', 'MGK', 'Vanguard Mega Cap Growth ETF'], ['NYSEARCA', 'IWF', 'iShares Russell 1000 Growth ETF'],
  ['NYSEARCA', 'IWD', 'iShares Russell 1000 Value ETF'], ['NYSEARCA', 'QUAL', 'iShares MSCI USA Quality Factor ETF'], ['NYSEARCA', 'MTUM', 'iShares MSCI USA Momentum Factor ETF'],
  ['NYSEARCA', 'USMV', 'iShares MSCI USA Min Vol Factor ETF'], ['NYSEARCA', 'IBIT', 'iShares Bitcoin Trust ETF'], ['NYSEARCA', 'SPYG', 'SPDR Portfolio S&P 500 Growth ETF'],
  ['NYSEARCA', 'SPYD', 'SPDR Portfolio S&P 500 High Dividend ETF'], ['NYSEARCA', 'DGRO', 'iShares Core Dividend Growth ETF'], ['NYSEARCA', 'ITOT', 'iShares Core S&P Total US Stock Market ETF']
];

function importUsStocks() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  // 1st choice: Nasdaq Trader's symbol directory (every Nasdaq / NYSE / NYSE Arca / Cboe listing, with an ETF flag).
  // 2nd: the SEC ticker file (companies only; it often refuses Google's servers with HTTP 403).
  var got = usFromNasdaqTrader_(), source = 'Nasdaq Trader';
  if (got.length < 1000) { got = usFromSec_(); source = 'SEC'; }
  if (got.length < 1000) {
    Logger.log('US list: no source answered (' + got.length + ' rows). US_Stocks left as it was.');
    return { success: false, error: 'No US list source' };
  }
  // the directory is the authority; the hand-made ETF list only fills gaps (the SEC file has no ETFs)
  var rows = [], seen = {};
  got.forEach(function (r) { if (!seen[r[1]]) { seen[r[1]] = true; rows.push(r); } });
  US_ETFS_.forEach(function (e) { if (!seen[e[1]]) { seen[e[1]] = true; rows.push([e[0] + ':' + e[1], e[1], e[2], e[0], 'ETF', 'USD']); } });

  var tab = ss.getSheetByName(US_STOCKS_TAB) || ss.insertSheet(US_STOCKS_TAB);
  tab.getRange(1, 1, 1, 6).setValues([['Symbol', 'Ticker', 'Name', 'Exchange', 'Type', 'Currency']]).setFontWeight('bold');
  tab.setFrozenRows(1);
  if (tab.getMaxRows() < rows.length + 1) tab.insertRowsAfter(tab.getMaxRows(), rows.length + 1 - tab.getMaxRows());
  tab.getRange(2, 1, rows.length, 6).setNumberFormat('@').setValues(rows);
  var extra = tab.getLastRow() - (rows.length + 1);
  if (extra > 0) tab.getRange(rows.length + 2, 1, extra, 6).clearContent();
  var etfs = rows.filter(function (r) { return r[4] === 'ETF'; }).length;
  Logger.log('US_Stocks (' + source + '): ' + rows.length + ' rows (' + etfs + ' ETFs)');
  return { success: true, count: rows.length, source: source };
}

function usFetchText_(url, headers) {
  try {
    var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true, headers: headers || { 'User-Agent': 'Mozilla/5.0' } });
    if (res.getResponseCode() !== 200) { Logger.log(url + ': HTTP ' + res.getResponseCode()); return ''; }
    return res.getContentText();
  } catch (e) { Logger.log(url + ' failed: ' + e); return ''; }
}

// Nasdaq Trader exchange codes (otherlisted.txt) → Google Finance prefix
var NT_EXCHANGE_TO_GF_ = { N: 'NYSE', A: 'NYSEAMERICAN', P: 'NYSEARCA', Z: 'BATS' };
// skip warrants, rights, units, preferreds and notes: no normal share price on Google Finance
var US_SKIP_NAME_RE_ = /\b(warrants?|rights?|units?|preferred|depositary shares? representing|notes due|debentures?|subordinated)\b/i;

/** [[symbol, ticker, name, exchange, type, 'USD']] from nasdaqlisted.txt + otherlisted.txt ([] when unavailable). */
function usFromNasdaqTrader_() {
  var base = 'https://www.nasdaqtrader.com/dynamic/SymDir/';
  return parseNasdaqListed_(usFetchText_(base + 'nasdaqlisted.txt')).concat(parseOtherListed_(usFetchText_(base + 'otherlisted.txt')));
}
function ntRows_(text) {
  return String(text || '').split(/\r?\n/).slice(1).filter(function (l) { return l && l.indexOf('File Creation Time') !== 0; }).map(function (l) { return l.split('|'); });
}
/** nasdaqlisted.txt: Symbol|Security Name|Market Category|Test Issue|Financial Status|Round Lot Size|ETF|NextShares */
function parseNasdaqListed_(text) {
  var out = [];
  ntRows_(text).forEach(function (c) {
    var t = String(c[0] || '').trim().toUpperCase(), name = String(c[1] || '').trim();
    if (!t || c[3] === 'Y' || /[^A-Z.]/.test(t) || US_SKIP_NAME_RE_.test(name)) return;
    out.push(['NASDAQ:' + t, t, usCleanName_(name), 'NASDAQ', c[6] === 'Y' ? 'ETF' : 'Stock', 'USD']);
  });
  return out;
}
/** otherlisted.txt: ACT Symbol|Security Name|Exchange|CQS Symbol|ETF|Round Lot Size|Test Issue|NASDAQ Symbol */
function parseOtherListed_(text) {
  var out = [];
  ntRows_(text).forEach(function (c) {
    var t = String(c[0] || '').trim().toUpperCase(), name = String(c[1] || '').trim(), ex = NT_EXCHANGE_TO_GF_[String(c[2] || '').trim()];
    if (!t || !ex || c[6] === 'Y' || /[^A-Z.]/.test(t) || US_SKIP_NAME_RE_.test(name)) return;
    out.push([ex + ':' + t, t, usCleanName_(name), ex, c[4] === 'Y' ? 'ETF' : 'Stock', 'USD']);
  });
  return out;
}
/** "Apple Inc. - Common Stock" → "Apple Inc." */
function usCleanName_(n) {
  return String(n).replace(/\s+-\s+(Class [A-Z] )?(Common Stock|Ordinary Shares|American Depositary Shares|Common Shares|Shares of Beneficial Interest).*$/i, '').trim();
}

/** Fallback: SEC company tickers (no ETFs). */
function usFromSec_() {
  var text = usFetchText_('https://www.sec.gov/files/company_tickers_exchange.json', { 'User-Agent': 'Capital Friends contact@capitalfriends.in', 'Accept': 'application/json' });
  if (!text) return [];
  var json = JSON.parse(text), f = json.fields || ['cik', 'name', 'ticker', 'exchange'];
  var iName = f.indexOf('name'), iTicker = f.indexOf('ticker'), iEx = f.indexOf('exchange'), out = [];
  (json.data || []).forEach(function (d) {
    var ex = SEC_EXCHANGE_TO_GF_[String(d[iEx] || '').toUpperCase()];
    var t = String(d[iTicker] || '').toUpperCase().replace(/-/g, '.');
    if (ex && t) out.push([ex + ':' + t, t, String(d[iName] || t), ex, 'Stock', 'USD']);
  });
  return out;
}

// ── daily refresh ────────────────────────────────────────────────────────────

function refreshGlobalStocksDaily() {
  try { importBseStocks(); } catch (e) { Logger.log('importBseStocks failed: ' + e); }
  try { importUsStocks(); } catch (e) { Logger.log('importUsStocks failed: ' + e); }
}
function refreshGlobalStocksWeekly() { refreshGlobalStocksDaily(); } // older trigger name

/** Run once: refresh the BSE-only and US lists every day at 3 AM (replaces the older weekly trigger). */
function installGlobalStocksDailyTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    var h = t.getHandlerFunction();
    if (h === 'refreshGlobalStocksDaily' || h === 'refreshGlobalStocksWeekly') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('refreshGlobalStocksDaily').timeBased().everyDays(1).atHour(3).create();
  Logger.log('Daily BSE + US stock list refresh installed (3 AM)');
}
function installGlobalStocksWeeklyTrigger() { installGlobalStocksDailyTrigger(); } // older name
