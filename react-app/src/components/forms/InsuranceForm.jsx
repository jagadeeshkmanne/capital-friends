import { useState } from 'react'
import { useData } from '../../context/DataContext'
import { FormField, FormInput, FormSelect, FormTextarea, FormActions, DeleteButton } from '../Modal'

const POLICY_TYPES = [
  'Term Life', 'Health', 'Motor', 'Home Insurance', 'Travel', 'Personal Accident', 'Life Insurance', 'Others',
].map((t) => ({ value: t, label: t }))

const STATUS_OPTIONS = [
  { value: 'Active', label: 'Active' },
  { value: 'Expired', label: 'Expired' },
  { value: 'Surrendered', label: 'Surrendered' },
  { value: 'Lapsed', label: 'Lapsed' },
  { value: 'Inactive', label: 'Inactive' },
]

export default function InsuranceForm({ initial, onSave, onDelete, onCancel }) {
  const { activeMembers } = useData()
  const isEdit = !!initial
  const [form, setForm] = useState({
    policyType: initial?.policyType || '',
    company: initial?.company || '',
    policyNumber: initial?.policyNumber || '',
    policyName: initial?.policyName || '',
    insuredMember: initial?.insuredMember || '',
    memberId: initial?.memberId || '',
    sumAssured: initial?.sumAssured || '',
    nominee: initial?.nominee || '',
    premium: initial?.premium || '',
    premiumFrequency: initial?.premiumFrequency || 'Annual',
    status: initial?.status || 'Active',
    notes: initial?.notes || '',
  })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  function set(key, val) {
    setForm((f) => ({ ...f, [key]: val }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  function setMember(memberId) {
    const m = activeMembers.find((x) => x.memberId === memberId)
    setForm((f) => ({ ...f, memberId, insuredMember: m?.memberName || '' }))
    setErrors((e) => ({ ...e, memberId: undefined }))
  }

  function validate() {
    const e = {}
    if (!form.policyType) e.policyType = 'Required'
    if (!form.company.trim()) e.company = 'Required'
    if (!form.policyNumber.trim()) e.policyNumber = 'Required'
    if (!form.policyName.trim()) e.policyName = 'Required'
    if (!form.memberId) e.memberId = 'Required'
    if (!form.sumAssured || Number(form.sumAssured) <= 0) e.sumAssured = 'Must be > 0'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit() {
    if (!validate()) return
    setSaving(true)
    try { await onSave({ ...form, sumAssured: Number(form.sumAssured), premium: Number(form.premium) || 0 }) } finally { setSaving(false) }
  }

  const memberOptions = activeMembers.map((m) => ({ value: m.memberId, label: `${m.memberName} (${m.relationship})` }))

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Policy Type" required error={errors.policyType}>
          <FormSelect value={form.policyType} onChange={(v) => set('policyType', v)} options={POLICY_TYPES} placeholder="Select type..." />
        </FormField>
        <FormField label="Insurance Company" required error={errors.company}>
          <FormInput value={form.company} onChange={(v) => set('company', v)} placeholder="e.g., HDFC Life" />
        </FormField>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Policy Number" required error={errors.policyNumber}>
          <FormInput sensitive value={form.policyNumber} onChange={(v) => set('policyNumber', v)} placeholder="e.g., HL-2024-78901" />
        </FormField>
        <FormField label="Policy Name" required error={errors.policyName}>
          <FormInput value={form.policyName} onChange={(v) => set('policyName', v)} placeholder="e.g., Click 2 Protect Life" />
        </FormField>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Insured Member" required error={errors.memberId}>
          <FormSelect value={form.memberId} onChange={setMember} options={memberOptions} placeholder="Select member..." />
        </FormField>
        <FormField label="Nominee">
          <FormSelect value={form.nominee} onChange={(v) => set('nominee', v)} options={memberOptions.map((o) => ({ ...o, label: o.label.split(' (')[0] }))} placeholder="Select nominee (optional)..." />
        </FormField>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <FormField label="Sum Assured (₹)" required error={errors.sumAssured}>
          <FormInput type="number" value={form.sumAssured} onChange={(v) => set('sumAssured', v)} placeholder="e.g., 10000000" />
        </FormField>
        <FormField label="Premium (₹)">
          <FormInput type="number" value={form.premium} onChange={(v) => set('premium', v)} placeholder="e.g., 12500" />
        </FormField>
        <FormField label="Premium Frequency">
          <FormSelect value={form.premiumFrequency} onChange={(v) => set('premiumFrequency', v)} options={[{ value: 'Annual', label: 'Annual' }, { value: 'Monthly', label: 'Monthly' }, { value: 'Quarterly', label: 'Quarterly' }]} />
        </FormField>
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
        <FormActions onCancel={onCancel} onSubmit={handleSubmit} submitLabel={isEdit ? 'Update' : 'Add Policy'} loading={saving} />
      </div>
    </div>
  )
}
