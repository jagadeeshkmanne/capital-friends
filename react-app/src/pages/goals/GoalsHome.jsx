// The Goals page (one page): To do this month → all goals together → free money → the road of goals by year.
// Numbers come from the goals pool (Money for goals), buildGoalPlan (pool mode), familyPlan and goalTodo.
import { formatINR, splitFundName } from '../../data/familyData'

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

function MixBar({ m, plan }) {
  if (!m) return null
  return (
    <>
      <div className="g2-mixw"><div className="g2-mix"><i className="e" style={{ width: `${m.e}%` }} /><i className="d" style={{ width: `${m.d}%` }} /><i className="g" style={{ width: `${m.g}%` }} /></div>{plan != null && <span className="g2-plan" style={{ left: `${plan}%` }} />}</div>
      <div className="g2-leg"><span className="e">Equity {m.e}%</span><span className="d">Debt {m.d}%</span>{m.g > 0 && <span className="g">Gold {m.g}%</span>}{plan != null && <span className="p">Plan {plan}%</span>}</div>
    </>
  )
}

export default function GoalsHome({ plan, todo, pool, plans, closed = [], mfHoldings, mfPortfolios, ctx, renderBuckets, onMoney }) {
  const { mt, navigate, pname, closeGoal } = ctx
  const live = plans
  const has = live.reduce((t, p) => t + p.has, 0), need = live.reduce((t, p) => t + (p.state === 'due' ? p.has : p.need), 0)
  const amounts = live.reduce((t, p) => t + p.target, 0)
  const short = live.filter((p) => p.state === 'short').reduce((t, p) => t - p.gap, 0)
  const fam = plan.family
  const famMix = fam && fam.P > 0 ? { e: Math.round(fam.haveEq), d: 100 - Math.round(fam.haveEq), g: 0 } : null
  const extra = pool.extra || 0, extraEq = extra > 0 ? Math.round(((pool.extraEq || 0) / extra) * 100) : 0
  const shortStep = todo.steps.find((s) => s.t === 'short')
  const groups = [...new Set(live.map((p) => yearOf(p.goal)))].sort((a, b) => a - b).map((y) => { const ps = live.filter((p) => yearOf(p.goal) === y); return { y, ps, past: ps.every((p) => p.years <= 0) } })

  if (!live.length) return <div className="g2 g2-card"><p className="g2-hint">No goals yet. <a className="g2-link" onClick={() => navigate('/goals/classic?add=1')}>Add your first goal</a>.</p><style>{CSS}</style></div>

  return (
    <div className="g2">
      <style>{CSS}</style>

      {todo.banner && (
        <div className="g2-banner">
          <b>⚠️ Your current SIPs and investments can't reach your goals.</b>
          <span>Your SIPs today: <b>{L(todo.banner.runningSip)}/month</b>. Your goals need about <b>{L(todo.banner.needSip)}/month</b>, so <b>{L(todo.banner.extraSip)}/month more</b>. Raise your SIPs if you can, or grow your active income (upskill, a side income), or move a goal's date later.</span>
        </div>
      )}

      {/* 1. To do this month */}
      <div className="g2-card g2-todo">
        <div className="g2-lbl"><span>To do this month</span><span>{todo.steps.length ? `${todo.steps.length} step${todo.steps.length > 1 ? 's' : ''}` : ''}</span></div>
        {!todo.steps.length && <div className="g2-ok">✓ Nothing to do this month. Keep your SIPs going.</div>}
        {todo.steps.map((s, i) => <Step key={i} s={s} n={i + 1} mt={mt} pname={pname} closeGoal={closeGoal} navigate={navigate} />)}
      </div>

      {/* 2. All goals together */}
      <div className="g2-card g2-sum">
        <div>
          <div className="g2-lbl"><span>All goals together</span></div>
          <div className="g2-tot g2-tot3">
            <div><span>Have today</span><b>{L(has)}</b></div>
            <div><span>Need today</span><b>{L(need)}</b><small>with your SIPs</small></div>
            <div><span>Gap</span><b className={short > 1000 ? 'warn' : 'ok'}>{short > 1000 ? `${L(short)} short` : 'On track'}</b></div>
          </div>
          <div className="g2-opts g2-opts-sum">
            <div className="g2-opt sip"><span>SIP / month</span><b>{shortStep ? `+${L(shortStep.sip)}` : '—'}</b><small>{shortStep ? 'more, on top of today\'s SIPs' : 'nothing more needed'}</small></div>
            <em>OR</em>
            <div className="g2-opt lump"><span>Lump sum today</span><b>{shortStep ? L(shortStep.lump) : '—'}</b><small>{shortStep ? 'one time' : 'nothing more needed'}</small></div>
          </div>
          <p className="g2-hint">SIPs running today: <b>{L(todo.runningSip)}/month</b> across your portfolios · Goal amounts {L(amounts)}</p>
          <button className="g2-btn" onClick={onMoney}>Money for goals ›</button>
        </div>
        <div>
          <div className="g2-lbl"><span>Equity vs debt · all goals</span></div>
          <MixBar m={famMix} plan={fam && fam.P > 0 ? Math.round(fam.needEq) : null} />
          {fam?.status === 'steps' ? <div className="g2-msg warn">Off the plan by more than 10 points: see To do.</div> : <div className="g2-msg ok">✓ Close to your plan. Nothing to move.</div>}
          <p className="g2-hint">Checked for all goals together. Near goals hold the safe money and far goals the equity, so each goal's own bar can look different.</p>
        </div>
      </div>

      {/* 3. Free money */}
      {extra > 1000 && (
        <div className="g2-card">
          <div className="g2-lbl"><span>Free money · not needed by your goals</span></div>
          <div className="g2-free"><div><b>{L(extra)}</b><span>Your goals need {L(need)} today. The rest is yours.</span></div>
            <div style={{ flex: 1, minWidth: 200 }}><MixBar m={{ e: extraEq, d: 100 - extraEq, g: 0 }} /></div></div>
          <div className="g2-ideas">
            <div>📈 <b>Keep it growing</b><span>It stays invested. If a goal falls short later, it is covered from here first.</span></div>
            <div>🎯 <b>Add a goal</b><span>A new goal takes its share from here.</span></div>
            <div>💸 <b>Lower a SIP</b><span>Your goals don't need more money right now.</span></div>
          </div>
        </div>
      )}

      {/* 4. The road: a year, then that year's goals */}
      <div className="g2-road">
        {groups.filter((x) => x.past).map(({ y, ps }) => (
          <div key={y}>
            <div className="g2-yr due"><i>{icon(ps[0].goal)}</i><b>{y}</b></div>
            <div className="g2-grp">{ps.map((p) => <GoalCard key={p.goal.goalId} p={p} mt={mt} pname={pname} renderBuckets={renderBuckets} />)}</div>
          </div>
        ))}
        <div className="g2-now">📍 Today · {new Date().toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</div>
        {groups.filter((x) => !x.past).map(({ y, ps }) => (
          <div key={y}>
            <div className={`g2-yr ${ps.some((p) => p.state === 'short') ? 'w' : ''} ${ps.some((p) => p.state === 'due' && !p.isRet) ? 'due' : ''}`}><i>{icon(ps[0].goal)}</i><b>{y}</b></div>
            <div className="g2-grp">{ps.map((p) => <GoalCard key={p.goal.goalId} p={p} mt={mt} pname={pname} renderBuckets={renderBuckets} />)}</div>
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
        : <div className="g2-btl"><div className={!p.bucketMode ? 'on' : ''}>Now: one growth mix</div><div className={p.bucketMode && !retired ? 'on' : ''}>{yearOf(p.goal) - 5}: fill the jars</div><div>{yearOf(p.goal)}: live from them</div></div>}
      <div className="g2-jars">{jar('inc', 'Income', '2 years of expenses · safe')}{jar('stb', 'Stability', 'next 5 years · hybrid / debt')}{jar('gro', 'Growth', 'the rest · equity')}</div>
      <div className="g2-flow"><div>↓ pays your monthly income</div><div>→ refills Income once a year</div><div>→ refills Stability after good years</div></div>
      <p className="g2-hint">{retired ? 'You spend only from Income. Once a year To do shows the refill (sell units from Stability → buy the liquid fund). After a market fall it says: don\'t sell Growth this year.' : p.bucketMode ? 'In the last 5 years the app fills Income and Stability step by step (one step a year, in To do).' : `Until ${yearOf(p.goal) - 5} everything grows together; then the app starts filling the jars.`}{onOpen && <> <a className="g2-link" onClick={() => onOpen(p)}>Open the buckets page ›</a></>}</p>
    </div>
  )
}

function GoalCard({ p, mt, pname, renderBuckets }) {
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
      <div className="g2-gh"><h3>{icon(g)} {mt(g.goalName)}</h3><p>{monthYear(g)} · {yrs}{g.familyMemberName ? ` · ${mt(g.familyMemberName)}` : ''}</p><span className={`g2-badge ${st[0]}`}>{st[1]}</span></div>
      <div className="g2-prog"><div><i style={{ width: `${pct}%` }} /></div><b>{pct}%</b></div>
      <div className="g2-stats">
        <div><span>Have today</span><b>{L(p.has)}</b></div>
        <div><span>Need today</span><b>{L(due ? p.target : p.need)}</b><small>{due ? 'the goal amount' : 'with your SIP'}</small></div>
        <div><span>Gap</span><b className={gap[0]}>{gap[1]}</b></div>
        <div><span>Goal amount</span><b>{L(p.target)}</b><small>in {yearOf(g)}</small></div>
      </div>
      <MixBar m={mixOf(items)} plan={p.eqTarget} />
      {(due || p.state === 'short') && <div className="g2-sip"><span>{due ? (mixOf(items)?.e > 10 ? `Kept for it (${mixOf(items).e}% still in equity: withdraw that part first). See To do.` : 'Kept in safe funds for it. See To do: withdraw, then tell the app.') : <b className="warn">Short: see the SIP / lump sum in To do</b>}</span></div>}
      {items.length > 0 && (
        <details><summary>Investments in this goal ({items.length})</summary>
          {items.map((it, i) => { const t = tagOf(it); return (
            <div key={i} className="g2-fd"><b>{it.kind === 'mf' ? fname(it.holding) : it.kind === 'stock' ? (it.holding.symbol || it.holding.stockName) : mt(it.holding?.investmentName || it.holding?.investmentType || 'Investment')}<span className={`g2-tag ${t[0]}`}>{t[1]}</span></b><span className="v">{L(it.value)}</span>
              <small>{it.kind === 'other' ? (/epf|ppf|nps|vpf|sukanya/i.test(it.holding?.investmentType || '') ? 'retirement only · never sold' : 'other investments') : pname(it.portfolioId)}{it.fraction != null && it.fraction < 0.999 ? ` · ${Math.round(it.fraction * 100)}% of it for this goal` : ''}</small></div>) })}
        </details>
      )}
      {p.isRet && <details open={p.bucketMode}><summary>Retirement buckets {retired ? '· living from them' : p.bucketMode ? '· filling now' : `· from ${yearOf(g) - 5}`}</summary><Buckets p={p} items={items} retired={retired} mt={mt} pname={pname} onOpen={renderBuckets} /></details>}
    </div>
  )
}

function Step({ s, n, mt, pname, closeGoal, navigate }) {
  if (s.t === 'ready') {
    const where = s.rows.slice(0, 2).map((r) => `${r.kind === 'other' ? mt(r.name) : splitFundName(r.name || '').main} ${L(r.value)}`)
    return (
    <div className="g2-step g2-ready">
      <div className="g2-rh">
        <div className="g2-ri">{icon(s.goal)}</div>
        <div className="g2-rt"><small>Date reached · {monthYear(s.goal)}</small><b>{mt(s.goal.goalName)}</b></div>
        <div className="g2-ra"><b>{L(s.has)}</b><small>ready to use</small></div>
      </div>
      <p className="g2-rk">Kept in {where.join(' · ')}{s.rows.length > 2 ? ` · +${s.rows.length - 2} more` : ''}</p>
      <div className="g2-acts"><span>What happened?</span>
        <button className="g2-pb p" title="Close the goal" onClick={() => closeGoal(s.goal, 'used')}>✓ I used it</button>
        <button className="g2-pb" title="Pick a new date" onClick={() => navigate(`/goals/classic?edit=${encodeURIComponent(s.goal.goalId)}`)}>Need more time</button>
        <button className="g2-pb" title="Its money becomes free" onClick={() => closeGoal(s.goal, 'not')}>Not needed</button>
      </div>
      <details className="g2-wd"><summary>How to withdraw ({s.rows.length})</summary>{s.rows.map((r, i) => <WdRow key={i} r={r} mt={mt} pname={pname} />)}<p className="g2-hint">After you close the goal, anything left becomes free money for your other goals.</p></details>
    </div>
  ) }
  if (s.t === 'short') {
    const byPort = {}
    for (const b of s.buys) (byPort[b.portfolioId] = byPort[b.portfolioId] || []).push(b)
    return (
    <div className="g2-step">
      <div className="g2-sh"><span className="g2-n">{n}</span><div><small>All goals together · {L(s.gap)} short</small><b>Raise your SIP, or invest once</b><p>Do one of these. It goes to the goals that are short ({s.goals.map((g) => mt(g.goalName)).join(', ')}).</p></div></div>
      {s.sipRows.map((r, i) => <Row key={'p' + i} chip="sip" k="SIP" a={r.portfolioId ? pname(r.portfolioId) : 'Start a new SIP'} b={r.portfolioId ? 'Change the portfolio SIP. It splits by your fund targets.' : 'in an equity fund for these goals'} v={r.portfolioId ? `${L(r.sipFrom)} → ${L(r.sipFrom + r.sip)}` : `+${L(r.sip)}/mo`} />)}
      <div className="g2-or">OR ONE TIME</div>
      {Object.keys(byPort).length ? Object.entries(byPort).map(([pid, bs]) => <Row key={pid} chip="buy" k="BUY" a={`${pname(pid)} · ${L(bs.reduce((t, b) => t + b.amount, 0))}`} b="Split by your fund targets, worked out on today's values" v={L(bs.reduce((t, b) => t + b.amount, 0))} />)
        : <Row chip="buy" k="BUY" a="An equity fund for these goals" b="one time" v={L(s.lump)} />}
      {s.buys.length > 0 && <details className="g2-more"><summary>Show funds (changes with the market)</summary>{s.buys.map((b, i) => <Row key={i} chip="buy" k="BUY" a={fname(b.fund)} b={pname(b.portfolioId)} v={L(b.amount)} />)}</details>}
      <p className="g2-how">Done it? Import your CAS later and the app checks it.</p>
    </div>
  ) }
  if (s.t === 'cash') return (
    <div className="g2-step">
      <div className="g2-sh"><span className="g2-n">{n}</span><div><small>💰 Idle cash · your goals need more equity</small><b>Invest {L(s.total)} from {mt(s.from?.name || 'your savings')}</b><p>No selling, no tax.</p></div></div>
      {s.rows.map((r, i) => <Row key={i} chip="buy" k="BUY" a={r.fund ? fname(r.fund) : 'An equity fund of your choice'} b={r.fund ? pname(r.portfolioId) : 'any equity fund'} v={L(r.amount)} />)}
    </div>
  )
  if (s.t === 'switch') return (
    <div className="g2-step">
      <div className="g2-sh"><span className="g2-n">{n}</span><div><small>🔁 All goals · more than 10 points off the plan</small><b>One switch: {L(s.total)} {s.toSafe ? 'from equity to safe funds' : 'from debt to equity'}</b><p>In {pname(s.portfolioId)}: the money only moves between your funds.</p></div></div>
      {s.sells.map((r, i) => <Row key={'s' + i} chip="sell" k="SELL" a={fname(r.fund)} b={`${r.units != null ? `${U(r.units)} units` : ''}${r.nav ? ` · NAV ₹${Number(r.nav).toFixed(2)}` : ''}`} v={`≈ ${L(r.value)}`} />)}
      {s.buys.map((r, i) => <Row key={'b' + i} chip="buy" k="BUY" a={r.fund ? fname(r.fund) : (r.wantSafe ? 'A liquid or debt fund' : 'An equity fund')} b="the money from the sale · units depend on that day's NAV" v={L(r.value)} />)}
      <p className="g2-how">Sell in units, buy in ₹. Selling may have tax.</p>
    </div>
  )
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
.g2-opt.sip{background:color-mix(in srgb,var(--e) 11%,var(--bg-card));border-color:color-mix(in srgb,var(--e) 40%,transparent)}.g2-opt.sip span{color:var(--e)}
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
.g2-pb{height:30px;padding:0 12px;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--text-secondary);font-size:12.5px;font-weight:600;cursor:pointer}
.g2-pb:hover{border-color:var(--text-muted);color:var(--text-primary)}.g2-pb.p{background:#7c3aed;border-color:#7c3aed;color:#fff}.g2-pb.p:hover{background:#6d28d9}
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
.g2-gh{text-align:center}.g2-gh h3{margin:0;font-size:17px;color:var(--text-primary)}.g2-gh p{margin:3px 0 0;font-size:12.5px;color:var(--text-muted)}
.g2-badge{display:inline-block;margin-top:8px;font-size:12px;font-weight:700;border-radius:999px;padding:5px 10px}
.g2-badge.ok{background:color-mix(in srgb,var(--ok) 14%,transparent)}.g2-badge.warn{background:color-mix(in srgb,var(--warn) 14%,transparent)}.g2-badge.due{color:var(--due);background:color-mix(in srgb,var(--due) 14%,transparent)}
.g2-prog{display:flex;align-items:center;gap:10px;margin:14px 0 4px}.g2-prog>div{flex:1;height:8px;border-radius:5px;background:var(--bg-inset);overflow:hidden}.g2-prog i{display:block;height:100%;border-radius:5px;background:var(--ok)}
.g2-goal.warn .g2-prog i{background:var(--warn)}.g2-goal.due .g2-prog i{background:var(--due)}.g2-prog b{font-size:13px;color:var(--text-primary)}
.g2-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:12px 0}
.g2-stats div{background:var(--bg-inset);border-radius:12px;padding:10px 12px}.g2-stats span{display:block;font-size:11.5px;color:var(--text-muted)}.g2-stats b{display:block;font-size:15.5px;margin-top:4px;color:var(--text-primary);white-space:nowrap}.g2-stats small{display:block;font-size:11px;color:var(--text-muted);margin-top:2px}
.g2-stats b.ok{color:var(--ok)}.g2-stats b.warn{color:var(--warn)}
.g2-sip{margin-top:12px;font-size:13px;color:var(--text-secondary);display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px}.g2-sip b{color:var(--text-primary)}
.g2 details{margin-top:12px;border-top:1px solid var(--border);padding-top:10px}
.g2 summary{cursor:pointer;font-size:13px;font-weight:600;color:var(--accent-violet);list-style:none;display:flex;justify-content:space-between}
.g2 summary::-webkit-details-marker{display:none}.g2 summary:after{content:"Show ▾";color:var(--text-muted);font-weight:500}.g2 details[open]>summary:after{content:"Hide ▴"}
.g2-fd{display:grid;grid-template-columns:1fr auto;gap:2px 10px;padding:9px 0;border-top:1px solid var(--border)}.g2-fd:first-of-type{border-top:0}
.g2-fd b{font-size:13.5px;font-weight:600;color:var(--text-primary)}.g2-fd .v{font-size:13.5px;font-weight:700;color:var(--text-primary);text-align:right}.g2-fd small{font-size:12px;color:var(--text-muted)}
.g2-tag{font-size:11px;font-weight:700;border-radius:6px;padding:2px 6px;margin-left:6px}
.g2-tag.e{color:var(--e);background:color-mix(in srgb,var(--e) 14%,transparent)}.g2-tag.d{color:var(--dt);background:color-mix(in srgb,var(--dt) 14%,transparent)}.g2-tag.g{color:var(--gd);background:color-mix(in srgb,var(--gd) 14%,transparent)}.g2-tag.l{color:var(--text-secondary);background:var(--bg-inset)}
 @media(max-width:640px){
 .g2-card{padding:0 16px 16px}.g2-lbl{margin:0 -16px 14px;padding:12px 16px;font-size:12.5px}.g2-sum .g2-lbl{margin:0 -16px 14px}.g2-sum>div:first-child .g2-lbl{margin-right:-16px}.g2-sum>div+div .g2-lbl{margin:0 -16px 14px}
 .g2-goal{padding-top:48px}.g2-ask{margin-left:0}.g2-acts>span{width:100%}.g2-pb{padding:0 10px}
 .g2-jars{grid-template-columns:1fr}.g2-jh{display:flex;align-items:center;gap:12px;text-align:left}.g2-jh svg{margin:0}.g2-flow{grid-template-columns:1fr;text-align:left}
 .g2-tot3{grid-template-columns:1fr 1fr!important}.g2-or,.g2-more{margin-left:0}
 .g2-card{padding:14px;border-radius:16px}.g2-sum{grid-template-columns:1fr}.g2-sum>div+div{border-left:0;padding-left:0;margin-left:0;border-top:1px solid var(--border);padding-top:14px;margin-top:14px}
 .g2-stats{grid-template-columns:1fr 1fr}.g2-ideas,.g2-choices{grid-template-columns:1fr}.g2-opts{grid-template-columns:1fr}.g2-opts em{text-align:center}
 .g2-row{grid-template-columns:70px 1fr;padding-left:0}.g2-v{grid-column:2;text-align:left}.g2-how,.g2-choices,.g2-opts{margin-left:0}
 .g2-yr{width:56px;height:56px}.g2-grp{margin-bottom:48px}.g2-grp .g2-goal+.g2-goal{margin-top:28px}.g2-now{margin-bottom:34px}
}
`
