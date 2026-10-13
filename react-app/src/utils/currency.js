// Currency helpers for stocks priced outside India (the app keeps every amount in ₹).
const SIGN = { USD: '$', GBP: '£', EUR: '€', JPY: '¥', INR: '₹', HKD: 'HK$', SGD: 'S$', AUD: 'A$', CAD: 'C$', CHF: 'CHF' }
const MINOR = { GBX: 'pence', ZAC: 'cents', ILA: 'agorot' }

/** What to show next to a price in this currency: "$", "£", "pence", or the code. */
export function ccyPrefix(c) {
  const k = String(c || '').toUpperCase()
  return SIGN[k] || MINOR[k] || k || '$'
}

/** "$182.50", "£4.10", "65 pence", "CHF 12.30" */
export function fmtLocal(amount, c) {
  const n = Number(amount) || 0
  const k = String(c || '').toUpperCase()
  const v = n.toLocaleString('en-US', { maximumFractionDigits: 2 })
  if (MINOR[k]) return `${v} ${MINOR[k]}`
  const s = SIGN[k]
  return s ? (s.length === 1 ? `${s}${v}` : `${s} ${v}`) : `${k} ${v}`
}
