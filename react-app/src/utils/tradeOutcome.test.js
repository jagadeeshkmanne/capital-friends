import { describe, it, expect } from 'vitest'
import { outcomes, salesSummary, lastAndAllSales } from './tradeOutcome'

const now = { A: 110, B: 45, G: 120 }
const px = (k) => now[k] ?? null

describe('paper trade outcomes', () => {
  it('a sale is measured to the price now, a buy to its later sale', () => {
    const r = outcomes([
      { key: 'A', side: 'buy', date: '2026-10-23', price: 100, qty: 10 },
      { key: 'A', side: 'sell', date: '2026-10-26', price: 95, qty: 10 },
    ], px)
    expect(r[0]).toMatchObject({ end: 95, endDate: '2026-10-26' })
    expect(r[0].pct).toBeCloseTo(-0.05)
    expect(r[1]).toMatchObject({ end: 110, endDate: null })
    expect(r[1].pct).toBeCloseTo(110 / 95 - 1)
    expect(r[1].amt).toBeCloseTo(150)   // the sale missed ₹150 so far
  })
  it('a sale bought back later is measured to the buy-back price', () => {
    const r = outcomes([
      { key: 'B', side: 'sell', date: '2026-10-26', price: 50, qty: 4 },
      { key: 'B', side: 'buy', date: '2026-11-02', price: 40, qty: 5 },
    ], px)
    expect(r[0]).toMatchObject({ end: 40, endDate: '2026-11-02' })
    expect(r[0].amt).toBeCloseTo(-40)   // saved ₹40
    expect(r[1].pct).toBeCloseTo(45 / 40 - 1)
  })
  it('no price: no outcome', () => {
    const r = outcomes([{ key: 'Z', side: 'sell', date: '2026-10-26', price: 10, qty: 1 }], px)
    expect(r[0].pct).toBeNull()
    expect(salesSummary(r)).toBeNull()
  })
  it('sums the sales, and picks out the last sale day', () => {
    const r = outcomes([
      { key: 'A', side: 'sell', date: '2026-09-01', price: 100, qty: 1 },
      { key: 'A', side: 'buy', date: '2026-10-01', price: 90, qty: 1 },
      { key: 'B', side: 'sell', date: '2026-10-26', price: 50, qty: 2 },
      { key: 'G', side: 'sell', date: '2026-10-26', price: 100, qty: 1 },
    ], px)
    const { last, all } = lastAndAllSales(r)
    expect(all).toMatchObject({ n: 3, sold: 300, end: 90 + 90 + 120, from: '2026-09-01', to: '2026-10-26', open: true })
    expect(all.amt).toBeCloseTo(0)
    expect(last).toMatchObject({ n: 2, sold: 200, end: 210 })
    expect(last.pct).toBeCloseTo(0.05)
  })
})
