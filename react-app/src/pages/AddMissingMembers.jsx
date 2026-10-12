import { useMemo, useState } from 'react'
import { Loader2, UserPlus } from 'lucide-react'
import { useData } from '../context/DataContext'
import { useAuth } from '../context/AuthContext'

// The CAS statement names people who are not in Family yet: add them here in one go, then check again.
// The same person often appears twice ("Jagadeesh Kumar Manne" and "MANNE JAGADEESH KUMAR"): grouped by
// name words (order and case don't matter) and, if the PAN is the same, by one name being part of the other.

const RELS = ['Self', 'Spouse', 'Son', 'Daughter', 'Father', 'Mother', 'Brother', 'Sister', 'Other']
const tokens = (s) => String(s || '').toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter((t) => t.length > 1)
const uniq = (a) => [...new Set(a)]
const title = (s) => String(s || '').toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase()).replace(/\s+/g, ' ').trim()
const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || '').trim())
const KIDS = ['Son', 'Daughter']

/** Group the statement's missing holder names into people. Exported for tests. */
export function groupHolders(missing, folios) {
  const panOf = {}
  ;(folios || []).forEach((f) => {
    const k = String(f.holder || '').toUpperCase()
    if (f.pan) (panOf[k] = panOf[k] || new Set()).add(String(f.pan).toUpperCase())
  })
  const people = []
  for (const m of missing || []) {
    const t = uniq(tokens(m.holder)).sort()
    const pans = panOf[String(m.holder || '').toUpperCase()] || new Set()
    const same = people.find((p) => {
      if (p.key === t.join(' ')) return true
      const sub = t.every((x) => p.tokens.includes(x)) || p.tokens.every((x) => t.includes(x))
      return sub && [...pans].some((x) => p.pans.has(x))
    })
    if (same) {
      same.names.push(m.holder); same.folios += m.folios || 0
      pans.forEach((x) => same.pans.add(x))
      if (t.length > same.tokens.length) { same.tokens = t; same.key = t.join(' ') }
    } else people.push({ key: t.join(' '), tokens: t, names: [m.holder], pans: new Set(pans), folios: m.folios || 0 })
  }
  // suggested name: the longest one written in normal case ("Jagadeesh Kumar Manne"), else the longest, in title case
  people.forEach((p) => {
    const byLen = [...p.names].sort((a, b) => tokens(b).length - tokens(a).length)
    p.name = title(byLen.find((n) => n !== n.toUpperCase()) || byLen[0])
  })
  return people
}

export default function AddMissingMembers({ missing, folios, statementEmail, onDone }) {
  const { addMember, members } = useData()
  const { user } = useAuth()
  const me = String(user?.email || '').trim().toLowerCase()
  const people = useMemo(() => groupHolders(missing, folios), [missing, folios])
  const hasSelf = (members || []).some((m) => m.relationship === 'Self' && m.status !== 'Inactive')
  const mostFolios = people.reduce((b, p) => (!b || p.folios > b.folios ? p : b), null)
  const stmt = String(statementEmail || '').trim().toLowerCase()
  const emailFor = (rel) => (rel === 'Spouse' ? (stmt && stmt !== me ? stmt : '') : me)
  const [rows, setRows] = useState(() => people.map((p) => {
    const rel = !hasSelf && p === mostFolios ? 'Self' : ''
    return { key: p.key, name: p.name, names: p.names, rel, email: rel ? emailFor(rel) : me, emailEdited: false }
  }))
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const set = (i, patch) => setRows((rs) => rs.map((r, j) => {
    if (j !== i) return r
    const n = { ...r, ...patch }
    if (patch.rel && !r.emailEdited) n.email = emailFor(patch.rel)
    return n
  }))
  const selfCount = rows.filter((r) => r.rel === 'Self').length + (hasSelf ? 1 : 0)
  const problem = rows.some((r) => !r.name.trim()) ? 'Each person needs a name.'
    : rows.some((r) => !r.rel) ? 'Pick how each person is related to you.'
      : rows.some((r) => !isEmail(r.email)) ? 'Each person needs an email (kids can use yours).'
        : selfCount > 1 ? 'Only one person can be "Self".' : ''

  async function addAll() {
    if (problem) { setErr(problem); return }
    setSaving(true); setErr('')
    try {
      for (const r of rows) {
        const email = r.email.trim()
        // kids and anyone using your own email: no daily email of their own and no sharing invite
        const own = email.toLowerCase() === me
        await addMember({ memberName: r.name.trim(), relationship: r.rel, email, includeInEmailReports: !KIDS.includes(r.rel) && (r.rel === 'Self' || !own), pan: '', aadhar: '', mobile: '', dynamicFields: {} })
      }
      onDone?.()
    } catch (e) { setErr(e.message || 'Could not add the family members') }
    finally { setSaving(false) }
  }

  const inp = 'w-full px-2.5 py-2 text-sm rounded-lg bg-[var(--bg-card)] border border-[var(--border-light)] text-[var(--text-primary)]'
  return (
    <div className="rounded-lg border border-[var(--border-light)] bg-[var(--bg-card)] p-3 space-y-3">
      <div>
        <p className="text-sm font-semibold text-[var(--text-primary)]">Add {rows.length === 1 ? 'this person' : `these ${rows.length} people`} to your family</p>
        <p className="text-xs text-[var(--text-dim)]">From your statement. Check the name, pick the relationship, and we add them for you.</p>
      </div>
      {rows.map((r, i) => (
        <div key={r.key} className="grid grid-cols-1 sm:grid-cols-[1.4fr_1fr_1.4fr] gap-2 pb-3 border-b border-[var(--border-light)] last:border-0 last:pb-0">
          <div>
            <input className={inp} value={r.name} onChange={(e) => set(i, { name: e.target.value })} aria-label="Name" />
            {r.names.length > 1 && <p className="text-[11px] text-[var(--text-dim)] mt-1">Same person on the statement as: {r.names.join(' · ')}</p>}
          </div>
          <select className={inp} value={r.rel} onChange={(e) => set(i, { rel: e.target.value })} aria-label="Relationship">
            <option value="">Relationship…</option>
            {RELS.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
          <div>
            <input className={inp} type="email" value={r.email} onChange={(e) => set(i, { email: e.target.value, emailEdited: true })} placeholder="Email" aria-label="Email" />
            {KIDS.includes(r.rel) && <p className="text-[11px] text-[var(--text-dim)] mt-1">Kids can use your email. They get no daily email.</p>}
            {r.rel === 'Spouse' && <p className="text-[11px] text-[var(--text-dim)] mt-1">Their own email: they get the daily email and can sign in.</p>}
          </div>
        </div>
      ))}
      {(err || problem) && <p className="text-xs text-[var(--accent-rose,#f43f5e)]">{err || problem}</p>}
      <button onClick={addAll} disabled={saving || !!problem}
        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-semibold">
        {saving ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
        {saving ? 'Adding…' : `Add to family and check again`}
      </button>
      <p className="text-[11px] text-[var(--text-dim)]">PAN, Aadhaar and mobile are not saved. You can add them later in Family if you want.</p>
    </div>
  )
}
