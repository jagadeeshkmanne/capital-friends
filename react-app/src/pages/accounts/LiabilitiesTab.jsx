import { useState, useMemo } from 'react'
import { Plus, Pencil, CreditCard } from 'lucide-react'
import { formatINR } from '../../data/familyData'
import { useFamily } from '../../context/FamilyContext'
import { useData } from '../../context/DataContext'
import Modal from '../../components/Modal'
import LiabilityForm from '../../components/forms/LiabilityForm'

const typeBadge = {
  'Home Loan': 'bg-blue-500/15 text-[var(--accent-blue)]',
  'Car Loan': 'bg-amber-500/15 text-[var(--accent-amber)]',
  'Gold Loan': 'bg-orange-500/15 text-[var(--accent-orange)]',
  'Personal Loan': 'bg-violet-500/15 text-[var(--accent-violet)]',
  'Education Loan': 'bg-emerald-500/15 text-emerald-400',
  'Credit Card': 'bg-rose-500/15 text-[var(--accent-rose)]',
}

export default function LiabilitiesTab() {
  const { selectedMember, member } = useFamily()
  const { liabilityList, addLiability, updateLiability, deleteLiability } = useData()
  const [modal, setModal] = useState(null)

  const filtered = useMemo(() => {
    const active = liabilityList.filter((l) => l.status !== 'Inactive')
    return selectedMember === 'all' ? active : active.filter((l) => l.familyMemberId === selectedMember)
  }, [liabilityList, selectedMember])

  const totalOutstanding = filtered.reduce((s, l) => s + (l.outstandingBalance || 0), 0)
  const totalEMI = filtered.reduce((s, l) => s + (l.emiAmount || 0), 0)
  const activeCount = filtered.filter((l) => l.status === 'Active').length

  function handleSave(data) {
    if (modal?.edit) updateLiability(modal.edit.liabilityId, data)
    else addLiability(data)
    setModal(null)
  }

  function handleDelete() {
    if (modal?.edit && confirm('Deactivate this liability?')) {
      deleteLiability(modal.edit.liabilityId)
      setModal(null)
    }
  }

  return (
    <div className="space-y-4">
      {filtered.length === 0 ? (
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] py-12 flex flex-col items-center gap-3">
          <CreditCard size={32} className="text-[var(--text-dim)]" />
          <p className="text-sm text-[var(--text-muted)]">No liabilities{member ? ` for ${member.memberName}` : ''}</p>
          <button onClick={() => setModal('add')} className="text-xs font-semibold text-violet-400 hover:text-violet-300">
            Add a liability
          </button>
        </div>
      ) : (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Liabilities" value={`${activeCount} active`} />
            <StatCard label="Outstanding" value={formatINR(totalOutstanding)} color="rose" bold />
            <StatCard label="Monthly EMI" value={formatINR(totalEMI)} color="rose" />
            <StatCard label="Avg. Interest" value={filtered.length > 0 ? `${(filtered.reduce((s, l) => s + (l.interestRate || 0), 0) / filtered.length).toFixed(1)}%` : '—'} />
          </div>

          {/* Header with Add */}
          <div className="flex items-center justify-end px-1">
            <button onClick={() => setModal('add')} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-violet-400 hover:text-violet-300 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg transition-colors">
              <Plus size={14} /> Add Liability
            </button>
          </div>

          {/* Data Table */}
          <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] overflow-hidden">
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="border-b border-[var(--border-light)] bg-[var(--bg-inset)]">
                    <th className="text-left py-2.5 px-4 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Type</th>
                    <th className="text-left py-2.5 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Lender</th>
                    {!member && <th className="text-left py-2.5 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Member</th>}
                    <th className="text-right py-2.5 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Outstanding</th>
                    <th className="text-right py-2.5 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">EMI</th>
                    <th className="text-right py-2.5 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Interest</th>
                    <th className="w-8 py-2.5 px-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((l) => (
                    <tr key={l.liabilityId} className="border-b border-[var(--border-light)] last:border-0 hover:bg-[var(--bg-hover)] transition-colors group">
                      <td className="py-2.5 px-4">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${typeBadge[l.liabilityType] || 'bg-slate-500/15 text-[var(--text-muted)]'}`}>
                          {l.liabilityType}
                        </span>
                        {l.notes && <p className="text-xs text-[var(--text-dim)] mt-1">{l.notes}</p>}
                      </td>
                      <td className="py-2.5 px-3 text-sm font-medium text-[var(--text-primary)]">{l.lenderName}</td>
                      {!member && <td className="py-2.5 px-3 text-xs text-[var(--text-secondary)]">{l.familyMemberName}</td>}
                      <td className="py-2.5 px-3 text-right text-xs font-semibold text-[var(--accent-rose)] tabular-nums">{formatINR(l.outstandingBalance)}</td>
                      <td className="py-2.5 px-3 text-right text-xs text-[var(--text-muted)] tabular-nums">{l.emiAmount ? `${formatINR(l.emiAmount)}/mo` : '—'}</td>
                      <td className="py-2.5 px-3 text-right text-xs text-[var(--text-muted)] tabular-nums">{l.interestRate ? `${l.interestRate}%` : '—'}</td>
                      <td className="py-2.5 px-2">
                        <button onClick={() => setModal({ edit: l })} className="opacity-0 group-hover:opacity-100 p-1 rounded text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-all">
                          <Pencil size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile card list */}
            <div className="sm:hidden divide-y divide-[var(--border-light)]">
              {filtered.map((l) => (
                <div key={l.liabilityId} onClick={() => setModal({ edit: l })} className="px-4 py-3.5 hover:bg-[var(--bg-hover)] transition-colors cursor-pointer">
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${typeBadge[l.liabilityType] || 'bg-slate-500/15 text-[var(--text-muted)]'}`}>
                      {l.liabilityType}
                    </span>
                    <p className="text-xs font-semibold text-[var(--accent-rose)] tabular-nums">{formatINR(l.outstandingBalance)}</p>
                  </div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">{l.lenderName}</p>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-xs text-[var(--text-muted)]">{l.familyMemberName}{l.notes ? ` · ${l.notes}` : ''}</p>
                    {l.emiAmount > 0 && <p className="text-xs text-[var(--text-dim)] tabular-nums">EMI: {formatINR(l.emiAmount)}/mo</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.edit ? 'Edit Liability' : 'Add Liability'}>
        <LiabilityForm
          initial={modal?.edit || undefined}
          onSave={handleSave}
          onDelete={modal?.edit ? handleDelete : undefined}
          onCancel={() => setModal(null)}
        />
      </Modal>
    </div>
  )
}

function StatCard({ label, value, color, bold }) {
  const colorClass = color === 'rose' ? 'text-[var(--accent-rose)]' : 'text-[var(--text-primary)]'
  return (
    <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] px-4 py-3">
      <p className="text-xs text-[var(--text-dim)] uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-sm tabular-nums ${bold ? 'font-bold' : 'font-semibold'} ${colorClass}`}>{value}</p>
    </div>
  )
}
