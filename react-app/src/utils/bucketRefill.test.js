import test from 'node:test'
import assert from 'node:assert/strict'
import { assessGrowthMarket, buildBucketRefillPlan, refillSchedule } from './bucketRefill.js'

// ₹50,000 a month (no inflation): income target ₹12L, stability ₹30L, stability floor ₹12L.
const goal = {
  goalId: 'RET-1',
  goalName: 'Retirement',
  monthlyExpenses: 50000,
  expectedInflation: 0,
  createdDate: '2025-01-15T00:00:00.000Z',
  targetDate: '2025-01-15T00:00:00.000Z',
  targetAmount: 20000000, // ₹2 Cr target, corpus below is smaller on purpose
}
const base = {
  goal,
  mappings: [{ goalId: 'RET-1', portfolioId: 'P1', allocationPct: 100 }],
  portfolios: [{ portfolioId: 'P1', portfolioName: 'PFL-Retirement' }],
}
const ON_REFILL_DATE = new Date('2027-01-20T00:00:00.000Z')
const MID_YEAR = new Date('2027-07-01T00:00:00.000Z')

function holdings({ b1, b2, b3, nav = 100, ath = 100, extraGrowth }) {
  const list = [
    { portfolioId: 'P1', schemeCode: 'L1', fundName: 'Liquid Fund', category: 'Liquid', units: b1 / 10, currentNav: 10, currentValue: b1 },
    { portfolioId: 'P1', schemeCode: 'H1', fundName: 'Balanced Advantage Fund', category: 'Balanced Advantage', units: b2 / 20, currentNav: 20, currentValue: b2 },
    { portfolioId: 'P1', schemeCode: 'E1', fundName: 'Flexi Cap Fund', category: 'Flexi Cap', units: b3 / nav, currentNav: nav, currentValue: b3, athNav: ath },
  ]
  return extraGrowth ? [...list, extraGrowth] : list
}

const amountOf = (plan, id) => Math.round(plan.operations.find(op => op.id === id)?.fundedAmount || 0)
const ids = plan => plan.operations.map(op => op.id)

test('good market, stability full: growth refills income directly, stability untouched', () => {
  const plan = buildBucketRefillPlan({ ...base, holdings: holdings({ b1: 600000, b2: 3000000, b3: 11800000, nav: 98 }), planDate: ON_REFILL_DATE })
  assert.equal(plan.market.status, 'good')
  assert.deepEqual(ids(plan), ['b3-to-b1'])
  assert.equal(amountOf(plan, 'b3-to-b1'), 600000)
  assert.equal(plan.status, 'due')
})

test('underfunded corpus does not block the refill, it only warns', () => {
  const plan = buildBucketRefillPlan({ ...base, holdings: holdings({ b1: 600000, b2: 3000000, b3: 3000000, nav: 99 }), planDate: ON_REFILL_DATE })
  assert.equal(amountOf(plan, 'b3-to-b1'), 600000)
  assert.ok(plan.warnings.some(w => w.code === 'high-withdrawal'))
})

test('crash: stability refills income, growth is not sold', () => {
  const plan = buildBucketRefillPlan({ ...base, holdings: holdings({ b1: 600000, b2: 3000000, b3: 8000000, nav: 70 }), planDate: ON_REFILL_DATE })
  assert.equal(plan.market.status, 'down')
  assert.deepEqual(ids(plan), ['b2-to-b1-down'])
  assert.equal(amountOf(plan, 'b2-to-b1-down'), 600000)
  assert.equal(plan.operations.some(op => op.from === 'b3'), false)
})

test('recovery year: growth refills income and tops stability back to 5 years', () => {
  const plan = buildBucketRefillPlan({ ...base, holdings: holdings({ b1: 600000, b2: 1800000, b3: 11000000, nav: 96 }), planDate: ON_REFILL_DATE })
  assert.deepEqual(ids(plan), ['b3-to-b1', 'b3-to-b2'])
  assert.equal(amountOf(plan, 'b3-to-b1'), 600000)
  assert.equal(amountOf(plan, 'b3-to-b2'), 1200000)
  assert.equal(Math.round(plan.after.b2), 3000000)
})

test('long fall: stability stops at its 2-year floor and the plan warns', () => {
  const plan = buildBucketRefillPlan({ ...base, holdings: holdings({ b1: 600000, b2: 1400000, b3: 8000000, nav: 75 }), planDate: ON_REFILL_DATE })
  assert.equal(amountOf(plan, 'b2-to-b1-down'), 200000)
  const warning = plan.warnings.find(w => w.code === 'stability-floor')
  assert.ok(warning)
  assert.equal(Math.round(warning.amount), 400000)
})

test('good market: stability extra above 5 years is used before selling growth', () => {
  const plan = buildBucketRefillPlan({ ...base, holdings: holdings({ b1: 600000, b2: 3300000, b3: 11800000, nav: 100 }), planDate: ON_REFILL_DATE })
  assert.deepEqual(ids(plan), ['b2-to-b1', 'b3-to-b1'])
  assert.equal(amountOf(plan, 'b2-to-b1'), 300000)
  assert.equal(amountOf(plan, 'b3-to-b1'), 300000)
})

test('no all-time-high data: growth is protected and the plan warns', () => {
  const plan = buildBucketRefillPlan({ ...base, holdings: holdings({ b1: 600000, b2: 3000000, b3: 11800000, ath: 0 }), planDate: ON_REFILL_DATE })
  assert.equal(plan.market.status, 'unknown')
  assert.deepEqual(ids(plan), ['b2-to-b1-down'])
  assert.ok(plan.warnings.some(w => w.code === 'market-unknown'))
})

test('sells growth funds near their high before the ones that fell', () => {
  const fallen = { portfolioId: 'P1', schemeCode: 'E2', fundName: 'Small Cap Fund', category: 'Small Cap', units: 10000, currentNav: 75, currentValue: 750000, athNav: 100 }
  const plan = buildBucketRefillPlan({ ...base, holdings: holdings({ b1: 600000, b2: 3000000, b3: 11000000, nav: 99, extraGrowth: fallen }), planDate: ON_REFILL_DATE })
  assert.equal(plan.market.status, 'good')
  const sold = plan.operations.find(op => op.id === 'b3-to-b1').allocations
  assert.deepEqual(sold.map(a => a.schemeCode), ['E1'])
})

test('refill timing: due on the yearly date, early when income drops to 12 months, otherwise waits', () => {
  const midYear18 = buildBucketRefillPlan({ ...base, holdings: holdings({ b1: 900000, b2: 3000000, b3: 11800000 }), planDate: MID_YEAR })
  assert.equal(midYear18.status, 'not-due')
  assert.ok(midYear18.nextCheckDate > MID_YEAR)
  const midYear12 = buildBucketRefillPlan({ ...base, holdings: holdings({ b1: 600000, b2: 3000000, b3: 11800000 }), planDate: MID_YEAR })
  assert.equal(midYear12.status, 'due')
  const full = buildBucketRefillPlan({ ...base, holdings: holdings({ b1: 1200000, b2: 3000000, b3: 11800000 }), planDate: ON_REFILL_DATE })
  assert.equal(full.status, 'ok')
  assert.equal(full.operations.length, 0)
})

test('before retirement the plan is a preview', () => {
  const future = { ...goal, targetDate: '2040-01-15T00:00:00.000Z' }
  const plan = buildBucketRefillPlan({ ...base, goal: future, holdings: holdings({ b1: 600000, b2: 3000000, b3: 11800000 }), planDate: ON_REFILL_DATE })
  assert.equal(plan.status, 'not-started')
  const soon = buildBucketRefillPlan({ ...base, goal: { ...goal, targetDate: '2029-01-15T00:00:00.000Z' }, holdings: holdings({ b1: 600000, b2: 3000000, b3: 11800000 }), planDate: ON_REFILL_DATE })
  assert.equal(soon.status, 'building')
})

test('market check is weighted by value and schedule uses the retirement anniversary', () => {
  const market = assessGrowthMarket([
    { key: 'a', goalValue: 900, currentNav: 95, athNav: 100 },
    { key: 'b', goalValue: 100, currentNav: 50, athNav: 100 },
  ])
  assert.equal(Math.round(market.weightedBelowAthPct * 10) / 10, 9.5)
  assert.equal(market.status, 'good')
  const schedule = refillSchedule(goal, MID_YEAR)
  assert.equal(schedule.lastDate.toISOString().slice(0, 10), '2027-01-15')
  assert.equal(schedule.nextDate.toISOString().slice(0, 10), '2028-01-15')
})
