// Retirement bucket actions that need the person to do something, for the dashboard's Action Required, the goal
// card and the email. The app saves the latest list in Settings ('BucketActions:<goalId>', when it opens) so the
// daily email can show the same steps with amounts; the email job adds the checks it can do on its own
// (gas-webapp/IncomePlan.js: yearly refill date, Income running low, short pay day, FD matured).

const L = (v) => {
  const n = Math.round(Number(v) || 0)
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(2)} L`
  return `₹${n.toLocaleString('en-IN')}`
}
const NAME = { b1: 'Income', b2: 'Stability', b3: 'Growth' }

/** plan: buildBucketRefillPlan result; income: incomeStatus result (or null). */
export function bucketActions({ goal, plan, income }) {
  const out = []
  const gname = goal?.goalName || 'Retirement'
  if (plan && !plan.noExpenses && plan.operations?.length) {
    const steps = plan.operations.map((op) => `${NAME[op.from]} → ${NAME[op.to]} ${L(op.fundedAmount)}`).join(' · ')
    if (plan.status === 'due') {
      const low = plan.months?.b1 <= (plan.rules?.earlyRefillMonths || 12)
      out.push({ code: 'refill', type: low ? 'critical' : 'warning', goalId: goal.goalId,
        title: low ? `${gname}: refill Income now` : `${gname}: refill your buckets`,
        description: `${steps}. Open Goals → Refill now, do the switches in your fund app, then press Mark done.` })
    } else if (plan.status === 'building') {
      out.push({ code: 'build', type: 'warning', goalId: goal.goalId, title: `${gname}: this quarter's bucket step`,
        description: `${steps}. Growth funds are near their high, so it's a good time. Open Goals → Refill now.` })
    }
  }
  for (const w of income?.warn || []) out.push({ code: 'income', type: /nothing else|short|no longer/.test(w) ? 'critical' : 'warning', goalId: goal?.goalId, title: `${gname}: monthly income`, description: w })
  for (const st of income?.steps || []) out.push({ code: 'income-move', type: 'warning', goalId: goal?.goalId, title: `${gname}: move money for your income`, description: st })
  return out
}

/** Same list without volatile parts, to decide whether the saved snapshot needs a write. */
export const actionsKey = (items) => JSON.stringify((items || []).map((i) => [i.code, i.type, i.title, i.description]))
