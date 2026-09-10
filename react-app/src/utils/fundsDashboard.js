// Consolidated fund-level model for the All Funds dashboard.
// Pure functions so the numbers can be unit-tested without React.

import { parseDate, computeXIRR, computeCAGR } from './mfMetrics.js'
import { inferCategory } from './fundCategory.js'
import { isBuyOpportunity, isStrongBuyOpportunity } from './buyOpportunities.js'

// Resolve owner id/name for each active portfolio via its investment account
// (same rule the Mutual Funds page uses; GAS may store an account label instead of an id).
export function resolvePortfolioOwners(mfPortfolios, investmentAccounts, members) {
  const accounts = investmentAccounts || []
  const people = members || []
  return (mfPortfolios || []).filter((p) => p.status !== 'Inactive').map((p) => {
    let account = accounts.find((a) => a.accountId === p.investmentAccountId)
    if (!account && p.investmentAccountId) {
      account = accounts.find((a) => `${a.accountName} - ${a.platformBroker}` === p.investmentAccountId)
    }
    const ownerId = account?.memberId || p.ownerId || ''
    const member = ownerId ? people.find((m) => m.memberId === ownerId) : null
    return { ...p, ownerId, ownerName: member?.memberName || p.ownerName || '' }
  })
}

function toFlows(txns) {
  return txns
    .map((t) => ({
      date: parseDate(t.date), amount: Number(t.totalAmount) || 0, units: Number(t.units) || 0,
      type: String(t.type || '').toUpperCase(), subType: String(t.transactionType || '').toUpperCase(),
      portfolioId: t.portfolioId,
    }))
    .filter((t) => t.date && t.amount > 0)
    .map((t) => ({
      date: t.date,
      portfolioId: t.portfolioId,
      amount: t.type === 'SELL' ? t.amount : -t.amount,
      units: (Number(t.units) || 0) * (t.type === 'SELL' ? -1 : 1),
      opening: t.subType === 'INITIAL',
      switch: t.subType === 'SWITCH',
    }))
}

const DAY = 86400000
export const MIN_HISTORY_DAYS = 90            // XIRR/CAGR need at least this much history
export const OPENING_BALANCE_MIN_DAYS = 365   // an opening balance ("Add Existing Holdings") needs a real, old date
export const OPENING_BALANCE_SHARE = 0.5      // ...when it makes up this share of recorded buys

/**
 * Decide whether XIRR / CAGR can be trusted for a set of flows.
 * Returns null when fine, otherwise a reason code:
 *   'no-history'      recorded buys do not cover the cost basis (migrated without transactions)
 *   'opening-balance' most of the money is an opening balance dated less than a year ago,
 *                     so its date is almost certainly the setup date, not the purchase date
 *   'too-new'         less than MIN_HISTORY_DAYS of history
 */
export function returnsReason(flows, invested, today, heldUnits) {
  if (!historyCovers(flows, invested, heldUnits)) return 'no-history'
  // Opening-balance share is judged against fresh money only; switch-in buys are the same money again
  const buys = flows.filter((cf) => cf.amount < 0 && !cf.switch)
  const totalBuy = buys.reduce((s, cf) => s - cf.amount, 0)
  const openingBuy = buys.filter((cf) => cf.opening).reduce((s, cf) => s - cf.amount, 0)
  if (totalBuy > 0 && openingBuy / totalBuy >= OPENING_BALANCE_SHARE) {
    const newestOpening = buys.filter((cf) => cf.opening).reduce((m, cf) => (cf.date > m ? cf.date : m), buys.find((cf) => cf.opening).date)
    if ((today - newestOpening) / DAY < OPENING_BALANCE_MIN_DAYS) return 'opening-balance'
  }
  const first = earliest(flows)
  if (!first || (today - first) / DAY < MIN_HISTORY_DAYS) return 'too-new'
  return null
}

// Buys recorded in the transaction log should cover the cost basis of what is held.
// When they do not (holdings migrated without their history), XIRR and CAGR would be wildly wrong.
const HISTORY_COVERAGE_MIN = 0.9
const UNIT_TOLERANCE = 0.02
function historyCovers(flows, invested, heldUnits) {
  if (heldUnits > 0) {
    const netUnits = flows.reduce((s, cf) => s + (cf.units || 0), 0)
    return Math.abs(netUnits - heldUnits) <= Math.max(0.01, heldUnits * UNIT_TOLERANCE)
  }
  if (!(invested > 0)) return false
  const buys = flows.reduce((s, cf) => s + (cf.amount < 0 ? -cf.amount : 0), 0)
  return buys >= invested * HISTORY_COVERAGE_MIN
}

// External cash only. A switch moves money between funds, it is never new investment or a withdrawal.
function cashIn(flows) { return flows.reduce((s, cf) => s + (cf.amount < 0 && !cf.switch ? -cf.amount : 0), 0) }
function cashOut(flows) { return flows.reduce((s, cf) => s + (cf.amount > 0 && !cf.switch ? cf.amount : 0), 0) }

// AllPortfolios column D lets a user state what they originally invested in a portfolio. When set,
// the sheet's Total Investment formula uses it instead of the opening-balance transactions. Mirror
// that here by rescaling the portfolio's opening-balance flows to that amount, keeping their dates.
function applyInitialInvestment(flows, portfolios) {
  const overrides = {}
  ;(portfolios || []).forEach((p) => {
    const v = Number(p.initialInvestment) || 0
    if (v > 0) overrides[p.portfolioId] = v
  })
  if (!Object.keys(overrides).length) return flows
  const openingTotals = {}
  flows.forEach((cf) => {
    if (cf.opening && cf.amount < 0 && overrides[cf.portfolioId]) openingTotals[cf.portfolioId] = (openingTotals[cf.portfolioId] || 0) - cf.amount
  })
  return flows.map((cf) => {
    if (!(cf.opening && cf.amount < 0 && overrides[cf.portfolioId] && openingTotals[cf.portfolioId] > 0)) return cf
    return { ...cf, amount: cf.amount * (overrides[cf.portfolioId] / openingTotals[cf.portfolioId]) }
  })
}

// Amount-weighted average date of the money put in. This is the start date a single CAGR figure
// can honestly use when purchases happened on several dates. Falls back to switch-in buys for a
// fund that only ever received money via a switch.
export function weightedInflowDate(flows) {
  let inflows = flows.filter((cf) => cf.amount < 0 && !cf.switch)
  if (!inflows.length) inflows = flows.filter((cf) => cf.amount < 0)
  const total = inflows.reduce((s, cf) => s - cf.amount, 0)
  if (!(total > 0)) return null
  const ms = inflows.reduce((s, cf) => s + (-cf.amount / total) * cf.date.getTime(), 0)
  return new Date(ms)
}

function earliest(flows) {
  return flows.length ? flows.reduce((m, cf) => (cf.date < m ? cf.date : m), flows[0].date) : null
}

function fundKey(code, name) {
  return String(code || '') || String(name || '')
}

/**
 * Build one row per fund (consolidated across the given portfolios) plus totals and allocation lists.
 * @param {{ portfolios: object[], holdings: object[], transactions: object[], today?: Date }} input
 */
export function buildFundsModel({ portfolios, holdings, transactions, today = new Date() }) {
  const portfolioById = {}
  ;(portfolios || []).forEach((p) => { portfolioById[p.portfolioId] = p })
  const inScope = (id) => Boolean(portfolioById[id])

  const activeHoldings = (holdings || []).filter((h) => inScope(h.portfolioId) && Number(h.units) > 0)
  const txns = (transactions || []).filter((t) => inScope(t.portfolioId))

  // Portfolio totals for allocation % (a portfolio's holdings are all in scope when it is)
  const portfolioTotals = {}
  activeHoldings.forEach((h) => { portfolioTotals[h.portfolioId] = (portfolioTotals[h.portfolioId] || 0) + (Number(h.currentValue) || 0) })

  const txnsByFund = {}
  txns.forEach((t) => {
    const key = fundKey(t.fundCode, t.fundName)
    if (!txnsByFund[key]) txnsByFund[key] = []
    txnsByFund[key].push(t)
  })

  const fundMap = {}
  activeHoldings.forEach((h) => {
    const code = String(h.schemeCode || h.fundCode || '')
    const key = fundKey(code, h.fundName)
    const p = portfolioById[h.portfolioId]
    const currentValue = Number(h.currentValue) || 0
    const invested = Number(h.investment) > 1 ? Number(h.investment) : currentValue
    if (!fundMap[key]) {
      fundMap[key] = {
        key, schemeCode: code, fundName: h.fundName || '', category: inferCategory(h.fundName),
        units: 0, invested: 0, currentValue: 0, currentNav: Number(h.currentNav) || 0,
        athNav: Number(h.athNav) || 0, belowATHPct: Number(h.belowATHPct) || 0,
        positions: [], members: new Set(), ongoingSIP: 0,
      }
    }
    const f = fundMap[key]
    f.units += Number(h.units) || 0
    f.invested += invested
    f.currentValue += currentValue
    f.ongoingSIP += Number(h.ongoingSIP) || 0
    if (Number(h.currentNav) > 0) f.currentNav = Number(h.currentNav)
    if (Number(h.belowATHPct) > f.belowATHPct) { f.belowATHPct = Number(h.belowATHPct); f.athNav = Number(h.athNav) || f.athNav }
    if (p?.ownerName) f.members.add(p.ownerName)

    const posFlows = toFlows((txnsByFund[key] || []).filter((t) => t.portfolioId === h.portfolioId))
    const pl = currentValue - invested
    const posReason = returnsReason(posFlows, invested, today, Number(h.units) || 0)
    const pTotal = portfolioTotals[h.portfolioId] || 0
    const currentAllocPct = pTotal > 0 ? (currentValue / pTotal) * 100 : 0
    const targetAllocPct = Number(h.targetAllocationPct) || 0
    const thresholdPct = (Number(p?.rebalanceThreshold) || 0.05) * 100
    const driftPct = targetAllocPct > 0 ? currentAllocPct - targetAllocPct : null
    f.positions.push({
      currentAllocPct, targetAllocPct, driftPct, thresholdPct,
      needsRebalance: Boolean(driftPct != null && !p?.skipRebalance && Math.abs(driftPct) > thresholdPct),
      portfolioId: h.portfolioId, portfolioName: p?.portfolioName || '', ownerName: p?.ownerName || '', ownerId: p?.ownerId || '',
      units: Number(h.units) || 0, avgNav: Number(h.avgNav) || 0, invested, currentValue, pl,
      plPct: invested > 0 ? (pl / invested) * 100 : null,
      xirr: posReason ? null : computeXIRR([...posFlows, { date: today, amount: currentValue }]),
      returnsReason: posReason,
      openingDate: posFlows.filter((cf) => cf.opening).map((cf) => cf.date).sort((a, b) => b - a)[0] || null,
      since: earliest(posFlows), ongoingSIP: Number(h.ongoingSIP) || 0,
    })
  })

  const totalValue = Object.values(fundMap).reduce((s, f) => s + f.currentValue, 0)
  const funds = Object.values(fundMap).map((f) => {
    const flows = toFlows(txnsByFund[f.key] || [])
    const since = earliest(flows)
    const pl = f.currentValue - f.invested
    const holding = { fundName: f.fundName, athNav: f.athNav, belowATHPct: f.belowATHPct }
    const reason = returnsReason(flows, f.invested, today, f.units)
    return {
      ...f,
      members: [...f.members],
      avgNav: f.units > 0 ? f.invested / f.units : 0,
      pl,
      plPct: f.invested > 0 ? (pl / f.invested) * 100 : null,
      xirr: reason ? null : computeXIRR([...flows, { date: today, amount: f.currentValue }]),
      cagr: reason ? null : computeCAGR(f.invested, f.currentValue, weightedInflowDate(flows), today),
      cagrSince: weightedInflowDate(flows),
      returnsReason: reason,
      openingDate: flows.filter((cf) => cf.opening).map((cf) => cf.date).sort((a, b) => b - a)[0] || null,
      since,
      weight: totalValue > 0 ? (f.currentValue / totalValue) * 100 : 0,
      isBuyOpp: isBuyOpportunity(holding),
      isStrongBuy: isStrongBuyOpportunity(holding),
      // Allocation targets are per portfolio, so only meaningful at fund level when held in one portfolio
      allocation: f.positions.length === 1 ? f.positions[0] : null,
      rebalanceCount: f.positions.filter((pos) => pos.needsRebalance).length,
      positions: f.positions.sort((a, b) => b.currentValue - a.currentValue),
    }
  })

  const totalInvested = funds.reduce((s, f) => s + f.invested, 0)
  const totalPL = totalValue - totalInvested
  const allFlows = applyInitialInvestment(toFlows(txns), portfolios)
  const firstDate = earliest(allFlows)
  const unreliable = funds.filter((f) => f.returnsReason)
  const totalsReason = unreliable.length > 0 ? 'funds-unreliable' : returnsReason(allFlows, totalInvested, today)
  // Money actually put in (switch legs cancel), and the gain on it including what was realised along the way
  // Prefer the sheet's own Total Investment (AllPortfolios column E) so this page agrees with the
  // Mutual Funds page; it is initial investment + SIP + lumpsum - withdrawals, switches excluded.
  const sheetInvested = (portfolios || []).reduce((s, p) => s + (Number(p.totalInvestment) || 0), 0)
  const netInvested = sheetInvested > 0 ? sheetInvested : cashIn(allFlows) - cashOut(allFlows)
  const hasCashFlows = netInvested > 0 && (sheetInvested > 0 || allFlows.length > 0)
  const totalGain = hasCashFlows ? totalValue - netInvested : null
  const cagrSince = weightedInflowDate(allFlows)
  const totals = {
    invested: totalInvested,           // cost basis of what is held now
    netInvested: hasCashFlows ? netInvested : null,
    totalGain,
    totalGainPct: totalGain != null && netInvested > 0 ? (totalGain / netInvested) * 100 : null,
    currentValue: totalValue,
    pl: totalPL,                       // unrealised, on current holdings
    plPct: totalInvested > 0 ? (totalPL / totalInvested) * 100 : null,
    xirr: totalsReason ? null : computeXIRR([...allFlows, { date: today, amount: totalValue }]),
    cagr: totalsReason || !hasCashFlows ? null : computeCAGR(netInvested, totalValue, cagrSince, today),
    cagrSince,
    returnsReason: totalsReason,
    unreliableCount: unreliable.length,
    unreliableByReason: unreliable.reduce((acc, f) => { acc[f.returnsReason] = (acc[f.returnsReason] || 0) + 1; return acc }, {}),
    since: firstDate,
    fundCount: funds.length,
    buyOppCount: funds.filter((f) => f.isBuyOpp).length,
    weightedBelowATH: totalValue > 0 ? funds.reduce((s, f) => s + f.belowATHPct * f.currentValue, 0) / totalValue : 0,
    monthlySIP: funds.reduce((s, f) => s + f.ongoingSIP, 0),
  }

  const byCategory = {}
  const byMember = {}
  funds.forEach((f) => { byCategory[f.category] = (byCategory[f.category] || 0) + f.currentValue })
  activeHoldings.forEach((h) => {
    const name = portfolioById[h.portfolioId]?.ownerName || 'Unassigned'
    byMember[name] = (byMember[name] || 0) + (Number(h.currentValue) || 0)
  })
  const toList = (obj) => Object.entries(obj)
    .map(([name, value]) => ({ name, value, pct: totalValue > 0 ? (value / totalValue) * 100 : 0 }))
    .sort((a, b) => b.value - a.value)

  return { funds, totals, categories: toList(byCategory), members: toList(byMember) }
}
