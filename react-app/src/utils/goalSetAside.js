// On the day a goal's date comes, the app sets its money aside: the exact units of each fund / share and the cash
// amounts it holds then (Settings → GoalSetAside, { goalId: { date, items: [{ id, units, value, eq }] } }).
// - The set-aside is not shared with other goals; it still counts in net worth until you mark it withdrawn.
// - Units sold outside the app (a CAS import shows the sale) come off the set-aside, not off the other goals.
// - When all of it is gone, the goal is closed by itself.
// A goal paid over several years sets aside only this year's part (safest money first).
import { parseDate } from './mfMetrics'

/**
 * Units sold since each goal's set-aside date, per goal and per fund / share id (`${portfolioId}::${schemeCode | symbol}`):
 * plain redemptions and sales (not switches between funds, which stay in the portfolio).
 * @returns { [goalId]: { [id]: units } }
 */
export function soldSinceOf(setAside, mfTransactions, stockTransactions) {
  const out = {}
  const rows = [
    ...(mfTransactions || []).filter((t) => t.type === 'SELL' && !/switch/i.test(t.transactionType || '')).map((t) => ({ k: `${t.portfolioId}::${t.fundCode}`, d: parseDate(t.date), u: Number(t.units) || 0 })),
    ...(stockTransactions || []).filter((t) => t.type === 'SELL').map((t) => ({ k: `${t.portfolioId}::${t.symbol}`, d: parseDate(t.date), u: Number(t.quantity) || 0 })),
  ].filter((r) => r.d && r.u > 0)
  for (const [gid, sa] of Object.entries(setAside || {})) {
    const m0 = String(sa?.date || '').match(/^(\d{4})-(\d{2})-(\d{2})/)   // the set-aside day, as a local day
    const from = m0 ? new Date(Number(m0[1]), Number(m0[2]) - 1, Number(m0[3])) : parseDate(sa?.date); if (!from) continue
    const ids = new Set((sa.items || []).map((e) => e.id)), m = {}
    for (const r of rows) if (ids.has(r.k) && r.d >= from) m[r.k] = (m[r.k] || 0) + r.u
    out[gid] = m
  }
  return out
}

export function readSetAside(settings) {
  try { const o = JSON.parse(settings?.GoalSetAside || '{}'); return o && typeof o === 'object' && !Array.isArray(o) ? o : {} } catch { return {} }
}

const isDue = (g, now) => g && g.isActive !== false && g.goalType !== 'Retirement' && g.goalType !== 'Emergency Fund' && g.targetDate && new Date(g.targetDate) <= now

/** The snapshot for one goal from what it holds today (pool.bySub[goalId]). */
export function snapshotOf(goal, held, now = new Date()) {
  const n = Math.max(1, Math.round(Number(goal?.payYears) || 1))
  let items = (held || []).filter((x) => x.value > 0)
  if (n > 1) {   // this year's part only, from the safest money first
    let want = (Number(goal.targetAmount) || 0) / n
    items = items.slice().sort((a, b) => a.eq - b.eq).map((x) => {
      if (want <= 0) return null
      const v = Math.min(x.value, want); want -= v
      return { ...x, value: Math.round(v), units: x.units > 0 ? Math.round((x.units * v / x.value) * 10000) / 10000 : 0 }
    }).filter(Boolean)
  }
  const d = now
  return { date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`, items }
}

/**
 * The new GoalSetAside: adds a snapshot for every goal whose date has come and has none yet, drops the ones of
 * closed goals and of goals whose date is ahead again (paid over years: moved to next year).
 * @returns { next, changed }
 */
export function nextSetAside({ current, goals, bySub, now = new Date() }) {
  const next = {}
  let changed = false
  const live = new Map((goals || []).filter((g) => g.isActive !== false).map((g) => [g.goalId, g]))
  for (const [id, sa] of Object.entries(current || {})) {
    const g = live.get(id)
    if (g && isDue(g, now)) next[id] = sa; else changed = true
  }
  for (const g of live.values()) {
    if (!isDue(g, now) || next[g.goalId]) continue
    const held = bySub?.[g.goalId] || []
    if (!held.length) continue
    next[g.goalId] = snapshotOf(g, held, now); changed = true
  }
  return { next, changed }
}
