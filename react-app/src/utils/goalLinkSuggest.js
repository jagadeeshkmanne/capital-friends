// "Suggest for me" on the goal linking screen: picks which of the family's investments (any member's:
// e.g. money invested in a spouse's name for one's own retirement) to link to a goal, and how much of each, so the linked money as a whole sits near the goal's recommended equity
// (the glide path: less equity as the goal comes closer). It only links what the family already owns;
// it never suggests buying anything. The person can change every row before saving.

const norm = (s) => String(s || '').trim().toLowerCase()
const RETIREMENT_OTHER = ['epf', 'ppf', 'nps', 'vpf']

/**
 * @param goal        { goalType }
 * @param items       [{ id, name, type: 'MF'|'Stock'|'Other', owner, value, equityPct (0..100 or null), otherType }]
 * @param usedByOthers { [id]: pct already linked to other goals }
 * @param targetEquity recommended equity % for this goal now
 * @returns { rows: [{ portfolioId, allocationPct, investmentType, reason }], summary }
 */
export function suggestGoalLinks({ goal, items, usedByOthers = {}, targetEquity }) {
  const T = Math.max(0, Math.min(100, Number(targetEquity) || 0)) / 100
  const isRetirement = goal?.goalType === 'Retirement'

  const pool = []
  for (const it of items || []) {
    const avail = Math.max(0, 100 - (Number(usedByOthers[it.id]) || 0))
    if (avail <= 0 || !(it.value > 0)) continue
    let fixed = false
    if (it.type === 'Other') {
      // EPF / PPF / NPS are retirement money: counted in full for retirement, left alone for other goals
      if (!isRetirement || !RETIREMENT_OTHER.includes(norm(it.otherType))) continue
      fixed = true
    }
    if (it.equityPct === null || it.equityPct === undefined) continue // unknown mix: let the person decide
    pool.push({ ...it, avail, eq: it.equityPct / 100, fixed, f: 1 })
  }
  if (!pool.length) return { rows: [], summary: null }

  const val = (p) => p.value * p.avail / 100
  const sums = (list) => list.reduce((s, p) => ({ v: s.v + val(p) * p.f, e: s.e + val(p) * p.f * p.eq }), { v: 0, e: 0 })
  const flex = pool.filter((p) => !p.fixed)
  // Too little equity is not fixed by linking less money: everything free stays linked and the summary
  // shows the gap (the goal's rebalance plan handles it). Only near-cash portfolios (equity 20% or less)
  // are left for shorter goals when this goal is long-term.
  if (T >= 0.6) flex.forEach((p) => { if (p.eq <= 0.2) p.f = 0 })
  const all = sums(pool)
  const E = all.v > 0 ? all.e / all.v : 0
  if (E > T + 0.03) {
    // too much equity for how close the goal is: link less of the equity-heavy investments
    const hi = flex.filter((p) => p.eq > T), rest = pool.filter((p) => !hi.includes(p))
    const H = sums(hi), R = sums(rest)
    const den = H.e - T * H.v
    if (hi.length && R.v > 0 && den > 0) { const f = Math.max(0, Math.min(1, (T * R.v - R.e) / den)); hi.forEach((p) => { p.f = f }) }
  }
  const rows = []
  for (const p of pool) {
    const pct = Math.round(p.avail * p.f)
    if (pct < 1) continue
    const eqTxt = `${Math.round(p.eq * 100)}% equity`
    const who = p.owner ? ` (${p.owner})` : ''
    const reason = p.fixed
      ? `${p.otherType}${who}: retirement money, counted in full`
      : pct >= p.avail
        ? `${eqTxt} · all of what's free`
        : `${eqTxt} · ${pct}% keeps this goal near ${Math.round(T * 100)}% equity`
    rows.push({ portfolioId: p.id, allocationPct: pct, investmentType: p.type, reason })
  }
  return { rows, summary: linkedSummary(rows, items, Math.round(T * 100)) }
}

/** Linked value and equity share of any set of rows (used live while the person edits). */
export function linkedSummary(rows, items, targetEquity) {
  let v = 0, e = 0, known = 0
  for (const r of rows || []) {
    const it = (items || []).find((x) => x.id === r.portfolioId)
    if (!it) continue
    const part = (it.value || 0) * (Number(r.allocationPct) || 0) / 100
    v += part
    if (it.equityPct !== null && it.equityPct !== undefined) { known += part; e += part * it.equityPct / 100 }
  }
  return { linkedValue: Math.round(v), equityPct: known > 0 ? Math.round(e / known * 100) : null, targetEquity }
}
