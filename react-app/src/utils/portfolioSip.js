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
