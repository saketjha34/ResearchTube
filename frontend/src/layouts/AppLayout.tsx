import { Outlet } from 'react-router-dom'
import Sidebar from '../components/Sidebar'

function AppLayout() {
  return (
    <div className="min-h-screen bg-black text-white">
      <Sidebar />
      <main className="px-4 pb-24 pt-20 md:ml-72 md:px-10 md:pb-10 md:pt-10">
        <div className="mx-auto w-full max-w-5xl animate-fade-in">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

export default AppLayout
