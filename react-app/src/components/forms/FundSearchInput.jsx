import { useState, useRef, useEffect } from 'react'
import { searchFunds } from '../../data/familyData'
import { Search, X } from 'lucide-react'

export default function FundSearchInput({ value, onSelect, placeholder, disabled }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleSearch(q) {
    setQuery(q)
    if (q.length >= 2) {
      setResults(searchFunds(q))
      setOpen(true)
    } else {
      setResults([])
      setOpen(false)
    }
  }

  function handleSelect(fund) {
    onSelect({ schemeCode: fund.schemeCode, fundName: fund.fundName })
    setQuery('')
    setResults([])
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
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" />
        <input
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          onFocus={() => query.length >= 2 && setOpen(true)}
          placeholder={placeholder || 'Search fund name, code, or category...'}
          disabled={disabled}
          className="w-full bg-[var(--bg-inset)] border border-[var(--border)] rounded-lg pl-9 pr-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-violet-500/50 disabled:opacity-50 transition-colors"
        />
      </div>

      {open && results.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg shadow-xl max-h-[240px] overflow-y-auto">
          {results.map((fund) => (
            <button
              key={fund.schemeCode}
              type="button"
              onClick={() => handleSelect(fund)}
              className="w-full text-left px-3 py-2.5 hover:bg-[var(--bg-hover)] transition-colors border-b border-[var(--border-light)] last:border-0"
            >
              <p className="text-xs font-medium text-[var(--text-primary)] leading-tight">{fund.fundName}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-[var(--text-dim)]">{fund.schemeCode}</span>
                <span className="text-xs font-semibold text-violet-400/70 bg-violet-500/10 px-1.5 py-0.5 rounded">{fund.category}</span>
                <span className="text-xs text-[var(--text-dim)]">{fund.amc}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {open && query.length >= 2 && results.length === 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg shadow-xl p-4 text-center">
          <p className="text-xs text-[var(--text-muted)]">No funds found for "{query}"</p>
        </div>
      )}
    </div>
  )
}
