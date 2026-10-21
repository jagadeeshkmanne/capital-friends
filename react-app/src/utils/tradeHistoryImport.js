// Read a broker's trade history and turn it into dated BUY / SELL trades with prices.
//  - Groww: Reports → Stocks → Order history (.xlsx). Name and Unique Client Code sit above the table;
//    there is no price column, so price = Value ÷ Quantity. Only "Executed" orders are kept.
//  - Zerodha: Console → Reports → Tradebook, segment Equity (.csv or .xlsx), one year per file. The client ID
//    is only in the file name (tradebook-AB1234-EQ.csv).
// The format is found from the column names, so a file renamed by the user still reads.
import { toIsoDate, toNumber, normalizeSymbol, findColumns } from './holdingsImport'

const key = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')

const FORMATS = {
  Groww: { need: ['symbol', 'isin', 'type', 'quantity', 'value', 'executiondateandtime'], optional: ['stockname', 'exchange', 'exchangeorderid', 'orderstatus'] },
  Zerodha: { need: ['symbol', 'isin', 'tradedate', 'tradetype', 'quantity', 'price'], optional: ['exchange', 'segment', 'series', 'tradeid', 'orderid', 'orderexecutiontime'] },
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

const tradeKey = (t) => t.ref ? `${t.refKind}:${t.ref}:${t.symbol}` : `${t.date}|${t.time}|${t.symbol}|${t.type}|${t.qty}|${t.price}`
export const byTime = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.time || '') < (b.time || '') ? -1 : (a.time || '') > (b.time || '') ? 1 : a.type === b.type ? 0 : a.type === 'BUY' ? -1 : 1)

/**
 * Several parsed files → one entry per broker account (overlapping yearly files are merged, repeats dropped).
 * A Zerodha file renamed without its client ID joins the only Zerodha account found, else stays on its own.
 */
export function groupAccounts(parsed) {
  const acc = new Map()
  const ok = parsed.filter((p) => !p.error)
  for (const p of ok) {
    let id = p.clientId
    if (!id) { const same = [...new Set(ok.filter((q) => q.broker === p.broker && q.clientId).map((q) => q.clientId))]; if (same.length === 1) id = same[0] }
    const k = `${p.broker}|${id || '?'}`
    if (!acc.has(k)) acc.set(k, { key: k, broker: p.broker, clientId: id || '', holderName: p.holderName || '', range: null, files: [], trades: [], seen: new Set(), repeats: 0, skipped: [] })
    const a = acc.get(k)
    a.files.push(p.fileName || '')
    if (!a.holderName && p.holderName) a.holderName = p.holderName
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
export function fileChecks(a, today) {
  const out = [], days = (x, y) => Math.round((new Date(y + 'T00:00:00Z') - new Date(x + 'T00:00:00Z')) / 86400000)
  const end = a.range?.to || (a.trades.length ? a.trades[a.trades.length - 1].date : '')
  if (a.range && days(a.range.to, today) > 7) out.push({ tone: 'warn', text: `The file only goes up to ${a.range.to}. Download it again up to today, or trades after that date will be missing.` })
  if (!a.range && a.broker === 'Zerodha' && end && days(end, today) > 400) out.push({ tone: 'info', text: `The last trade in these files is on ${end}. If you traded after that, add the tradebook for those years too.` })
  for (let i = 1; i < a.trades.length; i++) {
    const g = days(a.trades[i - 1].date, a.trades[i].date)
    if (g > 365) out.push({ tone: 'info', text: `No trades between ${a.trades[i - 1].date} and ${a.trades[i].date}.${a.broker === 'Zerodha' ? ' If you traded then, add that year\'s tradebook.' : ''}` })
  }
  if (!a.clientId) out.push({ tone: 'warn', text: a.broker === 'Zerodha' ? 'The client ID is not in the file name (it was renamed), so pick the account by hand. Keep Zerodha file names as downloaded: tradebook-AB1234-EQ.csv.' : 'No client code in the file, so pick the account by hand.' })
  return out
}
