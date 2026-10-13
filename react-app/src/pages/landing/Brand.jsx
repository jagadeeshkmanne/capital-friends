// Capital Friends logo: three rising bars topped with heads — a family that is also a growth chart —
// inside a rounded tile (violet → teal). Works from 16px (favicon) to large.
// Our own Capital Friends logo (public/logo-new.png, trimmed). Its C and F are white: use it on a dark background.
import logoMark from './logo-mark.png'   // bundled into assets/, so the deploy always ships it
const LOGO = () => (typeof window !== 'undefined' && window.__LOGO) || logoMark
export function LogoMark({ size = 36 }) {
  return <img src={LOGO()} alt="Capital Friends" style={{ height: size, width: 'auto', display: 'block' }} />
}

export function Wordmark({ size = 34, dark = false, sub = false }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
      <LogoMark size={size * 1.25} />
      <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
        <span style={{ fontFamily: "Inter, system-ui, sans-serif", fontSize: size * 0.5, fontWeight: 700, letterSpacing: '-.02em', color: dark ? '#fff' : '#0f172a', whiteSpace: 'nowrap' }}>
          Capital <span style={{ color: dark ? '#34d399' : '#0d9488' }}>Friends</span>
        </span>
        {sub && <span style={{ fontSize: size * 0.29, fontWeight: 600, color: dark ? '#94a3b8' : '#64748b', marginTop: 3, letterSpacing: '.02em' }}>Family money, made clear</span>}
      </span>
    </span>
  )
}
