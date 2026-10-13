import { formatINR } from '../data/familyData.js'
import { REFILL_RULES } from './bucketRefill.js'
const L = (v) => formatINR(Math.round(v || 0))

/** How long the money lasts: spend the monthly expense (rising with inflation) from everything, about 8% a year average return. */
export function lastsYears(total, monthly, inflation = 0.06, ret = 0.08) {
  let c = total, e = monthly * 12, y = 0
  if (!(e > 0)) return 99
  while (c > 0 && y < 60) { c = c * (1 + ret) - e; e *= 1 + inflation; y++ }
  return y
}
/** The jars' check, done every time the card opens. The yearly refill itself (sell from Stability or Growth,
 *  buy the liquid fund) is the refill plan's job (bucketRefill.js); this check never asks for a monthly top-up:
 *  - Income is spent month by month, so anything from 12 to 24 months is normal; it is topped up at the yearly
 *    refill. Below 12 months the refill is due early.
 *  - Cash above 24 months is free money, not Income. Free money fills Stability first, then goes to Growth.
 *  - Stability also goes down after a refill; Growth refills it in a good year. Only below 2 years is it a warning.
 *  - EPF / PPF / NPS count in Stability but are never used until marked Received.
 *  - If all the money can't cover Income + Stability (7 years), a clear warning with what to do. */
export function bucketCheck({ tgt, inc, stb, gro, locked, monthly }) {
  const m = monthly > 0 ? monthly : 0
  const free = Math.max(0, inc - tgt.inc)
  const stbFree = Math.max(0, stb - locked)
  const steps = [], warn = [], info = []
  const incMonths = m ? inc / m : 99
  if (m && incMonths <= REFILL_RULES.earlyRefillMonths) {
    const need = tgt.inc - inc, fromStb = Math.min(need, stbFree)
    if (fromStb > 0) steps.push(`Income has only ${Math.floor(incMonths)} months left: refill it now. Move ${L(fromStb)} from Stability to a liquid fund.`)
    if (need - fromStb > 0) warn.push(`Income can't be filled to 2 years: ${L(need - fromStb)} short even after using Stability${locked > 0 ? ' (EPF / PPF / NPS are not used until you mark them Received)' : ''}.`)
  } else if (m && inc < tgt.inc) {
    info.push(`Income has ${Math.floor(incMonths)} months of expenses. That's normal: it is topped up to 2 years at the yearly refill.`)
  }
  let left = free
  const stbShort = Math.max(0, tgt.stb - stb)
  if (stbShort > 0 && left > 0) {
    const fromFree = Math.min(left, stbShort); left -= fromFree
    steps.push(`Move ${L(fromFree)} of free money to Stability (a hybrid or debt fund).`)
  }
  const stbAfter = stb + (free - left)
  if (m && stbAfter < m * REFILL_RULES.stabilityFloorMonths) warn.push(`Stability holds less than 2 years of expenses. In the next good market year, refill it from Growth.`)
  else if (stbAfter < tgt.stb) info.push(`Stability is below 5 years of expenses. As soon as your growth funds are back near their high, the app asks Growth to refill it.`)
  if (left > 0) steps.push(`${L(left)} free money left after filling the jars: put it in Growth (equity funds, in parts over 6 to 12 months), or keep it for other goals.`)
  const total = inc + stb + gro
  if (m && total < tgt.inc + tgt.stb) warn.push(`All your money covers about ${(total / (m * 12)).toFixed(1)} years of expenses, less than the 7 years Income and Stability need.`)
  return { free, steps, warn, info }
}
