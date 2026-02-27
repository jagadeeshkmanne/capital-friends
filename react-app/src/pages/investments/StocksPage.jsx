import { useState, useMemo } from 'react'
import { Plus, Pencil, TrendingUp, TrendingDown, BarChart3, List, Layers, ChevronDown } from 'lucide-react'
import { formatINR } from '../../data/familyData'
import { useFamily } from '../../context/FamilyContext'
import { useData } from '../../context/DataContext'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'
import { useMask } from '../../context/MaskContext'
import Modal from '../../components/Modal'
import StockPortfolioForm from '../../components/forms/StockPortfolioForm'
import BuyStockForm from '../../components/forms/BuyStockForm'
import SellStockForm from '../../components/forms/SellStockForm'
import PageLoading from '../../components/PageLoading'

export default function StocksPage() {
  const { selectedMember } = useFamily()
  const {
    stockPortfolios, stockHoldings, stockTransactions,
    activeInvestmentAccounts,
    addStockPortfolio, updateStockPortfolio, deleteStockPortfolio,
    buyStock, sellStock,
  } = useData()

  const { showToast, showBlockUI, hideBlockUI } = useToast()
  const confirm = useConfirm()
  const { mv } = useMask()
  const [modal, setModal] = useState(null)
  const [selectedPortfolioId, setSelectedPortfolioId] = useState('all')
  const [subTab, setSubTab] = useState('holdings')
  const [dropdownOpen, setDropdownOpen] = useState(false)

  // Filter portfolios by member
  const portfolios = useMemo(() => {
    if (!stockPortfolios) return []
    const active = stockPortfolios.filter((p) => p.status !== 'Inactive')
    return selectedMember === 'all' ? active : active.filter((p) => p.ownerId === selectedMember)
  }, [stockPortfolios, selectedMember])

  // Per-portfolio computed data
  const portfolioData = useMemo(() => {
    if (!stockHoldings) return []
    return portfolios.map((p) => {
      const holdings = stockHoldings.filter((h) => h.portfolioId === p.portfolioId)
      const txns = (stockTransactions || []).filter((t) => t.portfolioId === p.portfolioId)
      const invested = holdings.reduce((s, h) => s + h.totalInvestment, 0)
      const current = holdings.reduce((s, h) => s + h.currentValue, 0)
      const unrealizedPL = current - invested
      const realizedPL = txns.filter((t) => t.type === 'SELL' && t.realizedPL != null).reduce((s, t) => s + t.realizedPL, 0)
      const totalPL = unrealizedPL + realizedPL
      const totalPLPct = invested > 0 ? (totalPL / invested) * 100 : 0
      const account = activeInvestmentAccounts.find((a) => a.accountId === p.investmentAccountId)
      return {
        ...p, holdings, txns, invested, current, unrealizedPL, realizedPL, totalPL, totalPLPct,
        stockCount: holdings.length,
        platform: account?.platformBroker || p.investmentAccountName || '—',
        clientId: account?.accountClientId || '—',
      }
    })
  }, [portfolios, stockHoldings, stockTransactions, activeInvestmentAccounts])

  // Stats for selected view (all or single portfolio)
  const stats = useMemo(() => {
    const source = selectedPortfolioId === 'all' ? portfolioData : portfolioData.filter((p) => p.portfolioId === selectedPortfolioId)
    const invested = source.reduce((s, p) => s + p.invested, 0)
    const current = source.reduce((s, p) => s + p.current, 0)
    const unrealizedPL = source.reduce((s, p) => s + p.unrealizedPL, 0)
    const realizedPL = source.reduce((s, p) => s + p.realizedPL, 0)
    const totalPL = unrealizedPL + realizedPL
    const totalPLPct = invested > 0 ? (totalPL / invested) * 100 : 0
    const unrealizedPLPct = invested > 0 ? (unrealizedPL / invested) * 100 : 0
    const stocks = source.reduce((s, p) => s + p.stockCount, 0)
    return { invested, current, unrealizedPL, unrealizedPLPct, realizedPL, totalPL, totalPLPct, stocks }
  }, [portfolioData, selectedPortfolioId])

  // Holdings & transactions for selected view
  const holdings = useMemo(() => {
    if (!stockHoldings) return []
    if (selectedPortfolioId === 'all') return stockHoldings.filter((h) => portfolios.some((p) => p.portfolioId === h.portfolioId))
    return stockHoldings.filter((h) => h.portfolioId === selectedPortfolioId)
  }, [stockHoldings, portfolios, selectedPortfolioId])

  const transactions = useMemo(() => {
    if (!stockTransactions) return []
    const txns = selectedPortfolioId === 'all'
      ? stockTransactions.filter((t) => portfolios.some((p) => p.portfolioId === t.portfolioId))
      : stockTransactions.filter((t) => t.portfolioId === selectedPortfolioId)
    return txns.sort((a, b) => new Date(b.date) - new Date(a.date))
  }, [stockTransactions, portfolios, selectedPortfolioId])

  // Loading state — after all hooks
  if (stockPortfolios === null || stockHoldings === null) return <PageLoading title="Loading stocks" cards={5} />

  // Currently selected portfolio object (for edit)
  const selectedPortfolio = portfolioData.find((p) => p.portfolioId === selectedPortfolioId)

  // Dropdown label
  const dropdownLabel = selectedPortfolioId === 'all'
    ? `All Portfolios (${portfolios.length})`
    : `${selectedPortfolio?.portfolioName} — ${mv(selectedPortfolio?.ownerName, 'name')}`

  // Handlers
  async function handleSavePortfolio(data) {
    showBlockUI('Saving...')
    try {
      if (modal?.editPortfolio) await updateStockPortfolio(modal.editPortfolio.portfolioId, data)
      else await addStockPortfolio(data)
      showToast(modal?.editPortfolio ? 'Portfolio updated' : 'Portfolio created')
      setModal(null)
    } catch (err) {
      showToast(err.message || 'Failed to save portfolio', 'error')
    } finally {
      hideBlockUI()
    }
  }

  async function handleDeletePortfolio() {
    if (modal?.editPortfolio && await confirm('Deactivate this portfolio?', { title: 'Deactivate Portfolio', confirmLabel: 'Deactivate' })) {
      showBlockUI('Deactivating...')
      try {
        await deleteStockPortfolio(modal.editPortfolio.portfolioId)
        showToast('Portfolio deactivated')
        setSelectedPortfolioId('all')
        setModal(null)
      } catch (err) {
        showToast(err.message || 'Failed to deactivate portfolio', 'error')
      } finally {
        hideBlockUI()
      }
    }
  }

  async function handleBuy(data) {
    showBlockUI('Recording purchase...')
    try {
      await buyStock(data)
      showToast('Stock purchase recorded')
      setModal(null)
    } catch (err) {
      showToast(err.message || 'Failed to record purchase', 'error')
    } finally {
      hideBlockUI()
    }
  }

  async function handleSell(data) {
    showBlockUI('Recording sale...')
    try {
      await sellStock(data)
      showToast('Stock sale recorded')
      setModal(null)
    } catch (err) {
      showToast(err.message || 'Failed to record sale', 'error')
    } finally {
      hideBlockUI()
    }
  }

  return (
    <div className="space-y-4">
      {portfolios.length === 0 ? (
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] py-12 flex flex-col items-center gap-3">
          <BarChart3 size={32} className="text-[var(--text-dim)]" />
          <p className="text-sm text-[var(--text-muted)]">No stock portfolios yet</p>
          <button onClick={() => setModal('addPortfolio')} className="text-xs font-semibold text-violet-400 hover:text-violet-300">
            Create your first portfolio
          </button>
        </div>
      ) : (
        <>
          {/* ── Top Bar: Portfolio Selector + Actions ── */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            {/* Portfolio dropdown */}
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg px-4 py-2.5 text-sm font-semibold text-[var(--text-primary)] hover:border-[var(--border-light)] transition-colors min-w-[220px]"
              >
                <BarChart3 size={14} className="text-violet-400 shrink-0" />
                <span className="truncate">{dropdownLabel}</span>
                <ChevronDown size={14} className={`text-[var(--text-dim)] shrink-0 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {dropdownOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setDropdownOpen(false)} />
                  <div className="absolute left-0 top-full mt-1 z-40 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg shadow-xl min-w-[280px] py-1 overflow-hidden">
                    <button
                      onClick={() => { setSelectedPortfolioId('all'); setDropdownOpen(false); setSubTab('holdings') }}
                      className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${selectedPortfolioId === 'all' ? 'bg-[var(--sidebar-active-bg)] text-[var(--text-primary)] font-semibold' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'}`}
                    >
                      All Portfolios ({portfolios.length})
                    </button>
                    <div className="border-t border-[var(--border-light)]" />
                    {portfolioData.map((p) => {
                      const plUp = p.totalPL >= 0
                      return (
                        <button
                          key={p.portfolioId}
                          onClick={() => { setSelectedPortfolioId(p.portfolioId); setDropdownOpen(false); setSubTab('holdings') }}
                          className={`w-full text-left px-4 py-2.5 transition-colors ${selectedPortfolioId === p.portfolioId ? 'bg-[var(--sidebar-active-bg)]' : 'hover:bg-[var(--bg-hover)]'}`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className={`text-sm ${selectedPortfolioId === p.portfolioId ? 'font-semibold text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                                {p.portfolioName}
                              </p>
                              <p className="text-xs text-[var(--text-dim)]">{mv(p.ownerName, 'name')} · {p.platform}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs font-semibold text-[var(--text-primary)] tabular-nums">{formatINR(p.current)}</p>
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

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              {selectedPortfolio && (
                <button
                  onClick={() => setModal({ editPortfolio: selectedPortfolio })}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-[var(--bg-card)] border border-[var(--border)] rounded-lg transition-colors"
                >
                  <Pencil size={12} /> Edit
                </button>
              )}
              <button
                onClick={() => setModal('addPortfolio')}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-violet-400 hover:text-violet-300 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg transition-colors"
              >
                <Plus size={14} /> New Portfolio
              </button>
            </div>
          </div>

          {/* ── Portfolio Info (shown when specific portfolio selected) ── */}
          {selectedPortfolio && (
            <div className="flex items-center gap-4 text-xs text-[var(--text-dim)] px-1">
              <span><span className="font-semibold">Platform:</span> {selectedPortfolio.platform}</span>
              <span><span className="font-semibold">Client ID:</span> {mv(selectedPortfolio.clientId, 'clientId')}</span>
              <span><span className="font-semibold">Stocks:</span> {selectedPortfolio.stockCount}</span>
            </div>
          )}

          {/* ── Stat Cards ── */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
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
              positive={stats.realizedPL >= 0}
            />
            <StatCard
              label="Total P&L"
              value={`${stats.totalPL >= 0 ? '+' : ''}${formatINR(stats.totalPL)}`}
              sub={`${stats.totalPLPct >= 0 ? '+' : ''}${stats.totalPLPct.toFixed(1)}%`}
              positive={stats.totalPL >= 0}
              bold
            />
          </div>

          {/* ── Sub-tabs + Buy/Sell ── */}
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
              <button
                onClick={() => selectedPortfolioId !== 'all' && setModal({ buy: selectedPortfolioId })}
                disabled={selectedPortfolioId === 'all'}
                className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-colors shadow-sm ${selectedPortfolioId === 'all' ? 'bg-emerald-600/40 text-white/50 cursor-not-allowed' : 'text-white bg-emerald-600 hover:bg-emerald-500'}`}
                title={selectedPortfolioId === 'all' ? 'Select a portfolio first' : ''}
              >
                <TrendingUp size={14} /> Buy
              </button>
              <button
                onClick={() => selectedPortfolioId !== 'all' && holdings.length > 0 && setModal({ sell: selectedPortfolioId })}
                disabled={selectedPortfolioId === 'all' || holdings.length === 0}
                className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-colors shadow-sm ${selectedPortfolioId === 'all' || holdings.length === 0 ? 'bg-rose-600/40 text-white/50 cursor-not-allowed' : 'text-white bg-rose-600 hover:bg-rose-500'}`}
                title={selectedPortfolioId === 'all' ? 'Select a portfolio first' : ''}
              >
                <TrendingDown size={14} /> Sell
              </button>
            </div>
          </div>

          {/* ── Holdings Tab ── */}
          {subTab === 'holdings' && (
            <>
              {holdings.length > 0 ? (
                <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] overflow-hidden">
                  {/* Desktop table */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[var(--border-light)] bg-[var(--bg-inset)]">
                          <th className="text-left py-2 px-4 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Stock</th>
                          <th className="text-right py-2 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Qty</th>
                          <th className="text-right py-2 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Avg Price</th>
                          <th className="text-right py-2 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Current Price</th>
                          <th className="text-right py-2 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Invested</th>
                          <th className="text-right py-2 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Current Value</th>
                          <th className="text-right py-2 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">P&L</th>
                          <th className="text-right py-2 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Returns</th>
                        </tr>
                      </thead>
                      <tbody>
                        {holdings.map((h) => {
                          const up = h.unrealizedPL >= 0
                          const portfolio = selectedPortfolioId === 'all' ? portfolioData.find((p) => p.portfolioId === h.portfolioId) : null
                          return (
                            <tr key={h.holdingId} className="border-b border-[var(--border-light)] last:border-0 hover:bg-[var(--bg-hover)] transition-colors">
                              <td className="py-2.5 px-4">
                                <p className="text-xs font-medium text-[var(--text-primary)]">{h.companyName}</p>
                                <p className="text-xs font-mono text-[var(--text-dim)]">
                                  {h.symbol}
                                  {portfolio && <span className="ml-1.5 text-[var(--text-dim)] font-sans">· {portfolio.portfolioName}</span>}
                                </p>
                              </td>
                              <td className="py-2.5 px-3 text-right text-xs text-[var(--text-secondary)] tabular-nums">{h.quantity}</td>
                              <td className="py-2.5 px-3 text-right text-xs text-[var(--text-muted)] tabular-nums">{formatINR(h.avgBuyPrice)}</td>
                              <td className="py-2.5 px-3 text-right text-xs font-semibold text-[var(--text-primary)] tabular-nums">{formatINR(h.currentPrice)}</td>
                              <td className="py-2.5 px-3 text-right text-xs text-[var(--text-secondary)] tabular-nums">{formatINR(h.totalInvestment)}</td>
                              <td className="py-2.5 px-3 text-right text-xs font-semibold text-[var(--text-primary)] tabular-nums">{formatINR(h.currentValue)}</td>
                              <td className={`py-2.5 px-3 text-right text-xs font-semibold tabular-nums ${up ? 'text-emerald-400' : 'text-[var(--accent-rose)]'}`}>
                                {up ? '+' : ''}{formatINR(h.unrealizedPL)}
                              </td>
                              <td className={`py-2.5 px-3 text-right text-xs font-bold tabular-nums ${up ? 'text-emerald-400' : 'text-[var(--accent-rose)]'}`}>
                                {up ? '+' : ''}{h.unrealizedPLPct.toFixed(1)}%
                              </td>
                            </tr>
                          )
                        })}
                        {/* Totals */}
                        <tr className="bg-[var(--bg-inset)] border-t-2 border-[var(--border-light)]">
                          <td className="py-2.5 px-4 text-xs font-semibold text-[var(--text-muted)]">
                            Total ({holdings.length} stocks)
                          </td>
                          <td colSpan={3} className="py-2.5 px-3" />
                          <td className="py-2.5 px-3 text-right text-xs font-semibold text-[var(--text-primary)] tabular-nums">{formatINR(stats.invested)}</td>
                          <td className="py-2.5 px-3 text-right text-xs font-semibold text-[var(--text-primary)] tabular-nums">{formatINR(stats.current)}</td>
                          <td className={`py-2.5 px-3 text-right text-xs font-semibold tabular-nums ${stats.unrealizedPL >= 0 ? 'text-emerald-400' : 'text-[var(--accent-rose)]'}`}>
                            {stats.unrealizedPL >= 0 ? '+' : ''}{formatINR(stats.unrealizedPL)}
                          </td>
                          <td className={`py-2.5 px-3 text-right text-xs font-bold tabular-nums ${stats.unrealizedPL >= 0 ? 'text-emerald-400' : 'text-[var(--accent-rose)]'}`}>
                            {stats.unrealizedPLPct >= 0 ? '+' : ''}{stats.unrealizedPLPct.toFixed(1)}%
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile cards */}
                  <div className="sm:hidden divide-y divide-[var(--border-light)]">
                    {holdings.map((h) => {
                      const up = h.unrealizedPL >= 0
                      const portfolio = selectedPortfolioId === 'all' ? portfolioData.find((p) => p.portfolioId === h.portfolioId) : null
                      return (
                        <div key={h.holdingId} className="px-4 py-3">
                          <div className="flex items-center justify-between mb-1.5">
                            <div>
                              <p className="text-xs font-medium text-[var(--text-primary)]">{h.companyName}</p>
                              <p className="text-xs font-mono text-[var(--text-dim)]">
                                {h.symbol}
                                {portfolio && <span className="ml-1 font-sans">· {portfolio.portfolioName}</span>}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className={`text-xs font-bold tabular-nums ${up ? 'text-emerald-400' : 'text-[var(--accent-rose)]'}`}>
                                {up ? '+' : ''}{h.unrealizedPLPct.toFixed(1)}%
                              </p>
                              <p className={`text-xs font-semibold tabular-nums ${up ? 'text-emerald-400' : 'text-[var(--accent-rose)]'}`}>
                                {up ? '+' : ''}{formatINR(h.unrealizedPL)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <div className="text-[var(--text-dim)]">
                              <span>{h.quantity} shares</span>
                              <span className="mx-1">·</span>
                              <span>Avg {formatINR(h.avgBuyPrice)}</span>
                              <span className="mx-1">·</span>
                              <span>CMP {formatINR(h.currentPrice)}</span>
                            </div>
                            <p className="text-xs font-semibold text-[var(--text-primary)] tabular-nums">{formatINR(h.currentValue)}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] py-10 flex flex-col items-center gap-3">
                  <BarChart3 size={28} className="text-[var(--text-dim)]" />
                  <p className="text-sm text-[var(--text-muted)]">No holdings{selectedPortfolio ? ' in this portfolio' : ''}</p>
                  <button onClick={() => setModal({ buy: selectedPortfolioId !== 'all' ? selectedPortfolioId : undefined })} className="text-xs font-semibold text-emerald-400 hover:text-emerald-300">
                    Buy your first stock
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
                  {/* Desktop table */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[var(--border-light)] bg-[var(--bg-inset)]">
                          <th className="text-left py-2 px-4 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Date</th>
                          <th className="text-left py-2 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Type</th>
                          <th className="text-left py-2 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Stock</th>
                          <th className="text-right py-2 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Qty</th>
                          <th className="text-right py-2 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Price</th>
                          <th className="text-right py-2 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Amount</th>
                          <th className="text-right py-2 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Brokerage</th>
                          <th className="text-right py-2 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Net</th>
                          <th className="text-right py-2 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Realized P&L</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transactions.map((t) => {
                          const isBuy = t.type === 'BUY'
                          const hasRPL = !isBuy && t.realizedPL != null
                          const rplUp = hasRPL && t.realizedPL >= 0
                          const portfolio = selectedPortfolioId === 'all' ? portfolioData.find((p) => p.portfolioId === t.portfolioId) : null
                          return (
                            <tr key={t.transactionId} className="border-b border-[var(--border-light)] last:border-0 hover:bg-[var(--bg-hover)] transition-colors">
                              <td className="py-2.5 px-4 text-xs text-[var(--text-secondary)]">{t.date}</td>
                              <td className="py-2.5 px-3">
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isBuy ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-[var(--accent-rose)]'}`}>
                                  {t.type}
                                </span>
                              </td>
                              <td className="py-2.5 px-3">
                                <p className="text-xs font-medium text-[var(--text-primary)]">{t.symbol}</p>
                                <p className="text-xs text-[var(--text-dim)] truncate max-w-[140px]">
                                  {t.companyName}
                                  {portfolio && <span> · {portfolio.portfolioName}</span>}
                                </p>
                              </td>
                              <td className="py-2.5 px-3 text-right text-xs text-[var(--text-secondary)] tabular-nums">{t.quantity}</td>
                              <td className="py-2.5 px-3 text-right text-xs text-[var(--text-muted)] tabular-nums">{formatINR(t.pricePerShare)}</td>
                              <td className="py-2.5 px-3 text-right text-xs text-[var(--text-secondary)] tabular-nums">{formatINR(t.totalAmount)}</td>
                              <td className="py-2.5 px-3 text-right text-xs text-[var(--text-dim)] tabular-nums">{t.brokerage > 0 ? formatINR(t.brokerage) : '—'}</td>
                              <td className="py-2.5 px-3 text-right text-xs font-semibold text-[var(--text-primary)] tabular-nums">{formatINR(t.netAmount)}</td>
                              <td className="py-2.5 px-3 text-right">
                                {hasRPL ? (
                                  <span className={`text-xs font-semibold tabular-nums ${rplUp ? 'text-emerald-400' : 'text-[var(--accent-rose)]'}`}>
                                    {rplUp ? '+' : ''}{formatINR(t.realizedPL)}
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
                      const hasRPL = !isBuy && t.realizedPL != null
                      const rplUp = hasRPL && t.realizedPL >= 0
                      return (
                        <div key={t.transactionId} className="px-4 py-3">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isBuy ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-[var(--accent-rose)]'}`}>
                                {t.type}
                              </span>
                              <p className="text-xs font-semibold text-[var(--text-primary)]">{t.symbol}</p>
                            </div>
                            <p className="text-xs text-[var(--text-dim)]">{t.date}</p>
                          </div>
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-[var(--text-dim)]">{t.quantity} shares @ {formatINR(t.pricePerShare)}</p>
                            <div className="text-right">
                              <p className="text-xs font-semibold text-[var(--text-primary)] tabular-nums">{formatINR(t.netAmount)}</p>
                              {hasRPL && (
                                <p className={`text-xs font-semibold tabular-nums ${rplUp ? 'text-emerald-400' : 'text-[var(--accent-rose)]'}`}>
                                  P&L: {rplUp ? '+' : ''}{formatINR(t.realizedPL)}
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
                  <button onClick={() => setModal({ buy: selectedPortfolioId !== 'all' ? selectedPortfolioId : undefined })} className="text-xs font-semibold text-emerald-400 hover:text-emerald-300">
                    Make your first purchase
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Modals */}
      <Modal open={modal === 'addPortfolio' || !!modal?.editPortfolio} onClose={() => setModal(null)} title={modal?.editPortfolio ? 'Edit Portfolio' : 'New Stock Portfolio'}>
        <StockPortfolioForm
          initial={modal?.editPortfolio || undefined}
          onSave={handleSavePortfolio}
          onDelete={modal?.editPortfolio ? handleDeletePortfolio : undefined}
          onCancel={() => setModal(null)}
        />
      </Modal>

      <Modal open={!!modal?.buy} onClose={() => setModal(null)} title="Buy Stock" wide>
        <BuyStockForm
          portfolioId={typeof modal?.buy === 'string' ? modal.buy : undefined}
          onSave={handleBuy}
          onCancel={() => setModal(null)}
        />
      </Modal>

      <Modal open={!!modal?.sell} onClose={() => setModal(null)} title="Sell Stock" wide>
        <SellStockForm
          portfolioId={typeof modal?.sell === 'string' ? modal.sell : undefined}
          onSave={handleSell}
          onCancel={() => setModal(null)}
        />
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
