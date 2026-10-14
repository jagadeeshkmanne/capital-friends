/**
 * "Money for goals": one pool for all goals instead of linking investments to each goal by hand.
 *
 * 1. poolItems(): every investment, sorted automatically —
 *    Goals need money you can take out when the date comes, so only liquid money counts:
 *      mutual fund portfolios, stock portfolios, FD / RD / bonds / cash / savings, other listed equity
 *                                                                    -> in the pool (each can be switched off)
 *      EPF, PPF, NPS, VPF, Sukanya                                   -> retirement only, never moved
 *      ESOP / RSU, SGB, digital gold / silver, 'Other', a child's own money -> left out (can be switched on;
 *        gold counts as growth money, never as safe money)
 *      real estate, physical gold / silver, unlisted shares, crypto  -> never for goals ('locked': not easy to sell
 *        at a fair price on the day). Once sold, the money is added as cash / FD in Other Investments and counts then.
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
import { getGoalAllocation, spendsOverYears } from '../data/glidePath'
import { needTodayN } from './goalPlan'

const YEAR_MS = 365.25 * 24 * 60 * 60 * 1000
const RET_ONLY = ['epf', 'ppf', 'nps', 'vpf', 'sukanya samriddhi', 'sukanya', 'ssy']
const LEFT_OUT = ['esop / rsu', 'esop', 'rsu', 'other', 'sovereign gold bond', 'sgb', 'digital gold', 'digital silver']
const LOCKED = ['real estate', 'property', 'land', 'plot', 'house', 'flat', 'apartment',
  'physical gold', 'gold', 'physical silver', 'silver', 'unlisted shares', 'crypto']
const norm = (s) => String(s || '').trim().toLowerCase()

/** How an Other Investment is treated: 'pool' | 'retirement' | 'out' (can be switched on) | 'locked' (never for goals) */
export function otherKind(inv) {
  const t = norm(inv?.investmentType), c = norm(inv?.investmentCategory)
  if (RET_ONLY.includes(t)) return 'retirement'
  if (LEFT_OUT.includes(t)) return 'out'   // SGB / digital gold can be sold, so the person decides
  if (LOCKED.includes(t) || ['property', 'gold', 'silver', 'alternative'].includes(c)) return 'locked'   // not liquid: never sold for a goal
  return 'pool' // FD, RD, bonds, cash / savings, other listed equity
}

/** Why a locked investment is not used for goals (shown in Money for goals). */
export function lockedWhy(inv) {
  const s = `${norm(inv?.investmentType)} ${norm(inv?.investmentCategory)}`
  if (/real estate|property|land|plot|house|flat|apartment/.test(s)) return 'Real estate'
  if (/gold/.test(s)) return 'Gold'
  if (/silver/.test(s)) return 'Silver'
  if (/unlisted/.test(s)) return 'Unlisted shares'
  if (/crypto|alternative/.test(s)) return 'Crypto'
  return ''
}

/**
 * @param choice { off: [ids], on: [ids] } the person's switches (off = left out, on = put in although left out by default;
 *   real estate is never put in)
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
    // each fund keeps its own mix: a hybrid fund is sold whole (its equity and debt together), so goals take funds, not mixes
    const parts = hs.map((h) => ({ key: String(h.schemeCode || h.fundCode || h.fundName || ''), value: Number(h.currentValue) || 0, eq: eqOf(h) })).filter((x) => x.value > 0)
    items.push({ id: p.portfolioId, type: 'MF', name: String(p.portfolioName || '').replace(/^PFL-/, ''), owner: p.ownerName, value, eq, kind: 'pool', parts })
  }
  for (const p of (stockPortfolios || []).filter((x) => x.status !== 'Inactive')) {
    const value = (stockHoldings || []).filter((h) => h.portfolioId === p.portfolioId && !(Number(h.quantity) <= 0)).reduce((t, h) => t + (Number(h.currentValue) || 0), 0)
    items.push({ id: p.portfolioId, type: 'Stock', name: p.portfolioName || 'Stocks', owner: p.ownerName, value, eq: 1, kind: 'pool' })
  }
  for (const i of (otherInvList || []).filter((x) => x.status === 'Active')) {
    const kind = otherKind(i)
    items.push({ id: i.investmentId, type: 'Other', name: i.investmentName || i.investmentType, owner: i.familyMemberName, value: Number(i.currentValue) || 0,
      eq: norm(i.investmentCategory) === 'equity' || /gold|silver|sgb|sovereign/i.test(`${i.investmentType} ${i.investmentCategory}`) ? 1 : 0, kind, otherType: i.investmentType, locked: kind === 'retirement', why: kind === 'locked' ? lockedWhy(i) : '',
      // cash that came from an EPF / PPF / NPS payout ("Received") stays retirement's money first
      fromRetirement: kind === 'pool' && /^from (epf|ppf|nps|vpf)/i.test(String(i.notes || '')) })
  }
  return items.map((it) => {
    const kid = it.kind === 'pool' && !!it.owner && kids.has(norm(it.owner))
    const kind = kid ? 'out' : it.kind
    if (kind === 'locked') return { ...it, kind, kid, included: false }   // not liquid: never sold for a goal
    if (kind === 'retirement') return { ...it, kind, kid, included: true }   // EPF / PPF / NPS always count, for retirement only
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
  const want = (years > 0 || Number(g.payYears) > 1) && !isEF(g) ? needTodayN({ target, years, annualReturn: r, sip: Number(sip) || 0, payYears: g.payYears }) : target
  // a retirement goal keeps its mix after the date (the money must last for decades); other goals are spent then
  const eq = isEF(g) || (years <= 0 && !isRet(g) && !spendsOverYears(g)) ? 0 : getGoalAllocation(g, years).equity / 100
  return { want, eq, years, target }
}

/**
 * @param goals  active goals
 * @param items  poolItems(...) (only included ones are used)
 * @returns { mappings: [{ goalId, portfolioId, allocationPct, investmentType }], byGoal: { [goalId]: { want, got, eq } }, left: ₹ not used }
 */
export function sharePool({ goals, items, now = new Date(), sipOf = {}, reserved = [] }) {
  const live = (goals || []).filter((g) => g.isActive !== false && validDate(g.targetDate) && Number(g.targetAmount) > 0)
  // a mutual fund portfolio is shared fund by fund: near goals take the debt / liquid funds first, a hybrid fund
  // counts with its own equity and debt (it cannot be split), far goals take the equity funds
  const its = []
  for (const i of (items || []).filter((x) => x.included && x.value > 0)) {
    const parts = (i.parts || []).filter((p) => p.value > 0)
    if (parts.length > 1) parts.forEach((p) => its.push({ ...i, id: `${i.id}::${p.key}`, parent: i.id, peq: i.eq, value: p.value, eq: p.eq, left: p.value }))
    else its.push({ ...i, parent: i.id, left: i.value })
  }
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
  const room = (g) => { const m = meta[g.goalId]; return Math.max(0, (m.cap ?? m.want) - m.got) }
  // a goal uses its own family member's money first (Priya's retirement takes Priya's portfolio), then the rest
  const own = (g, it) => !!g.familyMemberName && !!it.owner && norm(it.owner) === norm(g.familyMemberName)
  const mineFirst = (g, list) => list.filter((it) => own(g, it)).concat(list.filter((it) => !own(g, it)))
  let ownOnly = false // first round: each goal only takes its own member's money; second round: everything left
  const from = (g, list, amount) => { let need = Math.min(amount, room(g)); for (const it of mineFirst(g, list)) { if (need <= 0.5) break; if (ownOnly && !own(g, it)) break; need -= give(g, it, need) } }
  // the safe part of a goal, counted in safe ₹: a conservative hybrid (30% equity) gives 70 paise of safe money per ₹
  const fromSafe = (g, list, safeNeed) => {
    let need = safeNeed
    for (const it of mineFirst(g, list)) {
      if (need <= 0.5 || room(g) <= 0.5) break
      const d = 1 - it.eq; if (d <= 0) continue
      need -= give(g, it, Math.min(need / d, room(g))) * d
    }
  }

  // a goal whose date has passed keeps exactly the shares it already had (its money is kept for it until you
  // confirm). After you withdraw, those funds are smaller, so it simply gets less: nothing moves from other goals.
  const kept = new Set()
  for (const g of live.filter(past)) {
    const ms = (reserved || []).filter((m) => m.goalId === g.goalId && Number(m.allocationPct) > 0)
    if (!ms.length) continue
    kept.add(g.goalId)
    for (const m of ms) for (const it of its.filter((i) => i.parent === m.portfolioId)) give(g, it, Math.min(it.left, it.value * Number(m.allocationPct) / 100))
  }
  const open = (g) => !kept.has(g.goalId)

  // retirement-only money (EPF, PPF, NPS) belongs to the owner's retirement goal in full (the first retirement
  // goal when its owner has none); with no retirement goal it is not used
  const rets = retFirst.filter(isRet)
  const retOf = (it) => rets.find((g) => own(g, it)) || rets[0]
  for (const it of its.filter((i) => i.kind === 'retirement')) { const g = retOf(it); if (g) give(g, it, it.left) }
  for (const it of its.filter((i) => i.fromRetirement)) { const g = retOf(it); if (g) { const m = meta[g.goalId]; give(g, it, Math.max(0, m.want - m.got)) } }

  // When money is short: the emergency fund comes first, then a higher Priority is funded first; goals with the
  // SAME priority share what is left in proportion to what each needs (each gets the same % of its need), so two
  // goals can be put first together. A goal still keeps its own member's money (Priya's portfolio stays with
  // Priya's goal) before anything is shared.
  const poolLeft = its.filter((i) => i.kind !== 'retirement')
  let avail = poolLeft.reduce((t, i) => t + i.left, 0)
  for (const g of live.filter((x) => open(x) && isEF(x))) avail -= Math.min(avail, room(g))
  for (const tier of [0, 1, 2]) {
    const tg = live.filter((g) => open(g) && !isEF(g) && prio(g) === tier)
    const want = tg.reduce((t, g) => t + room(g), 0)
    const give = Math.min(avail, want), f = want > 0 ? give / want : 0
    for (const g of tg) {
      const m = meta[g.goalId]
      const mates = tg.filter((x) => norm(x.familyMemberName) && norm(x.familyMemberName) === norm(g.familyMemberName)).length || 1
      const mine = g.familyMemberName && !isEF(g) ? poolLeft.filter((it) => own(g, it) && (it.peq ?? it.eq) >= 0.5).reduce((t, it) => t + it.left, 0) / mates : 0
      m.cap = m.got + Math.min(room(g), Math.max(room(g) * f, mine))
    }
    avail -= give
  }

  // A. safe part, nearest goal first (the emergency fund and near goals come first, whoever owns the money)
  for (const g of byDate) { if (!open(g)) continue; const m = meta[g.goalId]; fromSafe(g, safeItems, m.want * (1 - m.eq) - m.gotSafe) }
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
  const parentOf = Object.fromEntries(its.map((i) => [i.id, i.parent]))
  // back to whole investments (the goal links stay per portfolio / investment)
  for (const g of live) {
    const t = {}
    for (const [id, v] of Object.entries(take[g.goalId])) { const p = parentOf[id] || id; t[p] = (t[p] || 0) + v }
    take[g.goalId] = t
  }
  const mappings = []
  for (const g of live) for (const [id, v] of Object.entries(take[g.goalId])) {
    const it = itemOf[id]; if (!it || !(it.value > 0)) continue
    const pct = Math.round(v / it.value * 10000) / 100
    if (pct >= 0.01) mappings.push({ goalId: g.goalId, portfolioId: id, allocationPct: pct, investmentType: it.type })
  }
  const freeIts = its.filter((i) => i.kind !== 'retirement' && i.left > 0.5)
  const extra = freeIts.reduce((t, i) => t + i.left, 0)
  const extraEq = freeIts.reduce((t, i) => t + i.left * i.eq, 0)
  const ex = {}
  for (const i of freeIts) { const e = ex[i.parent] || (ex[i.parent] = { id: i.parent, name: i.name, type: i.type, value: 0, eqv: 0 }); e.value += i.left; e.eqv += i.left * i.eq }
  const extraItems = Object.values(ex).map((e) => ({ id: e.id, name: e.name, type: e.type, value: e.value, eq: e.value > 0 ? e.eqv / e.value : 0 }))
  return { mappings, take, byGoal: meta, left: its.reduce((t, i) => t + i.left, 0), extra, extraEq, extraItems }
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
