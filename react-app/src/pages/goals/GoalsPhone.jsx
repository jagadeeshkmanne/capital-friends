// Goals on phones (Ionic, Groww-style): a summary card, this month's steps as a row that opens its own screen,
// a flat goal list, and a page per goal (numbers, action steps, buckets, funds, and the road on its own screen).
// Same plan and steps as the desktop Goals page (GoalsPlanPage passes everything in).
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import '../../phone/ionic-setup'
import { IonList, IonItem, IonLabel, IonButton, IonActionSheet, IonListHeader, IonRippleEffect } from '@ionic/react'
import { Plus, MoreVertical, ListChecks, Layers, Wallet, ShieldCheck, CheckCircle2, TrendingUp } from 'lucide-react'
import { Screen, setPhoneBar } from '../../components/native'
import { Step, GOALS_HOME_CSS, Buckets, AsideCtx } from './GoalsHome'
import { L, icon, gapTxt, realSteps, pctSaved, StepRow, GP_CSS, BucketsPanel, PlanByYear } from './GoalsPlanPage'
import { goalRoad } from '../../utils/goalPlan'

/** one short line about the next glide-path move of a goal (for the Plan by year row) */
function goalRoadNext(p) {
  try {
    const r = goalRoad(p).find((x) => x.k === 'safer' || x.k === 'bucket' || x.k === 'goal')
    if (!r) return null
    if (r.k === 'safer') return `${r.y}: move about ${L(r.amount)} to safe funds (${r.eq0}% → ${r.eq}% equity)`
    if (r.k === 'bucket') return `${r.y0}–${r.y}: fill the buckets each quarter`
    return `${r.y}: ${p.isRet ? 'start the monthly income' : 'withdraw'}`
  } catch { return null }
}
import { RetirementActions, useRetirementDue } from './RetirementBucketsPage'
import Modal from '../../components/Modal'
import WithdrawPanel from './WithdrawPanel'
import PhoneTabs from '../../phone/PhoneTabs'

const yearOf = (g) => new Date(g.targetDate).getFullYear()
const left = (p) => (p.isRet && p.years <= 0 ? 'retired' : p.years <= 0 ? 'date reached' : p.years < 1 ? `${Math.max(1, Math.round(p.years * 12))} mo left` : `${Math.round(p.years * 2) / 2} yrs left`)
const tone = (p) => { const g = gapTxt(p); return p.state === 'due' && !p.isRet ? ['Ready', '#60a5fa'] : /short/.test(g[0]) ? [g[0], '#f59e0b'] : ['On track', '#34d399'] } // same words as the goal page

function KV({ k, v, cls = '' }) {
  return <div className="flex items-baseline justify-between gap-3 py-[7px]"><span className="text-[15px] text-[var(--ion-text-color)]">{k}</span><span className={`text-[15px] font-semibold tabular-nums text-right ${cls || 'text-[var(--ion-text-color)]'}`}>{v}</span></div>
}
const Dash = () => <div className="my-2 border-t border-dashed border-[var(--ion-color-step-250)]" />
const Card = ({ children, className = '' }) => <div className={`rounded-2xl border border-[var(--ion-border-color)] bg-[var(--ion-item-background)] px-4 pt-4 pb-2 ${className}`}>{children}</div>

function Ring({ p, size = 44 }) {
  const sw = 4, r = (size - sw) / 2, c = 2 * Math.PI * r, f = pctSaved(p) / 100
  return (
    <span slot="start" className="relative inline-block shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size}><circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--ion-color-step-150)" strokeWidth={sw} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={tone(p)[1]} strokeWidth={sw} strokeLinecap="round" strokeDasharray={`${c * f} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} /></svg>
      <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold">{pctSaved(p)}%</span>
    </span>
  )
}

function Rows({ rows }) {
  if (!rows.length) return null
  return (
    <IonList lines="full" className="cf-flat -mx-4 mt-2">
      {rows.map(([I, t, sub, c, fn]) => (
        <IonItem key={t} button={!!fn} detail={!!fn} onClick={fn}>
          <span slot="start" className="flex h-9 w-9 items-center justify-center rounded-full" style={{ background: `${c}22`, color: c }}><I size={18} /></span>
          <IonLabel className="!my-3"><h3 className="!text-[15px] !font-semibold !whitespace-normal">{t}</h3>{sub && <p className="!whitespace-normal">{sub}</p>}</IonLabel>
        </IonItem>
      ))}
    </IonList>
  )
}

export default function GoalsPhone(props) {
  const { plan, sel } = props
  const [sp, setSp] = useSearchParams()
  const navigate = useNavigate()
  const view = sp.get('v')
  const back = () => (window.history.state?.idx > 0 ? navigate(-1) : setSp({}))
  const openView = (v) => setSp({ v })
  const aside = props.ctx?.aside || {}
  // set-aside money (goal date reached) reaches every Step / withdraw card through this context
  const body = sel ? <GoalScreen key={sel.goal.goalId} {...props} p={sel} openView={openView} />
    : view === 'steps' ? <StepsScreen {...props} back={back} />
    : <GoalsRoot {...props} openView={openView} plan={plan} />
  return <AsideCtx.Provider value={aside}>{body}</AsideCtx.Provider>
}

// ── all goals ──
function GoalsRoot({ plan, todo, pool, shown, ctx, onAdd, onEditList, onMoney, openView, closed = [] }) {
  const { mt, navigate, pname, closeGoal } = ctx
  const [menu, setMenu] = useState(false)
  const [tab, setTab] = useState('goals')
  useEffect(() => {
    setPhoneBar({ right: <>
      <IonButton className="cf-icon-btn" onClick={onAdd} aria-label="Add goal"><Plus size={24} /></IonButton>
      <IonButton className="cf-icon-btn" onClick={() => setMenu(true)} aria-label="More"><MoreVertical size={22} /></IonButton>
    </> })
    return () => setPhoneBar(null)
  }, [onAdd])
  const live = shown
  const has = live.reduce((t, p) => t + p.has, 0), need = live.reduce((t, p) => t + (p.state === 'due' ? p.has : p.need), 0)
  const short = live.filter((p) => p.state === 'short').reduce((t, p) => t - p.gap, 0)
  const extra = pool.extra || 0
  const asideNow = Object.values(ctx.aside || {}).reduce((t, a) => t + (a.now || 0), 0)
  const steps = todo.steps.filter((x) => x.t === 'cash' || x.t === 'switch' || x.t === 'protect')
  const ready = todo.steps.filter((x) => x.t === 'ready')
  const shortStep = todo.steps.find((x) => x.t === 'short')
  const sorted = [...live].sort((a, b) => yearOf(a.goal) - yearOf(b.goal))
  if (!live.length) {
    return (
      <div className="flex flex-col items-center gap-3 px-6 pt-20 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-violet-500/15 text-3xl">🎯</span>
        <p className="text-[17px] font-semibold">No goals yet</p>
        <p className="text-[14px] text-[var(--ion-color-medium)]">Retirement, a child's education, a home. Add one and the app shows how much to invest.</p>
        <IonButton onClick={onAdd} className="mt-2"><Plus size={18} className="mr-1.5" />Add a goal</IonButton>
      </div>
    )
  }
  const nToDo = steps.length + ready.length + (shortStep ? 1 : 0)
  const monthSteps = todo.steps.filter((x) => x.t === 'cash' || x.t === 'switch' || x.t === 'protect' || x.t === 'short' || x.t === 'ready')
  return (
    <div className="pb-6">
      <PhoneTabs value={tab} onChange={setTab} options={[['goals', `Goals (${live.length})`], ['steps', 'This month', nToDo]]} />
      {tab === 'steps' && (
        <div className="g2 pt-2"><style>{GOALS_HOME_CSS}</style>
          <p className="text-[13px] text-[var(--ion-color-medium)] pb-3">Do these in order. Before you start, import your latest CAS if you bought or sold since, so the units and amounts are today's.</p>
          {monthSteps.length ? monthSteps.map((s, i) => <div key={i} className="mb-3"><Step s={s} n={i + 1} mt={mt} pname={pname} closeGoal={closeGoal} navigate={navigate} /></div>)
            : <p className="py-10 text-center text-[var(--ion-color-medium)]">✓ Nothing to do this month. Keep your SIPs running.</p>}
        </div>
      )}
      {tab === 'goals' && <>
      <Card className="mt-3">
        <div className="text-[12px] font-semibold tracking-[0.14em] text-[var(--ion-color-medium)]">GOALS ({live.length})</div>
        <div className="mt-0.5 text-[28px] font-bold tracking-tight tabular-nums">{L(has)}</div>
        <div className="text-[13px] text-[var(--ion-color-medium)]">kept for your goals today</div>
        <Dash />
        <KV k="Need today" v={L(need)} />
        <KV k="Gap" v={short > 1000 ? `${L(short)} short` : 'On track'} cls={short > 1000 ? 'text-amber-400' : 'text-emerald-400'} />
        <KV k="SIPs running" v={`${L(todo.runningSip)}/mo`} />
        {asideNow > 1000 && <KV k="Set aside (date reached)" v={L(asideNow)} />}
        {extra > 1000 && <KV k="Free money · liquid" v={L(extra)} cls="text-sky-400" />}
        {ctx.netWorth > 0 && <><Dash /><KV k="Net worth" v={L(ctx.netWorth)} /><KV k="Not for goals" v={L(Math.max(0, ctx.netWorth - has - Math.max(0, extra)))} cls="text-[var(--ion-color-medium)]" /></>}
      </Card>
      <Rows rows={[
        nToDo > 0 && [ListChecks, `${nToDo} thing${nToDo > 1 ? 's' : ''} to do this month`, [steps.length && 'make goals safer / rebalance', ready.length && 'money ready to withdraw', shortStep && `${L(shortStep.gap)} short`].filter(Boolean).join(' · '), '#f59e0b', () => setTab('steps')],
        [Wallet, 'Money for goals', 'Which investments count for your goals', '#a78bfa', onMoney],
      ].filter(Boolean)} />
      <IonListHeader className="!pl-1"><IonLabel className="cf-group">Your goals</IonLabel></IonListHeader>
      {/* the same goal cards as the laptop, made smaller: a year stop on the road, then the card */}
      <div className="mt-1">
        {/* the road starts today; nearest goal first */}
        <div className="flex flex-col items-center">
          <span className="rounded-full border border-[var(--ion-border-color)] bg-[var(--ion-item-background)] px-3 py-1 text-[12.5px] font-semibold text-[var(--ion-text-color)]">📍 Today · {new Date().toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</span>
        </div>
        {sorted.map((p) => <GoalCard key={p.goal.goalId} p={p} mt={mt} nTodo={todo.steps.filter((x) => (x.t === 'protect' || x.t === 'ready') && x.goal?.goalId === p.goal.goalId).length} onOpen={() => navigate(`/goals/plan/${encodeURIComponent(p.goal.goalId)}`)} />)}
      </div>
      {closed.length > 0 && <>
        <IonListHeader className="!pl-1 mt-2"><IonLabel className="cf-group">Completed · {closed.length}</IonLabel></IonListHeader>
        <IonList lines="full" className="cf-flat -mx-4">
          {closed.map((g) => {
            const nm = String(g.notes || ''), used = /withdrawn/i.test(nm)
            const when = (nm.match(/(?:Withdrawn|Not needed) on ([0-9/]+)/) || [])[1]
            const amt = (nm.match(/used (₹[0-9,]+)/) || [])[1]
            return (
              <IonItem key={g.goalId}>
                <IonLabel className="!my-3"><h3 className="!text-[15px] !font-medium !whitespace-normal">{mt(g.goalName)}</h3><p>{used ? `Withdrawn${amt ? ` · ${amt} used` : ''}` : 'Closed · not needed'}{when ? ` · ${when}` : ''}</p></IonLabel>
                <span slot="end" className={`text-[12.5px] font-semibold ${used ? 'text-emerald-400' : 'text-[var(--ion-color-medium)]'}`}>{used ? '✓ Done' : 'Closed'}</span>
              </IonItem>
            )
          })}
        </IonList>
      </>}
      </>}
      <IonActionSheet isOpen={menu} onDidDismiss={() => setMenu(false)} header="Goals" buttons={[
        { text: 'Add a goal', handler: onAdd },
        { text: 'Edit goals', handler: onEditList },
        { text: 'Money for goals', handler: onMoney },
        { text: 'Cancel', role: 'cancel' },
      ]} />
    </div>
  )
}

/** One goal, like the laptop card but compact: icon, name, when, status, ring; Have / Need / Gap / Goal amount;
 *  the equity mix against its glide path. A small year stop sits above it, like the road on the laptop. */
function GoalCard({ p, mt, onOpen, nTodo = 0 }) {
  const g = p.goal
  const [t, c] = tone(p)
  const gp = gapTxt(p)
  const n = realSteps(p).filter((x) => x.t !== 'ready').length + nTodo
  const eqOff = p.eqNow != null && !p.bucketMode ? p.eqNow - p.eqTarget : 0
  const due = new Date(g.targetDate)
  const Tile = ({ k, v, sub, cls = '' }) => (
    <div className="min-w-0 rounded-xl border border-[var(--ion-border-color)] bg-[var(--ion-background-color)] px-3 py-2.5">
      <div className="text-[12px] text-[var(--ion-color-medium)]">{k}</div>
      <div className={`mt-0.5 truncate text-[16px] font-bold tabular-nums ${cls || 'text-[var(--ion-text-color)]'}`}>{v}</div>
      {sub && <div className="truncate text-[11.5px] text-[var(--ion-color-medium)]">{sub}</div>}
    </div>
  )
  return (
    <div className="relative">
      <div className="flex flex-col items-center">
        {/* a piece of road: grey with a dashed middle line, like the laptop */}
        <div className="flex h-7 w-2.5 justify-center rounded-sm bg-[var(--ion-color-step-200)]"><div className="h-full w-0 border-l-2 border-dashed border-[var(--ion-color-step-400)]" /></div>
        <span className="rounded-full border-2 bg-[var(--ion-background-color)] px-2.5 py-0.5 text-[12.5px] font-bold tabular-nums" style={{ borderColor: c, color: 'var(--ion-text-color)' }}>{icon(g)} {due.getFullYear()}{p.years > 0 ? ` · ${left(p)}` : ''}</span>
        <div className="flex h-3 w-2.5 justify-center rounded-sm bg-[var(--ion-color-step-200)]"><div className="h-full w-0 border-l-2 border-dashed border-[var(--ion-color-step-400)]" /></div>
      </div>
      <button type="button" onClick={onOpen} className="ion-activatable relative w-full overflow-hidden rounded-2xl border border-[var(--ion-border-color)] bg-[var(--ion-item-background)] px-4 pt-3.5 pb-3 text-left">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-[16px] font-semibold leading-snug text-[var(--ion-text-color)]">{mt(g.goalName)}</div>
            <div className="mt-0.5 text-[13px] text-[var(--ion-color-medium)]">{due.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })} · {left(p)}{g.familyMemberName ? ` · ${mt(g.familyMemberName)}` : ''}</div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <span className="rounded-full px-2 py-0.5 text-[12px] font-semibold" style={{ background: `${c}22`, color: c }}>{p.state === 'achieved' ? 'Fully funded' : t}</span>
              {n > 0 && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[12px] font-semibold text-amber-400">{n} step{n > 1 ? 's' : ''}</span>}
            </div>
          </div>
          <Ring p={p} size={50} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Tile k="Have today" v={L(p.has)} sub="from the pool" />
          <Tile k="Need today" v={L(p.state === 'due' ? p.has : p.need)} sub={p.sip > 0 ? `with SIP ${L(p.sip)}/mo` : p.years > 0 ? 'no SIP' : 'all of it, today'} />
          <Tile k="Gap" v={<span style={{ color: gp[1] }}>{gp[0]}</span>} sub={/short/.test(gp[0]) ? (p.isRet && p.years <= 0 ? 'see the income plan' : 'add SIP or a lump sum') : 'nothing to add'} />
          <Tile k="Goal amount" v={L(p.target)} sub={`in ${due.getFullYear()}${Number(g.payYears) > 1 ? ` · over ${g.payYears} yrs` : ''}`} />
        </div>
        {p.eqNow != null && (
          <div className="mt-2.5 flex items-center justify-between gap-2 text-[13px] tabular-nums">
            <span className="text-[var(--ion-color-medium)]">Mix <b className="font-semibold text-[var(--ion-text-color)]">Equity {p.eqNow}%</b> · {p.bucketMode ? 'buckets plan' : `target ${p.eqTarget}%`}</span>
            {/* same rule as the laptop card: a quiet tick when within 10 points; when it is off, the goal's own step says what to do */}
            {!p.bucketMode && Math.abs(eqOff) <= 10 && <span className="font-semibold text-emerald-400">✓ On target</span>}
          </div>
        )}
        <IonRippleEffect />
      </button>
    </div>
  )
}

// ── this month's steps (all goals) ──
function StepsScreen({ todo, ctx, back }) {
  const { mt, pname, closeGoal, navigate } = ctx
  const steps = todo.steps.filter((x) => x.t === 'cash' || x.t === 'switch' || x.t === 'protect' || x.t === 'short')
  return (
    <Screen k="steps" title="This month" subtitle={`${steps.length} step${steps.length === 1 ? '' : 's'} · do them in order`} onBack={back}>
      <div className="g2 pb-6"><style>{GOALS_HOME_CSS}</style>
        <p className="text-[13px] text-[var(--ion-color-medium)] pt-2 pb-3">Before you act: import your latest CAS if you bought or sold since, so the units and amounts are today's.</p>
        {steps.length ? steps.map((s, i) => <div key={i} className="mb-3"><Step s={s} n={i + 1} mt={mt} pname={pname} closeGoal={closeGoal} navigate={navigate} /></div>)
          : <p className="py-10 text-center text-[var(--ion-color-medium)]">✓ Nothing to do this month</p>}
      </div>
    </Screen>
  )
}

/** One thing to do, in plain words: what (title), why (one line) and one button. The full steps (units to sell,
 *  where to buy, the withdraw list) open on their own page, so the goal page stays short. */
function ActionCard({ icon: I, color, title, why, button, onClick, children }) {
  return (
    <div className="mb-3 rounded-2xl border bg-[var(--ion-item-background)] px-4 py-3.5" style={{ borderColor: `${color}55` }}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ background: `${color}22`, color }}><I size={18} /></span>
        <div className="min-w-0 flex-1">
          <div className="text-[16px] font-semibold leading-snug text-[var(--ion-text-color)]">{title}</div>
          <div className="mt-1 text-[13.5px] leading-snug text-[var(--ion-color-medium)]"><b className="font-semibold text-[var(--ion-text-color)]">Why: </b>{why}</div>
        </div>
      </div>
      {children}
      {button && <button type="button" onClick={onClick} className="mt-3 w-full rounded-xl py-2.5 text-[15px] font-semibold text-white" style={{ background: color }}>{button}</button>}
    </div>
  )
}
/** The 3 retirement jars in one glance, one line each; "How it works" opens the full explanation. */
function BucketsGlance({ retired, onOpen, goal }) {
  const jars = [['Income', '#10b981', 'Next 2 years of spending', 'safe: liquid / short debt'], ['Stability', '#f59e0b', 'Years 3–7', 'hybrid and debt funds'], ['Growth', '#8b5cf6', 'Everything after that', 'equity: refills the other two']]
  return (
    <div className="mt-1 rounded-2xl border border-[var(--ion-border-color)] bg-[var(--ion-item-background)] px-4 py-3.5">
      <div className="flex items-center justify-between"><span className="text-[16px] font-semibold">{retired ? 'Your 3 buckets' : 'Retirement buckets'}</span>{onOpen && <button type="button" onClick={onOpen} className="text-[13px] font-semibold text-violet-400">{retired ? 'See jars ›' : 'See plan ›'}</button>}</div>
      <p className="mt-1 text-[13px] leading-snug text-[var(--ion-color-medium)]">{retired ? 'Your monthly income comes from Income. When it runs low, refill it from Stability; refill Stability from Growth after good years.' : 'In the last 5 years before you retire, the money moves into 3 jars, so a market fall never touches the money you will spend soon.'}</p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {jars.map(([n, c, a, b]) => (
          <div key={n} className="rounded-xl border px-2.5 py-2" style={{ borderColor: `${c}55`, background: `${c}12` }}>
            <div className="text-[13px] font-bold" style={{ color: c }}>{n}</div>
            <div className="mt-0.5 text-[12px] leading-snug text-[var(--ion-text-color)]">{a}</div>
            <div className="mt-0.5 text-[11px] leading-snug text-[var(--ion-color-medium)]">{b}</div>
          </div>
        ))}
      </div>
      <div className="g2 mt-2"><style>{GOALS_HOME_CSS}</style><RetirementActions goal={goal} slot="pills" /></div>
    </div>
  )
}

// ── one goal: one page, Action required first, then the numbers, then rows that open Plan by year / buckets / investments ──
function GoalScreen({ p, ctx, todo, onEdit }) {
  const { mt, navigate, pname } = ctx
  const g = p.goal
  const [menu, setMenu] = useState(false)
  const [bk, setBk] = useState(false)
  const [sub, setSub] = useState(null) // 'plan' | 'funds'
  const [detail, setDetail] = useState(null) // the step whose full steps are open
  const gp = gapTxt(p)
  const [t, c] = tone(p)
  const own = (todo?.steps || []).filter((x) => (x.t === 'protect' || x.t === 'ready') && x.goal?.goalId === g.goalId) // family-plan steps that belong to this goal
  const st = realSteps(p).filter((x) => !own.some((o) => o.t === x.t)) // the same step is not shown twice
  const retired = p.isRet && p.years <= 0
  const refillDue = useRetirementDue(p.isRet ? g : null)
  const nAct = own.length + st.length + (refillDue ? 1 : 0)
  const items = useMemo(() => (p.att?.items || []).filter((it) => it.value > 0.5).sort((a, b) => b.value - a.value), [p])
  const right = useMemo(() => <IonButton className="cf-icon-btn" onClick={() => setMenu(true)} aria-label="More"><MoreVertical size={22} /></IonButton>, [])
  const due = new Date(g.targetDate)
  const n = Math.max(1, Number(g.payYears) || 1)
  const nextMove = goalRoadNext(p)

  if (sub === 'plan') return (
    <Screen k={`${g.goalId}-plan`} title="Plan by year" subtitle={mt(g.goalName)} onBack={() => setSub(null)}>
      <div className="gp pb-6 pt-1"><style>{GP_CSS}</style><PlanByYear p={p} /></div>
      {!p.isRet && n === 1 && <p className="px-1 pb-6 text-[13px] text-[var(--ion-color-medium)]">Paid over several years (like college fees)? Edit the goal and set Withdraw to "Over 4 years": each year's part then gets its own glide path.</p>}
    </Screen>
  )
  if (sub === 'funds') return (
    <Screen k={`${g.goalId}-funds`} title={`Investments · ${items.length}`} subtitle={`${L(p.has)} · ${p.eqNow ?? '—'}% equity`} onBack={() => setSub(null)}>
      <IonList lines="full" className="cf-flat -mx-4 pb-6">
        {items.map((it) => {
          const h = it.holding
          const name = it.kind === 'mf' ? String(h.fundName || '').replace(/\s*-\s*(Direct|Regular).*$/i, '') : it.kind === 'stock' ? (h.companyName || h.symbol || h.stockName) : mt(h.investmentName || h.investmentType || 'Investment')
          return (
            <IonItem key={it.key}>
              <IonLabel className="!my-3"><h3 className="!text-[15px] !font-medium !whitespace-normal">{name}</h3><p>{Math.round((it.eq || 0) * 100)}% equity{it.portfolioId && pname(it.portfolioId) ? ` · ${pname(it.portfolioId)}` : ''}{it.fraction != null && it.fraction < 0.999 ? ` · ${Math.round(it.fraction * 100)}% for this goal` : ''}</p></IonLabel>
              <div slot="end" className="text-[15px] font-semibold tabular-nums">{L(it.value)}</div>
            </IonItem>
          )
        })}
      </IonList>
      {!items.length && <p className="py-6 text-center text-[14px] text-[var(--ion-color-medium)]">No investments counted for this goal yet. Open Money for goals.</p>}
    </Screen>
  )

  const Tile = ({ k, v, sub: s2 }) => (
    <div className="min-w-0 rounded-xl border border-[var(--ion-border-color)] bg-[var(--ion-background-color)] px-3 py-2.5">
      <div className="text-[12px] text-[var(--ion-color-medium)]">{k}</div>
      <div className="mt-0.5 truncate text-[17px] font-bold tabular-nums text-[var(--ion-text-color)]">{v}</div>
      {s2 && <div className="truncate text-[11.5px] text-[var(--ion-color-medium)]">{s2}</div>}
    </div>
  )
  return (
    <Screen k={g.goalId} title={`${icon(g)} ${mt(g.goalName)}`} subtitle={`${due.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })} · ${left(p)}${g.familyMemberName ? ` · ${mt(g.familyMemberName)}` : ''}`} onBack={() => navigate('/goals')} right={right}>
      <div className="pb-6">
        {/* the goal at a glance (same card as the goal list) */}
        <div className="mt-2 rounded-2xl border border-[var(--ion-border-color)] bg-[var(--ion-item-background)] px-4 pt-4 pb-3">
          <div className="flex items-center gap-4">
            <Ring p={p} size={62} />
            <div className="min-w-0">
              <div className="text-[12px] font-semibold tracking-[0.14em] text-[var(--ion-color-medium)]">HAVE TODAY</div>
              <div className="text-[28px] font-bold leading-tight tracking-tight tabular-nums">{L(p.has)}</div>
              <div className="text-[13px] text-[var(--ion-color-medium)]">of {L(p.target)} {retired ? '(retirement corpus)' : `by ${due.getFullYear()}`}{n > 1 ? ` · over ${n} yrs` : ''}</div>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="rounded-full px-2.5 py-0.5 text-[12px] font-semibold" style={{ background: `${c}22`, color: c }}>{p.state === 'achieved' ? 'Fully funded' : t}</span>
            {nAct > 0 && <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[12px] font-semibold text-amber-400">{nAct} action{nAct > 1 ? 's' : ''}</span>}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Tile k="Should have today" v={L(p.need)} sub={retired ? 'for the income plan' : p.sip > 0 ? `with SIP ${L(p.sip)}/mo` : 'no SIP running'} />
            <Tile k="Gap" v={<span style={{ color: gp[1] }}>{gp[0]}</span>} sub={/short/.test(gp[0]) ? (retired ? 'see the income plan' : `add ${L(p.sipNeeded)}/mo or ${L(p.lumpToday)} once`) : 'nothing to add'} />
          </div>
          {p.eqNow != null && (
            <div className="mt-2.5 flex items-center justify-between gap-2 text-[13px] tabular-nums">
              <span className="text-[var(--ion-color-medium)]">Mix <b className="font-semibold text-[var(--ion-text-color)]">Equity {p.eqNow}%</b> · {p.bucketMode ? 'buckets plan' : `target ${p.eqTarget}%`}</span>
              {!p.bucketMode && Math.abs(p.eqNow - p.eqTarget) <= 10 && <span className="font-semibold text-emerald-400">✓ On target</span>}
            </div>
          )}
          {p.isRet && <div className="g2"><style>{GOALS_HOME_CSS}</style><div className="g2-stats mt-2.5"><RetirementActions goal={g} slot="stat" /></div></div>}
        </div>

        {/* what to do now: everything for this goal in one place */}
        <IonListHeader className="!pl-1 mt-1"><IonLabel className="cf-group">Action required{nAct > 0 ? ` · ${nAct}` : ''}</IonLabel></IonListHeader>
        {nAct === 0 && <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-[14px]">✓ Nothing to do now.{!retired && p.sip > 0 ? ` Keep your SIP ${L(p.sip)}/month.` : ''}</div>}
        {refillDue && (
          <ActionCard icon={Layers} color="#f59e0b" title="Refill your Income bucket" why="Your monthly income is paid from the Income bucket. It is running low; move money into it from Stability (and Stability from Growth) as the steps show.">
            <div className="g2 mt-3"><style>{GOALS_HOME_CSS}</style><RetirementActions goal={g} slot="alert" /></div>
          </ActionCard>
        )}
        {[...own, ...st].map((s, i) => {
          const yl = s.years != null ? (s.years < 1 ? `${Math.max(1, Math.round(s.years * 12))} months` : `${Math.round(s.years * 2) / 2} years`) : left(p)
          if (s.t === 'protect') return <ActionCard key={i} icon={ShieldCheck} color="#f59e0b" title={`Make it safer: move ${L(s.total)}`} why={`only ${yl} to go and ${s.eqNow}% is in equity; the plan for now is ${s.eqTarget}%. A market fall now could cut the money you need, so move this part to a safe fund.`} button="See the steps" onClick={() => setDetail(s)} />
          if (s.t === 'ready') return <ActionCard key={i} icon={CheckCircle2} color="#3b82f6" title={n > 1 ? `Withdraw this year's part: ${L(Math.min(p.has, p.target / n))}` : `Withdraw ${L(p.has)}`} why={n > 1 ? `the first payment year has come. Take out this year's part; the other ${n - 1} stay invested.` : 'the goal date has come. Take the money out when you need it; until then it is set aside, safe, and still in your net worth.'} button="Withdraw" onClick={() => setDetail({ ...s, withdraw: true })} />
          if (s.t === 'sip') return <ActionCard key={i} icon={TrendingUp} color="#8b5cf6" title={`Add ${L(s.amount)} a month`} why={`at today's pace the goal is ${L(s.lump)} short. A bigger SIP (or ${L(s.lump)} once) closes the gap by ${due.getFullYear()}.`} button="See the steps" onClick={() => setDetail(s)} />
          return <ActionCard key={i} icon={ListChecks} color="#a78bfa" title={s.t === 'switch' ? 'Rebalance this goal' : 'Step to do'} why="the goal's mix is off its plan." button="See the steps" onClick={() => setDetail(s)} />
        })}

        {p.isRet && <><IonListHeader className="!pl-1 mt-2"><IonLabel className="cf-group">Buckets</IonLabel></IonListHeader><BucketsGlance retired={retired} goal={g} onOpen={() => setBk(true)} /></>}

        {/* more about this goal */}
        <IonListHeader className="!pl-1 mt-2"><IonLabel className="cf-group">More</IonLabel></IonListHeader>
        <Rows rows={[
          [ListChecks, 'Plan by year', nextMove || (n > 1 ? `How the money moves and the ${n} payments` : 'How the money moves to safe funds by the goal year'), '#a78bfa', () => setSub('plan')],
          [Wallet, `Investments · ${items.length}`, `${L(p.has)} · ${p.eqNow ?? '—'}% equity`, '#38bdf8', () => setSub('funds')],
        ].filter(Boolean)} />
      </div>
      <IonActionSheet isOpen={menu} onDidDismiss={() => setMenu(false)} header={mt(g.goalName)} buttons={[
        { text: 'Edit goal', handler: () => onEdit(g) },
        p.state === 'due' && !p.isRet && { text: 'Money withdrawn: close goal', handler: () => ctx.closeGoal(g, 'used') },
        { text: 'Not needed: close goal', role: 'destructive', handler: () => ctx.closeGoal(g, 'not-needed') },
        { text: 'Cancel', role: 'cancel' },
      ].filter(Boolean)} />
      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.withdraw ? `Withdraw · ${mt(g.goalName)}` : 'How to do it'} wide>
        {detail && (detail.withdraw
          ? <div className="g2"><style>{GOALS_HOME_CSS}</style><WithdrawPanel s={detail} mt={mt} pname={pname} onDone={(how, opts) => { setDetail(null); ctx.closeGoal(g, how, opts) }} onMoreTime={() => { setDetail(null); onEdit(g) }} /></div>
          : detail.t === 'protect'
            ? <div className="g2"><style>{GOALS_HOME_CSS}</style>
                <ol className="mb-4 space-y-1.5 rounded-2xl border border-[var(--ion-border-color)] bg-[var(--ion-item-background)] px-4 py-3 text-[14px] leading-snug">
                  <li><b>1.</b> Open your fund app ({pname(detail.portfolioId) || 'where these funds are'}).</li>
                  <li><b>2.</b> Use <b>Switch</b> (same fund house) or Redeem, for the units shown under SELL.</li>
                  <li><b>3.</b> Put that money into the fund under BUY (a liquid or short-term debt fund).</li>
                  <li><b>4.</b> Next time, import your CAS: the app updates the goal by itself.</li>
                </ol>
                <Step s={detail} n={1} mt={mt} pname={pname} closeGoal={ctx.closeGoal} navigate={navigate} /></div>
            : <div className="gp"><style>{GP_CSS}</style><div className="gp-grp"><StepRow s={detail} p={p} n={1} mt={mt} pname={pname} onRebalance={ctx.openRebalance} onClose={ctx.closeGoal} navigate={navigate} /></div><p className="text-[12px] text-[var(--ion-color-medium)] mt-2">Sell in units you hold. Buy in ₹, because the units depend on that day's NAV.</p></div>)}
      </Modal>
      <Modal open={bk} onClose={() => setBk(false)} title={retired ? 'Your buckets today' : 'Retirement buckets'} wide>
        {bk && <div className="gp g2"><style>{GP_CSS + GOALS_HOME_CSS}</style>{retired || p.bucketMode ? <Buckets p={p} items={items} retired={retired} mt={mt} pname={pname} /> : <BucketsPanel p={p} />}</div>}
      </Modal>
    </Screen>
  )
}
