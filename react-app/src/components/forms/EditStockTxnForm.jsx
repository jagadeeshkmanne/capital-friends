import { useState } from 'react'
import { FormField, FormInput, FormDateInput, FormActions } from '../Modal'

// dd/MM/yyyy (what the backend list sends) or yyyy-MM-dd -> yyyy-MM-dd
function toIsoDate(v) {
  if (!v) return ''
  const s = String(v).trim()
  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const d = new Date(s)
  return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10)
}

export default function EditStockTxnForm({ txn, onSave, onCancel }) {
  const [form, setForm] = useState({
    date: toIsoDate(txn?.date),
    quantity: txn?.quantity != null ? String(txn.quantity) : '',
    pricePerShare: txn?.pricePerShare != null ? String(txn.pricePerShare) : '',
    brokerage: txn?.brokerage != null ? String(txn.brokerage) : '0',
    notes: txn?.notes || '',
  })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  function set(key, val) {
    setForm((f) => ({ ...f, [key]: val }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  async function handleSubmit() {
    const e = {}
    if (!form.date) e.date = 'Required'
    if (!(Number(form.quantity) > 0)) e.quantity = 'Must be more than 0'
    if (!(Number(form.pricePerShare) > 0)) e.pricePerShare = 'Must be more than 0'
    setErrors(e)
    if (Object.keys(e).length) return
    setSaving(true)
    try {
      await onSave({
        transactionId: txn.transactionId,
        date: form.date,
        quantity: Number(form.quantity),
        pricePerShare: Number(form.pricePerShare),
        brokerage: Number(form.brokerage) || 0,
        notes: form.notes,
      })
    } finally { setSaving(false) }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-[var(--text-muted)]">
        {txn?.type ? `${txn.type} · ` : ''}{txn?.symbol || ''}{txn?.companyName ? ` · ${txn.companyName}` : ''}
      </p>
      <FormField label="Date" required error={errors.date}>
        <FormDateInput value={form.date} onChange={(v) => set('date', v)} />
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Quantity" required error={errors.quantity}>
          <FormInput type="number" value={form.quantity} onChange={(v) => set('quantity', v)} />
        </FormField>
        <FormField label="Price per share" required error={errors.pricePerShare}>
          <FormInput type="number" value={form.pricePerShare} onChange={(v) => set('pricePerShare', v)} />
        </FormField>
      </div>
      <FormField label="Brokerage">
        <FormInput type="number" value={form.brokerage} onChange={(v) => set('brokerage', v)} />
      </FormField>
      <FormField label="Notes">
        <FormInput value={form.notes} onChange={(v) => set('notes', v)} />
      </FormField>
      <FormActions onCancel={onCancel} onSubmit={handleSubmit} submitLabel="Update Transaction" loading={saving} />
    </div>
  )
}
