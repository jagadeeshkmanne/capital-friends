import { useState, useRef, useEffect, useMemo } from 'react'
import Fuse from 'fuse.js'
import { getAllStocks, getStockPrice } from '../../services/api'
import { getWithMeta, put } from '../../services/idb'
import { Search, X, Loader2 } from 'lucide-react'

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

function loadStocks() {
  if (_stocksCache) return Promise.resolve(_stocksCache)
  if (_stocksPromise) return _stocksPromise
  _stocksPromise = getWithMeta('stocksList')
    .then((record) => {
      if (record && Array.isArray(record.data) && isFreshToday(record.updatedAt)) {
        _stocksCache = record.data
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

export default function StockSearchInput({ value, onSelect, placeholder, disabled }) {
  const [query, setQuery] = useState('')
  const [stocks, setStocks] = useState(_stocksCache || [])
  const [loading, setLoading] = useState(!_stocksCache)
  const [open, setOpen] = useState(false)
  const [fetchingPrice, setFetchingPrice] = useState(false)
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
            {value.sector && <span className="text-[10px] text-[var(--text-dim)]">{value.sector}</span>}
            {fetchingPrice && <Loader2 size={10} className="text-violet-400 animate-spin" />}
            {!fetchingPrice && value.price > 0 && (
              <span className="text-[10px] font-semibold text-emerald-400 tabular-nums">
                CMP: ₹{value.price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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

      {open && results.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg shadow-xl max-h-[240px] overflow-y-auto">
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
                {stock.sector && <span className="text-[10px] text-[var(--text-dim)]">{stock.sector}</span>}
                {stock.industry && <span className="text-[10px] text-[var(--text-dim)]">· {stock.industry}</span>}
              </div>
            </button>
          ))}
        </div>
      )}

      {open && query.length >= 1 && results.length === 0 && !loading && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg shadow-xl p-4 text-center">
          <p className="text-xs text-[var(--text-muted)]">No stocks found for "{query}"</p>
        </div>
      )}
    </div>
  )
}
