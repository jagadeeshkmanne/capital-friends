import { useState, useMemo, useEffect } from 'react'
import { AlertTriangle, ArrowRightLeft } from 'lucide-react'
import { formatINR, splitFundName } from '../../data/familyData'
import FundSearchInput from './FundSearchInput'

const EQUITY_CATS = new Set(['Equity', 'ELSS', 'Index'])
const DEBT_CATS = new Set([
  'Debt', 'Liquid', 'Gilt', 'Low Duration', 'Ultra Short Duration', 'Overnight',
  'Money Market', 'Short Duration', 'Medium Duration', 'Long Duration',
  'Corporate Bond', 'Banking & PSU', 'Credit Risk', 'Floater',
])

function equityWeight(h, allocMap) {
  const detailed = allocMap?.[h.schemeCode || h.fundCode]
  if (detailed) return (detailed.Equity || 0) / 100
  if (EQUITY_CATS.has(h.category)) return 1
  if (h.category === 'Hybrid') return 0.65
  if (h.category === 'Multi-Asset') return 0.50
  return 0
}

export default function GlidepathRebalancePlan({ goal, health, goalPortfolioMappings, mfHoldings, mfPortfolios, assetAllocations, onClose, onConfirmRebalance }) {
  const today = new Date().toISOString().split('T')[0]
  const [rebalanceDate, setRebalanceDate] = useState(today)
  const [sellNavs, setSellNavs] = useState({})          // schemeCode → navString
  const [sellUnits, setSellUnits] = useState({})         // schemeCode → unitsString
  const [toFundChoices, setToFundChoices] = useState({}) // portfolioId → { schemeCode, fundName, currentNav }
  const [buyNavs, setBuyNavs] = useState({})             // portfolioId → navString

  const mappings = useMemo(
    () => (goalPortfolioMappings || []).filter(m => m.goalId === goal.goalId),
    [goalPortfolioMappings, goal.goalId]
  )

  // Build fund breakdown lookup
  const allocMap = useMemo(() => {
    const m = {}
    if (assetAllocations) {
      for (const a of assetAllocations) {
        if (a.assetAllocation) m[a.fundCode] = a.assetAllocation
      }
    }
    return m
  }, [assetAllocations])

  const plan = useMemo(() => {
    if (!mappings.length) return null
    const portfolioDetails = mappings.map(m => {
      const portfolio = mfPortfolios.find(p => p.portfolioId === m.portfolioId)
      if (!portfolio) return null
      const holdings = (mfHoldings || []).filter(h => h.portfolioId === m.portfolioId && h.units > 0)
      const goalShare = m.allocationPct / 100

      let totalGoalValue = 0, equityGoalValue = 0
      for (const h of holdings) {
        const v = h.currentValue * goalShare
        totalGoalValue += v
        equityGoalValue += v * equityWeight(h, allocMap)
      }

      const targetEquityValue = (health.recommendedEquity / 100) * totalGoalValue
      const excessEquityValue = Math.max(0, equityGoalValue - targetEquityValue)

      // Equity funds sorted by value desc (sell candidates)
      const equityFunds = holdings
        .filter(h => equityWeight(h, allocMap) > 0)
        .sort((a, b) => b.currentValue - a.currentValue)

      // Debt/liquid funds (switch-into candidates)
      const debtFunds = holdings.filter(h => DEBT_CATS.has(h.category))

      // Greedy: suggest units to sell per equity fund
      const suggestedSells = []
      let remaining = excessEquityValue
      for (const h of equityFunds) {
        if (remaining <= 0) break
        const sellValue = Math.min(h.currentValue * goalShare, remaining)
        const suggestedUnits = Math.min(sellValue / h.currentNav, h.units)
        if (suggestedUnits > 0.0001) {
          suggestedSells.push({ ...h, suggestedUnits, sellValue })
          remaining -= sellValue
        }
      }

      return {
        portfolioId: m.portfolioId,
        portfolioName: portfolio.portfolioName?.replace(/^PFL-/, '') || portfolio.portfolioName,
        allocationPct: m.allocationPct,
        totalGoalValue,
        equityGoalValue,
        excessEquityValue,
        debtFunds,
        suggestedSells,
      }
    }).filter(Boolean)

    return { portfolioDetails }
  }, [mappings, mfHoldings, mfPortfolios, health, allocMap])

  // Initialize toFundChoices for portfolios with debt funds (first-time only)
  useEffect(() => {
    if (!plan) return
    const defaults = {}
    for (const pd of plan.portfolioDetails) {
      if (pd.debtFunds.length > 0 && !toFundChoices[pd.portfolioId]) {
        defaults[pd.portfolioId] = pd.debtFunds[0]
      }
    }
    if (Object.keys(defaults).length > 0) {
      setToFundChoices(prev => ({ ...defaults, ...prev }))
    }
  }, [plan]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!plan) {
    return (
      <div className="py-8 text-center space-y-2">
        <AlertTriangle size={24} className="mx-auto text-amber-400" />
        <p className="text-sm text-[var(--text-muted)]">No portfolios linked to this goal</p>
        <button onClick={onClose} className="mt-2 px-4 py-2 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-hover)] transition-colors">
          Close
        </button>
      </div>
    )
  }

  const totalExcess = plan.portfolioDetails.reduce((s, pd) => s + pd.excessEquityValue, 0)
  const allAligned = totalExcess === 0

  function getSellNav(schemeCode, currentNav) {
    const v = sellNavs[schemeCode]
    return v !== undefined && v !== '' ? parseFloat(v) || currentNav : currentNav
  }

  function getSellUnits(schemeCode, suggestedUnits, availableUnits) {
    const v = sellUnits[schemeCode]
    if (v !== undefined && v !== '') {
      const u = parseFloat(v)
      return isNaN(u) ? suggestedUnits : Math.min(u, availableUnits)
    }
    return suggestedUnits
  }

  function getBuyNav(portfolioId, fallbackNav) {
    const v = buyNavs[portfolioId]
    return v !== undefined && v !== '' ? parseFloat(v) || fallbackNav : fallbackNav
  }

  function buildSwitches() {
    const switches = []
    for (const pd of plan.portfolioDetails) {
      const toFund = toFundChoices[pd.portfolioId]
      if (!toFund || pd.suggestedSells.length === 0) continue
      const buyNav = getBuyNav(pd.portfolioId, toFund.currentNav)
      for (const sell of pd.suggestedSells) {
        const sellNav = getSellNav(sell.schemeCode, sell.currentNav)
        const units = parseFloat(getSellUnits(sell.schemeCode, sell.suggestedUnits, sell.units).toFixed(4))
        switches.push({
          fromPortfolioId: pd.portfolioId,
          toPortfolioId: pd.portfolioId,
          fromFundCode: sell.schemeCode,
          fromFundName: sell.fundName,
          toFundCode: toFund.schemeCode,
          toFundName: toFund.fundName,
          units,
          fromFundPrice: sellNav,
          toFundPrice: buyNav,
          switchDate: rebalanceDate,
          notes: `Glide path rebalance — ${goal.goalName}`,
        })
      }
    }
    return switches
  }

  // Check if all portfolios have a toFund selected with a valid NAV
  const canConfirm = plan.portfolioDetails.every(pd => {
    if (pd.suggestedSells.length === 0) return true
    const toFund = toFundChoices[pd.portfolioId]
    if (!toFund) return false
    const buyNav = getBuyNav(pd.portfolioId, toFund.currentNav)
    return buyNav > 0
  })

  return (
    <div className="space-y-4">
      {/* Date */}
      <div className="flex items-center gap-3 bg-[var(--bg-inset)] rounded-lg border border-[var(--border-light)] px-4 py-3">
        <span className="text-xs text-[var(--text-dim)] shrink-0">Rebalance Date</span>
        <input
          type="date" value={rebalanceDate} max={today}
          onChange={e => setRebalanceDate(e.target.value)}
          className="flex-1 text-xs font-semibold bg-transparent text-[var(--text-primary)] border-none outline-none text-right"
        />
      </div>

      {/* Summary */}
      <div className="bg-[var(--bg-inset)] rounded-lg border border-[var(--border-light)] p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--text-dim)]">Current Equity</span>
          <span className="text-sm font-bold text-amber-400">{health.actualEquity}%</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--text-dim)]">Target Equity (Glide Path)</span>
          <span className="text-sm font-bold text-emerald-400">{health.recommendedEquity}%</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-[var(--bg-card)] rounded-full overflow-hidden relative">
            <div className="h-full bg-amber-500 rounded-full" style={{ width: `${Math.min(health.actualEquity, 100)}%` }} />
            <div className="absolute top-0 h-full w-0.5 bg-emerald-500" style={{ left: `${Math.min(health.recommendedEquity, 100)}%` }} />
          </div>
          <span className="text-xs font-bold text-amber-400 tabular-nums">{health.mismatch > 0 ? '+' : ''}{health.mismatch}% over</span>
        </div>
        {!allAligned && (
          <p className="text-xs text-[var(--text-dim)] pt-1">Total to move equity → debt: <span className="font-semibold text-[var(--text-primary)]">{formatINR(totalExcess)}</span></p>
        )}
      </div>

      {allAligned ? (
        <div className="bg-emerald-500/10 rounded-lg px-4 py-3 border border-emerald-500/20 text-center">
          <p className="text-sm font-semibold text-emerald-400">Already aligned — no rebalancing needed</p>
        </div>
      ) : (
        plan.portfolioDetails.map(pd => {
          const toFund = toFundChoices[pd.portfolioId]
          const buyNav = getBuyNav(pd.portfolioId, toFund?.currentNav)
          const totalSwitchValue = pd.suggestedSells.reduce((s, sell) => s + getSellUnits(sell.schemeCode, sell.suggestedUnits, sell.units) * getSellNav(sell.schemeCode, sell.currentNav), 0)

          return (
            <div key={pd.portfolioId} className="bg-[var(--bg-inset)] rounded-lg border border-[var(--border-light)] overflow-hidden">
              {/* Portfolio header */}
              <div className="px-4 py-2.5 bg-[var(--bg-card)] border-b border-[var(--border-light)] flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-[var(--text-primary)]">{pd.portfolioName}</p>
                  <p className="text-xs text-[var(--text-dim)]">{pd.allocationPct}% linked to goal</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-[var(--text-dim)]">Excess equity</p>
                  <p className="text-xs font-bold text-amber-400">{formatINR(pd.excessEquityValue)}</p>
                </div>
              </div>

              <div className="px-4 py-3 space-y-3">
                {/* SELL section */}
                {pd.suggestedSells.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-bold text-[var(--text-dim)] uppercase tracking-wider">Sell (Equity)</p>
                    {pd.suggestedSells.map(sell => {
                      const nav = getSellNav(sell.schemeCode, sell.currentNav)
                      const units = getSellUnits(sell.schemeCode, sell.suggestedUnits, sell.units)
                      const amount = units * nav
                      return (
                        <div key={sell.schemeCode} className="space-y-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-xs text-[var(--text-secondary)] truncate">{splitFundName(sell.fundName).main}</p>
                              {splitFundName(sell.fundName).plan && <p className="text-xs text-[var(--text-dim)]">{splitFundName(sell.fundName).plan}</p>}
                            </div>
                            <p className="text-xs font-bold text-[var(--text-primary)] tabular-nums shrink-0">{formatINR(amount)}</p>
                          </div>
                          <div className="flex items-center gap-2 bg-[var(--bg-card)] rounded px-2 py-1.5 flex-wrap">
                            <span className="text-xs text-[var(--text-dim)] shrink-0">Units</span>
                            <input
                              type="number" step="0.0001" min="0.0001" max={sell.units}
                              placeholder={sell.suggestedUnits.toFixed(4)}
                              value={sellUnits[sell.schemeCode] ?? ''}
                              onChange={e => setSellUnits(prev => ({ ...prev, [sell.schemeCode]: e.target.value }))}
                              className="w-24 text-xs font-semibold bg-[var(--bg-inset)] border border-[var(--border)] rounded px-1.5 py-0.5 text-[var(--text-primary)] focus:outline-none focus:border-violet-500"
                            />
                            <span className="text-xs text-[var(--text-dim)]">/ {sell.units.toFixed(4)} avail</span>
                            <span className="text-xs text-[var(--text-dim)] shrink-0 ml-auto">Sell NAV ₹</span>
                            <input
                              type="number" step="0.01" min="0.01"
                              placeholder={sell.currentNav.toFixed(4)}
                              value={sellNavs[sell.schemeCode] ?? ''}
                              onChange={e => setSellNavs(prev => ({ ...prev, [sell.schemeCode]: e.target.value }))}
                              className="w-20 text-xs text-right font-semibold bg-[var(--bg-inset)] border border-[var(--border)] rounded px-1.5 py-0.5 text-[var(--text-primary)] focus:outline-none focus:border-violet-500"
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Divider with arrow */}
                <div className="flex items-center gap-2 py-1">
                  <div className="flex-1 h-px bg-[var(--border-light)]" />
                  <ArrowRightLeft size={12} className="text-violet-400 shrink-0" />
                  <div className="flex-1 h-px bg-[var(--border-light)]" />
                </div>

                {/* SWITCH INTO section */}
                <div className="space-y-2">
                  <p className="text-sm font-bold text-[var(--text-dim)] uppercase tracking-wider">Switch Into (Debt/Liquid)</p>
                  {pd.debtFunds.length > 0 ? (
                    <>
                      <select
                        value={toFund?.schemeCode || ''}
                        onChange={e => {
                          const f = pd.debtFunds.find(d => d.schemeCode === e.target.value)
                          if (f) setToFundChoices(prev => ({ ...prev, [pd.portfolioId]: f }))
                        }}
                        className="w-full text-xs bg-[var(--bg-card)] border border-[var(--border)] rounded-lg px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-violet-500"
                      >
                        {pd.debtFunds.map(f => (
                          <option key={f.schemeCode} value={f.schemeCode}>{splitFundName(f.fundName).main}</option>
                        ))}
                      </select>
                      {toFund && (
                        <div className="flex items-center gap-2 bg-[var(--bg-card)] rounded px-2 py-1.5">
                          <span className="text-xs text-[var(--text-dim)] flex-1">
                            Est. units bought: <span className="font-semibold text-[var(--text-primary)] tabular-nums">
                              {buyNav > 0 ? (totalSwitchValue / buyNav).toFixed(4) : '—'}
                            </span>
                          </span>
                          <span className="text-xs text-[var(--text-dim)] shrink-0">Buy NAV ₹</span>
                          <input
                            type="number" step="0.01" min="0.01"
                            placeholder={toFund.currentNav?.toFixed(4) || ''}
                            value={buyNavs[pd.portfolioId] ?? ''}
                            onChange={e => setBuyNavs(prev => ({ ...prev, [pd.portfolioId]: e.target.value }))}
                            className="w-20 text-xs text-right font-semibold bg-[var(--bg-inset)] border border-[var(--border)] rounded px-1.5 py-0.5 text-[var(--text-primary)] focus:outline-none focus:border-violet-500"
                          />
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-amber-400 bg-amber-500/10 rounded px-2 py-1.5">
                        No debt/liquid fund in this portfolio — search to switch into one
                      </p>
                      <FundSearchInput
                        value={toFund ? { schemeCode: toFund.schemeCode, fundName: toFund.fundName } : null}
                        onSelect={({ schemeCode, fundName, nav }) => setToFundChoices(prev => ({ ...prev, [pd.portfolioId]: { schemeCode, fundName, currentNav: nav || 0 } }))}
                        placeholder="Search debt/liquid fund..."
                      />
                      {toFund && (
                        <div className="flex items-center gap-2 bg-[var(--bg-card)] rounded px-2 py-1.5">
                          <span className="text-xs text-[var(--text-dim)] flex-1">
                            Est. units bought: <span className="font-semibold text-[var(--text-primary)] tabular-nums">
                              {buyNav > 0 ? (totalSwitchValue / buyNav).toFixed(4) : '—'}
                            </span>
                          </span>
                          <span className="text-xs text-[var(--text-dim)] shrink-0">Buy NAV ₹</span>
                          <input
                            type="number" step="0.01" min="0.01"
                            placeholder="e.g., 1234.56"
                            value={buyNavs[pd.portfolioId] ?? ''}
                            onChange={e => setBuyNavs(prev => ({ ...prev, [pd.portfolioId]: e.target.value }))}
                            className="w-20 text-xs text-right font-semibold bg-[var(--bg-inset)] border border-[var(--border)] rounded px-1.5 py-0.5 text-[var(--text-primary)] focus:outline-none focus:border-violet-500"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })
      )}

      <p className="text-xs text-[var(--text-dim)] px-1">
        Units and NAVs are pre-filled based on your goal allocation — edit both to match what you actually executed in your AMC/broker. Each equity fund becomes a separate switch transaction.
      </p>

      <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border-light)]">
        <button onClick={onClose} className="px-5 py-2 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-hover)] transition-colors">
          Close
        </button>
        {!allAligned && onConfirmRebalance && (
          <button
            onClick={() => onConfirmRebalance(buildSwitches())}
            disabled={!canConfirm}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-violet-400 bg-violet-500/10 hover:bg-violet-500/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ArrowRightLeft size={13} />
            Confirm Switches
          </button>
        )}
      </div>
    </div>
  )
}
