// How each paper trade turned out, to judge the rule's decisions: the price after the trade, up to the next opposite trade
// of the same holding (a sale's buy-back, a buy's sale) or, while there is none, up to the price now. A sale whose price
// then rose missed that gain; one whose price fell saved the fall. Used by the Stock rule and Fund rule paper books.

/**
 * trades: oldest first, each { key, side: 'buy' | 'sell', date, price, qty } (extra fields are kept).
 * priceNow(key): the price now, or null when it is not known.
 * Returns the same list, each with end (the price it is measured to), endDate (the opposite trade's day, null = now),
 * pct (end / price - 1) and amt (qty x (end - price): for a sale, + is the gain it missed and - the fall it saved).
 */
export function outcomes(trades, priceNow) {
  return (trades || []).map((t, i) => {
    const opp = trades.slice(i + 1).find((u) => u.key === t.key && u.side !== t.side)
    const end = opp ? opp.price : priceNow(t.key)
    if (!(end > 0) || !(t.price > 0) || !(t.qty > 0)) return { ...t, end: null, endDate: null, pct: null, amt: null }
    return { ...t, end, endDate: opp ? opp.date : null, pct: end / t.price - 1, amt: t.qty * (end - t.price) }
  })
}

/**
 * The sales among rows (from outcomes) added up: how many holdings, the money they were sold for, what the same units
 * are worth at their end prices, the change in % and in rupees (+ = missed, - = saved), and the first / last sale day.
 * null when there is no sale with a known price.
 */
export function salesSummary(rows) {
  const s = (rows || []).filter((r) => r.side === 'sell' && r.pct != null)
  if (!s.length) return null
  const sold = s.reduce((a, r) => a + r.qty * r.price, 0), end = s.reduce((a, r) => a + r.qty * r.end, 0)
  return { n: new Set(s.map((r) => r.key)).size, sold, end, pct: end / sold - 1, amt: end - sold, from: s[0].date, to: s[s.length - 1].date, open: s.some((r) => r.endDate == null) }
}

/** The last sale day's sales (one rule switch or rebalance) and all sales, from outcomes rows. */
export function lastAndAllSales(rows) {
  const all = salesSummary(rows)
  if (!all) return { last: null, all: null }
  return { last: salesSummary(rows.filter((r) => r.side === 'sell' && r.date === all.to)), all }
}
