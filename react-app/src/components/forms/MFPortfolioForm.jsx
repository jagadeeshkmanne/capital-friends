import { useState } from 'react'
import { useData } from '../../context/DataContext'
import { FormField, FormInput, FormSelect } from '../Modal'
import { AlertTriangle } from 'lucide-react'

export default function MFPortfolioForm({ initial, onSave, onDelete, onCancel }) {
  const { activeMembers, activeInvestmentAccounts } = useData()
  const isEdit = !!initial

  const [form, setForm] = useState({
    portfolioName: (initial?.portfolioName || '').replace(/^PFL-/, ''),
    investmentAccountId: initial?.investmentAccountId || '',
    ownerId: initial?.ownerId || '',
    initialInvestment: initial?.initialInvestment || 0,
    sipTarget: initial?.sipTarget || '',
    lumpsumTarget: initial?.lumpsumTarget || '',
    rebalanceThreshold: initial ? (initial.rebalanceThreshold * 100) : 5,
  })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false)

  function set(key, val) {
    setForm((f) => ({ ...f, [key]: val }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  function setOwner(val) {
    setForm((f) => ({ ...f, ownerId: val, investmentAccountId: '' }))
    setErrors((e) => ({ ...e, ownerId: undefined }))
  }

  // Investment accounts for selected member
  const mfAccounts = activeInvestmentAccounts
    .filter((a) => form.ownerId ? a.memberId === form.ownerId : true)
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

  async function handleSubmit() {
    if (!validate()) return
    setSaving(true)
    try {
      // Resolve account name from ID — GAS expects investmentAccount (name), not investmentAccountId
      const selectedAccount = activeInvestmentAccounts.find((a) => a.accountId === form.investmentAccountId)
      const accountLabel = selectedAccount ? `${selectedAccount.accountName} - ${selectedAccount.platformBroker}` : form.investmentAccountId
      await onSave({
        ...form,
        investmentAccount: accountLabel,
        initialInvestment: Number(form.initialInvestment) || 0,
        sipTarget: Number(form.sipTarget) || 0,
        lumpsumTarget: Number(form.lumpsumTarget) || 0,
        rebalanceThreshold: Number(form.rebalanceThreshold),  // Send as percentage — GAS divides by 100
      })
    } finally { setSaving(false) }
  }

  return (
    <div className="space-y-5">
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

      <div className="grid grid-cols-2 gap-4">
        <FormField label="SIP Target (₹/month)">
          <FormInput type="number" value={form.sipTarget} onChange={(v) => set('sipTarget', v)} placeholder="e.g., 50000" />
        </FormField>
        <FormField label="Lumpsum Target (₹)">
          <FormInput type="number" value={form.lumpsumTarget} onChange={(v) => set('lumpsumTarget', v)} placeholder="e.g., 200000" />
        </FormField>
      </div>

      <div className="flex items-end gap-3">
        <div className="w-32">
          <FormField label="Rebalance Threshold (%)">
            <FormInput type="number" value={form.rebalanceThreshold} onChange={(v) => set('rebalanceThreshold', v)} placeholder="5" />
          </FormField>
        </div>
        <p className="text-[10px] text-[var(--text-dim)] pb-2.5 leading-relaxed">Rebalance triggers when allocation drifts beyond this %</p>
      </div>

      {!isEdit && (
        <FormField label="Initial Investment (₹)">
          <FormInput type="number" value={form.initialInvestment} onChange={(v) => set('initialInvestment', v)} placeholder="0 if unknown" />
        </FormField>
      )}

      {isEdit && onDelete && showDeactivateConfirm && (
        <div className="flex items-center gap-3 px-3 py-2.5 bg-rose-500/10 border border-rose-500/20 rounded-lg">
          <AlertTriangle size={15} className="text-rose-400 shrink-0" />
          <p className="text-xs text-rose-300/90 flex-1">This will deactivate the portfolio and hide it from views. Are you sure?</p>
          <div className="flex gap-2 shrink-0">
            <button onClick={() => setShowDeactivateConfirm(false)} className="px-2.5 py-1 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded transition-colors">
              No
            </button>
            <button onClick={onDelete} className="px-2.5 py-1 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded transition-colors">
              Yes, Deactivate
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-4 mt-4 border-t border-[var(--border-light)]">
        {isEdit && onDelete ? (
          <button
            onClick={() => setShowDeactivateConfirm(true)}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-amber-400 border border-amber-500/30 hover:bg-amber-500/15 hover:border-amber-500/50 rounded-lg transition-colors disabled:opacity-40"
          >
            <AlertTriangle size={13} />
            Deactivate
          </button>
        ) : <div />}
        <div className="flex items-center gap-2">
          <button onClick={onCancel} disabled={saving} className="px-4 py-2 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-hover)] transition-colors disabled:opacity-40">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={saving} className="px-5 py-2 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-500 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5">
            {saving && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            {saving ? 'Saving...' : isEdit ? 'Update' : 'Create Portfolio'}
          </button>
        </div>
      </div>
    </div>
  )
}
