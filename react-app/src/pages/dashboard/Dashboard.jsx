import { useMemo, useState, useRef, useCallback, Children } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, ChevronDown, Wallet, TrendingUp, TrendingDown, BarChart3, Building2, Landmark, AlertCircle, RefreshCw } from 'lucide-react'
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

const ASSET_CLASS_COLORS = { Equity: 'bg-violet-500', Debt: 'bg-sky-500', Commodities: 'bg-yellow-500', Hybrid: 'bg-indigo-400', Cash: 'bg-teal-400', Other: 'bg-slate-400' }
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

    const assetClasses = { Equity: 0, Debt: 0, Hybrid: 0, Commodities: 0, Cash: 0, Other: 0 }

    // MF holdings — use detailed allocation if available, else basic category
    activeMFHoldings.forEach((h) => {
      const detailed = allocMap[h.fundCode]
      if (detailed) {
        // Detailed breakdown: { Equity: 75, Debt: 20, Cash: 5 }
        for (const [cls, pct] of Object.entries(detailed)) {
          const key = cls === 'Commodities' ? 'Commodities' : cls === 'Real Estate' ? 'Other' : cls
          if (key in assetClasses) assetClasses[key] += h.currentValue * (pct / 100)
          else assetClasses.Other += h.currentValue * (pct / 100)
        }
      } else {
        // Use server category, but if 'Other' or missing, infer from fund name
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
      if (t.includes('gold') || t.includes('silver') || t.includes('commodity')) assetClasses.Commodities += inv.currentValue
      else if (t.includes('fd') || t.includes('fixed') || t.includes('bond') || t.includes('ppf') || t.includes('epf') || t.includes('nps') || t.includes('rd') || t.includes('nsc') || t.includes('ssy')) assetClasses.Debt += inv.currentValue
      else if (t.includes('real estate') || t.includes('property')) assetClasses.Other += inv.currentValue
      else assetClasses.Other += inv.currentValue
    })

    // Filter out zero-value classes and build sorted list
    const assetClassList = Object.entries(assetClasses)
      .filter(([, val]) => val > 0)
      .sort(([, a], [, b]) => b - a)
      .map(([cls, val]) => ({ name: cls, value: val, pct: totalAssets > 0 ? (val / totalAssets) * 100 : 0 }))

    return {
      mfCurrentValue, mfInvested, mfPL, mfCount: activeMFPortfolios.length, mfPortfolioDetails,
      stkCurrentValue, stkInvested, stkPL, stkCount: activeStockPortfolios.length, stkPortfolioDetails,
      otherCurrentValue, otherInvested, otherPL, otherCount: activeOther.length, otherDetails,
      totalLiabilities, totalEMI, liabilityCount: activeLiabilities.length, liabilityDetails,
      totalCover, insuranceCount: activeInsurance.length,
      bankCount: activeBankAccounts.length,
      totalAssets, totalInvested, totalPL, netWorth,
      buyOppCount, rebalanceCount,
      assetClassList,
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

  if (members === null || mfPortfolios === null) return <PageLoading title="Loading dashboard" cards={4} />

  return (
    <div className="space-y-4">
      {/* Net Worth Hero */}
      <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-4">
        <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Net Worth</p>
        <p className="text-2xl font-bold text-[var(--text-primary)] tabular-nums">{formatINR(data.netWorth)}</p>

        {/* Full breakdown */}
        <div className="mt-3 space-y-0.5">
          {/* Investments */}
          <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-0.5">Investments</p>

          {data.mfCurrentValue > 0 && (
            <ExpandableRow
              dot="bg-violet-500"
              label="Mutual Funds"
              value={formatINR(data.mfCurrentValue)}
              items={data.mfPortfolioDetails}
              renderItem={(p) => (
                <div key={p.name} className="flex items-center justify-between">
                  <span className="text-[11px] text-[var(--text-dim)] truncate mr-2">{p.name}</span>
                  <span className="text-[11px] text-[var(--text-dim)] tabular-nums shrink-0">{formatINR(p.value)}</span>
                </div>
              )}
            />
          )}

          {data.stkCurrentValue > 0 && (
            <ExpandableRow
              dot="bg-blue-500"
              label="Stocks"
              value={formatINR(data.stkCurrentValue)}
              items={data.stkPortfolioDetails}
              renderItem={(p) => (
                <div key={p.name} className="flex items-center justify-between">
                  <span className="text-[11px] text-[var(--text-dim)] truncate mr-2">{p.name}</span>
                  <span className="text-[11px] text-[var(--text-dim)] tabular-nums shrink-0">{formatINR(p.value)}</span>
                </div>
              )}
            />
          )}

          {data.otherCurrentValue > 0 && (
            <ExpandableRow
              dot="bg-emerald-500"
              label="Other Investments"
              value={formatINR(data.otherCurrentValue)}
              items={data.otherDetails}
              renderItem={(item) => (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="min-w-0 mr-2">
                    <span className="text-[11px] text-[var(--text-dim)] truncate block">{item.name}</span>
                    <span className="text-[10px] text-[var(--text-dim)]/60">{item.type}</span>
                  </div>
                  <span className="text-[11px] text-[var(--text-dim)] tabular-nums shrink-0">{formatINR(item.value)}</span>
                </div>
              )}
            />
          )}

          {data.totalAssets > 0 && (data.mfCurrentValue > 0) + (data.stkCurrentValue > 0) + (data.otherCurrentValue > 0) > 1 && (
            <div className="flex items-center justify-between pl-2 pt-0.5">
              <span className="text-xs font-semibold text-[var(--text-muted)]">Total</span>
              <span className="text-xs font-bold text-[var(--text-secondary)] tabular-nums">{formatINR(data.totalAssets)}</span>
            </div>
          )}

          {/* Liabilities */}
          {data.totalLiabilities > 0 && (
            <>
              <div className="pt-1.5">
                <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-0.5">Liabilities</p>
              </div>
              <ExpandableRow
                dot="bg-rose-500"
                label={data.liabilityCount === 1 ? (data.liabilityDetails[0]?.type || 'Loan') : `${data.liabilityCount} Loans`}
                value={<span className="text-[var(--accent-rose)]">&minus;{formatINR(data.totalLiabilities)}</span>}
                valueClass="text-[var(--accent-rose)]"
                items={data.liabilityDetails}
                renderItem={(l) => (
                  <div key={l.name + l.type} className="flex items-center justify-between">
                    <div className="min-w-0 mr-2">
                      <span className="text-[11px] text-[var(--text-dim)] truncate block">{l.name}</span>
                      {l.emi > 0 && <span className="text-[10px] text-[var(--text-dim)]/60">EMI {formatINR(l.emi)}/mo</span>}
                    </div>
                    <span className="text-[11px] text-[var(--accent-rose)] tabular-nums shrink-0">{formatINR(l.balance)}</span>
                  </div>
                )}
              />
              {data.totalEMI > 0 && (
                <div className="flex items-center justify-between pl-2">
                  <span className="text-[11px] text-[var(--text-dim)]">Total EMI</span>
                  <span className="text-[11px] text-[var(--text-dim)] tabular-nums">{formatINR(data.totalEMI)}/mo</span>
                </div>
              )}
            </>
          )}

          {/* Net Worth line */}
          <div className="border-t border-dashed border-[var(--border-light)] pt-1.5 mt-1 flex items-center justify-between">
            <span className="text-xs font-bold text-[var(--text-primary)]">= Net Worth</span>
            <span className="text-sm font-bold text-[var(--text-primary)] tabular-nums">{formatINR(data.netWorth)}</span>
          </div>
        </div>

        {/* P&L */}
        {data.totalInvested > 0 && (
          <div className="mt-3 flex items-center gap-2 text-xs">
            <span className="text-[var(--text-dim)]">Invested {formatINR(data.totalInvested)}</span>
            <span className="text-[var(--text-dim)]">&rarr;</span>
            <span className={`font-semibold ${plColor(data.totalPL)}`}>
              P&L {plPrefix(data.totalPL)}{formatINR(Math.abs(data.totalPL))} ({plPrefix(data.totalPL)}{((data.totalPL / data.totalInvested) * 100).toFixed(1)}%)
            </span>
          </div>
        )}

      </div>

      {/* Allocation Carousel — Product Type + Asset Class */}
      {data.totalAssets > 0 && (
        <BreakdownCarousel>
          {/* Slide 1: Product Allocation */}
          <BreakdownSlide title="By Product">
            <div className="h-2.5 rounded-full overflow-hidden bg-[var(--bg-inset)] flex">
              {data.mfCurrentValue > 0 && <div className="bg-violet-500 h-full" style={{ width: `${(data.mfCurrentValue / data.totalAssets) * 100}%` }} />}
              {data.stkCurrentValue > 0 && <div className="bg-blue-500 h-full" style={{ width: `${(data.stkCurrentValue / data.totalAssets) * 100}%` }} />}
              {data.otherCurrentValue > 0 && <div className="bg-emerald-500 h-full" style={{ width: `${(data.otherCurrentValue / data.totalAssets) * 100}%` }} />}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5">
              {data.mfCurrentValue > 0 && <span className="flex items-center gap-1 text-[11px] text-[var(--text-dim)]"><span className="w-1.5 h-1.5 rounded-full bg-violet-500" />MF {((data.mfCurrentValue / data.totalAssets) * 100).toFixed(0)}% <span className="text-[var(--text-dim)]/50 tabular-nums">{formatINR(data.mfCurrentValue)}</span></span>}
              {data.stkCurrentValue > 0 && <span className="flex items-center gap-1 text-[11px] text-[var(--text-dim)]"><span className="w-1.5 h-1.5 rounded-full bg-blue-500" />Stocks {((data.stkCurrentValue / data.totalAssets) * 100).toFixed(0)}% <span className="text-[var(--text-dim)]/50 tabular-nums">{formatINR(data.stkCurrentValue)}</span></span>}
              {data.otherCurrentValue > 0 && <span className="flex items-center gap-1 text-[11px] text-[var(--text-dim)]"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Other {((data.otherCurrentValue / data.totalAssets) * 100).toFixed(0)}% <span className="text-[var(--text-dim)]/50 tabular-nums">{formatINR(data.otherCurrentValue)}</span></span>}
            </div>
          </BreakdownSlide>

          {/* Slide 2: Asset Class */}
          {data.assetClassList.length > 1 && (
            <BreakdownSlide title="By Asset Class">
              <div className="h-2.5 rounded-full overflow-hidden bg-[var(--bg-inset)] flex">
                {data.assetClassList.map((c) => (
                  <div key={c.name} className={`h-full ${assetClassColor(c.name)}`} style={{ width: `${c.pct}%` }} />
                ))}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5">
                {data.assetClassList.map((c) => (
                  <span key={c.name} className="flex items-center gap-1 text-[11px] text-[var(--text-dim)]">
                    <span className={`w-1.5 h-1.5 rounded-full ${assetClassColor(c.name)}`} />
                    {c.name} {c.pct.toFixed(0)}% <span className="text-[var(--text-dim)]/50 tabular-nums">{formatINR(c.value)}</span>
                  </span>
                ))}
              </div>
            </BreakdownSlide>
          )}
        </BreakdownCarousel>
      )}

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

/* ── Expandable row — tap to slide open details ── */
function ExpandableRow({ dot, label, value, items, renderItem }) {
  const [open, setOpen] = useState(false)
  const hasDetails = items && items.length > 1

  return (
    <div className="pl-2">
      <button
        onClick={hasDetails ? () => setOpen(!open) : undefined}
        className={`w-full flex items-center justify-between py-0.5 ${hasDetails ? 'cursor-pointer' : ''}`}
      >
        <span className="flex items-center gap-1.5 text-xs text-[var(--text-dim)]">
          <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
          {label}
          {hasDetails && (
            <ChevronDown size={10} className={`text-[var(--text-dim)] transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
          )}
        </span>
        <span className="text-xs font-semibold text-[var(--text-secondary)] tabular-nums">{value}</span>
      </button>

      {/* Slide-open detail items */}
      <div
        className="overflow-hidden transition-all duration-200 ease-in-out"
        style={{ maxHeight: open ? `${items.length * 40}px` : '0px', opacity: open ? 1 : 0 }}
      >
        <div className="pl-4 py-1 space-y-1 border-l border-[var(--border-light)] ml-0.5">
          {items.map(renderItem)}
        </div>
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

/* ── Breakdown Carousel — horizontal snap scroll ── */
function BreakdownCarousel({ children }) {
  const scrollRef = useRef(null)
  const [active, setActive] = useState(0)
  const slides = Children.toArray(children).filter(Boolean)

  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const idx = Math.round(el.scrollLeft / el.offsetWidth)
    setActive(idx)
  }, [])

  if (slides.length === 0) return null

  return (
    <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] overflow-hidden">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar"
      >
        {slides.map((slide, i) => (
          <div key={i} className="w-full shrink-0 snap-start p-4">
            {slide}
          </div>
        ))}
      </div>
      {slides.length > 1 && (
        <div className="flex justify-center gap-1.5 pb-3 -mt-1">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => scrollRef.current?.scrollTo({ left: i * scrollRef.current.offsetWidth, behavior: 'smooth' })}
              className={`w-1.5 h-1.5 rounded-full transition-colors ${i === active ? 'bg-violet-400' : 'bg-[var(--border-light)]'}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function BreakdownSlide({ title, children }) {
  return (
    <div>
      <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">{title}</p>
      {children}
    </div>
  )
}
