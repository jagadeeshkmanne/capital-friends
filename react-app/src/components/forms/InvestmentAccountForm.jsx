import { useState, useMemo } from 'react'
import { useData } from '../../context/DataContext'
import { FormField, FormInput, FormSelect, FormActions, DeleteButton } from '../Modal'

const ACCOUNT_TYPES = [
  'Demat + Trading', 'Mutual Fund', 'Trading', 'Direct AMC', 'Broker',
].map((t) => ({ value: t, label: t }))

export default function InvestmentAccountForm({ initial, onSave, onDelete, onCancel }) {
  const { activeMembers, activeBanks } = useData()
  const isEdit = !!initial
  const [form, setForm] = useState({
    accountName: initial?.accountName || '',
    memberId: initial?.memberId || '',
    bankAccountId: initial?.bankAccountId || '',
    accountType: initial?.accountType || '',
    platformBroker: initial?.platformBroker || '',
    accountClientId: initial?.accountClientId || '',
    dematDpId: initial?.dematDpId || '',
    registeredEmail: initial?.registeredEmail || '',
    registeredPhone: initial?.registeredPhone || '',
    status: initial?.status || 'Active',
  })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  function set(key, val) {
    setForm((f) => ({ ...f, [key]: val }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  function setMember(val) {
    // Reset bank account when member changes
    setForm((f) => ({ ...f, memberId: val, bankAccountId: '' }))
    setErrors((e) => ({ ...e, memberId: undefined }))
  }

  function validate() {
    const e = {}
    if (!form.accountName.trim()) e.accountName = 'Required'
    if (!form.memberId) e.memberId = 'Required'
    if (!form.bankAccountId) e.bankAccountId = 'Required'
    if (!form.accountType) e.accountType = 'Required'
    if (!form.platformBroker.trim()) e.platformBroker = 'Required'
    // Client ID is optional (e.g., broker accounts may not have one)
    if (!form.registeredEmail.trim()) e.registeredEmail = 'Required'
    if (!form.registeredPhone.trim()) e.registeredPhone = 'Required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit() {
    if (!validate()) return
    setSaving(true)
    try { await onSave(form) } finally { setSaving(false) }
  }

  const memberOptions = activeMembers.map((m) => ({ value: m.memberId, label: `${m.memberName} (${m.relationship})` }))
  const memberBanks = useMemo(() => {
    if (!form.memberId) return []
    return activeBanks
      .filter((b) => b.memberId === form.memberId)
      .map((b) => ({ value: b.accountId, label: `${b.accountName} - ${b.bankName}` }))
  }, [activeBanks, form.memberId])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Account Name" required error={errors.accountName}>
          <FormInput value={form.accountName} onChange={(v) => set('accountName', v)} placeholder="e.g., Zerodha Demat" />
        </FormField>
        <FormField label="Family Member" required error={errors.memberId}>
          <FormSelect value={form.memberId} onChange={setMember} options={memberOptions} placeholder="Select member..." />
        </FormField>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Linked Bank Account" required error={errors.bankAccountId}>
          <FormSelect value={form.bankAccountId} onChange={(v) => set('bankAccountId', v)} options={memberBanks} placeholder={form.memberId ? (memberBanks.length ? 'Select bank account...' : 'No bank accounts for this member') : 'Select member first...'} />
        </FormField>
        <FormField label="Account Type" required error={errors.accountType}>
          <FormSelect value={form.accountType} onChange={(v) => set('accountType', v)} options={ACCOUNT_TYPES} placeholder="Select type..." />
        </FormField>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Platform / Broker" required error={errors.platformBroker}>
          <FormInput value={form.platformBroker} onChange={(v) => set('platformBroker', v)} placeholder="e.g., Zerodha, Groww" />
        </FormField>
        <FormField label="Account / Client ID" error={errors.accountClientId}>
          <FormInput sensitive value={form.accountClientId} onChange={(v) => set('accountClientId', v)} placeholder="e.g., ZR1234 (optional)" />
        </FormField>
      </div>

      <FormField label="Demat DP ID" error={errors.dematDpId}>
        <FormInput sensitive value={form.dematDpId} onChange={(v) => set('dematDpId', v)} placeholder="16-digit DP ID (optional)" maxLength={16} />
      </FormField>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Registered Email" required error={errors.registeredEmail}>
          <FormInput sensitive type="email" value={form.registeredEmail} onChange={(v) => set('registeredEmail', v)} placeholder="email@example.com" />
        </FormField>
        <FormField label="Registered Phone" required error={errors.registeredPhone}>
          <FormInput sensitive value={form.registeredPhone} onChange={(v) => set('registeredPhone', v)} placeholder="9876543210" />
        </FormField>
      </div>

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
