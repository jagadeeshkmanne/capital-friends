import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateGoalFundingProjection } from './goalProjection.js'

test('create mode calculates the full SIP and lump sum from zero', () => {
  const result = calculateGoalFundingProjection({
    targetAmount: 2_500_000,
    months: 72,
    annualReturn: 0.12,
  })

  assert.equal(result.existingValue, 0)
  assert.ok(result.requiredSIP > 0)
  assert.ok(result.requiredLumpsum > 0)
})

test('linked investments reduce the additional SIP and lump sum', () => {
  const withoutLinked = calculateGoalFundingProjection({
    targetAmount: 2_500_000,
    months: 72,
    annualReturn: 0.12,
  })
  const withLinked = calculateGoalFundingProjection({
    targetAmount: 2_500_000,
    months: 72,
    annualReturn: 0.12,
    linkedCurrentValue: 1_900_000,
  })

  assert.ok(withLinked.requiredSIP < withoutLinked.requiredSIP)
  assert.ok(withLinked.requiredLumpsum < withoutLinked.requiredLumpsum)
})

test('a linked investment that grows past the target needs no additional funding', () => {
  const result = calculateGoalFundingProjection({
    targetAmount: 2_500_000,
    months: 72,
    annualReturn: 0.12,
    linkedCurrentValue: 1_900_000,
  })

  assert.equal(result.requiredSIP, 0)
  assert.equal(result.requiredLumpsum, 0)
  assert.equal(result.coversGoal, true)
})

test('does not double count a saved lump sum already inside linked investments', () => {
  const result = calculateGoalFundingProjection({
    targetAmount: 5_000_000,
    months: 60,
    annualReturn: 0.10,
    plannedLumpsum: 1_000_000,
    linkedCurrentValue: 1_900_000,
  })

  assert.equal(result.existingValue, 1_900_000)
})
