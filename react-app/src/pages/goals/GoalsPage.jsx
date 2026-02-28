import { useState, useMemo, useEffect, useRef } from 'react'
import { Plus, Pencil, Target, Link2, ArrowDownCircle, Trophy, ShieldAlert, Trash2, AlertTriangle, ChevronDown } from 'lucide-react'
import { formatINR } from '../../data/familyData'
import { useFamily } from '../../context/FamilyContext'
import { useData } from '../../context/DataContext'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'
import Modal from '../../components/Modal'
import GoalForm from '../../components/forms/GoalForm'
import GoalWithdrawalPlan from '../../components/forms/GoalWithdrawalPlan'
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

const barColor = {
  'On Track': 'bg-blue-500',
  Behind: 'bg-amber-500',
  Critical: 'bg-rose-500',
  'Needs Attention': 'bg-amber-500',
  Achieved: 'bg-emerald-500',
  Paused: 'bg-slate-500',
}

export default function GoalsPage() {
  const { selectedMember, member } = useFamily()
  const { goalList, addGoal, updateGoal, deleteGoal, goalPortfolioMappings, updateGoalMappings, mfHoldings, activeMembers, mfPortfolios, stockPortfolios, otherInvList } = useData()
  const { showToast, showBlockUI, hideBlockUI } = useToast()
  const confirm = useConfirm()

  const [modal, setModal] = useState(null)
  const [withdrawalGoal, setWithdrawalGoal] = useState(null)
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

  // Equity categories for de-risking analysis
  const EQUITY_CATS = new Set(['Equity', 'ELSS', 'Index'])

  const deRiskAlerts = useMemo(() => {
    if (!filtered.length || !goalPortfolioMappings?.length || !mfHoldings?.length) return []
    const now = new Date()
    const alerts = []
    for (const g of filtered) {
      if (g.status === 'Achieved') continue
      const diff = new Date(g.targetDate) - now
      const yearsLeft = diff / (365.25 * 24 * 60 * 60 * 1000)
      if (yearsLeft > 3 || yearsLeft <= 0) continue
      const mappings = goalPortfolioMappings.filter((m) => m.goalId === g.goalId)
      if (!mappings.length) continue
      let totalValue = 0, equityValue = 0
      for (const m of mappings) {
        const holdings = mfHoldings.filter((h) => h.portfolioId === m.portfolioId && h.units > 0)
        for (const h of holdings) {
          const val = h.currentValue * (m.allocationPct / 100)
          totalValue += val
          if (EQUITY_CATS.has(h.category)) equityValue += val
          else if (h.category === 'Hybrid') equityValue += val * 0.65
        }
      }
      const equityPct = totalValue > 0 ? (equityValue / totalValue) * 100 : 0
      const maxEquity = yearsLeft < 1 ? 30 : yearsLeft < 2 ? 50 : 70
      if (equityPct > maxEquity) {
        alerts.push({ goalId: g.goalId, goalName: g.goalName, yearsLeft: yearsLeft.toFixed(1), equityPct: Math.round(equityPct), maxEquity, excessPct: Math.round(equityPct - maxEquity) })
      }
    }
    return alerts
  }, [filtered, goalPortfolioMappings, mfHoldings])

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

  const mfItems = allInvestments.filter((it) => it.type === 'MF')
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
    setLocalMappings(existing)
    setLinkingGoalId(goalId)
    setGoalDirty(false)
  }

  function stopLinking() {
    setLinkingGoalId(null)
    setLocalMappings([])
    setGoalDirty(false)
  }

  function toggleLinking(goalId) {
    if (linkingGoalId === goalId) stopLinking()
    else startLinking(goalId)
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
      if (modal?.edit) await updateGoal(modal.edit.goalId, data)
      else await addGoal(data)
      showToast(modal?.edit ? 'Goal updated' : 'Goal added')
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
              sub={`${filtered.length} goal${filtered.length !== 1 ? 's' : ''}${achieved > 0 ? ` · ${achieved} done` : ''}`}
              positive={overallProgress >= 50}
              bold
            />
            <StatCard label="Required SIP" value={formatINR(totalSIP)} sub={needsAttention > 0 ? `${needsAttention} need attention` : 'per month'} />
            <StatCard label="Required Lumpsum" value={formatINR(totalLumpsum)} sub="one-time today" />
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
                <p className="text-xs font-bold text-amber-400 uppercase tracking-wider">De-risking Alerts</p>
              </div>
              <p className="text-xs text-[var(--text-dim)] mb-2">
                These goals are approaching their deadline with high equity exposure. Consider moving funds to debt/liquid for capital protection.
              </p>
              <div className="space-y-1.5">
                {deRiskAlerts.map((a) => (
                  <div key={a.goalId} className="flex items-center justify-between bg-amber-500/5 rounded-lg px-3 py-2">
                    <div>
                      <p className="text-xs font-semibold text-[var(--text-primary)]">{a.goalName}</p>
                      <p className="text-[10px] text-[var(--text-dim)]">{a.yearsLeft} yrs left</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-amber-400">{a.equityPct}% equity</p>
                      <p className="text-[10px] text-[var(--text-dim)]">Recommended max {a.maxEquity}%</p>
                    </div>
                  </div>
                ))}
              </div>
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
              const isLinking = linkingGoalId === g.goalId
              const goalMaps = isLinking ? localMappings : (goalPortfolioMappings || []).filter((m) => m.goalId === g.goalId)
              const linkedCount = (goalPortfolioMappings || []).filter((m) => m.goalId === g.goalId).length
              const linkedValue = goalMaps.reduce((s, m) => {
                const inv = investments[m.portfolioId]
                return s + (inv ? (inv.value * m.allocationPct) / 100 : 0)
              }, 0)

              return (
                <div key={g.goalId} className={`bg-[var(--bg-card)] rounded-xl border overflow-hidden transition-colors ${isLinking ? 'border-violet-500/40' : 'border-[var(--border)]'}`}>
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

                    {/* Progress bar */}
                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex-1 h-2 bg-[var(--bg-inset)] rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${barColor[g.status] || 'bg-blue-500'}`} style={{ width: `${progress}%` }} />
                      </div>
                      <span className="text-xs font-bold text-[var(--text-primary)] tabular-nums w-10 text-right">{progress.toFixed(0)}%</span>
                    </div>

                    {/* Stats grid */}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mb-3">
                      <div>
                        <p className="text-[10px] text-[var(--text-dim)] uppercase">Current</p>
                        <p className="text-xs font-semibold text-[var(--text-primary)] tabular-nums">{formatINR(g.currentValue)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-[var(--text-dim)] uppercase">Target</p>
                        <p className="text-xs font-semibold text-[var(--text-primary)] tabular-nums">{formatINR(g.targetAmount)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-[var(--text-dim)] uppercase">Required SIP</p>
                        <p className="text-xs font-semibold text-[var(--text-primary)] tabular-nums">{formatINR(g.monthlyInvestment)}/mo</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-[var(--text-dim)] uppercase">Timeline</p>
                        <p className="text-xs font-semibold text-[var(--text-primary)] tabular-nums">
                          {g.status === 'Achieved' ? 'Done' : yearsLeft ? `${yearsLeft} yrs left` : '—'}
                        </p>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1 pt-2 border-t border-[var(--border-light)]">
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleLinking(g.goalId) }}
                        className={`flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-semibold rounded-lg transition-colors ${
                          isLinking ? 'bg-violet-500/20 text-violet-400' :
                          linkedCount > 0 ? 'text-violet-400 hover:bg-violet-500/10' : 'text-amber-400 hover:bg-amber-500/10'
                        }`}
                      >
                        <Link2 size={11} />
                        {isLinking ? 'Linking...' : linkedCount > 0 ? `${linkedCount} linked` : 'Link'}
                        {!isLinking && linkedCount === 0 && <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" />}
                      </button>
                      {g.status === 'Achieved' && (
                        <button onClick={() => setWithdrawalGoal(g)} className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-semibold text-[var(--text-dim)] hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors">
                          <ArrowDownCircle size={11} /> Withdraw
                        </button>
                      )}
                      <button onClick={() => setModal({ edit: g })} className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-semibold text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-white/5 rounded-lg transition-colors ml-auto">
                        <Pencil size={11} /> Edit
                      </button>
                    </div>
                  </div>

                  {/* Inline Allocation Section (expanded) */}
                  {isLinking && (
                    <div className="px-4 pb-4 space-y-2 border-t border-violet-500/20 bg-violet-500/[0.03]">
                      <div className="flex items-center justify-between pt-3">
                        <div className="flex items-center gap-2">
                          <ChevronDown size={12} className="text-violet-400" />
                          <span className="text-xs font-semibold text-violet-400">Link Investments</span>
                        </div>
                        {linkedValue > 0 && (
                          <span className="text-[10px] text-[var(--text-dim)]">Linked value: {formatINR(linkedValue)}</span>
                        )}
                      </div>

                      {/* Mapping rows */}
                      {localMappings.map((m, idx) => {
                        const item = allInvestments.find((it) => it.id === m.portfolioId)
                        const other = otherGoalAllocs[m.portfolioId]
                        const otherTotal = other?.total || 0
                        const available = 100 - otherTotal
                        const combined = otherTotal + (m.allocationPct || 0)
                        return (
                          <div key={idx} className={`bg-[var(--bg-card)] rounded-lg border p-2.5 space-y-1.5 ${combined > 100 ? 'border-rose-500/40' : 'border-[var(--border-light)]'}`}>
                            <select value={m.portfolioId} onChange={(e) => updateLocalMapping(idx, 'portfolioId', e.target.value)}
                              className="w-full px-2 py-1.5 text-xs bg-[var(--bg-input)] border border-[var(--border-input)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--sidebar-active-text)]">
                              {mfItems.length > 0 && (
                                <optgroup label="MF Portfolios">
                                  {mfItems.map((p) => {
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

                      {/* Add + Save/Cancel */}
                      {(() => {
                        const used = new Set(localMappings.map((m) => m.portfolioId))
                        const canAdd = allInvestments.some((item) => !used.has(item.id) && (otherGoalAllocs[item.id]?.total || 0) < 100)
                        return canAdd && (
                          <button onClick={addLocalMapping} className="flex items-center gap-1.5 text-xs font-semibold text-violet-400 hover:text-violet-300 transition-colors">
                            <Plus size={14} /> Link Investment
                          </button>
                        )
                      })()}

                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border-light)]">
                        <button onClick={stopLinking} className="px-4 py-1.5 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-hover)] transition-colors">
                          Cancel
                        </button>
                        <button onClick={saveGoalMappings} disabled={!goalDirty || !goalIsValid || goalSaving}
                          className="px-5 py-1.5 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-500 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                          Save
                        </button>
                      </div>
                    </div>
                  )}
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

      <Modal open={!!withdrawalGoal} onClose={() => setWithdrawalGoal(null)} title={`Withdrawal Plan — ${withdrawalGoal?.goalName || ''}`} wide>
        {withdrawalGoal && (
          <GoalWithdrawalPlan goal={withdrawalGoal} onClose={() => setWithdrawalGoal(null)} />
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
