import { useEffect, useMemo, useState } from 'react'
import { Navigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import MFRebalanceDialog from '../components/forms/MFRebalanceDialog'
import { getNavHistory, getNavHistories } from '../utils/navHistory'
import { getResearchViewers, setResearchViewers } from '../services/api'

// Hidden admin page (/admin/fund-rule): the index-fund + gold rule (paper book G) applied to ONE real mutual-fund portfolio,
// the "satellite". Reads daily NAVs from api.mfapi.in (same source as the fund charts), replays the rule up to the last NAV
// and shows today's target split and the switches that would bring the satellite to it. Information, not advice.
//
// The rule (same as fund.py, back-test after tax Jan 2010 - Sep 2026: 24.4% a year, worst fall -17%):
//  monthly (at the month's last NAV): index fund's 12-month return < 0 -> 20% fund, > +20% -> 80%, else 50%; rest gold
//  weekly (at the week's last NAV), vs the 50-day average: 2% below -> fund sleeve halved into gold (until 2% above);
//    2% above -> one notch up (50 -> 80, 80 -> 100); in between -> the monthly share
//  crash guard, vs the 20-day average: 4% below -> the whole fund sleeve into the liquid fund until back above the average
//  gold never above 60%: the excess waits in the liquid fund. A sleeve is moved only when > 5% off its target.
const RULE = { lo: 0, hi: 0.20, eLo: 0.2, eMid: 0.5, eHi: 0.8, k: 50, band: 0.02, cut: 0.5, notch: { 0.5: 0.8, 0.8: 1 },
  fastK: 20, fastBand: 0.04, goldCap: 0.6, tradeBand: 0.05, look: 248 }
const SIGNAL_FUNDS = [[150738, 'Tata Nifty Midcap 150 Momentum 50 Index Fund (Direct)'], [150902, 'Edelweiss Nifty Midcap150 Momentum 50 Index Fund (Direct)'], [152916, 'Kotak Nifty Midcap 150 Momentum 50 Index Fund (Direct)']]
const LS = 'cf-fund-rule'
const DEFAULT_GOLD = 118663, DEFAULT_LIQ = 119861, MIDCAP150 = 147622   // Nippon India Gold Savings, Tata Liquid, Motilal Oswal Nifty Midcap 150 Index (direct, growth)

const inr = (v) => (v == null ? '—' : '₹' + Math.round(v).toLocaleString('en-IN'))
const ap = (v, d = 1) => (v == null ? '—' : (Math.abs(v) * 100).toFixed(d) + '%')   // size of a move, no sign
const pct = (v, d = 1) => (v == null ? '—' : (v > 0 ? '+' : '') + (v * 100).toFixed(d) + '%')
const day = (d) => (d ? new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')
const iso = (t) => new Date(t * 1000).toISOString().slice(0, 10)
const isoWeek = (d) => { const x = new Date(d + 'T00:00:00Z'); const n = (x.getUTCDay() + 6) % 7; x.setUTCDate(x.getUTCDate() - n + 3); const y = x.getUTCFullYear(); const j4 = new Date(Date.UTC(y, 0, 4)); return y + '-' + Math.round(1 + ((x - j4) / 864e5 - 3 + ((j4.getUTCDay() + 6) % 7)) / 7) }
const trendE = (r) => (r < RULE.lo ? RULE.eLo : r > RULE.hi ? RULE.eHi : RULE.eMid)
const fundShare = (e, x, up) => (x < 1 ? e * x : up ? (RULE.notch[e] ?? e) : e)
function targets(e, x, up, fast) {
  const fs = fundShare(e, x, up)
  const w = fast ? { fund: 0, gold: 1 - fs, liq: fs } : { fund: fs, gold: 1 - fs, liq: 0 }
  if (w.gold > RULE.goldCap) { w.liq += w.gold - RULE.goldCap; w.gold = RULE.goldCap }
  return w
}
const same = (a, b) => a && b && Math.abs(a.fund - b.fund) < 1e-9 && Math.abs(a.gold - b.gold) < 1e-9
const split = (w) => `${Math.round(w.fund * 100)}% fund / ${Math.round(w.gold * 100)}% gold${w.liq > 0.001 ? ` / ${Math.round(w.liq * 100)}% liquid` : ''}`

/** Replay the rule over the NAV history exactly as fund.py does (decide at the month's / week's last NAV, act at the next). */
function replay(hist) {
  const dates = hist.times.map(iso), nav = hist.navs, n = nav.length
  const mean = (i, k) => { let s = 0; for (let j = i - k + 1; j <= i; j++) s += nav[j]; return s / k }
  const S = { e: null, x: 1, up: false, fast: false, r12: null, gap: null, fgap: null, target: null }
  const log = [], series = []
  for (let i = RULE.look + 5; i < n; i++) {
    const d = dates[i], p = dates[i - 1], why = []
    if (S.e == null || d.slice(0, 7) !== p.slice(0, 7)) {              // new month: trend from the previous month's last NAV
      S.r12 = nav[i - 1] / nav[i - 1 - RULE.look] - 1; const e = trendE(S.r12)
      if (S.e != null && e !== S.e) why.push(`Over the last 12 months the fund ${S.r12 < 0 ? 'fell' : 'rose'} ${ap(S.r12)}, so the base share in the fund is now ${e * 100}%`)
      S.e = e
    }
    if (S.gap == null || isoWeek(d) !== isoWeek(p)) {                    // new week: guards from last week's last NAV
      S.gap = nav[i - 1] / mean(i - 1, RULE.k) - 1; let x = S.x; const up = S.gap > RULE.band
      if (S.gap < -RULE.band) x = 1 - RULE.cut; else if (S.gap > RULE.band) x = 1
      if (x !== S.x) why.push(x < 1 ? `The fund dropped ${ap(S.gap)} below its 50-day average: half the fund money moved to gold` : `The fund is back ${pct(S.gap)} above its 50-day average: the fund money comes back`)
      if (up !== S.up && x === 1) why.push(up ? `The fund is ${pct(S.gap)} above its 50-day average (rising well): one step more in the fund` : `The fund is only ${pct(S.gap)} vs its 50-day average: back to the base share`)
      S.x = x; S.up = up
      S.fgap = nav[i - 1] / mean(i - 1, RULE.fastK) - 1; let fast = S.fast
      if (S.fgap < -RULE.fastBand) fast = true; else if (S.fgap > 0) fast = false
      if (fast !== S.fast) why.push(fast ? `Sharp fall: the fund is ${ap(S.fgap)} below its 20-day average, so all fund money waits in the liquid fund` : `The sharp fall is over (fund back above its 20-day average): fund money goes back in`)
      S.fast = fast
    }
    const t = targets(S.e, S.x, S.up, S.fast)
    if (!same(t, S.target)) log.push({ date: d, why: why.join('. ') || 'Start of the history', target: t })
    S.target = t; series.push([d, nav[i], t.fund, t.gold, t.liq])
  }
  return { ...S, asOf: dates[n - 1], nav: nav[n - 1], log: log.slice().reverse(), series: series.slice(-260), full: series, days: n }
}

const detect = (hs, re) => hs.find((h) => re.test(h.fundName || ''))?.schemeCode || ''

/** Last 12 months: the fund's price with the share held in the fund underneath, then each switch as a card. */
function History({ R, colors }) {
  const [all, setAll] = useState(false)
  const pts = R.series; const n = pts.length
  const W = 960, H = 220, L = 8, Rm = 72, T = 10, B = 24, bandH = 44   // bottom band = fund share 0–100%
  const navs = pts.map((p) => p[1]); const lo = Math.min(...navs), hi = Math.max(...navs), pad = (hi - lo) * 0.06 || 1
  const X = (i) => L + ((W - L - Rm) * i) / Math.max(1, n - 1)
  const Y = (v) => T + (H - T - B - bandH - 8) * (1 - (v - (lo - pad)) / (hi + pad - (lo - pad)))
  const YB = (f) => H - B - f * bandH
  const line = pts.map((p, i) => `${X(i).toFixed(1)},${Y(p[1]).toFixed(1)}`).join(' ')
  // fund share as a step area
  let band = `${X(0).toFixed(1)},${YB(0).toFixed(1)}`
  pts.forEach((p, i) => { if (i > 0) band += ` ${X(i).toFixed(1)},${YB(pts[i - 1][2]).toFixed(1)}`; band += ` ${X(i).toFixed(1)},${YB(p[2]).toFixed(1)}` })
  band += ` ${X(n - 1).toFixed(1)},${YB(0).toFixed(1)}`
  const idx = Object.fromEntries(pts.map((p, i) => [p[0], i]))
  const marks = R.log.filter((l) => l.date in idx)
  const chg = n > 1 ? (navs[n - 1] / navs[0] - 1) * 100 : 0
  const shown = all ? R.log : R.log.slice(0, 6)
  const Bar = ({ t }) => (
    <div className="flex h-2 w-full rounded-full overflow-hidden bg-[var(--bg-inset)]">
      {['fund', 'gold', 'liq'].map((k) => t[k] > 0.001 && <div key={k} className={colors[k]} style={{ width: `${t[k] * 100}%` }} />)}
    </div>)
  return (
    <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] overflow-hidden">
      <div className="px-4 py-2.5 border-b border-[var(--border-light)] flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-sm font-bold text-[var(--text-primary)]">Last 12 months</h3>
        <span className="text-xs text-[var(--text-dim)]">fund price {pct(chg / 100)} · {R.log.filter((l) => l.date >= pts[0][0]).length} switches · the blue band below the line is the share held in the fund</span>
      </div>
      <div className="px-4 pt-3">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Fund price and the share held in the fund">
          {[hi, lo].map((v) => <g key={v}><line x1={L} x2={W - Rm} y1={Y(v)} y2={Y(v)} stroke="var(--border)" strokeDasharray="3 4" /><text x={W - Rm + 6} y={Y(v) + 4} fontSize="11" fill="var(--text-dim)">₹{v.toFixed(2)}</text></g>)}
          <polyline points={line} fill="none" strokeWidth="2" strokeLinejoin="round" className={chg >= 0 ? 'stroke-emerald-400' : 'stroke-rose-400'} />
          <polygon points={band} className="fill-sky-400/30" />
          <line x1={L} x2={W - Rm} y1={YB(0)} y2={YB(0)} stroke="var(--border)" />
          {[1, 0.5].map((f) => <g key={f}><line x1={L} x2={W - Rm} y1={YB(f)} y2={YB(f)} stroke="var(--border)" strokeDasharray="2 4" /><text x={W - Rm + 6} y={YB(f) + 4} fontSize="11" fill="var(--text-dim)">{f * 100}% fund</text></g>)}
          {marks.map((l) => <g key={l.date}><line x1={X(idx[l.date])} x2={X(idx[l.date])} y1={T} y2={YB(0)} stroke="var(--text-dim)" strokeDasharray="2 3" opacity="0.6" /><circle cx={X(idx[l.date])} cy={YB(l.target.fund)} r="3.5" className="fill-sky-400" /></g>)}
          <text x={L} y={H - 7} fontSize="11" fill="var(--text-dim)">{day(pts[0][0])}</text>
          <text x={W - Rm} y={H - 7} fontSize="11" fill="var(--text-dim)" textAnchor="end">{day(pts[n - 1][0])}</text>
        </svg>
      </div>
      <div className="px-4 py-3 border-t border-[var(--border-light)]">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-dim)] mb-2">Switches, newest first</p>
        <div className="grid gap-2 md:grid-cols-2">
          {shown.map((l) => (
            <div key={l.date} className="rounded-xl border border-[var(--border)] bg-[var(--bg-inset)] px-3.5 py-2.5">
              <div className="flex items-center justify-between gap-3 mb-1.5">
                <span className="text-xs font-semibold tabular-nums text-[var(--text-primary)]">{day(l.date)}</span>
                <span className="text-xs tabular-nums text-[var(--text-secondary)]">{split(l.target)}</span>
              </div>
              <Bar t={l.target} />
              <p className="text-xs text-[var(--text-muted)] mt-1.5">{l.why}</p>
            </div>
          ))}
        </div>
        {R.log.length > 6 && <button onClick={() => setAll(!all)} className="mt-3 text-xs font-semibold text-sky-300 hover:text-sky-200">{all ? 'Show fewer' : `Show all ${R.log.length} switches`}</button>}
        <p className="text-[11px] text-[var(--text-dim)] mt-3">Back-test 2010–2026, after tax: about 24% a year with a worst fall of 17%; holding the fund alone 21% with a 39% fall. Past results do not repeat; plan with 16–18% a year.</p>
      </div>
    </div>
  )
}

/** ₹100 invested from a chosen date: the rule (fund / gold / liquid switched as the rule said, re-split when the target changes)
 *  against the fund alone, a fixed 60/40 fund/gold, gold alone and a Nifty 50 index fund. Before tax and exit loads. */
function Growth({ R, goldCode, liqCode, defaultStart }) {
  const [hs, setHs] = useState(null)
  const first = R.full[0][0]
  const peak = R.full.reduce((b, r) => (r[1] > b[1] ? r : b), R.full[0])[0]                       // the fund's highest price so far
  const [start, setStart] = useState(() => (defaultStart && defaultStart > first ? defaultStart : peak))   // default: from the peak (the hard test); from your first investment once the satellite exists
  const yearAgo = R.full.filter((r) => r[0] <= new Date(new Date(R.asOf) - 365 * 864e5).toISOString().slice(0, 10)).slice(-1)[0]?.[0] || first
  const presets = [['Since start', first, 'From the first day the rule could decide'], [`Fund's peak (${day(peak).replace(/ \d{4}$/, '')} ${peak.slice(0, 4)})`, peak, 'From the fund\'s highest price: how the rule handled the fall after it'], ['1 year', yearAgo, 'Last 12 months']]
  if (defaultStart && defaultStart > first) presets.push(['Since my first investment', defaultStart, 'From the first transaction in the satellite'])
  useEffect(() => { let on = true; getNavHistories([String(goldCode), String(liqCode), String(MIDCAP150)]).then((m) => { if (on) setHs(m) }); return () => { on = false } }, [goldCode, liqCode])
  const sim = useMemo(() => {
    if (!hs) return null
    const look = (code) => { const h = hs.get(String(code)); if (!h) return null; const m = new Map(h.times.map((t, i) => [iso(t), h.navs[i]])); return m }
    const G = look(goldCode), Lq = look(liqCode), N = look(MIDCAP150)
    if (!G || !Lq) return null
    const rows = R.full.filter((r) => r[0] >= start)
    if (rows.length < 5) return null
    // forward-fill the other NAVs on the fund's dates
    let g = null, l = null, nf = null; const px = rows.map((r) => { g = G.get(r[0]) ?? g; l = Lq.get(r[0]) ?? l; nf = N?.get(r[0]) ?? nf; return { d: r[0], f: r[1], g, l, n: nf, t: { fund: r[2], gold: r[3], liq: r[4] } } }).filter((p) => p.g && p.l)
    if (px.length < 5) return null
    const run = (targetAt) => {   // units of each sleeve; re-split to the target whenever the target changes
      let u = null, last = null; const out = []
      px.forEach((p, i) => {
        const t = targetAt(p, i); const v = u ? u.f * p.f + u.g * p.g + u.l * p.l : 100
        if (!u || t.fund !== last.fund || t.gold !== last.gold) { u = { f: (v * t.fund) / p.f, g: (v * t.gold) / p.g, l: (v * t.liq) / p.l }; last = t }
        out.push(v)
      })
      return out
    }
    const rule = run((p) => p.t)
    const fund = run(() => ({ fund: 1, gold: 0, liq: 0 }))
    const gold = run(() => ({ fund: 0, gold: 1, liq: 0 }))
    const mid = px[0].n ? px.map((p) => (100 * p.n) / px[0].n) : null   // plain Midcap 150 index fund, for the "did momentum + the rule add anything" question
    const yrs = (new Date(px[px.length - 1].d) - new Date(px[0].d)) / 365.25 / 864e5
    const cagr = (a) => (yrs >= 0.9 ? ((a[a.length - 1] / 100) ** (1 / yrs) - 1) * 100 : null)
    const dd = (a) => { let pk = 0, m = 0; a.forEach((v) => { pk = Math.max(pk, v); m = Math.min(m, v / pk - 1) }); return m * 100 }
    const L = [['The rule', rule, 'stroke-sky-400', 'text-sky-300'], ['Midcap 150 Momentum 50 fund', fund, 'stroke-rose-400', 'text-rose-300']]
    if (mid) L.push(['Midcap 150 index fund', mid, 'stroke-violet-400', 'text-violet-300'])
    L.push(['Gold', gold, 'stroke-amber-400', 'text-amber-300'])
    return { dates: px.map((p) => p.d), lines: L.map(([nm, a, sc, tc]) => ({ nm, a, sc, tc, end: a[a.length - 1], cagr: cagr(a), dd: dd(a) })), yrs }
  }, [hs, R, start, goldCode, liqCode])
  const W = 960, H = 240, L = 8, Rm = 64, T = 10, B = 24
  return (
    <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] overflow-hidden">
      <div className="px-4 py-2.5 border-b border-[var(--border-light)] flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-sm font-bold text-[var(--text-primary)]">₹100 invested {start === peak ? <span className="text-xs font-medium text-[var(--text-dim)]">· at the fund's peak, {day(peak)} — the hard test</span> : null}</h3>
        <div className="flex items-center gap-1.5 text-xs flex-wrap">
          {presets.map(([l, d, title]) => <button key={l} title={title} onClick={() => setStart(d)} className={`px-2 py-1 rounded-lg border font-semibold ${start === d ? 'bg-sky-500/20 border-sky-500/40 text-sky-300' : 'border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}>{l}</button>)}
          <input type="date" value={start} min={first} max={R.asOf} onChange={(e) => e.target.value && setStart(e.target.value)} className="rounded-lg border border-[var(--border)] bg-[var(--bg-input)] px-2 py-1 text-xs text-[var(--text-primary)]" />
          {sim && <span className="text-[var(--text-dim)]">· {sim.yrs.toFixed(1)} yrs</span>}
        </div>
      </div>
      {!hs && <p className="px-4 py-6 text-sm text-[var(--text-dim)]">Loading gold and liquid fund prices…</p>}
      {hs && !sim && <p className="px-4 py-6 text-sm text-[var(--text-dim)]">Not enough price history from that date (the rule needs the fund's first year for its signals; pick a date from {day(first)}).</p>}
      {sim && (() => {
        const all = sim.lines.flatMap((l) => l.a); const lo = Math.min(...all) * 0.98, hi = Math.max(...all) * 1.02; const n = sim.dates.length
        const X = (i) => L + ((W - L - Rm) * i) / (n - 1), Y = (v) => T + (H - T - B) * (1 - (v - lo) / (hi - lo))
        return (<>
          <div className="px-4 pt-3">
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Growth of 100 rupees">
              {[100, Math.round(hi / 10) * 10].map((v) => v > lo && v < hi && <g key={v}><line x1={L} x2={W - Rm} y1={Y(v)} y2={Y(v)} stroke="var(--border)" strokeDasharray="3 4" /><text x={W - Rm + 6} y={Y(v) + 4} fontSize="11" fill="var(--text-dim)">₹{v}</text></g>)}
              {sim.lines.slice().reverse().map((l) => <polyline key={l.nm} points={l.a.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ')} fill="none" strokeWidth={l.nm === 'The rule' ? 2.6 : 1.6} strokeLinejoin="round" className={l.sc} opacity={l.nm === 'The rule' ? 1 : 0.85} />)}
              <text x={L} y={H - 7} fontSize="11" fill="var(--text-dim)">{day(sim.dates[0])}</text>
              <text x={W - Rm} y={H - 7} fontSize="11" fill="var(--text-dim)" textAnchor="end">{day(sim.dates[n - 1])}</text>
            </svg>
          </div>
          <div className="px-4 py-3 border-t border-[var(--border-light)] grid grid-cols-2 lg:grid-cols-4 gap-3">
            {sim.lines.map((l) => (
              <div key={l.nm} className="rounded-xl border border-[var(--border)] bg-[var(--bg-inset)] px-3 py-2.5 min-w-0">
                <p className={`text-xs font-semibold ${l.tc}`}>{l.nm}</p>
                <p className={`mt-1 text-2xl font-bold tabular-nums ${l.end >= 100 ? 'text-emerald-400' : 'text-[var(--accent-rose)]'}`}>{l.end >= 100 ? '+' : ''}{(l.end - 100).toFixed(1)}%</p>
                <div className="mt-1 flex items-baseline justify-between gap-2 text-xs tabular-nums">
                  <span className="text-[var(--text-secondary)]">{l.cagr != null ? `${l.cagr >= 0 ? '+' : ''}${l.cagr.toFixed(1)}% a year` : '—'}</span>
                  <span className="font-semibold text-[var(--accent-rose)]">fall {l.dd.toFixed(0)}%</span>
                </div>
                <p className="text-[11px] text-[var(--text-dim)] tabular-nums">₹100 → ₹{l.end.toFixed(1)}</p>
              </div>
            ))}
          </div>
          <p className="px-4 pb-3 text-[11px] text-[var(--text-dim)]">Before tax and exit loads, from real fund prices (Tata Midcap 150 Momentum 50, Motilal Oswal Midcap 150, Nippon India Gold Savings, Tata Liquid — or your satellite's funds once chosen). The rule's signals need the fund's first year, so the earliest start is {day(first)}. Short windows say little; the back-test behind the rule covers 2010–2026.</p>
        </>)
      })()}
    </div>
  )
}

/** The satellite's own numbers from its transactions: what you actually put in and what it is worth. */
function RealReturns({ real }) {
  const tone = real.gain >= 0 ? 'text-emerald-400' : 'text-[var(--accent-rose)]'
  const tile = (l, v, sub, cls = 'text-[var(--text-primary)]') => (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-inset)] px-3 py-2.5 min-w-0"><p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-dim)]">{l}</p><p className={`mt-1 text-lg font-bold tabular-nums ${cls}`}>{v}</p>{sub && <p className="text-[11px] text-[var(--text-dim)]">{sub}</p>}</div>)
  return (
    <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] overflow-hidden">
      <div className="px-4 py-2.5 border-b border-[var(--border-light)] flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-sm font-bold text-[var(--text-primary)]">My satellite · real result</h3>
        <span className="text-xs text-[var(--text-dim)]">since {day(real.since)} · {Math.round(real.days)} days · from your own transactions and today's values</span>
      </div>
      <div className="px-4 py-3 grid grid-cols-2 lg:grid-cols-4 gap-3">
        {tile('Put in', inr(real.invested), real.redeemed ? `${inr(real.redeemed)} taken out` : null)}
        {tile('Worth now', inr(real.value))}
        {tile('Gain', (real.gain >= 0 ? '+' : '−') + inr(Math.abs(real.gain)), `${real.gain >= 0 ? '+' : ''}${((real.gain / real.invested) * 100).toFixed(1)}% on what you put in`, tone)}
        {tile('Return a year (XIRR)', real.xirr == null ? '—' : `${real.xirr >= 0 ? '+' : ''}${real.xirr.toFixed(1)}%`, real.xirr == null ? 'needs at least a month' : 'money-weighted, before tax', real.xirr == null ? 'text-[var(--text-primary)]' : real.xirr >= 0 ? 'text-emerald-400' : 'text-[var(--accent-rose)]')}
      </div>
      <p className="px-4 pb-3 text-[11px] text-[var(--text-dim)]">Compare with the "Since my first investment" line in the ₹100 card above: that is what the rule would have done with ₹100 from the same day; this is what your money actually did, switches, timing and all.</p>
    </div>
  )
}

/** Admin: the emails that may open the fund-rule and paper-books pages (read-only). Kept on the server. */
function Viewers() {
  const { showToast } = useToast()
  const [list, setList] = useState(null); const [text, setText] = useState(''); const [busy, setBusy] = useState(false)
  useEffect(() => { getResearchViewers().then((r) => { setList(r.viewers || []); setText((r.viewers || []).join('\n')) }).catch(() => setList([])) }, [])
  const save = async () => {
    setBusy(true)
    try { const r = await setResearchViewers(text.split(/[\s,;]+/).filter(Boolean)); setList(r.viewers || []); setText((r.viewers || []).join('\n')); showToast('Viewers saved') }
    catch (e) { showToast(e.message || 'Could not save', 'error') } finally { setBusy(false) }
  }
  return (
    <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] overflow-hidden">
      <div className="px-4 py-2.5 border-b border-[var(--border-light)] flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-sm font-bold text-[var(--text-primary)]">Who else can see these pages</h3>
        <span className="text-xs text-[var(--text-dim)]">{list ? `${list.length} viewer${list.length === 1 ? '' : 's'}` : 'loading…'} · they get Fund rule + Paper books, read-only; Found us stays yours</span>
      </div>
      <div className="px-4 py-3 grid gap-2 md:grid-cols-[1fr_auto] items-start">
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="one email per line" className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-input)] px-2.5 py-1.5 text-sm text-[var(--text-primary)]" />
        <button onClick={save} disabled={busy || list == null} className="px-3 py-1.5 rounded-lg bg-sky-500/20 border border-sky-500/40 text-sky-300 text-xs font-semibold disabled:opacity-50">{busy ? 'Saving…' : 'Save viewers'}</button>
      </div>
      <p className="px-4 pb-3 text-[11px] text-[var(--text-dim)]">They must sign in to Capital Friends with that Google account; the pages then appear under a "Research · shared with you" menu. Their own portfolios are never shown here.</p>
    </div>
  )
}

export default function FundRulePage() {
  const { isAdmin, isResearch } = useAuth()
  const { mfPortfolios, mfHoldings, mfTransactions, updateHoldingAllocations } = useData()
  const { showToast } = useToast()
  const [saving, setSaving] = useState(false)
  const [cfg, setCfg] = useState(() => { try { return { signal: 150738, portfolioId: '', fund: '', gold: '', liq: '', ...JSON.parse(localStorage.getItem(LS) || '{}') } } catch { return { signal: 150738, portfolioId: '', fund: '', gold: '', liq: '' } } })
  const [hist, setHist] = useState(undefined)
  const set = (k, v) => setCfg((c) => { const n = { ...c, [k]: v }; try { localStorage.setItem(LS, JSON.stringify(n)) } catch { /* ignore */ } return n })

  useEffect(() => { if (!isResearch) return; setHist(undefined); getNavHistory(cfg.signal).then((h) => setHist(h && h.times?.length > RULE.look + 60 ? h : null)) }, [isAdmin, cfg.signal])
  const R = useMemo(() => (hist ? replay(hist) : null), [hist])

  const portfolios = (mfPortfolios || []).filter((p) => p.status !== 'Inactive')
  const holdings = useMemo(() => (mfHoldings || []).filter((h) => h.portfolioId === cfg.portfolioId && Number(h.units) > 0.0005), [mfHoldings, cfg.portfolioId])
  useEffect(() => {   // first time a satellite is chosen: guess which holding plays which part
    if (!holdings.length || cfg.fund || cfg.gold || cfg.liq) return
    set('fund', detect(holdings, /momentum/i)); set('gold', detect(holdings, /gold/i)); set('liq', detect(holdings, /liquid|overnight|money market/i))
  }, [holdings])  // eslint-disable-line react-hooks/exhaustive-deps

  const plan = useMemo(() => {
    if (!R) return null
    const val = (code) => holdings.filter((h) => String(h.schemeCode) === String(code)).reduce((a, h) => a + (Number(h.currentValue) || 0), 0)
    const cur = { fund: val(cfg.fund), gold: val(cfg.gold), liq: val(cfg.liq) }
    const total = cur.fund + cur.gold + cur.liq
    const rows = ['fund', 'gold', 'liq'].map((k) => {
      const tgt = total * R.target[k], diff = tgt - cur[k]
      const move = Math.abs(diff) > Math.max(500, RULE.tradeBand * tgt)
      return { k, cur: cur[k], curPct: total ? cur[k] / total : 0, tgt, diff, move }
    })
    return { total, rows, moves: rows.filter((r) => r.move) }
  }, [R, holdings, cfg.fund, cfg.gold, cfg.liq])

  // the rule's split as the satellite's target % (the app's own rebalance dialog then does buy/sell, lumpsum and SIP maths)
  const alloc = useMemo(() => {
    if (!R || !cfg.portfolioId) return null
    const pc = { [cfg.fund]: Math.round(R.target.fund * 100), [cfg.gold]: Math.round(R.target.gold * 100), [cfg.liq]: Math.round(R.target.liq * 100) }
    delete pc['']; const sum = Object.values(pc).reduce((a, b) => a + b, 0)
    if (sum !== 100 && cfg.gold in pc) pc[cfg.gold] += 100 - sum
    return holdings.map((h) => ({ schemeCode: h.schemeCode, fundName: h.fundName, targetAllocationPct: pc[String(h.schemeCode)] ?? 0 }))
  }, [R, cfg, holdings])
  const synced = alloc && alloc.length > 0 && alloc.every((a) => Math.abs(Number(holdings.find((h) => String(h.schemeCode) === String(a.schemeCode))?.targetAllocationPct || 0) - a.targetAllocationPct) < 0.5)
  const saveTargets = async () => {
    if (!alloc) return
    setSaving(true)
    try { await updateHoldingAllocations(cfg.portfolioId, alloc); showToast('Satellite targets set to the rule\'s split') }
    catch (e) { showToast(e.message || 'Could not save targets', 'error') }
    finally { setSaving(false) }
  }

  const firstTxn = useMemo(() => { const ds = (mfTransactions || []).filter((t) => t.portfolioId === cfg.portfolioId).map((t) => String(t.date || t.transactionDate || '').slice(0, 10)).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)); return ds.length ? ds.sort()[0] : null }, [mfTransactions, cfg.portfolioId])

  // the satellite's real result: invested, value, gain, XIRR from its own transactions (the real number the ₹100 chart cannot know)
  const real = useMemo(() => {
    if (!cfg.portfolioId) return null
    const tx = (mfTransactions || []).filter((t) => t.portfolioId === cfg.portfolioId && /^\d{4}-\d{2}-\d{2}/.test(String(t.date || '')))
    const value = holdings.reduce((a, h) => a + (Number(h.currentValue) || 0), 0)
    if (!tx.length || !(value > 0)) return null
    const flows = tx.map((t) => ({ d: new Date(String(t.date).slice(0, 10)), v: (String(t.type).toUpperCase() === 'SELL' ? 1 : -1) * Math.abs(Number(t.totalAmount || t.amount) || 0) })).filter((f) => f.v)
    const invested = -flows.filter((f) => f.v < 0).reduce((a, f) => a + f.v, 0), redeemed = flows.filter((f) => f.v > 0).reduce((a, f) => a + f.v, 0)
    const end = new Date(); const all = [...flows, { d: end, v: value }]; const t0 = all.reduce((m, f) => (f.d < m ? f.d : m), end)
    const npv = (r) => all.reduce((a, f) => a + f.v / Math.pow(1 + r, (f.d - t0) / 365.25 / 864e5), 0)
    let lo = -0.99, hi = 5; for (let i = 0; i < 80; i++) { const m = (lo + hi) / 2; if (npv(m) > 0) lo = m; else hi = m }
    const days = (end - t0) / 864e5
    return { invested, redeemed, value, gain: value + redeemed - invested, xirr: days > 30 ? ((lo + hi) / 2) * 100 : null, since: t0.toISOString().slice(0, 10), days }
  }, [mfTransactions, holdings, cfg.portfolioId])

  if (!isResearch) return <Navigate to="/dashboard" replace />
  const names = { fund: 'Index fund', gold: 'Gold', liq: 'Liquid fund' }
  const colors = { fund: 'bg-sky-400', gold: 'bg-amber-400', liq: 'bg-slate-400' }
  const opt = holdings.map((h) => <option key={h.schemeCode} value={h.schemeCode}>{h.fundName}</option>)
  const TH = 'py-2 px-4 text-left text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider whitespace-nowrap'
  const TD = 'py-2 px-4 text-sm text-[var(--text-secondary)]'
  const Sel = ({ value, onChange, children }) => <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-input)] px-2.5 py-1.5 text-sm text-[var(--text-primary)]">{children}</select>
  const byKey = plan ? Object.fromEntries(plan.rows.map((r) => [r.k, r])) : {}

  return (
    <div className="space-y-4">
      {/* header, like the paper page */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-base font-bold text-[var(--text-primary)]">Fund rule <span className="text-xs font-medium text-[var(--text-dim)]">· index fund + gold · one satellite portfolio</span></h2>
        <div className="flex items-center gap-2 text-xs">
          {R && <span className="px-2.5 py-1 rounded-lg font-semibold bg-sky-500/10 text-sky-300">Hold {split(R.target)}</span>}
          <span className="text-[var(--text-dim)]">{R ? `Prices to ${day(R.asOf)}` : hist === null ? 'No price history' : 'Loading…'}</span>
          <Link to="/admin/paper" className="px-2 py-1 rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)]">Book G (paper)</Link>
        </div>
      </div>
      {hist === null && <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm font-semibold text-amber-400">Could not load the fund's price history (api.mfapi.in). Try another fund below.</div>}

      {R && (<>
        {/* the three sleeves */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {['fund', 'gold', 'liq'].map((k) => { const r = byKey[k], w = R.target[k]; return (
            <div key={k} className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3 min-w-0">
              <div className="flex items-center gap-2"><span className={`w-2 h-2 rounded-full ${colors[k]}`} /><span className="text-xs font-semibold text-[var(--text-primary)]">{names[k]}</span>
                {r && cfg[k] && <span className={`ml-auto px-1.5 py-0.5 rounded text-[10px] font-bold ${r.move ? (r.diff > 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-[var(--accent-rose)]') : 'bg-[var(--bg-inset)] text-[var(--text-dim)]'}`}>{r.move ? (r.diff > 0 ? 'BUY ' : 'SELL ') + inr(Math.abs(r.diff)) : 'OK'}</span>}</div>
              <p className="mt-1.5 text-2xl font-bold tabular-nums text-[var(--text-primary)]">{Math.round(w * 100)}%</p>
              <div className="mt-1.5 h-1.5 rounded-full bg-[var(--bg-inset)] overflow-hidden"><div className={`h-full rounded-full ${colors[k]}`} style={{ width: `${Math.round(w * 100)}%` }} /></div>
              <p className="text-[11px] text-[var(--text-dim)] mt-1.5 truncate">{r && plan.total > 0 ? `Now ${inr(r.cur)} (${Math.round(r.curPct * 100)}%) · target ${inr(r.tgt)}` : k === 'liq' ? 'Waiting room while a guard is on' : k === 'gold' ? 'Never more than 60%' : 'Nifty Midcap 150 Momentum 50'}</p>
            </div>) })}
        </div>

        {/* why: four checks */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            ['12 months', R.r12 >= RULE.hi ? 'strong' : R.r12 < RULE.lo ? 'weak' : 'normal', `The fund ${R.r12 < 0 ? 'fell' : 'rose'} ${ap(R.r12)} in a year`, R.e === RULE.eLo ? 'Base share 20%' : R.e === RULE.eHi ? 'Base share 80%' : 'Base share 50%', R.e === RULE.eMid ? 'ok' : R.e === RULE.eLo ? 'warn' : 'good'],
            ['Recent weeks', R.x < 1 ? 'guard on' : R.up ? 'notch up' : 'quiet', `${ap(R.gap)} ${R.gap < 0 ? 'below' : 'above'} the 50-day average`, R.x < 1 ? 'Half the fund money parked in gold' : R.up ? 'One step more in the fund' : 'Base share stays', R.x < 1 ? 'warn' : R.up ? 'good' : 'ok'],
            ['Sharp fall', R.fast ? 'yes' : 'no', `${ap(R.fgap)} ${R.fgap < 0 ? 'below' : 'above'} the 20-day average`, R.fast ? 'All fund money waits in liquid' : 'Nothing moved to liquid for this', R.fast ? 'bad' : 'ok'],
            ['Gold limit', R.target.gold >= RULE.goldCap - 1e-9 && R.target.liq > 0.001 ? 'hit' : 'not hit', 'Gold is never more than 60%', R.target.gold >= RULE.goldCap - 1e-9 && R.target.liq > 0.001 ? `${Math.round(R.target.liq * 100)}% waits in liquid instead` : 'All the rest is in gold', R.target.gold >= RULE.goldCap - 1e-9 && R.target.liq > 0.001 ? 'warn' : 'ok'],
          ].map(([t, state, l1, l2, tone]) => (
            <div key={t} className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3 min-w-0">
              <div className="flex items-center justify-between gap-2"><p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-dim)]">{t}</p>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${tone === 'good' ? 'bg-emerald-500/15 text-emerald-400' : tone === 'warn' ? 'bg-amber-500/15 text-amber-400' : tone === 'bad' ? 'bg-rose-500/15 text-[var(--accent-rose)]' : 'bg-[var(--bg-inset)] text-[var(--text-muted)]'}`}>{state}</span></div>
              <p className="mt-1.5 text-sm text-[var(--text-primary)]">{l1}</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">{l2}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-[var(--text-dim)] -mt-1">Decided on the week's last price (Friday) and the month's last price. Check on Monday mornings, or wait for the email.</p>
      </>)}

      {!isAdmin && <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-inset)] px-4 py-2.5 text-xs text-[var(--text-muted)]">Shared with you as a learning record: a mechanical rule and its paper books, run by Jagadeesh for his own money. Information, not a recommendation; nothing here is personal advice.</div>}

      {/* settings (admin) */}
      {isAdmin && <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] overflow-hidden">
        <div className="px-4 py-2.5 border-b border-[var(--border-light)]"><h3 className="text-sm font-bold text-[var(--text-primary)]">Set-up</h3></div>
        <div className="px-4 py-3 grid gap-3 md:grid-cols-2">
          <label className="text-xs text-[var(--text-muted)]">Fund whose prices the rule watches
            <Sel value={cfg.signal} onChange={(v) => set('signal', Number(v))}>{SIGNAL_FUNDS.map(([c, n]) => <option key={c} value={c}>{n}</option>)}</Sel></label>
          <label className="text-xs text-[var(--text-muted)]">Satellite portfolio (the only one the rule looks at)
            <Sel value={cfg.portfolioId} onChange={(v) => { set('portfolioId', v); set('fund', ''); set('gold', ''); set('liq', '') }}>
              <option value="">— choose —</option>
              {portfolios.map((p) => <option key={p.portfolioId} value={p.portfolioId}>{String(p.portfolioName || '').replace(/^PFL-/, '')}</option>)}
            </Sel></label>
          {cfg.portfolioId && holdings.length > 0 && ['fund', 'gold', 'liq'].map((k) => (
            <label key={k} className="text-xs text-[var(--text-muted)]">{names[k]} in that portfolio<Sel value={cfg[k]} onChange={(v) => set(k, v)}><option value="">— choose —</option>{opt}</Sel></label>
          ))}
          {cfg.portfolioId && !holdings.length && <p className="text-xs text-[var(--text-dim)] md:col-span-2">This portfolio holds no funds yet. Add the index fund, a gold fund and a liquid fund to it, then pick them here.</p>}
        </div>
      </div>}

      {isAdmin && R && cfg.portfolioId && holdings.length > 0 && cfg.fund && cfg.gold && cfg.liq && (
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] overflow-hidden">
          <div className="px-4 py-2.5 border-b border-[var(--border-light)] flex items-center justify-between gap-3 flex-wrap">
            <h3 className="text-sm font-bold text-[var(--text-primary)]">Rebalance the satellite</h3>
            <div className="flex items-center gap-2 text-xs">
              <span className={`px-2.5 py-1 rounded-lg font-semibold ${synced ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>{synced ? 'Targets match the rule' : 'Targets differ from the rule'}</span>
              {!synced && <button onClick={saveTargets} disabled={saving} className="px-2.5 py-1 rounded-lg bg-sky-500/20 border border-sky-500/40 text-sky-300 font-semibold disabled:opacity-50">{saving ? 'Saving…' : `Set targets to ${split(R.target)}`}</button>}
            </div>
          </div>
          <div className="px-4 py-3">
            {synced ? <MFRebalanceDialog filterPortfolioId={cfg.portfolioId} /> :
              <p className="text-sm text-[var(--text-muted)]">Press the button to write the rule's split into this portfolio's target %. The app's usual rebalance tool then shows what to buy and sell, how to split a lumpsum, and how to set SIPs — exactly as for your other portfolios.</p>}
            <p className="text-xs text-[var(--text-dim)] mt-2">Values are the app's current values. Information, not advice; you place the orders, and exit loads and tax are yours to check.</p>
          </div>
        </div>
      )}

      {R && <History R={R} colors={colors} />}
      {R && <Growth R={R} goldCode={cfg.gold || DEFAULT_GOLD} liqCode={cfg.liq || DEFAULT_LIQ} defaultStart={firstTxn} />}
      {isAdmin && R && cfg.portfolioId && real && <RealReturns real={real} />}
      {isAdmin && <Viewers />}
    </div>
  )
}
