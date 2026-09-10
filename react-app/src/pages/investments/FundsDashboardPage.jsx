import { useMemo, useState, useEffect, Fragment } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Layers, Search, ChevronDown, ChevronRight, ArrowUp, ArrowDown, ArrowUpDown,
  Eye, EyeOff, Wallet, Check, Info, X, SlidersHorizontal, Presentation, Minimize2, Users,
} from 'lucide-react'
import { useData } from '../../context/DataContext'
import { useFamily } from '../../context/FamilyContext'
import { formatINR, splitFundName } from '../../data/familyData'
import { yearsBetween } from '../../utils/mfMetrics'
import { CATEGORY_COLORS } from '../../utils/fundCategory'
import { buildFundsModel, resolvePortfolioOwners } from '../../utils/fundsDashboard'

const HIDE_KEY = 'cf_funds_hide_amounts'
const PRESENT_KEY = 'cf_funds_present'

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
// Why XIRR / CAGR is hidden for a row
const REASON_TEXT = {
  'no-history': { short: 'no history', long: 'Recorded purchases do not cover this holding. Add the earlier transactions to get XIRR and CAGR.' },
  'opening-balance': { short: 'set purchase date', long: 'This holding was added as an opening balance dated less than a year ago, so annualising it would be misleading. Edit that transaction and set the real purchase date to get XIRR and CAGR.' },
  'too-new': { short: 'under 3 months', long: 'Held for less than three months. Annualised returns are not meaningful yet.' },
  'funds-unreliable': { short: '', long: 'One or more funds in this selection cannot be annualised, so the combined XIRR and CAGR are hidden.' },
}
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
  { key: 'invested', label: 'Amount', sub: 'Current / Invested', align: 'right' },
  { key: 'pl', label: 'P&L', align: 'right' },
  { key: 'xirr', label: 'XIRR', align: 'right' },
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
  const [sort, setSort] = useState({ key: 'invested', dir: 'desc' })
  const [expanded, setExpanded] = useState(() => new Set())
  const [filtersOpen, setFiltersOpen] = useState(false) // mobile filter panel
  const [tab, setTab] = useState('funds') // 'funds' | 'member' | 'portfolio'
  const [hideAmounts, setHideAmounts] = useState(() => {
    try { return localStorage.getItem(HIDE_KEY) === 'true' } catch { return false }
  })
  useEffect(() => {
    try { localStorage.setItem(HIDE_KEY, String(hideAmounts)) } catch {}
  }, [hideAmounts])
  // Present mode: bigger type, fewer elements, filters tucked away. Meant for screen recording.
  const [present, setPresent] = useState(() => {
    try { return localStorage.getItem(PRESENT_KEY) === 'true' } catch { return false }
  })
  useEffect(() => {
    try { localStorage.setItem(PRESENT_KEY, String(present)) } catch {}
  }, [present])
  const sz = present
    ? { stat: 'text-lg', row: 'py-3', cell: 'text-sm', num: 'text-sm', name: 'text-base' }
    : { stat: 'text-sm', row: 'py-2.5', cell: 'text-sm', num: 'text-xs', name: 'text-sm' }

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
      present={present}
      onTogglePresent={() => setPresent((v) => !v)}
      onClear={clearFilters}
      activeCount={activeFilterCount}
    />
  )

  return (
    <div className="min-w-0 max-w-full lg:flex lg:items-start lg:gap-5">
      {/* ── Left filter panel (desktop) ── */}
      {!present && <aside className="hidden lg:block w-60 shrink-0 sticky top-4">{filterPanel}</aside>}

      <div className="flex-1 min-w-0 space-y-4">
        {/* ── Title row ── */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-violet-500/15 flex items-center justify-center shrink-0"><Layers size={18} className="text-violet-400" /></div>
            <div className="min-w-0">
              <h1 className={`${present ? 'text-xl' : 'text-base'} font-bold text-[var(--text-primary)] leading-tight`}>All Funds</h1>
              <p className={`${present ? 'text-sm' : 'text-xs'} text-[var(--text-dim)] truncate`}>
                {memberLabel} · {scopedPortfolios.length} portfolio{scopedPortfolios.length === 1 ? '' : 's'} · {t.fundCount} fund{t.fundCount === 1 ? '' : 's'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => setFiltersOpen((o) => !o)}
              className={`${present ? '' : 'lg:hidden'} flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium border rounded-lg transition-colors ${activeFilterCount > 0 || filtersOpen ? 'text-[var(--accent-violet)] bg-violet-500/10 border-violet-500/30' : 'text-[var(--text-muted)] bg-[var(--bg-card)] border-[var(--border)]'}`}>
              <SlidersHorizontal size={13} /> Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
            </button>
            {present && (
              <button onClick={() => { setPresent(false); setFiltersOpen(false) }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium border rounded-lg text-amber-400 bg-amber-500/10 border-amber-500/30">
                <Minimize2 size={13} /> Exit present
              </button>
            )}
          </div>
        </div>

        {/* ── Filter panel (collapsible: mobile always, desktop in present mode) ── */}
        {filtersOpen && <div className={present ? '' : 'lg:hidden'}>{filterPanel}</div>}

        {/* ── Stat cards (Mutual Funds page style) ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <Stat sz={sz} label="Invested" value={amt(t.netInvested ?? t.invested)} title={t.netInvested != null && Math.abs(t.netInvested - t.invested) > 1 ? `Cost basis of current holdings: ${amt(t.invested)}` : undefined} />
          <Stat sz={sz} label="Current Value" value={amt(t.currentValue)} bold />
          <Stat sz={sz} label="Total Gain" positive={(t.totalGain ?? t.pl) >= 0}
            value={hideAmounts ? pct(t.totalGain != null ? t.totalGainPct : t.plPct) : `${(t.totalGain ?? t.pl) >= 0 ? '+' : ''}${formatINR(t.totalGain ?? t.pl)}`}
            sub={hideAmounts ? null : pct(t.totalGain != null ? t.totalGainPct : t.plPct)}
            title={t.totalGain != null ? `Unrealised on current holdings: ${hideAmounts ? '' : formatINR(t.pl) + ' '}${pct(t.plPct)}` : undefined} />
          <Stat sz={sz} label="XIRR" positive={t.xirr == null ? undefined : t.xirr >= 0} value={ratePct(t.xirr)} title={reasonLong(t.returnsReason)} />
          <Stat sz={sz} label="CAGR" positive={t.cagr == null ? undefined : t.cagr >= 0} value={ratePct(t.cagr)} title={reasonLong(t.returnsReason) || (t.cagr != null ? `Over ${holdingSince(t.cagrSince)} average holding, since ${monthYear(t.since)}` : undefined)} />
        </div>

        {/* ── Tabs (Mutual Funds page style) ── */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1 bg-[var(--bg-inset)] rounded-lg p-0.5 shrink-0">
            <TabButton active={tab === 'funds'} onClick={() => setTab('funds')} icon={<Layers size={12} />} label={`Funds (${model.funds.length})`} />
            {model.breakdown.byMember.length > 1 && <TabButton active={tab === 'member'} onClick={() => setTab('member')} icon={<Users size={12} />} label={`By Member (${model.breakdown.byMember.length})`} />}
            {model.breakdown.byPortfolio.length > 1 && <TabButton active={tab === 'portfolio'} onClick={() => setTab('portfolio')} icon={<Wallet size={12} />} label={`By Portfolio (${model.breakdown.byPortfolio.length})`} />}
          </div>
          {tab === 'funds' && (
            <div className="relative ml-auto shrink-0 w-48 sm:w-60">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search fund"
                className="w-full pl-8 pr-7 py-1.5 text-xs bg-[var(--bg-card)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-violet-500/50" />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-dim)] hover:text-[var(--text-primary)]"><X size={12} /></button>
              )}
            </div>
          )}
        </div>

        {tab !== 'funds' && (
          <BreakdownCard mode={tab} rows={tab === 'member' ? model.breakdown.byMember : model.breakdown.byPortfolio} amt={amt} hideAmounts={hideAmounts} sz={sz} quiet={present} />
        )}

        {tab === 'funds' && (<>
        {/* ── Desktop table ── */}
        <div className="hidden lg:block rounded-xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className={`w-full ${sz.cell}`}>
              <thead>
                <tr className="border-b border-[var(--border-light)] bg-[var(--bg-inset)]">
                  <th className="w-8"></th>
                  {COLUMNS.map((c) => (
                    <th key={c.key} onClick={() => toggleSort(c.key)}
                      className={`py-2 px-3 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider select-none cursor-pointer whitespace-nowrap hover:text-[var(--text-primary)] ${c.align === 'left' ? 'text-left' : 'text-right'}`}>
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
                  const { main } = splitFundName(f.fundName)
                  const isOpen = expanded.has(f.key)
                  return (
                    <Fragment key={f.key}>
                      <tr onClick={() => toggleExpand(f.key)}
                        className={`border-b border-[var(--border-light)] cursor-pointer transition-colors ${isOpen ? 'bg-[var(--bg-hover)]' : 'hover:bg-[var(--bg-hover)]'}`}>
                        <td className="pl-3 text-[var(--text-dim)]">{isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</td>
                        <td className={`${sz.row} px-3 max-w-[380px]`}>
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className={`${sz.name} font-semibold text-[var(--text-primary)] truncate`} title={f.fundName}>{main}</span>
                            {f.isBuyOpp && <span className={`text-xs font-semibold px-1.5 py-0.5 rounded shrink-0 ${f.isStrongBuy ? 'text-emerald-400 bg-emerald-500/15' : 'text-blue-400 bg-blue-500/15'}`}>{f.isStrongBuy ? 'Strong Buy' : 'Buy'}</span>}
                          </div>
                        </td>
                        <td className={`${sz.row} px-3 text-right whitespace-nowrap ${sz.num} tabular-nums`}>
                          <span className="font-semibold text-[var(--text-primary)]">{amt(f.currentValue)}</span>
                          <span className="text-[var(--text-dim)]"> / {amt(f.invested)}</span>
                        </td>
                        <td className={`${sz.row} px-3 text-right whitespace-nowrap`}>
                          {!hideAmounts && <span className={`${sz.num} font-semibold tabular-nums ${plClass(f.pl)}`}>{f.pl >= 0 ? '+' : ''}{formatINR(f.pl)}</span>}
                          <span className={`${sz.num} tabular-nums ${hideAmounts ? `font-semibold ${plClass(f.pl)}` : `ml-1 ${f.pl >= 0 ? 'text-emerald-400/60' : 'text-[var(--accent-rose)]/60'}`}`}>{hideAmounts ? pct(f.plPct) : `(${pct(f.plPct)})`}</span>
                        </td>
                        <td className={`${sz.row} px-3 text-right ${sz.num} font-semibold tabular-nums ${plClass(f.xirr)}`} title={reasonLong(f.returnsReason)}>{ratePct(f.xirr)}</td>
                        <td className={`${sz.row} px-3 text-right ${sz.num} text-[var(--text-secondary)] tabular-nums`}>{f.weight.toFixed(1)}%</td>
                        <td className={`${sz.row} px-3 text-right`}><ATHBadge fund={f} cls={sz.num} /></td>
                      </tr>
                      {isOpen && (
                        <tr className="border-b border-[var(--border-light)] bg-[var(--bg-inset)]">
                          <td className="border-l-2 border-violet-500/60"></td>
                          <td colSpan={COLUMNS.length} className="px-4 py-4">
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
            const { main } = splitFundName(f.fundName)
            const isOpen = expanded.has(f.key)
            return (
              <div key={f.key} className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden min-w-0">
                <button onClick={() => toggleExpand(f.key)} className="w-full text-left px-3 py-3 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[var(--text-primary)] leading-snug">{main}</p>
                      {f.isBuyOpp && <div className="mt-1"><BuyTag strong={f.isStrongBuy} /></div>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-[var(--text-primary)] tabular-nums">{amt(f.currentValue)}</p>
                      <p className={`text-xs font-semibold tabular-nums ${plClass(f.pl)}`}>{hideAmounts ? '' : `${f.pl >= 0 ? '+' : ''}${formatINR(f.pl)} · `}{pct(f.plPct)}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2 mt-2.5 text-center">
                    <Mini label="XIRR" value={ratePct(f.xirr)} cls={plClass(f.xirr)} />
                    <Mini label="CAGR" value={ratePct(f.cagr)} cls={plClass(f.cagr)} sub={f.returnsReason ? null : holdingSince(f.cagrSince || f.since)} />
                    <Mini label="Weight" value={`${f.weight.toFixed(1)}%`} />
                    <Mini label="Below ATH" value={f.athNav > 0 ? (f.belowATHPct <= 0 ? 'At ATH' : `−${f.belowATHPct.toFixed(1)}%`) : '—'} cls={f.athNav > 0 ? athTextClass(f.belowATHPct) : ''} />
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-2 text-xs text-[var(--text-dim)] tabular-nums">
                    <span>Inv {amt(f.invested)}</span>
                    {f.positions.length > 1 && <span>{f.positions.length} portfolios</span>}
                  </div>
                </button>
                {isOpen && (
                  <div className="border-t border-[var(--border-light)] border-l-2 border-l-violet-500/60 bg-[var(--bg-inset)] px-3 py-3">
                    <FundDetail fund={f} amt={amt} hideAmounts={hideAmounts} onOpen={() => navigate('/investments/mutual-funds')} compact />
                  </div>
                )}
              </div>
            )
          })}
          {rows.length === 0 && <p className="py-10 text-center text-sm text-[var(--text-dim)]">No funds match this selection.</p>}
        </div>

        </>)}

        {!present && <p className="flex items-start gap-1.5 text-xs text-[var(--text-dim)] px-1">
          <Info size={13} className="shrink-0 mt-0.5" />
          <span>Total invested is buys minus sells; switches move money between funds and are never counted as investment. Total gain is current value minus total invested, so it includes gains realised through switches. XIRR is the money-weighted annual return from every recorded purchase and redemption. CAGR uses the amount-weighted average purchase date as its start, so later top-ups shorten the holding period rather than being ignored. Both are N/A for holdings added as an opening balance less than a year ago; edit that transaction and set the real first purchase date. Below ATH compares each fund's NAV to its own all-time high.</span>
        </p>}
      </div>
    </div>
  )
}

// ── Left filter panel ──
function FilterPanel({ members, memberSel, onToggleMember, onAllMembers, portfolios, portfolioSel, onTogglePortfolio, onAllPortfolios, showOwner, hideAmounts, onToggleHide, present, onTogglePresent, onClear, activeCount }) {
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
        <Toggle on={hideAmounts} onClick={onToggleHide} icon={hideAmounts ? <EyeOff size={14} className="text-amber-400" /> : <Eye size={14} className="text-[var(--text-dim)]" />} label="Hide amounts" />
        <Toggle on={present} onClick={onTogglePresent} icon={<Presentation size={14} className={present ? 'text-amber-400' : 'text-[var(--text-dim)]'} />} label="Present mode" hint="Bigger type, fewer details" />
      </Section>
    </div>
  )
}

function TabButton({ active, onClick, label, icon }) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${active ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}>
      {icon} {label}
    </button>
  )
}

function Toggle({ on, onClick, icon, label, hint }) {
  return (
    <button onClick={onClick} aria-label={label} aria-pressed={on} className="w-full flex items-center justify-between gap-2 px-1 py-1.5 text-sm text-[var(--text-primary)]">
      <span className="flex items-center gap-2 min-w-0">{icon}<span className="min-w-0"><span className="block truncate">{label}</span>{hint && <span className="block text-[11px] text-[var(--text-dim)]">{hint}</span>}</span></span>
      <span className={`w-8 h-[18px] rounded-full relative transition-colors shrink-0 ${on ? 'bg-violet-500' : 'bg-[var(--bg-inset)] border border-[var(--border)]'}`}>
        <span className={`absolute top-[2px] w-[12px] h-[12px] rounded-full bg-white transition-all ${on ? 'left-[16px]' : 'left-[2px]'}`} />
      </span>
    </button>
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
// Same markup as StatCard on the Mutual Funds page
function Stat({ label, value, sub, positive, bold, title, sz }) {
  return (
    <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] px-4 py-3" title={title}>
      <p className="text-xs text-[var(--text-dim)] uppercase tracking-wider mb-1">{label}</p>
      <p className={`${sz?.stat || 'text-sm'} tabular-nums ${bold ? 'font-bold' : 'font-semibold'} ${
        positive === undefined ? 'text-[var(--text-primary)]' : positive ? 'text-emerald-400' : 'text-[var(--accent-rose)]'
      }`}>
        {value}
      </p>
      {sub && (
        <p className={`text-xs font-semibold tabular-nums mt-0.5 ${positive ? 'text-emerald-400' : 'text-[var(--accent-rose)]'}`}>
          {sub}
        </p>
      )}
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

function athTextClass(p) {
  if (p >= 20) return 'text-[var(--accent-rose)] font-bold'
  if (p >= 10) return 'text-[var(--accent-orange)] font-bold'
  if (p >= 5) return 'text-[var(--accent-amber)] font-semibold'
  if (p >= 1) return 'text-yellow-500 font-semibold'
  return 'text-[var(--text-dim)]'
}
function ATHBadge({ fund, cls = 'text-xs' }) {
  if (!(fund.athNav > 0)) return <span className={`${cls} text-[var(--text-dim)]`}>—</span>
  return (
    <span className={`${cls} tabular-nums ${athTextClass(fund.belowATHPct)}`}>
      {fund.belowATHPct <= 0 ? 'At ATH' : `↓${fund.belowATHPct.toFixed(1)}%`}
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

function BreakdownCard({ mode, rows, amt, hideAmounts, sz, quiet }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
      {/* Desktop table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className={`w-full ${sz?.cell || 'text-sm'}`}>
          <thead>
            <tr className="border-b border-[var(--border-light)] bg-[var(--bg-inset)] text-xs text-[var(--text-muted)] uppercase tracking-wider">
              <th className="text-left py-2 px-3 font-semibold">{mode === 'member' ? 'Member' : 'Portfolio'}</th>
              <th className="text-right py-2 px-3 font-semibold whitespace-nowrap">
                <div>Amount</div>
                <div className="text-xs font-medium normal-case tracking-normal text-[var(--text-dim)]">Current / Invested</div>
              </th>
              <th className="text-right py-2 px-3 font-semibold whitespace-nowrap">Gain</th>
              <th className="text-right py-2 px-3 font-semibold whitespace-nowrap">XIRR</th>
              {!quiet && <th className="text-right py-2 px-3 font-semibold whitespace-nowrap">CAGR</th>}
              <th className="text-right py-2 px-3 font-semibold whitespace-nowrap">Share</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id} className="border-b border-[var(--border-light)] last:border-0">
                <td className={`${sz?.row || 'py-2.5'} px-3`}>
                  <span className={`${sz?.name || 'text-sm'} font-semibold text-[var(--text-primary)]`}>{r.name}</span>
                  {!quiet && <p className="text-xs text-[var(--text-dim)]">{mode === 'member' ? `${r.portfolioCount} portfolio${r.portfolioCount === 1 ? '' : 's'}` : r.ownerName} · {r.fundCount} fund{r.fundCount === 1 ? '' : 's'}</p>}
                </td>
                <td className={`${sz?.row || 'py-2.5'} px-3 text-right whitespace-nowrap ${sz?.num || 'text-xs'} tabular-nums`}>
                  <span className="font-semibold text-[var(--text-primary)]">{amt(r.current)}</span>
                  <span className="text-[var(--text-dim)]"> / {amt(r.invested)}</span>
                </td>
                <td className={`${sz?.row || 'py-2.5'} px-3 text-right whitespace-nowrap`}>
                  {!hideAmounts && <span className={`${sz?.num || 'text-xs'} font-semibold tabular-nums ${plClass(r.gain)}`}>{r.gain >= 0 ? '+' : ''}{formatINR(r.gain)}</span>}
                  <span className={`${sz?.num || 'text-xs'} tabular-nums ${hideAmounts ? `font-semibold ${plClass(r.gain)}` : `ml-1 ${r.gain >= 0 ? 'text-emerald-400/60' : 'text-[var(--accent-rose)]/60'}`}`}>{hideAmounts ? pct(r.gainPct) : `(${pct(r.gainPct)})`}</span>
                </td>
                <td className={`${sz?.row || 'py-2.5'} px-3 text-right ${sz?.num || 'text-xs'} font-semibold tabular-nums ${plClass(r.xirr)}`} title={reasonLong(r.returnsReason)}>{ratePct(r.xirr)}</td>
                {!quiet && <td className={`${sz?.row || 'py-2.5'} px-3 text-right ${sz?.num || 'text-xs'} font-semibold tabular-nums ${plClass(r.cagr)}`} title={reasonLong(r.returnsReason)}>{ratePct(r.cagr)}</td>}
                <td className={`${sz?.row || 'py-2.5'} px-3 text-right ${sz?.num || 'text-xs'} text-[var(--text-secondary)] tabular-nums`}>{r.weight.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile rows */}
      <div className="sm:hidden divide-y divide-[var(--border-light)]">
        {rows.map((r) => (
          <div key={r.id} className="px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{r.name}</p>
              <p className="text-sm font-bold tabular-nums text-[var(--text-primary)] shrink-0">{amt(r.current)}</p>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs tabular-nums">
              <span className="text-[var(--text-dim)]">Inv {amt(r.invested)}</span>
              <span className={plClass(r.gain)}>{hideAmounts ? '' : `${r.gain >= 0 ? '+' : ''}${formatINR(r.gain)} `}{pct(r.gainPct)}</span>
              <span className={plClass(r.xirr)}>XIRR {ratePct(r.xirr)}</span>
              <span className="text-[var(--text-dim)]">{r.weight.toFixed(1)}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Expanded row: a few facts + per-portfolio split ──
function FundDetail({ fund, amt, hideAmounts, onOpen, compact }) {
  const { plan } = splitFundName(fund.fundName)
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--text-dim)] tabular-nums">
          <CategoryTag category={fund.category} />
          {plan && <span>{plan}</span>}
          <span>{fund.units.toFixed(3)} units</span>
          <span>NAV ₹{fund.currentNav.toFixed(2)} · avg ₹{fund.avgNav.toFixed(2)}</span>
          {fund.athNav > 0 && <span>ATH ₹{fund.athNav.toFixed(2)}</span>}
          {fund.ongoingSIP > 0 && <span>SIP {amt(fund.ongoingSIP)}/mo</span>}
          {fund.cagr != null && <span>CAGR <span className={plClass(fund.cagr)}>{ratePct(fund.cagr)}</span> over {holdingSince(fund.cagrSince || fund.since)}</span>}
        </div>
        <button onClick={(e) => { e.stopPropagation(); onOpen() }} className="text-xs font-medium text-violet-400 hover:text-violet-300">Open in Mutual Funds →</button>
      </div>

      {compact ? (
        <div className="space-y-2">
          {fund.positions.map((p) => (
            <div key={p.portfolioId} className="rounded-lg border border-[var(--border-light)] bg-[var(--bg-card)] px-3 py-2 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{p.portfolioName}</p>
                <p className="text-[10px] text-[var(--text-dim)]">{p.ownerName} · inv {amt(p.invested)}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs font-bold text-[var(--text-primary)] tabular-nums">{amt(p.currentValue)}</p>
                <p className={`text-[11px] font-semibold tabular-nums ${plClass(p.pl)}`}>{pct(p.plPct)} · XIRR {ratePct(p.xirr)}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-[var(--border-light)] bg-[var(--bg-card)] px-3 py-2">
        <table className="w-full text-xs whitespace-nowrap">
          <thead>
            <tr className="text-[var(--text-dim)] uppercase tracking-wider">
              <th className="text-left py-1 pr-3 font-semibold">Portfolio</th>
              <th className="text-left py-1 pr-3 font-semibold">Member</th>
              <th className="text-right py-1 pr-3 font-semibold">Current / Invested</th>
              <th className="text-right py-1 pr-3 font-semibold">Gain</th>
              <th className="text-right py-1 font-semibold">XIRR</th>
            </tr>
          </thead>
          <tbody>
            {fund.positions.map((p) => (
              <tr key={p.portfolioId} className="border-t border-[var(--border-light)]">
                <td className="py-1.5 pr-3 text-[var(--text-primary)] font-medium">{p.portfolioName}</td>
                <td className="py-1.5 pr-3 text-[var(--text-muted)]">{p.ownerName}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums"><span className="font-semibold text-[var(--text-primary)]">{amt(p.currentValue)}</span><span className="text-[var(--text-dim)]"> / {amt(p.invested)}</span></td>
                <td className={`py-1.5 pr-3 text-right tabular-nums font-semibold ${plClass(p.pl)}`}>{hideAmounts ? '' : `${p.pl >= 0 ? '+' : ''}${formatINR(p.pl)} `}{pct(p.plPct)}</td>
                <td className={`py-1.5 text-right tabular-nums font-semibold ${plClass(p.xirr)}`} title={reasonLong(p.returnsReason)}>{ratePct(p.xirr)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
    </div>
  )
}
