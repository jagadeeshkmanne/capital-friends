import { useMemo, useState, useRef, useEffect } from 'react'
import { Menu, Sun, Moon, Users, ChevronDown, Check, LogOut, ChevronLeft, ChevronRight, Bell, TrendingDown, RefreshCw, X, Settings as SettingsIcon, Eye, EyeOff } from 'lucide-react'
import { Link, useNavigate, useLocation } from 'react-router-dom'

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

const LOGO = 'https://raw.githubusercontent.com/jagadeeshkmanne/capital-friends/main/logo.png'

const SECTION_META = {
  mf: { label: 'Mutual Funds', color: 'bg-violet-500', order: 1, route: '/investments/mutual-funds' },
  stocks: { label: 'Stocks', color: 'bg-blue-500', order: 2, route: '/investments/stocks' },
  Debt: { label: 'Debt', color: 'bg-cyan-500', order: 3, route: '/investments/other' },
  Gold: { label: 'Gold', color: 'bg-amber-500', order: 4, route: '/investments/other' },
  Silver: { label: 'Silver', color: 'bg-slate-400', order: 5, route: '/investments/other' },
  Property: { label: 'Real Estate', color: 'bg-orange-500', order: 6, route: '/investments/other' },
  Alternative: { label: 'Alternative', color: 'bg-violet-400', order: 7, route: '/investments/other' },
  Equity: { label: 'Equity', color: 'bg-emerald-500', order: 8, route: '/investments/other' },
  Other: { label: 'Other', color: 'bg-gray-500', order: 9, route: '/investments/other' },
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
  { label: 'Family Members', path: '/family', match: '/family' },
  { label: 'Bank Accounts', path: '/accounts/bank', match: '/accounts/bank' },
  { label: 'Investment Accounts', path: '/accounts/investment', match: '/accounts/investment' },
  { label: 'Insurance', path: '/insurance', match: '/insurance' },
  { label: 'Mutual Funds', path: '/investments/mutual-funds', match: '/investments/mutual-funds' },
  { label: 'Stocks', path: '/investments/stocks', match: '/investments/stocks' },
  { label: 'Other Investments', path: '/investments/other', match: '/investments/other' },
  { label: 'Goals', path: '/goals', match: '/goals' },
]

const DIALOG_TITLES = { buyopp: 'Buying Opportunities', rebalance: 'Rebalance Alerts' }

export default function Header({ onMenuClick }) {
  const { theme, toggle } = useTheme()
  const { selectedMember, setSelectedMember, familyMembers } = useFamily()
  const { mfPortfolios, mfHoldings, stockPortfolios, stockHoldings, otherInvList, liabilityList, refreshData, isRefreshing } = useData()
  const { user, signOut } = useAuth()
  const { masked, toggleMask, mv } = useMask()

  const navigate = useNavigate()
  const location = useLocation()
  const { criticalAlerts, upcomingReminders, investmentSignals } = useAlerts()

  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [dialogKey, setDialogKey] = useState(null)
  const [nwExpanded, setNwExpanded] = useState(false)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)
  const dropdownRef = useRef(null)
  const notifRef = useRef(null)
  const cardsRef = useRef(null)

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
      const cat = i.investmentCategory || 'Other'
      addToSection(cat, i.investmentName || i.investmentType || 'Other', i.currentValue, i.investedAmount || 0)
    })

    const sections = Object.entries(sectionMap)
      .map(([key, { items: sItems, invested }]) => {
        const meta = SECTION_META[key] || SECTION_META.Other
        const total = sItems.reduce((s, i) => s + i.value, 0)
        return { key, label: meta.label, color: meta.color, order: meta.order, route: meta.route, total, invested, items: sItems.sort((a, b) => b.value - a.value) }
      })
      .filter((s) => s.total > 0)
      .sort((a, b) => a.order - b.order)

    const activeLiab = filterOwner((liabilityList || []).filter((l) => l.status === 'Active'), 'familyMemberId')
    const liabilities = activeLiab.map((l) => ({ label: l.liabilityName || l.liabilityType || 'Loan', value: l.outstandingBalance }))
    const totalLiab = activeLiab.reduce((s, l) => s + l.outstandingBalance, 0)
    const totalInv = sections.reduce((s, sec) => s + sec.total, 0)
    const totalInvested = sections.reduce((s, sec) => s + sec.invested, 0)
    return { netWorth: totalInv - totalLiab, totalInv, totalInvested, sections, totalLiab, liabilities }
  }, [selectedMember, mfPortfolios, mfHoldings, stockPortfolios, stockHoldings, otherInvList, liabilityList])

  function closeAll() {
    setDropdownOpen(false)
    setNotifOpen(false)
  }

  // Carousel scroll for NW cards
  function handleCardsScroll() {
    if (!cardsRef.current) return
    const { scrollLeft, scrollWidth, clientWidth } = cardsRef.current
    setCanScrollLeft(scrollLeft > 5)
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 5)
  }

  function scrollCards(dir) {
    if (!cardsRef.current) return
    const card = cardsRef.current.querySelector('a')
    const cardWidth = (card?.offsetWidth || 240) + 12 // card width + gap
    cardsRef.current.scrollBy({ left: dir * cardWidth, behavior: 'smooth' })
  }

  // Check scroll arrows when data changes or carousel is expanded
  useEffect(() => { handleCardsScroll() }, [nw, nwExpanded])

  return (
    <header className="sticky top-0 z-30 shrink-0">
      {/* Glow animation styles */}
      <style>{`
        @keyframes glow-emerald {
          0%, 100% { box-shadow: 0 0 6px rgba(16,185,129,0.3), 0 0 12px rgba(16,185,129,0.15); }
          50% { box-shadow: 0 0 12px rgba(16,185,129,0.5), 0 0 24px rgba(16,185,129,0.25); }
        }
        @keyframes glow-violet {
          0%, 100% { box-shadow: 0 0 6px rgba(139,92,246,0.3), 0 0 12px rgba(139,92,246,0.15); }
          50% { box-shadow: 0 0 12px rgba(139,92,246,0.5), 0 0 24px rgba(139,92,246,0.25); }
        }
        .glow-emerald { animation: glow-emerald 2s ease-in-out infinite; }
        .glow-violet { animation: glow-violet 2s ease-in-out infinite; }
      `}</style>

      {/* ── Top Bar ── */}
      <div className="relative z-10 bg-[var(--bg-header)]/95 backdrop-blur-sm border-b border-[var(--border)]">
        <div className="flex items-center justify-between px-3 sm:px-4 h-14">
          {/* Left: hamburger (mobile) + logo */}
          <div className="flex items-center gap-2">
            <button onClick={onMenuClick} className="lg:hidden p-2 -ml-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors">
              <Menu size={20} />
            </button>
            <img src={LOGO} alt="Capital Friends" className="h-10" />
          </div>

          {/* Right: action pills + NW + theme + bell + avatar */}
          <div className="flex items-center gap-2">
            {/* Buying Opportunities pill — glowing */}
            {buyOppCount > 0 && (
              <button
                onClick={() => { setDialogKey(dialogKey === 'buyopp' ? null : 'buyopp'); closeAll() }}
                className={`glow-emerald flex items-center gap-1.5 text-xs font-bold whitespace-nowrap px-3 py-1.5 rounded-full transition-all ${
                  dialogKey === 'buyopp'
                    ? 'bg-emerald-500/30 text-emerald-300 ring-1 ring-emerald-400/50'
                    : 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'
                }`}
              >
                <TrendingDown size={13} strokeWidth={2.5} />
                <span className="hidden sm:inline">{strongBuyCount > 0 ? 'Buy Opportunities' : 'Buying Opportunities'}</span>
                {strongBuyCount > 0 && <span className="text-[11px] bg-emerald-500/30 px-1.5 py-0.5 rounded-full">{strongBuyCount} Strong</span>}
                {buyCount > 0 && <span className="text-[11px] bg-emerald-500/20 px-1.5 py-0.5 rounded-full">{buyCount} Buy</span>}
              </button>
            )}

            {/* Rebalance Alerts pill — glowing */}
            {rebalanceCount > 0 && (
              <button
                onClick={() => { setDialogKey(dialogKey === 'rebalance' ? null : 'rebalance'); closeAll() }}
                className={`glow-violet flex items-center gap-1.5 text-xs font-bold whitespace-nowrap px-3 py-1.5 rounded-full transition-all ${
                  dialogKey === 'rebalance'
                    ? 'bg-violet-500/30 text-violet-300 ring-1 ring-violet-400/50'
                    : 'bg-violet-500/15 text-violet-400 hover:bg-violet-500/25'
                }`}
              >
                <RefreshCw size={13} strokeWidth={2.5} />
                <span className="hidden sm:inline">Rebalance Alerts</span>
                <span className="text-[11px] bg-violet-500/30 px-1.5 py-0.5 rounded-full">{rebalanceCount}</span>
              </button>
            )}

            {/* Sync / Refresh data */}
            <button
              onClick={() => refreshData(true)}
              disabled={isRefreshing}
              className={`p-2 rounded-lg transition-colors ${isRefreshing ? 'text-blue-400 cursor-not-allowed' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'}`}
              title="Sync data from Google Sheets"
            >
              <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
            </button>

            {/* Mask toggle */}
            <button onClick={toggleMask} className={`p-2 rounded-lg transition-colors ${masked ? 'text-amber-400 bg-amber-500/10' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'}`} title={masked ? 'Data masked — click to reveal' : 'Mask sensitive data'}>
              {masked ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>

            {/* Theme toggle */}
            <button onClick={toggle} className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors" title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
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

      {/* ── Navigation Strip ── */}
      <nav className="bg-[var(--bg-header)]/90 backdrop-blur-sm border-b border-[var(--border)]">
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

          {/* Net Worth — clickable toggle for breakdown */}
          <button
            onClick={() => setNwExpanded(!nwExpanded)}
            className="shrink-0 ml-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/15 transition-colors"
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400/70">Net Worth</span>
            <span className="text-sm font-extrabold text-emerald-400 tabular-nums">{formatINR(nw.netWorth)}</span>
            <ChevronDown size={12} className={`text-emerald-400/60 transition-transform duration-200 ${nwExpanded ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </nav>

      {/* ── Net Worth Breakdown — Carousel (collapsible) ── */}
      {nwExpanded && (
        <div className="bg-[var(--bg-card)]/90 backdrop-blur-sm border-b border-[var(--border-light)] animate-in slide-in-from-top-2 fade-in duration-200">
          <div className="relative max-w-7xl mx-auto">
            {/* Left arrow */}
            {canScrollLeft && (
              <button
                onClick={() => scrollCards(-1)}
                className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 z-10 w-7 h-7 flex items-center justify-center rounded-full bg-[var(--bg-card)] border border-[var(--border)] shadow-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              >
                <ChevronLeft size={14} />
              </button>
            )}

            {/* Cards container — responsive: 2 mobile, 3 tablet, 4 desktop */}
            <div
              ref={cardsRef}
              onScroll={handleCardsScroll}
              className="flex gap-3 px-12 sm:px-14 py-3 overflow-x-auto scroll-smooth snap-x snap-mandatory no-scrollbar"
            >
              {nw.sections?.map((sec) => (
                <Link
                  key={sec.key}
                  to={sec.route}
                  className="group snap-start shrink-0 w-[calc(50%-6px)] sm:w-[calc(33.333%-8px)] lg:w-[calc(25%-9px)] rounded-lg p-3 bg-[var(--bg-inset)] hover:bg-[var(--bg-hover)] border border-[var(--border-light)] transition-colors"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                      <span className={`w-1.5 h-1.5 rounded-full ${sec.color}`} />{sec.label}
                    </span>
                    <ChevronRight size={10} className="text-[var(--text-dim)] opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <p className="text-base font-bold text-[var(--text-primary)] tabular-nums mb-1">{formatINR(sec.total)}</p>
                  {sec.items.length > 0 && (
                    <div className="space-y-0.5">
                      {sec.items.map((item) => (
                        <div key={item.label} className="flex items-center justify-between">
                          <span className="text-[11px] text-[var(--text-dim)] truncate mr-2">{item.label}</span>
                          <span className="text-[11px] text-[var(--text-muted)] tabular-nums shrink-0">{formatINR(item.value)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </Link>
              ))}

              {/* Liabilities card */}
              {nw.totalLiab > 0 && (
                <Link
                  to="/liabilities"
                  className="group snap-start shrink-0 w-[calc(50%-6px)] sm:w-[calc(33.333%-8px)] lg:w-[calc(25%-9px)] rounded-lg p-3 bg-[var(--bg-inset)] hover:bg-[var(--bg-hover)] border border-[var(--border-light)] transition-colors"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />Liabilities
                    </span>
                    <ChevronRight size={10} className="text-[var(--text-dim)] opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <p className="text-base font-bold text-[var(--accent-rose)] tabular-nums mb-1">&minus;{formatINR(nw.totalLiab)}</p>
                  {nw.liabilities?.length > 0 && (
                    <div className="space-y-0.5">
                      {nw.liabilities.map((item) => (
                        <div key={item.label} className="flex items-center justify-between">
                          <span className="text-[11px] text-[var(--text-dim)] truncate mr-2">{item.label}</span>
                          <span className="text-[11px] text-[var(--accent-rose)]/70 tabular-nums shrink-0">{formatINR(item.value)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </Link>
              )}
            </div>

            {/* Right arrow */}
            {canScrollRight && (
              <button
                onClick={() => scrollCards(1)}
                className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 z-10 w-7 h-7 flex items-center justify-center rounded-full bg-[var(--bg-card)] border border-[var(--border)] shadow-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              >
                <ChevronRight size={14} />
              </button>
            )}
          </div>
        </div>
      )}

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
