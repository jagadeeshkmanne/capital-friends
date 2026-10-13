import { NavLink, useLocation } from 'react-router-dom'
import { LayoutDashboard, Wallet, BarChart3, Target, Menu } from 'lucide-react'
import { openMobileMenu } from './MobileMenu'

// Four main tabs + Menu (opens the drawer with every page). Menu shows as selected on pages that aren't a tab,
// so you always see where you are.
export const TAB_PATHS = ['/dashboard', '/investments/mutual-funds', '/investments/stocks', '/goals']
const tabs = [
  { label: 'Home',       icon: LayoutDashboard,  path: '/dashboard' },
  { label: 'Funds',      icon: Wallet,           path: '/investments/mutual-funds' },
  { label: 'Stocks',     icon: BarChart3,        path: '/investments/stocks' },
  { label: 'Goals',      icon: Target,           path: '/goals' },
]

export default function BottomNav() {
  const { pathname } = useLocation()
  const elsewhere = !TAB_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--bg-sidebar)] border-t border-[var(--border)] safe-bottom">
      <div className="flex items-stretch justify-around h-[60px] px-1">
        {tabs.map(({ label, icon: Icon, path }) => (
          <NavLink key={path} to={path}
            className={({ isActive }) =>
              `relative flex flex-col items-center justify-center gap-0.5 flex-1 min-w-0 h-full text-xs font-medium transition-colors active:scale-95 ${
                isActive ? 'text-[var(--sidebar-active-text)]' : 'text-[var(--text-dim)]'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div className={`flex items-center justify-center w-14 h-8 rounded-full transition-colors ${
                  isActive ? 'bg-[var(--sidebar-active-bg)]' : ''
                }`}>
                  <Icon size={21} strokeWidth={isActive ? 2.2 : 1.6} />
                </div>
                <span className={`text-[11px] leading-tight whitespace-nowrap ${isActive ? 'font-semibold' : ''}`}>{label}</span>
              </>
            )}
          </NavLink>
        ))}
        <button type="button" onClick={openMobileMenu}
          className={`relative flex flex-col items-center justify-center gap-0.5 flex-1 min-w-0 h-full text-xs font-medium transition-colors active:scale-95 ${elsewhere ? 'text-[var(--sidebar-active-text)]' : 'text-[var(--text-dim)]'}`}>
          <div className={`flex items-center justify-center w-14 h-8 rounded-full transition-colors ${elsewhere ? 'bg-[var(--sidebar-active-bg)]' : ''}`}>
            <Menu size={21} strokeWidth={elsewhere ? 2.2 : 1.6} />
          </div>
          <span className={`text-[11px] leading-tight whitespace-nowrap ${elsewhere ? 'font-semibold' : ''}`}>Menu</span>
        </button>
      </div>
    </nav>
  )
}
