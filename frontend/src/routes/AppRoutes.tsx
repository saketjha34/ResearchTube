import { Navigate, Route, Routes } from 'react-router-dom'
import AppLayout from '../layouts/AppLayout'
import ProtectedRoute from '../components/ProtectedRoute'
import Landing from '../pages/Landing'
import Login from '../pages/Login'
import Register from '../pages/Register'
import AuthCallback from '../pages/AuthCallback'
import Research from '../pages/Research'
import AuthTest from '../pages/AuthTest'
import Profile from '../pages/Profile'
import { SharedReport } from '../pages/SharedReport'

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/share/:runId" element={<SharedReport />} />

      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        {/* /dashboard redirects directly to /research */}
        <Route path="/dashboard" element={<Navigate to="/research" replace />} />
        <Route path="/research" element={<Research />} />
        <Route path="/auth-test" element={<AuthTest />} />
        <Route path="/profile" element={<Profile />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default AppRoutes