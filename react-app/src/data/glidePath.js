// Glide path: recommended equity % by years to goal
// Single source of truth — used by GoalForm, GoalsPage, Dashboard
export const GLIDE_PATH = [
  { maxYears: 1,        equity: 10, label: 'Short-term' },
  { maxYears: 3,        equity: 30, label: 'Short-term' },
  { maxYears: 5,        equity: 50, label: 'Medium-term' },
  { maxYears: 7,        equity: 65, label: 'Medium-term' },
  { maxYears: 10,       equity: 75, label: 'Long-term' },
  { maxYears: Infinity, equity: 85, label: 'Long-term' },
]

// Retirement is an income-start date, not a one-time spending deadline. The
// corpus still needs long-term growth after retirement. Equity eases gently
// from 85% (10 years out) to 75% (5 years out) instead of one 10% jump; in the
// last 5 years the Retirement Buckets page builds the safe money (2 years
// Income + 5 years Stability) in quarterly steps, so the goal card follows that
// plan instead of a fixed equity percentage.
export function getRecommendedAllocation(goalType, yearsLeft) {
  if (goalType === 'Emergency Fund') return { equity: 0, debt: 100, label: 'Safety' }
  if (goalType === 'Retirement') {
    const y = Math.max(0, Number(yearsLeft) || 0)
    const equity = y <= 5 ? 75 : y >= 10 ? 85 : Math.round(75 + 2 * (y - 5))
    return { equity, debt: 100 - equity, label: y <= 5 ? 'Retirement buckets' : 'Long-term' }
  }
  const step = GLIDE_PATH.find(s => yearsLeft <= s.maxYears)
  return { equity: step.equity, debt: 100 - step.equity, label: step.label }
}

// In the last 5 years before retirement, a retirement goal follows the bucket
// plan (Retirement Buckets page) instead of a fixed equity percentage.
export const BUCKET_BUILD_YEARS = 5
export function followsBucketPlan(goalType, yearsLeft) {
  return goalType === 'Retirement' && Number(yearsLeft) <= BUCKET_BUILD_YEARS
}
