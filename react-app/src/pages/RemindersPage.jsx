import { useState, useMemo } from 'react'
import { Plus, Pencil, Bell, BellOff } from 'lucide-react'
import { useFamily } from '../context/FamilyContext'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import Modal from '../components/Modal'
import ReminderForm from '../components/forms/ReminderForm'

const typeBadge = {
  'SIP Due Date': 'bg-violet-500/15 text-[var(--accent-violet)]',
  'Insurance Renewal': 'bg-amber-500/15 text-[var(--accent-amber)]',
  'FD Maturity': 'bg-blue-500/15 text-[var(--accent-blue)]',
  'Loan EMI': 'bg-rose-500/15 text-[var(--accent-rose)]',
  'Investment Review': 'bg-emerald-500/15 text-emerald-400',
  Custom: 'bg-slate-500/15 text-[var(--text-muted)]',
}

const priorityDot = {
  High: 'bg-rose-500',
  Medium: 'bg-amber-500',
  Low: 'bg-blue-500',
}

function daysUntil(dateStr) {
  if (!dateStr) return Infinity
  const diff = new Date(dateStr) - new Date()
  return Math.ceil(diff / (24 * 60 * 60 * 1000))
}

export default function RemindersPage() {
  const { selectedMember, member } = useFamily()
  const { reminderList, addReminder, updateReminder, deleteReminder } = useData()
  const { showToast, showBlockUI, hideBlockUI } = useToast()
  const [modal, setModal] = useState(null)

  const filtered = useMemo(() => {
    const active = reminderList.filter((r) => r.isActive !== false)
    return selectedMember === 'all' ? active : active.filter((r) => r.familyMemberId === selectedMember)
  }, [reminderList, selectedMember])

  const overdue = filtered.filter((r) => daysUntil(r.dueDate) < 0).length
  const dueSoon = filtered.filter((r) => { const d = daysUntil(r.dueDate); return d >= 0 && d <= 7 }).length
  const upcoming = filtered.filter((r) => { const d = daysUntil(r.dueDate); return d > 7 && d <= 30 }).length

  // Sort: overdue first, then by due date ascending
  const sorted = [...filtered].sort((a, b) => {
    const da = daysUntil(a.dueDate)
    const db = daysUntil(b.dueDate)
    return da - db
  })

  async function handleSave(data) {
    showBlockUI('Saving...')
    try {
      if (modal?.edit) await updateReminder(modal.edit.reminderId, data)
      else await addReminder(data)
      showToast(modal?.edit ? 'Reminder updated' : 'Reminder added')
      setModal(null)
    } catch (err) {
      showToast(err.message || 'Failed to save reminder', 'error')
    } finally {
      hideBlockUI()
    }
  }

  async function handleDelete() {
    if (modal?.edit && confirm('Delete this reminder?')) {
      showBlockUI('Deleting...')
      try {
        await deleteReminder(modal.edit.reminderId)
        showToast('Reminder deleted')
        setModal(null)
      } catch (err) {
        showToast(err.message || 'Failed to delete reminder', 'error')
      } finally {
        hideBlockUI()
      }
    }
  }

  function getDueBadge(dateStr) {
    const days = daysUntil(dateStr)
    if (days < 0) return { label: `${Math.abs(days)}d overdue`, cls: 'bg-rose-500/20 text-[var(--accent-rose)]' }
    if (days === 0) return { label: 'Today', cls: 'bg-rose-500/20 text-[var(--accent-rose)]' }
    if (days <= 7) return { label: `${days}d`, cls: 'bg-amber-500/20 text-[var(--accent-amber)]' }
    if (days <= 30) return { label: `${days}d`, cls: 'bg-blue-500/20 text-[var(--accent-blue)]' }
    return { label: `${days}d`, cls: 'bg-slate-500/20 text-[var(--text-muted)]' }
  }

  return (
    <div className="space-y-4">
      {filtered.length === 0 ? (
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] py-12 flex flex-col items-center gap-3">
          <BellOff size={32} className="text-[var(--text-dim)]" />
          <p className="text-sm text-[var(--text-muted)]">No reminders{member ? ` for ${member.memberName}` : ''}</p>
          <button onClick={() => setModal('add')} className="text-xs font-semibold text-violet-400 hover:text-violet-300">
            Add a reminder
          </button>
        </div>
      ) : (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Active" value={filtered.length} />
            {overdue > 0 && <StatCard label="Overdue" value={overdue} color="rose" />}
            {dueSoon > 0 && <StatCard label="Due This Week" value={dueSoon} color="amber" />}
            <StatCard label="Next 30 Days" value={upcoming} />
          </div>

          {/* Header with Add */}
          <div className="flex items-center justify-end px-1">
            <button onClick={() => setModal('add')} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-violet-400 hover:text-violet-300 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg transition-colors">
              <Plus size={14} /> Add Reminder
            </button>
          </div>

          {/* Reminders Table */}
          <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] overflow-hidden">
            {/* Desktop */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm min-w-[680px]">
                <thead>
                  <tr className="border-b border-[var(--border-light)] bg-[var(--bg-inset)]">
                    <th className="text-left py-2.5 px-4 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Reminder</th>
                    <th className="text-left py-2.5 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Type</th>
                    {!member && <th className="text-left py-2.5 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Member</th>}
                    <th className="text-center py-2.5 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Due Date</th>
                    <th className="text-center py-2.5 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Frequency</th>
                    <th className="text-center py-2.5 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Status</th>
                    <th className="w-8 py-2.5 px-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((r) => {
                    const due = getDueBadge(r.dueDate)
                    return (
                      <tr key={r.reminderId} className="border-b border-[var(--border-light)] last:border-0 hover:bg-[var(--bg-hover)] transition-colors group">
                        <td className="py-2.5 px-4">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${priorityDot[r.priority] || 'bg-slate-400'}`} />
                            <div>
                              <p className="text-sm font-medium text-[var(--text-primary)]">{r.title}</p>
                              {r.description && <p className="text-xs text-[var(--text-dim)] truncate max-w-[200px]">{r.description}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${typeBadge[r.reminderType] || typeBadge.Custom}`}>
                            {r.reminderType}
                          </span>
                        </td>
                        {!member && <td className="py-2.5 px-3 text-xs text-[var(--text-secondary)]">{r.familyMemberName}</td>}
                        <td className="py-2.5 px-3 text-center">
                          <div>
                            <p className="text-xs text-[var(--text-muted)] tabular-nums">{r.dueDate}</p>
                            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${due.cls}`}>{due.label}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-center text-xs text-[var(--text-muted)]">{r.frequency}</td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${r.status === 'Pending' ? 'bg-amber-500/15 text-[var(--accent-amber)]' : 'bg-emerald-500/15 text-emerald-400'}`}>
                            {r.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-2">
                          <button onClick={() => setModal({ edit: r })} className="opacity-0 group-hover:opacity-100 p-1 rounded text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-all">
                            <Pencil size={12} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile */}
            <div className="sm:hidden divide-y divide-[var(--border-light)]">
              {sorted.map((r) => {
                const due = getDueBadge(r.dueDate)
                return (
                  <div key={r.reminderId} onClick={() => setModal({ edit: r })} className="px-4 py-3.5 hover:bg-[var(--bg-hover)] transition-colors cursor-pointer">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${priorityDot[r.priority] || 'bg-slate-400'}`} />
                        <p className="text-sm font-medium text-[var(--text-primary)] truncate">{r.title}</p>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ml-2 ${typeBadge[r.reminderType] || typeBadge.Custom}`}>
                        {r.reminderType}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-[var(--text-muted)]">{r.familyMemberName} · {r.frequency}</p>
                      <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${due.cls}`}>{due.label}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.edit ? 'Edit Reminder' : 'Add Reminder'} wide>
        <ReminderForm
          initial={modal?.edit || undefined}
          onSave={handleSave}
          onDelete={modal?.edit ? handleDelete : undefined}
          onCancel={() => setModal(null)}
        />
      </Modal>
    </div>
  )
}

function StatCard({ label, value, color }) {
  const textColor = color === 'rose' ? 'text-[var(--accent-rose)]' : color === 'amber' ? 'text-[var(--accent-amber)]' : 'text-[var(--text-primary)]'
  return (
    <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] px-4 py-3">
      <p className="text-xs text-[var(--text-dim)] uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-sm font-bold tabular-nums ${textColor}`}>{value}</p>
    </div>
  )
}
