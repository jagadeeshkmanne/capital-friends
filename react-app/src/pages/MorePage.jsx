import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Settings, Info, Heart, Zap, Users, Briefcase, Shield, BarChart3, Package, CreditCard, ChevronRight } from 'lucide-react'
import DonateDialog from '../components/DonateDialog'

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

export default function MorePage() {
  const navigate = useNavigate()
  const [showDonate, setShowDonate] = useState(false)

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

      {/* Support Developer — highlighted, opens donate dialog */}
      <button
        onClick={() => setShowDonate(true)}
        className="w-full text-left rounded-xl border border-amber-500/25 p-4 hover:border-amber-500/40 transition-colors"
        style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.06) 0%, rgba(139,92,246,0.04) 100%)' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-amber-500/15">
            <Heart size={20} className="text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-400">Support the Developer</p>
            <p className="text-[11px] text-[var(--text-dim)] mt-0.5">Capital Friends is free. If it helps, consider a small donation!</p>
          </div>
          <ChevronRight size={14} className="text-amber-400/60 shrink-0" />
        </div>
      </button>

      <DonateDialog open={showDonate} onClose={() => setShowDonate(false)} />
    </div>
  )
}
