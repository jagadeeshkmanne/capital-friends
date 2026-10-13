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
function Bust({ k, r = 28 }) {
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
  { k: 'drive', ph: 'private, in your own Drive', icon: 'lock', c: C.teal, s: 'Your Drive', t: 'Your data stays in your own Google Drive', d: 'Sign in with Google and the app makes a private sheet in your Drive. Only you — and who you share it with — can see it.' },
  { k: 'all', ph: 'all in one place', icon: 'chart', c: C.violet, s: 'Track', t: 'Everything in one place', d: 'Funds, stocks, FDs, PPF, gold, insurance and loans — for every family member.' },
  { k: 'cas', ph: 'imported in a minute', icon: 'sheet', c: C.sky, s: 'Import', t: 'Import your CAS in a minute', d: 'Drop your CAMS / CDSL statement PDF: every fund, share and transaction comes in.' },
  { k: 'goals', ph: 'planned for every goal', icon: 'target', c: C.amber, s: 'Goals', t: 'A plan for every goal', d: 'Money shared across goals, safer as dates come near, and the exact step each month.' },
  { k: 'family', ph: 'known to your family', icon: 'mail', c: C.emerald, s: 'Family', t: 'Your family is never in the dark', d: 'A regular summary email: where every rupee, policy and nominee is — even without you.' },
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
        <Tx x={58} y={34} s={12} w={800} c={C.navy}>My Drive</Tx>
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
        <rect x="14" y="12" width="56" height="7" rx="3.5" fill="#fff" opacity=".9" />
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
const RING = [['chart', C.violet, 'Mutual funds', 34], ['stocks', C.emerald, 'Stocks', 16], ['bank', C.sky, 'FD & PPF', 18], ['gold', C.amber, 'Gold', 12], ['shield', C.rose, 'Insurance', 8], ['loan', '#64748b', 'Loans', 12]]
function SceneAll() {
  const cx = 550, cy = 205, R = 150, dr = 64, circ = 2 * Math.PI * dr, gap = 4
  let acc = 0
  return (
    <svg viewBox={VB} className="st-svg" aria-label="Every family member's funds, stocks, FDs, gold, insurance and loans in one net worth that grows over the years">
      {/* members */}
      {[['you', 'You', '₹62 L'], ['spouse', 'Spouse', '₹38 L'], ['mother', 'Mother', '₹17 L']].map(([k, n, v], r) => {
        const y = 105 + r * 100
        return (
          <g key={k}>
            <Flow d={`M196 ${y} C290 ${y} 300 ${cy} ${cx - R - 34} ${cy}`} c={C.violet} t={0.6 + r * 0.25} />
            <g transform={`translate(70 ${y - 34})`}><g className="st-row" style={T(0.2 + r * 0.2)}>
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
      {/* growing over the years */}
      <Flow d={`M${cx + R + 34} ${cy} C${cx + R + 80} ${cy} 760 ${cy} 800 ${cy}`} c={C.violet} t={1.4} />
      <g transform="translate(810 96)"><g className="st-rise" style={T(1.2)}>
        <rect width="236" height="210" rx="18" fill="#fff" stroke={C.line} strokeWidth="1.5" />
        <Tx x={20} y={32} s={11} c={C.slate}>Net worth</Tx>
        <Tx x={20} y={58} s={22} w={800} c={C.navy}>₹1.17 Cr</Tx>
        {[0, 1, 2].map((k) => <line key={k} x1="20" x2="216" y1={96 + k * 32} y2={96 + k * 32} stroke={C.mist} strokeWidth="1.5" />)}
        <path d="M20 170 C50 162 70 166 96 150 S146 132 170 112 S204 90 216 82 V176 H20 Z" fill={C.violet} opacity=".08" />
        <path className="st-line" style={T(1.8)} d="M20 170 C50 162 70 166 96 150 S146 132 170 112 S204 90 216 82" fill="none" stroke={C.violet} strokeWidth="3.5" strokeLinecap="round" />
        <circle className="st-pop" style={T(3.1)} cx="216" cy="82" r="6" fill="#fff" stroke={C.violet} strokeWidth="3" />
        {['2020', '2022', '2024', '2026'].map((y, k) => <Tx key={y} x={20 + k * 65} y={196} s={10} w={600} c={C.slate} a={k === 0 ? 'start' : k === 3 ? 'end' : 'middle'}>{y}</Tx>)}
      </g></g>
    </svg>
  )
}

/* 3 · CAS statement → read for you → every fund in the app */
function SceneCas() {
  const funds = [[C.violet, 'Parag Parikh Flexi Cap', '₹6.4 L', '+18%'], [C.teal, 'HDFC Balanced Advantage', '₹4.1 L', '+13%'], [C.amber, 'Nippon Multi-Asset FoF', '₹2.9 L', '+15%'], [C.sky, 'ICICI Liquid', '₹1.2 L', '+7%'], [C.emerald, 'UTI Nifty 50 Index', '₹3.6 L', '+16%']]
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
      {[['38', 'funds'], ['1,240', 'transactions'], ['since 2012', 'full history']].map(([a, b], i) => (
        <g key={b} transform={`translate(840 ${78 + i * 100})`}><g className="st-pop" style={T(2.8 + i * 0.3)}>
          <rect width="190" height="78" rx="18" fill="#eff6ff" />
          <Tx x={95} y={38} s={22} w={800} c={C.sky} a="middle">{a}</Tx>
          <Tx x={95} y={60} s={12} c={C.slate} a="middle">{b}</Tx>
        </g></g>
      ))}
    </svg>
  )
}

/* 4 · goals on one road: Home moves to safe money as it nears; Retirement lives on three buckets */
const GLIDE = [['2026', 0.8], ['2027', 0.62], ['2028', 0.36], ['2029', 0.1]]
const JAR = 'M8 0 H96 Q104 0 104 8 V128 Q104 150 82 150 H22 Q0 150 0 128 V8 Q0 0 8 0 Z'
function SceneGoals() {
  const road = 'M40 370 C220 370 260 260 420 260 S640 170 780 170 S980 110 1060 90'
  const stops = [[301, 284, 'home', '2029', 'Home', C.teal], [608, 215, 'target', '2034', 'Education', C.violet], [942, 138, 'gold', '2045', 'Retire', C.amber]]
  return (
    <svg viewBox={VB} className="st-svg" aria-label="Goals on a road; the home goal moves to safe money as it comes near, retirement lives on three buckets">
      <path d={road} fill="none" stroke="#cbd5e1" strokeWidth="28" strokeLinecap="round" />
      <path d={road} fill="none" stroke="#fff" strokeWidth="3" strokeDasharray="12 12" className="la-dash" />
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
      <g className="st-car" style={{ offsetPath: `path('${road}')` }}>
        <g transform="translate(-22 -18)"><rect x="0" y="6" width="44" height="16" rx="6" fill={C.rose} /><path d="M8 7 L14 -2 H30 L36 7 Z" fill="#fecdd3" /><circle cx="11" cy="23" r="5" fill={C.navy} /><circle cx="33" cy="23" r="5" fill={C.navy} /></g>
      </g>

      {/* Home 2029: the jar slowly turns from equity (violet) to safe money (teal) */}
      <path className="la-dash" d="M200 214 Q240 214 282 210" fill="none" stroke={C.teal} strokeWidth="2.5" strokeDasharray="4 6" strokeLinecap="round" />
      <g transform="translate(46 26)"><g className="st-rise" style={T(0.6)}>
        <Tx x={0} y={14} s={11} w={800} c={C.teal} letterSpacing=".06em">HOME · MOVES TO SAFE</Tx>
        <g transform="translate(0 34)">
          <clipPath id="st-jar"><path d={JAR} /></clipPath>
          <g clipPath="url(#st-jar)">
            <rect width="104" height="150" fill={C.violet} opacity=".92" />
            <g className="st-safe"><g className="st-wave"><path d="M-104 8 Q-78 0 -52 8 T0 8 T52 8 T104 8 T156 8 T208 8 V400 H-104 Z" fill={C.teal} /></g></g>
            <rect x="12" y="10" width="10" height="110" rx="5" fill="#fff" opacity=".22" />
          </g>
          <path d={JAR} fill="none" stroke={C.navy} strokeOpacity=".18" strokeWidth="3" />
          <rect x="24" y="-8" width="56" height="10" rx="4" fill="#cbd5e1" />
        </g>
        <g transform="translate(122 92)">
          {GLIDE.map(([y, e], n) => (
            <g key={y} className={n === GLIDE.length - 1 ? 'st-yr last' : 'st-yr'} style={T(1 + n * 1.5)}>
              <Tx s={26} w={800} c={C.navy}>{y}</Tx>
              <g transform="translate(0 26)"><circle cx="5" cy="-4" r="5" fill={C.violet} /><Tx x={16} s={12} c={C.slate}>Equity <tspan fill={C.navy} fontWeight="800">{Math.round(e * 100)}%</tspan></Tx></g>
              <g transform="translate(0 46)"><circle cx="5" cy="-4" r="5" fill={C.teal} /><Tx x={16} s={12} c={C.slate}>Safe <tspan fill={C.navy} fontWeight="800">{Math.round((1 - e) * 100)}%</tspan></Tx></g>
            </g>
          ))}
        </g>
      </g></g>

      {/* Retirement 2045: growth refills stability, stability refills income */}
      <path className="la-dash" d="M942 156 Q942 200 900 222" fill="none" stroke={C.amber} strokeWidth="2.5" strokeDasharray="4 6" strokeLinecap="round" />
      <g transform="translate(700 236)"><g className="st-rise" style={T(1.2)}>
        <Tx x={0} y={0} s={11} w={800} c="#b45309" letterSpacing=".06em">RETIREMENT · THREE BUCKETS</Tx>
        {[['Income', C.sky, 46, 'spend'], ['Stability', C.teal, 58, '3–7 yrs'], ['Growth', C.violet, 70, '7+ yrs']].map(([l, c, h, sub], i) => (
          <g key={l} transform={`translate(${i * 96} 16)`}>
            <clipPath id={`st-b-${l}`}><path d="M0 0 h64 v92 q0 12 -12 12 h-40 q-12 0 -12 -12 Z" /></clipPath>
            <g clipPath={`url(#st-b-${l})`}><rect width="64" height="104" fill="#f8fafc" /><g className="la-fill" style={T(1.5 + i * 0.3)}><rect y={104 - h} width="64" height={h} fill={c} opacity=".85" /></g></g>
            <path d="M0 0 h64 v92 q0 12 -12 12 h-40 q-12 0 -12 -12 Z" fill="none" stroke="#94a3b8" strokeWidth="2.5" />
            <Tx x={32} y={124} s={11.5} c={C.ink} a="middle">{l}</Tx>
            <Tx x={32} y={139} s={10} w={600} c={C.slate} a="middle">{sub}</Tx>
            {i > 0 && <path className="la-dash" d="M-6 34 Q-18 20 -28 34" fill="none" stroke={c} strokeWidth="3" strokeDasharray="4 5" strokeLinecap="round" />}
          </g>
        ))}
      </g></g>
    </svg>
  )
}

/* 5 · you → the summary email → each family member */
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
      <Tx x={475} y={378} s={14} c={C.ink} a="middle">If something happens to you,</Tx>
      <Tx x={475} y={400} s={14} c={C.emerald} a="middle">they know where everything is.</Tx>
    </svg>
  )
}

const SCENES = { drive: SceneDrive, all: SceneAll, cas: SceneCas, goals: SceneGoals, family: SceneFamily }

export default function StoryHero({ signIn, isMobile, GoogleIcon, families, videoUrl }) {
  const [i, setI] = useState(0)
  const [paused, setPaused] = useState(false)
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
      {/* how it works, as a path: Your Drive → Track → Import → Goals → Family */}
      <ol className="st-path" role="tablist">
        {CHAPTERS.map((c, k) => (
          <li key={c.k} className={k === i ? 'on' : k < i ? 'done' : ''} style={{ '--cc': c.c }}>
            <button type="button" role="tab" aria-selected={k === i} aria-label={c.t} onClick={() => setI(k)}>
              <span className="st-dot"><Glyph name={c.icon} color={k <= i ? '#fff' : '#94a3b8'} size={15} /></span>
              <span className="st-lb">{c.s}</span>
            </button>
            {k < CHAPTERS.length - 1 && <span className="st-ln"><i style={k === i ? { animationDuration: `${c.dur || DUR}ms`, animationPlayState: paused ? 'paused' : 'running' } : undefined} /></span>}
          </li>
        ))}
      </ol>
      {/* the scene, edge to edge */}
      <div className="st-r" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
        <div key={ch.k} className="st-scene"><Scene /></div>
      </div>
      {/* the words and the button, at the bottom */}
      <div className="st-bar">
        {families ? <span className="st-fam"><i className="st-live" /><b>{families.toLocaleString('en-IN')}</b> families use it</span> : <span />}
        <div className="st-l">
          <h1><span className="st-h1a">Your family's money,</span> <span className="st-rot"><span key={ch.k} style={{ '--c': ch.c }}>{ch.ph}</span></span></h1>
          <div className="st-cta">
            {videoUrl && <a className="st-btn2" href={videoUrl} target="_blank" rel="noopener noreferrer" aria-label="Watch the 2-minute tour"><span className="st-play" aria-hidden="true"><svg width="9" height="9" viewBox="0 0 12 12"><path d="M3 1.8 L10 6 L3 10.2 Z" fill="currentColor" /></svg></span><span className="st-btn2t">2-min tour</span></a>}
            <button onClick={signIn} className="st-btn"><span className="st-g">{GoogleIcon}</span>Get started free</button>
          </div>
        </div>
      </div>
    </section>
  )
}

const CSS = `
.st{position:relative;overflow:hidden;background:linear-gradient(180deg,#f6f8fc 0%,#ffffff 70%);height:calc(100vh - 60px);min-height:600px;max-height:940px;display:flex;flex-direction:column}
.st-glow{position:absolute;left:10%;top:6%;width:80%;height:80%;border-radius:50%;background:radial-gradient(closest-side,color-mix(in srgb,var(--c) 16%,transparent),transparent 72%);transition:background .8s ease;pointer-events:none}

.st-r{position:relative;z-index:2;flex:1;min-height:0;width:100%;max-width:1400px;margin:0 auto;padding:0 24px;box-sizing:border-box;perspective:1400px}
.st-bar{position:relative;z-index:3;width:100%;max-width:1360px;margin:0 auto;padding:6px 40px 26px;box-sizing:border-box;display:flex;align-items:flex-end;justify-content:space-between;gap:24px}
.st-l{display:flex;align-items:center;gap:28px;min-width:0}
.st h1{margin:0;font-family:Inter,system-ui,sans-serif;font-weight:700;letter-spacing:-.025em;line-height:1.15;color:#0b1120;font-size:clamp(22px,2vw,30px);text-align:right}
.st-h1a{display:block}
.st-rot{display:block;position:relative;overflow:hidden;min-height:1.2em;padding-bottom:.06em}
.st-rot>span{display:inline-block;animation:stWord .6s cubic-bezier(.2,.8,.2,1) both;color:var(--c)}
@keyframes stWord{from{transform:translateY(60%);opacity:0;filter:blur(4px)}to{transform:none;opacity:1;filter:none}}
.st-cta{display:flex;gap:10px;align-items:center;padding-left:28px;border-left:1px solid #e2e8f0}
.st-btn{display:inline-flex;align-items:center;gap:10px;height:48px;padding:0 22px 0 6px;border-radius:999px;border:0;cursor:pointer;color:#fff;background:#0b1120;font-family:Inter,system-ui,sans-serif;font-weight:600;font-size:15px;box-shadow:0 10px 24px -12px rgba(11,17,32,.6);transition:transform .18s,box-shadow .18s,background .18s}
.st-btn:hover{transform:translateY(-1px);background:#1e293b;box-shadow:0 14px 28px -12px rgba(11,17,32,.6)}
.st-g{width:36px;height:36px;border-radius:50%;background:#fff;display:inline-flex;align-items:center;justify-content:center}
.st-btn2{display:inline-flex;align-items:center;gap:10px;height:48px;padding:0 6px;color:#334155;font-weight:600;font-size:14.5px;text-decoration:none}
.st-btn2:hover{color:#0b1120}
.st-play{width:32px;height:32px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;background:#fff;color:var(--c);box-shadow:0 0 0 1px #e2e8f0,0 4px 10px -6px rgba(15,23,42,.3);padding-left:2px;box-sizing:border-box;transition:color .6s,transform .18s}
.st-btn2:hover .st-play{transform:scale(1.08)}
.st-fam{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:500;color:#64748b}.st-fam b{color:#0b1120;font-weight:700}
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
.st-path{position:relative;z-index:3;list-style:none;margin:0 auto;padding:22px 32px 4px;display:flex;align-items:center;justify-content:center;gap:0;width:100%;max-width:980px;box-sizing:border-box}
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
@keyframes stSafe{0%{transform:translateY(120px)}33%{transform:translateY(93px)}66%{transform:translateY(54px)}100%{transform:translateY(15px)}}
.st-wave{animation:stWave 2.2s linear infinite}
@keyframes stWave{from{transform:translateX(0)}to{transform:translateX(104px)}}
.st-yr{opacity:0;animation:stYr 1.5s ease both}.st-yr.last{animation-name:stYrLast}
@keyframes stYr{0%{opacity:0;transform:translateY(8px)}15%,85%{opacity:1;transform:none}100%{opacity:0;transform:translateY(-8px)}}
@keyframes stYrLast{0%{opacity:0;transform:translateY(8px)}15%,100%{opacity:1;transform:none}}
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
.st.m .st-r{padding:0;display:flex;align-items:center;overflow:hidden}
.st.m .st-scene{position:relative;inset:auto;height:min(340px,100%);width:100%;transform:none}
.st.m .st-svg{height:100%;width:auto;max-width:none;animation:stPan 7.5s ease-in-out both}
@keyframes stPan{0%,12%{transform:translateX(0)}88%,100%{transform:translateX(calc(-100% + 100vw))}}
.st.m .st-bar{flex-direction:column-reverse;align-items:center;padding:4px 16px 22px;gap:12px}
.st.m .st-l{flex-direction:column;gap:14px}
.st.m h1{font-size:24px;text-align:center}
.st.m .st-cta{padding-left:0;border-left:0;flex-direction:row-reverse}.st.m .st-btn{height:48px}.st.m .st-btn2t{display:none}
.st.m .st-fam{font-size:12.5px}
.st.m .st-glow{left:-30%;top:20%;width:160%;height:60%}
@media (prefers-reduced-motion:reduce){.st-flow,.st-scan,.st-car,.st-env,.st-play::after,.st-am,.st-spark{animation:none!important}.st-flow,.st-env,.st-spark{display:none}}
`
