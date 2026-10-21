// Read a broker's trade history and turn it into dated BUY / SELL trades with prices.
//  - Groww: Reports → Stocks → Order history (.xlsx). Name and Unique Client Code sit above the table;
//    there is no price column, so price = Value ÷ Quantity. Only "Executed" orders are kept.
//  - Zerodha: Console → Reports → Tradebook, segment Equity (.csv or .xlsx), one year per file. The client ID
//    is only in the file name (tradebook-AB1234-EQ.csv).
//  - ICICI Direct: Order book export (orderBook_Equity_….csv): Date, Stock, Action, Qty, Price, Order Ref., and the
//    demat account in "DP Id - Client DP Id" (IN303028-75292398), read like the template plus the account.
//  - ICICI Direct: quarterly "Equity Transaction Statement" PDF (TRX-Equity_….PDF): parseIciciTransactionPdf (text lines).
//  - Any other broker: our Excel template (public/stock-trades-template.xlsx) or any sheet with the columns
//    Date, Buy/Sell, Symbol (or ISIN), Quantity, Price (or Value), optional Broker and Order no.
// The format is found from the column names, so a file renamed by the user still reads.
import { toIsoDate, toNumber, normalizeSymbol, findColumns } from './holdingsImport'

const key = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')

const FORMATS = {
  Groww: { need: ['symbol', 'isin', 'type', 'quantity', 'value', 'executiondateandtime'], optional: ['stockname', 'exchange', 'exchangeorderid', 'orderstatus'] },
  Zerodha: { need: ['symbol', 'isin', 'tradedate', 'tradetype', 'quantity', 'price'], optional: ['exchange', 'segment', 'series', 'tradeid', 'orderid', 'orderexecutiontime'] },
}

// the template (and other brokers' sheets): each column may have a few names, the first one found wins
const TEMPLATE = {
  date: ['date', 'tradedate', 'transactiondate', 'orderdate', 'dateoftrade', 'tradedon', 'executiondate', 'executiondateandtime'],
  type: ['buysell', 'buyorsell', 'type', 'tradetype', 'transactiontype', 'transaction', 'action', 'side', 'ordertype'],
  symbol: ['symbol', 'symbolorisin', 'stocksymbol', 'nsesymbol', 'scrip', 'scripcode', 'tradingsymbol', 'stock', 'stockname', 'security', 'companyname'],
  isin: ['isin', 'isincode'],
  quantity: ['quantity', 'qty', 'shares', 'noofshares', 'units', 'tradedqty', 'tradequantity'],
  price: ['price', 'rate', 'pricepershare', 'tradeprice', 'avgprice', 'averageprice', 'netrate', 'marketrate'],
  value: ['value', 'amount', 'tradevalue', 'totalamount', 'netamount', 'grossamount'],
  broker: ['broker', 'brokername', 'platform', 'platformbroker'],
  ref: ['orderno', 'ordernumber', 'orderid', 'orderref', 'orderreference', 'tradeno', 'tradenumber', 'tradeid', 'contractnoteno', 'referenceno'],
  account: ['dpidclientdpid', 'dpidclientid', 'demataccount', 'demataccountno', 'boid'],
  time: ['time', 'tradetime', 'ordertime', 'executiontime'],
}
function findTemplate(h) {
  const col = {}
  for (const [k, names] of Object.entries(TEMPLATE)) { col[k] = -1; for (const n of names) { const i = h.indexOf(n); if (i >= 0) { col[k] = i; break } } }
  // "Symbol or ISIN" column: symbol and isin may be the same column
  const ok = col.date >= 0 && col.type >= 0 && (col.symbol >= 0 || col.isin >= 0) && col.quantity >= 0 && (col.price >= 0 || col.value >= 0)
  // brokers whose export we know by its columns: the broker name comes with the file
  if (ok && h.includes('dpidclientdpid') && h.includes('orderref')) col.knownBroker = 'ICICI Direct'
  return ok ? col : null
}

function findFormat(rows) {
  for (let r = 0; r < Math.min(rows.length, 30); r++) {
    const h = rows[r].map(key)
    for (const [broker, f] of Object.entries(FORMATS)) {
      if (f.need.every((n) => h.includes(n))) {
        const col = {}
        for (const n of [...f.need, ...f.optional]) col[n] = h.indexOf(n)
        return { broker, headerRow: r, col }
      }
    }
    const t = findTemplate(h)
    if (t) return { broker: 'Template', headerRow: r, col: t }
  }
  return null
}

// "15-03-2024 10:15 AM", "2024-03-15T10:15:00", "15 Mar 2024, 03:45 PM" → "10:15" / "15:45" ('' when none)
export function toTime(v) {
  if (typeof v === 'number') { const f = v - Math.floor(v); if (!f) return ''; const m = Math.round(f * 1440); return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}` }
  const m = String(v ?? '').match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*([AaPp][Mm])?/)
  if (!m) return ''
  let h = +m[1]
  if (m[3]) { const pm = /p/i.test(m[3]); if (pm && h < 12) h += 12; if (!pm && h === 12) h = 0 }
  return `${String(h).padStart(2, '0')}:${m[2]}`
}

const side = (v) => { const s = key(v); return /^(b|buy|bought|purchase)/.test(s) ? 'BUY' : /^(s|sell|sold|sale)/.test(s) ? 'SELL' : '' }
const clean = (v) => String(v ?? '').trim()

// a file that is not a trade history: say what it is and which file to download instead
function wrongFile(rows) {
  const heads = rows.slice(0, 30).map((r) => r.map(key))
  const has = (...w) => heads.some((h) => w.every((x) => h.includes(x)))
  if (has('buydate', 'selldate') || heads.some((h) => h.some((x) => /realis|realiz|capitalgain|pnl|profitloss/.test(x)))) return 'This is a P&L / capital gains report, not the trade history. Groww: download Order history. Zerodha: download Tradebook.'
  if (findColumns(rows)) return 'This is a holdings file (what you own today, no trade dates). Use "Import holdings" on the Stocks page, or download the Order history (Groww) / Tradebook (Zerodha) for full history.'
  if (has('tradingsymbol', 'tradetype') || has('scheme', 'nav')) return 'This looks like a mutual fund or other report. Groww: download Stocks → Order history. Zerodha: download Tradebook with segment Equity.'
  return 'This is not a Groww order history or a Zerodha tradebook. Download the file again from the broker and upload it as it is (do not open and re-save it).'
}

function growwMeta(rows, upto) {
  const meta = {}
  for (let r = 0; r < upto; r++) {
    const all = rows[r].map(clean).join(' ')
    const rg = all.match(/from\s+(\S+)\s+to\s+(\S+)/i)
    if (rg && toIsoDate(rg[1]) && toIsoDate(rg[2])) meta.range = { from: toIsoDate(rg[1]), to: toIsoDate(rg[2]) }
    const k = key(rows[r][0]), v = clean(rows[r][1])
    if (!v) continue
    if (k === 'name' || k === 'clientname') meta.holderName = v
    if (k === 'uniqueclientcode' || k === 'clientcode' || k === 'ucc' || k === 'clientid') meta.clientId = v
  }
  return meta
}

/** Zerodha client ID from the file name: tradebook-AB1234-EQ.csv → AB1234 */
export function zerodhaClientId(fileName) {
  const m = String(fileName || '').match(/tradebook[-_ ]+([A-Za-z]{2,4}\d{2,6})/i)
  return m ? m[1].toUpperCase() : ''
}

/**
 * rows (from readTableFile) → { broker, clientId, holderName, trades, skipped, error }
 * trade: { date, time, symbol, isin, name, type, qty, price, exchange, ref, refKind, line }
 */
export function parseTradeHistory(rows, fileName = '') {
  const f = findFormat(rows || [])
  if (!f) return { error: wrongFile(rows || []) }
  const { broker, headerRow, col } = f
  const cell = (row, n) => (col[n] >= 0 ? row[col[n]] : '')
  if (broker === 'Template') return parseTemplate(rows, headerRow, col)
  const meta = broker === 'Groww' ? growwMeta(rows, headerRow) : { clientId: zerodhaClientId(fileName) }
  const trades = [], skipped = []
  for (let r = headerRow + 1; r < rows.length; r++) {
    const row = rows[r]
    const symbol = normalizeSymbol(cell(row, 'symbol')), isin = clean(cell(row, 'isin')).toUpperCase()
    if (!symbol && !isin) continue
    const line = r + 1
    let date, time, qty, price, type, ref, refKind
    if (broker === 'Groww') {
      const status = key(cell(row, 'orderstatus'))
      if (status && !/^(executed|complete|completed|traded|success|filled)/.test(status)) { skipped.push({ line, symbol, reason: `Order ${clean(cell(row, 'orderstatus')).toLowerCase()}` }); continue }
      const dt = cell(row, 'executiondateandtime')
      date = toIsoDate(dt); time = toTime(dt)
      qty = toNumber(cell(row, 'quantity'))
      const value = toNumber(cell(row, 'value'))
      price = qty > 0 && value > 0 ? value / qty : NaN
      type = side(cell(row, 'type'))
      ref = clean(cell(row, 'exchangeorderid')); refKind = 'order'
    } else {
      const seg = key(cell(row, 'segment'))
      if (seg && seg !== 'eq') { skipped.push({ line, symbol, reason: `Segment ${clean(cell(row, 'segment'))} (only equity is imported)` }); continue }
      date = toIsoDate(cell(row, 'tradedate'))
      time = toTime(cell(row, 'orderexecutiontime'))
      qty = toNumber(cell(row, 'quantity'))
      price = toNumber(cell(row, 'price'))
      type = side(cell(row, 'tradetype'))
      ref = clean(cell(row, 'tradeid')) || clean(cell(row, 'orderid')); refKind = clean(cell(row, 'tradeid')) ? 'trade' : 'order'
    }
    if (!date) { skipped.push({ line, symbol, reason: 'Date not readable' }); continue }
    if (!type) { skipped.push({ line, symbol, reason: 'Not a buy or sell' }); continue }
    if (!(qty > 0) || !(price > 0)) { skipped.push({ line, symbol, reason: 'Quantity or price missing' }); continue }
    trades.push({ date, time, symbol, isin, name: clean(cell(row, 'stockname')), type, qty, price: Math.round(price * 10000) / 10000, exchange: clean(cell(row, 'exchange')).toUpperCase(), ref, refKind, line })
  }
  if (!trades.length && skipped.length && skipped.every((x) => /^Segment/.test(x.reason))) return { error: 'This tradebook is for F&O / currency / commodity. In Console → Tradebook choose segment Equity and download again.' }
  return { broker, clientId: meta.clientId || '', holderName: meta.holderName || '', range: meta.range || null, trades, skipped }
}

// Template / other broker sheet. Rows without an order number get a reference from their own values
// (date, buy/sell, quantity, price and how many identical rows came before), so a second upload adds nothing twice.
// "IN303028-75292398" → { dpId: 'IN303028', clientId: '75292398' }; a 16-digit CDSL BO ID → first 8 / last 8
function splitDemat(v) {
  const s = clean(v).toUpperCase().replace(/\s+/g, '')
  let m = s.match(/^(IN[A-Z0-9]{6})[-/]?(\d{8})$/) || s.match(/^(\d{8})[-/]?(\d{8})$/)
  return m ? { dpId: m[1], clientId: m[2] } : { dpId: '', clientId: s }
}

function parseTemplate(rows, headerRow, col) {
  const cell = (row, k) => (col[k] >= 0 ? row[col[k]] : '')
  const trades = [], skipped = [], same = {}
  for (let r = headerRow + 1; r < rows.length; r++) {
    const row = rows[r], line = r + 1
    const raw = clean(cell(row, 'symbol'))
    let isin = clean(cell(row, 'isin')).toUpperCase()
    let symbol = raw
    if (/^IN[A-Z0-9]{10}$/i.test(raw)) { isin = isin || raw.toUpperCase(); symbol = '' }
    symbol = normalizeSymbol(symbol)
    if (!symbol && !isin) continue
    if (/^(e\.?g\.?|example)/i.test(clean(cell(row, 'date'))) || /^example/i.test(raw)) continue
    const date = toIsoDate(cell(row, 'date'))
    const time = toTime(cell(row, 'time')) || (typeof cell(row, 'date') === 'number' ? toTime(cell(row, 'date')) : toTime(String(cell(row, 'date')).replace(/^\S+/, '')))
    const type = side(cell(row, 'type'))
    const qty = Math.abs(toNumber(cell(row, 'quantity')))
    const value = Math.abs(toNumber(cell(row, 'value')))
    let price = toNumber(cell(row, 'price'))
    if (!(price > 0) && qty > 0 && value > 0) price = value / qty
    if (!date) { skipped.push({ line, symbol: symbol || isin, reason: 'Date not readable (write it like 15-03-2024)' }); continue }
    if (!type) { skipped.push({ line, symbol: symbol || isin, reason: 'Buy/Sell column must say Buy or Sell' }); continue }
    if (!(qty > 0) || !(price > 0)) { skipped.push({ line, symbol: symbol || isin, reason: 'Quantity or price missing' }); continue }
    price = Math.round(price * 10000) / 10000
    let ref = clean(cell(row, 'ref')).replace(/\s+/g, ''), refKind = 'order'
    if (!ref) { const base = `${date}-${type[0]}-${qty}-${price}`; same[base + symbol + isin] = (same[base + symbol + isin] || 0) + 1; ref = `${base}-${same[base + symbol + isin]}`; refKind = 'row' }
    const acct = col.account >= 0 ? splitDemat(cell(row, 'account')) : { dpId: '', clientId: '' }
    trades.push({ date, time, symbol: symbol || isin, isin, name: '', type, qty, price, exchange: '', ref, refKind, line, platform: clean(cell(row, 'broker')) || col.knownBroker || '', clientId: acct.clientId, dpId: acct.dpId })
  }
  if (!trades.length && !skipped.length) return { error: 'The template has no trades yet. Fill one row per buy or sell (the examples are on the "How to fill" sheet) and upload again.' }
  return { broker: 'Template', knownBroker: col.knownBroker || '', clientId: '', holderName: '', range: null, trades, skipped }
}

const tradeKey = (t) => t.ref ? `${t.refKind}:${t.ref}:${t.symbol}` : `${t.date}|${t.time}|${t.symbol}|${t.type}|${t.qty}|${t.price}`
export const byTime = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.time || '') < (b.time || '') ? -1 : (a.time || '') > (b.time || '') ? 1 : a.type === b.type ? 0 : a.type === 'BUY' ? -1 : 1)

/**
 * Several parsed files → one entry per broker account (overlapping yearly files are merged, repeats dropped).
 * A Zerodha file renamed without its client ID joins the only Zerodha account found, else stays on its own.
 */
export function groupAccounts(parsed) {
  const acc = new Map()
  const ok = parsed.filter((p) => !p.error)
  // template rows: one account per broker named in the Broker column ('' = not given: picked on the page)
  const split = []
  for (const p of ok) {
    if (p.broker !== 'Template') { split.push(p); continue }
    const by = new Map()
    // ... and per demat account when the file names it (ICICI Direct's "DP Id - Client DP Id")
    for (const t of p.trades) { const b = t.platform || ''; const k = `${b.toLowerCase()}|${t.clientId || ''}`; if (!by.has(k)) by.set(k, { ...p, platform: b, clientId: t.clientId || '', dpId: t.dpId || '', trades: [], skipped: by.size ? [] : p.skipped }); by.get(k).trades.push(t) }
    if (!by.size) split.push(p); else split.push(...by.values())
  }
  for (const p of split) {
    let id = p.clientId
    if (!id) { const same = [...new Set(ok.filter((q) => q.broker === p.broker && q.clientId).map((q) => q.clientId))]; if (same.length === 1) id = same[0] }
    const k = p.broker === 'Template' ? `Template|${(p.platform || '').toLowerCase()}|${p.clientId || ''}` : `${p.broker}|${id || '?'}`
    // platform: the broker name the account is matched / created with (template: from its Broker column)
    if (!acc.has(k)) acc.set(k, { key: k, broker: p.broker, platform: p.broker === 'Template' ? p.platform || '' : p.broker, clientId: id || '', dpId: p.dpId || '', holderName: p.holderName || '', range: null, files: [], trades: [], seen: new Set(), repeats: 0, skipped: [] })
    const a = acc.get(k)
    a.files.push(p.fileName || '')
    if (!a.holderName && p.holderName) a.holderName = p.holderName
    if (p.range) (a.ranges = a.ranges || []).push(p.range)
    if (p.range) a.range = a.range ? { from: p.range.from < a.range.from ? p.range.from : a.range.from, to: p.range.to > a.range.to ? p.range.to : a.range.to } : p.range
    for (const t of p.trades) { const tk = tradeKey(t); if (a.seen.has(tk)) { a.repeats++; continue } a.seen.add(tk); a.trades.push(t) }
    a.skipped.push(...p.skipped.map((s) => ({ ...s, file: p.fileName || '' })))
  }
  return [...acc.values()].map(({ seen, ...a }) => ({ ...a, trades: a.trades.sort(byTime) }))
}

// ── FIFO: realised gains (by financial year, short / long term) and what is still held ──
export const fyOf = (iso) => { const y = +iso.slice(0, 4), m = +iso.slice(5, 7); const s = m >= 4 ? y : y - 1; return `FY ${s}-${String((s + 1) % 100).padStart(2, '0')}` }
const longTerm = (buy, sell) => { const b = new Date(buy + 'T00:00:00Z'); b.setUTCFullYear(b.getUTCFullYear() + 1); return new Date(sell + 'T00:00:00Z') > b }   // held more than 12 months

/**
 * trades (sorted, each with a `key` for the stock) → summary.
 * shortfall: shares sold that the file never bought (IPO, transfer, gift, bonus/split, or bought before the file starts).
 */
export function summarize(trades, stockKey = (t) => t.isin || t.symbol) {
  const lots = new Map(), fy = new Map(), short = new Map()
  let bought = 0, sold = 0, realised = 0, first = '', last = ''
  for (const t of [...trades].sort(byTime)) {
    const k = stockKey(t)
    if (!first || t.date < first) first = t.date
    if (!last || t.date > last) last = t.date
    if (!lots.has(k)) lots.set(k, [])
    const q = lots.get(k)
    if (t.type === 'BUY') { bought += t.qty * t.price; q.push({ date: t.date, qty: t.qty, price: t.price }); continue }
    sold += t.qty * t.price
    let left = t.qty
    while (left > 1e-9 && q.length) {
      const lot = q[0], take = Math.min(left, lot.qty)
      const gain = take * (t.price - lot.price)
      realised += gain
      const y = fyOf(t.date); if (!fy.has(y)) fy.set(y, { fy: y, short: 0, long: 0 })
      fy.get(y)[longTerm(lot.date, t.date) ? 'long' : 'short'] += gain
      lot.qty -= take; left -= take
      if (lot.qty <= 1e-9) q.shift()
    }
    if (left > 1e-9) { const s = short.get(k) || { key: k, symbol: t.symbol, qty: 0, lastSell: '' }; s.qty += left; s.lastSell = t.date; short.set(k, s) }
  }
  const holdings = []
  for (const [k, q] of lots) {
    const qty = q.reduce((s, l) => s + l.qty, 0)
    if (qty > 1e-9) { const cost = q.reduce((s, l) => s + l.qty * l.price, 0); holdings.push({ key: k, qty, cost, avg: cost / qty, since: q[0].date, longTermFrom: (() => { const d = new Date(q[0].date + 'T00:00:00Z'); d.setUTCFullYear(d.getUTCFullYear() + 1); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10) })() }) }
  }
  const holdingsCost = holdings.reduce((s, h) => s + h.cost, 0)
  return {
    first, last, count: trades.length, buys: trades.filter((t) => t.type === 'BUY').length, sells: trades.filter((t) => t.type === 'SELL').length,
    bought, sold, netIn: bought - sold, realised, holdings, holdingsCost,
    byFY: [...fy.values()].sort((a, b) => (a.fy < b.fy ? 1 : -1)), shortfall: [...short.values()],
  }
}

/** Loose name check: "VISHNU K" vs member "Vishnu Kumar" → true when the first name matches. Only for a warning. */
export function sameName(a, b) {
  const w = (s) => String(s || '').toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter((x) => x.length > 1)
  const A = w(a), B = w(b)
  if (!A.length || !B.length) return true
  return A.some((x) => B.includes(x))
}

/**
 * Checks before import → [{ tone: 'warn'|'info', text }]. today = 'YYYY-MM-DD'.
 * - the file stops well before today (trades after it would be missing)
 * - a long gap with no trades (a yearly Zerodha tradebook probably not uploaded)
 * - no client ID (renamed Zerodha file), so the account has to be picked by hand
 */
export function fileChecks(a, today, alreadyIn = []) {
  // alreadyIn: dates of broker trades already in the portfolio (earlier uploads), so one new year alone raises no gap
  const out = [], days = (x, y) => Math.round((new Date(y + 'T00:00:00Z') - new Date(x + 'T00:00:00Z')) / 86400000)
  const dates = [...new Set([...a.trades.map((t) => t.date), ...alreadyIn])].sort()
  const end = a.range?.to || dates[dates.length - 1] || ''
  if (a.broker === 'Groww' && a.range && days(a.range.to, today) > 7) out.push({ tone: 'warn', text: `The file only goes up to ${a.range.to}. Download it again up to today, or trades after that date will be missing.` })
  if (!a.range && a.broker === 'Zerodha' && end && days(end, today) > 400) out.push({ tone: 'info', text: `The last trade in these files is on ${end}. If you traded after that, add the tradebook for those years too.` })
  // a long gap only means something for Zerodha (one file per year: a year may be missing); elsewhere it's just no trading
  if (a.broker === 'Zerodha') for (let i = 1; i < dates.length; i++) {
    if (days(dates[i - 1], dates[i]) > 365) out.push({ tone: 'info', text: `No trades between ${dates[i - 1]} and ${dates[i]}.${a.broker === 'Zerodha' ? ' If you traded then, add that year\'s tradebook.' : ''}` })
  }
  // statements that each cover a period (ICICI's quarterly / yearly PDFs): the periods no statement covers
  if (a.broker === 'Template' && (a.ranges || []).length) {
    const gaps = missingPeriods(a.ranges)
    if (gaps.length) out.push({ tone: 'warn', text: `No statement for ${gaps.map((g) => `${g.from} to ${g.to}`).join(', ')}. Trades in that time are missing: download and add ${gaps.length === 1 ? 'that statement' : 'those statements'}.` })
  }
  if (!a.clientId && a.broker !== 'Template') out.push({ tone: 'warn', text: a.broker === 'Zerodha' ? 'The client ID is not in the file name (it was renamed), so pick the account by hand. Keep Zerodha file names as downloaded: tradebook-AB1234-EQ.csv.' : 'No client code in the file, so pick the account by hand.' })
  return out
}

/**
 * ICICI Securities "Equity Transaction Statement" (quarterly PDF), as text lines (readPdfLines).
 * Each trade: a contract line "ISEC/… <order date> <trade date>", then "<settlement no> <exchange> <order no> <trade no>
 * <settlement date> <ISIN> <security> <B|S> <qty> <rate> <total> <brokerage> <GST> <net>", then the times.
 * Returns null when the lines are not this statement.
 */
export function parseIciciTransactionPdf(lines) {
  const text = (lines || []).join('\n')
  if (!/Equity Transaction Statement/i.test(text) || !/ICICI Securities/i.test(text)) return null
  const clientId = (text.match(/UNIQUE CLIENT CODE\s*:\s*(\d{6,})/i) || [])[1] || (text.match(/TRADING CODE NO\s*:\s*(\d{6,})/i) || [])[1] || ''
  const to = lines.findIndex((l) => /^\s*To,?\s*$/i.test(l))
  // the holder's name: the first line after "To," that reads like a name (the broker's own details share those lines)
  const nameLike = (l) => { const t = clean(String(l).split(/\s{3,}/)[0]); return /^[A-Za-z][A-Za-z .']{2,60}$/.test(t) && !/\b(CODE|NO|LIMITED|LTD|SEBI|REGN|MEMBER|EXCHANGE|OFFICE|SEGMENT|MARKET|ICICI|COMPLIANCE|STREET|ROAD)\b/i.test(t) ? t : '' }
  const holderName = to >= 0 ? lines.slice(to + 1, to + 6).map(nameLike).find(Boolean) || '' : ''
  const pm = text.match(/Statement from\s+(\S+)\s+to\s+(\S+)/i)
  const range = pm && toIsoDate(pm[1]) && toIsoDate(pm[2]) ? { from: toIsoDate(pm[1]), to: toIsoDate(pm[2]) } : null
  const trades = [], skipped = []
  const ISIN = /\b(IN[EF9][A-Z0-9]{8}\d)\b/      // shares, ETFs / funds, partly paid (not the SEBI registration INZ…)
  for (let i = 0; i < lines.length; i++) {
    const line = String(lines[i] || ''), im = line.match(ISIN)
    if (!im || /Contract Date|Summary/i.test(line)) continue
    const before = line.slice(0, im.index), after = line.slice(im.index + im[1].length)
    const m = after.match(/^\s*(.+?)\s+(B|S|BUY|SELL)\s+([\d,]+(?:\.\d+)?)\s+([\d,]+(?:\.\d+)?)\s+([\d,]+(?:\.\d+)?)/i)
    if (!m) { skipped.push({ line: i + 1, symbol: im[1], reason: 'Trade row not readable' }); continue }
    const nums = before.trim().split(/\s+/)
    const ex = nums.findIndex((t) => /^(NSE|BSE)$/i.test(t))
    const orderNo = ex >= 0 ? nums[ex + 1] || '' : '', tradeNo = ex >= 0 ? nums[ex + 2] || '' : ''
    // trade date: the second date on the contract line just above (the first is the order date)
    let date = ''
    for (let k = i - 1; k >= Math.max(0, i - 3) && !date; k--) { const ds = String(lines[k] || '').match(/\d{2}-\d{2}-\d{4}/g); if (ds && ds.length) date = toIsoDate(ds[ds.length - 1]) }
    if (!date) { skipped.push({ line: i + 1, symbol: m[1], reason: 'Trade date not found' }); continue }
    const times = String(lines[i + 1] || '').match(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g)
    const qty = toNumber(m[3]), price = toNumber(m[4])
    if (!(qty > 0) || !(price > 0)) { skipped.push({ line: i + 1, symbol: m[1], reason: 'Quantity or price missing' }); continue }
    trades.push({ date, time: times ? toTime(times[times.length - 1]) : '', symbol: im[1], isin: im[1], name: clean(m[1]), type: /^b/i.test(m[2]) ? 'BUY' : 'SELL', qty, price: Math.round(price * 10000) / 10000,
      exchange: ex >= 0 ? nums[ex].toUpperCase() : '', ref: tradeNo || orderNo, refKind: tradeNo ? 'trade' : 'order', line: i + 1, platform: 'ICICI Direct', clientId, dpId: '' })
  }
  return { broker: 'Template', clientId, holderName, range, trades, skipped }
}

/** Periods between the earliest and latest statement that no statement covers: [{ from, to }] (ISO dates). */
export function missingPeriods(ranges) {
  const day = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
  const rs = [...(ranges || [])].filter((r) => r && r.from && r.to).sort((x, y) => (x.from < y.from ? -1 : 1))
  const out = []
  let end = ''
  for (const r of rs) {
    if (end && r.from > day(end, 1)) out.push({ from: day(end, 1), to: day(r.from, -1) })
    if (!end || r.to > end) end = r.to
  }
  return out
}
