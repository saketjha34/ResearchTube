import { UserRound, Menu, X, FlaskConical, PenSquare, Clock, Loader2, Trash2, MoreVertical, Share2, Pin, PinOff, Pencil, Search, ArrowUpRight, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import UserMenu from './UserMenu'
import { getHistory, deleteHistoryEntry, renameHistoryEntry, shareHistoryEntry, type HistoryItem } from '../api/research'

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
  const [activeMenuRunId, setActiveMenuRunId] = useState<string | null>(null)
  const [deleteTargetRunId, setDeleteTargetRunId] = useState<string | null>(null)
  const [renameTargetRunId, setRenameTargetRunId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [shareTargetRunId, setShareTargetRunId] = useState<string | null>(null)
  const [shareLoading, setShareLoading] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  const [shareGeneratedUrl, setShareGeneratedUrl] = useState<string | null>(null)

  // Mobile long press menu triggers
  const touchTimeoutRef = useRef<any>(null)
  const isLongPressRef = useRef(false)

  const handleTouchStart = (_e: React.TouchEvent, runId: string) => {
    isLongPressRef.current = false
    touchTimeoutRef.current = setTimeout(() => {
      isLongPressRef.current = true
      if (navigator.vibrate) {
        try {
          navigator.vibrate(50)
        } catch (err) {}
      }
      setActiveMenuRunId(runId)
    }, 600) // 600ms long press
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchTimeoutRef.current) {
      clearTimeout(touchTimeoutRef.current)
    }
    if (isLongPressRef.current) {
      e.preventDefault()
      e.stopPropagation()
    }
  }

  const handleTouchMove = () => {
    if (touchTimeoutRef.current) {
      clearTimeout(touchTimeoutRef.current)
    }
  }

  // Pinned runs — persisted in localStorage
  const [pinnedRunIds, setPinnedRunIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('rt_pinned_runs') ?? '[]') } catch { return [] }
  })
  const togglePin = (runId: string) => {
    setPinnedRunIds((prev) => {
      const next = prev.includes(runId) ? prev.filter((id) => id !== runId) : [...prev, runId]
      localStorage.setItem('rt_pinned_runs', JSON.stringify(next))
      return next
    })
  }

  // Search palette
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)

  const location = useLocation()
  const navigate = useNavigate()

  const loadHistory = async () => {
    setLoading(true)
    try {
      const data = await getHistory(1, 60)
      setHistory(data.items)
    } catch { setHistory([]) }
    finally { setLoading(false) }
  }

  useEffect(() => { void loadHistory() }, [])

  useEffect(() => {
    const handleClose = () => setActiveMenuRunId(null)
    window.addEventListener('click', handleClose)
    return () => window.removeEventListener('click', handleClose)
  }, [])

  useEffect(() => {
    const handleRefresh = () => { void loadHistory() }
    window.addEventListener('research:created', handleRefresh)
    return () => window.removeEventListener('research:created', handleRefresh)
  }, [])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); setSearchOpen(true); setSearchQuery('') }
      if (e.key === 'Escape') { setSearchOpen(false); setSearchQuery('') }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  useEffect(() => {
    if (searchOpen) setTimeout(() => searchInputRef.current?.focus(), 50)
  }, [searchOpen])

  const handleNewResearch = () => {
    navigate('/research')
    window.history.pushState({}, '', '/research')
    window.dispatchEvent(new Event('research:clear'))
  }

  const activeRunId = new URLSearchParams(location.search).get('run')

  const confirmDelete = async () => {
    if (!deleteTargetRunId) return
    const runId = deleteTargetRunId
    setDeleteTargetRunId(null)
    try {
      await deleteHistoryEntry(runId)
      if (activeRunId === runId) {
        navigate('/research')
        window.history.pushState({}, '', '/research')
        window.dispatchEvent(new Event('research:clear'))
      }
      void loadHistory()
    } catch { alert('Failed to delete research run.') }
  }

  const generateShareLink = async () => {
    if (!shareTargetRunId) return
    setShareLoading(true)
    try {
      await shareHistoryEntry(shareTargetRunId)
      const url = window.location.origin + '/share/' + shareTargetRunId
      setShareGeneratedUrl(url)
    } catch {
      alert('Failed to generate share link.')
    } finally {
      setShareLoading(false)
    }
  }

  const copyShareLink = async () => {
    if (!shareGeneratedUrl) return
    await navigator.clipboard.writeText(shareGeneratedUrl)
    setShareCopied(true)
    setTimeout(() => setShareCopied(false), 2000)
  }

  const confirmRename = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!renameTargetRunId || !renameValue.trim()) return
    const runId = renameTargetRunId
    const newName = renameValue.trim()
    setRenameTargetRunId(null)
    try {
      await renameHistoryEntry(runId, newName)
      window.dispatchEvent(new Event('research:created'))
      void loadHistory()
    } catch { alert('Failed to rename research run.') }
  }

  const completedHistory = history.filter((item) => item.status === 'completed')
  const pinnedHistory = completedHistory.filter((item) => pinnedRunIds.includes(item.run_id))
  const regularHistory = completedHistory.filter((item) => !pinnedRunIds.includes(item.run_id))

  const searchResults = searchQuery.trim()
    ? completedHistory.filter((item) => item.query.toLowerCase().includes(searchQuery.toLowerCase()))
    : completedHistory.slice(0, 8)

  const handleSearchNavigate = (runId: string) => {
    setSearchOpen(false); setSearchQuery(''); navigate(`/research?run=${runId}`)
  }

  // Shared history item renderer
  const renderHistoryItem = (item: HistoryItem) => (
    <li key={item.run_id} className="relative group">
      <button
        onClick={() => {
          if (isLongPressRef.current) return
          navigate(`/research?run=${item.run_id}`)
        }}
        onTouchStart={(e) => handleTouchStart(e, item.run_id)}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchMove}
        className={`flex w-full items-start gap-2 rounded-md pl-2 pr-8 py-2 text-left text-xs transition-all duration-200 hover:bg-[#111111] ${
          activeRunId === item.run_id ? 'bg-[#111111] text-white font-bold border-l-2 border-white' : 'text-[#888888] hover:text-white'
        }`}
      >
        {pinnedRunIds.includes(item.run_id)
          ? <Pin size={10} className="mt-0.5 flex-shrink-0 opacity-50 text-yellow-500" />
          : <Clock size={11} className="mt-0.5 flex-shrink-0 opacity-50" />
        }
        <span className="line-clamp-2 leading-relaxed">{item.query}</span>
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); setActiveMenuRunId(activeMenuRunId === item.run_id ? null : item.run_id) }}
        className="absolute right-2 top-1/2 -translate-y-1/2 hidden group-hover:flex show-on-touch items-center justify-center p-1 rounded hover:bg-[#222222] text-[#666666] hover:text-white transition-colors"
      >
        <MoreVertical size={13} />
      </button>
      {activeMenuRunId === item.run_id && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute right-2 top-8 z-50 w-44 bg-[#111111] border border-[#222222] rounded-xl py-1 shadow-2xl animate-fade-in text-xs"
        >
                      <button
              onClick={() => {
                setShareTargetRunId(item.run_id)
                setShareGeneratedUrl(null)
                setShareCopied(false)
                setActiveMenuRunId(null)
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[#cccccc] hover:bg-[#181818] hover:text-white"
            >
              <Share2 size={12} className="opacity-70" /><span>Share conversation</span>
            </button>
          <button
            onClick={() => { togglePin(item.run_id); setActiveMenuRunId(null) }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[#cccccc] hover:bg-[#181818] hover:text-white"
          >
            {pinnedRunIds.includes(item.run_id)
              ? <><PinOff size={12} className="opacity-70" /><span>Unpin</span></>
              : <><Pin size={12} className="opacity-70" /><span>Pin</span></>
            }
          </button>
          <button
            onClick={() => { setRenameTargetRunId(item.run_id); setRenameValue(item.query); setActiveMenuRunId(null) }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[#cccccc] hover:bg-[#181818] hover:text-white"
          >
            <Pencil size={12} className="opacity-70" /><span>Rename</span>
          </button>
          <hr className="border-[#222222] my-1" />
          <button
            onClick={() => { setDeleteTargetRunId(item.run_id); setActiveMenuRunId(null) }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[#ef4444] hover:bg-[#181818]"
          >
            <Trash2 size={12} className="opacity-70" /><span>Delete</span>
          </button>
        </div>
      )}
    </li>
  )

  return (
    <>
      {/* Mobile Toggle */}
      <button
        className="fixed left-4 top-4 z-40 inline-flex h-10 w-10 items-center justify-center rounded-md border border-[#222222] bg-black text-white md:hidden"
        onClick={() => setOpen((v) => !v)}
        aria-label="Toggle navigation"
      >
        {open ? <X size={16} /> : <Menu size={16} />}
      </button>

      <aside
        className={`fixed left-0 top-0 z-30 flex h-screen flex-col border-r border-[#181818] bg-black transition-all duration-300 md:translate-x-0 pb-16 md:pb-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ width: collapsed ? '64px' : '288px' }}
      >
        {/* Header */}
        <div className="flex flex-shrink-0 items-center px-4 py-4" style={{ minHeight: '64px', justifyContent: collapsed ? 'center' : 'space-between' }}>
          {!collapsed && (
            <Link to="/research" className="truncate text-xs font-bold tracking-[0.35em] text-white pl-12 md:pl-0">
              RESEARCHTUBE
            </Link>
          )}
          <div className="flex items-center gap-1">
            <button
              onClick={() => { setSearchOpen(true); setSearchQuery('') }}
              className="hidden md:flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-[#666666] hover:bg-[#111111] hover:text-white transition-all"
              title="Search (Ctrl+K)"
            >
              <Search size={15} />
            </button>
            <button
              onClick={onToggle}
              className="hidden md:flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-[#666666] hover:bg-[#111111] hover:text-white transition-all"
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="px-3 py-2">
          <ul className="space-y-1">
            {navItems.map(({ label, icon: Icon, to }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  onClick={() => setOpen(false)}
                  title={collapsed ? label : undefined}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-all duration-300 ease-in-out ${
                      isActive 
                        ? 'border-[#555555] bg-[#141414] text-white font-bold shadow-[0_0_15px_rgba(255,255,255,0.05)]' 
                        : 'border-transparent text-[#999999] hover:border-[#222222] hover:bg-[#111111] hover:text-white'
                    }`
                  }
                  style={{ justifyContent: collapsed ? 'center' : 'flex-start' }}
                >
                  <Icon size={16} className="flex-shrink-0 transition-transform duration-300 group-hover:scale-110" />
                  {!collapsed && <span className="truncate">{label}</span>}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* New Research */}
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

        {/* History List */}
        {!collapsed && (
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar px-3 py-4">
            {loading ? (
              <div className="flex items-center gap-2 px-2 py-2 text-[#555555]">
                <Loader2 size={12} className="animate-spin" />
                <span className="text-xs">Loading history...</span>
              </div>
            ) : completedHistory.length === 0 ? (
              <p className="px-2 py-2 text-xs text-[#555555]">No runs yet.</p>
            ) : (
              <>
                {/* Pinned section */}
                {pinnedHistory.length > 0 && (
                  <>
                    <p className="px-2 mb-1.5 text-[10px] font-bold uppercase tracking-widest text-[#555555] flex items-center gap-1.5">
                      <Pin size={10} className="text-yellow-500" /> Pinned
                    </p>
                    <ul className="space-y-0.5 mb-4">
                      {pinnedHistory.map(renderHistoryItem)}
                    </ul>
                  </>
                )}

                {/* Recents section */}
                <p className="px-2 mb-1.5 text-[10px] font-bold uppercase tracking-widest text-[#555555]">
                  Recents
                </p>
                <ul className="space-y-0.5">
                  {regularHistory.map(renderHistoryItem)}
                </ul>
              </>
            )}
          </div>
        )}

        {/* Footer profile menu */}
        <div className="flex-shrink-0 border-t border-[#181818] p-3">
          <UserMenu collapsed={collapsed} />
        </div>
      </aside>

      {/* Delete Confirmation Modal */}
      {deleteTargetRunId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 backdrop-blur-xs">
          <div className="w-full max-w-sm border border-[#222222] bg-[#111111] p-6 shadow-2xl animate-fade-in rounded-2xl space-y-4">
            <h3 className="text-base font-bold text-white">Delete Research Run</h3>
            <p className="text-xs text-[#888888] leading-relaxed">
              Are you sure you want to delete this research run? This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setDeleteTargetRunId(null)}
                className="px-4 py-2 text-xs font-bold text-[#888888] hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => void confirmDelete()}
                className="px-4 py-2 text-xs font-bold bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Modal */}
      {renameTargetRunId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 backdrop-blur-xs">
          <form onSubmit={(e) => void confirmRename(e)} className="w-full max-w-sm border border-[#222222] bg-[#111111] p-6 shadow-2xl animate-fade-in rounded-2xl space-y-4">
            <h3 className="text-base font-bold text-white">Rename Research Run</h3>
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              placeholder="Enter new query title..."
              className="w-full bg-[#181818] border border-[#333333] rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-white transition-colors"
              autoFocus
            />
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRenameTargetRunId(null)}
                className="px-4 py-2 text-xs font-bold text-[#888888] hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-bold bg-white text-black hover:bg-[#cccccc] rounded-lg transition-colors"
              >
                Save
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Share Modal */}
      {shareTargetRunId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 backdrop-blur-xs">
          <div className="w-full max-w-md border border-[#222222] bg-[#111111] p-6 shadow-2xl animate-fade-in rounded-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Share2 size={16} className="text-purple-400" /> Share Research Report
              </h3>
              <button onClick={() => setShareTargetRunId(null)} className="text-[#555555] hover:text-white">
                <X size={16} />
              </button>
            </div>
            <p className="text-xs text-[#888888] leading-relaxed">
              Anyone with this link will be able to view the compiled research report and interactive video recommendations.
            </p>

            {!shareGeneratedUrl ? (
              <div className="pt-2">
                <button
                  onClick={() => void generateShareLink()}
                  disabled={shareLoading}
                  className="flex w-full items-center justify-center gap-2 bg-white text-black font-bold py-2.5 rounded-lg text-xs hover:bg-[#cccccc] transition-colors disabled:opacity-50"
                >
                  {shareLoading ? <Loader2 size={14} className="animate-spin" /> : <Share2 size={14} />}
                  {shareLoading ? 'Generating Public Link...' : 'Create Public Share Link'}
                </button>
              </div>
            ) : (
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2 bg-[#181818] border border-[#333333] rounded-lg p-2">
                  <input
                    type="text"
                    readOnly
                    value={shareGeneratedUrl}
                    className="flex-1 bg-transparent text-xs text-purple-300 outline-none font-mono truncate"
                  />
                  <button
                    onClick={() => void copyShareLink()}
                    className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded text-xs font-bold transition-colors flex-shrink-0"
                  >
                    {shareCopied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <div className="flex justify-end">
                  <a
                    href={shareGeneratedUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] font-bold text-[#888888] hover:text-white flex items-center gap-1"
                  >
                    Open link in new tab <ArrowUpRight size={12} />
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Ctrl+K Search Palette Modal */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/80 px-4 backdrop-blur-xs">
          <div className="w-full max-w-lg border border-[#222222] bg-[#111111] shadow-2xl animate-fade-in rounded-2xl overflow-hidden">
            <div className="flex items-center gap-3 border-b border-[#222222] px-4 py-3">
              <Search size={16} className="text-[#555555]" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search past research runs..."
                className="w-full bg-transparent text-sm text-white outline-none placeholder:text-[#555555]"
              />
              <span className="border border-[#222222] bg-black px-2 py-0.5 text-[10px] font-bold text-[#555555] rounded">
                ESC
              </span>
            </div>
            <div className="max-h-72 overflow-y-auto p-2 custom-scrollbar">
              {searchResults.length === 0 ? (
                <p className="p-4 text-center text-xs text-[#555555]">No matching research runs found.</p>
              ) : (
                <ul className="space-y-1">
                  {searchResults.map((item) => (
                    <li key={item.run_id}>
                      <button
                        onClick={() => handleSearchNavigate(item.run_id)}
                        className="flex w-full items-center justify-between rounded-lg p-2.5 text-left text-xs text-[#cccccc] hover:bg-[#181818] hover:text-white transition-colors"
                      >
                        <span className="truncate pr-4">{item.query}</span>
                        <ArrowUpRight size={13} className="text-[#555555] flex-shrink-0" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default Sidebar
