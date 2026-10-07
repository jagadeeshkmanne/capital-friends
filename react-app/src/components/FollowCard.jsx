import { Youtube, Instagram } from 'lucide-react'

export const YOUTUBE_URL = 'https://www.youtube.com/@capitalfriendsin'
export const INSTAGRAM_URL = 'https://www.instagram.com/jags.manne/'

// "Follow us" card: YouTube channel + Instagram. compact = two small buttons (sidebar), else a full card.
export default function FollowCard({ compact = false, className = '' }) {
  const btn = 'cf-follow flex-1 flex items-center justify-center gap-1.5 rounded-lg font-semibold transition-transform hover:scale-[1.04] no-underline'
  // gentle attention: a soft glow pulse and a light sweeping across, every few seconds
  const anim = (
    <style>{`
      .cf-follow{position:relative;overflow:hidden}
      .cf-follow::after{content:'';position:absolute;top:0;left:-60%;width:40%;height:100%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.35),transparent);transform:skewX(-20deg);animation:cfShine 4.5s ease-in-out infinite}
      .cf-follow.cf-yt{animation:cfGlowYt 3s ease-in-out infinite}
      .cf-follow.cf-ig{animation:cfGlowIg 3s ease-in-out infinite 1.5s}
      .cf-follow.cf-ig::after{animation-delay:2.2s}
      @keyframes cfShine{0%,60%{left:-60%}100%{left:130%}}
      @keyframes cfGlowYt{0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,0)}50%{box-shadow:0 0 14px 2px rgba(239,68,68,.45)}}
      @keyframes cfGlowIg{0%,100%{box-shadow:0 0 0 0 rgba(236,72,153,0)}50%{box-shadow:0 0 14px 2px rgba(236,72,153,.45)}}
      @media (prefers-reduced-motion:reduce){.cf-follow,.cf-follow::after{animation:none}}
    `}</style>
  )
  const links = (
    <div className="flex gap-2">
      {anim}
      <a href={YOUTUBE_URL} target="_blank" rel="noopener noreferrer"
        className={`${btn} cf-yt ${compact ? 'px-2 py-1.5 text-[11px]' : 'px-3 py-2 text-xs'} bg-red-600 text-white`}>
        <Youtube size={compact ? 13 : 15} /> YouTube
      </a>
      <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer"
        className={`${btn} cf-ig ${compact ? 'px-2 py-1.5 text-[11px]' : 'px-3 py-2 text-xs'} text-white`} style={{ background: 'linear-gradient(45deg,#f58529,#dd2a7b 50%,#8134af)' }}>
        <Instagram size={compact ? 13 : 15} /> Instagram
      </a>
    </div>
  )
  if (compact) {
    return (
      <div className={`px-3 py-3 border-t border-[var(--border)] space-y-1.5 ${className}`}>
        <p className="text-[11px] text-[var(--text-dim)] px-0.5">Learn investing with us</p>
        {links}
      </div>
    )
  }
  return (
    <div className={`rounded-xl border border-pink-500/20 p-4 space-y-3 ${className}`}
      style={{ background: 'linear-gradient(135deg, rgba(239,68,68,0.06) 0%, rgba(236,72,153,0.06) 100%)' }}>
      <div>
        <p className="text-sm font-semibold text-[var(--text-primary)]">Follow Capital Friends</p>
        <p className="text-xs text-[var(--text-dim)] mt-0.5">Simple videos on mutual funds, retirement and family money – and how to use this app.</p>
      </div>
      {links}
    </div>
  )
}
