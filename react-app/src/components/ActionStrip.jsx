import { useState } from 'react'
import { TrendingDown, RefreshCw, X } from 'lucide-react'
import useAlerts from '../hooks/useAlerts'
import MFBuyOpportunities from './forms/MFBuyOpportunities'
import MFRebalanceDialog from './forms/MFRebalanceDialog'

const TAB_CONFIG = [
  { key: 'buyopp', label: 'Buy Opps', icon: TrendingDown, idle: 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20', active: 'bg-emerald-500/25 text-emerald-300 ring-1 ring-emerald-500/40' },
  { key: 'rebalance', label: 'Rebalance', icon: RefreshCw, idle: 'bg-violet-500/10 text-violet-400 hover:bg-violet-500/20', active: 'bg-violet-500/25 text-violet-300 ring-1 ring-violet-500/40' },
]

const DIALOG_TITLES = { buyopp: 'Buy Opportunities', rebalance: 'Rebalance' }

export default function ActionStrip() {
  const { investmentSignals } = useAlerts()
  const [dialogKey, setDialogKey] = useState(null)

  const { buyOppCount, rebalanceCount } = investmentSignals

  const counts = { buyopp: buyOppCount, rebalance: rebalanceCount }
  const visibleTabs = TAB_CONFIG.filter((t) => counts[t.key] > 0)
  if (visibleTabs.length === 0) return null

  return (
    <>
      <div className="border-b border-[var(--border-light)]">
        <div className="flex items-center gap-1.5 px-3 py-1.5 overflow-x-auto no-scrollbar bg-[var(--bg-header)]/80">
          {visibleTabs.map((t) => {
            const Icon = t.icon
            const isActive = dialogKey === t.key
            return (
              <button
                key={t.key}
                onClick={() => setDialogKey(isActive ? null : t.key)}
                className={`flex items-center gap-1 text-[11px] font-semibold whitespace-nowrap shrink-0 px-2.5 py-1 rounded-full transition-all ${
                  isActive ? t.active : t.idle
                }`}
              >
                <Icon size={11} strokeWidth={isActive ? 2.5 : 2} />
                <span>{t.label}</span>
                <span className={`text-[10px] ${isActive ? 'opacity-80' : 'opacity-50'}`}>{counts[t.key]}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Dialog overlay */}
      {dialogKey && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-3">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDialogKey(null)} />

          {/* Dialog */}
          <div className="relative w-full max-w-3xl max-h-[75vh] rounded-xl bg-[var(--bg-card)] border border-[var(--border)] shadow-2xl shadow-black/40 overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-4 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-light)] shrink-0">
              <h2 className="text-sm font-bold text-[var(--text-primary)]">{DIALOG_TITLES[dialogKey]}</h2>
              <button onClick={() => setDialogKey(null)} className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-dim)] transition-colors">
                <X size={16} />
              </button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto p-4">
              {dialogKey === 'buyopp' && <MFBuyOpportunities />}
              {dialogKey === 'rebalance' && <MFRebalanceDialog />}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
