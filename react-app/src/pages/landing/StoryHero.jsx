// The landing page's first screen: everything Capital Friends does, without scrolling.
// Left: what it is + Sign in + five chapters. Right: a stage that plays each chapter as a small animated scene
// (flat illustrations + Open Peeps people, CSS3 animations) and moves on by itself; tap a chapter to jump.
import { useEffect, useRef, useState } from 'react'
import { C, G, Disc, ART_CSS } from './LandingArt'

// family members as simple flat busts (one style for everyone): tinted disc, shoulders, head, hair
const FOLK = {
  you: { skin: C.skin2, hair: C.hair, shirt: C.violet, look: 'short' },
  spouse: { skin: C.skin1, hair: C.hair, shirt: C.rose, look: 'long' },
  mother: { skin: C.skin2, hair: '#94a3b8', shirt: C.amber, look: 'bun' },
  father: { skin: C.skin3, hair: '#cbd5e1', shirt: C.sky, look: 'short' },
  son: { skin: C.skin1, hair: '#4b2e1e', shirt: C.emerald, look: 'short' },
}
export function Bust({ k, r = 28 }) {
  const f = FOLK[k], id = `bu-${k}-${r}`
  return (
    <g>
      <circle r={r} fill={`color-mix(in srgb, ${f.shirt} 16%, #fff)`} />
      <clipPath id={id}><circle r={r} /></clipPath>
      <g clipPath={`url(#${id})`} transform={`scale(${r / 28})`}>
        {f.look === 'long' && <path d="M-15 -14 Q-17 14 -10 20 H10 Q17 14 15 -14 Z" fill={f.hair} />}
        <path d="M-24 34 Q-24 12 0 12 Q24 12 24 34 Z" fill={f.shirt} />
        <rect x="-4.5" y="4" width="9" height="10" rx="4" fill={f.skin} />
        <circle cy="-6" r="12" fill={f.skin} />
        {f.look === 'bun' && <circle cy="-21" r="5.5" fill={f.hair} />}
        <path d={f.look === 'long' ? 'M-13 -6 Q-13 -20 0 -20 Q13 -20 13 -6 Q6 -14 -4 -12 Q-10 -10 -13 -6 Z' : 'M-12.5 -7 Q-13 -20 0 -19.5 Q13 -20 12.5 -7 Q9 -13 0 -13 Q-8 -13 -12.5 -7 Z'} fill={f.hair} />
        <circle cx="-4" cy="-5" r="1.3" fill={C.navy} /><circle cx="4" cy="-5" r="1.3" fill={C.navy} />
        <path d="M-3.5 0 Q0 2.6 3.5 0" fill="none" stroke={C.navy} strokeWidth="1.3" strokeLinecap="round" />
      </g>
    </g>
  )
}
const DUR = 7500

const CHAPTERS = [
  { k: 'drive', ph: 'private, in your own Drive', icon: 'lock', c: C.teal, s: 'Your Drive', t: 'Your data stays in your own Google Drive', dur: 7200, d: 'Sign in with Google and the app makes a private sheet in your Drive. Only you — and who you share it with — can see it.' },
  { k: 'all', ph: 'all in one place', icon: 'chart', c: C.violet, s: 'Track', t: 'Everything in one place', dur: 4500, d: 'Funds, stocks, FDs, PPF, gold, insurance and loans — for every family member.' },
  { k: 'cas', ph: 'imported in a minute', icon: 'sheet', c: C.sky, s: 'CAS import', t: 'Import your CAS in a minute', dur: 5000, d: 'Drop your CAMS / CDSL statement PDF: every fund, share and transaction comes in.' },
  { k: 'ath', ph: 'watched for you every day', icon: 'bell', c: C.rose, s: 'Alerts', t: 'Alerts when a fund falls below its all-time high', dur: 7000 },
  { k: 'goals', ph: 'planned for every goal', icon: 'target', c: C.amber, s: 'Goals', t: 'A plan for every goal', dur: 11500, d: 'Money shared across goals, safer as dates come near, and the exact step each month.' },
  { k: 'family', ph: 'known to your family', icon: 'mail', c: C.emerald, s: 'Family', t: 'Your family is never in the dark', dur: 5200, d: 'A regular summary email: where every rupee, policy and nominee is — even without you.' },
]

function Glyph({ name, color, size = 18 }) {
  return <svg width={size} height={size} viewBox="-16 -16 32 32" aria-hidden="true" style={{ color }}>{G[name]}</svg>
}

/* ───────── all five scenes are drawn wide (1100 × 420) so they fill the hero from edge to edge ───────── */
const T = (t) => ({ animationDelay: `${t}s` })
const Tx = ({ x, y, s = 11, w = 700, c = C.ink, a, len, children, ...r }) => (
  <text x={x} y={y} fontSize={s} fontWeight={w} fill={c} fontFamily="Inter" textAnchor={a} {...(len ? { textLength: len, lengthAdjust: 'spacingAndGlyphs' } : {})} {...r}>{children}</text>
)
const VB = '0 0 1100 420'
// a line that draws itself, with a dot running along it
const Flow = ({ d, c, t, dot = true }) => (
  <g>
    <path className="la-dash" style={T(t)} d={d} fill="none" stroke={c} strokeOpacity=".45" strokeWidth="2.5" strokeDasharray="5 7" strokeLinecap="round" />
    {dot && <circle className="st-flow" style={{ animationDelay: `${t + 0.3}s`, offsetPath: `path('${d}')` }} r="5" fill={c} />}
  </g>
)

/* 1 · your Drive: sign in → My Drive → your sheet, locked to you */
function SceneDrive() {
  const S = 1.2, W = 172, H = 186, Y = 44, X = [110, 447, 784], MID = Y + (H * S) / 2
  const Card = ({ x, t, children }) => (
    <g transform={`translate(${x} ${Y}) scale(${S})`}><g className="st-rise" style={T(t)}>
      <rect width={W} height={H} rx="16" fill="#fff" stroke={C.line} strokeWidth="1.5" />{children}
    </g></g>
  )
  return (
    <svg viewBox={VB} className="st-svg" aria-label="Sign in with Google, a private sheet is made in your own Google Drive, and only you can see it">
      <Card x={X[0]} t={0}>
        <circle cx="16" cy="16" r="3.5" fill="#fca5a5" /><circle cx="27" cy="16" r="3.5" fill="#fcd34d" /><circle cx="38" cy="16" r="3.5" fill="#86efac" />
        <g transform={`translate(${W / 2} 66)`}><Bust k="you" r={26} /></g>
        <g transform="translate(16 110)"><g className="st-press" style={T(1.1)}>
          <rect width="140" height="30" rx="15" fill={C.navy} />
          <circle cx="15" cy="15" r="9.5" fill="#fff" /><Tx x={15} y={19.5} s={11.5} w={800} c="#4285f4" a="middle">G</Tx>
          <Tx x={84} y={19} s={10} c="#fff" a="middle" len={92}>Sign in with Google</Tx>
        </g></g>
        <g transform={`translate(${W / 2} 162)`}><g className="st-pop" style={T(1.4)}><rect x="-56" y="-11" width="112" height="22" rx="11" fill="#ecfdf5" /><Tx y={4} s={9.5} c="#047857" a="middle">✓ you@gmail.com</Tx></g></g>
      </Card>
      <g className="st-cursor" style={{ offsetPath: `path('M${X[0] + 250} 400 C${X[0] + 240} 320 ${X[0] + 215} 250 ${X[0] + 185} 220')` }}><path d="M0 0 L0 18 L5 13 L9 22 L12 20 L8 12 L15 12 Z" fill={C.navy} stroke="#fff" strokeWidth="1.5" /></g>
      <Flow d={`M${X[0] + W * S + 10} ${MID} H${X[1] - 10}`} c={C.teal} t={1.8} />
      <Card x={X[1]} t={2.1}>
        <g transform="translate(18 18)"><path d="M8 0 h12 l10 17 h-12 Z" fill="#0f9d58" /><path d="M-1 22 l6 -10 h20 l-6 10 Z" fill="#4285f4" /><path d="M20 0 l10 17 l-6 10 l-10 -17 Z" fill="#fbbc04" /></g>
        <Tx x={58} y={34} s={12} w={800} c={C.navy}>Your Drive</Tx>
        {[0, 1, 2].map((k) => <g key={k} transform={`translate(14 ${54 + k * 28})`}><rect width={W - 28} height="22" rx="6" fill={C.mist} /><rect x="8" y="6" width="14" height="10" rx="2" fill="#cbd5e1" /><rect x="30" y="8" width={[60, 76, 48][k]} height="6" rx="3" fill="#cbd5e1" /></g>)}
        <g transform="translate(14 142)"><g className="st-newfile" style={T(2.9)}>
          <rect width={W - 28} height="28" rx="8" fill="#dcfce7" stroke="#16a34a" strokeWidth="1.5" />
          <rect x="8" y="6" width="14" height="16" rx="2.5" fill="#16a34a" /><path d="M11 11 H19 M11 15 H19 M11 19 H19 M15 8 V21" stroke="#fff" strokeWidth="1.3" />
          <Tx x={30} y={18} s={10.5} w={800} c="#14532d" len={88}>Capital Friends</Tx>
        </g></g>
      </Card>
      <Flow d={`M${X[1] + W * S + 10} ${MID} H${X[2] - 10}`} c={C.teal} t={3.4} />
      <Card x={X[2]} t={3.7}>
        <path d={`M0 16 Q0 0 16 0 H${W - 16} Q${W} 0 ${W} 16 V30 H0 Z`} fill="#16a34a" />
        <Tx x={14} y={20} s={11.5} w={800} c="#fff">Your sheet</Tx>
        {[0, 1, 2, 3, 4].map((r) => (
          <g key={r} transform={`translate(12 ${42 + r * 27})`}><g className="st-row" style={T(4.1 + r * 0.18)}>
            {[0, 1, 2].map((c) => <rect key={c} x={c * 50} y="0" width="48" height="21" rx="4" fill={r === 0 ? '#bbf7d0' : C.mist} />)}
            <rect x="7" y="7.5" width={[30, 34, 26, 36, 30][r]} height="6" rx="3" fill={r === 0 ? '#15803d' : '#cbd5e1'} />
            <rect x="107" y="7.5" width={[26, 30, 22, 32, 26][r]} height="6" rx="3" fill={r === 0 ? '#15803d' : [C.violet, C.teal, C.amber, C.sky][r - 1]} />
          </g></g>
        ))}
        <g transform={`translate(${W - 6} 6)`}><g className="st-pop" style={T(5.3)}>
          <circle className="st-halo" r="24" fill={C.teal} opacity=".2" />
          <circle r="21" fill="#fff" stroke={C.teal} strokeWidth="2.5" /><g transform="scale(.9)" style={{ color: C.teal }}>{G.lock}</g>
        </g></g>
      </Card>
      {[['check', 'Free'], ['lock', 'Only you see it'], ['shield', 'No bank logins']].map(([g, l], n) => (
        <g key={l} transform={`translate(${X[n] + (W * S) / 2} ${Y + H * S + 50})`}><g className="st-pop" style={T(5.6 + n * 0.2)}>
          <circle cx={-(l.length * 3.9) - 14} r="12" fill={`color-mix(in srgb, ${C.teal} 16%, #fff)`} /><g transform={`translate(${-(l.length * 3.9) - 14} 0) scale(.5)`} style={{ color: C.teal }}>{G[g]}</g>
          <Tx x={-(l.length * 3.9)} y={5} s={14} c={C.ink}>{l}</Tx>
        </g></g>
      ))}
    </svg>
  )
}

/* 2 · everything in one place: every member → one net worth ring → growing over the years */
const RING = [['chart', C.violet, 'Mutual funds', 30], ['stocks', C.emerald, 'Stocks', 14], ['home', '#ec4899', 'Real estate', 20], ['bank', C.sky, 'FD & PPF', 14], ['gold', C.amber, 'Gold', 10], ['shield', C.rose, 'Insurance', 4], ['loan', '#64748b', 'Loans', 8]]
const ALLOC = [['Mutual Funds', 46, '#f97316', '₹53.8 L'], ['Real Estate', 20, '#ec4899', '₹23.4 L'], ['Stocks', 12, '#8b5cf6', '₹14.0 L'], ['Gold', 10, '#fbbf24', '₹11.7 L'], ['FD & PPF', 12, '#34d399', '₹14.1 L']]
// a pie wedge starting at `from` % and spanning `p` %
const wedge = (from, p, r) => {
  const a0 = (from / 100) * 2 * Math.PI - Math.PI / 2, a1 = ((from + p) / 100) * 2 * Math.PI - Math.PI / 2
  return `M0 0 L${(r * Math.cos(a0)).toFixed(2)} ${(r * Math.sin(a0)).toFixed(2)} A${r} ${r} 0 ${p > 50 ? 1 : 0} 1 ${(r * Math.cos(a1)).toFixed(2)} ${(r * Math.sin(a1)).toFixed(2)} Z`
}
function SceneAll() {
  const cx = 550, cy = 205, R = 150, dr = 64, circ = 2 * Math.PI * dr, gap = 4
  let acc = 0
  return (
    <svg viewBox={VB} className="st-svg" aria-label="Every family member's funds, stocks, FDs, gold, insurance and loans in one net worth that grows over the years">
      {/* members on both sides, each flowing into the ring */}
      {[['you', 'You', '₹62 L', 0, 0], ['spouse', 'Spouse', '₹38 L', 0, 1], ['mother', 'Mother', '₹17 L', 1, 0], ['father', 'Father', '₹21 L', 1, 1]].map(([k, n, v, side, r]) => {
        const y = 130 + r * 150, bx = side ? 900 : 64, ex = side ? cx + R + 34 : cx - R - 34
        const d = side ? `M${bx - 8} ${y} C${bx - 90} ${y} ${ex + 60} ${cy} ${ex} ${cy}` : `M${bx + 144} ${y} C${bx + 230} ${y} ${ex - 60} ${cy} ${ex} ${cy}`
        return (
          <g key={k}>
            <Flow d={d} c={C.violet} t={0.6 + (side * 2 + r) * 0.2} />
            <g transform={`translate(${bx} ${y - 34})`}><g className="st-row" style={T(0.2 + (side * 2 + r) * 0.15)}>
              <rect width="136" height="68" rx="18" fill="#fff" stroke={C.line} strokeWidth="1.5" />
              <g transform="translate(34 34)"><Bust k={k} r={22} /></g>
              <Tx x={66} y={30} s={13} c={C.navy}>{n}</Tx><Tx x={66} y={48} s={11.5} w={600} c={C.slate}>{v}</Tx>
            </g></g>
          </g>
        )
      })}
      {/* the ring of everything they own */}
      <circle cx={cx} cy={cy} r={R} fill="none" stroke={C.line} strokeWidth="2" strokeDasharray="4 8" />
      {RING.map(([g, c, l], i) => {
        const a = (i / RING.length) * Math.PI * 2 - Math.PI / 2, x = cx + R * Math.cos(a), y = cy + R * Math.sin(a)
        return (
          <g key={g}>
            <circle className="st-flow" style={{ animationDelay: `${0.3 + i * 0.35}s`, offsetPath: `path('M${x} ${y} L${cx} ${cy}')` }} r="6" fill={c} />
            <Disc x={x} y={y} r={27} color={c} glyph={g} delay={i * 0.4} label={l} />
          </g>
        )
      })}
      <g transform={`translate(${cx} ${cy})`}><g className="st-pop" style={T(0.2)}>
        <circle r="86" fill="#fff" stroke={C.line} strokeWidth="1.5" />
        {RING.map(([g, c, , p], n) => {
          const len = (p / 100) * circ - gap, off = -(acc / 100) * circ; acc += p
          return <circle key={g} className="la-donut" style={T(0.4 + n * 0.15)} r={dr} fill="none" stroke={c} strokeWidth="13" strokeDasharray={`${len} ${circ - len}`} strokeDashoffset={off} transform="rotate(-90)" />
        })}
        <Tx y={-12} s={10.5} c={C.slate} a="middle">FAMILY NET WORTH</Tx>
        <Tx y={16} s={26} w={800} c={C.navy} a="middle">₹1.17 Cr</Tx>
        <Tx y={36} s={11} c={C.emerald} a="middle">▲ 14.2% a year</Tx>
      </g></g>
    </svg>
  )
}

/* 3 · CAS statement → read for you → every fund in the app */
function SceneCas() {
  const funds = [[C.violet, 'Flexi Cap Fund', '₹6.4 L', '+18%'], [C.teal, 'Balanced Advantage Fund', '₹4.1 L', '+13%'], [C.amber, 'Multi-Asset FoF', '₹2.9 L', '+15%'], [C.sky, 'Liquid Fund', '₹1.2 L', '+7%'], [C.emerald, 'Nifty 50 Index Fund', '₹3.6 L', '+16%']]
  return (
    <svg viewBox={VB} className="st-svg" aria-label="A CAS statement PDF turning into the family's funds in the app">
      <g transform="translate(90 70) scale(1.15)"><g className="st-rise">
        <rect width="190" height="230" rx="14" fill="#fff" stroke={C.line} strokeWidth="1.5" />
        <path d="M0 14 Q0 0 14 0 H176 Q190 0 190 14 V44 H0 Z" fill="#fee2e2" />
        <Tx x={16} y={28} s={13} w={800} c="#dc2626">PDF</Tx><Tx x={52} y={28} s={11.5} c={C.ink}>CAS statement</Tx>
        {[64, 84, 104, 124, 144, 164, 184].map((yy, i) => <rect key={yy} x="16" y={yy} width={i % 3 === 0 ? 120 : 158} height="8" rx="4" fill={C.mist} />)}
        <rect className="st-scan" x="0" y="50" width="190" height="5" fill={C.sky} opacity=".55" />
        <Tx x={95} y={214} s={10} c={C.slate} a="middle">CAMS · KFintech · CDSL · NSDL</Tx>
      </g></g>
      <Flow d="M330 205 H430" c={C.sky} t={0.6} />
      <Flow d="M330 185 C370 185 390 150 430 150" c={C.sky} t={0.9} />
      <Flow d="M330 225 C370 225 390 260 430 260" c={C.sky} t={1.2} />
      <g transform="translate(446 36)">
        <rect width="340" height="348" rx="18" fill="#fff" stroke={C.line} strokeWidth="1.5" />
        <Tx x={22} y={36} s={14} w={800} c={C.navy}>Mutual funds</Tx>
        {funds.map(([c, n, v, r], i) => (
          <g key={n} transform={`translate(18 ${56 + i * 56})`}><g className="st-row" style={T(0.8 + i * 0.35)}>
            <rect width="304" height="46" rx="12" fill={C.mist} />
            <circle cx="22" cy="23" r="11" fill={c} />
            <Tx x={42} y={27} s={12} c={C.ink}>{n}</Tx>
            <Tx x={290} y={21} s={12} w={800} c={C.navy} a="end">{v}</Tx>
            <Tx x={290} y={36} s={10.5} c={C.emerald} a="end">{r}</Tx>
          </g></g>
        ))}
      </g>
      {[['you', 'Your CAS', '24 funds'], ['spouse', "Spouse's CAS", '9 funds'], ['mother', "Mother's CAS", '5 funds']].map(([k, n, f], i) => (
        <g key={k} transform={`translate(830 ${74 + i * 104})`}><g className="st-row" style={T(1.2 + i * 0.6)}>
          <rect width="230" height="80" rx="18" fill="#fff" stroke={C.line} strokeWidth="1.5" />
          <g transform="translate(38 40)"><Bust k={k} r={22} /></g>
          <Tx x={72} y={34} s={13} c={C.navy}>{n}</Tx>
          <rect x="72" y="46" width="120" height="6" rx="3" fill={C.mist} />
          <rect className="st-grow" style={T(1.4 + i * 0.6)} x="72" y="46" width="120" height="6" rx="3" fill={C.sky} />
          <g className="st-pop" style={T(2.4 + i * 0.6)}><Tx x={72} y={68} s={10.5} w={700} c={C.emerald}>✓ imported · {f}</Tx></g>
          <g transform="translate(208 40)"><g className="st-tick" style={T(2.4 + i * 0.6)}><circle r="9" fill={C.emerald} /><path d="M-4 0 L-1 3 L4.5 -3" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></g></g>
        </g></g>
      ))}
    </svg>
  )
}

/* 4 · alerts: a fund falls 5% / 10% below its peak (all-time high), and a rebalance alert — facts by colour, no buy/sell calls */
G.bell = <path d="M-8 5 V-2 A8 8 0 0 1 8 -2 V5 L11 8 H-11 Z M-3.2 10 A3.2 3.2 0 0 0 3.2 10 Z" fill="currentColor" />
function SceneAlerts() {
  const y = (pct) => 96 + pct * 12          // 0% below the high at y 96, every 1% lower = 12px
  const line = 'M70 300 C120 280 150 240 196 200 S270 104 320 96 S400 132 444 156 S520 172 556 210 S612 236 640 240'
  const area = `${line} V330 H70 Z`
  // how far below its peak, by colour: amber 5–10%, rose 10%+; violet for a rebalance
  const NOTE = [['Small cap fund', '12%', 'below its peak', '#e11d48', 4.3, 'down'],
    ['Flexi cap fund', '6%', 'below its peak', '#d97706', 5.0, 'down'],
    ['Equity vs. your target', '8%', 'above target · rebalance', C.violet, 5.7, 'up']]
  return (
    <svg viewBox={VB} className="st-svg" aria-label="The app watches each fund's peak (all-time high) and alerts you on your phone when it falls 5% or 10% below it">
      <defs><linearGradient id="st-area" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={C.navy} stopOpacity=".14" /><stop offset="1" stopColor={C.navy} stopOpacity="0" /></linearGradient></defs>
      <rect x="44" y="12" width="680" height="380" rx="22" fill="#fff" stroke={C.line} strokeWidth="1.5" className="st-rise" style={T(0)} />
      <rect x="70" y={y(5)} width="590" height={y(10) - y(5)} fill="#fef3c7" opacity=".55" />
      <rect x="70" y={y(10)} width="590" height={330 - y(10)} fill="#ffe4e6" opacity=".5" />
      {['Oct 24', 'Apr 25', 'Oct 25', 'Apr 26', 'Oct 26'].map((m, k) => <Tx key={m} x={70 + k * 142.5} y={372} s={10} w={600} c="#94a3b8" a={k === 0 ? 'start' : k === 4 ? 'end' : 'middle'}>{m}</Tx>)}
      <g transform="translate(86 46)"><circle r="16" fill={`color-mix(in srgb, ${C.rose} 14%, #fff)`} /><g transform="scale(.6)" style={{ color: C.rose }}>{G.chart}</g></g>
      {/* the fund and its all-time high */}
      <Tx x={112} y={42} s={14} w={800} c={C.navy}>A fund you hold</Tx>
      <Tx x={112} y={59} s={11} w={600} c={C.slate}>NAV, last 2 years</Tx>
      <line x1="70" x2="650" y1={y(0)} y2={y(0)} stroke={C.navy} strokeOpacity=".5" strokeWidth="1.5" strokeDasharray="6 6" />
      <line x1="70" x2="650" y1={y(5)} y2={y(5)} stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="3 6" />
      <line x1="70" x2="650" y1={y(10)} y2={y(10)} stroke="#e11d48" strokeOpacity=".7" strokeWidth="1.5" strokeDasharray="3 6" />
      <Tx x={656} y={y(0) + 4} s={10.5} w={800} c={C.navy}>Peak</Tx>
      <Tx x={656} y={y(5) + 4} s={10.5} w={800} c="#d97706">−5%</Tx>
      <Tx x={656} y={y(10) + 4} s={10.5} w={800} c="#e11d48">−10%</Tx>
      <path d={area} fill="url(#st-area)" className="st-pop" style={T(1.8)} />
      <path className="st-line2" style={T(0.4)} d={line} fill="none" stroke={C.navy} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* the crown at the top */}
      <g transform={`translate(320 ${y(0)})`}><g className="st-pop" style={T(1.3)}>
        <circle r="7" fill="#fff" stroke={C.navy} strokeWidth="3" />
        <path d="M-12 -18 L-12 -30 L-6 -24 L0 -32 L6 -24 L12 -30 L12 -18 Z" fill="#f59e0b" />
        <Tx y={-40} s={11} w={800} c={C.navy} a="middle">Peak ₹52.10</Tx>
      </g></g>
      {/* today's price walks down the line; each line it crosses sends an alert */}
      <g className="st-walk" style={{ offsetPath: `path('${line}')`, animationDelay: '.6s' }}>
        <circle className="st-halo" r="14" fill={C.rose} opacity=".25" /><circle r="7" fill={C.rose} stroke="#fff" strokeWidth="2.5" />
      </g>
      {[[412, y(5), '5% below peak', '#d97706', 3.3], [556, y(10), '10% below peak', '#e11d48', 4.1]].map(([x, yy, l, c, t]) => (
        <g key={l} transform={`translate(${x + 96} ${yy - 30})`}><g className="st-pop" style={T(t)}>
          <rect x={-(l.length * 3.2) - 24} y="-14" width={l.length * 6.4 + 48} height="26" rx="13" fill={c} />
          <g transform={`translate(${-(l.length * 3.2) - 10} -1) scale(.55)`} style={{ color: '#fff' }}>{G.bell}</g>
          <Tx x={6} y={4} s={11} w={800} c="#fff" a="middle">{l}</Tx>
        </g></g>
      ))}
      {/* …and lands on your phone */}
      <Flow d="M728 220 H776" c={C.rose} t={4.1} />
      <g transform="translate(784 18)"><g className="st-rise" style={T(0.2)}>
        <rect width="236" height="388" rx="36" fill={C.navy} />
        <rect x="9" y="9" width="218" height="370" rx="28" fill="#f8fafc" />
        <rect x="88" y="18" width="60" height="16" rx="8" fill={C.navy} />
        <Tx x={28} y={30} s={10.5} w={800} c={C.navy}>9:41</Tx>
        <Tx x={118} y={70} s={30} w={300} c={C.navy} a="middle">9:41</Tx>
        <Tx x={118} y={88} s={10} w={600} c={C.slate} a="middle">Monday, 13 October</Tx>
        {NOTE.map(([n, pct, sub, c, t, dir], i) => (
          <g key={n} transform={`translate(20 ${108 + i * 84})`}><g className="st-drop" style={T(t)}>
            <rect width="196" height="74" rx="16" fill="#fff" stroke={C.line} />
            <rect x="0" y="14" width="4" height="46" rx="2" fill={c} />
            <Tx x={16} y={22} s={8.5} w={700} c="#94a3b8" letterSpacing=".05em">CAPITAL FRIENDS</Tx>
            <Tx x={182} y={22} s={8.5} w={600} c="#94a3b8" a="end">now</Tx>
            <Tx x={16} y={40} s={11.5} w={700} c={C.navy}>{n}</Tx>
            <g transform="translate(16 60)">
              <path d={dir === 'down' ? 'M0 -8 L9 -8 L4.5 -1 Z' : 'M0 -1 L9 -1 L4.5 -8 Z'} fill={c} />
              <Tx x={14} s={11.5} w={800} c={c}>{pct}<tspan dx="4" fontSize="10" fontWeight="500" fill={C.slate}>{sub}</tspan></Tx>
            </g>
          </g></g>
        ))}
      </g></g>
    </svg>
  )
}

/* 5 · goals on one road: the car drives goal to goal. Near each goal its bucket moves from equity (violet)
   to safe money (teal) — the glide path — and the goal is marked reached; at retirement the three buckets take over. */
const GLIDE_EDU = [['2031', 0.8], ['2032', 0.6], ['2033', 0.34], ['2034', 0.1]]
const BUCKET = 'M0 0 h64 v92 q0 12 -12 12 h-40 q-12 0 -12 -12 Z'
// when the car is driving to each goal (seconds from the start of the scene)
const LEG = { edu: [1.0, 3.6], retire: [5.4, 3.0] }

function GlideBucket({ x, y, id, title, label, icon, c, years, at: [t0, len] }) {
  const step = len / years.length
  return (
    <g transform={`translate(${x} ${y})`}><g className="st-rise" style={T(0.6)}>
      <Tx x={0} y={0} s={10.5} w={800} c={c} letterSpacing=".06em">{title}</Tx>
      <g transform="translate(0 30)">
        <clipPath id={`st-gb-${id}`}><path d={BUCKET} /></clipPath>
        <g clipPath={`url(#st-gb-${id})`}>
          <rect width="64" height="104" fill={C.violet} opacity=".85" />
          <g className="st-safe" style={{ animationDelay: `${t0}s`, animationDuration: `${len}s` }}><g className="st-wave"><path d="M-64 6 Q-48 0 -32 6 T0 6 T32 6 T64 6 T96 6 T128 6 V300 H-64 Z" fill={C.teal} opacity=".9" /></g></g>
        </g>
        <path d={BUCKET} fill="none" stroke="#94a3b8" strokeWidth="2.5" />
        <g transform="translate(32 -14)"><circle r="12" fill="#fff" stroke={c} strokeWidth="2" /><g transform="scale(.44)" style={{ color: c }}>{G[icon]}</g></g>
        {label && <Tx x={32} y={122} s={11} c={C.ink} a="middle">{label}</Tx>}
      </g>
      <g transform="translate(80 66)">
        {years.map(([yr, e], n) => (
          <g key={yr} className={n === years.length - 1 ? 'st-yr last' : 'st-yr'} style={{ animationDelay: `${t0 + n * step}s`, animationDuration: `${step}s` }}>
            <Tx s={18} w={800} c={C.navy}>{yr}</Tx>
            <g transform="translate(0 20)"><circle cx="4" cy="-4" r="4" fill={C.violet} /><Tx x={13} s={11} c={C.slate}>Equity <tspan fill={C.navy} fontWeight="800">{Math.round(e * 100)}%</tspan></Tx></g>
            <g transform="translate(0 37)"><circle cx="4" cy="-4" r="4" fill={C.teal} /><Tx x={13} s={11} c={C.slate}>Safe <tspan fill={C.navy} fontWeight="800">{Math.round((1 - e) * 100)}%</tspan></Tx></g>
          </g>
        ))}
      </g>
    </g></g>
  )
}
function Reached({ x, y, fx, fy, text, c, t }) {
  return (
    <g>
      <g transform={`translate(${x} ${y})`}><g className="st-pop" style={T(t)}>
        <rect x={-(text.length * 3.4) - 26} y="-15" width={text.length * 6.8 + 52} height="30" rx="15" fill={c} />
        <g transform={`translate(${-(text.length * 3.4) - 8} 0)`}><circle r="8" fill="#fff" /><path d="M-3.5 0 L-1 2.6 L3.8 -2.6" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></g>
        <Tx x={9} y={4.5} s={12} w={800} c="#fff" a="middle">{text}</Tx>
      </g></g>
      {[[-26, -30, C.amber], [24, -34, C.violet], [36, -6, C.rose], [-36, -4, C.sky], [0, -44, C.emerald]].map(([dx, dy, cc], n) => (
        <circle key={n} className="st-confetti" style={{ ...T(t - 0.1 + n * 0.06), '--dx': `${dx}px`, '--dy': `${dy}px` }} cx={fx} cy={fy} r="4" fill={cc} />
      ))}
    </g>
  )
}

function SceneGoals() {
  const road = 'M40 250 C200 250 260 170 420 170 S700 120 860 120 S1040 96 1070 92'
  const stops = [[380, 172, 'target', '2034', "Kids' education", C.violet], [880, 120, 'gold', '2045', 'Retirement', C.amber]]
  const rt = LEG.retire[0] + LEG.retire[1] + 0.2
  return (
    <svg viewBox={VB} className="st-svg" aria-label="The family car drives to each goal; near the kids' education goal the money moves from equity to safe funds, and at retirement three buckets take over">
      <path d={road} fill="none" stroke="#cbd5e1" strokeWidth="28" strokeLinecap="round" />
      <path d={road} fill="none" stroke="#fff" strokeWidth="3" strokeDasharray="12 12" className="la-dash" />
      <g transform="translate(70 290)"><g className="st-pop" style={T(0.2)}>
        <rect x="-30" y="-14" width="96" height="28" rx="14" fill="#fff" stroke={C.line} />
        <Tx x={18} y={5} s={11.5} w={800} c={C.navy} a="middle">Today · 2026</Tx>
      </g></g>
      {stops.map(([x, y, g, yr, l, c], i) => (
        <g key={l} transform={`translate(${x} ${y})`}><g className="st-pop" style={T(0.3 + i * 0.3)}>
          <path d="M0 0 V-46" stroke={C.slate} strokeWidth="2.5" />
          <path d="M0 -46 L30 -38 L0 -30 Z" fill={c} />
          <circle cx="0" cy="-70" r="18" fill="#fff" stroke={c} strokeWidth="2.5" />
          <g transform="translate(0 -70) scale(.72)" style={{ color: c }}>{G[g]}</g>
          <Tx x={28} y={-74} s={13} w={800} c={C.navy}>{yr}</Tx>
          <Tx x={28} y={-59} s={11} c={C.slate}>{l}</Tx>
        </g></g>
      ))}
      <g className="st-car3" style={{ offsetPath: `path('${road}')` }}>
        <g transform="translate(-22 -18)"><rect x="0" y="6" width="44" height="16" rx="6" fill={C.rose} /><path d="M8 7 L14 -2 H30 L36 7 Z" fill="#fecdd3" /><circle cx="11" cy="23" r="5" fill={C.navy} /><circle cx="33" cy="23" r="5" fill={C.navy} /></g>
      </g>

      {/* Kids' education 2034: its bucket, under the road, moves from equity to safe money as the car gets there */}
      <path className="la-dash" d="M380 196 Q380 222 356 236" fill="none" stroke={C.violet} strokeWidth="2.5" strokeDasharray="4 6" strokeLinecap="round" />
      <GlideBucket x={300} y={248} id="edu" title="KIDS' EDUCATION · MOVES TO SAFE" label="" icon="target" c={C.violet} years={GLIDE_EDU} at={LEG.edu} />
      <Reached x={400} y={40} fx={380} fy={102} text="Education goal reached" c={C.violet} t={LEG.edu[0] + LEG.edu[1] + 0.1} />

      {/* Retirement 2045: once there, three buckets take over */}
      <g className="st-pop" style={T(rt)}><path className="la-dash" d="M880 146 Q880 180 850 204" fill="none" stroke={C.amber} strokeWidth="2.5" strokeDasharray="4 6" strokeLinecap="round" /></g>
      <Reached x={770} y={52} fx={880} fy={50} text="Retired" c={C.amber} t={rt} />
      <g transform="translate(720 222)"><g className="st-rise" style={T(rt + 0.2)}>
        <Tx x={0} y={0} s={11} w={800} c="#b45309" letterSpacing=".06em">RETIREMENT · THREE BUCKETS</Tx>
        {[['Income', C.sky, 46, 'spend now'], ['Stability', C.teal, 58, '3–7 yrs'], ['Growth', C.violet, 70, '7+ yrs']].map(([l, c, h, sub], i) => (
          <g key={l} transform={`translate(${i * 96} 16)`}>
            <clipPath id={`st-b-${l}`}><path d={BUCKET} /></clipPath>
            <g clipPath={`url(#st-b-${l})`}><rect width="64" height="104" fill="#f8fafc" /><g className="la-fill st-quick" style={T(rt + 0.5 + i * 0.25)}><rect y={104 - h} width="64" height={h} fill={c} opacity=".85" /></g></g>
            <path d={BUCKET} fill="none" stroke="#94a3b8" strokeWidth="2.5" />
            <Tx x={32} y={124} s={11.5} c={C.ink} a="middle">{l}</Tx>
            <Tx x={32} y={139} s={10} w={600} c={C.slate} a="middle">{sub}</Tx>
            {i > 0 && <path className="la-dash" d="M-6 34 Q-18 20 -28 34" fill="none" stroke={c} strokeWidth="3" strokeDasharray="4 5" strokeLinecap="round" />}
          </g>
        ))}
      </g></g>
    </svg>
  )
}

/* 6 · you → the summary email → each family member */
function SceneFamily() {
  const people = [['spouse', 820, 80, 'Spouse'], ['mother', 940, 170, 'Mother'], ['father', 940, 290, 'Father'], ['son', 820, 370, 'Son']]
  const from = [610, 220]
  return (
    <svg viewBox={VB} className="st-svg" aria-label="A summary email from you flying to each family member">
      <g transform="translate(150 210)"><g className="st-pop" style={T(0.1)}>
        <circle r="58" fill="#fff" stroke={C.line} strokeWidth="1.5" /><Bust k="you" r={52} />
        <Tx y={84} s={13} c={C.slate} a="middle">You</Tx>
      </g></g>
      <Flow d="M216 210 H330" c={C.emerald} t={0.5} />
      <g transform="translate(345 120)">
        <rect x="0" y="40" width="260" height="160" rx="8" fill="#bbf7d0" />
        <path className="st-flap" d="M0 40 L130 130 L260 40 Z" fill="#6ee7b7" />
        <g className="st-letter"><rect x="16" y="-90" width="228" height="200" rx="10" fill="#fff" stroke={C.line} strokeWidth="1.5" />
          <Tx x={34} y={-62} s={11} w={800} c={C.emerald}>FAMILY SUMMARY · OCTOBER</Tx>
          {[['Net worth', '₹1.17 Cr'], ['Mutual funds', '12 funds'], ['Insurance', '3 policies'], ['Nominees', 'all set ✓'], ['Goals', '4 on track']].map(([a, b], i) => (
            <g key={a} transform={`translate(34 ${-38 + i * 26})`}><Tx s={11.5} w={600} c={C.slate}>{a}</Tx><Tx x={192} s={11.5} w={800} c={C.navy} a="end">{b}</Tx></g>
          ))}
        </g>
        <path d="M0 40 L130 122 L260 40 V200 H0 Z" fill="#d1fae5" />
        <path d="M0 200 L130 112 L260 200 Z" fill="#a7f3d0" />
      </g>
      <g transform="translate(475 382)"><g className="st-pop" style={T(3.4)}>
        <rect x="-196" y="-20" width="392" height="40" rx="20" fill="#ecfdf5" stroke="#a7f3d0" />
        <g transform="translate(-172 0)"><circle r="12" fill={C.emerald} /><g transform="scale(.46)" style={{ color: '#fff' }}>{G.shield}</g></g>
        <Tx x={12} y={5} s={13} w={700} c="#065f46" a="middle">If something happens to you, your family knows</Tx>
      </g></g>
      {people.map(([k, x, y, l], i) => {
        const d = `M${from[0]} ${from[1]} Q${(from[0] + x) / 2} ${y} ${x - 46} ${y}`
        return (
          <g key={k}>
            <path className="la-dash" d={d} fill="none" stroke={C.line} strokeWidth="2.5" strokeDasharray="5 7" />
            <g className="st-env" style={{ animationDelay: `${1.4 + i * 0.45}s`, offsetPath: `path('${d}')` }}><rect x="-12" y="-8" width="24" height="16" rx="3" fill={C.emerald} /><path d="M-11 -7 L0 1 L11 -7" fill="none" stroke="#fff" strokeWidth="2" /></g>
            <g transform={`translate(${x} ${y})`}><g className="st-pop" style={T(0.4 + i * 0.2)}>
              <circle r="38" fill="#fff" stroke={C.line} strokeWidth="1.5" /><Bust k={k} r={34} />
              <g transform="translate(28 -26)"><g className="st-tick" style={T(2.2 + i * 0.45)}><circle r="11" fill={C.emerald} stroke="#fff" strokeWidth="2.5" /><g transform="scale(.55)" style={{ color: '#fff' }}>{G.check}</g></g></g>
              <Tx x={52} y={5} s={13} c={C.ink}>{l}</Tx>
            </g></g>
          </g>
        )
      })}
    </svg>
  )
}

const SCENES = { drive: SceneDrive, all: SceneAll, cas: SceneCas, ath: SceneAlerts, goals: SceneGoals, family: SceneFamily }

export default function StoryHero({ signIn, isMobile, GoogleIcon, families, videoUrl }) {
  const [i, setI] = useState(0)
  // the scenes play on by themselves; they only wait while the browser tab is hidden
  const [paused, setPaused] = useState(false)
  useEffect(() => {
    const f = () => setPaused(document.hidden)
    document.addEventListener('visibilitychange', f)
    return () => document.removeEventListener('visibilitychange', f)
  }, [])
  useEffect(() => {
    if (paused) return
    const t = setTimeout(() => setI((x) => (x + 1) % CHAPTERS.length), CHAPTERS[i].dur || DUR)
    return () => clearTimeout(t)
  }, [i, paused])
  const ch = CHAPTERS[i]
  const Scene = SCENES[ch.k]
  // the scene leans towards the mouse (3D tilt), the floating things move the other way (depth)
  const ref = useRef(null)
  const onMove = (e) => {
    const el = ref.current; if (!el || isMobile) return
    const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5
    el.style.setProperty('--rx', `${(-y * 6).toFixed(2)}deg`); el.style.setProperty('--ry', `${(x * 8).toFixed(2)}deg`)
    el.style.setProperty('--px', `${(-x * 18).toFixed(1)}px`); el.style.setProperty('--py', `${(-y * 14).toFixed(1)}px`)
  }
  return (
    <section ref={ref} onMouseMove={onMove} className={`st ${isMobile ? 'm' : ''}`} style={{ '--c': ch.c }}>
      <style>{ART_CSS + CSS}</style>
      {/* the whole hero is the stage: a soft glow in the scene's colour and floating things everywhere */}
      <div className="st-glow" aria-hidden="true" />
      <h1 className="st-h"><span className="st-h1a">Your family's money,</span> <span className="st-rot"><span key={ch.k} style={{ '--c': ch.c }}>{ch.ph}</span></span></h1>
      <div className="st-mid">
      {/* how it works, as a path: Your Drive → Track → Import → Goals → Family */}
        <ol className="st-path" role="tablist">
          {CHAPTERS.map((c, k) => (
            <li key={c.k} className={k === i ? 'on' : k < i ? 'done' : ''} style={{ '--cc': c.c }}>
              <button type="button" role="tab" aria-selected={k === i} aria-label={c.t} onClick={() => setI(k)}>
                <span className="st-dot"><Glyph name={c.icon} color={k <= i ? '#fff' : '#94a3b8'} size={13} /></span>
                <span className="st-lb">{c.s}</span>
              </button>
              {k < CHAPTERS.length - 1 && <span className="st-ln"><i style={k === i ? { animationDuration: `${c.dur || DUR}ms`, animationPlayState: paused ? 'paused' : 'running' } : undefined} /></span>}
            </li>
          ))}
        </ol>
        {/* the scene, edge to edge */}
        <div className="st-r">
          <div key={ch.k} className="st-scene" style={{ '--pd': `${ch.dur || DUR}ms` }}><Scene /></div>
        </div>
      </div>
      {/* one dock at the bottom: start, watch, and how many families */}
      <div className="st-dock">
        <button onClick={signIn} className="st-btn"><span className="st-g">{GoogleIcon}</span>Sign in with Google<span className="st-free">FREE</span></button>
        {videoUrl && <a className="st-btn2" href={videoUrl} target="_blank" rel="noopener noreferrer" aria-label="Watch the 2-minute tour"><span className="st-play" aria-hidden="true"><svg width="12" height="12" viewBox="0 0 12 12"><path d="M3 1.8 L10 6 L3 10.2 Z" fill="currentColor" /></svg></span><span className="st-btn2t">Watch 2-min tour</span></a>}
      </div>
      {/* Google sign-in verification needs these on the home page */}
      <nav className="st-legal" aria-label="Legal"><a href="https://capitalfriends.in/privacy">Privacy Policy</a><a href="https://capitalfriends.in/terms">Terms &amp; Conditions</a></nav>
    </section>
  )
}

const CSS = `
.st{position:relative;overflow:hidden;background:linear-gradient(180deg,#f6f8fc 0%,#ffffff 70%);height:calc(100vh - 60px);min-height:600px;max-height:940px;display:flex;flex-direction:column}
.st-legal{position:absolute;z-index:4;right:32px;bottom:22px;display:flex;gap:16px}
.st-legal a{font-family:Inter,system-ui,sans-serif;font-size:12px;font-weight:500;color:#94a3b8;text-decoration:none}.st-legal a:hover{color:#0b1120;text-decoration:underline}
.st-glow{position:absolute;left:10%;top:6%;width:80%;height:80%;border-radius:50%;background:radial-gradient(closest-side,color-mix(in srgb,var(--c) 16%,transparent),transparent 72%);transition:background .8s ease;pointer-events:none}

.st-mid{position:relative;z-index:2;flex:1;min-height:0;width:100%;max-width:1440px;margin:0 auto;display:flex;align-items:stretch}
.st-r{position:relative;z-index:2;flex:1;min-height:0;min-width:0;padding:0 24px 0 8px;box-sizing:border-box;perspective:1400px}
.st:not(.m) .st-path{flex-direction:column;align-items:flex-start;justify-content:center;width:auto;max-width:none;margin:0;padding:0 0 0 32px}
.st:not(.m) .st-path li{flex:0 0 auto;flex-direction:column;align-items:flex-start}
.st:not(.m) .st-ln{flex:0 0 auto;width:2px;height:30px;margin:4px 0 4px 19px}
.st:not(.m) .st-ln i{transform:scaleY(0);transform-origin:top}
.st:not(.m) .st-path li.done .st-ln i{transform:none}
.st:not(.m) .st-path li.on .st-ln i{animation-name:stBarY}
@keyframes stBarY{from{transform:scaleY(0)}to{transform:scaleY(1)}}
.st:not(.m) .st-path button{padding:3px;border-radius:999px;transition:background .2s}
.st:not(.m) .st-path li.on button{background:#fff;box-shadow:0 8px 20px -12px rgba(15,23,42,.4);padding-right:14px}
.st-h{position:relative;z-index:3;margin:0;padding:26px 24px 0;text-align:center;font-family:Inter,system-ui,sans-serif;font-weight:700;letter-spacing:-.025em;line-height:1.2;color:#0b1120;font-size:clamp(22px,2.1vw,32px)}
.st-h1a{display:inline}
.st-rot{display:inline-block;position:relative;overflow:hidden;vertical-align:top;line-height:inherit}.st-rot>span{vertical-align:top}
.st-rot>span{display:inline-block;animation:stWord .6s cubic-bezier(.2,.8,.2,1) both;color:var(--c)}
@keyframes stWord{from{transform:translateY(60%);opacity:0;filter:blur(4px)}to{transform:none;opacity:1;filter:none}}
.st-dock{position:relative;z-index:3;align-self:center;margin:0 0 24px;display:flex;align-items:center;gap:6px;padding:6px;border-radius:999px;background:rgba(255,255,255,.78);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);box-shadow:0 0 0 1px rgba(15,23,42,.06),0 18px 40px -20px rgba(15,23,42,.35)}
.st-btn{display:inline-flex;align-items:center;gap:10px;height:48px;padding:0 6px 0 6px;border-radius:999px;border:0;cursor:pointer;color:#fff;background:#0b1120;font-family:Inter,system-ui,sans-serif;font-weight:600;font-size:15px;box-shadow:0 10px 24px -12px rgba(11,17,32,.6);transition:transform .18s,box-shadow .18s,background .18s}
.st-free{margin-left:4px;padding:4px 9px;border-radius:999px;background:#10b981;color:#fff;font-size:11px;font-weight:800;letter-spacing:.08em;box-shadow:0 0 0 3px rgba(16,185,129,.22);animation:stFree 2.6s ease-in-out infinite}
@keyframes stFree{0%,100%{box-shadow:0 0 0 3px rgba(16,185,129,.22)}50%{box-shadow:0 0 0 6px rgba(16,185,129,.1)}}
.st-btn:hover{transform:translateY(-1px);background:#1e293b;box-shadow:0 14px 28px -12px rgba(11,17,32,.6)}
.st-g{width:36px;height:36px;border-radius:50%;background:#fff;display:inline-flex;align-items:center;justify-content:center}
.st-btn2{display:inline-flex;align-items:center;gap:10px;height:48px;padding:0 18px 0 6px;border-radius:999px;color:#0b1120;font-weight:700;font-size:14.5px;text-decoration:none;background:#fff;box-shadow:inset 0 0 0 1.5px #e2e8f0;transition:box-shadow .2s}
.st-btn2:hover{box-shadow:inset 0 0 0 1.5px var(--c)}
.st-play{width:36px;height:36px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;background:var(--c);color:#fff;padding-left:2px;box-sizing:border-box;transition:background .6s,transform .18s}
.st-btn2:hover .st-play{transform:scale(1.08)}
.st-fam{display:flex;padding:0 16px 0 14px;border-left:1px solid #e2e8f0;height:26px;align-items:center;gap:8px;font-size:14px;font-weight:500;color:#64748b}.st-fam b{color:#0b1120;font-weight:700}
.st-avs{display:flex}
.st-avs img{width:40px;height:40px;border-radius:50%;object-fit:cover;object-position:top;background:#fff;border:3px solid #fff;margin-left:-12px;box-shadow:0 4px 10px -4px rgba(15,23,42,.3);animation:laPop .5s cubic-bezier(.3,1.6,.5,1) both}
.st-avs img:first-child{margin-left:0}
.st-famt{display:flex;flex-direction:column;line-height:1.1;font-size:14px;color:#475569;font-weight:600}.st-famt b{font-size:22px;font-weight:800;color:#0b1120;letter-spacing:-.02em;margin-right:4px}
.st-famt{flex-direction:row;align-items:baseline;flex-wrap:wrap;column-gap:2px}.st-famt small{display:flex;align-items:center;gap:5px;width:100%;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#10b981;margin-top:3px}
.st-live{width:7px;height:7px;border-radius:50%;background:#10b981;animation:cfLiveDot 1.6s infinite}
@keyframes cfLiveDot{0%{box-shadow:0 0 0 0 rgba(16,185,129,.6)}70%{box-shadow:0 0 0 7px rgba(16,185,129,0)}100%{box-shadow:0 0 0 0 rgba(16,185,129,0)}}
.st-scene{position:absolute;inset:0;animation:stIn .6s cubic-bezier(.2,.8,.2,1) both;transform:rotateX(var(--rx,0deg)) rotateY(var(--ry,0deg));transform-style:preserve-3d;transition:transform .25s ease-out;filter:drop-shadow(0 30px 40px rgba(15,23,42,.12))}
.st-svg{width:100%;height:100%}
.st-amb{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.st-am{position:absolute;transform:translate(-50%,-50%) scale(var(--s));animation:stDrift ease-in-out infinite both;filter:drop-shadow(0 8px 14px rgba(15,23,42,.12))}
.st-am svg{display:block;animation:stAmIn .7s cubic-bezier(.3,1.5,.5,1) both}
.st-spark{position:absolute;width:6px;height:6px;border-radius:50%;opacity:0;animation:stTw 2.8s ease-in-out infinite}
@keyframes stDrift{0%,100%{transform:translate(-50%,-50%) scale(var(--s)) rotate(-4deg)}50%{transform:translate(-50%,calc(-50% - 14px)) scale(var(--s)) rotate(4deg)}}
@keyframes stAmIn{from{transform:scale(0);opacity:0}to{transform:none;opacity:1}}
@keyframes stTw{0%,100%{opacity:0;transform:scale(.4)}50%{opacity:.7;transform:scale(1)}}
.st.m .st-am{display:none}

.st-amb{z-index:1;transform:translate(var(--px,0),var(--py,0));transition:transform .3s ease-out}
/* soft moving mesh behind everything */
.st::before{content:'';position:absolute;inset:-20%;background:radial-gradient(30% 40% at 20% 30%,rgba(124,58,237,.10),transparent 70%),radial-gradient(30% 40% at 80% 70%,rgba(13,148,136,.10),transparent 70%),radial-gradient(25% 30% at 60% 20%,rgba(14,165,233,.08),transparent 70%);animation:stMesh 22s ease-in-out infinite alternate;pointer-events:none}
@keyframes stMesh{0%{transform:translate(0,0) rotate(0)}100%{transform:translate(3%,-2%) rotate(8deg)}}
.st-path{position:relative;z-index:3;list-style:none;margin:0 auto;padding:14px 32px 0;display:flex;align-items:center;justify-content:center;gap:0;width:100%;max-width:980px;box-sizing:border-box}
.st-path li{display:flex;align-items:center;flex:1}.st-path li:last-child{flex:0 0 auto}
.st-path button{display:flex;align-items:center;gap:9px;background:none;border:0;padding:4px;cursor:pointer}
.st-dot{width:34px;height:34px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;background:#fff;border:2px solid #e2e8f0;transition:background .3s,border-color .3s,transform .3s,box-shadow .3s}
.st-path li.done .st-dot{background:var(--cc);border-color:var(--cc)}
.st-path li.on .st-dot{background:var(--cc);border-color:var(--cc);transform:scale(1.12);box-shadow:0 0 0 6px color-mix(in srgb,var(--cc) 18%,transparent)}
.st-lb{font-size:13.5px;font-weight:600;color:#94a3b8;white-space:nowrap;transition:color .3s}
.st-path li.on .st-lb,.st-path li.done .st-lb{color:#0b1120}
.st-ln{flex:1;height:2px;margin:0 12px;border-radius:2px;background:#e2e8f0;overflow:hidden}
.st-ln i{display:block;height:100%;width:100%;background:var(--cc);transform:scaleX(0);transform-origin:left}
.st-path li.done .st-ln i{transform:none}
.st-path li.on .st-ln i{animation:stBar linear both}
.st-flow{offset-rotate:0deg;animation:stFlow 2.4s ease-in infinite;opacity:0}
.st-pop{transform-box:fill-box;transform-origin:center;animation:laPop .6s cubic-bezier(.3,1.6,.5,1) both}
.st-rise{animation:laRise .8s cubic-bezier(.2,.8,.2,1) both}
.st-row{animation:stRow .55s cubic-bezier(.2,.8,.2,1) both}
.st-scan{animation:stScan 2s ease-in-out infinite}
.st-car{offset-rotate:auto;animation:stCar 6.5s cubic-bezier(.45,0,.55,1) both .2s}
.st-flap{transform-box:fill-box;transform-origin:top;animation:stFlap .7s ease-in both .5s}
.st-letter{animation:stLetter .9s cubic-bezier(.2,.8,.2,1) both 1s}
.st-env{offset-rotate:0deg;animation:stEnv 1.1s ease-in-out both}
/* drive scene */
.st-press{transform-box:fill-box;transform-origin:center;animation:stPress .35s ease both}
.st-cursor{offset-rotate:0deg;animation:stCursor 1.4s cubic-bezier(.4,0,.2,1) both .1s}
.st-draw{stroke-dashoffset:40;animation:stDraw .5s ease-out both}
.st-newfile{transform-box:fill-box;transform-origin:center;animation:stNew .8s cubic-bezier(.3,1.5,.5,1) both}
.st-spin{transform-box:fill-box;transform-origin:center;animation:stSpin 2.4s linear infinite}
.st-halo{transform-box:fill-box;transform-origin:center;animation:stHalo 2.4s ease-out infinite 6.2s}
@keyframes stHalo{0%{transform:scale(.8);opacity:.25}100%{transform:scale(1.6);opacity:0}}
.st-grow{transform-box:fill-box;transform-origin:left;animation:stGrowX 1.1s cubic-bezier(.2,.8,.2,1) both}
@keyframes stGrowX{from{transform:scaleX(0)}to{transform:none}}
.st-col{transform-box:fill-box;transform-origin:bottom;animation:stGrowY .8s cubic-bezier(.2,.8,.2,1) both}
@keyframes stGrowY{from{transform:scaleY(0);opacity:0}to{transform:none;opacity:1}}
.st-line{stroke-dasharray:240;stroke-dashoffset:240;animation:stLine 1.6s ease-out forwards}
@keyframes stLine{to{stroke-dashoffset:0}}
.st-safe{animation:stSafe 4.5s cubic-bezier(.45,0,.4,1) both 1s}
@keyframes stSafe{0%{transform:translateY(83px)}33%{transform:translateY(64px)}66%{transform:translateY(37px)}100%{transform:translateY(10px)}}
.st-wave{animation:stWave 2.2s linear infinite}
@keyframes stWave{from{transform:translateX(0)}to{transform:translateX(64px)}}
.st-yr{opacity:0;animation:stYr 1.5s ease both}.st-yr.last{animation-name:stYrLast}
@keyframes stYr{0%{opacity:0;transform:translateY(8px)}15%,85%{opacity:1;transform:none}100%{opacity:0;transform:translateY(-8px)}}
@keyframes stYrLast{0%{opacity:0;transform:translateY(8px)}15%,100%{opacity:1;transform:none}}
.st-wedge{transform-box:view-box;transform-origin:0 0;animation:stWedge .6s cubic-bezier(.3,1.4,.5,1) both}
@keyframes stWedge{from{transform:scale(0) rotate(-40deg);opacity:0}to{transform:none;opacity:1}}
.st-line2{stroke-dasharray:1200;stroke-dashoffset:1200;animation:stLine2 2.2s ease-out forwards}
@keyframes stLine2{to{stroke-dashoffset:0}}
.st-notif{animation:stNotif .6s cubic-bezier(.2,.8,.2,1) both}
@keyframes stNotif{from{transform:translateX(40px);opacity:0}to{transform:none;opacity:1}}
.st-ring{transform-box:fill-box;transform-origin:50% 0;animation:stRingB 1s ease-in-out 3.2s 2}
@keyframes stRingB{0%,100%{transform:rotate(0)}20%{transform:rotate(16deg)}40%{transform:rotate(-14deg)}60%{transform:rotate(9deg)}80%{transform:rotate(-5deg)}}
.st-walk{offset-rotate:0deg;animation:stWalk 4.4s cubic-bezier(.4,0,.6,1) both}
@keyframes stWalk{from{offset-distance:0%;opacity:0}6%{opacity:1}to{offset-distance:100%;opacity:1}}
.st-drop{animation:stDrop .55s cubic-bezier(.2,.9,.3,1.2) both}
@keyframes stDrop{from{transform:translateY(-22px);opacity:0}to{transform:none;opacity:1}}
.st-car2{offset-rotate:auto;animation:stCarHome 4.5s cubic-bezier(.45,0,.4,1) both 1s}
@keyframes stCarHome{from{offset-distance:0%}to{offset-distance:26.6%}}
.st-confetti{opacity:0;animation:stConf .9s ease-out both}
@keyframes stConf{0%{opacity:0;transform:translate(0,0) scale(.4)}30%{opacity:1}100%{opacity:0;transform:translate(var(--dx),var(--dy)) scale(1)}}
.st-car3{offset-rotate:auto;animation:stCarTrip 7.4s linear both 1s}
@keyframes stCarTrip{0%{offset-distance:0%;animation-timing-function:cubic-bezier(.45,0,.4,1)}48.6%{offset-distance:33.5%}59.5%{offset-distance:33.5%;animation-timing-function:cubic-bezier(.45,0,.4,1)}100%{offset-distance:81.5%}}
.la-fill.st-quick{animation-duration:1.2s}
@keyframes stPress{0%,100%{transform:scale(1)}50%{transform:scale(.92)}}
@keyframes stCursor{from{offset-distance:0%;opacity:0}20%{opacity:1}to{offset-distance:100%;opacity:1}}
@keyframes stDraw{to{stroke-dashoffset:0}}
@keyframes stNew{0%{transform:translateY(-14px) scale(.6);opacity:0}100%{transform:none;opacity:1}}
@keyframes stSpin{to{transform:rotate(360deg)}}
.st-tick{transform-box:fill-box;transform-origin:center;animation:laPop .5s cubic-bezier(.3,1.6,.5,1) both}
@keyframes stBar{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@keyframes stIn{from{opacity:0;transform:translateY(10px) scale(.985)}to{opacity:1;transform:none}}
@keyframes stFlow{0%{offset-distance:0%;opacity:0}15%{opacity:1}85%{opacity:1}100%{offset-distance:100%;opacity:0}}
@keyframes stRow{from{opacity:0;transform:translateX(-14px)}to{opacity:1;transform:none}}
@keyframes stScan{0%,100%{transform:translateY(0)}50%{transform:translateY(130px)}}
@keyframes stCar{from{offset-distance:0%}to{offset-distance:96%}}
@keyframes stFlap{from{transform:scaleY(1)}to{transform:scaleY(-1)}}
@keyframes stLetter{from{transform:translateY(120px);opacity:0}to{transform:none;opacity:1}}
@keyframes stEnv{0%{offset-distance:0%;opacity:0}15%{opacity:1}100%{offset-distance:100%;opacity:0}}
/* phones: headline, buttons, the scene, the path */
.st.m{height:calc(100svh - 54px);min-height:600px;max-height:none}
.st.m .st-path{padding:12px 10px 0}.st.m .st-lb{display:none}.st.m .st-path li.on .st-lb{display:inline;font-size:12px}.st.m .st-ln{margin:0 4px}.st.m .st-dot{width:30px;height:30px}
/* phones: the wide scene keeps its size and the camera pans slowly across it */
.st.m .st-mid{flex-direction:column}.st.m .st-r{padding:0;display:flex;align-items:center;overflow:hidden}
.st.m .st-scene{position:relative;inset:auto;height:min(400px,100%);width:100%;transform:none}
.st.m .st-svg{height:100%;width:auto;max-width:none;animation:stPan var(--pd,7s) ease-in-out both}
@keyframes stPan{0%,12%{transform:translateX(0)}88%,100%{transform:translateX(calc(-100% + 100vw))}}
.st.m .st-h{font-size:22px;padding:16px 16px 0}.st.m .st-rot{display:block}
.st.m .st-legal{position:relative;right:auto;bottom:auto;justify-content:center;padding:0 0 14px}.st.m .st-dock{margin:0 0 10px;flex-wrap:nowrap}.st.m .st-btn{font-size:14px}.st.m .st-btn2t,.st.m .st-fam{display:none}
.st.m .st-glow{left:-30%;top:20%;width:160%;height:60%}
@media (prefers-reduced-motion:reduce){.st-flow,.st-scan,.st-car,.st-env,.st-play::after,.st-am,.st-spark{animation:none!important}.st-flow,.st-env,.st-spark{display:none}}
`
