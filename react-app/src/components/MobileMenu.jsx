import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, Landmark, Briefcase, Shield, Wallet, Layers, BarChart3, Package, CreditCard, Target, Bell,
  Settings, FileUp, PieChart, Palmtree, Zap, Info, Heart, LogOut, X, ChevronRight, Sun, Moon, Eye, EyeOff,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useMask } from '../context/MaskContext'
import DonateDialog from './DonateDialog'
const LOGO_ICON = `${import.meta.env.BASE_URL}logo-new.png`

// Phone menu: a drawer from the left with every page, opened by the ☰ button (top bar on the main tabs, and the
// "Menu" tab). The phone's Back button closes it, like a native app.
const GROUPS = [
  { t: 'Overview', items: [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    { label: 'Family Members', icon: Users, path: '/family' },
    { label: 'Reports', icon: PieChart, path: '/reports' },
  ] },
  { t: 'Investments', items: [
    { label: 'Mutual Funds', icon: Wallet, path: '/investments/mutual-funds' },
    { label: 'All Funds', icon: Layers, path: '/investments/funds' },
    { label: 'Stocks', icon: BarChart3, path: '/investments/stocks' },
    { label: 'Other Investments', icon: Package, path: '/investments/other', desc: 'FD, PPF, EPF, gold, NPS…' },
    { label: 'Import Statement', icon: FileUp, path: '/import', desc: 'Mutual funds from a CAMS PDF' },
  ] },
  { t: 'Accounts', items: [
    { label: 'Bank Accounts', icon: Landmark, path: '/accounts/bank' },
    { label: 'Investment Accounts', icon: Briefcase, path: '/accounts/investment' },
    { label: 'Insurance', icon: Shield, path: '/insurance' },
    { label: 'Liabilities', icon: CreditCard, path: '/liabilities', desc: 'Loans' },
  ] },
  { t: 'Plan', items: [
    { label: 'Goals', icon: Target, path: '/goals' },
    { label: 'Retirement', icon: Palmtree, path: '/retirement-buckets' },
    { label: 'Reminders', icon: Bell, path: '/reminders' },
    { label: 'Health Check', icon: Zap, path: '/health-check' },
  ] },
  { t: 'App', items: [
    { label: 'Settings', icon: Settings, path: '/settings' },
    { label: 'About', icon: Info, path: '/about' },
  ] },
]

export function openMobileMenu() { window.dispatchEvent(new Event('cf:menu')) }

export default function MobileMenu() {
  const [open, setOpen] = useState(false)
  const [donate, setDonate] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const { theme, toggle } = useTheme()
  const { masked, toggleMask } = useMask()
  const pushed = useRef(false)

  // open: add a history entry so the phone's Back closes the drawer instead of leaving the page
  useEffect(() => {
    const onOpen = () => setOpen(true)
    window.addEventListener('cf:menu', onOpen)
    return () => window.removeEventListener('cf:menu', onOpen)
  }, [])
  useEffect(() => {
    if (!open) return
    try { window.history.pushState({ ...(window.history.state || {}), cfMenu: true }, ''); pushed.current = true } catch { pushed.current = false }
    const onPop = () => { pushed.current = false; setOpen(false) }
    window.addEventListener('popstate', onPop)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('popstate', onPop); document.body.style.overflow = '' }
  }, [open])

  const close = () => { if (pushed.current && window.history.state?.cfMenu) { pushed.current = false; window.history.back() } setOpen(false) }
  const go = (path) => {
    // leave the drawer's history entry first, then move (so Back from the new page returns to the old one)
    if (pushed.current && window.history.state?.cfMenu) {
      pushed.current = false
      const after = () => { window.removeEventListener('popstate', after); navigate(path) }
      window.addEventListener('popstate', after)
      window.history.back()
    } else navigate(path)
    setOpen(false)
  }
  const active = (p) => location.pathname === p || location.pathname.startsWith(p + '/')

  return (
    <>
      <div onClick={close} className={`lg:hidden fixed inset-0 z-[60] bg-black/55 transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} />
      <aside aria-hidden={!open} className={`lg:hidden fixed top-0 bottom-0 left-0 z-[61] w-[86vw] max-w-[340px] bg-[var(--bg-sidebar)] border-r border-[var(--border)] shadow-2xl rounded-r-2xl flex flex-col transition-transform duration-[250ms] ease-out ${open ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex items-center gap-3 px-4 h-16 border-b border-[var(--border)] shrink-0">
          <img src={LOGO_ICON} alt="" className="h-8 w-auto" />
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-bold text-[var(--text-primary)] leading-tight" style={{ fontFamily: "'Poppins', sans-serif" }}>Capital <span className="text-emerald-400">Friends</span></p>
            {user?.email && <p className="text-xs text-[var(--text-dim)] truncate">{user.email}</p>}
          </div>
          <button onClick={close} aria-label="Close menu" className="p-2 -mr-2 rounded-full text-[var(--text-muted)] active:bg-[var(--bg-hover)]"><X size={20} /></button>
        </div>

        <nav className="flex-1 overflow-y-auto overscroll-contain py-2">
          {GROUPS.map((g) => (
            <div key={g.t} className="pb-1">
              <p className="px-5 pt-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-[var(--text-dim)]">{g.t}</p>
              {g.items.map((it) => {
                const on = active(it.path)
                return (
                  <button key={it.path} onClick={() => go(it.path)}
                    className={`w-[calc(100%-16px)] mx-2 flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors active:scale-[0.99] ${on ? 'bg-[var(--sidebar-active-bg)] text-[var(--sidebar-active-text)]' : 'text-[var(--text-primary)] active:bg-[var(--bg-hover)]'}`}>
                    <it.icon size={19} strokeWidth={on ? 2.2 : 1.7} className={on ? '' : 'text-[var(--text-muted)]'} />
                    <span className="flex-1 min-w-0">
                      <span className={`block text-[14.5px] ${on ? 'font-semibold' : 'font-medium'}`}>{it.label}</span>
                      {it.desc && <span className="block text-xs text-[var(--text-dim)] truncate">{it.desc}</span>}
                    </span>
                    {!on && <ChevronRight size={15} className="text-[var(--text-dim)]" />}
                  </button>
                )
              })}
            </div>
          ))}

          <div className="mx-4 my-2 border-t border-[var(--border-light)]" />
          <div className="px-2 space-y-0.5">
            <button onClick={toggle} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-[var(--text-primary)] active:bg-[var(--bg-hover)]">
              {theme === 'dark' ? <Sun size={19} className="text-[var(--text-muted)]" /> : <Moon size={19} className="text-[var(--text-muted)]" />}
              <span className="text-[14.5px] font-medium">{theme === 'dark' ? 'Light theme' : 'Dark theme'}</span>
            </button>
            <button onClick={toggleMask} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-[var(--text-primary)] active:bg-[var(--bg-hover)]">
              {masked ? <Eye size={19} className="text-[var(--text-muted)]" /> : <EyeOff size={19} className="text-[var(--text-muted)]" />}
              <span className="text-[14.5px] font-medium">{masked ? 'Show amounts' : 'Hide amounts'}</span>
            </button>
            <button onClick={() => setDonate(true)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left active:bg-[var(--bg-hover)]">
              <Heart size={19} className="text-amber-400" />
              <span className="text-[14.5px] font-semibold text-amber-400">Support the developer</span>
            </button>
            {signOut && (
              <button onClick={() => { close(); signOut() }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-[var(--accent-rose)] active:bg-[var(--bg-hover)]">
                <LogOut size={19} /><span className="text-[14.5px] font-medium">Sign out</span>
              </button>
            )}
          </div>
          <div className="flex items-center justify-center gap-4 pt-4 pb-3 text-xs text-[var(--text-dim)]">
            <button onClick={() => go('/privacy')}>Privacy</button>
            <button onClick={() => go('/terms')}>Terms</button>
            <span>v1.0</span>
          </div>
        </nav>
      </aside>
      <DonateDialog open={donate} onClose={() => setDonate(false)} />
    </>
  )
}
