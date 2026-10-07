// CAMS / KFintech Consolidated Account Statement (CAS) reader.
// Pure functions (no browser APIs), so the same code runs in the app and in Node tests.
//
//   linesFromTextItems(items)  -> text lines of one PDF page, in reading order
//   parseCamsCas(lines)        -> { meta, folios, problems }
//
// Each folio entry is one scheme in one folio, with its full transaction list.
// Units of every entry are checked: opening + all transactions must equal the closing balance.

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 }

// Known platform codes printed as "Advisor:" on each scheme line
export const PLATFORMS = {
  INZ000031633: 'Zerodha',
  INZ000208032: 'Groww',
  DIRECT: 'Direct',
}
export function platformName(code) {
  if (!code) return 'Unknown'
  if (PLATFORMS[code]) return PLATFORMS[code]
  if (/^ARN-/i.test(code)) return 'Distributor ' + code.toUpperCase()
  if (/^INA/i.test(code)) return 'Adviser ' + code.toUpperCase()
  if (/^INZ/i.test(code)) return 'Broker ' + code.toUpperCase()
  return code
}

// ---------- PDF text -> lines ----------
// pdf.js gives text pieces with x/y positions, not in reading order.
// Group them by line (same y), sort by x, and join: a wide gap becomes two spaces (column break).
export function linesFromTextItems(items) {
  const pieces = []
  for (const it of items) {
    if (!it || typeof it.str !== 'string') continue
    const s = it.str
    if (!s.trim()) continue
    pieces.push({ s, x: it.transform[4], y: it.transform[5], w: it.width || 0 })
  }
  pieces.sort((a, b) => b.y - a.y || a.x - b.x)
  const rows = []
  for (const p of pieces) {
    const row = rows.find(r => Math.abs(r.y - p.y) <= 2.2)
    if (row) row.items.push(p)
    else rows.push({ y: p.y, items: [p] })
  }
  rows.sort((a, b) => b.y - a.y)
  return rows.map(r => {
    r.items.sort((a, b) => a.x - b.x)
    let out = '', end = null
    for (const p of r.items) {
      if (end !== null) {
        const gap = p.x - end
        if (gap > 7) out += '   '
        else if (gap > 1.2) out += ' '
      }
      out += p.s
      end = p.x + p.w
    }
    return out.replace(/\s+$/, '')
  })
}

// ---------- helpers ----------
const NUM = /\(?-?[\d,]+\.\d+\)?/g
function num(s) {
  if (s == null) return 0
  s = String(s).replace(/,/g, '')
  const neg = s.startsWith('(') || s.startsWith('-')
  const v = parseFloat(s.replace(/[()\-]/g, ''))
  return isNaN(v) ? 0 : (neg ? -v : v)
}
function isoDate(dmy) {
  const m = /^(\d{2})-([A-Za-z]{3})-(\d{4})$/.exec(dmy)
  if (!m) return null
  const mo = MONTHS[m[2].toLowerCase()]
  return `${m[3]}-${String(mo).padStart(2, '0')}-${m[1]}`
}
const round3 = v => Math.round(v * 1000) / 1000

// What a transaction line means for the app.
//  BUY      money in from the bank (purchase, SIP, NFO)
//  REDEEM   money out to the bank
//  SWITCH_IN / SWITCH_OUT   moved between the investor's own funds (switch, STP, lateral shift, consolidation)
//  DIV_REINVEST  units added from dividend reinvestment (not new money)
//  OTHER    anything that moves units but isn't recognised (reported as a problem)
export function classify(desc, units) {
  const d = String(desc || '').toLowerCase().replace(/\bs\s?t\s?p\b/g, 'stp')
  if (/switch[\s-]*in\b|lateral( shift)? in\b|consolidation in|stp in|systematic transfer (plan )?in|transfer in\b|transmission in|merger/.test(d)) return 'SWITCH_IN'
  if (/switch[\s-]*out|lateral( shift)? out\b|consolidation out|stp out|systematic transfer (plan )?out|transfer out\b|transmission out/.test(d)) return 'SWITCH_OUT'
  if (/reinvest/.test(d) && /(idcw|dividend|div\.)/.test(d)) return 'DIV_REINVEST'
  if (/redemption|redeem|\bswp\b|systematic withdrawal/.test(d)) return 'REDEEM'
  if (/purchase|systematic investment|\bsip\b|nfo|allotment|subscription/.test(d)) return 'BUY'
  if (units > 0) return 'OTHER_IN'
  if (units < 0) return 'OTHER_OUT'
  return 'OTHER'
}

// ---------- the statement ----------
export function parseCamsCas(lines) {
  const meta = { source: 'CAMS', from: null, to: null, email: null, investor: null }
  const folios = []
  const problems = []
  const folioHolder = {}

  // first pass: remember each folio's holder name (the line after "Folio No:" can be a page header)
  for (let i = 0; i < lines.length; i++) {
    const m = /^Folio No:\s*(\S+(?:\s*\/\s*\S+)?)/.exec(lines[i].trim())
    if (m) {
      const h = (lines[i + 1] || '').trim()
      if (h && !/^CAMSCAS|^Page \d|Consolidated Account Statement/i.test(h) && !folioHolder[normFolio(m[1])]) folioHolder[normFolio(m[1])] = h.replace(/\s{2,}.*$/, '')
    }
  }

  let folio = null, pan = null, holder = null, cur = null, lastTx = null, amc = null
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const l = raw.trim()
    if (!l) continue

    if (!meta.from) {
      const pm = /(\d{2}-[A-Za-z]{3}-\d{4})\s+To\s+(\d{2}-[A-Za-z]{3}-\d{4})/.exec(l)
      if (pm) { meta.from = isoDate(pm[1]); meta.to = isoDate(pm[2]) }
    }
    if (!meta.email) { const em = /Email Id:\s*(\S+@\S+)/i.exec(l); if (em) meta.email = em[1].toLowerCase() }

    if (/Mutual Fund$|^[A-Z][A-Za-z ]+ MF$/.test(l) && !/:/.test(l) && l.length < 60) amc = l

    const fm = /^Folio No:\s*(\S+(?:\s*\/\s*\S+)?)/.exec(l)
    if (fm) {
      folio = normFolio(fm[1])
      const pm = /PAN:\s*([A-Z]{5}[0-9]{4}[A-Z])/.exec(l)
      pan = pm ? pm[1] : null
      holder = folioHolder[folio] || null
      continue
    }

    if (/ISIN:/.test(l) && folio) {
      // the scheme line; ISIN and "Advisor:" code can wrap onto the next lines
      // the scheme name can start on the line before ("... Growth (Non" / "-Demat) - ISIN: ...")
      let head = l
      if (!/^[A-Z0-9]+-/.test(l)) {
        for (let k = i - 1; k >= 0 && k >= i - 2; k--) { const pl = lines[k].trim(); if (/^[A-Z0-9]+-/.test(pl)) { head = pl.replace(/\s{2,}.*$/, '') + ' ' + l; break } }
      }
      const block = [head]
      for (let k = i + 1; k < Math.min(lines.length, i + 6); k++) {
        const nl = lines[k].trim()
        if (/^(Nominee|Opening Unit Balance|Folio No|\d{2}-[A-Za-z]{3}-\d{4})/i.test(nl) || /ISIN:/.test(nl)) break
        block.push(nl)
      }
      const joined = block.join(' ')
      let isin = (/ISIN:\s*([A-Z0-9]+)/.exec(l) || [])[1] || ''
      if (isin.length < 12) { const nx = (/^([A-Z0-9]+)/.exec(block[1]) || [])[1] || ''; isin = (isin + nx).slice(0, 12) }
      const adv = /Advisor:[\s\S]*?\b(INZ\d{9}|INA\d{9}|ARN-\d+|DIRECT)\b/i.exec(joined)
      const before = head.split(/\s+-\s+ISIN/)[0]
      const demat = /Demat\)/i.test(before) && !/Non[\s-]*Demat/i.test(before)
      let scheme = before.replace(/^[A-Z0-9]+-/, '').replace(/\s*\((?:Non[\s-]*)?\s*-?Demat\)\s*$/i, '').replace(/\s*\(Non\s+-?Demat\)\s*$/i, '').trim()
      cur = {
        folio, pan, holder: holder || '', amc, isin, scheme,
        platformCode: adv ? adv[1].toUpperCase() : (/Advisor/i.test(joined) ? null : 'DIRECT'),
        demat: !!demat, opening: 0, close: null, cost: null, mv: null, nav: null, navDate: null, txns: [],
      }
      cur.platform = platformName(cur.platformCode)
      lastTx = null
      continue
    }
    if (!cur) continue

    const ob = /Opening Unit Balance:\s*([\d,.]+)/.exec(l)
    if (ob) { cur.opening = num(ob[1]); continue }

    const tm = /^(\d{2}-[A-Za-z]{3}-\d{4})\s+(.*)$/.exec(l)
    if (tm) {
      const date = isoDate(tm[1]), rest = tm[2]
      const desc = rest.split(/\s{2,}/)[0].trim()
      const nums = (rest.match(NUM) || []).filter(n => /\d\.\d/.test(n))
      if (/^\*{3}/.test(desc)) {                     // *** Stamp Duty *** / *** STT Paid *** / notices
        const amt = nums.length ? Math.abs(num(nums[nums.length - 1])) : 0
        if (/stamp/i.test(desc) && lastTx) lastTx.stamp = round2(lastTx.stamp + amt)
        else if (/stt|tds/i.test(desc) && lastTx) lastTx.tax = round2(lastTx.tax + amt)
        continue
      }
      if (nums.length >= 4) {
        const t = { date, desc, amount: num(nums[nums.length - 4]), units: num(nums[nums.length - 3]), nav: num(nums[nums.length - 2]), balance: num(nums[nums.length - 1]), stamp: 0, tax: 0 }
        t.kind = classify(desc, t.units)
        cur.txns.push(t); lastTx = t
      } else {
        lastTx = null                                // e.g. "Consolidation In ... 101.233" (only a balance): no units move here
      }
      continue
    }

    const cm = /Closing Unit Balance:\s*([\d,.]+)/.exec(l)
    if (cm) {
      cur.close = num(cm[1])
      const nv = /NAV on (\d{2}-[A-Za-z]{3}-\d{4}):\s*INR\s*([\d,.]+)/.exec(l); if (nv) { cur.navDate = isoDate(nv[1]); cur.nav = num(nv[2]) }
      const cv = /Total Cost Value:\s*([\d,.]+)/.exec(l); if (cv) cur.cost = num(cv[1])
      const mv = /Market Value on [^:]+:\s*INR\s*([\d,.]+)/.exec(l); if (mv) cur.mv = num(mv[1])
      finish(cur)
      folios.push(cur); cur = null; lastTx = null
    }
  }

  function finish(f) {
    const sum = f.txns.reduce((s, t) => s + t.units, f.opening)
    f.unitsCheck = round3(sum)
    f.reconciled = Math.abs(sum - f.close) < 0.002
    if (!f.reconciled) problems.push({ type: 'UNITS_MISMATCH', folio: f.folio, isin: f.isin, scheme: f.scheme, expected: f.close, got: round3(sum) })
    for (const t of f.txns) if (t.kind.startsWith('OTHER') && t.units) problems.push({ type: 'UNKNOWN_TRANSACTION', folio: f.folio, isin: f.isin, date: t.date, desc: t.desc })
    if (!f.holder) problems.push({ type: 'NO_HOLDER', folio: f.folio, isin: f.isin, scheme: f.scheme })
  }
  meta.investor = folios.length ? null : null
  return { meta, folios, problems }
}

function normFolio(s) { return String(s).replace(/\s+/g, '') }
function round2(v) { return Math.round(v * 100) / 100 }

// Money in / out of the bank for one folio entry (switches are internal and not counted)
export function folioMoney(f) {
  let moneyIn = 0, moneyOut = 0
  for (const t of f.txns) {
    if (t.kind === 'BUY') moneyIn += t.amount + t.stamp
    else if (t.kind === 'REDEEM') moneyOut += -t.amount - t.tax
  }
  return { moneyIn: round2(moneyIn), moneyOut: round2(moneyOut) }
}
