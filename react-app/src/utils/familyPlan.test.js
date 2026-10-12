import { describe, it, expect } from 'vitest'
import { familyPlan } from './familyPlan'

const eqOf = (h) => (h.category === 'Debt' ? 0 : 1)
const H = [
  { portfolioId: 'P', schemeCode: 'PP', fundName: 'Parag Parikh', category: 'Equity', units: 1000, currentNav: 460, currentValue: 460000, targetAllocationPct: 40, ongoingSIP: 15000 },
  { portfolioId: 'P', schemeCode: 'N50', fundName: 'Nifty 50', category: 'Equity', units: 1000, currentNav: 340, currentValue: 340000, targetAllocationPct: 40, ongoingSIP: 10000 },
  { portfolioId: 'P', schemeCode: 'LIQ', fundName: 'Liquid', category: 'Debt', units: 100, currentNav: 2000, currentValue: 200000, targetAllocationPct: 20, ongoingSIP: 0 },
]
const items = H.map((h) => ({ kind: 'mf', portfolioId: h.portfolioId, holding: h, value: h.currentValue, fraction: 1 }))
const plan = (eqTarget, has = 1000000, equity = 800000) => [{ has, eqTarget, att: { equity, items } }]

describe('family plan', () => {
  it('inside the band: nothing to do', () => {
    expect(familyPlan({ plans: plan(77), mfHoldings: H, included: new Set(['P']), eqOf }).status).toBe('ok')
  })
  it('too much equity: redirect SIPs first, from the fund most above target, into the liquid fund you hold', () => {
    const r = familyPlan({ plans: plan(70), mfHoldings: H, included: new Set(['P']), eqOf })
    expect(r.status).toBe('steps')
    expect(r.steps[0].t).toBe('sip-cut'); expect(r.steps[0].fund.schemeCode).toBe('PP')
    const add = r.steps.find((s) => s.t === 'sip-add'); expect(add.fund.schemeCode).toBe('LIQ')
    expect(r.steps.some((s) => s.t === 'sell')).toBe(false) // ₹1 L gap is covered by 6 months of SIP
  })
  it('a big gap: also one switch, units of the over-target fund, buy the liquid fund in the same portfolio', () => {
    const r = familyPlan({ plans: plan(30), mfHoldings: H, included: new Set(['P']), eqOf })
    const sells = r.steps.filter((s) => s.t === 'sell'); const buy = r.steps.find((s) => s.t === 'buy')
    expect(sells.length).toBeGreaterThan(0); expect(sells[0].fund.schemeCode).toBe('PP'); expect(sells[0].units).toBeGreaterThan(0)
    expect(buy.fund.schemeCode).toBe('LIQ')
    expect(Math.round(buy.value)).toBe(Math.round(sells.reduce((t, s) => t + s.value, 0)))
  })
  it('portfolios left out of goals are never touched', () => {
    const r = familyPlan({ plans: plan(30), mfHoldings: H, included: new Set(['OTHER']), eqOf })
    expect(r.steps.filter((s) => s.fund).length).toBe(0)
  })
  it('another goal\'s safe money (emergency fund) is never sold to buy equity for retirement', () => {
    const EFh = { portfolioId: 'EF', schemeCode: 'LIQ2', fundName: 'EF Liquid', category: 'Debt', units: 100, currentNav: 5000, currentValue: 500000, ongoingSIP: 5000 }
    const HH = [...H, EFh]
    const ef = { has: 500000, eqTarget: 0, att: { equity: 0, items: [{ kind: 'mf', portfolioId: 'EF', holding: EFh, value: 500000, fraction: 1 }] } }
    const ret = { has: 3000000, eqTarget: 85, att: { equity: 800000, items: [...items, { kind: 'other', portfolioId: 'EPF', value: 2000000 }] } }
    const r = familyPlan({ plans: [ef, ret], mfHoldings: HH, included: new Set(['P', 'EF']), eqOf, lockedIds: new Set(['EPF']) })
    expect(r.steps.some((s) => s.portfolioId === 'EF' && (s.t === 'sell' || s.t === 'sip-cut'))).toBe(false)
  })

  // ---- regression: review findings ----
  const fund = (pid, code, cat, v, extra = {}) => ({ portfolioId: pid, schemeCode: code, fundName: code, category: cat, units: v / 10, currentNav: 10, currentValue: v, ...extra })
  const mine = (hs, fraction = 1) => hs.map((h) => ({ kind: 'mf', portfolioId: h.portfolioId, holding: h, value: h.currentValue * fraction, fraction }))
  it('SIP steps show the fund\'s real SIP (not the goals\' part of it), in ₹500 steps', () => {
    const E = fund('P', 'E', 'Equity', 1000000, { ongoingSIP: 30000 }), D = fund('P', 'D', 'Debt', 100000, { ongoingSIP: 10000 })
    // the near goal owns only half of each fund
    const near = { has: 550000, eqTarget: 0, years: 1, att: { equity: 500000, items: mine([E, D], 0.5) } }
    const r = familyPlan({ plans: [near], mfHoldings: [E, D], included: new Set(['P']), eqOf })
    const cut = r.steps.find((s) => s.t === 'sip-cut'), add = r.steps.find((s) => s.t === 'sip-add')
    expect(cut.from).toBe(30000)
    expect((cut.from - cut.to) % 500).toBe(0)
    expect(cut.from - cut.to).toBeLessThanOrEqual(15000) // never more than the goal's half of the SIP
    expect(add.from).toBe(10000); expect(add.to).toBe(10000 + add.amount)
  })
  it('ELSS is never sold, even when its name has no "ELSS" in it', () => {
    const E = fund('P', 'AXIS LONG TERM EQUITY', 'ELSS', 3000000), D = fund('P', 'D', 'Debt', 300000)
    const r = familyPlan({ plans: [{ has: 3300000, eqTarget: 30, years: 2, att: { equity: 3000000, items: mine([E, D]) } }], mfHoldings: [E, D], included: new Set(['P']), eqOf })
    expect(r.steps.some((s) => s.t === 'sell')).toBe(false)
    expect(r.status).toBe('ok') // nothing it can do is shown as no steps, not an empty plan
  })
  it('funds blocked for SIP / lump sum are never a destination; buys stay in the selling portfolio', () => {
    const E = fund('P', 'E', 'Equity', 3000000, { ongoingSIP: 20000 }), D = fund('P', 'D', 'Debt', 300000, { sipRestricted: true, lumpsumRestricted: true })
    const OD = fund('Q', 'OD', 'Debt', 500000)
    const r = familyPlan({ plans: [{ has: 3300000, eqTarget: 30, years: 2, att: { equity: 3000000, items: mine([E, D]) } }], mfHoldings: [E, D, OD], included: new Set(['P', 'Q']), eqOf })
    for (const s of r.steps.filter((x) => x.t === 'sip-add' || x.t === 'buy')) { expect(s.fund).toBe(null); expect(s.portfolioId).toBe('P') }
    expect(r.steps.some((s) => s.t === 'buy')).toBe(true)
  })
  it('too little equity: a near goal\'s idle cash is never invested in equity', () => {
    const E = fund('P', 'E', 'Equity', 200000), D = fund('P', 'D', 'Debt', 300000)
    const cash = { id: 'SAV', name: 'Savings', value: 2000000 }
    const home = { has: 1366000, eqTarget: 50, years: 4, att: { equity: 0, items: [{ kind: 'other', portfolioId: 'SAV', value: 1366000 }] } }
    const ret = { has: 1134000, eqTarget: 85, years: 20, att: { equity: 200000, items: [...mine([E, D]), { kind: 'other', portfolioId: 'SAV', value: 634000 }] } }
    const r = familyPlan({ plans: [home, ret], mfHoldings: [E, D], included: new Set(['P', 'SAV']), cashItems: [cash], eqOf })
    const lumps = r.steps.filter((s) => s.t === 'lump').reduce((t, s) => t + s.amount, 0)
    expect(lumps).toBeLessThanOrEqual(634000)
    const moved = lumps + r.steps.filter((s) => s.t === 'sell').reduce((t, s) => t + s.value, 0)
    expect(moved).toBeLessThanOrEqual(0.85 * 1134000 - 200000 + 1) // only retirement's own gap
  })

  it('doable / after: what the steps move vs what is left for new SIPs (capped at the giving goals\' gap)', () => {
    const E = fund('P', 'E', 'Equity', 200000), D = fund('P', 'D', 'Debt', 300000)
    const cash = { id: 'SAV', name: 'Savings', value: 2000000 }
    const home = { has: 1366000, eqTarget: 50, years: 4, att: { equity: 0, items: [{ kind: 'other', portfolioId: 'SAV', value: 1366000 }] } }
    const ret = { has: 1134000, eqTarget: 85, years: 20, att: { equity: 200000, items: [...mine([E, D]), { kind: 'other', portfolioId: 'SAV', value: 634000 }] } }
    const r = familyPlan({ plans: [home, ret], mfHoldings: [E, D], included: new Set(['P', 'SAV']), cashItems: [cash], eqOf })
    const moved = r.steps.filter((s) => s.t === 'lump').reduce((t, s) => t + s.amount, 0) + r.steps.filter((s) => s.t === 'sell').reduce((t, s) => t + s.value, 0)
    expect(r.doable).toBeCloseTo(moved, 0)
    expect(r.doable + r.after).toBeCloseTo(Math.abs(r.gap), 0)
    expect(r.after).toBeGreaterThan(600000) // HOME's own shortfall is left to its SIP
  })
  it('two members: every sell and its buy stay in that member\'s own portfolio', () => {
    const JE = fund('JM', 'JE', 'Equity', 4000000), JD = fund('JM', 'JD', 'Debt', 500000), VE = fund('VM', 'VE', 'Equity', 1500000), VD = fund('VM', 'VD', 'Debt', 300000)
    const rj = { has: 7500000, eqTarget: 85, years: 18, att: { equity: 4000000, items: [...mine([JE, JD]), { kind: 'other', portfolioId: 'JEPF', value: 3000000 }] } }
    const rv = { has: 2600000, eqTarget: 85, years: 22, att: { equity: 1500000, items: [...mine([VE, VD]), { kind: 'other', portfolioId: 'VEPF', value: 800000 }] } }
    const r = familyPlan({ plans: [rj, rv], mfHoldings: [JE, JD, VE, VD], included: new Set(['JM', 'VM', 'JEPF', 'VEPF']), eqOf, lockedIds: new Set(['JEPF', 'VEPF']) })
    expect(r.status).toBe('steps')
    for (const s of r.steps.filter((x) => x.fund)) expect(s.fund.portfolioId).toBe(s.portfolioId)
    for (const pid of ['JM', 'VM']) {
      const sold = r.steps.filter((s) => s.t === 'sell' && s.portfolioId === pid).reduce((t, s) => t + s.value, 0)
      const bought = r.steps.filter((s) => s.t === 'buy' && s.portfolioId === pid).reduce((t, s) => t + s.value, 0)
      expect(Math.round(bought)).toBe(Math.round(sold))
    }
    expect(r.steps.some((s) => s.portfolioId === 'JEPF' || s.portfolioId === 'VEPF')).toBe(false) // EPF never sold
  })
})
