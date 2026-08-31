import test from 'node:test'
import assert from 'node:assert/strict'
import {
  BUY_OPPORTUNITY_THRESHOLD_PCT,
  isBuyOpportunity,
  isStrongBuyOpportunity,
} from './buyOpportunities.js'

test('uses the same five-percent eligibility threshold across the app', () => {
  assert.equal(BUY_OPPORTUNITY_THRESHOLD_PCT, 5)
  assert.equal(isBuyOpportunity({ athNav: 100, belowATHPct: 4.99 }), false)
  assert.equal(isBuyOpportunity({ athNav: 100, belowATHPct: 5 }), true)
})

test('requires a valid all-time-high NAV', () => {
  assert.equal(isBuyOpportunity({ athNav: 0, belowATHPct: 20 }), false)
  assert.equal(isBuyOpportunity({ belowATHPct: 20 }), false)
})

test('classifies strong opportunities at ten percent', () => {
  assert.equal(isStrongBuyOpportunity({ athNav: 100, belowATHPct: 9.99 }), false)
  assert.equal(isStrongBuyOpportunity({ athNav: 100, belowATHPct: 10 }), true)
})
