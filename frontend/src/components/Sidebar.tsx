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
        onClick={() => navigate(`/research?run=${item.run_id}`)}
        className={`flex w-full items-start gap-2 rounded-md pl-2 pr-8 py-2 text-left text-xs transition-all hover:bg-[#111111] ${
          activeRunId === item.run_id ? 'bg-[#111111] text-white font-bold' : 'text-[#888888] hover:text-white'
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
        className="absolute right-2 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center justify-center p-1 rounded hover:bg-[#222222] text-[#666666] hover:text-white transition-colors"
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
        className={`fixed left-0 top-0 z-30 flex h-screen flex-col border-r border-[#181818] bg-black transition-all duration-300 md:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ width: collapsed ? '64px' : '288px' }}
      >
        {/* Header */}
        <div className="flex flex-shrink-0 items-center px-4 py-4" style={{ minHeight: '64px', justifyContent: collapsed ? 'center' : 'space-between' }}>
          {!collapsed && (
            <Link to="/research" className="truncate text-xs font-bold tracking-[0.35em] text-white">
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
                    `flex items-center gap-3 rounded-md border px-3 py-2.5 text-sm transition-all ${
                      isActive ? 'border-[#666666] bg-[#111111] text-white font-bold' : 'border-transparent text-[#999999] hover:border-[#222222] hover:bg-[#111111] hover:text-white'
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
                      <Pin size={9} /> Pinned
                    </p>
                    <ul className="space-y-0.5 mb-4">
                      {pinnedHistory.map((item) => renderHistoryItem(item))}
                    </ul>
                  </>
                )}

                {/* Recents section */}
                {regularHistory.length > 0 && (
                  <>
                    <p className="px-2 mb-1.5 text-[10px] font-bold uppercase tracking-widest text-[#555555]">
                      Recents
                    </p>
                    <ul className="space-y-0.5">
                      {regularHistory.map((item) => renderHistoryItem(item))}
                    </ul>
                  </>
                )}
              </>
            )}
          </div>
        )}

        {collapsed && <div className="flex-1" />}
        <UserMenu collapsed={collapsed} />
      </aside>

      {/* Search Command Palette */}
      {searchOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-start justify-center pt-24 px-4 bg-black/70 backdrop-blur-sm"
          onClick={() => { setSearchOpen(false); setSearchQuery('') }}
        >
          <div
            className="w-full max-w-lg bg-[#111111] border border-[#2a2a2a] rounded-2xl shadow-2xl overflow-hidden animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[#1e1e1e]">
              <Search size={15} className="flex-shrink-0 text-[#555555]" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search your research history..."
                className="flex-1 bg-transparent text-sm text-white placeholder:text-[#444444] outline-none font-medium"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="text-[#555555] hover:text-white transition-colors">
                  <X size={13} />
                </button>
              )}
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-bold text-[#555555] border border-[#2a2a2a] rounded bg-[#0a0a0a]">ESC</kbd>
            </div>

            {!searchQuery && (
              <div className="px-3 pt-3 pb-1">
                <p className="px-2 mb-1.5 text-[10px] font-bold tracking-[0.2em] text-[#444444] uppercase">Commands</p>
                <button
                  onClick={() => { setSearchOpen(false); handleNewResearch() }}
                  className="flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[#888888] hover:bg-[#1a1a1a] hover:text-white transition-all group"
                >
                  <PenSquare size={14} className="text-[#555555] group-hover:text-white transition-colors" />
                  <span>Start a new research</span>
                </button>
              </div>
            )}

            <div className="px-3 pb-3 pt-1">
              {searchResults.length > 0 ? (
                <>
                  <p className="px-2 mb-1.5 text-[10px] font-bold tracking-[0.2em] text-[#444444] uppercase mt-2">
                    {searchQuery ? 'Results' : 'Recent'}
                  </p>
                  <ul className="space-y-0.5 max-h-64 overflow-y-auto">
                    {searchResults.map((item) => (
                      <li key={item.run_id}>
                        <button
                          onClick={() => handleSearchNavigate(item.run_id)}
                          className="flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[#888888] hover:bg-[#1a1a1a] hover:text-white transition-all group text-left"
                        >
                          <Clock size={13} className="flex-shrink-0 text-[#444444] group-hover:text-[#888888] transition-colors" />
                          <span className="flex-1 truncate">{item.query}</span>
                          <ArrowUpRight size={12} className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-[#555555]" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              ) : searchQuery ? (
                <div className="px-3 py-6 text-center text-sm text-[#444444]">
                  No results for "<span className="text-[#888888]">{searchQuery}</span>"
                </div>
              ) : null}
            </div>

            <div className="px-5 py-2.5 border-t border-[#1a1a1a] flex items-center gap-4 text-[10px] text-[#444444] font-medium">
              <span><kbd className="font-bold text-[#555555]">↵</kbd> open</span>
              <span><kbd className="font-bold text-[#555555]">ESC</kbd> close</span>
              <span className="ml-auto">Ctrl+K to open</span>
            </div>
          </div>
        </div>
      )}

      {/* Rename Modal */}
      {renameTargetRunId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xs animate-fade-in">
          <form onSubmit={confirmRename} className="bg-[#1e1e1e] border border-[#2c2c2c] max-w-sm w-full p-6 rounded-2xl shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white" style={{fontFamily:"'Space Grotesk',sans-serif"}}>Rename chat</h3>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-[#666666] uppercase tracking-wider">New Name</label>
              <input
                type="text" required value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                className="w-full bg-black border border-[#2c2c2c] text-white px-4 py-2.5 rounded-lg outline-none focus:border-[#444444] text-sm font-medium"
                placeholder="Enter new name..."
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setRenameTargetRunId(null)}
                className="px-5 py-2 text-xs font-bold tracking-wider uppercase rounded-full bg-[#2a2a2a] text-white hover:bg-[#3a3a3a] transition-all">Cancel</button>
              <button type="submit"
                className="px-5 py-2 text-xs font-bold tracking-wider uppercase rounded-full bg-white text-black hover:bg-[#dddddd] transition-all">Save</button>
            </div>
          </form>
        </div>
      )}

      {/* Share Modal */}
      {shareTargetRunId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-[#1e1e1e] border border-[#2c2c2c] max-w-sm w-full p-6 rounded-2xl shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2" style={{fontFamily:"'Space Grotesk',sans-serif"}}>
                <Share2 size={18} className="text-[#888888]" /> Share Report
              </h3>
              <button onClick={() => setShareTargetRunId(null)} className="text-[#666666] hover:text-white transition-colors">
                <X size={16} />
              </button>
            </div>
            
            <p className="text-sm text-[#888888] leading-relaxed">
              Anyone with this link will be able to view a read-only version of this research report.
            </p>

            {!shareGeneratedUrl ? (
              <div className="pt-2">
                <button 
                  onClick={generateShareLink} 
                  disabled={shareLoading}
                  className="w-full flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-bold tracking-wider uppercase rounded-lg bg-white text-black hover:bg-[#dddddd] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {shareLoading ? <Loader2 size={14} className="animate-spin" /> : <Share2 size={14} />}
                  {shareLoading ? 'Generating...' : 'Create Public Link'}
                </button>
              </div>
            ) : (
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2 bg-black border border-[#2c2c2c] rounded-lg p-1">
                  <input 
                    type="text" 
                    readOnly 
                    value={shareGeneratedUrl} 
                    className="flex-1 bg-transparent text-white px-3 py-1.5 text-xs outline-none w-full"
                  />
                  <button 
                    onClick={copyShareLink}
                    className="flex items-center justify-center h-8 w-8 flex-shrink-0 bg-[#222222] hover:bg-[#333333] rounded-md transition-colors text-white"
                    title="Copy link"
                  >
                    {shareCopied ? <Pin size={12} className="text-green-400" /> : <MoreVertical size={12} className="opacity-0 hidden" />}
                    {shareCopied ? '✓' : 'Copy'}
                  </button>
                </div>
                <button 
                  onClick={() => setShareTargetRunId(null)}
                  className="w-full px-5 py-2.5 text-xs font-bold tracking-wider uppercase rounded-lg bg-[#2a2a2a] text-white hover:bg-[#3a3a3a] transition-all"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleteTargetRunId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-[#1e1e1e] border border-[#2c2c2c] max-w-sm w-full p-6 rounded-2xl shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white" style={{fontFamily:"'Space Grotesk',sans-serif"}}>Delete chat?</h3>
            <p className="text-sm text-[#888888] leading-relaxed">
              This will delete prompts, reports, and videos from your ResearchTube Activity.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setDeleteTargetRunId(null)}
                className="px-5 py-2 text-xs font-bold tracking-wider uppercase rounded-full bg-[#2a2a2a] text-white hover:bg-[#3a3a3a] transition-all">Cancel</button>
              <button onClick={() => void confirmDelete()}
                className="px-5 py-2 text-xs font-bold tracking-wider uppercase rounded-full bg-[#ef4444] text-white hover:bg-[#dc2626] transition-all">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-[#181818] bg-black px-4 py-2 md:hidden">
        <ul className="grid grid-cols-2 gap-1">
          {navItems.map(({ label, icon: Icon, to }) => (
            <li key={`mobile-${to}`}>
              <NavLink
                to={to}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center rounded-md py-2 text-[10px] ${isActive ? 'text-white' : 'text-[#666666]'}`
                }
              >
                <Icon size={16} />{label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </>
  )
}

export default Sidebar
