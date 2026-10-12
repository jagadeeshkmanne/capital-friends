import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { createPortal } from 'react-dom'
import {
  AlertTriangle, ArrowDown, ArrowDownToLine, ArrowRight, ArrowRightLeft, ArrowUpFromLine, CalendarClock, CheckCircle2, ChevronDown, CircleHelp, Info,
  FlaskConical, Landmark, ShieldCheck, X, Sparkles, TrendingDown, TrendingUp, Wallet,
} from 'lucide-react'
import { formatINR, splitFundName } from '../../data/familyData'
import { getRecommendedAllocation } from '../../data/glidePath'
import { useData } from '../../context/DataContext'
import { useToast } from '../../context/ToastContext'
import Modal from '../../components/Modal'
import FundSearchInput from '../../components/forms/FundSearchInput'
import MFSwitchForm from '../../components/forms/MFSwitchForm'
import MFRedeemForm from '../../components/forms/MFRedeemForm'
import BucketHowItWorks from '../../components/buckets/BucketHowItWorks'
import { allocateBucketWithdrawal } from '../../utils/retirementBuckets'
import { buildBucketRefillPlan } from '../../utils/bucketRefill'
import { attributeFamilyGoals } from '../../utils/goalAttribution'

const BUCKET = {
  b1: { name: 'Income', long: 'Income bucket', icon: Wallet, text: 'text-emerald-400', soft: 'bg-emerald-500/10', bar: 'bg-emerald-500/60', border: 'border-emerald-500/40', holds: 'Liquid and short-term debt funds' },
  b2: { name: 'Stability', long: 'Stability bucket', icon: ShieldCheck, text: 'text-amber-400', soft: 'bg-amber-500/10', bar: 'bg-amber-500/55', border: 'border-amber-500/40', holds: 'Hybrid and medium-term debt funds' },
  b3: { name: 'Growth', long: 'Growth bucket', icon: TrendingUp, text: 'text-violet-400', soft: 'bg-violet-500/10', bar: 'bg-violet-500/60', border: 'border-violet-500/40', holds: 'Equity funds' },
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
  const order = ['b3', 'b2', 'b1'] // left to right in the order money flows: Growth → Stability → Income
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
          <p className="text-sm font-bold text-[var(--text-primary)]">Retirement buckets · this year's refill</p>
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


/**
 * The retirement buckets' actions, shown on the Goals page (the separate buckets page is gone):
 * One row on the retirement card: "How it works", plus "Refill now" when this year's refill / build step is due
 * (with Record switch) and "Income plan" after retirement (with Record redemption). Each opens in a window.
 */
export function RetirementActions({ goal, slot = 'alert' }) {
  const data = useData()
  const { goalList, goalPortfolioMappings, mfHoldings, mfPortfolios, mfTransactions, assetAllocations, otherInvList, stockHoldings, switchMF, redeemMF } = data
  const { showToast, showBlockUI, hideBlockUI } = useToast()
  const [switchDraft, setSwitchDraft] = useState(null)
  const [redeemDraft, setRedeemDraft] = useState(null)
  const [session, setSession] = useState(null)
  const [open, setOpen] = useState(null) // 'refill' | 'income' | 'how'
  const goalAttribution = useMemo(() => {
    const allocMap = {}
    for (const a of (assetAllocations || [])) if (a.assetAllocation) allocMap[a.fundCode] = a.assetAllocation
    return attributeFamilyGoals({ goals: (goalList || []).filter(g => g.isActive !== false), mappings: goalPortfolioMappings,
      mfHoldings, stockHoldings, otherInvList: (otherInvList || []).filter(i => i.status !== 'Inactive'), allocMap })
  }, [goalList, goalPortfolioMappings, mfHoldings, stockHoldings, otherInvList, assetAllocations])
  const plan = useMemo(() => {
    if (!goal) return null
    const yearsLeft = goal.targetDate ? Math.max(0, (new Date(goal.targetDate) - new Date()) / (365.25 * 864e5)) : 0
    return buildBucketRefillPlan({ goal, mappings: goalPortfolioMappings, holdings: mfHoldings, portfolios: mfPortfolios, assetAllocations,
      targetEquityPct: getRecommendedAllocation('Retirement', yearsLeft).equity, lastBucketMoveDate: lastBucketMove(mfTransactions, goal),
      otherInvestments: otherInvList || [], attribution: goalAttribution[goal.goalId] })
  }, [goal, goalPortfolioMappings, mfHoldings, mfPortfolios, mfTransactions, assetAllocations, otherInvList, goalAttribution])
  const noPlan = !plan || plan.noExpenses || plan.status === 'not-started'
  const canRecord = !noPlan && (plan.schedule.retired || BUILD_STATUSES.has(plan.status))
  const active = session && session.goalId === goal.goalId ? session : null
  const ops = active?.ops || (noPlan ? [] : plan.operations)
  const recorded = active?.done || EMPTY_SET
  const showRefill = !noPlan && (!!active || (ops.length > 0 && plan.status !== 'not-due'))
  const showIncome = !noPlan && plan.schedule.retired && plan.totals.b1 > 1
  const refillTotal = ops.reduce((t, op) => t + (op.fundedAmount || 0), 0)
  const monthly = plan?.expense?.monthlyExpense || 0
  // a short line on the retirement card; the full steps open in a window (like the Withdraw plan)
  if (slot === 'alert' && !showRefill) return null
  return (
    <>
      {/* link rows like the card's other rows; the refill row shows only when a refill is due, and draws the eye */}
      {slot === 'pills' && <>
        <button type="button" className="g2-pill" onClick={() => setOpen('how')}><CircleHelp size={14} /> How buckets work</button>
        {showIncome && <button type="button" className="g2-pill" onClick={() => setOpen('income')}><Wallet size={14} /> Monthly income · {formatINR(Math.round(monthly))}</button>}
      </>}
      {slot === 'alert' && showRefill && (
        <button type="button" className="g2-lrow due" onClick={() => setOpen('refill')}>
          <span><i className="g2-dot" />Refill plan · {formatINR(Math.round(refillTotal))} due<small>{ops.map(op => `${BUCKET[op.from].name} → ${BUCKET[op.to].name}`).join(' · ')}</small></span><em>Refill now ›</em>
        </button>
      )}
      {open === 'how' && createPortal(<Modal open onClose={() => setOpen(null)} title="How the 3 buckets work" maxWidth="max-w-2xl" maxHeight="max-h-[90vh]"><BucketHowItWorks /></Modal>, document.body)}
      {(open === 'refill' || open === 'income') && createPortal(<Modal open onClose={() => setOpen(null)} title={open === 'refill' ? 'Retirement buckets · yearly refill' : "This month's income"} wide maxHeight="max-h-[90vh]">
        <div className="space-y-3">
      {open === 'refill' && (
        <RefillSteps key={goal.goalId} plan={plan} operations={ops} canRecord={canRecord} recorded={recorded}
          onRecordSwitch={({ lineKey, op, allocation, dest }) => setSwitchDraft({
            lineKey, opsSnapshot: ops, portfolioId: allocation.portfolioId,
            initial: { fromPortfolioId: allocation.portfolioId, toPortfolioId: dest.portfolioId || allocation.portfolioId, fromFundCode: allocation.schemeCode, fromFundName: allocation.fundName,
              toFundCode: dest.schemeCode, toFundName: dest.fundName, units: unitsDown(allocation.units), fromPrice: allocation.currentNav ? String(allocation.currentNav) : '',
              toPrice: dest.currentNav ? String(dest.currentNav) : '',
              notes: `${op.reason === 'build-step' ? 'Retirement bucket build' : 'Retirement bucket refill'}: ${BUCKET[op.from].name} to ${BUCKET[op.to].name} (${goal.goalName})` },
          })} />
      )}
      {open === 'income' && (
        <MonthlyWithdrawal key={`w-${goal.goalId}`} plan={plan}
          onRecordRedeem={a => setRedeemDraft({ portfolioId: a.portfolioId, fundCode: a.schemeCode, initial: { units: unitsDown(a.units), notes: `Retirement monthly income (${goal.goalName})` } })} />
      )}
        </div>
      </Modal>, document.body)}
      {createPortal(<>
        <Modal open={!!switchDraft} onClose={() => setSwitchDraft(null)} title="Record switch" wide>
          {switchDraft && (
            <MFSwitchForm key={switchDraft.lineKey} portfolioId={switchDraft.portfolioId} initial={switchDraft.initial}
              onCancel={() => setSwitchDraft(null)}
              onSave={async d => {
                showBlockUI('Recording switch...')
                try {
                  await switchMF(d)
                  const lines = switchDraft.opsSnapshot.reduce((n, op) => n + op.allocations.length, 0)
                  const next = new Set(recorded).add(switchDraft.lineKey)
                  setSwitchDraft(null)
                  if (next.size >= lines) { setSession(null); showToast('All switches recorded. Refill done.') }
                  else { setSession({ goalId: goal.goalId, ops: switchDraft.opsSnapshot, done: next }); showToast(`Switch recorded (${next.size} of ${lines})`) }
                } catch (err) { showToast(err.message || 'Failed to record switch', 'error') } finally { hideBlockUI() }
              }} />
          )}
        </Modal>
        <Modal open={!!redeemDraft} onClose={() => setRedeemDraft(null)} title="Record redemption" wide>
          {redeemDraft && (
            <MFRedeemForm key={`${redeemDraft.portfolioId}-${redeemDraft.fundCode}`} portfolioId={redeemDraft.portfolioId} fundCode={redeemDraft.fundCode} initial={redeemDraft.initial}
              onCancel={() => setRedeemDraft(null)}
              onSave={async d => {
                showBlockUI('Recording redemption...')
                try { await redeemMF(d); setRedeemDraft(null); showToast('Redemption recorded') }
                catch (err) { showToast(err.message || 'Failed to record redemption', 'error') } finally { hideBlockUI() }
              }} />
          )}
        </Modal>
      </>, document.body)}
    </>
  )
}

/** "How the 3 buckets work" in a window (used by the retirement card on the Goals page). */
export function BucketHelpLink({ className = '' }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-violet-400 hover:text-violet-300 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg transition-colors ${className}`}>
        <CircleHelp size={14} /> How it works
      </button>
      {open && createPortal(<Modal open onClose={() => setOpen(false)} title="How the 3 buckets work" maxWidth="max-w-2xl" maxHeight="max-h-[90vh]"><BucketHowItWorks /></Modal>, document.body)}
    </>
  )
}

/** The buckets now live in the retirement card on the Goals page; old links land there. */
export default function RetirementBucketsPage() { return <Navigate to="/goals" replace /> }
