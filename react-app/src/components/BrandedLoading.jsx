import { useState, useEffect } from 'react'

// The first screen while the app connects to Google and loads the family's sheet: our logo floating over three
// money jars that fill as coins drop in, a growth line drawing itself, and short messages that change as it works.
// No libraries, works in light and dark, and stays still for people who turn off motion.

const LOGO_ICON = `${import.meta.env.BASE_URL}logo-new.png`

const SETUP_STEPS = [
  { text: 'Signing you in…',                              pct: 5 },
  { text: 'Creating your spreadsheet in Google Drive…',   pct: 18 },
  { text: 'Setting up investment tracking sheets…',       pct: 35 },
  { text: 'Configuring goals & family profiles…',         pct: 50 },
  { text: 'Setting up insurance & liabilities…',          pct: 65 },
  { text: 'Importing your portfolio data…',               pct: 80 },
  { text: 'Almost ready — finalizing setup…',             pct: 92 },
  { text: 'Hang tight, this only happens once!',          pct: 97 },
]
const SETUP_DELAYS = [0, 5000, 13000, 21000, 29000, 37000, 45000, 53000]
const MSG = {
  auth: ['Connecting to your Google account…', 'Checking it is you…', 'Almost in…'],
  load: ['Opening your private sheet in Google Drive…', 'Loading your family’s investments…', 'Checking today’s fund prices…', 'Working out your goals…'],
}
const TIPS = ['Your data stays in your own Google Drive.', 'Free and open source, made for Indian families.', 'One place for funds, stocks, goals and insurance.']

const CSS = `
.cfl{min-height:100dvh;display:flex;align-items:center;justify-content:center;background:#080d1a;color:#94a3b8}
[data-theme="light"] .cfl{background:#f6f7fb;color:#475569}
.cfl-in{display:flex;flex-direction:column;align-items:center;gap:20px;padding:0 24px;text-align:center;max-width:340px;width:100%}
.cfl-scene{width:260px;height:170px;overflow:visible}
.cfl-float{animation:cfl-float 3.2s ease-in-out infinite}
.cfl-coin{animation:cfl-drop 2.4s cubic-bezier(.5,0,.75,0) infinite;opacity:0}
.cfl-c2{animation-delay:.8s}.cfl-c3{animation-delay:1.6s}
.cfl-fill{animation:cfl-fill 4.8s ease-in-out infinite;transform-box:fill-box;transform-origin:bottom}
.cfl-f2{animation-delay:.8s}.cfl-f3{animation-delay:1.6s}
.cfl-line{stroke-dasharray:240;stroke-dashoffset:240;animation:cfl-draw 4.8s ease-in-out infinite}
.cfl-bar{height:4px;border-radius:4px;background:rgba(148,163,184,.18);overflow:hidden;width:220px}
.cfl-bar>i{display:block;height:100%;border-radius:4px;background:linear-gradient(90deg,#7c3aed,#14b8a6)}
.cfl-run{width:40%;animation:cfl-run 1.4s ease-in-out infinite}
.cfl-msg{font-size:14px;line-height:1.5;margin:0;min-height:21px;animation:cfl-fade .45s ease}
.cfl-tip{font-size:12px;line-height:1.5;margin:6px 0 0;opacity:.7}
.cfl-name{font-size:21px;margin:0;letter-spacing:.01em}
.cfl-name b{color:#fff;font-weight:800}[data-theme="light"] .cfl-name b{color:#0f172a}
.cfl-name em{color:#10b981;font-weight:800;font-style:normal}
@keyframes cfl-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
@keyframes cfl-drop{0%{opacity:0;transform:translateY(-8px)}15%{opacity:1}70%{opacity:1;transform:translateY(58px)}80%,100%{opacity:0;transform:translateY(62px)}}
@keyframes cfl-fill{0%{transform:scaleY(.25)}50%{transform:scaleY(.92)}100%{transform:scaleY(.25)}}
@keyframes cfl-draw{0%{stroke-dashoffset:240}55%,100%{stroke-dashoffset:0}}
@keyframes cfl-run{0%{transform:translateX(-110%)}100%{transform:translateX(260%)}}
@keyframes cfl-fade{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion: reduce){.cfl-float,.cfl-coin,.cfl-fill,.cfl-line,.cfl-run,.cfl-msg{animation:none}.cfl-line{stroke-dashoffset:0}.cfl-fill{transform:scaleY(.7)}}
`

function Jar({ x, color, fillCls }) {
  return (
    <g transform={`translate(${x} 92)`}>
      <rect x="6" y="-6" width="28" height="7" rx="3" fill={color} />
      <rect x="0" y="0" width="40" height="58" rx="10" fill={`${color}1f`} stroke={color} strokeWidth="2.5" />
      <rect className={`cfl-fill ${fillCls}`} x="4" y="8" width="32" height="46" rx="7" fill={color} opacity=".85" />
    </g>
  )
}
function Coin({ x, cls }) {
  return (
    <g transform={`translate(${x} 72)`}>
      <g className={`cfl-coin ${cls}`}>
        <circle r="7" fill="#fbbf24" stroke="#d97706" strokeWidth="1.5" />
        <text y="3.5" textAnchor="middle" fontSize="9" fontWeight="800" fill="#92400e">₹</text>
      </g>
    </g>
  )
}

export default function BrandedLoading({ phase }) {
  const isSetup = phase === 'data'
  const [step, setStep] = useState(0)
  const [i, setI] = useState(0)
  useEffect(() => {
    if (!isSetup) return undefined
    const timers = SETUP_DELAYS.slice(1).map((delay, k) => setTimeout(() => setStep(k + 1), delay))
    return () => timers.forEach(clearTimeout)
  }, [isSetup])
  useEffect(() => { const t = setInterval(() => setI((v) => v + 1), 2200); return () => clearInterval(t) }, [])
  const list = phase === 'auth' ? MSG.auth : MSG.load
  const msg = isSetup ? SETUP_STEPS[step].text : list[Math.min(i, list.length - 1)]
  const tip = TIPS[Math.floor(i / 2) % TIPS.length]
  const pct = isSetup ? SETUP_STEPS[step].pct : null

  return (
    <div className="cfl" role="status" aria-live="polite">
      <style>{CSS}</style>
      <div className="cfl-in">
        <svg className="cfl-scene" viewBox="0 0 260 170" aria-hidden="true">
          <polyline className="cfl-line" points="20,124 70,108 110,114 150,88 190,92 240,60" fill="none" stroke="#14b8a6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity=".5" />
          <line x1="22" y1="151" x2="238" y2="151" stroke="currentColor" strokeOpacity=".25" strokeWidth="2" strokeLinecap="round" />
          <Jar x={56} color="#14b8a6" fillCls="" />
          <Jar x={110} color="#f59e0b" fillCls="cfl-f2" />
          <Jar x={164} color="#8b5cf6" fillCls="cfl-f3" />
          <Coin x={76} cls="" />
          <Coin x={130} cls="cfl-c2" />
          <Coin x={184} cls="cfl-c3" />
          <g className="cfl-float">
            <circle cx="130" cy="36" r="32" fill="#ffffff" />
            <circle cx="130" cy="36" r="37" fill="none" stroke="#10b981" strokeOpacity=".35" strokeWidth="2" />
            <image href={LOGO_ICON} x="104" y="12" width="52" height="48" preserveAspectRatio="xMidYMid meet" />
          </g>
        </svg>

        <p className="cfl-name"><b>Capital</b> <em>Friends</em></p>

        <div className="cfl-bar">{isSetup ? <i style={{ width: `${pct}%`, transition: 'width 1.2s ease' }} /> : <i className="cfl-run" />}</div>

        <div>
          <p key={msg} className="cfl-msg">{msg}</p>
          <p className="cfl-tip">{isSetup && step >= 1 ? 'Setting up your private Google Sheet. This only happens once.' : tip}</p>
        </div>
      </div>
    </div>
  )
}
