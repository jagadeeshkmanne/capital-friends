import { useState, useMemo } from 'react'
import { useData } from '../../context/DataContext'
import { useFamily } from '../../context/FamilyContext'
import { formatINR, splitFundName } from '../../data/familyData'
import { FormField, FormInput, FormDateInput, FormSelect, FormActions } from '../Modal'
import FundSearchInput from './FundSearchInput'

export default function MFSwitchForm({ portfolioId, onSave, onCancel }) {
  const { mfPortfolios, mfHoldings } = useData()
  const { selectedMember } = useFamily()

  const activePortfolios = useMemo(() => {
    const active = mfPortfolios.filter((p) => p.status === 'Active')
    return selectedMember === 'all' ? active : active.filter((p) => p.ownerId === selectedMember)
  }, [mfPortfolios, selectedMember])

  const [form, setForm] = useState({
    fromPortfolioId: portfolioId || '',
    toPortfolioId: portfolioId || '',
    fromFundCode: '',
    fromFundName: '',
    toFundCode: '',
    toFundName: '',
    date: new Date().toISOString().split('T')[0],
    units: '',
    fromPrice: '',
    toPrice: '',
    targetAllocation: '',
    notes: '',
  })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  function set(key, val) {
    setForm((f) => ({ ...f, [key]: val }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  function setFromPortfolio(val) {
    setForm((f) => ({ ...f, fromPortfolioId: val, fromFundCode: '', fromFundName: '', units: '', fromPrice: '' }))
    setErrors((e) => ({ ...e, fromPortfolioId: undefined }))
  }

  function setToPortfolio(val) {
    setForm((f) => ({ ...f, toPortfolioId: val, toFundCode: '', toFundName: '', toPrice: '', targetAllocation: '' }))
    setErrors((e) => ({ ...e, toPortfolioId: undefined }))
  }

  const fromHoldings = useMemo(() => {
    if (!form.fromPortfolioId) return []
    return mfHoldings.filter((h) => h.portfolioId === form.fromPortfolioId && h.units > 0)
  }, [mfHoldings, form.fromPortfolioId])

  const fromHolding = fromHoldings.find((h) => h.schemeCode === form.fromFundCode)

  const toHoldingExists = useMemo(() => {
    if (!form.toPortfolioId || !form.toFundCode) return null
    return mfHoldings.find((h) => h.portfolioId === form.toPortfolioId && h.schemeCode === form.toFundCode)
  }, [mfHoldings, form.toPortfolioId, form.toFundCode])

  const isNewFund = form.toFundCode && !toHoldingExists
  const isCrossPortfolio = form.fromPortfolioId && form.toPortfolioId && form.fromPortfolioId !== form.toPortfolioId

  function selectFromFund(code) {
    const holding = fromHoldings.find((h) => h.schemeCode === code)
    setForm((f) => ({ ...f, fromFundCode: code, fromFundName: holding?.fundName || '', fromPrice: holding?.currentNav?.toString() || '' }))
    setErrors((e) => ({ ...e, fromFundCode: undefined }))
  }

  function selectToFund({ schemeCode, fundName }) {
    const existing = mfHoldings.find((h) => h.portfolioId === form.toPortfolioId && h.schemeCode === schemeCode)
    setForm((f) => ({
      ...f,
      toFundCode: schemeCode,
      toFundName: fundName,
      toPrice: existing?.currentNav?.toString() || f.toPrice,
      targetAllocation: '',
    }))
    setErrors((e) => ({ ...e, toFundCode: undefined }))
  }

  const switchAmount = useMemo(() => (Number(form.units) || 0) * (Number(form.fromPrice) || 0), [form.units, form.fromPrice])
  const toUnits = switchAmount > 0 && Number(form.toPrice) > 0 ? switchAmount / Number(form.toPrice) : 0
  const estPL = fromHolding ? switchAmount - (Number(form.units) * fromHolding.avgNav) : 0

  function validate() {
    const e = {}
    if (!form.fromPortfolioId) e.fromPortfolioId = 'Required'
    if (!form.toPortfolioId) e.toPortfolioId = 'Required'
    if (!form.fromFundCode) e.fromFundCode = 'Required'
    if (!form.toFundCode) e.toFundCode = 'Required'
    if (form.fromFundCode && form.toFundCode && form.fromFundCode === form.toFundCode && !isCrossPortfolio) {
      e.toFundCode = 'Must be different fund (or select a different portfolio)'
    }
    if (!form.date) e.date = 'Required'
    if (!form.units || Number(form.units) <= 0) e.units = 'Must be > 0'
    if (fromHolding && Number(form.units) > fromHolding.units) e.units = `Max ${fromHolding.units.toFixed(2)} units`
    if (!form.fromPrice || Number(form.fromPrice) <= 0) e.fromPrice = 'Must be > 0'
    if (!form.toPrice || Number(form.toPrice) <= 0) e.toPrice = 'Must be > 0'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit() {
    if (!validate()) return
    setSaving(true)
    try { await onSave(form) } finally { setSaving(false) }
  }

  const portfolioOptions = activePortfolios.map((p) => {
    const name = p.portfolioName?.replace(/^PFL-/, '') || p.portfolioName
    const label = p.ownerName ? `${name} (${p.ownerName})` : name
    return { value: p.portfolioId, label }
  })

  const fromHoldingOptions = fromHoldings.map((h) => ({ value: h.schemeCode, label: h.fundName }))

  return (
    <div className="space-y-4">
      {/* From side */}
      <FormField label="From Portfolio" required error={errors.fromPortfolioId}>
        <FormSelect value={form.fromPortfolioId} onChange={setFromPortfolio} options={portfolioOptions} placeholder="Select source portfolio..." />
      </FormField>

      <FormField label="Switch From (Sell)" required error={errors.fromFundCode}>
        <FormSelect
          value={form.fromFundCode}
          onChange={selectFromFund}
          options={fromHoldingOptions}
          placeholder={form.fromPortfolioId ? (fromHoldings.length ? 'Select fund to switch from...' : 'No holdings') : 'Select portfolio first...'}
        />
      </FormField>

      {fromHolding && (
        <div className="bg-[var(--bg-inset)] rounded-lg px-3 py-2 border border-[var(--border-light)]">
          <p className="text-xs text-[var(--text-dim)]">{splitFundName(fromHolding.fundName).main}</p>
          {splitFundName(fromHolding.fundName).plan && <p className="text-[10px] text-[var(--text-dim)]">{splitFundName(fromHolding.fundName).plan}</p>}
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Available: <span className="font-semibold text-[var(--text-primary)]">{fromHolding.units.toFixed(2)}</span> units
            @ ₹{fromHolding.avgNav.toFixed(2)} avg · Current NAV: ₹{fromHolding.currentNav.toFixed(2)}
          </p>
        </div>
      )}

      {/* To side */}
      <div className="flex items-center gap-2 pt-1">
        <div className="flex-1 h-px bg-[var(--border-light)]" />
        {isCrossPortfolio && (
          <span className="text-[10px] font-semibold text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded-full shrink-0">Cross-portfolio switch</span>
        )}
        <div className="flex-1 h-px bg-[var(--border-light)]" />
      </div>

      <FormField label="To Portfolio" required error={errors.toPortfolioId}>
        <FormSelect value={form.toPortfolioId} onChange={setToPortfolio} options={portfolioOptions} placeholder="Select destination portfolio..." />
      </FormField>

      <FormField label="Switch To (Buy)" required error={errors.toFundCode}>
        <FundSearchInput
          value={form.toFundCode ? { schemeCode: form.toFundCode, fundName: form.toFundName } : null}
          onSelect={selectToFund}
          placeholder="Search fund to switch into..."
          disabled={!form.toPortfolioId}
        />
      </FormField>

      {toHoldingExists && (
        <div className="bg-[var(--bg-inset)] rounded-lg px-3 py-2 border border-[var(--border-light)]">
          <p className="text-xs text-[var(--text-dim)]">Existing holding — units will be added, NAV averaged out</p>
          <p className="text-xs text-[var(--text-muted)]">
            Current: <span className="font-semibold text-[var(--text-primary)]">{toHoldingExists.units.toFixed(2)}</span> units
            @ ₹{toHoldingExists.avgNav.toFixed(2)} avg · Alloc: {toHoldingExists.targetAllocationPct.toFixed(1)}%
          </p>
        </div>
      )}

      {isNewFund && (
        <div className="bg-violet-500/10 rounded-lg px-3 py-2 border border-violet-500/20">
          <p className="text-xs text-violet-400 font-semibold">New fund — will be added to {isCrossPortfolio ? 'destination portfolio' : 'portfolio'}</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Switch Date" required error={errors.date}>
          <FormDateInput value={form.date} onChange={(v) => set('date', v)} />
        </FormField>
        <FormField label="Units to Switch" required error={errors.units}>
          <FormInput type="number" value={form.units} onChange={(v) => set('units', v)} placeholder={fromHolding ? `Max: ${fromHolding.units.toFixed(2)}` : ''} />
        </FormField>
      </div>

      <div className={`grid grid-cols-1 ${isNewFund ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-4`}>
        <FormField label="From Fund NAV (₹)" required error={errors.fromPrice}>
          <FormInput type="number" value={form.fromPrice} onChange={(v) => set('fromPrice', v)} placeholder="e.g., 178.45" />
        </FormField>
        <FormField label="To Fund NAV (₹)" required error={errors.toPrice}>
          <FormInput type="number" value={form.toPrice} onChange={(v) => set('toPrice', v)} placeholder="e.g., 82.10" />
        </FormField>
        {isNewFund && (
          <FormField label="Target Allocation (%)">
            <FormInput type="number" value={form.targetAllocation} onChange={(v) => set('targetAllocation', v)} placeholder="e.g., 20" />
          </FormField>
        )}
      </div>

      {switchAmount > 0 && (
        <div className="bg-[var(--bg-inset)] rounded-lg px-3 py-2 border border-[var(--border-light)]">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <p className="text-xs text-[var(--text-dim)]">Switch Amount</p>
              <p className="text-sm font-bold text-[var(--text-primary)] tabular-nums">{formatINR(switchAmount)}</p>
            </div>
            {toUnits > 0 && (
              <div className="text-center">
                <p className="text-xs text-[var(--text-dim)]">Units Bought</p>
                <p className="text-sm font-bold text-[var(--text-primary)] tabular-nums">{toUnits.toFixed(4)}</p>
              </div>
            )}
            {fromHolding && (
              <div className="text-right">
                <p className="text-xs text-[var(--text-dim)]">Est. Gain/Loss</p>
                <p className={`text-sm font-bold tabular-nums ${estPL >= 0 ? 'text-emerald-400' : 'text-[var(--accent-rose)]'}`}>
                  {estPL >= 0 ? '+' : ''}{formatINR(estPL)}
                </p>
              </div>
            )}
          </div>
          {toHoldingExists && toUnits > 0 && (
            <p className="text-xs text-[var(--text-dim)] mt-1 border-t border-[var(--border-light)] pt-1">
              New total: {(toHoldingExists.units + toUnits).toFixed(2)} units · New avg NAV: ₹{((toHoldingExists.investment + switchAmount) / (toHoldingExists.units + toUnits)).toFixed(2)}
            </p>
          )}
        </div>
      )}

      <FormField label="Notes">
        <FormInput value={form.notes} onChange={(v) => set('notes', v)} placeholder="Optional notes..." />
      </FormField>

      <FormActions onCancel={onCancel} onSubmit={handleSubmit} submitLabel="Switch Funds" loading={saving} />
    </div>
  )
}
