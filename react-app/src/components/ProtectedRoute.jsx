import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import BrandedLoading from './BrandedLoading'

export default function ProtectedRoute() {
  const { isAuthenticated, loading } = useAuth()
  const { healthCheckCompleted } = useData()
  const location = useLocation()

  if (loading) {
    return <BrandedLoading />
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
