import { useState } from 'react'
import { useData } from '../../context/DataContext'
import { formatINR } from '../../data/familyData'
import { FormField, FormInput, FormSelect, FormTextarea, FormActions, DeleteButton } from '../Modal'

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
const CATEGORY_OPTIONS = ['Equity', 'Debt', 'Gold', 'Property', 'Alternative', 'Other'].map((c) => ({ value: c, label: c }))
const STATUS_OPTIONS = [
  { value: 'Active', label: 'Active' },
  { value: 'Sold', label: 'Sold' },
  { value: 'Matured', label: 'Matured' },
  { value: 'Inactive', label: 'Inactive' },
]

export default function OtherInvestmentForm({ initial, onSave, onDelete, onCancel }) {
  const { activeMembers, liabilityList } = useData()
  const isEdit = !!initial

  function getCategory(type) {
    return INVESTMENT_TYPES.find((t) => t.value === type)?.category || 'Other'
  }

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
  const [showQuickLoan, setShowQuickLoan] = useState(false)
  const [quickLoan, setQuickLoan] = useState({
    lenderName: '',
    outstandingBalance: '',
    emiAmount: '',
    interestRate: '',
  })
  const [errors, setErrors] = useState({})

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

  function handleSubmit() {
    if (!validate()) return
    const data = {
      ...form,
      investedAmount: Number(form.investedAmount) || 0,
      currentValue: Number(form.currentValue) || 0,
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
    onSave(data)
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
        <FormActions onCancel={onCancel} onSubmit={handleSubmit} submitLabel={isEdit ? 'Update' : 'Add Investment'} />
      </div>
    </div>
  )
}
