import { useState, useMemo } from 'react'
import { FileText, Filter } from 'lucide-react'
import { formatINR, splitFundName } from '../data/familyData'
import { useFamily } from '../context/FamilyContext'
import { useData } from '../context/DataContext'

const typeBadge = {
  BUY: 'bg-emerald-500/15 text-emerald-400',
  SELL: 'bg-rose-500/15 text-[var(--accent-rose)]',
}
const subBadge = {
  INITIAL: 'bg-violet-500/15 text-[var(--accent-violet)]',
  SIP: 'bg-blue-500/15 text-[var(--accent-blue)]',
  LUMPSUM: 'bg-emerald-500/15 text-emerald-400',
  WITHDRAWAL: 'bg-amber-500/15 text-[var(--accent-amber)]',
  SWITCH: 'bg-orange-500/15 text-[var(--accent-orange)]',
}

export default function ReportsPage() {
  const { selectedMember } = useFamily()
  const { mfTransactions, mfPortfolios, stockTransactions, stockPortfolios } = useData()
  const [tab, setTab] = useState('mf')
  const [filter, setFilter] = useState('all')

  // MF transactions filtered by member
  const mfTxns = useMemo(() => {
    let txns = [...mfTransactions].sort((a, b) => new Date(b.date) - new Date(a.date))
    if (selectedMember !== 'all') {
      const memberPortfolioIds = new Set(
        mfPortfolios.filter((p) => p.ownerId === selectedMember).map((p) => p.portfolioId)
      )
      txns = txns.filter((t) => memberPortfolioIds.has(t.portfolioId))
    }
    if (filter !== 'all') txns = txns.filter((t) => t.type === filter)
    return txns
  }, [mfTransactions, mfPortfolios, selectedMember, filter])

  // Stock transactions filtered by member
  const stkTxns = useMemo(() => {
    let txns = [...stockTransactions].sort((a, b) => new Date(b.date) - new Date(a.date))
    if (selectedMember !== 'all') {
      const memberPortfolioIds = new Set(
        stockPortfolios.filter((p) => p.ownerId === selectedMember).map((p) => p.portfolioId)
      )
      txns = txns.filter((t) => memberPortfolioIds.has(t.portfolioId))
    }
    if (filter !== 'all') txns = txns.filter((t) => t.type === filter)
    return txns
  }, [stockTransactions, stockPortfolios, selectedMember, filter])

  const txns = tab === 'mf' ? mfTxns : stkTxns
  const totalBuy = txns.filter((t) => t.type === 'BUY').reduce((s, t) => s + (t.totalAmount || 0), 0)
  const totalSell = txns.filter((t) => t.type === 'SELL').reduce((s, t) => s + (t.totalAmount || 0), 0)
  const totalGL = txns.reduce((s, t) => s + (t.gainLoss || t.realizedPL || 0), 0)

  return (
    <div className="space-y-4">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Transactions" value={txns.length} />
        <StatCard label="Total Bought" value={formatINR(totalBuy)} />
        <StatCard label="Total Sold" value={formatINR(totalSell)} />
        <StatCard label="Realized P&L" value={`${totalGL >= 0 ? '+' : ''}${formatINR(Math.abs(totalGL))}`} positive={totalGL >= 0} bold />
      </div>

      {/* Tabs + Filter */}
      <div className="flex items-center justify-between px-1">
        <div className="flex gap-1">
          {['mf', 'stocks'].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                tab === t
                  ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30'
                  : 'text-[var(--text-dim)] hover:text-[var(--text-primary)] border border-transparent'
              }`}
            >
              {t === 'mf' ? 'Mutual Funds' : 'Stocks'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <Filter size={12} className="text-[var(--text-dim)]" />
          {['all', 'BUY', 'SELL'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2 py-1 text-xs font-semibold rounded transition-colors ${
                filter === f
                  ? 'bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border)]'
                  : 'text-[var(--text-dim)] hover:text-[var(--text-muted)]'
              }`}
            >
              {f === 'all' ? 'All' : f}
            </button>
          ))}
        </div>
      </div>

      {/* Transaction Table */}
      <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] overflow-hidden">
        {txns.length === 0 ? (
          <div className="py-12 flex flex-col items-center gap-3">
            <FileText size={32} className="text-[var(--text-dim)]" />
            <p className="text-sm text-[var(--text-muted)]">No transactions found</p>
          </div>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead>
                  <tr className="border-b border-[var(--border-light)] bg-[var(--bg-inset)]">
                    <th className="text-left py-2.5 px-4 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Date</th>
                    <th className="text-left py-2.5 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Type</th>
                    <th className="text-left py-2.5 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">{tab === 'mf' ? 'Fund' : 'Stock'}</th>
                    <th className="text-left py-2.5 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Portfolio</th>
                    <th className="text-right py-2.5 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">{tab === 'mf' ? 'Units' : 'Qty'}</th>
                    <th className="text-right py-2.5 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">{tab === 'mf' ? 'NAV' : 'Price'}</th>
                    <th className="text-right py-2.5 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Amount</th>
                    <th className="text-right py-2.5 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {txns.map((t) => {
                    const gl = t.gainLoss || t.realizedPL || 0
                    return (
                      <tr key={t.transactionId} className="border-b border-[var(--border-light)] last:border-0 hover:bg-[var(--bg-hover)] transition-colors">
                        <td className="py-2.5 px-4 text-xs text-[var(--text-muted)] tabular-nums">{t.date}</td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1">
                            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${typeBadge[t.type] || ''}`}>{t.type}</span>
                            {t.transactionType && (
                              <span className={`text-[10px] font-semibold px-1 py-0.5 rounded ${subBadge[t.transactionType] || ''}`}>{t.transactionType}</span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          {t.fundName ? (
                            <>
                              <p className="text-xs font-medium text-[var(--text-primary)] truncate max-w-[180px]">{splitFundName(t.fundName).main}</p>
                              {splitFundName(t.fundName).plan && <p className="text-[10px] text-[var(--text-dim)]">{splitFundName(t.fundName).plan}</p>}
                            </>
                          ) : (
                            <p className="text-xs font-medium text-[var(--text-primary)] truncate max-w-[180px]">{t.companyName}</p>
                          )}
                          <p className="text-[10px] text-[var(--text-dim)]">{t.fundCode || t.symbol}</p>
                        </td>
                        <td className="py-2.5 px-3 text-xs text-[var(--text-muted)]">{t.portfolioName || ''}</td>
                        <td className="py-2.5 px-3 text-right text-xs text-[var(--text-muted)] tabular-nums">
                          {(t.units || t.quantity || 0).toFixed(tab === 'mf' ? 2 : 0)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-xs text-[var(--text-muted)] tabular-nums">
                          {formatINR(t.price || t.pricePerShare || 0)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-xs font-semibold text-[var(--text-primary)] tabular-nums">
                          {formatINR(t.totalAmount || 0)}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {gl !== 0 ? (
                            <span className={`text-xs font-semibold tabular-nums ${gl >= 0 ? 'text-emerald-400' : 'text-[var(--accent-rose)]'}`}>
                              {gl >= 0 ? '+' : ''}{formatINR(Math.abs(gl))}
                            </span>
                          ) : (
                            <span className="text-xs text-[var(--text-dim)]">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile */}
            <div className="sm:hidden divide-y divide-[var(--border-light)]">
              {txns.map((t) => {
                const gl = t.gainLoss || t.realizedPL || 0
                return (
                  <div key={t.transactionId} className="px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex-1 min-w-0 mr-2">
                        {t.fundName ? (
                          <>
                            <p className="text-sm font-medium text-[var(--text-primary)] truncate">{splitFundName(t.fundName).main}</p>
                            {splitFundName(t.fundName).plan && <p className="text-[10px] text-[var(--text-dim)]">{splitFundName(t.fundName).plan}</p>}
                          </>
                        ) : (
                          <p className="text-sm font-medium text-[var(--text-primary)] truncate">{t.companyName}</p>
                        )}
                      </div>
                      <span className={`text-xs font-semibold px-1.5 py-0.5 rounded shrink-0 ${typeBadge[t.type] || ''}`}>{t.type}</span>
                    </div>
                    <p className="text-xs text-[var(--text-muted)]">{t.date} · {t.portfolioName}</p>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-xs text-[var(--text-dim)]">{(t.units || t.quantity || 0).toFixed(tab === 'mf' ? 2 : 0)} @ {formatINR(t.price || t.pricePerShare || 0)}</span>
                      <span className="text-xs font-semibold text-[var(--text-primary)] tabular-nums">{formatINR(t.totalAmount || 0)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, positive, bold }) {
  return (
    <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] px-4 py-3">
      <p className="text-xs text-[var(--text-dim)] uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-sm tabular-nums ${bold ? 'font-bold' : 'font-semibold'} ${
        positive === undefined ? 'text-[var(--text-primary)]' : positive ? 'text-emerald-400' : 'text-[var(--accent-rose)]'
      }`}>
        {value}
      </p>
    </div>
  )
}
