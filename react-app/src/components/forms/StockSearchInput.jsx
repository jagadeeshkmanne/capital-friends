import { useState, useRef, useEffect, useMemo } from 'react'
import Fuse from 'fuse.js'
import { getAllStocks, getStockPrice, getQuote, getUsStocks } from '../../services/api'
import { getWithMeta, put } from '../../services/idb'
import { Search, X, Loader2 } from 'lucide-react'
import { fmtLocal } from '../../utils/currency'

// Module-level stock cache — loaded once, shared across all instances
let _stocksCache = null
let _stocksPromise = null

function isFreshToday(updatedAt) {
  if (!updatedAt) return false
  const cached = new Date(updatedAt)
  const now = new Date()
  return cached.getFullYear() === now.getFullYear() &&
    cached.getMonth() === now.getMonth() &&
    cached.getDate() === now.getDate()
}

let _forceFetch = false

// After Settings → Refresh Now: drop the cached list so the next search/import loads the new one
// (e.g. newly added ETFs) instead of waiting for tomorrow's cache expiry.
export function clearStocksCache() {
  _stocksCache = null
  _stocksPromise = null
  _forceFetch = true
  _fromIdb = false
  put('stocksList', null).catch(() => {})
}
// true when the list in memory came from today's browser cache (it may miss stocks/ETFs added since)
let _fromIdb = false
export const stocksFromCache = () => _fromIdb

export function loadStocks() {
  if (_stocksCache) return Promise.resolve(_stocksCache)
  if (_stocksPromise) return _stocksPromise
  const force = _forceFetch
  _forceFetch = false
  _stocksPromise = getWithMeta('stocksList')
    .then((record) => {
      if (!force && record && Array.isArray(record.data) && record.data.length && isFreshToday(record.updatedAt)) {
        _stocksCache = record.data
        _fromIdb = true
        return _stocksCache
      }
      return getAllStocks().then((data) => {
        _stocksCache = Array.isArray(data) ? data : []
        put('stocksList', _stocksCache)
        return _stocksCache
      })
    })
    .catch(() => {
      _stocksPromise = null
      return []
    })
  return _stocksPromise
}

// ── Stocks outside the Indian list ──
// Any market, written the Google Finance way: EXCHANGE:TICKER (NASDAQ:AAPL, NYSEARCA:VOO, LON:VOD, TYO:7203).
// BOM:517015 / NSE:XYZ work too for an Indian stock that isn't in the list yet.
export const DIRECT_SYMBOL_RE = /^([A-Z]{2,14}):([A-Z0-9][A-Z0-9.\-&]{0,19})$/
const INDIAN_EX = new Set(['NSE', 'BOM', 'BSE'])
export const isDirectSymbol = (s) => DIRECT_SYMBOL_RE.test(String(s || '').trim().toUpperCase())
export const isForeignSymbol = (s) => { const m = String(s || '').trim().toUpperCase().match(DIRECT_SYMBOL_RE); return !!m && !INDIAN_EX.has(m[1]) }
export const isUsSymbol = isForeignSymbol // older name

// US stocks and ETFs list (master DB, refreshed daily) — loaded only when someone searches
let _usCache = null, _usPromise = null
export function loadUsStocks() {
  if (_usCache) return Promise.resolve(_usCache)
  if (_usPromise) return _usPromise
  const fresh = (t) => t && Date.now() - new Date(t).getTime() < 86400000
  _usPromise = getWithMeta('usStocksList')
    .then((rec) => {
      if (rec && Array.isArray(rec.data) && rec.data.length && fresh(rec.updatedAt)) return rec.data
      return getUsStocks().then((rows) => {
        const list = (Array.isArray(rows) ? rows : []).map((r) => ({ symbol: r[0], ticker: r[1], companyName: r[2], exchange: 'US', usExchange: r[3], sector: r[4] === 'ETF' ? 'US ETF' : 'US stock', foreign: true }))
        if (list.length) put('usStocksList', list)
        return list
      })
    })
    .then((list) => { _usCache = list; return list })
    .catch(() => { _usPromise = null; return [] })
  return _usPromise
}
/** A US list entry by plain ticker (AAPL → NASDAQ:AAPL), for imports. */
export function usByTicker(list, ticker) {
  const t = String(ticker || '').trim().toUpperCase().replace(/-/g, '.')
  return (list || []).find((s) => s.ticker === t) || null
}

export default function StockSearchInput({ value, onSelect, placeholder, disabled }) {
  const [query, setQuery] = useState('')
  const [stocks, setStocks] = useState(_stocksCache || [])
  const [loading, setLoading] = useState(!_stocksCache)
  const [open, setOpen] = useState(false)
  const [fetchingPrice, setFetchingPrice] = useState(false)
  const [usBusy, setUsBusy] = useState('')
  const [usList, setUsList] = useState(_usCache || [])
  const [usErr, setUsErr] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    if (_stocksCache) { setStocks(_stocksCache); setLoading(false); return }
    loadStocks().then((data) => { setStocks(data); setLoading(false) })
  }, [])

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const fuse = useMemo(() => {
    if (!stocks.length) return null
    return new Fuse(stocks, {
      keys: [
        { name: 'symbol', weight: 2 },
        { name: 'companyName', weight: 1 },
      ],
      threshold: 0.3,
      distance: 80,
      minMatchCharLength: 1,
      includeScore: true,
      ignoreLocation: false,
      findAllMatches: true,
    })
  }, [stocks])

  const results = useMemo(() => {
    if (!fuse || query.length < 1) return []
    return fuse.search(query).slice(0, 50).map((r) => r.item)
  }, [fuse, query])

  // US stocks / ETFs: the list loads the first time someone types
  useEffect(() => {
    if (query.trim().length < 2 || usList.length) return
    loadUsStocks().then((l) => { if (l.length) setUsList(l) })
  }, [query, usList.length])
  const usFuse = useMemo(() => usList.length ? new Fuse(usList, { keys: [{ name: 'ticker', weight: 3 }, { name: 'companyName', weight: 1 }], threshold: 0.25, ignoreLocation: true, includeScore: true }) : null, [usList])
  const usResults = useMemo(() => {
    const q = query.trim()
    if (!usFuse || q.length < 2 || q.includes(':')) return []
    const up = q.toUpperCase()
    const exact = usList.filter((s) => s.ticker === up)
    const rest = usFuse.search(q).map((r) => r.item).filter((s) => s.ticker !== up)
    return [...exact, ...rest].slice(0, results.length ? 8 : 20)
  }, [usFuse, usList, query, results.length])
  // typed as EXCHANGE:TICKER and not in a list: offer to check it on Google Finance
  const direct = useMemo(() => {
    const t = query.trim().toUpperCase().replace(/^BSE:(\d{6})$/, 'BOM:$1')
    if (!isDirectSymbol(t)) return ''
    if (results.some((r) => String(r.symbol).toUpperCase() === t || r.gfNSE === t || r.gfBSE === t)) return ''
    if (usList.some((s) => s.symbol === t)) return ''
    return t
  }, [query, results, usList])
  const directUs = useMemo(() => direct ? [] : usList.filter((s) => s.symbol === query.trim().toUpperCase()), [direct, usList, query])
  const usShown = directUs.length ? directUs : usResults

  // Nothing found and the list is from the browser cache: it may be older than the sheet (e.g. ETFs
  // added today). Reload it from the server once, quietly.
  const refetched = useRef(false)
  useEffect(() => {
    if (results.length || query.length < 3 || refetched.current || !stocksFromCache()) return
    refetched.current = true
    clearStocksCache()
    loadStocks().then((data) => { if (data?.length) setStocks(data) })
  }, [results.length, query])

  function handleSearch(q) {
    setQuery(q)
    setOpen(q.length >= 1)
  }

  function handleSelect(stock) {
    onSelect({ symbol: stock.symbol, companyName: stock.companyName, exchange: stock.exchange, sector: stock.sector })
    setQuery('')
    setOpen(false)

    // Fetch current price in background
    setFetchingPrice(true)
    getStockPrice(stock.symbol)
      .then((result) => {
        if (result?.price > 0) {
          onSelect({ symbol: stock.symbol, companyName: stock.companyName, exchange: stock.exchange, sector: stock.sector, price: result.price })
        }
      })
      .catch(() => {})
      .finally(() => setFetchingPrice(false))
  }

  async function handleSelectUs(sym) {
    setUsBusy(sym); setUsErr('')
    try {
      const q = await getQuote(sym)
      if (!q?.valid) { setUsErr(q?.error || `No price found for ${sym}`); return }
      onSelect({ symbol: q.symbol, companyName: q.companyName, exchange: q.exchange, sector: q.sector, price: q.price, priceLocal: q.priceLocal, currency: q.currency, fx: q.fx })
      setQuery(''); setOpen(false)
    } catch (e) { setUsErr(e.message || 'Could not reach Google Finance') } finally { setUsBusy('') }
  }

  function handleClear() {
    onSelect({ symbol: '', companyName: '' })
    setQuery('')
  }

  if (value?.symbol) {
    return (
      <div className="flex items-center gap-2 bg-[var(--bg-inset)] border border-[var(--border)] rounded-lg px-3 py-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-[var(--text-primary)]">
            <span className="font-bold">{value.symbol}</span> — {value.companyName}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            {value.sector && <span className="text-xs text-[var(--text-dim)]">{value.sector}</span>}
            {fetchingPrice && <Loader2 size={10} className="text-violet-400 animate-spin" />}
            {!fetchingPrice && value.price > 0 && (
              <span className="text-xs font-semibold text-emerald-400 tabular-nums">
                CMP: ₹{value.price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                {value.currency && value.currency !== 'INR' && value.priceLocal > 0 && <span className="text-[var(--text-dim)] font-normal"> · {fmtLocal(value.priceLocal, value.currency)} at ₹{Number(value.fx).toFixed(2)} per {value.currency}</span>}
              </span>
            )}
          </div>
        </div>
        <button type="button" onClick={handleClear} className="shrink-0 p-1 rounded-md hover:bg-[var(--bg-hover)] text-[var(--text-dim)] hover:text-[var(--text-secondary)] transition-colors">
          <X size={14} />
        </button>
      </div>
    )
  }

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        {loading
          ? <Loader2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-violet-400 animate-spin" />
          : <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" />
        }
        <input
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          onFocus={() => query.length >= 1 && setOpen(true)}
          placeholder={loading ? 'Loading stocks...' : (placeholder || 'Search stock symbol or name...')}
          disabled={disabled || loading}
          className="w-full bg-[var(--bg-inset)] border border-[var(--border)] rounded-lg pl-9 pr-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-violet-500/50 disabled:opacity-50 transition-colors"
        />
      </div>

      {open && (results.length > 0 || usShown.length > 0 || !!direct) && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg shadow-xl max-h-[280px] overflow-y-auto">
          {results.map((stock) => (
            <button
              key={stock.symbol}
              type="button"
              onClick={() => handleSelect(stock)}
              className="w-full text-left px-3 py-2.5 hover:bg-[var(--bg-hover)] transition-colors border-b border-[var(--border-light)] last:border-0"
            >
              <p className="text-xs font-medium text-[var(--text-primary)] leading-tight">
                <span className="font-bold">{stock.symbol}</span> — {stock.companyName}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                {stock.exchange === 'BSE' && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-500">BSE</span>}
                {stock.sector && <span className="text-xs text-[var(--text-dim)]">{stock.sector}</span>}
                {stock.industry && <span className="text-xs text-[var(--text-dim)]">· {stock.industry}</span>}
              </div>
            </button>
          ))}
          {usShown.length > 0 && <p className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-dim)] border-t border-[var(--border-light)]">US stocks & ETFs</p>}
          {usShown.map((u) => (
            <button key={u.symbol} type="button" onClick={() => handleSelectUs(u.symbol)} disabled={!!usBusy}
              className="w-full text-left px-3 py-2.5 hover:bg-[var(--bg-hover)] transition-colors border-b border-[var(--border-light)] last:border-0 flex items-center gap-2">
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-500 shrink-0">US</span>
              <span className="text-xs text-[var(--text-primary)] flex-1 min-w-0 truncate"><b>{u.ticker}</b> — {u.companyName} <span className="text-[var(--text-dim)]">· {u.sector} · {u.usExchange}</span></span>
              {usBusy === u.symbol && <Loader2 size={12} className="text-violet-400 animate-spin" />}
            </button>
          ))}
          {direct && (
            <button type="button" onClick={() => handleSelectUs(direct)} disabled={!!usBusy}
              className="w-full text-left px-3 py-2.5 hover:bg-[var(--bg-hover)] transition-colors border-t border-[var(--border-light)] flex items-center gap-2">
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-400 shrink-0">{direct.split(':')[0]}</span>
              <span className="text-xs text-[var(--text-primary)] flex-1">Use <b>{direct}</b> <span className="text-[var(--text-dim)]">· check the price on Google Finance</span></span>
              {usBusy === direct && <Loader2 size={12} className="text-violet-400 animate-spin" />}
            </button>
          )}
          {usErr && <p className="px-3 py-2 text-xs text-rose-400 border-b border-[var(--border-light)]">{usErr}</p>}
        </div>
      )}

      {open && query.length >= 1 && results.length === 0 && usShown.length === 0 && !direct && !loading && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg shadow-xl p-4 text-center">
          <p className="text-xs text-[var(--text-muted)]">No stocks found for "{query}"</p>
          <p className="text-xs text-[var(--text-dim)] mt-1">Other markets: type the Google Finance symbol, e.g. <b>LON:VOD</b>, <b>TYO:7203</b> or <b>BOM:517015</b></p>
        </div>
      )}
    </div>
  )
}
