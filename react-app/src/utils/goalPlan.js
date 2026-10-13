import { itemsMonthly } from './portfolioSip'
/**
 * Goal plan: the numbers and steps behind the new Goals view (pages/goals/GoalsPlanPage.jsx).
 *
 * Works on top of goalAttribution.js: a portfolio linked to several goals is split so the near goals
 * own its safe (debt) money first and the far goals own its equity. Every number here is from the
 * user's own funds, the goal's own expected return and the app's glide path. Nothing is recommended
 * from outside: a switch only moves money between funds the goal already holds in that portfolio.
 *
 *   needToday   = what the goal should hold today so that it + the current SIP reaches the target
 *   gap         = have - needToday   (< 0 short, > 0 extra)
 *   addSIP      = extra monthly SIP that closes a short gap by the goal date
 *   lumpToday   = one-time amount that closes it now (= the gap)
 *   switch      = only when the goal's equity is BAND points or more away from its glide path
 *                 sell units (known, the user holds them) -> buy a ₹ amount (units depend on that day's NAV)
 */
import { getRecommendedAllocation, followsBucketPlan } from '../data/glidePath'
import { getRetirementExpenseBasis } from './retirementBuckets'

export const BAND = 5                     // percentage points of equity before a switch is shown
const YEAR_MS = 365.25 * 24 * 60 * 60 * 1000
const SAFE_MAX = 0.2                      // a holding with ≤20% equity counts as a safe (debt) fund
const EQ_MIN = 0.7                        // a holding with ≥70% equity counts as an equity fund

const monthlyRate = (r) => Math.pow(1 + Math.max(0, r), 1 / 12) - 1
const round500 = (x) => Math.ceil(x / 500) * 500

/** Value the goal should have today, given its current SIP keeps running (never below 0). */
export function needToday({ target, years, annualReturn, sip }) {
  if (!(years > 0)) return target
  const rm = monthlyRate(annualReturn), n = Math.round(years * 12)
  const pvTarget = target / Math.pow(1 + annualReturn, years)
  const pvSip = rm > 0 ? sip * (1 - Math.pow(1 + rm, -n)) / rm : sip * n
  return Math.max(0, pvTarget - pvSip)
}

/**
 * Same as needToday, for an amount paid over several years (payYears equal parts, the first on the goal date):
 * each part needs less today because it is spent later. payYears 1 = needToday exactly.
 */
export function needTodayN({ target, years, annualReturn, sip, payYears = 1 }) {
  const n = Math.max(1, Math.round(Number(payYears) || 1))
  if (n === 1) return needToday({ target, years, annualReturn, sip })
  const y = Math.max(0, years || 0)   // on the date: this year's part now, the later parts still need less today
  const part = target / n
  let pvTarget = 0
  for (let k = 0; k < n; k++) pvTarget += part / Math.pow(1 + annualReturn, y + k)
  if (!(y > 0)) return pvTarget
  const rm = monthlyRate(annualReturn), m = Math.round(years * 12)
  const pvSip = rm > 0 ? sip * (1 - Math.pow(1 + rm, -m)) / rm : sip * m
  return Math.max(0, pvTarget - pvSip)
}

/**
 * Spread a goal's extra SIP over the goal's own funds, following the portfolio's target % (for a goal-linked
 * portfolio these are the goal's targets). New money first tops up the funds that are BELOW their target
 * (so drift is fixed without selling), and whatever is left is split by target %.
 * Portfolios without targets: split by today's value. Across portfolios: by how much of the goal sits in each.
 * Rounded to ₹100; funds that would get under ₹500 are left out (their part goes to the others).
 */
export function splitSip({ att, amount, mfHoldings }) {
  if (!(amount > 0)) return []
  const items = (att?.items || []).filter((it) => it.kind === 'mf' && it.value > 0)
  if (!items.length) return []
  const byP = {}
  for (const it of items) (byP[it.portfolioId] = byP[it.portfolioId] || []).push(it)
  const total = items.reduce((t, it) => t + it.value, 0)
  let parts = []
  for (const [pid, its] of Object.entries(byP)) {
    const M = amount * its.reduce((t, it) => t + it.value, 0) / total // this portfolio's part of the new money
    const all = (mfHoldings || []).filter((h) => h.portfolioId === pid)
    const tsum = all.reduce((t, h) => t + (Number(h.targetAllocationPct) || 0), 0)
    if (tsum >= 99 && tsum <= 101) {
      // funds you marked "no SIP" never get new SIP money; the others share it by their targets
      const tg = all.filter((h) => (Number(h.targetAllocationPct) || 0) > 0 && !h.sipRestricted)
      const ts = tg.reduce((t, h) => t + Number(h.targetAllocationPct), 0)
      const V = tg.reduce((t, h) => t + (Number(h.currentValue) || 0), 0)
      const after = V + M
      const gap = tg.map((h) => Math.max(0, (Number(h.targetAllocationPct) / ts) * after - (Number(h.currentValue) || 0)))
      const G = gap.reduce((t, x) => t + x, 0)
      if (G >= M) tg.forEach((h, i) => { if (gap[i] > 0) parts.push({ fund: h, w: M * gap[i] / G }) })
      else {
        const rest = M - G
        tg.forEach((h, i) => parts.push({ fund: h, w: gap[i] + rest * (Number(h.targetAllocationPct) / ts) }))
      }
    } else {
      const ok = its.filter((it) => !it.holding?.sipRestricted)
      const v = ok.reduce((t, it) => t + it.value, 0)
      for (const it of ok) parts.push({ fund: it.holding, w: M * it.value / v })
    }
  }
  const merged = {}
  for (const x of parts) { if (!(x.w > 0)) continue; const k = x.fund.portfolioId + '::' + (x.fund.schemeCode || x.fund.fundCode); merged[k] = merged[k] ? { ...merged[k], w: merged[k].w + x.w } : { ...x } }
  parts = Object.values(merged)
  for (let guard = 0; guard < 20; guard++) {
    const W = parts.reduce((t, x) => t + x.w, 0)
    const small = parts.filter((x) => (x.w / W) * amount < 500)
    if (!small.length || small.length === parts.length) break
    parts = parts.filter((x) => !small.includes(x))
  }
  const W = parts.reduce((t, x) => t + x.w, 0)
  const out = parts.map((x) => ({ fund: x.fund, amount: Math.floor(((x.w / W) * amount) / 100) * 100 })).sort((a, b) => b.amount - a.amount)
  const rest = amount - out.reduce((t, x) => t + x.amount, 0)
  if (out.length) out[0].amount += rest
  return out.filter((x) => x.amount > 0)
}

/** Monthly SIP that grows to `amountToday * (1+r)^years` by the goal date (rounded up to ₹500). */
export function sipForAmount({ amountToday, years, annualReturn }) {
  if (!(amountToday > 0) || !(years > 0)) return 0
  const rm = monthlyRate(annualReturn), n = Math.round(years * 12)
  const fv = amountToday * Math.pow(1 + annualReturn, years)
  const factor = rm > 0 ? (Math.pow(1 + rm, n) - 1) / rm : n
  return round500(fv / factor)
}

/** Value in year `y` if the goal keeps `sip` going at its expected return. */
export function projectValue({ has, sip, annualReturn, years }) {
  if (!(years > 0)) return has
  const rm = monthlyRate(annualReturn), n = Math.round(years * 12)
  return has * Math.pow(1 + annualReturn, years) + (rm > 0 ? sip * (Math.pow(1 + rm, n) - 1) / rm : sip * n)
}

const navOf = (h) => Number(h.currentNav) || ((Number(h.currentValue) || 0) / (Number(h.units) || 1)) || 0

/**
 * Switch steps for one goal. Sources are the goal's own part of each holding (attribution items),
 * destinations are funds the same portfolio already holds. Returns [{ portfolioId, from, to, sellValue, units, buyValue }].
 */
export function switchSteps({ att, targetEq, mfHoldings, eqOf }) {
  const total = att?.total || 0
  if (!(total > 0)) return []
  const actual = att.equity / total
  const diff = actual - targetEq
  if (Math.abs(diff) * 100 < BAND) return []
  const out = []
  let remaining = Math.abs(diff) * total             // equity value to move (out or in)
  const over = diff > 0
  const items = att.items.filter((it) => it.kind === 'mf' && it.value > 0)
    .filter((it) => over ? it.eq > SAFE_MAX : it.eq < EQ_MIN)
    .sort((a, b) => over ? (b.eq - a.eq) || (b.value - a.value) : (a.eq - b.eq) || (b.value - a.value))
  for (const it of items) {
    if (remaining < 500) break
    const pool = (mfHoldings || []).filter((h) => h.portfolioId === it.portfolioId && Number(h.units) > 0)
    const dest = pool.filter((h) => over ? eqOf(h) <= SAFE_MAX : eqOf(h) >= EQ_MIN)
      .sort((a, b) => (Number(b.currentValue) || 0) - (Number(a.currentValue) || 0))[0] || null
    const destEq = dest ? eqOf(dest) : (over ? 0 : 1)
    const perRupee = over ? it.eq - destEq : destEq - it.eq   // equity moved per ₹ switched
    if (perRupee <= 0.05) continue
    const sellValue = Math.min(it.value, remaining / perRupee)
    const nav = navOf(it.holding)
    const maxUnits = (Number(it.holding.units) || 0) * (it.fraction || 1)
    const units = nav > 0 ? Math.min(maxUnits, sellValue / nav) : null
    out.push({ portfolioId: it.portfolioId, from: it.holding, to: dest, sellValue, units, nav, buyValue: sellValue })
    remaining -= sellValue * perRupee
  }
  return out
}

/**
 * The whole plan for a family's active goals.
 * @returns { goals: [planGoal], portfolios: [{ portfolioId, value, equityPct, targetPct, goals }] }
 */
export function buildGoalPlan({ goals, attribution, mfHoldings, mappings, eqOf, now = new Date(), pool = false }) {
  const plans = (goals || []).filter((g) => g.targetDate && Number.isFinite(new Date(g.targetDate).getTime())).map((g) => {
    const years = Math.max(0, (new Date(g.targetDate) - now) / YEAR_MS)
    const r = Number(g.expectedCAGR) || 0.12
    const target = Number(g.targetAmount) || 0
    const att = attribution?.[g.goalId] || { total: 0, equity: 0, items: [] }
    // SIP actually running today = the goal's share of the ongoing SIPs in its linked funds.
    // (goal.monthlyInvestment is the SIP the plan NEEDS, not money that is really going in.)
    // + monthly contributions to its EPF / PPF / NPS / RD (when the person entered them)
    const sip = Math.round(itemsMonthly(att.items))
    const plannedSip = Number(g.monthlyInvestment) || 0
    // pool mode: a goal has only what the pool gives it (the old saved currentValue would count money twice)
    const has = att.total > 0 || pool ? att.total : (Number(g.currentValue) || 0)
    const isRet = g.goalType === 'Retirement'
    const rec = { ...(years > 0 || isRet ? getRecommendedAllocation(g.goalType, years) : { equity: 0 }) }
    const bucketMode = isRet && followsBucketPlan(g.goalType, years)
    const eqNow = att.total > 0 ? Math.round(att.equity / att.total * 100) : null
    // the emergency fund is needed in full today (pool mode); other goals can grow towards their date
    const need = pool && g.goalType === 'Emergency Fund' ? target : needTodayN({ target, years, annualReturn: r, sip, payYears: g.payYears })
    const gap = has - need
    const tol = Math.max(1000, 0.02 * need)
    // pool mode: a goal that already holds its full amount before its date is "achieved" (covered). Its mix still
    // follows its timeline (glide path): a goal 10 years away keeps growing in equity, one 1 year away is safe.
    const achieved = pool && years > 0 && target > 0 && has >= target * 0.98
    const state = years <= 0 ? 'due' : achieved ? 'achieved' : gap < -tol ? 'short' : gap > tol ? 'extra' : 'onplan'
    if (years <= 0 && !isRet) rec.equity = 0 // a retired person's money keeps its bucket mix
    const steps = []
    if (pool) {
      // one family plan does the equity / safe moves; a goal only shows what is its own
      if (state === 'due' && has > 0 && !isRet) steps.push({ t: 'ready' }) // retired: the buckets pay income instead
    } else if (!bucketMode && years > 0 && eqNow !== null) {
      for (const sw of switchSteps({ att, targetEq: rec.equity / 100, mfHoldings, eqOf })) steps.push({ t: 'switch', ...sw })
    }
    if (bucketMode) steps.push({ t: 'buckets' })
    let addSip = 0
    if (state === 'short') {
      addSip = sipForAmount({ amountToday: -gap, years, annualReturn: r })
      // new money goes to the goal's own fund of the right kind: safe fund for a near goal, equity fund for a far one
      const wantEq = rec.equity >= 50
      const split = splitSip({ att, amount: addSip, mfHoldings })
      const sipFund = split.length ? split[0].fund
        : (att.items || []).filter((it) => it.kind === 'mf' && (wantEq ? it.eq >= EQ_MIN : it.eq <= SAFE_MAX)).sort((a, b) => b.value - a.value)[0]?.holding || null
      steps.push({ t: 'sip', amount: addSip, lump: -gap, sipFrom: sip, sipTo: sip + addSip, fund: sipFund, wantEq, split })
    }
    // the monthly SIP this goal needs from today, given what it already holds (0 when it is already covered)
    const sipNeeded = years > 0 ? sipForAmount({ amountToday: Math.max(0, needTodayN({ target, years, annualReturn: r, sip: 0, payYears: g.payYears }) - has), years, annualReturn: r }) : 0
    return { goal: g, plannedSip, sipNeeded, years, yearsLeft: Math.ceil(years - 1e-9), r, sip, target, has, need, gap, state, eqNow, eqTarget: rec.equity, bucketMode, isRet, steps, addSip, lumpToday: state === 'short' ? -gap : 0, att }
  })
  // extra in one goal can pay for another goal's SIP: suggest moving SIP, never more than the goal's own SIP
  const donors = pool ? [] : plans.filter((p) => p.state === 'extra' && p.sip > 0 && p.years > 0)
  for (const rcv of plans.filter((p) => p.addSip > 0).sort((a, b) => a.years - b.years)) {
    for (const d of donors) {
      const free = Math.min(d.sip - (d.moved || 0), sipForAmount({ amountToday: d.gap, years: d.years, annualReturn: d.r }) - (d.moved || 0))
      const take = Math.min(free, rcv.addSip - (rcv.fromOthers || 0))
      if (take < 500) continue
      d.moved = (d.moved || 0) + take; rcv.fromOthers = (rcv.fromOthers || 0) + take
      d.steps.push({ t: 'move', amount: take, to: rcv.goal, sipFrom: d.sip, sipTo: d.sip - d.moved })
      const s = rcv.steps.find((x) => x.t === 'sip'); if (s) (s.from = s.from || []).push({ goal: d.goal, amount: take })
    }
  }
  plans.forEach((p) => {
    const realSteps = p.steps.filter((s) => s.t !== 'buckets')
    p.status = p.state === 'short' && p.years <= 3 ? 'off' : realSteps.length ? 'step' : 'good'
    p.road = goalRoad(p)
  })
  plans.sort((a, b) => a.years - b.years)
  return { goals: plans, portfolios: portfolioView({ plans, mappings }) }
}

/** One portfolio can carry many goals: its equity vs what its goals need together. */
function portfolioView({ plans, mappings }) {
  const byP = {}
  for (const p of plans) for (const it of p.att.items || []) {
    const e = (byP[it.portfolioId] = byP[it.portfolioId] || { portfolioId: it.portfolioId, value: 0, equity: 0, need: 0, goals: {} })
    e.value += it.value; e.equity += it.value * it.eq
    const gg = (e.goals[p.goal.goalId] = e.goals[p.goal.goalId] || { goal: p.goal, value: 0, targetPct: p.eqTarget })
    gg.value += it.value
  }
  return Object.values(byP).map((e) => {
    const goals = Object.values(e.goals).sort((a, b) => a.targetPct - b.targetPct)
    const targetPct = e.value > 0 ? Math.round(goals.reduce((s, g) => s + g.value * g.targetPct, 0) / e.value) : null
    return { portfolioId: e.portfolioId, value: e.value, equityPct: e.value > 0 ? Math.round(e.equity / e.value * 100) : null, targetPct, goals, linkedGoals: (mappings || []).filter((m) => m.portfolioId === e.portfolioId).length }
  }).filter((x) => x.value > 0).sort((a, b) => b.value - a.value)
}

/**
 * Year-by-year stops for one goal. Only years where money moves are returned; quiet years are folded.
 * kinds: today, safer, ease, bucket (range), goal, spend
 */
export function goalRoad(p, nowYear = new Date().getFullYear()) {
  const g = p.goal, endYear = new Date(g.targetDate).getFullYear()
  const sip = p.sip + (p.addSip || 0) - (p.moved || 0)
  const stops = [{ k: 'today', y: nowYear, yl: Math.max(0, endYear - nowYear), v: p.has, eq: p.eqTarget }]
  let held = p.eqTarget, quiet = []
  const flush = () => { if (quiet.length) { stops.push({ k: 'quiet', y0: quiet[0].y, y: quiet[quiet.length - 1].y, eq0: quiet[0].eq, eq: quiet[quiet.length - 1].eq }); quiet = [] } }
  const val = (y) => projectValue({ has: p.has, sip, annualReturn: p.r, years: y - nowYear })
  let bucket = null
  if (p.isRet) {
    const exp = getRetirementExpenseBasis(g)
    bucket = { monthly: exp.monthlyExpense, income: exp.monthlyExpense * 24, stability: exp.monthlyExpense * 60 }
  }
  for (let y = nowYear + 1; y <= endYear; y++) {
    const yl = endYear - y
    if (y === endYear) { flush(); stops.push({ k: 'goal', y, yl: 0, v: Math.max(val(y), 0), target: p.target, bucket }); break }
    if (p.isRet && yl <= 5) {
      flush()
      if (!stops.find((s) => s.k === 'bucket')) stops.push({ k: 'bucket', y0: y, y: endYear - 1, yl, v: val(endYear - 1), quarters: (endYear - y) * 4, bucket })
      continue
    }
    const eq = years2eq(g, yl)
    if (p.isRet && yl === 10) { flush(); stops.push({ k: 'ease', y, yl, v: val(y), eq: 75, eq0: 85 }); continue }
    if (held - eq >= BAND) { flush(); stops.push({ k: 'safer', y, yl, v: val(y), eq0: held, eq, amount: val(y) * (held - eq) / 100 }); held = eq; continue }
    quiet.push({ y, eq })
  }
  if (p.isRet) stops.push({ k: 'spend', y: endYear + 1, bucket })
  return stops
}
const years2eq = (g, yl) => getRecommendedAllocation(g.goalType, Math.max(0.01, yl)).equity
