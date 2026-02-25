import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Wallet, TrendingUp, TrendingDown, BarChart3, Building2, Landmark, AlertCircle, RefreshCw } from 'lucide-react'
import { useData } from '../../context/DataContext'
import PageLoading from '../../components/PageLoading'
import { useFamily } from '../../context/FamilyContext'
import { formatINR } from '../../data/familyData'

function plColor(val) { return val >= 0 ? 'text-emerald-400' : 'text-[var(--accent-rose)]' }
function plPrefix(val) { return val >= 0 ? '+' : '' }

export default function Dashboard() {
  const navigate = useNavigate()
  const { selectedMember } = useFamily()
  const {
    loading,
    mfPortfolios, mfHoldings,
    stockPortfolios, stockHoldings,
    otherInvList, liabilityList,
    banks, insurancePolicies,
    reminderList, goalList,
  } = useData()

  if (loading) return <PageLoading title="Loading dashboard" cards={4} />

  // Filter by selected member
  const data = useMemo(() => {
    const filterOwner = (items, ownerKey) =>
      selectedMember === 'all' ? items : items.filter((i) => i[ownerKey] === selectedMember)

    // MF
    const activeMFPortfolios = filterOwner(mfPortfolios.filter((p) => p.status === 'Active'), 'ownerId')
    const mfPortfolioIds = new Set(activeMFPortfolios.map((p) => p.portfolioId))
    const activeMFHoldings = mfHoldings.filter((h) => mfPortfolioIds.has(h.portfolioId) && h.units > 0)
    const mfInvested = activeMFHoldings.reduce((s, h) => s + h.investment, 0)
    const mfCurrentValue = activeMFHoldings.reduce((s, h) => s + h.currentValue, 0)
    const mfPL = mfCurrentValue - mfInvested

    // Stocks
    const activeStockPortfolios = filterOwner(stockPortfolios.filter((p) => p.status === 'Active'), 'ownerId')
    const stkPortfolioIds = new Set(activeStockPortfolios.map((p) => p.portfolioId))
    const activeStockHoldings = stockHoldings.filter((h) => stkPortfolioIds.has(h.portfolioId))
    const stkInvested = activeStockHoldings.reduce((s, h) => s + h.totalInvestment, 0)
    const stkCurrentValue = activeStockHoldings.reduce((s, h) => s + h.currentValue, 0)
    const stkPL = stkCurrentValue - stkInvested

    // Other Investments
    const activeOther = filterOwner(otherInvList.filter((i) => i.status === 'Active'), 'familyMemberId')
    const otherInvested = activeOther.reduce((s, i) => s + i.investedAmount, 0)
    const otherCurrentValue = activeOther.reduce((s, i) => s + i.currentValue, 0)
    const otherPL = otherCurrentValue - otherInvested

    // Liabilities
    const activeLiabilities = filterOwner(liabilityList.filter((l) => l.status === 'Active'), 'familyMemberId')
    const totalLiabilities = activeLiabilities.reduce((s, l) => s + l.outstandingBalance, 0)
    const totalEMI = activeLiabilities.reduce((s, l) => s + l.emiAmount, 0)

    // Insurance
    const activeInsurance = filterOwner(insurancePolicies.filter((p) => p.status === 'Active'), 'memberId')
    const totalCover = activeInsurance.filter((p) => p.policyType === 'Term Life' || p.policyType === 'Health').reduce((s, p) => s + p.sumAssured, 0)

    // Bank accounts count
    const activeBankAccounts = filterOwner(banks.filter((b) => b.status === 'Active'), 'memberId')

    // Totals
    const totalAssets = mfCurrentValue + stkCurrentValue + otherCurrentValue
    const netWorth = totalAssets - totalLiabilities
    const totalInvested = mfInvested + stkInvested + otherInvested
    const totalPL = totalAssets - totalInvested

    // Investment Alerts — buy opportunities (ATH-based) & rebalance
    let buyOppCount = 0
    let rebalanceCount = 0
    activeMFPortfolios.forEach((p) => {
      const pHoldings = mfHoldings.filter((h) => h.portfolioId === p.portfolioId && h.units > 0)
      const pValue = pHoldings.reduce((s, h) => s + h.currentValue, 0)
      const threshold = p.rebalanceThreshold || 0.05
      pHoldings.forEach((h) => {
        if (h.athNav > 0 && h.belowATHPct >= 5) buyOppCount++
        if (h.targetAllocationPct > 0 && pValue > 0) {
          const currentPct = (h.currentValue / pValue) * 100
          if (Math.abs(currentPct - h.targetAllocationPct) > threshold * 100) rebalanceCount++
        }
      })
    })

    return {
      mfCurrentValue, mfInvested, mfPL, mfCount: activeMFPortfolios.length,
      stkCurrentValue, stkInvested, stkPL, stkCount: activeStockPortfolios.length,
      otherCurrentValue, otherInvested, otherPL, otherCount: activeOther.length,
      totalLiabilities, totalEMI, liabilityCount: activeLiabilities.length,
      totalCover, insuranceCount: activeInsurance.length,
      bankCount: activeBankAccounts.length,
      totalAssets, totalInvested, totalPL, netWorth,
      buyOppCount, rebalanceCount,
    }
  }, [selectedMember, mfPortfolios, mfHoldings, stockPortfolios, stockHoldings, otherInvList, liabilityList, banks, insurancePolicies])

  // ── Action Items (computed from real data) ──
  const actionItems = useMemo(() => {
    const items = []
    const filterOwner = (arr, key) => selectedMember === 'all' ? arr : arr.filter((i) => i[key] === selectedMember)

    // Check term life insurance
    const activeInsurance = filterOwner(insurancePolicies.filter((p) => p.status === 'Active'), 'memberId')
    const hasTermLife = activeInsurance.some((p) => p.policyType === 'Term Life')
    if (!hasTermLife) items.push({ type: 'critical', title: 'Missing Term Life Insurance', badge: 'Add Policy' })

    // Check health insurance adequacy
    const healthCover = activeInsurance.filter((p) => p.policyType === 'Health').reduce((s, p) => s + p.sumAssured, 0)
    const memberCount = selectedMember === 'all' ? filterOwner(insurancePolicies, 'memberId').length || 1 : 1
    if (healthCover < 500000 * memberCount && healthCover > 0) items.push({ type: 'warning', title: 'Inadequate Health Insurance', badge: formatINR(healthCover) })
    if (healthCover === 0) items.push({ type: 'critical', title: 'No Health Insurance', badge: 'Add Policy' })

    // Check emergency fund goals
    const emergencyGoals = filterOwner(goalList.filter((g) => g.isActive !== false && g.goalType === 'Emergency Fund'), 'familyMemberId')
    emergencyGoals.forEach((g) => {
      const pct = g.targetAmount > 0 ? (g.currentValue / g.targetAmount) * 100 : 0
      if (pct < 100) items.push({ type: pct >= 75 ? 'info' : 'warning', title: `Emergency Fund at ${pct.toFixed(0)}%`, badge: formatINR(g.targetAmount - g.currentValue) + ' left' })
    })

    // Check goals needing attention
    const needsAttention = filterOwner(goalList.filter((g) => g.isActive !== false && g.status === 'Needs Attention'), 'familyMemberId')
    needsAttention.forEach((g) => items.push({ type: 'warning', title: `${g.goalName} needs attention`, badge: g.priority }))

    // Overdue reminders
    const activeReminders = filterOwner(reminderList.filter((r) => r.isActive !== false), 'familyMemberId')
    const overdue = activeReminders.filter((r) => {
      const diff = new Date(r.dueDate) - new Date()
      return diff < 0
    })
    overdue.forEach((r) => {
      const days = Math.ceil((new Date() - new Date(r.dueDate)) / (24 * 60 * 60 * 1000))
      items.push({ type: 'critical', title: r.title, badge: `${days}d overdue` })
    })

    return items.slice(0, 5)
  }, [selectedMember, insurancePolicies, goalList, reminderList])

  // ── Upcoming Reminders (sorted by due date) ──
  const upcomingReminders = useMemo(() => {
    const filterOwner = (arr, key) => selectedMember === 'all' ? arr : arr.filter((i) => i[key] === selectedMember)
    const active = filterOwner(reminderList.filter((r) => r.isActive !== false && r.status !== 'Completed'), 'familyMemberId')
    const now = new Date()
    return active
      .map((r) => {
        const diff = new Date(r.dueDate) - now
        const days = Math.ceil(diff / (24 * 60 * 60 * 1000))
        const dateStr = new Date(r.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
        return { ...r, days, dateStr }
      })
      .filter((r) => r.days >= 0)
      .sort((a, b) => a.days - b.days)
      .slice(0, 5)
  }, [selectedMember, reminderList])

  return (
    <div className="space-y-4">
      {/* Net Worth Hero */}
      <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Net Worth</p>
          <span className={`text-xs font-semibold ${plColor(data.totalPL)}`}>
            {plPrefix(data.totalPL)}{formatINR(Math.abs(data.totalPL))} P&L
          </span>
        </div>
        <p className="text-2xl font-bold text-[var(--text-primary)] tabular-nums">{formatINR(data.netWorth)}</p>
        <div className="flex items-center gap-4 mt-2 text-xs text-[var(--text-dim)]">
          <span>Assets: <span className="font-semibold text-[var(--text-secondary)]">{formatINR(data.totalAssets)}</span></span>
          <span className="w-px h-3 bg-[var(--border)]" />
          <span>Liabilities: <span className="font-semibold text-[var(--accent-rose)]">{formatINR(data.totalLiabilities)}</span></span>
        </div>

        {/* Asset/Liability bar */}
        {data.totalAssets > 0 && (
          <div className="mt-3 h-2 rounded-full overflow-hidden bg-[var(--bg-inset)] flex">
            {data.mfCurrentValue > 0 && (
              <div className="bg-violet-500 h-full" style={{ width: `${(data.mfCurrentValue / data.totalAssets) * 100}%` }} />
            )}
            {data.stkCurrentValue > 0 && (
              <div className="bg-blue-500 h-full" style={{ width: `${(data.stkCurrentValue / data.totalAssets) * 100}%` }} />
            )}
            {data.otherCurrentValue > 0 && (
              <div className="bg-emerald-500 h-full" style={{ width: `${(data.otherCurrentValue / data.totalAssets) * 100}%` }} />
            )}
          </div>
        )}
        <div className="flex items-center gap-3 mt-1.5 text-xs text-[var(--text-dim)]">
          {data.mfCurrentValue > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-violet-500" />MF {((data.mfCurrentValue / data.totalAssets) * 100).toFixed(0)}%</span>}
          {data.stkCurrentValue > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" />Stocks {((data.stkCurrentValue / data.totalAssets) * 100).toFixed(0)}%</span>}
          {data.otherCurrentValue > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" />Other {((data.otherCurrentValue / data.totalAssets) * 100).toFixed(0)}%</span>}
        </div>
      </div>

      {/* Investment Alerts */}
      {(data.buyOppCount > 0 || data.rebalanceCount > 0) && (
        <div className="flex gap-3">
          {data.buyOppCount > 0 && (
            <button
              onClick={() => navigate('/investments/mutual-funds')}
              className="flex-1 flex items-center gap-2.5 bg-[var(--bg-card)] rounded-xl border border-emerald-500/30 p-3 hover:bg-emerald-500/5 transition-colors"
            >
              <span className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-400 shrink-0">
                <TrendingDown size={16} />
              </span>
              <div className="min-w-0 text-left">
                <p className="text-sm font-semibold text-emerald-400">{data.buyOppCount} Buy {data.buyOppCount === 1 ? 'Opportunity' : 'Opportunities'}</p>
                <p className="text-xs text-[var(--text-dim)]">Funds 5%+ below ATH</p>
              </div>
              <ChevronRight size={14} className="text-[var(--text-dim)] ml-auto shrink-0" />
            </button>
          )}
          {data.rebalanceCount > 0 && (
            <button
              onClick={() => navigate('/investments/mutual-funds')}
              className="flex-1 flex items-center gap-2.5 bg-[var(--bg-card)] rounded-xl border border-violet-500/30 p-3 hover:bg-violet-500/5 transition-colors"
            >
              <span className="w-8 h-8 rounded-lg bg-violet-500/15 flex items-center justify-center text-violet-400 shrink-0">
                <RefreshCw size={16} />
              </span>
              <div className="min-w-0 text-left">
                <p className="text-sm font-semibold text-violet-400">{data.rebalanceCount} Rebalance {data.rebalanceCount === 1 ? 'Alert' : 'Alerts'}</p>
                <p className="text-xs text-[var(--text-dim)]">Portfolios drifted from targets</p>
              </div>
              <ChevronRight size={14} className="text-[var(--text-dim)] ml-auto shrink-0" />
            </button>
          )}
        </div>
      )}

      {/* Asset Cards Grid */}
      <div className="grid grid-cols-2 gap-3">
        <AssetCard
          icon={<TrendingUp size={16} />}
          iconColor="text-violet-400 bg-violet-500/15"
          label="Mutual Funds"
          value={data.mfCurrentValue}
          invested={data.mfInvested}
          pl={data.mfPL}
          count={data.mfCount}
          countLabel="portfolios"
          onClick={() => navigate('/investments/mutual-funds')}
        />
        <AssetCard
          icon={<BarChart3 size={16} />}
          iconColor="text-blue-400 bg-blue-500/15"
          label="Stocks"
          value={data.stkCurrentValue}
          invested={data.stkInvested}
          pl={data.stkPL}
          count={data.stkCount}
          countLabel="portfolios"
          onClick={() => navigate('/investments/stocks')}
        />
        <AssetCard
          icon={<Building2 size={16} />}
          iconColor="text-emerald-400 bg-emerald-500/15"
          label="Other Investments"
          value={data.otherCurrentValue}
          invested={data.otherInvested}
          pl={data.otherPL}
          count={data.otherCount}
          countLabel="investments"
          onClick={() => navigate('/investments/other')}
        />
        <AssetCard
          icon={<Landmark size={16} />}
          iconColor="text-rose-400 bg-rose-500/15"
          label="Liabilities"
          value={data.totalLiabilities}
          count={data.liabilityCount}
          countLabel="active"
          emi={data.totalEMI}
          isLiability
          onClick={() => navigate('/liabilities')}
        />
      </div>

      {/* Quick Stats Row */}
      <div className="flex gap-3">
        <div className="flex-1 bg-[var(--bg-card)] rounded-xl border border-[var(--border)] px-4 py-3 cursor-pointer hover:bg-[var(--bg-hover)] transition-colors" onClick={() => navigate('/accounts/bank')}>
          <div className="flex items-center justify-between">
            <p className="text-xs text-[var(--text-muted)] font-semibold">Bank Accounts</p>
            <Wallet size={14} className="text-[var(--text-dim)]" />
          </div>
          <p className="text-lg font-bold text-[var(--text-primary)] mt-1">{data.bankCount}</p>
        </div>
        <div className="flex-1 bg-[var(--bg-card)] rounded-xl border border-[var(--border)] px-4 py-3 cursor-pointer hover:bg-[var(--bg-hover)] transition-colors" onClick={() => navigate('/insurance')}>
          <div className="flex items-center justify-between">
            <p className="text-xs text-[var(--text-muted)] font-semibold">Insurance Cover</p>
            <AlertCircle size={14} className="text-[var(--text-dim)]" />
          </div>
          <p className="text-lg font-bold text-[var(--text-primary)] mt-1">{formatINR(data.totalCover)}</p>
          <p className="text-xs text-[var(--text-dim)]">{data.insuranceCount} policies</p>
        </div>
      </div>

      {/* Action Items */}
      {actionItems.length > 0 && (
        <div>
          <div className="flex items-center justify-between px-1 mb-2">
            <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Action Items</h3>
          </div>
          <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] px-4 py-3">
            {actionItems.map((a) => {
              const dot = { critical: 'bg-rose-500', warning: 'bg-amber-500', info: 'bg-blue-500' }[a.type]
              const badgeBg = { critical: 'bg-rose-500/20 text-[var(--accent-rose)]', warning: 'bg-amber-500/20 text-[var(--accent-amber)]', info: 'bg-blue-500/20 text-[var(--accent-blue)]' }[a.type]
              return (
                <div key={a.title} className="flex items-center gap-3 py-2 border-b border-[var(--border-light)] last:border-0">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
                  <p className="text-sm text-[var(--text-secondary)] flex-1 truncate">{a.title}</p>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${badgeBg}`}>{a.badge}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Upcoming */}
      {upcomingReminders.length > 0 && (
        <div>
          <div className="flex items-center justify-between px-1 mb-2">
            <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Upcoming</h3>
            <button onClick={() => navigate('/reminders')} className="text-xs text-indigo-400 font-semibold flex items-center gap-0.5 hover:text-indigo-300">
              All<ChevronRight size={10} />
            </button>
          </div>
          <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] px-4 py-3">
            {upcomingReminders.map((r) => (
              <div key={r.reminderId} className="flex items-center justify-between py-2 border-b border-[var(--border-light)] last:border-0">
                <div className="min-w-0">
                  <p className="text-sm text-[var(--text-secondary)] truncate">{r.title}</p>
                  <p className="text-xs text-[var(--text-dim)] mt-0.5">{r.dateStr}</p>
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                  r.days <= 15 ? 'bg-rose-500/20 text-[var(--accent-rose)]' : r.days <= 30 ? 'bg-amber-500/20 text-[var(--accent-amber)]' : 'bg-slate-500/20 text-[var(--text-muted)]'
                }`}>{r.days}d</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function AssetCard({ icon, iconColor, label, value, invested, pl, count, countLabel, emi, isLiability, onClick }) {
  return (
    <div
      onClick={onClick}
      className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-3.5 cursor-pointer hover:bg-[var(--bg-hover)] transition-colors"
    >
      <div className="flex items-center gap-2 mb-2">
        <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${iconColor}`}>{icon}</span>
        <p className="text-xs font-semibold text-[var(--text-muted)]">{label}</p>
      </div>
      <p className="text-base font-bold text-[var(--text-primary)] tabular-nums">{formatINR(value)}</p>
      {!isLiability && pl !== undefined && invested > 0 && (
        <p className={`text-xs font-semibold tabular-nums mt-0.5 ${plColor(pl)}`}>
          {plPrefix(pl)}{formatINR(Math.abs(pl))} ({plPrefix(pl)}{((pl / invested) * 100).toFixed(1)}%)
        </p>
      )}
      {isLiability && emi > 0 && (
        <p className="text-xs text-[var(--text-dim)] mt-0.5">EMI: {formatINR(emi)}/mo</p>
      )}
      <p className="text-xs text-[var(--text-dim)] mt-1">{count} {countLabel}</p>
    </div>
  )
}
