// Phones (< 1024px): one Groww-style summary card instead of a grid of small stat boxes.
//   label: 'STOCKS (6)'   value: '₹2.64 L' (big)   rows: [{ k: 'Invested', v: '₹2.45 L', cls?: 'text-emerald-400' }]
// Shown only below lg; the page keeps its stat boxes on laptops (wrap those in max-lg:hidden).
export default function PhoneSummary({ label, value, rows = [], right, className = '' }) {
  return (
    <div className={`lg:hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] px-4 pt-4 pb-2 ${className}`}>
      {(label || value) && (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {label && <div className="text-[12px] font-semibold tracking-[0.14em] uppercase text-[var(--text-dim)]">{label}</div>}
            {value != null && <div className="mt-0.5 text-[28px] font-bold tracking-tight tabular-nums text-[var(--text-primary)] leading-tight">{value}</div>}
          </div>
          {right}
        </div>
      )}
      {(label || value) && rows.length > 0 && <div className="my-2 border-t border-dashed border-[var(--border-light)]" />}
      {rows.filter(Boolean).map((r) => (
        <div key={r.k} className="flex items-baseline justify-between gap-3 py-[7px]">
          <span className="text-[15px] text-[var(--text-secondary)]">{r.k}</span>
          <span className={`text-[15px] font-semibold tabular-nums text-right ${r.cls || 'text-[var(--text-primary)]'}`}>{r.v}</span>
        </div>
      ))}
    </div>
  )
}
