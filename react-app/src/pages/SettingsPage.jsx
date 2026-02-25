import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Moon, Sun, Mail, Globe, ChevronDown, RefreshCw, Database, User, LogOut, Zap } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'
import { useData } from '../context/DataContext'
import { useAuth } from '../context/AuthContext'
import * as api from '../services/api'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default function SettingsPage() {
  const navigate = useNavigate()
  const { theme, toggle } = useTheme()
  const { members, settings, updateSettings, updateMember, healthCheckCompleted } = useData()
  const { user, signOut } = useAuth()
  const activeMembers = members.filter((m) => m.status === 'Active')

  // Local form state (synced from backend settings)
  const [emailFreq, setEmailFreq] = useState('Daily')
  const [emailHour, setEmailHour] = useState('09')
  const [emailDay, setEmailDay] = useState('Monday')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

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
            <p className="text-xs font-semibold text-[var(--text-primary)] truncate max-w-[200px]">{user?.email || '—'}</p>
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

      {/* Financial Health Check */}
      <Card>
        <CardHeader icon={<Zap size={14} />} title="Financial Health Check" />
        <div className="px-4 py-4 space-y-3">
          <Row label="Status">
            <span className={`text-xs font-semibold ${healthCheckCompleted ? 'text-emerald-400' : 'text-[var(--accent-amber)]'}`}>
              {healthCheckCompleted ? 'Completed' : 'Not completed'}
            </span>
          </Row>
          <div className="flex justify-end pt-1">
            <button
              onClick={() => navigate('/health-check')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
            >
              <Zap size={12} />
              {healthCheckCompleted ? 'Update Answers' : 'Take Health Check'}
            </button>
          </div>
        </div>
      </Card>

      {/* Data & Sync */}
      <Card>
        <CardHeader icon={<Database size={14} />} title="Data & Sync" />
        <div className="px-4 py-4 space-y-3">
          <Row label="Last synced">
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold text-[var(--text-primary)]">
                {formatLastSync(settings.masterDataLastSync)}
              </p>
              {settings._stale && (
                <span className="text-[10px] font-bold text-amber-600 px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30">STALE</span>
              )}
            </div>
          </Row>
          {settings._navDataDate && (
            <Row label="NAV data as of">
              <p className="text-xs font-semibold text-[var(--text-primary)]">{settings._navDataDate}</p>
            </Row>
          )}
          <Row label="Auto-refresh">
            <p className="text-xs text-[var(--text-muted)]">Daily at ~6:30 AM</p>
          </Row>
          <div className="flex items-center justify-between pt-1">
            <p className="text-xs text-[var(--text-dim)]">Refresh MF NAVs, ATH & Stock prices</p>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-violet-600 text-white hover:bg-violet-500 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
              {refreshing ? 'Refreshing...' : 'Refresh Now'}
            </button>
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

      {/* Appearance */}
      <Card>
        <CardHeader icon={<Sun size={14} />} title="Appearance" />
        <div className="px-4 py-4">
          <Row label="Theme">
            <button
              onClick={toggle}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
            >
              {theme === 'dark' ? <Moon size={12} /> : <Sun size={12} />}
              {theme === 'dark' ? 'Dark' : 'Light'}
            </button>
          </Row>
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
            <>
              <div className="border-t border-[var(--border-light)] pt-3">
                <p className="text-xs text-[var(--text-dim)] mb-2">Send report to</p>
                <div className="space-y-2">
                  {activeMembers.map((m) => (
                    <MemberEmailToggle key={m.memberId} member={m} onToggle={updateMember} />
                  ))}
                </div>
              </div>
            </>
          )}
          {activeMembers.length === 0 && (
            <p className="text-xs text-[var(--text-dim)] pt-1">Add family members to configure email recipients.</p>
          )}
        </div>
      </Card>

      {/* Display Preferences */}
      <Card>
        <CardHeader icon={<Globe size={14} />} title="Display" />
        <div className="px-4 py-4 space-y-3">
          <Row label="Currency">
            <p className="text-xs font-semibold text-[var(--text-primary)]">INR (₹)</p>
          </Row>
          <Row label="Date format">
            <p className="text-xs font-semibold text-[var(--text-primary)]">DD/MM/YYYY</p>
          </Row>
        </div>
      </Card>
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
  const isOn = member.includeInEmailReports === 'Yes' || member.includeInEmailReports === true
  const [toggling, setToggling] = useState(false)

  async function handleToggle() {
    setToggling(true)
    try {
      await onToggle(member.memberId, { ...member, includeInEmailReports: isOn ? 'No' : 'Yes' })
    } catch {
      // ignore
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
          <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{member.memberName}</p>
          {member.email && <p className="text-[10px] text-[var(--text-dim)] truncate">{member.email}</p>}
        </div>
      </div>
      <button
        onClick={handleToggle}
        disabled={toggling}
        className={`relative w-9 h-5 rounded-full transition-colors shrink-0 disabled:opacity-50 ${isOn ? 'bg-violet-500' : 'bg-[var(--bg-inset)] border border-[var(--border)]'}`}
      >
        <span className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${isOn ? 'left-[18px] bg-white' : 'left-0.5 bg-[var(--text-dim)]'}`} />
      </button>
    </div>
  )
}
