import { describe, it, expect } from 'vitest'
import { realignForGoal } from './goalRealign'

const inY = (y) => new Date(Date.now() + y * 365.25 * 864e5).toISOString()
const RET = { goalId: 'RET', goalType: 'Retirement', targetDate: inY(10) }
const KID = { goalId: 'KID', goalType: 'Education', targetDate: inY(3) }
const items = [{ id: 'EQ', value: 2000000, equityPct: 90, name: 'Core', type: 'MF' }, { id: 'DEBT', value: 500000, equityPct: 5, name: 'Safe', type: 'MF' }, { id: 'EPF', value: 800000, equityPct: 0, name: 'EPF', type: 'Other' }]
const mappings = [{ goalId: 'RET', portfolioId: 'EQ', allocationPct: 100, investmentType: 'MF' }, { goalId: 'RET', portfolioId: 'DEBT', allocationPct: 100, investmentType: 'MF' }, { goalId: 'RET', portfolioId: 'EPF', allocationPct: 100, investmentType: 'Other' }]

describe('realign goals', () => {
  it('retirement keeps what it needs; only its extra moves, safe part first for a near goal', () => {
    const plans = [{ goal: RET, has: 3300000, need: 2800000, isRet: true }] // ₹5 L extra
    const r = realignForGoal({ goal: KID, wantValue: 1500000, wantEq: 30, plans, mappings, items })
    expect(r.moved).toBeLessThanOrEqual(500000)
    expect(r.moves[0].portfolioId).toBe('DEBT')
    expect(r.moves.some((m) => m.portfolioId === 'EPF')).toBe(false)
    expect(r.still).toBeGreaterThanOrEqual(1000000)
    expect(r.donors.RET.find((m) => m.portfolioId === 'DEBT')?.allocationPct ?? 0).toBeLessThan(100)
    expect(r.donors.RET.find((m) => m.portfolioId === 'EQ').allocationPct).toBe(100) // equity stays with retirement
  })
  it('a retirement goal that is short gives nothing: the new goal starts with new money', () => {
    const plans = [{ goal: RET, has: 3300000, need: 4000000, isRet: true }]
    const r = realignForGoal({ goal: KID, wantValue: 1500000, wantEq: 30, plans, mappings, items })
    expect(r.moves).toHaveLength(0); expect(r.still).toBe(1500000)
  })
  it('free money already covers it: nothing moves', () => {
    const r = realignForGoal({ goal: KID, wantValue: 1000000, haveValue: 1200000, wantEq: 30, plans: [{ goal: RET, has: 9e6, need: 1e6, isRet: true }], mappings, items })
    expect(r.moves).toHaveLength(0)
  })
  it('an investment already linked over 100% is never used', () => {
    const plans = [{ goal: RET, has: 9e6, need: 1e6, isRet: true }]
    const bad = [...mappings, { goalId: 'X', portfolioId: 'DEBT', allocationPct: 50, investmentType: 'MF' }]
    const r = realignForGoal({ goal: KID, wantValue: 1500000, wantEq: 30, plans, mappings: bad, items })
    expect(r.moves.some((m) => m.portfolioId === 'DEBT')).toBe(false)
  })
})
