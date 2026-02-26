import { useEffect, useRef } from 'react'
import { X, Calendar } from 'lucide-react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { useMask } from '../context/MaskContext'

export default function Modal({ open, onClose, title, children, wide }) {
  const overlayRef = useRef(null)

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    if (open) window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div ref={overlayRef} className="fixed inset-0 z-50 flex items-start justify-center pt-[5vh] sm:pt-[10vh] px-4" onClick={(e) => { if (e.target === overlayRef.current) onClose() }}>
      <div className="fixed inset-0 bg-black/60" />
      <div className={`relative bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-2xl w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} max-h-[80vh] flex flex-col animate-fade-in`}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-light)] shrink-0">
          <h2 className="text-sm font-bold text-[var(--text-primary)]">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors">
            <X size={16} />
          </button>
        </div>
        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {children}
        </div>
      </div>
    </div>
  )
}

// Reusable form field components
export function FormField({ label, required, error, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">
        {label}{required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-rose-500 mt-1">{error}</p>}
    </div>
  )
}

export function FormInput({ value, onChange, placeholder, type = 'text', sensitive, ...props }) {
  const { masked } = useMask()
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full px-3 py-2 text-sm bg-[var(--bg-input)] border border-[var(--border-input)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--sidebar-active-text)] focus:ring-1 focus:ring-[var(--sidebar-active-text)] transition-colors ${sensitive && masked ? 'sensitive-blur' : ''}`}
      {...props}
    />
  )
}

export function FormDateInput({ value, onChange, ...props }) {
  // Convert YYYY-MM-DD string to Date object for react-datepicker
  const dateValue = value ? new Date(value + 'T00:00:00') : null

  function handleChange(date) {
    if (!date) { onChange(''); return }
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    onChange(`${y}-${m}-${d}`)
  }

  return (
    <div className="relative cf-datepicker">
      <DatePicker
        selected={dateValue}
        onChange={handleChange}
        dateFormat="dd MMM yyyy"
        maxDate={new Date()}
        showMonthDropdown
        showYearDropdown
        dropdownMode="select"
        placeholderText="Select date"
        className="w-full px-3 py-2 pr-9 text-sm bg-[var(--bg-input)] border border-[var(--border-input)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--sidebar-active-text)] focus:ring-1 focus:ring-[var(--sidebar-active-text)] transition-colors"
        {...props}
      />
      <Calendar size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)] pointer-events-none" />
    </div>
  )
}

export function FormSelect({ value, onChange, options, placeholder }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 text-sm bg-[var(--bg-input)] border border-[var(--border-input)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--sidebar-active-text)] focus:ring-1 focus:ring-[var(--sidebar-active-text)] transition-colors"
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  )
}

export function FormTextarea({ value, onChange, placeholder, rows = 3 }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full px-3 py-2 text-sm bg-[var(--bg-input)] border border-[var(--border-input)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--sidebar-active-text)] focus:ring-1 focus:ring-[var(--sidebar-active-text)] transition-colors resize-none"
    />
  )
}

export function FormCheckbox({ checked, onChange, label }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 rounded border-[var(--border-input)] bg-[var(--bg-input)] text-violet-500 focus:ring-violet-500"
      />
      <span className="text-sm text-[var(--text-secondary)]">{label}</span>
    </label>
  )
}

export function FormActions({ onCancel, onSubmit, submitLabel = 'Save', loading }) {
  return (
    <div className="flex items-center justify-end gap-2 pt-4 mt-4 border-t border-[var(--border-light)]">
      <button onClick={onCancel} disabled={loading} className="px-4 py-2 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-hover)] transition-colors disabled:opacity-40">
        Cancel
      </button>
      <button onClick={onSubmit} disabled={loading} className="px-5 py-2 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-500 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5">
        {loading && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
        {loading ? 'Saving...' : submitLabel}
      </button>
    </div>
  )
}

export function DeleteButton({ onClick, label = 'Deactivate' }) {
  return (
    <button onClick={onClick} className="px-4 py-2 text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition-colors">
      {label}
    </button>
  )
}
