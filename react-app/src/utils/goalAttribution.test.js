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
  it('two goals sharing a portfolio each get a slice of every equity fund (not one whole fund each)', () => {
    const goals = [{ goalId: 'KID' }, { goalId: 'RET' }]
    const T = { KID: 0.75, RET: 0.84 }
    const r = attributeGoals({ goals, targetOf: (g) => T[g.goalId], mappings: [{ goalId: 'KID', portfolioId: 'P', allocationPct: 50 }, { goalId: 'RET', portfolioId: 'P', allocationPct: 50 }],
      mfHoldings: [eqFund('P', 'PPFAS', 800000), eqFund('P', 'N50', 800000), eqFund('P', 'MID', 400000), debtFund('P', 'LIQ', 300000)] })
    const val = (g, c) => r[g].items.filter((i) => i.holding.schemeCode === c).reduce((t, i) => t + i.value, 0)
    for (const g of ['KID', 'RET']) for (const c of ['PPFAS', 'N50', 'MID']) expect(val(g, c)).toBeGreaterThan(100000)
    // same equity level -> same fraction of each fund
    expect(val('RET', 'PPFAS') / 800000).toBeCloseTo(val('RET', 'MID') / 400000, 6)
    expect(Math.round(r.KID.total + r.RET.total)).toBe(2300000)
  })
  it('one goal on part of a portfolio: equity-type funds share its equity in proportion (flexi cap is not left for last)', () => {
    const allocMap = { PPFAS: { Equity: 70 } }
    const r = attributeGoals({ goals: [{ goalId: 'RET' }], targetOf: () => 0.84, mappings: [{ goalId: 'RET', portfolioId: 'P', allocationPct: 50 }], allocMap,
      mfHoldings: [eqFund('P', 'N50', 1000000), { ...eqFund('P', 'PPFAS', 600000) }, debtFund('P', 'LIQ', 400000)] })
    const f = (c) => r.RET.items.find((i) => i.holding.schemeCode === c)?.fraction || 0
    expect(f('PPFAS')).toBeGreaterThan(0.3)
    expect(f('PPFAS')).toBeCloseTo(f('N50'), 6)
    expect(r.RET.total).toBeCloseTo(1000000, 0)
  })
})
