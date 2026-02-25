import { useState, useEffect, useRef } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'
import * as api from '../services/api'

const MARKET_CACHE_KEY = 'cf_market_data'
const MARKET_CACHE_TTL = 5 * 60 * 1000 // 5 minutes
const REFRESH_INTERVAL = 5 * 60 * 1000 // 5 minutes

function getCachedMarketData() {
  try {
    const raw = sessionStorage.getItem(MARKET_CACHE_KEY)
    if (!raw) return null
    const cached = JSON.parse(raw)
    if (Date.now() - cached._ts > MARKET_CACHE_TTL) return null
    return cached
  } catch { return null }
}

function setCachedMarketData(data) {
  try {
    sessionStorage.setItem(MARKET_CACHE_KEY, JSON.stringify({ ...data, _ts: Date.now() }))
  } catch { /* ignore */ }
}

export default function MarketTicker() {
  const [data, setData] = useState(() => getCachedMarketData())
  const [btc, setBtc] = useState(null)
  const trackRef = useRef(null)
  const [shouldAnimate, setShouldAnimate] = useState(false)
  const [paused, setPaused] = useState(false)

  // Fetch market data from GAS backend
  useEffect(() => {
    let cancelled = false

    async function fetchMarket() {
      try {
        const result = await api.getMarketData()
        if (!cancelled && result) {
          const merged = { ...result, _ts: Date.now() }
          setData(merged)
          setCachedMarketData(merged)
        }
      } catch {
        // Silent fail — ticker is non-critical
      }
    }

    fetchMarket()
    const interval = setInterval(fetchMarket, REFRESH_INTERVAL)
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  // Fetch BTC from CoinGecko (CORS-friendly, no key needed)
  useEffect(() => {
    let cancelled = false

    async function fetchBTC() {
      try {
        const resp = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=inr&include_24hr_change=true')
        if (!cancelled && resp.ok) {
          const json = await resp.json()
          if (json.bitcoin) {
            setBtc({
              name: 'BTC',
              price: json.bitcoin.inr,
              changePct: json.bitcoin.inr_24h_change || 0,
              type: 'crypto'
            })
          }
        }
      } catch { /* Silent fail */ }
    }

    fetchBTC()
    const interval = setInterval(fetchBTC, REFRESH_INTERVAL)
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  // Build ticker items
  const items = []
  if (data?.indices) items.push(...data.indices)
  if (data?.metals) items.push(...data.metals)
  if (btc) items.push(btc)

  // Check if content overflows and needs scrolling
  useEffect(() => {
    if (!trackRef.current) return
    const track = trackRef.current
    const container = track.parentElement
    setShouldAnimate(track.scrollWidth > container.clientWidth)
  }, [items.length])

  if (items.length === 0) return null

  // Duration proportional to number of items (slower = more readable)
  const duration = items.length * 3

  return (
    <div
      className="bg-[var(--bg-card)]/80 backdrop-blur-sm border-b border-[var(--border-light)] overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => setPaused(false)}
    >
      <div className="overflow-hidden">
        <div
          ref={trackRef}
          className="flex items-stretch w-max"
          style={shouldAnimate ? {
            animation: `ticker-scroll ${duration}s linear infinite`,
            animationPlayState: paused ? 'paused' : 'running',
          } : { margin: '0 auto' }}
        >
          {items.map((item, i) => (
            <TickerItem key={item.name + i} item={item} />
          ))}
          {/* Duplicate for seamless loop */}
          {shouldAnimate && items.map((item, i) => (
            <TickerItem key={'dup-' + item.name + i} item={item} />
          ))}
        </div>
      </div>
      <style>{`
        @keyframes ticker-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  )
}

function TickerItem({ item }) {
  const isUp = item.changePct >= 0
  const arrow = isUp ? <TrendingUp size={10} /> : <TrendingDown size={10} />
  const color = isUp ? 'text-emerald-400' : 'text-[var(--accent-rose)]'

  const formatPrice = (price) => {
    if (price >= 100000) return `₹${(price / 100000).toFixed(2)}L`
    if (price >= 1000) return `₹${price.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
    return `₹${price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
  }

  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 border-r border-[var(--border-light)] last:border-0 shrink-0">
      <span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase whitespace-nowrap">{item.name}</span>
      <span className="text-[11px] font-bold text-[var(--text-primary)] tabular-nums whitespace-nowrap">
        {item.unit ? `${formatPrice(item.price)}` : formatPrice(item.price)}
      </span>
      {item.changePct !== undefined && item.changePct !== null && (
        <span className={`flex items-center gap-0.5 text-[10px] font-bold tabular-nums ${color}`}>
          {arrow}
          {isUp ? '+' : ''}{item.changePct.toFixed(2)}%
        </span>
      )}
    </div>
  )
}
