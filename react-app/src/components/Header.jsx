import { useMemo, useState, useRef, useEffect } from 'react'
import { Menu, Sun, Moon, Users, ChevronDown, Check, LogOut, ChevronRight, Bell } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

import { useTheme } from '../context/ThemeContext'
import { useFamily } from '../context/FamilyContext'
import { useData } from '../context/DataContext'
import { useAuth } from '../context/AuthContext'
import { formatINR } from '../data/familyData'
import MarketTicker from './MarketTicker'
import ActionStrip from './ActionStrip'
import useAlerts from '../hooks/useAlerts'

const LOGO = 'https://raw.githubusercontent.com/jagadeeshkmanne/capital-friends/main/logo.png'

// ── Toggle this to false when real data is available ──
const USE_DUMMY = true
// Section metadata: order, label, color, route
const SECTION_META = {
  mf: { label: 'Mutual Funds', color: 'bg-violet-500', order: 1, route: '/investments/mutual-funds' },
  stocks: { label: 'Stocks', color: 'bg-blue-500', order: 2, route: '/investments/stocks' },
  Debt: { label: 'Debt', color: 'bg-cyan-500', order: 3, route: '/accounts/other-investments' },
  Gold: { label: 'Gold', color: 'bg-amber-500', order: 4, route: '/accounts/other-investments' },
  Silver: { label: 'Silver', color: 'bg-slate-400', order: 5, route: '/accounts/other-investments' },
  Property: { label: 'Real Estate', color: 'bg-orange-500', order: 6, route: '/accounts/other-investments' },
  Alternative: { label: 'Alternative', color: 'bg-violet-400', order: 7, route: '/accounts/other-investments' },
  Equity: { label: 'Equity', color: 'bg-emerald-500', order: 8, route: '/accounts/other-investments' },
  Other: { label: 'Other', color: 'bg-gray-500', order: 9, route: '/accounts/other-investments' },
}

const DUMMY_NW = {
  netWorth: 7585000, totalInv: 8585000,
  totalLiab: 1000000,
  sections: [
    { key: 'mf', label: 'Mutual Funds', color: 'bg-violet-500', route: '/investments/mutual-funds', total: 2850000, items: [
      { label: 'Jags Growth Portfolio', value: 1500000 },
      { label: 'Priya Conservative MF', value: 1350000 },
    ]},
    { key: 'stocks', label: 'Stocks', color: 'bg-blue-500', route: '/investments/stocks', total: 1250000, items: [
      { label: 'Zerodha Stocks', value: 1250000 },
    ]},
    { key: 'Property', label: 'Real Estate', color: 'bg-orange-500', route: '/accounts/other-investments', total: 2500000, items: [
      { label: '2BHK Flat - Hyderabad', value: 2500000 },
    ]},
    { key: 'Debt', label: 'Debt', color: 'bg-cyan-500', route: '/accounts/other-investments', total: 950000, items: [
      { label: 'HDFC PPF', value: 350000 },
      { label: 'SBI FD - 7.5%', value: 200000 },
      { label: 'EPF', value: 400000 },
    ]},
    { key: 'Gold', label: 'Gold', color: 'bg-amber-500', route: '/accounts/other-investments', total: 285000, items: [
      { label: 'SBI Gold Bond 2029', value: 120000 },
      { label: 'Digital Gold', value: 65000 },
      { label: 'Physical Gold', value: 100000 },
    ]},
    { key: 'Equity', label: 'Equity', color: 'bg-emerald-500', route: '/accounts/other-investments', total: 500000, items: [
      { label: 'NPS - Tier 1', value: 500000 },
    ]},
    { key: 'Alternative', label: 'Alternative', color: 'bg-violet-400', route: '/accounts/other-investments', total: 250000, items: [
      { label: 'Smallcase - Momentum', value: 250000 },
    ]},
  ],
  liabilities: [
    { label: 'HDFC Home Loan', value: 750000 },
    { label: 'Car Loan - SBI', value: 250000 },
  ],
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

export default function Header({ onMenuClick }) {
  const { theme, toggle } = useTheme()
  const { selectedMember, setSelectedMember, familyMembers } = useFamily()
  const { mfPortfolios, mfHoldings, stockPortfolios, stockHoldings, otherInvList, liabilityList } = useData()
  const { user, signOut } = useAuth()

  const navigate = useNavigate()
  const { criticalAlerts, upcomingReminders } = useAlerts()

  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const dropdownRef = useRef(null)
  const notifRef = useRef(null)

  const notifCount = criticalAlerts.length + upcomingReminders.length

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
    if (USE_DUMMY) return DUMMY_NW

    const filterOwner = (items, key) =>
      selectedMember === 'all' ? items : items.filter((i) => i[key] === selectedMember)

    // Build sectioned breakdown
    const sectionMap = {} // key → { items: [], invested: 0 }
    const addToSection = (key, label, value, invested) => {
      if (!sectionMap[key]) sectionMap[key] = { items: [], invested: 0 }
      sectionMap[key].items.push({ label, value })
      sectionMap[key].invested += invested
    }

    // MF portfolios
    const activeMF = filterOwner(mfPortfolios.filter((p) => p.status === 'Active'), 'ownerId')
    activeMF.forEach((p) => {
      const pH = mfHoldings.filter((h) => h.portfolioId === p.portfolioId && h.units > 0)
      const value = pH.reduce((s, h) => s + h.currentValue, 0)
      const inv = pH.reduce((s, h) => s + h.investment, 0)
      if (value > 0) addToSection('mf', p.portfolioName, value, inv)
    })

    // Stock portfolios
    const activeStk = filterOwner(stockPortfolios.filter((p) => p.status === 'Active'), 'ownerId')
    activeStk.forEach((p) => {
      const pH = stockHoldings.filter((h) => h.portfolioId === p.portfolioId)
      const value = pH.reduce((s, h) => s + h.currentValue, 0)
      const inv = pH.reduce((s, h) => s + h.totalInvestment, 0)
      if (value > 0) addToSection('stocks', p.portfolioName, value, inv)
    })

    // Other investments — all individual by investmentName, grouped into sections by category
    const activeOther = filterOwner(otherInvList.filter((i) => i.status === 'Active'), 'familyMemberId')
    activeOther.forEach((i) => {
      const cat = i.investmentCategory || 'Other'
      addToSection(cat, i.investmentName || i.investmentType || 'Other', i.currentValue, i.investedAmount || 0)
    })

    // Build sections array sorted by SECTION_META order
    const sections = Object.entries(sectionMap)
      .map(([key, { items: sItems, invested }]) => {
        const meta = SECTION_META[key] || SECTION_META.Other
        const total = sItems.reduce((s, i) => s + i.value, 0)
        return { key, label: meta.label, color: meta.color, order: meta.order, route: meta.route, total, invested, items: sItems.sort((a, b) => b.value - a.value) }
      })
      .filter((s) => s.total > 0)
      .sort((a, b) => a.order - b.order)

    // Liabilities with names
    const activeLiab = filterOwner(liabilityList.filter((l) => l.status === 'Active'), 'familyMemberId')
    const liabilities = activeLiab.map((l) => ({ label: l.liabilityName || l.liabilityType || 'Loan', value: l.outstandingBalance }))
    const totalLiab = activeLiab.reduce((s, l) => s + l.outstandingBalance, 0)
    const totalInv = sections.reduce((s, sec) => s + sec.total, 0)
    const totalInvested = sections.reduce((s, sec) => s + sec.invested, 0)
    return { netWorth: totalInv - totalLiab, totalInv, totalInvested, sections, totalLiab, liabilities }
  }, [selectedMember, mfPortfolios, mfHoldings, stockPortfolios, stockHoldings, otherInvList, liabilityList])

  return (
    <header className="sticky top-0 z-30 shrink-0">
      {/* Top bar — z-10 so dropdowns render above ticker/NW sections */}
      <div className="relative z-10 bg-[var(--bg-header)]/95 backdrop-blur-sm border-b border-[var(--border)]">
        <div className="flex items-center justify-between px-3 sm:px-4 h-14">
          {/* Left: hamburger + logo */}
          <div className="flex items-center gap-2">
            <button onClick={onMenuClick} className="lg:hidden p-2 -ml-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors">
              <Menu size={20} />
            </button>
            <img src={LOGO} alt="Capital Friends" className="h-10" />
          </div>

          {/* Right: theme toggle + notification bell + member avatar */}
          <div className="flex items-center gap-1.5">
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

              {/* Dropdown */}
              {dropdownOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] shadow-xl shadow-black/20 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-50">
                  {/* Header */}
                  <div className="px-4 py-2.5 border-b border-[var(--border-light)]">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Viewing as</p>
                  </div>

                  <div className="py-1.5">
                    {/* Everyone option */}
                    <button
                      onClick={() => { setSelectedMember('all'); setDropdownOpen(false) }}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                        selectedMember === 'all'
                          ? 'bg-violet-500/10'
                          : 'hover:bg-[var(--bg-hover)]'
                      }`}
                    >
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center text-white shadow-sm shrink-0">
                        <Users size={15} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold truncate ${selectedMember === 'all' ? 'text-violet-400' : 'text-[var(--text-primary)]'}`}>Everyone</p>
                        <p className="text-[11px] text-[var(--text-muted)]">All family members</p>
                      </div>
                      {selectedMember === 'all' && (
                        <Check size={16} className="text-violet-400 shrink-0" />
                      )}
                    </button>

                    {/* Divider */}
                    {familyMembers.length > 0 && (
                      <div className="mx-4 my-1 border-t border-[var(--border-light)]" />
                    )}

                    {/* Individual members */}
                    {familyMembers.map((m, i) => {
                      const isSelected = selectedMember === m.memberId
                      return (
                        <button
                          key={m.memberId}
                          onClick={() => { setSelectedMember(m.memberId); setDropdownOpen(false) }}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                            isSelected
                              ? `${avatarSolids[i % avatarSolids.length]}/10`
                              : 'hover:bg-[var(--bg-hover)]'
                          }`}
                        >
                          <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${avatarColors[i % avatarColors.length]} flex items-center justify-center text-white text-sm font-bold shadow-sm shrink-0`}>
                            {m.memberName.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-semibold truncate ${isSelected ? 'text-[var(--text-primary)]' : 'text-[var(--text-primary)]'}`}>{m.memberName}</p>
                            <p className="text-[11px] text-[var(--text-muted)]">{m.relationship || 'Family member'}</p>
                          </div>
                          {isSelected && (
                            <Check size={16} className="text-emerald-400 shrink-0" />
                          )}
                        </button>
                      )
                    })}
                  </div>

                  {/* Sign out */}
                  <div className="border-t border-[var(--border-light)] py-1.5">
                    {user && (
                      <div className="px-4 py-1.5">
                        <p className="text-[11px] text-[var(--text-muted)] truncate">{user.email}</p>
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

      {/* Market Ticker */}
      <MarketTicker />

      {/* Action Strip — pills that open dialogs */}
      <ActionStrip />

      {/* Net Worth Breakdown — always visible */}
      <div className="bg-[var(--bg-card)]/90 backdrop-blur-sm border-b border-[var(--border-light)]">
        <div className="px-3 sm:px-4 py-2.5">
          {/* Section cards grid — auto-fill adapts to any number of cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-2">
            {nw.sections?.map((sec) => (
              <Link
                key={sec.key}
                to={sec.route}
                className="group rounded-lg p-2.5 bg-[var(--bg-inset)] hover:bg-[var(--bg-hover)] border border-[var(--border-light)] transition-colors"
              >
                {/* Section header */}
                <div className="flex items-center justify-between mb-1">
                  <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    <span className={`w-1.5 h-1.5 rounded-full ${sec.color}`} />{sec.label}
                  </span>
                  <ChevronRight size={10} className="text-[var(--text-dim)] opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className="text-sm font-bold text-[var(--text-primary)] tabular-nums mb-0.5">{formatINR(sec.total)}</p>
                {/* Items */}
                {sec.items.length > 0 && (
                  <div className="space-y-0">
                    {sec.items.map((item) => (
                      <div key={item.label} className="flex items-center justify-between">
                        <span className="text-[11px] text-[var(--text-dim)] truncate mr-1.5">{item.label}</span>
                        <span className="text-[11px] text-[var(--text-muted)] tabular-nums shrink-0">{formatINR(item.value)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Link>
            ))}

            {/* Liabilities card with individual names */}
            {nw.totalLiab > 0 && (
              <Link
                to="/accounts/liabilities"
                className="group rounded-lg p-2.5 bg-[var(--bg-inset)] hover:bg-[var(--bg-hover)] border border-[var(--border-light)] transition-colors"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />Liabilities
                  </span>
                  <ChevronRight size={10} className="text-[var(--text-dim)] opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className="text-sm font-bold text-[var(--accent-rose)] tabular-nums mb-0.5">&minus;{formatINR(nw.totalLiab)}</p>
                {nw.liabilities?.length > 0 && (
                  <div className="space-y-0">
                    {nw.liabilities.map((item) => (
                      <div key={item.label} className="flex items-center justify-between">
                        <span className="text-[11px] text-[var(--text-dim)] truncate mr-1.5">{item.label}</span>
                        <span className="text-[11px] text-[var(--accent-rose)]/70 tabular-nums shrink-0">{formatINR(item.value)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Link>
            )}

            {/* Net Worth — highlighted card */}
            <div className="rounded-lg p-2.5 bg-gradient-to-br from-emerald-500/15 to-teal-500/10 border border-emerald-500/30 flex flex-col justify-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400/80">Net Worth</span>
              <p className="text-xl font-extrabold text-emerald-400 tabular-nums mt-1">{formatINR(nw.netWorth)}</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
