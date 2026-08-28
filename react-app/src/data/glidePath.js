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
// corpus still needs long-term growth after retirement, so its glide path ends
// at the bucket-aware allocation instead of the generic 10% equity endpoint.
export const RETIREMENT_GLIDE_PATH = [
  { maxYears: 10,       equity: 75, label: 'Retirement buckets' },
  { maxYears: Infinity, equity: 85, label: 'Long-term' },
]

export function getRecommendedAllocation(goalType, yearsLeft) {
  if (goalType === 'Emergency Fund') return { equity: 0, debt: 100, label: 'Safety' }
  const path = goalType === 'Retirement' ? RETIREMENT_GLIDE_PATH : GLIDE_PATH
  const step = path.find(s => yearsLeft <= s.maxYears)
  return { equity: step.equity, debt: 100 - step.equity, label: step.label }
}
