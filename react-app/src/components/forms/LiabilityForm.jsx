import { useState } from 'react'
import { useData } from '../../context/DataContext'
import { formatINR } from '../../data/familyData'
import { FormField, FormInput, FormSelect, FormTextarea, FormActions, DeleteButton } from '../Modal'

const LIABILITY_TYPES = [
  'Home Loan', 'Car Loan', 'Personal Loan', 'Education Loan', 'Gold Loan',
  'Credit Card', 'Business Loan', 'Loan Against Property', 'Other',
].map((t) => ({ value: t, label: t }))

const STATUS_OPTIONS = [
  { value: 'Active', label: 'Active' },
  { value: 'Closed', label: 'Closed' },
  { value: 'Inactive', label: 'Inactive' },
]

export default function LiabilityForm({ initial, onSave, onDelete, onCancel }) {
  const { activeMembers, otherInvList } = useData()
  const isEdit = !!initial
  const [form, setForm] = useState({
    liabilityType: initial?.liabilityType || '',
    lenderName: initial?.lenderName || '',
    familyMemberId: initial?.familyMemberId || '',
    outstandingBalance: initial?.outstandingBalance || '',
    emiAmount: initial?.emiAmount || '',
    interestRate: initial?.interestRate || '',
    linkedInvestmentId: initial?.linkedInvestmentId || '',
    status: initial?.status || 'Active',
    notes: initial?.notes || '',
  })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  function set(key, val) {
    setForm((f) => ({ ...f, [key]: val }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  function validate() {
    const e = {}
    if (!form.liabilityType) e.liabilityType = 'Required'
    if (!form.lenderName.trim()) e.lenderName = 'Required'
    if (!form.outstandingBalance || Number(form.outstandingBalance) <= 0) e.outstandingBalance = 'Must be > 0'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit() {
    if (!validate()) return
    setSaving(true)
    try {
      await onSave({
        ...form,
        outstandingBalance: Number(form.outstandingBalance),
        emiAmount: Number(form.emiAmount) || 0,
        interestRate: Number(form.interestRate) || 0,
        linkedInvestmentId: form.linkedInvestmentId || '',
      })
    } finally { setSaving(false) }
  }

  const memberOptions = activeMembers.map((m) => ({ value: m.memberId, label: `${m.memberName} (${m.relationship})` }))

  const activeInvestments = (otherInvList || []).filter(i => i.status !== 'Inactive')
  const investmentOptions = [
    { value: '', label: 'None' },
    ...activeInvestments.map(i => ({
      value: i.investmentId,
      label: `${i.investmentName} (${i.investmentType} — ${formatINR(i.currentValue)})`,
    })),
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Liability Type" required error={errors.liabilityType}>
          <FormSelect value={form.liabilityType} onChange={(v) => set('liabilityType', v)} options={LIABILITY_TYPES} placeholder="Select type..." />
        </FormField>
        <FormField label="Lender / Bank" required error={errors.lenderName}>
          <FormInput value={form.lenderName} onChange={(v) => set('lenderName', v)} placeholder="e.g., HDFC Bank" />
        </FormField>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Family Member">
          <FormSelect value={form.familyMemberId} onChange={(v) => set('familyMemberId', v)} options={memberOptions} placeholder="Select member (optional)..." />
        </FormField>
        <FormField label="Outstanding Balance (₹)" required error={errors.outstandingBalance}>
          <FormInput type="number" value={form.outstandingBalance} onChange={(v) => set('outstandingBalance', v)} placeholder="e.g., 3500000" />
        </FormField>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="EMI Amount (₹)">
          <FormInput type="number" value={form.emiAmount} onChange={(v) => set('emiAmount', v)} placeholder="e.g., 32000" />
        </FormField>
        <FormField label="Interest Rate (%)">
          <FormInput type="number" value={form.interestRate} onChange={(v) => set('interestRate', v)} placeholder="e.g., 8.5" step="0.01" />
        </FormField>
      </div>

      <FormField label="Linked Investment">
        <FormSelect value={form.linkedInvestmentId} onChange={(v) => set('linkedInvestmentId', v)} options={investmentOptions} placeholder="Link to an investment (optional)..." />
      </FormField>

      {isEdit && (
        <FormField label="Status">
          <FormSelect value={form.status} onChange={(v) => set('status', v)} options={STATUS_OPTIONS} />
        </FormField>
      )}

      <FormField label="Notes">
        <FormTextarea value={form.notes} onChange={(v) => set('notes', v)} placeholder="e.g., Flat in Kondapur" />
      </FormField>

      <div className="flex items-center justify-between">
        {isEdit && onDelete ? <DeleteButton onClick={onDelete} /> : <div />}
        <FormActions onCancel={onCancel} onSubmit={handleSubmit} submitLabel={isEdit ? 'Update' : 'Add Liability'} loading={saving} />
      </div>
    </div>
  )
}
