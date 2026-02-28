import { useState, useMemo } from 'react'
import { useData } from '../../context/DataContext'
import { useFamily } from '../../context/FamilyContext'
import { formatINR, splitFundName } from '../../data/familyData'
import { FormField, FormInput, FormDateInput, FormSelect, FormActions } from '../Modal'

export default function MFRedeemForm({ portfolioId, fundCode: initialFundCode, onSave, onCancel }) {
  const { mfPortfolios, mfHoldings } = useData()
  const { selectedMember } = useFamily()

  const activePortfolios = useMemo(() => {
    const active = mfPortfolios.filter((p) => p.status === 'Active')
    return selectedMember === 'all' ? active : active.filter((p) => p.ownerId === selectedMember)
  }, [mfPortfolios, selectedMember])

  // Resolve initial fund details from holdings
  const initialHolding = useMemo(() => {
    if (!portfolioId || !initialFundCode) return null
    return mfHoldings.find((h) => h.portfolioId === portfolioId && h.schemeCode === initialFundCode)
  }, [mfHoldings, portfolioId, initialFundCode])

  const [form, setForm] = useState({
    portfolioId: portfolioId || '',
    fundCode: initialFundCode || '',
    fundName: initialHolding?.fundName || '',
    date: new Date().toISOString().split('T')[0],
    units: '',
    price: initialHolding?.currentNav > 0 ? String(initialHolding.currentNav) : '',
    notes: '',
  })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  function set(key, val) {
    setForm((f) => ({ ...f, [key]: val }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  const holdings = useMemo(() => {
    if (!form.portfolioId) return []
    return mfHoldings.filter((h) => h.portfolioId === form.portfolioId && h.units > 0)
  }, [mfHoldings, form.portfolioId])

  const selectedHolding = holdings.find((h) => h.schemeCode === form.fundCode)

  function selectFund(code) {
    const holding = holdings.find((h) => h.schemeCode === code)
    setForm((f) => ({ ...f, fundCode: code, fundName: holding?.fundName || '', price: holding?.currentNav?.toString() || '' }))
    setErrors((e) => ({ ...e, fundCode: undefined }))
  }

  function setPortfolio(val) {
    setForm((f) => ({ ...f, portfolioId: val, fundCode: '', fundName: '', units: '', price: '' }))
    setErrors((e) => ({ ...e, portfolioId: undefined }))
  }

  const totalAmount = useMemo(() => (Number(form.units) || 0) * (Number(form.price) || 0), [form.units, form.price])
  const estPL = selectedHolding ? totalAmount - (Number(form.units) * selectedHolding.avgNav) : 0

  function validate() {
    const e = {}
    if (!form.portfolioId) e.portfolioId = 'Required'
    if (!form.fundCode) e.fundCode = 'Required'
    if (!form.date) e.date = 'Required'
    if (!form.units || Number(form.units) <= 0) e.units = 'Must be > 0'
    if (selectedHolding && Number(form.units) > selectedHolding.units) e.units = `Max ${selectedHolding.units.toFixed(2)} units`
    if (!form.price || Number(form.price) <= 0) e.price = 'Must be > 0'
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
  const holdingOptions = holdings.map((h) => ({ value: h.schemeCode, label: `${h.fundName} — ${h.units.toFixed(0)} units · ${formatINR(h.currentValue)}` }))

  return (
    <div className="space-y-4">
      <FormField label="Portfolio" required error={errors.portfolioId}>
        <FormSelect value={form.portfolioId} onChange={setPortfolio} options={portfolioOptions} placeholder="Select portfolio..." />
      </FormField>

      <FormField label="Fund to Redeem" required error={errors.fundCode}>
        <FormSelect value={form.fundCode} onChange={selectFund} options={holdingOptions} placeholder={form.portfolioId ? (holdings.length ? 'Select fund...' : 'No holdings') : 'Select portfolio first...'} />
      </FormField>

      {selectedHolding && (
        <div className="bg-[var(--bg-inset)] rounded-lg px-3 py-2 border border-[var(--border-light)]">
          <div>
            <p className="text-xs text-[var(--text-dim)]">{splitFundName(selectedHolding.fundName).main}</p>
            {splitFundName(selectedHolding.fundName).plan && <p className="text-[10px] text-[var(--text-dim)]">{splitFundName(selectedHolding.fundName).plan}</p>}
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            Available: <span className="font-semibold text-[var(--text-primary)]">{selectedHolding.units.toFixed(2)}</span> units
            @ ₹{selectedHolding.avgNav.toFixed(2)} avg | Current NAV: ₹{selectedHolding.currentNav.toFixed(2)}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <FormField label="Date" required error={errors.date}>
          <FormDateInput value={form.date} onChange={(v) => set('date', v)} />
        </FormField>
        <FormField label="Units" required error={errors.units}>
          <FormInput type="number" value={form.units} onChange={(v) => set('units', v)} placeholder={selectedHolding ? `Max: ${selectedHolding.units.toFixed(2)}` : ''} />
        </FormField>
        <FormField label="NAV (₹)" required error={errors.price}>
          <FormInput type="number" value={form.price} onChange={(v) => set('price', v)} placeholder="e.g., 178.45" />
        </FormField>
      </div>

      {totalAmount > 0 && (
        <div className="bg-[var(--bg-inset)] rounded-lg px-3 py-2 border border-[var(--border-light)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-[var(--text-dim)]">Redemption Amount</p>
              <p className="text-sm font-bold text-[var(--text-primary)] tabular-nums">{formatINR(totalAmount)}</p>
            </div>
            {selectedHolding && (
              <div className="text-right">
                <p className="text-xs text-[var(--text-dim)]">Est. Gain/Loss</p>
                <p className={`text-sm font-bold tabular-nums ${estPL >= 0 ? 'text-emerald-400' : 'text-[var(--accent-rose)]'}`}>
                  {estPL >= 0 ? '+' : ''}{formatINR(estPL)}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      <FormField label="Notes">
        <FormInput value={form.notes} onChange={(v) => set('notes', v)} placeholder="Optional notes..." />
      </FormField>

      <FormActions onCancel={onCancel} onSubmit={handleSubmit} submitLabel="Redeem" loading={saving} />
    </div>
  )
}
