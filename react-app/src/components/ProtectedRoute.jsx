import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import BrandedLoading from './BrandedLoading'

export default function ProtectedRoute() {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return <BrandedLoading />
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
