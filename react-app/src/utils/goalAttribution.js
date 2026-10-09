/**
 * Goal attribution: which part of each shared investment belongs to which goal.
 *
 * A portfolio (or stock portfolio, or other investment) can be linked to several goals, e.g. 50% to a
 * home purchase next year and 50% to retirement in 20 years. Splitting every fund 50/50 makes each goal
 * look exactly like the whole portfolio, so the near goal is told "move to debt" even when the portfolio
 * already holds more than enough debt for it (and the move would push the portfolio away from what the
 * two goals need together).
 *
 * Here each goal still gets the same AMOUNT (its allocation % of the investment), but the safe money is
 * given to the goals that need it most first: goals with the lowest target equity (nearest date, goals
 * already due) take the debt-like holdings first, goals far away take the equity. So a goal is only told
 * to move money when the investment as a whole really lacks it.
 */

import { getRecommendedAllocation } from '../data/glidePath'

const EQUITY_CATS = new Set(['Equity', 'ELSS', 'Index'])
const YEAR_MS = 365.25 * 24 * 60 * 60 * 1000

/** Target equity share (0..1) a goal's money should have today. Goals due now / Emergency Fund: 0. */
export function goalTargetEquity(goal, now = new Date()) {
  if (!goal?.targetDate) return null
  const yearsLeft = (new Date(goal.targetDate) - now) / YEAR_MS
  if (!(yearsLeft > 0) || goal.goalType === 'Emergency Fund') return 0
  return (getRecommendedAllocation(goal.goalType, yearsLeft).equity || 0) / 100
}

/** attributeGoals for a family's active goals with the app's glide path targets. */
export function attributeFamilyGoals({ goals, mappings, mfHoldings, stockHoldings, otherInvList, allocMap, now = new Date() }) {
  return attributeGoals({ goals, targetOf: (g) => goalTargetEquity(g, now), mappings, mfHoldings, stockHoldings, otherInvList, allocMap })
}

/** Share of a mutual fund holding that is equity (0..1), from the fund's breakdown or its category. */
export function equityFraction(h, allocMap) {
  const detailed = allocMap?.[h.schemeCode || h.fundCode]
  if (detailed) return Math.max(0, Math.min(1, (Number(detailed.Equity) || 0) / 100))
  if (EQUITY_CATS.has(h.category)) return 1
  if (h.category === 'Hybrid') return 0.65
  if (h.category === 'Multi-Asset') return 0.5
  return 0
}

/**
 * @param goals       [{ goalId, ... }] the goals that take part (active ones)
 * @param targetOf    goal => target equity share 0..1 (null/undefined = no target: served last)
 * @param mappings    [{ goalId, portfolioId, allocationPct }]
 * @returns { [goalId]: { total, equity, items: [{ kind, portfolioId, key, holding, value, eq, fraction }] } }
 *          `fraction` = part of that holding (units / value) that belongs to the goal.
 */
export function attributeGoals({ goals, targetOf, mappings, mfHoldings, stockHoldings, otherInvList, allocMap }) {
  const out = {}
  const goalIds = new Set((goals || []).map((g) => g.goalId))
  ;(goals || []).forEach((g) => { out[g.goalId] = { total: 0, equity: 0, items: [] } })
  const tgt = {}
  ;(goals || []).forEach((g) => { const t = targetOf ? targetOf(g) : null; tgt[g.goalId] = t === null || t === undefined || !Number.isFinite(t) ? 1 : Math.max(0, Math.min(1, t)) })

  // group the links by investment
  const bySource = {}
  ;(mappings || []).forEach((m) => {
    if (!goalIds.has(m.goalId)) return
    const pct = Math.max(0, Number(m.allocationPct) || 0)
    if (!pct) return
    ;(bySource[m.portfolioId] = bySource[m.portfolioId] || []).push({ goalId: m.goalId, share: pct / 100 })
  })

  Object.keys(bySource).forEach((pid) => {
    // the holdings of this investment, each with its value and equity share
    let items = (mfHoldings || []).filter((h) => h.portfolioId === pid && Number(h.units) > 0)
      .map((h) => ({ kind: 'mf', key: `${pid}::${h.schemeCode || h.fundCode}`, holding: h, value: Number(h.currentValue) || 0, eq: equityFraction(h, allocMap) }))
    if (!items.length) {
      items = (stockHoldings || []).filter((h) => h.portfolioId === pid && Number(h.quantity) > 0)
        .map((h) => ({ kind: 'stock', key: `${pid}::${h.symbol}`, holding: h, value: Number(h.currentValue) || 0, eq: 1 }))
    }
    if (!items.length) {
      const inv = (otherInvList || []).find((i) => i.investmentId === pid)
      if (inv) items = [{ kind: 'other', key: `${pid}::other`, holding: inv, value: Number(inv.currentValue) || 0, eq: inv.investmentCategory === 'Equity' ? 1 : 0 }]
    }
    items = items.filter((it) => it.value > 0)
    if (!items.length) return
    const totalValue = items.reduce((s, it) => s + it.value, 0)
    const left = items.map((it) => it.value)            // value of each holding not yet given to a goal

    // most cautious goal first (lowest target equity); ties: the larger share first, then id for stability
    const links = bySource[pid].slice().sort((a, b) => (tgt[a.goalId] - tgt[b.goalId]) || (b.share - a.share) || String(a.goalId).localeCompare(String(b.goalId)))
    let shareSum = links.reduce((s, l) => s + l.share, 0)
    const scale = shareSum > 1 ? 1 / shareSum : 1     // links adding up to more than 100%: scale down

    const byEqAsc = items.map((_, i) => i).sort((a, b) => items[a].eq - items[b].eq)
    const byEqDesc = byEqAsc.slice().reverse()

    links.forEach((l) => {
      const budget = totalValue * l.share * scale
      const g = out[l.goalId]
      let taken = 0, debtGot = 0
      const take = (i, x) => {
        if (x <= 1e-9) return
        left[i] -= x; taken += x; debtGot += x * (1 - items[i].eq)
        const ex = g.items.find((y) => y.key === items[i].key)
        if (ex) { ex.value += x; ex.fraction = ex.value / items[i].value } else g.items.push({ kind: items[i].kind, portfolioId: pid, key: items[i].key, holding: items[i].holding, value: x, eq: items[i].eq, fraction: x / items[i].value })
      }
      // 1) the debt it needs, from the most debt-like holdings
      const wantDebt = budget * (1 - tgt[l.goalId])
      for (const i of byEqAsc) {
        const need = wantDebt - debtGot, room = budget - taken
        if (need <= 1e-6 || room <= 1e-6) break
        const d = 1 - items[i].eq
        if (d <= 1e-9) break
        take(i, Math.min(left[i], need / d, room))
      }
      // 2) the rest of its amount, equity-rich holdings first
      for (const i of byEqDesc) {
        const room = budget - taken
        if (room <= 1e-6) break
        take(i, Math.min(left[i], room))
      }
      g.total += taken
      g.equity += taken - debtGot
    })
  })
  return out
}
