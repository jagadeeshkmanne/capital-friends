import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useGoalsPlan } from '../hooks/useGoalsPlan'
import { formatINR } from '../data/familyData'

const L = (v) => formatINR(Math.round(v || 0))
const today = () => new Date().toISOString().slice(0, 10)

/** One thin line on every page (not the Goals page, which shows the full message) while today's SIPs and
 *  investments can't reach the goals. × hides it for the rest of the day. */
export default function GoalsReachBanner() {
  const { todo } = useGoalsPlan()
  const { pathname } = useLocation()
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem('cf-goals-banner') === today() } catch { return false } })
  const b = todo?.banner
  if (!b || hidden || pathname === '/goals') return null
  const hide = () => { setHidden(true); try { localStorage.setItem('cf-goals-banner', today()) } catch { /* ignore */ } }
  return (
    <div className="mb-3 flex items-center gap-2 rounded-lg border px-3 py-2 text-[12.5px]"
      style={{ background: 'color-mix(in srgb, #f59e0b 10%, var(--bg-card))', borderColor: 'color-mix(in srgb, #f59e0b 35%, transparent)', color: 'var(--text-secondary)' }}>
      <span className="min-w-0 flex-1 truncate">⚠️ <b className="text-[var(--text-primary)]">Goals need {L(b.extraSip)}/month more</b><span className="hidden sm:inline"> than your SIPs today</span></span>
      <Link to="/goals" className="shrink-0 font-semibold" style={{ color: 'var(--accent-violet)' }}>See what to do ›</Link>
      <button onClick={hide} aria-label="Hide for today" className="shrink-0 px-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]">×</button>
    </div>
  )
}
