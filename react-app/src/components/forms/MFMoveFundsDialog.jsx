import { useMemo, useState } from 'react'
import { useData } from '../../context/DataContext'
import { useToast } from '../../context/ToastContext'
import { useMaskText } from '../../hooks/useMaskText'
import { FormField, FormSelect, FormActions } from '../Modal'
import { maskFolio } from '../../utils/folio'
import * as api from '../../services/api'

// Move imported funds from one portfolio to another (e.g. into a separate "satellite" portfolio). Uses the same backend
// step as the statement import's "Move an imported fund", so later CAS imports keep the fund where you moved it.
// Only funds that came from a statement (they carry a folio) can be moved; manual entries have no folio to follow.
const folios = (txns) => {
  const out = new Set()
  for (const t of txns || []) { const m = /folio\s+([0-9A-Z/ -]+?)(?:\s*·|$)/i.exec(String(t.notes || '')); if (m) out.add(m[1].trim()) }
  return [...out]
}

export default function MFMoveFundsDialog({ portfolioId, onDone, onCancel }) {
  const { mfPortfolios, mfHoldings, mfTransactions, refreshData } = useData()
  const { showToast } = useToast()
  const mt = useMaskText()
  const [picked, setPicked] = useState(new Set())
  const [to, setTo] = useState('')
  const [busy, setBusy] = useState(false)
  const [hint, setHint] = useState('')

  const funds = useMemo(() => (mfHoldings || [])
    .filter((h) => h.portfolioId === portfolioId && Number(h.units) > 0.0005)
    .map((h) => {
      const code = String(h.schemeCode || h.fundCode)
      const fl = folios((mfTransactions || []).filter((t) => t.portfolioId === portfolioId && String(t.fundCode) === code))
      return { code, name: h.fundName, value: Number(h.currentValue) || 0, folios: fl }
    })
    .sort((a, b) => b.value - a.value), [mfHoldings, mfTransactions, portfolioId])

  const from = (mfPortfolios || []).find((p) => p.portfolioId === portfolioId)
  const targets = (mfPortfolios || []).filter((p) => p.portfolioId !== portfolioId && p.status !== 'Inactive')
    .map((p) => ({ value: p.portfolioId, label: mt(String(p.portfolioName || '').replace(/^PFL-/, '')) + (p.ownerId && from?.ownerId && p.ownerId !== from.ownerId && p.ownerName ? ` (${mt(p.ownerName)})` : '') }))

  const toggle = (code) => { setHint(''); setPicked((s) => { const n = new Set(s); n.has(code) ? n.delete(code) : n.add(code); return n }) }

  async function move() {
    if (!picked.size) { setHint('Select the funds to move.'); return }
    if (!to) { setHint('Choose the portfolio to move them to.'); return }
    setBusy(true)
    try {
      let n = 0
      for (const f of funds.filter((x) => picked.has(x.code))) for (const fl of f.folios) { await api.importMoveFund(portfolioId, to, f.code, fl); n++ }
      showToast(`Moved ${picked.size} fund${picked.size > 1 ? 's' : ''}. Future imports will keep them there.`)
      await refreshData(true)
      onDone?.(to)
    } catch (e) { showToast(e.message || 'Could not move', 'error') }
    finally { setBusy(false) }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-[var(--text-muted)]">Tick the funds, choose where they go. Only funds that came from a statement can be moved (they carry a folio); the move follows the folio, so the next import keeps them in the new portfolio.</p>
      <div className="rounded-xl border border-[var(--border-light)] divide-y divide-[var(--border-light)] max-h-72 overflow-y-auto">
        {funds.length === 0 && <p className="px-3 py-4 text-sm text-[var(--text-dim)] text-center">No funds in this portfolio.</p>}
        {funds.map((f) => { const can = f.folios.length > 0, on = picked.has(f.code); return (
          <label key={f.code} className={`flex items-center gap-3 px-3 py-2.5 ${can ? 'cursor-pointer hover:bg-[var(--bg-hover)]' : 'opacity-50'}`}>
            <input type="checkbox" disabled={!can} checked={on} onChange={() => toggle(f.code)} className="w-4 h-4 rounded border-[var(--border-input)] bg-[var(--bg-input)] text-violet-500 focus:ring-violet-500" />
            <span className="flex-1 min-w-0">
              <span className="block text-sm text-[var(--text-primary)] truncate">{mt(f.name)}</span>
              <span className="block text-xs text-[var(--text-dim)]">{can ? `Folio ${f.folios.map(maskFolio).join(', ')}` : 'Manual entry — cannot be moved yet'}</span>
            </span>
            <span className="text-xs tabular-nums text-[var(--text-muted)]">₹{Math.round(f.value).toLocaleString('en-IN')}</span>
          </label>) })}
      </div>
      <FormField label="Move to portfolio" required>
        <FormSelect value={to} onChange={(v) => { setTo(v); setHint('') }} options={targets} placeholder="— choose —" />
      </FormField>
      {hint && <p className="text-xs font-semibold text-amber-400">{hint}</p>}
      <FormActions onCancel={onCancel} onSubmit={move} loading={busy} submitLabel={picked.size ? `Move ${picked.size} fund${picked.size > 1 ? 's' : ''}` : 'Move'} />
    </div>
  )
}
