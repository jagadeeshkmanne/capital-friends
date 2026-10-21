import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { DataProvider } from './context/DataContext'
import { FamilyProvider } from './context/FamilyContext'
import { ToastProvider } from './context/ToastContext'
import { ConfirmProvider } from './context/ConfirmContext'
import { MaskProvider } from './context/MaskContext'
import './index.css'
import App from './App.jsx'
import FilePickerGate from './components/FilePickerGate'

// After a new deploy, an open tab still points at the old file names: a lazy page then fails to
// load (blank screen). Reload once to pick up the new version.
// A plain reload can serve the cached old index.html again (GitHub Pages caches for 10 minutes), so reload with a
// fresh query string, which always fetches the new index.html and its new file names.
const reloadForUpdate = () => {
  try {
    if (sessionStorage.getItem('cf-reloaded-for-update')) return false
    sessionStorage.setItem('cf-reloaded-for-update', '1')
  } catch { /* storage blocked: still reload */ }
  const u = new URL(window.location.href)
  u.searchParams.set('v', Date.now().toString(36))
  window.location.replace(u.toString())
  return true
}
window.addEventListener('vite:preloadError', (e) => { if (reloadForUpdate()) e.preventDefault() })
window.addEventListener('unhandledrejection', (e) => {
  const m = String(e.reason?.message || e.reason || '')
  if (/dynamically imported module|Importing a module script failed|error loading dynamically/i.test(m) && reloadForUpdate()) e.preventDefault()
})
window.addEventListener('load', () => { setTimeout(() => { try { sessionStorage.removeItem('cf-reloaded-for-update') } catch { /* ignore */ } }, 10000) })

createRoot(document.getElementById('root')).render(
  <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '') || undefined}>
    <AuthProvider>
      <ThemeProvider>
        <MaskProvider>
          <ToastProvider>
            <ConfirmProvider>
              <DataProvider>
                <FamilyProvider>
                  <App />
                  <FilePickerGate />
                </FamilyProvider>
              </DataProvider>
            </ConfirmProvider>
          </ToastProvider>
        </MaskProvider>
      </ThemeProvider>
    </AuthProvider>
  </BrowserRouter>
)
