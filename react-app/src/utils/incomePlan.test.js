import test from 'node:test'
import assert from 'node:assert/strict'
import { payMonths, dueDeductions, defaultIncomePlan, incomeSourceOptions, swpPending, incomeStatus, splitToSources, lastRefill } from './incomePlan.js'

const d = (s) => new Date(`${s}T10:00:00`)
const plan = { v: 1, start: '2026-11', day: 1, sources: [{ kind: 'cash', ref: 'INV-1', name: 'HDFC savings', amount: 30000 }] }

test('pay months: from the start month, only pay days that have come', () => {
  assert.deepEqual(payMonths(plan, d('2026-10-20')), [])
  assert.deepEqual(payMonths(plan, d('2026-11-01')), ['2026-11'])
  assert.deepEqual(payMonths(plan, d('2027-01-15')), ['2026-11', '2026-12', '2027-01'])
})

test('cash deductions: one per source per month, never twice, missed months caught up', () => {
  const log = [{ m: '2026-11', ref: 'INV-1', amt: 30000 }]
  assert.deepEqual(dueDeductions(plan, log, d('2027-01-02')).map((x) => x.m), ['2026-12', '2027-01'])
  assert.deepEqual(dueDeductions(plan, [...log, { m: '2026-12', ref: 'INV-1' }, { m: '2027-01', ref: 'INV-1' }], d('2027-01-20')), [])
})

test('SWP sources are never deducted by the app (the CAS import brings the sale)', () => {
  const p = { ...plan, sources: [{ kind: 'swp', ref: 'P1::L1', amount: 30000 }] }
  assert.deepEqual(dueDeductions(p, [], d('2027-03-01')), [])
})

test('first plan: savings first, else the biggest liquid fund; starts next month', () => {
  const opts = incomeSourceOptions({
    otherInvestments: [{ investmentId: 'INV-1', investmentType: 'Cash / Savings', investmentName: 'HDFC savings', currentValue: 720000 }, { investmentId: 'INV-2', investmentType: 'Fixed Deposit', currentValue: 500000 }],
    incomeFunds: [{ portfolioId: 'P1', schemeCode: 'L1', fundName: 'Liquid A', goalValue: 900000 }],
  })
  assert.deepEqual(opts.map((o) => o.ref), ['INV-1', 'P1::L1']) // a regular FD is not a pay-from source
  const p = defaultIncomePlan(opts, 30000, d('2026-10-13'))
  assert.equal(p.start, '2026-11')
  assert.deepEqual(p.sources, [{ kind: 'cash', ref: 'INV-1', name: 'HDFC savings', amount: 30000 }])
  assert.equal(defaultIncomePlan(opts.slice(1), 30000, d('2026-10-13')).sources[0].ref, 'P1::L1')
})

test('SWP estimate: pay days after the last statement with no sale that month', () => {
  const p = { start: '2026-11', day: 1, sources: [] }
  const src = { kind: 'swp', ref: 'P1::L1', amount: 30000 }
  const tx = [{ portfolioId: 'P1', fundCode: 'L1', type: 'SELL', date: '01/11/2026' }, { portfolioId: 'P1', fundCode: 'E1', type: 'BUY', date: '05/11/2026' }]
  assert.equal(swpPending(p, src, tx, d('2027-01-10')), 2) // Dec and Jan not in the statement yet
  const tx2 = [...tx, { portfolioId: 'P1', fundCode: 'L1', type: 'SELL', date: '01/12/2026' }, { portfolioId: 'P1', fundCode: 'L1', type: 'SELL', date: '01/01/2027' }]
  assert.equal(swpPending(p, src, tx2, d('2027-01-10')), 0) // the import brought both: no double counting
})

test('status: months left per source, estimate flag, low source with a reserve gets a move step', () => {
  const opts = [{ kind: 'swp', ref: 'P1::A', name: 'Liquid A', value: 80000 }, { kind: 'swp', ref: 'P1::B', name: 'Liquid B', value: 2400000 }]
  const p = { start: '2027-01', day: 1, sources: [{ kind: 'swp', ref: 'P1::A', amount: 30000 }] }
  const st = incomeStatus({ plan: p, options: opts, transactions: [], monthly: 30000, today: d('2027-01-02') })
  assert.equal(st.rows[0].estimated, true)
  assert.equal(Math.round(st.rows[0].value), 50000)
  assert.match(st.steps[0], /Liquid A has 1 month left\. Start the SWP from Liquid B, or move ₹3\.60 L/)
  assert.equal(st.reserves[0].ref, 'P1::B')
})

test('status: low source and no reserve -> warning to refill now', () => {
  const st = incomeStatus({ plan, options: [{ kind: 'cash', ref: 'INV-1', name: 'HDFC savings', value: 60000 }], monthly: 30000, today: d('2027-01-02') })
  assert.match(st.warn[0], /2 months left and nothing else in Income.*Refill Income from Stability now/)
})

test('status: a short pay day this month and a removed source are warned', () => {
  const log = [{ m: '2027-01', ref: 'INV-1', amt: 10000, short: 20000 }]
  const st = incomeStatus({ plan, options: [{ kind: 'cash', ref: 'INV-1', name: 'HDFC savings', value: 0 }], log, monthly: 30000, today: d('2027-01-05') })
  assert.ok(st.warn.some((w) => /had only ₹10,000.*₹20,000 of this month's income still to pay/.test(w)))
  const gone = incomeStatus({ plan, options: [], monthly: 30000, today: d('2027-01-05') })
  assert.ok(gone.warn.some((w) => /no longer in your investments/.test(w)))
})

test('two SWPs (split): both estimated, total months, plan amount vs expenses', () => {
  const opts = [{ kind: 'swp', ref: 'P1::A', name: 'A', value: 2400000 }, { kind: 'swp', ref: 'P2::B', name: 'B', value: 2400000 }]
  const p = { start: '2027-01', day: 1, sources: [{ kind: 'swp', ref: 'P1::A', amount: 100000 }, { kind: 'swp', ref: 'P2::B', amount: 100000 }] }
  const st = incomeStatus({ plan: p, options: opts, monthly: 200000, today: d('2026-12-20') })
  assert.equal(st.payMonthly, 200000)
  assert.deepEqual(st.rows.map((r) => r.months), [24, 24])
  assert.equal(st.info.length, 0)
  assert.ok(incomeStatus({ plan: p, options: opts, monthly: 300000, today: d('2026-12-20') }).info[0].includes('Your plan pays'))
})

test('refill into Income keeps the chosen split', () => {
  const parts = splitToSources(600000, [{ ref: 'A', amount: 100000 }, { ref: 'B', amount: 50000 }])
  assert.deepEqual(parts.map((p) => p.amount), [400000, 200000])
})

test('last refill marked done, by destination', () => {
  const log = [{ at: '2027-01-20', ops: [{ to: 'b1' }] }, { at: '2027-03-01', ops: [{ to: 'b2' }] }]
  assert.equal(lastRefill(log, 'b1').at, '2027-01-20')
  assert.equal(lastRefill(log).at, '2027-03-01')
})

test('pay-from account shared with other goals: warned (the money leaves the whole account)', () => {
  const st = incomeStatus({ plan, options: [{ kind: 'cash', ref: 'INV-1', name: 'HDFC savings', value: 600000, share: 0.5 }], monthly: 30000, today: d('2027-01-02') })
  assert.ok(st.warn.some((w) => /only 50% for this goal.*give it 100% to this goal/.test(w)))
  const full = incomeStatus({ plan, options: [{ kind: 'cash', ref: 'INV-1', name: 'HDFC savings', value: 600000, share: 1 }], monthly: 30000, today: d('2027-01-02') })
  assert.equal(full.warn.length, 0)
})
