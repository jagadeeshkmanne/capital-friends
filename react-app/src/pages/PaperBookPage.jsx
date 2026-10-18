import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getPaperBook } from '../services/api'

// Hidden admin page (/admin/paper): private paper-trading book. Only the admin email gets data (checked on the server too).
const inr = (v) => (v == null ? '—' : '₹' + Math.round(v).toLocaleString('en-IN'))
const pct = (v) => (v == null ? '—' : (v > 0 ? '+' : '') + Number(v).toFixed(1) + '%')
const tone = (v) => (v == null ? '' : v >= 0 ? 'text-emerald-400' : 'text-rose-400')
const day = (d) => (d ? new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')

function Card({ title, right, children }) {
  return (
    <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] overflow-hidden">
      <div className="px-4 py-2.5 border-b border-[var(--border-light)] bg-[var(--bg-inset)] flex items-center justify-between gap-2">
        <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">{title}</h3>
        {right}
      </div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  )
}

const th = 'px-3 py-2 text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wide whitespace-nowrap'
const td = 'px-3 py-1.5 text-xs text-[var(--text-secondary)] whitespace-nowrap tabular-nums'

export default function PaperBookPage() {
  const { isAdmin } = useAuth()
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')
  const [book, setBook] = useState('lump')

  useEffect(() => {
    if (!isAdmin) return
    getPaperBook().then(setData).catch((e) => setErr(e.message || 'Could not load'))
  }, [isAdmin])

  if (!isAdmin) return <Navigate to="/dashboard" replace />
  if (err) return <p className="text-sm text-rose-400 p-4">{err}</p>
  if (!data) return <p className="text-sm text-[var(--text-dim)] p-4">Loading…</p>

  const b = data.books?.[book] || {}
  const held = new Set((b.holdings || []).map((h) => h[0]))
  const half = b.x < 1

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-base font-bold text-[var(--text-primary)] mr-auto">Paper book</h1>
        {['lump', 'sip'].map((k) => (
          <button key={k} onClick={() => setBook(k)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${book === k ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'border-[var(--border)] text-[var(--text-muted)]'}`}>
            {k === 'lump' ? '₹10L lump sum' : '₹1L SIP'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          ['Value', inr(b.nav), ''],
          ['Gain', `${inr(b.gain)} (${pct(b.ret_pct)})`, tone(b.gain)],
          ['Stocks', `${Math.round((b.x || 0) * 100)}%${half ? ' · half-cut' : ''}`, half ? 'text-amber-400' : ''],
          ['Next rebalance', day(data.next_rebalance), ''],
        ].map(([l, v, c]) => (
          <div key={l} className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] px-3 py-2.5 min-w-0">
            <p className="text-[11px] text-[var(--text-dim)] uppercase tracking-wide">{l}</p>
            <p className={`text-sm font-semibold text-[var(--text-primary)] truncate ${c}`}>{v}</p>
          </div>
        ))}
      </div>

      <Card title="Holdings" right={<span className="text-[11px] text-[var(--text-dim)]">prices {day(data.updated)}</span>}>
        <table className="w-full text-left">
          <thead><tr><th className={th}>Stock</th><th className={`${th} text-right`}>Qty</th><th className={`${th} text-right`}>Avg</th><th className={`${th} text-right`}>Price</th><th className={`${th} text-right`}>Value</th><th className={`${th} text-right`}>P&amp;L</th><th className={`${th} text-right`}>Wt</th><th className={`${th} text-right`}>Rank</th></tr></thead>
          <tbody>
            {(b.holdings || []).map(([s, q, avg, px, val, pnl, w, rank]) => (
              <tr key={s} className="border-t border-[var(--border-row)]">
                <td className={`${td} font-semibold text-[var(--text-primary)]`}>{s}</td>
                <td className={`${td} text-right`}>{q}</td>
                <td className={`${td} text-right`}>{avg}</td>
                <td className={`${td} text-right`}>{px}</td>
                <td className={`${td} text-right`}>{inr(val)}</td>
                <td className={`${td} text-right ${tone(pnl)}`}>{pct(pnl)}</td>
                <td className={`${td} text-right`}>{w}%</td>
                <td className={`${td} text-right`}>{s === 'GOLDBEES' ? 'gold' : rank ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card title="Top 40 momentum ranks" right={<span className="text-[11px] text-[var(--text-dim)]">● held</span>}>
        <table className="w-full text-left">
          <thead><tr><th className={th}>#</th><th className={th}>Stock</th><th className={`${th} text-right`}>Score</th></tr></thead>
          <tbody>
            {(data.ranks || []).map(([s, r, sc]) => (
              <tr key={s} className="border-t border-[var(--border-row)]">
                <td className={td}>{r}</td>
                <td className={`${td} font-semibold ${held.has(s) ? 'text-emerald-400' : 'text-[var(--text-primary)]'}`}>{held.has(s) ? '● ' : ''}{s}</td>
                <td className={`${td} text-right`}>{sc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
