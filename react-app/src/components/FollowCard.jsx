import { Youtube, Instagram } from 'lucide-react'

export const YOUTUBE_URL = 'https://www.youtube.com/@capitalfriendsin'
export const INSTAGRAM_URL = 'https://www.instagram.com/jags.manne/'

// "Follow us" card: YouTube channel + Instagram. compact = two small buttons (sidebar), else a full card.
export default function FollowCard({ compact = false, className = '' }) {
  const btn = 'flex-1 flex items-center justify-center gap-1.5 rounded-lg font-semibold transition-colors no-underline'
  const links = (
    <div className="flex gap-2">
      <a href={YOUTUBE_URL} target="_blank" rel="noopener noreferrer"
        className={`${btn} ${compact ? 'px-2 py-1.5 text-[11px]' : 'px-3 py-2 text-xs'} bg-red-500/10 text-red-400 hover:bg-red-500/20`}>
        <Youtube size={compact ? 13 : 15} /> YouTube
      </a>
      <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer"
        className={`${btn} ${compact ? 'px-2 py-1.5 text-[11px]' : 'px-3 py-2 text-xs'} bg-pink-500/10 text-pink-400 hover:bg-pink-500/20`}>
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
