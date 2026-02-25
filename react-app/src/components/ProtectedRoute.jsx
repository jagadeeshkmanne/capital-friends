import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import BrandedLoading from './BrandedLoading'

export default function ProtectedRoute() {
  const { isAuthenticated, loading: authLoading } = useAuth()
  const { healthCheckCompleted, loading: dataLoading } = useData()
  const location = useLocation()

  // Determine loading phase for progress display
  if (authLoading) {
    return <BrandedLoading phase="auth" />
  }

  if (isAuthenticated && dataLoading) {
    return <BrandedLoading phase="data" />
  }

  if (isAuthenticated && healthCheckCompleted === null) {
    return <BrandedLoading phase="health" />
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />
  }

  // Redirect to health check if not completed (except when already on that page)
  if (healthCheckCompleted === false && location.pathname !== '/health-check') {
    return <Navigate to="/health-check" replace />
  }

  return <Outlet />
}
