// Record an investment / redemption on phones: a full native screen like a broker's buy / sell page.
// Big amount in the middle, One time / SIP switch, NAV and units worked out, date, one big button at the bottom.
// Saves exactly what the desktop forms save (same onSave data).
import { useMemo, useState } from 'react'
import './ionic-setup'
import { IonModal, IonHeader, IonToolbar, IonButtons, IonButton, IonTitle, IonContent, IonFooter, IonLabel, IonList, IonItem, IonInput, IonSpinner, IonDatetime, IonDatetimeButton } from '@ionic/react'
import { ArrowLeft } from 'lucide-react'
import { formatINR, splitFundName } from '../data/familyData'

const today = () => new Date().toISOString().split('T')[0]
const num = (v) => Number(String(v).replace(/,/g, '')) || 0

export default function PhoneTrade({ open, mode, holding, portfolioName, onSave, onClose }) {
  const h = holding || {}
  const n = splitFundName(h.fundName || '')
  const nav0 = Number(h.currentNav) || 0
  const sell = mode === 'redeem'
  const [kind, setKind] = useState(open?.type || (h.sipRestricted ? 'LUMPSUM' : 'SIP'))
  const [amount, setAmount] = useState('')
  const [nav, setNav] = useState(nav0 ? String(nav0) : '')
  const [unitsTyped, setUnitsTyped] = useState('') // only when the user types units instead of an amount
  const [date, setDate] = useState(today())
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const units = unitsTyped ? num(unitsTyped) : num(nav) > 0 ? num(amount) / num(nav) : 0
  const value = unitsTyped ? num(unitsTyped) * num(nav) : num(amount)
  const maxUnits = Number(h.units) || 0
  const chips = sell ? [['25%', 0.25], ['50%', 0.5], ['All', 1]] : [['+1,000', 1000], ['+5,000', 5000], ['+10,000', 10000]]
  const cta = sell ? 'Record redemption' : kind === 'SIP' ? 'Record SIP' : 'Record investment'
  const can = units > 0 && num(nav) > 0 && date && (!sell || units <= maxUnits + 1e-6)

  async function save() {
    setErr('')
    if (!can) { setErr(sell && units > maxUnits ? `You hold ${maxUnits.toFixed(3)} units` : 'Enter an amount and NAV'); return }
    setSaving(true)
    try {
      const u = String(Math.round(units * 1000) / 1000)
      if (sell) await onSave({ portfolioId: h.portfolioId, fundCode: h.schemeCode, fundName: h.fundName, date, units: u, price: nav, notes })
      else await onSave({ portfolioId: h.portfolioId, fundCode: h.schemeCode, fundName: h.fundName, transactionType: kind, purchaseDate: date, units: u, avgPrice: nav, notes })
    } catch (e) { setErr(e?.message || 'Could not save') } finally { setSaving(false) }
  }

  const sub = useMemo(() => [portfolioName, n.plan].filter(Boolean).join(' · '), [portfolioName, n.plan])
  return (
    <IonModal isOpen={!!open} onDidDismiss={onClose} className="cf-page-modal">
      <IonHeader className="ion-no-border">
        <IonToolbar>
          <IonButtons slot="start"><IonButton onClick={onClose} className="cf-icon-btn" aria-label="Back"><ArrowLeft size={24} /></IonButton></IonButtons>
          <IonTitle className="cf-title">{sell ? 'Redeem' : 'Invest'}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <div className="px-5 pt-3">
          <div className="text-[17px] font-semibold leading-snug">{n.main}</div>
          <div className="text-[13px] text-[var(--ion-color-medium)] mt-0.5">{sub}</div>
          {!sell && (
            <div className="mt-5 grid grid-cols-2 gap-1 rounded-2xl bg-[var(--ion-color-step-100)] p-1">
              {[['LUMPSUM', 'One time', h.lumpsumRestricted], ['SIP', 'Monthly SIP', h.sipRestricted]].map(([k, l, off]) => (
                <button key={k} type="button" disabled={off} onClick={() => setKind(k)}
                  className={`h-11 rounded-xl text-[15px] font-semibold transition-colors disabled:opacity-30 ${kind === k ? 'bg-[var(--ion-color-primary)] text-white' : 'text-[var(--ion-color-medium)]'}`}>{l}</button>
              ))}
            </div>
          )}
          {sell && <div className="mt-4 text-[13px] text-[var(--ion-color-medium)]">You hold <b className="text-[var(--ion-text-color)]">{maxUnits.toLocaleString('en-IN', { maximumFractionDigits: 3 })} units</b> · {formatINR(h.currentValue)}</div>}

          {/* big amount */}
          <div className="mt-8 flex flex-col items-center">
            <div className="text-[13px] text-[var(--ion-color-medium)]">{sell ? 'Amount redeemed' : kind === 'SIP' ? 'SIP amount' : 'Amount invested'}</div>
            <div className="mt-1 flex items-baseline justify-center gap-1">
              <span className="text-[34px] font-semibold text-[var(--ion-color-medium)]">₹</span>
              <input inputMode="decimal" autoFocus value={unitsTyped ? Math.round(value).toLocaleString('en-IN') : /\.\d*$/.test(amount) ? amount : amount ? Number(amount).toLocaleString('en-IN') : ''} placeholder="0"
                onChange={(e) => { setUnitsTyped(''); setAmount(e.target.value.replace(/[^\d.]/g, '')) }}
                className="w-[60%] bg-transparent text-center text-[44px] font-bold tracking-tight text-[var(--ion-text-color)] outline-none placeholder:text-[var(--ion-color-step-300)]" />
            </div>
            <div className="mt-1 text-[13px] text-[var(--ion-color-medium)] tabular-nums">{units > 0 ? `≈ ${units.toLocaleString('en-IN', { maximumFractionDigits: 3 })} units at ₹${num(nav).toFixed(2)}` : `NAV ₹${num(nav).toFixed(2)}`}</div>
            <div className="mt-4 flex gap-2">
              {chips.map(([l, v]) => (
                <button key={l} type="button" className="ion-activatable h-9 rounded-full border border-[var(--ion-color-step-200)] px-4 text-[13px] font-semibold"
                  onClick={() => (sell ? (setUnitsTyped(String(maxUnits * v)), setAmount('')) : (setUnitsTyped(''), setAmount(String(num(amount) + v))))}>{l}</button>
              ))}
            </div>
          </div>

          <IonList inset lines="inset" className="cf-inset !mx-0 !mt-8">
            <IonItem><IonLabel>Date</IonLabel><IonDatetimeButton slot="end" datetime="cf-trade-date" className="cf-dt-btn" /></IonItem>
            <IonItem><IonInput label="NAV (₹)" labelPlacement="start" inputMode="decimal" value={nav} onIonInput={(e) => setNav(String(e.detail.value || ''))} className="cf-right-input" /></IonItem>
            <IonItem><IonInput label="Units" labelPlacement="start" inputMode="decimal" value={unitsTyped || (units ? String(Math.round(units * 1000) / 1000) : '')} onIonInput={(e) => setUnitsTyped(String(e.detail.value || ''))} className="cf-right-input" /></IonItem>
            <IonItem><IonInput label="Notes" labelPlacement="start" placeholder="Optional" value={notes} onIonInput={(e) => setNotes(String(e.detail.value || ''))} className="cf-right-input" /></IonItem>
          </IonList>
          <IonModal keepContentsMounted className="cf-dt-modal">
            <IonDatetime id="cf-trade-date" presentation="date" value={date} max={today()} showDefaultButtons doneText="Done" cancelText="Cancel"
              onIonChange={(e) => setDate(String(e.detail.value || '').slice(0, 10))} />
          </IonModal>
          {err && <p className="mt-3 text-center text-[13px] text-rose-400">{err}</p>}
          <p className="mt-4 mb-6 text-center text-[12px] text-[var(--ion-color-medium)]">This records what you did in your fund app. Nothing is bought or sold here.</p>
        </div>
      </IonContent>
      <IonFooter className="ion-no-border">
        <div className="px-4 pt-2" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}>
          <IonButton expand="block" className="cf-big-btn !w-full" disabled={saving} onClick={save}>{saving ? <IonSpinner name="crescent" /> : `${cta}${value > 0 ? ` · ₹${Math.round(value).toLocaleString('en-IN')}` : ''}`}</IonButton>
        </div>
      </IonFooter>
    </IonModal>
  )
}
