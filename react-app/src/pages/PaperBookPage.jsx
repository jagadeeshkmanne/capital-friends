import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Wallet, TrendingUp, Gauge, CalendarClock, Coins, Activity, RefreshCw } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { getPaperBook, getPaperLive } from '../services/api'

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
  const [live, setLive] = useState(null)
  const [liveBusy, setLiveBusy] = useState(false)

  const loadLive = (d) => {
    const syms = [...new Set(Object.values(d?.books || {}).flatMap((bk) => (bk.holdings || []).map((h) => h[0])).filter((x) => x !== 'LIQUIDCASE'))]
    if (!syms.length) return
    setLiveBusy(true)
    getPaperLive(syms).then(setLive).catch(() => setLive(null)).finally(() => setLiveBusy(false))
  }

  useEffect(() => {
    if (!isAdmin) return
    getPaperBook().then((d) => { setData(d || null); if (d) loadLive(d) }).catch((e) => setErr(e.message || 'Could not load'))
  }, [isAdmin])

  const b = data?.books?.[book]
  const view = useMemo(() => {
    if (!b) return null
    const lp = live?.prices || {}
    const hold = (b.holdings || []).map((h) => {
      const [s, q, , px, val] = h
      const L = s === 'LIQUIDCASE' ? null : lp[s]
      const price = L ? L.price : px
      const prev = L && L.prev ? L.prev : price
      const value = s === 'LIQUIDCASE' ? val : q * price
      return { row: h, price, value, today: s === 'LIQUIDCASE' ? 0 : q * (price - prev), todayPct: L && L.prev ? (price / L.prev - 1) * 100 : null }
    })
    const liveNav = hold.reduce((a, h) => a + h.value, 0)
    const today = hold.reduce((a, h) => a + h.today, 0)
    const gold = hold.filter((h) => h.row[0] === 'GOLDBEES').reduce((a, h) => a + h.value, 0)
    const isStock = (h) => h.row[0] !== 'GOLDBEES' && h.row[0] !== 'LIQUIDCASE'
    const stocks = hold.filter(isStock).reduce((a, h) => a + h.value, 0)
    const liquid = Math.max(0, liveNav - gold - stocks)
    const nStocks = hold.filter(isStock).length
    return { hold, gold, stocks, liquid, nStocks, liveNav, today, todayPct: liveNav - today > 0 ? (today / (liveNav - today)) * 100 : 0,
      held: new Set(hold.map((h) => h.row[0])), maxW: Math.max(1, ...hold.filter(isStock).map((h) => h.row[6])) }
  }, [b, live])

  if (!isAdmin) return <Navigate to="/dashboard" replace />
  if (err) return <p className="text-sm text-[var(--accent-rose)] p-4">{err}</p>
  if (data === undefined) return <p className="text-sm text-[var(--text-dim)] p-4">Loading…</p>
  if (!data || !view) return <p className="text-sm text-[var(--text-dim)] p-4">No paper-book snapshot yet. It appears after the next scheduled run.</p>

  const half = b.x < 1
  const ret = book === 'sip' ? b.xirr : b.ret_pct
  const tot = Math.max(1, view.liveNav)
  const liveAt = live?.at ? new Date(live.at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : null

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
          <span className="text-[var(--text-dim)]">{liveAt ? `Live ${liveAt} · ~15 min delay` : `Closing prices ${day(data.updated)}`}</span>
          <button onClick={() => loadLive(data)} disabled={liveBusy} title="Refresh live prices"
            className="p-1.5 rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-50">
            <RefreshCw size={13} className={liveBusy ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-3">
        <Stat icon={Wallet} color="text-violet-400 bg-violet-500/15" label="Value now" value={inr(view.liveNav)} sub={`At last close ${inr(b.nav)}`} />
        <Stat icon={Activity} color="text-cyan-400 bg-cyan-500/15" label="Today" value={`${view.today >= 0 ? '+' : '−'}${inr(Math.abs(view.today))}`} valueClass={tone(view.today)} sub={live ? pct(view.todayPct) : 'live prices not loaded'} />
        <Stat icon={TrendingUp} color="text-emerald-400 bg-emerald-500/15" label="Gain" value={inr(view.liveNav - b.invested)} valueClass={tone(view.liveNav - b.invested)} sub={`${pct(((view.liveNav / b.invested) - 1) * 100)} on ${inr(b.invested)}${book === 'sip' && ret != null ? ` · XIRR ${pct(ret)}` : ''}`} />
        <Stat icon={Gauge} color="text-amber-400 bg-amber-500/15" label="Stocks / Gold / Liquid"
          value={`${Math.round((view.stocks / tot) * 100)} / ${Math.round((view.gold / tot) * 100)} / ${Math.round((view.liquid / tot) * 100)}`} sub="% of value" />
        <Stat icon={Coins} color="text-sky-400 bg-sky-500/15" label="vs Nifty 500 TRI" value={b.bench ? pct((b.nav / b.bench - 1) * 100) : '—'} valueClass={b.bench ? tone(b.nav - b.bench) : ''} sub={b.bench ? `Index ${inr(b.bench)}` : ''} />
        <Stat icon={CalendarClock} color="text-rose-400 bg-rose-500/15" label="Next rebalance" value={day(data.next_rebalance)} sub="first trading day" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 bg-[var(--bg-card)] rounded-xl border border-[var(--border)] overflow-hidden">
          <div className="px-4 py-2.5 border-b border-[var(--border-light)] flex items-center justify-between">
            <h3 className="text-sm font-bold text-[var(--text-primary)]">Holdings</h3>
            <span className="text-xs text-[var(--text-dim)]">{view.nStocks} stocks + gold + liquid</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border-light)] bg-[var(--bg-inset)]">
                  <th className={`${TH} text-left`}>Stock</th><th className={`${TH} text-right`}>Qty</th><th className={`${TH} text-right`}>Avg</th>
                  <th className={`${TH} text-right`}>Price</th><th className={`${TH} text-right`}>Today</th><th className={`${TH} text-right`}>Value</th><th className={`${TH} text-right`}>P&amp;L</th>
                  <th className={`${TH} text-left`}>Weight</th><th className={`${TH} text-right`}>Rank</th>
                </tr>
              </thead>
              <tbody>
                {view.hold.map(({ row: [s, q, avg, , , , , rank], price, value, todayPct }) => {
                  const g = s === 'GOLDBEES', lq = s === 'LIQUIDCASE'
                  const pnl = avg ? (price / avg - 1) * 100 : null
                  const w = Math.round((value / tot) * 1000) / 10
                  return (
                    <tr key={s} className={`border-b border-[var(--border-row)] last:border-0 hover:bg-[var(--bg-hover)] ${g ? 'bg-amber-500/5' : lq ? 'bg-sky-500/5' : ''}`}>
                      <td className={`${TD} text-left font-semibold ${g ? 'text-amber-400' : lq ? 'text-sky-400' : 'text-[var(--text-primary)]'}`}>{s}{lq && <span className="ml-1.5 text-[10px] font-medium text-[var(--text-dim)]">liquid</span>}</td>
                      <td className={`${TD} text-right`}>{num(q)}</td>
                      <td className={`${TD} text-right`}>{num(avg)}</td>
                      <td className={`${TD} text-right`}>{num(price)}</td>
                      <td className={`${TD} text-right ${tone(todayPct)}`}>{todayPct == null ? '—' : pct(todayPct)}</td>
                      <td className={`${TD} text-right text-[var(--text-primary)]`}>{inr(value)}</td>
                      <td className={`${TD} text-right font-semibold ${tone(pnl)}`}>{pct(pnl)}</td>
                      <td className={`${TD} text-left`}>
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-[var(--bg-inset)] overflow-hidden">
                            <div className={`h-full rounded-full ${g ? 'bg-amber-400' : lq ? 'bg-sky-400' : 'bg-violet-400'}`} style={{ width: `${g || lq ? 100 : Math.min(100, (w / view.maxW) * 100)}%` }} />
                          </div>
                          <span className="text-xs">{w}%</span>
                        </div>
                      </td>
                      <td className={`${TD} text-right`}>{g || lq ? '—' : rank ?? '—'}</td>
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
