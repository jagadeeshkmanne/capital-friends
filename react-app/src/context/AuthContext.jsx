import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import * as api from '../services/api'

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

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null) // { email, name, role, picture }
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const tokenClientRef = useRef(null)

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
      setUser({
        email: me.email || profile.email,
        name: me.name || profile.name,
        role: me.role,
        picture: profile.picture || '',
      })
    } catch (err) {
      setError(err.message)
      api.clearToken()
      setUser(null)
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
    try {
      const token = api.getStoredToken()
      const profile = await fetchUserProfile(token)
      api.setStoredUserName(profile.name || '')

      const me = await api.getMe()
      setUser({
        email: me.email || profile.email,
        name: me.name || profile.name,
        role: me.role,
        picture: profile.picture || '',
      })
    } catch {
      // Token expired or invalid — clear and show login
      api.clearToken()
      setUser(null)
    } finally {
      setLoading(false)
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
