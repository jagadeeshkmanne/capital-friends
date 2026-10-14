import assert from 'node:assert/strict'
import test from 'node:test'

import { getRecommendedAllocation, followsBucketPlan, getGoalAllocation } from './glidePath.js'

test('one-time goals continue to de-risk near their deadline', () => {
  assert.deepEqual(getRecommendedAllocation('Child Education', 0.5), {
    equity: 10,
    debt: 90,
    label: 'Short-term',
  })
})

test('retirement keeps a growth allocation at the income-start date', () => {
  assert.deepEqual(getRecommendedAllocation('Retirement', 0.5), {
    equity: 75,
    debt: 25,
    label: 'Retirement buckets',
  })
})

test('long retirement runway remains growth-oriented', () => {
  assert.deepEqual(getRecommendedAllocation('Retirement', 15), {
    equity: 85,
    debt: 15,
    label: 'Long-term',
  })
})

test('retirement equity eases from 85% to 75% without a sudden jump', () => {
  const eq = y => getRecommendedAllocation('Retirement', y).equity
  assert.equal(eq(15), 85)
  assert.equal(eq(10), 85)
  assert.equal(eq(7.5), 80)
  assert.equal(eq(5), 75)
  for (let y = 10; y > 5; y -= 0.25) assert.ok(Math.abs(eq(y) - eq(y - 0.25)) <= 1)
})

test('other goals keep their existing glide path', () => {
  assert.equal(getRecommendedAllocation('Education', 2).equity, 30)
  assert.equal(getRecommendedAllocation('Education', 8).equity, 75)
  assert.equal(getRecommendedAllocation('Emergency Fund', 8).equity, 0)
})

test('retirement goals follow the bucket plan in the last 5 years', () => {
  assert.equal(followsBucketPlan('Retirement', 4.9), true)
  assert.equal(followsBucketPlan('Retirement', 6), false)
  assert.equal(followsBucketPlan('Education', 2), false)
})

test('goal paid over years: one-time goal is the plain glide path', () => {
  assert.deepEqual(getGoalAllocation({ goalType: 'Education' }, 2), getRecommendedAllocation('Education', 2))
})

test('college fees over 4 years: each year has its own mix, later years keep more equity', () => {
  const four = getGoalAllocation({ goalType: 'Education', payYears: 4, expectedCAGR: 0.12 }, 2)
  assert.deepEqual(four.parts.map((p) => p.equity), [30, 30, 50, 50])
  assert.ok(four.equity > getRecommendedAllocation('Education', 2).equity && four.equity < 50)
  assert.equal(four.equity + four.debt, 100)
})

test('first payment year: that part is safe, the later parts still hold equity', () => {
  const r = getGoalAllocation({ goalType: 'Education', payYears: 4 }, 0)
  assert.equal(r.parts[0].equity, 0)
  assert.ok(r.equity > 0)
})

test('retirement and emergency fund ignore payYears', () => {
  assert.deepEqual(getGoalAllocation({ goalType: 'Retirement', payYears: 4 }, 8), getRecommendedAllocation('Retirement', 8))
  assert.equal(getGoalAllocation({ goalType: 'Emergency Fund', payYears: 3 }, 1).equity, 0)
})
