import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from '../components/Sidebar'

function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const location = useLocation()

  return (
    <div className="min-h-screen bg-black text-white">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <main
        className={`px-4 pb-24 pt-20 transition-all duration-300 md:px-10 md:pb-10 md:pt-10 ${
          collapsed ? 'md:ml-20' : 'md:ml-72'
        }`}
      >
        <div key={location.pathname} className="mx-auto w-full max-w-5xl animate-page-transition">
          <Outlet context={{ collapsed }} />
        </div>
      </main>
    </div>
  )
}

export default AppLayout
