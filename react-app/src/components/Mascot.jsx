import { useId } from 'react'

// The little Capital Friends friend: a purple ball with a sprout. Moods (data-mood): idle, happy, curious, think, sad, cheer.
// Add the class 'hop', 'leap' or 'wave' for a one-off move. Used by the welcome question and the feedback form.

export default function Mascot({ refEl, mood, wave = true, className = '' }) {
  const gid = 'cfm' + useId().replace(/[^a-zA-Z0-9]/g, '')
  return (
    <>
    <style>{MASCOT_CSS}</style>
    <svg ref={refEl} className={`cfq-m${wave ? ' wave' : ''} ${className}`} data-mood={mood} viewBox="-62 -64 124 124" aria-hidden="true">
      <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#b8a0ff" /><stop offset="1" stopColor="#7c3aed" /></linearGradient></defs>
      <ellipse className="shadow" cx="0" cy="52" rx="26" ry="4.5" />
      <g className="bob"><g className="jump">
        <g transform="translate(-32 12)"><path className="arm arm-l" d="M0 0 Q-12 4 -14 15" /></g>
        <g transform="translate(32 12)"><path className="arm arm-r" d="M0 0 Q12 4 14 15" /></g>
        <g className="sprout"><path className="stem" d="M0 -33 Q-1 -41 1 -47" /><path className="leaf" d="M1 -45 Q11 -56 20 -50 Q12 -41 1 -45Z" /><path className="leaf l2" d="M0 -42 Q-9 -51 -16 -45 Q-9 -37 0 -42Z" /></g>
        <circle className="bd" cx="0" cy="4" r="38" fill={`url(#${gid})`} />
        <ellipse className="shine" cx="-15" cy="-17" rx="9" ry="5" transform="rotate(-32 -15 -17)" />
        <ellipse className="ck" cx="-23" cy="13" rx="5.5" ry="3.4" /><ellipse className="ck" cx="23" cy="13" rx="5.5" ry="3.4" />
        <g className="look"><g className="eyes-n">
          <ellipse cx="-13" cy="-1" rx="4.6" ry="6.2" /><ellipse cx="13" cy="-1" rx="4.6" ry="6.2" />
          <circle className="hl" cx="-11.4" cy="-3.6" r="1.6" /><circle className="hl" cx="14.6" cy="-3.6" r="1.6" />
        </g></g>
        <path className="eye-h" d="M-18 0 Q-13 -7 -8 0 M8 0 Q13 -7 18 0" />
        <path className="brow" d="M-20 -11 L-8 -14.5 M20 -11 L8 -14.5" />
        <path className="mo mo-n" d="M-7 13 Q0 19 7 13" />
        <g className="mo-h"><path d="M-10 11 Q0 26 10 11Z" /><path className="tongue" d="M-4.5 18.5 Q0 15 4.5 18.5 Q0 21 -4.5 18.5Z" /></g>
        <path className="mo mo-s" d="M-7 18 Q0 12 7 18" />
        <ellipse className="mo-o" cx="0" cy="15" rx="3.2" ry="3.8" />
        <path className="tear" d="M-15 5 q-3.2 5 0 7.5 q3.2 -2.5 0 -7.5Z" />
      </g></g>
      <g className="bulb"><path d="M41 -58 v-4 M29 -54 l-3 -3 M53 -54 l3 -3" /><circle cx="41" cy="-44" r="8" /><rect x="38" y="-37" width="6" height="5" rx="1.2" /></g>
    </svg>
    </>
  )
}

export const MASCOT_CSS = `
.cfq-m { width:108px; height:112px; flex:none; overflow:visible }
.cfq-m .shadow { fill:rgba(0,0,0,.18); transform-box:fill-box; transform-origin:center; animation:cfq-shadow 3s ease-in-out infinite }
.cfq-m .bob { animation:cfq-bob 3s ease-in-out infinite }
.cfq-m .jump { transition:transform .3s }
.cfq-m .bd { stroke:rgba(0,0,0,.06) }
.cfq-m .shine { fill:rgba(255,255,255,.28) }
.cfq-m .ck { fill:rgba(244,114,182,.55); transition:opacity .25s }
.cfq-m .arm { fill:none; stroke:#6d28d9; stroke-width:6; stroke-linecap:round; transition:transform .35s cubic-bezier(.3,1.4,.5,1) }
.cfq-m .stem { fill:none; stroke:#10b981; stroke-width:3; stroke-linecap:round }
.cfq-m .leaf { fill:#34d399 } .cfq-m .leaf.l2 { fill:#10b981 }
.cfq-m .sprout { transform-box:fill-box; transform-origin:bottom center; animation:cfq-sway 4s ease-in-out infinite; transition:transform .3s }
.cfq-m .eyes-n ellipse { fill:#1e1b4b; transform-box:fill-box; transform-origin:center; animation:cfq-blink 4.6s infinite }
.cfq-m .eyes-n .hl { fill:#fff }
.cfq-m .look { transform:translate(var(--lx,0px),var(--ly,0px)); transition:transform .18s }
.cfq-m .eyes-n { transition:transform .25s, opacity .2s; transform-box:fill-box; transform-origin:center }
.cfq-m .eye-h, .cfq-m .brow, .cfq-m .mo { fill:none; stroke:#1e1b4b; stroke-width:3; stroke-linecap:round; stroke-linejoin:round }
.cfq-m .brow { stroke-width:2.6 }
.cfq-m .mo-h path, .cfq-m .mo-o { fill:#1e1b4b } .cfq-m .mo-h .tongue { fill:#f472b6 }
.cfq-m .tear { fill:#60a5fa }
.cfq-m .bulb circle { fill:#fde047 } .cfq-m .bulb rect { fill:#a3a3a3 } .cfq-m .bulb path { fill:none; stroke:#fde047; stroke-width:2.4; stroke-linecap:round }
.cfq-m .bulb { transform-box:fill-box; transform-origin:center bottom }
.cfq-m .eye-h, .cfq-m .brow, .cfq-m .tear, .cfq-m .bulb, .cfq-m .mo-h, .cfq-m .mo-s, .cfq-m .mo-o { opacity:0; transition:opacity .2s }
.cfq-m .mo-n { transition:opacity .2s }
.cfq-m[data-mood="happy"] .eyes-n, .cfq-m[data-mood="cheer"] .eyes-n, .cfq-m[data-mood="happy"] .mo-n, .cfq-m[data-mood="cheer"] .mo-n { opacity:0 }
.cfq-m[data-mood="happy"] .eye-h, .cfq-m[data-mood="cheer"] .eye-h, .cfq-m[data-mood="happy"] .mo-h, .cfq-m[data-mood="cheer"] .mo-h { opacity:1 }
.cfq-m[data-mood="curious"] .eyes-n { transform:scale(1.18) }
.cfq-m[data-mood="curious"] .mo-n, .cfq-m[data-mood="think"] .mo-n { opacity:0 }
.cfq-m[data-mood="curious"] .mo-o, .cfq-m[data-mood="think"] .mo-o { opacity:1 }
.cfq-m[data-mood="think"] .eyes-n { transform:translate(2px,-3px) }
.cfq-m[data-mood="think"] .bulb { opacity:1; animation:cfq-glow 1.2s ease-in-out infinite }
.cfq-m[data-mood="think"] .arm-r { transform:rotate(-95deg) }
.cfq-m[data-mood="sad"] .brow, .cfq-m[data-mood="sad"] .mo-s { opacity:1 }
.cfq-m[data-mood="sad"] .mo-n { opacity:0 }
.cfq-m[data-mood="sad"] .tear { opacity:1; animation:cfq-tear 1.6s ease-in infinite }
.cfq-m[data-mood="sad"] .jump { transform:translateY(4px) }
.cfq-m[data-mood="sad"] .ck { opacity:.15 }
.cfq-m[data-mood="sad"] .sprout { animation:none; transform:rotate(-24deg) }
.cfq-m[data-mood="sad"] .arm-l { transform:rotate(12deg) } .cfq-m[data-mood="sad"] .arm-r { transform:rotate(-12deg) }
.cfq-m[data-mood="cheer"] .arm-l { transform:rotate(130deg) } .cfq-m[data-mood="cheer"] .arm-r { transform:rotate(-130deg) }
.cfq-m.wave .arm-r { animation:cfq-wave .5s ease-in-out 3 alternate }
.cfq-m.hop .jump { animation:cfq-hop .55s cubic-bezier(.3,1.5,.5,1) }
.cfq-m.leap .jump { animation:cfq-leap .9s cubic-bezier(.3,1.4,.5,1) 2 }
@keyframes cfq-bob { 50% { transform:translateY(-4px) } }
@keyframes cfq-shadow { 50% { transform:scaleX(.86); opacity:.7 } }
@keyframes cfq-blink { 0%,45%,49%,100% { transform:scaleY(1) } 47% { transform:scaleY(.1) } }
@keyframes cfq-sway { 0%,100% { transform:rotate(-6deg) } 50% { transform:rotate(7deg) } }
@keyframes cfq-wave { from { transform:rotate(-105deg) } to { transform:rotate(-145deg) } }
@keyframes cfq-hop { 40% { transform:translateY(-12px) } }
@keyframes cfq-leap { 35% { transform:translateY(-20px) rotate(-6deg) } 70% { transform:translateY(0) rotate(4deg) } }
@keyframes cfq-tear { 0% { transform:translateY(0); opacity:0 } 20% { opacity:1 } 100% { transform:translateY(16px); opacity:0 } }
@keyframes cfq-glow { 50% { transform:translateY(-2px) scale(1.08) } }
@media (prefers-reduced-motion: reduce) { .cfq-m, .cfq-m * { animation:none !important } }
`
