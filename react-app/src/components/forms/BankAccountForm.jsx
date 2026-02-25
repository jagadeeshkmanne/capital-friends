import { useState } from 'react'
import { useData } from '../../context/DataContext'
import { FormField, FormInput, FormSelect, FormActions, DeleteButton } from '../Modal'

const ACCOUNT_TYPES = [
  'Savings Account', 'Current Account', 'Fixed Deposit (FD)', 'Recurring Deposit (RD)',
  'NRE Account', 'NRO Account', 'Minor Account',
].map((t) => ({ value: t, label: t }))

export default function BankAccountForm({ initial, onSave, onDelete, onCancel }) {
  const { activeMembers } = useData()
  const isEdit = !!initial
  const [form, setForm] = useState({
    accountName: initial?.accountName || '',
    memberId: initial?.memberId || '',
    bankName: initial?.bankName || '',
    accountNumber: initial?.accountNumber || '',
    ifscCode: initial?.ifscCode || '',
    branchName: initial?.branchName || '',
    accountType: initial?.accountType || '',
    status: initial?.status || 'Active',
  })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  function set(key, val) {
    setForm((f) => ({ ...f, [key]: val }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  function validate() {
    const e = {}
    if (!form.accountName.trim()) e.accountName = 'Required'
    if (!form.memberId) e.memberId = 'Required'
    if (!form.bankName.trim()) e.bankName = 'Required'
    if (!String(form.accountNumber || '').trim()) e.accountNumber = 'Required'
    if (!form.ifscCode.trim()) e.ifscCode = 'Required'
    if (!form.branchName.trim()) e.branchName = 'Required'
    if (!form.accountType) e.accountType = 'Required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit() {
    if (!validate()) return
    setSaving(true)
    try { await onSave({ ...form, ifscCode: form.ifscCode.toUpperCase() }) } finally { setSaving(false) }
  }

  const memberOptions = activeMembers.map((m) => ({ value: m.memberId, label: `${m.memberName} (${m.relationship})` }))

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Account Name" required error={errors.accountName}>
          <FormInput value={form.accountName} onChange={(v) => set('accountName', v)} placeholder="e.g., HDFC Savings" />
        </FormField>
        <FormField label="Family Member" required error={errors.memberId}>
          <FormSelect value={form.memberId} onChange={(v) => set('memberId', v)} options={memberOptions} placeholder="Select member..." />
        </FormField>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Bank Name" required error={errors.bankName}>
          <FormInput value={form.bankName} onChange={(v) => set('bankName', v)} placeholder="e.g., HDFC Bank" />
        </FormField>
        <FormField label="Account Type" required error={errors.accountType}>
          <FormSelect value={form.accountType} onChange={(v) => set('accountType', v)} options={ACCOUNT_TYPES} placeholder="Select type..." />
        </FormField>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Account Number" required error={errors.accountNumber}>
          <FormInput sensitive value={form.accountNumber} onChange={(v) => set('accountNumber', v)} placeholder="e.g., 1234567890" />
        </FormField>
        <FormField label="IFSC Code" required error={errors.ifscCode}>
          <FormInput value={form.ifscCode} onChange={(v) => set('ifscCode', v.toUpperCase())} placeholder="e.g., HDFC0001234" maxLength={11} />
        </FormField>
      </div>

      <FormField label="Branch Name" required error={errors.branchName}>
        <FormInput value={form.branchName} onChange={(v) => set('branchName', v)} placeholder="e.g., Hyderabad - Kondapur" />
      </FormField>

      {isEdit && (
        <FormField label="Status">
          <FormSelect value={form.status} onChange={(v) => set('status', v)} options={[{ value: 'Active', label: 'Active' }, { value: 'Inactive', label: 'Inactive' }]} />
        </FormField>
      )}

      <div className="flex items-center justify-between">
        {isEdit && onDelete ? <DeleteButton onClick={onDelete} /> : <div />}
        <FormActions onCancel={onCancel} onSubmit={handleSubmit} submitLabel={isEdit ? 'Update' : 'Add Account'} loading={saving} />
      </div>
    </div>
  )
}
