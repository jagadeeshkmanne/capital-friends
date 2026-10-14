// Home on phones (Ionic, Groww-style): net worth, quick actions, action items, where the money is, goals,
// signals, top funds, reminders. Same numbers as the desktop Dashboard (it passes everything in).
import { useState } from 'react'
import '../../phone/ionic-setup'
import { IonCard, IonCardContent, IonList, IonItem, IonLabel, IonListHeader, IonNote, IonButton, IonRippleEffect } from '@ionic/react'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { FileUp, Wallet, Target, HeartPulse, AlertTriangle, AlertCircle, Info, TrendingDown, Scale, Bell, TrendingUp, ChevronRight } from 'lucide-react'
import { formatINR } from '../../data/familyData'

const TONE = { critical: ['#fb7185', AlertCircle], warning: ['#f59e0b', AlertTriangle], info: ['#60a5fa', Info] }
const pct1 = (v) => (v < 1 ? v.toFixed(1) : v.toFixed(0))

export default function DashboardPhone({ data, actionItems, upcomingReminders, goalCards, goalTodos, navigate, mt, onRebalance, onBuyOpp }) {
  const [all, setAll] = useState(false)
  const items = all ? actionItems : actionItems.slice(0, 4)
  // net worth split: the 3 biggest classes, everything else (gold, commodities, cash, other...) as one "Others" so the card stays clean
  const split = (() => {
    const l = [...(data.assetClassList || [])].sort((a, b) => b.pct - a.pct)
    const top = l.slice(0, 3), rest = l.slice(3)
    const restPct = rest.reduce((t, a) => t + a.pct, 0)
    return restPct >= 0.5 ? [...top, { name: rest.length === 1 ? rest[0].name : 'Others', pct: restPct, fill: rest.length === 1 ? rest[0].fill : '#64748b' }] : top
  })()
  const quick = [
    ['Import CAMS', FileUp, '/import', '#a78bfa'],
    ['Funds', Wallet, '/investments/mutual-funds', '#34d399'],
    ['Goals', Target, '/goals', '#38bdf8'],
    ['Health check', HeartPulse, '/health-check', '#fb7185'],
  ]
  return (
    <div className="-mx-4 pb-4">
      {/* net worth */}
      <IonCard className="cf-card">
        <IonCardContent>
          <div className="text-[13px] text-[var(--ion-color-medium)]">Net worth</div>
          <div className="text-[32px] leading-tight font-bold tracking-tight text-[var(--ion-text-color)] tabular-nums">{formatINR(data.netWorth)}</div>
          <div className="mt-1 flex gap-4 text-[13px] tabular-nums">
            <span className="text-[var(--ion-color-medium)]">Assets <b className="text-[var(--ion-text-color)]">{formatINR(data.totalAssets)}</b></span>
            {data.totalLiabilities > 0 && <span className="text-[var(--ion-color-medium)]">Loans <b className="text-rose-400">{formatINR(data.totalLiabilities)}</b></span>}
          </div>
          {split.length > 0 && (
            <>
              <div className="mt-4 flex h-2 rounded-full overflow-hidden gap-[3px]">{split.map((a) => <span key={a.name} style={{ width: `${a.pct}%`, background: a.fill }} />)}</div>
              <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2">
                {split.map((a) => (
                  <div key={a.name} className="flex items-center gap-2 text-[13px]">
                    <span className="w-2.5 h-2.5 rounded-[3px] shrink-0" style={{ background: a.fill }} />
                    <span className="flex-1 truncate text-[var(--ion-color-medium)]">{a.name}</span>
                    <b className="tabular-nums text-[var(--ion-text-color)]">{Math.round(a.pct)}%</b>
                  </div>
                ))}
              </div>
            </>
          )}
        </IonCardContent>
      </IonCard>

      {/* quick actions, like the icon row in broker apps */}
      <div className="grid grid-cols-4 gap-2 px-4 mt-3">
        {quick.map(([l, I, to, c]) => (
          <button key={l} type="button" onClick={() => navigate(to)} className="ion-activatable relative overflow-hidden flex flex-col items-center gap-1.5 rounded-2xl py-2.5">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ background: `${c}22`, color: c }}><I size={21} /></span>
            <span className="text-[12px] font-medium text-[var(--ion-text-color)]">{l}</span>
            <IonRippleEffect />
          </button>
        ))}
      </div>

      {/* signals */}
      {(data.buyOpportunities.length > 0 || data.rebalanceItems.length > 0) && (
        <div className="grid grid-cols-2 gap-3 px-4 mt-3">
          {data.buyOpportunities.length > 0 && (
            <button type="button" onClick={onBuyOpp} className="ion-activatable relative overflow-hidden text-left rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-3">
              <TrendingDown size={20} className="text-emerald-400" />
              <div className="mt-1.5 text-[22px] font-bold text-[var(--ion-text-color)] leading-none">{data.buyOpportunities.length}</div>
              <div className="text-[12px] text-[var(--ion-color-medium)] mt-0.5">Below their peak</div>
              <IonRippleEffect />
            </button>
          )}
          {data.rebalanceItems.length > 0 && (
            <button type="button" onClick={onRebalance} className="ion-activatable relative overflow-hidden text-left rounded-2xl border border-violet-500/25 bg-violet-500/10 p-3">
              <Scale size={20} className="text-violet-300" />
              <div className="mt-1.5 text-[22px] font-bold text-[var(--ion-text-color)] leading-none">{data.rebalanceItems.length}</div>
              <div className="text-[12px] text-[var(--ion-color-medium)] mt-0.5">Funds to rebalance</div>
              <IonRippleEffect />
            </button>
          )}
        </div>
      )}

      {/* action required */}
      {actionItems.length > 0 && (
        <>
          <IonListHeader className="!pl-5"><IonLabel className="cf-group">Action required · {actionItems.length}</IonLabel></IonListHeader>
          <IonList inset lines="inset" className="cf-inset">
            {items.map((a, i) => {
              const [c, I] = TONE[a.type] || TONE.info
              return (
                <IonItem key={i} button detail onClick={() => a.navigateTo && navigate(a.navigateTo)}>
                  <span slot="start" className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: `${c}22`, color: c }}><I size={19} /></span>
                  <IonLabel className="!my-2.5"><h3 className="!text-[15px] !font-semibold !whitespace-normal">{a.title}</h3><p className="!whitespace-normal !line-clamp-2">{a.description}</p></IonLabel>
                </IonItem>
              )
            })}
          </IonList>
          {actionItems.length > 4 && <IonButton fill="clear" size="small" className="ml-3" onClick={() => setAll(!all)}>{all ? 'Show less' : `Show all ${actionItems.length}`}</IonButton>}
        </>
      )}

      {/* where the money is */}
      {data.allocByType.length > 0 && (
        <>
          <IonListHeader className="!pl-5"><IonLabel className="cf-group">Where your money is</IonLabel></IonListHeader>
          <IonCard className="cf-card !mt-0">
            <IonCardContent>
              <div className="flex items-center gap-3">
                <div className="relative shrink-0" style={{ width: 128, height: 128 }}>
                  <ResponsiveContainer><PieChart><Pie data={data.allocByType} dataKey="value" innerRadius={40} outerRadius={60} paddingAngle={2} stroke="none">{data.allocByType.map((d) => <Cell key={d.name} fill={d.fill} />)}</Pie></PieChart></ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center"><span className="text-[10px] text-[var(--ion-color-medium)]">Assets</span><span className="text-[13px] font-bold text-[var(--ion-text-color)]">{formatINR(data.totalAssets)}</span></div>
                </div>
                <div className="flex-1 min-w-0 space-y-1.5">
                  {data.allocByType.slice(0, 6).map((d) => (
                    <div key={d.name} className="flex items-center gap-2 text-[13px]"><span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.fill }} /><span className="flex-1 truncate text-[var(--ion-text-color)]">{d.name}</span><b className="tabular-nums text-[var(--ion-text-color)]">{pct1(d.pct)}%</b></div>
                  ))}
                </div>
              </div>
            </IonCardContent>
          </IonCard>
        </>
      )}

      {/* goals */}
      {goalCards.length > 0 && (
        <>
          <IonListHeader className="!pl-5"><IonLabel className="cf-group">Goals</IonLabel><IonButton size="small" fill="clear" onClick={() => navigate('/goals')}>Open <ChevronRight size={16} /></IonButton></IonListHeader>
          {goalTodos.length > 0 && (
            <IonCard button className="cf-card !mt-0 !mb-2" style={{ '--background': 'rgba(245,158,11,0.10)', borderColor: 'rgba(245,158,11,0.3)' }} onClick={() => navigate('/goals')}>
              <IonCardContent className="!py-3"><b className="text-amber-400 text-[14px]">{goalTodos.length} thing{goalTodos.length > 1 ? 's' : ''} to do</b><div className="text-[13px] text-[var(--ion-text-color)] mt-0.5 line-clamp-2">{goalTodos[0]}</div></IonCardContent>
            </IonCard>
          )}
          <IonList inset lines="inset" className="cf-inset !mt-0">
            {goalCards.map((p) => {
              const pct = p.target > 0 ? Math.min(100, Math.round((p.has / p.target) * 100)) : 0
              const due = p.state === 'due' && !p.isRet
              const tone = due ? '#60a5fa' : p.state === 'short' ? '#f59e0b' : '#10b981'
              const label = due ? 'Ready' : p.state === 'short' ? 'Short' : 'On track'
              const r = 16, c = 2 * Math.PI * r
              return (
                <IonItem key={p.goal.goalId} button detail onClick={() => navigate(`/goals/plan/${encodeURIComponent(p.goal.goalId)}`)}>
                  <span slot="start" className="relative" style={{ width: 42, height: 42 }}>
                    <svg width="42" height="42" viewBox="0 0 42 42"><circle cx="21" cy="21" r={r} fill="none" stroke="var(--ion-color-step-150)" strokeWidth="4" /><circle cx="21" cy="21" r={r} fill="none" stroke={tone} strokeWidth="4" strokeLinecap="round" strokeDasharray={`${(pct / 100) * c} ${c}`} transform="rotate(-90 21 21)" /></svg>
                    <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-[var(--ion-text-color)]">{pct}%</span>
                  </span>
                  <IonLabel className="!my-2.5"><h3 className="!text-[15px] !font-semibold">{mt(p.goal.goalName)}</h3><p>{formatINR(Math.round(p.has))} of {formatINR(Math.round(p.target))}</p></IonLabel>
                  <IonNote slot="end" className="!text-[12px] !font-semibold" style={{ color: tone }}>{label}</IonNote>
                </IonItem>
              )
            })}
          </IonList>
        </>
      )}

      {/* top funds */}
      {data.topGainers.length > 0 && (
        <>
          <IonListHeader className="!pl-5"><IonLabel className="cf-group">Top funds</IonLabel></IonListHeader>
          <IonList inset lines="inset" className="cf-inset !mt-0">
            {[...data.topGainers, ...data.topLosers].map((f) => (
              <IonItem key={f.fundName}>
                <span slot="start" className={`flex h-9 w-9 items-center justify-center rounded-xl ${f.pl >= 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'}`}>{f.pl >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />}</span>
                <IonLabel><h3 className="!text-[15px] !font-semibold">{f.fundName}</h3><p>{f.portfolios.join(', ')}</p></IonLabel>
                <div slot="end" className="text-right tabular-nums"><div className="text-[15px] font-semibold text-[var(--ion-text-color)]">{formatINR(f.currentValue)}</div><div className={`text-[12px] font-semibold ${f.pl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{f.pl >= 0 ? '+' : ''}{f.plPct.toFixed(1)}%</div></div>
              </IonItem>
            ))}
          </IonList>
        </>
      )}

      {/* funds at or near their all-time high (the laptop's Near peak) */}
      {data.nearATHFunds?.length > 0 && (
        <>
          <IonListHeader className="!pl-5"><IonLabel className="cf-group">Near their high · {data.nearATHFunds.length}</IonLabel></IonListHeader>
          <IonList inset lines="inset" className="cf-inset !mt-0">
            {data.nearATHFunds.map((f) => (
              <IonItem key={f.fundName} button detail onClick={() => navigate('/investments/mutual-funds')}>
                <IonLabel><h3 className="!text-[15px] !font-semibold !whitespace-normal">{f.fundName}</h3><p>At or close to its all-time high NAV</p></IonLabel>
                <IonNote slot="end" className="!text-[12.5px] !font-semibold !text-amber-400">{f.isAtATH ? 'At its high' : `${f.belowATHPct.toFixed(1)}% below`}</IonNote>
              </IonItem>
            ))}
          </IonList>
        </>
      )}

      {/* reminders */}
      {upcomingReminders.length > 0 && (
        <>
          <IonListHeader className="!pl-5"><IonLabel className="cf-group">Coming up</IonLabel></IonListHeader>
          <IonList inset lines="inset" className="cf-inset !mt-0">
            {upcomingReminders.map((r) => (
              <IonItem key={r.reminderId} button detail onClick={() => navigate('/reminders')}>
                <span slot="start" className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400"><Bell size={18} /></span>
                <IonLabel><h3 className="!text-[15px] !font-semibold">{mt(r.title)}</h3><p>{new Date(r.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p></IonLabel>
                <IonNote slot="end" className={`!text-[12px] !font-semibold ${r.days <= 7 ? '!text-rose-400' : ''}`}>{r.days === 0 ? 'Today' : `${r.days} days`}</IonNote>
              </IonItem>
            ))}
          </IonList>
        </>
      )}
    </div>
  )
}
