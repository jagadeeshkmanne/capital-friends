import { TrendingUp, ShieldCheck, Layers, Coins, Globe, Briefcase } from 'lucide-react'

// Round icons at the start of a phone list row, so every list looks the same (like the goal page investments).

/** A coloured round icon for the start of an IonItem (or any row with slot="start" off). */
export function Lead({ I, c = '#a78bfa', size = 36, slot = 'start', children }) {
  return (
    <span slot={slot || undefined} style={{ width: size, height: size, marginInlineEnd: slot ? 14 : 0, background: `${c}22`, color: c }} className="flex shrink-0 items-center justify-center rounded-full">
      {children || (I ? <I size={Math.round(size * 0.48)} /> : null)}
    </span>
  )
}

/** What kind of fund this is, from its category / name: growth, safe, mixed, gold or abroad. */
export function fundKind(h) {
  const t = `${h?.category || ''} ${h?.fundCategory || ''} ${h?.fundName || h?.name || ''}`.toLowerCase()
  if (/gold|silver|precious/.test(t)) return { I: Coins, c: '#f59e0b', k: 'gold' }
  if (/nasdaq|s&p|international|global|world|overseas|us equity|fang|feeder/.test(t)) return { I: Globe, c: '#818cf8', k: 'abroad' }
  if (/hybrid|balanced|asset allocation|multi[ -]?asset|arbitrage|equity savings|advantage|retirement|children/.test(t)) return { I: Layers, c: '#a78bfa', k: 'mixed' }
  if (/liquid|debt|duration|gilt|bond|overnight|money market|credit|corporate|banking and psu|banking & psu|floater|treasury|income/.test(t)) return { I: ShieldCheck, c: '#38bdf8', k: 'safe' }
  return { I: TrendingUp, c: '#34d399', k: 'growth' }
}
export const FundLead = ({ h, size }) => { const f = fundKind(h); return <Lead I={f.I} c={f.c} size={size} /> }

const PAL = ['#34d399', '#38bdf8', '#a78bfa', '#f59e0b', '#f472b6', '#818cf8', '#2dd4bf', '#fb7185']
/** A letter avatar for a company (stocks), the colour fixed by the name. */
export function StockLead({ name, size = 36 }) {
  const s = String(name || '?').trim()
  let n = 0; for (const ch of s) n = (n * 31 + ch.charCodeAt(0)) >>> 0
  return <Lead c={PAL[n % PAL.length]} size={size}><span className="text-[14px] font-bold">{s.charAt(0).toUpperCase()}</span></Lead>
}
export const PortfolioLead = ({ c = '#a78bfa' }) => <Lead I={Briefcase} c={c} />
