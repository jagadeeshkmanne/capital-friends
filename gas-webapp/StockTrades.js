/**
 * Stock trade-history import (beta): Groww order history / Zerodha tradebook, read in the app and sent here as
 * dated BUY / SELL trades with prices. Used only by the hidden page /investments/stocks/import-trades.
 *
 * Each trade becomes one StockTransactions row (same 16 columns as buyStock / sellStock). The broker's order or
 * trade number goes in Notes ("Groww · order 1100000001 · 10:15"), so importing the same file again skips it.
 * SELL rows get their realised P&L first in, first out. Holdings are then recalculated per stock; for stocks that
 * have imported trades, recalculateStockHoldings uses the FIFO cost of the shares still held.
 *
 * Modes:
 *   'add'     (default) keep the portfolio's rows; add only trades not already there (and, with `after`, only
 *             trades dated after that day: for portfolios filled by hand up to some date)
 *   'replace' remove every row of this portfolio first (for example the "Imported from holdings file" rows),
 *             then write the broker history
 * Never throws for a bad trade: unknown stocks / bad numbers come back in `skipped`.
 *
 * @param {Object} params { portfolioId, broker: 'Groww'|'Zerodha', mode, after?, trades: [{ date: 'YYYY-MM-DD', time?, type, symbol, isin?, sourceSymbol?, qty, price, ref?, refKind? }] }
 */
var TRADE_NOTE_RE_ = /^(Groww|Zerodha) · (order|trade) (\S+)/;
function isTradeHistoryNote_(note) { return TRADE_NOTE_RE_.test(String(note || '')); }

/** Cost of the shares still held, first in first out. rows = StockTransactions rows of one stock in one portfolio. */
function fifoRemaining_(rows) {
  var order = rows.map(function (r, i) { return { r: r, i: i }; }).sort(function (a, b) {
    return (new Date(a.r[8]) - new Date(b.r[8])) || (a.i - b.i);
  });
  var lots = [];
  order.forEach(function (o) {
    var q = Number(o.r[9]) || 0, px = Number(o.r[10]) || 0;
    if (o.r[7] === 'BUY') { lots.push({ q: q, px: px }); return; }
    if (o.r[7] !== 'SELL') return;
    while (q > 1e-9 && lots.length) { var take = Math.min(q, lots[0].q); lots[0].q -= take; q -= take; if (lots[0].q <= 1e-9) lots.shift(); }
  });
  var qty = 0, cost = 0;
  lots.forEach(function (l) { qty += l.q; cost += l.q * l.px; });
  return { qty: qty, cost: cost };
}

function importStockTrades(params) {
  try {
    var p = params || {};
    var portfolioId = p.portfolioId, trades = p.trades || [];
    var mode = p.mode === 'replace' ? 'replace' : 'add';
    var broker = p.broker === 'Groww' || p.broker === 'Zerodha' ? p.broker : '';
    if (!portfolioId) throw new Error('Portfolio ID is required');
    if (!broker) throw new Error('Only Groww and Zerodha files are supported');
    if (!trades.length) throw new Error('No trades to import');
    if (trades.length > 5000) throw new Error('Too many trades (max 5,000 per import)');
    var after = mode === 'add' && /^\d{4}-\d{2}-\d{2}$/.test(String(p.after || '')) ? String(p.after) : '';

    var portfolio = getAllStockPortfolios().find(function (x) { return x.portfolioId === portfolioId; });
    if (!portfolio) throw new Error('Portfolio not found: ' + portfolioId);

    // stock list, read once (symbol, then ISIN: renamed stocks keep their ISIN)
    var master = getSheet(CONFIG.stockMasterDataSheet);
    if (!master) throw new Error('StockMasterData sheet not found');
    var mLast = master.getLastRow();
    var mData = mLast > 2 ? master.getRange(3, 1, mLast - 2, 10).getValues() : [];
    var bySymbol = {}, byIsin = {};
    mData.forEach(function (r) {
      if (r[0]) bySymbol[r[0].toString().toUpperCase()] = r;
      var isin = r[9] ? r[9].toString().toUpperCase() : '';
      if (isin && (!byIsin[isin] || String(r[8]) === 'Active')) byIsin[isin] = r;
    });

    var tz = Session.getScriptTimeZone();
    var ymd = function (d) { return d instanceof Date && !isNaN(d.getTime()) ? Utilities.formatDate(d, tz, 'yyyy-MM-dd') : ''; };
    var refKey = function (note, sym, day) { var m = String(note || '').match(TRADE_NOTE_RE_); return m ? m[2] + '|' + m[3] + '|' + sym + '|' + day : ''; };

    var tx = getSheet(CONFIG.stockTransactionsSheet);
    if (!tx) throw new Error('StockTransactions sheet not found');
    var tLast = tx.getLastRow();
    var all = tLast > 2 ? tx.getRange(3, 1, tLast - 2, 16).getValues() : [];
    var mineRows = [], mineSheetRows = [];
    all.forEach(function (r, i) { if (r[1] === portfolioId) { mineRows.push(r); mineSheetRows.push(i + 3); } });
    var kept = mode === 'replace' ? [] : mineRows;
    var have = {};
    kept.forEach(function (r) { var k = refKey(r[14], String(r[3]).toUpperCase(), ymd(new Date(r[8]))); if (k) have[k] = true; });
    var existingIds = all.map(function (r) { return r[0]; });

    // 1. check every trade
    var ok = [], skipped = [], duplicates = 0, before = 0;
    trades.forEach(function (t) {
      t = t || {};
      var label = t.sourceSymbol || t.symbol || t.isin || '(blank)';
      var sym = String(t.symbol || '').trim().toUpperCase(), isin = String(t.isin || '').trim().toUpperCase();
      var m = bySymbol[sym] || (isin && byIsin[isin]) || null;
      var type = t.type === 'BUY' || t.type === 'SELL' ? t.type : '';
      var qty = Number(t.qty), price = Number(t.price);
      var dm = String(t.date || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!m) { skipped.push({ symbol: label, date: t.date || '', reason: 'Not found in the stock list' }); return; }
      if (!type || !dm || !(qty > 0) || !(price > 0)) { skipped.push({ symbol: label, date: t.date || '', reason: 'Date, type, quantity or price missing' }); return; }
      if (after && t.date <= after) { before++; return; }
      var kind = t.refKind === 'trade' ? 'trade' : 'order', ref = String(t.ref || '').trim().replace(/\s+/g, '');
      var k = ref ? kind + '|' + ref + '|' + String(m[0]).toUpperCase() + '|' + t.date : '';
      if (k && have[k]) { duplicates++; return; }
      if (k) have[k] = true;
      var note = ref ? broker + ' · ' + kind + ' ' + ref + (t.time ? ' · ' + t.time : '') : broker + ' · trade history';
      ok.push({ m: m, type: type, qty: qty, price: price, date: new Date(+dm[1], +dm[2] - 1, +dm[3]), day: t.date, time: String(t.time || ''), note: note });
    });

    // 2. realised P&L of the new sells, first in first out over the rows kept + the new ones (time order)
    var events = kept.map(function (r, i) { return { kept: true, sym: String(r[3]).toUpperCase(), day: ymd(new Date(r[8])), time: '', i: i, type: r[7], qty: Number(r[9]) || 0, price: Number(r[10]) || 0 }; })
      .concat(ok.map(function (o, i) { return { kept: false, sym: String(o.m[0]).toUpperCase(), day: o.day, time: o.time, i: i, type: o.type, qty: o.qty, price: o.price, o: o }; }));
    events.sort(function (a, b) {
      if (a.day !== b.day) return a.day < b.day ? -1 : 1;
      if (a.kept !== b.kept) return a.kept ? -1 : 1;
      if (a.time !== b.time) return a.time < b.time ? -1 : 1;
      return a.i - b.i;
    });
    var lots = {}, shortfall = {};
    events.forEach(function (e) {
      var L = lots[e.sym] || (lots[e.sym] = []);
      if (e.type === 'BUY') { L.push({ q: e.qty, px: e.price }); return; }
      if (e.type !== 'SELL') return;
      var q = e.qty, cost = 0, matched = 0;
      while (q > 1e-9 && L.length) { var take = Math.min(q, L[0].q); cost += take * L[0].px; matched += take; L[0].q -= take; q -= take; if (L[0].q <= 1e-9) L.shift(); }
      if (q > 1e-9) shortfall[e.sym] = (shortfall[e.sym] || 0) + q;
      if (!e.kept) e.o.pl = matched * e.price - cost;
    });

    // 3. write: (replace) remove the portfolio's rows and holdings, then add the new rows in time order
    var newRows = [], symbols = {};
    events.filter(function (e) { return !e.kept; }).forEach(function (e) {
      var o = e.o, m = o.m;
      var id = generateId('TXN-STK', existingIds); existingIds.push(id);
      var total = o.qty * o.price;
      newRows.push([id, portfolioId, portfolio.portfolioName, m[0], m[2], m[3], m[4] || m[5] || '', o.type, o.date, o.qty, o.price, total, 0, total, o.note, o.type === 'SELL' ? (o.pl || 0) : '']);
      symbols[m[0]] = true;
    });

    var replaced = 0;
    if (mode === 'replace' && mineSheetRows.length) {
      deleteSheetRows_(tx, mineSheetRows);
      replaced = mineSheetRows.length;
      var hs = getSheet(CONFIG.stockHoldingsSheet);
      var hLast = hs ? hs.getLastRow() : 0;
      if (hLast > 2) {
        var hRows = [];
        hs.getRange(3, 1, hLast - 2, 1).getValues().forEach(function (r, i) { if (r[0] === portfolioId) hRows.push(i + 3); });
        deleteSheetRows_(hs, hRows);
      }
    }
    if (newRows.length) tx.getRange(tx.getLastRow() + 1, 1, newRows.length, 16).setValues(newRows);
    flushSheets_();
    // files can come in any order (a Zerodha year uploaded later than the next one): redo the realised P&L of
    // every imported sell of these stocks, first in first out over the portfolio's whole history
    try { refreshTradeGains_(tx, portfolioId, symbols); } catch (e) { log('importStockTrades: gains refresh failed: ' + e); }
    Object.keys(symbols).forEach(function (s) {
      try { recalculateStockHoldings(portfolioId, s); }
      catch (e) { log('importStockTrades: recalc failed for ' + s + ': ' + e); }
    });

    log('Stock trades import (' + broker + ', ' + mode + '): ' + newRows.length + ' added, ' + duplicates + ' already there, ' + skipped.length + ' skipped, ' + replaced + ' old rows removed, into ' + portfolioId);
    return {
      success: true, imported: newRows.length, duplicates: duplicates, before: before, replaced: replaced, stocks: Object.keys(symbols).length,
      skipped: skipped, shortfall: Object.keys(shortfall).map(function (s) { return { symbol: s, qty: shortfall[s] }; }),
    };
  } catch (error) {
    log('Error importing stock trades: ' + error.toString());
    return { success: false, error: error.message };
  }
}

/** Realised P&L (column P) of imported SELL rows, FIFO in date (+ time in the note) order. Hand-entered rows are left as they are. */
function refreshTradeGains_(tx, portfolioId, symbols) {
  var last = tx.getLastRow();
  if (last <= 2) return;
  var rows = tx.getRange(3, 1, last - 2, 16).getValues();
  var timeOf = function (note) { var m = String(note || '').match(/ · (\d{2}:\d{2})$/); return m ? m[1] : ''; };
  Object.keys(symbols).forEach(function (sym) {
    var mine = [];
    rows.forEach(function (r, i) { if (r[1] === portfolioId && r[3] === sym) mine.push({ r: r, i: i, t: new Date(r[8]).getTime(), tm: timeOf(r[14]) }); });
    mine.sort(function (a, b) { return (a.t - b.t) || (a.tm < b.tm ? -1 : a.tm > b.tm ? 1 : 0) || (a.i - b.i); });
    var lots = [];
    mine.forEach(function (o) {
      var q = Number(o.r[9]) || 0, px = Number(o.r[10]) || 0;
      if (o.r[7] === 'BUY') { lots.push({ q: q, px: px }); return; }
      if (o.r[7] !== 'SELL') return;
      var cost = 0, matched = 0;
      while (q > 1e-9 && lots.length) { var take = Math.min(q, lots[0].q); cost += take * lots[0].px; matched += take; lots[0].q -= take; q -= take; if (lots[0].q <= 1e-9) lots.shift(); }
      if (!isTradeHistoryNote_(o.r[14])) return;
      var pl = matched * px - cost;
      if (Math.abs((Number(o.r[15]) || 0) - pl) > 0.005) tx.getRange(o.i + 3, 16).setValue(pl);
    });
  });
}

/** Delete the given sheet row numbers (any order), one block of neighbouring rows at a time, bottom first. */
function deleteSheetRows_(sheet, rowNumbers) {
  var rs = rowNumbers.slice().sort(function (a, b) { return b - a; });
  var i = 0;
  while (i < rs.length) {
    var end = rs[i], start = end;
    while (i + 1 < rs.length && rs[i + 1] === start - 1) { i++; start = rs[i]; }
    sheet.deleteRows(start, end - start + 1);
    i++;
  }
}
