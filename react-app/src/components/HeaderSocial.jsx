import { Youtube, Instagram } from 'lucide-react'
import { YOUTUBE_URL, INSTAGRAM_URL } from './FollowCard'

// YouTube + Instagram in the top bar.
// Phones: two brand-coloured round buttons with a soft glow.
// Desktop: one quiet segmented chip (brand-coloured icons, neutral text) with a small live dot on YouTube.
export default function HeaderSocial() {
  const circle = 'hs-btn relative flex items-center justify-center h-8 w-8 rounded-full text-white no-underline active:scale-95 transition-transform'
  const seg = 'group flex items-center gap-1.5 h-7 px-3 rounded-full text-[12.5px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors no-underline'
  return (
    <>
      <style>{`
        .hs-btn{overflow:hidden;isolation:isolate}
        .hs-btn::after{content:'';position:absolute;inset:0 auto 0 -70%;width:45%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.45),transparent);transform:skewX(-20deg);animation:hsShine 5s ease-in-out infinite;z-index:-1}
        .hs-ig::after{animation-delay:2.5s}
        .hs-yt{background:linear-gradient(135deg,#ff2d2d,#c4000f);animation:hsGlowYt 3.2s ease-in-out infinite}
        .hs-ig{background:linear-gradient(45deg,#f58529,#dd2a7b 55%,#8134af);animation:hsGlowIg 3.2s ease-in-out infinite 1.6s}
        @keyframes hsShine{0%,65%{left:-70%}100%{left:140%}}
        @keyframes hsGlowYt{0%,100%{box-shadow:0 0 0 0 rgba(255,45,45,0)}50%{box-shadow:0 0 16px 2px rgba(255,45,45,.55)}}
        @keyframes hsGlowIg{0%,100%{box-shadow:0 0 0 0 rgba(221,42,123,0)}50%{box-shadow:0 0 16px 2px rgba(221,42,123,.5)}}
        .hs-seg{background:var(--bg-inset);border:1px solid var(--border);box-shadow:inset 0 1px 0 rgba(255,255,255,.03)}
        .hs-seg-yt:hover{background:rgba(255,45,45,.10)}
        .hs-seg-ig:hover{background:rgba(221,42,123,.10)}
        @media (prefers-reduced-motion:reduce){.hs-btn,.hs-btn::after,.hs-ping{animation:none}}
      `}</style>

      {/* Phones */}
      <div className="flex sm:hidden items-center gap-1.5 mr-0.5">
        <a href={YOUTUBE_URL} target="_blank" rel="noopener noreferrer" aria-label="Capital Friends on YouTube" className={`${circle} hs-yt`}>
          <Youtube size={16} strokeWidth={2.4} />
          <span className="absolute top-1 right-1 flex h-1.5 w-1.5">
            <span className="hs-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75 animate-ping" />
            <span className="relative inline-flex h-full w-full rounded-full bg-white" />
          </span>
        </a>
        <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" aria-label="Follow on Instagram" className={`${circle} hs-ig`}>
          <Instagram size={16} strokeWidth={2.4} />
        </a>
      </div>

      {/* Desktop */}
      <div className="hs-seg hidden sm:flex items-center p-0.5 rounded-full mr-1">
        <a href={YOUTUBE_URL} target="_blank" rel="noopener noreferrer" title="Watch Capital Friends on YouTube" className={`${seg} hs-seg-yt`}>
          <Youtube size={16} className="text-[#ff3b3b] transition-transform group-hover:scale-110" />
          YouTube
          <span className="relative flex h-1.5 w-1.5 ml-0.5" aria-hidden="true">
            <span className="hs-ping absolute inline-flex h-full w-full rounded-full bg-[#ff3b3b] opacity-70 animate-ping" />
            <span className="relative inline-flex h-full w-full rounded-full bg-[#ff3b3b]" />
          </span>
        </a>
        <span className="w-px h-4 bg-[var(--border)]" aria-hidden="true" />
        <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" title="Follow on Instagram" className={`${seg} hs-seg-ig`}>
          <Instagram size={15} className="text-[#e1306c] transition-transform group-hover:scale-110" />
          Instagram
        </a>
      </div>
    </>
  )
}
