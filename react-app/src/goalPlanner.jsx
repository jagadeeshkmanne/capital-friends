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
