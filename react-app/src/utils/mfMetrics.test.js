import test from 'node:test'
import assert from 'node:assert/strict'
import { computeXIRR, computeCAGR, parseDate } from './mfMetrics.js'

test('parseDate handles GAS dd/MM/yyyy and ISO', () => {
  assert.equal(parseDate('05/03/2024').getTime(), new Date(2024, 2, 5).getTime())
  assert.equal(parseDate('2024-03-05').getFullYear(), 2024)
  assert.equal(parseDate(''), null)
})

test('XIRR of a single lumpsum equals its CAGR', () => {
  const from = new Date(2022, 0, 1)
  const to = new Date(2025, 0, 1)
  const xirr = computeXIRR([{ date: from, amount: -100000 }, { date: to, amount: 133100 }])
  assert.ok(Math.abs(xirr - 0.10) < 1e-3)
  const cagr = computeCAGR(100000, 133100, from, to)
  assert.ok(Math.abs(cagr - 0.10) < 1e-3)
})

test('XIRR returns null without both inflows and outflows', () => {
  assert.equal(computeXIRR([{ date: new Date(2024, 0, 1), amount: -1000 }]), null)
  assert.equal(computeXIRR([{ date: new Date(2024, 0, 1), amount: -1000 }, { date: new Date(2025, 0, 1), amount: -1000 }]), null)
})

test('CAGR needs a meaningful holding period', () => {
  assert.equal(computeCAGR(1000, 1100, new Date(), new Date()), null)
  assert.equal(computeCAGR(0, 1100, new Date(2020, 0, 1)), null)
})
