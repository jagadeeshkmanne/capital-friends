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

// A goal paid over several years (college fees over 4 years, see utils/goalExtras.js): each year's part follows
// its own glide path, so the 4th year's fees can stay in growth longer than the 1st year's. The goal's equity
// target is the mix of its parts, each part weighted by the money it needs today (later parts need less).
// Parts already due (0 years left) are fully safe. One-time goals, retirement and the emergency fund: unchanged.
export function getGoalAllocation(goal, yearsLeft) {
  const type = goal?.goalType
  const n = Math.max(1, Math.round(Number(goal?.payYears) || 1))
  if (n === 1 || type === 'Retirement' || type === 'Emergency Fund') return getRecommendedAllocation(type, yearsLeft)
  const y = Number(yearsLeft) || 0
  const r = Number(goal?.expectedCAGR) > 0 ? Number(goal.expectedCAGR) : 0.12
  let w = 0, eq = 0
  const parts = []
  for (let k = 0; k < n; k++) {
    const yk = y + k
    const e = yk > 0 ? getRecommendedAllocation(type, yk).equity : 0
    const wk = 1 / Math.pow(1 + r, Math.max(0, yk))
    parts.push({ part: k + 1, yearsLeft: yk, equity: e })
    w += wk; eq += wk * e
  }
  const equity = Math.round(eq / w)
  const label = equity >= 75 ? 'Long-term' : equity >= 50 ? 'Medium-term' : 'Short-term'
  return { equity, debt: 100 - equity, label, parts }
}

/** Whether a goal still holds money after its date (retirement, or a goal paid over more years). */
export function spendsOverYears(goal) {
  return Math.round(Number(goal?.payYears) || 1) > 1 && goal?.goalType !== 'Retirement' && goal?.goalType !== 'Emergency Fund'
}
