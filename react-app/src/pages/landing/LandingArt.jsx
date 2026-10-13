// Illustrations for the landing page: flat people, coins, jars and icon discs drawn in SVG, moved with CSS3
// animations (float, coins dropping, jars filling, a donut drawing itself, an email flying to the family).
// Everything respects prefers-reduced-motion. Calm palette: navy, teal, emerald, violet, amber, sky.
import { useEffect, useRef, useState } from 'react'

export const C = {
  navy: '#0f172a', ink: '#1e293b', slate: '#64748b', line: '#e2e8f0', paper: '#ffffff', mist: '#f1f5f9',
  teal: '#14b8a6', emerald: '#10b981', violet: '#7c3aed', lilac: '#a78bfa', amber: '#f59e0b', sky: '#0ea5e9', rose: '#f43f5e',
  skin1: '#f1c7a1', skin2: '#d9a27a', skin3: '#b97e57', hair: '#2b2131',
}

/** Adds .in when the element scrolls into view (once), so its animations start then. */
export function useReveal() {
  const ref = useRef(null)
  const [on, setOn] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') { setOn(true); return }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setOn(true); io.disconnect() } }, { threshold: 0.25 })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return [ref, on]
}

/* ───────── a flat person (origin = between the feet, ~200 tall) ───────── */
export function Person({ x = 0, y = 0, s = 1, skin = C.skin1, hair = C.hair, shirt = C.teal, pants = C.ink, style = 'short', pose = 'down', flip = false, children }) {
  const arm = (side, kind) => {
    const sx = side === 'l' ? -27 : 27
    const ang = kind === 'wave' ? (side === 'l' ? 150 : -150) : kind === 'point' ? (side === 'l' ? 105 : -105) : kind === 'hold' ? (side === 'l' ? 40 : -40) : (side === 'l' ? 12 : -12)
    return (
      <g transform={`translate(${sx} -142)`}>
        <g className={kind === 'wave' ? 'la-wave' : ''} style={{ transformOrigin: '0px 0px' }}>
          <g transform={`rotate(${ang})`}>
            <rect x="-7" y="-4" width="14" height="34" rx="7" fill={shirt} />
            <rect x="-6" y="24" width="12" height="32" rx="6" fill={skin} />
            <circle cx="0" cy="58" r="7.5" fill={skin} />
          </g>
        </g>
      </g>
    )
  }
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`}>
      <ellipse cx="0" cy="2" rx="38" ry="7" fill="#0f172a" opacity=".08" />
      <rect x="-19" y="-84" width="17" height="84" rx="8" fill={pants} />
      <rect x="2" y="-84" width="17" height="84" rx="8" fill={pants} />
      <ellipse cx="-11" cy="-2" rx="13" ry="6" fill={C.navy} />
      <ellipse cx="11" cy="-2" rx="13" ry="6" fill={C.navy} />
      {arm('l', pose === 'wave-l' ? 'wave' : pose === 'point-l' ? 'point' : pose === 'hold' ? 'hold' : 'down')}
      <rect x="-29" y="-152" width="58" height="80" rx="24" fill={shirt} />
      <path d="M-12 -152 L0 -136 L12 -152 Z" fill={skin} opacity=".9" />
      {arm('r', pose === 'wave' ? 'wave' : pose === 'point' ? 'point' : pose === 'hold' ? 'hold' : 'down')}
      <rect x="-6" y="-166" width="12" height="16" rx="5" fill={skin} />
      {style === 'long' && <path d="M-25 -182 Q-28 -140 -14 -136 L14 -136 Q28 -140 25 -182 Z" fill={hair} />}
      <circle cx="0" cy="-184" r="22" fill={skin} />
      {style === 'bun' && <circle cx="0" cy="-212" r="10" fill={hair} />}
      <path d={style === 'long' || style === 'bun' ? 'M-23 -184 A23 23 0 0 1 23 -184 Q14 -196 0 -196 Q-12 -194 -23 -184 Z' : 'M-22 -186 A22 22 0 0 1 22 -188 Q12 -198 -2 -196 Q-14 -194 -22 -186 Z'} fill={hair} />
      <circle cx="-7" cy="-184" r="2.2" fill={C.navy} /><circle cx="7" cy="-184" r="2.2" fill={C.navy} />
      <path d="M-6 -175 Q0 -170 6 -175" stroke={C.navy} strokeWidth="2" fill="none" strokeLinecap="round" />
      {children}
    </g>
  )
}

/* ───────── small glyphs for the icon discs ───────── */
export const G = {
  rupee: <text x="0" y="8" textAnchor="middle" fontSize="24" fontWeight="800" fill="currentColor" fontFamily="Inter, sans-serif">₹</text>,
  chart: <polyline points="-12,8 -4,0 2,5 12,-8" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />,
  shield: <path d="M0 -12 L11 -7 V1 Q11 9 0 13 Q-11 9 -11 1 V-7 Z" fill="currentColor" />,
  gold: <g fill="currentColor"><path d="M-13 9 L-9 1 H-1 L3 9 Z" /><path d="M-3 9 L1 1 H9 L13 9 Z" opacity=".75" /><path d="M-8 0 L-4 -8 H4 L8 0 Z" /></g>,
  bank: <g fill="currentColor"><path d="M-13 -4 L0 -12 L13 -4 Z" /><rect x="-11" y="-2" width="4" height="10" /><rect x="-2" y="-2" width="4" height="10" /><rect x="7" y="-2" width="4" height="10" /><rect x="-13" y="9" width="26" height="3" /></g>,
  target: <g fill="none" stroke="currentColor" strokeWidth="3"><circle r="11" /><circle r="5" /><circle r="1" fill="currentColor" /></g>,
  home: <g fill="currentColor"><path d="M-12 0 L0 -11 L12 0 Z" /><rect x="-8" y="-1" width="16" height="12" rx="1.5" /></g>,
  stocks: <g fill="currentColor"><rect x="-11" y="0" width="5" height="10" rx="1" /><rect x="-2.5" y="-6" width="5" height="16" rx="1" /><rect x="6" y="-11" width="5" height="21" rx="1" /></g>,
  mail: <g><rect x="-12" y="-8" width="24" height="17" rx="3" fill="currentColor" /><path d="M-11 -6 L0 3 L11 -6" fill="none" stroke="#fff" strokeWidth="2.2" /></g>,
  loan: <g fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M-10 6 H10" /><path d="M-6 -8 L6 4" /><circle cx="-6" cy="-3" r="2.5" fill="currentColor" /><circle cx="6" cy="-6" r="2.5" fill="currentColor" stroke="none" /></g>,
  check: <path d="M-9 0 L-3 7 L10 -7" fill="none" stroke="currentColor" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />,
  lock: <g fill="currentColor"><rect x="-10" y="-3" width="20" height="15" rx="3" /><path d="M-6 -3 V-7 A6 6 0 0 1 6 -7 V-3" fill="none" stroke="currentColor" strokeWidth="3" /></g>,
  sheet: <g><rect x="-11" y="-12" width="22" height="24" rx="3" fill="currentColor" /><path d="M-7 -5 H7 M-7 1 H7 M-7 7 H7 M-1 -8 V10" stroke="#fff" strokeWidth="1.8" /></g>,
}
export function Disc({ x, y, r = 26, color, glyph, cls = '', delay = 0, label }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <g className={`la-float ${cls}`} style={{ animationDelay: `${delay}s` }}>
        <circle r={r + 6} fill={color} opacity=".12" />
        <circle r={r} fill="#fff" stroke={color} strokeWidth="2.5" />
        <g style={{ color }} transform={`scale(${r / 26})`}>{G[glyph]}</g>
        {label && <text y={r + 20} textAnchor="middle" fontSize="12" fontWeight="700" fill={C.slate} fontFamily="Inter, sans-serif">{label}</text>}
      </g>
    </g>
  )
}

/* ───────── hero: a family around their money, coins into goal jars, the summary flying to mom's phone ───────── */
export function HeroArt() {
  return (
    <svg viewBox="0 0 600 470" width="100%" role="img" aria-label="A family looking at all their money in one place: funds, stocks, FDs, gold and insurance, with coins filling goal jars">
      <defs>
        <linearGradient id="la-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ecfeff" /><stop offset="1" stopColor="#f5f3ff" /></linearGradient>
        <clipPath id="la-jar1"><path d="M0 0 h56 v74 q0 12 -12 12 h-32 q-12 0 -12 -12 Z" /></clipPath>
        <clipPath id="la-jar2"><path d="M0 0 h56 v74 q0 12 -12 12 h-32 q-12 0 -12 -12 Z" /></clipPath>
      </defs>
      <circle cx="300" cy="225" r="205" fill="url(#la-sky)" />
      <ellipse cx="300" cy="438" rx="250" ry="16" fill="#0f172a" opacity=".05" />

      {/* the app card */}
      <g transform="translate(178 70)">
        <g className="la-rise">
          <rect width="244" height="176" rx="18" fill="#fff" stroke={C.line} strokeWidth="1.5" />
          <rect width="244" height="34" rx="18" fill={C.mist} /><rect y="17" width="244" height="17" fill={C.mist} />
          <circle cx="18" cy="17" r="4.5" fill="#fca5a5" /><circle cx="32" cy="17" r="4.5" fill="#fcd34d" /><circle cx="46" cy="17" r="4.5" fill="#86efac" />
          <text x="20" y="62" fontSize="10.5" fontWeight="700" fill={C.slate} fontFamily="Inter, sans-serif">FAMILY NET WORTH</text>
          <text x="20" y="86" fontSize="22" fontWeight="800" fill={C.navy} fontFamily="Poppins, Inter, sans-serif">₹1.17 Cr</text>
          {/* donut drawing itself */}
          <g transform="translate(190 96)">
            <circle r="30" fill="none" stroke={C.mist} strokeWidth="11" />
            <circle className="la-donut d1" r="30" fill="none" stroke={C.violet} strokeWidth="11" strokeDasharray="70 189" transform="rotate(-90)" />
            <circle className="la-donut d2" r="30" fill="none" stroke={C.teal} strokeWidth="11" strokeDasharray="52 189" strokeDashoffset="-70" transform="rotate(-90)" />
            <circle className="la-donut d3" r="30" fill="none" stroke={C.amber} strokeWidth="11" strokeDasharray="28 189" strokeDashoffset="-122" transform="rotate(-90)" />
            <circle className="la-donut d4" r="30" fill="none" stroke={C.sky} strokeWidth="11" strokeDasharray="22 189" strokeDashoffset="-150" transform="rotate(-90)" />
          </g>
          {/* bars growing */}
          {[[20, 46, C.violet], [40, 62, C.teal], [60, 38, C.amber], [80, 74, C.emerald], [100, 54, C.sky]].map(([bx, h, c], i) => (
            <rect key={i} className="la-bar" style={{ animationDelay: `${0.5 + i * 0.12}s` }} x={bx} y={160 - h} width="13" height={h} rx="4" fill={c} />
          ))}
          <rect x="128" y="146" width="40" height="7" rx="3.5" fill={C.mist} /><rect x="128" y="132" width="26" height="7" rx="3.5" fill={C.mist} />
        </g>
      </g>

      {/* what the family owns, floating around the card */}
      <Disc x={132} y={86} color={C.violet} glyph="chart" delay={0} label="Funds" />
      <Disc x={466} y={78} color={C.emerald} glyph="stocks" delay={0.6} label="Stocks" />
      <Disc x={106} y={212} color={C.sky} glyph="bank" delay={1.2} label="FD & bank" />
      <Disc x={494} y={200} color={C.amber} glyph="gold" delay={0.3} label="Gold" />
      <Disc x={300} y={30} r={22} color={C.rose} glyph="shield" delay={0.9} />

      {/* coins dropping into the goal jars */}
      {[0, 1, 2].map((i) => <g key={i} transform={`translate(${312 + i * 4} 250)`}><g className="la-coin" style={{ animationDelay: `${1 + i * 0.9}s` }}><circle r="9" fill={C.amber} stroke="#d97706" strokeWidth="2" /><text y="4" textAnchor="middle" fontSize="10" fontWeight="800" fill="#7c2d12" fontFamily="Inter">₹</text></g></g>)}
      <g transform="translate(276 330)">
        <rect x="-4" y="-8" width="64" height="12" rx="6" fill="#cbd5e1" />
        <g clipPath="url(#la-jar1)"><rect width="56" height="86" fill="#f8fafc" /><g className="la-fill f1"><rect y="20" width="56" height="70" fill={C.teal} opacity=".85" /><path className="la-wave-top" d="M-56 22 q14 -8 28 0 t28 0 t28 0 t28 0 v8 h-112z" fill={C.teal} /></g></g>
        <path d="M0 0 h56 v74 q0 12 -12 12 h-32 q-12 0 -12 -12 Z" fill="none" stroke="#94a3b8" strokeWidth="2.5" />
        <text x="28" y="108" textAnchor="middle" fontSize="12" fontWeight="700" fill={C.slate} fontFamily="Inter">Education</text>
      </g>
      <g transform="translate(350 330)">
        <rect x="-4" y="-8" width="64" height="12" rx="6" fill="#cbd5e1" />
        <g clipPath="url(#la-jar2)"><rect width="56" height="86" fill="#f8fafc" /><g className="la-fill f2"><rect y="40" width="56" height="60" fill={C.violet} opacity=".8" /><path className="la-wave-top" d="M-56 42 q14 -8 28 0 t28 0 t28 0 t28 0 v8 h-112z" fill={C.violet} /></g></g>
        <path d="M0 0 h56 v74 q0 12 -12 12 h-32 q-12 0 -12 -12 Z" fill="none" stroke="#94a3b8" strokeWidth="2.5" />
        <text x="28" y="108" textAnchor="middle" fontSize="12" fontWeight="700" fill={C.slate} fontFamily="Inter">Retirement</text>
      </g>

      {/* the family */}
      <Person x={150} y={432} s={0.95} shirt={C.teal} pants="#334155" pose="point" skin={C.skin2} />
      <Person x={232} y={432} s={0.6} shirt={C.amber} pants="#475569" pose="wave" skin={C.skin2} style="short" />
      <Person x={476} y={432} s={0.92} shirt={C.violet} pants="#334155" pose="hold" style="bun" skin={C.skin1} flip>
        {/* phone in her hand */}
        <g transform="translate(-36 -112) rotate(-8)"><rect x="-11" y="-18" width="22" height="36" rx="4" fill={C.navy} /><rect x="-8" y="-14" width="16" height="26" rx="2" fill="#e0f2fe" /></g>
      </Person>
      {/* the monthly summary flying to her phone */}
      <g className="la-mail"><g transform="translate(0 0)"><rect x="-14" y="-10" width="28" height="20" rx="4" fill={C.emerald} /><path d="M-12 -8 L0 2 L12 -8" fill="none" stroke="#fff" strokeWidth="2.2" /></g></g>
    </svg>
  )
}

/* ───────── "how it works" pictures ───────── */
export function StepSignIn() {
  return (
    <svg viewBox="0 0 240 150" width="100%" aria-hidden="true">
      <rect x="18" y="20" width="120" height="96" rx="12" fill="#fff" stroke={C.line} strokeWidth="1.5" />
      <circle cx="78" cy="56" r="17" fill="#fff" stroke={C.line} strokeWidth="1.5" />
      <text x="78" y="63" textAnchor="middle" fontSize="20" fontWeight="800" fill="#4285f4" fontFamily="Inter">G</text>
      <rect x="40" y="86" width="76" height="14" rx="7" fill={C.violet} />
      <path className="la-dash" d="M142 68 C170 68 168 68 186 68" fill="none" stroke={C.teal} strokeWidth="3" strokeDasharray="6 6" strokeLinecap="round" />
      <g transform="translate(196 68)"><g className="la-pop"><circle r="26" fill="#dcfce7" /><g style={{ color: '#16a34a' }}>{G.sheet}</g></g></g>
      <text x="196" y="118" textAnchor="middle" fontSize="11" fontWeight="700" fill={C.slate} fontFamily="Inter">your Drive</text>
    </svg>
  )
}
export function StepImport() {
  return (
    <svg viewBox="0 0 240 150" width="100%" aria-hidden="true">
      <g className="la-slide-in"><rect x="20" y="26" width="72" height="92" rx="8" fill="#fff" stroke={C.line} strokeWidth="1.5" /><rect x="20" y="26" width="72" height="20" rx="8" fill="#fee2e2" /><text x="56" y="41" textAnchor="middle" fontSize="11" fontWeight="800" fill="#dc2626" fontFamily="Inter">PDF</text>
        {[58, 70, 82, 94].map((yy) => <rect key={yy} x="30" y={yy} width={yy % 24 ? 52 : 38} height="6" rx="3" fill={C.mist} />)}</g>
      <path d="M100 72 h22" stroke={C.slate} strokeWidth="3" strokeLinecap="round" /><path d="M116 64 l8 8 -8 8" fill="none" stroke={C.slate} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="132" y="14" width="76" height="122" rx="14" fill={C.navy} /><rect x="138" y="24" width="64" height="102" rx="8" fill="#fff" />
      {[0, 1, 2, 3].map((i) => <g key={i} className="la-row" style={{ animationDelay: `${0.4 + i * 0.25}s` }}><rect x="144" y={34 + i * 22} width="10" height="10" rx="3" fill={[C.violet, C.teal, C.amber, C.sky][i]} /><rect x="158" y={35 + i * 22} width={36 - i * 4} height="8" rx="4" fill={C.mist} /></g>)}
      <rect className="la-scan" x="138" y="24" width="64" height="4" fill={C.teal} opacity=".55" />
    </svg>
  )
}
export function StepSee() {
  return (
    <svg viewBox="0 0 240 150" width="100%" aria-hidden="true">
      <rect x="16" y="14" width="208" height="122" rx="14" fill="#fff" stroke={C.line} strokeWidth="1.5" />
      <g transform="translate(70 76)">
        <circle r="34" fill="none" stroke={C.mist} strokeWidth="13" />
        <circle className="la-donut d1" r="34" fill="none" stroke={C.violet} strokeWidth="13" strokeDasharray="80 214" transform="rotate(-90)" />
        <circle className="la-donut d2" r="34" fill="none" stroke={C.teal} strokeWidth="13" strokeDasharray="60 214" strokeDashoffset="-80" transform="rotate(-90)" />
        <circle className="la-donut d3" r="34" fill="none" stroke={C.amber} strokeWidth="13" strokeDasharray="40 214" strokeDashoffset="-140" transform="rotate(-90)" />
        <circle className="la-donut d4" r="34" fill="none" stroke={C.sky} strokeWidth="13" strokeDasharray="34 214" strokeDashoffset="-180" transform="rotate(-90)" />
      </g>
      {[[C.violet, 'Funds', 64], [C.teal, 'FD & PPF', 48], [C.amber, 'Gold', 34], [C.sky, 'Stocks', 28]].map(([c, l, w], i) => (
        <g key={l} transform={`translate(124 ${44 + i * 22})`}><circle cx="4" cy="4" r="4" fill={c} /><text x="14" y="8" fontSize="10.5" fontWeight="700" fill={C.ink} fontFamily="Inter">{l}</text><rect className="la-bar-x" style={{ animationDelay: `${0.6 + i * 0.15}s` }} x="62" y="1" width={w / 2} height="7" rx="3.5" fill={c} opacity=".8" /></g>
      ))}
    </svg>
  )
}
export function StepGoals() {
  const jar = (x, c, lvl, label, d) => (
    <g transform={`translate(${x} 34)`}>
      <rect x="-3" y="-7" width="50" height="10" rx="5" fill="#cbd5e1" />
      <clipPath id={`la-sj-${label}`}><path d="M0 0 h44 v70 q0 10 -10 10 h-24 q-10 0 -10 -10 Z" /></clipPath>
      <g clipPath={`url(#la-sj-${label})`}><rect width="44" height="80" fill="#f8fafc" /><g className="la-fill" style={{ animationDelay: `${d}s` }}><rect y={80 - lvl} width="44" height={lvl} fill={c} opacity=".85" /></g></g>
      <path d="M0 0 h44 v70 q0 10 -10 10 h-24 q-10 0 -10 -10 Z" fill="none" stroke="#94a3b8" strokeWidth="2" />
      <text x="22" y="98" textAnchor="middle" fontSize="10.5" fontWeight="700" fill={C.slate} fontFamily="Inter">{label}</text>
    </g>
  )
  return (
    <svg viewBox="0 0 240 150" width="100%" aria-hidden="true">
      {jar(22, C.sky, 66, 'Emergency', 0.2)}{jar(98, C.teal, 44, 'Home', 0.5)}{jar(174, C.violet, 28, 'Retire', 0.8)}
      <g transform="translate(120 20)"><g className="la-coin" style={{ animationDelay: '1s' }}><circle r="8" fill={C.amber} stroke="#d97706" strokeWidth="2" /></g></g>
    </svg>
  )
}
export function StepFamily() {
  return (
    <svg viewBox="0 0 240 150" width="100%" aria-hidden="true">
      <g transform="translate(46 76)"><circle r="30" fill="#ecfdf5" /><g style={{ color: C.emerald }} transform="scale(1.3)">{G.mail}</g></g>
      {[[160, 34, C.violet, C.skin1], [196, 80, C.teal, C.skin2], [156, 122, C.amber, C.skin3]].map(([x, y, c, sk], i) => (
        <g key={i}>
          <path className="la-dash" style={{ animationDelay: `${i * 0.3}s` }} d={`M78 76 Q${(78 + x) / 2} ${(76 + y) / 2 - 18} ${x - 22} ${y}`} fill="none" stroke={C.line} strokeWidth="2.5" strokeDasharray="5 6" />
          <g transform={`translate(${x} ${y})`}><g className="la-pop" style={{ animationDelay: `${0.5 + i * 0.3}s` }}>
            <circle r="19" fill={c} opacity=".15" /><circle cy="-3" r="8" fill={sk} /><path d="M-11 13 Q0 1 11 13 Z" fill={c} />
            <g transform="translate(14 -13)"><circle r="7" fill={C.emerald} /><g style={{ color: '#fff' }} transform="scale(.45)">{G.check}</g></g>
          </g></g>
        </g>
      ))}
    </svg>
  )
}

/* ───────── privacy: your sheet inside your own Drive, a lock, no bank logins ───────── */
export function PrivacyArt() {
  return (
    <svg viewBox="0 0 320 220" width="100%" aria-hidden="true">
      <circle cx="160" cy="110" r="96" fill="#f0fdfa" />
      <g transform="translate(160 106)"><g className="la-float"><path d="M0 -70 L60 -44 V4 Q60 52 0 76 Q-60 52 -60 4 V-44 Z" fill="#fff" stroke={C.teal} strokeWidth="4" />
        <g transform="scale(2.4)" style={{ color: C.teal }}>{G.lock}</g></g></g>
      <Disc x={50} y={60} r={22} color="#16a34a" glyph="sheet" delay={0.4} />
      <Disc x={272} y={62} r={22} color={C.violet} glyph="check" delay={1} />
      <g transform="translate(262 168)"><g className="la-float" style={{ animationDelay: '.7s' }}><circle r="24" fill="#fff" stroke={C.rose} strokeWidth="2.5" /><g style={{ color: C.rose }}>{G.bank}</g><path d="M-17 -17 L17 17" stroke={C.rose} strokeWidth="3.5" strokeLinecap="round" /></g></g>
      <Disc x={56} y={166} r={22} color={C.sky} glyph="mail" delay={1.3} />
    </svg>
  )
}

export const ART_CSS = `
.la-float{animation:laFloat 5.5s ease-in-out infinite}
.la-wave{animation:laWave 1.6s ease-in-out infinite}
.la-rise{animation:laRise .9s cubic-bezier(.2,.8,.2,1) both}
.la-bar{transform-box:fill-box;transform-origin:bottom;animation:laGrowY 1.1s cubic-bezier(.2,.8,.2,1) both}
.la-bar-x{transform-box:fill-box;transform-origin:left;animation:laGrowX 1s cubic-bezier(.2,.8,.2,1) both}
.la-donut{animation:laDraw 1.4s cubic-bezier(.4,0,.2,1) both}.la-donut.d2{animation-delay:.25s}.la-donut.d3{animation-delay:.5s}.la-donut.d4{animation-delay:.7s}
.la-coin{animation:laCoin 2.7s cubic-bezier(.5,0,.75,0) infinite}
.la-fill{transform-box:fill-box;animation:laFill 2.6s ease-out both}.la-fill.f2{animation-delay:.6s}
.la-wave-top{animation:laSlide 2.4s linear infinite}
.la-mail{offset-path:path('M300 140 C360 120 420 170 440 304');offset-rotate:0deg;animation:laMail 4.2s ease-in-out infinite 1.2s;opacity:0}
.la-dash{animation:laDash 1.2s linear infinite}
.la-pop{transform-box:fill-box;transform-origin:center;animation:laPop .6s cubic-bezier(.3,1.6,.5,1) both .3s}
.la-slide-in{animation:laSlideIn 1s cubic-bezier(.2,.8,.2,1) both}
.la-row{animation:laIn .5s ease-out both}
.la-scan{animation:laScan 2.2s ease-in-out infinite}
@keyframes laFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-9px)}}
@keyframes laWave{0%,100%{transform:rotate(0)}50%{transform:rotate(-22deg)}}
@keyframes laRise{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
@keyframes laGrowY{from{transform:scaleY(0)}to{transform:scaleY(1)}}
@keyframes laGrowX{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@keyframes laDraw{from{stroke-dasharray:0 400}}
@keyframes laCoin{0%{transform:translateY(-14px);opacity:0}12%{opacity:1}75%{transform:translateY(88px);opacity:1}82%,100%{transform:translateY(92px);opacity:0}}
@keyframes laFill{from{transform:translateY(60%)}to{transform:none}}
@keyframes laSlide{from{transform:translateX(0)}to{transform:translateX(56px)}}
@keyframes laMail{0%{offset-distance:0%;opacity:0;transform:scale(.6)}10%{opacity:1;transform:scale(1)}80%{offset-distance:100%;opacity:1}92%,100%{offset-distance:100%;opacity:0;transform:scale(.4)}}
@keyframes laDash{to{stroke-dashoffset:-24}}
@keyframes laPop{from{transform:scale(0);opacity:0}to{transform:scale(1);opacity:1}}
@keyframes laSlideIn{from{transform:translateX(-30px);opacity:0}to{transform:none;opacity:1}}
@keyframes laIn{from{opacity:0;transform:translateX(-6px)}to{opacity:1;transform:none}}
@keyframes laScan{0%{transform:translateY(0)}50%{transform:translateY(96px)}100%{transform:translateY(0)}}
.la-paused *{animation-play-state:paused!important}
@media (prefers-reduced-motion:reduce){.la-float,.la-wave,.la-coin,.la-wave-top,.la-mail,.la-dash,.la-scan{animation:none!important}.la-mail{display:none}}
`
