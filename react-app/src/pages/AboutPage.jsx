import { Heart, Coffee } from 'lucide-react'

export default function AboutPage() {
  return (
    <div className="space-y-4 max-w-lg mx-auto">
      {/* App Info */}
      <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-5 text-center">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center mx-auto mb-3">
          <span className="text-xl font-bold text-white">CF</span>
        </div>
        <h1 className="text-lg font-bold text-[var(--text-primary)]">Capital Friends</h1>
        <p className="text-xs text-[var(--text-dim)] mt-0.5">Family Portfolio Management</p>
        <p className="text-xs text-[var(--text-muted)] mt-2">v2.0.0</p>
      </div>

      {/* Features */}
      <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border-light)] bg-[var(--bg-inset)]">
          <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Features</h3>
        </div>
        <div className="px-4 py-3 space-y-2">
          {[
            'Track Mutual Funds, Stocks & Other Investments',
            'Family member-wise portfolio management',
            'ATH-based Buy Opportunities',
            'Smart Rebalancing with threshold alerts',
            'Goal planning with portfolio mapping',
            'Insurance, Liabilities & Bank Accounts',
            'Financial Health Check questionnaire',
            'Reminders for SIPs, renewals & due dates',
            'Email reports with detailed breakdowns',
          ].map((f) => (
            <div key={f} className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-500 shrink-0" />
              <p className="text-xs text-[var(--text-secondary)]">{f}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Support Developer */}
      <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border-light)] bg-[var(--bg-inset)]">
          <div className="flex items-center gap-2">
            <Heart size={12} className="text-pink-400" />
            <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Support Developer</h3>
          </div>
        </div>
        <div className="px-4 py-4 text-center">
          <p className="text-sm text-[var(--text-secondary)] mb-3">
            If Capital Friends helps you manage your family finances, consider supporting the developer.
          </p>
          <div className="bg-[var(--bg-inset)] rounded-lg px-4 py-3 border border-[var(--border)]">
            <p className="text-xs text-[var(--text-dim)] mb-1">UPI</p>
            <p className="text-sm font-mono font-semibold text-[var(--text-primary)] select-all">jagadeeshmanne.hdfc@kphdfc</p>
          </div>
          <div className="flex items-center justify-center gap-1 mt-3">
            <Coffee size={12} className="text-[var(--accent-amber)]" />
            <p className="text-xs text-[var(--text-dim)]">Buy me a chai!</p>
          </div>
        </div>
      </div>

      {/* Credits */}
      <div className="text-center py-2">
        <p className="text-xs text-[var(--text-dim)]">
          Made with <Heart size={10} className="inline text-pink-400 mx-0.5" /> by Jagadeesh Manne
        </p>
        <p className="text-xs text-[var(--text-dim)] mt-0.5">Built with React + Vite + Tailwind CSS</p>
      </div>
    </div>
  )
}
