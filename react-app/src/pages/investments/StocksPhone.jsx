// Stocks on phones (Ionic, Groww style), the same layout as Mutual Funds:
//   Holdings | Portfolios | Activity tabs, one summary card, flat rows (tap the numbers to switch Returns / Current),
//   a portfolio opens its own screen; Buy / Sell / Import / New portfolio from the + menu.
import { useEffect, useMemo, useState } from 'react'
import '../../phone/ionic-setup'
import { IonSegment, IonSegmentButton, IonLabel, IonList, IonItem, IonButton, IonActionSheet, IonListHeader, IonRippleEffect } from '@ionic/react'
import { Plus, MoreVertical, ArrowDownLeft, ArrowUpRight, Eye, EyeOff, BarChart3 } from 'lucide-react'
import { formatINR } from '../../data/familyData'
import { useMask } from '../../context/MaskContext'
import { Screen, FadeIn, setPhoneBar } from '../../components/native'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const signed = (v) => `${v >= 0 ? '+' : '−'}${formatINR(Math.abs(v || 0))}`
const pctTxt = (v) => `${v >= 0 ? '+' : ''}${(v || 0).toFixed(2)}%`
const upCls = (v) => (v >= 0 ? 'text-emerald-400' : 'text-rose-400')
const parseD = (s) => { const d = new Date(s); return Number.isFinite(d.getTime()) ? d : null }
const invOf = (h) => (Number(h.totalInvestment) > 1 ? Number(h.totalInvestment) : Number(h.currentValue) || 0)

function TopTabs({ value, onChange, options }) {
  return (
    <div className="cf-top-tabs-wrap -mx-4 -mt-2 mb-1">
      <IonSegment value={value} onIonChange={(e) => onChange(String(e.detail.value))} className="cf-top-tabs" scrollable>
        {options.map(([k, l, badge]) => <IonSegmentButton key={k} value={k}><IonLabel>{l}{badge > 0 && <span className="cf-tab-badge">{badge}</span>}</IonLabel></IonSegmentButton>)}
      </IonSegment>
    </div>
  )
}
function KV({ k, v, cls = '' }) {
  return <div className="flex items-baseline justify-between gap-3 py-[7px]"><span className="text-[15px] text-[var(--ion-text-color)]">{k}</span><span className={`text-[15px] font-semibold tabular-nums text-right ${cls || 'text-[var(--ion-text-color)]'}`}>{v}</span></div>
}
const Dash = () => <div className="my-2 border-t border-dashed border-[var(--ion-color-step-250)]" />

function SummaryCard({ count, s }) {
  const { masked, toggleMask } = useMask()
  return (
    <div className="mt-3 rounded-2xl border border-[var(--ion-border-color)] bg-[var(--ion-item-background)] px-4 pt-4 pb-2">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[12px] font-semibold tracking-[0.14em] text-[var(--ion-color-medium)]">STOCKS ({count})</div>
          <div className="mt-0.5 text-[28px] font-bold tracking-tight tabular-nums text-[var(--ion-text-color)]">{formatINR(s.current)}</div>
        </div>
        <button type="button" onClick={toggleMask} aria-label="Hide numbers" className="ion-activatable relative overflow-hidden flex h-10 w-10 items-center justify-center rounded-full border border-[var(--ion-color-step-200)] text-[var(--ion-text-color)]">{masked ? <EyeOff size={18} /> : <Eye size={18} />}<IonRippleEffect /></button>
      </div>
      <Dash />
      <KV k="Total returns" v={`${signed(s.totalPL)} (${pctTxt(s.totalPLPct)})`} cls={upCls(s.totalPL)} />
      <KV k="Invested" v={formatINR(s.invested)} />
      <KV k="Unrealised" v={signed(s.unrealizedPL)} cls={upCls(s.unrealizedPL)} />
      <KV k="Realised" v={signed(s.realizedPL)} cls={upCls(s.realizedPL)} />
    </div>
  )
}

const MODES = [['current', 'Current (Invested)'], ['returns', 'Returns (%)'], ['price', 'Price (Avg)']]
function Rows({ holdings, sub, onOpen }) {
  const [mode, setMode] = useState(() => { try { return localStorage.getItem('cf-stk-col2') || 'current' } catch { return 'current' } })
  const next = () => { const i = MODES.findIndex(([m]) => m === mode); const m = MODES[(i + 1) % MODES.length][0]; setMode(m); try { localStorage.setItem('cf-stk-col2', m) } catch { /* ignore */ } }
  const list = [...holdings].sort((a, b) => (b.currentValue || 0) - (a.currentValue || 0))
  if (!list.length) return <p className="py-10 text-center text-[14px] text-[var(--ion-color-medium)]">No shares yet. Press + to buy or import.</p>
  return (
    <>
      <div className="flex items-center justify-between px-1 pt-4 pb-1">
        <span className="text-[13px] text-[var(--ion-color-medium)]">{list.length} stock{list.length === 1 ? '' : 's'}</span>
        <button type="button" onClick={next} className="flex items-center gap-1.5 rounded-full border border-[var(--ion-border-color)] px-3 py-1 text-[13px] font-semibold text-[var(--ion-text-color)]" aria-label="Switch what the numbers show">
          <span className="text-[var(--ion-color-medium)]">‹ ›</span><span>{MODES.find(([m]) => m === mode)?.[1]}</span>
        </button>
      </div>
      <IonList lines="full" className="cf-flat -mx-4">
        {list.map((h) => {
          const inv = invOf(h), pl = (h.currentValue || 0) - inv, plPct = inv > 0 ? (pl / inv) * 100 : 0
          return (
            <IonItem key={`${h.portfolioId}-${h.symbol}`} button detail={false} onClick={() => onOpen?.(h)}>
              <IonLabel className="!my-3.5">
                <h3 className="!text-[15px] !font-medium !whitespace-normal !leading-snug">{h.companyName || h.symbol}</h3>
                <p className="!mt-1">{h.quantity} shares{sub ? ` · ${sub(h)}` : ''}</p>
              </IonLabel>
              <div slot="end" className="ml-2 shrink-0 text-right tabular-nums" onClick={(e) => { e.stopPropagation(); next() }}>
                {mode === 'returns'
                  ? <><div className="text-[15px] font-semibold text-[var(--ion-text-color)]">{signed(pl)}</div><div className={`mt-0.5 text-[12.5px] font-semibold ${upCls(pl)}`}>({pctTxt(plPct)})</div></>
                  : mode === 'current'
                    ? <><div className="text-[15px] font-semibold text-[var(--ion-text-color)]">{formatINR(h.currentValue)}</div><div className="mt-0.5 text-[12.5px] text-[var(--ion-color-medium)]">({formatINR(inv)})</div></>
                    : <><div className="text-[15px] font-semibold text-[var(--ion-text-color)]">₹{Number(h.currentPrice || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div><div className="mt-0.5 text-[12.5px] text-[var(--ion-color-medium)]">(₹{Number(h.avgBuyPrice || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })})</div></>}
              </div>
            </IonItem>
          )
        })}
      </IonList>
    </>
  )
}

function Activity({ txns, onOpen }) {
  const [n, setN] = useState(40)
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
                <IonItem key={t.transactionId || i} button={!!onOpen} detail={false} onClick={() => onOpen?.(t)}>
                  <span slot="start" style={{ marginInlineEnd: 14 }} className={`flex h-10 w-10 items-center justify-center rounded-full ${sell ? 'bg-rose-500/15 text-rose-400' : 'bg-emerald-500/15 text-emerald-400'}`}><I size={18} /></span>
                  <IonLabel>
                    <h3 className="!text-[15px] !font-semibold !whitespace-normal">{t.companyName || t.symbol}</h3>
                    <p>{sell ? 'Sold' : 'Bought'} · {t.d ? `${t.d.getDate()} ${MONTHS[t.d.getMonth()]}` : t.date}{sell && t.realizedPL != null ? <span className={upCls(t.realizedPL)}> · {signed(t.realizedPL)}</span> : null}</p>
                  </IonLabel>
                  <div slot="end" className="text-right tabular-nums">
                    <p className="text-[15px] font-semibold text-[var(--ion-text-color)]">{sell ? '−' : ''}{formatINR(t.totalAmount)}</p>
                    <p className="text-[12.5px] text-[var(--ion-color-medium)]">{t.quantity} @ ₹{Number(t.pricePerShare || 0).toLocaleString('en-IN')}</p>
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

const sumOf = (list) => {
  const invested = list.reduce((t, p) => t + p.invested, 0), current = list.reduce((t, p) => t + p.current, 0)
  const unrealizedPL = list.reduce((t, p) => t + p.unrealizedPL, 0), realizedPL = list.reduce((t, p) => t + p.realizedPL, 0)
  const totalPL = unrealizedPL + realizedPL
  return { invested, current, unrealizedPL, realizedPL, totalPL, totalPLPct: invested > 0 ? (totalPL / invested) * 100 : 0 }
}

export default function StocksPhone({ portfolioData, allHoldings, allTxns, setModal, mv, onDeleteTxn }) {
  const [open, setOpen] = useState(null) // portfolioId
  const [tab, setTab] = useState('portfolios')
  const [add, setAdd] = useState(false)
  const [txn, setTxn] = useState(null)
  useEffect(() => {
    if (open) return undefined
    setPhoneBar({ right: <IonButton className="cf-icon-btn" onClick={() => setAdd(true)} aria-label="Add"><Plus size={24} /></IonButton> })
    return () => setPhoneBar(null)
  }, [open])
  const pname = Object.fromEntries(portfolioData.map((p) => [p.portfolioId, p.portfolioName]))
  const sheets = (
    <>
      <IonActionSheet isOpen={add} onDidDismiss={() => setAdd(false)} header="Stocks" buttons={[
        { text: 'Import from CDSL / NSDL statement', handler: () => setModal({ importDemat: true }) },
        { text: 'Import from Excel / CSV', handler: () => setModal({ importFile: open || '' }) },
        { text: 'Buy (record a purchase)', handler: () => setModal({ buy: open || (portfolioData[0]?.portfolioId) }) },
        { text: 'Sell (record a sale)', handler: () => setModal({ sell: open || (portfolioData[0]?.portfolioId) }) },
        { text: 'New portfolio', handler: () => setModal('addPortfolio') },
        { text: 'Cancel', role: 'cancel' },
      ]} />
      <IonActionSheet isOpen={!!txn} onDidDismiss={() => setTxn(null)} header={txn ? `${txn.companyName || txn.symbol}` : ''} buttons={[
        { text: 'Edit transaction', handler: () => setModal({ editTxn: txn }) },
        onDeleteTxn && { text: 'Delete transaction', role: 'destructive', handler: () => onDeleteTxn(txn.transactionId) },
        { text: 'Cancel', role: 'cancel' },
      ].filter(Boolean)} />
    </>
  )

  if (!portfolioData.length) {
    return (
      <div className="flex flex-col items-center gap-3 px-6 pt-20 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-violet-500/15 text-violet-400"><BarChart3 size={30} /></span>
        <p className="text-[17px] font-semibold">No stock portfolio yet</p>
        <p className="text-[14px] text-[var(--ion-color-medium)]">Import your CDSL / NSDL statement, or make a portfolio and add your shares.</p>
        <IonButton onClick={() => setModal({ importDemat: true })} className="mt-2">Import statement</IonButton>
        <IonButton fill="clear" onClick={() => setModal('addPortfolio')}>New portfolio</IonButton>
        {sheets}
      </div>
    )
  }

  const p = open ? portfolioData.find((x) => x.portfolioId === open) : null
  if (p) return <PortfolioScreen p={p} back={() => setOpen(null)} setModal={setModal} mv={mv} onTxn={setTxn} sheets={sheets} openAdd={() => setAdd(true)} />

  return (
    <div className="pb-6">
      <TopTabs value={tab} onChange={setTab} options={[['portfolios', 'Portfolios'], ['holdings', 'Holdings'], ['activity', 'History']]} />
      <FadeIn k={tab}>
        {tab === 'holdings' && (<>
          <SummaryCard count={allHoldings.length} s={sumOf(portfolioData)} />
          <Rows holdings={allHoldings} sub={portfolioData.length > 1 ? (h) => pname[h.portfolioId] : null} />
        </>)}
        {tab === 'portfolios' && (<>
          <SummaryCard count={allHoldings.length} s={sumOf(portfolioData)} />
          <IonList lines="full" className="cf-flat -mx-4 mt-2">
            {portfolioData.map((x) => (
              <IonItem key={x.portfolioId} button detail onClick={() => setOpen(x.portfolioId)}>
                <IonLabel className="!my-3.5">
                  <h3 className="!text-[16px] !font-semibold">{x.portfolioName}</h3>
                  <p>{mv(x.ownerName, 'name')} · {x.stockCount} stock{x.stockCount === 1 ? '' : 's'}{x.platform && x.platform !== '—' ? ` · ${x.platform}` : ''}</p>
                </IonLabel>
                <div slot="end" className="text-right tabular-nums">
                  <div className="text-[15px] font-semibold text-[var(--ion-text-color)]">{formatINR(x.current)}</div>
                  <div className={`text-[12.5px] font-semibold ${upCls(x.totalPL)}`}>{signed(x.totalPL)} ({pctTxt(x.totalPLPct)})</div>
                </div>
              </IonItem>
            ))}
          </IonList>
        </>)}
        {tab === 'activity' && <Activity txns={allTxns} onOpen={setTxn} />}
      </FadeIn>
      {sheets}
    </div>
  )
}

function PortfolioScreen({ p, back, setModal, mv, onTxn, sheets }) {
  const [tab, setTab] = useState('holdings')
  const [menu, setMenu] = useState(false)
  const right = useMemo(() => <IonButton className="cf-icon-btn" onClick={() => setMenu(true)} aria-label="More"><MoreVertical size={22} /></IonButton>, [])
  const txns = useMemo(() => [...(p.txns || [])].sort((a, b) => new Date(b.date) - new Date(a.date)), [p])
  return (
    <Screen k={p.portfolioId} title={p.portfolioName} subtitle={`${mv(p.ownerName, 'name')}${p.platform && p.platform !== '—' ? ` · ${p.platform}` : ''}`} onBack={back} right={right}
      footer={<><IonButton className="cf-soft-btn" onClick={() => setModal({ sell: p.portfolioId })}>Sell</IonButton><IonButton className="cf-big-btn" onClick={() => setModal({ buy: p.portfolioId })}>Buy</IonButton></>}>
      <div className="pb-4">
        <TopTabs value={tab} onChange={setTab} options={[['holdings', 'Holdings'], ['activity', 'History']]} />
        <FadeIn k={tab}>
          {tab === 'holdings' && (<><SummaryCard count={p.stockCount} s={sumOf([p])} /><Rows holdings={p.holdings} /></>)}
          {tab === 'activity' && <Activity txns={txns} onOpen={onTxn} />}
        </FadeIn>
      </div>
      <IonActionSheet isOpen={menu} onDidDismiss={() => setMenu(false)} header={p.portfolioName} buttons={[
        { text: 'Import from CDSL / NSDL statement', handler: () => setModal({ importDemat: true }) },
        { text: 'Import from Excel / CSV', handler: () => setModal({ importFile: p.portfolioId }) },
        { text: 'Edit portfolio', handler: () => setModal({ editPortfolio: p }) },
        { text: 'Cancel', role: 'cancel' },
      ]} />
      {sheets}
    </Screen>
  )
}
