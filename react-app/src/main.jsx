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
window.addEventListener('vite:preloadError', (e) => {
  try {
    if (sessionStorage.getItem('cf-reloaded-for-update')) return
    sessionStorage.setItem('cf-reloaded-for-update', '1')
  } catch { /* storage blocked: still reload */ }
  e.preventDefault()
  window.location.reload()
})
window.addEventListener('load', () => { setTimeout(() => { try { sessionStorage.removeItem('cf-reloaded-for-update') } catch { /* ignore */ } }, 10000) })

createRoot(document.getElementById('root')).render(
  <BrowserRouter>
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
