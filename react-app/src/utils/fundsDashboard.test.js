import test from 'node:test'
import assert from 'node:assert/strict'
import { buildFundsModel, resolvePortfolioOwners, returnsReason } from './fundsDashboard.js'
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
