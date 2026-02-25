import { useState, useMemo } from 'react'
import { useData } from '../../context/DataContext'
import { formatINR } from '../../data/familyData'
import { Repeat, IndianRupee, ArrowUpDown } from 'lucide-react'
import { FormField, FormInput } from '../Modal'

// ── Toggle this to false when real data is available ──
const USE_DUMMY = true

const DUMMY_REBALANCE = [
  {
    portfolioId: 'dr1', portfolioName: 'Jags Growth Portfolio', ownerName: 'Jags',
    rebalanceThreshold: 0.05, sipTarget: 25000, lumpsumTarget: 100000,
    totalValue: 1500000, driftedCount: 3,
    holdings: [
      { holdingId: 'rh1', fundName: 'Parag Parikh Flexi Cap Fund', currentValue: 427500, currentNav: 62.80, units: 6808, targetAllocationPct: 30 },
      { holdingId: 'rh2', fundName: 'Mirae Asset Large Cap Fund', currentValue: 331500, currentNav: 91.60, units: 3619, targetAllocationPct: 25 },
      { holdingId: 'rh3', fundName: 'Axis Small Cap Fund', currentValue: 270000, currentNav: 36.38, units: 7422, targetAllocationPct: 20 },
      { holdingId: 'rh4', fundName: 'SBI Blue Chip Fund', currentValue: 285000, currentNav: 55.20, units: 5163, targetAllocationPct: 15 },
      { holdingId: 'rh5', fundName: 'ICICI Pru Value Discovery', currentValue: 186000, currentNav: 48.90, units: 3804, targetAllocationPct: 10 },
    ],
  },
  {
    portfolioId: 'dr2', portfolioName: 'Priya Conservative MF', ownerName: 'Priya',
    rebalanceThreshold: 0.05, sipTarget: 15000, lumpsumTarget: 50000,
    totalValue: 1350000, driftedCount: 2,
    holdings: [
      { holdingId: 'rh6', fundName: 'HDFC Mid-Cap Opportunities', currentValue: 407700, currentNav: 82.89, units: 4919, targetAllocationPct: 35 },
      { holdingId: 'rh7', fundName: 'Kotak Emerging Equity Fund', currentValue: 213300, currentNav: 61.56, units: 3465, targetAllocationPct: 20 },
      { holdingId: 'rh8', fundName: 'UTI Nifty Index Fund', currentValue: 472500, currentNav: 130.20, units: 3630, targetAllocationPct: 30 },
      { holdingId: 'rh9', fundName: 'Axis Liquid Fund', currentValue: 256500, currentNav: 2650.80, units: 96.78, targetAllocationPct: 15 },
    ],
  },
]

const modes = [
  { key: 'sip', label: 'Adjust SIP', icon: Repeat, color: 'text-blue-400', dimColor: 'text-blue-400/60 hover:text-blue-400', activeBg: 'bg-blue-500/20 border border-blue-500/40' },
  { key: 'lumpsum', label: 'Lumpsum', icon: IndianRupee, color: 'text-emerald-400', dimColor: 'text-emerald-400/60 hover:text-emerald-400', activeBg: 'bg-emerald-500/20 border border-emerald-500/40' },
  { key: 'buysell', label: 'Buy / Sell', icon: ArrowUpDown, color: 'text-amber-400', dimColor: 'text-amber-400/60 hover:text-amber-400', activeBg: 'bg-amber-500/20 border border-amber-500/40' },
]

function fmt(n) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`
  return `₹${Math.round(n)}`
}

function PortfolioSIPSection({ portfolio, holdings, totalValue }) {
  const sipTarget = portfolio.sipTarget || 0

  if (sipTarget <= 0) return <p className="text-xs text-[var(--text-dim)] py-2">No SIP target set</p>

  // Show ALL funds with targets — gap-based rebalance SIP
  const allFunds = holdings
    .filter((h) => h.targetAllocationPct > 0)
    .map((h) => {
      const currentPct = totalValue > 0 ? (h.currentValue / totalValue) * 100 : 0
      const targetValue = (h.targetAllocationPct / 100) * totalValue
      const gap = targetValue - h.currentValue // positive = underweight, negative = overweight
      const normalSIP = (h.targetAllocationPct / 100) * sipTarget
      return { ...h, currentPct, gap, normalSIP }
    })

  // Rebalance: overweight funds get ₹0, underweight funds share SIP proportional to gap
  const underweight = allFunds.filter((h) => h.gap > 0)
  const totalGap = underweight.reduce((s, h) => s + h.gap, 0)

  const withSuggested = allFunds.map((h) => ({
    ...h,
    suggestedSIP: h.gap > 0 && totalGap > 0 ? (h.gap / totalGap) * sipTarget : 0,
  }))

  // Only show if there's actually a change needed
  const hasChanges = withSuggested.some((h) => Math.abs(h.suggestedSIP - h.normalSIP) > 10)
  if (!hasChanges) return <p className="text-xs text-[var(--text-dim)] py-2">SIPs are balanced</p>

  return (
    <div className="space-y-2">
      <p className="text-xs text-[var(--text-dim)] px-1">
        Overweight funds get ₹0 SIP. All SIP goes to underweight funds to rebalance over time.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border-light)]">
              <th className="text-left py-1.5 px-2 text-xs text-[var(--text-muted)] font-semibold uppercase">Fund</th>
              <th className="text-right py-1.5 px-2 text-xs text-[var(--text-muted)] font-semibold uppercase">Allocation</th>
              <th className="text-right py-1.5 px-2 text-xs text-[var(--text-muted)] font-semibold uppercase">Normal SIP</th>
              <th className="text-right py-1.5 px-2 text-xs text-[var(--text-muted)] font-semibold uppercase">Rebalance SIP</th>
            </tr>
          </thead>
          <tbody>
            {withSuggested.map((h) => {
              const isOverweight = h.gap <= 0
              return (
                <tr key={h.holdingId} className={`border-b border-[var(--border-light)] last:border-0 ${isOverweight ? 'opacity-60' : ''}`}>
                  <td className="py-2 px-2 text-[var(--text-secondary)] max-w-[180px] truncate">{h.fundName}</td>
                  <td className="py-2 px-2 text-right tabular-nums">
                    <span className={isOverweight ? 'text-amber-400' : 'text-[var(--text-dim)]'}>{h.currentPct.toFixed(1)}%</span>
                    <span className="text-[var(--text-dim)]"> / {h.targetAllocationPct.toFixed(1)}%</span>
                  </td>
                  <td className="py-2 px-2 text-right text-[var(--text-muted)] tabular-nums">{fmt(h.normalSIP)}</td>
                  <td className="py-2 px-2 text-right font-semibold tabular-nums">
                    {isOverweight ? (
                      <span className="text-amber-400/70">₹0</span>
                    ) : (
                      <span className="text-blue-400">{fmt(h.suggestedSIP)}</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-[var(--border)]">
              <td className="py-1.5 px-2 text-xs font-bold text-[var(--text-primary)]" colSpan={2}>Total</td>
              <td className="py-1.5 px-2 text-right text-xs font-bold text-[var(--text-primary)] tabular-nums">{fmt(sipTarget)}</td>
              <td className="py-1.5 px-2 text-right text-xs font-bold text-blue-400 tabular-nums">{fmt(sipTarget)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

function PortfolioLumpsumSection({ portfolio, holdings, totalValue }) {
  const [lumpsumInput, setLumpsumInput] = useState('')
  const threshold = (portfolio.rebalanceThreshold || 0.05) * 100
  const lumpsumAmount = Number(lumpsumInput) || portfolio.lumpsumTarget || 0

  const enriched = holdings.map((h) => {
    const currentPct = totalValue > 0 ? (h.currentValue / totalValue) * 100 : 0
    return { ...h, currentPct }
  })

  const distribution = useMemo(() => {
    if (lumpsumAmount <= 0) return []
    const newTotal = totalValue + lumpsumAmount
    const raw = enriched.map((h) => {
      const targetVal = (h.targetAllocationPct / 100) * newTotal
      const invest = Math.max(0, targetVal - h.currentValue)
      const newPct = newTotal > 0 ? ((h.currentValue + invest) / newTotal) * 100 : 0
      return { ...h, invest, newPct }
    }).filter((h) => h.invest > 0)
    const totalRaw = raw.reduce((s, h) => s + h.invest, 0)
    if (totalRaw > 0 && Math.abs(totalRaw - lumpsumAmount) > 1) {
      const scale = lumpsumAmount / totalRaw
      return raw.map((h) => ({ ...h, invest: h.invest * scale, newPct: (totalValue + lumpsumAmount) > 0 ? ((h.currentValue + h.invest * scale) / (totalValue + lumpsumAmount)) * 100 : 0 }))
    }
    return raw
  }, [enriched, lumpsumAmount, totalValue])

  return (
    <div className="space-y-2">
      <div className="flex items-end gap-3">
        <div className="flex-1 max-w-[200px]">
          <FormField label="Amount (₹)">
            <FormInput type="number" value={lumpsumInput} onChange={setLumpsumInput} placeholder={portfolio.lumpsumTarget ? `Default: ${formatINR(portfolio.lumpsumTarget)}` : 'Enter amount...'} />
          </FormField>
        </div>
        {portfolio.lumpsumTarget > 0 && !lumpsumInput && <p className="text-xs text-[var(--text-dim)] pb-2.5">Using target</p>}
      </div>
      {lumpsumAmount > 0 && distribution.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-light)]">
                <th className="text-left py-1.5 px-2 text-xs text-[var(--text-muted)] font-semibold uppercase">Fund</th>
                <th className="text-right py-1.5 px-2 text-xs text-[var(--text-muted)] font-semibold uppercase">Drift</th>
                <th className="text-right py-1.5 px-2 text-xs text-[var(--text-muted)] font-semibold uppercase">Invest</th>
              </tr>
            </thead>
            <tbody>
              {distribution.map((h) => (
                <tr key={h.holdingId} className="border-b border-[var(--border-light)] last:border-0">
                  <td className="py-2 px-2 text-[var(--text-secondary)] max-w-[180px] truncate">{h.fundName}</td>
                  <td className="py-2 px-2 text-right text-[var(--text-dim)] tabular-nums">{h.currentPct.toFixed(1)}% → {h.newPct.toFixed(1)}%</td>
                  <td className="py-2 px-2 text-right font-semibold text-emerald-400 tabular-nums">{fmt(h.invest)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-[var(--border)]">
                <td className="py-1.5 px-2 text-xs font-bold text-[var(--text-primary)]" colSpan={2}>Total</td>
                <td className="py-1.5 px-2 text-right text-xs font-bold text-emerald-400 tabular-nums">{formatINR(lumpsumAmount)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : lumpsumAmount > 0 ? (
        <p className="text-xs text-[var(--text-dim)] py-2 text-center">Balanced — distributes proportionally</p>
      ) : null}
    </div>
  )
}

function PortfolioBuySellSection({ portfolio, holdings, totalValue }) {
  const threshold = (portfolio.rebalanceThreshold || 0.05) * 100

  const buySellData = holdings.map((h) => {
    const currentPct = totalValue > 0 ? (h.currentValue / totalValue) * 100 : 0
    const drifted = Math.abs(currentPct - h.targetAllocationPct) > threshold
    const targetVal = (h.targetAllocationPct / 100) * totalValue
    const amount = drifted ? targetVal - h.currentValue : 0
    return { ...h, currentPct, amount }
  }).filter((h) => Math.abs(h.amount) >= 500)

  if (buySellData.length === 0) return <p className="text-xs text-[var(--text-dim)] py-2">Portfolio is balanced</p>

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--border-light)]">
            <th className="text-left py-1.5 px-2 text-xs text-[var(--text-muted)] font-semibold uppercase">Fund</th>
            <th className="text-right py-1.5 px-2 text-xs text-[var(--text-muted)] font-semibold uppercase">Drift</th>
            <th className="text-right py-1.5 px-2 text-xs text-[var(--text-muted)] font-semibold uppercase">Action</th>
          </tr>
        </thead>
        <tbody>
          {buySellData.map((h) => {
            const isBuy = h.amount > 0
            return (
              <tr key={h.holdingId} className="border-b border-[var(--border-light)] last:border-0">
                <td className="py-2 px-2 text-[var(--text-secondary)] max-w-[180px] truncate">{h.fundName}</td>
                <td className="py-2 px-2 text-right text-[var(--text-dim)] tabular-nums">{h.currentPct.toFixed(1)}% → {h.targetAllocationPct.toFixed(1)}%</td>
                <td className="py-2 px-2 text-right">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isBuy ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-[var(--accent-rose)]'}`}>
                    {isBuy ? 'Buy' : 'Sell'} {fmt(Math.abs(h.amount))}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default function MFRebalanceDialog() {
  const { mfHoldings, mfPortfolios } = useData()
  const [mode, setMode] = useState('sip')

  // All portfolios needing rebalance
  const portfolioGroups = useMemo(() => {
    if (USE_DUMMY) return DUMMY_REBALANCE

    return mfPortfolios
      .filter((p) => p.status !== 'Inactive')
      .map((p) => {
        const pHoldings = mfHoldings.filter((h) => h.portfolioId === p.portfolioId && h.units > 0)
        const totalValue = pHoldings.reduce((s, h) => s + h.currentValue, 0)
        const threshold = (p.rebalanceThreshold || 0.05) * 100
        const driftedCount = pHoldings.filter((h) => {
          const pct = totalValue > 0 ? (h.currentValue / totalValue) * 100 : 0
          return Math.abs(pct - h.targetAllocationPct) > threshold
        }).length
        return { ...p, holdings: pHoldings, totalValue, driftedCount }
      })
      .filter((p) => p.driftedCount > 0)
  }, [mfPortfolios, mfHoldings])

  if (portfolioGroups.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-[var(--text-muted)]">All portfolios are balanced</p>
        <p className="text-xs text-[var(--text-dim)] mt-1">No funds exceed their rebalance threshold</p>
      </div>
    )
  }

  const activeMode = modes.find((m) => m.key === mode)

  return (
    <div className="space-y-4">
      {/* Color-coded mode tabs */}
      <div className="flex bg-[var(--bg-inset)] rounded-lg p-0.5">
        {modes.map(({ key, label, icon: MIcon, color, dimColor, activeBg }) => (
          <button key={key} onClick={() => setMode(key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-semibold transition-colors ${
              mode === key ? `${activeBg} ${color} shadow-sm` : dimColor
            }`}
          >
            <MIcon size={13} /> {label}
          </button>
        ))}
      </div>

      {/* Per-portfolio sections */}
      {portfolioGroups.map((p, i) => (
        <div key={p.portfolioId} className="border border-[var(--border-light)] border-l-2 border-l-violet-500/50 rounded-lg overflow-hidden">
          {/* Portfolio header */}
          <div className="flex items-center justify-between px-3 py-2.5 bg-[var(--bg-inset)]">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-violet-400 bg-violet-500/15 w-5 h-5 rounded flex items-center justify-center">{i + 1}</span>
              <p className="text-sm font-bold text-[var(--text-primary)]">{p.portfolioName}</p>
              <span className="text-xs text-[var(--text-muted)]">{p.ownerName}</span>
              <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400">{p.driftedCount} drifted</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
              <span className="font-semibold text-[var(--text-secondary)]">{formatINR(p.totalValue)}</span>
              <span>Threshold: {((p.rebalanceThreshold || 0.05) * 100).toFixed(0)}%</span>
              {p.sipTarget > 0 && <span>SIP: {formatINR(p.sipTarget)}/mo</span>}
            </div>
          </div>

          {/* Mode-specific content */}
          <div className="px-3 py-2">
            {mode === 'sip' && <PortfolioSIPSection portfolio={p} holdings={p.holdings} totalValue={p.totalValue} />}
            {mode === 'lumpsum' && <PortfolioLumpsumSection portfolio={p} holdings={p.holdings} totalValue={p.totalValue} />}
            {mode === 'buysell' && <PortfolioBuySellSection portfolio={p} holdings={p.holdings} totalValue={p.totalValue} />}
          </div>
        </div>
      ))}
    </div>
  )
}
