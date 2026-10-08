import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileUp, X, Sparkles, AlertTriangle } from 'lucide-react'

// Banner on the Mutual Funds page that invites people to import their CAMS statement:
//  - never imported -> big "bring your full history" invitation
//  - imported, but some funds still lack history (XIRR hidden) -> smaller amber reminder
// "Not now" hides it for a while on this device.
const KEY = 'cf_import_nudge_snooze'

function snoozedUntil() { try { return +localStorage.getItem(KEY) || 0 } catch { return 0 } }

export default function ImportNudge({ transactions, returnsReason, funds }) {
  const navigate = useNavigate()
  const [hidden, setHidden] = useState(() => snoozedUntil() > Date.now())
  const imported = (transactions || []).some((t) => /^CAMS · folio/.test(String(t.notes || '')))
  const incomplete = returnsReason === 'funds-unreliable' || returnsReason === 'no-history'
  if (hidden || (imported && !incomplete)) return null

  function snooze(days) {
    try { localStorage.setItem(KEY, String(Date.now() + days * 86400000)) } catch { /* ignore */ }
    setHidden(true)
  }

  if (imported) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 flex items-center gap-3">
        <AlertTriangle size={18} className="text-amber-400 shrink-0" />
        <p className="flex-1 text-xs text-[var(--text-primary)]">Some funds don&apos;t have their full purchase history, so XIRR and CAGR are hidden. Import the latest CAMS statement of that family member to fix it.{funds?.length ? <span className="block mt-0.5 text-[var(--text-muted)]">Missing: {funds.slice(0, 3).join(', ')}{funds.length > 3 ? ` +${funds.length - 3} more` : ''}</span> : null}</p>
        <button onClick={() => navigate('/import')} className="shrink-0 px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-500 hover:bg-amber-400 text-black">Import</button>
        <button onClick={() => snooze(7)} aria-label="Not now" className="shrink-0 p-1 rounded hover:bg-[var(--bg-hover)]"><X size={14} className="text-[var(--text-dim)]" /></button>
      </div>
    )
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-violet-500/30 p-4 sm:p-5"
      style={{ background: 'linear-gradient(120deg, rgba(124,58,237,0.18) 0%, rgba(8,145,178,0.14) 60%, rgba(22,163,74,0.12) 100%)' }}>
      <style>{`@keyframes cfNudgeGlow{0%,100%{box-shadow:0 0 0 0 rgba(139,92,246,.55)}50%{box-shadow:0 0 0 10px rgba(139,92,246,0)}}`}</style>
      <button onClick={() => snooze(14)} aria-label="Not now" className="absolute top-2 right-2 p-1.5 rounded-full hover:bg-black/10"><X size={14} className="text-[var(--text-dim)]" /></button>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5 pr-6">
        <div className="w-12 h-12 rounded-2xl bg-violet-600 flex items-center justify-center shrink-0" style={{ animation: 'cfNudgeGlow 2.4s ease-in-out infinite' }}>
          <FileUp size={22} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm sm:text-base font-bold text-[var(--text-primary)] flex items-center gap-2 flex-wrap">
            Bring all your mutual funds in 2 minutes
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 flex items-center gap-1"><Sparkles size={10} /> NEW</span>
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">
            Import your free CAMS statement: every purchase, SIP, switch and sale since day one — so your invested amount, profit, <b>XIRR</b> and <b>CAGR</b> are exactly right. Read on your device. Undo anytime.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={() => navigate('/import')} className="px-4 py-2 text-sm font-semibold rounded-lg bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-900/30">Import statement</button>
          <button onClick={() => snooze(14)} className="px-3 py-2 text-xs font-medium rounded-lg text-[var(--text-dim)] hover:bg-[var(--bg-hover)]">Not now</button>
        </div>
      </div>
    </div>
  )
}
