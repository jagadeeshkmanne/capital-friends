// Daily NAV history per mutual fund (AMFI scheme code), for the "value over time" line.
// Source: api.mfapi.in (free, public AMFI NAV history). Kept in this browser's IndexedDB
// (its own small database) and refreshed once a day. Best-effort: on any error the chart
// simply shows the invested line only.

const DB = 'cf-nav-history', STORE = 'nav', VERSION = 1
let dbp = null
function db() {
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      const r = indexedDB.open(DB, VERSION)
      r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE, { keyPath: 'code' }) }
      r.onsuccess = () => resolve(r.result)
      r.onerror = () => { dbp = null; reject(r.error) }
    })
  }
  return dbp
}
async function idbGet(code) {
  try { const d = await db(); return await new Promise((res) => { const q = d.transaction(STORE).objectStore(STORE).get(code); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null) }) } catch { return null }
}
async function idbPut(rec) {
  try { const d = await db(); d.transaction(STORE, 'readwrite').objectStore(STORE).put(rec) } catch { /* ignore */ }
}
const today = () => new Date().toISOString().slice(0, 10)

/** { times: [UTC day seconds ascending], navs: [number] } or null */
export async function getNavHistory(code) {
  code = String(code || '').trim()
  if (!/^\d+$/.test(code) || Number(code) >= 900000000) return null // SIF codes: no history on mfapi.in
  const cached = await idbGet(code)
  if (cached && cached.day === today()) return cached
  try {
    const r = await fetch(`https://api.mfapi.in/mf/${code}`)
    if (!r.ok) throw new Error('HTTP ' + r.status)
    const j = await r.json()
    const rows = (j.data || []).map((x) => {
      const [dd, mm, yy] = String(x.date).split('-').map(Number)
      return [Date.UTC(yy, mm - 1, dd) / 1000, parseFloat(x.nav)]
    }).filter((x) => x[0] && x[1] > 0).sort((a, b) => a[0] - b[0])
    const rec = { code, day: today(), times: rows.map((x) => x[0]), navs: rows.map((x) => x[1]) }
    if (rec.times.length) idbPut(rec)
    return rec
  } catch {
    return cached || null // stale is better than nothing
  }
}

/** Load many codes, a few at a time. Returns Map(code -> history). */
export async function getNavHistories(codes, concurrency = 6) {
  const list = [...new Set((codes || []).map(String))]
  const out = new Map()
  let i = 0
  async function worker() {
    while (i < list.length) {
      const c = list[i++]
      const h = await getNavHistory(c)
      if (h) out.set(c, h)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, list.length) }, worker))
  return out
}

/**
 * Value of the holdings on each of the given days (UTC day seconds, ascending).
 * txns: [{ date (ms), fundCode, type: 'BUY'|'SELL', units, price }]
 * Units held come from the transactions; price = that day's NAV (or, if a fund has no NAV
 * history, the last transaction price). Returns { values: [number], missing: [codes] }.
 */
export function valueOnDays(days, txns, navMap) {
  const byCode = new Map()
  ;(txns || []).forEach((t) => {
    const c = String(t.fundCode || '')
    if (!c || !(t.units > 0)) return
    if (!byCode.has(c)) byCode.set(c, [])
    byCode.get(c).push(t)
  })
  const values = days.map(() => 0)
  const missing = []
  byCode.forEach((list, code) => {
    list.sort((a, b) => a.date - b.date)
    const nav = navMap.get(code)
    if (!nav) missing.push(code)
    let ti = 0, units = 0, lastPrice = 0, ni = 0, curNav = 0
    days.forEach((day, k) => {
      const dayEndMs = (day + 86400) * 1000
      while (ti < list.length && list[ti].date < dayEndMs) {
        const t = list[ti++]
        units += t.type === 'SELL' ? -t.units : t.units
        if (t.price > 0) lastPrice = t.price
      }
      if (nav) {
        while (ni < nav.times.length && nav.times[ni] <= day) { curNav = nav.navs[ni]; ni++ }
      }
      const px = curNav || lastPrice
      if (units > 0.0001 && px > 0) values[k] += units * px
    })
  })
  return { values, missing }
}
