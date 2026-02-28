import { useState, useMemo } from 'react'
import { useData } from '../../context/DataContext'
import { formatINR, splitFundName } from '../../data/familyData'
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

/* ──────────────────────────────────────────────
   Reusable mobile card for a single fund row
   ────────────────────────────────────────────── */
function FundCard({ children, dimmed }) {
  return (
    <div className={`bg-[var(--bg-card)] rounded-xl border border-[var(--border)] px-3.5 py-3 space-y-2 ${dimmed ? 'opacity-50' : ''}`}>
      {children}
    </div>
  )
}

function FundCardName({ fundName }) {
  const { main, plan } = splitFundName(fundName)
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium text-[var(--text-primary)] leading-tight">{main}</p>
      {plan && <p className="text-[9px] text-[var(--text-dim)]">{plan}</p>}
    </div>
  )
}

function FundCardRow({ label, value, valueClass }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] text-[var(--text-dim)]">{label}</span>
      <span className={`text-[11px] tabular-nums font-medium ${valueClass || 'text-[var(--text-secondary)]'}`}>{value}</span>
    </div>
  )
}

/* ──────────────────────────────────────────────
   SIP Section
   ────────────────────────────────────────────── */
function PortfolioSIPSection({ portfolio, holdings, totalValue }) {
  const sipTarget = portfolio.sipTarget || 0
  const threshold = (portfolio.rebalanceThreshold || 0.05) * 100
  const hasTargets = holdings.some((h) => h.targetAllocationPct > 0)
  const hasExitCandidates = holdings.some((h) => h.targetAllocationPct === 0 && h.units > 0)

  if (!hasTargets) return <NoTargetsMessage exitOnly={hasExitCandidates} />
  if (sipTarget <= 0) return <p className="text-xs text-[var(--text-dim)] py-2">No SIP target set for this portfolio</p>

  const allFunds = holdings
    .filter((h) => h.targetAllocationPct > 0)
    .map((h) => {
      const currentPct = totalValue > 0 ? (h.currentValue / totalValue) * 100 : 0
      const drift = Math.abs(currentPct - h.targetAllocationPct)
      const drifted = drift > threshold
      const targetValue = (h.targetAllocationPct / 100) * totalValue
      const gap = targetValue - h.currentValue
      const normalSIP = (h.targetAllocationPct / 100) * sipTarget
      return { ...h, currentPct, drift, drifted, gap, normalSIP }
    })

  const driftedUnderweight = allFunds.filter((h) => h.drifted && h.gap > 0)
  const totalGap = driftedUnderweight.reduce((s, h) => s + h.gap, 0)

  const withSuggested = allFunds.map((h) => ({
    ...h,
    suggestedSIP: h.drifted && h.gap > 0 && totalGap > 0 ? (h.gap / totalGap) * sipTarget
      : h.drifted && h.gap <= 0 ? 0
      : h.normalSIP,
  }))

  const hasDrift = allFunds.some((h) => h.drifted)
  if (!hasDrift) return <p className="text-xs text-[var(--text-dim)] py-2">SIPs are balanced (within {threshold.toFixed(0)}% threshold)</p>

  return (
    <div className="space-y-2">
      <p className="text-xs text-[var(--text-dim)] px-1">
        Funds drifted &gt;{threshold.toFixed(0)}%: overweight → ₹0, underweight → extra SIP. Others keep normal SIP.
      </p>

      {/* Desktop table */}
      <div className="hidden sm:block overflow-x-auto">
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
                  <td className="py-2 px-2 text-[var(--text-secondary)] max-w-[180px]">
                    <p className="truncate">{splitFundName(h.fundName).main}</p>
                    {splitFundName(h.fundName).plan && <p className="text-[10px] text-[var(--text-dim)]">{splitFundName(h.fundName).plan}</p>}
                  </td>
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

      {/* Mobile cards */}
      <div className="sm:hidden space-y-2">
        {withSuggested.map((h) => {
          const isOverweight = h.drifted && h.gap <= 0
          const isUnderweight = h.drifted && h.gap > 0
          const withinThreshold = !h.drifted
          return (
            <FundCard key={h.holdingId} dimmed={withinThreshold || isOverweight}>
              <FundCardName fundName={h.fundName} />
              <FundCardRow
                label="Allocation"
                value={<><span className={isOverweight ? 'text-amber-400' : isUnderweight ? 'text-blue-400' : ''}>{h.currentPct.toFixed(1)}%</span> <span className="text-[var(--text-dim)]">/ {h.targetAllocationPct.toFixed(1)}%</span></>}
              />
              <div className="flex items-center justify-between pt-1 border-t border-[var(--border-light)]">
                <div className="text-center flex-1">
                  <p className="text-[9px] text-[var(--text-dim)] uppercase">Normal</p>
                  <p className="text-xs text-[var(--text-muted)] tabular-nums">{fmt(h.normalSIP)}</p>
                </div>
                <div className="text-[var(--text-dim)] text-xs px-2">→</div>
                <div className="text-center flex-1">
                  <p className="text-[9px] text-[var(--text-dim)] uppercase">Rebalance</p>
                  <p className={`text-xs font-semibold tabular-nums ${isOverweight ? 'text-amber-400/70' : isUnderweight ? 'text-blue-400' : 'text-[var(--text-dim)]'}`}>
                    {isOverweight ? '₹0' : fmt(h.suggestedSIP)}
                  </p>
                </div>
              </div>
            </FundCard>
          )
        })}

        {/* Mobile total */}
        <div className="flex items-center justify-between bg-[var(--bg-inset)] rounded-xl border border-[var(--border-light)] px-3.5 py-2.5">
          <p className="text-xs font-bold text-[var(--text-primary)]">Total SIP</p>
          <div className="flex items-center gap-3">
            <span className="text-xs text-[var(--text-muted)] tabular-nums">{fmt(sipTarget)}</span>
            <span className="text-[var(--text-dim)]">→</span>
            <span className="text-xs font-bold text-blue-400 tabular-nums">{fmt(sipTarget)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ──────────────────────────────────────────────
   Lumpsum Section
   ────────────────────────────────────────────── */
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

  const suggestedAmount = useMemo(() => {
    if (totalValue <= 0 || enriched.length === 0) return 0
    const underweight = enriched.filter((h) => {
      const targetVal = (h.targetAllocationPct / 100) * totalValue
      return h.currentValue < targetVal
    })
    if (underweight.length === 0) return 0
    const pUnder = underweight.reduce((s, h) => s + h.targetAllocationPct, 0)
    if (pUnder >= 100) return 0
    const cvUnder = underweight.reduce((s, h) => s + h.currentValue, 0)
    const amount = (pUnder / 100 * totalValue - cvUnder) / (1 - pUnder / 100)
    return amount > 0 ? Math.ceil(amount / 100) * 100 : 0
  }, [enriched, totalValue])

  const lumpsumAmount = Number(lumpsumInput) || portfolio.lumpsumTarget || suggestedAmount

  const distribution = useMemo(() => {
    const newTotal = lumpsumAmount > 0 ? totalValue + lumpsumAmount : totalValue
    const all = enriched.map((h) => {
      const targetVal = (h.targetAllocationPct / 100) * newTotal
      const invest = lumpsumAmount > 0 ? Math.max(0, targetVal - h.currentValue) : 0
      const newPct = newTotal > 0 ? ((h.currentValue + invest) / newTotal) * 100 : 0
      const isOverweight = h.currentValue > targetVal + 1
      return { ...h, invest, newPct, isOverweight }
    })
    const totalRaw = all.reduce((s, h) => s + h.invest, 0)
    if (lumpsumAmount > 0 && totalRaw > 0 && Math.abs(totalRaw - lumpsumAmount) > 1) {
      const scale = lumpsumAmount / totalRaw
      return all.map((h) => ({
        ...h,
        invest: h.invest > 0 ? h.invest * scale : 0,
        newPct: newTotal > 0 ? ((h.currentValue + (h.invest > 0 ? h.invest * scale : 0)) / newTotal) * 100 : 0,
      }))
    }
    return all
  }, [enriched, lumpsumAmount, totalValue])

  const totalInvest = distribution.reduce((s, h) => s + h.invest, 0)
  const hasOverweight = distribution.some((h) => h.isOverweight)
  const customAmount = Number(lumpsumInput)
  const isPartial = customAmount > 0 && suggestedAmount > 0 && customAmount < suggestedAmount

  return (
    <div className="space-y-2">
      {/* Minimum needed banner */}
      {suggestedAmount > 0 && (
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-emerald-500/10 border border-emerald-500/20">
          <p className="text-xs text-emerald-400">
            <span className="font-bold">{formatINR(suggestedAmount)}</span> needed to bring all underweight funds to target %
          </p>
        </div>
      )}

      <div className="flex items-end gap-3">
        <div className="flex-1 max-w-[200px]">
          <FormField label="Invest Amount (₹)">
            <FormInput type="number" value={lumpsumInput} onChange={setLumpsumInput} placeholder={suggestedAmount > 0 ? `${formatINR(suggestedAmount)}` : 'Enter amount...'} />
          </FormField>
        </div>
        {!customAmount && !portfolio.lumpsumTarget && suggestedAmount > 0 && (
          <p className="text-xs text-emerald-400/70 pb-2.5">Using suggested</p>
        )}
        {!customAmount && portfolio.lumpsumTarget >= 100 && (
          <p className="text-xs text-[var(--text-dim)] pb-2.5">Using lumpsum target</p>
        )}
      </div>

      {isPartial && (
        <p className="text-xs text-amber-400/80 px-1">
          Below minimum — distributes proportionally but won't fully rebalance. Need {formatINR(suggestedAmount)} for exact target %.
        </p>
      )}

      {distribution.length > 0 ? (
        <>
          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-light)]">
                  <th className="text-left py-1.5 px-2 text-xs text-[var(--text-muted)] font-semibold uppercase">Fund</th>
                  <th className="text-right py-1.5 px-2 text-xs text-[var(--text-muted)] font-semibold uppercase">Allocation</th>
                  <th className="text-right py-1.5 px-2 text-xs text-[var(--text-muted)] font-semibold uppercase">Invest</th>
                </tr>
              </thead>
              <tbody>
                {distribution.map((h) => (
                  <tr key={h.holdingId} className={`border-b border-[var(--border-light)] last:border-0 ${h.invest === 0 ? 'opacity-50' : ''}`}>
                    <td className="py-2 px-2 text-[var(--text-secondary)] max-w-[180px]">
                      <p className="truncate">{splitFundName(h.fundName).main}</p>
                      {splitFundName(h.fundName).plan && <p className="text-[10px] text-[var(--text-dim)]">{splitFundName(h.fundName).plan}</p>}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums">
                      <span className={h.isOverweight ? 'text-amber-400' : h.invest > 0 ? 'text-blue-400' : 'text-[var(--text-dim)]'}>{h.currentPct.toFixed(1)}%</span>
                      <span className="text-[var(--text-dim)]"> → {h.newPct.toFixed(1)}%</span>
                    </td>
                    <td className="py-2 px-2 text-right font-semibold tabular-nums">
                      {h.isOverweight ? (
                        <span className="text-amber-400/70 text-xs">Overweight</span>
                      ) : h.invest > 0 ? (
                        <span className="text-emerald-400">{fmt(h.invest)}</span>
                      ) : (
                        <span className="text-[var(--text-dim)] text-xs">Balanced</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              {totalInvest > 0 && (
                <tfoot>
                  <tr className="border-t border-[var(--border)]">
                    <td className="py-1.5 px-2 text-xs font-bold text-[var(--text-primary)]" colSpan={2}>Total</td>
                    <td className="py-1.5 px-2 text-right text-xs font-bold text-emerald-400 tabular-nums">{formatINR(totalInvest)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden space-y-2">
            {distribution.map((h) => (
              <FundCard key={h.holdingId} dimmed={h.invest === 0}>
                <div className="flex items-start justify-between gap-2">
                  <FundCardName fundName={h.fundName} />
                  <div className="text-right shrink-0">
                    {h.isOverweight ? (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400">Overweight</span>
                    ) : h.invest > 0 ? (
                      <p className="text-xs font-bold text-emerald-400 tabular-nums">{fmt(h.invest)}</p>
                    ) : (
                      <span className="text-[10px] text-[var(--text-dim)]">Balanced</span>
                    )}
                  </div>
                </div>
                <FundCardRow
                  label="Allocation"
                  value={<><span className={h.isOverweight ? 'text-amber-400' : h.invest > 0 ? 'text-blue-400' : ''}>{h.currentPct.toFixed(1)}%</span> <span className="text-[var(--text-dim)]">→ {h.newPct.toFixed(1)}%</span></>}
                />
              </FundCard>
            ))}

            {totalInvest > 0 && (
              <div className="flex items-center justify-between bg-[var(--bg-inset)] rounded-xl border border-[var(--border-light)] px-3.5 py-2.5">
                <p className="text-xs font-bold text-[var(--text-primary)]">Total Invest</p>
                <span className="text-sm font-bold text-emerald-400 tabular-nums">{formatINR(totalInvest)}</span>
              </div>
            )}
          </div>
        </>
      ) : (
        <p className="text-xs text-[var(--text-dim)] py-2 text-center">All funds balanced</p>
      )}

      {hasOverweight && (
        <p className="text-xs text-[var(--text-dim)] px-1">
          Overweight funds can't be fixed by buying. Use <span className="font-semibold text-amber-400">Buy / Sell</span> tab to sell overweight and buy underweight.
        </p>
      )}
    </div>
  )
}

/* ──────────────────────────────────────────────
   Buy / Sell Section
   ────────────────────────────────────────────── */
function PortfolioBuySellSection({ portfolio, holdings, totalValue }) {
  const threshold = (portfolio.rebalanceThreshold || 0.05) * 100
  const hasTargets = holdings.some((h) => h.targetAllocationPct > 0)
  const hasExitCandidates = holdings.some((h) => h.targetAllocationPct === 0 && h.units > 0)

  if (!hasTargets && !hasExitCandidates) return <NoTargetsMessage />

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
    <>
      {/* Desktop table */}
      <div className="hidden sm:block overflow-x-auto">
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
                  <td className="py-2 px-2 text-[var(--text-secondary)] max-w-[180px]">
                    <p className="truncate">{splitFundName(h.fundName).main}</p>
                    {splitFundName(h.fundName).plan && <p className="text-[10px] text-[var(--text-dim)]">{splitFundName(h.fundName).plan}</p>}
                  </td>
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

      {/* Mobile cards */}
      <div className="sm:hidden space-y-2">
        {buySellData.map((h) => {
          const isBuy = h.amount > 0
          return (
            <FundCard key={h.schemeCode || h.fundCode}>
              <div className="flex items-start justify-between gap-2">
                <FundCardName fundName={h.fundName} />
                <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0 ${isBuy ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-[var(--accent-rose)]'}`}>
                  {isBuy ? 'Buy' : h.isExit ? 'Exit' : 'Sell'} {fmt(Math.abs(h.amount))}
                </span>
              </div>
              <FundCardRow
                label="Drift"
                value={h.isExit
                  ? <span className="text-[var(--accent-rose)]">{h.currentPct.toFixed(1)}% → Exit</span>
                  : <><span>{h.currentPct.toFixed(1)}%</span> <span className="text-[var(--text-dim)]">→ {h.targetAllocationPct.toFixed(1)}%</span></>
                }
                valueClass={isBuy ? 'text-emerald-400' : 'text-amber-400'}
              />
            </FundCard>
          )
        })}
      </div>
    </>
  )
}

/* ──────────────────────────────────────────────
   Main Rebalance Dialog
   ────────────────────────────────────────────── */
export default function MFRebalanceDialog() {
  const { mfHoldings, mfPortfolios } = useData()
  const [mode, setMode] = useState('buysell')

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

  const anySIP = portfolioGroups.some((p) => (p.sipTarget || 0) >= 500)
  const availableModes = anySIP ? modes : modes.filter((m) => m.key !== 'sip')
  const effectiveMode = availableModes.some((m) => m.key === mode) ? mode : availableModes[0]?.key || 'buysell'

  return (
    <div className="space-y-4">
      {/* Mode tabs — desktop: inline pills, mobile: full-width stacked buttons */}
      <div className="hidden sm:flex bg-[var(--bg-inset)] rounded-lg p-0.5">
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

      {/* Mobile: full-width vertical buttons */}
      <div className="sm:hidden space-y-1.5">
        {availableModes.map(({ key, label, icon: MIcon, color, dimColor, activeBg }) => (
          <button key={key} onClick={() => setMode(key)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${
              effectiveMode === key ? `${activeBg} ${color}` : `bg-[var(--bg-card)] border border-[var(--border)] ${dimColor}`
            }`}
          >
            <MIcon size={16} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Per-portfolio sections */}
      {portfolioGroups.map((p, i) => (
        <div key={p.portfolioId} className="border border-[var(--border-light)] border-l-2 border-l-violet-500/50 rounded-lg overflow-hidden">
          {/* Portfolio header — desktop: single row, mobile: stacked */}
          <div className="px-3 py-2.5 bg-[var(--bg-inset)]">
            {/* Desktop header */}
            <div className="hidden sm:flex items-center justify-between">
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
                {p.sipTarget >= 100 && <span>SIP: {formatINR(p.sipTarget)}/mo</span>}
              </div>
            </div>

            {/* Mobile header — stacked */}
            <div className="sm:hidden space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-violet-400 bg-violet-500/15 w-5 h-5 rounded flex items-center justify-center shrink-0">{i + 1}</span>
                <p className="text-sm font-bold text-[var(--text-primary)] flex-1 min-w-0 truncate">{p.portfolioName}</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap pl-7">
                <span className="text-[11px] font-semibold text-[var(--text-secondary)] tabular-nums">{formatINR(p.totalValue)}</span>
                <span className="text-[10px] text-[var(--text-dim)]">{p.ownerName}</span>
                {p.driftedCount > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400">{p.driftedCount} drifted</span>}
                {p.exitCount > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-rose-500/15 text-[var(--accent-rose)]">{p.exitCount} exit</span>}
              </div>
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
