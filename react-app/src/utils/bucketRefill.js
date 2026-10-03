// Retirement bucket refill check, used by the Retirement Buckets page.
//
// This file adds the yearly refill rules on top of the existing bucket plan.
// It does not change buildRetirementBucketPlan (the existing bucket plan builder);
// it only reads the funds, bucket totals and expense basis from it.
//
// Rules (kept in one place so the page and its help text agree):
//   - Income bucket (B1) holds 2 years of expenses, topped up once a year.
//     A refill is due on the yearly refill date (retirement anniversary), or
//     earlier if B1 drops to 12 months.
//   - Growth market check: the growth funds' (B3) NAV against their all-time
//     high, weighted by value. Within 10% of the high = good, otherwise down.
//   - Good market: stability surplus above 5 years → B1 first, then growth → B1,
//     then growth → stability back to 5 years.
//   - Down market: stability → B1, but stability never goes below 2 years.
//     Growth is not sold. If B1 still can't be filled, the plan warns.
//   - An underfunded corpus never blocks a refill; it only shows a warning.

import {
  allocateFromFundsByTarget,
  buildRetirementBucketPlan,
} from './retirementBuckets.js'

export const REFILL_RULES = {
  incomeMonths: 24,
  stabilityMonths: 60,
  stabilityFloorMonths: 24,
  earlyRefillMonths: 12,
  goodMarketMaxBelowAthPct: 10,
  refillWindowDays: 45,
  highWithdrawalRate: 0.05,
}

const DAY_MS = 24 * 60 * 60 * 1000

function validDate(value) {
  const date = value ? new Date(value) : null
  return date && !Number.isNaN(date.getTime()) ? date : null
}

export function belowAthPct(fund) {
  const ath = Number(fund?.athNav) || 0
  const nav = Number(fund?.currentNav) || 0
  if (ath <= 0) return null
  if (nav > 0) return Math.max(0, ((ath - nav) / ath) * 100)
  const stored = Number(fund?.belowATHPct)
  return Number.isFinite(stored) ? Math.max(0, stored) : null
}

// How far the growth funds are below their all-time high, weighted by value.
export function assessGrowthMarket(growthFunds, maxBelowAthPct = REFILL_RULES.goodMarketMaxBelowAthPct) {
  const funds = (growthFunds || []).map(fund => ({
    key: fund.key,
    fundName: fund.fundName,
    portfolioName: fund.portfolioName,
    schemeCode: fund.schemeCode,
    currentNav: Number(fund.currentNav) || 0,
    athNav: Number(fund.athNav) || 0,
    goalValue: Number(fund.goalValue) || 0,
    belowAthPct: belowAthPct(fund),
  }))
  const withData = funds.filter(fund => fund.belowAthPct !== null && fund.goalValue > 0)
  const weight = withData.reduce((sum, fund) => sum + fund.goalValue, 0)
  const weightedBelowAthPct = weight > 0
    ? withData.reduce((sum, fund) => sum + fund.belowAthPct * fund.goalValue, 0) / weight
    : null

  let status = 'unknown'
  if (weightedBelowAthPct !== null) status = weightedBelowAthPct <= maxBelowAthPct ? 'good' : 'down'

  return {
    status,
    weightedBelowAthPct,
    maxBelowAthPct,
    funds,
    missingCount: funds.length - withData.length,
  }
}

// The refill date is the retirement date's anniversary each year.
export function refillSchedule(goal, planDate = new Date()) {
  const start = validDate(goal?.targetDate)
  const achieved = goal?.status === 'Achieved'
  if (!start) return { retired: achieved, retirementDate: null, lastDate: null, nextDate: null, yearsToRetirement: null }
  // Retired early: the goal is marked Achieved before its target date. There is
  // no anniversary yet, so refills are triggered by the income level only.
  if (start > planDate && achieved) {
    return { retired: true, retirementDate: start, lastDate: null, nextDate: null, yearsToRetirement: 0 }
  }
  if (start > planDate) {
    return {
      retired: false,
      retirementDate: start,
      lastDate: null,
      nextDate: start,
      yearsToRetirement: (start.getTime() - planDate.getTime()) / (365.25 * DAY_MS),
    }
  }
  // A 29 Feb retirement date rolls to 1 Mar in non-leap years (JS Date behaviour).
  const last = new Date(start)
  last.setFullYear(planDate.getFullYear())
  if (last > planDate) last.setFullYear(last.getFullYear() - 1)
  const next = new Date(last)
  next.setFullYear(next.getFullYear() + 1)
  return { retired: true, retirementDate: start, lastDate: last, nextDate: next, yearsToRetirement: 0 }
}

function operation(id, from, to, result, reason) {
  return { id, from, to, label: `${from.toUpperCase()} to ${to.toUpperCase()}`, reason, ...result }
}

// Sell from growth funds that are near their high first; funds that fell more,
// or have no all-time-high data, are used only if those are not enough.
function sellGrowth(growthFunds, amount, committedUnits, maxBelowAthPct) {
  const nearHigh = growthFunds.filter(fund => {
    const below = belowAthPct(fund)
    return below !== null && below <= maxBelowAthPct
  })
  const others = growthFunds.filter(fund => !nearHigh.includes(fund))
  const first = allocateFromFundsByTarget(nearHigh, amount, committedUnits)
  if (first.shortfall <= 1 || !others.length) return first
  const second = allocateFromFundsByTarget(others, first.shortfall, committedUnits)
  return {
    allocations: [...first.allocations, ...second.allocations],
    fundedAmount: first.fundedAmount + second.fundedAmount,
    shortfall: second.shortfall,
  }
}

export function buildBucketRefillPlan({
  goal,
  mappings,
  holdings,
  portfolios,
  assetAllocations,
  targetEquityPct,
  planDate = new Date(),
  rules: customRules,
}) {
  const rules = { ...REFILL_RULES, ...(customRules || {}) }
  const base = buildRetirementBucketPlan({
    goal,
    mappings,
    holdings,
    portfolios,
    assetAllocations,
    targetEquityPct,
    b1TargetMonths: rules.incomeMonths,
    b2TargetMonths: rules.stabilityMonths,
    planDate,
  })
  if (!base || base.noExpenses) return base

  const monthly = base.expense.monthlyExpense
  if (!(monthly > 0)) return { noExpenses: true, expense: base.expense }
  const totals = base.totals
  const months = {
    b1: totals.b1 / monthly,
    b2: totals.b2 / monthly,
    b3: totals.b3 / monthly,
  }
  const targets = {
    b1: monthly * rules.incomeMonths,
    b2: monthly * rules.stabilityMonths,
    b2Floor: monthly * rules.stabilityFloorMonths,
  }

  const market = assessGrowthMarket(base.byBucket.b3, rules.goodMarketMaxBelowAthPct)
  const schedule = refillSchedule(goal, planDate)

  const b2Sources = [...base.byBucket.b2].sort((a, b) =>
    (a.equityPercent ?? 100) - (b.equityPercent ?? 100) || b.goalValue - a.goalValue,
  )
  const b3Sources = [...base.byBucket.b3].sort((a, b) =>
    (b.equityPercent ?? 0) - (a.equityPercent ?? 0) || b.goalValue - a.goalValue,
  )

  const committedUnits = {}
  const operations = []
  const warnings = []
  // Before retirement, growth only gives the part above its own target (the
  // existing builder's safety rule), so the buckets fill gradually instead of
  // selling most of the equity in one go.
  let growthBudget = schedule.retired ? Infinity : Math.max(0, totals.b3 - base.targets.b3)
  let growthCapped = false
  const sellGrowthCapped = amount => {
    const allowed = Math.min(amount, growthBudget)
    if (allowed < amount - 1) growthCapped = true
    const result = allowed > 1
      ? sellGrowth(b3Sources, allowed, committedUnits, rules.goodMarketMaxBelowAthPct)
      : { allocations: [], fundedAmount: 0, shortfall: 0 }
    growthBudget -= result.fundedAmount
    return result
  }
  const b1Gap = Math.max(0, targets.b1 - totals.b1)
  let b1Need = b1Gap
  let b2Now = totals.b2

  if (market.status === 'good') {
    // 1. Stability already above 5 years: its extra goes to income first.
    const b2Surplus = Math.max(0, b2Now - targets.b2)
    if (b1Need > 1 && b2Surplus > 1) {
      const result = allocateFromFundsByTarget(b2Sources, Math.min(b1Need, b2Surplus), committedUnits)
      if (result.fundedAmount > 1) {
        operations.push(operation('b2-to-b1', 'b2', 'b1', result, 'stability-surplus'))
        b1Need -= result.fundedAmount
        b2Now -= result.fundedAmount
      }
    }
    // 2. Growth refills income directly.
    if (b1Need > 1) {
      const result = sellGrowthCapped(b1Need)
      if (result.fundedAmount > 1) {
        operations.push(operation('b3-to-b1', 'b3', 'b1', result, 'good-market'))
        b1Need -= result.fundedAmount
      }
    }
    // 3. Growth tops stability back up to 5 years.
    const b2Gap = Math.max(0, targets.b2 - b2Now)
    if (b2Gap > 1) {
      const result = sellGrowthCapped(b2Gap)
      if (result.fundedAmount > 1) {
        operations.push(operation('b3-to-b2', 'b3', 'b2', result, 'good-market'))
        b2Now += result.fundedAmount
      }
      if (result.shortfall > 1) warnings.push({ code: 'growth-short-stability', amount: result.shortfall })
    }
  }

  // Down market (or growth not enough / no ATH data): stability pays income,
  // but never below its floor. Growth is not sold.
  if (b1Need > 1) {
    const available = Math.max(0, b2Now - targets.b2Floor)
    if (available > 1) {
      const result = allocateFromFundsByTarget(b2Sources, Math.min(b1Need, available), committedUnits)
      if (result.fundedAmount > 1) {
        operations.push(operation('b2-to-b1-down', 'b2', 'b1', result, market.status === 'good' ? 'growth-short' : 'down-market'))
        b1Need -= result.fundedAmount
        b2Now -= result.fundedAmount
      }
    }
    if (b1Need > 1) warnings.push({ code: market.status === 'good' ? 'growth-short' : 'stability-floor', amount: b1Need })
  }
  if (growthCapped) warnings.push({ code: 'building-capped' })

  if (market.status === 'unknown' && base.byBucket.b3.length) warnings.push({ code: 'market-unknown' })
  if (base.totals.unclassified > 1) warnings.push({ code: 'unclassified', count: base.byBucket.unclassified.length })

  const annualExpense = monthly * 12
  const withdrawalRate = base.totalClassified > 0 ? annualExpense / base.totalClassified : 0
  if (withdrawalRate > rules.highWithdrawalRate) warnings.push({ code: 'high-withdrawal', rate: withdrawalRate })

  // When is the refill due?
  let status
  const daysSinceRefillDate = schedule.lastDate ? (planDate.getTime() - schedule.lastDate.getTime()) / DAY_MS : null
  const b1Low = months.b1 <= rules.earlyRefillMonths
  const inWindow = daysSinceRefillDate !== null && daysSinceRefillDate <= rules.refillWindowDays
  const hasWork = operations.length > 0
  if (!schedule.retired) {
    status = schedule.yearsToRetirement !== null && schedule.yearsToRetirement <= 3 ? 'building' : 'not-started'
  } else if (!hasWork && b1Gap <= monthly * 0.5) {
    status = 'ok'
  } else if (b1Low || inWindow) {
    status = 'due'
  } else {
    // Includes a stability-only top-up while income is full: shown on request.
    status = 'not-due'
  }

  // Rough date when B1 reaches the early-refill level, at today's spending.
  const monthsUntilLow = Math.max(0, months.b1 - rules.earlyRefillMonths)
  const lowDate = new Date(planDate.getTime() + monthsUntilLow * 30.44 * DAY_MS)
  const nextCheckDate = schedule.nextDate && schedule.nextDate < lowDate ? schedule.nextDate : lowDate

  return {
    ...base,
    rules,
    months,
    refillTargets: targets,
    market,
    schedule,
    status,
    hasWork,
    nextCheckDate,
    operations,
    warnings,
    after: {
      b1: totals.b1 + (b1Gap - Math.max(0, b1Need)),
      b2: b2Now,
      b3: totals.b3 - operations.filter(op => op.from === 'b3').reduce((sum, op) => sum + op.fundedAmount, 0),
    },
    b1Shortfall: Math.max(0, b1Need),
    withdrawalRate,
    corpusYears: annualExpense > 0 ? base.totalClassified / annualExpense : null,
  }
}

