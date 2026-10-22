// A closed mutual fund portfolio: every fund in it is sold (no fund with units left) and it has a past, a realized
// profit or loss. It is kept for that history: realized P&L, total gain and XIRR count it. It is left out of
// everything about what is held today: portfolio lists and counts, leaderboards, goals, pickers, the daily email.
// A new portfolio with only planned funds has no realized P&L, so it is not closed.
// The same rule is in gas-webapp/EmailReports.js (mfClosed_): change both together.
// A portfolio with a target set for any fund (planned to buy back) stays open too. So does one whose funds didn't load
// (no rows), and a new one with an Initial Investment typed in but nothing bought yet (the sheet's realized P&L is then
// minus that amount). When its transactions are given, a closed portfolio must also have at least one sale.
export function isClosedPortfolio(p, holdings, txns) {
  if (!p) return false
  const mine = (holdings || []).filter((h) => h.portfolioId === p.portfolioId)
  if (!mine.length) return false
  if (mine.some((h) => Number(h.units) > 0 || Number(h.targetAllocationPct) > 0)) return false
  if (Math.abs(Number(p.realizedPL) || 0) < 1) return false
  const initial = Number(p.initialInvestment) || 0
  if (initial > 0 && Math.abs((Number(p.totalInvestment) || 0) - initial) < 1) return false
  if (txns && !txns.some((t) => t.portfolioId === p.portfolioId && t.type === 'SELL')) return false
  return true
}

/** The portfolios that are not closed. */
export const openPortfolios = (portfolios, holdings, txns) => (portfolios || []).filter((p) => !isClosedPortfolio(p, holdings, txns))
