import { useState, useMemo } from 'react'
import { Plus, Pencil, Shield } from 'lucide-react'
import { formatINR } from '../../data/familyData'
import { useFamily } from '../../context/FamilyContext'
import { useData } from '../../context/DataContext'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'
import { useMask } from '../../context/MaskContext'
import Modal from '../../components/Modal'
import InsuranceForm from '../../components/forms/InsuranceForm'
import PageLoading from '../../components/PageLoading'

const typeBadge = {
  'Term Life': 'bg-rose-500/15 text-[var(--accent-rose)]',
  Health: 'bg-emerald-500/15 text-emerald-400',
  Motor: 'bg-blue-500/15 text-[var(--accent-blue)]',
  'Home Insurance': 'bg-amber-500/15 text-[var(--accent-amber)]',
  Travel: 'bg-violet-500/15 text-[var(--accent-violet)]',
  'Life Insurance': 'bg-rose-500/15 text-[var(--accent-rose)]',
  'Personal Accident': 'bg-orange-500/15 text-[var(--accent-orange)]',
}

export default function InsurancePage() {
  const { selectedMember, member } = useFamily()
  const { insurancePolicies, addInsurance, updateInsurance, deleteInsurance } = useData()
  const { showToast, showBlockUI, hideBlockUI } = useToast()
  const confirm = useConfirm()
  const { mv } = useMask()

  const [modal, setModal] = useState(null)

  if (insurancePolicies === null) return <PageLoading title="Loading insurance" cards={5} />

  const filtered = useMemo(() => {
    const active = insurancePolicies.filter((p) => p.status !== 'Inactive')
    return selectedMember === 'all' ? active : active.filter((p) => p.memberId === selectedMember)
  }, [insurancePolicies, selectedMember])

  const totalCover = filtered.reduce((s, p) => s + (p.sumAssured || 0), 0)
  const totalPremium = filtered.reduce((s, p) => s + (p.premium || 0), 0)
  const lifeCover = filtered.filter((p) => p.policyType === 'Term Life' || p.policyType === 'Life Insurance').reduce((s, p) => s + (p.sumAssured || 0), 0)
  const healthCover = filtered.filter((p) => p.policyType === 'Health').reduce((s, p) => s + (p.sumAssured || 0), 0)

  async function handleSave(data) {
    showBlockUI('Saving...')
    try {
      if (modal?.edit) await updateInsurance(modal.edit.policyId, data)
      else await addInsurance(data)
      showToast(modal?.edit ? 'Insurance policy updated' : 'Insurance policy added')
      setModal(null)
    } catch (err) {
      showToast(err.message || 'Failed to save insurance policy', 'error')
    } finally {
      hideBlockUI()
    }
  }

  async function handleDelete() {
    if (modal?.edit && await confirm('Deactivate this insurance policy?', { title: 'Deactivate Policy', confirmLabel: 'Deactivate' })) {
      showBlockUI('Deactivating...')
      try {
        await deleteInsurance(modal.edit.policyId)
        showToast('Insurance policy deactivated')
        setModal(null)
      } catch (err) {
        showToast(err.message || 'Failed to deactivate insurance policy', 'error')
      } finally {
        hideBlockUI()
      }
    }
  }

  return (
    <div className="space-y-4">
      {filtered.length === 0 ? (
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] py-12 flex flex-col items-center gap-3">
          <Shield size={32} className="text-[var(--text-dim)]" />
          <p className="text-sm text-[var(--text-muted)]">No insurance policies{member ? ` for ${member.memberName}` : ''}</p>
          <button onClick={() => setModal('add')} className="text-xs font-semibold text-violet-400 hover:text-violet-300">
            Add your first policy
          </button>
        </div>
      ) : (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <StatCard label="Policies" value={filtered.length} />
            <StatCard label="Total Cover" value={formatINR(totalCover)} bold />
            <StatCard label="Life Cover" value={formatINR(lifeCover)} />
            <StatCard label="Health Cover" value={formatINR(healthCover)} />
            <StatCard label="Annual Premium" value={formatINR(totalPremium)} />
          </div>

          {/* Coverage Adequacy */}
          <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-4">
            <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3">Coverage Adequacy</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <AdequacyItem
                label="Life Insurance"
                current={lifeCover}
                recommended="10-15x annual income"
                tip="Term life cover should be 10-15x your annual income to protect dependents"
                icon="heart"
              />
              <AdequacyItem
                label="Health Insurance"
                current={healthCover}
                recommended="₹50L - ₹1Cr family floater"
                tip="Considering medical inflation, a ₹50L-1Cr family floater is recommended"
                icon="shield"
              />
            </div>
          </div>

          {/* Header with Add */}
          <div className="flex items-center justify-end px-1">
            <button onClick={() => setModal('add')} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-violet-400 hover:text-violet-300 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg transition-colors">
              <Plus size={14} /> Add Policy
            </button>
          </div>

          {/* Data Table */}
          <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] overflow-hidden">
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead>
                  <tr className="border-b border-[var(--border-light)] bg-[var(--bg-inset)]">
                    <th className="text-left py-2.5 px-4 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Policy</th>
                    <th className="text-left py-2.5 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Type</th>
                    <th className="text-left py-2.5 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Company</th>
                    {!member && <th className="text-left py-2.5 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Insured</th>}
                    <th className="text-right py-2.5 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Sum Assured</th>
                    <th className="text-right py-2.5 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Premium</th>
                    <th className="w-8 py-2.5 px-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <tr key={p.policyId} className="border-b border-[var(--border-light)] last:border-0 hover:bg-[var(--bg-hover)] transition-colors group">
                      <td className="py-2.5 px-4">
                        <p className="text-sm font-medium text-[var(--text-primary)]">{p.policyName}</p>
                        <p className="text-xs text-[var(--text-dim)]">{mv(p.policyNumber, 'policy')}</p>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${typeBadge[p.policyType] || 'bg-slate-500/15 text-[var(--text-muted)]'}`}>
                          {p.policyType}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-xs text-[var(--text-secondary)]">{p.company}</td>
                      {!member && <td className="py-2.5 px-3 text-xs text-[var(--text-secondary)]">{p.insuredMember}</td>}
                      <td className="py-2.5 px-3 text-right text-xs font-semibold text-[var(--text-primary)] tabular-nums">{formatINR(p.sumAssured)}</td>
                      <td className="py-2.5 px-3 text-right text-xs text-[var(--text-muted)] tabular-nums">
                        {formatINR(p.premium)}/{p.premiumFrequency === 'Annual' ? 'yr' : 'mo'}
                      </td>
                      <td className="py-2.5 px-2">
                        <button onClick={() => setModal({ edit: p })} className="opacity-0 group-hover:opacity-100 p-1 rounded text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-all">
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
              {filtered.map((p) => (
                <div key={p.policyId} onClick={() => setModal({ edit: p })} className="px-4 py-3.5 hover:bg-[var(--bg-hover)] transition-colors cursor-pointer">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium text-[var(--text-primary)] truncate mr-2">{p.policyName}</p>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${typeBadge[p.policyType] || 'bg-slate-500/15 text-[var(--text-muted)]'}`}>
                      {p.policyType}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-muted)]">{p.company}{!member ? ` · ${p.insuredMember}` : ''}</p>
                  <div className="flex items-center justify-between mt-1.5">
                    <div>
                      <p className="text-xs text-[var(--text-dim)]">Cover</p>
                      <p className="text-xs font-semibold text-[var(--text-primary)] tabular-nums">{formatINR(p.sumAssured)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-[var(--text-dim)]">Premium</p>
                      <p className="text-xs text-[var(--text-muted)] tabular-nums">{formatINR(p.premium)}/{p.premiumFrequency === 'Annual' ? 'yr' : 'mo'}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.edit ? 'Edit Insurance Policy' : 'Add Insurance Policy'} wide>
        <InsuranceForm
          initial={modal?.edit || undefined}
          onSave={handleSave}
          onDelete={modal?.edit ? handleDelete : undefined}
          onCancel={() => setModal(null)}
        />
      </Modal>
    </div>
  )
}

function AdequacyItem({ label, current, recommended, tip }) {
  const isLow = current === 0
  return (
    <div className={`rounded-lg border px-3 py-2.5 ${isLow ? 'border-rose-500/30 bg-rose-500/5' : 'border-[var(--border)] bg-[var(--bg-inset)]'}`}>
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-semibold text-[var(--text-primary)]">{label}</p>
        {isLow ? (
          <span className="text-xs font-bold text-[var(--accent-rose)]">Not covered</span>
        ) : (
          <span className="text-xs font-semibold text-emerald-400">{formatINR(current)}</span>
        )}
      </div>
      <p className="text-xs text-[var(--text-dim)]">Recommended: {recommended}</p>
      <p className="text-[10px] text-[var(--text-dim)] mt-0.5 italic">{tip}</p>
    </div>
  )
}

function StatCard({ label, value, bold }) {
  return (
    <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] px-4 py-3">
      <p className="text-xs text-[var(--text-dim)] uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-sm tabular-nums ${bold ? 'font-bold' : 'font-semibold'} text-[var(--text-primary)]`}>{value}</p>
    </div>
  )
}
