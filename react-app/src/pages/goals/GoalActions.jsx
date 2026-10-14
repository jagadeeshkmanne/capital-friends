// What to do for one goal, the same on the laptop and the phone: one card per action with what (title),
// why (one line) and one button; the full steps (units, where to buy, the withdraw list) open in a window.
import { useState } from 'react'
import { ShieldCheck, CheckCircle2, TrendingUp, ListChecks, Layers } from 'lucide-react'
import Modal from '../../components/Modal'
import WithdrawPanel from './WithdrawPanel'
import { Step, GOALS_HOME_CSS, AsideCtx } from './GoalsHome'
import { L, StepRow, GP_CSS, realSteps } from './GoalsPlanPage'
import { RetirementActions, useRetirementDue } from './RetirementBucketsPage'

export function ActionCard({ icon: I, color, title, why, button, onClick, children }) {
  return (
    <div className="mb-3 rounded-2xl border bg-[var(--bg-card)] px-4 py-3.5" style={{ borderColor: `${color}55` }}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ background: `${color}22`, color }}><I size={18} /></span>
        <div className="min-w-0 flex-1">
          <div className="text-[16px] font-semibold leading-snug text-[var(--text-primary)]">{title}</div>
          <div className="mt-1 text-[13.5px] leading-snug text-[var(--text-muted)]"><b className="font-semibold text-[var(--text-primary)]">Why: </b>{why}</div>
        </div>
        {button && <button type="button" onClick={onClick} className="hidden lg:block shrink-0 self-center rounded-xl px-4 py-2 text-[14px] font-semibold text-white" style={{ background: color }}>{button}</button>}
      </div>
      {children}
      {button && <button type="button" onClick={onClick} className="lg:hidden mt-3 w-full rounded-xl py-2.5 text-[15px] font-semibold text-white" style={{ background: color }}>{button}</button>}
    </div>
  )
}

/** the family plan's steps that belong to this goal, and the goal's own steps (never the same one twice) */
export function goalActions(p, todo) {
  const own = (todo?.steps || []).filter((x) => (x.t === 'protect' || x.t === 'ready') && x.goal?.goalId === p.goal.goalId)
  const st = realSteps(p).filter((x) => !own.some((o) => o.t === x.t))
  return { own, st }
}

/** All actions of one goal as cards, plus the window with the full steps. */
export function GoalActionCards({ p, todo, ctx, onMoreTime, aside }) {
  const { mt, navigate, pname } = ctx
  const g = p.goal
  const [detail, setDetail] = useState(null)
  const { own, st } = goalActions(p, todo)
  const refillDue = useRetirementDue(p.isRet ? g : null)
  const retired = p.isRet && p.years <= 0
  const n = Math.max(1, Number(g.payYears) || 1)
  const left = p.years < 1 ? `${Math.max(1, Math.round(p.years * 12))} months` : `${Math.round(p.years * 2) / 2} years`
  const count = own.length + st.length + (refillDue ? 1 : 0)
  const due = new Date(g.targetDate)
  return (
    <AsideCtx.Provider value={aside || ctx.aside || {}}>
      {count === 0 && <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-[14px] text-[var(--text-primary)]">✓ Nothing to do now.{!retired && p.sip > 0 ? ` Keep your SIP ${L(p.sip)}/month.` : ''}</div>}
      {refillDue && (
        <ActionCard icon={Layers} color="#f59e0b" title="Refill your Income bucket" why="your monthly income is paid from the Income bucket and it is running low. Move money into it from Stability (and Stability from Growth), as the steps show.">
          <div className="g2 mt-3"><style>{GOALS_HOME_CSS}</style><RetirementActions goal={g} slot="alert" /></div>
        </ActionCard>
      )}
      {[...own, ...st].map((s, i) => {
        if (s.t === 'protect') return <ActionCard key={i} icon={ShieldCheck} color="#f59e0b" title={`Make it safer: move ${L(s.total)}`} why={`only ${left} to go and ${s.eqNow}% is in equity; the plan for now is ${s.eqTarget}%. A market fall now could cut the money you need, so move this part to a safe fund.`} button="See the steps" onClick={() => setDetail(s)} />
        if (s.t === 'ready') return <ActionCard key={i} icon={CheckCircle2} color="#3b82f6" title={n > 1 ? `Withdraw this year's part: ${L(Math.min(p.has, p.target / n))}` : `Withdraw ${L(p.has)}`} why={n > 1 ? `the payment year has come. Take out this year's part; the other ${n - 1} stay invested.` : 'the goal date has come. Take the money out when you need it; until then it is set aside, safe, and still in your net worth.'} button="Withdraw" onClick={() => setDetail({ ...s, withdraw: true })} />
        if (s.t === 'sip') return <ActionCard key={i} icon={TrendingUp} color="#8b5cf6" title={`Add ${L(s.amount)} a month`} why={`at today's pace the goal is ${L(s.lump)} short. A bigger SIP (or ${L(s.lump)} once) closes the gap by ${due.getFullYear()}.`} button="See the steps" onClick={() => setDetail(s)} />
        return <ActionCard key={i} icon={ListChecks} color="#a78bfa" title={s.t === 'switch' ? 'Rebalance this goal' : 'Step to do'} why="the goal's mix is off its plan." button="See the steps" onClick={() => setDetail(s)} />
      })}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.withdraw ? `Withdraw · ${mt(g.goalName)}` : 'How to do it'} wide maxHeight="max-h-[92vh]">
        {detail && (detail.withdraw
          ? <div className="g2"><style>{GOALS_HOME_CSS}</style><WithdrawPanel s={detail} mt={mt} pname={pname} onDone={(how, opts) => { setDetail(null); ctx.closeGoal(g, how, opts) }} onMoreTime={() => { setDetail(null); onMoreTime?.(g) }} /></div>
          : detail.t === 'protect'
            ? <div className="g2"><style>{GOALS_HOME_CSS}</style>
                <ol className="mb-4 space-y-1.5 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3 text-[14px] leading-snug text-[var(--text-primary)]">
                  <li><b>1.</b> Open your fund app ({pname(detail.portfolioId) || 'where these funds are'}).</li>
                  <li><b>2.</b> Use <b>Switch</b> (same fund house) or Redeem, for the units shown under SELL.</li>
                  <li><b>3.</b> Put that money into the fund under BUY (a liquid or short-term debt fund).</li>
                  <li><b>4.</b> Next time, import your CAS: the app updates the goal by itself.</li>
                </ol>
                <Step s={detail} n={1} mt={mt} pname={pname} closeGoal={ctx.closeGoal} navigate={navigate} /></div>
            : <div className="gp"><style>{GP_CSS}</style><div className="gp-grp"><StepRow s={detail} p={p} n={1} mt={mt} pname={pname} onRebalance={ctx.openRebalance} onClose={ctx.closeGoal} navigate={navigate} /></div><p className="text-[12px] text-[var(--text-dim)] mt-2">Sell in units you hold. Buy in ₹, because the units depend on that day's NAV.</p></div>)}
      </Modal>
    </AsideCtx.Provider>
  )
}

/** How many actions a goal has (for the count chips). */
export function useGoalActionCount(p, todo) {
  const { own, st } = goalActions(p, todo)
  const refillDue = useRetirementDue(p?.isRet ? p.goal : null)
  return own.length + st.length + (refillDue ? 1 : 0)
}
