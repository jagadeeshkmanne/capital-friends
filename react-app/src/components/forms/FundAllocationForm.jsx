import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { splitFundName } from '../../data/familyData'
import { FormActions } from '../Modal'

const ASSET_FIELDS = ['Equity', 'Debt', 'Cash', 'Commodities', 'Real Estate', 'Other']
const CAP_FIELDS = ['Giant', 'Large', 'Mid', 'Small', 'Micro']
const GEO_FIELDS = ['India', 'Global']

const ASSET_COLORS = { Equity: '#8b5cf6', Debt: '#3b82f6', Cash: '#22c55e', Commodities: '#f59e0b', 'Real Estate': '#ec4899', Other: '#94a3b8' }
const CAP_COLORS = { Giant: '#6366f1', Large: '#3b82f6', Mid: '#f59e0b', Small: '#ef4444', Micro: '#ec4899' }
const GEO_COLORS = { India: '#f59e0b', Global: '#3b82f6' }

// Tolerance-based 100% check (handles floating point: 99.97, 100.03 etc)
const isClose100 = (v) => Math.abs(v - 100) < 0.5

export default function FundAllocationForm({ fund, initial, onSave, onCancel }) {
  const [asset, setAsset] = useState(() => {
    const base = {}
    ASSET_FIELDS.forEach(k => { base[k] = initial?.assetAllocation?.[k] || 0 })
    if (initial?.assetAllocation) {
      Object.keys(initial.assetAllocation).forEach(k => {
        if (!(k in base)) base[k] = initial.assetAllocation[k]
      })
    }
    return base
  })

  const [cap, setCap] = useState(() => {
    const base = {}
    CAP_FIELDS.forEach(k => { base[k] = initial?.equityAllocation?.[k] || 0 })
    if (initial?.equityAllocation) {
      Object.keys(initial.equityAllocation).forEach(k => {
        if (!(k in base)) base[k] = initial.equityAllocation[k]
      })
    }
    return base
  })

  const [geo, setGeo] = useState(() => {
    const base = {}
    GEO_FIELDS.forEach(k => { base[k] = initial?.geoAllocation?.[k] || 0 })
    if (initial?.geoAllocation) {
      Object.keys(initial.geoAllocation).forEach(k => {
        if (!(k in base)) base[k] = initial.geoAllocation[k]
      })
    }
    return base
  })

  const [saving, setSaving] = useState(false)

  const assetTotal = Object.values(asset).reduce((s, v) => s + v, 0)
  const capTotal = Object.values(cap).reduce((s, v) => s + v, 0)
  const geoTotal = Object.values(geo).reduce((s, v) => s + v, 0)
  const assetValid = assetTotal === 0 || assetTotal > 0
  const canSave = assetValid

  // Auto-normalize a set of values to sum to 100%
  function normalize(obj, total) {
    if (total === 0 || isClose100(total)) return obj
    const scale = 100 / total
    const result = {}
    Object.entries(obj).forEach(([k, v]) => { result[k] = Math.round(v * scale * 100) / 100 })
    return result
  }

  async function handleSave() {
    if (!canSave) return
    setSaving(true)
    try {
      // Normalize all sections to 100% on save
      const normAsset = normalize(asset, assetTotal)
      const normCap = normalize(cap, capTotal)
      const normGeo = normalize(geo, geoTotal)
      const data = {
        fundCode: fund.fundCode,
        fundName: fund.fundName,
        equity: normAsset.Equity || 0,
        debt: normAsset.Debt || 0,
        cash: normAsset.Cash || 0,
        commodities: normAsset.Commodities || 0,
        realEstate: normAsset['Real Estate'] || 0,
        other: normAsset.Other || 0,
        customAsset: {},
        giantCap: normCap.Giant || 0,
        largeCap: normCap.Large || 0,
        midCap: normCap.Mid || 0,
        smallCap: normCap.Small || 0,
        microCap: normCap.Micro || 0,
        customCap: {},
        geoIndia: normGeo.India || 0,
        geoGlobal: normGeo.Global || 0,
        customGeo: {},
      }
      Object.entries(normAsset).forEach(([k, v]) => { if (!ASSET_FIELDS.includes(k) && v > 0) data.customAsset[k] = v })
      Object.entries(normCap).forEach(([k, v]) => { if (!CAP_FIELDS.includes(k) && v > 0) data.customCap[k] = v })
      Object.entries(normGeo).forEach(([k, v]) => { if (!GEO_FIELDS.includes(k) && v > 0) data.customGeo[k] = v })
      await onSave(data)
    } finally { setSaving(false) }
  }

  return (
    <div className="space-y-5">
      {/* Fund header */}
      <div className="bg-[var(--bg-inset)] rounded-lg px-4 py-2.5">
        <p className="text-sm font-bold text-[var(--text-primary)] truncate">{splitFundName(fund.fundName).main}</p>
        {splitFundName(fund.fundName).plan && <p className="text-xs text-[var(--text-dim)]">{splitFundName(fund.fundName).plan}</p>}
        <p className="text-xs text-[var(--text-dim)] tabular-nums mt-0.5">{fund.fundCode}</p>
      </div>
      <p className="text-xs text-[var(--text-dim)] px-1">Copy allocation data from <span className="font-semibold text-[var(--text-muted)]">morningstar.in</span> → Fund → Portfolio tab. All sections are auto-normalized to 100% on save.</p>

      {/* 3-column layout: Asset Class | Market Cap | Geography */}
      <div className="grid grid-cols-3 gap-4">
        <AllocSection
          title="Asset Class"
          fields={asset}
          setFields={setAsset}
          standardKeys={ASSET_FIELDS}
          colors={ASSET_COLORS}
          total={assetTotal}
          valid={true}
          autoNormalize
        />

        <AllocSection
          title="Market Cap"
          fields={cap}
          setFields={setCap}
          standardKeys={CAP_FIELDS}
          colors={CAP_COLORS}
          total={capTotal}
          valid={true}
          autoNormalize
        />

        <AllocSection
          title="Geography"
          fields={geo}
          setFields={setGeo}
          standardKeys={GEO_FIELDS}
          colors={GEO_COLORS}
          total={geoTotal}
          valid={true}
          autoNormalize
        />
      </div>

      <FormActions onCancel={onCancel} onSubmit={handleSave} submitLabel="Save" loading={saving} disabled={!canSave} />
    </div>
  )
}

/* ── Compact allocation column ── */
function AllocSection({ title, fields, setFields, standardKeys, colors, total, valid, autoNormalize }) {
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newValue, setNewValue] = useState('')

  const [rawInputs, setRawInputs] = useState({})

  function setValue(key, raw) {
    setRawInputs(prev => ({ ...prev, [key]: raw }))
    if (raw === '' || raw === '.') {
      setFields(prev => ({ ...prev, [key]: 0 }))
    } else if (!isNaN(Number(raw))) {
      setFields(prev => ({ ...prev, [key]: Number(raw) }))
    }
  }

  function displayVal(key) {
    if (key in rawInputs) return rawInputs[key]
    const v = fields[key]
    return v ? String(v) : ''
  }

  function handleBlur(key) {
    setRawInputs(prev => { const next = { ...prev }; delete next[key]; return next })
  }

  function addCustomField() {
    const name = newName.trim()
    if (!name || name in fields) return
    setFields(prev => ({ ...prev, [name]: Number(newValue) || 0 }))
    setNewName(''); setNewValue(''); setAdding(false)
  }

  function removeCustomField(key) {
    setFields(prev => { const next = { ...prev }; delete next[key]; return next })
  }

  const standard = Object.keys(fields).filter(k => standardKeys.includes(k))
  const custom = Object.keys(fields).filter(k => !standardKeys.includes(k))
  const allKeys = [...standard, ...custom]
  const close100 = isClose100(total)
  const needsNormalize = total > 0 && !close100
  const displayTotal = Math.round(total * 100) / 100

  return (
    <div className="bg-[var(--bg-inset)] rounded-lg p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{title}</p>
        <div className="flex items-center gap-2">
          {needsNormalize && (
            <button
              onClick={() => {
                const scale = 100 / total
                setFields(prev => {
                  const next = {}
                  Object.entries(prev).forEach(([k, v]) => { next[k] = Math.round(v * scale * 100) / 100 })
                  return next
                })
              }}
              className="text-[10px] font-medium text-violet-400 hover:text-violet-300 transition-colors px-1.5 py-0.5 rounded border border-violet-400/30 hover:border-violet-400/60"
            >
              Normalize
            </button>
          )}
          <span className={`text-xs tabular-nums font-medium ${close100 ? 'text-emerald-400' : (autoNormalize || total === 0) ? 'text-[var(--text-dim)]' : !valid ? 'text-rose-400' : 'text-[var(--text-dim)]'}`}>
            {displayTotal}%{close100 ? ' ✓' : autoNormalize && needsNormalize ? ' → 100%' : !valid && !autoNormalize ? ' ✗' : ''}
          </span>
        </div>
      </div>

      {/* Stacked bar */}
      <div className="h-1.5 rounded-full overflow-hidden flex gap-px mb-3" style={{ background: 'var(--bg-card)' }}>
        {allKeys.filter(k => fields[k] > 0).map(k => (
          <div key={k} className="h-full rounded-sm transition-all" style={{
            width: `${(fields[k] / Math.max(total, 1)) * 100}%`,
            background: colors[k] || '#94a3b8',
          }} />
        ))}
      </div>

      {/* Rows */}
      <div className="space-y-2">
        {allKeys.map(key => {
          const isCustom = !standardKeys.includes(key)
          const color = colors[key] || '#94a3b8'
          return (
            <div key={key} className="flex items-center gap-2 group">
              <div className="w-2 h-2 rounded-sm shrink-0" style={{ background: color }} />
              <span className="text-xs text-[var(--text-secondary)] flex-1 truncate">{key}</span>
              {isCustom && (
                <button onClick={() => removeCustomField(key)} className="opacity-0 group-hover:opacity-100 text-[var(--text-dim)] hover:text-rose-400 transition-all shrink-0"><X size={11} /></button>
              )}
              <input
                type="text" inputMode="decimal"
                value={displayVal(key)}
                onChange={e => setValue(key, e.target.value)}
                onBlur={() => handleBlur(key)}
                placeholder="0"
                className="w-20 px-2 py-1.5 text-sm bg-[var(--bg-input)] border border-[var(--border-input)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--sidebar-active-text)] focus:ring-1 focus:ring-[var(--sidebar-active-text)] transition-colors tabular-nums text-center shrink-0"
              />
            </div>
          )
        })}

        {/* Add custom field */}
        {!adding ? (
          <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 text-xs text-[var(--text-dim)] hover:text-violet-400 transition-colors pl-0.5">
            <Plus size={12} /> Add
          </button>
        ) : (
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-sm shrink-0 border border-dashed border-violet-400/50" />
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addCustomField(); if (e.key === 'Escape') { setAdding(false); setNewName(''); setNewValue('') } }}
              placeholder="Name"
              className="flex-1 min-w-0 text-xs bg-transparent border-b border-violet-400/30 text-[var(--text-primary)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-violet-400 py-0.5"
            />
            <input
              type="text" inputMode="decimal"
              value={newValue}
              onChange={e => setNewValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addCustomField(); if (e.key === 'Escape') { setAdding(false); setNewName(''); setNewValue('') } }}
              placeholder="0"
              className="w-20 px-2 py-1.5 text-sm bg-[var(--bg-input)] border border-[var(--border-input)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--sidebar-active-text)] transition-colors tabular-nums text-center shrink-0"
            />
            <button onClick={addCustomField} className="p-0.5 text-emerald-400 hover:text-emerald-300 shrink-0"><Plus size={13} /></button>
            <button onClick={() => { setAdding(false); setNewName(''); setNewValue('') }} className="p-0.5 text-[var(--text-dim)] hover:text-rose-400 shrink-0"><X size={13} /></button>
          </div>
        )}
      </div>
    </div>
  )
}
