import { useState } from 'react'
import { Plus, X, Save } from 'lucide-react'
import { splitFundName } from '../../data/familyData'

const ASSET_FIELDS = ['Equity', 'Debt', 'Cash', 'Commodities', 'Real Estate', 'Other']
const CAP_FIELDS = ['Giant', 'Large', 'Mid', 'Small', 'Micro']
const GEO_FIELDS = ['India', 'Global']

export default function FundAllocationForm({ fund, initial, onSave, onCancel }) {
  // Initialize from existing data
  const [asset, setAsset] = useState(() => {
    const base = {}
    ASSET_FIELDS.forEach(k => { base[k] = initial?.assetAllocation?.[k] || 0 })
    // Include any custom keys from existing data
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
  const equityPct = asset.Equity || 0

  const assetValid = assetTotal === 100 || assetTotal === 0
  const capValid = capTotal === 100 || capTotal === 0 || equityPct === 0
  const geoValid = geoTotal === 100 || geoTotal === 0 || equityPct === 0
  const canSave = assetValid && capValid && geoValid

  async function handleSave() {
    if (!canSave) return
    setSaving(true)
    try {
      // Build flat data matching GAS backend expectations
      const data = {
        fundCode: fund.fundCode,
        fundName: fund.fundName,
        equity: asset.Equity || 0,
        debt: asset.Debt || 0,
        cash: asset.Cash || 0,
        commodities: asset.Commodities || 0,
        realEstate: asset['Real Estate'] || 0,
        // Include custom asset fields
        customAsset: {},
        giantCap: cap.Giant || 0,
        largeCap: cap.Large || 0,
        midCap: cap.Mid || 0,
        smallCap: cap.Small || 0,
        microCap: cap.Micro || 0,
        customCap: {},
        geoIndia: geo.India || 0,
        geoGlobal: geo.Global || 0,
        customGeo: {},
      }
      // Collect custom fields (non-standard keys)
      Object.entries(asset).forEach(([k, v]) => { if (!ASSET_FIELDS.includes(k) && v > 0) data.customAsset[k] = v })
      Object.entries(cap).forEach(([k, v]) => { if (!CAP_FIELDS.includes(k) && v > 0) data.customCap[k] = v })
      Object.entries(geo).forEach(([k, v]) => { if (!GEO_FIELDS.includes(k) && v > 0) data.customGeo[k] = v })

      await onSave(data)
    } finally { setSaving(false) }
  }

  return (
    <div className="space-y-5">
      {/* Fund header */}
      <div className="bg-[var(--bg-inset)] rounded-lg px-4 py-2.5">
        <div>
          <p className="text-xs font-bold text-[var(--text-primary)] truncate">{splitFundName(fund.fundName).main}</p>
          {splitFundName(fund.fundName).plan && <p className="text-[10px] text-[var(--text-dim)]">{splitFundName(fund.fundName).plan}</p>}
        </div>
        <p className="text-[10px] text-[var(--text-dim)] tabular-nums mt-0.5">{fund.fundCode}</p>
      </div>

      {/* Asset Class Section */}
      <AllocSection
        title="Asset Class %"
        fields={asset}
        setFields={setAsset}
        standardKeys={ASSET_FIELDS}
        total={assetTotal}
        valid={assetValid}
      />

      {/* Market Cap Section — only when Equity > 0 */}
      {equityPct > 0 && (
        <AllocSection
          title="Market Cap %"
          subtitle="Equity breakdown"
          fields={cap}
          setFields={setCap}
          standardKeys={CAP_FIELDS}
          total={capTotal}
          valid={capValid}
        />
      )}

      {/* Geography Section — only when Equity > 0 */}
      {equityPct > 0 && (
        <AllocSection
          title="Geography %"
          fields={geo}
          setFields={setGeo}
          standardKeys={GEO_FIELDS}
          total={geoTotal}
          valid={geoValid}
        />
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border-light)]">
        <button onClick={onCancel} disabled={saving} className="px-4 py-2 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-hover)] transition-colors disabled:opacity-40">
          Cancel
        </button>
        <button onClick={handleSave} disabled={saving || !canSave}
          className="flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-500 rounded-lg transition-colors disabled:opacity-50">
          {saving ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={12} />}
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  )
}

/* ── Reusable allocation section with add-field support ── */
function AllocSection({ title, subtitle, fields, setFields, standardKeys, total, valid }) {
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')

  function setValue(key, val) {
    setFields(prev => ({ ...prev, [key]: Number(val) || 0 }))
  }

  function addCustomField() {
    const name = newName.trim()
    if (!name || name in fields) return
    setFields(prev => ({ ...prev, [name]: 0 }))
    setNewName('')
    setAdding(false)
  }

  function removeCustomField(key) {
    setFields(prev => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  const allKeys = Object.keys(fields)

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">{title}</p>
        {subtitle && <p className="text-[10px] text-[var(--text-dim)]">({subtitle})</p>}
      </div>
      <div className="flex flex-wrap gap-2 mb-1.5">
        {allKeys.map(key => {
          const isCustom = !standardKeys.includes(key)
          return (
            <div key={key} className="relative">
              <label className="block text-[10px] text-[var(--text-dim)] mb-0.5 flex items-center gap-1">
                {key}
                {isCustom && (
                  <button onClick={() => removeCustomField(key)} className="text-[var(--text-dim)] hover:text-rose-400 transition-colors">
                    <X size={8} />
                  </button>
                )}
              </label>
              <input
                type="number" min="0" max="100"
                value={fields[key] || ''}
                onChange={e => setValue(key, e.target.value)}
                className="w-[72px] px-1.5 py-1 text-xs bg-[var(--bg-input)] border border-[var(--border-input)] text-[var(--text-primary)] rounded-md tabular-nums text-center focus:outline-none focus:border-[var(--sidebar-active-text)] focus:ring-1 focus:ring-[var(--sidebar-active-text)] transition-colors"
              />
            </div>
          )
        })}
      </div>

      <div className="flex items-center justify-between">
        <p className={`text-[10px] tabular-nums ${valid ? 'text-[var(--text-dim)]' : 'text-[var(--accent-rose)] font-semibold'}`}>
          Total: {total}% {!valid && '— must equal 100%'}
          {valid && total === 100 && <span className="text-emerald-400 ml-1">&#10003;</span>}
        </p>

        {!adding ? (
          <button onClick={() => setAdding(true)} className="flex items-center gap-0.5 text-[10px] font-semibold text-violet-400 hover:text-violet-300 transition-colors">
            <Plus size={10} /> Add Field
          </button>
        ) : (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addCustomField(); if (e.key === 'Escape') setAdding(false) }}
              placeholder="Field name"
              className="w-24 px-1.5 py-0.5 text-[10px] bg-[var(--bg-input)] border border-[var(--border-input)] text-[var(--text-primary)] rounded-md focus:outline-none focus:border-[var(--sidebar-active-text)]"
            />
            <button onClick={addCustomField} className="text-[10px] font-semibold text-emerald-400 hover:text-emerald-300">Add</button>
            <button onClick={() => { setAdding(false); setNewName('') }} className="text-[10px] text-[var(--text-dim)] hover:text-[var(--text-primary)]"><X size={10} /></button>
          </div>
        )}
      </div>
    </div>
  )
}
