import { Home, Compass, FolderSearch, Bookmark, UserRound, Menu, X } from 'lucide-react'
import { Link, NavLink } from 'react-router-dom'
import { useState } from 'react'
import UserMenu from './UserMenu'

const navItems = [
  { label: 'Home', icon: Home, to: '/dashboard' },
  { label: 'Explore', icon: Compass, to: '/research' },
  { label: 'My Research', icon: FolderSearch, to: '/auth-test' },
  { label: 'Saved', icon: Bookmark, to: '/dashboard' },
  { label: 'Profile', icon: UserRound, to: '/profile' },
]

function Sidebar() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        className="fixed left-4 top-4 z-40 inline-flex h-10 w-10 items-center justify-center rounded-md border border-[#222222] bg-black text-white md:hidden"
        onClick={() => setOpen((value) => !value)}
        aria-label="Toggle navigation"
      >
        {open ? <X size={16} /> : <Menu size={16} />}
      </button>

      <aside
        className={`fixed left-0 top-0 z-30 flex h-screen w-72 flex-col border-r border-[#181818] bg-black transition-transform duration-300 md:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="px-6 py-6">
          <Link to="/dashboard" className="text-sm tracking-[0.35em] text-white">
            RESEARCHTUBE
          </Link>
        </div>

        <nav className="flex-1 px-4">
          <ul className="space-y-1">
            {navItems.map(({ label, icon: Icon, to }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-md border px-3 py-2.5 text-sm transition-all ${
                      isActive
                        ? 'border-[#666666] bg-[#111111] text-white'
                        : 'border-transparent text-[#999999] hover:border-[#222222] hover:bg-[#111111] hover:text-white'
                    }`
                  }
                >
                  <Icon size={16} />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <UserMenu />
      </aside>

      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-[#181818] bg-black px-4 py-2 md:hidden">
        <ul className="grid grid-cols-5 gap-1">
          {navItems.slice(0, 5).map(({ label, icon: Icon, to }) => (
            <li key={`mobile-${to}`}>
              <NavLink
                to={to}
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center rounded-md py-2 text-[10px] ${
                    isActive ? 'text-white' : 'text-[#666666]'
                  }`
                }
              >
                <Icon size={16} />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </>
  )
}

export default Sidebar
