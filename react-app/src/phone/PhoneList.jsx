// A list page on phones (bank accounts, family, insurance, loans, reminders, ...), Ionic, native look.
//   summary: [{ label, value, tone? }]   small stat tiles at the top
//   groups:  [{ title?, items: [{ key, title, sub, value, note, noteTone, lead: { icon, color } | { text, color }, badge, onClick }] }]
//   onAdd / addLabel: floating + button (Android FAB)
import '../phone/ionic-setup'
import { useState } from 'react'
import { IonList, IonItem, IonLabel, IonListHeader, IonFab, IonFabButton, IonBadge, IonButton, IonActionSheet } from '@ionic/react'
import { Plus } from 'lucide-react'

const PALETTE = ['#8b5cf6', '#10b981', '#f59e0b', '#38bdf8', '#ec4899', '#14b8a6', '#f97316']
export const colorOf = (s) => PALETTE[[...String(s || '')].reduce((a, c) => a + c.charCodeAt(0), 0) % PALETTE.length]

function Lead({ lead, title }) {
  const c = lead?.color || colorOf(title)
  const I = lead?.icon
  return (

    <span slot="start" style={{ marginInlineEnd: 14 }} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[16px] font-bold" style={{ background: `${c}24`, color: c }}>
      {I ? <I size={20} strokeWidth={2} /> : String(lead?.text || title || '?').trim().charAt(0).toUpperCase()}
    </span>
  )
}

export default function PhoneList({ summary = [], groups = [], onAdd, addLabel = 'Add', empty, children, top }) {
  const count = groups.reduce((n, g) => n + g.items.length, 0)
  const [menu, setMenu] = useState(null) // item whose action menu is open
  return (
    <div className="-mx-4 pb-24">
      {top}
      {summary.length > 0 && count > 0 && (
        // one summary card, equal columns (like Groww's holdings card): label on top, number below, lined up
        <div className="mx-4 mt-3 grid rounded-2xl border border-[var(--ion-border-color)] bg-[var(--ion-item-background)] py-3.5"
          style={{ gridTemplateColumns: `repeat(${Math.min(summary.length, 3)}, minmax(0, 1fr))` }}>
          {summary.map((s, i) => (
            <div key={s.label} className={`min-w-0 px-4 ${i % 3 ? 'border-l border-[var(--ion-border-color)]' : ''}`}>
              <div className="truncate text-[12.5px] text-[var(--ion-color-medium)]">{s.label}</div>
              <div className={`mt-1 truncate text-[18px] font-bold leading-tight tabular-nums ${s.tone || 'text-[var(--ion-text-color)]'}`}>{s.value}</div>
            </div>
          ))}
        </div>
      )}
      {count === 0 && empty && (
        <div className="flex flex-col items-center gap-3 px-8 pt-20 text-center">
          {empty.icon && <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-violet-500/15 text-violet-400"><empty.icon size={30} /></span>}
          <p className="text-[16px] font-semibold text-[var(--ion-text-color)]">{empty.title}</p>
          {empty.text && <p className="text-[14px] text-[var(--ion-color-medium)]">{empty.text}</p>}
          {onAdd && <IonButton onClick={onAdd} className="mt-2"><Plus size={18} className="mr-1.5" />{addLabel}</IonButton>}
        </div>
      )}
      {groups.filter((g) => g.items.length).map((g, gi) => (
        <div key={g.title || gi}>
          {g.title ? <IonListHeader className="!pl-5"><IonLabel className="cf-group">{g.title}</IonLabel></IonListHeader> : <div className="h-1" />}
          <IonList inset lines="inset" className="cf-inset">
            {g.items.map((it) => (
              <IonItem key={it.key} button={!!(it.onClick || it.menu)} detail={!!(it.onClick || it.menu)} onClick={it.menu ? () => setMenu(it) : it.onClick}>
                <Lead lead={it.lead} title={it.title} />
                <IonLabel className="!my-3 min-w-0">
                  <h3 className="!text-[16px] !font-semibold !leading-snug !whitespace-normal">{it.title}</h3>
                  {it.sub && <p className="!mt-0.5 !text-[13.5px] !leading-snug !whitespace-normal">{it.sub}</p>}
                  {(it.badge || it.chip) && <p className="!mt-1.5 flex flex-wrap gap-1.5">
                    {[it.chip, it.badge].filter(Boolean).map((b, i) => <span key={i} className="inline-block rounded-md px-2 py-0.5 text-[12px] font-semibold" style={{ background: `${b.color || '#8b5cf6'}22`, color: b.color || '#a78bfa' }}>{b.text}</span>)}
                  </p>}
                </IonLabel>
                {(it.value != null || it.note != null) && (
                  <div slot="end" className="ml-2 shrink-0 text-right tabular-nums">
                    {it.value != null && <div className="whitespace-nowrap text-[16px] font-semibold text-[var(--ion-text-color)]">{it.value}</div>}
                    {it.note != null && <div className={`mt-0.5 whitespace-nowrap text-[12.5px] font-medium ${it.noteTone || 'text-[var(--ion-color-medium)]'}`}>{it.note}</div>}
                  </div>
                )}
                {it.tag && <IonBadge slot="end" color={it.tag.color || 'medium'}>{it.tag.text}</IonBadge>}
              </IonItem>
            ))}
          </IonList>
        </div>
      ))}
      {children}
      <IonActionSheet isOpen={!!menu} onDidDismiss={() => setMenu(null)} header={menu?.title}
        buttons={[...(menu?.menu || []).map((m) => ({ text: m.text, role: m.danger ? 'destructive' : undefined, handler: m.handler })), { text: 'Cancel', role: 'cancel' }]} />
      {onAdd && count > 0 && (
        <IonFab className="cf-fab" style={{ position: 'fixed', right: 16, bottom: 'calc(var(--cf-fab-bottom, 84px) + env(safe-area-inset-bottom))' }}>
          <IonFabButton onClick={onAdd} aria-label={addLabel}><Plus size={26} /></IonFabButton>
        </IonFab>
      )}
    </div>
  )
}
