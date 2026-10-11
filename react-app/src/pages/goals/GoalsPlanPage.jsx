// New Goals view (beta, /goals/plan): one road for all goals, this month's steps from today's fund
// values, and a page per goal with its own year-by-year road. The old Goals page is untouched.
// All numbers come from utils/goalPlan.js (tested in goalPlan.test.js).
import { useMemo, useRef, useLayoutEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { formatINR, splitFundName } from '../../data/familyData'
import { useData } from '../../context/DataContext'
import { useFamily } from '../../context/FamilyContext'
import { useMaskText } from '../../hooks/useMaskText'
import PageLoading from '../../components/PageLoading'
import { attributeFamilyGoals, equityFraction } from '../../utils/goalAttribution'
import { buildGoalPlan } from '../../utils/goalPlan'

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
  const { goalList, goalPortfolioMappings, mfHoldings, stockHoldings, otherInvList, assetAllocations, mfPortfolios } = useData()

  const allocMap = useMemo(() => { const m = {}; (assetAllocations || []).forEach((a) => { if (a.assetAllocation) m[a.fundCode] = a.assetAllocation }); return m }, [assetAllocations])
  const active = useMemo(() => (goalList || []).filter((g) => g.isActive !== false), [goalList])
  const plan = useMemo(() => {
    if (!goalList) return null
    // every active goal takes part, so shared portfolios are split the same way for all members
    const attribution = attributeFamilyGoals({ goals: active, mappings: goalPortfolioMappings, mfHoldings, stockHoldings, otherInvList, allocMap })
    return buildGoalPlan({ goals: active, attribution, mfHoldings, mappings: goalPortfolioMappings, eqOf: (h) => equityFraction(h, allocMap) })
  }, [goalList, active, goalPortfolioMappings, mfHoldings, stockHoldings, otherInvList, allocMap])

  if (!plan) return <PageLoading title="Loading goals" />
  const shown = plan.goals.filter((p) => selectedMember === 'all' || p.goal.familyMemberId === selectedMember)
  const pname = (pid) => mt(((mfPortfolios || []).find((x) => x.portfolioId === pid)?.portfolioName || '').replace(/^PFL-/, ''))
  const ctx = { mt, navigate, pname }
  const sel = goalId ? plan.goals.find((p) => p.goal.goalId === goalId) : null

  return (
    <div className="gp space-y-4">
      <style>{CSS}</style>
      <div className="gp-bar">
        <div>
          <h1>{sel ? <a className="gp-back" onClick={() => navigate('/goals/plan')}>← All goals</a> : 'My goals'}</h1>
          <p>Steps are worked out from your own funds and your glide path · <a className="gp-link" onClick={() => navigate('/goals')}>Old goals page</a></p>
        </div>
        <span className="gp-beta">New view · beta</span>
      </div>
      {sel ? <GoalDetail p={sel} ctx={ctx} /> : <GoalList plans={shown} all={plan} ctx={ctx} />}
      <p className="gp-note">Steps are calculated from your own funds, your goal's expected return and the app's glide path. A switch shows only when a goal is 5 points or more away from its target equity. No fund recommendations.</p>
    </div>
  )
}

/* ───────── list ───────── */
function GoalList({ plans, all, ctx }) {
  const { mt, navigate, pname } = ctx
  const tot = plans.reduce((s, p) => s + p.has, 0), sip = plans.reduce((s, p) => s + p.sip, 0)
  const withSteps = plans.filter((p) => realSteps(p).length)
  let n = 0
  if (!plans.length) return <div className="gp-panel"><p className="gp-hs">No goals yet. Create one on the <a className="gp-link" onClick={() => navigate('/goals')}>Goals page</a>.</p></div>
  return (
    <>
      <div className="gp-panel gp-sum">
        <div><span>Goals</span><b>{plans.length}</b></div>
        <div><span>Saved for goals</span><b>{L(tot)}</b></div>
        <div><span>SIP today</span><b>{L(sip)}/mo</b></div>
        <div><span>Need a step</span><b>{withSteps.length} of {plans.length}</b></div>
      </div>

      <div className="gp-panel">
        <div className="gp-ph"><h2>This month · what to do</h2><span className="gp-hs">{withSteps.reduce((s, p) => s + realSteps(p).length, 0)} steps across {withSteps.length} goals · from today's fund values</span></div>
        {withSteps.length ? <>
          <div className="gp-thd"><span /><span>Action</span><span>From</span><span /><span>To</span><span style={{ textAlign: 'right' }}>Amount</span></div>
          {withSteps.map((p) => {
            const [stt, sc] = STATUS[p.status]
            return (
              <div className="gp-grp" key={p.goal.goalId}>
                <div className="gp-gh" onClick={() => navigate(`/goals/plan/${encodeURIComponent(p.goal.goalId)}`)}>
                  <span>{icon(p.goal)}</span><b>{mt(p.goal.goalName)}</b><Dot c={sc}>{stt}</Dot><span className="gp-go">Open ›</span>
                </div>
                {realSteps(p).map((s, i) => <StepRow key={i} s={s} p={p} n={++n} mt={mt} pname={pname} />)}
              </div>
            )
          })}
          <p className="gp-foot">Sell in units you hold. Buy in ₹, because the units depend on that day's NAV.</p>
        </> : <div className="gp-ok">✓ Nothing to do this month. Keep your SIPs running.</div>}
      </div>

      <div className="gp-panel">
        <div className="gp-ph"><h2>Your goals road</h2><span className="gp-hs">Nearest goal first · tap a goal for its own road</span></div>
        <Road items={[
          { key: 's', small: true, icon: '📍', side: 'R', node: <div className="gp-se"><b>Today</b>{new Date().toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</div> },
          ...plans.map((p, i) => ({ key: p.goal.goalId, icon: icon(p.goal), color: STATUS[p.status][1], label: new Date(p.goal.targetDate).getFullYear(), side: i % 2 ? 'R' : 'L', node: <GoalCard p={p} mt={mt} navigate={navigate} /> })),
        ]} />
      </div>

      {all.portfolios.some((x) => x.goals.length > 1) && (
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

function GoalCard({ p, mt, navigate }) {
  const [stt, sc] = STATUS[p.status], gp = gapTxt(p)
  const next = p.road.find((r) => r.k !== 'today' && r.k !== 'quiet')
  const nextTxt = next && ({ safer: 'Make safer', ease: 'Equity starts easing', bucket: 'Start retirement buckets', goal: p.isRet ? 'Retire' : 'Goal year', spend: 'Live from buckets' }[next.k])
  return (
    <div className="gp-vc" onClick={() => navigate(`/goals/plan/${encodeURIComponent(p.goal.goalId)}`)}>
      <div className="gp-vh"><span className="gp-em">{icon(p.goal)}</span><div><b>{mt(p.goal.goalName)}</b><span>Due {new Date(p.goal.targetDate).getFullYear()} · {p.yearsLeft} yrs left</span></div><Dot c={sc}>{stt}</Dot></div>
      <Grid cells={[['Goal amount', L(p.target)], ['Have today', L(p.has)], ['Should have today', L(p.need)], ['Gap', <span style={{ color: gp[1] }}>{gp[0]}</span>],
        ['SIP today', <>{L(p.sip)}<small>/mo</small></>], ['Lump sum today', p.lumpToday ? L(p.lumpToday) : <small>not needed</small>]]} />
      <div className="gp-vf"><span>{realSteps(p).length ? `${realSteps(p).length} step${realSteps(p).length > 1 ? 's' : ''} this month ↑` : p.bucketMode ? 'Follow your retirement buckets' : '✓ Nothing to do'}</span>{next && <span>Next · {next.y0 || next.y} {nextTxt}</span>}</div>
    </div>
  )
}

/* ───────── one step as a row: Action | From → To | Amount ───────── */
function StepRow({ s, p, n, mt, pname }) {
  let k, fr, to, am, amS
  if (s.t === 'switch') {
    k = 'Switch'
    fr = [fname(s.from), s.units != null ? `Sell ${U(s.units)} units` : `Sell about ${L(s.sellValue)}`]
    to = [fname(s.to), 'Buy with the money']
    am = L(s.sellValue); amS = s.nav ? `≈ at NAV ₹${Number(s.nav).toFixed(2)}` : 'approx.'
  } else if (s.t === 'sip') {
    k = 'Add SIP'
    const from = (s.from || []).map((x) => `${L(x.amount)} from ${mt(x.goal.goalName)}`).join(' + ')
    const newMoney = s.amount - (s.from || []).reduce((a, x) => a + x.amount, 0)
    fr = [newMoney >= 500 ? 'Your bank' : 'Moved SIP', from ? (newMoney >= 500 ? `${from} + ${L(newMoney)} new` : from) : 'New monthly SIP']
    to = [s.fund ? fname(s.fund) : (s.wantEq ? 'An equity fund in this goal' : 'A safe fund in this goal'), `Goal SIP ${L(s.sipFrom)} → ${L(s.sipTo)}`]
    am = `+${L(s.amount)}`; amS = `per month · or ${L(s.lump)} once`
  } else {
    k = 'Move SIP'
    fr = [mt(p.goal.goalName), `SIP ${L(s.sipFrom)} → ${L(s.sipTo)}`]
    to = [mt(s.to.goalName), `SIP +${L(s.amount)}`]
    am = L(s.amount); amS = 'per month'
  }
  const cell = (c) => <div className="gp-cell"><b>{c[0]}</b><span>{c[1]}</span></div>
  const [a1, a2] = amS.split(' · ')
  return (
    <div className="gp-row">
      <span className="gp-num">{n}</span><span className="gp-k">{k}</span>
      {cell(fr)}<span className="gp-ar">→</span>{cell(to)}
      <div className="gp-am"><b>{am}</b><span>{a1}{a2 && <><br />{a2}</>}</span></div>
      <div className="gp-mflow">{cell(fr)}<span className="gp-ar2">↓</span>{cell(to)}</div>
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
        <div className="gp-vh gp-hero"><span className="gp-em">{icon(g)}</span><div><b>{mt(g.goalName)}</b><span>Due {new Date(g.targetDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })} · {p.yearsLeft} years left</span></div><Dot c={sc}>{stt}</Dot></div>
        <Grid six cells={[['Goal amount', L(p.target)], ['Have today', L(p.has)], ['Should have today', L(p.need)], ['Gap', <span style={{ color: gp[1] }}>{gp[0]}</span>],
          ['SIP today', p.sip ? `${L(p.sip)}/mo` : 'None'], ['Lump sum today', p.lumpToday ? L(p.lumpToday) : <small>not needed</small>]]} />
      </div>

      <div className="gp-panel">
        <div className="gp-ph"><h2>Your plan's next step</h2><span className="gp-hs">{p.bucketMode ? 'In the last 5 years before retirement your money follows the retirement buckets.' : `Equity ${p.eqNow ?? '—'}%, your glide path says ${p.eqTarget}% · a switch shows only when it is 5 points or more off`}</span></div>
        {st.length ? <>
          <div className="gp-thd"><span /><span>Action</span><span>From</span><span /><span>To</span><span style={{ textAlign: 'right' }}>Amount</span></div>
          <div className="gp-grp">{st.map((s, i) => <StepRow key={i} s={s} p={p} n={++n} mt={mt} pname={pname} />)}</div>
          <p className="gp-foot">Sell in units you hold. Buy in ₹, because the units depend on that day's NAV.</p>
        </> : <div className="gp-ok">✓ Nothing to do now. Keep SIP {L(p.sip)}/month.</div>}
        {p.bucketMode && <button className="gp-btn" onClick={() => navigate(`/retirement-buckets?goal=${encodeURIComponent(g.goalId)}`)}>Open retirement buckets ›</button>}
      </div>

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
        </div> : <div className="gp-ok">No investments linked yet. Link them on the <a className="gp-link" onClick={() => navigate('/goals')}>Goals page</a>.</div>}
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
const Grid = ({ cells, six }) => <div className={`gp-grid ${six ? 'six' : ''}`}>{cells.map(([k, v], i) => <div key={i}><span>{k}</span><b>{v}</b></div>)}</div>

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
      for (let i = 1; i < pts.length; i++) { const [a, b] = pts[i - 1], [c, e] = pts[i], sw = narrow ? 0 : (i % 2 ? -1 : 1) * 28, my = (b + e) / 2; path += ` C${a + sw} ${my} ${c + sw} ${my} ${c} ${e}` }
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
      <svg width={d.w} height={d.h}><path d={d.path} stroke="var(--gp-road)" strokeWidth={d.narrow ? 10 : 18} fill="none" strokeLinecap="round" /><path d={d.path} stroke="var(--gp-roadln)" strokeWidth="1.5" strokeDasharray="7 9" fill="none" /></svg>
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
.gp-bar{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
.gp-bar h1{font-size:22px;font-weight:800;color:var(--text-primary);margin:0}.gp-bar p{font-size:12.5px;color:var(--text-muted);margin:3px 0 0}
.gp-back{font-size:14px;color:var(--accent-violet)}
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
@media(max-width:520px){
 .gp-sum{grid-template-columns:1fr 1fr;gap:12px 0}.gp-sum div:nth-child(3){border-left:0;padding-left:0}
 .gp-rw{grid-template-columns:44px 1fr;min-height:0;padding:8px 0}.gp-rw.sm{padding:4px 0}
 .gp-slot{grid-column:2;grid-row:1}.gp-slot:empty{display:none}.gp-rw.L .gp-slot.l{justify-content:flex-start}.gp-rw.L .gp-qs{text-align:left}
 .gp-stop,.gp-tick{grid-column:1;grid-row:1}.gp-stop{width:36px;height:36px;font-size:15px}.gp-yl{display:none}
 .gp-vc,.gp-rc{max-width:none}.gp-rw .gp-vc:before,.gp-rw .gp-rc:before{left:-13px!important;right:auto!important}
 .gp-grid.six{grid-template-columns:1fr 1fr}.gp-grid.six div{border-left:0!important}.gp-grid.six div:nth-child(even){border-left:1px solid var(--border)!important}.gp-grid.six div:nth-child(n+3){border-top:1px solid var(--border)!important}
 .gp-beta{display:none}
 .gp-vh{flex-wrap:wrap}.gp-vh .gp-dot{flex-basis:100%;padding-left:46px;margin-top:-2px}
}
`
