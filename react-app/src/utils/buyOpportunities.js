export const BUY_OPPORTUNITY_THRESHOLD_PCT = 5
export const STRONG_BUY_OPPORTUNITY_THRESHOLD_PCT = 10

export function isBuyOpportunity(holding) {
  return Number(holding?.athNav) > 0
    && Number(holding?.belowATHPct) >= BUY_OPPORTUNITY_THRESHOLD_PCT
}

export function isStrongBuyOpportunity(holding) {
  return isBuyOpportunity(holding)
    && Number(holding?.belowATHPct) >= STRONG_BUY_OPPORTUNITY_THRESHOLD_PCT
}
