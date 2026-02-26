import { useState, useMemo } from 'react'
import { useData } from '../../context/DataContext'
import { formatINR } from '../../data/familyData'
import FundSearchInput from './FundSearchInput'
import { FormInput, FormActions } from '../Modal'
import { Plus, Trash2 } from 'lucide-react'

export default function MFAllocationManager({ portfolioId, onSave, onCancel }) {
  const { mfHoldings, mfPortfolios } = useData()

  const portfolio = mfPortfolios.find((p) => p.portfolioId === portfolioId)
  const existingHoldings = useMemo(() =>
    mfHoldings.filter((h) => h.portfolioId === portfolioId),
  [mfHoldings, portfolioId])

  // Local state: allocations editable
  const [allocations, setAllocations] = useState(() =>
    existingHoldings.map((h) => ({
      schemeCode: h.schemeCode,
      fundName: h.fundName,
      units: h.units,
      currentValue: h.currentValue,
      currentAllocationPct: h.currentAllocationPct,
      targetAllocationPct: h.targetAllocationPct,
      isNew: false,
    }))
  )
  const [newFund, setNewFund] = useState(null)
  const [newTarget, setNewTarget] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const totalTarget = allocations.reduce((s, a) => s + a.targetAllocationPct, 0)
  const totalCurrent = allocations.reduce((s, a) => s + a.currentValue, 0)

  function updateTarget(schemeCode, val) {
    setAllocations((prev) => prev.map((a) =>
      a.schemeCode === schemeCode ? { ...a, targetAllocationPct: Number(val) || 0 } : a
    ))
    setError('')
  }

  function removeZeroFund(schemeCode) {
    const holding = allocations.find((a) => a.schemeCode === schemeCode)
    if (holding && holding.units > 0) return
    setAllocations((prev) => prev.filter((a) => a.schemeCode !== schemeCode))
  }

  function addNewFund() {
    if (!newFund) return
    if (allocations.find((a) => a.schemeCode === newFund.schemeCode)) {
      setError('Fund already exists in portfolio')
      return
    }
    setAllocations((prev) => [...prev, {
      schemeCode: newFund.schemeCode,
      fundName: newFund.fundName,
      units: 0,
      currentValue: 0,
      currentAllocationPct: 0,
      targetAllocationPct: Number(newTarget) || 0,
      isNew: true,
    }])
    setNewFund(null)
    setNewTarget('')
    setError('')
  }

  async function handleSave() {
    if (totalTarget > 100) {
      setError(`Total allocation is ${totalTarget.toFixed(1)}% — must be ≤ 100%`)
      return
    }
    setSaving(true)
    try {
      await onSave(allocations.map((a) => ({ schemeCode: a.schemeCode, fundName: a.fundName, targetAllocationPct: a.targetAllocationPct, isNew: a.isNew })))
    } finally { setSaving(false) }
  }

  const sipTarget = portfolio?.sipTarget || 0

  return (
    <div className="space-y-4">
      {/* Portfolio Info */}
      <div className="bg-[var(--bg-inset)] rounded-lg px-3 py-2 border border-[var(--border-light)]">
        <p className="text-xs font-semibold text-[var(--text-primary)]">{portfolio?.portfolioName}</p>
        <div className="flex items-center gap-3 text-xs text-[var(--text-dim)] mt-0.5 flex-wrap">
          <span>Current Value: <span className="font-semibold text-[var(--text-primary)]">{formatINR(totalCurrent)}</span></span>
        </div>
      </div>

      <div className="space-y-3">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-light)]">
                  <th className="text-left py-1.5 px-2 text-xs text-[var(--text-muted)] font-semibold">Fund</th>
                  <th className="text-right py-1.5 px-2 text-xs text-[var(--text-muted)] font-semibold">Units</th>
                  <th className="text-right py-1.5 px-2 text-xs text-[var(--text-muted)] font-semibold">Current %</th>
                  <th className="text-center py-1.5 px-2 text-xs text-[var(--text-muted)] font-semibold">Target %</th>
                  <th className="text-center py-1.5 px-2 text-xs text-[var(--text-muted)] font-semibold w-8"></th>
                </tr>
              </thead>
              <tbody>
                {allocations.map((a) => {
                  // Suggested investment for new funds (0 units, has target)
                  const sugLumpsum = a.isNew && a.targetAllocationPct > 0 && a.targetAllocationPct < 100 && totalCurrent > 0
                    ? (a.targetAllocationPct / (100 - a.targetAllocationPct)) * totalCurrent
                    : 0
                  const sugSip = a.isNew && a.targetAllocationPct > 0 && sipTarget >= 100
                    ? (a.targetAllocationPct / 100) * sipTarget
                    : 0

                  return (
                    <tr key={a.schemeCode} className="border-b border-[var(--border-light)] last:border-0">
                      <td className="py-2 px-2">
                        <p className="text-xs text-[var(--text-primary)] leading-tight max-w-[200px] truncate">{a.fundName}</p>
                        <p className="text-xs text-[var(--text-dim)]">{a.schemeCode}{a.isNew && <span className="text-violet-400 ml-1">(new)</span>}</p>
                        {(sugLumpsum > 0 || sugSip > 0) && (
                          <p className="text-xs text-blue-400 mt-0.5">
                            Invest: {sugLumpsum > 0 && <span className="font-semibold">{formatINR(sugLumpsum)}</span>}
                            {sugLumpsum > 0 && sugSip > 0 && ' · '}
                            {sugSip > 0 && <span className="font-semibold">{formatINR(sugSip)}/mo SIP</span>}
                          </p>
                        )}
                      </td>
                      <td className="py-2 px-2 text-right text-xs text-[var(--text-secondary)] tabular-nums">{a.units.toFixed(2)}</td>
                      <td className="py-2 px-2 text-right text-xs text-[var(--text-secondary)] tabular-nums">{a.currentAllocationPct.toFixed(1)}%</td>
                      <td className="py-2 px-2">
                        <input
                          type="number"
                          value={a.targetAllocationPct}
                          onChange={(e) => updateTarget(a.schemeCode, e.target.value)}
                          className="w-20 mx-auto block bg-[var(--bg-inset)] border border-[var(--border)] rounded px-2 py-1 text-xs text-center text-[var(--text-primary)] focus:outline-none focus:border-violet-500/50"
                        />
                      </td>
                      <td className="py-2 px-2 text-center">
                        {a.units === 0 && (
                          <button onClick={() => removeZeroFund(a.schemeCode)} className="p-1 rounded hover:bg-rose-500/15 text-[var(--text-dim)] hover:text-[var(--accent-rose)] transition-colors">
                            <Trash2 size={12} />
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-[var(--border)]">
                  <td className="py-2 px-2 text-xs font-bold text-[var(--text-primary)]">Total</td>
                  <td></td>
                  <td className="py-2 px-2 text-right text-xs font-bold text-[var(--text-primary)] tabular-nums">
                    {allocations.reduce((s, a) => s + a.currentAllocationPct, 0).toFixed(1)}%
                  </td>
                  <td className="py-2 px-2 text-center">
                    <span className={`text-xs font-bold tabular-nums ${totalTarget > 100 ? 'text-[var(--accent-rose)]' : totalTarget === 100 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {totalTarget.toFixed(1)}%
                    </span>
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Add New Fund */}
          <div className="border-t border-[var(--border-light)] pt-3">
            <p className="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider mb-1">Add New Fund</p>
            <p className="text-xs text-[var(--text-dim)] mb-2">Set target % to see how much to invest. After buying, use Invest to record the transaction.</p>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <FundSearchInput value={newFund} onSelect={(f) => setNewFund(f.schemeCode ? f : null)} placeholder="Search fund to add..." />
              </div>
              <div className="w-24">
                <FormInput type="number" value={newTarget} onChange={setNewTarget} placeholder="Target %" style={{ textAlign: 'center' }} />
              </div>
              <button
                onClick={addNewFund}
                disabled={!newFund}
                className="shrink-0 flex items-center gap-1 px-3 py-2 text-xs font-semibold text-violet-400 hover:text-violet-300 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Plus size={14} /> Add
              </button>
            </div>
          </div>
        </div>

      {error && <p className="text-xs text-[var(--accent-rose)] font-medium">{error}</p>}

      <FormActions onCancel={onCancel} onSubmit={handleSave} submitLabel="Save Allocations" loading={saving} />
    </div>
  )
}
