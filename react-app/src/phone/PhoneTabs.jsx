// Top tabs on phones (Holdings | Actions 2 | History ...), sticky under the app bar. options: [[key, label, badge?]]
import '../phone/ionic-setup'
import { IonSegment, IonSegmentButton, IonLabel } from '@ionic/react'
export default function PhoneTabs({ value, onChange, options }) {
  return (
    <div className="cf-top-tabs-wrap -mx-4 -mt-2 mb-1">
      <IonSegment value={value} onIonChange={(e) => onChange(String(e.detail.value))} className="cf-top-tabs" scrollable>
        {options.filter(Boolean).map(([k, l, badge]) => <IonSegmentButton key={k} value={k}><IonLabel>{l}{badge > 0 && <span className="cf-tab-badge">{badge}</span>}</IonLabel></IonSegmentButton>)}
      </IonSegment>
    </div>
  )
}
