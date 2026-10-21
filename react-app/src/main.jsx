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
import UpdateBoundary, { freshReload } from './components/UpdateBoundary'

// After a new deploy, an open tab still points at the old file names: a lazy page then fails to
// load (blank screen). Reload once to pick up the new version.
// A plain reload can serve the cached old index.html again (GitHub Pages caches for 10 minutes), so reload with a
// fresh query string, which always fetches the new index.html and its new file names.
// At most one automatic reload a minute (so a page that keeps failing can't loop); after that UpdateBoundary
// shows a Reload button.
const reloadForUpdate = () => {
  try {
    const last = Number(sessionStorage.getItem('cf-reloaded-for-update') || 0)
    if (Date.now() - last < 60000) return false
    sessionStorage.setItem('cf-reloaded-for-update', String(Date.now()))
  } catch { /* storage blocked: still reload */ }
  freshReload()
  return true
}
// once the new version has loaded, take the ?v=… back out of the address bar
try { const u = new URL(window.location.href); if (u.searchParams.has('v')) { u.searchParams.delete('v'); window.history.replaceState(window.history.state, '', u.pathname + u.search + u.hash) } } catch { /* ignore */ }
window.addEventListener('vite:preloadError', (e) => { if (reloadForUpdate()) e.preventDefault() })
window.addEventListener('unhandledrejection', (e) => {
  const m = String(e.reason?.message || e.reason || '')
  if (/dynamically imported module|Importing a module script failed|error loading dynamically/i.test(m) && reloadForUpdate()) e.preventDefault()
})

createRoot(document.getElementById('root')).render(
  <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '') || undefined}>
    <AuthProvider>
      <ThemeProvider>
        <MaskProvider>
          <ToastProvider>
            <ConfirmProvider>
              <DataProvider>
                <FamilyProvider>
                  <UpdateBoundary onChunkError={reloadForUpdate}><App /></UpdateBoundary>
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
