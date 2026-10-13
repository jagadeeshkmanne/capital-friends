import { useState, useMemo, useRef } from 'react'
import { Upload, FileText, CheckCircle2, XCircle, AlertTriangle, Lock, Info } from 'lucide-react'
import { useData } from '../../context/DataContext'
import { useMask } from '../../context/MaskContext'
import { formatINR } from '../../data/familyData'
import * as api from '../../services/api'
import { FormField, FormDateInput, FormSelect, FormInput, FormActions } from '../Modal'
import { loadStocks, clearStocksCache, stocksFromCache } from './StockSearchInput'
import { buildStockIndex } from '../../utils/holdingsImport'
import { shortBroker } from '../../utils/cas/dematParser'

// Import the shares from a CDSL / NSDL statement (CAS). The PDF is read in the browser; only the
// holdings go to the user's sheet. One CAS covers every demat account of a PAN (CDSL and NSDL), so each
// account in it goes into its own stock portfolio — an existing one, or a new one created here.
// The statement has no buy price: the statement price is used unless the user types their own.

const NEW = '__new__'
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
const isoFromDmy = (s) => { const m = String(s || '').match(/^(\d{2})-(\d{2})-(\d{4})$/); return m ? `${m[3]}-${m[2]}-${m[1]}` : '' }
const tokens = (s) => new Set(String(s || '').toUpperCase().split(/[^A-Z]+/).filter((t) => t.length > 1))  // in order
function nameScore(a, b) { const A = tokens(a), B = tokens(b); let n = 0; A.forEach((t) => { if (B.has(t)) n++ }); return n }

export default function ImportDematForm({ onCancel }) {
  const { stockPortfolios, stockHoldings, activeMembers, activeInvestmentAccounts, addStockPortfolio, importStocks, otherInvList, addOtherInvestment } = useData()
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

  async function read(f, password) {
    setError(''); setReading(true)
    try {
      const { readDematPdf } = await import('../../utils/cas/casPdf')
      if (stocksFromCache()) clearStocksCache()
      const [res, stocks] = await Promise.all([readDematPdf(f, password), loadStocks()])
      const idx = buildStockIndex(stocks)
      // owner: the family member with this PAN, else one whose whole name is in the holder's name
      // ("Rupa" or "Rupa Katakam" for RUPA LAKSHMI KATAKAM — but not just a shared middle name)
      const byPan = res.pan && (activeMembers || []).find((m) => String(m.pan || '').toUpperCase() === res.pan)
      const first = [...tokens(res.holder)][0]
      const byName = (activeMembers || []).filter((m) => {
        const t = [...tokens(m.memberName)]
        return t.length && nameScore(m.memberName, res.holder) === t.length && (t.length >= 2 || t[0] === first)
      })
      const ownerId = byPan ? byPan.memberId : byName.length === 1 ? byName[0].memberId : ''
      setCas(res); setNeedPw(false)
      setDate(isoFromDmy(res.asOf) || new Date().toISOString().slice(0, 10))
      setAccts(res.accounts.filter((a) => a.holdings.length).map((a) => {
        const rows = a.holdings.map((h, k) => {
          const stock = idx.byIsin.get(h.isin) || null
          const fund = !stock && h.isin.startsWith('INF')
          return { key: k, ...h, stock, fund, include: !!stock, unlisted: !stock && !fund && h.flag !== 'rights', avgPrice: String(h.price) }
        })
        return withIncludes({ ...a, ownerId, ...pickPortfolio(ownerId, a), rows })
      }))
    } catch (e) {
      if (e?.needsPassword) { setNeedPw(true); setError(e.wrongPassword ? e.message : '') }
      else setError(e.message || 'Could not read this statement')
    } finally { setReading(false) }
  }

  // the owner's portfolio for this demat account (same demat account linked, else same broker), or a new one
  function pickPortfolio(ownerId, a) {
    const ias = (activeInvestmentAccounts || []).filter((x) => x.memberId === ownerId)
    const brokerKey = shortBroker(a.broker).toUpperCase()
    const ia = ias.find((x) => a.clientId && String(x.accountClientId || '').includes(a.clientId))
      || ias.find((x) => brokerKey && String(x.platformBroker || x.accountName || '').toUpperCase().includes(brokerKey))
    const pfs = (stockPortfolios || []).filter((p) => p.status !== 'Inactive' && p.ownerId === ownerId)
    const pf = (ia && pfs.find((p) => p.investmentAccountId === ia.accountId)) || pfs.find((p) => brokerKey && String(p.portfolioName || '').toUpperCase().includes(brokerKey))
    const member = (activeMembers || []).find((m) => m.memberId === ownerId)
    return { portfolioId: pf ? pf.portfolioId : NEW, newName: `${shortBroker(a.broker) || 'Demat'}${member ? ' · ' + member.memberName.split(' ')[0] : ''}`, iaId: ia ? ia.accountId : '' }
  }

  // ticked: found in the list and not already in the chosen portfolio (importing the same statement twice must not double it)
  function withIncludes(a) {
    const held = a.portfolioId && a.portfolioId !== NEW ? heldIn(a.portfolioId) : new Set()
    return { ...a, rows: a.rows.map((r) => ({ ...r, include: !!r.stock && !held.has(String(r.stock.symbol).toUpperCase()) })) }
  }
  function updAcct(i, patch) { setAccts((as) => as.map((a, k) => (k === i ? ('portfolioId' in patch ? withIncludes({ ...a, ...patch }) : { ...a, ...patch }) : a))) }
  function updRow(i, key, patch) { setAccts((as) => as.map((a, k) => (k === i ? { ...a, rows: a.rows.map((r) => (r.key === key ? { ...r, ...patch } : r)) } : a))) }

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

  const memberOptions = (activeMembers || []).map((m) => ({ value: m.memberId, label: `${mv(m.memberName, 'name')} (${m.relationship})` }))

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
        <p className="text-xs text-[var(--text-dim)] mt-2">The monthly <strong>CAS from CDSL or NSDL</strong> (emailed to you, or downloaded from their website). One statement has every demat account of that PAN. The file is read on this device.</p>
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
                {matched > 0 && a.portfolioId === NEW && a.ownerId && (<>
                  <FormField label="New portfolio name" required>
                    <FormInput value={a.newName} onChange={(v) => updAcct(i, { newName: v })} />
                  </FormField>
                  <FormField label="Demat account" required>
                    {ias.length
                      ? <FormSelect value={a.iaId} onChange={(v) => updAcct(i, { iaId: v })} options={ias.map((x) => ({ value: x.accountId, label: `${mv(x.accountName, 'name')} - ${x.platformBroker}` }))} placeholder="Select demat account…" />
                      : <p className="text-xs text-amber-500 py-2">Add this {shortBroker(a.broker)} demat account under <strong>Accounts → Investment accounts</strong> first, then import again.</p>}
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
