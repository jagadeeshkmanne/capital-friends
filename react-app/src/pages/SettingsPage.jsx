import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Moon, Sun, Mail, ChevronDown, ChevronRight, RefreshCw, Database, User, LogOut, Zap, EyeOff, Eye, CloudDownload, Heart, Send, Palette } from 'lucide-react'
import DonateDialog from '../components/DonateDialog'
import { useTheme } from '../context/ThemeContext'
import { useData } from '../context/DataContext'
import { useAuth } from '../context/AuthContext'
import { useMask } from '../context/MaskContext'
import * as api from '../services/api'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default function SettingsPage() {
  const navigate = useNavigate()
  const { theme, toggle } = useTheme()
  const { members, settings, updateSettings, updateMember, healthCheckCompleted, refreshData, isRefreshing } = useData()
  const { user, signOut } = useAuth()
  const { masked, toggleMask, mv } = useMask()
  const [showDonate, setShowDonate] = useState(false)
  const activeMembers = members.filter((m) => m.status === 'Active')

  // Local form state (synced from backend settings)
  const [emailFreq, setEmailFreq] = useState('Daily')
  const [emailHour, setEmailHour] = useState('09')
  const [emailDay, setEmailDay] = useState('Monday')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Send email now
  const [sendingEmail, setSendingEmail] = useState(false)
  const [emailStatus, setEmailStatus] = useState(null) // 'sent' | 'error'

  // Data refresh state
  const [refreshing, setRefreshing] = useState(false)
  const [refreshResult, setRefreshResult] = useState(null)

  // Sync local state from backend settings when they load
  useEffect(() => {
    if (!settings || !Object.keys(settings).length) return
    if (settings.EmailFrequency) setEmailFreq(settings.EmailFrequency)
    if (settings.EmailHour != null) setEmailHour(String(settings.EmailHour).padStart(2, '0'))
    if (settings.EmailDayOfWeek != null) setEmailDay(DAY_NAMES[Number(settings.EmailDayOfWeek)] || 'Monday')
  }, [settings])

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    try {
      const dayIndex = DAY_NAMES.indexOf(emailDay)
      await updateSettings({
        EmailFrequency: emailFreq === 'None' ? 'None' : emailFreq,
        EmailConfigured: emailFreq === 'None' ? 'FALSE' : 'TRUE',
        EmailHour: String(parseInt(emailHour, 10)),
        EmailMinute: '0',
        EmailDayOfWeek: String(dayIndex >= 0 ? dayIndex : 1),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      alert('Failed to save: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleRefresh() {
    setRefreshing(true)
    setRefreshResult(null)
    try {
      const result = await api.refreshMasterData()
      setRefreshResult(result)
    } catch (err) {
      setRefreshResult({ error: err.message })
    } finally {
      setRefreshing(false)
    }
  }

  function formatLastSync(ts) {
    if (!ts) return 'Never'
    try {
      const d = new Date(ts)
      if (isNaN(d.getTime())) return 'Unknown'
      const now = Date.now()
      const mins = Math.floor((now - d.getTime()) / (1000 * 60))
      if (mins < 1) return 'Just now'
      if (mins < 60) return mins + ' min ago'
      const hrs = Math.floor(mins / 60)
      if (hrs < 24) return hrs + 'h ago'
      return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    } catch {
      return 'Unknown'
    }
  }

  return (
    <div className="space-y-4 max-w-xl mx-auto">

      {/* Account */}
      <Card>
        <CardHeader icon={<User size={14} />} title="Account" />
        <div className="px-4 py-4 space-y-3">
          <Row label="Signed in as">
            <p className="text-xs font-semibold text-[var(--text-primary)] truncate max-w-[200px]">{mv(user?.email, 'email') || '—'}</p>
          </Row>
          <Row label="Name">
            <p className="text-xs font-semibold text-[var(--text-primary)]">{user?.name || '—'}</p>
          </Row>
          <div className="pt-1">
            <button
              onClick={signOut}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-500 border border-red-200 dark:border-red-800/40 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              <LogOut size={12} />
              Sign Out
            </button>
          </div>
        </div>
      </Card>

      {/* Preferences — theme + privacy */}
      <Card>
        <CardHeader icon={<Palette size={14} />} title="Preferences" />
        <div className="px-4 py-4 space-y-3">
          <Row label="Theme">
            <button
              onClick={toggle}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
            >
              {theme === 'dark' ? <Moon size={12} /> : <Sun size={12} />}
              {theme === 'dark' ? 'Dark' : 'Light'}
            </button>
          </Row>
          <div className="border-t border-[var(--border-light)]" />
          <Row label="Mask sensitive data">
            <button
              onClick={toggleMask}
              className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${masked ? 'bg-amber-500' : 'bg-[var(--bg-inset)] border border-[var(--border)]'}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${masked ? 'left-[18px] bg-white' : 'left-0.5 bg-[var(--text-dim)]'}`} />
            </button>
          </Row>
          <p className="text-[11px] text-[var(--text-dim)]">
            Hides PAN, Aadhaar, mobile, email & account numbers. Use the {masked ? <EyeOff size={10} className="inline text-amber-400" /> : <Eye size={10} className="inline" />} icon in the header to quickly toggle.
          </p>
          {masked && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <EyeOff size={13} className="text-amber-400 shrink-0" />
              <p className="text-[11px] text-amber-400 font-medium">Data masking active — safe for screen sharing</p>
            </div>
          )}
        </div>
      </Card>

      {/* Data & Sync */}
      <Card>
        <CardHeader icon={<Database size={14} />} title="Data & Sync" />
        <div className="px-4 py-4 space-y-4">
          {/* Sync App Data */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-[var(--text-primary)]">Sync App Data</p>
              <p className="text-[11px] text-[var(--text-dim)] mt-0.5">Re-fetch all data from your Google Sheet</p>
            </div>
            <button
              onClick={() => refreshData(true)}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors disabled:opacity-50"
            >
              <CloudDownload size={12} className={isRefreshing ? 'animate-pulse' : ''} />
              {isRefreshing ? 'Syncing...' : 'Sync Now'}
            </button>
          </div>

          <div className="border-t border-[var(--border-light)]" />

          {/* Refresh Market Data */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-[var(--text-primary)]">Refresh Market Data</p>
                <p className="text-[11px] text-[var(--text-dim)] mt-0.5">Update MF NAVs, ATH & Stock prices</p>
              </div>
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-violet-600 text-white hover:bg-violet-500 transition-colors disabled:opacity-50"
              >
                <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
                {refreshing ? 'Refreshing...' : 'Refresh Now'}
              </button>
            </div>
            <div className="flex items-center gap-4 text-[11px] text-[var(--text-dim)]">
              <span>Last: <span className="font-medium text-[var(--text-muted)]">{formatLastSync(settings.masterDataLastSync)}</span></span>
              {settings._stale && (
                <span className="font-bold text-amber-600 px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-[10px]">STALE</span>
              )}
              {settings._navDataDate && (
                <span>NAV: <span className="font-medium text-[var(--text-muted)]">{settings._navDataDate}</span></span>
              )}
            </div>
          </div>
          {refreshResult && (
            <div className={`text-xs px-3 py-2 rounded-lg ${refreshResult.error ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400' : 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400'}`}>
              {refreshResult.error
                ? 'Failed: ' + refreshResult.error
                : `Done — MF: ${refreshResult.mf?.count || 0} | ATH: ${refreshResult.ath?.count || 0} | Stocks: ${refreshResult.stocks?.count || 0} (${refreshResult.duration})`
              }
            </div>
          )}
        </div>
      </Card>

      {/* Email Reports */}
      <Card>
        <CardHeader icon={<Mail size={14} />} title="Email Reports" />
        <div className="px-4 py-4 space-y-3">
          {/* Schedule */}
          <Row label="Frequency">
            <Select value={emailFreq} onChange={setEmailFreq} options={['Daily', 'Weekly', 'Monthly', 'None']} />
          </Row>
          {emailFreq !== 'None' && (
            <Row label="Send time">
              <Select value={emailHour} onChange={setEmailHour} options={
                Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
              } suffix=":00" />
            </Row>
          )}
          {emailFreq === 'Weekly' && (
            <Row label="Day">
              <Select value={emailDay} onChange={setEmailDay} options={DAY_NAMES.slice(1).concat(DAY_NAMES[0])} />
            </Row>
          )}
          <div className="flex justify-end pt-1">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-500 rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : saved ? 'Saved!' : 'Save'}
            </button>
          </div>

          {/* Member email toggles */}
          {activeMembers.length > 0 && (
            <div className="border-t border-[var(--border-light)] pt-3">
              <p className="text-xs text-[var(--text-dim)] mb-2">Send report to</p>
              <div className="space-y-2">
                {activeMembers.map((m) => (
                  <MemberEmailToggle key={m.memberId} member={m} onToggle={updateMember} />
                ))}
              </div>
            </div>
          )}
          {activeMembers.length === 0 && (
            <p className="text-xs text-[var(--text-dim)] pt-1">Add family members to configure email recipients.</p>
          )}

          {/* Send Now */}
          <div className="border-t border-[var(--border-light)] pt-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-[var(--text-secondary)]">Send Report Now</p>
                <p className="text-[11px] text-[var(--text-dim)]">Send wealth report to all enabled members</p>
              </div>
              <button
                onClick={async () => {
                  setSendingEmail(true)
                  setEmailStatus(null)
                  try {
                    await api.sendDashboardEmail()
                    setEmailStatus('sent')
                    setTimeout(() => setEmailStatus(null), 5000)
                  } catch (e) {
                    setEmailStatus('error')
                    setTimeout(() => setEmailStatus(null), 5000)
                  } finally {
                    setSendingEmail(false)
                  }
                }}
                disabled={sendingEmail}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                style={{
                  background: emailStatus === 'sent' ? 'rgba(16,185,129,0.1)' : emailStatus === 'error' ? 'rgba(248,113,113,0.1)' : 'rgba(139,92,246,0.1)',
                  color: emailStatus === 'sent' ? '#34d399' : emailStatus === 'error' ? '#f87171' : '#a78bfa',
                  border: `1px solid ${emailStatus === 'sent' ? 'rgba(16,185,129,0.2)' : emailStatus === 'error' ? 'rgba(248,113,113,0.2)' : 'rgba(139,92,246,0.2)'}`,
                }}
              >
                {sendingEmail ? <RefreshCw size={12} className="animate-spin" /> : <Send size={12} />}
                {sendingEmail ? 'Sending...' : emailStatus === 'sent' ? 'Sent!' : emailStatus === 'error' ? 'Failed' : 'Send Now'}
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* Financial Health Check */}
      <button onClick={() => navigate('/health-check')}
              className="w-full text-left bg-[var(--bg-card)] rounded-xl border border-[var(--border)] overflow-hidden hover:bg-[var(--bg-hover)] transition-colors">
        <div className="flex items-center gap-3 px-4 py-3.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-amber-500/15">
            <Zap size={15} className="text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-[var(--text-primary)]">Financial Health Check</p>
            <p className="text-[11px] text-[var(--text-dim)]">
              {healthCheckCompleted ? 'Completed — update your answers' : 'Take the health check questionnaire'}
            </p>
          </div>
          {healthCheckCompleted && <span className="text-[10px] font-bold text-emerald-400 px-1.5 py-0.5 rounded bg-emerald-500/10 shrink-0">Done</span>}
          <ChevronRight size={14} className="text-[var(--text-dim)] shrink-0" />
        </div>
      </button>

      {/* Support Developer */}
      <button
        onClick={() => setShowDonate(true)}
        className="w-full text-left rounded-xl border border-amber-500/25 p-4 hover:border-amber-500/40 transition-colors"
        style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.06) 0%, rgba(139,92,246,0.04) 100%)' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-amber-500/15">
            <Heart size={20} className="text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-400">Support the Developer</p>
            <p className="text-[11px] text-[var(--text-dim)] mt-0.5">Capital Friends is free. If it helps your family, consider a small donation!</p>
          </div>
        </div>
      </button>

      <DonateDialog open={showDonate} onClose={() => setShowDonate(false)} />
    </div>
  )
}

/* ── Reusable sub-components ── */

function Card({ children }) {
  return (
    <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] overflow-hidden">
      {children}
    </div>
  )
}

function CardHeader({ icon, title }) {
  return (
    <div className="px-4 py-2.5 border-b border-[var(--border-light)] bg-[var(--bg-inset)]">
      <div className="flex items-center gap-2">
        <span className="text-[var(--text-muted)]">{icon}</span>
        <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">{title}</h3>
      </div>
    </div>
  )
}

function Row({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <p className="text-xs text-[var(--text-dim)] shrink-0">{label}</p>
      {children}
    </div>
  )
}

function Select({ value, onChange, options, suffix }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none pl-3 pr-7 py-1.5 text-xs font-semibold bg-[var(--bg-inset)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-violet-500 cursor-pointer"
      >
        {options.map((o) => (
          <option key={o} value={o}>{o}{suffix || ''}</option>
        ))}
      </select>
      <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-dim)] pointer-events-none" />
    </div>
  )
}

function MemberEmailToggle({ member, onToggle }) {
  const { mv } = useMask()
  const propOn = member.includeInEmailReports === 'Yes' || member.includeInEmailReports === true
  const [localOn, setLocalOn] = useState(propOn)
  const [toggling, setToggling] = useState(false)

  // Sync from props when member data refreshes
  useEffect(() => { setLocalOn(propOn) }, [propOn])

  async function handleToggle() {
    const newVal = !localOn
    setLocalOn(newVal) // Optimistic UI update
    setToggling(true)
    try {
      await onToggle(member.memberId, { ...member, includeInEmailReports: newVal ? 'Yes' : 'No' })
    } catch {
      setLocalOn(!newVal) // Revert on error
    } finally {
      setToggling(false)
    }
  }

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-6 h-6 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center shrink-0">
          <span className="text-[10px] font-bold text-violet-600">{member.memberName?.charAt(0)?.toUpperCase()}</span>
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{mv(member.memberName, 'name')}</p>
          {member.email && <p className="text-[10px] text-[var(--text-dim)] truncate">{mv(member.email, 'email')}</p>}
        </div>
      </div>
      <button
        onClick={handleToggle}
        disabled={toggling}
        className={`relative w-9 h-5 rounded-full transition-colors shrink-0 disabled:opacity-50 ${localOn ? 'bg-violet-500' : 'bg-[var(--bg-inset)] border border-[var(--border)]'}`}
      >
        <span className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${localOn ? 'left-[18px] bg-white' : 'left-0.5 bg-[var(--text-dim)]'}`} />
      </button>
    </div>
  )
}
