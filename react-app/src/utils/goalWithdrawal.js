export function buildGoalWithdrawalPlan({ goal, mappings, portfolios, holdings, requestedAmount }) {
  const goalMappings = (mappings || []).filter(mapping => mapping.goalId === goal?.goalId)
  if (!goalMappings.length) return null

  const sources = []
  for (const mapping of goalMappings) {
    const portfolio = (portfolios || []).find(item => item.portfolioId === mapping.portfolioId)
    if (!portfolio) continue
    const portfolioHoldings = (holdings || []).filter(item => item.portfolioId === mapping.portfolioId && item.units > 0)
    const portfolioValue = portfolioHoldings.reduce((sum, item) => sum + (Number(item.currentValue) || 0), 0)
    const goalShare = Math.max(0, Number(mapping.allocationPct) || 0) / 100

    for (const holding of portfolioHoldings) {
      const schemeCode = String(holding.schemeCode || holding.fundCode || '')
      const currentNav = Number(holding.currentNav) || 0
      const availableUnits = (Number(holding.units) || 0) * goalShare
      const holdingValue = Number(holding.currentValue)
      const availableValue = Number.isFinite(holdingValue) && holdingValue > 0
        ? holdingValue * goalShare
        : availableUnits * currentNav
      if (availableUnits <= 0 || availableValue <= 0) continue
      sources.push({
        ...holding,
        key: `${mapping.portfolioId}::${schemeCode}`,
        schemeCode,
        portfolioId: mapping.portfolioId,
        portfolioName: portfolio.portfolioName?.replace(/^PFL-/, '') || portfolio.portfolioName,
        ownerName: portfolio.ownerName,
        allocationPct: Number(mapping.allocationPct) || 0,
        currentNav,
        availableUnits,
        availableValue,
      })
    }
  }

  const totalLinked = sources.reduce((sum, source) => sum + source.availableValue, 0)
  const defaultAmount = Math.min(Math.max(0, Number(goal?.targetAmount) || 0), totalLinked)
  const desiredAmount = requestedAmount === undefined
    ? defaultAmount
    : Math.min(Math.max(0, Number(requestedAmount) || 0), totalLinked)

  const withdrawals = []
  for (const source of sources) {
    const proportion = totalLinked > 0 ? source.availableValue / totalLinked : 0
    const amount = desiredAmount * proportion
    const units = source.currentNav > 0 ? Math.min(amount / source.currentNav, source.availableUnits) : 0
    if (units > 0) withdrawals.push({ ...source, amount: units * source.currentNav, suggestedUnits: units })
  }

  return {
    sources,
    withdrawals,
    totalLinked,
    defaultAmount,
    requestedAmount: desiredAmount,
    remainingLinkedValue: Math.max(0, totalLinked - desiredAmount),
  }
}
