// The SIP running in each fund, for the goal numbers.
// Each fund's "Ongoing SIP" (column K of the portfolio tab) is the portfolio's SIP target split by the fund
// targets. When no fund target is set yet (e.g. right after a statement import) every fund shows 0, although
// the portfolio has a SIP (the Mutual Funds page shows "SIP Target ₹X/mo") — then the goals said "SIPs running ₹0".
// For such a portfolio only, the portfolio SIP is shared by the funds' current value (funds with SIP stopped are
// skipped). Portfolios whose funds already have an ongoing SIP are left exactly as they are.

/** @returns mfHoldings with ongoingSIP filled in for portfolios that have a SIP target but no fund-level SIP */
export function withPortfolioSip(mfHoldings, mfPortfolios) {
  if (!Array.isArray(mfHoldings) || !Array.isArray(mfPortfolios) || !mfHoldings.length) return mfHoldings
  let changed = false
  const fill = {}
  for (const p of mfPortfolios) {
    const sipTarget = Number(p.sipTarget) || 0
    if (sipTarget < 100 || p.status === 'Inactive') continue
    const hs = mfHoldings.filter((h) => h.portfolioId === p.portfolioId && Number(h.units) > 0)
    if (!hs.length || hs.some((h) => (Number(h.ongoingSIP) || 0) > 0)) continue
    const takers = hs.filter((h) => !h.sipRestricted)
    const total = takers.reduce((t, h) => t + (Number(h.currentValue) || 0), 0)
    if (!takers.length) continue
    for (const h of takers) fill[h.portfolioId + '::' + (h.schemeCode || h.fundCode)] = total > 0 ? sipTarget * (Number(h.currentValue) || 0) / total : sipTarget / takers.length
    changed = true
  }
  if (!changed) return mfHoldings
  return mfHoldings.map((h) => { const v = fill[h.portfolioId + '::' + (h.schemeCode || h.fundCode)]; return v != null ? { ...h, ongoingSIP: Math.round(v) } : h })
}

// Monthly money going into an Other Investment (EPF, PPF, NPS, VPF, Sukanya, RD): saved as
// dynamicFields.monthlyContribution. It counts like a SIP for the goal that investment belongs to.
export const CONTRIB_TYPES_RE = /^(epf|vpf|ppf|nps|sukanya|ssy|recurring deposit|rd)\b/i
export function monthlyContribution(inv) {
  if (!inv) return 0
  let d = inv.dynamicFields
  if (typeof d === 'string') { try { d = JSON.parse(d || '{}') } catch { d = {} } }
  const v = Number(d && d.monthlyContribution) || 0
  return v > 0 ? v : 0
}
/** a goal's monthly money: its share of the MF SIPs + of the monthly contributions to its Other Investments */
export function itemsMonthly(items) {
  return (items || []).reduce((t, it) => {
    if (it.kind === 'mf') return t + (Number(it.holding?.ongoingSIP) || 0) * (it.fraction || 0)   // same as before
    if (it.kind !== 'other') return t
    const c = monthlyContribution(it.holding)
    if (!c) return t
    const cur = Number(it.holding?.currentValue) || 0
    return t + c * (it.fraction ?? (cur > 0 ? Math.min(1, (Number(it.value) || 0) / cur) : 1))   // its share of the investment
  }, 0)
}
