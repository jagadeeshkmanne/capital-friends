import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Wallet, TrendingUp, TrendingDown, BarChart3, Building2, Landmark, AlertCircle, RefreshCw, X } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { useData } from '../../context/DataContext'
import PageLoading from '../../components/PageLoading'
import { useFamily } from '../../context/FamilyContext'
import { formatINR } from '../../data/familyData'

function plColor(val) { return val >= 0 ? 'text-emerald-400' : 'text-[var(--accent-rose)]' }
function plPrefix(val) { return val >= 0 ? '+' : '' }

// Infer asset category from fund name (client-side fallback)
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

const ASSET_CLASS_COLORS = { Equity: 'bg-violet-500', Debt: 'bg-sky-500', Gold: 'bg-amber-400', Commodities: 'bg-yellow-500', 'Real Estate': 'bg-orange-500', Hybrid: 'bg-indigo-400', Cash: 'bg-teal-400', Other: 'bg-slate-400' }
const ASSET_CLASS_HEX = { Equity: '#8b5cf6', Debt: '#0ea5e9', Gold: '#fbbf24', Commodities: '#eab308', 'Real Estate': '#f97316', Hybrid: '#818cf8', Cash: '#2dd4bf', Other: '#94a3b8' }
const PRODUCT_HEX = { 'Mutual Funds': '#8b5cf6', Stocks: '#3b82f6', Other: '#10b981' }
const PRODUCT_BG = { 'Mutual Funds': 'bg-violet-500', Stocks: 'bg-blue-500', Other: 'bg-emerald-500' }
function assetClassColor(name) { return ASSET_CLASS_COLORS[name] || 'bg-slate-400' }

export default function Dashboard() {
  const navigate = useNavigate()
  const { selectedMember } = useFamily()
  const {
    mfPortfolios, mfHoldings,
    stockPortfolios, stockHoldings,
    otherInvList, liabilityList,
    banks, insurancePolicies,
    reminderList, goalList,
    assetAllocations,
  } = useData()

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

    // MF per-portfolio breakdown
    const mfPortfolioDetails = activeMFPortfolios.map((p) => {
      const ph = activeMFHoldings.filter((h) => h.portfolioId === p.portfolioId)
      return { name: p.portfolioName, value: ph.reduce((s, h) => s + h.currentValue, 0) }
    }).filter((p) => p.value > 0)

    // Stocks
    const activeStockPortfolios = filterOwner(stockPortfolios.filter((p) => p.status === 'Active'), 'ownerId')
    const stkPortfolioIds = new Set(activeStockPortfolios.map((p) => p.portfolioId))
    const activeStockHoldings = stockHoldings.filter((h) => stkPortfolioIds.has(h.portfolioId))
    const stkInvested = activeStockHoldings.reduce((s, h) => s + h.totalInvestment, 0)
    const stkCurrentValue = activeStockHoldings.reduce((s, h) => s + h.currentValue, 0)
    const stkPL = stkCurrentValue - stkInvested

    // Stocks per-portfolio breakdown
    const stkPortfolioDetails = activeStockPortfolios.map((p) => {
      const ph = activeStockHoldings.filter((h) => h.portfolioId === p.portfolioId)
      return { name: p.portfolioName, value: ph.reduce((s, h) => s + h.currentValue, 0) }
    }).filter((p) => p.value > 0)

    // Other Investments
    const activeOther = filterOwner(otherInvList.filter((i) => i.status === 'Active'), 'familyMemberId')
    const otherInvested = activeOther.reduce((s, i) => s + i.investedAmount, 0)
    const otherCurrentValue = activeOther.reduce((s, i) => s + i.currentValue, 0)
    const otherPL = otherCurrentValue - otherInvested

    // Other individual items
    const otherDetails = activeOther.map((i) => ({
      name: i.investmentName, type: i.investmentType, value: i.currentValue,
    }))

    // Liabilities
    const activeLiabilities = filterOwner(liabilityList.filter((l) => l.status === 'Active'), 'familyMemberId')
    const totalLiabilities = activeLiabilities.reduce((s, l) => s + l.outstandingBalance, 0)
    const totalEMI = activeLiabilities.reduce((s, l) => s + l.emiAmount, 0)

    // Liability individual items
    const liabilityDetails = activeLiabilities.map((l) => ({
      name: l.lenderName || l.liabilityType, type: l.liabilityType, balance: l.outstandingBalance, emi: l.emiAmount,
    }))

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

    // Asset class breakdown (Equity/Debt/Gold/Hybrid/etc.)
    // Uses detailed AssetAllocations when available, falls back to basic fund category
    const allocMap = {}
    if (assetAllocations) {
      for (const a of assetAllocations) {
        if (a.assetAllocation) allocMap[a.fundCode] = a.assetAllocation
      }
    }

    const assetClasses = { Equity: 0, Debt: 0, Gold: 0, Hybrid: 0, Commodities: 0, 'Real Estate': 0, Cash: 0, Other: 0 }

    // MF holdings — use detailed allocation if available, else basic category
    activeMFHoldings.forEach((h) => {
      const detailed = allocMap[h.fundCode]
      if (detailed) {
        for (const [cls, pct] of Object.entries(detailed)) {
          if (cls in assetClasses) assetClasses[cls] += h.currentValue * (pct / 100)
          else if (cls === 'Gold') assetClasses.Gold += h.currentValue * (pct / 100)
          else assetClasses.Other += h.currentValue * (pct / 100)
        }
      } else {
        let cat = h.category
        if (!cat || cat === 'Other') cat = inferCategory(h.fundName)
        if (cat === 'Equity' || cat === 'ELSS' || cat === 'Index') assetClasses.Equity += h.currentValue
        else if (cat === 'Debt' || cat === 'Gilt') assetClasses.Debt += h.currentValue
        else if (cat === 'Liquid') assetClasses.Cash += h.currentValue
        else if (cat === 'Commodity') assetClasses.Commodities += h.currentValue
        else if (cat === 'Multi-Asset') {
          assetClasses.Equity += h.currentValue * 0.50
          assetClasses.Debt += h.currentValue * 0.30
          assetClasses.Commodities += h.currentValue * 0.20
        } else if (cat === 'Hybrid' || cat === 'FoF') {
          assetClasses.Equity += h.currentValue * 0.65
          assetClasses.Debt += h.currentValue * 0.35
        } else assetClasses.Other += h.currentValue
      }
    })

    // Stocks → all equity
    assetClasses.Equity += stkCurrentValue

    // Other investments — categorize by type
    activeOther.forEach((inv) => {
      const t = (inv.investmentType || '').toLowerCase()
      if (t.includes('gold')) assetClasses.Gold += inv.currentValue
      else if (t.includes('silver') || t.includes('commodity')) assetClasses.Commodities += inv.currentValue
      else if (t.includes('fd') || t.includes('fixed') || t.includes('bond') || t.includes('ppf') || t.includes('epf') || t.includes('nps') || t.includes('rd') || t.includes('nsc') || t.includes('ssy')) assetClasses.Debt += inv.currentValue
      else if (t.includes('real estate') || t.includes('property')) assetClasses['Real Estate'] += inv.currentValue
      else assetClasses.Other += inv.currentValue
    })

    // Filter out zero-value classes and build sorted list
    const assetClassList = Object.entries(assetClasses)
      .filter(([, val]) => val > 0)
      .sort(([, a], [, b]) => b - a)
      .map(([cls, val]) => ({ name: cls, value: val, pct: totalAssets > 0 ? (val / totalAssets) * 100 : 0, fill: ASSET_CLASS_HEX[cls] || '#94a3b8' }))

    // Product type breakdown for donut
    const productList = []
    if (mfCurrentValue > 0) productList.push({ name: 'Mutual Funds', value: mfCurrentValue, pct: totalAssets > 0 ? (mfCurrentValue / totalAssets) * 100 : 0, fill: PRODUCT_HEX['Mutual Funds'] })
    if (stkCurrentValue > 0) productList.push({ name: 'Stocks', value: stkCurrentValue, pct: totalAssets > 0 ? (stkCurrentValue / totalAssets) * 100 : 0, fill: PRODUCT_HEX.Stocks })
    if (otherCurrentValue > 0) productList.push({ name: 'Other', value: otherCurrentValue, pct: totalAssets > 0 ? (otherCurrentValue / totalAssets) * 100 : 0, fill: PRODUCT_HEX.Other })

    return {
      mfCurrentValue, mfInvested, mfPL, mfCount: activeMFPortfolios.length, mfPortfolioDetails,
      stkCurrentValue, stkInvested, stkPL, stkCount: activeStockPortfolios.length, stkPortfolioDetails,
      otherCurrentValue, otherInvested, otherPL, otherCount: activeOther.length, otherDetails,
      totalLiabilities, totalEMI, liabilityCount: activeLiabilities.length, liabilityDetails,
      totalCover, insuranceCount: activeInsurance.length,
      bankCount: activeBankAccounts.length,
      totalAssets, totalInvested, totalPL, netWorth,
      buyOppCount, rebalanceCount,
      assetClassList, productList,
    }
  }, [selectedMember, mfPortfolios, mfHoldings, stockPortfolios, stockHoldings, otherInvList, liabilityList, banks, insurancePolicies, assetAllocations])

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

  const [showBreakdown, setShowBreakdown] = useState(false)

  if (mfPortfolios === null || mfHoldings === null) return <PageLoading title="Loading dashboard" cards={4} />

  return (
    <div className="space-y-4">
      {/* Net Worth Hero — tap to open breakdown modal */}
      <div
        className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-4 cursor-pointer hover:bg-[var(--bg-hover)] transition-colors"
        onClick={() => setShowBreakdown(true)}
      >
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Net Worth</p>
          <ChevronRight size={14} className="text-[var(--text-dim)]" />
        </div>
        <p className="text-2xl font-bold text-[var(--text-primary)] tabular-nums mt-1">{formatINR(data.netWorth)}</p>

        {/* Stacked bar */}
        {data.totalAssets > 0 && (
          <div className="flex h-1.5 rounded-full overflow-hidden bg-[var(--bg-inset)] mt-2">
            {data.mfCurrentValue > 0 && <div className="bg-violet-500" style={{ width: `${(data.mfCurrentValue / data.totalAssets) * 100}%` }} />}
            {data.stkCurrentValue > 0 && <div className="bg-blue-500" style={{ width: `${(data.stkCurrentValue / data.totalAssets) * 100}%` }} />}
            {data.otherCurrentValue > 0 && <div className="bg-emerald-500" style={{ width: `${(data.otherCurrentValue / data.totalAssets) * 100}%` }} />}
          </div>
        )}

        {/* P&L */}
        {data.totalInvested > 0 && (
          <div className="mt-2 flex items-center gap-2 text-xs flex-wrap">
            <span className="text-[var(--text-dim)]">Invested {formatINR(data.totalInvested)}</span>
            <span className="text-[var(--text-dim)]">&rarr;</span>
            <span className={`font-semibold ${plColor(data.totalPL)}`}>
              P&L {plPrefix(data.totalPL)}{formatINR(Math.abs(data.totalPL))} ({plPrefix(data.totalPL)}{((data.totalPL / data.totalInvested) * 100).toFixed(1)}%)
            </span>
          </div>
        )}
      </div>

      {/* Net Worth Breakdown Modal */}
      {showBreakdown && (() => {
        // Build donut data: investments + liabilities
        const donutData = []
        if (data.mfCurrentValue > 0) donutData.push({ name: 'Mutual Funds', value: data.mfCurrentValue, fill: PRODUCT_HEX['Mutual Funds'] })
        if (data.stkCurrentValue > 0) donutData.push({ name: 'Stocks', value: data.stkCurrentValue, fill: PRODUCT_HEX.Stocks })
        if (data.otherCurrentValue > 0) donutData.push({ name: 'Other Inv.', value: data.otherCurrentValue, fill: PRODUCT_HEX.Other })
        const donutTotal = donutData.reduce((s, d) => s + d.value, 0)
        donutData.forEach(d => { d.pct = donutTotal > 0 ? (d.value / donutTotal) * 100 : 0 })

        return (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={() => setShowBreakdown(false)}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <div
              className="relative w-full max-w-md max-h-[90vh] bg-[var(--bg-card)] rounded-t-2xl sm:rounded-2xl border border-[var(--border)] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              {/* Close button */}
              <button onClick={() => setShowBreakdown(false)} className="absolute top-3 right-3 z-20 p-1.5 rounded-full bg-[var(--bg-inset)] hover:bg-[var(--bg-hover)]">
                <X size={16} className="text-[var(--text-muted)]" />
              </button>

              {/* Hero: Large donut with net worth centered */}
              <div className="pt-6 pb-4 px-4">
                <div className="relative w-[200px] h-[200px] mx-auto">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={donutData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3} stroke="none">
                        {donutData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                      </Pie>
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.[0]) return null
                          const d = payload[0].payload
                          return (
                            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 shadow-lg text-xs">
                              <span className="font-semibold text-[var(--text-primary)]">{d.name}</span>
                              <span className="text-[var(--text-muted)] ml-1.5">{formatINR(d.value)}</span>
                            </div>
                          )
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Center label */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <p className="text-[10px] text-[var(--text-dim)] uppercase tracking-wider">Net Worth</p>
                    <p className="text-lg font-bold text-[var(--text-primary)] tabular-nums">{formatINR(data.netWorth)}</p>
                  </div>
                </div>

                {/* Legend */}
                <div className="flex justify-center gap-4 mt-2">
                  {donutData.map(d => (
                    <span key={d.name} className="flex items-center gap-1.5 text-xs text-[var(--text-dim)]">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.fill }} />
                      {d.name} {d.pct.toFixed(0)}%
                    </span>
                  ))}
                </div>

                {/* Assets - Liabilities = Net Worth */}
                <div className="mt-3 space-y-1 text-xs">
                  <div className="flex items-center justify-between px-2">
                    <span className="text-[var(--text-dim)]">Total Investments</span>
                    <span className="font-semibold text-[var(--text-secondary)] tabular-nums">{formatINR(data.totalAssets)}</span>
                  </div>
                  {data.totalLiabilities > 0 && (
                    <div className="flex items-center justify-between px-2">
                      <span className="text-[var(--text-dim)]">Liabilities</span>
                      <span className="font-semibold text-[var(--accent-rose)] tabular-nums">&minus;{formatINR(data.totalLiabilities)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between px-2 pt-1 border-t border-dashed border-[var(--border-light)]">
                    <span className="font-bold text-[var(--text-primary)]">= Net Worth</span>
                    <span className="font-bold text-[var(--text-primary)] tabular-nums">{formatINR(data.netWorth)}</span>
                  </div>
                </div>
              </div>

              {/* Breakdown cards */}
              <div className="px-4 pb-4 space-y-2">
                <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Investments</p>

                {data.mfCurrentValue > 0 && (
                  <BreakdownCard dot="bg-violet-500" label="Mutual Funds" value={data.mfCurrentValue}
                    pct={data.totalAssets > 0 ? (data.mfCurrentValue / data.totalAssets) * 100 : 0}
                    onClick={() => { setShowBreakdown(false); navigate('/investments/mutual-funds') }} />
                )}
                {data.stkCurrentValue > 0 && (
                  <BreakdownCard dot="bg-blue-500" label="Stocks" value={data.stkCurrentValue}
                    pct={data.totalAssets > 0 ? (data.stkCurrentValue / data.totalAssets) * 100 : 0}
                    onClick={() => { setShowBreakdown(false); navigate('/investments/stocks') }} />
                )}
                {data.otherCurrentValue > 0 && (
                  <BreakdownCard dot="bg-emerald-500" label="Other Investments" value={data.otherCurrentValue}
                    pct={data.totalAssets > 0 ? (data.otherCurrentValue / data.totalAssets) * 100 : 0}
                    onClick={() => { setShowBreakdown(false); navigate('/investments/other') }} />
                )}

                {/* Liabilities */}
                {data.totalLiabilities > 0 && (
                  <>
                    <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider pt-1">Liabilities</p>
                    <div
                      className="bg-[var(--bg-inset)] rounded-xl border border-rose-500/20 p-3 cursor-pointer hover:bg-[var(--bg-hover)] transition-colors"
                      onClick={() => { setShowBreakdown(false); navigate('/liabilities') }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-rose-500" />
                          <span className="text-sm font-semibold text-[var(--text-primary)]">{data.liabilityCount} {data.liabilityCount === 1 ? 'Loan' : 'Loans'}</span>
                        </div>
                        <span className="text-sm font-bold text-[var(--accent-rose)] tabular-nums">&minus;{formatINR(data.totalLiabilities)}</span>
                      </div>
                      {data.totalEMI > 0 && (
                        <div className="mt-1 pl-4 text-xs text-[var(--text-dim)]">EMI {formatINR(data.totalEMI)}/mo</div>
                      )}
                    </div>
                  </>
                )}

                {/* Asset class breakdown */}
                {data.assetClassList.length > 1 && (
                  <>
                    <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider pt-1">Asset Class Breakdown</p>
                    <DashDonut title="" data={data.assetClassList} bgMap={ASSET_CLASS_COLORS} />
                  </>
                )}
              </div>
            </div>
          </div>
        )
      })()}

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

/* ── BreakdownCard — used in net worth modal ── */
function BreakdownCard({ dot, label, value, pct, onClick }) {
  return (
    <div
      className="bg-[var(--bg-inset)] rounded-xl border border-[var(--border-light)] p-3 cursor-pointer hover:bg-[var(--bg-hover)] transition-colors"
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${dot}`} />
          <span className="text-sm font-semibold text-[var(--text-primary)]">{label}</span>
        </div>
        <div className="text-right">
          <span className="text-sm font-bold text-[var(--text-primary)] tabular-nums">{formatINR(value)}</span>
          <span className="text-[10px] text-[var(--text-dim)] tabular-nums ml-1">({pct.toFixed(0)}%)</span>
        </div>
      </div>
      <div className="mt-2 h-1 rounded-full bg-[var(--border-light)] overflow-hidden">
        <div className={`h-full rounded-full ${dot}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
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

/* ── DashDonut — Recharts donut chart for dashboard breakdowns ── */
function DashDonut({ title, data, bgMap }) {
  return (
    <div className="rounded-lg bg-[var(--bg-inset)] border border-[var(--border-light)] p-3">
      <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2 text-center">{title}</p>
      <div className="w-full h-[120px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="pct" nameKey="name" cx="50%" cy="50%" innerRadius={30} outerRadius={48} paddingAngle={2} stroke="none">
              {data.map((d, i) => <Cell key={i} fill={d.fill} />)}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.[0]) return null
                const d = payload[0].payload
                return (
                  <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg px-2 py-1 shadow-lg text-xs">
                    <span className="font-semibold text-[var(--text-primary)]">{d.name}</span>
                    <span className="text-[var(--text-muted)] ml-1">{d.pct.toFixed(1)}%</span>
                    {d.value > 0 && <span className="text-[var(--text-dim)] ml-1">({formatINR(d.value)})</span>}
                  </div>
                )
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap justify-center gap-x-3 gap-y-0.5 mt-1">
        {data.map(d => (
          <span key={d.name} className="flex items-center gap-1 text-[10px] text-[var(--text-dim)]">
            <span className={`w-1.5 h-1.5 rounded-full ${bgMap[d.name] || 'bg-slate-400'}`} />
            {d.name} {d.pct.toFixed(0)}%
          </span>
        ))}
      </div>
    </div>
  )
}
