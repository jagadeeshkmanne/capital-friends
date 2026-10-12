/**
 * "Money for goals": one pool for all goals instead of linking investments to each goal by hand.
 *
 * 1. poolItems(): every investment, sorted automatically —
 *      mutual fund portfolios, stock portfolios, FDs / bonds / cash  -> in the pool (each can be switched off)
 *      EPF, PPF, NPS, VPF, Sukanya                                   -> retirement only, never moved
 *      gold, silver, real estate, crypto, other                      -> left out (can be switched on)
 * 2. sharePool(): shares the pool across goals, no input needed —
 *      A. safe money first to the nearest goals (Emergency Fund first), up to the safe part each needs
 *         (retirement takes its EPF / PPF / NPS here, counted in full)
 *      B. equity: the goals with the most time first (a 10-year goal before a 4-year one)
 *      C. anything a goal still needs, from whatever is left (retirement first — there is no loan for retirement)
 *      Money left over stays extra (not pushed into any goal), shown once for the family
 *    Every goal's mix follows its timeline, also when it is already fully covered.
 *    Each goal's "need" is what it should hold today for its amount and date (no SIP assumed).
 *    The result is written as ordinary goal links (goalId, portfolioId, allocationPct), so the buckets page,
 *    dashboard, email report and everything else keep working unchanged.
 */
import { getRecommendedAllocation } from '../data/glidePath'
import { needToday } from './goalPlan'

const YEAR_MS = 365.25 * 24 * 60 * 60 * 1000
const RET_ONLY = ['epf', 'ppf', 'nps', 'vpf', 'sukanya samriddhi', 'sukanya', 'ssy']
const LEFT_OUT = ['physical gold', 'digital gold', 'sovereign gold bond', 'physical silver', 'digital silver', 'real estate', 'crypto', 'other']
const norm = (s) => String(s || '').trim().toLowerCase()

/** How an Other Investment is treated by default: 'pool' | 'retirement' | 'out' */
export function otherKind(inv) {
  const t = norm(inv?.investmentType)
  if (RET_ONLY.includes(t)) return 'retirement'
  if (LEFT_OUT.includes(t)) return 'out'
  const c = norm(inv?.investmentCategory)
  if (['gold', 'silver', 'property', 'alternative'].includes(c)) return 'out'
  return 'pool' // FD, bonds, cash / savings, debt or equity entries
}

/**
 * @param choice { off: [ids], on: [ids] } the person's switches (off = left out, on = put in although left out by default)
 * @returns [{ id, type: 'MF'|'Stock'|'Other', name, owner, value, eq (0..1), kind: 'pool'|'retirement'|'out', included, locked }]
 */
export function poolItems({ mfPortfolios, mfHoldings, stockPortfolios, stockHoldings, otherInvList, eqOf, choice = {}, kidNames = [] }) {
  const off = new Set(choice.off || []), on = new Set(choice.on || [])
  // a son's / daughter's own money is theirs: left out by default (switch it on to use it for a goal)
  const kids = new Set((kidNames || []).map(norm))
  const items = []
  for (const p of (mfPortfolios || []).filter((x) => x.status !== 'Inactive')) {
    const hs = (mfHoldings || []).filter((h) => h.portfolioId === p.portfolioId && Number(h.units) > 0)
    const value = hs.reduce((t, h) => t + (Number(h.currentValue) || 0), 0)
    const eq = value > 0 ? hs.reduce((t, h) => t + (Number(h.currentValue) || 0) * eqOf(h), 0) / value : 0
    items.push({ id: p.portfolioId, type: 'MF', name: String(p.portfolioName || '').replace(/^PFL-/, ''), owner: p.ownerName, value, eq, kind: 'pool' })
  }
  for (const p of (stockPortfolios || []).filter((x) => x.status !== 'Inactive')) {
    const value = (stockHoldings || []).filter((h) => h.portfolioId === p.portfolioId && !(Number(h.quantity) <= 0)).reduce((t, h) => t + (Number(h.currentValue) || 0), 0)
    items.push({ id: p.portfolioId, type: 'Stock', name: p.portfolioName || 'Stocks', owner: p.ownerName, value, eq: 1, kind: 'pool' })
  }
  for (const i of (otherInvList || []).filter((x) => x.status === 'Active')) {
    const kind = otherKind(i)
    items.push({ id: i.investmentId, type: 'Other', name: i.investmentName || i.investmentType, owner: i.familyMemberName, value: Number(i.currentValue) || 0,
      eq: norm(i.investmentCategory) === 'equity' || /gold|silver|sgb|sovereign/i.test(`${i.investmentType} ${i.investmentCategory}`) ? 1 : 0, kind, otherType: i.investmentType, locked: kind === 'retirement',
      // cash that came from an EPF / PPF / NPS payout ("Received") stays retirement's money first
      fromRetirement: kind === 'pool' && /^from (epf|ppf|nps|vpf)/i.test(String(i.notes || '')) })
  }
  return items.map((it) => {
    const kid = it.kind === 'pool' && !!it.owner && kids.has(norm(it.owner))
    const kind = kid ? 'out' : it.kind
    return { ...it, kind, kid, included: kind === 'out' ? on.has(it.id) : !off.has(it.id) }
  })
}

export const validDate = (d) => !!d && Number.isFinite(new Date(d).getTime())
const yearsTo = (g, now) => (new Date(g.targetDate) - now) / YEAR_MS
const isEF = (g) => g.goalType === 'Emergency Fund'
const isRet = (g) => g.goalType === 'Retirement'
// the goal's own Priority (High / Medium / Low) decides who is funded first when money is short
const prio = (g) => ({ high: 0, medium: 1, low: 2 })[norm(g.priority)] ?? 1

/** What a goal should hold today, and the equity share its glide path wants (0..1). */
export function goalWant(g, now = new Date(), sip = 0) {
  const years = Math.max(0, yearsTo(g, now) || 0)
  const target = Number(g.targetAmount) || 0
  const r = Number(g.expectedCAGR) || 0.12
  // the emergency fund must be there in full today (it is not invested to grow)
  // what it should hold today so that this + its running SIP reaches the amount (the same "Need today" the goal shows)
  const want = years > 0 && !isEF(g) ? needToday({ target, years, annualReturn: r, sip: Number(sip) || 0 }) : target
  // a retirement goal keeps its mix after the date (the money must last for decades); other goals are spent then
  const eq = isEF(g) || (years <= 0 && !isRet(g)) ? 0 : getRecommendedAllocation(g.goalType, years).equity / 100
  return { want, eq, years, target }
}

/**
 * @param goals  active goals
 * @param items  poolItems(...) (only included ones are used)
 * @returns { mappings: [{ goalId, portfolioId, allocationPct, investmentType }], byGoal: { [goalId]: { want, got, eq } }, left: ₹ not used }
 */
export function sharePool({ goals, items, now = new Date(), sipOf = {}, reserved = [] }) {
  const live = (goals || []).filter((g) => g.isActive !== false && validDate(g.targetDate) && Number(g.targetAmount) > 0)
  const its = (items || []).filter((i) => i.included && i.value > 0).map((i) => ({ ...i, left: i.value }))
  const take = {} // goalId -> itemId -> ₹
  const meta = {}
  for (const g of live) { meta[g.goalId] = { ...goalWant(g, now, sipOf[g.goalId]), got: 0, gotSafe: 0, gotEq: 0 }; take[g.goalId] = {} }
  const give = (g, it, x) => {
    if (!(x > 0.5)) return 0
    const v = Math.min(x, it.left); if (!(v > 0.5)) return 0
    it.left -= v; take[g.goalId][it.id] = (take[g.goalId][it.id] || 0) + v
    const m = meta[g.goalId]; m.got += v; m.gotSafe += v * (1 - it.eq); m.gotEq += v * it.eq
    return v
  }
  // a goal whose date has passed (not retirement) waits for you to confirm it: it never takes money ahead of the
  // other goals, it only keeps what is left after them (so after you withdraw, the others are not touched)
  const past = (g) => !isRet(g) && yearsTo(g, now) <= 0
  const pastLast = () => 0 // (a past goal with saved shares keeps them; without, it is simply the nearest goal)
  const byDate = live.slice().sort((a, b) => pastLast(a, b) || (isEF(b) - isEF(a)) || (yearsTo(a, now) - yearsTo(b, now)))
  // equity goes to the goals with the most time first (they can ride out a fall); when equity is short,
  // the near goals hold the safe money
  const farFirst = live.slice().sort((a, b) => pastLast(a, b) || (prio(a) - prio(b)) || (isRet(b) - isRet(a)) || (yearsTo(b, now) - yearsTo(a, now)))
  const retFirst = live.slice().sort((a, b) => pastLast(a, b) || (isEF(b) - isEF(a)) || (prio(a) - prio(b)) || (isRet(b) - isRet(a)) || (yearsTo(a, now) - yearsTo(b, now)))
  const pool = its.filter((i) => i.kind !== 'retirement')
  const safeItems = pool.filter((i) => i.eq < 0.5).sort((a, b) => a.eq - b.eq)
  const eqItems = pool.filter((i) => i.eq >= 0.5).sort((a, b) => b.eq - a.eq)
  const room = (g) => { const m = meta[g.goalId]; return Math.max(0, m.want - m.got) }
  // a goal uses its own family member's money first (Priya's retirement takes Priya's portfolio), then the rest
  const own = (g, it) => !!g.familyMemberName && !!it.owner && norm(it.owner) === norm(g.familyMemberName)
  const mineFirst = (g, list) => list.filter((it) => own(g, it)).concat(list.filter((it) => !own(g, it)))
  let ownOnly = false // first round: each goal only takes its own member's money; second round: everything left
  const from = (g, list, amount) => { let need = Math.min(amount, room(g)); for (const it of mineFirst(g, list)) { if (need <= 0.5) break; if (ownOnly && !own(g, it)) break; need -= give(g, it, need) } }

  // a goal whose date has passed keeps exactly the shares it already had (its money is kept for it until you
  // confirm). After you withdraw, those funds are smaller, so it simply gets less: nothing moves from other goals.
  const kept = new Set()
  for (const g of live.filter(past)) {
    const ms = (reserved || []).filter((m) => m.goalId === g.goalId && Number(m.allocationPct) > 0)
    if (!ms.length) continue
    kept.add(g.goalId)
    for (const m of ms) { const it = its.find((i) => i.id === m.portfolioId); if (it) give(g, it, Math.min(it.left, it.value * Number(m.allocationPct) / 100)) }
  }
  const open = (g) => !kept.has(g.goalId)

  // retirement-only money (EPF, PPF, NPS) belongs to the owner's retirement goal in full (the first retirement
  // goal when its owner has none); with no retirement goal it is not used
  const rets = retFirst.filter(isRet)
  const retOf = (it) => rets.find((g) => own(g, it)) || rets[0]
  for (const it of its.filter((i) => i.kind === 'retirement')) { const g = retOf(it); if (g) give(g, it, it.left) }
  for (const it of its.filter((i) => i.fromRetirement)) { const g = retOf(it); if (g) { const m = meta[g.goalId]; give(g, it, Math.max(0, m.want - m.got)) } }

  // A. safe part, nearest goal first (the emergency fund and near goals come first, whoever owns the money)
  for (const g of byDate) { if (!open(g)) continue; const m = meta[g.goalId]; from(g, safeItems, m.want * (1 - m.eq) - m.gotSafe) }
  // B. equity part, farthest goal first; the emergency fund never takes equity.
  //    First each goal takes only its own member's equity (Priya's retirement takes Priya's portfolio), then the rest.
  for (const round of [true, false]) {
    ownOnly = round
    for (const g of farFirst) { if (isEF(g) || !open(g)) continue; const m = meta[g.goalId]; from(g, eqItems, m.want * m.eq - m.gotEq) }
  }
  ownOnly = false
  // C. whatever a goal still needs, from what is left (near goals prefer safe money)
  for (const g of retFirst) { if (!open(g)) continue; const m = meta[g.goalId]; from(g, isEF(g) ? [...safeItems, ...eqItems] : m.eq < 0.5 ? [...safeItems, ...eqItems] : [...eqItems, ...safeItems], m.want - m.got) }
  // money left over is NOT pushed into goals: each goal holds what it needs today (with its SIP), and the rest is
  // "extra" — shown once for the family (lower a SIP, or start a new goal). So no goal is ahead while another is
  // short; only EPF / PPF / NPS (retirement only, never moved) can leave retirement ahead.

  const itemOf = Object.fromEntries((items || []).map((i) => [i.id, i]))
  const mappings = []
  for (const g of live) for (const [id, v] of Object.entries(take[g.goalId])) {
    const it = itemOf[id]; if (!it || !(it.value > 0)) continue
    const pct = Math.round(v / it.value * 10000) / 100
    if (pct >= 0.01) mappings.push({ goalId: g.goalId, portfolioId: id, allocationPct: pct, investmentType: it.type })
  }
  const freeIts = its.filter((i) => i.kind !== 'retirement' && i.left > 0.5)
  const extra = freeIts.reduce((t, i) => t + i.left, 0)
  const extraEq = freeIts.reduce((t, i) => t + i.left * i.eq, 0)
  return { mappings, byGoal: meta, left: its.reduce((t, i) => t + i.left, 0), extra, extraEq, extraItems: freeIts.map((i) => ({ id: i.id, name: i.name, type: i.type, value: i.left, eq: i.eq })) }
}

/** True when two sets of links differ enough to be worth saving (a new / dropped link, or a share 2+ points off). */
export function linksChanged(a, b) {
  const key = (m) => m.goalId + '|' + m.portfolioId
  // the sheet hands shares back as whole numbers, so a share under 0.5% reads as 0: treat it as no link
  const A = Object.fromEntries((a || []).filter((m) => Number(m.allocationPct) >= 0.5).map((m) => [key(m), Number(m.allocationPct)]))
  const B = Object.fromEntries((b || []).filter((m) => Number(m.allocationPct) >= 0.5).map((m) => [key(m), Number(m.allocationPct)]))
  const keys = new Set([...Object.keys(A), ...Object.keys(B)])
  for (const k of keys) { if (!(k in A) || !(k in B)) return true; if (Math.abs(A[k] - B[k]) >= 2) return true }
  return false
}
