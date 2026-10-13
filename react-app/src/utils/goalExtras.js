// Extra goal settings kept in the Settings tab (key GoalExtras, JSON { goalId: { repeat, payYears } }), so the
// Goals sheet keeps its columns and nothing changes for goals that don't use them.
//   repeat   — years until the goal comes again (0 = once): closing it adds the next one automatically
//   payYears — the amount is paid over this many years from the goal date (college fees: 4), 1 = all at once

export function readGoalExtras(settings) {
  try { const o = JSON.parse(settings?.GoalExtras || '{}'); return o && typeof o === 'object' && !Array.isArray(o) ? o : {} } catch { return {} }
}

/** goalList with repeatYears / payYears on each goal (from the settings) */
export function withGoalExtras(goalList, settings) {
  if (!Array.isArray(goalList)) return goalList
  const ex = readGoalExtras(settings)
  if (!Object.keys(ex).length) return goalList
  return goalList.map((g) => {
    const e = ex[g.goalId]
    if (!e) return g
    const repeatYears = Math.max(0, Math.round(Number(e.repeat) || 0)), payYears = Math.max(1, Math.round(Number(e.payYears) || 1))
    return repeatYears || payYears > 1 ? { ...g, repeatYears, payYears } : g
  })
}

export const REPEAT_OPTIONS = [
  { value: '0', label: 'Only once' }, { value: '1', label: 'Every year' }, { value: '2', label: 'Every 2 years' },
  { value: '3', label: 'Every 3 years' }, { value: '5', label: 'Every 5 years' },
]
export const PAY_OPTIONS = [
  { value: '1', label: 'All at once' }, { value: '2', label: 'Over 2 years' }, { value: '3', label: 'Over 3 years' },
  { value: '4', label: 'Over 4 years' }, { value: '5', label: 'Over 5 years' }, { value: '6', label: 'Over 6 years' },
]
