import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import BrandedLoading from './BrandedLoading'

export default function ProtectedRoute() {
  const { isAuthenticated, loading: authLoading } = useAuth()
  const { healthCheckCompleted, loading: dataLoading } = useData()
  const location = useLocation()

  // Only show full-screen loading on first login (no cached data)
  // On refresh with cache, auth + data restore instantly — no loading screen
  if (authLoading && !isAuthenticated) {
    return <BrandedLoading phase="auth" />
  }

  if (!isAuthenticated && !authLoading) {
    return <Navigate to="/" replace />
  }

  // First-time load (no cache) — show loading phases
  if (dataLoading) {
    return <BrandedLoading phase="data" />
  }

  if (healthCheckCompleted === null) {
    return <BrandedLoading phase="health" />
  }

  // Redirect to health check if not completed (except when already on that page)
  if (healthCheckCompleted === false && location.pathname !== '/health-check') {
    return <Navigate to="/health-check" replace />
  }

  return <Outlet />
}
