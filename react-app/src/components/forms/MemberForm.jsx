import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
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
  const [saving, setSaving] = useState(false)

  // Dynamic fields (custom key-value pairs stored as JSON in GAS column L)
  const [dynamicFields, setDynamicFields] = useState(() => {
    const fields = initial?.dynamicFields || {}
    return Object.entries(fields).map(([key, value]) => ({ key, value }))
  })

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

  // Dynamic fields helpers
  function addField() {
    setDynamicFields((f) => [...f, { key: '', value: '' }])
  }

  function updateField(idx, field, val) {
    setDynamicFields((f) => f.map((item, i) => i === idx ? { ...item, [field]: val } : item))
  }

  function removeField(idx) {
    setDynamicFields((f) => f.filter((_, i) => i !== idx))
  }

  async function handleSubmit() {
    if (!validate()) return
    // Build dynamic fields object (skip empty keys)
    const dfObj = {}
    dynamicFields.forEach(({ key, value }) => {
      const k = key.trim()
      if (k) dfObj[k] = value
    })
    setSaving(true)
    try {
      await onSave({ ...form, pan: form.pan.toUpperCase(), dynamicFields: dfObj })
    } finally {
      setSaving(false)
    }
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
          <FormInput sensitive value={form.pan} onChange={(v) => set('pan', v.toUpperCase())} placeholder="ABCDE1234F" maxLength={10} />
        </FormField>
        <FormField label="Aadhar" required error={errors.aadhar}>
          <FormInput sensitive value={form.aadhar} onChange={(v) => set('aadhar', v.replace(/\D/g, ''))} placeholder="123456789012" maxLength={12} />
        </FormField>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Email" required error={errors.email}>
          <FormInput sensitive type="email" value={form.email} onChange={(v) => set('email', v)} placeholder="email@example.com" />
        </FormField>
        <FormField label="Mobile" required error={errors.mobile}>
          <FormInput sensitive value={form.mobile} onChange={(v) => set('mobile', v.replace(/\D/g, ''))} placeholder="9876543210" maxLength={10} />
        </FormField>
      </div>

      <FormCheckbox checked={form.includeInEmailReports} onChange={(v) => set('includeInEmailReports', v)} label="Include in email reports" />

      {isEdit && (
        <FormField label="Status">
          <FormSelect value={form.status} onChange={(v) => set('status', v)} options={[{ value: 'Active', label: 'Active' }, { value: 'Inactive', label: 'Inactive' }]} />
        </FormField>
      )}

      {/* Dynamic Fields */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-[var(--text-muted)]">Custom Fields</p>
          <button onClick={addField} type="button" className="flex items-center gap-1 text-xs font-semibold text-violet-400 hover:text-violet-300 transition-colors">
            <Plus size={12} /> Add Field
          </button>
        </div>
        {dynamicFields.length === 0 && (
          <p className="text-xs text-[var(--text-dim)]">No custom fields. Add DOB, occupation, blood group, etc.</p>
        )}
        <div className="space-y-2">
          {dynamicFields.map((f, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                value={f.key}
                onChange={(e) => updateField(idx, 'key', e.target.value)}
                placeholder="Field name"
                className="flex-1 px-2.5 py-1.5 text-xs bg-[var(--bg-input)] border border-[var(--border-input)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--sidebar-active-text)] transition-colors"
              />
              <input
                value={f.value}
                onChange={(e) => updateField(idx, 'value', e.target.value)}
                placeholder="Value"
                className="flex-1 px-2.5 py-1.5 text-xs bg-[var(--bg-input)] border border-[var(--border-input)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--sidebar-active-text)] transition-colors"
              />
              <button onClick={() => removeField(idx)} type="button" className="p-1 text-[var(--text-dim)] hover:text-rose-400 transition-colors">
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        {isEdit && onDelete ? <DeleteButton onClick={onDelete} /> : <div />}
        <FormActions onCancel={onCancel} onSubmit={handleSubmit} submitLabel={isEdit ? 'Update' : 'Add Member'} loading={saving} />
      </div>
    </div>
  )
}
