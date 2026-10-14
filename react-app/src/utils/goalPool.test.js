import { describe, it, expect } from 'vitest'
import { poolItems, sharePool, otherKind, linksChanged } from './goalPool'
import { buildGoalPlan } from './goalPlan'
import { attributeFamilyGoals } from './goalAttribution'

const NOW = new Date('2026-10-12T00:00:00Z')
const inY = (y) => new Date(NOW.getTime() + y * 365.25 * 864e5).toISOString()
const eqOf = (h) => (h.category === 'Debt' ? 0 : 1)
const mfP = [{ portfolioId: 'CORE', portfolioName: 'Core', status: 'Active' }, { portfolioId: 'KIDS', portfolioName: 'Kids', status: 'Active' }, { portfolioId: 'SAFE', portfolioName: 'Safe', status: 'Active' }]
const mfH = [
  { portfolioId: 'CORE', category: 'Equity', units: 1, currentValue: 4000000 },
  { portfolioId: 'KIDS', category: 'Equity', units: 1, currentValue: 500000 },
  { portfolioId: 'SAFE', category: 'Debt', units: 1, currentValue: 1000000 },
]
const other = [
  { investmentId: 'EPF', investmentType: 'EPF', investmentCategory: 'Debt', currentValue: 2000000, status: 'Active' },
  { investmentId: 'FD', investmentType: 'Fixed Deposit', investmentCategory: 'Debt', currentValue: 500000, status: 'Active' },
  { investmentId: 'GOLD', investmentType: 'Physical Gold', investmentCategory: 'Gold', currentValue: 800000, status: 'Active' },
]
const RET = { goalId: 'RET', goalType: 'Retirement', targetDate: inY(10), targetAmount: 30000000, expectedCAGR: 0.12, isActive: true }
const KID = { goalId: 'KID', goalType: 'Education', targetDate: inY(3), targetAmount: 1500000, expectedCAGR: 0.1, isActive: true }
const EF = { goalId: 'EF', goalType: 'Emergency Fund', targetDate: inY(0.5), targetAmount: 600000, expectedCAGR: 0.06, isActive: true }

describe('money for goals', () => {
  it('sorts investments by type: EPF retirement-only, gold never for goals, kids portfolio can be switched off', () => {
    expect(otherKind({ investmentType: 'EPF' })).toBe('retirement')
    expect(otherKind({ investmentType: 'Physical Gold' })).toBe('locked')
    expect(otherKind({ investmentType: 'Fixed Deposit' })).toBe('pool')
    const it = poolItems({ mfPortfolios: mfP, mfHoldings: mfH, otherInvList: other, eqOf, choice: { off: ['KIDS'] } })
    expect(it.find((x) => x.id === 'KIDS').included).toBe(false)
    expect(it.find((x) => x.id === 'GOLD').included).toBe(false)
    expect(it.find((x) => x.id === 'EPF').included).toBe(true)
  })
  it('shares the pool: emergency fund and near goal get safe money, retirement gets EPF + equity, kids portfolio untouched', () => {
    const items = poolItems({ mfPortfolios: mfP, mfHoldings: mfH, otherInvList: other, eqOf, choice: { off: ['KIDS'] } })
    const r = sharePool({ goals: [RET, KID, EF], items, now: NOW })
    const on = (g, id) => r.mappings.find((m) => m.goalId === g && m.portfolioId === id)?.allocationPct || 0
    expect(r.mappings.some((m) => m.portfolioId === 'KIDS' || m.portfolioId === 'GOLD')).toBe(false)
    expect(on('RET', 'EPF')).toBe(100)
    expect(on('EF', 'CORE')).toBe(0) // emergency fund never takes equity
    expect(on('EF', 'SAFE') + on('EF', 'FD')).toBeGreaterThan(0)
    expect(on('RET', 'CORE')).toBeGreaterThan(50)
    // no investment is shared out over 100%
    for (const id of ['CORE', 'SAFE', 'FD', 'EPF']) expect(r.mappings.filter((m) => m.portfolioId === id).reduce((t, m) => t + m.allocationPct, 0)).toBeLessThanOrEqual(100.01)
  })
  it('money beyond what goals need today is extra (not pushed into a goal)', () => {
    const items = poolItems({ mfPortfolios: mfP, mfHoldings: mfH, otherInvList: other, eqOf })
    const small = { ...KID, targetAmount: 300000 }
    const r = sharePool({ goals: [small], items, now: NOW })
    expect(r.byGoal.KID.got).toBeCloseTo(r.byGoal.KID.want, -1)
    expect(r.extra).toBeGreaterThan(0)
  })
  it('a running SIP lowers what a goal needs today (frees money for the others)', () => {
    const items = [{ id: 'P', type: 'MF', value: 5000000, eq: 1, kind: 'pool', included: true }]
    const a = sharePool({ goals: [KID], items, now: NOW }), b = sharePool({ goals: [KID], items, now: NOW, sipOf: { KID: 20000 } })
    expect(b.byGoal.KID.want).toBeLessThan(a.byGoal.KID.want)
  })
  it('linksChanged ignores small drifts', () => {
    const a = [{ goalId: 'G', portfolioId: 'P', allocationPct: 50 }]
    expect(linksChanged(a, [{ goalId: 'G', portfolioId: 'P', allocationPct: 51 }])).toBe(false)
    expect(linksChanged(a, [{ goalId: 'G', portfolioId: 'P', allocationPct: 55 }])).toBe(true)
    expect(linksChanged(a, [])).toBe(true)
  })
  it('cash from an EPF payout stays with retirement first', () => {
    const paid = [...other.filter((o) => o.investmentId !== 'EPF'), { investmentId: 'CASH', investmentType: 'Cash / Savings', investmentCategory: 'Cash', currentValue: 2000000, status: 'Active', notes: 'From EPF' }]
    const items = poolItems({ mfPortfolios: mfP, mfHoldings: mfH, otherInvList: paid, eqOf })
    const r = sharePool({ goals: [RET, KID, EF], items, now: NOW })
    expect(r.mappings.find((m) => m.goalId === 'RET' && m.portfolioId === 'CASH')?.allocationPct).toBe(100)
  })

  // ---- regression: review findings ----
  it('a goal with an invalid or missing date, or no amount, is skipped (no crash)', () => {
    const items = poolItems({ mfPortfolios: mfP, mfHoldings: mfH, otherInvList: other, eqOf })
    const bad = [{ ...KID, goalId: 'BAD', goalType: 'Vehicle', targetDate: 'not a date' }, { ...KID, goalId: 'ND', targetDate: '' }, { ...KID, goalId: 'Z', targetAmount: 0 }]
    const r = sharePool({ goals: [...bad, KID], items, now: NOW })
    expect(Object.keys(r.byGoal)).toEqual(['KID'])
    expect(r.mappings.every((m) => m.goalId === 'KID')).toBe(true)
    expect(() => buildGoalPlan({ goals: [...bad, KID], attribution: {}, mfHoldings: mfH, mappings: [], eqOf, now: NOW, pool: true })).not.toThrow()
  })
  it('the emergency fund wants its full amount today, even with a far date', () => {
    const items = poolItems({ mfPortfolios: mfP, mfHoldings: mfH, otherInvList: other, eqOf })
    const far = { ...EF, targetDate: inY(5) }
    const r = sharePool({ goals: [far], items, now: NOW })
    expect(r.byGoal.EF.want).toBe(600000)
    expect(r.byGoal.EF.got).toBeCloseTo(600000, -1)
    expect(r.byGoal.EF.gotEq).toBe(0)
  })
  it('retirement with EPF above its amount gets no extra equity (nothing to sell later)', () => {
    const items = poolItems({ mfPortfolios: mfP, mfHoldings: mfH, otherInvList: other, eqOf })
    const r = sharePool({ goals: [{ ...RET, targetAmount: 1000000 }], items, now: NOW })
    expect(r.mappings).toEqual([{ goalId: 'RET', portfolioId: 'EPF', allocationPct: 100, investmentType: 'Other' }])
  })
  it('no goal is given more than its full amount, and top-ups follow the goal\'s timeline mix', () => {
    const items = poolItems({ mfPortfolios: mfP, mfHoldings: mfH, otherInvList: other, eqOf })
    const car = { goalId: 'CAR', goalType: 'Vehicle', targetDate: inY(8), targetAmount: 100000, expectedCAGR: 0.1, isActive: true }
    const r = sharePool({ goals: [{ ...KID, targetAmount: 200000 }, car], items, now: NOW })
    for (const g of ['KID', 'CAR']) expect(r.byGoal[g].got).toBeLessThanOrEqual(r.byGoal[g].target + 1)
    // equity never goes above the glide-path share of the goal's full amount
    expect(r.byGoal.CAR.gotEq).toBeLessThanOrEqual(r.byGoal.CAR.target * r.byGoal.CAR.eq + 1)
  })
  it('one investment is never shared out over 100% (rounding)', () => {
    for (let v = 100001; v < 103001; v += 7) {
      const items = [{ id: 'S', type: 'Other', value: v, eq: 0, kind: 'pool', included: true }]
      const goals = [0.3337, 0.3331, 1].map((f, i) => ({ goalId: 'g' + i, goalType: 'Vehicle', targetDate: inY(0.3 + i / 10), targetAmount: v * f, isActive: true }))
      const sum = sharePool({ goals, items, now: NOW }).mappings.reduce((t, m) => t + m.allocationPct, 0)
      expect(sum).toBeLessThanOrEqual(100.01)
    }
  })
  it('sold-out stocks (quantity 0) are not counted in the pool', () => {
    const items = poolItems({ stockPortfolios: [{ portfolioId: 'STK', portfolioName: 'Stk', status: 'Active' }], stockHoldings: [{ portfolioId: 'STK', symbol: 'TCS', quantity: 0, currentValue: 800000 }, { portfolioId: 'STK', symbol: 'INFY', quantity: 5, currentValue: 100000 }], eqOf })
    expect(items[0].value).toBe(100000)
  })
  it('linksChanged: a tiny share (< 0.5%) the sheet may read back as 0 does not count as a change', () => {
    const items = [{ id: 'S', type: 'Other', value: 1e7, eq: 0, kind: 'pool', included: true }]
    const goals = [{ ...EF, targetAmount: 30000 }, { goalId: 'BIG', goalType: 'Vehicle', targetDate: inY(1), targetAmount: 9e6, isActive: true }]
    const { mappings } = sharePool({ goals, items, now: NOW })
    expect(mappings.find((m) => m.goalId === 'EF').allocationPct).toBeLessThan(0.5)
    expect(linksChanged(mappings.map((m) => ({ ...m, allocationPct: Math.round(m.allocationPct) })), mappings)).toBe(false)
    expect(linksChanged(mappings, mappings)).toBe(false)
  })
  it('same inputs give the same links (stable order for goals on the same date)', () => {
    const items = poolItems({ mfPortfolios: mfP, mfHoldings: mfH, otherInvList: other, eqOf })
    const a = sharePool({ goals: [RET, KID, EF], items, now: NOW }).mappings
    const b = sharePool({ goals: [RET, KID, EF], items, now: NOW }).mappings
    expect(b).toEqual(a)
  })
  it('pool mode: a goal reached early is "achieved" but keeps its timeline mix (glide path), no protect step', () => {
    const att = { total: 1000000, equity: 800000, items: [] }
    const goals = [{ ...RET, targetAmount: 900000 }, { ...KID, targetAmount: 900000 }]
    const { goals: plans } = buildGoalPlan({ goals, attribution: { RET: att, KID: att }, mfHoldings: [], mappings: [], eqOf, now: NOW, pool: true })
    for (const p of plans) { expect(p.state).toBe('achieved'); expect(p.eqTarget).toBeGreaterThan(0); expect(p.steps.some((s) => s.t === 'protect')).toBe(false) }
  })
  it('timeline: a goal 1 year away gets safe money, one 10 years away gets equity; no goal ahead while another is short', () => {
    const items = [{ id: 'EQ', type: 'MF', value: 25000000, eq: 1, kind: 'pool', included: true }, { id: 'SAFE', type: 'Other', value: 15000000, eq: 0, kind: 'pool', included: true }]
    const HOUSE = { goalId: 'HOUSE', goalType: 'House Purchase', targetDate: inY(1), targetAmount: 8000000, isActive: true }
    const R4 = { ...RET, targetDate: inY(4), targetAmount: 20000000 }
    const EDU = { goalId: 'EDU', goalType: 'Education', targetDate: inY(10), targetAmount: 15000000, isActive: true }
    const r = sharePool({ goals: [EDU, R4, HOUSE], items, now: NOW })
    const eqShare = (id) => r.byGoal[id].gotEq / r.byGoal[id].got
    expect(eqShare('HOUSE')).toBeLessThan(0.2)
    expect(eqShare('EDU')).toBeGreaterThan(0.5)
    const states = Object.values(r.byGoal).map((m) => Math.sign(Math.round((m.got - m.want) / 1000)))
    expect(states.includes(1) && states.includes(-1)).toBe(false)
  })
  it('pool mode: a goal past its date with money shows "ready"; the emergency fund needs its full amount', () => {
    const att = { total: 500000, equity: 0, items: [] }
    const old = { goalId: 'OLD', goalType: 'Vehicle', targetDate: inY(-1), targetAmount: 500000, isActive: true }
    const { goals: plans } = buildGoalPlan({ goals: [old, { ...EF, targetDate: inY(3) }], attribution: { OLD: att, EF: { total: 0, equity: 0, items: [] } }, mfHoldings: [], mappings: [], eqOf, now: NOW, pool: true })
    expect(plans.find((p) => p.goal.goalId === 'OLD').steps.map((s) => s.t)).toContain('ready')
    expect(plans.find((p) => p.goal.goalId === 'EF').need).toBe(600000)
  })

  // ---- regression: round 3 (owners, step D/E) ----
  const own = (id, owner, rows) => ({ p: { portfolioId: id, portfolioName: id, status: 'Active', ownerName: owner }, h: rows.map(([code, cat, v]) => ({ portfolioId: id, schemeCode: code, category: cat, units: 1, currentValue: v })) })
  it('two members, two retirement goals: each takes its own EPF and its own portfolio', () => {
    const J = own('JM', 'Jagadeesh', [['JE', 'Equity', 4000000], ['JD', 'Debt', 500000]]), V = own('VM', 'Visali', [['VE', 'Equity', 1500000], ['VD', 'Debt', 300000]])
    const epf = [{ investmentId: 'JEPF', investmentType: 'EPF', investmentCategory: 'Debt', currentValue: 3000000, status: 'Active', familyMemberName: 'Jagadeesh' },
      { investmentId: 'VEPF', investmentType: 'EPF', investmentCategory: 'Debt', currentValue: 800000, status: 'Active', familyMemberName: 'Visali' }]
    const items = poolItems({ mfPortfolios: [J.p, V.p], mfHoldings: [...J.h, ...V.h], otherInvList: epf, eqOf })
    const RJ = { ...RET, goalId: 'RJ', targetDate: inY(18), targetAmount: 60000000, familyMemberName: 'Jagadeesh' }
    const RV = { ...RET, goalId: 'RV', targetDate: inY(22), targetAmount: 40000000, familyMemberName: 'Visali' }
    const r = sharePool({ goals: [RJ, RV], items, now: NOW })
    const links = r.mappings.map((m) => `${m.goalId}<-${m.portfolioId}`).sort()
    expect(links).toEqual(['RJ<-JEPF', 'RJ<-JM', 'RV<-VEPF', 'RV<-VM'])
    // a member with no retirement goal: her EPF falls back to the family's retirement goal
    const r2 = sharePool({ goals: [RJ], items, now: NOW })
    expect(r2.mappings.find((m) => m.portfolioId === 'VEPF')?.goalId).toBe('RJ')
  })
  it('"From EPF" cash goes to its owner\'s retirement goal', () => {
    const cash = { investmentId: 'CASH', investmentType: 'Savings', investmentCategory: 'Cash', currentValue: 1000000, status: 'Active', familyMemberName: 'Visali', notes: 'From EPF payout' }
    const items = poolItems({ otherInvList: [cash], eqOf })
    const RJ = { ...RET, goalId: 'RJ', familyMemberName: 'Jagadeesh' }, RV = { ...RET, goalId: 'RV', familyMemberName: 'Visali' }
    const r = sharePool({ goals: [RJ, RV, KID], items, now: NOW })
    expect(r.mappings.find((m) => m.portfolioId === 'CASH')?.goalId).toBe('RV')
  })
  it('pool much more than all needs: each goal gets what it needs, the rest is extra, no "Protect it" step', () => {
    const items = poolItems({ mfPortfolios: mfP, mfHoldings: mfH, otherInvList: other, eqOf })
    const goals = [{ ...RET, targetAmount: 1000000 }, { ...EF, targetAmount: 100000 }, { ...KID, targetAmount: 200000 },
      { goalId: 'CAR', goalType: 'Vehicle', targetDate: inY(8), targetAmount: 100000, expectedCAGR: 0.1, isActive: true }]
    const r = sharePool({ goals, items, now: NOW })
    for (const g of ['EF', 'KID', 'CAR']) expect(r.byGoal[g].got).toBeCloseTo(r.byGoal[g].want, -1)
    expect(r.byGoal.EF.gotEq).toBeLessThan(1)
    expect(r.extra).toBeGreaterThan(0)
    const att = attributeFamilyGoals({ goals, mappings: r.mappings, mfHoldings: mfH, otherInvList: other, now: NOW })
    const plans = buildGoalPlan({ goals, attribution: att, mfHoldings: mfH, mappings: r.mappings, eqOf, now: NOW, pool: true }).goals
    expect(plans.flatMap((p) => p.steps).some((s) => s.t === 'protect')).toBe(false)
  })
  it('retirement 20 years out with an equity + debt pool: gets the equity first and keeps its glide path', () => {
    const items = [{ id: 'EQ', type: 'MF', value: 1500000, eq: 1, kind: 'pool', included: true }, { id: 'DB', type: 'MF', value: 2000000, eq: 0, kind: 'pool', included: true }]
    const r = sharePool({ goals: [{ ...RET, targetAmount: 3000000 }], items, now: NOW })
    expect(r.byGoal.RET.gotEq).toBeGreaterThan(r.byGoal.RET.got * 0.5) // equity first for a far goal
    expect(r.byGoal.RET.got).toBeCloseTo(r.byGoal.RET.want, -1)
  })
  it('random pools: no investment over 100%, no NaN, no non-retirement goal over its amount, same result twice (incl. step E)', () => {
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
    const types = ['Retirement', 'Emergency Fund', 'Education', 'Vehicle', 'Home'], who = ['A', 'B', undefined]
    for (let n = 0; n < 1500; n++) {
      const items = Array.from({ length: 1 + Math.floor(rnd() * 6) }, (_, i) => ({ id: 'i' + i, type: 'MF', value: Math.round(rnd() * 5e6), eq: [0, 0.3, 0.65, 1][Math.floor(rnd() * 4)], kind: rnd() < 0.15 ? 'retirement' : 'pool', included: true, owner: who[Math.floor(rnd() * 3)], fromRetirement: rnd() < 0.1 }))
      const goals = Array.from({ length: 1 + Math.floor(rnd() * 5) }, (_, i) => ({ goalId: 'g' + i, goalType: types[Math.floor(rnd() * 5)], targetDate: inY(rnd() * 25 - 1), targetAmount: Math.round(rnd() * 2e7), expectedCAGR: 0.1, isActive: true, familyMemberName: who[Math.floor(rnd() * 3)] }))
      const r = sharePool({ goals, items, now: NOW })
      const sum = {}; for (const m of r.mappings) { expect(m.allocationPct).toBeGreaterThan(0); sum[m.portfolioId] = (sum[m.portfolioId] || 0) + m.allocationPct }
      for (const v of Object.values(sum)) expect(v).toBeLessThanOrEqual(100.0101)
      expect(JSON.stringify(r)).not.toMatch(/NaN|Infinity/)
      for (const g of goals) { const m = r.byGoal[g.goalId]; if (m && g.goalType !== 'Retirement') expect(m.got).toBeLessThanOrEqual(m.target + 1) }
      expect(JSON.stringify(sharePool({ goals, items, now: NOW }))).toBe(JSON.stringify(r))
    }
  })
  // OPEN BUG (review round 3): the "own member first" round lets a far goal of one member take safe money
  // before the emergency fund / a near goal of another member. Enable once fixed.
  it('the emergency fund and near goals get safe money before another member\'s far goal', () => {
    const items = [{ id: 'JE', type: 'MF', value: 1000000, eq: 1, kind: 'pool', included: true, owner: 'Jagadeesh' },
      { id: 'FD', type: 'Other', value: 600000, eq: 0, kind: 'pool', included: true, owner: 'Jagadeesh' }]
    const RJ = { ...RET, goalId: 'RJ', targetDate: inY(18), targetAmount: 60000000, familyMemberName: 'Jagadeesh' }
    const r = sharePool({ goals: [EF, RJ], items, now: NOW })
    expect(r.byGoal.EF.got).toBeCloseTo(600000, -1)
    // a near goal with a higher priority gets the money first, and its safe part is the safe money
    const kid = { ...KID, targetDate: inY(1), familyMemberName: 'Visali', priority: 'High' }
    const r2 = sharePool({ goals: [kid, RJ], items, now: NOW })
    expect(r2.byGoal.KID.got).toBeGreaterThan(500000)
    expect(r2.mappings.some((m) => m.goalId === 'KID' && m.portfolioId === 'FD')).toBe(true)
  })
})

describe('corner cases (ages, timelines, shortages)', () => {
  const now = new Date('2026-10-12'); const inY = (y) => new Date(now.getTime() + y * 365.25 * 864e5).toISOString()
  const g = (id, type, y, amt, who) => ({ goalId: id, goalType: type, targetDate: inY(y), targetAmount: amt, isActive: true, expectedCAGR: 0.11, familyMemberName: who })
  const EQ = (v, o = '') => ({ id: 'EQ' + o, type: 'MF', value: v, eq: 1, kind: 'pool', included: true, owner: o })
  const SF = (v, o = '') => ({ id: 'SF' + o, type: 'Other', value: v, eq: 0, kind: 'pool', included: true, owner: o })
  const EPF = (v, o = '') => ({ id: 'EPF' + o, type: 'Other', value: v, eq: 0, kind: 'retirement', locked: true, included: true, owner: o })
  it('money short: retirement is funded first (no loans for retirement)', () => {
    const r = sharePool({ goals: [g('HOUSE', 'House Purchase', 1, 8e6), g('RET', 'Retirement', 4.3, 3.84e7), g('EDU', 'Education', 9.6, 1.5e7)], items: [EQ(2e6), SF(1e6)], now })
    expect(r.byGoal.RET.got).toBeGreaterThan(r.byGoal.EDU.got)
  })
  it('no goal gets more than it needs (except EPF / PPF that only retirement can use)', () => {
    const r = sharePool({ goals: [g('RJ', 'Retirement', 15, 6e7, 'J'), g('RV', 'Retirement', 18, 4e7, 'V')], items: [EQ(1e7, 'J'), EPF(3e6, 'J'), EQ(3e6, 'V'), EPF(1e6, 'V')], now })
    for (const m of Object.values(r.byGoal)) expect(m.got).toBeLessThanOrEqual(Math.max(m.want, 3e6) + 1)
  })
  it('already retired: keeps a growth mix (not 0% equity) and no "withdraw" step', () => {
    const r = sharePool({ goals: [g('RET', 'Retirement', -3, 3e7)], items: [EQ(1.5e7), SF(8e6), EPF(5e6)], now })
    expect(r.byGoal.RET.eq).toBeGreaterThan(0.5)
    const att = { RET: { total: 2.8e7, equity: 1.5e7, items: [] } }
    const p = buildGoalPlan({ goals: [g('RET', 'Retirement', -3, 3e7)], attribution: att, mfHoldings: [], mappings: [], eqOf: () => 1, now, pool: true }).goals[0]
    expect(p.eqTarget).toBeGreaterThan(0)
    expect(p.steps.some((s) => s.t === 'ready')).toBe(false)
  })
  it('emergency fund with only equity available still gets money (the plan then moves it to safe)', () => {
    const r = sharePool({ goals: [g('EF', 'Emergency Fund', 0.5, 6e5)], items: [EQ(1e6)], now })
    expect(r.byGoal.EF.got).toBeCloseTo(6e5, -2)
  })
  it('no investments / no goals / bad data: no crash', () => {
    expect(sharePool({ goals: [g('RET', 'Retirement', 20, 5e7)], items: [], now }).byGoal.RET.got).toBe(0)
    expect(sharePool({ goals: [], items: [EQ(5e6)], now }).extra).toBe(5e6)
    const r = sharePool({ goals: [{ goalId: 'BAD', goalType: 'Vehicle', targetDate: 'x', targetAmount: 1e6, isActive: true }, g('ZERO', 'Travel', 3, 0)], items: [EQ(5e6)], now })
    expect(r.mappings.length).toBe(0)
  })
  it('a goal past its date never takes money ahead of the others (after you withdraw, they are untouched)', () => {
    const items = [SF(1e6), EQ(5e6)]
    const goals = [g('CAR', 'Vehicle', -0.2, 1e6), g('EDU', 'Education', 6, 6e6)]
    const before = sharePool({ goals, items, now })
    // the links saved in the sheet keep the car's share; after the ₹10 L FD is withdrawn the car simply has less
    const after = sharePool({ goals, items: [SF(0), EQ(5e6)], now, reserved: before.mappings })
    expect(after.byGoal.EDU.got).toBeCloseTo(before.byGoal.EDU.got, -2)
    expect(after.byGoal.CAR.got).toBeLessThan(1000)
  })
  it('physical gold / silver, unlisted shares and crypto are never used for goals (not liquid), even if ticked before', () => {
    const list = [['PG', 'Physical Gold', 'Gold'], ['SIL', 'Physical Silver', 'Silver'], ['UNL', 'Unlisted Shares', 'Equity'], ['CR', 'Crypto', 'Alternative']]
      .map(([id, t, c]) => ({ investmentId: id, investmentType: t, investmentCategory: c, currentValue: 1e6, status: 'Active' }))
    const items = poolItems({ otherInvList: list, eqOf, choice: { on: list.map((x) => x.investmentId) } })
    expect(items.every((i) => i.kind === 'locked' && !i.included)).toBe(true)
    const r = sharePool({ goals: [g('EF', 'Emergency Fund', 0.5, 5e5), g('RET', 'Retirement', 20, 5e7)], items, now })
    expect(r.mappings.length).toBe(0)
  })
  it('ESOP / RSU is left out by default but can be switched on', () => {
    const rsu = { investmentId: 'RSU', investmentType: 'ESOP / RSU', investmentCategory: 'Equity', currentValue: 1e6, status: 'Active' }
    expect(poolItems({ otherInvList: [rsu], eqOf })[0].included).toBe(false)
    expect(poolItems({ otherInvList: [rsu], eqOf, choice: { on: ['RSU'] } })[0].included).toBe(true)
  })

  it('money short: higher priority first; the same priority shares the money at the same % of each need', () => {
    const items = [EQ(3e6), SF(1e6)]
    const a = g('EDU', 'Education', 8, 6e6), b = g('HOUSE', 'House Purchase', 4, 8e6)
    const r = sharePool({ goals: [a, b], items, now })
    const pa = r.byGoal.EDU.got / r.byGoal.EDU.want, pb = r.byGoal.HOUSE.got / r.byGoal.HOUSE.want
    expect(Math.abs(pa - pb)).toBeLessThan(0.02) // both get the same share of what they need
    const r2 = sharePool({ goals: [{ ...a, priority: 'High' }, b], items, now })
    expect(r2.byGoal.EDU.got).toBeCloseTo(r2.byGoal.EDU.want, -2) // High is funded in full first
    expect(r2.byGoal.HOUSE.got).toBeLessThan(r.byGoal.HOUSE.got)
    // the emergency fund always comes first, whatever the priorities
    const r3 = sharePool({ goals: [{ ...a, priority: 'High' }, g('EF', 'Emergency Fund', 0.5, 6e5)], items: [SF(5e5), EQ(1e6)], now })
    expect(r3.byGoal.EF.got).toBeCloseTo(6e5, -2) // in full (the family plan then moves any equity part to safe)
  })
})

describe('real estate: never used for goals', () => {
  const home = { investmentId: 'HOME', investmentType: 'Real Estate', investmentCategory: 'Property', currentValue: 16000000, status: 'Active', familyMemberName: 'Jagadeesh' }
  const fd = { investmentId: 'FD1', investmentType: 'Fixed Deposit', investmentCategory: 'Debt', currentValue: 1200000, status: 'Active', familyMemberName: 'Jagadeesh' }
  const items = (choice) => poolItems({ otherInvList: [home, fd], eqOf, choice })
  it('is its own kind and never included, even if it was ticked before', () => {
    expect(otherKind(home)).toBe('locked')
    expect(items({}).find((i) => i.id === 'HOME').included).toBe(false)
    expect(items({ on: ['HOME'] }).find((i) => i.id === 'HOME').included).toBe(false)
  })
  it('FD / cash still count (the sale money is added there)', () => {
    expect(items({}).find((i) => i.id === 'FD1').included).toBe(true)
  })
  it('EPF always counts, for retirement only', () => {
    const epf = { investmentId: 'EPF1', investmentType: 'EPF', investmentCategory: 'Debt', currentValue: 3000000, status: 'Active' }
    const it2 = poolItems({ otherInvList: [epf], eqOf, choice: { off: ['EPF1'] } })[0]
    expect(it2.kind).toBe('retirement')
    expect(it2.included).toBe(true)
  })
})

describe('SGB and digital gold: optional', () => {
  it('left out by default, counted as growth (never safe money) when ticked', () => {
    const sgb = { investmentId: 'SGB', investmentType: 'Sovereign Gold Bond', investmentCategory: 'Gold', currentValue: 1e6, status: 'Active' }
    const dg = { investmentId: 'DG', investmentType: 'Digital Gold', investmentCategory: 'Gold', currentValue: 5e5, status: 'Active' }
    expect(otherKind(sgb)).toBe('out'); expect(otherKind(dg)).toBe('out')
    expect(poolItems({ otherInvList: [sgb, dg], eqOf }).every((i) => !i.included)).toBe(true)
    const on = poolItems({ otherInvList: [sgb, dg], eqOf, choice: { on: ['SGB', 'DG'] } })
    expect(on.every((i) => i.included && i.eq === 1)).toBe(true)
  })
})

describe('funds keep their own mix (hybrid funds are sold whole)', () => {
  const now = new Date('2026-10-12T00:00:00Z')
  const inYrs = (y) => new Date(now.getTime() + y * 365.25 * 864e5).toISOString()
  const mixEq = (h) => h.eqPct
  const P = [{ portfolioId: 'MIX', portfolioName: 'Mixed', status: 'Active' }]
  const H = [
    { portfolioId: 'MIX', schemeCode: 'EQ', units: 1, currentValue: 6000000, eqPct: 1 },
    { portfolioId: 'MIX', schemeCode: 'LIQ', units: 1, currentValue: 1000000, eqPct: 0 },
    { portfolioId: 'MIX', schemeCode: 'HYB', units: 1, currentValue: 1000000, eqPct: 0.3 },
  ]
  const near = { goalId: 'NEAR', goalName: 'Car', goalType: 'Vehicle', targetDate: inYrs(1), targetAmount: 1200000, isActive: true }
  const far = { goalId: 'FAR', goalName: 'Retire', goalType: 'Retirement', targetDate: inYrs(20), targetAmount: 50000000, isActive: true }
  it('a near goal in a mostly-equity portfolio gets its debt and conservative hybrid funds first', () => {
    const items = poolItems({ mfPortfolios: P, mfHoldings: H, eqOf: mixEq })
    const r = sharePool({ goals: [near, far], items, now })
    const m = r.byGoal.NEAR
    expect(m.got).toBeGreaterThan(0)
    // mostly safe money: far less equity than the portfolio's 78%
    expect(m.gotEq / m.got).toBeLessThan(0.3)
    // the link is still one per portfolio
    expect(r.mappings.filter((x) => x.goalId === 'NEAR').map((x) => x.portfolioId)).toEqual(['MIX'])
  })
  it('a hybrid fund counts with its own equity: 30% equity gives 70% safe money', () => {
    const items = poolItems({ mfPortfolios: P, mfHoldings: [H[2]], eqOf: mixEq })
    const r = sharePool({ goals: [near], items, now })
    const m = r.byGoal.NEAR
    expect(Math.round((m.gotSafe / m.got) * 100)).toBe(70)
  })
})
