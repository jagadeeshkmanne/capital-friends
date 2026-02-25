import { useState, useMemo } from 'react'
import { TrendingDown, RefreshCw, ChevronDown } from 'lucide-react'
import { useData } from '../context/DataContext'
import MFBuyOpportunities from './forms/MFBuyOpportunities'
import MFRebalanceDialog from './forms/MFRebalanceDialog'

export default function GlobalHighlights() {
  const { mfHoldings, mfPortfolios } = useData()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState('ath') // 'ath' | 'rebal'

  // Compute counts from real data
  const { buyOppCount, rebalanceCount } = useMemo(() => {
    let buyOpp = 0
    let rebalance = 0
    mfPortfolios
      .filter((p) => p.status !== 'Inactive')
      .forEach((p) => {
        const pHoldings = mfHoldings.filter((h) => h.portfolioId === p.portfolioId && h.units > 0)
        const totalValue = pHoldings.reduce((s, h) => s + h.currentValue, 0)
        const threshold = (p.rebalanceThreshold || 0.05) * 100
        pHoldings.forEach((h) => {
          if (h.athNav > 0 && h.belowATHPct >= 1) buyOpp++
          const currentPct = totalValue > 0 ? (h.currentValue / totalValue) * 100 : 0
          if (Math.abs(currentPct - h.targetAllocationPct) > threshold) rebalance++
        })
      })
    return { buyOppCount: buyOpp, rebalanceCount: rebalance }
  }, [mfPortfolios, mfHoldings])

  const hasATH = buyOppCount > 0
  const hasRebalance = rebalanceCount > 0

  if (!hasATH && !hasRebalance) return null

  return (
    <div className="mb-4">
      {/* Compact notification bar */}
      <div className="w-full flex items-center gap-0 bg-[var(--bg-card)] rounded-xl border border-[var(--border)] animate-glow-mixed">
        <div className="flex items-center gap-0 flex-1 min-w-0 overflow-x-auto no-scrollbar">
          {hasATH && (
            <button
              onClick={() => { if (open && tab === 'ath') { setOpen(false) } else { setTab('ath'); setOpen(true) } }}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium whitespace-nowrap transition-colors hover:bg-[var(--bg-hover)] rounded-l-xl ${open && tab === 'ath' ? 'bg-[var(--bg-hover)]' : ''}`}
            >
              <TrendingDown size={13} className="text-emerald-400 shrink-0" />
              <span className="text-[var(--text-muted)]">Buy Opp.</span>
              <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">{buyOppCount}</span>
            </button>
          )}
          {hasATH && hasRebalance && (
            <span className="w-px h-4 bg-[var(--border)] shrink-0" />
          )}
          {hasRebalance && (
            <button
              onClick={() => { if (open && tab === 'rebal') { setOpen(false) } else { setTab('rebal'); setOpen(true) } }}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium whitespace-nowrap transition-colors hover:bg-[var(--bg-hover)] ${!hasATH ? 'rounded-l-xl' : ''} ${open && tab === 'rebal' ? 'bg-[var(--bg-hover)]' : ''}`}
            >
              <RefreshCw size={13} className="text-[var(--accent-violet)] shrink-0" />
              <span className="text-[var(--text-muted)]">Rebalance</span>
              <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-violet-500/15 text-[var(--accent-violet)]">{rebalanceCount}</span>
            </button>
          )}
        </div>
        <button
          onClick={() => setOpen(!open)}
          className="px-3 py-2.5 hover:bg-[var(--bg-hover)] rounded-r-xl transition-colors"
        >
          <ChevronDown size={14} className={`text-[var(--text-dim)] shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Expanded panel */}
      {open && (
        <div className="mt-2 bg-[var(--bg-card)] rounded-xl border border-[var(--border)] overflow-hidden">
          {tab === 'ath' && hasATH && (
            <div className="p-3">
              <MFBuyOpportunities />
            </div>
          )}
          {tab === 'rebal' && hasRebalance && (
            <div className="p-3">
              <MFRebalanceDialog />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
