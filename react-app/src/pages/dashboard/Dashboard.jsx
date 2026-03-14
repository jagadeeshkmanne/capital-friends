import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trophy, Star, TrendingUp, TrendingDown, ChevronDown } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { useData } from '../../context/DataContext'
import PageLoading from '../../components/PageLoading'
import Modal from '../../components/Modal'
import MFRebalanceDialog from '../../components/forms/MFRebalanceDialog'
import { useFamily } from '../../context/FamilyContext'
import { useMask } from '../../context/MaskContext'
import { formatINR, splitFundName } from '../../data/familyData'
import { GLIDE_PATH } from '../../data/glidePath'

function plColor(val) { return val >= 0 ? 'text-emerald-400' : 'text-red-400' }
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

const ASSET_CLASS_HEX = { Equity: '#8b5cf6', Debt: '#60a5fa', Gold: '#fbbf24', Commodities: '#eab308', 'Real Estate': '#f97316', Hybrid: '#818cf8', Cash: '#94a3b8', Other: '#94a3b8' }

const ALLOC_TYPE_COLORS = [
  '#f97316', '#8b5cf6', '#fbbf24', '#f59e0b', '#34d399', '#ec4899', '#60a5fa', '#3b82f6',
  '#06b6d4', '#10b981', '#ef4444', '#a855f7',
]

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg, #8b5cf6, #6366f1)',
  'linear-gradient(135deg, #ec4899, #f43f5e)',
  'linear-gradient(135deg, #3b82f6, #06b6d4)',
  'linear-gradient(135deg, #f59e0b, #f97316)',
  'linear-gradient(135deg, #10b981, #34d399)',
  'linear-gradient(135deg, #ef4444, #dc2626)',
]

const ROLE_COLORS = {
  Self: { bg: 'rgba(139,92,246,0.1)', color: '#a78bfa' },
  Spouse: { bg: 'rgba(236,72,153,0.1)', color: '#ec4899' },
  Father: { bg: 'rgba(59,130,246,0.1)', color: '#60a5fa' },
  Mother: { bg: 'rgba(245,158,11,0.1)', color: '#f59e0b' },
  Child: { bg: 'rgba(59,130,246,0.1)', color: '#60a5fa' },
}

// Section header component
function SectionHeader({ label, color, badge, linkText, onClick }) {
  return (
    <div className="-mx-6 -mt-6 px-6 py-3.5 mb-4 flex items-center justify-between rounded-t-xl"
         style={{ background: 'rgba(128,128,128,0.04)', borderBottom: '1px solid rgba(128,128,128,0.08)' }}>
      <div className="flex items-center gap-2">
        <span className="w-[3px] h-3.5 rounded-sm opacity-60" style={{ background: color || 'currentColor' }} />
        <span className="text-sm font-bold uppercase tracking-wider" style={{ color: color || 'var(--text-muted)' }}>{label}</span>
        {badge != null && (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold"
                style={{ background: color ? `${color}15` : 'rgba(128,128,128,0.1)', color: color || 'var(--text-muted)' }}>
            {badge}
          </span>
        )}
      </div>
      {linkText && (
        <button onClick={onClick} className="text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors">
          {linkText} ›
        </button>
      )}
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { selectedMember, familyMembers } = useFamily()
  const { masked, mv } = useMask()
  const {
    mfPortfolios, mfHoldings,
    stockPortfolios, stockHoldings,
    otherInvList, liabilityList,
    banks, investmentAccounts, insurancePolicies,
    reminderList, goalList, goalPortfolioMappings,
    assetAllocations,
    activeMembers, activeBanks, activeInvestmentAccounts,
  } = useData()

  const [showRebalanceDialog, setShowRebalanceDialog] = useState(false)
  const [openRebalance, setOpenRebalance] = useState({ 0: true })

  // ── Filter helper ──
  const filterOwner = (items, ownerKey) =>
    selectedMember === 'all' ? items : items.filter((i) => i[ownerKey] === selectedMember)

  // ── Core data computation ──
  const data = useMemo(() => {
    // MF
    const activeMFPortfolios = filterOwner((mfPortfolios || []).filter((p) => p.status === 'Active'), 'ownerId')
    const mfPortfolioIds = new Set(activeMFPortfolios.map((p) => p.portfolioId))
    const activeMFHoldings = (mfHoldings || []).filter((h) => mfPortfolioIds.has(h.portfolioId) && h.units > 0)
    const mfInvested = activeMFHoldings.reduce((s, h) => s + h.investment, 0)
    const mfCurrentValue = activeMFHoldings.reduce((s, h) => s + h.currentValue, 0)
    const mfPL = mfCurrentValue - mfInvested

    // Stocks
    const activeStockPortfolios = filterOwner((stockPortfolios || []).filter((p) => p.status === 'Active'), 'ownerId')
    const stkPortfolioIds = new Set(activeStockPortfolios.map((p) => p.portfolioId))
    const activeStockHoldings = (stockHoldings || []).filter((h) => stkPortfolioIds.has(h.portfolioId))
    const stkInvested = activeStockHoldings.reduce((s, h) => s + h.totalInvestment, 0)
    const stkCurrentValue = activeStockHoldings.reduce((s, h) => s + h.currentValue, 0)
    const stkPL = stkCurrentValue - stkInvested

    // Other Investments
    const activeOther = filterOwner((otherInvList || []).filter((i) => i.status === 'Active'), 'familyMemberId')
    const otherInvested = activeOther.reduce((s, i) => s + i.investedAmount, 0)
    const otherCurrentValue = activeOther.reduce((s, i) => s + i.currentValue, 0)
    const otherPL = otherCurrentValue - otherInvested

    // Liabilities
    const activeLiabilities = filterOwner((liabilityList || []).filter((l) => l.status === 'Active'), 'familyMemberId')
    const totalLiabilities = activeLiabilities.reduce((s, l) => s + l.outstandingBalance, 0)
    const totalEMI = activeLiabilities.reduce((s, l) => s + l.emiAmount, 0)

    // Insurance
    const activeInsurance = filterOwner((insurancePolicies || []).filter((p) => p.status === 'Active'), 'memberId')
    const lifeCover = activeInsurance.filter((p) => p.policyType === 'Term Life').reduce((s, p) => s + p.sumAssured, 0)
    const healthCover = activeInsurance.filter((p) => p.policyType === 'Health').reduce((s, p) => s + p.sumAssured, 0)
    const totalPremium = activeInsurance.reduce((s, p) => s + (p.premium || 0), 0)

    // Bank accounts
    const filteredBanks = filterOwner((banks || []).filter((b) => b.status === 'Active'), 'memberId')

    // Investment accounts
    const filteredInvAccounts = filterOwner((investmentAccounts || []).filter((a) => a.status === 'Active'), 'memberId')

    // Goals
    const activeGoals = filterOwner((goalList || []).filter((g) => g.isActive !== false), 'familyMemberId')

    // Reminders
    const activeReminders = filterOwner((reminderList || []).filter((r) => r.isActive !== false && r.status !== 'Completed'), 'familyMemberId')

    // Members
    const filteredMembers = selectedMember === 'all'
      ? (activeMembers || [])
      : (activeMembers || []).filter((m) => m.memberId === selectedMember)

    // Totals
    const totalAssets = mfCurrentValue + stkCurrentValue + otherCurrentValue
    const netWorth = totalAssets - totalLiabilities
    const totalInvested = mfInvested + stkInvested + otherInvested
    const totalPL = totalAssets - totalInvested
    const plPct = totalInvested > 0 ? (totalPL / totalInvested) * 100 : 0

    // Asset class breakdown (Equity/Debt/Gold/Hybrid/etc.)
    const allocMap = {}
    if (assetAllocations) {
      for (const a of assetAllocations) {
        if (a.assetAllocation) allocMap[a.fundCode] = a.assetAllocation
      }
    }

    const assetClasses = { Equity: 0, Debt: 0, Gold: 0, Hybrid: 0, Commodities: 0, 'Real Estate': 0, Cash: 0, Other: 0 }

    activeMFHoldings.forEach((h) => {
      const detailed = allocMap[h.schemeCode || h.fundCode]
      if (detailed) {
        for (const [cls, pct] of Object.entries(detailed)) {
          if (cls in assetClasses) assetClasses[cls] += h.currentValue * (pct / 100)
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
    assetClasses.Equity += stkCurrentValue
    activeOther.forEach((inv) => {
      const t = (inv.investmentType || '').toLowerCase()
      if (t.includes('gold') || t.includes('sgb') || t.includes('sovereign gold')) assetClasses.Gold += inv.currentValue
      else if (t.includes('silver') || t.includes('commodity')) assetClasses.Commodities += inv.currentValue
      else if (t.includes('fd') || t.includes('fixed') || t.includes('bond') || t.includes('ppf') || t.includes('epf') || t.includes('nps') || t.includes('rd') || t.includes('nsc') || t.includes('ssy')) assetClasses.Debt += inv.currentValue
      else if (t.includes('real estate') || t.includes('property')) assetClasses['Real Estate'] += inv.currentValue
      else assetClasses.Other += inv.currentValue
    })

    const assetClassList = Object.entries(assetClasses)
      .filter(([, val]) => val > 0)
      .sort(([, a], [, b]) => b - a)
      .map(([cls, val]) => ({ name: cls, value: val, pct: totalAssets > 0 ? (val / totalAssets) * 100 : 0, fill: ASSET_CLASS_HEX[cls] || '#94a3b8' }))

    // Asset allocation by investment TYPE (for donut chart)
    const typeMap = {}
    if (mfCurrentValue > 0) typeMap['Mutual Funds'] = (typeMap['Mutual Funds'] || 0) + mfCurrentValue
    if (stkCurrentValue > 0) typeMap['Stocks'] = (typeMap['Stocks'] || 0) + stkCurrentValue
    activeOther.forEach((inv) => {
      const t = inv.investmentType || 'Other'
      typeMap[t] = (typeMap[t] || 0) + inv.currentValue
    })
    const allocByType = Object.entries(typeMap)
      .filter(([, val]) => val > 0)
      .sort(([, a], [, b]) => b - a)
      .map(([name, value], idx) => ({ name, value, pct: totalAssets > 0 ? (value / totalAssets) * 100 : 0, fill: ALLOC_TYPE_COLORS[idx % ALLOC_TYPE_COLORS.length] }))

    // Buy opportunities (MF holdings 5%+ below ATH) — deduplicated by fund name
    const buyOppMap = {}
    activeMFPortfolios.forEach((p) => {
      const pHoldings = (mfHoldings || []).filter((h) => h.portfolioId === p.portfolioId && h.units > 0)
      pHoldings.forEach((h) => {
        if (h.athNav > 0 && h.belowATHPct >= 5) {
          const { main } = splitFundName(h.fundName)
          if (!buyOppMap[main] || h.belowATHPct > buyOppMap[main].belowATHPct) {
            buyOppMap[main] = { fundName: main, belowATHPct: h.belowATHPct, isStrongBuy: h.belowATHPct >= 10 }
          }
        }
      })
    })
    const buyOpportunities = Object.values(buyOppMap).sort((a, b) => b.belowATHPct - a.belowATHPct)

    // Rebalance needed (MF holdings with allocation drift beyond threshold)
    // Skip portfolios where user has opted out of rebalance alerts
    const rebalanceItems = []
    activeMFPortfolios.filter(p => !p.skipRebalance).forEach((p) => {
      const pHoldings = (mfHoldings || []).filter((h) => h.portfolioId === p.portfolioId && h.units > 0)
      const pValue = pHoldings.reduce((s, h) => s + h.currentValue, 0)
      const threshold = (p.rebalanceThreshold || 0.05) * 100
      pHoldings.forEach((h) => {
        if (h.targetAllocationPct > 0 && pValue > 0) {
          const currentPct = (h.currentValue / pValue) * 100
          const drift = currentPct - h.targetAllocationPct
          if (Math.abs(drift) > threshold) {
            const { main } = splitFundName(h.fundName)
            rebalanceItems.push({
              fundName: main,
              portfolioName: p.portfolioName,
              ownerName: p.ownerName,
              currentPct: Math.round(currentPct),
              targetPct: Math.round(h.targetAllocationPct),
              drift: Math.round(drift),
            })
          }
        }
      })
    })
    rebalanceItems.sort((a, b) => Math.abs(b.drift) - Math.abs(a.drift))

    // Group rebalance items by portfolio for tabbed display
    const rebalanceByPortfolio = {}
    rebalanceItems.forEach(item => {
      const key = `${item.ownerName}'s ${item.portfolioName}`
      if (!rebalanceByPortfolio[key]) rebalanceByPortfolio[key] = { label: key, ownerName: item.ownerName, portfolioName: item.portfolioName, items: [] }
      rebalanceByPortfolio[key].items.push(item)
    })
    const rebalancePortfolios = Object.values(rebalanceByPortfolio)

    // Investments table rows (grouped by type)
    const investmentRows = []

    // MF row
    if (mfCurrentValue > 0) {
      const mfOwners = [...new Set(activeMFPortfolios.map((p) => p.ownerName))].join(', ')
      const mfPlatforms = [...new Set(activeMFPortfolios.map((p) => {
        const ia = (investmentAccounts || []).find((a) => a.accountId === p.investmentAccountId)
        return ia ? ia.platformBroker : p.investmentAccountName || ''
      }).filter(Boolean))].join(', ')
      investmentRows.push({ type: 'Mutual Funds', platform: mfPlatforms, owner: mfOwners, invested: mfInvested, current: mfCurrentValue, pl: mfPL })
    }

    // Stocks row
    if (stkCurrentValue > 0) {
      const stkOwners = [...new Set(activeStockPortfolios.map((p) => p.ownerName))].join(', ')
      const stkPlatforms = [...new Set(activeStockPortfolios.map((p) => {
        const ia = (investmentAccounts || []).find((a) => a.accountId === p.investmentAccountId)
        return ia ? ia.platformBroker : p.investmentAccountName || ''
      }).filter(Boolean))].join(', ')
      investmentRows.push({ type: 'Stocks', platform: stkPlatforms, owner: stkOwners, invested: stkInvested, current: stkCurrentValue, pl: stkPL })
    }

    // Other investments (grouped by type)
    const otherByType = {}
    activeOther.forEach((inv) => {
      const t = inv.investmentType || 'Other'
      if (!otherByType[t]) otherByType[t] = { invested: 0, current: 0, owners: new Set(), platforms: new Set() }
      otherByType[t].invested += inv.investedAmount
      otherByType[t].current += inv.currentValue
      otherByType[t].owners.add(inv.familyMemberName)
      // Use investment name as platform placeholder for other investments
      if (inv.investmentName) otherByType[t].platforms.add(inv.investmentName)
    })
    Object.entries(otherByType).forEach(([type, d]) => {
      const pl = d.current - d.invested
      investmentRows.push({
        type,
        platform: d.platforms.size <= 2 ? [...d.platforms].join(', ') : `${d.platforms.size} investments`,
        owner: [...d.owners].join(', '),
        invested: d.invested,
        current: d.current,
        pl: d.invested > 0 ? pl : null,
      })
    })

    // Per-member net worth computation
    const memberNetWorth = {}
    // MF by owner
    activeMFPortfolios.forEach((p) => {
      const ph = activeMFHoldings.filter((h) => h.portfolioId === p.portfolioId)
      const val = ph.reduce((s, h) => s + h.currentValue, 0)
      memberNetWorth[p.ownerId] = (memberNetWorth[p.ownerId] || 0) + val
    })
    // Stocks by owner
    activeStockPortfolios.forEach((p) => {
      const ph = activeStockHoldings.filter((h) => h.portfolioId === p.portfolioId)
      const val = ph.reduce((s, h) => s + h.currentValue, 0)
      memberNetWorth[p.ownerId] = (memberNetWorth[p.ownerId] || 0) + val
    })
    // Other investments by member
    activeOther.forEach((inv) => {
      memberNetWorth[inv.familyMemberId] = (memberNetWorth[inv.familyMemberId] || 0) + inv.currentValue
    })
    // Subtract liabilities
    activeLiabilities.forEach((l) => {
      memberNetWorth[l.familyMemberId] = (memberNetWorth[l.familyMemberId] || 0) - l.outstandingBalance
    })

    // ── Top Performing Funds (Gainers & Losers) — deduplicated by schemeCode ──
    const fundMap = {}
    activeMFHoldings.filter(h => h.investment > 0).forEach(h => {
      const key = h.schemeCode || splitFundName(h.fundName).main
      const pName = (activeMFPortfolios.find(p => p.portfolioId === h.portfolioId)?.portfolioName || '').replace(/^PFL-/, '')
      if (!fundMap[key]) fundMap[key] = { fundName: splitFundName(h.fundName).main, investment: 0, currentValue: 0, portfolios: [] }
      fundMap[key].investment += h.investment
      fundMap[key].currentValue += h.currentValue
      if (pName && !fundMap[key].portfolios.includes(pName)) fundMap[key].portfolios.push(pName)
    })
    const fundPerformance = Object.values(fundMap)
      .map(f => ({ ...f, pl: f.currentValue - f.investment, plPct: ((f.currentValue - f.investment) / f.investment) * 100 }))
      .sort((a, b) => b.plPct - a.plPct)
    const topGainers = fundPerformance.filter(f => f.plPct >= 5).slice(0, 3)
    const topLosers = fundPerformance.filter(f => f.plPct <= -5).sort((a, b) => a.plPct - b.plPct).slice(0, 3)

    // ── Portfolio Leaderboard ──
    const portfolioLeaderboard = activeMFPortfolios
      .map(p => {
        const ph = activeMFHoldings.filter(h => h.portfolioId === p.portfolioId)
        const invested = ph.reduce((s, h) => s + h.investment, 0)
        const current = ph.reduce((s, h) => s + h.currentValue, 0)
        return { portfolioId: p.portfolioId, portfolioName: p.portfolioName?.replace(/^PFL-/, '') || p.portfolioName,
          ownerName: p.ownerName, invested, current,
          pl: current - invested, plPct: invested > 0 ? ((current - invested) / invested) * 100 : 0 }
      })
      .filter(p => p.invested > 0)
      .sort((a, b) => b.plPct - a.plPct)

    // ── SIP Tracker ──
    const totalMonthlySIP = activeMFHoldings.reduce((s, h) => s + (h.ongoingSIP || 0), 0)
    const activeSIPCount = activeMFHoldings.filter(h => h.ongoingSIP > 0).length

    // ── Near ATH Funds (deduplicated by fund name) ──
    const nearATHMap = {}
    activeMFPortfolios.forEach(p => {
      activeMFHoldings.filter(h => h.portfolioId === p.portfolioId).forEach(h => {
        if (h.athNav > 0 && h.belowATHPct >= 0 && h.belowATHPct < 2) {
          const name = splitFundName(h.fundName).main
          if (!nearATHMap[name] || h.belowATHPct < nearATHMap[name].belowATHPct) {
            nearATHMap[name] = { fundName: name, belowATHPct: h.belowATHPct, isAtATH: h.belowATHPct === 0 }
          }
        }
      })
    })
    const nearATHFunds = Object.values(nearATHMap).sort((a, b) => a.belowATHPct - b.belowATHPct)

    // ── Goal Allocation Health (for dashboard goals section) ──
    // Build fund breakdown lookup for accurate equity/debt split
    const goalAllocMap = {}
    if (assetAllocations) {
      for (const a of assetAllocations) {
        if (a.assetAllocation) goalAllocMap[a.fundCode] = a.assetAllocation
      }
    }
    const EQUITY_CATS_G = new Set(['Equity', 'ELSS', 'Index'])
    const nowGH = new Date()
    const dashGoalHealth = {}
    activeGoals.forEach(g => {
      if (g.status === 'Achieved') return
      const yearsLeft = (new Date(g.targetDate) - nowGH) / (365.25 * 24 * 60 * 60 * 1000)
      if (yearsLeft <= 0) return
      const rec = g.goalType === 'Emergency Fund'
        ? { equity: 0, debt: 100, label: 'Safety' }
        : (() => { const s = GLIDE_PATH.find(s => yearsLeft <= s.maxYears); return { equity: s.equity, debt: 100 - s.equity, label: s.label } })()
      const maps = (goalPortfolioMappings || []).filter(m => m.goalId === g.goalId)
      let totalVal = 0, eqVal = 0
      for (const m of maps) {
        for (const h of activeMFHoldings.filter(h => h.portfolioId === m.portfolioId)) {
          const v = h.currentValue * (m.allocationPct / 100)
          totalVal += v
          const detailed = goalAllocMap[h.schemeCode || h.fundCode]
          if (detailed) {
            eqVal += v * ((detailed.Equity || 0) / 100)
          } else if (EQUITY_CATS_G.has(h.category)) eqVal += v
          else if (h.category === 'Hybrid') eqVal += v * 0.65
          else if (h.category === 'Multi-Asset') eqVal += v * 0.50
        }
      }
      const actualEq = totalVal > 0 ? Math.round((eqVal / totalVal) * 100) : null
      const mismatch = maps.length > 0 && actualEq !== null ? Math.round(actualEq - rec.equity) : null
      // Live SIP/lumpsum
      const cagr = g.expectedCAGR || 0.12, mr = cagr / 12
      const months = Math.max(0, Math.round(yearsLeft * 12))
      const fvCur = (g.currentValue || 0) * (months > 0 ? Math.pow(1 + mr, months) : 1)
      const gap = Math.max(0, (g.targetAmount || 0) - fvCur)
      const liveSIP = gap > 0 && months > 0 ? (mr > 0 ? Math.ceil(gap / ((Math.pow(1 + mr, months) - 1) / mr)) : Math.ceil(gap / months)) : 0
      const liveLS = gap > 0 && months > 0 ? Math.round(gap / Math.pow(1 + mr, months)) : 0
      dashGoalHealth[g.goalId] = {
        yearsLeft, label: rec.label, recommendedEquity: rec.equity, recommendedDebt: rec.debt,
        actualEquity: actualEq, isMapped: maps.length > 0,
        mismatch, needsAttention: mismatch !== null && Math.abs(mismatch) > 15,
        liveSIP, liveLumpsum: liveLS,
      }
    })

    return {
      mfCurrentValue, mfInvested, mfPL,
      stkCurrentValue, stkInvested, stkPL,
      otherCurrentValue, otherInvested, otherPL,
      totalLiabilities, totalEMI,
      lifeCover, healthCover, totalPremium,
      totalAssets, totalInvested, totalPL, plPct, netWorth,
      assetClassList, allocByType,
      buyOpportunities, rebalanceItems, rebalancePortfolios,
      investmentRows,
      activeLiabilities, activeInsurance, activeGoals, activeReminders,
      filteredBanks, filteredInvAccounts, filteredMembers,
      memberNetWorth,
      activeMFPortfolios, activeStockPortfolios,
      topGainers, topLosers, portfolioLeaderboard,
      totalMonthlySIP, activeSIPCount,
      nearATHFunds, dashGoalHealth,
    }
  }, [selectedMember, mfPortfolios, mfHoldings, stockPortfolios, stockHoldings, otherInvList, liabilityList, banks, investmentAccounts, insurancePolicies, goalList, goalPortfolioMappings, reminderList, assetAllocations, activeMembers])

  // ── Action Items (computed from real data) ──
  const actionItems = useMemo(() => {
    const items = []
    const activeInsurance = filterOwner((insurancePolicies || []).filter((p) => p.status === 'Active'), 'memberId')

    // Check term life insurance
    const hasTermLife = activeInsurance.some((p) => p.policyType === 'Term Life')
    if (!hasTermLife) {
      items.push({
        type: 'critical', title: 'No Term Life Insurance',
        description: 'Family loses its sole income source if primary earner passes away. Get 10-15x annual income cover.',
        action: 'Add Policy', navigateTo: '/insurance',
      })
    }

    // Check health insurance
    const healthCover = activeInsurance.filter((p) => p.policyType === 'Health').reduce((s, p) => s + p.sumAssured, 0)
    if (healthCover === 0) {
      items.push({
        type: 'critical', title: 'No Health Insurance',
        description: 'Medical emergencies without cover can wipe out years of savings. Get minimum 10L family cover.',
        action: 'Add Policy', navigateTo: '/insurance',
      })
    } else if (healthCover < 500000) {
      items.push({
        type: 'warning', title: 'Inadequate Health Insurance',
        description: `Current cover ${formatINR(healthCover)} may not cover a single hospital stay. Consider upgrading.`,
        navigateTo: '/insurance',
      })
    }

    // Check emergency fund goals
    const emergencyGoals = filterOwner((goalList || []).filter((g) => g.isActive !== false && g.goalType === 'Emergency Fund'), 'familyMemberId')
    emergencyGoals.forEach((g) => {
      const pct = g.targetAmount > 0 ? (g.currentValue / g.targetAmount) * 100 : 0
      if (pct < 100) {
        const remaining = g.targetAmount - g.currentValue
        items.push({
          type: pct >= 75 ? 'warning' : 'warning',
          title: `Emergency Fund at ${pct.toFixed(0)}%`,
          description: `Job loss or medical emergency forces debt. ${formatINR(remaining)} more needed for full cushion.`,
          action: 'View Goal', navigateTo: '/goals',
        })
      }
    })

    // Overdue reminders
    const activeReminders = filterOwner((reminderList || []).filter((r) => r.isActive !== false), 'familyMemberId')
    activeReminders.filter((r) => new Date(r.dueDate) < new Date()).forEach((r) => {
      const days = Math.ceil((new Date() - new Date(r.dueDate)) / (24 * 60 * 60 * 1000))
      items.push({
        type: 'critical', title: r.title,
        description: `${days} day${days !== 1 ? 's' : ''} overdue. ${r.description || ''}`.trim(),
        navigateTo: '/reminders',
      })
    })

    // Goals needing attention
    const needsAttention = filterOwner((goalList || []).filter((g) => g.isActive !== false && g.status === 'Needs Attention'), 'familyMemberId')
    needsAttention.forEach((g) => {
      items.push({
        type: 'warning', title: `${g.goalName} needs attention`,
        description: `Progress is behind schedule. Consider increasing monthly investment.`,
        action: 'View Goal', navigateTo: '/goals',
      })
    })

    // Goal allocation mismatches (de-risk alerts)
    // Reuse goalAllocMap built above for fund breakdown data
    const EQUITY_CATS_DASH = new Set(['Equity', 'ELSS', 'Index'])
    const nowD = new Date()
    filterOwner((goalList || []).filter(g => g.isActive !== false), 'familyMemberId').forEach(g => {
      if (g.status === 'Achieved') return
      const yearsLeft = (new Date(g.targetDate) - nowD) / (365.25 * 24 * 60 * 60 * 1000)
      if (yearsLeft <= 0) return
      const rec = g.goalType === 'Emergency Fund' ? 0
        : yearsLeft <= 1 ? 10 : yearsLeft <= 3 ? 30 : yearsLeft <= 5 ? 50
        : yearsLeft <= 7 ? 65 : yearsLeft <= 10 ? 75 : 85
      const maps = (goalPortfolioMappings || []).filter(m => m.goalId === g.goalId)
      if (!maps.length) return
      let total = 0, eq = 0
      for (const m of maps) {
        for (const h of (mfHoldings || []).filter(h => h.portfolioId === m.portfolioId && h.units > 0)) {
          const v = h.currentValue * (m.allocationPct / 100)
          total += v
          const detailed = goalAllocMap[h.schemeCode || h.fundCode]
          if (detailed) {
            eq += v * ((detailed.Equity || 0) / 100)
          } else if (EQUITY_CATS_DASH.has(h.category)) eq += v
          else if (h.category === 'Hybrid') eq += v * 0.65
          else if (h.category === 'Multi-Asset') eq += v * 0.50
        }
      }
      const actual = total > 0 ? Math.round((eq / total) * 100) : null
      if (actual !== null && actual - rec > 15) {
        items.push({
          type: 'warning', title: `${g.goalName}: De-risk needed`,
          description: `${actual}% equity, recommended max ${rec}%. ${Math.round(yearsLeft)} yrs to target — shift to debt.`,
          action: 'View Goal', navigateTo: '/goals',
        })
      }
    })

    return items.slice(0, 6)
  }, [selectedMember, insurancePolicies, goalList, reminderList, goalPortfolioMappings, mfHoldings])

  // ── Upcoming Reminders (sorted by due date) ──
  const upcomingReminders = useMemo(() => {
    const active = filterOwner((reminderList || []).filter((r) => r.isActive !== false && r.status !== 'Completed'), 'familyMemberId')
    const now = new Date()
    return active
      .map((r) => {
        const diff = new Date(r.dueDate) - now
        const days = Math.ceil(diff / (24 * 60 * 60 * 1000))
        return { ...r, days }
      })
      .filter((r) => r.days >= 0)
      .sort((a, b) => a.days - b.days)
      .slice(0, 5)
  }, [selectedMember, reminderList])

  if (mfPortfolios === null || mfHoldings === null) return <PageLoading title="Loading dashboard" cards={4} />

  return (
    <>
      <div className="max-w-[1280px] mx-auto">
        {/* Print styles — fallback for window.print() */}
        <style>{`
          @media print {
            @page { margin: 8mm; size: A4; }
            *, *::before, *::after { color-adjust: exact !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            html, body { background: #0f172a !important; color: #e2e8f0 !important; overflow: visible !important; height: auto !important; }
            nav, header, footer, .print\\:hidden, [class*="BottomNav"], [class*="Sidebar"],
            [class*="safe-bottom"] { display: none !important; }
            div, main, section { overflow: visible !important; height: auto !important; max-height: none !important; }
            .flex.flex-col.h-dvh { height: auto !important; overflow: visible !important; display: block !important; }
            main.flex-1 { overflow: visible !important; padding-bottom: 0 !important; }
            .max-w-\\[1280px\\], .max-w-7xl { max-width: 100% !important; padding: 0 !important; margin: 0 auto !important; }
            .grid.grid-cols-1.md\\:grid-cols-2 { display: flex !important; flex-direction: column !important; gap: 8px !important; }
            .grid.grid-cols-1.md\\:grid-cols-2 > * { width: 100% !important; }
            .grid.grid-cols-1.md\\:grid-cols-3 { display: flex !important; flex-wrap: wrap !important; gap: 8px !important; }
            .grid.grid-cols-1.md\\:grid-cols-3 > * { flex: 1 1 30% !important; min-width: 180px !important; }
            .rounded-xl { break-inside: avoid; page-break-inside: avoid; }
            [class*="fixed"] { position: static !important; display: none !important; }
          }
        `}</style>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* ═══ NET WORTH ═══ */}
        <div className="md:col-span-2 rounded-xl border border-[var(--border)] p-7"
             style={{ background: 'linear-gradient(135deg, var(--bg-card) 0%, var(--bg-card) 100%)' }}>
          <div className="-mx-7 -mt-7 px-7 py-3.5 mb-4 flex items-center justify-between rounded-t-xl"
               style={{ background: 'rgba(128,128,128,0.04)', borderBottom: '1px solid rgba(128,128,128,0.08)' }}>
            <div className="flex items-center gap-2">
              <span className="w-[3px] h-3.5 rounded-sm opacity-60" style={{ background: 'var(--text-muted)' }} />
              <span className="text-sm font-bold uppercase tracking-wider text-[var(--text-muted)]">Net Worth</span>
            </div>
          </div>


          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="text-[34px] font-bold text-[var(--text-primary)] tabular-nums leading-tight">
                {formatINR(data.netWorth)}
              </div>
              {data.totalInvested > 0 && (
                <div className="text-sm mt-1.5">
                  <span className={`font-semibold ${plColor(data.totalPL)}`}>
                    {plPrefix(data.totalPL)}{formatINR(Math.abs(data.totalPL))}
                  </span>
                  <span className="text-[var(--text-dim)] ml-1">
                    ({plPrefix(data.totalPL)}{data.plPct.toFixed(1)}% returns)
                  </span>
                </div>
              )}
            </div>
            <div className="text-right">
              <div className="text-xs text-[var(--text-dim)]">Total Assets</div>
              <div className="text-lg font-semibold text-[var(--text-secondary)] tabular-nums">{formatINR(data.totalAssets)}</div>
              {data.totalLiabilities > 0 && (
                <>
                  <div className="text-xs text-[var(--text-dim)] mt-2">Liabilities</div>
                  <div className="text-lg font-semibold text-red-400 tabular-nums">{formatINR(data.totalLiabilities)}</div>
                </>
              )}
            </div>
          </div>

          {/* Asset class composition bar */}
          {data.assetClassList.length > 0 && (
            <div className="mt-4">
              <div className="flex h-2.5 rounded-[5px] overflow-hidden gap-0.5">
                {data.assetClassList.map((ac) => (
                  <div key={ac.name} style={{ width: `${ac.pct}%`, background: ac.fill }} title={`${ac.name} ${ac.pct < 1 ? ac.pct.toFixed(1) : ac.pct.toFixed(0)}%`} />
                ))}
              </div>
              <div className="flex gap-4 mt-2 text-xs flex-wrap">
                {data.assetClassList.map((ac) => (
                  <span key={ac.name} className="flex items-center gap-1">
                    <span className="inline-block w-2 h-2 rounded-full" style={{ background: ac.fill }} />
                    <span className="text-[var(--text-secondary)] font-medium">{ac.name} {ac.pct < 1 ? ac.pct.toFixed(1) : ac.pct.toFixed(0)}%</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ═══ ASSET ALLOCATION ═══ */}
        {data.allocByType.length > 0 && (
          <div className="md:col-span-2 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6" style={{ padding: '20px' }}>
            <SectionHeader label="Asset Allocation" color="var(--text-muted)" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-center">
              {/* Donut chart */}
              <div className="flex flex-col items-center justify-center">
                <div className="relative w-[240px] h-[240px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={data.allocByType} dataKey="value" nameKey="name" cx="50%" cy="50%"
                           innerRadius={67} outerRadius={110} paddingAngle={2} stroke="none">
                        {data.allocByType.map((d, i) => <Cell key={i} fill={d.fill} />)}
                      </Pie>
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.[0]) return null
                          const d = payload[0].payload
                          return (
                            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 shadow-lg text-xs">
                              <span className="font-semibold text-[var(--text-primary)]">{d.name}</span>
                              <span className="text-[var(--text-muted)] ml-1.5">{formatINR(d.value)} ({d.pct < 1 ? d.pct.toFixed(1) : d.pct.toFixed(0)}%)</span>
                            </div>
                          )
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <div className="text-xs text-[var(--text-dim)] uppercase tracking-wider">Net Worth</div>
                    <div className="text-2xl font-bold text-[var(--text-primary)] tabular-nums">{formatINR(data.netWorth)}</div>
                  </div>
                </div>
                {/* Summary cards below donut */}
                <div className="w-full max-w-[280px] mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-lg px-3 py-2.5 text-center" style={{ backgroundColor: 'rgba(139,92,246,0.08)' }}>
                    <p className="text-xs text-[var(--text-dim)] uppercase tracking-wider">Assets</p>
                    <p className="text-sm font-bold text-[var(--text-primary)] tabular-nums mt-0.5">{formatINR(data.totalAssets)}</p>
                    {data.totalInvested > 0 && (
                      <p className="text-xs tabular-nums mt-0.5" style={{ color: data.totalPL >= 0 ? '#34d399' : '#f87171' }}>
                        {data.totalPL >= 0 ? '+' : ''}{formatINR(data.totalPL)} P&L
                      </p>
                    )}
                  </div>
                  {data.totalLiabilities > 0 ? (
                    <div className="rounded-lg px-3 py-2.5 text-center" style={{ backgroundColor: 'rgba(244,63,94,0.08)' }}>
                      <p className="text-xs text-[var(--text-dim)] uppercase tracking-wider">Liabilities</p>
                      <p className="text-sm font-bold text-rose-400 tabular-nums mt-0.5">{formatINR(data.totalLiabilities)}</p>
                      <p className="text-xs text-[var(--text-dim)] mt-0.5">
                        {data.activeLiabilities.length} {data.activeLiabilities.length === 1 ? 'Loan' : 'Loans'}
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-lg px-3 py-2.5 text-center" style={{ backgroundColor: 'rgba(16,185,129,0.08)' }}>
                      <p className="text-xs text-[var(--text-dim)] uppercase tracking-wider">Invested</p>
                      <p className="text-sm font-bold text-[var(--text-primary)] tabular-nums mt-0.5">{formatINR(data.totalInvested)}</p>
                      {data.totalInvested > 0 && (
                        <p className="text-xs tabular-nums mt-0.5" style={{ color: data.totalPL >= 0 ? '#34d399' : '#f87171' }}>
                          {data.plPct >= 0 ? '+' : ''}{data.plPct.toFixed(1)}% returns
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Breakdown rows */}
              <div>
                {data.allocByType.map((item) => (
                  <div key={item.name} className="flex items-center justify-between py-2.5 px-3.5 mb-1.5 rounded-lg text-[13px]"
                       style={{ background: 'rgba(128,128,128,0.05)' }}>
                    <span className="flex items-center gap-2">
                      <span className="inline-block w-2 h-2 rounded-full" style={{ background: item.fill }} />
                      <span className="text-[var(--text-secondary)] font-medium">{item.name}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="text-[var(--text-secondary)] font-semibold tabular-nums">{formatINR(item.value)}</span>
                      <span className="inline-flex items-center justify-center min-w-[36px] px-2 py-0.5 rounded-[5px] text-xs font-semibold tabular-nums"
                            style={{ background: 'rgba(128,128,128,0.08)', color: item.fill }}>
                        {item.pct < 1 ? item.pct.toFixed(1) : item.pct.toFixed(0)}%
                      </span>
                    </span>
                  </div>
                ))}
                {/* Loans row */}
                {data.totalLiabilities > 0 && (
                  <div className="flex items-center justify-between py-2.5 px-3.5 mb-1.5 rounded-lg text-[13px]"
                       style={{ background: 'rgba(248,113,113,0.06)' }}>
                    <span className="flex items-center gap-2">
                      <span className="inline-block w-2 h-2 rounded-full bg-red-400" />
                      <span className="text-red-400 font-medium">
                        {data.activeLiabilities.length} {data.activeLiabilities.length === 1 ? 'Loan' : 'Loans'}
                      </span>
                    </span>
                    <span className="text-red-400 font-semibold tabular-nums">&minus;{formatINR(data.totalLiabilities)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══ ACTION REQUIRED ═══ */}
        {actionItems.length > 0 && (
          <div className="md:col-span-2 rounded-xl border bg-[var(--bg-card)] p-6"
               style={{ borderColor: 'rgba(244,63,94,0.12)' }}>
            <SectionHeader label="Action Required" color="#fb7185" badge={actionItems.length} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {actionItems.map((item, idx) => {
                const isCritical = item.type === 'critical'
                const isLastOdd = actionItems.length % 2 === 1 && idx === actionItems.length - 1
                return (
                  <div key={idx}
                       className={`rounded-[10px] p-3.5 ${isLastOdd ? 'md:col-span-2' : ''}`}
                       style={{
                         background: isCritical ? 'rgba(244,63,94,0.07)' : 'rgba(251,191,36,0.05)',
                         border: `1px solid ${isCritical ? 'rgba(244,63,94,0.18)' : 'rgba(251,191,36,0.12)'}`,
                       }}>
                    <div className="flex items-start gap-2">
                      <div className="w-[26px] h-[26px] rounded-[7px] flex items-center justify-center text-[13px] shrink-0"
                           style={{
                             background: isCritical ? 'rgba(244,63,94,0.12)' : 'rgba(251,191,36,0.1)',
                             color: isCritical ? '#fb7185' : '#fbbf24',
                           }}>
                        {isCritical ? '\u2717' : '\u26A0'}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold" style={{ color: isCritical ? '#fb7185' : '#fbbf24' }}>
                          {item.title}
                        </div>
                        {item.description && (
                          <div className="text-[13px] text-[var(--text-muted)] mt-0.5 leading-relaxed">
                            {item.description}
                          </div>
                        )}
                        {item.action && item.navigateTo && (
                          <button onClick={() => navigate(item.navigateTo)}
                                  className="text-xs font-medium mt-1.5 cursor-pointer"
                                  style={{ color: isCritical ? '#fb7185' : '#fbbf24' }}>
                            {item.action} ›
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ═══ BUY OPPORTUNITIES ═══ */}
        {data.buyOpportunities.length > 0 && (
          <div className={`rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5 cursor-pointer hover:border-[var(--border-light)] transition-colors${data.nearATHFunds.length === 0 ? ' md:col-span-2' : ''}`}
               onClick={() => navigate('/investments/mutual-funds')}>
            <SectionHeader label="Buy Opportunities" color="#34d399" badge={data.buyOpportunities.length}
                           linkText="Mutual Funds" onClick={(e) => { e.stopPropagation(); navigate('/investments/mutual-funds') }} />
            <div className="text-xs text-[var(--text-dim)] mb-3">Funds 5%+ below All-Time High</div>
            <div className="space-y-0">
              {data.buyOpportunities.map((opp, idx) => (
                <div key={idx} className="py-2"
                     style={{ borderBottom: idx < data.buyOpportunities.length - 1 ? '1px solid rgba(128,128,128,0.06)' : 'none' }}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs text-[var(--text-primary)] font-medium min-w-0 break-words leading-snug">{opp.fundName}</div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold"
                            style={{
                              background: opp.isStrongBuy ? 'rgba(34,211,238,0.12)' : 'rgba(52,211,153,0.10)',
                              color: opp.isStrongBuy ? '#22d3ee' : '#34d399',
                            }}>
                        {opp.isStrongBuy ? 'Strong Buy' : 'Buy'}
                      </span>
                      <span className="text-xs font-semibold tabular-nums"
                            style={{ color: opp.isStrongBuy ? '#22d3ee' : '#34d399' }}>
                        -{opp.belowATHPct.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ NEAR PEAK ═══ */}
        {data.nearATHFunds.length > 0 && (
          <div className={`rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5 cursor-pointer hover:border-[var(--border-light)] transition-colors${data.buyOpportunities.length === 0 ? ' md:col-span-2' : ''}`}
               onClick={() => navigate('/investments/mutual-funds')}>
            <SectionHeader label="Near Peak" color="#fbbf24" badge={data.nearATHFunds.length}
                           linkText="Mutual Funds" onClick={(e) => { e.stopPropagation(); navigate('/investments/mutual-funds') }} />
            <div className="text-xs text-[var(--text-dim)] mb-3">At or near ATH — book profits or redirect to other funds</div>
            <div className="space-y-0">
              {data.nearATHFunds.map((f, idx) => (
                <div key={idx} className="flex items-center justify-between gap-2 py-2"
                     style={{ borderBottom: idx < data.nearATHFunds.length - 1 ? '1px solid rgba(128,128,128,0.06)' : 'none' }}>
                  <div className="text-xs text-[var(--text-primary)] font-medium min-w-0 break-words leading-snug">{f.fundName}</div>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold shrink-0"
                        style={{
                          background: f.isAtATH ? 'rgba(251,191,36,0.15)' : 'rgba(245,158,11,0.08)',
                          color: f.isAtATH ? '#fbbf24' : '#f59e0b',
                        }}>
                    {f.isAtATH ? 'At ATH' : `${f.belowATHPct.toFixed(1)}% below`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ REBALANCE NEEDED ═══ */}
        {data.rebalanceItems.length > 0 && (
          <div className="md:col-span-2 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
            <SectionHeader label="Rebalance Needed" color="#a78bfa" badge={data.rebalancePortfolios.reduce((s, p) => s + p.items.length, 0)}
                           linkText="Rebalance" onClick={() => setShowRebalanceDialog(true)} />

            {/* Accordion per portfolio */}
            <div className="mt-2 space-y-1">
              {data.rebalancePortfolios.map((portfolio, pIdx) => {
                const isOpen = !!openRebalance[pIdx]
                return (
                  <div key={portfolio.label} className="rounded-lg border border-[var(--border)] overflow-hidden">
                    <button className="w-full flex items-center justify-between px-3 py-2.5 bg-[var(--bg-inset)] hover:bg-[var(--bg-inset-hover)] transition-colors"
                            onClick={(e) => { e.stopPropagation(); setOpenRebalance(prev => ({ ...prev, [pIdx]: !prev[pIdx] })) }}>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-violet-400">{portfolio.portfolioName}</span>
                        <span className="text-[10px] tabular-nums text-[var(--text-dim)] bg-violet-500/10 px-1.5 py-0.5 rounded">{portfolio.items.length} funds</span>
                      </div>
                      <ChevronDown size={14} className={`text-[var(--text-dim)] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isOpen && (
                      <div className="px-3 py-1">
                        {portfolio.items.map((item, idx) => {
                          const isOver = item.drift > 0
                          const maxPct = Math.max(item.currentPct, item.targetPct, 1)
                          return (
                            <div key={idx} className="py-2"
                                 style={{ borderBottom: idx < portfolio.items.length - 1 ? '1px solid rgba(128,128,128,0.06)' : 'none' }}>
                              {/* Desktop: single row grid */}
                              <div className="hidden sm:grid grid-cols-[1fr_80px_180px] gap-2 items-center">
                                <div className="text-xs text-[var(--text-primary)] font-medium truncate min-w-0">{item.fundName}</div>
                                <div className="text-xs tabular-nums text-right text-[var(--text-secondary)]">
                                  {item.currentPct}% → {item.targetPct}%
                                </div>
                                <div className="relative h-4 rounded bg-[var(--bg-inset)] overflow-hidden">
                                  <div className="absolute inset-y-0 left-0 rounded"
                                       style={{ width: `${(item.currentPct / maxPct) * 100}%`, background: isOver ? 'rgba(251,146,60,0.3)' : 'rgba(96,165,250,0.3)' }} />
                                  <div className="absolute inset-y-0 w-0.5 bg-violet-400/80"
                                       style={{ left: `${(item.targetPct / maxPct) * 100}%` }} />
                                  <div className="absolute inset-0 flex items-center justify-center text-[10px] font-medium text-[var(--text-secondary)]">
                                    {isOver ? `${Math.abs(item.drift)}% over` : `${Math.abs(item.drift)}% under`}
                                  </div>
                                </div>
                              </div>
                              {/* Mobile: stacked layout */}
                              <div className="sm:hidden">
                                <div className="flex items-center justify-between gap-2 mb-1">
                                  <div className="text-xs text-[var(--text-primary)] font-medium min-w-0 break-words leading-snug">{item.fundName}</div>
                                  <div className="text-xs tabular-nums text-[var(--text-secondary)] shrink-0">
                                    {item.currentPct}% → {item.targetPct}%
                                  </div>
                                </div>
                                <div className="relative h-4 rounded bg-[var(--bg-inset)] overflow-hidden">
                                  <div className="absolute inset-y-0 left-0 rounded"
                                       style={{ width: `${(item.currentPct / maxPct) * 100}%`, background: isOver ? 'rgba(251,146,60,0.3)' : 'rgba(96,165,250,0.3)' }} />
                                  <div className="absolute inset-y-0 w-0.5 bg-violet-400/80"
                                       style={{ left: `${(item.targetPct / maxPct) * 100}%` }} />
                                  <div className="absolute inset-0 flex items-center justify-center text-[10px] font-medium text-[var(--text-secondary)]">
                                    {isOver ? `${Math.abs(item.drift)}% over` : `${Math.abs(item.drift)}% under`}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ═══ FUND PERFORMANCE (left) ═══ */}
        {(data.topGainers.length > 0 || data.topLosers.length > 0) && (
          <div className={`rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6 ${data.portfolioLeaderboard.length === 0 ? 'md:col-span-2' : ''}`}>
            <SectionHeader label="Fund Performance" color="#8b5cf6" badge={data.topGainers.length + data.topLosers.length} />

            {data.topGainers.length > 0 && (
              <>
                <div className="flex items-center gap-1.5 mb-2 mt-1">
                  <TrendingUp size={12} className="text-emerald-400" />
                  <span className="text-sm font-semibold text-emerald-400 uppercase tracking-wider">Top Gainers</span>
                </div>
                {data.topGainers.map((f, idx) => (
                  <div key={`g-${idx}`} className="flex items-center justify-between py-2"
                       style={{ borderBottom: '1px solid rgba(128,128,128,0.04)' }}>
                    <div className="min-w-0">
                      <div className="text-[13px] text-[var(--text-primary)] font-medium break-words leading-snug">{f.fundName}</div>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        {f.portfolios.map(p => (
                          <span key={p} onClick={() => navigate('/investments/mutual-funds')} className="text-xs px-1.5 py-0.5 rounded bg-[var(--bg-inset)] text-[var(--text-dim)] hover:text-violet-400 hover:bg-violet-500/10 cursor-pointer transition-colors">{p}</span>
                        ))}
                        <span className="text-xs text-[var(--text-dim)] tabular-nums">{formatINR(f.investment)}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <div className="text-[13px] font-semibold text-emerald-400 tabular-nums">+{f.plPct.toFixed(1)}%</div>
                      <div className="text-xs text-emerald-400/70 tabular-nums">+{formatINR(f.pl)}</div>
                    </div>
                  </div>
                ))}
              </>
            )}

            {data.topLosers.length > 0 && (
              <>
                <div className={`flex items-center gap-1.5 mb-2 ${data.topGainers.length > 0 ? 'mt-4 pt-3 border-t border-[var(--border)]' : 'mt-1'}`}>
                  <TrendingDown size={12} className="text-red-400" />
                  <span className="text-sm font-semibold text-red-400 uppercase tracking-wider">Top Losers</span>
                </div>
                {data.topLosers.map((f, idx) => (
                  <div key={`l-${idx}`} className="flex items-center justify-between py-2"
                       style={{ borderBottom: idx < data.topLosers.length - 1 ? '1px solid rgba(128,128,128,0.04)' : 'none' }}>
                    <div className="min-w-0">
                      <div className="text-[13px] text-[var(--text-primary)] font-medium break-words leading-snug">{f.fundName}</div>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        {f.portfolios.map(p => (
                          <span key={p} onClick={() => navigate('/investments/mutual-funds')} className="text-xs px-1.5 py-0.5 rounded bg-[var(--bg-inset)] text-[var(--text-dim)] hover:text-violet-400 hover:bg-violet-500/10 cursor-pointer transition-colors">{p}</span>
                        ))}
                        <span className="text-xs text-[var(--text-dim)] tabular-nums">{formatINR(f.investment)}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <div className="text-[13px] font-semibold text-red-400 tabular-nums">{f.plPct.toFixed(1)}%</div>
                      <div className="text-xs text-red-400/70 tabular-nums">{formatINR(f.pl)}</div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* ═══ PORTFOLIO PERFORMANCE (right) ═══ */}
        {data.portfolioLeaderboard.length > 0 && (() => {
          const topPortfolios = data.portfolioLeaderboard.filter(p => p.plPct > 0).slice(0, 3)
          const bottomPortfolios = data.portfolioLeaderboard.filter(p => p.plPct < 0).sort((a, b) => a.plPct - b.plPct).slice(0, 3)
          if (topPortfolios.length === 0 && bottomPortfolios.length === 0) return null
          return (
            <div className={`rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6 ${data.topGainers.length === 0 && data.topLosers.length === 0 ? 'md:col-span-2' : ''}`}>
              <SectionHeader label="Portfolio Performance" color="#fbbf24" badge={topPortfolios.length + bottomPortfolios.length} />

              {topPortfolios.length > 0 && (
                <>
                  <div className="flex items-center gap-1.5 mb-2 mt-1">
                    <TrendingUp size={12} className="text-emerald-400" />
                    <span className="text-sm font-semibold text-emerald-400 uppercase tracking-wider">Top Performing</span>
                  </div>
                  {topPortfolios.map((p, idx) => {
                    const medal = idx === 0 ? '#fbbf24' : idx === 1 ? '#94a3b8' : idx === 2 ? '#cd7f32' : null
                    return (
                      <div key={p.portfolioId} className="flex items-center justify-between py-2"
                           style={{ borderBottom: '1px solid rgba(128,128,128,0.04)' }}>
                        <div className="flex items-center gap-2.5 min-w-0">
                          {medal ? (
                            <div className="w-[24px] h-[24px] rounded-full flex items-center justify-center shrink-0"
                                 style={{ background: `${medal}18`, border: `1px solid ${medal}30` }}>
                              <Trophy size={12} style={{ color: medal }} />
                            </div>
                          ) : (
                            <div className="w-[24px] h-[24px] rounded-full flex items-center justify-center shrink-0 text-xs font-bold text-[var(--text-dim)]"
                                 style={{ background: 'rgba(128,128,128,0.08)' }}>
                              {idx + 1}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="text-[13px] text-[var(--text-primary)] font-medium truncate">{p.portfolioName}</div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {p.ownerName && <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--bg-inset)] text-[var(--text-dim)]">{p.ownerName}</span>}
                              <span className="text-xs text-[var(--text-dim)] tabular-nums">{formatINR(p.invested)}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0 ml-3">
                          <div className="text-[13px] font-semibold text-emerald-400 tabular-nums">+{p.plPct.toFixed(1)}%</div>
                          <div className="text-xs text-emerald-400/70 tabular-nums">+{formatINR(p.pl)}</div>
                        </div>
                      </div>
                    )
                  })}
                </>
              )}

              {bottomPortfolios.length > 0 && (
                <>
                  <div className={`flex items-center gap-1.5 mb-2 ${topPortfolios.length > 0 ? 'mt-4 pt-3 border-t border-[var(--border)]' : 'mt-1'}`}>
                    <TrendingDown size={12} className="text-red-400" />
                    <span className="text-sm font-semibold text-red-400 uppercase tracking-wider">Underperforming</span>
                  </div>
                  {bottomPortfolios.map((p, idx) => (
                    <div key={p.portfolioId} className="flex items-center justify-between py-2"
                         style={{ borderBottom: idx < bottomPortfolios.length - 1 ? '1px solid rgba(128,128,128,0.04)' : 'none' }}>
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-[24px] h-[24px] rounded-full flex items-center justify-center shrink-0 text-xs font-bold text-red-400/70"
                             style={{ background: 'rgba(239,68,68,0.08)' }}>
                          {idx + 1}
                        </div>
                        <div className="min-w-0">
                          <div className="text-[13px] text-[var(--text-primary)] font-medium truncate">{p.portfolioName}</div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {p.ownerName && <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--bg-inset)] text-[var(--text-dim)]">{p.ownerName}</span>}
                            <span className="text-xs text-[var(--text-dim)] tabular-nums">{formatINR(p.invested)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        <div className="text-[13px] font-semibold text-red-400 tabular-nums">{p.plPct.toFixed(1)}%</div>
                        <div className="text-xs text-red-400/70 tabular-nums">{formatINR(p.pl)}</div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )
        })()}

        {/* ═══ UPCOMING REMINDERS ═══ */}
        {upcomingReminders.length > 0 && (
          <div className={`rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6 cursor-pointer hover:border-[var(--border-light)] transition-colors ${data.activeGoals.length === 0 ? 'md:col-span-2' : ''}`}
               onClick={() => navigate('/reminders')}>
            <SectionHeader label="Upcoming Reminders" color="var(--text-muted)" badge={upcomingReminders.length}
                           linkText="View All" onClick={(e) => { e.stopPropagation(); navigate('/reminders') }} />

            {upcomingReminders.map((r, idx) => {
              let badgeColor, badgeBg, badgeText
              if (r.days === 0) {
                badgeColor = '#fbbf24'; badgeBg = 'rgba(251,191,36,0.1)'; badgeText = 'Today'
              } else if (r.days <= 7) {
                badgeColor = '#60a5fa'; badgeBg = 'transparent'; badgeText = `${r.days} day${r.days !== 1 ? 's' : ''}`
              } else {
                badgeColor = '#94a3b8'; badgeBg = 'transparent'; badgeText = `${r.days} days`
              }

              return (
                <div key={r.reminderId || idx} className="flex items-center justify-between py-2.5"
                     style={{ borderBottom: idx < upcomingReminders.length - 1 ? '1px solid rgba(128,128,128,0.06)' : 'none' }}>
                  <div className="min-w-0">
                    <div className="text-[13px] text-[var(--text-primary)] font-medium truncate">{r.title}</div>
                    <div className="text-xs text-[var(--text-dim)] mt-1.5">
                      {r.familyMemberName}
                      {r.frequency ? ` \u00B7 ${r.frequency}` : ''}
                    </div>
                  </div>
                  {r.days === 0 ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold shrink-0"
                          style={{ background: badgeBg, color: badgeColor }}>
                      {badgeText}
                    </span>
                  ) : (
                    <span className="text-xs font-medium shrink-0 tabular-nums" style={{ color: badgeColor }}>
                      {badgeText}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ═══ GOALS ═══ */}
        {data.activeGoals.length > 0 && (
          <div className={`rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6 cursor-pointer hover:border-[var(--border-light)] transition-colors ${upcomingReminders.length === 0 ? 'md:col-span-2' : ''}`}
               onClick={() => navigate('/goals')}>
            <SectionHeader label="Financial Goals" color="var(--text-muted)"
                           linkText="View All" onClick={(e) => { e.stopPropagation(); navigate('/goals') }} />

            {data.activeGoals.map((g, idx) => {
              const pct = g.targetAmount > 0 ? Math.min((g.currentValue / g.targetAmount) * 100, 100) : 0
              const gh = data.dashGoalHealth[g.goalId]
              const yearsLeft = g.targetDate ? (new Date(g.targetDate) - new Date()) / (365.25 * 24 * 60 * 60 * 1000) : null
              const isPastDue = yearsLeft !== null && yearsLeft <= 0 && pct < 100

              let statusColor, statusText
              if (pct >= 100) {
                statusColor = '#34d399'; statusText = 'Achieved'
              } else if (isPastDue) {
                statusColor = '#f87171'; statusText = 'Overdue'
              } else if (!g.currentValue || g.currentValue === 0) {
                statusColor = '#94a3b8'; statusText = 'Not started'
              } else if (g.status === 'Needs Attention') {
                statusColor = '#fbbf24'; statusText = 'Needs Attention'
              } else if (g.status === 'On Track') {
                statusColor = '#60a5fa'; statusText = 'On Track'
              } else {
                statusColor = '#a78bfa'; statusText = g.status || 'In Progress'
              }

              const labelColor = gh?.label === 'Short-term' ? '#60a5fa'
                : gh?.label === 'Medium-term' ? '#fbbf24'
                : gh?.label === 'Long-term' ? '#34d399' : '#94a3b8'
              const gap = Math.max(0, (g.targetAmount || 0) - (g.currentValue || 0))

              return (
                <div key={g.goalId || idx} className={idx < data.activeGoals.length - 1 ? 'mb-4 pb-4 border-b border-[var(--border-light)]' : ''}>
                  {/* Header: Name + Status */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[13px] font-medium text-[var(--text-secondary)] truncate">{g.goalName}</span>
                      {gh && (
                        <span className="text-xs font-bold px-1.5 py-0.5 rounded-full shrink-0"
                              style={{ background: `${labelColor}15`, color: labelColor }}>
                          {gh.label}
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-semibold px-1.5 py-0.5 rounded shrink-0 ml-2"
                          style={{ background: `${statusColor}15`, color: statusColor }}>
                      {statusText}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="h-[5px] rounded-[3px] overflow-hidden mt-2" style={{ background: 'var(--bg-inset)' }}>
                    <div className="h-full rounded-[3px]" style={{ width: `${pct}%`, background: statusColor }} />
                  </div>

                  {/* Stats: Current/Target + Progress */}
                  <div className="flex items-center justify-between text-xs mt-1.5">
                    <span className="text-[var(--text-muted)] tabular-nums">
                      {formatINR(g.currentValue)} <span className="text-[var(--text-dim)]">/ {formatINR(g.targetAmount)}</span>
                    </span>
                    <span className="text-[var(--text-dim)] tabular-nums">
                      {pct.toFixed(0)}%{gh ? ` · ${gh.yearsLeft.toFixed(1)} yrs` : ''}
                    </span>
                  </div>

                  {/* Allocation health + Suggestion */}
                  {gh && pct < 100 && (
                    <div className="mt-2 space-y-1.5">
                      {/* Recommended vs Actual table */}
                      <div className="bg-[var(--bg-inset)] rounded-md px-2.5 py-1.5">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-[var(--text-dim)]">Recommended</span>
                          <span className="text-[var(--text-muted)] font-semibold tabular-nums">{gh.recommendedEquity}% Equity · {gh.recommendedDebt}% Debt</span>
                        </div>
                        {gh.isMapped && gh.actualEquity !== null ? (
                          <>
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className="text-[var(--text-dim)]">Actual</span>
                              <span className="text-[var(--text-muted)] font-semibold tabular-nums">{gh.actualEquity}% Equity · {100 - gh.actualEquity}% Debt</span>
                            </div>
                            {gh.mismatch !== null && gh.mismatch !== 0 && (
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-[var(--text-dim)]">Difference</span>
                                <span className={`font-bold tabular-nums ${gh.needsAttention ? (gh.mismatch > 0 ? 'text-amber-400' : 'text-blue-400') : 'text-emerald-400'}`}>
                                  {gh.mismatch > 0 ? '+' : ''}{gh.mismatch}% Equity
                                  {gh.needsAttention && gh.mismatch > 0 && ' — shift to debt'}
                                  {gh.needsAttention && gh.mismatch < 0 && ' — room for growth'}
                                  {!gh.needsAttention && ' ✓'}
                                </span>
                              </div>
                            )}
                            {gh.mismatch === 0 && (
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-[var(--text-dim)]">Difference</span>
                                <span className="text-emerald-400 font-bold">Perfectly aligned ✓</span>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="text-xs font-semibold text-amber-400">⚠ No investments linked — at risk</div>
                        )}
                      </div>
                      {/* SIP / Lumpsum suggestion — only when investments are linked */}
                      {gh.isMapped && gh.liveSIP > 0 && gap > 0 && (
                        <div className="flex items-center gap-3 text-xs">
                          <span className="text-violet-400 font-semibold tabular-nums">SIP {formatINR(gh.liveSIP)}/mo</span>
                          <span className="text-[var(--text-dim)]">or</span>
                          <span className="text-violet-400 font-semibold tabular-nums">Lumpsum {formatINR(gh.liveLumpsum)}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}



      </div>
      </div>

      <Modal open={showRebalanceDialog} onClose={() => setShowRebalanceDialog(false)} title="Rebalance Alerts" wide>
        {showRebalanceDialog && <MFRebalanceDialog />}
      </Modal>
    </>
  )
}
