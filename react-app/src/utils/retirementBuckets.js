const EQUITY_CATEGORY_WORDS = [
  'equity', 'elss', 'index', 'large cap', 'mid cap', 'small cap', 'flexi cap',
  'multi cap', 'focused', 'value', 'contra', 'dividend yield', 'sectoral',
  'thematic', 'international',
]

const B1_CATEGORY_WORDS = [
  'liquid', 'overnight', 'money market', 'ultra short', 'ultra-short',
  'low duration', 'short duration', 'cash',
]

const B2_CATEGORY_WORDS = [
  'hybrid', 'multi-asset', 'multi asset', 'balanced advantage',
  'dynamic asset allocation', 'equity savings', 'arbitrage', 'debt', 'gilt',
  'medium duration', 'long duration',
  'corporate bond', 'banking & psu', 'credit risk', 'floater',
]

function includesAny(value, words) {
  const normalized = String(value || '').trim().toLowerCase()
  return words.some(word => normalized.includes(word))
}

function validDate(value, fallback) {
  const date = value ? new Date(value) : null
  return date && !Number.isNaN(date.getTime()) ? date : fallback
}

export function yearsBetween(from, to) {
  return Math.max(0, (to.getTime() - from.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
}

export function getRetirementExpenseBasis(goal, planDate = new Date()) {
  const todayExpense = Number(goal?.monthlyExpenses) || 0
  const inflation = Math.max(0, Number(goal?.expectedInflation) || 0)
  const createdDate = validDate(goal?.createdDate, planDate)
  const targetDate = validDate(goal?.targetDate, planDate)
  const expenseDate = targetDate > planDate ? targetDate : planDate
  const inflationYears = yearsBetween(createdDate, expenseDate)

  return {
    todayExpense,
    monthlyExpense: todayExpense * Math.pow(1 + inflation, inflationYears),
    inflation,
    inflationYears,
    expenseDate,
  }
}

export function classifyRetirementHolding(holding, assetAllocation) {
  const category = holding?.category || ''
  // B1 is intentionally limited to cash-like and short-duration categories.
  // A generic debt label is not enough because duration and credit risk matter.
  if (includesAny(category, B1_CATEGORY_WORDS)) {
    return { bucket: 'b1', reason: category || 'Liquid/short debt', equity: 0, confidence: 'category' }
  }

  const allocation = assetAllocation || null
  if (allocation) {
    const equity = Number(allocation.Equity) || 0
    const debt = Number(allocation.Debt) || 0
    const cash = Number(allocation.Cash) || 0
    const knownTotal = Object.values(allocation).reduce((sum, value) => sum + (Number(value) || 0), 0)

    if (equity >= 70) return { bucket: 'b3', reason: `${equity.toFixed(0)}% equity`, equity, confidence: 'allocation' }
    if (equity >= 30) return { bucket: 'b2', reason: `${equity.toFixed(0)}% equity`, equity, confidence: 'allocation' }
    if (debt + cash >= 70 && includesAny(category, B2_CATEGORY_WORDS)) {
      return { bucket: 'b2', reason: `${(debt + cash).toFixed(0)}% debt/cash`, equity, confidence: 'allocation' }
    }
    if (knownTotal >= 70) return { bucket: null, reason: 'Asset mix needs review', equity, confidence: 'review' }
  }

  if (includesAny(category, EQUITY_CATEGORY_WORDS)) return { bucket: 'b3', reason: category, equity: 100, confidence: 'category' }
  if (includesAny(category, B2_CATEGORY_WORDS)) return { bucket: 'b2', reason: category, equity: 40, confidence: 'category' }
  return { bucket: null, reason: category || 'Category unavailable', equity: null, confidence: 'review' }
}

function allocateFromFunds(funds, requestedAmount, committedUnits = {}) {
  let remaining = Math.max(0, requestedAmount)
  const allocations = []

  for (const fund of funds) {
    if (remaining <= 0.01) break
    const alreadyCommitted = committedUnits[fund.key] || 0
    const availableUnits = Math.max(0, fund.goalUnits - alreadyCommitted)
    const availableValue = availableUnits * fund.currentNav
    const amount = Math.min(remaining, availableValue)
    const units = fund.currentNav > 0 ? amount / fund.currentNav : 0
    if (units <= 0) continue

    allocations.push({ ...fund, amount, units })
    committedUnits[fund.key] = alreadyCommitted + units
    remaining -= amount
  }

  return {
    allocations,
    fundedAmount: Math.max(0, requestedAmount - remaining),
    shortfall: Math.max(0, remaining),
  }
}

export function allocateBucketWithdrawal(bucketFunds, requestedAmount) {
  return allocateFromFunds(
    [...(bucketFunds || [])].sort((a, b) => b.goalValue - a.goalValue),
    Math.max(0, Number(requestedAmount) || 0),
  )
}

export function buildRetirementBucketPlan({
  goal,
  mappings,
  holdings,
  portfolios,
  assetAllocations,
  b1TargetMonths = 24,
  b2TargetMonths = 60,
  planDate = new Date(),
}) {
  const goalMappings = (mappings || []).filter(mapping => mapping.goalId === goal?.goalId)
  if (!goalMappings.length) return null

  const expense = getRetirementExpenseBasis(goal, planDate)
  if (!expense.todayExpense) return { noExpenses: true, expense }

  const allocationMap = {}
  for (const item of assetAllocations || []) {
    allocationMap[String(item.fundCode)] = item.assetAllocation || null
  }

  const allFunds = []
  for (const mapping of goalMappings) {
    const portfolio = (portfolios || []).find(item => item.portfolioId === mapping.portfolioId)
    if (!portfolio) continue
    const goalShare = Math.max(0, Number(mapping.allocationPct) || 0) / 100
    const portfolioName = portfolio.portfolioName?.replace(/^PFL-/, '') || portfolio.portfolioName

    for (const holding of (holdings || []).filter(item => item.portfolioId === mapping.portfolioId && item.units > 0)) {
      const schemeCode = String(holding.schemeCode || holding.fundCode || '')
      const classification = classifyRetirementHolding(holding, allocationMap[schemeCode])
      const currentNav = Number(holding.currentNav) || 0
      const goalUnits = (Number(holding.units) || 0) * goalShare
      const holdingValue = Number(holding.currentValue)
      const goalValue = Number.isFinite(holdingValue) && holdingValue > 0
        ? holdingValue * goalShare
        : goalUnits * currentNav
      allFunds.push({
        ...holding,
        key: `${mapping.portfolioId}::${schemeCode}`,
        schemeCode,
        portfolioId: mapping.portfolioId,
        portfolioName,
        allocationPct: Number(mapping.allocationPct) || 0,
        currentNav,
        goalUnits,
        goalValue,
        bucket: classification.bucket,
        bucketReason: classification.reason,
        equityPercent: classification.equity,
        classificationConfidence: classification.confidence,
      })
    }
  }

  const byBucket = {
    b1: allFunds.filter(fund => fund.bucket === 'b1').sort((a, b) => b.goalValue - a.goalValue),
    b2: allFunds.filter(fund => fund.bucket === 'b2').sort((a, b) => b.goalValue - a.goalValue),
    b3: allFunds.filter(fund => fund.bucket === 'b3').sort((a, b) => b.goalValue - a.goalValue),
    unclassified: allFunds.filter(fund => !fund.bucket).sort((a, b) => b.goalValue - a.goalValue),
  }

  const b2RefillSources = [...byBucket.b2].sort((a, b) =>
    (a.equityPercent ?? 100) - (b.equityPercent ?? 100) || b.goalValue - a.goalValue,
  )
  const b3RefillSources = [...byBucket.b3].sort((a, b) =>
    (b.equityPercent ?? 0) - (a.equityPercent ?? 0) || b.goalValue - a.goalValue,
  )

  const totals = Object.fromEntries(
    Object.entries(byBucket).map(([bucket, funds]) => [bucket, funds.reduce((sum, fund) => sum + fund.goalValue, 0)]),
  )
  const b1Target = expense.monthlyExpense * b1TargetMonths
  const b2Target = expense.monthlyExpense * b2TargetMonths
  const retirementTarget = Math.max(0, Number(goal?.targetAmount) || 0)
  const b3Target = Math.max(0, retirementTarget - b1Target - b2Target)
  const b1Deficit = Math.max(0, b1Target - totals.b1)

  const committedUnits = {}
  // Preserve a fully funded B2. Only its surplus may refill B1; otherwise B3
  // fills B1 directly so the medium-term reserve remains intact.
  const b2Surplus = Math.max(0, totals.b2 - b2Target)
  const b2ToB1Requested = Math.min(b1Deficit, b2Surplus)
  const b2ToB1 = allocateFromFunds(b2RefillSources, b2ToB1Requested, committedUnits)
  // B3 may fund another bucket only from the amount above its own retirement
  // target. This avoids draining growth assets while the goal is underfunded.
  const b3Surplus = Math.max(0, totals.b3 - b3Target)
  const b3ToB1Requested = Math.min(
    Math.max(0, b1Deficit - b2ToB1.fundedAmount),
    b3Surplus,
  )
  const b3ToB1 = allocateFromFunds(b3RefillSources, b3ToB1Requested, committedUnits)

  const b2AfterB1 = totals.b2 - b2ToB1.fundedAmount
  const b3SurplusAfterB1 = Math.max(0, b3Surplus - b3ToB1.fundedAmount)
  const b3ToB2Requested = Math.min(Math.max(0, b2Target - b2AfterB1), b3SurplusAfterB1)
  const b3ToB2 = allocateFromFunds(b3RefillSources, b3ToB2Requested, committedUnits)

  const b1AfterMoves = totals.b1 + b2ToB1.fundedAmount + b3ToB1.fundedAmount
  const b2AfterMoves = totals.b2 - b2ToB1.fundedAmount + b3ToB2.fundedAmount
  const totalClassified = totals.b1 + totals.b2 + totals.b3
  const fundingGap = Math.max(0, retirementTarget - totalClassified)

  return {
    expense,
    allFunds,
    byBucket,
    totals,
    totalClassified,
    totalGoalValue: allFunds.reduce((sum, fund) => sum + fund.goalValue, 0),
    targets: { b1: b1Target, b2: b2Target, b3: b3Target, total: retirementTarget },
    gaps: {
      b1: Math.max(0, b1Target - b1AfterMoves),
      b2: Math.max(0, b2Target - b2AfterMoves),
      b3: Math.max(0, b3Target - totals.b3 + b3ToB1.fundedAmount + b3ToB2.fundedAmount),
    },
    fundingGap,
    plannedSWR: Number(goal?.targetAmount) > 0
      ? (expense.monthlyExpense * 12) / Number(goal.targetAmount)
      : 0,
    operations: [
      { id: 'b2-to-b1', from: 'b2', to: 'b1', label: 'B2 to B1', ...b2ToB1 },
      { id: 'b3-to-b1', from: 'b3', to: 'b1', label: 'B3 to B1', ...b3ToB1 },
      { id: 'b3-to-b2', from: 'b3', to: 'b2', label: 'B3 to B2', ...b3ToB2 },
    ].filter(operation => operation.fundedAmount > 0.01),
    targetShortfall: Math.max(
      fundingGap,
      Math.max(0, b1Target - b1AfterMoves) + Math.max(0, b2Target - b2AfterMoves),
    ),
  }
}
