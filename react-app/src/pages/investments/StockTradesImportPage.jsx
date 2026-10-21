import { useState, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, XCircle, Info, ArrowLeft, ChevronDown, ChevronRight, Download, HelpCircle } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useData } from '../../context/DataContext'
import { useMask } from '../../context/MaskContext'
import { formatINR } from '../../data/familyData'
import Modal, { FormSelect } from '../../components/Modal'
import StockSearchInput, { loadStocks, clearStocksCache, stocksFromCache } from '../../components/forms/StockSearchInput'
import * as api from '../../services/api'
import { readTableFile, buildStockIndex, matchStock, findColumns } from '../../utils/holdingsImport'
import ImportDematForm from '../../components/forms/ImportDematForm'
import ImportStocksForm from '../../components/forms/ImportStocksForm'
import { parseTradeHistory, groupAccounts, summarize, fileChecks } from '../../utils/tradeHistoryImport'
import { matchMemberName, nameFit } from '../../utils/nameMatch'

// Import stocks (beta, /investments/stocks/import-trades, open to every signed-in user): one place for every stock file.
// The file decides what happens:
//   Groww order history / Zerodha tradebook / our Excel template (other brokers) → trade history (this page)
//   CDSL or NSDL statement (PDF)                                                    → ImportDematForm
//   holdings file (Symbol, Quantity, Avg price)                                     → ImportStocksForm
// Each broker account goes to its own portfolio, found by the client ID saved on the investment account (so family
// members and second demat accounts never mix).

const SUPPORT_EMAIL = 'capital.friends.dev@gmail.com'
const TRADE_NOTE = /^(Groww|Zerodha|Template) · (order|trade|row) /
// the broker an account is matched / created with: Groww, Zerodha, or the template's Broker column
const platOf = (a) => (a.broker === 'Template' ? String(a.platformName ?? a.platform ?? '').trim() : a.broker)
const labelOf = (a) => (a.broker === 'Template' ? platOf(a) || 'Other broker' : a.broker)
const SNAPSHOT_NOTE = /^Imported/              // CAS / holdings-file rows: quantity + one price, no history
const normId = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
const fmtDate = (iso) => { if (!iso) return ''; const d = new Date(iso + 'T00:00:00'); return isNaN(d) ? iso : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) }
// templates are served from /public
const downloadFile = (file, saveAs) => { const el = document.createElement('a'); el.href = `${import.meta.env.BASE_URL || '/'}${file}`; el.download = saveAs; el.click() }
const rupees = (n) => (Math.round(n || 0)).toLocaleString('en-IN')

function Card({ children, className = '' }) {
  return <div className={`rounded-xl border border-[var(--border-light)] bg-[var(--bg-card)] ${className}`}>{children}</div>
}
function Note({ tone = 'info', children }) {
  const t = { info: 'border-sky-500/30 bg-sky-500/10', warn: 'border-amber-500/30 bg-amber-500/10', bad: 'border-red-500/30 bg-red-500/10', good: 'border-emerald-500/30 bg-emerald-500/10' }[tone]
  const Icon = { info: Info, warn: AlertTriangle, bad: XCircle, good: CheckCircle2 }[tone]
  const ic = { info: 'text-sky-400', warn: 'text-amber-400', bad: 'text-red-400', good: 'text-emerald-400' }[tone]
  return <div className={`rounded-lg border p-3 flex gap-2.5 ${t}`}><Icon size={16} className={`${ic} shrink-0 mt-0.5`} /><div className="text-xs text-[var(--text-primary)] space-y-1 min-w-0">{children}</div></div>
}
function Stat({ label, value, tone }) {
  const c = tone === 'up' ? 'text-emerald-400' : tone === 'down' ? 'text-rose-400' : 'text-[var(--text-primary)]'
  return <div className="min-w-0"><p className="text-[11px] text-[var(--text-dim)]">{label}</p><p className={`text-sm font-semibold tabular-nums ${c}`}>{value}</p></div>
}

export default function StockTradesImportPage() {
  const { user } = useAuth()
  const { activeMembers, activeInvestmentAccounts, stockPortfolios, stockTransactions, addMember, addInvestmentAccount, updateInvestmentAccount, addStockPortfolio, refreshStocks } = useData()
  const { mv } = useMask()
  const fileRef = useRef(null)
  const [reading, setReading] = useState(false)
  const [fileErrors, setFileErrors] = useState([])     // [{ file, error }]
  const [accounts, setAccounts] = useState(null)       // groupAccounts(...) + { stocks: {srcKey: stock|null}, include, memberId, accountId, portfolioId, mode, onlyAfter }
  const [saving, setSaving] = useState(false)
  const [steps, setSteps] = useState([])
  const [results, setResults] = useState(null)
  const [error, setError] = useState('')
  const [help, setHelp] = useState(false)
  const [open, setOpen] = useState({})
  const [other, setOther] = useState(null)             // { kind: 'cas' | 'holdings', file }: opened in the existing import
  const { importStocks } = useData()

  const members = activeMembers || []
  const accts = activeInvestmentAccounts || []
  const portfolios = useMemo(() => (stockPortfolios || []).filter((p) => p.status !== 'Inactive'), [stockPortfolios])
  const memberName = (id, a) => (id === 'new' ? newName(a) : members.find((m) => m.memberId === id)?.memberName || '')
  // a person not in Family yet: the name in the file (Groww), else what the user types; you, when Family is empty
  const newName = (a) => String(a?.newName ?? (a?.holderName || (!members.length ? user?.name : '') || '')).trim()

  async function handleFiles(list) {
    let files = [...(list || [])]
    if (!files.length) return
    setReading(true); setError(''); setResults(null); setFileErrors([]); setOther(null)
    try {
      // a statement PDF: the CDSL / NSDL import (one statement at a time)
      const pdf = files.find((f) => /\.pdf$/i.test(f.name) || f.type === 'application/pdf')
      if (pdf) {
        if (files.length > 1) setFileErrors([{ file: files.filter((f) => f !== pdf).map((f) => f.name).join(', '), error: 'Upload the statement PDF on its own. These files were not read: add them after this import.' }])
        setAccounts(null); setOther({ kind: 'cas', file: pdf }); return
      }
      // a holdings file (what you own today, no trade dates): the holdings import
      const tables = []
      for (const f of files) { try { tables.push({ f, rows: await readTableFile(f) }) } catch (e) { tables.push({ f, error: e.message || 'Could not read this file' }) } }
      const holdings = tables.find((t) => t.rows && !parseTradeHistory(t.rows, t.f.name).broker && findColumns(t.rows))
      if (holdings && tables.every((t) => !t.rows || !parseTradeHistory(t.rows, t.f.name).broker)) {
        setAccounts(null); setOther({ kind: 'holdings', file: holdings.f }); return
      }
      files = tables
      if (stocksFromCache()) clearStocksCache()
      const stocks = await loadStocks()
      const idx = buildStockIndex(stocks)
      const parsed = [], errs = []
      for (const { f, rows, error: readErr } of files) {
        if (readErr) { errs.push({ file: f.name, error: readErr }); continue }
        try {
          const r = parseTradeHistory(rows, f.name)
          if (r.error) errs.push({ file: f.name, error: r.error })
          else if (!r.trades.length) errs.push({ file: f.name, error: 'No executed trades in this file.' })
          else parsed.push({ ...r, fileName: f.name })
        } catch (e) { errs.push({ file: f.name, error: e.message || 'Could not read this file' }) }
      }
      setFileErrors(errs)
      const groups = groupAccounts(parsed).map((a) => {
        const stocksMap = {}
        for (const t of a.trades) { const k = t.isin || t.symbol; if (!(k in stocksMap)) stocksMap[k] = matchStock({ sourceSymbol: t.symbol, isin: t.isin }, idx) }
        return { ...a, stocks: stocksMap, include: true, memberId: '', accountId: '', portfolioId: '', mode: '', onlyAfter: true }
      })
      setAccounts(groups.length ? groups : null)
    } catch (e) { setError(e.message || 'Could not read the files') }
    finally { setReading(false); if (fileRef.current) fileRef.current.value = '' }
  }
  const update = (key, patch) => setAccounts((as) => as.map((a) => (a.key === key ? { ...a, ...patch } : a)))

  // where each file account goes: investment account (by client ID), member, portfolio, existing rows → default mode
  function plan(a) {
    const plat = platOf(a).toLowerCase().replace(/[^a-z0-9]/g, '')
    const isTrading = (x) => /demat|trading|broker/i.test(x.accountType || '')
    // template without a Broker column: any of the person's demat accounts; else the same broker (loosely: "ICICI" ↔ "ICICI Direct")
    const sameBroker = (x) => { const b = String(x.platformBroker || '').toLowerCase().replace(/[^a-z0-9]/g, ''); return plat ? !!b && (b === plat || b.includes(plat) || plat.includes(b)) : isTrading(x) }
    const brokerAccts = accts.filter(sameBroker)
    const byId = a.clientId ? brokerAccts.find((x) => normId(x.accountClientId) && normId(x.accountClientId) === normId(a.clientId)) : null
    let account = null, how = 'new', memberId = ''
    if (byId) { account = byId; how = 'matched'; memberId = byId.memberId }
    else if (a.accountId && a.accountId !== 'new') { account = brokerAccts.find((x) => x.accountId === a.accountId) || null; how = account ? (normId(account.accountClientId) ? (a.clientId ? 'conflict' : 'chosen') : a.clientId ? 'fill' : 'chosen') : 'new'; memberId = account?.memberId || '' }
    else {
      memberId = a.memberId || (a.holderName && matchMemberName(members, a.holderName)?.memberId) || (!members.length || a.holderName ? 'new' : members.length === 1 ? members[0].memberId : a.broker === 'Template' ? members.find((m) => m.relationship === 'Self')?.memberId || '' : '')
      // the member's account at this broker with no client ID saved yet → save the ID onto it
      // no client ID in the file (template, renamed Zerodha file): the person's account at that broker
      const blank = a.accountId === 'new' ? null : brokerAccts.find((x) => x.memberId === memberId && !normId(x.accountClientId)) || (!a.clientId ? brokerAccts.find((x) => x.memberId === memberId) : null)
      if (blank) { account = blank; how = a.clientId ? 'fill' : 'chosen' }
    }
    const pfs = account ? portfolios.filter((p) => p.investmentAccountId === account.accountId) : []
    const portfolio = pfs.find((p) => p.portfolioId === a.portfolioId) || pfs[0] || null
    const rows = portfolio ? (stockTransactions || []).filter((t) => t.portfolioId === portfolio.portfolioId) : []
    const kinds = { trade: 0, snapshot: 0, manual: 0 }
    let lastManual = ''
    for (const t of rows) { const k = TRADE_NOTE.test(t.notes) ? 'trade' : SNAPSHOT_NOTE.test(t.notes) ? 'snapshot' : 'manual'; kinds[k]++; if (k === 'manual' && t.date > lastManual) lastManual = t.date }
    const snapStocks = new Set(rows.filter((t) => SNAPSHOT_NOTE.test(t.notes)).map((t) => t.symbol)).size
    const defMode = !rows.length ? 'add' : kinds.manual ? 'add' : kinds.snapshot ? 'replace' : 'add'
    const mode = a.mode || defMode
    const nameOk = !a.holderName || !memberId || memberId === 'new' || !!nameFit(a.holderName, memberName(memberId))
    return { account, how, memberId, pfs, portfolio, rows, kinds, lastManual, snapStocks, mode, nameOk, brokerAccts }
  }

  // trades that will be sent: stock found (or picked), not left out
  const tradesOf = (a) => a.trades.filter((t) => a.stocks[t.isin || t.symbol])
  const summaries = useMemo(() => (accounts || []).map((a) => summarize(tradesOf(a), (t) => a.stocks[t.isin || t.symbol]?.symbol || t.symbol)), [accounts]) // eslint-disable-line react-hooks/exhaustive-deps


  const ready = (accounts || []).filter((a) => { const p = a.include && tradesOf(a).length ? plan(a) : null; return p && p.memberId && (p.memberId !== 'new' || newName(a)) && p.how !== 'conflict' && (p.account || platOf(a)) })
  const total = ready.reduce((s, a) => s + tradesOf(a).length, 0)

  async function handleImport() {
    setSaving(true); setError(''); setSteps([])
    const step = (label) => setSteps((st) => [...st, { label, done: false }])
    const tick = (bad) => setSteps((st) => st.map((x, i) => (i === st.length - 1 ? { ...x, done: true, bad } : x)))
    const out = []
    try {
      for (const a of ready) {
        const p = plan(a), mName = memberName(p.memberId, a)
        if (p.memberId === 'new') {
          const self = !members.some((m) => m.relationship === 'Self') && (!members.length || !a.holderName || !user?.name || !!nameFit(a.holderName, user.name))
          step(`Adding ${mName} to Family`)
          const r = await addMember({ memberName: mName, relationship: self ? 'Self' : 'Other', email: self ? user?.email || '' : '', includeInEmailReports: true, pan: '', aadhar: '', mobile: '', dynamicFields: {} })
          p.memberId = r?.memberId || r?.data?.memberId || r?.id
          if (!p.memberId) throw new Error(r?.error || `Could not add ${mName} to Family`)
          tick()
        }
        let accountId = p.account?.accountId
        if (p.how === 'fill') {
          step(`Saving ${labelOf(a)} client ID on ${p.account.accountName}`)
          await updateInvestmentAccount(accountId, { ...p.account, accountClientId: a.clientId, registeredEmail: p.account.registeredEmail || user?.email || '' })
          tick()
        } else if (!accountId) {
          const n = p.brokerAccts.filter((x) => x.memberId === p.memberId).length
          const name = `${labelOf(a)} - ${mName}${n ? ` ${n + 1}` : ''}`
          step(`Creating investment account ${name}`)
          const r = await addInvestmentAccount({ accountName: name, memberId: p.memberId, bankAccountId: '', accountType: 'Demat + Trading', platformBroker: labelOf(a), accountClientId: a.clientId, registeredEmail: user?.email || '', registeredPhone: '' })
          accountId = r?.accountId || r?.data?.accountId
          if (!accountId) throw new Error(r?.error || 'Could not create the investment account')
          tick()
        }
        let portfolioId = p.portfolio?.portfolioId
        if (!portfolioId) {
          step(`Creating portfolio ${labelOf(a)} - ${mName}`)
          const r = await addStockPortfolio({ portfolioName: `${labelOf(a)} - ${mName}`, ownerId: p.memberId, investmentAccountId: accountId })
          portfolioId = r?.portfolioId || r?.data?.portfolioId
          if (!portfolioId) throw new Error(r?.error || 'Could not create the portfolio')
          tick()
        }
        const list = tradesOf(a)
        step(`Importing ${list.length} ${labelOf(a)} trades for ${mName}`)
        const res = await api.importStockTrades({
          portfolioId, broker: a.broker, mode: p.mode === 'replace' ? 'replace' : 'add',
          after: p.mode !== 'replace' && p.kinds.manual && a.onlyAfter ? p.lastManual : '',
          trades: list.map((t) => ({ date: t.date, time: t.time, type: t.type, symbol: a.stocks[t.isin || t.symbol].symbol, isin: t.isin, sourceSymbol: t.symbol, qty: t.qty, price: t.price, ref: t.ref, refKind: t.refKind })),
        })
        if (!res || res.success === false) { tick(true); throw new Error(res?.error || 'Import failed') }
        tick()
        out.push({ key: a.key, broker: labelOf(a), member: mName, ...res })
      }
      await refreshStocks()
      setResults(out)
    } catch (e) {
      setError(e.message || 'Import failed')
      if (out.length) { await refreshStocks(); setResults(out) }
    } finally { setSaving(false) }
  }

  // ── after import ──
  if (results) return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <h1 className="text-lg font-bold text-[var(--text-primary)]">Trade history imported</h1>
      {results.map((r) => (
        <Card key={r.key} className="p-4 space-y-2">
          <p className="text-sm font-semibold text-[var(--text-primary)]">{r.broker} · {mv(r.member, 'name')}</p>
          <p className="text-xs text-[var(--text-secondary)]"><strong>{r.imported}</strong> trades added across {r.stocks} stocks{r.replaced ? ` · ${r.replaced} earlier entries replaced` : ''}{r.duplicates ? ` · ${r.duplicates} already there` : ''}{r.before ? ` · ${r.before} on or before your own entries left out` : ''}.</p>
          {r.skipped?.length > 0 && <Note tone="warn"><p>Not imported: {r.skipped.slice(0, 8).map((s) => `${s.symbol} (${s.reason})`).join(', ')}{r.skipped.length > 8 ? ` and ${r.skipped.length - 8} more` : ''}</p></Note>}
          {r.shortfall?.length > 0 && <Note tone="info"><p>Price needed: {r.shortfall.map((s) => `${s.symbol} ${s.qty}`).join(', ')} shares were sold but never bought in the file (IPO, transfer, gift or bonus shares). Add them as a buy with their date and price on the Stocks page.</p></Note>}
        </Card>
      ))}
      {error && <Note tone="bad"><p>{error}</p></Note>}
      <div className="flex gap-3"><Link to="/investments/stocks" className="px-4 py-2 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-500 rounded-lg">Open Stocks</Link>
        <button onClick={() => { setResults(null); setAccounts(null); setSteps([]) }} className="px-4 py-2 text-xs font-semibold text-[var(--text-secondary)] border border-[var(--border)] rounded-lg">Import more</button></div>
    </div>
  )

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Link to="/investments/stocks" className="text-[var(--text-dim)] hover:text-[var(--text-primary)]"><ArrowLeft size={16} /></Link>
        <h1 className="text-lg font-bold text-[var(--text-primary)]">Import stocks</h1>
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-400">BETA</span>
      </div>
      <p className="text-xs text-[var(--text-secondary)]">Drop in any stock file: the app works out what it is. Family members, demat accounts and portfolios are created by themselves, and nothing is saved until you press Import.</p>

      <div className="rounded-xl border-2 border-dashed border-[var(--border)] bg-[var(--bg-inset)] px-4 py-6 flex flex-col items-center text-center gap-3"
        onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files) }}>
        <button type="button" onClick={() => fileRef.current?.click()} disabled={reading || saving} className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-violet-600 hover:bg-violet-500 rounded-lg disabled:opacity-50">
          <Upload size={16} /> {reading ? 'Reading…' : accounts || other ? 'Choose other files' : 'Choose files'}
        </button>
        <p className="text-xs text-[var(--text-dim)]">or drop them here · Excel, CSV or statement PDF · several trade files at once is fine</p>
        <p className="text-[11px] text-[var(--text-secondary)]">Groww · Zerodha · CDSL / NSDL statement · Excel template for any other broker</p>
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
          <button type="button" onClick={() => setHelp(true)} className="flex items-center gap-1 text-xs font-semibold text-violet-400 hover:text-violet-300"><HelpCircle size={13} /> How to get the file</button>
          <button type="button" onClick={() => downloadFile('stock-trades-template.xlsx', 'stock-trades-template.xlsx')} className="flex items-center gap-1 text-xs font-semibold text-violet-400 hover:text-violet-300"><Download size={13} /> Excel template</button>
        </div>
        <input ref={fileRef} type="file" multiple accept=".csv,.xlsx,.pdf,application/pdf" className="hidden" onChange={(e) => handleFiles(e.target.files)} />
      </div>

      <Modal open={help} onClose={() => setHelp(false)} title="How to import stocks" wide>
        <div className="space-y-4 text-xs text-[var(--text-secondary)]">
          <div className="space-y-2">
            {[
              ['Groww order history · Zerodha tradebook', 'Every buy and sell with its price: money put in, realised gains by financial year, when each holding turns long term.', 'Best'],
              ['Excel template (any other broker)', 'The same, from trades you fill in or paste from your broker\'s report.', ''],
              ['CDSL / NSDL statement (PDF)', 'What you hold today in every demat account of that PAN. No buy price: the statement price is used, and you can edit it later.', ''],
              ['Holdings file', 'Symbol, Quantity and Avg price from any broker.', ''],
            ].map(([t, d, tag]) => (
              <div key={t} className="rounded-lg border border-[var(--border-light)] p-3">
                <p className="font-semibold text-[var(--text-primary)]">{t}{tag && <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400">{tag}</span>}</p>
                <p className="mt-0.5">{d}</p>
              </div>
            ))}
          </div>
          <div className="space-y-3">
            <div><p className="font-semibold text-[var(--text-primary)] mb-1">Groww</p>
              <ol className="list-decimal pl-4 space-y-0.5"><li>On groww.in open Profile → <strong>Reports</strong>.</li><li>Under Stocks pick <strong>Order history</strong> (not P&L or Holdings).</li><li>From: the month the account was opened. To: today. Download.</li></ol></div>
            <div><p className="font-semibold text-[var(--text-primary)] mb-1">Zerodha</p>
              <ol className="list-decimal pl-4 space-y-0.5"><li>On console.zerodha.com open Reports → <strong>Tradebook</strong>, segment <strong>Equity</strong>.</li><li>One year per download: get each year since the account opened, all now or one at a time later, in any order.</li><li>Keep the file names as downloaded (they carry your client ID).</li></ol></div>
            <div><p className="font-semibold text-[var(--text-primary)] mb-1">CDSL / NSDL statement</p>
              <ol className="list-decimal pl-4 space-y-0.5"><li>The monthly <strong>CAS</strong> emailed by CDSL or NSDL: one statement covers every demat of that PAN.</li><li>Upload the PDF. The password is usually your PAN in capitals.</li></ol></div>
            <div><p className="font-semibold text-[var(--text-primary)] mb-1">Any other broker</p>
              <ol className="list-decimal pl-4 space-y-0.5"><li><button type="button" onClick={() => downloadFile('stock-trades-template.xlsx', 'stock-trades-template.xlsx')} className="text-violet-400 font-semibold">Download the Excel template</button>.</li><li>One row per buy or sell: date, Buy/Sell, symbol or ISIN, quantity, price, broker.</li><li>Upload it here. Only stocks you hold today? Use the <button type="button" onClick={() => downloadFile('stock-holdings-sample.xlsx', 'stock-holdings-template.xlsx')} className="text-violet-400 font-semibold">holdings template</button> instead.</li></ol></div>
          </div>
          <ul className="space-y-1 text-[11px] text-[var(--text-dim)]">
            <li>• Upload the download as it is: don't open and re-save it in Excel first.</li>
            <li>• Family: upload everyone's files. Each account goes to its owner's portfolio, and anyone missing is added to Family.</li>
            <li>• Later, upload only the new file: trades already in the app are skipped. A statement never overwrites real trades.</li>
            <li>• Only stocks and ETFs are imported here. Mutual funds: <Link to="/import" className="underline">Import statement</Link>.</li>
          </ul>
          <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 p-3 space-y-1">
            <p className="font-semibold text-[var(--text-primary)]">Tested so far: Groww, Zerodha and CDSL statements. NSDL statements are new.</p>
            <p>Another broker, or a file that doesn't read? Email <strong className="select-all break-all text-[var(--text-primary)]">{SUPPORT_EMAIL}</strong> with the broker's name and a sample of its trade report. Before sending, delete or blank out your name, client ID, PAN and account numbers: a few rows are enough. Until then, the Excel template works for any broker.</p>
          </div>
        </div>
      </Modal>

      {other && (
        <Card className="p-4">
          <p className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2"><FileSpreadsheet size={14} /> {other.kind === 'cas' ? 'CDSL / NSDL statement' : 'Holdings file'} · {other.file.name}</p>
          {other.kind === 'cas'
            ? <ImportDematForm key={other.file.name + other.file.size} initialFile={other.file} onCancel={() => setOther(null)} />
            : <ImportStocksForm key={other.file.name + other.file.size} initialFile={other.file} onImport={importStocks} onCancel={() => setOther(null)} />}
        </Card>
      )}

      {fileErrors.map((f, i) => <Note key={i} tone="bad"><p><strong>{f.file}</strong>: {f.error}</p></Note>)}
      {error && <Note tone="bad"><p>{error}</p></Note>}

      {(accounts || []).map((a, i) => {
        const p = plan(a), s = summaries[i]
        const missing = Object.entries(a.stocks).filter(([, v]) => v === null || v === undefined)
        const memberOpts = [...members.map((m) => ({ value: m.memberId, label: `${mv(m.memberName, 'name')} (${m.relationship})` })), { value: 'new', label: a.holderName ? `Add ${mv(a.holderName, 'name')} to Family` : 'Add a new family member' }]
        const checks = fileChecks(a, new Date().toISOString().slice(0, 10), p.rows.filter((t) => TRADE_NOTE.test(t.notes)).map((t) => t.date))
        const acctOpts = [...p.brokerAccts.map((x) => ({ value: x.accountId, label: `${mv(x.accountName, 'name')}${x.accountClientId ? ` · ${mv(x.accountClientId, 'clientId')}` : ''}` })), { value: 'new', label: `New ${labelOf(a)} account` }]
        return (
          <Card key={a.key} className="overflow-hidden">
            <div className="flex items-start gap-3 px-4 py-3 border-b border-[var(--border-light)]">
              <input type="checkbox" checked={a.include} onChange={(e) => update(a.key, { include: e.target.checked })} className="mt-1 w-4 h-4 rounded border-[var(--border-input)] text-violet-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2"><FileSpreadsheet size={14} /> {a.broker === 'Template' ? <>Excel template · {labelOf(a)}</> : <>{a.broker} · client {a.clientId ? mv(a.clientId, 'clientId') : 'ID not in the file'}</>}</p>
                <p className="text-xs text-[var(--text-dim)]">{a.holderName ? <>Name in file: {mv(a.holderName, 'name')} · </> : null}{a.files.length} file{a.files.length === 1 ? '' : 's'} · {a.trades.length} trades · {fmtDate(a.trades[0]?.date)} to {fmtDate(a.trades[a.trades.length - 1]?.date)}{a.repeats ? ` · ${a.repeats} repeated trades dropped` : ''}</p>
              </div>
            </div>

            <div className="px-4 py-3 space-y-3">
              {/* whose account */}
              {p.how === 'matched' ? (
                <Note tone="good"><p>Goes to <strong>{mv(memberName(p.memberId), 'name')}</strong> · {mv(p.account.accountName, 'name')} (client ID matches){p.portfolio ? <> · portfolio {mv(p.portfolio.portfolioName, 'name')}</> : <> · a new portfolio will be created</>}.</p></Note>
              ) : (
                <div className="grid sm:grid-cols-2 gap-3">
                  <div><p className="text-[11px] text-[var(--text-dim)] mb-1">Whose account is this?</p><FormSelect value={p.memberId} onChange={(v) => update(a.key, { memberId: v, accountId: '' })} options={memberOpts} placeholder="Pick a family member" /></div>
                  {p.memberId === 'new' && <div><p className="text-[11px] text-[var(--text-dim)] mb-1">Name</p><input value={newName(a)} onChange={(e) => update(a.key, { newName: e.target.value })} placeholder="Full name" className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--bg-input)] border border-[var(--border-input)] text-[var(--text-primary)]" /></div>}
                  {a.broker === 'Template' && !a.platform && !p.account && <div><p className="text-[11px] text-[var(--text-dim)] mb-1">Broker</p><input value={a.platformName ?? ''} onChange={(e) => update(a.key, { platformName: e.target.value })} placeholder="e.g. ICICI Direct" className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--bg-input)] border border-[var(--border-input)] text-[var(--text-primary)]" /></div>}
                  {p.brokerAccts.length > 0 && p.memberId !== 'new' && <div><p className="text-[11px] text-[var(--text-dim)] mb-1">{a.broker === 'Template' && !platOf(a) ? 'Demat account in the app' : `${labelOf(a)} account in the app`}</p><FormSelect value={p.account?.accountId || 'new'} onChange={(v) => update(a.key, { accountId: v })} options={acctOpts} /></div>}
                  <p className="sm:col-span-2 text-[11px] text-[var(--text-dim)]">{!p.memberId ? 'Pick who it belongs to.' : p.memberId === 'new' ? `${newName(a) || 'This person'} will be added to Family, with a ${labelOf(a)} investment account and a portfolio for these trades.` : p.how === 'fill' ? `The client ID will be saved on ${p.account.accountName}, so next time it is found by itself.` : p.how === 'conflict' ? `This account has a different client ID saved, so these trades can't go there. Pick "New ${labelOf(a)} account" if this is a second demat.` : p.how === 'chosen' ? `Trades go to ${p.account?.accountName}.` : `A ${labelOf(a)} investment account and portfolio will be created for ${memberName(p.memberId, a)}${a.clientId ? ', with this client ID' : ''}.`}</p>
                </div>
              )}
              {checks.map((c, j) => <Note key={j} tone={c.tone}><p>{c.text}</p></Note>)}
              {!p.nameOk && <Note tone="warn"><p>The name in the file ({mv(a.holderName, 'name')}) does not look like {mv(memberName(p.memberId), 'name')}. Check it is the right person.</p></Note>}
              {p.pfs.length > 1 && <div className="max-w-xs"><p className="text-[11px] text-[var(--text-dim)] mb-1">Portfolio</p><FormSelect value={p.portfolio?.portfolioId} onChange={(v) => update(a.key, { portfolioId: v })} options={p.pfs.map((x) => ({ value: x.portfolioId, label: mv(x.portfolioName, 'name') }))} /></div>}

              {/* what is already in the portfolio */}
              {p.rows.length > 0 && (
                <div className="rounded-lg border border-[var(--border-light)] p-3 space-y-2 text-xs">
                  <p className="text-[var(--text-primary)] font-semibold">This portfolio already has {p.rows.length} entries{p.kinds.snapshot ? ` (${p.snapStocks} stocks imported earlier from a CAS or holdings file)` : ''}{p.kinds.trade ? ` · ${p.kinds.trade} from a broker file` : ''}{p.kinds.manual ? ` · ${p.kinds.manual} added by hand` : ''}.</p>
                  <label className="flex items-start gap-2"><input type="radio" checked={p.mode === 'replace'} onChange={() => update(a.key, { mode: 'replace' })} className="mt-0.5" /><span>Replace them with this trade history{p.kinds.snapshot && !p.kinds.manual ? ' (recommended: the file has the real prices)' : ''}</span></label>
                  <label className="flex items-start gap-2"><input type="radio" checked={p.mode !== 'replace'} onChange={() => update(a.key, { mode: 'add' })} className="mt-0.5" /><span>Keep them and add only trades not already there{p.kinds.trade ? ' (repeats are skipped by order number)' : ''}</span></label>
                  {p.mode !== 'replace' && p.kinds.manual > 0 && <label className="flex items-start gap-2 pl-5"><input type="checkbox" checked={a.onlyAfter} onChange={(e) => update(a.key, { onlyAfter: e.target.checked })} className="mt-0.5" /><span>Only trades after {fmtDate(p.lastManual)}, the last one you added by hand</span></label>}
                </div>
              )}

              {/* stocks not in the app's list */}
              {missing.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-rose-400">{missing.length} stock{missing.length === 1 ? '' : 's'} not found in the stock list. Search for it, or its trades are left out:</p>
                  {missing.map(([k]) => { const t = a.trades.find((x) => (x.isin || x.symbol) === k); return (
                    <div key={k} className="grid sm:grid-cols-[160px_1fr] gap-2 items-center"><span className="text-xs font-semibold text-[var(--text-primary)] truncate">{t?.symbol}{t?.name ? ` · ${t.name}` : ''}</span>
                      <StockSearchInput value={null} onSelect={(st) => st.symbol && update(a.key, { stocks: { ...a.stocks, [k]: { symbol: st.symbol, companyName: st.companyName } } })} placeholder="Search symbol or company…" /></div>) })}
                </div>
              )}

              {/* what the history shows */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-lg bg-[var(--bg-inset)] p-3">
                <Stat label="Bought" value={mv(`₹${rupees(s.bought)}`, 'amount')} />
                <Stat label="Sold" value={mv(`₹${rupees(s.sold)}`, 'amount')} />
                <Stat label="Realised gain" value={mv(`${s.realised < 0 ? '-' : ''}₹${rupees(Math.abs(s.realised))}`, 'amount')} tone={s.realised >= 0 ? 'up' : 'down'} />
                <Stat label={`Held now · ${s.holdings.length} stocks`} value={mv(`₹${rupees(s.holdingsCost)}`, 'amount')} />
              </div>
              {s.byFY.length > 0 && (
                <div className="overflow-x-auto"><table className="w-full text-xs tabular-nums">
                  <thead><tr className="text-[var(--text-dim)] text-left"><th className="py-1 font-medium">Realised gains</th><th className="py-1 font-medium text-right">Short term</th><th className="py-1 font-medium text-right">Long term</th></tr></thead>
                  <tbody>{s.byFY.map((y) => <tr key={y.fy} className="border-t border-[var(--border-light)]"><td className="py-1 text-[var(--text-primary)]">{y.fy}</td><td className="py-1 text-right">{mv(formatINR(Math.round(y.short)), 'amount')}</td><td className="py-1 text-right">{mv(formatINR(Math.round(y.long)), 'amount')}</td></tr>)}</tbody>
                </table></div>
              )}
              {s.holdings.length > 0 && (
                <div>
                  <button onClick={() => setOpen((o) => ({ ...o, [a.key]: !o[a.key] }))} className="flex items-center gap-1 text-xs font-semibold text-violet-400">{open[a.key] ? <ChevronDown size={12} /> : <ChevronRight size={12} />} Holdings from this history</button>
                  {open[a.key] && <div className="overflow-x-auto mt-1"><table className="w-full text-xs tabular-nums">
                    <thead><tr className="text-[var(--text-dim)] text-left"><th className="py-1 font-medium">Stock</th><th className="py-1 font-medium text-right">Qty</th><th className="py-1 font-medium text-right">Avg price</th><th className="py-1 font-medium text-right">Cost</th><th className="py-1 font-medium text-right">Long term from</th></tr></thead>
                    <tbody>{s.holdings.sort((x, y) => y.cost - x.cost).map((h) => <tr key={h.key} className="border-t border-[var(--border-light)]"><td className="py-1 text-[var(--text-primary)]">{h.key}</td><td className="py-1 text-right">{h.qty}</td><td className="py-1 text-right">₹{h.avg.toFixed(2)}</td><td className="py-1 text-right">{mv(`₹${rupees(h.cost)}`, 'amount')}</td><td className="py-1 text-right">{h.longTermFrom <= new Date().toISOString().slice(0, 10) ? 'Long term now' : fmtDate(h.longTermFrom)}</td></tr>)}</tbody>
                  </table></div>}
                </div>
              )}
              {s.shortfall.length > 0 && <Note tone="info"><p><strong>Price needed later:</strong> {s.shortfall.map((x) => `${x.symbol} (${x.qty})`).join(', ')}: shares sold that this file never bought. Usually IPO, transfer, gift or bonus shares, or bought before the file starts. Add them as a buy with date and price after the import.</p></Note>}
              {a.skipped.length > 0 && <p className="text-[11px] text-[var(--text-dim)]">{a.skipped.length} rows left out (cancelled or rejected orders, other segments).</p>}
            </div>
          </Card>
        )
      })}

      {steps.length > 0 && (
        <ul className="space-y-1 text-sm">{steps.map((x, i) => <li key={i} className="flex items-center gap-2 text-[var(--text-primary)]">{x.bad ? <XCircle size={14} className="text-rose-400" /> : x.done ? <CheckCircle2 size={14} className="text-emerald-500" /> : <span className="w-3.5 h-3.5 rounded-full border-2 border-[var(--text-dim)] border-t-transparent animate-spin" />}{x.label}</li>)}</ul>
      )}

      {accounts && (
        <div className="flex justify-end">
          <button onClick={handleImport} disabled={saving || !total} className="px-5 py-2 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-500 rounded-lg disabled:opacity-50">
            {saving ? 'Importing…' : total ? `Import ${total} trades` : 'Import'}
          </button>
        </div>
      )}
    </div>
  )
}
