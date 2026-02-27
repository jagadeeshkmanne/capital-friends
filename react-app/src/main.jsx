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
                </FamilyProvider>
              </DataProvider>
            </ConfirmProvider>
          </ToastProvider>
        </MaskProvider>
      </ThemeProvider>
    </AuthProvider>
  </BrowserRouter>
)
