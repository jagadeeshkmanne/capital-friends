import test from 'node:test'
import assert from 'node:assert/strict'
import { bucketCheck, lastsYears } from './bucketCheck.js'

const tgt = (m) => ({ inc: m * 24, stb: m * 60, gro: 0 })

test('retired with lots of cash: Income capped at 2 years, the rest is free money that fills Stability, then Growth', () => {
  // her case: ₹30,000 a month, ₹49 L cash, Stability ₹7.28 L (₹5 L NPS locked), Growth ₹5.39 L
  const r = bucketCheck({ tgt: tgt(30000), inc: 4900000, stb: 728000, gro: 539000, locked: 500000, monthly: 30000 })
  assert.equal(r.free, 4900000 - 720000)
  assert.match(r.steps[0], /10\.72 L.*Stability/)
  assert.match(r.steps[1], /31\.08 L free money left/)
  assert.equal(r.warn.length, 0)
  assert.equal(48 + lastsYears(6167000, 30000), 71)
})

test('Income spent month by month is normal: no warning until it drops to 12 months', () => {
  const r = bucketCheck({ tgt: tgt(30000), inc: 690000, stb: 1800000, gro: 3000000, locked: 0, monthly: 30000 })
  assert.deepEqual([r.steps.length, r.warn.length], [0, 0])
  assert.match(r.info[0], /23 months.*yearly refill/)
})

test('Income at 12 months: refill now from Stability funds, never from locked EPF / NPS', () => {
  const r = bucketCheck({ tgt: tgt(30000), inc: 360000, stb: 1800000, gro: 3000000, locked: 1500000, monthly: 30000 })
  assert.match(r.steps[0], /refill it now.*3\.00 L from Stability/)
  assert.ok(r.warn.some((w) => /short even after using Stability.*Received/.test(w)))
})

test('not enough money for Income + Stability: clear warning', () => {
  const r = bucketCheck({ tgt: tgt(30000), inc: 500000, stb: 300000, gro: 100000, locked: 0, monthly: 30000 })
  assert.ok(r.warn.some((w) => /covers about 2\.5 years/.test(w)))
})

test('everything on plan: no steps, no warnings', () => {
  const r = bucketCheck({ tgt: tgt(30000), inc: 720000, stb: 1800000, gro: 3000000, locked: 0, monthly: 30000 })
  assert.deepEqual([r.steps.length, r.warn.length], [0, 0])
})

import { bucketReminders } from './bucketCheck.js'
const epf = { kind: 'other', value: 2600000, holding: { investmentType: 'EPF' } }
test('EPF reminder: retired at 48 -> earns until 58; retired at 58 -> about 3 years; past -> check it', () => {
  const t = new Date('2026-10-13')
  assert.match(bucketReminders({ items: [epf], age: 48, retAge: 48, today: t })[0].text, /until about 2036 \(age 58\)/)
  assert.match(bucketReminders({ items: [epf], age: 58, retAge: 58, today: t })[0].text, /until about 2029 \(about 3 years/)
  const late = bucketReminders({ items: [epf], age: 63, retAge: 58, today: t })[0]
  assert.equal(late.type, 'warn'); assert.match(late.text, /probably stopped earning interest \(around 2024\)/)
})
test('FD maturity: within a year -> info, matured -> press Received', () => {
  const t = new Date('2026-10-13')
  const fd = (m) => ({ kind: 'other', value: 500000, holding: { investmentType: 'Fixed Deposit', investmentName: 'SBI FD', dynamicFields: JSON.stringify({ maturityDate: m }) } })
  assert.match(bucketReminders({ items: [fd('2027-03-15')], today: t })[0].text, /matures on 15 Mar 2027/)
  assert.equal(bucketReminders({ items: [fd('2026-09-01')], today: t })[0].type, 'warn')
  assert.equal(bucketReminders({ items: [fd('2029-01-01')], today: t }).length, 0)
})
