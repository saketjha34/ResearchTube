import { Navigate, useLocation } from 'react-router-dom'
import type { ReactElement } from 'react'
import { useAuth } from '../context/AuthContext'

function ProtectedRoute({ children }: { children: ReactElement }) {
  const location = useLocation()
  const { loading, isAuthenticated } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-sm text-[#999999]">Checking session...</p>
      </div>
    )
  }

  if (!isAuthenticated()) {
    const target = encodeURIComponent(`${location.pathname}${location.search}`)
    return <Navigate to={`/login?redirect=${target}`} replace />
  }

  return children
}

export default ProtectedRoute
