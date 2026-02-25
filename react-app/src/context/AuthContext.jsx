import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import * as api from '../services/api'
import * as idb from '../services/idb'

const AuthContext = createContext(null)

// Google Client ID
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

// OAuth scopes — must match all scopes in webapp's appsscript.json
// spreadsheets: GAS reads/writes user spreadsheets + master DB
// drive: GAS copies template spreadsheet for new users (DriveApp.makeCopy)
// gmail.send: GAS sends email reports from user's own Gmail
// script.scriptapp: GAS creates daily sync triggers for auto-refresh
// openid/email/profile: user identity
const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive',
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

      // If we have a valid stored token, try to restore session
      if (api.isTokenValid()) {
        restoreSession()
      } else {
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

  // Manual sign-in trigger
  const signIn = useCallback(() => {
    if (tokenClientRef.current) {
      setError(null)
      tokenClientRef.current.requestAccessToken()
    }
  }, [])

  // Sign out
  const signOut = useCallback(() => {
    const token = api.getStoredToken()
    if (token && window.google?.accounts?.oauth2) {
      window.google.accounts.oauth2.revoke(token)
    }
    api.clearToken()
    clearCachedUser()
    idb.clearAll()
    sessionStorage.removeItem('cf_health_check')
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
