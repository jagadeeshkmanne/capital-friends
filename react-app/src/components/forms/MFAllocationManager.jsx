import { useState, useMemo } from 'react'
import { useData } from '../../context/DataContext'
import { formatINR } from '../../data/familyData'
import FundSearchInput from './FundSearchInput'
import { FormField, FormInput, FormActions } from '../Modal'
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
  const [customLumpsum, setCustomLumpsum] = useState('')

  const totalTarget = allocations.reduce((s, a) => s + a.targetAllocationPct, 0)
  const totalCurrent = allocations.reduce((s, a) => s + a.currentValue, 0)
  const threshold = (portfolio?.rebalanceThreshold || 0.05) * 100

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

  // Gap analysis
  const gapAnalysis = allocations.map((a) => {
    const targetValue = totalCurrent > 0 ? (a.targetAllocationPct / 100) * totalCurrent : 0
    const gap = targetValue - a.currentValue
    return { ...a, targetValue, gap }
  })

  // SIP distribution (simple target% based)
  const sipTarget = portfolio?.sipTarget || 0
  const sipPlan = allocations.map((a) => ({
    ...a,
    sipAmount: sipTarget > 0 ? (a.targetAllocationPct / 100) * sipTarget : 0,
  }))

  // Smart rebalance lumpsum calculator
  // GAS formula: MAX(0, Target% × (TotalCurrent + LumpsumAmount) - CurrentValue)
  const lumpsumAmount = Number(customLumpsum) || portfolio?.lumpsumTarget || 0
  const rebalancePlan = useMemo(() => {
    if (lumpsumAmount <= 0) return []
    const newTotal = totalCurrent + lumpsumAmount

    const plan = allocations.map((a) => {
      const deviation = Math.abs(a.currentAllocationPct - a.targetAllocationPct)
      const needsRebalance = deviation > threshold

      // Smart rebalance: allocate to bring fund toward target in the new total
      const targetValueAfter = (a.targetAllocationPct / 100) * newTotal
      const smartAllocation = Math.max(0, targetValueAfter - a.currentValue)

      // Simple: just target% of lumpsum
      const simpleAllocation = (a.targetAllocationPct / 100) * lumpsumAmount

      const allocation = needsRebalance ? smartAllocation : simpleAllocation

      // After allocation
      const newValue = a.currentValue + allocation
      const newPct = newTotal > 0 ? (newValue / newTotal) * 100 : 0

      return {
        ...a,
        allocation,
        simpleAllocation,
        smartAllocation,
        needsRebalance,
        deviation,
        newValue,
        newPct,
      }
    })

    // Normalize: total smart allocations might not equal lumpsumAmount, so scale
    const totalAllocated = plan.reduce((s, p) => s + p.allocation, 0)
    if (totalAllocated > 0 && Math.abs(totalAllocated - lumpsumAmount) > 1) {
      const scale = lumpsumAmount / totalAllocated
      plan.forEach((p) => {
        p.allocation = p.allocation * scale
        p.newValue = p.currentValue + p.allocation
        p.newPct = newTotal > 0 ? (p.newValue / newTotal) * 100 : 0
      })
    }

    return plan
  }, [allocations, lumpsumAmount, totalCurrent, threshold])

  const [view, setView] = useState('allocations')

  return (
    <div className="space-y-4">
      {/* Portfolio Info */}
      <div className="bg-[var(--bg-inset)] rounded-lg px-3 py-2 border border-[var(--border-light)]">
        <p className="text-xs font-semibold text-[var(--text-primary)]">{portfolio?.portfolioName}</p>
        <div className="flex items-center gap-3 text-xs text-[var(--text-dim)] mt-0.5 flex-wrap">
          <span>Current Value: <span className="font-semibold text-[var(--text-primary)]">{formatINR(totalCurrent)}</span></span>
          {sipTarget > 0 && <span>SIP Target: {formatINR(sipTarget)}/mo</span>}
          {portfolio?.lumpsumTarget > 0 && <span>Lumpsum: {formatINR(portfolio.lumpsumTarget)}</span>}
          <span>Rebalance Threshold: {threshold.toFixed(0)}%</span>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex items-center gap-1 bg-[var(--bg-inset)] rounded-lg p-0.5 overflow-x-auto">
        {[
          { id: 'allocations', label: 'Allocations' },
          { id: 'gap', label: 'Gap Analysis' },
          { id: 'sip', label: 'SIP Plan' },
          { id: 'rebalance', label: 'Rebalance Lumpsum' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setView(t.id)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
              view === t.id ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Allocations View */}
      {view === 'allocations' && (
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
                  const sugSip = a.isNew && a.targetAllocationPct > 0 && sipTarget > 0
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
              <div className="w-20">
                <FormInput type="number" value={newTarget} onChange={setNewTarget} placeholder="%" />
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
      )}

      {/* Gap Analysis View */}
      {view === 'gap' && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-light)]">
                <th className="text-left py-1.5 px-2 text-xs text-[var(--text-muted)] font-semibold">Fund</th>
                <th className="text-right py-1.5 px-2 text-xs text-[var(--text-muted)] font-semibold">Current Value</th>
                <th className="text-right py-1.5 px-2 text-xs text-[var(--text-muted)] font-semibold">
                  <div>Allocation</div>
                  <div className="text-[10px] font-medium text-[var(--text-dim)]">Curr / Target</div>
                </th>
                <th className="text-right py-1.5 px-2 text-xs text-[var(--text-muted)] font-semibold">Target Value</th>
                <th className="text-right py-1.5 px-2 text-xs text-[var(--text-muted)] font-semibold">Gap</th>
              </tr>
            </thead>
            <tbody>
              {gapAnalysis.map((a) => (
                <tr key={a.schemeCode} className="border-b border-[var(--border-light)] last:border-0">
                  <td className="py-2 px-2 text-xs text-[var(--text-primary)] max-w-[180px] truncate">{a.fundName}</td>
                  <td className="py-2 px-2 text-right text-xs text-[var(--text-secondary)] tabular-nums">{formatINR(a.currentValue)}</td>
                  <td className="py-2 px-2 text-right">
                    <span className="text-xs text-[var(--text-secondary)] tabular-nums">{a.currentAllocationPct.toFixed(1)}%</span>
                    <span className="text-xs text-[var(--text-dim)]"> / {a.targetAllocationPct.toFixed(1)}%</span>
                  </td>
                  <td className="py-2 px-2 text-right text-xs text-[var(--text-secondary)] tabular-nums">{formatINR(a.targetValue)}</td>
                  <td className="py-2 px-2 text-right">
                    <span className={`text-xs font-semibold tabular-nums ${a.gap >= 0 ? 'text-emerald-400' : 'text-[var(--accent-rose)]'}`}>
                      {a.gap >= 0 ? '+' : ''}{formatINR(a.gap)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* SIP Plan View */}
      {view === 'sip' && (
        <div className="space-y-2">
          {sipTarget > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-light)]">
                    <th className="text-left py-1.5 px-2 text-xs text-[var(--text-muted)] font-semibold">Fund</th>
                    <th className="text-right py-1.5 px-2 text-xs text-[var(--text-muted)] font-semibold">
                      <div>Allocation</div>
                      <div className="text-[10px] font-medium text-[var(--text-dim)]">Curr / Target</div>
                    </th>
                    <th className="text-right py-1.5 px-2 text-xs text-[var(--text-muted)] font-semibold">Monthly SIP</th>
                  </tr>
                </thead>
                <tbody>
                  {sipPlan.filter((a) => a.targetAllocationPct > 0).map((a) => (
                    <tr key={a.schemeCode} className="border-b border-[var(--border-light)] last:border-0">
                      <td className="py-2 px-2 text-xs text-[var(--text-primary)] max-w-[200px] truncate">{a.fundName}</td>
                      <td className="py-2 px-2 text-right">
                        <span className="text-xs text-[var(--text-secondary)] tabular-nums">{a.currentAllocationPct.toFixed(1)}%</span>
                        <span className="text-xs text-[var(--text-dim)]"> / {a.targetAllocationPct.toFixed(1)}%</span>
                      </td>
                      <td className="py-2 px-2 text-right text-xs font-semibold text-blue-400 tabular-nums">{formatINR(a.sipAmount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-[var(--border)]">
                    <td className="py-2 px-2 text-xs font-bold text-[var(--text-primary)]">Total</td>
                    <td></td>
                    <td className="py-2 px-2 text-right text-xs font-bold text-blue-400 tabular-nums">{formatINR(sipTarget)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <p className="text-xs text-[var(--text-muted)] text-center py-4">No SIP target set for this portfolio. Edit portfolio to set one.</p>
          )}
        </div>
      )}

      {/* Rebalance Lumpsum View */}
      {view === 'rebalance' && (
        <div className="space-y-3">
          {/* Amount input */}
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <FormField label="Lumpsum Amount (₹)">
                <FormInput
                  type="number"
                  value={customLumpsum}
                  onChange={setCustomLumpsum}
                  placeholder={portfolio?.lumpsumTarget ? `Default: ${formatINR(portfolio.lumpsumTarget)}` : 'Enter amount to invest...'}
                />
              </FormField>
            </div>
            {portfolio?.lumpsumTarget > 0 && !customLumpsum && (
              <p className="text-xs text-[var(--text-dim)] pb-2">Using portfolio lumpsum target</p>
            )}
          </div>

          {lumpsumAmount > 0 ? (
            <>
              {/* Explanation */}
              <div className="bg-violet-500/10 rounded-lg px-3 py-2 border border-violet-500/20">
                <p className="text-xs text-violet-300 leading-relaxed">
                  Smart rebalance: Funds deviating &gt;{threshold.toFixed(0)}% from target get adjusted allocation.
                  Overweight funds get ₹0. Underweight funds get more to bring them toward target.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border-light)]">
                      <th className="text-left py-1.5 px-2 text-xs text-[var(--text-muted)] font-semibold">Fund</th>
                      <th className="text-right py-1.5 px-2 text-xs text-[var(--text-muted)] font-semibold">
                        <div>Allocation</div>
                        <div className="text-[10px] font-medium text-[var(--text-dim)]">Curr → After</div>
                      </th>
                      <th className="text-right py-1.5 px-2 text-xs text-[var(--text-muted)] font-semibold">Current Value</th>
                      <th className="text-right py-1.5 px-2 text-xs text-[var(--text-muted)] font-semibold">Invest</th>
                      <th className="text-right py-1.5 px-2 text-xs text-[var(--text-muted)] font-semibold">After Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rebalancePlan.map((a) => {
                      const isZero = a.allocation < 1
                      return (
                        <tr key={a.schemeCode} className={`border-b border-[var(--border-light)] last:border-0 ${isZero ? 'opacity-50' : ''}`}>
                          <td className="py-2 px-2">
                            <p className="text-xs text-[var(--text-primary)] max-w-[160px] truncate">{a.fundName}</p>
                            {a.needsRebalance && (
                              <span className="text-xs text-amber-400 font-semibold">
                                {a.currentAllocationPct > a.targetAllocationPct ? 'overweight' : 'underweight'} ({a.deviation.toFixed(1)}%)
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-2 text-right">
                            <span className="text-xs text-[var(--text-secondary)] tabular-nums">{a.currentAllocationPct.toFixed(1)}%</span>
                            <span className="text-xs text-[var(--text-dim)]"> → </span>
                            <span className={`text-xs font-semibold tabular-nums ${Math.abs(a.newPct - a.targetAllocationPct) < threshold ? 'text-emerald-400' : 'text-amber-400'}`}>
                              {a.newPct.toFixed(1)}%
                            </span>
                            <p className="text-xs text-[var(--text-dim)]">target: {a.targetAllocationPct.toFixed(1)}%</p>
                          </td>
                          <td className="py-2 px-2 text-right text-xs text-[var(--text-secondary)] tabular-nums">{formatINR(a.currentValue)}</td>
                          <td className="py-2 px-2 text-right">
                            {a.allocation >= 1 ? (
                              <span className="text-xs font-bold text-emerald-400 tabular-nums">{formatINR(a.allocation)}</span>
                            ) : (
                              <span className="text-xs text-[var(--text-dim)]">₹0</span>
                            )}
                          </td>
                          <td className="py-2 px-2 text-right text-xs text-[var(--text-secondary)] tabular-nums">{formatINR(a.newValue)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-[var(--border)]">
                      <td className="py-2 px-2 text-xs font-bold text-[var(--text-primary)]">Total</td>
                      <td></td>
                      <td className="py-2 px-2 text-right text-xs font-bold text-[var(--text-primary)] tabular-nums">{formatINR(totalCurrent)}</td>
                      <td className="py-2 px-2 text-right text-xs font-bold text-emerald-400 tabular-nums">{formatINR(lumpsumAmount)}</td>
                      <td className="py-2 px-2 text-right text-xs font-bold text-[var(--text-primary)] tabular-nums">{formatINR(totalCurrent + lumpsumAmount)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          ) : (
            <p className="text-xs text-[var(--text-muted)] text-center py-4">Enter an amount above to see rebalance distribution.</p>
          )}
        </div>
      )}

      {error && <p className="text-xs text-[var(--accent-rose)] font-medium">{error}</p>}

      <FormActions onCancel={onCancel} onSubmit={handleSave} submitLabel="Save Allocations" loading={saving} />
    </div>
  )
}
