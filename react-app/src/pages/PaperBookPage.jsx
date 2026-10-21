import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import Modal from '../components/Modal'
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

// ── price charts (1 year of daily closes from the snapshot, live price appended) ──
const RANGES = [['1M', 21], ['3M', 63], ['6M', 126], ['1Y', 252]]
function series(data, sym, livePrice, n) {
  const c = data?.charts?.[sym]; if (!c) return null
  const d = data.chart_dates || []
  const pts = c.map((v, i) => [d[i], v]).filter((p) => p[1] != null).slice(-n)
  if (livePrice && pts.length && Math.abs(livePrice / pts[pts.length - 1][1] - 1) > 1e-6) pts.push(['live', livePrice])
  return pts.length > 1 ? pts : null
}

function Spark({ pts }) {
  if (!pts) return <span className="text-[var(--text-dim)]">—</span>
  const W = 84, H = 24, v = pts.map((p) => p[1]), lo = Math.min(...v), hi = Math.max(...v), r = hi - lo || 1
  const xy = v.map((y, i) => `${((i / (v.length - 1)) * W).toFixed(1)},${(H - 2 - ((y - lo) / r) * (H - 4)).toFixed(1)}`).join(' ')
  const up = v[v.length - 1] >= v[0]
  return <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block"><polyline points={xy} fill="none" strokeWidth="1.5" strokeLinejoin="round" className={up ? 'stroke-emerald-400' : 'stroke-rose-400'} /></svg>
}

function BigChart({ data, sym, livePrice, onClose }) {
  const [rk, setRk] = useState('6M')
  const [hover, setHover] = useState(null)
  const pts = series(data, sym, livePrice, RANGES.find((r) => r[0] === rk)[1])
  const W = 720, H = 280, L = 8, R = 64, T = 12, B = 26
  let body = <p className="text-sm text-[var(--text-dim)] py-10 text-center">No price history for {sym}.</p>
  if (pts) {
    const v = pts.map((p) => p[1]), lo = Math.min(...v), hi = Math.max(...v), pad = (hi - lo) * 0.06 || hi * 0.01
    const y0 = lo - pad, y1 = hi + pad
    const X = (i) => L + ((W - L - R) * i) / (pts.length - 1), Y = (y) => T + (H - T - B) * (1 - (y - y0) / (y1 - y0))
    const up = v[v.length - 1] >= v[0], chg = (v[v.length - 1] / v[0] - 1) * 100
    const line = pts.map((p, i) => `${X(i).toFixed(1)},${Y(p[1]).toFixed(1)}`).join(' ')
    const h = hover != null ? pts[hover] : pts[pts.length - 1]
    const lab = (d) => (d === 'live' ? 'Now' : day(d))
    const onMove = (e) => {
      const r = e.currentTarget.getBoundingClientRect(), x = ((e.clientX - r.left) / r.width) * W
      setHover(Math.max(0, Math.min(pts.length - 1, Math.round(((x - L) / (W - L - R)) * (pts.length - 1)))))
    }
    body = (
      <div>
        <div className="flex items-end justify-between gap-3 mb-2">
          <div>
            <p className="text-2xl font-bold tabular-nums text-[var(--text-primary)]">₹{num(h[1])}</p>
            <p className="text-xs text-[var(--text-dim)]">{lab(h[0])}</p>
          </div>
          <p className={`text-sm font-semibold tabular-nums ${up ? 'text-emerald-400' : 'text-[var(--accent-rose)]'}`}>{pct(chg)} <span className="text-[var(--text-dim)] font-normal">in {rk}</span></p>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto touch-none" onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
          {[hi, (hi + lo) / 2, lo].map((y) => (
            <g key={y}><line x1={L} x2={W - R} y1={Y(y)} y2={Y(y)} stroke="var(--border)" strokeDasharray="3 4" />
              <text x={W - R + 6} y={Y(y) + 4} fontSize="11" fill="var(--text-dim)">{num(Math.round(y * 100) / 100)}</text></g>
          ))}
          <polygon points={`${X(0)},${Y(y0)} ${line} ${X(pts.length - 1)},${Y(y0)}`} className={up ? 'fill-emerald-400/10' : 'fill-rose-400/10'} />
          <polyline points={line} fill="none" strokeWidth="2" strokeLinejoin="round" className={up ? 'stroke-emerald-400' : 'stroke-rose-400'} />
          {hover != null && <g><line x1={X(hover)} x2={X(hover)} y1={T} y2={H - B} stroke="var(--text-dim)" strokeWidth="1" />
            <circle cx={X(hover)} cy={Y(pts[hover][1])} r="4" className={up ? 'fill-emerald-400' : 'fill-rose-400'} /></g>}
          <text x={L} y={H - 8} fontSize="11" fill="var(--text-dim)">{lab(pts[0][0])}</text>
          <text x={W - R} y={H - 8} fontSize="11" fill="var(--text-dim)" textAnchor="end">{lab(pts[pts.length - 1][0])}</text>
        </svg>
      </div>
    )
  }
  return createPortal(
    <Modal open onClose={onClose} title={sym} wide>
      <div className="p-4 space-y-3">
        {body}
        <div className="flex gap-1 bg-[var(--bg-inset)] rounded-lg p-0.5 w-fit">
          {RANGES.map(([k]) => (
            <button key={k} onClick={() => { setRk(k); setHover(null) }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md ${rk === k ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-muted)]'}`}>{k}</button>
          ))}
        </div>
        <p className="text-[11px] text-[var(--text-dim)]">Daily closes, adjusted for splits and bonuses{livePrice ? '; last point is the live price' : ''}.</p>
      </div>
    </Modal>, document.body)
}

const BOOK_LABEL = { A: 'A · Momentum', B: 'B · Momentum + Safety', C: 'C · Momentum + Quality', D: 'D · Top 10 Common', lump: '₹10L lump sum', sip: '₹1L monthly SIP' }
const BOOK_DOT = { A: 'bg-emerald-400', B: 'bg-violet-400', C: 'bg-blue-400', D: 'bg-amber-400' }
const Dot = ({ on, k }) => <span className={`inline-block w-2.5 h-2.5 rounded-full ${on ? BOOK_DOT[k] : 'border border-[var(--border)]'}`} />

/** Which stocks the three books share, and why B / C left some out (latest rebalance). */
function Overlap({ o, onPick }) {
  if (!o || !o.rows?.length) return null
  const v = o.venn || {}
  const why = (r) => [r.why_B && !r.held?.B ? `B skipped: ${r.why_B}` : null,
    r.crank_C && (r.held?.A !== r.held?.C || Math.abs(r.crank_C[0] - r.crank_C[1]) >= 5) ? `C: #${r.crank_C[0]} → #${r.crank_C[1]}${r.crank_C[2] != null ? ` · earnings ${r.crank_C[2]}/100` : ''}` : null,
    r.why_C && !r.held?.C ? `C: ${r.why_C}` : null].filter(Boolean)
  return (
    <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] overflow-hidden">
      <div className="px-4 py-2.5 border-b border-[var(--border-light)] flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-bold text-[var(--text-primary)]">Overlap between the books</h3>
        <span className="text-xs text-[var(--text-dim)]">{v.all3} in all three · A+B {v.AB} · A+C {v.AC} · B+C {v.BC} · only A {v.A} · only B {v.B} · only C {v.C}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--border-light)] bg-[var(--bg-inset)]">
              <th className={`${TH} text-left`}>Stock</th><th className={`${TH} text-right`}>Rank</th>
              {['A', 'B', 'C'].map((k) => <th key={k} className={`${TH} text-center w-10`}>{k}</th>)}
              <th className={`${TH} text-left`}>Why they differ</th>
            </tr>
          </thead>
          <tbody>
            {o.rows.map((r) => (
              <tr key={r.sym} onClick={() => onPick(r.sym)} className="border-b border-[var(--border-row)] last:border-0 cursor-pointer hover:bg-[var(--bg-hover)]">
                <td className={`${TD} text-left font-semibold text-[var(--text-primary)]`}>{r.sym}</td>
                <td className={`${TD} text-right text-[var(--text-dim)]`}>{r.rank ?? '—'}</td>
                {['A', 'B', 'C'].map((k) => <td key={k} className={`${TD} text-center`}><Dot on={r.held?.[k]} k={k} /></td>)}
                <td className={`${TD} text-left text-xs text-[var(--text-muted)] whitespace-normal`}>{why(r).join(' · ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function PaperBookPage() {
  const { isAdmin } = useAuth()
  const [data, setData] = useState(undefined)
  const [err, setErr] = useState('')
  const [book, setBook] = useState('A')
  const [live, setLive] = useState(null)
  const [liveBusy, setLiveBusy] = useState(false)
  const [liveErr, setLiveErr] = useState('')
  const [chartSym, setChartSym] = useState(null)
  const livePx = (s) => live?.prices?.[s]?.price

  const loadLive = (d) => {
    const syms = [...new Set(Object.values(d?.books || {}).flatMap((bk) => (bk.holdings || []).map((h) => h[0])).filter((x) => x !== 'LIQUIDCASE'))]
    if (!syms.length) return
    setLiveBusy(true)
    setLiveErr('')
    getPaperLive(syms).then((r) => { setLive(r); if (r && !Object.keys(r.prices || {}).length) setLiveErr('no prices returned') })
      .catch((e) => { setLive(null); setLiveErr(e.message || 'failed') }).finally(() => setLiveBusy(false))
  }

  useEffect(() => {
    if (!isAdmin) return
    getPaperBook().then((d) => { setData(d || null); if (d) loadLive(d) }).catch((e) => setErr(e.message || 'Could not load'))
  }, [isAdmin])

  const keys = Object.keys(data?.books || {})
  const bk = data?.books?.[book] ? book : keys[0]
  const b = data?.books?.[bk]
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
  if (!data) return <p className="text-sm text-[var(--text-dim)] p-4">No paper-book snapshot yet. It appears after the next scheduled run.</p>
  if (!view) return <p className="text-sm text-[var(--text-dim)] p-4">{data.start_on ? `The three paper books (A momentum, B earnings filter, C earnings re-rank) open together on ${day(data.start_on)}. Prices are kept up to date until then.` : 'No paper-book snapshot yet. It appears after the next scheduled run.'}</p>

  const half = b.x < 1
  const ret = bk === 'sip' ? b.xirr : b.ret_pct
  const sets = Object.fromEntries(Object.entries(data.overlap?.sets || {}).map(([k, v]) => [k, new Set(v)]))
  const tot = Math.max(1, view.liveNav)
  const liveAt = live?.at ? new Date(live.at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : null

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1 bg-[var(--bg-inset)] rounded-lg p-0.5">
          {keys.map((k) => [k, BOOK_LABEL[k] || k]).map(([k, l]) => (
            <button key={k} onClick={() => setBook(k)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${bk === k ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}>
              {l}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className={`px-2.5 py-1 rounded-lg font-semibold ${half ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
            {half ? 'Half-cut on · stocks 50%' : 'Fully invested'}
          </span>
          <span className="text-[var(--text-dim)]">{liveAt ? `Live ${liveAt}` : `Closing prices ${day(data.updated)}`}</span>
          <button onClick={() => loadLive(data)} disabled={liveBusy} title="Refresh live prices"
            className="p-1.5 rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-50">
            <RefreshCw size={13} className={liveBusy ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-3">
        <Stat icon={Wallet} color="text-violet-400 bg-violet-500/15" label="Value now" value={inr(view.liveNav)} sub={`At last close ${inr(b.nav)}`} />
        <Stat icon={Activity} color="text-cyan-400 bg-cyan-500/15" label="Today" value={`${view.today >= 0 ? '+' : '−'}${inr(Math.abs(view.today))}`} valueClass={tone(view.today)} sub={live ? pct(view.todayPct) : liveBusy ? 'loading live prices…' : `live prices failed${liveErr ? ': ' + liveErr : ''}`} />
        <Stat icon={TrendingUp} color="text-emerald-400 bg-emerald-500/15" label="Gain" value={inr(view.liveNav - b.invested)} valueClass={tone(view.liveNav - b.invested)} sub={`${pct(((view.liveNav / b.invested) - 1) * 100)} on ${inr(b.invested)}${bk === 'sip' && ret != null ? ` · XIRR ${pct(ret)}` : ''}`} />
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
                  <th className={`${TH} text-left`}>Stock</th><th className={`${TH} text-left`}>6M</th><th className={`${TH} text-right`}>Qty</th><th className={`${TH} text-right`}>Avg</th>
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
                    <tr key={s} onClick={() => !lq && setChartSym(s)} className={`border-b border-[var(--border-row)] last:border-0 hover:bg-[var(--bg-hover)] ${lq ? '' : 'cursor-pointer'} ${g ? 'bg-amber-500/5' : lq ? 'bg-sky-500/5' : ''}`}>
                      <td className={`${TD} text-left font-semibold ${g ? 'text-amber-400' : lq ? 'text-sky-400' : 'text-[var(--text-primary)]'}`}>{s}{lq && <span className="ml-1.5 text-[10px] font-medium text-[var(--text-dim)]">liquid</span>}</td>
                      <td className={`${TD} text-left`}>{lq ? '' : <Spark pts={series(data, s, livePx(s), 126)} />}</td>
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
                  <th className={`${TH} text-right w-10`}>#</th><th className={`${TH} text-left`}>Stock</th><th className={`${TH} text-left`}>6M</th><th className={`${TH} text-right`}>Score</th>
                  {data.overlap && ['A', 'B', 'C'].map((k) => <th key={k} className={`${TH} text-center w-7`}>{k}</th>)}
                </tr>
              </thead>
              <tbody>
                {(data.ranks || []).map(([s, r, sc]) => {
                  const h = view.held.has(s)
                  return (
                    <tr key={s} onClick={() => setChartSym(s)} className={`border-b border-[var(--border-row)] last:border-0 cursor-pointer hover:bg-[var(--bg-hover)] ${r === 20 ? 'border-b-2 border-b-[var(--border)]' : ''}`}>
                      <td className={`${TD} text-right text-[var(--text-dim)]`}>{r}</td>
                      <td className={`${TD} text-left font-semibold ${h ? 'text-emerald-400' : 'text-[var(--text-primary)]'}`}>{h ? '● ' : ''}{s}</td>
                      <td className={`${TD} text-left`}><Spark pts={series(data, s, livePx(s), 126)} /></td>
                      <td className={`${TD} text-right`}>{sc}</td>
                      {data.overlap && ['A', 'B', 'C'].map((k) => <td key={k} className={`${TD} text-center`}><Dot on={sets[k]?.has(s)} k={k} /></td>)}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {data.overlap && <Overlap o={data.overlap} onPick={setChartSym} />}
      <p className="text-xs text-[var(--text-dim)]">Tap a stock for its chart · paper trading only · information, not advice</p>
      {chartSym && <BigChart data={data} sym={chartSym} livePrice={livePx(chartSym)} onClose={() => setChartSym(null)} />}
    </div>
  )
}
