import { useState } from 'react'
import { useData } from '../../context/DataContext'
import { FormField, FormInput, FormSelect, FormActions, DeleteButton } from '../Modal'

export default function MFPortfolioForm({ initial, onSave, onDelete, onCancel }) {
  const { activeMembers, activeInvestmentAccounts } = useData()
  const isEdit = !!initial

  const [form, setForm] = useState({
    portfolioName: initial?.portfolioName || '',
    investmentAccountId: initial?.investmentAccountId || '',
    ownerId: initial?.ownerId || '',
    initialInvestment: initial?.initialInvestment || 0,
    sipTarget: initial?.sipTarget || '',
    lumpsumTarget: initial?.lumpsumTarget || '',
    rebalanceThreshold: initial ? (initial.rebalanceThreshold * 100) : 5,
  })
  const [errors, setErrors] = useState({})

  function set(key, val) {
    setForm((f) => ({ ...f, [key]: val }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  function setOwner(val) {
    setForm((f) => ({ ...f, ownerId: val, investmentAccountId: '' }))
    setErrors((e) => ({ ...e, ownerId: undefined }))
  }

  // MF-type investment accounts for selected member
  const mfAccounts = activeInvestmentAccounts
    .filter((a) => form.ownerId ? a.memberId === form.ownerId : true)
    .filter((a) => a.accountType === 'Mutual Fund' || a.accountType === 'Direct AMC')
    .map((a) => ({ value: a.accountId, label: `${a.accountName} - ${a.platformBroker}` }))

  const memberOptions = activeMembers.map((m) => ({ value: m.memberId, label: `${m.memberName} (${m.relationship})` }))

  function validate() {
    const e = {}
    if (!form.portfolioName.trim()) e.portfolioName = 'Required'
    if (!form.ownerId) e.ownerId = 'Required'
    if (!form.investmentAccountId) e.investmentAccountId = 'Required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit() {
    if (!validate()) return
    onSave({
      ...form,
      initialInvestment: Number(form.initialInvestment) || 0,
      sipTarget: Number(form.sipTarget) || 0,
      lumpsumTarget: Number(form.lumpsumTarget) || 0,
      rebalanceThreshold: Number(form.rebalanceThreshold) / 100,
    })
  }

  return (
    <div className="space-y-4">
      <FormField label="Portfolio Name" required error={errors.portfolioName}>
        <FormInput value={form.portfolioName} onChange={(v) => set('portfolioName', v)} placeholder="e.g., Long Term Wealth" />
      </FormField>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Owner" required error={errors.ownerId}>
          <FormSelect value={form.ownerId} onChange={setOwner} options={memberOptions} placeholder="Select member..." />
        </FormField>
        <FormField label="Investment Account" required error={errors.investmentAccountId}>
          <FormSelect value={form.investmentAccountId} onChange={(v) => set('investmentAccountId', v)} options={mfAccounts} placeholder={form.ownerId ? (mfAccounts.length ? 'Select account...' : 'No MF accounts') : 'Select owner first...'} />
        </FormField>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <FormField label="SIP Target (₹/month)">
          <FormInput type="number" value={form.sipTarget} onChange={(v) => set('sipTarget', v)} placeholder="e.g., 50000" />
        </FormField>
        <FormField label="Lumpsum Target (₹)">
          <FormInput type="number" value={form.lumpsumTarget} onChange={(v) => set('lumpsumTarget', v)} placeholder="e.g., 200000" />
        </FormField>
        <FormField label="Rebalance Threshold (%)">
          <FormInput type="number" value={form.rebalanceThreshold} onChange={(v) => set('rebalanceThreshold', v)} placeholder="e.g., 5" />
        </FormField>
      </div>

      {!isEdit && (
        <FormField label="Initial Investment (₹)" >
          <FormInput type="number" value={form.initialInvestment} onChange={(v) => set('initialInvestment', v)} placeholder="0 if unknown" />
        </FormField>
      )}

      <div className="flex items-center justify-between">
        {isEdit && onDelete ? <DeleteButton onClick={onDelete} /> : <div />}
        <FormActions onCancel={onCancel} onSubmit={handleSubmit} submitLabel={isEdit ? 'Update' : 'Create Portfolio'} />
      </div>
    </div>
  )
}
