import { useState, useMemo } from 'react'
import { useData } from '../../context/DataContext'
import { useFamily } from '../../context/FamilyContext'
import { formatINR } from '../../data/familyData'
import { FormField, FormInput, FormDateInput, FormSelect, FormActions } from '../Modal'
import StockSearchInput from './StockSearchInput'

export default function BuyStockForm({ portfolioId, onSave, onCancel }) {
  const { stockPortfolios } = useData()
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
    exchange: 'NSE',
    date: new Date().toISOString().split('T')[0],
    quantity: '',
    pricePerShare: '',
    brokerage: '0',
    notes: '',
  })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  function set(key, val) {
    setForm((f) => ({ ...f, [key]: val }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  const totalAmount = useMemo(() => {
    const qty = Number(form.quantity) || 0
    const price = Number(form.pricePerShare) || 0
    return qty * price
  }, [form.quantity, form.pricePerShare])

  const netAmount = useMemo(() => {
    return totalAmount + (Number(form.brokerage) || 0)
  }, [totalAmount, form.brokerage])

  function validate() {
    const e = {}
    if (!form.portfolioId) e.portfolioId = 'Required'
    if (!form.symbol.trim()) e.symbol = 'Required'
    if (!form.companyName.trim()) e.companyName = 'Required'
    if (!form.date) e.date = 'Required'
    if (!form.quantity || Number(form.quantity) <= 0) e.quantity = 'Must be > 0'
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

  return (
    <div className="space-y-4">
      <FormField label="Portfolio" required error={errors.portfolioId}>
        <FormSelect value={form.portfolioId} onChange={(v) => set('portfolioId', v)} options={portfolioOptions} placeholder="Select portfolio..." />
      </FormField>

      <FormField label="Stock" required error={errors.symbol}>
        <StockSearchInput
          value={form.symbol ? { symbol: form.symbol, companyName: form.companyName, sector: form.sector, price: form.currentPrice } : null}
          onSelect={(stock) => {
            setForm((f) => ({
              ...f,
              symbol: stock.symbol || '',
              companyName: stock.companyName || '',
              sector: stock.sector || '',
              currentPrice: stock.price || f.currentPrice || 0,
            }))
            setErrors((e) => ({ ...e, symbol: undefined, companyName: undefined }))
          }}
          placeholder="Search by symbol or company name..."
        />
      </FormField>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <FormField label="Purchase Date" required error={errors.date}>
          <FormDateInput value={form.date} onChange={(v) => set('date', v)} />
        </FormField>
        <FormField label="Quantity (Shares)" required error={errors.quantity}>
          <FormInput type="number" value={form.quantity} onChange={(v) => set('quantity', v)} placeholder="e.g., 100" />
        </FormField>
        <FormField label="Price per Share (₹)" required error={errors.pricePerShare}>
          <FormInput type="number" value={form.pricePerShare} onChange={(v) => set('pricePerShare', v)} placeholder="e.g., 2500" />
        </FormField>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Brokerage (₹)">
          <FormInput type="number" value={form.brokerage} onChange={(v) => set('brokerage', v)} placeholder="0" />
        </FormField>
        <div className="flex flex-col justify-end">
          <div className="bg-[var(--bg-inset)] rounded-lg px-3 py-2 border border-[var(--border-light)]">
            <p className="text-xs text-[var(--text-dim)]">Total Amount</p>
            <p className="text-sm font-bold text-[var(--text-primary)] tabular-nums">{formatINR(totalAmount)}</p>
            {Number(form.brokerage) > 0 && (
              <p className="text-xs text-[var(--text-muted)] tabular-nums">Net: {formatINR(netAmount)}</p>
            )}
          </div>
        </div>
      </div>

      <FormField label="Notes">
        <FormInput value={form.notes} onChange={(v) => set('notes', v)} placeholder="Optional notes..." />
      </FormField>

      <FormActions onCancel={onCancel} onSubmit={handleSubmit} submitLabel="Buy Stock" loading={saving} />
    </div>
  )
}
