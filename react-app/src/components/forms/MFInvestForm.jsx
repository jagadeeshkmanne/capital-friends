import { useState, useMemo } from 'react'
import { useData } from '../../context/DataContext'
import { useFamily } from '../../context/FamilyContext'
import { formatINR, splitFundName } from '../../data/familyData'
import { FormField, FormInput, FormDateInput, FormSelect, FormActions } from '../Modal'
import FundSearchInput from './FundSearchInput'
import { Search, ChevronDown } from 'lucide-react'

const INVEST_TYPES = [
  { value: 'INITIAL', label: 'Add Existing Holdings' },
  { value: 'SIP', label: 'SIP Investment' },
  { value: 'LUMPSUM', label: 'Lumpsum Investment' },
]

export default function MFInvestForm({ portfolioId, fundCode: initialFundCode, fundName: initialFundName, transactionType, onSave, onCancel }) {
  const { mfPortfolios, mfHoldings } = useData()
  const { selectedMember } = useFamily()

  const activePortfolios = useMemo(() => {
    const active = mfPortfolios.filter((p) => p.status === 'Active')
    return selectedMember === 'all' ? active : active.filter((p) => p.ownerId === selectedMember)
  }, [mfPortfolios, selectedMember])

  const [form, setForm] = useState({
    portfolioId: portfolioId || '',
    fundCode: initialFundCode || '',
    fundName: initialFundName || '',
    nav: 0,
    navDate: '',
    transactionType: transactionType || 'SIP',
    date: new Date().toISOString().split('T')[0],
    units: '',
    price: '',
    notes: '',
  })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [showSearch, setShowSearch] = useState(!initialFundCode)

  function set(key, val) {
    setForm((f) => ({ ...f, [key]: val }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  function selectFund({ schemeCode, fundName, nav, navDate }) {
    setForm((f) => ({ ...f, fundCode: schemeCode, fundName, nav: nav || 0, navDate: navDate || '', price: nav > 0 ? String(nav) : f.price }))
    setErrors((e) => ({ ...e, fundCode: undefined, fundName: undefined }))
    setShowSearch(false)
  }

  function selectExistingFund(h) {
    setForm((f) => ({
      ...f,
      fundCode: h.schemeCode,
      fundName: h.fundName,
      nav: h.currentNav || 0,
      navDate: '',
      price: h.currentNav > 0 ? String(h.currentNav) : f.price,
    }))
    setErrors((e) => ({ ...e, fundCode: undefined }))
    setShowSearch(false)
  }

  // All holdings for selected portfolio (including planned funds with 0 units)
  const portfolioHoldings = useMemo(() => {
    if (!form.portfolioId) return []
    return mfHoldings.filter((h) => h.portfolioId === form.portfolioId)
      .sort((a, b) => b.currentValue - a.currentValue)
  }, [mfHoldings, form.portfolioId])

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
    try {
      await onSave({
        portfolioId: form.portfolioId,
        fundCode: form.fundCode,
        fundName: form.fundName,
        transactionType: form.transactionType,
        purchaseDate: form.date,
        units: form.units,
        avgPrice: form.price,
        notes: form.notes,
      })
    } finally { setSaving(false) }
  }

  const portfolioOptions = activePortfolios.map((p) => {
    const name = p.portfolioName?.replace(/^PFL-/, '') || p.portfolioName
    const label = p.ownerName ? `${name} (${p.ownerName})` : name
    return { value: p.portfolioId, label }
  })

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Portfolio" required error={errors.portfolioId}>
          <FormSelect value={form.portfolioId} onChange={(v) => { set('portfolioId', v); if (!initialFundCode) { set('fundCode', ''); set('fundName', ''); setShowSearch(false) } }} options={portfolioOptions} placeholder="Select portfolio..." />
        </FormField>
        <FormField label="Transaction Type" required>
          <FormSelect value={form.transactionType} onChange={(v) => set('transactionType', v)} options={INVEST_TYPES} />
        </FormField>
      </div>

      {/* Fund Selection */}
      <FormField label="Fund" required error={errors.fundCode}>
        {form.fundCode && !showSearch ? (
          /* Selected fund display */
          <div className="flex items-center gap-2 px-3 py-2 bg-[var(--bg-inset)] border border-[var(--border)] rounded-lg">
            <div className="flex-1 min-w-0">
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)] truncate">{splitFundName(form.fundName).main}</p>
                {splitFundName(form.fundName).plan && <p className="text-[10px] text-[var(--text-dim)]">{splitFundName(form.fundName).plan}</p>}
              </div>
              <p className="text-xs text-[var(--text-dim)]">{form.fundCode}{form.nav > 0 && <span className="ml-2 text-emerald-400">NAV: ₹{form.nav.toFixed(2)}</span>}</p>
            </div>
            <button
              type="button"
              onClick={() => { set('fundCode', ''); set('fundName', ''); setShowSearch(true) }}
              className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] underline shrink-0"
            >
              Change
            </button>
          </div>
        ) : (
          /* Fund picker: portfolio funds list + search for new */
          <div className="space-y-3">
            {portfolioHoldings.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-dim)] mb-1.5">Portfolio Funds</p>
                <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] overflow-hidden max-h-44 overflow-y-auto">
                  {portfolioHoldings.map((h) => (
                    <button
                      key={h.holdingId}
                      type="button"
                      onClick={() => selectExistingFund(h)}
                      className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-[var(--bg-hover)] border-b border-[var(--border-light)] last:border-b-0 transition-colors group"
                    >
                      <div className="flex-1 min-w-0">
                        <div>
                          <p className="text-xs font-medium text-[var(--text-primary)] truncate group-hover:text-white transition-colors">{splitFundName(h.fundName).main}</p>
                          {splitFundName(h.fundName).plan && <p className="text-[10px] text-[var(--text-dim)]">{splitFundName(h.fundName).plan}</p>}
                        </div>
                        <p className="text-[11px] text-[var(--text-dim)] mt-0.5">
                          {h.units > 0 ? `${h.units.toFixed(0)} units · ${formatINR(h.currentValue)}` : 'Planned'}
                        </p>
                      </div>
                      <ChevronDown size={12} className="text-[var(--text-dim)] -rotate-90 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div>
              {portfolioHoldings.length > 0 && (
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-dim)] mb-1.5 flex items-center gap-1">
                  <Search size={10} /> Or search new fund
                </p>
              )}
              <FundSearchInput
                value={null}
                onSelect={selectFund}
                placeholder="Search fund by name or code..."
              />
            </div>
          </div>
        )}
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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <FormField label="Date" required error={errors.date}>
          <FormDateInput value={form.date} onChange={(v) => set('date', v)} />
        </FormField>
        <FormField label="Units" required error={errors.units}>
          <FormInput type="number" value={form.units} onChange={(v) => set('units', v)} placeholder="e.g., 150.50" />
        </FormField>
        <FormField label="NAV (₹)" required error={errors.price}>
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
