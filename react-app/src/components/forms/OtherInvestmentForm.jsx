import { useState, useEffect } from 'react'
import { useData } from '../../context/DataContext'
import { formatINR } from '../../data/familyData'
import { FormField, FormInput, FormSelect, FormTextarea, FormActions, DeleteButton } from '../Modal'

const MARKET_CACHE_KEY = 'cf_market_data'

const INVESTMENT_TYPES = [
  { value: 'Fixed Deposit', category: 'Debt' },
  { value: 'PPF', category: 'Debt' },
  { value: 'EPF', category: 'Debt' },
  { value: 'NPS', category: 'Debt' },
  { value: 'Sovereign Gold Bond', category: 'Gold' },
  { value: 'Physical Gold', category: 'Gold' },
  { value: 'Digital Gold', category: 'Gold' },
  { value: 'Real Estate', category: 'Property' },
  { value: 'Bonds', category: 'Debt' },
  { value: 'Physical Silver', category: 'Silver' },
  { value: 'Digital Silver', category: 'Silver' },
  { value: 'Crypto', category: 'Alternative' },
  { value: 'Other', category: 'Other' },
]

const LOAN_SUGGESTIONS = {
  'Real Estate': 'Home Loan',
  'Physical Gold': 'Gold Loan',
  'Sovereign Gold Bond': 'Gold Loan',
  'Fixed Deposit': 'Loan Against FD',
}

const TYPE_OPTIONS = INVESTMENT_TYPES.map((t) => ({ value: t.value, label: t.value }))
const CATEGORY_OPTIONS = ['Equity', 'Debt', 'Gold', 'Silver', 'Property', 'Alternative', 'Other'].map((c) => ({ value: c, label: c }))
const STATUS_OPTIONS = [
  { value: 'Active', label: 'Active' },
  { value: 'Sold', label: 'Sold' },
  { value: 'Matured', label: 'Matured' },
  { value: 'Inactive', label: 'Inactive' },
]

// Gold/Silver purity factors
const GOLD_PURITY = [
  { value: '24K', label: '24K (99.9%)', factor: 0.999 },
  { value: '22K', label: '22K (91.6%)', factor: 0.916 },
  { value: '18K', label: '18K (75.0%)', factor: 0.750 },
]
const SILVER_PURITY = [
  { value: '999', label: '999 Fine (99.9%)', factor: 0.999 },
  { value: '925', label: '925 Sterling (92.5%)', factor: 0.925 },
]

function isGoldType(type) {
  return ['Physical Gold', 'Digital Gold', 'Sovereign Gold Bond'].includes(type)
}
function isSilverType(type) {
  return ['Physical Silver', 'Digital Silver'].includes(type) || (type && type.toLowerCase().includes('silver'))
}
function isMetalType(type) {
  return isGoldType(type) || isSilverType(type)
}

function getMarketMetalPrice(metalType) {
  try {
    const cached = sessionStorage.getItem(MARKET_CACHE_KEY)
    if (!cached) return null
    const data = JSON.parse(cached)
    if (!data.metals) return null
    const name = metalType === 'gold' ? 'Gold' : 'Silver'
    const metal = data.metals.find((m) => m.name.toLowerCase().includes(name.toLowerCase()))
    return metal ? metal.price : null
  } catch { return null }
}

export default function OtherInvestmentForm({ initial, onSave, onDelete, onCancel }) {
  const { activeMembers, liabilityList } = useData()
  const isEdit = !!initial

  function getCategory(type) {
    return INVESTMENT_TYPES.find((t) => t.value === type)?.category || 'Other'
  }

  // Parse dynamic fields from initial data
  const initDynamic = initial?.dynamicFields ? (typeof initial.dynamicFields === 'string' ? JSON.parse(initial.dynamicFields) : initial.dynamicFields) : {}

  const [form, setForm] = useState({
    investmentType: initial?.investmentType || '',
    investmentCategory: initial?.investmentCategory || '',
    investmentName: initial?.investmentName || '',
    familyMemberId: initial?.familyMemberId || '',
    investedAmount: initial?.investedAmount || '',
    currentValue: initial?.currentValue || '',
    linkedLiabilityId: initial?.linkedLiabilityId || '',
    status: initial?.status || 'Active',
    notes: initial?.notes || '',
  })

  // Metal-specific fields
  const [weightGrams, setWeightGrams] = useState(initDynamic.weightGrams || '')
  const [purity, setPurity] = useState(initDynamic.purity || '')
  const [calculatedValue, setCalculatedValue] = useState(null)
  const [showQuickLoan, setShowQuickLoan] = useState(false)
  const [quickLoan, setQuickLoan] = useState({
    lenderName: '',
    outstandingBalance: '',
    emiAmount: '',
    interestRate: '',
  })
  // Auto-calculate metal value from weight × purity × market rate
  useEffect(() => {
    if (!isMetalType(form.investmentType) || !weightGrams || Number(weightGrams) <= 0) {
      setCalculatedValue(null)
      return
    }
    const metalType = isGoldType(form.investmentType) ? 'gold' : 'silver'
    const marketRate = getMarketMetalPrice(metalType)
    if (!marketRate) { setCalculatedValue(null); return }

    const purities = metalType === 'gold' ? GOLD_PURITY : SILVER_PURITY
    const purityEntry = purities.find((p) => p.value === purity)
    const factor = purityEntry ? purityEntry.factor : 1

    setCalculatedValue(Math.round(Number(weightGrams) * marketRate * factor))
  }, [form.investmentType, weightGrams, purity])

  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  function set(key, val) {
    setForm((f) => ({ ...f, [key]: val }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  function setType(val) {
    setForm((f) => ({ ...f, investmentType: val, investmentCategory: getCategory(val) }))
    setErrors((e) => ({ ...e, investmentType: undefined }))
  }

  function setQL(key, val) {
    setQuickLoan((f) => ({ ...f, [key]: val }))
  }

  function validate() {
    const e = {}
    if (!form.investmentType) e.investmentType = 'Required'
    if (!form.investmentName.trim()) e.investmentName = 'Required'
    if (!form.currentValue || Number(form.currentValue) < 0) e.currentValue = 'Required'
    if (showQuickLoan) {
      if (!quickLoan.lenderName.trim()) e.qlLender = 'Required'
      if (!quickLoan.outstandingBalance || Number(quickLoan.outstandingBalance) <= 0) e.qlOutstanding = 'Must be > 0'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit() {
    if (!validate()) return
    const data = {
      ...form,
      investedAmount: Number(form.investedAmount) || 0,
      currentValue: Number(form.currentValue) || 0,
    }
    // Include metal dynamic fields if applicable
    if (isMetalType(form.investmentType)) {
      data.dynamicFields = JSON.stringify({
        weightGrams: Number(weightGrams) || 0,
        purity: purity || '',
      })
    }
    if (showQuickLoan && quickLoan.lenderName) {
      data.quickLoan = {
        liabilityType: LOAN_SUGGESTIONS[form.investmentType] || 'Personal Loan',
        lenderName: quickLoan.lenderName,
        outstandingBalance: Number(quickLoan.outstandingBalance) || 0,
        emiAmount: Number(quickLoan.emiAmount) || 0,
        interestRate: Number(quickLoan.interestRate) || 0,
      }
    }
    setSaving(true)
    try { await onSave(data) } finally { setSaving(false) }
  }

  // Liability options for linking
  const activeLiabilities = liabilityList.filter((l) => l.status !== 'Inactive')
  const liabilityOptions = [
    { value: '', label: 'None' },
    ...activeLiabilities.map((l) => ({
      value: l.liabilityId,
      label: `${l.liabilityType} — ${l.lenderName} (${formatINR(l.outstandingBalance)})`,
    })),
  ]

  const memberOptions = activeMembers.map((m) => ({ value: m.memberId, label: `${m.memberName} (${m.relationship})` }))

  const suggestedLoanType = LOAN_SUGGESTIONS[form.investmentType]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Investment Type" required error={errors.investmentType}>
          <FormSelect value={form.investmentType} onChange={setType} options={TYPE_OPTIONS} placeholder="Select type..." />
        </FormField>
        <FormField label="Category">
          <FormSelect value={form.investmentCategory} onChange={(v) => set('investmentCategory', v)} options={CATEGORY_OPTIONS} placeholder="Auto-selected..." />
        </FormField>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Investment Name" required error={errors.investmentName}>
          <FormInput value={form.investmentName} onChange={(v) => set('investmentName', v)} placeholder="e.g., HDFC FD - 7.5%" />
        </FormField>
        <FormField label="Family Member">
          <FormSelect value={form.familyMemberId} onChange={(v) => set('familyMemberId', v)} options={memberOptions} placeholder="Select member (optional)..." />
        </FormField>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Invested Amount">
          <FormInput type="number" value={form.investedAmount} onChange={(v) => set('investedAmount', v)} placeholder="e.g., 500000" />
        </FormField>
        <FormField label="Current Value" required error={errors.currentValue}>
          <FormInput type="number" value={form.currentValue} onChange={(v) => set('currentValue', v)} placeholder="e.g., 537500" />
        </FormField>
      </div>

      {/* Metal Weight & Purity fields */}
      {isMetalType(form.investmentType) && (
        <div className="p-3 bg-[var(--bg-inset)] rounded-lg space-y-3">
          <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
            {isGoldType(form.investmentType) ? 'Gold' : 'Silver'} Details
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="Weight (grams)">
              <FormInput type="number" value={weightGrams} onChange={setWeightGrams} placeholder="e.g., 50" />
            </FormField>
            <FormField label="Purity">
              <FormSelect
                value={purity}
                onChange={setPurity}
                options={(isGoldType(form.investmentType) ? GOLD_PURITY : SILVER_PURITY).map((p) => ({ value: p.value, label: p.label }))}
                placeholder="Select purity..."
              />
            </FormField>
          </div>
          {calculatedValue !== null && (
            <div className="flex items-center justify-between bg-[var(--bg-card)] rounded-lg px-3 py-2 border border-[var(--border)]">
              <div>
                <p className="text-xs text-[var(--text-dim)]">Estimated market value</p>
                <p className="text-sm font-bold text-emerald-400 tabular-nums">{formatINR(calculatedValue)}</p>
              </div>
              <button
                type="button"
                onClick={() => set('currentValue', String(calculatedValue))}
                className="text-xs font-semibold text-violet-400 hover:text-violet-300 px-3 py-1.5 rounded-lg bg-violet-500/10 border border-violet-500/20 transition-colors"
              >
                Use this value
              </button>
            </div>
          )}
        </div>
      )}

      {/* Linked Liability */}
      <div className="border-t border-[var(--border-light)] pt-4">
        <FormField label="Linked Loan / Liability">
          <FormSelect value={form.linkedLiabilityId} onChange={(v) => { set('linkedLiabilityId', v); if (v) setShowQuickLoan(false) }} options={liabilityOptions} />
        </FormField>

        {!form.linkedLiabilityId && !isEdit && (
          <div className="mt-2">
            <button
              type="button"
              onClick={() => setShowQuickLoan(!showQuickLoan)}
              className="text-xs font-semibold text-violet-400 hover:text-violet-300 transition-colors"
            >
              {showQuickLoan ? '— Cancel quick loan' : `+ Create new loan${suggestedLoanType ? ` (${suggestedLoanType})` : ''}`}
            </button>
          </div>
        )}

        {showQuickLoan && (
          <div className="mt-3 p-3 bg-[var(--bg-inset)] rounded-lg space-y-3">
            <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Quick Loan</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Lender" required error={errors.qlLender}>
                <FormInput value={quickLoan.lenderName} onChange={(v) => setQL('lenderName', v)} placeholder="e.g., HDFC Bank" />
              </FormField>
              <FormField label="Outstanding Balance" required error={errors.qlOutstanding}>
                <FormInput type="number" value={quickLoan.outstandingBalance} onChange={(v) => setQL('outstandingBalance', v)} placeholder="e.g., 3500000" />
              </FormField>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="EMI (monthly)">
                <FormInput type="number" value={quickLoan.emiAmount} onChange={(v) => setQL('emiAmount', v)} placeholder="e.g., 32000" />
              </FormField>
              <FormField label="Interest Rate %">
                <FormInput type="number" value={quickLoan.interestRate} onChange={(v) => setQL('interestRate', v)} placeholder="e.g., 8.5" />
              </FormField>
            </div>
          </div>
        )}
      </div>

      {isEdit && (
        <FormField label="Status">
          <FormSelect value={form.status} onChange={(v) => set('status', v)} options={STATUS_OPTIONS} />
        </FormField>
      )}

      <FormField label="Notes">
        <FormTextarea value={form.notes} onChange={(v) => set('notes', v)} placeholder="Additional information..." />
      </FormField>

      <div className="flex items-center justify-between">
        {isEdit && onDelete ? <DeleteButton onClick={onDelete} /> : <div />}
        <FormActions onCancel={onCancel} onSubmit={handleSubmit} submitLabel={isEdit ? 'Update' : 'Add Investment'} loading={saving} />
      </div>
    </div>
  )
}
