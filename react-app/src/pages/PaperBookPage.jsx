import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Modal from '../components/Modal'
import { Navigate } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { getPaperBook, getPaperLive } from '../services/api'

// Hidden admin page (/admin/paper): private paper-trading book. Only the admin email gets data (checked on the server too).
const inr = (v) => (v == null ? '—' : '₹' + Math.round(v).toLocaleString('en-IN'))
const pct = (v) => (v == null ? '—' : (v > 0 ? '+' : '') + Number(v).toFixed(1) + '%')
const pct2 = (v) => (v == null ? '—' : Math.abs(v) < 1 ? (v > 0 ? '+' : '') + Number(v).toFixed(2) + '%' : pct(v))   // small moves: 2 decimals so +₹112 is not shown as +0.0%
const tone = (v) => (v == null ? 'text-[var(--text-primary)]' : v >= 0 ? 'text-emerald-400' : 'text-[var(--accent-rose)]')
const day = (d) => (d ? new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')
// NSE cash market hours (Mon-Fri 9:15-15:30 IST): live prices refresh every minute only then
const marketOpen = () => {
  const t = new Date(Date.now() + 5.5 * 3600e3), d = t.getUTCDay(), m = t.getUTCHours() * 60 + t.getUTCMinutes()
  return d >= 1 && d <= 5 && m >= 555 && m <= 930
}
const num = (v) => (v == null ? '—' : Number(v).toLocaleString('en-IN', { maximumFractionDigits: 2 }))

const TH = 'py-2 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider whitespace-nowrap'
const TD = 'py-2 px-3 text-sm text-[var(--text-secondary)] whitespace-nowrap tabular-nums'


// ── price charts (1 year of daily closes from the snapshot, live price appended) ──
const RANGES = [['1M', 21], ['3M', 63], ['6M', 126], ['1Y', 252]]
function series(data, sym, livePrice, n) {
  const c = data?.charts?.[sym]; if (!c) return null
  const d = data.chart_dates || []
  const pts = c.map((v, i) => [d[i], v]).filter((p) => p[1] != null).slice(-n)
  if (livePrice && pts.length && Math.abs(livePrice / pts[pts.length - 1][1] - 1) > 1e-6) pts.push(['live', livePrice])
  return pts.length > 1 ? pts : null
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

const BOOK_DOT = { A: 'bg-emerald-400', B: 'bg-violet-400', C: 'bg-blue-400', D: 'bg-amber-400', E: 'bg-pink-400' }
const BOOK_RING = { A: 'ring-emerald-400 border-emerald-400', B: 'ring-violet-400 border-violet-400', C: 'ring-blue-400 border-blue-400', D: 'ring-amber-400 border-amber-400', E: 'ring-pink-400 border-pink-400' }
const BOOK_NAME = { A: 'Momentum', B: 'Momentum + Safety', C: 'Momentum + Quality', D: 'Top 10 Common', E: 'Momentum · Top 1000' }
// value of a book at live prices (falls back to the last close for anything without a live price)
const liveValue = (b, lp) => (b?.holdings || []).reduce((a, [s, q, , px, val]) => a + (s === 'LIQUIDCASE' ? val : q * (lp?.[s]?.price ?? px)), 0)
const sgn = (v) => (v == null ? '' : v >= 0 ? '+' : '−')
const lakhs = (v) => (v == null ? '—' : '₹' + (Math.abs(v) / 1e5).toFixed(2) + ' L')

// clickable column header: first click sorts best-first, second click reverses
function SortTh({ k, sort, setSort, cls, title, children }) {
  const on = sort.k === k
  return (
    <th className={`${TH} ${cls} cursor-pointer select-none hover:text-[var(--text-primary)] ${on ? 'text-[var(--text-primary)]' : ''}`} title={title}
      onClick={() => setSort(on ? { k, d: -sort.d } : { k, d: 1 })}>
      {children}<span className={`ml-1 ${on ? 'opacity-80' : 'opacity-25'}`}>{on ? (sort.d > 0 ? '▲' : '▼') : '↕'}</span>
    </th>
  )
}

function Mini({ label, value, sub, tone: t, title }) {
  return (
    <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] px-4 py-3 min-w-0" title={title}>
      <p className="text-xs text-[var(--text-dim)] uppercase tracking-wider mb-1 truncate">{label}</p>
      <p className={`text-sm font-semibold tabular-nums truncate ${t || 'text-[var(--text-primary)]'}`}>{value}</p>
      {sub && <p className={`text-xs font-semibold tabular-nums mt-0.5 truncate ${t || 'text-[var(--text-dim)]'}`}>{sub}</p>}
    </div>
  )
}

/** Which stocks the three books share, and why B / C left some out (latest rebalance). */
export default function PaperBookPage() {
  const { isAdmin } = useAuth()
  const [data, setData] = useState(undefined)
  const [err, setErr] = useState('')
  const [book, setBook] = useState('A')
  const [live, setLive] = useState(null)
  const [liveBusy, setLiveBusy] = useState(false)
  const [liveErr, setLiveErr] = useState('')
  const [chartSym, setChartSym] = useState(null)
  const [flash, setFlash] = useState({})
  const [sort, setSort] = useState({ k: 'rank', d: 1 })   // holdings sort: rank (default), pnl, pnlPct, today, value, stock
  const [open, setOpen] = useState(marketOpen())
  const lastPx = useRef({})
  const livePx = (s) => live?.prices?.[s]?.price

  const loadLive = (d) => {
    const syms = [...new Set(Object.values(d?.books || {}).flatMap((bk) => (bk.holdings || []).map((h) => h[0])).filter((x) => x !== 'LIQUIDCASE'))].concat(['NIFTY500'])
    if (!syms.length) return
    setLiveBusy(true)
    setLiveErr('')
    getPaperLive(syms).then((r) => {
      // flash a price green / red when it moved since the last refresh
      const fl = {}
      Object.entries(r?.prices || {}).forEach(([s, v]) => {
        const old = lastPx.current[s]
        if (old && v.price !== old) fl[s] = v.price > old ? 'up' : 'down'
        lastPx.current[s] = v.price
      })
      setFlash(fl); if (Object.keys(fl).length) setTimeout(() => setFlash({}), 1600)
      setLive(r); if (r && !Object.keys(r.prices || {}).length) setLiveErr('no prices returned') })
      .catch((e) => { setLive(null); setLiveErr(e.message || 'failed') }).finally(() => setLiveBusy(false))
  }

  useEffect(() => {
    if (!isAdmin) return
    getPaperBook().then((d) => { setData(d || null); if (d) loadLive(d) }).catch((e) => setErr(e.message || 'Could not load'))
  }, [isAdmin])

  // auto-refresh live prices every 60 s while the market is open and the tab is visible
  useEffect(() => {
    if (!data) return
    const id = setInterval(() => {
      const o = marketOpen(); setOpen(o)
      if (o && document.visibilityState === 'visible') loadLive(data)
    }, 60000)
    return () => clearInterval(id)
  }, [data])

  // always A, B, C, D (the saved snapshot does not keep key order)
  const keys = Object.keys(data?.books || {}).sort()
  const bk = data?.books?.[book] ? book : keys[0]
  const b = data?.books?.[bk]
  const view = useMemo(() => {
    if (!b) return null
    const lp = live?.prices || {}
    const hold = (b.holdings || []).map((h) => {
      const [s, q, , px, val] = h
      const L = s === 'LIQUIDCASE' ? null : lp[s]
      const price = L ? L.price : px
      // bought today (opening or rebalance day): today's change counts from the buy price, not yesterday's close
      const boughtToday = h[8] && h[8] === new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10)
      const prev = boughtToday && h[2] ? h[2] : L && L.prev ? L.prev : price
      const value = s === 'LIQUIDCASE' ? val : q * price
      const pnlAmt = h[2] && s !== 'LIQUIDCASE' ? q * (price - h[2]) : null
      return { row: h, price, value, pnlAmt, pnlPct: h[2] && s !== 'LIQUIDCASE' ? (price / h[2] - 1) * 100 : null,
        today: s === 'LIQUIDCASE' ? 0 : q * (price - prev), todayPct: L && prev ? (price / prev - 1) * 100 : null }
    })
    // stocks sorted by the chosen column (default momentum rank, strongest first); gold and liquid always at the bottom
    const grp = (h) => (h.row[0] === 'GOLDBEES' ? 1 : h.row[0] === 'LIQUIDCASE' ? 2 : 0)
    const key = { rank: (h) => h.row[7] ?? 999, pnl: (h) => -(h.pnlPct ?? -1e9), today: (h) => -(h.todayPct ?? -1e9),
      value: (h) => -h.value, stock: (h) => h.row[0] }[sort.k]
    hold.sort((x, y) => grp(x) - grp(y) || (sort.k === 'stock' ? key(x).localeCompare(key(y)) : key(x) - key(y)) * sort.d)
    const liveNav = hold.reduce((a, h) => a + h.value, 0)
    const today = hold.reduce((a, h) => a + h.today, 0)
    const gold = hold.filter((h) => h.row[0] === 'GOLDBEES').reduce((a, h) => a + h.value, 0)
    const isStock = (h) => h.row[0] !== 'GOLDBEES' && h.row[0] !== 'LIQUIDCASE'
    const stocks = hold.filter(isStock).reduce((a, h) => a + h.value, 0)
    const liquid = Math.max(0, liveNav - gold - stocks)
    const nStocks = hold.filter(isStock).length
    return { hold, gold, stocks, liquid, nStocks, liveNav, today, todayPct: liveNav - today > 0 ? (today / (liveNav - today)) * 100 : 0,
      held: new Set(hold.map((h) => h.row[0])), maxW: Math.max(1, ...hold.filter(isStock).map((h) => h.row[6])) }
  }, [b, live, sort])

  if (!isAdmin) return <Navigate to="/dashboard" replace />
  if (err) return <p className="text-sm text-[var(--accent-rose)] p-4">{err}</p>
  if (data === undefined) return <p className="text-sm text-[var(--text-dim)] p-4">Loading…</p>
  if (!data) return <p className="text-sm text-[var(--text-dim)] p-4">No paper-book snapshot yet. It appears after the next scheduled run.</p>
  if (!view) return <p className="text-sm text-[var(--text-dim)] p-4">{data.start_on ? `The four paper books (A Momentum, B Momentum + Safety, C Momentum + Quality, D Top 10 Common) open together on ${day(data.start_on)}.` : 'No paper-book snapshot yet. It appears after the next scheduled run.'}</p>

  const half = b.x < 1
  const tot = Math.max(1, view.liveNav)
  // Nifty 500 at live prices: the same Rs 10 lakh in the index, moved by the index since the snapshot (n500_px = index level then)
  const nLive = live?.prices?.NIFTY500?.price, nBase = data.n500_px?.[1]
  const benchNow = (x) => (x.bench && nLive && nBase ? x.bench * (nLive / nBase) : x.bench)
  const vsNifty = (x, v) => (x.bench ? (v / benchNow(x) - 1) * 100 : null)
  // best strategy so far: highest return since the start at live prices
  const perf = keys.map((k) => { const x = data.books[k], v = liveValue(x, live?.prices); return { k, ret: x.invested ? (v / x.invested - 1) * 100 : 0 } }).sort((p1, p2) => p2.ret - p1.ret)
  const lead = perf.length > 1 ? perf[0] : null
  const close = lead && perf[0].ret - perf[1].ret < 0.05   // under 0.05 points apart: practically level
  // plain words for the market comparison: ahead / behind the Nifty 500 by x%
  const vsTone = (d) => (d == null || Math.abs(d) < 0.05 ? 'text-[var(--text-muted)]' : tone(d))
  const vsWord = (d) => (d == null ? '—' : Math.abs(d) < 0.05 ? 'Level with Nifty' : d > 0 ? `Ahead by ${Math.abs(d).toFixed(1)}%` : `Behind by ${Math.abs(d).toFixed(1)}%`)
  const days = b.start ? Math.max(0, Math.round((Date.now() - new Date(b.start + 'T00:00:00+05:30').getTime()) / 86400e3)) : 0
  const nRet = nLive && nBase && b.bench ? (benchNow(b) / b.invested - 1) * 100 : null
  const liveAt = live?.at ? new Date(live.at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : null

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-base font-bold text-[var(--text-primary)]">Paper books <span className="text-xs font-medium text-[var(--text-dim)]">· ₹10 lakh each · started {day(b.start)}</span></h2>
        <div className="flex items-center gap-2 text-xs">
          <span className={`px-2.5 py-1 rounded-lg font-semibold ${half ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
            {half ? 'Half-cut on · stocks 50%' : 'Fully invested'}
          </span>
          {open && live && <span className="flex items-center gap-1.5 text-emerald-400 font-semibold"><span className="relative flex w-2 h-2"><span className="absolute inline-flex w-full h-full rounded-full bg-emerald-400 opacity-60 animate-ping" /><span className="relative inline-flex w-2 h-2 rounded-full bg-emerald-400" /></span>Live</span>}
          <span className="text-[var(--text-dim)]">{liveAt ? `${open ? 'Updated' : 'Last price'} ${liveAt}${open ? ' · every minute' : ''}` : `Closing prices ${day(data.updated)}`}</span>
          <button onClick={() => loadLive(data)} disabled={liveBusy} title="Refresh live prices"
            className="p-1.5 rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-50">
            <RefreshCw size={13} className={liveBusy ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {Object.keys(data.morning?.sells?.[bk] || {}).length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm font-semibold text-amber-400">
          Selling at the 9:15 open: {Object.entries(data.morning.sells[bk]).map(([s, w]) => `${s} (${w})`).join(' · ')}
        </div>
      )}

      {/* best strategy so far */}
      <div className="flex items-center gap-2 flex-wrap rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-2.5 text-sm">
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-dim)]">Best so far</span>
        {lead ? <>
          <span className={`w-2 h-2 rounded-full ${BOOK_DOT[lead.k] || 'bg-slate-400'}`} />
          <span className="font-bold text-[var(--text-primary)]">{lead.k} · {BOOK_NAME[lead.k] || lead.k}</span>
          <span className={`font-semibold tabular-nums ${tone(lead.ret)}`}>{pct(lead.ret)}</span>
          {close && <span className="text-xs text-[var(--text-dim)]">(just ahead of {perf[1].k})</span>}
          <span className="w-full sm:w-auto text-xs text-[var(--text-dim)] tabular-nums">{perf.map((x) => `${x.k} ${pct(x.ret)}`).join(' > ')}{nRet != null ? ` · Nifty 500 ${pct(nRet)}` : ''}</span>
        </> : <span className="text-[var(--text-muted)]">—</span>}
        <span className="ml-auto text-xs text-[var(--text-dim)]">Day {days + 1} · judge after about 3 months</span>
      </div>

      {/* the four books: tap one to see its numbers and holdings */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3" role="tablist">
        {(() => {
          const inv = keys.reduce((a, k) => a + data.books[k].invested, 0), val = keys.reduce((a, k) => a + liveValue(data.books[k], live?.prices), 0), g = val - inv
          return (
            <div className="col-span-2 lg:col-span-1 rounded-xl border border-[var(--border)] bg-[var(--bg-inset)] px-4 py-3 min-w-0">
              <p className="text-xs font-semibold text-[var(--text-dim)] uppercase tracking-wider">All {keys.length} books</p>
              <p className="mt-1.5 text-base font-bold tabular-nums text-[var(--text-primary)]">{inr(val)}</p>
              <p className={`text-xs font-semibold tabular-nums ${tone(g)}`}>{sgn(g)}{inr(Math.abs(g))} · {pct2(inv ? (g / inv) * 100 : 0)}</p>
              <p className="text-[11px] text-[var(--text-dim)] mt-0.5">Invested {lakhs(inv)}</p>
            </div>
          )
        })()}
        {keys.map((k) => {
          const x = data.books[k], v = liveValue(x, live?.prices), g = v - x.invested, gp = x.invested ? (g / x.invested) * 100 : 0, on = k === bk
          return (
            <button key={k} role="tab" aria-selected={on} onClick={() => setBook(k)}
              className={`text-left rounded-xl border px-4 py-3 transition-colors min-w-0 ${on ? `bg-[var(--bg-card)] ring-1 ${BOOK_RING[k] || ''}` : 'bg-[var(--bg-card)] border-[var(--border)] hover:border-[var(--text-dim)] opacity-80 hover:opacity-100'}`}>
              <div className="flex items-center gap-2 min-w-0">
                <span className={`w-2 h-2 rounded-full flex-none ${BOOK_DOT[k] || 'bg-slate-400'}`} />
                <span className="text-xs font-semibold text-[var(--text-primary)] truncate">{k} · {BOOK_NAME[k] || k}</span>
                {lead?.k === k && <span className="ml-auto flex-none px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-400">LEADING</span>}
              </div>
              <p className="mt-1.5 text-base font-bold tabular-nums text-[var(--text-primary)]">{inr(v)}</p>
              <p className={`text-xs font-semibold tabular-nums ${tone(g)}`}>{sgn(g)}{inr(Math.abs(g))} · {pct2(gp)}</p>
              <p className="text-[11px] text-[var(--text-dim)] mt-0.5 truncate">Invested {lakhs(x.invested)}{x.costs ? ` · costs ${inr(x.costs)}` : ''}</p>
              {x.bench && <p className={`text-[11px] font-semibold mt-0.5 truncate ${vsTone(vsNifty(x, v))}`}>vs Nifty: {vsWord(vsNifty(x, v))}</p>}
            </button>
          )
        })}
      </div>

      {/* selected book: compact numbers */}
      <div className="flex items-center gap-2 pt-1">
        <span className={`w-2 h-2 rounded-full ${BOOK_DOT[bk] || 'bg-slate-400'}`} />
        <h3 className="text-sm font-bold text-[var(--text-primary)]">{bk} · {BOOK_NAME[bk] || bk}</h3>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Mini label="Today" value={live ? `${sgn(view.today)}${inr(Math.abs(view.today))}` : '—'} sub={live ? pct2(view.todayPct) : liveBusy ? 'loading…' : `no live prices${liveErr ? ': ' + liveErr : ''}`} tone={live ? tone(view.today) : ''} />
        <Mini label={`vs Nifty 500${nLive && nBase ? ' · live' : ''}`} value={b.bench ? vsWord(vsNifty(b, view.liveNav)) : '—'} sub={b.bench ? `₹10 L in Nifty now ${lakhs(benchNow(b))}` : ''} tone={b.bench ? vsTone(vsNifty(b, view.liveNav)) : ''}
          title={nLive && nBase ? `Book value now vs the same ₹10 lakh in the Nifty 500 (index ${num(nLive)} live)` : 'At the last close, against the same ₹10 lakh in the Nifty 500'} />
        <Mini label="Stocks / Gold / Cash" value={`${Math.round((view.stocks / tot) * 100)} / ${Math.round((view.gold / tot) * 100)} / ${Math.round((view.liquid / tot) * 100)}%`} sub={`${view.nStocks} stocks`} />
        <Mini label="Next rebalance" value={day(data.next_rebalance)} sub="first trading day" />
      </div>

      <div>
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] overflow-hidden">
          <div className="px-4 py-2.5 border-b border-[var(--border-light)] flex items-center justify-between">
            <h3 className="text-sm font-bold text-[var(--text-primary)]">Holdings</h3>
            <span className="text-xs text-[var(--text-dim)]">{view.nStocks} stocks + gold + liquid</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border-light)] bg-[var(--bg-inset)]">
                  <SortTh k="rank" sort={sort} setSort={setSort} cls="text-right w-12" title="Momentum rank today (sold at the next rebalance if below 40)">Rank</SortTh>
                  <SortTh k="stock" sort={sort} setSort={setSort} cls="text-left">Stock</SortTh><th className={`${TH} text-right`}>Qty</th><th className={`${TH} text-right`}>Avg</th>
                  <th className={`${TH} text-right`}>Price</th><SortTh k="today" sort={sort} setSort={setSort} cls="text-right">Today</SortTh>
                  <SortTh k="value" sort={sort} setSort={setSort} cls="text-right">Value</SortTh><SortTh k="pnl" sort={sort} setSort={setSort} cls="text-right" title="Sorts by % (fair across bigger and smaller holdings)">P&amp;L</SortTh>
                  <th className={`${TH} text-left`}>Weight</th>
                </tr>
              </thead>
              <tbody>
                {view.hold.map(({ row: [s, q, avg, , , , , rank], price, value, todayPct }) => {
                  const g = s === 'GOLDBEES', lq = s === 'LIQUIDCASE'
                  const pnl = avg ? (price / avg - 1) * 100 : null
                  const pnlAmt = avg && !lq ? q * (price - avg) : null
                  const w = Math.round((value / tot) * 1000) / 10
                  return (
                    <tr key={s} onClick={() => !lq && setChartSym(s)} className={`border-b border-[var(--border-row)] last:border-0 hover:bg-[var(--bg-hover)] ${lq ? '' : 'cursor-pointer'} ${g ? 'bg-amber-500/5' : lq ? 'bg-sky-500/5' : ''}`}>
                      <td className={`${TD} text-right font-semibold ${g || lq ? 'text-[var(--text-dim)]' : rank == null || rank > 40 ? 'text-[var(--accent-rose)]' : rank > 30 ? 'text-amber-400' : 'text-[var(--text-primary)]'}`}>{g || lq ? '—' : rank == null ? 'out' : rank}</td>
                      <td className={`${TD} text-left font-semibold ${g ? 'text-amber-400' : lq ? 'text-sky-400' : 'text-[var(--text-primary)]'}`}>{s}{lq && <span className="ml-1.5 text-[10px] font-medium text-[var(--text-dim)]">liquid</span>}</td>
                      <td className={`${TD} text-right`}>{num(q)}</td>
                      <td className={`${TD} text-right`}>{num(avg)}</td>
                      <td className={`${TD} text-right transition-colors duration-700 ${flash[s] === 'up' ? 'bg-emerald-500/20 text-emerald-300' : flash[s] === 'down' ? 'bg-rose-500/20 text-rose-300' : ''}`}>{num(price)}</td>
                      <td className={`${TD} text-right ${tone(todayPct)}`} title={todayPct != null && todayPct <= -8 && !g && !lq ? 'Big fall: if it closes 10%+ down on heavy volume, B, C and D sell it at the next open' : undefined}>
                        {todayPct != null && todayPct <= -8 && !g && !lq && <span className="mr-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/15 text-rose-400">WATCH</span>}
                        {todayPct == null ? '—' : pct(todayPct)}
                      </td>
                      <td className={`${TD} text-right text-[var(--text-primary)]`}>{inr(value)}</td>
                      <td className={`${TD} text-right font-semibold ${tone(pnl)}`}>{pnlAmt == null ? '—' : <>{sgn(pnlAmt)}{inr(Math.abs(pnlAmt))} <span className="text-xs font-medium opacity-80">· {pct(pnl)}</span></>}</td>
                      <td className={`${TD} text-left`}>
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-[var(--bg-inset)] overflow-hidden">
                            <div className={`h-full rounded-full ${g ? 'bg-amber-400' : lq ? 'bg-sky-400' : 'bg-violet-400'}`} style={{ width: `${g || lq ? 100 : Math.min(100, (w / view.maxW) * 100)}%` }} />
                          </div>
                          <span className="text-xs">{w}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>
      <p className="text-xs text-[var(--text-dim)]">Tap a stock for its chart · paper trading only · information, not advice</p>
      {chartSym && <BigChart data={data} sym={chartSym} livePrice={livePx(chartSym)} onClose={() => setChartSym(null)} />}
    </div>
  )
}
