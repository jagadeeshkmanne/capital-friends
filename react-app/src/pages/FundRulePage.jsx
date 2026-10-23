import { useEffect, useMemo, useState } from 'react'
import { Navigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { getNavHistory } from '../utils/navHistory'

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

const inr = (v) => (v == null ? '—' : '₹' + Math.round(v).toLocaleString('en-IN'))
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
  const log = []
  for (let i = RULE.look + 5; i < n; i++) {
    const d = dates[i], p = dates[i - 1], why = []
    if (S.e == null || d.slice(0, 7) !== p.slice(0, 7)) {              // new month: trend from the previous month's last NAV
      S.r12 = nav[i - 1] / nav[i - 1 - RULE.look] - 1; const e = trendE(S.r12)
      if (S.e != null && e !== S.e) why.push(`Over the last 12 months the fund ${S.r12 < 0 ? 'fell' : 'rose'} ${pct(Math.abs(S.r12))}, so the base share in the fund is now ${e * 100}%`)
      S.e = e
    }
    if (S.gap == null || isoWeek(d) !== isoWeek(p)) {                    // new week: guards from last week's last NAV
      S.gap = nav[i - 1] / mean(i - 1, RULE.k) - 1; let x = S.x; const up = S.gap > RULE.band
      if (S.gap < -RULE.band) x = 1 - RULE.cut; else if (S.gap > RULE.band) x = 1
      if (x !== S.x) why.push(x < 1 ? `The fund dropped ${pct(Math.abs(S.gap))} below its 50-day average: half the fund money moved to gold` : `The fund is back ${pct(S.gap)} above its 50-day average: the fund money comes back`)
      if (up !== S.up && x === 1) why.push(up ? `The fund is ${pct(S.gap)} above its 50-day average (rising well): one step more in the fund` : `The fund is only ${pct(S.gap)} vs its 50-day average: back to the base share`)
      S.x = x; S.up = up
      S.fgap = nav[i - 1] / mean(i - 1, RULE.fastK) - 1; let fast = S.fast
      if (S.fgap < -RULE.fastBand) fast = true; else if (S.fgap > 0) fast = false
      if (fast !== S.fast) why.push(fast ? `Sharp fall: the fund is ${pct(Math.abs(S.fgap))} below its 20-day average, so all fund money waits in the liquid fund` : `The sharp fall is over (fund back above its 20-day average): fund money goes back in`)
      S.fast = fast
    }
    const t = targets(S.e, S.x, S.up, S.fast)
    if (!same(t, S.target)) log.push({ date: d, why: why.join('. ') || 'Start of the history', target: t })
    S.target = t
  }
  return { ...S, asOf: dates[n - 1], nav: nav[n - 1], log: log.slice(-16).reverse(), days: n }
}

const detect = (hs, re) => hs.find((h) => re.test(h.fundName || ''))?.schemeCode || ''
const Card = ({ children, className = '' }) => <div className={`rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-4 ${className}`}>{children}</div>
const Sel = ({ value, onChange, children }) => <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-2 py-1.5 text-sm text-[var(--text-primary)]">{children}</select>

export default function FundRulePage() {
  const { isAdmin } = useAuth()
  const { mfPortfolios, mfHoldings } = useData()
  const [cfg, setCfg] = useState(() => { try { return { signal: 150738, portfolioId: '', fund: '', gold: '', liq: '', ...JSON.parse(localStorage.getItem(LS) || '{}') } } catch { return { signal: 150738, portfolioId: '', fund: '', gold: '', liq: '' } } })
  const [hist, setHist] = useState(undefined)
  const set = (k, v) => setCfg((c) => { const n = { ...c, [k]: v }; try { localStorage.setItem(LS, JSON.stringify(n)) } catch { /* ignore */ } return n })

  useEffect(() => { if (!isAdmin) return; setHist(undefined); getNavHistory(cfg.signal).then((h) => setHist(h && h.times?.length > RULE.look + 60 ? h : null)) }, [isAdmin, cfg.signal])
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

  if (!isAdmin) return <Navigate to="/dashboard" replace />
  const names = { fund: 'Index fund', gold: 'Gold fund', liq: 'Liquid fund' }
  const opt = (sel) => [<option key="" value="">— choose —</option>, ...holdings.map((h) => <option key={h.schemeCode} value={h.schemeCode}>{h.fundName}</option>)]

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">Fund rule · what to hold now</h1>
          <p className="text-sm text-[var(--text-muted)]">One index fund (Nifty Midcap 150 Momentum 50) and gold, with a liquid fund as the waiting room. The rule reads the fund's own price history and says how to split the money. Information, not advice; you place any order yourself. The same rule runs with pretend money as <Link to="/admin/paper" className="underline">book G</Link>.</p>
        </div>
        {R && <p className="text-xs text-[var(--text-dim)]">Prices up to {day(R.asOf)}</p>}
      </div>

      {hist === undefined && <p className="text-sm text-[var(--text-dim)]">Loading NAV history…</p>}
      {hist === null && <p className="text-sm text-[var(--accent-rose)]">Could not load enough NAV history for this fund (api.mfapi.in). Try another signal fund below.</p>}

      {R && (
        <Card>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-lg font-bold text-[var(--text-primary)]">Hold now: {split(R.target)}</p>
            <p className="text-xs text-[var(--text-dim)]">The rule decides on Fridays (week's last price) and at month-end. Check this page on Monday mornings.</p>
          </div>
          <ol className="mt-3 space-y-1.5 text-sm text-[var(--text-secondary)] list-decimal pl-5">
            <li><b className="text-[var(--text-primary)]">Last 12 months:</b> the fund {R.r12 < 0 ? 'fell' : 'rose'} {pct(Math.abs(R.r12))} → trend is {R.e === RULE.eLo ? 'weak, so the base share in the fund is 20%' : R.e === RULE.eHi ? 'strong, so the base share in the fund is 80%' : 'normal, so the base share in the fund is 50%'}.</li>
            <li><b className="text-[var(--text-primary)]">Last few weeks:</b> the fund is {pct(Math.abs(R.gap), 1)} {R.gap < 0 ? 'below' : 'above'} its 50-day average → {R.x < 1 ? 'that is a weak market, so half of the fund money is parked in gold' : R.up ? 'it is rising well, so one step more goes into the fund' : 'nothing special, the base share stays'}.</li>
            <li><b className="text-[var(--text-primary)]">Sharp fall?</b> the fund is {pct(Math.abs(R.fgap), 1)} {R.fgap < 0 ? 'below' : 'above'} its 20-day average → {R.fast ? 'yes, a sharp fall: all fund money waits in the liquid fund until it recovers' : 'no sharp fall, nothing moves to liquid for this'}.</li>
            <li><b className="text-[var(--text-primary)]">Gold limit:</b> gold is never more than 60% → {R.target.gold >= RULE.goldCap - 1e-9 && R.target.liq > 0.001 ? `the limit is hit, so ${Math.round(R.target.liq * 100)}% waits in the liquid fund instead` : 'not hit, the rest is in gold'}.</li>
          </ol>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <p className="text-sm font-semibold text-[var(--text-primary)] mb-2">Which fund's prices the rule watches</p>
          <Sel value={cfg.signal} onChange={(v) => set('signal', Number(v))}>{SIGNAL_FUNDS.map(([c, n]) => <option key={c} value={c}>{n}</option>)}</Sel>
          <p className="text-xs text-[var(--text-dim)] mt-2">Any Nifty Midcap 150 Momentum 50 index fund works; they all track the same index. Tata has the longest price history.</p>
        </Card>
        <Card>
          <p className="text-sm font-semibold text-[var(--text-primary)] mb-2">Your satellite portfolio (the rule looks only at this one)</p>
          <Sel value={cfg.portfolioId} onChange={(v) => { set('portfolioId', v); set('fund', ''); set('gold', ''); set('liq', '') }}>
            <option value="">— choose a mutual-fund portfolio —</option>
            {portfolios.map((p) => <option key={p.portfolioId} value={p.portfolioId}>{String(p.portfolioName || '').replace(/^PFL-/, '')}</option>)}
          </Sel>
          {cfg.portfolioId && (
            <div className="mt-3 grid gap-2">
              {['fund', 'gold', 'liq'].map((k) => (
                <label key={k} className="text-xs text-[var(--text-muted)]">{names[k]}<Sel value={cfg[k]} onChange={(v) => set(k, v)}>{opt(k)}</Sel></label>
              ))}
              {!holdings.length && <p className="text-xs text-[var(--text-dim)]">This portfolio holds no funds yet. Add the index fund, a gold fund and a liquid fund to it (an import or a manual entry), then choose them here.</p>}
            </div>
          )}
        </Card>
      </div>

      {R && plan && cfg.portfolioId && plan.total > 0 && (
        <Card>
          <p className="text-sm font-semibold text-[var(--text-primary)] mb-2">What to do in the satellite · {inr(plan.total)} in the three funds</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-xs text-[var(--text-muted)] uppercase tracking-wider"><th className="text-left py-1 pr-3">Sleeve</th><th className="text-right py-1 px-3">Now</th><th className="text-right py-1 px-3">Share</th><th className="text-right py-1 px-3">Target</th><th className="text-right py-1 pl-3">Change</th></tr></thead>
              <tbody>
                {plan.rows.map((r) => (
                  <tr key={r.k} className="border-t border-[var(--border)]">
                    <td className="py-1.5 pr-3 text-[var(--text-primary)]">{names[r.k]}{!cfg[r.k] && <span className="text-[var(--text-dim)]"> (not chosen)</span>}</td>
                    <td className="py-1.5 px-3 text-right tabular-nums">{inr(r.cur)}</td>
                    <td className="py-1.5 px-3 text-right tabular-nums">{(r.curPct * 100).toFixed(0)}%</td>
                    <td className="py-1.5 px-3 text-right tabular-nums">{inr(r.tgt)} <span className="text-[var(--text-dim)]">({Math.round(R.target[r.k] * 100)}%)</span></td>
                    <td className={`py-1.5 pl-3 text-right tabular-nums font-semibold ${r.move ? (r.diff > 0 ? 'text-emerald-400' : 'text-[var(--accent-rose)]') : 'text-[var(--text-dim)]'}`}>{r.move ? (r.diff > 0 ? 'buy ' : 'sell ') + inr(Math.abs(r.diff)) : 'no change'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm mt-3 text-[var(--text-secondary)]">
            {plan.moves.length === 0 ? 'Every sleeve is within 5% of its target — nothing to do.' :
              'Switches: ' + plan.moves.filter((r) => r.diff < 0).map((r) => `sell ${inr(-r.diff)} of the ${names[r.k].toLowerCase()}`).concat(plan.moves.filter((r) => r.diff > 0).map((r) => `buy ${inr(r.diff)} of the ${names[r.k].toLowerCase()}`)).join('; ') + '. A switch order between funds of the same house settles in a day or two; otherwise redeem, then invest.'}
          </p>
          <p className="text-xs text-[var(--text-dim)] mt-2">Values are the app's current values (last NAV). Exit loads and tax on the sold sleeve are yours to check; the back-test counts tax, not exit loads.</p>
        </Card>
      )}

      {R && (
        <Card>
          <p className="text-sm font-semibold text-[var(--text-primary)] mb-2">What changed, and when (last few switches)</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-xs text-[var(--text-muted)] uppercase tracking-wider"><th className="text-left py-1 pr-3">From</th><th className="text-left py-1 px-3">What happened</th><th className="text-left py-1 pl-3">Hold</th></tr></thead>
              <tbody>{R.log.map((l) => <tr key={l.date} className="border-t border-[var(--border)]"><td className="py-1.5 pr-3 tabular-nums whitespace-nowrap">{day(l.date)}</td><td className="py-1.5 px-3 text-[var(--text-secondary)] whitespace-normal">{l.why}</td><td className="py-1.5 pl-3 whitespace-nowrap text-[var(--text-primary)]">{split(l.target)}</td></tr>)}</tbody>
            </table>
          </div>
          <p className="text-xs text-[var(--text-dim)] mt-2">Why these rules: in the back-test (2010–2026, after tax) this gave about 24% a year with a worst fall of 17%, against 21% a year with a 39% fall for just holding the fund. Past results do not repeat; plan with 16–18% a year.</p>
        </Card>
      )}
    </div>
  )
}
