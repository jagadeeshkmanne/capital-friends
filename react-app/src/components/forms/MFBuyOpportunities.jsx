import { useMemo } from 'react'
import { useData } from '../../context/DataContext'
import { formatINR } from '../../data/familyData'

// ── Toggle this to false when real data is available ──
const USE_DUMMY = true

const DUMMY_PORTFOLIOS = [
  {
    portfolioId: 'dp1', portfolioName: 'Jags Growth Portfolio', ownerName: 'Jags', totalValue: 1500000,
    opportunities: [
      { holdingId: 'dh1', fundName: 'Parag Parikh Flexi Cap Fund', athNav: 78.50, currentNav: 62.80, belowATHPct: 20.0, currentPct: 28.5, targetAllocationPct: 30, currentValue: 427500 },
      { holdingId: 'dh2', fundName: 'Mirae Asset Large Cap Fund', athNav: 105.30, currentNav: 91.60, belowATHPct: 13.0, currentPct: 22.1, targetAllocationPct: 25, currentValue: 331500 },
      { holdingId: 'dh3', fundName: 'Axis Small Cap Fund', athNav: 42.80, currentNav: 36.38, belowATHPct: 15.0, currentPct: 18.0, targetAllocationPct: 20, currentValue: 270000 },
    ],
  },
  {
    portfolioId: 'dp2', portfolioName: 'Priya Conservative MF', ownerName: 'Priya', totalValue: 1350000,
    opportunities: [
      { holdingId: 'dh4', fundName: 'HDFC Mid-Cap Opportunities', athNav: 92.10, currentNav: 82.89, belowATHPct: 10.0, currentPct: 30.2, targetAllocationPct: 35, currentValue: 407700 },
      { holdingId: 'dh5', fundName: 'Kotak Emerging Equity Fund', athNav: 68.40, currentNav: 61.56, belowATHPct: 10.0, currentPct: 15.8, targetAllocationPct: 20, currentValue: 213300 },
    ],
  },
]

function belowColor(pct) {
  if (pct >= 20) return 'bg-rose-500/20 text-[var(--accent-rose)]'
  if (pct >= 10) return 'bg-orange-500/20 text-[var(--accent-orange)]'
  if (pct >= 5) return 'bg-amber-500/20 text-[var(--accent-amber)]'
  return 'bg-slate-500/20 text-[var(--text-muted)]'
}

export default function MFBuyOpportunities() {
  const { mfHoldings, mfPortfolios } = useData()

  // Group opportunities by portfolio
  const portfolioGroups = useMemo(() => {
    if (USE_DUMMY) return DUMMY_PORTFOLIOS

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
                  <th className="text-right py-1.5 px-2 text-xs text-[var(--text-muted)] font-semibold uppercase">ATH NAV</th>
                  <th className="text-right py-1.5 px-2 text-xs text-[var(--text-muted)] font-semibold uppercase">Current</th>
                  <th className="text-right py-1.5 px-2 text-xs text-[var(--text-muted)] font-semibold uppercase">Below ATH</th>
                  <th className="text-right py-1.5 px-2 text-xs text-[var(--text-muted)] font-semibold uppercase">Alloc</th>
                  <th className="text-right py-1.5 px-2 text-xs text-[var(--text-muted)] font-semibold uppercase">Value</th>
                </tr>
              </thead>
              <tbody>
                {p.opportunities.map((h) => (
                  <tr key={h.holdingId} className="border-b border-[var(--border-light)] last:border-0">
                    <td className="py-2 px-2 text-[var(--text-secondary)] max-w-[200px] truncate">{h.fundName}</td>
                    <td className="py-2 px-2 text-right text-[var(--text-dim)] tabular-nums">₹{h.athNav.toFixed(2)}</td>
                    <td className="py-2 px-2 text-right text-[var(--text-muted)] tabular-nums">₹{h.currentNav.toFixed(2)}</td>
                    <td className="py-2 px-2 text-right">
                      <span className={`inline-block text-xs font-semibold px-1.5 py-0.5 rounded-full ${belowColor(h.belowATHPct)}`}>
                        −{h.belowATHPct.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-2 px-2 text-right text-[var(--text-muted)] tabular-nums">
                      {h.currentPct.toFixed(1)}% / {h.targetAllocationPct.toFixed(1)}%
                    </td>
                    <td className="py-2 px-2 text-right text-[var(--text-primary)] font-semibold tabular-nums">{formatINR(h.currentValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden divide-y divide-[var(--border-light)]">
            {p.opportunities.map((h) => (
              <div key={h.holdingId} className="px-3 py-2.5">
                <div className="flex items-start justify-between mb-1">
                  <p className="text-xs text-[var(--text-primary)] leading-tight flex-1 mr-2">{h.fundName}</p>
                  <span className={`shrink-0 text-xs font-semibold px-1.5 py-0.5 rounded-full ${belowColor(h.belowATHPct)}`}>
                    −{h.belowATHPct.toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-[var(--text-dim)]">
                  <span>ATH ₹{h.athNav.toFixed(2)} → ₹{h.currentNav.toFixed(2)}</span>
                  <span>Alloc: {h.currentPct.toFixed(1)}%</span>
                  <span className="font-semibold text-[var(--text-primary)]">{formatINR(h.currentValue)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
