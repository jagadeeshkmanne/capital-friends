import { useMemo } from 'react'
import { ArrowDownCircle, AlertTriangle } from 'lucide-react'
import { useData } from '../../context/DataContext'
import { formatINR } from '../../data/familyData'

export default function GoalWithdrawalPlan({ goal, onClose }) {
  const { goalPortfolioMappings, mfPortfolios, mfHoldings } = useData()

  const plan = useMemo(() => {
    const mappings = goalPortfolioMappings.filter((m) => m.goalId === goal.goalId)
    if (mappings.length === 0) return null

    const portfolioDetails = mappings.map((m) => {
      const portfolio = mfPortfolios.find((p) => p.portfolioId === m.portfolioId)
      if (!portfolio) return null
      const holdings = mfHoldings.filter((h) => h.portfolioId === m.portfolioId && h.units > 0)
      const portfolioValue = holdings.reduce((s, h) => s + h.currentValue, 0)
      const linkedValue = (portfolioValue * m.allocationPct) / 100

      // Proportional withdrawal from each fund
      const fundWithdrawals = holdings.map((h) => {
        const fundPct = portfolioValue > 0 ? h.currentValue / portfolioValue : 0
        const withdrawValue = linkedValue * fundPct
        const withdrawUnits = h.currentNav > 0 ? withdrawValue / h.currentNav : 0
        const taxableGain = withdrawValue - (withdrawUnits * h.avgNav)
        return {
          fundName: h.fundName,
          currentValue: h.currentValue,
          withdrawValue,
          withdrawUnits: Math.min(withdrawUnits, h.units),
          currentNav: h.currentNav,
          taxableGain,
          availableUnits: h.units,
        }
      }).filter((f) => f.withdrawValue > 0)

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
    const totalTaxableGain = portfolioDetails.reduce((s, p) =>
      s + p.fundWithdrawals.reduce((fs, f) => fs + f.taxableGain, 0), 0)

    return { portfolioDetails, totalLinked, totalTaxableGain }
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

  return (
    <div className="space-y-4">
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
        {plan.totalTaxableGain > 0 && (
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-[var(--text-dim)]">Estimated Taxable Gain</span>
            <span className="text-xs font-semibold text-amber-400">{formatINR(plan.totalTaxableGain)}</span>
          </div>
        )}
      </div>

      {/* Per-portfolio breakdown */}
      {plan.portfolioDetails.map((pd) => (
        <div key={pd.portfolioName} className="bg-[var(--bg-inset)] rounded-lg border border-[var(--border-light)] overflow-hidden">
          <div className="px-4 py-2.5 bg-[var(--bg-card)] border-b border-[var(--border-light)] flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-[var(--text-primary)]">{pd.portfolioName}</p>
              <p className="text-[10px] text-[var(--text-dim)]">{pd.ownerName} · {pd.allocationPct}% allocated to goal</p>
            </div>
            <span className="text-xs font-bold text-[var(--text-primary)]">{formatINR(pd.linkedValue)}</span>
          </div>
          <div className="px-4 py-2">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[var(--text-dim)]">
                  <th className="text-left py-1 font-medium">Fund</th>
                  <th className="text-right py-1 font-medium">Units</th>
                  <th className="text-right py-1 font-medium">Amount</th>
                  <th className="text-right py-1 font-medium">Gain</th>
                </tr>
              </thead>
              <tbody>
                {pd.fundWithdrawals.map((fw) => (
                  <tr key={fw.fundName} className="border-t border-[var(--border-light)]">
                    <td className="py-1.5 text-[var(--text-secondary)] max-w-[180px] truncate">{fw.fundName}</td>
                    <td className="py-1.5 text-right text-[var(--text-muted)] tabular-nums">{fw.withdrawUnits.toFixed(2)}</td>
                    <td className="py-1.5 text-right text-[var(--text-primary)] font-semibold tabular-nums">{formatINR(fw.withdrawValue)}</td>
                    <td className={`py-1.5 text-right tabular-nums font-semibold ${fw.taxableGain >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{formatINR(Math.abs(fw.taxableGain))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {/* Footer */}
      <div className="flex items-center justify-end gap-2 pt-4 border-t border-[var(--border-light)]">
        <button onClick={onClose} className="px-5 py-2 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-hover)] transition-colors">
          Close
        </button>
      </div>
    </div>
  )
}
