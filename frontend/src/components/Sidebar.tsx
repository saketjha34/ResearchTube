import { UserRound, Menu, X, FlaskConical, ChevronLeft, ChevronRight, PenSquare, Clock, Loader2 } from 'lucide-react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import UserMenu from './UserMenu'
import { getHistory, type HistoryItem } from '../api/research'

const navItems = [
  { label: 'Research', icon: FlaskConical, to: '/research' },
  { label: 'Profile', icon: UserRound, to: '/profile' },
]

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const [open, setOpen] = useState(false)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  const loadHistory = async () => {
    setLoading(true)
    try {
      const data = await getHistory(1, 60) // Increase pageSize to fetch more runs since we filter completed ones
      setHistory(data.items)
    } catch {
      setHistory([])
    } finally {
      setLoading(false)
    }
  }

  // Load history on mount
  useEffect(() => {
    void loadHistory()
  }, [])

  // Listen to custom 'research:created' event to refresh history list
  useEffect(() => {
    const handleRefresh = () => {
      void loadHistory()
    }
    window.addEventListener('research:created', handleRefresh)
    return () => window.removeEventListener('research:created', handleRefresh)
  }, [])

  const handleNewResearch = () => {
    navigate('/research')
    window.history.pushState({}, '', '/research')
    window.dispatchEvent(new Event('research:clear'))
  }

  const activeRunId = new URLSearchParams(location.search).get('run')

  // Filter only successful (completed) research runs
  const completedHistory = history.filter((item) => item.status === 'completed')

  return (
    <>
      {/* Mobile Toggle Menu */}
      <button
        className="fixed left-4 top-4 z-40 inline-flex h-10 w-10 items-center justify-center rounded-md border border-[#222222] bg-black text-white md:hidden"
        onClick={() => setOpen((v) => !v)}
        aria-label="Toggle navigation"
      >
        {open ? <X size={16} /> : <Menu size={16} />}
      </button>

      <aside
        className={`fixed left-0 top-0 z-30 flex h-screen flex-col border-r border-[#181818] bg-black transition-all duration-300 md:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ width: collapsed ? '64px' : '288px' }}
      >
        {/* Header */}
        <div
          className="flex flex-shrink-0 items-center px-4 py-4"
          style={{ minHeight: '64px', justifyContent: collapsed ? 'center' : 'space-between' }}
        >
          {!collapsed && (
            <Link to="/research" className="truncate text-xs font-bold tracking-[0.35em] text-white">
              RESEARCHTUBE
            </Link>
          )}
          <button
            onClick={onToggle}
            className="hidden md:flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-[#666666] hover:bg-[#111111] hover:text-white transition-all"
            aria-label="Toggle sidebar"
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="px-3 py-2">
          <ul className="space-y-1">
            {navItems.map(({ label, icon: Icon, to }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  onClick={() => setOpen(false)}
                  title={collapsed ? label : undefined}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-md border px-3 py-2.5 text-sm transition-all ${
                      isActive
                        ? 'border-[#666666] bg-[#111111] text-white font-bold'
                        : 'border-transparent text-[#999999] hover:border-[#222222] hover:bg-[#111111] hover:text-white'
                    }`
                  }
                  style={{ justifyContent: collapsed ? 'center' : 'flex-start' }}
                >
                  <Icon size={16} className="flex-shrink-0" />
                  {!collapsed && <span className="truncate">{label}</span>}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* New Research Button (Always shown) */}
        <div className="px-3 py-2">
          <button
            onClick={handleNewResearch}
            title="New Research"
            className="flex w-full items-center gap-2.5 rounded-md border border-[#222222] bg-[#111111] px-3 py-2.5 text-sm text-white transition-all duration-200 hover:border-[#444444] hover:bg-[#181818]"
            style={{ justifyContent: collapsed ? 'center' : 'flex-start' }}
          >
            <PenSquare size={15} className="flex-shrink-0" />
            {!collapsed && <span className="truncate font-semibold">New Research</span>}
          </button>
        </div>

        {/* Recents list (Only successful history) */}
        {!collapsed && (
          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
            <p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-widest text-[#555555]">
              Recents
            </p>

            {loading ? (
              <div className="flex items-center gap-2 px-2 py-2 text-[#555555]">
                <Loader2 size={12} className="animate-spin" />
                <span className="text-xs">Loading history...</span>
              </div>
            ) : completedHistory.length === 0 ? (
              <p className="px-2 py-2 text-xs text-[#555555]">No runs yet.</p>
            ) : (
              <ul className="space-y-0.5">
                {completedHistory.map((item) => (
                  <li key={item.run_id}>
                    <button
                      onClick={() => navigate(`/research?run=${item.run_id}`)}
                      className={`flex w-full items-start gap-2 rounded-md px-2 py-2 text-left text-xs transition-all hover:bg-[#111111] ${
                        activeRunId === item.run_id
                          ? 'bg-[#111111] text-white font-bold'
                          : 'text-[#888888] hover:text-white'
                      }`}
                    >
                      <Clock size={11} className="mt-0.5 flex-shrink-0 opacity-50" />
                      <span className="line-clamp-2 leading-relaxed">{item.query}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {collapsed && <div className="flex-1" />}

        <UserMenu collapsed={collapsed} />
      </aside>

      {/* Mobile Bottom Navigation (Only on mobile) */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-[#181818] bg-black px-4 py-2 md:hidden">
        <ul className="grid grid-cols-2 gap-1">
          {navItems.map(({ label, icon: Icon, to }) => (
            <li key={`mobile-${to}`}>
              <NavLink
                to={to}
                onClick={() => setOpen(false)}
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