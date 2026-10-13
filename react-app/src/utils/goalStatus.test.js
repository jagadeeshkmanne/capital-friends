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
  it("on the date: this year's part + the later parts discounted", () => {
    expect(needTodayN({ target: 400, years: 0, annualReturn: 0, sip: 0, payYears: 4 })).toBe(400)
    expect(needTodayN({ target: 400, years: 0, annualReturn: 0.1, sip: 0, payYears: 4 })).toBeLessThan(400)
  })
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

import { withdrawActions } from '../pages/goals/WithdrawPanel'
describe('withdraw window', () => {
  const rows = [
    { kind: 'other', name: 'HDFC FD', value: 538000, holding: { investmentId: 'OI-1', investmentType: 'Fixed Deposit', currentValue: 538000 } },
    { kind: 'mf', name: 'Liquid Fund', portfolioId: 'P1', units: 100, all: true, value: 17000, holding: { fundCode: '111', currentNav: 170, units: 100 } },
    { kind: 'mf', name: 'Equity Fund', portfolioId: 'P1', units: 50, value: 5000, holding: { fundCode: '222', currentNav: 100, units: 200 } },
  ]
  it('part of the FD, all of one fund, none of the other', () => {
    const a = withdrawActions(rows, ['3,00,000', '17,000', '0'], '2026-10-13')
    expect(a[0].update.patch).toMatchObject({ currentValue: 238000 })
    expect(a).toHaveLength(2)
    expect(a[0].update).toMatchObject({ currentValue: 238000, status: 'Active' })
    expect(a[1].redeem).toMatchObject({ fundCode: '111', units: 100, price: 170 })
  })
  it('all of the FD marks it matured; part of a fund redeems by NAV', () => {
    const a = withdrawActions(rows, ['5,38,000', '0', '2,000'])
    expect(a[0].update).toMatchObject({ currentValue: 0, status: 'Matured' })
    expect(a[1].redeem.units).toBe(20)
  })
  it('all of a fund sends the exact units held (never rounded up)', () => {
    const r = [{ kind: 'mf', name: 'F', portfolioId: 'P', units: 123.45666, all: true, value: 12345, holding: { fundCode: '9', units: 123.45666, currentNav: 100 } }]
    expect(withdrawActions(r, ['12,345'])[0].redeem.units).toBe(123.45666)
    expect(withdrawActions(r, ['10,000'])[0].redeem.units).toBe(100)
  })
  it('gold by weight: grams go down with the value; invested too', () => {
    const r = [{ kind: 'other', name: 'Gold', value: 200000, holding: { investmentId: 'G', investmentType: 'Physical Gold', currentValue: 200000, investedAmount: 100000, dynamicFields: { weightGrams: 20 } } }]
    const p = withdrawActions(r, ['50,000'])[0].update.patch
    expect(p).toMatchObject({ currentValue: 150000, investedAmount: 75000, dynamicFields: { weightGrams: 15 } })
  })
})
