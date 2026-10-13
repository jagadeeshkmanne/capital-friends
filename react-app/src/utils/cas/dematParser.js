// Reads the demat (shares) part of a CDSL or NSDL Consolidated Account Statement (CAS).
// Input: the text lines of the PDF (linesFromTextItems). Output: each demat account with its holdings.
// The statement has quantity, market price and value for each ISIN, but NOT the buy price.

const ISIN_RE = /\b(IN[A-Z0-9]{10})\b/
const NUM_RE = /^-?\d[\d,]*(\.\d+)?$/
const num = (s) => parseFloat(String(s).replace(/,/g, ''))

/** Split a doubled header value ("SHAREKHAN LIMITEDSHAREKHAN LIMITED" → "SHAREKHAN LIMITED"). */
function undouble(s) {
  const t = String(s || '').trim()
  if (t.length % 2 === 0) { const h = t.slice(0, t.length / 2); if (h + h === t) return h.trim() }
  return t
}

/** Numbers on a holdings line after the ISIN → { qty, price, value } (qty × price ≈ value picks the quantity). */
export function readHoldingNumbers(text) {
  const tokens = String(text).split(/\s+/).filter((t) => NUM_RE.test(t)).map(num)
  if (tokens.length < 3) return null
  const value = tokens[tokens.length - 1], price = tokens[tokens.length - 2]
  const qtys = tokens.slice(0, -2)
  let qty = qtys.find((q) => q > 0 && Math.abs(q * price - value) <= Math.max(1, value * 0.01))
  if (qty === undefined) qty = qtys.find((q) => q > 0)
  if (!(qty > 0) || !(price >= 0)) return null
  return { qty, price, value }
}

const DEPOSITORY_RE = /(CDSL|NSDL)\s+Demat\s+Account/i
const ENTER_RE = /HOLDING STATEMENT AS ON|^\s*(Equities|Equity Shares|Equity)\s*(\(E\))?\s*$/i
const LEAVE_RE = /Other Details|Portfolio Value|MUTUAL FUND UNITS HELD|STATEMENT OF TRANSACTIONS|Mutual Fund Folios \(F\)|^\s*Total\b/i

/**
 * @returns {{ holder, pan, asOf, depository, accounts: [{ depository, broker, dpId, clientId, boId, holdings: [{ isin, name, qty, price, value }] }] }}
 */
export function parseDematCas(lines) {
  const out = { holder: '', pan: '', asOf: '', depository: '', accounts: [] }
  let acc = null, inHold = false, depo = '', prevText = ''
  for (let i = 0; i < lines.length; i++) {
    const line = String(lines[i] || '')
    if (!out.pan) {
      const m = line.match(/^(.*?)\s*\(\s*PAN\s*:\s*([A-Z]{5}\d{4}[A-Z])\s*\)/) || line.match(/^([A-Z][A-Z .]+?)\s+PAN\s*:\s*([A-Z]{5}\d{4}[A-Z])/)
      if (m) { out.pan = m[2]; out.holder = m[1].replace(/^In the (single|joint) names? of\s*/i, '').trim() }
    }
    if (!out.asOf) { const m = line.match(/(?:HOLDING STATEMENT )?AS ON\s+(\d{2}-\d{2}-\d{4}|\d{2}-[A-Za-z]{3}-\d{4})/i); if (m) out.asOf = m[1] }
    const dm = line.match(DEPOSITORY_RE)
    if (dm) { depo = dm[1].toUpperCase(); if (!out.depository) out.depository = depo }

    // a new demat account section: "DP Name : … BO ID : …" (CDSL) or "DP Name : … DP ID : … Client ID : …" (NSDL)
    const dp = line.match(/DP Name\s*:\s*(?:DP का नाम:)?\s*(.+?)(?=\s+(?:BO ID|DP ID|DP Id|Client)|\s*$)/i)
    const bo = line.match(/BO ID\s*:\s*(?:BO ID:)?\s*(\d{16})/i)
    if (dp && (bo || /HOLDING|STATEMENT OF TRANSACTIONS/i.test(lines[i + 1] || '') || /BO ID|DP ID|Client/i.test(line))) {
      const broker = undouble(dp[1]).replace(/[:\s]+$/, '')
      const dpId = bo ? bo[1].slice(0, 8) : ((line.match(/DP\s*ID\s*:?\s*([A-Z0-9]{8})/i) || [])[1] || '')
      const clientId = bo ? bo[1].slice(8) : ((line.match(/Client\s*ID\s*:?\s*(\d{8})/i) || [])[1] || '')
      // the "Account Details" page lists accounts too (without holdings): reuse the same account
      acc = out.accounts.find((a) => a.dpId === dpId && a.clientId === clientId)
      if (!acc) { acc = { depository: /^IN/.test(dpId) ? 'NSDL' : (depo || 'CDSL'), broker, dpId, clientId, boId: dpId + clientId, holdings: [] }; out.accounts.push(acc) }
      inHold = false
      continue
    }
    if (!acc) { prevText = line; continue }
    if (LEAVE_RE.test(line)) { inHold = false; prevText = line; continue }
    if (ENTER_RE.test(line)) { inHold = true; prevText = ''; continue }
    if (!inHold) { prevText = line; continue }

    const im = line.match(ISIN_RE)
    if (!im) { prevText = line; continue }
    const isin = im[1]
    let rest = line.slice(line.indexOf(isin) + isin.length)
    let nums = readHoldingNumbers(rest)
    if (!nums && lines[i + 1] && !ISIN_RE.test(lines[i + 1])) { rest += ' ' + lines[i + 1]; nums = readHoldingNumbers(rest) }
    if (!nums || !(nums.value > 0)) { prevText = line; continue }   // lock-in / pledge sub-tables have no value
    const nameOnLine = rest.split(/\s{2,}/).map((t) => t.trim()).filter((t) => t && !NUM_RE.test(t) && t !== '--')[0] || ''
    const before = /ISIN|Security|Bal|Value|Pledge|Market|Current/i.test(prevText) ? '' : prevText.replace(/^[*!$@#\s]+/, '').trim()
    const name = [before, nameOnLine].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
    const prev = acc.holdings.find((h) => h.isin === isin)
    if (prev) { prev.qty += nums.qty; prev.value += nums.value }
    else acc.holdings.push({ isin, name, qty: nums.qty, price: nums.price, value: nums.value })
    prevText = ''
  }
  out.accounts = out.accounts.filter((a) => a.holdings.length || a.broker)
  return out
}

/** Short broker name for a portfolio: "SHAREKHAN LIMITED" → "Sharekhan", "GROWW INVEST TECH PRIVATE LIMITED" → "Groww". */
export function shortBroker(name) {
  const w = String(name || '').replace(/\b(PRIVATE|PVT|LIMITED|LTD|SECURITIES|BROKING|INVEST|TECH|CAPITAL|SERVICES|FINANCIAL|INDIA|STOCK|BROKERS?|AND|&)\b\.?/gi, ' ').replace(/\s+/g, ' ').trim()
  const first = (w || String(name || '')).split(' ')[0] || ''
  return first ? first[0].toUpperCase() + first.slice(1).toLowerCase() : ''
}
