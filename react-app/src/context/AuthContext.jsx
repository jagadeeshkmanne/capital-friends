import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import * as api from '../services/api'
import * as idb from '../services/idb'

const AuthContext = createContext(null)

// Google Client ID
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

// OAuth scopes — must match all scopes in webapp's appsscript.json
// drive.file: GAS creates + reads/writes the user's own spreadsheet (Sheets API); spouses pick it once (Google Picker)
// gmail.send: GAS sends email reports via GmailApp from user's Gmail
// script.scriptapp: GAS creates daily sync triggers for auto-refresh
// script.external_request: GAS downloads the public master fund data + live gold price
// openid/email/profile: user identity
// What Google calls each permission on its consent screen, and what the app needs it for
const SCOPE_NAMES = {
  'https://www.googleapis.com/auth/drive.file': ['See, edit, create and delete only the specific Google Drive files you use with this app', 'your family sheet in your own Drive', 'bg-amber-400/10 text-amber-300'],
  'https://www.googleapis.com/auth/gmail.send': ['Send email on your behalf', 'the family summary email', 'bg-rose-400/10 text-rose-300'],
  'https://www.googleapis.com/auth/script.scriptapp': ['Allow this application to run when you are not present', 'daily price updates and the scheduled family email', 'bg-violet-400/10 text-violet-300'],
  'https://www.googleapis.com/auth/script.external_request': ['Connect to an external service', 'fund prices, the live gold rate and looking up the funds in your CAS statement', 'bg-sky-400/10 text-sky-300'],
}
const SCOPE_ICONS = {
  'https://www.googleapis.com/auth/drive.file': <><path d="M4 4h10l6 6v10H4z" /><path d="M14 4v6h6" /></>,
  'https://www.googleapis.com/auth/gmail.send': <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></>,
  'https://www.googleapis.com/auth/script.scriptapp': <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  'https://www.googleapis.com/auth/script.external_request': <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></>,
}
const COUNT_WORDS = ['', 'One', 'Two', 'Three', 'Four']
// Google lets people untick individual boxes on the consent screen: which required ones were left out of this token?
function missingScopes(tokenResponse) {
  try {
    const g = window.google?.accounts?.oauth2
    if (!g?.hasGrantedAnyScope) return []
    return Object.keys(SCOPE_NAMES).filter((sc) => !g.hasGrantedAnyScope(tokenResponse, sc))
  } catch { return [] }
}
const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/script.scriptapp',
  'https://www.googleapis.com/auth/script.external_request', // master fund data download + gold price
  'openid',
  'email',
  'profile',
].join(' ')

const USER_PROFILE_KEY = 'cf_user_profile'

function getCachedUser() {
  try {
    const cached = localStorage.getItem(USER_PROFILE_KEY)
    return cached ? JSON.parse(cached) : null
  } catch { return null }
}

function setCachedUser(user) {
  try { localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(user)) } catch {}
}

function clearCachedUser() {
  localStorage.removeItem(USER_PROFILE_KEY)
}

export function AuthProvider({ children }) {
  // Instantly restore from cache if token is valid — no loading flash on refresh
  const cachedUser = api.isTokenValid() ? getCachedUser() : null
  const [user, setUser] = useState(cachedUser)
  const [loading, setLoading] = useState(!cachedUser) // false if cache hit
  const [error, setError] = useState(null)
  const tokenClientRef = useRef(null)

  // Wrap setUser to also persist to cache
  function setUserAndCache(u) {
    setUser(u)
    if (u) setCachedUser(u)
    else clearCachedUser()
  }

  // Initialize Google Identity Services (OAuth2 Token Client)
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) {
      setLoading(false)
      return
    }

    const initGIS = () => {
      if (!window.google?.accounts?.oauth2) {
        // GIS script not loaded yet, retry
        setTimeout(initGIS, 200)
        return
      }

      // Initialize the token client (for OAuth access tokens)
      tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: SCOPES,
        callback: handleTokenResponse,
      })

      // Register token refresh function with api module
      api.setTokenRefreshFn(silentRefresh)
      api.setReauthHandler(askForConsent)

      const explicitLogout = localStorage.getItem('cf_idb_stale') === '1'

      if (api.isTokenValid()) {
        // Valid token in storage — restore session immediately (page refresh)
        restoreSession()
      } else if (getCachedUser() && !explicitLogout) {
        // Token expired but user didn't explicitly log out — restore from cache immediately.
        // The API module will refresh the token lazily on the first API call (via setTokenRefreshFn).
        // Do NOT call requestAccessToken here — it can show an account-switcher popup on page load.
        setLoading(false)
      } else {
        // Explicit logout or first-time user — show login page
        setLoading(false)
      }
    }

    initGIS()
  }, [])

  // Handle OAuth token response (after user grants consent)
  async function handleTokenResponse(response) {
    if (response.error) {
      setError(response.error_description || response.error)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      // Store access token
      api.storeToken(response.access_token, response.expires_in, response.scope)
      // A permission skipped on Google's screen: ask for it now (Google's screen again, or the dialog if the popup is blocked)
      const skipped = missingScopes(response)
      if (skipped.length) askForConsent(skipped[0]).catch(() => { /* Not now: they can still use the rest; a failing call asks again */ })

      // Fetch user profile from Google
      const profile = await fetchUserProfile(response.access_token)
      api.setStoredUserName(profile.name || '')

      // Call our backend to register/login
      const me = await api.getMe()
      
      // New accounts: the DailyUpdatesBanner asks to switch on the daily jobs with a click (a timed popup is blocked)

      setUserAndCache({
        email: me.email || profile.email,
        name: me.name || profile.name,
        role: me.role,
        isAdmin: !!me.isAdmin,
        picture: profile.picture || '',
      })
    } catch (err) {
      setError(err.message)
      api.clearToken()
      setUserAndCache(null)
    } finally {
      setLoading(false)
    }
  }

  // Fetch user profile from Google's userinfo endpoint
  async function fetchUserProfile(accessToken) {
    const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!response.ok) throw new Error('Failed to fetch user profile')
    return response.json()
  }

  // Restore session from stored access token
  async function restoreSession() {
    // If we already restored from cache, validate in background (no loading)
    const hadCachedUser = !!getCachedUser()

    try {
      const token = api.getStoredToken()
      const profile = await fetchUserProfile(token)
      api.setStoredUserName(profile.name || '')

      const me = await api.getMe()
      setUserAndCache({
        email: me.email || profile.email,
        name: me.name || profile.name,
        role: me.role,
        isAdmin: !!me.isAdmin,
        picture: profile.picture || '',
      })
    } catch {
      // Token expired or invalid — clear and show login
      api.clearToken()
      setUserAndCache(null)
    } finally {
      if (!hadCachedUser) setLoading(false)
      // If had cache, loading was already false from init
    }
  }

  // Silent token refresh (called by api.js when token expires)
  function silentRefresh() {
    return new Promise((resolve, reject) => {
      if (!tokenClientRef.current) {
        reject(new Error('Token client not initialized'))
        return
      }

      // Temporarily override callback for this refresh
      const client = tokenClientRef.current
      const originalCallback = client.callback
      client.callback = (response) => {
        client.callback = originalCallback // restore
        if (response.error) {
          reject(new Error(response.error))
        } else {
          api.storeToken(response.access_token, response.expires_in, response.scope)
          resolve()
        }
      }
      // Empty prompt = try silent refresh (no popup if user already authorized)
      client.requestAccessToken({ prompt: '' })
    })
  }

  // Ask the user (with a button = real click) to approve the app's Google permissions
  // again, e.g. after a new permission was added. Shared by all waiting API calls.
  const [consentAsk, setConsentAsk] = useState(null)
  const consentPending = useRef(null)
  function askForConsent(missingScope) {
    if (consentPending.current) return consentPending.current.promise
    let resolve, reject
    const promise = new Promise((res, rej) => { resolve = res; reject = rej })
    consentPending.current = { promise, resolve, reject }
    // every required permission the current token lacks (the failed call names one; others may be skipped too)
    const granted = api.getGrantedScopes()
    const missing = Object.keys(SCOPE_NAMES).filter((sc) => sc === missingScope || (granted.length && !granted.includes(sc)))
    // A missing permission (a box unticked at sign-in): open Google's consent screen straight away. Browsers allow
    // that popup only within a few seconds of the user's last click, so if it is blocked, fall back to a button.
    const client = tokenClientRef.current
    if (missing.length && client) {
      const originalCallback = client.callback
      client.callback = (response) => {
        client.callback = originalCallback
        if (response.error === 'popup_failed_to_open') setConsentAsk({ error: '', missing })
        else if (response.error) setConsentAsk({ error: response.error === 'popup_closed' || response.error === 'access_denied' ? '' : (response.error_description || response.error), missing })
        else {
          api.storeToken(response.access_token, response.expires_in, response.scope)
          const still = missingScopes(response)
          if (still.length) setConsentAsk({ error: 'That permission was skipped again. On Google\'s screen, tick Select all and press Continue.', missing: still })
          else finishConsent(true)
        }
      }
      client.requestAccessToken({ prompt: 'consent' })
      return promise
    }
    setConsentAsk({ error: '', missing })
    return promise
  }
  function finishConsent(ok, err) {
    const p = consentPending.current
    consentPending.current = null
    setConsentAsk(null)
    if (p) { if (ok) p.resolve(); else p.reject(err || new Error('cancelled')) }
  }
  function approveConsent() {
    const client = tokenClientRef.current
    if (!client) return finishConsent(false)
    const originalCallback = client.callback
    client.callback = (response) => {
      client.callback = originalCallback
      if (response.error) {
        setConsentAsk({ error: response.error_description || response.error })
      } else {
        api.storeToken(response.access_token, response.expires_in, response.scope)
        const still = missingScopes(response)
        if (still.length) setConsentAsk({ error: 'That permission was skipped again. On Google\'s screen, tick Select all and press Continue.', missing: still })
        else finishConsent(true)
      }
    }
    client.requestAccessToken({ prompt: 'consent' })
  }

  // Manual sign-in trigger.
  // After explicit logout → show account picker so user can switch accounts.
  // Otherwise → try silent first (no screen), fall back to account picker only if needed.
  const signIn = useCallback(() => {
    if (!tokenClientRef.current) return
    setError(null)
    const client = tokenClientRef.current
    const explicitLogout = localStorage.getItem('cf_idb_stale') === '1'

    if (explicitLogout) {
      // User explicitly logged out — show account picker so they can switch if needed
      client.requestAccessToken({ prompt: 'select_account' })
      return
    }

    // Not an explicit logout (token expired, tab closed) — try silent first
    const originalCallback = client.callback
    client.callback = (response) => {
      client.callback = originalCallback
      if (response.error === 'interaction_required' || response.error === 'access_denied') {
        client.requestAccessToken({ prompt: 'select_account' })
      } else {
        originalCallback(response)
      }
    }
    client.requestAccessToken({ prompt: '' })
  }, [])

  // Sign out — clear local token state, do NOT revoke OAuth grant (avoids consent screen on re-login).
  // Mark IDB for clearing so next init wipes financial data from the browser.
  const signOut = useCallback(() => {
    api.clearToken()
    clearCachedUser()
    try { localStorage.setItem('cf_idb_stale', '1') } catch {}
    setUser(null)
  }, [])

  const value = {
    user,
    loading,
    error,
    isAuthenticated: !!user,
    isOwner: user?.role === 'owner',
    isAdmin: !!user?.isAdmin,
    signIn,
    signOut,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
      {consentAsk && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center px-4">
          <div className="fixed inset-0 bg-[#020617]/70 backdrop-blur-[2px]" />
          <div className="relative w-full max-w-[440px] bg-[var(--bg-card)] border border-white/[.08] rounded-[20px] shadow-[0_30px_60px_-20px_rgba(0,0,0,.7)] overflow-hidden text-sm text-[var(--text-muted)] leading-relaxed">
            {consentAsk.missing?.length ? (
              <>
                <div className="flex items-start gap-3.5 px-6 pt-6">
                  <div className="flex-none w-11 h-11 rounded-xl grid place-items-center bg-gradient-to-br from-emerald-500/25 to-emerald-500/5 shadow-[inset_0_0_0_1px_rgba(52,211,153,.35)]">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="10" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                  </div>
                  <div>
                    <h2 className="text-[17px] font-bold text-[var(--text-primary)] tracking-tight mb-1">{COUNT_WORDS[consentAsk.missing.length]} Google permission{consentAsk.missing.length > 1 ? 's were' : ' was'} skipped</h2>
                    <p>When you signed in, {COUNT_WORDS[consentAsk.missing.length].toLowerCase()} of the four permissions on Google's screen {consentAsk.missing.length > 1 ? 'were' : 'was'} not selected. Capital Friends needs {consentAsk.missing.length > 1 ? 'them' : 'it'} to finish this step.</p>
                  </div>
                </div>
                <div className="mx-6 mt-4 space-y-2">
                  {consentAsk.missing.map((sc) => (
                    <div key={sc} className="flex items-start gap-3 rounded-[14px] px-4 py-3.5 bg-[#111a33] shadow-[inset_0_0_0_1px_rgba(255,255,255,.07)]">
                      <span className={`flex-none w-9 h-9 rounded-[10px] grid place-items-center ${SCOPE_NAMES[sc][2]}`}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{SCOPE_ICONS[sc]}</svg>
                      </span>
                      <span><b className="block text-[var(--text-primary)] font-semibold">{SCOPE_NAMES[sc][0]}</b><span className="block text-[12.5px] mt-0.5">Used for {SCOPE_NAMES[sc][1]}.</span></span>
                    </div>
                  ))}
                </div>
                <ol className="mx-6 mt-4 space-y-2 text-[13px]">
                  {[<>Click <b className="text-[var(--text-primary)] font-semibold">Continue with Google</b> below</>, <>On Google's screen, tick <b className="text-[var(--text-primary)] font-semibold">Select all</b> and press Continue</>, <>You come straight back here and the step finishes</>].map((t, i) => (
                    <li key={i} className="flex items-center gap-2.5"><i className="flex-none w-5 h-5 rounded-full grid place-items-center bg-emerald-400/15 text-emerald-400 not-italic text-[11px] font-bold">{i + 1}</i><span>{t}</span></li>
                  ))}
                </ol>
                <p className="mx-6 mt-3.5 flex items-center gap-1.5 text-xs text-[var(--text-dim,#64748b)]">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="10" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                  Your data stays in your own Google Sheet. Nothing is sent to us.
                </p>
              </>
            ) : (
              <div className="px-6 pt-6">
                <h2 className="text-base font-bold text-[var(--text-primary)]">One more Google permission</h2>
                <p className="mt-2">Capital Friends was updated and needs your OK once more in Google, so it can load the latest fund prices. Your data stays in your own Google Sheet.</p>
              </div>
            )}
            {consentAsk.error && <p className="mx-6 mt-3 text-xs text-rose-400">{consentAsk.error}</p>}
            <div className="flex gap-2 px-6 pt-[18px] pb-6">
              <button onClick={approveConsent} className="flex-1 flex items-center justify-center gap-2 px-4 py-[11px] rounded-[10px] bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold shadow-[0_8px_20px_-8px_rgba(16,185,129,.6)]">
                <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path fill="#fff" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.4c-.2 1.2-.9 2.3-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.4z" /><path fill="#fff" opacity=".8" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6C4.8 19.8 8.2 22 12 22z" /><path fill="#fff" opacity=".6" d="M6.4 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.4H3.1C2.4 8.8 2 10.4 2 12s.4 3.2 1.1 4.6L6.4 14z" /><path fill="#fff" opacity=".9" d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.9-2.9C17 2.9 14.7 2 12 2 8.2 2 4.8 4.2 3.1 7.4L6.4 10c.8-2.3 3-4.1 5.6-4.1z" /></svg>
                Continue with Google
              </button>
              <button onClick={() => finishConsent(false)} className="px-4 py-[11px] rounded-[10px] shadow-[inset_0_0_0_1px_rgba(255,255,255,.08)] text-sm text-[var(--text-muted)] hover:bg-[var(--bg-hover)]">
                Not now
              </button>
            </div>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
