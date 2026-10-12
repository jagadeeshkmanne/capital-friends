// End-to-end checks of the Goals page numbers on the sample family, in 5 situations (as on the previews):
// the pool share, each goal's numbers, "Rebalance this month", the gap step, the withdraw plan and the
// retirement refill must all add up. Pure functions only (the same ones the page uses).
import { describe, it, expect } from 'vitest'
import * as F from '../data/familyData'
import { inferCategory } from './fundCategory'
import { computeGoalPool } from '../hooks/useGoalPoolSync'
import { computeGoalsPlan } from '../hooks/useGoalsPlan'
import { buildBucketRefillPlan } from './bucketRefill'
import { attributeFamilyGoals } from './goalAttribution'
import { getRecommendedAllocation } from '../data/glidePath'

const past = (y) => { const d = new Date(); d.setFullYear(d.getFullYear() - y); return d.toISOString().slice(0, 10) }
const H = F.mfHoldings.map((h) => ({ ...h, category: inferCategory(h.fundName) }))
const OTHER = [...F.otherInvestments, { investmentId: 'OI-EPF', investmentType: 'EPF', investmentCategory: 'Debt', investmentName: 'EPF', familyMemberId: 'FM-001', familyMemberName: 'Jagadeesh', investedAmount: 1500000, currentValue: 2000000, status: 'Active' }]
const SCENARIOS = {
  base: (g) => g,
  short: (g) => ({ ...g, targetAmount: g.targetAmount * 3 }),
  due: (g) => (/car/i.test(g.goalName) ? { ...g, targetDate: past(0.1) } : g),
  done: (g) => (/car/i.test(g.goalName) ? { ...g, isActive: false, notes: 'Withdrawn on 05/10/2026' } : g),
  retired: (g) => (g.goalType === 'Retirement' && /2045/.test(g.goalName) ? { ...g, targetDate: past(2), monthlyExpenses: 50000 } : g),
}
const dataFor = (sc) => ({
  goalList: F.goals.map(SCENARIOS[sc]), goalPortfolioMappings: [...F.goalPortfolioMappings], mfHoldings: H, mfPortfolios: F.mfPortfolios,
  stockPortfolios: F.stockPortfolios, stockHoldings: F.stockHoldings, otherInvList: OTHER, assetAllocations: [], settings: {},
  members: F.familyMembers, investmentAccounts: F.investmentAccounts, mfTransactions: F.mfTransactions,
})
const near = (a, b, tol) => Math.abs(a - b) <= tol

for (const sc of Object.keys(SCENARIOS)) {
  describe(`goals numbers · ${sc}`, () => {
    const d = dataFor(sc)
    const pool = computeGoalPool(d)
    const { plan, todo } = computeGoalsPlan(d, pool)
    const live = plan.goals

    it('pool: every rupee is either in a goal or left over, and no investment is shared more than 100%', () => {
      const total = pool.items.filter((i) => i.included && i.value > 0).reduce((t, i) => t + i.value, 0)
      const got = Object.values(pool.byGoal).reduce((t, m) => t + m.got, 0)
      expect(near(got + pool.left, total, 2)).toBe(true)
      const byItem = {}
      for (const m of pool.mappings) byItem[m.portfolioId] = (byItem[m.portfolioId] || 0) + m.allocationPct
      for (const [id, pct] of Object.entries(byItem)) expect(pct, id).toBeLessThanOrEqual(100.05)
      expect(pool.extra).toBeGreaterThanOrEqual(0)
    })

    it('each goal shows what the pool gave it, and its state matches its numbers', () => {
      for (const p of live) {
        const m = pool.byGoal[p.goal.goalId]
        expect(near(p.has, m.got, Math.max(10, m.got * 0.01)), `${p.goal.goalName} has ${p.has} vs pool ${m.got}`).toBe(true)
        expect(p.need, p.goal.goalName).toBeLessThanOrEqual(p.target + 1)
        if (p.state === 'short') expect(p.has, p.goal.goalName).toBeLessThan(p.need)
        if (p.state === 'ok') expect(p.has + 1000, p.goal.goalName).toBeGreaterThanOrEqual(p.need)
      }
    })

    it('no free money while a goal is short (only retirement-only money may be left)', () => {
      const short = live.filter((p) => p.state === 'short' && p.years > 0)
      if (short.length) expect(pool.extra).toBeLessThan(1000)
    })

    it('the gap step adds up: SIP rows = SIP, one-time = gap, fund split = one-time', () => {
      const s = todo.steps.find((x) => x.t === 'short')
      const short = live.filter((p) => p.state === 'short' && -p.gap >= 1000 && p.years > 0)
      if (!short.length) { expect(s).toBeUndefined(); return }
      expect(near(s.gap, short.reduce((t, p) => t - p.gap, 0), 1)).toBe(true)
      expect(near(s.lump, s.gap, 100 * short.length)).toBe(true)
      expect(s.sipRows.reduce((t, r) => t + r.sip, 0)).toBe(s.sip)
      if (s.buys.length) expect(s.buys.reduce((t, b) => t + b.amount, 0)).toBeLessThanOrEqual(s.lump + 1)
      for (const b of s.buys) expect(b.fund.sipRestricted || b.fund.lumpsumRestricted ? 'restricted' : 'ok').toBe('ok')
    })

    it('the withdraw plan of a goal whose date has come adds up to what it holds', () => {
      for (const s of todo.steps.filter((x) => x.t === 'ready')) {
        const sum = s.rows.reduce((t, r) => t + r.value, 0)
        expect(near(sum, s.has, Math.max(10, s.has * 0.01)), s.goal.goalName).toBe(true)
        for (const r of s.rows.filter((x) => x.kind === 'mf')) {
          const h = H.find((x) => x.fundName === r.name && x.portfolioId === r.portfolioId)
          expect(r.units).toBeLessThanOrEqual((Number(h.units) || 0) + 0.001)
        }
      }
    })

    it('a near goal never sits far above its equity target without a "Make it safer" step', () => {
      for (const p of live.filter((x) => !x.isRet && x.state !== 'due' && x.years > 0 && x.years <= 5 && x.eqNow != null)) {
        const over = p.eqNow - p.eqTarget, amount = (over / 100) * p.has
        const step = todo.steps.find((x) => x.t === 'protect' && x.goal.goalId === p.goal.goalId)
        if (over > 20 && amount >= 25000) {
          expect(step, p.goal.goalName).toBeTruthy()
          expect(step.total).toBeLessThanOrEqual(p.has + 1)
          for (const r of step.sells) if (r.units != null) expect(near(r.units * (Number(r.fund.currentNav) || 0), r.value, 2)).toBe(true)
        } else expect(step, p.goal.goalName).toBeFalsy()
      }
    })

    it('family mix and the switch stay within 0–100% and inside one portfolio', () => {
      const f = plan.family
      if (f?.P > 0) { expect(f.haveEq).toBeGreaterThanOrEqual(0); expect(f.haveEq).toBeLessThanOrEqual(100); expect(f.needEq).toBeGreaterThanOrEqual(0); expect(f.needEq).toBeLessThanOrEqual(100) }
      for (const s of todo.steps.filter((x) => x.t === 'switch')) {
        expect(near(s.total, s.buys.reduce((t, b) => t + b.value, 0), 2)).toBe(true)
        for (const b of s.buys) expect(b.portfolioId).toBe(s.portfolioId)
      }
    })

    it('the banner shows only when SIPs clearly cannot reach the goals', () => {
      if (todo.banner) expect(todo.banner.extraSip).toBeGreaterThanOrEqual(Math.max(5000, todo.runningSip * 0.25))
    })

    it('retirement refill keeps the money (it only moves) and never sells more growth than there is', () => {
      for (const p of live.filter((x) => x.isRet)) {
        const g = p.goal
        const att = attributeFamilyGoals({ goals: d.goalList.filter((x) => x.isActive !== false), mappings: pool.mappings, mfHoldings: H, stockHoldings: F.stockHoldings, otherInvList: OTHER, allocMap: {} })
        const yearsLeft = Math.max(0, (new Date(g.targetDate) - new Date()) / (365.25 * 864e5))
        const r = buildBucketRefillPlan({ goal: g, mappings: pool.mappings, holdings: H, portfolios: F.mfPortfolios, assetAllocations: [], targetEquityPct: getRecommendedAllocation('Retirement', yearsLeft).equity, otherInvestments: OTHER, attribution: att[g.goalId] })
        if (!r || r.noExpenses) continue
        const sum = (o) => (o.b1 || 0) + (o.b2 || 0) + (o.b3 || 0)
        expect(near(sum(r.after), sum(r.totals), 2), g.goalName).toBe(true)
        for (const k of ['b1', 'b2', 'b3']) expect(r.after[k]).toBeGreaterThanOrEqual(-1)
        for (const op of r.operations) for (const a of op.allocations) {
          const h = H.find((x) => x.portfolioId === a.portfolioId && String(x.schemeCode) === String(a.schemeCode))
          expect(h, a.fundName).toBeTruthy() // only real funds are sold (never EPF / PPF)
          expect(a.units).toBeLessThanOrEqual((Number(h.units) || 0) + 0.001)
        }
      }
    })
  })
}
