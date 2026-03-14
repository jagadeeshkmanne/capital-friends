import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import BrandedLoading from './BrandedLoading'

export default function ProtectedRoute() {
  const { isAuthenticated, loading: authLoading } = useAuth()
  const { healthCheckCompleted, loading: dataLoading, isSetupLoading } = useData()
  const location = useLocation()

  // Only show full-screen loading on first login (no cached data)
  // On refresh with cache, auth + data restore instantly — no loading screen
  if (authLoading && !isAuthenticated) {
    return <BrandedLoading phase="auth" />
  }

  if (!isAuthenticated && !authLoading) {
    return <Navigate to="/" replace />
  }

  // First-time load: show setup progress for new users, simple spinner for returning users
  if (dataLoading) {
    return <BrandedLoading phase={isSetupLoading ? 'data' : undefined} />
  }

  // Health check pending — resolveHealthCheck() hasn't completed yet (brief API call)
  // Block until resolved so user can't briefly see the app before being redirected
  if (healthCheckCompleted === null) {
    return <BrandedLoading />
  }

  if (healthCheckCompleted === false && location.pathname !== '/health-check') {
    return <Navigate to="/health-check" replace />
  }

  return <Outlet />
}
