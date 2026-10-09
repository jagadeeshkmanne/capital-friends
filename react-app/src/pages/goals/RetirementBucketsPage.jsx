import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle, ArrowDown, ArrowDownToLine, ArrowRight, ArrowRightLeft, ArrowUpFromLine, CalendarClock, CheckCircle2, ChevronDown, CircleHelp, Info,
  FlaskConical, Landmark, ShieldCheck, X, Sparkles, TrendingDown, TrendingUp, Wallet,
} from 'lucide-react'
import { formatINR, splitFundName } from '../../data/familyData'
import { getRecommendedAllocation } from '../../data/glidePath'
import { useData } from '../../context/DataContext'
import { useFamily } from '../../context/FamilyContext'
import { useToast } from '../../context/ToastContext'
import Modal from '../../components/Modal'
import PageLoading from '../../components/PageLoading'
import FundSearchInput from '../../components/forms/FundSearchInput'
import MFSwitchForm from '../../components/forms/MFSwitchForm'
import MFRedeemForm from '../../components/forms/MFRedeemForm'
import BucketHowItWorks from '../../components/buckets/BucketHowItWorks'
import { allocateBucketWithdrawal, buildTargetAwareBucketPreview } from '../../utils/retirementBuckets'
import { buildBucketRefillPlan } from '../../utils/bucketRefill'
import { attributeFamilyGoals } from '../../utils/goalAttribution'
import { DEMO_SCENARIOS, buildDemoData, applyDemoSwitch, applyDemoRedeem } from '../../data/bucketDemo'

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
  'glide-path': 'Your equity is above the glide path for your years to retirement, so some growth moves to safer funds.',
  'build-step': 'This quarter’s small step towards your retirement buckets. Growth funds are near their high.',
  'late-start': 'There is not enough safe money for even 1 year, so 1 year of expenses comes from growth, even though it is down.',
}

const fmtDate = d => (d ? d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')
const yrs = months => {
  const y = Math.max(0, months) / 12
  return `${y.toFixed(1)} ${y >= 0.95 && y < 1.05 ? 'yr' : 'yrs'}`
}
const EMPTY_SET = new Set()
// Same tolerance as the Goals card's equity check.
const EQUITY_TOLERANCE = 15
const EQUITY_CATEGORIES = new Set(['Equity', 'ELSS', 'Index'])

// Equity share of the goal, estimated exactly like the Goals card does, so the
// two screens always show the same number.
function estimateGoalEquity(plan, assetAllocations, goal) {
  const detailed = {}
  for (const a of assetAllocations || []) if (a.assetAllocation) detailed[String(a.fundCode)] = a.assetAllocation
  let total = 0, eq = 0
  for (const f of plan.allFunds || []) {
    const v = Number(f.goalValue) || 0
    total += v
    const d = detailed[String(f.schemeCode || f.fundCode)]
    if (d) eq += v * ((Number(d.Equity) || 0) / 100)
    else if (EQUITY_CATEGORIES.has(f.category)) eq += v
    else if (f.category === 'Hybrid') eq += v * 0.65
    else if (f.category === 'Multi-Asset') eq += v * 0.5
  }
  if (!(total > 0)) return null
  const yearsLeft = goal.targetDate ? Math.max(0, (new Date(goal.targetDate) - new Date()) / (365.25 * 864e5)) : 0
  return { now: Math.round((eq / total) * 100), target: getRecommendedAllocation('Retirement', yearsLeft).equity }
}
const BUILD_STATUSES = new Set(['building', 'building-wait', 'step-done', 'built'])

// Date of the latest bucket switch recorded for this goal (from transaction notes).
function parseTxnDate(value) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(value || '').trim())
  const d = m ? new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])) : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}
function lastBucketMove(transactions, goal) {
  let latest = null
  for (const t of transactions || []) {
    if (t.transactionType !== 'SWITCH' || t.type !== 'SELL') continue
    const notes = String(t.notes || '')
    if (!notes.includes('Retirement bucket') || !notes.includes(`(${goal.goalName})`)) continue
    const d = parseTxnDate(t.date)
    if (d && (!latest || d > latest)) latest = d
  }
  return latest
}
// Round units down so a prefilled sale never exceeds the units held.
const unitsDown = u => (Math.floor(Math.max(0, u) * 1000) / 1000).toFixed(3)
const num = (value, fallback) => {
  if (value === undefined || value === '') return fallback
  const n = parseFloat(value)
  return Number.isFinite(n) && n >= 0 ? n : fallback
}

export default function RetirementBucketsPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { selectedMember } = useFamily()
  const liveData = useData()
  const { showToast, showBlockUI, hideBlockUI } = useToast()

  // Demo mode (?demo=<situation>): the page runs on sample data kept in this
  // page only. Recording a switch changes the sample, never the user's data.
  const demoKey = DEMO_SCENARIOS[params.get('demo')] ? params.get('demo') : null
  const [demoState, setDemoState] = useState(null)
  if (demoKey && demoState?.key !== demoKey) setDemoState({ key: demoKey, data: buildDemoData(demoKey) })
  if (!demoKey && demoState) setDemoState(null)
  const demo = demoKey && demoState?.key === demoKey ? demoState.data : null
  const { goalList, goalPortfolioMappings, mfHoldings, mfPortfolios, mfTransactions, assetAllocations, otherInvList } = demo || liveData
  const switchMF = demo ? async sw => setDemoState(st => ({ ...st, data: applyDemoSwitch(st.data, sw) })) : liveData.switchMF
  const redeemMF = demo ? async r => setDemoState(st => ({ ...st, data: applyDemoRedeem(st.data, r) })) : liveData.redeemMF
  const startDemo = key => { setParams({ demo: key }); setSession(null); setForceShow(false) }
  const exitDemo = () => { setParams({}); setSession(null); setForceShow(false) }
  const [switchDraft, setSwitchDraft] = useState(null)
  const [redeemDraft, setRedeemDraft] = useState(null)
  // Recording session for one goal: { goalId, ops, done: Set }.
  // Once the user starts recording, keep the steps they are following fixed until
  // every line is recorded; the jars above still update from live data.
  const [session, setSession] = useState(null)

  const [showHelp, setShowHelp] = useState(false)
  const [forceShow, setForceShow] = useState(false)

  const goals = useMemo(() => (goalList || [])
    .filter(g => g.isActive !== false && g.goalType === 'Retirement')
    .filter(g => demo || selectedMember === 'all' || g.familyMemberId === selectedMember), [goalList, selectedMember, demo])
  const goal = goals.find(g => g.goalId === params.get('goal')) || goals[0]

  // The goal's part of each shared portfolio: nearer goals own the debt first (utils/goalAttribution.js)
  const stockHoldingsAll = demo ? null : liveData.stockHoldings
  const goalAttribution = useMemo(() => {
    const allocMap = {}
    for (const a of (assetAllocations || [])) if (a.assetAllocation) allocMap[a.fundCode] = a.assetAllocation
    return attributeFamilyGoals({ goals: (goalList || []).filter(g => g.isActive !== false), mappings: goalPortfolioMappings,
      mfHoldings, stockHoldings: stockHoldingsAll, otherInvList: (otherInvList || []).filter(i => i.status !== 'Inactive'), allocMap })
  }, [goalList, goalPortfolioMappings, mfHoldings, stockHoldingsAll, otherInvList, assetAllocations])

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
      lastBucketMoveDate: lastBucketMove(mfTransactions, goal),
      otherInvestments: otherInvList || [],
      attribution: goalAttribution[goal.goalId],
    })
  }, [goal, goalPortfolioMappings, mfHoldings, mfPortfolios, mfTransactions, assetAllocations, otherInvList, goalAttribution])

  if (goalList === null || (demoKey && !demo)) return <PageLoading title="Loading retirement buckets" cards={4} />

  const header = (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-9 h-9 rounded-xl bg-violet-500/15 flex items-center justify-center shrink-0"><Wallet size={18} className="text-violet-400" /></div>
        <div className="min-w-0">
          <h1 className="text-base font-bold text-[var(--text-primary)] leading-tight">Retirement Buckets</h1>
          <p className="text-xs text-[var(--text-dim)] truncate">{demo ? 'Sample data, nothing is saved' : 'Your yearly refill plan, worked out for you'}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {!demo && (
          <button type="button" onClick={() => startDemo('good')}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg text-[var(--text-muted)] bg-[var(--bg-card)] border border-[var(--border)] hover:text-[var(--text-primary)] transition-colors">
            <FlaskConical size={14} /> <span className="hidden sm:inline">Try sample data</span>
          </button>
        )}
        {!demo && goals.length > 1 && (
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

  const demoBar = demo && (
    <div className="rounded-xl border border-dashed border-violet-500/40 bg-violet-500/5 px-3 py-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-xs font-semibold text-violet-400 flex items-center gap-1.5"><FlaskConical size={14} /> Sample data. Try any situation; nothing is saved to your account.</p>
        <button type="button" onClick={exitDemo} className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] shrink-0">
          <X size={13} /> Exit
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {Object.entries(DEMO_SCENARIOS).map(([key, sc]) => (
          <button key={key} type="button" onClick={() => startDemo(key)}
            className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors ${demoKey === key ? 'bg-violet-500/15 text-violet-400 border-violet-500/30' : 'text-[var(--text-muted)] border-[var(--border-input)] hover:text-[var(--text-primary)]'}`}>
            {sc.label}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-[var(--text-dim)] mt-2">{DEMO_SCENARIOS[demoKey].note}</p>
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
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button onClick={() => navigate('/goals')} className="text-xs font-semibold text-violet-400 hover:text-violet-300">Go to Goals</button>
            <button onClick={() => startDemo('good')} className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)]"><FlaskConical size={13} /> See it with sample data</button>
          </div>
        </div>
        {helpModal}
      </div>
    )
  }

  const canRecord = plan.schedule.retired || BUILD_STATUSES.has(plan.status)
  // Years before retirement: the existing glide-path preview (same as the old Bucket Preview).
  // More than 5 years away: compare equity with the glide path the same way the
  // Goals card does, and suggest a preview move only when the card would flag it.
  const early = plan.status === 'not-started'
  const equity = early ? estimateGoalEquity(plan, assetAllocations, goal) : null
  const previewOps = early
    ? (equity && equity.now - equity.target > EQUITY_TOLERANCE
      ? buildTargetAwareBucketPreview(plan).map(op => ({ ...op, reason: 'glide-path' }))
      : [])
    : null
  const liveOps = previewOps || plan.operations
  const active = session && session.goalId === goal.goalId ? session : null
  const frozenOps = active?.ops || null
  const recorded = active?.done || EMPTY_SET
  const showSteps = !!frozenOps || (liveOps.length > 0 && (plan.status !== 'not-due' || forceShow))
  const stepOps = frozenOps || liveOps

  return (
    <div className="space-y-4 pb-6">
      {header}
      {demoBar}
      <StatusHero plan={plan} goal={goal} equity={equity} previewCount={previewOps?.length || 0} forceShow={forceShow} onForce={() => setForceShow(true)} />
      {early ? <EarlyBuckets plan={plan} /> : <BucketCards plan={plan} showAfter={showSteps} />}
      <BucketFunds plan={plan} />
      {!early && <MarketCheck plan={plan} />}
      <Warnings plan={plan} />
      {showSteps && (
        <RefillSteps key={goal.goalId} plan={plan} operations={stepOps} canRecord={canRecord} recorded={recorded}
          onRecordSwitch={({ lineKey, op, allocation, dest }) => setSwitchDraft({
            lineKey,
            opsSnapshot: frozenOps || liveOps,
            portfolioId: allocation.portfolioId,
            initial: {
              fromPortfolioId: allocation.portfolioId,
              toPortfolioId: dest.portfolioId || allocation.portfolioId,
              fromFundCode: allocation.schemeCode,
              fromFundName: allocation.fundName,
              toFundCode: dest.schemeCode,
              toFundName: dest.fundName,
              units: unitsDown(allocation.units),
              fromPrice: allocation.currentNav ? String(allocation.currentNav) : '',
              toPrice: dest.currentNav ? String(dest.currentNav) : '',
              notes: `${op.reason === 'build-step' ? 'Retirement bucket build' : 'Retirement bucket refill'}: ${BUCKET[op.from].name} to ${BUCKET[op.to].name} (${goal.goalName})`,
            },
          })} />
      )}
      {plan.schedule.retired && plan.totals.b1 > 1 && (
        <MonthlyWithdrawal key={`w-${goal.goalId}`} plan={plan}
          onRecordRedeem={a => setRedeemDraft({
            portfolioId: a.portfolioId,
            fundCode: a.schemeCode,
            initial: { units: unitsDown(a.units), notes: `Retirement monthly income (${goal.goalName})` },
          })} />
      )}
      <p className="text-[11px] text-[var(--text-dim)] leading-relaxed px-1">
        Suggestions use the latest NAVs in the app and the rules in “How it works”. Capital Friends does not place orders. Place them with your broker or fund house, then record them here. This is not investment advice.
      </p>
      {helpModal}

      <Modal open={!!switchDraft} onClose={() => setSwitchDraft(null)} title="Record switch" wide>
        {switchDraft && (
          <MFSwitchForm key={switchDraft.lineKey} portfolioId={switchDraft.portfolioId} initial={switchDraft.initial} dataOverride={demo || undefined}
            onCancel={() => setSwitchDraft(null)}
            onSave={async data => {
              showBlockUI('Recording switch...')
              try {
                await switchMF(data)
                const ops = switchDraft.opsSnapshot
                const lines = ops.reduce((n, op) => n + op.allocations.length, 0)
                const next = new Set(recorded).add(switchDraft.lineKey)
                setSwitchDraft(null)
                if (next.size >= lines) {
                  setSession(null); setForceShow(false)
                  showToast(demo ? 'All switches recorded in the sample. Nothing was saved.' : 'All switches recorded. Refill done.')
                } else {
                  setSession({ goalId: goal.goalId, ops, done: next })
                  showToast(demo ? `Sample switch recorded (${next.size} of ${lines}). Nothing was saved.` : `Switch recorded (${next.size} of ${lines})`)
                }
              } catch (err) {
                showToast(err.message || 'Failed to record switch', 'error')
              } finally {
                hideBlockUI()
              }
            }} />
        )}
      </Modal>

      <Modal open={!!redeemDraft} onClose={() => setRedeemDraft(null)} title="Record redemption" wide>
        {redeemDraft && (
          <MFRedeemForm key={`${redeemDraft.portfolioId}-${redeemDraft.fundCode}`} portfolioId={redeemDraft.portfolioId} fundCode={redeemDraft.fundCode} initial={redeemDraft.initial} dataOverride={demo || undefined}
            onCancel={() => setRedeemDraft(null)}
            onSave={async data => {
              showBlockUI('Recording redemption...')
              try {
                await redeemMF(data)
                setRedeemDraft(null)
                showToast(demo ? 'Sample redemption recorded. Nothing was saved.' : 'Redemption recorded')
              } catch (err) {
                showToast(err.message || 'Failed to record redemption', 'error')
              } finally {
                hideBlockUI()
              }
            }} />
        )}
      </Modal>
    </div>
  )
}

/* ── Top card: one clear answer ── */
function StatusHero({ plan, goal, equity, previewCount, forceShow, onForce }) {
  const moves = plan.operations
  const totalMove = moves.reduce((sum, op) => sum + op.fundedAmount, 0)
  let tone = 'emerald', Icon = CheckCircle2, title, detail, action = null

  if (plan.status === 'not-started') {
    tone = 'blue'; Icon = CalendarClock
    title = plan.schedule.retirementDate ? `Retirement starts ${fmtDate(plan.schedule.retirementDate)}` : 'Set a retirement date'
    const rd = plan.schedule.retirementDate
    const start = rd ? new Date(rd.getFullYear() - 5, rd.getMonth(), rd.getDate()) : null
    const safe = plan.refillTargets.b1 + plan.refillTargets.b2
    detail = rd
      ? `In ${rd.getFullYear()} you will need about ${formatINR(plan.expense.monthlyExpense)} a month. By then, Income and Stability should hold about ${formatINR(safe)} (7 years of expenses). Building starts in ${start.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}, a little each quarter.`
      : 'Add a retirement date to the goal to see the plan.'
    if (equity) {
      action = (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="px-2.5 py-1 rounded-full bg-[var(--bg-card)]/70 text-[var(--text-secondary)] font-semibold tabular-nums">Equity now about {equity.now}%</span>
          <span className="px-2.5 py-1 rounded-full bg-[var(--bg-card)]/70 text-[var(--text-secondary)] font-semibold tabular-nums">Suggested for now: {equity.target}%</span>
          {previewCount
            ? <span className="text-amber-400 font-semibold">A bit high. See the suggested move below (preview only).</span>
            : <span className="text-emerald-400 font-semibold flex items-center gap-1"><CheckCircle2 size={13} /> On track</span>}
        </div>
      )
    }
  } else if (plan.status === 'ok') {
    title = 'All set. No refill needed'
    detail = `Your Income bucket has ${yrs(plan.months.b1)} of expenses. Next yearly check: ${fmtDate(plan.schedule.nextDate)}.`
  } else if (plan.status === 'not-due') {
    tone = 'blue'; Icon = CalendarClock
    title = 'No refill needed yet'
    detail = `Income has ${yrs(plan.months.b1)} left. The next refill is on ${fmtDate(plan.nextCheckDate)}, or earlier if Income drops to 1 year.`
    if (plan.hasWork && !forceShow) action = <button onClick={onForce} className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1">Show the refill plan anyway <ChevronDown size={13} /></button>
  } else if (plan.status === 'built') {
    title = 'Buckets are ready for retirement'
    detail = `Income and Stability already hold 7 years of expenses. Retirement starts ${fmtDate(plan.schedule.retirementDate)}.`
  } else if (plan.status === 'step-done') {
    tone = 'blue'; Icon = CalendarClock
    title = 'This quarter’s step is done'
    detail = `Next small step from ${fmtDate(plan.build.nextQuarter)}. ${plan.build.quartersLeft - 1} more ${plan.build.quartersLeft - 1 === 1 ? 'quarter' : 'quarters'} until retirement.`
  } else if (plan.status === 'building-wait') {
    tone = 'blue'; Icon = TrendingDown
    title = 'Market is down: skip this quarter'
    detail = 'Growth funds are more than 10% below their high, so nothing moves now. The amount is spread over the quarters that are left.'
  } else if (!plan.hasWork && plan.status === 'building') {
    title = 'Buckets are on track for retirement'
    detail = `Retirement starts ${fmtDate(plan.schedule.retirementDate)}. Nothing needs to move right now.`
  } else if (!plan.hasWork) {
    tone = 'amber'; Icon = AlertTriangle
    title = 'Refill due, but nothing can be moved'
    detail = 'See the note below for what to do.'
  } else {
    tone = 'violet'; Icon = Sparkles
    if (plan.status === 'building') {
      title = `This quarter: move about ${formatINR(totalMove)}`
      detail = `Retirement in ${(plan.schedule.yearsToRetirement || 0).toFixed(1)} years. The buckets are built in small steps, one each quarter, so nothing moves in one go.`
    } else {
      title = 'Refill due now'
      detail = `${moves.length} ${moves.length === 1 ? 'step' : 'steps'}, about ${formatINR(totalMove)} in total. Follow the steps below.`
    }
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
          <p className="text-[11px] font-semibold uppercase tracking-wide opacity-80">{goal.goalName} · {formatINR(plan.expense.monthlyExpense)}/month{plan.expense.inflation > 0 ? (plan.schedule.retired ? ' this year' : ' at retirement') : ''}</p>
          <p className="text-lg font-bold text-[var(--text-primary)] leading-snug mt-0.5">{title}</p>
          <p className="text-sm text-[var(--text-muted)] mt-1">{detail}</p>
          {action && <div className="mt-2">{action}</div>}
          {plan.build && <SafeMoneyBar build={plan.build} />}
        </div>
      </div>
    </div>
  )
}

function SafeMoneyBar({ build }) {
  const pct = build.safeTarget > 0 ? Math.min(100, (build.safeNow / build.safeTarget) * 100) : 100
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] mb-1">
        <span>Safe money built (Income + Stability)</span>
        <span className="tabular-nums font-semibold text-[var(--text-secondary)]">{formatINR(build.safeNow)} of {formatINR(build.safeTarget)}</span>
      </div>
      <div className="h-2 rounded-full bg-[var(--bg-inset)] overflow-hidden">
        <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all duration-700" style={{ width: `${pct}%` }} />
      </div>
      {build.gap > 1 && (() => {
        // After this quarter's step, count only the quarters still to come.
        const q = build.doneThisQuarter ? Math.max(1, build.quartersLeft - 1) : build.quartersLeft
        return <p className="text-[11px] text-[var(--text-dim)] mt-1">{q} {q === 1 ? 'quarter' : 'quarters'} left · about {formatINR(build.gap / q)} per quarter</p>
      })()}
    </div>
  )
}

/* ── More than 5 years away: the split today, in plain shares ── */
function EarlyBuckets({ plan }) {
  const total = plan.totals.b1 + plan.totals.b2 + plan.totals.b3
  const rd = plan.schedule.retirementDate
  const start = rd ? rd.getFullYear() - 5 : null
  const notes = {
    b1: rd ? `Built in the last 2 years (from ${rd.getFullYear() - 2})` : 'Built in the last 2 years',
    b2: start ? `Built step by step from ${start}` : 'Built in the last 5 years',
    b3: 'Your main engine until then',
  }
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl px-3 pt-5 pb-4 sm:px-6">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-dim)] text-center mb-4">Your retirement money today</p>
      <div className="grid grid-cols-3 gap-2 sm:gap-6">
        {['b1', 'b2', 'b3'].map(key => {
          const b = BUCKET[key]
          const Icon = b.icon
          const pct = total > 0 ? (plan.totals[key] / total) * 100 : 0
          return (
            <div key={key} className="flex flex-col items-center text-center min-w-0">
              <div className={`relative w-16 sm:w-24 h-32 sm:h-40 rounded-b-3xl rounded-t-lg border-2 ${b.border} bg-[var(--bg-inset)] overflow-hidden`}>
                <div className={`absolute bottom-0 inset-x-0 ${b.bar} transition-[height] duration-700`} style={{ height: `${pct}%` }} />
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="w-8 h-8 rounded-full bg-[var(--bg-card)]/85 flex items-center justify-center"><Icon size={15} className={b.text} /></span>
                </span>
              </div>
              <p className={`mt-2 text-xs sm:text-sm font-bold ${b.text}`}>{b.name}</p>
              <p className="text-lg sm:text-2xl font-bold text-[var(--text-primary)] tabular-nums leading-tight">{Math.round(pct)}%</p>
              <p className="text-[10px] sm:text-xs text-[var(--text-dim)] tabular-nums">{formatINR(plan.totals[key])}</p>
              <p className="text-[10px] sm:text-[11px] text-[var(--text-muted)] mt-1 leading-snug">{notes[key]}</p>
            </div>
          )
        })}
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
      <YearsExplainer plan={plan} />
      <style>{`.bucket-out{background-image:repeating-linear-gradient(45deg,transparent 0 4px,rgba(255,255,255,.18) 4px 8px)}`}</style>
    </div>
  )
}

// One plain line: how "years" are counted, including inflation.
function YearsExplainer({ plan }) {
  const e = plan.expense
  const when = plan.schedule.retired ? 'this year' : 'at retirement'
  const withInflation = e.inflation > 0 && e.monthlyExpense - e.todayExpense > 500
  return (
    <p className="mt-4 text-center text-[11px] sm:text-xs text-[var(--text-dim)] leading-relaxed max-w-xl mx-auto">
      Years = money in the bucket ÷ <b className="text-[var(--text-muted)]">{formatINR(e.monthlyExpense)} a month</b>, your spending {when}.
      {withInflation && <> That is the {formatINR(e.todayExpense)} in your goal plus {Math.round(e.inflation * 100)}% yearly inflation.</>}
    </p>
  )
}

/* ── What is in each bucket: fund, amount for this goal, share of the bucket ── */
function BucketFunds({ plan }) {
  const [open, setOpen] = useState(true)
  const keys = ['b1', 'b2', 'b3'].filter(k => (plan.byBucket[k] || []).length)
  if (!keys.length) return null
  const grand = keys.reduce((sum, k) => sum + (plan.totals[k] || 0), 0)
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl">
      <button type="button" onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-3 px-4 py-3.5 text-left">
        <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-violet-400 bg-violet-500/10"><Wallet size={17} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-[var(--text-dim)] uppercase tracking-wide">What is in each bucket</p>
          <p className="text-sm text-[var(--text-primary)] mt-0.5">Every fund linked to this goal, its amount and its share of the bucket.</p>
        </div>
        <ChevronDown size={16} className={`text-[var(--text-dim)] shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-4 pb-4 grid grid-cols-1 lg:grid-cols-3 gap-3">
          {keys.map(k => {
            const b = BUCKET[k]
            const Icon = b.icon
            const total = plan.totals[k] || 0
            const funds = [...plan.byBucket[k]].sort((x, y) => y.goalValue - x.goalValue)
            return (
              <div key={k} className={`border ${b.border} rounded-lg overflow-hidden min-w-0`}>
                <div className={`flex items-center justify-between gap-2 px-3 py-2 ${b.soft}`}>
                  <span className={`flex items-center gap-1.5 text-xs font-bold ${b.text}`}><Icon size={13} /> {b.name}</span>
                  <span className="text-xs font-semibold text-[var(--text-primary)] tabular-nums">{formatINR(total)}{grand > 0 && <span className="font-normal text-[var(--text-dim)]"> · {Math.round((total / grand) * 100)}% of goal</span>}</span>
                </div>
                {funds.map(f => {
                  const pct = total > 0 ? (f.goalValue / total) * 100 : 0
                  return (
                    <div key={f.key} className="px-3 py-2 border-t border-[var(--border-row)]">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-[var(--text-secondary)] font-medium truncate" title={f.fundName}>{splitFundName(f.fundName || '').main}</span>
                        <span className="tabular-nums text-[var(--text-primary)] font-semibold shrink-0">{formatINR(f.goalValue)}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-1 rounded-full bg-[var(--bg-inset)] overflow-hidden"><div className={`h-full ${b.bar}`} style={{ width: `${Math.min(100, pct)}%` }} /></div>
                        <span className="text-[11px] tabular-nums text-[var(--text-dim)] w-11 text-right shrink-0">{pct.toFixed(1)}%</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}
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
const WARN_TONE = {
  amber: { box: 'border-amber-500/25 bg-amber-500/10', text: 'text-amber-400' },
  rose: { box: 'border-rose-500/25 bg-rose-500/10', text: 'text-rose-400' },
  blue: { box: 'border-blue-500/25 bg-blue-500/10', text: 'text-blue-400' },
}
function Warnings({ plan }) {
  const seen = new Set()
  // Years before retirement only fund classification matters; refill warnings would confuse.
  const relevant = plan.status === 'not-started' ? plan.warnings.filter(w => w.code === 'unclassified') : plan.warnings
  const items = relevant.filter(w => (seen.has(w.code) ? false : seen.add(w.code))).map(w => {
    switch (w.code) {
      case 'stability-floor': return { tone: 'amber', title: 'Stability has reached its 2-year minimum', text: `Income is short by ${formatINR(w.amount)} this time. Growth is still down, so it is not sold. If you can, spend a little less until the market recovers.` }
      case 'growth-short-stability': return { tone: 'amber', title: 'Stability could not be fully topped up', text: `About ${formatINR(w.amount)} is still missing from Stability. It is topped up again in the next good year.` }
      case 'growth-short-build': return { tone: 'amber', title: 'Growth could not cover this quarter’s step', text: `About ${formatINR(w.amount)} could not be moved. Review the funds linked to this goal.` }
      case 'late-start': return { tone: 'amber', title: 'Not enough safe money: 1 year of income from growth', text: `There was not enough safe money, so about ${formatINR(w.amount)} of growth is sold even though the market is down. That covers 1 year. The rest of Income and Stability (about ${formatINR(w.remaining)}) is built in the next good year.` }
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
      {items.map(item => {
        const t = WARN_TONE[item.tone] || WARN_TONE.amber
        const Icon = item.tone === 'blue' ? Info : AlertTriangle
        return (
          <div key={item.title} className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${t.box}`}>
            <Icon size={16} className={`shrink-0 mt-0.5 ${t.text}`} />
            <div>
              <p className={`text-sm font-semibold ${t.text}`}>{item.title}</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5 leading-relaxed">{item.text}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ── Step-by-step sell and buy list ── */
// Funds that can receive the money: the same portfolio first, then any other
// portfolio linked to this goal (for example a separate debt portfolio). Within
// each, the fund furthest below its target comes first.
function destinationCandidates(plan, bucket, portfolioId) {
  const gap = f => (Number(f.portfolioGoalValue) || 0) * (Number(f.effectiveTargetAllocationPct ?? f.targetAllocationPct) || 0) / 100 - (Number(f.goalValue) || 0)
  return plan.byBucket[bucket].filter(f => !f.isOther).sort((a, b) =>
    Number(b.portfolioId === portfolioId) - Number(a.portfolioId === portfolioId) || gap(b) - gap(a))
}

function groupByPortfolio(allocations) {
  return allocations.reduce((groups, a) => {
    (groups[a.portfolioId] ||= []).push(a)
    return groups
  }, {})
}

const fmtUnits = u => Number(u || 0).toLocaleString('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 })

function TxnSide({ label, tone, fund, detail, step }) {
  return (
    <div className={`min-w-0 rounded-md border-l-2 ${tone.border} ${tone.soft} px-3 py-2 ${step ? `txn-${step}` : ''}`}>
      <p className={`text-[10px] font-bold uppercase tracking-wide ${tone.text}`}>{label}</p>
      <p className="text-sm font-semibold text-[var(--text-primary)] leading-snug truncate">{fund}</p>
      <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate">{detail}</p>
    </div>
  )
}

function FlowArrow() {
  return (
    <div className="flex items-center justify-center text-[var(--text-dim)]">
      <ArrowDown size={16} className="md:hidden txn-arrow-y" />
      <ArrowRight size={16} className="hidden md:block txn-arrow-x" />
    </div>
  )
}

function RecordedPill() {
  return <span className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-400 bg-emerald-500/10 rounded-lg whitespace-nowrap"><CheckCircle2 size={14} /> Recorded</span>
}

// Animated picture of one refill step. All three buckets are always shown, in
// the same order as the jars above. Money travels in a half-ellipse over the
// tops (never across a bucket) while the source drains and the target fills.
// Loop: hold "now", move, hold "after".
function StepFlow({ plan, op, before }) {
  const ref = useRef(null)
  const [w, setW] = useState(600)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const m = plan.expense.monthlyExpense || 1
  const target = { b1: plan.rules.incomeMonths, b2: plan.rules.stabilityMonths }
  const order = ['b1', 'b2', 'b3']
  const after = { ...before, [op.from]: before[op.from] - op.fundedAmount, [op.to]: before[op.to] + op.fundedAmount }
  const cx = k => (w / 6) * (order.indexOf(k) * 2 + 1)
  const x1 = cx(op.from), x2 = cx(op.to)
  const rx = Math.abs(x2 - x1) / 2
  // A real half-ellipse: height is a good share of the width, so the arc
  // clearly rises over the middle bucket instead of looking like a flat line.
  const ry = Math.round(Math.min(100, Math.max(44, rx * 0.55)))
  const AREA = ry + 16                    // room for the arc (the amount sits inside it)
  const base = AREA - 4                   // arc starts and ends just above the jar rims
  const sweep = x2 > x1 ? 1 : 0          // always over the top
  const d = `M ${x1} ${base} A ${rx} ${ry} 0 0 ${sweep} ${x2} ${base}`
  const peakY = base - ry

  return (
    <div className="sm:ml-10 rounded-lg bg-[var(--bg-inset)] border border-[var(--border-light)] px-2 sm:px-6 pt-2 sm:pt-3 pb-3 sm:pb-4">
      <div className="relative h-4 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide">
        <span className="flow-t1 absolute left-0 text-[var(--text-dim)]">Now</span>
        <span className="flow-t2 absolute left-0 text-amber-400">Moving money</span>
        <span className="flow-t3 absolute left-0 text-emerald-400">After this step</span>
      </div>
      <div ref={ref} className="relative mx-auto max-w-[560px]">
        <div className="relative" style={{ height: AREA }}>
          <svg width={w} height={AREA} className="absolute inset-0 overflow-visible" aria-hidden="true">
            <defs>
              <marker id={`flow-head-${op.id}`} viewBox="0 0 10 10" refX="6" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0,0 L10,5 L0,10 z" fill="var(--text-muted)" />
              </marker>
            </defs>
            <path d={d} fill="none" stroke="var(--text-dim)" strokeOpacity="0.7" strokeWidth="2" strokeLinecap="round" strokeDasharray="1 7" className="flow-dash" markerEnd={`url(#flow-head-${op.id})`} />
          </svg>
          <span className={`absolute -translate-x-1/2 px-2 py-0.5 rounded-md bg-[var(--bg-inset)] text-sm sm:text-base font-bold tabular-nums whitespace-nowrap ${BUCKET[op.to].text}`}
            style={{ left: (x1 + x2) / 2, top: peakY + 16 }}>{formatINR(op.fundedAmount)}</span>
          {[0, 1, 2, 3, 4].map(n => (
            <span key={n} className="flow-coin absolute top-0 left-0 w-3.5 h-3.5 rounded-full bg-amber-400 ring-2 ring-amber-300/40 text-[8px] font-bold text-amber-950 flex items-center justify-center shadow"
              style={{ offsetPath: `path('${d}')`, offsetRotate: '0deg', offsetAnchor: 'center', animationDelay: `${n * 0.16}s` }}>₹</span>
          ))}
        </div>
        <div className="grid grid-cols-3">
          {order.map(k => {
            const b = BUCKET[k], Icon = b.icon
            const moving = k === op.from || k === op.to
            const scale = target[k] ? target[k] * m : Math.max(before[k], after[k], 1)
            const a = Math.min(100, (before[k] / scale) * 100), z = Math.min(100, (after[k] / scale) * 100)
            const full = target[k] && after[k] >= target[k] * m - m * 0.5
            return (
              <div key={k} className={`flex flex-col items-center text-center min-w-0 ${moving ? '' : 'opacity-45'}`}>
                <div className={`relative w-14 h-[72px] sm:w-[72px] sm:h-24 rounded-b-2xl sm:rounded-b-3xl rounded-t-md border-2 ${b.border} bg-[var(--bg-card)] overflow-hidden`}>
                  <div className={`absolute bottom-0 inset-x-0 ${b.bar} ${moving ? 'flow-level' : ''}`} style={{ '--a': `${a}%`, '--z': `${z}%`, height: `${z}%` }} />
                  <span className="absolute inset-0 flex items-center justify-center"><span className="w-7 h-7 rounded-full bg-[var(--bg-card)]/85 flex items-center justify-center"><Icon size={14} className={b.text} /></span></span>
                </div>
                <p className={`mt-1.5 text-xs sm:text-sm font-bold ${b.text}`}>{b.name}</p>
                <p className="text-[11px] sm:text-xs text-[var(--text-muted)] tabular-nums sm:whitespace-nowrap leading-snug">
                  {moving ? <>{yrs(before[k] / m)} <ArrowRight size={10} className="inline -mt-px" /> <b className="text-[var(--text-primary)]">{yrs(after[k] / m)}</b></> : <>{yrs(before[k] / m)}<span className="hidden sm:inline"> · no change</span></>}
                </p>
                <p className="text-[10px] sm:text-[11px] text-[var(--text-dim)] tabular-nums sm:whitespace-nowrap leading-snug">
                  {k === op.from ? `gives ${formatINR(op.fundedAmount)}` : k === op.to ? (full ? 'gets it · full' : `gets it · target ${yrs(target[k])}`) : (target[k] ? `target ${yrs(target[k])}` : 'the rest')}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

const FLOW_CSS = `
@keyframes flow-coin{0%,18%{offset-distance:0%;opacity:0}22%{opacity:1}62%{opacity:1}68%,100%{offset-distance:100%;opacity:0}}
.flow-coin{offset-distance:0%;opacity:0;animation:flow-coin 4s ease-in-out infinite}
@keyframes flow-dash{to{stroke-dashoffset:-16}}
.flow-dash{animation:flow-dash .8s linear infinite}
@keyframes flow-level{0%,20%{height:var(--a)}68%,100%{height:var(--z)}}
.flow-level{animation:flow-level 4s ease-in-out infinite}
@keyframes flow-t1{0%,19%{opacity:1}20%,100%{opacity:0}}
@keyframes flow-t2{0%,19%{opacity:0}20%,67%{opacity:1}68%,100%{opacity:0}}
@keyframes flow-t3{0%,67%{opacity:0}68%,100%{opacity:1}}
.flow-t1{opacity:0;animation:flow-t1 4s step-end infinite}.flow-t2{opacity:0;animation:flow-t2 4s step-end infinite}.flow-t3{animation:flow-t3 4s step-end infinite}
@keyframes txn-hi{0%,100%{transform:none;filter:none;box-shadow:none}50%{transform:scale(1.015);filter:brightness(1.3);box-shadow:0 0 0 1px rgba(255,255,255,.18),0 6px 18px rgba(0,0,0,.25)}}
.txn-sell,.txn-buy{transition:transform .3s}
.txn-sell{animation:txn-sell 4s ease-in-out infinite}.txn-buy{animation:txn-buy 4s ease-in-out infinite}
@keyframes txn-sell{0%,16%,46%,100%{transform:none;filter:none;box-shadow:none}24%,38%{transform:scale(1.015);filter:brightness(1.3);box-shadow:0 0 0 1px rgba(255,255,255,.18),0 6px 18px rgba(0,0,0,.25)}}
@keyframes txn-buy{0%,44%,76%,100%{transform:none;filter:none;box-shadow:none}52%,68%{transform:scale(1.015);filter:brightness(1.3);box-shadow:0 0 0 1px rgba(255,255,255,.18),0 6px 18px rgba(0,0,0,.25)}}
@keyframes txn-ax{0%,38%,54%,100%{transform:none;opacity:.6}46%{transform:translateX(5px);opacity:1}}
@keyframes txn-ay{0%,38%,54%,100%{transform:none;opacity:.6}46%{transform:translateY(5px);opacity:1}}
.txn-arrow-x{animation:txn-ax 4s ease-in-out infinite}.txn-arrow-y{animation:txn-ay 4s ease-in-out infinite}
@media (prefers-reduced-motion: reduce){.flow-dash{animation:none}.txn-sell,.txn-buy,.txn-arrow-x,.txn-arrow-y{animation:none}.flow-coin{animation:none;opacity:0}.flow-level{animation:none}.flow-t1,.flow-t2{animation:none;opacity:0}.flow-t3{animation:none;opacity:1}}`

function RefillSteps({ plan, operations, canRecord, onRecordSwitch, recorded }) {
  const [destinations, setDestinations] = useState({})
  const multiPortfolio = new Set(plan.allFunds.map(f => f.portfolioId)).size > 1
  const destinationFor = (op, portfolioId) =>
    destinations[`${op.id}::${portfolioId}`] || destinationCandidates(plan, op.to, portfolioId)[0] || null

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl">
      <div className="px-4 py-3.5 border-b border-[var(--border-light)]">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-bold text-[var(--text-primary)]">What to do</p>
          {recorded.size > 0 && (
            <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 rounded-full px-2.5 py-0.5">
              {recorded.size} of {operations.reduce((n, op) => n + op.allocations.length, 0)} recorded
            </span>
          )}
        </div>
        <p className="text-xs text-[var(--text-dim)] mt-0.5">
          {canRecord
            ? 'For each line: sell the units in your broker or fund-house app, buy the fund shown, then tap Record switch here. The form opens filled in, so you only check the NAV and date.'
            : 'Preview only. Bucket building starts 5 years before retirement.'}
        </p>
      </div>

      <style>{FLOW_CSS}</style>
      <div className="divide-y divide-[var(--border-light)]">
        {operations.map((op, i) => {
          const from = BUCKET[op.from], to = BUCKET[op.to]
          const before = { ...plan.totals }
          for (const prev of operations.slice(0, i)) { before[prev.from] -= prev.fundedAmount; before[prev.to] += prev.fundedAmount }
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

              <StepFlow plan={plan} op={op} before={before} />

              {Object.entries(groupByPortfolio(op.allocations)).map(([portfolioId, allocations]) => {
                const destKey = `${op.id}::${portfolioId}`
                const dest = destinationFor(op, portfolioId)
                const candidates = destinationCandidates(plan, op.to, portfolioId)
                return (
                  <div key={portfolioId} className={`sm:ml-10 space-y-2.5 ${multiPortfolio ? 'rounded-lg border border-[var(--border-light)] bg-[var(--bg-inset)] p-3' : ''}`}>
                    {multiPortfolio && <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-dim)]">Portfolio · {allocations[0].portfolioName}</p>}

                    {candidates.length !== 1 && (<div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <p className={`text-[11px] font-semibold ${to.text} shrink-0 sm:w-16`}>Buy into</p>
                      <div className="flex-1 min-w-0">
                        {candidates.length > 1 ? (
                          <select value={dest?.key || ''} onChange={e => setDestinations(p => ({ ...p, [destKey]: candidates.find(c => c.key === e.target.value) }))}
                            className="w-full text-sm font-semibold bg-[var(--bg-card)] border border-[var(--border)] rounded-lg px-3 py-2 text-[var(--text-primary)]">
                            {candidates.map(c => <option key={c.key} value={c.key}>{splitFundName(c.fundName || '').main}{multiPortfolio ? ` · ${c.portfolioName}` : ''}</option>)}
                          </select>
                        ) : candidates.length === 1 ? (
                          <div className="bg-[var(--bg-card)] rounded-lg px-3 py-2 text-sm font-semibold text-[var(--text-secondary)]">{splitFundName(candidates[0].fundName || '').main}{multiPortfolio && <span className="font-normal text-[var(--text-dim)]"> · {candidates[0].portfolioName}</span>}</div>
                        ) : (
                          <div className="space-y-1.5">
                            <p className="text-xs text-amber-400">No {to.name.toLowerCase()} fund linked to this goal yet. Pick one to add to this portfolio:</p>
                            <FundSearchInput value={dest ? { schemeCode: dest.schemeCode, fundName: dest.fundName } : null}
                              onSelect={({ schemeCode, fundName, nav }) => setDestinations(p => ({ ...p, [destKey]: { key: `new::${schemeCode}`, schemeCode: String(schemeCode), fundName, currentNav: nav || 0, portfolioId } }))}
                              placeholder={op.to === 'b1' ? 'Search a liquid fund…' : 'Search a hybrid or debt fund…'} />
                          </div>
                        )}
                      </div>
                    </div>)}

                    {dest?.portfolioId && dest.portfolioId !== portfolioId && (
                      <p className="text-[11px] text-violet-400">Cross-portfolio switch: money moves from {allocations[0].portfolioName} to {dest.portfolioName}.</p>
                    )}
                    {allocations.map(a => {
                      const lineKey = `${op.id}::${a.key}`
                      const done = recorded.has(lineKey)
                      return (
                        <div key={a.key} className={`rounded-lg border ${done ? 'border-emerald-500/30' : 'border-[var(--border-light)]'} bg-[var(--bg-card)] p-3`}>
                          <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto] md:items-center md:gap-3">
                            <TxnSide step="sell" label={`Sell · ${from.name}`} tone={from} fund={splitFundName(a.fundName || '').main}
                              detail={<><b className="text-[var(--text-primary)] tabular-nums">≈ {formatINR(a.amount)}</b> · <span className="tabular-nums">{fmtUnits(a.units)} units</span></>} />
                            <FlowArrow />
                            <TxnSide step="buy" label={`Buy · ${to.name}`} tone={to} fund={dest ? splitFundName(dest.fundName || '').main : 'Choose a fund above'}
                              detail={<><b className="text-[var(--text-primary)] tabular-nums">≈ {formatINR(a.amount)}</b>{dest?.portfolioName && multiPortfolio ? ` · ${dest.portfolioName}` : ''}</>} />
                            {canRecord && (done ? <RecordedPill /> : (
                              <button type="button" disabled={!dest} onClick={() => onRecordSwitch({ lineKey, op, allocation: a, dest })}
                                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 md:py-2 text-xs font-semibold text-violet-400 border border-violet-500/40 hover:bg-violet-500/10 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap">
                                <ArrowRightLeft size={14} /> Record switch
                              </button>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── This month's income ── */
function MonthlyWithdrawal({ plan, onRecordRedeem }) {
  const [amount, setAmount] = useState(String(Math.round(plan.expense.monthlyExpense / 1000) * 1000))
  const result = allocateBucketWithdrawal(plan.byBucket.b1, num(amount, 0))
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl">
      <style>{FLOW_CSS}</style>
      <div className="px-4 py-3.5 flex items-center gap-3 border-b border-[var(--border-light)]">
        <span className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0"><Landmark size={17} className="text-emerald-400" /></span>
        <div>
          <p className="text-sm font-bold text-[var(--text-primary)]">This month’s income</p>
          <p className="text-xs text-[var(--text-dim)]">Sell from the Income bucket only, and send it to your bank.</p>
        </div>
      </div>
      <div className="p-4 space-y-3">
        <label htmlFor="monthly-amount" className="text-xs text-[var(--text-dim)] flex items-center gap-2">Amount you need this month ₹
          <input id="monthly-amount" type="number" min="0" step="1000" value={amount} onChange={e => setAmount(e.target.value)}
            className="w-32 text-sm font-semibold bg-[var(--bg-inset)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-[var(--text-primary)]" />
        </label>
        {result.allocations.map(a => (
          <div key={a.key} className="rounded-lg border border-[var(--border-light)] bg-[var(--bg-card)] p-3">
            <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto] md:items-center md:gap-3">
              <TxnSide step="sell" label="Sell · Income" tone={BUCKET.b1} fund={splitFundName(a.fundName || '').main}
                detail={<><b className="text-[var(--text-primary)] tabular-nums">≈ {formatINR(a.amount)}</b> · <span className="tabular-nums">{fmtUnits(a.units)} units</span></>} />
              <FlowArrow />
              <TxnSide step="buy" label="To your bank" tone={{ border: 'border-[var(--border)]', soft: 'bg-[var(--bg-inset)]', text: 'text-[var(--text-dim)]' }} fund="Your savings account"
                detail={<><b className="text-[var(--text-primary)] tabular-nums">≈ {formatINR(a.amount)}</b> · for this month</>} />
              <button type="button" onClick={() => onRecordRedeem(a)}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 md:py-2 text-xs font-semibold text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/10 rounded-lg transition-colors whitespace-nowrap">
                <CheckCircle2 size={14} /> Record redemption
              </button>
            </div>
          </div>
        ))}
        {result.shortfall > 1 && <p className="text-xs text-rose-400">The Income bucket is short by {formatINR(result.shortfall)}. Refill it first.</p>}
      </div>
    </div>
  )
}
