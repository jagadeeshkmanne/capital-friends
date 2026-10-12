/**
 * One family plan for all goals (instead of switch steps per goal or per portfolio).
 *
 * Compares the equity the goals hold together with the equity their glide paths want together.
 * Inside the band (5 points of the goals' money) there is nothing to do. Otherwise the cheapest moves first:
 *   1. redirect SIPs for the next 6 months (no selling, no tax): from the funds most above your own target
 *   2. (too little equity) invest idle cash into equity funds that are below target
 *   3. last resort, ONE net switch in as few portfolios as possible: sell units of the funds most above
 *      your target, buy a safe (or equity) fund you already hold in the same portfolio
 * Never sells and buys the same kind of fund in two places; locked money (EPF, PPF, NPS, ELSS) is never sold.
 * Funds and amounts are exact (sell in units, buy in ₹), so there is nothing to work out by hand.
 */
export const FAMILY_BAND = 10 // points of the goals' money: smaller drifts fix themselves with new SIPs
const MONTHS = 6
const ceil500 = (v) => Math.ceil(v / 500) * 500
const isLocked = (h) => /elss/i.test(h.category || '') || /\b(elss|tax ?saver)\b/i.test(h.fundName || '')
const navOf = (h) => Number(h.currentNav) || ((Number(h.currentValue) || 0) / (Number(h.units) || 1)) || 0

/**
 * @param plans       buildGoalPlan(..., pool: true).goals
 * @param mfHoldings  all MF holdings (with targetAllocationPct, ongoingSIP)
 * @param included    Set of investment ids in the goals pool
 * @param cashItems   included cash / savings items [{ id, name, value }] (money not needed by the emergency fund)
 * @param eqOf        holding => equity share 0..1
 */
export function familyPlan({ plans, mfHoldings, included, cashItems = [], eqOf, lockedIds = new Set() }) {
  const live = (plans || []).filter((p) => p.has > 0)
  // per goal: the equity it should hold — but locked money (EPF, PPF, NPS) cannot move, so the equity a goal
  // asks for is capped at what it can actually move. A goal with lots of EPF just keeps the rest in equity.
  const per = live.map((p) => {
    const items = p.att?.items || []
    const locked = items.filter((it) => lockedIds.has(it.portfolioId)).reduce((t, it) => t + it.value, 0)
    const want = Math.min(p.has - locked, p.has * (p.eqTarget || 0) / 100)
    const have = p.att?.equity || 0
    return { p, items, gap: have - want }
  })
  const P = live.reduce((t, p) => t + p.has, 0)
  const haveE = live.reduce((t, p) => t + (p.att?.equity || 0), 0)
  const gapAll = per.reduce((t, x) => t + x.gap, 0)
  const out = { P, haveEq: P ? haveE / P * 100 : 0, needEq: P ? (haveE - gapAll) / P * 100 : 0, gap: gapAll, steps: [] }
  if (!(P > 0) || Math.abs(gapAll) / P * 100 < FAMILY_BAND) { out.status = 'ok'; return out }
  const tooMuchEq = gapAll > 0
  // only goals that are off in this direction give money; never another goal's money (e.g. the emergency fund)
  // too little equity is only fixed with money for long goals (6+ years): a near goal is never pushed into
  // equity by selling its safe money — being a bit safe is fine; its new SIP follows its mix
  const givers = per.filter((x) => (tooMuchEq ? x.gap > 0 : x.gap < 0 && (x.p.years ?? 99) > 5))
  const share = {} // holding key -> part of it that belongs to the giving goals (0..1)
  for (const x of givers) for (const it of x.items) if (it.kind === 'mf' && !lockedIds.has(it.portfolioId)) {
    const k = it.portfolioId + '::' + (it.holding.schemeCode || it.holding.fundCode); share[k] = Math.min(1, (share[k] || 0) + (it.fraction || 0))
  }
  const keyOf = (h) => h.portfolioId + '::' + (h.schemeCode || h.fundCode)
  // only what the giving goals are off by can move (never more than the family gap)
  const giveGap = givers.reduce((t, x) => t + Math.abs(x.gap), 0)
  // idle cash that belongs to the giving goals (another goal's cash, e.g. a near goal's, stays where it is)
  const cashOf = {}
  for (const x of givers) for (const it of x.items) if (it.kind === 'other') cashOf[it.portfolioId] = (cashOf[it.portfolioId] || 0) + it.value
  const myCash = cashItems.map((c) => ({ ...c, value: Math.min(c.value, cashOf[c.id] || 0) })).filter((c) => c.value > 0)

  // the pool's funds, with how far each is from YOUR target in its own portfolio
  const pv = {}
  const H = (mfHoldings || []).filter((h) => included.has(h.portfolioId) && Number(h.units) > 0)
  for (const h of H) pv[h.portfolioId] = (pv[h.portfolioId] || 0) + (Number(h.currentValue) || 0)
  const F = H.map((h) => {
    const v = Number(h.currentValue) || 0, t = Number(h.targetAllocationPct) || 0, sh = share[keyOf(h)] || 0
    const cur = pv[h.portfolioId] > 0 ? v / pv[h.portfolioId] * 100 : 0
    return { h, v, mine: v * sh, sh, eq: eqOf(h), sip: (Number(h.ongoingSIP) || 0) * sh, sipAll: Number(h.ongoingSIP) || 0, over: t > 0 ? cur - t : 0, overRs: t > 0 ? Math.max(0, v - t / 100 * pv[h.portfolioId]) * sh : 0, underRs: t > 0 ? Math.max(0, t / 100 * pv[h.portfolioId] - v) : 0 }
  })
  const start = Math.min(Math.abs(gapAll), giveGap)
  let left = start
  const band = FAMILY_BAND / 100 * P
  const fromKind = (f) => (tooMuchEq ? f.eq >= 0.5 : f.eq < 0.5) && f.sh > 0
  const toKind = (f) => (tooMuchEq ? f.eq < 0.5 : f.eq >= 0.5)
  // destinations: never a fund you blocked for SIPs (SIP steps) or lump sums (cash / buy steps)
  const destIn = (pid, mode = 'lump') => F.filter((f) => toKind(f) && !(mode === 'sip' ? f.h.sipRestricted : f.h.lumpsumRestricted) && (!pid || f.h.portfolioId === pid)).sort((a, b) => (b.underRs - a.underRs) || (b.v - a.v))[0] || null
  // 1. redirect SIPs for the next months
  const sipFrom = F.filter((f) => fromKind(f) && f.sip >= 500).sort((a, b) => (b.over - a.over) || (b.sip - a.sip))
  const sipTotal = sipFrom.reduce((t, f) => t + f.sip, 0)
  // SIPs are set per portfolio (split by your targets), so there are no fund-level SIP steps: new money already
  // follows your targets. Only idle cash and, last, one switch.
  if (false && sipTotal >= 500) {
    let monthly = Math.min(sipTotal, ceil500(left / MONTHS))
    const cuts = []
    // cut in steps of ₹500, never more than the goals' share of that SIP
    for (const f of sipFrom) { if (monthly < 500) break; const c = Math.floor(Math.min(monthly, f.sip) / 500) * 500; if (c >= 500) { cuts.push({ f, c }); monthly -= c } }
    const moved = cuts.reduce((t, x) => t + x.c, 0)
    if (moved >= 500) {
      // from / to are the fund's real SIP (what the person sees at the AMC), not the goals' part of it
      for (const { f, c } of cuts) out.steps.push({ t: 'sip-cut', fund: f.h, portfolioId: f.h.portfolioId, from: f.sipAll, to: f.sipAll - c })
      // the money goes to the matching fund in the same portfolio when there is one
      const byDest = {}
      // (same portfolio = same owner); with no such fund there, the step says what kind of fund to start in it
      for (const { f, c } of cuts) { const pid = f.h.portfolioId; const d = destIn(pid, 'sip'); const k = d ? pid + '::' + d.h.schemeCode : pid + '::none'; byDest[k] = byDest[k] || { d, pid, amount: 0 }; byDest[k].amount += c }
      for (const { d, pid, amount } of Object.values(byDest)) out.steps.push({ t: 'sip-add', fund: d?.h || null, portfolioId: pid, from: d?.sipAll || 0, to: (d?.sipAll || 0) + amount, amount, wantSafe: tooMuchEq })
      out.steps.push({ t: 'note', text: `For the next ${MONTHS} months. This moves about ₹${Math.round(moved * MONTHS).toLocaleString('en-IN')}.` })
      left -= moved * MONTHS
    }
  }
  // 2. too little equity: idle cash first
  if (!tooMuchEq && left > band) {
    for (const c of myCash) {
      if (left <= band) break
      const amt = Math.floor(Math.min(c.value, left) / 1000) * 1000
      if (amt < 5000) continue
      const dests = F.filter((f) => f.eq >= 0.5 && !f.h.lumpsumRestricted).sort((a, b) => (b.underRs - a.underRs) || (b.v - a.v)).slice(0, 3)
      if (!dests.length) { out.steps.push({ t: 'lump', from: c, fund: null, amount: amt, wantSafe: false }); left -= amt; continue }
      const W = dests.reduce((t, f) => t + (f.underRs || f.v), 0)
      let rest = amt
      dests.forEach((f, i) => { const a = i === dests.length - 1 ? rest : Math.floor(amt * (f.underRs || f.v) / W / 100) * 100; rest -= a; if (a > 0) out.steps.push({ t: 'lump', from: c, fund: f.h, portfolioId: f.h.portfolioId, amount: a }) })
      left -= amt
    }
  }
  // 3. last resort: one net switch, in as few portfolios as possible
  if (left > band) {
    const ports = Object.keys(pv).map((pid) => ({ pid, v: F.filter((f) => f.h.portfolioId === pid && fromKind(f) && !isLocked(f.h)).reduce((t, f) => t + f.mine, 0) })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v)
    for (const { pid } of ports) {
      if (left <= 500) break
      const src = F.filter((f) => f.h.portfolioId === pid && fromKind(f) && !isLocked(f.h)).sort((a, b) => (b.overRs - a.overRs) || (b.v - a.v))
      const can = src.reduce((t, f) => t + f.mine, 0)
      const sellAll = Math.min(left, can * 0.9)
      const overSum = src.reduce((t, f) => t + f.overRs, 0)
      // buy inside the same portfolio (same owner); if it has no fund of that kind, say what kind to pick there
      const dest = destIn(pid)
      let rest = sellAll
      for (const f of src) {
        if (rest < 500) break
        // first what each fund has above your target, the rest in proportion to its value
        const part = overSum >= sellAll ? f.overRs / overSum : (f.overRs + (sellAll - overSum) * f.mine / can) / sellAll
        const sv = Math.min(f.mine, Math.max(0, sellAll * part), rest)
        if (sv < 500) continue
        const nav = navOf(f.h)
        out.steps.push({ t: 'sell', fund: f.h, portfolioId: pid, value: sv, units: nav > 0 ? sv / nav : null, nav })
        rest -= sv
      }
      const sold = sellAll - rest
      if (sold >= 500) out.steps.push({ t: 'buy', fund: dest?.h || null, portfolioId: pid, value: sold, wantSafe: tooMuchEq })
      left -= sold
    }
  }
  out.status = out.steps.some((x) => x.t !== 'note') ? 'steps' : 'ok'
  out.doable = Math.max(0, start - left) // what the steps above actually move
  out.after = Math.max(0, Math.abs(gapAll) - out.doable) // the rest comes with the goals' new SIPs
  return out
}
