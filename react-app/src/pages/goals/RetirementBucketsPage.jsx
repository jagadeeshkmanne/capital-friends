import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle, ArrowDownToLine, ArrowRight, ArrowRightLeft, ArrowUpFromLine, CalendarClock, CheckCircle2, ChevronDown, CircleHelp, Info,
  Landmark, ShieldCheck, Sparkles, TrendingDown, TrendingUp, Wallet,
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
}

const fmtDate = d => (d ? d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')
const yrs = months => {
  const y = Math.max(0, months) / 12
  return `${y.toFixed(1)} ${y >= 0.95 && y < 1.05 ? 'yr' : 'yrs'}`
}
const EMPTY_SET = new Set()
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
  const { goalList, goalPortfolioMappings, mfHoldings, mfPortfolios, assetAllocations, switchMF, redeemMF } = useData()
  const { showToast, showBlockUI, hideBlockUI } = useToast()
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
  // Years before retirement: the existing glide-path preview (same as the old Bucket Preview).
  const previewOps = plan.status === 'not-started'
    ? buildTargetAwareBucketPreview(plan).map(op => ({ ...op, reason: 'glide-path' }))
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
      <StatusHero plan={plan} goal={goal} previewCount={previewOps?.length || 0} forceShow={forceShow} onForce={() => setForceShow(true)} />
      <BucketCards plan={plan} showAfter={showSteps && !previewOps} />
      <MarketCheck plan={plan} />
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
              notes: `Retirement bucket refill: ${BUCKET[op.from].name} to ${BUCKET[op.to].name} (${goal.goalName})`,
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
          <MFSwitchForm key={switchDraft.lineKey} portfolioId={switchDraft.portfolioId} initial={switchDraft.initial}
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
                  showToast('All switches recorded. Refill done.')
                } else {
                  setSession({ goalId: goal.goalId, ops, done: next })
                  showToast(`Switch recorded (${next.size} of ${lines})`)
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
          <MFRedeemForm key={`${redeemDraft.portfolioId}-${redeemDraft.fundCode}`} portfolioId={redeemDraft.portfolioId} fundCode={redeemDraft.fundCode} initial={redeemDraft.initial}
            onCancel={() => setRedeemDraft(null)}
            onSave={async data => {
              showBlockUI('Recording redemption...')
              try {
                await redeemMF(data)
                setRedeemDraft(null)
                showToast('Redemption recorded')
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
function StatusHero({ plan, goal, previewCount, forceShow, onForce }) {
  const moves = plan.operations
  const totalMove = moves.reduce((sum, op) => sum + op.fundedAmount, 0)
  let tone = 'emerald', Icon = CheckCircle2, title, detail, action = null

  if (plan.status === 'not-started') {
    tone = 'blue'; Icon = CalendarClock
    title = plan.schedule.retirementDate ? `Retirement starts ${fmtDate(plan.schedule.retirementDate)}` : 'Set a retirement date'
    detail = previewCount
      ? 'Refills start 3 years before retirement. For now, your equity is above the glide path. See the suggested moves below (preview only).'
      : 'Refills start 3 years before retirement. Until then, your goal just follows its glide path, and it is on track.'
  } else if (plan.status === 'ok') {
    title = 'All set. No refill needed'
    detail = `Your Income bucket has ${yrs(plan.months.b1)} of expenses. Next yearly check: ${fmtDate(plan.schedule.nextDate)}.`
  } else if (plan.status === 'not-due') {
    tone = 'blue'; Icon = CalendarClock
    title = 'No refill needed yet'
    detail = `Income has ${yrs(plan.months.b1)} left. The next refill is on ${fmtDate(plan.nextCheckDate)}, or earlier if Income drops to 1 year.`
    if (plan.hasWork && !forceShow) action = <button onClick={onForce} className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1">Show the refill plan anyway <ChevronDown size={13} /></button>
  } else if (!plan.hasWork && plan.status === 'building') {
    title = 'Buckets are on track for retirement'
    detail = `Retirement starts ${fmtDate(plan.schedule.retirementDate)}. Nothing needs to move right now.`
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
          <p className="text-[11px] font-semibold uppercase tracking-wide opacity-80">{goal.goalName} · {formatINR(plan.expense.monthlyExpense)}/month{plan.expense.inflation > 0 ? (plan.schedule.retired ? ' this year' : ' at retirement') : ''}</p>
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
      case 'building-capped': return { tone: 'blue', title: 'Buckets fill gradually before retirement', text: 'Until you retire, growth only gives the part above its own target, so equity is not sold all at once. The rest is moved in the coming years.' }
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
  return [...plan.byBucket[bucket]].sort((a, b) =>
    Number(b.portfolioId === portfolioId) - Number(a.portfolioId === portfolioId) || gap(b) - gap(a))
}

function groupByPortfolio(allocations) {
  return allocations.reduce((groups, a) => {
    (groups[a.portfolioId] ||= []).push(a)
    return groups
  }, {})
}

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
            ? 'Place each switch with your broker or fund house, then tap Record switch. The form opens filled in, so you only check the NAV and date.'
            : 'Preview only. Recording starts 3 years before retirement.'}
        </p>
      </div>

      <div className="divide-y divide-[var(--border-light)]">
        {operations.map((op, i) => {
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
                return (
                  <div key={portfolioId} className="sm:ml-10 rounded-lg border border-[var(--border-light)] bg-[var(--bg-inset)] p-3 space-y-2.5">
                    {multiPortfolio && <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-dim)]">Portfolio · {allocations[0].portfolioName}</p>}

                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
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
                    </div>

                    {dest?.portfolioId && dest.portfolioId !== portfolioId && (
                      <p className="text-[11px] text-violet-400">Cross-portfolio switch: money moves from {allocations[0].portfolioName} to {dest.portfolioName}.</p>
                    )}
                    <p className={`text-[11px] font-semibold ${from.text}`}>Sell {allocations.length > 1 ? `from ${allocations.length} funds` : ''}</p>
                    {allocations.map(a => {
                      const lineKey = `${op.id}::${a.key}`
                      const done = recorded.has(lineKey)
                      return (
                        <div key={a.key} className="bg-[var(--bg-card)] rounded-lg px-3 py-2.5 flex flex-col sm:flex-row sm:items-center gap-2.5">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-[var(--text-secondary)] leading-snug">{splitFundName(a.fundName || '').main}</p>
                            <p className="text-xs text-[var(--text-muted)] mt-0.5"><b className="text-[var(--text-primary)] tabular-nums">{a.units.toFixed(3)} units</b> · about {formatINR(a.amount)} at ₹{a.currentNav.toFixed(2)}</p>
                          </div>
                          {canRecord && (done ? (
                            <span className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-400 bg-emerald-500/10 rounded-lg shrink-0"><CheckCircle2 size={14} /> Recorded</span>
                          ) : (
                            <button type="button" disabled={!dest} onClick={() => onRecordSwitch({ lineKey, op, allocation: a, dest })}
                              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-500 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0">
                              <ArrowRightLeft size={14} /> Record switch
                            </button>
                          ))}
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
  const [amount, setAmount] = useState(String(Math.round(plan.expense.monthlyExpense)))
  const result = allocateBucketWithdrawal(plan.byBucket.b1, num(amount, 0))
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
        <label htmlFor="monthly-amount" className="text-xs text-[var(--text-dim)] flex items-center gap-2">Amount ₹
          <input id="monthly-amount" type="number" min="0" step="1000" value={amount} onChange={e => setAmount(e.target.value)}
            className="w-32 text-sm font-semibold bg-[var(--bg-inset)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-[var(--text-primary)]" />
        </label>
        {result.allocations.map(a => (
          <div key={a.key} className="flex flex-col sm:flex-row sm:items-center gap-2.5 bg-[var(--bg-inset)] rounded-lg px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[var(--text-secondary)] truncate">{splitFundName(a.fundName || '').main}</p>
              <p className="text-xs text-[var(--text-muted)]">Sell <b className="text-[var(--text-primary)] tabular-nums">{a.units.toFixed(3)} units</b> · about {formatINR(a.amount)}</p>
            </div>
            <button type="button" onClick={() => onRecordRedeem(a)}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg transition-colors shrink-0">
              <CheckCircle2 size={14} /> Record redemption
            </button>
          </div>
        ))}
        {result.shortfall > 1 && <p className="text-xs text-rose-400">The Income bucket is short by {formatINR(result.shortfall)}. Refill it first.</p>}
      </div>
    </div>
  )
}
