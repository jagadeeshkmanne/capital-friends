import { useState, useMemo, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, Pencil, Target, Link2, ArrowDownCircle, Trophy, ShieldAlert, Trash2, AlertTriangle, Wallet, TrendingUp } from 'lucide-react'
import { formatINR, splitFundName } from '../../data/familyData'
import { getRecommendedAllocation, followsBucketPlan } from '../../data/glidePath'
import { useFamily } from '../../context/FamilyContext'
import { useData } from '../../context/DataContext'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'
import Modal from '../../components/Modal'
import GoalForm from '../../components/forms/GoalForm'
import GoalWithdrawalPlan from '../../components/forms/GoalWithdrawalPlan'
import GlidepathRebalancePlan from '../../components/forms/GlidepathRebalancePlan'
import PageLoading from '../../components/PageLoading'
import { calculateGoalFundingProjection } from '../../utils/goalProjection'
import { attributeFamilyGoals, equityFraction } from '../../utils/goalAttribution'
import { buildGoalPlan } from '../../utils/goalPlan'

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

// Derive DOB from member dynamicFields (canonical key "DOB" or common variants)
const DOB_KEYS = ['dob', 'date of birth', 'dateofbirth', 'birthday', 'birth date', 'date_of_birth']
function getMemberDOB(member) {
  if (!member?.dynamicFields) return null
  const key = Object.keys(member.dynamicFields).find(k => DOB_KEYS.includes(k.toLowerCase().trim()))
  if (!key) return null
  const d = new Date(member.dynamicFields[key])
  return isNaN(d.getTime()) ? null : d
}

// Equity categories for allocation analysis
export default function GoalsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { selectedMember, member } = useFamily()
  const { goalList, addGoal, updateGoal, deleteGoal, goalPortfolioMappings, updateGoalMappings, switchMF, executeMFPlan, mfHoldings, stockHoldings, activeMembers, mfPortfolios, stockPortfolios, otherInvList, liabilityList, banks, assetAllocations } = useData()
  const { showToast, showBlockUI, hideBlockUI } = useToast()
  const confirm = useConfirm()

  const [modal, setModal] = useState(null)
  // /goals/classic?add=1 (from the main goals page) opens the Add Goal form straight away
  useEffect(() => {
    if (searchParams.get('add') === '1') { setModal('add'); const p = new URLSearchParams(searchParams); p.delete('add'); setSearchParams(p, { replace: true }) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const [withdrawalGoal, setWithdrawalGoal] = useState(null)
  const [rebalanceGoal, setRebalanceGoal] = useState(null)
  const [showCelebration, setShowCelebration] = useState(null)
  const prevAchievedRef = useRef(new Set())

  // Inline allocation state (replaces separate Allocation Manager)

  const allActiveGoals = useMemo(() => (goalList || []).filter(g => g.isActive !== false), [goalList])

  const filtered = useMemo(() => {
    return selectedMember === 'all' ? allActiveGoals : allActiveGoals.filter((g) => g.familyMemberId === selectedMember)
  }, [allActiveGoals, selectedMember])

  function memberLabel(g) {
    if (!g.familyMemberName || g.familyMemberName === 'Family') return g.familyMemberName || 'Family'
    const m = (activeMembers || []).find((m) => m.memberName === g.familyMemberName)
    return m?.relationship ? `${g.familyMemberName} (${m.relationship})` : g.familyMemberName
  }

  const _now = new Date()
  // Stats always computed from ALL active goals regardless of member filter
  const totalTarget = allActiveGoals.reduce((s, g) => s + (g.targetAmount || 0), 0)
  const totalCurrent = allActiveGoals.reduce((s, g) => s + (g.currentValue || 0), 0)
  const totalSIP = allActiveGoals.reduce((s, g) => {
    const yearsLeft = g.targetDate ? (new Date(g.targetDate) - _now) / (365.25 * 24 * 60 * 60 * 1000) : 0
    return yearsLeft > 0 ? s + (g.monthlyInvestment || 0) : s
  }, 0)
  const totalLumpsum = allActiveGoals.reduce((s, g) => {
    const yearsLeft = g.targetDate ? (new Date(g.targetDate) - _now) / (365.25 * 24 * 60 * 60 * 1000) : 0
    return yearsLeft > 0 ? s + (g.lumpsumNeeded || 0) : s
  }, 0)
  const overdueTotal = allActiveGoals.reduce((s, g) => {
    const yearsLeft = g.targetDate ? (new Date(g.targetDate) - _now) / (365.25 * 24 * 60 * 60 * 1000) : 0
    if (yearsLeft <= 0 && g.status !== 'Achieved') {
      return s + Math.max(0, (g.targetAmount || 0) - (g.currentValue || 0))
    }
    return s
  }, 0)
  const overallProgress = totalTarget > 0 ? (totalCurrent / totalTarget) * 100 : 0
  const needsAttention = allActiveGoals.filter((g) => g.status === 'Needs Attention').length
  const achieved = allActiveGoals.filter((g) => g.status === 'Achieved').length

  // Portfolio Utilization
  const nwActiveMFPortfolios = (mfPortfolios || []).filter((p) => p.status === 'Active')
  const nwMfPortfolioIds = new Set(nwActiveMFPortfolios.map((p) => p.portfolioId))
  const nwActiveMFHoldings = (mfHoldings || []).filter((h) => nwMfPortfolioIds.has(h.portfolioId) && h.units > 0)
  const totalMF = nwActiveMFHoldings.reduce((s, h) => s + (h.currentValue || 0), 0)

  const nwActiveStockPortfolios = (stockPortfolios || []).filter((p) => p.status === 'Active')
  const nwStkPortfolioIds = new Set(nwActiveStockPortfolios.map((p) => p.portfolioId))
  const nwActiveStockHoldings = (stockHoldings || []).filter((h) => nwStkPortfolioIds.has(h.portfolioId))
  const totalStock = nwActiveStockHoldings.reduce((s, h) => s + (h.currentValue || 0), 0)

  const nwActiveOther = (otherInvList || []).filter((i) => i.status === 'Active')
  const totalOther = nwActiveOther.reduce((s, i) => s + (i.currentValue || 0), 0)

  const nwActiveBanks = (banks || []).filter((b) => b.status === 'Active')
  const totalCash = nwActiveBanks.reduce((s, b) => s + (b.balance || 0), 0)

  const nwActiveLiabilities = (liabilityList || []).filter((l) => l.status === 'Active')
  const totalLiabilities = nwActiveLiabilities.reduce((s, l) => s + (l.outstandingBalance || 0), 0)

  const totalNetWorth = (totalMF + totalStock + totalOther + totalCash) - totalLiabilities;
  const totalUnallocated = Math.max(0, totalNetWorth - totalCurrent);
  const unallocatedPct = totalNetWorth > 0 ? (totalUnallocated / totalNetWorth) * 100 : 0;
  const allocatedPct = totalNetWorth > 0 ? (totalCurrent / totalNetWorth) * 100 : 0;

  // Allocation health for ALL goals (replaces old deRiskAlerts that only checked 0-3 years)
  // Build fund breakdown lookup for accurate equity/debt split
  const goalAllocMap = useMemo(() => {
    const m = {}
    if (assetAllocations) {
      for (const a of assetAllocations) {
        if (a.assetAllocation) m[a.fundCode] = a.assetAllocation
      }
    }
    return m
  }, [assetAllocations])

  // Which part of each shared investment belongs to which goal: near goals get the debt first
  // (see utils/goalAttribution.js), so a shared portfolio never gets a false "move to debt".
  const goalAttribution = useMemo(() => attributeFamilyGoals({ goals: allActiveGoals, mappings: goalPortfolioMappings,
    mfHoldings, stockHoldings, otherInvList, allocMap: goalAllocMap }),
  [allActiveGoals, goalPortfolioMappings, mfHoldings, stockHoldings, otherInvList, goalAllocMap])
  // have vs need today for every goal (same numbers as the goals road)
  const goalPlans = useMemo(() => {
    try { return buildGoalPlan({ goals: allActiveGoals, attribution: goalAttribution, mfHoldings, mappings: goalPortfolioMappings, eqOf: (h) => equityFraction(h, goalAllocMap) }).goals } catch { return [] }
  }, [allActiveGoals, goalAttribution, mfHoldings, goalPortfolioMappings, goalAllocMap])

  const allocationHealth = useMemo(() => {
    if (!allActiveGoals.length) return {}
    const now = new Date()
    const health = {}
    for (const g of allActiveGoals) {
      // Achieved goals still get checked while their date is ahead: money that is already there and
      // needed soon must move out of equity even more than money that is still being built.
      const yearsLeft = (new Date(g.targetDate) - now) / (365.25 * 24 * 60 * 60 * 1000)
      if (yearsLeft <= 0) continue
      const recommended = getRecommendedAllocation(g.goalType, yearsLeft)
      const mappings = (goalPortfolioMappings || []).filter(m => m.goalId === g.goalId)
      const att = goalAttribution[g.goalId] || { total: 0, equity: 0 }
      const totalValue = att.total, equityValue = att.equity
      const actualEquity = totalValue > 0 ? Math.round((equityValue / totalValue) * 100) : null
      const isMapped = mappings.length > 0
      const mismatch = isMapped && actualEquity !== null ? Math.round(actualEquity - recommended.equity) : null
      const needsAttention = mismatch !== null && Math.abs(mismatch) > 15 && !followsBucketPlan(g.goalType, yearsLeft)

      // Live gap computation based on actual currentValue (or planned lumpsum if higher)
      const cagr = g.expectedCAGR || 0.12
      const months = Math.max(0, Math.round(yearsLeft * 12))
      const funding = calculateGoalFundingProjection({
        targetAmount: g.targetAmount,
        months,
        annualReturn: cagr,
        plannedLumpsum: g.lumpsumInvested,
        linkedCurrentValue: g.currentValue,
      })
      const liveLumpsum = funding.requiredLumpsum
      const liveSIP = funding.requiredSIP

      health[g.goalId] = { yearsLeft, label: recommended.label, recommendedEquity: recommended.equity, recommendedDebt: recommended.debt, actualEquity, isMapped, mismatch, needsAttention, liveLumpsum, liveSIP }
    }
    return health
  }, [allActiveGoals, goalPortfolioMappings, goalAttribution])

  // Live totals from allocationHealth — always from all goals
  const liveTotalSIP = allActiveGoals.reduce((s, g) => s + (allocationHealth[g.goalId]?.liveSIP || 0), 0)
  const liveTotalLumpsum = allActiveGoals.reduce((s, g) => s + (allocationHealth[g.goalId]?.liveLumpsum || 0), 0)

  // De-risk alerts derived from allocationHealth (over-equity goals)
  const deRiskAlerts = useMemo(() => {
    return filtered
      .filter(g => {
        const h = allocationHealth[g.goalId]
        return g.goalType !== 'Retirement' && h && h.needsAttention && h.mismatch > 0
      })
      .map(g => {
        const h = allocationHealth[g.goalId]
        return { goalId: g.goalId, goalName: g.goalName, achieved: g.status === 'Achieved', yearsLeft: h.yearsLeft.toFixed(1), equityPct: h.actualEquity, maxEquity: h.recommendedEquity, excessPct: h.mismatch }
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

  function getProgress(g) {
    if (!g.targetAmount || g.targetAmount === 0) return 0
    return Math.min(((g.currentValue || 0) / g.targetAmount) * 100, 100)
  }

  function getYearsLeft(g) {
    if (!g.targetDate) return null
    const diff = new Date(g.targetDate) - new Date()
    const years = diff / (365.25 * 24 * 60 * 60 * 1000)
    return years >= 0.05 ? years.toFixed(1) : '0'
  }

  return (
    <div className="space-y-4">
      
      {/* Portfolio Utilization Banner */}
      {totalNetWorth > 0 && (
        <div className="bg-gradient-to-br from-violet-500/10 to-indigo-500/5 rounded-2xl border border-violet-500/20 p-5 flex flex-col gap-3 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-violet-500/10 blur-3xl rounded-full -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 relative z-10">
            <div>
              <p className="text-xs uppercase tracking-widest text-[var(--text-dim)] font-semibold mb-1">Total Net Worth</p>
              <p className="text-2xl font-bold text-[var(--text-primary)] tabular-nums">{formatINR(totalNetWorth)}</p>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <div>
                <p className="text-[var(--text-dim)] mb-0.5"><span className="inline-block w-2 h-2 rounded-full bg-violet-400 mr-1.5"></span>Allocated to Goals</p>
                <p className="font-semibold text-violet-400 tabular-nums">{formatINR(totalCurrent)} <span className="text-xs font-medium opacity-80">({allocatedPct.toFixed(0)}%)</span></p>
              </div>
              <div>
                <p className="text-[var(--text-dim)] mb-0.5"><span className="inline-block w-2 h-2 rounded-full bg-[var(--border-light)] mr-1.5"></span>Unallocated Surplus</p>
                <p className="font-semibold text-[var(--text-primary)] tabular-nums">{formatINR(totalUnallocated)} <span className="text-xs font-medium opacity-80">({unallocatedPct.toFixed(0)}%)</span></p>
              </div>
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="h-2 w-full bg-[var(--bg-lighter)] rounded-full overflow-hidden mt-1 flex relative z-10">
            <div 
              className="h-full bg-gradient-to-r from-violet-500 to-indigo-400 transition-all duration-1000 ease-out"
              style={{ width: `${allocatedPct}%` }}
            />
          </div>
        </div>
      )}

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
              sub={`${allActiveGoals.length} goal${allActiveGoals.length !== 1 ? 's' : ''}${achieved > 0 ? ` · ${achieved} done` : ''}${
                (() => { const mc = allActiveGoals.filter(g => allocationHealth[g.goalId]?.needsAttention).length; return mc > 0 ? ` · ${mc} misaligned` : '' })()
              }${selectedMember !== 'all' ? ' · all members' : ''}`}
              positive={overallProgress >= 50}
              bold
            />
            {/* SIP vs Lumpsum — two alternative paths, not both required */}
            <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] px-4 py-3 col-span-2 sm:col-span-1 lg:col-span-2">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-[var(--text-dim)] uppercase tracking-wider mb-1">SIP / Month</p>
                  <p className="text-sm font-bold tabular-nums text-violet-400">{formatINR(liveTotalSIP ?? totalSIP)}</p>
                  <p className="text-xs text-[var(--text-dim)] mt-0.5">for active goals</p>
                </div>
                <span className="text-xs font-bold text-[var(--text-dim)] mt-3 shrink-0">OR</span>
                <div className="flex-1 min-w-0 text-right">
                  <p className="text-xs text-[var(--text-dim)] uppercase tracking-wider mb-1">Lumpsum Today</p>
                  <p className="text-sm font-bold tabular-nums text-amber-400">{formatINR(liveTotalLumpsum ?? totalLumpsum)}</p>
                  <p className="text-xs text-[var(--text-dim)] mt-0.5">for active goals</p>
                </div>
              </div>
              {overdueTotal > 0 && (
                <p className="text-xs text-rose-400 font-semibold mt-1.5">+ {formatINR(overdueTotal)} needed now · overdue</p>
              )}
            </div>
          </div>


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
                <p className="text-sm font-bold text-amber-400 uppercase tracking-wider">De-risking Alerts</p>
              </div>
              <p className="text-xs text-[var(--text-dim)] mb-2">
                These goals are approaching their deadline with high equity exposure. Consider moving funds to debt/liquid for capital protection.
              </p>
              <div className="space-y-1.5">
                {deRiskAlerts.map((a) => (
                  <div key={a.goalId} className="flex items-center justify-between bg-amber-500/5 rounded-lg px-3 py-2 gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[var(--text-primary)]">{a.goalName}</p>
                      <p className="text-xs text-[var(--text-dim)]">{a.achieved ? `Goal reached · ${a.yearsLeft} yrs left — protect it` : `${a.yearsLeft} yrs left`}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-bold text-amber-400">{a.equityPct}% equity</p>
                      <p className="text-xs text-[var(--text-dim)]">Recommended max {a.maxEquity}%</p>
                    </div>
                    <button
                      onClick={() => setRebalanceGoal(filtered.find(g => g.goalId === a.goalId))}
                      className="shrink-0 px-3 py-1.5 text-xs font-semibold text-violet-400 bg-violet-500/10 hover:bg-violet-500/20 rounded-lg transition-colors"
                    >
                      Rebalance
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Under-allocated portfolio warnings */}
          {false && underAllocatedPortfolios.length > 0 && (
            <div className="bg-[var(--bg-card)] rounded-xl border border-yellow-500/20 p-4 space-y-1.5">
              <div className="flex items-center gap-2 mb-1">
                <Wallet size={14} className="text-yellow-400" />
                <p className="text-sm font-bold text-yellow-400 uppercase tracking-wider">Unlinked Allocations</p>
              </div>
              {underAllocatedPortfolios.map(p => (
                <div key={p.portfolioId} className="flex items-center justify-between bg-yellow-500/5 rounded-lg px-3 py-2">
                  <p className="text-xs text-[var(--text-primary)]">{p.name}</p>
                  <p className="text-xs font-semibold text-yellow-400">{p.unlinked}% not linked to any goal</p>
                </div>
              ))}
            </div>
          )}

          {/* Add Goal button (+ way back to the main goals page) */}
          <div className="flex items-center justify-between gap-2 px-1">
            <button onClick={() => navigate('/goals')} className="text-xs font-semibold text-violet-400 hover:text-violet-300">← Goals road</button>
            <button onClick={() => setModal('add')} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-violet-400 hover:text-violet-300 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg transition-colors">
              <Plus size={14} /> Add Goal
            </button>
          </div>

          {/* Goal Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((g) => {
              const progress = getProgress(g)
              const yearsLeft = getYearsLeft(g)
              const _cardGap = Math.max(0, (g.targetAmount || 0) - (g.currentValue || 0))
              const isPastDue = yearsLeft === '0' && _cardGap > 0 && g.status !== 'Achieved'
              const goalMaps = (goalPortfolioMappings || []).filter((m) => m.goalId === g.goalId)
              const linkedCount = goalMaps.length
              const h = allocationHealth[g.goalId]

              // Retirement age badge
              const retirementInfo = (() => {
                if (g.goalType !== 'Retirement' || !g.targetDate) return null
                const retireYear = new Date(g.targetDate).getFullYear()
                const member = (activeMembers || []).find(m => m.memberName === g.familyMemberName)
                const dob = getMemberDOB(member)
                const retireAge = dob
                  ? Math.round((new Date(g.targetDate) - dob) / (365.25 * 24 * 60 * 60 * 1000))
                  : null
                return { retireYear, retireAge }
              })()

              // Track status
              const actual = g.currentValue || 0
              const elapsed = new Date() - (g.createdDate ? new Date(g.createdDate) : new Date())
              const cagr = g.expectedCAGR || 0.12
              const monthlyRate = Math.pow(1 + cagr, 1 / 12) - 1
              const elapsedMonths = Math.max(0, Math.round(elapsed / (30.44 * 24 * 60 * 60 * 1000)))
              const sipPlanned = g.monthlyInvestment || 0
              const lsPlanned = g.lumpsumInvested || 0
              const fvLs = lsPlanned > 0 && monthlyRate > 0 && elapsedMonths > 0 ? lsPlanned * Math.pow(1 + monthlyRate, elapsedMonths) : lsPlanned
              const fvSIP = sipPlanned > 0 && monthlyRate > 0 && elapsedMonths > 0
                ? sipPlanned * ((Math.pow(1 + monthlyRate, elapsedMonths) - 1) / monthlyRate) : sipPlanned * elapsedMonths
              const expectedNow = Math.round(fvLs + fvSIP)
              // Same rule as the status badge (server: value today vs value needed today at the goal's return).
              // The old check compared against the planned SIP since the goal was created, so a new goal always read "On track".
              const serverOnTrack = g.status === 'On Track' || g.status === 'Achieved'
              const trackStatus = !isPastDue && (_cardGap === 0 || (g.status ? serverOnTrack : actual >= expectedNow))
              const color = _cardGap === 0 ? '#10b981' : isPastDue ? '#ef4444' : trackStatus ? '#10b981' : progress >= 15 ? '#f59e0b' : '#ef4444'
              // Money already saved won't reach the target alone, but a monthly SIP can: say so plainly
              // instead of a bare "Behind" (the app doesn't yet know the SIP the user is already doing).
              const needsSip = !isPastDue && _cardGap > 0 && actual > 0 && !trackStatus && (h?.liveSIP || 0) > 0
              const statusText = _cardGap === 0 ? 'Funded' : isPastDue ? (g.goalType === 'Retirement' ? 'Short now' : 'Overdue') : (actual === 0 && _cardGap > 0) ? 'Not started' : trackStatus ? 'On track'
                : needsSip ? `On track if you invest ${formatINR(h.liveSIP)}/mo` : 'Behind'

              // SIP/Lumpsum: live (portfolio-based) > stored plan
              const sipVal = h?.liveSIP > 0 ? h.liveSIP : g.monthlyInvestment || 0
              const lsVal = h?.liveLumpsum > 0 ? h.liveLumpsum : g.lumpsumNeeded || 0
              const hasPlan = sipVal > 0 || lsVal > 0
              const investmentsCovered = h && _cardGap > 0 && !h.liveSIP && h.yearsLeft > 0

              const dateStr = g.targetDate
                ? new Date(g.targetDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
                : '—'
              const labelColor = h?.label === 'Short-term' ? '#60a5fa'
                : h?.label === 'Medium-term' ? '#fbbf24'
                : h?.label === 'Long-term' ? '#34d399' : '#94a3b8'

              return (
                <div key={g.goalId} className="bg-[var(--bg-card)] rounded-xl border overflow-hidden border-[var(--border)] flex flex-col">

                  {/* ── Header ── */}
                  <div className="px-4 pt-4 pb-3 border-b border-[var(--border-light)]">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap mb-1">
                          <p className="text-sm font-bold text-[var(--text-primary)]">{g.goalName}</p>
                          {isPastDue ? (
                            <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-rose-500/15 text-[var(--accent-rose)]">{g.goalType === 'Retirement' ? 'Retired' : 'Overdue'}</span>
                          ) : (
                            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${priorityBadge[g.priority] || ''}`}>{g.priority}</span>
                          )}
                          {retirementInfo && (
                            <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400">
                              {retirementInfo.retireAge ? `Age ${retirementInfo.retireAge}` : retirementInfo.retireYear}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs text-[var(--text-dim)]">{memberLabel(g)} · {g.goalType}</span>
                          {h?.label && (
                            <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full"
                                  style={{ background: `${labelColor}15`, color: labelColor }}>{h.label}</span>
                          )}
                        </div>
                      </div>
                      {(() => {
                        const notStarted = !isPastDue && actual === 0 && _cardGap > 0
                        const cls = needsSip ? 'bg-amber-500/15 text-amber-400' : notStarted ? 'bg-slate-500/15 text-[var(--text-muted)]' : (statusBadge[g.status] || 'bg-slate-500/15 text-[var(--text-muted)]')
                        return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${cls}`}>{needsSip ? 'Needs SIP' : notStarted ? 'Not started' : g.status}</span>
                      })()}
                    </div>
                  </div>

                  {/* ── Progress ── */}
                  <div className="px-4 py-3">
                    <div className="flex items-end justify-between mb-2">
                      <div>
                        <p className="text-xs text-[var(--text-dim)] uppercase mb-0.5">Saved</p>
                        <p className="text-lg font-bold text-[var(--text-primary)] tabular-nums leading-none">{formatINR(actual)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-[var(--text-dim)] uppercase mb-0.5">
                          Target · {yearsLeft && yearsLeft !== '0' ? `${yearsLeft}y left` : dateStr}
                        </p>
                        <p className="text-lg font-bold text-[var(--text-muted)] tabular-nums leading-none">{formatINR(g.targetAmount)}</p>
                      </div>
                    </div>
                    <div className="h-2 bg-[var(--bg-inset)] rounded-full overflow-hidden mb-1.5">
                      <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(progress, 1)}%`, background: color }} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold" style={{ color }}>{progress.toFixed(0)}% · {statusText}</span>
                      {isPastDue && _cardGap > 0 && (
                        <span className="text-xs tabular-nums text-rose-400">{formatINR(_cardGap)} still needed</span>
                      )}
                    </div>
                  </div>

                  {/* ── What to do ── */}
                  {isPastDue && _cardGap > 0 && g.status !== 'Achieved' && (
                    <div className="px-4 pb-3">
                      <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 px-3 py-2.5 flex items-center justify-between gap-2">
                        <p className="text-xs text-rose-300">{g.goalType === 'Retirement' ? 'Retirement has started: corpus still needed now' : 'Goal overdue — invest now to fund it'}</p>
                        <p className="text-sm font-bold text-rose-400 tabular-nums shrink-0">{formatINR(_cardGap)}</p>
                      </div>
                    </div>
                  )}
                  {g.status !== 'Achieved' && !isPastDue && (
                    <div className="px-4 pb-3 space-y-2">
                      {investmentsCovered ? (
                        <p className="text-xs text-emerald-400 font-semibold">✓ Current investments will cover this goal by target date</p>
                      ) : !hasPlan ? (
                        <p className="text-xs text-[var(--text-dim)] italic">Edit goal to set your investment plan</p>
                      ) : (() => {
                        const isBehind = elapsedMonths > 0 && expectedNow > 0 && !trackStatus
                        const catchUp = isBehind ? Math.max(0, expectedNow - actual) : 0
                        const savedMaps = linkedCount > 0 ? (goalPortfolioMappings || []).filter(m => m.goalId === g.goalId) : []
                        const totalAllocPct = savedMaps.reduce((s, m) => s + (m.allocationPct || 0), 0)
                        return (
                          <>
                            {isBehind && catchUp > 0 && sipPlanned > 0 && (
                              <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 px-2.5 py-2">
                                <p className="text-xs text-[var(--text-dim)] mb-1">Should be <span className="text-[var(--text-muted)] font-semibold">{formatINR(expectedNow)}</span> today — behind by <span className="font-semibold" style={{ color }}>{formatINR(catchUp)}</span></p>
                                <p className="text-xs font-semibold text-[var(--text-primary)]">
                                  Option A: invest <span className="text-amber-400">{formatINR(catchUp)}</span> now + continue <span className="text-violet-400">{formatINR(sipPlanned)}/mo</span>
                                </p>
                              </div>
                            )}
                            <div className="flex items-center gap-2">
                              <div className="flex-1 rounded-lg bg-violet-500/10 border border-violet-500/20 px-2.5 py-2 text-center">
                                <p className="text-xs text-violet-400 font-semibold mb-0.5">{isBehind ? 'Option B · SIP only' : 'SIP / Month'}</p>
                                <p className="text-sm font-bold text-[var(--text-primary)] tabular-nums">{formatINR(sipVal)}</p>
                              </div>
                              <span className="text-xs font-bold text-[var(--text-dim)] shrink-0">OR</span>
                              <div className="flex-1 rounded-lg bg-amber-500/10 border border-amber-500/20 px-2.5 py-2 text-center">
                                <p className="text-xs text-amber-400 font-semibold mb-0.5">{isBehind ? 'Option C · Lumpsum' : 'Lumpsum Today'}</p>
                                <p className="text-sm font-bold text-[var(--text-primary)] tabular-nums">{formatINR(lsVal)}</p>
                              </div>
                            </div>
                            {h?.liveSIP > 0 && totalAllocPct > 0 && (
                              <div className="space-y-1 pl-1">
                                {savedMaps.map(m => {
                                  const inv = investments[m.portfolioId]
                                  if (!inv) return null
                                  const share = m.allocationPct / totalAllocPct
                                  return (
                                    <div key={m.portfolioId} className="flex items-center justify-between text-xs">
                                      <span className="text-[var(--text-dim)] truncate mr-2">{inv.name} ({m.allocationPct}%)</span>
                                      <span className="text-violet-400 font-semibold tabular-nums shrink-0">
                                        {formatINR(Math.round(h.liveSIP * share))}/mo · {formatINR(Math.round(h.liveLumpsum * share))}
                                      </span>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </>
                        )
                      })()}
                    </div>
                  )}

                  {/* ── Allocation Health ── */}
                  {h?.isMapped && h.actualEquity !== null && (
                    <div className="mx-4 mb-3 rounded-lg bg-[var(--bg-inset)] px-3 py-2 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[var(--text-dim)] uppercase shrink-0 w-10">Equity</span>
                        <div className="flex-1 h-1.5 rounded-full overflow-hidden flex" style={{ background: 'var(--bg-card)' }}>
                          <div className="h-full" style={{ width: `${h.actualEquity}%`, background: h.needsAttention ? '#f87171' : '#8b5cf6' }} />
                          <div className="h-full" style={{ width: `${100 - h.actualEquity}%`, background: '#60a5fa' }} />
                        </div>
                        <span className={`text-xs font-semibold tabular-nums shrink-0 ${h.needsAttention ? 'text-amber-400' : 'text-[var(--text-muted)]'}`}>
                          {h.actualEquity}% <span className="text-[var(--text-dim)] font-normal">{followsBucketPlan(g.goalType, h.yearsLeft) ? '· bucket plan' : `/ rec ${h.recommendedEquity}%`}</span>
                        </span>
                      </div>
                      {h.needsAttention && h.mismatch > 0 && (
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs text-amber-400">
                            {g.goalType === 'Retirement'
                              ? `Review ${h.mismatch}% excess equity against the retirement buckets`
                              : `${h.mismatch}% over equity — consider shifting to debt`}
                          </p>
                          {g.goalType !== 'Retirement' && (
                            <button onClick={(e) => { e.stopPropagation(); setRebalanceGoal(g) }}
                              className="shrink-0 px-2.5 py-1 text-xs font-semibold text-violet-400 bg-violet-500/10 hover:bg-violet-500/20 rounded-lg transition-colors">
                              Rebalance
                            </button>
                          )}
                        </div>
                      )}
                      {h.needsAttention && h.mismatch < 0 && (
                        <p className="text-xs text-blue-400">ℹ {Math.abs(h.mismatch)}% under equity — room for growth</p>
                      )}
                      {followsBucketPlan(g.goalType, h.yearsLeft) && (
                        <p className="text-xs text-violet-400">Less than 5 years to retirement: build the buckets step by step. Open Buckets for this quarter’s step.</p>
                      )}
                    </div>
                  )}

                  {/* ── Action Footer ── */}
                  <div className="mt-auto border-t border-[var(--border)] px-4 py-2 flex items-center gap-1">
                    {/* goals take their money from the shared pool (Money for goals on the goals page): no linking here */}
                    <button onClick={(e) => { e.stopPropagation(); navigate('/goals?money=1') }} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg text-violet-400 hover:bg-violet-500/10" title="This goal's money comes from Money for goals">
                      <Link2 size={11} /> {linkedCount > 0 ? `${linkedCount} investments · auto` : 'Money for goals'}
                    </button>
                    {g.status === 'Achieved' && g.goalType !== 'Retirement' && (
                      <button onClick={() => setWithdrawalGoal(g)} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-[var(--text-dim)] hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors">
                        <ArrowDownCircle size={11} /> Withdraw
                      </button>
                    )}
                    {g.goalType === 'Retirement' && (
                      <button onClick={() => navigate(`/retirement-buckets?goal=${encodeURIComponent(g.goalId)}`)} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-[var(--text-dim)] hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors">
                        <Wallet size={11} /> {isPastDue || g.status === 'Achieved' || parseFloat(yearsLeft) <= 3 ? 'Buckets' : 'Bucket Preview'}
                      </button>
                    )}
                    <button onClick={() => setModal({ edit: g })} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-white/5 rounded-lg transition-colors ml-auto">
                      <Pencil size={11} /> Edit
                    </button>
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
                <p className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wider">Achieved Goals</p>
              </div>
              <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
                {filtered.filter((g) => g.status === 'Achieved').map((g) => (
                  <div key={g.goalId} className="shrink-0 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2 min-w-[160px]">
                    <p className="text-xs font-semibold text-emerald-400">{g.goalName}</p>
                    <p className="text-sm font-bold text-[var(--text-primary)] mt-1">{formatINR(g.targetAmount)}</p>
                    <p className="text-xs text-[var(--text-dim)] mt-0.5">{memberLabel(g)}</p>
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

      <Modal open={!!rebalanceGoal} onClose={() => setRebalanceGoal(null)} title={`Rebalance to Glide Path — ${rebalanceGoal?.goalName || ''}`} wide>
        {rebalanceGoal && (
          <GlidepathRebalancePlan
            goal={rebalanceGoal}
            health={allocationHealth[rebalanceGoal.goalId]}
            goalPortfolioMappings={goalPortfolioMappings}
            mfHoldings={mfHoldings}
            mfPortfolios={mfPortfolios}
            stockPortfolios={stockPortfolios}
            otherInvList={otherInvList}
            onClose={() => setRebalanceGoal(null)}
            onConfirmRebalance={handleConfirmRebalance}
            attribution={goalAttribution[rebalanceGoal.goalId]}
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

              showBlockUI('Recording redemption...')
              try {
                if (redemptions?.length) {
                  const result = await executeMFPlan([], redemptions)
                  if (!result?.success) throw new Error(result?.message || 'Redemption failed')
                }
                // The completed goal releases its money: it is closed, so the shared pool gives its share to the other goals
                await updateGoal(g.goalId, { ...g, familyMember: g.familyMemberName || 'Self', isActive: false, notes: [g.notes, 'Withdrawn'].filter(Boolean).join(' · ') })
                await updateGoalMappings(g.goalId, [])
                setWithdrawalGoal(null)
                showToast('Redemption recorded. The goal is closed and its money is free for your other goals.')
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
