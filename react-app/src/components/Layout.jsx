import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Header from './Header'
import BottomNav from './BottomNav'
import BrandedLoading from './BrandedLoading'
import { useData } from '../context/DataContext'
import { Heart, Check } from 'lucide-react'

const UPI_ID = 'jagadeeshmanne.hdfc@kphdfc'

export default function Layout() {
  const { loading, error } = useData()
  const [upiCopied, setUpiCopied] = useState(false)

  function copyUPI() {
    navigator.clipboard.writeText(UPI_ID).then(() => {
      setUpiCopied(true)
      setTimeout(() => setUpiCopied(false), 2000)
    })
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
      {/* Header spans full width — includes nav, ticker, NW breakdown */}
      <Header />

      {/* Content — full width, no sidebar on desktop */}
      <main className="flex-1 overflow-y-auto overscroll-contain pb-20 lg:pb-0">
        <div className="px-3 sm:px-4 py-3 sm:py-4 w-full max-w-7xl mx-auto">
          <Outlet />
        </div>

        {/* Desktop-only subtle footer */}
        <footer className="hidden lg:block border-t border-[var(--border-light)] mt-4">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
            <p className="text-[11px] text-[var(--text-dim)]">
              Capital Friends — Family Portfolio Manager
            </p>
            <button
              onClick={copyUPI}
              className="flex items-center gap-1.5 text-[11px] text-[var(--text-dim)] hover:text-pink-400 transition-colors group"
            >
              <Heart size={12} className="text-pink-400/50 group-hover:text-pink-400 transition-colors" />
              {upiCopied ? (
                <span className="flex items-center gap-1 text-pink-400"><Check size={10} /> UPI Copied!</span>
              ) : (
                <span>Support the Developer</span>
              )}
            </button>
          </div>
        </footer>
      </main>

      <BottomNav />
    </div>
  )
}
