// Shared return-metric helpers for mutual fund holdings.

const MS_PER_YEAR = 365.25 * 86400000

// Parse date string (handles dd/MM/yyyy from GAS, ISO, and Date objects)
export function parseDate(d) {
  if (!d) return null
  if (d instanceof Date) return isNaN(d.getTime()) ? null : d
  const s = String(d)
  const ddmm = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (ddmm) return new Date(Number(ddmm[3]), Number(ddmm[2]) - 1, Number(ddmm[1]))
  const parsed = new Date(s)
  return isNaN(parsed.getTime()) ? null : parsed
}

export function yearsBetween(from, to = new Date()) {
  if (!from) return 0
  return (to - from) / MS_PER_YEAR
}

// XIRR — Newton-Raphson on cash flows [{ date: Date, amount: number }]
// Outflows (purchases) are negative, inflows (redemptions, terminal value) positive.
// Returns a decimal rate (0.12 = 12%) or null when it cannot converge.
export function computeXIRR(flows) {
  const cashFlows = (flows || []).filter((cf) => cf.date && Number.isFinite(cf.amount)).sort((a, b) => a.date - b.date)
  if (cashFlows.length < 2) return null
  if (!cashFlows.some((cf) => cf.amount < 0) || !cashFlows.some((cf) => cf.amount > 0)) return null
  const d0 = cashFlows[0].date
  const days = cashFlows.map((cf) => (cf.date - d0) / MS_PER_YEAR)
  if (days[days.length - 1] < 1 / 365) return null
  const f = (r) => cashFlows.reduce((s, cf, i) => s + cf.amount / Math.pow(1 + r, days[i]), 0)
  const df = (r) => cashFlows.reduce((s, cf, i) => s + (-days[i] * cf.amount) / Math.pow(1 + r, days[i] + 1), 0)
  let rate = 0.1
  for (let i = 0; i < 100; i++) {
    const fVal = f(rate)
    const dfVal = df(rate)
    if (Math.abs(dfVal) < 1e-10) break
    const newRate = rate - fVal / dfVal
    if (!Number.isFinite(newRate)) return null
    if (Math.abs(newRate - rate) < 1e-7) return newRate
    rate = newRate
    if (rate < -0.99) return null
  }
  return Math.abs(f(rate)) < 1 ? rate : null
}

// Point-to-point CAGR from the first purchase. Returns decimal or null.
// Needs at least ~5 weeks of history to be meaningful.
export function computeCAGR(invested, current, fromDate, toDate = new Date()) {
  if (!(invested > 0) || !(current > 0) || !fromDate) return null
  const years = yearsBetween(fromDate, toDate)
  if (years < 0.1) return null
  return Math.pow(current / invested, 1 / years) - 1
}
