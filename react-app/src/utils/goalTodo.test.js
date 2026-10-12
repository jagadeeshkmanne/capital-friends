import { describe, it, expect } from 'vitest'
import { goalTodo } from './goalTodo'

const g = (id, type, extra = {}) => ({ goalId: id, goalName: id, goalType: type, familyMemberName: 'J', ...extra })
const H = [
  { portfolioId: 'P', schemeCode: 'A', fundName: 'Flexi', units: 1000, currentNav: 100, currentValue: 100000, targetAllocationPct: 60, ongoingSIP: 6000 },
  { portfolioId: 'P', schemeCode: 'B', fundName: 'Midcap', units: 500, currentNav: 100, currentValue: 50000, targetAllocationPct: 40, ongoingSIP: 4000 },
  { portfolioId: 'K', schemeCode: 'C', fundName: 'Kid fund', units: 100, currentNav: 100, currentValue: 10000, targetAllocationPct: 100, ongoingSIP: 5000 },
]
const poolItems = [{ id: 'P', type: 'MF', included: true, value: 150000, owner: 'J' }, { id: 'K', type: 'MF', included: false, value: 10000, owner: 'Kid' }]
const mfPortfolios = [{ portfolioId: 'P', sipTarget: 10000 }, { portfolioId: 'K', sipTarget: 5000 }]
const items = H.slice(0, 2).map((h) => ({ kind: 'mf', portfolioId: 'P', holding: h, value: h.currentValue, fraction: 1 }))

describe('to do this month', () => {
  it('nothing to do: no steps, no banner', () => {
    const r = goalTodo({ plans: [{ goal: g('R', 'Retirement'), state: 'onplan', gap: 0, years: 10, has: 1, att: { items } }], family: { status: 'ok' }, poolItems, mfHoldings: H, mfPortfolios })
    expect(r.steps).toEqual([]); expect(r.banner).toBe(null)
  })
  it('short: one portfolio-level SIP or a lump sum split by the fund targets; banner only for a real shortfall', () => {
    const p = { goal: g('E', 'Education'), state: 'short', gap: -59000, years: 12, has: 150000, sip: 2000, sipNeeded: 2800, att: { items } }
    const r = goalTodo({ plans: [p], family: { status: 'ok' }, poolItems, mfHoldings: H, mfPortfolios })
    const s = r.steps[0]
    expect(s.t).toBe('short'); expect(s.sipRows[0]).toMatchObject({ portfolioId: 'P', sipFrom: 10000, sip: 800 }); expect(s.sip).toBe(800)
    expect(s.buys.reduce((t, b) => t + b.amount, 0)).toBe(59000)
    expect(r.banner).toBe(null) // ₹800 more is just a step, not a warning
    const big = goalTodo({ plans: [{ ...p, sipNeeded: 40000 }], family: { status: 'ok' }, poolItems, mfHoldings: H, mfPortfolios })
    expect(big.banner).toMatchObject({ runningSip: 10000, extraSip: 38000 }) // the left-out kids' portfolio SIP is not counted
  })
  it('a short goal with no money yet uses the member\'s own portfolio', () => {
    const p = { goal: g('E', 'Education'), state: 'short', gap: -100000, years: 8, has: 0, sip: 0, sipNeeded: 1200, att: { items: [] } }
    expect(goalTodo({ plans: [p], poolItems, mfHoldings: H, mfPortfolios }).steps[0].sipRows[0].portfolioId).toBe('P')
  })
  it('no investments at all: step without a portfolio, no crash', () => {
    const p = { goal: g('E', 'Education'), state: 'short', gap: -100000, years: 8, has: 0, sip: 0, sipNeeded: 1200, att: { items: [] } }
    const r = goalTodo({ plans: [p] })
    expect(r.steps[0].sipRows[0].portfolioId).toBe(null); expect(r.steps[0].buys).toEqual([])
  })
  it('date reached: withdraw rows with units; a retired goal gets no withdraw step', () => {
    const due = { goal: g('H', 'House Purchase'), state: 'due', gap: 0, years: 0, has: 150000, att: { items } }
    const ret = { goal: g('R', 'Retirement'), isRet: true, state: 'due', gap: 0, years: 0, has: 150000, att: { items } }
    const r = goalTodo({ plans: [due, ret], poolItems, mfHoldings: H, mfPortfolios })
    expect(r.steps.filter((s) => s.t === 'ready').length).toBe(1)
    expect(r.steps[0].rows[0]).toMatchObject({ name: 'Flexi', units: 1000, all: true })
  })
  it('two short goals become ONE step for all goals together', () => {
    const a = { goal: g('A', 'Vehicle'), state: 'short', gap: -50000, years: 3, has: 1, sip: 0, sipNeeded: 1500, att: { items } }
    const b = { goal: g('B', 'Travel'), state: 'short', gap: -30000, years: 2, has: 1, sip: 0, sipNeeded: 1300, att: { items } }
    const r = goalTodo({ plans: [a, b], poolItems, mfHoldings: H, mfPortfolios })
    expect(r.steps.length).toBe(1); expect(r.steps[0].gap).toBe(80000); expect(r.steps[0].sipRows).toEqual([{ portfolioId: 'P', sip: 2800, sipFrom: 10000 }])
    expect(r.steps[0].buys.reduce((t, x) => t + x.amount, 0)).toBe(80000)
  })
  it('a past-due goal that is short gets no SIP step (no time left)', () => {
    const p = { goal: g('C', 'Vehicle'), state: 'due', gap: -50000, years: 0, has: 50000, att: { items } }
    expect(goalTodo({ plans: [p], poolItems, mfHoldings: H, mfPortfolios }).steps.map((s) => s.t)).toEqual(['ready'])
  })
  it('family plan: idle cash and one switch become steps', () => {
    const family = { status: 'steps', steps: [
      { t: 'lump', from: { id: 'S', name: 'Savings' }, fund: H[0], portfolioId: 'P', amount: 300000 },
      { t: 'sell', fund: H[1], portfolioId: 'P', value: 20000, units: 200 },
      { t: 'buy', fund: H[0], portfolioId: 'P', value: 20000, wantSafe: false }] }
    const r = goalTodo({ plans: [], family, poolItems, mfHoldings: H, mfPortfolios })
    expect(r.steps.map((s) => s.t)).toEqual(['cash', 'switch'])
    expect(r.steps[1].sells[0].units).toBe(200)
  })

  it('a near goal far above its equity target gets a move-to-safe step in its portfolio', () => {
    const eqF = { fundName: 'Flexi Cap', schemeCode: 'E1', units: 1000, currentValue: 900000, currentNav: 900, portfolioId: 'P1' }
    const dF = { fundName: 'Liquid', schemeCode: 'D1', units: 100, currentValue: 50000, currentNav: 500, portfolioId: 'P1' }
    const home = { goal: { goalId: 'G1', goalName: 'Home' }, state: 'ok', years: 2.3, eqNow: 100, eqTarget: 30, has: 900000, gap: 0,
      att: { items: [{ kind: 'mf', portfolioId: 'P1', holding: eqF, value: 900000, eq: 1 }] } }
    const ef = { goal: { goalId: 'G2', goalName: 'EF' }, state: 'ok', years: 0.2, eqNow: 0, eqTarget: 0, has: 50000, gap: 0,
      att: { items: [{ kind: 'mf', portfolioId: 'P1', holding: dF, value: 50000, eq: 0 }] } }
    const { steps } = goalTodo({ plans: [home, ef] })
    const st = steps.find((x) => x.t === 'protect')
    expect(st).toBeTruthy()
    expect(st.total).toBe(630000)
    expect(st.sells[0].units).toBeCloseTo(700, 0)
    expect(st.buy.schemeCode).toBe('D1')
    // within 20 points: nothing
    expect(goalTodo({ plans: [{ ...home, eqNow: 45 }] }).steps.some((x) => x.t === 'protect')).toBe(false)
  })

  it('"Make it safer" never sells ELSS, and never sells units the family switch already sells', () => {
    const elss = { fundName: 'Axis ELSS Tax Saver', category: 'ELSS', schemeCode: 'X1', units: 100, currentValue: 500000, currentNav: 5000, portfolioId: 'P1' }
    const eqF = { fundName: 'Flexi Cap', schemeCode: 'E1', units: 1000, currentValue: 400000, currentNav: 400, portfolioId: 'P1' }
    const home = { goal: { goalId: 'G1', goalName: 'Home' }, state: 'ok', years: 2, eqNow: 100, eqTarget: 30, has: 900000, gap: 0,
      att: { items: [{ kind: 'mf', portfolioId: 'P1', holding: elss, value: 500000, eq: 1 }, { kind: 'mf', portfolioId: 'P1', holding: eqF, value: 400000, eq: 1 }] } }
    const family = { status: 'steps', steps: [{ t: 'sell', portfolioId: 'P1', fund: eqF, value: 300000 }, { t: 'buy', portfolioId: 'P1', fund: null, value: 300000, wantSafe: true }] }
    const { steps } = goalTodo({ plans: [home], family })
    const st = steps.find((x) => x.t === 'protect')
    expect(st.sells.every((r) => r.fund.schemeCode !== 'X1')).toBe(true)
    expect(st.total).toBe(100000) // only the ₹1 L of Flexi Cap the switch does not already sell
  })
})
