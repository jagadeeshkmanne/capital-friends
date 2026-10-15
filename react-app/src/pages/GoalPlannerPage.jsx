import { useState } from 'react'
import { Target, GraduationCap, Umbrella, Home, ShieldCheck, Route, BellRing, LogIn, RotateCcw, Mail, PieChart } from 'lucide-react'
import GoalForm from '../components/forms/GoalForm'
import { LogoMark } from './landing/Brand'
import { buildGoalPlan } from '../utils/goalPlan'
import { PlanByYear, GP_CSS, L } from './goals/GoalsPlanPage'

// Public goal planner (/goal-planner/): the real Add Goal dialog, without a family member and without saving.
// The last step shows the goal's year-by-year plan (the app's own glide path) computed as if no money is in it yet,
// then what the app adds once signed in. Nothing is stored; nothing touches a signed-in user's data.
const TYPES = [
  ['Retirement', 'Retirement', Umbrella, 'Corpus from today\'s expenses, inflation and a safe withdrawal rate'],
  ['Child Education', 'Child education', GraduationCap, 'Date set from the child\'s age and the course'],
  ['Home Purchase', 'House', Home, 'Down payment or full cost, inflated to the year you buy'],
  ['Emergency Fund', 'Emergency fund', ShieldCheck, 'Months of expenses, funded first from the safest money'],
  ['Custom', 'Any goal', Target, 'Car, travel, wedding, a business'],
]
const AFTER = [
  [PieChart, 'Your real money on the goal', 'Import your CAMS statement once, tick which funds, FDs and EPF are for goals, and this plan shows have-today vs need-today with the actual funds counted for it.'],
  [Route, 'Each step with the exact units', 'Every "move to safe" year above becomes a step with the fund names and amounts, shown only in good markets, so nothing is sold at a low.'],
  [BellRing, 'Alerts with action items', 'When the goal drifts off its path, or a fund it depends on falls below its high, the daily family email says what to do.'],
  [Mail, 'Your family knows', 'The goal, the funds behind it and the plan are in the daily email your family receives. If something happens to you, they know.'],
]
// the plan the app would show for this goal if it held no money yet: the required SIP goes in from today
function guestPlan(data) {
  const goal = { ...data, goalId: 'guest', goalName: data.goalName || data.goalType, isActive: true, status: 'Active' }
  const plan = buildGoalPlan({ goals: [goal], attribution: {}, mfHoldings: [], mappings: [], eqOf: () => 0 })
  return plan.goals[0] || null
}


// What the signed-in app shows for a goal, drawn with sample numbers (labelled as such). Generic fund kinds only.
const Bar = ({ pct, c = '#34d399', bg = 'rgba(255,255,255,.08)' }) => <span className="relative inline-block h-1.5 w-full overflow-hidden rounded-full" style={{ background: bg }}><span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${pct}%`, background: c }} /></span>
function AppPreview({ p, name }) {
  const target = p?.target || 36700000, have = Math.round(target * 0.27), need = Math.round(target * 0.26), year = p ? new Date(p.goal.targetDate).getFullYear() : 2039
  const F = (v) => L(v)
  const rows = [['Flexi cap fund', 'equity', 0.34], ['Multi asset fund', 'equity', 0.22], ['EPF', 'safe · retirement only', 0.26], ['Bank FD', 'safe', 0.12], ['Liquid fund', 'safe', 0.06]]
  const safe = rows.filter((r) => r[1].startsWith('safe')).reduce((a, r) => a + r[2], 0)
  const sw = Math.round(have * 0.11)
  return (
    <div className="mt-5">
      <div className="flex items-center justify-between"><h4 className="text-[13px] font-bold uppercase tracking-wide text-emerald-300">After sign-in, this goal looks like this</h4><span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[10.5px] text-[var(--text-dim)]">Sample numbers</span></div>
      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        {/* 1. investments counted for the goal */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-3.5">
          <div className="flex items-baseline justify-between"><b className="text-[13.5px] text-white">{name} · {year}</b><span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">On track</span></div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-[12px]">
            <div className="rounded-lg bg-[var(--bg-inset)] px-2.5 py-1.5"><div className="text-[10.5px] uppercase text-[var(--text-dim)]">Have today</div><b className="text-[14px] text-white">{F(have)}</b></div>
            <div className="rounded-lg bg-[var(--bg-inset)] px-2.5 py-1.5"><div className="text-[10.5px] uppercase text-[var(--text-dim)]">Should have</div><b className="text-[14px] text-white">{F(need)}</b></div>
          </div>
          <div className="mt-3 text-[11.5px] font-semibold text-[var(--text-muted)]">Counted for this goal · {F(have)}</div>
          <div className="mt-1.5 flex h-1.5 overflow-hidden rounded-full"><span style={{ width: `${Math.round((1 - safe) * 100)}%`, background: '#a78bfa' }} /><span style={{ width: `${Math.round(safe * 100)}%`, background: '#34d399' }} /></div>
          <div className="mt-0.5 flex justify-between text-[10.5px] text-[var(--text-dim)]"><span>{Math.round((1 - safe) * 100)}% growth</span><span>{Math.round(safe * 100)}% safe</span></div>
          <ul className="mt-2 space-y-1.5">
            {rows.map(([n, k, sh]) => (
              <li key={n} className="flex items-center justify-between gap-2 text-[12.5px]"><span className="flex min-w-0 items-center gap-2"><span className="h-6 w-6 shrink-0 rounded-md" style={{ background: k.startsWith('safe') ? 'rgba(52,211,153,.18)' : 'rgba(167,139,250,.18)' }} /><span className="truncate"><span className="text-white">{n}</span><span className="text-[var(--text-dim)]"> · {k}</span></span></span><b className="shrink-0 text-white">{F(have * sh)}</b></li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-[var(--text-dim)]">Imported from your CAMS statement. You tick what is for goals; the app shares it.</p>
        </div>
        {/* 2. the glide-path step with exact units */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-3.5">
          <div className="flex items-baseline justify-between"><b className="text-[13.5px] text-white">{year - 7} · 7 yrs left</b><span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-300">Step due</span></div>
          <div className="mt-2 text-[14px] font-semibold text-amber-300">Move about {F(sw)} to safe funds</div>
          <div className="mt-1 flex items-center gap-2 text-[11.5px] text-[var(--text-dim)]"><span>Equity</span><span className="w-12"><Bar pct={85} c="#64748b" /></span>85% → <span className="w-12"><Bar pct={79} c="#f59e0b" /></span><b className="text-white">79%</b></div>
          <div className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] p-2.5 text-[12.5px]">
            <div className="text-[10.5px] uppercase text-[var(--text-dim)]">The step, with units</div>
            <div className="mt-1 text-white">Switch <b>{F(sw)}</b> from <span className="text-violet-300">Flexi cap fund</span> → <span className="text-emerald-300">Liquid fund</span></div>
            <div className="mt-1 text-[11.5px] text-[var(--text-dim)]">Shown only while the fund is near its high, so nothing is sold at a low. One tap records it.</div>
          </div>
          <div className="mt-3 flex gap-2"><span className="rounded-lg bg-violet-600 px-3 py-1.5 text-[12px] font-semibold text-white">Rebalance</span><span className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-[12px] font-semibold text-[var(--text-muted)]">Later</span></div>
          <p className="mt-2 text-[11px] text-[var(--text-dim)]">Every year in the plan above becomes a step like this.</p>
        </div>
        {/* 3. alerts in the daily email */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-3.5">
          <div className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-md bg-sky-500/15 text-sky-300"><Mail size={14} /></span><div><b className="block text-[13px] text-white">Family Financial Blueprint</b><span className="text-[11px] text-[var(--text-dim)]">Daily, 9:00 · to you and your family</span></div></div>
          <ul className="mt-3 space-y-2 text-[12.5px]">
            <li className="flex gap-2"><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-amber-400" /><span><b className="text-white">{name}</b> is 4% off its path · 1 step due: move {F(sw)} to safe</span></li>
            <li className="flex gap-2"><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-sky-400" /><span><b className="text-white">Flexi cap fund</b> is 7% below its high · information, not advice</span></li>
            <li className="flex gap-2"><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-400" /><span><b className="text-white">SIP</b> {F(p?.sipNeeded || 116000)} due on the 5th · term policy renews in 12 days</span></li>
            <li className="flex gap-2"><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-violet-400" /><span><b className="text-white">Net worth</b>, every account, every fund, nominees, loans: where everything is</span></li>
          </ul>
          <p className="mt-2 text-[11px] text-[var(--text-dim)]">Sent from your own Gmail by a schedule in your sheet. No server in between.</p>
        </div>
      </div>
    </div>
  )
}

export default function GoalPlannerPage() {
  const [type, setType] = useState('Retirement')
  const [n, setN] = useState(0)        // remount key: "start over"
  const [done, setDone] = useState(null)

  const onSave = async (data) => {
    setDone({ data, p: guestPlan(data) })
    try { window.gtag && window.gtag('event', 'goal_planner_plan', { goal_type: data.goalType }) } catch { /* no analytics */ }
    setTimeout(() => document.getElementById('plan')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }
  const signIn = () => { window.location.href = '/' }

  return (
    <div className="cf-app min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)]" style={{ fontFamily: "'Inter', sans-serif" }}>
      <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[#0a0f1f]/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <a href="/" className="flex items-center gap-2 no-underline"><LogoMark size={32} /><span className="text-[17px] font-bold text-white" style={{ fontFamily: "'Poppins', sans-serif" }}>Capital <em className="not-italic text-emerald-400">Friends</em></span></a>
          <nav className="flex items-center gap-2 text-[13px]">
            <a href="/tools/" className="hidden px-2 text-slate-300 hover:text-white sm:inline">Calculators</a><a href="/guides/" className="hidden px-2 text-slate-300 hover:text-white sm:inline">Guides</a>
            <a href="/goal-based-investing/" className="hidden px-2 text-slate-300 hover:text-white sm:inline">How goals work</a>
            <button onClick={signIn} className="rounded-lg bg-emerald-500 px-3.5 py-1.5 font-semibold text-emerald-950 hover:bg-emerald-400">Sign in, it's free</button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-16 pt-8">
        <p className="text-[12px] text-[var(--text-dim)]"><a href="/" className="hover:underline">Capital Friends</a> › Goal planner</p>
        <h1 className="mt-2 text-[28px] font-extrabold leading-tight tracking-tight text-white sm:text-[38px]" style={{ fontFamily: "'Poppins', sans-serif" }}>Goal Planner</h1>
        <p className="mt-2 max-w-3xl text-[16px] leading-relaxed text-[var(--text-muted)]">Plan retirement, a child's education, a house or any goal with the same planner that runs inside the app. It inflates today's cost to the goal year, works out the corpus and the SIP, and suggests the equity–debt split for that horizon. No sign-in needed to plan; sign in only when you want your real investments counted against it.</p>

        {/* goal type chooser */}
        <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {TYPES.map(([k, label, Icon, sub]) => (
            <button key={k} type="button" onClick={() => { setType(k); setN(n + 1); setDone(null) }}
              className={`flex flex-col items-start gap-1 rounded-xl border px-3 py-2.5 text-left transition-colors ${type === k ? 'border-violet-500 bg-violet-500/15' : 'border-[var(--border)] bg-[var(--bg-card)] hover:border-violet-500/50'}`}>
              <span className="flex items-center gap-2 text-[13px] font-bold text-white"><Icon size={15} className="text-violet-300" />{label}</span>
              <span className="text-[11px] leading-snug text-[var(--text-dim)]">{sub}</span>
            </button>
          ))}
        </div>

        {/* the real Add Goal dialog, inline */}
        <section className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-3 sm:p-5" id="planner">
          {done ? (
            <div id="plan">
              <style>{GP_CSS}</style>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-[22px] font-extrabold text-white">{done.data.goalName || done.data.goalType} · {new Date(done.data.targetDate).getFullYear()}</h2>
                  <p className="mt-1 text-[13px] text-[var(--text-muted)]">This is the plan the app would run for this goal from today, with the SIP it needs going in every month.</p>
                </div>
                <button onClick={() => { setDone(null); setN(n + 1) }} className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-[13px] font-semibold text-[var(--text-muted)] hover:text-white"><RotateCcw size={14} /> Plan another goal</button>
              </div>
              {done.p ? (
                <>
                  <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {[['Goal amount', L(done.p.target)], ['SIP needed', `${L(done.p.sipNeeded)} / mo`], ['Years to go', `${done.p.yearsLeft}`], ['Equity now', done.p.bucketMode ? 'Buckets' : `${done.p.eqTarget}%`]].map(([k, v]) => (
                      <div key={k} className="rounded-xl border border-[var(--border)] bg-[var(--bg-inset)] px-3 py-2.5"><div className="text-[11px] uppercase tracking-wide text-[var(--text-dim)]">{k}</div><div className="mt-0.5 text-[17px] font-bold text-white">{v}</div></div>
                    ))}
                  </div>
                  <div className="mt-4"><PlanByYear p={done.p} /></div>
                </>
              ) : <p className="mt-4 text-[14px] text-[var(--text-muted)]">Set a target date to see the year-by-year plan.</p>}
              <div className="mt-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5">
                <h3 className="text-[18px] font-extrabold text-white">This plan, on your real money</h3>
                <p className="mt-1 text-[14px] text-[var(--text-muted)]">Sign in with Google (free, your data stays in your own Google Drive) and the app runs this same plan on the funds, FDs and EPF you already have.</p>
                <AppPreview p={done.p} name={done.data.goalName || done.data.goalType} />
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {AFTER.map(([Icon, t, d]) => (
                    <div key={t} className="flex gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-3.5">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-violet-300"><Icon size={18} /></div>
                      <div><div className="text-[14px] font-bold text-white">{t}</div><p className="mt-0.5 text-[13px] leading-relaxed text-[var(--text-muted)]">{d}</p></div>
                    </div>
                  ))}
                </div>
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <button onClick={signIn} className="flex items-center gap-2 rounded-lg bg-emerald-500 px-5 py-2.5 text-[14px] font-bold text-emerald-950 hover:bg-emerald-400"><LogIn size={16} /> Open the app, free</button>
                  <a href="https://www.youtube.com/@capitalfriendsin" target="_blank" rel="noopener noreferrer" className="text-[13px] font-semibold text-emerald-300 hover:underline">Watch the demo on YouTube →</a>
                </div>
              </div>
            </div>
          ) : (
            <GoalForm key={`${type}-${n}`} defaultType={type} onSave={onSave} onCancel={() => setN(n + 1)} submitLabel="See the year-by-year plan →" />
          )}
        </section>

        <h2 className="mt-12 text-[22px] font-extrabold text-white" style={{ fontFamily: "'Poppins', sans-serif" }}>How the planner calculates</h2>
        <div className="prose-cf mt-2 max-w-3xl space-y-3 text-[14px] leading-relaxed text-[var(--text-muted)]">
          <p><b className="text-white">Retirement.</b> Today's monthly expenses are inflated to the retirement year. The corpus is sized with a safe withdrawal rate that depends on how long the money must last: about 3% if you retire before 45, 4% around 55, up to 6% after 68. The gap after your existing savings becomes a monthly SIP, and the suggested split leans to equity for far dates and to debt for near ones.</p>
          <p><b className="text-white">Child education.</b> Enter the child's age and the course; the start date is set for you. Today's fee is inflated at education inflation (10% by default), and the SIP or lumpsum needed is shown with the split for that horizon.</p>
          <p><b className="text-white">Any goal.</b> Cost today, years away, inflation and expected return give the future cost, the SIP and the lumpsum. Goals paid over several years (a 4-year course) are handled as a series.</p>
          <p>Results are estimates from the inputs you enter; returns are not guaranteed. Capital Friends is a tracking tool, not a SEBI-registered adviser.</p>
        </div>

        <div className="mt-10 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-[var(--text-dim)]">
          <a href="/sip-calculator/" className="hover:text-white">SIP calculator</a><a href="/retirement-corpus-calculator/" className="hover:text-white">Retirement corpus calculator</a><a href="/retirement-bucket-strategy/" className="hover:text-white">Three-bucket strategy</a><a href="/goal-based-investing/" className="hover:text-white">Goal-based investing</a><a href="/tools/" className="hover:text-white">All calculators</a><a href="/guides/" className="hover:text-white">Guides</a><a href="/privacy/" className="hover:text-white">Privacy</a>
        </div>
      </main>
    </div>
  )
}
