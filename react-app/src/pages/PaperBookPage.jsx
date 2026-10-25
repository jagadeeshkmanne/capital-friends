import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Navigate, Link } from 'react-router-dom'
import { RefreshCw, Target, FlaskConical, BookOpen } from 'lucide-react'
import Modal from '../components/Modal'
import { useAuth } from '../context/AuthContext'
import { getPaperBook, getPaperLive } from '../services/api'
import { getNavHistory } from '../utils/navHistory'
import { RULE, WORDS_STOCKS, replay, nextDue, checks, split, ap, day } from '../utils/fundRule'

// Hidden admin page (/admin/paper): the STOCK rule, book H. 15 momentum stocks from the 1000 most-traded NSE stocks, with the
// stock / gold / liquid split from the fund rule (G) on the Midcap150 Momentum 50 index fund, stocks never above 70%.
// Same three tabs as the Fund rule page: Live (what to hold now), Paper (₹10 lakh book H, run each morning by paper.py and
// pushed here as a snapshot), Rule (why today's split, how the stocks are picked, the back-test). Information, not advice.
const CAP = 0.70                       // stocks never above 70% of the money (paper.py book_smax)
const LS = 'cf-stock-rule'
const K = ['fund', 'gold', 'liq']      // 'fund' = the stock part (the shared rule calls it the fund share)
const NAMES = { fund: 'Stocks', gold: 'Gold', liq: 'Liquid fund' }
const COLORS = { fund: 'bg-lime-400', gold: 'bg-amber-400', liq: 'bg-slate-400' }
const REPORT_URL = 'https://claude.ai/artifact/3x1q76KFSqD3bdA58UkiPr'
// back-test, Jul 2015 - Sep 2026: decided on the close, traded at the next close, 0.2% per trade, four rebalance weeks averaged
const BT_YEARS = [['2016', 17.0, 5.1], ['2017', 64.6, 37.7], ['2018', -4.8, -2.1], ['2019', 22.8, 9.0], ['2020', 85.2, 17.9], ['2021', 41.0, 31.6],
  ['2022', 20.6, 4.2], ['2023', 40.2, 26.9], ['2024', 14.5, 16.2], ['2025', 31.9, 7.8], ['2026 to Sep', 41.1, -6.8]]
// the signal fund: the one chosen on the Fund rule page (same browser), else the Tata Nifty Midcap 150 Momentum 50 index fund
const signalCode = () => { try { return JSON.parse(localStorage.getItem('cf-fund-rule') || '{}').signal || 150738 } catch { return 150738 } }

const inr = (v) => (v == null ? '—' : '₹' + Math.round(v).toLocaleString('en-IN'))
const pct = (v) => (v == null ? '—' : (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(Number(v)).toFixed(1) + '%')
const pct2 = (v) => (v == null ? '—' : Math.abs(v) < 1 ? (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(Number(v)).toFixed(2) + '%' : pct(v))   // small moves: 2 decimals so +₹112 is not shown as +0.0%
const tone = (v) => (v == null ? 'text-[var(--text-primary)]' : v >= 0 ? 'text-emerald-400' : 'text-[var(--accent-rose)]')
const toneZ = (v) => (v == null || Math.abs(v) < 0.005 ? 'text-[var(--text-muted)]' : tone(v))   // zero is neither green nor red
const num = (v) => (v == null ? '—' : Number(v).toLocaleString('en-IN', { maximumFractionDigits: 2 }))
const sgn = (v) => (v == null ? '' : v >= 0 ? '+' : '−')
const lakhs = (v) => (v == null ? '—' : '₹' + (Math.abs(v) / 1e5).toFixed(2) + ' L')
const short = (d) => day(d).replace(/ \d{4}$/, '')
const stocksSplit = (w) => split(w, 'stocks')
// NSE cash market hours (Mon-Fri 9:15-15:30 IST): live prices refresh every minute only then
const marketOpen = () => {
  const t = new Date(Date.now() + 5.5 * 3600e3), d = t.getUTCDay(), m = t.getUTCHours() * 60 + t.getUTCMinutes()
  return d >= 1 && d <= 5 && m >= 555 && m <= 930
}
const isStock = (s) => s !== 'GOLDBEES' && s !== 'LIQUIDCASE'

const TH = 'py-2 px-2 sm:px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider whitespace-nowrap'
const TD = 'py-2 px-2 sm:px-3 text-sm whitespace-nowrap tabular-nums'                 // no colour here, so a cell's own colour always wins
const TDS = `${TD} text-[var(--text-secondary)]`
const PH = 'max-sm:hidden'                                                      // columns left out on a phone
const CARD = 'bg-[var(--bg-card)] rounded-xl border border-[var(--border)]'
const HEAD = 'px-4 py-2.5 border-b border-[var(--border-light)] flex items-center justify-between gap-3 flex-wrap'

// ── price charts (1 year of daily closes from the snapshot, live price appended) ──
const RANGES = [['1M', 21], ['3M', 63], ['6M', 126], ['1Y', 252]]
function series(data, sym, livePrice, n) {
  const c = data?.charts?.[sym]; if (!c) return null
  const d = data.chart_dates || []
  const pts = c.map((v, i) => [d[i], v]).filter((p) => p[1] != null).slice(-n)
  if (livePrice && pts.length && Math.abs(livePrice / pts[pts.length - 1][1] - 1) > 1e-6) pts.push(['live', livePrice])
  return pts.length > 1 ? pts : null
}
const lastClose = (data, sym) => { const c = data?.charts?.[sym]; if (!c) return null; for (let i = c.length - 1; i >= 0; i--) if (c[i] != null) return c[i]; return null }

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

// clickable column header: first click sorts best-first, second click reverses
function SortTh({ k, sort, setSort, cls, title, children }) {
  const on = sort.k === k
  return (
    <th className={`${TH} ${cls} cursor-pointer select-none hover:text-[var(--text-primary)] ${on ? 'text-[var(--text-primary)]' : ''}`} title={title}
      onClick={() => setSort(on ? { k, d: -sort.d } : { k, d: 1 })}>
      {children}<span className={`ml-1 ${on ? 'opacity-80' : 'opacity-25 max-sm:hidden'}`}>{on ? (sort.d > 0 ? '▲' : '▼') : '↕'}</span>
    </th>
  )
}

function Mini({ label, value, sub, tone: t, title }) {
  return (
    <div className={`${CARD} px-4 py-3 min-w-0`} title={title}>
      <p className="text-xs text-[var(--text-dim)] uppercase tracking-wider mb-1 truncate">{label}</p>
      <p className={`text-sm font-semibold tabular-nums truncate ${t || 'text-[var(--text-primary)]'}`}>{value}</p>
      {sub && <p className={`text-xs font-semibold tabular-nums mt-0.5 truncate ${t || 'text-[var(--text-dim)]'}`}>{sub}</p>}
    </div>
  )
}

/** The stock / gold / liquid split as one bar with three labelled parts and the rupees for `amount`. */
function SplitBar({ w, amount }) {
  return (
    <>
      <div className="flex h-2.5 w-full rounded-full overflow-hidden bg-[var(--bg-inset)]">{K.map((k) => <div key={k} className={COLORS[k]} style={{ width: `${w[k] * 100}%` }} />)}</div>
      <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-1.5">
        {K.map((k) => (
          <div key={k} className="flex items-center gap-2 text-sm min-w-0">
            <span className={`w-2 h-2 rounded-full shrink-0 ${COLORS[k]}`} />
            <span className="text-[var(--text-secondary)] truncate">{NAMES[k]}</span>
            <span className="font-bold tabular-nums text-[var(--text-primary)]">{Math.round(w[k] * 100)}%</span>
            {amount > 0 && <span className="ml-auto text-xs text-[var(--text-dim)] tabular-nums">{inr(amount * w[k])}</span>}
          </div>))}
      </div>
    </>
  )
}

export default function PaperBookPage() {
  const { isAdmin, isResearch } = useAuth()
  const [data, setData] = useState(undefined)
  const [err, setErr] = useState('')
  const [hist, setHist] = useState(undefined)
  const [tab, setTabState] = useState(() => { try { const t = localStorage.getItem(LS + '-tab'); return t === 'paper' || t === 'rule' ? t : 'live' } catch { return 'live' } })
  const setTab = (t) => { setTabState(t); try { localStorage.setItem(LS + '-tab', t) } catch { /* ignore */ } }
  const [amount, setAmountState] = useState(() => { try { return Number(localStorage.getItem(LS + '-amount')) || 1000000 } catch { return 1000000 } })
  const setAmount = (v) => { setAmountState(v); try { localStorage.setItem(LS + '-amount', String(v)) } catch { /* ignore */ } }
  const [live, setLive] = useState(null)
  const [liveBusy, setLiveBusy] = useState(false)
  const [liveErr, setLiveErr] = useState('')
  const [chartSym, setChartSym] = useState(null)
  const [flash, setFlash] = useState({})
  const [sort, setSort] = useState({ k: 'rank', d: 1 })   // holdings sort: rank (default), pnl, pnlPct, today, value, stock
  const [open, setOpen] = useState(marketOpen())
  const [allTrades, setAllTrades] = useState(false)
  const [allSw, setAllSw] = useState(false)
  const lastPx = useRef({})
  const livePx = (s) => live?.prices?.[s]?.price

  const loadLive = (d) => {
    const b = d?.books?.H
    const syms = [...new Set([...(b?.holdings || []).map((h) => h[0]), ...(b?.target || []).map((t) => t[0])].filter((x) => x && x !== 'LIQUIDCASE'))].concat(['NIFTY500'])
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
    if (!isResearch) return
    getPaperBook().then((d) => { setData(d || null); if (d) loadLive(d) }).catch((e) => setErr(e.message || 'Could not load'))
    getNavHistory(signalCode()).then((h) => setHist(h && h.times?.length > RULE.look + 60 ? h : null)).catch(() => setHist(null))
  }, [isResearch])  // eslint-disable-line react-hooks/exhaustive-deps

  // auto-refresh live prices every 60 s while the market is open and the tab is visible
  useEffect(() => {
    if (!data) return
    const id = setInterval(() => {
      const o = marketOpen(); setOpen(o)
      if (o && document.visibilityState === 'visible') loadLive(data)
    }, 60000)
    return () => clearInterval(id)
  }, [data])  // eslint-disable-line react-hooks/exhaustive-deps

  // the rule (G's, stocks capped at 70%) from the index fund's NAVs; a switch due at the next close is known a day early
  const R = useMemo(() => (hist ? replay(hist, CAP, WORDS_STOCKS) : null), [hist])
  const N = useMemo(() => (hist && R ? nextDue(hist, R, CAP, WORDS_STOCKS) : null), [hist, R])
  const C = R ? checks(R, N, CAP) : null   // the Rule tab's four checks (the newer ones when a switch is due)
  const b = data?.books?.H || null

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
    const key = { rank: (h) => h.row[7] ?? 999, pnl: (h) => -(h.pnlAmt ?? -1e9), pnlPct: (h) => -(h.pnlPct ?? -1e9), today: (h) => -(h.todayPct ?? -1e9),
      value: (h) => -h.value, stock: (h) => h.row[0] }[sort.k]
    hold.sort((x, y) => grp(x) - grp(y) || (sort.k === 'stock' ? key(x).localeCompare(key(y)) : key(x) - key(y)) * sort.d)
    const liveNav = hold.reduce((a, h) => a + h.value, 0)
    const today = hold.reduce((a, h) => a + h.today, 0)
    const gold = hold.filter((h) => h.row[0] === 'GOLDBEES').reduce((a, h) => a + h.value, 0)
    const stocks = hold.filter((h) => isStock(h.row[0])).reduce((a, h) => a + h.value, 0)
    const liquid = Math.max(0, liveNav - gold - stocks)
    const nStocks = hold.filter((h) => isStock(h.row[0])).length
    return { hold, gold, stocks, liquid, nStocks, liveNav, today, todayPct: liveNav - today > 0 ? (today / (liveNav - today)) * 100 : 0,
      held: new Set(hold.map((h) => h.row[0])), maxW: Math.max(1, ...hold.filter((h) => isStock(h.row[0])).map((h) => h.row[6])) }
  }, [b, live, sort])

  if (!isResearch) return <Navigate to="/dashboard" replace />
  if (err) return <p className="text-sm text-[var(--accent-rose)] p-4">{err}</p>
  if (data === undefined) return <p className="text-sm text-[var(--text-dim)] p-4">Loading…</p>
  if (!data || !b || !view) return <p className="text-sm text-[var(--text-dim)] p-4">No snapshot of book H yet. It appears after the next morning run.</p>

  // the split: the rule's today (from the NAVs) or, if they did not load, the paper book's own split from the snapshot
  const snap = b.split ? { fund: b.split.FUND, gold: b.split.GOLD, liq: b.split.LIQ } : { fund: 0, gold: 0, liq: 1 }
  const now = R ? R.target : snap
  const tgt = N ? N.target : now                       // what to hold from the next close (a switch already known) or today
  const last = R?.log?.[0]
  const tot = Math.max(1, view.liveNav)
  // this month's picks: the paper book's target list (kept even while the rule has 0% in stocks), else what it holds
  const rankNow = Object.fromEntries((data.ranks || []).map((r) => [r[0], r[1]]))
  const picks = (b.target?.length ? b.target.map((t) => ({ s: t[0], rank: t[2] })) : view.hold.filter((h) => isStock(h.row[0])).map((h) => ({ s: h.row[0], rank: h.row[7] })))
    .sort((x, y) => (rankNow[x.s] ?? 999) - (rankNow[y.s] ?? 999) || (x.rank ?? 999) - (y.rank ?? 999))   // strongest today first
  const each = picks.length ? (amount * tgt.fund) / picks.length : 0
  const moves = N ? K.map((k) => ({ k, d: (N.target[k] - now[k]) * amount })).filter((m) => Math.abs(m.d) > Math.max(500, RULE.tradeBand * Math.max(N.target[m.k], now[m.k]) * amount)) : []
  const moveText = (m) => {
    if (m.k === 'fund') {
      if (N.target.fund < 1e-9) return [`SELL`, `all ${picks.length} stocks`, `about ${inr(Math.abs(m.d))}`]
      if (now.fund < 1e-9) return ['BUY', `the ${picks.length} stocks`, `${inr(Math.abs(m.d))} · ${inr(Math.abs(m.d) / Math.max(1, picks.length))} each`]
      return [m.d > 0 ? 'BUY' : 'SELL', `${inr(Math.abs(m.d))} across the ${picks.length} stocks`, `${inr(Math.abs(m.d) / Math.max(1, picks.length))} each`]
    }
    return [m.d > 0 ? 'BUY' : 'SELL', m.k === 'gold' ? 'Gold (GOLDBEES or a gold fund)' : 'Liquid fund', inr(Math.abs(m.d))]
  }

  // Nifty 500 at live prices: the same Rs 10 lakh in the index, moved by the index since the snapshot (n500_px = index level then)
  const nLive = live?.prices?.NIFTY500?.price, nBase = data.n500_px?.[1]
  const benchNow = b.bench && nLive && nBase ? b.bench * (nLive / nBase) : b.bench
  const vsN = b.bench ? (view.liveNav / benchNow - 1) * 100 : null
  const vsWord = (d) => (d == null ? '—' : Math.abs(d) < 0.05 ? 'Same as Nifty 500' : d > 0 ? `Ahead by ${Math.abs(d).toFixed(1)}%` : `Behind by ${Math.abs(d).toFixed(1)}%`)
  const gain = view.liveNav - b.invested, g0 = Math.abs(gain) < 1 ? 0 : gain   // under ₹1 is rounding, shown as 0
  const days = b.start ? Math.max(0, Math.round((Date.now() - new Date(b.start + 'T00:00:00+05:30').getTime()) / 86400e3)) : 0
  const liveAt = live?.at ? new Date(live.at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : null
  const trades = [...(b.trades || [])].reverse()

  return (
    <div className="space-y-4">
      {/* header, like the Fund rule page */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-base font-bold text-[var(--text-primary)]">Stock rule <span className="text-xs font-medium text-[var(--text-dim)]">· 15 momentum stocks + gold · book H</span></h2>
        <div className="flex items-center gap-2 text-xs flex-wrap">
          {N ? <span className="px-2.5 py-1 rounded-lg font-semibold bg-amber-500/10 text-amber-400">Switch at the {short(N.date)} close to {stocksSplit(N.target)}</span>
            : <span className="px-2.5 py-1 rounded-lg font-semibold bg-lime-500/10 text-lime-400">Hold {stocksSplit(now)}</span>}
          <span className="text-[var(--text-dim)]">{R ? `Signal to ${day(R.asOf)}` : hist === undefined ? 'Loading the signal…' : `Book split at ${day(data.updated)}`}</span>
          <Link to="/admin/fund-rule" className="px-2 py-1 rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)]">Fund rule (G)</Link>
        </div>
      </div>
      {hist === null && <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm font-semibold text-amber-400">Could not load the index fund's prices (api.mfapi.in), so this shows the paper book's split from its last update.</div>}
      {!isAdmin && <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-inset)] px-4 py-2.5 text-xs text-[var(--text-muted)]">Shared with you as a learning record: a mechanical rule and its paper book, run by Jagadeesh. Information, not a recommendation; nothing here is personal advice.</div>}

      {/* three tabs, as on the Fund rule page */}
      <div>
        <div role="tablist" className="grid grid-cols-3 gap-1 rounded-xl border border-[var(--border)] bg-[var(--bg-inset)] p-1">
          {[['live', Target, 'Live', 'what to hold now'], ['paper', FlaskConical, 'Paper', '₹10 lakh on paper'], ['rule', BookOpen, 'Rule', 'picks, signals & back-test']].map(([k, Icon, t, sub]) => { const on = tab === k; return (
            <button key={k} role="tab" aria-selected={on} onClick={() => setTab(k)} className={`flex items-center justify-center gap-2 rounded-lg py-2.5 px-2 text-sm font-semibold transition-all ${on ? 'bg-sky-500 text-white shadow-md' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'}`}>
              <Icon size={15} />{t}<span className={`max-md:hidden text-xs font-normal ${on ? 'text-white/80' : 'text-[var(--text-dim)]'}`}>· {sub}</span>
            </button>) })}
        </div>
        <p className="mt-2 text-xs text-[var(--text-dim)]">{tab === 'live' ? 'What the rule holds now, what to do at the next close, and this month\'s 15 stocks with amounts.' : tab === 'paper' ? `₹10 lakh following the rule since ${day(b.start)} (day ${days + 1}; judge it after about 3 months), updated every weekday morning.` : 'Why the rule says what it says today, how the stocks are picked, and the 2015–2026 back-test.'}</p>
      </div>

      {/* LIVE */}
      {tab === 'live' && (<>
        <div className={`${CARD} px-4 py-3`}>
          <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-dim)]">{N ? `Target from the ${day(N.date)} close` : 'Target today'}</p>
            <label className="flex items-center gap-1.5 text-xs text-[var(--text-dim)]">for
              <span className="flex items-center rounded-lg border border-[var(--border)] bg-[var(--bg-input)] px-2"><span className="text-sm text-[var(--text-dim)]">₹</span>
                <input type="number" min="0" step="10000" value={amount} onChange={(e) => setAmount(Math.max(0, Number(e.target.value) || 0))} aria-label="Amount"
                  className="w-28 bg-transparent py-1 pl-1 text-sm text-[var(--text-primary)] tabular-nums outline-none" /></span>
            </label>
          </div>
          <SplitBar w={tgt} amount={amount} />
        </div>

        <div className={`rounded-xl border overflow-hidden ${N ? 'border-amber-500/40 bg-amber-500/5' : 'border-[var(--border)] bg-[var(--bg-card)]'}`}>
          <div className={HEAD}>
            <h3 className="text-sm font-bold text-[var(--text-primary)]">{N ? `Action: switch at the ${day(N.date)} close` : 'No action'}</h3>
            <span className="text-xs text-[var(--text-dim)]">checks: Friday's close (switch on Monday) · new picks {day(data.next_rebalance)}</span>
          </div>
          <div className="px-4 py-3 space-y-2">
            {N ? <p className="text-xs text-[var(--text-muted)]"><span className="font-semibold text-amber-400">From the {day(N.date)} close: {stocksSplit(N.target)}.</span> {N.why}. Decided on the {day(R.asOf)} close, so the trades can go in near that day's close (about 3:20 pm).</p>
              : last && <p className="text-xs text-[var(--text-muted)]"><span className="font-semibold text-[var(--text-secondary)]">Since {day(last.date)}: {stocksSplit(last.target)}.</span> {last.why}.</p>}
            {N ? moves.map((m) => { const [side, what, amt] = moveText(m); return (
              <div key={m.k} className="flex items-baseline gap-3 flex-wrap text-sm">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${side === 'BUY' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-[var(--accent-rose)]'}`}>{side}</span>
                <span className="font-semibold text-[var(--text-primary)]">{what}</span>
                <span className="text-xs text-[var(--text-dim)] tabular-nums">{amt}</span>
              </div>) })
              : <p className="text-sm font-semibold text-emerald-400">Hold {stocksSplit(now)}. Nothing to do until the rule changes or the month-end picks.</p>}
            <p className="text-[11px] text-[var(--text-dim)]">Amounts are for {inr(amount)}. Stocks trade near the close; a stock stuck at its circuit limit waits for the next day. Rule output, not advice.</p>
          </div>
        </div>

        <div className={`${CARD} overflow-hidden`}>
          <div className={HEAD}>
            <h3 className="text-sm font-bold text-[var(--text-primary)]">This month's {picks.length} stocks</h3>
            <span className="text-xs text-[var(--text-dim)]">{tgt.fund > 1e-9 ? `${inr(each)} each · equal weight` : 'not held while the rule has 0% in stocks'} · new picks {day(data.next_rebalance)}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {picks.map((p) => { const price = livePx(p.s) ?? lastClose(data, p.s); const rn = rankNow[p.s]; return (
              <button key={p.s} onClick={() => setChartSym(p.s)} className="flex items-center gap-3 px-4 py-2 text-left border-b border-[var(--border-row)] hover:bg-[var(--bg-hover)] min-w-0">
                <span className={`w-7 shrink-0 text-right text-xs font-semibold tabular-nums ${rn == null || rn > 30 ? 'text-amber-400' : 'text-[var(--text-dim)]'}`} title="Momentum rank today (kept while in the top 30)">{rn ?? '>40'}</span>
                <span className="text-sm font-semibold text-[var(--text-primary)] truncate">{p.s}</span>
                <span className="ml-auto shrink-0 text-xs text-[var(--text-dim)] tabular-nums">{price ? `₹${num(price)}` : ''}{tgt.fund > 1e-9 && price ? ` · ≈ ${Math.floor(each / price)} sh` : ''}</span>
              </button>) })}
          </div>
          <p className="px-4 py-2.5 text-[11px] text-[var(--text-dim)]">Left: momentum rank today; a stock that drops below 30 is replaced on {day(data.next_rebalance)}. Tap a stock for its chart.{tgt.fund > 1e-9 ? ` Share counts are rounded down at the ${Object.keys(live?.prices || {}).length ? 'live' : 'last'} price.` : ''}</p>
        </div>
      </>)}

      {/* PAPER */}
      {tab === 'paper' && (<>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Mini label="Value" value={inr(view.liveNav)} sub={`${sgn(g0)}${inr(Math.abs(g0))} · ${pct2(b.invested ? (g0 / b.invested) * 100 : 0)}`} tone={toneZ(g0)} />
          <Mini label="Today" value={live ? `${sgn(view.today)}${inr(Math.abs(view.today))}` : '—'} sub={live ? pct2(view.todayPct) : liveBusy ? 'loading…' : `no live prices${liveErr ? ': ' + liveErr : ''}`} tone={live ? toneZ(view.today) : ''} />
          <Mini label={`vs Nifty 500${nLive && nBase ? ' · live' : ''}`} value={vsWord(vsN)} sub={b.bench ? `Nifty: ${lakhs(benchNow)}` : ''} tone={vsN == null || Math.abs(vsN) < 0.05 ? 'text-[var(--text-muted)]' : tone(vsN)}
            title="Book value now against the same ₹10 lakh put in the Nifty 500 on the start day" />
          <Mini label="Split now" value={`${Math.round((view.stocks / tot) * 100)} / ${Math.round((view.gold / tot) * 100)} / ${Math.round((view.liquid / tot) * 100)}%`} sub="stocks / gold / liquid" />
        </div>

        <div className={`${CARD} overflow-hidden`}>
          <div className={HEAD}>
            <h3 className="text-sm font-bold text-[var(--text-primary)]">Holdings <span className="text-xs font-medium text-[var(--text-dim)]">· {view.nStocks} stocks + gold + liquid</span></h3>
            <div className="flex items-center gap-2 text-xs">
              {open && live && <span className="flex items-center gap-1.5 text-emerald-400 font-semibold"><span className="relative flex w-2 h-2"><span className="absolute inline-flex w-full h-full rounded-full bg-emerald-400 opacity-60 animate-ping" /><span className="relative inline-flex w-2 h-2 rounded-full bg-emerald-400" /></span>Live</span>}
              <span className="text-[var(--text-dim)]">{liveAt ? `${open ? 'Updated' : 'Last price'} ${liveAt}${open ? ' · every minute' : ''}` : `Closing prices ${day(data.updated)}`}</span>
              <button onClick={() => loadLive(data)} disabled={liveBusy} title="Refresh live prices"
                className="p-1.5 rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-50">
                <RefreshCw size={13} className={liveBusy ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border-light)] bg-[var(--bg-inset)]">
                  <SortTh k="rank" sort={sort} setSort={setSort} cls="text-right sm:w-12" title="Momentum rank today (replaced at the next rebalance if below 30)"><span className="max-sm:hidden">Rank</span><span className="sm:hidden">#</span></SortTh>
                  <SortTh k="stock" sort={sort} setSort={setSort} cls="text-left">Stock</SortTh><th className={`${TH} ${PH} text-right`}>Qty</th><th className={`${TH} ${PH} text-right`}>Avg</th>
                  <th className={`${TH} text-right`}>Price</th><SortTh k="today" sort={sort} setSort={setSort} cls="text-right">Today</SortTh>
                  <SortTh k="value" sort={sort} setSort={setSort} cls={`${PH} text-right`}>Value</SortTh><SortTh k="pnl" sort={sort} setSort={setSort} cls={`${PH} text-right`} title="Sorts by rupee gain or loss (▲ biggest gain first, ▼ biggest loss first); click % to sort by percent">P&amp;L</SortTh><SortTh k="pnlPct" sort={sort} setSort={setSort} cls="text-right" title="Sorts by % gain or loss">%</SortTh>
                  <th className={`${TH} ${PH} text-left`}>Weight</th>
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
                      <td className={`${TD} text-left font-semibold ${g ? 'text-amber-400' : lq ? 'text-sky-400' : 'text-[var(--text-primary)]'}`}>{s}{lq && <span className="ml-1.5 text-[10px] font-medium text-[var(--text-dim)] max-sm:hidden">liquid</span>}</td>
                      <td className={`${TDS} ${PH} text-right`}>{num(q)}</td>
                      <td className={`${TDS} ${PH} text-right`}>{num(avg)}</td>
                      <td className={`${TD} text-right transition-colors duration-700 ${flash[s] === 'up' ? 'bg-emerald-500/20 text-emerald-300' : flash[s] === 'down' ? 'bg-rose-500/20 text-rose-300' : 'text-[var(--text-secondary)]'}`}>{num(price)}</td>
                      <td className={`${TD} text-right ${todayPct == null ? 'text-[var(--text-dim)]' : toneZ(todayPct)}`}>{todayPct == null ? '—' : pct(todayPct)}</td>
                      <td className={`${TD} ${PH} text-right text-[var(--text-primary)]`}>{inr(value)}</td>
                      <td className={`${TD} ${PH} text-right font-semibold ${pnlAmt == null ? 'text-[var(--text-dim)]' : toneZ(pnl)}`}>{pnlAmt == null ? '—' : <>{sgn(pnlAmt)}{inr(Math.abs(pnlAmt))}</>}</td><td className={`${TD} text-right ${pnl == null ? 'text-[var(--text-dim)]' : toneZ(pnl)}`}>{pnl == null ? '—' : pct(pnl)}</td>
                      <td className={`${TDS} ${PH} text-left`}>
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-[var(--bg-inset)] overflow-hidden">
                            <div className={`h-full rounded-full ${g ? 'bg-amber-400' : lq ? 'bg-slate-400' : 'bg-lime-400'}`} style={{ width: `${g || lq ? 100 : Math.min(100, (w / view.maxW) * 100)}%` }} />
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

        {trades.length > 0 && <div className={`${CARD} overflow-hidden`}>
          <div className={HEAD}>
            <h3 className="text-sm font-bold text-[var(--text-primary)]">Trades <span className="text-xs font-medium text-[var(--text-dim)]">· newest first</span></h3>
            <span className="text-xs text-[var(--text-dim)]">{trades.length} recent · at the close, 0.2% costs</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-[var(--border-light)] bg-[var(--bg-inset)]">
                <th className={`${TH} text-left`}>Date</th><th className={`${TH} text-left`}>Trade</th><th className={`${TH} text-left`}>Stock</th>
                <th className={`${TH} ${PH} text-right`}>Qty</th><th className={`${TH} ${PH} text-right`}>Price</th><th className={`${TH} text-right`}>Amount</th><th className={`${TH} ${PH} text-left`}>Why</th>
              </tr></thead>
              <tbody>
                {trades.slice(0, allTrades ? trades.length : 10).map((t, i) => (
                  <tr key={`${t[0]}-${t[2]}-${i}`} className="border-b border-[var(--border-row)] last:border-0">
                    <td className={`${TDS} text-left`}>{short(t[0])}</td>
                    <td className={`${TD} text-left`}><span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${t[1] === 'BUY' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-[var(--accent-rose)]'}`}>{t[1]}</span></td>
                    <td className={`${TD} text-left font-semibold text-[var(--text-primary)]`}>{t[2]}</td>
                    <td className={`${TDS} ${PH} text-right`}>{num(t[3])}</td>
                    <td className={`${TDS} ${PH} text-right`}>{num(t[4])}</td>
                    <td className={`${TD} text-right text-[var(--text-primary)]`}>{inr(t[5])}</td>
                    <td className={`${TD} ${PH} text-left text-xs text-[var(--text-dim)]`}>{t[6]}</td>
                  </tr>))}
              </tbody>
            </table>
          </div>
          {trades.length > 10 && <button onClick={() => setAllTrades(!allTrades)} className="px-4 py-2.5 text-xs font-semibold text-sky-300 hover:text-sky-200">{allTrades ? 'Show fewer' : `Show all ${trades.length}`}</button>}
        </div>}
        <p className="text-xs text-[var(--text-dim)]">Tap a stock for its chart · paper trading only · information, not advice. Books A to F were retired on 24 Oct 2026; their final values are on the Momentum Paper Books page.</p>
      </>)}

      {/* RULE */}
      {tab === 'rule' && (<>
        {R ? <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              ['12 months', C.r12 >= RULE.hi ? 'strong' : C.r12 < RULE.lo ? 'weak' : 'normal', `The index fund ${C.r12 < 0 ? 'fell' : 'rose'} ${ap(C.r12)} in a year`, C.e === RULE.eLo ? 'Base share 20% in stocks' : C.e === RULE.eHi ? 'Base share 80%, held at most 70%' : 'Base share 50% in stocks', C.e === RULE.eMid ? 'ok' : C.e === RULE.eLo ? 'warn' : 'good'],
              ['Recent weeks', C.x < 1 ? 'guard on' : C.up ? 'notch up' : 'quiet', `${ap(C.gap)} ${C.gap < 0 ? 'below' : 'above'} the 50-day average`, C.x < 1 ? 'Half the stock money parked in gold' : C.up ? (C.e >= CAP ? 'Already at the 70% maximum' : 'One step more in stocks') : 'Base share stays', C.x < 1 ? 'warn' : C.up ? 'good' : 'ok'],
              ['Sharp fall', C.fast ? 'yes' : 'no', `${ap(C.fgap)} ${C.fgap < 0 ? 'below' : 'above'} the 20-day average`, C.fast ? 'All stock money waits in liquid' : 'Nothing moved to liquid for this', C.fast ? 'bad' : 'ok'],
              ['Gold limit', C.goldOver > 0.001 ? 'hit' : 'not hit', 'Gold is never more than 60%', C.goldOver > 0.001 ? `${Math.round(C.goldOver * 100)}% waits in liquid instead` : 'All the rest is in gold', C.goldOver > 0.001 ? 'warn' : 'ok'],
            ].map(([t, state, l1, l2, tn]) => (
              <div key={t} className={`${CARD} px-4 py-3 min-w-0`}>
                <div className="flex items-center justify-between gap-2"><p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-dim)]">{t}</p>
                  <span className={`shrink-0 whitespace-nowrap px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${tn === 'good' ? 'bg-emerald-500/15 text-emerald-400' : tn === 'warn' ? 'bg-amber-500/15 text-amber-400' : tn === 'bad' ? 'bg-rose-500/15 text-[var(--accent-rose)]' : 'bg-[var(--bg-inset)] text-[var(--text-muted)]'}`}>{state}</span></div>
                <p className="mt-1.5 text-sm text-[var(--text-primary)]">{l1}</p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">{l2}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-[var(--text-dim)] -mt-1">{N ? `Checks from the ${day(R.asOf)} close; the switch is at the ${day(N.date)} close. ` : ''}The same checks as the Fund rule page, on the Midcap150 Momentum 50 index fund's price: the week's last close and the month's last close{N ? '' : '; the switch is at the next close'}. Stocks are capped at 70% instead of 80%.</p>
        </> : <p className="text-sm text-[var(--text-dim)]">{hist === undefined ? 'Loading the index fund\'s prices…' : 'The index fund\'s prices did not load, so the four checks are not shown.'}</p>}

        <div className={`${CARD} overflow-hidden`}>
          <div className={HEAD}><h3 className="text-sm font-bold text-[var(--text-primary)]">How the 15 stocks are picked</h3><span className="text-xs text-[var(--text-dim)]">once a month, at the month's last close</span></div>
          <ol className="px-4 py-3 space-y-1.5 text-sm text-[var(--text-secondary)] list-decimal list-inside">
            <li><span className="font-semibold text-[var(--text-primary)]">List:</span> the 1000 most-traded NSE stocks (6-month median), only those trading at least ₹2 crore a day.</li>
            <li><span className="font-semibold text-[var(--text-primary)]">Score:</span> the 6-month return divided by its volatility, so steady risers rank above jumpy ones.</li>
            <li><span className="font-semibold text-[var(--text-primary)]">Keep:</span> a stock held stays while it ranks in the top 30.</li>
            <li><span className="font-semibold text-[var(--text-primary)]">New buys:</span> the best-ranked fresh names (not in the top 100 three months ago), skipping one that moves too closely with two already picked.</li>
            <li><span className="font-semibold text-[var(--text-primary)]">Weights:</span> equal, 1/15 of the stock money each.</li>
          </ol>
        </div>

        <div className={`${CARD} overflow-hidden`}>
          <div className={HEAD}><h3 className="text-sm font-bold text-[var(--text-primary)]">Back-test</h3><span className="text-xs text-[var(--text-dim)]">Jul 2015 – Sep 2026 · real switch timing · 0.2% per trade</span></div>
          <div className="px-4 py-3 grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[['Before tax', '31.2%', 'a year · Nifty 500 12.0%'], ['After tax', '26–28%', 'a year · tax paid as it goes'], ['Worst fall', '−16.2%', 'Nifty 500 −38.1%'], ['Worst 12 months', '−12.5%', '4% of 12-month spans lost']].map(([l, v, s]) => (
              <div key={l} className="rounded-xl border border-[var(--border)] bg-[var(--bg-inset)] px-3 py-2.5 min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-dim)]">{l}</p>
                <p className="mt-1 text-lg font-bold tabular-nums text-[var(--text-primary)]">{v}</p>
                <p className="text-[11px] text-[var(--text-dim)]">{s}</p>
              </div>))}
          </div>
          <div className="px-4 pb-3 overflow-x-auto">
            <table className="w-full max-w-md">
              <thead><tr className="border-b border-[var(--border-light)]"><th className={`${TH} text-left !px-0`}>Year</th><th className={`${TH} text-right`}>H</th><th className={`${TH} text-right`}>Nifty 500</th></tr></thead>
              <tbody>
                {BT_YEARS.map(([y, h, n]) => (
                  <tr key={y} className="border-b border-[var(--border-row)] last:border-0">
                    <td className={`${TDS} text-left !px-0`}>{y}</td>
                    <td className={`${TD} text-right font-semibold ${tone(h)}`}>{pct(h)}</td>
                    <td className={`${TD} text-right ${tone(n)}`}>{pct(n)}</td>
                  </tr>))}
              </tbody>
            </table>
          </div>
          <p className="px-4 pb-3 text-[11px] text-[var(--text-dim)]">Rolling: the worst 3 years still made 16.7% a year (median 30.1%), the worst 5 years 20.6% (median 35.0%). Before the delays from circuit limits (about 1.6 points a year) and without dividends. A back-test, not a forecast{isAdmin ? <>; <a href={REPORT_URL} target="_blank" rel="noreferrer" className="font-semibold text-sky-300 hover:text-sky-200">full report</a></> : ''}.</p>
        </div>

        {R && R.log.length > 0 && <div className={`${CARD} overflow-hidden`}>
          <div className={HEAD}><h3 className="text-sm font-bold text-[var(--text-primary)]">Switches</h3><span className="text-xs text-[var(--text-dim)]">{R.log.length} since {day(R.full[0][0])} · newest first</span></div>
          <div className="divide-y divide-[var(--border-row)]">
            {R.log.slice(0, allSw ? R.log.length : 6).map((l) => (
              <div key={l.date} className="px-4 py-2.5">
                <div className="flex items-center gap-2 flex-wrap text-sm"><span className="font-semibold text-[var(--text-primary)] tabular-nums">{day(l.date)}</span><span className="text-[var(--text-secondary)]">{stocksSplit(l.target)}</span></div>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">{l.why}</p>
              </div>))}
          </div>
          {R.log.length > 6 && <button onClick={() => setAllSw(!allSw)} className="px-4 py-2.5 text-xs font-semibold text-sky-300 hover:text-sky-200">{allSw ? 'Show fewer' : `Show all ${R.log.length} switches`}</button>}
        </div>}
      </>)}

      {chartSym && <BigChart data={data} sym={chartSym} livePrice={livePx(chartSym)} onClose={() => setChartSym(null)} />}
    </div>
  )
}
