import { useState, useEffect } from 'react'

const LOGO_ICON = `${import.meta.env.BASE_URL}logo-new.png`

const STEPS = [
  { text: 'Signing you in…',                              pct: 5 },
  { text: 'Creating your spreadsheet in Google Drive…',   pct: 18 },
  { text: 'Setting up investment tracking sheets…',       pct: 35 },
  { text: 'Configuring goals & family profiles…',         pct: 50 },
  { text: 'Setting up insurance & liabilities…',          pct: 65 },
  { text: 'Importing your portfolio data…',               pct: 80 },
  { text: 'Almost ready — finalizing setup…',             pct: 92 },
  { text: 'Hang tight, this only happens once!',          pct: 97 },
]
const DELAYS = [0, 5000, 13000, 21000, 29000, 37000, 45000, 53000]

export default function BrandedLoading({ phase }) {
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (phase !== 'data') return
    const timers = DELAYS.slice(1).map((delay, i) =>
      setTimeout(() => setStep(i + 1), delay)
    )
    return () => timers.forEach(clearTimeout)
  }, [phase])

  const isSetup = phase === 'data'
  const pct = isSetup ? STEPS[step].pct : null

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#080d1a' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28, padding: '0 24px', textAlign: 'center', maxWidth: 320, width: '100%' }}>

        {/* Logo */}
        <img src={LOGO_ICON} alt="Capital Friends" style={{ height: 64, width: 'auto', opacity: 0.9 }}
          onError={e => { e.target.style.display = 'none' }} />

        {/* Progress bar */}
        <div style={{ width: '100%', maxWidth: 220 }}>
          <div style={{ height: 4, borderRadius: 4, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
            {isSetup ? (
              <div style={{ height: '100%', borderRadius: 4, background: 'linear-gradient(to right,#7c3aed,#0891b2)', width: `${pct}%`, transition: 'width 1.2s ease' }} />
            ) : (
              <div style={{ height: '100%', borderRadius: 4, background: 'linear-gradient(to right,#7c3aed,#0891b2)', animation: 'loading-bar 1.5s ease-in-out infinite' }} className="animate-loading-bar" />
            )}
          </div>
          {isSetup && (
            <div style={{ marginTop: 6, fontSize: 11, color: '#475569', textAlign: 'right' }}>{pct}%</div>
          )}
        </div>

        {/* Message */}
        <div>
          {isSetup ? (
            <>
              <p style={{ fontSize: 13.5, color: '#94a3b8', margin: 0, lineHeight: 1.5 }}>
                {STEPS[step].text}
              </p>
              {step >= 1 && (
                <p style={{ fontSize: 11.5, color: '#334155', marginTop: 8, lineHeight: 1.5 }}>
                  Setting up your private Google Sheet.<br />This only happens once.
                </p>
              )}
            </>
          ) : (
            <p style={{ fontSize: 13.5, color: '#94a3b8', margin: 0, lineHeight: 1.5 }}>
              Connecting to Google…
            </p>
          )}
        </div>

        {/* App name */}
        <p style={{ fontSize: 12, color: '#1e293b', margin: 0, letterSpacing: '0.05em' }}>
          <b style={{ color: '#fff', fontWeight: 700 }}>Capital</b>{' '}
          <em style={{ color: '#34d399', fontWeight: 800, fontStyle: 'normal' }}>Friends</em>
        </p>
      </div>
    </div>
  )
}
