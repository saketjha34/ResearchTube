import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from '../components/Sidebar'

function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="min-h-screen bg-black text-white">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <main
        className={`px-4 pb-24 pt-20 transition-all duration-300 md:px-10 md:pb-10 md:pt-10 ${
          collapsed ? 'md:ml-20' : 'md:ml-72'
        }`}
      >
        <div className="mx-auto w-full max-w-5xl animate-fade-in">
          <Outlet context={{ collapsed }} />
        </div>
      </main>
    </div>
  )
}

export default AppLayout