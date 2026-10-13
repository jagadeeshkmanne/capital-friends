import { formatINR } from '../data/familyData.js'
const L = (v) => formatINR(Math.round(v || 0))

/** How long the money lasts: spend the monthly expense (rising with inflation) from everything, about 8% a year average return. */
export function lastsYears(total, monthly, inflation = 0.06, ret = 0.08) {
  let c = total, e = monthly * 12, y = 0
  if (!(e > 0)) return 99
  while (c > 0 && y < 60) { c = c * (1 + ret) - e; e *= 1 + inflation; y++ }
  return y
}
/** The jars' check, done every time the card opens and again at the yearly refill:
 *  Income holds exactly 2 years of expenses, Stability the next 5 (EPF / PPF / NPS count there, locked), Growth the rest.
 *  Cash above 2 years is free money, not Income. Free money fills Stability first, then goes to Growth.
 *  Income short → refill from Stability's funds (never from EPF / PPF / NPS until received).
 *  If even free money can't fill Income and Stability, a clear warning with what to do. */
export function bucketCheck({ tgt, inc, stb, gro, locked, monthly }) {
  const free = Math.max(0, inc - tgt.inc)
  const stbFree = Math.max(0, stb - locked)
  const steps = [], warn = []
  const incShort = Math.max(0, tgt.inc - inc)
  if (incShort > 0) {
    const fromStb = Math.min(incShort, stbFree)
    if (fromStb > 0) steps.push(`Refill Income: move ${L(fromStb)} from Stability to a liquid fund.`)
    if (incShort - fromStb > 0) warn.push(`Income is ${L(incShort - fromStb)} short of 2 years of expenses even after using Stability.`)
  }
  let left = free
  const stbAfter = stb - (incShort > 0 ? Math.min(incShort, stbFree) : 0)
  const stbShort = Math.max(0, tgt.stb - stbAfter)
  if (stbShort > 0) {
    const fromFree = Math.min(left, stbShort); left -= fromFree
    if (fromFree > 0) steps.push(`Move ${L(fromFree)} of free money to Stability (a hybrid or debt fund).`)
    if (stbShort - fromFree > 0) {
      const rest = stbShort - fromFree
      if (gro > rest) steps.push(`Stability is still ${L(rest)} short: move it from Growth, but only in a good market year (funds near their high).`)
      else warn.push(`Stability is ${L(rest)} short of 5 years of expenses and there is not enough free money or Growth to fill it.`)
    }
  }
  if (left > 0) steps.push(`${L(left)} free money left after filling the jars: put it in Growth (equity funds, in parts over 6 to 12 months), or keep it for other goals.`)
  const total = inc + stb + gro
  const years = monthly > 0 ? total / (monthly * 12) : 99
  if (total < tgt.inc + tgt.stb) warn.push(`All your money covers about ${years.toFixed(1)} years of expenses, less than the 7 years Income and Stability need.`)
  return { free, steps, warn }
}
