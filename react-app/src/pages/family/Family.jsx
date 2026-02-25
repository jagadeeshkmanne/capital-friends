import { useState, useMemo } from 'react'
import { Plus, Pencil, Users, Mail, Landmark, Briefcase, Shield } from 'lucide-react'
import { useData } from '../../context/DataContext'
import Modal from '../../components/Modal'
import MemberForm from '../../components/forms/MemberForm'

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
  const { members, banks, investments, insurancePolicies, addMember, updateMember, deleteMember } = useData()
  const [modal, setModal] = useState(null)

  const activeMembers = members.filter((m) => m.status !== 'Inactive')
  const emailCount = activeMembers.filter((m) => m.includeInEmailReports).length

  // Per-member stats
  const memberStats = useMemo(() => {
    const stats = {}
    activeMembers.forEach((m) => {
      stats[m.memberId] = {
        bankCount: banks.filter((b) => b.memberId === m.memberId && b.status !== 'Inactive').length,
        invCount: investments.filter((a) => a.memberId === m.memberId && a.status !== 'Inactive').length,
        insCount: insurancePolicies.filter((p) => p.memberId === m.memberId && p.status !== 'Inactive').length,
      }
    })
    return stats
  }, [activeMembers, banks, investments, insurancePolicies])

  function handleSave(data) {
    if (modal?.edit) updateMember(modal.edit.memberId, data)
    else addMember(data)
    setModal(null)
  }

  function handleDelete() {
    if (modal?.edit && confirm('Deactivate this family member?')) {
      deleteMember(modal.edit.memberId)
      setModal(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* Stat Cards */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Members" value={activeMembers.length} />
        <StatCard label="Email Reports" value={`${emailCount} / ${activeMembers.length}`} />
        <StatCard label="Bank Accounts" value={banks.filter((b) => b.status !== 'Inactive').length} />
      </div>

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
            <table className="w-full text-sm min-w-[680px]">
              <thead>
                <tr className="border-b border-[var(--border-light)] bg-[var(--bg-inset)]">
                  <th className="text-left py-2.5 px-4 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Member</th>
                  <th className="text-left py-2.5 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Relationship</th>
                  <th className="text-left py-2.5 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Email</th>
                  <th className="text-left py-2.5 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Mobile</th>
                  <th className="text-center py-2.5 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">
                    <div>Accounts</div>
                    <div className="text-[10px] font-medium text-[var(--text-dim)]">Bank / Inv / Ins</div>
                  </th>
                  <th className="text-center py-2.5 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Email Rpt</th>
                  <th className="w-8 py-2.5 px-2"></th>
                </tr>
              </thead>
              <tbody>
                {activeMembers.map((m, idx) => {
                  const s = memberStats[m.memberId] || {}
                  return (
                    <tr key={m.memberId} className="border-b border-[var(--border-light)] last:border-0 hover:bg-[var(--bg-hover)] transition-colors group">
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white bg-gradient-to-br ${avatarColors[idx % avatarColors.length]}`}>
                            {m.memberName.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-[var(--text-primary)]">{m.memberName}</p>
                            <p className="text-xs text-[var(--text-dim)]">{m.memberId}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${relationBadge[m.relationship] || 'bg-slate-500/15 text-[var(--text-muted)]'}`}>
                          {m.relationship}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-xs text-[var(--text-muted)] truncate max-w-[180px]">{m.email}</td>
                      <td className="py-2.5 px-3 text-xs text-[var(--text-muted)] tabular-nums">{m.mobile}</td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-2 text-xs text-[var(--text-dim)]">
                          <span className="flex items-center gap-0.5" title="Bank accounts"><Landmark size={10} /> {s.bankCount || 0}</span>
                          <span className="flex items-center gap-0.5" title="Investment accounts"><Briefcase size={10} /> {s.invCount || 0}</span>
                          <span className="flex items-center gap-0.5" title="Insurance policies"><Shield size={10} /> {s.insCount || 0}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {m.includeInEmailReports ? (
                          <Mail size={13} className="inline text-emerald-400" />
                        ) : (
                          <span className="text-xs text-[var(--text-dim)]">—</span>
                        )}
                      </td>
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
              const s = memberStats[m.memberId] || {}
              return (
                <div key={m.memberId} onClick={() => setModal({ edit: m })} className="px-4 py-3.5 hover:bg-[var(--bg-hover)] transition-colors cursor-pointer">
                  <div className="flex items-center gap-2.5 mb-1.5">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white bg-gradient-to-br ${avatarColors[idx % avatarColors.length]}`}>
                      {m.memberName.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-[var(--text-primary)]">{m.memberName}</p>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${relationBadge[m.relationship] || 'bg-slate-500/15 text-[var(--text-muted)]'}`}>
                          {m.relationship}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--text-muted)] truncate">{m.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-[var(--text-dim)] tabular-nums">{m.mobile}</p>
                    <div className="flex items-center gap-2 text-xs text-[var(--text-dim)]">
                      <span className="flex items-center gap-0.5"><Landmark size={10} /> {s.bankCount || 0}</span>
                      <span className="flex items-center gap-0.5"><Briefcase size={10} /> {s.invCount || 0}</span>
                      <span className="flex items-center gap-0.5"><Shield size={10} /> {s.insCount || 0}</span>
                    </div>
                  </div>
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

function StatCard({ label, value }) {
  return (
    <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] px-4 py-3">
      <p className="text-xs text-[var(--text-dim)] uppercase tracking-wider mb-1">{label}</p>
      <p className="text-sm font-bold text-[var(--text-primary)] tabular-nums">{value}</p>
    </div>
  )
}
