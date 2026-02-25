import { useState, useMemo } from 'react'
import { useData } from '../../context/DataContext'
import { useFamily } from '../../context/FamilyContext'
import { formatINR } from '../../data/familyData'
import { FormField, FormInput, FormSelect, FormActions } from '../Modal'

export default function SellStockForm({ portfolioId, onSave, onCancel }) {
  const { stockPortfolios, stockHoldings } = useData()
  const { selectedMember } = useFamily()

  // Filter portfolios by header's selected member
  const activePortfolios = useMemo(() => {
    const active = stockPortfolios.filter((p) => p.status === 'Active')
    return selectedMember === 'all' ? active : active.filter((p) => p.ownerId === selectedMember)
  }, [stockPortfolios, selectedMember])

  const [form, setForm] = useState({
    portfolioId: portfolioId || '',
    symbol: '',
    companyName: '',
    date: new Date().toISOString().split('T')[0],
    quantity: '',
    pricePerShare: '',
    brokerage: '0',
    notes: '',
  })
  const [errors, setErrors] = useState({})

  function set(key, val) {
    setForm((f) => ({ ...f, [key]: val }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  // Holdings for selected portfolio
  const holdings = useMemo(() => {
    if (!form.portfolioId) return []
    return stockHoldings.filter((h) => h.portfolioId === form.portfolioId && h.quantity > 0)
  }, [stockHoldings, form.portfolioId])

  const selectedHolding = holdings.find((h) => h.symbol === form.symbol)
  const availableQty = selectedHolding?.quantity || 0

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
    // Reset stock selection when portfolio changes
    setForm((f) => ({ ...f, portfolioId: val, symbol: '', companyName: '', quantity: '' }))
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

  function handleSubmit() {
    if (!validate()) return
    onSave(form)
  }

  const portfolioOptions = activePortfolios.map((p) => ({ value: p.portfolioId, label: `${p.portfolioName} (${p.ownerName})` }))
  const holdingOptions = holdings.map((h) => ({ value: h.symbol, label: `${h.symbol} — ${h.quantity} shares` }))

  return (
    <div className="space-y-4">
      <FormField label="Portfolio" required error={errors.portfolioId}>
        <FormSelect value={form.portfolioId} onChange={setPortfolio} options={portfolioOptions} placeholder="Select portfolio..." />
      </FormField>

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
          <FormInput type="date" value={form.date} onChange={(v) => set('date', v)} />
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

      <FormActions onCancel={onCancel} onSubmit={handleSubmit} submitLabel="Sell Stock" />
    </div>
  )
}
