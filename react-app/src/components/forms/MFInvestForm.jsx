import { useState, useMemo } from 'react'
import { useData } from '../../context/DataContext'
import { useFamily } from '../../context/FamilyContext'
import { formatINR } from '../../data/familyData'
import { FormField, FormInput, FormSelect, FormActions } from '../Modal'
import FundSearchInput from './FundSearchInput'

const INVEST_TYPES = [
  { value: 'INITIAL', label: 'Add Existing Holdings' },
  { value: 'SIP', label: 'SIP Investment' },
  { value: 'LUMPSUM', label: 'Lumpsum Investment' },
]

export default function MFInvestForm({ portfolioId, transactionType, onSave, onCancel }) {
  const { mfPortfolios, mfHoldings } = useData()
  const { selectedMember } = useFamily()

  const activePortfolios = useMemo(() => {
    const active = mfPortfolios.filter((p) => p.status === 'Active')
    return selectedMember === 'all' ? active : active.filter((p) => p.ownerId === selectedMember)
  }, [mfPortfolios, selectedMember])

  const [form, setForm] = useState({
    portfolioId: portfolioId || '',
    fundCode: '',
    fundName: '',
    transactionType: transactionType || 'SIP',
    date: new Date().toISOString().split('T')[0],
    units: '',
    price: '',
    notes: '',
  })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  function set(key, val) {
    setForm((f) => ({ ...f, [key]: val }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  function selectFund({ schemeCode, fundName }) {
    setForm((f) => ({ ...f, fundCode: schemeCode, fundName }))
    setErrors((e) => ({ ...e, fundCode: undefined, fundName: undefined }))
  }

  // Check if selected fund already exists in selected portfolio
  const existingHolding = useMemo(() => {
    if (!form.portfolioId || !form.fundCode) return null
    return mfHoldings.find((h) => h.portfolioId === form.portfolioId && h.schemeCode === form.fundCode)
  }, [mfHoldings, form.portfolioId, form.fundCode])

  const isNewFund = form.fundCode && !existingHolding

  const totalAmount = useMemo(() => {
    return (Number(form.units) || 0) * (Number(form.price) || 0)
  }, [form.units, form.price])

  function validate() {
    const e = {}
    if (!form.portfolioId) e.portfolioId = 'Required'
    if (!form.fundCode) e.fundCode = 'Select a fund'
    if (!form.date) e.date = 'Required'
    if (!form.units || Number(form.units) <= 0) e.units = 'Must be > 0'
    if (!form.price || Number(form.price) <= 0) e.price = 'Must be > 0'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit() {
    if (!validate()) return
    setSaving(true)
    try { await onSave(form) } finally { setSaving(false) }
  }

  const portfolioOptions = activePortfolios.map((p) => ({ value: p.portfolioId, label: `${p.portfolioName} (${p.ownerName})` }))

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Portfolio" required error={errors.portfolioId}>
          <FormSelect value={form.portfolioId} onChange={(v) => set('portfolioId', v)} options={portfolioOptions} placeholder="Select portfolio..." />
        </FormField>
        <FormField label="Transaction Type" required>
          <FormSelect value={form.transactionType} onChange={(v) => set('transactionType', v)} options={INVEST_TYPES} />
        </FormField>
      </div>

      <FormField label="Fund" required error={errors.fundCode}>
        <FundSearchInput
          value={form.fundCode ? { schemeCode: form.fundCode, fundName: form.fundName } : null}
          onSelect={selectFund}
          placeholder="Search fund by name, code, or category..."
        />
      </FormField>

      {existingHolding && (
        <div className="bg-[var(--bg-inset)] rounded-lg px-3 py-2 border border-[var(--border-light)]">
          <p className="text-xs text-[var(--text-dim)]">Existing holding — will average out</p>
          <p className="text-xs text-[var(--text-muted)]">
            Current: <span className="font-semibold text-[var(--text-primary)]">{existingHolding.units.toFixed(2)}</span> units
            @ ₹{existingHolding.avgNav.toFixed(2)} avg NAV | Value: {formatINR(existingHolding.currentValue)}
            {existingHolding.targetAllocationPct > 0 && (
              <span> · Target: {existingHolding.targetAllocationPct.toFixed(1)}%</span>
            )}
          </p>
        </div>
      )}

      {isNewFund && (
        <div className="bg-violet-500/10 rounded-lg px-3 py-2 border border-violet-500/20">
          <p className="text-xs text-violet-400 font-semibold">New fund — will be added to portfolio</p>
          <p className="text-xs text-violet-300/70 mt-0.5">Use Allocations to plan how much to invest before buying</p>
        </div>
      )}

      <FormField label="Date" required error={errors.date}>
        <FormInput type="date" value={form.date} onChange={(v) => set('date', v)} />
      </FormField>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Units" required error={errors.units}>
          <FormInput type="number" value={form.units} onChange={(v) => set('units', v)} placeholder="e.g., 150.50" />
        </FormField>
        <FormField label="NAV (₹ per unit)" required error={errors.price}>
          <FormInput type="number" value={form.price} onChange={(v) => set('price', v)} placeholder="e.g., 178.45" />
        </FormField>
      </div>

      {totalAmount > 0 && (
        <div className="bg-[var(--bg-inset)] rounded-lg px-3 py-2 border border-[var(--border-light)]">
          <p className="text-xs text-[var(--text-dim)]">Total Amount</p>
          <p className="text-sm font-bold text-[var(--text-primary)] tabular-nums">{formatINR(totalAmount)}</p>
          {existingHolding && (
            <p className="text-xs text-[var(--text-dim)] mt-0.5">
              New avg NAV: ₹{((existingHolding.investment + totalAmount) / (existingHolding.units + Number(form.units))).toFixed(2)}
              · Total units: {(existingHolding.units + Number(form.units)).toFixed(2)}
            </p>
          )}
        </div>
      )}

      <FormField label="Notes">
        <FormInput value={form.notes} onChange={(v) => set('notes', v)} placeholder="Optional notes..." />
      </FormField>

      <FormActions onCancel={onCancel} onSubmit={handleSubmit} submitLabel={form.transactionType === 'SIP' ? 'Record SIP' : form.transactionType === 'LUMPSUM' ? 'Record Lumpsum' : 'Add Holdings'} loading={saving} />
    </div>
  )
}
