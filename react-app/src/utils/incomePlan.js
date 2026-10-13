// Monthly retirement income: where the money comes from each month, and how the Income jar stays right.
//
// Stored in the Settings sheet (one JSON value per retirement goal, no new tabs):
//   IncomePlan:<goalId>  { v: 1, start: 'YYYY-MM', day: 1, sources: [{ kind: 'cash' | 'swp', ref, name, amount }] }
//   IncomeLog:<goalId>   [{ m: 'YYYY-MM', ref, amt, bal, at, short? , skip? }]  one line per cash source per month
//   RefillLog:<goalId>   [{ at: 'YYYY-MM-DD', ops: [{ from, to, amount }] }]     one line per "Mark done"
//
// Sources:
//   cash  a savings account or a sweep-in FD (Other investments). The app deducts the amount itself on the pay day
//         (daily background job, or when the app opens), once per month: IncomeLog keeps it from running twice.
//   swp   a liquid fund paying a monthly SWP. Nothing is written: the CAS import brings the real sale. Until then
//         the Income jar shows an estimate (each pay day after the last statement date, with no sale that month).
// Regular FDs are not sources: they sit in Stability and refill Income when they mature (Received).
// The same rules run in the background job (gas-webapp/IncomePlan.js); keep them in step.

export const LOW_MONTHS = 3 // a source this close to empty gets a move suggestion

const pad = (n) => String(n).padStart(2, '0')
export const monthKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
const parseJson = (v, fallback) => {
  if (v && typeof v === 'object') return v
  try { const x = JSON.parse(v || ''); return x ?? fallback } catch { return fallback }
}
export const readIncomePlan = (settings, goalId) => {
  const p = parseJson(settings?.[`IncomePlan:${goalId}`], null)
  return p && Array.isArray(p.sources) ? p : null
}
export const readIncomeLog = (settings, goalId) => parseJson(settings?.[`IncomeLog:${goalId}`], [])
export const readRefillLog = (settings, goalId) => parseJson(settings?.[`RefillLog:${goalId}`], [])

/** Pay days from the plan's start month up to today: month keys whose pay date has come. */
export function payMonths(plan, today = new Date()) {
  if (!plan?.start) return []
  const [y0, m0] = plan.start.split('-').map(Number)
  const day = Math.min(28, Math.max(1, Number(plan.day) || 1))
  const out = []
  for (let y = y0, m = m0; out.length < 600; m++) {
    if (m > 12) { m = 1; y++ }
    const pay = new Date(y, m - 1, day)
    if (pay > today) break
    out.push(`${y}-${pad(m)}`)
  }
  return out
}

/** The cash deductions still to make (the background job applies exactly these). */
export function dueDeductions(plan, log = [], today = new Date()) {
  const done = new Set((log || []).map((e) => `${e.m}|${e.ref}`))
  const due = []
  for (const m of payMonths(plan, today)) for (const s of plan.sources || []) {
    if (s.kind !== 'cash' || !(Number(s.amount) > 0)) continue
    if (!done.has(`${m}|${s.ref}`)) due.push({ m, ref: s.ref, amount: Number(s.amount) })
  }
  return due
}

const isCashType = (inv) => /cash|saving|sweep/i.test(`${inv?.investmentType || ''}`) || inv?.investmentCategory === 'Cash'
const txDate = (t) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(t?.date || '').trim())
  const d = m ? new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])) : new Date(t?.date)
  return isNaN(d) ? null : d
}
const isSale = (t) => String(t?.type || '').toUpperCase() === 'SELL'

/** Everything that can pay the monthly income: savings / sweep-in FD entries, and liquid funds in the Income jar. */
export function incomeSourceOptions({ otherInvestments = [], incomeFunds = [] }) {
  const cash = otherInvestments.filter((i) => i.status !== 'Inactive' && isCashType(i))
    .map((i) => ({ kind: 'cash', ref: i.investmentId, name: i.investmentName || i.investmentType, value: Number(i.currentValue) || 0 }))
  const swp = incomeFunds.filter((f) => !f.isOther)
    .map((f) => ({ kind: 'swp', ref: `${f.portfolioId}::${f.schemeCode || f.fundCode}`, name: f.fundName, value: Number(f.goalValue ?? f.currentValue) || 0, portfolioId: f.portfolioId, schemeCode: f.schemeCode || f.fundCode }))
  return [...cash, ...swp]
}

/** First plan: one source paying the whole monthly amount, savings first, else the biggest liquid fund. */
export function defaultIncomePlan(options, monthly, today = new Date()) {
  const pick = options.filter((o) => o.kind === 'cash').sort((a, b) => b.value - a.value)[0]
    || options.filter((o) => o.kind === 'swp').sort((a, b) => b.value - a.value)[0]
  const start = new Date(today.getFullYear(), today.getMonth() + (today.getDate() > 1 ? 1 : 0), 1)
  return { v: 1, start: monthKey(start), day: 1, sources: pick ? [{ kind: pick.kind, ref: pick.ref, name: pick.name, amount: Math.round(monthly / 100) * 100 }] : [] }
}

/** An SWP source between statements: pay days after the last statement date with no sale of that fund that month. */
export function swpPending(plan, source, transactions = [], today = new Date()) {
  const [pid, code] = String(source.ref).split('::')
  const mine = (transactions || []).filter((t) => t.portfolioId === pid)
  const last = mine.reduce((mx, t) => { const d = txDate(t); return d && (!mx || d > mx) ? d : mx }, null)
  const soldIn = new Set(mine.filter((t) => String(t.fundCode || t.schemeCode) === String(code) && isSale(t)).map((t) => { const d = txDate(t); return d ? monthKey(d) : '' }))
  const day = Math.min(28, Math.max(1, Number(plan.day) || 1))
  return payMonths(plan, today).filter((m) => {
    if (soldIn.has(m)) return false
    const [y, mm] = m.split('-').map(Number)
    return !last || new Date(y, mm - 1, day) > last
  }).length
}

/**
 * The Income jar from the plan's point of view: each source's balance (an estimate for SWPs between
 * statements), months left, reserves (Income money that pays nothing), and the steps / warnings.
 */
export function incomeStatus({ plan, options = [], log = [], transactions = [], monthly = 0, today = new Date() }) {
  const steps = [], warn = [], info = []
  if (!plan || !plan.sources?.length) return { rows: [], reserves: options, steps, warn, info, payMonthly: 0, total: options.reduce((t, o) => t + o.value, 0) }
  const byRef = Object.fromEntries(options.map((o) => [o.ref, o]))
  const rows = plan.sources.map((s) => {
    const o = byRef[s.ref]
    const amount = Number(s.amount) || 0
    if (!o) return { ...s, amount, missing: true, value: 0, months: 0 }
    const pending = s.kind === 'swp' ? swpPending(plan, s, transactions, today) : 0
    const value = Math.max(0, o.value - pending * amount)
    return { ...s, name: o.name || s.name, amount, value, estimated: pending > 0, pending, months: amount > 0 ? value / amount : 99 }
  })
  const used = new Set(plan.sources.map((s) => s.ref))
  const reserves = options.filter((o) => !used.has(o.ref) && o.value > 0).sort((a, b) => b.value - a.value)
  const payMonthly = rows.reduce((t, r) => t + r.amount, 0)
  const total = rows.reduce((t, r) => t + r.value, 0) + reserves.reduce((t, r) => t + r.value, 0)

  // this month's cash deductions that came up short
  const thisMonth = monthKey(today)
  for (const e of log || []) if (e.m === thisMonth && e.short > 0) warn.push(`${byRef[e.ref]?.name || 'A source'} had only ${fmt(e.amt)} on the pay day: ${fmt(e.short)} of this month's income still to pay. Use another source, or refill Income.`)
  for (const e of log || []) if (e.m === thisMonth && e.skip) warn.push(`This month's income was not taken: ${e.skip}.`)

  // a pay-from account shared with other goals: the monthly money leaves the whole account, so the other goals lose too
  for (const r of rows) {
    const o = byRef[r.ref]
    if (o && o.share != null && o.share < 0.995) warn.push(`${r.name} is only ${Math.round(o.share * 100)}% for this goal. The monthly income leaves the whole account, so your other goals lose money too. In Money for goals, give it 100% to this goal, or pay from another account.`)
  }
  for (const r of rows) {
    if (r.missing) { warn.push(`${r.name || 'A source'} is no longer in your investments. Pick another place to pay from.`); continue }
    if (r.amount > 0 && r.months <= LOW_MONTHS) {
      const res = reserves[0]
      if (res) steps.push(r.kind === 'swp'
        ? `${r.name} has ${mo(r.months)} left. Start the SWP from ${res.name}, or move ${fmt(Math.min(res.value, r.amount * 12))} from ${res.name} into it.`
        : `${r.name} has ${mo(r.months)} left. Move ${fmt(Math.min(res.value, r.amount * 12))} from ${res.name} into it.`)
      else warn.push(`${r.name} has ${mo(r.months)} left and nothing else in Income to use. Refill Income from Stability now.`)
    }
  }
  if (monthly > 0 && payMonthly > 0 && Math.abs(payMonthly - monthly) > Math.max(1000, monthly * 0.1)) info.push(`Your plan pays ${fmt(payMonthly)} a month; this goal's expenses are about ${fmt(monthly)}.`)
  if (options.filter((o) => o.kind === 'swp').length > 2) info.push('Tip: one or two liquid funds are simpler to manage than many.')
  return { rows, reserves, steps, warn, info, payMonthly, total }
}

/** Split money going into Income across the pay-from sources, in the same ratio as their monthly amounts. */
export function splitToSources(amount, sources = []) {
  const live = sources.filter((s) => Number(s.amount) > 0)
  const sum = live.reduce((t, s) => t + Number(s.amount), 0)
  if (!sum) return []
  let left = Math.round(amount)
  return live.map((s, i) => {
    const part = i === live.length - 1 ? left : Math.round(amount * Number(s.amount) / sum)
    left -= part
    return { ref: s.ref, kind: s.kind, name: s.name, amount: part }
  })
}

/** Last "Mark done" refill that put money into Income / Stability. */
export function lastRefill(refillLog = [], to) {
  return (refillLog || []).filter((e) => !to || (e.ops || []).some((o) => o.to === to))
    .map((e) => ({ ...e, date: new Date(e.at) })).filter((e) => !isNaN(e.date)).sort((a, b) => b.date - a.date)[0] || null
}

const mo = (m) => { const n = Math.floor(m); return `${n} month${n === 1 ? '' : 's'}` }
function fmt(v) {
  const n = Math.round(Number(v) || 0)
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(2)} L`
  return `₹${n.toLocaleString('en-IN')}`
}
