import { useState, useMemo } from 'react'
import { useData } from '../../context/DataContext'
import { FormField, FormInput, FormSelect, FormActions, DeleteButton } from '../Modal'

export default function StockPortfolioForm({ initial, onSave, onDelete, onCancel }) {
  const { activeMembers, activeInvestmentAccounts } = useData()
  const isEdit = !!initial

  const [form, setForm] = useState({
    portfolioName: initial?.portfolioName || '',
    ownerId: initial?.ownerId || '',
    investmentAccountId: initial?.investmentAccountId || '',
  })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  function set(key, val) {
    setForm((f) => ({ ...f, [key]: val }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  function setOwner(val) {
    // Reset investment account when owner changes
    setForm((f) => ({ ...f, ownerId: val, investmentAccountId: '' }))
    setErrors((e) => ({ ...e, ownerId: undefined }))
  }

  // Filter demat/trading accounts for the selected owner
  const accountOptions = useMemo(() => {
    if (!form.ownerId) return []
    return activeInvestmentAccounts
      .filter((a) => a.memberId === form.ownerId && (a.accountType === 'Demat + Trading' || a.accountType === 'Trading'))
      .map((a) => ({ value: a.accountId, label: `${a.accountName} - ${a.platformBroker}` }))
  }, [activeInvestmentAccounts, form.ownerId])

  function validate() {
    const e = {}
    if (!form.portfolioName.trim()) e.portfolioName = 'Required'
    if (!form.ownerId) e.ownerId = 'Required'
    if (!form.investmentAccountId) e.investmentAccountId = 'Required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit() {
    if (!validate()) return
    setSaving(true)
    try { await onSave(form) } finally { setSaving(false) }
  }

  const memberOptions = activeMembers.map((m) => ({ value: m.memberId, label: `${m.memberName} (${m.relationship})` }))

  return (
    <div className="space-y-4">
      <FormField label="Portfolio Name" required error={errors.portfolioName}>
        <FormInput value={form.portfolioName} onChange={(v) => set('portfolioName', v)} placeholder="e.g., Long-Term Growth" />
      </FormField>

      <FormField label="Owner" required error={errors.ownerId}>
        <FormSelect value={form.ownerId} onChange={setOwner} options={memberOptions} placeholder="Select family member..." />
      </FormField>

      <FormField label="Investment Account" required error={errors.investmentAccountId}>
        <FormSelect
          value={form.investmentAccountId}
          onChange={(v) => set('investmentAccountId', v)}
          options={accountOptions}
          placeholder={form.ownerId ? (accountOptions.length ? 'Select demat account...' : 'No demat accounts for this member') : 'Select owner first...'}
        />
      </FormField>

      <div className="flex items-center justify-between">
        {isEdit && onDelete ? <DeleteButton onClick={onDelete} /> : <div />}
        <FormActions onCancel={onCancel} onSubmit={handleSubmit} submitLabel={isEdit ? 'Update' : 'Create Portfolio'} loading={saving} />
      </div>
    </div>
  )
}
