import { useEffect, useState } from 'react'
import * as api from '../services/api'

// Live gold / silver value from weight + purity. Same rules as the server (gas-webapp Utilities.js
// metalLiveValue_), so the page and the dashboard always agree. Prices are ₹ per gram,
// Indian retail: gold24 = 24K, silver999 = 999 fine.
const GOLD_FACTOR = { '24K': 1, '24': 1, '999': 1, '995': 0.995, '22K': 0.9166, '22': 0.9166, '916': 0.9166, '18K': 0.75, '18': 0.75, '750': 0.75, '14K': 0.585, '14': 0.585 }
const SILVER_FACTOR = { '999': 1, '925': 0.925, '900': 0.9, '800': 0.8 }
export const GOLD_TYPES = ['Physical Gold', 'Digital Gold', 'Sovereign Gold Bond']

export function metalLiveValue(type, dynamicFields, prices) {
  const w = Number(dynamicFields?.weightGrams)
  if (!(w > 0) || !prices) return 0
  const purity = String(dynamicFields?.purity || '').toUpperCase().replace(/\s|KARAT|CARAT/g, '')
  if (GOLD_TYPES.includes(type)) {
    if (!prices.gold24) return 0
    const per = type === 'Sovereign Gold Bond' ? prices.gold24 / 1.03 : prices.gold24 * (GOLD_FACTOR[purity] || 1)
    return Math.round(w * per)
  }
  if (/silver/i.test(String(type || ''))) {
    if (!prices.silver999) return 0
    return Math.round(w * prices.silver999 * (SILVER_FACTOR[purity] || 1))
  }
  return 0
}

const KEY = 'cf_market_data'
function fromMarket(d) {
  if (!d || !d.metals) return null
  const g = d.metals.find((m) => /gold/i.test(m.name))
  const s = d.metals.find((m) => /silver/i.test(m.name))
  return { gold24: g?.price || 0, silver999: s?.price || 0, asOf: d.asOf || (d._ts ? new Date(d._ts).toISOString() : null), stale: !!d.stale }
}
function cached() {
  try { const d = JSON.parse(sessionStorage.getItem(KEY) || 'null'); return d ? { ...fromMarket(d), _ts: d._ts || 0 } : null } catch { return null }
}

/** Today's gold / silver price; refreshed from the server when older than 30 minutes. */
export function useMetalPrices() {
  const [prices, setPrices] = useState(() => cached())
  useEffect(() => {
    let alive = true
    const c = cached()
    if (c && c.gold24 && Date.now() - c._ts < 30 * 60 * 1000) return
    api.getMarketData().then((d) => {
      if (!alive || !d) return
      const merged = { ...d, _ts: Date.now() }
      try { sessionStorage.setItem(KEY, JSON.stringify(merged)) } catch { /* ignore */ }
      setPrices(fromMarket(merged))
    }).catch(() => {})
    return () => { alive = false }
  }, [])
  return prices
}
