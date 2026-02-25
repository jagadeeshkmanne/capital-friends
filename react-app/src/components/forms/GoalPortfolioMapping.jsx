import { useState, useMemo } from 'react'
import { Link2, Plus, Trash2 } from 'lucide-react'
import { useData } from '../../context/DataContext'
import { formatINR } from '../../data/familyData'

export default function GoalPortfolioMapping({ goal, onClose }) {
  const { mfPortfolios, goalPortfolioMappings, updateGoalMappings } = useData()
  const activePortfolios = mfPortfolios.filter((p) => p.status !== 'Inactive')

  const existing = useMemo(() =>
    goalPortfolioMappings
      .filter((m) => m.goalId === goal.goalId)
      .map((m) => ({ portfolioId: m.portfolioId, allocationPct: m.allocationPct })),
    [goalPortfolioMappings, goal.goalId]
  )

  const [mappings, setMappings] = useState(existing.length > 0 ? existing : [])

  const total = mappings.reduce((s, m) => s + (m.allocationPct || 0), 0)
  const isValid = total === 100 || mappings.length === 0

  function addMapping() {
    const used = new Set(mappings.map((m) => m.portfolioId))
    const available = activePortfolios.find((p) => !used.has(p.portfolioId))
    if (!available) return
    setMappings((prev) => [...prev, { portfolioId: available.portfolioId, allocationPct: 0 }])
  }

  function removeMapping(idx) {
    setMappings((prev) => prev.filter((_, i) => i !== idx))
  }

  function updateMapping(idx, field, value) {
    setMappings((prev) => prev.map((m, i) => i === idx ? { ...m, [field]: field === 'allocationPct' ? Math.max(0, Math.min(100, Number(value) || 0)) : value } : m))
  }

  function handleSave() {
    updateGoalMappings(goal.goalId, mappings)
    onClose()
  }

  // Compute linked portfolio value
  const linkedValue = mappings.reduce((s, m) => {
    const p = activePortfolios.find((p) => p.portfolioId === m.portfolioId)
    return s + (p ? (p.currentValue * m.allocationPct) / 100 : 0)
  }, 0)

  return (
    <div className="space-y-4">
      <div className="bg-[var(--bg-inset)] rounded-lg border border-[var(--border-light)] p-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-[var(--text-dim)]">Goal Target</span>
          <span className="text-sm font-bold text-[var(--text-primary)]">{formatINR(goal.targetAmount)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--text-dim)]">Linked Portfolio Value</span>
          <span className="text-sm font-semibold text-emerald-400">{formatINR(linkedValue)}</span>
        </div>
      </div>

      {mappings.length === 0 ? (
        <div className="py-6 text-center">
          <Link2 size={24} className="mx-auto mb-2 text-[var(--text-dim)]" />
          <p className="text-xs text-[var(--text-muted)]">No portfolios linked to this goal</p>
        </div>
      ) : (
        <div className="space-y-2">
          {mappings.map((m, idx) => {
            const portfolio = activePortfolios.find((p) => p.portfolioId === m.portfolioId)
            return (
              <div key={idx} className="flex items-center gap-2 bg-[var(--bg-inset)] rounded-lg border border-[var(--border-light)] p-3">
                <div className="flex-1 min-w-0">
                  <select
                    value={m.portfolioId}
                    onChange={(e) => updateMapping(idx, 'portfolioId', e.target.value)}
                    className="w-full px-2 py-1.5 text-xs bg-[var(--bg-input)] border border-[var(--border-input)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--sidebar-active-text)]"
                  >
                    {activePortfolios.map((p) => (
                      <option key={p.portfolioId} value={p.portfolioId} disabled={mappings.some((o, i) => i !== idx && o.portfolioId === p.portfolioId)}>
                        {p.portfolioName} ({p.ownerName}) — {formatINR(p.currentValue)}
                      </option>
                    ))}
                  </select>
                  {portfolio && (
                    <p className="text-[10px] text-[var(--text-dim)] mt-1 px-1">
                      Contributes {formatINR((portfolio.currentValue * m.allocationPct) / 100)} to this goal
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <input
                    type="number"
                    value={m.allocationPct}
                    onChange={(e) => updateMapping(idx, 'allocationPct', e.target.value)}
                    className="w-16 px-2 py-1.5 text-xs text-center bg-[var(--bg-input)] border border-[var(--border-input)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--sidebar-active-text)]"
                    min="0"
                    max="100"
                  />
                  <span className="text-xs text-[var(--text-dim)]">%</span>
                  <button onClick={() => removeMapping(idx)} className="p-1.5 text-[var(--text-dim)] hover:text-rose-400 rounded transition-colors">
                    <Trash2 size={12} />
                  </button>
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

      {/* Add button */}
      {mappings.length < activePortfolios.length && (
        <button onClick={addMapping} className="flex items-center gap-1.5 text-xs font-semibold text-violet-400 hover:text-violet-300 transition-colors">
          <Plus size={14} /> Link Portfolio
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
