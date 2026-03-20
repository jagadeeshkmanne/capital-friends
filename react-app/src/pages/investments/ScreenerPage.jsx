import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  ScanSearch, RefreshCw, TrendingUp, TrendingDown, AlertTriangle,
  Check, X, ShieldAlert, ArrowUpCircle, ArrowDownCircle,
  Settings as SettingsIcon, Eye, Loader2, Save, Activity, Info, ChevronDown, Download, Trash2
} from 'lucide-react'
import { AgGridReact } from 'ag-grid-react'
import { AllCommunityModule, ModuleRegistry, themeQuartz } from 'ag-grid-community'
import { formatINR } from '../../data/familyData'
import { useToast } from '../../context/ToastContext'
import { useData } from '../../context/DataContext'
import Modal from '../../components/Modal'
import BuyStockForm from '../../components/forms/BuyStockForm'
import SellStockForm from '../../components/forms/SellStockForm'
import * as api from '../../services/api'

ModuleRegistry.registerModules([AllCommunityModule])

// ── Signal type config ──
const SIGNAL_STYLES = {
  HARD_EXIT:      { border: 'border-l-red-500', icon: ShieldAlert, color: 'text-red-500', label: 'HARD EXIT', bg: 'bg-red-500/10' },
  SYSTEMIC_EXIT:  { border: 'border-l-red-500', icon: ShieldAlert, color: 'text-red-500', label: 'SYSTEMIC EXIT', bg: 'bg-red-500/10' },
  FREEZE:         { border: 'border-l-red-500', icon: ShieldAlert, color: 'text-red-500', label: 'FREEZE', bg: 'bg-red-500/10' },
  TRAILING_STOP:  { border: 'border-l-amber-500', icon: AlertTriangle, color: 'text-amber-500', label: 'TRAILING STOP', bg: 'bg-amber-500/10' },
  CRASH_ALERT:    { border: 'border-l-amber-500', icon: AlertTriangle, color: 'text-amber-500', label: 'CRASH ALERT', bg: 'bg-amber-500/10' },
  SOFT_EXIT:      { border: 'border-l-amber-500', icon: AlertTriangle, color: 'text-amber-500', label: 'SOFT EXIT', bg: 'bg-amber-500/10' },
  ADD1:           { border: 'border-l-blue-500', icon: ArrowUpCircle, color: 'text-blue-500', label: 'ADD #1', bg: 'bg-blue-500/10' },
  ADD2:           { border: 'border-l-blue-500', icon: ArrowUpCircle, color: 'text-blue-500', label: 'ADD #2', bg: 'bg-blue-500/10' },
  DIP_BUY:        { border: 'border-l-blue-500', icon: ArrowDownCircle, color: 'text-blue-500', label: 'DIP BUY', bg: 'bg-blue-500/10' },
  BUY_STARTER:    { border: 'border-l-emerald-500', icon: TrendingUp, color: 'text-emerald-500', label: 'BUY', bg: 'bg-emerald-500/10' },
  REBALANCE:      { border: 'border-l-gray-400', icon: RefreshCw, color: 'text-[var(--text-dim)]', label: 'REBALANCE', bg: 'bg-[var(--bg-inset)]' },
  LTCG_ALERT:     { border: 'border-l-gray-400', icon: AlertTriangle, color: 'text-[var(--text-dim)]', label: 'LTCG ALERT', bg: 'bg-[var(--bg-inset)]' },
  SECTOR_ALERT:   { border: 'border-l-gray-400', icon: AlertTriangle, color: 'text-[var(--text-dim)]', label: 'SECTOR ALERT', bg: 'bg-[var(--bg-inset)]' },
}

const STATUS_COLORS = {
  ELIGIBLE: { color: '#34d399', bg: 'rgba(52,211,153,0.15)' },
  COOLING:  { color: '#60a5fa', bg: 'rgba(96,165,250,0.15)' },
  NEW:      { color: 'var(--text-dim)', bg: 'var(--bg-inset)' },
  EXPIRED:  { color: '#f87171', bg: 'rgba(248,113,113,0.15)' },
  STALE:    { color: '#fbbf24', bg: 'rgba(251,191,36,0.15)' },
  BOUGHT:   { color: '#a78bfa', bg: 'rgba(167,139,250,0.15)' },
}

const CONVICTION_COLORS = {
  HIGH:       { color: '#6ee7b7', bg: 'rgba(110,231,183,0.15)' },
  MODERATE:   { color: '#93c5fd', bg: 'rgba(147,197,253,0.15)' },
  BASE:       { color: 'var(--text-dim)', bg: 'var(--bg-inset)' },
}

// ── Inline return value ──
function RetVal({ val, bold }) {
  if (val == null) return <span className="text-[var(--text-dim)]">-</span>
  const cls = val > 0 ? 'text-emerald-400' : val < 0 ? 'text-[var(--accent-rose)]' : 'text-[var(--text-dim)]'
  return <span className={`tabular-nums ${bold ? 'font-semibold' : 'font-medium'} ${cls}`}>{val > 0 ? '+' : ''}{val}%</span>
}

// ── Compact metric pill for Nifty bar ──
function MetricPill({ label, value, positive }) {
  const color = positive === true ? 'text-emerald-400' : positive === false ? 'text-[var(--accent-rose)]' : 'text-[var(--text-primary)]'
  return (
    <div className="flex items-center gap-1.5 px-2 py-1">
      <span className="text-[9px] text-[var(--text-dim)] uppercase tracking-wide whitespace-nowrap">{label}</span>
      <span className={`text-xs font-bold tabular-nums whitespace-nowrap ${color}`}>{value}</span>
    </div>
  )
}

// ── Settings sections ──
const SETTINGS_SECTIONS = [
  {
    title: 'Portfolio Limits',
    description: 'Budget includes ALL your stock holdings (screener + manually bought).',
    fields: [
      { key: 'STOCK_BUDGET', label: 'Total Stock Budget (₹)', description: 'Total capital you want in stocks', type: 'number' },
      { key: 'MAX_STOCKS', label: 'Base Max Stocks', description: 'Base portfolio limit (expands dynamically for high-scoring stocks)', type: 'number' },
      { key: 'BONUS_SCORE_THRESHOLD', label: 'Bonus Slot Score', description: 'Factor score threshold for bonus slots (default 75)', type: 'number' },
      { key: 'MAX_BONUS_SLOTS', label: 'Max Bonus Slots', description: 'Max extra slots for high-conviction stocks (default 5)', type: 'number' },
      { key: 'MAX_PER_SECTOR', label: 'Max Per Sector', description: 'Maximum stocks in the same sector', type: 'number' },
    ]
  },
  {
    title: 'Factor-Based Allocation',
    description: 'Stocks ranked 1-22 by factor score. Top stocks get more allocation. Starter BUY = 50%, ADD = 25% each.',
    fields: [
      { key: 'ALLOC_TOP5', label: 'Top 5 Allocation %', description: 'Max % of budget for rank 1-5 stocks', type: 'number' },
      { key: 'ALLOC_NEXT5', label: 'Rank 6-10 Allocation %', description: 'Max % of budget for rank 6-10 stocks', type: 'number' },
      { key: 'ALLOC_REST', label: 'Rank 11+ Allocation %', description: 'Max % of budget for lower-ranked stocks', type: 'number' },
      { key: 'FACTOR_BUY_MIN', label: 'Min Factor Score to Buy', description: 'Only generate BUY signal if factor score ≥ this', type: 'number' },
    ]
  },
  {
    title: 'When to Buy',
    fields: [
      { key: 'RSI_OVERBOUGHT', label: 'RSI Overbought Block', description: 'Hard block if RSI above this (default 70). RSI 60-69 is penalized inside factor score.', type: 'number' },
      { key: 'MIN_AVG_TRADED_VALUE_CR', label: 'Min Avg Traded Value (Cr)', description: 'Skip illiquid stocks below this daily avg (default 3 Cr)', type: 'number' },
      { key: 'SKIP_COOLING_PERIOD', label: 'Skip Cooling Period', description: 'Treat COOLING stocks as ELIGIBLE immediately (for testing)', type: 'boolean' },
    ]
  },
  {
    title: 'Adding to Winners',
    fields: [
      { key: 'ADD1_GAIN_PCT', label: 'First Add at %', description: 'Add more at this gain %', type: 'number' },
      { key: 'ADD2_GAIN_PCT', label: 'Second Add at %', description: 'Final add at this gain %', type: 'number' },
    ]
  },
  {
    title: 'Trailing Stops',
    description: 'Auto SELL when stock drops from peak price.',
    fields: [
      { key: 'HARD_STOP_LOSS', label: 'Hard Stop Loss %', description: 'Max loss from entry', type: 'number' },
      { key: 'TRAILING_STOP_0_20', label: '0-20% Gain', description: 'Drop from peak to sell', type: 'number' },
      { key: 'TRAILING_STOP_20_50', label: '20-50% Gain', type: 'number' },
      { key: 'TRAILING_STOP_50_100', label: '50-100% Gain', type: 'number' },
      { key: 'TRAILING_STOP_100_PLUS', label: '100%+ Gain', type: 'number' },
    ]
  },
  {
    title: 'Alerts & Safety',
    fields: [
      { key: 'SECTOR_ALERT_PCT', label: 'Sector Alert %', description: 'Warn if sector exceeds this %', type: 'number' },
      { key: 'PORTFOLIO_FREEZE_PCT', label: 'Portfolio Freeze %', description: 'Stop buys if portfolio drops this %', type: 'number' },
    ]
  },
  {
    title: 'Automation',
    description: 'Paper trading always runs in the background — auto-executes signals in a sandbox to build a track record.',
    fields: [
      { key: 'HOLDING_PERIOD_DAYS', label: 'Min Holding Period (days)', description: 'Min days to hold before selling (real trades)', type: 'number' },
      { key: 'PAPER_HOLDING_PERIOD_DAYS', label: 'Paper Min Hold (days)', description: 'Min days before paper auto-sell (default 1)', type: 'number' },
      { key: 'HOURLY_PRICE_CHECK', label: 'Hourly Price Check', description: 'Check exit signals every hour during market hours', type: 'boolean' },
      { key: 'SIGNAL_TRACK_DAYS', label: 'Track Days', description: 'Days after signal to check outcome (e.g. 7,14,30)', type: 'text' },
    ]
  },
]

const CONFIG_FIELDS = SETTINGS_SECTIONS.flatMap(s => s.fields)

export default function ScreenerPage() {
  const { showToast, showBlockUI, hideBlockUI } = useToast()
  const { stockPortfolios, stockHoldings, buyStock, sellStock, addStockPortfolio, refreshStocks } = useData()
  const [searchParams, setSearchParams] = useSearchParams()
  const TAB_KEYS = ['signals', 'paper-trading', 'watchlist', 'how-it-works', 'settings']
  const subTab = TAB_KEYS.includes(searchParams.get('tab')) ? searchParams.get('tab') : 'signals'
  const setSubTab = useCallback((tab) => setSearchParams({ tab }, { replace: true }), [setSearchParams])
  const [signals, setSignals] = useState(null)
  const [niftyData, setNiftyData] = useState(null)
  const [portfolioSummary, setPortfolioSummary] = useState(null)
  const [watchlist, setWatchlist] = useState(null)
  const [config, setConfig] = useState(null)
  const [loadingSignals, setLoadingSignals] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [configEdits, setConfigEdits] = useState({})
  const [savingConfig, setSavingConfig] = useState(false)
  const [tradeModal, setTradeModal] = useState(null) // { type: 'buy'|'sell', signal }
  const watchlistGridRef = useRef(null)

  useEffect(() => { loadSignals() }, [])

  useEffect(() => {
    if (subTab === 'watchlist' && watchlist === null) loadWatchlist()
    if (subTab === 'settings' && config === null) loadConfig()
  }, [subTab])

  const loadSignals = useCallback(async () => {
    setLoadingSignals(true)
    try {
      const [data, nifty] = await Promise.allSettled([
        api.getScreenerSignals('PENDING'),
        api.getScreenerNiftyData()
      ])
      if (data.status === 'fulfilled') setSignals(data.value || [])
      else showToast(data.reason?.message || 'Failed to load signals', 'error')
      if (nifty.status === 'fulfilled') setNiftyData(nifty.value)
    } catch (err) {
      showToast(err.message || 'Failed to load signals', 'error')
    } finally {
      setLoadingSignals(false)
    }
  }, [showToast])

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const result = await api.generateScreenerSignals()
      setSignals(result.signals || [])
      setNiftyData(result.niftyData)
      setPortfolioSummary(result.portfolioSummary)
      showToast(`Signals generated in ${result.durationSeconds}s`)
    } catch (err) {
      showToast(err.message || 'Signal generation failed', 'error')
    } finally {
      setGenerating(false)
    }
  }

  const handleSignalAction = async (signal, action) => {
    if (action === 'SKIPPED') {
      try {
        showBlockUI('Skipping signal...')
        await api.updateScreenerSignalStatus(signal.signalId, 'SKIPPED')
        setSignals(prev => prev.filter(s => s.signalId !== signal.signalId))
        showToast('Signal skipped')
      } catch (err) {
        showToast(err.message || 'Failed to skip signal', 'error')
      } finally {
        hideBlockUI()
      }
      return
    }

    // EXECUTED → open trade form pre-filled with signal data
    const isBuyType = ['BUY_STARTER', 'ADD1', 'ADD2', 'DIP_BUY'].includes(signal.type)

    if (isBuyType) {
      // Resolve CF_Signals portfolio for buy signals
      try {
        showBlockUI('Preparing trade form...')
        const pfId = await getOrCreateSignalsPortfolio()
        setTradeModal({ type: 'buy', signal, portfolioId: pfId })
      } catch (err) {
        showToast(err.message || 'Failed to find/create CF_Signals portfolio', 'error')
      } finally {
        hideBlockUI()
      }
    } else {
      // For sell signals, user picks the portfolio (stock may be in any portfolio)
      setTradeModal({ type: 'sell', signal })
    }
  }

  // Find or create CF_Signals portfolio for screener trades
  const getOrCreateSignalsPortfolio = useCallback(async () => {
    const existing = (stockPortfolios || []).find(
      p => p.portfolioName === 'CF_Signals' || p.portfolioName === 'PFL-CF_Signals'
    )
    if (existing) return existing.portfolioId

    // Create it
    const result = await addStockPortfolio({
      portfolioName: 'CF_Signals',
      investmentAccount: '',
      owner: ''
    })
    return result?.portfolioId || result?.id || ''
  }, [stockPortfolios, addStockPortfolio])

  const handleTradeSubmit = async (formData) => {
    const signal = tradeModal?.signal
    if (!signal) return

    try {
      showBlockUI(tradeModal.type === 'buy' ? 'Executing buy...' : 'Executing sell...')

      // Execute the trade via existing stock buy/sell
      if (tradeModal.type === 'buy') {
        await buyStock(formData)
      } else {
        await sellStock(formData)
      }

      // Mark signal as executed with actual price
      await api.updateScreenerSignalStatus(signal.signalId, 'EXECUTED', parseFloat(formData.pricePerShare) || 0)

      // Update Screener_StockMeta for buy signals
      if (['BUY_STARTER', 'ADD1', 'ADD2', 'DIP_BUY'].includes(signal.type)) {
        try {
          const convictionMatch = signal.triggerDetail?.match(/Conviction: (\w+)/)
          const conviction = convictionMatch?.[1] || 'BASE'
          await api.recordScreenerBuy(signal.symbol, {
            name: signal.name,
            signalType: signal.type,
            screeners: signal.screeners || '',
            conviction: conviction,
            sector: signal.sector || ''
          })
        } catch (e) {
          console.warn('StockMeta update failed:', e.message)
        }
      }

      const tradeType = tradeModal.type
      setSignals(prev => prev.filter(s => s.signalId !== signal.signalId))
      setTradeModal(null)
      refreshStocks?.()
      showToast(`${tradeType === 'buy' ? 'Buy' : 'Sell'} executed and signal marked done`)
    } catch (err) {
      showToast(err.message || 'Trade failed', 'error')
    } finally {
      hideBlockUI()
    }
  }

  const loadWatchlist = async () => {
    try {
      const promises = [api.getScreenerWatchlist()]
      if (!niftyData) promises.push(api.getScreenerNiftyData())
      const [data, nifty] = await Promise.all(promises)
      setWatchlist(data || [])
      if (nifty) setNiftyData(nifty)
    } catch (err) {
      showToast(err.message || 'Failed to load watchlist', 'error')
    }
  }

  const loadConfig = async () => {
    try {
      const [screenerData, appSettings] = await Promise.all([
        api.getScreenerConfig(),
        api.getSettings()
      ])
      const merged = { ...(screenerData || {}) }
      if (appSettings) {
        if (appSettings.ScreenerEmailEnabled !== undefined) merged.ScreenerEmailEnabled = appSettings.ScreenerEmailEnabled
        if (appSettings.ScreenerEmailHour !== undefined) merged.ScreenerEmailHour = appSettings.ScreenerEmailHour
      }
      setConfig(merged)
      setConfigEdits({})
    } catch (err) {
      showToast(err.message || 'Failed to load config', 'error')
    }
  }

  const handleConfigSave = async () => {
    setSavingConfig(true)
    try {
      const keys = Object.keys(configEdits)
      const appSettingKeys = CONFIG_FIELDS.filter(f => f.isAppSetting).map(f => f.key)
      const appEdits = {}
      const screenerEdits = {}
      for (const key of keys) {
        if (appSettingKeys.includes(key)) {
          appEdits[key] = configEdits[key] === true ? 'TRUE' : configEdits[key] === false ? 'FALSE' : configEdits[key]
        } else {
          screenerEdits[key] = configEdits[key] === true ? 'TRUE' : configEdits[key] === false ? 'FALSE' : configEdits[key]
        }
      }
      if (Object.keys(appEdits).length > 0) await api.saveSettings(appEdits)
      for (const key of Object.keys(screenerEdits)) {
        await api.updateScreenerConfigValue(key, screenerEdits[key])
      }
      showToast(`${keys.length} setting(s) saved`)
      setConfig(prev => ({ ...prev, ...configEdits }))
      setConfigEdits({})
    } catch (err) {
      showToast(err.message || 'Failed to save config', 'error')
    } finally {
      setSavingConfig(false)
    }
  }

  // Format helpers for nifty bar
  const fmtPct = (v) => {
    if (v == null) return 'N/A'
    return `${v > 0 ? '+' : ''}${v}%`
  }
  const pctPositive = (v) => v > 0 ? true : v < 0 ? false : undefined

  const filteredWatchlist = watchlist || []

  return (
    <div className="space-y-3">

      {/* ── Sub-tabs + Nifty bar + Generate button ── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 bg-[var(--bg-inset)] rounded-lg p-0.5 shrink-0">
          {[
            { key: 'signals', icon: Activity, label: 'Signals' },
            { key: 'paper-trading', icon: TrendingUp, label: 'Paper Trading' },
            { key: 'watchlist', icon: Eye, label: 'Watchlist' },
            { key: 'how-it-works', icon: Info, label: 'How It Works' },
            { key: 'settings', icon: SettingsIcon, label: 'Settings' },
          ].map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              onClick={() => setSubTab(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                subTab === key
                  ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              }`}
            >
              <Icon size={12} />
              {label}
              {key === 'signals' && signals && signals.length > 0 && (
                <span className="ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-500 text-white leading-none">{signals.length}</span>
              )}
              {key === 'watchlist' && watchlist && (
                <span className="ml-0.5 text-[10px] text-[var(--text-dim)]">({watchlist.length})</span>
              )}
            </button>
          ))}
        </div>

        {/* Nifty market pills — inline with tabs */}
        {niftyData && niftyData.price && (
          <div className="flex items-center gap-0 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg overflow-hidden divide-x divide-[var(--border-light)]">
            <MetricPill label="Nifty" value={`₹${Number(niftyData.price).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`} />
            <MetricPill
              label="Regime"
              value={niftyData.aboveDMA200
                ? ((niftyData.return6m || 0) >= 0 ? 'Bull (100%)' : 'Caution (85%)')
                : (niftyData.price && niftyData.dma200 && ((niftyData.price - niftyData.dma200) / niftyData.dma200 * 100) > -5
                  ? 'Correction (75%)'
                  : 'Bear (50%)')}
              positive={niftyData.aboveDMA200}
            />
            <MetricPill label="1M" value={fmtPct(niftyData.return1m)} positive={pctPositive(niftyData.return1m)} />
            <MetricPill label="Nifty 6M" value={fmtPct(niftyData.return6m)} positive={pctPositive(niftyData.return6m)} />
            <MetricPill label="Midcap 6M" value={fmtPct(niftyData.midcapReturn6m)} positive={pctPositive(niftyData.midcapReturn6m)} />
            <MetricPill label="Smallcap 6M" value={fmtPct(niftyData.smallcapReturn6m)} positive={pctPositive(niftyData.smallcapReturn6m)} />
            {portfolioSummary && (
              <>
                <MetricPill label="Invested" value={formatINR(portfolioSummary.totalInvested)} />
                <MetricPill label="Cash" value={formatINR(portfolioSummary.cashAvailable)} />
                <MetricPill label="Stocks" value={`${portfolioSummary.holdingCount}/${portfolioSummary.effectiveMax || portfolioSummary.maxStocks}${portfolioSummary.bonusSlots > 0 ? ` (+${portfolioSummary.bonusSlots})` : ''}`} />
              </>
            )}
          </div>
        )}

        <button
          onClick={handleGenerate}
          disabled={generating}
          className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-lg transition-colors shadow-sm ml-auto shrink-0 ${
            generating ? 'bg-violet-600/40 text-white/50 cursor-not-allowed' : 'text-white bg-violet-600 hover:bg-violet-500'
          }`}
        >
          {generating ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          {generating ? 'Generating...' : 'Generate Signals'}
        </button>
      </div>

      {/* ===== SIGNALS TAB ===== */}
      {subTab === 'signals' && (
        <div className="space-y-2">
          {generating && (
            <div className="flex items-center gap-2 text-xs text-[var(--text-dim)] px-1">
              <Loader2 size={12} className="animate-spin" />
              Reading watchlist + holdings, generating signals... (10-30s)
            </div>
          )}

          {loadingSignals ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={20} className="animate-spin text-[var(--text-dim)]" />
              <span className="ml-2 text-sm text-[var(--text-dim)]">Loading signals...</span>
            </div>
          ) : signals === null ? (
            <div className="text-center py-12">
              <ScanSearch size={36} className="mx-auto mb-3 text-[var(--text-dim)] opacity-40" />
              <p className="text-sm text-[var(--text-secondary)]">Click "Generate Signals" to scan for opportunities</p>
              <p className="text-xs text-[var(--text-dim)] mt-1">Reads Master DB watchlist + your holdings</p>
            </div>
          ) : signals.length === 0 ? (
            <div className="text-center py-12">
              <Check size={36} className="mx-auto mb-3 text-emerald-500" />
              <p className="text-sm text-[var(--text-secondary)]">No pending signals</p>
              {niftyData && !niftyData.aboveDMA200 && (
                <p className="text-xs text-amber-400 mt-1">Market in correction — allocation reduced. Strong factor scores (70+) still get signals.</p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {signals.map(signal => {
                const style = SIGNAL_STYLES[signal.type] || SIGNAL_STYLES.BUY_STARTER
                const IconComp = style.icon
                const isBuy = ['BUY_STARTER', 'ADD1', 'ADD2', 'DIP_BUY'].includes(signal.type)
                const isSell = ['TRAILING_STOP', 'HARD_EXIT', 'SYSTEMIC_EXIT', 'SOFT_EXIT'].includes(signal.type)
                const isInfoOnly = ['FREEZE', 'CRASH_ALERT', 'SECTOR_ALERT', 'LTCG_ALERT', 'REBALANCE'].includes(signal.type)
                return (
                  <div
                    key={signal.signalId}
                    className={`bg-[var(--bg-card)] border border-[var(--border)] border-l-[3px] ${style.border} rounded-xl p-3`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${style.bg} ${style.color}`}>
                          <IconComp size={10} /> {style.label}
                        </span>
                        <a href={stockUrl(signal.symbol)} target="_blank" rel="noopener noreferrer"
                          className="text-sm font-bold text-[var(--text-primary)] hover:text-violet-400 transition-colors"
                        >{signal.symbol}</a>
                        <span className="text-xs text-[var(--text-dim)] hidden sm:inline">{signal.name}</span>
                        {signal.screeners && signal.screeners !== 'CF-Stock-Screener' && (
                          <span className="hidden sm:inline-flex items-center gap-0.5 ml-1">
                            {String(signal.screeners).split(',').map(n => n.trim()).filter(Boolean).map(n => (
                              <span key={n} title={SCREENER_TOOLTIPS[n]} className="inline-flex items-center justify-center rounded text-[9px] font-bold"
                                style={{ width: 16, height: 14, background: (SCREENER_COLORS[n] || '#6b7280') + '22', color: SCREENER_COLORS[n] || '#6b7280' }}
                              >{SCREENER_NAMES[n] || n}</span>
                            ))}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-[var(--text-dim)] tabular-nums">
                        {signal.date ? new Date(signal.date).toLocaleDateString('en-IN') : ''}
                      </span>
                    </div>

                    <p className="text-xs font-semibold text-[var(--text-primary)] mb-1">{signal.action}</p>

                    {signal.triggerDetail && (
                      <p className="text-[11px] text-[var(--text-dim)] leading-relaxed mb-1.5">{signal.triggerDetail}</p>
                    )}

                    <div className="flex items-center justify-between pt-1.5 border-t border-[var(--border-light)]">
                      <div className="flex items-center gap-3 text-xs">
                        {signal.amount > 0 && (
                          <span className="text-[var(--text-secondary)]">Amount: <strong className="text-[var(--text-primary)]">{formatINR(signal.amount)}</strong></span>
                        )}
                        {signal.shares > 0 && (
                          <span className="text-[var(--text-secondary)]">Shares: <strong className="text-[var(--text-primary)]">{signal.shares}</strong></span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        {isInfoOnly ? (
                          <button
                            onClick={() => handleSignalAction(signal, 'SKIPPED')}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-md text-[11px] font-bold text-white bg-gray-600 hover:bg-gray-500 transition-colors"
                          >
                            <Check size={11} /> Acknowledge
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => handleSignalAction(signal, 'EXECUTED')}
                              className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-[11px] font-bold text-white transition-colors ${
                                isSell ? 'bg-rose-600 hover:bg-rose-500' : 'bg-emerald-600 hover:bg-emerald-500'
                              }`}
                            >
                              {isSell ? <><TrendingDown size={11} /> Sell</> : <><TrendingUp size={11} /> Buy</>}
                            </button>
                            <button
                              onClick={() => handleSignalAction(signal, 'SKIPPED')}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-[var(--bg-inset)] hover:bg-[var(--bg-hover)] transition-colors"
                            >
                              <X size={11} /> Skip
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ===== PAPER TRADING TAB ===== */}
      {subTab === 'paper-trading' && <PaperTradingTab showToast={showToast} />}

      {/* ===== WATCHLIST TAB ===== */}
      {subTab === 'watchlist' && (
        <div className="space-y-2">
          {watchlist === null ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={20} className="animate-spin text-[var(--text-dim)]" />
              <span className="ml-2 text-sm text-[var(--text-dim)]">Loading watchlist...</span>
            </div>
          ) : filteredWatchlist.length === 0 ? (
            <div className="text-center py-12 text-sm text-[var(--text-dim)]">No stocks found</div>
          ) : (
            <>
              {/* Export button */}
              <div className="flex justify-end mb-1">
                <button
                  onClick={() => watchlistGridRef.current?.api?.exportDataAsCsv({ fileName: 'screener-watchlist.csv' })}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-[var(--bg-inset)] hover:bg-[var(--bg-hover)] border border-[var(--border)] transition-colors"
                >
                  <Download size={12} /> Export CSV
                </button>
              </div>
              {/* Desktop AG Grid — fixed header, scrollable body */}
              <div className="hidden sm:block rounded-xl border border-[var(--border)] overflow-hidden" style={{ height: 'calc(100vh - 300px)', minHeight: 350 }}>
                <AgGridReact
                  ref={watchlistGridRef}
                  theme={screenerGridTheme}
                  rowData={filteredWatchlist}
                  columnDefs={watchlistColDefs}
                  defaultColDef={defaultColDef}
                  rowHeight={48}
                  headerHeight={40}
                  animateRows={false}
                  suppressCellFocus={true}
                />
              </div>

              {/* Mobile cards */}
              <div className="sm:hidden space-y-1.5">
                {filteredWatchlist.map(stock => (
                  <div key={stock.symbol} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg px-3 py-2">
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="flex items-center gap-2">
                        {stock.allBuyMet === 'YES' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                        <a href={stockUrl(stock.symbol)} target="_blank" rel="noopener noreferrer"
                          className="font-bold text-xs text-[var(--text-primary)] hover:text-violet-400 transition-colors"
                        >{stock.symbol}</a>
                        <BadgeRenderer value={stock.conviction} map={CONVICTION_COLORS} />
                        <BadgeRenderer value={stock.status} map={STATUS_COLORS} />
                      </div>
                      <span className="text-xs font-semibold text-[var(--text-primary)] tabular-nums">{stock.currentPrice ? formatINR(stock.currentPrice) : '-'}</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-[var(--text-dim)] truncate max-w-[120px]">{stock.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[var(--text-dim)]">1W</span> <RetVal val={stock.return1w} />
                        <span className="text-[var(--text-dim)]">1M</span> <RetVal val={stock.return1m} />
                        <span className="text-[var(--text-dim)]">6M</span> <RetVal val={stock.return6m} />
                        <span className="text-[var(--text-dim)]">1Y</span> <RetVal val={stock.return1y} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ===== HOW IT WORKS TAB ===== */}
      {subTab === 'how-it-works' && (
        <div className="space-y-4">
          {/* Stock Screener */}
          {/* 3-Screener Discovery */}
          <CriteriaSection title="3-Screener Multi-Bagger Discovery" description="Three complementary Trendlyne screeners for quality, momentum, and growth. Overlap across screeners boosts conviction and allocation.">
            <div className="space-y-3">
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="inline-flex w-5 h-5 rounded text-[10px] font-bold text-white bg-[#8b5cf6] items-center justify-center">C</span>
                  <span className="text-xs font-semibold text-[var(--text-primary)]">CF-Compounder (#1) — Quality</span>
                  <span className="text-[9px] text-[var(--text-dim)] ml-auto">30-day cooling</span>
                </div>
                <div className="text-[11px] text-[var(--text-secondary)] pl-6">Market cap ₹500-20K Cr, Sales & Profit growth 3Y &gt; 15%, ROE &gt; 15%, D/E &lt; 0.5, Promoter &gt; 40% (pledge &lt; 15%), Piotroski &gt; 5</div>
              </div>
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="inline-flex w-5 h-5 rounded text-[10px] font-bold text-white bg-[#3b82f6] items-center justify-center">M</span>
                  <span className="text-xs font-semibold text-[var(--text-primary)]">CF-Momentum (#2) — Breakouts</span>
                  <span className="text-[9px] text-[var(--text-dim)] ml-auto">14-day cooling</span>
                </div>
                <div className="text-[11px] text-[var(--text-secondary)] pl-6">Market cap ₹500-20K Cr, 6M return &gt; 10%, 1M return &lt; 20% (no chasing), within 25% of 52W high, ROE &gt; 10%, Profit growth 3Y &gt; 10%, Piotroski &gt; 4, Promoter &gt; 30%</div>
              </div>
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="inline-flex w-5 h-5 rounded text-[10px] font-bold text-white bg-[#10b981] items-center justify-center">G</span>
                  <span className="text-xs font-semibold text-[var(--text-primary)]">CF-Growth (#3) — Small-Cap Leaders</span>
                  <span className="text-[9px] text-[var(--text-dim)] ml-auto">21-day cooling</span>
                </div>
                <div className="text-[11px] text-[var(--text-secondary)] pl-6">Market cap ₹500-10K Cr, Sales growth 3Y &gt; 20%, Profit growth 3Y &gt; 15%, ROE &gt; 12%, D/E &lt; 0.7, Piotroski &gt; 4, Promoter &gt; 40% (pledge &lt; 25%)</div>
              </div>
              <div className="mt-2 bg-[var(--bg-inset)] rounded-lg p-2 border border-[var(--border-light)]">
                <div className="text-[10px] font-semibold text-[var(--text-primary)] mb-1">Overlap Boost</div>
                <div className="text-[10px] text-[var(--text-secondary)]">1 screener → 0.8× allocation &nbsp;|&nbsp; 2 screeners → 1.0× + score ×1.10 &nbsp;|&nbsp; 3 screeners → 1.2× + score ×1.20</div>
                <div className="text-[10px] text-[var(--text-dim)] mt-0.5">Max 2 momentum-only stocks (M only) in portfolio</div>
              </div>
            </div>
            <div className="mt-2 text-[11px] text-[var(--text-dim)] px-1">
              <a href="https://trendlyne.com/fundamentals/stock-screener/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">View on Trendlyne</a>
            </div>
          </CriteriaSection>

          {/* Watchlist Lifecycle */}
          <CriteriaSection title="Watchlist Lifecycle" description="Every stock goes through a lifecycle from discovery to eligibility. Prevents chasing, stale ideas, and overtrading.">
            <div className="space-y-1 text-[11px]">
              <div className="flex items-center gap-2"><span className="w-16 text-right font-semibold text-blue-400">NEW</span><span className="text-[var(--text-secondary)]">→ Stock found in Trendlyne screener email. Cooling period starts.</span></div>
              <div className="flex items-center gap-2"><span className="w-16 text-right font-semibold text-cyan-400">COOLING</span><span className="text-[var(--text-secondary)]">→ Waiting for cooling period to end (14-30 days depending on screener).</span></div>
              <div className="flex items-center gap-2"><span className="w-16 text-right font-semibold text-emerald-400">ELIGIBLE</span><span className="text-[var(--text-secondary)]">→ Ready for buy evaluation. Evaluated every signal generation run.</span></div>
              <div className="flex items-center gap-2"><span className="w-16 text-right font-semibold text-amber-400">STALE</span><span className="text-[var(--text-secondary)]">→ Not seen in any screener email for 30+ days. Skipped until re-entry.</span></div>
              <div className="flex items-center gap-2"><span className="w-16 text-right font-semibold text-red-400">EXPIRED</span><span className="text-[var(--text-secondary)]">→ Price ran up &gt; {config?.PRICE_RUNUP_EXPIRE_PCT || 20}% since found. Opportunity missed.</span></div>
            </div>
          </CriteriaSection>

          {/* Signal Types */}
          <CriteriaSection title="Signal Types" description="Signals are generated when you click 'Generate Signals'. Priority: exits first (1), then adds (4), then buys (5), then alerts (6).">
            <CriteriaRow color="bg-emerald-500" label="BUY" desc="Stock is on the watchlist, passes all buy conditions, and you don't own it yet. Top N candidates selected by factor rank (N = remaining portfolio slots)." />
            <CriteriaRow color="bg-blue-500" label="ADD #1" desc={`You own the stock (STARTER stage), gain +${config?.ADD1_GAIN_PCT || 12}% to +${config?.ADD1_MAX_GAIN_PCT || 25}%, held ≥ ${config?.ADD_MIN_WEEKS || 2} weeks, price above 200DMA. Adds 25% of allocation.`} />
            <CriteriaRow color="bg-blue-500" label="ADD #2" desc={`Stock at ADD1 stage, gain ≥ +${config?.ADD2_GAIN_PCT || 30}%, ≥ ${config?.ADD_MIN_WEEKS || 2} weeks since ADD1, price above 200DMA. Final 25% of allocation.`} />
            <CriteriaRow color="bg-blue-500" label="DIP BUY" desc={`One-time only. Stock dropped ${config?.DIP_BUY_MIN_DROP || 10}-${config?.DIP_BUY_MAX_DROP || 20}% from avg price, RSI ≤ ${config?.DIP_BUY_RSI_MAX || 30} (oversold), price still above 200DMA. 25% of allocation.`} />
            <CriteriaRow color="bg-amber-500" label="TRAILING STOP" desc="Stock dropped below its trailing stop (calculated from peak price). Stops tighten as gains increase — see tiers below." />
            <CriteriaRow color="bg-red-500" label="HARD EXIT" desc={`Stock dropped ≥ ${config?.HARD_STOP_LOSS || 30}% from avg price. Immediate sell ALL shares. Highest priority signal.`} />
            <CriteriaRow color="bg-amber-500" label="SOFT EXIT" desc="Stock removed from watchlist or screener count dropped significantly while in profit. Consider taking profits." />
            <CriteriaRow color="bg-red-500" label="SYSTEMIC EXIT" desc={`${config?.SYSTEMIC_EXIT_COUNT || 3}+ stocks hit hard stop simultaneously. Market-wide risk — review all positions.`} />
            <CriteriaRow color="bg-red-500" label="FREEZE" desc={`Portfolio down ≥ ${config?.PORTFOLIO_FREEZE_PCT || 25}% from invested. All new buys/adds blocked until recovery.`} />
            <CriteriaRow color="bg-gray-500" label="LTCG ALERT" desc="Stock within 60 days of 1-year holding and currently at a loss. Tax implications for selling before/after." />
            <CriteriaRow color="bg-gray-500" label="SECTOR ALERT" desc={`One sector exceeds ${config?.SECTOR_ALERT_PCT || 35}% of portfolio value. Diversification warning.`} />
            <CriteriaRow color="bg-gray-500" label="REBALANCE" desc="Single stock exceeds 20% of portfolio value. Trim to 15% recommended." />
            <CriteriaRow color="bg-gray-500" label="CRASH ALERT" desc={`Nifty dropped ≥ ${config?.NIFTY_CRASH_PCT || 20}% in 1 month. Market-wide distress.`} />
          </CriteriaSection>

          {/* Buy Conditions */}
          <CriteriaSection title="Buy Conditions" description="Factor score is the primary gate. Technical conditions (golden cross, price vs 200DMA) are inside the score, not hard gates.">
            <CriteriaCheck label={`Factor score ≥ ${config?.FACTOR_BUY_MIN || 50}`} desc="Composite score from Momentum + Quality + Trend + Value + Low Vol + Relative Strength" />
            <CriteriaCheck label={`RSI ≤ ${config?.RSI_OVERBOUGHT || 70} (hard block only)`} desc="Only blocks overbought stocks. RSI 60-69 already penalized inside Trend factor score — no double punishment." />
            <CriteriaCheck label={`Base ${config?.MAX_STOCKS || 10} stocks + up to ${config?.MAX_BONUS_SLOTS || 5} bonus for score ≥ ${config?.BONUS_SCORE_THRESHOLD || 75}`} desc="Dynamic slots: high-conviction stocks (factor score above threshold) unlock extra portfolio slots" />
            <CriteriaCheck label={`Max ${config?.MAX_PER_SECTOR || 3} per sector`} desc="Sector diversification maintained" />
            <CriteriaCheck label="Cash available" desc="Budget minus current invested value must cover the starter buy amount" />
            <CriteriaCheck label="Market regime → allocation scaling" desc="Bull 100%, Caution 85%, Correction 75%, Bear 50%. Never blocks — only scales position size." />
            <CriteriaCheck label={`Market cap ≥ ₹${config?.MIN_MARKET_CAP_CR || 500} Cr`} desc="Skip micro/nano caps" />
            <CriteriaCheck label={`Liquidity ≥ ₹${config?.MIN_AVG_TRADED_VALUE_CR || 3} Cr/day`} desc="Skip illiquid stocks — avg daily traded value must be above minimum" />
            <CriteriaCheck label="Max 2 momentum-only stocks" desc="Stocks appearing only in CF-Momentum (#2) are capped at 2 in portfolio. Prevents hype-driven concentration." />
          </CriteriaSection>

          {/* Factor Model */}
          <CriteriaSection title="5-Factor Scoring Model" description="Each stock scored 0-100. Weights shift by market regime — momentum leads in bull, quality leads in bear. DII overlay ±5-10%, overlap boost ×1.1-1.2.">
            {/* Regime-dependent weight table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[var(--text-dim)] border-b border-[var(--border-light)]">
                    <th className="text-left py-1.5 font-semibold">Factor</th>
                    <th className="text-center py-1.5 font-semibold text-emerald-400">Bull</th>
                    <th className="text-center py-1.5 font-semibold text-amber-400">Caution</th>
                    <th className="text-center py-1.5 font-semibold text-orange-400">Correction</th>
                    <th className="text-center py-1.5 font-semibold text-red-400">Bear</th>
                  </tr>
                </thead>
                <tbody className="text-[var(--text-primary)]">
                  <tr className="border-b border-[var(--border-light)]"><td className="py-1.5 font-semibold text-emerald-400">Momentum</td><td className="text-center tabular-nums">40%</td><td className="text-center tabular-nums">35%</td><td className="text-center tabular-nums">25%</td><td className="text-center tabular-nums">15%</td></tr>
                  <tr className="border-b border-[var(--border-light)]"><td className="py-1.5 font-semibold text-blue-400">Quality</td><td className="text-center tabular-nums">15%</td><td className="text-center tabular-nums">20%</td><td className="text-center tabular-nums">25%</td><td className="text-center tabular-nums">30%</td></tr>
                  <tr className="border-b border-[var(--border-light)]"><td className="py-1.5 font-semibold text-amber-400">Trend</td><td className="text-center tabular-nums">20%</td><td className="text-center tabular-nums">20%</td><td className="text-center tabular-nums">25%</td><td className="text-center tabular-nums">15%</td></tr>
                  <tr className="border-b border-[var(--border-light)]"><td className="py-1.5 font-semibold text-cyan-400">Value</td><td className="text-center tabular-nums">5%</td><td className="text-center tabular-nums">10%</td><td className="text-center tabular-nums">15%</td><td className="text-center tabular-nums">25%</td></tr>
                  <tr><td className="py-1.5 font-semibold text-pink-400">Low Vol</td><td className="text-center tabular-nums">20%</td><td className="text-center tabular-nums">15%</td><td className="text-center tabular-nums">10%</td><td className="text-center tabular-nums">15%</td></tr>
                </tbody>
              </table>
            </div>
            {/* Sub-factor breakdown */}
            <div className="mt-3 space-y-2">
              <div className="bg-[var(--bg-inset)] rounded-lg p-2 border border-[var(--border-light)]">
                <div className="text-[10px] font-semibold text-emerald-400 mb-1">Momentum</div>
                <div className="text-[10px] text-[var(--text-secondary)]">Percentile rank of 6M return among all watchlist peers. Includes relative strength vs benchmark (Nifty/Midcap/Smallcap by cap class).</div>
              </div>
              <div className="bg-[var(--bg-inset)] rounded-lg p-2 border border-[var(--border-light)]">
                <div className="text-[10px] font-semibold text-blue-400 mb-1">Quality</div>
                <div className="text-[10px] text-[var(--text-secondary)]">Piotroski 35% + ROE 30% + Profit Growth 20% + Low D/E 15%. Missing data defaults to 50 (neutral).</div>
              </div>
              <div className="bg-[var(--bg-inset)] rounded-lg p-2 border border-[var(--border-light)]">
                <div className="text-[10px] font-semibold text-amber-400 mb-1">Trend</div>
                <div className="text-[10px] text-[var(--text-secondary)]">RSI zone 40% (oversold=90, overbought=10) + Golden Cross 35% (50DMA&gt;200DMA) + Price vs 200DMA 25%.</div>
              </div>
              <div className="bg-[var(--bg-inset)] rounded-lg p-2 border border-[var(--border-light)]">
                <div className="text-[10px] font-semibold text-cyan-400 mb-1">Value</div>
                <div className="text-[10px] text-[var(--text-secondary)]">Inverted PE percentile — lower PE ranks higher. Low weight in bull markets because multibaggers trade at premium valuations.</div>
              </div>
              <div className="bg-[var(--bg-inset)] rounded-lg p-2 border border-[var(--border-light)]">
                <div className="text-[10px] font-semibold text-pink-400 mb-1">Low Volatility</div>
                <div className="text-[10px] text-[var(--text-secondary)]">Inverted drawdown from 52W high — smaller drawdown ranks higher. Higher weight in bull (protects from blow-offs).</div>
              </div>
            </div>
            {/* Post-factor multipliers */}
            <div className="mt-3 bg-[var(--bg-inset)] rounded-lg p-2 border border-[var(--border-light)]">
              <div className="text-[10px] font-semibold text-[var(--text-primary)] mb-1">Post-Score Multipliers</div>
              <div className="text-[10px] text-[var(--text-secondary)]">
                <strong>DII overlay:</strong> QoQ ≥ +1% → ×1.10 | +0.5-1% → ×1.05 | &lt; -1% → ×0.95
              </div>
              <div className="text-[10px] text-[var(--text-secondary)] mt-0.5">
                <strong>Overlap boost:</strong> 2 screeners → ×1.10 | 3 screeners → ×1.20
              </div>
              <div className="text-[10px] text-[var(--text-dim)] mt-0.5">Final = min(rawScore × DII × overlap, 100)</div>
            </div>
          </CriteriaSection>

          {/* Market Regime */}
          <CriteriaSection title="Market Regime" description="Based on Nifty 50 vs its 200DMA. Never blocks a buy — only scales position size down.">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[var(--text-dim)] border-b border-[var(--border-light)]">
                    <th className="text-left py-1.5 font-semibold">Condition</th>
                    <th className="text-center py-1.5 font-semibold">Regime</th>
                    <th className="text-right py-1.5 font-semibold">Allocation</th>
                  </tr>
                </thead>
                <tbody className="text-[var(--text-primary)]">
                  <tr className="border-b border-[var(--border-light)]"><td className="py-1.5">Above 200DMA + 6M return ≥ 0%</td><td className="text-center font-semibold text-emerald-400">Bull</td><td className="text-right tabular-nums">100%</td></tr>
                  <tr className="border-b border-[var(--border-light)]"><td className="py-1.5">Above 200DMA + 6M return &lt; 0%</td><td className="text-center font-semibold text-amber-400">Caution</td><td className="text-right tabular-nums">85%</td></tr>
                  <tr className="border-b border-[var(--border-light)]"><td className="py-1.5">Below 200DMA, &lt; 5% below</td><td className="text-center font-semibold text-orange-400">Correction</td><td className="text-right tabular-nums">75%</td></tr>
                  <tr><td className="py-1.5">Below 200DMA, &gt; 5% below</td><td className="text-center font-semibold text-red-400">Bear</td><td className="text-right tabular-nums">50%</td></tr>
                </tbody>
              </table>
            </div>
          </CriteriaSection>

          {/* Position Sizing */}
          <CriteriaSection title="Position Sizing" description="Multi-layered sizing: rank-based allocation × overlap multiplier × regime multiplier. Each stock gets max 3 buys (Starter → ADD1 → ADD2).">
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Top 5', pct: config?.ALLOC_TOP5 || 10, color: 'text-emerald-400' },
                { label: 'Rank 6-10', pct: config?.ALLOC_NEXT5 || 7, color: 'text-blue-400' },
                { label: 'Rank 11+', pct: config?.ALLOC_REST || 5, color: 'text-[var(--text-dim)]' },
              ].map(c => (
                <div key={c.label} className="bg-[var(--bg-inset)] rounded-lg p-2.5 text-center border border-[var(--border-light)]">
                  <div className={`text-xs font-bold ${c.color}`}>{c.label}</div>
                  <div className="text-lg font-bold text-[var(--text-primary)] tabular-nums">{c.pct}%</div>
                  <div className="text-[10px] text-[var(--text-dim)]">of budget</div>
                </div>
              ))}
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-center text-[11px]">
              <div className="bg-emerald-500/10 text-emerald-400 rounded-lg py-1.5 font-semibold">Starter: 65%</div>
              <div className="bg-blue-500/10 text-blue-400 rounded-lg py-1.5 font-semibold">ADD #1: 25%</div>
              <div className="bg-blue-500/10 text-blue-400 rounded-lg py-1.5 font-semibold">ADD #2: 25%</div>
            </div>
            <div className="mt-2 bg-[var(--bg-inset)] rounded-lg p-2 border border-[var(--border-light)]">
              <div className="text-[10px] font-semibold text-[var(--text-primary)] mb-1">Starter Buy Formula</div>
              <div className="text-[10px] text-[var(--text-secondary)] font-mono">budget × allocPct × 65% × overlapMultiplier × regimeMultiplier</div>
              <div className="text-[10px] text-[var(--text-dim)] mt-0.5">Example: ₹10L × 10% × 65% × 1.0× × 100% = ₹65,000 starter buy</div>
            </div>
          </CriteriaSection>

          {/* MF-based Conviction */}
          <CriteriaSection title="DII/MF Conviction Overlay" description="Domestic institutional investor holding change QoQ. Boosts factor score and drives ADD signal allocation sizing.">
            <CriteriaRow color="bg-emerald-500" label="HIGH" desc={`DII holding increased ≥ ${config?.MF_HIGH_THRESHOLD || 1}% QoQ → score ×1.10, ADD allocation ${config?.ALLOC_HIGH || 15}%. Strong institutional buying.`} />
            <CriteriaRow color="bg-blue-500" label="MODERATE" desc={`DII holding increased ${config?.MF_MODERATE_THRESHOLD || 0.5}–${config?.MF_HIGH_THRESHOLD || 1}% QoQ → score ×1.05, ADD allocation ${config?.ALLOC_MODERATE || 12}%.`} />
            <CriteriaRow color="bg-gray-500" label="BASE" desc={`DII change < ${config?.MF_MODERATE_THRESHOLD || 0.5}% QoQ → no score boost, ADD allocation ${config?.ALLOC_BASE || 10}%.`} />
            <CriteriaRow color="bg-red-500" label="SELLING" desc="DII holding decreased > 1% QoQ → score ×0.95. Institutional exit signal." />
          </CriteriaSection>

          {/* Trailing Stops */}
          <CriteriaSection title="Trailing Stop Tiers" description="Stops tighten as gains increase. Tier based on MAX gain ever reached (from peak) — tiers never downgrade even if price drops.">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[var(--text-dim)] border-b border-[var(--border-light)]">
                    <th className="text-left py-1.5 font-semibold">Gain Range</th>
                    <th className="text-right py-1.5 font-semibold">Stop %</th>
                    <th className="text-right py-1.5 font-semibold">From</th>
                  </tr>
                </thead>
                <tbody className="text-[var(--text-primary)]">
                  <tr className="border-b border-[var(--border-light)]"><td className="py-1.5">Any loss</td><td className="text-right tabular-nums font-semibold text-red-400">-{config?.HARD_STOP_LOSS || 30}%</td><td className="text-right">Entry price</td></tr>
                  <tr className="border-b border-[var(--border-light)]"><td className="py-1.5">0 – 20% gain</td><td className="text-right tabular-nums">{config?.TRAILING_STOP_0_20 || 25}%</td><td className="text-right">Entry price</td></tr>
                  <tr className="border-b border-[var(--border-light)]"><td className="py-1.5">20 – 50% gain</td><td className="text-right tabular-nums">{config?.TRAILING_STOP_20_50 || 20}%</td><td className="text-right">Peak price</td></tr>
                  <tr className="border-b border-[var(--border-light)]"><td className="py-1.5">50 – 100% gain</td><td className="text-right tabular-nums">{config?.TRAILING_STOP_50_100 || 15}%</td><td className="text-right">Peak price</td></tr>
                  <tr><td className="py-1.5">100%+ gain</td><td className="text-right tabular-nums">{config?.TRAILING_STOP_100_PLUS || 12}%</td><td className="text-right">Peak price</td></tr>
                </tbody>
              </table>
            </div>
            <div className="mt-2 text-[10px] text-[var(--text-dim)] px-1">Example: Bought ₹100, peaked ₹160 (60% → tier 50-100%). Stop = ₹160 × 85% = ₹136. Even if price drops to ₹140, tier stays at 15%.</div>
          </CriteriaSection>

          {/* Daily Pipeline */}
          <CriteriaSection title="Daily Automation Pipeline" description="Two-phase trigger architecture to stay within GAS 6-minute limit. Auto-continues if needed.">
            <div className="space-y-2">
              <div className="bg-[var(--bg-inset)] rounded-lg p-2 border border-[var(--border-light)]">
                <div className="text-[10px] font-semibold text-amber-400 mb-1">Phase 1 — Market Data (Master DB, 9:00 AM)</div>
                <div className="text-[10px] text-[var(--text-secondary)]">Fetch Trendlyne data (API) → Update prices (GOOGLEFINANCE) → DII holdings → Nifty + benchmarks → Factor scoring → Persist watchlist</div>
                <div className="text-[10px] text-[var(--text-dim)] mt-0.5">Chunked with auto-continuation. ~6.5s per stock.</div>
              </div>
              <div className="bg-[var(--bg-inset)] rounded-lg p-2 border border-[var(--border-light)]">
                <div className="text-[10px] font-semibold text-emerald-400 mb-1">Phase 2 — Signals (Per-user, 9:30 AM)</div>
                <div className="text-[10px] text-[var(--text-secondary)]">Generate signals (BUY/ADD/EXIT) → Auto-execute paper trades → Track signal outcomes (7D/14D/30D)</div>
                <div className="text-[10px] text-[var(--text-dim)] mt-0.5">Fast — no GOOGLEFINANCE calls. Uses persisted data from Phase 1.</div>
              </div>
              <div className="text-[10px] text-[var(--text-dim)]">Also: Weekly recheck (Sun 10AM), Monthly sector check (1st), Quarterly fundamentals (1st).</div>
            </div>
          </CriteriaSection>

          {/* Data Flow */}
          <CriteriaSection title="Data Sources" description="Where each piece of data comes from.">
            <div className="space-y-1.5 text-xs text-[var(--text-secondary)]">
              <p><strong className="text-[var(--text-primary)]">Watchlist</strong> — Managed daily by Master DB. Fetches 3 Trendlyne screeners via API, tracks cooling periods, updates market data (GOOGLEFINANCE), enriches fundamentals (Screener.in).</p>
              <p><strong className="text-[var(--text-primary)]">Market Data</strong> — Price, RSI, 50/200DMA, returns, 52W high, drawdown, avg traded value from GOOGLEFINANCE. PE, ROE, Piotroski, D/E, DII from Screener.in.</p>
              <p><strong className="text-[var(--text-primary)]">Benchmarks</strong> — Nifty 50 via GOOGLEFINANCE. Midcap 150 and Smallcap 250 via Yahoo Finance (GOOGLEFINANCE doesn't support these).</p>
              <p><strong className="text-[var(--text-primary)]">Your Holdings</strong> — Read from your StockHoldings sheet. Joined with Screener_StockMeta for pyramid stage, peak price, and stop levels.</p>
              <p><strong className="text-[var(--text-primary)]">Nifty</strong> — Live price from NSE API / GOOGLEFINANCE (5-min cache). 200DMA and returns from Master DB (daily). Regime calculated from live price vs 200DMA.</p>
              <p><strong className="text-[var(--text-primary)]">Signals</strong> — Auto-generated daily at 9:30 AM + on-demand via button. Deduplicated by PENDING status — skips if a pending signal already exists for same symbol + type.</p>
              <p><strong className="text-[var(--text-primary)]">Paper Trading</strong> — Auto-executes BUY/SELL signals in sandbox (separate Screener_PaperTrades sheet). Tracks CAGR, P&L, win rate. No impact on real holdings.</p>
              <p><strong className="text-[var(--text-primary)]">Signal Tracking</strong> — BUY signals tracked at 7D, 14D, 30D intervals. Records actual price vs signal price to measure accuracy.</p>
              <p><strong className="text-[var(--text-primary)]">Hourly Checks</strong> — Exit conditions (trailing stop, hard exit) checked every hour during market hours (9-16 IST). Auto-sells paper positions.</p>
            </div>
          </CriteriaSection>
        </div>
      )}

      {/* ===== TRADE MODAL ===== */}
      {tradeModal && (
        <Modal
          open={true}
          title={tradeModal.type === 'buy'
            ? `Buy ${tradeModal.signal.symbol}`
            : `Sell ${tradeModal.signal.symbol}`}
          onClose={() => setTradeModal(null)}
        >
          {(() => {
            const sig = tradeModal.signal
            // Derive price from amount/shares (stored in signal row)
            const derivedPrice = sig.shares > 0 && sig.amount > 0
              ? String(Math.round(sig.amount / sig.shares))
              : ''
            const existing = (stockHoldings || []).find(h => h.symbol === sig.symbol && h.portfolioId === tradeModal.portfolioId)
            return tradeModal.type === 'buy' ? (
              <BuyStockForm
                portfolioId={tradeModal.portfolioId}
                lockPortfolio
                initialData={{
                  symbol: sig.symbol,
                  companyName: sig.name,
                  quantity: sig.shares ? String(sig.shares) : '',
                  pricePerShare: derivedPrice,
                  notes: `Screener: ${sig.type}`,
                }}
                existingHolding={existing}
                onSave={handleTradeSubmit}
                onCancel={() => setTradeModal(null)}
              />
            ) : (
              <SellStockForm
                initialData={{
                  symbol: sig.symbol,
                  companyName: sig.name,
                  quantity: sig.shares ? String(sig.shares) : '',
                  pricePerShare: derivedPrice,
                  notes: `Screener: ${sig.type}`,
                }}
                signalDetail={sig.triggerDetail}
                onSave={handleTradeSubmit}
                onCancel={() => setTradeModal(null)}
              />
            )
          })()}
        </Modal>
      )}

      {/* ===== SETTINGS TAB ===== */}
      {subTab === 'settings' && (
        <div className="space-y-4">
          {config === null ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={20} className="animate-spin text-[var(--text-dim)]" />
              <span className="ml-2 text-sm text-[var(--text-dim)]">Loading settings...</span>
            </div>
          ) : (
            <>
              {SETTINGS_SECTIONS.map(section => (
                <div key={section.title}>
                  <h3 className="text-xs font-bold text-[var(--text-dim)] uppercase tracking-wider mb-0.5 px-1">{section.title}</h3>
                  {section.description && <p className="text-[11px] text-[var(--text-dim)] mb-2 px-1">{section.description}</p>}
                  <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl divide-y divide-[var(--border-light)]">
                    {section.fields.map(({ key, label, description, type }) => {
                      const currentValue = configEdits[key] !== undefined ? configEdits[key] : config[key]
                      return (
                        <div key={key} className="flex items-center justify-between px-4 py-2.5">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-[var(--text-primary)]">{label}</div>
                            {description && <div className="text-[11px] text-[var(--text-dim)]">{description}</div>}
                          </div>
                          <div className="ml-4 w-28 flex justify-end">
                            {type === 'boolean' ? (
                              <button
                                onClick={async () => {
                                  const newVal = currentValue === true || currentValue === 'TRUE' ? false : true
                                  setConfig(prev => ({ ...prev, [key]: newVal }))
                                  try {
                                    const isApp = CONFIG_FIELDS.find(f => f.key === key)?.isAppSetting
                                    if (isApp) {
                                      await api.saveSettings({ [key]: newVal ? 'TRUE' : 'FALSE' })
                                    } else {
                                      await api.updateScreenerConfigValue(key, newVal ? 'TRUE' : 'FALSE')
                                    }
                                    showToast(`${label} ${newVal ? 'enabled' : 'disabled'}`)
                                  } catch (err) {
                                    setConfig(prev => ({ ...prev, [key]: !newVal }))
                                    showToast(err.message || 'Failed to save', 'error')
                                  }
                                }}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                  currentValue === true || currentValue === 'TRUE' ? 'bg-emerald-500' : 'bg-gray-600'
                                }`}
                              >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                  currentValue === true || currentValue === 'TRUE' ? 'translate-x-6' : 'translate-x-1'
                                }`} />
                              </button>
                            ) : (
                              <input
                                type={f.type === 'text' ? 'text' : 'number'}
                                value={currentValue ?? ''}
                                onChange={(e) => setConfigEdits(prev => ({
                                  ...prev,
                                  [key]: f.type === 'text' ? e.target.value : (parseFloat(e.target.value) || 0)
                                }))}
                                className={`w-full px-2 py-1 text-sm rounded border border-[var(--border)] bg-[var(--bg-base)] text-[var(--text-primary)] focus:border-violet-500 focus:outline-none ${f.type === 'text' ? 'text-left' : 'text-right'}`}
                              />
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}

              {Object.keys(configEdits).length > 0 && (
                <button
                  onClick={handleConfigSave}
                  disabled={savingConfig}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-50 transition-colors shadow-sm"
                >
                  {savingConfig ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Save {Object.keys(configEdits).length} Change(s)
                </button>
              )}

              {/* Reset / Clear Data */}
              <div className="mt-4">
                <h3 className="text-xs font-bold text-[var(--text-dim)] uppercase tracking-wider mb-0.5 px-1">Danger Zone</h3>
                <p className="text-[11px] text-[var(--text-dim)] mb-2 px-1">Clear screener data. This cannot be undone.</p>
                <div className="bg-[var(--bg-card)] border border-red-900/30 rounded-xl divide-y divide-[var(--border-light)]">
                  <div className="flex items-center justify-between px-4 py-3">
                    <div>
                      <div className="text-sm font-medium text-[var(--text-primary)]">Reset Paper Trades</div>
                      <div className="text-[11px] text-[var(--text-dim)]">Clear all paper positions and trade history</div>
                    </div>
                    <button
                      onClick={async () => {
                        if (!window.confirm('Clear all paper trades? This cannot be undone.')) return
                        try {
                          await api.resetPaperTrades()
                          showToast('Paper trades cleared')
                        } catch (err) { showToast(err.message || 'Failed', 'error') }
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-red-400 border border-red-900/40 hover:bg-red-900/20 transition-colors"
                    >
                      <Trash2 size={13} /> Clear
                    </button>
                  </div>
                  <div className="flex items-center justify-between px-4 py-3">
                    <div>
                      <div className="text-sm font-medium text-[var(--text-primary)]">Reset Signals</div>
                      <div className="text-[11px] text-[var(--text-dim)]">Clear all generated signals history</div>
                    </div>
                    <button
                      onClick={async () => {
                        if (!window.confirm('Clear all signals? This cannot be undone.')) return
                        try {
                          await api.resetSignals()
                          showToast('Signals cleared')
                        } catch (err) { showToast(err.message || 'Failed', 'error') }
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-red-400 border border-red-900/40 hover:bg-red-900/20 transition-colors"
                    >
                      <Trash2 size={13} /> Clear
                    </button>
                  </div>
                  <div className="flex items-center justify-between px-4 py-3">
                    <div>
                      <div className="text-sm font-medium text-[var(--text-primary)]">Reset Everything</div>
                      <div className="text-[11px] text-[var(--text-dim)]">Clear all signals, paper trades, and stock metadata</div>
                    </div>
                    <button
                      onClick={async () => {
                        if (!window.confirm('Reset ALL screener data (signals + paper trades + stock meta)? This cannot be undone.')) return
                        try {
                          await api.resetScreenerAll()
                          showToast('All screener data cleared')
                        } catch (err) { showToast(err.message || 'Failed', 'error') }
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-red-400 border border-red-900/40 hover:bg-red-900/20 transition-colors"
                    >
                      <Trash2 size={13} /> Reset All
                    </button>
                  </div>
                  <div className="flex items-center justify-between px-4 py-3">
                    <div>
                      <div className="text-sm font-medium text-amber-400">Reset & Re-run</div>
                      <div className="text-[11px] text-[var(--text-dim)]">Clear everything, regenerate signals, and auto-execute paper trades</div>
                    </div>
                    <button
                      onClick={async () => {
                        if (!window.confirm('Reset ALL data and re-run signal generation + paper trades?')) return
                        try {
                          showToast('Resetting and re-running...')
                          const result = await api.resetAndRerun()
                          showToast(`Done! ${result.signalsGenerated} signals, ${result.paperTradesExecuted} paper trades`)
                        } catch (err) { showToast(err.message || 'Failed', 'error') }
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-amber-400 border border-amber-900/40 hover:bg-amber-900/20 transition-colors"
                    >
                      <RefreshCw size={13} /> Re-run
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Helper: inline badge renderer (used in mobile cards) ──
// ── Criteria tab helper components ──
function CriteriaSection({ title, description, children }) {
  return (
    <div>
      <h3 className="text-xs font-bold text-[var(--text-dim)] uppercase tracking-wider mb-0.5 px-1">{title}</h3>
      {description && <p className="text-[11px] text-[var(--text-dim)] mb-2 px-1">{description}</p>}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-3 space-y-2">
        {children}
      </div>
    </div>
  )
}

function CriteriaRow({ color, label, desc, link }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className={`mt-1 w-2 h-2 rounded-full ${color} shrink-0`} />
      <div>
        {link ? (
          <a href={link} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-violet-400 hover:text-violet-300 transition-colors">{label}</a>
        ) : (
          <span className="text-xs font-bold text-[var(--text-primary)]">{label}</span>
        )}
        <span className="text-[11px] text-[var(--text-dim)] ml-1.5">{desc}</span>
      </div>
    </div>
  )
}

function CriteriaCheck({ label, desc }) {
  return (
    <div className="flex items-start gap-2">
      <Check size={12} className="mt-0.5 text-emerald-400 shrink-0" />
      <div>
        <span className="text-xs font-semibold text-[var(--text-primary)]">{label}</span>
        {desc && <span className="text-[11px] text-[var(--text-dim)] ml-1.5">— {desc}</span>}
      </div>
    </div>
  )
}

function BadgeRenderer({ value, map }) {
  const style = map[value] || map.LOW || { color: 'var(--text-dim)', bg: 'var(--bg-inset)' }
  return <span style={{ padding: '1px 6px', borderRadius: 4, fontSize: 9, fontWeight: 600, color: style.color, background: style.bg }}>{value || '-'}</span>
}

// ── AG Grid theme ──
const screenerGridTheme = themeQuartz.withParams({
  backgroundColor: 'var(--bg-card)',
  foregroundColor: 'var(--text-primary)',
  headerBackgroundColor: 'var(--bg-inset)',
  headerFontSize: 11,
  headerFontWeight: 700,
  headerTextColor: 'var(--text-muted)',
  fontSize: 12,
  rowBorder: { color: 'var(--border-light)', width: 1 },
  columnBorder: false,
  borderColor: 'var(--border)',
  oddRowBackgroundColor: 'transparent',
  rowHoverColor: 'var(--bg-hover)',
  fontFamily: 'inherit',
  spacing: 4,
  wrapperBorderRadius: 12,
  cellTextColor: 'var(--text-primary)',
})

// ── Cell Renderers ──
const ReturnCellRenderer = ({ value }) => {
  if (value == null) return <span style={{ color: 'var(--text-dim)' }}>-</span>
  const color = value > 0 ? '#34d399' : value < 0 ? 'var(--accent-rose)' : 'var(--text-dim)'
  return <span style={{ color, fontVariantNumeric: 'tabular-nums', fontWeight: 600, fontSize: 12 }}>{value > 0 ? '+' : ''}{value}%</span>
}

const stockUrl = (symbol) => `https://trendlyne.com/equity/${symbol}/latest/`

const StockCellRenderer = ({ data }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 5, lineHeight: 1.3 }}>
    {data.allBuyMet === 'YES' && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34d399', flexShrink: 0 }} />}
    <div>
      <a href={stockUrl(data.symbol)} target="_blank" rel="noopener noreferrer"
        style={{ fontWeight: 700, fontSize: 12, color: 'inherit', textDecoration: 'none' }}
        onMouseEnter={e => e.target.style.color = '#818cf8'}
        onMouseLeave={e => e.target.style.color = 'inherit'}
      >{data.symbol}</a>
      <div style={{ fontSize: 10, color: 'var(--text-dim)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{data.name}</div>
    </div>
  </div>
)

const SCREENER_NAMES = { '1': 'C', '2': 'M', '3': 'G' }  // Compounder, Momentum, Growth
const SCREENER_COLORS = { '1': '#8b5cf6', '2': '#3b82f6', '3': '#10b981' }
const SCREENER_TOOLTIPS = { '1': 'CF-Compounder', '2': 'CF-Momentum', '3': 'CF-Growth' }

const ScreenersCellRenderer = ({ value }) => {
  if (!value || value === 'CF-Stock-Screener') return <span style={{ color: 'var(--text-dim)', fontSize: 10 }}>-</span>
  const nums = String(value).split(',').map(s => s.trim()).filter(Boolean)
  return (
    <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
      {nums.map(n => (
        <span key={n} title={SCREENER_TOOLTIPS[n] || `Screener ${n}`}
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 20, height: 18, borderRadius: 4, fontSize: 10, fontWeight: 700,
            background: (SCREENER_COLORS[n] || '#6b7280') + '22',
            color: SCREENER_COLORS[n] || '#6b7280',
            border: `1px solid ${(SCREENER_COLORS[n] || '#6b7280')}44`
          }}
        >{SCREENER_NAMES[n] || n}</span>
      ))}
      {nums.length >= 2 && (
        <span style={{ fontSize: 9, fontWeight: 700, color: nums.length >= 3 ? '#10b981' : '#60a5fa' }}>
          {nums.length >= 3 ? '×1.2' : '×1.1'}
        </span>
      )}
    </div>
  )
}

const FactorScoreCellRenderer = ({ value }) => {
  if (!value) return <span style={{ color: 'var(--text-dim)' }}>-</span>
  const score = Number(value)
  const color = score >= 70 ? '#34d399' : score >= 50 ? '#60a5fa' : score >= 35 ? '#fbbf24' : '#f87171'
  const label = score >= 70 ? 'STRONG' : score >= 50 ? 'BUY' : score >= 35 ? 'WATCH' : 'AVOID'
  const pct = Math.min(score, 100)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
      <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--bg-inset)', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 3, background: color, transition: 'width 0.3s' }} />
      </div>
      <span style={{ fontSize: 10, fontWeight: 700, color, minWidth: 28, textAlign: 'right' }}>{score}</span>
    </div>
  )
}

const StatusCellRenderer = ({ value }) => {
  const s = STATUS_COLORS[value] || STATUS_COLORS.NEW
  return <span style={{ padding: '2px 7px', borderRadius: 10, fontSize: 9, fontWeight: 700, color: s.color, background: s.bg }}>{value}</span>
}

const ConvictionCellRenderer = ({ value }) => {
  const s = CONVICTION_COLORS[value] || CONVICTION_COLORS.BASE
  return <span style={{ padding: '2px 5px', borderRadius: 4, fontSize: 9, fontWeight: 700, color: s.color, background: s.bg }}>{value || '-'}</span>
}

const PriceCellRenderer = ({ data }) => (
  <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', lineHeight: 1.5 }}>
    <div style={{ fontWeight: 600, fontSize: 12 }}>{data.currentPrice ? `₹${Number(data.currentPrice).toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '-'}</div>
    {data.foundPrice && (
      <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>Entry ₹{Number(data.foundPrice).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
    )}
  </div>
)

const RsiCellRenderer = ({ value }) => {
  if (value == null) return <span style={{ color: 'var(--text-dim)' }}>-</span>
  const color = value <= 30 ? '#34d399' : value >= 70 ? 'var(--accent-rose)' : value <= 45 ? '#6ee7b7' : 'var(--text-primary)'
  return <span style={{ color, fontVariantNumeric: 'tabular-nums', fontWeight: 600, fontSize: 12 }}>{value}</span>
}

const GoldenCrossCellRenderer = ({ value }) => {
  if (!value) return <span style={{ color: 'var(--text-dim)' }}>-</span>
  const isYes = value === 'YES'
  return <span style={{ color: isYes ? '#34d399' : 'var(--accent-rose)', fontSize: 9, fontWeight: 700 }}>{isYes ? 'YES' : 'NO'}</span>
}

const RelStrCellRenderer = ({ value }) => {
  if (!value) return <span style={{ color: 'var(--text-dim)' }}>-</span>
  const isPass = value === 'PASS'
  return <span style={{ padding: '1px 5px', borderRadius: 3, fontSize: 9, fontWeight: 700, color: isPass ? '#34d399' : 'var(--accent-rose)', background: isPass ? 'rgba(52,211,153,0.12)' : 'rgba(248,113,113,0.12)' }}>{value}</span>
}

const CapCellRenderer = ({ value }) => {
  if (!value) return <span style={{ color: 'var(--text-dim)' }}>-</span>
  const colors = { LARGE: '#60a5fa', MID: '#fbbf24', SMALL: '#f87171' }
  return <span style={{ fontSize: 9, fontWeight: 700, color: colors[value] || 'var(--text-dim)' }}>{value}</span>
}

const returnValueGetter = (field) => (params) => {
  const v = params.data[field]
  return v != null ? parseFloat(Number(v).toFixed(1)) : null
}

// ── Sort priorities — lower = higher priority ──
const STATUS_PRIORITY = { ELIGIBLE: 0, COOLING: 1, NEW: 2, BOUGHT: 3, STALE: 4, EXPIRED: 5 }
const CONVICTION_PRIORITY = { HIGH: 0, MODERATE: 1, BASE: 2 }

const statusComparator = (a, b) => (STATUS_PRIORITY[a] ?? 9) - (STATUS_PRIORITY[b] ?? 9)
const convictionComparator = (a, b) => (CONVICTION_PRIORITY[a] ?? 9) - (CONVICTION_PRIORITY[b] ?? 9)

// ── Column Defs ──
// Default sort: Status (ELIGIBLE first) → Conviction (HIGH first) → RSI (lowest first)
const watchlistColDefs = [
  { field: 'factorRank', headerName: '#', minWidth: 45, width: 50, type: 'numericColumn', sort: 'asc', sortIndex: 0,
    cellStyle: p => ({ fontWeight: 700, color: p.value <= 5 ? '#34d399' : p.value <= 10 ? '#60a5fa' : 'var(--text-dim)' }),
    valueFormatter: p => p.value && p.value < 99 ? '#' + p.value : '-' },
  { field: 'symbol', headerName: 'Stock', cellRenderer: StockCellRenderer, minWidth: 140, flex: 1.2, filter: 'agTextColumnFilter', pinned: 'left' },
  { field: 'factorScore', headerName: 'Score', cellRenderer: FactorScoreCellRenderer, minWidth: 110, width: 120, type: 'numericColumn', filter: 'agNumberColumnFilter',
    headerTooltip: 'Composite factor score (0-100). 70+ = Strong Buy, 50-69 = Buy, 35-49 = Watch, <35 = Avoid' },
  { field: 'screeners', headerName: 'Screeners', cellRenderer: ScreenersCellRenderer, minWidth: 100, width: 120, filter: 'agTextColumnFilter',
    headerTooltip: 'C = Compounder, M = Momentum, G = Growth. Overlap boost shown (×1.1 or ×1.2)',
    comparator: (a, b) => {
      const countA = a ? String(a).split(',').length : 0
      const countB = b ? String(b).split(',').length : 0
      return countB - countA
    }},
  { field: 'status', headerName: 'Status', cellRenderer: StatusCellRenderer, minWidth: 90, width: 95, filter: 'agTextColumnFilter',
    comparator: statusComparator },
  { field: 'capClass', headerName: 'Cap', cellRenderer: CapCellRenderer, minWidth: 65, width: 70, filter: 'agTextColumnFilter' },
  { field: 'sector', headerName: 'Sector', minWidth: 100, width: 110, filter: 'agTextColumnFilter',
    cellStyle: { fontSize: 11, color: 'var(--text-dim)' },
    valueFormatter: p => p.value || '-' },
  { field: 'currentPrice', headerName: 'Price', cellRenderer: PriceCellRenderer, minWidth: 100, width: 110, type: 'numericColumn', filter: 'agNumberColumnFilter' },
  { field: 'rsi', headerName: 'RSI', cellRenderer: RsiCellRenderer, minWidth: 60, width: 65, type: 'numericColumn', filter: 'agNumberColumnFilter',
    valueGetter: p => p.data.rsi != null ? parseFloat(Number(p.data.rsi).toFixed(1)) : null },
  { field: 'goldenCross', headerName: 'Golden Cross', cellRenderer: GoldenCrossCellRenderer, minWidth: 110, width: 115, filter: 'agTextColumnFilter',
    headerTooltip: '50DMA > 200DMA = YES' },
  { field: 'relativeStrength', headerName: 'Benchmark', cellRenderer: RelStrCellRenderer, minWidth: 95, width: 100, filter: 'agTextColumnFilter',
    headerTooltip: '6M return beats Nifty + cap index (PASS/FAIL)' },
  { field: 'pe', headerName: 'PE', minWidth: 60, width: 65, type: 'numericColumn', filter: 'agNumberColumnFilter',
    valueFormatter: p => p.value != null ? p.value.toFixed(1) : '-',
    cellStyle: { fontSize: 11 } },
  { field: 'piotroski', headerName: 'Pio', minWidth: 50, width: 55, type: 'numericColumn', filter: 'agNumberColumnFilter',
    cellStyle: p => ({ fontWeight: 600, color: p.value >= 7 ? '#34d399' : p.value >= 5 ? '#fbbf24' : '#f87171' }),
    headerTooltip: 'Piotroski F-Score (0-9). 7+ = strong' },
  { field: 'roe', headerName: 'ROE', minWidth: 55, width: 60, type: 'numericColumn', filter: 'agNumberColumnFilter',
    valueFormatter: p => p.value != null ? p.value.toFixed(1) + '%' : '-',
    cellStyle: { fontSize: 11 } },
  { field: 'drawdown', headerName: 'DD%', minWidth: 60, width: 65, type: 'numericColumn', filter: 'agNumberColumnFilter',
    valueFormatter: p => p.value != null ? p.value.toFixed(1) + '%' : '-',
    cellStyle: p => ({ fontSize: 11, color: p.value < -20 ? '#f87171' : p.value < -10 ? '#fbbf24' : 'var(--text-dim)' }),
    headerTooltip: 'Drawdown from 52-week high' },
  { field: 'avgTradedValCr', headerName: 'Liq', minWidth: 55, width: 60, type: 'numericColumn', filter: 'agNumberColumnFilter',
    valueFormatter: p => p.value > 0 ? p.value.toFixed(1) : '-',
    cellStyle: p => ({ fontSize: 11, color: p.value > 0 && p.value < 3 ? '#f87171' : 'var(--text-dim)' }),
    headerTooltip: 'Avg daily traded value (₹ Cr)' },
  { field: 'return1w', headerName: '1W', cellRenderer: ReturnCellRenderer, valueGetter: returnValueGetter('return1w'), minWidth: 65, width: 70, type: 'numericColumn', filter: 'agNumberColumnFilter' },
  { field: 'return1m', headerName: '1M', cellRenderer: ReturnCellRenderer, valueGetter: returnValueGetter('return1m'), minWidth: 65, width: 70, type: 'numericColumn', filter: 'agNumberColumnFilter' },
  { field: 'return6m', headerName: '6M', cellRenderer: ReturnCellRenderer, valueGetter: returnValueGetter('return6m'), minWidth: 65, width: 70, type: 'numericColumn', filter: 'agNumberColumnFilter' },
  { field: 'return1y', headerName: '1Y', cellRenderer: ReturnCellRenderer, valueGetter: returnValueGetter('return1y'), minWidth: 65, width: 70, type: 'numericColumn', filter: 'agNumberColumnFilter' },
  { field: 'conviction', headerName: 'DII', cellRenderer: ConvictionCellRenderer, minWidth: 80, width: 85, filter: 'agTextColumnFilter',
    headerTooltip: 'DII/MF conviction overlay (HIGH/MODERATE/BASE)' },
  { field: 'profitGrowth', headerName: 'PG 3Y', minWidth: 60, width: 65, type: 'numericColumn', filter: 'agNumberColumnFilter',
    valueFormatter: p => p.value != null ? p.value.toFixed(1) + '%' : '-',
    cellStyle: { fontSize: 11 }, headerTooltip: 'Net Profit Growth 3Y %' },
  { field: 'debtToEquity', headerName: 'D/E', minWidth: 55, width: 60, type: 'numericColumn', filter: 'agNumberColumnFilter',
    valueFormatter: p => p.value != null ? p.value.toFixed(2) : '-',
    cellStyle: p => ({ fontSize: 11, color: p.value > 1 ? '#f87171' : 'var(--text-dim)' }),
    headerTooltip: 'Total Debt / Total Equity' },
  { field: 'epsGrowth', headerName: 'EPS', minWidth: 60, width: 65, type: 'numericColumn', filter: 'agNumberColumnFilter',
    valueFormatter: p => p.value != null ? p.value.toFixed(1) + '%' : '-',
    cellStyle: p => ({ fontSize: 11, color: p.value > 0 ? '#34d399' : p.value < 0 ? '#f87171' : 'var(--text-dim)' }),
    headerTooltip: 'EPS Growth TTM %' },
  { field: 'opmQtr', headerName: 'OPM', minWidth: 55, width: 60, type: 'numericColumn', filter: 'agNumberColumnFilter',
    valueFormatter: p => p.value != null ? p.value.toFixed(1) + '%' : '-',
    cellStyle: { fontSize: 11 }, headerTooltip: 'Operating Profit Margin Qtr %' },
  { field: 'priceToBook', headerName: 'P/B', minWidth: 55, width: 60, type: 'numericColumn', filter: 'agNumberColumnFilter',
    valueFormatter: p => p.value != null ? p.value.toFixed(2) : '-',
    cellStyle: { fontSize: 11 }, headerTooltip: 'Price to Book Value' },
  { field: 'fiiHolding', headerName: 'FII%', minWidth: 55, width: 60, type: 'numericColumn', filter: 'agNumberColumnFilter',
    valueFormatter: p => p.value != null ? p.value.toFixed(1) + '%' : '-',
    cellStyle: { fontSize: 11 }, headerTooltip: 'FII Holding %' },
  { field: 'promoterHolding', headerName: 'Prom%', minWidth: 60, width: 65, type: 'numericColumn', filter: 'agNumberColumnFilter',
    valueFormatter: p => p.value != null ? p.value.toFixed(1) + '%' : '-',
    cellStyle: { fontSize: 11 }, headerTooltip: 'Promoter Holding %' },
]

const defaultColDef = {
  sortable: true,
  resizable: true,
  suppressMovable: true,
  filter: true,
  floatingFilter: true,
}

// ── Paper Trading Tab Component ──
function PaperTradingTab({ showToast }) {
  const [portfolio, setPortfolio] = useState(null)
  const [performance, setPerformance] = useState(null)
  const [tracking, setTracking] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeView, setActiveView] = useState('portfolio') // portfolio, performance, tracking

  useEffect(() => { loadPaperData() }, [])

  const loadPaperData = async () => {
    setLoading(true)
    try {
      const [p, perf, t] = await Promise.allSettled([
        api.getPaperPortfolio(),
        api.getPaperPerformance(),
        api.getSignalTracking()
      ])
      if (p.status === 'fulfilled') setPortfolio(p.value)
      if (perf.status === 'fulfilled') setPerformance(perf.value)
      if (t.status === 'fulfilled') setTracking(t.value)
    } catch (err) {
      showToast(err.message || 'Failed to load paper trading data', 'error')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={20} className="animate-spin text-[var(--text-dim)]" />
        <span className="ml-2 text-sm text-[var(--text-dim)]">Loading paper trading data...</span>
      </div>
    )
  }

  const perf = performance || {}
  const port = portfolio || { holdings: [], summary: {} }
  const summ = port.summary || {}

  const totalPnl = (perf.totalPnl || 0)
  const totalPnlPct = (perf.totalPnlPct || summ.totalPnlPct || 0)
  const pnlUp = totalPnl >= 0
  const pf = port.portfolioFactors
  const fa = port.factorAllocation
  const _fc = (v) => v >= 70 ? 'text-emerald-400' : v >= 50 ? 'text-blue-400' : v >= 35 ? 'text-amber-400' : 'text-[var(--text-dim)]'

  return (
    <div className="space-y-3">
      {/* ── Summary Card ── */}
      <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] px-4 py-3">
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-y-3 gap-x-4">
          {/* Primary 3 */}
          <div>
            <p className="text-[10px] text-[var(--text-dim)] uppercase">Invested</p>
            <p className="text-sm font-bold text-[var(--text-primary)] tabular-nums">{formatINR(summ.totalInvested || 0)}</p>
          </div>
          <div>
            <p className="text-[10px] text-[var(--text-dim)] uppercase">Current</p>
            <p className="text-sm font-bold text-[var(--text-primary)] tabular-nums">{formatINR(summ.totalCurrentValue || 0)}</p>
          </div>
          <div>
            <p className="text-[10px] text-[var(--text-dim)] uppercase">P&L</p>
            <p className={`text-sm font-bold tabular-nums ${pnlUp ? 'text-emerald-400' : 'text-[var(--accent-rose)]'}`}>{pnlUp ? '+' : ''}{formatINR(totalPnl)} <span className="text-xs font-semibold">({pnlUp ? '+' : ''}{totalPnlPct}%)</span></p>
          </div>
          {/* Secondary 3 */}
          <div>
            <p className="text-[10px] text-[var(--text-dim)] uppercase">Win Rate</p>
            <p className="text-sm font-bold text-[var(--text-primary)] tabular-nums">{perf.winRate || 0}%</p>
          </div>
          <div>
            <p className="text-[10px] text-[var(--text-dim)] uppercase">CAGR</p>
            <p className={`text-sm font-bold tabular-nums ${(perf.cagr || 0) > 0 ? 'text-emerald-400' : 'text-[var(--text-primary)]'}`}>{perf.cagr || 0}%</p>
          </div>
          <div>
            <p className="text-[10px] text-[var(--text-dim)] uppercase">Trades</p>
            <p className="text-sm font-bold text-[var(--text-primary)] tabular-nums">{perf.totalTrades || 0}</p>
          </div>
        </div>

        {/* Factor Allocation — stacked bar + legend */}
        {fa && (
          <div className="mt-3 pt-3 border-t border-[var(--border-light)]">
            <p className="text-[9px] text-[var(--text-dim)] uppercase mb-1.5">Factor Allocation</p>
            {/* Stacked bar */}
            <div className="w-full h-3 rounded-full bg-[var(--bg-inset)] overflow-hidden flex">
              {[
                { k: 'momentum', c: 'bg-violet-500' },
                { k: 'quality', c: 'bg-emerald-500' },
                { k: 'trend', c: 'bg-blue-500' },
                { k: 'value', c: 'bg-amber-500' },
                { k: 'lowVol', c: 'bg-cyan-500' },
              ].map(({ k, c }) => fa[k] > 0 ? (
                <div key={k} className={`h-full ${c}`} style={{ width: `${fa[k]}%` }} />
              ) : null)}
            </div>
            {/* Legend */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
              {[
                { k: 'momentum', l: 'Momentum', c: 'bg-violet-500', tc: 'text-violet-400' },
                { k: 'quality', l: 'Quality', c: 'bg-emerald-500', tc: 'text-emerald-400' },
                { k: 'trend', l: 'Trend', c: 'bg-blue-500', tc: 'text-blue-400' },
                { k: 'value', l: 'Value', c: 'bg-amber-500', tc: 'text-amber-400' },
                { k: 'lowVol', l: 'Low Vol', c: 'bg-cyan-500', tc: 'text-cyan-400' },
              ].map(({ k, l, c, tc }) => (
                <div key={k} className="flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-sm ${c}`} />
                  <span className="text-[10px] text-[var(--text-dim)]">{l}</span>
                  <span className={`text-[10px] font-bold tabular-nums ${tc}`}>{fa[k]}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Sub-nav ── */}
      <div className="flex items-center gap-4 border-b border-[var(--border-light)] text-xs">
        {[
          { key: 'portfolio', label: `Positions (${port.holdings.length})` },
          { key: 'performance', label: 'Performance' },
          { key: 'tracking', label: 'Signal Accuracy' },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => setActiveView(key)}
            className={`pb-2 font-semibold transition-colors border-b-2 -mb-px ${
              activeView === key
                ? 'text-[var(--text-primary)] border-violet-500'
                : 'text-[var(--text-muted)] border-transparent hover:text-[var(--text-secondary)]'
            }`}>{label}</button>
        ))}
      </div>

      {/* ── Portfolio View ── */}
      {activeView === 'portfolio' && (
        <div className="space-y-2">
          {port.holdings.length === 0 ? (
            <p className="text-xs text-[var(--text-dim)] py-4">No paper positions yet. Enable paper trading in Settings and generate signals.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-[var(--bg-inset)] border-b border-[var(--border-light)] text-[10px] font-semibold text-[var(--text-dim)] uppercase">
                    <th className="py-2 px-3">Stock</th>
                    <th className="py-2 px-2 text-center">Score</th>
                    <th className="py-2 px-2 text-right">Qty</th>
                    <th className="py-2 px-2 text-right">Avg</th>
                    <th className="py-2 px-2 text-right">Price</th>
                    <th className="py-2 px-2 text-right">Invested</th>
                    <th className="py-2 px-2 text-right">Current</th>
                    <th className="py-2 px-2 text-right">P&L</th>
                    <th className="py-2 px-2 text-right">P&L%</th>
                    <th className="py-2 px-2 text-center hidden lg:table-cell">RSI</th>
                    <th className="py-2 px-2 text-right hidden lg:table-cell">PE</th>
                    <th className="py-2 px-2 text-right hidden lg:table-cell">ROE</th>
                    <th className="py-2 px-2 text-right hidden xl:table-cell">52W</th>
                  </tr>
                </thead>
                <tbody>
                  {[...port.holdings].sort((a, b) => (b.factorScore || 0) - (a.factorScore || 0)).map(h => {
                    const up = h.pnl >= 0
                    const invested = h.shares * h.entryPrice
                    const current = h.shares * (h.currentPrice || h.entryPrice)
                    const from52w = h.high52w && h.currentPrice ? ((h.currentPrice - h.high52w) / h.high52w * 100).toFixed(1) : null
                    return (
                      <tr key={h.symbol} className="border-b border-[var(--border-light)] last:border-0 hover:bg-[var(--bg-hover)] transition-colors">
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-1.5">
                            <a href={stockUrl(h.symbol)} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-[var(--text-primary)] hover:text-blue-400 hover:underline">{h.symbol}</a>
                            {h.isLocked && <span className="text-[9px] px-1 py-0.5 rounded bg-amber-500/20 text-amber-400 font-semibold leading-none">LOCK</span>}
                            {h.conviction === 'HIGH' && <span className="text-[9px] px-1 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-semibold leading-none">H</span>}
                            {h.conviction === 'MODERATE' && <span className="text-[9px] px-1 py-0.5 rounded bg-blue-500/15 text-blue-400 font-semibold leading-none">M</span>}
                          </div>
                          <p className="text-[10px] text-[var(--text-dim)] truncate max-w-[140px]">{h.sector} · {h.capClass}{h.goldenCross === 'YES' ? ' · GC' : ''}</p>
                        </td>
                        <td className="py-2 px-2 text-center">
                          <span className={`text-xs font-bold tabular-nums ${_fc(h.factorScore)}`}>{h.factorScore ?? '—'}</span>
                          {h.factorRank && <p className="text-[8px] text-[var(--text-dim)]">#{h.factorRank}</p>}
                        </td>
                        <td className="py-2 px-2 text-right text-xs text-[var(--text-secondary)] tabular-nums">{h.shares}</td>
                        <td className="py-2 px-2 text-right text-xs text-[var(--text-muted)] tabular-nums">₹{Number(h.entryPrice).toLocaleString('en-IN', { maximumFractionDigits: 1 })}</td>
                        <td className="py-2 px-2 text-right text-xs font-semibold text-[var(--text-primary)] tabular-nums">₹{Number(h.currentPrice || h.entryPrice).toLocaleString('en-IN', { maximumFractionDigits: 1 })}</td>
                        <td className="py-2 px-2 text-right text-xs text-[var(--text-secondary)] tabular-nums">{formatINR(invested)}</td>
                        <td className="py-2 px-2 text-right text-xs font-semibold text-[var(--text-primary)] tabular-nums">{formatINR(current)}</td>
                        <td className={`py-2 px-2 text-right text-xs font-semibold tabular-nums ${up ? 'text-emerald-400' : 'text-[var(--accent-rose)]'}`}>
                          {up ? '+' : ''}{formatINR(h.pnl)}
                        </td>
                        <td className={`py-2 px-2 text-right text-xs font-bold tabular-nums ${up ? 'text-emerald-400' : 'text-[var(--accent-rose)]'}`}>
                          {up ? '+' : ''}{h.pnlPct}%
                        </td>
                        <td className={`py-2 px-2 text-center text-xs tabular-nums hidden lg:table-cell ${h.rsi > 70 ? 'text-red-400' : h.rsi < 30 ? 'text-emerald-400' : 'text-[var(--text-secondary)]'}`}>{h.rsi != null ? Math.round(h.rsi) : '—'}</td>
                        <td className="py-2 px-2 text-right text-xs text-[var(--text-secondary)] tabular-nums hidden lg:table-cell">{h.pe != null ? h.pe.toFixed(1) : '—'}</td>
                        <td className="py-2 px-2 text-right text-xs text-[var(--text-secondary)] tabular-nums hidden lg:table-cell">{h.roe != null ? `${h.roe.toFixed(1)}%` : '—'}</td>
                        <td className={`py-2 px-2 text-right text-xs tabular-nums hidden xl:table-cell ${from52w && parseFloat(from52w) >= -5 ? 'text-emerald-400' : from52w && parseFloat(from52w) < -20 ? 'text-red-400' : 'text-[var(--text-secondary)]'}`}>{from52w != null ? `${from52w}%` : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Performance View ── */}
      {activeView === 'performance' && (
        <div className="space-y-3">
          {perf.bestTrade && (
            <div className="grid grid-cols-2 gap-2">
              <div className="px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <div className="text-[10px] text-emerald-400/70 uppercase tracking-wide">Best Trade</div>
                <div className="text-xs font-bold text-emerald-400 mt-0.5">{perf.bestTrade.symbol} +{perf.bestTrade.pnlPct}%</div>
                <div className="text-[10px] text-emerald-400/60">+{formatINR(perf.bestTrade.pnl)}</div>
              </div>
              <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
                <div className="text-[10px] text-red-400/70 uppercase tracking-wide">Worst Trade</div>
                <div className="text-xs font-bold text-red-400 mt-0.5">{perf.worstTrade.symbol} {perf.worstTrade.pnlPct}%</div>
                <div className="text-[10px] text-red-400/60">{formatINR(perf.worstTrade.pnl)}</div>
              </div>
            </div>
          )}

          <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wide">Recent Closed Trades</h3>
          {(perf.recentTrades || []).length === 0 ? (
            <p className="text-xs text-[var(--text-dim)] py-4">No closed paper trades yet.</p>
          ) : (
            <div className="space-y-1">
              {perf.recentTrades.map((t, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--bg-inset)]">
                  <div>
                    <span className="text-xs font-semibold text-[var(--text-primary)]">{t.symbol}</span>
                    <span className="text-[10px] text-[var(--text-dim)] ml-2">{t.holdingDays}d</span>
                  </div>
                  <span className={`text-xs font-bold tabular-nums ${t.pnl >= 0 ? 'text-emerald-400' : 'text-[var(--accent-rose)]'}`}>
                    {t.pnlPct >= 0 ? '+' : ''}{t.pnlPct}% ({t.pnl >= 0 ? '+' : ''}{formatINR(t.pnl)})
                  </span>
                </div>
              ))}
            </div>
          )}

          {perf.firstTradeDate && (
            <p className="text-[10px] text-[var(--text-dim)]">Paper trading since {perf.firstTradeDate}</p>
          )}
        </div>
      )}

      {/* ── Signal Accuracy View ── */}
      {activeView === 'tracking' && (
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wide">Signal Outcome Tracking</h3>
          <p className="text-[10px] text-[var(--text-dim)]">Tracks what happened to BUY signals after 7, 14, and 30 days.</p>

          {tracking && tracking.summary ? (
            <>
              <div className="grid grid-cols-3 gap-2">
                {['7D', '14D', '30D'].map(period => {
                  const s = tracking.summary[period] || {}
                  return (
                    <div key={period} className="px-3 py-2.5 rounded-lg bg-[var(--bg-inset)] border border-[var(--border-primary)]">
                      <div className="text-[10px] text-[var(--text-dim)] uppercase tracking-wide">{period} Outcome</div>
                      <div className="text-sm font-bold text-[var(--text-primary)] mt-1">{s.accuracy || 0}% hit rate</div>
                      <div className={`text-xs tabular-nums ${(s.avgReturn || 0) >= 0 ? 'text-emerald-400' : 'text-[var(--accent-rose)]'}`}>
                        Avg: {(s.avgReturn || 0) >= 0 ? '+' : ''}{s.avgReturn || 0}%
                      </div>
                      <div className="text-[10px] text-[var(--text-dim)] mt-0.5">{s.total || 0} signals tracked</div>
                    </div>
                  )
                })}
              </div>

              {(tracking.signals || []).length > 0 && (
                <div className="space-y-1 mt-2">
                  <h4 className="text-[10px] font-bold text-[var(--text-dim)] uppercase">Recent Signal Outcomes</h4>
                  {tracking.signals.slice(0, 20).map((s, i) => (
                    <div key={i} className="flex items-center justify-between px-3 py-1.5 rounded bg-[var(--bg-inset)] text-[11px]">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[var(--text-primary)]">{s.symbol}</span>
                        <span className="text-[var(--text-dim)]">{s.type}</span>
                        <span className={`px-1 py-0.5 rounded text-[9px] font-semibold ${
                          s.status === 'EXECUTED' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                        }`}>{s.status}</span>
                      </div>
                      <div className="flex gap-3 tabular-nums">
                        {s['7D'] != null && <span className={s['7D'] >= 0 ? 'text-emerald-400' : 'text-[var(--accent-rose)]'}>{s['7D'] >= 0 ? '+' : ''}{s['7D']}%</span>}
                        {s['14D'] != null && <span className={s['14D'] >= 0 ? 'text-emerald-400' : 'text-[var(--accent-rose)]'}>{s['14D'] >= 0 ? '+' : ''}{s['14D']}%</span>}
                        {s['30D'] != null && <span className={s['30D'] >= 0 ? 'text-emerald-400' : 'text-[var(--accent-rose)]'}>{s['30D'] >= 0 ? '+' : ''}{s['30D']}%</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="text-xs text-[var(--text-dim)] py-4">No signal tracking data yet. Signals need 7+ days to start tracking.</p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Stat Card ──
function StatCard({ label, value, pct, positive, highlight }) {
  const pctColor = pct > 0 ? 'text-emerald-400' : pct < 0 ? 'text-[var(--accent-rose)]' : 'text-[var(--text-dim)]'
  const posColor = positive === true ? 'text-emerald-400' : positive === false ? 'text-[var(--accent-rose)]' : ''
  return (
    <div className={`px-3 py-2 rounded-lg border ${highlight ? 'bg-violet-500/10 border-violet-500/30' : 'bg-[var(--bg-inset)] border-[var(--border-primary)]'}`}>
      <div className="text-[10px] text-[var(--text-dim)] uppercase tracking-wide">{label}</div>
      <div className={`text-sm font-bold tabular-nums mt-0.5 ${posColor || 'text-[var(--text-primary)]'}`}>{value}</div>
      {pct != null && <div className={`text-[10px] tabular-nums ${pctColor}`}>{pct >= 0 ? '+' : ''}{pct}%</div>}
    </div>
  )
}
