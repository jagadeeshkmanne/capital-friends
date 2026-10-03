// Sample data for the Retirement Buckets demo ("Try with sample data").
// Everything here lives only in the browser page: nothing is sent to the
// server and the user's real goals, funds and transactions are never touched.
// Dates are relative to today so the situations stay valid over time.

export const DEMO_SCENARIOS = {
  good: { label: 'Good year', note: 'Retired a year ago. Income has about 1 year left and growth funds are near their high.', b1: 600000, b2: 3000000, nav: 98, small: 37, retiredMonthsAgo: 12 },
  down: { label: 'Bad year', note: 'Market has fallen about 28%. Growth is not sold; Stability pays Income.', b1: 600000, b2: 3000000, nav: 72, small: 26, retiredMonthsAgo: 12 },
  recov: { label: 'Recovery year', note: 'Market is back near its high after a fall. Growth refills Income and tops Stability back up.', b1: 600000, b2: 1800000, nav: 97, small: 36, retiredMonthsAgo: 12 },
  floor: { label: 'Long fall', note: 'Market still down and Stability is close to its 2-year minimum.', b1: 600000, b2: 1400000, nav: 74, small: 27, retiredMonthsAgo: 12 },
  split: { label: 'Two portfolios', note: 'Equity funds in one portfolio, liquid and debt funds in another: the refill is a cross-portfolio switch.', b1: 600000, b2: 3000000, nav: 98, small: 37, retiredMonthsAgo: 12, split: true },
  notdue: { label: 'Not due yet', note: 'Mid-year: Income still has about 1.5 years, so nothing to do until the yearly date.', b1: 900000, b2: 3000000, nav: 99, small: 38, retiredMonthsAgo: 16 },
  build: { label: '2.5 years to retire', note: 'Almost nothing in Income or Stability yet. Instead of moving everything at once, one small step this quarter.', b1: 20000, b2: 50000, nav: 98, small: 37, retireInMonths: 30 },
  buildwait: { label: '2.5 years, market down', note: 'Same goal, but the market is 28% down: this quarter is skipped.', b1: 20000, b2: 50000, nav: 72, small: 26, retireInMonths: 30 },
  pre: { label: '9 years to retire', note: 'Retirement is far away: the page shows today’s split, the equity check and when building starts.', b1: 0, b2: 1063000, nav: 99, small: 38, retireInMonths: 111, growthScale: 0.37 },
}

export const DEMO_GOAL_ID = 'DEMO-RETIREMENT'

function monthsFromToday(months) {
  const d = new Date()
  d.setMonth(d.getMonth() + months)
  return d.toISOString().split('T')[0]
}

export function buildDemoData(key) {
  const S = DEMO_SCENARIOS[key] || DEMO_SCENARIOS.good
  const targetDate = S.retireInMonths ? monthsFromToday(S.retireInMonths) : monthsFromToday(-S.retiredMonthsAgo)
  const goal = {
    goalId: DEMO_GOAL_ID,
    goalName: 'Sample retirement',
    goalType: 'Retirement',
    isActive: true,
    familyMemberId: 'DEMO',
    monthlyExpenses: 50000,
    expectedInflation: 0.06,
    createdDate: monthsFromToday(-12),
    targetDate,
    targetAmount: 20000000,
  }
  // Sample bucket sizes are given at today's ₹50,000; scale them by one year of
  // inflation so the jars show round numbers (e.g. 1.0 yr) at this year's spending.
  const f = S.retireInMonths ? 1 : 1.06
  const b1 = S.b1 * f
  const b2 = S.b2 * f
  const debtPf = S.split ? 'DEMO-P2' : 'DEMO-P1'
  const g = S.growthScale || 1
  const fund = (portfolioId, code, name, category, value, nav, ath) => ({
    portfolioId, schemeCode: code, fundCode: code, fundName: `${name} - Direct Plan - Growth`, category,
    units: value / nav, currentNav: nav, currentValue: value, avgNav: nav * 0.8, investment: value * 0.8,
    athNav: ath, belowATHPct: ath > 0 ? Math.max(0, (ath - nav) / ath * 100) : 0, targetAllocationPct: 0,
  })
  return {
    goalList: [goal],
    goalPortfolioMappings: S.split
      ? [{ goalId: DEMO_GOAL_ID, portfolioId: 'DEMO-P1', allocationPct: 100 }, { goalId: DEMO_GOAL_ID, portfolioId: 'DEMO-P2', allocationPct: 100 }]
      : [{ goalId: DEMO_GOAL_ID, portfolioId: 'DEMO-P1', allocationPct: 100 }],
    mfHoldings: [
      fund(debtPf, 'DEMO-L1', 'Sample Liquid Fund', 'Liquid', b1, 1450.2, 1450.2),
      fund(debtPf, 'DEMO-H1', 'Sample Balanced Advantage Fund', 'Hybrid', b2 * 0.6, 72.4, 74),
      fund(debtPf, 'DEMO-H2', 'Sample Corporate Bond Fund', 'Debt', b2 * 0.4, 31.8, 31.8),
      fund('DEMO-P1', 'DEMO-E1', 'Sample Flexi Cap Fund', 'Equity', g * 7000000 * S.nav / 100, S.nav * 0.9, 90),
      fund('DEMO-P1', 'DEMO-E2', 'Sample Nifty 500 Index Fund', 'Index', g * 4000000 * S.nav / 100, S.nav * 0.25, 25),
      fund('DEMO-P1', 'DEMO-E3', 'Sample Small Cap Fund', 'Equity', g * 800000 * S.small / 40, S.small * 4.2, 168),
    ],
    mfPortfolios: S.split
      ? [{ portfolioId: 'DEMO-P1', portfolioName: 'PFL-Sample Equity', status: 'Active', ownerId: 'DEMO', ownerName: 'Sample' },
        { portfolioId: 'DEMO-P2', portfolioName: 'PFL-Sample Debt', status: 'Active', ownerId: 'DEMO', ownerName: 'Sample' }]
      : [{ portfolioId: 'DEMO-P1', portfolioName: 'PFL-Sample Retirement', status: 'Active', ownerId: 'DEMO', ownerName: 'Sample' }],
    mfTransactions: [],
    assetAllocations: [],
  }
}

// Apply a switch or redemption to the sample holdings (in memory only).
function moveUnits(holdings, portfolioId, fundCode, deltaUnits) {
  return holdings.map(h => h.portfolioId === portfolioId && h.schemeCode === fundCode
    ? { ...h, units: Math.max(0, h.units + deltaUnits), currentValue: Math.max(0, h.units + deltaUnits) * h.currentNav }
    : h)
}

export function applyDemoSwitch(data, s) {
  const amount = Number(s.units) * Number(s.fromPrice)
  let holdings = moveUnits(data.mfHoldings, s.fromPortfolioId, s.fromFundCode, -Number(s.units))
  holdings = moveUnits(holdings, s.toPortfolioId, s.toFundCode, amount / Number(s.toPrice))
  const d = s.date ? new Date(`${s.date}T00:00:00`) : new Date()
  const date = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
  return {
    ...data,
    mfHoldings: holdings,
    mfTransactions: [...data.mfTransactions, { transactionType: 'SWITCH', type: 'SELL', notes: s.notes || '', date }],
  }
}

export function applyDemoRedeem(data, r) {
  return { ...data, mfHoldings: moveUnits(data.mfHoldings, r.portfolioId, r.fundCode, -Number(r.units)) }
}
