import assert from 'node:assert/strict'
import test from 'node:test'

import { getRecommendedAllocation } from './glidePath.js'

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
