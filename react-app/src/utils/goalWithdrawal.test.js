import test from 'node:test'
import assert from 'node:assert/strict'
import { buildGoalWithdrawalPlan } from './goalWithdrawal.js'

test('caps an achieved goal withdrawal at the target instead of redeeming every linked rupee', () => {
  const plan = buildGoalWithdrawalPlan({
    goal: { goalId: 'G1', targetAmount: 4000000 },
    mappings: [{ goalId: 'G1', portfolioId: 'P1', allocationPct: 50 }],
    portfolios: [{ portfolioId: 'P1', portfolioName: 'Core' }],
    holdings: [{ portfolioId: 'P1', schemeCode: 'F1', units: 100000, currentNav: 100, currentValue: 10000000 }],
  })

  assert.equal(plan.totalLinked, 5000000)
  assert.equal(plan.requestedAmount, 4000000)
  assert.equal(plan.remainingLinkedValue, 1000000)
  assert.equal(plan.withdrawals[0].suggestedUnits, 40000)
})

test('keys the same scheme independently across portfolios', () => {
  const plan = buildGoalWithdrawalPlan({
    goal: { goalId: 'G1', targetAmount: 100000 },
    mappings: [
      { goalId: 'G1', portfolioId: 'P1', allocationPct: 100 },
      { goalId: 'G1', portfolioId: 'P2', allocationPct: 100 },
    ],
    portfolios: [{ portfolioId: 'P1', portfolioName: 'One' }, { portfolioId: 'P2', portfolioName: 'Two' }],
    holdings: [
      { portfolioId: 'P1', schemeCode: 'F1', units: 1000, currentNav: 100, currentValue: 100000 },
      { portfolioId: 'P2', schemeCode: 'F1', units: 1000, currentNav: 100, currentValue: 100000 },
    ],
  })

  assert.deepEqual(plan.withdrawals.map(item => item.key), ['P1::F1', 'P2::F1'])
  assert.equal(plan.withdrawals.reduce((sum, item) => sum + item.amount, 0), 100000)
})
