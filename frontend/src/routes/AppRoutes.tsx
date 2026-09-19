import { Navigate, Route, Routes } from 'react-router-dom'
import AppLayout from '../layouts/AppLayout'
import ProtectedRoute from '../components/ProtectedRoute'
import ScrollToTop from '../components/ScrollToTop'
import Landing from '../pages/Landing'
import Library from '../pages/Library'
import About from '../pages/About'
import Login from '../pages/Login'
import Register from '../pages/Register'
import AuthCallback from '../pages/AuthCallback'
import Research from '../pages/Research'
import Chat from '../pages/Chat'
import AuthTest from '../pages/AuthTest'
import Profile from '../pages/Profile'
import { SharedReport } from '../pages/SharedReport'
import SharedChat from '../pages/SharedChat'
import ShareResolver from '../pages/ShareResolver'

function AppRoutes() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/library" element={<Library />} />
        <Route path="/about" element={<About />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        
        {/* Share routes: /share/:id automatically resolves to SharedReport or SharedChat */}
        <Route path="/share/:id" element={<ShareResolver />} />
        <Route path="/share/report/:runId" element={<SharedReport />} />
        <Route path="/share/chat/:shareToken" element={<SharedChat />} />
        <Route path="/share/c/:shareToken" element={<SharedChat />} />

        <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          {/* /dashboard redirects directly to /research */}
          <Route path="/dashboard" element={<Navigate to="/research" replace />} />
          <Route path="/research" element={<Research />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/chat/:sessionId" element={<Chat />} />
          <Route path="/auth-test" element={<AuthTest />} />
          <Route path="/profile" element={<Profile />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}

export default AppRoutes
