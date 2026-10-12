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
 *      B. equity: retirement first (it is protected – there is no loan for retirement), then by date
 *      C. anything a goal still needs, from whatever is left (retirement first, then by date)
 *      D. money left over tops goals up to their full amount (retirement first), so a goal can be "achieved"
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
      eq: norm(i.investmentCategory) === 'equity' ? 1 : 0, kind, otherType: i.investmentType, locked: kind === 'retirement',
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

/** What a goal should hold today, and the equity share its glide path wants (0..1). */
export function goalWant(g, now = new Date()) {
  const years = Math.max(0, yearsTo(g, now) || 0)
  const target = Number(g.targetAmount) || 0
  const r = Number(g.expectedCAGR) || 0.12
  // the emergency fund must be there in full today (it is not invested to grow)
  const want = years > 0 && !isEF(g) ? needToday({ target, years, annualReturn: r, sip: 0 }) : target
  const eq = isEF(g) || years <= 0 ? 0 : getRecommendedAllocation(g.goalType, years).equity / 100
  return { want, eq, years, target }
}

/**
 * @param goals  active goals
 * @param items  poolItems(...) (only included ones are used)
 * @returns { mappings: [{ goalId, portfolioId, allocationPct, investmentType }], byGoal: { [goalId]: { want, got, eq } }, left: ₹ not used }
 */
export function sharePool({ goals, items, now = new Date() }) {
  const live = (goals || []).filter((g) => g.isActive !== false && validDate(g.targetDate) && Number(g.targetAmount) > 0)
  const its = (items || []).filter((i) => i.included && i.value > 0).map((i) => ({ ...i, left: i.value }))
  const take = {} // goalId -> itemId -> ₹
  const meta = {}
  for (const g of live) { meta[g.goalId] = { ...goalWant(g, now), got: 0, gotSafe: 0, gotEq: 0 }; take[g.goalId] = {} }
  const give = (g, it, x) => {
    if (!(x > 0.5)) return 0
    const v = Math.min(x, it.left); if (!(v > 0.5)) return 0
    it.left -= v; take[g.goalId][it.id] = (take[g.goalId][it.id] || 0) + v
    const m = meta[g.goalId]; m.got += v; m.gotSafe += v * (1 - it.eq); m.gotEq += v * it.eq
    return v
  }
  const byDate = live.slice().sort((a, b) => (isEF(b) - isEF(a)) || (yearsTo(a, now) - yearsTo(b, now)))
  const retFirst = live.slice().sort((a, b) => (isEF(b) - isEF(a)) || (isRet(b) - isRet(a)) || (yearsTo(a, now) - yearsTo(b, now)))
  const pool = its.filter((i) => i.kind !== 'retirement')
  const safeItems = pool.filter((i) => i.eq < 0.5).sort((a, b) => a.eq - b.eq)
  const eqItems = pool.filter((i) => i.eq >= 0.5).sort((a, b) => b.eq - a.eq)
  const room = (g) => { const m = meta[g.goalId]; return Math.max(0, m.target - m.got) }
  // a goal uses its own family member's money first (Priya's retirement takes Priya's portfolio), then the rest
  const own = (g, it) => !!g.familyMemberName && !!it.owner && norm(it.owner) === norm(g.familyMemberName)
  const mineFirst = (g, list) => list.filter((it) => own(g, it)).concat(list.filter((it) => !own(g, it)))
  let ownOnly = false // first round: each goal only takes its own member's money; second round: everything left
  const from = (g, list, amount) => { let need = Math.min(amount, room(g)); for (const it of mineFirst(g, list)) { if (need <= 0.5) break; if (ownOnly && !own(g, it)) break; need -= give(g, it, need) } }

  // retirement-only money (EPF, PPF, NPS) belongs to the owner's retirement goal in full (the first retirement
  // goal when its owner has none); with no retirement goal it is not used
  const rets = retFirst.filter(isRet)
  const retOf = (it) => rets.find((g) => own(g, it)) || rets[0]
  for (const it of its.filter((i) => i.kind === 'retirement')) { const g = retOf(it); if (g) give(g, it, it.left) }
  for (const it of its.filter((i) => i.fromRetirement)) { const g = retOf(it); if (g) { const m = meta[g.goalId]; give(g, it, Math.max(0, m.want - m.got)) } }

  // A. safe part, nearest goal first (the emergency fund and near goals come first, whoever owns the money)
  for (const g of byDate) { const m = meta[g.goalId]; from(g, safeItems, m.want * (1 - m.eq) - m.gotSafe) }
  // B. equity part, retirement first; the emergency fund never takes equity.
  //    First each goal takes only its own member's equity (Priya's retirement takes Priya's portfolio), then the rest.
  for (const round of [true, false]) {
    ownOnly = round
    for (const g of retFirst) { if (isEF(g)) continue; const m = meta[g.goalId]; from(g, eqItems, m.want * m.eq - m.gotEq) }
  }
  ownOnly = false
  // C. whatever a goal still needs, from what is left (near goals prefer safe money)
  for (const g of retFirst) { const m = meta[g.goalId]; from(g, isEF(g) ? safeItems : m.eq < 0.5 ? [...safeItems, ...eqItems] : [...eqItems, ...safeItems], m.want - m.got) }
  // D. money left over tops goals up to their full amount (retirement first), safe money first — a goal that is
  //    filled to its amount is protected, so it should not be handed equity it would be told to sell
  //    Safe first only for a goal that this fills to its amount (it is then protected); retirement and goals
  //    that stay short keep growing, so they take equity first.
  const leftOf = (list) => list.reduce((t, i) => t + i.left, 0)
  for (const g of retFirst) {
    if (isEF(g)) continue
    const m = meta[g.goalId], fills = !isRet(g) && leftOf(pool) >= m.target - m.got
    from(g, fills || m.eq < 0.5 ? [...safeItems, ...eqItems] : [...eqItems, ...safeItems], m.target - m.got)
  }
  // E. a goal that is now full (not retirement) swaps the equity it took for safe money nobody uses
  for (const g of live) {
    const m = meta[g.goalId]
    if (isRet(g) || isEF(g) || !(m.target > 0) || m.got < m.target * 0.98) continue
    for (const [id, v] of Object.entries(take[g.goalId])) {
      const eqIt = eqItems.find((i) => i.id === id); if (!eqIt) continue
      let move = v
      for (const sf of mineFirst(g, safeItems)) {
        if (move <= 0.5) break
        const x = Math.min(move, sf.left); if (!(x > 0.5)) continue
        sf.left -= x; take[g.goalId][sf.id] = (take[g.goalId][sf.id] || 0) + x
        eqIt.left += x; take[g.goalId][id] -= x; move -= x
        m.gotSafe += x * (1 - sf.eq) - x * (1 - eqIt.eq); m.gotEq += x * sf.eq - x * eqIt.eq
      }
      if (take[g.goalId][id] <= 0.5) delete take[g.goalId][id]
    }
  }

  const itemOf = Object.fromEntries((items || []).map((i) => [i.id, i]))
  const mappings = []
  for (const g of live) for (const [id, v] of Object.entries(take[g.goalId])) {
    const it = itemOf[id]; if (!it || !(it.value > 0)) continue
    const pct = Math.round(v / it.value * 10000) / 100
    if (pct >= 0.01) mappings.push({ goalId: g.goalId, portfolioId: id, allocationPct: pct, investmentType: it.type })
  }
  return { mappings, byGoal: meta, left: its.reduce((t, i) => t + i.left, 0) }
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
