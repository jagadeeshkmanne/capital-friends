import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Settings, Info, Heart, Zap, Users, Briefcase, Shield, BarChart3, Package, CreditCard, ChevronRight, Copy, Check } from 'lucide-react'

const navItems = [
  { label: 'Family Members', desc: 'Manage family profiles', icon: Users, path: '/family', color: 'bg-violet-500/15 text-violet-400' },
  { label: 'Investment Accounts', desc: 'Demat & trading accounts', icon: Briefcase, path: '/accounts/investment', color: 'bg-blue-500/15 text-blue-400' },
  { label: 'Insurance', desc: 'Life & health policies', icon: Shield, path: '/insurance', color: 'bg-cyan-500/15 text-cyan-400' },
  { label: 'Stocks', desc: 'Stock portfolio holdings', icon: BarChart3, path: '/investments/stocks', color: 'bg-indigo-500/15 text-indigo-400' },
  { label: 'Other Investments', desc: 'FD, PPF, Gold, NPS & more', icon: Package, path: '/investments/other', color: 'bg-teal-500/15 text-teal-400' },
  { label: 'Liabilities', desc: 'Loans & outstanding balances', icon: CreditCard, path: '/liabilities', color: 'bg-rose-500/15 text-rose-400' },
  { label: 'Reminders', desc: 'View and manage reminders', icon: Bell, path: '/reminders', color: 'bg-amber-500/15 text-[var(--accent-amber)]' },
]

const toolItems = [
  { label: 'Health Check', desc: 'Financial health questionnaire', icon: Zap, path: '/health-check', color: 'bg-emerald-500/15 text-emerald-400' },
  { label: 'Settings', desc: 'App configuration', icon: Settings, path: '/settings', color: 'bg-slate-500/15 text-[var(--text-muted)]' },
  { label: 'About', desc: 'Capital Friends v2.0', icon: Info, path: '/about', color: 'bg-violet-500/15 text-[var(--accent-violet)]' },
]

function NavItem({ item, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-3.5 hover:bg-[var(--bg-hover)] transition-colors text-left"
    >
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${item.color}`}>
        <item.icon size={17} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--text-primary)]">{item.label}</p>
        <p className="text-[11px] text-[var(--text-dim)]">{item.desc}</p>
      </div>
      <ChevronRight size={14} className="text-[var(--text-dim)] shrink-0" />
    </button>
  )
}

const UPI_ID = 'jagadeeshmanne.hdfc@kphdfc'

export default function MorePage() {
  const navigate = useNavigate()
  const [copied, setCopied] = useState(false)

  function copyUPI() {
    navigator.clipboard.writeText(UPI_ID).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="space-y-5">
      <h1 className="text-base font-bold text-[var(--text-primary)]">More</h1>

      {/* Navigate section */}
      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-dim)] px-1">Navigate</p>
        <div className="space-y-1.5">
          {navItems.map((item) => (
            <NavItem key={item.label} item={item} onClick={() => navigate(item.path)} />
          ))}
        </div>
      </div>

      {/* Tools & Settings section */}
      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-dim)] px-1">Tools & Settings</p>
        <div className="space-y-1.5">
          {toolItems.map((item) => (
            <NavItem key={item.label} item={item} onClick={() => navigate(item.path)} />
          ))}
        </div>
      </div>

      {/* Support Developer — highlighted */}
      <div className="bg-gradient-to-r from-pink-500/10 via-violet-500/10 to-pink-500/10 rounded-xl border border-pink-500/25 p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-pink-500/20 text-pink-400">
            <Heart size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-pink-400">Support Developer</p>
            <p className="text-[11px] text-[var(--text-dim)] mt-0.5">Help maintain this app with a small donation</p>
            <div className="flex items-center gap-2 mt-1.5">
              <p className="text-xs text-[var(--text-primary)] font-mono bg-[var(--bg-card)] px-2 py-1 rounded border border-[var(--border)] truncate">{UPI_ID}</p>
              <button onClick={copyUPI} className="shrink-0 px-2.5 py-1 rounded-lg text-xs font-semibold bg-pink-500/15 text-pink-400 hover:bg-pink-500/25 transition-colors flex items-center gap-1">
                {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
