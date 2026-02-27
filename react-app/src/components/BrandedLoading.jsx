const LOGO_ICON = `${import.meta.env.BASE_URL}logo-new.png`

export default function BrandedLoading() {
  return (
    <div className="flex h-dvh items-center justify-center bg-[var(--bg-base)]">
      <div className="flex flex-col items-center gap-6">
        <img src={LOGO_ICON} alt="Capital Friends" className="h-16 w-auto animate-pulse" />
        <div className="w-40 h-1 rounded-full bg-[var(--border)] overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-500 animate-loading-bar" />
        </div>
      </div>
    </div>
  )
}
