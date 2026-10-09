// Read a broker holdings file (CSV or Excel .xlsx) and turn it into { symbol, quantity, avgPrice } rows.
// Works with Zerodha (Console "Holdings" export and Kite holdings.csv), Groww, Upstox, Angel, etc.:
// the header row is found by its column names, wherever it is in the first rows of the sheet.
// No library needed: .xlsx is a zip of XML files, unzipped with the browser's DecompressionStream.

// ── column names we understand (compared without spaces, dots or case), in priority order ──
const SYMBOL_HEADERS = ['symbol', 'tradingsymbol', 'instrument', 'stocksymbol', 'nsesymbol', 'nsecode', 'scripcode', 'scrip', 'scripname', 'ticker', 'stock', 'stockname', 'security', 'securityname', 'companyname', 'company', 'name']
const QTY_HEADERS = ['quantity', 'qty', 'quantityavailable', 'availableqty', 'totalquantity', 'totalqty', 'netqty', 'holdingqty', 'holdingquantity', 'shares', 'noofshares', 'units', 'freeqty']
const PRICE_HEADERS = ['avgprice', 'averageprice', 'avgcost', 'averagecost', 'avgbuyprice', 'averagebuyprice', 'buyavg', 'buyaverage', 'buyprice', 'avgrate', 'averagerate', 'purchaseprice', 'costprice', 'avgpurchaseprice', 'price']
const ISIN_HEADERS = ['isin', 'isincode']

const key = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')

// ── number parsing: "1,316.54", "₹ 376.48", "(12.5)" ──
export function toNumber(v) {
  if (typeof v === 'number') return v
  let s = String(v ?? '').trim()
  if (!s) return NaN
  const neg = /^\(.*\)$/.test(s)
  s = s.replace(/[₹,\s()]/g, '').replace(/^rs\.?/i, '')
  const n = parseFloat(s)
  return neg ? -n : n
}

// ── symbol clean-up: "NSE:INFY", "INFY.NS", "INFY-EQ", " infy " → "INFY" ──
export function normalizeSymbol(s) {
  let x = String(s ?? '').trim().toUpperCase()
  x = x.replace(/^(NSE|BSE)\s*:\s*/, '')
  x = x.replace(/\.(NS|BO|NSE|BSE)$/, '')
  x = x.replace(/-(EQ|BE|BZ|BL|SM|ST|IL|GB|E1|T)$/, '')
  return x.replace(/\s+/g, '')
}
const loose = (s) => String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')

// ── CSV (comma, semicolon or tab; quoted cells) ──
export function parseCSV(text) {
  const firstLine = text.split(/\r?\n/).find((l) => l.trim()) || ''
  const counts = [',', ';', '\t'].map((d) => [d, firstLine.split(d).length])
  const delim = counts.sort((a, b) => b[1] - a[1])[0][0]
  const rows = []
  let row = [], cell = '', q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++ }
      else if (c === '"') q = false
      else cell += c
    } else if (c === '"') q = true
    else if (c === delim) { row.push(cell); cell = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(cell); rows.push(row); row = []; cell = ''
    } else cell += c
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row) }
  return rows.filter((r) => r.some((c) => String(c).trim() !== ''))
}

// ── minimal .xlsx reader: first worksheet → array of rows ──
async function inflateRaw(bytes) {
  const ds = new DecompressionStream('deflate-raw')
  const out = new Response(new Blob([bytes]).stream().pipeThrough(ds))
  return new Uint8Array(await out.arrayBuffer())
}
async function unzip(buf) {
  const dv = new DataView(buf), u8 = new Uint8Array(buf), files = {}
  let eocd = -1
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 66000); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break }
  if (eocd < 0) throw new Error('This is not a valid .xlsx file')
  let p = dv.getUint32(eocd + 16, true)
  const n = dv.getUint16(eocd + 10, true)
  const dec = new TextDecoder()
  for (let k = 0; k < n; k++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break
    const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true)
    const nlen = dv.getUint16(p + 28, true), elen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true)
    const name = dec.decode(u8.subarray(p + 46, p + 46 + nlen))
    files[name] = { method, csize, off }
    p += 46 + nlen + elen + clen
  }
  return {
    names: Object.keys(files),
    async text(name) {
      const f = files[name]; if (!f) return null
      const lnl = dv.getUint16(f.off + 26, true), lel = dv.getUint16(f.off + 28, true)
      const start = f.off + 30 + lnl + lel, data = u8.subarray(start, start + f.csize)
      const raw = f.method === 0 ? data : f.method === 8 ? await inflateRaw(data) : null
      if (!raw) throw new Error('Unsupported compression in .xlsx')
      return dec.decode(raw)
    },
  }
}
const unxml = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d)).replace(/&amp;/g, '&')
const colIndex = (ref) => { const L = ref.replace(/[0-9]/g, ''); let n = 0; for (const ch of L) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1 }
export async function readXlsx(buf) {
  const z = await unzip(buf)
  const shared = []
  const ss = await z.text('xl/sharedStrings.xml')
  if (ss) for (const m of ss.matchAll(/<si>([\s\S]*?)<\/si>/g)) shared.push(unxml([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((x) => x[1]).join('')))
  // the first sheet listed in the workbook
  let sheetPath = null
  const wb = await z.text('xl/workbook.xml'), rels = await z.text('xl/_rels/workbook.xml.rels')
  const firstRid = wb && (wb.match(/<sheet\b[^>]*r:id="([^"]+)"/) || [])[1]
  if (firstRid && rels) { const t = (rels.match(new RegExp(`<Relationship\\b[^>]*Id="${firstRid}"[^>]*Target="([^"]+)"`)) || rels.match(new RegExp(`<Relationship\\b[^>]*Target="([^"]+)"[^>]*Id="${firstRid}"`)) || [])[1]; if (t) sheetPath = t.startsWith('/') ? t.slice(1) : 'xl/' + t.replace(/^\.\//, '') }
  if (!sheetPath || !z.names.includes(sheetPath)) sheetPath = z.names.filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort((a, b) => parseInt(a.match(/\d+/)) - parseInt(b.match(/\d+/)))[0]
  if (!sheetPath) throw new Error('No worksheet found in this file')
  const xml = await z.text(sheetPath)
  const rows = []
  for (const rm of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const row = []
    for (const cm of rm[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cm[1], body = cm[2] || ''
      const ref = (attrs.match(/\br="([A-Z]+\d+)"/) || [])[1]
      const t = (attrs.match(/\bt="([^"]+)"/) || [])[1]
      let v = ''
      if (t === 'inlineStr') v = unxml([...body.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((x) => x[1]).join(''))
      else { const raw = (body.match(/<v>([\s\S]*?)<\/v>/) || [])[1]; if (raw != null) v = t === 's' ? (shared[+raw] ?? '') : unxml(raw) }
      const ci = ref ? colIndex(ref) : row.length
      while (row.length < ci) row.push('')
      row[ci] = v
    }
    if (row.some((c) => String(c).trim() !== '')) rows.push(row)
  }
  return rows
}

// ── any supported file → rows ──
export async function readTableFile(file) {
  const name = (file.name || '').toLowerCase()
  if (name.endsWith('.xls')) throw new Error('Old .xls files are not supported. In Excel, use "Save As" → .xlsx or .csv and try again.')
  const buf = await file.arrayBuffer()
  const u8 = new Uint8Array(buf)
  if (u8[0] === 0x50 && u8[1] === 0x4b) return readXlsx(buf)          // "PK" = zip = .xlsx
  if (name.endsWith('.xlsx')) throw new Error('This .xlsx file could not be read')
  return parseCSV(new TextDecoder().decode(buf).replace(/^﻿/, ''))
}

// ── find the header row and the columns we need ──
function pick(headers, wanted) {
  for (const w of wanted) { const i = headers.findIndex((h) => h === w); if (i >= 0) return i }
  return -1
}
export function findColumns(rows) {
  for (let r = 0; r < Math.min(rows.length, 25); r++) {
    const h = rows[r].map(key)
    const symbol = pick(h, SYMBOL_HEADERS), qty = pick(h, QTY_HEADERS), price = pick(h, PRICE_HEADERS), isin = pick(h, ISIN_HEADERS)
    if ((symbol >= 0 || isin >= 0) && qty >= 0 && price >= 0) return { headerRow: r, symbol, qty, price, isin }
  }
  return null
}

// ── rows → holdings (same symbol twice is merged: quantities added, average price weighted) ──
export function extractHoldings(rows) {
  const cols = findColumns(rows)
  if (!cols) return { error: 'Could not find the columns. The file needs a header row with Symbol (or Instrument), Quantity and Avg price.' }
  const out = new Map(), bad = []
  for (let r = cols.headerRow + 1; r < rows.length; r++) {
    const row = rows[r]
    const sym = cols.symbol >= 0 ? String(row[cols.symbol] ?? '').trim() : ''
    const isin = cols.isin >= 0 ? String(row[cols.isin] ?? '').trim().toUpperCase() : ''
    if (!sym && !isin) continue
    if (/^(total|grand total|net)/i.test(sym)) continue
    const qty = toNumber(row[cols.qty]), price = toNumber(row[cols.price])
    const id = normalizeSymbol(sym) || isin
    if (!(qty > 0) || !(price > 0)) { bad.push({ sourceSymbol: sym || isin, isin, quantity: qty, avgPrice: price, line: r + 1 }); continue }
    const prev = out.get(id)
    if (prev) { const q = prev.quantity + qty; prev.avgPrice = (prev.avgPrice * prev.quantity + price * qty) / q; prev.quantity = q }
    else out.set(id, { sourceSymbol: sym || isin, isin, quantity: qty, avgPrice: price, line: r + 1 })
  }
  return { items: [...out.values()], invalid: bad, columns: cols }
}

// ── match against the app's stock list (symbol → ISIN → loose symbol → BSE code) ──
export function buildStockIndex(stocks) {
  const bySym = new Map(), byIsin = new Map(), byLoose = new Map(), byBse = new Map()
  for (const s of stocks || []) {
    if (!s || !s.symbol) continue
    bySym.set(String(s.symbol).toUpperCase(), s)
    if (s.isin) byIsin.set(String(s.isin).toUpperCase(), s)
    const l = loose(s.symbol); if (l && !byLoose.has(l)) byLoose.set(l, s)
    if (s.bseCode) byBse.set(String(s.bseCode).trim(), s)
  }
  return { bySym, byIsin, byLoose, byBse }
}
export function matchStock(item, idx) {
  const sym = normalizeSymbol(item.sourceSymbol)
  return idx.bySym.get(sym) || (item.isin && idx.byIsin.get(item.isin)) || idx.byLoose.get(loose(sym)) || (/^\d{6}$/.test(sym) && idx.byBse.get(sym)) || null
}
