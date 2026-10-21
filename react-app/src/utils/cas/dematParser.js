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

const HEADER_RE = /ISIN|Security|\bBal\b|^Bal|Value$|^Value|Pledge|^Market|Current|^Page \d|Central Depository|CONSOLIDATED ACCOUNT|FORM AND INVESTMENTS|Summary of|Account Details|^Investments|[\u0900-\u097F\uFFFD]|CIN\s*:/   // page headers (bilingual lines)
// a line that finishes the previous holding's name ("AFTER SPLIT", "SHARES", "OF RS.2/-…", "FUND-DIRECT-GROWTH")
const CONT_RE = /^(LIMITED|LTD|EQUITY|ASSET|AFTER|SHARES\b|OF R[SE]|RS\.?\s?\d|RE\.?\s?\d|CAPITAL REDUCTION|CONSOLIDATION|SUB-?DIVISION|SPLIT|FUND-|PLAN-|\(I\) LTD\]|1\/-|WITH FACE VALUE|\[FORMERLY)/i
const DEPOSITORY_RE = /(CDSL|NSDL)\s+Demat\s+Account/i
const ENTER_RE = /HOLDING STATEMENT AS ON|^\s*(Equities|Equity Shares|Equity)\s*(\(E\))?\s*$/i
const LEAVE_RE = /Other Details|Portfolio Value|MUTUAL FUND UNITS HELD|STATEMENT OF TRANSACTIONS|Mutual Fund Folios \(F\)|^\s*Total\b|Corporate Bonds|Government Securities|Money Market|Securitised|Mutual Funds \(M\)/i
// NSDL layout: "NSDL Demat Account  <BROKER>  DP ID:IN300214 Client ID:12345678" (one line, or the type / broker
// on the lines just above the DP ID line; joint accounts add holder names and PANs on those lines)
const DP_CLIENT_RE = /DP\s*ID\s*:?\s*([A-Z0-9]{8})\s*,?\s*Client\s*ID\s*:?\s*(\d{8})/i
const TYPE_RE = /\b(NSDL|CDSL)\s+Demat\s+Account\b/i
const BROKER_WORDS = /\b(LIMITED|LTD|BANK|SECURITIES|BROKING|BROKERS?|CAPITAL|PVT|PRIVATE|INVESTMENTS?|FINANCIAL|STOCK|SHARES?|WEALTH|DEPOSITORY)\b/i
/** The broker's name from an NSDL account header (the text around "Demat Account" and before "DP ID"), or ''. */
function nsdlBroker(texts) {
  for (const t of texts) {
    const s = String(t || '').replace(TYPE_RE, ' ').replace(/DP\s*ID[\s\S]*$/i, ' ').replace(/[^\s()]*\(\s*PAN\s*:[^)]*\)/gi, ' ')
      .replace(/ACCOUNT HOLDERS?/gi, ' ').replace(/\s{2,}/g, '  ').trim()
    // the broker is the part that reads like a company ("ZERODHA BROKING LIMITED"), not a person's name
    const parts = s.split(/\s{2,}/).map((x) => x.trim()).filter(Boolean)
    const hit = parts.find((x) => BROKER_WORDS.test(x)) || (parts.length === 1 && s.length < 60 && !/\d{4}/.test(s) ? parts[0] : '')
    if (hit) return hit.replace(/[:\s]+$/, '')
  }
  return ''
}

/**
 * @returns {{ holder, pan, asOf, depository, accounts: [{ depository, broker, dpId, clientId, boId, holdings: [{ isin, name, qty, price, value }] }] }}
 */
export function parseDematCas(lines) {
  const out = { holder: '', pan: '', asOf: '', depository: '', accounts: [] }
  let acc = null, inHold = false, depo = '', buf = []   // buf: text lines since the last holding (name parts, ** / !! marks)
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
    // NSDL account header (no "DP Name :" label): the DP ID / Client ID line, with "NSDL|CDSL Demat Account" on it or
    // just above. Footnotes that mention "demat account" have no DP ID, so they never start an account.
    const dpc = line.match(DP_CLIENT_RE)
    if (dpc) {
      const above = [lines[i - 1], lines[i - 2], lines[i - 3]].map((x) => String(x || ''))
      const typeAt = TYPE_RE.test(line) ? 0 : above.findIndex((x) => TYPE_RE.test(x)) + 1
      if (typeAt > 0 || TYPE_RE.test(line)) {
        const tm = (typeAt === 0 ? line : above[typeAt - 1]).match(TYPE_RE)
        const dpId = dpc[1].toUpperCase(), clientId = dpc[2]
        const broker = nsdlBroker([line, ...above.slice(0, Math.max(typeAt, 1))])
        const found = out.accounts.find((a) => a.dpId === dpId && a.clientId === clientId)
        // the same account's header again at the top of the next page: the table it was in carries on
        const carryOn = !!found && found === acc && inHold
        acc = found || { depository: tm ? tm[1].toUpperCase() : /^IN/.test(dpId) ? 'NSDL' : 'CDSL', broker, dpId, clientId, boId: dpId + clientId, holdings: [] }
        if (!found) out.accounts.push(acc)
        else if (!found.broker && broker) found.broker = broker
        if (!out.depository) out.depository = acc.depository
        inHold = carryOn
        buf = []
        continue
      }
    }
    if (!acc) continue
    if (LEAVE_RE.test(line)) { inHold = false; buf = []; continue }
    if (ENTER_RE.test(line)) { inHold = true; buf = []; continue }
    if (!inHold) continue

    const im = line.match(ISIN_RE)
    if (!im) { if (!HEADER_RE.test(line) && line.trim().toUpperCase() !== out.holder.toUpperCase()) buf.push(line); continue }   // the holder's name repeats on every page
    const isin = im[1]
    let rest = line.slice(line.indexOf(isin) + isin.length)
    let nums = readHoldingNumbers(rest)
    if (!nums && lines[i + 1] && !ISIN_RE.test(lines[i + 1])) { rest += ' ' + lines[i + 1]; nums = readHoldingNumbers(rest) }
    if (!nums || !(nums.value > 0)) { buf = []; continue }   // lock-in / pledge sub-tables have no value
    const nameOnLine = rest.split(/\s{2,}/).map((t) => t.trim()).filter((t) => t && !NUM_RE.test(t) && t !== '--')[0] || ''
    // the statement's own marks: ** under liquidation / winding up, !! no trade for over a year (valued at face value)
    const marks = [...buf, line].join(' ')
    const flag = /\*\*/.test(marks) ? 'liquidation' : /!!/.test(marks) ? 'notTraded' : ''
    const parts = buf.map((t) => t.replace(/[*!$@#]{2,}/g, ' ').trim()).filter((t) => t && !CONT_RE.test(t))
    const name = [...parts, nameOnLine.replace(/[*!$@#]{2,}/g, ' ')].join(' ').replace(/\s+/g, ' ').trim()
    const rights = /RIGHTS|ENTITLEMENT/i.test(`${buf.join(' ')} ${nameOnLine}`)
    const prev = acc.holdings.find((h) => h.isin === isin)
    if (prev) { prev.qty += nums.qty; prev.value += nums.value }
    else acc.holdings.push({ isin, name, qty: nums.qty, price: nums.price, value: nums.value, flag: rights ? 'rights' : flag })
    buf = []
  }
  if (!out.asOf) { const m = lines.join('\n').match(/period\s+from\s+\S+\s+to\s+(\d{2}-\d{2}-\d{4}|\d{2}-[A-Za-z]{3}-\d{4})/i); if (m) out.asOf = m[1] }
  out.accounts = out.accounts.filter((a) => a.holdings.length || a.broker)
  return out
}

/** Short broker name for a portfolio: "SHAREKHAN LIMITED" → "Sharekhan", "GROWW INVEST TECH PRIVATE LIMITED" → "Groww". */
export function shortBroker(name) {
  const w = String(name || '').replace(/\b(PRIVATE|PVT|LIMITED|LTD|SECURITIES|BROKING|INVEST|TECH|CAPITAL|SERVICES|FINANCIAL|INDIA|STOCK|BROKERS?|AND|&)\b\.?/gi, ' ').replace(/\s+/g, ' ').trim()
  const first = (w || String(name || '')).split(' ')[0] || ''
  return first ? first[0].toUpperCase() + first.slice(1).toLowerCase() : ''
}
