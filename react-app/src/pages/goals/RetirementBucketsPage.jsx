import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle, ArrowDownToLine, ArrowRight, ArrowUpFromLine, CalendarClock, CheckCircle2, ChevronDown, CircleHelp, Info,
  Landmark, Pencil, ShieldCheck, Sparkles, TrendingDown, TrendingUp, Wallet,
} from 'lucide-react'
import { formatINR, splitFundName } from '../../data/familyData'
import { getRecommendedAllocation } from '../../data/glidePath'
import { useData } from '../../context/DataContext'
import { useFamily } from '../../context/FamilyContext'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'
import Modal from '../../components/Modal'
import PageLoading from '../../components/PageLoading'
import FundSearchInput from '../../components/forms/FundSearchInput'
import BucketHowItWorks from '../../components/buckets/BucketHowItWorks'
import { allocateBucketWithdrawal } from '../../utils/retirementBuckets'
import { buildBucketRefillPlan } from '../../utils/bucketRefill'

const BUCKET = {
  b1: { name: 'Income', long: 'Income bucket', icon: Wallet, text: 'text-emerald-400', soft: 'bg-emerald-500/10', bar: 'bg-emerald-500', border: 'border-emerald-500/25', holds: 'Liquid and short-term debt funds' },
  b2: { name: 'Stability', long: 'Stability bucket', icon: ShieldCheck, text: 'text-amber-400', soft: 'bg-amber-500/10', bar: 'bg-amber-500', border: 'border-amber-500/25', holds: 'Hybrid and medium-term debt funds' },
  b3: { name: 'Growth', long: 'Growth bucket', icon: TrendingUp, text: 'text-violet-400', soft: 'bg-violet-500/10', bar: 'bg-violet-500', border: 'border-violet-500/25', holds: 'Equity funds' },
}

const REASON = {
  'good-market': 'Growth funds are near their high, so growth pays.',
  'stability-surplus': 'Stability has more than 5 years, so its extra is used first.',
  'down-market': 'Growth funds are down, so Stability pays and growth is left alone.',
  'growth-short': 'Growth did not have enough, so Stability covers the rest.',
}

const todayISO = () => new Date().toISOString().split('T')[0]
const fmtDate = d => (d ? d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')
const yrs = months => {
  const y = Math.max(0, months) / 12
  return `${y.toFixed(1)} ${y >= 0.95 && y < 1.05 ? 'yr' : 'yrs'}`
}
const num = (value, fallback) => {
  if (value === undefined || value === '') return fallback
  const n = parseFloat(value)
  return Number.isFinite(n) && n >= 0 ? n : fallback
}

export default function RetirementBucketsPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { selectedMember } = useFamily()
  const { goalList, goalPortfolioMappings, mfHoldings, mfPortfolios, assetAllocations, executeMFPlan } = useData()
  const { showToast, showBlockUI, hideBlockUI } = useToast()
  const confirm = useConfirm()

  const [showHelp, setShowHelp] = useState(false)
  const [forceShow, setForceShow] = useState(false)

  const goals = useMemo(() => (goalList || [])
    .filter(g => g.isActive !== false && g.goalType === 'Retirement')
    .filter(g => selectedMember === 'all' || g.familyMemberId === selectedMember), [goalList, selectedMember])
  const goal = goals.find(g => g.goalId === params.get('goal')) || goals[0]

  const plan = useMemo(() => {
    if (!goal) return null
    const yearsLeft = goal.targetDate ? Math.max(0, (new Date(goal.targetDate) - new Date()) / (365.25 * 864e5)) : 0
    return buildBucketRefillPlan({
      goal,
      mappings: goalPortfolioMappings,
      holdings: mfHoldings,
      portfolios: mfPortfolios,
      assetAllocations,
      targetEquityPct: getRecommendedAllocation('Retirement', yearsLeft).equity,
    })
  }, [goal, goalPortfolioMappings, mfHoldings, mfPortfolios, assetAllocations])

  if (goalList === null) return <PageLoading title="Loading retirement buckets" cards={4} />

  const header = (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-9 h-9 rounded-xl bg-violet-500/15 flex items-center justify-center shrink-0"><Wallet size={18} className="text-violet-400" /></div>
        <div className="min-w-0">
          <h1 className="text-base font-bold text-[var(--text-primary)] leading-tight">Retirement Buckets</h1>
          <p className="text-xs text-[var(--text-dim)] truncate">Your yearly refill plan, worked out for you</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {goals.length > 1 && (
          <select value={goal?.goalId || ''} onChange={e => { setParams({ goal: e.target.value }); setForceShow(false) }}
            className="text-xs font-semibold bg-[var(--bg-card)] border border-[var(--border)] rounded-lg px-2.5 py-2 text-[var(--text-primary)] max-w-[160px]">
            {goals.map(g => <option key={g.goalId} value={g.goalId}>{g.goalName}</option>)}
          </select>
        )}
        <button type="button" onClick={() => setShowHelp(true)}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg text-violet-400 bg-violet-500/10 hover:bg-violet-500/20 transition-colors">
          <CircleHelp size={14} /> <span className="hidden sm:inline">How it works</span>
        </button>
      </div>
    </div>
  )

  const helpModal = (
    <Modal open={showHelp} onClose={() => setShowHelp(false)} title="How the 3 buckets work" maxWidth="max-w-2xl" maxHeight="max-h-[90vh]">
      <BucketHowItWorks />
    </Modal>
  )

  if (!goal || !plan || plan.noExpenses) {
    const detail = !goal
      ? 'Add a Retirement goal first. This page then shows your three buckets and tells you what to sell and buy each year.'
      : !plan
        ? 'Link a mutual fund portfolio to your retirement goal to see your buckets.'
        : 'Add your monthly expenses to the retirement goal. The bucket sizes are based on them.'
    return (
      <div className="space-y-4">
        {header}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl py-12 px-6 text-center space-y-3">
          <Wallet size={30} className="mx-auto text-[var(--text-dim)]" />
          <p className="text-sm text-[var(--text-muted)] max-w-sm mx-auto">{detail}</p>
          <button onClick={() => navigate('/goals')} className="text-xs font-semibold text-violet-400 hover:text-violet-300">Go to Goals</button>
        </div>
        {helpModal}
      </div>
    )
  }

  const canRecord = plan.schedule.retired || plan.status === 'building'
  const showSteps = plan.hasWork && plan.status !== 'not-started' && (plan.status !== 'not-due' || forceShow)

  return (
    <div className="space-y-4 pb-6">
      {header}
      <StatusHero plan={plan} goal={goal} forceShow={forceShow} onForce={() => setForceShow(true)} />
      <BucketCards plan={plan} showAfter={showSteps} />
      <MarketCheck plan={plan} />
      <Warnings plan={plan} />
      {showSteps && (
        <RefillSteps key={goal.goalId} plan={plan} goal={goal} canRecord={canRecord}
          executeMFPlan={executeMFPlan} showToast={showToast} showBlockUI={showBlockUI} hideBlockUI={hideBlockUI} confirm={confirm} />
      )}
      {plan.schedule.retired && plan.totals.b1 > 1 && (
        <MonthlyWithdrawal key={`w-${goal.goalId}`} plan={plan} goal={goal}
          executeMFPlan={executeMFPlan} showToast={showToast} showBlockUI={showBlockUI} hideBlockUI={hideBlockUI} confirm={confirm} />
      )}
      <p className="text-[11px] text-[var(--text-dim)] leading-relaxed px-1">
        Suggestions use the latest NAVs in the app and the rules in “How it works”. Capital Friends does not place orders. Place them with your broker or fund house, then record them here. This is not investment advice.
      </p>
      {helpModal}
    </div>
  )
}

/* ── Top card: one clear answer ── */
function StatusHero({ plan, goal, forceShow, onForce }) {
  const moves = plan.operations
  const totalMove = moves.reduce((sum, op) => sum + op.fundedAmount, 0)
  let tone = 'emerald', Icon = CheckCircle2, title, detail, action = null

  if (plan.status === 'not-started') {
    tone = 'blue'; Icon = CalendarClock
    title = `Retirement starts ${fmtDate(plan.schedule.retirementDate)}`
    detail = 'Refill suggestions start 3 years before retirement. Until then, keep following your goal’s glide path on the Goals page.'
  } else if (plan.status === 'ok') {
    title = 'All set. No refill needed'
    detail = `Your Income bucket has ${yrs(plan.months.b1)} of expenses. Next yearly check: ${fmtDate(plan.schedule.nextDate)}.`
  } else if (plan.status === 'not-due') {
    tone = 'blue'; Icon = CalendarClock
    title = 'No refill needed yet'
    detail = `Income has ${yrs(plan.months.b1)} left. The next refill is on ${fmtDate(plan.nextCheckDate)}, or earlier if Income drops to 1 year.`
    if (plan.hasWork && !forceShow) action = <button onClick={onForce} className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1">Show the refill plan anyway <ChevronDown size={13} /></button>
  } else if (!plan.hasWork) {
    tone = 'amber'; Icon = AlertTriangle
    title = 'Refill due, but nothing can be moved'
    detail = 'See the note below for what to do.'
  } else {
    tone = 'violet'; Icon = Sparkles
    title = plan.status === 'building' ? 'Build your buckets before retirement' : 'Refill due now'
    detail = `${moves.length} ${moves.length === 1 ? 'step' : 'steps'}, about ${formatINR(totalMove)} in total. Follow the steps below.`
  }

  const T = {
    emerald: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400',
    blue: 'border-blue-500/25 bg-blue-500/10 text-blue-400',
    amber: 'border-amber-500/25 bg-amber-500/10 text-amber-400',
    violet: 'border-violet-500/25 bg-violet-500/10 text-violet-400',
  }[tone]

  return (
    <div className={`rounded-xl border px-4 py-4 ${T}`}>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-[var(--bg-card)]/60 flex items-center justify-center shrink-0"><Icon size={20} /></div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide opacity-80">{goal.goalName} · {formatINR(plan.expense.monthlyExpense)}/month{plan.expense.inflation > 0 ? ' this year' : ''}</p>
          <p className="text-lg font-bold text-[var(--text-primary)] leading-snug mt-0.5">{title}</p>
          <p className="text-sm text-[var(--text-muted)] mt-1">{detail}</p>
          {action && <div className="mt-2">{action}</div>}
        </div>
      </div>
    </div>
  )
}

/* ── The three buckets, drawn as jars ── */
function BucketCards({ plan, showAfter }) {
  const target = { b1: plan.rules.incomeMonths, b2: plan.rules.stabilityMonths }
  const m = plan.expense.monthlyExpense
  const flow = { b1: 0, b2: 0, b3: 0 }
  if (showAfter) for (const op of plan.operations) { flow[op.from] -= op.fundedAmount; flow[op.to] += op.fundedAmount }
  const anyChange = showAfter && ['b1', 'b2', 'b3'].some(k => Math.abs(plan.after[k] - plan.totals[k]) / m > 0.2)
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl px-3 pt-5 pb-4 sm:px-6">
      <div className="grid grid-cols-3 gap-2 sm:gap-6">
        {['b1', 'b2', 'b3'].map(key => {
          const b = BUCKET[key]
          const Icon = b.icon
          const now = plan.totals[key] / m
          const after = plan.after[key] / m
          const changed = showAfter && Math.abs(after - now) > 0.2
          // Growth has no target: draw it full now, and show the share that moves out.
          const scale = target[key] || Math.max(now, 0.0001)
          const nowPct = Math.min(100, (now / scale) * 100)
          const afterPct = changed ? Math.min(100, (after / scale) * 100) : nowPct
          const solid = Math.min(nowPct, afterPct)
          const ghost = Math.abs(afterPct - nowPct)
          return (
            <div key={key} className="flex flex-col items-center text-center min-w-0">
              <div className={`relative w-16 sm:w-24 h-32 sm:h-40 rounded-b-3xl rounded-t-lg border-2 ${b.border} bg-[var(--bg-inset)] overflow-hidden`}>
                <div className={`absolute bottom-0 inset-x-0 ${b.bar} transition-[height] duration-700`} style={{ height: `${solid}%` }} />
                {ghost > 0 && (
                  <div className={`absolute inset-x-0 ${b.bar} opacity-30 transition-all duration-700 ${afterPct < nowPct ? 'bucket-out' : ''}`}
                    style={{ bottom: `${solid}%`, height: `${ghost}%` }} />
                )}
                <span className={`absolute inset-0 flex items-center justify-center`}>
                  <span className="w-8 h-8 rounded-full bg-[var(--bg-card)]/85 flex items-center justify-center"><Icon size={15} className={b.text} /></span>
                </span>
              </div>
              <p className={`mt-2 text-xs sm:text-sm font-bold ${b.text}`}>{b.name}</p>
              <p className="text-lg sm:text-2xl font-bold text-[var(--text-primary)] tabular-nums leading-tight">{yrs(now)}</p>
              {changed
                ? <p className={`text-[11px] font-semibold ${b.text} flex items-center gap-0.5`}><ArrowRight size={11} />{yrs(after)}</p>
                : <p className="text-[11px] text-[var(--text-dim)]">{target[key] ? (now >= target[key] - 0.5 ? 'Full' : `of ${yrs(target[key])}`) : 'The rest'}</p>}
              <p className="text-[10px] sm:text-xs text-[var(--text-dim)] tabular-nums mt-0.5">{formatINR(plan.totals[key])}</p>
              {showAfter && (
                Math.abs(flow[key]) > 1
                  ? <span className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] sm:text-[11px] font-semibold whitespace-nowrap ${flow[key] > 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'}`}>
                      {flow[key] > 0 ? <ArrowDownToLine size={11} /> : <ArrowUpFromLine size={11} />}
                      {flow[key] > 0 ? 'Gets' : 'Gives'} {formatINR(Math.abs(flow[key]))}
                    </span>
                  : <span className="mt-2 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] sm:text-[11px] font-semibold text-[var(--text-dim)] bg-[var(--bg-inset)]">No change</span>
              )}
            </div>
          )
        })}
      </div>
      {anyChange && (
        <div className="flex items-center justify-center gap-4 mt-4 text-[10px] sm:text-[11px] text-[var(--text-dim)]">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[var(--text-muted)]" /> Now</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[var(--text-muted)] opacity-30" /> Moves in this refill</span>
        </div>
      )}
      <style>{`.bucket-out{background-image:repeating-linear-gradient(45deg,transparent 0 4px,rgba(255,255,255,.18) 4px 8px)}`}</style>
    </div>
  )
}

/* ── Is it a good year to sell growth? ── */
function MarketCheck({ plan }) {
  const [open, setOpen] = useState(false)
  const m = plan.market
  if (!plan.byBucket.b3.length) return null
  const good = m.status === 'good'
  const below = m.weightedBelowAthPct
  const tone = good ? 'text-emerald-400 bg-emerald-500/10' : m.status === 'down' ? 'text-rose-400 bg-rose-500/10' : 'text-amber-400 bg-amber-500/10'
  const Icon = good ? TrendingUp : m.status === 'down' ? TrendingDown : Info
  const sentence = m.status === 'unknown'
    ? 'All-time high NAV is not available for your growth funds yet, so growth is not sold.'
    : good
      ? `Growth funds are ${below.toFixed(1)}% below their all-time high. That is within ${m.maxBelowAthPct}%, so it is a good time to sell a little growth.`
      : `Growth funds are ${below.toFixed(1)}% below their all-time high. That is more than ${m.maxBelowAthPct}%, so growth is not sold this year.`

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl">
      <button type="button" onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-3 px-4 py-3.5 text-left">
        <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${tone}`}><Icon size={17} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-[var(--text-dim)] uppercase tracking-wide">Market check</p>
          <p className="text-sm text-[var(--text-primary)] mt-0.5">{sentence}</p>
        </div>
        <ChevronDown size={16} className={`text-[var(--text-dim)] shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-4 pb-4">
          <div className="border border-[var(--border-light)] rounded-lg overflow-hidden">
            <div className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_auto_auto_auto] gap-x-4 px-3 py-2 bg-[var(--bg-inset)] text-[10px] font-semibold uppercase text-[var(--text-dim)]">
              <span>Growth fund</span><span className="hidden sm:block text-right">NAV</span><span className="hidden sm:block text-right">All-time high</span><span className="text-right">Below high</span>
            </div>
            {m.funds.map(f => (
              <div key={f.key} className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_auto_auto_auto] gap-x-4 px-3 py-2.5 border-t border-[var(--border-row)] text-xs items-center">
                <span className="text-[var(--text-secondary)] font-medium truncate">{splitFundName(f.fundName || '').main}</span>
                <span className="hidden sm:block text-right tabular-nums text-[var(--text-muted)]">₹{f.currentNav.toFixed(2)}</span>
                <span className="hidden sm:block text-right tabular-nums text-[var(--text-muted)]">{f.athNav > 0 ? `₹${f.athNav.toFixed(2)}` : '—'}</span>
                <span className={`text-right tabular-nums font-semibold ${f.belowAthPct === null ? 'text-[var(--text-dim)]' : f.belowAthPct <= m.maxBelowAthPct ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {f.belowAthPct === null ? '—' : `${f.belowAthPct.toFixed(1)}%`}
                </span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-[var(--text-dim)] mt-2">Weighted by how much of each fund belongs to this goal. Within {m.maxBelowAthPct}% of the high counts as a good year.</p>
        </div>
      )}
    </div>
  )
}

/* ── Plain-language warnings ── */
function Warnings({ plan }) {
  const seen = new Set()
  const items = plan.warnings.filter(w => (seen.has(w.code) ? false : seen.add(w.code))).map(w => {
    switch (w.code) {
      case 'stability-floor': return { tone: 'amber', title: 'Stability has reached its 2-year minimum', text: `Income is short by ${formatINR(w.amount)} this time. Growth is still down, so it is not sold. If you can, spend a little less until the market recovers.` }
      case 'growth-short': return { tone: 'amber', title: 'Growth did not have enough', text: `About ${formatINR(w.amount)} could not be moved. Review your expenses or the funds linked to this goal.` }
      case 'market-unknown': return { tone: 'amber', title: 'Market check not available', text: 'All-time high NAV is missing for your growth funds, so the plan protects growth and uses Stability instead. It usually appears after the next daily data refresh.' }
      case 'unclassified': return { tone: 'rose', title: `${w.count} fund(s) are not in any bucket`, text: 'Their category is unclear, so they are left out of the plan. Check them on the Mutual Funds page.' }
      case 'high-withdrawal': return { tone: 'amber', title: `You withdraw ${(w.rate * 100).toFixed(1)}% of your corpus a year`, text: `At today's spending, the linked corpus covers about ${plan.corpusYears?.toFixed(0)} years of expenses, before any growth. Above 5% a year, the money may not last. Refills still go ahead.` }
      default: return null
    }
  }).filter(Boolean)
  if (!items.length) return null
  return (
    <div className="space-y-2">
      {items.map(item => (
        <div key={item.title} className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${item.tone === 'rose' ? 'border-rose-500/25 bg-rose-500/10' : 'border-amber-500/25 bg-amber-500/10'}`}>
          <AlertTriangle size={16} className={`shrink-0 mt-0.5 ${item.tone === 'rose' ? 'text-rose-400' : 'text-amber-400'}`} />
          <div>
            <p className={`text-sm font-semibold ${item.tone === 'rose' ? 'text-rose-400' : 'text-amber-400'}`}>{item.title}</p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5 leading-relaxed">{item.text}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ── Step-by-step sell and buy list ── */
function destinationCandidates(plan, bucket, portfolioId) {
  return plan.byBucket[bucket]
    .filter(f => f.portfolioId === portfolioId)
    .sort((a, b) => {
      const gap = f => (Number(f.portfolioGoalValue) || 0) * (Number(f.effectiveTargetAllocationPct ?? f.targetAllocationPct) || 0) / 100 - (Number(f.goalValue) || 0)
      return gap(b) - gap(a)
    })
}

function groupByPortfolio(allocations) {
  return allocations.reduce((groups, a) => {
    (groups[a.portfolioId] ||= []).push(a)
    return groups
  }, {})
}

function RefillSteps({ plan, goal, canRecord, executeMFPlan, showToast, showBlockUI, hideBlockUI, confirm }) {
  const [date, setDate] = useState(todayISO())
  const [destinations, setDestinations] = useState({})
  const [edits, setEdits] = useState({})
  const [buyNavs, setBuyNavs] = useState({})
  const [editing, setEditing] = useState({})

  const multiPortfolio = new Set(plan.allFunds.map(f => f.portfolioId)).size > 1
  const destinationFor = (op, portfolioId) => {
    const key = `${op.id}::${portfolioId}`
    return destinations[key] || destinationCandidates(plan, op.to, portfolioId)[0] || null
  }

  const switches = []
  let missing = false
  for (const op of plan.operations) {
    for (const [portfolioId, allocations] of Object.entries(groupByPortfolio(op.allocations))) {
      const dest = destinationFor(op, portfolioId)
      const destKey = `${op.id}::${portfolioId}`
      const toPrice = dest ? num(buyNavs[destKey], dest.currentNav) : 0
      if (!dest || toPrice <= 0) { missing = true; continue }
      for (const a of allocations) {
        const k = `${op.id}::${a.key}`
        const units = Math.min(num(edits[k]?.units, a.units), a.goalUnits || a.units)
        const price = num(edits[k]?.nav, a.currentNav)
        if (units <= 0 || price <= 0) continue
        switches.push({
          fromPortfolioId: a.portfolioId,
          toPortfolioId: a.portfolioId,
          fromFundCode: a.schemeCode,
          fromFundName: a.fundName,
          toFundCode: dest.schemeCode,
          toFundName: dest.fundName,
          units: parseFloat(units.toFixed(4)),
          fromFundPrice: price,
          toFundPrice: toPrice,
          switchDate: date,
          notes: `Retirement bucket refill ${op.label} - ${goal.goalName}`,
        })
      }
    }
  }

  async function record() {
    const ok = await confirm(`Record ${switches.length} switch${switches.length === 1 ? '' : 'es'} dated ${date}? Do this only after you have placed the orders.`, { title: 'Record refill', confirmLabel: 'Record' })
    if (!ok) return
    showBlockUI('Recording refill...')
    try {
      const result = await executeMFPlan(switches, [])
      if (!result?.success) throw new Error((result?.message || 'Could not record the refill') + (result?.partial ? ' Some entries may be saved; refresh before retrying.' : ''))
      showToast('Refill recorded. Your buckets are updated.')
      setEdits({}); setBuyNavs({}); setEditing({})
    } catch (err) {
      showToast(err.message || 'Could not record the refill', 'error')
    } finally {
      hideBlockUI()
    }
  }

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl">
      <div className="px-4 py-3.5 border-b border-[var(--border-light)]">
        <p className="text-sm font-bold text-[var(--text-primary)]">What to do</p>
        <p className="text-xs text-[var(--text-dim)] mt-0.5">Switch these units with your broker or fund house. The units are already worked out.</p>
      </div>

      <div className="divide-y divide-[var(--border-light)]">
        {plan.operations.map((op, i) => {
          const from = BUCKET[op.from], to = BUCKET[op.to]
          return (
            <div key={op.id} className="px-4 py-4 space-y-3">
              <div className="flex items-start gap-3">
                <span className="w-7 h-7 rounded-full bg-violet-500/15 text-violet-400 text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className={`text-sm font-bold ${from.text}`}>{from.name}</span>
                    <ArrowRight size={14} className="text-[var(--text-dim)]" />
                    <span className={`text-sm font-bold ${to.text}`}>{to.name}</span>
                    <span className="ml-auto text-base font-bold text-[var(--text-primary)] tabular-nums">{formatINR(op.fundedAmount)}</span>
                  </div>
                  <p className="text-xs text-[var(--text-dim)] mt-0.5">{REASON[op.reason]}</p>
                </div>
              </div>

              {Object.entries(groupByPortfolio(op.allocations)).map(([portfolioId, allocations]) => {
                const destKey = `${op.id}::${portfolioId}`
                const dest = destinationFor(op, portfolioId)
                const candidates = destinationCandidates(plan, op.to, portfolioId)
                const isEditing = editing[destKey]
                return (
                  <div key={portfolioId} className="sm:ml-10 rounded-lg border border-[var(--border-light)] bg-[var(--bg-inset)] overflow-hidden">
                    {multiPortfolio && <p className="px-3 pt-2.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-dim)]">Portfolio · {allocations[0].portfolioName}</p>}
                    <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-3 p-3 items-start">
                      <div className="space-y-2">
                        <p className={`text-[11px] font-semibold ${from.text}`}>Sell</p>
                        {allocations.map(a => {
                          const k = `${op.id}::${a.key}`
                          const units = Math.min(num(edits[k]?.units, a.units), a.goalUnits || a.units)
                          const nav = num(edits[k]?.nav, a.currentNav)
                          return (
                            <div key={k} className="bg-[var(--bg-card)] rounded-lg px-3 py-2.5">
                              <p className="text-sm font-semibold text-[var(--text-secondary)] leading-snug">{splitFundName(a.fundName || '').main}</p>
                              <p className="text-xs text-[var(--text-muted)] mt-0.5"><b className="text-[var(--text-primary)] tabular-nums">{units.toFixed(3)} units</b> · about {formatINR(units * nav)}</p>
                              {isEditing && (
                                <div className="grid grid-cols-2 gap-2 mt-2">
                                  <SmallInput label="Units sold" value={edits[k]?.units} placeholder={a.units.toFixed(3)} onChange={v => setEdits(p => ({ ...p, [k]: { ...p[k], units: v } }))} />
                                  <SmallInput label="Sell NAV ₹" value={edits[k]?.nav} placeholder={a.currentNav.toFixed(4)} onChange={v => setEdits(p => ({ ...p, [k]: { ...p[k], nav: v } }))} />
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                      <div className="hidden md:flex items-center self-center"><ArrowRight size={18} className="text-[var(--text-dim)]" /></div>
                      <div className="space-y-2">
                        <p className={`text-[11px] font-semibold ${to.text}`}>Buy</p>
                        {candidates.length > 1 ? (
                          <select value={dest?.key || ''} onChange={e => setDestinations(p => ({ ...p, [destKey]: candidates.find(c => c.key === e.target.value) }))}
                            className="w-full text-sm bg-[var(--bg-card)] border border-[var(--border)] rounded-lg px-3 py-2 text-[var(--text-primary)]">
                            {candidates.map(c => <option key={c.key} value={c.key}>{splitFundName(c.fundName || '').main}</option>)}
                          </select>
                        ) : candidates.length === 1 ? (
                          <div className="bg-[var(--bg-card)] rounded-lg px-3 py-2.5 text-sm font-semibold text-[var(--text-secondary)]">{splitFundName(candidates[0].fundName || '').main}</div>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-xs text-amber-400">No {to.name.toLowerCase()} fund in this portfolio yet. Pick one:</p>
                            <FundSearchInput value={dest ? { schemeCode: dest.schemeCode, fundName: dest.fundName } : null}
                              onSelect={({ schemeCode, fundName, nav }) => setDestinations(p => ({ ...p, [destKey]: { key: `new::${schemeCode}`, schemeCode: String(schemeCode), fundName, currentNav: nav || 0, portfolioId } }))}
                              placeholder={op.to === 'b1' ? 'Search a liquid fund…' : 'Search a hybrid or debt fund…'} />
                          </div>
                        )}
                        <p className="text-[11px] text-[var(--text-dim)]">{to.holds}</p>
                        {isEditing && dest && (
                          <SmallInput label="Buy NAV ₹" value={buyNavs[destKey]} placeholder={Number(dest.currentNav || 0).toFixed(4)} onChange={v => setBuyNavs(p => ({ ...p, [destKey]: v }))} />
                        )}
                      </div>
                    </div>
                    {canRecord && (
                      <button type="button" onClick={() => setEditing(p => ({ ...p, [destKey]: !p[destKey] }))}
                        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-semibold text-[var(--text-dim)] hover:text-[var(--text-primary)] border-t border-[var(--border-light)]">
                        <Pencil size={11} /> {isEditing ? 'Hide actual units and NAV' : 'Enter actual units and NAV (optional)'}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      <div className="px-4 py-3.5 border-t border-[var(--border-light)] flex flex-col sm:flex-row sm:items-center gap-3">
        {canRecord ? (
          <>
            <label className="text-xs text-[var(--text-dim)] flex items-center gap-2">Done on
              <input type="date" value={date} max={todayISO()} onChange={e => setDate(e.target.value)}
                className="text-xs font-semibold bg-[var(--bg-inset)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-[var(--text-primary)]" />
            </label>
            {missing && <p className="text-xs text-amber-400">Pick a fund to buy in every step first.</p>}
            <button type="button" onClick={record} disabled={missing || !switches.length}
              className="sm:ml-auto flex items-center justify-center gap-1.5 px-5 py-2.5 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-500 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              <CheckCircle2 size={15} /> I’ve done this, record it
            </button>
          </>
        ) : (
          <p className="text-xs text-blue-400">Preview only. Recording starts 3 years before retirement.</p>
        )}
      </div>
    </div>
  )
}

/* ── This month's income ── */
function MonthlyWithdrawal({ plan, goal, executeMFPlan, showToast, showBlockUI, hideBlockUI, confirm }) {
  const [amount, setAmount] = useState(String(Math.round(plan.expense.monthlyExpense)))
  const [date, setDate] = useState(todayISO())
  const value = num(amount, 0)
  const result = allocateBucketWithdrawal(plan.byBucket.b1, value)
  const redemptions = result.allocations.map(a => ({
    portfolioId: a.portfolioId,
    fundCode: a.schemeCode,
    fundName: a.fundName,
    units: parseFloat(a.units.toFixed(4)),
    salePrice: a.currentNav,
    saleDate: date,
    totalAmount: a.units * a.currentNav,
    notes: `Retirement monthly income - ${goal.goalName}`,
  })).filter(r => r.units > 0 && r.salePrice > 0)

  async function record() {
    const ok = await confirm(`Record a withdrawal of ${formatINR(value)} from the Income bucket, dated ${date}?`, { title: 'Record monthly income', confirmLabel: 'Record' })
    if (!ok) return
    showBlockUI('Recording withdrawal...')
    try {
      const res = await executeMFPlan([], redemptions)
      if (!res?.success) throw new Error(res?.message || 'Could not record the withdrawal')
      showToast('Withdrawal recorded.')
    } catch (err) {
      showToast(err.message || 'Could not record the withdrawal', 'error')
    } finally {
      hideBlockUI()
    }
  }

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl">
      <div className="px-4 py-3.5 flex items-center gap-3 border-b border-[var(--border-light)]">
        <span className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0"><Landmark size={17} className="text-emerald-400" /></span>
        <div>
          <p className="text-sm font-bold text-[var(--text-primary)]">This month’s income</p>
          <p className="text-xs text-[var(--text-dim)]">Sell from the Income bucket only, and send it to your bank.</p>
        </div>
      </div>
      <div className="p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs text-[var(--text-dim)] flex items-center gap-2">Amount ₹
            <input type="number" min="0" step="1000" value={amount} onChange={e => setAmount(e.target.value)}
              className="w-32 text-sm font-semibold bg-[var(--bg-inset)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-[var(--text-primary)]" />
          </label>
          <label className="text-xs text-[var(--text-dim)] flex items-center gap-2">On
            <input type="date" value={date} max={todayISO()} onChange={e => setDate(e.target.value)}
              className="text-xs font-semibold bg-[var(--bg-inset)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-[var(--text-primary)]" />
          </label>
        </div>
        {result.allocations.map(a => (
          <div key={a.key} className="flex items-center justify-between gap-3 bg-[var(--bg-inset)] rounded-lg px-3 py-2.5">
            <p className="text-sm font-semibold text-[var(--text-secondary)] truncate">{splitFundName(a.fundName || '').main}</p>
            <p className="text-xs text-[var(--text-muted)] shrink-0">Sell <b className="text-[var(--text-primary)] tabular-nums">{a.units.toFixed(3)} units</b></p>
          </div>
        ))}
        {result.shortfall > 1 && <p className="text-xs text-rose-400">The Income bucket is short by {formatINR(result.shortfall)}. Refill it first.</p>}
        <div className="flex justify-end">
          <button type="button" onClick={record} disabled={!redemptions.length || result.shortfall > 1}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            <CheckCircle2 size={14} /> Record withdrawal
          </button>
        </div>
      </div>
    </div>
  )
}

function SmallInput({ label, value, placeholder, onChange }) {
  return (
    <label className="text-[11px] text-[var(--text-dim)] block">{label}
      <input type="number" min="0" step="0.0001" value={value ?? ''} placeholder={placeholder} onChange={e => onChange(e.target.value)}
        className="mt-1 w-full text-xs bg-[var(--bg-card)] border border-[var(--border)] rounded px-2 py-1.5 text-[var(--text-primary)]" />
    </label>
  )
}
