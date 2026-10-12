import { useEffect, useMemo, useRef, useState } from 'react'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import { equityFraction, attributeFamilyGoals } from '../utils/goalAttribution'
import { poolItems, sharePool, linksChanged } from '../utils/goalPool'
import { resolvePortfolioOwners } from '../utils/fundsDashboard'

/** The person's "Money for goals" switches, kept in the Settings tab as JSON { off: [ids], on: [ids] }. */
export function readPoolChoice(settings) {
  try { const c = JSON.parse(settings?.GoalsPool || '{}'); return { off: Array.isArray(c.off) ? c.off : [], on: Array.isArray(c.on) ? c.on : [] } } catch { return { off: [], on: [] } }
}

/** Pool + its share per goal, computed live from today's data (used by the goals page and the sync below). */
export function useGoalPool() {
  const d = useData()
  const { goalList, mfPortfolios, mfHoldings, stockPortfolios, stockHoldings, otherInvList, assetAllocations, settings, members, investmentAccounts, goalPortfolioMappings: savedLinks } = d
  return useMemo(() => {
    const allocMap = {}; (assetAllocations || []).forEach((a) => { if (a.assetAllocation) allocMap[a.fundCode] = a.assetAllocation })
    const eqOf = (h) => equityFraction(h, allocMap)
    const choice = readPoolChoice(settings)
    const goals = (goalList || []).filter((g) => g.isActive !== false)
    // owners: MF portfolios get theirs from the investment account, stock portfolios from the member id
    const people = members || []
    const mfP = resolvePortfolioOwners(mfPortfolios, investmentAccounts, people)
    const stP = (stockPortfolios || []).map((p) => ({ ...p, ownerName: p.ownerName || people.find((m) => m.memberId === p.ownerId)?.memberName || '' }))
    const withGoal = new Set(goals.map((g) => String(g.familyMemberName || '').trim().toLowerCase()))
    const kidNames = people.filter((m) => /^(son|daughter)$/i.test(String(m.relationship || '').trim()) && !withGoal.has(String(m.memberName || '').trim().toLowerCase())).map((m) => m.memberName)
    const items = poolItems({ mfPortfolios: mfP, mfHoldings, stockPortfolios: stP, stockHoldings, otherInvList, eqOf, choice, kidNames })
    // pass 1 without SIPs tells which funds (and so which running SIPs) each goal gets; pass 2 counts those SIPs,
    // so a goal's share is what it needs today with its SIP (same "Need today" the goal shows). Both passes
    // use today's data only, so the result is stable.
    // which SIPs a goal gets depends on which funds it gets, and that depends on its SIP: repeat until the SIPs
    // settle (each round moves halfway, so it cannot swing back and forth)
    const sipFrom = (mappings) => {
      const att = attributeFamilyGoals({ goals, mappings, mfHoldings, stockHoldings, otherInvList, allocMap })
      return Object.fromEntries(goals.map((g) => [g.goalId, ((att[g.goalId]?.items) || []).filter((it) => it.kind === 'mf').reduce((t, it) => t + (Number(it.holding?.ongoingSIP) || 0) * (it.fraction || 0), 0)]))
    }
    const reserved = savedLinks || [] // goals past their date keep the shares saved in the sheet
    let shared = sharePool({ goals, items, reserved }), sipOf = null
    for (let k = 0; k < 8; k++) {
      const next = sipFrom(shared.mappings)
      const merged = sipOf ? Object.fromEntries(Object.keys(next).map((id) => [id, (next[id] + sipOf[id]) / 2])) : next
      const same = sipOf && Object.keys(merged).every((id) => Math.abs(merged[id] - sipOf[id]) < 100)
      sipOf = merged
      shared = sharePool({ goals, items, sipOf, reserved })
      if (same) break
    }
    // last pass: a goal is never left short while money is free — count only the SIP it surely gets
    for (let k = 0; k < 3; k++) {
      const act = sipFrom(shared.mappings)
      const short = goals.some((g) => (act[g.goalId] || 0) < (sipOf[g.goalId] || 0) - 100)
      if (!short) break
      sipOf = Object.fromEntries(Object.keys(act).map((id) => [id, Math.min(act[id], sipOf[id])]))
      shared = sharePool({ goals, items, sipOf, reserved })
    }
    return { items, choice, eqOf, allocMap, ...shared }
  }, [goalList, mfPortfolios, mfHoldings, stockPortfolios, stockHoldings, otherInvList, assetAllocations, settings, members, investmentAccounts, savedLinks])
}

/**
 * Keeps the goal links in the sheet equal to the pool's share (so the buckets page, dashboard and the family
 * email report read the same numbers), and undoes the earlier "goal sets the portfolio targets" approach once:
 * any portfolio with saved original targets (column V) gets them back.
 * Runs on fresh server data only, once per change per session.
 */
export function useGoalPoolSync() {
  const { goalList, goalPortfolioMappings, mfHoldings, mfPortfolios, settings, settingsAt, updateGoalMappings, updateManyGoalMappings, updateSettings, restoreOriginalTargets, loading, isRefreshing, freshLoad } = useData()
  const { showToast } = useToast()
  const pool = useGoalPool()
  const busy = useRef(false)
  const [pass, setPass] = useState(0)

  const work = useMemo(() => {
    const failed = (freshLoad?.errors || []).map((e) => e.fn)
    if (loading || isRefreshing || !freshLoad?.at || !settingsAt || ['getAllGoals', 'getGoalPortfolioMappings', 'getAllMFHoldings', 'getAllPortfolios', 'getAllInvestments', 'getAllInvestmentsStrict_', 'getAllPortfoliosStrict_', 'getAllStockPortfolios', 'getAllStockPortfoliosStrict_', 'getAllStockHoldingsData'].some((f) => failed.includes(f))) return null
    if (!Array.isArray(goalList) || !Array.isArray(goalPortfolioMappings) || !Array.isArray(mfHoldings) || !settings) return null
    // (a failed read of other investments is reported by the server as getAllInvestmentsStrict_ — see above)
    const live = new Set(goalList.filter((g) => g.isActive !== false).map((g) => g.goalId))
    // closed goals let go of their money: any links they still have are cleared
    const closed = [...new Set(goalPortfolioMappings.filter((m) => !live.has(m.goalId) && Number(m.allocationPct) > 0).map((m) => m.goalId))]
    const current = goalPortfolioMappings.filter((m) => live.has(m.goalId))
    const restores = [...new Set(mfHoldings.filter((h) => h.originalTargetPct !== null && h.originalTargetPct !== undefined).map((h) => h.portfolioId))]
    // only goals whose own links changed are written
    const goals = [...live].filter((gid) => linksChanged(current.filter((m) => m.goalId === gid), pool.mappings.filter((m) => m.goalId === gid)))
    return { restores, changed: goals.length > 0 || closed.length > 0, goals, closed, next: pool.mappings }
  }, [loading, isRefreshing, freshLoad, settingsAt, pass, goalList, goalPortfolioMappings, mfHoldings, settings, pool.mappings]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!work || (!work.changed && !work.restores.length) || busy.current) return
    try { if (sessionStorage.getItem('cf-record') === '1') return } catch { /* ignore */ }
    const once = (key) => { try { if (sessionStorage.getItem(key)) return false; sessionStorage.setItem(key, '1') } catch { /* ignore */ } return true }
    busy.current = true
    ;(async () => {
      // the earlier approach changed portfolio targets for goals: give people their own targets back
      for (const pid of work.restores) {
        if (typeof restoreOriginalTargets !== 'function' || !once(`cf-pool-restore:${pid}`)) continue
        try {
          await restoreOriginalTargets(pid)
          const name = (mfPortfolios || []).find((p) => p.portfolioId === pid)?.portfolioName || 'a portfolio'
          showToast(`${name}: your own target allocation is back.`, 'success', 5000)
        } catch (e) { showToast(`Could not restore targets: ${e.message}`, 'error') }
      }
      if (work.changed && typeof updateGoalMappings === 'function') {
        const sig = work.next.map((m) => `${m.goalId}:${m.portfolioId}:${Math.round(m.allocationPct)}`).sort().join('|')
        if (once(`cf-pool-links:${sig}`)) {
          try {
            // keep a copy of the old hand-made links once, so they can be brought back
            if (!settings?.GoalLinksBackup && typeof updateSettings === 'function') await updateSettings({ GoalLinksBackup: JSON.stringify(goalPortfolioMappings || []) })
            // shares that shrink are saved before shares that grow, so an investment is never linked over 100% midway
            const grow = (gid) => work.next.filter((m) => m.goalId === gid).reduce((t, m) => t + m.allocationPct, 0) - (goalPortfolioMappings || []).filter((m) => m.goalId === gid).reduce((t, m) => t + Number(m.allocationPct || 0), 0)
            const list = work.closed.map((gid) => [gid, []]).concat(work.goals.slice().sort((a, b) => grow(a) - grow(b))
              .map((gid) => [gid, work.next.filter((m) => m.goalId === gid).map(({ portfolioId, allocationPct, investmentType }) => ({ portfolioId, allocationPct, investmentType }))]))
            if (typeof updateManyGoalMappings === 'function') await updateManyGoalMappings(list)
            else for (const [gid, ms] of list) await updateGoalMappings(gid, ms)
          } catch (e) { showToast(`Could not save goal money: ${e.message}`, 'error') }
        }
      }
      busy.current = false
      setPass((n) => n + 1)
    })()
  }, [work, goalPortfolioMappings, settings, updateGoalMappings, updateManyGoalMappings, updateSettings, restoreOriginalTargets, mfPortfolios, showToast])
}
