export default function PageLoading({ title = 'Loading', cards = 4 }) {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Title shimmer */}
      <div className="h-7 w-48 rounded-lg bg-[var(--bg-card)]" />

      {/* Stat cards shimmer */}
      <div className={`grid gap-3 ${cards <= 3 ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2 sm:grid-cols-4'}`}>
        {Array.from({ length: cards }).map((_, i) => (
          <div key={i} className="rounded-xl bg-[var(--bg-card)] border border-[var(--border)] p-4">
            <div className="h-3 w-16 rounded bg-[var(--bg-inset)] mb-3" />
            <div className="h-6 w-24 rounded bg-[var(--bg-inset)]" />
          </div>
        ))}
      </div>

      {/* Table shimmer */}
      <div className="rounded-xl bg-[var(--bg-card)] border border-[var(--border)] overflow-hidden">
        {/* Header row */}
        <div className="flex gap-4 px-4 py-3 border-b border-[var(--border-light)]">
          {[120, 80, 60, 80, 60].map((w, i) => (
            <div key={i} className="h-3 rounded bg-[var(--bg-inset)]" style={{ width: w }} />
          ))}
        </div>
        {/* Data rows */}
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-4 px-4 py-3.5 border-b border-[var(--border-light)] last:border-0">
            {[140, 70, 50, 70, 50].map((w, j) => (
              <div key={j} className="h-3 rounded bg-[var(--bg-inset)] opacity-60" style={{ width: w }} />
            ))}
          </div>
        ))}
      </div>

      {/* Subtle loading text */}
      <p className="text-xs text-[var(--text-dim)] text-center">{title}...</p>
    </div>
  )
}
