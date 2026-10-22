import { monthlyContribution } from './portfolioSip'
import { isClosedPortfolio } from './mfClosed'
/**
 * "To do this month" for the Goals page: one list of exact steps (withdraw / SIP / buy / sell), worked out
 * from the goals plan (buildGoalPlan, pool mode) and the one family plan (familyPlan). Nothing to enter:
 * the person only follows the steps.
 *
 *   ready   a goal's date has come: withdraw its money (units per fund), then Withdrawn / More time / Not needed
 *   short   the goals together are short: raise ONE portfolio's SIP by ₹X, or invest ₹Y once split by the
 *           portfolio's own fund targets (the goal that is short gets it)
 *   cash    idle cash into equity funds (from the family plan)
 *   switch  last resort, sell units of one fund and buy another in the same portfolio (from the family plan)
 *
 * banner   only when today's SIPs and investments cannot reach the goals: the extra SIP the goals need
 */
import { splitSip } from './goalPlan'

const isLocked = (h) => /elss/i.test(h?.category || '') || /\b(elss|tax ?saver)\b/i.test(h?.fundName || '')
const fkey = (h) => `${h?.portfolioId}::${h?.schemeCode || h?.fundCode || h?.fundName}`
const navOf = (h) => Number(h.currentNav) || ((Number(h.currentValue) || 0) / (Number(h.units) || 1)) || 0

/** The portfolio a short goal should add money to: the MF portfolio it already uses most, else one owned by
 *  the goal's member, else the biggest included one. */
function portfolioFor(p, { mfHoldings, poolItems, mfPortfolios }) {
  const byP = {}
  for (const it of p.att?.items || []) if (it.kind === 'mf') byP[it.portfolioId] = (byP[it.portfolioId] || 0) + it.value
  const used = Object.entries(byP).sort((a, b) => b[1] - a[1])[0]
  if (used) return used[0]
  // never a closed portfolio (everything sold): it would ask to buy back into sold funds. New ones with planned funds stay.
  const mf = (poolItems || []).filter((i) => i.type === 'MF' && i.included && (mfHoldings || []).some((h) => h.portfolioId === i.id)
    && !isClosedPortfolio((mfPortfolios || []).find((p) => p.portfolioId === i.id), mfHoldings))
  const who = String(p.goal.familyMemberName || '').trim().toLowerCase()
  const own = mf.filter((i) => who && String(i.owner || '').trim().toLowerCase() === who).sort((a, b) => b.value - a.value)[0]
  return (own || mf.sort((a, b) => b.value - a.value)[0])?.id || null
}

export function goalTodo({ plans, family, poolItems = [], mfHoldings = [], mfPortfolios = [], otherInvList = [] }) {
  const steps = []
  const included = new Set(poolItems.filter((i) => i.included).map((i) => i.id))
  const portSip = (pid) => Number((mfPortfolios || []).find((x) => x.portfolioId === pid)?.sipTarget) || 0

  // 1. goals whose date has come (not retirement: a retired goal keeps paying through its buckets)
  for (const p of plans || []) {
    if (p.state !== 'due' || p.isRet || !(p.has > 0)) continue
    const rows = (p.att?.items || []).filter((it) => it.value > 0.5).map((it) => {
      // holding: the fund / stock / investment itself, so the withdraw window can record what was taken
      if (it.kind === 'mf') { const u = (Number(it.holding.units) || 0) * (it.fraction ?? 1); return { kind: 'mf', name: it.holding.fundName, portfolioId: it.portfolioId, units: u, all: (it.fraction ?? 1) > 0.999, value: it.value, holding: it.holding } }
      if (it.kind === 'stock') return { kind: 'stock', name: it.holding.symbol || it.holding.stockName, portfolioId: it.portfolioId, units: (Number(it.holding.quantity) || 0) * (it.fraction ?? 1), value: it.value, holding: it.holding }
      return { kind: 'other', name: it.holding?.investmentName || it.holding?.investmentType || 'Investment', value: it.value, holding: it.holding }
    }).sort((a, b) => b.value - a.value)
    steps.push({ t: 'ready', goal: p.goal, has: p.has, rows })
  }

  // 2. the goals together are short (in pool mode a goal is short only when the family is short)
  const short = (plans || []).filter((p) => p.state === 'short' && -p.gap >= 1000 && p.years > 0)
  let extraSip = 0
  const parts = []
  for (const p of short) {
    const lump = Math.round(-p.gap / 100) * 100
    const sip = Math.max(0, Math.ceil(((p.sipNeeded || 0) - (p.sip || 0)) / 100) * 100)
    extraSip += sip
    const pid = portfolioFor(p, { mfHoldings, poolItems, mfPortfolios })
    const hs = (mfHoldings || []).filter((h) => h.portfolioId === pid && !h.lumpsumRestricted)
    const att = { items: hs.map((h) => ({ kind: 'mf', portfolioId: pid, holding: h, value: Number(h.currentValue) || 1 })) }
    const buys = pid && lump > 0 ? splitSip({ att, amount: lump, mfHoldings: hs }) : []
    parts.push({ goal: p.goal, gap: -p.gap, sip, lump, portfolioId: pid, buys })
  }
  // one step for all goals together (SIPs are per portfolio, and the money is shared by all goals)
  if (parts.length) {
    const ports = {}
    for (const x of parts) { const k = x.portfolioId || ''; (ports[k] = ports[k] || { portfolioId: x.portfolioId, sip: 0, sipFrom: x.portfolioId ? portSip(x.portfolioId) : 0 }).sip += x.sip }
    const funds = {}
    for (const x of parts) for (const b of x.buys) { const k = b.fund.portfolioId + '::' + (b.fund.schemeCode || b.fund.fundCode); (funds[k] = funds[k] || { fund: b.fund, portfolioId: b.fund.portfolioId, amount: 0 }).amount += b.amount }
    steps.push({ t: 'short', goals: parts.map((x) => x.goal), gap: parts.reduce((t, x) => t + x.gap, 0), sip: parts.reduce((t, x) => t + x.sip, 0), lump: parts.reduce((t, x) => t + x.lump, 0),
      sipRows: Object.values(ports).filter((r) => r.sip > 0), buys: Object.values(funds).sort((a, b) => b.amount - a.amount), parts })
  }

  // 3. + 4. the family plan's moves (idle cash first, then one switch)
  if (family?.status === 'steps') {
    const lumps = family.steps.filter((s) => s.t === 'lump')
    const byCash = {}
    for (const s of lumps) { const k = s.from?.id || 'cash'; (byCash[k] = byCash[k] || { from: s.from, rows: [] }).rows.push(s) }
    for (const g of Object.values(byCash)) steps.push({ t: 'cash', from: g.from, rows: g.rows, total: g.rows.reduce((t, r) => t + r.amount, 0) })
    const byPort = {}
    for (const s of family.steps.filter((x) => x.t === 'sell' || x.t === 'buy')) (byPort[s.portfolioId] = byPort[s.portfolioId] || { sells: [], buys: [] })[s.t === 'sell' ? 'sells' : 'buys'].push(s)
    for (const [pid, g] of Object.entries(byPort)) if (g.sells.length) steps.push({ t: 'switch', portfolioId: pid, sells: g.sells.map((s) => ({ ...s, units: s.units ?? (navOf(s.fund) ? s.value / navOf(s.fund) : null) })), buys: g.buys, total: g.sells.reduce((t, s) => t + s.value, 0), toSafe: !!g.buys[0]?.wantSafe })
  }

  // value each fund is already sold for by the steps above (so two steps never sell the same units twice)
  const sold = {}
  for (const st of steps.filter((x) => x.t === 'switch')) for (const r of st.sells) sold[fkey(r.fund)] = (sold[fkey(r.fund)] || 0) + (r.value || 0)

  // 5. a goal within 5 years holding far more equity than its glide path wants (the family total can look fine
  //    while one near goal sits in equity): move that part to safe money, inside the same portfolio
  for (const p of plans || []) {
    if (p.isRet || p.state === 'due' || !(p.years > 0) || p.years > 5 || p.eqNow == null) continue
    const over = p.eqNow - p.eqTarget
    const amount = Math.round(((over / 100) * p.has) / 1000) * 1000
    if (over <= 20 || amount < 25000) continue
    // never ELSS (locked 3 years), and never units another step on this page already sells
    const eqMf = (p.att?.items || []).filter((it) => it.kind === 'mf' && it.eq >= 0.65 && it.value > 0.5 && !isLocked(it.holding)).sort((a, b) => b.value - a.value)
    let left = amount
    const sells = []
    for (const it of eqMf) {
      if (left < 1000) break
      const free = Math.min(it.value, (Number(it.holding.currentValue) || 0) - (sold[fkey(it.holding)] || 0))
      const v = Math.min(left, free)
      if (v < 1000) continue
      sold[fkey(it.holding)] = (sold[fkey(it.holding)] || 0) + v
      const nav = navOf(it.holding)
      sells.push({ fund: it.holding, portfolioId: it.portfolioId, value: v, units: nav ? v / nav : null, all: v >= (Number(it.holding.currentValue) || 0) - 1 })
      left -= v
    }
    if (!sells.length) continue
    // buy: a debt fund already in that portfolio (from any goal's money), else one of your choice
    const pid = sells[0].portfolioId
    const debt = (plans || []).flatMap((q) => q.att?.items || []).filter((it) => it.kind === 'mf' && it.portfolioId === pid && it.eq < 0.2 && !it.holding?.lumpsumRestricted).sort((a, b) => b.value - a.value)[0]
    steps.push({ t: 'protect', goal: p.goal, portfolioId: pid, eqNow: p.eqNow, eqTarget: p.eqTarget, years: p.years, total: sells.reduce((t, x) => t + x.value, 0), sells, buy: debt?.holding || null })
  }

  // banner: today's SIPs + investments cannot reach the goals
  const runningSip = Math.round((mfHoldings || []).filter((h) => included.has(h.portfolioId) && Number(h.units) > 0).reduce((t, h) => t + (Number(h.ongoingSIP) || 0), 0))
  // a small top-up is just a step; the banner is for SIPs that clearly can't reach the goals
  const banner = short.length && extraSip >= Math.max(5000, runningSip * 0.25) ? { runningSip, extraSip, needSip: runningSip + extraSip, shortBy: short.reduce((t, p) => t - p.gap, 0) } : null
  // monthly contributions to EPF / PPF / NPS / RD that are in Money for goals (shown next to the SIPs)
  const runningContrib = Math.round((otherInvList || []).filter((i) => included.has(i.investmentId)).reduce((t, i) => t + monthlyContribution(i), 0))
  return { steps, banner, runningSip, runningContrib }
}
