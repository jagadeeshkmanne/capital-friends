import { useMemo } from 'react'
import { useData } from '../context/DataContext'
import { useFamily } from '../context/FamilyContext'
import { formatINR } from '../data/familyData'
import { useGoalsPlan } from './useGoalsPlan'
import { isBuyOpportunity, isStrongBuyOpportunity } from '../utils/buyOpportunities'

export default function useAlerts() {
  const { selectedMember } = useFamily()
  const {
    mfPortfolios, mfHoldings,
    insurancePolicies, goalList, reminderList,
  } = useData()
  // goal alerts use the same live numbers as the Goals page (not the old values saved on each goal)
  const { plan: goalsPlan } = useGoalsPlan()

  const filterOwner = (items, key) => {
    const arr = items || []
    return selectedMember === 'all' ? arr : arr.filter((i) => i[key] === selectedMember)
  }

  // ── Investment Signals ──
  const investmentSignals = useMemo(() => {
    let buyCount = 0
    let strongBuyCount = 0
    let rebalanceCount = 0
    const activeMF = filterOwner((mfPortfolios || []).filter((p) => p.status !== 'Inactive'), 'ownerId')

    activeMF.forEach((p) => {
      const pHoldings = (mfHoldings || []).filter((h) => h.portfolioId === p.portfolioId && h.units > 0)
      const pValue = pHoldings.reduce((s, h) => s + h.currentValue, 0)
      const threshold = (p.rebalanceThreshold || 0.05) * 100

      pHoldings.forEach((h) => {
        if (isStrongBuyOpportunity(h)) strongBuyCount++
        else if (isBuyOpportunity(h)) buyCount++
        if (!p.skipRebalance && h.targetAllocationPct > 0 && pValue > 0) {
          const currentPct = (h.currentValue / pValue) * 100
          if (Math.abs(currentPct - h.targetAllocationPct) > threshold) rebalanceCount++
        }
      })
    })

    const buyOppCount = buyCount + strongBuyCount
    return { buyOppCount, buyCount, strongBuyCount, rebalanceCount }
  }, [selectedMember, mfPortfolios, mfHoldings])

  // ── Critical Alerts ──
  const criticalAlerts = useMemo(() => {
    const items = []

    // Term life insurance
    const activeInsurance = filterOwner((insurancePolicies || []).filter((p) => p.status === 'Active'), 'memberId')
    const hasTermLife = activeInsurance.some((p) => p.policyType === 'Term Life')
    if (!hasTermLife) {
      items.push({ type: 'critical', title: 'Missing Term Life Insurance', badge: 'Add Policy', navigateTo: '/insurance' })
    }

    // Health insurance
    const healthCover = activeInsurance.filter((p) => p.policyType === 'Health').reduce((s, p) => s + p.sumAssured, 0)
    if (healthCover === 0) {
      items.push({ type: 'critical', title: 'No Health Insurance', badge: 'Add Policy', navigateTo: '/insurance' })
    } else if (healthCover < 500000) {
      items.push({ type: 'warning', title: 'Inadequate Health Insurance', badge: formatINR(healthCover), navigateTo: '/insurance' })
    }

    // Emergency fund (its share of Money for goals, as on the Goals page)
    const efPlans = (goalsPlan?.goals || []).filter((p) => p.goal.goalType === 'Emergency Fund' && (selectedMember === 'all' || p.goal.familyMemberId === selectedMember))
    efPlans.forEach((p) => {
      const pct = p.target > 0 ? (p.has / p.target) * 100 : 0
      if (pct < 98) {
        items.push({
          type: pct >= 75 ? 'info' : 'warning',
          title: `Emergency Fund at ${pct.toFixed(0)}%`,
          badge: formatINR(Math.round(p.target - p.has)) + ' left',
          navigateTo: '/goals',
        })
      }
    })

    // Overdue reminders
    const activeReminders = filterOwner((reminderList || []).filter((r) => r.isActive !== false), 'familyMemberId')
    activeReminders.filter((r) => new Date(r.dueDate) < new Date()).forEach((r) => {
      const days = Math.ceil((new Date() - new Date(r.dueDate)) / (24 * 60 * 60 * 1000))
      items.push({ type: 'critical', title: r.title, badge: `${days}d overdue`, navigateTo: '/reminders' })
    })

    // Goals that are short or whose date has come (same states as the Goals page)
    ;(goalsPlan?.goals || []).filter((p) => p.goal.goalType !== 'Emergency Fund' && (selectedMember === 'all' || p.goal.familyMemberId === selectedMember)).forEach((p) => {
      if (p.state === 'short') items.push({ type: 'warning', title: `${p.goal.goalName} is short`, badge: formatINR(Math.round(-p.gap)), navigateTo: '/goals' })
      else if (p.state === 'due' && !p.isRet) items.push({ type: 'info', title: `${p.goal.goalName}: date reached`, badge: 'Withdraw plan', navigateTo: '/goals' })
    })

    return items
  }, [selectedMember, insurancePolicies, goalList, reminderList, goalsPlan])

  // ── Upcoming Reminders (next 30 days) ──
  const upcomingReminders = useMemo(() => {
    const active = filterOwner((reminderList || []).filter((r) => r.isActive !== false && r.status !== 'Completed'), 'familyMemberId')
    const now = new Date()
    return active
      .map((r) => {
        const diff = new Date(r.dueDate) - now
        const days = Math.ceil(diff / (24 * 60 * 60 * 1000))
        const dateStr = new Date(r.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
        return { ...r, days, dateStr }
      })
      .filter((r) => r.days >= 0 && r.days <= 30)
      .sort((a, b) => a.days - b.days)
      .slice(0, 5)
  }, [selectedMember, reminderList])

  // Summary
  const totalCount = criticalAlerts.length + investmentSignals.buyOppCount + investmentSignals.rebalanceCount + upcomingReminders.length
  const criticalCount = criticalAlerts.filter((a) => a.type === 'critical').length

  return {
    criticalAlerts,
    investmentSignals,
    upcomingReminders,
    totalCount,
    criticalCount,
  }
}
