import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Wallet, CreditCard, Target, MoreHorizontal } from 'lucide-react'

const tabs = [
  { label: 'Home',       icon: LayoutDashboard, path: '/dashboard' },
  { label: 'Accounts',   icon: CreditCard,      path: '/accounts/bank' },
  { label: 'Invest',     icon: Wallet,           path: '/investments/mutual-funds' },
  { label: 'Goals',      icon: Target,           path: '/goals' },
  { label: 'More',       icon: MoreHorizontal,   path: '/more' },
]

export default function BottomNav() {
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--bg-sidebar)] border-t border-[var(--border)] safe-bottom">
      <div className="flex items-center justify-around h-[56px]">
        {tabs.map(({ label, icon: Icon, path }) => (
          <NavLink key={path} to={path} end={path === '/dashboard'}
            className={({ isActive }) =>
              `relative flex flex-col items-center justify-center gap-0.5 w-full h-full text-xs font-medium transition-colors ${
                isActive ? 'text-[var(--sidebar-active-text)]' : 'text-[var(--text-dim)]'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && <span className="absolute top-0 w-10 h-[2.5px] bg-[var(--sidebar-active-text)] rounded-b-full" />}
                <div className={`flex items-center justify-center w-9 h-9 rounded-xl transition-colors ${
                  isActive ? 'bg-[var(--sidebar-active-bg)]' : ''
                }`}>
                  <Icon size={19} strokeWidth={isActive ? 2.2 : 1.5} />
                </div>
                <span className={isActive ? 'font-semibold' : ''}>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
