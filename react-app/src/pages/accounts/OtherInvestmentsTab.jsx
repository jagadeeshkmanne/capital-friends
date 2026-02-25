import { useState, useMemo } from 'react'
import { Plus, Pencil, Package } from 'lucide-react'
import { formatINR } from '../../data/familyData'
import { useFamily } from '../../context/FamilyContext'
import { useData } from '../../context/DataContext'
import Modal from '../../components/Modal'
import OtherInvestmentForm from '../../components/forms/OtherInvestmentForm'

const catBadge = {
  Debt: 'bg-blue-500/15 text-[var(--accent-blue)]',
  Gold: 'bg-amber-500/15 text-[var(--accent-amber)]',
  Property: 'bg-orange-500/15 text-[var(--accent-orange)]',
  Equity: 'bg-emerald-500/15 text-emerald-400',
  Alternative: 'bg-violet-500/15 text-[var(--accent-violet)]',
}

export default function OtherInvestmentsTab() {
  const { selectedMember, member } = useFamily()
  const { otherInvList, liabilityList, addOtherInvestment, updateOtherInvestment, deleteOtherInvestment } = useData()
  const [modal, setModal] = useState(null)

  const filtered = useMemo(() => {
    const active = otherInvList.filter((i) => i.status !== 'Inactive')
    return selectedMember === 'all' ? active : active.filter((i) => i.familyMemberId === selectedMember)
  }, [otherInvList, selectedMember])

  const totalInvested = filtered.reduce((s, i) => s + (i.investedAmount || 0), 0)
  const totalCurrent = filtered.reduce((s, i) => s + (i.currentValue || 0), 0)
  const totalPL = totalCurrent - totalInvested
  const plUp = totalPL >= 0
  const plPct = totalInvested > 0 ? (totalPL / totalInvested) * 100 : 0

  // Lookup linked liabilities
  const liabilityMap = useMemo(() => {
    const map = {}
    liabilityList.forEach((l) => { map[l.liabilityId] = l })
    return map
  }, [liabilityList])
  const linkedLoanTotal = filtered.reduce((s, i) => {
    const loan = i.linkedLiabilityId ? liabilityMap[i.linkedLiabilityId] : null
    return s + (loan?.outstandingBalance || 0)
  }, 0)

  function handleSave(data) {
    if (modal?.edit) updateOtherInvestment(modal.edit.investmentId, data)
    else addOtherInvestment(data)
    setModal(null)
  }

  function handleDelete() {
    if (modal?.edit && confirm('Deactivate this investment?')) {
      deleteOtherInvestment(modal.edit.investmentId)
      setModal(null)
    }
  }

  return (
    <div className="space-y-4">
      {filtered.length === 0 ? (
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] py-12 flex flex-col items-center gap-3">
          <Package size={32} className="text-[var(--text-dim)]" />
          <p className="text-sm text-[var(--text-muted)]">No other investments{member ? ` for ${member.memberName}` : ''}</p>
          <button onClick={() => setModal('add')} className="text-xs font-semibold text-violet-400 hover:text-violet-300">
            Add an investment
          </button>
        </div>
      ) : (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <StatCard label="Invested" value={formatINR(totalInvested)} />
            <StatCard label="Current Value" value={formatINR(totalCurrent)} bold />
            <StatCard
              label="P&L"
              value={`${plUp ? '+' : ''}${formatINR(Math.abs(totalPL))}`}
              sub={`${plUp ? '+' : ''}${plPct.toFixed(1)}%`}
              positive={plUp}
              bold
            />
            {linkedLoanTotal > 0 && (
              <StatCard label="Linked Loans" value={formatINR(linkedLoanTotal)} color="rose" />
            )}
            <StatCard label="Holdings" value={filtered.length} />
          </div>

          {/* Header with Add */}
          <div className="flex items-center justify-end px-1">
            <button onClick={() => setModal('add')} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-violet-400 hover:text-violet-300 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg transition-colors">
              <Plus size={14} /> Add Investment
            </button>
          </div>

          {/* Data Table */}
          <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] overflow-hidden">
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm min-w-[720px]">
                <thead>
                  <tr className="border-b border-[var(--border-light)] bg-[var(--bg-inset)]">
                    <th className="text-left py-2.5 px-4 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Investment</th>
                    <th className="text-left py-2.5 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Category</th>
                    {!member && <th className="text-left py-2.5 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Member</th>}
                    <th className="text-right py-2.5 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Invested</th>
                    <th className="text-right py-2.5 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Current</th>
                    <th className="text-right py-2.5 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">P&L</th>
                    <th className="text-right py-2.5 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Linked Loan</th>
                    <th className="w-8 py-2.5 px-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((i) => {
                    const pl = (i.currentValue || 0) - (i.investedAmount || 0)
                    const up = pl >= 0
                    const loan = i.linkedLiabilityId ? liabilityMap[i.linkedLiabilityId] : null
                    return (
                      <tr key={i.investmentId} className="border-b border-[var(--border-light)] last:border-0 hover:bg-[var(--bg-hover)] transition-colors group">
                        <td className="py-2.5 px-4">
                          <p className="text-sm font-medium text-[var(--text-primary)]">{i.investmentName}</p>
                          <p className="text-xs text-[var(--text-dim)]">{i.investmentType}</p>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${catBadge[i.investmentCategory] || 'bg-slate-500/15 text-[var(--text-muted)]'}`}>
                            {i.investmentCategory}
                          </span>
                        </td>
                        {!member && <td className="py-2.5 px-3 text-xs text-[var(--text-secondary)]">{i.familyMemberName}</td>}
                        <td className="py-2.5 px-3 text-right text-xs text-[var(--text-muted)] tabular-nums">{formatINR(i.investedAmount)}</td>
                        <td className="py-2.5 px-3 text-right text-xs font-semibold text-[var(--text-primary)] tabular-nums">{formatINR(i.currentValue)}</td>
                        <td className="py-2.5 px-3 text-right">
                          <span className={`text-xs font-semibold tabular-nums ${up ? 'text-emerald-400' : 'text-[var(--accent-rose)]'}`}>
                            {up ? '+' : ''}{formatINR(pl)}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {loan ? (
                            <div>
                              <p className="text-xs font-semibold text-[var(--accent-rose)] tabular-nums">{formatINR(loan.outstandingBalance)}</p>
                              <p className="text-xs text-[var(--text-dim)]">{loan.liabilityType}</p>
                            </div>
                          ) : (
                            <span className="text-xs text-[var(--text-dim)]">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-2">
                          <button onClick={() => setModal({ edit: i })} className="opacity-0 group-hover:opacity-100 p-1 rounded text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-all">
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
              {filtered.map((i) => {
                const pl = (i.currentValue || 0) - (i.investedAmount || 0)
                const up = pl >= 0
                const loan = i.linkedLiabilityId ? liabilityMap[i.linkedLiabilityId] : null
                return (
                  <div key={i.investmentId} onClick={() => setModal({ edit: i })} className="px-4 py-3.5 hover:bg-[var(--bg-hover)] transition-colors cursor-pointer">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium text-[var(--text-primary)] truncate mr-2">{i.investmentName}</p>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${catBadge[i.investmentCategory] || 'bg-slate-500/15 text-[var(--text-muted)]'}`}>
                        {i.investmentCategory}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--text-muted)]">{i.familyMemberName} · {i.investmentType}</p>
                    <div className="flex items-center justify-between mt-1.5">
                      <div>
                        <p className="text-xs text-[var(--text-dim)]">Invested</p>
                        <p className="text-xs text-[var(--text-muted)] tabular-nums">{formatINR(i.investedAmount)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-[var(--text-dim)]">Current</p>
                        <p className="text-xs font-semibold text-[var(--text-primary)] tabular-nums">{formatINR(i.currentValue)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-[var(--text-dim)]">P&L</p>
                        <p className={`text-xs font-semibold tabular-nums ${up ? 'text-emerald-400' : 'text-[var(--accent-rose)]'}`}>
                          {up ? '+' : ''}{formatINR(pl)}
                        </p>
                      </div>
                    </div>
                    {loan && (
                      <div className="mt-1.5 flex items-center justify-between bg-rose-500/5 rounded px-2 py-1">
                        <span className="text-xs text-[var(--text-dim)]">{loan.liabilityType}</span>
                        <span className="text-xs font-semibold text-[var(--accent-rose)] tabular-nums">{formatINR(loan.outstandingBalance)}</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.edit ? 'Edit Investment' : 'Add Investment'} wide>
        <OtherInvestmentForm
          initial={modal?.edit || undefined}
          onSave={handleSave}
          onDelete={modal?.edit ? handleDelete : undefined}
          onCancel={() => setModal(null)}
        />
      </Modal>
    </div>
  )
}

function StatCard({ label, value, sub, positive, bold, color }) {
  const textColor = color === 'rose' ? 'text-[var(--accent-rose)]' :
    positive === undefined ? 'text-[var(--text-primary)]' : positive ? 'text-emerald-400' : 'text-[var(--accent-rose)]'
  return (
    <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] px-4 py-3">
      <p className="text-xs text-[var(--text-dim)] uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-sm tabular-nums ${bold ? 'font-bold' : 'font-semibold'} ${textColor}`}>
        {value}
      </p>
      {sub && (
        <p className={`text-xs font-semibold tabular-nums mt-0.5 ${positive ? 'text-emerald-400' : 'text-[var(--accent-rose)]'}`}>
          {sub}
        </p>
      )}
    </div>
  )
}
