import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import PageLoader from '../common/Loading'

export function ProtectedRoute({ children }) {
  const { status } = useAuth()
  const location = useLocation()
  if (status === 'checking') return <PageLoader label="Checking your session…" />
  if (status !== 'authenticated') return <Navigate to="/login" replace state={{ from: location }} />
  return children
}

export function PublicOnlyRoute({ children }) {
  const { status } = useAuth()
  if (status === 'checking') return <PageLoader label="Checking your session…" />
  if (status === 'authenticated') return <Navigate to="/dashboard" replace />
  return children
}
