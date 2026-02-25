import { useNavigate } from 'react-router-dom'
import { FileText, Bell, Settings, Info, Heart, Zap } from 'lucide-react'

const items = [
  { label: 'Reports & Transactions', desc: 'View transaction history', icon: FileText, path: '/reports', color: 'bg-blue-500/15 text-[var(--accent-blue)]' },
  { label: 'Reminders', desc: 'View and manage reminders', icon: Bell, path: '/reminders', color: 'bg-amber-500/15 text-[var(--accent-amber)]' },
  { label: 'Health Check', desc: 'Financial health questionnaire', icon: Zap, path: '/health-check', color: 'bg-emerald-500/15 text-emerald-400' },
  { label: 'Settings', desc: 'App configuration', icon: Settings, path: '/settings', color: 'bg-slate-500/15 text-[var(--text-muted)]' },
  { label: 'About', desc: 'Capital Friends v2.0', icon: Info, path: '/about', color: 'bg-violet-500/15 text-[var(--accent-violet)]' },
  { label: 'Support Developer', desc: 'UPI: jagadeeshmanne.hdfc@kphdfc', icon: Heart, path: '/about', color: 'bg-pink-500/15 text-pink-400' },
]

export default function MorePage() {
  const navigate = useNavigate()

  return (
    <div className="space-y-4">
      <h1 className="text-base font-bold text-[var(--text-primary)]">More</h1>
      <div className="space-y-2">
        {items.map((item) => (
          <button
            key={item.label}
            onClick={() => navigate(item.path)}
            className="w-full flex items-center gap-3 bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-4 hover:bg-[var(--bg-hover)] transition-colors text-left"
          >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${item.color}`}>
              <item.icon size={18} />
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">{item.label}</p>
              <p className="text-xs text-[var(--text-dim)]">{item.desc}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
