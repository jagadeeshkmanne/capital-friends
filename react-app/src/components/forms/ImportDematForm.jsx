import { useState, useMemo, useRef, useEffect } from 'react'
import { Upload, FileText, CheckCircle2, XCircle, AlertTriangle, Lock, Info } from 'lucide-react'
import { useData } from '../../context/DataContext'
import { useMask } from '../../context/MaskContext'
import { useAuth } from '../../context/AuthContext'
import { formatINR } from '../../data/familyData'
import * as api from '../../services/api'
import { FormField, FormDateInput, FormSelect, FormInput, FormActions } from '../Modal'
import { loadStocks, clearStocksCache, stocksFromCache } from './StockSearchInput'
import { buildStockIndex } from '../../utils/holdingsImport'
import { shortBroker } from '../../utils/cas/dematParser'
import { matchMemberName, nameFit } from '../../utils/nameMatch'

// Import the shares from a CDSL / NSDL statement (CAS). The PDF is read in the browser; only the
// holdings go to the user's sheet. One CAS covers every demat account of a PAN (CDSL and NSDL), so each
// account in it goes into its own stock portfolio — an existing one, or a new one created here.
// The statement has no buy price: the statement price is used unless the user types their own.

const NEW = '__new__'
const NEW_MEMBER = '__new_member__'   // the statement's holder is not in Family yet: added on import
const NEW_ACCT = '__new_acct__'       // no demat account for this broker yet: created on import (broker, client ID, DP ID)
const titleCase = (s) => String(s || '').replace(/\s*[-#]\s*(NEW )?EQUITY.*$|\s*-\s*$/i, '').trim().toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase()).replace(/\bLtd\b/g, 'Ltd')
const rs = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })
// why a holding can't be imported as a stock (the statement's own marks)
function whyNot(r) {
  if (r.fund) return 'mutual fund — use the Mutual Funds import'
  if (r.flag === 'liquidation') return 'company under liquidation (marked ** in the statement) — no market price'
  if (r.flag === 'notTraded') return 'not traded for over a year (marked !! — valued at face value) — no market price'
  if (r.flag === 'rights') return 'rights entitlement — temporary, not a share yet'
  return 'not in the stock list (suspended or delisted?)'
}
const MON = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' }
// "31-08-2026" (CDSL) or "30-Sep-2026" (NSDL) → "2026-09-30"
const isoFromDmy = (s) => { const m = String(s || '').match(/^(\d{2})-(\d{2}|[A-Za-z]{3})-(\d{4})$/); const mm = m && (/\d/.test(m[2]) ? m[2] : MON[m[2].toLowerCase()]); return mm ? `${m[3]}-${mm}-${m[1]}` : '' }

export default function ImportDematForm({ onCancel, initialFile }) {
  const { stockPortfolios, stockHoldings, activeMembers, activeInvestmentAccounts, addStockPortfolio, importStocks, otherInvList, addOtherInvestment, addMember, addInvestmentAccount } = useData()
  const { user } = useAuth()
  const { mv } = useMask()
  const fileRef = useRef(null)
  const [file, setFile] = useState(null)
  const [needPw, setNeedPw] = useState(false)
  const [pw, setPw] = useState('')
  const [reading, setReading] = useState(false)
  const [error, setError] = useState('')
  const [cas, setCas] = useState(null)          // parsed statement
  const [accts, setAccts] = useState([])        // per account: { ownerId, portfolioId, newName, iaId, rows }
  const [date, setDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState(null)

  // opened from the Import stocks page with the PDF already chosen
  useEffect(() => { if (initialFile) { setFile(initialFile); read(initialFile) } }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function read(f, password) {
    setError(''); setReading(true)
    try {
      const { readDematPdf } = await import('../../utils/cas/casPdf')
      if (stocksFromCache()) clearStocksCache()
      const [res, stocks] = await Promise.all([readDematPdf(f, password), loadStocks()])
      const idx = buildStockIndex(stocks)
      // owner: name and PAN matched to Family (word order, initials, spellings, middle names: utils/nameMatch)
      const found = matchMemberName(activeMembers || [], res.holder, res.pan)
      // nobody matches (first sign-in, or a family member not added yet): add the holder to Family on import
      const ownerId = found ? found.memberId : res.holder ? NEW_MEMBER : ''
      setCas(res); setNeedPw(false)
      setDate(isoFromDmy(res.asOf) || new Date().toISOString().slice(0, 10))
      setAccts(res.accounts.filter((a) => a.holdings.length).map((a) => {
        const rows = a.holdings.map((h, k) => {
          const stock = idx.byIsin.get(h.isin) || null
          const fund = !stock && h.isin.startsWith('INF')
          return { key: k, ...h, stock, fund, include: !!stock, unlisted: !stock && !fund && h.flag !== 'rights', avgPrice: String(h.price) }
        })
        // an account whose client ID is already saved belongs to that member, whatever the statement name says
        const owner = byClientId(a)?.memberId || ownerId
        return withIncludes({ ...a, ownerId: owner, ...pickPortfolio(owner, a, res.holder, res.accounts), rows })
      }))
    } catch (e) {
      if (e?.needsPassword) { setNeedPw(true); setError(e.wrongPassword ? e.message : '') }
      else setError(e.message || 'Could not read this statement')
    } finally { setReading(false) }
  }

  // the owner's portfolio for this demat account (same demat account linked, else same broker), or a new one
  // Each demat account in the statement is its own investment account + portfolio. Found by its client ID first
  // (whoever it belongs to); a same-broker account is reused only if it has no client ID saved yet, so a person's
  // second Zerodha demat never lands in the first one.
  const idOf = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  const byClientId = (a) => (a.clientId ? (activeInvestmentAccounts || []).find((x) => idOf(x.accountClientId) && (idOf(x.accountClientId) === idOf(a.clientId) || idOf(x.accountClientId) === idOf(a.boId) || idOf(x.dematDpId) === idOf(a.boId))) : null)
  function pickPortfolio(ownerId, a, holder, all) {
    const ias = (activeInvestmentAccounts || []).filter((x) => x.memberId === ownerId)
    const brokerKey = shortBroker(a.broker).toUpperCase()
    const sameBroker = (x) => brokerKey && String(x.platformBroker || x.accountName || '').toUpperCase().includes(brokerKey)
    const byId = byClientId(a)
    const ia = (byId && byId.memberId === ownerId ? byId : null) || (!byId && ias.find((x) => sameBroker(x) && !idOf(x.accountClientId))) || null
    const pfs = (stockPortfolios || []).filter((p) => p.status !== 'Inactive' && p.ownerId === ownerId)
    const pf = ia ? pfs.find((p) => p.investmentAccountId === ia.accountId) : null
    const member = (activeMembers || []).find((m) => m.memberId === ownerId)
    const first = member ? member.memberName.split(' ')[0] : ownerId === NEW_MEMBER ? holderName(holder).split(' ')[0] : ''
    // two demats at one broker: the name says which ("Zerodha · Rupa …4821")
    const twin = ias.some(sameBroker) || (all || accts).filter((x) => x !== a && shortBroker(x.broker).toUpperCase() === brokerKey).length > 0
    const tail = twin && a.clientId ? ` …${String(a.clientId).slice(-4)}` : ''
    return { portfolioId: pf ? pf.portfolioId : NEW, newName: `${shortBroker(a.broker) || 'Demat'}${first ? ' · ' + first : ''}${tail}`, iaId: ia ? ia.accountId : NEW_ACCT }
  }

  // ticked: found in the list and not already in the chosen portfolio (importing the same statement twice must not double it)
  function withIncludes(a) {
    const held = a.portfolioId && a.portfolioId !== NEW ? heldIn(a.portfolioId) : new Set()
    return { ...a, rows: a.rows.map((r) => ({ ...r, include: !!r.stock && !held.has(String(r.stock.symbol).toUpperCase()) })) }
  }
  function updAcct(i, patch) { setAccts((as) => as.map((a, k) => (k === i ? ('portfolioId' in patch ? withIncludes({ ...a, ...patch }) : { ...a, ...patch }) : a))) }
  function updRow(i, key, patch) { setAccts((as) => as.map((a, k) => (k === i ? { ...a, rows: a.rows.map((r) => (r.key === key ? { ...r, ...patch } : r)) } : a))) }

  // the holder's name as it reads in Family ("RUPA LAKSHMI KATAKAM" → "Rupa Lakshmi Katakam")
  const holderName = (h = cas?.holder) => String(h || '').toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase()).replace(/\s+/g, ' ').trim()
  const heldIn = (pid) => new Set((stockHoldings || []).filter((h) => h.portfolioId === pid).map((h) => String(h.symbol).toUpperCase()))
  const take = (a) => a.rows.filter((r) => r.stock && r.include && Number(r.avgPrice) > 0)
  // holdings with no market price, ticked to go to Other Investments → Unlisted Shares (value kept by hand)
  const already = (r) => (otherInvList || []).some((o) => String(o.notes || '').includes(r.isin))
  const takeUnlisted = (a) => a.rows.filter((r) => !r.stock && !r.fund && r.unlisted && !already(r))
  const nStocks = accts.reduce((s, a) => s + take(a).length, 0), nUnl = accts.reduce((s, a) => s + takeUnlisted(a).length, 0)
  const total = nStocks + nUnl
  const ready = accts.every((a) => (!take(a).length || (a.ownerId && (a.portfolioId !== NEW || (a.newName.trim() && a.iaId)))) && (!takeUnlisted(a).length || a.ownerId))

  async function handleImport() {
    setSaving(true); setError('')
    const done = [], skipped = []
    try {
      // first: anyone / any demat account the statement needs that the app doesn't have yet
      const work = accts.filter((a) => take(a).length || takeUnlisted(a).length)
      if (work.some((a) => a.ownerId === NEW_MEMBER)) {
        // you, when Family is empty (first sign-in) or the name is yours
        const self = !(activeMembers || []).some((m) => m.relationship === 'Self') && (!(activeMembers || []).length || !user?.name || !!nameFit(user.name, cas.holder))
        const r = await addMember({ memberName: holderName(), relationship: self ? 'Self' : 'Other', email: self ? user?.email || '' : '', includeInEmailReports: true, pan: cas.pan || '', aadhar: '', mobile: '', dynamicFields: {} })
        const id = r?.memberId || r?.data?.memberId || r?.id
        if (!id) throw new Error(r?.message || r?.error || `Could not add ${holderName()} to Family`)
        work.forEach((a) => { if (a.ownerId === NEW_MEMBER) a.ownerId = id })
      }
      for (const a of work) {
        if (!take(a).length || a.portfolioId !== NEW || a.iaId !== NEW_ACCT) continue
        const broker = shortBroker(a.broker) || a.broker || 'Demat'
        const owner = (activeMembers || []).find((m) => m.memberId === a.ownerId)
        const tail = / …\w{4}$/.test(a.newName) ? a.newName.match(/ …\w{4}$/)[0] : ''
        const r = await addInvestmentAccount({ accountName: `${broker} - ${(owner?.memberName || holderName()).split(' ')[0]}${tail}`, memberId: a.ownerId, bankAccountId: '', accountType: 'Demat + Trading', platformBroker: broker, accountClientId: a.clientId || '', dematDpId: a.dpId || '', registeredEmail: owner?.email || user?.email || '', registeredPhone: '' })
        a.iaId = r?.accountId || r?.data?.accountId
        if (!a.iaId) throw new Error(r?.message || r?.error || `Could not create the ${broker} demat account`)
      }
      const unl = accts.flatMap((a) => takeUnlisted(a).map((r) => ({ a, r })))
      for (let k = 0; k < unl.length; k++) {
        const { a, r } = unl[k]
        const data = {
          investmentType: 'Unlisted Shares', investmentCategory: 'Equity', investmentName: titleCase(r.name) || r.isin,
          familyMember: a.ownerId, investedAmount: 0, currentValue: Math.round(r.value * 100) / 100,
          notes: `${r.qty} shares · ISIN ${r.isin} · ${a.broker} demat · from ${cas.depository || 'CDSL'} statement ${cas.asOf || ''} (${whyNot(r).split(' — ')[0]}). No market price: update the value by hand.`,
        }
        await (k === unl.length - 1 ? addOtherInvestment(data) : api.createOtherInvestment(data))   // the last one reloads the list
      }
      if (unl.length) done.push({ name: 'Other Investments → Unlisted Shares', count: unl.length, unit: 'holding' })
      for (const a of accts) {
        const rows = take(a), unlRows = takeUnlisted(a)
        a.rows.filter((r) => !rows.includes(r) && !unlRows.includes(r)).forEach((r) => skipped.push({ symbol: r.stock?.symbol || r.name || r.isin, reason: !r.stock ? (already(r) ? 'Already in Other Investments' : whyNot(r)) : 'Left out by you' }))
        if (!rows.length) continue
        let pid = a.portfolioId
        if (pid === NEW) {
          const res = await addStockPortfolio({ portfolioName: a.newName.trim(), ownerId: a.ownerId, investmentAccountId: a.iaId })
          pid = res?.portfolioId
          if (!pid) throw new Error('Could not create the portfolio ' + a.newName)
        }
        const src = `${a.depository || cas.depository || 'CAS'} statement ${cas.asOf || ''}`.trim()
        const res = await importStocks({
          portfolioId: pid, date,
          rows: rows.map((r) => ({
            symbol: r.stock.symbol, isin: r.isin, quantity: r.qty, avgPrice: Number(r.avgPrice), sourceSymbol: r.stock.symbol,
            note: Number(r.avgPrice) === r.price ? `Imported from ${src} · buy price = statement price` : `Imported from ${src}`,
          })),
        })
        done.push({ name: a.portfolioId === NEW ? a.newName : (stockPortfolios.find((p) => p.portfolioId === pid)?.portfolioName || ''), count: res?.imported?.length || 0 })
        ;(res?.skipped || []).forEach((s) => skipped.push(s))
      }
      setResult({ done, skipped })
    } catch (e) {
      setError(e.message || 'Import failed')
      if (done.length) setResult({ done, skipped })
    } finally { setSaving(false) }
  }

  const memberOptions = [...(activeMembers || []).map((m) => ({ value: m.memberId, label: `${mv(m.memberName, 'name')} (${m.relationship})` })), ...(cas?.holder ? [{ value: NEW_MEMBER, label: `+ Add ${mv(holderName(), 'name')} to Family` }] : [])]

  if (result) return (
    <div className="space-y-4">
      {result.done.map((d, i) => (
        <div key={i} className="flex items-center gap-3 rounded-lg px-4 py-3 bg-emerald-500/10 border border-emerald-500/30">
          <CheckCircle2 size={20} className="text-emerald-400 shrink-0" />
          <p className="text-sm text-[var(--text-primary)]"><strong>{d.count}</strong> {d.unit || 'stock'}{d.count === 1 ? '' : 's'} added to <strong>{mv(d.name, 'name')}</strong>.</p>
        </div>
      ))}
      {result.skipped.length > 0 && (
        <div className="rounded-lg border border-[var(--border)] overflow-hidden">
          <p className="px-3 py-2 text-xs font-semibold text-[var(--text-muted)] bg-[var(--bg-inset)]">Not imported ({result.skipped.length})</p>
          <div className="max-h-[220px] overflow-y-auto divide-y divide-[var(--border-light)]">
            {result.skipped.map((s, i) => <div key={i} className="flex justify-between gap-3 px-3 py-2 text-xs"><span className="font-semibold text-[var(--text-primary)] truncate">{s.symbol}</span><span className="text-[var(--text-dim)] text-right">{s.reason}</span></div>)}
          </div>
        </div>
      )}
      {error && <p className="text-xs text-rose-500">{error}</p>}
      <div className="flex justify-end pt-2"><button onClick={onCancel} className="px-5 py-2 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-500 rounded-lg">Done</button></div>
    </div>
  )

  return (
    <div className="space-y-4">
      {/* file */}
      <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--bg-inset)] px-4 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => fileRef.current?.click()} disabled={reading} className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-violet-600 hover:bg-violet-500 rounded-lg disabled:opacity-50">
            <Upload size={14} /> {reading ? 'Reading…' : file ? 'Choose another PDF' : 'Choose statement PDF'}
          </button>
          {file && <span className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]"><FileText size={14} /> {file.name}</span>}
        </div>
        <p className="text-xs text-[var(--text-dim)] mt-2">The monthly <strong>CAS from CDSL or NSDL</strong> (emailed to you, or downloaded from their website). One statement has every demat account of that PAN. The file is read on this device. Tested with CDSL statements; NSDL is new — if anything looks wrong, tell us.</p>
        <input ref={fileRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setFile(f); setCas(null); setPw(''); read(f) } if (fileRef.current) fileRef.current.value = '' }} />
      </div>

      {needPw && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 space-y-2">
          <p className="text-xs text-[var(--text-primary)] flex items-center gap-1.5"><Lock size={13} className="text-amber-400" /> This PDF is locked. The password is usually the PAN in capital letters.</p>
          <div className="flex gap-2">
            <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus autoComplete="off" placeholder="PDF password"
              onKeyDown={(e) => { if (e.key === 'Enter' && pw) read(file, pw) }}
              className="flex-1 bg-[var(--bg-input)] border border-[var(--border-input)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)]" />
            <button type="button" disabled={!pw || reading} onClick={() => read(file, pw)} className="px-4 py-2 text-xs font-bold text-white bg-violet-600 rounded-lg disabled:opacity-50">Open</button>
          </div>
        </div>
      )}
      {error && <p className="text-xs text-rose-500">{error}</p>}

      {cas && (<>
        <div className="flex items-start gap-2 rounded-lg px-3 py-2.5 bg-sky-500/10 border border-sky-500/25 text-xs text-[var(--text-secondary)]">
          <Info size={14} className="text-sky-400 shrink-0 mt-0.5" />
          <p>The statement has no buy price, so each stock's <strong>statement price</strong> is used as your buy price (profit starts from that day). Type your real average price where you know it — you can also edit it later in Transactions.</p>
        </div>
        <FormField label="Buy date for these holdings">
          <FormDateInput value={date} onChange={setDate} />
        </FormField>

        {accts.map((a, i) => {
          const held = a.portfolioId !== NEW ? heldIn(a.portfolioId) : new Set()
          const ias = (activeInvestmentAccounts || []).filter((x) => x.memberId === a.ownerId && (x.accountType === 'Demat + Trading' || x.accountType === 'Trading' || /demat/i.test(x.accountType || '')))
          const pfs = (stockPortfolios || []).filter((p) => p.status !== 'Inactive' && p.ownerId === a.ownerId)
          const matched = a.rows.filter((r) => r.stock).length
          return (
            <div key={a.boId || i} className="rounded-xl border border-[var(--border)] overflow-hidden">
              <div className="px-4 py-3 bg-[var(--bg-inset)] border-b border-[var(--border-light)]">
                <p className="text-sm font-bold text-[var(--text-primary)]">{a.broker} <span className="text-xs font-semibold text-[var(--text-dim)]">· {a.depository} · client …{String(a.clientId).slice(-4)}</span></p>
                <p className="text-xs text-[var(--text-dim)] mt-0.5">{a.rows.length} holdings · {matched} found in the stock list · value {mv(formatINR(a.rows.reduce((s, r) => s + r.value, 0)), 'amount')}</p>
              </div>
              {matched === 0 && !a.rows.some((r) => !r.stock && !r.fund) ? (
                <p className="px-4 py-2.5 text-xs text-[var(--text-dim)]">Nothing to import here as stocks{a.rows.some((r) => r.fund) ? ' — these are mutual fund units (import them on the Mutual Funds page)' : ''}.</p>
              ) : (<>
              <div className="px-4 py-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField label="Whose account" required>
                  <FormSelect value={a.ownerId} onChange={(v) => updAcct(i, { ownerId: v, ...pickPortfolio(v, a) })} options={memberOptions} placeholder="Select family member…" />
                </FormField>
                {matched > 0 && <FormField label="Import into portfolio" required>
                  <FormSelect value={a.portfolioId} onChange={(v) => updAcct(i, { portfolioId: v })}
                    options={[...pfs.map((p) => ({ value: p.portfolioId, label: mv(p.portfolioName, 'name') })), { value: NEW, label: '+ New portfolio' }]} />
                </FormField>}
                {(a.ownerId === NEW_MEMBER || (a.portfolioId === NEW && a.iaId === NEW_ACCT)) && (
                  <p className="sm:col-span-2 text-[11px] text-sky-400">Nothing to set up first. Created when you import: {[a.ownerId === NEW_MEMBER && `${mv(holderName(), 'name')} in Family`, a.portfolioId === NEW && a.iaId === NEW_ACCT && `the ${shortBroker(a.broker) || 'demat'} account (client ID and DP ID from the statement)`, a.portfolioId === NEW && 'the portfolio'].filter(Boolean).join(' · ')}.</p>
                )}
                {matched > 0 && a.portfolioId === NEW && a.ownerId && (<>
                  <FormField label="New portfolio name" required>
                    <FormInput value={a.newName} onChange={(v) => updAcct(i, { newName: v })} />
                  </FormField>
                  <FormField label="Demat account" required>
                    <FormSelect value={a.iaId} onChange={(v) => updAcct(i, { iaId: v })} options={[...ias.map((x) => ({ value: x.accountId, label: `${mv(x.accountName, 'name')} - ${x.platformBroker}` })), { value: NEW_ACCT, label: `+ Create ${shortBroker(a.broker) || 'demat'} account (client …${String(a.clientId).slice(-4)})` }]} placeholder="Select demat account…" />
                  </FormField>
                </>)}
              </div>
              <div className="flex justify-between px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-dim)] bg-[var(--bg-inset)] border-t border-[var(--border-light)]"><span>Stock</span><span>Your avg buy price ₹</span></div>
              <div className="max-h-[300px] overflow-y-auto divide-y divide-[var(--border-light)] border-t border-[var(--border-light)]">
                {a.rows.map((r) => {
                  const isHeld = r.stock && held.has(String(r.stock.symbol).toUpperCase())
                  return (
                    <div key={r.key} className="px-4 py-2 flex items-center gap-3">
                      <input type="checkbox" checked={r.stock ? r.include : (!!r.unlisted && !already(r))} disabled={r.fund || (!r.stock && already(r))}
                        title={r.stock ? 'Import this stock' : 'Add to Other Investments → Unlisted Shares (value by hand)'}
                        onChange={(e) => updRow(i, r.key, r.stock ? { include: e.target.checked } : { unlisted: e.target.checked })}
                        className="w-4 h-4 rounded border-[var(--border-input)] text-violet-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-[var(--text-primary)] truncate">
                          {r.stock ? <>{r.stock.symbol} <span className="font-normal text-[var(--text-dim)]">— {r.stock.companyName}</span></> : <span className="text-[var(--text-muted)]">{r.name || r.isin}</span>}
                        </p>
                        <p className="text-xs text-[var(--text-dim)] tabular-nums">
                          {r.qty} shares · statement price {rs(r.price)}
                          {!r.stock && <span className="text-rose-400"> · {whyNot(r)}</span>}
                          {!r.stock && !r.fund && (already(r) ? <span className="block text-[var(--text-dim)]">Already in Other Investments</span>
                            : r.unlisted ? <span className="block text-sky-400">Ticked: goes to Other Investments → Unlisted Shares at {rs(r.value)} (you update it)</span>
                            : <span className="block text-[var(--text-dim)]">Tick to keep it in Other Investments → Unlisted Shares</span>)}
                          {isHeld && <span className="text-amber-500"> · already in this portfolio{r.include ? ' — ticked: will be added on top' : ''}</span>}
                        </p>
                      </div>
                      {r.stock ? (
                        <div className="w-24 shrink-0">
                          <input type="number" value={r.avgPrice} onChange={(e) => updRow(i, r.key, { avgPrice: e.target.value })} title="Your average buy price (₹)"
                            className="w-full bg-[var(--bg-input)] border border-[var(--border-input)] rounded-md px-2 py-1 text-xs text-right tabular-nums text-[var(--text-primary)]" />
                        </div>
                      ) : r.fund ? <AlertTriangle size={15} className="text-amber-400 shrink-0" /> : r.unlisted && !already(r) ? <Info size={15} className="text-sky-400 shrink-0" /> : <XCircle size={15} className="text-rose-400 shrink-0" />}
                    </div>
                  )
                })}
              </div>
              </>)}
            </div>
          )
        })}
      </>)}

      <FormActions onCancel={onCancel} onSubmit={handleImport} loading={saving} disabled={!cas || !total || !ready || !date}
        submitLabel={!total ? 'Import' : [nStocks && `Import ${nStocks} stock${nStocks === 1 ? '' : 's'}`, nUnl && `${nStocks ? '+ ' : 'Add '}${nUnl} unlisted`].filter(Boolean).join(' ')} />
    </div>
  )
}
