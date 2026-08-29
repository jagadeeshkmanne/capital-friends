import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  ShieldCheck,
  TrendingUp,
  Wallet,
  HelpCircle,
} from 'lucide-react'
import { formatINR, splitFundName } from '../../data/familyData'
import FundSearchInput from './FundSearchInput'
import { allocateBucketWithdrawal, buildRetirementBucketPlan } from '../../utils/retirementBuckets'

const BUCKETS = {
  b1: {
    shortLabel: 'B1',
    label: 'Income bucket',
    period: 'Years 1-2',
    description: 'Monthly withdrawals from liquid and short-duration debt funds.',
    eligible: 'Liquid, overnight, money-market and short-duration debt',
    tone: 'emerald',
    icon: Wallet,
  },
  b2: {
    shortLabel: 'B2',
    label: 'Stability bucket',
    period: 'Years 3-7',
    description: 'The bridge between near-term income and long-term growth.',
    eligible: 'Hybrid, asset-allocation and suitable medium-term debt funds',
    tone: 'amber',
    icon: ShieldCheck,
  },
  b3: {
    shortLabel: 'B3',
    label: 'Growth bucket',
    period: 'Year 8+',
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
  const [showHelp, setShowHelp] = useState(false)
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
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2 border border-[var(--border-light)] bg-[var(--bg-inset)] rounded-lg px-3 py-2">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs">
          <SummaryItem label="Target" value={formatINR(plan.targets.total)} />
          <SummaryItem label="Linked today" value={formatINR(plan.totalGoalValue)} />
          <SummaryItem label="Retires in" value={retirementYears === null ? '-' : `${retirementYears.toFixed(1)}y`} />
          <SummaryItem label="First withdrawal" value={`${formatINR(plan.expense.monthlyExpense)}/mo`} />
          <SummaryItem label="SWR" value={`${(plan.plannedSWR * 100).toFixed(1)}%`} />
        </div>
        <div className="flex items-center gap-2">
          {!executionEnabled && <span className="text-xs font-semibold text-blue-400">No changes will be saved</span>}
          <button type="button" onClick={() => setShowHelp(value => !value)}
            className={`p-1.5 rounded-md ${showHelp ? 'bg-blue-500/15 text-blue-400' : 'text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'}`}
            title="How retirement buckets work" aria-label="How retirement buckets work">
            <HelpCircle size={15} />
          </button>
        </div>
      </div>

      {showHelp && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-px overflow-hidden rounded-lg border border-blue-500/20 bg-blue-500/20">
          <HelpLine title="Income bucket (B1)" detail="Pays the first two years of monthly retirement income." />
          <HelpLine title="Stability bucket (B2)" detail="Supports years three to seven and can refill the income bucket." />
          <HelpLine title="Growth bucket (B3)" detail="Stays invested for year eight onward and refills shorter buckets from surplus." />
        </div>
      )}

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
        <div className="grid grid-cols-2 md:grid-cols-4 bg-[var(--bg-inset)] border-b border-[var(--border-light)]" role="tablist" aria-label="Retirement buckets">
          {Object.keys(BUCKETS).map(bucket => {
            return (
              <BucketTab key={bucket} bucket={bucket} plan={plan} active={activeTab === bucket} onClick={() => setActiveTab(bucket)} />
            )
          })}
          <button onClick={() => setActiveTab('actions')}
            role="tab" aria-selected={activeTab === 'actions'}
            className={`min-h-[58px] px-4 py-2.5 border-b-2 text-left transition-colors ${activeTab === 'actions' ? 'bg-blue-500/10 text-blue-400 border-blue-400' : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'}`}>
            <span className="flex items-center gap-1.5 text-xs font-bold"><ArrowRightLeft size={13} /> Actions</span>
            <span className="block text-[11px] mt-1 opacity-75">Refill and income plan</span>
          </button>
        </div>

        <div className="p-3 min-h-[250px] max-h-[48vh] overflow-y-auto">
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
            />
          ) : (
            <BucketPanel bucket={activeTab} plan={plan}
              months={activeTab === 'b1' ? b1TargetMonths : activeTab === 'b2' ? b2TargetMonths : null}
              setMonths={activeTab === 'b1' ? setB1TargetMonths : activeTab === 'b2' ? setB2TargetMonths : null} />
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 pt-2 border-t border-[var(--border-light)]">
        <div className="flex items-center gap-2 ml-auto">
          <button onClick={onClose} className="px-4 py-1.5 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-hover)]">Close</button>
          {executionEnabled && (
            <button onClick={() => onConfirmPlan(transactions.switches, transactions.redemptions)} disabled={!canConfirm}
              className="flex items-center gap-2 px-4 py-1.5 text-xs font-semibold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed">
              <CheckCircle2 size={14} /> Confirm reviewed actions
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function SummaryItem({ label, value }) {
  return (
    <p><span className="text-[var(--text-dim)]">{label}</span> <span className="font-bold text-[var(--text-primary)] tabular-nums">{value}</span></p>
  )
}

function HelpLine({ title, detail }) {
  return <div className="bg-[var(--bg-card)] px-3 py-2"><p className="text-xs font-semibold text-blue-400">{title}</p><p className="text-[11px] text-[var(--text-muted)] mt-0.5">{detail}</p></div>
}

function BucketTab({ bucket, plan, active, onClick }) {
  const meta = BUCKETS[bucket]
  const tone = TONE[meta.tone]
  const Icon = meta.icon

  return (
    <button type="button" onClick={onClick}
      role="tab" aria-selected={active}
      className={`min-h-[58px] px-4 py-2.5 border-b-2 text-left transition-colors ${active ? `${tone.bg} ${tone.text} ${bucket === 'b1' ? 'border-emerald-400' : bucket === 'b2' ? 'border-amber-400' : 'border-violet-400'}` : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'}`}>
      <span className={`flex items-center gap-1.5 text-xs font-bold ${active ? tone.text : ''}`}><Icon size={13} /> {meta.label} <span className="opacity-70">{meta.shortLabel}</span></span>
      <span className="block mt-1 text-[11px] text-[var(--text-dim)]">{meta.period}</span>
    </button>
  )
}

function BucketPanel({ bucket, plan, months, setMonths }) {
  const meta = BUCKETS[bucket]
  const tone = TONE[meta.tone]
  const Icon = meta.icon
  const funds = plan.byBucket[bucket]
  const target = plan.targets[bucket]
  const current = plan.totals[bucket]
  const gap = Math.max(0, target - current)
  const fundedPercent = target > 0 ? Math.min(100, (current / target) * 100) : 0

  return (
    <div className="space-y-2.5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-8 h-8 rounded-md grid place-items-center ${tone.bg} ${tone.text} shrink-0`}><Icon size={17} /></div>
          <div>
            <div className="flex flex-wrap items-baseline gap-x-2">
              <h3 className="text-sm font-bold text-[var(--text-primary)]">{meta.label} <span className="text-[var(--text-dim)]">({meta.shortLabel})</span></h3>
              <span className="text-xs text-[var(--text-dim)]">{meta.period}</span>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">{meta.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Metric label="Target" value={formatINR(target)} />
          <Metric label="Today" value={formatINR(current)} />
          <Metric label={gap > 1 ? 'Gap' : 'Status'} value={gap > 1 ? formatINR(gap) : 'Funded'} tone={gap > 1 ? 'text-amber-400' : 'text-emerald-400'} />
          {months && (
            <label className="text-[11px] text-[var(--text-dim)]">Coverage
              <select value={months} onChange={event => setMonths(Number(event.target.value))}
                className="ml-2 text-xs bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border)] rounded px-2 py-1">
                {(bucket === 'b1' ? [12, 18, 24, 36] : [36, 48, 60, 84]).map(value => <option key={value} value={value}>{value} mo</option>)}
              </select>
            </label>
          )}
        </div>
      </div>

      <div className="h-1.5 rounded-full bg-[var(--bg-inset)] overflow-hidden" title={`${fundedPercent.toFixed(0)}% of this bucket target is linked today`}>
        <div className={`h-full rounded-full ${bucket === 'b1' ? 'bg-emerald-500' : bucket === 'b2' ? 'bg-amber-400' : 'bg-violet-500'}`} style={{ width: `${fundedPercent}%` }} />
      </div>

      {funds.length ? (
        <div className="border border-[var(--border-light)] rounded-lg overflow-hidden max-h-[245px] overflow-y-auto">
          {funds.map(fund => <FundRow key={fund.key} fund={fund} />)}
        </div>
      ) : (
        <div className={`border ${tone.border} ${tone.bg} rounded-lg px-5 py-5 text-center`}>
          <p className="text-sm font-semibold text-[var(--text-primary)]">No {meta.shortLabel} fund is linked today</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">This bucket will use {meta.eligible.toLowerCase()}.</p>
        </div>
      )}
    </div>
  )
}

function Metric({ label, value, tone = 'text-[var(--text-primary)]' }) {
  return <div className="text-right"><p className="text-[10px] text-[var(--text-dim)] uppercase">{label}</p><p className={`text-sm font-bold tabular-nums ${tone}`}>{value}</p></div>
}

function FundRow({ fund }) {
  const equity = fund.equityPercent === null ? null : `${Math.round(fund.equityPercent)}% equity`
  const showReason = !equity || (fund.bucketReason !== equity && fund.bucketReason !== fund.category)
  return (
    <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.65fr)_minmax(0,.85fr)_auto] gap-2 md:gap-4 px-3 py-2.5 border-t first:border-t-0 border-[var(--border-light)] text-sm items-center">
      <div className="min-w-0 flex items-start gap-2.5">
        <span className="w-7 h-7 rounded-md bg-[var(--bg-inset)] grid place-items-center text-[var(--text-dim)] shrink-0"><TrendingUp size={14} /></span>
        <div className="min-w-0">
        <p className="font-semibold text-[var(--text-primary)] break-words">{splitFundName(fund.fundName).main}</p>
          <p className="text-[11px] text-[var(--text-dim)] mt-0.5">{fund.category || 'Category unavailable'} · {fund.portfolioName}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 text-[11px]">
        <span className="px-2 py-1 rounded bg-[var(--bg-inset)] text-[var(--text-secondary)]">{equity || fund.bucketReason}</span>
        {showReason && equity && <span className="px-2 py-1 rounded bg-[var(--bg-inset)] text-[var(--text-dim)]">{fund.bucketReason}</span>}
      </div>
      <div className="md:text-right flex md:block items-baseline justify-between gap-3">
        <p className="font-bold text-[var(--text-primary)] tabular-nums">{formatINR(fund.goalValue)}</p>
        <p className="text-[11px] text-[var(--text-dim)]">{fund.allocationPct}% linked to goal</p>
      </div>
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
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-[var(--bg-inset)] border border-[var(--border-light)] rounded-lg px-3 py-2 text-xs">
        <b className="text-[var(--text-primary)]">Refill order</b>
        <span className="text-emerald-400">Stability surplus → Income</span>
        <ArrowRightLeft size={13} className="text-[var(--text-dim)]" />
        <span className="text-violet-400">Growth surplus → Stability or Income</span>
        <span className="text-[var(--text-dim)] ml-auto">No bucket is drained below its target</span>
      </div>

      {!executionEnabled ? (
        <PreviewActions plan={plan} />
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
              <p className="text-sm text-[var(--text-muted)] mt-1">The goal-linked corpus is short by {formatINR(plan.targetShortfall)} for this retirement structure. The app will not drain the growth bucket below its target.</p>
            </div>
          )}

          {plan.operations.length === 0 && plan.targetShortfall <= 1 ? (
            <div className="border border-emerald-500/25 bg-emerald-500/10 rounded-lg px-4 py-3">
              <p className="text-sm font-semibold text-emerald-400">No bucket transfer is required</p>
              <p className="text-sm text-[var(--text-muted)] mt-1">The income, stability and growth buckets are within their target structure.</p>
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
                <p className="text-sm font-bold text-[var(--text-primary)]">Monthly withdrawal from the income bucket</p>
                <p className="text-xs text-[var(--text-dim)] mt-0.5">Optional: record one retirement-income withdrawal after this bucket is funded.</p>
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
                {withdrawal.shortfall > 1 && <p className="text-xs text-rose-400">The income bucket is short by {formatINR(withdrawal.shortfall)} for this withdrawal.</p>}
              </div>
            )}
          </div>
        </>
      )}

      {executionEnabled && (
        <div className="flex items-start gap-2 text-xs text-[var(--text-muted)]">
          <AlertTriangle size={15} className="shrink-0 mt-0.5 text-amber-400" />
          <p>Review the latest NAV, tax and exit load before confirming a recorded transaction.</p>
        </div>
      )}
    </div>
  )
}

function PreviewActions({ plan }) {
  const steps = Object.entries(BUCKETS).map(([bucket, meta]) => ({
    bucket,
    meta,
    target: plan.targets[bucket],
    current: plan.totals[bucket],
    gap: Math.max(0, plan.targets[bucket] - plan.totals[bucket]),
  }))
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        {steps.map(({ bucket, meta, target, current, gap }) => {
          const Icon = meta.icon
          const tone = TONE[meta.tone]
          return (
          <div key={bucket} className="border border-[var(--border-light)] rounded-lg px-3 py-3">
            <div className="flex items-center gap-2">
              <span className={`w-7 h-7 rounded-md grid place-items-center ${tone.bg} ${tone.text}`}><Icon size={14} /></span>
              <div><p className={`text-xs font-bold ${tone.text}`}>{meta.label}</p><p className="text-[10px] text-[var(--text-dim)]">{meta.period}</p></div>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
              <span><span className="text-[var(--text-dim)]">Target</span><b className="block text-[var(--text-primary)] tabular-nums">{formatINR(target)}</b></span>
              <span><span className="text-[var(--text-dim)]">Today</span><b className="block text-[var(--text-primary)] tabular-nums">{formatINR(current)}</b></span>
            </div>
            <p className={`text-[11px] mt-2 ${gap > 1 ? 'text-amber-400' : 'text-emerald-400'}`}>{gap > 1 ? `${formatINR(gap)} still to build` : 'Target covered today'}</p>
          </div>
          )
        })}
      </div>

      <IllustrativeSwitch plan={plan} />

      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-center border border-emerald-500/25 bg-emerald-500/10 rounded-lg px-3 py-2.5">
        <div>
          <p className="text-sm font-semibold text-emerald-400">Sample first monthly withdrawal</p>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">Paid from the income bucket. It is later reviewed and refilled from bucket surplus.</p>
        </div>
        <p className="text-xl font-bold text-[var(--text-primary)] tabular-nums">{formatINR(plan.expense.monthlyExpense)}</p>
      </div>
    </div>
  )
}

function IllustrativeSwitch({ plan }) {
  const sources = plan.byBucket.b3.map(fund => ({ ...fund, available: fund.goalValue }))
  const needs = [
    {
      bucket: 'b1',
      gap: Math.max(0, plan.targets.b1 - plan.totals.b1),
      destination: plan.byBucket.b1[0],
      fallback: 'Select liquid or short-duration debt fund',
    },
    {
      bucket: 'b2',
      gap: Math.max(0, plan.targets.b2 - plan.totals.b2),
      destination: plan.byBucket.b2[0],
      fallback: 'Select hybrid or asset-allocation fund',
    },
  ]
  const switches = []

  for (const need of needs) {
    let remaining = need.gap
    for (const source of sources) {
      if (remaining <= 1 || source.available <= 1) continue
      const amount = Math.min(remaining, source.available)
      switches.push({
        source,
        bucket: need.bucket,
        destination: need.destination,
        fallback: need.fallback,
        amount,
        units: source.currentNav > 0 ? amount / source.currentNav : 0,
      })
      source.available -= amount
      remaining -= amount
    }
  }

  if (!switches.length) return null

  return (
    <div className="border border-violet-500/25 rounded-lg overflow-hidden">
      <div className="px-3 py-2 bg-violet-500/10 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-bold text-violet-400">Switch preview</p>
          <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Fills the Income gap first, followed by the Stability gap.</p>
        </div>
        <span className="px-2 py-1 rounded bg-blue-500/10 text-[10px] font-bold text-blue-400">Using today’s holdings</span>
      </div>
      <div className="divide-y divide-[var(--border-light)]">
        {switches.map((item, index) => {
          const destinationName = item.destination ? splitFundName(item.destination.fundName).main : item.fallback
          const destinationTone = item.bucket === 'b1' ? 'text-emerald-400' : 'text-amber-400'
          return (
            <div key={`${item.bucket}-${item.source.key}-${index}`} className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_32px_minmax(0,1fr)_110px_130px] gap-2.5 items-center px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold text-[var(--text-dim)] uppercase">From growth</p>
                <p className="text-xs font-semibold text-[var(--text-primary)] mt-0.5 truncate" title={splitFundName(item.source.fundName).main}>{splitFundName(item.source.fundName).main}</p>
              </div>
              <ArrowRightLeft size={14} className="text-violet-400" />
              <div className="min-w-0">
                <p className="text-[10px] font-semibold text-[var(--text-dim)] uppercase">To {BUCKETS[item.bucket].label}</p>
                <p className={`text-xs font-semibold mt-0.5 truncate ${destinationTone}`} title={destinationName}>{destinationName}</p>
              </div>
              <div className="md:text-right">
                <p className="text-[10px] text-[var(--text-dim)] uppercase">Switch</p>
                <p className="text-sm font-bold text-[var(--text-primary)] tabular-nums">{formatINR(item.amount)}</p>
              </div>
              <div className="md:text-right">
                <p className="text-[10px] text-[var(--text-dim)] uppercase">Estimated units</p>
                <p className="text-sm font-bold text-[var(--text-primary)] tabular-nums">{item.units.toFixed(4)}</p>
              </div>
            </div>
          )
        })}
      </div>
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
