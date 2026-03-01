import { useMemo, useState, useRef, useEffect } from 'react'
import { Sun, Moon, Users, ChevronDown, Check, LogOut, ChevronRight, Bell, TrendingDown, Scale, X, Settings as SettingsIcon, Eye, EyeOff } from 'lucide-react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'

import { useTheme } from '../context/ThemeContext'
import { useFamily } from '../context/FamilyContext'
import { useData } from '../context/DataContext'
import { useAuth } from '../context/AuthContext'
import { formatINR } from '../data/familyData'
import { useMask } from '../context/MaskContext'
import MarketTicker from './MarketTicker'
import useAlerts from '../hooks/useAlerts'
import MFBuyOpportunities from './forms/MFBuyOpportunities'
import MFRebalanceDialog from './forms/MFRebalanceDialog'

const LOGO_ICON = `${import.meta.env.BASE_URL}logo-new.png`

const SECTION_META = {
  mf: { label: 'Mutual Funds', color: 'bg-violet-500', order: 1, route: '/investments/mutual-funds' },
  stocks: { label: 'Stocks', color: 'bg-blue-500', order: 2, route: '/investments/stocks' },
  PPF: { label: 'PPF', color: 'bg-cyan-600', order: 3, route: '/investments/other' },
  EPF: { label: 'EPF', color: 'bg-cyan-500', order: 4, route: '/investments/other' },
  NPS: { label: 'NPS', color: 'bg-sky-500', order: 5, route: '/investments/other' },
  'Fixed Deposit': { label: 'Fixed Deposit', color: 'bg-teal-500', order: 6, route: '/investments/other' },
  FD: { label: 'Fixed Deposit', color: 'bg-teal-500', order: 6, route: '/investments/other' },
  RD: { label: 'RD', color: 'bg-teal-400', order: 7, route: '/investments/other' },
  SSY: { label: 'SSY', color: 'bg-pink-400', order: 8, route: '/investments/other' },
  NSC: { label: 'NSC', color: 'bg-indigo-400', order: 9, route: '/investments/other' },
  Bonds: { label: 'Bonds', color: 'bg-cyan-400', order: 10, route: '/investments/other' },
  Debt: { label: 'Debt', color: 'bg-cyan-500', order: 11, route: '/investments/other' },
  'Physical Gold': { label: 'Physical Gold', color: 'bg-amber-500', order: 12, route: '/investments/other' },
  'Digital Gold': { label: 'Digital Gold', color: 'bg-amber-400', order: 12, route: '/investments/other' },
  'Sovereign Gold Bond': { label: 'SGB', color: 'bg-amber-600', order: 12, route: '/investments/other' },
  Gold: { label: 'Gold', color: 'bg-amber-500', order: 12, route: '/investments/other' },
  'Physical Silver': { label: 'Physical Silver', color: 'bg-slate-400', order: 13, route: '/investments/other' },
  'Digital Silver': { label: 'Digital Silver', color: 'bg-slate-300', order: 13, route: '/investments/other' },
  Silver: { label: 'Silver', color: 'bg-slate-400', order: 13, route: '/investments/other' },
  'Real Estate': { label: 'Real Estate', color: 'bg-orange-500', order: 14, route: '/investments/other' },
  Property: { label: 'Real Estate', color: 'bg-orange-500', order: 14, route: '/investments/other' },
  Crypto: { label: 'Crypto', color: 'bg-violet-400', order: 15, route: '/investments/other' },
  Alternative: { label: 'Alternative', color: 'bg-violet-400', order: 15, route: '/investments/other' },
  Equity: { label: 'Equity', color: 'bg-emerald-500', order: 16, route: '/investments/other' },
  Other: { label: 'Other', color: 'bg-gray-500', order: 17, route: '/investments/other' },
}

export const avatarColors = [
  'from-violet-500 to-indigo-500',
  'from-rose-500 to-pink-500',
  'from-blue-500 to-cyan-500',
  'from-amber-500 to-orange-500',
  'from-emerald-500 to-teal-500',
]

const avatarSolids = [
  'bg-violet-500',
  'bg-rose-500',
  'bg-blue-500',
  'bg-amber-500',
  'bg-emerald-500',
]

const NAV_ITEMS = [
  { label: 'Dashboard', path: '/dashboard', match: '/dashboard' },
  { label: 'Family Members', path: '/family', match: '/family' },
  { label: 'Bank Accounts', path: '/accounts/bank', match: '/accounts/bank' },
  { label: 'Investment Accounts', path: '/accounts/investment', match: '/accounts/investment' },
  { label: 'Insurance', path: '/insurance', match: '/insurance' },
  { label: 'Mutual Funds', path: '/investments/mutual-funds', match: '/investments/mutual-funds' },
  { label: 'Stocks', path: '/investments/stocks', match: '/investments/stocks' },
  { label: 'Other Investments', path: '/investments/other', match: '/investments/other' },
  { label: 'Liabilities', path: '/liabilities', match: '/liabilities' },
  { label: 'Goals', path: '/goals', match: '/goals' },
]

const SECTION_HEX = {
  mf: '#8b5cf6', stocks: '#3b82f6',
  PPF: '#14b8a6', EPF: '#f59e0b', NPS: '#ec4899',
  'Fixed Deposit': '#06b6d4', FD: '#06b6d4', RD: '#2dd4bf',
  SSY: '#f472b6', NSC: '#818cf8', Bonds: '#22d3ee',
  Debt: '#0ea5e9',
  'Physical Gold': '#fbbf24', 'Digital Gold': '#f59e0b', 'Sovereign Gold Bond': '#d97706', Gold: '#fbbf24',
  'Physical Silver': '#94a3b8', 'Digital Silver': '#cbd5e1', Silver: '#94a3b8',
  'Real Estate': '#f97316', Property: '#f97316',
  Crypto: '#a78bfa', Alternative: '#a78bfa',
  Equity: '#10b981', Other: '#6b7280',
}

// Generate a consistent color from any string key (for custom/unknown types)
function hashColor(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash)
  const hue = ((hash % 360) + 360) % 360
  return `hsl(${hue}, 65%, 55%)`
}
function getSectionHex(key) {
  return SECTION_HEX[key] || hashColor(key)
}

// Map section keys (non-MF) to broad asset classes
const ASSET_CLASS_MAP = {
  stocks: 'Equity',
  PPF: 'Debt', EPF: 'Debt', NPS: 'Debt',
  'Fixed Deposit': 'Debt', FD: 'Debt', RD: 'Debt', SSY: 'Debt', NSC: 'Debt', Bonds: 'Debt', Debt: 'Debt',
  'Physical Gold': 'Gold', 'Digital Gold': 'Gold', 'Sovereign Gold Bond': 'Gold', Gold: 'Gold',
  'Physical Silver': 'Gold', 'Digital Silver': 'Gold', Silver: 'Gold',
  'Real Estate': 'Real Estate', Property: 'Real Estate',
  Crypto: 'Alternative', Alternative: 'Alternative', Equity: 'Equity', Other: 'Other',
}
const ASSET_CLASS_HEX = {
  Equity: '#8b5cf6', Debt: '#3b82f6', Gold: '#fbbf24', 'Real Estate': '#f97316', Cash: '#2dd4bf', Alternative: '#a78bfa', Other: '#6b7280',
}

// Infer MF asset category from fund name (same logic as MutualFundsPage)
function inferMFCategory(name) {
  if (!name) return 'Equity'
  const n = name.toLowerCase()
  if (n.includes('gold') || n.includes('silver') || n.includes('commodity')) return 'Gold'
  if (n.includes('liquid') || n.includes('money market') || n.includes('overnight')) return 'Cash'
  if (n.includes('gilt') || n.includes('government securities') || n.includes('constant maturity')) return 'Debt'
  if (n.includes('debt') || n.includes('bond') || n.includes('income fund') || n.includes('corporate bond') ||
      n.includes('banking & psu') || n.includes('short duration') || n.includes('medium duration') ||
      n.includes('long duration') || n.includes('short term') || n.includes('medium term') ||
      n.includes('floater') || n.includes('floating rate') || n.includes('credit') ||
      n.includes('accrual') || n.includes('savings fund') || n.includes('ultra short')) return 'Debt'
  if (n.includes('multi asset')) return 'Multi-Asset'
  if (n.includes('hybrid') || n.includes('balanced') || n.includes('dynamic asset') ||
      n.includes('arbitrage') || n.includes('retirement') || n.includes('aggressive') ||
      n.includes('conservative') || n.includes('children') || n.includes('pension') ||
      n.includes('fund of fund') || n.includes('fof')) return 'Hybrid'
  return 'Equity'
}

const DIALOG_TITLES = { buyopp: 'Buy Opportunities', rebalance: 'Rebalance Alerts' }

export default function Header() {
  const { theme, toggle } = useTheme()
  const { selectedMember, setSelectedMember, familyMembers } = useFamily()
  const { mfPortfolios, mfHoldings, stockPortfolios, stockHoldings, otherInvList, liabilityList, assetAllocations } = useData()
  const { user, signOut } = useAuth()
  const { masked, toggleMask, mv } = useMask()

  const navigate = useNavigate()
  const location = useLocation()
  const { criticalAlerts, upcomingReminders, investmentSignals } = useAlerts()

  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [dialogKey, setDialogKey] = useState(null)
  const [nwModalOpen, setNwModalOpen] = useState(false)
  const dropdownRef = useRef(null)
  const notifRef = useRef(null)

  const notifCount = criticalAlerts.length + upcomingReminders.length
  const { buyOppCount, buyCount, strongBuyCount, rebalanceCount } = investmentSignals

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false)
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false)
    }
    if (dropdownOpen || notifOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [dropdownOpen, notifOpen])

  // Find the selected member object & its avatar index
  const selectedIdx = familyMembers.findIndex((m) => m.memberId === selectedMember)
  const selectedObj = selectedIdx >= 0 ? familyMembers[selectedIdx] : null

  // Compute net worth breakdown
  const nw = useMemo(() => {
    const filterOwner = (items, key) =>
      selectedMember === 'all' ? items : items.filter((i) => i[key] === selectedMember)

    const sectionMap = {}
    const addToSection = (key, label, value, invested) => {
      if (!sectionMap[key]) sectionMap[key] = { items: [], invested: 0 }
      sectionMap[key].items.push({ label, value })
      sectionMap[key].invested += invested
    }

    const activeMF = filterOwner((mfPortfolios || []).filter((p) => p.status === 'Active'), 'ownerId')
    activeMF.forEach((p) => {
      const pH = (mfHoldings || []).filter((h) => h.portfolioId === p.portfolioId && h.units > 0)
      const value = pH.reduce((s, h) => s + h.currentValue, 0)
      const inv = pH.reduce((s, h) => s + h.investment, 0)
      if (value > 0) addToSection('mf', p.portfolioName?.replace(/^PFL-/, '') || p.portfolioName, value, inv)
    })

    const activeStk = filterOwner((stockPortfolios || []).filter((p) => p.status === 'Active'), 'ownerId')
    activeStk.forEach((p) => {
      const pH = (stockHoldings || []).filter((h) => h.portfolioId === p.portfolioId)
      const value = pH.reduce((s, h) => s + h.currentValue, 0)
      const inv = pH.reduce((s, h) => s + h.totalInvestment, 0)
      if (value > 0) addToSection('stocks', p.portfolioName, value, inv)
    })

    const activeOther = filterOwner((otherInvList || []).filter((i) => i.status === 'Active'), 'familyMemberId')
    activeOther.forEach((i) => {
      // Group by investmentType — known types get own section, custom types also get own section (with dynamic color)
      const type = i.investmentType || 'Other'
      addToSection(type, i.investmentName || type, i.currentValue, i.investedAmount || 0)
    })

    const sections = Object.entries(sectionMap)
      .map(([key, { items: sItems, invested }]) => {
        const meta = SECTION_META[key] || { label: key, color: 'bg-gray-500', order: 50, route: '/investments/other' }
        const total = sItems.reduce((s, i) => s + i.value, 0)
        return { key, label: meta.label, color: meta.color, order: meta.order, route: meta.route, total, invested, items: sItems.sort((a, b) => b.value - a.value) }
      })
      .filter((s) => s.total > 0)
      .sort((a, b) => b.total - a.total)

    // Compute asset class allocation (Equity, Debt, Gold, Cash, Real Estate, etc.)
    // For MFs: classify each fund individually using detailed allocation or fund name inference
    const ac = { Equity: 0, Debt: 0, Gold: 0, Cash: 0, 'Real Estate': 0, Alternative: 0, Other: 0 }

    // Build allocation lookup from Morningstar data
    const allocLookup = {}
    if (assetAllocations) {
      for (const a of assetAllocations) {
        allocLookup[a.fundCode] = a.assetAllocation
      }
    }

    // Classify each MF holding individually
    const allMFHoldings = (mfHoldings || []).filter((h) => h.units > 0)
    const filteredMFHoldings = selectedMember === 'all' ? allMFHoldings :
      allMFHoldings.filter((h) => {
        const port = (mfPortfolios || []).find((p) => p.portfolioId === h.portfolioId)
        return port && port.ownerId === selectedMember && port.status === 'Active'
      })

    filteredMFHoldings.forEach((h) => {
      const detailed = allocLookup[h.fundCode || h.schemeCode]
      if (detailed) {
        // Use Morningstar allocation data
        for (const [cls, pct] of Object.entries(detailed)) {
          const val = h.currentValue * (pct / 100)
          if (cls === 'Equity') ac.Equity += val
          else if (cls === 'Debt') ac.Debt += val
          else if (cls === 'Cash') ac.Cash += val
          else if (cls === 'Commodities' || cls === 'Gold') ac.Gold += val
          else if (cls === 'Real Estate') ac['Real Estate'] += val
          else ac.Other += val
        }
      } else {
        // Infer from fund name
        const cat = inferMFCategory(h.fundName)
        if (cat === 'Equity') ac.Equity += h.currentValue
        else if (cat === 'Debt') ac.Debt += h.currentValue
        else if (cat === 'Cash') ac.Cash += h.currentValue
        else if (cat === 'Gold') ac.Gold += h.currentValue
        else if (cat === 'Hybrid') { ac.Equity += h.currentValue * 0.65; ac.Debt += h.currentValue * 0.35 }
        else if (cat === 'Multi-Asset') { ac.Equity += h.currentValue * 0.50; ac.Debt += h.currentValue * 0.30; ac.Gold += h.currentValue * 0.20 }
        else ac.Equity += h.currentValue
      }
    })

    // Add stocks → Equity
    sections.filter((s) => s.key === 'stocks').forEach((s) => { ac.Equity += s.total })

    // Add other investments by their section key
    sections.filter((s) => s.key !== 'mf' && s.key !== 'stocks').forEach((s) => {
      const cls = ASSET_CLASS_MAP[s.key] || 'Other'
      if (cls in ac) ac[cls] += s.total
      else ac.Other += s.total
    })

    const assetAllocation = Object.entries(ac)
      .filter(([, v]) => v > 0)
      .map(([cls, total]) => ({ cls, total, hex: ASSET_CLASS_HEX[cls] || '#6b7280' }))
      .sort((a, b) => b.total - a.total)

    const activeLiab = filterOwner((liabilityList || []).filter((l) => l.status === 'Active'), 'familyMemberId')
    const liabilities = activeLiab.map((l) => ({ label: l.liabilityName || l.liabilityType || 'Loan', value: l.outstandingBalance }))
    const totalLiab = activeLiab.reduce((s, l) => s + l.outstandingBalance, 0)
    const totalInv = sections.reduce((s, sec) => s + sec.total, 0)
    const totalInvested = sections.reduce((s, sec) => s + sec.invested, 0)
    return { netWorth: totalInv - totalLiab, totalInv, totalInvested, sections, totalLiab, liabilities, assetAllocation }
  }, [selectedMember, mfPortfolios, mfHoldings, stockPortfolios, stockHoldings, otherInvList, liabilityList, assetAllocations])

  function closeAll() {
    setDropdownOpen(false)
    setNotifOpen(false)
  }


  return (
    <header className="sticky top-0 z-30 shrink-0">
      {/* ── Top Bar ── */}
      <div className="relative z-10 bg-[var(--bg-header)]/95 backdrop-blur-sm border-b border-[var(--border)]">
        <div className="flex items-center justify-between px-3 sm:px-4 h-14">
          {/* Left: logo (clickable → Dashboard) */}
          <Link to="/dashboard" className="flex items-center gap-2">
            <img src={LOGO_ICON} alt="CF" className="h-9 sm:h-12 w-auto" />
            <span className="hidden sm:flex items-baseline gap-1 text-lg tracking-tight" style={{ fontFamily: "'Poppins', sans-serif" }}>
              <span className="font-bold text-[var(--text-primary)]">Capital</span>
              <span className="font-extrabold text-emerald-400">Friends</span>
            </span>
          </Link>

          {/* Right: icon buttons + avatar */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Buy Opportunities — icon button with count badge */}
            {buyOppCount > 0 && (
              <button
                onClick={() => { setDialogKey(dialogKey === 'buyopp' ? null : 'buyopp'); closeAll() }}
                className={`hidden sm:flex relative p-2 rounded-lg transition-colors ${
                  dialogKey === 'buyopp'
                    ? 'text-emerald-300 bg-emerald-500/20'
                    : 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10'
                }`}
                title={`${buyOppCount} Buy Opportunit${buyOppCount === 1 ? 'y' : 'ies'}${strongBuyCount > 0 ? ` (${strongBuyCount} Strong)` : ''}`}
              >
                <TrendingDown size={18} />
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center text-[9px] font-bold text-white bg-emerald-500 rounded-full px-1">{buyOppCount}</span>
              </button>
            )}

            {/* Rebalance Alerts — icon button with count badge */}
            {rebalanceCount > 0 && (
              <button
                onClick={() => { setDialogKey(dialogKey === 'rebalance' ? null : 'rebalance'); closeAll() }}
                className={`hidden sm:flex relative p-2 rounded-lg transition-colors ${
                  dialogKey === 'rebalance'
                    ? 'text-violet-300 bg-violet-500/20'
                    : 'text-violet-400 hover:text-violet-300 hover:bg-violet-500/10'
                }`}
                title={`${rebalanceCount} fund${rebalanceCount === 1 ? '' : 's'} need rebalancing`}
              >
                <Scale size={18} />
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center text-[9px] font-bold text-white bg-violet-500 rounded-full px-1">{rebalanceCount}</span>
              </button>
            )}

            {/* Mask toggle — desktop only, moved to avatar dropdown on mobile */}
            <button onClick={toggleMask} className={`hidden sm:block p-2 rounded-lg transition-colors ${masked ? 'text-amber-400 bg-amber-500/10' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'}`} title={masked ? 'Data masked — click to reveal' : 'Mask sensitive data'}>
              {masked ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>

            {/* Theme toggle — desktop only, moved to avatar dropdown on mobile */}
            <button onClick={toggle} className="hidden sm:block p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors" title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {/* Notification bell */}
            {notifCount > 0 && (
              <div className="relative" ref={notifRef}>
                <button
                  onClick={() => { setNotifOpen(!notifOpen); setDropdownOpen(false) }}
                  className="relative p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
                >
                  <Bell size={18} />
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center text-[9px] font-bold text-white bg-rose-500 rounded-full px-1">{notifCount}</span>
                </button>

                {notifOpen && (
                  <div className="absolute right-0 top-full mt-2 w-72 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] shadow-xl shadow-black/20 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-50">
                    <div className="px-3 py-2 border-b border-[var(--border-light)]">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Notifications</p>
                    </div>
                    <div className="max-h-[300px] overflow-y-auto py-1">
                      {criticalAlerts.map((a, i) => {
                        const dot = { critical: 'bg-rose-500', warning: 'bg-amber-500', info: 'bg-blue-500' }[a.type]
                        const badgeCls = { critical: 'bg-rose-500/15 text-rose-400', warning: 'bg-amber-500/15 text-amber-400', info: 'bg-blue-500/15 text-blue-400' }[a.type]
                        return (
                          <button
                            key={`c-${i}`}
                            onClick={() => { setNotifOpen(false); navigate(a.navigateTo) }}
                            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--bg-hover)] transition-colors"
                          >
                            <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
                            <span className="text-xs text-[var(--text-secondary)] flex-1 text-left truncate">{a.title}</span>
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${badgeCls}`}>{a.badge}</span>
                          </button>
                        )
                      })}

                      {criticalAlerts.length > 0 && upcomingReminders.length > 0 && (
                        <div className="mx-3 my-1 border-t border-[var(--border-light)]" />
                      )}

                      {upcomingReminders.map((r) => {
                        const badgeCls = r.days <= 7
                          ? 'bg-rose-500/15 text-rose-400'
                          : r.days <= 15
                            ? 'bg-amber-500/15 text-amber-400'
                            : 'bg-slate-500/15 text-[var(--text-muted)]'
                        return (
                          <button
                            key={`r-${r.reminderId}`}
                            onClick={() => { setNotifOpen(false); navigate('/reminders') }}
                            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--bg-hover)] transition-colors text-left"
                          >
                            <span className="w-2 h-2 rounded-full shrink-0 bg-amber-500" />
                            <span className="text-xs text-[var(--text-secondary)] flex-1 truncate">{r.title}</span>
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${badgeCls}`}>
                              {r.days === 0 ? 'Today' : r.days <= 30 ? `${r.days}d` : r.dateStr}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Member avatar + dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => { setDropdownOpen(!dropdownOpen); setNotifOpen(false) }}
                className="flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-full hover:bg-[var(--bg-hover)] transition-colors"
              >
                {selectedObj ? (
                  <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${avatarColors[selectedIdx % avatarColors.length]} flex items-center justify-center text-white text-xs font-bold shadow-sm`}>
                    {selectedObj.memberName.charAt(0)}
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center text-white shadow-sm">
                    <Users size={14} />
                  </div>
                )}
                <ChevronDown size={14} className={`text-[var(--text-muted)] transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] shadow-xl shadow-black/20 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-50">
                  <div className="px-4 py-2.5 border-b border-[var(--border-light)]">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Viewing as</p>
                  </div>

                  <div className="py-1.5">
                    <button
                      onClick={() => { setSelectedMember('all'); setDropdownOpen(false) }}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                        selectedMember === 'all' ? 'bg-violet-500/10' : 'hover:bg-[var(--bg-hover)]'
                      }`}
                    >
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center text-white shadow-sm shrink-0">
                        <Users size={15} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold truncate ${selectedMember === 'all' ? 'text-violet-400' : 'text-[var(--text-primary)]'}`}>Everyone</p>
                        <p className="text-[11px] text-[var(--text-muted)]">All family members</p>
                      </div>
                      {selectedMember === 'all' && <Check size={16} className="text-violet-400 shrink-0" />}
                    </button>

                    {familyMembers.length > 0 && <div className="mx-4 my-1 border-t border-[var(--border-light)]" />}

                    {familyMembers.map((m, i) => {
                      const isSelected = selectedMember === m.memberId
                      return (
                        <button
                          key={m.memberId}
                          onClick={() => { setSelectedMember(m.memberId); setDropdownOpen(false) }}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                            isSelected ? `${avatarSolids[i % avatarSolids.length]}/10` : 'hover:bg-[var(--bg-hover)]'
                          }`}
                        >
                          <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${avatarColors[i % avatarColors.length]} flex items-center justify-center text-white text-sm font-bold shadow-sm shrink-0`}>
                            {m.memberName.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate text-[var(--text-primary)]">{mv(m.memberName, 'name')}</p>
                            <p className="text-[11px] text-[var(--text-muted)]">{m.relationship || 'Family member'}</p>
                          </div>
                          {isSelected && <Check size={16} className="text-emerald-400 shrink-0" />}
                        </button>
                      )
                    })}
                  </div>

                  {/* Quick actions (mobile only — these icons are hidden from header on mobile) */}
                  <div className="sm:hidden border-t border-[var(--border-light)] py-1.5">
                    <button
                      onClick={() => { toggleMask(); setDropdownOpen(false) }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
                    >
                      {masked ? <EyeOff size={16} /> : <Eye size={16} />}
                      <span className="text-sm font-medium">{masked ? 'Unmask Data' : 'Mask Data'}</span>
                    </button>
                    <button
                      onClick={() => { toggle(); setDropdownOpen(false) }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
                    >
                      {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                      <span className="text-sm font-medium">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
                    </button>
                  </div>

                  {/* Settings + Sign out */}
                  <div className="border-t border-[var(--border-light)] py-1.5">
                    <Link
                      to="/settings"
                      onClick={() => setDropdownOpen(false)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
                    >
                      <SettingsIcon size={16} />
                      <span className="text-sm font-medium">Settings</span>
                    </Link>
                    {user && (
                      <div className="px-4 py-1.5">
                        <p className="text-[11px] text-[var(--text-muted)] truncate">{mv(user.email, 'email')}</p>
                      </div>
                    )}
                    <button
                      onClick={() => { signOut(); setDropdownOpen(false) }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-rose-400 hover:bg-rose-500/10 transition-colors"
                    >
                      <LogOut size={16} />
                      <span className="text-sm font-medium">Sign out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Market Ticker ── */}
      <MarketTicker />

      {/* ── Navigation Strip (desktop only — mobile uses sidebar + bottom nav) ── */}
      <nav className="hidden lg:block bg-[var(--bg-header)]/90 backdrop-blur-sm border-b border-[var(--border)]">
        <div className="flex items-center px-3 sm:px-4 py-1.5">
          {/* Nav links — scrollable */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar flex-1 min-w-0">
            {NAV_ITEMS.map((item) => {
              const isActive = location.pathname.startsWith(item.match)
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors ${
                    isActive
                      ? 'bg-violet-500/15 text-violet-400'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                  }`}
                >
                  {item.label}
                </Link>
              )
            })}
          </div>

          {/* Net Worth — opens modal */}
          <button
            onClick={() => { setNwModalOpen(true); closeAll() }}
            className={`shrink-0 ml-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${
              nw.netWorth >= 0
                ? 'bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/15'
                : 'bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/15'
            }`}
          >
            <span className={`text-[10px] font-bold uppercase tracking-wider ${nw.netWorth >= 0 ? 'text-emerald-400/70' : 'text-rose-400/70'}`}>Net Worth</span>
            <span className={`text-sm font-extrabold tabular-nums ${nw.netWorth >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{formatINR(nw.netWorth)}</span>
            <ChevronRight size={12} className={nw.netWorth >= 0 ? 'text-emerald-400/60' : 'text-rose-400/60'} />
          </button>
        </div>
      </nav>

      {/* ── Mobile Net Worth + Alert pills (since nav strip is hidden) ── */}
      <div className="lg:hidden bg-[var(--bg-header)]/90 backdrop-blur-sm border-b border-[var(--border)] px-3 py-1.5 flex items-center gap-2 justify-end">
        {buyOppCount > 0 && (
          <button
            onClick={() => { setDialogKey(dialogKey === 'buyopp' ? null : 'buyopp'); closeAll() }}
            className="relative p-1.5 rounded-lg text-emerald-400 hover:bg-emerald-500/10 transition-colors"
          >
            <TrendingDown size={16} />
            <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-3.5 flex items-center justify-center text-[8px] font-bold text-white bg-emerald-500 rounded-full px-0.5">{buyOppCount}</span>
          </button>
        )}
        {rebalanceCount > 0 && (
          <button
            onClick={() => { setDialogKey(dialogKey === 'rebalance' ? null : 'rebalance'); closeAll() }}
            className="relative p-1.5 rounded-lg text-violet-400 hover:bg-violet-500/10 transition-colors"
          >
            <Scale size={16} />
            <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-3.5 flex items-center justify-center text-[8px] font-bold text-white bg-violet-500 rounded-full px-0.5">{rebalanceCount}</span>
          </button>
        )}
        <button
          onClick={() => { setNwModalOpen(true); closeAll() }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${
            nw.netWorth >= 0
              ? 'bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/15'
              : 'bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/15'
          }`}
        >
          <span className={`text-[10px] font-bold uppercase tracking-wider ${nw.netWorth >= 0 ? 'text-emerald-400/70' : 'text-rose-400/70'}`}>Net Worth</span>
          <span className={`text-sm font-extrabold tabular-nums ${nw.netWorth >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{formatINR(nw.netWorth)}</span>
          <ChevronRight size={12} className={nw.netWorth >= 0 ? 'text-emerald-400/60' : 'text-rose-400/60'} />
        </button>
      </div>

      {/* ── Net Worth Breakdown Modal ── */}
      {nwModalOpen && (() => {
        const donutData = nw.sections.map(sec => ({
          name: sec.label, value: sec.total, fill: getSectionHex(sec.key),
          pct: nw.totalInv > 0 ? (sec.total / nw.totalInv) * 100 : 0,
          color: sec.color, route: sec.route,
        }))

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-3" onClick={() => setNwModalOpen(false)}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <div
              className="relative w-full md:w-auto md:min-w-[720px] md:max-w-4xl max-h-[85vh] overflow-y-auto bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] shadow-2xl shadow-black/40"
              onClick={e => e.stopPropagation()}
            >
              {/* Close */}
              <button onClick={() => setNwModalOpen(false)} className="absolute top-4 right-4 z-20 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors">
                <X size={18} className="text-[var(--text-secondary)]" />
              </button>

              {/* TOP — Asset Allocation (full width) */}
              {nw.assetAllocation.length > 0 && (
                <div className="px-6 pt-6 pb-3 border-b border-[var(--border-light)]">
                  <p className="text-[10px] text-[var(--text-dim)] uppercase tracking-wider text-center mb-2">Asset Allocation</p>
                  {/* Stacked bar */}
                  <div className="flex h-3 rounded-full overflow-hidden">
                    {nw.assetAllocation.map((a) => (
                      <div key={a.cls} style={{ width: `${(a.total / nw.totalInv) * 100}%`, backgroundColor: a.hex }} title={`${a.cls}: ${((a.total / nw.totalInv) * 100).toFixed(1)}%`} />
                    ))}
                  </div>
                  {/* Legend */}
                  <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-2">
                    {nw.assetAllocation.map((a) => (
                      <div key={a.cls} className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: a.hex }} />
                        <span className="text-[10px] text-[var(--text-muted)] tabular-nums">{a.cls} {((a.total / nw.totalInv) * 100).toFixed(0)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* MIDDLE — Donut + Investment breakdown */}
              <div className="flex flex-col md:flex-row">
                {/* LEFT — Donut + Summary */}
                <div className="flex-shrink-0 md:w-[340px] pt-6 pb-4 md:pb-6 px-6 flex flex-col items-center justify-center md:border-r md:border-[var(--border-light)]">
                  <div className="relative w-[200px] h-[200px] md:w-[260px] md:h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={donutData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius="55%" outerRadius="85%" paddingAngle={3} stroke="none" isAnimationActive={false} activeShape={null}>
                          {donutData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                        </Pie>
                        <Tooltip content={({ active, payload }) => {
                          if (!active || !payload?.[0]) return null
                          const d = payload[0].payload
                          return (
                            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 shadow-lg text-xs">
                              <span className="font-semibold text-[var(--text-primary)]">{d.name}</span>
                              <span className="text-[var(--text-muted)] ml-1.5">{formatINR(d.value)} ({d.pct.toFixed(1)}%)</span>
                            </div>
                          )
                        }} />
                      </PieChart>
                    </ResponsiveContainer>
                    {/* Center label */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <p className="text-[10px] text-[var(--text-dim)] uppercase tracking-wider">Net Worth</p>
                      <p className={`text-lg md:text-xl font-bold tabular-nums ${nw.netWorth >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{formatINR(nw.netWorth)}</p>
                    </div>
                  </div>

                  {/* Summary cards below donut */}
                  <div className="w-full max-w-[280px] mt-4 grid grid-cols-2 gap-2">
                    <div className="rounded-lg px-3 py-2.5 text-center" style={{ backgroundColor: 'rgba(139,92,246,0.08)' }}>
                      <p className="text-[10px] text-[var(--text-dim)] uppercase tracking-wider">Investments</p>
                      <p className="text-sm font-bold text-[var(--text-primary)] tabular-nums mt-0.5">{formatINR(nw.totalInv)}</p>
                      {nw.totalInvested > 0 && (
                        <p className="text-[10px] tabular-nums mt-0.5" style={{ color: nw.totalInv >= nw.totalInvested ? '#34d399' : '#f87171' }}>
                          {nw.totalInv >= nw.totalInvested ? '+' : ''}{formatINR(nw.totalInv - nw.totalInvested)} P&L
                        </p>
                      )}
                    </div>
                    {nw.totalLiab > 0 ? (
                      <div className="rounded-lg px-3 py-2.5 text-center" style={{ backgroundColor: 'rgba(244,63,94,0.08)' }}>
                        <p className="text-[10px] text-[var(--text-dim)] uppercase tracking-wider">Liabilities</p>
                        <p className="text-sm font-bold text-rose-400 tabular-nums mt-0.5">{formatINR(nw.totalLiab)}</p>
                        <p className="text-[10px] text-[var(--text-dim)] tabular-nums mt-0.5">
                          {nw.liabilities.length} {nw.liabilities.length === 1 ? 'loan' : 'loans'}
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-lg px-3 py-2.5 text-center" style={{ backgroundColor: 'rgba(52,211,153,0.08)' }}>
                        <p className="text-[10px] text-[var(--text-dim)] uppercase tracking-wider">Invested</p>
                        <p className="text-sm font-bold text-[var(--text-primary)] tabular-nums mt-0.5">{formatINR(nw.totalInvested)}</p>
                        {nw.totalInvested > 0 && (
                          <p className="text-[10px] tabular-nums mt-0.5" style={{ color: nw.totalInv >= nw.totalInvested ? '#34d399' : '#f87171' }}>
                            {((nw.totalInv - nw.totalInvested) / nw.totalInvested * 100).toFixed(1)}% returns
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* RIGHT — Investment breakdown */}
                <div className="flex-1 min-w-0 px-3 md:px-5 pt-4 md:pt-6 pb-5 flex flex-col justify-center">
                  {/* Investment rows — color-tinted chips */}
                  <div className="space-y-2">
                    {nw.sections.map(sec => {
                      const pct = nw.totalInv > 0 ? (sec.total / nw.totalInv) * 100 : 0
                      const hex = getSectionHex(sec.key)
                      return (
                        <Link
                          key={sec.key}
                          to={sec.route}
                          onClick={() => setNwModalOpen(false)}
                          className="flex items-center gap-2.5 py-2.5 px-3 rounded-xl transition-colors group"
                          style={{ backgroundColor: `${hex}12` }}
                        >
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: hex }} />
                          <span className="text-[13px] font-medium text-[var(--text-primary)] flex-1 min-w-0 truncate">{sec.label}</span>
                          <span className="text-[13px] font-bold text-[var(--text-primary)] tabular-nums shrink-0 w-[80px] text-right">{formatINR(sec.total)}</span>
                          <span className="text-[10px] font-medium tabular-nums shrink-0 w-[40px] text-center py-0.5 rounded-full" style={{ backgroundColor: `${hex}20`, color: hex }}>{pct.toFixed(0)}%</span>
                        </Link>
                      )
                    })}

                    {/* Liabilities */}
                    {nw.totalLiab > 0 && (
                      <Link
                        to="/liabilities"
                        onClick={() => setNwModalOpen(false)}
                        className="flex items-center gap-2.5 py-2.5 px-3 rounded-xl transition-colors group bg-rose-500/[0.07]"
                      >
                        <span className="w-2 h-2 rounded-full shrink-0 bg-rose-500" />
                        <span className="text-[13px] font-medium text-[var(--text-primary)] flex-1 min-w-0">
                          {nw.liabilities.length} {nw.liabilities.length === 1 ? 'Loan' : 'Loans'}
                        </span>
                        <span className="text-[13px] font-bold text-rose-400 tabular-nums shrink-0">&minus;{formatINR(nw.totalLiab)}</span>
                      </Link>
                    )}
                  </div>

                  {/* Net Worth total */}
                  <div className="mt-4 pt-3 mx-1 border-t border-[var(--border-light)] flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-wider text-[var(--text-dim)]">Net Worth</span>
                    <span className={`text-base font-bold tabular-nums ${nw.netWorth >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{formatINR(nw.netWorth)}</span>
                  </div>
                </div>
              </div>

              {/* BOTTOM — Disclaimer */}
              {nw.assetAllocation.length > 0 && (
                <div className="px-6 py-2.5 border-t border-[var(--border-light)] bg-[var(--bg-inset)]">
                  <p className="text-[10px] text-[var(--text-dim)] text-center">Approximate. MF splits are estimated from fund names. Add Morningstar data in Fund Breakdown for accuracy.</p>
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {/* ── Dialog Overlay (Buy Opps / Rebalance) ── */}
      {dialogKey && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-3">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDialogKey(null)} />
          <div className="relative w-full max-w-3xl max-h-[75vh] rounded-xl bg-[var(--bg-card)] border border-[var(--border)] shadow-2xl shadow-black/40 overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-4 duration-200">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-light)] shrink-0">
              <h2 className="text-sm font-bold text-[var(--text-primary)]">{DIALOG_TITLES[dialogKey]}</h2>
              <button onClick={() => setDialogKey(null)} className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-dim)] transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="overflow-y-auto p-4">
              {dialogKey === 'buyopp' && <MFBuyOpportunities />}
              {dialogKey === 'rebalance' && <MFRebalanceDialog />}
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
