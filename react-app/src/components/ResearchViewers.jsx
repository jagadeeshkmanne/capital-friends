import { useEffect, useState } from 'react'
import { useToast } from '../context/ToastContext'
import { getResearchViewers, setResearchViewers } from '../services/api'

/** Admin: the emails that may open the Fund rule and Stock rule pages (read-only). One list, kept on the server; shown on both pages. */
export default function ResearchViewers() {
  const { showToast } = useToast()
  const [list, setList] = useState(null); const [text, setText] = useState(''); const [busy, setBusy] = useState(false)
  useEffect(() => { getResearchViewers().then((r) => { setList(r.viewers || []); setText((r.viewers || []).join('\n')) }).catch(() => setList([])) }, [])
  const save = async () => {
    setBusy(true)
    try { const r = await setResearchViewers(text.split(/[\s,;]+/).filter(Boolean)); setList(r.viewers || []); setText((r.viewers || []).join('\n')); showToast('Viewers saved') }
    catch (e) { showToast(e.message || 'Could not save', 'error') } finally { setBusy(false) }
  }
  return (
    <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] overflow-hidden">
      <div className="px-4 py-2.5 border-b border-[var(--border-light)] flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-sm font-bold text-[var(--text-primary)]">Who else can see these pages</h3>
        <span className="text-xs text-[var(--text-dim)]">{list ? `${list.length} viewer${list.length === 1 ? '' : 's'}` : 'loading…'} · they get Fund rule + Stock rule, read-only; Found us stays yours</span>
      </div>
      <div className="px-4 py-3 grid gap-2 md:grid-cols-[1fr_auto] items-start">
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="one email per line" className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-input)] px-2.5 py-1.5 text-sm text-[var(--text-primary)]" />
        <button onClick={save} disabled={busy || list == null} className="px-3 py-1.5 rounded-lg bg-sky-500/20 border border-sky-500/40 text-sky-300 text-xs font-semibold disabled:opacity-50">{busy ? 'Saving…' : 'Save viewers'}</button>
      </div>
      <p className="px-4 pb-3 text-[11px] text-[var(--text-dim)]">They must sign in to Capital Friends with that Google account; the pages then appear under a "Research · shared with you" menu. Their own portfolios are never shown here.</p>
    </div>
  )
}
