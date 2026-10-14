import PhoneSummary from '../../components/PhoneSummary'
import { lazy, Suspense } from 'react'
import { useIsPhone } from '../../components/native'
const StocksPhone = lazy(() => import('./StocksPhone'))
import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  Plus, Pencil, TrendingUp, TrendingDown, BarChart3, List, Layers, ChevronDown, MoreVertical, Trash2,
  RefreshCw, X, Check, Loader2, Upload, FileText, FileSpreadsheet
} from 'lucide-react'
import { formatINR } from '../../data/familyData'
import { useFamily } from '../../context/FamilyContext'
import { useData } from '../../context/DataContext'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'
import { useMask } from '../../context/MaskContext'
import Modal, { FormDateInput } from '../../components/Modal'
import StockPortfolioForm from '../../components/forms/StockPortfolioForm'
import BuyStockForm from '../../components/forms/BuyStockForm'
import ImportStocksForm from '../../components/forms/ImportStocksForm'
import ImportDematForm from '../../components/forms/ImportDematForm'
import SellStockForm from '../../components/forms/SellStockForm'
import EditStockTxnForm from '../../components/forms/EditStockTxnForm'
import PageLoading from '../../components/PageLoading'
import * as api from '../../services/api'

export default function StocksPage() {
  const { selectedMember } = useFamily()
  const {
    stockPortfolios, stockHoldings, stockTransactions,
    activeInvestmentAccounts, activeMembers,
    addStockPortfolio, updateStockPortfolio, deleteStockPortfolio,
    buyStock, importStocks, sellStock, editStockTransaction, deleteStockTransaction,
    refreshStocks,
  } = useData()

  const { showToast, showBlockUI, hideBlockUI } = useToast()
  const confirm = useConfirm()
  const { mv } = useMask()
  const isPhone = useIsPhone()
  const [modal, setModal] = useState(null)
  const [selectedPortfolioId, setSelectedPortfolioId] = useState('all')
  const [subTab, setSubTab] = useState('holdings')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [txnMenuOpen, setTxnMenuOpen] = useState(null)
  const [importMenu, setImportMenu] = useState(false)

  // Filter portfolios by member + enrich ownerName
  const portfolios = useMemo(() => {
    if (!stockPortfolios) return []
    const active = stockPortfolios.filter((p) => p.status !== 'Inactive').map((p) => {
      const member = p.ownerId ? activeMembers.find((m) => m.memberId === p.ownerId) : null
      return { ...p, ownerName: member?.memberName || p.ownerName || '' }
    })
    return selectedMember === 'all' ? active : active.filter((p) => p.ownerId === selectedMember)
  }, [stockPortfolios, selectedMember, activeMembers])

  // Per-portfolio computed data
  const portfolioData = useMemo(() => {
    if (!stockHoldings) return []
    return portfolios.map((p) => {
      const holdings = stockHoldings.filter((h) => h.portfolioId === p.portfolioId)
      const txns = (stockTransactions || []).filter((t) => t.portfolioId === p.portfolioId)
      const invested = holdings.reduce((s, h) => s + (Number(h.totalInvestment) > 1 ? Number(h.totalInvestment) : Number(h.currentValue)), 0)
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

  // Current price lookup for unrealized P&L on BUY transactions
  const currentPriceMap = useMemo(() => {
    if (!holdings) return {}
    const map = {}
    holdings.forEach((h) => { if (h.currentPrice > 0) map[`${h.portfolioId}:${h.symbol}`] = h.currentPrice })
    return map
  }, [holdings])

  // Loading state — after all hooks
  if (stockPortfolios === null || stockHoldings === null) return <PageLoading title="Loading stocks" cards={5} />

  // Currently selected portfolio object (for edit)
  const selectedPortfolio = portfolioData.find((p) => p.portfolioId === selectedPortfolioId)

  // Dropdown label
  const dropdownLabel = selectedPortfolioId === 'all'
    ? `All Portfolios (${portfolios.length})`
    : selectedPortfolio?.ownerName ? `${selectedPortfolio?.portfolioName} — ${mv(selectedPortfolio?.ownerName, 'name')}` : selectedPortfolio?.portfolioName

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

  async function handleDeleteTransaction(transactionId) {
    if (!await confirm('Delete this transaction? This will recalculate your holdings.', { title: 'Delete Transaction', confirmLabel: 'Delete' })) return
    showBlockUI('Deleting...')
    try {
      await deleteStockTransaction(transactionId)
      showToast('Transaction deleted')
      setTxnMenuOpen(null)
    } catch (err) {
      showToast(err.message || 'Failed to delete transaction', 'error')
    } finally {
      hideBlockUI()
    }
  }

  // Testing clean-up: every stock portfolio, transaction and holding of this family (cannot be undone)
  async function handleDeleteAll() {
    setImportMenu(false)
    const n = (stockPortfolios || []).length
    if (!await confirm(`This permanently deletes ALL stock data of your family: ${n} portfolio${n === 1 ? '' : 's'}, every stock holding and transaction, and links from goals to stock portfolios. Mutual funds and everything else stay. This cannot be undone.`, { title: 'Delete all stocks?', confirmLabel: 'Delete everything' })) return
    if (!await confirm('Really delete all stocks? There is no undo.', { title: 'Last check', confirmLabel: 'Yes, delete all stocks' })) return
    showBlockUI('Deleting all stocks...')
    try {
      await api.deleteAllStocks()
      await refreshStocks()
      setSelectedPortfolioId('all')
      showToast('All stocks deleted')
    } catch (err) {
      showToast(err.message || 'Failed to delete stocks', 'error')
    } finally {
      hideBlockUI()
    }
  }

  const importMenuEl = (
    <div className="relative">
      <button
        onClick={() => setImportMenu((o) => !o)}
        className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg transition-colors border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
      >
        <Upload size={14} /> Import <ChevronDown size={12} className={importMenu ? 'rotate-180' : ''} />
      </button>
      {importMenu && (<>
        <div className="fixed inset-0 z-40" onClick={() => setImportMenu(false)} />
        <div className="absolute right-0 top-full mt-1 z-50 w-72 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg shadow-xl py-1">
          <button onClick={() => { setImportMenu(false); setModal({ importFile: selectedPortfolioId !== 'all' ? selectedPortfolioId : '' }) }} className="w-full text-left px-3 py-2.5 hover:bg-[var(--bg-hover)] flex gap-2.5">
            <FileSpreadsheet size={15} className="text-emerald-400 shrink-0 mt-0.5" />
            <span><span className="block text-xs font-semibold text-[var(--text-primary)]">Broker file (Excel / CSV)</span><span className="block text-xs text-[var(--text-dim)]">Zerodha, Groww… holdings, or our template (India + US)</span></span>
          </button>
          <button onClick={() => { setImportMenu(false); setModal({ importDemat: true }) }} className="w-full text-left px-3 py-2.5 hover:bg-[var(--bg-hover)] flex gap-2.5">
            <FileText size={15} className="text-sky-400 shrink-0 mt-0.5" />
            <span><span className="block text-xs font-semibold text-[var(--text-primary)]">CDSL / NSDL statement (PDF)</span><span className="block text-xs text-[var(--text-dim)]">All demat accounts of a PAN; makes the portfolios for you</span></span>
          </button>
          {(stockPortfolios || []).length > 0 && (<>
            <div className="my-1 border-t border-[var(--border-light)]" />
            <button onClick={handleDeleteAll} className="w-full text-left px-3 py-2 hover:bg-rose-500/10 flex items-center gap-2.5 text-xs font-semibold text-[var(--accent-rose)]">
              <Trash2 size={14} className="shrink-0" /> Delete all stocks…
            </button>
          </>)}
        </div>
      </>)}
    </div>
  )

  async function handleEditTransaction(data) {
    showBlockUI('Updating...')
    try {
      await editStockTransaction(data)
      showToast('Transaction updated')
      setModal(null)
    } catch (err) {
      showToast(err.message || 'Failed to update transaction', 'error')
    } finally {
      hideBlockUI()
    }
  }

  const modals = (<>
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

      <Modal open={!!modal && typeof modal === 'object' && 'importFile' in modal} onClose={() => setModal(null)} title="Import Stocks from Excel / CSV" wide>
        {modal && typeof modal === 'object' && 'importFile' in modal && (
          <ImportStocksForm
            portfolioId={modal.importFile || undefined}
            onImport={(data) => importStocks(data)}
            onCancel={() => setModal(null)}
          />
        )}
      </Modal>

      <Modal open={!!modal?.importDemat} onClose={() => setModal(null)} title="Import shares from a CDSL / NSDL statement" wide>
        {modal?.importDemat && <ImportDematForm onCancel={() => setModal(null)} />}
      </Modal>

      <Modal open={!!modal?.sell} onClose={() => setModal(null)} title="Sell Stock" wide>
        <SellStockForm
          portfolioId={typeof modal?.sell === 'string' ? modal.sell : undefined}
          onSave={handleSell}
          onCancel={() => setModal(null)}
        />
      </Modal>

      <Modal open={!!modal?.editTxn} onClose={() => setModal(null)} title="Edit Transaction">
        {modal?.editTxn && (
          <EditStockTxnForm
            txn={modal.editTxn}
            onSave={handleEditTransaction}
            onCancel={() => setModal(null)}
          />
        )}
      </Modal>

  </>)
  if (isPhone) return (<>
    <Suspense fallback={null}><StocksPhone portfolioData={portfolioData} allHoldings={(stockHoldings || []).filter((h) => portfolios.some((p) => p.portfolioId === h.portfolioId))}
      allTxns={(stockTransactions || []).filter((t) => portfolios.some((p) => p.portfolioId === t.portfolioId)).sort((a, b) => new Date(b.date) - new Date(a.date))} setModal={setModal} mv={mv} onDeleteTxn={handleDeleteTransaction} /></Suspense>
    {modals}
  </>)
  return (
    <div className="space-y-4">
      {portfolios.length === 0 ? (
        <div className="space-y-4">
          <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] py-12 flex flex-col items-center gap-3">
            <BarChart3 size={32} className="text-[var(--text-dim)]" />
            <p className="text-sm text-[var(--text-muted)]">No stock portfolios yet</p>
            <button onClick={() => setModal('addPortfolio')} className="text-xs font-semibold text-violet-400 hover:text-violet-300">
              Create your first portfolio
            </button>
            <p className="text-xs text-[var(--text-dim)]">or</p>
            {importMenuEl}
          </div>
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
            <div className="flex items-center gap-4 text-xs text-[var(--text-dim)] px-1 flex-wrap">
              <span><span className="font-semibold">Platform:</span> {selectedPortfolio.platform}</span>
              <span><span className="font-semibold">Client ID:</span> {mv(selectedPortfolio.clientId, 'clientId')}</span>
              <span><span className="font-semibold">Stocks:</span> {selectedPortfolio.stockCount}</span>
            </div>
          )}

          {/* ── Stat Cards (phones: one summary card) ── */}
          <PhoneSummary label={`Stocks (${holdings.length})`} value={formatINR(stats.current)} rows={[
            { k: 'Total returns', v: `${stats.totalPL >= 0 ? '+' : ''}${formatINR(stats.totalPL)} (${stats.totalPLPct >= 0 ? '+' : ''}${stats.totalPLPct.toFixed(1)}%)`, cls: stats.totalPL >= 0 ? 'text-emerald-400' : 'text-rose-400' },
            { k: 'Invested', v: formatINR(stats.invested) },
            { k: 'Unrealised P&L', v: `${stats.unrealizedPL >= 0 ? '+' : ''}${formatINR(stats.unrealizedPL)} (${stats.unrealizedPLPct >= 0 ? '+' : ''}${stats.unrealizedPLPct.toFixed(1)}%)`, cls: stats.unrealizedPL >= 0 ? 'text-emerald-400' : 'text-rose-400' },
            { k: 'Realised P&L', v: `${stats.realizedPL >= 0 ? '+' : ''}${formatINR(stats.realizedPL)}`, cls: stats.realizedPL >= 0 ? 'text-emerald-400' : 'text-rose-400' },
          ]} />
          <div className="cf-stats max-lg:hidden grid grid-cols-2 sm:grid-cols-5 gap-3">
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
              {/* Signals tab temporarily disabled */}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => selectedPortfolioId !== 'all' && setModal({ buy: selectedPortfolioId })}
                disabled={selectedPortfolioId === 'all'}
                className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-colors shadow-sm ${selectedPortfolioId === 'all' ? 'bg-[var(--bg-inset)] text-[var(--text-dim)] border border-[var(--border-light)] cursor-not-allowed' : 'text-white bg-emerald-600 hover:bg-emerald-500'}`}
                title={selectedPortfolioId === 'all' ? 'Select a portfolio first' : ''}
              >
                <TrendingUp size={14} /> Buy
              </button>
              <button
                onClick={() => selectedPortfolioId !== 'all' && holdings.length > 0 && setModal({ sell: selectedPortfolioId })}
                disabled={selectedPortfolioId === 'all' || holdings.length === 0}
                className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-colors shadow-sm ${selectedPortfolioId === 'all' || holdings.length === 0 ? 'bg-[var(--bg-inset)] text-[var(--text-dim)] border border-[var(--border-light)] cursor-not-allowed' : 'text-white bg-rose-600 hover:bg-rose-500'}`}
                title={selectedPortfolioId === 'all' ? 'Select a portfolio first' : ''}
              >
                <TrendingDown size={14} /> Sell
              </button>
              {importMenuEl}
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
                            <tr key={`${h.portfolioId}-${h.symbol}`} className="border-b border-[var(--border-light)] last:border-0 hover:bg-[var(--bg-hover)] transition-colors">
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
                  <div className="sm:hidden divide-y divide-[var(--row-divider)]">
                    {holdings.map((h) => {
                      const up = h.unrealizedPL >= 0
                      const portfolio = selectedPortfolioId === 'all' ? portfolioData.find((p) => p.portfolioId === h.portfolioId) : null
                      return (
                        <div key={`${h.portfolioId}-${h.symbol}`} className="px-4 py-3.5">
                          {/* Groww-style row: company and shares on the left, value and return on the right */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-[15px] font-semibold leading-snug text-[var(--text-primary)]">{h.companyName}</p>
                              <p className="mt-0.5 text-[13px] text-[var(--text-dim)] tabular-nums">{h.quantity} shares · Avg {formatINR(h.avgBuyPrice)}</p>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="text-[15px] font-semibold tabular-nums text-[var(--text-primary)]">{formatINR(h.currentValue)}</p>
                              <p className={`mt-0.5 text-[13px] font-medium tabular-nums ${up ? 'text-emerald-400' : 'text-[var(--accent-rose)]'}`}>{up ? '+' : ''}{formatINR(h.unrealizedPL)} ({up ? '+' : ''}{h.unrealizedPLPct.toFixed(1)}%)</p>
                            </div>
                          </div>
                          <p className="mt-1.5 text-[12.5px] text-[var(--text-dim)] tabular-nums"><span className="font-mono">{h.symbol}</span> · CMP {formatINR(h.currentPrice)}{portfolio ? ` · ${portfolio.portfolioName}` : ''}</p>
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
                          <th className="text-right py-2 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">P&L</th>
                          <th className="w-8 py-2 px-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {transactions.map((t) => {
                          const isBuy = t.type === 'BUY'
                          const curPrice = currentPriceMap[`${t.portfolioId}:${t.symbol}`]
                          const hasRPL = !isBuy && t.realizedPL != null
                          const hasUPL = isBuy && curPrice > 0 && t.pricePerShare > 0 && t.quantity > 0
                          const unrealizedPL = hasUPL ? (curPrice - t.pricePerShare) * t.quantity : 0
                          const unrealizedPLPct = hasUPL ? ((curPrice - t.pricePerShare) / t.pricePerShare) * 100 : 0
                          const pl = hasRPL ? t.realizedPL : hasUPL ? unrealizedPL : null
                          const plUp = pl != null && pl >= 0
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
                                {(hasRPL || hasUPL) ? (
                                  <div>
                                    <span className={`text-xs font-semibold tabular-nums ${plUp ? 'text-emerald-400' : 'text-[var(--accent-rose)]'}`}>
                                      {plUp ? '+' : ''}{formatINR(pl)}
                                    </span>
                                    {hasUPL && (
                                      <p className={`text-[10px] tabular-nums ${plUp ? 'text-emerald-400/70' : 'text-[var(--accent-rose)]/70'}`}>
                                        {unrealizedPLPct >= 0 ? '+' : ''}{unrealizedPLPct.toFixed(1)}%
                                      </p>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-xs text-[var(--text-dim)]">—</span>
                                )}
                              </td>
                              <td className="py-2.5 px-2">
                                <StockTxnActionMenu
                                  txn={t}
                                  isOpen={txnMenuOpen === t.transactionId}
                                  onToggle={() => setTxnMenuOpen(txnMenuOpen === t.transactionId ? null : t.transactionId)}
                                  onEdit={() => { setTxnMenuOpen(null); setModal({ editTxn: t }) }}
                                  onDelete={() => { setTxnMenuOpen(null); handleDeleteTransaction(t.transactionId) }}
                                />
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile cards */}
                  <div className="sm:hidden divide-y divide-[var(--row-divider)]">
                    {transactions.map((t) => {
                      const isBuy = t.type === 'BUY'
                      const curPrice = currentPriceMap[`${t.portfolioId}:${t.symbol}`]
                      const hasRPL = !isBuy && t.realizedPL != null
                      const hasUPL = isBuy && curPrice > 0 && t.pricePerShare > 0 && t.quantity > 0
                      const unrealizedPL = hasUPL ? (curPrice - t.pricePerShare) * t.quantity : 0
                      const unrealizedPLPct = hasUPL ? ((curPrice - t.pricePerShare) / t.pricePerShare) * 100 : 0
                      const pl = hasRPL ? t.realizedPL : hasUPL ? unrealizedPL : null
                      const plUp = pl != null && pl >= 0
                      return (
                        <div key={t.transactionId} className="px-4 py-3">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isBuy ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-[var(--accent-rose)]'}`}>
                                {t.type}
                              </span>
                              <p className="text-xs font-semibold text-[var(--text-primary)]">{t.symbol}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <p className="text-xs text-[var(--text-dim)]">{t.date}</p>
                              <StockTxnActionMenu
                                txn={t}
                                isOpen={txnMenuOpen === t.transactionId}
                                onToggle={() => setTxnMenuOpen(txnMenuOpen === t.transactionId ? null : t.transactionId)}
                                onEdit={() => { setTxnMenuOpen(null); setModal({ editTxn: t }) }}
                                onDelete={() => { setTxnMenuOpen(null); handleDeleteTransaction(t.transactionId) }}
                              />
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-[var(--text-dim)]">{t.quantity} shares @ {formatINR(t.pricePerShare)}</p>
                            <div className="text-right">
                              <p className="text-xs font-semibold text-[var(--text-primary)] tabular-nums">{formatINR(t.netAmount)}</p>
                              {(hasRPL || hasUPL) && (
                                <p className={`text-xs font-semibold tabular-nums ${plUp ? 'text-emerald-400' : 'text-[var(--accent-rose)]'}`}>
                                  P&L: {plUp ? '+' : ''}{formatINR(pl)} {hasUPL ? `(${unrealizedPLPct >= 0 ? '+' : ''}${unrealizedPLPct.toFixed(1)}%)` : ''}
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

          {/* Signals tab temporarily disabled */}
        </>
      )}

      {modals}
      {/* Signal modals temporarily disabled */}
    </div>
  )
}


/* ── Stat card (same markup as the Mutual Funds page) ── */
function StatCard({ label, value, sub, positive, bold, title }) {
  return (
    <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] px-4 py-3" title={title}>
      <p className="text-xs text-[var(--text-dim)] uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-sm tabular-nums ${bold ? 'font-bold' : 'font-semibold'} ${
        positive === undefined ? 'text-[var(--text-primary)]' : positive ? 'text-emerald-400' : 'text-[var(--accent-rose)]'
      }`}>
        {value}
      </p>
      {sub && (
        <p className={`text-xs font-semibold tabular-nums mt-0.5 ${positive === undefined ? 'text-[var(--text-dim)]' : positive ? 'text-emerald-400' : 'text-[var(--accent-rose)]'}`}>
          {sub}
        </p>
      )}
    </div>
  )
}

/* ── Transaction row menu (Edit / Delete) ── */
function StockTxnActionMenu({ txn, isOpen, onToggle, onEdit, onDelete }) {
  const buttonRef = useRef(null)
  const [pos, setPos] = useState({ top: 0, right: 0 })

  if (!txn.transactionId) return null

  function handleToggle(e) {
    e.stopPropagation()
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
    }
    onToggle()
  }

  return (
    <>
      <button
        ref={buttonRef}
        onClick={handleToggle}
        className="p-1 rounded-md text-[var(--text-dim)] hover:text-[var(--text-muted)] hover:bg-[var(--bg-hover)] transition-colors"
        title="Actions"
      >
        <MoreVertical size={14} />
      </button>
      {isOpen && createPortal(
        <>
          {/* Transparent backdrop to catch outside clicks */}
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
            onClick={(e) => { e.stopPropagation(); onToggle() }}
          />
          {/* Menu */}
          <div
            style={{ position: 'fixed', top: pos.top, right: pos.right, zIndex: 9999 }}
            className="bg-[var(--bg-dropdown)] border border-white/10 rounded-lg shadow-2xl py-1 min-w-[120px] animate-fade-in"
          >
            <button
              onClick={(e) => { e.stopPropagation(); onEdit() }}
              className="w-full text-left px-3 py-2 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] flex items-center gap-2 transition-colors"
            >
              <Pencil size={12} /> Edit
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete() }}
              className="w-full text-left px-3 py-2 text-xs text-[var(--accent-rose)] hover:bg-rose-500/10 flex items-center gap-2 transition-colors"
            >
              <Trash2 size={12} /> Delete
            </button>
          </div>
        </>,
        document.body
      )}
    </>
  )
}
