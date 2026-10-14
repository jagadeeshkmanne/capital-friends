// A goal whose date has come: did the person already redeem on the platform without pressing Done here?
// Then a CAS import brings that redemption in, the funds are smaller, and the goal (still open, still keeping its
// share) would take the rest from the other goals — the money counted as gone twice. So the goal card asks:
// "We see ₹X redeemed from this goal's funds since <date>. Was it for this goal?" and closes it without recording
// anything again (the statement already has the sale).
import { parseDate } from './mfMetrics'

const DAY = 864e5
/**
 * @param goal          the goal (targetDate)
 * @param portfolioIds  portfolios / investments this goal holds money in
 * @param cashOuts      [{ investmentId, name, amount, date }] cash / FD values lowered by hand (Settings → GoalCashOut)
 * @param mfTransactions all fund transactions
 * @returns { total, items: [{ date, fundName, amount, units }] } redemptions (not switches, not the app's own
 *          "For goal:" records) in those portfolios from 30 days before the goal date on
 */
export function outsideSales({ goal, portfolioIds, mfTransactions, cashOuts = [], daysBefore = 30 }) {
  const due = parseDate(goal?.targetDate)
  if (!due) return { total: 0, items: [] }
  const from = new Date(due.getTime() - daysBefore * DAY)
  const ids = new Set(portfolioIds || [])
  const items = (mfTransactions || []).filter((t) => {
    if (!ids.has(t.portfolioId) || t.type !== 'SELL') return false
    if (/switch/i.test(t.transactionType || '')) return false
    if (/^For goal:/.test(String(t.notes || ''))) return false
    const d = parseDate(t.date)
    return d && d >= from
  }).map((t) => ({ date: t.date, fundName: t.fundName, amount: Number(t.totalAmount) || 0, units: Number(t.units) || 0 }))
  // cash / FD lowered by hand (Other Investments) for this goal's deposits: noted in Settings → GoalCashOut
  for (const c of cashOuts || []) {
    const d = parseDate(c.date)
    if (ids.has(c.investmentId) && d && d >= from) items.push({ date: c.date, fundName: c.name, amount: Number(c.amount) || 0, units: 0, cash: true })
  }
  return { total: items.reduce((s, x) => s + x.amount, 0), items }
}

/**
 * What the statement already shows as taken out since the goal date (30 days before, like outsideSales), so pressing
 * Done never records the same sale twice: { 'PF::FUNDCODE': units, 'PF::SYMBOL': quantity, 'INV-ID': ₹ (cash lowered) }.
 * The app's own "For goal:" records are not counted (they are what Done writes).
 */
export function alreadyTaken({ goal, mfTransactions = [], stockTransactions = [], cashOuts = [], daysBefore = 30 }) {
  const due = parseDate(goal?.targetDate)
  const out = {}
  if (!due) return out
  const from = new Date(due.getTime() - daysBefore * DAY)
  const add = (k, v) => { if (v > 0) out[k] = (out[k] || 0) + v }
  const fresh = (t) => { const d = parseDate(t.date); return d && d >= from && !/^For goal:/.test(String(t.notes || '')) && t.type === 'SELL' }
  for (const t of mfTransactions || []) if (fresh(t) && !/switch/i.test(t.transactionType || '')) add(`${t.portfolioId}::${t.fundCode}`, Number(t.units) || 0)
  for (const t of stockTransactions || []) if (fresh(t)) add(`${t.portfolioId}::${t.symbol}`, Number(t.quantity) || 0)
  for (const c of cashOuts || []) { const d = parseDate(c.date); if (d && d >= from) add(c.investmentId, Number(c.amount) || 0) }
  return out
}
