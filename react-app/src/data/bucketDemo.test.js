import test from 'node:test'
import assert from 'node:assert/strict'
import { DEMO_SCENARIOS, buildDemoData, applyDemoSwitch } from './bucketDemo.js'
import { buildBucketRefillPlan } from '../utils/bucketRefill.js'

const planFor = key => {
  const d = buildDemoData(key)
  const goal = d.goalList[0]
  return buildBucketRefillPlan({ goal, mappings: d.goalPortfolioMappings, holdings: d.mfHoldings, portfolios: d.mfPortfolios, assetAllocations: d.assetAllocations })
}

test('each sample situation shows what its label says', () => {
  assert.equal(planFor('good').status, 'due')
  assert.ok(planFor('good').operations.some(op => op.from === 'b3' && op.to === 'b1'))
  assert.ok(planFor('down').operations.every(op => op.from === 'b2'))
  assert.equal(planFor('build').status, 'building')
  assert.equal(planFor('buildwait').status, 'building-wait')
  assert.equal(planFor('pre').status, 'not-started')
  assert.equal(planFor('notdue').status, 'not-due')
  for (const key of Object.keys(DEMO_SCENARIOS)) assert.ok(planFor(key))
})

test('a sample switch changes only a copy of the sample data', () => {
  const d = buildDemoData('good')
  const before = JSON.stringify(d)
  const next = applyDemoSwitch(d, { fromPortfolioId: 'DEMO-P1', toPortfolioId: 'DEMO-P1', fromFundCode: 'DEMO-E1', toFundCode: 'DEMO-L1', units: 100, fromPrice: 88, toPrice: 1450, date: '2026-10-03', notes: 'x' })
  assert.equal(JSON.stringify(d), before)
  assert.ok(next.mfHoldings.find(h => h.schemeCode === 'DEMO-L1').units > d.mfHoldings.find(h => h.schemeCode === 'DEMO-L1').units)
  assert.equal(next.mfTransactions.length, 1)
})
