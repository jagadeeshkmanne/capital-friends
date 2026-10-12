// "Money for goals": one list of every investment with an "Include in goals" switch. No linking per goal —
// the app shares the included money across all goals (utils/goalPool.js) and keeps the goal links updated.
import { useState } from 'react'
import { useData } from '../../context/DataContext'
import { useToast } from '../../context/ToastContext'
import { useMaskText } from '../../hooks/useMaskText'
import { formatINR } from '../../data/familyData'

const L = (v) => formatINR(Math.round(v || 0))
const GROUPS = [
  { key: 'MF', title: 'Mutual fund portfolios' },
  { key: 'Stock', title: 'Stock portfolios' },
  { key: 'Other', title: 'Other investments' },
]

export default function MoneyForGoals({ pool }) {
  const mt = useMaskText()
  const { updateSettings, goalList } = useData()
  const { showToast } = useToast()
  const [choice, setChoice] = useState(pool.choice)
  const [saving, setSaving] = useState(false)
  const dirty = JSON.stringify(choice) !== JSON.stringify(pool.choice)

  const isOn = (it) => (it.kind === 'out' ? choice.on.includes(it.id) : !choice.off.includes(it.id))
  const toggle = (it) => {
    const on = new Set(choice.on), off = new Set(choice.off)
    if (it.kind === 'out') { on.has(it.id) ? on.delete(it.id) : on.add(it.id) } else { off.has(it.id) ? off.delete(it.id) : off.add(it.id) }
    setChoice({ on: [...on], off: [...off] })
  }
  const save = async () => {
    setSaving(true)
    try { await updateSettings({ GoalsPool: JSON.stringify(choice) }); showToast('Saved. Your goals now use the money you included.') }
    catch (e) { showToast(e.message || 'Could not save', 'error') } finally { setSaving(false) }
  }
  const total = pool.items.filter(isOn).reduce((t, i) => t + i.value, 0)
  const tag = (it) => (it.kind === 'retirement' ? 'Retirement only · never sold' : it.kid ? "Kids' own money · left out by default" : it.kind === 'out' ? 'Left out by default' : it.eq >= 0.5 ? 'Equity' : 'Safe')
  const goals = (goalList || []).filter((g) => g.isActive !== false)

  return (
    <div className="space-y-4 text-sm">
      <p className="text-xs text-[var(--text-muted)]">
        Pick which investments are for your goals. You don't link them to each goal: the app shares this money across all goals —
        the emergency fund and near goals get the safe money, retirement is protected, far goals get the equity.
        Switch off anything that is not for these goals (for example your kids' own portfolio).
      </p>
      {GROUPS.map((gr) => {
        const list = pool.items.filter((i) => i.type === gr.key)
        if (!list.length) return null
        return (
          <div key={gr.key} className="space-y-1.5">
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">{gr.title}</p>
            {list.map((it) => (
              <label key={it.id} className="flex items-center gap-3 rounded-lg border border-[var(--border-light)] bg-[var(--bg-inset)] px-3 py-2 cursor-pointer">
                <input type="checkbox" checked={isOn(it)} onChange={() => toggle(it)} className="w-4 h-4 accent-violet-600" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{mt(it.name)}{it.owner ? <span className="font-normal text-[var(--text-dim)]"> · {mt(it.owner)}</span> : null}</p>
                  <p className="text-xs text-[var(--text-dim)]">{tag(it)}{it.kind === 'pool' && it.type !== 'Stock' ? ` · ${Math.round(it.eq * 100)}% equity` : ''}</p>
                </div>
                <span className="text-sm font-semibold tabular-nums text-[var(--text-primary)]">{L(it.value)}</span>
              </label>
            ))}
          </div>
        )
      })}
      <div className="rounded-lg border border-violet-500/30 bg-violet-500/5 px-3 py-2 text-xs text-[var(--text-secondary)]">
        <b className="text-violet-400">For goals: {L(total)}</b> across {goals.length} goal{goals.length === 1 ? '' : 's'}.
        {dirty ? ' Press Save to use this.' : ''} EPF, PPF and NPS count for retirement only and are never part of a sell step.
        When one pays out, press <b>Received</b> on it in Other Investments.
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={() => setChoice(pool.choice)} disabled={!dirty || saving} className="px-4 py-2 text-xs rounded-lg border border-[var(--border-light)] text-[var(--text-primary)] disabled:opacity-40">Undo changes</button>
        <button onClick={save} disabled={!dirty || saving} className="px-4 py-2 text-xs font-semibold rounded-lg bg-violet-600 text-white disabled:opacity-40">{saving ? 'Saving…' : 'Save'}</button>
      </div>
    </div>
  )
}
