import { useState, useMemo } from 'react'
import { ArrowDownCircle, AlertTriangle } from 'lucide-react'
import { useData } from '../../context/DataContext'
import { formatINR, splitFundName } from '../../data/familyData'

export default function GoalWithdrawalPlan({ goal, onClose, onConfirmWithdrawal }) {
  const { goalPortfolioMappings, mfPortfolios, mfHoldings } = useData()

  const today = new Date().toISOString().split('T')[0]
  const [redeemDate, setRedeemDate] = useState(today)
  const [actualNavs, setActualNavs] = useState({})   // schemeCode -> nav string
  const [actualUnits, setActualUnits] = useState({})  // schemeCode -> units string

  const plan = useMemo(() => {
    const mappings = (goalPortfolioMappings || []).filter((m) => m.goalId === goal.goalId)
    if (mappings.length === 0) return null

    const portfolioDetails = mappings.map((m) => {
      const portfolio = (mfPortfolios || []).find((p) => p.portfolioId === m.portfolioId)
      if (!portfolio) return null
      const holdings = (mfHoldings || []).filter((h) => h.portfolioId === m.portfolioId && h.units > 0)
      const portfolioValue = holdings.reduce((s, h) => s + h.currentValue, 0)
      const linkedValue = (portfolioValue * m.allocationPct) / 100

      const fundWithdrawals = holdings.map((h) => {
        const fundPct = portfolioValue > 0 ? h.currentValue / portfolioValue : 0
        const withdrawValue = linkedValue * fundPct
        const suggestedUnits = h.currentNav > 0 ? withdrawValue / h.currentNav : 0
        return {
          fundName: h.fundName,
          schemeCode: h.schemeCode,
          portfolioId: m.portfolioId,
          currentValue: h.currentValue,
          suggestedUnits: Math.min(suggestedUnits, h.units),
          currentNav: h.currentNav,
          avgNav: h.avgNav,
          availableUnits: h.units,
        }
      }).filter((f) => f.suggestedUnits > 0)

      return {
        portfolioName: portfolio.portfolioName,
        ownerName: portfolio.ownerName,
        allocationPct: m.allocationPct,
        portfolioValue,
        linkedValue,
        fundWithdrawals,
      }
    }).filter(Boolean)

    const totalLinked = portfolioDetails.reduce((s, p) => s + p.linkedValue, 0)
    return { portfolioDetails, totalLinked }
  }, [goal, goalPortfolioMappings, mfPortfolios, mfHoldings])

  if (!plan) {
    return (
      <div className="py-8 text-center space-y-2">
        <AlertTriangle size={24} className="mx-auto text-amber-400" />
        <p className="text-sm text-[var(--text-muted)]">No portfolios linked to this goal</p>
        <p className="text-xs text-[var(--text-dim)]">Link portfolios first to generate a withdrawal plan</p>
        <button onClick={onClose} className="mt-2 px-4 py-2 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-hover)] transition-colors">
          Close
        </button>
      </div>
    )
  }

  const progress = goal.targetAmount > 0 ? (plan.totalLinked / goal.targetAmount) * 100 : 0

  // Compute per-fund redemption amounts using actual NAV (or current NAV as default)
  function getNav(schemeCode, currentNav) {
    const v = actualNavs[schemeCode]
    return v !== undefined && v !== '' ? parseFloat(v) || currentNav : currentNav
  }

  function getUnits(schemeCode, suggestedUnits, availableUnits) {
    const v = actualUnits[schemeCode]
    if (v !== undefined && v !== '') {
      const u = parseFloat(v)
      return isNaN(u) ? suggestedUnits : Math.min(u, availableUnits)
    }
    return suggestedUnits
  }

  function buildRedemptions() {
    const list = []
    for (const pd of plan.portfolioDetails) {
      for (const fw of pd.fundWithdrawals) {
        const nav = getNav(fw.schemeCode, fw.currentNav)
        const units = parseFloat(getUnits(fw.schemeCode, fw.suggestedUnits, fw.availableUnits).toFixed(4))
        list.push({
          portfolioId: fw.portfolioId,
          fundCode: fw.schemeCode,
          units,
          salePrice: nav,
          saleDate: redeemDate,
          totalAmount: units * nav,
        })
      }
    }
    return list
  }

  return (
    <div className="space-y-4">
      {/* Redemption date */}
      <div className="flex items-center gap-3 bg-[var(--bg-inset)] rounded-lg border border-[var(--border-light)] px-4 py-3">
        <span className="text-xs text-[var(--text-dim)] shrink-0">Redemption Date</span>
        <input
          type="date" value={redeemDate} max={today}
          onChange={e => setRedeemDate(e.target.value)}
          className="flex-1 text-xs font-semibold bg-transparent text-[var(--text-primary)] border-none outline-none text-right"
        />
      </div>

      {/* Summary */}
      <div className="bg-[var(--bg-inset)] rounded-lg border border-[var(--border-light)] p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--text-dim)]">Goal Target</span>
          <span className="text-sm font-bold text-[var(--text-primary)]">{formatINR(goal.targetAmount)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--text-dim)]">Available from Linked Portfolios</span>
          <span className={`text-sm font-bold ${plan.totalLinked >= goal.targetAmount ? 'text-emerald-400' : 'text-amber-400'}`}>{formatINR(plan.totalLinked)}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-[var(--bg-card)] rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${progress >= 100 ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${Math.min(progress, 100)}%` }} />
          </div>
          <span className="text-xs font-bold text-[var(--text-primary)] tabular-nums">{progress.toFixed(0)}%</span>
        </div>
      </div>

      {/* Per-portfolio breakdown with editable NAV */}
      {plan.portfolioDetails.map((pd) => (
        <div key={pd.portfolioName} className="bg-[var(--bg-inset)] rounded-lg border border-[var(--border-light)] overflow-hidden">
          <div className="px-4 py-2.5 bg-[var(--bg-card)] border-b border-[var(--border-light)] flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-[var(--text-primary)]">{pd.portfolioName}</p>
              <p className="text-xs text-[var(--text-dim)]">{pd.ownerName} · {pd.allocationPct}% allocated to goal</p>
            </div>
            <span className="text-xs font-bold text-[var(--text-primary)]">{formatINR(pd.linkedValue)}</span>
          </div>
          <div className="px-4 py-2 space-y-3">
            {pd.fundWithdrawals.map((fw) => {
              const nav = getNav(fw.schemeCode, fw.currentNav)
              const units = getUnits(fw.schemeCode, fw.suggestedUnits, fw.availableUnits)
              const amount = units * nav
              const gain = amount - (units * fw.avgNav)
              return (
                <div key={fw.schemeCode} className="space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs text-[var(--text-secondary)] truncate">{splitFundName(fw.fundName).main}</p>
                      {splitFundName(fw.fundName).plan && <p className="text-xs text-[var(--text-dim)]">{splitFundName(fw.fundName).plan}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-bold text-[var(--text-primary)] tabular-nums">{formatINR(amount)}</p>
                      <p className={`text-xs tabular-nums ${gain >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {gain >= 0 ? '+' : ''}{formatINR(gain)} gain
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 bg-[var(--bg-card)] rounded px-2 py-1.5 flex-wrap">
                    <span className="text-xs text-[var(--text-dim)] shrink-0">Units</span>
                    <input
                      type="number" step="0.0001" min="0.0001" max={fw.availableUnits}
                      placeholder={fw.suggestedUnits.toFixed(4)}
                      value={actualUnits[fw.schemeCode] ?? ''}
                      onChange={e => setActualUnits(prev => ({ ...prev, [fw.schemeCode]: e.target.value }))}
                      className="w-24 text-xs font-semibold bg-[var(--bg-inset)] border border-[var(--border)] rounded px-1.5 py-0.5 text-[var(--text-primary)] focus:outline-none focus:border-violet-500"
                    />
                    <span className="text-xs text-[var(--text-dim)]">/ {fw.availableUnits.toFixed(4)} avail</span>
                    <span className="text-xs text-[var(--text-dim)] shrink-0 ml-auto">NAV ₹</span>
                    <input
                      type="number" step="0.01" min="0.01"
                      placeholder={fw.currentNav.toFixed(4)}
                      value={actualNavs[fw.schemeCode] ?? ''}
                      onChange={e => setActualNavs(prev => ({ ...prev, [fw.schemeCode]: e.target.value }))}
                      className="w-20 text-xs text-right font-semibold bg-[var(--bg-inset)] border border-[var(--border)] rounded px-1.5 py-0.5 text-[var(--text-primary)] focus:outline-none focus:border-violet-500"
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      <p className="text-xs text-[var(--text-dim)] px-1">
        Units and NAV are pre-filled based on your portfolio allocation — edit both to match what you actually executed in your AMC/broker.
        After confirming, redemptions will be recorded and remaining goal allocations will auto-adjust to 100%.
      </p>

      <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border-light)]">
        <button onClick={onClose} className="px-5 py-2 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-hover)] transition-colors">
          Close
        </button>
        {onConfirmWithdrawal && (
          <button
            onClick={() => onConfirmWithdrawal(buildRedemptions())}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg transition-colors"
          >
            <ArrowDownCircle size={13} />
            Confirm Redemption
          </button>
        )}
      </div>
    </div>
  )
}
