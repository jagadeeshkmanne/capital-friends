import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileUp, Lock, Loader2, CheckCircle2, AlertTriangle, XCircle, ChevronDown, ChevronRight, Undo2, ArrowRightLeft, Info, HelpCircle } from 'lucide-react'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import * as api from '../services/api'
import { readCasPdf, statementForServer } from '../utils/cas/casPdf'
import ImportHelp, { HowToStrip } from './ImportHelp'
import Modal from '../components/Modal'
import FollowCard from '../components/FollowCard'

// Import a CAMS consolidated statement (beta). Steps: choose PDF -> Check (nothing is written) -> Import.
const SAVED_KEY = 'cf_import_draft_v1'

function inr(n) {
  const v = Math.round(+n || 0), a = Math.abs(v), s = v < 0 ? '-' : ''
  if (a >= 1e7) return `${s}₹${(a / 1e7).toFixed(2)} Cr`
  if (a >= 1e5) return `${s}₹${(a / 1e5).toFixed(2)} L`
  return `${s}₹${a.toLocaleString('en-IN')}`
}
const units = (n) => (+n || 0).toLocaleString('en-IN', { maximumFractionDigits: 3 })
const fmtDate = (iso) => {
  if (!iso) return ''
  const d = new Date(iso + 'T00:00:00')
  return isNaN(d) ? iso : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function casUniqBy(list, key) {
  const seen = new Set()
  return list.filter((x) => { const k = key(x); if (seen.has(k)) return false; seen.add(k); return true })
}

function loadDraft() {
  try { const s = sessionStorage.getItem(SAVED_KEY); return s ? JSON.parse(s) : null } catch { return null }
}
function saveDraft(d) {
  try { if (d) sessionStorage.setItem(SAVED_KEY, JSON.stringify(d)); else sessionStorage.removeItem(SAVED_KEY) } catch { /* too big or blocked: fine */ }
}

function Card({ children, className = '' }) {
  return <div className={`rounded-xl border border-[var(--border-light)] bg-[var(--bg-card)] ${className}`}>{children}</div>
}
function Note({ tone = 'info', children }) {
  const t = {
    info: 'border-sky-500/30 bg-sky-500/10',
    warn: 'border-amber-500/30 bg-amber-500/10',
    bad: 'border-red-500/30 bg-red-500/10',
    good: 'border-emerald-500/30 bg-emerald-500/10',
  }[tone]
  const Icon = { info: Info, warn: AlertTriangle, bad: XCircle, good: CheckCircle2 }[tone]
  const ic = { info: 'text-sky-400', warn: 'text-amber-400', bad: 'text-red-400', good: 'text-emerald-400' }[tone]
  return (
    <div className={`rounded-lg border p-3 flex gap-2.5 ${t}`}>
      <Icon size={16} className={`${ic} shrink-0 mt-0.5`} />
      <div className="text-xs text-[var(--text-primary)] space-y-1 min-w-0">{children}</div>
    </div>
  )
}

function Step({ n, title, children, active, step }) {
  return (
    <Card className={`p-4 space-y-3 ${active ? 'ring-1 ring-violet-500/40' : ''}`}>
      <div className="flex items-center gap-2.5">
        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step > n ? 'bg-emerald-500/20 text-emerald-400' : active ? 'bg-violet-600 text-white' : 'bg-[var(--bg-hover)] text-[var(--text-dim)]'}`}>
          {step > n ? <CheckCircle2 size={14} /> : n}
        </span>
        <p className="text-sm font-semibold text-[var(--text-primary)]">{title}</p>
      </div>
      {children}
    </Card>
  )
}

export default function ImportStatementPage() {
  const { refreshData } = useData()
  const { showToast } = useToast()
  const draft = useMemo(loadDraft, [])

  const [enabled, setEnabled] = useState(null)
  const [showHelp, setShowHelp] = useState(false) // step-by-step guide, in a dialog
  const [status, setStatus] = useState(null)
  const [statusErr, setStatusErr] = useState('')

  const fileRef = useRef(null)
  const [file, setFile] = useState(null)
  const [needPw, setNeedPw] = useState(false)
  const [pw, setPw] = useState('')
  const [reading, setReading] = useState(false)
  const [readErr, setReadErr] = useState('')
  const [parsed, setParsed] = useState(draft?.parsed || null)

  const [mapping, setMapping] = useState({})
  const [accounts, setAccounts] = useState({})
  const [preview, setPreview] = useState(null)
  const [checking, setChecking] = useState(false)
  const [checkErr, setCheckErr] = useState('')
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState(null)
  const [confirm, setConfirm] = useState(false)
  const [open, setOpen] = useState({})
  const [busy, setBusy] = useState('')

  // ---- beta switch + history / recovery
  async function loadStatus() {
    setStatusErr('')
    try { setStatus(await api.importStatus()) } catch (e) { setStatusErr(e.message) }
  }
  useEffect(() => {
    api.importEnabled().then((r) => {
      setEnabled(!!r?.enabled)
      if (r?.enabled) loadStatus()
    }).catch(() => setEnabled(false))
  }, [])

  // keep the read statement if the page is refreshed during the check
  useEffect(() => { saveDraft(parsed ? { parsed } : null) }, [parsed])

  // warn before leaving while saving (the save keeps running on the server anyway)
  useEffect(() => {
    if (!saving) return
    const h = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [saving])

  // ---- step 1: read the PDF in the browser
  async function readFile(f, password) {
    setReadErr(''); setReading(true); setPreview(null); setResult(null); setCheckErr('')
    try {
      const res = await readCasPdf(f, password)
      setParsed(statementForServer(res))
      setNeedPw(false); setPw('')
      setMapping({}); setAccounts({})
    } catch (e) {
      if (e.needsPassword) { setNeedPw(true); setReadErr(e.wrongPassword ? e.message : '') }
      else setReadErr(e.message)
    } finally { setReading(false) }
  }
  function onPick(e) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f); setParsed(null); setNeedPw(false); setPw('')
    readFile(f)
    e.target.value = ''
  }

  // ---- step 2: check (nothing is written)
  const checkSeq = useRef(0)
  async function check(nextMapping = mapping) {
    if (!parsed) return
    const seq = ++checkSeq.current
    setChecking(true); setCheckErr('')
    try {
      const p = await api.importPreview(parsed, nextMapping)
      if (seq !== checkSeq.current) return // a newer check was started: ignore this older answer
      setPreview(p)
      const m = {}
      Object.keys(nextMapping).forEach((k) => { if (k.startsWith('fund:')) m[k] = nextMapping[k] }) // funds the user skipped
      p.groups.forEach((g) => { m[g.key] = g.target })
      setMapping(m)
    } catch (e) { if (seq === checkSeq.current) setCheckErr(e.message) }
    finally { if (seq === checkSeq.current) setChecking(false) }
  }
  useEffect(() => { if (parsed && enabled && !preview && !checking && !result) check() }, [parsed, enabled]) // eslint-disable-line react-hooks/exhaustive-deps

  // leave one fund out of the import (or add it back)
  function toggleFund(fundKey, skip) {
    const m = { ...mapping }
    if (skip) m[fundKey] = 'skip'; else delete m[fundKey]
    setMapping(m)
    check(m)
  }

  function changeGroup(key, value) {
    const m = { ...mapping, [key]: value }
    setMapping(m)
    check(m)
  }

  // ---- step 3: import
  async function doImport() {
    setConfirm(false); setSaving(true); setCheckErr('')
    try {
      const r = await api.importSave(parsed, mapping, preview.token, accounts)
      setResult(r)
      setParsed(null); setPreview(null)
      showToast(`Imported: ${r.summary}`, 'success')
      refreshData(true)
    } catch (e) {
      setCheckErr(e.message)
    } finally {
      setSaving(false)
      loadStatus()
    }
  }

  async function undo(importId) {
    if (!window.confirm('Undo this import? Your transactions go back exactly to how they were before it.')) return
    setBusy(importId)
    try {
      await api.importUndo(importId)
      showToast('Import undone', 'success')
      refreshData(true)
      setPreview(null)
    } catch (e) { showToast(e.message, 'error') }
    finally { setBusy(''); loadStatus() }
  }

  async function move(item, to) {
    if (!to) return
    setBusy(item.portfolioId + item.code + item.folio)
    try {
      await api.importMoveFund(item.portfolioId, to, item.code, item.folio)
      showToast('Moved. Future imports will keep it there.', 'success')
      refreshData(true)
    } catch (e) { showToast(e.message, 'error') }
    finally { setBusy(''); loadStatus() }
  }

  function reset() {
    setParsed(null); setPreview(null); setResult(null); setFile(null); setReadErr(''); setCheckErr(''); setMapping({}); setAccounts({})
  }

  if (enabled === null) return <div className="p-6 flex items-center gap-2 text-sm text-[var(--text-dim)]"><Loader2 size={16} className="animate-spin" /> Loading…</div>
  if (!enabled) {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <Note tone="info"><p className="font-semibold">Statement import is not available right now.</p><p>Please try again later.</p>
        </Note>
      </div>
    )
  }

  // ---------- view helpers ----------
  const groups = preview?.groups || []
  const nameOf = (pid) => {
    for (const g of groups) { const o = g.options.find((x) => x.portfolioId === pid); if (o) return o.name }
    return pid
  }
  const destOf = (g) => mapping[g.key] || g.target
  const byDest = {}
  ;(preview?.funds || []).filter((f) => !f.blocked).forEach((f) => {
    const k = f.isNew ? 'new:' + f.groupKey : f.portfolioId
    ;(byDest[k] = byDest[k] || []).push(f)
  })
  const destLabel = (k) => {
    if (k.startsWith('new:')) { const g = groups.find((x) => x.key === k.slice(4)); return `${g?.newName || ''} (new)` }
    return nameOf(k)
  }
  const blockedFunds = (preview?.funds || []).filter((f) => f.blocked)
  const mustFix = preview && (preview.missingMembers.length > 0 || preview.needsBank)
  const helpOpen = showHelp
  const canImport = preview && !preview.blocked && !saving && !checking
  const step = !parsed ? 1 : !preview ? 2 : 3

  const selectCls = 'w-full px-2.5 py-2 text-sm rounded-lg bg-[var(--bg-card)] border border-[var(--border-light)] text-[var(--text-primary)]'

  return (
    <div className="max-w-3xl mx-auto p-3 sm:p-4 space-y-3 pb-28">
      <div>
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
            Import from CAMS statement <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400">NEW</span>
          </h1>
          <button onClick={() => setShowHelp(true)} className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-[var(--border-light)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)]">
            <HelpCircle size={13} /> How to get it
          </button>
        </div>
        <p className="text-xs text-[var(--text-dim)] mt-1">Adds every mutual fund purchase, SIP, switch and sale from your statement to your portfolios. Nothing is saved until you press <b>Import</b>, and you can undo it.</p>
      </div>

      {status?.recovered && <Note tone="good"><p>An earlier import did not finish, so it was undone. Your data is as it was before.</p></Note>}
      {status?.running && <Note tone="warn"><p>An import is still saving. Wait a minute and open this page again.</p></Note>}
      {statusErr && <Note tone="bad">{statusErr}</Note>}
      {result && (
        <Note tone="good">
          <p className="font-semibold">Done! {result.summary}.</p>
          <p>Open <Link to="/investments/mutual-funds" className="underline">Mutual Funds</Link> to see it. If something looks wrong, press <b>Undo</b> at the bottom of this page.</p>
        </Note>
      )}
      {result && <FollowCard />}

      <Modal open={helpOpen} onClose={() => setShowHelp(false)} title="How to get your CAMS statement" maxWidth="max-w-5xl" maxHeight="max-h-[92vh]">
        <ImportHelp />
      </Modal>

      {/* STEP 1 */}
      <Step step={step} n={1} title="Choose your statement PDF" active={step === 1}>
        {!parsed && (
          <>
            <p className="text-xs text-[var(--text-dim)]">
              The <b>Detailed</b> CAMS + KFintech statement (CAS) PDF, from <b>01-Jan-2000</b>, <b>with zero balance folios</b>. Don&apos;t have it yet? It&apos;s free and takes 2 minutes:
            </p>
            <HowToStrip onOpenGuide={() => setShowHelp(true)} />
          </>
        )}
        {parsed ? (
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-[var(--text-muted)]">
              <CheckCircle2 size={13} className="inline text-emerald-400 mr-1" />
              {parsed.folios.length} funds, {parsed.folios.reduce((s, f) => s + f.txns.length, 0)} transactions · {fmtDate(parsed.meta?.from)} – {fmtDate(parsed.meta?.to)}
            </p>
            <button onClick={reset} disabled={saving} className="text-xs underline text-[var(--text-dim)]">Change file</button>
          </div>
        ) : (
          <button onClick={() => fileRef.current?.click()} disabled={reading}
            className="w-full flex items-center justify-center gap-2 px-3 py-3 text-sm font-semibold rounded-lg bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-50">
            {reading ? <Loader2 size={16} className="animate-spin" /> : <FileUp size={16} />} {reading ? 'Reading…' : 'Choose PDF'}
          </button>
        )}
        <input ref={fileRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={onPick} />
        {needPw && file && (
          <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); if (pw) readFile(file, pw) }}>
            <p className="text-xs text-[var(--text-primary)] flex items-center gap-1.5"><Lock size={13} className="text-amber-400" /> This PDF is locked. Type the password you set when you asked CAMS for it.</p>
            <div className="flex gap-2">
              <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus autoComplete="off" placeholder="PDF password"
                className="flex-1 min-w-0 px-3 py-2 text-sm rounded-lg bg-[var(--bg-card)] border border-[var(--border-light)] text-[var(--text-primary)]" />
              <button type="submit" disabled={!pw || reading} className="px-4 py-2 text-sm font-semibold rounded-lg bg-violet-600 text-white disabled:opacity-50">Open</button>
            </div>
            <p className="text-[11px] text-[var(--text-dim)]">Used only on this device to open the file. Not saved or sent.</p>
          </form>
        )}
        {readErr && <Note tone="bad">{readErr}</Note>}
      </Step>

      {/* STEP 2 */}
      {parsed && (
        <Step step={step} n={2} title="Pick a portfolio for each account" active={step >= 2 && !result}>
          {checking && !preview && <p className="text-xs text-[var(--text-dim)] flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Reading your portfolios…</p>}
          {checkErr && <Note tone="bad">{checkErr}</Note>}
          {preview && (
            <>
              <p className="text-xs text-[var(--text-dim)]">Your statement has these accounts. We picked the best match; change it if needed.</p>

              {mustFix && (
                <Note tone="bad">
                  <p className="font-semibold">Before you can import:</p>
                  {preview.missingMembers.map((m) => (
                    <p key={m.holder}>• Add <b>{m.holder}</b> in <Link to="/family" className="underline">Family</Link> (same name as the statement), then come back.</p>
                  ))}
                  {preview.needsBank && <p>• Add a bank account in <Link to="/accounts/bank" className="underline">Bank Accounts</Link> first – a new investment account needs one. Or pick one of your existing portfolios below.</p>}
                </Note>
              )}

              {preview.unknownFunds.length > 0 && (
                <Note tone="warn">
                  <p className="font-semibold">{preview.unknownFunds.length === 1 ? 'This fund' : `These ${preview.unknownFunds.length} funds`} will be left out for now</p>
                  <p>They are not in AMFI&apos;s fund list yet, so we can&apos;t get their price. Everything else will import.</p>
                  {preview.unknownFunds.map((f) => <p key={f.folio + f.isin}>• {f.scheme} <span className="text-[var(--text-dim)]">({f.isin} · folio {f.folio})</span></p>)}
                  <p>Import this statement again in a few days; they will be added once AMFI lists them. If one stays missing, write to us with its name.</p>
                </Note>
              )}

              <div className={`space-y-2 ${checking ? 'opacity-60' : ''}`}>
                {groups.map((g) => (
                  <div key={g.key} className="rounded-lg border border-[var(--border-light)] p-3 space-y-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-sm font-semibold text-[var(--text-primary)]">{g.memberName} · {g.platform.replace(/^Distributor\s+/, 'Agent ')}</p>
                      <p className="text-xs text-[var(--text-muted)] shrink-0">{g.live ? `${g.live} fund${g.live > 1 ? 's' : ''} · ${inr(g.value)}` : 'all sold'}</p>
                    </div>
                    <select value={destOf(g)} onChange={(e) => changeGroup(g.key, e.target.value)} disabled={saving} className={selectCls}>
                      {g.options.filter((o) => o.mine).map((o) => <option key={o.portfolioId} value={o.portfolioId}>→ {o.name}</option>)}
                      <option value="new">→ New portfolio “{g.newName}”</option>
                      <option value="skip">Don&apos;t import</option>
                      {g.options.filter((o) => !o.mine).length > 0 && (
                        <optgroup label="Other people's portfolios">
                          {g.options.filter((o) => !o.mine).map((o) => <option key={o.portfolioId} value={o.portfolioId}>→ {o.name}{o.owner ? ` (${o.owner})` : ''}</option>)}
                        </optgroup>
                      )}
                    </select>
                    {destOf(g) === 'new' && (
                      <select value={accounts[g.key] || ''} onChange={(e) => setAccounts({ ...accounts, [g.key]: e.target.value })} disabled={saving} className={selectCls}>
                        <option value="">{g.accounts.filter((a) => a.match).length === 1 ? `Investment account: ${g.accounts.find((a) => a.match).name}` : `Investment account: new “${g.newName}”`}</option>
                        {g.accounts.filter((a) => !(a.match && g.accounts.filter((x) => x.match).length === 1)).map((a) => <option key={a.accountId} value={a.accountId}>Investment account: {a.name}</option>)}
                      </select>
                    )}
                    {destOf(g) === 'skip' && !g.live && <p className="text-[11px] text-[var(--text-dim)]">Everything here is sold. Choose a portfolio only if you want its old profit / loss history.</p>}
                    {Object.keys(g.pinned || {}).length > 0 && <p className="text-[11px] text-sky-400">Imported before – those funds stay where they are.</p>}
                  </div>
                ))}
              </div>
            </>
          )}
        </Step>
      )}

      {/* STEP 3 */}
      {preview && !mustFix && (
        <Step step={step} n={3} title="Check and import" active={step === 3 && !result}>
          {Object.keys(byDest).length === 0 ? (
            <p className="text-xs text-[var(--text-dim)]">Nothing selected to import.</p>
          ) : (
            <>
              <p className="text-xs text-[var(--text-dim)]">This is what your portfolios will look like. Tap one to see each fund.</p>
              <div className="space-y-2">
                {Object.keys(byDest).map((k) => {
                  const list = byDest[k]
                  const before = list.reduce((s, f) => s + f.valueBefore, 0), after = list.reduce((s, f) => s + f.valueAfter, 0)
                  const inv = list.reduce((s, f) => s + f.after.invested, 0)
                  return (
                    <div key={k} className="rounded-lg border border-[var(--border-light)]">
                      <button onClick={() => setOpen({ ...open, [k]: !open[k] })} className="w-full p-3 text-left flex items-center gap-2">
                        {open[k] ? <ChevronDown size={14} className="shrink-0" /> : <ChevronRight size={14} className="shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{destLabel(k)}</p>
                          <p className="text-xs text-[var(--text-dim)]">{list.filter((f) => f.after.units > 0.0005).length} funds held · invested {inr(inv)}</p>
                        </div>
                        <p className="text-sm text-[var(--text-primary)] shrink-0 text-right">{inr(before)} → <b>{inr(after)}</b></p>
                      </button>
                      {open[k] && (
                        <div className="border-t border-[var(--border-light)] divide-y divide-[var(--border-light)]">
                          {list.filter((f) => f.after.units > 0.0005).map((f) => (
                            <div key={f.code + k} className="px-3 py-2 text-xs flex justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-[var(--text-primary)] truncate">{f.fundName}</p>
                                <p className="text-[var(--text-dim)]">{f.after.units > 0.0005 ? `${units(f.after.units)} units` : 'sold'} · {f.newRows} transactions{f.manualReplaced ? ` · replaces ${f.manualReplaced} you typed` : ''}</p>
                              </div>
                              <div className="shrink-0 flex items-center gap-2">
                                <p className="text-[var(--text-muted)]">{inr(f.valueBefore)} → <b className="text-[var(--text-primary)]">{inr(f.valueAfter)}</b></p>
                                <button onClick={() => toggleFund('fund:' + f.groupKey + '|' + f.code, true)} disabled={checking}
                                  title="Leave this fund out of the import"
                                  className="px-2 py-1 text-[11px] font-semibold rounded-md border border-[var(--border-light)] text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] disabled:opacity-50">Skip</button>
                              </div>
                            </div>
                          ))}
                          {list.some((f) => f.after.units <= 0.0005) && (
                            <p className="px-3 py-2 text-xs text-[var(--text-dim)]">
                              + {list.filter((f) => f.after.units <= 0.0005).length} sold fund(s): only their history is added, so your invested amount and profit stay correct. They don&apos;t show as holdings.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {(preview.resetInitial.length > 0 || preview.warnings.length > 0 || blockedFunds.length > 0) && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-2 text-xs text-[var(--text-primary)]">
                  <p className="font-semibold flex items-center gap-1.5"><AlertTriangle size={14} className="text-amber-400" /> Please read</p>
                  {preview.resetInitial.map((x) => (
                    <p key={x.portfolioId}>• <b>{x.portfolio}</b> has {inr(x.old)} typed as “Initial investment”. The statement has every purchase, so this will be set to 0 (otherwise it is counted twice).</p>
                  ))}
                  {preview.warnings.length > 0 && (
                    <>
                      <p>• These funds are also typed in by hand in another portfolio. If they are the same money, delete them there after importing:</p>
                      <ul className="pl-4 space-y-0.5 text-[var(--text-muted)]">
                        {preview.warnings.map((w, i) => <li key={i}>– {w.replace(/ If it is the same investment.*$/, '').replace(' is also in ', ' in ').replace(' (typed in by hand).', '')}</li>)}
                      </ul>
                    </>
                  )}
                  {blockedFunds.map((f) => <p key={f.code + f.portfolioId}>• <b>{f.fundName}</b> will not be imported: {f.problems[0]}</p>)}
                </div>
              )}
              {preview.skipped.some((x) => x.fundKey) && (
                <div className="rounded-lg border border-[var(--border-light)] p-3 space-y-1.5">
                  <p className="text-xs font-semibold text-[var(--text-primary)]">Funds you skipped</p>
                  {casUniqBy(preview.skipped.filter((x) => x.fundKey), (x) => x.fundKey).map((x) => (
                    <div key={x.fundKey} className="flex items-center justify-between gap-2 text-xs">
                      <p className="text-[var(--text-muted)] truncate">{x.scheme}</p>
                      <button onClick={() => toggleFund(x.fundKey, false)} disabled={checking}
                        className="shrink-0 px-2 py-1 text-[11px] font-semibold rounded-md border border-[var(--border-light)] text-violet-400 hover:bg-[var(--bg-hover)] disabled:opacity-50">Add back</button>
                    </div>
                  ))}
                </div>
              )}
              {preview.skipped.length > 0 && (
                <details className="text-xs text-[var(--text-dim)]">
                  <summary className="cursor-pointer">{preview.skipped.length} left out (sold-out accounts, ones you skipped, unclaimed money, SIFs)</summary>
                  <div className="mt-1 space-y-0.5">{preview.skipped.map((x) => <p key={x.folio + x.scheme}>• {x.scheme}</p>)}</div>
                </details>
              )}
            </>
          )}
        </Step>
      )}

      {/* full-screen wait while saving (the save takes up to a minute or two) */}
      {saving && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <Card className="p-6 max-w-sm w-full text-center space-y-3 shadow-2xl">
            <Loader2 size={32} className="animate-spin text-violet-400 mx-auto" />
            <p className="text-base font-semibold text-[var(--text-primary)]">Importing your transactions…</p>
            <p className="text-xs text-[var(--text-dim)]">Saving a backup, adding {preview?.totals?.newRows || ''} transactions and checking every fund against the statement. This can take a minute or two.</p>
            <p className="text-xs font-medium text-amber-400">Please keep this page open.</p>
          </Card>
        </div>
      )}

      {/* the one action */}
      {preview && !result && (
        <div className="sticky bottom-3 z-10">
          <Card className="p-3 shadow-lg flex flex-col sm:flex-row sm:items-center gap-2">
            <p className="flex-1 text-xs text-[var(--text-muted)]">
              {mustFix ? 'Fix the red items above first.'
                : checking ? 'Updating…'
                : preview.totals.funds ? <>Import <b className="text-[var(--text-primary)]">{preview.totals.funds} funds</b> into {Object.keys(byDest).length} portfolio{Object.keys(byDest).length > 1 ? 's' : ''}. You can undo it.</>
                : 'Nothing to import.'}
            </p>
            {!confirm ? (
              <button onClick={() => setConfirm(true)} disabled={!canImport || !preview.totals.funds}
                className="px-5 py-2.5 text-sm font-semibold rounded-lg bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-40">Import</button>
            ) : (
              <div className="flex gap-2">
                {!saving && <button onClick={() => setConfirm(false)} className="px-4 py-2.5 text-sm rounded-lg border border-[var(--border-light)] text-[var(--text-primary)]">Cancel</button>}
                <button onClick={doImport} disabled={!canImport} className="px-5 py-2.5 text-sm font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40">
                  {saving ? <span className="flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Saving – keep this open</span> : 'Yes, import'}
                </button>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* history */}
      {status?.history?.length > 0 && (
        <Card className="p-4 space-y-2">
          <p className="text-sm font-semibold text-[var(--text-primary)]">Past imports</p>
          {status.history.map((h) => (
            <div key={h.importId} className="flex items-center gap-2 text-xs">
              <div className="flex-1 min-w-0">
                <p className="text-[var(--text-primary)]">{h.started} · {{ DONE: 'Imported', UNDONE: 'Undone', ROLLED_BACK: 'Failed – nothing changed', RESTORED: 'Did not finish – restored' }[h.status] || h.status}</p>
                <p className="text-[var(--text-dim)] truncate">{h.summary || h.statement}</p>
              </div>
              {h.canUndo && (
                <button onClick={() => undo(h.importId)} disabled={!!busy || saving} className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[var(--border-light)] text-[var(--text-primary)] disabled:opacity-50">
                  {busy === h.importId ? <Loader2 size={12} className="animate-spin" /> : <Undo2 size={12} />} Undo
                </button>
              )}
            </div>
          ))}
          {status.imported?.folios?.some((x) => x.units > 0.0005) && (
            <details className="text-xs pt-1">
              <summary className="cursor-pointer text-[var(--text-muted)]"><ArrowRightLeft size={12} className="inline mr-1" />Move an imported fund to another portfolio</summary>
              <div className="mt-2 space-y-1.5">
                {status.imported.folios.filter((x) => x.units > 0.0005).sort((a, b) => (a.portfolio + a.fund).localeCompare(b.portfolio + b.fund)).map((x) => (
                  <div key={x.portfolioId + x.code + x.folio} className="flex flex-col sm:flex-row sm:items-center gap-1.5 rounded-lg border border-[var(--border-light)] p-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-[var(--text-primary)] truncate">{x.fund}</p>
                      <p className="text-[var(--text-dim)]">In {x.portfolio} · folio {x.folio}</p>
                    </div>
                    <select defaultValue="" disabled={!!busy || saving} onChange={(e) => move(x, e.target.value)} className="sm:w-56 px-2 py-1.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-light)] text-[var(--text-primary)]">
                      <option value="">{busy === x.portfolioId + x.code + x.folio ? 'Moving…' : 'Move to…'}</option>
                      {status.imported.portfolios.filter((p) => p.portfolioId !== x.portfolioId).map((p) => <option key={p.portfolioId} value={p.portfolioId}>{p.name}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </details>
          )}
        </Card>
      )}
    </div>
  )
}
