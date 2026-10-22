import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { getFoundUsStats } from '../services/api'
import { FOUND_US_OPTIONS } from '../components/FoundUsDialog'

// Hidden admin page (/admin/found-us): where families heard about Capital Friends.
// Answers to the welcome question (FoundUsDialog). Only the admin email gets data (checked on the server too).

const BY_KEY = Object.fromEntries(FOUND_US_OPTIONS.map((o) => [o.k, o]))
const fmtDate = (d) => { if (!d) return '—'; const x = new Date(d + 'T00:00:00'); return isNaN(x) ? d : x.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) }

export default function FoundUsAdminPage() {
  const { isAdmin } = useAuth()
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [filter, setFilter] = useState('')

  function load() {
    setBusy(true); setErr('')
    getFoundUsStats().then((d) => setData(d || null)).catch((e) => setErr(e.message || 'Could not load')).finally(() => setBusy(false))
  }
  useEffect(() => { if (isAdmin) load() }, [isAdmin])

  const rows = useMemo(() => {
    const c = data?.counts || {}
    return Object.keys(c).map((k) => ({ k, n: c[k], o: BY_KEY[k] })).sort((a, b) => b.n - a.n)
  }, [data])
  const list = useMemo(() => (data?.list || []).filter((r) => !filter || r.via === filter), [data, filter])

  if (!isAdmin) return <Navigate to="/dashboard" replace />

  const total = data?.total || 0, families = data?.families
  const max = rows.length ? rows[0].n : 1
  const withDetail = list.filter((r) => r.detail)

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-[var(--text-primary)]">Where families come from</h1>
          <p className="text-xs text-[var(--text-dim)] mt-0.5">Answers to "How did you hear about Capital Friends?". Only you can see this page.</p>
        </div>
        <button onClick={load} disabled={busy} className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-50">
          <RefreshCw size={13} className={busy ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {err && <p className="text-sm text-rose-400">{err}</p>}
      {!data && !err && <p className="text-sm text-[var(--text-dim)] py-10 text-center">Loading…</p>}

      {data && (<>
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Families answered" value={total} />
          <Stat label="Families using the app" value={families ?? '—'} />
          <Stat label="Answered" value={families ? Math.round((total / families) * 100) + '%' : '—'} />
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
          <h2 className="text-sm font-bold text-[var(--text-primary)] mb-3">By source</h2>
          {!rows.length && <p className="text-sm text-[var(--text-dim)] py-4 text-center">No answers yet. They start coming in once families see the welcome question.</p>}
          <div className="space-y-2.5">
            {rows.map(({ k, n, o }) => {
              const Icon = o?.Icon
              return (
                <button key={k} onClick={() => setFilter(filter === k ? '' : k)} className={`w-full text-left rounded-lg px-2 py-1.5 -mx-2 transition-colors ${filter === k ? 'bg-violet-500/10' : 'hover:bg-[var(--bg-hover)]'}`}>
                  <div className="flex items-center gap-2 text-sm">
                    {Icon && <Icon size={15} className="text-[var(--text-dim)] shrink-0" />}
                    <span className="text-[var(--text-primary)] font-medium">{o?.label || k}</span>
                    <span className="ml-auto tabular-nums text-[var(--text-primary)] font-semibold">{n}</span>
                    <span className="w-11 text-right tabular-nums text-xs text-[var(--text-dim)]">{Math.round((n / total) * 100)}%</span>
                  </div>
                  <div className="mt-1.5 h-2 rounded-full bg-[var(--bg-inset)] overflow-hidden">
                    <div className="h-full rounded-full bg-violet-500" style={{ width: `${Math.max(3, (n / max) * 100)}%` }} />
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="text-sm font-bold text-[var(--text-primary)]">What they wrote{filter ? ` · ${BY_KEY[filter]?.label || filter}` : ''}</h2>
            {filter && <button onClick={() => setFilter('')} className="text-xs font-semibold text-violet-400">Show all</button>}
          </div>
          {!withDetail.length && <p className="text-sm text-[var(--text-dim)] py-3 text-center">Nothing written yet. YouTube, Friend or family and Other ask for a detail.</p>}
          <div className="divide-y divide-[var(--border-light)]">
            {withDetail.map((r, i) => (
              <div key={i} className="flex items-baseline gap-3 py-2 text-sm">
                <span className="w-24 shrink-0 text-xs text-[var(--text-dim)] tabular-nums">{fmtDate(r.date)}</span>
                <span className="w-28 shrink-0 text-xs font-semibold text-[var(--text-muted)] truncate">{BY_KEY[r.via]?.label || r.via}</span>
                <span className="min-w-0 text-[var(--text-primary)] break-words">{r.detail}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-[var(--text-dim)]">Counts start from the day the welcome question went live. Bug reports and feature requests arrive by email at capital.friends.dev@gmail.com.</p>
      </>)}
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-3 py-3">
      <p className="text-xs text-[var(--text-dim)]">{label}</p>
      <p className="text-xl font-bold text-[var(--text-primary)] tabular-nums mt-0.5">{value}</p>
    </div>
  )
}
