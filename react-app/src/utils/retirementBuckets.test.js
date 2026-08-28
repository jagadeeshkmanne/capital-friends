import test from 'node:test'
import assert from 'node:assert/strict'
import {
  allocateBucketWithdrawal,
  buildRetirementBucketPlan,
  classifyRetirementHolding,
  getRetirementExpenseBasis,
} from './retirementBuckets.js'

const goal = {
  goalId: 'RET-1',
  monthlyExpenses: 30000,
  expectedInflation: 0.06,
  createdDate: '2026-01-01T00:00:00.000Z',
  targetDate: '2036-01-01T00:00:00.000Z',
}

test('inflates today expenses to the retirement date', () => {
  const result = getRetirementExpenseBasis(goal, new Date('2026-01-01T00:00:00.000Z'))
  assert.ok(Math.abs(result.monthlyExpense - 53725.43) < 5)
})

test('uses allocation detail before broad category labels', () => {
  assert.equal(classifyRetirementHolding({ category: 'Multi Asset' }, { Equity: 20, Debt: 20, Commodities: 60 }).bucket, null)
  assert.equal(classifyRetirementHolding({ category: 'Large Cap' }, null).bucket, 'b3')
  assert.equal(classifyRetirementHolding({ category: 'Liquid' }, null).bucket, 'b1')
  assert.equal(classifyRetirementHolding({ category: 'Medium Duration Debt' }, null).bucket, 'b2')
  assert.equal(classifyRetirementHolding({ category: 'Balanced Advantage' }, { Equity: 60, Debt: 40 }).bucket, 'b2')
})

test('shows every fund in its bucket and limits movements to goal-owned units', () => {
  const plan = buildRetirementBucketPlan({
    goal,
    mappings: [
      { goalId: 'RET-1', portfolioId: 'P1', allocationPct: 50 },
      { goalId: 'RET-1', portfolioId: 'P2', allocationPct: 25 },
    ],
    portfolios: [
      { portfolioId: 'P1', portfolioName: 'PFL-Core' },
      { portfolioId: 'P2', portfolioName: 'PFL-Satellite' },
    ],
    holdings: [
      { portfolioId: 'P1', schemeCode: 'L1', fundName: 'Liquid One', category: 'Liquid', units: 10000, currentNav: 100, currentValue: 1000000 },
      { portfolioId: 'P1', schemeCode: 'E1', fundName: 'Equity One', category: 'Flexi Cap', units: 20000, currentNav: 100, currentValue: 2000000 },
      { portfolioId: 'P2', schemeCode: 'H1', fundName: 'Hybrid One', category: 'Balanced Advantage', units: 10000, currentNav: 100, currentValue: 1000000 },
    ],
    b1TargetMonths: 24,
    b2TargetMonths: 60,
    planDate: new Date('2026-01-01T00:00:00.000Z'),
  })

  assert.equal(plan.byBucket.b1.length, 1)
  assert.equal(plan.byBucket.b2.length, 1)
  assert.equal(plan.byBucket.b3.length, 1)
  assert.equal(plan.byBucket.b1[0].goalUnits, 5000)
  const movedFromHybrid = plan.operations
    .flatMap(operation => operation.allocations)
    .filter(item => item.key === 'P2::H1')
    .reduce((sum, item) => sum + item.units, 0)
  assert.ok(movedFromHybrid <= 2500)
})

test('one monthly withdrawal is shared across all B1 funds', () => {
  const result = allocateBucketWithdrawal([
    { key: 'P1::L1', goalValue: 50000, goalUnits: 500, currentNav: 100 },
    { key: 'P2::L2', goalValue: 50000, goalUnits: 500, currentNav: 100 },
  ], 30000)
  assert.equal(Math.round(result.fundedAmount), 30000)
  assert.equal(result.allocations.reduce((sum, item) => sum + item.amount, 0), 30000)
})

test('keeps a funded B2 intact and refills B1 directly from B3', () => {
  const plan = buildRetirementBucketPlan({
    goal: { ...goal, monthlyExpenses: 1000, expectedInflation: 0, targetAmount: 300000 },
    mappings: [{ goalId: 'RET-1', portfolioId: 'P1', allocationPct: 100 }],
    portfolios: [{ portfolioId: 'P1', portfolioName: 'Core' }],
    holdings: [
      { portfolioId: 'P1', schemeCode: 'L1', fundName: 'Liquid', category: 'Liquid', units: 20, currentNav: 100, currentValue: 2000 },
      { portfolioId: 'P1', schemeCode: 'H1', fundName: 'Hybrid', category: 'Balanced Advantage', units: 600, currentNav: 100, currentValue: 60000 },
      { portfolioId: 'P1', schemeCode: 'E1', fundName: 'Equity', category: 'Flexi Cap', units: 3000, currentNav: 100, currentValue: 300000 },
    ],
    b1TargetMonths: 24,
    b2TargetMonths: 60,
    planDate: new Date('2026-01-01T00:00:00.000Z'),
  })

  assert.equal(plan.operations.some(operation => operation.id === 'b2-to-b1'), false)
  assert.equal(plan.operations.find(operation => operation.id === 'b3-to-b1').fundedAmount, 22000)
})

test('does not drain B3 when the linked corpus is below its retirement target', () => {
  const plan = buildRetirementBucketPlan({
    goal: { ...goal, monthlyExpenses: 1000, expectedInflation: 0, targetAmount: 500000 },
    mappings: [{ goalId: 'RET-1', portfolioId: 'P1', allocationPct: 100 }],
    portfolios: [{ portfolioId: 'P1', portfolioName: 'Core' }],
    holdings: [
      { portfolioId: 'P1', schemeCode: 'H1', fundName: 'Hybrid', category: 'Balanced Advantage', units: 600, currentNav: 100, currentValue: 60000 },
      { portfolioId: 'P1', schemeCode: 'E1', fundName: 'Equity', category: 'Flexi Cap', units: 3000, currentNav: 100, currentValue: 300000 },
    ],
    b1TargetMonths: 24,
    b2TargetMonths: 60,
    planDate: new Date('2026-01-01T00:00:00.000Z'),
  })

  assert.equal(plan.targets.b3, 416000)
  assert.equal(plan.operations.length, 0)
  assert.equal(plan.fundingGap, 140000)
  assert.equal(plan.targetShortfall, 140000)
})

test('one linked portfolio can supply a different fund to each bucket', () => {
  const plan = buildRetirementBucketPlan({
    goal: { ...goal, monthlyExpenses: 1000, expectedInflation: 0, targetAmount: 300000 },
    mappings: [{ goalId: 'RET-1', portfolioId: 'P1', allocationPct: 50 }],
    portfolios: [{ portfolioId: 'P1', portfolioName: 'One Portfolio' }],
    holdings: [
      { portfolioId: 'P1', schemeCode: 'L1', fundName: 'Liquid Fund', category: 'Liquid', units: 1000, currentNav: 100, currentValue: 100000 },
      { portfolioId: 'P1', schemeCode: 'H1', fundName: 'Hybrid Fund', category: 'Balanced Advantage', units: 1000, currentNav: 100, currentValue: 100000 },
      { portfolioId: 'P1', schemeCode: 'E1', fundName: 'Equity Fund', category: 'Flexi Cap', units: 1000, currentNav: 100, currentValue: 100000 },
    ],
    assetAllocations: [
      { fundCode: 'H1', assetAllocation: { Equity: 60, Debt: 40 } },
      { fundCode: 'E1', assetAllocation: { Equity: 90, Debt: 10 } },
    ],
    planDate: new Date('2026-01-01T00:00:00.000Z'),
  })

  assert.equal(plan.byBucket.b1[0].schemeCode, 'L1')
  assert.equal(plan.byBucket.b2[0].schemeCode, 'H1')
  assert.equal(plan.byBucket.b3[0].schemeCode, 'E1')
  assert.equal(plan.byBucket.b1[0].goalValue, 50000)
  assert.equal(plan.byBucket.b2[0].goalValue, 50000)
  assert.equal(plan.byBucket.b3[0].goalValue, 50000)
})
