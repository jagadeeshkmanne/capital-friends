import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowRightLeft, ShieldCheck, TrendingUp, Wallet } from 'lucide-react'
import { formatINR, splitFundName } from '../../data/familyData'
import FundSearchInput from './FundSearchInput'
import { allocateBucketWithdrawal, buildRetirementBucketPlan } from '../../utils/retirementBuckets'

const BUCKETS = {
  b1: { label: 'B1 · Income', period: 'Years 0–2', tone: 'emerald', icon: Wallet },
  b2: { label: 'B2 · Stability', period: 'Years 2–7', tone: 'amber', icon: ShieldCheck },
  b3: { label: 'B3 · Growth', period: 'Year 7 onward', description: 'Remaining long-term corpus in growth equity', tone: 'violet', icon: TrendingUp },
}

const TONE = {
  emerald: { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  amber: { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  violet: { text: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20' },
}

function inputNumber(map, key, fallback, max = Infinity) {
  const value = map[key]
  if (value === undefined || value === '') return fallback
  const parsed = parseFloat(value)
  if (Number.isNaN(parsed)) return fallback
  return Math.max(0, Math.min(parsed, max))
}

function groupAllocations(operation) {
  return operation.allocations.reduce((groups, allocation) => {
    if (!groups[allocation.portfolioId]) groups[allocation.portfolioId] = []
    groups[allocation.portfolioId].push(allocation)
    return groups
  }, {})
}

export default function RetirementBucketPlan({
  goal,
  goalPortfolioMappings,
  mfHoldings,
  mfPortfolios,
  assetAllocations,
  executionEnabled = true,
  onClose,
  onConfirmPlan,
}) {
  const today = new Date().toISOString().split('T')[0]
  const [rebalanceDate, setRebalanceDate] = useState(today)
  const [b1TargetMonths, setB1TargetMonths] = useState(24)
  const [b2TargetMonths, setB2TargetMonths] = useState(60)
  const [sellUnits, setSellUnits] = useState({})
  const [sellNavs, setSellNavs] = useState({})
  const [destinations, setDestinations] = useState({})
  const [buyNavs, setBuyNavs] = useState({})
  const [withdrawEnabled, setWithdrawEnabled] = useState(false)
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [withdrawUnits, setWithdrawUnits] = useState({})
  const [withdrawNavs, setWithdrawNavs] = useState({})

  const plan = useMemo(() => buildRetirementBucketPlan({
    goal,
    mappings: goalPortfolioMappings,
    holdings: mfHoldings,
    portfolios: mfPortfolios,
    assetAllocations,
    b1TargetMonths,
    b2TargetMonths,
    planDate: new Date(`${rebalanceDate}T00:00:00`),
  }), [goal, goalPortfolioMappings, mfHoldings, mfPortfolios, assetAllocations, b1TargetMonths, b2TargetMonths, rebalanceDate])

  const linkedPortfolios = useMemo(() => {
    if (!plan?.allFunds) return []
    const grouped = {}
    for (const fund of plan.allFunds) {
      if (!grouped[fund.portfolioId]) {
        grouped[fund.portfolioId] = {
          portfolioId: fund.portfolioId,
          portfolioName: fund.portfolioName,
          allocationPct: fund.allocationPct,
          portfolioValue: 0,
          goalValue: 0,
        }
      }
      grouped[fund.portfolioId].portfolioValue += Number(fund.currentValue) || (fund.currentNav * Number(fund.units || 0))
      grouped[fund.portfolioId].goalValue += fund.goalValue
    }
    return Object.values(grouped)
  }, [plan])

  useEffect(() => {
    if (!plan) return
    if (withdrawAmount === '') setWithdrawAmount(String(Math.round(plan.expense.monthlyExpense)))

    const defaults = {}
    for (const operation of plan.operations) {
      for (const portfolioId of Object.keys(groupAllocations(operation))) {
        const key = `${operation.id}::${portfolioId}`
        if (destinations[key]) continue
        const candidate = plan.byBucket[operation.to].find(fund => fund.portfolioId === portfolioId)
        if (candidate) defaults[key] = candidate
      }
    }
    if (Object.keys(defaults).length) setDestinations(previous => ({ ...defaults, ...previous }))
  }, [plan, destinations, withdrawAmount])

  if (!plan) return <EmptyState title="No portfolios linked to this goal" detail="Link a mutual-fund portfolio to see the bucket plan." onClose={onClose} />
  if (plan.noExpenses) return <EmptyState title="Monthly expenses not set" detail="Edit the retirement goal and enter monthly expenses before opening the bucket plan." onClose={onClose} />

  const withdrawal = allocateBucketWithdrawal(plan.byBucket.b1, withdrawAmount)

  function sellKey(operation, allocation) {
    return `${operation.id}::${allocation.key}`
  }

  function destinationKey(operation, portfolioId) {
    return `${operation.id}::${portfolioId}`
  }

  function getSellUnits(operation, allocation) {
    return inputNumber(sellUnits, sellKey(operation, allocation), allocation.units, allocation.units)
  }

  function getSellNav(operation, allocation) {
    return inputNumber(sellNavs, sellKey(operation, allocation), allocation.currentNav)
  }

  function buildTransactions() {
    const switches = []
    for (const operation of plan.operations) {
      for (const allocation of operation.allocations) {
        const destKey = destinationKey(operation, allocation.portfolioId)
        const destination = destinations[destKey]
        if (!destination) continue
        const units = parseFloat(getSellUnits(operation, allocation).toFixed(4))
        const fromFundPrice = getSellNav(operation, allocation)
        const toFundPrice = inputNumber(buyNavs, destKey, destination.currentNav)
        if (units <= 0 || fromFundPrice <= 0 || toFundPrice <= 0) continue
        switches.push({
          fromPortfolioId: allocation.portfolioId,
          toPortfolioId: allocation.portfolioId,
          fromFundCode: allocation.schemeCode,
          fromFundName: allocation.fundName,
          toFundCode: destination.schemeCode,
          toFundName: destination.fundName,
          units,
          fromFundPrice,
          toFundPrice,
          switchDate: rebalanceDate,
          notes: `Retirement ${operation.label} — ${goal.goalName}`,
        })
      }
    }

    const redemptions = withdrawEnabled ? withdrawal.allocations.map(allocation => {
      const key = `withdraw::${allocation.key}`
      const units = inputNumber(withdrawUnits, key, allocation.units, allocation.units)
      const salePrice = inputNumber(withdrawNavs, key, allocation.currentNav)
      return {
        portfolioId: allocation.portfolioId,
        fundCode: allocation.schemeCode,
        fundName: allocation.fundName,
        units: parseFloat(units.toFixed(4)),
        salePrice,
        saleDate: rebalanceDate,
        totalAmount: units * salePrice,
        notes: `Retirement B1 monthly withdrawal — ${goal.goalName}`,
      }
    }).filter(item => item.units > 0 && item.salePrice > 0) : []

    return { switches, redemptions }
  }

  const missingDestination = plan.operations.some(operation =>
    operation.allocations.some(allocation => {
      const key = destinationKey(operation, allocation.portfolioId)
      const destination = destinations[key]
      return !destination || inputNumber(buyNavs, key, destination.currentNav) <= 0
    }),
  )
  const hasUnclassified = plan.totals.unclassified > 1
  const transactions = buildTransactions()
  const canConfirm = executionEnabled && !hasUnclassified && plan.targetShortfall <= 1 && !missingDestination
    && (transactions.switches.length > 0 || transactions.redemptions.length > 0)

  return (
    <div className="space-y-4">
      {!executionEnabled && (
        <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 px-4 py-3">
          <p className="text-sm font-semibold text-blue-400">Preview only</p>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">Transactions unlock during the final three years before retirement. You can review the structure now without moving any data or units.</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3 bg-[var(--bg-inset)] border border-[var(--border-light)] rounded-lg px-4 py-3">
        <div>
          <p className="text-xs font-bold text-[var(--text-dim)] uppercase">Expense used for bucket targets</p>
          <div className="flex items-baseline gap-2 mt-1 flex-wrap">
            <span className="text-xl font-bold text-[var(--text-primary)]">{formatINR(plan.expense.monthlyExpense)}/mo</span>
            <span className="text-xs text-[var(--text-dim)]">at retirement · from {formatINR(plan.expense.todayExpense)} today · {(plan.expense.inflation * 100).toFixed(1)}% inflation</span>
          </div>
          <p className="text-xs text-violet-400 mt-1">
            Target-implied starting SWR: {(plan.plannedSWR * 100).toFixed(1)}% yearly · {formatINR(plan.expense.monthlyExpense * 12)} in the first retirement year
          </p>
        </div>
        <label className="text-xs text-[var(--text-dim)]">
          Plan date
          <input type="date" value={rebalanceDate} max={today} onChange={event => setRebalanceDate(event.target.value)}
            className="block mt-1 text-xs font-semibold bg-[var(--bg-card)] border border-[var(--border)] rounded-lg px-3 py-2 text-[var(--text-primary)]" />
        </label>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] gap-3">
        <section className="bg-[var(--bg-inset)] border border-[var(--border-light)] rounded-lg px-4 py-3">
          <p className="text-xs font-bold text-[var(--text-dim)] uppercase">Portfolio share linked to this goal</p>
          <div className="mt-2 space-y-2">
            {linkedPortfolios.map(portfolio => (
              <div key={portfolio.portfolioId} className="flex items-center justify-between gap-3 rounded bg-[var(--bg-card)] px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{portfolio.portfolioName}</p>
                  <p className="text-xs text-[var(--text-dim)]">{formatINR(portfolio.goalValue)} of {formatINR(portfolio.portfolioValue)} belongs to this goal</p>
                </div>
                <span className="text-sm font-bold text-violet-400 shrink-0">{portfolio.allocationPct}% linked</span>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-[var(--bg-inset)] border border-[var(--border-light)] rounded-lg px-4 py-3">
          <p className="text-xs font-bold text-[var(--text-dim)] uppercase">How SWR becomes monthly income</p>
          <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-2 mt-3 text-center">
            <FlowValue label="Retirement target" value={formatINR(goal.targetAmount)} />
            <span className="text-[var(--text-dim)]">×</span>
            <FlowValue label="Starting SWR" value={`${(plan.plannedSWR * 100).toFixed(1)}%`} />
            <span className="text-[var(--text-dim)]">=</span>
            <FlowValue label="First-year income" value={formatINR(plan.expense.monthlyExpense * 12)} accent />
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-3 text-center">That first-year income is paid as {formatINR(plan.expense.monthlyExpense)} per month from B1. SWR is calculated on the total retirement corpus, not only on B1.</p>
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {Object.keys(BUCKETS).map(bucket => (
          <BucketCard key={bucket} bucket={bucket} plan={plan}
            months={bucket === 'b1' ? b1TargetMonths : bucket === 'b2' ? b2TargetMonths : null}
            b1Months={b1TargetMonths}
            setMonths={bucket === 'b1' ? setB1TargetMonths : bucket === 'b2' ? setB2TargetMonths : null} />
        ))}
      </div>

      {hasUnclassified && (
        <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-4 py-3 space-y-2">
          <div className="flex gap-2 items-start">
            <AlertTriangle size={16} className="text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-rose-400">Classify these funds before confirming</p>
              <p className="text-xs text-[var(--text-muted)]">Their asset mix is unclear, so their value is not silently treated as cash, hybrid, or equity.</p>
            </div>
          </div>
          {plan.byBucket.unclassified.map(fund => <FundLine key={fund.key} fund={fund} />)}
        </div>
      )}

      <div className="space-y-3">
        <div>
          <p className="text-sm font-bold text-[var(--text-primary)]">Recommended refill plan</p>
          <p className="text-xs text-[var(--text-dim)]">B2 is used only when it has more than its five-year target. Otherwise B3 fills B1 directly, then fills any B2 shortage.</p>
        </div>

        {plan.operations.length === 0 ? (
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
            <p className="text-sm font-semibold text-emerald-400">B1 and B2 are fully funded</p>
            <p className="text-xs text-[var(--text-muted)]">No bucket movement is currently required.</p>
          </div>
        ) : plan.operations.map(operation => (
          <OperationCard key={operation.id} operation={operation} plan={plan}
            destinations={destinations} setDestinations={setDestinations}
            sellUnits={sellUnits} setSellUnits={setSellUnits}
            sellNavs={sellNavs} setSellNavs={setSellNavs}
            buyNavs={buyNavs} setBuyNavs={setBuyNavs} />
        ))}

        {plan.targetShortfall > 1 && (
          <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
            The linked retirement allocation is short by {formatINR(plan.targetShortfall)} for the selected B1 and B2 targets. No transaction can be confirmed until the shortage is resolved or the assumptions are adjusted.
          </p>
        )}
      </div>

      <div className="bg-[var(--bg-inset)] border border-[var(--border-light)] rounded-lg overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--border-light)]">
          <div>
            <p className="text-sm font-bold text-[var(--text-primary)]">Monthly withdrawal from B1</p>
            <p className="text-xs text-[var(--text-dim)]">One monthly amount distributed across the B1 funds linked to this goal.</p>
          </div>
          <button onClick={() => setWithdrawEnabled(value => !value)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${withdrawEnabled ? 'text-emerald-400 bg-emerald-500/10' : 'text-[var(--text-muted)] bg-[var(--bg-card)]'}`}>
            {withdrawEnabled ? 'Included' : 'Add withdrawal'}
          </button>
        </div>
        {withdrawEnabled && (
          <div className="p-4 space-y-3">
            <label className="block max-w-xs text-xs text-[var(--text-dim)]">Withdrawal amount
              <input type="number" min="0" max={plan.totals.b1} step="1000" value={withdrawAmount} onChange={event => setWithdrawAmount(event.target.value)}
                className="mt-1 w-full text-sm font-bold bg-[var(--bg-card)] border border-[var(--border)] rounded-lg px-3 py-2 text-[var(--text-primary)]" />
            </label>
            {withdrawal.allocations.map(allocation => {
              const key = `withdraw::${allocation.key}`
              return <EditableSellLine key={key} allocation={allocation} inputKey={key}
                unitsMap={withdrawUnits} setUnitsMap={setWithdrawUnits} navMap={withdrawNavs} setNavMap={setWithdrawNavs} />
            })}
            {withdrawal.shortfall > 1 && <p className="text-xs text-rose-400">B1 is short by {formatINR(withdrawal.shortfall)} for this withdrawal.</p>}
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border-light)]">
        <button onClick={onClose} className="px-5 py-2 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-hover)]">Close</button>
        <button onClick={() => onConfirmPlan(transactions.switches, transactions.redemptions)} disabled={!canConfirm}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed">
          <Wallet size={13} /> Confirm Plan
        </button>
      </div>
    </div>
  )
}

function FlowValue({ label, value, accent = false }) {
  return <div className="min-w-0"><p className="text-xs text-[var(--text-dim)]">{label}</p><p className={`text-base sm:text-lg font-bold ${accent ? 'text-emerald-400' : 'text-[var(--text-primary)]'}`}>{value}</p></div>
}

function BucketCard({ bucket, plan, months, b1Months, setMonths }) {
  const meta = BUCKETS[bucket]
  const tone = TONE[meta.tone]
  const Icon = meta.icon
  const value = plan.totals[bucket]
  const target = plan.targets[bucket]
  const funded = !target || value >= target
  const description = bucket === 'b1'
    ? `${months} months in liquid and short-duration debt`
    : bucket === 'b2'
      ? `Next ${months} months in hybrid and stable assets`
      : meta.description
  const period = bucket === 'b1'
    ? `Years 0–${months / 12}`
    : bucket === 'b2'
      ? `Years ${b1Months / 12}–${(b1Months + months) / 12}`
      : meta.period

  return (
    <section className={`rounded-lg border ${tone.border} bg-[var(--bg-inset)] overflow-hidden`}>
      <div className={`${tone.bg} px-4 py-3 border-b ${tone.border}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Icon size={16} className={tone.text} />
            <div><p className={`text-sm font-bold ${tone.text}`}>{meta.label}</p><p className="text-xs text-[var(--text-muted)]">{period}</p></div>
          </div>
          {months && (
            <select value={months} onChange={event => setMonths(Number(event.target.value))}
              className="text-xs bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border)] rounded px-2 py-1">
              {(bucket === 'b1' ? [12, 18, 24, 36] : [36, 48, 60, 84]).map(value => <option key={value} value={value}>{value} mo</option>)}
            </select>
          )}
        </div>
        <p className="text-xs text-[var(--text-dim)] mt-2">{description}</p>
      </div>
      <div className="p-3 space-y-3">
        <div className="flex items-end justify-between gap-2">
          <div><p className="text-xs text-[var(--text-dim)]">Current</p><p className="text-lg font-bold text-[var(--text-primary)]">{formatINR(value)}</p></div>
          {target ? <div className="text-right"><p className="text-xs text-[var(--text-dim)]">Target</p><p className={`text-sm font-bold ${funded ? 'text-emerald-400' : 'text-rose-400'}`}>{formatINR(target)}</p></div>
            : <p className="text-xs font-semibold text-violet-400">Remaining growth corpus</p>}
        </div>
        <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
          {plan.byBucket[bucket].length ? plan.byBucket[bucket].map(fund => <FundLine key={fund.key} fund={fund} />)
            : <p className="text-xs text-[var(--text-dim)] py-2">No linked fund currently falls in this bucket.</p>}
        </div>
      </div>
    </section>
  )
}

function FundLine({ fund }) {
  return (
    <div className="rounded bg-[var(--bg-card)] px-2.5 py-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-[var(--text-secondary)] line-clamp-2">{splitFundName(fund.fundName).main}</p>
        <p className="text-xs font-bold text-[var(--text-primary)] shrink-0">{formatINR(fund.goalValue)}</p>
      </div>
      <p className="text-xs text-[var(--text-dim)] mt-0.5">{fund.portfolioName} · {fund.allocationPct}% linked · {fund.bucketReason}</p>
    </div>
  )
}

function OperationCard({ operation, plan, destinations, setDestinations, sellUnits, setSellUnits, sellNavs, setSellNavs, buyNavs, setBuyNavs }) {
  const from = BUCKETS[operation.from]
  const to = BUCKETS[operation.to]
  const groups = groupAllocations(operation)

  return (
    <div className="bg-[var(--bg-inset)] border border-[var(--border-light)] rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-[var(--bg-card)] border-b border-[var(--border-light)] flex items-center justify-between gap-3">
        <div className="flex items-center gap-2"><span className="text-xs font-bold">{from.label}</span><ArrowRightLeft size={13} className="text-[var(--text-dim)]" /><span className="text-xs font-bold">{to.label}</span></div>
        <p className="text-sm font-bold text-[var(--text-primary)]">{formatINR(operation.fundedAmount)}</p>
      </div>
      <div className="p-4 space-y-4">
        {Object.entries(groups).map(([portfolioId, allocations]) => {
          const destKey = `${operation.id}::${portfolioId}`
          const destination = destinations[destKey]
          const candidates = plan.byBucket[operation.to].filter(fund => fund.portfolioId === portfolioId)
          return (
            <div key={portfolioId} className="space-y-3">
              <p className="text-xs font-bold text-[var(--text-muted)]">{allocations[0].portfolioName}</p>
              {allocations.map(allocation => {
                const key = `${operation.id}::${allocation.key}`
                return <EditableSellLine key={key} allocation={allocation} inputKey={key}
                  unitsMap={sellUnits} setUnitsMap={setSellUnits} navMap={sellNavs} setNavMap={setSellNavs} />
              })}
              <div className="pl-4 border-l-2 border-[var(--border)] space-y-2">
                <p className="text-xs text-[var(--text-dim)]">Move into {to.label} in the same portfolio</p>
                {candidates.length ? (
                  <select value={destination ? destination.key : ''}
                    onChange={event => setDestinations(previous => ({ ...previous, [destKey]: candidates.find(item => item.key === event.target.value) }))}
                    className="w-full text-xs bg-[var(--bg-card)] border border-[var(--border)] rounded-lg px-3 py-2 text-[var(--text-primary)]">
                    {candidates.map(candidate => <option key={candidate.key} value={candidate.key}>{splitFundName(candidate.fundName).main}</option>)}
                  </select>
                ) : (
                  <FundSearchInput value={destination ? { schemeCode: destination.schemeCode, fundName: destination.fundName } : null}
                    onSelect={({ schemeCode, fundName, nav }) => setDestinations(previous => ({ ...previous, [destKey]: { schemeCode: String(schemeCode), fundName, currentNav: nav || 0, portfolioId } }))}
                    placeholder={`Search a ${operation.to === 'b1' ? 'liquid/debt' : 'hybrid'} fund...`} />
                )}
                {destination && (
                  <label className="block text-xs text-[var(--text-dim)]">Buy NAV ₹
                    <input type="number" min="0.01" step="0.01" value={buyNavs[destKey] ?? ''} placeholder={Number(destination.currentNav || 0).toFixed(4)}
                      onChange={event => setBuyNavs(previous => ({ ...previous, [destKey]: event.target.value }))}
                      className="mt-1 w-28 text-xs bg-[var(--bg-card)] border border-[var(--border)] rounded px-2 py-1.5 text-[var(--text-primary)]" />
                  </label>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function EditableSellLine({ allocation, inputKey, unitsMap, setUnitsMap, navMap, setNavMap }) {
  const units = inputNumber(unitsMap, inputKey, allocation.units, allocation.units)
  const nav = inputNumber(navMap, inputKey, allocation.currentNav)
  return (
    <div className="rounded-lg border border-[var(--border-light)] px-3 py-2 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div><p className="text-xs text-[var(--text-secondary)]">{splitFundName(allocation.fundName).main}</p><p className="text-xs text-[var(--text-dim)]">{allocation.portfolioName}</p></div>
        <p className="text-xs font-bold text-[var(--text-primary)]">{formatINR(units * nav)}</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-[var(--text-dim)]">Units
          <input type="number" min="0" max={allocation.units} step="0.0001" value={unitsMap[inputKey] ?? ''} placeholder={allocation.units.toFixed(4)}
            onChange={event => setUnitsMap(previous => ({ ...previous, [inputKey]: event.target.value }))}
            className="mt-1 w-full text-xs bg-[var(--bg-card)] border border-[var(--border)] rounded px-2 py-1.5 text-[var(--text-primary)]" />
        </label>
        <label className="text-xs text-[var(--text-dim)]">Sell NAV ₹
          <input type="number" min="0.01" step="0.01" value={navMap[inputKey] ?? ''} placeholder={allocation.currentNav.toFixed(4)}
            onChange={event => setNavMap(previous => ({ ...previous, [inputKey]: event.target.value }))}
            className="mt-1 w-full text-xs bg-[var(--bg-card)] border border-[var(--border)] rounded px-2 py-1.5 text-[var(--text-primary)]" />
        </label>
      </div>
      <p className="text-xs text-[var(--text-dim)]">Maximum for this move: {allocation.units.toFixed(4)} goal-owned units</p>
    </div>
  )
}

function EmptyState({ title, detail, onClose }) {
  return (
    <div className="py-8 text-center space-y-2">
      <AlertTriangle size={24} className="mx-auto text-amber-400" />
      <p className="text-sm text-[var(--text-primary)] font-semibold">{title}</p>
      <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto">{detail}</p>
      <button onClick={onClose} className="mt-2 px-4 py-2 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-hover)]">Close</button>
    </div>
  )
}
