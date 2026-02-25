import { useState, useMemo } from 'react'
import { Plus, Pencil, Landmark } from 'lucide-react'
import { useFamily } from '../../context/FamilyContext'
import { useData } from '../../context/DataContext'
import Modal from '../../components/Modal'
import BankAccountForm from '../../components/forms/BankAccountForm'

const typeBadge = {
  'Savings Account': 'bg-blue-500/15 text-[var(--accent-blue)]',
  Savings: 'bg-blue-500/15 text-[var(--accent-blue)]',
  Salary: 'bg-emerald-500/15 text-emerald-400',
  'Current Account': 'bg-violet-500/15 text-[var(--accent-violet)]',
  'Fixed Deposit': 'bg-amber-500/15 text-[var(--accent-amber)]',
  'Fixed Deposit (FD)': 'bg-amber-500/15 text-[var(--accent-amber)]',
}

export default function BankAccountsPage() {
  const { selectedMember, member } = useFamily()
  const { banks, addBankAccount, updateBankAccount, deleteBankAccount } = useData()
  const [modal, setModal] = useState(null)

  const filtered = useMemo(() => {
    const active = banks.filter((a) => a.status !== 'Inactive')
    return selectedMember === 'all' ? active : active.filter((a) => a.memberId === selectedMember)
  }, [banks, selectedMember])

  const uniqueBanks = useMemo(() => new Set(filtered.map((a) => a.bankName)).size, [filtered])
  const savingsCount = useMemo(() => filtered.filter((a) => a.accountType === 'Savings' || a.accountType === 'Savings Account' || a.accountType === 'Salary').length, [filtered])

  function handleSave(data) {
    if (modal?.edit) updateBankAccount(modal.edit.accountId, data)
    else addBankAccount(data)
    setModal(null)
  }

  function handleDelete() {
    if (modal?.edit && confirm('Deactivate this bank account?')) {
      deleteBankAccount(modal.edit.accountId)
      setModal(null)
    }
  }

  return (
    <div className="space-y-4">
      {filtered.length === 0 ? (
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] py-12 flex flex-col items-center gap-3">
          <Landmark size={32} className="text-[var(--text-dim)]" />
          <p className="text-sm text-[var(--text-muted)]">No bank accounts{member ? ` for ${member.memberName}` : ''}</p>
          <button onClick={() => setModal('add')} className="text-xs font-semibold text-violet-400 hover:text-violet-300">
            Add your first bank account
          </button>
        </div>
      ) : (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Total Accounts" value={filtered.length} />
            <StatCard label="Banks" value={uniqueBanks} />
            <StatCard label="Savings / Salary" value={savingsCount} />
          </div>

          {/* Header with Add */}
          <div className="flex items-center justify-end px-1">
            <button onClick={() => setModal('add')} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-violet-400 hover:text-violet-300 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg transition-colors">
              <Plus size={14} /> Add Account
            </button>
          </div>

          {/* Data Table */}
          <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] overflow-hidden">
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm min-w-[580px]">
                <thead>
                  <tr className="border-b border-[var(--border-light)] bg-[var(--bg-inset)]">
                    <th className="text-left py-2.5 px-4 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Account</th>
                    <th className="text-left py-2.5 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Bank</th>
                    {!member && <th className="text-left py-2.5 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Member</th>}
                    <th className="text-left py-2.5 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Type</th>
                    <th className="text-left py-2.5 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Account No.</th>
                    <th className="text-left py-2.5 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Branch</th>
                    <th className="w-8 py-2.5 px-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((a) => (
                    <tr key={a.accountId} className="border-b border-[var(--border-light)] last:border-0 hover:bg-[var(--bg-hover)] transition-colors group">
                      <td className="py-2.5 px-4">
                        <p className="text-sm font-medium text-[var(--text-primary)]">{a.accountName}</p>
                      </td>
                      <td className="py-2.5 px-3 text-xs text-[var(--text-secondary)]">{a.bankName}</td>
                      {!member && <td className="py-2.5 px-3 text-xs text-[var(--text-secondary)]">{a.memberName}</td>}
                      <td className="py-2.5 px-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${typeBadge[a.accountType] || 'bg-slate-500/15 text-[var(--text-muted)]'}`}>
                          {a.accountType}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-xs text-[var(--text-muted)] tabular-nums">{a.accountNumber}</td>
                      <td className="py-2.5 px-3 text-xs text-[var(--text-dim)]">{a.branchName}</td>
                      <td className="py-2.5 px-2">
                        <button onClick={() => setModal({ edit: a })} className="opacity-0 group-hover:opacity-100 p-1 rounded text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-all">
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
              {filtered.map((a) => (
                <div key={a.accountId} onClick={() => setModal({ edit: a })} className="px-4 py-3.5 hover:bg-[var(--bg-hover)] transition-colors cursor-pointer">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium text-[var(--text-primary)]">{a.accountName}</p>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${typeBadge[a.accountType] || 'bg-slate-500/15 text-[var(--text-muted)]'}`}>
                      {a.accountType}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-muted)]">{a.bankName}{!member ? ` · ${a.memberName}` : ''}</p>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-xs text-[var(--text-dim)] tabular-nums">{a.accountNumber}</p>
                    <p className="text-xs text-[var(--text-dim)]">{a.branchName}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.edit ? 'Edit Bank Account' : 'Add Bank Account'}>
        <BankAccountForm
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
