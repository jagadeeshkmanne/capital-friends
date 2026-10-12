import { useMemo } from 'react'
import { useData } from '../context/DataContext'
import { attributeFamilyGoals, riskFraction } from '../utils/goalAttribution'
import { buildGoalPlan } from '../utils/goalPlan'
import { familyPlan } from '../utils/familyPlan'
import { goalTodo } from '../utils/goalTodo'
import { useGoalPool } from './useGoalPoolSync'

/** The goals plan for all active goals (pool mode), the one family plan, and "To do this month" — shared by the
 *  Goals page and the app-wide "can't reach your goals" banner. */
export function useGoalsPlan() {
  const { goalList, mfHoldings, stockHoldings, otherInvList, assetAllocations, mfPortfolios } = useData()
  const pool = useGoalPool()
  return useMemo(() => computeGoalsPlan({ goalList, mfHoldings, stockHoldings, otherInvList, assetAllocations, mfPortfolios }, pool), [goalList, mfHoldings, stockHoldings, otherInvList, assetAllocations, mfPortfolios, pool])
}

/** Same, from plain data and a computeGoalPool() result (used by the validation tests). */
export function computeGoalsPlan({ goalList, mfHoldings, stockHoldings, otherInvList, assetAllocations, mfPortfolios }, pool) {
  const goalPortfolioMappings = pool.mappings
  if (!goalList) return { plan: null, todo: null, pool }
  const allocMap = {}; (assetAllocations || []).forEach((a) => { if (a.assetAllocation) allocMap[a.fundCode] = a.assetAllocation })
  const active = goalList.filter((g) => g.isActive !== false)
  const attribution = attributeFamilyGoals({ goals: active, mappings: goalPortfolioMappings, mfHoldings, stockHoldings, otherInvList, allocMap })
  const eqOf = (h) => riskFraction(h, allocMap) // gold counts as growth, not safe
  const plan = buildGoalPlan({ goals: active, attribution, mfHoldings, mappings: goalPortfolioMappings, eqOf, pool: true })
  const included = new Set(pool.items.filter((i) => i.included).map((i) => i.id))
  const efTake = new Set(goalPortfolioMappings.filter((m) => active.find((g) => g.goalId === m.goalId)?.goalType === 'Emergency Fund').map((m) => m.portfolioId))
  const cashItems = pool.items.filter((i) => i.included && i.type === 'Other' && /cash|saving/i.test(i.otherType || '') && !efTake.has(i.id))
  // goals whose date has passed are waiting to be withdrawn: they take no part in the equity / safe moves
  plan.family = familyPlan({ plans: plan.goals.filter((p) => !(p.years <= 0 && !p.isRet)), mfHoldings, included, cashItems, eqOf, lockedIds: new Set(pool.items.filter((i) => i.locked).map((i) => i.id)) })
  plan.extra = pool.extra || 0
  const todo = goalTodo({ plans: plan.goals, family: plan.family, poolItems: pool.items, mfHoldings, mfPortfolios })
  return { plan, todo, pool, active, allocMap }
}
