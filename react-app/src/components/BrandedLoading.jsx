const LOGO_SMALL = '/logo-small.png'

export default function BrandedLoading() {
  return (
    <div className="flex h-dvh items-center justify-center bg-[var(--bg-base)]">
      <div className="flex flex-col items-center gap-6">
        <img src={LOGO_SMALL} alt="Capital Friends" className="h-16 w-16 animate-pulse" />
        <div className="flex flex-col items-center gap-2">
          <div className="w-48 h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-500 animate-loading-bar" />
          </div>
          <p className="text-sm text-[var(--text-muted)]">Loading your portfolio...</p>
        </div>
      </div>
    </div>
  )
}
