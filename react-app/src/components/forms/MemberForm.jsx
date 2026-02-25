import { useState } from 'react'
import { FormField, FormInput, FormSelect, FormCheckbox, FormActions, DeleteButton } from '../Modal'

const RELATIONSHIPS = [
  'Self', 'Spouse', 'Father', 'Mother', 'Son', 'Daughter', 'Brother', 'Sister', 'Other',
].map((r) => ({ value: r, label: r }))

const VALIDATORS = {
  pan: /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/,
  aadhar: /^\d{12}$/,
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  mobile: /^\d{10}$/,
}

export default function MemberForm({ initial, onSave, onDelete, onCancel }) {
  const isEdit = !!initial
  const [form, setForm] = useState({
    memberName: initial?.memberName || '',
    relationship: initial?.relationship || '',
    pan: initial?.pan || '',
    aadhar: initial?.aadhar || '',
    email: initial?.email || '',
    mobile: initial?.mobile || '',
    includeInEmailReports: initial?.includeInEmailReports ?? true,
    status: initial?.status || 'Active',
  })
  const [errors, setErrors] = useState({})

  function set(key, val) {
    setForm((f) => ({ ...f, [key]: val }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  function validate() {
    const e = {}
    if (!form.memberName.trim()) e.memberName = 'Required'
    if (!form.relationship) e.relationship = 'Required'
    if (!VALIDATORS.pan.test(form.pan.toUpperCase())) e.pan = 'Format: ABCDE1234F'
    if (!VALIDATORS.aadhar.test(form.aadhar)) e.aadhar = '12 digits required'
    if (!VALIDATORS.email.test(form.email)) e.email = 'Invalid email'
    if (!VALIDATORS.mobile.test(form.mobile)) e.mobile = '10 digits required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit() {
    if (!validate()) return
    onSave({ ...form, pan: form.pan.toUpperCase() })
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Member Name" required error={errors.memberName}>
          <FormInput value={form.memberName} onChange={(v) => set('memberName', v)} placeholder="e.g., Jagadeesh" />
        </FormField>
        <FormField label="Relationship" required error={errors.relationship}>
          <FormSelect value={form.relationship} onChange={(v) => set('relationship', v)} options={RELATIONSHIPS} placeholder="Select..." />
        </FormField>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="PAN" required error={errors.pan}>
          <FormInput value={form.pan} onChange={(v) => set('pan', v.toUpperCase())} placeholder="ABCDE1234F" maxLength={10} />
        </FormField>
        <FormField label="Aadhar" required error={errors.aadhar}>
          <FormInput value={form.aadhar} onChange={(v) => set('aadhar', v.replace(/\D/g, ''))} placeholder="123456789012" maxLength={12} />
        </FormField>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Email" required error={errors.email}>
          <FormInput type="email" value={form.email} onChange={(v) => set('email', v)} placeholder="email@example.com" />
        </FormField>
        <FormField label="Mobile" required error={errors.mobile}>
          <FormInput value={form.mobile} onChange={(v) => set('mobile', v.replace(/\D/g, ''))} placeholder="9876543210" maxLength={10} />
        </FormField>
      </div>

      <FormCheckbox checked={form.includeInEmailReports} onChange={(v) => set('includeInEmailReports', v)} label="Include in email reports" />

      {isEdit && (
        <FormField label="Status">
          <FormSelect value={form.status} onChange={(v) => set('status', v)} options={[{ value: 'Active', label: 'Active' }, { value: 'Inactive', label: 'Inactive' }]} />
        </FormField>
      )}

      <div className="flex items-center justify-between">
        {isEdit && onDelete ? <DeleteButton onClick={onDelete} /> : <div />}
        <FormActions onCancel={onCancel} onSubmit={handleSubmit} submitLabel={isEdit ? 'Update' : 'Add Member'} />
      </div>
    </div>
  )
}
