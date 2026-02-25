import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import LandingPage from '../pages/LandingPage'
import BrandedLoading from './BrandedLoading'

export default function HomePage() {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return <BrandedLoading />
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  return <LandingPage />
}
