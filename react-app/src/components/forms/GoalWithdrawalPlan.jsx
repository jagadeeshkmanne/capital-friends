import { useEffect, useMemo, useState } from 'react'
import { ArrowDownCircle, AlertTriangle } from 'lucide-react'
import { useData } from '../../context/DataContext'
import { formatINR, splitFundName } from '../../data/familyData'
import { buildGoalWithdrawalPlan } from '../../utils/goalWithdrawal'

export default function GoalWithdrawalPlan({ goal, onClose, onConfirmWithdrawal }) {
  const { goalPortfolioMappings, mfPortfolios, mfHoldings } = useData()
  const today = new Date().toISOString().split('T')[0]
  const [redeemDate, setRedeemDate] = useState(today)
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [actualNavs, setActualNavs] = useState({})
  const [actualUnits, setActualUnits] = useState({})

  const basePlan = useMemo(() => buildGoalWithdrawalPlan({
    goal,
    mappings: goalPortfolioMappings,
    portfolios: mfPortfolios,
    holdings: mfHoldings,
  }), [goal, goalPortfolioMappings, mfPortfolios, mfHoldings])

  useEffect(() => {
    if (basePlan && withdrawAmount === '') setWithdrawAmount(String(Math.round(basePlan.defaultAmount)))
  }, [basePlan, withdrawAmount])

  const plan = useMemo(() => buildGoalWithdrawalPlan({
    goal,
    mappings: goalPortfolioMappings,
    portfolios: mfPortfolios,
    holdings: mfHoldings,
    requestedAmount: withdrawAmount === '' ? undefined : withdrawAmount,
  }), [goal, goalPortfolioMappings, mfPortfolios, mfHoldings, withdrawAmount])

  if (!plan) {
    return (
      <div className="py-8 text-center space-y-2">
        <AlertTriangle size={24} className="mx-auto text-amber-400" />
        <p className="text-sm text-[var(--text-muted)]">No portfolios linked to this goal</p>
        <p className="text-xs text-[var(--text-dim)]">Link portfolios first to generate a withdrawal plan</p>
        <button onClick={onClose} className="mt-2 px-4 py-2 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-hover)] transition-colors">Close</button>
      </div>
    )
  }

  function getNav(item) {
    const value = actualNavs[item.key]
    return value !== undefined && value !== '' ? parseFloat(value) || item.currentNav : item.currentNav
  }

  function getUnits(item) {
    const value = actualUnits[item.key]
    if (value === undefined || value === '') return item.suggestedUnits
    const units = parseFloat(value)
    if (Number.isNaN(units)) return item.suggestedUnits
    return Math.max(0, Math.min(units, item.availableUnits))
  }

  function buildRedemptions() {
    return plan.withdrawals.map(item => {
      const nav = getNav(item)
      const units = parseFloat(getUnits(item).toFixed(4))
      return {
        portfolioId: item.portfolioId,
        fundCode: item.schemeCode,
        units,
        salePrice: nav,
        saleDate: redeemDate,
        totalAmount: units * nav,
        notes: `Goal withdrawal — ${goal.goalName}`,
      }
    }).filter(item => item.units > 0)
  }

  const grouped = plan.withdrawals.reduce((map, item) => {
    if (!map[item.portfolioId]) map[item.portfolioId] = { name: item.portfolioName, owner: item.ownerName, items: [] }
    map[item.portfolioId].items.push(item)
    return map
  }, {})

  const actualTotal = plan.withdrawals.reduce((sum, item) => sum + getUnits(item) * getNav(item), 0)
  const requestedTooHigh = Number(withdrawAmount) > plan.totalLinked

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[var(--bg-inset)] rounded-lg border border-[var(--border-light)] px-4 py-3">
        <label className="space-y-1">
          <span className="text-xs text-[var(--text-dim)]">Amount required now</span>
          <input type="number" min="0" max={plan.totalLinked} step="1000" value={withdrawAmount}
            onChange={event => setWithdrawAmount(event.target.value)}
            className="w-full text-sm font-bold bg-[var(--bg-card)] border border-[var(--border)] rounded-lg px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-emerald-500" />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-[var(--text-dim)]">Redemption date</span>
          <input type="date" value={redeemDate} max={today} onChange={event => setRedeemDate(event.target.value)}
            className="w-full text-sm font-semibold bg-[var(--bg-card)] border border-[var(--border)] rounded-lg px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-emerald-500" />
        </label>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Summary label="Goal target" value={goal.targetAmount} />
        <Summary label="Linked value" value={plan.totalLinked} tone="emerald" />
        <Summary label="Redeem now" value={actualTotal} tone="amber" />
      </div>

      {requestedTooHigh && (
        <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
          The requested amount is above the value currently linked to this goal. The plan is capped at {formatINR(plan.totalLinked)}.
        </p>
      )}

      {Object.entries(grouped).map(([portfolioId, group]) => (
        <div key={portfolioId} className="bg-[var(--bg-inset)] rounded-lg border border-[var(--border-light)] overflow-hidden">
          <div className="px-4 py-2.5 bg-[var(--bg-card)] border-b border-[var(--border-light)]">
            <p className="text-xs font-semibold text-[var(--text-primary)]">{group.name}</p>
            <p className="text-xs text-[var(--text-dim)]">{group.owner}</p>
          </div>
          <div className="divide-y divide-[var(--border-light)]">
            {group.items.map(item => {
              const nav = getNav(item)
              const units = getUnits(item)
              return (
                <div key={item.key} className="px-4 py-3 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs text-[var(--text-secondary)] truncate">{splitFundName(item.fundName).main}</p>
                      <p className="text-xs text-[var(--text-dim)]">Goal-owned value {formatINR(item.availableValue)}</p>
                    </div>
                    <p className="text-xs font-bold text-emerald-400 tabular-nums">{formatINR(units * nav)}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-xs text-[var(--text-dim)]">Units
                      <input type="number" min="0" max={item.availableUnits} step="0.0001"
                        value={actualUnits[item.key] ?? ''} placeholder={item.suggestedUnits.toFixed(4)}
                        onChange={event => setActualUnits(previous => ({ ...previous, [item.key]: event.target.value }))}
                        className="mt-1 w-full text-xs font-semibold bg-[var(--bg-card)] border border-[var(--border)] rounded px-2 py-1.5 text-[var(--text-primary)]" />
                    </label>
                    <label className="text-xs text-[var(--text-dim)]">NAV ₹
                      <input type="number" min="0.01" step="0.01"
                        value={actualNavs[item.key] ?? ''} placeholder={item.currentNav.toFixed(4)}
                        onChange={event => setActualNavs(previous => ({ ...previous, [item.key]: event.target.value }))}
                        className="mt-1 w-full text-xs font-semibold bg-[var(--bg-card)] border border-[var(--border)] rounded px-2 py-1.5 text-[var(--text-primary)]" />
                    </label>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      <p className="text-xs text-[var(--text-dim)] px-1">
        The default redemption is capped at the goal target and distributed proportionally across only the units linked to this goal. Other goals and unallocated portfolio capacity are left unchanged.
      </p>

      <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border-light)]">
        <button onClick={onClose} className="px-5 py-2 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-hover)] transition-colors">Close</button>
        <button onClick={() => onConfirmWithdrawal?.(buildRedemptions())} disabled={actualTotal <= 0 || requestedTooHigh}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          <ArrowDownCircle size={13} /> Confirm Redemption
        </button>
      </div>
    </div>
  )
}

function Summary({ label, value, tone = 'default' }) {
  const toneClass = tone === 'emerald' ? 'text-emerald-400' : tone === 'amber' ? 'text-amber-400' : 'text-[var(--text-primary)]'
  return (
    <div className="bg-[var(--bg-inset)] border border-[var(--border-light)] rounded-lg px-3 py-2 text-center">
      <p className="text-xs text-[var(--text-dim)]">{label}</p>
      <p className={`text-sm font-bold tabular-nums ${toneClass}`}>{formatINR(value)}</p>
    </div>
  )
}
