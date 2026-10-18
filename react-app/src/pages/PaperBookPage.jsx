import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Wallet, TrendingUp, Gauge, CalendarClock, Coins } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { getPaperBook } from '../services/api'

// Hidden admin page (/admin/paper): private paper-trading book. Only the admin email gets data (checked on the server too).
const inr = (v) => (v == null ? '—' : '₹' + Math.round(v).toLocaleString('en-IN'))
const pct = (v) => (v == null ? '—' : (v > 0 ? '+' : '') + Number(v).toFixed(1) + '%')
const tone = (v) => (v == null ? 'text-[var(--text-primary)]' : v >= 0 ? 'text-emerald-400' : 'text-[var(--accent-rose)]')
const day = (d) => (d ? new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')
const num = (v) => (v == null ? '—' : Number(v).toLocaleString('en-IN', { maximumFractionDigits: 2 }))

const TH = 'py-2 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider whitespace-nowrap'
const TD = 'py-2 px-3 text-sm text-[var(--text-secondary)] whitespace-nowrap tabular-nums'

function Stat({ icon: Icon, color, label, value, sub, valueClass }) {
  return (
    <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-3.5 min-w-0">
      <div className="flex items-center gap-2 mb-1.5">
        <div className={`w-6 h-6 rounded-md flex items-center justify-center ${color}`}><Icon size={13} /></div>
        <p className="text-xs text-[var(--text-dim)] font-medium truncate">{label}</p>
      </div>
      <p className={`text-lg font-bold tabular-nums truncate ${valueClass || 'text-[var(--text-primary)]'}`}>{value}</p>
      {sub && <p className="text-xs text-[var(--text-dim)] truncate">{sub}</p>}
    </div>
  )
}

export default function PaperBookPage() {
  const { isAdmin } = useAuth()
  const [data, setData] = useState(undefined)
  const [err, setErr] = useState('')
  const [book, setBook] = useState('lump')

  useEffect(() => {
    if (!isAdmin) return
    getPaperBook().then((d) => setData(d || null)).catch((e) => setErr(e.message || 'Could not load'))
  }, [isAdmin])

  const b = data?.books?.[book]
  const view = useMemo(() => {
    if (!b) return null
    const hold = b.holdings || []
    const gold = hold.filter((h) => h[0] === 'GOLDBEES').reduce((a, h) => a + h[4], 0)
    const stocks = hold.filter((h) => h[0] !== 'GOLDBEES').reduce((a, h) => a + h[4], 0)
    const liquid = Math.max(0, (b.nav || 0) - gold - stocks)
    return { hold, gold, stocks, liquid, held: new Set(hold.map((h) => h[0])), maxW: Math.max(1, ...hold.filter((h) => h[0] !== 'GOLDBEES').map((h) => h[6])) }
  }, [b])

  if (!isAdmin) return <Navigate to="/dashboard" replace />
  if (err) return <p className="text-sm text-[var(--accent-rose)] p-4">{err}</p>
  if (data === undefined) return <p className="text-sm text-[var(--text-dim)] p-4">Loading…</p>
  if (!data || !view) return <p className="text-sm text-[var(--text-dim)] p-4">No paper-book snapshot yet. It appears after the next scheduled run.</p>

  const half = b.x < 1
  const ret = book === 'sip' ? b.xirr : b.ret_pct
  const tot = Math.max(1, b.nav)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1 bg-[var(--bg-inset)] rounded-lg p-0.5">
          {[['lump', '₹10L lump sum'], ['sip', '₹1L monthly SIP']].map(([k, l]) => (
            <button key={k} onClick={() => setBook(k)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${book === k ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}>
              {l}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className={`px-2.5 py-1 rounded-lg font-semibold ${half ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
            {half ? 'Half-cut on · stocks 50%' : 'Fully invested'}
          </span>
          <span className="text-[var(--text-dim)]">Prices {day(data.updated)}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Stat icon={Wallet} color="text-violet-400 bg-violet-500/15" label="Value" value={inr(b.nav)} sub={`Invested ${inr(b.invested)}`} />
        <Stat icon={TrendingUp} color="text-emerald-400 bg-emerald-500/15" label="Gain" value={inr(b.gain)} valueClass={tone(b.gain)} sub={`${pct(ret)}${book === 'sip' ? ' XIRR' : ''}`} />
        <Stat icon={Gauge} color="text-amber-400 bg-amber-500/15" label="Stocks / Gold / Liquid"
          value={`${Math.round((view.stocks / tot) * 100)} / ${Math.round((view.gold / tot) * 100)} / ${Math.round((view.liquid / tot) * 100)}`} sub="% of value" />
        <Stat icon={Coins} color="text-sky-400 bg-sky-500/15" label="vs Nifty 500 TRI" value={b.bench ? pct((b.nav / b.bench - 1) * 100) : '—'} valueClass={b.bench ? tone(b.nav - b.bench) : ''} sub={b.bench ? `Index ${inr(b.bench)}` : ''} />
        <Stat icon={CalendarClock} color="text-rose-400 bg-rose-500/15" label="Next rebalance" value={day(data.next_rebalance)} sub="first trading day" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 bg-[var(--bg-card)] rounded-xl border border-[var(--border)] overflow-hidden">
          <div className="px-4 py-2.5 border-b border-[var(--border-light)] flex items-center justify-between">
            <h3 className="text-sm font-bold text-[var(--text-primary)]">Holdings</h3>
            <span className="text-xs text-[var(--text-dim)]">{view.hold.length - (view.held.has('GOLDBEES') ? 1 : 0)} stocks + gold</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border-light)] bg-[var(--bg-inset)]">
                  <th className={`${TH} text-left`}>Stock</th><th className={`${TH} text-right`}>Qty</th><th className={`${TH} text-right`}>Avg</th>
                  <th className={`${TH} text-right`}>Price</th><th className={`${TH} text-right`}>Value</th><th className={`${TH} text-right`}>P&amp;L</th>
                  <th className={`${TH} text-left`}>Weight</th><th className={`${TH} text-right`}>Rank</th>
                </tr>
              </thead>
              <tbody>
                {view.hold.map(([s, q, avg, px, val, pnl, w, rank]) => {
                  const g = s === 'GOLDBEES'
                  return (
                    <tr key={s} className={`border-b border-[var(--border-row)] last:border-0 hover:bg-[var(--bg-hover)] ${g ? 'bg-amber-500/5' : ''}`}>
                      <td className={`${TD} text-left font-semibold ${g ? 'text-amber-400' : 'text-[var(--text-primary)]'}`}>{s}</td>
                      <td className={`${TD} text-right`}>{num(q)}</td>
                      <td className={`${TD} text-right`}>{num(avg)}</td>
                      <td className={`${TD} text-right`}>{num(px)}</td>
                      <td className={`${TD} text-right text-[var(--text-primary)]`}>{inr(val)}</td>
                      <td className={`${TD} text-right font-semibold ${tone(pnl)}`}>{pct(pnl)}</td>
                      <td className={`${TD} text-left`}>
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-[var(--bg-inset)] overflow-hidden">
                            <div className={`h-full rounded-full ${g ? 'bg-amber-400' : 'bg-violet-400'}`} style={{ width: `${g ? 100 : Math.min(100, (w / view.maxW) * 100)}%` }} />
                          </div>
                          <span className="text-xs">{w}%</span>
                        </div>
                      </td>
                      <td className={`${TD} text-right`}>{g ? '—' : rank ?? '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] overflow-hidden">
          <div className="px-4 py-2.5 border-b border-[var(--border-light)] flex items-center justify-between">
            <h3 className="text-sm font-bold text-[var(--text-primary)]">Top 40 ranks</h3>
            <span className="text-xs text-emerald-400 font-semibold">● held</span>
          </div>
          <div className="overflow-y-auto xl:max-h-[640px]">
            <table className="w-full">
              <thead className="sticky top-0">
                <tr className="border-b border-[var(--border-light)] bg-[var(--bg-inset)]">
                  <th className={`${TH} text-right w-10`}>#</th><th className={`${TH} text-left`}>Stock</th><th className={`${TH} text-right`}>Score</th>
                </tr>
              </thead>
              <tbody>
                {(data.ranks || []).map(([s, r, sc]) => {
                  const h = view.held.has(s)
                  return (
                    <tr key={s} className={`border-b border-[var(--border-row)] last:border-0 ${r === 20 ? 'border-b-2 border-b-[var(--border)]' : ''}`}>
                      <td className={`${TD} text-right text-[var(--text-dim)]`}>{r}</td>
                      <td className={`${TD} text-left font-semibold ${h ? 'text-emerald-400' : 'text-[var(--text-primary)]'}`}>{h ? '● ' : ''}{s}</td>
                      <td className={`${TD} text-right`}>{sc}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <p className="text-xs text-[var(--text-dim)]">Paper trading only · information, not advice</p>
    </div>
  )
}
