import { useEffect, useRef, useState } from 'react'
import { RefreshCw, X, CheckCircle2 } from 'lucide-react'
import * as api from '../services/api'

// Shown only when this user's daily background jobs (fund price update + daily email) are not set up.
// Google needs each user to switch them on once with a click, so we ask in plain words.
const LATER_KEY = 'cf_daily_updates_later'
const LATER_DAYS = 3

function snoozed() {
  try {
    const t = +localStorage.getItem(LATER_KEY)
    return t && Date.now() - t < LATER_DAYS * 24 * 3600 * 1000
  } catch { return false }
}

export default function DailyUpdatesBanner() {
  const [state, setState] = useState('hidden') // hidden | ask | waiting | done
  const pollRef = useRef(null)

  async function needsSetup() {
    const s = await api.getDailyJobsStatus()
    if (!s || s.unknown) return false // can't tell: never nag
    return !s.sync || (s.emailConfigured && !s.email)
  }

  useEffect(() => {
    if (snoozed()) return
    let alive = true
    // Wait a little so the dashboard loads first
    const t = setTimeout(() => {
      needsSetup().then((need) => { if (alive && need) setState('ask') }).catch(() => {})
    }, 4000)
    return () => { alive = false; clearTimeout(t); clearInterval(pollRef.current) }
  }, [])

  function turnOn() {
    api.installUserTriggers() // opens Google's small one-time window (needs this click, or browsers block it)
    setState('waiting')
    let tries = 0
    clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      tries++
      try {
        if (!(await needsSetup())) {
          clearInterval(pollRef.current)
          setState('done')
          setTimeout(() => setState('hidden'), 4000)
          return
        }
      } catch {}
      if (tries >= 30) { clearInterval(pollRef.current); setState('ask') } // ~90 s: let them try again
    }, 3000)
  }

  function later() {
    try { localStorage.setItem(LATER_KEY, String(Date.now())) } catch {}
    clearInterval(pollRef.current)
    setState('hidden')
  }

  if (state === 'hidden') return null

  if (state === 'done') {
    return (
      <div className="mb-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 flex items-center gap-2.5">
        <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
        <p className="text-sm font-medium text-[var(--text-primary)]">All set! Your fund values will now update every day.</p>
      </div>
    )
  }

  return (
    <div className="mb-3 relative rounded-xl border border-violet-500/30 p-3.5" style={{ background: 'var(--bg-card)' }}>
      <button onClick={later} aria-label="Remind me later"
        className="absolute top-2 right-2 p-1 rounded-full hover:bg-[var(--bg-hover)] transition-colors">
        <X size={14} className="text-[var(--text-dim)]" />
      </button>
      <div className="flex items-start gap-3 pr-6">
        <div className="w-10 h-10 rounded-xl bg-violet-500/15 flex items-center justify-center shrink-0">
          <RefreshCw size={20} className={`text-violet-400 ${state === 'waiting' ? 'animate-spin' : ''}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[var(--text-primary)]">Keep your fund values up to date</p>
          <p className="text-xs text-[var(--text-dim)] mt-0.5">
            {state === 'waiting'
              ? 'A small Google window has opened. Allow it there — this takes a few seconds.'
              : 'Let Capital Friends update your mutual fund prices every day and send your daily summary email, even when the app is closed. You only need to do this once.'}
          </p>
          {state === 'ask' && (
            <div className="flex items-center gap-2 mt-2.5">
              <button onClick={turnOn}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-violet-600 hover:bg-violet-500 text-white transition-colors">
                Turn on daily updates
              </button>
              <button onClick={later}
                className="px-3 py-1.5 text-xs font-medium rounded-lg text-[var(--text-dim)] hover:bg-[var(--bg-hover)] transition-colors">
                Later
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
