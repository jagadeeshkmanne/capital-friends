// "Received": an EPF / PPF / NPS (or other locked scheme) paid out. Its value goes to 0 (or down, for a part)
// and the money is added to a Cash / Savings entry, so net worth stays the same and the goals plan sees the cash.
import { useState } from 'react'
import { formatINR } from '../../data/familyData'

export default function ReceivedForm({ inv, cashList, onSave, onCancel }) {
  const cur = Number(inv.currentValue) || 0
  const [amount, setAmount] = useState(String(Math.round(cur)))
  const [dest, setDest] = useState(cashList[0]?.investmentId || 'new')
  const [newName, setNewName] = useState('Savings account')
  const [saving, setSaving] = useState(false)
  const amt = Math.max(0, Number(amount) || 0)
  const partly = amt > 0 && amt < cur - 1
  const submit = async () => {
    if (!(amt > 0)) return
    setSaving(true)
    try { await onSave({ amount: amt, dest, newName: newName.trim() || 'Savings account' }) } finally { setSaving(false) }
  }
  const inputCls = 'w-full px-3 py-2 text-sm rounded-lg bg-[var(--bg-input)] border border-[var(--border-input)] text-[var(--text-primary)]'
  return (
    <div className="space-y-3 text-sm">
      <p className="text-xs text-[var(--text-muted)]">{inv.investmentType} · {inv.investmentName} · now {formatINR(cur)}</p>
      <label className="block space-y-1">
        <span className="text-xs font-semibold text-[var(--text-secondary)]">Amount received</span>
        <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputCls} />
        <span className="text-xs text-[var(--text-dim)]">{partly ? `Part of it: ${formatINR(cur - amt)} stays in ${inv.investmentType}.` : `All of it: ${inv.investmentType} will show 0 and close.`}</span>
      </label>
      <label className="block space-y-1">
        <span className="text-xs font-semibold text-[var(--text-secondary)]">Where did the money go?</span>
        <select value={dest} onChange={(e) => setDest(e.target.value)} className={inputCls}>
          {cashList.map((c) => <option key={c.investmentId} value={c.investmentId}>Add to {c.investmentName} ({formatINR(c.currentValue)})</option>)}
          <option value="new">A new Cash / Savings entry</option>
          <option value="none">Not to cash (e.g. straight into a fund — it shows after the next import)</option>
        </select>
      </label>
      {dest === 'new' && (
        <label className="block space-y-1">
          <span className="text-xs font-semibold text-[var(--text-secondary)]">Name</span>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} className={inputCls} placeholder="e.g. HDFC Savings" />
        </label>
      )}
      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onCancel} className="px-4 py-2 text-xs rounded-lg border border-[var(--border-light)] text-[var(--text-primary)]">Cancel</button>
        <button onClick={submit} disabled={!(amt > 0) || saving} className="px-4 py-2 text-xs font-semibold rounded-lg bg-violet-600 text-white disabled:opacity-40">{saving ? 'Saving…' : 'Mark received'}</button>
      </div>
    </div>
  )
}
