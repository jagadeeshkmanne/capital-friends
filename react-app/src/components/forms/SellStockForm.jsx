import { useState, useMemo } from 'react'
import { useData } from '../../context/DataContext'
import { useFamily } from '../../context/FamilyContext'
import { formatINR } from '../../data/familyData'
import { FormField, FormInput, FormDateInput, FormSelect, FormActions } from '../Modal'

export default function SellStockForm({ portfolioId, initialData, signalDetail, onSave, onCancel }) {
  const { stockPortfolios, stockHoldings, stockTransactions } = useData()
  const { selectedMember } = useFamily()

  // Filter portfolios by header's selected member
  const activePortfolios = useMemo(() => {
    const active = (stockPortfolios || []).filter((p) => p.status === 'Active')
    return selectedMember === 'all' ? active : active.filter((p) => p.ownerId === selectedMember)
  }, [stockPortfolios, selectedMember])

  const [form, setForm] = useState({
    portfolioId: portfolioId || initialData?.portfolioId || '',
    symbol: initialData?.symbol || '',
    companyName: initialData?.companyName || '',
    date: initialData?.date || new Date().toISOString().split('T')[0],
    quantity: initialData?.quantity || '',
    pricePerShare: initialData?.pricePerShare || '',
    brokerage: initialData?.brokerage || '0',
    notes: initialData?.notes || '',
  })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  function set(key, val) {
    setForm((f) => ({ ...f, [key]: val }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  // Holdings for selected portfolio
  const holdings = useMemo(() => {
    if (!form.portfolioId) return []
    return (stockHoldings || []).filter((h) => h.portfolioId === form.portfolioId && h.quantity > 0)
  }, [stockHoldings, form.portfolioId])

  const selectedHolding = holdings.find((h) => h.symbol === form.symbol)
  const availableQty = selectedHolding?.quantity || 0

  // Holding period from earliest BUY transaction
  const holdingPeriod = useMemo(() => {
    if (!form.portfolioId || !form.symbol) return null
    const buys = (stockTransactions || [])
      .filter(t => t.portfolioId === form.portfolioId && t.symbol === form.symbol && t.type === 'BUY' && t.date)
      .map(t => new Date(t.date))
      .filter(d => !isNaN(d))
      .sort((a, b) => a - b)
    if (!buys.length) return null
    const firstBuyDate = buys[0]
    const today = new Date()
    const daysHeld = Math.floor((today - firstBuyDate) / (1000 * 60 * 60 * 24))
    const daysToLTCG = 365 - daysHeld
    return { firstBuyDate, daysHeld, daysToLTCG, isLocked: daysHeld < 30, isLTCG: daysHeld >= 365 }
  }, [stockTransactions, form.portfolioId, form.symbol])

  const totalAmount = useMemo(() => {
    const qty = Number(form.quantity) || 0
    const price = Number(form.pricePerShare) || 0
    return qty * price
  }, [form.quantity, form.pricePerShare])

  const netAmount = useMemo(() => {
    return totalAmount - (Number(form.brokerage) || 0)
  }, [totalAmount, form.brokerage])

  function selectStock(symbol) {
    const holding = holdings.find((h) => h.symbol === symbol)
    setForm((f) => ({ ...f, symbol, companyName: holding?.companyName || '' }))
    setErrors((e) => ({ ...e, symbol: undefined }))
  }

  function setPortfolio(val) {
    // When portfolio changes, check if pre-filled symbol exists in new portfolio
    const newHoldings = (stockHoldings || []).filter((h) => h.portfolioId === val && h.quantity > 0)
    const prefilledSymbol = form.symbol
    const match = prefilledSymbol ? newHoldings.find((h) => h.symbol === prefilledSymbol) : null
    if (match) {
      // Keep pre-filled symbol, update company name from holding
      setForm((f) => ({ ...f, portfolioId: val, companyName: match.companyName || f.companyName }))
    } else {
      // Reset stock selection when portfolio changes
      setForm((f) => ({ ...f, portfolioId: val, symbol: '', companyName: '', quantity: '' }))
    }
    setErrors((e) => ({ ...e, portfolioId: undefined }))
  }

  function validate() {
    const e = {}
    if (!form.portfolioId) e.portfolioId = 'Required'
    if (!form.symbol) e.symbol = 'Required'
    if (!form.date) e.date = 'Required'
    if (!form.quantity || Number(form.quantity) <= 0) e.quantity = 'Must be > 0'
    if (Number(form.quantity) > availableQty) e.quantity = `Max ${availableQty} shares`
    if (!form.pricePerShare || Number(form.pricePerShare) <= 0) e.pricePerShare = 'Must be > 0'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit() {
    if (!validate()) return
    setSaving(true)
    try { await onSave(form) } finally { setSaving(false) }
  }

  const portfolioOptions = activePortfolios.map((p) => {
    const name = p.portfolioName?.replace(/^PFL-/, '') || p.portfolioName
    const label = p.ownerName ? `${name} (${p.ownerName})` : name
    return { value: p.portfolioId, label }
  })
  const holdingOptions = holdings.map((h) => ({ value: h.symbol, label: `${h.symbol} — ${h.quantity} shares` }))

  return (
    <div className="space-y-4">
      <FormField label="Portfolio" required error={errors.portfolioId}>
        <FormSelect value={form.portfolioId} onChange={setPortfolio} options={portfolioOptions} placeholder="Select portfolio..." />
      </FormField>

      {signalDetail && (
        <div className="bg-amber-500/10 rounded-lg px-3 py-2.5 border border-amber-500/30">
          <p className="text-xs font-medium text-amber-400 mb-0.5">Signal Detail</p>
          <p className="text-xs text-[var(--text-secondary)]">{signalDetail}</p>
        </div>
      )}

      {holdingPeriod && (
        <div className={`rounded-lg px-3 py-2.5 border ${
          holdingPeriod.isLocked
            ? 'bg-red-500/10 border-red-500/30'
            : holdingPeriod.isLTCG
              ? 'bg-emerald-500/10 border-emerald-500/30'
              : holdingPeriod.daysToLTCG <= 60
                ? 'bg-amber-500/10 border-amber-500/30'
                : 'bg-[var(--bg-inset)] border-[var(--border-light)]'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-xs font-medium mb-0.5 ${holdingPeriod.isLocked ? 'text-red-400' : holdingPeriod.isLTCG ? 'text-emerald-400' : 'text-[var(--text-secondary)]'}`}>
                Holding Period: {holdingPeriod.daysHeld} days
              </p>
              <p className="text-xs text-[var(--text-dim)]">
                First bought: {holdingPeriod.firstBuyDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </div>
            <div className="text-right">
              {holdingPeriod.isLocked ? (
                <p className="text-xs font-semibold text-red-400">Min 30-day hold — {30 - holdingPeriod.daysHeld} days left</p>
              ) : holdingPeriod.isLTCG ? (
                <p className="text-xs font-semibold text-emerald-400">LTCG eligible (12.5% tax)</p>
              ) : holdingPeriod.daysToLTCG <= 60 ? (
                <p className="text-xs font-semibold text-amber-400">{holdingPeriod.daysToLTCG} days to LTCG</p>
              ) : (
                <p className="text-xs text-[var(--text-muted)]">STCG (20% tax) — {holdingPeriod.daysToLTCG} days to LTCG</p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Stock to Sell" required error={errors.symbol}>
          <FormSelect value={form.symbol} onChange={selectStock} options={holdingOptions} placeholder={form.portfolioId ? (holdings.length ? 'Select stock...' : 'No holdings in this portfolio') : 'Select portfolio first...'} />
        </FormField>
        {selectedHolding && (
          <div className="flex flex-col justify-end">
            <div className="bg-[var(--bg-inset)] rounded-lg px-3 py-2 border border-[var(--border-light)]">
              <p className="text-xs text-[var(--text-dim)]">{selectedHolding.companyName}</p>
              <p className="text-xs text-[var(--text-muted)]">
                Available: <span className="font-semibold text-[var(--text-primary)]">{availableQty}</span> shares
                @ {formatINR(selectedHolding.avgBuyPrice)} avg
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Sale Date" required error={errors.date}>
          <FormDateInput value={form.date} onChange={(v) => set('date', v)} />
        </FormField>
        <FormField label="Quantity to Sell" required error={errors.quantity}>
          <FormInput type="number" value={form.quantity} onChange={(v) => set('quantity', v)} placeholder={availableQty ? `Max: ${availableQty}` : ''} />
        </FormField>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Sale Price per Share (₹)" required error={errors.pricePerShare}>
          <FormInput type="number" value={form.pricePerShare} onChange={(v) => set('pricePerShare', v)} placeholder="e.g., 2750" />
        </FormField>
        <FormField label="Brokerage (₹)">
          <FormInput type="number" value={form.brokerage} onChange={(v) => set('brokerage', v)} placeholder="0" />
        </FormField>
      </div>

      {totalAmount > 0 && (
        <div className="bg-[var(--bg-inset)] rounded-lg px-3 py-2 border border-[var(--border-light)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-[var(--text-dim)]">Net Sale Amount</p>
              <p className="text-sm font-bold text-[var(--text-primary)] tabular-nums">{formatINR(netAmount)}</p>
            </div>
            {selectedHolding && (
              <div className="text-right">
                <p className="text-xs text-[var(--text-dim)]">Est. P&L</p>
                {(() => {
                  const costBasis = Number(form.quantity) * selectedHolding.avgBuyPrice
                  const pl = netAmount - costBasis
                  const up = pl >= 0
                  return <p className={`text-sm font-bold tabular-nums ${up ? 'text-emerald-400' : 'text-[var(--accent-rose)]'}`}>{up ? '+' : ''}{formatINR(pl)}</p>
                })()}
              </div>
            )}
          </div>
        </div>
      )}

      <FormField label="Notes">
        <FormInput value={form.notes} onChange={(v) => set('notes', v)} placeholder="Optional notes..." />
      </FormField>

      <FormActions onCancel={onCancel} onSubmit={handleSubmit} submitLabel={holdingPeriod?.isLocked ? `Locked (${30 - holdingPeriod.daysHeld}d left)` : 'Sell Stock'} loading={saving} disabled={holdingPeriod?.isLocked} />
    </div>
  )
}
