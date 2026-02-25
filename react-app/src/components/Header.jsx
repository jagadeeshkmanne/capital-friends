import { useMemo, useState, useRef, useEffect } from 'react'
import { Menu, Sun, Moon, ArrowUpRight, ArrowDownRight, Users, ChevronDown, Check, LogOut } from 'lucide-react'

import { useTheme } from '../context/ThemeContext'
import { useFamily } from '../context/FamilyContext'
import { useData } from '../context/DataContext'
import { useAuth } from '../context/AuthContext'
import { formatINR } from '../data/familyData'

const LOGO = 'https://raw.githubusercontent.com/jagadeeshkmanne/capital-friends/main/logo.png'

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

function plSign(num) { return num >= 0 ? '+' : '' }
function plPct(pl, invested) {
  if (!invested) return '0%'
  return `${pl >= 0 ? '+' : ''}${((pl / invested) * 100).toFixed(1)}%`
}

export default function Header({ onMenuClick }) {
  const { theme, toggle } = useTheme()
  const { selectedMember, setSelectedMember, familyMembers } = useFamily()
  const { mfPortfolios, mfHoldings, stockPortfolios, stockHoldings, otherInvList, liabilityList } = useData()
  const { user, signOut } = useAuth()

  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
    }
    if (dropdownOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [dropdownOpen])

  // Find the selected member object & its avatar index
  const selectedIdx = familyMembers.findIndex((m) => m.memberId === selectedMember)
  const selectedObj = selectedIdx >= 0 ? familyMembers[selectedIdx] : null

  const w = useMemo(() => {
    const filterOwner = (items, key) =>
      selectedMember === 'all' ? items : items.filter((i) => i[key] === selectedMember)

    const activeMF = filterOwner(mfPortfolios.filter((p) => p.status === 'Active'), 'ownerId')
    const mfIds = new Set(activeMF.map((p) => p.portfolioId))
    const mfH = mfHoldings.filter((h) => mfIds.has(h.portfolioId) && h.units > 0)
    const mfInvested = mfH.reduce((s, h) => s + h.investment, 0)
    const mfValue = mfH.reduce((s, h) => s + h.currentValue, 0)

    const activeStk = filterOwner(stockPortfolios.filter((p) => p.status === 'Active'), 'ownerId')
    const stkIds = new Set(activeStk.map((p) => p.portfolioId))
    const stkH = stockHoldings.filter((h) => stkIds.has(h.portfolioId))
    const stkInvested = stkH.reduce((s, h) => s + h.totalInvestment, 0)
    const stkValue = stkH.reduce((s, h) => s + h.currentValue, 0)

    const activeOther = filterOwner(otherInvList.filter((i) => i.status === 'Active'), 'familyMemberId')
    const otherInvested = activeOther.reduce((s, i) => s + i.investedAmount, 0)
    const otherValue = activeOther.reduce((s, i) => s + i.currentValue, 0)

    const activeLiab = filterOwner(liabilityList.filter((l) => l.status === 'Active'), 'familyMemberId')
    const totalLiab = activeLiab.reduce((s, l) => s + l.outstandingBalance, 0)

    const invested = mfInvested + stkInvested + otherInvested
    const totalAssets = mfValue + stkValue + otherValue
    const unrealizedPL = totalAssets - invested
    const netWorth = totalAssets - totalLiab

    return { netWorth, invested, totalPL: unrealizedPL, unrealizedPL }
  }, [selectedMember, mfPortfolios, mfHoldings, stockPortfolios, stockHoldings, otherInvList, liabilityList])

  return (
    <header className="sticky top-0 z-30 shrink-0">
      {/* Top bar — matches pre-login header style */}
      <div className="bg-[var(--bg-header)]/95 backdrop-blur-sm border-b border-[var(--border)]">
        <div className="flex items-center justify-between px-3 sm:px-4 h-14">
          {/* Left: hamburger + logo */}
          <div className="flex items-center gap-2">
            <button onClick={onMenuClick} className="lg:hidden p-2 -ml-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors">
              <Menu size={20} />
            </button>
            <img src={LOGO} alt="Capital Friends" className="h-10" />
          </div>

          {/* Right: theme toggle + member avatar */}
          <div className="flex items-center gap-1.5">
            <button onClick={toggle} className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors" title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {/* Member avatar + dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
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

      {/* Wealth strip — reactive to selected member */}
      <div className="bg-[var(--bg-strip)]/95 backdrop-blur-sm border-b border-[var(--border)]">
        <div className="flex items-stretch overflow-x-auto no-scrollbar">
          <WealthItem label="Net Worth" value={formatINR(w.netWorth)} primary />
          <WealthItem label="Invested" value={formatINR(w.invested)} />
          <WealthItem label="P&L" value={`${plSign(w.totalPL)}${formatINR(Math.abs(w.totalPL))}`} change={plPct(w.totalPL, w.invested)} up={w.totalPL >= 0} />
        </div>
      </div>
    </header>
  )
}

function WealthItem({ label, value, change, up, primary }) {
  return (
    <div className={`flex-1 px-4 sm:px-5 py-2 border-r border-[var(--border-light)] last:border-0 text-center ${primary ? 'bg-violet-500/[0.03]' : ''}`}>
      <p className={`font-semibold uppercase tracking-wider whitespace-nowrap ${primary ? 'text-xs text-violet-400' : 'text-xs text-[var(--text-muted)]'}`}>{label}</p>
      <div className="flex items-center justify-center gap-1 mt-0.5">
        <p className={`font-bold whitespace-nowrap tabular-nums ${primary ? 'text-[var(--text-primary)] text-base' : 'text-[var(--text-secondary)] text-sm'}`}>{value}</p>
        {change && (
          <span className={`flex items-center text-xs font-semibold ${up ? 'text-emerald-500' : 'text-rose-500'}`}>
            {up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}{change}
          </span>
        )}
      </div>
    </div>
  )
}
