// Native-feel building blocks for phones, in the app's own theme (navy / violet / emerald, light + dark).
// Desktop keeps its current look; these are used where a screen has a phone layout.
//   useIsPhone      true below 1024 px (same breakpoint as the bottom tab bar)
//   Sheet           bottom sheet you can drag down to close (Vaul), with a handle and safe-area padding
//   ActionSheet     a list of actions in a bottom sheet (the phone version of a "⋯" menu)
//   Group / Row     iOS-style grouped list with inset dividers
//   Segmented       pill segmented control
//   Screen          a pushed screen: slides in from the right, sets the app bar title + back arrow
//   StickyBar       bottom action bar above the tab bar (Invest / Redeem)
//   Money           ₹ value with + / − colour
import { useEffect, useState, useSyncExternalStore } from 'react'
import { Drawer } from 'vaul'
import { motion } from 'motion/react'
import { ChevronRight } from 'lucide-react'

const PHONE_Q = '(max-width: 1023.98px)'
export function useIsPhone() {
  const get = () => typeof window !== 'undefined' && window.matchMedia(PHONE_Q).matches
  const [v, setV] = useState(get)
  useEffect(() => {
    const m = window.matchMedia(PHONE_Q)
    const on = () => setV(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [])
  return v
}

// ── app bar override: a pushed screen tells the header its title and what Back does ──
let bar = null
const subs = new Set()
export function setPhoneBar(next) { bar = next; subs.forEach((f) => f()) }
export function usePhoneBar() { return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f) }, () => bar, () => null) }

/** A pushed screen. Slides in from the right like a native stack, and owns the app bar while open. */
export function Screen({ title, subtitle, onBack, right, footer, children, k }) {
  useEffect(() => {
    setPhoneBar({ title, subtitle, onBack, right, footer })
    return () => setPhoneBar(null)
  }, [title, subtitle, onBack, right, footer])
  return (
    <motion.div key={k} initial={{ x: '35%', opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 420, damping: 40, mass: 0.8 }}>
      {children}
    </motion.div>
  )
}

/** Fade-up for tab content changes (segmented control). */
export function FadeIn({ k, children }) {
  return <motion.div key={k} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>{children}</motion.div>
}

export function Sheet({ open, onClose, title, children, full, footer }) {
  return (
    <Drawer.Root open={open} onOpenChange={(o) => { if (!o) onClose?.() }} repositionInputs={false}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-[60] bg-black/55" />
        <Drawer.Content aria-describedby={undefined}
          className={`fixed inset-x-0 bottom-0 z-[61] flex flex-col rounded-t-[22px] bg-[var(--bg-card)] border-t border-[var(--border)] outline-none ${full ? 'h-[94dvh]' : 'max-h-[92dvh]'}`}>
          <div className="mx-auto mt-2 mb-1 h-[5px] w-10 shrink-0 rounded-full bg-[var(--text-dim)]/40" />
          {title ? <Drawer.Title className="px-5 pt-1.5 pb-2 text-[17px] font-semibold text-[var(--text-primary)] shrink-0">{title}</Drawer.Title> : <Drawer.Title className="sr-only">Sheet</Drawer.Title>}
          <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-4">{children}</div>
          {footer && <div className="shrink-0 px-5 pt-2 border-t border-[var(--border-light)]" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}>{footer}</div>}
          {!footer && <div className="shrink-0" style={{ height: 'env(safe-area-inset-bottom)' }} />}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}

/** items: [{ label, icon: Icon, onClick, danger, hint, on }] or null for a gap */
export function ActionSheet({ open, onClose, title, items = [] }) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="rounded-2xl bg-[var(--bg-inset)] overflow-hidden">
        {items.filter(Boolean).map((it, i) => {
          const I = it.icon
          return (
            <button key={it.label} type="button" onClick={() => { onClose?.(); setTimeout(() => it.onClick?.(), 180) }}
              className={`w-full flex items-center gap-3 px-4 min-h-[52px] text-left active:bg-[var(--bg-hover)] ${i ? 'border-t border-[var(--border-light)]' : ''} ${it.danger ? 'text-rose-400' : 'text-[var(--text-primary)]'}`}>
              {I && <I size={19} className={it.danger ? '' : 'text-violet-400'} />}
              <span className="flex-1 text-[15px]">{it.label}{it.hint && <span className="block text-xs text-[var(--text-dim)]">{it.hint}</span>}</span>
              {it.on != null && <Switch on={it.on} />}
            </button>
          )
        })}
      </div>
      <button type="button" onClick={onClose} className="mt-3 w-full min-h-[50px] rounded-2xl bg-[var(--bg-inset)] text-[15px] font-semibold text-[var(--text-primary)] active:bg-[var(--bg-hover)]">Cancel</button>
    </Sheet>
  )
}

export function Switch({ on }) {
  return <span className={`relative inline-block w-[44px] h-[26px] rounded-full transition-colors ${on ? 'bg-emerald-500' : 'bg-[var(--text-dim)]/35'}`}><span className={`absolute top-[3px] h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'left-[21px]' : 'left-[3px]'}`} /></span>
}

export function GroupTitle({ children, right }) {
  return <div className="flex items-end justify-between px-1 pt-5 pb-2"><h3 className="text-[13px] font-semibold uppercase tracking-wide text-[var(--text-dim)]">{children}</h3>{right}</div>
}
export function Group({ children, className = '' }) {
  return <div className={`rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] overflow-hidden ${className}`}>{children}</div>
}
/** One list row. lead = icon/avatar, title / sub on the left, value / note on the right. */
export function Row({ lead, title, sub, value, note, noteClass = '', onClick, chevron = !!onClick, first, children }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag type={onClick ? 'button' : undefined} onClick={onClick} className={`w-full flex items-center gap-3 pl-4 text-left ${onClick ? 'active:bg-[var(--bg-hover)] transition-colors' : ''}`}>
      {lead && <div className="shrink-0">{lead}</div>}
      <div className={`flex-1 min-w-0 flex items-center gap-2 pr-3 py-3 min-h-[60px] ${first ? '' : 'border-t border-[var(--border-light)]'}`}>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-medium text-[var(--text-primary)] leading-snug line-clamp-2">{title}</p>
          {sub && <div className="mt-0.5 text-[13px] text-[var(--text-dim)] leading-snug">{sub}</div>}
          {children}
        </div>
        {(value != null || note != null) && (
          <div className="shrink-0 text-right tabular-nums">
            {value != null && <p className="text-[15px] font-semibold text-[var(--text-primary)]">{value}</p>}
            {note != null && <p className={`text-[13px] font-medium ${noteClass}`}>{note}</p>}
          </div>
        )}
        {chevron && <ChevronRight size={18} className="shrink-0 text-[var(--text-dim)]/70 -mr-1" />}
      </div>
    </Tag>
  )
}

export function Avatar({ text, color = '#8b5cf6' }) {
  return <span className="flex h-10 w-10 items-center justify-center rounded-full text-[15px] font-bold" style={{ background: `${color}26`, color }}>{String(text || '?').trim().charAt(0).toUpperCase()}</span>
}

export function Segmented({ value, onChange, options }) {
  return (
    <div className="flex p-[3px] rounded-xl bg-[var(--bg-inset)] border border-[var(--border-light)]">
      {options.map(([k, label]) => (
        <button key={k} type="button" onClick={() => onChange(k)} className="relative flex-1 h-9 text-[14px] font-semibold">
          {value === k && <motion.span layoutId="seg-pill" className="absolute inset-0 rounded-[10px] bg-[var(--bg-card)] shadow-sm border border-[var(--border)]" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
          <span className={`relative ${value === k ? 'text-[var(--text-primary)]' : 'text-[var(--text-dim)]'}`}>{label}</span>
        </button>
      ))}
    </div>
  )
}

/** Bottom action bar that sits on top of the tab bar. */
export function StickyBar({ children }) {
  return (
    <>
      <div className="h-20" />
      <div className="lg:hidden fixed inset-x-0 z-30 px-4 py-2.5 bg-[var(--bg-base)]/92 backdrop-blur-md border-t border-[var(--border)]" style={{ bottom: 'calc(60px + env(safe-area-inset-bottom))' }}>
        <div className="flex gap-3">{children}</div>
      </div>
    </>
  )
}
export function Btn({ children, onClick, kind = 'primary', icon: I }) {
  const cls = kind === 'primary' ? 'bg-violet-600 text-white active:bg-violet-700' : kind === 'green' ? 'bg-emerald-600 text-white active:bg-emerald-700' : 'bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border-input)] active:bg-[var(--bg-hover)]'
  return <button type="button" onClick={onClick} className={`flex-1 h-12 rounded-xl text-[15px] font-semibold flex items-center justify-center gap-1.5 transition-colors ${cls}`}>{I && <I size={17} />}{children}</button>
}

export const upCls = (v) => (v >= 0 ? 'text-emerald-400' : 'text-[var(--accent-rose)]')
export const signed = (v, fmt) => `${v >= 0 ? '+' : '−'}${fmt(Math.abs(v))}`
