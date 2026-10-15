// Entry for the public /goal-planner/ page (a second Vite page, see vite.config.js): the app's goal dialog without a sign-in.
import React from 'react'
import { createRoot } from 'react-dom/client'
import { MaskProvider } from './context/MaskContext'
import { ToastProvider } from './context/ToastContext'
import { ConfirmProvider } from './context/ConfirmContext'
import { GuestDataProvider } from './context/DataContext'
import './index.css'
import GoalPlannerPage from './pages/GoalPlannerPage'

document.documentElement.setAttribute('data-theme', 'dark')   // the planner is always dark (the app's designed look); no theme provider here
// Ionic's base CSS (pulled in by the shared form components) pins <body> for the phone app; this page scrolls like a web page
const st = document.createElement('style'); st.textContent = 'html,body{position:static!important;overflow:auto!important;height:auto!important;max-height:none!important}'; document.head.appendChild(st)
createRoot(document.getElementById('root')).render(
  <React.StrictMode>
      <MaskProvider>
        <ToastProvider>
          <ConfirmProvider>
            <GuestDataProvider>
              <GoalPlannerPage />
            </GuestDataProvider>
          </ConfirmProvider>
        </ToastProvider>
      </MaskProvider>
  </React.StrictMode>
)
