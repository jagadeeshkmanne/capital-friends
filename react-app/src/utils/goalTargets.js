/**
 * Goal-driven fund targets for a portfolio.
 *
 * A portfolio's fund targets (e.g. 40 / 20 / 20 / 20) carry two choices:
 *   - how the equity part is split between the equity funds (kept as the user set it), and
 *   - how much sits in safe funds (debt / liquid) – this follows the goals' glide paths.
 * When the equity the goals need is BAND points or more away from what the targets hold,
 * new targets are worked out: the equity funds keep their ratio to each other, the safe funds
 * keep theirs, only the equity / safe split moves. The rebalance feature then shows the moves,
 * and the next CAS import (or a recorded switch) shows them done.
 *
 * need = Σ goalShare × goalEquity + unlinkedShare × today's target equity (the unlinked part keeps the user's mix)
 */
import { getRecommendedAllocation, followsBucketPlan } from '../data/glidePath'

export const TARGET_BAND = 5
const YEAR_MS = 365.25 * 24 * 60 * 60 * 1000
const EQ_MIN = 0.5 // a fund with half or more in equity counts as an equity fund here

/** Equity % a goal needs today, or null when it does not take part (achieved, no date, in its retirement buckets). */
export function goalEquityNeed(goal, now = new Date()) {
  if (!goal || goal.isActive === false || goal.status === 'Achieved' || !goal.targetDate) return null
  const years = (new Date(goal.targetDate) - now) / YEAR_MS
  if (followsBucketPlan(goal.goalType, years)) return { bucket: true }
  return { equity: years > 0 ? getRecommendedAllocation(goal.goalType, years).equity : 0 }
}

const round2 = (v) => Math.round(v * 100) / 100

/**
 * @param holdings  this portfolio's MF holdings (with targetAllocationPct)
 * @param links     [{ goal, share }]  share 0..1 of the portfolio linked to that goal
 * @param eqOf      holding => equity share 0..1
 * @returns { status: 'no-targets'|'no-goals'|'buckets'|'ok'|'update'|'needs-safe-fund'|'needs-equity-fund', curEq, needEq, targets? }
 */
export function portfolioTargets({ holdings, links, eqOf, now = new Date() }) {
  const sumT = (holdings || []).reduce((s, h) => s + (Number(h.targetAllocationPct) || 0), 0)
  // funds with a target, plus safe funds still held with a 0 target (so debt can come back after a 0% stage)
  const hs = (holdings || []).filter((h) => (Number(h.targetAllocationPct) || 0) > 0 || (Number(h.units) > 0 && eqOf(h) < EQ_MIN))
  if (!hs.length || sumT < 99 || sumT > 101) return { status: 'no-targets' }
  let total = 0, weighted = 0
  const parts = []
  for (const l of links || []) {
    const need = goalEquityNeed(l.goal, now)
    if (!need) continue
    if (need.bucket) return { status: 'buckets' }
    if (Number.isFinite(l.eq)) need.equity = l.eq // equity this portfolio must carry once the goal's other holdings are counted
    const share = Math.max(0, Number(l.share) || 0)
    if (!share) continue
    parts.push({ share, eq: need.equity }); total += share
  }
  if (!parts.length) return { status: 'no-goals' }
  const scale = total > 1 ? 1 / total : 1
  const T = hs.map((h) => Number(h.targetAllocationPct) / sumT * 100)
  const e = hs.map((h) => Math.max(0, Math.min(1, eqOf(h))))
  const curEq = T.reduce((s, t, i) => s + t * e[i], 0)
  for (const p of parts) weighted += p.share * scale * p.eq
  const needEq = weighted + Math.max(0, 1 - total * scale) * curEq
  const base = { curEq: Math.round(curEq * 10) / 10, needEq: Math.round(needEq * 10) / 10 }
  if (Math.abs(needEq - curEq) < TARGET_BAND) return { status: 'ok', ...base }
  const eqI = hs.map((_, i) => i).filter((i) => e[i] >= EQ_MIN), safeI = hs.map((_, i) => i).filter((i) => e[i] < EQ_MIN)
  const A = eqI.reduce((s, i) => s + T[i], 0)
  let B = safeI.reduce((s, i) => s + T[i], 0)
  if (!B && safeI.length) { const v = safeI.reduce((s, i) => s + (Number(hs[i].currentValue) || 1), 0); safeI.forEach((i) => { T[i] = ((Number(hs[i].currentValue) || 1) / v) * 1e-6 }); B = 1e-6 }
  if (!B && needEq < curEq) return { status: 'needs-safe-fund', ...base }
  if (!A && needEq > curEq) return { status: 'needs-equity-fund', ...base }
  const a = A ? eqI.reduce((s, i) => s + T[i] * e[i], 0) / A : 1
  const b = B ? safeI.reduce((s, i) => s + T[i] * e[i], 0) / B : 0
  // x% in equity funds so that x·a + (100−x)·b = need
  let x = a - b > 1e-9 ? (needEq - 100 * b) / (a - b) : A
  x = Math.max(B ? 0 : 100, Math.min(A ? 100 : 0, x))
  const next = hs.map((h, i) => round2(eqI.includes(i) ? T[i] * x / A : T[i] * (100 - x) / B))
  const drift = round2(100 - next.reduce((s, v) => s + v, 0))
  if (drift) { const k = next.indexOf(Math.max(...next)); next[k] = round2(next[k] + drift) }
  const targets = hs.map((h, i) => ({ schemeCode: h.schemeCode, fundName: h.fundName, targetAllocationPct: next[i], before: round2(Number(h.targetAllocationPct)) }))
  // the goal asks for more (or less) equity than these funds can give: the targets are already as close as they get
  if (targets.every((t) => Math.abs(t.targetAllocationPct - t.before) < 0.05)) return { status: 'ok', capped: true, ...base }
  return { status: 'update', ...base, targets }
}

const hasTargets = (hs) => { const t = hs.reduce((s, h) => s + (Number(h.targetAllocationPct) || 0), 0); return t >= 99 && t <= 101 }

/**
 * Every portfolio that carries goals, with its goal-driven targets.
 * With `attribution` (from attributeGoals), a goal's other holdings count too: EPF, PPF, FD (safe), stocks (equity)
 * and MF portfolios without targets cannot be moved by targets, so the portfolios WITH targets carry the difference.
 * e.g. retirement needs 84% equity and holds ₹20 L EPF + ₹30 L in a portfolio -> that portfolio should be ~100% equity.
 */
export function allPortfolioTargets({ goals, mappings, mfHoldings, eqOf, attribution, now = new Date() }) {
  const byId = Object.fromEntries((goals || []).map((g) => [g.goalId, g]))
  const tgtP = new Set()
  const pids = new Set((mappings || []).map((m) => m.portfolioId))
  for (const pid of pids) if (hasTargets((mfHoldings || []).filter((h) => h.portfolioId === pid))) tgtP.add(pid)
  const eqFor = {}
  if (attribution) for (const g of goals || []) {
    const att = attribution[g.goalId], need = goalEquityNeed(g, now)
    if (!att || !need || need.bucket || !(att.total > 0)) continue
    let fixedEq = 0, adj = 0
    for (const it of att.items || []) { if (tgtP.has(it.portfolioId)) adj += it.value; else fixedEq += it.value * it.eq }
    if (adj <= 0) continue
    eqFor[g.goalId] = Math.max(0, Math.min(100, ((need.equity / 100) * att.total - fixedEq) / adj * 100))
  }
  const byP = {}
  for (const m of mappings || []) {
    const g = byId[m.goalId]; if (!g) continue
    ;(byP[m.portfolioId] = byP[m.portfolioId] || []).push({ goal: g, share: (Number(m.allocationPct) || 0) / 100, eq: eqFor[g.goalId] })
  }
  return Object.entries(byP).map(([portfolioId, links]) => ({
    portfolioId, links,
    ...portfolioTargets({ holdings: (mfHoldings || []).filter((h) => h.portfolioId === portfolioId && (Number(h.units) > 0 || Number(h.targetAllocationPct) > 0)), links, eqOf, now }),
  }))
}
