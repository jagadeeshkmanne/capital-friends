/**
 * "Realign goals" for a goal that is new or short, when the family's free money is not enough.
 *
 * Rule (real-world priority): every other goal keeps what it needs TODAY ("should have today") —
 * retirement above all, there is no loan for retirement. Only money a goal holds ABOVE that (its "extra")
 * can move to the new goal. Goals with extra give in this order: non-retirement goals first (farthest first),
 * retirement last. A near goal takes the safe part of the extra first, a far goal the equity part.
 * Whatever is still missing is new money: a SIP (or a lump sum) for the new goal.
 *
 * @param goal       the goal being linked { goalId, targetDate }
 * @param wantValue  ₹ the goal should have today (its need) — how much existing money would cover it
 * @param haveValue  ₹ already linked to it (free money in the current rows)
 * @param wantEq     the goal's target equity % now
 * @param plans      buildGoalPlan(...).goals for the OTHER goals: { goal, has, need, isRet }
 * @param mappings   all goal → investment links [{ goalId, portfolioId, allocationPct, investmentType }]
 * @param items      investments [{ id, value, equityPct (0..100|null), name, type }]
 * @returns { moves: [{ fromGoal, portfolioId, pct, value }], donors: { [goalId]: newMappings }, moved, still }
 */
export function realignForGoal({ goal, wantValue, haveValue = 0, wantEq = 50, plans, mappings, items }) {
  let still = Math.max(0, (Number(wantValue) || 0) - (Number(haveValue) || 0))
  const out = { moves: [], donors: {}, moved: 0, still }
  if (!(still > 0)) return out
  const itemOf = Object.fromEntries((items || []).map((i) => [i.id, i]))
  const yearsTo = (g) => (new Date(g.targetDate) - Date.now()) / (365.25 * 864e5)
  const donors = (plans || [])
    // the emergency fund is a safety net, never a source for other goals
    .filter((p) => p.goal.goalId !== goal.goalId && p.goal.goalType !== 'Emergency Fund' && p.has - p.need > 1000)
    .sort((a, b) => (a.isRet - b.isRet) || (yearsTo(b.goal) - yearsTo(a.goal)))
  const safeFirst = wantEq < 50
  // moving a share keeps an investment's total the same; one already linked over 100% is left alone
  const totalOf = {}
  for (const m of mappings || []) totalOf[m.portfolioId] = (totalOf[m.portfolioId] || 0) + (Number(m.allocationPct) || 0)
  for (const d of donors) {
    if (still <= 0) break
    let extra = d.has - d.need
    const links = (mappings || []).filter((m) => m.goalId === d.goal.goalId && Number(m.allocationPct) > 0)
      .map((m) => ({ ...m, item: itemOf[m.portfolioId] })).filter((m) => m.item && m.item.value > 0 && m.item.equityPct != null)
      // EPF / PPF / NPS stay with retirement
      .filter((m) => !(d.isRet && m.investmentType === 'Other') && (totalOf[m.portfolioId] || 0) <= 100.5)
      .sort((a, b) => safeFirst ? a.item.equityPct - b.item.equityPct : b.item.equityPct - a.item.equityPct)
    const next = (mappings || []).filter((m) => m.goalId === d.goal.goalId).map((m) => ({ ...m }))
    for (const l of links) {
      if (still <= 0 || extra <= 0) break
      const holds = l.item.value * Number(l.allocationPct) / 100
      const take = Math.min(holds, extra, still)
      const pct = Math.floor(take / l.item.value * 100) // whole %, never more than needed
      if (pct < 1) continue
      const value = l.item.value * pct / 100
      const row = next.find((m) => m.portfolioId === l.portfolioId); row.allocationPct = Number(row.allocationPct) - pct
      out.moves.push({ fromGoal: d.goal, portfolioId: l.portfolioId, pct, value, name: l.item.name, investmentType: l.investmentType || l.item.type })
      extra -= value; still -= value; out.moved += value
    }
    if (out.moves.some((mv) => mv.fromGoal.goalId === d.goal.goalId)) out.donors[d.goal.goalId] = next.filter((m) => Number(m.allocationPct) > 0)
  }
  out.still = Math.max(0, still)
  return out
}
