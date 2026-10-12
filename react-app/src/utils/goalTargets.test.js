import { describe, it, expect } from 'vitest'
import { portfolioTargets, allPortfolioTargets } from './goalTargets'
import { getRecommendedAllocation } from '../data/glidePath'
const G = (type, y) => getRecommendedAllocation(type, y).equity

const NOW = new Date('2026-10-12T00:00:00Z')
const inYears = (y) => new Date(NOW.getTime() + y * 365.25 * 864e5).toISOString()
const eqOf = (h) => (h.category === 'Debt' ? 0 : h.category === 'Hybrid' ? 0.65 : 1)
const H = [
  { portfolioId: 'P', schemeCode: 'PPFAS', fundName: 'Parag Parikh Flexi Cap', category: 'Equity', units: 1, targetAllocationPct: 40 },
  { portfolioId: 'P', schemeCode: 'B', fundName: 'B', category: 'Equity', units: 1, targetAllocationPct: 20 },
  { portfolioId: 'P', schemeCode: 'C', fundName: 'C', category: 'Equity', units: 1, targetAllocationPct: 20 },
  { portfolioId: 'P', schemeCode: 'D', fundName: 'Debt fund', category: 'Debt', units: 1, targetAllocationPct: 20 },
]
const t = (r, c) => r.targets.find((x) => x.schemeCode === c).targetAllocationPct

describe('goal-driven portfolio targets', () => {
  it('inside the 5-point band nothing changes', () => {
    // 80% equity held; a 50%-linked goal needing 85 -> need = 0.5·85 + 0.5·80 = 82.5, within 5 points
    const r = portfolioTargets({ holdings: H, links: [{ goal: { goalId: 'R', goalType: 'Wealth', targetDate: inYears(15) }, share: 0.5 }], eqOf, now: NOW })
    expect(G('Wealth', 15)).toBe(85)
    expect(r.status).toBe('ok')
  })
  it('a goal that needs 50% equity: equity funds keep 2:1:1, debt takes the rest', () => {
    const r = portfolioTargets({ holdings: H, links: [{ goal: { goalId: 'K', goalType: 'Education', targetDate: inYears(4.5) }, share: 1 }], eqOf, now: NOW })
    expect(r.status).toBe('update')
    expect(t(r, 'PPFAS')).toBeCloseTo(25, 2); expect(t(r, 'B')).toBeCloseTo(12.5, 2); expect(t(r, 'C')).toBeCloseTo(12.5, 2); expect(t(r, 'D')).toBeCloseTo(50, 2)
    expect(r.targets.reduce((s, x) => s + x.targetAllocationPct, 0)).toBeCloseTo(100, 6)
  })
  it('shared portfolio: need is the share-weighted blend, the unlinked part keeps today\'s mix', () => {
    const links = [{ goal: { goalId: 'R', goalType: 'Retirement', targetDate: inYears(8) }, share: 0.5 }, { goal: { goalId: 'K', goalType: 'Education', targetDate: inYears(2) }, share: 0.3 }]
    const r = portfolioTargets({ holdings: H, links, eqOf, now: NOW })
    // retirement 8y -> 75 (eased), kids 2y -> 30, unlinked 20% at 80
    expect(r.needEq).toBeCloseTo(0.5 * G('Retirement', 8) + 0.3 * G('Education', 2) + 0.2 * 80, 0)
    expect(t(r, 'PPFAS') / t(r, 'B')).toBeCloseTo(2, 2)
  })
  it('no safe fund in the portfolio: asks for one instead of inventing targets', () => {
    const r = portfolioTargets({ holdings: H.slice(0, 3).map((h) => ({ ...h, targetAllocationPct: h.schemeCode === 'PPFAS' ? 50 : 25 })), links: [{ goal: { goalId: 'K', goalType: 'Education', targetDate: inYears(2) }, share: 1 }], eqOf, now: NOW })
    expect(r.status).toBe('needs-safe-fund')
  })
  it('no targets set: left alone', () => {
    expect(portfolioTargets({ holdings: H.map((h) => ({ ...h, targetAllocationPct: 0 })), links: [{ goal: { goalId: 'K', goalType: 'Education', targetDate: inYears(2) }, share: 1 }], eqOf, now: NOW }).status).toBe('no-targets')
  })
  it('allPortfolioTargets groups the links by portfolio', () => {
    const r = allPortfolioTargets({ goals: [{ goalId: 'K', goalType: 'Education', targetDate: inYears(2) }], mappings: [{ goalId: 'K', portfolioId: 'P', allocationPct: 100 }], mfHoldings: H, eqOf, now: NOW })
    expect(r).toHaveLength(1); expect(r[0].status).toBe('update')
  })
  it('EPF / FD linked to the same goal count as safe money: the portfolio with targets carries more equity', () => {
    const goal = { goalId: 'R', goalType: 'Retirement', targetDate: inYears(15) } // needs 85
    const att = { R: { total: 5000000, items: [{ portfolioId: 'EPF1', value: 2000000, eq: 0 }, { portfolioId: 'P', value: 3000000, eq: 0.8 }] } }
    const r = allPortfolioTargets({ goals: [goal], mappings: [{ goalId: 'R', portfolioId: 'EPF1', allocationPct: 100 }, { goalId: 'R', portfolioId: 'P', allocationPct: 100 }], mfHoldings: H, eqOf, attribution: att, now: NOW })
    const p = r.find((x) => x.portfolioId === 'P')
    // (0.85 × 50 L − 0) / 30 L = 141% -> capped at 100%: all equity, the debt fund target goes to 0
    expect(p.needEq).toBeCloseTo(100, 0)
    expect(p.targets.find((x) => x.schemeCode === 'D').targetAllocationPct).toBeCloseTo(0, 2)
  })
  it('a need the funds cannot reach is a no-op once the targets are as close as they get (no endless rewrites)', () => {
    const eq80 = (h) => (h.category === 'Debt' ? 0 : 0.8)
    const hs = [{ portfolioId: 'P', schemeCode: 'A', fundName: 'A', category: 'Equity', units: 1, targetAllocationPct: 100 }, { portfolioId: 'P', schemeCode: 'D', fundName: 'D', category: 'Debt', units: 1, targetAllocationPct: 0 }]
    const r = portfolioTargets({ holdings: hs, links: [{ goal: { goalId: 'R', goalType: 'Retirement', targetDate: inYears(15) }, share: 1, eq: 100 }], eqOf: eq80, now: NOW })
    expect(r.status).toBe('ok')
  })
})
