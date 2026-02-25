import { useState, useMemo } from 'react'
import { Plus, Pencil, TrendingUp, TrendingDown, Wallet, List, Layers, ChevronDown, ArrowDownCircle, Repeat2, Settings2, RefreshCw } from 'lucide-react'
import { formatINR } from '../../data/familyData'
import { useFamily } from '../../context/FamilyContext'
import { useData } from '../../context/DataContext'
import Modal from '../../components/Modal'
import MFPortfolioForm from '../../components/forms/MFPortfolioForm'
import MFInvestForm from '../../components/forms/MFInvestForm'
import MFRedeemForm from '../../components/forms/MFRedeemForm'
import MFSwitchForm from '../../components/forms/MFSwitchForm'
import MFAllocationManager from '../../components/forms/MFAllocationManager'
import MFRebalanceDialog from '../../components/forms/MFRebalanceDialog'
import MFBuyOpportunities from '../../components/forms/MFBuyOpportunities'
import PageLoading from '../../components/PageLoading'

// ATH color coding (matching email report)
function athColor(pct) {
  if (pct >= 20) return { color: '#c62828', fontWeight: 700 }
  if (pct >= 10) return { color: '#d84315', fontWeight: 700 }
  if (pct >= 5) return { color: '#e67e00', fontWeight: 400 }
  if (pct >= 1) return { color: '#b8860b', fontWeight: 400 }
  return { color: 'var(--text-dim)', fontWeight: 400 }
}

export default function MutualFundsPage() {
  const { selectedMember } = useFamily()
  const {
    loading,
    mfPortfolios, mfHoldings, mfTransactions,
    activeInvestmentAccounts,
    addMFPortfolio, updateMFPortfolio, deleteMFPortfolio,
    investMF, redeemMF, switchMF, updateHoldingAllocations,
  } = useData()

  if (loading) return <PageLoading title="Loading mutual funds" cards={5} />

  const [modal, setModal] = useState(null)
  const [selectedPortfolioId, setSelectedPortfolioId] = useState('all')
  const [subTab, setSubTab] = useState('holdings')
  const [dropdownOpen, setDropdownOpen] = useState(false)

  // Filter portfolios by member
  const portfolios = useMemo(() => {
    const active = mfPortfolios.filter((p) => p.status !== 'Inactive')
    return selectedMember === 'all' ? active : active.filter((p) => p.ownerId === selectedMember)
  }, [mfPortfolios, selectedMember])

  // Per-portfolio computed data
  const portfolioData = useMemo(() => {
    return portfolios.map((p) => {
      const holdings = mfHoldings.filter((h) => h.portfolioId === p.portfolioId)
      const txns = mfTransactions.filter((t) => t.portfolioId === p.portfolioId)
      const account = activeInvestmentAccounts.find((a) => a.accountId === p.investmentAccountId)
      return {
        ...p, holdings, txns,
        fundCount: holdings.length,
        platform: account?.platformBroker || p.investmentAccountName || '—',
        clientId: account?.accountClientId || '—',
      }
    })
  }, [portfolios, mfHoldings, mfTransactions, activeInvestmentAccounts])

  // Stats for selected view
  const stats = useMemo(() => {
    const source = selectedPortfolioId === 'all' ? portfolioData : portfolioData.filter((p) => p.portfolioId === selectedPortfolioId)
    const invested = source.reduce((s, p) => s + p.totalInvestment, 0)
    const current = source.reduce((s, p) => s + p.currentValue, 0)
    const unrealizedPL = source.reduce((s, p) => s + p.unrealizedPL, 0)
    const realizedPL = source.reduce((s, p) => s + p.realizedPL, 0)
    const totalPL = unrealizedPL + realizedPL
    const totalPLPct = invested > 0 ? (totalPL / invested) * 100 : 0
    const unrealizedPLPct = invested > 0 ? (unrealizedPL / invested) * 100 : 0
    const realizedPLPct = invested > 0 ? (realizedPL / invested) * 100 : 0
    const funds = source.reduce((s, p) => s + p.fundCount, 0)
    // Monthly SIP total from holdings
    const relevantHoldings = selectedPortfolioId === 'all'
      ? mfHoldings.filter((h) => source.some((p) => p.portfolioId === h.portfolioId))
      : mfHoldings.filter((h) => h.portfolioId === selectedPortfolioId)
    const monthlySIP = relevantHoldings.reduce((s, h) => s + (h.sipAmount || 0), 0)
    return { invested, current, unrealizedPL, unrealizedPLPct, realizedPL, realizedPLPct, totalPL, totalPLPct, funds, monthlySIP }
  }, [portfolioData, selectedPortfolioId, mfHoldings])

  // Holdings & transactions for selected view
  const holdings = useMemo(() => {
    if (selectedPortfolioId === 'all') return mfHoldings.filter((h) => portfolios.some((p) => p.portfolioId === h.portfolioId))
    return mfHoldings.filter((h) => h.portfolioId === selectedPortfolioId)
  }, [mfHoldings, portfolios, selectedPortfolioId])

  const transactions = useMemo(() => {
    const txns = selectedPortfolioId === 'all'
      ? mfTransactions.filter((t) => portfolios.some((p) => p.portfolioId === t.portfolioId))
      : mfTransactions.filter((t) => t.portfolioId === selectedPortfolioId)
    return txns.sort((a, b) => new Date(b.date) - new Date(a.date))
  }, [mfTransactions, portfolios, selectedPortfolioId])

  // Enrich holdings with dynamic allocation % (rebalance logic moved to dialog)
  const enrichedHoldings = useMemo(() => {
    const portfolioTotals = {}
    holdings.forEach((h) => {
      portfolioTotals[h.portfolioId] = (portfolioTotals[h.portfolioId] || 0) + h.currentValue
    })

    return holdings.map((h) => {
      const totalValue = portfolioTotals[h.portfolioId] || 0
      const currentAllocationPct = totalValue > 0 ? (h.currentValue / totalValue) * 100 : 0
      return { ...h, currentAllocationPct }
    })
  }, [holdings])

  // Per-portfolio indicator counts (buy opp + rebalance)
  const portfolioIndicators = useMemo(() => {
    const indicators = {}
    portfolioData.forEach((p) => {
      const pHoldings = mfHoldings.filter((h) => h.portfolioId === p.portfolioId && h.units > 0)
      const totalValue = pHoldings.reduce((s, h) => s + h.currentValue, 0)
      const threshold = (p.rebalanceThreshold || 0.05) * 100

      let buyOpp = 0
      let rebalance = 0
      pHoldings.forEach((h) => {
        if (h.athNav > 0 && h.belowATHPct >= 5) buyOpp++
        const currentPct = totalValue > 0 ? (h.currentValue / totalValue) * 100 : 0
        if (Math.abs(currentPct - h.targetAllocationPct) > threshold) rebalance++
      })
      indicators[p.portfolioId] = { buyOpp, rebalance }
    })
    return indicators
  }, [portfolioData, mfHoldings])

  // Counts for current selection (aggregate when "all")
  const currentIndicators = useMemo(() => {
    if (selectedPortfolioId !== 'all') return portfolioIndicators[selectedPortfolioId] || { buyOpp: 0, rebalance: 0 }
    let buyOpp = 0, rebalance = 0
    Object.values(portfolioIndicators).forEach((ind) => { buyOpp += ind.buyOpp; rebalance += ind.rebalance })
    return { buyOpp, rebalance }
  }, [selectedPortfolioId, portfolioIndicators])

  const selectedPortfolio = portfolioData.find((p) => p.portfolioId === selectedPortfolioId)

  const dropdownLabel = selectedPortfolioId === 'all'
    ? `All Portfolios (${portfolios.length})`
    : `${selectedPortfolio?.portfolioName} — ${selectedPortfolio?.ownerName}`

  // Handlers
  function handleSavePortfolio(data) {
    if (modal?.editPortfolio) updateMFPortfolio(modal.editPortfolio.portfolioId, data)
    else addMFPortfolio(data)
    setModal(null)
  }

  function handleDeletePortfolio() {
    if (modal?.editPortfolio && confirm('Deactivate this portfolio?')) {
      deleteMFPortfolio(modal.editPortfolio.portfolioId)
      setSelectedPortfolioId('all')
      setModal(null)
    }
  }

  function handleInvest(data) {
    investMF(data, data.transactionType)
    setModal(null)
  }

  function handleRedeem(data) {
    redeemMF(data)
    setModal(null)
  }

  function handleSwitch(data) {
    switchMF(data)
    setModal(null)
  }

  function handleSaveAllocations(allocations) {
    if (modal?.allocations) {
      updateHoldingAllocations(modal.allocations, allocations)
      setModal(null)
    }
  }

  return (
    <div className="space-y-4">
      {portfolios.length === 0 ? (
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] py-12 flex flex-col items-center gap-3">
          <Wallet size={32} className="text-[var(--text-dim)]" />
          <p className="text-sm text-[var(--text-muted)]">No mutual fund portfolios yet</p>
          <button onClick={() => setModal('addPortfolio')} className="text-xs font-semibold text-violet-400 hover:text-violet-300">
            Create your first portfolio
          </button>
        </div>
      ) : (
        <>
          {/* ── Top Bar: Portfolio Selector + Actions ── */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg px-4 py-2.5 text-sm font-semibold text-[var(--text-primary)] hover:border-[var(--border-light)] transition-colors min-w-[220px]"
              >
                <Wallet size={14} className="text-violet-400 shrink-0" />
                <span className="truncate">{dropdownLabel}</span>
                <ChevronDown size={14} className={`text-[var(--text-dim)] shrink-0 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {dropdownOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setDropdownOpen(false)} />
                  <div className="absolute left-0 top-full mt-1 z-40 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg shadow-xl min-w-[300px] py-1 overflow-hidden">
                    <button
                      onClick={() => { setSelectedPortfolioId('all'); setDropdownOpen(false); setSubTab('holdings') }}
                      className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${selectedPortfolioId === 'all' ? 'bg-[var(--sidebar-active-bg)] text-[var(--text-primary)] font-semibold' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'}`}
                    >
                      All Portfolios ({portfolios.length})
                    </button>
                    <div className="border-t border-[var(--border-light)]" />
                    {portfolioData.map((p) => {
                      const plUp = p.totalPL >= 0
                      const ind = portfolioIndicators[p.portfolioId] || {}
                      return (
                        <button
                          key={p.portfolioId}
                          onClick={() => { setSelectedPortfolioId(p.portfolioId); setDropdownOpen(false); setSubTab('holdings') }}
                          className={`w-full text-left px-4 py-2.5 transition-colors ${selectedPortfolioId === p.portfolioId ? 'bg-[var(--sidebar-active-bg)]' : 'hover:bg-[var(--bg-hover)]'}`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <p className={`text-sm ${selectedPortfolioId === p.portfolioId ? 'font-semibold text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                                  {p.portfolioName}
                                </p>
                                {ind.buyOpp > 0 && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" title={`${ind.buyOpp} buy opportunities`} />}
                                {ind.rebalance > 0 && <span className="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" title={`${ind.rebalance} funds need rebalancing`} />}
                              </div>
                              <p className="text-xs text-[var(--text-dim)]">{p.ownerName} · {p.platform} · {p.fundCount} funds</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs font-semibold text-[var(--text-primary)] tabular-nums">{formatINR(p.currentValue)}</p>
                              <p className={`text-xs font-semibold tabular-nums ${plUp ? 'text-emerald-400' : 'text-[var(--accent-rose)]'}`}>
                                {plUp ? '+' : ''}{p.totalPLPct.toFixed(1)}%
                              </p>
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Buy Opp & Rebalance — always visible with count */}
              <button
                onClick={() => setModal('buyOpp')}
                disabled={currentIndicators.buyOpp === 0}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                  currentIndicators.buyOpp > 0
                    ? 'text-emerald-400 hover:text-emerald-300 bg-[var(--bg-card)] border border-emerald-500/30 animate-glow-emerald'
                    : 'text-[var(--text-dim)] bg-[var(--bg-card)] border border-[var(--border)] opacity-50 cursor-not-allowed'
                }`}
              >
                <TrendingDown size={12} /> Buy Opp.
                {currentIndicators.buyOpp > 0 && <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/15">{currentIndicators.buyOpp}</span>}
              </button>
              <button
                onClick={() => setModal('rebalance')}
                disabled={currentIndicators.rebalance === 0}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                  currentIndicators.rebalance > 0
                    ? 'text-violet-400 hover:text-violet-300 bg-[var(--bg-card)] border border-violet-500/30 animate-glow-violet'
                    : 'text-[var(--text-dim)] bg-[var(--bg-card)] border border-[var(--border)] opacity-50 cursor-not-allowed'
                }`}
              >
                <RefreshCw size={12} /> Rebalance
                {currentIndicators.rebalance > 0 && <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-violet-500/15">{currentIndicators.rebalance}</span>}
              </button>
              {selectedPortfolio && (
                <>
                  <button onClick={() => setModal({ allocations: selectedPortfolio.portfolioId })} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-[var(--bg-card)] border border-[var(--border)] rounded-lg transition-colors">
                    <Settings2 size={12} /> Allocations
                  </button>
                  <button onClick={() => setModal({ editPortfolio: selectedPortfolio })} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-[var(--bg-card)] border border-[var(--border)] rounded-lg transition-colors">
                    <Pencil size={12} /> Edit
                  </button>
                </>
              )}
              <button onClick={() => setModal('addPortfolio')} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-violet-400 hover:text-violet-300 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg transition-colors">
                <Plus size={14} /> New Portfolio
              </button>
            </div>
          </div>

          {/* ── Portfolio Info ── */}
          {selectedPortfolio && (
            <div className="flex items-center gap-4 text-xs text-[var(--text-dim)] px-1 flex-wrap">
              <span><span className="font-semibold">Platform:</span> {selectedPortfolio.platform}</span>
              <span><span className="font-semibold">Client ID:</span> {selectedPortfolio.clientId}</span>
              <span><span className="font-semibold">Funds:</span> {selectedPortfolio.fundCount}</span>
              {selectedPortfolio.sipTarget > 0 && <span><span className="font-semibold">SIP Target:</span> {formatINR(selectedPortfolio.sipTarget)}/mo</span>}
              {selectedPortfolio.lumpsumTarget > 0 && <span><span className="font-semibold">Lumpsum Target:</span> {formatINR(selectedPortfolio.lumpsumTarget)}</span>}
              <span><span className="font-semibold">Rebalance Threshold:</span> {(selectedPortfolio.rebalanceThreshold * 100).toFixed(0)}%</span>
            </div>
          )}

          {/* ── Stat Cards ── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard label="Invested" value={formatINR(stats.invested)} />
            <StatCard label="Current Value" value={formatINR(stats.current)} bold />
            <StatCard
              label="Unrealized P&L"
              value={`${stats.unrealizedPL >= 0 ? '+' : ''}${formatINR(stats.unrealizedPL)}`}
              sub={`${stats.unrealizedPLPct >= 0 ? '+' : ''}${stats.unrealizedPLPct.toFixed(1)}%`}
              positive={stats.unrealizedPL >= 0}
            />
            <StatCard
              label="Realized P&L"
              value={`${stats.realizedPL >= 0 ? '+' : ''}${formatINR(stats.realizedPL)}`}
              sub={`${stats.realizedPLPct >= 0 ? '+' : ''}${stats.realizedPLPct.toFixed(1)}%`}
              positive={stats.realizedPL >= 0}
            />
            <StatCard
              label="Total P&L"
              value={`${stats.totalPL >= 0 ? '+' : ''}${formatINR(stats.totalPL)}`}
              sub={`${stats.totalPLPct >= 0 ? '+' : ''}${stats.totalPLPct.toFixed(1)}%`}
              positive={stats.totalPL >= 0}
              bold
            />
            <StatCard label="Monthly SIP" value={formatINR(stats.monthlySIP)} sub={`${stats.funds} funds`} />
          </div>

          {/* ── Sub-tabs + Actions ── */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-1 bg-[var(--bg-inset)] rounded-lg p-0.5">
              <button
                onClick={() => setSubTab('holdings')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  subTab === 'holdings'
                    ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}
              >
                <Layers size={12} /> Holdings ({holdings.length})
              </button>
              <button
                onClick={() => setSubTab('transactions')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  subTab === 'transactions'
                    ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}
              >
                <List size={12} /> Transactions ({transactions.length})
              </button>
            </div>

            <div className="flex items-center gap-2">
              {selectedPortfolioId === 'all' && (
                <span className="text-xs text-[var(--text-dim)] mr-1 hidden sm:inline">Select a portfolio to take actions</span>
              )}
              <button
                onClick={() => selectedPortfolioId !== 'all' && setModal({ invest: selectedPortfolioId })}
                disabled={selectedPortfolioId === 'all'}
                className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-colors shadow-sm ${selectedPortfolioId === 'all' ? 'bg-emerald-600/40 text-white/50 cursor-not-allowed' : 'text-white bg-emerald-600 hover:bg-emerald-500'}`}
                title={selectedPortfolioId === 'all' ? 'Select a portfolio first' : ''}
              >
                <TrendingUp size={14} /> Invest
              </button>
              <button
                onClick={() => selectedPortfolioId !== 'all' && holdings.length > 0 && setModal({ redeem: selectedPortfolioId })}
                disabled={selectedPortfolioId === 'all' || holdings.length === 0}
                className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-colors shadow-sm ${selectedPortfolioId === 'all' || holdings.length === 0 ? 'bg-rose-600/40 text-white/50 cursor-not-allowed' : 'text-white bg-rose-600 hover:bg-rose-500'}`}
                title={selectedPortfolioId === 'all' ? 'Select a portfolio first' : ''}
              >
                <ArrowDownCircle size={14} /> Redeem
              </button>
              <button
                onClick={() => selectedPortfolioId !== 'all' && holdings.length > 0 && setModal({ switchFunds: selectedPortfolioId })}
                disabled={selectedPortfolioId === 'all' || holdings.length === 0}
                className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-colors shadow-sm ${selectedPortfolioId === 'all' || holdings.length === 0 ? 'bg-amber-600/40 text-white/50 cursor-not-allowed' : 'text-white bg-amber-600 hover:bg-amber-500'}`}
                title={selectedPortfolioId === 'all' ? 'Select a portfolio first' : ''}
              >
                <Repeat2 size={14} /> Switch
              </button>
            </div>
          </div>

          {/* ── Holdings Tab ── */}
          {subTab === 'holdings' && (
            <>
              {holdings.length > 0 ? (
                <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] overflow-hidden">
                  {/* Desktop table */}
                  <div className="hidden lg:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[var(--border-light)] bg-[var(--bg-inset)]">
                          <th className="text-left py-2 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Fund Name</th>
                          <th className="text-right py-2 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Units</th>
                          <th className="text-right py-2 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">
                            <div>NAV</div>
                            <div className="text-[10px] font-medium text-[var(--text-dim)]">Current / Avg</div>
                          </th>
                          <th className="text-right py-2 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">
                            <div>Allocation %</div>
                            <div className="text-[10px] font-medium text-[var(--text-dim)]">Current / Target</div>
                          </th>
                          <th className="text-right py-2 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">
                            <div>Amount</div>
                            <div className="text-[10px] font-medium text-[var(--text-dim)]">Current / Invested</div>
                          </th>
                          <th className="text-right py-2 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">
                            <div>P&L</div>
                            <div className="text-[10px] font-medium text-[var(--text-dim)]">on Holdings</div>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {enrichedHoldings.map((h) => {
                          const ath = athColor(h.belowATHPct)
                          const portfolio = selectedPortfolioId === 'all' ? portfolioData.find((p) => p.portfolioId === h.portfolioId) : null
                          const isPlanned = h.units === 0
                          const pData = portfolioData.find((p) => p.portfolioId === h.portfolioId)
                          const totalPortfolioValue = pData?.currentValue || 0

                          // P&L on current holdings
                          const unrealizedPL = h.pl
                          const unrealUp = unrealizedPL >= 0

                          // Planned fund: catch-up lumpsum + steady SIP
                          const plannedBuy = isPlanned && h.targetAllocationPct > 0 && h.targetAllocationPct < 100 && totalPortfolioValue > 0
                            ? (h.targetAllocationPct / (100 - h.targetAllocationPct)) * totalPortfolioValue : 0
                          const steadySIP = isPlanned && h.targetAllocationPct > 0 && pData?.sipTarget > 0
                            ? (h.targetAllocationPct / 100) * pData.sipTarget : 0

                          return (
                            <tr key={h.holdingId} className={`border-b border-[var(--border-light)] last:border-0 hover:bg-[var(--bg-hover)] transition-colors ${isPlanned ? 'opacity-60' : ''}`}>
                              <td className="py-2.5 px-3 max-w-[240px]">
                                <p className="text-xs text-[var(--text-primary)] leading-tight">
                                  {h.fundName}
                                  {isPlanned && <span className="ml-1.5 text-xs font-semibold text-violet-400 bg-violet-500/15 px-1.5 py-0.5 rounded">Planned</span>}
                                </p>
                                {portfolio && <p className="text-xs text-[var(--text-dim)]">{portfolio.portfolioName}</p>}
                                {isPlanned && (plannedBuy > 0 || steadySIP > 0) && (
                                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                    {plannedBuy > 0 && <span className="text-xs text-emerald-400 font-semibold">Buy {formatINR(plannedBuy)}</span>}
                                    {steadySIP > 0 && <span className="text-xs text-blue-400 font-semibold">SIP {formatINR(steadySIP)}/mo</span>}
                                  </div>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right text-xs text-[var(--text-secondary)] tabular-nums">{isPlanned ? '—' : h.units.toFixed(2)}</td>
                              <td className="py-2.5 px-3 text-right">
                                {isPlanned ? (
                                  <span className="text-xs text-[var(--text-dim)]">—</span>
                                ) : (
                                  <>
                                    <p className="text-xs font-semibold text-[var(--text-primary)] tabular-nums">₹{h.currentNav.toFixed(2)}</p>
                                    <p className="text-xs text-[var(--text-dim)] tabular-nums">₹{h.avgNav.toFixed(2)}</p>
                                    {h.athNav > 0 && h.belowATHPct > 0 && (
                                      <p className="text-xs tabular-nums" style={ath}>
                                        ATH ₹{h.athNav.toFixed(2)} ↓{h.belowATHPct.toFixed(1)}%
                                      </p>
                                    )}
                                  </>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                {isPlanned ? (
                                  <p className="text-xs font-semibold text-violet-400 tabular-nums">{h.targetAllocationPct.toFixed(1)}%</p>
                                ) : (
                                  <>
                                    <p className="text-xs font-semibold text-[var(--text-primary)] tabular-nums">{h.currentAllocationPct.toFixed(1)}%</p>
                                    <p className="text-xs text-[var(--text-dim)] tabular-nums">{h.targetAllocationPct.toFixed(1)}%</p>
                                  </>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                {isPlanned ? (
                                  <span className="text-xs text-[var(--text-dim)]">—</span>
                                ) : (
                                  <>
                                    <p className="text-xs font-semibold text-[var(--text-primary)] tabular-nums">{formatINR(h.currentValue)}</p>
                                    <p className="text-xs text-[var(--text-dim)] tabular-nums">{formatINR(h.investment)}</p>
                                  </>
                                )}
                              </td>
                              {/* P&L on current holdings */}
                              <td className="py-2.5 px-3 text-right">
                                {isPlanned ? (
                                  <span className="text-xs text-[var(--text-dim)]">—</span>
                                ) : (
                                  <>
                                    <p className={`text-xs font-semibold tabular-nums ${unrealUp ? 'text-emerald-400' : 'text-[var(--accent-rose)]'}`}>
                                      {unrealUp ? '+' : ''}{formatINR(unrealizedPL)}
                                    </p>
                                    <p className={`text-xs font-bold tabular-nums ${unrealUp ? 'text-emerald-400' : 'text-[var(--accent-rose)]'}`}>
                                      {unrealUp ? '+' : ''}{h.plPct.toFixed(1)}%
                                    </p>
                                  </>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile cards */}
                  <div className="lg:hidden divide-y divide-[var(--border-light)]">
                    {enrichedHoldings.map((h) => {
                      const ath = athColor(h.belowATHPct)
                      const portfolio = selectedPortfolioId === 'all' ? portfolioData.find((p) => p.portfolioId === h.portfolioId) : null
                      const isPlanned = h.units === 0
                      const pData = portfolioData.find((p) => p.portfolioId === h.portfolioId)
                      const totalPortfolioValue = pData?.currentValue || 0

                      const unrealizedPL = h.pl
                      const unrealUp = unrealizedPL >= 0

                      const plannedBuy = isPlanned && h.targetAllocationPct > 0 && h.targetAllocationPct < 100 && totalPortfolioValue > 0
                        ? (h.targetAllocationPct / (100 - h.targetAllocationPct)) * totalPortfolioValue : 0
                      const steadySIP = isPlanned && h.targetAllocationPct > 0 && pData?.sipTarget > 0
                        ? (h.targetAllocationPct / 100) * pData.sipTarget : 0

                      return (
                        <div key={h.holdingId} className={`px-4 py-3 ${isPlanned ? 'opacity-60' : ''}`}>
                          <div className="flex items-start justify-between mb-1.5">
                            <div className="flex-1 mr-3">
                              <p className="text-xs font-medium text-[var(--text-primary)] leading-tight">
                                {h.fundName}
                                {isPlanned && <span className="ml-1.5 text-xs font-semibold text-violet-400 bg-violet-500/15 px-1.5 py-0.5 rounded">Planned</span>}
                              </p>
                              {portfolio && <p className="text-xs text-[var(--text-dim)]">{portfolio.portfolioName}</p>}
                              {isPlanned && (plannedBuy > 0 || steadySIP > 0) && (
                                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                  {plannedBuy > 0 && <span className="text-xs text-emerald-400 font-semibold">Buy {formatINR(plannedBuy)}</span>}
                                  {steadySIP > 0 && <span className="text-xs text-blue-400 font-semibold">SIP {formatINR(steadySIP)}/mo</span>}
                                </div>
                              )}
                            </div>
                            {isPlanned ? (
                              <p className="text-xs font-semibold text-violet-400 tabular-nums shrink-0">Target: {h.targetAllocationPct.toFixed(1)}%</p>
                            ) : (
                              <div className="text-right shrink-0">
                                <p className={`text-xs font-bold tabular-nums ${unrealUp ? 'text-emerald-400' : 'text-[var(--accent-rose)]'}`}>
                                  {unrealUp ? '+' : ''}{formatINR(unrealizedPL)}
                                </p>
                                <p className={`text-xs font-semibold tabular-nums ${unrealUp ? 'text-emerald-400' : 'text-[var(--accent-rose)]'}`}>
                                  {unrealUp ? '+' : ''}{h.plPct.toFixed(1)}%
                                </p>
                              </div>
                            )}
                          </div>
                          {isPlanned ? null : (
                            <>
                              <div className="flex items-center justify-between text-xs text-[var(--text-dim)]">
                                <div>
                                  <span>{h.units.toFixed(2)} units</span>
                                  <span className="mx-1">·</span>
                                  <span>NAV ₹{h.currentNav.toFixed(2)} / ₹{h.avgNav.toFixed(2)}</span>
                                </div>
                                <p className="text-xs font-semibold text-[var(--text-primary)] tabular-nums">{formatINR(h.currentValue)}</p>
                              </div>
                              <div className="flex items-center gap-3 mt-1 text-xs text-[var(--text-dim)] flex-wrap">
                                <span>Alloc: {h.currentAllocationPct.toFixed(1)}% / {h.targetAllocationPct.toFixed(1)}%</span>
                                {h.athNav > 0 && h.belowATHPct > 0 && (
                                  <span style={ath}>ATH ↓{h.belowATHPct.toFixed(1)}%</span>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] py-10 flex flex-col items-center gap-3">
                  <Wallet size={28} className="text-[var(--text-dim)]" />
                  <p className="text-sm text-[var(--text-muted)]">No holdings{selectedPortfolio ? ' in this portfolio' : ''}</p>
                  <button onClick={() => setModal({ invest: selectedPortfolioId !== 'all' ? selectedPortfolioId : undefined })} className="text-xs font-semibold text-emerald-400 hover:text-emerald-300">
                    Add your first fund
                  </button>
                </div>
              )}
            </>
          )}

          {/* ── Transactions Tab ── */}
          {subTab === 'transactions' && (
            <>
              {transactions.length > 0 ? (
                <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] overflow-hidden">
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[var(--border-light)] bg-[var(--bg-inset)]">
                          <th className="text-left py-2 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Date</th>
                          <th className="text-left py-2 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Type</th>
                          <th className="text-left py-2 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Fund</th>
                          <th className="text-right py-2 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Units</th>
                          <th className="text-right py-2 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">NAV</th>
                          <th className="text-right py-2 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Amount</th>
                          <th className="text-right py-2 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Gain/Loss</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transactions.map((t) => {
                          const isBuy = t.type === 'BUY'
                          const hasGL = !isBuy && t.gainLoss != null && t.gainLoss !== 0
                          const glUp = hasGL && t.gainLoss >= 0
                          const portfolio = selectedPortfolioId === 'all' ? portfolioData.find((p) => p.portfolioId === t.portfolioId) : null
                          const typeBadge = {
                            INITIAL: { bg: 'bg-purple-500/15', text: 'text-purple-400' },
                            SIP: { bg: 'bg-blue-500/15', text: 'text-blue-400' },
                            LUMPSUM: { bg: 'bg-emerald-500/15', text: 'text-emerald-400' },
                            WITHDRAWAL: { bg: 'bg-rose-500/15', text: 'text-[var(--accent-rose)]' },
                            SWITCH: { bg: 'bg-amber-500/15', text: 'text-amber-400' },
                          }[t.transactionType] || { bg: 'bg-gray-500/15', text: 'text-[var(--text-muted)]' }
                          return (
                            <tr key={t.transactionId} className="border-b border-[var(--border-light)] last:border-0 hover:bg-[var(--bg-hover)] transition-colors">
                              <td className="py-2.5 px-3 text-xs text-[var(--text-secondary)]">{t.date}</td>
                              <td className="py-2.5 px-3">
                                <div className="flex items-center gap-1.5">
                                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isBuy ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-[var(--accent-rose)]'}`}>
                                    {t.type}
                                  </span>
                                  <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${typeBadge.bg} ${typeBadge.text}`}>
                                    {t.transactionType}
                                  </span>
                                </div>
                              </td>
                              <td className="py-2.5 px-3">
                                <p className="text-xs text-[var(--text-primary)] truncate max-w-[200px]">{t.fundName}</p>
                                {portfolio && <p className="text-xs text-[var(--text-dim)]">{portfolio.portfolioName}</p>}
                              </td>
                              <td className="py-2.5 px-3 text-right text-xs text-[var(--text-secondary)] tabular-nums">{t.units.toFixed(2)}</td>
                              <td className="py-2.5 px-3 text-right text-xs text-[var(--text-muted)] tabular-nums">₹{t.price.toFixed(2)}</td>
                              <td className="py-2.5 px-3 text-right text-xs font-semibold text-[var(--text-primary)] tabular-nums">{formatINR(t.totalAmount)}</td>
                              <td className="py-2.5 px-3 text-right">
                                {hasGL ? (
                                  <span className={`text-xs font-semibold tabular-nums ${glUp ? 'text-emerald-400' : 'text-[var(--accent-rose)]'}`}>
                                    {glUp ? '+' : ''}{formatINR(t.gainLoss)}
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

                  {/* Mobile cards */}
                  <div className="sm:hidden divide-y divide-[var(--border-light)]">
                    {transactions.map((t) => {
                      const isBuy = t.type === 'BUY'
                      const hasGL = !isBuy && t.gainLoss != null && t.gainLoss !== 0
                      const glUp = hasGL && t.gainLoss >= 0
                      return (
                        <div key={t.transactionId} className="px-4 py-3">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-1.5">
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isBuy ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-[var(--accent-rose)]'}`}>
                                {t.type}
                              </span>
                              <span className="text-xs font-semibold text-[var(--text-dim)]">{t.transactionType}</span>
                            </div>
                            <p className="text-xs text-[var(--text-dim)]">{t.date}</p>
                          </div>
                          <p className="text-xs text-[var(--text-primary)] truncate mb-1">{t.fundName}</p>
                          <div className="flex items-center justify-between text-xs">
                            <p className="text-[var(--text-dim)]">{t.units.toFixed(2)} units @ ₹{t.price.toFixed(2)}</p>
                            <div className="text-right">
                              <p className="text-xs font-semibold text-[var(--text-primary)] tabular-nums">{formatINR(t.totalAmount)}</p>
                              {hasGL && (
                                <p className={`text-xs font-semibold tabular-nums ${glUp ? 'text-emerald-400' : 'text-[var(--accent-rose)]'}`}>
                                  G/L: {glUp ? '+' : ''}{formatINR(t.gainLoss)}
                                </p>
                              )}
                            </div>
                          </div>
                          {t.notes && <p className="text-xs text-[var(--text-dim)] mt-1">{t.notes}</p>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] py-10 flex flex-col items-center gap-3">
                  <List size={28} className="text-[var(--text-dim)]" />
                  <p className="text-sm text-[var(--text-muted)]">No transactions yet</p>
                  <button onClick={() => setModal({ invest: selectedPortfolioId !== 'all' ? selectedPortfolioId : undefined })} className="text-xs font-semibold text-emerald-400 hover:text-emerald-300">
                    Make your first investment
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Modals */}
      <Modal open={modal === 'addPortfolio' || !!modal?.editPortfolio} onClose={() => setModal(null)} title={modal?.editPortfolio ? 'Edit Portfolio' : 'New MF Portfolio'}>
        <MFPortfolioForm
          initial={modal?.editPortfolio || undefined}
          onSave={handleSavePortfolio}
          onDelete={modal?.editPortfolio ? handleDeletePortfolio : undefined}
          onCancel={() => setModal(null)}
        />
      </Modal>

      <Modal open={!!modal?.invest} onClose={() => setModal(null)} title="Invest in Mutual Fund" wide>
        <MFInvestForm
          portfolioId={typeof modal?.invest === 'string' ? modal.invest : undefined}
          onSave={handleInvest}
          onCancel={() => setModal(null)}
        />
      </Modal>

      <Modal open={!!modal?.redeem} onClose={() => setModal(null)} title="Redeem Mutual Fund" wide>
        <MFRedeemForm
          portfolioId={typeof modal?.redeem === 'string' ? modal.redeem : undefined}
          onSave={handleRedeem}
          onCancel={() => setModal(null)}
        />
      </Modal>

      <Modal open={!!modal?.switchFunds} onClose={() => setModal(null)} title="Switch Funds" wide>
        <MFSwitchForm
          portfolioId={typeof modal?.switchFunds === 'string' ? modal.switchFunds : undefined}
          onSave={handleSwitch}
          onCancel={() => setModal(null)}
        />
      </Modal>

      <Modal open={!!modal?.allocations} onClose={() => setModal(null)} title="Manage Portfolio Allocation" wide>
        {modal?.allocations && (
          <MFAllocationManager
            portfolioId={modal.allocations}
            onSave={handleSaveAllocations}
            onCancel={() => setModal(null)}
          />
        )}
      </Modal>

      <Modal open={modal === 'rebalance'} onClose={() => setModal(null)} title="Rebalance Portfolios" wide>
        {modal === 'rebalance' && <MFRebalanceDialog />}
      </Modal>

      <Modal open={modal === 'buyOpp'} onClose={() => setModal(null)} title="Buy Opportunities" wide>
        {modal === 'buyOpp' && <MFBuyOpportunities />}
      </Modal>
    </div>
  )
}

/* ── Stat Card ── */
function StatCard({ label, value, sub, positive, bold }) {
  return (
    <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] px-4 py-3">
      <p className="text-xs text-[var(--text-dim)] uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-sm tabular-nums ${bold ? 'font-bold' : 'font-semibold'} ${
        positive === undefined ? 'text-[var(--text-primary)]' : positive ? 'text-emerald-400' : 'text-[var(--accent-rose)]'
      }`}>
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
