// Did the rule's sales save or miss money? The line above a paper book's trades (Stock rule and Fund rule pages), from
// utils/tradeOutcome: the price after each sale, up to its buy-back or, while not bought back, up to the price now.

const inr = (v) => '₹' + Math.round(Math.abs(v)).toLocaleString('en-IN')
/** A fraction as a signed percent: 0.018 -> "+1.8%", small moves with 2 decimals (0.0004 -> "+0.04%"). */
export const pc = (f) => (f == null ? '—' : (f > 0 ? '+' : f < 0 ? '−' : '') + Math.abs(f * 100).toFixed(Math.abs(f) < 0.01 ? 2 : 1) + '%')
/** After a sale a rise is a gain missed (red), a fall a loss saved (green); a tiny move is neither. */
export const saleTone = (f) => (f == null || Math.abs(f) < 0.0005 ? 'text-[var(--text-muted)]' : f > 0 ? 'text-[var(--accent-rose)]' : 'text-emerald-400')
export const saleWord = (f) => (f == null || Math.abs(f) < 0.0005 ? '' : f > 0 ? 'missed' : 'saved')

/** items: [{ label, s }] with s from salesSummary (null items are skipped). */
export default function SalesCheck({ items, note }) {
  const list = (items || []).filter((x) => x && x.s)
  if (!list.length) return null
  return (
    <div className="px-4 py-2 border-b border-[var(--border-light)] text-xs">
      <div className="flex flex-wrap gap-x-6 gap-y-1">
        {list.map(({ label, s }) => (
          <span key={label}>
            <span className="text-[var(--text-dim)]">{label}: </span>
            <span className={`font-semibold tabular-nums ${saleTone(s.pct)}`}>{pc(s.pct)}{saleWord(s.pct) ? ` · ${saleWord(s.pct)} ${inr(s.amt)}` : ' · no change'}</span>
          </span>))}
      </div>
      {note && <p className="mt-0.5 text-[11px] text-[var(--text-dim)]">{note}</p>}
    </div>
  )
}
