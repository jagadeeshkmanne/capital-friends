import { describe, it, expect } from 'vitest'
import { needToday, sipForAmount, projectValue, switchSteps, buildGoalPlan, BAND } from './goalPlan'
import { attributeGoals, equityFraction } from './goalAttribution'

const NOW = new Date('2026-10-11T00:00:00Z')
const inYears = (y) => new Date(NOW.getTime() + y * 365.25 * 24 * 3600 * 1000).toISOString()
const eqOf = (h) => equityFraction(h, {})
const mf = (pid, code, cat, value, nav = 100) => ({ portfolioId: pid, schemeCode: code, fundName: code, category: cat, units: value / nav, currentNav: nav, currentValue: value })

describe('needToday / SIP math', () => {
  it('with no SIP it is the plain present value of the target', () => {
    expect(needToday({ target: 2000000, years: 3, annualReturn: 0.1, sip: 0 })).toBeCloseTo(2000000 / 1.331, 0)
  })
  it('the SIP plus what you should have today reaches exactly the target', () => {
    const t = 4000000, y = 8, r = 0.12, sip = 12000
    const need = needToday({ target: t, years: y, annualReturn: r, sip })
    expect(projectValue({ has: need, sip, annualReturn: r, years: y })).toBeCloseTo(t, -1)
  })
  it('the extra SIP closes a gap by the goal date (never less than needed)', () => {
    const gap = 300000, y = 3, r = 0.1
    const add = sipForAmount({ amountToday: gap, years: y, annualReturn: r })
    expect(add % 500).toBe(0)
    expect(projectValue({ has: 0, sip: add, annualReturn: r, years: y })).toBeGreaterThanOrEqual(gap * Math.pow(1 + r, y) - 1)
  })
})

describe('switch steps', () => {
  it('nothing moves inside the band', () => {
    const att = { total: 100, equity: 33, items: [] }
    expect(switchSteps({ att, targetEq: 0.3, mfHoldings: [], eqOf })).toEqual([])
    expect(BAND).toBe(5)
  })
  it('over equity: sells units of the equity fund and buys the debt fund in the same portfolio', () => {
    const H = [mf('P', 'EQ', 'Equity', 600000, 84.2), mf('P', 'LIQ', 'Debt', 400000, 3412.55)]
    const goals = [{ goalId: 'HOUSE' }]
    const a = attributeGoals({ goals, targetOf: () => 0.3, mappings: [{ goalId: 'HOUSE', portfolioId: 'P', allocationPct: 100 }], mfHoldings: H, allocMap: {} })
    const s = switchSteps({ att: a.HOUSE, targetEq: 0.3, mfHoldings: H, eqOf })
    expect(s).toHaveLength(1)
    expect(s[0].from.schemeCode).toBe('EQ'); expect(s[0].to.schemeCode).toBe('LIQ')
    expect(s[0].sellValue).toBeCloseTo(300000, 0)            // 60% -> 30% of 10 L
    expect(s[0].units).toBeCloseTo(300000 / 84.2, 3)
  })
  it('shared portfolio: the near goal takes the debt, so neither goal gets a false switch', () => {
    const H = [mf('P', 'EQ', 'Equity', 500000), mf('P', 'DEBT', 'Debt', 500000)]
    const goals = [{ goalId: 'NEAR' }, { goalId: 'FAR' }]
    const T = { NEAR: 0.1, FAR: 0.85 }
    const a = attributeGoals({ goals, targetOf: (g) => T[g.goalId], mappings: [{ goalId: 'NEAR', portfolioId: 'P', allocationPct: 50 }, { goalId: 'FAR', portfolioId: 'P', allocationPct: 50 }], mfHoldings: H, allocMap: {} })
    expect(switchSteps({ att: a.NEAR, targetEq: 0.1, mfHoldings: H, eqOf })).toEqual([])
    // the far goal is left with the rest of the debt and asks for more equity, inside its own share only
    const far = switchSteps({ att: a.FAR, targetEq: 0.85, mfHoldings: H, eqOf })
    expect(far.reduce((s, x) => s + x.sellValue, 0)).toBeLessThanOrEqual(500000)
  })
})

describe('buildGoalPlan', () => {
  const H = [mf('P1', 'EQ', 'Equity', 460000, 84.2), mf('P1', 'LIQ', 'Debt', 640000, 3412.55),
    mf('P2', 'FLEXI', 'Equity', 1000000), mf('P2', 'CONS', 'Debt', 300000)]
  const goals = [
    { goalId: 'HOUSE', goalType: 'Home', targetDate: inYears(3), targetAmount: 2000000, monthlyInvestment: 5000, expectedCAGR: 0.1 },
    { goalId: 'KID', goalType: 'Education', targetDate: inYears(11), targetAmount: 1500000, monthlyInvestment: 5000, expectedCAGR: 0.12 },
  ]
  const mappings = [{ goalId: 'HOUSE', portfolioId: 'P1', allocationPct: 100 }, { goalId: 'KID', portfolioId: 'P2', allocationPct: 100 }]
  const targetOf = (g) => g.goalId === 'HOUSE' ? 0.3 : 0.85
  const att = attributeGoals({ goals, targetOf, mappings, mfHoldings: H, allocMap: {} })
  const plan = buildGoalPlan({ goals, attribution: att, mfHoldings: H, mappings, eqOf, now: NOW })
  const house = plan.goals.find((p) => p.goal.goalId === 'HOUSE'), kid = plan.goals.find((p) => p.goal.goalId === 'KID')

  it('nearest goal first', () => { expect(plan.goals[0].goal.goalId).toBe('HOUSE') })
  it('gap = have − should have today; lump sum today = the short gap', () => {
    expect(house.gap).toBeCloseTo(house.has - house.need, 6)
    if (house.state === 'short') expect(house.lumpToday).toBeCloseTo(-house.gap, 6)
  })
  it('house is within band (42% vs 30% is 12 points → a switch)', () => {
    expect(house.eqNow).toBe(42)
    expect(house.steps.some((s) => s.t === 'switch')).toBe(true)
  })
  it('a goal with extra money gives SIP to a goal that is short, never more than its own SIP', () => {
    const mv = kid.steps.filter((s) => s.t === 'move').reduce((s, x) => s + x.amount, 0)
    expect(mv).toBeLessThanOrEqual(kid.sip)
  })
  it('road: switches only when the glide path drops 5 points or more', () => {
    for (const st of house.road.filter((s) => s.k === 'safer')) expect(st.eq0 - st.eq).toBeGreaterThanOrEqual(BAND)
    expect(house.road[house.road.length - 1].k).toBe('goal')
  })
  it('portfolio view: one portfolio, its equity vs what its goals need together', () => {
    const p1 = plan.portfolios.find((p) => p.portfolioId === 'P1')
    expect(p1.equityPct).toBe(42); expect(p1.targetPct).toBe(30)
  })
})
