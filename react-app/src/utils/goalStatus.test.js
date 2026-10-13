import { describe, it, expect } from 'vitest'
import { goalStatus, agoText, goalIcon } from './goalStatus'
import { needToday, needTodayN } from './goalPlan'
import { withGoalExtras } from './goalExtras'
import { withPortfolioSip, itemsMonthly } from './portfolioSip'

const base = { goal: { goalType: 'Car', targetDate: '2026-01-01' }, isRet: false, years: 0, state: 'due', target: 500000, sip: 0 }
describe('goal status', () => {
  it('date reached with the money: Money ready; without: short', () => {
    expect(goalStatus({ ...base, has: 500000 }).badge).toBe('Money ready')
    expect(goalStatus({ ...base, has: 200000 }).badge).toMatch(/Date reached · .* short/)
    expect(goalStatus({ ...base, has: 0 }).badge).toBe('Date reached · nothing saved')
  })
  it('fully funded, ahead, on track', () => {
    const p = { goal: { goalType: 'Travel', targetDate: '2030-01-01' }, isRet: false, years: 3, target: 100000, has: 100000, need: 80000, gap: 20000, sip: 0 }
    expect(goalStatus({ ...p, state: 'achieved' }).badge).toMatch(/Fully funded/)
    expect(goalStatus({ ...p, state: 'extra', target: 1000000, gap: 80000 }).badge).toMatch(/ahead/)
    expect(goalStatus({ ...p, state: 'extra', target: 1000000, gap: 20000 }).badge).toBe('On track')
  })
  it('texts and icons', () => {
    expect(agoText(14)).toBe('1 yr 2 months ago')
    expect(goalIcon({ goalType: 'Child Education' })).toBe('🎓')
    expect(goalIcon({ goalType: 'Wedding' })).toBe('💍')
  })
})
describe('paid over several years', () => {
  it('needs less today than all at once, and the same for 1 year', () => {
    const a = { target: 2000000, years: 10, annualReturn: 0.1, sip: 0 }
    expect(needTodayN({ ...a, payYears: 1 })).toBeCloseTo(needToday(a), 6)
    expect(needTodayN({ ...a, payYears: 4 })).toBeLessThan(needToday(a))
  })
  it('extras come from settings; goals without extras are unchanged', () => {
    const goals = [{ goalId: 'G1' }, { goalId: 'G2' }]
    const out = withGoalExtras(goals, { GoalExtras: JSON.stringify({ G1: { repeat: 1, payYears: 4 } }) })
    expect(out[0]).toMatchObject({ repeatYears: 1, payYears: 4 })
    expect(out[1]).toBe(goals[1])
    expect(withGoalExtras(goals, {})).toBe(goals)
  })
})
describe('SIPs', () => {
  it('a portfolio SIP with no fund targets is shared by value; others untouched', () => {
    const hs = [{ portfolioId: 'P1', schemeCode: 1, units: 1, currentValue: 300, ongoingSIP: 0 }, { portfolioId: 'P1', schemeCode: 2, units: 1, currentValue: 100, ongoingSIP: 0 }, { portfolioId: 'P2', schemeCode: 3, units: 1, currentValue: 100, ongoingSIP: 5000 }]
    const out = withPortfolioSip(hs, [{ portfolioId: 'P1', sipTarget: 20000 }, { portfolioId: 'P2', sipTarget: 9000 }])
    expect(out.map((h) => h.ongoingSIP)).toEqual([15000, 5000, 5000])
    expect(withPortfolioSip(hs, [{ portfolioId: 'P2', sipTarget: 9000 }])).toBe(hs)
  })
  it('monthly contributions count for the goal share', () => {
    expect(itemsMonthly([{ kind: 'mf', holding: { ongoingSIP: 1000 }, fraction: 0.5 }, { kind: 'other', holding: { currentValue: 100, dynamicFields: '{"monthlyContribution":7200}' }, value: 100 }])).toBe(7700)
  })
})
