// Native (Ionic) alert, toast and loading for phones. The app's Confirm / Toast contexts render these below 1024 px.
import { IonAlert, IonToast, IonLoading } from '@ionic/react'
import './ionic-setup'

export function PhoneConfirm({ dialog, onConfirm, onCancel }) {
  return (
    <IonAlert isOpen={!!dialog} header={dialog?.title} message={dialog?.message} cssClass="cf-alert" backdropDismiss
      onDidDismiss={(e) => (e.detail.role === 'confirm' ? onConfirm() : onCancel())}
      buttons={[
        { text: dialog?.cancelLabel || 'Cancel', role: 'cancel' },
        { text: dialog?.confirmLabel || 'OK', role: 'confirm', cssClass: dialog?.destructive ? 'cf-alert-danger' : 'cf-alert-primary' },
      ]} />
  )
}

const COLOR = { error: 'danger', warning: 'warning', success: 'success' }
export function PhoneToasts({ toasts, dismiss }) {
  return toasts.map((t) => (
    <IonToast key={t.id} isOpen message={t.message} position="top" positionAnchor="cf-phone-header" duration={0}
      color={COLOR[t.type] || 'success'} className="cf-toast" swipeGesture="vertical" onDidDismiss={() => dismiss(t.id)} />
  ))
}

export function PhoneLoading({ message }) {
  return <IonLoading isOpen={!!message} message={message || ''} spinner="crescent" className="cf-loading" />
}
