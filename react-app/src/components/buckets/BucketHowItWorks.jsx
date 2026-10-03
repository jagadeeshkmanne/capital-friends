import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, Pause, Play, Landmark, Lock, AlertTriangle, TrendingUp, TrendingDown, Wallet, ShieldCheck } from 'lucide-react'

// Animated explainer for the bucket refill rules. Each scene shows the three
// buckets, how full they are, and which way money moves.

const SCENES = [
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

const BUCKET_VIEW = [
  { key: 'b1', name: 'Income', note: '2 years', icon: Wallet, fill: 'bg-emerald-500/70', ring: 'border-emerald-500/40', text: 'text-emerald-400' },
  { key: 'b2', name: 'Stability', note: '5 years', icon: ShieldCheck, fill: 'bg-amber-500/70', ring: 'border-amber-500/40', text: 'text-amber-400' },
  { key: 'b3', name: 'Growth', note: 'the rest', icon: TrendingUp, fill: 'bg-violet-500/70', ring: 'border-violet-500/40', text: 'text-violet-400' },
]

const SCENE_MS = 6500

export default function BucketHowItWorks() {
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [settled, setSettled] = useState(false)
  const scene = SCENES[index]

  // Show the "before" levels first, then animate to "after".
  useEffect(() => {
    setSettled(false)
    const t = setTimeout(() => setSettled(true), 450)
    return () => clearTimeout(t)
  }, [index])

  useEffect(() => {
    if (!playing) return
    const t = setTimeout(() => setIndex(i => (i + 1) % SCENES.length), SCENE_MS)
    return () => clearTimeout(t)
  }, [index, playing])

  const levels = settled ? scene.to : scene.from
  const go = step => { setPlaying(false); setIndex(i => (i + step + SCENES.length) % SCENES.length) }

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

      {/* Stage */}
      <div className="relative rounded-xl border border-[var(--border-light)] bg-[var(--bg-inset)] px-3 pt-12 pb-4 sm:px-6 overflow-hidden">
        {/* Long lane: Growth → Income (above the buckets) */}
        <Lane active={scene.flows.includes('b3b1')} className="top-4 left-[16%] right-[16%]" color="bg-violet-400" label="Growth → Income" />

        <div className="grid grid-cols-[auto_1fr_auto_1fr_auto_1fr_auto] items-end gap-1 sm:gap-2">
          {/* Bank */}
          <div className="flex flex-col items-center gap-1 pb-6">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${scene.flows.includes('out') ? 'bg-emerald-500/20 text-emerald-400' : 'bg-[var(--bg-card)] text-[var(--text-dim)]'}`}>
              <Landmark size={16} />
            </div>
            <span className="text-[10px] text-[var(--text-dim)]">Bank</span>
          </div>

          {BUCKET_VIEW.map((b, i) => {
            const flowIn = i === 0 ? 'out' : i === 1 ? 'b2b1' : 'b3b2'
            return [
              <SideLane key={`${b.key}-lane`} active={scene.flows.includes(flowIn)}
                color={i === 0 ? 'bg-emerald-400' : i === 1 ? 'bg-amber-400' : 'bg-violet-400'} />,
              <Bucket key={b.key} view={b} level={levels[b.key]}
                locked={b.key === 'b3' && scene.lockGrowth}
                floor={b.key === 'b2' && scene.warning}
                market={b.key === 'b3' ? scene.market : null} />,
            ]
          })}
        </div>
      </div>

      {/* Caption */}
      <div className="min-h-[88px]">
        <p className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
          {scene.warning && <AlertTriangle size={15} className="text-amber-400 shrink-0" />}
          {scene.title}
        </p>
        <p className="text-sm text-[var(--text-muted)] mt-1 leading-relaxed">{scene.text}</p>
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
          <IconButton label={playing ? 'Pause' : 'Play'} onClick={() => setPlaying(p => !p)}>{playing ? <Pause size={15} /> : <Play size={15} />}</IconButton>
          <IconButton label="Next" onClick={() => go(1)}><ArrowRight size={15} /></IconButton>
        </div>
      </div>
    </div>
  )
}

function Bucket({ view, level, locked, floor, market }) {
  const Icon = view.icon
  return (
    <div className="flex flex-col items-center gap-1.5 min-w-0">
      <div className="h-6 flex items-center">
        {market === 'good' && <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 rounded-full px-2 py-0.5 whitespace-nowrap"><TrendingUp size={11} /> near high</span>}
        {market === 'down' && <span className="flex items-center gap-1 text-[10px] font-semibold text-rose-400 bg-rose-500/10 rounded-full px-2 py-0.5 whitespace-nowrap"><TrendingDown size={11} /> down</span>}
      </div>
      <div className={`relative w-12 sm:w-20 h-28 sm:h-32 rounded-b-2xl rounded-t-md border-2 ${view.ring} bg-[var(--bg-card)] overflow-hidden`}>
        <div className={`absolute bottom-0 left-0 right-0 ${view.fill} transition-[height] duration-[1400ms] ease-in-out`} style={{ height: `${level}%` }} />
        {floor && <div className="absolute left-0 right-0 border-t-2 border-dashed border-rose-400" style={{ bottom: '40%' }} title="2-year floor" />}
        {locked && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="w-8 h-8 rounded-full bg-[var(--bg-card)]/90 flex items-center justify-center"><Lock size={15} className="text-rose-400" /></span>
          </div>
        )}
      </div>
      <div className="text-center leading-tight">
        <p className={`text-xs font-bold ${view.text} flex items-center gap-1 justify-center`}><Icon size={12} />{view.name}</p>
        <p className="text-[10px] text-[var(--text-dim)]">{floor ? 'min 2 years' : view.note}</p>
      </div>
    </div>
  )
}

// Short lane between two neighbours; dots move right-to-left (towards Income/Bank).
function SideLane({ active, color }) {
  return (
    <div className="relative h-2 mb-16 sm:mb-20 mx-0.5">
      <div className="absolute inset-0 rounded-full bg-[var(--border)]" />
      {active && [0, 1, 2].map(i => (
        <span key={i} className={`bucket-dot absolute top-1/2 w-2 h-2 rounded-full ${color}`} style={{ animationDelay: `${i * 0.45}s` }} />
      ))}
      {active && <ArrowLeft size={12} className="absolute -top-4 left-1/2 -translate-x-1/2 text-[var(--text-muted)]" />}
    </div>
  )
}

function Lane({ active, className, color, label }) {
  return (
    <div className={`absolute h-2 ${className} transition-opacity duration-500 ${active ? 'opacity-100' : 'opacity-0'}`}>
      <div className="absolute inset-0 rounded-full bg-[var(--border)]" />
      {active && [0, 1, 2, 3].map(i => (
        <span key={i} className={`bucket-dot-long absolute top-1/2 w-2 h-2 rounded-full ${color}`} style={{ animationDelay: `${i * 0.5}s` }} />
      ))}
      <span className="absolute left-1/2 -translate-x-1/2 top-2.5 text-[10px] font-semibold text-violet-400 whitespace-nowrap">{label}</span>
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
@keyframes bucket-flow { 0% { right: 0; opacity: 0 } 15% { opacity: 1 } 85% { opacity: 1 } 100% { right: calc(100% - 8px); opacity: 0 } }
.bucket-dot, .bucket-dot-long { transform: translateY(-50%); animation: bucket-flow 1.4s linear infinite; }
.bucket-dot-long { animation-duration: 2s; }
@media (prefers-reduced-motion: reduce) { .bucket-dot, .bucket-dot-long { animation: none; right: 45%; } }
`
