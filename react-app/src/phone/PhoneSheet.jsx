// Phone dialogs. Big ones (forms, lists) open as a full page with a back arrow, like an app screen;
// small ones open as a bottom sheet you can swipe down. Capital Friends colours.
import { IonModal, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent } from '@ionic/react'
import './ionic-setup'
import { X, ArrowLeft } from 'lucide-react'

export default function PhoneSheet({ open, onClose, title, children, full }) {
  if (full) {
    return (
      <IonModal isOpen={!!open} onDidDismiss={onClose} className="cf-page-modal">
        <IonHeader className="ion-no-border">
          <IonToolbar>
            <IonButtons slot="start"><IonButton onClick={onClose} className="cf-icon-btn" aria-label="Back"><ArrowLeft size={24} /></IonButton></IonButtons>
            <IonTitle className="cf-title">{title}</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding cf-form-page">{open ? children : null}<div style={{ height: 'calc(env(safe-area-inset-bottom) + 96px)' }} /></IonContent>
      </IonModal>
    )
  }
  return (
    <IonModal isOpen={!!open} onDidDismiss={onClose} breakpoints={[0, 0.6, 1]} initialBreakpoint={0.6} handle className="cf-sheet">
      <IonHeader className="ion-no-border">
        <IonToolbar style={{ '--background': 'var(--ion-background-color)', '--border-width': 0, '--padding-start': '12px' }}>
          <IonTitle className="cf-title" style={{ fontSize: 19 }}>{title}</IonTitle>
          <IonButtons slot="end"><IonButton onClick={onClose} color="medium" aria-label="Close"><X size={22} /></IonButton></IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">{open ? children : null}<div style={{ height: 'calc(env(safe-area-inset-bottom) + 16px)' }} /></IonContent>
    </IonModal>
  )
}
