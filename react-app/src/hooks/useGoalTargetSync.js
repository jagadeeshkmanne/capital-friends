import { useEffect, useMemo, useRef, useState } from 'react'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import { allPortfolioTargets } from '../utils/goalTargets'
import { equityFraction, attributeFamilyGoals } from '../utils/goalAttribution'

const isLiveGoal = (g) => g && g.isActive !== false && g.status !== 'Achieved'

/**
 * Goal-linked portfolios: their fund targets follow the goals.
 *  - When a goal reaches a new stage (its equity need is 5+ points away from the targets), the targets are
 *    updated (equity funds keep their ratio, safe funds take the rest). Before the FIRST such change the
 *    user's own targets are saved in the portfolio sheet (column V "Original Target %").
 *  - When a portfolio is no longer linked to any live goal (unlinked, achieved, deleted), the saved original
 *    targets are put back and column V is cleared.
 * Runs when the app opens (and again whenever goals, links or holdings change), once per change per session.
 */
export function useGoalTargetSync() {
  const { goalList, goalPortfolioMappings, mfHoldings, mfPortfolios, stockHoldings, otherInvList, assetAllocations,
    updateHoldingAllocations, saveOriginalTargets, restoreOriginalTargets, loading, isRefreshing, freshLoad } = useData()
  const { showToast } = useToast()
  const busy = useRef(false)
  const [pass, setPass] = useState(0) // re-check once after a run, in case fresh data arrived meanwhile

  const work = useMemo(() => {
    // only act on fully loaded data: an empty list because loading failed must never look like "unlinked"
    // only on data fresh from the server (never the browser cache), and only when goals, links and funds all loaded
    const failed = (freshLoad?.errors || []).map((e) => e.fn)
    if (loading || isRefreshing || !freshLoad?.at || ['getAllGoals', 'getGoalPortfolioMappings', 'getAllMFHoldings', 'getAllPortfolios'].some((f) => failed.includes(f))) return { updates: [], restores: [] }
    if (!Array.isArray(goalList) || !Array.isArray(goalPortfolioMappings) || !mfHoldings?.length) return { updates: [], restores: [] }
    const allocMap = {}; (assetAllocations || []).forEach((a) => { if (a.assetAllocation) allocMap[a.fundCode] = a.assetAllocation })
    const live = new Set((mfPortfolios || []).filter((p) => p.status !== 'Inactive' && !p.skipRebalance).map((p) => p.portfolioId))
    const goals = goalList.filter(isLiveGoal)
    const attribution = attributeFamilyGoals({ goals, mappings: goalPortfolioMappings, mfHoldings, stockHoldings, otherInvList, allocMap })
    const updates = allPortfolioTargets({ goals, mappings: goalPortfolioMappings, mfHoldings, attribution, eqOf: (h) => equityFraction(h, allocMap) })
      .filter((x) => x.status === 'update' && live.has(x.portfolioId))
    const byId = Object.fromEntries(goalList.map((g) => [g.goalId, g]))
    const linked = new Set(goalPortfolioMappings.filter((m) => Number(m.allocationPct) > 0 && isLiveGoal(byId[m.goalId])).map((m) => m.portfolioId))
    const withOriginal = new Set(mfHoldings.filter((h) => h.originalTargetPct !== null && h.originalTargetPct !== undefined).map((h) => h.portfolioId))
    const restores = [...withOriginal].filter((pid) => !linked.has(pid))
    return { updates, restores, withOriginal }
  }, [loading, isRefreshing, freshLoad, pass, goalList, goalPortfolioMappings, mfHoldings, mfPortfolios, stockHoldings, otherInvList, assetAllocations]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if ((!work.updates.length && !work.restores.length) || busy.current || typeof updateHoldingAllocations !== 'function') return
    try { if (sessionStorage.getItem('cf-record') === '1') return } catch { /* ignore */ }
    const once = (key) => { try { if (sessionStorage.getItem(key)) return false; sessionStorage.setItem(key, '1') } catch { /* ignore */ } return true }
    const nameOf = (pid) => (mfPortfolios || []).find((p) => p.portfolioId === pid)?.portfolioName || 'a portfolio'
    busy.current = true
    ;(async () => {
      // 1) no longer linked: the user's own targets come back
      for (const pid of work.restores) {
        if (typeof restoreOriginalTargets !== 'function' || !once(`cf-gt-restore:${pid}`)) continue
        try {
          await restoreOriginalTargets(pid)
          try { localStorage.removeItem(`cf-gt-reason:${pid}`) } catch { /* ignore */ }
          showToast(`${nameOf(pid)} is no longer linked to a goal: your own targets are back.`, 'success', 6000)
        } catch (e) { showToast(`Could not restore your targets: ${e.message}`, 'error') }
      }
      // 2) a goal reached a new stage: keep the user's own targets once, then set the goal's
      for (const x of work.updates) {
        const key = `cf-gt:${x.portfolioId}:${x.targets.map((t) => t.targetAllocationPct).join('/')}`
        if (!once(key)) continue
        try {
          if (!work.withOriginal?.has(x.portfolioId) && typeof saveOriginalTargets === 'function') await saveOriginalTargets(x.portfolioId)
          // send EVERY fund of the portfolio (funds not in the new targets keep theirs), so nothing is dropped from the sheet
          const nt = Object.fromEntries(x.targets.map((t) => [String(t.schemeCode), t.targetAllocationPct]))
          const all = (mfHoldings || []).filter((hh) => hh.portfolioId === x.portfolioId)
          await updateHoldingAllocations(x.portfolioId, all.map((hh) => ({ schemeCode: hh.schemeCode, fundName: hh.fundName, targetAllocationPct: nt[String(hh.schemeCode)] ?? (Number(hh.targetAllocationPct) || 0), isNew: false })))
          // remember WHY these targets moved, so Rebalance can say "goal step" instead of plain drift
          try { localStorage.setItem(`cf-gt-reason:${x.portfolioId}`, JSON.stringify({ needEq: Math.round(x.needEq), goals: x.links.map((l) => l.goal.goalName), at: Date.now() })) } catch { /* ignore */ }
          showToast(`Targets updated for ${nameOf(x.portfolioId)}: its goals now need ${Math.round(x.needEq)}% equity. See Rebalance for the moves.`, 'success', 6000)
        } catch (e) { showToast(`Could not update targets: ${e.message}`, 'error') }
      }
      busy.current = false
      setPass((n) => n + 1)
    })()
  }, [work, mfHoldings, updateHoldingAllocations, saveOriginalTargets, restoreOriginalTargets, mfPortfolios, showToast])
}
