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
  it('sorts investments by type: EPF retirement-only, gold left out, kids portfolio can be switched off', () => {
    expect(otherKind({ investmentType: 'EPF' })).toBe('retirement')
    expect(otherKind({ investmentType: 'Physical Gold' })).toBe('out')
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
    const items = [{ id: 'EQ', type: 'MF', value: 9000000, eq: 1, kind: 'pool', included: true }, { id: 'SAFE', type: 'Other', value: 9000000, eq: 0, kind: 'pool', included: true }]
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
    const kid = { ...KID, targetDate: inY(1), familyMemberName: 'Visali' }
    const r2 = sharePool({ goals: [kid, RJ], items, now: NOW })
    expect(r2.byGoal.KID.got).toBeGreaterThan(500000)
  })
})
