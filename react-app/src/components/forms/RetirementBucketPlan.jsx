import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  Info,
  ShieldCheck,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { formatINR, splitFundName } from '../../data/familyData'
import FundSearchInput from './FundSearchInput'
import { allocateBucketWithdrawal, buildRetirementBucketPlan } from '../../utils/retirementBuckets'

const BUCKETS = {
  b1: {
    shortLabel: 'B1',
    label: 'Income reserve',
    period: 'First 2 years',
    description: 'Monthly withdrawals from liquid and short-duration debt funds.',
    eligible: 'Liquid, overnight, money-market and short-duration debt',
    tone: 'emerald',
    icon: Wallet,
  },
  b2: {
    shortLabel: 'B2',
    label: 'Stability reserve',
    period: 'Next 5 years',
    description: 'The bridge between near-term income and long-term growth.',
    eligible: 'Hybrid, asset-allocation and suitable medium-term debt funds',
    tone: 'amber',
    icon: ShieldCheck,
  },
  b3: {
    shortLabel: 'B3',
    label: 'Growth bucket',
    period: 'Year 8 onward',
    description: 'The remaining retirement corpus stays invested for long-term growth.',
    eligible: 'Equity-heavy funds, normally 70% equity or more',
    tone: 'violet',
    icon: TrendingUp,
  },
}

const TONE = {
  emerald: {
    text: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/25',
    active: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  },
  amber: {
    text: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/25',
    active: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  },
  violet: {
    text: 'text-violet-400',
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/25',
    active: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
  },
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

function yearsUntil(value) {
  const target = value ? new Date(value) : null
  if (!target || Number.isNaN(target.getTime())) return null
  return Math.max(0, (target.getTime() - Date.now()) / (365.25 * 24 * 60 * 60 * 1000))
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
  const [activeTab, setActiveTab] = useState('b1')
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

  const retirementYears = yearsUntil(goal.targetDate)
  const withdrawal = allocateBucketWithdrawal(plan.byBucket.b1, withdrawAmount)
  const hasUnclassified = plan.totals.unclassified > 1

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
          notes: `Retirement ${operation.label} - ${goal.goalName}`,
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
        notes: `Retirement B1 monthly withdrawal - ${goal.goalName}`,
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
  const transactions = buildTransactions()
  const canConfirm = executionEnabled && !hasUnclassified && plan.targetShortfall <= 1 && !missingDestination
    && (transactions.switches.length > 0 || transactions.redemptions.length > 0)

  return (
    <div className="space-y-3">
      {!executionEnabled && (
        <div className="flex items-center gap-2 border border-blue-500/25 bg-blue-500/10 px-3 py-2 rounded-lg">
          <Info size={15} className="text-blue-400 shrink-0" />
          <div className="flex flex-wrap items-baseline gap-x-2">
            <p className="text-xs font-semibold text-blue-400">Retirement-day preview</p>
            <p className="text-xs text-[var(--text-muted)]">This is the target structure, not a recommendation to move funds today.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 xl:grid-cols-4 border border-[var(--border-light)] rounded-lg overflow-hidden">
        <Metric label="Retirement target" value={formatINR(plan.targets.total)} />
        <Metric label="Monthly need at retirement" value={`${formatINR(plan.expense.monthlyExpense)}/mo`} />
        <Metric label="Goal-linked value today" value={formatINR(plan.totalGoalValue)} />
        <Metric label="Time to retirement" value={retirementYears === null ? '-' : `${retirementYears.toFixed(1)} years`} />
      </div>

      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-[var(--text-primary)]">Target structure at retirement</h3>
            <p className="text-xs text-[var(--text-muted)]">Set each bucket amount first, then review the funds assigned to it.</p>
          </div>
          <p className="text-xs text-[var(--text-dim)]">Starting SWR: {(plan.plannedSWR * 100).toFixed(1)}% · First-year income: {formatINR(plan.expense.monthlyExpense * 12)}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {Object.keys(BUCKETS).map(bucket => (
            <TargetCard key={bucket} bucket={bucket} plan={plan}
              months={bucket === 'b1' ? b1TargetMonths : bucket === 'b2' ? b2TargetMonths : null}
              setMonths={bucket === 'b1' ? setB1TargetMonths : bucket === 'b2' ? setB2TargetMonths : null}
              onOpen={() => setActiveTab(bucket)} />
          ))}
        </div>
      </section>

      {hasUnclassified && (
        <div className="border border-rose-500/25 bg-rose-500/10 rounded-lg px-4 py-3">
          <div className="flex items-start gap-2">
            <AlertTriangle size={17} className="text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-rose-400">{plan.byBucket.unclassified.length} fund(s) need classification review</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">They are excluded from automatic bucket actions until their role is clear.</p>
            </div>
          </div>
        </div>
      )}

      <div className="border border-[var(--border-light)] rounded-lg overflow-hidden">
        <div className="flex overflow-x-auto bg-[var(--bg-inset)] border-b border-[var(--border-light)] p-1">
          {Object.keys(BUCKETS).map(bucket => {
            const meta = BUCKETS[bucket]
            const tone = TONE[meta.tone]
            return (
              <button key={bucket} onClick={() => setActiveTab(bucket)}
                className={`min-w-36 flex-1 px-4 py-2.5 rounded-md border text-sm font-semibold transition-colors ${activeTab === bucket ? tone.active : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}>
                {meta.shortLabel} · {meta.label}
                <span className="ml-2 text-xs opacity-75">{plan.byBucket[bucket].length}</span>
              </button>
            )
          })}
          <button onClick={() => setActiveTab('actions')}
            className={`min-w-36 flex-1 px-4 py-2.5 rounded-md border text-sm font-semibold transition-colors ${activeTab === 'actions' ? 'bg-blue-500/15 text-blue-400 border-blue-500/30' : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}>
            Actions {!executionEnabled ? <span className="ml-1 text-xs opacity-75">· Preview</span> : plan.operations.length > 0 && <span className="ml-2 text-xs">{plan.operations.length}</span>}
          </button>
        </div>

        <div className="p-3 sm:p-4">
          {activeTab === 'actions' ? (
            <ActionsPanel
              executionEnabled={executionEnabled}
              plan={plan}
              rebalanceDate={rebalanceDate}
              setRebalanceDate={setRebalanceDate}
              today={today}
              destinations={destinations}
              setDestinations={setDestinations}
              sellUnits={sellUnits}
              setSellUnits={setSellUnits}
              sellNavs={sellNavs}
              setSellNavs={setSellNavs}
              buyNavs={buyNavs}
              setBuyNavs={setBuyNavs}
              withdrawEnabled={withdrawEnabled}
              setWithdrawEnabled={setWithdrawEnabled}
              withdrawAmount={withdrawAmount}
              setWithdrawAmount={setWithdrawAmount}
              withdrawal={withdrawal}
              withdrawUnits={withdrawUnits}
              setWithdrawUnits={setWithdrawUnits}
              withdrawNavs={withdrawNavs}
              setWithdrawNavs={setWithdrawNavs}
              targetDate={goal.targetDate}
            />
          ) : (
            <BucketPanel bucket={activeTab} plan={plan} executionEnabled={executionEnabled} />
          )}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border-light)]">
        <button onClick={onClose} className="px-5 py-2 text-sm font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-hover)]">Close</button>
        {executionEnabled && (
          <button onClick={() => onConfirmPlan(transactions.switches, transactions.redemptions)} disabled={!canConfirm}
            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed">
            <CheckCircle2 size={16} /> Confirm reviewed actions
          </button>
        )}
      </div>
    </div>
  )
}

function Metric({ label, value }) {
  return (
    <div className="px-3 py-2 border-r border-b xl:border-b-0 last:border-r-0 border-[var(--border-light)] bg-[var(--bg-inset)]">
      <p className="text-xs text-[var(--text-dim)]">{label}</p>
      <p className="text-base font-bold text-[var(--text-primary)] mt-0.5 tabular-nums">{value}</p>
    </div>
  )
}

function TargetCard({ bucket, plan, months, setMonths, onOpen }) {
  const meta = BUCKETS[bucket]
  const tone = TONE[meta.tone]
  const Icon = meta.icon
  const target = plan.targets[bucket]
  const targetPct = plan.targets.total > 0 ? (target / plan.targets.total) * 100 : 0
  const formula = bucket === 'b3'
    ? 'Corpus minus B1 and B2'
    : `${months} months × ${formatINR(plan.expense.monthlyExpense)}`

  return (
    <div className={`text-left border ${tone.border} ${tone.bg} rounded-lg px-3 py-2.5`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className={`w-8 h-8 rounded-md grid place-items-center bg-[var(--bg-card)] ${tone.text}`}><Icon size={17} /></div>
          <div>
            <p className={`text-xs font-bold ${tone.text}`}>{meta.shortLabel} · {meta.label}</p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">{meta.period}</p>
          </div>
        </div>
        {months && (
          <select value={months} onChange={event => setMonths(Number(event.target.value))}
            className="text-xs bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border)] rounded px-2 py-1">
            {(bucket === 'b1' ? [12, 18, 24, 36] : [36, 48, 60, 84]).map(value => <option key={value} value={value}>{value} mo</option>)}
          </select>
        )}
      </div>
      <div className="flex items-end justify-between mt-2 gap-3">
        <div>
          <p className="text-xl font-bold text-[var(--text-primary)] tabular-nums">{formatINR(target)}</p>
          <p className="text-xs text-[var(--text-dim)]">{formula}</p>
          <p className="text-xs font-semibold text-[var(--text-muted)]">{targetPct.toFixed(0)}% of retirement target</p>
        </div>
        <button type="button" onClick={onOpen} className={`text-xs font-semibold ${tone.text} hover:underline`}>
          View funds
        </button>
      </div>
    </div>
  )
}

function BucketPanel({ bucket, plan, executionEnabled }) {
  const meta = BUCKETS[bucket]
  const tone = TONE[meta.tone]
  const Icon = meta.icon
  const funds = plan.byBucket[bucket]

  return (
    <div className="space-y-3">
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div className="flex items-start gap-3 max-w-3xl">
          <div className={`w-9 h-9 rounded-lg grid place-items-center ${tone.bg} ${tone.text}`}><Icon size={19} /></div>
          <div>
            <h3 className="text-sm font-bold text-[var(--text-primary)]">{meta.shortLabel} · {meta.label}</h3>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">{meta.description}</p>
            <p className="text-xs text-[var(--text-dim)] mt-1">Typical role: {meta.eligible}.</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-5 min-w-64">
          <div>
            <p className="text-xs text-[var(--text-dim)]">Target at retirement</p>
            <p className={`text-base font-bold mt-0.5 ${tone.text}`}>{formatINR(plan.targets[bucket])}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--text-dim)]">Mapped today</p>
            <p className="text-base font-bold text-[var(--text-primary)] mt-0.5">{formatINR(plan.totals[bucket])}</p>
          </div>
        </div>
      </div>

      {!executionEnabled && (
        <div className="bg-[var(--bg-inset)] border-l-2 border-blue-500 px-3 py-2 text-xs text-[var(--text-muted)]">
          “Mapped today” is the current value of matching funds. “Target” is the amount needed at retirement, so they are not same-date values.
        </div>
      )}

      <div className="border border-[var(--border-light)] rounded-lg overflow-hidden">
        <div className="hidden md:grid grid-cols-[minmax(240px,1.5fr)_minmax(150px,.8fr)_minmax(160px,.8fr)_105px_120px] gap-3 px-4 py-2 bg-[var(--bg-inset)] text-xs font-semibold text-[var(--text-dim)]">
          <span>Fund</span><span>Portfolio</span><span>Why this bucket</span><span className="text-right">Portfolio link</span><span className="text-right">Goal value</span>
        </div>
        {funds.length ? funds.map(fund => <FundRow key={fund.key} fund={fund} />) : (
          <div className="px-5 py-6 text-center">
            <p className="text-sm font-semibold text-[var(--text-primary)]">No linked fund currently matches {meta.shortLabel}</p>
            <p className="text-sm text-[var(--text-muted)] mt-1">When this bucket is built, use {meta.eligible.toLowerCase()}.</p>
          </div>
        )}
      </div>

      <div className="flex items-start gap-2 text-xs text-[var(--text-muted)]">
        <Info size={15} className="shrink-0 mt-0.5" />
        <p>
          A 55% portfolio link counts 55% of every fund for this goal. Bucket targets are totals that one or more funds may fill, and each fund is assigned to one bucket.
        </p>
      </div>
    </div>
  )
}

function FundRow({ fund }) {
  const equity = fund.equityPercent === null ? null : `${Math.round(fund.equityPercent)}% equity`
  const showReason = !equity || (fund.bucketReason !== equity && fund.bucketReason !== fund.category)
  return (
    <div className="grid grid-cols-1 md:grid-cols-[minmax(240px,1.5fr)_minmax(150px,.8fr)_minmax(160px,.8fr)_105px_120px] gap-2 md:gap-3 px-4 py-2.5 border-t border-[var(--border-light)] text-sm items-center">
      <div className="min-w-0">
        <p className="font-semibold text-[var(--text-primary)] break-words">{splitFundName(fund.fundName).main}</p>
        <p className="text-xs text-[var(--text-dim)] mt-0.5">{fund.category || 'Category unavailable'}</p>
      </div>
      <p className="text-[var(--text-secondary)]">{fund.portfolioName}</p>
      <div>
        <p className="text-[var(--text-secondary)]">{equity || fund.bucketReason}</p>
        {showReason && equity && <p className="text-xs text-[var(--text-dim)] mt-0.5">{fund.bucketReason}</p>}
      </div>
      <div className="md:text-right">
        <p className="font-semibold text-violet-400">{fund.allocationPct}%</p>
        <p className="text-xs text-[var(--text-dim)]">applied to this fund</p>
      </div>
      <p className="font-bold text-[var(--text-primary)] md:text-right tabular-nums">{formatINR(fund.goalValue)}</p>
    </div>
  )
}

function ActionsPanel({
  executionEnabled,
  plan,
  rebalanceDate,
  setRebalanceDate,
  today,
  destinations,
  setDestinations,
  sellUnits,
  setSellUnits,
  sellNavs,
  setSellNavs,
  buyNavs,
  setBuyNavs,
  withdrawEnabled,
  setWithdrawEnabled,
  withdrawAmount,
  setWithdrawAmount,
  withdrawal,
  withdrawUnits,
  setWithdrawUnits,
  withdrawNavs,
  setWithdrawNavs,
  targetDate,
}) {
  const targetYear = targetDate ? new Date(targetDate).getFullYear() : null
  const actionYear = Number.isFinite(targetYear) ? targetYear - 3 : null

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-bold text-[var(--text-primary)]">Bucket refill rules</h3>
        <p className="text-sm text-[var(--text-muted)] mt-1">The app recommends a review only when a source bucket has more than its own target.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Rule number="1" title="Protect B2" detail="Only B2 surplus can refill B1. Lower-equity B2 funds are reviewed first." />
        <Rule number="2" title="Protect B3" detail="Only B3 surplus can refill B1 or B2. Higher-equity B3 funds are reviewed first." />
        <Rule number="3" title="No forced sale" detail="If the corpus is short, the app shows the gap instead of draining growth." />
      </div>

      {!executionEnabled ? (
        <PreviewActions plan={plan} actionYear={actionYear} />
      ) : (
        <>
          <div className="flex items-center justify-between gap-4 bg-[var(--bg-inset)] border border-[var(--border-light)] rounded-lg px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">Review date</p>
              <p className="text-xs text-[var(--text-dim)] mt-0.5">Amounts use the recorded units and NAV available on this date.</p>
            </div>
            <input type="date" value={rebalanceDate} max={today} onChange={event => setRebalanceDate(event.target.value)}
              className="text-sm font-semibold bg-[var(--bg-card)] border border-[var(--border)] rounded-lg px-3 py-2 text-[var(--text-primary)]" />
          </div>

          {plan.targetShortfall > 1 && (
            <div className="border border-amber-500/25 bg-amber-500/10 rounded-lg px-4 py-3">
              <p className="text-sm font-semibold text-amber-400">No complete automatic refill plan</p>
              <p className="text-sm text-[var(--text-muted)] mt-1">The goal-linked corpus is short by {formatINR(plan.targetShortfall)} for this retirement structure. The app will not drain B3 below its growth target.</p>
            </div>
          )}

          {plan.operations.length === 0 && plan.targetShortfall <= 1 ? (
            <div className="border border-emerald-500/25 bg-emerald-500/10 rounded-lg px-4 py-3">
              <p className="text-sm font-semibold text-emerald-400">No bucket transfer is required</p>
              <p className="text-sm text-[var(--text-muted)] mt-1">B1, B2 and B3 are within their target structure.</p>
            </div>
          ) : plan.operations.map(operation => (
            <OperationCard key={operation.id} operation={operation} plan={plan}
              destinations={destinations} setDestinations={setDestinations}
              sellUnits={sellUnits} setSellUnits={setSellUnits}
              sellNavs={sellNavs} setSellNavs={setSellNavs}
              buyNavs={buyNavs} setBuyNavs={setBuyNavs} />
          ))}

          <div className="border border-[var(--border-light)] rounded-lg overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-4 py-3 bg-[var(--bg-inset)]">
              <div>
                <p className="text-sm font-bold text-[var(--text-primary)]">Monthly withdrawal from B1</p>
                <p className="text-xs text-[var(--text-dim)] mt-0.5">Optional: record one retirement-income withdrawal after B1 is funded.</p>
              </div>
              <button onClick={() => setWithdrawEnabled(value => !value)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${withdrawEnabled ? 'text-emerald-400 bg-emerald-500/10' : 'text-[var(--text-muted)] bg-[var(--bg-card)]'}`}>
                {withdrawEnabled ? 'Included' : 'Add withdrawal'}
              </button>
            </div>
            {withdrawEnabled && (
              <div className="p-4 space-y-3 border-t border-[var(--border-light)]">
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
        </>
      )}

      <div className="flex items-start gap-2 text-xs text-[var(--text-muted)]">
        <AlertTriangle size={15} className="shrink-0 mt-0.5 text-amber-400" />
        <p>Fund suggestions use bucket role and goal-owned value. Before confirming, review exit load, taxes, lock-in, credit quality and suitability. Capital Friends records the reviewed transaction; it does not place an order with the fund house.</p>
      </div>
    </div>
  )
}

function PreviewActions({ plan, actionYear }) {
  const steps = [
    {
      label: 'Build B1 income reserve',
      amount: plan.targets.b1,
      detail: `${formatINR(plan.expense.monthlyExpense)}/month is withdrawn from B1 after retirement.`,
      tone: 'text-emerald-400',
    },
    {
      label: 'Build B2 stability reserve',
      amount: plan.targets.b2,
      detail: 'B2 refills B1 only from money above its own target.',
      tone: 'text-amber-400',
    },
    {
      label: 'Keep B3 invested for growth',
      amount: plan.targets.b3,
      detail: 'B3 supports later retirement years and is not moved entirely to debt.',
      tone: 'text-violet-400',
    },
  ]

  return (
    <div className="space-y-3">
      <div className="border border-blue-500/25 bg-blue-500/10 rounded-lg px-4 py-3">
        <p className="text-sm font-semibold text-blue-400">Illustrative retirement setup</p>
        <p className="text-xs text-[var(--text-muted)] mt-1">These are target amounts for the retirement date. No transaction, unit or NAV is changed in this preview.</p>
      </div>

      <div className="border border-[var(--border-light)] rounded-lg overflow-hidden">
        {steps.map((step, index) => (
          <div key={step.label} className="grid grid-cols-[28px_minmax(0,1fr)_auto] gap-3 items-center px-4 py-3 border-t first:border-t-0 border-[var(--border-light)]">
            <span className="w-7 h-7 rounded-full bg-[var(--bg-inset)] grid place-items-center text-xs font-bold text-[var(--text-muted)]">{index + 1}</span>
            <div>
              <p className={`text-sm font-semibold ${step.tone}`}>{step.label}</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">{step.detail}</p>
            </div>
            <p className="text-base font-bold text-[var(--text-primary)] tabular-nums">{formatINR(step.amount)}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-center border border-emerald-500/25 bg-emerald-500/10 rounded-lg px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-emerald-400">Sample first monthly withdrawal</p>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">Paid from B1. Later, B1 is reviewed and refilled from bucket surplus.</p>
        </div>
        <p className="text-xl font-bold text-[var(--text-primary)] tabular-nums">{formatINR(plan.expense.monthlyExpense)}</p>
      </div>

      <p className="text-xs text-[var(--text-dim)]">
        Exact fund names, switch amounts and units unlock {actionYear ? `around ${actionYear}` : 'in the final three years'}, when the app can use the then-current corpus, holdings and NAV.
      </p>
    </div>
  )
}

function Rule({ number, title, detail }) {
  return (
    <div className="border border-[var(--border-light)] rounded-lg px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="w-6 h-6 rounded-full bg-blue-500/15 text-blue-400 grid place-items-center text-xs font-bold">{number}</span>
        <p className="text-sm font-semibold text-[var(--text-primary)]">{title}</p>
      </div>
      <p className="text-xs text-[var(--text-muted)] mt-2">{detail}</p>
    </div>
  )
}

function OperationCard({ operation, plan, destinations, setDestinations, sellUnits, setSellUnits, sellNavs, setSellNavs, buyNavs, setBuyNavs }) {
  const from = BUCKETS[operation.from]
  const to = BUCKETS[operation.to]
  const groups = groupAllocations(operation)

  return (
    <div className="border border-[var(--border-light)] rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-[var(--bg-inset)] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 text-sm font-bold text-[var(--text-primary)]">
            <span>{from.shortLabel}</span><ArrowRightLeft size={14} className="text-[var(--text-dim)]" /><span>{to.shortLabel}</span>
          </div>
          <p className="text-xs text-[var(--text-dim)] mt-1">Review {formatINR(operation.fundedAmount)} from source-bucket surplus.</p>
        </div>
        <p className="text-lg font-bold text-[var(--text-primary)]">{formatINR(operation.fundedAmount)}</p>
      </div>
      <div className="p-4 space-y-5">
        {Object.entries(groups).map(([portfolioId, allocations]) => {
          const destKey = `${operation.id}::${portfolioId}`
          const destination = destinations[destKey]
          const candidates = plan.byBucket[operation.to].filter(fund => fund.portfolioId === portfolioId)
          return (
            <div key={portfolioId} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-2">
                <p className="text-xs font-bold text-[var(--text-muted)] uppercase">Review source · {allocations[0].portfolioName}</p>
                {allocations.map(allocation => {
                  const key = `${operation.id}::${allocation.key}`
                  return <EditableSellLine key={key} allocation={allocation} inputKey={key}
                    unitsMap={sellUnits} setUnitsMap={setSellUnits} navMap={sellNavs} setNavMap={setSellNavs} />
                })}
              </div>
              <div className="space-y-3 lg:border-l lg:border-[var(--border-light)] lg:pl-4">
                <p className="text-xs font-bold text-[var(--text-muted)] uppercase">Choose destination in the same portfolio</p>
                {candidates.length ? (
                  <select value={destination ? destination.key : ''}
                    onChange={event => setDestinations(previous => ({ ...previous, [destKey]: candidates.find(item => item.key === event.target.value) }))}
                    className="w-full text-sm bg-[var(--bg-card)] border border-[var(--border)] rounded-lg px-3 py-2 text-[var(--text-primary)]">
                    {candidates.map(candidate => <option key={candidate.key} value={candidate.key}>{splitFundName(candidate.fundName).main}</option>)}
                  </select>
                ) : (
                  <FundSearchInput value={destination ? { schemeCode: destination.schemeCode, fundName: destination.fundName } : null}
                    onSelect={({ schemeCode, fundName, nav }) => setDestinations(previous => ({ ...previous, [destKey]: { schemeCode: String(schemeCode), fundName, currentNav: nav || 0, portfolioId } }))}
                    placeholder={`Search a ${operation.to === 'b1' ? 'liquid/short-debt' : 'hybrid/stability'} fund...`} />
                )}
                {destination && (
                  <label className="block text-xs text-[var(--text-dim)]">Buy NAV
                    <input type="number" min="0.01" step="0.01" value={buyNavs[destKey] ?? ''} placeholder={Number(destination.currentNav || 0).toFixed(4)}
                      onChange={event => setBuyNavs(previous => ({ ...previous, [destKey]: event.target.value }))}
                      className="mt-1 w-36 text-sm bg-[var(--bg-card)] border border-[var(--border)] rounded px-2 py-1.5 text-[var(--text-primary)]" />
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
    <div className="border border-[var(--border-light)] rounded-lg px-3 py-3 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[var(--text-secondary)]">{splitFundName(allocation.fundName).main}</p>
          <p className="text-xs text-[var(--text-dim)] mt-0.5">{allocation.bucketReason} · goal-owned units only</p>
        </div>
        <p className="text-sm font-bold text-[var(--text-primary)] shrink-0">{formatINR(units * nav)}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs text-[var(--text-dim)]">Units to review
          <input type="number" min="0" max={allocation.units} step="0.0001" value={unitsMap[inputKey] ?? ''} placeholder={allocation.units.toFixed(4)}
            onChange={event => setUnitsMap(previous => ({ ...previous, [inputKey]: event.target.value }))}
            className="mt-1 w-full text-sm bg-[var(--bg-card)] border border-[var(--border)] rounded px-2 py-1.5 text-[var(--text-primary)]" />
        </label>
        <label className="text-xs text-[var(--text-dim)]">NAV
          <input type="number" min="0.01" step="0.01" value={navMap[inputKey] ?? ''} placeholder={allocation.currentNav.toFixed(4)}
            onChange={event => setNavMap(previous => ({ ...previous, [inputKey]: event.target.value }))}
            className="mt-1 w-full text-sm bg-[var(--bg-card)] border border-[var(--border)] rounded px-2 py-1.5 text-[var(--text-primary)]" />
        </label>
      </div>
      <p className="text-xs text-[var(--text-dim)]">Maximum goal-owned units for this action: {allocation.units.toFixed(4)}</p>
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
