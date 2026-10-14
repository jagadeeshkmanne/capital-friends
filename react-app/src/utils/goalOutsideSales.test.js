import { describe, it, expect } from 'vitest'
import { outsideSales } from './goalOutsideSales'

describe('outsideSales: redeemed on the platform without pressing Done', () => {
  const goal = { goalId: 'CAR', targetDate: '2026-10-01' }
  const tx = [
    { portfolioId: 'P1', type: 'SELL', transactionType: 'WITHDRAWAL', date: '2026-10-05', fundName: 'Liquid', totalAmount: 300000, units: 100 },
    { portfolioId: 'P1', type: 'SELL', transactionType: 'SWITCH', date: '2026-10-05', fundName: 'Eq', totalAmount: 50000, units: 10 },
    { portfolioId: 'P1', type: 'SELL', transactionType: 'WITHDRAWAL', date: '2026-10-06', notes: 'For goal: Car', totalAmount: 90000, units: 9 },
    { portfolioId: 'P1', type: 'SELL', transactionType: 'WITHDRAWAL', date: '2026-06-01', fundName: 'Old', totalAmount: 70000, units: 7 },
    { portfolioId: 'P2', type: 'SELL', transactionType: 'WITHDRAWAL', date: '2026-10-05', fundName: 'Other', totalAmount: 80000, units: 8 },
    { portfolioId: 'P1', type: 'BUY', transactionType: 'SIP', date: '2026-10-05', totalAmount: 10000, units: 1 },
  ]
  it('finds only plain redemptions in the goal\'s portfolios, around and after its date', () => {
    const r = outsideSales({ goal, portfolioIds: ['P1'], mfTransactions: tx })
    expect(r.total).toBe(300000)
    expect(r.items.map((x) => x.fundName)).toEqual(['Liquid'])
  })
  it('nothing when no portfolios or no date', () => {
    expect(outsideSales({ goal: {}, portfolioIds: ['P1'], mfTransactions: tx }).total).toBe(0)
    expect(outsideSales({ goal, portfolioIds: [], mfTransactions: tx }).total).toBe(0)
  })
})

describe('outsideSales: cash / FD lowered by hand', () => {
  const goal = { goalId: 'CAR', targetDate: '2026-10-01' }
  it('counts noted cash-outs of the goal\'s deposits from 30 days before its date', () => {
    const cashOuts = [{ investmentId: 'FD1', name: 'HDFC FD', amount: 200000, date: '2026-09-20' }, { investmentId: 'FD1', name: 'HDFC FD', amount: 50000, date: '2026-05-01' }, { investmentId: 'FD9', amount: 70000, date: '2026-10-02' }]
    const r = outsideSales({ goal, portfolioIds: ['FD1'], mfTransactions: [], cashOuts })
    expect(r.total).toBe(200000)
    expect(r.items[0].cash).toBe(true)
  })
})

import { alreadyTaken } from './goalOutsideSales'
import { withdrawActions } from '../pages/goals/WithdrawPanel'
it('Done does not record again what the statement already shows sold', () => {
  const goal = { targetDate: '2026-10-01' }
  const tx = [
    { portfolioId: 'PF', fundCode: 'LIQ', type: 'SELL', transactionType: 'WITHDRAWAL', date: '05/10/2026', units: 60 },
    { portfolioId: 'PF', fundCode: 'LIQ', type: 'SELL', transactionType: 'SWITCH_OUT', date: '05/10/2026', units: 999 },
    { portfolioId: 'PF', fundCode: 'LIQ', type: 'SELL', transactionType: 'WITHDRAWAL', date: '06/10/2026', units: 5, notes: 'For goal: Car' },
  ]
  const already = alreadyTaken({ goal, mfTransactions: tx, cashOuts: [{ investmentId: 'FD1', amount: 30000, date: '2026-10-03' }] })
  expect(already['PF::LIQ']).toBe(60)
  const rows = [
    { kind: 'mf', name: 'Liquid', portfolioId: 'PF', value: 10000, units: 100, all: true, holding: { fundCode: 'LIQ', units: 100, currentNav: 100, currentValue: 10000 } },
    { kind: 'other', name: 'FD', value: 50000, holding: { investmentId: 'FD1', currentValue: 50000, investmentType: 'Fixed Deposit' } },
  ]
  const acts = withdrawActions(rows, { 'mf:PF:LIQ': '10,000', 'other::FD1': '50,000' }, '2026-10-14', already)
  expect(acts.find((a) => a.kind === 'mf').redeem.units).toBe(40)
  expect(acts.find((a) => a.kind === 'other').amount).toBe(20000)
})
