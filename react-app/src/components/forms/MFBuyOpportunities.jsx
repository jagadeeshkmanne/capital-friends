import { useMemo } from 'react'
import { useData } from '../../context/DataContext'
import { formatINR } from '../../data/familyData'

function belowColor(pct) {
  if (pct >= 20) return 'bg-rose-500/20 text-[var(--accent-rose)]'
  if (pct >= 10) return 'bg-orange-500/20 text-[var(--accent-orange)]'
  if (pct >= 5) return 'bg-amber-500/20 text-[var(--accent-amber)]'
  return 'bg-slate-500/20 text-[var(--text-muted)]'
}

function buySignal(pct) {
  if (pct >= 10) return { label: 'Strong Buy', cls: 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30' }
  if (pct >= 5) return { label: 'Buy', cls: 'bg-blue-500/20 text-blue-400' }
  return null
}

export default function MFBuyOpportunities() {
  const { mfHoldings, mfPortfolios } = useData()

  // Group opportunities by portfolio
  const portfolioGroups = useMemo(() => {
    return mfPortfolios
      .filter((p) => p.status !== 'Inactive')
      .map((p) => {
        const pHoldings = mfHoldings.filter((h) => h.portfolioId === p.portfolioId && h.units > 0)
        const totalValue = pHoldings.reduce((s, h) => s + h.currentValue, 0)
        const opps = pHoldings
          .filter((h) => h.athNav > 0 && h.belowATHPct >= 1)
          .sort((a, b) => b.belowATHPct - a.belowATHPct)
          .map((h) => ({
            ...h,
            currentPct: totalValue > 0 ? (h.currentValue / totalValue) * 100 : 0,
          }))
        return { ...p, totalValue, opportunities: opps }
      })
      .filter((p) => p.opportunities.length > 0)
  }, [mfPortfolios, mfHoldings])

  const totalOpps = portfolioGroups.reduce((s, p) => s + p.opportunities.length, 0)

  if (totalOpps === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-[var(--text-muted)]">No buy opportunities right now</p>
        <p className="text-xs text-[var(--text-dim)] mt-1">All funds are near their all-time highs</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-[var(--text-dim)] px-1">
        Funds below their All-Time High NAV. Higher discount = better opportunity.
      </p>

      {portfolioGroups.map((p, i) => (
        <div key={p.portfolioId} className="border border-[var(--border-light)] border-l-2 border-l-emerald-500/50 rounded-lg overflow-hidden">
          {/* Portfolio header */}
          <div className="flex items-center gap-2 px-3 py-2.5 bg-[var(--bg-inset)]">
            <span className="text-xs font-bold text-emerald-400 bg-emerald-500/15 w-5 h-5 rounded flex items-center justify-center">{i + 1}</span>
            <p className="text-sm font-bold text-[var(--text-primary)]">{p.portfolioName}</p>
            <span className="text-xs text-[var(--text-muted)]">{p.ownerName}</span>
            <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">{p.opportunities.length} funds</span>
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-light)] bg-[var(--bg-inset)]">
                  <th className="text-left py-1.5 px-2 text-xs text-[var(--text-muted)] font-semibold uppercase">Fund</th>
                  <th className="text-center py-1.5 px-2 text-xs text-[var(--text-muted)] font-semibold uppercase">Signal</th>
                  <th className="text-right py-1.5 px-2 text-xs text-[var(--text-muted)] font-semibold uppercase">Below ATH</th>
                  <th className="text-right py-1.5 px-2 text-xs text-[var(--text-muted)] font-semibold uppercase">ATH NAV</th>
                  <th className="text-right py-1.5 px-2 text-xs text-[var(--text-muted)] font-semibold uppercase">Current</th>
                  <th className="text-right py-1.5 px-2 text-xs text-[var(--text-muted)] font-semibold uppercase">Value</th>
                </tr>
              </thead>
              <tbody>
                {p.opportunities.map((h) => {
                  const signal = buySignal(h.belowATHPct)
                  return (
                  <tr key={h.holdingId} className="border-b border-[var(--border-light)] last:border-0">
                    <td className="py-2 px-2 text-[var(--text-secondary)] max-w-[200px] truncate">{h.fundName}</td>
                    <td className="py-2 px-2 text-center">
                      {signal ? (
                        <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${signal.cls}`}>{signal.label}</span>
                      ) : (
                        <span className="text-[10px] text-[var(--text-dim)]">Watch</span>
                      )}
                    </td>
                    <td className="py-2 px-2 text-right">
                      <span className={`inline-block text-xs font-semibold px-1.5 py-0.5 rounded-full ${belowColor(h.belowATHPct)}`}>
                        −{h.belowATHPct.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-2 px-2 text-right text-[var(--text-dim)] tabular-nums">₹{h.athNav.toFixed(2)}</td>
                    <td className="py-2 px-2 text-right text-[var(--text-muted)] tabular-nums">₹{h.currentNav.toFixed(2)}</td>
                    <td className="py-2 px-2 text-right text-[var(--text-primary)] font-semibold tabular-nums">{formatINR(h.currentValue)}</td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden divide-y divide-[var(--border-light)]">
            {p.opportunities.map((h) => {
              const signal = buySignal(h.belowATHPct)
              return (
              <div key={h.holdingId} className="px-3 py-2.5">
                <div className="flex items-start justify-between mb-1">
                  <p className="text-xs text-[var(--text-primary)] leading-tight flex-1 mr-2">{h.fundName}</p>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {signal && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${signal.cls}`}>{signal.label}</span>}
                    <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${belowColor(h.belowATHPct)}`}>
                      −{h.belowATHPct.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-[var(--text-dim)]">
                  <span>ATH ₹{h.athNav.toFixed(2)} → ₹{h.currentNav.toFixed(2)}</span>
                  <span className="font-semibold text-[var(--text-primary)]">{formatINR(h.currentValue)}</span>
                </div>
              </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
