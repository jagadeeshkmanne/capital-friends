import { useEffect, useMemo, useRef } from 'react'
import { useData } from '../../context/DataContext'
import { computeRetirementPlan, useGoalAttribution } from './RetirementBucketsPage'
import { readIncomePlan, readIncomeLog, incomeStatus } from '../../utils/incomePlan'
import { bucketActions, actionsKey } from '../../utils/bucketActions'

const isRetirement = (g) => g && g.isActive !== false && g.goalType === 'Retirement'

/** Income-jar options from the refill plan's Income bucket (same refs as the goal card). */
const optionsFromPlan = (plan) => (plan?.byBucket?.b1 || []).map((f) => f.isOther
  ? { kind: 'cash', ref: f.portfolioId, name: f.fundName, value: f.goalValue }
  : { kind: 'swp', ref: `${f.portfolioId}::${f.schemeCode}`, name: f.fundName, value: f.goalValue })

/**
 * Retirement bucket actions for every retirement goal: refill due, this quarter's build step, income source low /
 * short. Also keeps the email's copy (Settings 'BucketActions:<goalId>') up to date when it changes.
 */
export function useBucketActions() {
  const data = useData()
  const { goalList, settings, mfHoldings, mfTransactions, updateSettings } = data
  const attribution = useGoalAttribution()
  const items = useMemo(() => {
    if (!settings || !goalList || !mfHoldings) return null
    const all = {}
    for (const goal of goalList.filter(isRetirement)) {
      const plan = computeRetirementPlan({ goal, data, goalAttribution: attribution })
      const retired = !!plan?.schedule?.retired
      const iplan = readIncomePlan(settings, goal.goalId)
      const income = retired && iplan ? incomeStatus({ plan: iplan, options: optionsFromPlan(plan), log: readIncomeLog(settings, goal.goalId), transactions: mfTransactions || [], monthly: plan?.expense?.monthlyExpense || 0 }) : null
      all[goal.goalId] = bucketActions({ goal, plan, income })
    }
    return all
  }, [goalList, settings, mfHoldings, mfTransactions, attribution]) // eslint-disable-line react-hooks/exhaustive-deps

  // the email reads this copy (it can't run the refill plan itself); write only when the list changed
  const writing = useRef(false)
  useEffect(() => {
    if (!items || writing.current) return
    const patch = {}
    for (const [gid, list] of Object.entries(items)) {
      let saved = null
      try { saved = JSON.parse(settings?.[`BucketActions:${gid}`] || 'null') } catch { saved = null }
      if (actionsKey(saved?.items) !== actionsKey(list)) patch[`BucketActions:${gid}`] = JSON.stringify({ at: new Date().toISOString(), items: list })
    }
    if (!Object.keys(patch).length) return
    writing.current = true
    updateSettings(patch).catch(() => {}).finally(() => { writing.current = false })
  }, [items]) // eslint-disable-line react-hooks/exhaustive-deps

  return useMemo(() => Object.values(items || {}).flat(), [items])
}
