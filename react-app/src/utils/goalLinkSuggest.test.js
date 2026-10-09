import { describe, it, expect } from 'vitest'
import { suggestGoalLinks, linkedSummary } from './goalLinkSuggest.js'

const items = [
  { id: 'P1', name: 'Core', type: 'MF', owner: 'Ravi', value: 1000000, equityPct: 100 },
  { id: 'P2', name: 'Debt', type: 'MF', owner: 'Ravi', value: 1000000, equityPct: 0 },
  { id: 'P3', name: 'Kid', type: 'MF', owner: 'Anu', value: 500000, equityPct: 90 },
  { id: 'E1', name: 'EPF', type: 'Other', otherType: 'EPF', owner: 'Ravi', value: 2000000, equityPct: 0 },
  { id: 'H1', name: 'Flat', type: 'Other', otherType: 'Property', owner: 'Ravi', value: 9000000, equityPct: null },
]

describe('suggestGoalLinks', () => {
  it('uses any family member\'s investments, skips property, counts EPF in full for retirement', () => {
    const { rows } = suggestGoalLinks({ goal: { goalType: 'Retirement', familyMemberName: 'Ravi' }, items, targetEquity: 85 })
    const ids = rows.map((r) => r.portfolioId)
    expect(ids).toContain('P3')
    expect(ids).not.toContain('H1')
    expect(rows.find((r) => r.portfolioId === 'E1').allocationPct).toBe(100)
  })
  it('long goal: links all free equity money and leaves near-cash portfolios for shorter goals', () => {
    const { rows, summary } = suggestGoalLinks({ goal: { goalType: 'Retirement' }, items: items.filter((i) => i.id !== 'E1' && i.id !== 'P3'), targetEquity: 85 })
    expect(rows.find((r) => r.portfolioId === 'P1').allocationPct).toBe(100)
    expect(rows.find((r) => r.portfolioId === 'P2')).toBeUndefined()
    expect(summary.equityPct).toBe(100)
  })
  it('keeps a 70% equity portfolio of any member when equity is below target (shows the gap instead)', () => {
    const its = [{ id: 'W', type: 'MF', owner: 'Wife', value: 100, equityPct: 70 }, { id: 'E', type: 'Other', otherType: 'EPF', owner: 'Me', value: 100, equityPct: 0 }]
    const { rows, summary } = suggestGoalLinks({ goal: { goalType: 'Retirement' }, items: its, targetEquity: 85 })
    expect(rows.map((r) => r.portfolioId).sort()).toEqual(['E', 'W'])
    expect(summary.equityPct).toBe(35)
  })
  it('links less of the equity portfolio when the goal is close (low target)', () => {
    const { rows, summary } = suggestGoalLinks({ goal: { goalType: 'Child Education', familyMemberName: 'Ravi' }, items, targetEquity: 30 })
    expect(rows.find((r) => r.portfolioId === 'E1')).toBeUndefined() // EPF only for retirement
    expect(rows.find((r) => r.portfolioId === 'P2').allocationPct).toBe(100)
    expect(Math.abs(summary.equityPct - 30)).toBeLessThanOrEqual(3)
  })
  it('respects what other goals already use', () => {
    const { rows } = suggestGoalLinks({ goal: { goalType: 'Retirement', familyMemberName: 'Ravi' }, items, usedByOthers: { P1: 60 }, targetEquity: 85 })
    expect(rows.find((r) => r.portfolioId === 'P1').allocationPct).toBeLessThanOrEqual(40)
  })
  it('a Family goal can use everyone\'s investments', () => {
    const { rows } = suggestGoalLinks({ goal: { goalType: 'Home Purchase', familyMemberName: 'Family' }, items, targetEquity: 50 })
    expect(rows.map((r) => r.portfolioId)).toContain('P3')
  })
  it('summary of edited rows', () => {
    expect(linkedSummary([{ portfolioId: 'P1', allocationPct: 50 }, { portfolioId: 'P2', allocationPct: 50 }], items, 60)).toEqual({ linkedValue: 1000000, equityPct: 50, targetEquity: 60 })
  })
})
