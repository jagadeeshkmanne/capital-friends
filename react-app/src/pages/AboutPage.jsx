import { Heart, ChevronRight, MessageSquarePlus, Bug, Github, Globe, Shield, Smartphone, BarChart3, Users, Target, Mail } from 'lucide-react'

const FEATURES = [
  { icon: BarChart3, color: 'text-violet-400 bg-violet-500/15', text: 'Track Mutual Funds, Stocks & Other Investments' },
  { icon: Users, color: 'text-blue-400 bg-blue-500/15', text: 'Family member-wise portfolio management' },
  { icon: Target, color: 'text-emerald-400 bg-emerald-500/15', text: 'Goal planning with portfolio mapping' },
  { icon: Shield, color: 'text-cyan-400 bg-cyan-500/15', text: 'Insurance, Liabilities & Bank Accounts' },
  { icon: Smartphone, color: 'text-amber-400 bg-amber-500/15', text: 'ATH-based Buy Opportunities & Smart Rebalancing' },
  { icon: Mail, color: 'text-rose-400 bg-rose-500/15', text: 'Email reports, Reminders & Financial Health Check' },
]

export default function AboutPage() {
  return (
    <div className="space-y-4 max-w-lg mx-auto">
      {/* Hero Card */}
      <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-6 text-center">
        <img src={`${import.meta.env.BASE_URL}logo-new.png`} alt="Capital Friends" className="h-16 w-auto mx-auto mb-3" />
        <h1 className="text-lg font-bold text-[var(--text-primary)]" style={{ fontFamily: "'Poppins', sans-serif" }}>
          <span>Capital</span><span className="text-emerald-400">Friends</span>
        </h1>
        <p className="text-xs text-[var(--text-dim)] mt-1">Family Portfolio Manager</p>
        <div className="flex items-center justify-center gap-3 mt-3">
          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-violet-500/10 text-violet-400">
            v1.0
          </span>
          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-medium bg-emerald-500/10 text-emerald-400">
            Open Source
          </span>
        </div>
      </div>

      {/* What it does */}
      <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-4">
        <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed">
          Capital Friends helps Indian families track, manage, and grow their wealth — all from a single Google Sheet powered by a modern web app.
        </p>
      </div>

      {/* Features */}
      <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border-light)] bg-[var(--bg-inset)]">
          <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Features</h3>
        </div>
        <div className="px-4 py-3 space-y-3">
          {FEATURES.map((f) => (
            <div key={f.text} className="flex items-center gap-3">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${f.color}`}>
                <f.icon size={14} />
              </div>
              <p className="text-xs text-[var(--text-secondary)]">{f.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Links */}
      <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border-light)] bg-[var(--bg-inset)]">
          <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Links & Feedback</h3>
        </div>
        <div className="divide-y divide-[var(--border-light)]">
          <a href="https://github.com/jagadeeshkmanne/capital-friends" target="_blank" rel="noopener noreferrer"
             className="flex items-center gap-3 px-4 py-3.5 hover:bg-[var(--bg-hover)] transition-colors">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-slate-500/15 text-[var(--text-muted)]">
              <Github size={17} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--text-primary)]">GitHub Repository</p>
              <p className="text-[11px] text-[var(--text-dim)]">View source code and contribute</p>
            </div>
            <ChevronRight size={14} className="text-[var(--text-dim)] shrink-0" />
          </a>
          <a href="https://capitalfriends.in" target="_blank" rel="noopener noreferrer"
             className="flex items-center gap-3 px-4 py-3.5 hover:bg-[var(--bg-hover)] transition-colors">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-emerald-500/15 text-emerald-400">
              <Globe size={17} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--text-primary)]">capitalfriends.in</p>
              <p className="text-[11px] text-[var(--text-dim)]">Official website</p>
            </div>
            <ChevronRight size={14} className="text-[var(--text-dim)] shrink-0" />
          </a>
          <a href="https://github.com/jagadeeshkmanne/capital-friends/issues/new?labels=enhancement&template=feature_request.md&title=%5BFeature%5D+"
             target="_blank" rel="noopener noreferrer"
             className="flex items-center gap-3 px-4 py-3.5 hover:bg-[var(--bg-hover)] transition-colors">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-violet-500/15 text-violet-400">
              <MessageSquarePlus size={17} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--text-primary)]">Request a Feature</p>
              <p className="text-[11px] text-[var(--text-dim)]">Suggest new features or improvements</p>
            </div>
            <ChevronRight size={14} className="text-[var(--text-dim)] shrink-0" />
          </a>
          <a href="https://github.com/jagadeeshkmanne/capital-friends/issues/new?labels=bug&template=bug_report.md&title=%5BBug%5D+"
             target="_blank" rel="noopener noreferrer"
             className="flex items-center gap-3 px-4 py-3.5 hover:bg-[var(--bg-hover)] transition-colors">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-rose-500/15 text-rose-400">
              <Bug size={17} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--text-primary)]">Report a Bug</p>
              <p className="text-[11px] text-[var(--text-dim)]">Found something wrong? Let us know</p>
            </div>
            <ChevronRight size={14} className="text-[var(--text-dim)] shrink-0" />
          </a>
        </div>
      </div>

      {/* Contact */}
      <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border-light)] bg-[var(--bg-inset)]">
          <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Contact</h3>
        </div>
        <a href="mailto:jagadeesh.k.manne@gmail.com"
           className="flex items-center gap-3 px-4 py-3.5 hover:bg-[var(--bg-hover)] transition-colors">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-blue-500/15 text-blue-400">
            <Mail size={17} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[var(--text-primary)]">jagadeesh.k.manne@gmail.com</p>
            <p className="text-[11px] text-[var(--text-dim)]">Questions, feedback, or just say hi</p>
          </div>
          <ChevronRight size={14} className="text-[var(--text-dim)] shrink-0" />
        </a>
      </div>

      {/* Credits */}
      <div className="text-center py-3">
        <p className="text-xs text-[var(--text-dim)]">
          Built with <Heart size={10} className="inline text-pink-400 mx-0.5" /> by Jagadeesh Manne
        </p>
        <p className="text-[11px] text-[var(--text-dim)] mt-1">React + Vite + Tailwind CSS + Google Apps Script</p>
      </div>
    </div>
  )
}
