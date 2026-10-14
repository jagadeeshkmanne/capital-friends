// "Money for goals": one list of every investment with an "Include in goals" switch. No linking per goal —
// the app shares the included money across all goals (utils/goalPool.js) and keeps the goal links updated.
import { useState } from 'react'
import { useData } from '../../context/DataContext'
import { useToast } from '../../context/ToastContext'
import { useMaskText } from '../../hooks/useMaskText'
import { formatINR } from '../../data/familyData'

const L = (v) => formatINR(Math.round(v || 0))
// Groups by how the money is used, so it is clear what counts for goals:
//   counted (liquid: funds, stocks, cash / FD, listed equity) · you decide (left out until ticked) ·
//   retirement only (EPF / PPF / NPS) · not used (not liquid: real estate, gold, silver, unlisted, crypto)
const POOL = (i) => i.kind === 'pool'
const GROUPS = [
  { key: 'MF', title: 'Mutual funds', badge: 'Counted', has: (i) => POOL(i) && i.type === 'MF' },
  { key: 'Stock', title: 'Stocks', badge: 'Counted', has: (i) => POOL(i) && i.type === 'Stock' },
  { key: 'Cash', title: 'Cash, FDs and bonds', badge: 'Counted', has: (i) => POOL(i) && i.type === 'Other' && i.eq < 0.5 },
  { key: 'Eq', title: 'Other equity', badge: 'Counted', has: (i) => POOL(i) && i.type === 'Other' && i.eq >= 0.5 },
  { key: 'Out', title: 'You decide', badge: 'Left out', has: (i) => i.kind === 'out',
    note: "Not counted unless you tick them: your kids' own money, ESOP / RSU (tick only if it is vested and you can sell it), SGB and digital gold or silver (counted as growth money, never as safe money) and anything marked Other." },
  { key: 'Ret', title: 'For retirement only', badge: 'Retirement', has: (i) => i.kind === 'retirement',
    note: 'EPF, PPF, NPS and similar accounts are locked until retirement, so they count only for your Retirement goal. They are never used for other goals and never part of a sell step.' },
  { key: 'Locked', title: 'Not used for goals', badge: 'Not liquid', has: (i) => i.kind === 'locked',
    note: 'A goal needs money you can take out on the day. Real estate, physical gold and silver (jewellery, coins), unlisted shares and crypto are not easy to sell at a fair price when you need it, so they are not counted. If you sell one, add the money as cash or FD in Other Investments: it counts for your goals from then.' },
]
const BADGE = {
  Counted: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30', 'Left out': 'bg-slate-500/10 text-[var(--text-muted)] border-[var(--border-light)]',
  Retirement: 'bg-amber-500/10 text-amber-400 border-amber-500/30', 'Not liquid': 'bg-rose-500/10 text-rose-400 border-rose-500/30',
}

export default function MoneyForGoals({ pool, onSaved }) {
  const mt = useMaskText()
  const { updateSettings, goalList } = useData()
  const { showToast } = useToast()
  const [choice, setChoice] = useState(pool.choice)
  const [saving, setSaving] = useState(false)
  const dirty = JSON.stringify(choice) !== JSON.stringify(pool.choice)

  const isOn = (it) => (it.kind === 'retirement' ? true : it.kind === 'locked' ? false : it.kind === 'out' ? choice.on.includes(it.id) : !choice.off.includes(it.id))
  const toggle = (it) => {
    if (it.kind === 'locked' || it.kind === 'retirement') return
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
  const tag = (it) => (it.kind === 'locked' ? `${it.why || 'Not liquid'} · not used for goals` : it.kind === 'retirement' ? 'Only for your Retirement goal · never sold' : it.kid ? "Kids' own money · left out by default" : it.kind === 'out' ? (/esop|rsu/i.test(it.otherType || '') ? 'Left out by default · tick it if it is vested and you can sell it' : /sovereign|sgb/i.test(it.otherType || '') ? 'Left out by default · can be sold on the exchange · counted as growth, not safe money' : /digital (gold|silver)/i.test(it.otherType || '') ? 'Left out by default · counted as growth, not safe money' : 'Left out by default') : it.eq >= 0.5 ? 'Equity' : 'Safe')
  const goals = (goalList || []).filter((g) => g.isActive !== false)
  const hasRet = goals.some((g) => g.goalType === 'Retirement')

  return (
    <div className="space-y-4 text-sm">
      <p className="text-xs text-[var(--text-muted)]">
        Only money you can take out when a goal comes is counted: mutual funds, stocks, cash and FDs. You don't link them to each
        goal: the app shares this money across all goals — the emergency fund and near goals get the safe money, retirement is
        protected, far goals get the equity. Untick anything that is not for these goals.
      </p>
      {GROUPS.map((gr) => {
        const list = pool.items.filter(gr.has)
        if (!list.length) return null
        return (
          <div key={gr.key} className="space-y-1.5">
            <div className="flex items-center gap-2">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">{gr.title}</p>
              <span className={`px-1.5 py-0.5 text-[10px] font-semibold rounded border ${BADGE[gr.badge]}`}>{gr.badge}</span>
              <span className="ml-auto text-xs tabular-nums text-[var(--text-dim)]">{L(list.reduce((t, i) => t + i.value, 0))}</span>
            </div>
            {gr.note && <p className="text-[11px] text-[var(--text-dim)] -mt-0.5">{gr.note}{gr.key === 'Ret' && !hasRet ? ' You have no Retirement goal yet, so they are not used.' : ''}</p>}
            {list.map((it) => (
              <label key={it.id} className="flex items-center gap-3 rounded-lg border border-[var(--border-light)] bg-[var(--bg-inset)] px-3 py-2 cursor-pointer">
                {it.kind === 'retirement'
                  ? <span title="Retirement only" className="w-4 h-4 shrink-0 flex items-center justify-center text-amber-400"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg></span>
                  : it.kind === 'locked'
                    ? <span title="Not used for goals" className="w-4 h-4 shrink-0 flex items-center justify-center text-[var(--text-dim)]"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M6 18L18 6" /></svg></span>
                    : <input type="checkbox" checked={isOn(it)} onChange={() => toggle(it)} className="w-4 h-4 accent-violet-600" />}
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
