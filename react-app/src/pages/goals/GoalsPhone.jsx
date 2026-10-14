// Goals on phones (Ionic, Groww-style): a summary card, this month's steps as a row that opens its own screen,
// a flat goal list, and a page per goal (numbers, action steps, buckets, funds, and the road on its own screen).
// Same plan and steps as the desktop Goals page (GoalsPlanPage passes everything in).
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import '../../phone/ionic-setup'
import { IonList, IonItem, IonLabel, IonButton, IonActionSheet, IonListHeader } from '@ionic/react'
import { Plus, MoreVertical, ListChecks, Layers, Wallet } from 'lucide-react'
import { Screen, setPhoneBar } from '../../components/native'
import { Step, GOALS_HOME_CSS, Buckets, AsideCtx } from './GoalsHome'
import { L, icon, gapTxt, realSteps, pctSaved, StepRow, GP_CSS, BucketsPanel, PlanByYear } from './GoalsPlanPage'
import { RetirementActions } from './RetirementBucketsPage'
import Modal from '../../components/Modal'
import PhoneTabs from '../../phone/PhoneTabs'

const yearOf = (g) => new Date(g.targetDate).getFullYear()
const left = (p) => (p.isRet && p.years <= 0 ? 'retired' : p.years <= 0 ? 'date reached' : p.years < 1 ? `${Math.max(1, Math.round(p.years * 12))} mo left` : `${Math.round(p.years * 2) / 2} yrs left`)
const tone = (p) => (p.state === 'due' && !p.isRet ? ['Ready', '#60a5fa'] : p.state === 'short' ? [`${L(-p.gap)} short`, '#f59e0b'] : ['On track', '#34d399'])

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
      <IonList lines="full" className="cf-flat -mx-4">
        {sorted.map((p) => {
          const [t, c] = tone(p)
          const n = realSteps(p).length
          return (
            // same row as a Mutual Funds portfolio: name and when on the left, what it has and how it is doing on the right
            <IonItem key={p.goal.goalId} button detail onClick={() => navigate(`/goals/plan/${encodeURIComponent(p.goal.goalId)}`)}>
              <IonLabel className="!my-3.5">
                <h3 className="!text-[16px] !font-semibold !whitespace-normal">{mt(p.goal.goalName)}</h3>
                <p>{L(p.target)} by {yearOf(p.goal)} · {left(p)}{n > 0 && <span className="text-amber-400"> · {n} step{n > 1 ? 's' : ''}</span>}</p>
                <div className="mt-2 h-1.5 w-full max-w-[180px] overflow-hidden rounded-full bg-[var(--ion-color-step-150)]"><div className="h-full rounded-full" style={{ width: `${Math.min(100, pctSaved(p))}%`, background: c }} /></div>
              </IonLabel>
              <div slot="end" className="ml-2 shrink-0 text-right tabular-nums">
                <div className="text-[15px] font-semibold text-[var(--ion-text-color)]">{L(p.has)}</div>
                <div className="mt-0.5 text-[12.5px] font-semibold" style={{ color: c }}>{pctSaved(p)}% · {t}</div>
              </div>
            </IonItem>
          )
        })}
      </IonList>
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

// ── one goal ──
function GoalScreen({ p, ctx, todo, onEdit, openView }) {
  const { mt, navigate, pname } = ctx
  const g = p.goal
  const [menu, setMenu] = useState(false)
  const [bk, setBk] = useState(false)
  const [tab, setTab] = useState('overview')
  const gp = gapTxt(p)
  const own = (todo?.steps || []).filter((x) => (x.t === 'protect' || x.t === 'ready') && x.goal?.goalId === g.goalId) // family-plan steps that belong to this goal
  const st = realSteps(p).filter((x) => !own.some((o) => o.t === x.t)) // the same step is not shown twice
  const retired = p.isRet && p.years <= 0
  const items = useMemo(() => (p.att?.items || []).filter((it) => it.value > 0.5).sort((a, b) => b.value - a.value), [p])
  const right = useMemo(() => <IonButton className="cf-icon-btn" onClick={() => setMenu(true)} aria-label="More"><MoreVertical size={22} /></IonButton>, [])
  return (
    <Screen k={g.goalId} title={`${icon(g)} ${mt(g.goalName)}`} subtitle={`${new Date(g.targetDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })} · ${left(p)}`} onBack={() => navigate('/goals')} right={right}>
      <div className="pb-6">
        <PhoneTabs value={tab} onChange={setTab} options={[['overview', 'Overview', own.length + st.length], ['plan', 'Plan by year'], ['funds', `Investments (${items.length})`]]} />
        {tab === 'overview' && <>
        <Card className="mt-3">
          <div className="flex items-center gap-4">
            <Ring p={p} size={58} />
            <div>
              <div className="text-[12px] font-semibold tracking-[0.14em] text-[var(--ion-color-medium)]">HAVE TODAY</div>
              <div className="text-[26px] font-bold tracking-tight tabular-nums">{L(p.has)}</div>
              <div className="text-[13px] text-[var(--ion-color-medium)]">of {L(p.target)} by {yearOf(g)}</div>
            </div>
          </div>
          <Dash />
          <KV k="Should have today" v={L(p.need)} />
          <KV k="Gap" v={gp[0]} cls={p.state === 'short' ? 'text-amber-400' : 'text-emerald-400'} />
          {p.eqNow != null && <KV k="Equity now · plan" v={`${p.eqNow}% · ${p.eqTarget}%`} cls={Math.abs(p.eqNow - p.eqTarget) >= 5 ? 'text-amber-400' : ''} />}
          <Dash />
          {p.lumpToday > 0
            ? <><KV k="SIP needed / month" v={L(p.sipNeeded)} cls="text-violet-300" /><KV k="or lump sum today" v={L(p.lumpToday)} /></>
            : <KV k="Monthly SIP" v={p.sip ? `${L(p.sip)} · covered` : 'Covered'} cls="text-emerald-400" />}
        </Card>

        {p.isRet && <div className="mt-3"><RetirementActions goal={g} slot="alert" /></div>}

        <IonListHeader className="!pl-1"><IonLabel className="cf-group">Action required</IonLabel></IonListHeader>
        {own.length > 0 && <div className="g2 mb-3"><style>{GOALS_HOME_CSS}</style>{own.map((s, i) => <Step key={i} s={s} n={i + 1} mt={mt} pname={pname} closeGoal={ctx.closeGoal} navigate={navigate} />)}</div>}
        {st.length ? (
          <div className="gp"><style>{GP_CSS}</style>
            <div className="gp-grp">{st.map((s, i) => <StepRow key={i} s={s} p={p} n={i + 1} mt={mt} pname={pname} onRebalance={ctx.openRebalance} onClose={ctx.closeGoal} navigate={navigate} />)}</div>
            <p className="text-[12px] text-[var(--ion-color-medium)] mt-2">Sell in units you hold. Buy in ₹, because the units depend on that day's NAV.</p>
          </div>
        ) : own.length ? null : <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-[14px]">✓ Nothing to do now.{p.sip > 0 ? ` Keep your SIP ${L(p.sip)}/month.` : ''}</div>}

        </>}
        {tab === 'plan' && <>
        <div className="gp mt-3"><style>{GP_CSS}</style><PlanByYear p={p} /></div>
        {!p.isRet && Math.max(1, Number(g.payYears) || 1) === 1 && <p className="mt-3 px-1 text-[13px] text-[var(--ion-color-medium)]">Paid over several years (like college fees)? Edit the goal and set Withdraw to "Over 4 years": each year's part then gets its own glide path.</p>}

        <Rows rows={[
          p.isRet && [Layers, retired ? 'Your buckets today' : 'Retirement buckets', retired ? 'Income, Stability and Growth jars, monthly income' : 'How the money moves into 3 jars before you retire', '#34d399', () => setBk(true)],
        ].filter(Boolean)} />
        {p.isRet && <div className="mt-2"><RetirementActions goal={g} slot="pills" /></div>}
        </>}
        {tab === 'funds' && <>
        <IonListHeader className="!pl-1"><IonLabel className="cf-group">{L(p.has)} · {p.eqNow ?? '—'}% equity</IonLabel></IonListHeader>
        <IonList lines="full" className="cf-flat -mx-4">
          {items.map((it) => {
            const h = it.holding
            const name = it.kind === 'mf' ? String(h.fundName || '').replace(/\s*-\s*(Direct|Regular).*$/i, '') : it.kind === 'stock' ? (h.symbol || h.stockName) : mt(h.investmentName || h.investmentType || 'Investment')
            return (
              <IonItem key={it.key}>
                <IonLabel className="!my-3"><h3 className="!text-[15px] !font-medium !whitespace-normal">{name}</h3><p>{Math.round((it.eq || 0) * 100)}% equity{it.portfolioId && pname(it.portfolioId) ? ` · ${pname(it.portfolioId)}` : ''}{it.fraction != null && it.fraction < 0.999 ? ` · ${Math.round(it.fraction * 100)}% for this goal` : ''}</p></IonLabel>
                <div slot="end" className="text-[15px] font-semibold tabular-nums">{L(it.value)}</div>
              </IonItem>
            )
          })}
        </IonList>
        {!items.length && <p className="py-6 text-center text-[14px] text-[var(--ion-color-medium)]">No investments counted for this goal yet. Open Money for goals.</p>}
        </>}
      </div>
      <IonActionSheet isOpen={menu} onDidDismiss={() => setMenu(false)} header={mt(g.goalName)} buttons={[
        { text: 'Edit goal', handler: () => onEdit(g) },
        p.state === 'due' && !p.isRet && { text: 'Money withdrawn: close goal', handler: () => ctx.closeGoal(g, 'used') },
        { text: 'Not needed: close goal', role: 'destructive', handler: () => ctx.closeGoal(g, 'not-needed') },
        { text: 'Cancel', role: 'cancel' },
      ].filter(Boolean)} />
      <Modal open={bk} onClose={() => setBk(false)} title={retired ? 'Your buckets today' : 'Retirement buckets'} wide>
        {bk && <div className="gp g2"><style>{GP_CSS + GOALS_HOME_CSS}</style>{retired || p.bucketMode ? <Buckets p={p} items={items} retired={retired} mt={mt} pname={pname} /> : <BucketsPanel p={p} />}</div>}
      </Modal>
    </Screen>
  )
}
