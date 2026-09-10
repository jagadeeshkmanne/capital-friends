import test from 'node:test'
import assert from 'node:assert/strict'
import { buildFundsModel, resolvePortfolioOwners, returnsReason, weightedInflowDate } from './fundsDashboard.js'
import { mfPortfolios, mfHoldings, mfTransactions, investmentAccounts, familyMembers } from '../data/familyData.js'

const today = new Date(2026, 8, 10)
const portfolios = resolvePortfolioOwners(mfPortfolios, investmentAccounts, familyMembers)

test('resolves owners through investment accounts', () => {
  assert.ok(portfolios.length > 0)
  portfolios.forEach((p) => assert.ok(p.ownerName, `${p.portfolioName} has an owner`))
})

test('totals equal the sum of active holdings', () => {
  const m = buildFundsModel({ portfolios, holdings: mfHoldings, transactions: mfTransactions, today })
  const ids = new Set(portfolios.map((p) => p.portfolioId))
  const active = mfHoldings.filter((h) => ids.has(h.portfolioId) && h.units > 0)
  const current = active.reduce((s, h) => s + h.currentValue, 0)
  assert.ok(Math.abs(m.totals.currentValue - current) < 1)
  assert.ok(Math.abs(m.funds.reduce((s, f) => s + f.weight, 0) - 100) < 1e-6)
  assert.ok(Math.abs(m.categories.reduce((s, c) => s + c.value, 0) - current) < 1)
  assert.ok(Math.abs(m.members.reduce((s, c) => s + c.value, 0) - current) < 1)
})

test('per-fund XIRR uses buys as outflows and sells as inflows', () => {
  const m = buildFundsModel({ portfolios, holdings: mfHoldings, transactions: mfTransactions, today })
  const axis = m.funds.find((f) => f.schemeCode === '120465')
  assert.ok(axis, 'focused fund present')
  assert.equal(axis.returnsReason, null)
  assert.ok(Number.isFinite(axis.xirr), 'xirr computed')
  assert.ok(Number.isFinite(axis.cagr), 'cagr computed')
  assert.ok(axis.since instanceof Date)
  // Positive P&L must give a positive XIRR
  if (axis.pl > 0) assert.ok(axis.xirr > 0)
})

test('funds whose recorded buys do not cover the cost basis get no XIRR or CAGR', () => {
  const m = buildFundsModel({ portfolios, holdings: mfHoldings, transactions: mfTransactions, today })
  const nifty = m.funds.find((f) => f.schemeCode === '120716') // one SIP recorded against a 3L holding
  assert.ok(nifty)
  assert.equal(nifty.returnsReason, 'no-history')
  assert.equal(nifty.xirr, null)
  assert.equal(nifty.cagr, null)
  assert.ok(m.totals.unreliableCount >= 1)
  assert.equal(m.totals.xirr, null)
})

test('member filter narrows portfolios and funds', () => {
  const owner = portfolios[0].ownerId
  const mine = portfolios.filter((p) => p.ownerId === owner)
  const all = buildFundsModel({ portfolios, holdings: mfHoldings, transactions: mfTransactions, today })
  const m = buildFundsModel({ portfolios: mine, holdings: mfHoldings, transactions: mfTransactions, today })
  assert.ok(m.totals.currentValue <= all.totals.currentValue)
  m.funds.forEach((f) => f.positions.forEach((pos) => assert.equal(pos.ownerId, owner)))
})

test('empty inputs produce an empty model', () => {
  const m = buildFundsModel({ portfolios: [], holdings: [], transactions: [] })
  assert.equal(m.funds.length, 0)
  assert.equal(m.totals.currentValue, 0)
  assert.equal(m.totals.xirr, null)
})

test('allocation is per portfolio and only surfaced at fund level when unambiguous', () => {
  const m = buildFundsModel({ portfolios, holdings: mfHoldings, transactions: mfTransactions, today })
  m.funds.forEach((f) => {
    f.positions.forEach((pos) => {
      assert.ok(pos.currentAllocPct >= 0 && pos.currentAllocPct <= 100.0001, `${f.fundName} alloc in range`)
      assert.equal(typeof pos.targetAllocPct, 'number')
    })
    if (f.positions.length === 1) assert.equal(f.allocation, f.positions[0])
    else assert.equal(f.allocation, null)
  })
  // Each portfolio's current allocations sum to 100
  const byPortfolio = {}
  m.funds.forEach((f) => f.positions.forEach((pos) => { byPortfolio[pos.portfolioId] = (byPortfolio[pos.portfolioId] || 0) + pos.currentAllocPct }))
  Object.values(byPortfolio).forEach((sum) => assert.ok(Math.abs(sum - 100) < 1e-6))
})

test('history coverage is judged by units when the holding provides them', () => {
  const today = new Date(2026, 8, 10)
  const flows = [{ date: new Date(2023, 0, 1), amount: -50000, units: 100, opening: true }]
  // Amount is far below cost basis (user entered original cost) but units match: trusted
  assert.equal(returnsReason(flows, 90000, today, 100), null)
  // Units do not match: history is missing
  assert.equal(returnsReason(flows, 90000, today, 250), 'no-history')
})

test('switch legs cancel at portfolio level and do not count as fresh money', () => {
  const today = new Date(2026, 8, 10)
  const portfolios = [{ portfolioId: 'P1', portfolioName: 'P1', ownerId: 'M1', ownerName: 'Self', status: 'Active' }]
  const holdings = [{ portfolioId: 'P1', schemeCode: 'B', fundName: 'Fund B - Direct Growth', units: 1000, avgNav: 90, investment: 90000, currentNav: 97, currentValue: 97000 }]
  const transactions = [
    { portfolioId: 'P1', fundCode: 'A', fundName: 'Fund A', type: 'BUY', transactionType: 'INITIAL', date: '2023-09-10', units: 630, price: 100, totalAmount: 63000 },
    { portfolioId: 'P1', fundCode: 'A', fundName: 'Fund A', type: 'SELL', transactionType: 'SWITCH', date: '2026-06-10', units: 630, price: 142.857, totalAmount: 90000 },
    { portfolioId: 'P1', fundCode: 'B', fundName: 'Fund B', type: 'BUY', transactionType: 'SWITCH', date: '2026-06-10', units: 1000, price: 90, totalAmount: 90000 },
  ]
  const m = buildFundsModel({ portfolios, holdings, transactions, today })
  assert.equal(m.totals.netInvested, 63000)
  assert.equal(m.totals.totalGain, 34000)
  assert.equal(m.totals.invested, 90000)
  assert.ok(Math.abs(m.totals.xirr - 0.155) < 0.01, `xirr ${m.totals.xirr}`)
  assert.ok(Math.abs(m.totals.cagr - 0.155) < 0.01, `cagr ${m.totals.cagr}`)
  // The switched-in fund itself is only three months old
  assert.equal(m.funds[0].returnsReason, null)
  assert.ok(m.funds[0].xirr > 0)
})

test('opening balances dated recently do not get annualised', () => {
  const today = new Date(2026, 8, 10)
  const recent = [{ date: new Date(2026, 7, 5), amount: -100000, opening: true }]
  assert.equal(returnsReason(recent, 100000, today), 'opening-balance')
  const old = [{ date: new Date(2023, 7, 5), amount: -100000, opening: true }]
  assert.equal(returnsReason(old, 100000, today), null)
  const newLumpsum = [{ date: new Date(2026, 7, 5), amount: -100000, opening: false }]
  assert.equal(returnsReason(newLumpsum, 100000, today), 'too-new')
  // A recent opening balance that is a minority of buys is tolerated
  const mixed = [
    { date: new Date(2023, 0, 1), amount: -80000, opening: false },
    { date: new Date(2026, 7, 5), amount: -20000, opening: true },
  ]
  assert.equal(returnsReason(mixed, 100000, today), null)
})

test('switches are excluded from total invested even when only one leg is in scope', () => {
  const today = new Date(2026, 8, 10)
  const portfolios = [{ portfolioId: 'P2', portfolioName: 'P2', ownerId: 'M1', ownerName: 'Self', status: 'Active' }]
  const holdings = [{ portfolioId: 'P2', schemeCode: 'B', fundName: 'Fund B', units: 1000, avgNav: 90, investment: 90000, currentNav: 97, currentValue: 97000 }]
  const transactions = [
    { portfolioId: 'P2', fundCode: 'B', fundName: 'Fund B', type: 'BUY', transactionType: 'SWITCH', date: '2026-06-10', units: 1000, price: 90, totalAmount: 90000 },
  ]
  const m = buildFundsModel({ portfolios, holdings, transactions, today })
  assert.equal(m.totals.netInvested, null) // no fresh money recorded in this portfolio
})

test('later buys add to total invested and CAGR uses the amount-weighted start date', () => {
  const today = new Date(2026, 8, 10)
  const portfolios = [{ portfolioId: 'P1', portfolioName: 'P1', ownerId: 'M1', ownerName: 'Self', status: 'Active' }]
  const holdings = [{ portfolioId: 'P1', schemeCode: 'A', fundName: 'Fund A', units: 660, avgNav: 100, investment: 66000, currentNav: 150, currentValue: 99000 }]
  const transactions = [
    { portfolioId: 'P1', fundCode: 'A', fundName: 'Fund A', type: 'BUY', transactionType: 'INITIAL', date: '2023-09-10', units: 630, price: 100, totalAmount: 63000 },
    { portfolioId: 'P1', fundCode: 'A', fundName: 'Fund A', type: 'BUY', transactionType: 'LUMPSUM', date: '2026-03-10', units: 30, price: 100, totalAmount: 3000 },
  ]
  const m = buildFundsModel({ portfolios, holdings, transactions, today })
  assert.equal(m.totals.netInvested, 66000)
  assert.equal(m.totals.totalGain, 33000)
  const w = weightedInflowDate([
    { date: new Date(2023, 8, 10), amount: -63000 }, { date: new Date(2026, 2, 10), amount: -3000 },
  ])
  // weighted start is a little after the first buy, so CAGR is a little above the 3-year figure
  assert.ok(w > new Date(2023, 8, 10) && w < new Date(2023, 11, 1))
  assert.ok(m.totals.cagr > 0.14 && m.totals.cagr < 0.17, `cagr ${m.totals.cagr}`)
  assert.ok(m.totals.xirr > 0.14 && m.totals.xirr < 0.17, `xirr ${m.totals.xirr}`)
})

test('portfolio initial investment overrides opening-balance amounts, matching the sheet', () => {
  const today = new Date(2026, 8, 10)
  // User stated 63,000 originally invested; opening balance recorded post-switch at 79,000 cost
  const portfolios = [{ portfolioId: 'P1', portfolioName: 'P1', ownerId: 'M1', ownerName: 'Self', status: 'Active', initialInvestment: 63000, totalInvestment: 63000 }]
  const holdings = [{ portfolioId: 'P1', schemeCode: 'B', fundName: 'Fund B', units: 1000, avgNav: 79, investment: 79000, currentNav: 97, currentValue: 97000 }]
  const transactions = [
    { portfolioId: 'P1', fundCode: 'B', fundName: 'Fund B', type: 'BUY', transactionType: 'INITIAL', date: '2023-09-10', units: 1000, price: 79, totalAmount: 79000 },
  ]
  const m = buildFundsModel({ portfolios, holdings, transactions, today })
  assert.equal(m.totals.netInvested, 63000)
  assert.equal(m.totals.totalGain, 34000)
  assert.equal(m.totals.invested, 79000)
  assert.ok(Math.abs(m.totals.xirr - 0.155) < 0.01, `xirr ${m.totals.xirr}`)
  assert.ok(Math.abs(m.totals.cagr - 0.155) < 0.01, `cagr ${m.totals.cagr}`)
  // Per-fund figures stay on cost basis
  assert.equal(m.funds[0].invested, 79000)
})
