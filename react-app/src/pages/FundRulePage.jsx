import { useEffect, useMemo, useState } from 'react'
import { Navigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import MFRebalanceDialog from '../components/forms/MFRebalanceDialog'
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
  const log = []
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
    S.target = t
  }
  return { ...S, asOf: dates[n - 1], nav: nav[n - 1], log: log.slice(-16).reverse(), days: n }
}

const detect = (hs, re) => hs.find((h) => re.test(h.fundName || ''))?.schemeCode || ''

export default function FundRulePage() {
  const { isAdmin } = useAuth()
  const { mfPortfolios, mfHoldings, updateHoldingAllocations } = useData()
  const { showToast } = useToast()
  const [saving, setSaving] = useState(false)
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

  if (!isAdmin) return <Navigate to="/dashboard" replace />
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

        {/* why, in plain words */}
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] overflow-hidden">
          <div className="px-4 py-2.5 border-b border-[var(--border-light)] flex items-center justify-between">
            <h3 className="text-sm font-bold text-[var(--text-primary)]">Why this split</h3>
            <span className="text-xs text-[var(--text-dim)]">decided on the week's last price and the month's last price · check on Monday mornings</span>
          </div>
          <div className="px-4 py-3 grid gap-2 sm:grid-cols-2 text-sm text-[var(--text-secondary)]">
            <p><span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-dim)]">12 months</span><br />The fund {R.r12 < 0 ? 'fell' : 'rose'} {ap(R.r12)} → {R.e === RULE.eLo ? 'weak, base share 20%' : R.e === RULE.eHi ? 'strong, base share 80%' : 'normal, base share 50%'}.</p>
            <p><span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-dim)]">Recent weeks</span><br />{ap(R.gap)} {R.gap < 0 ? 'below' : 'above'} its 50-day average → {R.x < 1 ? 'weak market: half the fund money parked in gold' : R.up ? 'rising well: one step more in the fund' : 'nothing special'}.</p>
            <p><span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-dim)]">Sharp fall?</span><br />{ap(R.fgap)} {R.fgap < 0 ? 'below' : 'above'} its 20-day average → {R.fast ? 'yes: all fund money waits in liquid until it recovers' : 'no'}.</p>
            <p><span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-dim)]">Gold limit</span><br />{R.target.gold >= RULE.goldCap - 1e-9 && R.target.liq > 0.001 ? `Gold would be over 60%, so ${Math.round(R.target.liq * 100)}% waits in liquid instead` : 'Under 60%, not applied'}.</p>
          </div>
        </div>
      </>)}

      {/* settings */}
      <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] overflow-hidden">
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
      </div>

      {R && cfg.portfolioId && holdings.length > 0 && cfg.fund && cfg.gold && cfg.liq && (
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

      {R && (
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] overflow-hidden">
          <div className="px-4 py-2.5 border-b border-[var(--border-light)] flex items-center justify-between">
            <h3 className="text-sm font-bold text-[var(--text-primary)]">What changed, and when</h3>
            <span className="text-xs text-[var(--text-dim)]">last {R.log.length} switches · back-test 2010–26: ~24% a year, worst fall 17% (holding the fund: 21%, −39%)</span>
          </div>
          <div className="overflow-x-auto"><table className="w-full">
            <thead><tr className="border-b border-[var(--border-light)]"><th className={TH}>From</th><th className={TH}>What happened</th><th className={TH}>Hold</th></tr></thead>
            <tbody>{R.log.map((l) => <tr key={l.date} className="border-b border-[var(--border)] last:border-0"><td className={`${TD} whitespace-nowrap tabular-nums`}>{day(l.date)}</td><td className={TD}>{l.why}</td><td className={`${TD} whitespace-nowrap text-[var(--text-primary)] font-semibold`}>{split(l.target)}</td></tr>)}</tbody>
          </table></div>
        </div>
      )}
    </div>
  )
}
