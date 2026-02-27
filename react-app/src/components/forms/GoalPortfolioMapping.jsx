import { useState, useMemo } from 'react'
import { Link2, Plus, Trash2, AlertTriangle } from 'lucide-react'
import { useData } from '../../context/DataContext'
import { formatINR } from '../../data/familyData'

function inferType(id) {
  if (!id) return 'MF'
  if (id.startsWith('PFL-STK-')) return 'Stock'
  if (id.startsWith('INV-')) return 'Other'
  return 'MF'
}

export default function GoalPortfolioMapping({ goal, onClose }) {
  const { mfPortfolios, stockPortfolios, otherInvList, goalPortfolioMappings, goalList, updateGoalMappings } = useData()

  // Build unified list of all investable items
  const allInvestments = useMemo(() => {
    const items = []
    ;(mfPortfolios || []).filter((p) => p.status !== 'Inactive').forEach((p) => {
      items.push({ id: p.portfolioId, name: p.portfolioName?.replace(/^PFL-/, '') || p.portfolioName, value: p.currentValue || 0, type: 'MF', owner: p.ownerName || '' })
    })
    ;(stockPortfolios || []).filter((p) => p.status !== 'Inactive').forEach((p) => {
      items.push({ id: p.portfolioId, name: p.portfolioName, value: p.currentValue || 0, type: 'Stock', owner: p.ownerName || '' })
    })
    ;(otherInvList || []).filter((i) => i.status === 'Active').forEach((i) => {
      items.push({ id: i.investmentId, name: i.investmentName, value: i.currentValue || 0, type: 'Other', owner: i.familyMemberName || '' })
    })
    return items
  }, [mfPortfolios, stockPortfolios, otherInvList])

  // Cross-goal allocation: how much of each investment is already used by OTHER goals
  const otherGoalAllocations = useMemo(() => {
    const map = {} // { portfolioId: { total: N, goals: [{ goalName, pct }] } }
    ;(goalPortfolioMappings || []).forEach((m) => {
      if (m.goalId === goal.goalId) return // skip current goal
      if (!map[m.portfolioId]) map[m.portfolioId] = { total: 0, goals: [] }
      map[m.portfolioId].total += m.allocationPct
      const g = (goalList || []).find((g) => g.goalId === m.goalId)
      map[m.portfolioId].goals.push({ goalName: g?.goalName || m.goalId, pct: m.allocationPct })
    })
    return map
  }, [goalPortfolioMappings, goal.goalId, goalList])

  const existing = useMemo(() =>
    (goalPortfolioMappings || [])
      .filter((m) => m.goalId === goal.goalId)
      .map((m) => ({ portfolioId: m.portfolioId, allocationPct: m.allocationPct, investmentType: m.investmentType || inferType(m.portfolioId) })),
    [goalPortfolioMappings, goal.goalId]
  )

  const [mappings, setMappings] = useState(existing.length > 0 ? existing : [])

  const total = mappings.reduce((s, m) => s + (m.allocationPct || 0), 0)

  // Check for cross-goal over-allocation
  const overAllocated = useMemo(() => {
    const issues = []
    for (const m of mappings) {
      const other = otherGoalAllocations[m.portfolioId]
      const otherTotal = other?.total || 0
      const combined = otherTotal + (m.allocationPct || 0)
      if (combined > 100) {
        const item = allInvestments.find((it) => it.id === m.portfolioId)
        issues.push({ name: item?.name || m.portfolioId, combined, excess: combined - 100, goals: other?.goals || [] })
      }
    }
    return issues
  }, [mappings, otherGoalAllocations, allInvestments])

  const isValid = (total === 100 || mappings.length === 0) && overAllocated.length === 0

  function addMapping() {
    const used = new Set(mappings.map((m) => m.portfolioId))
    const available = allInvestments.find((item) => !used.has(item.id))
    if (!available) return
    setMappings((prev) => [...prev, { portfolioId: available.id, allocationPct: 0, investmentType: available.type }])
  }

  function removeMapping(idx) {
    setMappings((prev) => prev.filter((_, i) => i !== idx))
  }

  function updateMapping(idx, field, value) {
    setMappings((prev) => prev.map((m, i) => {
      if (i !== idx) return m
      if (field === 'allocationPct') return { ...m, allocationPct: Math.max(0, Math.min(100, Number(value) || 0)) }
      if (field === 'portfolioId') {
        const item = allInvestments.find((it) => it.id === value)
        return { ...m, portfolioId: value, investmentType: item ? item.type : inferType(value) }
      }
      return { ...m, [field]: value }
    }))
  }

  function handleSave() {
    updateGoalMappings(goal.goalId, mappings)
    onClose()
  }

  // Compute linked investment value
  const linkedValue = mappings.reduce((s, m) => {
    const item = allInvestments.find((it) => it.id === m.portfolioId)
    return s + (item ? (item.value * m.allocationPct) / 100 : 0)
  }, 0)

  // Group investments for optgroup rendering
  const mfItems = allInvestments.filter((it) => it.type === 'MF')
  const stockItems = allInvestments.filter((it) => it.type === 'Stock')
  const otherItems = allInvestments.filter((it) => it.type === 'Other')

  return (
    <div className="space-y-4">
      <div className="bg-[var(--bg-inset)] rounded-lg border border-[var(--border-light)] p-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-[var(--text-dim)]">Goal Target</span>
          <span className="text-sm font-bold text-[var(--text-primary)]">{formatINR(goal.targetAmount)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--text-dim)]">Linked Investment Value</span>
          <span className="text-sm font-semibold text-emerald-400">{formatINR(linkedValue)}</span>
        </div>
      </div>

      {mappings.length === 0 ? (
        <div className="py-6 text-center">
          <Link2 size={24} className="mx-auto mb-2 text-[var(--text-dim)]" />
          <p className="text-xs text-[var(--text-muted)]">No investments linked to this goal</p>
        </div>
      ) : (
        <div className="space-y-2">
          {mappings.map((m, idx) => {
            const item = allInvestments.find((it) => it.id === m.portfolioId)
            const other = otherGoalAllocations[m.portfolioId]
            const otherTotal = other?.total || 0
            const available = 100 - otherTotal
            const combined = otherTotal + (m.allocationPct || 0)
            return (
              <div key={idx} className={`bg-[var(--bg-inset)] rounded-lg border p-3 space-y-2 ${combined > 100 ? 'border-rose-500/40' : 'border-[var(--border-light)]'}`}>
                <select
                  value={m.portfolioId}
                  onChange={(e) => updateMapping(idx, 'portfolioId', e.target.value)}
                  className="w-full px-2 py-1.5 text-xs bg-[var(--bg-input)] border border-[var(--border-input)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--sidebar-active-text)]"
                >
                  {mfItems.length > 0 && (
                    <optgroup label="MF Portfolios">
                      {mfItems.map((p) => (
                        <option key={p.id} value={p.id} disabled={mappings.some((o, i) => i !== idx && o.portfolioId === p.id)}>
                          {p.name}{p.owner ? ` (${p.owner})` : ''} — {formatINR(p.value)}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {stockItems.length > 0 && (
                    <optgroup label="Stock Portfolios">
                      {stockItems.map((p) => (
                        <option key={p.id} value={p.id} disabled={mappings.some((o, i) => i !== idx && o.portfolioId === p.id)}>
                          {p.name}{p.owner ? ` (${p.owner})` : ''} — {formatINR(p.value)}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {otherItems.length > 0 && (
                    <optgroup label="Other Investments">
                      {otherItems.map((p) => (
                        <option key={p.id} value={p.id} disabled={mappings.some((o, i) => i !== idx && o.portfolioId === p.id)}>
                          {p.name}{p.owner ? ` (${p.owner})` : ''} — {formatINR(p.value)}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>

                {/* Cross-goal allocation info */}
                {otherTotal > 0 && (
                  <div className={`text-[10px] px-2 py-1 rounded ${combined > 100 ? 'bg-rose-500/10 text-rose-400' : 'bg-blue-500/10 text-blue-400'}`}>
                    Already allocated: {other.goals.map((g) => `${g.goalName} (${g.pct}%)`).join(', ')}
                    {' '} — <span className="font-bold">Available: {Math.max(0, available)}%</span>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-[var(--text-dim)]">Allocation</span>
                    <input
                      type="number"
                      value={m.allocationPct}
                      onChange={(e) => updateMapping(idx, 'allocationPct', e.target.value)}
                      className="w-16 px-2 py-1 text-xs text-center bg-[var(--bg-input)] border border-[var(--border-input)] rounded-md text-[var(--text-primary)] focus:outline-none focus:border-[var(--sidebar-active-text)]"
                      min="0"
                      max={available}
                    />
                    <span className="text-xs text-[var(--text-dim)]">%</span>
                    <button onClick={() => removeMapping(idx)} className="p-1 text-[var(--text-dim)] hover:text-rose-400 rounded transition-colors ml-1">
                      <Trash2 size={12} />
                    </button>
                  </div>
                  {item && (
                    <p className="text-[10px] text-[var(--text-dim)]">
                      Contributes {formatINR((item.value * m.allocationPct) / 100)}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Total indicator */}
      {mappings.length > 0 && (
        <div className="flex items-center justify-between px-1">
          <span className="text-xs text-[var(--text-dim)]">Total Allocation</span>
          <span className={`text-xs font-bold ${total === 100 ? 'text-emerald-400' : total > 100 ? 'text-rose-400' : 'text-amber-400'}`}>
            {total}%{total !== 100 && <span className="font-normal text-[var(--text-dim)]"> (must be 100%)</span>}
          </span>
        </div>
      )}

      {/* Over-allocation warnings */}
      {overAllocated.length > 0 && (
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2 space-y-1">
          <div className="flex items-center gap-1.5">
            <AlertTriangle size={12} className="text-rose-400 shrink-0" />
            <span className="text-[10px] font-bold text-rose-400 uppercase">Over-allocated</span>
          </div>
          {overAllocated.map((o, i) => (
            <p key={i} className="text-[10px] text-rose-300">
              {o.name}: {o.combined}% total across goals (exceeds 100% by {o.excess}%)
            </p>
          ))}
        </div>
      )}

      {/* Add button */}
      {mappings.length < allInvestments.length && (
        <button onClick={addMapping} className="flex items-center gap-1.5 text-xs font-semibold text-violet-400 hover:text-violet-300 transition-colors">
          <Plus size={14} /> Link Investment
        </button>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-4 border-t border-[var(--border-light)]">
        <button onClick={onClose} className="px-4 py-2 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-hover)] transition-colors">
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!isValid}
          className="px-5 py-2 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-500 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Save Mapping
        </button>
      </div>
    </div>
  )
}
