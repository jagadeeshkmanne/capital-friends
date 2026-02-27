import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Plus, Minus, Pencil, TrendingUp, TrendingDown, Wallet, List, Layers, ChevronDown, ChevronUp, ArrowDownCircle, Repeat2, Settings2, RefreshCw, MoreVertical, Trash2, Filter, PieChart, Save, Check } from 'lucide-react'
import { formatINR } from '../../data/familyData'
import { useFamily } from '../../context/FamilyContext'
import { useData } from '../../context/DataContext'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'
import { useMask } from '../../context/MaskContext'
import Modal, { FormDateInput } from '../../components/Modal'
import MFPortfolioForm from '../../components/forms/MFPortfolioForm'
import MFInvestForm from '../../components/forms/MFInvestForm'
import MFRedeemForm from '../../components/forms/MFRedeemForm'
import MFSwitchForm from '../../components/forms/MFSwitchForm'
import MFAllocationManager from '../../components/forms/MFAllocationManager'
import MFRebalanceDialog from '../../components/forms/MFRebalanceDialog'
import MFBuyOpportunities from '../../components/forms/MFBuyOpportunities'
import PageLoading from '../../components/PageLoading'

// Strip PFL- prefix for display
const displayName = (name) => name?.replace(/^PFL-/, '') || name

// Infer asset category from fund name (client-side fallback when server category is missing)
function inferCategory(name) {
  if (!name) return 'Other'
  const n = name.toLowerCase()
  if (n.includes('gold') || n.includes('silver') || n.includes('commodity')) return 'Commodity'
  if (n.includes('liquid') || n.includes('money market') || n.includes('overnight')) return 'Liquid'
  if (n.includes('gilt') || n.includes('government securities') || n.includes('constant maturity')) return 'Gilt'
  if (n.includes('elss') || n.includes('tax saver')) return 'ELSS'
  if (n.includes('debt') || n.includes('bond') || n.includes('income fund') || n.includes('corporate bond') ||
      n.includes('banking & psu') || n.includes('short duration') || n.includes('medium duration') ||
      n.includes('long duration') || n.includes('short term') || n.includes('medium term') ||
      n.includes('floater') || n.includes('floating rate') || n.includes('credit') ||
      n.includes('accrual') || n.includes('savings fund') || n.includes('ultra short')) return 'Debt'
  if (n.includes('multi asset')) return 'Multi-Asset'
  if (n.includes('hybrid') || n.includes('balanced') || n.includes('dynamic asset') ||
      n.includes('arbitrage') || n.includes('retirement') ||
      n.includes('children') || n.includes('pension')) return 'Hybrid'
  if (n.includes('equity') || n.includes('flexi cap') || n.includes('large cap') || n.includes('mid cap') ||
      n.includes('small cap') || n.includes('multi cap') || n.includes('focused') || n.includes('contra') ||
      n.includes('value fund') || n.includes('thematic') || n.includes('sectoral') ||
      n.includes('consumption') || n.includes('infrastructure') || n.includes('pharma') ||
      n.includes('healthcare') || n.includes('technology') || n.includes('fmcg') ||
      n.includes('mnc') || n.includes('opportunities fund') || n.includes('midcap') ||
      n.includes('smallcap') || n.includes('largecap') || n.includes('large & mid')) return 'Equity'
  if (n.includes('index') || n.includes('etf') || n.includes('nifty') || n.includes('sensex')) return 'Index'
  if (n.includes('fund of fund') || n.includes('fof')) return 'Hybrid'
  if (n.includes('aggressive') || n.includes('conservative')) return 'Hybrid'
  return 'Other'
}

// Asset class & market cap colors
const ASSET_CLS_COLOR = { Equity: 'bg-violet-500', Debt: 'bg-sky-500', Commodities: 'bg-yellow-500', Cash: 'bg-teal-400', Hybrid: 'bg-indigo-400', Other: 'bg-slate-400' }
const CAP_COLOR = { 'Large Cap': 'bg-blue-500', 'Mid Cap': 'bg-amber-500', 'Small Cap': 'bg-rose-500' }

// Parse date string (handles dd/MM/yyyy from GAS, ISO, and Date objects)
function parseDate(d) {
  if (!d) return null
  if (d instanceof Date) return isNaN(d.getTime()) ? null : d
  const s = String(d)
  // dd/MM/yyyy or dd/MM/yyyy HH:mm:ss
  const ddmm = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (ddmm) return new Date(Number(ddmm[3]), Number(ddmm[2]) - 1, Number(ddmm[1]))
  const parsed = new Date(s)
  return isNaN(parsed.getTime()) ? null : parsed
}

// ATH color coding (matching email report)
function athColor(pct) {
  if (pct >= 20) return { color: '#c62828', fontWeight: 700 }
  if (pct >= 10) return { color: '#d84315', fontWeight: 700 }
  if (pct >= 5) return { color: '#e67e00', fontWeight: 600 }
  if (pct >= 1) return { color: '#b8860b', fontWeight: 600 }
  return { color: 'var(--text-dim)', fontWeight: 400 }
}

export default function MutualFundsPage() {
  const { selectedMember } = useFamily()
  const {
    mfPortfolios, mfHoldings, mfTransactions,
    activeMembers, activeInvestmentAccounts,
    addMFPortfolio, updateMFPortfolio, deleteMFPortfolio,
    investMF, redeemMF, switchMF, updateHoldingAllocations,
    deleteMFTransaction, editMFTransaction,
    assetAllocations, updateAssetAllocation,
  } = useData()

  const { showToast, showBlockUI, hideBlockUI } = useToast()
  const confirm = useConfirm()
  const { mv } = useMask()
  const [modal, setModal] = useState(null)
  const [selectedPortfolioId, setSelectedPortfolioId] = useState('all')
  const [subTab, setSubTab] = useState('holdings')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [expandedHoldingId, setExpandedHoldingId] = useState(null)
  const [txnLimit, setTxnLimit] = useState({})
  const [txnFundFilter, setTxnFundFilter] = useState('all')
  const [txnMenuOpen, setTxnMenuOpen] = useState(null) // transactionId of open menu

  const toggleExpand = useCallback((holdingId) => {
    setExpandedHoldingId((prev) => prev === holdingId ? null : holdingId)
  }, [])

  const showMoreTxns = useCallback((holdingId) => {
    setTxnLimit((prev) => ({ ...prev, [holdingId]: (prev[holdingId] || 5) + 10 }))
  }, [])

  // Enrich portfolios: resolve investmentAccountId, ownerId & ownerName from investment accounts
  const enrichedPortfolios = useMemo(() => {
    if (!mfPortfolios) return []
    return mfPortfolios.filter((p) => p.status !== 'Inactive').map((p) => {
      // GAS may store name label instead of ID in investmentAccountId
      let account = activeInvestmentAccounts.find((a) => a.accountId === p.investmentAccountId)
      if (!account && p.investmentAccountId) {
        account = activeInvestmentAccounts.find((a) =>
          `${a.accountName} - ${a.platformBroker}` === p.investmentAccountId
        )
      }
      const resolvedOwnerId = account?.memberId || p.ownerId || ''
      const member = resolvedOwnerId ? activeMembers.find((m) => m.memberId === resolvedOwnerId) : null
      return {
        ...p,
        investmentAccountId: account?.accountId || p.investmentAccountId,
        ownerId: resolvedOwnerId,
        ownerName: member?.memberName || p.ownerName || '',
        platform: account?.platformBroker || p.investmentAccountName || '—',
        clientId: account?.accountClientId || '—',
      }
    })
  }, [mfPortfolios, activeInvestmentAccounts, activeMembers])

  // Filter portfolios by member
  const portfolios = useMemo(() => {
    if (!enrichedPortfolios.length) return []
    return selectedMember === 'all' ? enrichedPortfolios : enrichedPortfolios.filter((p) => p.ownerId === selectedMember)
  }, [enrichedPortfolios, selectedMember])

  // Per-portfolio computed data
  const portfolioData = useMemo(() => {
    if (!mfHoldings) return []
    return portfolios.map((p) => {
      const holdings = mfHoldings.filter((h) => h.portfolioId === p.portfolioId)
      const txns = (mfTransactions || []).filter((t) => t.portfolioId === p.portfolioId)
      return {
        ...p, holdings, txns,
        fundCount: holdings.length,
      }
    })
  }, [portfolios, mfHoldings, mfTransactions])

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
    const relevantHoldings = !mfHoldings ? [] : selectedPortfolioId === 'all'
      ? mfHoldings.filter((h) => source.some((p) => p.portfolioId === h.portfolioId))
      : mfHoldings.filter((h) => h.portfolioId === selectedPortfolioId)
    const monthlySIP = relevantHoldings.reduce((s, h) => s + (h.ongoingSIP || 0), 0)
    return { invested, current, unrealizedPL, unrealizedPLPct, realizedPL, realizedPLPct, totalPL, totalPLPct, funds, monthlySIP }
  }, [portfolioData, selectedPortfolioId, mfHoldings])

  // Holdings & transactions for selected view
  const holdings = useMemo(() => {
    if (!mfHoldings) return []
    if (selectedPortfolioId === 'all') return mfHoldings.filter((h) => portfolios.some((p) => p.portfolioId === h.portfolioId))
    return mfHoldings.filter((h) => h.portfolioId === selectedPortfolioId)
  }, [mfHoldings, portfolios, selectedPortfolioId])

  const allFilteredTxns = useMemo(() => {
    if (!mfTransactions) return []
    const txns = selectedPortfolioId === 'all'
      ? mfTransactions.filter((t) => portfolios.some((p) => p.portfolioId === t.portfolioId))
      : mfTransactions.filter((t) => t.portfolioId === selectedPortfolioId)
    return txns.sort((a, b) => (parseDate(b.date) || 0) - (parseDate(a.date) || 0))
  }, [mfTransactions, portfolios, selectedPortfolioId])

  // Unique fund names for filter
  const txnFundNames = useMemo(() => {
    const names = new Set()
    allFilteredTxns.forEach((t) => { if (t.fundName) names.add(t.fundName) })
    return [...names].sort()
  }, [allFilteredTxns])

  const transactions = useMemo(() => {
    if (txnFundFilter === 'all') return allFilteredTxns
    return allFilteredTxns.filter((t) => t.fundName === txnFundFilter)
  }, [allFilteredTxns, txnFundFilter])

  // Enrich holdings with dynamic allocation % (rebalance logic moved to dialog)
  const enrichedHoldings = useMemo(() => {
    const portfolioTotals = {}
    holdings.forEach((h) => {
      portfolioTotals[h.portfolioId] = (portfolioTotals[h.portfolioId] || 0) + h.currentValue
    })

    return holdings.map((h) => {
      const totalValue = portfolioTotals[h.portfolioId] || 0
      const currentAllocationPct = totalValue > 0 ? (h.currentValue / totalValue) * 100 : 0
      const plPct = h.investment > 0 ? (h.pl / h.investment) * 100 : 0
      const _key = h.holdingId || `${h.portfolioId}::${h.schemeCode || h.fundCode}`
      return { ...h, currentAllocationPct, plPct, _key }
    })
  }, [holdings])

  // Group holdings by portfolio (for "All" view)
  const holdingsByPortfolio = useMemo(() => {
    if (selectedPortfolioId !== 'all') return null
    const groups = []
    const seen = {}
    enrichedHoldings.forEach((h) => {
      if (!seen[h.portfolioId]) {
        seen[h.portfolioId] = { portfolioId: h.portfolioId, holdings: [] }
        groups.push(seen[h.portfolioId])
      }
      seen[h.portfolioId].holdings.push(h)
    })
    return groups
  }, [enrichedHoldings, selectedPortfolioId])

  // Per-portfolio indicator counts (buy opp + rebalance)
  const portfolioIndicators = useMemo(() => {
    if (!mfHoldings) return {}
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
        if (h.targetAllocationPct > 0 && Math.abs(currentPct - h.targetAllocationPct) > threshold) rebalance++
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

  // Asset class & market cap breakdown for selected portfolio(s)
  const breakdown = useMemo(() => {
    if (!holdings.length) return null

    // Build allocation lookup from assetAllocations data
    const allocMap = {}
    if (assetAllocations) {
      for (const a of assetAllocations) {
        allocMap[a.fundCode] = { asset: a.assetAllocation, equity: a.equityAllocation }
      }
    }

    const asset = { Equity: 0, Debt: 0, Commodities: 0, Cash: 0, Other: 0 }
    const cap = { Large: 0, Mid: 0, Small: 0 }
    let totalValue = 0
    let hasDetailedAlloc = false

    for (const h of holdings) {
      if (h.units <= 0) continue
      totalValue += h.currentValue
      const alloc = allocMap[h.fundCode || h.schemeCode]

      if (alloc?.asset) {
        // Detailed: AssetAllocations sheet data
        hasDetailedAlloc = true
        for (const [cls, pct] of Object.entries(alloc.asset)) {
          const val = h.currentValue * (pct / 100)
          if (cls === 'Equity') asset.Equity += val
          else if (cls === 'Debt') asset.Debt += val
          else if (cls === 'Cash') asset.Cash += val
          else if (cls === 'Commodities' || cls === 'Gold') asset.Commodities += val
          else asset.Other += val
        }
        // Market cap from equity allocation
        if (alloc.equity) {
          for (const [sz, pct] of Object.entries(alloc.equity)) {
            const eqVal = h.currentValue * ((alloc.asset.Equity || 0) / 100) * (pct / 100)
            if (sz === 'Large') cap.Large += eqVal
            else if (sz === 'Mid') cap.Mid += eqVal
            else if (sz === 'Small' || sz === 'Micro') cap.Small += eqVal
          }
        }
      } else {
        // Fallback: basic category
        // Use server category, but if it's 'Other' or missing, infer from fund name
        let cat = h.category
        if (!cat || cat === 'Other') cat = inferCategory(h.fundName)
        if (cat === 'Equity' || cat === 'ELSS' || cat === 'Index') asset.Equity += h.currentValue
        else if (cat === 'Debt' || cat === 'Gilt') asset.Debt += h.currentValue
        else if (cat === 'Liquid') asset.Cash += h.currentValue
        else if (cat === 'Commodity') asset.Commodities += h.currentValue
        else if (cat === 'Multi-Asset') {
          asset.Equity += h.currentValue * 0.50
          asset.Debt += h.currentValue * 0.30
          asset.Commodities += h.currentValue * 0.20
        } else if (cat === 'Hybrid' || cat === 'FoF') {
          asset.Equity += h.currentValue * 0.65
          asset.Debt += h.currentValue * 0.35
        } else asset.Other += h.currentValue
      }
    }

    if (totalValue === 0) return null

    const assetList = Object.entries(asset)
      .filter(([, v]) => v > 0)
      .sort(([, a], [, b]) => b - a)
      .map(([name, value]) => ({ name, value, pct: (value / totalValue) * 100 }))

    const capTotal = cap.Large + cap.Mid + cap.Small
    const capList = capTotal > 0
      ? Object.entries(cap)
          .filter(([, v]) => v > 0)
          .sort(([, a], [, b]) => b - a)
          .map(([name, value]) => ({ name: name + ' Cap', value, pct: (value / capTotal) * 100 }))
      : []

    return { assetList, capList, hasDetailedAlloc }
  }, [holdings, assetAllocations])

  // Unique funds across selected holdings for Allocations tab
  const uniqueFunds = useMemo(() => {
    if (!holdings.length) return []
    const map = {}
    holdings.forEach(h => {
      if (!h.fundCode && !h.schemeCode) return
      const code = (h.fundCode || h.schemeCode).toString()
      if (!map[code]) map[code] = { fundCode: code, fundName: h.fundName || '' }
    })
    return Object.values(map).sort((a, b) => a.fundName.localeCompare(b.fundName))
  }, [holdings])

  // Loading state — after all hooks
  if (mfPortfolios === null || mfHoldings === null) return <PageLoading title="Loading mutual funds" cards={5} />

  const selectedPortfolio = portfolioData.find((p) => p.portfolioId === selectedPortfolioId)

  const dropdownLabel = selectedPortfolioId === 'all'
    ? `All Portfolios (${portfolios.length})`
    : `${displayName(selectedPortfolio?.portfolioName)} — ${mv(selectedPortfolio?.ownerName, 'name')}`

  // Handlers
  async function handleSavePortfolio(data) {
    showBlockUI('Saving...')
    try {
      if (modal?.editPortfolio) await updateMFPortfolio(modal.editPortfolio.portfolioId, data)
      else await addMFPortfolio(data)
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
        await deleteMFPortfolio(modal.editPortfolio.portfolioId)
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

  async function handleInvest(data) {
    showBlockUI('Recording investment...')
    try {
      await investMF(data, data.transactionType)
      showToast('Investment recorded')
      setModal(null)
    } catch (err) {
      showToast(err.message || 'Failed to record investment', 'error')
    } finally {
      hideBlockUI()
    }
  }

  async function handleRedeem(data) {
    showBlockUI('Recording redemption...')
    try {
      await redeemMF(data)
      showToast('Redemption recorded')
      setModal(null)
    } catch (err) {
      showToast(err.message || 'Failed to record redemption', 'error')
    } finally {
      hideBlockUI()
    }
  }

  async function handleSwitch(data) {
    showBlockUI('Recording switch...')
    try {
      await switchMF(data)
      showToast('Switch recorded')
      setModal(null)
    } catch (err) {
      showToast(err.message || 'Failed to record switch', 'error')
    } finally {
      hideBlockUI()
    }
  }

  async function handleDeleteTransaction(transactionId) {
    if (!await confirm('Delete this transaction? This will recalculate your holdings.', { title: 'Delete Transaction', confirmLabel: 'Delete' })) return
    showBlockUI('Deleting...')
    try {
      await deleteMFTransaction(transactionId)
      showToast('Transaction deleted')
      setTxnMenuOpen(null)
    } catch (err) {
      showToast(err.message || 'Failed to delete transaction', 'error')
    } finally {
      hideBlockUI()
    }
  }

  async function handleEditTransaction(data) {
    showBlockUI('Updating...')
    try {
      await editMFTransaction(data)
      showToast('Transaction updated')
      setModal(null)
    } catch (err) {
      showToast(err.message || 'Failed to update transaction', 'error')
    } finally {
      hideBlockUI()
    }
  }

  async function handleSaveAllocations(allocations) {
    if (modal?.allocations) {
      showBlockUI('Saving allocations...')
      try {
        await updateHoldingAllocations(modal.allocations, allocations)
        showToast('Allocations updated')
        setModal(null)
      } catch (err) {
        showToast(err.message || 'Failed to update allocations', 'error')
      } finally {
        hideBlockUI()
      }
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
                  <div className="absolute left-0 top-full mt-1 z-40 bg-[var(--bg-dropdown)] border border-white/10 rounded-lg shadow-2xl min-w-[300px] py-1 overflow-hidden">
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
                                  {displayName(p.portfolioName)}
                                </p>
                                {ind.buyOpp > 0 && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" title={`${ind.buyOpp} buy opportunities`} />}
                                {ind.rebalance > 0 && <span className="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" title={`${ind.rebalance} funds need rebalancing`} />}
                              </div>
                              <p className="text-xs text-[var(--text-dim)]">{mv(p.ownerName, 'name')} · {p.platform} · {p.fundCount} funds</p>
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
              <span><span className="font-semibold">Client ID:</span> {mv(selectedPortfolio.clientId, 'clientId')}</span>
              <span><span className="font-semibold">Funds:</span> {selectedPortfolio.fundCount}</span>
              {selectedPortfolio.sipTarget >= 100 && <span><span className="font-semibold">SIP Target:</span> {formatINR(selectedPortfolio.sipTarget)}/mo</span>}
              {selectedPortfolio.lumpsumTarget >= 100 && <span><span className="font-semibold">Lumpsum Target:</span> {formatINR(selectedPortfolio.lumpsumTarget)}</span>}
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

          {/* ── Asset Class & Market Cap Breakdown ── */}
          {breakdown && breakdown.assetList.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Asset Class */}
              <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-3">
                <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">Asset Allocation</p>
                <div className="h-2.5 rounded-full overflow-hidden bg-[var(--bg-inset)] flex">
                  {breakdown.assetList.map((c) => (
                    <div key={c.name} className={`h-full ${ASSET_CLS_COLOR[c.name] || 'bg-slate-400'}`} style={{ width: `${c.pct}%` }} />
                  ))}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5">
                  {breakdown.assetList.map((c) => (
                    <span key={c.name} className="flex items-center gap-1 text-[11px] text-[var(--text-dim)]">
                      <span className={`w-1.5 h-1.5 rounded-full ${ASSET_CLS_COLOR[c.name] || 'bg-slate-400'}`} />
                      {c.name} {c.pct.toFixed(0)}%
                    </span>
                  ))}
                </div>
                {!breakdown.hasDetailedAlloc && (
                  <p className="text-[9px] text-[var(--text-dim)]/50 mt-1">Based on fund category. Add detailed allocations for accuracy.</p>
                )}
              </div>

              {/* Market Cap */}
              {breakdown.capList.length > 0 ? (
                <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-3">
                  <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">Market Cap Breakdown</p>
                  <div className="h-2.5 rounded-full overflow-hidden bg-[var(--bg-inset)] flex">
                    {breakdown.capList.map((c) => (
                      <div key={c.name} className={`h-full ${CAP_COLOR[c.name] || 'bg-slate-400'}`} style={{ width: `${c.pct}%` }} />
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5">
                    {breakdown.capList.map((c) => (
                      <span key={c.name} className="flex items-center gap-1 text-[11px] text-[var(--text-dim)]">
                        <span className={`w-1.5 h-1.5 rounded-full ${CAP_COLOR[c.name] || 'bg-slate-400'}`} />
                        {c.name} {c.pct.toFixed(0)}%
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-3 flex items-center justify-center">
                  <p className="text-[10px] text-[var(--text-dim)]">Add asset allocations per fund for market cap breakdown</p>
                </div>
              )}
            </div>
          )}

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
              <button
                onClick={() => setSubTab('allocations')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  subTab === 'allocations'
                    ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}
              >
                <PieChart size={12} /> Allocations ({uniqueFunds.length})
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
                <div className={selectedPortfolioId === 'all' ? 'space-y-4' : ''}>
                {(selectedPortfolioId === 'all' ? holdingsByPortfolio : [{ portfolioId: selectedPortfolioId, holdings: enrichedHoldings }]).map((group) => {
                  const groupPortfolio = portfolioData.find((p) => p.portfolioId === group.portfolioId)
                  const groupHoldings = group.holdings
                  const groupPL = groupHoldings.reduce((s, h) => s + h.pl, 0)
                  const groupPLUp = groupPL >= 0
                  return (
                <div key={group.portfolioId} className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] overflow-hidden">
                  {/* Portfolio header (only in "All" view) */}
                  {selectedPortfolioId === 'all' && groupPortfolio && (
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--border-light)] bg-[var(--bg-inset)]">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-[var(--text-primary)]">{displayName(groupPortfolio.portfolioName)}</p>
                        {groupPortfolio.ownerName && <span className="text-xs text-[var(--text-dim)]">({mv(groupPortfolio.ownerName, 'name')})</span>}
                        <span className="text-xs text-[var(--text-dim)]">· {groupHoldings.filter(h => h.units > 0).length} funds</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs tabular-nums">
                        <span className="text-[var(--text-muted)]">{formatINR(groupPortfolio.currentValue || 0)}</span>
                        <span className={`font-bold ${groupPLUp ? 'text-emerald-400' : 'text-[var(--accent-rose)]'}`}>
                          {groupPLUp ? '+' : ''}{formatINR(groupPL)}
                        </span>
                      </div>
                    </div>
                  )}
                  {/* Desktop table */}
                  <div className="hidden lg:block overflow-x-auto">
                    <table className="w-full text-sm">
                      {/* Only show column headers for single portfolio or first group */}
                      <thead>
                        <tr className={`border-b border-[var(--border-light)] ${selectedPortfolioId !== 'all' ? 'bg-[var(--bg-inset)]' : ''}`}>
                          <th className="text-left py-2 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Fund Name</th>
                          <th className="text-right py-2 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Units</th>
                          <th className="text-right py-2 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">
                            <div>NAV</div>
                            <div className="text-[10px] font-medium text-[var(--text-dim)]">Current / Avg</div>
                          </th>
                          <th className="text-center py-2 px-2 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">
                            <div>ATH</div>
                            <div className="text-[10px] font-medium text-[var(--text-dim)]">Below Peak</div>
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
                          <th className="py-2 px-2 w-8"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {groupHoldings.map((h) => {
                          const ath = athColor(h.belowATHPct)
                          const isPlanned = h.units === 0
                          const pData = portfolioData.find((p) => p.portfolioId === h.portfolioId)
                          const totalPortfolioValue = pData?.currentValue || 0
                          const isExpanded = expandedHoldingId === h._key

                          // P&L on current holdings
                          const unrealizedPL = h.pl
                          const unrealUp = unrealizedPL >= 0

                          // Planned fund: catch-up lumpsum + steady SIP
                          const plannedBuy = isPlanned && h.targetAllocationPct > 0 && h.targetAllocationPct < 100 && totalPortfolioValue > 0
                            ? (h.targetAllocationPct / (100 - h.targetAllocationPct)) * totalPortfolioValue : 0
                          const steadySIP = isPlanned && h.targetAllocationPct > 0 && pData?.sipTarget >= 100
                            ? (h.targetAllocationPct / 100) * pData.sipTarget : 0

                          // Per-fund transactions (only compute when expanded)
                          const fundTxns = isExpanded
                            ? (mfTransactions || []).filter((t) => t.portfolioId === h.portfolioId && t.fundCode === h.schemeCode).sort((a, b) => (parseDate(b.date) || 0) - (parseDate(a.date) || 0))
                            : []
                          const visibleLimit = txnLimit[h._key] || 5
                          const visibleTxns = fundTxns.slice(0, visibleLimit)
                          const daysSince = (d) => { const p = parseDate(d); return p ? Math.floor((new Date() - p) / 86400000) : null }

                          return (
                            <React.Fragment key={h._key}>
                            <tr
                              onClick={() => !isPlanned && toggleExpand(h._key)}
                              className={`border-b border-[var(--border-light)] last:border-0 transition-colors ${isPlanned ? 'opacity-60' : 'cursor-pointer hover:bg-[var(--bg-hover)]'} ${isExpanded ? 'bg-[var(--bg-hover)]' : ''}`}
                            >
                              <td className="py-2.5 px-3 max-w-[240px]">
                                <div className="flex items-center gap-1.5">
                                  {!isPlanned && (
                                    <ChevronDown size={12} className={`shrink-0 text-[var(--text-dim)] transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                  )}
                                  <div>
                                    <p className="text-xs text-[var(--text-primary)] leading-tight">
                                      {h.fundName}
                                      {isPlanned && <span className="ml-1.5 text-xs font-semibold text-violet-400 bg-violet-500/15 px-1.5 py-0.5 rounded">Planned</span>}
                                    </p>
                                    {isPlanned && (plannedBuy > 0 || steadySIP > 0) && (
                                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                        {plannedBuy > 0 && <span className="text-xs text-emerald-400 font-semibold">Buy {formatINR(plannedBuy)}</span>}
                                        {steadySIP > 0 && <span className="text-xs text-blue-400 font-semibold">SIP {formatINR(steadySIP)}/mo</span>}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-right text-xs text-[var(--text-secondary)] tabular-nums">{isPlanned ? '—' : h.units.toFixed(2)}</td>
                              <td className="py-2.5 px-3 text-right">
                                {isPlanned ? (
                                  <span className="text-xs text-[var(--text-dim)]">—</span>
                                ) : (
                                  <>
                                    <p className="text-xs font-semibold text-[var(--text-primary)] tabular-nums">₹{h.currentNav.toFixed(2)}</p>
                                    <p className="text-xs text-[var(--text-dim)] tabular-nums">₹{h.avgNav.toFixed(2)}</p>
                                  </>
                                )}
                              </td>
                              <td className="py-2.5 px-2 text-center">
                                {isPlanned ? (
                                  <span className="text-xs text-[var(--text-dim)]">—</span>
                                ) : h.athNav > 0 && h.belowATHPct > 0 ? (
                                  <div>
                                    <p className="text-sm font-bold tabular-nums" style={ath}>↓{h.belowATHPct.toFixed(1)}%</p>
                                    <p className="text-[11px] text-[var(--text-muted)] tabular-nums">₹{h.athNav.toFixed(0)}</p>
                                  </div>
                                ) : h.athNav > 0 ? (
                                  <span className="text-[10px] text-emerald-400/70 font-semibold">AT HIGH</span>
                                ) : (
                                  <span className="text-xs text-[var(--text-dim)]">—</span>
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
                              <td className="py-2.5 px-2 text-center">
                                <div className="flex items-center gap-0.5 justify-center">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setModal({ invest: { portfolioId: h.portfolioId, fundCode: h.schemeCode, fundName: h.fundName } }) }}
                                    className="w-6 h-6 flex items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-colors"
                                    title="Buy / Invest"
                                  >
                                    <Plus size={14} strokeWidth={2.5} />
                                  </button>
                                  {!isPlanned && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setModal({ redeem: { portfolioId: h.portfolioId, fundCode: h.schemeCode } }) }}
                                      className="w-6 h-6 flex items-center justify-center rounded-full bg-rose-500/15 text-rose-400 hover:bg-rose-500/25 transition-colors"
                                      title="Sell / Redeem"
                                    >
                                      <Minus size={14} strokeWidth={2.5} />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                            {/* Expanded: Zerodha-style fund details + transactions */}
                            {isExpanded && !isPlanned && (
                              <tr className="border-b border-[var(--border-light)]">
                                <td colSpan={8} className="p-0">
                                  <div className="bg-[var(--bg-expanded)] border-t border-[var(--border-light)]">
                                    <div className="flex flex-col lg:flex-row">
                                      {/* Left: Fund summary (Zerodha style) */}
                                      <div className="lg:w-52 shrink-0 p-4 border-b lg:border-b-0 lg:border-r border-[var(--border-light)]">
                                        <div className="space-y-4">
                                          <div>
                                            <p className="text-[10px] text-[var(--text-dim)] mb-0.5">Units</p>
                                            <p className="text-base font-bold text-[var(--text-primary)] tabular-nums">{h.units.toFixed(3)}</p>
                                          </div>
                                          <div>
                                            <p className="text-[10px] text-[var(--text-dim)] mb-0.5">Avg NAV</p>
                                            <p className="text-base font-bold text-[var(--text-primary)] tabular-nums">₹{h.avgNav.toFixed(2)}</p>
                                          </div>
                                          <div>
                                            <p className="text-[10px] text-[var(--text-dim)] mb-0.5">Invested</p>
                                            <p className="text-base font-bold text-[var(--text-primary)] tabular-nums">{formatINR(h.investment)}</p>
                                          </div>
                                          <div>
                                            <p className="text-[10px] text-[var(--text-dim)] mb-0.5">Current Value</p>
                                            <p className="text-base font-bold text-[var(--text-primary)] tabular-nums">{formatINR(h.currentValue)}</p>
                                          </div>
                                          {h.ongoingSIP > 0 && (
                                            <div>
                                              <p className="text-[10px] text-[var(--text-dim)] mb-0.5">Monthly SIP</p>
                                              <p className="text-base font-bold text-blue-400 tabular-nums">{formatINR(h.ongoingSIP)}</p>
                                            </div>
                                          )}
                                          <div className="pt-3 border-t border-[var(--border-light)] flex gap-2">
                                            <button
                                              onClick={(e) => { e.stopPropagation(); setModal({ invest: { portfolioId: h.portfolioId, fundCode: h.schemeCode, fundName: h.fundName } }) }}
                                              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg transition-colors"
                                            >
                                              <span className="w-5 h-5 flex items-center justify-center rounded-full bg-emerald-500/20"><Plus size={12} strokeWidth={2.5} /></span> Buy
                                            </button>
                                            <button
                                              onClick={(e) => { e.stopPropagation(); setModal({ redeem: { portfolioId: h.portfolioId, fundCode: h.schemeCode } }) }}
                                              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 rounded-lg transition-colors"
                                            >
                                              <span className="w-5 h-5 flex items-center justify-center rounded-full bg-rose-500/20"><Minus size={12} strokeWidth={2.5} /></span> Sell
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                      {/* Right: Transactions table (Zerodha style) */}
                                      <div className="flex-1 min-w-0">
                                        <div className="px-4 pt-3 pb-1">
                                          <p className="text-xs font-semibold text-[var(--text-secondary)]">Transactions</p>
                                        </div>
                                        {fundTxns.length === 0 ? (
                                          <p className="py-8 text-xs text-[var(--text-dim)] text-center">No transactions recorded</p>
                                        ) : (
                                          <>
                                            <table className="w-full">
                                              <thead>
                                                <tr className="border-b border-[var(--border-light)]">
                                                  <th className="text-left py-2 px-4 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">Date</th>
                                                  <th className="text-left py-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">Type</th>
                                                  <th className="text-center py-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">Days</th>
                                                  <th className="text-right py-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">Amount</th>
                                                  <th className="text-right py-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">NAV</th>
                                                  <th className="text-right py-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">Units</th>
                                                  <th className="text-right py-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">P&L</th>
                                                  <th className="w-8 py-2 px-1"></th>
                                                </tr>
                                              </thead>
                                              <tbody>
                                                {visibleTxns.map((t, idx) => {
                                                  const dateObj = parseDate(t.date)
                                                  const validDate = !!dateObj
                                                  const dateStr = validDate
                                                    ? dateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                                                    : t.date || '—'
                                                  const days = validDate ? daysSince(t.date) : null
                                                  const isBuy = t.type === 'BUY'
                                                  const hasGL = !isBuy && t.gainLoss != null && t.gainLoss !== 0
                                                  const glUp = hasGL && t.gainLoss >= 0
                                                  return (
                                                    <tr key={t.transactionId || `txn-${idx}`} className="group border-b border-[var(--border-light)] last:border-0 hover:bg-[var(--bg-hover)] transition-colors">
                                                      <td className="py-2.5 px-4 text-xs text-[var(--text-secondary)] tabular-nums whitespace-nowrap">{dateStr}</td>
                                                      <td className="py-2.5 px-2">
                                                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${isBuy ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-[var(--accent-rose)]'}`}>
                                                          {t.transactionType || t.type}
                                                        </span>
                                                      </td>
                                                      <td className="py-2.5 px-2 text-xs text-[var(--text-dim)] tabular-nums text-center">{days ?? '—'}</td>
                                                      <td className="py-2.5 px-3 text-xs font-semibold text-[var(--text-primary)] tabular-nums text-right">{formatINR(t.totalAmount)}</td>
                                                      <td className="py-2.5 px-3 text-xs text-[var(--text-muted)] tabular-nums text-right">{Number(t.price).toFixed(4)}</td>
                                                      <td className="py-2.5 px-3 text-xs text-[var(--text-muted)] tabular-nums text-right">{Number(t.units).toFixed(3)}</td>
                                                      <td className={`py-2.5 px-3 text-xs font-semibold tabular-nums text-right ${hasGL ? (glUp ? 'text-emerald-400' : 'text-[var(--accent-rose)]') : 'text-[var(--text-dim)]'}`}>
                                                        {hasGL ? `${glUp ? '+' : ''}${formatINR(t.gainLoss)}` : '—'}
                                                      </td>
                                                      <td className="py-2.5 px-1">
                                                        <TxnActionMenu
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
                                            {fundTxns.length > visibleLimit && (
                                              <div className="py-2 text-center border-t border-[var(--border-light)]">
                                                <button
                                                  onClick={(e) => { e.stopPropagation(); showMoreTxns(h._key) }}
                                                  className="text-xs font-semibold text-violet-400 hover:text-violet-300"
                                                >
                                                  Show More ({fundTxns.length - visibleLimit} remaining)
                                                </button>
                                              </div>
                                            )}
                                          </>
                                        )}
                                      </div>
                                    </div>
                                    {/* Collapse button */}
                                    <div className="flex justify-center py-1.5 border-t border-[var(--border-light)]">
                                      <button onClick={() => toggleExpand(h._key)} className="p-0.5 text-[var(--text-dim)] hover:text-[var(--text-muted)]">
                                        <ChevronUp size={14} />
                                      </button>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                            </React.Fragment>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile cards */}
                  <div className="lg:hidden divide-y divide-[var(--border-light)]">
                    {groupHoldings.map((h) => {
                      const ath = athColor(h.belowATHPct)
                      const isPlanned = h.units === 0
                      const pData = portfolioData.find((p) => p.portfolioId === h.portfolioId)
                      const totalPortfolioValue = pData?.currentValue || 0
                      const isExpanded = expandedHoldingId === h._key

                      const unrealizedPL = h.pl
                      const unrealUp = unrealizedPL >= 0

                      const plannedBuy = isPlanned && h.targetAllocationPct > 0 && h.targetAllocationPct < 100 && totalPortfolioValue > 0
                        ? (h.targetAllocationPct / (100 - h.targetAllocationPct)) * totalPortfolioValue : 0
                      const steadySIP = isPlanned && h.targetAllocationPct > 0 && pData?.sipTarget >= 100
                        ? (h.targetAllocationPct / 100) * pData.sipTarget : 0

                      const fundTxns = isExpanded
                        ? (mfTransactions || []).filter((t) => t.portfolioId === h.portfolioId && t.fundCode === h.schemeCode).sort((a, b) => (parseDate(b.date) || 0) - (parseDate(a.date) || 0))
                        : []
                      const visibleLimit = txnLimit[h._key] || 5
                      const visibleTxns = fundTxns.slice(0, visibleLimit)
                      const daysSince = (d) => { const p = parseDate(d); return p ? Math.floor((new Date() - p) / 86400000) : null }

                      return (
                        <div key={h._key} className={isPlanned ? 'opacity-60' : ''}>
                          <div
                            onClick={() => !isPlanned && toggleExpand(h._key)}
                            className={`px-4 py-3 ${!isPlanned ? 'cursor-pointer' : ''} ${isExpanded ? 'bg-[var(--bg-hover)]' : ''}`}
                          >
                            <div className="flex items-start justify-between mb-1.5">
                              <div className="flex-1 mr-3">
                                <div className="flex items-center gap-1.5">
                                  {!isPlanned && <ChevronDown size={12} className={`shrink-0 text-[var(--text-dim)] transition-transform ${isExpanded ? 'rotate-180' : ''}`} />}
                                  <p className="text-xs font-medium text-[var(--text-primary)] leading-tight">
                                    {h.fundName}
                                    {isPlanned && <span className="ml-1.5 text-xs font-semibold text-violet-400 bg-violet-500/15 px-1.5 py-0.5 rounded">Planned</span>}
                                  </p>
                                </div>
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
                            {isPlanned ? (
                              <div className="flex items-center justify-end mt-1">
                                <button
                                  onClick={(e) => { e.stopPropagation(); setModal({ invest: { portfolioId: h.portfolioId, fundCode: h.schemeCode, fundName: h.fundName } }) }}
                                  className="shrink-0 flex items-center gap-1 text-[10px] font-semibold text-emerald-400 hover:text-emerald-300 px-2 py-0.5 rounded bg-emerald-500/10"
                                >
                                  <span className="w-4 h-4 flex items-center justify-center rounded-full bg-emerald-500/20"><Plus size={10} strokeWidth={2.5} /></span> Buy
                                </button>
                              </div>
                            ) : (
                              <>
                                <div className="flex items-center justify-between text-xs text-[var(--text-dim)]">
                                  <div>
                                    <span>{h.units.toFixed(2)} units</span>
                                    <span className="mx-1">·</span>
                                    <span>NAV ₹{h.currentNav.toFixed(2)} / ₹{h.avgNav.toFixed(2)}</span>
                                  </div>
                                  <p className="text-xs font-semibold text-[var(--text-primary)] tabular-nums">{formatINR(h.currentValue)}</p>
                                </div>
                                <div className="flex items-center justify-between mt-1">
                                  <div className="flex items-center gap-3 text-xs text-[var(--text-dim)] flex-wrap">
                                    <span>Alloc: {h.currentAllocationPct.toFixed(1)}% / {h.targetAllocationPct.toFixed(1)}%</span>
                                    {h.athNav > 0 && h.belowATHPct > 0 ? (
                                      <span className="font-bold tabular-nums" style={ath}>ATH ↓{h.belowATHPct.toFixed(1)}%</span>
                                    ) : h.athNav > 0 ? (
                                      <span className="text-emerald-400/70 font-semibold text-[10px]">AT HIGH</span>
                                    ) : null}
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setModal({ invest: { portfolioId: h.portfolioId, fundCode: h.schemeCode, fundName: h.fundName } }) }}
                                      className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400 hover:text-emerald-300 px-2 py-0.5 rounded bg-emerald-500/10"
                                    >
                                      <span className="w-4 h-4 flex items-center justify-center rounded-full bg-emerald-500/20"><Plus size={10} strokeWidth={2.5} /></span> Buy
                                    </button>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setModal({ redeem: { portfolioId: h.portfolioId, fundCode: h.schemeCode } }) }}
                                      className="flex items-center gap-1 text-[10px] font-semibold text-rose-400 hover:text-rose-300 px-2 py-0.5 rounded bg-rose-500/10"
                                    >
                                      <span className="w-4 h-4 flex items-center justify-center rounded-full bg-rose-500/20"><Minus size={10} strokeWidth={2.5} /></span> Sell
                                    </button>
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                          {/* Expanded: Per-fund transactions (mobile) */}
                          {isExpanded && !isPlanned && (
                            <div className="bg-[var(--bg-inset)] border-l-2 border-l-violet-500/40 px-4 pb-3">
                              <div className="flex items-center justify-between py-2">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Transactions ({fundTxns.length})</p>
                              </div>
                              {fundTxns.length === 0 ? (
                                <p className="py-4 text-xs text-[var(--text-dim)] text-center">No transactions recorded</p>
                              ) : (
                                <div className="space-y-2">
                                  {visibleTxns.map((t, idx) => {
                                    const days = daysSince(t.date)
                                    const isBuy = t.type === 'BUY'
                                    const hasGL = !isBuy && t.gainLoss != null && t.gainLoss !== 0
                                    const glUp = hasGL && t.gainLoss >= 0
                                    return (
                                      <div key={t.transactionId || `txn-${idx}`} className="flex items-center justify-between text-xs bg-[var(--bg-card)] rounded-lg px-3 py-2">
                                        <div>
                                          <div className="flex items-center gap-1.5">
                                            <span className="text-[var(--text-secondary)]">{(parseDate(t.date) || new Date()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                                            <span className={`text-[10px] font-semibold px-1 py-0.5 rounded ${isBuy ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-[var(--accent-rose)]'}`}>
                                              {t.transactionType || t.type}
                                            </span>
                                            <span className="text-[var(--text-dim)]">{days}d</span>
                                          </div>
                                          <p className="text-[var(--text-dim)] mt-0.5">{Number(t.units).toFixed(3)} units @ ₹{Number(t.price).toFixed(2)}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <div className="text-right">
                                            <p className="font-semibold text-[var(--text-primary)] tabular-nums">{formatINR(t.totalAmount)}</p>
                                            {hasGL && (
                                              <p className={`font-semibold tabular-nums ${glUp ? 'text-emerald-400' : 'text-[var(--accent-rose)]'}`}>
                                                {glUp ? '+' : ''}{formatINR(t.gainLoss)}
                                              </p>
                                            )}
                                          </div>
                                          <TxnActionMenu
                                            txn={t}
                                            isOpen={txnMenuOpen === t.transactionId}
                                            onToggle={() => setTxnMenuOpen(txnMenuOpen === t.transactionId ? null : t.transactionId)}
                                            onEdit={() => { setTxnMenuOpen(null); setModal({ editTxn: t }) }}
                                            onDelete={() => { setTxnMenuOpen(null); handleDeleteTransaction(t.transactionId) }}
                                          />
                                        </div>
                                      </div>
                                    )
                                  })}
                                  {fundTxns.length > visibleLimit && (
                                    <button
                                      onClick={() => showMoreTxns(h._key)}
                                      className="w-full py-1.5 text-xs font-semibold text-violet-400 hover:text-violet-300 text-center"
                                    >
                                      Show More ({fundTxns.length - visibleLimit} remaining)
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
                  )
                })}
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
              {/* Fund filter */}
              {txnFundNames.length > 1 && (
                <div className="flex items-center gap-2 px-1">
                  <Filter size={12} className="text-[var(--text-dim)]" />
                  <select
                    value={txnFundFilter}
                    onChange={(e) => setTxnFundFilter(e.target.value)}
                    className="text-xs bg-[var(--bg-input)] border border-[var(--border-input)] text-[var(--text-primary)] rounded-lg px-3 py-1.5 max-w-[350px] truncate"
                  >
                    <option value="all">All Funds ({allFilteredTxns.length})</option>
                    {txnFundNames.map((name) => (
                      <option key={name} value={name}>{name} ({allFilteredTxns.filter((t) => t.fundName === name).length})</option>
                    ))}
                  </select>
                  {txnFundFilter !== 'all' && (
                    <button onClick={() => setTxnFundFilter('all')} className="text-xs text-[var(--text-dim)] hover:text-[var(--text-muted)] underline">Clear</button>
                  )}
                </div>
              )}

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
                          <th className="w-8"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {transactions.map((t, idx) => {
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
                            <tr key={t.transactionId || `txn-${idx}`} className="border-b border-[var(--border-light)] last:border-0 hover:bg-[var(--bg-hover)] transition-colors group">
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
                                {portfolio && <p className="text-xs text-[var(--text-dim)]">{displayName(portfolio.portfolioName)}</p>}
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
                              <td className="py-2.5 px-1">
                                <TxnActionMenu
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
                  <div className="sm:hidden divide-y divide-[var(--border-light)]">
                    {transactions.map((t, idx) => {
                      const isBuy = t.type === 'BUY'
                      const hasGL = !isBuy && t.gainLoss != null && t.gainLoss !== 0
                      const glUp = hasGL && t.gainLoss >= 0
                      return (
                        <div key={t.transactionId || `txn-m-${idx}`} className="px-4 py-3">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-1.5">
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isBuy ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-[var(--accent-rose)]'}`}>
                                {t.type}
                              </span>
                              <span className="text-xs font-semibold text-[var(--text-dim)]">{t.transactionType}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs text-[var(--text-dim)]">{t.date}</p>
                              <TxnActionMenu
                                txn={t}
                                isOpen={txnMenuOpen === t.transactionId}
                                onToggle={() => setTxnMenuOpen(txnMenuOpen === t.transactionId ? null : t.transactionId)}
                                onEdit={() => { setTxnMenuOpen(null); setModal({ editTxn: t }) }}
                                onDelete={() => { setTxnMenuOpen(null); handleDeleteTransaction(t.transactionId) }}
                              />
                            </div>
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
                  <p className="text-sm text-[var(--text-muted)]">{txnFundFilter !== 'all' ? 'No transactions for this fund' : 'No transactions yet'}</p>
                  {txnFundFilter !== 'all' ? (
                    <button onClick={() => setTxnFundFilter('all')} className="text-xs font-semibold text-violet-400 hover:text-violet-300">
                      Show all transactions
                    </button>
                  ) : (
                    <button onClick={() => setModal({ invest: selectedPortfolioId !== 'all' ? selectedPortfolioId : undefined })} className="text-xs font-semibold text-emerald-400 hover:text-emerald-300">
                      Make your first investment
                    </button>
                  )}
                </div>
              )}
            </>
          )}

          {/* ── Allocations Tab ── */}
          {subTab === 'allocations' && (
            <>
              {uniqueFunds.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs text-[var(--text-dim)] px-1">Configure asset class and market cap breakdown per fund for accurate portfolio analytics.</p>
                  {uniqueFunds.map(fund => (
                    <FundAllocationRow
                      key={fund.fundCode}
                      fund={fund}
                      existing={assetAllocations?.find(a => a.fundCode === fund.fundCode)}
                      onSave={updateAssetAllocation}
                    />
                  ))}
                </div>
              ) : (
                <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] py-10 flex flex-col items-center gap-3">
                  <PieChart size={28} className="text-[var(--text-dim)]" />
                  <p className="text-sm text-[var(--text-muted)]">No funds to configure allocations for</p>
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
          key={modal?.invest?.fundCode || modal?.invest?.portfolioId || modal?.invest}
          portfolioId={typeof modal?.invest === 'object' ? modal.invest.portfolioId : typeof modal?.invest === 'string' ? modal.invest : undefined}
          fundCode={typeof modal?.invest === 'object' ? modal.invest.fundCode : undefined}
          fundName={typeof modal?.invest === 'object' ? modal.invest.fundName : undefined}
          onSave={handleInvest}
          onCancel={() => setModal(null)}
        />
      </Modal>

      <Modal open={!!modal?.redeem} onClose={() => setModal(null)} title="Redeem Mutual Fund" wide>
        <MFRedeemForm
          key={modal?.redeem?.fundCode || modal?.redeem?.portfolioId || modal?.redeem}
          portfolioId={typeof modal?.redeem === 'object' ? modal.redeem.portfolioId : typeof modal?.redeem === 'string' ? modal.redeem : undefined}
          fundCode={typeof modal?.redeem === 'object' ? modal.redeem.fundCode : undefined}
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

      <Modal open={!!modal?.editTxn} onClose={() => setModal(null)} title="Edit Transaction">
        {modal?.editTxn && (
          <EditTxnForm
            txn={modal.editTxn}
            onSave={handleEditTransaction}
            onCancel={() => setModal(null)}
          />
        )}
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

/* ── Transaction Action Menu (3-dot dropdown via portal with backdrop) ── */
function TxnActionMenu({ txn, isOpen, onToggle, onEdit, onDelete }) {
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

/* ── Edit Transaction Form ── */
function EditTxnForm({ txn, onSave, onCancel }) {
  const [date, setDate] = useState(() => {
    const parsed = parseDate(txn.date)
    return parsed ? parsed.toISOString().split('T')[0] : ''
  })
  const [units, setUnits] = useState(String(txn.units || ''))
  const [price, setPrice] = useState(String(txn.price || ''))
  const [notes, setNotes] = useState(txn.notes || '')
  const [saving, setSaving] = useState(false)

  const totalAmount = (Number(units) || 0) * (Number(price) || 0)

  async function handleSubmit() {
    if (!units || Number(units) <= 0) return
    if (!price || Number(price) <= 0) return
    setSaving(true)
    try {
      await onSave({
        transactionId: txn.transactionId,
        date,
        units,
        price,
        notes,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-[var(--bg-inset)] rounded-lg px-3 py-2 border border-[var(--border-light)]">
        <p className="text-xs text-[var(--text-dim)]">{txn.fundName}</p>
        <p className="text-xs text-[var(--text-muted)]">
          {txn.type} · {txn.transactionType} · {txn.transactionId}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">Date</label>
          <FormDateInput value={date} onChange={setDate} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">Units</label>
          <input
            type="number"
            value={units}
            onChange={(e) => setUnits(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-[var(--bg-input)] border border-[var(--border-input)] text-[var(--text-primary)] rounded-lg"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">NAV (price)</label>
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-[var(--bg-input)] border border-[var(--border-input)] text-[var(--text-primary)] rounded-lg"
          />
        </div>
      </div>

      {totalAmount > 0 && (
        <div className="bg-[var(--bg-inset)] rounded-lg px-3 py-2 border border-[var(--border-light)]">
          <p className="text-xs text-[var(--text-dim)]">Total Amount</p>
          <p className="text-sm font-bold text-[var(--text-primary)] tabular-nums">{formatINR(totalAmount)}</p>
        </div>
      )}

      <div>
        <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">Notes</label>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional notes..."
          className="w-full px-3 py-2 text-sm bg-[var(--bg-input)] border border-[var(--border-input)] text-[var(--text-primary)] rounded-lg"
        />
      </div>

      <div className="flex items-center justify-end gap-3 pt-2 border-t border-[var(--border-light)]">
        <button onClick={onCancel} className="px-4 py-2 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving || !units || Number(units) <= 0 || !price || Number(price) <= 0}
          className="px-4 py-2 text-xs font-bold text-white bg-violet-600 hover:bg-violet-500 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving...' : 'Update Transaction'}
        </button>
      </div>
    </div>
  )
}

/* ── Fund Allocation Card ── */
const ALLOC_COLORS = [
  { key: 'Equity', color: 'bg-violet-500', label: 'Equity' },
  { key: 'Debt', color: 'bg-sky-500', label: 'Debt' },
  { key: 'Commodities', color: 'bg-yellow-500', label: 'Commodities' },
  { key: 'Cash', color: 'bg-teal-400', label: 'Cash' },
  { key: 'Real Estate', color: 'bg-slate-400', label: 'Other' },
]
const CAP_LABELS = [
  { key: 'Large', color: 'bg-blue-500', label: 'Large' },
  { key: 'Mid', color: 'bg-amber-500', label: 'Mid' },
  { key: 'Small', color: 'bg-rose-500', label: 'Small' },
]

function FundAllocationRow({ fund, existing, onSave }) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [equity, setEquity] = useState(existing?.assetAllocation?.Equity || 0)
  const [debt, setDebt] = useState(existing?.assetAllocation?.Debt || 0)
  const [cash, setCash] = useState(existing?.assetAllocation?.Cash || 0)
  const [commodities, setCommodities] = useState(existing?.assetAllocation?.Commodities || 0)
  const [other, setOther] = useState(existing?.assetAllocation?.['Real Estate'] || 0)
  const [largeCap, setLargeCap] = useState(existing?.equityAllocation?.Large || 0)
  const [midCap, setMidCap] = useState(existing?.equityAllocation?.Mid || 0)
  const [smallCap, setSmallCap] = useState(existing?.equityAllocation?.Small || 0)

  const assetTotal = equity + debt + cash + commodities + other
  const capTotal = largeCap + midCap + smallCap
  const assetValid = assetTotal === 100 || assetTotal === 0
  const capValid = capTotal === 100 || capTotal === 0 || equity === 0
  const hasData = existing?.assetAllocation && Object.keys(existing.assetAllocation).length > 0
  const hasCap = existing?.equityAllocation && Object.keys(existing.equityAllocation).length > 0

  async function handleSave() {
    if (!assetValid || !capValid) return
    setSaving(true)
    try {
      await onSave({ fundCode: fund.fundCode, fundName: fund.fundName, equity, debt, cash, commodities, realEstate: other, largeCap, midCap, smallCap })
      setSaved(true)
      setEditing(false)
      setTimeout(() => setSaved(false), 2000)
    } finally { setSaving(false) }
  }

  return (
    <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{fund.fundName}</p>
          <p className="text-[10px] text-[var(--text-dim)] tabular-nums mt-0.5">{fund.fundCode}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 ml-3">
          {saved && <Check size={14} className="text-emerald-400" />}
          {!editing && (
            <button onClick={() => setEditing(true)}
              className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-semibold text-violet-400 hover:text-violet-300 bg-violet-500/10 hover:bg-violet-500/20 rounded-md transition-colors">
              <Pencil size={10} /> {hasData ? 'Edit' : 'Set'}
            </button>
          )}
        </div>
      </div>

      {/* Allocation bar + labels (always visible when data exists) */}
      {hasData && !editing && (
        <div className="px-4 pb-3">
          <div className="h-2 rounded-full overflow-hidden bg-[var(--bg-inset)] flex mb-1.5">
            {ALLOC_COLORS.map(({ key, color }) => {
              const val = existing.assetAllocation[key] || 0
              return val > 0 ? <div key={key} className={`h-full ${color}`} style={{ width: `${val}%` }} /> : null
            })}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5">
            {ALLOC_COLORS.map(({ key, color, label }) => {
              const val = existing.assetAllocation[key] || 0
              return val > 0 ? (
                <span key={key} className="flex items-center gap-1 text-[11px] text-[var(--text-muted)] tabular-nums">
                  <span className={`w-1.5 h-1.5 rounded-full ${color}`} />{val}% {label}
                </span>
              ) : null
            })}
            {hasCap && (
              <span className="text-[11px] text-[var(--text-dim)] tabular-nums ml-1">
                | {CAP_LABELS.map(({ key, label }) => {
                  const val = existing.equityAllocation[key] || 0
                  return val > 0 ? `${label[0]}${val}` : ''
                }).filter(Boolean).join(' ')}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Not configured hint */}
      {!hasData && !editing && (
        <div className="px-4 pb-3">
          <div className="h-2 rounded-full bg-[var(--bg-inset)] mb-1" />
          <p className="text-[10px] text-[var(--text-dim)] italic">Not configured — click Set to add allocation data</p>
        </div>
      )}

      {/* Edit form */}
      {editing && (
        <div className="px-4 pb-3 border-t border-[var(--border-light)] pt-3">
          <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">Asset Class %</p>
          <div className="flex flex-wrap gap-2 mb-1">
            {[
              { label: 'Equity', val: equity, set: setEquity },
              { label: 'Debt', val: debt, set: setDebt },
              { label: 'Commodities', val: commodities, set: setCommodities },
              { label: 'Cash', val: cash, set: setCash },
              { label: 'Other', val: other, set: setOther },
            ].map(f => (
              <div key={f.label} className="w-20">
                <label className="block text-[10px] text-[var(--text-dim)] mb-0.5">{f.label}</label>
                <input type="number" min="0" max="100" value={f.val || ''} onChange={e => f.set(Number(e.target.value) || 0)}
                  className="w-full px-1.5 py-1 text-xs bg-[var(--bg-input)] border border-[var(--border-input)] text-[var(--text-primary)] rounded-md tabular-nums text-center" />
              </div>
            ))}
          </div>
          <p className={`text-[10px] tabular-nums mb-2 ${assetValid ? 'text-[var(--text-dim)]' : 'text-[var(--accent-rose)] font-semibold'}`}>
            Total: {assetTotal}% {!assetValid && '— must equal 100%'}
          </p>

          {equity > 0 && (
            <>
              <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">Equity Cap %</p>
              <div className="flex flex-wrap gap-2 mb-1">
                {[
                  { label: 'Large', val: largeCap, set: setLargeCap },
                  { label: 'Mid', val: midCap, set: setMidCap },
                  { label: 'Small', val: smallCap, set: setSmallCap },
                ].map(f => (
                  <div key={f.label} className="w-20">
                    <label className="block text-[10px] text-[var(--text-dim)] mb-0.5">{f.label}</label>
                    <input type="number" min="0" max="100" value={f.val || ''} onChange={e => f.set(Number(e.target.value) || 0)}
                      className="w-full px-1.5 py-1 text-xs bg-[var(--bg-input)] border border-[var(--border-input)] text-[var(--text-primary)] rounded-md tabular-nums text-center" />
                  </div>
                ))}
              </div>
              <p className={`text-[10px] tabular-nums mb-2 ${capValid ? 'text-[var(--text-dim)]' : 'text-[var(--accent-rose)] font-semibold'}`}>
                Total: {capTotal}% {!capValid && '— must equal 100%'}
              </p>
            </>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button onClick={() => setEditing(false)} className="px-3 py-1.5 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving || !assetValid || !capValid}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-violet-600 hover:bg-violet-500 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              <Save size={12} /> {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

