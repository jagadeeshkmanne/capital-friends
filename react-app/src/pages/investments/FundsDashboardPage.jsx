import { useMemo, useState, useEffect, Fragment } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Layers, Search, ChevronDown, ChevronRight, ArrowUp, ArrowDown, ArrowUpDown,
  Eye, EyeOff, Wallet, Check, Info, X, SlidersHorizontal,
} from 'lucide-react'
import { useData } from '../../context/DataContext'
import { useFamily } from '../../context/FamilyContext'
import { formatINR, splitFundName } from '../../data/familyData'
import { yearsBetween } from '../../utils/mfMetrics'
import { CATEGORY_COLORS } from '../../utils/fundCategory'
import { buildFundsModel, resolvePortfolioOwners } from '../../utils/fundsDashboard'

const HIDE_KEY = 'cf_funds_hide_amounts'
const MEMBER_COLORS = ['#8b5cf6', '#06b6d4', '#f59e0b', '#10b981', '#ec4899', '#3b82f6', '#f97316', '#14b8a6']

// ── formatting helpers ──
function pct(v, digits = 1) {
  if (v == null || !Number.isFinite(v)) return '—'
  return `${v >= 0 ? '+' : ''}${v.toFixed(digits)}%`
}
function ratePct(v) {
  if (v == null || !Number.isFinite(v)) return 'N/A'
  return `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`
}
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
// Why XIRR / CAGR is hidden for a row
const REASON_TEXT = {
  'no-history': { short: 'no history', long: 'Recorded purchases do not cover this holding. Add the earlier transactions to get XIRR and CAGR.' },
  'opening-balance': { short: 'set purchase date', long: 'This holding was added as an opening balance dated less than a year ago, so annualising it would be misleading. Edit that transaction and set the real purchase date to get XIRR and CAGR.' },
  'too-new': { short: 'under 3 months', long: 'Held for less than three months. Annualised returns are not meaningful yet.' },
  'funds-unreliable': { short: '', long: 'One or more funds in this selection cannot be annualised, so the combined XIRR and CAGR are hidden.' },
  'varied-dates': { short: 'see XIRR', long: 'Money went in on different dates, so a single point-to-point CAGR does not apply. XIRR is the right number for this selection.' },
}
function reasonShort(r) { return r ? REASON_TEXT[r]?.short || '' : '' }
function reasonLong(r) { return r ? REASON_TEXT[r]?.long || '' : undefined }

// Family member label: relationship first ("Spouse", "Son"), disambiguated when two members share one
function buildMemberLabels(members) {
  const counts = {}
  members.forEach((m) => { const r = m.relationship || 'Member'; counts[r] = (counts[r] || 0) + 1 })
  const labels = {}
  members.forEach((m) => {
    const r = m.relationship || 'Member'
    labels[m.memberId] = counts[r] > 1 ? `${r} · ${String(m.memberName || '').trim().charAt(0).toUpperCase()}` : r
  })
  return labels
}

const COLUMNS = [
  { key: 'fundName', label: 'Fund', align: 'left' },
  { key: 'invested', label: 'Invested', align: 'right' },
  { key: 'currentValue', label: 'Current', align: 'right' },
  { key: 'pl', label: 'P&L', align: 'right' },
  { key: 'xirr', label: 'XIRR', sub: 'CAGR · held', align: 'right' },
  { key: 'weight', label: 'Weight', align: 'right' },
  { key: 'belowATHPct', label: 'ATH', sub: 'Below peak', align: 'right' },
]

export default function FundsDashboardPage() {
  const navigate = useNavigate()
  const { selectedMember, familyMembers } = useFamily()
  const { mfPortfolios, mfHoldings, mfTransactions, activeMembers, activeInvestmentAccounts } = useData()

  // Multi-select filters. An empty set means "all".
  const [memberSel, setMemberSel] = useState(() => new Set(selectedMember && selectedMember !== 'all' ? [selectedMember] : []))
  const [portfolioSel, setPortfolioSel] = useState(() => new Set())
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState({ key: 'currentValue', dir: 'desc' })
  const [expanded, setExpanded] = useState(() => new Set())
  const [filtersOpen, setFiltersOpen] = useState(false) // mobile filter panel
  const [hideAmounts, setHideAmounts] = useState(() => {
    try { return localStorage.getItem(HIDE_KEY) === 'true' } catch { return false }
  })
  useEffect(() => {
    try { localStorage.setItem(HIDE_KEY, String(hideAmounts)) } catch {}
  }, [hideAmounts])

  const amt = (v) => (hideAmounts ? '₹ ••••' : formatINR(v || 0))
  const memberLabels = useMemo(() => buildMemberLabels(familyMembers || []), [familyMembers])
  const labelFor = (memberId, fallback) => memberLabels[memberId] || fallback || 'Member'

  // Portfolios with owners resolved, then labelled by relationship
  const enrichedPortfolios = useMemo(
    () => resolvePortfolioOwners(mfPortfolios, activeInvestmentAccounts, activeMembers)
      .map((p) => ({ ...p, ownerName: memberLabels[p.ownerId] || p.ownerName || 'Member' })),
    [mfPortfolios, activeInvestmentAccounts, activeMembers, memberLabels],
  )

  const memberPortfolios = useMemo(
    () => (memberSel.size === 0 ? enrichedPortfolios : enrichedPortfolios.filter((p) => memberSel.has(p.ownerId))),
    [enrichedPortfolios, memberSel],
  )

  // Drop ticked portfolios that no longer belong to the ticked members
  useEffect(() => {
    if (portfolioSel.size === 0) return
    const valid = new Set(memberPortfolios.map((p) => p.portfolioId))
    if ([...portfolioSel].some((id) => !valid.has(id))) {
      setPortfolioSel(new Set([...portfolioSel].filter((id) => valid.has(id))))
    }
  }, [memberPortfolios, portfolioSel])

  const scopedPortfolios = useMemo(
    () => (portfolioSel.size === 0 ? memberPortfolios : memberPortfolios.filter((p) => portfolioSel.has(p.portfolioId))),
    [memberPortfolios, portfolioSel],
  )

  const model = useMemo(
    () => buildFundsModel({ portfolios: scopedPortfolios, holdings: mfHoldings, transactions: mfTransactions }),
    [scopedPortfolios, mfHoldings, mfTransactions],
  )

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = model.funds
    if (q) list = list.filter((f) => f.fundName.toLowerCase().includes(q))
    const dir = sort.dir === 'asc' ? 1 : -1
    return [...list].sort((a, b) => {
      const av = a[sort.key]
      const bv = b[sort.key]
      if (sort.key === 'fundName') return dir * String(av).localeCompare(String(bv))
      const an = av == null || !Number.isFinite(av) ? -Infinity : av
      const bn = bv == null || !Number.isFinite(bv) ? -Infinity : bv
      return dir * (an - bn)
    })
  }, [model.funds, search, sort])

  function toggleIn(setter) {
    return (id) => setter((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  const toggleMember = toggleIn(setMemberSel)
  const togglePortfolio = toggleIn(setPortfolioSel)
  const toggleExpand = toggleIn(setExpanded)
  function toggleSort(key) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: key === 'fundName' ? 'asc' : 'desc' }))
  }
  function clearFilters() { setMemberSel(new Set()); setPortfolioSel(new Set()) }

  const activeFilterCount = memberSel.size + portfolioSel.size
  const memberLabel = memberSel.size === 0
    ? 'Everyone'
    : (familyMembers || []).filter((m) => memberSel.has(m.memberId)).map((m) => labelFor(m.memberId, m.memberName)).join(', ')

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

  const filterPanel = (
    <FilterPanel
      members={(familyMembers || []).map((m) => ({
        id: m.memberId,
        label: labelFor(m.memberId, m.memberName),
        count: enrichedPortfolios.filter((p) => p.ownerId === m.memberId).length,
      }))}
      memberSel={memberSel}
      onToggleMember={toggleMember}
      onAllMembers={() => setMemberSel(new Set())}
      portfolios={memberPortfolios}
      portfolioSel={portfolioSel}
      onTogglePortfolio={togglePortfolio}
      onAllPortfolios={() => setPortfolioSel(new Set())}
      showOwner={memberSel.size !== 1}
      hideAmounts={hideAmounts}
      onToggleHide={() => setHideAmounts((v) => !v)}
      onClear={clearFilters}
      activeCount={activeFilterCount}
    />
  )

  return (
    <div className="min-w-0 max-w-full lg:flex lg:items-start lg:gap-5">
      {/* ── Left filter panel (desktop) ── */}
      <aside className="hidden lg:block w-60 shrink-0 sticky top-4">{filterPanel}</aside>

      <div className="flex-1 min-w-0 space-y-4">
        {/* ── Title row ── */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-violet-500/15 flex items-center justify-center shrink-0"><Layers size={18} className="text-violet-400" /></div>
            <div className="min-w-0">
              <h1 className="text-base font-bold text-[var(--text-primary)] leading-tight">All Funds</h1>
              <p className="text-xs text-[var(--text-dim)] truncate">
                {memberLabel} · {scopedPortfolios.length} portfolio{scopedPortfolios.length === 1 ? '' : 's'} · {t.fundCount} fund{t.fundCount === 1 ? '' : 's'}
              </p>
            </div>
          </div>
          <button onClick={() => setFiltersOpen((o) => !o)}
            className={`lg:hidden flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium border rounded-lg transition-colors shrink-0 ${activeFilterCount > 0 || filtersOpen ? 'text-[var(--accent-violet)] bg-violet-500/10 border-violet-500/30' : 'text-[var(--text-muted)] bg-[var(--bg-card)] border-[var(--border)]'}`}>
            <SlidersHorizontal size={13} /> Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </button>
        </div>

        {/* ── Filter panel (mobile, collapsible) ── */}
        {filtersOpen && <div className="lg:hidden">{filterPanel}</div>}

        {/* ── Summary ── */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 sm:p-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-x-6 gap-y-4">
            <Stat label="Net invested" value={amt(t.netInvested ?? t.invested)} muted
              sub={t.netInvested != null && Math.abs(t.netInvested - t.invested) > Math.max(1, t.invested * 0.01) ? `cost basis ${amt(t.invested)}` : 'cash in minus cash out'} />
            <Stat label="Current" value={amt(t.currentValue)} bold />
            <Stat label="Total gain" bold cls={plClass(t.totalGain ?? t.pl)}
              value={<>{hideAmounts ? '' : `${(t.totalGain ?? t.pl) >= 0 ? '+' : ''}${formatINR(t.totalGain ?? t.pl)} `}<span className={`text-sm font-semibold ${hideAmounts ? '' : 'opacity-80'}`}>{pct(t.totalGain != null ? t.totalGainPct : t.plPct)}</span></>}
              sub={t.totalGain != null && Math.abs(t.totalGain - t.pl) > Math.max(1, Math.abs(t.pl) * 0.01) ? `unrealised ${hideAmounts ? '' : formatINR(t.pl) + ' '}${pct(t.plPct)}` : null} />
            <Stat label="XIRR" bold cls={plClass(t.xirr)} value={ratePct(t.xirr)} title={reasonLong(t.returnsReason)}
              sub={t.unreliableCount > 0 ? <span className="text-amber-500/90">{t.unreliableCount} fund{t.unreliableCount === 1 ? '' : 's'} need{t.unreliableCount === 1 ? 's' : ''} dates</span> : null} />
            <Stat label="CAGR" cls={plClass(t.cagr)} value={ratePct(t.cagr)} title={reasonLong(t.cagrReason)}
              sub={t.cagr != null ? `since ${monthYear(t.since)}` : (t.cagrReason === 'varied-dates' ? <span className="text-[var(--text-dim)]">{reasonShort(t.cagrReason)}</span> : null)} />
            <Stat label="Buy opportunities" bold cls={t.buyOppCount > 0 ? 'text-emerald-400' : 'text-[var(--text-primary)]'} value={String(t.buyOppCount)}
              sub={`${t.buyOppCount > 0 ? '5%+ below peak · ' : ''}avg ${t.weightedBelowATH.toFixed(1)}% below ATH`} />
          </div>

          {(model.categories.length > 0 || model.members.length > 1) && (
            <div className={`grid grid-cols-1 ${model.members.length > 1 ? 'xl:grid-cols-2' : ''} gap-5 mt-5 pt-4 border-t border-[var(--border-light)]`}>
              <AllocationBar title="By category" items={model.categories} colorFor={(name) => CATEGORY_COLORS[name] || CATEGORY_COLORS.Other} amt={amt} />
              {model.members.length > 1 && (
                <AllocationBar title="By member" items={model.members} colorFor={(_, i) => MEMBER_COLORS[i % MEMBER_COLORS.length]} amt={amt} />
              )}
            </div>
          )}
        </div>

        {/* ── Search ── */}
        <div className="relative max-w-xs">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search fund"
            className="w-full pl-8 pr-7 py-1.5 text-sm bg-[var(--bg-card)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-violet-500/50" />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-dim)] hover:text-[var(--text-primary)]"><X size={13} /></button>
          )}
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
                      className={`py-2.5 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider select-none cursor-pointer whitespace-nowrap hover:text-[var(--text-primary)] ${c.align === 'left' ? 'text-left' : 'text-right'}`}>
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
                        <td className="py-3 px-3 max-w-[320px]">
                          <p className="text-[var(--text-primary)] font-medium leading-snug truncate" title={f.fundName}>{main}</p>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            <CategoryTag category={f.category} />
                            {plan && <span className="text-xs text-[var(--text-dim)] truncate">{plan}</span>}
                            {f.positions.length > 1 && <span className="text-[10px] font-semibold text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded">{f.positions.length} portfolios</span>}
                            {f.isBuyOpp && <BuyTag strong={f.isStrongBuy} />}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right tabular-nums whitespace-nowrap text-[var(--text-muted)]">{amt(f.invested)}</td>
                        <td className="py-3 px-3 text-right tabular-nums whitespace-nowrap font-semibold text-[var(--text-primary)]">{amt(f.currentValue)}</td>
                        <td className={`py-3 px-3 text-right tabular-nums whitespace-nowrap ${plClass(f.pl)}`}>
                          {!hideAmounts && <div className="font-semibold">{f.pl >= 0 ? '+' : ''}{formatINR(f.pl)}</div>}
                          <div className={hideAmounts ? 'font-semibold' : 'text-xs opacity-80'}>{pct(f.plPct)}</div>
                        </td>
                        <td className="py-3 px-3 text-right tabular-nums whitespace-nowrap" title={reasonLong(f.returnsReason)}>
                          <div className={`font-semibold ${plClass(f.xirr)}`}>{ratePct(f.xirr)}</div>
                          <div className="text-xs text-[var(--text-dim)]">
                            {f.returnsReason ? <span className="text-amber-500/90">{reasonShort(f.returnsReason)}</span> : <><span className={plClass(f.cagr)}>{ratePct(f.cagr)}</span> · {holdingSince(f.since)}</>}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right tabular-nums whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-14 h-1.5 rounded-full bg-[var(--bg-inset)] overflow-hidden"><div className="h-full rounded-full bg-violet-500/70" style={{ width: `${Math.min(100, f.weight)}%` }} /></div>
                            <span className="text-[var(--text-primary)] w-12">{f.weight.toFixed(1)}%</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          <ATHBadge fund={f} />
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="border-b border-[var(--border-light)] bg-[var(--bg-inset)]/60">
                          <td></td>
                          <td colSpan={COLUMNS.length} className="px-3 py-3">
                            <FundDetail fund={f} amt={amt} hideAmounts={hideAmounts} onOpen={() => navigate('/investments/mutual-funds')} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
                {rows.length === 0 && (
                  <tr><td colSpan={COLUMNS.length + 1} className="py-10 text-center text-sm text-[var(--text-dim)]">No funds match this selection.</td></tr>
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
                        <CategoryTag category={f.category} />
                        {plan && <span className="text-xs text-[var(--text-dim)] truncate">{plan}</span>}
                        {f.isBuyOpp && <BuyTag strong={f.isStrongBuy} />}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-[var(--text-primary)] tabular-nums">{amt(f.currentValue)}</p>
                      <p className={`text-xs font-semibold tabular-nums ${plClass(f.pl)}`}>{hideAmounts ? '' : `${f.pl >= 0 ? '+' : ''}${formatINR(f.pl)} · `}{pct(f.plPct)}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2 mt-2.5 text-center">
                    <Mini label="XIRR" value={ratePct(f.xirr)} cls={plClass(f.xirr)} sub={f.returnsReason ? reasonShort(f.returnsReason) : null} />
                    <Mini label="CAGR" value={ratePct(f.cagr)} cls={plClass(f.cagr)} sub={f.returnsReason ? null : holdingSince(f.since)} />
                    <Mini label="Weight" value={`${f.weight.toFixed(1)}%`} />
                    <Mini label="Below ATH" value={f.athNav > 0 ? (f.belowATHPct <= 0 ? 'At ATH' : `−${f.belowATHPct.toFixed(1)}%`) : '—'} cls={f.athNav > 0 ? athBadgeClass(f.belowATHPct).split(' ').pop() : ''} />
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-2 text-xs text-[var(--text-dim)] tabular-nums">
                    <span>Inv {amt(f.invested)}</span>
                    {f.positions.length > 1 && <span>{f.positions.length} portfolios</span>}
                  </div>
                </button>
                {isOpen && (
                  <div className="border-t border-[var(--border-light)] bg-[var(--bg-inset)]/60 px-3 py-3">
                    <FundDetail fund={f} amt={amt} hideAmounts={hideAmounts} onOpen={() => navigate('/investments/mutual-funds')} compact />
                  </div>
                )}
              </div>
            )
          })}
          {rows.length === 0 && <p className="py-10 text-center text-sm text-[var(--text-dim)]">No funds match this selection.</p>}
        </div>

        <p className="flex items-start gap-1.5 text-xs text-[var(--text-dim)] px-1">
          <Info size={13} className="shrink-0 mt-0.5" />
          <span>Net invested is cash put in minus cash taken out; switches between funds cancel out. Total gain is current value minus net invested, so it includes gains realised through switches. XIRR is the money-weighted annual return from every recorded purchase and redemption. CAGR is the point-to-point return and only applies when the money went in at one time. Both are N/A for holdings added as an opening balance less than a year ago; edit that transaction and set the real first purchase date. Below ATH compares each fund's NAV to its own all-time high.</span>
        </p>
      </div>
    </div>
  )
}

// ── Left filter panel ──
function FilterPanel({ members, memberSel, onToggleMember, onAllMembers, portfolios, portfolioSel, onTogglePortfolio, onAllPortfolios, showOwner, hideAmounts, onToggleHide, onClear, activeCount }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-light)]">
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Filters</p>
        {activeCount > 0 && <button onClick={onClear} className="text-xs font-medium text-violet-400 hover:text-violet-300">Clear</button>}
      </div>

      <Section title="Members">
        <CheckRow active={memberSel.size === 0} onClick={onAllMembers} label="Everyone" />
        {members.map((m) => (
          <CheckRow key={m.id} active={memberSel.has(m.id)} onClick={() => onToggleMember(m.id)} label={m.label} hint={m.count} dim={m.count === 0} />
        ))}
      </Section>

      <Section title="Portfolios">
        <CheckRow active={portfolioSel.size === 0} onClick={onAllPortfolios} label="All portfolios" />
        {portfolios.map((p) => (
          <CheckRow key={p.portfolioId} active={portfolioSel.has(p.portfolioId)} onClick={() => onTogglePortfolio(p.portfolioId)}
            label={p.portfolioName} sub={showOwner ? p.ownerName : ''} />
        ))}
        {portfolios.length === 0 && <p className="text-xs text-[var(--text-dim)] px-1 py-1">No portfolios for the selected members</p>}
      </Section>

      <Section title="View" last>
        <button onClick={onToggleHide} className="w-full flex items-center justify-between gap-2 px-1 py-1.5 text-sm text-[var(--text-primary)]">
          <span className="flex items-center gap-2">{hideAmounts ? <EyeOff size={14} className="text-amber-400" /> : <Eye size={14} className="text-[var(--text-dim)]" />} Hide amounts</span>
          <span className={`w-8 h-[18px] rounded-full relative transition-colors ${hideAmounts ? 'bg-violet-500' : 'bg-[var(--bg-inset)] border border-[var(--border)]'}`}>
            <span className={`absolute top-[2px] w-[12px] h-[12px] rounded-full bg-white transition-all ${hideAmounts ? 'left-[16px]' : 'left-[2px]'}`} />
          </span>
        </button>
      </Section>
    </div>
  )
}

function Section({ title, children, last }) {
  return (
    <div className={`px-3 py-3 ${last ? '' : 'border-b border-[var(--border-light)]'}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-dim)] px-1 mb-1.5">{title}</p>
      <div className="space-y-0.5">{children}</div>
    </div>
  )
}

function CheckRow({ active, onClick, label, sub, hint, dim }) {
  return (
    <button onClick={onClick} aria-pressed={active}
      className={`w-full flex items-center gap-2.5 px-1.5 py-1.5 rounded-lg text-left transition-colors ${active ? 'bg-violet-500/10' : 'hover:bg-[var(--bg-hover)]'} ${dim ? 'opacity-50' : ''}`}>
      <span className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 ${active ? 'bg-violet-500 border-violet-500' : 'border-[var(--text-dim)]'}`}>
        {active && <Check size={11} strokeWidth={3} className="text-white" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-sm truncate ${active ? 'text-[var(--accent-violet)] font-medium' : 'text-[var(--text-primary)]'}`} title={label}>{label}</span>
        {sub && <span className="block text-[11px] text-[var(--text-dim)] truncate">{sub}</span>}
      </span>
      {hint != null && <span className="text-[11px] text-[var(--text-dim)] tabular-nums shrink-0">{hint}</span>}
    </button>
  )
}

// ── small presentational pieces ──
function Stat({ label, value, sub, cls = 'text-[var(--text-primary)]', bold, muted, title }) {
  return (
    <div title={title}>
      <p className="text-xs text-[var(--text-dim)] uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-base tabular-nums whitespace-nowrap ${bold ? 'font-bold' : 'font-semibold'} ${muted ? 'text-[var(--text-muted)]' : cls}`}>{value}</p>
      {sub && <p className="text-xs text-[var(--text-dim)]">{sub}</p>}
    </div>
  )
}

function CategoryTag({ category }) {
  const color = CATEGORY_COLORS[category] || CATEGORY_COLORS.Other
  return <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase" style={{ background: `${color}20`, color }}>{category}</span>
}

function BuyTag({ strong }) {
  return <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${strong ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/15 text-blue-400'}`}>{strong ? 'Strong Buy' : 'Buy'}</span>
}

function ATHBadge({ fund }) {
  if (!(fund.athNav > 0)) return <span className="text-xs text-[var(--text-dim)]">—</span>
  return (
    <span className={`inline-block text-xs font-semibold px-1.5 py-0.5 rounded-full tabular-nums ${athBadgeClass(fund.belowATHPct)}`}>
      {fund.belowATHPct <= 0 ? 'At ATH' : `−${fund.belowATHPct.toFixed(1)}%`}
    </span>
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

function AllocationBar({ title, items, colorFor, amt }) {
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
            <span className="text-[var(--text-muted)]">{it.name}</span>
            <span className="text-[var(--text-primary)] font-semibold tabular-nums">{it.pct.toFixed(1)}%</span>
            <span className="text-[var(--text-dim)] tabular-nums">{amt(it.value)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Expanded row: fund-level facts + per-portfolio split ──
function FundDetail({ fund, amt, hideAmounts, onOpen, compact }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--text-dim)] tabular-nums">
          <span><span className="text-[var(--text-muted)]">{fund.units.toFixed(3)}</span> units</span>
          <span>NAV <span className="text-[var(--text-muted)]">₹{fund.currentNav.toFixed(2)}</span></span>
          <span>Avg <span className="text-[var(--text-muted)]">₹{fund.avgNav.toFixed(2)}</span></span>
          {fund.athNav > 0 && <span>ATH <span className="text-[var(--text-muted)]">₹{fund.athNav.toFixed(2)}</span></span>}
          {fund.ongoingSIP > 0 && <span>SIP <span className="text-[var(--text-muted)]">{amt(fund.ongoingSIP)}/mo</span></span>}
          {fund.since && <span>since <span className="text-[var(--text-muted)]">{monthYear(fund.since)}</span></span>}
        </div>
        <button onClick={(e) => { e.stopPropagation(); onOpen() }} className="text-xs font-medium text-violet-400 hover:text-violet-300">Open in Mutual Funds →</button>
      </div>
      {fund.returnsReason && <p className="text-xs text-amber-500/90">{reasonLong(fund.returnsReason)}</p>}

      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-dim)]">Held in {fund.positions.length} portfolio{fund.positions.length === 1 ? '' : 's'}</p>
      {compact ? (
        <div className="space-y-2">
          {fund.positions.map((p) => (
            <div key={p.portfolioId} className="rounded-lg border border-[var(--border-light)] bg-[var(--bg-card)] px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{p.portfolioName}</p>
                  <p className="text-[10px] text-[var(--text-dim)]">{p.ownerName} · since {monthYear(p.since)}</p>
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
        <table className="w-full text-xs whitespace-nowrap">
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
                <td className="py-1.5 pr-3 text-[var(--text-muted)]">{p.ownerName}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums text-[var(--text-muted)]">{p.units.toFixed(3)}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums text-[var(--text-muted)]">₹{p.avgNav.toFixed(2)}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums text-[var(--text-muted)]">{amt(p.invested)}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums font-semibold text-[var(--text-primary)]">{amt(p.currentValue)}</td>
                <td className={`py-1.5 pr-3 text-right tabular-nums font-semibold ${plClass(p.pl)}`}>{hideAmounts ? '' : `${p.pl >= 0 ? '+' : ''}${formatINR(p.pl)} `}{pct(p.plPct)}</td>
                <td className={`py-1.5 pr-3 text-right tabular-nums font-semibold ${plClass(p.xirr)}`} title={reasonLong(p.returnsReason)}>{ratePct(p.xirr)}{p.returnsReason && <div className="text-[10px] font-normal text-amber-500/90">{reasonShort(p.returnsReason)}</div>}</td>
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
