import { Wallet, Pencil, Plus } from 'lucide-react'
// Main Goals page (/goals, goal detail at /goals/plan/:goalId; the classic page is /goals/classic): one road for all goals, this month's steps from today's fund
// values, and a page per goal with its own year-by-year road. The old Goals page is untouched.
// All numbers come from utils/goalPlan.js (tested in goalPlan.test.js).
import { useMemo, useRef, useLayoutEffect, useState, useId } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { formatINR, splitFundName } from '../../data/familyData'
import { useData } from '../../context/DataContext'
import { useFamily } from '../../context/FamilyContext'
import { useMaskText } from '../../hooks/useMaskText'
import PageLoading from '../../components/PageLoading'
import { useGoalPool } from '../../hooks/useGoalPoolSync'
import { useGoalsPlan } from '../../hooks/useGoalsPlan'
import MoneyForGoals from './MoneyForGoals'
import GoalsHome from './GoalsHome'
import Modal from '../../components/Modal'
import { useConfirm } from '../../context/ConfirmContext'
import { useToast } from '../../context/ToastContext'
import MFRebalanceDialog from '../../components/forms/MFRebalanceDialog'

const L = (v) => (v ? formatINR(Math.round(v)) : '—')
const U = (n) => Number(n).toLocaleString('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
const fname = (h) => (h ? splitFundName(h.fundName || h.schemeName || '').main : 'a fund of your choice')
const ICON = { Retirement: '🌴', Education: '🎓', Marriage: '💍', Home: '🏠', 'House Purchase': '🏠', 'Emergency Fund': '🛟', Vehicle: '🚗', Travel: '✈️' }
const icon = (g) => ICON[g.goalType] || '🎯'
const STATUS = { off: ['Off your plan', 'var(--accent-rose)'], step: ['Step due', 'var(--accent-amber)'], good: ['On plan', '#22c55e'] }
const gapTxt = (p) => p.state === 'short' ? [`${L(-p.gap)} short`, 'var(--accent-rose)'] : p.state === 'extra' ? [`${L(p.gap)} extra`, 'var(--accent-blue)'] : p.state === 'due' ? ['Due now', 'var(--accent-amber)'] : ['On plan', '#22c55e']
const realSteps = (p) => p.steps.filter((s) => s.t !== 'buckets')

export default function GoalsPlanPage() {
  const { goalId } = useParams()
  const navigate = useNavigate()
  const mt = useMaskText()
  const { selectedMember } = useFamily()
  const { goalList, mfHoldings, stockHoldings, otherInvList, assetAllocations, mfPortfolios, stockPortfolios, banks, liabilityList, updateGoal, updateGoalMappings } = useData()
  const confirm = useConfirm()
  const { showToast } = useToast()
  const closing = useRef(false)
  // goals take their money from one shared pool (Money for goals): the links are worked out, not entered
  const pool = useGoalPool()
  const goalPortfolioMappings = pool.mappings
  const [sp, setSp] = useSearchParams()
  const [moneyOpen, setMoneyOpen] = useState(() => sp.get('money') === '1')
  // net worth, worked out the same way as the Goals page header
  const netWorth = useMemo(() => {
    const act = (l) => (l || []).filter((x) => x.status === 'Active')
    const mfIds = new Set(act(mfPortfolios).map((p) => p.portfolioId)), stIds = new Set(act(stockPortfolios).map((p) => p.portfolioId))
    const sum = (l, k) => l.reduce((t, x) => t + (Number(x[k]) || 0), 0)
    return sum((mfHoldings || []).filter((h) => mfIds.has(h.portfolioId) && h.units > 0), 'currentValue') + sum((stockHoldings || []).filter((h) => stIds.has(h.portfolioId)), 'currentValue')
      + sum(act(otherInvList), 'currentValue') + sum(act(banks), 'balance') - sum(act(liabilityList), 'outstandingBalance')
  }, [mfHoldings, stockHoldings, otherInvList, banks, liabilityList, mfPortfolios, stockPortfolios])

  const { plan, todo } = useGoalsPlan()
  const active = useMemo(() => (goalList || []).filter((g) => g.isActive !== false), [goalList])
  const [rebal, setRebal] = useState(null)

  if (!plan) return <PageLoading title="Loading goals" />
  const shown = plan.goals.filter((p) => selectedMember === 'all' || p.goal.familyMemberId === selectedMember)
  const pname = (pid) => mt(((mfPortfolios || []).find((x) => x.portfolioId === pid)?.portfolioName || '').replace(/^PFL-/, ''))
  const closeGoal = async (g, how) => {
    // withdrawn / not needed: the goal stops taking money from the pool (its money goes back to the other goals)
    if (closing.current) return
    const used = how === 'used'
    const ok = await confirm(used
      ? `Close "${g.goalName}" as withdrawn? Also record the redemption in Mutual Funds (or update the holding), otherwise the money you took out still counts for your other goals.`
      : `Close "${g.goalName}" as not needed? Its money goes back to your other goals.`,
    { title: used ? 'Money withdrawn' : 'Goal not needed', confirmLabel: 'Close goal', destructive: false })
    if (!ok) return
    closing.current = true
    const note = `${used ? 'Withdrawn' : 'Not needed'} on ${new Date().toLocaleDateString('en-IN')}`
    try {
      // close first, then free its links (an open goal would just be given its share again)
      await updateGoal(g.goalId, { ...g, familyMember: g.familyMemberName || 'Self', isActive: false, notes: [g.notes, note].filter(Boolean).join(' · ') })
      await updateGoalMappings(g.goalId, [])
      showToast(`${g.goalName} closed. Its money now goes to your other goals.`)
    } catch (e) { showToast(e.message || 'Could not close the goal', 'error') }
    finally { closing.current = false }
  }
  const ctx = { mt, navigate, pname, netWorth, openRebalance: setRebal, closeGoal }
  const sel = goalId ? plan.goals.find((p) => p.goal.goalId === goalId) : null

  return (
    <div className="gp space-y-4">
      <style>{CSS}</style>
      <Modal open={!!rebal} onClose={() => setRebal(null)} title="Rebalance" wide>{rebal && <MFRebalanceDialog filterPortfolioId={rebal} />}</Modal>
      <Modal open={moneyOpen} onClose={() => { setMoneyOpen(false); if (sp.get('money')) { sp.delete('money'); setSp(sp, { replace: true }) } }} title="Money for goals" wide>{moneyOpen && <MoneyForGoals pool={pool} />}</Modal>
      {sel && <div className="gp-bar"><div><h1><a className="gp-back" onClick={() => navigate('/goals')}>← All goals</a></h1></div></div>}
      {sel ? <GoalDetail p={sel} ctx={ctx} /> : <GoalsHome actions={<><button className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-violet-400 hover:text-violet-300 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg transition-colors" onClick={() => setMoneyOpen(true)}><Wallet size={14} /> Money for goals</button>
          <button className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-violet-400 hover:text-violet-300 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg transition-colors" onClick={() => navigate('/goals/classic')}><Pencil size={14} /> Edit goals</button>
          <button className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-violet-400 hover:text-violet-300 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg transition-colors" onClick={() => navigate('/goals/classic?add=1')}><Plus size={14} /> Add Goal</button></>} plan={plan} todo={todo} pool={pool} closed={(goalList || []).filter((g) => g.isActive === false)} plans={shown} mfHoldings={mfHoldings} mfPortfolios={mfPortfolios} ctx={ctx} onMoney={() => setMoneyOpen(true)} />}
      {sel && <p className="gp-note">Steps are calculated from your own funds, your goal's expected return and the app's glide path. No fund recommendations.</p>}
    </div>
  )
}

/** Same header as the Goals page: net worth split, then target, have, gap, progress and SIP OR lump sum. */
function GoalsHeader({ plans, netWorth, extra = 0 }) {
  const target = plans.reduce((t, p) => t + p.target, 0), has = plans.reduce((t, p) => t + p.has, 0)
  const short = plans.filter((p) => p.lumpToday > 0)
  const sipNeed = short.reduce((t, p) => t + (p.sipNeeded || 0), 0), lump = short.reduce((t, p) => t + p.lumpToday, 0)
  const nw = Math.max(netWorth || 0, 0), free = Math.max(0, nw - has), pc = (v) => (nw > 0 ? Math.round((v / nw) * 100) : 0)
  const prog = target > 0 ? (has / target) * 100 : 0
  return (
    <>
      <div className="gp-panel gp-nw">
        <div><span className="gp-lbl">Total net worth</span><b className="gp-nwv">{L(nw)}</b></div>
        <div className="gp-nws">
          <div><span><i style={{ background: '#8b5cf6' }} />Allocated to goals</span><b style={{ color: 'var(--accent-violet)' }}>{L(has)} <small>({pc(has)}%)</small></b></div>
          <div><span><i style={{ background: 'var(--border)' }} />Unallocated surplus</span><b>{L(free)} <small>({pc(free)}%)</small></b>{extra > 1000 && <small style={{ display: 'block', color: 'var(--text-muted)', marginTop: 4 }}>{L(extra)} of it is in Money for goals but not needed yet: you could lower a SIP or add a goal</small>}</div>
        </div>
      </div>
      <div className="gp-tiles">
        <div className="gp-tile"><span className="gp-lbl">Target</span><b>{L(target)}</b></div>
        <div className="gp-tile"><span className="gp-lbl">Current value</span><b>{L(has)}</b></div>
        <div className="gp-tile"><span className="gp-lbl">Gap</span><b style={{ color: 'var(--accent-amber)' }}>{L(Math.max(0, target - has))}</b><small>{short.length ? 'target minus today' : 'your money + SIPs grow into it'}</small></div>
        <div className="gp-tile"><span className="gp-lbl">Progress</span><b style={{ color: 'var(--accent-amber)' }}>{prog.toFixed(1)}%</b><small>{plans.length} goal{plans.length > 1 ? 's' : ''}</small></div>
        <div className="gp-tile gp-tile-or">
          <div><span className="gp-lbl">SIP / month</span><b style={{ color: 'var(--accent-violet)' }}>{sipNeed ? L(sipNeed) : '—'}</b><small>{short.length ? `for ${short.length} short goal${short.length > 1 ? 's' : ''}` : 'on track: no extra SIP needed'}</small></div>
          <em>OR</em>
          <div style={{ textAlign: 'right' }}><span className="gp-lbl">Lump sum today</span><b style={{ color: 'var(--accent-amber)' }}>{lump ? L(lump) : '—'}</b><small>{short.length ? 'one time' : '\u00a0'}</small></div>
        </div>
      </div>
    </>
  )
}

/* ───────── list ───────── */
function GoalList({ plans, all, ctx }) {
  const { mt, navigate, pname } = ctx
  const tot = plans.reduce((s, p) => s + p.has, 0), sip = plans.reduce((s, p) => s + p.sip, 0)
  const withSteps = plans.filter((p) => realSteps(p).length)
  let n = 0
  if (!plans.length) return <div className="gp-panel"><p className="gp-hs">No goals yet. <a className="gp-link" onClick={() => navigate('/goals/classic?add=1')}>Add your first goal</a>.</p></div>
  return (
    <>
      <GoalsHeader plans={plans} netWorth={ctx.netWorth} extra={all.extra} />

      <div className="gp-panel">
        <div className="gp-ph"><h2>Action required</h2><span className="gp-hs">{(() => { const k = withSteps.reduce((s, p) => s + realSteps(p).length, 0); const fam = all.family?.status === 'steps' ? all.family.steps.filter((x) => ['sip-cut', 'sip-add', 'lump', 'sell', 'buy'].includes(x.t)).length : 0; const t = k + fam; return t ? `${t} step${t === 1 ? '' : 's'} this month${fam ? ' · family plan first' : ''} · based on today's fund values` : 'Nothing to do this month · based on today\'s fund values' })()}</span></div>
        {(withSteps.length || (all.family?.status === 'steps' && all.family.steps.some((x) => x.t !== 'note'))) ? <>
          <div className="gp-thd"><span /><span>Action</span><span>From</span><span /><span>To</span><span style={{ textAlign: 'right' }}>Amount</span></div>
          <FamilyBlock f={all.family} pname={pname} mt={mt} />{(() => { n = all.family?.status === 'steps' ? all.family.steps.filter((x) => ['sip-cut', 'sip-add', 'lump', 'sell', 'buy'].includes(x.t)).length : 0; return null })()}
          {withSteps.map((p) => {
            const [stt, sc] = STATUS[p.status]
            return (
              <div className="gp-grp" key={p.goal.goalId}>
                <div className="gp-gh" onClick={() => navigate(`/goals/plan/${encodeURIComponent(p.goal.goalId)}`)}>
                  <span>{icon(p.goal)}</span><b>{mt(p.goal.goalName)}</b><Dot c={sc}>{stt}</Dot><span className="gp-go">Open ›</span>
                </div>
                {realSteps(p).map((s, i) => <StepRow key={i} s={s} p={p} n={++n} mt={mt} pname={pname} onRebalance={ctx.openRebalance} onClose={ctx.closeGoal} navigate={navigate} />)}
              </div>
            )
          })}
          <p className="gp-foot">Sell in units you hold. Buy in ₹, because the units depend on that day's NAV.</p>
        </> : <div className="gp-ok">✓ Nothing to do this month. Your goals' money is in the right mix{all.family?.P ? ` (${Math.round(all.family.haveEq)}% equity, goals need ${Math.round(all.family.needEq)}%)` : ''}. Keep your SIPs running.</div>}
      </div>

      <div className="gp-panel">
        <div className="gp-ph"><h2>Your goals road</h2><span className="gp-hs">Nearest goal first · tap a goal for its own road</span></div>
        <Road items={[
          { key: 's', small: true, icon: '📍', side: 'R', node: <div className="gp-se"><b>Today</b>{new Date().toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</div> },
          ...plans.map((p, i) => ({ key: p.goal.goalId, icon: icon(p.goal), color: STATUS[p.status][1], label: new Date(p.goal.targetDate).getFullYear(), side: i % 2 ? 'R' : 'L', node: <GoalCard p={p} mt={mt} navigate={navigate} /> })),
        ]} />
      </div>

      {false && all.portfolios.some((x) => x.goals.length > 1) && (
        <div className="gp-panel">
          <div className="gp-ph"><h2>One portfolio, many goals</h2><span className="gp-hs">Near goals use a portfolio's safe money first, far goals its equity</span></div>
          <div className="gp-grp">
            {all.portfolios.filter((x) => x.goals.length > 1).map((x) => (
              <div className="gp-pf" key={x.portfolioId}>
                <div><b>{pname(x.portfolioId) || 'Portfolio'}</b><span>{x.goals.map((g) => `${mt(g.goal.goalName)} ${L(g.value)} (${g.targetPct}%)`).join(' · ')}</span></div>
                <div className="gp-pfv"><b>{x.equityPct}% <small>equity now</small></b><span>{x.targetPct}% needed by its goals together</span></div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

const JAR_COL = { inc: '#10b981', stb: '#f59e0b', grw: '#8b5cf6' }
/** A jar like the buckets page: the fill shows how big that bucket is next to the others. */
function Jar({ cls, f }) {
  const c = JAR_COL[cls], h = 92, top = 16, fh = Math.max(8, Math.min(1, f) * (h - top - 6))
  const cid = 'jc' + useId().replace(/:/g, '')
  return (
    <svg className="gp-jar" width="64" height={h + 6} viewBox={`0 0 64 ${h + 6}`} aria-hidden="true">
      <rect x="14" y="2" width="36" height="9" rx="3" fill={c} opacity=".85" />
      <rect x="8" y={top - 4} width="48" height={h - top + 8} rx="12" fill="none" stroke={c} strokeOpacity=".55" strokeWidth="2" />
      <clipPath id={cid}><rect x="10" y={top - 2} width="44" height={h - top + 4} rx="10" /></clipPath>
      <rect x="10" y={h + 2 - fh} width="44" height={fh} fill={c} opacity=".85" clipPath={`url(#${cid})`} />
      <rect x="16" y={h + 6 - fh} width="5" height={Math.max(0, fh - 12)} rx="2.5" fill="#fff" opacity=".25" />
    </svg>
  )
}

/** Retirement goals: the 3 buckets the money moves into in the last 5 years, and a way to open the full buckets page. */
function BucketsPanel({ p, onOpen }) {
  const stop = (p.road || []).find((r) => r.k === 'bucket') || (p.road || []).find((r) => r.k === 'goal')
  const b = stop?.bucket
  const start = p.bucketMode ? 'now' : stop?.y0 ? String(stop.y0) : null
  const growth = b?.monthly ? Math.max(0, p.target - b.income - b.stability) : 0
  const tot = b?.monthly ? b.income + b.stability + growth : 0
  const fill = { inc: tot ? b.income / tot : 0.25, stb: tot ? b.stability / tot : 0.45, grw: tot ? growth / tot : 0.8 }
  const box = (cls, name, sub, v) => <div className={`gp-bk ${cls}`}><Jar cls={cls} f={fill[cls]} /><span>{name}</span><b>{v ? L(v) : '—'}</b><small>{sub}</small></div>
  return (
    <div className="gp-panel">
      <div className="gp-ph"><h2>Retirement buckets</h2><span className="gp-hs">{p.years <= 0 ? 'You are retired: your monthly income comes from the Income jar, Stability refills it each year, and Growth refills Stability after good years.' : p.bucketMode ? 'You are in the last 5 years: your money now follows the 3 buckets.' : `Your money moves into 3 buckets from ${start || 'the last 5 years'}, 5 years before you retire. Until then it follows the road below.`}</span></div>
      <div className="gp-bks">
        {box('inc', 'Income', '2 years of expenses · safe', b?.income)}
        {box('stb', 'Stability', '5 years of expenses · hybrid / debt', b?.stability)}
        {box('grw', 'Growth', 'the rest · equity', growth)}
      </div>
      {b?.monthly ? <p className="gp-foot">Based on your monthly expense in retirement of about {L(b.monthly)}. Amounts are for the goal amount of {L(p.target)}.</p> : null}
    </div>
  )
}

const pctSaved = (p) => (p.target > 0 ? Math.min(100, Math.round((p.has / p.target) * 100)) : 0)

/** Small ring around the goal icon: how much of the goal amount is saved. */
function Ring({ p, big }) {
  const z = big ? 48 : 42, sw = 4, r = (z - sw) / 2, c = 2 * Math.PI * r, f = pctSaved(p) / 100
  const col = p.state === 'short' ? 'var(--accent-amber)' : '#16a34a'
  return (
    <span className="gp-ring" style={{ width: z, height: z }} title={`${pctSaved(p)}% of the goal saved`}>
      <svg width={z} height={z} viewBox={`0 0 ${z} ${z}`}>
        <circle cx={z / 2} cy={z / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={sw} />
        <circle cx={z / 2} cy={z / 2} r={r} fill="none" stroke={col} strokeWidth={sw} strokeLinecap="round" strokeDasharray={`${c * f} ${c}`} transform={`rotate(-90 ${z / 2} ${z / 2})`} />
      </svg>
      <span className="gp-ring-v">{pctSaved(p)}%</span>
    </span>
  )
}

/** Equity / debt of the goal's money today vs what its glide path wants. */
function MixRow({ p }) {
  if (p.eqNow == null) return null
  const off = Math.abs(p.eqNow - p.eqTarget) >= 5
  return (
    <div className="gp-mix">
      <span><i style={{ background: '#8b5cf6' }} />Equity {p.eqNow}%</span>
      <span><i style={{ background: '#38bdf8' }} />Debt {100 - p.eqNow}%</span>
      <span className="gp-mix-t">Plan {p.eqTarget} : {100 - p.eqTarget} <b style={{ color: off ? 'var(--accent-amber)' : 'var(--accent-green)' }}>{off ? 'off by ' + Math.abs(p.eqNow - p.eqTarget) : '✓'}</b></span>
    </div>
  )
}

const goalCells = (p, gp) => [
  ['Goal amount', L(p.target)], ['Have today', L(p.has)],
  ['Should have today', L(p.need)], ['Gap', <span style={{ color: gp[1] }}>{gp[0]}</span>],
]

/** What the goal needs today: a monthly SIP, OR one lump sum. Shown only when the goal is short. */
function NeedRow({ p }) {
  const running = p.sip ? `${L(p.sip)}/mo` : 'none'
  if (!(p.lumpToday > 0)) return <div className="gp-need-ok">✓ Covered{p.sip ? ` · keep your SIP ${L(p.sip)}/mo` : ''}</div>
  return (
    <div className="gp-need">
      <div className="gp-nb sip"><span>SIP needed / month</span><b>{L(p.sipNeeded)}</b><small>Running now: {running}</small></div>
      <em>OR</em>
      <div className="gp-nb lump"><span>Lump sum today</span><b>{L(p.lumpToday)}</b><small>One time, instead</small></div>
    </div>
  )
}

function GoalCard({ p, mt, navigate }) {
  const [stt, sc] = STATUS[p.status], gp = gapTxt(p)
  const next = p.road.find((r) => r.k !== 'today' && r.k !== 'quiet')
  const nextTxt = next && ({ safer: 'Make safer', ease: 'Equity starts easing', bucket: 'Start retirement buckets', goal: p.isRet ? 'Retire' : 'Goal year', spend: 'Live from buckets' }[next.k])
  return (
    <div className="gp-vc" onClick={() => navigate(`/goals/plan/${encodeURIComponent(p.goal.goalId)}`)}>
      <div className="gp-vh"><Ring p={p} /><div><b>{icon(p.goal)} {mt(p.goal.goalName)}</b><span>Due {new Date(p.goal.targetDate).getFullYear()} · {p.yearsLeft} yrs left</span></div><Dot c={sc}>{stt}</Dot></div>
      <Grid cells={goalCells(p, gp)} />
      <MixRow p={p} />
      <NeedRow p={p} />
      <div className="gp-vf"><span>{realSteps(p).length ? `${realSteps(p).length} step${realSteps(p).length > 1 ? 's' : ''} this month ↑` : p.bucketMode ? 'Follow your retirement buckets' : '✓ Nothing to do'}</span>{next && <span>Next · {next.y0 || next.y} {nextTxt}</span>}</div>
    </div>
  )
}

/* ───────── one step as a row: Action | From → To | Amount ───────── */
function StepRow({ s, p, n, mt, pname, onRebalance, onClose, navigate }) {
  let k, fr, to, am, amS, extra = null
  if (s.t === 'ready' || s.t === 'protect') {
    const ready = s.t === 'ready'
    k = ready ? 'Money ready' : 'Protect it'
    fr = [mt(p.goal.goalName), ready ? `Due ${new Date(p.goal.targetDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })} · ${L(p.has)} kept for it` : `It already has its full ${L(p.target)}`]
    to = ready ? ['Withdraw when you need it', 'Its money stays safe and kept aside until then'] : ['Safe funds', 'The family plan above moves its equity to safe funds']
    am = ready ? <span className="gp-acts2">
      <button className="gp-btn gp-btn-s" onClick={(e) => { e.stopPropagation(); onClose?.(p.goal, 'used') }}>Withdrawn</button>
      <button className="gp-btn gp-btn-s" onClick={(e) => { e.stopPropagation(); navigate?.('/goals/classic') }}>More time</button>
      <button className="gp-btn gp-btn-s" onClick={(e) => { e.stopPropagation(); onClose?.(p.goal, 'not-needed') }}>Not needed</button>
    </span> : L(p.has)
    amS = ready ? 'not needed = its money goes back to your other goals' : 'kept aside for this goal'
  } else if (s.t === 'rebalance') {
    k = 'Rebalance'
    fr = [pname(s.portfolioId) || 'This portfolio', `Equity ${Math.round(s.actEq)}% today`]
    to = ['Its new targets', `${Math.round(s.needEq)}% equity for its goals`]
    am = <button className="gp-btn gp-btn-s" onClick={(e) => { e.stopPropagation(); onRebalance?.(s.portfolioId) }}>See moves ›</button>; amS = 'Adjust SIP, lumpsum or switch · import CAS after'
  } else if (s.t === 'switch') {
    k = 'Switch'
    fr = [fname(s.from), s.units != null ? `Sell ${U(s.units)} units` : `Sell about ${L(s.sellValue)}`]
    to = [fname(s.to), 'Buy with the money']
    am = L(s.sellValue); amS = s.nav ? `≈ at NAV ₹${Number(s.nav).toFixed(2)}` : 'approx.'
  } else if (s.t === 'sip') {
    k = 'Add SIP'
    const from = (s.from || []).map((x) => `${L(x.amount)} from ${mt(x.goal.goalName)}`).join(' + ')
    const newMoney = s.amount - (s.from || []).reduce((a, x) => a + x.amount, 0)
    fr = [newMoney >= 500 ? 'Your bank' : 'Moved SIP', from ? (newMoney >= 500 ? `${from} + ${L(newMoney)} new` : from) : 'New monthly SIP']
    const many = (s.split || []).length > 1
    to = [many ? `${s.split.length} funds in this goal` : s.fund ? fname(s.fund) : (s.wantEq ? 'An equity fund in this goal' : 'A safe fund in this goal'),
      (s.sipFrom ? `Goal SIP ${L(s.sipFrom)} → ${L(s.sipTo)}/mo` : `New SIP ${L(s.sipTo)}/mo`) + (many ? ' · below-target funds first, then by target %' : '')]
    extra = many ? s.split : null
    am = `+${L(s.amount)}`; amS = `per month · or ${L(s.lump)} once`
  } else {
    k = 'Move SIP'
    fr = [mt(p.goal.goalName), s.sipTo ? `SIP ${L(s.sipFrom)} → ${L(s.sipTo)}` : `Stop SIP ${L(s.sipFrom)}`]
    to = [mt(s.to.goalName), `SIP +${L(s.amount)}`]
    am = L(s.amount); amS = 'per month'
  }
  const cell = (c) => <div className="gp-cell"><b>{c[0]}</b><span>{c[1]}</span></div>
  const [a1, a2] = String(amS).split(' · ')
  return (
    <div className="gp-row">
      <span className="gp-num">{n}</span><span className="gp-k">{k}</span>
      {cell(fr)}<span className="gp-ar">→</span>{cell(to)}
      <div className="gp-am"><b>{am}</b><span>{a1}{a2 && <><br />{a2}</>}</span></div>
      <div className="gp-mflow">{cell(fr)}<span className="gp-ar2">↓</span>{cell(to)}</div>
      {extra && <div className="gp-split">{extra.map((x) => <span key={(x.fund.schemeCode || x.fund.fundCode) + x.fund.portfolioId}><b>₹{Math.round(x.amount).toLocaleString('en-IN')}</b>/mo → {fname(x.fund)}</span>)}</div>}
    </div>
  )
}

/** The family plan: one set of moves for all goals together (SIP changes first, a switch only if still needed). */
function FamilyBlock({ f, pname, mt }) {
  let num = 0
  const next = () => ++num
  if (!f || f.status !== 'steps' || !f.steps.filter((x) => x.t !== 'note').length) return null
  const safe = f.gap > 0
  const rows = []
  for (const s of f.steps) {
    if (s.t === 'note') continue
    let k, fr, to, am, amS
    const fn = (h, wantSafe) => (h ? fname(h) : wantSafe ? 'A liquid or debt fund of your choice' : 'An equity fund of your choice')
    if (s.t === 'sip-cut') { k = 'Lower SIP'; fr = [fname(s.fund), pname(s.portfolioId)]; to = ['SIP', `₹${s.from.toLocaleString('en-IN')} → ₹${s.to.toLocaleString('en-IN')}/mo`]; am = `−₹${(s.from - s.to).toLocaleString('en-IN')}`; amS = 'per month' }
    else if (s.t === 'sip-add') { k = s.from ? 'Raise SIP' : 'Start SIP'; fr = ['The SIP money above', 'same total, no new money']; to = [fn(s.fund, s.wantSafe), s.fund ? `${pname(s.portfolioId)} · SIP ₹${s.from.toLocaleString('en-IN')} → ₹${s.to.toLocaleString('en-IN')}/mo` : `${s.portfolioId ? pname(s.portfolioId) + ' · ' : ''}pick one; the app then tracks it`]; am = `+₹${s.amount.toLocaleString('en-IN')}`; amS = 'per month' }
    else if (s.t === 'lump') { k = 'Invest'; fr = [mt(s.from.name), 'idle cash']; to = [fn(s.fund, false), s.fund ? pname(s.portfolioId) : '']; am = `₹${Math.round(s.amount).toLocaleString('en-IN')}`; amS = 'one time' }
    else if (s.t === 'sell') { k = 'Sell'; fr = [fname(s.fund), pname(s.portfolioId)]; to = ['Sell', s.units != null ? `${U(s.units)} units` : `about ${L(s.value)}`]; am = L(s.value); amS = s.nav ? `≈ at NAV ₹${Number(s.nav).toFixed(2)}` : 'approx.' }
    else if (s.t === 'buy') { k = 'Buy'; fr = ['The money from the sell above', pname(s.portfolioId)]; to = [fn(s.fund, s.wantSafe), s.fund ? 'buy in ₹, units depend on that day\'s NAV' : `in ${pname(s.portfolioId)}; buy in ₹`]; am = L(s.value); amS = 'one time' }
    else continue
    rows.push({ k, fr, to, am, amS })
  }
  const note = f.steps.find((s) => s.t === 'note')?.text
  const cell = (c) => <div className="gp-cell"><b>{c[0]}</b><span>{c[1]}</span></div>
  return (
    <div className="gp-grp">
      <div className="gp-gh"><span>👪</span><b>Family plan</b><span className="gp-hs" style={{ margin: 0 }}>Goals hold {Math.round(f.haveEq)}% in equity, they need {Math.round(f.needEq)}% · these steps move about {L(f.doable)} {safe ? 'to safe money' : 'to equity'}{f.after > 1000 ? '; the rest comes with the goals\' new SIPs below' : ''}</span></div>
      {rows.map((r, i) => {
        const [a1, a2] = String(r.amS).split(' · ')
        return (
          <div className="gp-row" key={i}>
            <span className="gp-num">{next()}</span><span className="gp-k">{r.k}</span>
            {cell(r.fr)}<span className="gp-ar">→</span>{cell(r.to)}
            <div className="gp-am"><b>{r.am}</b><span>{a1}{a2 && <><br />{a2}</>}</span></div>
            <div className="gp-mflow">{cell(r.fr)}<span className="gp-ar2">↓</span>{cell(r.to)}</div>
          </div>
        )
      })}
      {note && <p className="gp-foot" style={{ padding: '4px 14px 8px' }}>{note} Do them in order and stop when this shows ✓.</p>}
    </div>
  )
}

/* ───────── goal page ───────── */
function GoalDetail({ p, ctx }) {
  const { mt, navigate, pname } = ctx
  const [stt, sc] = STATUS[p.status], gp = gapTxt(p), g = p.goal
  let n = 0
  const st = realSteps(p)
  const after = {}
  st.filter((s) => s.t === 'switch').forEach((s) => {
    const kf = `${s.portfolioId}::${s.from.schemeCode || s.from.fundCode}`; after[kf] = (after[kf] || 0) - s.sellValue
    if (s.to) { const kt = `${s.portfolioId}::${s.to.schemeCode || s.to.fundCode}`; after[kt] = (after[kt] || 0) + s.buyValue }
  })
  const fundsEq = p.att.total > 0 ? Math.round(p.att.equity / p.att.total * 100) : null
  return (
    <>
      <div className="gp-panel">
        <div className="gp-vh gp-hero"><Ring p={p} big /><div><b>{icon(g)} {mt(g.goalName)}</b><span>Due {new Date(g.targetDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })} · {p.yearsLeft} years left</span></div><Dot c={sc}>{stt}</Dot></div>
        <Grid six four cells={goalCells(p, gp)} />
        <MixRow p={p} />
        <NeedRow p={p} />
      </div>

      <div className="gp-panel">
        <div className="gp-ph"><h2>Action required</h2><span className="gp-hs">{p.bucketMode ? 'In the last 5 years before retirement your money follows the retirement buckets.' : `Equity ${p.eqNow ?? '—'}%, your glide path says ${p.eqTarget}% · a switch shows only when it is 5 points or more off`}</span></div>
        {st.length ? <>
          <div className="gp-thd"><span /><span>Action</span><span>From</span><span /><span>To</span><span style={{ textAlign: 'right' }}>Amount</span></div>
          <div className="gp-grp">{st.map((s, i) => <StepRow key={i} s={s} p={p} n={++n} mt={mt} pname={pname} onRebalance={ctx.openRebalance} onClose={ctx.closeGoal} navigate={navigate} />)}</div>
          <p className="gp-foot">Sell in units you hold. Buy in ₹, because the units depend on that day's NAV.</p>
        </> : <div className="gp-ok">✓ Nothing to do now.{p.sip > 0 ? ` Keep your SIP ${L(p.sip)}/month.` : ''}</div>}
      </div>

      {p.isRet && <BucketsPanel p={p} />}

      <div className="gp-panel">
        <div className="gp-ph"><h2>Funds in this goal</h2><span className="gp-hs">{p.att.items.length} holdings · {L(p.att.total)}{fundsEq !== null && ` · ${fundsEq}% equity, ${100 - fundsEq}% safe`}</span></div>
        {p.att.items.length ? <div className="gp-grp">
          {p.att.items.slice().sort((a, b) => b.value - a.value).map((it) => {
            const h = it.holding, d = after[it.key] || 0
            const units = it.kind === 'mf' ? (Number(h.units) || 0) * (it.fraction || 1) : null
            return (
              <div className="gp-fr" key={it.key}>
                <span className="gp-fd" style={{ background: it.eq >= 0.5 ? 'var(--accent-violet)' : 'var(--accent-blue)' }} />
                <div className="gp-fn"><b>{it.kind === 'mf' ? fname(h) : (h.companyName || h.symbol || h.investmentName)}</b><small>{Math.round(it.eq * 100)}% equity{units != null && ` · ${U(units)} units`}{h.currentNav ? ` · NAV ₹${Number(h.currentNav).toFixed(2)}` : ''}{pname(it.portfolioId) && ` · ${pname(it.portfolioId)}`}</small></div>
                <div className="gp-fv"><b>{L(it.value)}</b>{Math.abs(d) >= 1000 ? <small style={{ color: d < 0 ? 'var(--accent-rose)' : '#22c55e' }}>{d < 0 ? '−' : '+'}{L(Math.abs(d))} → {L(it.value + d)}</small> : st.length ? <small>no change</small> : null}</div>
              </div>
            )
          })}
        </div> : <div className="gp-ok">No investments linked yet. Link them in <a className="gp-link" onClick={() => navigate('/goals/classic')}>Edit &amp; link goals</a>.</div>}
      </div>

      <div className="gp-panel">
        <div className="gp-ph"><h2>{p.isRet ? 'Your road to retirement' : `Your road to ${L(p.target)} · ${new Date(g.targetDate).getFullYear()}`}</h2><span className="gp-hs">{p.isRet ? 'Grow → ease → build 3 buckets → live from them. ' : ''}Big stops are years when money moves. Small dots are quiet years.</span></div>
        <Road items={p.road.map((r, i) => r.k === 'quiet'
          ? { key: i, small: true, node: <div className="gp-qs">{r.y0 === r.y ? r.y : `${r.y0}–${r.y}`} · {r.eq0 === r.eq ? `stays ${r.eq}% equity` : `target eases ${r.eq0}% → ${r.eq}%, nothing moves yet`} · keep SIP</div> }
          : { key: i, icon: { today: '📍', safer: '⇄', ease: '📉', bucket: '🪣', goal: '🏁', spend: '💸' }[r.k], color: r.k === 'today' ? 'var(--accent-violet)' : r.k === 'goal' ? '#22c55e' : 'var(--accent-blue)', node: <StopCard r={r} p={p} /> })} alternate />
      </div>
    </>
  )
}

function StopCard({ r, p }) {
  const eqRow = (a, b) => ['Equity', a != null && a !== b ? `${a}% → ${b}%` : `${b}%`]
  let chip, rows, act = null, why = null
  const yl = r.yl
  if (r.k === 'today') { chip = 'TODAY'; rows = [['Have today', L(p.has)], ['Should have', L(p.need)], ['Gap', <span style={{ color: gapTxt(p)[1] }}>{gapTxt(p)[0]}</span>], eqRow(p.eqNow, p.bucketMode ? null : p.eqTarget)]; act = realSteps(p).length ? `↑ ${realSteps(p).length} step${realSteps(p).length > 1 ? 's' : ''} shown above` : '✓ Nothing to move. Keep SIP.' }
  else if (r.k === 'safer') { chip = 'MAKE SAFER'; rows = [['Expected value', L(r.v)], eqRow(r.eq0, r.eq)]; act = `⇄ Switch about ${L(r.amount)} from equity to safe funds`; why = `Your glide path for ${yl} year${yl > 1 ? 's' : ''} left. Exact units show that year, using that day's NAV.` }
  else if (r.k === 'ease') { chip = 'EASE STARTS'; rows = [['Expected value', L(r.v)], ['Equity', '85% → 75% by 5 yrs left']]; why = 'The target drops about 2 points a year. Money moves only once it adds up to 5 points.' }
  else if (r.k === 'bucket') { chip = 'BUILD BUCKETS'; rows = [['Expected value', L(r.v)], ['Quarters', r.quarters]]; act = r.bucket?.monthly ? `⇄ Each quarter move a little from Growth into Income (${L(r.bucket.income)}) and Stability (${L(r.bucket.stability)})` : '⇄ Each quarter move a little from Growth into Income and Stability'; why = 'A quarter is skipped if growth funds are more than 10% below their high.' }
  else if (r.k === 'goal') { chip = p.isRet ? 'RETIRE' : 'GOAL YEAR'; rows = [['Goal amount', L(p.target)], ['Expected value', L(r.v)]]; act = p.isRet ? (r.bucket?.monthly ? `↓ Start monthly withdrawal of about ${L(r.bucket.monthly)} from Income` : '↓ Start monthly withdrawal from Income') : '↓ Withdraw and use from your safe funds' }
  else { chip = 'EVERY YEAR AFTER'; rows = [['Spend', r.bucket?.monthly ? `about ${L(r.bucket.monthly * 12)} a year` : 'from Income']]; act = '⇄ Refill Income from Stability once a year'; why = 'Refill Stability from Growth only when growth funds are near their high.' }
  return (
    <div className={`gp-rc ${r.k === 'today' ? 'here' : ''} ${r.k === 'goal' ? 'fin' : ''}`}>
      <div className="gp-rh"><span><b>{r.y0 ? `${r.y0}–${r.y}` : r.y}{r.k === 'spend' ? '+' : ''}</b><small>{r.k === 'spend' ? 'retired' : yl > 0 ? `${yl} yr${yl > 1 ? 's' : ''} left` : 'goal year'}</small></span><span className="gp-chip">{chip}</span></div>
      <Grid cells={rows} />
      {act && <div className="gp-act">{act}</div>}
      {why && <p className="gp-why">{why}</p>}
    </div>
  )
}

/* ───────── small pieces ───────── */
const Dot = ({ c, children }) => <span className="gp-dot" style={{ '--c': c }}>{children}</span>
const Grid = ({ cells, six, four }) => <div className={`gp-grid ${six ? 'six' : ''} ${four ? 'four' : ''}`}>{cells.map(([k, v], i) => <div key={i}><span>{k}</span><b>{v}</b></div>)}</div>

/** Vertical road: stops alternate left / right on wide screens, run down the left on phones. */
function Road({ items }) {
  const ref = useRef(null)
  const [d, setD] = useState({ path: '', w: 0, h: 0, narrow: false })
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return
    const draw = () => {
      const m = el.getBoundingClientRect(), narrow = m.width < 520
      const pts = [...el.querySelectorAll('.gp-stop,.gp-tick')].map((e) => { const r = e.getBoundingClientRect(); return [r.left + r.width / 2 - m.left, r.top + r.height / 2 - m.top] })
      if (pts.length < 2) return setD({ path: '', w: m.width, h: m.height, narrow })
      let path = `M${pts[0][0]} ${pts[0][1]}`
      for (let i = 1; i < pts.length; i++) { const [a, b] = pts[i - 1], [c, e] = pts[i], sw = (i % 2 ? -1 : 1) * (narrow ? 7 : 28), my = (b + e) / 2; path += ` C${a + sw} ${my} ${c + sw} ${my} ${c} ${e}` }
      setD({ path, w: m.width, h: m.height, narrow })
    }
    draw()
    const ro = new ResizeObserver(draw); ro.observe(el)
    return () => ro.disconnect()
  }, [items.length])
  let side = 0, last = 'R'
  const sides = items.map((it) => { if (it.side) { last = it.side; return it.side } if (it.small) return last === 'L' ? 'R' : 'L'; last = (side++ % 2) ? 'R' : 'L'; return last })
  return (
    <div className="gp-map" ref={ref}>
      <svg width={d.w} height={d.h}><path d={d.path} stroke="var(--gp-road)" strokeWidth={d.narrow ? 14 : 18} fill="none" strokeLinecap="round" /><path d={d.path} stroke="var(--gp-roadln)" strokeWidth="1.5" strokeDasharray="7 9" fill="none" /></svg>
      {items.map((it, idx) => {
        const s = sides[idx]
        return (
          <div key={it.key} className={`gp-rw ${s} ${it.small ? 'sm' : ''}`}>
            <div className="gp-slot l">{s === 'L' && it.node}</div>
            {it.small && !it.icon ? <div className="gp-tick" /> : <div className="gp-stop" style={{ '--c': it.color || 'var(--border-input)' }}>{it.icon}{it.label && <span className="gp-yl">{it.label}</span>}</div>}
            <div className="gp-slot r">{s === 'R' && it.node}</div>
          </div>
        )
      })}
    </div>
  )
}

const CSS = `
.gp{--gp-road:color-mix(in srgb,var(--text-muted) 22%,transparent);--gp-roadln:color-mix(in srgb,var(--text-primary) 40%,transparent);--gp-in:var(--bg-inset)}
.gp>*+*{margin-top:16px}.gp a{cursor:pointer}.gp-link{color:var(--accent-violet);font-weight:600}
.gp-bar{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap}
.gp-bar h1{font-size:22px;font-weight:800;color:var(--text-primary);margin:0}.gp-bar p{font-size:12.5px;color:var(--text-muted);margin:3px 0 0}
.gp-back{font-size:14px;color:var(--accent-violet)}
.gp-acts{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}.gp-btn.gp-btn-p{background:var(--accent-violet);color:#fff;border-color:transparent}
.gp-beta{font-size:11px;font-weight:700;color:var(--accent-violet);border:1px solid color-mix(in srgb,var(--accent-violet) 40%,transparent);border-radius:99px;padding:4px 10px;white-space:nowrap}
.gp-panel{background:var(--bg-card);border:1px solid var(--border);border-radius:18px;padding:20px 22px;box-shadow:var(--shadow-card)}
.gp-panel h2{font-size:16.5px;font-weight:700;color:var(--text-primary);margin:0}
.gp-ph{margin-bottom:12px}.gp-hs{display:block;font-size:12.5px;color:var(--text-muted);margin-top:3px}
.gp-sum{display:grid;grid-template-columns:repeat(4,1fr);padding:16px 22px}
.gp-sum div+div{border-left:1px solid var(--border);padding-left:18px}.gp-sum span{display:block;font-size:12px;color:var(--text-muted)}.gp-sum b{display:block;font-size:21px;color:var(--text-primary);margin-top:3px}
.gp-thd,.gp-row{display:grid;grid-template-columns:28px 82px minmax(0,1fr) 22px minmax(0,1fr) 170px;gap:12px;align-items:center}
.gp-thd{font-size:10.5px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--text-muted);padding:0 14px 6px}
.gp-grp{border:1px solid var(--border);border-radius:14px;background:var(--bg-inset);margin-top:10px;overflow:hidden}
.gp-gh{display:flex;align-items:center;gap:10px;padding:11px 14px;border-bottom:1px solid var(--border);cursor:pointer;font-size:14px;color:var(--text-primary)}
.gp-gh .gp-go{margin-left:auto;font-size:12px;color:var(--accent-violet);font-weight:600}
.gp-dot{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;font-weight:600;color:var(--text-muted);white-space:nowrap}.gp-dot:before{content:"";width:7px;height:7px;border-radius:50%;background:var(--c)}
.gp-row{padding:12px 14px}.gp-row+.gp-row{border-top:1px solid var(--border)}
.gp-num{font-size:12px;font-weight:700;color:var(--text-muted)}
.gp-k{font-size:11.5px;font-weight:700;color:var(--text-secondary);border:1px solid var(--border-input);border-radius:6px;padding:3px 8px;text-align:center;white-space:nowrap}
.gp-cell b{display:block;font-size:13.5px;font-weight:600;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.gp-cell span{display:block;font-size:12px;color:var(--text-muted);margin-top:2px}
.gp-ar{color:var(--text-muted);text-align:center}
.gp-am{text-align:right}.gp-am b{display:block;font-size:15px;font-weight:700;color:var(--text-primary);font-variant-numeric:tabular-nums}.gp-am span{display:block;font-size:11px;color:var(--text-muted);margin-top:2px;line-height:1.4}
.gp-mflow{display:none}
.gp-foot{font-size:11.5px;color:var(--text-muted);margin:10px 4px 0}
.gp-ok{font-size:14px;color:var(--text-secondary);padding:12px 14px;border:1px solid color-mix(in srgb,#22c55e 30%,transparent);background:color-mix(in srgb,#22c55e 7%,transparent);border-radius:12px}
.gp-btn{margin-top:12px;font-size:13px;font-weight:600;color:var(--accent-violet);background:none;border:1px solid color-mix(in srgb,var(--accent-violet) 40%,transparent);border-radius:10px;padding:8px 12px;cursor:pointer}
.gp-pf{display:flex;justify-content:space-between;gap:12px;padding:12px 14px}.gp-pf+.gp-pf{border-top:1px solid var(--border)}
.gp-pf b{display:block;font-size:14px;color:var(--text-primary)}.gp-pf span{display:block;font-size:12px;color:var(--text-muted);margin-top:2px}
.gp-pfv{text-align:right}.gp-pfv small{font-size:11px;color:var(--text-muted);font-weight:500}
/* road */
.gp-map{position:relative}.gp-map svg{position:absolute;inset:0;pointer-events:none;overflow:visible}
.gp-rw{display:grid;grid-template-columns:1fr 84px 1fr;align-items:center;min-height:140px;position:relative}.gp-rw.sm{min-height:50px}
.gp-slot{display:flex}.gp-rw.L .gp-slot.l{justify-content:flex-end}
.gp-stop{grid-column:2;justify-self:center;width:42px;height:42px;border-radius:50%;background:var(--bg-card);border:2px solid color-mix(in srgb,var(--c) 70%,transparent);display:flex;align-items:center;justify-content:center;font-size:17px;position:relative;z-index:2;box-shadow:0 0 0 6px var(--bg-card)}
.gp-yl{position:absolute;top:48px;font-size:12px;font-weight:700;color:var(--text-secondary)}
.gp-tick{grid-column:2;justify-self:center;width:10px;height:10px;border-radius:50%;background:var(--border-input);box-shadow:0 0 0 4px var(--bg-card);position:relative;z-index:2}
.gp-se{font-size:12px;color:var(--text-muted)}.gp-se b{display:block;font-size:14px;color:var(--text-primary)}
.gp-qs{font-size:12px;color:var(--text-muted);max-width:330px}.gp-rw.L .gp-qs{text-align:right}
.gp-vc,.gp-rc{width:100%;max-width:390px;background:var(--bg-inset);border:1px solid var(--border);border-radius:16px;padding:14px 16px;position:relative;z-index:2}
.gp-vc{cursor:pointer}.gp-vc:hover{border-color:color-mix(in srgb,var(--accent-violet) 40%,transparent)}
.gp-vc:before,.gp-rc:before{content:"";position:absolute;top:50%;height:1.5px;width:24px;background:var(--border-input)}
.gp-rw.L .gp-vc:before,.gp-rw.L .gp-rc:before{right:-25px}.gp-rw.R .gp-vc:before,.gp-rw.R .gp-rc:before{left:-25px}
.gp-vh{display:flex;align-items:center;gap:10px}.gp-vh>div{flex:1;min-width:0}.gp-vh b{display:block;font-size:15px;color:var(--text-primary)}.gp-vh>div span{font-size:12px;color:var(--text-muted)}
.gp-hero b{font-size:20px}
.gp-em{width:36px;height:36px;border-radius:11px;background:var(--bg-card);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0}
.gp-grid{display:grid;grid-template-columns:1fr 1fr;margin-top:12px;border:1px solid var(--border);border-radius:12px;overflow:hidden;background:var(--bg-card)}
.gp-grid div{padding:9px 12px}.gp-grid div:nth-child(odd){border-right:1px solid var(--border)}.gp-grid div:nth-child(n+3){border-top:1px solid var(--border)}
.gp-grid div:last-child:nth-child(odd){grid-column:1/-1;border-right:0}
.gp-grid>div>span{display:block;font-size:11px;color:var(--text-muted)}.gp-grid b{display:block;font-size:15px;margin-top:2px;color:var(--text-primary);font-variant-numeric:tabular-nums;white-space:nowrap}.gp-grid b small{font-size:11px;color:var(--text-muted);font-weight:500}
.gp-grid.six{grid-template-columns:repeat(6,1fr);background:var(--bg-inset)}.gp-grid.six div{border-top:0!important;border-right:0;border-left:1px solid var(--border)}.gp-grid.six div:first-child{border-left:0}
.gp-need{display:flex;align-items:stretch;gap:10px;margin-top:10px}.gp-need>em{align-self:center;font-style:normal;font-size:11px;font-weight:700;color:var(--text-muted)}
.gp-nb{flex:1;min-width:0;border-radius:12px;padding:10px 12px;text-align:center;display:flex;flex-direction:column;gap:2px;border:1px solid}
.gp-nb span{font-size:11px;font-weight:600}.gp-nb b{font-size:17px;color:var(--text-primary)}.gp-nb small{font-size:10.5px;color:var(--text-muted)}
.gp-nb.sip{background:color-mix(in srgb,#8b5cf6 10%,transparent);border-color:color-mix(in srgb,#8b5cf6 35%,transparent)}.gp-nb.sip span{color:var(--accent-violet)}
.gp-nb.lump{background:color-mix(in srgb,#f59e0b 9%,transparent);border-color:color-mix(in srgb,#f59e0b 35%,transparent)}.gp-nb.lump span{color:var(--accent-amber)}
.gp-ring{position:relative;flex-shrink:0;display:inline-block}.gp-ring>svg{position:absolute;inset:0}.gp-ring>span{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:var(--text-primary)}
.gp-pct{color:var(--text-primary);font-weight:600}
.gp-mix{display:flex;flex-wrap:wrap;align-items:center;gap:4px 14px;margin-top:10px;font-size:12px;color:var(--text-secondary,var(--text-muted))}.gp-mix i{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:5px}.gp-mix-t{margin-left:auto;color:var(--text-muted)}
.gp-lbl{display:block;font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--text-muted)}
.gp-nw{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}.gp-nwv{display:block;font-size:26px;margin-top:4px;color:var(--text-primary)}
.gp-nws{display:flex;gap:28px;flex-wrap:wrap}.gp-nws span{display:block;font-size:13px;color:var(--text-muted)}.gp-nws i{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px}.gp-nws b{display:block;font-size:15px;margin-top:3px;color:var(--text-primary)}.gp-nws small{font-size:11px;opacity:.8}
.gp-tiles{display:grid;grid-template-columns:repeat(4,1fr) 2fr;gap:12px;margin-bottom:16px}
.gp-tile{border:1px solid var(--border);background:var(--bg-card);border-radius:14px;padding:14px 16px;display:flex;flex-direction:column;gap:4px;min-width:0}.gp-tile b{font-size:17px;color:var(--text-primary);font-variant-numeric:tabular-nums}.gp-tile small{font-size:12px;color:var(--text-muted)}
.gp-tile-or{flex-direction:row;align-items:center;justify-content:space-between}.gp-tile-or>div{display:flex;flex-direction:column;gap:4px}.gp-tile-or>em{font-style:normal;font-size:12px;font-weight:700;color:var(--text-muted)}
@media(max-width:900px){.gp-tiles{grid-template-columns:1fr 1fr}.gp-tile-or{grid-column:1/-1}}
.gp-bks{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:12px}.gp-bk{border-radius:12px;padding:12px 14px;border:1px solid;display:flex;flex-direction:column;align-items:center;text-align:center;gap:3px}.gp-jar{margin-bottom:6px}.gp-bk span{font-size:12px;font-weight:700}.gp-bk b{font-size:17px;color:var(--text-primary)}.gp-bk small{font-size:11px;color:var(--text-muted)}
.gp-bk.inc{background:color-mix(in srgb,#10b981 9%,transparent);border-color:color-mix(in srgb,#10b981 35%,transparent)}.gp-bk.inc span{color:var(--accent-green)}
.gp-bk.stb{background:color-mix(in srgb,#f59e0b 9%,transparent);border-color:color-mix(in srgb,#f59e0b 35%,transparent)}.gp-bk.stb span{color:var(--accent-amber)}
.gp-bk.grw{background:color-mix(in srgb,#8b5cf6 10%,transparent);border-color:color-mix(in srgb,#8b5cf6 35%,transparent)}.gp-bk.grw span{color:var(--accent-violet)}
@media(max-width:640px){.gp-bks{gap:6px}.gp-bk{padding:10px 6px}.gp-bk b{font-size:14px}}
.gp-btn-s{margin-top:0;padding:5px 10px;font-size:12px}
.gp-split{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:6px 14px;padding:2px 0 4px 64px;font-size:12px;color:var(--text-muted)}.gp-split b{color:var(--text-primary)}
@media(max-width:640px){.gp-split{padding-left:8px;flex-direction:column}}
.gp-acts2{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}
.gp-need-ok{margin-top:10px;font-size:12px;font-weight:600;color:var(--accent-green)}

.gp-vf{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-top:10px;font-size:12px;color:var(--text-muted)}
.gp-rc.here{border-color:color-mix(in srgb,var(--accent-violet) 45%,transparent)}.gp-rc.fin{border-color:color-mix(in srgb,#22c55e 40%,transparent)}
.gp-rh{display:flex;justify-content:space-between;align-items:flex-start}.gp-rh b{display:block;font-size:17px;color:var(--text-primary)}.gp-rh small{font-size:11.5px;color:var(--text-muted)}
.gp-chip{font-size:10.5px;font-weight:800;letter-spacing:.8px;color:var(--accent-violet);border:1px solid color-mix(in srgb,var(--accent-violet) 35%,transparent);border-radius:6px;padding:3px 8px}
.gp-act{margin-top:10px;font-size:13px;color:var(--text-secondary);padding:9px 12px;border:1px solid var(--border);border-radius:10px;background:var(--bg-card)}
.gp-why{font-size:12px;color:var(--text-muted);margin:8px 0 0}
.gp-fr{display:grid;grid-template-columns:10px 1fr auto;gap:10px;align-items:center;padding:11px 14px}.gp-fr+.gp-fr{border-top:1px solid var(--border)}
.gp-fd{width:8px;height:8px;border-radius:50%}
.gp-fn b{display:block;font-size:14px;color:var(--text-primary);font-weight:600}.gp-fn small{display:block;font-size:11.5px;color:var(--text-muted);margin-top:2px}
.gp-fv{text-align:right}.gp-fv b{display:block;font-size:14.5px;color:var(--text-primary)}.gp-fv small{display:block;font-size:11.5px;color:var(--text-muted);margin-top:2px;white-space:nowrap}
.gp-note{font-size:11.5px;color:var(--text-muted);text-align:center}
@media(max-width:860px){.gp-grid.six{grid-template-columns:repeat(3,1fr)}.gp-grid.six div:nth-child(4){border-left:0}.gp-grid.six div:nth-child(n+4){border-top:1px solid var(--border)!important}}
@media(max-width:760px){
 .gp-thd{display:none}.gp-row{grid-template-columns:22px 1fr auto;gap:8px 10px;align-items:start;padding:12px}
 .gp-row>.gp-cell,.gp-row>.gp-ar{display:none}.gp-row .gp-k{grid-column:2;justify-self:start}.gp-row .gp-am{grid-column:3;grid-row:1}
 .gp-mflow{display:flex;flex-direction:column;grid-column:2/4;background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:8px 10px}.gp-mflow .gp-cell b{white-space:normal}.gp-ar2{color:var(--text-muted);font-size:13px;padding:2px 0}
 .gp-gh .gp-go{display:none}.gp-gh .gp-dot{margin-left:auto}
 .gp-vc:before,.gp-rc:before{width:12px}.gp-rw.L .gp-vc:before,.gp-rw.L .gp-rc:before{right:-13px}.gp-rw.R .gp-vc:before,.gp-rw.R .gp-rc:before{left:-13px}
 .gp-rw{grid-template-columns:1fr 56px 1fr}.gp-panel{padding:16px}
}
@media(max-width:520px){.gp-slot{min-width:0}.gp-grid b{white-space:normal;overflow-wrap:anywhere}
 .gp-sum{grid-template-columns:1fr 1fr;gap:12px 0}.gp-sum div:nth-child(3){border-left:0;padding-left:0}
 .gp-rw{grid-template-columns:44px minmax(0,1fr);min-height:0;padding:8px 0}.gp-rw.sm{padding:4px 0}
 .gp-slot{grid-column:2;grid-row:1}.gp-slot:empty{display:none}.gp-rw.L .gp-slot.l{justify-content:flex-start}.gp-rw.L .gp-qs{text-align:left}
 .gp-stop,.gp-tick{grid-column:1;grid-row:1}.gp-stop{width:36px;height:36px;font-size:15px}.gp-yl{display:block;top:39px;left:50%;transform:translateX(-50%);font-size:10.5px;background:var(--bg-card);padding:0 3px;border-radius:4px;white-space:nowrap}
 .gp-rw:has(.gp-yl){padding-bottom:18px}
 .gp-panel{padding:12px}.gp-row{padding:10px 2px;gap:6px 8px}.gp-mflow{padding:6px 10px}.gp-mflow .gp-cell b{font-size:13px}.gp-mflow .gp-cell span{font-size:11.5px}.gp-ar2{padding:0;line-height:1.2}
 .gp-vc,.gp-rc{max-width:none}.gp-rw .gp-vc:before,.gp-rw .gp-rc:before{left:-13px!important;right:auto!important}
 .gp-grid.six{grid-template-columns:1fr 1fr}.gp-grid.six div{border-left:0!important}.gp-grid.six div:nth-child(even){border-left:1px solid var(--border)!important}.gp-grid.six div:nth-child(n+3){border-top:1px solid var(--border)!important}
 .gp-beta{display:none}.gp-acts{width:100%;justify-content:flex-start}
.gp-grid.six.four{grid-template-columns:repeat(4,1fr)}
@media(max-width:860px){.gp-grid.six.four{grid-template-columns:1fr 1fr}.gp-grid.six.four div{border-top:0!important;border-left:0!important}.gp-grid.six.four div:nth-child(even){border-left:1px solid var(--border)!important}.gp-grid.six.four div:nth-child(n+3){border-top:1px solid var(--border)!important}}
 .gp-vh{flex-wrap:wrap}.gp-vh .gp-dot{flex-basis:100%;padding-left:46px;margin-top:-2px}
}
`
