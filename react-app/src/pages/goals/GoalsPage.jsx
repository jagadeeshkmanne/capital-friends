import { useState, useMemo, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Pencil, Target, Link2, ArrowDownCircle, Trophy, ShieldAlert, Trash2, AlertTriangle, Wallet, TrendingUp, HelpCircle } from 'lucide-react'
import { formatINR, splitFundName } from '../../data/familyData'
import { useFamily } from '../../context/FamilyContext'
import { useData } from '../../context/DataContext'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'
import Modal from '../../components/Modal'
import GoalForm from '../../components/forms/GoalForm'
import GoalWithdrawalPlan from '../../components/forms/GoalWithdrawalPlan'
import GlidepathRebalancePlan from '../../components/forms/GlidepathRebalancePlan'
import RetirementBucketPlan from '../../components/forms/RetirementBucketPlan'
import PageLoading from '../../components/PageLoading'

const statusBadge = {
  'On Track': 'bg-blue-500/15 text-[var(--accent-blue)]',
  Behind: 'bg-amber-500/15 text-[var(--accent-amber)]',
  Critical: 'bg-rose-500/15 text-[var(--accent-rose)]',
  'Needs Attention': 'bg-amber-500/15 text-[var(--accent-amber)]',
  Achieved: 'bg-emerald-500/15 text-emerald-400',
  Paused: 'bg-slate-500/15 text-[var(--text-muted)]',
}

const priorityBadge = {
  High: 'bg-rose-500/15 text-[var(--accent-rose)]',
  Medium: 'bg-amber-500/15 text-[var(--accent-amber)]',
  Low: 'bg-blue-500/15 text-[var(--accent-blue)]',
}

// Glide path: recommended equity % by years to goal
const GLIDE_PATH = [
  { maxYears: 1,  equity: 10, label: 'Short-term' },
  { maxYears: 3,  equity: 30, label: 'Short-term' },
  { maxYears: 5,  equity: 50, label: 'Medium-term' },
  { maxYears: 7,  equity: 65, label: 'Medium-term' },
  { maxYears: 10, equity: 75, label: 'Long-term' },
  { maxYears: Infinity, equity: 85, label: 'Long-term' },
]

function getRecommendedAllocation(goalType, yearsLeft) {
  if (goalType === 'Emergency Fund') return { equity: 0, debt: 100, label: 'Safety' }
  const step = GLIDE_PATH.find(s => yearsLeft <= s.maxYears)
  return { equity: step.equity, debt: 100 - step.equity, label: step.label }
}

// Equity categories for allocation analysis
const EQUITY_CATS = new Set(['Equity', 'ELSS', 'Index'])

function classifyPortfolio(portfolioId, holdings) {
  const ph = holdings.filter(h => h.portfolioId === portfolioId && h.units > 0)
  let total = 0, equity = 0
  for (const h of ph) {
    total += h.currentValue
    if (EQUITY_CATS.has(h.category)) equity += h.currentValue
    else if (h.category === 'Hybrid') equity += h.currentValue * 0.65
    else if (h.category === 'Multi-Asset') equity += h.currentValue * 0.50
  }
  return total > 0 ? Math.round((equity / total) * 100) : null
}

function findBestPortfolios(recommendedEquity, portfolios, holdings, mappings, excludeGoalId) {
  const usedByOthers = {}
  for (const m of (mappings || [])) {
    if (m.goalId === excludeGoalId) continue
    usedByOthers[m.portfolioId] = (usedByOthers[m.portfolioId] || 0) + m.allocationPct
  }

  // Classify all available portfolios
  const classified = []
  for (const p of portfolios) {
    const eq = classifyPortfolio(p.portfolioId, holdings)
    if (eq === null) continue
    const available = 100 - (usedByOthers[p.portfolioId] || 0)
    if (available <= 0) continue
    classified.push({ portfolioId: p.portfolioId, equityPct: eq, available })
  }
  if (classified.length === 0) return []

  // Try equity+debt combo: find best high-equity + best low-equity pair
  const recEq = recommendedEquity
  const recDebt = 100 - recommendedEquity
  if (classified.length >= 2 && recEq > 0 && recDebt > 0) {
    const eqPortfolios = classified.filter(p => p.equityPct >= 70).sort((a, b) => b.equityPct - a.equityPct)
    const debtPortfolios = classified.filter(p => p.equityPct <= 30).sort((a, b) => a.equityPct - b.equityPct)
    if (eqPortfolios.length > 0 && debtPortfolios.length > 0) {
      const eqP = eqPortfolios[0]
      const debtP = debtPortfolios[0]
      if (eqP.portfolioId !== debtP.portfolioId) {
        // Split: equity portfolio gets recEq%, debt portfolio gets recDebt%
        const eqAlloc = Math.min(recEq, eqP.available)
        const debtAlloc = Math.min(recDebt, debtP.available)
        if (eqAlloc > 0 && debtAlloc > 0) {
          return [
            { portfolioId: eqP.portfolioId, availablePct: eqAlloc },
            { portfolioId: debtP.portfolioId, availablePct: debtAlloc },
          ]
        }
      }
    }
  }

  // Fallback: single best-fit portfolio (closest equity % to recommended)
  let best = classified[0], bestDiff = Math.abs(classified[0].equityPct - recEq)
  for (let i = 1; i < classified.length; i++) {
    const diff = Math.abs(classified[i].equityPct - recEq)
    if (diff < bestDiff) { bestDiff = diff; best = classified[i] }
  }
  return [{ portfolioId: best.portfolioId, availablePct: best.available }]
}

export default function GoalsPage() {
  const navigate = useNavigate()
  const { selectedMember, member } = useFamily()
  const { goalList, addGoal, updateGoal, deleteGoal, goalPortfolioMappings, updateGoalMappings, redeemMFBulk, switchMF, mfHoldings, activeMembers, mfPortfolios, stockPortfolios, otherInvList, assetAllocations } = useData()
  const { showToast, showBlockUI, hideBlockUI } = useToast()
  const confirm = useConfirm()

  const [modal, setModal] = useState(null)
  const [withdrawalGoal, setWithdrawalGoal] = useState(null)
  const [rebalanceGoal, setRebalanceGoal] = useState(null)
  const [bucketGoal, setBucketGoal] = useState(null)
  const [showCelebration, setShowCelebration] = useState(null)
  const prevAchievedRef = useRef(new Set())

  // Inline allocation state (replaces separate Allocation Manager)
  const [linkingGoalId, setLinkingGoalId] = useState(null)
  const [localMappings, setLocalMappings] = useState([])
  const [goalDirty, setGoalDirty] = useState(false)
  const [goalSaving, setGoalSaving] = useState(false)

  const filtered = useMemo(() => {
    if (!goalList) return []
    const active = goalList.filter((g) => g.isActive !== false)
    return selectedMember === 'all' ? active : active.filter((g) => g.familyMemberId === selectedMember)
  }, [goalList, selectedMember])

  function memberLabel(g) {
    if (!g.familyMemberName || g.familyMemberName === 'Family') return g.familyMemberName || 'Family'
    const m = (activeMembers || []).find((m) => m.memberName === g.familyMemberName)
    return m?.relationship ? `${g.familyMemberName} (${m.relationship})` : g.familyMemberName
  }

  const totalTarget = filtered.reduce((s, g) => s + (g.targetAmount || 0), 0)
  const totalCurrent = filtered.reduce((s, g) => s + (g.currentValue || 0), 0)
  const totalSIP = filtered.reduce((s, g) => s + (g.monthlyInvestment || 0), 0)
  const totalLumpsum = filtered.reduce((s, g) => s + (g.lumpsumNeeded || 0), 0)
  const overallProgress = totalTarget > 0 ? (totalCurrent / totalTarget) * 100 : 0
  const needsAttention = filtered.filter((g) => g.status === 'Needs Attention').length
  const achieved = filtered.filter((g) => g.status === 'Achieved').length

  // Allocation health for ALL goals (replaces old deRiskAlerts that only checked 0-3 years)
  const allocationHealth = useMemo(() => {
    if (!filtered.length || !mfHoldings?.length) return {}
    const now = new Date()
    const health = {}
    for (const g of filtered) {
      if (g.status === 'Achieved') continue
      const yearsLeft = (new Date(g.targetDate) - now) / (365.25 * 24 * 60 * 60 * 1000)
      if (yearsLeft <= 0) continue
      const recommended = getRecommendedAllocation(g.goalType, yearsLeft)
      const mappings = (goalPortfolioMappings || []).filter(m => m.goalId === g.goalId)
      let totalValue = 0, equityValue = 0
      for (const m of mappings) {
        const holdings = mfHoldings.filter(h => h.portfolioId === m.portfolioId && h.units > 0)
        for (const h of holdings) {
          const val = h.currentValue * (m.allocationPct / 100)
          totalValue += val
          if (EQUITY_CATS.has(h.category)) equityValue += val
          else if (h.category === 'Hybrid') equityValue += val * 0.65
          else if (h.category === 'Multi-Asset') equityValue += val * 0.50
        }
      }
      const actualEquity = totalValue > 0 ? Math.round((equityValue / totalValue) * 100) : null
      const isMapped = mappings.length > 0
      const mismatch = isMapped && actualEquity !== null ? Math.round(actualEquity - recommended.equity) : null
      const needsAttention = mismatch !== null && Math.abs(mismatch) > 15

      // Live gap computation based on actual currentValue
      const cagr = g.expectedCAGR || 0.12
      const monthlyRate = cagr / 12
      const months = Math.max(0, Math.round(yearsLeft * 12))
      const fvCurrent = (g.currentValue || 0) * (months > 0 ? Math.pow(1 + monthlyRate, months) : 1)
      const gapAtMaturity = Math.max(0, (g.targetAmount || 0) - fvCurrent)
      const liveLumpsum = gapAtMaturity > 0 && months > 0
        ? Math.round(gapAtMaturity / Math.pow(1 + monthlyRate, months)) : 0
      const liveSIP = gapAtMaturity > 0 && months > 0
        ? (monthlyRate > 0 ? Math.ceil(gapAtMaturity / ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate)) : Math.ceil(gapAtMaturity / months))
        : 0

      health[g.goalId] = { yearsLeft, label: recommended.label, recommendedEquity: recommended.equity, recommendedDebt: recommended.debt, actualEquity, isMapped, mismatch, needsAttention, liveLumpsum, liveSIP }
    }
    return health
  }, [filtered, goalPortfolioMappings, mfHoldings])

  // Live totals from allocationHealth (based on actual portfolio progress)
  const liveTotalSIP = filtered.reduce((s, g) => s + (allocationHealth[g.goalId]?.liveSIP || 0), 0)
  const liveTotalLumpsum = filtered.reduce((s, g) => s + (allocationHealth[g.goalId]?.liveLumpsum || 0), 0)

  // De-risk alerts derived from allocationHealth (over-equity goals)
  const deRiskAlerts = useMemo(() => {
    return filtered
      .filter(g => { const h = allocationHealth[g.goalId]; return h && h.needsAttention && h.mismatch > 0 })
      .map(g => {
        const h = allocationHealth[g.goalId]
        return { goalId: g.goalId, goalName: g.goalName, yearsLeft: h.yearsLeft.toFixed(1), equityPct: h.actualEquity, maxEquity: h.recommendedEquity, excessPct: h.mismatch }
      })
  }, [filtered, allocationHealth])

  // Detect newly achieved goals
  useEffect(() => {
    const currentAchieved = new Set(filtered.filter((g) => g.status === 'Achieved').map((g) => g.goalId))
    const prev = prevAchievedRef.current
    for (const id of currentAchieved) {
      if (!prev.has(id)) {
        const goal = filtered.find((g) => g.goalId === id)
        if (goal) { setShowCelebration(goal); setTimeout(() => setShowCelebration(null), 5000) }
      }
    }
    prevAchievedRef.current = currentAchieved
  }, [filtered])

  // === Investment data for allocation ===
  function inferType(id) {
    if (!id) return 'MF'
    if (id.startsWith('PFL-STK-')) return 'Stock'
    if (id.startsWith('INV-')) return 'Other'
    return 'MF'
  }

  const investments = useMemo(() => {
    const map = {}
    ;(mfPortfolios || []).forEach((p) => {
      map[p.portfolioId] = { name: p.portfolioName?.replace(/^PFL-/, '') || p.portfolioName, value: p.currentValue || 0, type: 'MF', owner: p.ownerName || '' }
    })
    ;(stockPortfolios || []).forEach((p) => {
      map[p.portfolioId] = { name: p.portfolioName, value: p.currentValue || 0, type: 'Stock', owner: p.ownerName || '' }
    })
    ;(otherInvList || []).forEach((i) => {
      map[i.investmentId] = { name: i.investmentName, value: i.currentValue || 0, type: 'Other', owner: i.familyMemberName || '' }
    })
    return map
  }, [mfPortfolios, stockPortfolios, otherInvList])

  const allInvestments = useMemo(() => {
    const items = []
    ;(mfPortfolios || []).filter((p) => p.status !== 'Inactive').forEach((p) => {
      items.push({ id: p.portfolioId, name: p.portfolioName?.replace(/^PFL-/, '') || p.portfolioName, value: p.currentValue || 0, type: 'MF', owner: p.ownerName || '' })
    })
    ;(stockPortfolios || []).filter((p) => p.status !== 'Inactive').forEach((p) => {
      items.push({ id: p.portfolioId, name: p.portfolioName, value: p.currentValue || 0, type: 'Stock', owner: p.ownerName || '' })
    })
    ;(otherInvList || []).filter((i) => i.status === 'Active').forEach((i) => {
      items.push({ id: i.investmentId, name: i.investmentName, value: i.currentValue || 0, type: 'Other', owner: i.familyMemberName || '' })
    })
    return items
  }, [mfPortfolios, stockPortfolios, otherInvList])

  const activeMFPortfolios = useMemo(() => (mfPortfolios || []).filter(p => p.status !== 'Inactive'), [mfPortfolios])
  const mfItems = allInvestments.filter((it) => it.type === 'MF')

  // Under-allocated portfolios: have goal mappings but total active allocation < 100%
  const underAllocatedPortfolios = useMemo(() => {
    const activeGoalIds = new Set((goalList || []).filter(g => g.status !== 'Achieved').map(g => g.goalId))
    const totals = {}
    for (const m of (goalPortfolioMappings || [])) {
      if (activeGoalIds.has(m.goalId)) {
        totals[m.portfolioId] = (totals[m.portfolioId] || 0) + m.allocationPct
      }
    }
    return Object.entries(totals)
      .filter(([, total]) => total > 0 && total < 100)
      .map(([portfolioId, total]) => {
        const inv = investments[portfolioId]
        return inv ? { portfolioId, name: inv.name, total, unlinked: Math.round(100 - total) } : null
      })
      .filter(Boolean)
  }, [goalPortfolioMappings, goalList, investments])
  const stockItems = allInvestments.filter((it) => it.type === 'Stock')
  const otherItems = allInvestments.filter((it) => it.type === 'Other')

  // Cross-goal allocation totals (excluding the currently linking goal)
  const otherGoalAllocs = useMemo(() => {
    const map = {}
    ;(goalPortfolioMappings || []).forEach((m) => {
      if (m.goalId === linkingGoalId) return
      if (!map[m.portfolioId]) map[m.portfolioId] = { total: 0, goals: [] }
      map[m.portfolioId].total += m.allocationPct
      const g = (goalList || []).find((g2) => g2.goalId === m.goalId)
      map[m.portfolioId].goals.push({ goalName: g?.goalName || m.goalId, pct: m.allocationPct })
    })
    return map
  }, [goalPortfolioMappings, linkingGoalId, goalList])

  const overAllocated = useMemo(() => {
    const issues = []
    for (const m of localMappings) {
      const other = otherGoalAllocs[m.portfolioId]
      const combined = (other?.total || 0) + (m.allocationPct || 0)
      if (combined > 100) {
        const item = allInvestments.find((it) => it.id === m.portfolioId)
        issues.push({ name: item?.name || m.portfolioId, combined, excess: combined - 100 })
      }
    }
    return issues
  }, [localMappings, otherGoalAllocs, allInvestments])

  const goalIsValid = overAllocated.length === 0

  // === Allocation actions ===
  function startLinking(goalId) {
    const existing = (goalPortfolioMappings || []).filter((m) => m.goalId === goalId).map((m) => ({
      portfolioId: m.portfolioId, allocationPct: m.allocationPct, investmentType: m.investmentType || inferType(m.portfolioId),
    }))
    // Auto-suggest best portfolio if no existing mappings and portfolios exist
    if (existing.length === 0 && activeMFPortfolios.length > 0 && mfHoldings?.length) {
      const goal = (goalList || []).find(g => g.goalId === goalId)
      if (goal) {
        const yearsLeft = (new Date(goal.targetDate) - new Date()) / (365.25 * 24 * 60 * 60 * 1000)
        if (yearsLeft > 0) {
          const rec = getRecommendedAllocation(goal.goalType, yearsLeft)
          const suggestions = findBestPortfolios(rec.equity, activeMFPortfolios, mfHoldings, goalPortfolioMappings, goalId)
          if (suggestions.length > 0) {
            setLocalMappings(suggestions.map(s => ({ portfolioId: s.portfolioId, allocationPct: s.availablePct, investmentType: 'MF' })))
            setLinkingGoalId(goalId)
            setGoalDirty(true)
            return
          }
        }
      }
    }
    setLocalMappings(existing)
    setLinkingGoalId(goalId)
    setGoalDirty(false)
  }

  function stopLinking() {
    setLinkingGoalId(null)
    setLocalMappings([])
    setGoalDirty(false)
  }

  function addLocalMapping() {
    const used = new Set(localMappings.map((m) => m.portfolioId))
    const available = allInvestments.find((item) => !used.has(item.id) && (otherGoalAllocs[item.id]?.total || 0) < 100)
    if (!available) return
    setLocalMappings((prev) => [...prev, { portfolioId: available.id, allocationPct: 0, investmentType: available.type }])
    setGoalDirty(true)
  }

  function removeLocalMapping(idx) {
    setLocalMappings((prev) => prev.filter((_, i) => i !== idx))
    setGoalDirty(true)
  }

  function updateLocalMapping(idx, field, value) {
    setLocalMappings((prev) => prev.map((m, i) => {
      if (i !== idx) return m
      if (field === 'allocationPct') {
        const otherTotal = otherGoalAllocs[m.portfolioId]?.total || 0
        const maxAllowed = Math.max(0, 100 - otherTotal)
        return { ...m, allocationPct: Math.max(0, Math.min(maxAllowed, Number(value) || 0)) }
      }
      if (field === 'portfolioId') {
        const item = allInvestments.find((it) => it.id === value)
        const otherTotal = otherGoalAllocs[value]?.total || 0
        const maxAllowed = Math.max(0, 100 - otherTotal)
        return { ...m, portfolioId: value, investmentType: item?.type || inferType(value), allocationPct: Math.min(m.allocationPct, maxAllowed) }
      }
      return m
    }))
    setGoalDirty(true)
  }

  async function saveGoalMappings() {
    if (!goalIsValid) return
    setGoalSaving(true)
    showBlockUI('Saving...')
    try {
      await updateGoalMappings(linkingGoalId, localMappings.filter((m) => m.allocationPct > 0))
      showToast('Allocation updated')
      stopLinking()
    } catch (err) {
      showToast(err.message || 'Failed to save', 'error')
    } finally {
      hideBlockUI()
      setGoalSaving(false)
    }
  }

  // Loading state — after all hooks
  if (goalList === null) return <PageLoading title="Loading goals" cards={5} />

  async function handleSave(data) {
    showBlockUI('Saving...')
    try {
      if (modal?.edit) {
        await updateGoal(modal.edit.goalId, data)
        showToast('Goal updated')
      } else {
        const result = await addGoal(data)
        showToast('Goal added')
        // Auto-suggest best-fit portfolio for new goal
        const newGoalId = result?.goalId
        if (newGoalId && activeMFPortfolios.length > 0 && mfHoldings?.length) {
          const yearsLeft = (new Date(data.targetDate) - new Date()) / (365.25 * 24 * 60 * 60 * 1000)
          if (yearsLeft > 0) {
            const rec = getRecommendedAllocation(data.goalType, yearsLeft)
            const suggestions = findBestPortfolios(rec.equity, activeMFPortfolios, mfHoldings, goalPortfolioMappings, newGoalId)
            if (suggestions.length > 0) {
              setLocalMappings(suggestions.map(s => ({ portfolioId: s.portfolioId, allocationPct: s.availablePct, investmentType: 'MF' })))
              setLinkingGoalId(newGoalId)
              setGoalDirty(true)
            }
          }
        }
      }
      setModal(null)
    } catch (err) {
      showToast(err.message || 'Failed to save goal', 'error')
    } finally {
      hideBlockUI()
    }
  }

  async function handleDelete() {
    if (modal?.edit && await confirm('Delete this goal?', { title: 'Delete Goal', confirmLabel: 'Delete' })) {
      const deletedGoalId = modal.edit.goalId
      const goalMappings = (goalPortfolioMappings || []).filter((m) => m.goalId === deletedGoalId)
      showBlockUI('Deleting...')
      try {
        await deleteGoal(deletedGoalId)
        setModal(null)
        if (goalMappings.length > 0) {
          const hadShared = goalMappings.some((m) =>
            (goalPortfolioMappings || []).some((o) => o.portfolioId === m.portfolioId && o.goalId !== deletedGoalId)
          )
          showToast(hadShared ? 'Goal deleted — shared allocations freed' : 'Goal deleted')
        } else {
          showToast('Goal deleted')
        }
      } catch (err) {
        showToast(err.message || 'Failed to delete goal', 'error')
      } finally {
        hideBlockUI()
      }
    }
  }

  async function handleConfirmRebalance(switches) {
    showBlockUI('Recording switches...')
    try {
      for (const sw of switches) {
        const result = await switchMF(sw)
        if (!result?.success) throw new Error(result?.message || 'Switch failed')
      }
      setRebalanceGoal(null)
      showToast(`${switches.length} switch${switches.length !== 1 ? 'es' : ''} recorded`)
    } catch (err) {
      showToast(err.message || 'Failed to record switches', 'error')
    } finally {
      hideBlockUI()
    }
  }

  async function handleConfirmBucketPlan(switches, redemptions) {
    showBlockUI('Recording bucket plan...')
    try {
      for (const sw of switches) {
        const result = await switchMF(sw)
        if (!result?.success) throw new Error(result?.message || 'Switch failed')
      }
      if (redemptions?.length) {
        const result = await redeemMFBulk(redemptions)
        if (!result?.success) throw new Error(result?.message || 'Redemption failed')
      }
      setBucketGoal(null)
      const total = switches.length + (redemptions?.length || 0)
      showToast(`${total} transaction${total !== 1 ? 's' : ''} recorded`)
    } catch (err) {
      showToast(err.message || 'Failed to record bucket plan', 'error')
    } finally {
      hideBlockUI()
    }
  }

  function getProgress(g) {
    if (!g.targetAmount || g.targetAmount === 0) return 0
    return Math.min(((g.currentValue || 0) / g.targetAmount) * 100, 100)
  }

  function getYearsLeft(g) {
    if (!g.targetDate) return null
    const diff = new Date(g.targetDate) - new Date()
    const years = diff / (365.25 * 24 * 60 * 60 * 1000)
    return years > 0 ? years.toFixed(1) : '0'
  }

  return (
    <div className="space-y-4">
      {filtered.length === 0 ? (
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] py-12 flex flex-col items-center gap-3">
          <Target size={32} className="text-[var(--text-dim)]" />
          <p className="text-sm text-[var(--text-muted)]">No goals set{member ? ` for ${member.memberName}` : ''}</p>
          <button onClick={() => setModal('add')} className="text-xs font-semibold text-violet-400 hover:text-violet-300">
            Create your first goal
          </button>
        </div>
      ) : (
        <>
          {/* Stat Cards — 4 columns, 2 rows */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard label="Target" value={formatINR(totalTarget)} bold />
            <StatCard label="Current Value" value={formatINR(totalCurrent)} bold />
            <StatCard
              label="Gap"
              value={formatINR(Math.max(totalTarget - totalCurrent, 0))}
              positive={totalTarget <= totalCurrent}
              bold
            />
            <StatCard
              label="Progress"
              value={`${overallProgress.toFixed(1)}%`}
              sub={`${filtered.length} goal${filtered.length !== 1 ? 's' : ''}${achieved > 0 ? ` · ${achieved} done` : ''}${
                (() => { const mc = filtered.filter(g => allocationHealth[g.goalId]?.needsAttention).length; return mc > 0 ? ` · ${mc} misaligned` : '' })()
              }`}
              positive={overallProgress >= 50}
              bold
            />
            <StatCard label="SIP Needed" value={formatINR(liveTotalSIP || totalSIP)} sub={needsAttention > 0 ? `${needsAttention} need attention` : 'per month'} />
            <StatCard label="Lumpsum Needed" value={formatINR(liveTotalLumpsum || totalLumpsum)} sub="one-time today" />
          </div>

          {/* Goal Timeline */}
          {(() => {
            const now = new Date()
            const timelineGoals = filtered
              .filter(g => g.targetDate && g.status !== 'Achieved')
              .map(g => {
                const start = g.createdDate ? new Date(g.createdDate) : now
                const target = new Date(g.targetDate)
                const elapsed = now - start
                const yearsLeft = Math.max(0, (target - now) / (365.25 * 24 * 60 * 60 * 1000))
                const fundedPct = g.targetAmount > 0 ? Math.min(((g.currentValue || 0) / g.targetAmount) * 100, 100) : 0
                const gap = Math.max(0, (g.targetAmount || 0) - (g.currentValue || 0))

                // Is this goal on track? Compare actual value vs where plan says you should be
                const cagr = g.expectedCAGR || 0.12
                const monthlyRate = cagr / 12
                const elapsedMonths = Math.max(0, Math.round(elapsed / (30.44 * 24 * 60 * 60 * 1000)))
                const sip = g.monthlyInvestment || 0
                const ls = g.lumpsumInvested || 0
                const fvLs = ls > 0 && monthlyRate > 0 && elapsedMonths > 0 ? ls * Math.pow(1 + monthlyRate, elapsedMonths) : ls
                const fvSIP = sip > 0 && monthlyRate > 0 && elapsedMonths > 0
                  ? sip * ((Math.pow(1 + monthlyRate, elapsedMonths) - 1) / monthlyRate) : sip * elapsedMonths
                const expectedNow = Math.round(fvLs + fvSIP)
                const onTrack = (g.currentValue || 0) >= expectedNow || gap === 0
                const shortfall = expectedNow > 0 && elapsedMonths > 0 ? Math.max(0, expectedNow - (g.currentValue || 0)) : 0

                return { ...g, targetTime: target.getTime(), yearsLeft, fundedPct, gap, onTrack, expectedNow, shortfall, elapsedMonths }
              })
              .sort((a, b) => a.targetTime - b.targetTime)
            if (timelineGoals.length === 0) return null

            return (
              <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-4">
                <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-3">Goal Timeline</p>
                <div className="space-y-3">
                  {timelineGoals.map(g => {
                    const color = g.onTrack ? '#10b981' : g.fundedPct >= 15 ? '#f59e0b' : '#ef4444'
                    return (
                      <div key={g.goalId}>
                        {/* Row 1: Name + status badge + funded/target + years */}
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <p className="text-[11px] font-semibold text-[var(--text-primary)] truncate">{g.goalName}</p>
                            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0"
                                  style={{ background: `${color}15`, color }}>
                              {g.onTrack ? 'On track' : 'Behind'}
                            </span>
                          </div>
                          <span className="text-[10px] text-[var(--text-dim)] tabular-nums shrink-0 ml-2">{g.yearsLeft.toFixed(1)} yrs</span>
                        </div>
                        {/* Row 2: Progress bar */}
                        <div className="h-[8px] bg-[var(--bg-inset)] rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all"
                               style={{ width: `${Math.max(g.fundedPct, 1)}%`, background: color }} />
                        </div>
                        {/* Row 3: Current + expected status */}
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-[10px] font-semibold text-[var(--text-primary)] tabular-nums">{formatINR(g.currentValue || 0)}</span>
                          <span className="text-[10px] font-bold tabular-nums" style={{ color }}>{g.fundedPct.toFixed(0)}%</span>
                          {g.gap === 0 ? (
                            <span className="text-[10px] text-emerald-400 font-semibold">Funded</span>
                          ) : g.shortfall > 0 && g.elapsedMonths > 0 ? (
                            <span className="text-[10px] tabular-nums flex items-center gap-0.5" style={{ color }}
                              title={`Expected ${formatINR(g.expectedNow)} by now based on your SIP + lumpsum plan`}>
                              {formatINR(g.shortfall)} behind <HelpCircle size={9} className="shrink-0 cursor-help" />
                            </span>
                          ) : (
                            <span className="text-[10px] text-[var(--text-dim)] tabular-nums">Target {formatINR(g.targetAmount)}</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}

          {/* Celebration banner */}
          {showCelebration && (
            <div className="relative bg-gradient-to-r from-emerald-500/10 via-yellow-500/10 to-emerald-500/10 rounded-xl border border-emerald-500/30 px-4 py-3 flex items-center gap-3 animate-fade-in overflow-hidden">
              <div className="absolute inset-0 pointer-events-none">
                {Array.from({ length: 20 }).map((_, i) => (
                  <span key={i} className="absolute text-sm animate-confetti" style={{ left: `${Math.random() * 100}%`, animationDelay: `${Math.random() * 2}s`, animationDuration: `${2 + Math.random() * 2}s` }}>
                    {['🎉', '🎊', '✨', '🏆', '⭐'][i % 5]}
                  </span>
                ))}
              </div>
              <Trophy size={20} className="text-yellow-400 shrink-0 relative z-10" />
              <div className="relative z-10">
                <p className="text-sm font-bold text-emerald-400">Goal Achieved!</p>
                <p className="text-xs text-[var(--text-secondary)]">{showCelebration.goalName} — Congratulations!</p>
              </div>
              <button onClick={() => setShowCelebration(null)} className="ml-auto text-xs text-[var(--text-dim)] hover:text-[var(--text-primary)] relative z-10">Dismiss</button>
            </div>
          )}


          {/* De-risking Alerts */}
          {deRiskAlerts.length > 0 && (
            <div className="bg-[var(--bg-card)] rounded-xl border border-amber-500/20 p-4 space-y-2">
              <div className="flex items-center gap-2 mb-1">
                <ShieldAlert size={14} className="text-amber-400" />
                <p className="text-xs font-bold text-amber-400 uppercase tracking-wider">De-risking Alerts</p>
              </div>
              <p className="text-xs text-[var(--text-dim)] mb-2">
                These goals are approaching their deadline with high equity exposure. Consider moving funds to debt/liquid for capital protection.
              </p>
              <div className="space-y-1.5">
                {deRiskAlerts.map((a) => (
                  <div key={a.goalId} className="flex items-center justify-between bg-amber-500/5 rounded-lg px-3 py-2 gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[var(--text-primary)]">{a.goalName}</p>
                      <p className="text-[10px] text-[var(--text-dim)]">{a.yearsLeft} yrs left</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-bold text-amber-400">{a.equityPct}% equity</p>
                      <p className="text-[10px] text-[var(--text-dim)]">Recommended max {a.maxEquity}%</p>
                    </div>
                    <button
                      onClick={() => setRebalanceGoal(filtered.find(g => g.goalId === a.goalId))}
                      className="shrink-0 px-3 py-1.5 text-[10px] font-semibold text-violet-400 bg-violet-500/10 hover:bg-violet-500/20 rounded-lg transition-colors"
                    >
                      Rebalance
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Under-allocated portfolio warnings */}
          {underAllocatedPortfolios.length > 0 && (
            <div className="bg-[var(--bg-card)] rounded-xl border border-yellow-500/20 p-4 space-y-1.5">
              <div className="flex items-center gap-2 mb-1">
                <Wallet size={14} className="text-yellow-400" />
                <p className="text-xs font-bold text-yellow-400 uppercase tracking-wider">Unlinked Allocations</p>
              </div>
              {underAllocatedPortfolios.map(p => (
                <div key={p.portfolioId} className="flex items-center justify-between bg-yellow-500/5 rounded-lg px-3 py-2">
                  <p className="text-xs text-[var(--text-primary)]">{p.name}</p>
                  <p className="text-[10px] font-semibold text-yellow-400">{p.unlinked}% not linked to any goal</p>
                </div>
              ))}
            </div>
          )}

          {/* Add Goal button */}
          <div className="flex items-center justify-end px-1">
            <button onClick={() => setModal('add')} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-violet-400 hover:text-violet-300 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg transition-colors">
              <Plus size={14} /> Add Goal
            </button>
          </div>

          {/* Goal Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((g) => {
              const progress = getProgress(g)
              const yearsLeft = getYearsLeft(g)
              const goalMaps = (goalPortfolioMappings || []).filter((m) => m.goalId === g.goalId)
              const linkedCount = goalMaps.length

              return (
                <div key={g.goalId} className="bg-[var(--bg-card)] rounded-xl border overflow-hidden transition-colors border-[var(--border)]">
                  {/* Card Body */}
                  <div className="p-4">
                    {/* Header: Name + Status */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{g.goalName}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-[var(--text-muted)]">{memberLabel(g)}</span>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${priorityBadge[g.priority] || ''}`}>{g.priority}</span>
                        </div>
                      </div>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${statusBadge[g.status] || 'bg-slate-500/15 text-[var(--text-muted)]'}`}>
                        {g.status}
                      </span>
                    </div>

                    {/* Bucket label + Allocation Health */}
                    {(() => {
                      const h = allocationHealth[g.goalId]
                      if (!h) return null
                      const labelColor = h.label === 'Short-term' ? '#60a5fa'
                        : h.label === 'Medium-term' ? '#fbbf24'
                        : h.label === 'Long-term' ? '#34d399' : '#94a3b8'
                      return (
                        <div className="mb-3">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                  style={{ background: `${labelColor}15`, color: labelColor }}>
                              {h.label}
                            </span>
                            <span className="text-xs text-[var(--text-muted)]">
                              {h.recommendedEquity}% Equity · {h.recommendedDebt}% Debt
                            </span>
                          </div>
                          {h.isMapped && h.actualEquity !== null && (
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] text-[var(--text-dim)] uppercase w-12 shrink-0">Actual</span>
                              <div className="flex-1 h-1.5 rounded-full overflow-hidden flex"
                                   style={{ background: 'var(--bg-inset)' }}>
                                <div className="h-full" style={{
                                  width: `${h.actualEquity}%`,
                                  background: h.needsAttention ? '#f87171' : '#8b5cf6'
                                }} />
                                <div className="h-full" style={{
                                  width: `${100 - h.actualEquity}%`,
                                  background: h.needsAttention ? '#fbbf24' : '#60a5fa'
                                }} />
                              </div>
                              <span className={`text-xs font-semibold tabular-nums ${
                                h.needsAttention ? 'text-amber-400' : 'text-[var(--text-muted)]'
                              }`}>
                                {h.actualEquity}% Equity
                              </span>
                            </div>
                          )}
                          {h.needsAttention && h.mismatch > 0 && (
                            <p className="text-[10px] text-amber-400 mt-1">
                              ⚠ {h.mismatch}% over recommended equity — consider shifting to debt
                            </p>
                          )}
                          {h.needsAttention && h.mismatch < 0 && (
                            <p className="text-[10px] text-blue-400 mt-1">
                              ℹ {Math.abs(h.mismatch)}% under equity — room for more growth
                            </p>
                          )}
                          {!h.isMapped && (
                            <p className="text-[10px] text-[var(--text-dim)]">No investments linked yet</p>
                          )}
                        </div>
                      )
                    })()}

                    {/* Progress */}
                    {(() => {
                      const h = allocationHealth[g.goalId]
                      const gap = Math.max(0, (g.targetAmount || 0) - (g.currentValue || 0))
                      const onTrack = gap === 0 || g.status === 'Achieved'
                      const actual = g.currentValue || 0

                      // On track = actual >= where plan says you should be today
                      const start = g.createdDate ? new Date(g.createdDate) : new Date()
                      const elapsed = new Date() - start
                      const cagr = g.expectedCAGR || 0.12
                      const monthlyRate = cagr / 12
                      const elapsedMonths = Math.max(0, Math.round(elapsed / (30.44 * 24 * 60 * 60 * 1000)))
                      const sip = g.monthlyInvestment || 0
                      const ls = g.lumpsumInvested || 0
                      const fvLs = ls > 0 && monthlyRate > 0 && elapsedMonths > 0 ? ls * Math.pow(1 + monthlyRate, elapsedMonths) : ls
                      const fvSIP = sip > 0 && monthlyRate > 0 && elapsedMonths > 0
                        ? sip * ((Math.pow(1 + monthlyRate, elapsedMonths) - 1) / monthlyRate) : sip * elapsedMonths
                      const expectedNow = Math.round(fvLs + fvSIP)
                      const trackStatus = onTrack || actual >= expectedNow
                      const color = trackStatus ? '#10b981' : progress >= 15 ? '#f59e0b' : '#ef4444'
                      const shortfall = expectedNow > 0 ? Math.max(0, expectedNow - actual) : 0
                      const hasExpected = expectedNow > 0 && elapsedMonths > 0

                      return (
                        <>
                          {/* Current / Target row */}
                          <div className="flex items-end justify-between mb-1.5">
                            <div>
                              <p className="text-[10px] text-[var(--text-dim)] uppercase">Current</p>
                              <p className="text-sm font-bold text-[var(--text-primary)] tabular-nums">{formatINR(actual)}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] text-[var(--text-dim)] uppercase">Target · {yearsLeft ? `${yearsLeft}y` : '—'}</p>
                              <p className="text-sm font-bold text-[var(--text-primary)] tabular-nums">{formatINR(g.targetAmount)}</p>
                            </div>
                          </div>
                          {/* Progress bar */}
                          <div className="h-[6px] bg-[var(--bg-inset)] rounded-full overflow-hidden mb-1">
                            <div className="h-full rounded-full transition-all"
                                 style={{ width: `${Math.max(progress, 1)}%`, background: color }} />
                          </div>
                          {/* Status line: show expected vs actual when behind */}
                          <div className="mb-3">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold tabular-nums" style={{ color }}>
                                {progress.toFixed(0)}% · {gap === 0 ? 'Funded' : trackStatus ? 'On track' : 'Behind'}
                              </span>
                              {hasExpected && !trackStatus && shortfall > 0 && (
                                <span className="text-[10px] tabular-nums" style={{ color }}>
                                  {formatINR(shortfall)} behind plan
                                </span>
                              )}
                            </div>
                            {hasExpected && !trackStatus && (
                              <p className="text-[10px] text-[var(--text-dim)] mt-0.5 flex items-center gap-1">
                                Should be {formatINR(expectedNow)} by now
                                <HelpCircle size={10} className="text-[var(--text-dim)] shrink-0 cursor-help"
                                  title={`Based on your planned SIP of ${formatINR(sip)}/mo${ls > 0 ? ` + ${formatINR(ls)} lumpsum` : ''} at ${(cagr * 100).toFixed(0)}% expected return over ${elapsedMonths} months since goal creation`} />
                              </p>
                            )}
                          </div>
                          {/* Actionable suggestions based on live progress + portfolio mapping */}
                          {h && !onTrack && h.liveSIP > 0 && (() => {
                            const savedMaps = (goalPortfolioMappings || []).filter(m => m.goalId === g.goalId)
                            const hasMappings = savedMaps.length > 0
                            const totalAllocPct = savedMaps.reduce((s, m) => s + (m.allocationPct || 0), 0)
                            return (
                              <div className="bg-[var(--bg-inset)] rounded-lg px-3 py-2 mb-3 space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] text-[var(--text-dim)] uppercase">SIP needed</span>
                                  <span className="text-xs font-bold text-violet-400 tabular-nums">{formatINR(h.liveSIP)}/mo</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] text-[var(--text-dim)] uppercase">Or lumpsum today</span>
                                  <span className="text-xs font-bold text-violet-400 tabular-nums">{formatINR(h.liveLumpsum)}</span>
                                </div>
                                {/* Per-portfolio + fund breakdown (rebalance-aware) */}
                                {hasMappings && totalAllocPct > 0 && (
                                  <div className="pt-1.5 mt-1 border-t border-[var(--border-light)] space-y-2">
                                    <p className="text-[10px] text-[var(--text-dim)] uppercase font-semibold">Where to invest</p>
                                    {savedMaps.map(m => {
                                      const inv = investments[m.portfolioId]
                                      if (!inv) return null
                                      const share = m.allocationPct / totalAllocPct
                                      const sipShare = Math.round(h.liveSIP * share)
                                      const lsShare = Math.round(h.liveLumpsum * share)
                                      // Get funds with target allocation — use rebalance logic
                                      const pFunds = (mfHoldings || []).filter(f =>
                                        f.portfolioId === m.portfolioId && f.targetAllocationPct > 0
                                      )
                                      const pValue = pFunds.reduce((s, f) => s + f.currentValue, 0)
                                      // Rebalance-aware lumpsum distribution (same as MFRebalanceDialog)
                                      const newTotal = pValue + lsShare
                                      const fundDist = pFunds.map(f => {
                                        const targetVal = (f.targetAllocationPct / 100) * newTotal
                                        let invest = Math.max(0, targetVal - f.currentValue)
                                        if (f.lumpsumRestricted) invest = 0
                                        return { ...f, invest }
                                      })
                                      const totalRaw = fundDist.reduce((s, f) => s + f.invest, 0)
                                      // Scale to match lsShare exactly
                                      const scaled = totalRaw > 0 ? fundDist.map(f => ({
                                        ...f, invest: f.invest > 0 ? Math.round(f.invest * lsShare / totalRaw) : 0
                                      })) : fundDist
                                      // SIP: use target allocation % (same as rebalance SIP logic)
                                      const totalTargetPct = pFunds.reduce((s, f) => s + f.targetAllocationPct, 0)
                                      const sipDist = pFunds.map(f => {
                                        if (f.sipRestricted) return { schemeCode: f.schemeCode, sip: 0 }
                                        const normalSIP = totalTargetPct > 0 ? Math.round(sipShare * f.targetAllocationPct / totalTargetPct) : 0
                                        return { schemeCode: f.schemeCode, sip: normalSIP }
                                      })
                                      const showFunds = scaled.some(f => f.invest > 0) || sipDist.some(f => f.sip > 0)
                                      return (
                                        <div key={m.portfolioId}>
                                          <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-semibold text-[var(--text-secondary)]">{inv.name} ({m.allocationPct}%)</span>
                                            <span className="text-[10px] font-semibold text-violet-400 tabular-nums shrink-0 ml-2">
                                              {formatINR(sipShare)}/mo · {formatINR(lsShare)}
                                            </span>
                                          </div>
                                          {showFunds && (
                                            <div className="ml-2 mt-0.5 space-y-0.5">
                                              {scaled.map(f => {
                                                const sd = sipDist.find(s => s.schemeCode === f.schemeCode)
                                                const fundSIP = sd?.sip || 0
                                                if (f.invest === 0 && fundSIP === 0) return null
                                                const isOverweight = pValue > 0 && (f.currentValue / pValue) * 100 > f.targetAllocationPct + 2
                                                return (
                                                  <div key={f.schemeCode} className="flex items-center justify-between">
                                                    <span className={`text-[9px] truncate mr-2 ${isOverweight ? 'text-amber-400/70' : 'text-[var(--text-dim)]'}`}>
                                                      {splitFundName(f.fundName).main}
                                                      {isOverweight ? ' (overweight)' : ` (${f.targetAllocationPct}%)`}
                                                    </span>
                                                    <span className="text-[9px] text-violet-400/80 tabular-nums shrink-0">
                                                      {fundSIP > 0 ? `${formatINR(fundSIP)}/mo` : ''}
                                                      {fundSIP > 0 && f.invest > 0 ? ' · ' : ''}
                                                      {f.invest > 0 ? formatINR(f.invest) : ''}
                                                    </span>
                                                  </div>
                                                )
                                              })}
                                            </div>
                                          )}
                                        </div>
                                      )
                                    })}
                                  </div>
                                )}
                                {!hasMappings && (
                                  <p className="text-[10px] text-amber-400 pt-1">
                                    Link portfolios to see where to invest
                                  </p>
                                )}
                                <p className="text-[10px] text-[var(--text-dim)] italic">
                                  at {((g.expectedCAGR || 0.12) * 100).toFixed(0)}% expected return
                                </p>
                              </div>
                            )
                          })()}
                          {h && !onTrack && !h.liveSIP && h.yearsLeft > 0 && (
                            <div className="bg-emerald-500/5 rounded-lg px-3 py-2 mb-3">
                              <p className="text-[10px] text-emerald-400 font-semibold">
                                Current investments will cover this goal by target date
                              </p>
                            </div>
                          )}
                        </>
                      )
                    })()}

                    {/* Action buttons */}
                    <div className="flex items-center gap-1 pt-2 border-t border-[var(--border-light)]">
                      <button
                        onClick={(e) => { e.stopPropagation(); startLinking(g.goalId) }}
                        className={`flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-semibold rounded-lg transition-colors ${
                          linkedCount > 0 ? 'text-violet-400 hover:bg-violet-500/10' : 'text-amber-400 hover:bg-amber-500/10'
                        }`}
                      >
                        <Link2 size={11} />
                        {linkedCount > 0 ? `${linkedCount} linked` : 'Link'}
                        {linkedCount === 0 && <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" />}
                      </button>
                      {g.status === 'Achieved' && g.goalType !== 'Retirement' && (
                        <button onClick={() => setWithdrawalGoal(g)} className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-semibold text-[var(--text-dim)] hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors">
                          <ArrowDownCircle size={11} /> Withdraw
                        </button>
                      )}
                      {g.goalType === 'Retirement' && (
                        <button onClick={() => setBucketGoal(g)} className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-semibold text-[var(--text-dim)] hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors">
                          <Wallet size={11} /> Buckets
                        </button>
                      )}
                      <button onClick={() => setModal({ edit: g })} className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-semibold text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-white/5 rounded-lg transition-colors ml-auto">
                        <Pencil size={11} /> Edit
                      </button>
                    </div>
                  </div>

                </div>
              )
            })}
          </div>

          {/* Achieved Goals Showcase */}
          {achieved > 0 && (
            <div className="bg-[var(--bg-card)] rounded-xl border border-emerald-500/20 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Trophy size={14} className="text-yellow-400" />
                <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Achieved Goals</p>
              </div>
              <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
                {filtered.filter((g) => g.status === 'Achieved').map((g) => (
                  <div key={g.goalId} className="shrink-0 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2 min-w-[160px]">
                    <p className="text-xs font-semibold text-emerald-400">{g.goalName}</p>
                    <p className="text-sm font-bold text-[var(--text-primary)] mt-1">{formatINR(g.targetAmount)}</p>
                    <p className="text-[10px] text-[var(--text-dim)] mt-0.5">{memberLabel(g)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.edit ? 'Edit Goal' : 'Add Goal'} wide>
        <GoalForm
          initial={modal?.edit || undefined}
          onSave={handleSave}
          onDelete={modal?.edit ? handleDelete : undefined}
          onCancel={() => setModal(null)}
        />
      </Modal>

      {/* Link Investments Modal — same GoalForm dialog with linking section */}
      <Modal open={!!linkingGoalId && !modal} onClose={stopLinking} title={`Link Investments — ${(goalList || []).find(g => g.goalId === linkingGoalId)?.goalName || ''}`} wide>
        {(() => {
          const linkGoal = (goalList || []).find(g => g.goalId === linkingGoalId)
          if (!linkGoal) return null
          const h = allocationHealth[linkingGoalId]
          return (
            <GoalForm
              initial={linkGoal}
              onSave={handleSave}
              onCancel={stopLinking}
              linkingContent={
                <div className="space-y-3 pt-2 mt-2 border-t border-[var(--border-light)]">
                  {/* Suggested Allocation */}
                  {h && (() => {
                    const labelColor = h.label === 'Short-term' ? '#60a5fa'
                      : h.label === 'Medium-term' ? '#fbbf24'
                      : h.label === 'Long-term' ? '#34d399' : '#94a3b8'
                    const advice = h.label === 'Safety' ? 'Keep in liquid/debt funds for instant access.'
                      : h.label === 'Short-term' ? 'Focus on debt/hybrid funds to preserve capital.'
                      : h.label === 'Medium-term' ? 'Balanced mix — gradually shift to debt as deadline nears.'
                      : 'Growth-oriented — can take higher equity exposure.'
                    return (
                      <div className="rounded-lg border p-3 space-y-2 bg-blue-500/5 border-blue-500/15">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <TrendingUp size={12} className="text-blue-400" />
                            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">Suggested Allocation</span>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                style={{ background: `${labelColor}15`, color: labelColor }}>
                            {h.label}
                          </span>
                        </div>
                        <div className="flex-1 h-2 rounded-full overflow-hidden flex" style={{ background: 'var(--bg-inset)' }}>
                          <div className="h-full rounded-l-full" style={{ width: `${h.recommendedEquity}%`, background: '#8b5cf6' }} />
                          <div className="h-full rounded-r-full" style={{ width: `${h.recommendedDebt}%`, background: '#60a5fa' }} />
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-violet-500" />
                              <span className="text-[10px] text-[var(--text-dim)]">Equity {h.recommendedEquity}%</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-blue-400" />
                              <span className="text-[10px] text-[var(--text-dim)]">Debt {h.recommendedDebt}%</span>
                            </div>
                          </div>
                        </div>
                        <p className="text-[10px] text-[var(--text-dim)]">{advice}</p>
                        {goalDirty && localMappings.length === 1 && (
                          <p className="text-[10px] text-violet-400">Auto-suggested — adjust if needed</p>
                        )}
                      </div>
                    )
                  })()}

                  {/* Link Investments heading */}
                  <div className="flex items-center gap-2">
                    <Link2 size={12} className="text-violet-400" />
                    <span className="text-xs font-semibold text-violet-400">Link Investments</span>
                  </div>

                  {/* Empty state — no investments exist */}
                  {allInvestments.length === 0 && localMappings.length === 0 && (
                    <div className="bg-[var(--bg-inset)] rounded-lg p-4 text-center space-y-2">
                      <Wallet size={24} className="text-[var(--text-dim)] mx-auto" />
                      <p className="text-xs text-[var(--text-secondary)]">No investment portfolios yet</p>
                      <p className="text-[10px] text-[var(--text-dim)]">Create a Mutual Fund portfolio first, then come back to link it to this goal.</p>
                      <button
                        onClick={() => { stopLinking(); navigate('/investments/mutual-funds') }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-violet-400 bg-violet-500/10 hover:bg-violet-500/20 rounded-lg transition-colors"
                      >
                        <Plus size={12} /> Create Portfolio
                      </button>
                    </div>
                  )}

                  {/* Mapping rows */}
                  {localMappings.map((m, idx) => {
                    const item = allInvestments.find((it) => it.id === m.portfolioId)
                    const other = otherGoalAllocs[m.portfolioId]
                    const otherTotal = other?.total || 0
                    const available = 100 - otherTotal
                    const combined = otherTotal + (m.allocationPct || 0)
                    return (
                      <div key={idx} className={`bg-[var(--bg-inset)] rounded-lg border p-2.5 space-y-1.5 ${combined > 100 ? 'border-rose-500/40' : 'border-[var(--border-light)]'}`}>
                        <select value={m.portfolioId} onChange={(e) => updateLocalMapping(idx, 'portfolioId', e.target.value)}
                          className="w-full px-2 py-1.5 text-xs bg-[var(--bg-input)] border border-[var(--border-input)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--sidebar-active-text)]">
                          {mfItems.length > 0 && (
                            <optgroup label="MF Portfolios">
                              {mfItems.map((p) => {
                                const fullyUsed = (otherGoalAllocs[p.id]?.total || 0) >= 100
                                const alreadyLinked = localMappings.some((o, i) => i !== idx && o.portfolioId === p.id)
                                const eqPct = classifyPortfolio(p.id, mfHoldings || [])
                                const freePct = 100 - (otherGoalAllocs[p.id]?.total || 0)
                                return (
                                  <option key={p.id} value={p.id} disabled={alreadyLinked || fullyUsed}>
                                    {p.name}{p.owner ? ` (${p.owner})` : ''}{eqPct !== null ? ` · ${eqPct}% Eq` : ''} · {fullyUsed ? 'Fully used' : `${freePct}% free`}
                                  </option>
                                )
                              })}
                            </optgroup>
                          )}
                          {stockItems.length > 0 && (
                            <optgroup label="Stock Portfolios">
                              {stockItems.map((p) => {
                                const fullyUsed = (otherGoalAllocs[p.id]?.total || 0) >= 100
                                const alreadyLinked = localMappings.some((o, i) => i !== idx && o.portfolioId === p.id)
                                return (
                                  <option key={p.id} value={p.id} disabled={alreadyLinked || fullyUsed}>
                                    {p.name}{p.owner ? ` (${p.owner})` : ''} — {formatINR(p.value)}{fullyUsed ? ' (Fully allocated)' : ''}
                                  </option>
                                )
                              })}
                            </optgroup>
                          )}
                          {otherItems.length > 0 && (
                            <optgroup label="Other Investments">
                              {otherItems.map((p) => {
                                const fullyUsed = (otherGoalAllocs[p.id]?.total || 0) >= 100
                                const alreadyLinked = localMappings.some((o, i) => i !== idx && o.portfolioId === p.id)
                                return (
                                  <option key={p.id} value={p.id} disabled={alreadyLinked || fullyUsed}>
                                    {p.name}{p.owner ? ` (${p.owner})` : ''} — {formatINR(p.value)}{fullyUsed ? ' (Fully allocated)' : ''}
                                  </option>
                                )
                              })}
                            </optgroup>
                          )}
                        </select>
                        {otherTotal > 0 && (
                          <div className={`text-[10px] px-2 py-1 rounded ${combined > 100 ? 'bg-rose-500/10 text-rose-400' : 'bg-blue-500/10 text-blue-400'}`}>
                            {other.goals.map((g2) => `${g2.goalName} (${g2.pct}%)`).join(', ')} — <span className="font-bold">Available: {Math.max(0, available)}%</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-[var(--text-dim)]">Allocation</span>
                            <input type="number" value={m.allocationPct} onChange={(e) => updateLocalMapping(idx, 'allocationPct', e.target.value)}
                              className="w-16 px-2 py-1 text-xs text-center bg-[var(--bg-input)] border border-[var(--border-input)] rounded-md text-[var(--text-primary)] focus:outline-none focus:border-[var(--sidebar-active-text)]" min="0" max={available} />
                            <span className="text-xs text-[var(--text-dim)]">%</span>
                            <button onClick={() => removeLocalMapping(idx)} className="p-1 text-[var(--text-dim)] hover:text-rose-400 rounded transition-colors ml-1">
                              <Trash2 size={12} />
                            </button>
                          </div>
                          {item && <p className="text-[10px] text-[var(--text-dim)]">Contributes {formatINR((item.value * m.allocationPct) / 100)}</p>}
                        </div>
                      </div>
                    )
                  })}

                  {/* Over-allocation warnings */}
                  {overAllocated.length > 0 && (
                    <div className="bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2 space-y-1">
                      <div className="flex items-center gap-1.5">
                        <AlertTriangle size={12} className="text-rose-400 shrink-0" />
                        <span className="text-[10px] font-bold text-rose-400 uppercase">Over-allocated</span>
                      </div>
                      {overAllocated.map((o, i) => (
                        <p key={i} className="text-[10px] text-rose-300">{o.name}: {o.combined}% total (exceeds by {o.excess}%)</p>
                      ))}
                    </div>
                  )}

                  {/* Add more investments */}
                  {(() => {
                    const used = new Set(localMappings.map((m) => m.portfolioId))
                    const canAdd = allInvestments.some((item) => !used.has(item.id) && (otherGoalAllocs[item.id]?.total || 0) < 100)
                    return canAdd && (
                      <button onClick={addLocalMapping} className="flex items-center gap-1.5 text-xs font-semibold text-violet-400 hover:text-violet-300 transition-colors">
                        <Plus size={14} /> Add Another Investment
                      </button>
                    )
                  })()}

                  {/* Save/Cancel for linking */}
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border-light)]">
                    <button onClick={stopLinking} className="px-4 py-1.5 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-hover)] transition-colors">
                      Cancel
                    </button>
                    <button onClick={saveGoalMappings} disabled={!goalDirty || !goalIsValid || goalSaving}
                      className="px-5 py-1.5 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-500 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                      {goalSaving ? 'Saving...' : 'Save Links'}
                    </button>
                  </div>
                </div>
              }
            />
          )
        })()}
      </Modal>

      <Modal open={!!rebalanceGoal} onClose={() => setRebalanceGoal(null)} title={`Rebalance to Glide Path — ${rebalanceGoal?.goalName || ''}`} wide>
        {rebalanceGoal && (
          <GlidepathRebalancePlan
            goal={rebalanceGoal}
            health={allocationHealth[rebalanceGoal.goalId]}
            goalPortfolioMappings={goalPortfolioMappings}
            mfHoldings={mfHoldings}
            mfPortfolios={mfPortfolios}
            onClose={() => setRebalanceGoal(null)}
            onConfirmRebalance={handleConfirmRebalance}
          />
        )}
      </Modal>

      <Modal open={!!bucketGoal} onClose={() => setBucketGoal(null)} title={`Retirement Bucket Plan — ${bucketGoal?.goalName || ''}`} wide>
        {bucketGoal && (
          <RetirementBucketPlan
            goal={bucketGoal}
            goalPortfolioMappings={goalPortfolioMappings}
            mfHoldings={mfHoldings}
            mfPortfolios={mfPortfolios}
            assetAllocations={assetAllocations}
            onClose={() => setBucketGoal(null)}
            onConfirmPlan={handleConfirmBucketPlan}
          />
        )}
      </Modal>

      <Modal open={!!withdrawalGoal} onClose={() => setWithdrawalGoal(null)} title={`Withdrawal Plan — ${withdrawalGoal?.goalName || ''}`} wide>
        {withdrawalGoal && (
          <GoalWithdrawalPlan
            goal={withdrawalGoal}
            onClose={() => setWithdrawalGoal(null)}
            onConfirmWithdrawal={async (redemptions) => {
              const g = withdrawalGoal
              const myMappings = (goalPortfolioMappings || []).filter(m => m.goalId === g.goalId)
              if (!myMappings.length) { setWithdrawalGoal(null); return }

              // Collect remaining goals on same portfolios BEFORE clearing
              const activeGoalIds = new Set((goalList || []).filter(gl => gl.status !== 'Achieved' && gl.goalId !== g.goalId).map(gl => gl.goalId))
              // goalChanges: { goalId -> { goalName, changes: { portfolioId -> newPct } } }
              // Merge all per-portfolio changes per affected goal to avoid overwrite on multi-portfolio goals
              const goalChanges = {}
              for (const m of myMappings) {
                const remaining = (goalPortfolioMappings || []).filter(o => o.portfolioId === m.portfolioId && activeGoalIds.has(o.goalId))
                if (remaining.length === 0) continue
                const remainingTotal = remaining.reduce((s, o) => s + o.allocationPct, 0)
                if (remainingTotal <= 0) continue
                // Scale proportionally to 100%; assign rounding remainder to the largest goal
                const scaled = remaining.map(o => ({ ...o, newPct: Math.floor((o.allocationPct / remainingTotal) * 100) }))
                const remainder = 100 - scaled.reduce((s, o) => s + o.newPct, 0)
                if (remainder > 0) {
                  const largest = scaled.reduce((a, b) => b.allocationPct > a.allocationPct ? b : a)
                  largest.newPct += remainder
                }
                for (const o of scaled) {
                  if (!goalChanges[o.goalId]) {
                    goalChanges[o.goalId] = { goalName: (goalList || []).find(gl => gl.goalId === o.goalId)?.goalName || o.goalId, changes: {} }
                  }
                  goalChanges[o.goalId].changes[m.portfolioId] = o.newPct
                }
              }
              // Build final newMappings per affected goal (single updateGoalMappings call per goal)
              const autoRedistribute = Object.entries(goalChanges).map(([goalId, { goalName, changes }]) => {
                const allMapsForGoal = (goalPortfolioMappings || []).filter(x => x.goalId === goalId)
                const newMappings = allMapsForGoal.map(x => ({
                  portfolioId: x.portfolioId,
                  allocationPct: changes[x.portfolioId] ?? x.allocationPct,
                  investmentType: x.investmentType || 'MF',
                })).filter(x => x.allocationPct > 0)
                const newPct = Object.values(changes).join('+')
                return { goalId, goalName, newPct, newMappings }
              })

              showBlockUI('Recording redemption...')
              try {
                // 1. Record actual redemptions in TransactionHistory (single bulk call)
                if (redemptions?.length) {
                  const result = await redeemMFBulk(redemptions)
                  if (!result?.success) throw new Error(result?.message || 'Redemption failed')
                }
                // 2. Clear goal mappings
                await updateGoalMappings(g.goalId, [])
                // 3. Auto-redistribute remaining goals to 100%
                for (const item of autoRedistribute) {
                  await updateGoalMappings(item.goalId, item.newMappings)
                }
                setWithdrawalGoal(null)
                const redistributedNames = autoRedistribute.map(i => i.goalName)
                const toastMsg = redistributedNames.length
                  ? `Redemption recorded. Allocations auto-adjusted for: ${redistributedNames.join(', ')}`
                  : 'Redemption recorded'
                showToast(toastMsg)
              } catch (err) {
                showToast(err.message || 'Failed to record redemption', 'error')
              } finally {
                hideBlockUI()
              }
            }}
          />
        )}
      </Modal>

    </div>
  )
}

function StatCard({ label, value, sub, positive, bold }) {
  return (
    <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] px-4 py-3">
      <p className="text-xs text-[var(--text-dim)] uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-sm tabular-nums ${bold ? 'font-bold' : 'font-semibold'} ${
        positive === undefined ? 'text-[var(--text-primary)]' : positive ? 'text-emerald-400' : 'text-[var(--accent-amber)]'
      }`}>
        {value}
      </p>
      {sub && <p className="text-xs text-[var(--text-dim)] mt-0.5">{sub}</p>}
    </div>
  )
}
