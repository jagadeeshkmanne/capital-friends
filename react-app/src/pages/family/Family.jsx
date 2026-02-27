import { useState } from 'react'
import { Plus, Pencil, Users } from 'lucide-react'
import { useData } from '../../context/DataContext'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'
import { useMask } from '../../context/MaskContext'
import Modal from '../../components/Modal'
import MemberForm from '../../components/forms/MemberForm'
import PageLoading from '../../components/PageLoading'

const avatarColors = [
  'from-violet-500 to-indigo-500',
  'from-rose-500 to-pink-500',
  'from-blue-500 to-cyan-500',
  'from-amber-500 to-orange-500',
  'from-emerald-500 to-teal-500',
]

const relationBadge = {
  Self: 'bg-violet-500/15 text-[var(--accent-violet)]',
  Spouse: 'bg-rose-500/15 text-[var(--accent-rose)]',
  Father: 'bg-blue-500/15 text-[var(--accent-blue)]',
  Mother: 'bg-amber-500/15 text-[var(--accent-amber)]',
  Son: 'bg-emerald-500/15 text-emerald-400',
  Daughter: 'bg-emerald-500/15 text-emerald-400',
}

export default function Family() {
  const { members, addMember, updateMember, deleteMember } = useData()
  const { showToast, showBlockUI, hideBlockUI } = useToast()
  const confirm = useConfirm()
  const { mv } = useMask()
  const [modal, setModal] = useState(null)

  if (members === null) return <PageLoading title="Loading family" cards={3} />

  const activeMembers = members.filter((m) => m.status !== 'Inactive')

  async function handleSave(data) {
    showBlockUI('Saving member...')
    try {
      if (modal?.edit) await updateMember(modal.edit.memberId, data)
      else await addMember(data)
      showToast(modal?.edit ? 'Member updated' : 'Member added')
      setModal(null)
    } catch (err) {
      showToast(err.message || 'Failed to save member', 'error')
    } finally {
      hideBlockUI()
    }
  }

  async function handleDelete() {
    if (modal?.edit && await confirm('Deactivate this family member?', { title: 'Deactivate Member', confirmLabel: 'Deactivate' })) {
      showBlockUI('Deactivating...')
      try {
        await deleteMember(modal.edit.memberId)
        showToast('Member deactivated')
        setModal(null)
      } catch (err) {
        showToast(err.message || 'Failed to deactivate member', 'error')
      } finally {
        hideBlockUI()
      }
    }
  }

  // Collect dynamic field keys across all members for display
  const dynamicFieldKeys = [...new Set(activeMembers.flatMap((m) => Object.keys(m.dynamicFields || {})))]

  return (
    <div className="space-y-4">
      {/* Header with Add */}
      <div className="flex items-center justify-end px-1">
        <button onClick={() => setModal('add')} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-violet-400 hover:text-violet-300 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg transition-colors">
          <Plus size={14} /> Add Member
        </button>
      </div>

      {activeMembers.length === 0 ? (
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] py-12 flex flex-col items-center gap-3">
          <Users size={32} className="text-[var(--text-dim)]" />
          <p className="text-sm text-[var(--text-muted)]">No family members yet</p>
          <button onClick={() => setModal('add')} className="text-xs font-semibold text-violet-400 hover:text-violet-300">
            Add your first member
          </button>
        </div>
      ) : (
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] overflow-hidden">
          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="border-b border-[var(--border-light)] bg-[var(--bg-inset)]">
                  <th className="text-left py-2.5 px-4 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Member</th>
                  <th className="text-left py-2.5 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Relationship</th>
                  <th className="text-left py-2.5 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">PAN</th>
                  <th className="text-left py-2.5 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Aadhaar</th>
                  <th className="text-left py-2.5 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Email</th>
                  <th className="text-left py-2.5 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Mobile</th>
                  <th className="w-8 py-2.5 px-2"></th>
                </tr>
              </thead>
              <tbody>
                {activeMembers.map((m, idx) => {
                  const df = m.dynamicFields || {}
                  const dfEntries = Object.entries(df)
                  return (
                    <tr key={m.memberId} className="border-b border-[var(--border-light)] last:border-0 hover:bg-[var(--bg-hover)] transition-colors group">
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white bg-gradient-to-br ${avatarColors[idx % avatarColors.length]}`}>
                            {m.memberName.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-[var(--text-primary)]">{mv(m.memberName, 'name')}</p>
                            {dfEntries.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-0.5">
                                {dfEntries.slice(0, 3).map(([k, v]) => (
                                  <span key={k} className="text-[10px] text-[var(--text-dim)] bg-[var(--bg-inset)] px-1.5 py-0.5 rounded">
                                    {k}: {v}
                                  </span>
                                ))}
                                {dfEntries.length > 3 && <span className="text-[10px] text-[var(--text-dim)]">+{dfEntries.length - 3} more</span>}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${relationBadge[m.relationship] || 'bg-slate-500/15 text-[var(--text-muted)]'}`}>
                          {m.relationship}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-xs text-[var(--text-muted)] font-mono tabular-nums">{mv(m.pan, 'pan') || '—'}</td>
                      <td className="py-2.5 px-3 text-xs text-[var(--text-muted)] font-mono tabular-nums">{mv(m.aadhar, 'aadhaar') || '—'}</td>
                      <td className="py-2.5 px-3 text-xs text-[var(--text-muted)] truncate max-w-[180px]">{mv(m.email, 'email')}</td>
                      <td className="py-2.5 px-3 text-xs text-[var(--text-muted)] tabular-nums">{mv(m.mobile, 'mobile')}</td>
                      <td className="py-2.5 px-2">
                        <button onClick={() => setModal({ edit: m })} className="opacity-0 group-hover:opacity-100 p-1 rounded text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-all">
                          <Pencil size={12} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <div className="sm:hidden divide-y divide-[var(--border-light)]">
            {activeMembers.map((m, idx) => {
              const df = m.dynamicFields || {}
              const dfEntries = Object.entries(df)
              return (
                <div key={m.memberId} onClick={() => setModal({ edit: m })} className="px-4 py-3.5 hover:bg-[var(--bg-hover)] transition-colors cursor-pointer">
                  <div className="flex items-center gap-2.5 mb-1.5">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white bg-gradient-to-br ${avatarColors[idx % avatarColors.length]}`}>
                      {m.memberName.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-[var(--text-primary)]">{mv(m.memberName, 'name')}</p>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${relationBadge[m.relationship] || 'bg-slate-500/15 text-[var(--text-muted)]'}`}>
                          {m.relationship}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--text-muted)] truncate">{mv(m.email, 'email')}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-[var(--text-dim)] tabular-nums">{mv(m.mobile, 'mobile')}</p>
                    <div className="flex items-center gap-3">
                      <p className="text-xs text-[var(--text-dim)] font-mono">PAN: {mv(m.pan, 'pan') || '—'}</p>
                      {m.aadhar && <p className="text-xs text-[var(--text-dim)] font-mono">Aadhaar: {mv(m.aadhar, 'aadhaar')}</p>}
                    </div>
                  </div>
                  {dfEntries.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {dfEntries.slice(0, 3).map(([k, v]) => (
                        <span key={k} className="text-[10px] text-[var(--text-dim)] bg-[var(--bg-inset)] px-1.5 py-0.5 rounded">
                          {k}: {v}
                        </span>
                      ))}
                      {dfEntries.length > 3 && <span className="text-[10px] text-[var(--text-dim)]">+{dfEntries.length - 3} more</span>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.edit ? 'Edit Member' : 'Add Family Member'} wide>
        <MemberForm
          initial={modal?.edit || undefined}
          onSave={handleSave}
          onDelete={modal?.edit ? handleDelete : undefined}
          onCancel={() => setModal(null)}
        />
      </Modal>
    </div>
  )
}
