import { useState, useMemo } from 'react'
import { Plus, Pencil, Briefcase } from 'lucide-react'
import { useFamily } from '../../context/FamilyContext'
import { useData } from '../../context/DataContext'
import { useToast } from '../../context/ToastContext'
import { useMask } from '../../context/MaskContext'
import Modal from '../../components/Modal'
import InvestmentAccountForm from '../../components/forms/InvestmentAccountForm'
import PageLoading from '../../components/PageLoading'

const typeBadge = {
  'Demat + Trading': 'bg-violet-500/15 text-[var(--accent-violet)]',
  'Mutual Fund': 'bg-blue-500/15 text-[var(--accent-blue)]',
  Trading: 'bg-orange-500/15 text-[var(--accent-orange)]',
  Demat: 'bg-amber-500/15 text-[var(--accent-amber)]',
  'Direct AMC': 'bg-emerald-500/15 text-emerald-400',
  Broker: 'bg-rose-500/15 text-[var(--accent-rose)]',
}

export default function InvestmentAccountsPage() {
  const { selectedMember, member } = useFamily()
  const { investmentAccounts, addInvestmentAccount, updateInvestmentAccount, deleteInvestmentAccount } = useData()
  const { showToast, showBlockUI, hideBlockUI } = useToast()
  const { mv } = useMask()

  const [modal, setModal] = useState(null)

  if (investmentAccounts === null) return <PageLoading title="Loading investment accounts" cards={4} />

  const filtered = useMemo(() => {
    const active = investmentAccounts.filter((a) => a.status !== 'Inactive')
    return selectedMember === 'all' ? active : active.filter((a) => a.memberId === selectedMember)
  }, [investmentAccounts, selectedMember])

  const uniquePlatforms = useMemo(() => new Set(filtered.map((a) => a.platformBroker)).size, [filtered])
  const dematCount = filtered.filter((a) => a.accountType === 'Demat + Trading' || a.accountType === 'Demat' || a.accountType === 'Trading').length
  const mfCount = filtered.filter((a) => a.accountType === 'Mutual Fund' || a.accountType === 'Direct AMC').length

  async function handleSave(data) {
    showBlockUI('Saving...')
    try {
      if (modal?.edit) await updateInvestmentAccount(modal.edit.accountId, data)
      else await addInvestmentAccount(data)
      showToast(modal?.edit ? 'Investment account updated' : 'Investment account added')
      setModal(null)
    } catch (err) {
      showToast(err.message || 'Failed to save investment account', 'error')
    } finally {
      hideBlockUI()
    }
  }

  async function handleDelete() {
    if (modal?.edit && confirm('Deactivate this investment account?')) {
      showBlockUI('Deactivating...')
      try {
        await deleteInvestmentAccount(modal.edit.accountId)
        showToast('Investment account deactivated')
        setModal(null)
      } catch (err) {
        showToast(err.message || 'Failed to deactivate investment account', 'error')
      } finally {
        hideBlockUI()
      }
    }
  }

  return (
    <div className="space-y-4">
      {filtered.length === 0 ? (
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] py-12 flex flex-col items-center gap-3">
          <Briefcase size={32} className="text-[var(--text-dim)]" />
          <p className="text-sm text-[var(--text-muted)]">No investment accounts{member ? ` for ${member.memberName}` : ''}</p>
          <button onClick={() => setModal('add')} className="text-xs font-semibold text-violet-400 hover:text-violet-300">
            Add your first investment account
          </button>
        </div>
      ) : (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Total Accounts" value={filtered.length} />
            <StatCard label="Platforms" value={uniquePlatforms} />
            <StatCard label="Demat / Trading" value={dematCount} />
            <StatCard label="Mutual Fund" value={mfCount} />
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
              <table className="w-full text-sm min-w-[620px]">
                <thead>
                  <tr className="border-b border-[var(--border-light)] bg-[var(--bg-inset)]">
                    <th className="text-left py-2.5 px-4 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Account</th>
                    <th className="text-left py-2.5 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Platform</th>
                    {!member && <th className="text-left py-2.5 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Member</th>}
                    <th className="text-left py-2.5 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Type</th>
                    <th className="text-left py-2.5 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Client ID</th>
                    <th className="text-left py-2.5 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Linked Bank</th>
                    <th className="w-8 py-2.5 px-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((a) => (
                    <tr key={a.accountId} className="border-b border-[var(--border-light)] last:border-0 hover:bg-[var(--bg-hover)] transition-colors group">
                      <td className="py-2.5 px-4">
                        <p className="text-sm font-medium text-[var(--text-primary)]">{a.accountName}</p>
                      </td>
                      <td className="py-2.5 px-3 text-xs text-[var(--text-secondary)]">{a.platformBroker}</td>
                      {!member && <td className="py-2.5 px-3 text-xs text-[var(--text-secondary)]">{a.memberName}</td>}
                      <td className="py-2.5 px-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${typeBadge[a.accountType] || 'bg-slate-500/15 text-[var(--text-muted)]'}`}>
                          {a.accountType}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-xs text-[var(--text-muted)] tabular-nums">{mv(a.accountClientId, 'clientId')}</td>
                      <td className="py-2.5 px-3 text-xs text-[var(--text-dim)]">{a.bankAccountName}</td>
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
                  <p className="text-xs text-[var(--text-muted)]">{a.platformBroker}{!member ? ` · ${a.memberName}` : ''}</p>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-xs text-[var(--text-dim)]">Client: {mv(a.accountClientId, 'clientId')}</p>
                    <p className="text-xs text-[var(--text-dim)]">{a.bankAccountName}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.edit ? 'Edit Investment Account' : 'Add Investment Account'} wide>
        <InvestmentAccountForm
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
