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
    .map((t) => ({ date: parseDate(t.date), amount: Number(t.totalAmount) || 0, type: String(t.type || '').toUpperCase() }))
    .filter((t) => t.date && t.amount > 0)
    .map((t) => ({ date: t.date, amount: t.type === 'SELL' ? t.amount : -t.amount }))
}

// Buys recorded in the transaction log should cover the cost basis of what is held.
// When they do not (holdings migrated without their history), XIRR and CAGR would be wildly wrong.
const HISTORY_COVERAGE_MIN = 0.9
function historyCovers(flows, invested) {
  if (!(invested > 0)) return false
  const buys = flows.reduce((s, cf) => s + (cf.amount < 0 ? -cf.amount : 0), 0)
  return buys >= invested * HISTORY_COVERAGE_MIN
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
    const posComplete = historyCovers(posFlows, invested)
    f.positions.push({
      portfolioId: h.portfolioId, portfolioName: p?.portfolioName || '', ownerName: p?.ownerName || '', ownerId: p?.ownerId || '',
      units: Number(h.units) || 0, avgNav: Number(h.avgNav) || 0, invested, currentValue, pl,
      plPct: invested > 0 ? (pl / invested) * 100 : null,
      xirr: posComplete ? computeXIRR([...posFlows, { date: today, amount: currentValue }]) : null,
      historyComplete: posComplete,
      since: earliest(posFlows), ongoingSIP: Number(h.ongoingSIP) || 0,
    })
  })

  const totalValue = Object.values(fundMap).reduce((s, f) => s + f.currentValue, 0)
  const funds = Object.values(fundMap).map((f) => {
    const flows = toFlows(txnsByFund[f.key] || [])
    const since = earliest(flows)
    const pl = f.currentValue - f.invested
    const holding = { fundName: f.fundName, athNav: f.athNav, belowATHPct: f.belowATHPct }
    const complete = historyCovers(flows, f.invested)
    return {
      ...f,
      members: [...f.members],
      avgNav: f.units > 0 ? f.invested / f.units : 0,
      pl,
      plPct: f.invested > 0 ? (pl / f.invested) * 100 : null,
      xirr: complete ? computeXIRR([...flows, { date: today, amount: f.currentValue }]) : null,
      cagr: complete ? computeCAGR(f.invested, f.currentValue, since, today) : null,
      historyComplete: complete,
      since,
      weight: totalValue > 0 ? (f.currentValue / totalValue) * 100 : 0,
      isBuyOpp: isBuyOpportunity(holding),
      isStrongBuy: isStrongBuyOpportunity(holding),
      positions: f.positions.sort((a, b) => b.currentValue - a.currentValue),
    }
  })

  const totalInvested = funds.reduce((s, f) => s + f.invested, 0)
  const totalPL = totalValue - totalInvested
  const allFlows = toFlows(txns)
  const firstDate = earliest(allFlows)
  const totalsComplete = historyCovers(allFlows, totalInvested)
  const totals = {
    invested: totalInvested,
    currentValue: totalValue,
    pl: totalPL,
    plPct: totalInvested > 0 ? (totalPL / totalInvested) * 100 : null,
    xirr: totalsComplete ? computeXIRR([...allFlows, { date: today, amount: totalValue }]) : null,
    cagr: totalsComplete ? computeCAGR(totalInvested, totalValue, firstDate, today) : null,
    historyComplete: totalsComplete,
    incompleteCount: funds.filter((f) => !f.historyComplete).length,
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
