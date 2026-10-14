// "Money for goals": one list of every investment with an "Include in goals" switch. No linking per goal —
// the app shares the included money across all goals (utils/goalPool.js) and keeps the goal links updated.
import { useState } from 'react'
import { useData } from '../../context/DataContext'
import { useToast } from '../../context/ToastContext'
import { useMaskText } from '../../hooks/useMaskText'
import { formatINR } from '../../data/familyData'

const L = (v) => formatINR(Math.round(v || 0))
// retirement-only money (EPF, PPF, NPS, VPF, Sukanya) and real estate get their own groups, so it is clear
// they are not shared with the other goals
const GROUPS = [
  { key: 'MF', title: 'Mutual fund portfolios', has: (i) => i.type === 'MF' },
  { key: 'Stock', title: 'Stock portfolios', has: (i) => i.type === 'Stock' },
  { key: 'Other', title: 'Other investments', has: (i) => i.type === 'Other' && i.kind !== 'retirement' && i.kind !== 'property' },
  { key: 'Ret', title: 'For retirement only', has: (i) => i.kind === 'retirement',
    note: 'EPF, PPF, NPS and similar accounts are locked until retirement, so they count only for your Retirement goal. They are never used for other goals and never part of a sell step.' },
  { key: 'Prop', title: 'Real estate', has: (i) => i.kind === 'property',
    note: 'Your home or land is not sold for a goal. Press "I\'m selling it" only when you are really selling: then its value counts as safe money for goals.' },
]

export default function MoneyForGoals({ pool, onSaved }) {
  const mt = useMaskText()
  const { updateSettings, goalList } = useData()
  const { showToast } = useToast()
  const [choice, setChoice] = useState({ sell: [], ...pool.choice })
  const [saving, setSaving] = useState(false)
  const dirty = JSON.stringify(choice) !== JSON.stringify({ sell: [], ...pool.choice })

  const selling = (it) => choice.sell.includes(it.id) || choice.on.includes(it.id)
  const isOn = (it) => (it.kind === 'retirement' ? true : it.kind === 'property' ? selling(it) : it.kind === 'out' ? choice.on.includes(it.id) : !choice.off.includes(it.id))
  // real estate: never for goals, only when you are selling it (its value then counts as safe money)
  const toggleSell = (it) => {
    const on = new Set(choice.on), sell = new Set(choice.sell)
    if (selling(it)) { sell.delete(it.id); on.delete(it.id) } else sell.add(it.id)
    setChoice({ ...choice, on: [...on], sell: [...sell] })
  }
  const toggle = (it) => {
    if (it.kind === 'property') return toggleSell(it)
    const on = new Set(choice.on), off = new Set(choice.off)
    if (it.kind === 'out') { on.has(it.id) ? on.delete(it.id) : on.add(it.id) } else { off.has(it.id) ? off.delete(it.id) : off.add(it.id) }
    setChoice({ ...choice, on: [...on], off: [...off] })
  }
  const save = async () => {
    setSaving(true)
    try { await updateSettings({ GoalsPool: JSON.stringify(choice) }); showToast('Saved. Your goals now use the money you included.'); onSaved?.() }
    catch (e) { showToast(e.message || 'Could not save', 'error') } finally { setSaving(false) }
  }
  const total = pool.items.filter((i) => isOn(i) && i.kind !== 'retirement').reduce((t, i) => t + i.value, 0)
  const retTotal = pool.items.filter((i) => i.kind === 'retirement' && isOn(i)).reduce((t, i) => t + i.value, 0)
  const tag = (it) => (it.kind === 'property' ? (selling(it) ? 'Selling · its value counts as safe money for goals' : 'Real estate · not for goals unless you sell it') : it.kind === 'retirement' ? 'Only for your Retirement goal · never sold' : it.kid ? "Kids' own money · left out by default" : it.kind === 'out' ? 'Left out by default' : /gold|silver|sgb|sovereign/i.test(`${it.otherType || ''} ${it.name || ''}`) ? 'Gold · growth, not safe' : it.eq >= 0.5 ? 'Equity' : 'Safe')
  const goals = (goalList || []).filter((g) => g.isActive !== false)
  const hasRet = goals.some((g) => g.goalType === 'Retirement')

  return (
    <div className="space-y-4 text-sm">
      <p className="text-xs text-[var(--text-muted)]">
        Pick which investments are for your goals. You don't link them to each goal: the app shares this money across all goals —
        the emergency fund and near goals get the safe money, retirement is protected, far goals get the equity.
        Switch off anything that is not for these goals (for example your kids' own portfolio).
      </p>
      {GROUPS.map((gr) => {
        const list = pool.items.filter(gr.has)
        if (!list.length) return null
        return (
          <div key={gr.key} className="space-y-1.5">
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">{gr.title}</p>
            {gr.note && <p className="text-[11px] text-[var(--text-dim)] -mt-0.5">{gr.note}{gr.key === 'Ret' && !hasRet ? ' You have no Retirement goal yet, so they are not used.' : ''}</p>}
            {list.map((it) => (
              <label key={it.id} className="flex items-center gap-3 rounded-lg border border-[var(--border-light)] bg-[var(--bg-inset)] px-3 py-2 cursor-pointer">
                {it.kind === 'retirement'
                  ? <span title="Retirement only" className="w-4 h-4 shrink-0 flex items-center justify-center text-amber-400"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg></span>
                  : <input type="checkbox" checked={isOn(it)} onChange={() => toggle(it)} disabled={it.kind === 'property'} className="w-4 h-4 accent-violet-600 disabled:opacity-40" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{mt(it.name)}{it.owner ? <span className="font-normal text-[var(--text-dim)]"> · {mt(it.owner)}</span> : null}</p>
                  <p className="text-xs text-[var(--text-dim)]">{tag(it)}{it.kind === 'pool' && it.type !== 'Stock' ? ` · ${Math.round(it.eq * 100)}% equity` : ''}</p>
                </div>
                {it.kind === 'property' && (
                  <button type="button" onClick={(e) => { e.preventDefault(); toggleSell(it) }}
                    className={`shrink-0 px-2.5 py-1 text-[11px] font-semibold rounded-md border ${selling(it) ? 'border-amber-500/40 text-amber-400 bg-amber-500/10' : 'border-[var(--border-light)] text-[var(--text-muted)]'}`}>
                    {selling(it) ? 'Not selling' : "I'm selling it"}
                  </button>
                )}
                {it.kind === 'retirement' && <span className="shrink-0 px-2 py-0.5 text-[11px] font-semibold rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/30">Retirement</span>}
                <span className="text-sm font-semibold tabular-nums text-[var(--text-primary)]">{L(it.value)}</span>
              </label>
            ))}
          </div>
        )
      })}
      <div className="rounded-lg border border-violet-500/30 bg-violet-500/5 px-3 py-2 text-xs text-[var(--text-secondary)]">
        <b className="text-violet-400">For goals: {L(total)}</b> shared across {goals.length} goal{goals.length === 1 ? '' : 's'}{retTotal > 0 ? <>, plus <b className="text-amber-400">{L(retTotal)}</b> for retirement only</> : null}.
        {dirty ? ' Press Save to use this.' : ''}
        {retTotal > 0 ? ' When an EPF / PPF / NPS account pays out, press Received on it in Other Investments.' : ''}
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={() => setChoice(pool.choice)} disabled={!dirty || saving} className="px-4 py-2 text-xs rounded-lg border border-[var(--border-light)] text-[var(--text-primary)] disabled:opacity-40">Undo changes</button>
        <button onClick={save} disabled={!dirty || saving} className="px-4 py-2 text-xs font-semibold rounded-lg bg-violet-600 text-white disabled:opacity-40">{saving ? 'Saving…' : 'Save'}</button>
      </div>
    </div>
  )
}
