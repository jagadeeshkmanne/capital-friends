import { useState, useEffect } from 'react'

const LOGO_SMALL = '/logo-small.png'

const STEPS = [
  { key: 'auth', label: 'Signing in' },
  { key: 'data', label: 'Loading your data' },
  { key: 'health', label: 'Checking health status' },
  { key: 'ready', label: 'Almost ready' },
]

export default function BrandedLoading({ phase = 'auth' }) {
  const [dots, setDots] = useState('')

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((d) => (d.length >= 3 ? '' : d + '.'))
    }, 500)
    return () => clearInterval(interval)
  }, [])

  const currentIdx = STEPS.findIndex((s) => s.key === phase)

  return (
    <div className="flex h-dvh items-center justify-center bg-[var(--bg-base)]">
      <div className="flex flex-col items-center gap-8">
        <img src={LOGO_SMALL} alt="Capital Friends" className="h-16 w-16 animate-pulse" />
        <div className="flex flex-col items-center gap-4 min-w-[220px]">
          {STEPS.map((step, i) => {
            const isActive = i === currentIdx
            const isDone = i < currentIdx
            return (
              <div key={step.key} className="flex items-center gap-3 w-full">
                <div className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium transition-all duration-300 ${
                  isDone
                    ? 'bg-green-500 text-white'
                    : isActive
                      ? 'bg-violet-500 text-white animate-pulse'
                      : 'bg-[var(--border)] text-[var(--text-muted)]'
                }`}>
                  {isDone ? '\u2713' : i + 1}
                </div>
                <span className={`text-sm transition-all duration-300 ${
                  isDone
                    ? 'text-green-400'
                    : isActive
                      ? 'text-[var(--text-primary)] font-medium'
                      : 'text-[var(--text-muted)]'
                }`}>
                  {step.label}{isActive ? dots : isDone ? '' : ''}
                </span>
              </div>
            )
          })}
          <div className="w-full h-1 rounded-full bg-[var(--border)] overflow-hidden mt-2">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-500 transition-all duration-500 ease-out"
              style={{ width: `${((currentIdx + 1) / STEPS.length) * 100}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
