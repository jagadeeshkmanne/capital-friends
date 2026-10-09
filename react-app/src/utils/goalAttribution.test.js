import { describe, it, expect } from 'vitest'
import { attributeGoals, equityFraction } from './goalAttribution'

const eqFund = (pid, code, v) => ({ portfolioId: pid, schemeCode: code, category: 'Equity', units: 100, currentValue: v })
const debtFund = (pid, code, v) => ({ portfolioId: pid, schemeCode: code, category: 'Debt', units: 100, currentValue: v })
const goals = [{ goalId: 'HOME' }, { goalId: 'RET' }]
const T = { HOME: 0.1, RET: 0.85 }
const pct = (g) => Math.round((g.equity / g.total) * 100)

describe('goal attribution', () => {
  it('shared 40% equity / 60% debt portfolio: the near goal gets the debt, so no false "move to debt"', () => {
    const r = attributeGoals({ goals, targetOf: (g) => T[g.goalId], mappings: [{ goalId: 'HOME', portfolioId: 'P', allocationPct: 50 }, { goalId: 'RET', portfolioId: 'P', allocationPct: 50 }],
      mfHoldings: [eqFund('P', 'E', 400000), debtFund('P', 'D', 600000)] })
    expect(Math.round(r.HOME.total)).toBe(500000)
    expect(pct(r.HOME)).toBe(10)          // on target: no de-risk alert
    expect(Math.round(r.RET.total)).toBe(500000)
    expect(pct(r.RET)).toBe(70)           // 2.5 L - 0.5 L... retirement holds the rest of the equity
  })
  it('not enough debt in the portfolio: the near goal keeps the real excess', () => {
    const r = attributeGoals({ goals, targetOf: (g) => T[g.goalId], mappings: [{ goalId: 'HOME', portfolioId: 'P', allocationPct: 50 }, { goalId: 'RET', portfolioId: 'P', allocationPct: 50 }],
      mfHoldings: [eqFund('P', 'E', 900000), debtFund('P', 'D', 100000)] })
    expect(pct(r.HOME)).toBe(80)          // only 1 L debt exists: 80% equity, move 3.5 L
    expect(pct(r.RET)).toBe(100)
  })
  it('one goal per portfolio works exactly as before (pro-rata)', () => {
    const r = attributeGoals({ goals: [{ goalId: 'HOME' }], targetOf: () => 0.1, mappings: [{ goalId: 'HOME', portfolioId: 'P', allocationPct: 100 }],
      mfHoldings: [eqFund('P', 'E', 300000), debtFund('P', 'D', 100000)] })
    expect(Math.round(r.HOME.total)).toBe(400000)
    expect(pct(r.HOME)).toBe(75)
  })
  it('part of the portfolio unlinked: the goal gets its amount, debt first', () => {
    const r = attributeGoals({ goals: [{ goalId: 'HOME' }], targetOf: () => 0.1, mappings: [{ goalId: 'HOME', portfolioId: 'P', allocationPct: 30 }],
      mfHoldings: [eqFund('P', 'E', 500000), debtFund('P', 'D', 500000)] })
    expect(Math.round(r.HOME.total)).toBe(300000)
    expect(pct(r.HOME)).toBe(10)
  })
  it('hybrid funds count by their equity share; stocks are all equity; FD is all debt', () => {
    expect(equityFraction({ category: 'Hybrid' })).toBe(0.65)
    expect(equityFraction({ schemeCode: 'X', category: 'Debt' }, { X: { Equity: 30 } })).toBe(0.3)
    const r = attributeGoals({ goals, targetOf: (g) => T[g.goalId],
      mappings: [{ goalId: 'HOME', portfolioId: 'S', allocationPct: 50 }, { goalId: 'RET', portfolioId: 'S', allocationPct: 50 }, { goalId: 'HOME', portfolioId: 'FD1', allocationPct: 100 }],
      stockHoldings: [{ portfolioId: 'S', symbol: 'INFY', quantity: 10, currentValue: 200000 }],
      otherInvList: [{ investmentId: 'FD1', currentValue: 100000, investmentCategory: 'Debt' }] })
    expect(Math.round(r.HOME.total)).toBe(200000)
    expect(Math.round(r.HOME.equity)).toBe(100000)
    expect(Math.round(r.RET.equity)).toBe(100000)
  })
  it('links adding to more than 100% are scaled down, never double-counted', () => {
    const r = attributeGoals({ goals, targetOf: (g) => T[g.goalId], mappings: [{ goalId: 'HOME', portfolioId: 'P', allocationPct: 80 }, { goalId: 'RET', portfolioId: 'P', allocationPct: 80 }],
      mfHoldings: [eqFund('P', 'E', 500000), debtFund('P', 'D', 500000)] })
    expect(Math.round(r.HOME.total + r.RET.total)).toBe(1000000)
  })
})
