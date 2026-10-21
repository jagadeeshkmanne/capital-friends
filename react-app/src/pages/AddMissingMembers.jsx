import { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, CheckCircle2 } from 'lucide-react'
import { useData } from '../context/DataContext'
import { useAuth } from '../context/AuthContext'
import { useMask } from '../context/MaskContext'
import { nameFit } from '../utils/nameMatch'

// The CAS statement names people who are not in Family yet: add them here in one go, then check again.
// The same person often appears twice ("Jagadeesh Kumar Manne" and "MANNE JAGADEESH KUMAR"): grouped by
// name words (order and case don't matter) and, if the PAN is the same, by one name being part of the other.

const tokens = (s) => String(s || '').toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter((t) => t.length > 1)
const uniq = (a) => [...new Set(a)]
const title = (s) => String(s || '').toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase()).replace(/\s+/g, ' ').trim()

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
    // the same person written two ways in one statement ("J K MANNE", "Jagadeesh Kumar Manne"): names that fit
    // (utils/nameMatch) and share a PAN
    const same = people.find((p) => {
      if (p.key === t.join(' ')) return true
      return p.names.some((n) => nameFit(n, m.holder)) && [...pans].some((x) => p.pans.has(x))
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

/**
 * Defaults for people found on the statement who are not in Family yet (exported for tests).
 * Nothing to pick: the person whose statement email is the signed-in account (else the one with most folios)
 * becomes Self when there is no Self yet; everyone else is "Other" (change it in Family later). Email is yours
 * for everyone (a spouse's own email from the statement when it differs), daily email on for Self only.
 */
export function defaultRows(people, { hasSelf, me, statementEmail }) {
  const stmt = String(statementEmail || '').trim().toLowerCase()
  const most = people.reduce((b, p) => (!b || p.folios > b.folios ? p : b), null)
  return people.map((p) => {
    const rel = !hasSelf && p === most ? 'Self' : 'Other'
    return { key: p.key, name: p.name, names: p.names, rel, email: rel === 'Self' ? (me || stmt) : (me || stmt), report: rel === 'Self' }
  })
}

// Adds them by itself (no form): a live list of what is being created, then the import check runs again.
export default function AddMissingMembers({ missing, folios, statementEmail, onDone }) {
  const { addMember, members } = useData()
  const { user } = useAuth()
  const { masked } = useMask()
  const blur = masked ? ' sensitive-blur' : ''
  const me = String(user?.email || '').trim().toLowerCase()
  const people = useMemo(() => groupHolders(missing, folios), [missing, folios])
  const hasSelf = (members || []).some((m) => m.relationship === 'Self' && m.status !== 'Inactive')
  const rows = useMemo(() => defaultRows(people, { hasSelf, me, statementEmail }), [people, hasSelf, me, statementEmail])
  // PAN saved with the new member (next imports then match for sure): only the person's single PAN, and only when
  // no other holder on the statement or member in Family has it (a minor's old folios carry the parent's PAN)
  const panFor = useMemo(() => {
    const holdersOf = {}
    ;(folios || []).forEach((f) => { const p = String(f.pan || '').toUpperCase(); if (p) (holdersOf[p] = holdersOf[p] || new Set()).add(String(f.holder || '').toUpperCase()) })
    const taken = new Set((members || []).map((m) => String(m.pan || '').toUpperCase()).filter(Boolean))
    const out = {}
    people.forEach((p) => {
      if (p.pans.size !== 1) return
      const pan = [...p.pans][0].toUpperCase()
      const mine = new Set(p.names.map((n) => String(n).toUpperCase()))
      if (!taken.has(pan) && [...(holdersOf[pan] || [])].every((h) => mine.has(h))) out[p.key] = pan
    })
    return out
  }, [people, folios, members])
  const [done, setDone] = useState([])      // keys added so far
  const [err, setErr] = useState('')
  const started = useRef(false)

  useEffect(() => {
    if (started.current || !rows.length) return
    started.current = true
    ;(async () => {
      try {
        for (const r of rows) {
          await addMember({ memberName: r.name.trim(), relationship: r.rel, email: r.email, includeInEmailReports: !!r.report, pan: panFor[r.key] || '', aadhar: '', mobile: '', dynamicFields: {} })
          setDone((d) => [...d, r.key])
        }
        onDone?.()
      } catch (e) { setErr(e.message || 'Could not add the family members') }
    })()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="rounded-lg border border-[var(--border-light)] bg-[var(--bg-card)] p-3 space-y-2">
      <p className="text-sm font-semibold text-[var(--text-primary)]">Adding {rows.length === 1 ? 'one person' : `${rows.length} people`} from your statement to Family</p>
      <ul className="space-y-1">
        {rows.map((r) => {
          const ok = done.includes(r.key)
          return (
            <li key={r.key} className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
              {ok ? <CheckCircle2 size={16} className="text-emerald-500 shrink-0" /> : <Loader2 size={16} className="animate-spin text-[var(--text-dim)] shrink-0" />}
              <span className={blur}>{r.name}</span>
              <span className="text-xs text-[var(--text-dim)]">· {r.rel === 'Self' ? 'you' : 'family member'}{r.report ? ' · daily email on' : ''}</span>
            </li>
          )
        })}
      </ul>
      {err && <p className="text-xs text-[var(--accent-rose,#f43f5e)]">{err}</p>}
      <p className="text-[11px] text-[var(--text-dim)]">Relationship, email, PAN and the daily email can be changed any time in Family. Investment accounts and portfolios are created with the import.</p>
    </div>
  )
}
