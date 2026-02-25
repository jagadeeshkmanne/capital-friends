import { useMemo } from 'react'
import { useData } from '../context/DataContext'
import { useFamily } from '../context/FamilyContext'
import { formatINR } from '../data/familyData'

// ── Toggle this to false when real data is available ──
const USE_DUMMY = true

const DUMMY_CRITICAL = [
  { type: 'critical', title: 'Missing Term Life Insurance', badge: 'Add Policy', navigateTo: '/insurance' },
  { type: 'critical', title: 'No Health Insurance', badge: 'Add Policy', navigateTo: '/insurance' },
  { type: 'warning', title: 'Emergency Fund at 42%', badge: '₹3.5L left', navigateTo: '/goals' },
  { type: 'critical', title: 'SIP Payment Due', badge: '3d overdue', navigateTo: '/reminders' },
]

const DUMMY_SIGNALS = { buyOppCount: 5, rebalanceCount: 3 }

const DUMMY_REMINDERS = [
  { reminderId: 'd1', title: 'LIC Premium Due', days: 3, dateStr: '28 Feb' },
  { reminderId: 'd2', title: 'Car Insurance Renewal', days: 12, dateStr: '09 Mar' },
  { reminderId: 'd3', title: 'FD Maturity - SBI', days: 21, dateStr: '18 Mar' },
]

export default function useAlerts() {
  const { selectedMember } = useFamily()
  const {
    mfPortfolios, mfHoldings,
    insurancePolicies, goalList, reminderList,
  } = useData()

  const filterOwner = (items, key) =>
    selectedMember === 'all' ? items : items.filter((i) => i[key] === selectedMember)

  // ── Investment Signals ──
  const investmentSignals = useMemo(() => {
    if (USE_DUMMY) return DUMMY_SIGNALS

    let buyOppCount = 0
    let rebalanceCount = 0
    const activeMF = filterOwner(mfPortfolios.filter((p) => p.status !== 'Inactive'), 'ownerId')

    activeMF.forEach((p) => {
      const pHoldings = mfHoldings.filter((h) => h.portfolioId === p.portfolioId && h.units > 0)
      const pValue = pHoldings.reduce((s, h) => s + h.currentValue, 0)
      const threshold = (p.rebalanceThreshold || 0.05) * 100

      pHoldings.forEach((h) => {
        if (h.athNav > 0 && h.belowATHPct >= 5) buyOppCount++
        if (h.targetAllocationPct > 0 && pValue > 0) {
          const currentPct = (h.currentValue / pValue) * 100
          if (Math.abs(currentPct - h.targetAllocationPct) > threshold) rebalanceCount++
        }
      })
    })

    return { buyOppCount, rebalanceCount }
  }, [selectedMember, mfPortfolios, mfHoldings])

  // ── Critical Alerts ──
  const criticalAlerts = useMemo(() => {
    if (USE_DUMMY) return DUMMY_CRITICAL

    const items = []

    // Term life insurance
    const activeInsurance = filterOwner(insurancePolicies.filter((p) => p.status === 'Active'), 'memberId')
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

    // Emergency fund
    const emergencyGoals = filterOwner(goalList.filter((g) => g.isActive !== false && g.goalType === 'Emergency Fund'), 'familyMemberId')
    emergencyGoals.forEach((g) => {
      const pct = g.targetAmount > 0 ? (g.currentValue / g.targetAmount) * 100 : 0
      if (pct < 100) {
        items.push({
          type: pct >= 75 ? 'info' : 'warning',
          title: `Emergency Fund at ${pct.toFixed(0)}%`,
          badge: formatINR(g.targetAmount - g.currentValue) + ' left',
          navigateTo: '/goals',
        })
      }
    })

    // Overdue reminders
    const activeReminders = filterOwner(reminderList.filter((r) => r.isActive !== false), 'familyMemberId')
    activeReminders.filter((r) => new Date(r.dueDate) < new Date()).forEach((r) => {
      const days = Math.ceil((new Date() - new Date(r.dueDate)) / (24 * 60 * 60 * 1000))
      items.push({ type: 'critical', title: r.title, badge: `${days}d overdue`, navigateTo: '/reminders' })
    })

    // Goals needing attention
    const needsAttention = filterOwner(goalList.filter((g) => g.isActive !== false && g.status === 'Needs Attention'), 'familyMemberId')
    needsAttention.forEach((g) => {
      items.push({ type: 'warning', title: `${g.goalName} needs attention`, badge: g.priority, navigateTo: '/goals' })
    })

    return items
  }, [selectedMember, insurancePolicies, goalList, reminderList])

  // ── Upcoming Reminders (next 30 days) ──
  const upcomingReminders = useMemo(() => {
    if (USE_DUMMY) return DUMMY_REMINDERS

    const active = filterOwner(reminderList.filter((r) => r.isActive !== false && r.status !== 'Completed'), 'familyMemberId')
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
