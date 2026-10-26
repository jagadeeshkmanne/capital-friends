// The index-fund + gold rule (fund.py), shared by the Fund rule page (book G: the index fund, at most 80%) and the Stock rule
// page (book H: 15 momentum stocks, at most 70%). Both decide on the Nifty Midcap150 Momentum 50 index fund's NAV: the month's
// last NAV for the 12-month trend, the week's last NAV for the 50-day guard and the 20-day crash guard; the switch is at the next
// NAV. `cap` is the most in the fund (or the stocks); `W` the words used in the reasons. Information, not advice.

export const RULE = { lo: 0, hi: 0.20, eLo: 0.2, eMid: 0.5, eHi: 0.8, k: 50, band: 0.02, cut: 0.5, notch: { 0.5: 0.8, 0.8: 1 }, fundMax: 0.8,
  fastK: 20, fastBand: 0.04, goldCap: 0.6, tradeBand: 0.05, look: 248 }
export const ap = (v, d = 1) => (v == null ? '—' : (Math.abs(v) * 100).toFixed(d) + '%')   // size of a move, no sign
export const pct = (v, d = 1) => (v == null ? '—' : (v > 0 ? '+' : '') + (v * 100).toFixed(d) + '%')
export const day = (d) => (d ? new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')
export const iso = (t) => new Date(t * 1000).toISOString().slice(0, 10)
export const isoWeek = (d) => { const x = new Date(d + 'T00:00:00Z'); const n = (x.getUTCDay() + 6) % 7; x.setUTCDate(x.getUTCDate() - n + 3); const y = x.getUTCFullYear(); const j4 = new Date(Date.UTC(y, 0, 4)); return y + '-' + Math.round(1 + ((x - j4) / 864e5 - 3 + ((j4.getUTCDay() + 6) % 7)) / 7) }
export const trendE = (r) => (r < RULE.lo ? RULE.eLo : r > RULE.hi ? RULE.eHi : RULE.eMid)
export const fundShare = (e, x, up, cap = RULE.fundMax) => Math.min(cap, x < 1 ? e * x : up ? (RULE.notch[e] ?? e) : e)   // never above 80% (fund.py fund_max)
export function targets(e, x, up, fast, cap = RULE.fundMax) {
  const fs = fundShare(e, x, up, cap)
  const w = fast ? { fund: 0, gold: 1 - fs, liq: fs } : { fund: fs, gold: 1 - fs, liq: 0 }
  if (w.gold > RULE.goldCap) { w.liq += w.gold - RULE.goldCap; w.gold = RULE.goldCap }
  return w
}
export const same = (a, b) => a && b && Math.abs(a.fund - b.fund) < 1e-9 && Math.abs(a.gold - b.gold) < 1e-9
export const split = (w, what = 'fund') => `${Math.round(w.fund * 100)}% ${what} / ${Math.round(w.gold * 100)}% gold${w.liq > 0.001 ? ` / ${Math.round(w.liq * 100)}% liquid` : ''}`

// words for the reasons: G (the fund itself) and H (stocks timed by the index fund)
export const WORDS = { Sig: 'The fund', sigL: 'the fund', sigS: 'fund', inX: 'in the fund', money: 'fund money' }
export const WORDS_STOCKS = { Sig: 'The momentum index fund', sigL: 'the momentum index fund', sigS: 'index fund', inX: 'in stocks', money: 'stock money' }

/** Replay the rule over the NAV history exactly as fund.py does (decide at the month's / week's last NAV, act at the next). */
export function replay(hist, cap = RULE.fundMax, W = WORDS) {
  const dates = hist.times.map(iso), nav = hist.navs, n = nav.length
  const mean = (i, k) => { let s = 0; for (let j = i - k + 1; j <= i; j++) s += nav[j]; return s / k }
  const S = { e: null, x: 1, up: false, fast: false, r12: null, gap: null, fgap: null, target: null }
  const log = [], series = []
  for (let i = RULE.look + 5; i < n; i++) {
    const d = dates[i], p = dates[i - 1], why = []
    if (S.e == null || d.slice(0, 7) !== p.slice(0, 7)) {              // new month: trend from the previous month's last NAV
      S.r12 = nav[i - 1] / nav[i - 1 - RULE.look] - 1; const e = trendE(S.r12)
      if (S.e != null && e !== S.e) why.push(`Over the last 12 months ${W.sigL} ${S.r12 < 0 ? 'fell' : 'rose'} ${ap(S.r12)}, so the base share ${W.inX} is now ${e * 100}%`)
      S.e = e
    }
    if (S.gap == null || isoWeek(d) !== isoWeek(p)) {                    // new week: guards from last week's last NAV
      S.gap = nav[i - 1] / mean(i - 1, RULE.k) - 1; let x = S.x; const up = S.gap > RULE.band
      if (S.gap < -RULE.band) x = 1 - RULE.cut; else if (S.gap > RULE.band) x = 1
      if (x !== S.x) why.push(x < 1 ? `${W.Sig} dropped ${ap(S.gap)} below its 50-day average: half the ${W.money} moved to gold` : `${W.Sig} is back ${pct(S.gap)} above its 50-day average: the ${W.money} comes back`)
      if (up !== S.up && x === 1) why.push(up ? `${W.Sig} is ${pct(S.gap)} above its 50-day average (rising well): one step more ${W.inX}` : `${W.Sig} is only ${pct(S.gap)} vs its 50-day average: back to the base share`)
      S.x = x; S.up = up
      S.fgap = nav[i - 1] / mean(i - 1, RULE.fastK) - 1; let fast = S.fast
      if (S.fgap < -RULE.fastBand) fast = true; else if (S.fgap > 0) fast = false
      if (fast !== S.fast) why.push(fast ? `Sharp fall: ${W.sigL} is ${ap(S.fgap)} below its 20-day average, so all ${W.money} waits in the liquid fund` : `The sharp fall is over (${W.sigS} back above its 20-day average): ${W.money} goes back in`)
      S.fast = fast
    }
    const t = targets(S.e, S.x, S.up, S.fast, cap)
    if (!same(t, S.target)) log.push({ date: d, why: why.join('. ') || 'Start of the history', target: t })
    S.target = t; series.push([d, nav[i], t.fund, t.gold, t.liq])
  }
  return { ...S, asOf: dates[n - 1], nav: nav[n - 1], log: log.slice().reverse(), series: series.slice(-260), full: series, days: n }
}

/** A switch due at the next NAV is known before that NAV is out: when the last NAV closed its week (Friday's NAV, seen on the
 *  weekend or on Monday) or its month (seen on the 1st). The next NAV is the weekday after the last one we have; when that day
 *  has already passed (Tuesday early morning, Monday's NAV not in yet) the switch still shows, with past = true, instead of
 *  the old split. Returns { date, target, why, S (the checks that make it), past } of that switch, or null. */
export function nextDue(hist, R, cap = RULE.fundMax, W = WORDS) {
  const add = (d, k) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + k); return x.toISOString().slice(0, 10) }
  const wd = (d) => new Date(d + 'T00:00:00Z').getUTCDay()
  const today = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10)   // date in India
  let next = add(R.asOf, 1); while (wd(next) === 0 || wd(next) === 6) next = add(next, 1)
  if (isoWeek(next) === isoWeek(R.asOf) && next.slice(0, 7) === R.asOf.slice(0, 7)) return null   // no week / month check at that NAV
  const P = replay({ times: [...hist.times, Date.parse(next + 'T00:00:00Z') / 1000], navs: [...hist.navs, hist.navs[hist.navs.length - 1]] }, cap, W)
  return same(P.target, R.target) ? null : { date: next, target: P.target, why: P.log[0]?.why || '', S: P, past: next < today }
}

/** The four checks to show: the replay's, or when a switch is due, the newer checks that make it (so the cards agree with the
 *  "Switch at…" badge). goldOver = what the 60% gold limit sends to the liquid fund (not counting a sharp fall's share). */
export function checks(R, N, cap = RULE.fundMax) {
  const C = N?.S || R
  return { ...C, goldOver: Math.max(0, 1 - fundShare(C.e, C.x, C.up, cap) - RULE.goldCap) }
}

