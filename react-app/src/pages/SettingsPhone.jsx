// Settings on phones: an Android-style settings screen (Ionic lists, switches, pickers). Changes save at once,
// like a phone's own settings. Same settings keys and API calls as the desktop Settings page.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '../phone/ionic-setup'
import { IonList, IonListHeader, IonItem, IonLabel, IonToggle, IonSelect, IonSelectOption, IonNote, IonSpinner, IonBadge } from '@ionic/react'
import { Moon, Eye, CloudDownload, RefreshCw, Clock, FileUp, Mail, Send, BellRing, CalendarDays, Users, Zap, Heart, LogOut } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'
import { useData } from '../context/DataContext'
import { useAuth } from '../context/AuthContext'
import { useMask } from '../context/MaskContext'
import { useToast } from '../context/ToastContext'
import { useConfirm } from '../context/ConfirmContext'
import * as api from '../services/api'
import { clearStocksCache } from '../components/forms/StockSearchInput'
import { suggestCasDay } from '../utils/incomePlan'
import DonateDialog from '../components/DonateDialog'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const Ico = ({ I, c = '#a78bfa' }) => <span slot="start" className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: `${c}22`, color: c }}><I size={18} /></span>
const Head = ({ children }) => <IonListHeader className="!pl-5"><IonLabel className="cf-group">{children}</IonLabel></IonListHeader>

function ago(ts) {
  if (!ts) return 'never'
  const d = new Date(ts); if (isNaN(d)) return 'unknown'
  const m = Math.floor((Date.now() - d) / 60000)
  if (m < 1) return 'just now'; if (m < 60) return `${m} min ago`
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

export default function SettingsPhone() {
  const navigate = useNavigate()
  const { theme, toggle } = useTheme()
  const { members = [], settings, updateSettings, updateMember, healthCheckCompleted, refreshData, isRefreshing, refreshSettings, mfTransactions } = useData()
  const { user, signOut } = useAuth()
  const { masked, toggleMask, mv } = useMask()
  const { showToast } = useToast()
  const confirm = useConfirm()
  const [daily, setDaily] = useState(null)
  const [importBeta, setImportBeta] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [sending, setSending] = useState(false)
  const [donate, setDonate] = useState(false)
  const sug = suggestCasDay(mfTransactions || [])
  const s = settings || {}
  const freq = s.EmailFrequency || 'Daily'
  const hour = String(s.EmailHour ?? 9).padStart(2, '0')
  const day = DAY_NAMES[Number(s.EmailDayOfWeek ?? 1)] || 'Monday'
  const on = (k, d = 'ON') => String(s[k] || d).toUpperCase() === 'ON'

  useEffect(() => {
    let alive = true
    const check = () => api.getDailyJobsStatus().then((r) => alive && setDaily(r && !r.unknown ? !!r.sync : null)).catch(() => alive && setDaily(null))
    check(); window.addEventListener('focus', check)
    api.importEnabled().then((r) => alive && setImportBeta(!!r?.enabled)).catch(() => {})
    return () => { alive = false; window.removeEventListener('focus', check) }
  }, [])

  // every change saves at once
  const save = async (patch, msg = 'Saved') => {
    try { await updateSettings(patch); showToast(msg) } catch (e) { showToast(e.message || 'Could not save', 'error') }
  }
  const saveEmail = (f, h, d) => save({
    EmailFrequency: f, EmailConfigured: f === 'None' ? 'FALSE' : 'TRUE', EmailHour: String(parseInt(h, 10)), EmailMinute: '0',
    EmailDayOfWeek: String(Math.max(0, DAY_NAMES.indexOf(d))),
  }, 'Email report saved')
  const refreshMarket = async () => {
    setRefreshing(true)
    try {
      const r = await api.refreshMasterData(); clearStocksCache()
      await Promise.all([refreshData(true), refreshSettings?.()])
      showToast(`Updated · ${r?.mf?.count || 0} funds, ${r?.stocks?.count || 0} stocks`)
    } catch (e) { showToast(e.message || 'Refresh failed', 'error') } finally { setRefreshing(false) }
  }
  const sendNow = async () => {
    setSending(true)
    try { await api.sendDashboardEmail(); showToast('Report sent') } catch { showToast('Could not send the report', 'error') } finally { setSending(false) }
  }
  const active = members.filter((m) => m.status === 'Active')
  const sel = (label, value, options, onChange, icon) => (
    <IonItem>
      {icon}
      <IonSelect label={label} value={value} interface="action-sheet" interfaceOptions={{ header: label }} onIonChange={(e) => onChange(e.detail.value)} className="cf-select">
        {options.map(([v, l]) => <IonSelectOption key={v} value={v}>{l}</IonSelectOption>)}
      </IonSelect>
    </IonItem>
  )

  return (
    <div className="-mx-4 pb-8">
      <IonList inset lines="none" className="cf-inset">
        <IonItem>
          <span slot="start" className="flex h-11 w-11 items-center justify-center rounded-full bg-violet-500 text-[17px] font-bold text-white">{String(user?.name || user?.email || 'U').charAt(0).toUpperCase()}</span>
          <IonLabel><h2 className="!text-[16px] !font-semibold">{user?.name || 'Signed in'}</h2><p>{mv(user?.email, 'email')}</p></IonLabel>
        </IonItem>
      </IonList>

      <Head>Appearance</Head>
      <IonList inset lines="inset" className="cf-inset">
        <IonItem><Ico I={Moon} /><IonToggle checked={theme === 'dark'} onIonChange={toggle}>Dark mode</IonToggle></IonItem>
        <IonItem><Ico I={Eye} c="#f59e0b" /><IonToggle checked={masked} onIonChange={toggleMask}><span>Mask sensitive data</span><span className="block text-[12px] text-[var(--ion-color-medium)]">Hides PAN, Aadhaar, mobile, email and account numbers</span></IonToggle></IonItem>
      </IonList>

      <Head>Data</Head>
      <IonList inset lines="inset" className="cf-inset">
        <IonItem button detail={false} disabled={isRefreshing} onClick={() => refreshData(true)}>
          <Ico I={CloudDownload} c="#38bdf8" /><IonLabel><h3 className="!text-[15px] !font-semibold">Sync app data</h3><p>Load everything again from your Google Sheet</p></IonLabel>
          {isRefreshing && <IonSpinner slot="end" name="crescent" />}
        </IonItem>
        <IonItem button detail={false} disabled={refreshing} onClick={refreshMarket}>
          <Ico I={RefreshCw} c="#34d399" /><IonLabel><h3 className="!text-[15px] !font-semibold">Refresh market data</h3><p>Fund NAVs, all-time highs, stock prices · last {ago(s.masterDataLastSync)}{s._navDataDate ? ` · NAV ${s._navDataDate}` : ''}</p></IonLabel>
          {refreshing ? <IonSpinner slot="end" name="crescent" /> : s._stale ? <IonBadge slot="end" color="warning">Old</IonBadge> : null}
        </IonItem>
        <IonItem button detail onClick={() => api.installUserTriggers()}>
          <Ico I={Clock} c="#a78bfa" /><IonLabel><h3 className="!text-[15px] !font-semibold">Daily updates</h3><p>Prices and the family email every day, even with the app closed</p></IonLabel>
          {daily != null && <IonBadge slot="end" color={daily ? 'success' : 'warning'}>{daily ? 'ON' : 'OFF'}</IonBadge>}
        </IonItem>
        {importBeta && <IonItem button detail onClick={() => navigate('/import')}><Ico I={FileUp} /><IonLabel><h3 className="!text-[15px] !font-semibold">Import statement</h3><p>All mutual fund transactions from a CAMS PDF</p></IonLabel></IonItem>}
      </IonList>

      <Head>Family email report</Head>
      <IonList inset lines="inset" className="cf-inset">
        {sel('Send', freq, [['Daily', 'Every day'], ['Weekly', 'Every week'], ['Monthly', 'Every month'], ['None', 'Never']], (v) => saveEmail(v, hour, day), <Ico I={Mail} c="#38bdf8" />)}
        {freq !== 'None' && sel('Time', hour, Array.from({ length: 24 }, (_, i) => { const h = String(i).padStart(2, '0'); return [h, `${h}:00`] }), (v) => saveEmail(freq, v, day), <Ico I={Clock} c="#38bdf8" />)}
        {freq === 'Weekly' && sel('Day', day, DAY_NAMES.slice(1).concat(DAY_NAMES[0]).map((d) => [d, d]), (v) => saveEmail(freq, hour, v), <Ico I={CalendarDays} c="#38bdf8" />)}
        <IonItem button detail={false} disabled={sending} onClick={sendNow}>
          <Ico I={Send} /><IonLabel><h3 className="!text-[15px] !font-semibold">Send the report now</h3><p>To everyone switched on below</p></IonLabel>
          {sending && <IonSpinner slot="end" name="crescent" />}
        </IonItem>
      </IonList>
      {active.length > 0 && (
        <>
          <Head>Who gets the report</Head>
          <IonList inset lines="inset" className="cf-inset">
            {active.map((m) => {
              const isOn = m.includeInEmailReports === 'Yes' || m.includeInEmailReports === true
              return (
                <IonItem key={m.memberId}>
                  <span slot="start" className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-500/20 text-[14px] font-bold text-violet-300">{String(m.memberName || '?').charAt(0)}</span>
                  <IonToggle checked={isOn} onIonChange={async (e) => { try { await updateMember(m.memberId, { ...m, includeInEmailReports: e.detail.checked ? 'Yes' : 'No' }) } catch { showToast('Could not save', 'error') } }}>
                    <span>{mv(m.memberName, 'name')}</span>{m.email && <span className="block text-[12px] text-[var(--ion-color-medium)]">{mv(m.email, 'email')}</span>}
                  </IonToggle>
                </IonItem>
              )
            })}
          </IonList>
        </>
      )}

      <Head>Alerts and reminders</Head>
      <IonList inset lines="inset" className="cf-inset">
        <IonItem><Ico I={BellRing} c="#34d399" /><IonToggle checked={on('AlertsBuckets')} onIonChange={(e) => save({ AlertsBuckets: e.detail.checked ? 'ON' : 'OFF' })}><span>Retirement and income alerts</span><span className="block text-[12px] text-[var(--ion-color-medium)]">Refill due, income running low, FD matured</span></IonToggle></IonItem>
        <IonItem><Ico I={FileUp} c="#a78bfa" /><IonToggle checked={on('CasReminder')} onIonChange={(e) => save({ CasReminder: e.detail.checked ? 'ON' : 'OFF' })}><span>Monthly CAS import reminder</span><span className="block text-[12px] text-[var(--ion-color-medium)]">{sug.sipDays.length ? `Your SIPs run on the ${sug.sipDays.join(', ')}` : 'A few days after your SIP dates'}</span></IonToggle></IonItem>
        {on('CasReminder') && sel('Reminder day', String(s.CasReminderDay || sug.day), Array.from({ length: 28 }, (_, i) => [String(i + 1), `Day ${i + 1} of the month`]), (v) => save({ CasReminderDay: String(v) }), <Ico I={CalendarDays} c="#a78bfa" />)}
        {sel('Send alerts to', s.AlertsTo === 'all' ? 'all' : 'self', [['self', 'Only me'], ['all', 'Everyone on the report']], (v) => save({ AlertsTo: v }), <Ico I={Users} c="#60a5fa" />)}
      </IonList>
      <p className="px-5 pt-2 text-[12px] text-[var(--ion-color-medium)]">Short separate emails, only when something needs doing. They need Daily updates ON.</p>

      <Head>More</Head>
      <IonList inset lines="inset" className="cf-inset">
        <IonItem button detail onClick={() => navigate('/health-check')}><Ico I={Zap} c="#fbbf24" /><IonLabel><h3 className="!text-[15px] !font-semibold">Financial health check</h3><p>{healthCheckCompleted ? 'Done · update your answers' : 'Seven yes / no questions'}</p></IonLabel>{healthCheckCompleted && <IonNote slot="end" color="success">Done</IonNote>}</IonItem>
        <IonItem button detail onClick={() => setDonate(true)}><Ico I={Heart} c="#f59e0b" /><IonLabel><h3 className="!text-[15px] !font-semibold">Support the developer</h3><p>Capital Friends is free</p></IonLabel></IonItem>
      </IonList>
      <IonList inset lines="none" className="cf-inset">
        <IonItem button detail={false} onClick={async () => { if (await confirm('Sign out of Capital Friends? Your data stays in your Google Drive.', { title: 'Sign out', confirmLabel: 'Sign out' })) signOut() }}>
          <Ico I={LogOut} c="#fb7185" /><IonLabel color="danger">Sign out</IonLabel>
        </IonItem>
      </IonList>
      <DonateDialog open={donate} onClose={() => setDonate(false)} />
    </div>
  )
}
