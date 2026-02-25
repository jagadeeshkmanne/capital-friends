import { useState, useMemo, useEffect, useRef } from 'react'
import { Plus, Pencil, Target, Link2, ArrowDownCircle, Trophy } from 'lucide-react'
import { formatINR } from '../../data/familyData'
import { useFamily } from '../../context/FamilyContext'
import { useData } from '../../context/DataContext'
import { useToast } from '../../context/ToastContext'
import Modal from '../../components/Modal'
import GoalForm from '../../components/forms/GoalForm'
import GoalPortfolioMapping from '../../components/forms/GoalPortfolioMapping'
import GoalWithdrawalPlan from '../../components/forms/GoalWithdrawalPlan'
import PageLoading from '../../components/PageLoading'

const statusBadge = {
  'On Track': 'bg-blue-500/15 text-[var(--accent-blue)]',
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
  'Needs Attention': 'bg-amber-500',
  Achieved: 'bg-emerald-500',
  Paused: 'bg-slate-500',
}

export default function GoalsPage() {
  const { selectedMember, member } = useFamily()
  const { goalList, addGoal, updateGoal, deleteGoal, goalPortfolioMappings } = useData()
  const { showToast, showBlockUI, hideBlockUI } = useToast()

  const [modal, setModal] = useState(null)
  const [mappingGoal, setMappingGoal] = useState(null)
  const [withdrawalGoal, setWithdrawalGoal] = useState(null)
  const [showCelebration, setShowCelebration] = useState(null)
  const prevAchievedRef = useRef(new Set())

  const filtered = useMemo(() => {
    if (!goalList) return []
    const active = goalList.filter((g) => g.isActive !== false)
    return selectedMember === 'all' ? active : active.filter((g) => g.familyMemberId === selectedMember)
  }, [goalList, selectedMember])

  const totalTarget = filtered.reduce((s, g) => s + (g.targetAmount || 0), 0)
  const totalCurrent = filtered.reduce((s, g) => s + (g.currentValue || 0), 0)
  const totalSIP = filtered.reduce((s, g) => s + (g.monthlyInvestment || 0), 0)
  const overallProgress = totalTarget > 0 ? (totalCurrent / totalTarget) * 100 : 0
  const needsAttention = filtered.filter((g) => g.status === 'Needs Attention').length
  const achieved = filtered.filter((g) => g.status === 'Achieved').length

  // Detect newly achieved goals
  useEffect(() => {
    const currentAchieved = new Set(filtered.filter((g) => g.status === 'Achieved').map((g) => g.goalId))
    const prev = prevAchievedRef.current
    for (const id of currentAchieved) {
      if (!prev.has(id)) {
        const goal = filtered.find((g) => g.goalId === id)
        if (goal) {
          setShowCelebration(goal)
          setTimeout(() => setShowCelebration(null), 5000)
        }
      }
    }
    prevAchievedRef.current = currentAchieved
  }, [filtered])

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
    if (modal?.edit && confirm('Delete this goal?')) {
      showBlockUI('Deleting...')
      try {
        await deleteGoal(modal.edit.goalId)
        showToast('Goal deleted')
        setModal(null)
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
          {/* Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard label="Goals" value={filtered.length} sub={achieved > 0 ? `${achieved} achieved` : undefined} />
            <StatCard label="Target" value={formatINR(totalTarget)} bold />
            <StatCard label="Current Value" value={formatINR(totalCurrent)} bold />
            <StatCard
              label="Total Gap"
              value={formatINR(Math.max(totalTarget - totalCurrent, 0))}
              sub={totalTarget > totalCurrent ? 'remaining to target' : 'all targets met'}
              positive={totalTarget <= totalCurrent}
              bold
            />
            <StatCard
              label="Overall Progress"
              value={`${overallProgress.toFixed(1)}%`}
              positive={overallProgress >= 50}
              bold
            />
            <StatCard label="Monthly SIP" value={formatINR(totalSIP)} sub={needsAttention > 0 ? `${needsAttention} need attention` : undefined} />
          </div>

          {/* Celebration banner */}
          {showCelebration && (
            <div className="relative bg-gradient-to-r from-emerald-500/10 via-yellow-500/10 to-emerald-500/10 rounded-xl border border-emerald-500/30 px-4 py-3 flex items-center gap-3 animate-fade-in overflow-hidden">
              <div className="absolute inset-0 pointer-events-none">
                {Array.from({ length: 20 }).map((_, i) => (
                  <span
                    key={i}
                    className="absolute text-sm animate-confetti"
                    style={{
                      left: `${Math.random() * 100}%`,
                      animationDelay: `${Math.random() * 2}s`,
                      animationDuration: `${2 + Math.random() * 2}s`,
                    }}
                  >
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
                    <p className="text-[10px] text-[var(--text-dim)] mt-0.5">{g.familyMemberName}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Header with Add */}
          <div className="flex items-center justify-end gap-2 px-1">
            <button onClick={() => setModal('add')} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-violet-400 hover:text-violet-300 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg transition-colors">
              <Plus size={14} /> Add Goal
            </button>
          </div>

          {/* Goals Table */}
          <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] overflow-hidden">
            {/* Desktop table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-light)] bg-[var(--bg-inset)]">
                    <th className="text-left py-2.5 px-4 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Goal</th>
                    {!member && <th className="text-left py-2.5 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Member</th>}
                    <th className="text-right py-2.5 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">
                      <div>Amount</div>
                      <div className="text-[10px] font-medium text-[var(--text-dim)]">Current / Target</div>
                    </th>
                    <th className="text-center py-2.5 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider min-w-[120px]">Progress</th>
                    <th className="text-right py-2.5 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Monthly SIP</th>
                    <th className="text-center py-2.5 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">
                      <div>Timeline</div>
                      <div className="text-[10px] font-medium text-[var(--text-dim)]">Years Left</div>
                    </th>
                    <th className="text-center py-2.5 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Status</th>
                    <th className="w-8 py-2.5 px-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((g) => {
                    const progress = getProgress(g)
                    const yearsLeft = getYearsLeft(g)
                    return (
                      <tr key={g.goalId} className="border-b border-[var(--border-light)] last:border-0 hover:bg-[var(--bg-hover)] transition-colors group">
                        <td className="py-2.5 px-4">
                          <p className="text-sm font-medium text-[var(--text-primary)]">{g.goalName}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${priorityBadge[g.priority] || ''}`}>{g.priority}</span>
                            {g.notes && <span className="text-xs text-[var(--text-dim)]">{g.notes}</span>}
                          </div>
                        </td>
                        {!member && <td className="py-2.5 px-3 text-xs text-[var(--text-secondary)]">{g.familyMemberName}</td>}
                        <td className="py-2.5 px-3 text-right">
                          <p className="text-xs font-semibold text-[var(--text-primary)] tabular-nums">{formatINR(g.currentValue)}</p>
                          <p className="text-xs text-[var(--text-dim)] tabular-nums">{formatINR(g.targetAmount)}</p>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-[var(--bg-inset)] rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${barColor[g.status] || 'bg-blue-500'}`} style={{ width: `${progress}%` }} />
                            </div>
                            <span className="text-xs font-bold text-[var(--text-primary)] tabular-nums w-10 text-right">{progress.toFixed(0)}%</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right text-xs font-semibold text-[var(--text-primary)] tabular-nums">{formatINR(g.monthlyInvestment)}</td>
                        <td className="py-2.5 px-3 text-center text-xs text-[var(--text-muted)] tabular-nums">
                          {g.status === 'Achieved' ? 'Done' : yearsLeft ? `${yearsLeft} yrs` : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusBadge[g.status] || 'bg-slate-500/15 text-[var(--text-muted)]'}`}>
                            {g.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-2">
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
                            <button onClick={() => setWithdrawalGoal(g)} className="p-1 rounded text-[var(--text-dim)] hover:text-emerald-400 transition-colors" title="Withdrawal plan">
                              <ArrowDownCircle size={12} />
                            </button>
                            <button onClick={() => setMappingGoal(g)} className="p-1 rounded text-[var(--text-dim)] hover:text-violet-400 transition-colors" title="Link portfolios">
                              <Link2 size={12} />
                            </button>
                            <button onClick={() => setModal({ edit: g })} className="p-1 rounded text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors">
                              <Pencil size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile card list */}
            <div className="lg:hidden divide-y divide-[var(--border-light)]">
              {filtered.map((g) => {
                const progress = getProgress(g)
                const yearsLeft = getYearsLeft(g)
                return (
                  <div key={g.goalId} onClick={() => setModal({ edit: g })} className="px-4 py-4 hover:bg-[var(--bg-hover)] transition-colors cursor-pointer">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-sm font-medium text-[var(--text-primary)]">{g.goalName}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-[var(--text-muted)]">{g.familyMemberName} · SIP {formatINR(g.monthlyInvestment)}/mo</span>
                          {goalPortfolioMappings.filter((m) => m.goalId === g.goalId).length > 0 && (
                            <span className="text-[10px] font-semibold text-violet-400 flex items-center gap-0.5"><Link2 size={9} />{goalPortfolioMappings.filter((m) => m.goalId === g.goalId).length}</span>
                          )}
                        </div>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${statusBadge[g.status] || 'bg-slate-500/15 text-[var(--text-muted)]'}`}>
                        {g.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex-1 h-2 bg-[var(--bg-inset)] rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${barColor[g.status] || 'bg-blue-500'}`} style={{ width: `${progress}%` }} />
                      </div>
                      <span className="text-xs font-bold text-[var(--text-primary)] tabular-nums">{progress.toFixed(0)}%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[var(--text-muted)]">{formatINR(g.currentValue)} <span className="text-[var(--text-dim)]">of</span> {formatINR(g.targetAmount)}</span>
                      <span className="text-xs text-[var(--text-dim)]">{g.status === 'Achieved' ? 'Done' : yearsLeft ? `${yearsLeft} yrs left` : ''}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
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

      <Modal open={!!mappingGoal} onClose={() => setMappingGoal(null)} title={`Link Portfolios — ${mappingGoal?.goalName || ''}`} wide>
        {mappingGoal && (
          <GoalPortfolioMapping goal={mappingGoal} onClose={() => setMappingGoal(null)} />
        )}
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
