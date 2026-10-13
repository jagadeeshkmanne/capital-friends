import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Wallet, CreditCard, Target, MoreHorizontal } from 'lucide-react'

const tabs = [
  { label: 'Home',       icon: LayoutDashboard,  path: '/dashboard' },
  { label: 'Mutual Funds', icon: Wallet,         path: '/investments/mutual-funds' },
  { label: 'Accounts',   icon: CreditCard,      path: '/accounts/bank' },
  { label: 'Goals',      icon: Target,           path: '/goals' },
  { label: 'More',       icon: MoreHorizontal,   path: '/more' },
]

export default function BottomNav() {
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
      </div>
    </nav>
  )
}
