// More (the full app menu) on phones: Ionic grouped lists, like a phone settings screen.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IonList, IonItem, IonLabel, IonListHeader, IonNote, IonBadge } from '@ionic/react'
import './ionic-setup'
import { Users, CreditCard, Briefcase, Shield, BarChart3, Package, Landmark, Bell, Zap, FileUp, Settings, Info, Heart, Youtube, Instagram, Lock, FileText, PieChart, CircleAlert, Lightbulb, Scale, FlaskConical, Compass } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import DonateDialog from '../components/DonateDialog'
import { openFeedback } from '../components/FeedbackForm'
import { YOUTUBE_URL, INSTAGRAM_URL } from '../components/FollowCard'

const GROUPS = [
  ['Family and accounts', [
    ['Family Members', 'People and their details', Users, '/family', '#a78bfa'],
    ['Bank Accounts', 'Savings and current accounts', Landmark, '/accounts/bank', '#38bdf8'],
    ['Investment Accounts', 'Demat, broker, distributor', Briefcase, '/accounts/investment', '#60a5fa'],
    ['Insurance', 'Term and health policies', Shield, '/insurance', '#22d3ee'],
  ]],
  ['Investments', [
    ['Stocks', 'Import from Excel', BarChart3, '/investments/stocks', '#818cf8'],
    ['Other Investments', 'FD, EPF, PPF, gold, property', Package, '/investments/other', '#2dd4bf'],
    ['Liabilities', 'Loans and outstanding', CreditCard, '/liabilities', '#fb7185'],
    ['All Funds', 'Every fund across the family', PieChart, '/investments/funds', '#34d399'],
  ]],
  ['Planning', [
    ['Reminders', 'SIP dates, premiums, renewals', Bell, '/reminders', '#fbbf24'],
    ['Health Check', 'Insurance, emergency fund, Will', Zap, '/health-check', '#34d399'],
    ['Import Statement', 'All your funds from a CAMS PDF', FileUp, '/import', '#a78bfa', 'NEW'],
  ]],
  ['App', [
    ['Settings', 'Daily email, alerts and reminders', Settings, '/settings', '#94a3b8'],
    ['About', 'Capital Friends', Info, '/about', '#c4b5fd'],
    ['Privacy', 'Your data stays in your Drive', Lock, '/privacy', '#94a3b8'],
    ['Terms', null, FileText, '/terms', '#94a3b8'],
  ]],
]

const Icon = ({ I, c }) => <span slot="start" className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: `${c}22`, color: c }}><I size={19} /></span>

// Admin (only the admin email) or Research (emails the admin shared the fund rule and stock rule with); same links
// as the profile menu on a laptop. Shown first so it is found without scrolling.
function ResearchGroup() {
  const navigate = useNavigate()
  const { isAdmin, isResearch } = useAuth()
  if (!isResearch) return null
  const items = [['Fund rule', 'Index fund + gold rule', Scale, '/admin/fund-rule', '#38bdf8'], ['Stock rule', '15 momentum stocks + gold rule', FlaskConical, '/admin/paper', '#a3e635']]
  if (isAdmin) items.push(['Found us', 'How families heard about the app', Compass, '/admin/found-us', '#34d399'])
  return (
    <>
      <IonListHeader className="!pl-5"><IonLabel className="cf-group">{isAdmin ? 'Admin · only you' : 'Research · shared with you'}</IonLabel></IonListHeader>
      <IonList inset lines="inset" className="cf-inset">
        {items.map(([label, sub, I, path, c]) => (
          <IonItem key={label} button detail onClick={() => navigate(path)}><Icon I={I} c={c} /><IonLabel><h3 className="!text-[15px] !font-semibold">{label}</h3><p>{sub}</p></IonLabel></IonItem>
        ))}
      </IonList>
    </>
  )
}

// Help & feedback: placed above the App group so it is easy to find without scrolling to the very end
function HelpGroup() {
  return (
    <>
      <IonListHeader className="!pl-5"><IonLabel className="cf-group">Help &amp; feedback</IonLabel></IonListHeader>
      <IonList inset lines="inset" className="cf-inset">
        <IonItem button detail onClick={() => openFeedback('issue')}><Icon I={CircleAlert} c="#f87171" /><IonLabel><h3 className="!text-[15px] !font-semibold">Report an issue</h3><p>Something not working? Tell us</p></IonLabel></IonItem>
        <IonItem button detail onClick={() => openFeedback('feature')}><Icon I={Lightbulb} c="#fbbf24" /><IonLabel><h3 className="!text-[15px] !font-semibold">Request a feature</h3><p>An idea to make it better</p></IonLabel></IonItem>
      </IonList>
    </>
  )
}

export default function PhoneMore() {
  const navigate = useNavigate()
  const [donate, setDonate] = useState(false)
  return (
    <div className="-mx-4 pb-6">
      <ResearchGroup />
      {GROUPS.map(([title, items]) => (<div key={title}>{title === 'App' && <HelpGroup />}
        <div>
          <IonListHeader className="!pl-5"><IonLabel className="cf-group">{title}</IonLabel></IonListHeader>
          <IonList inset lines="inset" className="cf-inset">
            {items.map(([label, sub, I, path, c, badge]) => (
              <IonItem key={label} button detail onClick={() => navigate(path)}>
                <Icon I={I} c={c} />
                <IonLabel><h3 className="!text-[15px] !font-semibold">{label}</h3>{sub && <p>{sub}</p>}</IonLabel>
                {badge && <IonBadge slot="end" color="success">{badge}</IonBadge>}
              </IonItem>
            ))}
          </IonList>
        </div>
      </div>))}
      <IonListHeader className="!pl-5"><IonLabel className="cf-group">Capital Friends</IonLabel></IonListHeader>
      <IonList inset lines="inset" className="cf-inset">
        <IonItem button detail href={YOUTUBE_URL} target="_blank"><Icon I={Youtube} c="#ef4444" /><IonLabel><h3 className="!text-[15px] !font-semibold">YouTube</h3><p>How-to videos</p></IonLabel></IonItem>
        <IonItem button detail href={INSTAGRAM_URL} target="_blank"><Icon I={Instagram} c="#ec4899" /><IonLabel><h3 className="!text-[15px] !font-semibold">Instagram</h3></IonLabel></IonItem>
        <IonItem button detail onClick={() => setDonate(true)}><Icon I={Heart} c="#f59e0b" /><IonLabel><h3 className="!text-[15px] !font-semibold">Support the developer</h3><p>Capital Friends is free</p></IonLabel></IonItem>
      </IonList>
      <p className="pt-5 text-center text-[12px] text-[var(--ion-color-medium)]">Capital Friends v1.0 · Your data, your Drive</p>
      <DonateDialog open={donate} onClose={() => setDonate(false)} />
    </div>
  )
}
