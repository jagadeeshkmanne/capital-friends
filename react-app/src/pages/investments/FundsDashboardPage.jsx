import { useMemo, useState, useEffect, Fragment } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Layers, Search, ChevronDown, ChevronRight, ArrowUp, ArrowDown, ArrowUpDown,
  Eye, EyeOff, Wallet, Info, X,
} from 'lucide-react'
import { useData } from '../../context/DataContext'
import { useFamily } from '../../context/FamilyContext'
import { useMask } from '../../context/MaskContext'
import { formatINR, splitFundName } from '../../data/familyData'
import { yearsBetween } from '../../utils/mfMetrics'
import { CATEGORY_COLORS } from '../../utils/fundCategory'
import { buildFundsModel, resolvePortfolioOwners } from '../../utils/fundsDashboard'

const HIDE_KEY = 'cf_funds_hide_amounts'
const MEMBER_COLORS = ['#8b5cf6', '#06b6d4', '#f59e0b', '#10b981', '#ec4899', '#3b82f6', '#f97316', '#14b8a6']

function pct(v, digits = 1) {
  if (v == null || !Number.isFinite(v)) return '—'
  return `${v >= 0 ? '+' : ''}${v.toFixed(digits)}%`
}
function ratePct(v) {
  if (v == null || !Number.isFinite(v)) return '—'
  return `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`
}
const INCOMPLETE_HINT = 'Not enough transaction history for this fund. Record the earlier purchases to get XIRR and CAGR.'
function plClass(v) {
  if (v == null || !Number.isFinite(v)) return 'text-[var(--text-dim)]'
  return v >= 0 ? 'text-emerald-400' : 'text-[var(--accent-rose)]'
}
function monthYear(d) {
  if (!d) return '—'
  return d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
}
function holdingSince(d) {
  if (!d) return '—'
  const y = yearsBetween(d)
  if (y < 1) return `${Math.max(1, Math.round(y * 12))}m`
  return `${y.toFixed(1)}y`
}
function athBadgeClass(p) {
  if (p >= 20) return 'bg-rose-500/15 text-[var(--accent-rose)]'
  if (p >= 10) return 'bg-orange-500/15 text-[var(--accent-orange)]'
  if (p >= 5) return 'bg-amber-500/15 text-[var(--accent-amber)]'
  if (p >= 1) return 'bg-yellow-500/10 text-yellow-500'
  return 'bg-emerald-500/10 text-emerald-400'
}

const COLUMNS = [
  { key: 'fundName', label: 'Fund', align: 'left' },
  { key: 'units', label: 'Units', align: 'right' },
  { key: 'currentNav', label: 'NAV', sub: 'Current / Avg', align: 'right' },
  { key: 'invested', label: 'Invested', align: 'right' },
  { key: 'currentValue', label: 'Current', align: 'right' },
  { key: 'pl', label: 'P&L', sub: 'Absolute', align: 'right' },
  { key: 'xirr', label: 'XIRR', sub: 'Annualised', align: 'right' },
  { key: 'cagr', label: 'CAGR', sub: 'Since first buy', align: 'right' },
  { key: 'weight', label: 'Weight', align: 'right' },
  { key: 'belowATHPct', label: 'Below ATH', align: 'right' },
]

export default function FundsDashboardPage() {
  const navigate = useNavigate()
  const { selectedMember, familyMembers } = useFamily()
  const { mfPortfolios, mfHoldings, mfTransactions, activeMembers, activeInvestmentAccounts } = useData()
  const { mv } = useMask()

  const [portfolioFilter, setPortfolioFilter] = useState('all')
  const [category, setCategory] = useState('all')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState({ key: 'currentValue', dir: 'desc' })
  const [expanded, setExpanded] = useState(() => new Set())
  const [portfolioMenuOpen, setPortfolioMenuOpen] = useState(false)
  const [hideAmounts, setHideAmounts] = useState(() => {
    try { return localStorage.getItem(HIDE_KEY) === 'true' } catch { return false }
  })
  useEffect(() => {
    try { localStorage.setItem(HIDE_KEY, String(hideAmounts)) } catch {}
  }, [hideAmounts])

  const amt = (v) => (hideAmounts ? '₹ ••••' : formatINR(v || 0))

  // Resolve owner for each active portfolio (same logic as the Mutual Funds page)
  const enrichedPortfolios = useMemo(
    () => resolvePortfolioOwners(mfPortfolios, activeInvestmentAccounts, activeMembers),
    [mfPortfolios, activeInvestmentAccounts, activeMembers],
  )

  // Member filter comes from the global header selector
  const memberPortfolios = useMemo(
    () => (selectedMember === 'all' ? enrichedPortfolios : enrichedPortfolios.filter((p) => p.ownerId === selectedMember)),
    [enrichedPortfolios, selectedMember],
  )

  // Reset the portfolio filter when the member changes and the selection is no longer valid
  useEffect(() => {
    if (portfolioFilter !== 'all' && !memberPortfolios.some((p) => p.portfolioId === portfolioFilter)) setPortfolioFilter('all')
  }, [memberPortfolios, portfolioFilter])

  const scopedPortfolios = useMemo(
    () => (portfolioFilter === 'all' ? memberPortfolios : memberPortfolios.filter((p) => p.portfolioId === portfolioFilter)),
    [memberPortfolios, portfolioFilter],
  )

  // One row per fund, consolidated across the selected portfolios
  const model = useMemo(
    () => buildFundsModel({ portfolios: scopedPortfolios, holdings: mfHoldings, transactions: mfTransactions }),
    [scopedPortfolios, mfHoldings, mfTransactions],
  )

  const categoryOptions = useMemo(() => model.categories.map((c) => c.name), [model.categories])
  useEffect(() => {
    if (category !== 'all' && !categoryOptions.includes(category)) setCategory('all')
  }, [categoryOptions, category])

  // ── Filter + sort ──
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = model.funds
    if (category !== 'all') list = list.filter((f) => f.category === category)
    if (q) list = list.filter((f) => f.fundName.toLowerCase().includes(q) || f.members.some((m) => m.toLowerCase().includes(q)))
    const dir = sort.dir === 'asc' ? 1 : -1
    return [...list].sort((a, b) => {
      const av = a[sort.key]
      const bv = b[sort.key]
      if (sort.key === 'fundName') return dir * String(av).localeCompare(String(bv))
      const an = av == null || !Number.isFinite(av) ? -Infinity : av
      const bn = bv == null || !Number.isFinite(bv) ? -Infinity : bv
      return dir * (an - bn)
    })
  }, [model.funds, category, search, sort])

  function toggleSort(key) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: key === 'fundName' ? 'asc' : 'desc' }))
  }
  function toggleExpand(key) {
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const memberLabel = selectedMember === 'all'
    ? 'Everyone'
    : (familyMembers.find((m) => m.memberId === selectedMember)?.memberName || 'Member')
  const selectedPortfolio = memberPortfolios.find((p) => p.portfolioId === portfolioFilter)

  if (!enrichedPortfolios.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
        <Wallet size={32} className="text-[var(--text-dim)]" />
        <p className="text-sm text-[var(--text-muted)]">No mutual fund portfolios yet</p>
        <button onClick={() => navigate('/investments/mutual-funds')} className="text-xs font-semibold text-violet-400 hover:text-violet-300">
          Go to Mutual Funds
        </button>
      </div>
    )
  }

  const t = model.totals

  return (
    <div className="space-y-4 min-w-0 max-w-full">
      {/* ── Title row ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-violet-500/15 flex items-center justify-center"><Layers size={18} className="text-violet-400" /></div>
          <div>
            <h1 className="text-base font-bold text-[var(--text-primary)] leading-tight">All Funds</h1>
            <p className="text-xs text-[var(--text-dim)]">
              {mv(memberLabel, 'name')} · {scopedPortfolios.length} portfolio{scopedPortfolios.length === 1 ? '' : 's'} · {t.fundCount} fund{t.fundCount === 1 ? '' : 's'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Portfolio filter */}
          <div className="relative">
            <button onClick={() => setPortfolioMenuOpen((o) => !o)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-[var(--bg-card)] border border-[var(--border)] rounded-lg transition-colors max-w-[220px]">
              <span className="truncate">{selectedPortfolio ? selectedPortfolio.portfolioName : 'All Portfolios'}</span>
              <ChevronDown size={13} className="shrink-0" />
            </button>
            {portfolioMenuOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setPortfolioMenuOpen(false)} />
                <div className="absolute right-0 mt-1 w-64 max-h-72 overflow-y-auto bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-xl z-40 py-1">
                  <button onClick={() => { setPortfolioFilter('all'); setPortfolioMenuOpen(false) }}
                    className={`w-full text-left px-3 py-2 text-sm ${portfolioFilter === 'all' ? 'text-violet-400 bg-violet-500/10' : 'text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'}`}>
                    All Portfolios
                  </button>
                  {memberPortfolios.map((p) => (
                    <button key={p.portfolioId} onClick={() => { setPortfolioFilter(p.portfolioId); setPortfolioMenuOpen(false) }}
                      className={`w-full text-left px-3 py-2 ${portfolioFilter === p.portfolioId ? 'bg-violet-500/10' : 'hover:bg-[var(--bg-hover)]'}`}>
                      <p className={`text-sm truncate ${portfolioFilter === p.portfolioId ? 'text-violet-400' : 'text-[var(--text-primary)]'}`}>{p.portfolioName}</p>
                      <p className="text-xs text-[var(--text-dim)] truncate">{mv(p.ownerName, 'name')}</p>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <button onClick={() => setHideAmounts((v) => !v)} title={hideAmounts ? 'Show amounts' : 'Hide amounts (percent-only view)'}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium border rounded-lg transition-colors ${hideAmounts ? 'text-amber-400 bg-amber-500/10 border-amber-500/30' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-[var(--bg-card)] border-[var(--border)]'}`}>
            {hideAmounts ? <EyeOff size={13} /> : <Eye size={13} />}
            <span className="hidden sm:inline">{hideAmounts ? 'Amounts hidden' : 'Hide amounts'}</span>
          </button>
        </div>
      </div>

      {/* ── Summary (Zerodha-style) ── */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 sm:p-5">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-6 gap-y-4">
          <div>
            <p className="text-xs text-[var(--text-dim)] uppercase tracking-wider mb-1">Invested</p>
            <p className="text-base font-semibold text-[var(--text-muted)] tabular-nums">{amt(t.invested)}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--text-dim)] uppercase tracking-wider mb-1">Current</p>
            <p className="text-base font-bold text-[var(--text-primary)] tabular-nums">{amt(t.currentValue)}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--text-dim)] uppercase tracking-wider mb-1">P&L</p>
            <p className={`text-base font-bold tabular-nums ${plClass(t.pl)}`}>
              {hideAmounts ? '' : `${t.pl >= 0 ? '+' : ''}${formatINR(t.pl)} `}
              <span className={`text-sm font-semibold ${hideAmounts ? '' : 'opacity-80'}`}>{pct(t.plPct)}</span>
            </p>
          </div>
          <div>
            <p className="text-xs text-[var(--text-dim)] uppercase tracking-wider mb-1">XIRR</p>
            <p className={`text-base font-bold tabular-nums ${plClass(t.xirr)}`} title={t.historyComplete ? undefined : INCOMPLETE_HINT}>{ratePct(t.xirr)}</p>
            {t.incompleteCount > 0 && <p className="text-xs text-amber-500/80">{t.incompleteCount} fund{t.incompleteCount === 1 ? '' : 's'} missing history</p>}
          </div>
          <div>
            <p className="text-xs text-[var(--text-dim)] uppercase tracking-wider mb-1">CAGR</p>
            <p className={`text-base font-semibold tabular-nums ${plClass(t.cagr)}`} title={t.historyComplete ? undefined : INCOMPLETE_HINT}>{ratePct(t.cagr)}</p>
            <p className="text-xs text-[var(--text-dim)]">since {monthYear(t.since)}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--text-dim)] uppercase tracking-wider mb-1">Below ATH</p>
            <p className="text-base font-semibold tabular-nums text-[var(--text-primary)]">{t.weightedBelowATH.toFixed(1)}%</p>
            <p className="text-xs text-[var(--text-dim)]">{t.buyOppCount > 0 ? `${t.buyOppCount} buy opportunit${t.buyOppCount === 1 ? 'y' : 'ies'}` : 'weighted average'}</p>
          </div>
        </div>

        {/* Allocation bars */}
        {(model.categories.length > 0 || model.members.length > 1) && (
          <div className={`grid grid-cols-1 ${model.members.length > 1 ? 'lg:grid-cols-2' : ''} gap-5 mt-5 pt-4 border-t border-[var(--border-light)]`}>
            <AllocationBar title="By category" items={model.categories} colorFor={(name) => CATEGORY_COLORS[name] || CATEGORY_COLORS.Other} amt={amt} mv={mv} />
            {model.members.length > 1 && (
              <AllocationBar title="By member" items={model.members} colorFor={(_, i) => MEMBER_COLORS[i % MEMBER_COLORS.length]} amt={amt} mv={mv} maskNames />
            )}
          </div>
        )}
      </div>

      {/* ── Filters ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search fund"
            className="w-full pl-8 pr-7 py-1.5 text-sm bg-[var(--bg-card)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-violet-500/50" />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-dim)] hover:text-[var(--text-primary)]"><X size={13} /></button>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <Chip active={category === 'all'} onClick={() => setCategory('all')} label={`All (${model.funds.length})`} />
          {model.categories.map((c) => (
            <Chip key={c.name} active={category === c.name} onClick={() => setCategory(c.name)}
              label={`${c.name} (${model.funds.filter((f) => f.category === c.name).length})`} color={CATEGORY_COLORS[c.name]} />
          ))}
        </div>
      </div>

      {/* ── Desktop table ── */}
      <div className="hidden lg:block rounded-xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-light)] bg-[var(--bg-inset)]">
                <th className="w-8"></th>
                {COLUMNS.map((c) => (
                  <th key={c.key} onClick={() => toggleSort(c.key)}
                    className={`py-2.5 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider select-none cursor-pointer hover:text-[var(--text-primary)] ${c.align === 'left' ? 'text-left' : 'text-right'}`}>
                    <div className={`flex items-center gap-1 ${c.align === 'left' ? '' : 'justify-end'}`}>
                      <span>{c.label}</span>
                      <SortIcon active={sort.key === c.key} dir={sort.dir} />
                    </div>
                    {c.sub && <div className="text-xs font-medium normal-case tracking-normal text-[var(--text-dim)]">{c.sub}</div>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((f) => {
                const { main, plan } = splitFundName(f.fundName)
                const isOpen = expanded.has(f.key)
                return (
                  <Fragment key={f.key}>
                    <tr onClick={() => toggleExpand(f.key)}
                      className={`border-b border-[var(--border-light)] cursor-pointer transition-colors ${isOpen ? 'bg-[var(--bg-hover)]' : 'hover:bg-[var(--bg-hover)]'}`}>
                      <td className="pl-3 text-[var(--text-dim)]">{isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</td>
                      <td className="py-2.5 px-3 max-w-[280px]">
                        <p className="text-[var(--text-primary)] font-medium leading-snug truncate" title={f.fundName}>{main}</p>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase" style={{ background: `${CATEGORY_COLORS[f.category] || CATEGORY_COLORS.Other}20`, color: CATEGORY_COLORS[f.category] || CATEGORY_COLORS.Other }}>{f.category}</span>
                          {plan && <span className="text-xs text-[var(--text-dim)] truncate">{plan}</span>}
                          {f.positions.length > 1 && <span className="text-[10px] font-semibold text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded">{f.positions.length} portfolios</span>}
                          {f.isBuyOpp && (
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${f.isStrongBuy ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/15 text-blue-400'}`}>{f.isStrongBuy ? 'Strong Buy' : 'Buy'}</span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-[var(--text-muted)]">{f.units.toFixed(3)}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums">
                        <div className="text-[var(--text-primary)]">₹{f.currentNav.toFixed(2)}</div>
                        <div className="text-xs text-[var(--text-dim)]">₹{f.avgNav.toFixed(2)}</div>
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-[var(--text-muted)]">{amt(f.invested)}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums font-semibold text-[var(--text-primary)]">{amt(f.currentValue)}</td>
                      <td className={`py-2.5 px-3 text-right tabular-nums ${plClass(f.pl)}`}>
                        {!hideAmounts && <div className="font-semibold">{f.pl >= 0 ? '+' : ''}{formatINR(f.pl)}</div>}
                        <div className={hideAmounts ? 'font-semibold' : 'text-xs opacity-80'}>{pct(f.plPct)}</div>
                      </td>
                      <td className={`py-2.5 px-3 text-right tabular-nums font-semibold ${plClass(f.xirr)}`} title={f.historyComplete ? undefined : INCOMPLETE_HINT}>{ratePct(f.xirr)}</td>
                      <td className={`py-2.5 px-3 text-right tabular-nums ${plClass(f.cagr)}`} title={f.historyComplete ? undefined : INCOMPLETE_HINT}>
                        <div>{ratePct(f.cagr)}</div>
                        <div className="text-xs text-[var(--text-dim)]">{f.historyComplete ? holdingSince(f.since) : 'no history'}</div>
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-14 h-1.5 rounded-full bg-[var(--bg-inset)] overflow-hidden"><div className="h-full rounded-full bg-violet-500/70" style={{ width: `${Math.min(100, f.weight)}%` }} /></div>
                          <span className="text-[var(--text-primary)] w-12">{f.weight.toFixed(1)}%</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {f.athNav > 0
                          ? <span className={`inline-block text-xs font-semibold px-1.5 py-0.5 rounded-full tabular-nums ${athBadgeClass(f.belowATHPct)}`}>{f.belowATHPct <= 0 ? 'At ATH' : `−${f.belowATHPct.toFixed(1)}%`}</span>
                          : <span className="text-xs text-[var(--text-dim)]">—</span>}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="border-b border-[var(--border-light)] bg-[var(--bg-inset)]/60">
                        <td></td>
                        <td colSpan={COLUMNS.length} className="px-3 py-3">
                          <PositionsTable fund={f} amt={amt} mv={mv} hideAmounts={hideAmounts} onOpen={() => navigate('/investments/mutual-funds')} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
              {rows.length === 0 && (
                <tr><td colSpan={COLUMNS.length + 1} className="py-10 text-center text-sm text-[var(--text-dim)]">No funds match this filter.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Mobile cards ── */}
      <div className="lg:hidden space-y-2 min-w-0">
        {rows.map((f) => {
          const { main, plan } = splitFundName(f.fundName)
          const isOpen = expanded.has(f.key)
          return (
            <div key={f.key} className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden min-w-0">
              <button onClick={() => toggleExpand(f.key)} className="w-full text-left px-3 py-3 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--text-primary)] leading-snug">{main}</p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase" style={{ background: `${CATEGORY_COLORS[f.category] || CATEGORY_COLORS.Other}20`, color: CATEGORY_COLORS[f.category] || CATEGORY_COLORS.Other }}>{f.category}</span>
                      {plan && <span className="text-xs text-[var(--text-dim)] truncate">{plan}</span>}
                      {f.isBuyOpp && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${f.isStrongBuy ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/15 text-blue-400'}`}>{f.isStrongBuy ? 'Strong Buy' : 'Buy'}</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-[var(--text-primary)] tabular-nums">{amt(f.currentValue)}</p>
                    <p className={`text-xs font-semibold tabular-nums ${plClass(f.pl)}`}>{hideAmounts ? '' : `${f.pl >= 0 ? '+' : ''}${formatINR(f.pl)} · `}{pct(f.plPct)}</p>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2 mt-2.5 text-center">
                  <Mini label="XIRR" value={ratePct(f.xirr)} cls={plClass(f.xirr)} />
                  <Mini label="CAGR" value={ratePct(f.cagr)} cls={plClass(f.cagr)} sub={f.historyComplete ? holdingSince(f.since) : 'no history'} />
                  <Mini label="Weight" value={`${f.weight.toFixed(1)}%`} />
                  <Mini label="Below ATH" value={f.athNav > 0 ? (f.belowATHPct <= 0 ? 'At ATH' : `−${f.belowATHPct.toFixed(1)}%`) : '—'} cls={f.athNav > 0 ? athBadgeClass(f.belowATHPct).split(' ').pop() : ''} />
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-2 text-xs text-[var(--text-dim)] tabular-nums">
                  <span>{f.units.toFixed(3)} units</span>
                  <span>NAV ₹{f.currentNav.toFixed(2)} · Avg ₹{f.avgNav.toFixed(2)}</span>
                  <span>Inv {amt(f.invested)}</span>
                </div>
              </button>
              {isOpen && (
                <div className="border-t border-[var(--border-light)] bg-[var(--bg-inset)]/60 px-3 py-3">
                  <PositionsTable fund={f} amt={amt} mv={mv} hideAmounts={hideAmounts} onOpen={() => navigate('/investments/mutual-funds')} compact />
                </div>
              )}
            </div>
          )
        })}
        {rows.length === 0 && <p className="py-10 text-center text-sm text-[var(--text-dim)]">No funds match this filter.</p>}
      </div>

      <p className="flex items-start gap-1.5 text-xs text-[var(--text-dim)] px-1">
        <Info size={13} className="shrink-0 mt-0.5" />
        <span>XIRR is the money-weighted annual return from every recorded purchase and redemption. CAGR is the simple point-to-point return from the first purchase, so it understates SIP returns. Below ATH compares each fund's NAV to its own all-time high.</span>
      </p>
    </div>
  )
}

function Chip({ active, onClick, label, color }) {
  return (
    <button onClick={onClick}
      className={`px-2.5 py-1 text-xs font-medium rounded-full border transition-colors ${active ? 'text-white border-transparent' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-[var(--bg-card)] border-[var(--border)]'}`}
      style={active ? { background: color || '#8b5cf6' } : undefined}>
      {label}
    </button>
  )
}

function Mini({ label, value, cls = 'text-[var(--text-primary)]', sub }) {
  return (
    <div>
      <p className="text-[10px] text-[var(--text-dim)] uppercase tracking-wider">{label}</p>
      <p className={`text-xs font-semibold tabular-nums ${cls}`}>{value}</p>
      {sub && <p className="text-[10px] text-[var(--text-dim)]">{sub}</p>}
    </div>
  )
}

function SortIcon({ active, dir }) {
  if (!active) return <ArrowUpDown size={11} className="opacity-40" />
  return dir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />
}

function AllocationBar({ title, items, colorFor, amt, mv, maskNames }) {
  if (!items.length) return null
  return (
    <div>
      <p className="text-xs text-[var(--text-dim)] uppercase tracking-wider mb-2">{title}</p>
      <div className="flex h-2 rounded-full overflow-hidden bg-[var(--bg-inset)]">
        {items.map((it, i) => (
          <div key={it.name} style={{ width: `${it.pct}%`, background: colorFor(it.name, i) }} title={`${it.name} ${it.pct.toFixed(1)}%`} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
        {items.map((it, i) => (
          <div key={it.name} className="flex items-center gap-1.5 text-xs">
            <span className="w-2 h-2 rounded-sm" style={{ background: colorFor(it.name, i) }} />
            <span className="text-[var(--text-muted)]">{maskNames ? mv(it.name, 'name') : it.name}</span>
            <span className="text-[var(--text-primary)] font-semibold tabular-nums">{it.pct.toFixed(1)}%</span>
            <span className="text-[var(--text-dim)] tabular-nums">{amt(it.value)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function PositionsTable({ fund, amt, mv, hideAmounts, onOpen, compact }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-dim)]">Held in {fund.positions.length} portfolio{fund.positions.length === 1 ? '' : 's'}</p>
        <button onClick={(e) => { e.stopPropagation(); onOpen() }} className="text-xs font-medium text-violet-400 hover:text-violet-300">Open in Mutual Funds →</button>
      </div>
      {compact ? (
        <div className="space-y-2">
          {fund.positions.map((p) => (
            <div key={p.portfolioId} className="rounded-lg border border-[var(--border-light)] bg-[var(--bg-card)] px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{p.portfolioName}</p>
                  <p className="text-[10px] text-[var(--text-dim)]">{mv(p.ownerName, 'name')} · since {monthYear(p.since)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-bold text-[var(--text-primary)] tabular-nums">{amt(p.currentValue)}</p>
                  <p className={`text-[11px] font-semibold tabular-nums ${plClass(p.pl)}`}>{pct(p.plPct)} · XIRR {ratePct(p.xirr)}</p>
                </div>
              </div>
              <p className="text-[10px] text-[var(--text-dim)] mt-1 tabular-nums">{p.units.toFixed(3)} units · avg ₹{p.avgNav.toFixed(2)} · inv {amt(p.invested)}{p.ongoingSIP > 0 ? ` · SIP ${amt(p.ongoingSIP)}/mo` : ''}</p>
            </div>
          ))}
        </div>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[var(--text-dim)] uppercase tracking-wider">
              <th className="text-left py-1 pr-3 font-semibold">Portfolio</th>
              <th className="text-left py-1 pr-3 font-semibold">Member</th>
              <th className="text-right py-1 pr-3 font-semibold">Units</th>
              <th className="text-right py-1 pr-3 font-semibold">Avg NAV</th>
              <th className="text-right py-1 pr-3 font-semibold">Invested</th>
              <th className="text-right py-1 pr-3 font-semibold">Current</th>
              <th className="text-right py-1 pr-3 font-semibold">P&L</th>
              <th className="text-right py-1 pr-3 font-semibold">XIRR</th>
              <th className="text-right py-1 pr-3 font-semibold">Since</th>
              <th className="text-right py-1 font-semibold">SIP</th>
            </tr>
          </thead>
          <tbody>
            {fund.positions.map((p) => (
              <tr key={p.portfolioId} className="border-t border-[var(--border-light)]">
                <td className="py-1.5 pr-3 text-[var(--text-primary)] font-medium">{p.portfolioName}</td>
                <td className="py-1.5 pr-3 text-[var(--text-muted)]">{mv(p.ownerName, 'name')}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums text-[var(--text-muted)]">{p.units.toFixed(3)}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums text-[var(--text-muted)]">₹{p.avgNav.toFixed(2)}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums text-[var(--text-muted)]">{amt(p.invested)}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums font-semibold text-[var(--text-primary)]">{amt(p.currentValue)}</td>
                <td className={`py-1.5 pr-3 text-right tabular-nums font-semibold ${plClass(p.pl)}`}>{hideAmounts ? '' : `${p.pl >= 0 ? '+' : ''}${formatINR(p.pl)} `}{pct(p.plPct)}</td>
                <td className={`py-1.5 pr-3 text-right tabular-nums font-semibold ${plClass(p.xirr)}`}>{ratePct(p.xirr)}</td>
                <td className="py-1.5 pr-3 text-right text-[var(--text-dim)]">{monthYear(p.since)}</td>
                <td className="py-1.5 text-right tabular-nums text-[var(--text-dim)]">{p.ongoingSIP > 0 ? `${amt(p.ongoingSIP)}/mo` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
