import { useState, useMemo, useEffect } from 'react'
import { AlertTriangle, ArrowRightLeft, Wallet } from 'lucide-react'
import { formatINR, splitFundName } from '../../data/familyData'
import FundSearchInput from './FundSearchInput'

const B3_CATS = new Set(['Equity', 'ELSS', 'Index'])
const B2_CATS = new Set([
  'Hybrid', 'Multi-Asset', 'Balanced Advantage', 'Aggressive Hybrid',
  'Conservative Hybrid', 'Dynamic Asset Allocation', 'Equity Savings', 'Arbitrage',
])
const B1_CATS = new Set([
  'Liquid', 'Debt', 'Gilt', 'Low Duration', 'Ultra Short Duration', 'Overnight',
  'Money Market', 'Short Duration', 'Medium Duration', 'Long Duration',
  'Corporate Bond', 'Banking & PSU', 'Credit Risk', 'Floater',
])

function getBucket(schemeCode, category, allocMap) {
  const detail = allocMap?.[schemeCode]
  if (detail?.asset) {
    const eq = detail.asset.Equity || 0
    if (eq >= 70) return 'b3'
    if (eq >= 30) return 'b2'
    return 'b1'
  }
  if (B3_CATS.has(category)) return 'b3'
  if (B2_CATS.has(category)) return 'b2'
  if (B1_CATS.has(category)) return 'b1'
  return null
}

function SellFundRow({ fund, suggestedUnits, navMap, setNavMap, unitsMap, setUnitsMap, accentColor }) {
  const nav = (() => { const v = navMap[fund.schemeCode]; return v !== undefined && v !== '' ? parseFloat(v) || fund.currentNav : fund.currentNav })()
  const units = (() => {
    const v = unitsMap[fund.schemeCode]
    if (v !== undefined && v !== '') { const u = parseFloat(v); return isNaN(u) ? suggestedUnits : Math.min(u, fund.units) }
    return suggestedUnits
  })()
  return (
    <div className="space-y-1">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-[var(--text-secondary)] truncate">{splitFundName(fund.fundName).main}</p>
          {splitFundName(fund.fundName).plan && <p className="text-xs text-[var(--text-dim)]">{splitFundName(fund.fundName).plan}</p>}
          <p className="text-xs text-[var(--text-dim)]">{fund.portfolioName}</p>
        </div>
        <p className="text-xs font-bold tabular-nums shrink-0" style={{ color: accentColor }}>{formatINR(units * nav)}</p>
      </div>
      <div className="flex items-center gap-2 bg-[var(--bg-card)] rounded px-2 py-1.5 flex-wrap">
        <span className="text-xs text-[var(--text-dim)] shrink-0">Units</span>
        <input type="number" step="0.0001" min="0.0001" max={fund.units}
          placeholder={suggestedUnits.toFixed(4)} value={unitsMap[fund.schemeCode] ?? ''}
          onChange={e => setUnitsMap(prev => ({ ...prev, [fund.schemeCode]: e.target.value }))}
          className="w-24 text-xs font-semibold bg-[var(--bg-inset)] border border-[var(--border)] rounded px-1.5 py-0.5 text-[var(--text-primary)] focus:outline-none focus:border-violet-500" />
        <span className="text-xs text-[var(--text-dim)]">/ {fund.units.toFixed(4)} avail</span>
        <span className="text-xs text-[var(--text-dim)] shrink-0 ml-auto">NAV ₹</span>
        <input type="number" step="0.01" min="0.01"
          placeholder={fund.currentNav.toFixed(4)} value={navMap[fund.schemeCode] ?? ''}
          onChange={e => setNavMap(prev => ({ ...prev, [fund.schemeCode]: e.target.value }))}
          className="w-20 text-xs text-right font-semibold bg-[var(--bg-inset)] border border-[var(--border)] rounded px-1.5 py-0.5 text-[var(--text-primary)] focus:outline-none focus:border-violet-500" />
      </div>
    </div>
  )
}

function ToFundSelector({ allFunds, toFund, setToFund, navKey, buyNavs, setBuyNavs, switchValue, searchPlaceholder }) {
  const buyNav = (() => { const v = buyNavs[navKey]; return v !== undefined && v !== '' ? parseFloat(v) || toFund?.currentNav : toFund?.currentNav })()
  return (
    <div className="space-y-2">
      {allFunds.length > 0 ? (
        <select value={toFund ? `${toFund.portfolioId}::${toFund.schemeCode}` : ''}
          onChange={e => { const [pid, code] = e.target.value.split('::'); const f = allFunds.find(f => f.portfolioId === pid && f.schemeCode === code); if (f) setToFund(f) }}
          className="w-full text-xs bg-[var(--bg-card)] border border-[var(--border)] rounded-lg px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-violet-500">
          {allFunds.map(f => (
            <option key={`${f.portfolioId}::${f.schemeCode}`} value={`${f.portfolioId}::${f.schemeCode}`}>
              {splitFundName(f.fundName).main} · {f.portfolioName}
            </option>
          ))}
        </select>
      ) : (
        <>
          <p className="text-xs text-amber-400 bg-amber-500/10 rounded px-2 py-1.5">No suitable fund in linked portfolios — search to add one</p>
          <FundSearchInput
            value={toFund ? { schemeCode: toFund.schemeCode, fundName: toFund.fundName } : null}
            onSelect={({ schemeCode, fundName, nav }) => setToFund({ schemeCode, fundName, currentNav: nav || 0, portfolioId: null, portfolioName: 'New' })}
            placeholder={searchPlaceholder} />
        </>
      )}
      {toFund && (
        <div className="flex items-center gap-2 bg-[var(--bg-card)] rounded px-2 py-1.5">
          <span className="text-xs text-[var(--text-dim)] flex-1">
            Est. units received: <span className="font-semibold text-[var(--text-primary)] tabular-nums">{buyNav > 0 ? (switchValue / buyNav).toFixed(4) : '—'}</span>
          </span>
          <span className="text-xs text-[var(--text-dim)] shrink-0">Buy NAV ₹</span>
          <input type="number" step="0.01" min="0.01"
            placeholder={toFund.currentNav?.toFixed(4) || ''} value={buyNavs[navKey] ?? ''}
            onChange={e => setBuyNavs(prev => ({ ...prev, [navKey]: e.target.value }))}
            className="w-20 text-xs text-right font-semibold bg-[var(--bg-inset)] border border-[var(--border)] rounded px-1.5 py-0.5 text-[var(--text-primary)] focus:outline-none focus:border-violet-500" />
        </div>
      )}
    </div>
  )
}

export default function RetirementBucketPlan({ goal, goalPortfolioMappings, mfHoldings, mfPortfolios, assetAllocations, onClose, onConfirmPlan }) {
  const today = new Date().toISOString().split('T')[0]
  const [rebalanceDate, setRebalanceDate] = useState(today)
  const [b1TargetMonths, setB1TargetMonths] = useState(24)  // how much to keep in B1
  const [b2TargetMonths, setB2TargetMonths] = useState(60)  // how much to keep in B2

  // Sell nav/units — keyed by schemeCode
  const [b2SellNavs, setB2SellNavs] = useState({})
  const [b2SellUnits, setB2SellUnits] = useState({})
  const [b3ForB1Navs, setB3ForB1Navs] = useState({})
  const [b3ForB1Units, setB3ForB1Units] = useState({})
  const [b3ForB2Navs, setB3ForB2Navs] = useState({})
  const [b3ForB2Units, setB3ForB2Units] = useState({})
  const [b1SellNavs, setB1SellNavs] = useState({})
  const [b1SellUnits, setB1SellUnits] = useState({})

  // Global "into" fund choices (one per operation type — cross-portfolio)
  const [b2ToB1Fund, setB2ToB1Fund] = useState(null)
  const [b2ToB1BuyNavs, setB2ToB1BuyNavs] = useState({})
  const [b3ToB1Fund, setB3ToB1Fund] = useState(null)
  const [b3ToB1BuyNavs, setB3ToB1BuyNavs] = useState({})
  const [b3ToB2Fund, setB3ToB2Fund] = useState(null)
  const [b3ToB2BuyNavs, setB3ToB2BuyNavs] = useState({})

  const [b1WithdrawEnabled, setB1WithdrawEnabled] = useState(false)

  const mappings = useMemo(
    () => (goalPortfolioMappings || []).filter(m => m.goalId === goal.goalId),
    [goalPortfolioMappings, goal.goalId]
  )

  const plan = useMemo(() => {
    if (!mappings.length) return null
    const monthlyExp = goal.monthlyExpenses || 0
    if (!monthlyExp) return { noExpenses: true }
    const b1Target = monthlyExp * b1TargetMonths
    const b2Target = monthlyExp * b2TargetMonths

    // Build allocMap for intelligent bucket classification
    const allocMap = {}
    if (assetAllocations) {
      for (const a of assetAllocations) allocMap[a.fundCode] = { asset: a.assetAllocation }
    }

    // Collect all holdings across linked portfolios, scaled by goal's allocationPct
    const allHoldings = []
    for (const m of mappings) {
      const portfolio = mfPortfolios?.find(p => p.portfolioId === m.portfolioId)
      if (!portfolio) continue
      const portfolioName = portfolio.portfolioName?.replace(/^PFL-/, '') || portfolio.portfolioName
      const goalShare = m.allocationPct / 100
      const holdings = (mfHoldings || []).filter(h => h.portfolioId === m.portfolioId && h.units > 0)
      for (const h of holdings) allHoldings.push({
        ...h,
        currentValue: h.currentValue * goalShare,  // scale to goal's share of this portfolio
        portfolioName,
        bucket: getBucket(h.schemeCode, h.category, allocMap),
      })
    }

    const allB3 = allHoldings.filter(h => h.bucket === 'b3').sort((a, b) => b.currentValue - a.currentValue)
    const allB2 = allHoldings.filter(h => h.bucket === 'b2').sort((a, b) => b.currentValue - a.currentValue)
    const allB1 = allHoldings.filter(h => h.bucket === 'b1').sort((a, b) => b.currentValue - a.currentValue)

    const totalB3 = allB3.reduce((s, h) => s + h.currentValue, 0)
    const totalB2 = allB2.reduce((s, h) => s + h.currentValue, 0)
    const totalB1 = allB1.reduce((s, h) => s + h.currentValue, 0)

    // ── Intelligent action amounts ──
    // B1 deficit: how much B1 needs to reach target
    const b1Deficit = Math.max(0, b1Target - totalB1)

    // B2 can safely give to B1 — keeps at least 50% of its own target
    const b2SafeFloor = b2Target * 0.5
    const b2CanGive = Math.max(0, totalB2 - b2SafeFloor)

    // B2→B1: B2 fills B1 as much as it safely can
    const amtB2ToB1 = Math.min(b1Deficit, b2CanGive)

    // B3→B1 direct: what B2 couldn't cover (B2 depleted or insufficient)
    const amtB3ToB1Direct = Math.max(0, b1Deficit - amtB2ToB1)

    // B3→B2: replenish B2 back to target (what it gave to B1 + any pre-existing deficit)
    const b2AfterGiving = totalB2 - amtB2ToB1
    const amtB3ToB2 = Math.max(0, b2Target - b2AfterGiving)

    const needsB2ToB1 = amtB2ToB1 > 100
    const needsB3ToB1Direct = amtB3ToB1Direct > 100
    const needsB3ToB2 = amtB3ToB2 > 100

    // Per-portfolio: suggest sell fund + units proportional to each portfolio's bucket share
    const portfolioDetails = mappings.map(m => {
      const portfolio = mfPortfolios?.find(p => p.portfolioId === m.portfolioId)
      if (!portfolio) return null
      const portfolioName = portfolio.portfolioName?.replace(/^PFL-/, '') || portfolio.portfolioName
      const holdings = allHoldings.filter(h => h.portfolioId === m.portfolioId)

      const portB3 = holdings.filter(h => h.bucket === 'b3').sort((a, b) => b.currentValue - a.currentValue)
      const portB2 = holdings.filter(h => h.bucket === 'b2').sort((a, b) => b.currentValue - a.currentValue)
      const portB1 = holdings.filter(h => h.bucket === 'b1').sort((a, b) => b.currentValue - a.currentValue)

      const portB3Val = portB3.reduce((s, h) => s + h.currentValue, 0)
      const portB2Val = portB2.reduce((s, h) => s + h.currentValue, 0)
      const portB1Val = portB1.reduce((s, h) => s + h.currentValue, 0)

      // This portfolio's share of each bucket
      const b3Share = totalB3 > 0 ? portB3Val / totalB3 : 0
      const b2Share = totalB2 > 0 ? portB2Val / totalB2 : 0

      // Suggested sell fund + units per operation
      const b2SellFund = portB2[0] || null
      const b2SuggestedUnits = b2SellFund && b2SellFund.currentNav > 0
        ? Math.min((amtB2ToB1 * b2Share) / b2SellFund.currentNav, b2SellFund.units) : 0

      const b3ForB1Fund = portB3[0] || null
      const b3ForB1SuggestedUnits = b3ForB1Fund && b3ForB1Fund.currentNav > 0
        ? Math.min((amtB3ToB1Direct * b3Share) / b3ForB1Fund.currentNav, b3ForB1Fund.units) : 0

      // B3→B2: prefer second-largest B3 fund when B3→B1 direct also exists (both draw from B3)
      // avoids combined units on same fund exceeding available
      const b3ForB2FundRaw = (needsB3ToB1Direct && portB3.length > 1) ? portB3[1] : portB3[0]
      const b3ForB2Fund = b3ForB2FundRaw || null
      // Cap units accounting for units already committed to B3→B1 on the same fund
      const b3ForB2MaxUnits = b3ForB2Fund
        ? (b3ForB2Fund.schemeCode === b3ForB1Fund?.schemeCode
            ? Math.max(0, b3ForB2Fund.units - b3ForB1SuggestedUnits)
            : b3ForB2Fund.units)
        : 0
      const b3ForB2SuggestedUnits = b3ForB2Fund && b3ForB2Fund.currentNav > 0
        ? Math.min((amtB3ToB2 * b3Share) / b3ForB2Fund.currentNav, b3ForB2MaxUnits) : 0

      const b1SellFund = portB1[0] || null
      const b1SuggestedUnits = b1SellFund && b1SellFund.currentNav > 0
        ? Math.min(monthlyExp / b1SellFund.currentNav, b1SellFund.units) : 0

      return {
        portfolioId: m.portfolioId, portfolioName,
        portB3Val, portB2Val, portB1Val,
        b2SellFund, b2SuggestedUnits,
        b3ForB1Fund, b3ForB1SuggestedUnits,
        b3ForB2Fund, b3ForB2SuggestedUnits,
        b1SellFund, b1SuggestedUnits,
      }
    }).filter(Boolean)

    return {
      portfolioDetails, allB3, allB2, allB1,
      totalB3, totalB2, totalB1, b1Target, b2Target,
      b1Deficit, amtB2ToB1, amtB3ToB1Direct, amtB3ToB2,
      needsB2ToB1, needsB3ToB1Direct, needsB3ToB2, monthlyExp,
    }
  }, [mappings, mfHoldings, mfPortfolios, assetAllocations, b1TargetMonths, b2TargetMonths, goal.monthlyExpenses])

  // Initialize global "into" fund defaults
  useEffect(() => {
    if (!plan) return
    if (!b2ToB1Fund && plan.allB1[0]) setB2ToB1Fund(plan.allB1[0])
    if (!b3ToB1Fund && plan.allB1[0]) setB3ToB1Fund(plan.allB1[0])
    if (!b3ToB2Fund && plan.allB2[0]) setB3ToB2Fund(plan.allB2[0])
  }, [plan]) // eslint-disable-line react-hooks/exhaustive-deps

  function rNav(navMap, key, fallback) {
    const v = navMap[key]; return v !== undefined && v !== '' ? parseFloat(v) || fallback : fallback
  }
  function rUnits(unitsMap, key, suggested, max) {
    const v = unitsMap[key]
    if (v !== undefined && v !== '') { const u = parseFloat(v); return isNaN(u) ? suggested : Math.min(u, max) }
    return suggested
  }
  function sellValue(unitsMap, navMap, fund, suggested) {
    if (!fund) return 0
    return rUnits(unitsMap, fund.schemeCode, suggested, fund.units) * rNav(navMap, fund.schemeCode, fund.currentNav)
  }

  function handleConfirm() {
    const switches = [], redemptions = []

    for (const pd of plan.portfolioDetails) {
      if (plan.needsB2ToB1 && pd.b2SellFund && b2ToB1Fund) {
        const units = parseFloat(rUnits(b2SellUnits, pd.b2SellFund.schemeCode, pd.b2SuggestedUnits, pd.b2SellFund.units).toFixed(4))
        if (units > 0) switches.push({
          fromPortfolioId: pd.portfolioId, toPortfolioId: b2ToB1Fund.portfolioId || pd.portfolioId,
          fromFundCode: pd.b2SellFund.schemeCode, fromFundName: pd.b2SellFund.fundName,
          toFundCode: b2ToB1Fund.schemeCode, toFundName: b2ToB1Fund.fundName,
          units, fromFundPrice: rNav(b2SellNavs, pd.b2SellFund.schemeCode, pd.b2SellFund.currentNav),
          toFundPrice: rNav(b2ToB1BuyNavs, 'b2tob1', b2ToB1Fund.currentNav),
          switchDate: rebalanceDate, notes: `Retirement B2→B1 — ${goal.goalName}`,
        })
      }
      if (plan.needsB3ToB1Direct && pd.b3ForB1Fund && b3ToB1Fund) {
        const units = parseFloat(rUnits(b3ForB1Units, pd.b3ForB1Fund.schemeCode, pd.b3ForB1SuggestedUnits, pd.b3ForB1Fund.units).toFixed(4))
        if (units > 0) switches.push({
          fromPortfolioId: pd.portfolioId, toPortfolioId: b3ToB1Fund.portfolioId || pd.portfolioId,
          fromFundCode: pd.b3ForB1Fund.schemeCode, fromFundName: pd.b3ForB1Fund.fundName,
          toFundCode: b3ToB1Fund.schemeCode, toFundName: b3ToB1Fund.fundName,
          units, fromFundPrice: rNav(b3ForB1Navs, pd.b3ForB1Fund.schemeCode, pd.b3ForB1Fund.currentNav),
          toFundPrice: rNav(b3ToB1BuyNavs, 'b3tob1', b3ToB1Fund.currentNav),
          switchDate: rebalanceDate, notes: `Retirement B3→B1 direct — ${goal.goalName}`,
        })
      }
      if (plan.needsB3ToB2 && pd.b3ForB2Fund && b3ToB2Fund) {
        const units = parseFloat(rUnits(b3ForB2Units, pd.b3ForB2Fund.schemeCode, pd.b3ForB2SuggestedUnits, pd.b3ForB2Fund.units).toFixed(4))
        if (units > 0) switches.push({
          fromPortfolioId: pd.portfolioId, toPortfolioId: b3ToB2Fund.portfolioId || pd.portfolioId,
          fromFundCode: pd.b3ForB2Fund.schemeCode, fromFundName: pd.b3ForB2Fund.fundName,
          toFundCode: b3ToB2Fund.schemeCode, toFundName: b3ToB2Fund.fundName,
          units, fromFundPrice: rNav(b3ForB2Navs, pd.b3ForB2Fund.schemeCode, pd.b3ForB2Fund.currentNav),
          toFundPrice: rNav(b3ToB2BuyNavs, 'b3tob2', b3ToB2Fund.currentNav),
          switchDate: rebalanceDate, notes: `Retirement B3→B2 — ${goal.goalName}`,
        })
      }
      if (b1WithdrawEnabled && pd.b1SellFund) {
        const units = parseFloat(rUnits(b1SellUnits, pd.b1SellFund.schemeCode, pd.b1SuggestedUnits, pd.b1SellFund.units).toFixed(4))
        const nav = rNav(b1SellNavs, pd.b1SellFund.schemeCode, pd.b1SellFund.currentNav)
        if (units > 0) redemptions.push({
          portfolioId: pd.portfolioId,
          fundCode: pd.b1SellFund.schemeCode, fundName: pd.b1SellFund.fundName,
          units, salePrice: nav, saleDate: rebalanceDate, totalAmount: units * nav,
          notes: `Retirement withdrawal B1 — ${goal.goalName}`,
        })
      }
    }
    onConfirmPlan(switches, redemptions)
  }

  const canConfirm = !plan || (() => {
    if (plan.needsB2ToB1 && (!b2ToB1Fund || !(rNav(b2ToB1BuyNavs, 'b2tob1', b2ToB1Fund?.currentNav) > 0))) return false
    if (plan.needsB3ToB1Direct && (!b3ToB1Fund || !(rNav(b3ToB1BuyNavs, 'b3tob1', b3ToB1Fund?.currentNav) > 0))) return false
    if (plan.needsB3ToB2 && (!b3ToB2Fund || !(rNav(b3ToB2BuyNavs, 'b3tob2', b3ToB2Fund?.currentNav) > 0))) return false
    // When all buckets are at target, only allow confirm if B1 withdraw is enabled
    const nothingToSwitch = !plan.needsB2ToB1 && !plan.needsB3ToB1Direct && !plan.needsB3ToB2
    if (nothingToSwitch && !b1WithdrawEnabled) return false
    return true
  })()

  const totalCorpus = plan ? plan.totalB3 + plan.totalB2 + plan.totalB1 : 0
  const nothingNeeded = plan && !plan.needsB2ToB1 && !plan.needsB3ToB1Direct && !plan.needsB3ToB2

  if (!plan) return (
    <div className="py-8 text-center space-y-2">
      <AlertTriangle size={24} className="mx-auto text-amber-400" />
      <p className="text-sm text-[var(--text-muted)]">No portfolios linked to this goal</p>
      <button onClick={onClose} className="mt-2 px-4 py-2 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-hover)] transition-colors">Close</button>
    </div>
  )

  if (plan.noExpenses) return (
    <div className="py-8 text-center space-y-2">
      <AlertTriangle size={24} className="mx-auto text-amber-400" />
      <p className="text-sm text-[var(--text-primary)] font-semibold">Monthly expenses not set</p>
      <p className="text-xs text-[var(--text-muted)] max-w-xs mx-auto">The bucket plan requires monthly retirement expenses to compute B1 and B2 targets. Edit this goal and set the monthly expenses amount.</p>
      <button onClick={onClose} className="mt-2 px-4 py-2 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-hover)] transition-colors">Close</button>
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Date + Target config */}
      <div className="flex items-center gap-3 bg-[var(--bg-inset)] rounded-lg border border-[var(--border-light)] px-4 py-3 flex-wrap">
        <span className="text-xs text-[var(--text-dim)] shrink-0">Date</span>
        <input type="date" value={rebalanceDate} max={today} onChange={e => setRebalanceDate(e.target.value)}
          className="text-xs font-semibold bg-transparent text-[var(--text-primary)] border-none outline-none" />
        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-[var(--text-dim)]">B1 keep</span>
            <select value={b1TargetMonths} onChange={e => setB1TargetMonths(Number(e.target.value))}
              className="text-xs bg-transparent text-[var(--text-primary)] border border-[var(--border)] rounded px-2 py-0.5">
              {[12, 18, 24, 36].map(m => <option key={m} value={m}>{m} mo</option>)}
            </select>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-[var(--text-dim)]">B2 keep</span>
            <select value={b2TargetMonths} onChange={e => setB2TargetMonths(Number(e.target.value))}
              className="text-xs bg-transparent text-[var(--text-primary)] border border-[var(--border)] rounded px-2 py-0.5">
              {[36, 48, 60, 84].map(m => <option key={m} value={m}>{m} mo</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Bucket state vs targets */}
      <div className="bg-[var(--bg-inset)] rounded-lg border border-[var(--border-light)] p-4 space-y-3">
        <p className="text-sm font-bold text-[var(--text-dim)] uppercase tracking-wider">Current Bucket State vs Targets</p>
        {totalCorpus > 0 && (
          <div className="flex items-center gap-0.5 h-2.5 rounded-full overflow-hidden">
            <div className="h-full bg-violet-500" style={{ width: `${(plan.totalB3 / totalCorpus) * 100}%` }} />
            <div className="h-full bg-amber-500" style={{ width: `${(plan.totalB2 / totalCorpus) * 100}%` }} />
            <div className="h-full bg-emerald-500" style={{ width: `${(plan.totalB1 / totalCorpus) * 100}%` }} />
          </div>
        )}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'B3 Equity', value: plan.totalB3, target: null, color: 'violet', sub: 'Long-term growth' },
            { label: 'B2 Hybrid', value: plan.totalB2, target: plan.b2Target, color: 'amber', sub: `Target: ${b2TargetMonths} mo` },
            { label: 'B1 Liquid', value: plan.totalB1, target: plan.b1Target, color: 'emerald', sub: `Target: ${b1TargetMonths} mo` },
          ].map(b => {
            const ok = b.target === null || b.value >= b.target
            return (
              <div key={b.label} className={`bg-${b.color}-500/10 rounded-lg px-2 py-1.5 text-center`}>
                <p className={`text-xs font-bold text-${b.color}-400`}>{b.label}</p>
                <p className="text-xs font-semibold text-[var(--text-primary)] tabular-nums">{formatINR(b.value)}</p>
                {b.target !== null && (
                  <p className={`text-xs font-semibold mt-0.5 ${ok ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {ok ? '✓ Funded' : `↓ ${formatINR(b.target - b.value)} short`}
                  </p>
                )}
                <p className="text-xs text-[var(--text-dim)]">{b.sub}</p>
              </div>
            )
          })}
        </div>
        {plan.monthlyExp > 0 && (
          <p className="text-xs text-[var(--text-dim)]">
            Monthly expenses: <span className="font-semibold">{formatINR(plan.monthlyExp)}</span>
            {plan.b1Deficit > 0 && <> · B1 short by <span className="text-rose-400 font-semibold">{formatINR(plan.b1Deficit)}</span></>}
          </p>
        )}
      </div>

      {/* Intelligent actions */}
      {nothingNeeded ? (
        <div className="bg-emerald-500/10 rounded-lg border border-emerald-500/20 px-4 py-3 text-center">
          <p className="text-sm font-semibold text-emerald-400">All buckets at target — nothing to rebalance</p>
          <p className="text-xs text-[var(--text-dim)] mt-1">Use "Withdraw from B1" below to redeem for monthly expenses.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm font-bold text-[var(--text-dim)] uppercase tracking-wider px-1">Recommended Switches</p>

          {/* B2 → B1 */}
          {plan.needsB2ToB1 && (
            <div className="bg-[var(--bg-inset)] rounded-lg border border-[var(--border-light)] overflow-hidden">
              <div className="px-4 py-2.5 bg-amber-500/5 border-b border-[var(--border-light)] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">B2</span>
                  <ArrowRightLeft size={10} className="text-[var(--text-dim)]" />
                  <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">B1</span>
                  <span className="text-xs text-[var(--text-secondary)]">Hybrid → Liquid (B2 has surplus)</span>
                </div>
                <span className="text-xs font-bold text-amber-400 tabular-nums">{formatINR(plan.amtB2ToB1)}</span>
              </div>
              <div className="px-4 py-3 space-y-3">
                {plan.portfolioDetails.filter(pd => pd.b2SellFund).map(pd => (
                  <SellFundRow key={pd.portfolioId} fund={pd.b2SellFund} suggestedUnits={pd.b2SuggestedUnits}
                    navMap={b2SellNavs} setNavMap={setB2SellNavs} unitsMap={b2SellUnits} setUnitsMap={setB2SellUnits} accentColor="#f59e0b" />
                ))}
                {plan.portfolioDetails.every(pd => !pd.b2SellFund) && <p className="text-xs text-[var(--text-dim)]">No hybrid funds in linked portfolios</p>}
                <div className="flex items-center gap-2"><div className="flex-1 h-px bg-[var(--border-light)]" /><ArrowRightLeft size={10} className="text-amber-400" /><span className="text-xs text-[var(--text-dim)]">into B1 (Liquid/Debt)</span><div className="flex-1 h-px bg-[var(--border-light)]" /></div>
                <ToFundSelector allFunds={plan.allB1} toFund={b2ToB1Fund} setToFund={setB2ToB1Fund} navKey="b2tob1"
                  buyNavs={b2ToB1BuyNavs} setBuyNavs={setB2ToB1BuyNavs}
                  switchValue={plan.portfolioDetails.reduce((s, pd) => s + sellValue(b2SellUnits, b2SellNavs, pd.b2SellFund, pd.b2SuggestedUnits), 0)}
                  searchPlaceholder="Search liquid/debt fund..." />
              </div>
            </div>
          )}

          {/* B3 → B1 direct (only when B2 insufficient) */}
          {plan.needsB3ToB1Direct && (
            <div className="bg-[var(--bg-inset)] rounded-lg border border-[var(--border-light)] overflow-hidden">
              <div className="px-4 py-2.5 bg-violet-500/5 border-b border-[var(--border-light)] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-400">B3</span>
                  <ArrowRightLeft size={10} className="text-[var(--text-dim)]" />
                  <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">B1</span>
                  <span className="text-xs text-[var(--text-secondary)]">Equity → Liquid directly (B2 depleted)</span>
                </div>
                <span className="text-xs font-bold text-violet-400 tabular-nums">{formatINR(plan.amtB3ToB1Direct)}</span>
              </div>
              <div className="px-4 py-3 space-y-3">
                {plan.portfolioDetails.filter(pd => pd.b3ForB1Fund && pd.b3ForB1SuggestedUnits > 0).map(pd => (
                  <SellFundRow key={pd.portfolioId} fund={pd.b3ForB1Fund} suggestedUnits={pd.b3ForB1SuggestedUnits}
                    navMap={b3ForB1Navs} setNavMap={setB3ForB1Navs} unitsMap={b3ForB1Units} setUnitsMap={setB3ForB1Units} accentColor="#8b5cf6" />
                ))}
                <div className="flex items-center gap-2"><div className="flex-1 h-px bg-[var(--border-light)]" /><ArrowRightLeft size={10} className="text-violet-400" /><span className="text-xs text-[var(--text-dim)]">into B1 (Liquid/Debt)</span><div className="flex-1 h-px bg-[var(--border-light)]" /></div>
                <ToFundSelector allFunds={plan.allB1} toFund={b3ToB1Fund} setToFund={setB3ToB1Fund} navKey="b3tob1"
                  buyNavs={b3ToB1BuyNavs} setBuyNavs={setB3ToB1BuyNavs}
                  switchValue={plan.portfolioDetails.reduce((s, pd) => s + sellValue(b3ForB1Units, b3ForB1Navs, pd.b3ForB1Fund, pd.b3ForB1SuggestedUnits), 0)}
                  searchPlaceholder="Search liquid/debt fund..." />
              </div>
            </div>
          )}

          {/* B3 → B2 (replenish hybrid buffer) */}
          {plan.needsB3ToB2 && (
            <div className="bg-[var(--bg-inset)] rounded-lg border border-[var(--border-light)] overflow-hidden">
              <div className="px-4 py-2.5 bg-violet-500/5 border-b border-[var(--border-light)] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-400">B3</span>
                  <ArrowRightLeft size={10} className="text-[var(--text-dim)]" />
                  <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">B2</span>
                  <span className="text-xs text-[var(--text-secondary)]">Equity → Hybrid (replenish B2 buffer)</span>
                </div>
                <span className="text-xs font-bold text-violet-400 tabular-nums">{formatINR(plan.amtB3ToB2)}</span>
              </div>
              <div className="px-4 py-3 space-y-3">
                {plan.portfolioDetails.filter(pd => pd.b3ForB2Fund && pd.b3ForB2SuggestedUnits > 0).map(pd => (
                  <SellFundRow key={pd.portfolioId} fund={pd.b3ForB2Fund} suggestedUnits={pd.b3ForB2SuggestedUnits}
                    navMap={b3ForB2Navs} setNavMap={setB3ForB2Navs} unitsMap={b3ForB2Units} setUnitsMap={setB3ForB2Units} accentColor="#8b5cf6" />
                ))}
                <div className="flex items-center gap-2"><div className="flex-1 h-px bg-[var(--border-light)]" /><ArrowRightLeft size={10} className="text-violet-400" /><span className="text-xs text-[var(--text-dim)]">into B2 (Hybrid)</span><div className="flex-1 h-px bg-[var(--border-light)]" /></div>
                <ToFundSelector allFunds={plan.allB2} toFund={b3ToB2Fund} setToFund={setB3ToB2Fund} navKey="b3tob2"
                  buyNavs={b3ToB2BuyNavs} setBuyNavs={setB3ToB2BuyNavs}
                  switchValue={plan.portfolioDetails.reduce((s, pd) => s + sellValue(b3ForB2Units, b3ForB2Navs, pd.b3ForB2Fund, pd.b3ForB2SuggestedUnits), 0)}
                  searchPlaceholder="Search hybrid fund..." />
              </div>
            </div>
          )}
        </div>
      )}

      {/* B1 withdraw — always optional */}
      <div className="bg-[var(--bg-inset)] rounded-lg border border-[var(--border-light)] overflow-hidden">
        <div className="px-4 py-2.5 bg-emerald-500/5 border-b border-[var(--border-light)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">B1</span>
            <span className="text-xs text-[var(--text-secondary)]">Withdraw — Redeem Liquid for Expenses</span>
          </div>
          <button onClick={() => setB1WithdrawEnabled(v => !v)}
            className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors ${b1WithdrawEnabled ? 'text-emerald-400 bg-emerald-500/10' : 'text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'}`}>
            {b1WithdrawEnabled ? 'Enabled' : 'Add'}
          </button>
        </div>
        {b1WithdrawEnabled && (
          <div className="px-4 py-3 space-y-2">
            {plan.portfolioDetails.filter(pd => pd.b1SellFund).map(pd => (
              <SellFundRow key={pd.portfolioId} fund={pd.b1SellFund} suggestedUnits={pd.b1SuggestedUnits}
                navMap={b1SellNavs} setNavMap={setB1SellNavs} unitsMap={b1SellUnits} setUnitsMap={setB1SellUnits} accentColor="#10b981" />
            ))}
            {plan.portfolioDetails.every(pd => !pd.b1SellFund) && (
              <p className="text-xs text-amber-400">No liquid/debt fund in linked portfolios — top up B1 first</p>
            )}
          </div>
        )}
      </div>

      <p className="text-xs text-[var(--text-dim)] px-1">
        Actions computed from current B1/B2 levels vs targets. B3→B1 direct only appears when B2 can't fully cover B1's deficit. Adjust B1/B2 target months above to change thresholds.
      </p>

      <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border-light)]">
        <button onClick={onClose} className="px-5 py-2 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-hover)] transition-colors">Close</button>
        <button onClick={handleConfirm} disabled={!canConfirm}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          <Wallet size={13} />
          Confirm Plan
        </button>
      </div>
    </div>
  )
}
