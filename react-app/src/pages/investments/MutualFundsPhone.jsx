// Mutual Funds on phones, built with Ionic components (Material look, Capital Friends colours, Groww-style layout).
// Same data and the same dialogs as the desktop page (MutualFundsPage passes everything in); only the layout differs.
// The open portfolio / fund lives in the URL (?p=…&f=…), so the phone's Back button and swipe-back work.
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom'
import {
  IonCard, IonCardContent, IonLabel, IonSegment, IonSegmentButton, IonList, IonItem, IonButton,
  IonActionSheet, IonPopover, IonContent, IonModal, IonListHeader, IonToggle, IonRippleEffect,
} from '@ionic/react'
import { useMask } from '../../context/MaskContext'
import '../../phone/ionic-setup'
import { FileUp, Plus, MoreVertical, Repeat2, TrendingDown, Scale, Target, ChevronRight, ArrowDownLeft, ArrowUpRight, Lock, Trash2, X, List as ListIcon, Eye, EyeOff, LineChart } from 'lucide-react'
import { formatINR, splitFundName } from '../../data/familyData'
import { useData } from '../../context/DataContext'
import { buildFundsModel } from '../../utils/fundsDashboard'

/** XIRR / CAGR of each holding (one fund in one portfolio), from its own transactions: { 'PFL::code': position } */
function usePositionReturns(funds) {
  const { mfPortfolios, mfTransactions } = useData()
  return useMemo(() => {
    const out = {}
    try {
      const m = buildFundsModel({ portfolios: mfPortfolios || [], holdings: funds || [], transactions: mfTransactions || [], withBreakdown: false })
      for (const f of m.funds || []) for (const p of f.positions || []) out[`${p.portfolioId}::${f.schemeCode}`] = p
    } catch { /* returns are extra: the list works without them */ }
    return out
  }, [funds, mfPortfolios, mfTransactions])
}
const posKey = (h) => `${h.portfolioId}::${String(h.schemeCode || h.fundCode || '')}`
const rate = (x) => (x == null ? '—' : `${x >= 0 ? '+' : ''}${(x * 100).toFixed(1)}%`)
import { folioOf, maskFolio } from '../../utils/folio'
import JourneyChartLW from '../../components/JourneyChart'
import { Screen, FadeIn, setPhoneBar } from '../../components/native'
import { Lead, FundLead, PortfolioLead } from '../../phone/LeadIcon'

const pctTxt = (v) => `${v >= 0 ? '+' : '−'}${Math.abs(v || 0).toFixed(2)}%`
const upCls = (v) => (v >= 0 ? 'text-emerald-400' : 'text-rose-400')
const signed = (v) => `${v >= 0 ? '+' : '−'}${formatINR(Math.abs(v))}`
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default function MutualFundsPhone(props) {
  const { portfolioData, enrichedHoldings, setSelectedPortfolioId, selectedPortfolioId } = props
  const [sp, setSp] = useSearchParams()
  const navigate = useNavigate()
  const pid = sp.get('p'), fkey = sp.get('f')
  useEffect(() => { setSelectedPortfolioId(pid || 'all') }, [pid, setSelectedPortfolioId])
  const location = useLocation()
  // Back goes one level up: fund (or its chart) → its portfolio → all portfolios. When we opened the screen
  // ourselves the previous page is that parent, so the phone's own Back and this arrow do the same thing.
  const back = () => {
    if (location.state?.cfFrom != null) return navigate(-1)
    const v = sp.get('v')
    const up = v && fkey ? { p: pid, f: fkey } : fkey && pid ? { p: pid } : {}
    setSp(up, { replace: true })
  }
  const open = (q) => setSp(q, { state: { cfFrom: sp.toString() } })
  const portfolio = pid ? portfolioData.find((p) => p.portfolioId === pid) : null
  const ready = (pid || 'all') === selectedPortfolioId
  const fund = fkey && ready ? enrichedHoldings.find((h) => h._key === fkey) : null
  const view = sp.get('v')
  if (view === 'growth' && ready) {
    if (fkey && fund) { const tx = props.allFilteredTxns.filter((t) => String(t.fundCode) === String(fund.schemeCode || fund.fundCode) && t.portfolioId === fund.portfolioId); const jj = props.journeyOf(tx, fund.currentValue); return <GrowthScreen title={splitFundName(fund.fundName).main} back={back} data={jj.data} txns={jj.vt} stats={{ current: fund.currentValue, totalPL: fund.pl, totalPLPct: fund.plPct }} /> }
    if (!fkey) return <GrowthScreen title={portfolio ? props.dn(portfolio.portfolioName) : 'All mutual funds'} back={back} data={props.insights?.timeline} txns={props.insights?.valueTxns} breakdown={props.breakdown} stats={props.stats} />
  }
  if (fkey && fund && view !== 'growth') return <FundScreen key={fkey} {...props} h={fund} portfolio={portfolio} back={back} openGrowth={() => open({ p: fund.portfolioId, f: fkey, v: 'growth' })} />
  if (pid && portfolio && ready && !fkey && !view) return <PortfolioScreen key={pid} {...props} p={portfolio} back={back} open={open} />
  if (pid || fkey || view) return null
  return <RootScreen {...props} open={open} />
}

// ── shared pieces ──
function SplitCard({ breakdown, onOpen }) {
  const list = breakdown?.assetList || []
  if (!list.length) return null
  return (
    <IonCard button className="cf-card" onClick={onOpen}>
      <IonCardContent>
        <div className="flex items-center justify-between"><span className="text-[14px] font-semibold text-[var(--ion-text-color)]">Asset split</span><ChevronRight size={18} className="text-[var(--ion-color-medium)]" /></div>
        <div className="mt-2.5 flex h-2.5 rounded-full overflow-hidden gap-[2px]">{list.map((a) => <span key={a.name} style={{ width: `${a.pct}%`, background: a.fill }} />)}</div>
        <div className="mt-2.5 flex flex-wrap gap-x-3.5 gap-y-1">{list.slice(0, 4).map((a) => <span key={a.name} className="flex items-center gap-1.5 text-[12px]"><span className="w-2 h-2 rounded-full" style={{ background: a.fill }} /><span className="text-[var(--ion-color-medium)]">{a.name}</span><b className="text-[var(--ion-text-color)]">{a.pct.toFixed(0)}%</b></span>)}</div>
      </IonCardContent>
    </IonCard>
  )
}

function SplitSheet({ open, onClose, breakdown }) {
  const part = (title, list) => list?.length ? (
    <>
      <IonListHeader><IonLabel className="cf-group">{title}</IonLabel></IonListHeader>
      <IonList inset lines="inset" className="cf-inset">
        {list.map((a) => (
          <IonItem key={a.name}>
            <IonLabel>
              <div className="flex justify-between text-[15px]"><span>{a.name}</span><b className="tabular-nums">{a.pct.toFixed(1)}%</b></div>
              <div className="mt-1.5 h-1.5 rounded-full bg-[var(--ion-color-step-100)]"><div className="h-full rounded-full" style={{ width: `${a.pct}%`, background: a.fill }} /></div>
            </IonLabel>
          </IonItem>
        ))}
      </IonList>
    </>
  ) : null
  return (
    <IonModal isOpen={open} onDidDismiss={onClose} breakpoints={[0, 0.7, 1]} initialBreakpoint={0.7} handle className="cf-sheet">
      <IonContent>
        <div className="flex items-center justify-between px-4 pt-3"><h2 className="text-[20px] font-bold">Asset split</h2><IonButton fill="clear" color="medium" onClick={onClose}><X size={22} /></IonButton></div>
        {part('Asset class', breakdown?.assetList)}
        {part('Market cap (equity)', breakdown?.capList)}
        {part('Geography (equity)', breakdown?.geoList)}
        {!breakdown?.hasDetailedAlloc && <p className="px-5 pt-3 text-[13px] text-[var(--ion-color-medium)]">Estimated from fund categories. Add each fund's split in Fund breakdown for exact numbers.</p>}
        <div className="h-10" />
      </IonContent>
    </IonModal>
  )
}

/** Holdings list, Groww style: flat rows, fund name on the left, current value or returns on the right (tap the
 *  header to switch). Tapping a fund opens the quick-action sheet. */
const MODES = [['current', 'Current (Invested)'], ['returns', 'Returns (%)'], ['xirr', 'XIRR (CAGR)']]
// 'On target' when within 2 points of the target, otherwise the share now vs the target, in amber
function targetSub(h) {
  const t = h.targetAllocationPct || 0
  if (!(t > 0)) return null
  const now = h.currentAllocationPct || 0
  if (Math.abs(now - t) <= 2) return <span className="text-[var(--ion-color-medium)]">✓ On target · {t.toFixed(0)}%</span>
  return <span className="text-amber-400">{now.toFixed(0)}% now · target {t.toFixed(0)}%</span>
}
function Holdings({ funds, sub, onOpen }) {
  // like Groww: tap the column title (or any number on the right) to switch what the right side shows
  const [mode, setMode] = useState(() => { try { return localStorage.getItem('cf-mf-col2') || 'current' } catch { return 'current' } })
  const next = () => { const i = MODES.findIndex(([m]) => m === mode); const m = MODES[(i + 1) % MODES.length][0]; setMode(m); try { localStorage.setItem('cf-mf-col2', m) } catch { /* ignore */ } }
  const ret = usePositionReturns(funds)
  return (
    <>
      <div className="flex items-center justify-between px-1 pt-4 pb-1">
        <span className="text-[13px] text-[var(--ion-color-medium)]">{funds.length} fund{funds.length === 1 ? '' : 's'}</span>
        <button type="button" onClick={next} className="flex items-center gap-1.5 rounded-full border border-[var(--ion-border-color)] px-3 py-1 text-[13px] font-semibold text-[var(--ion-text-color)]" aria-label="Switch what the numbers show">
          <span className="text-[var(--ion-color-medium)]">‹ ›</span><span>{MODES.find(([m]) => m === mode)?.[1]}</span>
        </button>
      </div>
      <IonList lines="full" className="cf-flat">
        {funds.map((h) => {
          const n = splitFundName(h.fundName)
          const below = Math.round((h.belowATHPct || 0) * 10) / 10
          return (
            <IonItem key={h._key} button detail={false} onClick={() => onOpen(h)}>
              <FundLead h={h} />
              <IonLabel className="!my-3.5">
                <h3 className="!text-[15px] !font-medium !whitespace-normal !leading-snug">{n.main}</h3>
                <p className="!flex !flex-wrap !items-center !gap-x-1.5 !gap-y-1 !mt-1">
                  {sub && <span>{sub(h)}</span>}
                  {below >= 5 && <span className="px-1.5 rounded bg-slate-500/15 text-[var(--ion-color-medium)] text-[11px] font-semibold">{below.toFixed(0)}% below high</span>}
                  {h.ongoingSIP > 0 && <span className="px-1.5 rounded bg-sky-500/15 text-sky-400 text-[11px] font-semibold">SIP</span>}
                </p>
              </IonLabel>
              <div slot="end" className="ml-2 shrink-0 text-right tabular-nums" onClick={(e) => { e.stopPropagation(); next() }}>
                {mode === 'returns'
                  ? <><div className="text-[15px] font-semibold text-[var(--ion-text-color)]">{signed(h.pl)}</div><div className={`mt-0.5 text-[12.5px] font-semibold ${upCls(h.pl)}`}>({pctTxt(h.plPct)})</div></>
                  : mode === 'current'
                    ? <><div className="text-[15px] font-semibold text-[var(--ion-text-color)]">{formatINR(h.currentValue)}</div><div className="mt-0.5 text-[12.5px] text-[var(--ion-color-medium)]">({formatINR(h.investment)})</div></>
                    : (() => { const r = ret[posKey(h)]; return <><div className={`text-[15px] font-semibold ${r?.xirr == null ? 'text-[var(--ion-color-medium)]' : upCls(r.xirr)}`}>{r?.xirr == null ? 'N/A' : rate(r.xirr)}</div><div className={`mt-0.5 text-[12.5px] font-semibold ${r?.cagr == null ? 'text-[var(--ion-color-medium)]' : upCls(r.cagr)}`}>({r?.cagr == null ? (r?.xirr == null ? formatINR(h.currentValue) : 'N/A') : rate(r.cagr)})</div></> })()}
              </div>
            </IonItem>
          )
        })}
      </IonList>
    </>
  )
}

/** Quick actions for one fund, like tapping a holding in Groww. */
function FundSheet({ h, onClose, onDetails, setModal }) {
  const n = h ? splitFundName(h.fundName) : {}
  const act = (fn) => { onClose(); setTimeout(fn, 250) }
  const both = h?.lumpsumRestricted && h?.sipRestricted
  return (
    <IonModal isOpen={!!h} onDidDismiss={onClose} breakpoints={[0, 1]} initialBreakpoint={1} handle className="cf-sheet cf-auto-sheet">
      {h && (
        <div className="cf-auto-body">
          <IonList lines="full" className="cf-flat">
            <IonItem button detail onClick={() => act(onDetails)}>
              <FundLead h={h} />
              <IonLabel className="!my-4"><h2 className="!text-[16px] !font-semibold !whitespace-normal">{n.main}</h2>{n.plan && <p>{n.plan}</p>}</IonLabel>
              <div slot="end" className="text-[17px] font-bold tabular-nums text-[var(--ion-text-color)]">{formatINR(h.currentValue)}</div>
            </IonItem>
            <IonItem button detail={false} onClick={() => act(() => setModal({ redeem: { portfolioId: h.portfolioId, fundCode: h.schemeCode } }))}>
              <span slot="start" className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--ion-color-step-150)]"><ArrowUpRight size={18} /></span><IonLabel>Redeem</IonLabel>
            </IonItem>
            <IonItem button detail={false} onClick={() => act(() => setModal({ switchFunds: h.portfolioId }))}>
              <span slot="start" className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--ion-color-step-150)]"><Repeat2 size={18} /></span><IonLabel>Switch</IonLabel>
            </IonItem>
            <IonItem button detail={false} onClick={() => act(onDetails)}>
              <span slot="start" className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--ion-color-step-150)]"><ListIcon size={18} /></span><IonLabel>Investment details</IonLabel>
            </IonItem>
          </IonList>
          {!both && (
            <div className="flex gap-3 px-4 pt-4" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}>
              {!h.lumpsumRestricted && <IonButton expand="block" className="flex-1 cf-soft-btn" onClick={() => act(() => setModal({ invest: { portfolioId: h.portfolioId, fundCode: h.schemeCode, fundName: h.fundName, type: 'LUMPSUM' } }))}>One time</IonButton>}
              {!h.sipRestricted && <IonButton expand="block" className="flex-1 cf-big-btn" onClick={() => act(() => setModal({ invest: { portfolioId: h.portfolioId, fundCode: h.schemeCode, fundName: h.fundName, type: 'SIP' } }))}>Record SIP</IonButton>}
            </div>
          )}
        </div>
      )}
    </IonModal>
  )
}

/** A fund's own split (equity / debt / gold..., market cap, India / global) as plain numbers, with Edit — the same
 *  data the laptop's Fund Breakdown tab saves (no charts on the phone). */
function FundSplitCard({ alloc, onEdit }) {
  const part = (o) => Object.entries(o || {}).map(([k, v]) => [k, Number(v) || 0]).filter(([, v]) => v > 0.05).sort((a, b) => b[1] - a[1])
  const rows = [['Asset class', part(alloc?.assetAllocation)], ['Market cap', part(alloc?.equityAllocation)], ['Where', part(alloc?.geoAllocation)]].filter(([, l]) => l.length)
  return (
    <div className="mt-3 rounded-2xl border border-[var(--ion-border-color)] bg-[var(--ion-item-background)] px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[16px] font-semibold text-[var(--ion-text-color)]">Fund breakdown</span>
        <button type="button" onClick={onEdit} className="rounded-full border border-[var(--ion-border-color)] px-3 py-1 text-[13px] font-semibold text-violet-400">{rows.length ? 'Edit' : 'Add'}</button>
      </div>
      {rows.length ? rows.map(([t, l]) => (
        <div key={t} className="mt-2.5">
          <div className="text-[12.5px] text-[var(--ion-color-medium)]">{t}</div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[14px] tabular-nums text-[var(--ion-text-color)]">{l.map(([k, v]) => <span key={k}>{k} <b className="font-semibold">{v.toFixed(v < 10 ? 1 : 0)}%</b></span>)}</div>
        </div>
      )) : <p className="mt-1.5 text-[13.5px] leading-snug text-[var(--ion-color-medium)]">Not set yet. Add how much is in equity, debt, gold..., which market caps and India / abroad (from the fund's page on morningstar.in → Portfolio). Until then the app guesses from the fund's category.</p>}
    </div>
  )
}

/** Tap a transaction: edit it or delete it (the same as the ⋮ menu on the laptop). */
function TxnSheet({ t, onClose, setModal, onDeleteTxn }) {
  return (
    <IonActionSheet isOpen={!!t} onDidDismiss={onClose} header={t ? `${splitFundName(t.fundName).main} · ${formatINR(t.totalAmount)}` : ''} buttons={[
      { text: 'Edit transaction', handler: () => setModal({ editTxn: t }) },
      onDeleteTxn && { text: 'Delete transaction', role: 'destructive', handler: () => onDeleteTxn(t.transactionId) },
      { text: 'Cancel', role: 'cancel' },
    ].filter(Boolean)} />
  )
}
function Activity({ txns, fundName = true, limit = 40, onTxn }) {
  const [n, setN] = useState(limit)
  const groups = useMemo(() => {
    const out = []
    for (const t of txns.slice(0, n)) {
      const d = parseD(t.date)
      const k = d ? `${MONTHS[d.getMonth()]} ${d.getFullYear()}` : 'Earlier'
      if (!out.length || out[out.length - 1].k !== k) out.push({ k, list: [] })
      out[out.length - 1].list.push({ ...t, d })
    }
    return out
  }, [txns, n])
  if (!txns.length) return <p className="py-10 text-center text-[14px] text-[var(--ion-color-medium)]">No transactions yet</p>
  return (
    <>
      {groups.map((g) => (
        <div key={g.k}>
          <IonListHeader className="!pl-1"><IonLabel className="cf-group">{g.k}</IonLabel></IonListHeader>
          <IonList inset lines="inset" className="cf-inset !mx-0">
            {g.list.map((t, i) => {
              const sell = String(t.type).toUpperCase() === 'SELL'
              const I = sell ? ArrowUpRight : ArrowDownLeft
              return (
                <IonItem key={t.transactionId || i} button={!!onTxn} detail={false} onClick={() => onTxn?.(t)}>
                  <span slot="start" className={`flex h-10 w-10 items-center justify-center rounded-full ${sell ? 'bg-rose-500/15 text-rose-400' : 'bg-emerald-500/15 text-emerald-400'}`}><I size={18} /></span>
                  <IonLabel>
                    <h3 className="!text-[15px] !font-semibold">{fundName ? splitFundName(t.fundName).main : label(t)}</h3>
                    <p>{fundName ? `${label(t)} · ` : ''}{t.d ? `${t.d.getDate()} ${MONTHS[t.d.getMonth()]}` : t.date}</p>
                  </IonLabel>
                  <div slot="end" className="text-right tabular-nums">
                    <p className="text-[15px] font-semibold text-[var(--ion-text-color)]">{sell ? '−' : ''}{formatINR(t.totalAmount)}</p>
                    <p className="text-[12px] text-[var(--ion-color-medium)]">{Number(t.units || 0).toFixed(2)} units</p>
                  </div>
                </IonItem>
              )
            })}
          </IonList>
        </div>
      ))}
      {txns.length > n && <IonButton expand="block" fill="clear" onClick={() => setN(n + 60)}>Show more</IonButton>}
    </>
  )
}
const label = (t) => {
  const tt = String(t.transactionType || '').toUpperCase()
  if (String(t.type).toUpperCase() === 'SELL') return tt === 'SWITCH' ? 'Switch out' : tt === 'SWP' ? 'SWP' : 'Redeemed'
  return tt === 'SIP' ? 'SIP' : tt === 'SWITCH' ? 'Switch in' : 'Lump sum'
}
function parseD(s) {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(s || '').trim())
  const d = m ? new Date(+m[3], +m[2] - 1, +m[1]) : new Date(s)
  return isNaN(d) ? null : d
}

// ── Groww-style pieces ──
/** Tabs right under the app bar (underline style), sticky while the page scrolls. */
function TopTabs({ value, onChange, options }) {
  return (
    <div className="cf-top-tabs-wrap -mx-4 -mt-2 mb-1">
      <IonSegment value={value} onIonChange={(e) => onChange(String(e.detail.value))} className="cf-top-tabs" scrollable>
        {options.map(([k, l, badge]) => <IonSegmentButton key={k} value={k}><IonLabel>{l}{badge > 0 && <span className="cf-tab-badge">{badge}</span>}</IonLabel></IonSegmentButton>)}
      </IonSegment>
    </div>
  )
}

/** HOLDINGS (n) card: value big, eye (hide numbers) and chart (growth page) buttons, then the returns rows. */
function HoldingsCard({ count, stats, returns, onChart }) {
  const { masked, toggleMask } = useMask()
  const navigate = useNavigate()
  return (
    <div className="mt-3 rounded-2xl border border-[var(--ion-border-color)] bg-[var(--ion-item-background)] px-4 pt-4 pb-2">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[12px] font-semibold tracking-[0.14em] text-[var(--ion-color-medium)]">HOLDINGS ({count})</div>
          <div className="mt-0.5 text-[28px] font-bold tracking-tight tabular-nums text-[var(--ion-text-color)]">{formatINR(stats.current)}</div>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={toggleMask} aria-label="Hide numbers" className="ion-activatable relative overflow-hidden flex h-10 w-10 items-center justify-center rounded-full border border-[var(--ion-color-step-200)] text-[var(--ion-text-color)]">{masked ? <EyeOff size={18} /> : <Eye size={18} />}<IonRippleEffect /></button>
          {onChart && <button type="button" onClick={onChart} aria-label="Growth chart" className="ion-activatable relative overflow-hidden flex h-10 w-10 items-center justify-center rounded-full border border-[var(--ion-color-step-200)] text-[var(--ion-text-color)]"><LineChart size={18} /><IonRippleEffect /></button>}
        </div>
      </div>
      <Dash />
      <KV k="Total returns" v={`${signed(stats.totalPL)} (${pctTxt(stats.totalPLPct)})`} cls={upCls(stats.totalPL)} />
      {/* same numbers as the web stat cards: unrealised (still held) + realised (booked) = total */}
      <KV k="Unrealised P&L" sub="on holdings" v={`${signed(stats.unrealizedPL || 0)} (${pctTxt(stats.unrealizedPLPct || 0)})`} cls={upCls(stats.unrealizedPL || 0)} />
      <KV k="Realised P&L" sub="booked" v={signed(stats.realizedPL || 0)} cls={upCls(stats.realizedPL || 0)} />
      <Dash />
      <KV k="Your money in" v={formatINR(stats.invested)} />
      {stats.holdingsCost > 0 && Math.abs(stats.holdingsCost - stats.invested) >= 1 && <KV k="Holdings cost" v={formatINR(stats.holdingsCost)} cls="text-[var(--ion-color-medium)]" />}
      <KV k="XIRR / CAGR" v={returns?.xirr == null && returns?.cagr == null ? <button type="button" onClick={() => navigate('/import')} className="text-[14px] font-semibold text-violet-400">Import CAS for XIRR ›</button> : `${returns?.xirr == null ? 'N/A' : `${(returns.xirr * 100).toFixed(2)}%`} / ${returns?.cagr == null ? 'N/A' : `${(returns.cagr * 100).toFixed(2)}%`}`} />
      <KV k="Monthly SIP" sub={stats.sipFunds > 0 ? `· ${stats.sipFunds} fund${stats.sipFunds > 1 ? 's' : ''}` : undefined} v={formatINR(stats.monthlySIP)} />
    </div>
  )
}

/** Below high / rebalance as tappable rows (not chips). */
const importRow = (navigate) => [FileUp, 'Import CAMS statement', 'Every purchase, SIP and switch since day one: exact invested, XIRR', '#a78bfa', () => navigate('/import')]
const nSignals = (ind) => (ind?.buyOpp > 0 ? 1 : 0) + (ind?.rebalance > 0 ? 1 : 0)
function SignalRows({ ind, onBuy, onRebalance, extra = [], empty }) {
  const rows = [
    ind.buyOpp > 0 && [TrendingDown, `${ind.buyOpp} fund${ind.buyOpp === 1 ? '' : 's'} below high`, 'Funds well below their all-time high', '#34d399', onBuy],
    ind.rebalance > 0 && [Scale, `${ind.rebalance} fund${ind.rebalance === 1 ? '' : 's'} to rebalance`, 'Split has drifted from the target', '#a78bfa', onRebalance],
    ...extra,
  ].filter(Boolean)
  if (!rows.length) return empty || null
  return (
    <IonList lines="full" className="cf-flat -mx-4 mt-2">
      {rows.map(([I, t, sub, c, fn]) => (
        <IonItem key={t} button detail onClick={fn}>
          <span slot="start" className="flex h-9 w-9 items-center justify-center rounded-full" style={{ background: `${c}22`, color: c }}><I size={18} /></span>
          <IonLabel className="!my-3"><h3 className="!text-[15px] !font-semibold">{t}</h3><p>{sub}</p></IonLabel>
        </IonItem>
      ))}
    </IonList>
  )
}

// ── 1. all portfolios ──
function RootScreen({ portfolioData, portfolioIndicators, currentIndicators, stats, returns, enrichedHoldings, allFilteredTxns, setModal, open, dn, mv, onDeleteTxn }) {
  const navigate = useNavigate()
  const [txn, setTxn] = useState(null)
  const [tab, setTab] = useState('portfolios')
  const [sheet, setSheet] = useState(null)
  const [add, setAdd] = useState(false)
  useEffect(() => {
    setPhoneBar({ right: <IonButton className="cf-icon-btn" onClick={() => setAdd(true)} aria-label="Add"><Plus size={24} /></IonButton> })
    return () => setPhoneBar(null)
  }, [])
  const pname = Object.fromEntries(portfolioData.map((p) => [p.portfolioId, dn(p.portfolioName)]))
  const funds = enrichedHoldings.filter((h) => h.units > 0).sort((a, b) => b.currentValue - a.currentValue)
  return (
    <div className="pb-6">
      <TopTabs value={tab} onChange={setTab} options={[['portfolios', 'Portfolios'], ['holdings', 'Holdings'], ['actions', 'Actions', nSignals(currentIndicators)], ['activity', 'History']]} />
      <FadeIn k={tab}>
        {tab === 'holdings' && (<>
          <HoldingsCard count={funds.length} stats={stats} returns={returns} onChart={() => open({ v: 'growth' })} />
          <div className="-mx-4"><div className="px-4"><Holdings funds={funds} sub={(h) => pname[h.portfolioId]} onOpen={(h) => open({ p: h.portfolioId, f: h._key })} /></div></div>
        </>)}
        {tab === 'actions' && (<>
          <SignalRows ind={currentIndicators} onBuy={() => setModal('buyOpp')} onRebalance={() => setModal('rebalance')}
            empty={<p className="pt-6 pb-2 text-center text-[14px] text-[var(--ion-color-medium)]">✓ Nothing to do: no fund far below its high, no split off its target.</p>} />
          <IonListHeader className="!pl-1 mt-2"><IonLabel className="cf-group">Keep it exact</IonLabel></IonListHeader>
          <SignalRows ind={{}} extra={[importRow(navigate)]} />
        </>)}
        {tab === 'portfolios' && (<>
          <HoldingsCard count={funds.length} stats={stats} returns={returns} onChart={() => open({ v: 'growth' })} />
          <IonList lines="full" className="cf-flat -mx-4 mt-2">
            {portfolioData.filter((p) => !p.closed).map((p) => {
              const ind = portfolioIndicators[p.portfolioId] || {}
              const pl = (p.unrealizedPL || 0) + (p.realizedPL || 0)
              const n = p.holdings.filter((h) => h.units > 0).length
              return (
                <IonItem key={p.portfolioId} button detail onClick={() => open({ p: p.portfolioId })}>
                  <PortfolioLead />
                  <IonLabel className="!my-3.5">
                    <h3 className="!text-[16px] !font-semibold !whitespace-normal !leading-snug">{dn(p.portfolioName)}</h3>
                    <p className="!whitespace-normal">{mv(p.ownerName, 'name')} · {n} fund{n === 1 ? '' : 's'}</p>
                    {(ind.buyOpp > 0 || ind.rebalance > 0) && <p className="!mt-1.5 !flex !flex-wrap gap-1.5">{ind.buyOpp > 0 && <span className="whitespace-nowrap rounded px-1.5 py-0.5 text-[11.5px] font-semibold bg-slate-500/15 text-[var(--ion-color-medium)]">{ind.buyOpp} below high</span>}{ind.rebalance > 0 && <span className="whitespace-nowrap rounded px-1.5 py-0.5 text-[11.5px] font-semibold bg-violet-500/15 text-violet-300">{ind.rebalance} to rebalance</span>}</p>}
                  </IonLabel>
                  <div slot="end" className="text-right tabular-nums">
                    <div className="text-[15px] font-semibold text-[var(--ion-text-color)]">{formatINR(p.currentValue)}</div>
                    <div className={`text-[12px] font-semibold ${upCls(pl)}`}>{pctTxt(p.totalInvestment > 0 ? (pl / p.totalInvestment) * 100 : 0)}</div>
                  </div>
                </IonItem>
              )
            })}
          </IonList>
          {/* closed portfolios (everything sold): listed apart with their realized profit, which still counts in the totals */}
          {portfolioData.some((p) => p.closed) && (<>
            <IonListHeader className="!pl-1 mt-3"><IonLabel className="cf-group">Closed · everything sold</IonLabel></IonListHeader>
            <IonList lines="full" className="cf-flat -mx-4">
              {portfolioData.filter((p) => p.closed).map((p) => {
                const r = Number(p.realizedPL) || 0
                return (
                  <IonItem key={p.portfolioId} button detail onClick={() => open({ p: p.portfolioId })}>
                    <IonLabel className="!my-3">
                      <h3 className="!text-[15px] !whitespace-normal !leading-snug text-[var(--ion-color-medium)]">{dn(p.portfolioName)}</h3>
                      <p className="!whitespace-normal">{mv(p.ownerName, 'name')} · all sold</p>
                    </IonLabel>
                    <div slot="end" className="text-right tabular-nums">
                      <div className={`text-[14px] font-semibold ${upCls(r)}`}>{r >= 0 ? '+' : ''}{formatINR(r)}</div>
                      {p.grossBuys > 0 && <div className={`text-[12px] ${upCls(r)}`}>{pctTxt((r / p.grossBuys) * 100)}</div>}
                    </div>
                  </IonItem>
                )
              })}
            </IonList>
          </>)}
        </>)}
        {tab === 'activity' && <Activity txns={allFilteredTxns} onTxn={setTxn} />}
      </FadeIn>

      <IonActionSheet isOpen={add} onDidDismiss={() => setAdd(false)} header="Add" buttons={[
        { text: 'Import CAMS statement', handler: () => navigate('/import') },
        { text: 'Record an investment', handler: () => setModal({ invest: true }) },
        { text: 'Record a switch', handler: () => setModal({ switchFunds: true }) },
        { text: 'New portfolio', handler: () => setModal('addPortfolio') },
        { text: 'Cancel', role: 'cancel' },
      ]} />
      <FundSheet h={sheet} onClose={() => setSheet(null)} setModal={setModal} onDetails={() => open({ p: sheet.portfolioId, f: sheet._key })} />
      <TxnSheet t={txn} onClose={() => setTxn(null)} setModal={setModal} onDeleteTxn={onDeleteTxn} />
    </div>
  )
}

// ── 2. one portfolio ──
function PortfolioScreen({ p, back, open, stats, returns, enrichedHoldings, allFilteredTxns, currentIndicators, setModal, goalLinks, navigate, dn, mv, mt, onDeleteTxn }) {
  const [tab, setTab] = useState('holdings')
  const [txn, setTxn] = useState(null)
  const [menu, setMenu] = useState(false)
  const [sheet, setSheet] = useState(null)
  const right = useMemo(() => <IonButton className="cf-icon-btn" onClick={() => setMenu(true)} aria-label="More"><MoreVertical size={22} /></IonButton>, [])
  const funds = enrichedHoldings.filter((h) => h.units > 0).sort((a, b) => b.currentValue - a.currentValue)
  const goals = goalLinks[p.portfolioId] || []
  return (
    <Screen k={p.portfolioId} title={dn(p.portfolioName)} subtitle={`${mv(p.ownerName, 'name')} · ${p.platform}`} onBack={back} right={right}>
      <div className="pb-6">
        <TopTabs value={tab} onChange={setTab} options={[['holdings', 'Holdings'], ['actions', 'Actions', nSignals(currentIndicators)], ['goals', `Goals${goals.length ? ` (${goals.length})` : ''}`], ['activity', 'History']]} />
        <FadeIn k={tab}>
          {tab === 'actions' && (<>
            <SignalRows ind={currentIndicators} onBuy={() => setModal('buyOpp')} onRebalance={() => setModal({ rebalance: p.portfolioId })}
              empty={<p className="pt-6 pb-2 text-center text-[14px] text-[var(--ion-color-medium)]">✓ Nothing to do in this portfolio.</p>} />
            <IonListHeader className="!pl-1 mt-2"><IonLabel className="cf-group">Keep it exact</IonLabel></IonListHeader>
            <SignalRows ind={{}} extra={[importRow(navigate)]} />
          </>)}
          {tab === 'goals' && (goals.length
            ? <SignalRows ind={{}} extra={goals.map((g) => [Target, mt(g.goal.goalName), `${g.pct}% of this portfolio is for this goal`, '#38bdf8', () => navigate(`/goals/plan/${encodeURIComponent(g.goal.goalId)}`)])} />
            : <p className="py-10 text-center text-[14px] text-[var(--ion-color-medium)]">No goal uses this portfolio yet. Goals take money from it by themselves (Goals → Money for goals).</p>)}
          {tab === 'holdings' && (<>
            <HoldingsCard count={funds.length} stats={stats} returns={returns} onChart={() => open({ p: p.portfolioId, v: 'growth' })} />
            {funds.length
              ? <Holdings funds={funds} sub={targetSub} onOpen={(h) => open({ p: h.portfolioId, f: h._key })} />
              : <p className="py-10 text-center text-[14px] text-[var(--ion-color-medium)]">No funds yet</p>}
          </>)}
          {tab === 'activity' && <Activity txns={allFilteredTxns} onTxn={setTxn} />}
        </FadeIn>
      </div>
      <IonActionSheet isOpen={menu} onDidDismiss={() => setMenu(false)} header={dn(p.portfolioName)} buttons={[
        { text: 'Record an investment', handler: () => setModal({ invest: p.portfolioId }) },
        { text: 'Record a redemption', handler: () => setModal({ redeem: p.portfolioId }) },
        { text: 'Record a switch', handler: () => setModal({ switchFunds: p.portfolioId }) },
        { text: 'Move funds to another portfolio', handler: () => setModal({ moveFunds: p.portfolioId }) },
        { text: 'Target split', handler: () => setModal({ allocations: p.portfolioId }) },
        { text: 'Rebalance', handler: () => setModal({ rebalance: p.portfolioId }) },
        { text: 'Edit portfolio', handler: () => setModal({ editPortfolio: p }) },
        { text: 'Cancel', role: 'cancel' },
      ]} />
      <FundSheet h={sheet} onClose={() => setSheet(null)} setModal={setModal} onDetails={() => open({ p: p.portfolioId, f: sheet._key })} />
      <TxnSheet t={txn} onClose={() => setTxn(null)} setModal={setModal} onDeleteTxn={onDeleteTxn} />
    </Screen>
  )
}

// ── growth chart and split, on their own screen ──
function GrowthScreen({ title, back, data, txns, breakdown, stats }) {
  const [split, setSplit] = useState(false)
  return (
    <Screen k={'g' + title} title="Growth" subtitle={title} onBack={back}>
      <div className="pb-6">
        <div className="pt-2">
          <div className="text-[13px] text-[var(--ion-color-medium)]">Current value</div>
          <div className="text-[28px] font-bold tracking-tight tabular-nums">{formatINR(stats.current)}</div>
          <div className={`text-[14px] font-semibold ${upCls(stats.totalPL)}`}>{signed(stats.totalPL)} ({pctTxt(stats.totalPLPct)}) <span className="font-normal text-[var(--ion-color-medium)]">all time</span></div>
        </div>
        <div className="-mx-1 mt-4">{data?.length >= 2 ? <JourneyChartLW data={data} txns={txns} height={300} compact formatMoney={formatINR} /> : <p className="py-16 text-center text-[var(--ion-color-medium)]">Not enough history for a chart yet</p>}</div>
        <p className="mt-3 text-[12px] text-[var(--ion-color-medium)]">Drag a finger across the chart to see any day. Pinch to zoom.</p>
        {breakdown?.assetList?.length > 0 && <div className="-mx-4 mt-2"><SplitCard breakdown={breakdown} onOpen={() => setSplit(true)} /></div>}
      </div>
      <SplitSheet open={split} onClose={() => setSplit(false)} breakdown={breakdown} />
    </Screen>
  )
}

// ── 3. one fund (Groww-style "Investment details") ──
/** Long term (held over a year) and short term value of what is held now, first-in first-out. */
function holdingTerms(txns, nav) {
  const lots = []
  const list = txns.map((t) => ({ ...t, d: parseD(t.date) })).filter((t) => t.d).sort((a, b) => a.d - b.d)
  for (const t of list) {
    const u = Number(t.units) || 0
    if (String(t.type).toUpperCase() === 'SELL') {
      let left = u
      while (left > 1e-9 && lots.length) { const l = lots[0]; const take = Math.min(l.u, left); l.u -= take; left -= take; if (l.u <= 1e-9) lots.shift() }
    } else lots.push({ u, d: t.d })
  }
  const yearAgo = Date.now() - 365 * 864e5
  let lt = 0, st = 0
  for (const l of lots) (l.d.getTime() <= yearAgo ? (lt += l.u) : (st += l.u))
  return { lt: lt * nav, st: st * nav, ok: lots.length > 0 }
}
const shortDate = (d) => `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`

function KV({ k, v, cls = '', sub }) {
  return <div className="flex items-baseline justify-between gap-3 py-[7px]"><span className="text-[15px] text-[var(--ion-text-color)]">{k}{sub && <span className="text-[var(--ion-color-medium)]"> {sub}</span>}</span><span className={`text-[15px] font-semibold tabular-nums text-right ${cls || 'text-[var(--ion-text-color)]'}`}>{v}</span></div>
}
const Dash = () => <div className="my-2 border-t border-dashed border-[var(--ion-color-step-250)]" />

function FundScreen({ h, portfolio, back, openGrowth, allFilteredTxns, setModal, onToggleLump, onToggleSip, onDeleteFund, onDeleteTxn, dn }) {
  const [menu, setMenu] = useState(null)
  const [txn, setTxn] = useState(null)
  const [all, setAll] = useState(false)
  const n = splitFundName(h.fundName)
  const right = useMemo(() => <IonButton className="cf-icon-btn" onClick={(e) => setMenu(e.nativeEvent)} aria-label="More"><MoreVertical size={22} /></IonButton>, [])
  const invest = (type) => setModal({ invest: { portfolioId: h.portfolioId, fundCode: h.schemeCode, fundName: h.fundName, type } })
  const footer = useMemo(() => (h.lumpsumRestricted && h.sipRestricted) ? null : (
    <>
      {!h.lumpsumRestricted && <IonButton className="cf-soft-btn" onClick={() => invest('LUMPSUM')}>One time</IonButton>}
      {!h.sipRestricted && <IonButton className="cf-big-btn" onClick={() => invest('SIP')}>Record SIP</IonButton>}
    </>
  ), [h]) // eslint-disable-line react-hooks/exhaustive-deps
  const txns = allFilteredTxns.filter((t) => String(t.fundCode) === String(h.schemeCode || h.fundCode) && t.portfolioId === h.portfolioId)
  const below = Math.round((h.belowATHPct || 0) * 10) / 10
  const terms = holdingTerms(txns, Number(h.currentNav) || 0)
  const first = txns.map((t) => parseD(t.date)).filter(Boolean).sort((a, b) => a - b)[0]
  const held = first ? (() => { const m = Math.max(0, Math.round((Date.now() - first) / (30.44 * 864e5))); return `${Math.floor(m / 12) ? `${Math.floor(m / 12)} years ` : ''}${m % 12} months` })() : null
  const list = all ? txns : txns.slice(0, 8)
  const pos = usePositionReturns(useMemo(() => [h], [h]))[posKey(h)]
  const { assetAllocations } = useData()
  const code = String(h.schemeCode || h.fundCode || '')
  const alloc = (assetAllocations || []).find((a) => String(a.fundCode) === code)
  const folio = folioOf(txns)
  const { masked } = useMask()
  return (
    <Screen k={h._key} title="Investment details" onBack={back} right={right} footer={footer}>
      <div className="pb-4">
        <div className="pt-2">
          <div className="text-[18px] font-semibold leading-snug text-[var(--ion-text-color)]">{n.main}</div>
          <div className="text-[13px] text-[var(--ion-color-medium)] mt-0.5">{dn(portfolio?.portfolioName || '')}{n.plan ? ` · ${n.plan}` : ''}{held ? ` · invested for ${held}` : ''}</div>
        </div>

        <div className="mt-4 rounded-2xl border border-[var(--ion-border-color)] bg-[var(--ion-item-background)] px-4 pt-4 pb-3">
          <div className="text-[12px] font-semibold tracking-[0.14em] text-[var(--ion-color-medium)]">CURRENT</div>
          <div className="text-[28px] font-bold tracking-tight tabular-nums text-[var(--ion-text-color)]">{formatINR(h.currentValue)}</div>
          <Dash />
          <KV k="Total returns" v={`${signed(h.pl)} (${pctTxt(h.plPct)})`} cls={upCls(h.pl)} />
          <KV k="Invested" v={formatINR(h.investment)} />
          <KV k="XIRR / CAGR" v={`${pos?.xirr == null ? 'N/A' : rate(pos.xirr)} / ${pos?.cagr == null ? 'N/A' : rate(pos.cagr)}`} cls={pos?.xirr == null && pos?.cagr == null ? 'text-[var(--ion-color-medium)]' : upCls(pos?.xirr ?? pos?.cagr)} />
          {terms.ok && <><Dash /><KV k="Long term" sub="(>1Y)" v={formatINR(terms.lt)} /><KV k="Short term" sub="(<1Y)" v={formatINR(terms.st)} /></>}
        </div>

        <div className="mt-3 rounded-2xl border border-[var(--ion-border-color)] bg-[var(--ion-item-background)] px-4 py-3">
          <KV k="Current NAV" v={`₹${Number(h.currentNav).toFixed(4)}`} />
          <KV k="Avg NAV" v={`₹${Number(h.avgNav || 0).toFixed(2)}`} />
          <KV k="Units" v={Number(h.units).toLocaleString('en-IN', { maximumFractionDigits: 3 })} />
          {folio && <KV k="Folio" v={masked ? maskFolio(folio) : folio} />}
          {h.athNav > 0 && <KV k="All-time high NAV" v={`₹${Number(h.athNav).toFixed(2)}${below > 0 ? ` (↓${below.toFixed(1)}%)` : ''}`} cls={below >= 5 ? 'text-emerald-400' : ''} />}
          <Dash />
          <KV k="Monthly SIP" v={h.ongoingSIP > 0 ? formatINR(h.ongoingSIP) : '—'} />
          {h.targetAllocationPct > 0 && <KV k="Share of portfolio" v={`${h.currentAllocationPct.toFixed(1)}% (target ${h.targetAllocationPct.toFixed(0)}%)`} />}
          {(h.lumpsumRestricted || h.sipRestricted) && <KV k="New money stopped" v={[h.lumpsumRestricted && 'Lump sum', h.sipRestricted && 'SIP'].filter(Boolean).join(', ')} cls="text-amber-400" />}
          <div className="mt-3 grid grid-cols-3 border-t border-[var(--ion-border-color)] pt-3">
            {[[Repeat2, 'Switch', () => setModal({ switchFunds: h.portfolioId })], [Lock, 'Stop / allow', (e) => setMenu(e.nativeEvent)], [ArrowUpRight, 'Redeem', () => setModal({ redeem: { portfolioId: h.portfolioId, fundCode: h.schemeCode } })]].map(([I, l, fn]) => (
              <button key={l} type="button" onClick={fn} className="ion-activatable relative overflow-hidden flex flex-col items-center gap-1.5 py-1 rounded-xl">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--ion-color-step-100)] text-[var(--ion-text-color)]"><I size={20} /></span>
                <span className="text-[13px] text-[var(--ion-text-color)]">{l}</span>
              </button>
            ))}
          </div>
        </div>

        <FundSplitCard alloc={alloc} onEdit={() => setModal({ classifyFund: { fund: { fundCode: code, fundName: h.fundName }, existing: alloc } })} />

        {below >= 5 && (
          <div className="mt-3 flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
            <TrendingDown size={22} className="text-emerald-400 shrink-0" />
            <p className="text-[13px] text-[var(--ion-text-color)]"><b className="text-emerald-400">{below.toFixed(1)}% below its all-time high.</b></p>
          </div>
        )}

        <IonList lines="full" className="cf-flat -mx-4 mt-3"><IonItem button detail onClick={() => openGrowth()}><span slot="start" className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-500/15 text-violet-300"><LineChart size={18} /></span><IonLabel><h3 className="!text-[15px] !font-semibold">Growth chart</h3><p>Money in and value over time</p></IonLabel></IonItem></IonList>

        <div className="mt-6 text-[20px] font-bold text-[var(--ion-text-color)]">Transaction history</div>
        <IonList lines="full" className="cf-flat -mx-4 mt-1">
          {list.map((t, i) => {
            const d = parseD(t.date)
            const sell = String(t.type).toUpperCase() === 'SELL'
            return (
              <IonItem key={t.transactionId || i} button detail={false} onClick={() => setTxn(t)}>
                <Lead I={sell ? ArrowUpRight : ArrowDownLeft} c={sell ? '#fb7185' : '#34d399'} />
                <IonLabel className="!my-3"><h3 className="!text-[15px] !font-semibold">{sell ? label(t) : label(t) === 'Lump sum' ? 'Invested' : label(t)}</h3><p>{d ? shortDate(d) : t.date}</p></IonLabel>
                <div slot="end" className="text-right tabular-nums">
                  <div className="text-[15px] font-semibold text-[var(--ion-text-color)]">{sell ? '−' : '+'}{formatINR(t.totalAmount)}</div>
                  <div className="text-[12px] text-[var(--ion-color-medium)]">{Number(t.units || 0).toLocaleString('en-IN', { maximumFractionDigits: 3 })} units / ₹{Number(t.price || 0).toFixed(2)} NAV</div>
                </div>
              </IonItem>
            )
          })}
        </IonList>
        {txns.length > 8 && <IonButton expand="block" fill="clear" onClick={() => setAll(!all)}>{all ? 'Show less' : `Show all ${txns.length}`}</IonButton>}
        {!txns.length && <p className="py-8 text-center text-[14px] text-[var(--ion-color-medium)]">No transactions yet</p>}
      </div>
      <IonPopover isOpen={!!menu} event={menu} onDidDismiss={() => setMenu(null)} alignment="end" className="cf-popover">
        <IonList lines="none">
          <IonItem button detail={false} onClick={() => { setMenu(null); setModal({ switchFunds: h.portfolioId }) }}><span slot="start" className="text-violet-400"><Repeat2 size={20} /></span><IonLabel>Record a switch</IonLabel></IonItem>
          <IonItem><IonToggle checked={!!h.lumpsumRestricted} onIonChange={() => { setMenu(null); onToggleLump(h) }}>Stop lump sum<span className="block text-[12px] text-[var(--ion-color-medium)]">No new one-time money into this fund</span></IonToggle></IonItem>
          <IonItem><IonToggle checked={!!h.sipRestricted} onIonChange={() => { setMenu(null); onToggleSip(h) }}>Stop SIP<span className="block text-[12px] text-[var(--ion-color-medium)]">No new SIP into this fund</span></IonToggle></IonItem>
          <IonItem button detail={false} onClick={() => { setMenu(null); onDeleteFund(h.portfolioId, h.schemeCode || h.fundCode, h.fundName) }}><span slot="start" className="text-rose-400"><Trash2 size={20} /></span><IonLabel color="danger">Delete fund</IonLabel></IonItem>
        </IonList>
      </IonPopover>
      <TxnSheet t={txn} onClose={() => setTxn(null)} setModal={setModal} onDeleteTxn={onDeleteTxn} />
    </Screen>
  )
}
