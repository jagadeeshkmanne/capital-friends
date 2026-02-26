import { useState, useRef, useEffect, useMemo } from 'react'
import Fuse from 'fuse.js'
import { getAllFunds } from '../../services/api'
import { Search, X, Loader2 } from 'lucide-react'

// Module-level fund cache — loaded once, shared across all instances
let _fundsCache = null
let _fundsPromise = null

function loadFunds() {
  if (_fundsCache) return Promise.resolve(_fundsCache)
  if (_fundsPromise) return _fundsPromise
  _fundsPromise = getAllFunds()
    .then((data) => {
      _fundsCache = Array.isArray(data) ? data : []
      return _fundsCache
    })
    .catch(() => {
      _fundsPromise = null // allow retry on failure
      return []
    })
  return _fundsPromise
}

export default function FundSearchInput({ value, onSelect, placeholder, disabled }) {
  const [query, setQuery] = useState('')
  const [funds, setFunds] = useState(_fundsCache || [])
  const [loading, setLoading] = useState(!_fundsCache)
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  // Load all funds once on first mount
  useEffect(() => {
    if (_fundsCache) { setFunds(_fundsCache); setLoading(false); return }
    loadFunds().then((data) => { setFunds(data); setLoading(false) })
  }, [])

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Fuse.js instance — same config as V1 template
  const fuse = useMemo(() => {
    if (!funds.length) return null
    return new Fuse(funds, {
      keys: ['fundName'],
      threshold: 0.3,
      distance: 50,
      minMatchCharLength: 2,
      includeScore: true,
      ignoreLocation: false,
      findAllMatches: true,
    })
  }, [funds])

  // Client-side fuzzy search — instant, no API calls
  const results = useMemo(() => {
    if (!fuse || query.length < 2) return []
    return fuse.search(query).slice(0, 50).map((r) => r.item)
  }, [fuse, query])

  function handleSearch(q) {
    setQuery(q)
    setOpen(q.length >= 2)
  }

  function handleSelect(fund) {
    onSelect({ schemeCode: fund.fundCode || fund.schemeCode, fundName: fund.fundName })
    setQuery('')
    setOpen(false)
  }

  function handleClear() {
    onSelect({ schemeCode: '', fundName: '' })
    setQuery('')
  }

  if (value?.fundName) {
    return (
      <div className="flex items-center gap-2 bg-[var(--bg-inset)] border border-[var(--border)] rounded-lg px-3 py-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-[var(--text-primary)] truncate">{value.fundName}</p>
          <p className="text-xs text-[var(--text-dim)]">Code: {value.schemeCode}</p>
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
          onFocus={() => query.length >= 2 && setOpen(true)}
          placeholder={loading ? 'Loading funds...' : (placeholder || 'Search fund name...')}
          disabled={disabled || loading}
          className="w-full bg-[var(--bg-inset)] border border-[var(--border)] rounded-lg pl-9 pr-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-violet-500/50 disabled:opacity-50 transition-colors"
        />
      </div>

      {open && results.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg shadow-xl max-h-[240px] overflow-y-auto">
          {results.map((fund) => (
            <button
              key={fund.fundCode || fund.schemeCode}
              type="button"
              onClick={() => handleSelect(fund)}
              className="w-full text-left px-3 py-2.5 hover:bg-[var(--bg-hover)] transition-colors border-b border-[var(--border-light)] last:border-0"
            >
              <p className="text-xs font-medium text-[var(--text-primary)] leading-tight">{fund.fundName}</p>
              <span className="text-xs text-[var(--text-dim)]">{fund.fundCode || fund.schemeCode}</span>
            </button>
          ))}
        </div>
      )}

      {open && query.length >= 2 && results.length === 0 && !loading && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg shadow-xl p-4 text-center">
          <p className="text-xs text-[var(--text-muted)]">No funds found for "{query}"</p>
        </div>
      )}
    </div>
  )
}
