// The Goals page (one page): To do this month → all goals together → free money → the road of goals by year.
// Numbers come from the goals pool (Money for goals), buildGoalPlan (pool mode), familyPlan and goalTodo.
import { useState, useRef, useLayoutEffect } from 'react'
import { formatINR, splitFundName } from '../../data/familyData'
import Modal from '../../components/Modal'
import { createPortal } from 'react-dom'
import { RetirementActions } from './RetirementBucketsPage'

const L = (v) => formatINR(Math.round(v || 0))
const U = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
const fname = (h) => (h ? splitFundName(h.fundName || h.schemeName || '').main : 'a fund')
const ICON = { Retirement: '🌴', Education: '🎓', Marriage: '💍', Home: '🏠', 'House Purchase': '🏠', 'Emergency Fund': '🛟', Vehicle: '🚗', Travel: '✈️' }
const icon = (g) => ICON[g.goalType] || '🎯'
const yearOf = (g) => new Date(g.targetDate).getFullYear()
const monthYear = (g) => new Date(g.targetDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
const isGold = (h) => /gold|silver/i.test(`${h?.category || ''} ${h?.fundName || ''} ${h?.investmentType || ''} ${h?.investmentCategory || ''}`)

/** equity / debt / gold of a goal's money (gold shown on its own, never as "safe") */
function mixOf(items) {
  let e = 0, d = 0, gd = 0
  for (const it of items || []) { if (isGold(it.holding)) gd += it.value; else { e += it.value * (it.eq || 0); d += it.value * (1 - (it.eq || 0)) } }
  const t = e + d + gd
  return t > 0 ? { e: Math.round((e / t) * 100), g: Math.round((gd / t) * 100), d: 100 - Math.round((e / t) * 100) - Math.round((gd / t) * 100) } : null
}
const tagOf = (it) => (isGold(it.holding) ? ['g', 'Gold'] : it.kind === 'other' && /epf|ppf|nps|vpf|sukanya/i.test(it.holding?.investmentType || '') ? ['l', it.holding.investmentType] : it.eq >= 0.65 ? ['e', 'Equity'] : it.eq >= 0.2 ? ['e', 'Hybrid'] : ['d', 'Debt'])

/** equity / debt: now vs target, one calm line of text */
function Mix({ m, plan, note, soft }) {
  if (!m) return null
  const e = m.e + (m.g || 0)
  const off = plan == null ? null : e - plan
  const mark = off == null ? null : Math.abs(off) <= 2 ? ['ok', '✓ On target'] : Math.abs(off) <= 10 ? ['ok', '✓ Close to target'] : ['warn', off > 0 ? `${off} pts more equity than target` : `${-off} pts less equity than target`]
  return (
    <div className="g2-mx2">
      <span className="k">Mix</span>
      <span>{m.g > 0 ? 'Equity + gold' : 'Equity'} <b>{e}%</b>{plan != null && <small> / {plan}% target</small>}</span>
      <span className="sep" />
      <span>Debt <b>{m.d}%</b>{plan != null && <small> / {Math.max(0, 100 - plan)}% target</small>}</span>
      {mark && <em className={soft && mark[0] === 'warn' ? 'soft' : mark[0]}>{mark[1]}{soft && mark[0] === 'warn' ? ' · fine, the family mix is on plan' : ''}</em>}
      {note && <small className="g2-mxn">{note}</small>}
    </div>
  )
}
function Ring({ pct, cls }) {
  const r = 25, c = 2 * Math.PI * r, len = (Math.min(100, pct) / 100) * c
  return <div className={`g2-ring ${cls}`}><svg width="64" height="64" viewBox="0 0 64 64"><circle cx="32" cy="32" r={r} fill="none" stroke="var(--bg-inset)" strokeWidth="6" /><circle cx="32" cy="32" r={r} fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeDasharray={`${len} ${c}`} transform="rotate(-90 32 32)" /></svg><span><b>{pct}%</b><small>funded</small></span></div>
}

/** The winding road behind the goal cards (wide screens): a smooth curve through each year circle. */
function useCurve(dep) {
  const ref = useRef(null)
  const [d, setD] = useState('')
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const draw = () => {
      if (window.innerWidth < 900) { setD(''); return }
      const box = el.getBoundingClientRect()
      // nodes in page order: the Today pin, or a year circle (in) and the bottom of its cards (out)
      const segs = []
      for (const n of el.children) {
        if (n.classList.contains('g2-now')) { const r = n.getBoundingClientRect(); const x = r.left + r.width / 2 - box.left; segs.push([x, r.top - box.top], [x, r.bottom - box.top]) }
        else if (n.querySelector?.('.g2-yr')) {
          const c = n.querySelector('.g2-yr').getBoundingClientRect(), g = n.querySelector('.g2-grp').getBoundingClientRect()
          const x = c.left + c.width / 2 - box.left
          segs.push([x, c.top + c.height / 2 - box.top], [x, g.bottom - box.top])
        }
      }
      if (!segs.length) { setD(''); return }
      const cx = box.width / 2
      let path = `M${cx},0`, last = [cx, 0]
      const curve = ([x2, y2]) => { const [x1, y1] = last, m = (y2 - y1) / 2; path += ` C${x1},${y1 + m} ${x2},${y2 - m} ${x2},${y2}`; last = [x2, y2] }
      for (let i = 0; i < segs.length; i += 2) { curve(segs[i]); path += ` L${segs[i + 1][0]},${segs[i + 1][1]}`; last = segs[i + 1] }
      curve([cx, box.height])
      setD(path)
    }
    draw()
    const ro = new ResizeObserver(draw); ro.observe(el)
    window.addEventListener('resize', draw)
    return () => { ro.disconnect(); window.removeEventListener('resize', draw) }
  }, [dep])
  return [ref, d]
}

export default function GoalsHome({ plan, todo, pool, plans, closed = [], mfHoldings, mfPortfolios, ctx, renderBuckets, onMoney }) {
  const { mt, navigate, pname, closeGoal } = ctx
  const steps = todo.steps.filter((x) => x.t === 'cash' || x.t === 'switch' || x.t === 'protect')
  const protectOf = Object.fromEntries(todo.steps.filter((x) => x.t === 'protect').map((x) => [x.goal.goalId, x]))
  const shortStep = todo.steps.find((x) => x.t === 'short')
  const readyOf = Object.fromEntries(todo.steps.filter((x) => x.t === 'ready').map((x) => [x.goal.goalId, x]))
  const live = plans
  const has = live.reduce((t, p) => t + p.has, 0), need = live.reduce((t, p) => t + (p.state === 'due' ? p.has : p.need), 0)
  const amounts = live.reduce((t, p) => t + p.target, 0)
  const short = live.filter((p) => p.state === 'short').reduce((t, p) => t - p.gap, 0)
  const fam = plan.family
  const famMix = fam && fam.P > 0 ? { e: Math.round(fam.haveEq), d: 100 - Math.round(fam.haveEq), g: 0 } : null
  const extra = pool.extra || 0, extraEq = extra > 0 ? Math.round(((pool.extraEq || 0) / extra) * 100) : 0
  const groups = [...new Set(live.map((p) => yearOf(p.goal)))].sort((a, b) => a - b).map((y) => { const ps = live.filter((p) => yearOf(p.goal) === y); return { y, ps, past: ps.every((p) => p.years <= 0) } })

  const nPast = groups.filter((x) => x.past).length
  const sideOf = (i) => (i === 0 ? 'side-c' : i % 2 ? 'side-r' : 'side-l')
  const [roadRef, curve] = useCurve(live.length + ':' + closed.length)
  if (!live.length) return <div className="g2 g2-card"><p className="g2-hint">No goals yet. <a className="g2-link" onClick={() => navigate('/goals/classic?add=1')}>Add your first goal</a>.</p><style>{CSS}</style></div>

  return (
    <div className="g2">
      <style>{CSS}</style>

      {/* 1. To do this month (only when there is something to do) */}
      {steps.length > 0 && (
        <div className="g2-card g2-todo">
          <div className="g2-lbl"><span>Rebalance this month</span><span>{steps.length} step{steps.length > 1 ? 's' : ''}</span></div>
          {steps.map((s, i) => <Step key={i} s={s} n={i + 1} mt={mt} pname={pname} closeGoal={closeGoal} navigate={navigate} />)}
        </div>
      )}

      {/* 2. All goals together: the same small boxes as the goal cards */}
      <div className="g2-card g2-all">
        <div className="g2-lbl"><span>All goals together</span><span>{live.length} goal{live.length > 1 ? 's' : ''}</span></div>
        <div className={`g2-stats ${extra > 1000 ? 'five' : ''}`}>
          <div className="hv"><span><i>₹</i>Have today</span><b>{L(has)}</b><small>in Money for goals</small></div>
          <div className="nd"><span><i>◎</i>Need today</span><b>{L(need)}</b><small>with your SIPs</small></div>
          <div className={`gp ${short > 1000 ? 'warn' : 'ok'}`}><span><i>{short > 1000 ? '!' : '✓'}</i>Gap</span><b className={short > 1000 ? 'warn' : 'ok'}>{short > 1000 ? `${L(short)} short` : 'On track'}</b><small>{short > 1000 ? 'see below' : 'nothing to add'}</small></div>
          <div className="tg"><span><i>↻</i>SIPs running</span><b>{L(todo.runningSip)}<em>/mo</em></b><small>all portfolios</small></div>
          {extra > 1000 && <div className="fr"><span><i>+</i>Free money</span><b>{L(extra)}</b><small>{extraEq}% equity · covers future gaps</small></div>}
        </div>
        <div className="g2-sumf"><Mix m={famMix} plan={fam && fam.P > 0 ? Math.round(fam.needEq) : null} />
          <a className="g2-link" onClick={onMoney}>Money for goals ›</a></div>
        {fam?.status === 'steps' && <p className="g2-okline warn">! Mix more than 10 points off: see Rebalance above</p>}
        {shortStep && <ShortStep s={shortStep} pname={pname} />}
      </div>

      {/* 4. The road: a year, then that year's goals */}
      <div ref={roadRef} className={`g2-road ${curve ? 'curvy' : ''}`}>
        {curve && <svg className="g2-curve" aria-hidden="true"><path className="bed" d={curve} /><path className="mid" d={curve} /></svg>}
        {groups.filter((x) => x.past).map(({ y, ps }, gi) => (
          <div key={y} className={sideOf(gi)}>
            <div className="g2-yr due"><i>{icon(ps[0].goal)}</i><b>{y}</b></div>
            <div className="g2-grp">{ps.map((p) => <GoalCard key={p.goal.goalId} p={p} mt={mt} pname={pname} renderBuckets={renderBuckets} ready={readyOf[p.goal.goalId]} protect={protectOf[p.goal.goalId]} familyOk={fam?.status !== 'steps'} closeGoal={closeGoal} navigate={navigate} />)}</div>
          </div>
        ))}
        <div className={`g2-now ${sideOf(nPast)} ${nPast ? "after" : ""}`}>📍 Today · {new Date().toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</div>
        {groups.filter((x) => !x.past).map(({ y, ps }, gi) => (
          <div key={y} className={sideOf(gi + nPast)}>
            <div className={`g2-yr ${ps.some((p) => p.state === 'short') ? 'w' : ''} ${ps.some((p) => p.state === 'due' && !p.isRet) ? 'due' : ''}`}><i>{icon(ps[0].goal)}</i><b>{y}</b></div>
            <div className="g2-grp">{ps.map((p) => <GoalCard key={p.goal.goalId} p={p} mt={mt} pname={pname} renderBuckets={renderBuckets} ready={readyOf[p.goal.goalId]} protect={protectOf[p.goal.goalId]} familyOk={fam?.status !== 'steps'} closeGoal={closeGoal} navigate={navigate} />)}</div>
          </div>
        ))}
      </div>
      {closed.length > 0 && (
        <div className="g2-card">
          <div className="g2-lbl"><span>Completed goals</span><span>{closed.length}</span></div>
          {closed.map((g) => { const nm = String(g.notes || ''); const used = /withdrawn/i.test(nm); const when = (nm.match(/(?:Withdrawn|Not needed) on ([0-9/.-]+)/i) || [])[1]; return (
            <div key={g.goalId} className="g2-done"><span className={`g2-flag ${used ? 'ok' : ''}`}>{used ? '✓' : '–'}</span>
              <div><b>{icon(g)} {mt(g.goalName)}</b><small>{used ? 'Completed · money used' : 'Closed · not needed'}{when ? ` · ${when}` : ''}</small></div>
              <span className="g2-v">{L(g.targetAmount)}</span></div>) })}
        </div>
      )}
      <p className="g2-hint" style={{ textAlign: 'center' }}>Steps come from your own funds, each goal's timeline and the app's glide path. Not investment advice.</p>
    </div>
  )
}

const JC = { inc: '#34d399', stb: '#fbbf24', gro: '#a78bfa' }
function JarSvg({ c, f }) {
  const y = 66 - Math.max(4, Math.min(1, f || 0) * 52)
  return <svg width="46" height="60" viewBox="0 0 54 70" aria-hidden="true"><rect x="15" y="2" width="24" height="7" rx="3" fill={c} /><path d="M12 12Q8 12 8 18L8 60Q8 66 14 66L40 66Q46 66 46 60L46 18Q46 12 42 12Z" fill="none" stroke={c} strokeWidth="2.4" /><rect x="10" y={y} width="34" height={64 - y} rx="4" fill={c} opacity=".55" /></svg>
}
/** Which jar an investment sits in today: liquid / short debt / cash → Income, other debt / hybrid → Stability, equity & gold → Growth */
const jarOf = (it) => {
  const n = `${it.holding?.fundName || ''} ${it.holding?.investmentType || ''} ${it.holding?.category || ''}`
  if (isGold(it.holding) || (it.eq || 0) >= 0.65) return 'gro'
  if (/liquid|overnight|money market|ultra short|low duration|savings|cash|fixed deposit|\bfd\b/i.test(n)) return 'inc'
  return 'stb'
}
function Buckets({ p, items, retired, mt, pname, onOpen }) {
  const stop = (p.road || []).find((r) => r.k === 'bucket') || (p.road || []).find((r) => r.k === 'goal')
  const b = stop?.bucket
  const tgt = b?.monthly ? { inc: b.income, stb: b.stability, gro: Math.max(0, p.target - b.income - b.stability) } : null
  const hold = { inc: [], stb: [], gro: [] }
  for (const it of items) hold[jarOf(it)].push(it)
  const sum = (k) => hold[k].reduce((t, it) => t + it.value, 0)
  const tot = sum('inc') + sum('stb') + sum('gro') || 1
  const name = (it) => (it.kind === 'mf' ? fname(it.holding) : mt(it.holding?.investmentName || it.holding?.investmentType || 'Investment'))
  const payFund = [...hold.inc].sort((a, c) => c.value - a.value)[0]
  const jar = (k, label, sub) => (
    <div className={`g2-jar ${k}`}>
      <div className="g2-jh"><JarSvg c={JC[k]} f={retired || p.bucketMode ? (tgt?.[k] ? sum(k) / tgt[k] : sum(k) / tot) : sum(k) / tot} /><div><div className="nm">{label}</div><div className="amt">{L(sum(k))}</div><div className="of">{tgt?.[k] && (retired || p.bucketMode) ? `of ${L(tgt[k])} · ` : ''}{sub}</div></div></div>
      <div className="g2-jf">{hold[k].length ? hold[k].sort((a, c) => c.value - a.value).slice(0, 4).map((it, i) => <div key={i}><span>{name(it)}</span><b>{L(it.value)}</b></div>) : <div><span>{k === 'inc' ? 'A liquid fund will hold this' : 'Nothing here yet'}</span><b /></div>}</div>
    </div>
  )
  return (
    <div className="g2-bk">
      {retired && b?.monthly ? <div className="g2-pay"><b>{L(b.monthly)} every month</b><span>Paid as a monthly SWP from {payFund ? <b>{name(payFund)}</b> : 'a liquid fund'} (the Income jar).</span></div>
        : retired ? null : <div className="g2-btl"><div className={!p.bucketMode ? 'on' : ''}>Until {yearOf(p.goal) - 5}: one growth mix</div><div className={p.bucketMode ? 'on' : ''}>{yearOf(p.goal) - 5}–{yearOf(p.goal)}: fill the jars</div><div>From {yearOf(p.goal)} (retirement): live from them</div></div>}
      <div className="g2-jars">{jar('gro', 'Growth', 'the rest · equity')}{jar('stb', 'Stability', 'next 5 years · hybrid / debt')}{jar('inc', 'Income', '2 years of expenses · safe')}</div>
      <div className="g2-flow"><div>→ refills Stability after good years</div><div>→ refills Income once a year</div><div>↓ pays your monthly income</div></div>
      <p className="g2-hint">{retired ? 'You spend only from Income. Once a year a Refill plan shows on this card (sell units from Stability → buy the liquid fund). After a market fall it says: don\'t sell Growth this year.' : p.bucketMode ? 'In the last 5 years the app fills Income and Stability step by step (one step a year, shown on this card).' : `Until ${yearOf(p.goal) - 5} everything grows together; then the app starts filling the jars.`}</p>
    </div>
  )
}

function GoalCard({ p, mt, pname, renderBuckets, ready, protect, familyOk, closeGoal, navigate }) {
  const g = p.goal
  const retired = p.isRet && p.years <= 0
  const due = p.state === 'due' && !p.isRet
  const pct = p.target > 0 ? Math.min(100, Math.round((p.has / p.target) * 100)) : 0
  const retShort = retired ? Math.max(0, p.target - p.has) : 0
  const st = due ? ['due', 'Money ready'] : p.state === 'short' ? ['warn', `${L(-p.gap)} short`] : retired ? (retShort > 1000 ? ['warn', `Retired · ${L(retShort)} short`] : ['ok', 'Retired · on track']) : ['ok', 'On track']
  const gap = due ? ['ok', 'Ready'] : p.state === 'short' ? ['warn', `${L(-p.gap)} short`] : retShort > 1000 ? ['warn', `${L(retShort)} short`] : ['ok', 'On track']
  const yrs = retired ? `retired ${Math.round(-p.years) || ''}${Math.round(-p.years) ? ' yrs ago' : ''}` : due ? 'date reached' : `${p.years < 1 ? `${Math.max(1, Math.round(p.years * 12))} months` : `${Math.round(p.years * 2) / 2} years`} left`
  const items = (p.att?.items || []).filter((it) => it.value > 0.5).sort((a, b) => b.value - a.value)
  return (
    <div className={`g2-card g2-goal ${st[0]}`}>
      <div className="g2-gh">
        <div className={`g2-gi ${st[0]}`}>{icon(g)}</div>
        <div className="g2-gt"><h3>{mt(g.goalName)}</h3><p>{monthYear(g)} · {yrs}{g.familyMemberName ? ` · ${mt(g.familyMemberName)}` : ''}</p><span className={`g2-badge ${st[0]}`}>{st[1]}</span></div>
        <Ring pct={pct} cls={st[0]} />
      </div>
      <div className="g2-stats">
        <div className="hv"><span><i>₹</i>Have today</span><b>{L(p.has)}</b><small>from the pool</small></div>
        <div className="nd"><span><i>◎</i>Need today</span><b>{L(due ? p.target : p.need)}</b><small>{due ? 'the goal amount' : 'with your SIP'}</small></div>
        <div className={`gp ${gap[0]}`}><span><i>{gap[0] === 'ok' ? '✓' : '!'}</i>Gap</span><b className={gap[0]}>{gap[1]}</b><small>{gap[0] === 'ok' ? 'nothing to add' : 'see All goals together'}</small></div>
        <div className="tg"><span><i>⚑</i>Goal amount</span><b>{L(p.target)}</b><small>in {yearOf(g)}</small></div>
      </div>
      {(() => {
        const retOnly = items.filter((it) => it.kind === 'other' && /epf|ppf|nps|vpf/i.test(it.holding?.investmentType || '')).reduce((t, it) => t + it.value, 0)
        const mostlyRet = p.isRet && p.has > 0 && retOnly / p.has >= 0.5
        return <Mix m={mixOf(items)} plan={due || mostlyRet ? null : p.eqTarget}
          soft={!protect && familyOk}
          note={protect ? `⚠ Too much equity for ${p.years < 1 ? 'a few months' : `${Math.round(p.years * 2) / 2} years`} left: see "Make it safer" at the top.` : mostlyRet ? `Mostly EPF / PPF / NPS (${L(retOnly)}), which count as debt and stay for retirement. Your equity is counted in your other goals' share.` : null} />
      })()}
      {due && ready && <ReadyStep s={ready} mt={mt} pname={pname} closeGoal={closeGoal} navigate={navigate} />}
      {items.length > 0 && (
        <details><summary>Investments in this goal ({items.length})</summary>
          {items.map((it, i) => { const t = tagOf(it); return (
            <div key={i} className="g2-fd"><b>{it.kind === 'mf' ? fname(it.holding) : it.kind === 'stock' ? (it.holding.symbol || it.holding.stockName) : mt(it.holding?.investmentName || it.holding?.investmentType || 'Investment')}<span className={`g2-tag ${t[0]}`}>{t[1]}</span></b><span className="v">{L(it.value)}</span>
              <small>{it.kind === 'other' ? (/epf|ppf|nps|vpf|sukanya/i.test(it.holding?.investmentType || '') ? 'retirement only · never sold' : 'other investments') : pname(it.portfolioId)}{it.fraction != null && it.fraction < 0.999 ? ` · ${Math.round(it.fraction * 100)}% of it for this goal` : ''}</small></div>) })}
        </details>
      )}
      {p.isRet && <div className="g2-ract"><RetirementActions goal={p.goal} /></div>}
      {p.isRet && <details><summary>Your buckets today {retired ? '· living from them' : p.bucketMode ? '· filling now' : `· from ${yearOf(g) - 5}`}</summary><Buckets p={p} items={items} retired={retired} mt={mt} pname={pname} onOpen={renderBuckets} /></details>}
    </div>
  )
}

function ShortStep({ s, n, pname }) {
    const byPort = {}
    for (const b of s.buys) byPort[b.portfolioId] = (byPort[b.portfolioId] || 0) + b.amount
    const once = Object.entries(byPort).sort((a, b) => b[1] - a[1])
    const [open, setOpen] = useState(false)
    return (
    <div className="g2-step">
      <div className="g2-sh g2-shs"><div><b>To close the gap, pick one</b><p>Either one is enough. SIPs change per portfolio and split by your fund targets.</p></div></div>
      <div className="g2-two">
        <div className="g2-pk sip">
          <div className="g2-pkh"><span className="g2-chip sip">SIP</span><span>Raise monthly SIPs</span><b>+{L(s.sip)}<em>/mo</em></b></div>
          {s.sipRows.map((r, i) => <div key={i} className="g2-pkr"><span>{r.portfolioId ? pname(r.portfolioId) : 'New SIP'}</span><span className="v">{r.portfolioId ? <><s>{L(r.sipFrom)}</s> → <b>{L(r.sipFrom + r.sip)}</b></> : <b>{L(r.sip)}</b>}</span></div>)}
        </div>
        <em className="g2-orw">or</em>
        <div className="g2-pk buy">
          <div className="g2-pkh"><span className="g2-chip buy">ONCE</span><span>Invest one time</span><b>{L(s.lump)}</b></div>
          {once.length ? once.map(([pid, v]) => (
            <div key={pid}>
              <div className="g2-pkr"><span>{pname(pid)}</span><span className="v"><b>{L(v)}</b></span></div>
              {open && s.buys.filter((b) => b.portfolioId === pid).map((b, i) => <div key={i} className="g2-pkf"><span>{fname(b.fund)}</span><span>{L(b.amount)}</span></div>)}
            </div>)) : <div className="g2-pkr"><span>Into an equity fund</span><span className="v"><b>{L(s.lump)}</b></span></div>}
          {s.buys.length > 0 && <button className={`g2-pb g2-pkb ${open ? '' : 'g2-pulse'}`} onClick={() => setOpen(!open)}>{open ? 'Hide funds ▴' : `Show the ${s.buys.length} funds ▾`}</button>}
        </div>
      </div>
    </div>
  )
}

function ReadyStep({ s, mt, pname, closeGoal, navigate }) {
  const [open, setOpen] = useState(false)
  const done = (how) => { setOpen(false); closeGoal(s.goal, how) }
  return (
    <div className="g2-rdy">
      <div><b>Date reached · {L(s.has)} ready to use</b><span>Withdraw it when you need it, then mark the goal.</span></div>
      <button onClick={() => setOpen(true)} className="g2-pulse px-4 py-2.5 text-sm font-semibold rounded-lg bg-violet-600 hover:bg-violet-500 text-white transition-colors">Withdraw plan ›</button>
      {open && createPortal(<Modal open={open} onClose={() => setOpen(false)} title={`Withdraw: ${mt(s.goal.goalName)}`} wide>
        <div className="g2 g2-wdm">
          <p className="g2-wdmh"><b>{L(s.has)}</b> from {s.rows.length} investment{s.rows.length > 1 ? 's' : ''}. Redeem these when you pay, then tell the app what happened.</p>
          <div className="g2-wdl">{s.rows.map((r, i) => <WdRow key={i} r={r} mt={mt} pname={pname} />)}</div>
          <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-[var(--border)]">
            <button onClick={() => done('used')} className="px-5 py-2.5 text-sm font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors">✓ Withdrawn, mark completed</button>
            <button onClick={() => { setOpen(false); navigate(`/goals/classic?edit=${encodeURIComponent(s.goal.goalId)}`) }} className="px-4 py-2.5 text-sm font-medium rounded-lg border border-[var(--border-light)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors">Need more time</button>
            <button onClick={() => done('not')} className="px-4 py-2.5 text-sm font-medium rounded-lg border border-[var(--border-light)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors">Not needed</button>
          </div>
          <p className="g2-hint">Anything left after you close the goal becomes free money for your other goals.</p>
        </div>
      </Modal>, document.body)}
    </div>
  )
}

function Step({ s, n, mt, pname, closeGoal, navigate }) {
  if (s.t === 'ready') return <ReadyStep s={s} mt={mt} pname={pname} closeGoal={closeGoal} navigate={navigate} />
  if (s.t === 'short') return <ShortStep s={s} n={n} pname={pname} />
  if (s.t === 'cash') return (
    <div className="g2-step">
      <div className="g2-sh"><span className="g2-n">{n}</span><div><small>💰 Idle cash · your goals need more equity</small><b>Invest {L(s.total)} from {mt(s.from?.name || 'your savings')}</b><p>No selling, no tax.</p></div></div>
      {s.rows.map((r, i) => <Row key={i} chip="buy" k="BUY" a={r.fund ? fname(r.fund) : 'An equity fund of your choice'} b={r.fund ? pname(r.portfolioId) : 'any equity fund'} v={L(r.amount)} />)}
    </div>
  )
  if (s.t === 'switch' || s.t === 'protect') {
    const prot = s.t === 'protect'
    const buys = prot ? [{ fund: s.buy, value: s.total, wantSafe: true }] : s.buys
    const left = prot ? (s.years < 1 ? `${Math.max(1, Math.round(s.years * 12))} months` : `${Math.round(s.years * 2) / 2} years`) : null
    return (
      <div className="g2-mv">
        <div className="g2-mvh">
          <div className="g2-mvi">{prot ? icon(s.goal) : '🔁'}</div>
          <div className="g2-mvt"><small>{prot ? `${mt(s.goal.goalName)} · ${left} left` : 'All goals · mix more than 10 points off'}</small>
            <b>{prot ? 'Make it safer' : s.toSafe ? 'Move some equity to safe funds' : 'Move some safe money to equity'}</b>
            <span>{prot ? `${s.eqNow}% is in equity; with ${left} left its plan is ${s.eqTarget}%.` : `In ${pname(s.portfolioId)}, only between your own funds.`}</span></div>
          <div className="g2-mva"><b>{L(s.total)}</b><small>to move</small></div>
        </div>
        <div className="g2-two">
          <div className="g2-pk sell">
            <div className="g2-pkh"><span className="g2-chip sell">SELL</span><span>{pname(s.portfolioId)}</span></div>
            {s.sells.map((r, i) => <div key={i} className="g2-pkr"><span>{fname(r.fund)}<small>{r.units != null ? `${r.all ? 'all ' : ''}${U(r.units)} units` : ''}</small></span><span className="v"><b>≈ {L(r.value)}</b></span></div>)}
          </div>
          <em className="g2-orw">→</em>
          <div className="g2-pk buy">
            <div className="g2-pkh"><span className="g2-chip buy">BUY</span><span>same portfolio</span></div>
            {buys.map((r, i) => <div key={i} className="g2-pkr"><span>{r.fund ? fname(r.fund) : (r.wantSafe ? 'A liquid or short-term debt fund' : 'An equity fund')}<small>with the money from the sale</small></span><span className="v"><b>{L(r.value)}</b></span></div>)}
          </div>
        </div>
        <p className="g2-how">Sell in units, buy in ₹ (units depend on that day's NAV). Selling may have tax.</p>
      </div>
    )
  }
  return null
}
const WdRow = ({ r, mt, pname }) => <Row chip="wd" k="WITHDRAW" a={r.name ? (r.kind === 'other' ? mt(r.name) : splitFundName(r.name).main) : ''} b={r.kind === 'other' ? 'close it, or let it mature' : `${pname(r.portfolioId)} · redeem ${r.all ? 'all ' : ''}${U(r.units)} ${r.kind === 'stock' ? 'shares' : 'units'}`} v={`≈ ${L(r.value)}`} />
const Row = ({ chip, k, a, b, v }) => <div className="g2-row"><span className={`g2-chip ${chip}`}>{k}</span><div><b>{a}</b><small>{b}</small></div><span className="g2-v">{v}</span></div>

const CSS = `
[data-theme="light"] .g2-jar.inc .nm{color:#047857}[data-theme="light"] .g2-jar.stb .nm{color:#b45309}[data-theme="light"] .g2-jar.gro .nm{color:#6d28d9}
[data-theme="light"] .g2{--e:#6d28d9;--dt:#2563eb;--gd:#b45309;--ok:#047857;--warn:#b45309;--due:#1d4ed8;--sell:#be123c}
.g2{--e:#a78bfa;--dt:#60a5fa;--gd:#fbbf24;--ok:#34d399;--warn:#fbbf24;--due:#60a5fa;--sell:#fb7185;display:flex;flex-direction:column;gap:16px;width:100%}
.g2-card{background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:0 24px 20px;overflow:hidden}
.g2-lbl{display:flex;justify-content:space-between;align-items:center;margin:0 -24px 16px;padding:14px 24px;background:rgba(128,128,128,.04);border-bottom:1px solid rgba(128,128,128,.08);font-size:14px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--text-muted)}
.g2-lbl>span:first-child{display:flex;align-items:center;gap:8px}.g2-lbl>span:first-child:before{content:"";width:3px;height:14px;border-radius:2px;background:currentColor;opacity:.6}
.g2 .ok{color:var(--ok)}.g2 .warn{color:var(--warn)}
.g2-hint{font-size:12.5px;color:var(--text-muted);margin:8px 0 0;line-height:1.45}
.g2-link{color:var(--accent-violet);cursor:pointer}
.g2-btn{margin-top:12px;font-size:12px;font-weight:600;color:var(--accent-violet);background:none;border:1px solid var(--border);border-radius:8px;padding:6px 12px;cursor:pointer}
.g2-banner{border-radius:16px;padding:14px 16px;background:color-mix(in srgb,var(--warn) 10%,var(--bg-card));border:1px solid color-mix(in srgb,var(--warn) 40%,transparent);display:flex;flex-direction:column;gap:6px;font-size:13.5px;color:var(--text-secondary);line-height:1.5}
.g2-banner>b{color:var(--warn);font-size:14.5px}.g2-banner span b{color:var(--text-primary)}
.g2-ok{font-size:14px;font-weight:600;color:var(--ok);padding:4px 0}
.g2-step{border-top:1px solid var(--border);padding:14px 0 6px}.g2-lbl+.g2-step{border-top:0;padding-top:0}
.g2-sh{display:flex;gap:12px}.g2-sh small{display:block;font-size:11.5px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em}
.g2-sh b{display:block;font-size:15.5px;color:var(--text-primary);margin-top:3px}.g2-sh p{margin:3px 0 0;font-size:13px;color:var(--text-secondary)}
.g2-n{width:24px;height:24px;border-radius:50%;flex:none;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:var(--accent-violet);background:var(--bg-inset)}
.g2-row{display:grid;grid-template-columns:84px 1fr auto;gap:10px;align-items:center;padding:10px 0 10px 36px;border-top:1px dashed var(--border)}
.g2-row b{display:block;font-size:14px;color:var(--text-primary)}.g2-row small{display:block;font-size:12px;color:var(--text-muted);margin-top:2px}
.g2-v{font-weight:700;font-size:14.5px;color:var(--text-primary);text-align:right;white-space:nowrap}
.g2-chip{font-size:10.5px;font-weight:800;letter-spacing:.06em;text-align:center;border-radius:8px;padding:6px 0}
.g2-chip.sell{color:var(--sell);background:color-mix(in srgb,var(--sell) 14%,transparent)}.g2-chip.buy{color:var(--ok);background:color-mix(in srgb,var(--ok) 14%,transparent)}.g2-chip.wd{color:var(--due);background:color-mix(in srgb,var(--due) 14%,transparent)}
.g2-how{font-size:12.5px;color:var(--text-muted);margin:8px 0 0 36px}
.g2-choices{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:10px 0 4px 36px}
.g2-choice{text-align:left;border:1px solid var(--border);border-radius:14px;padding:11px 12px;background:var(--bg-inset);cursor:pointer;color:var(--text-primary)}
.g2-choice b{display:block;font-size:13.5px}.g2-choice span{display:block;font-size:12px;color:var(--text-muted);margin-top:4px;line-height:1.4}
.g2-choice.p{border-color:color-mix(in srgb,var(--due) 50%,transparent);background:color-mix(in srgb,var(--due) 9%,var(--bg-inset))}.g2-choice.p b{color:var(--due)}
.g2-opts{display:grid;grid-template-columns:1fr auto 1fr;gap:10px;align-items:center;margin:12px 0 0 36px}.g2-opts em{font-style:normal;font-size:12px;font-weight:700;color:var(--text-muted)}
.g2-opt{border-radius:14px;padding:12px 14px;text-align:center;border:1px solid var(--border)}
.g2-opt span{display:block;font-size:12px;font-weight:700}.g2-opt b{display:block;font-size:21px;margin:4px 0 2px;color:var(--text-primary)}.g2-opt small{display:block;font-size:11.5px;color:var(--text-muted);line-height:1.4}
.g2-pk.sip{background:color-mix(in srgb,var(--e) 11%,var(--bg-card));border-color:color-mix(in srgb,var(--e) 40%,transparent)}.g2-opt.sip span{color:var(--e)}
.g2-opt.lump{background:color-mix(in srgb,var(--gd) 9%,var(--bg-card));border-color:color-mix(in srgb,var(--gd) 40%,transparent)}.g2-opt.lump span{color:var(--gd)}
.g2-tot3{grid-template-columns:1fr 1fr 1fr!important}.g2-opts-sum{margin-left:0!important}.g2-or{display:flex;align-items:center;gap:10px;color:var(--text-muted);font-size:11px;font-weight:700;margin:2px 0 2px 36px}.g2-or:before,.g2-or:after{content:"";flex:1;height:1px;background:var(--border)}.g2-more{margin-left:36px;border-top:0!important;padding-top:0!important}
.g2-bk{margin-top:10px}.g2-jars{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:12px}
.g2-jar{background:var(--bg-inset);border:1px solid var(--border);border-radius:16px;padding:12px}
.g2-jh{text-align:center}.g2-jh svg{display:block;margin:0 auto 6px}.g2-jar .nm{font-size:13px;font-weight:800}.g2-jar .amt{font-size:17px;font-weight:700;color:var(--text-primary);margin:2px 0}.g2-jar .of{font-size:11.5px;color:var(--text-muted)}
.g2-jar.inc .nm{color:#34d399}.g2-jar.stb .nm{color:#fbbf24}.g2-jar.gro .nm{color:#a78bfa}
.g2-jf{margin-top:10px;border-top:1px dashed var(--border);padding-top:8px}.g2-jf div{display:flex;justify-content:space-between;gap:8px;font-size:12px;color:var(--text-secondary);padding:3px 0}.g2-jf b{color:var(--text-primary);font-weight:600;white-space:nowrap}
.g2-pay{padding:12px 14px;border-radius:14px;background:color-mix(in srgb,#34d399 9%,var(--bg-inset));border:1px solid color-mix(in srgb,#34d399 35%,transparent);font-size:13px;color:var(--text-secondary)}.g2-pay>b{display:block;font-size:18px;color:var(--text-primary)}.g2-pay span b{color:var(--text-primary)}
.g2-btl{display:flex;font-size:11.5px;color:var(--text-muted)}.g2-btl div{flex:1;text-align:center;border-top:3px solid var(--border);padding-top:6px}.g2-btl div.on{border-color:#34d399;color:var(--text-primary);font-weight:600}
.g2-flow{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:6px;font-size:11.5px;color:var(--text-muted);text-align:center}
.g2-chip.sip{color:var(--e);background:color-mix(in srgb,var(--e) 14%,transparent)}
.g2-ask{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;margin:12px 0 4px 36px}.g2-ask>span{font-size:13.5px;font-weight:600;color:var(--text-primary)}
.g2-yes{font-size:13px;font-weight:600;border:0;border-radius:8px;padding:8px 14px;background:#7c3aed;color:#fff;cursor:pointer}
.g2-lnk{font-size:13px;font-weight:600;border:1px solid var(--border);border-radius:10px;padding:7px 11px;background:transparent;color:var(--text-secondary);cursor:pointer}
.g2-ready{padding-bottom:10px}
.g2-acts{display:flex;flex-wrap:wrap;align-items:center;gap:6px 8px;margin-top:12px}.g2-acts>span{font-size:12.5px;color:var(--text-muted);margin-right:4px}
.g2-pb{display:inline-flex;align-items:center;gap:6px;padding:8px 12px;border-radius:8px;border:1px solid var(--border);background:var(--bg-card);color:#a78bfa;font-size:12px;font-weight:600;cursor:pointer;transition:color .15s}[data-theme="light"] .g2-pb{color:#7c3aed}
.g2-pb:hover{color:#c4b5fd}.g2-pb.p{color:var(--ok)}
.g2-rh{display:flex;align-items:center;gap:12px}
.g2-ri{width:38px;height:38px;border-radius:10px;flex:none;display:flex;align-items:center;justify-content:center;font-size:18px;background:color-mix(in srgb,var(--due) 14%,var(--bg-inset))}
.g2-rt{flex:1;min-width:0}.g2-rt small{display:block;font-size:11.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--due)}.g2-rt b{display:block;font-size:16px;color:var(--text-primary);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.g2-ra{text-align:right}.g2-ra b{display:block;font-size:19px;color:var(--text-primary)}.g2-ra small{font-size:11.5px;color:var(--text-muted)}
.g2-rk{margin:10px 0 0;font-size:12.5px;color:var(--text-muted);line-height:1.5}
.g2-q{margin:14px 0 8px;font-size:12px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--text-muted)}
.g2-tiles{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.g2-tile{display:flex;flex-direction:column;align-items:center;gap:2px;padding:12px 8px;border-radius:14px;border:1px solid var(--border);background:var(--bg-inset);color:var(--text-primary);cursor:pointer;transition:border-color .15s,background .15s}
.g2-tile:hover{border-color:color-mix(in srgb,var(--accent-violet) 55%,transparent)}
.g2-tile i{font-style:normal;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;background:var(--bg-card);margin-bottom:4px}
.g2-tile b{font-size:13.5px}.g2-tile span{font-size:11.5px;color:var(--text-muted)}
.g2-tile.ok{border-color:color-mix(in srgb,var(--ok) 45%,transparent);background:color-mix(in srgb,var(--ok) 8%,var(--bg-inset))}.g2-tile.ok i{background:var(--ok);color:#06281d;font-weight:800}
.g2-wd{margin-top:12px!important;border-top:1px solid var(--border)!important;padding-top:10px!important}
.g2-done{display:grid;grid-template-columns:28px 1fr auto;gap:10px;align-items:center;padding:10px 0;border-top:1px solid var(--border)}.g2-done:first-of-type{border-top:0}
.g2-done b{display:block;font-size:14px;color:var(--text-primary)}.g2-done small{font-size:12px;color:var(--text-muted)}
.g2-flag{width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;background:var(--bg-inset);color:var(--text-muted)}.g2-flag.ok{background:var(--ok);color:#06281d}
.g2-mx{display:flex;flex-wrap:nowrap;align-items:center;gap:12px;margin-top:4px}
.g2-dn{position:relative;width:52px;height:52px;flex:none}.g2-dn span{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1}.g2-dn b{font-size:12.5px;color:var(--text-primary)}.g2-dn small{font-size:8px;color:var(--text-muted);margin-top:2px;text-transform:uppercase;letter-spacing:.04em}
.g2-mts{display:flex;flex-wrap:wrap;gap:8px;flex:1;min-width:0}.g2-mt{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text-secondary);background:var(--bg-inset);border:1px solid var(--border);border-radius:10px;padding:6px 10px}
.g2-mt i{width:8px;height:8px;border-radius:50%;flex:none}.g2-mt.e i{background:var(--e)}.g2-mt.d i{background:var(--dt)}.g2-mt.g i{background:var(--gd)}.g2-mt .l{font-weight:600;color:var(--text-primary);min-width:40px}
.g2-mt .v{display:flex;align-items:baseline;gap:3px}.g2-mt .v b{color:var(--text-primary);font-size:13px}.g2-mt .v small{font-size:10.5px;color:var(--text-muted)}.g2-mt .ar{color:var(--text-muted);font-size:11px}
.g2-mt em{font-style:normal;font-size:10.5px;font-weight:700;padding:2px 7px;border-radius:999px}.g2-mt em.ok{color:var(--ok);background:color-mix(in srgb,var(--ok) 13%,transparent)}.g2-mt em.warn{color:var(--warn);background:color-mix(in srgb,var(--warn) 13%,transparent)}
.g2-mt.p{border-style:dashed;background:transparent}.g2-mxn{flex-basis:100%;font-size:12px;color:var(--text-muted)}
.g2-ring{position:relative;width:64px;height:64px;flex:none;color:var(--ok)}.g2-ring.warn{color:var(--warn)}.g2-ring.due{color:var(--due)}.g2-ring span{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1}.g2-ring b{font-size:12.5px;letter-spacing:-.02em;color:var(--text-primary)}.g2-ring small{font-size:7.5px;color:var(--text-muted);margin-top:3px;text-transform:uppercase;letter-spacing:.05em}
.g2-gh{display:flex!important;align-items:center;gap:16px;text-align:left!important;margin-top:4px}.g2-gh h3{margin:0;font-size:16.5px;color:var(--text-primary)}.g2-gh p{margin:3px 0 7px;font-size:12.5px;color:var(--text-muted)}.g2-gt{flex:1;min-width:0}.g2-gt .g2-badge{margin:0;display:inline-block}
.g2-gi{width:46px;height:46px;border-radius:14px;flex:none;display:flex;align-items:center;justify-content:center;font-size:23px;background:color-mix(in srgb,var(--ok) 14%,var(--bg-inset));border:1px solid color-mix(in srgb,var(--ok) 30%,transparent)}.g2-gi.warn{background:color-mix(in srgb,var(--warn) 14%,var(--bg-inset));border-color:color-mix(in srgb,var(--warn) 30%,transparent)}.g2-gi.due{background:color-mix(in srgb,var(--due) 14%,var(--bg-inset));border-color:color-mix(in srgb,var(--due) 30%,transparent)}
.g2-goal.ok{background:color-mix(in srgb,var(--ok) 5%,var(--bg-card));border-color:color-mix(in srgb,var(--ok) 22%,var(--border))}
.g2-goal.warn{background:color-mix(in srgb,var(--warn) 6%,var(--bg-card));border-color:color-mix(in srgb,var(--warn) 28%,var(--border))}
.g2-goal.due{background:color-mix(in srgb,var(--due) 6%,var(--bg-card));border-color:color-mix(in srgb,var(--due) 28%,var(--border))}
.g2-two{display:grid;grid-template-columns:1fr auto 1fr;gap:10px;align-items:start;margin:12px 0 0 36px}.g2-orw{align-self:center;font-style:normal;font-size:11px;font-weight:700;color:var(--text-muted)}
.g2-pk{border:1px solid var(--border)!important;border-radius:12px;background:var(--bg-inset)!important;padding:4px 14px 8px}.g2-pk.sip{border-top:3px solid var(--e)}.g2-pk.buy{border-top:3px solid var(--ok)}
.g2-pkh{display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border);font-size:12.5px;color:var(--text-secondary)}.g2-pkh .g2-chip{padding:3px 7px;flex:none}.g2-pkh b{margin-left:auto;font-size:16px;color:var(--text-primary);white-space:nowrap}.g2-pkh b em{font-style:normal;font-size:11px;color:var(--text-muted)}
.g2-pkf{display:flex;justify-content:space-between;gap:10px;padding:3px 0 3px 12px;font-size:11.5px;color:var(--text-muted);border-left:2px solid var(--border);margin-left:2px}.g2-pkb{margin:6px 0 4px}
.g2-pkr{display:flex;justify-content:space-between;gap:10px;padding:6px 0;font-size:12.5px;color:var(--text-secondary)}.g2-pkr .v{white-space:nowrap;color:var(--text-muted)}.g2-pkr .v b{color:var(--text-primary)}.g2-pkr s{opacity:.7}
.g2-sum3{display:grid;grid-template-columns:1.4fr 1fr;padding-bottom:16px}.g2-sum3.one{grid-template-columns:1fr}
.g2-mixrow{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:6px 14px;margin-top:10px;padding-top:10px;border-top:1px dashed var(--border)}.g2-mixrow .g2-okline{margin:0}
.g2-sum3>div{padding:0 20px;border-left:1px solid var(--border)}.g2-sum3>div:first-child{padding-left:0;border-left:0}.g2-sum3>div:last-child{padding-right:0}
.g2-sum3 .g2-lbl{margin:0 -20px 12px}.g2-sum3>div:first-child .g2-lbl{margin-left:-24px}.g2-sum3>div:last-child .g2-lbl{margin-right:-24px}
.g2-kv{display:flex;justify-content:space-between;align-items:baseline;gap:8px;padding:4px 0;font-size:13px;color:var(--text-muted)}.g2-kv small{font-size:11px}
.g2-kv b{font-size:16px;color:var(--text-primary);white-space:nowrap}.g2-kv b.ok{color:var(--ok)}.g2-kv b.warn{color:var(--warn)}.g2-kv.big b{font-size:20px}
.g2-need{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;margin-top:8px;padding:8px 10px;border-radius:8px;font-size:13px;color:var(--text-secondary);background:color-mix(in srgb,var(--warn) 9%,transparent);border:1px solid color-mix(in srgb,var(--warn) 30%,transparent)}
.g2-need b{color:var(--text-primary)}.g2-need em{font-style:normal;font-size:11px;font-weight:700;color:var(--text-muted)}
.g2-okline{margin:8px 0 0;font-size:13px;font-weight:600;color:var(--ok)}.g2-okline.warn{color:var(--warn)}
.g2-sum{display:grid;grid-template-columns:1fr 1fr;gap:0;padding-top:0}.g2-sum .g2-lbl{margin:0 -24px 16px}.g2-sum>div:first-child .g2-lbl{margin-right:-20px}.g2-sum>div+div .g2-lbl{margin-left:-20px}.g2-sum>div+div{border-left:1px solid var(--border);padding-left:20px;margin-left:20px}
.g2-tot{display:grid;grid-template-columns:1fr 1fr;gap:12px 10px}.g2-tot span{font-size:12px;color:var(--text-muted)}.g2-tot b{display:block;font-size:19px;color:var(--text-primary);margin-top:3px}.g2-tot small{font-size:11px;color:var(--text-muted)}
.g2-mixw{position:relative}.g2-mix{height:12px;border-radius:7px;background:var(--bg-inset);display:flex;overflow:hidden;margin:6px 0 7px}
.g2-mix i{display:block;height:100%}.g2-mix .e{background:var(--e)}.g2-mix .d{background:var(--dt)}.g2-mix .g{background:var(--gd)}
.g2-plan{position:absolute;top:-3px;width:3px;height:18px;background:var(--text-primary);border-radius:2px;box-shadow:0 0 0 2px var(--bg-card)}
.g2-leg{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:12.5px;color:var(--text-secondary)}
.g2-leg span:before{content:"";display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:6px}.g2-leg .e:before{background:var(--e)}.g2-leg .d:before{background:var(--dt)}.g2-leg .g:before{background:var(--gd)}.g2-leg .p:before{background:var(--text-primary);width:3px}
.g2-msg{font-size:13px;font-weight:600;margin-top:10px;padding:8px 11px;border-radius:10px}.g2-msg.ok{background:color-mix(in srgb,var(--ok) 9%,transparent)}.g2-msg.warn{background:color-mix(in srgb,var(--warn) 10%,transparent)}
.g2-free{display:flex;flex-wrap:wrap;gap:14px 28px;align-items:center}.g2-free b{display:block;font-size:26px;color:var(--text-primary)}.g2-free span{font-size:13px;color:var(--text-secondary)}
.g2-ideas{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:14px}.g2-ideas div{background:var(--bg-inset);border-radius:12px;padding:11px 12px;font-size:13.5px;color:var(--text-primary)}.g2-ideas span{display:block;font-size:12px;color:var(--text-muted);margin-top:4px;line-height:1.4}
.g2-road{position:relative;padding:8px 0 16px;width:100%;max-width:900px;margin:0 auto}
.g2-road:before{content:"";position:absolute;left:50%;transform:translateX(-50%);top:0;bottom:0;width:18px;border-radius:10px;background:color-mix(in srgb,var(--text-muted) 22%,transparent)}
.g2-road:after{content:"";position:absolute;left:50%;transform:translateX(-50%);top:8px;bottom:8px;width:2px;background:repeating-linear-gradient(color-mix(in srgb,var(--text-primary) 40%,transparent) 0 10px,transparent 10px 20px)}
.g2-now{position:relative;z-index:1;width:max-content;margin:0 auto 44px;background:var(--bg-card);border:1px solid var(--border);border-radius:999px;padding:7px 14px;font-size:12.5px;color:var(--text-secondary)}
.g2-yr{position:relative;z-index:3;margin:0 auto -30px;width:64px;height:64px;border-radius:50%;background:var(--bg-base);border:3px solid var(--ok);display:flex;flex-direction:column;align-items:center;justify-content:center;box-shadow:0 0 0 6px var(--bg-base)}
.g2-yr.w{border-color:var(--warn)}.g2-yr.due{border-color:var(--due)}.g2-yr i{font-style:normal;font-size:18px;line-height:1}.g2-yr b{font-size:13px;color:var(--text-primary);margin-top:2px}
.g2-grp{position:relative;z-index:1;margin-bottom:64px}.g2-grp .g2-goal+.g2-goal{margin-top:36px}
.g2-goal{padding-top:40px}
.g2-badge{display:inline-block;margin-top:8px;font-size:12px;font-weight:700;border-radius:999px;padding:5px 10px}
.g2-badge.ok{background:color-mix(in srgb,var(--ok) 14%,transparent)}.g2-badge.warn{background:color-mix(in srgb,var(--warn) 14%,transparent)}.g2-badge.due{color:var(--due);background:color-mix(in srgb,var(--due) 14%,transparent)}
.g2-prog{display:flex;align-items:center;gap:10px;margin:14px 0 4px}.g2-prog>div{flex:1;height:8px;border-radius:5px;background:var(--bg-inset);overflow:hidden}.g2-prog i{display:block;height:100%;border-radius:5px;background:var(--ok)}
.g2-goal.warn .g2-prog i{background:var(--warn)}.g2-goal.due .g2-prog i{background:var(--due)}.g2-prog b{font-size:13px;color:var(--text-primary)}
.g2-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:12px 0}.g2-stats.five{grid-template-columns:repeat(5,1fr)}.g2-stats b em{font-style:normal;font-size:11.5px;color:var(--text-muted);margin-left:2px}
.g2-stats>div.fr:before{background:var(--ok);opacity:1}.g2-all .g2-lbl{margin-bottom:0}.g2-sumf{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px}.g2-sumf .g2-link{font-size:12.5px}
.g2-stats>div{position:relative;background:var(--bg-inset);border:1px solid var(--border);border-radius:12px;padding:10px 12px 10px 14px;overflow:hidden}.g2-stats>div:before{content:"";position:absolute;left:0;top:10px;bottom:10px;width:3px;border-radius:0 3px 3px 0;background:var(--text-muted);opacity:.5}
.g2-stats>div.hv:before{background:var(--e);opacity:1}.g2-stats>div.nd:before{background:var(--dt);opacity:1}.g2-stats>div.gp.ok:before{background:var(--ok);opacity:1}.g2-stats>div.gp.warn:before{background:var(--warn);opacity:1}.g2-stats>div.tg:before{background:var(--gd);opacity:1}
.g2-stats>div.gp.warn{background:color-mix(in srgb,var(--warn) 8%,var(--bg-inset))}.g2-stats>div.gp.ok{background:color-mix(in srgb,var(--ok) 7%,var(--bg-inset))}
.g2-stats span{display:flex;align-items:center;gap:6px;font-size:11.5px;color:var(--text-muted)}.g2-stats span i{font-style:normal;font-size:10px;width:16px;height:16px;border-radius:5px;display:inline-flex;align-items:center;justify-content:center;background:var(--bg-card);color:var(--text-secondary)}.g2-stats b{display:block;font-size:15.5px;margin-top:5px;color:var(--text-primary);white-space:nowrap}.g2-stats small{display:block;font-size:11px;color:var(--text-muted);margin-top:2px}
.g2-stats b.ok{color:var(--ok)}.g2-stats b.warn{color:var(--warn)}
.g2-sip{margin-top:12px;font-size:13px;color:var(--text-secondary);display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px}.g2-sip b{color:var(--text-primary)}
.g2 details{margin-top:12px;border-top:1px solid var(--border);padding-top:10px}
.g2 summary{cursor:pointer;font-size:13px;font-weight:600;color:var(--accent-violet);list-style:none;display:flex;justify-content:space-between}
.g2 summary::-webkit-details-marker{display:none}.g2 summary:after{content:"Show ▾";color:var(--text-muted);font-weight:500}.g2 details[open]>summary:after{content:"Hide ▴"}
.g2-fd{display:grid;grid-template-columns:1fr auto;gap:2px 10px;padding:9px 0;border-top:1px solid var(--border)}.g2-fd:first-of-type{border-top:0}
.g2-fd b{font-size:13.5px;font-weight:600;color:var(--text-primary)}.g2-fd .v{font-size:13.5px;font-weight:700;color:var(--text-primary);text-align:right}.g2-fd small{font-size:12px;color:var(--text-muted)}
.g2-tag{font-size:11px;font-weight:700;border-radius:6px;padding:2px 6px;margin-left:6px}
.g2-tag.e{color:var(--e);background:color-mix(in srgb,var(--e) 14%,transparent)}.g2-tag.d{color:var(--dt);background:color-mix(in srgb,var(--dt) 14%,transparent)}.g2-tag.g{color:var(--gd);background:color-mix(in srgb,var(--gd) 14%,transparent)}.g2-tag.l{color:var(--text-secondary);background:var(--bg-inset)}
 .g2-curve{position:absolute;inset:0;width:100%;height:100%;z-index:0;overflow:visible;pointer-events:none}.g2-curve path{fill:none;stroke-linecap:round}
.g2-curve .bed{stroke:color-mix(in srgb,var(--text-muted) 22%,transparent);stroke-width:18}.g2-curve .mid{stroke:color-mix(in srgb,var(--text-primary) 40%,transparent);stroke-width:2;stroke-dasharray:10 10}
.g2-road.curvy{max-width:1040px}.g2-road.curvy:before,.g2-road.curvy:after{display:none}
.g2-road.curvy .g2-grp{width:60%;margin-left:auto;margin-right:auto}.g2-road.curvy .side-l .g2-grp{margin-left:0}.g2-road.curvy .side-r .g2-grp{margin-right:0}
.g2-road.curvy .side-l .g2-yr{margin-left:calc(30% - 32px)}.g2-road.curvy .side-r .g2-yr{margin-left:calc(70% - 32px)}
.g2-road.curvy .g2-now{transform:translateX(-50%);margin-left:50%}.g2-road.curvy .g2-now.side-l{margin-left:30%}.g2-road.curvy .g2-now.side-r{margin-left:70%}
.g2-road.curvy .g2-grp{margin-bottom:170px}.g2-road.curvy .g2-now{margin-bottom:40px}.g2-road.curvy .g2-now.after{margin-top:-60px}.g2-road.curvy{padding-top:40px}
.g2-pulse{animation:g2p 2.2s ease-out 3;border-color:color-mix(in srgb,#a78bfa 55%,var(--border))}
@keyframes g2p{0%{box-shadow:0 0 0 0 color-mix(in srgb,#a78bfa 55%,transparent)}70%{box-shadow:0 0 0 8px transparent}100%{box-shadow:0 0 0 0 transparent}}
@media(prefers-reduced-motion:reduce){.g2-pulse{animation:none}}
.g2-wdl{margin-top:8px;border-top:1px solid var(--border)}
.g2-rdy{margin-top:12px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;border:1px solid color-mix(in srgb,var(--due) 35%,var(--border));border-radius:12px;padding:12px 14px;background:color-mix(in srgb,var(--due) 6%,var(--bg-inset))}
.g2-rdy>div>b{display:block;font-size:14px;color:var(--due)}.g2-rdy>div>span{display:block;font-size:12px;color:var(--text-muted);margin-top:3px}
.g2-wdmh{font-size:13.5px;color:var(--text-secondary);margin:0 0 6px}.g2-wdmh b{color:var(--text-primary)}.g2-wdf{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
.g2-shs{margin-top:14px;padding-top:14px;border-top:1px dashed var(--border)}.g2-all .g2-two{margin-left:0}.g2-all .g2-step{padding:0;border:0}
.g2-bkh{display:flex;justify-content:flex-end;margin-bottom:8px}
.g2-mv{padding:14px 0 6px}.g2-mv+.g2-mv{border-top:1px solid var(--border)}
.g2-mvh{display:flex;align-items:center;gap:12px}.g2-mvi{width:40px;height:40px;border-radius:12px;flex:none;display:flex;align-items:center;justify-content:center;font-size:20px;background:var(--bg-inset);border:1px solid var(--border)}
.g2-mvt{flex:1;min-width:0}.g2-mvt small{display:block;font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--text-muted)}.g2-mvt b{display:block;font-size:15px;color:var(--text-primary);margin:2px 0}.g2-mvt span{font-size:12.5px;color:var(--text-secondary)}
.g2-mva{text-align:right}.g2-mva b{display:block;font-size:18px;color:var(--text-primary)}.g2-mva small{font-size:11px;color:var(--text-muted)}
.g2-mv .g2-two{margin-left:0}.g2-pk.sell{border-top:3px solid var(--sell)!important}.g2-pkr small{display:block;font-size:11px;color:var(--text-muted);margin-top:1px}
.g2-hiw{margin-top:14px;padding-top:14px;border-top:1px solid var(--border)}.g2-hiwh{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--text-muted);margin-bottom:10px}
.g2-ract:empty{display:none}
div:has(> .g2-grp .g2-lrow.due) > .g2-yr{border-color:var(--warn);animation:g2due 2.4s ease-in-out infinite}
.g2-goal:has(.g2-lrow.due) .g2-gt::after{content:"● Refill due";display:inline-block;margin-left:6px;font-size:12px;font-weight:700;color:var(--warn);background:color-mix(in srgb,var(--warn) 12%,transparent);border-radius:999px;padding:5px 10px;animation:g2blink 1.6s ease-in-out infinite}
.g2-lrow{width:100%;display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:12px;padding:10px 0 0;border:0;border-top:1px solid var(--border);background:none;cursor:pointer;text-align:left;font-size:13px;font-weight:600;color:var(--accent-violet)}
.g2-lrow em{font-style:normal;font-weight:500;color:var(--text-muted);white-space:nowrap}.g2-lrow small{display:block;font-size:11.5px;font-weight:500;color:var(--text-muted);margin-top:2px}
.g2-lrow.due{margin-top:12px;padding:10px 12px;border:1px solid color-mix(in srgb,var(--warn) 45%,var(--border));border-radius:10px;background:color-mix(in srgb,var(--warn) 8%,var(--bg-inset));color:var(--warn);animation:g2due 2.4s ease-in-out infinite}
.g2-lrow.due em{color:var(--warn);font-weight:700}
.g2-dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--warn);margin-right:8px;vertical-align:middle;animation:g2blink 1.2s ease-in-out infinite}
@keyframes g2due{0%,100%{box-shadow:0 0 0 0 color-mix(in srgb,var(--warn) 0%,transparent)}50%{box-shadow:0 0 0 4px color-mix(in srgb,var(--warn) 22%,transparent)}}
@keyframes g2blink{0%,100%{opacity:1}50%{opacity:.25}}
@media(prefers-reduced-motion:reduce){.g2-lrow.due,.g2-dot{animation:none}}
/* calm palette: neutral surfaces, one status colour per card */
.g2-goal.ok,.g2-goal.warn,.g2-goal.due{background:var(--bg-card);border-color:var(--border)}
.g2-gi,.g2-gi.warn,.g2-gi.due{background:var(--bg-inset);border:1px solid var(--border)}
.g2-stats>div,.g2-stats>div.gp.ok,.g2-stats>div.gp.warn{background:var(--bg-inset);border:1px solid var(--border);padding:11px 14px}
.g2-stats>div:before{display:none}.g2-stats span i{display:none}.g2-stats span{font-size:11.5px;letter-spacing:.02em}
.g2-stats b{font-size:16px;font-weight:600}.g2-stats b.ok{color:var(--ok)}.g2-stats b.warn{color:var(--warn)}
.g2-badge.warn{color:var(--warn);background:color-mix(in srgb,var(--warn) 12%,transparent)}.g2-badge.ok{color:var(--ok);background:color-mix(in srgb,var(--ok) 12%,transparent)}
.g2-mx2{display:flex;flex-wrap:wrap;align-items:center;gap:6px 14px;font-size:13px;color:var(--text-secondary);padding:2px 2px 0}.g2-mx2 .k{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--text-muted)}
.g2-mx2 b{color:var(--text-primary);font-weight:600}.g2-mx2 small{color:var(--text-muted);font-size:12px}.g2-mx2 .sep{width:1px;height:14px;background:var(--border)}
.g2-mx2 em{font-style:normal;font-size:12px;font-weight:600;margin-left:auto}.g2-mx2 em.ok{color:var(--ok)}.g2-mx2 em.warn{color:var(--warn)}.g2-mx2 em.soft{color:var(--text-muted);font-weight:500}.g2-mx2 .g2-mxn{flex-basis:100%;margin-top:2px}.g2-mx2 .g2-mxn{color:var(--text-muted)}
@media(max-width:640px){
 .g2-gh{gap:10px;margin-top:34px}.g2-gt{padding-right:4px}.g2-gi{width:40px;height:40px;font-size:20px}.g2-ring{transform:scale(.85)}.g2-mt{padding:4px 7px;font-size:11.5px}
 .g2-two{grid-template-columns:1fr;margin-left:0}.g2-orw{text-align:center}
 .g2-sum3,.g2-sum3.one{grid-template-columns:1fr}.g2-sum3>div{padding:0;border-left:0}.g2-sum3>div+div{border-top:1px solid var(--border);margin-top:14px}.g2-sum3 .g2-lbl,.g2-sum3>div:first-child .g2-lbl,.g2-sum3>div:last-child .g2-lbl{margin:0 -16px 12px}
 .g2-card{padding:0 16px 16px}.g2-lbl{margin:0 -16px 14px;padding:12px 16px;font-size:12.5px}.g2-sum .g2-lbl{margin:0 -16px 14px}.g2-sum>div:first-child .g2-lbl{margin-right:-16px}.g2-sum>div+div .g2-lbl{margin:0 -16px 14px}
 .g2-goal{padding-top:48px}.g2-ask{margin-left:0}.g2-acts>span{width:100%}.g2-pb{padding:0 10px}
 .g2-jars{grid-template-columns:1fr}.g2-jh{display:flex;align-items:center;gap:12px;text-align:left}.g2-jh svg{margin:0}.g2-flow{grid-template-columns:1fr;text-align:left}
 .g2-tot3{grid-template-columns:1fr 1fr!important}.g2-or,.g2-more{margin-left:0}
 .g2-card{padding:14px;border-radius:16px}.g2-sum{grid-template-columns:1fr}.g2-sum>div+div{border-left:0;padding-left:0;margin-left:0;border-top:1px solid var(--border);padding-top:14px;margin-top:14px}
 .g2-stats,.g2-stats.five{grid-template-columns:1fr 1fr}.g2-stats.five>div.fr{grid-column:span 2}.g2-ideas,.g2-choices{grid-template-columns:1fr}.g2-opts{grid-template-columns:1fr}.g2-opts em{text-align:center}
 .g2-row{grid-template-columns:70px 1fr;padding-left:0}.g2-v{grid-column:2;text-align:left}.g2-how,.g2-choices,.g2-opts{margin-left:0}
 .g2-yr{width:56px;height:56px}.g2-grp{margin-bottom:48px}.g2-grp .g2-goal+.g2-goal{margin-top:28px}.g2-now{margin-bottom:34px}
}
`
