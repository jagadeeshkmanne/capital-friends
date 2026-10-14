// Phone app shell built with Ionic (Material look, Capital Friends colours).
// Top app bar (title / back / actions), scrolling content, footer actions + bottom tab bar.
// Desktop never loads this file (Layout lazy-loads it below 1024 px).
import { useEffect, useRef, useState } from 'react'
import { Outlet, useLocation, useNavigate, useNavigationType } from 'react-router-dom'
import { motion } from 'motion/react'
import {
  IonApp, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent, IonFooter,
  IonTabBar, IonTabButton, IonLabel, IonBadge, IonModal, IonList, IonListHeader, IonItem, IonRadioGroup, IonRadio,
  IonToggle, IonAvatar, IonNote, IonRefresher, IonRefresherContent,
} from '@ionic/react'
import { LayoutDashboard, Wallet, BarChart3, Target, Menu, ChevronLeft, Bell, TrendingDown, Scale, Settings, LogOut, Eye, Moon, X } from 'lucide-react'
import './ionic-setup'
import { usePhoneBar } from '../components/native'
import { mobileTitle, isTabPath } from '../components/Header'
import { useFamily } from '../context/FamilyContext'
import { useAuth } from '../context/AuthContext'
import { useMask } from '../context/MaskContext'
import { useTheme } from '../context/ThemeContext'
import { useData } from '../context/DataContext'
import useAlerts from '../hooks/useAlerts'
import Modal from '../components/Modal'
import MFBuyOpportunities from '../components/forms/MFBuyOpportunities'
import MFRebalanceDialog from '../components/forms/MFRebalanceDialog'
import DailyUpdatesBanner from '../components/DailyUpdatesBanner'
import GoalsReachBanner from '../components/GoalsReachBanner'


const TABS = [
  { key: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { key: '/investments/mutual-funds', label: 'Funds', icon: Wallet },
  { key: '/investments/stocks', label: 'Stocks', icon: BarChart3 },
  { key: '/goals', label: 'Goals', icon: Target },
  { key: '/more', label: 'More', icon: Menu },
]
const tabOf = (path) => (path.startsWith('/investments/funds') ? TABS[1] : path.startsWith('/retirement-buckets') ? TABS[3] : TABS.find((t) => path === t.key || path.startsWith(t.key + '/')) || (/^\/(family|insurance|investments\/other|liabilities|reminders|settings|import|health-check|about|accounts\/(investment|bank))/.test(path) ? TABS[4] : TABS[0])).key

const LOGO = `${import.meta.env.BASE_URL}logo-new.png`

export default function PhoneLayout() {
  const { pathname, search } = useLocation()
  const navigate = useNavigate()
  const bar = usePhoneBar()
  const content = useRef(null)
  const { settling, refreshAll } = useData()
  const { criticalAlerts = [], upcomingReminders = [], investmentSignals = {} } = useAlerts()
  const { buyOppCount = 0, rebalanceCount = 0 } = investmentSignals
  const [me, setMe] = useState(false)
  const [dialog, setDialog] = useState(null)
  const initial = useFamilyInitial()

  // native-style page change: tabs cross-fade, opening a page slides in from the right, Back slides from the left
  const navType = useNavigationType()
  const prevPath = useRef(pathname)
  const first = prevPath.current === pathname // first page after load: no slide
  const kind = first ? 'none' : isTabPath(pathname) && isTabPath(prevPath.current) ? 'fade' : navType === 'POP' ? 'back' : 'push'
  useEffect(() => { prevPath.current = pathname }, [pathname])
  const from = { none: false, fade: { opacity: 0 }, push: { x: '30%', opacity: 0 }, back: { x: '-25%', opacity: 0 } }[kind]

  // every new page (or pushed screen) starts at the top
  useEffect(() => { content.current?.scrollToTop?.(0) }, [pathname, search])

  const sub = bar?.onBack || !isTabPath(pathname)
  const back = () => (bar?.onBack ? bar.onBack() : window.history.state?.idx > 0 ? navigate(-1) : navigate('/more'))
  const title = bar?.title || mobileTitle(pathname)
  // swipe from the left edge to go back, like a phone app
  const backRef = useRef(back); backRef.current = sub ? back : null
  useEffect(() => {
    let x0 = null, y0 = 0
    const start = (e) => { const t = e.touches[0]; x0 = t.clientX <= 24 ? t.clientX : null; y0 = t.clientY }
    const end = (e) => {
      if (x0 == null) return
      const t = e.changedTouches[0]
      if (t.clientX - x0 > 70 && Math.abs(t.clientY - y0) < 60) backRef.current?.()
      x0 = null
    }
    window.addEventListener('touchstart', start, { passive: true }); window.addEventListener('touchend', end)
    return () => { window.removeEventListener('touchstart', start); window.removeEventListener('touchend', end) }
  }, [])
  const notif = criticalAlerts.length + upcomingReminders.length
  const signals = !bar?.onBack && (pathname === '/dashboard' || pathname.startsWith('/investments/mutual-funds')) // buy / rebalance badges only where they matter
  const active = tabOf(pathname)

  return (
    <IonApp className="cf-phone" style={{ '--cf-fab-bottom': sub ? '20px' : '84px' }}>
      <div className="ion-page">
        <IonHeader id="cf-phone-header" className="ion-no-border cf-phone-header">
          <IonToolbar>
            <IonButtons slot="start">
              {sub
                ? <IonButton onClick={back} aria-label="Back" className="cf-icon-btn"><ChevronLeft size={26} /></IonButton>
                : <img src={LOGO} alt="" className="h-7 w-auto ml-3 mr-1" />}
            </IonButtons>
            <IonTitle className={sub ? 'cf-title cf-title-sub' : 'cf-title'}>
              <div className="truncate">{title}</div>
              {bar?.subtitle && <div className="cf-subtitle truncate">{bar.subtitle}</div>}
            </IonTitle>
            <IonButtons slot="end">
              {bar?.right ? bar.right : (<>
                {signals && buyOppCount > 0 && <IonButton className="cf-icon-btn" onClick={() => setDialog('buyopp')} aria-label="Funds below their peak"><span className="relative text-emerald-400"><TrendingDown size={21} /><IonBadge color="success" className="cf-badge">{buyOppCount}</IonBadge></span></IonButton>}
                {signals && rebalanceCount > 0 && <IonButton className="cf-icon-btn" onClick={() => setDialog('rebalance')} aria-label="Rebalance"><span className="relative text-violet-300"><Scale size={21} /><IonBadge color="primary" className="cf-badge">{rebalanceCount}</IonBadge></span></IonButton>}
                <IonButton className="cf-icon-btn" onClick={() => navigate('/reminders')} aria-label="Notifications"><span className="relative"><Bell size={21} />{notif > 0 && <IonBadge color="danger" className="cf-badge">{notif}</IonBadge>}</span></IonButton>
              </>)}
              <IonButton className="cf-icon-btn" onClick={() => setMe(true)} aria-label="Account"><span className="w-8 h-8 rounded-full bg-violet-500 text-white flex items-center justify-center text-[13px] font-bold">{initial}</span></IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>

        <IonContent ref={content} className="cf-phone-content">
          {refreshAll && (
            <IonRefresher slot="fixed" onIonRefresh={async (e) => { try { await refreshAll() } finally { e.detail.complete() } }}>
              <IonRefresherContent />
            </IonRefresher>
          )}
          <div className="px-4 pt-2 pb-6">
            {settling && (
              <div className="mb-3 flex items-center gap-2 rounded-xl border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-xs text-[var(--text-primary)]">
                <span className="inline-block h-3 w-3 rounded-full border-2 border-violet-400 border-t-transparent animate-spin" />
                Updating your fund values. Up to a minute after an import.
              </div>
            )}
            <DailyUpdatesBanner />
            <GoalsReachBanner />
            <motion.div key={pathname} initial={from} animate={{ x: 0, opacity: 1 }} transition={kind === 'fade' ? { duration: 0.16 } : { type: 'spring', stiffness: 420, damping: 40, mass: 0.8 }}>
              <Outlet />
            </motion.div>
          </div>
        </IonContent>

        <IonFooter className="ion-no-border cf-phone-footer">
          {bar?.footer && <div className="cf-footer-actions">{bar.footer}</div>}
          {!sub && <IonTabBar selectedTab={active} className="cf-tabbar">
            {TABS.map(({ key, label, icon: I }) => (
              <IonTabButton key={key} tab={key} selected={active === key} onClick={(e) => { e.preventDefault(); navigate(key) }}>
                <span className={`cf-tab-pill ${active === key ? 'on' : ''}`}><I size={22} strokeWidth={active === key ? 2.3 : 1.8} /></span>
                <IonLabel>{label}</IonLabel>
              </IonTabButton>
            ))}
          </IonTabBar>}
          {sub && <div style={{ height: 'env(safe-area-inset-bottom)' }} />}
        </IonFooter>
      </div>

      <AccountSheet open={me} onClose={() => setMe(false)} navigate={navigate} />
      <Modal open={dialog === 'buyopp'} onClose={() => setDialog(null)} title="Funds below their peak" wide>{dialog === 'buyopp' && <MFBuyOpportunities />}</Modal>
      <Modal open={dialog === 'rebalance'} onClose={() => setDialog(null)} title="Rebalance" wide>{dialog === 'rebalance' && <MFRebalanceDialog />}</Modal>
    </IonApp>
  )
}

function useFamilyInitial() {
  const { selectedMember, familyMembers = [] } = useFamily()
  const m = familyMembers.find((x) => x.memberId === selectedMember)
  return m ? String(m.memberName || '?').charAt(0).toUpperCase() : 'F'
}

/** Account sheet: whose money you're looking at, mask, theme, settings, sign out. */
function AccountSheet({ open, onClose, navigate }) {
  const { selectedMember, setSelectedMember, familyMembers = [] } = useFamily()
  const { user, signOut } = useAuth()
  const { masked, toggleMask, mv } = useMask()
  const { theme, toggle } = useTheme()
  const go = (p) => { onClose(); setTimeout(() => navigate(p), 150) }
  return (
    <IonModal isOpen={open} onDidDismiss={onClose} breakpoints={[0, 0.75, 1]} initialBreakpoint={0.75} handle className="cf-sheet">
      <IonContent>
        <div className="flex items-center justify-between px-4 pt-3">
          <h2 className="text-[20px] font-bold">Account</h2>
          <IonButton fill="clear" color="medium" onClick={onClose} aria-label="Close"><X size={22} /></IonButton>
        </div>
        <IonList inset lines="none" className="cf-inset">
          <IonItem>
            <IonAvatar slot="start" className="flex items-center justify-center bg-violet-500 text-white font-bold">{String(user?.name || user?.email || 'U').charAt(0).toUpperCase()}</IonAvatar>
            <IonLabel><h2 className="!font-semibold">{user?.name || 'Signed in'}</h2><p>{user?.email}</p></IonLabel>
          </IonItem>
        </IonList>
        <IonListHeader><IonLabel className="cf-group">Viewing as</IonLabel></IonListHeader>
        <IonList inset lines="inset" className="cf-inset">
          <IonRadioGroup value={selectedMember} onIonChange={(e) => { setSelectedMember(e.detail.value); onClose() }}>
            <IonItem><IonRadio value="all" justify="space-between">Everyone<IonNote className="block text-xs">All family members</IonNote></IonRadio></IonItem>
            {familyMembers.map((m) => (
              <IonItem key={m.memberId}><IonRadio value={m.memberId} justify="space-between">{mv(m.memberName, 'name')}{m.relationship && <IonNote className="block text-xs">{m.relationship}</IonNote>}</IonRadio></IonItem>
            ))}
          </IonRadioGroup>
        </IonList>
        <IonList inset lines="inset" className="cf-inset">
          <IonItem><span slot="start" className="text-violet-400"><Eye size={20} /></span><IonToggle checked={masked} onIonChange={toggleMask}>Mask sensitive data</IonToggle></IonItem>
          <IonItem><span slot="start" className="text-violet-400"><Moon size={20} /></span><IonToggle checked={theme === 'dark'} onIonChange={toggle}>Dark mode</IonToggle></IonItem>
          <IonItem button detail onClick={() => go('/settings')}><span slot="start" className="text-violet-400"><Settings size={20} /></span><IonLabel>Settings</IonLabel></IonItem>
        </IonList>
        <IonList inset lines="none" className="cf-inset">
          <IonItem button onClick={() => { onClose(); signOut() }}><span slot="start" className="text-rose-400"><LogOut size={20} /></span><IonLabel color="danger">Sign out</IonLabel></IonItem>
        </IonList>
        <div className="h-8" />
      </IonContent>
    </IonModal>
  )
}
