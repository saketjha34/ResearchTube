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
    // Only redirect back to the page path — never include query params like
    // ?run=XXX because run IDs are session-specific. Restoring them after a
    // fresh login just causes "Could not load this research run." errors.
    const target = encodeURIComponent(location.pathname)
    return <Navigate to={`/login?redirect=${target}`} replace />
  }

  return children
}

export default ProtectedRoute
