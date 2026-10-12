import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, Pause, Play, RotateCcw, AlertTriangle } from 'lucide-react'

// Animated explainer for the bucket refill rules. Each scene shows the three
// buckets, how full they are, and which way money moves.

const SCENES = [
  {
    key: 'build',
    tag: 'Last 5 years',
    title: 'Before retirement: build the buckets in small steps',
    text: 'In the 5 years before retirement, the app moves a small amount from Growth to Stability every quarter, and in the last 2 years to Income too. It only moves in a good market, so nothing is sold in one go or at a low.',
    from: { b1: 0, b2: 25, b3: 100 },
    to: { b1: 0, b2: 40, b3: 93 },
    flows: ['b3b2'],
    market: 'good',
  },
  {
    key: 'monthly',
    tag: 'Every month',
    title: 'Your monthly income comes from the Income bucket',
    text: 'Each month, one month of expenses moves from the Income bucket to your bank account. The other two buckets are not touched. Bucket sizes use this year’s expenses, so they grow with inflation.',
    from: { b1: 100, b2: 100, b3: 80 },
    to: { b1: 50, b2: 100, b3: 80 },
    flows: ['out'],
    market: null,
  },
  {
    key: 'good',
    tag: 'Good year',
    title: 'Market near its high: Growth refills Income',
    text: 'Once a year, the app checks your growth funds. If they are within 10% of their all-time high, it sells some growth and fills Income back to 2 years. Stability is already full, so it stays as it is.',
    from: { b1: 50, b2: 100, b3: 80 },
    to: { b1: 100, b2: 100, b3: 72 },
    flows: ['b3b1'],
    market: 'good',
  },
  {
    key: 'down',
    tag: 'Bad year',
    title: 'Market down: Stability refills Income',
    text: 'If growth funds are more than 10% below their high, the app does not sell them. Stability fills Income instead. That is exactly why the Stability bucket exists.',
    from: { b1: 50, b2: 100, b3: 55 },
    to: { b1: 100, b2: 80, b3: 55 },
    flows: ['b2b1'],
    market: 'down',
    lockGrowth: true,
  },
  {
    key: 'recovery',
    tag: 'Recovery year',
    title: 'Market back near its high: Growth refills both',
    text: 'When growth funds are back near their high, the app fills Income to 2 years and also brings Stability back to 5 years, both from growth.',
    from: { b1: 50, b2: 80, b3: 82 },
    to: { b1: 100, b2: 100, b3: 70 },
    flows: ['b3b1', 'b3b2'],
    market: 'good',
  },
  {
    key: 'long',
    tag: 'Long fall',
    title: 'Stability never goes below 2 years',
    text: 'In a very long fall, Stability keeps at least 2 years of expenses. If Income still cannot be filled, the app warns you so you can spend a little less for a while.',
    from: { b1: 50, b2: 48, b3: 50 },
    to: { b1: 70, b2: 40, b3: 50 },
    flows: ['b2b1'],
    market: 'down',
    lockGrowth: true,
    warning: true,
  },
]


const SCENE_MS = 6500

export default function BucketHowItWorks({ compact = false }) {
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(true)
  // phase: 'before' (old levels) → 'flow' (money moves, jars fill) → 'done' (filled; nothing moves any more)
  const [phase, setPhase] = useState('before')
  const scene = SCENES[index]
  const last = index === SCENES.length - 1

  useEffect(() => {
    setPhase('before')
    const a = setTimeout(() => setPhase('flow'), 500)
    const b = setTimeout(() => setPhase('done'), 2900)
    return () => { clearTimeout(a); clearTimeout(b) }
  }, [index])

  // plays through the story once and stops at the end (it does not loop back and refill again)
  useEffect(() => {
    if (!playing || last) { if (last) setPlaying(false); return }
    const t = setTimeout(() => setIndex(i => i + 1), SCENE_MS)
    return () => clearTimeout(t)
  }, [index, playing, last])

  const settled = phase !== 'before'
  const levels = settled ? scene.to : scene.from
  const go = step => { setPlaying(false); setIndex(i => Math.max(0, Math.min(SCENES.length - 1, i + step))) }
  const replay = () => { setIndex(0); setPlaying(true) }

  return (
    <div className="space-y-4">
      <style>{FLOW_CSS}</style>

      {/* Scene tabs */}
      <div className="flex flex-wrap gap-1.5">
        {SCENES.map((s, i) => (
          <button key={s.key} type="button" onClick={() => { setPlaying(false); setIndex(i) }}
            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${i === index
              ? 'bg-violet-500/15 text-violet-400 border-violet-500/30'
              : 'text-[var(--text-dim)] border-[var(--border)] hover:text-[var(--text-primary)]'}`}>
            {s.tag}
          </button>
        ))}
      </div>

      {/* Stage: the jars, with money flowing along curved arrows into the bucket it fills */}
      <Stage scene={scene} levels={levels} phase={phase} />

      {/* Caption */}
      <div className={compact ? "min-h-[64px]" : "min-h-[88px]"}>
        <p className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
          {scene.warning && <AlertTriangle size={15} className="text-amber-400 shrink-0" />}
          {scene.title}
        </p>
        <p className={`${compact ? "text-xs" : "text-sm"} text-[var(--text-muted)] mt-1 leading-relaxed`}>{scene.text}</p>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5">
          {SCENES.map((s, i) => (
            <span key={s.key} className={`h-1.5 rounded-full transition-all ${i === index ? 'w-6 bg-violet-400' : 'w-1.5 bg-[var(--text-dim)]/40'}`} />
          ))}
        </div>
        <div className="flex items-center gap-1">
          <IconButton label="Previous" onClick={() => go(-1)}><ArrowLeft size={15} /></IconButton>
          {last && !playing ? <IconButton label="Play again" onClick={replay}><RotateCcw size={15} /></IconButton> : <IconButton label={playing ? 'Pause' : 'Play'} onClick={() => setPlaying(p => !p)}>{playing ? <Pause size={15} /> : <Play size={15} />}</IconButton>}
          <IconButton label="Next" onClick={() => go(1)}><ArrowRight size={15} /></IconButton>
        </div>
      </div>
    </div>
  )
}

const JX = { b1: 200, b2: 340, b3: 480 }
const JC = { b1: '#34d399', b2: '#fbbf24', b3: '#a78bfa' }
const NAME = { b1: 'Income', b2: 'Stability', b3: 'Growth' }
const TOP = 96, BOT = 206, JW = 76
// a curved arrow from one jar's mouth to another's (higher arc for the longer jump)
const arc = (from, to) => {
  const x1 = JX[from], x2 = JX[to], h = Math.abs(x1 - x2) > 200 ? 92 : 58
  const apex = TOP - 8 - h / 2
  // long jump: label above its arc; short jump: label just under its arc (so two arcs never overlap)
  return { d: `M${x1},${TOP - 8} Q${(x1 + x2) / 2},${TOP - 8 - h} ${x2 + (x1 > x2 ? 10 : -10)},${TOP - 10}`, lx: (x1 + x2) / 2, ly: h > 60 ? apex - 16 : apex + 18 }
}
const OUT = `M${JX.b1 - JW / 2 - 4},${BOT - 30} Q140,${BOT + 6} 104,174`
const FLOW = { b3b1: ['b3', 'b1'], b3b2: ['b3', 'b2'], b2b1: ['b2', 'b1'] }

function Stage({ scene, levels, phase }) {
  const moving = phase === 'flow'
  const flows = scene.flows
  return (
    <div className="relative rounded-xl border border-[var(--border-light)] bg-[var(--bg-inset)] overflow-hidden">
      <svg viewBox="0 0 600 250" className="w-full h-auto block" role="img" aria-label={scene.title}>
        <defs>
          {Object.entries(JC).map(([k, c]) => (
            <marker key={k} id={`hw-ar-${k}`} viewBox="0 0 10 10" refX="6" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill={c} /></marker>
          ))}
          {Object.keys(JX).map((k) => <clipPath key={k} id={`hw-c-${k}`}><rect x={JX[k] - JW / 2 + 3} y={TOP + 3} width={JW - 6} height={BOT - TOP - 6} rx="12" /></clipPath>)}
        </defs>

        {/* bank */}
        <g opacity={flows.includes('out') ? 1 : 0.45}>
          <rect x="44" y="150" width="56" height="44" rx="10" fill="var(--bg-card)" stroke={flows.includes('out') ? JC.b1 : 'var(--border)'} strokeWidth="2" />
          <text x="72" y="178" textAnchor="middle" fontSize="20">🏦</text>
          <text x="72" y="212" textAnchor="middle" fontSize="12" fill="var(--text-muted)">Your bank</text>
        </g>

        {/* jars */}
        {Object.keys(JX).map((k) => {
          const x = JX[k] - JW / 2, lvl = Math.max(0, Math.min(100, levels[k])) / 100
          return (
            <g key={k}>
              <rect x={JX[k] - 22} y={TOP - 12} width="44" height="10" rx="4" fill={JC[k]} opacity=".8" />
              <rect x={x} y={TOP} width={JW} height={BOT - TOP} rx="14" fill="var(--bg-card)" stroke={JC[k]} strokeOpacity=".6" strokeWidth="2.5" />
              <g clipPath={`url(#hw-c-${k})`}>
                <rect x={x} y={TOP} width={JW} height={BOT - TOP} fill={JC[k]} opacity=".55"
                  style={{ transformBox: 'fill-box', transformOrigin: 'bottom', transform: `scaleY(${lvl})`, transition: 'transform 1.4s ease-in-out' }} />
              </g>
              {k === 'b3' && scene.lockGrowth && <text x={JX[k]} y={TOP + 62} textAnchor="middle" fontSize="22">🔒</text>}
              {k === 'b2' && scene.warning && <line x1={x + 4} x2={x + JW - 4} y1={BOT - (BOT - TOP) * 0.4} y2={BOT - (BOT - TOP) * 0.4} stroke="#fb7185" strokeWidth="2" strokeDasharray="5 4" />}
              <text x={JX[k]} y={BOT + 20} textAnchor="middle" fontSize="13" fontWeight="700" fill={JC[k]}>{NAME[k]}</text>
              <text x={JX[k]} y={BOT + 36} textAnchor="middle" fontSize="11" fill="var(--text-muted)">{k === 'b2' && scene.warning ? 'min 2 years' : { b1: '2 years', b2: '5 years', b3: 'the rest' }[k]}</text>
            </g>
          )
        })}
        {scene.market && (
          <g>
            <rect x={JX.b3 - 44} y="8" width="88" height="22" rx="11" fill={scene.market === 'good' ? 'rgba(52,211,153,.14)' : 'rgba(251,113,133,.14)'} />
            <text x={JX.b3} y="23" textAnchor="middle" fontSize="11" fontWeight="700" fill={scene.market === 'good' ? '#34d399' : '#fb7185'}>{scene.market === 'good' ? '▲ near its high' : '▼ market down'}</text>
          </g>
        )}

        {/* flows: curved arrow + coins moving along it + a label saying where the money goes */}
        {flows.filter((f) => FLOW[f]).map((f) => {
          const [a, b] = FLOW[f], { d, lx, ly } = arc(a, b)
          return (
            <g key={scene.key + f}>
              <path d={d} fill="none" stroke={JC[a]} strokeOpacity=".35" strokeWidth="5" strokeLinecap="round" />
              <path d={d} fill="none" stroke={JC[a]} strokeWidth="2" strokeDasharray="6 6" markerEnd={`url(#hw-ar-${a})`} opacity={phase === 'done' ? 0.5 : 1}>
                {moving && <animate attributeName="stroke-dashoffset" from="24" to="0" dur="0.8s" repeatCount="indefinite" />}
              </path>
              <rect x={lx - 62} y={ly - 13} width="124" height="20" rx="10" fill="var(--bg-card)" stroke={JC[a]} strokeOpacity=".5" />
              <text x={lx} y={ly + 1} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--text-primary)">{phase === 'done' ? `✓ ${NAME[b]} refilled` : `${NAME[a]} → ${NAME[b]}`}</text>
            </g>
          )
        })}
        {flows.includes('out') && (() => {
          const d = OUT
          return (
            <g key={scene.key + 'out'}>
              <path d={d} fill="none" stroke={JC.b1} strokeWidth="2" strokeDasharray="6 6" markerEnd="url(#hw-ar-b1)">
                {moving && <animate attributeName="stroke-dashoffset" from="24" to="0" dur="0.8s" repeatCount="indefinite" />}
              </path>
              
              <rect x="24" y="118" width="96" height="20" rx="10" fill="var(--bg-card)" stroke={JC.b1} strokeOpacity=".5" />
              <text x="72" y="132" textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--text-primary)">{phase === 'done' ? '✓ paid' : '1 month → bank'}</text>
            </g>
          )
        })()}
      </svg>
      {moving && (
        <svg key={scene.key} viewBox="0 0 600 250" className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true">
          {[...flows.filter((f) => FLOW[f]).map((f) => arc(...FLOW[f]).d), ...(flows.includes('out') ? [OUT] : [])].map((d, j) => [0, 0.45, 0.9].map((t) => (
            <circle key={`${j}-${t}`} r="6" fill="#fbbf24" stroke="#b45309" strokeWidth="1.5" opacity="0">
              <animateMotion dur="1.3s" begin={`${t}s`} fill="freeze" path={d} />
              <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.85;1" dur="1.3s" begin={`${t}s`} fill="freeze" />
            </circle>
          )))}
        </svg>
      )}
    </div>
  )
}

function IconButton({ label, onClick, children }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label}
      className="p-1.5 rounded-md text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]">
      {children}
    </button>
  )
}

const FLOW_CSS = `
@media (prefers-reduced-motion: reduce) { svg animate, svg animateMotion { display: none } }
@keyframes bucket-flow { 0% { right: 0; opacity: 0 } 15% { opacity: 1 } 85% { opacity: 1 } 100% { right: calc(100% - 8px); opacity: 0 } }
.bucket-dot, .bucket-dot-long { transform: translateY(-50%); animation: bucket-flow 1.4s linear infinite; }
.bucket-dot-long { animation-duration: 2s; }
@media (prefers-reduced-motion: reduce) { .bucket-dot, .bucket-dot-long { animation: none; right: 45%; } }
`
