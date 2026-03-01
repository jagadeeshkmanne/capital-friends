import { useState } from 'react'
import { Outlet, Link } from 'react-router-dom'
import Header from './Header'
import BottomNav from './BottomNav'
import BrandedLoading from './BrandedLoading'
import DonateDialog from './DonateDialog'
import { useData } from '../context/DataContext'
import { Heart, X } from 'lucide-react'

export default function Layout() {
  const { loading, error } = useData()
  const [showDonate, setShowDonate] = useState(false)

  // Show donate banner once per browser session
  const [bannerDismissed, setBannerDismissed] = useState(() => {
    try { return sessionStorage.getItem('cf_donate_dismissed') === '1' } catch { return false }
  })

  function dismissBanner() {
    setBannerDismissed(true)
    try { sessionStorage.setItem('cf_donate_dismissed', '1') } catch {}
  }

  if (loading) {
    return <BrandedLoading />
  }

  if (error) {
    return (
      <div className="flex h-dvh items-center justify-center bg-[var(--bg-base)]">
        <div className="flex flex-col items-center gap-4 text-center px-6">
          <img src={`${import.meta.env.BASE_URL}logo-new.png`} alt="Capital Friends" className="h-16 w-auto opacity-50" />
          <p className="text-rose-400 text-sm font-medium">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-violet-600 hover:bg-violet-500 text-white transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-dvh bg-[var(--bg-base)] overflow-hidden">
      <Header />

      <main className="flex-1 overflow-y-auto overscroll-contain pb-20 lg:pb-0">
        <div className="px-3 sm:px-4 py-3 sm:py-4 w-full max-w-7xl mx-auto">
          <Outlet />
        </div>

        {/* Global footer — all pages */}
        <footer className="border-t border-[var(--border-light)] mt-4">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
            {/* Branding */}
            <div className="flex items-center gap-2.5">
              <Link to="/about" className="flex items-center gap-1.5 no-underline shrink-0">
                <img src={`${import.meta.env.BASE_URL}logo-new.png`} alt="Capital Friends" className="h-5 w-auto" />
                <span style={{ fontFamily: "'Poppins', sans-serif", fontSize: '11px' }}>
                  <span className="font-bold text-[var(--text-primary)]">Capital</span>
                  <span className="font-extrabold text-emerald-400">Friends</span>
                </span>
                <span className="text-[9px] font-semibold text-[var(--text-dim)] px-1.5 py-0.5 rounded bg-[var(--bg-inset)] border border-[var(--border-light)]">v1.0</span>
              </Link>
              <span className="text-[var(--border)] text-[10px]">{'\u00B7'}</span>
              <p className="text-[10px] text-[var(--text-dim)]">
                Made with {'\u2764\uFE0F'} by <span className="font-semibold text-[var(--text-muted)]">Jagadeesh</span>
              </p>
            </div>
            {/* Donate */}
            <button onClick={() => { setShowDonate(true); dismissBanner() }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors shrink-0"
                    style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)' }}>
              <Heart size={12} className="text-amber-400" />
              <span className="text-[11px] font-semibold text-amber-400">Donate</span>
            </button>
          </div>
        </footer>
      </main>

      <BottomNav />

      {/* Floating banner — shows on every session, dismiss hides for this session */}
      {!bannerDismissed && (
        <div className="fixed bottom-20 lg:bottom-4 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-32px)] max-w-md">
          <div className="relative overflow-hidden rounded-xl border border-amber-500/25 p-3.5 shadow-lg backdrop-blur-sm"
               style={{ background: 'var(--bg-card)' }}>
            <button
              onClick={(e) => { e.stopPropagation(); dismissBanner() }}
              className="absolute top-2 right-2 p-1 rounded-full hover:bg-[var(--bg-hover)] transition-colors"
            >
              <X size={14} className="text-[var(--text-dim)]" />
            </button>
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => { setShowDonate(true); dismissBanner() }}>
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
                <Heart size={20} className="text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-[var(--text-dim)]">
                  Built with <span className="text-amber-400">{'\u2764'}</span> by Jagadeesh Manne
                </p>
                <p className="text-sm font-semibold text-amber-400 mt-0.5">Support the Developer</p>
                <p className="text-[11px] text-[var(--text-dim)] mt-0.5">If Capital Friends helps you, consider buying me a chai!</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <DonateDialog open={showDonate} onClose={() => setShowDonate(false)} />
    </div>
  )
}
