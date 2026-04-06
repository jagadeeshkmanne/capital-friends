import { useState, useMemo, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Plus, Minus, Pencil, TrendingUp, TrendingDown, Wallet, List, Layers, ChevronDown, ChevronRight, ArrowLeft, ArrowDownCircle, Repeat2, Settings2, MoreVertical, Trash2, Filter, PieChart as PieChartIcon, Lock, LockOpen, IndianRupee, Repeat } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts'
import { formatINR, splitFundName } from '../../data/familyData'
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
import FundAllocationForm from '../../components/forms/FundAllocationForm'
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

// Asset class, market cap & geography colors
const ASSET_CLS_COLOR = { Equity: '#8b5cf6', Debt: '#0ea5e9', Cash: '#2dd4bf', Commodities: '#eab308', 'Real Estate': '#f97316', Other: '#94a3b8' }
const CAP_CLS_COLOR = { Giant: '#6366f1', Large: '#3b82f6', Mid: '#f59e0b', Small: '#ef4444', Micro: '#ec4899' }
const GEO_CLS_COLOR = { India: '#f97316', Global: '#06b6d4' }
// Tailwind bg versions for bar/legend dots
const ASSET_BG = { Equity: 'bg-violet-500', Debt: 'bg-sky-500', Cash: 'bg-teal-400', Commodities: 'bg-yellow-500', 'Real Estate': 'bg-orange-500', Other: 'bg-slate-400' }
const CAP_BG = { Giant: 'bg-indigo-500', Large: 'bg-blue-500', Mid: 'bg-amber-500', Small: 'bg-rose-500', Micro: 'bg-pink-500' }
const GEO_BG = { India: 'bg-orange-500', Global: 'bg-cyan-500' }

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

// XIRR calculator — Newton-Raphson on cash flows [{ date, amount }]
function computeXIRR(cashFlows) {
  if (cashFlows.length < 2) return null
  const d0 = cashFlows[0].date
  const days = cashFlows.map(cf => (cf.date - d0) / (365.25 * 86400000))
  const f = (r) => cashFlows.reduce((s, cf, i) => s + cf.amount / Math.pow(1 + r, days[i]), 0)
  const df = (r) => cashFlows.reduce((s, cf, i) => s + (-days[i] * cf.amount) / Math.pow(1 + r, days[i] + 1), 0)
  let rate = 0.1
  for (let i = 0; i < 100; i++) {
    const fVal = f(rate)
    const dfVal = df(rate)
    if (Math.abs(dfVal) < 1e-10) break
    const newRate = rate - fVal / dfVal
    if (Math.abs(newRate - rate) < 1e-7) return newRate
    rate = newRate
    if (rate < -0.99) return null
  }
  return Math.abs(f(rate)) < 1 ? rate : null
}

// ATH color coding (matching email report)
function athColor(pct) {
  if (pct >= 20) return { color: '#c62828', fontWeight: 700 }
  if (pct >= 10) return { color: '#d84315', fontWeight: 700 }
  if (pct >= 5) return { color: '#e67e00', fontWeight: 600 }
  if (pct >= 1) return { color: '#b8860b', fontWeight: 600 }
  return { color: 'var(--text-dim)', fontWeight: 400 }
}

// Reusable Investment Journey chart with dot-only tooltip positioned at dot center
function JourneyChart({ data, gradientId, height = 220 }) {
  const [hoveredIdx, setHoveredIdx] = useState(null)
  const [dotPos, setDotPos] = useState(null) // { x, y } screen coords
  const chartRef = useRef(null)
  const tooltipRef = useRef(null)
  const dotMouseEnter = useCallback((e, index) => {
    setHoveredIdx(index)
    const rect = e.target.getBoundingClientRect()
    setDotPos({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
  }, [])
  const dotMouseLeave = useCallback(() => { setHoveredIdx(null); setDotPos(null) }, [])
  const lastPoint = data[data.length - 1]

  // Viewport-aware tooltip positioning — works on mobile & desktop
  const [tooltipStyle, setTooltipStyle] = useState({ position: 'fixed', left: -9999, top: -9999, pointerEvents: 'none' })
  useMemo(() => {
    if (!dotPos) { setTooltipStyle({ position: 'fixed', left: -9999, top: -9999, pointerEvents: 'none' }); return }
    // Double rAF to ensure content is rendered and measurable
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const el = tooltipRef.current
      if (!el) return
      const tw = el.offsetWidth || 300
      const th = el.offsetHeight || 200
      const vw = window.innerWidth
      const pad = 12
      const gap = 12
      let left = dotPos.x - tw / 2
      if (left + tw > vw - pad) left = vw - tw - pad
      if (left < pad) left = pad
      let top = dotPos.y - th - gap
      if (top < pad) top = dotPos.y + gap
      setTooltipStyle({
        position: 'fixed', zIndex: 9999, pointerEvents: 'none',
        left, top,
      })
    }))
  }, [dotPos])

  return (
    <div style={{ height, position: 'relative' }} ref={chartRef}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}
          onMouseLeave={() => { setHoveredIdx(null); setDotPos(null) }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.1)" />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-dim)' }} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 10, fill: 'var(--text-dim)' }} tickFormatter={v => v >= 10000000 ? `${(v / 10000000).toFixed(1)}Cr` : v >= 100000 ? `${(v / 100000).toFixed(1)}L` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} width={50} />
          <Tooltip content={() => null} cursor={false} isAnimationActive={false} />
          <Area type="monotone" dataKey="invested" stroke="#8b5cf6" fill={`url(#${gradientId})`} strokeWidth={2} name="Net Invested" isAnimationActive={false}
            dot={(props) => {
              const { cx, cy, payload, index } = props
              if (!cx || !cy) return null
              // Show current value as a larger green dot on the last point
              const isLast = index === data.length - 1 && lastPoint?.currentValue
              return (
                <g>
                  <circle cx={cx} cy={cy} r={hoveredIdx === index ? 6 : 4}
                    fill={payload.hasSell ? '#fb7185' : '#34d399'}
                    stroke={hoveredIdx === index ? '#8b5cf6' : 'none'} strokeWidth={hoveredIdx === index ? 2 : 0}
                    style={{ cursor: 'pointer', transition: 'r 0.15s' }}
                    onMouseEnter={(e) => dotMouseEnter(e, index)}
                    onMouseLeave={dotMouseLeave}
                  />
                  {isLast && (
                    <circle cx={cx} cy={cy} r={6} fill="#34d399" stroke="#34d399" strokeWidth={1} opacity={0.5} pointerEvents="none" />
                  )}
                </g>
              )
            }}
            activeDot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
      {createPortal(
        <div style={tooltipStyle} ref={tooltipRef}>
          {hoveredIdx !== null && data[hoveredIdx] && <JourneyTooltipContent data={data[hoveredIdx]} />}
        </div>,
        document.body
      )}
    </div>
  )
}

// Tooltip content for Investment Journey chart
function JourneyTooltipContent({ data: d }) {
  if (!d || !d.txns || !d.txns.length) return null
  // Group by portfolio
  const byPortfolio = {}
  d.txns.forEach(t => {
    const key = t.portfolioName || '_'
    if (!byPortfolio[key]) byPortfolio[key] = []
    byPortfolio[key].push(t)
  })
  const portfolioKeys = Object.keys(byPortfolio)
  const showPortfolios = portfolioKeys.length > 1 || (portfolioKeys.length === 1 && portfolioKeys[0] !== '_')

  const TxnRow = ({ t }) => (
    <div className="py-1.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${t.isBuy ? 'bg-emerald-400' : 'bg-rose-400'}`} />
          <span className="text-white/80 truncate">{t.fundName}</span>
        </div>
        <span className={`font-semibold tabular-nums shrink-0 ${t.isBuy ? 'text-emerald-400' : 'text-rose-400'}`}>
          {t.isBuy ? '+' : '-'}{formatINR(t.amount)}
        </span>
      </div>
      <div className="flex items-center gap-3 ml-[14px] mt-0.5 text-[11px]">
        <span className="text-white/30">{t.txnType}</span>
        {t.units > 0 && <span className="text-white/30 tabular-nums">{t.isBuy ? '+' : '-'}{t.units} units</span>}
        {t.realizedPL !== null && t.realizedPL !== 0 && (
          <span className={`tabular-nums font-medium ${t.realizedPL >= 0 ? 'text-emerald-400/70' : 'text-rose-400/70'}`}>
            P&L {t.realizedPL >= 0 ? '+' : ''}{formatINR(t.realizedPL)}
          </span>
        )}
      </div>
    </div>
  )

  return (
    <div className="bg-[var(--bg-dropdown)] rounded-xl shadow-2xl text-xs overflow-hidden" style={{ minWidth: 220, maxWidth: 'min(340px, calc(100vw - 24px))' }}>
      {/* Header */}
      <div className="px-3.5 py-2 bg-[var(--bg-inset)] border-b border-[var(--border-light)]">
        <span className="font-bold text-[var(--text-primary)] text-sm">{d.date}</span>
      </div>
      {/* Transactions */}
      <div className="px-3.5 py-1">
        {showPortfolios ? (
          portfolioKeys.map((pName, pi) => (
            <div key={pName}>
              {pi > 0 && <div className="border-t border-[var(--border-light)] my-1" />}
              <p className="text-[var(--text-dim)] font-semibold text-[10px] uppercase tracking-wider pt-1.5 pb-0.5">{pName}</p>
              {byPortfolio[pName].map((t, i) => <TxnRow key={i} t={t} />)}
            </div>
          ))
        ) : (
          d.txns.map((t, i) => <TxnRow key={i} t={t} />)
        )}
      </div>
      {/* Footer */}
      <div className="px-3.5 py-2 bg-[var(--bg-inset)] border-t border-[var(--border-light)]">
        <div className="flex items-center justify-between">
          <span className="text-[var(--text-dim)]">Total Invested</span>
          <span className="font-bold text-violet-400 tabular-nums">{formatINR(d.invested)}</span>
        </div>
        {d.currentValue && (
          <div className="flex items-center justify-between mt-0.5">
            <span className="text-[var(--text-dim)]">Current Value</span>
            <span className="font-bold text-emerald-400 tabular-nums">{formatINR(d.currentValue)}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default function MutualFundsPage() {
  const { selectedMember } = useFamily()
  const {
    mfPortfolios, mfHoldings, mfTransactions,
    activeMembers, activeInvestmentAccounts,
    addMFPortfolio, updateMFPortfolio, deleteMFPortfolio,
    investMF, redeemMF, switchMF, updateHoldingAllocations, toggleLumpsumRestricted, toggleSipRestricted,
    deleteMFTransaction, editMFTransaction, deleteFundFromPortfolio,
    assetAllocations, updateAssetAllocation,
  } = useData()

  const { showToast, showBlockUI, hideBlockUI } = useToast()
  const confirm = useConfirm()
  const { mv } = useMask()
  const [modal, setModal] = useState(null)
  const [selectedPortfolioId, setSelectedPortfolioId] = useState('all')
  const [subTab, setSubTab] = useState('holdings')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [txnFundFilter, setTxnFundFilter] = useState('all')
  const [txnMenuOpen, setTxnMenuOpen] = useState(null) // transactionId of open menu
  const [breakdownOpen, setBreakdownOpen] = useState(true)
  const [fundDetailHolding, setFundDetailHolding] = useState(null) // holding object for fund detail modal

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

  // Current NAV lookup for unrealized P&L on BUY transactions
  const currentNavMap = useMemo(() => {
    if (!holdings) return {}
    const map = {}
    holdings.forEach((h) => { if (h.currentNav > 0) map[`${h.portfolioId}:${h.fundCode}`] = h.currentNav })
    return map
  }, [holdings])

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
        if (!p.skipRebalance) {
          const currentPct = totalValue > 0 ? (h.currentValue / totalValue) * 100 : 0
          if (h.targetAllocationPct > 0 && Math.abs(currentPct - h.targetAllocationPct) > threshold) rebalance++
        }
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

  // Asset class, market cap & geography breakdown for selected portfolio(s)
  const breakdown = useMemo(() => {
    if (!holdings.length) return null

    const allocMap = {}
    if (assetAllocations) {
      for (const a of assetAllocations) {
        allocMap[a.fundCode] = { asset: a.assetAllocation, equity: a.equityAllocation, geo: a.geoAllocation }
      }
    }

    const asset = { Equity: 0, Debt: 0, Cash: 0, Commodities: 0, 'Real Estate': 0, Other: 0 }
    const cap = { Giant: 0, Large: 0, Mid: 0, Small: 0, Micro: 0 }
    const geo = { India: 0, Global: 0 }
    let totalValue = 0
    let hasDetailedAlloc = false
    const seenFundCodes = new Set()
    const configuredFundCodes = new Set()

    for (const h of holdings) {
      if (h.units <= 0) continue
      totalValue += h.currentValue
      const code = h.fundCode || h.schemeCode
      seenFundCodes.add(code)
      const alloc = allocMap[code]

      if (alloc?.asset) {
        hasDetailedAlloc = true
        configuredFundCodes.add(code)
        for (const [cls, pct] of Object.entries(alloc.asset)) {
          const val = h.currentValue * (pct / 100)
          if (cls in asset) asset[cls] += val
          else if (cls === 'Gold') asset.Commodities += val
          else asset.Other += val
        }
        if (alloc.equity) {
          const eqBase = h.currentValue * ((alloc.asset.Equity || 0) / 100)
          for (const [sz, pct] of Object.entries(alloc.equity)) {
            const val = eqBase * (pct / 100)
            if (sz in cap) cap[sz] += val
            else if (sz === 'Large Cap') cap.Large += val
            else if (sz === 'Mid Cap') cap.Mid += val
            else if (sz === 'Small Cap') cap.Small += val
            else cap.Small += val // unknown → Small
          }
        }
        if (alloc.geo) {
          const eqBase = h.currentValue * ((alloc.asset.Equity || 0) / 100)
          for (const [region, pct] of Object.entries(alloc.geo)) {
            const val = eqBase * (pct / 100)
            if (region in geo) geo[region] += val
            else geo.Global += val
          }
        }
      } else {
        let cat = h.category
        if (!cat || cat === 'Other') cat = inferCategory(h.fundName)
        if (cat === 'Equity' || cat === 'ELSS' || cat === 'Index') asset.Equity += h.currentValue
        else if (cat === 'Debt' || cat === 'Gilt') asset.Debt += h.currentValue
        else if (cat === 'Liquid') asset.Cash += h.currentValue
        else if (cat === 'Commodity') asset.Commodities += h.currentValue
        else if (cat === 'Multi-Asset') { asset.Equity += h.currentValue * 0.50; asset.Debt += h.currentValue * 0.30; asset.Commodities += h.currentValue * 0.20 }
        else if (cat === 'Hybrid' || cat === 'FoF') { asset.Equity += h.currentValue * 0.65; asset.Debt += h.currentValue * 0.35 }
        else asset.Other += h.currentValue
      }
    }

    if (totalValue === 0) return null

    const toList = (obj, colorMap) => Object.entries(obj)
      .filter(([, v]) => v > 0)
      .sort(([, a], [, b]) => b - a)
      .map(([name, value]) => ({ name, value, pct: (value / totalValue) * 100, fill: colorMap[name] || '#94a3b8' }))

    const assetList = toList(asset, ASSET_CLS_COLOR)
    const capRaw = Object.values(cap).reduce((s, v) => s + v, 0)
    const capList = capRaw > 0
      ? Object.entries(cap).filter(([, v]) => v > 0).sort(([, a], [, b]) => b - a)
          .map(([name, value]) => ({ name, value, pct: (value / capRaw) * 100, fill: CAP_CLS_COLOR[name] || '#94a3b8' }))
      : []
    const geoRaw = Object.values(geo).reduce((s, v) => s + v, 0)
    const geoList = geoRaw > 0
      ? Object.entries(geo).filter(([, v]) => v > 0).sort(([, a], [, b]) => b - a)
          .map(([name, value]) => ({ name, value, pct: (value / geoRaw) * 100, fill: GEO_CLS_COLOR[name] || '#94a3b8' }))
      : []

    return { assetList, capList, geoList, hasDetailedAlloc, configuredCount: configuredFundCodes.size, totalFunds: seenFundCodes.size }
  }, [holdings, assetAllocations])

  // Unique funds across selected holdings for Allocations tab
  const uniqueFunds = useMemo(() => {
    if (!holdings.length) return []
    const map = {}
    holdings.forEach(h => {
      if (!h.fundCode && !h.schemeCode) return
      if (h.units <= 0) return
      const code = (h.fundCode || h.schemeCode).toString()
      if (!map[code]) map[code] = { fundCode: code, fundName: h.fundName || '' }
    })
    return Object.values(map).sort((a, b) => a.fundName.localeCompare(b.fundName))
  }, [holdings])

  // Portfolio insights — XIRR, ATH drawdown, top/bottom performers, concentration
  const insights = useMemo(() => {
    if (!holdings.length) return null
    const activeHoldings = enrichedHoldings.filter(h => h.units > 0)
    const totalValue = activeHoldings.reduce((s, h) => s + h.currentValue, 0)
    if (totalValue === 0) return null

    // ATH Analysis — weighted average drawdown (only 5%+ below ATH is meaningful)
    const athHoldings = activeHoldings.filter(h => h.athNav > 0 && h.belowATHPct >= 5)
    const weightedDrawdown = athHoldings.length > 0
      ? athHoldings.reduce((s, h) => s + (h.belowATHPct * h.currentValue), 0) / totalValue
      : 0
    const athSorted = [...athHoldings].sort((a, b) => b.belowATHPct - a.belowATHPct)

    // Top/Bottom performers by P&L%
    const withPL = activeHoldings.filter(h => h.investment > 0)
    const topPerformers = [...withPL].sort((a, b) => b.plPct - a.plPct).slice(0, 5)
    const bottomPerformers = [...withPL].sort((a, b) => a.plPct - b.plPct).slice(0, 5)

    // Concentration — top 5 holdings by value
    const byConcen = [...activeHoldings].sort((a, b) => b.currentValue - a.currentValue)
    const top5Value = byConcen.slice(0, 5).reduce((s, h) => s + h.currentValue, 0)
    const top5Pct = totalValue > 0 ? (top5Value / totalValue) * 100 : 0
    const concentration = byConcen.slice(0, 5).map(h => ({
      ...h, pctOfTotal: totalValue > 0 ? (h.currentValue / totalValue) * 100 : 0
    }))

    // XIRR from transactions
    const relevantTxns = allFilteredTxns.filter(t => {
      const d = parseDate(t.date)
      return d && t.totalAmount > 0
    })
    const cashFlows = relevantTxns.map(t => ({
      date: parseDate(t.date),
      amount: t.type === 'SELL' ? t.totalAmount : -t.totalAmount
    }))
    cashFlows.push({ date: new Date(), amount: totalValue })
    cashFlows.sort((a, b) => a.date - b.date)
    const xirr = cashFlows.length >= 2 ? computeXIRR(cashFlows) : null

    // Simple returns
    const totalInvested = activeHoldings.reduce((s, h) => s + h.investment, 0)
    const totalPL = totalValue - totalInvested
    const totalPLPct = totalInvested > 0 ? (totalPL / totalInvested) * 100 : 0

    // Simple CAGR from earliest transaction
    const earliestDate = cashFlows.length > 1 ? cashFlows[0].date : null
    let cagr = null
    if (earliestDate && totalInvested > 0) {
      const years = (new Date() - earliestDate) / (365.25 * 86400000)
      if (years >= 0.1) {
        cagr = (Math.pow(totalValue / totalInvested, 1 / years) - 1)
      }
    }

    // Deduplicate by fund name (consolidate across portfolios)
    function dedupeByFund(arr) {
      const map = {}
      arr.forEach(h => {
        const key = h.fundName
        if (!map[key]) { map[key] = { ...h } }
        else {
          map[key].currentValue += h.currentValue
          map[key].investment += h.investment
          map[key].pl = map[key].currentValue - map[key].investment
          map[key].plPct = map[key].investment > 0 ? ((map[key].pl) / map[key].investment) * 100 : 0
          // Keep the higher ATH drawdown for buy opportunities
          if (h.belowATHPct > map[key].belowATHPct) {
            map[key].belowATHPct = h.belowATHPct
            map[key].athNav = h.athNav
          }
        }
      })
      return Object.values(map)
    }

    const athDeduped = dedupeByFund(athHoldings).sort((a, b) => b.belowATHPct - a.belowATHPct)
    const allDeduped = dedupeByFund(withPL)
    const losersDeduped = allDeduped.filter(h => h.plPct <= -5).sort((a, b) => a.plPct - b.plPct).slice(0, 5)
    const gainersDeduped = allDeduped.filter(h => h.plPct >= 5).sort((a, b) => b.plPct - a.plPct).slice(0, 5)

    // Concentration deduped
    const concDeduped = dedupeByFund(activeHoldings).sort((a, b) => b.currentValue - a.currentValue)
    const concTop5 = concDeduped.slice(0, 5)
    const concTop5Value = concTop5.reduce((s, h) => s + h.currentValue, 0)
    const concentrationDeduped = concTop5.map(h => ({
      ...h, pctOfTotal: totalValue > 0 ? (h.currentValue / totalValue) * 100 : 0
    }))

    // Investment timeline — group transactions by date
    const sortedTxns = [...relevantTxns]
      .map(t => ({ ...t, _date: parseDate(t.date) }))
      .filter(t => t._date)
      .sort((a, b) => a._date - b._date)
    let cumInvested = 0
    const dateGroups = {}
    sortedTxns.forEach(t => {
      const d = t._date
      const label = `${d.getDate()} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]} ${String(d.getFullYear()).slice(2)}`
      const isBuy = t.type === 'BUY'
      cumInvested += isBuy ? t.totalAmount : -t.totalAmount
      if (!dateGroups[label]) dateGroups[label] = { date: label, invested: 0, txns: [], hasBuy: false, hasSell: false }
      dateGroups[label].invested = Math.round(cumInvested)
      dateGroups[label].txns.push({
        fundName: splitFundName(t.fundName || '').main,
        portfolioName: displayName(t.portfolioName || ''),
        txnType: t.transactionType || t.type,
        type: t.type,
        amount: Math.round(t.totalAmount),
        units: Math.round((t.units || 0) * 1000) / 1000,
        realizedPL: !isBuy ? Math.round(t.gainLoss || 0) : null,
        isBuy,
      })
      if (isBuy) dateGroups[label].hasBuy = true
      else dateGroups[label].hasSell = true
    })
    const timeline = Object.values(dateGroups)
    // Add current value as final point
    if (timeline.length > 0) {
      timeline[timeline.length - 1].currentValue = Math.round(totalValue)
    }

    // Category breakdown from holdings
    const catMap = {}
    activeHoldings.forEach(h => {
      const cat = h.category || 'Other'
      catMap[cat] = (catMap[cat] || 0) + h.currentValue
    })
    const categoryBreakdown = Object.entries(catMap)
      .filter(([, v]) => v > 0)
      .sort(([, a], [, b]) => b - a)
      .map(([name, value]) => ({ name, value, pct: totalValue > 0 ? (value / totalValue) * 100 : 0 }))

    return { weightedDrawdown, athSorted, athDeduped, topPerformers, bottomPerformers, losersDeduped, gainersDeduped, concentration, concentrationDeduped, top5Pct, xirr, cagr, totalValue, totalInvested, totalPL, totalPLPct, timeline, categoryBreakdown }
  }, [enrichedHoldings, holdings, allFilteredTxns])

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

  async function handleSaveClassification(data) {
    showBlockUI('Saving classification...')
    try {
      await updateAssetAllocation(data)
      showToast('Fund classified')
      setModal(null)
    } catch (err) {
      showToast(err.message || 'Failed to save classification', 'error')
    } finally {
      hideBlockUI()
    }
  }

  async function handleToggleLumpsumRestricted(h) {
    const newVal = !h.lumpsumRestricted
    showBlockUI(newVal ? 'Restricting lumpsum...' : 'Enabling lumpsum...')
    try {
      await toggleLumpsumRestricted(h.portfolioId, h.fundCode || h.schemeCode, newVal)
      showToast(newVal ? 'Lumpsum restricted across all portfolios' : 'Lumpsum enabled across all portfolios')
    } catch (err) {
      showToast(err.message || 'Failed to update restriction', 'error')
    } finally {
      hideBlockUI()
    }
  }

  async function handleToggleSipRestricted(h) {
    const newVal = !h.sipRestricted
    showBlockUI(newVal ? 'Restricting SIP...' : 'Enabling SIP...')
    try {
      await toggleSipRestricted(h.portfolioId, h.fundCode || h.schemeCode, newVal)
      showToast(newVal ? 'SIP restricted across all portfolios' : 'SIP enabled across all portfolios')
    } catch (err) {
      showToast(err.message || 'Failed to update restriction', 'error')
    } finally {
      hideBlockUI()
    }
  }

  async function handleDeleteFund(portfolioId, fundCode, fundName) {
    const portfolio = portfolioData.find(p => p.portfolioId === portfolioId)
    const portfolioName = portfolio ? displayName(portfolio.portfolioName) : portfolioId
    const ok = await confirm({
      title: 'Delete Fund from Portfolio',
      message: `Delete "${splitFundName(fundName).main}" from ${portfolioName}?\n\nThis will permanently remove the fund and all its transactions from this portfolio. This cannot be undone.`,
      confirmText: 'Delete',
      danger: true,
    })
    if (!ok) return
    showBlockUI('Deleting fund...')
    try {
      const result = await deleteFundFromPortfolio(portfolioId, fundCode)
      showToast(result?.message || 'Fund deleted successfully')
      setFundDetailHolding(null)
      setModal({ allocations: portfolioId })
    } catch (err) {
      showToast(err.message || 'Failed to delete fund', 'error')
    } finally {
      hideBlockUI()
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
          {!fundDetailHolding && selectedPortfolioId !== 'all' && (<>
          {/* ── Back to All + Portfolio Name ── */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setSelectedPortfolioId('all'); setSubTab('holdings') }}
              className="flex items-center gap-1 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            >
              <ArrowLeft size={14} /> All Portfolios
            </button>
          </div>

          {/* ── Top Bar: Portfolio Selector + Actions ── */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="relative w-full sm:w-auto">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg px-4 py-2.5 text-sm font-semibold text-[var(--text-primary)] hover:border-[var(--border-light)] transition-colors w-full sm:min-w-[220px]"
              >
                <Wallet size={14} className="text-violet-400 shrink-0" />
                <span className="truncate">{dropdownLabel}</span>
                <ChevronDown size={14} className={`text-[var(--text-dim)] shrink-0 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {dropdownOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setDropdownOpen(false)} />
                  <div className="absolute left-0 right-0 sm:right-auto top-full mt-1 z-40 bg-[var(--bg-dropdown)] border border-white/10 rounded-lg shadow-2xl sm:min-w-[300px] py-1 overflow-hidden">
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

            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {selectedPortfolio && (
                <>
                  <button onClick={() => setModal({ allocations: selectedPortfolio.portfolioId })} className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-[var(--bg-card)] border border-[var(--border)] rounded-lg transition-colors">
                    <Settings2 size={12} /> Allocations
                  </button>
                  <button onClick={() => setModal({ editPortfolio: selectedPortfolio })} className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-[var(--bg-card)] border border-[var(--border)] rounded-lg transition-colors">
                    <Pencil size={12} /> Edit
                  </button>
                </>
              )}
              <button onClick={() => setModal('addPortfolio')} className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-violet-400 hover:text-violet-300 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg transition-colors">
                <Plus size={13} /> New Portfolio
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
          </>)}

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

          {/* ═══ ALL PORTFOLIOS — Breakdown + Table + Chart ═══ */}
          {selectedPortfolioId === 'all' && (
            <>
            {/* Portfolio Breakdown — Pie Charts (shown first in All view) */}
            {breakdown && breakdown.assetList.length > 0 && (
              <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] overflow-hidden">
                <button onClick={() => setBreakdownOpen(p => !p)} className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-[var(--bg-hover)] transition-colors">
                  <span className="text-sm font-bold text-[var(--text-muted)] uppercase tracking-wider">Portfolio Breakdown</span>
                  <ChevronDown size={14} className={`text-[var(--text-dim)] transition-transform duration-200 ${breakdownOpen ? 'rotate-180' : ''}`} />
                </button>
                {breakdownOpen && (
                  <div className="px-4 pb-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <DonutCard title="Asset Class" data={breakdown.assetList} bgMap={ASSET_BG} />
                      {breakdown.capList.length > 0
                        ? <DonutCard title="Market Cap" data={breakdown.capList} bgMap={CAP_BG} />
                        : <div className="flex items-center justify-center rounded-lg bg-[var(--bg-inset)] border border-[var(--border-light)] p-4">
                            <p className="text-xs text-[var(--text-dim)] text-center">Classify funds for<br/>market cap breakdown</p>
                          </div>
                      }
                      {breakdown.geoList?.length > 0
                        ? <DonutCard title="Geography" data={breakdown.geoList} bgMap={GEO_BG} />
                        : <div className="flex items-center justify-center rounded-lg bg-[var(--bg-inset)] border border-[var(--border-light)] p-4">
                            <p className="text-xs text-[var(--text-dim)] text-center">Classify funds for<br/>geography breakdown</p>
                          </div>
                      }
                    </div>
                    {!breakdown.hasDetailedAlloc && (
                      <p className="text-xs text-[var(--text-dim)]/50 mt-2 text-center">Based on fund category. Go to Fund Breakdown tab to add detailed data from Morningstar.</p>
                    )}
                    {breakdown.hasDetailedAlloc && breakdown.configuredCount < breakdown.totalFunds && (
                      <p className="text-xs text-amber-400/70 mt-2 text-center">
                        {breakdown.totalFunds - breakdown.configuredCount} of {breakdown.totalFunds} funds not yet classified
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Investment Journey Chart */}
            {insights && insights.timeline.length >= 2 && (
              <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-4">
                <p className="text-sm font-bold text-[var(--text-muted)] uppercase tracking-wider mb-3">Investment Journey</p>
                <JourneyChart data={insights.timeline} gradientId="globalInvestedGrad" />
                <div className="flex items-center gap-4 mt-2 text-xs text-[var(--text-dim)]">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> Buy</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-400 inline-block" /> Sell</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" /> Current Value</span>
                </div>
              </div>
            )}

            {/* Portfolio Summary Table */}
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-[var(--text-muted)] uppercase tracking-wider">Portfolios</p>
              <button onClick={() => setModal('addPortfolio')} className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-violet-400 hover:text-violet-300 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg transition-colors">
                <Plus size={13} /> New Portfolio
              </button>
            </div>
            {portfolioData.length > 0 ? (
              <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] overflow-hidden">
                {/* Desktop table */}
                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border-light)] bg-[var(--bg-inset)]">
                        <th className="text-left py-2 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Portfolio</th>
                        <th className="text-right py-2 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Funds</th>
                        <th className="text-right py-2 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Invested</th>
                        <th className="text-right py-2 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Current</th>
                        <th className="text-right py-2 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Unrealized P&L</th>
                        <th className="text-right py-2 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Realized P&L</th>
                        <th className="text-right py-2 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Total P&L</th>
                        <th className="py-2 px-2 w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {portfolioData.map(p => {
                        const unrealPL = p.currentValue - p.totalInvestment
                        const unrealUp = unrealPL >= 0
                        const unrealPct = p.totalInvestment > 0 ? (unrealPL / p.totalInvestment) * 100 : 0
                        const realPL = p.realizedPL || 0
                        const realUp = realPL >= 0
                        const totalPLUp = p.totalPL >= 0
                        const ind = portfolioIndicators[p.portfolioId] || {}
                        return (
                          <tr key={p.portfolioId} className="border-b border-[var(--border-light)] last:border-0 hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
                              onClick={() => { setSelectedPortfolioId(p.portfolioId); setSubTab('holdings') }}>
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm font-semibold text-[var(--text-primary)]">{displayName(p.portfolioName)}</span>
                                {ind.buyOpp > 0 && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" title={`${ind.buyOpp} buy opportunities`} />}
                                {ind.rebalance > 0 && <span className="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" title={`${ind.rebalance} funds need rebalancing`} />}
                              </div>
                              <p className="text-xs text-[var(--text-dim)]">{mv(p.ownerName, 'name')} · {p.platform}</p>
                            </td>
                            <td className="py-2.5 px-3 text-right text-xs text-[var(--text-secondary)] tabular-nums">{p.fundCount}</td>
                            <td className="py-2.5 px-3 text-right text-xs text-[var(--text-secondary)] tabular-nums">{formatINR(p.totalInvestment)}</td>
                            <td className="py-2.5 px-3 text-right text-xs font-semibold text-[var(--text-primary)] tabular-nums">{formatINR(p.currentValue)}</td>
                            <td className="py-2.5 px-3 text-right">
                              <span className={`text-xs font-semibold tabular-nums ${unrealUp ? 'text-emerald-400' : 'text-[var(--accent-rose)]'}`}>
                                {unrealUp ? '+' : ''}{formatINR(unrealPL)}
                              </span>
                              <span className={`text-xs tabular-nums ml-1 ${unrealUp ? 'text-emerald-400/60' : 'text-[var(--accent-rose)]/60'}`}>
                                ({unrealUp ? '+' : ''}{unrealPct.toFixed(1)}%)
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <span className={`text-xs font-semibold tabular-nums ${realUp ? 'text-emerald-400' : 'text-[var(--accent-rose)]'}`}>
                                {realUp ? '+' : ''}{formatINR(realPL)}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <span className={`text-xs font-bold tabular-nums ${totalPLUp ? 'text-emerald-400' : 'text-[var(--accent-rose)]'}`}>
                                {totalPLUp ? '+' : ''}{formatINR(p.totalPL)}
                              </span>
                              <span className={`text-xs tabular-nums ml-1 ${totalPLUp ? 'text-emerald-400/60' : 'text-[var(--accent-rose)]/60'}`}>
                                ({totalPLUp ? '+' : ''}{p.totalPLPct.toFixed(1)}%)
                              </span>
                            </td>
                            <td className="py-2.5 px-2">
                              <button
                                onClick={(e) => { e.stopPropagation(); setModal({ editPortfolio: p }) }}
                                className="w-6 h-6 flex items-center justify-center rounded-full text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
                                title="Edit portfolio"
                              >
                                <Pencil size={12} />
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                {/* Mobile cards */}
                <div className="lg:hidden divide-y divide-[var(--border-light)]">
                  {portfolioData.map(p => {
                    const unrealPL = p.currentValue - p.totalInvestment
                    const unrealUp = unrealPL >= 0
                    const totalPLUp = p.totalPL >= 0
                    const ind = portfolioIndicators[p.portfolioId] || {}
                    return (
                      <div key={p.portfolioId} className="px-4 py-3 hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
                           onClick={() => { setSelectedPortfolioId(p.portfolioId); setSubTab('holdings') }}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{displayName(p.portfolioName)}</p>
                            {ind.buyOpp > 0 && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />}
                            {ind.rebalance > 0 && <span className="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />}
                            <ChevronRight size={14} className="text-[var(--text-dim)] shrink-0" />
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); setModal({ editPortfolio: p }) }}
                            className="w-6 h-6 flex items-center justify-center rounded-full text-[var(--text-dim)] hover:text-[var(--text-primary)] shrink-0"
                          >
                            <Pencil size={12} />
                          </button>
                        </div>
                        <p className="text-xs text-[var(--text-dim)] mt-0.5">{mv(p.ownerName, 'name')} · {p.platform} · {p.fundCount} funds</p>
                        <div className="flex items-center gap-4 mt-2 text-xs tabular-nums">
                          <div>
                            <p className="text-[var(--text-dim)] uppercase text-[10px] font-semibold">Invested</p>
                            <p className="text-[var(--text-secondary)]">{formatINR(p.totalInvestment)}</p>
                          </div>
                          <div>
                            <p className="text-[var(--text-dim)] uppercase text-[10px] font-semibold">Current</p>
                            <p className="text-[var(--text-primary)] font-semibold">{formatINR(p.currentValue)}</p>
                          </div>
                          <div>
                            <p className="text-[var(--text-dim)] uppercase text-[10px] font-semibold">Total P&L</p>
                            <p className={`font-bold ${totalPLUp ? 'text-emerald-400' : 'text-[var(--accent-rose)]'}`}>
                              {totalPLUp ? '+' : ''}{formatINR(p.totalPL)}
                              <span className="font-normal ml-1">({totalPLUp ? '+' : ''}{p.totalPLPct.toFixed(1)}%)</span>
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] py-12 flex flex-col items-center gap-3">
                <Wallet size={32} className="text-[var(--text-dim)]" />
                <p className="text-sm text-[var(--text-muted)]">No mutual fund portfolios yet</p>
                <button onClick={() => setModal('addPortfolio')} className="text-xs font-semibold text-violet-400 hover:text-violet-300">
                  Create your first portfolio
                </button>
              </div>
            )}

            </>
          )}

          {fundDetailHolding ? (() => {
            const h = fundDetailHolding
            const ath = athColor(h.belowATHPct)
            const unrealUp = h.pl >= 0
            const pData = portfolioData.find((p) => p.portfolioId === h.portfolioId)
            const fundTxns = allFilteredTxns.filter(t => t.fundCode === h.schemeCode && t.portfolioId === h.portfolioId)
            return (
              <div className="space-y-3">
                {/* Back + Fund Name + Portfolio badge */}
                <div className="flex items-start gap-2.5">
                  <button onClick={() => setFundDetailHolding(null)} className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors mt-0.5 shrink-0">
                    <ArrowLeft size={16} />
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-[var(--text-primary)] leading-tight">{splitFundName(h.fundName).main}</p>
                    {splitFundName(h.fundName).plan && <p className="text-xs text-[var(--text-dim)] mt-0.5">{splitFundName(h.fundName).plan}</p>}
                  </div>
                  {pData && (
                    <div className="text-right shrink-0 mt-0.5">
                      <p className="text-xs font-semibold text-[var(--text-secondary)]">{mv(pData.ownerName, 'name')}</p>
                      <p className="text-xs text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded mt-0.5 inline-block">{displayName(pData.portfolioName)} · {pData.platform}</p>
                    </div>
                  )}
                </div>

                {/* Value + Returns — compact inline */}
                <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] px-4 py-2.5 flex items-baseline justify-between">
                  <p className="text-lg font-bold text-[var(--text-primary)] tabular-nums">{formatINR(h.currentValue)}</p>
                  <p className={`text-xs font-semibold tabular-nums ${unrealUp ? 'text-emerald-400' : 'text-[var(--accent-rose)]'}`}>
                    {unrealUp ? '+' : ''}{formatINR(h.pl)} ({unrealUp ? '+' : ''}{h.plPct.toFixed(1)}%)
                  </p>
                </div>

                {/* Detail grid — compact rows */}
                <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] divide-y divide-[var(--border-light)]">
                  <DetailRow label="Invested" value={formatINR(h.investment)} />
                  <DetailRow label="Units" value={h.units.toFixed(3)} />
                  <DetailRow label="NAV (Current / Avg)" value={`₹${h.currentNav.toFixed(2)} / ₹${h.avgNav.toFixed(2)}`} />
                  <DetailRow label="Allocation (Current / Target)" value={`${h.currentAllocationPct.toFixed(1)}% / ${h.targetAllocationPct.toFixed(1)}%`} />
                  {h.athNav > 0 && (
                    <DetailRow
                      label="ATH"
                      value={h.belowATHPct > 0 ? `↓${h.belowATHPct.toFixed(1)}% (₹${h.athNav.toFixed(2)})` : 'At All-Time High'}
                      valueStyle={h.belowATHPct > 0 ? ath : { color: '#34d399' }}
                    />
                  )}
                  {h.ongoingSIP > 0 && (
                    <DetailRow label="Monthly SIP" value={formatINR(h.ongoingSIP)} valueClass="text-blue-400" />
                  )}
                </div>

                {/* Actions — compact inline buttons */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setModal({ invest: { portfolioId: h.portfolioId, fundCode: h.schemeCode, fundName: h.fundName } })}
                    className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-[var(--bg-card)] border border-[var(--border)] rounded-lg transition-colors ${h.lumpsumRestricted && h.sipRestricted ? 'text-[var(--text-dim)] cursor-not-allowed opacity-50' : 'text-emerald-400 hover:bg-emerald-500/10'}`}
                    disabled={h.lumpsumRestricted && h.sipRestricted}
                    title={h.lumpsumRestricted && h.sipRestricted ? 'Both SIP and Lumpsum are restricted' : 'Buy / Invest'}
                  >
                    <Plus size={14} /> Invest
                  </button>
                  <button
                    onClick={() => setModal({ redeem: { portfolioId: h.portfolioId, fundCode: h.schemeCode } })}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-400 bg-[var(--bg-card)] border border-[var(--border)] hover:bg-rose-500/10 rounded-lg transition-colors"
                  >
                    <Minus size={14} /> Redeem
                  </button>
                  <button
                    onClick={() => setModal({ switchFunds: h.portfolioId })}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-amber-400 bg-[var(--bg-card)] border border-[var(--border)] hover:bg-amber-500/10 rounded-lg transition-colors"
                  >
                    <Repeat2 size={14} /> Switch
                  </button>
                  <button
                    onClick={() => handleDeleteFund(h.portfolioId, h.schemeCode, h.fundName)}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[var(--text-dim)] bg-[var(--bg-card)] border border-[var(--border)] hover:bg-rose-500/10 hover:text-rose-400 rounded-lg transition-colors ml-auto"
                    title="Delete fund from portfolio"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* Fund Transactions */}
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wider text-[var(--text-dim)] px-1 mb-2">Transactions ({fundTxns.length})</p>
                  {fundTxns.length > 0 ? (
                    <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] overflow-hidden">
                      {/* Desktop table */}
                      <div className="hidden sm:block overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-[var(--border-light)] bg-[var(--bg-inset)]">
                              <th className="text-left py-2 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Date</th>
                              <th className="text-left py-2 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Type</th>
                              <th className="text-right py-2 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Units</th>
                              <th className="text-right py-2 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">NAV</th>
                              <th className="text-right py-2 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Amount</th>
                              <th className="text-right py-2 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">P&L</th>
                              <th className="w-8"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {fundTxns.map((t, idx) => {
                              const isBuy = t.type === 'BUY'
                              const hasRealized = !isBuy && t.gainLoss != null && t.gainLoss !== 0
                              const hasUnrealized = isBuy && h.currentNav > 0 && t.price > 0 && t.units > 0
                              const unrealizedPL = hasUnrealized ? (h.currentNav - t.price) * t.units : 0
                              const unrealizedPLPct = hasUnrealized ? ((h.currentNav - t.price) / t.price) * 100 : 0
                              const gl = hasRealized ? t.gainLoss : hasUnrealized ? unrealizedPL : null
                              const glUp = gl != null && gl >= 0
                              const typeBadge = {
                                INITIAL: { bg: 'bg-purple-500/15', text: 'text-purple-400' },
                                SIP: { bg: 'bg-blue-500/15', text: 'text-blue-400' },
                                LUMPSUM: { bg: 'bg-emerald-500/15', text: 'text-emerald-400' },
                                WITHDRAWAL: { bg: 'bg-rose-500/15', text: 'text-[var(--accent-rose)]' },
                                SWITCH: { bg: 'bg-amber-500/15', text: 'text-amber-400' },
                              }[t.transactionType] || { bg: 'bg-gray-500/15', text: 'text-[var(--text-muted)]' }
                              return (
                                <tr key={t.transactionId || `fd-txn-${idx}`} className="border-b border-[var(--border-light)] last:border-0 hover:bg-[var(--bg-hover)] transition-colors">
                                  <td className="py-2.5 px-3 text-xs text-[var(--text-secondary)]">{t.date}</td>
                                  <td className="py-2.5 px-3">
                                    <div className="flex items-center gap-1.5">
                                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isBuy ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-[var(--accent-rose)]'}`}>{t.type}</span>
                                      <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${typeBadge.bg} ${typeBadge.text}`}>{t.transactionType}</span>
                                    </div>
                                  </td>
                                  <td className="py-2.5 px-3 text-right text-xs text-[var(--text-secondary)] tabular-nums">{t.units.toFixed(2)}</td>
                                  <td className="py-2.5 px-3 text-right text-xs text-[var(--text-muted)] tabular-nums">₹{t.price.toFixed(2)}</td>
                                  <td className="py-2.5 px-3 text-right text-xs font-semibold text-[var(--text-primary)] tabular-nums">{formatINR(t.totalAmount)}</td>
                                  <td className="py-2.5 px-3 text-right">
                                    {(hasRealized || hasUnrealized) ? (
                                      <div>
                                        <span className={`text-xs font-semibold tabular-nums ${glUp ? 'text-emerald-400' : 'text-[var(--accent-rose)]'}`}>{glUp ? '+' : ''}{formatINR(gl)}</span>
                                        {hasUnrealized && <p className={`text-[10px] tabular-nums ${glUp ? 'text-emerald-400/70' : 'text-[var(--accent-rose)]/70'}`}>{unrealizedPLPct >= 0 ? '+' : ''}{unrealizedPLPct.toFixed(1)}%</p>}
                                      </div>
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
                        {fundTxns.map((t, idx) => {
                          const isBuy = t.type === 'BUY'
                          const hasRealized = !isBuy && t.gainLoss != null && t.gainLoss !== 0
                          const hasUnrealized = isBuy && h.currentNav > 0 && t.price > 0 && t.units > 0
                          const unrealizedPL = hasUnrealized ? (h.currentNav - t.price) * t.units : 0
                          const unrealizedPLPct = hasUnrealized ? ((h.currentNav - t.price) / t.price) * 100 : 0
                          const gl = hasRealized ? t.gainLoss : hasUnrealized ? unrealizedPL : null
                          const glUp = gl != null && gl >= 0
                          return (
                            <div key={t.transactionId || `fd-txn-m-${idx}`} className="px-4 py-3">
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-1.5">
                                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isBuy ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-[var(--accent-rose)]'}`}>{t.type}</span>
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
                              <div className="flex items-center justify-between text-xs">
                                <p className="text-[var(--text-dim)]">{t.units.toFixed(2)} units @ ₹{t.price.toFixed(2)}</p>
                                <div className="text-right">
                                  <p className="text-xs font-semibold text-[var(--text-primary)] tabular-nums">{formatINR(t.totalAmount)}</p>
                                  {(hasRealized || hasUnrealized) && (
                                    <p className={`text-xs font-semibold tabular-nums ${glUp ? 'text-emerald-400' : 'text-[var(--accent-rose)]'}`}>
                                      {hasUnrealized ? 'P&L' : 'G/L'}: {glUp ? '+' : ''}{formatINR(gl)} {hasUnrealized ? `(${unrealizedPLPct >= 0 ? '+' : ''}${unrealizedPLPct.toFixed(1)}%)` : ''}
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
                    <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] py-8 flex flex-col items-center gap-2">
                      <List size={24} className="text-[var(--text-dim)]" />
                      <p className="text-xs text-[var(--text-muted)]">No transactions yet</p>
                    </div>
                  )}
                </div>
              </div>
            )
          })() : (<>
          {/* ── Portfolio Breakdown — Collapsible Donut Charts (individual portfolio only) ── */}
          {selectedPortfolioId !== 'all' && breakdown && breakdown.assetList.length > 0 && (
            <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] overflow-hidden">
              <button onClick={() => setBreakdownOpen(p => !p)} className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-[var(--bg-hover)] transition-colors">
                <span className="text-sm font-bold text-[var(--text-muted)] uppercase tracking-wider">Portfolio Breakdown</span>
                <ChevronDown size={14} className={`text-[var(--text-dim)] transition-transform duration-200 ${breakdownOpen ? 'rotate-180' : ''}`} />
              </button>
              {breakdownOpen && (
                <div className="px-4 pb-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <DonutCard title="Asset Class" data={breakdown.assetList} bgMap={ASSET_BG} />
                    {breakdown.capList.length > 0
                      ? <DonutCard title="Market Cap" data={breakdown.capList} bgMap={CAP_BG} />
                      : <div className="flex items-center justify-center rounded-lg bg-[var(--bg-inset)] border border-[var(--border-light)] p-4">
                          <p className="text-xs text-[var(--text-dim)] text-center">Classify funds for<br/>market cap breakdown</p>
                        </div>
                    }
                    {breakdown.geoList?.length > 0
                      ? <DonutCard title="Geography" data={breakdown.geoList} bgMap={GEO_BG} />
                      : <div className="flex items-center justify-center rounded-lg bg-[var(--bg-inset)] border border-[var(--border-light)] p-4">
                          <p className="text-xs text-[var(--text-dim)] text-center">Classify funds for<br/>geography breakdown</p>
                        </div>
                    }
                  </div>
                  {!breakdown.hasDetailedAlloc && (
                    <p className="text-xs text-[var(--text-dim)]/50 mt-2 text-center">Based on fund category. Go to Fund Breakdown tab to add detailed data from Morningstar.</p>
                  )}
                  {breakdown.hasDetailedAlloc && breakdown.configuredCount < breakdown.totalFunds && (
                    <p className="text-xs text-amber-400/70 mt-2 text-center">
                      {breakdown.totalFunds - breakdown.configuredCount} of {breakdown.totalFunds} funds not yet classified
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Investment Journey (individual portfolio) ── */}
          {selectedPortfolioId !== 'all' && insights && insights.timeline.length >= 2 && (
            <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-4">
              <p className="text-sm font-bold text-[var(--text-muted)] uppercase tracking-wider mb-3">Investment Journey</p>
              <JourneyChart data={insights.timeline} gradientId="portfolioInvestedGrad" height={200} />
              <div className="flex items-center gap-4 mt-2 text-xs text-[var(--text-dim)]">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> Buy</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-400 inline-block" /> Sell</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" /> Current Value</span>
              </div>
            </div>
          )}

          {/* ── Sub-tabs + Action Buttons (only for individual portfolio) ── */}
          {selectedPortfolioId !== 'all' && (
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-1 bg-[var(--bg-inset)] rounded-lg p-0.5 shrink-0">
              <button
                onClick={() => setSubTab('holdings')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                  subTab === 'holdings'
                    ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}
              >
                <Layers size={12} /> Holdings ({holdings.length})
              </button>
              <button
                onClick={() => setSubTab('transactions')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                  subTab === 'transactions'
                    ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}
              >
                <List size={12} /> Transactions ({allFilteredTxns.length})
              </button>
              <button
                onClick={() => setSubTab('breakdown')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                  subTab === 'breakdown'
                    ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}
              >
                <PieChartIcon size={12} /> Fund Breakdown ({uniqueFunds.length})
              </button>
            </div>
            <div className="flex items-center gap-1.5 ml-auto shrink-0">
              <button
                onClick={() => setModal({ invest: selectedPortfolioId })}
                className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-emerald-400 hover:text-emerald-300 bg-[var(--bg-card)] border border-[var(--border)] hover:bg-[var(--bg-hover)] rounded-lg transition-colors"
              >
                <TrendingUp size={12} /> Invest
              </button>
              <button
                onClick={() => holdings.length > 0 && setModal({ redeem: selectedPortfolioId })}
                disabled={holdings.length === 0}
                className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors ${holdings.length === 0 ? 'border-[var(--border)] text-[var(--text-dim)] cursor-not-allowed opacity-50 bg-[var(--bg-card)]' : 'text-rose-400 hover:text-rose-300 bg-[var(--bg-card)] border-[var(--border)] hover:bg-[var(--bg-hover)]'}`}
              >
                <ArrowDownCircle size={12} /> Redeem
              </button>
              <button
                onClick={() => holdings.length > 0 && setModal({ switchFunds: selectedPortfolioId })}
                disabled={holdings.length === 0}
                className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors ${holdings.length === 0 ? 'border-[var(--border)] text-[var(--text-dim)] cursor-not-allowed opacity-50 bg-[var(--bg-card)]' : 'text-amber-400 hover:text-amber-300 bg-[var(--bg-card)] border-[var(--border)] hover:bg-[var(--bg-hover)]'}`}
              >
                <Repeat2 size={12} /> Switch
              </button>
            </div>
          </div>
          )}

          {/* ── Holdings Tab ── */}
          {selectedPortfolioId !== 'all' && subTab === 'holdings' && (
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
                  {selectedPortfolioId === 'all' && groupPortfolio && (() => {
                    const groupInvested = groupHoldings.reduce((s, h) => s + h.investment, 0)
                    const groupPLPct = groupInvested > 0 ? (groupPL / groupInvested) * 100 : 0
                    return (
                    <button
                      onClick={() => { setSelectedPortfolioId(group.portfolioId); setSubTab('holdings') }}
                      className="w-full px-4 py-2.5 border-b border-[var(--border-light)] bg-[var(--bg-inset)] hover:bg-[var(--bg-inset-hover)] transition-colors text-left"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-bold text-[var(--text-primary)]">{displayName(groupPortfolio.portfolioName)}</p>
                          <ChevronRight size={14} className="text-[var(--text-dim)]" />
                        </div>
                        <div className="flex items-center gap-3 text-xs tabular-nums">
                          <span className="text-[var(--text-muted)]">{formatINR(groupPortfolio.currentValue || 0)}</span>
                          <span className={`font-bold ${groupPLUp ? 'text-emerald-400' : 'text-[var(--accent-rose)]'}`}>
                            {groupPLUp ? '+' : ''}{formatINR(groupPL)} ({groupPLUp ? '+' : ''}{groupPLPct.toFixed(1)}%)
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-[var(--text-dim)] mt-0.5">{mv(groupPortfolio.ownerName, 'name')} · {groupHoldings.filter(h => h.units > 0).length} funds</p>
                    </button>
                    )
                  })()}
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
                            <div className="text-xs font-medium text-[var(--text-dim)]">Current / Avg</div>
                          </th>
                          <th className="text-center py-2 px-2 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">
                            <div>ATH</div>
                            <div className="text-xs font-medium text-[var(--text-dim)]">Below Peak</div>
                          </th>
                          <th className="text-right py-2 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">
                            <div>Allocation %</div>
                            <div className="text-xs font-medium text-[var(--text-dim)]">Current / Target</div>
                          </th>
                          <th className="text-right py-2 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">
                            <div>Amount</div>
                            <div className="text-xs font-medium text-[var(--text-dim)]">Current / Invested</div>
                          </th>
                          <th className="text-right py-2 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">
                            <div>P&L</div>
                            <div className="text-xs font-medium text-[var(--text-dim)]">on Holdings</div>
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

                          // P&L on current holdings
                          const unrealizedPL = h.pl
                          const unrealUp = unrealizedPL >= 0

                          // Planned fund: catch-up lumpsum + steady SIP
                          const plannedBuy = isPlanned && h.targetAllocationPct > 0 && h.targetAllocationPct < 100 && totalPortfolioValue > 0
                            ? (h.targetAllocationPct / (100 - h.targetAllocationPct)) * totalPortfolioValue : 0
                          const steadySIP = isPlanned && h.targetAllocationPct > 0 && pData?.sipTarget >= 100
                            ? (h.targetAllocationPct / 100) * pData.sipTarget : 0

                          return (
                            <tr
                              key={h._key}
                              className={`border-b border-[var(--border-light)] last:border-0 transition-colors ${isPlanned ? 'opacity-60' : 'hover:bg-[var(--bg-hover)]'}`}
                            >
                              <td className="py-3.5 px-3 max-w-[240px]">
                                <div>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); if (!isPlanned) setFundDetailHolding(h) }}
                                    className={`text-xs leading-tight text-left ${isPlanned ? 'text-[var(--text-secondary)] cursor-default' : 'text-[var(--text-secondary)] hover:text-violet-400 transition-colors cursor-pointer'}`}
                                  >
                                    <span className="flex items-center gap-1.5 flex-wrap">
                                      {splitFundName(h.fundName).main}
                                      {isPlanned && <span className="text-xs font-semibold text-violet-400 bg-violet-500/15 px-1.5 py-0.5 rounded">Planned</span>}
                                      {h.lumpsumRestricted && h.sipRestricted && <span className="text-xs font-semibold text-red-400 bg-red-500/15 px-1 py-0.5 rounded flex items-center gap-0.5"><Lock size={9} />Blocked</span>}
                                      {h.lumpsumRestricted && !h.sipRestricted && <span className="text-xs font-semibold text-amber-400 bg-amber-500/15 px-1 py-0.5 rounded flex items-center gap-0.5"><Lock size={9} />SIP only</span>}
                                      {!h.lumpsumRestricted && h.sipRestricted && <span className="text-xs font-semibold text-amber-400 bg-amber-500/15 px-1 py-0.5 rounded flex items-center gap-0.5"><Lock size={9} />Lumpsum only</span>}
                                    </span>
                                    {splitFundName(h.fundName).plan && <p className="text-xs text-[var(--text-dim)] font-normal mt-0.5">{splitFundName(h.fundName).plan}</p>}
                                  </button>
                                  {isPlanned && (plannedBuy > 0 || steadySIP > 0) && (
                                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                      {plannedBuy > 0 && <span className="text-xs text-emerald-400 font-semibold">Buy {formatINR(plannedBuy)}</span>}
                                      {steadySIP > 0 && <span className="text-xs text-blue-400 font-semibold">SIP {formatINR(steadySIP)}/mo</span>}
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="py-3.5 px-3 text-right text-xs text-[var(--text-secondary)] tabular-nums">{isPlanned ? '—' : h.units.toFixed(2)}</td>
                              <td className="py-3.5 px-3 text-right">
                                {isPlanned ? (
                                  <span className="text-xs text-[var(--text-dim)]">—</span>
                                ) : (
                                  <>
                                    <p className="text-xs font-semibold text-[var(--text-primary)] tabular-nums">₹{h.currentNav.toFixed(2)}</p>
                                    <p className="text-xs text-[var(--text-dim)] tabular-nums mt-0.5">₹{h.avgNav.toFixed(2)}</p>
                                  </>
                                )}
                              </td>
                              <td className="py-3.5 px-2 text-center">
                                {isPlanned ? (
                                  <span className="text-xs text-[var(--text-dim)]">—</span>
                                ) : h.athNav > 0 && h.belowATHPct > 0 ? (
                                  <div>
                                    <p className="text-sm font-bold tabular-nums" style={ath}>↓{h.belowATHPct.toFixed(1)}%</p>
                                    <p className="text-xs text-[var(--text-muted)] tabular-nums mt-0.5">₹{h.athNav.toFixed(2)}</p>
                                  </div>
                                ) : h.athNav > 0 ? (
                                  <span className="text-xs text-emerald-400/70 font-semibold">AT HIGH</span>
                                ) : (
                                  <span className="text-xs text-[var(--text-dim)]">—</span>
                                )}
                              </td>
                              <td className="py-3.5 px-3 text-right">
                                {isPlanned ? (
                                  <p className="text-xs font-semibold text-violet-400 tabular-nums">{h.targetAllocationPct.toFixed(1)}%</p>
                                ) : (
                                  <>
                                    <p className="text-xs font-semibold text-[var(--text-primary)] tabular-nums">{h.currentAllocationPct.toFixed(1)}%</p>
                                    <p className="text-xs text-[var(--text-dim)] tabular-nums mt-0.5">{h.targetAllocationPct.toFixed(1)}%</p>
                                  </>
                                )}
                              </td>
                              <td className="py-3.5 px-3 text-right">
                                {isPlanned ? (
                                  <span className="text-xs text-[var(--text-dim)]">—</span>
                                ) : (
                                  <>
                                    <p className="text-xs font-semibold text-[var(--text-primary)] tabular-nums">{formatINR(h.currentValue)}</p>
                                    <p className="text-xs text-[var(--text-dim)] tabular-nums mt-0.5">{formatINR(h.investment)}</p>
                                  </>
                                )}
                              </td>
                              <td className="py-3.5 px-3 text-right">
                                {isPlanned ? (
                                  <span className="text-xs text-[var(--text-dim)]">—</span>
                                ) : (
                                  <>
                                    <p className={`text-xs font-semibold tabular-nums ${unrealUp ? 'text-emerald-400' : 'text-[var(--accent-rose)]'}`}>
                                      {unrealUp ? '+' : ''}{formatINR(unrealizedPL)}
                                    </p>
                                    <p className={`text-xs font-bold tabular-nums mt-0.5 ${unrealUp ? 'text-emerald-400' : 'text-[var(--accent-rose)]'}`}>
                                      {unrealUp ? '+' : ''}{h.plPct.toFixed(1)}%
                                    </p>
                                  </>
                                )}
                              </td>
                              <td className="py-3.5 px-2 text-center">
                                <div className="flex items-center gap-0.5 justify-center">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setModal({ invest: { portfolioId: h.portfolioId, fundCode: h.schemeCode, fundName: h.fundName } }) }}
                                    className={`w-6 h-6 flex items-center justify-center rounded-full transition-colors ${h.lumpsumRestricted && h.sipRestricted ? 'bg-slate-500/15 text-[var(--text-dim)] cursor-not-allowed' : 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'}`}
                                    title={h.lumpsumRestricted && h.sipRestricted ? 'Blocked — both SIP and Lumpsum restricted' : 'Buy / Invest'}
                                    disabled={h.lumpsumRestricted && h.sipRestricted}
                                  >
                                    <Plus size={14} strokeWidth={2.5} />
                                  </button>
                                  {!isPlanned && (
                                    <>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); setModal({ redeem: { portfolioId: h.portfolioId, fundCode: h.schemeCode } }) }}
                                        className="w-6 h-6 flex items-center justify-center rounded-full bg-rose-500/15 text-rose-400 hover:bg-rose-500/25 transition-colors"
                                        title="Sell / Redeem"
                                      >
                                        <Minus size={14} strokeWidth={2.5} />
                                      </button>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); setModal({ switchFunds: h.portfolioId }) }}
                                        className="w-6 h-6 flex items-center justify-center rounded-full bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 transition-colors"
                                        title="Switch Fund"
                                      >
                                        <Repeat2 size={14} strokeWidth={2.5} />
                                      </button>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleToggleLumpsumRestricted(h) }}
                                        className={`w-6 h-6 flex items-center justify-center rounded-full transition-colors ${h.lumpsumRestricted ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30' : 'bg-[var(--bg-inset)] text-[var(--text-dim)] hover:text-amber-400 hover:bg-amber-500/15'}`}
                                        title={h.lumpsumRestricted ? 'Lumpsum restricted — click to allow' : 'Click to restrict lumpsum'}
                                      >
                                        <IndianRupee size={11} strokeWidth={2.5} className={h.lumpsumRestricted ? 'line-through' : ''} />
                                      </button>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleToggleSipRestricted(h) }}
                                        className={`w-6 h-6 flex items-center justify-center rounded-full transition-colors ${h.sipRestricted ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30' : 'bg-[var(--bg-inset)] text-[var(--text-dim)] hover:text-amber-400 hover:bg-amber-500/15'}`}
                                        title={h.sipRestricted ? 'SIP restricted — click to allow' : 'Click to restrict SIP'}
                                      >
                                        <Repeat size={11} strokeWidth={2.5} className={h.sipRestricted ? 'line-through' : ''} />
                                      </button>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleDeleteFund(h.portfolioId, h.schemeCode, h.fundName) }}
                                        className="w-6 h-6 flex items-center justify-center rounded-full bg-[var(--bg-inset)] text-[var(--text-dim)] hover:bg-rose-500/20 hover:text-rose-400 transition-colors"
                                        title="Delete fund from portfolio"
                                      >
                                        <Trash2 size={11} strokeWidth={2.5} />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile cards — minimal Groww-style */}
                  <div className="lg:hidden space-y-2 p-3">
                    {groupHoldings.map((h) => {
                      const isPlanned = h.units === 0
                      const unrealUp = h.pl >= 0
                      const pData = portfolioData.find((p) => p.portfolioId === h.portfolioId)
                      const totalPortfolioValue = pData?.currentValue || 0
                      const plannedBuy = isPlanned && h.targetAllocationPct > 0 && h.targetAllocationPct < 100 && totalPortfolioValue > 0
                        ? (h.targetAllocationPct / (100 - h.targetAllocationPct)) * totalPortfolioValue : 0

                      if (isPlanned) {
                        return (
                          <div key={h._key} className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] px-4 py-3 opacity-60">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-[var(--text-primary)] leading-tight">{splitFundName(h.fundName).main}</p>
                                {splitFundName(h.fundName).plan && <p className="text-xs text-[var(--text-dim)]">{splitFundName(h.fundName).plan}</p>}
                              </div>
                              <span className="text-xs font-semibold text-violet-400 bg-violet-500/15 px-1.5 py-0.5 rounded shrink-0">Planned</span>
                            </div>
                            <div className="flex items-center justify-between mt-1.5">
                              <span className="text-xs text-[var(--text-dim)]">Target {h.targetAllocationPct.toFixed(1)}%</span>
                              <div className="flex items-center gap-2">
                                {plannedBuy > 0 && <span className="text-xs text-emerald-400 font-semibold">{formatINR(plannedBuy)}</span>}
                                <button
                                  onClick={() => setModal({ invest: { portfolioId: h.portfolioId, fundCode: h.schemeCode, fundName: h.fundName } })}
                                  className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded ${h.lumpsumRestricted && h.sipRestricted ? 'text-[var(--text-dim)] bg-slate-500/10 cursor-not-allowed' : 'text-emerald-400 bg-emerald-500/10'}`}
                                  disabled={h.lumpsumRestricted && h.sipRestricted}
                                >
                                  <Plus size={10} strokeWidth={2.5} /> {h.lumpsumRestricted && h.sipRestricted ? 'Blocked' : 'Buy'}
                                </button>
                                <button
                                  onClick={() => handleDeleteFund(h.portfolioId, h.schemeCode, h.fundName)}
                                  className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded text-[var(--text-dim)] hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                                  title="Delete fund"
                                >
                                  <Trash2 size={10} strokeWidth={2.5} />
                                </button>
                              </div>
                            </div>
                          </div>
                        )
                      }

                      return (
                        <button
                          key={h._key}
                          onClick={() => setFundDetailHolding(h)}
                          className="w-full bg-[var(--bg-card)] rounded-xl border border-[var(--border)] px-4 py-3 text-left hover:bg-[var(--bg-hover)] transition-colors"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className="text-xs font-medium text-[var(--text-primary)] leading-tight">{splitFundName(h.fundName).main}</p>
                                {h.lumpsumRestricted && h.sipRestricted && <span className="text-xs font-semibold text-red-400 bg-red-500/15 px-1 py-0.5 rounded flex items-center gap-0.5 shrink-0"><Lock size={8} />Blocked</span>}
                                {h.lumpsumRestricted && !h.sipRestricted && <span className="text-xs font-semibold text-amber-400 bg-amber-500/15 px-1 py-0.5 rounded flex items-center gap-0.5 shrink-0"><Lock size={8} />SIP only</span>}
                                {!h.lumpsumRestricted && h.sipRestricted && <span className="text-xs font-semibold text-amber-400 bg-amber-500/15 px-1 py-0.5 rounded flex items-center gap-0.5 shrink-0"><Lock size={8} />Lumpsum only</span>}
                              </div>
                              {splitFundName(h.fundName).plan && <p className="text-xs text-[var(--text-dim)]">{splitFundName(h.fundName).plan}</p>}
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-xs font-bold text-[var(--text-primary)] tabular-nums">{formatINR(h.currentValue)}</p>
                              <p className={`text-xs font-semibold tabular-nums ${unrealUp ? 'text-emerald-400' : 'text-[var(--accent-rose)]'}`}>
                                {unrealUp ? '+' : ''}{formatINR(h.pl)} ({unrealUp ? '+' : ''}{h.plPct.toFixed(1)}%)
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between mt-1.5 text-xs tabular-nums">
                            <span className="text-[var(--text-dim)]">Invested {formatINR(h.investment)}</span>
                            <ChevronRight size={12} className="text-[var(--text-dim)]" />
                          </div>
                        </button>
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

          {/* ── Buy Opportunities + Rebalance (below holdings) ── */}
          {selectedPortfolioId !== 'all' && subTab === 'holdings' && insights && (
            <div className="space-y-3">
              {/* Buy Opportunities */}
              {insights.athDeduped.length > 0 && (
                <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-4">
                  <p className="text-sm font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Buy Opportunities</p>
                  <p className="text-xs text-[var(--text-dim)] mb-3">Funds trading below All-Time High</p>
                  {insights.athDeduped.map((h, idx) => {
                    const { main } = splitFundName(h.fundName)
                    const isStrongBuy = h.belowATHPct >= 10
                    return (
                      <div key={h.fundName} className="flex items-center justify-between py-2.5"
                           style={{ borderBottom: idx < insights.athDeduped.length - 1 ? '1px solid rgba(128,128,128,0.06)' : 'none' }}>
                        <div className="min-w-0">
                          <p className="text-[13px] text-[var(--text-primary)] font-medium truncate">{main}</p>
                          <p className="text-xs text-[var(--text-dim)] tabular-nums mt-0.5">{mv(formatINR(h.currentValue), 'value')}</p>
                        </div>
                        <div className="text-right shrink-0 ml-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold"
                                style={{
                                  background: isStrongBuy ? 'rgba(34,211,238,0.12)' : 'rgba(251,191,36,0.10)',
                                  color: isStrongBuy ? '#22d3ee' : '#fbbf24',
                                }}>
                            {isStrongBuy ? 'Strong Buy' : 'Buy'}
                          </span>
                          <p className="text-xs mt-0.5 font-medium tabular-nums"
                             style={{ color: isStrongBuy ? '#22d3ee' : '#fbbf24' }}>
                            &#9660; {h.belowATHPct.toFixed(1)}% below ATH
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Rebalance Needed (hidden if portfolio has skipRebalance) */}
              {selectedPortfolio && !selectedPortfolio.skipRebalance && (() => {
                const threshold = (selectedPortfolio.rebalanceThreshold || 0.05) * 100
                const rebalanceHoldings = enrichedHoldings
                  .filter(h => h.units > 0 && h.targetAllocationPct > 0)
                  .map(h => ({
                    fundName: splitFundName(h.fundName).main,
                    fundCode: h.schemeCode,
                    currentPct: Math.round(h.currentAllocationPct * 10) / 10,
                    targetPct: Math.round(h.targetAllocationPct * 10) / 10,
                    drift: Math.round((h.currentAllocationPct - h.targetAllocationPct) * 10) / 10,
                    currentValue: h.currentValue,
                    investment: h.investment,
                  }))
                  .filter(h => Math.abs(h.drift) > threshold)
                  .sort((a, b) => Math.abs(b.drift) - Math.abs(a.drift))

                if (rebalanceHoldings.length === 0) return null

                const totalValue = enrichedHoldings.filter(h => h.units > 0).reduce((s, h) => s + h.currentValue, 0)

                return (
                  <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-sm font-bold text-[var(--text-muted)] uppercase tracking-wider">Rebalance Needed</p>
                        <p className="text-xs text-[var(--text-dim)] mt-0.5">Funds drifting more than {threshold}% from target allocation</p>
                      </div>
                      <span className="text-xs font-bold tabular-nums px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400">
                        {rebalanceHoldings.length} fund{rebalanceHoldings.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    {/* Desktop view */}
                    <div className="hidden sm:block">
                      <div className="grid grid-cols-[1fr_90px_60px_180px_70px_80px] gap-2 text-[10px] text-[var(--text-dim)] font-semibold uppercase tracking-wider pb-1 mb-1 border-b border-[var(--border-light)]">
                        <span>Fund</span>
                        <span className="text-right">Current → Target</span>
                        <span className="text-right">Drift</span>
                        <span className="text-center">Allocation Bar</span>
                        <span className="text-right">Amount</span>
                        <span className="text-right">Action</span>
                      </div>
                      {rebalanceHoldings.map((item, idx) => {
                        const isOver = item.drift > 0
                        const maxPct = Math.max(item.currentPct, item.targetPct, 1)
                        const rebalanceAmt = Math.abs(item.drift / 100 * totalValue)
                        return (
                          <div key={idx} className="grid grid-cols-[1fr_90px_60px_180px_70px_80px] gap-2 items-center py-2"
                               style={{ borderBottom: idx < rebalanceHoldings.length - 1 ? '1px solid rgba(128,128,128,0.06)' : 'none' }}>
                            <div className="text-xs text-[var(--text-primary)] font-medium truncate min-w-0">{item.fundName}</div>
                            <div className="text-xs tabular-nums text-right text-[var(--text-secondary)]">
                              {item.currentPct}% → {item.targetPct}%
                            </div>
                            <div className={`text-xs tabular-nums text-right font-bold ${isOver ? 'text-amber-400' : 'text-blue-400'}`}>
                              {isOver ? '+' : ''}{item.drift}%
                            </div>
                            <div className="relative h-4 rounded bg-[var(--bg-inset)] overflow-hidden">
                              <div className="absolute inset-y-0 left-0 rounded"
                                   style={{
                                     width: `${(item.currentPct / maxPct) * 100}%`,
                                     background: isOver ? 'rgba(251,146,60,0.3)' : 'rgba(96,165,250,0.3)',
                                   }} />
                              <div className="absolute inset-y-0 w-0.5 bg-violet-400/80"
                                   style={{ left: `${(item.targetPct / maxPct) * 100}%` }} />
                            </div>
                            <div className="text-xs tabular-nums text-right text-[var(--text-muted)]">
                              {formatINR(rebalanceAmt)}
                            </div>
                            <div className="text-right">
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                isOver ? 'bg-amber-500/10 text-amber-400' : 'bg-blue-500/10 text-blue-400'
                              }`}>
                                {isOver ? 'Reduce' : 'Add'}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    {/* Mobile view */}
                    <div className="sm:hidden space-y-2">
                      {rebalanceHoldings.map((item, idx) => {
                        const isOver = item.drift > 0
                        const rebalanceAmt = Math.abs(item.drift / 100 * totalValue)
                        return (
                          <div key={idx} className="py-2" style={{ borderBottom: idx < rebalanceHoldings.length - 1 ? '1px solid rgba(128,128,128,0.06)' : 'none' }}>
                            <div className="flex items-center justify-between">
                              <p className="text-xs text-[var(--text-primary)] font-medium truncate flex-1 min-w-0">{item.fundName}</p>
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ml-2 ${
                                isOver ? 'bg-amber-500/10 text-amber-400' : 'bg-blue-500/10 text-blue-400'
                              }`}>
                                {isOver ? 'Reduce' : 'Add'} {formatINR(rebalanceAmt)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-xs text-[var(--text-dim)] tabular-nums">
                              <span>{item.currentPct}% → {item.targetPct}%</span>
                              <span className={`font-bold ${isOver ? 'text-amber-400' : 'text-blue-400'}`}>
                                ({isOver ? '+' : ''}{item.drift}%)
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    <button
                      onClick={() => setModal({ allocations: selectedPortfolioId })}
                      className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-violet-400 bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20 rounded-lg transition-colors"
                    >
                      <Settings2 size={13} /> Open Allocation Manager
                    </button>
                  </div>
                )
              })()}
            </div>
          )}

          {/* ── Transactions Tab ── */}
          {selectedPortfolioId !== 'all' && subTab === 'transactions' && (
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
                          <th className="text-right py-2 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">P&L</th>
                          <th className="w-8"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {transactions.map((t, idx) => {
                          const isBuy = t.type === 'BUY'
                          const curNav = currentNavMap[`${t.portfolioId}:${t.fundCode}`]
                          const hasRealized = !isBuy && t.gainLoss != null && t.gainLoss !== 0
                          const hasUnrealized = isBuy && curNav > 0 && t.price > 0 && t.units > 0
                          const unrealizedPL = hasUnrealized ? (curNav - t.price) * t.units : 0
                          const unrealizedPLPct = hasUnrealized ? ((curNav - t.price) / t.price) * 100 : 0
                          const gl = hasRealized ? t.gainLoss : hasUnrealized ? unrealizedPL : null
                          const glUp = gl != null && gl >= 0
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
                                <div className="max-w-[200px]">
                                  <p className="text-xs text-[var(--text-primary)] truncate">{splitFundName(t.fundName).main}</p>
                                  {splitFundName(t.fundName).plan && <p className="text-xs text-[var(--text-dim)]">{splitFundName(t.fundName).plan}</p>}
                                </div>
                                {portfolio && <p className="text-xs text-[var(--text-dim)]">{displayName(portfolio.portfolioName)}</p>}
                              </td>
                              <td className="py-2.5 px-3 text-right text-xs text-[var(--text-secondary)] tabular-nums">{t.units.toFixed(2)}</td>
                              <td className="py-2.5 px-3 text-right text-xs text-[var(--text-muted)] tabular-nums">₹{t.price.toFixed(2)}</td>
                              <td className="py-2.5 px-3 text-right text-xs font-semibold text-[var(--text-primary)] tabular-nums">{formatINR(t.totalAmount)}</td>
                              <td className="py-2.5 px-3 text-right">
                                {(hasRealized || hasUnrealized) ? (
                                  <div>
                                    <span className={`text-xs font-semibold tabular-nums ${glUp ? 'text-emerald-400' : 'text-[var(--accent-rose)]'}`}>
                                      {glUp ? '+' : ''}{formatINR(gl)}
                                    </span>
                                    {hasUnrealized && (
                                      <p className={`text-[10px] tabular-nums ${glUp ? 'text-emerald-400/70' : 'text-[var(--accent-rose)]/70'}`}>
                                        {unrealizedPLPct >= 0 ? '+' : ''}{unrealizedPLPct.toFixed(1)}%
                                      </p>
                                    )}
                                  </div>
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
                      const curNav = currentNavMap[`${t.portfolioId}:${t.fundCode}`]
                      const hasRealized = !isBuy && t.gainLoss != null && t.gainLoss !== 0
                      const hasUnrealized = isBuy && curNav > 0 && t.price > 0 && t.units > 0
                      const unrealizedPL = hasUnrealized ? (curNav - t.price) * t.units : 0
                      const unrealizedPLPct = hasUnrealized ? ((curNav - t.price) / t.price) * 100 : 0
                      const gl = hasRealized ? t.gainLoss : hasUnrealized ? unrealizedPL : null
                      const glUp = gl != null && gl >= 0
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
                          <div className="mb-1">
                            <p className="text-xs text-[var(--text-primary)] truncate">{splitFundName(t.fundName).main}</p>
                            {splitFundName(t.fundName).plan && <p className="text-xs text-[var(--text-dim)]">{splitFundName(t.fundName).plan}</p>}
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <p className="text-[var(--text-dim)]">{t.units.toFixed(2)} units @ ₹{t.price.toFixed(2)}</p>
                            <div className="text-right">
                              <p className="text-xs font-semibold text-[var(--text-primary)] tabular-nums">{formatINR(t.totalAmount)}</p>
                              {(hasRealized || hasUnrealized) && (
                                <p className={`text-xs font-semibold tabular-nums ${glUp ? 'text-emerald-400' : 'text-[var(--accent-rose)]'}`}>
                                  {hasUnrealized ? 'P&L' : 'G/L'}: {glUp ? '+' : ''}{formatINR(gl)} {hasUnrealized ? `(${unrealizedPLPct >= 0 ? '+' : ''}${unrealizedPLPct.toFixed(1)}%)` : ''}
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

          {/* ── Fund Breakdown Tab ── */}
          {selectedPortfolioId !== 'all' && subTab === 'breakdown' && (
            <>
              {uniqueFunds.length > 0 ? (
                <div>
                  <p className="text-xs text-[var(--text-dim)] px-1 mb-2">Copy allocation data from <span className="font-semibold text-[var(--text-muted)]">morningstar.in</span> → Fund → Portfolio tab</p>
                  <div className="space-y-2">
                    {uniqueFunds.map(fund => {
                      const existing = assetAllocations?.find(a => a.fundCode === fund.fundCode)
                      return (
                        <FundAllocationRow
                          key={fund.fundCode}
                          fund={fund}
                          existing={existing}
                          onConfigure={() => setModal({ classifyFund: { fund, existing } })}
                        />
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] py-10 flex flex-col items-center gap-3">
                  <PieChartIcon size={28} className="text-[var(--text-dim)]" />
                  <p className="text-sm text-[var(--text-muted)]">No funds to configure</p>
                </div>
              )}
            </>
          )}

          </>)}
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

      <Modal open={modal === 'rebalance'} onClose={() => setModal(null)} title="Rebalance Alerts" wide>
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

      <Modal open={!!modal?.classifyFund} onClose={() => setModal(null)} title="Classify Fund" maxWidth="max-w-4xl">
        {modal?.classifyFund && (
          <FundAllocationForm
            fund={modal.classifyFund.fund}
            initial={modal.classifyFund.existing}
            onSave={handleSaveClassification}
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

/* ── Detail Row (for fund detail page) ── */
function DetailRow({ label, value, valueStyle, valueClass }) {
  return (
    <div className="flex items-center justify-between px-3.5 py-2">
      <p className="text-xs text-[var(--text-dim)]">{label}</p>
      <p className={`text-xs font-semibold tabular-nums ${valueClass || 'text-[var(--text-primary)]'}`} style={valueStyle}>{value}</p>
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
        <p className="text-xs text-[var(--text-dim)]">{splitFundName(txn.fundName).main}</p>
        {splitFundName(txn.fundName).plan && <p className="text-xs text-[var(--text-dim)]">{splitFundName(txn.fundName).plan}</p>}
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

/* ── Fund Allocation Row (display only — edit via modal) ── */
const ALLOC_DISPLAY = [
  { key: 'Equity', bg: 'bg-violet-500' },
  { key: 'Debt', bg: 'bg-sky-500' },
  { key: 'Cash', bg: 'bg-teal-400' },
  { key: 'Commodities', bg: 'bg-yellow-500' },
  { key: 'Real Estate', bg: 'bg-orange-500' },
  { key: 'Other', bg: 'bg-slate-400' },
]
const CAP_ABBR = { Giant: 'G', Large: 'L', Mid: 'M', Small: 'S', Micro: 'Mi' }
const GEO_ABBR = { India: 'India', Global: 'Global' }

function AllocPills({ entries, colorMap }) {
  return entries.map(([k, v]) => (
    <span key={k} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] tabular-nums whitespace-nowrap" style={{ background: (colorMap[k] || '#94a3b8') + '18' }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: colorMap[k] || '#94a3b8' }} />
      <span style={{ color: colorMap[k] || '#94a3b8' }}>{k}</span>
      <span className="text-[var(--text-secondary)]">{v}%</span>
    </span>
  ))
}

function FundAllocationRow({ fund, existing, onConfigure }) {
  const hasData = existing?.assetAllocation && Object.keys(existing.assetAllocation).length > 0

  const assetEntries = hasData ? [...ALLOC_DISPLAY.map(d => [d.key, existing.assetAllocation[d.key] || 0]).filter(([, v]) => v > 0),
    ...Object.entries(existing.assetAllocation || {}).filter(([k, v]) => v > 0 && !ALLOC_DISPLAY.some(d => d.key === k))] : []
  const capEntries = Object.entries(existing?.equityAllocation || {}).filter(([, v]) => v > 0)
  const geoEntries = Object.entries(existing?.geoAllocation || {}).filter(([, v]) => v > 0)

  return (
    <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] px-3 py-2.5">
      {hasData ? (
        <div className="grid grid-cols-3 gap-3">
          {/* Column 1: Fund name + Geography */}
          <div className="flex flex-col justify-between h-full">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{splitFundName(fund.fundName).main}</p>
                {splitFundName(fund.fundName).plan && <p className="text-xs text-[var(--text-dim)]">{splitFundName(fund.fundName).plan}</p>}
              </div>
              <button onClick={onConfigure}
                className="p-1.5 rounded-lg text-[var(--text-dim)] hover:text-violet-400 hover:bg-violet-500/10 transition-colors shrink-0 ml-1"
                title="Classify fund">
                <Settings2 size={15} />
              </button>
            </div>
            {geoEntries.length > 0 && (
              <div className="mt-auto pt-1.5">
                <div className="rounded-lg px-2.5 py-2" style={{ background: 'rgba(128,128,128,0.04)', border: '1px solid rgba(128,128,128,0.08)' }}>
                  <span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider block mb-1">Geography</span>
                  <div className="flex flex-wrap gap-1">
                    {geoEntries.map(([k, v]) => (
                      <span key={k} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs tabular-nums whitespace-nowrap"
                            style={{ background: (GEO_CLS_COLOR[k] || '#94a3b8') + '18' }}>
                        <span className="w-2 h-2 rounded-full" style={{ background: GEO_CLS_COLOR[k] || '#94a3b8' }} />
                        <span style={{ color: GEO_CLS_COLOR[k] || '#94a3b8' }}>{k}</span>
                        <span className="text-[var(--text-secondary)]">{v}%</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
          {/* Column 2: Asset Allocation */}
          <div className="rounded-lg px-2.5 py-2" style={{ background: 'rgba(128,128,128,0.04)', border: '1px solid rgba(128,128,128,0.08)' }}>
            <span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider block mb-1">Asset Allocation</span>
            <div className="flex flex-col gap-0.5">
              {assetEntries.map(([k, v]) => (
                <span key={k} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs tabular-nums whitespace-nowrap w-fit"
                      style={{ background: (ASSET_CLS_COLOR[k] || '#94a3b8') + '18' }}>
                  <span className="w-2 h-2 rounded-full" style={{ background: ASSET_CLS_COLOR[k] || '#94a3b8' }} />
                  <span style={{ color: ASSET_CLS_COLOR[k] || '#94a3b8' }}>{k}</span>
                  <span className="text-[var(--text-secondary)]">{v}%</span>
                </span>
              ))}
            </div>
          </div>
          {/* Column 3: Market Cap */}
          {capEntries.length > 0 && (
            <div className="rounded-lg px-2.5 py-2" style={{ background: 'rgba(128,128,128,0.04)', border: '1px solid rgba(128,128,128,0.08)' }}>
              <span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider block mb-1">Market Cap</span>
              <div className="flex flex-col gap-0.5">
                {capEntries.map(([k, v]) => (
                  <span key={k} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs tabular-nums whitespace-nowrap w-fit"
                        style={{ background: (CAP_CLS_COLOR[k] || '#94a3b8') + '18' }}>
                    <span className="w-2 h-2 rounded-full" style={{ background: CAP_CLS_COLOR[k] || '#94a3b8' }} />
                    <span style={{ color: CAP_CLS_COLOR[k] || '#94a3b8' }}>{k}</span>
                    <span className="text-[var(--text-secondary)]">{v}%</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{splitFundName(fund.fundName).main}</p>
            {splitFundName(fund.fundName).plan && <p className="text-[10px] text-[var(--text-dim)]">{splitFundName(fund.fundName).plan}</p>}
            <p className="text-[10px] text-[var(--text-dim)] italic mt-1">Not classified — click ⚙ to configure</p>
          </div>
          <button onClick={onConfigure}
            className="p-1.5 rounded-lg text-[var(--text-dim)] hover:text-violet-400 hover:bg-violet-500/10 transition-colors shrink-0 ml-3"
            title="Classify fund">
            <Settings2 size={14} />
          </button>
        </div>
      )}
    </div>
  )
}

/* ── Donut Chart Card (Recharts) ── */
function DonutCard({ title, data, bgMap }) {
  return (
    <div className="rounded-lg bg-[var(--bg-inset)] border border-[var(--border-light)] p-3">
      <p className="text-sm font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2 text-center">{title}</p>
      <div className="w-full h-[120px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="pct" nameKey="name" cx="50%" cy="50%" innerRadius={30} outerRadius={48} paddingAngle={2} stroke="none">
              {data.map((d, i) => <Cell key={i} fill={d.fill} />)}
            </Pie>
            <Tooltip
              content={({ payload }) => {
                if (!payload?.length) return null
                const d = payload[0].payload
                return (
                  <div className="bg-[var(--bg-dropdown)] border border-white/10 rounded-lg px-2.5 py-1.5 shadow-xl">
                    <p className="text-xs font-semibold text-[var(--text-primary)]">{d.name}</p>
                    <p className="text-xs text-[var(--text-muted)] tabular-nums">{d.pct.toFixed(1)}%</p>
                  </div>
                )
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap justify-center gap-x-3 gap-y-0.5 mt-1">
        {data.map(d => (
          <span key={d.name} className="flex items-center gap-1 text-xs text-[var(--text-muted)] tabular-nums">
            <span className={`w-1.5 h-1.5 rounded-full ${bgMap[d.name] || 'bg-slate-500'}`} />
            {d.name} {d.pct < 1 ? d.pct.toFixed(1) : d.pct.toFixed(0)}%
          </span>
        ))}
      </div>
    </div>
  )
}

