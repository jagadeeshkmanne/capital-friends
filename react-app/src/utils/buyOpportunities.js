export const BUY_OPPORTUNITY_THRESHOLD_PCT = 5
export const STRONG_BUY_OPPORTUNITY_THRESHOLD_PCT = 10

// A fund whose NAV did not load today shows as "100% below its high". That is missing data, not a fall.
export function hasLiveNav(holding) {
  const nav = Number(holding?.currentNav)
  return !(holding && 'currentNav' in holding && !(nav > 0)) && Number(holding?.belowATHPct) < 95
}

export function isBuyOpportunity(holding) {
  return Number(holding?.athNav) > 0
    && hasLiveNav(holding)
    && Number(holding?.belowATHPct) >= BUY_OPPORTUNITY_THRESHOLD_PCT
}

export function isStrongBuyOpportunity(holding) {
  return isBuyOpportunity(holding)
    && Number(holding?.belowATHPct) >= STRONG_BUY_OPPORTUNITY_THRESHOLD_PCT
}
