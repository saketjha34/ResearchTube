import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from '../components/Sidebar'

function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const location = useLocation()
  const isChat = location.pathname.startsWith('/chat')

  return (
    <div className={`min-h-screen bg-black text-white ${isChat ? 'h-screen overflow-hidden' : ''}`}>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <main
        className={`transition-all duration-300 ${
          collapsed ? 'md:ml-20' : 'md:ml-72'
        } ${
          isChat
            ? 'h-screen flex flex-col overflow-hidden p-0'
            : 'px-4 pb-24 pt-20 md:px-10 md:pb-10 md:pt-10'
        }`}
      >
        {isChat ? (
          <div className="h-full w-full flex flex-col min-h-0 overflow-hidden">
            <Outlet context={{ collapsed }} />
          </div>
        ) : (
          <div
            key={location.pathname}
            className="mx-auto w-full max-w-5xl animate-page-transition"
          >
            <Outlet context={{ collapsed }} />
          </div>
        )}
      </main>
    </div>
  )
}

export default AppLayout
