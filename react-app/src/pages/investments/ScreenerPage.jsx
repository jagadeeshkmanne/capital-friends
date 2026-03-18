import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  ScanSearch, RefreshCw, TrendingUp, TrendingDown, AlertTriangle,
  Check, X, ShieldAlert, ArrowUpCircle, ArrowDownCircle,
  Settings as SettingsIcon, Eye, Loader2, Save, Layers, Activity, Info
} from 'lucide-react'
import { AgGridReact } from 'ag-grid-react'
import { AllCommunityModule, ModuleRegistry, themeQuartz } from 'ag-grid-community'
import { formatINR } from '../../data/familyData'
import { useToast } from '../../context/ToastContext'
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

const STATUS_BADGE = {
  ELIGIBLE: 'bg-emerald-500/15 text-emerald-500',
  COOLING:  'bg-blue-500/15 text-blue-400',
  NEW:      'bg-[var(--bg-inset)] text-[var(--text-dim)]',
  EXPIRED:  'bg-red-500/15 text-red-400',
  STALE:    'bg-amber-500/15 text-amber-400',
  BOUGHT:   'bg-violet-500/15 text-violet-400',
}

const CONVICTION_BADGE = {
  COMPOUNDER: 'bg-purple-500/15 text-purple-400',
  HIGH:       'bg-emerald-500/15 text-emerald-400',
  MEDIUM:     'bg-blue-500/15 text-blue-400',
  LOW:        'bg-[var(--bg-inset)] text-[var(--text-dim)]',
}

// ── Return % colored value ──
function RetVal({ val, bold }) {
  if (val == null) return <span className="text-[var(--text-dim)]">-</span>
  const cls = val > 0 ? 'text-emerald-400' : val < 0 ? 'text-[var(--accent-rose)]' : 'text-[var(--text-dim)]'
  return <span className={`tabular-nums ${bold ? 'font-semibold' : 'font-medium'} ${cls}`}>{val > 0 ? '+' : ''}{val}%</span>
}

// ── Stat card ──
function StatCard({ label, value, sub, positive, bold }) {
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg px-3 py-2.5">
      <p className="text-[10px] text-[var(--text-dim)] uppercase tracking-wide">{label}</p>
      <p className={`text-sm tabular-nums ${bold ? 'font-bold' : 'font-semibold'} ${
        positive === true ? 'text-emerald-400' : positive === false ? 'text-[var(--accent-rose)]' : 'text-[var(--text-primary)]'
      }`}>{value}</p>
      {sub && <p className={`text-[10px] tabular-nums font-semibold ${
        positive === true ? 'text-emerald-400' : positive === false ? 'text-[var(--accent-rose)]' : 'text-[var(--text-dim)]'
      }`}>{sub}</p>}
    </div>
  )
}

// ── Tab info banner ──
function TabInfo({ children }) {
  return (
    <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-[var(--bg-inset)] border border-[var(--border-light)] text-[11px] text-[var(--text-dim)] leading-relaxed">
      <Info size={13} className="shrink-0 mt-0.5 text-violet-400" />
      <div>{children}</div>
    </div>
  )
}

export default function ScreenerPage() {
  const { showToast, showBlockUI, hideBlockUI } = useToast()
  const [subTab, setSubTab] = useState('signals')
  const [signals, setSignals] = useState(null)
  const [niftyData, setNiftyData] = useState(null)
  const [portfolioSummary, setPortfolioSummary] = useState(null)
  const [watchlist, setWatchlist] = useState(null)
  const [config, setConfig] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [configEdits, setConfigEdits] = useState({})
  const [savingConfig, setSavingConfig] = useState(false)

  useEffect(() => { loadSignals() }, [])

  useEffect(() => {
    if (subTab === 'watchlist' && watchlist === null) loadWatchlist()
    if (subTab === 'settings' && config === null) loadConfig()
  }, [subTab])

  const loadSignals = useCallback(async () => {
    try {
      const [data, nifty] = await Promise.all([
        api.getScreenerSignals('PENDING'),
        api.getScreenerNiftyData()
      ])
      setSignals(data || [])
      setNiftyData(nifty)
    } catch (err) {
      showToast(err.message || 'Failed to load signals', 'error')
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
    try {
      showBlockUI('Updating signal...')
      if (action === 'SKIPPED') {
        await api.updateScreenerSignalStatus(signal.signalId, 'SKIPPED')
      } else if (action === 'EXECUTED') {
        await api.updateScreenerSignalStatus(signal.signalId, 'EXECUTED', signal.amount / (signal.shares || 1))
        if (['BUY_STARTER', 'ADD1', 'ADD2', 'DIP_BUY'].includes(signal.type)) {
          await api.recordScreenerBuy(signal.symbol, {
            name: signal.name,
            entryPrice: signal.amount / (signal.shares || 1),
            signalType: signal.type,
            screeners: signal.triggerDetail?.match(/Screeners: ([^,]+)/)?.[1] || '',
            conviction: signal.triggerDetail?.match(/Conviction: ([^,]+)/)?.[1] || ''
          })
        }
      }
      setSignals(prev => prev.filter(s => s.signalId !== signal.signalId))
      showToast(`Signal ${action.toLowerCase()}`)
    } catch (err) {
      showToast(err.message || 'Failed to update signal', 'error')
    } finally {
      hideBlockUI()
    }
  }

  const loadWatchlist = async () => {
    try {
      const data = await api.getScreenerWatchlist()
      setWatchlist(data || [])
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
          screenerEdits[key] = configEdits[key]
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

  const filteredWatchlist = watchlist || []

  return (
    <div className="space-y-4">

      {/* ── Nifty Stat Cards ── */}
      {niftyData && niftyData.price && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <StatCard label="Nifty 50" value={`₹${Number(niftyData.price).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`} bold />
          <StatCard label="200 DMA" value={niftyData.dma200 ? `₹${Number(niftyData.dma200).toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : 'N/A'} />
          <StatCard
            label="Trend"
            value={niftyData.aboveDMA200 ? 'Above 200DMA' : 'Below 200DMA'}
            positive={niftyData.aboveDMA200 ? true : false}
          />
          <StatCard
            label="1M Return"
            value={niftyData.return1m != null ? `${niftyData.return1m > 0 ? '+' : ''}${niftyData.return1m}%` : 'N/A'}
            positive={niftyData.return1m > 0 ? true : niftyData.return1m < 0 ? false : undefined}
          />
          <StatCard
            label="Nifty 6M"
            value={niftyData.return6m != null ? `${niftyData.return6m > 0 ? '+' : ''}${niftyData.return6m}%` : 'N/A'}
            positive={niftyData.return6m > 0 ? true : niftyData.return6m < 0 ? false : undefined}
          />
          <StatCard
            label="Midcap150 6M"
            value={niftyData.midcapReturn6m != null ? `${niftyData.midcapReturn6m > 0 ? '+' : ''}${niftyData.midcapReturn6m}%` : 'N/A'}
            positive={niftyData.midcapReturn6m > 0 ? true : niftyData.midcapReturn6m < 0 ? false : undefined}
          />
          <StatCard
            label="Smallcap250 6M"
            value={niftyData.smallcapReturn6m != null ? `${niftyData.smallcapReturn6m > 0 ? '+' : ''}${niftyData.smallcapReturn6m}%` : 'N/A'}
            positive={niftyData.smallcapReturn6m > 0 ? true : niftyData.smallcapReturn6m < 0 ? false : undefined}
          />
        </div>
      )}

      {/* ── Portfolio Summary (shown after generate) ── */}
      {portfolioSummary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Invested" value={formatINR(portfolioSummary.totalInvested)} />
          <StatCard label="Cash Available" value={formatINR(portfolioSummary.cashAvailable)} />
          <StatCard label="Budget" value={formatINR(portfolioSummary.budget)} />
          <StatCard label="Stocks" value={`${portfolioSummary.holdingCount} / ${portfolioSummary.maxStocks}`} bold />
        </div>
      )}

      {/* ── Sub-tabs + Generate button ── */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1 bg-[var(--bg-inset)] rounded-lg p-0.5 shrink-0">
          {[
            { key: 'signals', icon: Activity, label: 'Signals' },
            { key: 'watchlist', icon: Eye, label: 'Watchlist' },
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

        <div className="flex items-center gap-1.5 ml-auto shrink-0">
          <button
            onClick={handleGenerate}
            disabled={generating}
            className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-lg transition-colors shadow-sm ${
              generating ? 'bg-violet-600/40 text-white/50 cursor-not-allowed' : 'text-white bg-violet-600 hover:bg-violet-500'
            }`}
          >
            {generating ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            {generating ? 'Generating...' : 'Generate Signals'}
          </button>
        </div>
      </div>

      {/* ===== SIGNALS TAB ===== */}
      {subTab === 'signals' && (
        <div className="space-y-3">
          <TabInfo>
            <strong>Signals</strong> are auto-generated BUY/SELL/ADD actions based on your holdings + the master watchlist.
            Click <strong>"Generate Signals"</strong> to scan. Execute or skip each signal. Executed buys are tracked in your Screener_StockMeta for trailing stops.
          </TabInfo>

          {generating && (
            <div className="flex items-center gap-2 text-xs text-[var(--text-dim)] px-1">
              <Loader2 size={12} className="animate-spin" />
              Reading watchlist + holdings, generating signals... (10-30s)
            </div>
          )}

          {signals === null ? (
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
                <p className="text-xs text-amber-400 mt-1">Nifty is below 200DMA — BUY signals blocked in downtrend</p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {signals.map(signal => {
                const style = SIGNAL_STYLES[signal.type] || SIGNAL_STYLES.BUY_STARTER
                const IconComp = style.icon
                const isBuy = ['BUY_STARTER', 'ADD1', 'ADD2', 'DIP_BUY'].includes(signal.type)
                const isSell = ['TRAILING_STOP', 'HARD_EXIT'].includes(signal.type)
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
                        <span className="text-sm font-bold text-[var(--text-primary)]">{signal.symbol}</span>
                        <span className="text-xs text-[var(--text-dim)] hidden sm:inline">{signal.name}</span>
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
                        {isBuy && (
                          <button
                            onClick={() => handleSignalAction(signal, 'EXECUTED')}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-md text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition-colors"
                          >
                            <TrendingUp size={11} /> Buy
                          </button>
                        )}
                        {isSell && (
                          <button
                            onClick={() => handleSignalAction(signal, 'EXECUTED')}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-md text-[11px] font-bold text-white bg-rose-600 hover:bg-rose-500 transition-colors"
                          >
                            <TrendingDown size={11} /> Sell
                          </button>
                        )}
                        <button
                          onClick={() => handleSignalAction(signal, 'SKIPPED')}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-[var(--bg-inset)] hover:bg-[var(--bg-hover)] transition-colors"
                        >
                          <X size={11} /> Skip
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ===== WATCHLIST TAB ===== */}
      {subTab === 'watchlist' && (
        <div className="space-y-3">
          <TabInfo>
            <strong>Watchlist</strong> shows all stocks discovered by the 4 Trendlyne screeners. Stocks go through NEW → COOLING → ELIGIBLE stages.
            <strong>Since %</strong> = price change since the stock was first found. Returns (1W/1M/6M/1Y) update daily. Only ELIGIBLE stocks with all buy conditions met generate BUY signals.
          </TabInfo>

          {watchlist === null ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={20} className="animate-spin text-[var(--text-dim)]" />
              <span className="ml-2 text-sm text-[var(--text-dim)]">Loading watchlist...</span>
            </div>
          ) : filteredWatchlist.length === 0 ? (
            <div className="text-center py-12 text-sm text-[var(--text-dim)]">No stocks found</div>
          ) : (
            <>
              {/* Desktop AG Grid */}
              <div className="hidden sm:block rounded-xl border border-[var(--border)] overflow-hidden" style={{ height: Math.min(filteredWatchlist.length * 42 + 49, 600) }}>
                <AgGridReact
                  theme={screenerGridTheme}
                  rowData={filteredWatchlist}
                  columnDefs={watchlistColDefs}
                  defaultColDef={defaultColDef}
                  rowHeight={42}
                  headerHeight={38}
                  animateRows={false}
                  suppressCellFocus={true}
                  domLayout={filteredWatchlist.length <= 12 ? 'autoHeight' : undefined}
                />
              </div>

              {/* Mobile cards */}
              <div className="sm:hidden space-y-2">
                {filteredWatchlist.map(stock => (
                  <div key={stock.symbol} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-3">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        {stock.allBuyMet === 'YES' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                        <span className="font-bold text-sm text-[var(--text-primary)]">{stock.symbol}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${CONVICTION_BADGE[stock.conviction] || CONVICTION_BADGE.LOW}`}>
                          {stock.conviction || '-'}
                        </span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_BADGE[stock.status] || STATUS_BADGE.NEW}`}>
                        {stock.status}
                      </span>
                    </div>
                    <div className="text-[11px] text-[var(--text-dim)] mb-2 truncate">{stock.name}</div>

                    {/* Price row */}
                    <div className="flex items-center justify-between mb-1.5 text-[11px]">
                      <div>
                        <span className="text-[var(--text-dim)]">Found </span>
                        <span className="text-[var(--text-secondary)] tabular-nums font-medium">{stock.foundPrice ? formatINR(stock.foundPrice) : '-'}</span>
                      </div>
                      <div>
                        <span className="text-[var(--text-dim)]">CMP </span>
                        <span className="text-[var(--text-primary)] tabular-nums font-semibold">{stock.currentPrice ? formatINR(stock.currentPrice) : '-'}</span>
                      </div>
                      <div><RetVal val={stock.priceChangePct ? parseFloat(stock.priceChangePct.toFixed(1)) : null} bold /></div>
                    </div>

                    {/* Returns row */}
                    <div className="grid grid-cols-4 gap-x-3 gap-y-1 text-[10px]">
                      <div><span className="text-[var(--text-dim)]">1W</span> <RetVal val={stock.return1w} /></div>
                      <div><span className="text-[var(--text-dim)]">1M</span> <RetVal val={stock.return1m} /></div>
                      <div><span className="text-[var(--text-dim)]">6M</span> <RetVal val={stock.return6m} /></div>
                      <div><span className="text-[var(--text-dim)]">1Y</span> <RetVal val={stock.return1y} /></div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ===== SETTINGS TAB ===== */}
      {subTab === 'settings' && (
        <div className="space-y-4">
          <TabInfo>
            <strong>Settings</strong> control your personal screener thresholds. These override the master defaults.
            Adjust buy conditions, trailing stop tiers, and alert preferences. Toggle <strong>Paper Trading</strong> off when you're ready to go live.
          </TabInfo>

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
                        <div key={key} className="flex items-center justify-between px-4 py-3">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-[var(--text-primary)]">{label}</div>
                            <div className="text-[11px] text-[var(--text-dim)]">{description}</div>
                          </div>
                          <div className="ml-4 w-28 flex justify-end">
                            {type === 'boolean' ? (
                              <button
                                onClick={() => setConfigEdits(prev => ({
                                  ...prev,
                                  [key]: currentValue === true || currentValue === 'TRUE' ? false : true
                                }))}
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
                                type="number"
                                value={currentValue ?? ''}
                                onChange={(e) => setConfigEdits(prev => ({
                                  ...prev,
                                  [key]: parseFloat(e.target.value) || 0
                                }))}
                                className="w-full px-2 py-1 text-sm text-right rounded border border-[var(--border)] bg-[var(--bg-base)] text-[var(--text-primary)] focus:border-violet-500 focus:outline-none"
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
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── AG Grid theme + column defs for watchlist ──
const screenerGridTheme = themeQuartz.withParams({
  backgroundColor: 'var(--bg-card)',
  foregroundColor: 'var(--text-primary)',
  headerBackgroundColor: 'var(--bg-inset)',
  headerFontSize: 11,
  headerFontWeight: 600,
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

const ReturnCellRenderer = ({ value }) => {
  if (value == null) return <span style={{ color: 'var(--text-dim)' }}>-</span>
  const color = value > 0 ? '#34d399' : value < 0 ? 'var(--accent-rose)' : 'var(--text-dim)'
  return <span style={{ color, fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>{value > 0 ? '+' : ''}{value}%</span>
}

const StockCellRenderer = ({ data }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 6, lineHeight: 1.3 }}>
    {data.allBuyMet === 'YES' && <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#34d399', flexShrink: 0 }} />}
    <div>
      <div style={{ fontWeight: 600, fontSize: 12 }}>{data.symbol}</div>
      <div style={{ fontSize: 10, color: 'var(--text-dim)', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{data.name}</div>
    </div>
  </div>
)

const StatusCellRenderer = ({ value }) => {
  const colors = { ELIGIBLE: '#34d399', COOLING: '#60a5fa', NEW: 'var(--text-dim)', EXPIRED: '#f87171', STALE: '#fbbf24', BOUGHT: '#a78bfa' }
  const bgs = { ELIGIBLE: 'rgba(52,211,153,0.15)', COOLING: 'rgba(96,165,250,0.15)', NEW: 'var(--bg-inset)', EXPIRED: 'rgba(248,113,113,0.15)', STALE: 'rgba(251,191,36,0.15)', BOUGHT: 'rgba(167,139,250,0.15)' }
  return <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 600, color: colors[value] || colors.NEW, background: bgs[value] || bgs.NEW }}>{value}</span>
}

const ConvictionCellRenderer = ({ value }) => {
  const colors = { COMPOUNDER: '#c084fc', HIGH: '#6ee7b7', MEDIUM: '#93c5fd', LOW: 'var(--text-dim)' }
  const bgs = { COMPOUNDER: 'rgba(192,132,252,0.15)', HIGH: 'rgba(110,231,183,0.15)', MEDIUM: 'rgba(147,197,253,0.15)', LOW: 'var(--bg-inset)' }
  return <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 9, fontWeight: 600, color: colors[value] || colors.LOW, background: bgs[value] || bgs.LOW }}>{value || '-'}</span>
}

const PriceCellRenderer = ({ data }) => (
  <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
    <div style={{ fontWeight: 500 }}>{data.currentPrice ? formatINR(data.currentPrice) : '-'}</div>
    <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Found {data.foundPrice ? formatINR(data.foundPrice) : '-'}</div>
  </div>
)

const returnValueGetter = (field) => (params) => {
  const v = params.data[field]
  return v != null ? parseFloat(Number(v).toFixed(1)) : null
}

const watchlistColDefs = [
  { field: 'symbol', headerName: 'Stock', cellRenderer: StockCellRenderer, minWidth: 160, flex: 2, filter: 'agTextColumnFilter' },
  { field: 'conviction', headerName: 'Conviction', cellRenderer: ConvictionCellRenderer, width: 100, filter: 'agTextColumnFilter' },
  { field: 'status', headerName: 'Status', cellRenderer: StatusCellRenderer, width: 100, filter: 'agTextColumnFilter' },
  { field: 'currentPrice', headerName: 'CMP', cellRenderer: PriceCellRenderer, width: 120, type: 'numericColumn', filter: 'agNumberColumnFilter' },
  { field: 'priceChangePct', headerName: 'Since Found', cellRenderer: ReturnCellRenderer, valueGetter: returnValueGetter('priceChangePct'), width: 100, type: 'numericColumn', filter: 'agNumberColumnFilter' },
  { field: 'return1w', headerName: '1W', cellRenderer: ReturnCellRenderer, valueGetter: returnValueGetter('return1w'), width: 80, type: 'numericColumn', filter: 'agNumberColumnFilter' },
  { field: 'return1m', headerName: '1M', cellRenderer: ReturnCellRenderer, valueGetter: returnValueGetter('return1m'), width: 80, type: 'numericColumn', filter: 'agNumberColumnFilter' },
  { field: 'return6m', headerName: '6M', cellRenderer: ReturnCellRenderer, valueGetter: returnValueGetter('return6m'), width: 80, type: 'numericColumn', filter: 'agNumberColumnFilter' },
  { field: 'return1y', headerName: '1Y', cellRenderer: ReturnCellRenderer, valueGetter: returnValueGetter('return1y'), width: 80, type: 'numericColumn', filter: 'agNumberColumnFilter' },
]

const defaultColDef = {
  sortable: true,
  resizable: true,
  suppressMovable: true,
  filter: true,
  floatingFilter: true,
}

// ── Settings grouped into sections ──
const SETTINGS_SECTIONS = [
  {
    title: 'Portfolio Limits',
    fields: [
      { key: 'STOCK_BUDGET', label: 'Total Stock Budget (₹)', description: 'How much money you want to allocate to stocks overall', type: 'number' },
      { key: 'MAX_STOCKS', label: 'Max Stocks', description: 'Maximum number of different stocks you can hold at once', type: 'number' },
      { key: 'MAX_PER_SECTOR', label: 'Max Per Sector', description: 'Maximum stocks allowed in the same sector (e.g. 2 IT stocks max)', type: 'number' },
      { key: 'PAPER_TRADING', label: 'Paper Trading', description: 'When ON, signals are generated but no real trades — use this to test the system first', type: 'boolean' },
    ]
  },
  {
    title: 'When to Buy',
    description: 'Controls when the screener generates a new BUY signal for stocks on the watchlist',
    fields: [
      { key: 'RSI_BUY_MAX', label: 'Max RSI to Buy', description: 'Only buy when RSI is below this (lower RSI = stock is cheaper/oversold)', type: 'number' },
      { key: 'NIFTY_BELOW_200DMA_ALLOCATION', label: 'Allocation in Downtrend (%)', description: 'When Nifty is below 200DMA (bearish market), buy only this % of normal amount', type: 'number' },
    ]
  },
  {
    title: 'Adding to Winners',
    description: 'When a stock you already own goes up, add more shares to ride the momentum (pyramid up)',
    fields: [
      { key: 'ADD1_GAIN_PCT', label: 'First Add at Gain %', description: 'Stock is up this much from your entry → add more shares (e.g. 12% = stock working well)', type: 'number' },
      { key: 'ADD2_GAIN_PCT', label: 'Second Add at Gain %', description: 'Stock is up even more → add final batch (e.g. 30% = strong winner, go bigger)', type: 'number' },
    ]
  },
  {
    title: 'Sell / Stop Loss',
    description: 'Auto-generates SELL signals when stocks drop from their peak — locks in profits and limits losses',
    fields: [
      { key: 'HARD_STOP_LOSS', label: 'Hard Stop Loss %', description: 'Sell immediately if stock drops this much from your buy price (maximum loss limit)', type: 'number' },
      { key: 'TRAILING_STOP_0_20', label: 'Trailing Stop: 0-20% Gain', description: 'If stock is up 0-20%, sell if it drops this % from its peak', type: 'number' },
      { key: 'TRAILING_STOP_20_50', label: 'Trailing Stop: 20-50% Gain', description: 'If stock is up 20-50%, sell if it drops this % from peak (tighter = lock more profit)', type: 'number' },
      { key: 'TRAILING_STOP_50_100', label: 'Trailing Stop: 50-100% Gain', description: 'If stock doubled, sell if it drops this % from peak', type: 'number' },
      { key: 'TRAILING_STOP_100_PLUS', label: 'Trailing Stop: 100%+ Gain', description: 'If stock is up 100%+, sell if it drops this % from peak (tightest = protect big gains)', type: 'number' },
    ]
  },
  {
    title: 'Alerts & Safety',
    fields: [
      { key: 'SECTOR_ALERT_PCT', label: 'Sector Concentration Alert %', description: 'Warn if one sector exceeds this % of your total stock portfolio', type: 'number' },
      { key: 'PORTFOLIO_FREEZE_PCT', label: 'Portfolio Freeze %', description: 'Stop all new buys if your overall portfolio drops this % (market crash protection)', type: 'number' },
      { key: 'ScreenerEmailEnabled', label: 'Daily Email Alerts', description: 'Get an email at 10 AM when new signals are generated', type: 'boolean', isAppSetting: true },
      { key: 'ScreenerEmailHour', label: 'Email Hour (0-23)', description: 'What hour to send the daily screener email (IST, 24h format)', type: 'number', isAppSetting: true },
    ]
  },
]

// Flatten for save logic
const CONFIG_FIELDS = SETTINGS_SECTIONS.flatMap(s => s.fields)
