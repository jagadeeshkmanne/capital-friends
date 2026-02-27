import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  Shield, Users, TrendingUp, Target, BarChart3,
  CreditCard, Bell, Lock, RefreshCw, Link2,
  Heart, PiggyBank, ArrowDown, CheckCircle2, AlertTriangle,
  Eye, LogIn, FileSpreadsheet, ClipboardCheck,
} from 'lucide-react'

const LOGO_ICON = `${import.meta.env.BASE_URL}logo-new.png`

export default function LandingPage() {
  const { isAuthenticated, loading, error, signIn } = useAuth()
  const navigate = useNavigate()
  const [activeFeature, setActiveFeature] = useState(0)
  const [paused, setPaused] = useState(false)
  const timerRef = useRef(null)

  // Auto-rotate features every 5s
  const resetTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setPaused(p => {
        if (!p) setActiveFeature(prev => (prev + 1) % 4)
        return p
      })
    }, 5000)
  }, [])

  useEffect(() => {
    resetTimer()
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [resetTimer])

  function pickFeature(i) {
    setActiveFeature(i)
    resetTimer()
  }

  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard', { replace: true })
  }, [isAuthenticated, navigate])

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#080d1a]"><img src={LOGO_ICON} alt="" className="h-16 w-auto animate-pulse" /></div>
  }

  const features = [
    {
      id: 'ath',
      label: 'ATH Tracking',
      icon: <TrendingUp size={18} />,
      color: 'emerald',
      tagline: 'Spot Buying Opportunities',
      desc: 'See how far each mutual fund is from its All-Time High NAV. When a quality fund dips 10-20% below ATH, it\'s your signal to invest more — via SIP increase or lumpsum.',
      mock: <MockATH />,
    },
    {
      id: 'rebalance',
      label: 'Rebalancing',
      icon: <RefreshCw size={18} />,
      color: 'violet',
      tagline: 'Know Exactly What to Buy or Sell',
      desc: 'Set target allocation for each fund. When your portfolio drifts, Capital Friends tells you exactly how much to adjust — via SIP changes, lumpsum top-ups, or buy/sell actions.',
      mock: <MockRebalance />,
    },
    {
      id: 'goals',
      label: 'Goal Linking',
      icon: <Target size={18} />,
      color: 'cyan',
      tagline: 'Link Portfolios to Goals',
      desc: 'Create goals like retirement, child education, or emergency fund. Link MF portfolios with allocation percentages. Goal progress updates automatically as NAVs change daily.',
      mock: <MockGoals />,
    },
    {
      id: 'dashboard',
      label: 'Family View',
      icon: <Users size={18} />,
      color: 'amber',
      tagline: 'Everyone\'s Wealth, One Dashboard',
      desc: 'Switch between family members in one click. See combined or individual net worth, investments, insurance, loans — everything your family owns, in one place.',
      mock: <MockDashboard />,
    },
  ]

  const af = features[activeFeature]

  return (
    <div className="min-h-screen bg-[#080d1a] text-slate-200">
      {/* ── Header ── */}
      <header className="sticky top-0 z-50 bg-[#0a0f1f]/95 backdrop-blur-sm border-b border-white/[0.06]">
        <div className="flex items-center justify-between px-3 sm:px-4 h-14">
          <div className="flex items-center gap-2">
            <img src={LOGO_ICON} alt="CF" className="h-12 w-auto" />
            <span className="flex items-baseline gap-1 text-lg tracking-tight" style={{ fontFamily: "'Poppins', sans-serif" }}>
              <span className="font-bold text-white">Capital</span>
              <span className="font-extrabold text-emerald-400">Friends</span>
            </span>
          </div>
          <button onClick={signIn} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-violet-600 to-cyan-600 text-white text-sm font-semibold hover:from-violet-500 hover:to-cyan-500 transition-all cursor-pointer">
            <GI s={14} /> Sign In
          </button>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative px-5 sm:px-8 lg:px-16 pt-10 sm:pt-14 pb-8 sm:pb-10 overflow-hidden">
        <div className="absolute top-0 left-1/4 w-[600px] h-[400px] bg-violet-600/8 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-20 right-1/4 w-[400px] h-[300px] bg-cyan-600/6 rounded-full blur-[100px] pointer-events-none" />
        <div className="relative text-center">
          <span className="inline-block text-xs font-bold uppercase tracking-[0.2em] text-violet-400 bg-violet-500/10 border border-violet-500/20 rounded-full px-4 py-1.5 mb-5">
            Always Free &middot; 100% Private &middot; Your Google Sheet
          </span>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold leading-[1.1] tracking-tight text-white">
            One dashboard for your family&apos;s{' '}
            <span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">entire wealth</span>
          </h1>
          <p className="mt-5 text-base sm:text-lg text-slate-400 leading-relaxed max-w-2xl mx-auto">
            Mutual funds, stocks, FDs, gold, insurance, loans — track everything for every family member.
            Manual entry means <strong className="text-white">no bank credentials, no privacy risk</strong>.
          </p>
          {error && <p className="mt-5 text-sm text-rose-400">{error}</p>}
        </div>
      </section>

      {/* ── The Big Question — Emotional Hook ── */}
      <section className="bg-gradient-to-b from-[#0d0a1a] to-[#0a0e1c] border-y border-white/[0.06] px-5 sm:px-8 lg:px-16 py-10 sm:py-14">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white inline-flex items-center gap-3 flex-wrap justify-center">
              <AlertTriangle size={28} className="text-amber-400 shrink-0" />
              <span>What happens if something happens to <span className="text-amber-400">you</span>?</span>
            </h2>
            <p className="mt-4 text-lg text-slate-400 leading-relaxed">
              Your family should know about every investment, every policy, every loan.
              Not someday. <strong className="text-white">Right now.</strong>
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <ScenarioCard
              icon={<Eye size={20} />}
              color="rose"
              title="Without Capital Friends"
              items={[
                'Scattered investments across 10+ platforms',
                'Family has no idea what you own or owe',
                'Insurance policies lost in email threads',
                'Months of confusion, missed renewals, lost money',
              ]}
              bad
            />
            <ScenarioCard
              icon={<Shield size={20} />}
              color="emerald"
              title="With Capital Friends"
              items={[
                'One sheet — every investment, policy, and loan',
                'Family receives email reports with full portfolio details',
                'Reminders for SIPs, renewals, EMI payments',
                'Complete clarity, instantly — when it matters most',
              ]}
            />
          </div>

          <p className="text-center mt-8 text-base text-slate-500">
            Built for <strong className="text-white">you</strong> to manage your wealth — and for your <strong className="text-white">family</strong> to access it when they need to.
          </p>
      </section>

      {/* ── How it Works ── */}
      <section className="bg-[#0a0e1c] border-y border-white/[0.06] px-5 sm:px-8 lg:px-16 py-14 sm:py-20">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white mb-2">How it Works</h2>
          <p className="text-base text-slate-500">Set up in 2 minutes — no bank credentials, no downloads</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-4">
          <HowStep num={1} icon={<LogIn size={24} />} color="violet" title="Sign In with Google" desc="Go to capitalfriends.in and sign in with your Google account. That's all — no registration form, no passwords." />
          <HowStep num={2} icon={<FileSpreadsheet size={24} />} color="emerald" title="App Creates Your Sheet" desc="The app creates a private Google Sheet in your own Google Drive. This sheet stores all your financial data. Only you can see it — not even the developer." />
          <HowStep num={3} icon={<ClipboardCheck size={24} />} color="cyan" title="Financial Health Check" desc="Answer 7 simple yes/no questions about your financial health. Get your score and personalized recommendations instantly." />
          <HowStep num={4} icon={<TrendingUp size={24} />} color="amber" title="Start Tracking" desc="Add family members, portfolios, goals, insurance, and loans. The app connects to AMFI for live mutual fund prices automatically." />
        </div>

        <p className="text-center mt-10 text-sm text-slate-600">
          Your sheet is named <strong className="text-slate-400">&ldquo;Capital Friends - Your Name&rdquo;</strong> and lives in your Google Drive.
          The web app is just a beautiful dashboard to view and manage it.
        </p>
      </section>

      {/* ── Features Showcase ── */}
      <section id="features" className="bg-[#0b1022] border-y border-white/[0.06] px-5 sm:px-8 lg:px-16 py-14 sm:py-20" onMouseEnter={() => setPaused(true)} onMouseLeave={() => { setPaused(false); resetTimer() }}>
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white mb-2">Features That Set Us Apart</h2>
          <p className="text-base text-slate-500">Things you won&apos;t find on other portfolio trackers</p>
        </div>

        {/* Feature titles as navigation */}
        <div className="flex justify-center gap-2 sm:gap-3 mb-10 flex-wrap">
          {features.map((f, i) => {
            const active = i === activeFeature
            const borderC = { emerald: 'border-emerald-500', violet: 'border-violet-500', cyan: 'border-cyan-500', amber: 'border-amber-500' }
            const textC = { emerald: 'text-emerald-400', violet: 'text-violet-400', cyan: 'text-cyan-400', amber: 'text-amber-400' }
            return (
              <button
                key={f.id}
                onClick={() => pickFeature(i)}
                className={`relative flex items-center gap-2 px-5 py-2.5 rounded-full border text-sm font-semibold transition-all cursor-pointer ${
                  active
                    ? `${borderC[f.color]} bg-white/[0.05] ${textC[f.color]}`
                    : 'border-white/[0.08] text-slate-500 hover:border-white/[0.15] hover:text-slate-300'
                }`}
              >
                <span className="shrink-0">{f.icon}</span>
                {f.label}
                {/* Progress bar */}
                {active && (
                  <div className="absolute bottom-0 left-4 right-4 h-0.5 bg-white/[0.06] rounded-full overflow-hidden">
                    <div className={`h-full rounded-full bg-current`} style={{ animation: 'featureProgress 5s linear', animationPlayState: paused ? 'paused' : 'running' }} />
                  </div>
                )}
              </button>
            )
          })}
        </div>

        {/* Active feature content */}
        <div className="flex flex-col lg:flex-row lg:items-center gap-8 lg:gap-12">
          <div className="lg:flex-1 min-h-[280px]">
            <h3 className="text-xl sm:text-2xl font-bold text-white">{af.tagline}</h3>
            <p className="mt-3 text-base text-slate-400 leading-relaxed">{af.desc}</p>

            {af.id === 'ath' && (
              <div className="mt-6 space-y-5">
                <Bullet c="emerald" t="ATH tracking only for funds in your portfolios" />
                <Bullet c="emerald" t="Color-coded signals: watch, consider, buy, strong buy" />
                <Bullet c="emerald" t="Increase SIP or invest lumpsum when funds dip" />
                <Bullet c="emerald" t="Daily NAV updates from AMFI data" />
              </div>
            )}

            {af.id === 'rebalance' && (
              <div className="mt-6 space-y-5">
                <Bullet c="violet" t="Adjust monthly SIP to rebalance gradually" />
                <Bullet c="violet" t="Lumpsum top-up for quick rebalance" />
                <Bullet c="violet" t="Buy/Sell amounts to match target" />
                <Bullet c="violet" t="Configurable threshold per portfolio" />
              </div>
            )}

            {af.id === 'goals' && (
              <div className="mt-6 space-y-5">
                <Bullet c="cyan" t="Link multiple MF portfolios to each goal" />
                <Bullet c="cyan" t="Built-in SIP + lumpsum calculator with inflation" />
                <Bullet c="cyan" t="Auto-status: On Track, Needs Attention, Achieved" />
                <Bullet c="cyan" t="Withdrawal planning for retirement goals" />
              </div>
            )}

            {af.id === 'dashboard' && (
              <div className="mt-6 space-y-5">
                <Bullet c="amber" t="One-click switch between family members" />
                <Bullet c="amber" t="Combined net worth across everyone" />
                <Bullet c="amber" t="MF, stocks, FD, gold, PPF, NPS, insurance" />
                <Bullet c="amber" t="Email reports sent to family automatically" />
              </div>
            )}
          </div>
          <div className="lg:flex-1 min-w-0 min-h-[380px] flex flex-col justify-center">
            {af.mock}
          </div>
        </div>

        {/* CSS animation for progress bar */}
        <style>{`
          @keyframes featureProgress {
            from { width: 0% }
            to { width: 100% }
          }
        `}</style>
      </section>

      {/* ── Everything You Need ── */}
      <section className="bg-[#0a0e1c] border-y border-white/[0.06] px-5 sm:px-8 lg:px-16 py-14 sm:py-20">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white mb-2">Everything You Need</h2>
          <p className="text-base text-slate-500">One dashboard for your entire financial life</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          <FC icon={<BarChart3 size={20} />} c="rose" t="Stock Portfolios" d="Buy/sell tracking, average cost, P&L with live NSE prices" />
          <FC icon={<PiggyBank size={20} />} c="orange" t="FD, Gold, PPF, NPS" d="Track any investment type — all counted in net worth" />
          <FC icon={<Shield size={20} />} c="teal" t="Insurance Tracker" d="Life, health, term policies with premiums & renewal dates" />
          <FC icon={<CreditCard size={20} />} c="red" t="Liabilities" d="Loans & EMIs. Net worth = total assets minus debts" />
          <FC icon={<Bell size={20} />} c="yellow" t="Smart Reminders" d="SIP dates, renewals, EMI payments, maturity alerts" />
          <FC icon={<Users size={20} />} c="pink" t="Family Sharing" d="Invite family with Google accounts — shared dashboard" />
          <FC icon={<RefreshCw size={20} />} c="blue" t="Daily Auto-Refresh" d="NAVs and stock prices update automatically every day" />
          <FC icon={<Lock size={20} />} c="emerald" t="Complete Privacy" d="No servers, no database, no tracking — your Sheet only" />
        </div>
      </section>

      {/* ── Trust / Privacy ── */}
      <section className="border-y border-white/[0.06]">
        {/* Section header */}
        <div className="bg-[#0b1022] px-5 sm:px-8 lg:px-16 py-10 sm:py-14 text-center">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white inline-flex items-center gap-3"><Lock size={28} className="text-emerald-400 shrink-0" />Your Data Never Leaves Google</h2>
          <p className="mt-3 text-base sm:text-lg text-slate-400 leading-relaxed">
            No backend server. No database. No tracking. The web app is a static site.
            Your spreadsheet lives in <strong className="text-white">your Google Drive</strong>. We literally cannot access your financial data.
          </p>
        </div>
        {/* Three trust strips */}
        <div className="flex flex-col sm:flex-row">
          <TrustStrip icon={<Shield size={20} />} t="Manual Entry Only" d="No bank linking, no credentials shared. You type your data — no one else has access." bg="bg-[#0d1326]" c="emerald" />
          <TrustStrip icon={<Lock size={20} />} t="Your Google Sheet" d="A private spreadsheet in your Drive. Share only with family you choose." bg="bg-[#0f1530]" c="violet" />
          <TrustStrip icon={<Heart size={20} />} t="Always Free" d="No premium tier, no hidden fees, no ads. Free today, free forever." bg="bg-[#111838]" c="amber" />
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="bg-gradient-to-t from-[#080d1a] to-[#0d1128] border-t border-white/[0.06] px-5 sm:px-8 lg:px-16 py-16 text-center">
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
          Start managing your family&apos;s wealth today
        </h2>
        <p className="mt-3 text-base text-slate-500">
          Always free. No credit card. No bank linking. Just your Google account.
        </p>
        <button onClick={signIn} className="mt-8 inline-flex items-center gap-2.5 px-8 py-3.5 bg-gradient-to-r from-violet-600 to-cyan-600 text-white font-bold text-base rounded-xl hover:from-violet-500 hover:to-cyan-500 shadow-lg shadow-violet-900/30 transition-all hover:scale-[1.02] cursor-pointer">
          <GI s={20} /> Sign in with Google — It&apos;s Free
        </button>
        {error && <p className="mt-3 text-sm text-rose-400">{error}</p>}
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.04] px-5 sm:px-8 lg:px-16 py-5 flex items-center justify-between">
        <div className="flex items-center gap-1.5 opacity-30">
          <img src={LOGO_ICON} alt="" className="h-5 w-auto" />
          <span className="text-xs font-bold text-white" style={{ fontFamily: "'Poppins', sans-serif" }}>Capital<span class="text-emerald-400">Friends</span></span>
        </div>
        <p className="text-xs text-slate-600">Your data. Your Google Drive. Your control.</p>
      </footer>
    </div>
  )
}

/* ─────────────────── SCENARIO CARDS ─────────────────── */

function ScenarioCard({ icon, title, items, bad }) {
  const border = bad ? 'border-rose-500/15' : 'border-emerald-500/15'
  const bg = bad ? 'bg-rose-500/[0.04]' : 'bg-emerald-500/[0.04]'
  const iconBg = bad ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'
  const titleC = bad ? 'text-rose-400' : 'text-emerald-400'

  return (
    <div className={`rounded-2xl border ${border} ${bg} p-6`}>
      <h3 className={`text-lg font-bold ${titleC} mb-4 flex items-center gap-2.5`}>
        <span className={`flex items-center justify-center w-8 h-8 rounded-lg ${iconBg} shrink-0`}>{icon}</span>
        {title}
      </h3>
      <ul className="space-y-3">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2.5">
            {bad
              ? <span className="text-rose-500/60 mt-0.5 shrink-0">&times;</span>
              : <CheckCircle2 size={16} className="text-emerald-500 mt-0.5 shrink-0" />
            }
            <span className="text-sm text-slate-300 leading-relaxed">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ─────────────────── MOCK UI COMPONENTS ─────────────────── */

function MockDashboard() {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#0d1326] overflow-hidden shadow-2xl shadow-black/40">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.04] bg-[#0a0f1f]">
        <span className="text-sm text-slate-400 font-medium">Dashboard</span>
        <div className="flex gap-1.5">
          {['Everyone', 'Jagadeesh', 'Priya', 'Arjun'].map((n, i) => (
            <span key={n} className={`text-xs px-2.5 py-1 rounded-full font-medium ${i === 0 ? 'bg-violet-500/20 text-violet-300' : 'text-slate-600'}`}>{n}</span>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-3 divide-x divide-white/[0.04]">
        <WS l="Net Worth" v={`\u20B945.2L`} lc="text-violet-400" vc="text-white" />
        <WS l="Invested" v={`\u20B938.7L`} lc="text-slate-500" vc="text-slate-300" />
        <WS l="P&L" v={`+\u20B96.5L`} lc="text-slate-500" vc="text-emerald-400" extra="+16.8%" />
      </div>
      <div className="border-t border-white/[0.04]">
        <MRow n="Axis Bluechip Fund" alloc="30% / 25%" cur={`\u20B96.2L`} pl="+24.0%" ath="5.2%" athC="text-[#e67e00]" up />
        <MRow n="Parag Parikh Flexi Cap" alloc="35% / 40%" cur={`\u20B94.8L`} pl="+37.1%" ath="At ATH" athC="text-emerald-500" up />
        <MRow n="SBI Small Cap Fund" alloc="20% / 15%" cur={`\u20B91.8L`} pl="-10.0%" ath="18.3%" athC="text-[#d84315]" last />
      </div>
    </div>
  )
}

function MockATH() {
  const funds = [
    { n: 'HDFC Mid-Cap Opportunities', nav: '142.35', ath: '168.50', pct: '15.5%', color: 'text-[#d84315]', signal: 'Good Buy Signal', sigC: 'text-[#d84315] bg-[#d84315]/15' },
    { n: 'Axis Small Cap Fund', nav: '38.22', ath: '52.10', pct: '26.6%', color: 'text-[#c62828]', signal: 'Strong Buy', sigC: 'text-[#c62828] bg-[#c62828]/15 font-bold' },
    { n: 'Kotak Emerging Equity', nav: '89.10', ath: '92.40', pct: '3.6%', color: 'text-[#b8860b]', signal: 'Watch', sigC: 'text-[#b8860b] bg-[#b8860b]/15' },
    { n: 'Mirae Asset Large Cap', nav: '105.80', ath: '106.20', pct: '0.4%', color: 'text-slate-500', signal: 'Near ATH', sigC: 'text-slate-500 bg-white/[0.04]' },
  ]
  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#0d1326] overflow-hidden shadow-2xl shadow-black/40">
      <div className="px-4 py-3 border-b border-white/[0.04] bg-[#0a0f1f] flex items-center justify-between">
        <span className="text-sm font-semibold text-white">Buy Opportunities</span>
        <span className="text-xs text-emerald-400 font-semibold bg-emerald-500/10 px-2.5 py-1 rounded-full">2 signals</span>
      </div>
      {funds.map((f, i) => (
        <div key={i} className={`flex items-center justify-between px-4 py-3 ${i < funds.length - 1 ? 'border-b border-white/[0.03]' : ''}`}>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-300 truncate">{f.n}</p>
            <p className="text-xs text-slate-600 mt-0.5">NAV {`\u20B9`}{f.nav} &middot; ATH {`\u20B9`}{f.ath}</p>
          </div>
          <div className="text-right shrink-0 ml-3">
            <p className={`text-base font-bold tabular-nums ${f.color}`}><ArrowDown size={13} className="inline -mt-0.5" /> {f.pct}</p>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${f.sigC}`}>{f.signal}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

function MockRebalance() {
  const [activeTab, setActiveTab] = useState(0)
  const tabs = ['SIP Adjust', 'Lumpsum', 'Buy / Sell']
  const headers = ['New SIP', 'Lumpsum Top-up', 'Action']
  // Portfolio total: ₹10,00,000. Each 5% = ₹50,000
  const tabData = [
    [ // SIP Adjust — Total SIP ₹20,000. Stop overweight, redirect to underweight
      { n: 'Axis Bluechip', val: 'SIP \u20B96,000', cur: '30%', tgt: '25%', action: 'Stop SIP', actionC: 'text-amber-400' },
      { n: 'Parag Parikh Flexi', val: 'SIP \u20B97,000', cur: '35%', tgt: '40%', action: '\u20B912,000/mo', actionC: 'text-emerald-400' },
      { n: 'SBI Small Cap', val: 'SIP \u20B94,000', cur: '20%', tgt: '15%', action: 'Stop SIP', actionC: 'text-amber-400' },
      { n: 'HDFC Large Cap', val: 'SIP \u20B93,000', cur: '15%', tgt: '20%', action: '\u20B98,000/mo', actionC: 'text-emerald-400' },
    ],
    [ // Lumpsum ₹1L — only underweight funds get investment. 55K + 45K = 1L
      { n: 'Axis Bluechip', val: '3,00,000', cur: '30%', tgt: '25%', action: 'No action', actionC: 'text-slate-600' },
      { n: 'Parag Parikh Flexi', val: '3,50,000', cur: '35%', tgt: '40%', action: 'Invest \u20B955,000', actionC: 'text-emerald-400' },
      { n: 'SBI Small Cap', val: '2,00,000', cur: '20%', tgt: '15%', action: 'No action', actionC: 'text-slate-600' },
      { n: 'HDFC Large Cap', val: '1,50,000', cur: '15%', tgt: '20%', action: 'Invest \u20B945,000', actionC: 'text-emerald-400' },
    ],
    [ // Buy / Sell — each 5% gap = ₹50,000. Sells fund buys
      { n: 'Axis Bluechip', val: '3,00,000', cur: '30%', tgt: '25%', action: 'Sell \u20B950,000', actionC: 'text-rose-400' },
      { n: 'Parag Parikh Flexi', val: '3,50,000', cur: '35%', tgt: '40%', action: 'Buy \u20B950,000', actionC: 'text-emerald-400' },
      { n: 'SBI Small Cap', val: '2,00,000', cur: '20%', tgt: '15%', action: 'Sell \u20B950,000', actionC: 'text-rose-400' },
      { n: 'HDFC Large Cap', val: '1,50,000', cur: '15%', tgt: '20%', action: 'Buy \u20B950,000', actionC: 'text-emerald-400' },
    ],
  ]
  const funds = tabData[activeTab]
  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#0d1326] overflow-hidden shadow-2xl shadow-black/40">
      <div className="px-4 py-3 border-b border-white/[0.04] bg-[#0a0f1f] flex items-center justify-between">
        <span className="text-sm font-semibold text-white">Rebalance Portfolio</span>
        <span className="text-xs text-violet-400 font-semibold bg-violet-500/10 px-2.5 py-1 rounded-full">4 off-target</span>
      </div>
      <div className="flex border-b border-white/[0.04]">
        {tabs.map((t, i) => (
          <button key={t} onClick={() => setActiveTab(i)} className={`flex-1 text-xs font-semibold py-2.5 text-center cursor-pointer transition-colors ${i === activeTab ? 'text-violet-400 border-b-2 border-violet-400' : 'text-slate-600 hover:text-slate-400'}`}>{t}</button>
        ))}
      </div>
      {/* Context row — total value for all tabs, plus SIP/Lumpsum for relevant tabs */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-white/[0.04] bg-[#0a0f1f]/50 flex-wrap">
        <span className="text-xs text-slate-500">Portfolio Value</span>
        <span className="text-sm text-white font-semibold tabular-nums">{`\u20B9`}10,00,000</span>
        {activeTab === 0 && (
          <>
            <span className="text-xs text-slate-600">|</span>
            <span className="text-xs text-slate-500">Total SIP</span>
            <span className="text-sm text-white font-semibold tabular-nums">{`\u20B9`}20,000</span>
          </>
        )}
        {activeTab === 1 && (
          <>
            <span className="text-xs text-slate-600">|</span>
            <span className="text-xs text-slate-500">Lumpsum</span>
            <input type="text" readOnly value={`\u20B91,00,000`} className="bg-white/[0.04] border border-white/[0.08] rounded-md px-2 py-1 text-sm text-white font-semibold tabular-nums w-24 text-right cursor-default outline-none" />
          </>
        )}
      </div>
      <div>
        <div className="grid grid-cols-[1fr_50px_50px_1fr] gap-1 px-4 py-2.5 text-xs text-slate-600 font-semibold border-b border-white/[0.03]">
          <span>Fund / Value</span><span className="text-center">Current</span><span className="text-center">Target</span><span className="text-right">{headers[activeTab]}</span>
        </div>
        {funds.map((f, i) => (
          <div key={`${activeTab}-${i}`} className={`grid grid-cols-[1fr_50px_50px_1fr] gap-1 px-4 py-2.5 items-center ${i < funds.length - 1 ? 'border-b border-white/[0.03]' : ''}`}>
            <div className="min-w-0">
              <span className="text-sm text-slate-300 truncate block">{f.n}</span>
              <span className="text-[10px] text-slate-600">{`\u20B9`}{f.val}</span>
            </div>
            <span className="text-sm text-center text-slate-400 tabular-nums">{f.cur}</span>
            <span className="text-sm text-center text-slate-400 tabular-nums">{f.tgt}</span>
            <span className={`text-sm text-right font-semibold ${f.actionC}`}>{f.action}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function MockGoals() {
  const goals = [
    { n: 'Retirement', tgt: '2Cr', cur: '28.5L', pct: 14, sip: '45,000', yrs: '18 yrs', status: 'On Track', sc: 'text-blue-400 bg-blue-500/15', bc: 'bg-blue-500' },
    { n: 'Child Education', tgt: '50L', cur: '12.2L', pct: 24, sip: '15,000', yrs: '12 yrs', status: 'On Track', sc: 'text-blue-400 bg-blue-500/15', bc: 'bg-blue-500' },
    { n: 'New Car', tgt: '15L', cur: '4.1L', pct: 27, sip: '12,000', yrs: '3 yrs', status: 'Needs Attention', sc: 'text-amber-400 bg-amber-500/15', bc: 'bg-amber-500' },
  ]
  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#0d1326] overflow-hidden shadow-2xl shadow-black/40">
      <div className="px-4 py-3 border-b border-white/[0.04] bg-[#0a0f1f] flex items-center justify-between">
        <span className="text-sm font-semibold text-white">Goals</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">2 On Track</span>
          <span className="text-xs text-amber-400">1 Needs Attention</span>
        </div>
      </div>
      {goals.map((g, i) => (
        <div key={i} className={`px-4 py-3.5 ${i < goals.length - 1 ? 'border-b border-white/[0.03]' : ''}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white">{g.n}</span>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${g.sc}`}>{g.status}</span>
            </div>
            <span className="text-xs text-slate-500">{`\u20B9`}{g.sip}/mo &middot; {g.yrs}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2.5 rounded-full bg-white/[0.06] overflow-hidden">
              <div className={`h-full rounded-full ${g.bc}`} style={{ width: `${g.pct}%` }} />
            </div>
            <span className="text-sm font-semibold text-slate-300 tabular-nums w-10 text-right">{g.pct}%</span>
          </div>
          <div className="flex justify-between mt-1.5 text-xs text-slate-600">
            <span>{`\u20B9`}{g.cur} of {`\u20B9`}{g.tgt}</span>
            <span className="flex items-center gap-1 text-slate-500"><Link2 size={10} /> 2 portfolios linked</span>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ─────────────────── SMALL COMPONENTS ─────────────────── */

function GI({ s = 16 }) {
  return (
    <svg viewBox="0 0 24 24" width={s} height={s} className="shrink-0">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}

function WS({ l, v, lc, vc, extra }) {
  return (
    <div className="py-3.5 text-center">
      <p className={`text-xs font-semibold uppercase tracking-wider ${lc}`}>{l}</p>
      <p className={`text-lg font-bold tabular-nums mt-0.5 ${vc}`}>{v}{extra && <span className="text-sm ml-1 text-emerald-400">{extra}</span>}</p>
    </div>
  )
}

function MRow({ n, alloc, cur, pl, ath, athC, up, last }) {
  return (
    <div className={`flex items-center justify-between px-4 py-3 ${last ? '' : 'border-b border-white/[0.03]'}`}>
      <div>
        <p className="text-sm font-medium text-slate-300">{n}</p>
        <p className="text-xs text-slate-600">Alloc {alloc} &middot; <span className={athC}>{ath !== 'At ATH' ? `${ath} below ATH` : ath}</span></p>
      </div>
      <div className="text-right">
        <p className="text-sm font-semibold text-slate-200 tabular-nums">{cur}</p>
        <p className={`text-sm font-semibold tabular-nums ${up ? 'text-emerald-400' : 'text-rose-400'}`}>{pl}</p>
      </div>
    </div>
  )
}

function Bullet({ c, t }) {
  const colors = { violet: 'text-violet-400', cyan: 'text-cyan-400', amber: 'text-amber-400', emerald: 'text-emerald-400' }
  return (
    <div className="flex items-center gap-2.5">
      <CheckCircle2 size={16} className={`${colors[c]} shrink-0`} />
      <span className="text-sm text-slate-300">{t}</span>
    </div>
  )
}

function HowStep({ num, icon, color, title, desc }) {
  const colors = {
    violet: ['text-violet-400', 'bg-violet-500/10', 'border-violet-500/20', 'from-violet-500/20 to-violet-500/5'],
    emerald: ['text-emerald-400', 'bg-emerald-500/10', 'border-emerald-500/20', 'from-emerald-500/20 to-emerald-500/5'],
    cyan: ['text-cyan-400', 'bg-cyan-500/10', 'border-cyan-500/20', 'from-cyan-500/20 to-cyan-500/5'],
    amber: ['text-amber-400', 'bg-amber-500/10', 'border-amber-500/20', 'from-amber-500/20 to-amber-500/5'],
  }
  const [tc, ibg, bdr, grad] = colors[color] || colors.violet
  return (
    <div className={`relative rounded-2xl border ${bdr} bg-gradient-to-b ${grad} p-6 text-center`}>
      <span className={`inline-flex items-center justify-center w-12 h-12 rounded-xl ${ibg} ${tc} mb-4`}>{icon}</span>
      <span className={`absolute top-4 right-4 text-xs font-bold ${tc} opacity-40`}>0{num}</span>
      <h3 className="text-base font-bold text-white mb-2">{title}</h3>
      <p className="text-sm text-slate-400 leading-relaxed">{desc}</p>
    </div>
  )
}

function TrustStrip({ icon, t, d, bg, c }) {
  const colors = { emerald: 'text-emerald-400', violet: 'text-violet-400', amber: 'text-amber-400' }
  return (
    <div className={`flex-1 ${bg} px-5 sm:px-8 lg:px-10 py-6 sm:py-8 border-b sm:border-b-0 sm:border-r border-white/[0.04] last:border-0`}>
      <p className="text-base font-bold text-white flex items-center gap-2"><span className={`${colors[c]} shrink-0`}>{icon}</span>{t}</p>
      <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">{d}</p>
    </div>
  )
}

const CM = { violet: ['text-violet-400','bg-violet-500/8','border-violet-500/10'], blue: ['text-blue-400','bg-blue-500/8','border-blue-500/10'], emerald: ['text-emerald-400','bg-emerald-500/8','border-emerald-500/10'], cyan: ['text-cyan-400','bg-cyan-500/8','border-cyan-500/10'], rose: ['text-rose-400','bg-rose-500/8','border-rose-500/10'], orange: ['text-orange-400','bg-orange-500/8','border-orange-500/10'], teal: ['text-teal-400','bg-teal-500/8','border-teal-500/10'], red: ['text-red-400','bg-red-500/8','border-red-500/10'], yellow: ['text-yellow-400','bg-yellow-500/8','border-yellow-500/10'], pink: ['text-pink-400','bg-pink-500/8','border-pink-500/10'] }

function FC({ icon, c, t, d }) {
  const [ic, bg, br] = CM[c] || CM.violet
  return (
    <div className={`rounded-xl border ${br} ${bg} p-5`}>
      <p className="text-base font-bold text-white flex items-center gap-2"><span className={`${ic} shrink-0`}>{icon}</span>{t}</p>
      <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">{d}</p>
    </div>
  )
}
