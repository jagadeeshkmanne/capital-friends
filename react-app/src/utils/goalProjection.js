export function calculateGoalFundingProjection({
  targetAmount,
  months,
  annualReturn,
  plannedLumpsum = 0,
  linkedCurrentValue = 0,
}) {
  const target = Math.max(0, Number(targetAmount) || 0)
  const durationMonths = Math.max(0, Number(months) || 0)
  const monthlyRate = Math.max(0, Number(annualReturn) || 0) / 12
  const lumpsum = Math.max(0, Number(plannedLumpsum) || 0)
  const linkedValue = Math.max(0, Number(linkedCurrentValue) || 0)

  // A saved lump sum may already be represented by the linked portfolio value.
  // Use the larger value so the same money is never counted twice.
  const existingValue = Math.max(linkedValue, lumpsum)
  const growthFactor = durationMonths > 0
    ? Math.pow(1 + monthlyRate, durationMonths)
    : 1
  const futureExistingValue = existingValue * growthFactor
  const gapAtMaturity = Math.max(0, target - futureExistingValue)

  let requiredSIP = 0
  if (gapAtMaturity > 0 && durationMonths > 0) {
    const sipFactor = monthlyRate > 0
      ? (Math.pow(1 + monthlyRate, durationMonths) - 1) / monthlyRate
      : durationMonths
    requiredSIP = Math.ceil(gapAtMaturity / sipFactor)
  }

  const totalRequiredLumpsum = target > 0
    ? Math.round(target / growthFactor)
    : 0
  const requiredLumpsum = Math.max(0, totalRequiredLumpsum - existingValue)

  return {
    existingValue,
    futureExistingValue: Math.round(futureExistingValue),
    requiredSIP,
    requiredLumpsum,
    coversGoal: existingValue > 0 && futureExistingValue >= target,
  }
}
