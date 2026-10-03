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
//   - Last 5 years before retirement: build Income + Stability in quarterly steps
//     of (what is missing) / (quarters left), good market only, one step per
//     quarter. Stability first; Income in the last 2 years.

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
  buildYears: 5,
  incomeBuildYears: 2,
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
  lastBucketMoveDate = null,
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
  // Ignore tiny moves (rounding, a few days of spending): never suggest less than half a month.
  const minMove = Math.max(1000, monthly * 0.5)
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
  const annualExpense = monthly * 12
  const withdrawalRate = base.totalClassified > 0 ? annualExpense / base.totalClassified : 0
  const common = {
    ...base,
    rules,
    months,
    refillTargets: targets,
    market,
    schedule,
    withdrawalRate,
    corpusYears: annualExpense > 0 ? base.totalClassified / annualExpense : null,
  }
  if (base.totals.unclassified > 1) warnings.push({ code: 'unclassified', count: base.byBucket.unclassified.length })

  // ── Before retirement (last 5 years): build the buckets in small quarterly steps ──
  // Target at retirement: Income 2 years + Stability 5 years of retirement-year
  // expenses. Each quarter moves (what is still missing) / (quarters left), only
  // in a good market, so even a late starter never moves a big share in one go.
  const yearsLeft = schedule.yearsToRetirement
  if (!schedule.retired && yearsLeft !== null && yearsLeft <= rules.buildYears) {
    const safeTarget = targets.b1 + targets.b2
    const safeNow = totals.b1 + totals.b2
    const gap = Math.max(0, safeTarget - safeNow)
    const quartersLeft = Math.max(1, Math.ceil(yearsLeft * 4 - 1e-9))
    const stepAmount = gap / quartersLeft
    const quarterStart = new Date(planDate.getFullYear(), Math.floor(planDate.getMonth() / 3) * 3, 1)
    const nextQuarter = new Date(quarterStart.getFullYear(), quarterStart.getMonth() + 3, 1)
    const lastMove = validDate(lastBucketMoveDate)
    const doneThisQuarter = !!lastMove && lastMove >= quarterStart && lastMove <= planDate

    let status
    if (gap <= monthly * 0.5) status = 'built'
    else if (doneThisQuarter) status = 'step-done'
    else if (market.status !== 'good') status = 'building-wait'
    else status = 'building'

    let b1Add = 0, b2Add = 0
    if (status === 'building') {
      const b1Gap = Math.max(0, targets.b1 - totals.b1)
      const b2Gap = Math.max(0, targets.b2 - totals.b2)
      if (yearsLeft > rules.incomeBuildYears) {
        // Stability first (it earns more than liquid funds); Income is built in the last 2 years.
        b2Add = Math.min(stepAmount, b2Gap)
        b1Add = Math.min(stepAmount - b2Add, b1Gap)
      } else {
        const total = b1Gap + b2Gap
        b1Add = total > 0 ? stepAmount * b1Gap / total : 0
        b2Add = stepAmount - b1Add
      }
      for (const [to, amount] of [['b2', b2Add], ['b1', b1Add]]) {
        if (amount < 1000) continue
        const result = sellGrowth(b3Sources, amount, committedUnits, rules.goodMarketMaxBelowAthPct)
        if (result.fundedAmount > 1) operations.push(operation(`build-b3-to-${to}`, 'b3', to, result, 'build-step'))
        if (result.shortfall > 1) warnings.push({ code: 'growth-short-build', amount: result.shortfall })
      }
    }
    if (status !== 'built' && market.status === 'unknown' && base.byBucket.b3.length) warnings.push({ code: 'market-unknown' })
    // No withdrawal-rate warning yet: the corpus is still growing until retirement.

    const moved = { b1: 0, b2: 0, b3: 0 }
    for (const op of operations) { moved[op.from] -= op.fundedAmount; moved[op.to] += op.fundedAmount }
    return {
      ...common,
      status,
      hasWork: operations.length > 0,
      nextCheckDate: nextQuarter,
      operations,
      warnings,
      after: { b1: totals.b1 + moved.b1, b2: totals.b2 + moved.b2, b3: totals.b3 + moved.b3 },
      b1Shortfall: 0,
      build: { safeTarget, safeNow, gap, quartersLeft, stepAmount, nextQuarter, doneThisQuarter, lastMove },
    }
  }

  // More than 5 years away: no bucket moves yet (the page shows the glide-path preview).
  if (!schedule.retired) {
    return {
      ...common,
      status: 'not-started',
      hasWork: false,
      nextCheckDate: null,
      operations: [],
      warnings,
      after: { ...totals },
      b1Shortfall: 0,
    }
  }

  const b1Gap = Math.max(0, targets.b1 - totals.b1)
  let b1Need = b1Gap
  let b2Now = totals.b2

  if (market.status === 'good') {
    // 1. Stability already above 5 years: its extra goes to income first.
    const b2Surplus = Math.max(0, b2Now - targets.b2)
    if (b1Need > minMove && b2Surplus > minMove) {
      const result = allocateFromFundsByTarget(b2Sources, Math.min(b1Need, b2Surplus), committedUnits)
      if (result.fundedAmount > 1) {
        operations.push(operation('b2-to-b1', 'b2', 'b1', result, 'stability-surplus'))
        b1Need -= result.fundedAmount
        b2Now -= result.fundedAmount
      }
    }
    // 2. Growth refills income directly.
    if (b1Need > minMove) {
      const result = sellGrowth(b3Sources, b1Need, committedUnits, rules.goodMarketMaxBelowAthPct)
      if (result.fundedAmount > 1) {
        operations.push(operation('b3-to-b1', 'b3', 'b1', result, 'good-market'))
        b1Need -= result.fundedAmount
      }
    }
    // 3. Growth tops stability back up to 5 years.
    const b2Gap = Math.max(0, targets.b2 - b2Now)
    if (b2Gap > minMove) {
      const result = sellGrowth(b3Sources, b2Gap, committedUnits, rules.goodMarketMaxBelowAthPct)
      if (result.fundedAmount > 1) {
        operations.push(operation('b3-to-b2', 'b3', 'b2', result, 'good-market'))
        b2Now += result.fundedAmount
      }
      if (result.shortfall > minMove) warnings.push({ code: 'growth-short-stability', amount: result.shortfall })
    }
  }

  // Down market (or growth not enough / no ATH data): stability pays income,
  // but never below its floor. Growth is not sold.
  if (b1Need > minMove) {
    const available = Math.max(0, b2Now - targets.b2Floor)
    if (available > minMove) {
      const result = allocateFromFundsByTarget(b2Sources, Math.min(b1Need, available), committedUnits)
      if (result.fundedAmount > 1) {
        operations.push(operation('b2-to-b1-down', 'b2', 'b1', result, market.status === 'good' ? 'growth-short' : 'down-market'))
        b1Need -= result.fundedAmount
        b2Now -= result.fundedAmount
      }
    }
    if (b1Need > minMove) warnings.push({ code: market.status === 'good' ? 'growth-short' : 'stability-floor', amount: b1Need })
  }

  if (market.status === 'unknown' && base.byBucket.b3.length) warnings.push({ code: 'market-unknown' })
  if (withdrawalRate > rules.highWithdrawalRate) warnings.push({ code: 'high-withdrawal', rate: withdrawalRate })

  // When is the refill due?
  let status
  const daysSinceRefillDate = schedule.lastDate ? (planDate.getTime() - schedule.lastDate.getTime()) / DAY_MS : null
  const b1Low = months.b1 <= rules.earlyRefillMonths
  const inWindow = daysSinceRefillDate !== null && daysSinceRefillDate <= rules.refillWindowDays
  const hasWork = operations.length > 0
  if (!hasWork && b1Gap <= monthly * 0.5) {
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
    ...common,
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
  }
}

