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
      api.storeToken(response.access_token, response.expires_in)

      // Fetch user profile from Google
      const profile = await fetchUserProfile(response.access_token)
      api.setStoredUserName(profile.name || '')

      // Call our backend to register/login
      const me = await api.getMe()
      
      // If this is a newly registered account, prompt Google to install background triggers
      if (me.isNew) {
        setTimeout(() => {
          try { api.installUserTriggers() } catch(e) { console.warn('Popup blocked?', e) }
        }, 1500)
      }

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
          api.storeToken(response.access_token, response.expires_in)
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
  function askForConsent() {
    if (consentPending.current) return consentPending.current.promise
    let resolve, reject
    const promise = new Promise((res, rej) => { resolve = res; reject = rej })
    consentPending.current = { promise, resolve, reject }
    setConsentAsk({ error: '' })
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
        api.storeToken(response.access_token, response.expires_in)
        finishConsent(true)
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
          <div className="fixed inset-0 bg-black/60" />
          <div className="relative w-full max-w-md bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-2xl p-6">
            <h2 className="text-base font-bold text-[var(--text-primary)]">One more Google permission</h2>
            <p className="text-sm text-[var(--text-muted)] mt-2 leading-relaxed">
              Capital Friends was updated and needs your OK once more in Google, so it can load
              the latest fund prices. Your data stays in your own Google Sheet.
            </p>
            {consentAsk.error && <p className="text-xs text-rose-500 mt-3">{consentAsk.error}</p>}
            <div className="flex gap-2 mt-5">
              <button onClick={approveConsent} className="flex-1 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold">
                Continue with Google
              </button>
              <button onClick={() => finishConsent(false)} className="px-4 py-2.5 rounded-lg border border-[var(--border)] text-sm text-[var(--text-muted)] hover:bg-[var(--bg-hover)]">
                Later
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
