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
