import { describe, it, expect } from 'vitest'
import { poolItems, sharePool } from './goalPool'
import { nextSetAside, snapshotOf, soldSinceOf } from './goalSetAside'

const now = new Date('2026-10-14T00:00:00Z')
const inY = (y) => new Date(now.getTime() + y * 365.25 * 864e5).toISOString().slice(0, 10)
const eqOf = (h) => h.eqPct
const P = [{ portfolioId: 'PF', portfolioName: 'Family', status: 'Active' }]
const H = (liqUnits, liqNav = 100, eqUnits = 50000, eqNav = 200) => [
  { portfolioId: 'PF', schemeCode: 'LIQ', units: liqUnits, currentNav: liqNav, currentValue: liqUnits * liqNav, eqPct: 0 },
  { portfolioId: 'PF', schemeCode: 'EQ', units: eqUnits, currentNav: eqNav, currentValue: eqUnits * eqNav, eqPct: 1 },
]
const car = { goalId: 'CAR', goalName: 'Car', goalType: 'Vehicle', targetDate: inY(-0.02), targetAmount: 500000, isActive: true }
const ret = { goalId: 'RET', goalName: 'Retire', goalType: 'Retirement', targetDate: inY(18), targetAmount: 60000000, isActive: true }

describe('money set aside on the goal date (exact units)', () => {
  const items0 = poolItems({ mfPortfolios: P, mfHoldings: H(10000), eqOf })
  const r0 = sharePool({ goals: [car, ret], items: items0, now })
  const sa = nextSetAside({ current: {}, goals: [car, ret], bySub: r0.bySub, now }).next
  it('a due goal gets a snapshot, retirement never', () => {
    expect(Object.keys(sa)).toEqual(['CAR'])
    expect(sa.CAR.items.length).toBeGreaterThan(0)
  })
  it('units sold outside the app come off the set-aside, not off the other goals', () => {
    const before = sharePool({ goals: [car, ret], items: items0, now, setAside: sa })
    const carUnits = sa.CAR.items.find((x) => x.id === 'PF::LIQ')?.units || 0
    const items1 = poolItems({ mfPortfolios: P, mfHoldings: H(10000 - carUnits), eqOf })   // the statement shows the sale
    const tx = [{ portfolioId: 'PF', fundCode: 'LIQ', type: 'SELL', transactionType: 'WITHDRAWAL', date: '15/10/2026', units: carUnits }]
    const after = sharePool({ goals: [car, ret], items: items1, now, setAside: sa, soldSince: soldSinceOf(sa, tx, []) })
    expect(Math.round(after.byGoal.RET.got)).toBe(Math.round(before.byGoal.RET.got))
    expect(after.aside.CAR.goneShare).toBeGreaterThan(0.5)
  })
  it('a fall in the market does not move money from the other goals into the set-aside', () => {
    const before = sharePool({ goals: [car, ret], items: items0, now, setAside: sa })
    const items1 = poolItems({ mfPortfolios: P, mfHoldings: H(10000, 100, 50000, 150), eqOf })  // equity -25%
    const after = sharePool({ goals: [car, ret], items: items1, now, setAside: sa })
    expect(after.byGoal.CAR.got).toBeLessThanOrEqual(before.byGoal.CAR.got + 1)
    expect(after.aside.CAR.goneShare).toBe(0)
  })
  it('closed goals and goals moved to next year lose their snapshot', () => {
    const closed = nextSetAside({ current: sa, goals: [{ ...car, isActive: false }, ret], bySub: {}, now })
    expect(closed.next.CAR).toBeUndefined(); expect(closed.changed).toBe(true)
    const moved = nextSetAside({ current: sa, goals: [{ ...car, targetDate: inY(1) }, ret], bySub: {}, now })
    expect(moved.next.CAR).toBeUndefined()
  })
  it('a goal paid over years sets aside this year\'s part, safest first', () => {
    const s = snapshotOf({ ...car, targetAmount: 800000, payYears: 4 }, [{ id: 'A', value: 300000, units: 3000, eq: 1 }, { id: 'B', value: 300000, units: 3000, eq: 0 }], now)
    expect(s.items).toEqual([{ id: 'B', value: 200000, units: 2000, eq: 0 }])
  })
})

describe('soldSinceOf', () => {
  it('counts only sales of the set-aside funds on or after its date (dd/MM/yyyy dates), not switches', () => {
    const sa = { CAR: { date: '2026-10-14', items: [{ id: 'PF::LIQ', units: 10 }] } }
    const tx = [
      { portfolioId: 'PF', fundCode: 'LIQ', type: 'SELL', transactionType: 'WITHDRAWAL', date: '15/10/2026', units: 4 },
      { portfolioId: 'PF', fundCode: 'LIQ', type: 'SELL', transactionType: 'SWITCH', date: '16/10/2026', units: 3 },
      { portfolioId: 'PF', fundCode: 'LIQ', type: 'SELL', transactionType: 'WITHDRAWAL', date: '01/10/2026', units: 5 },
      { portfolioId: 'PF', fundCode: 'EQ', type: 'SELL', transactionType: 'WITHDRAWAL', date: '15/10/2026', units: 9 },
      { portfolioId: 'PF', fundCode: 'LIQ', type: 'SELL', transactionType: 'WITHDRAWAL', date: '14/10/2026', units: 1 },
    ]
    expect(soldSinceOf(sa, tx, [])).toEqual({ CAR: { 'PF::LIQ': 5 } })
  })
})
