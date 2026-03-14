import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import * as api from '../services/api'
import * as idb from '../services/idb'

const AuthContext = createContext(null)

// Google Client ID
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

// OAuth scopes — must match all scopes in webapp's appsscript.json
// spreadsheets: GAS reads/writes user spreadsheets + master DB
// drive.file: GAS creates user spreadsheet (SpreadsheetApp.create)
// gmail.send: GAS sends email reports via GmailApp from user's Gmail
// script.scriptapp: GAS creates daily sync triggers for auto-refresh
// openid/email/profile: user identity
const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/script.scriptapp',
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
      setUserAndCache({
        email: me.email || profile.email,
        name: me.name || profile.name,
        role: me.role,
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
    signIn,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
