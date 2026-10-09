import { useState, useMemo, useRef } from 'react'
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, XCircle, Download } from 'lucide-react'
import { useData } from '../../context/DataContext'
import { useFamily } from '../../context/FamilyContext'
import { useMask } from '../../context/MaskContext'
import { formatINR } from '../../data/familyData'
import { FormField, FormDateInput, FormSelect, FormActions } from '../Modal'
import StockSearchInput, { loadStocks, clearStocksCache, stocksFromCache } from './StockSearchInput'
import { readTableFile, extractHoldings, buildStockIndex, matchStock } from '../../utils/holdingsImport'

const today = () => new Date().toISOString().split('T')[0]

// Import holdings from a broker file: Symbol, Quantity, Avg price. Live price, value and P&L come from
// Google Finance in the sheet, the same as for a stock bought by hand.
// A symbol we can't find never stops the import: the row waits for the user to pick the stock, or is skipped.
export default function ImportStocksForm({ portfolioId, onImport, onCancel }) {
  const { stockPortfolios, stockHoldings } = useData()
  const { selectedMember } = useFamily()
  const { mv } = useMask()
  const fileRef = useRef(null)

  const activePortfolios = useMemo(() => {
    const active = (stockPortfolios || []).filter((p) => p.status === 'Active')
    return selectedMember === 'all' ? active : active.filter((p) => p.ownerId === selectedMember)
  }, [stockPortfolios, selectedMember])

  const [pid, setPid] = useState(portfolioId || '')
  const [date, setDate] = useState(today())
  const [fileName, setFileName] = useState('')
  const [reading, setReading] = useState(false)
  const [error, setError] = useState('')
  const [rows, setRows] = useState(null)         // [{ key, sourceSymbol, quantity, avgPrice, stock, include }]
  const [invalid, setInvalid] = useState([])
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState(null)

  const held = useMemo(() => new Set((stockHoldings || []).filter((h) => h.portfolioId === pid).map((h) => String(h.symbol).toUpperCase())), [stockHoldings, pid])

  async function handleFile(file) {
    if (!file) return
    setError(''); setRows(null); setInvalid([]); setResult(null); setFileName(file.name); setReading(true)
    try {
      if (stocksFromCache()) clearStocksCache()   // import: always match against the latest list (new stocks, ETFs)
      const [table, stocks] = await Promise.all([readTableFile(file), loadStocks()])
      const ex = extractHoldings(table)
      if (ex.error) { setError(ex.error); return }
      if (!ex.items.length && !ex.invalid.length) { setError('No holdings found in this file.'); return }
      const idx = buildStockIndex(stocks)
      setRows(ex.items.map((it, k) => ({ ...it, key: k, stock: matchStock(it, idx), include: true })))
      setInvalid(ex.invalid)
    } catch (e) {
      setError(e.message || 'Could not read this file')
    } finally {
      setReading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function update(key, patch) { setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r))) }

  const status = (r) => !r.stock ? 'missing' : held.has(String(r.stock.symbol).toUpperCase()) ? 'held' : 'ready'
  const take = (r) => !!r.stock && (status(r) === 'held' ? !!r.addToHeld : r.include)
  const toImport = (rows || []).filter(take)
  const counts = useMemo(() => {
    const c = { ready: 0, held: 0, missing: 0 }
    ;(rows || []).forEach((r) => { c[status(r)]++ })
    return c
  }, [rows, held]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleImport() {
    if (!pid) { setError('Choose a portfolio first'); return }
    if (!toImport.length) return
    setSaving(true); setError('')
    try {
      const res = await onImport({
        portfolioId: pid, date,
        rows: toImport.map((r) => ({ symbol: r.stock.symbol, quantity: r.quantity, avgPrice: Math.round(r.avgPrice * 10000) / 10000, sourceSymbol: r.sourceSymbol })),
      })
      const notTaken = (rows || []).filter((r) => !toImport.includes(r)).map((r) => ({ symbol: r.sourceSymbol, reason: !r.stock ? 'Not found in the stock list' : status(r) === 'held' ? 'Already in this portfolio' : 'Left out by you' }))
      setResult({ imported: res?.imported || [], skipped: [...(res?.skipped || []), ...notTaken, ...invalid.map((i) => ({ symbol: i.sourceSymbol, reason: 'Quantity or price missing in the file' }))] })
    } catch (e) {
      setError(e.message || 'Import failed')
    } finally { setSaving(false) }
  }

  // Excel template served from /public: Holdings sheet (Symbol, Quantity, Avg Price) + a "How to fill" sheet
  function downloadSample() {
    const a = document.createElement('a')
    a.href = `${import.meta.env.BASE_URL || '/'}stock-holdings-sample.xlsx`
    a.download = 'stock-holdings-template.xlsx'; a.click()
  }

  const portfolioOptions = activePortfolios.map((p) => {
    const name = p.portfolioName?.replace(/^PFL-/, '') || p.portfolioName
    return { value: p.portfolioId, label: p.ownerName ? `${mv(name, 'name')} (${mv(p.ownerName, 'name')})` : mv(name, 'name') }
  })

  // ── after import: the summary ──
  if (result) return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-lg px-4 py-3 bg-emerald-500/10 border border-emerald-500/30">
        <CheckCircle2 size={20} className="text-emerald-400 shrink-0" />
        <p className="text-sm text-[var(--text-primary)]"><strong>{result.imported.length}</strong> stock{result.imported.length === 1 ? '' : 's'} imported. Prices and P&L update from Google Finance.</p>
      </div>
      {result.skipped.length > 0 && (
        <div className="rounded-lg border border-[var(--border)] overflow-hidden">
          <p className="px-3 py-2 text-xs font-semibold text-[var(--text-muted)] bg-[var(--bg-inset)]">Not imported ({result.skipped.length})</p>
          <div className="max-h-[220px] overflow-y-auto divide-y divide-[var(--border-light)]">
            {result.skipped.map((s, i) => (
              <div key={i} className="flex justify-between gap-3 px-3 py-2 text-xs"><span className="font-semibold text-[var(--text-primary)]">{s.symbol}</span><span className="text-[var(--text-dim)] text-right">{s.reason}</span></div>
            ))}
          </div>
        </div>
      )}
      <div className="flex justify-end pt-2"><button onClick={onCancel} className="px-5 py-2 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-500 rounded-lg">Done</button></div>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Import into portfolio" required>
          <FormSelect value={pid} onChange={setPid} options={portfolioOptions} placeholder="Select portfolio..." />
        </FormField>
        <FormField label="Bought on (used for every row)">
          <FormDateInput value={date} onChange={setDate} />
        </FormField>
      </div>

      {/* file picker */}
      <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--bg-inset)] px-4 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => fileRef.current?.click()} disabled={reading} className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-violet-600 hover:bg-violet-500 rounded-lg disabled:opacity-50">
            <Upload size={14} /> {reading ? 'Reading…' : fileName ? 'Choose another file' : 'Choose Excel or CSV file'}
          </button>
          {fileName && <span className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]"><FileSpreadsheet size={14} /> {fileName}</span>}
          <button type="button" onClick={downloadSample} className="ml-auto flex items-center gap-1 text-xs font-semibold text-violet-400 hover:text-violet-300"><Download size={12} /> Download Excel template</button>
        </div>
        <p className="text-xs text-[var(--text-dim)] mt-2">Needs 3 columns: <strong>Symbol</strong> (or Instrument), <strong>Quantity</strong> and <strong>Avg price</strong>. Zerodha, Groww and most broker holdings downloads work as they are (.xlsx or .csv).</p>
        <input ref={fileRef} type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
      </div>

      {error && <p className="text-xs text-rose-500">{error}</p>}

      {/* preview */}
      {rows && (
        <div className="rounded-lg border border-[var(--border)] overflow-hidden">
          <div className="flex flex-wrap gap-x-4 gap-y-1 px-3 py-2 text-xs bg-[var(--bg-inset)] border-b border-[var(--border-light)]">
            <span className="text-emerald-400 font-semibold">{counts.ready} ready</span>
            {counts.held > 0 && <span className="text-amber-400 font-semibold">{counts.held} already in this portfolio</span>}
            {counts.missing > 0 && <span className="text-rose-400 font-semibold">{counts.missing} not found: pick the stock, or leave it out</span>}
            {invalid.length > 0 && <span className="text-[var(--text-dim)]">{invalid.length} row{invalid.length === 1 ? '' : 's'} without quantity/price ignored</span>}
          </div>
          <div className="max-h-[340px] overflow-y-auto divide-y divide-[var(--border-light)]">
            {rows.map((r) => { const st = status(r); return (
              <div key={r.key} className="px-3 py-2.5">
                <div className="flex items-center gap-3">
                  <input type="checkbox" checked={st === 'held' ? !!r.addToHeld : r.include} disabled={st === 'missing'}
                    onChange={(e) => update(r.key, st === 'held' ? { addToHeld: e.target.checked } : { include: e.target.checked })}
                    className="w-4 h-4 rounded border-[var(--border-input)] text-violet-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-[var(--text-primary)] truncate">
                      {r.stock ? <>{r.stock.symbol} <span className="font-normal text-[var(--text-dim)]">— {r.stock.companyName}</span></> : r.sourceSymbol}
                    </p>
                    <p className="text-xs text-[var(--text-dim)] tabular-nums">{r.quantity} × {formatINR(r.avgPrice)} = {mv(formatINR(r.quantity * r.avgPrice), 'amount')}</p>
                  </div>
                  {st === 'ready' && <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />}
                  {st === 'held' && <span className="flex items-center gap-1 text-xs text-amber-400 shrink-0" title="Tick to add these shares on top of what is already there"><AlertTriangle size={14} /> Already held</span>}
                  {st === 'missing' && <XCircle size={16} className="text-rose-400 shrink-0" />}
                </div>
                {st === 'missing' && (
                  <div className="mt-2 pl-7">
                    <p className="text-xs text-rose-400 mb-1">"{r.sourceSymbol}" isn't in our stock list. Search for the right one (or leave it out):</p>
                    <StockSearchInput value={null} onSelect={(s) => s.symbol && update(r.key, { stock: { symbol: s.symbol, companyName: s.companyName }, include: true })} placeholder="Search symbol or company…" />
                  </div>
                )}
              </div>) })}
          </div>
        </div>
      )}

      <FormActions onCancel={onCancel} onSubmit={handleImport} loading={saving} disabled={!rows || !toImport.length || !pid}
        submitLabel={toImport.length ? `Import ${toImport.length} stock${toImport.length === 1 ? '' : 's'}` : 'Import'} />
    </div>
  )
}
