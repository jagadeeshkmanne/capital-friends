import { useState, useMemo } from 'react'
import { useData } from '../../context/DataContext'
import { formatINR } from '../../data/familyData'
import { Repeat, IndianRupee, ArrowUpDown } from 'lucide-react'
import { FormField, FormInput } from '../Modal'

const modes = [
  { key: 'sip', label: 'Adjust SIP', icon: Repeat, color: 'text-blue-400', dimColor: 'text-blue-400/60 hover:text-blue-400', activeBg: 'bg-blue-500/20 border border-blue-500/40' },
  { key: 'lumpsum', label: 'Lumpsum', icon: IndianRupee, color: 'text-emerald-400', dimColor: 'text-emerald-400/60 hover:text-emerald-400', activeBg: 'bg-emerald-500/20 border border-emerald-500/40' },
  { key: 'buysell', label: 'Buy / Sell', icon: ArrowUpDown, color: 'text-amber-400', dimColor: 'text-amber-400/60 hover:text-amber-400', activeBg: 'bg-amber-500/20 border border-amber-500/40' },
]

function fmt(n) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`
  return `₹${Math.round(n)}`
}

function NoTargetsMessage({ exitOnly }) {
  return (
    <div className="py-4 text-center space-y-1">
      {exitOnly ? (
        <p className="text-xs text-[var(--text-muted)]">Only exit candidates here — use <span className="font-semibold text-amber-400">Buy / Sell</span> tab</p>
      ) : (
        <>
          <p className="text-xs text-[var(--text-muted)]">No target allocations set</p>
          <p className="text-xs text-[var(--text-dim)]">Use <span className="font-semibold text-violet-400">Allocations</span> to set target % for each fund first</p>
        </>
      )}
    </div>
  )
}

function PortfolioSIPSection({ portfolio, holdings, totalValue }) {
  const sipTarget = portfolio.sipTarget || 0
  const threshold = (portfolio.rebalanceThreshold || 0.05) * 100
  const hasTargets = holdings.some((h) => h.targetAllocationPct > 0)
  const hasExitCandidates = holdings.some((h) => h.targetAllocationPct === 0 && h.units > 0)

  if (!hasTargets) return <NoTargetsMessage exitOnly={hasExitCandidates} />
  if (sipTarget <= 0) return <p className="text-xs text-[var(--text-dim)] py-2">No SIP target set for this portfolio</p>

  // Show ALL funds with targets — gap-based rebalance SIP
  const allFunds = holdings
    .filter((h) => h.targetAllocationPct > 0)
    .map((h) => {
      const currentPct = totalValue > 0 ? (h.currentValue / totalValue) * 100 : 0
      const drift = Math.abs(currentPct - h.targetAllocationPct)
      const drifted = drift > threshold
      const targetValue = (h.targetAllocationPct / 100) * totalValue
      const gap = targetValue - h.currentValue // positive = underweight, negative = overweight
      const normalSIP = (h.targetAllocationPct / 100) * sipTarget
      return { ...h, currentPct, drift, drifted, gap, normalSIP }
    })

  // Only rebalance funds that exceed threshold
  const driftedUnderweight = allFunds.filter((h) => h.drifted && h.gap > 0)
  const driftedOverweight = allFunds.filter((h) => h.drifted && h.gap <= 0)
  const totalGap = driftedUnderweight.reduce((s, h) => s + h.gap, 0)

  const withSuggested = allFunds.map((h) => ({
    ...h,
    suggestedSIP: h.drifted && h.gap > 0 && totalGap > 0 ? (h.gap / totalGap) * sipTarget
      : h.drifted && h.gap <= 0 ? 0 // overweight beyond threshold → ₹0
      : h.normalSIP, // within threshold → keep normal SIP
  }))

  // Only show if there are funds drifted beyond threshold
  const hasDrift = allFunds.some((h) => h.drifted)
  if (!hasDrift) return <p className="text-xs text-[var(--text-dim)] py-2">SIPs are balanced (within {threshold.toFixed(0)}% threshold)</p>

  return (
    <div className="space-y-2">
      <p className="text-xs text-[var(--text-dim)] px-1">
        Funds drifted &gt;{threshold.toFixed(0)}%: overweight → ₹0, underweight → extra SIP. Others keep normal SIP.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border-light)]">
              <th className="text-left py-1.5 px-2 text-xs text-[var(--text-muted)] font-semibold uppercase">Fund</th>
              <th className="text-right py-1.5 px-2 text-xs text-[var(--text-muted)] font-semibold uppercase">Allocation</th>
              <th className="text-right py-1.5 px-2 text-xs text-[var(--text-muted)] font-semibold uppercase">Normal SIP</th>
              <th className="text-right py-1.5 px-2 text-xs text-[var(--text-muted)] font-semibold uppercase">Rebalance SIP</th>
            </tr>
          </thead>
          <tbody>
            {withSuggested.map((h) => {
              const isOverweight = h.drifted && h.gap <= 0
              const isUnderweight = h.drifted && h.gap > 0
              const withinThreshold = !h.drifted
              return (
                <tr key={h.holdingId} className={`border-b border-[var(--border-light)] last:border-0 ${withinThreshold ? 'opacity-50' : isOverweight ? 'opacity-60' : ''}`}>
                  <td className="py-2 px-2 text-[var(--text-secondary)] max-w-[180px] truncate">{h.fundName}</td>
                  <td className="py-2 px-2 text-right tabular-nums">
                    <span className={isOverweight ? 'text-amber-400' : isUnderweight ? 'text-blue-400' : 'text-[var(--text-dim)]'}>{h.currentPct.toFixed(1)}%</span>
                    <span className="text-[var(--text-dim)]"> / {h.targetAllocationPct.toFixed(1)}%</span>
                  </td>
                  <td className="py-2 px-2 text-right text-[var(--text-muted)] tabular-nums">{fmt(h.normalSIP)}</td>
                  <td className="py-2 px-2 text-right font-semibold tabular-nums">
                    {isOverweight ? (
                      <span className="text-amber-400/70">₹0</span>
                    ) : isUnderweight ? (
                      <span className="text-blue-400">{fmt(h.suggestedSIP)}</span>
                    ) : (
                      <span className="text-[var(--text-dim)]">{fmt(h.suggestedSIP)}</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-[var(--border)]">
              <td className="py-1.5 px-2 text-xs font-bold text-[var(--text-primary)]" colSpan={2}>Total</td>
              <td className="py-1.5 px-2 text-right text-xs font-bold text-[var(--text-primary)] tabular-nums">{fmt(sipTarget)}</td>
              <td className="py-1.5 px-2 text-right text-xs font-bold text-blue-400 tabular-nums">{fmt(sipTarget)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

function PortfolioLumpsumSection({ portfolio, holdings, totalValue }) {
  const [lumpsumInput, setLumpsumInput] = useState('')
  const threshold = (portfolio.rebalanceThreshold || 0.05) * 100
  const hasTargets = holdings.some((h) => h.targetAllocationPct > 0)
  const hasExitCandidates = holdings.some((h) => h.targetAllocationPct === 0 && h.units > 0)

  if (!hasTargets) return <NoTargetsMessage exitOnly={hasExitCandidates} />

  const enriched = holdings.filter((h) => h.targetAllocationPct > 0).map((h) => {
    const currentPct = totalValue > 0 ? (h.currentValue / totalValue) * 100 : 0
    return { ...h, currentPct }
  })

  // Calculate minimum lumpsum needed to rebalance (only for funds drifted beyond threshold)
  const suggestedAmount = useMemo(() => {
    if (totalValue <= 0) return 0
    // Only count underweight funds that exceed the rebalance threshold
    const gaps = enriched.map((h) => {
      const currentPctVal = totalValue > 0 ? (h.currentValue / totalValue) * 100 : 0
      const drift = Math.abs(currentPctVal - h.targetAllocationPct)
      if (drift <= threshold) return 0 // Within threshold — no rebalance needed
      const targetVal = (h.targetAllocationPct / 100) * totalValue
      const gap = targetVal - h.currentValue
      return gap > 0 ? gap : 0
    })
    const totalGap = gaps.reduce((s, g) => s + g, 0)
    return Math.ceil(totalGap / 100) * 100 // Round up to nearest 100
  }, [enriched, totalValue, threshold])

  const lumpsumAmount = Number(lumpsumInput) || portfolio.lumpsumTarget || suggestedAmount

  const distribution = useMemo(() => {
    if (lumpsumAmount <= 0) return []
    const newTotal = totalValue + lumpsumAmount
    const raw = enriched.map((h) => {
      const targetVal = (h.targetAllocationPct / 100) * newTotal
      const invest = Math.max(0, targetVal - h.currentValue)
      const newPct = newTotal > 0 ? ((h.currentValue + invest) / newTotal) * 100 : 0
      return { ...h, invest, newPct }
    }).filter((h) => h.invest > 0)
    const totalRaw = raw.reduce((s, h) => s + h.invest, 0)
    if (totalRaw > 0 && Math.abs(totalRaw - lumpsumAmount) > 1) {
      const scale = lumpsumAmount / totalRaw
      return raw.map((h) => ({ ...h, invest: h.invest * scale, newPct: (totalValue + lumpsumAmount) > 0 ? ((h.currentValue + h.invest * scale) / (totalValue + lumpsumAmount)) * 100 : 0 }))
    }
    return raw
  }, [enriched, lumpsumAmount, totalValue])

  const usingSource = lumpsumInput ? null : portfolio.lumpsumTarget ? 'target' : suggestedAmount > 0 ? 'suggested' : null

  return (
    <div className="space-y-2">
      <div className="flex items-end gap-3">
        <div className="flex-1 max-w-[200px]">
          <FormField label="Amount (₹)">
            <FormInput type="number" value={lumpsumInput} onChange={setLumpsumInput} placeholder={portfolio.lumpsumTarget ? `Target: ${formatINR(portfolio.lumpsumTarget)}` : suggestedAmount > 0 ? `Suggested: ${formatINR(suggestedAmount)}` : 'Enter amount...'} />
          </FormField>
        </div>
        {usingSource === 'target' && <p className="text-xs text-[var(--text-dim)] pb-2.5">Using target</p>}
        {usingSource === 'suggested' && <p className="text-xs text-emerald-400/70 pb-2.5">Auto: min to rebalance</p>}
      </div>
      {lumpsumAmount > 0 && distribution.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-light)]">
                <th className="text-left py-1.5 px-2 text-xs text-[var(--text-muted)] font-semibold uppercase">Fund</th>
                <th className="text-right py-1.5 px-2 text-xs text-[var(--text-muted)] font-semibold uppercase">Drift</th>
                <th className="text-right py-1.5 px-2 text-xs text-[var(--text-muted)] font-semibold uppercase">Invest</th>
              </tr>
            </thead>
            <tbody>
              {distribution.map((h) => (
                <tr key={h.holdingId} className="border-b border-[var(--border-light)] last:border-0">
                  <td className="py-2 px-2 text-[var(--text-secondary)] max-w-[180px] truncate">{h.fundName}</td>
                  <td className="py-2 px-2 text-right text-[var(--text-dim)] tabular-nums">{h.currentPct.toFixed(1)}% → {h.newPct.toFixed(1)}%</td>
                  <td className="py-2 px-2 text-right font-semibold text-emerald-400 tabular-nums">{fmt(h.invest)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-[var(--border)]">
                <td className="py-1.5 px-2 text-xs font-bold text-[var(--text-primary)]" colSpan={2}>Total</td>
                <td className="py-1.5 px-2 text-right text-xs font-bold text-emerald-400 tabular-nums">{formatINR(lumpsumAmount)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : lumpsumAmount > 0 ? (
        <p className="text-xs text-[var(--text-dim)] py-2 text-center">Balanced — distributes proportionally</p>
      ) : null}
    </div>
  )
}

function PortfolioBuySellSection({ portfolio, holdings, totalValue }) {
  const threshold = (portfolio.rebalanceThreshold || 0.05) * 100
  const hasTargets = holdings.some((h) => h.targetAllocationPct > 0)
  const hasExitCandidates = holdings.some((h) => h.targetAllocationPct === 0 && h.units > 0)

  if (!hasTargets && !hasExitCandidates) return <NoTargetsMessage />

  // Include funds with target > 0 (normal drift) AND funds with target = 0 + units > 0 (exit/sell)
  const buySellData = holdings.filter((h) => h.targetAllocationPct > 0 || h.units > 0).map((h) => {
    const currentPct = totalValue > 0 ? (h.currentValue / totalValue) * 100 : 0
    const isExit = h.targetAllocationPct === 0 && h.units > 0
    const drifted = isExit || Math.abs(currentPct - h.targetAllocationPct) > threshold
    const targetVal = (h.targetAllocationPct / 100) * totalValue
    const amount = drifted ? targetVal - h.currentValue : 0
    return { ...h, currentPct, amount, isExit }
  }).filter((h) => Math.abs(h.amount) >= 500)

  if (buySellData.length === 0) return <p className="text-xs text-[var(--text-dim)] py-2">Portfolio is balanced</p>

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--border-light)]">
            <th className="text-left py-1.5 px-2 text-xs text-[var(--text-muted)] font-semibold uppercase">Fund</th>
            <th className="text-right py-1.5 px-2 text-xs text-[var(--text-muted)] font-semibold uppercase">Drift</th>
            <th className="text-right py-1.5 px-2 text-xs text-[var(--text-muted)] font-semibold uppercase">Action</th>
          </tr>
        </thead>
        <tbody>
          {buySellData.map((h) => {
            const isBuy = h.amount > 0
            return (
              <tr key={h.schemeCode || h.fundCode} className="border-b border-[var(--border-light)] last:border-0">
                <td className="py-2 px-2 text-[var(--text-secondary)] max-w-[180px] truncate">{h.fundName}</td>
                <td className="py-2 px-2 text-right text-[var(--text-dim)] tabular-nums">
                  {h.isExit ? <span className="text-[var(--accent-rose)]">{h.currentPct.toFixed(1)}% → Exit</span> : `${h.currentPct.toFixed(1)}% → ${h.targetAllocationPct.toFixed(1)}%`}
                </td>
                <td className="py-2 px-2 text-right">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isBuy ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-[var(--accent-rose)]'}`}>
                    {isBuy ? 'Buy' : h.isExit ? 'Exit' : 'Sell'} {fmt(Math.abs(h.amount))}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default function MFRebalanceDialog() {
  const { mfHoldings, mfPortfolios } = useData()
  const [mode, setMode] = useState('sip')

  // All portfolios needing rebalance
  const portfolioGroups = useMemo(() => {
    return mfPortfolios
      .filter((p) => p.status !== 'Inactive')
      .map((p) => {
        const pHoldings = mfHoldings.filter((h) => h.portfolioId === p.portfolioId && h.units > 0)
        const totalValue = pHoldings.reduce((s, h) => s + h.currentValue, 0)
        const threshold = (p.rebalanceThreshold || 0.05) * 100
        const driftedCount = pHoldings.filter((h) => {
          if (h.targetAllocationPct <= 0) return false
          const pct = totalValue > 0 ? (h.currentValue / totalValue) * 100 : 0
          return Math.abs(pct - h.targetAllocationPct) > threshold
        }).length
        const exitCount = pHoldings.filter((h) => h.targetAllocationPct === 0 && h.units > 0 && h.currentValue >= 500).length
        const hasTargets = pHoldings.some((h) => h.targetAllocationPct > 0)
        return { ...p, holdings: pHoldings, totalValue, driftedCount, exitCount, hasTargets }
      })
      .filter((p) => p.driftedCount > 0 || p.exitCount > 0)
  }, [mfPortfolios, mfHoldings])

  if (portfolioGroups.length === 0) {
    const anyTargets = mfHoldings.some((h) => h.targetAllocationPct > 0)
    return (
      <div className="py-8 text-center">
        {anyTargets ? (
          <>
            <p className="text-sm text-[var(--text-muted)]">All portfolios are balanced</p>
            <p className="text-xs text-[var(--text-dim)] mt-1">No funds exceed their rebalance threshold</p>
          </>
        ) : (
          <>
            <p className="text-sm text-[var(--text-muted)]">No target allocations set</p>
            <p className="text-xs text-[var(--text-dim)] mt-1">Use <span className="font-semibold text-violet-400">Allocations</span> to set target % for each fund, then rebalance will show drift</p>
          </>
        )}
      </div>
    )
  }

  // Only show SIP tab if at least one portfolio has a SIP target
  const anySIP = portfolioGroups.some((p) => (p.sipTarget || 0) > 0)
  const availableModes = anySIP ? modes : modes.filter((m) => m.key !== 'sip')
  const effectiveMode = availableModes.some((m) => m.key === mode) ? mode : availableModes[0]?.key || 'buysell'

  return (
    <div className="space-y-4">
      {/* Color-coded mode tabs */}
      <div className="flex bg-[var(--bg-inset)] rounded-lg p-0.5">
        {availableModes.map(({ key, label, icon: MIcon, color, dimColor, activeBg }) => (
          <button key={key} onClick={() => setMode(key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-semibold transition-colors ${
              effectiveMode === key ? `${activeBg} ${color} shadow-sm` : dimColor
            }`}
          >
            <MIcon size={13} /> {label}
          </button>
        ))}
      </div>

      {/* Per-portfolio sections */}
      {portfolioGroups.map((p, i) => (
        <div key={p.portfolioId} className="border border-[var(--border-light)] border-l-2 border-l-violet-500/50 rounded-lg overflow-hidden">
          {/* Portfolio header */}
          <div className="flex items-center justify-between px-3 py-2.5 bg-[var(--bg-inset)]">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-violet-400 bg-violet-500/15 w-5 h-5 rounded flex items-center justify-center">{i + 1}</span>
              <p className="text-sm font-bold text-[var(--text-primary)]">{p.portfolioName}</p>
              <span className="text-xs text-[var(--text-muted)]">{p.ownerName}</span>
              {p.driftedCount > 0 && <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400">{p.driftedCount} drifted</span>}
              {p.exitCount > 0 && <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-rose-500/15 text-[var(--accent-rose)]">{p.exitCount} exit</span>}
            </div>
            <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
              <span className="font-semibold text-[var(--text-secondary)]">{formatINR(p.totalValue)}</span>
              <span>Threshold: {((p.rebalanceThreshold || 0.05) * 100).toFixed(0)}%</span>
              {p.sipTarget > 0 && <span>SIP: {formatINR(p.sipTarget)}/mo</span>}
            </div>
          </div>

          {/* Mode-specific content */}
          <div className="px-3 py-2">
            {effectiveMode === 'sip' && <PortfolioSIPSection portfolio={p} holdings={p.holdings} totalValue={p.totalValue} />}
            {effectiveMode === 'lumpsum' && <PortfolioLumpsumSection portfolio={p} holdings={p.holdings} totalValue={p.totalValue} />}
            {effectiveMode === 'buysell' && <PortfolioBuySellSection portfolio={p} holdings={p.holdings} totalValue={p.totalValue} />}
          </div>
        </div>
      ))}
    </div>
  )
}
