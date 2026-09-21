import { UserRound,
  Menu,
  X,
  FlaskConical,
  MessageSquare,
  PenSquare,
  Clock,
  Loader2,
  Trash2,
  MoreVertical,
  Share2,
  Pin,
  PinOff,
  Pencil,
  Search,
  ArrowUpRight,
  PanelLeftClose,
  PanelLeftOpen,
  Check,
  Copy,
  Archive,
  ArchiveRestore,
  ChevronDown,
  ChevronRight,
  Plus,
} from 'lucide-react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState, useMemo } from 'react'
import UserMenu from './UserMenu'
import { ShareConversationModal } from './chat/ShareConversationModal'
import {
  getHistory,
  deleteHistoryEntry,
  renameHistoryEntry,
  shareHistoryEntry,
  type HistoryItem,
} from '../api/research'
import {
  createChatSession,
  listChatSessions,
  deleteChatSession,
  renameChatSession,
  archiveChatSession,
  togglePinSession,
  createShareLink,
  revokeShareLink,
  type ChatSession,
} from '../api/chat'

const navItems = [
  { label: 'Research', icon: FlaskConical, to: '/research' },
  { label: 'Chat', icon: MessageSquare, to: '/chat' },
  { label: 'Profile', icon: UserRound, to: '/profile' },
]

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  // Tab: Research vs Chat
  const [sidebarTab, setSidebarTab] = useState<'research' | 'chat'>(() =>
    location.pathname.startsWith('/chat') ? 'chat' : 'research'
  )

  // Sync tab with route if user navigates via nav items
  useEffect(() => {
    if (location.pathname.startsWith('/chat')) {
      setSidebarTab('chat')
    } else if (location.pathname.startsWith('/research')) {
      setSidebarTab('research')
    }
  }, [location.pathname])

  // --- Research State --------------------------------------------------------
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [activeMenuRunId, setActiveMenuRunId] = useState<string | null>(null)
  const [deleteTargetRunId, setDeleteTargetRunId] = useState<string | null>(null)
  const [renameTargetRunId, setRenameTargetRunId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [shareTargetRunId, setShareTargetRunId] = useState<string | null>(null)
  const [shareLoading, setShareLoading] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  const [shareGeneratedUrl, setShareGeneratedUrl] = useState<string | null>(null)

  // --- Chat State ------------------------------------------------------------
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([])
  const [archivedChatSessions, setArchivedChatSessions] = useState<ChatSession[]>([])
  const [showArchivedSection, setShowArchivedSection] = useState(false)
  const [loadingChat, setLoadingChat] = useState(false)
  const [activeMenuChatId, setActiveMenuChatId] = useState<string | null>(null)
  const [deleteTargetChatId, setDeleteTargetChatId] = useState<string | null>(null)
  const [renameTargetChatId, setRenameTargetChatId] = useState<string | null>(null)
  const [chatRenameValue, setChatRenameValue] = useState('')
  const [shareChatUrl, setShareChatUrl] = useState<string | null>(null)
  const [shareChatCopied, setShareChatCopied] = useState(false)
  const [shareChatLoading, setShareChatLoading] = useState(false)
  const [shareChatModalOpen, setShareChatModalOpen] = useState(false)
  const [shareChatSessionId, setShareChatSessionId] = useState<string | null>(null)

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
    }, 600)
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

  // Pinned runs â€” persisted in localStorage
  const [pinnedRunIds, setPinnedRunIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('rt_pinned_runs') ?? '[]')
    } catch {
      return []
    }
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

  const loadHistory = async () => {
    setLoadingHistory(true)
    try {
      const data = await getHistory(1, 60)
      let items = data.items

      // Check if there is an active research run queued in localStorage
      const storedActive = localStorage.getItem('rt_active_research')
      if (storedActive) {
        try {
          const parsed = JSON.parse(storedActive)
          if (Date.now() - (parsed.timestamp || 0) < 240000) {
            const alreadyCompleted = items.some(
              (it) => it.query === parsed.query && it.status === 'completed'
            )
            if (!alreadyCompleted) {
              const pendingItem: HistoryItem = {
                run_id: parsed.pendingId || ('pending-' + parsed.timestamp),
                query: parsed.query,
                status: 'in_progress',
                video_count: parsed.videoCount || 1,
                created_at: new Date(parsed.timestamp).toISOString(),
                completed_at: null,
                research_question: parsed.query,
                executive_summary: null,
                conclusion: null,
                methodology: null,
                learning_path: [],
                key_topics: [],
                limitations: [],
                recommended_resources: [],
                analysis_evaluations: [],
                ranking_summary: null,
                videos: [],
              }
              items = [pendingItem, ...items.filter((it) => it.run_id !== pendingItem.run_id)]
            }
          } else {
            localStorage.removeItem('rt_active_research')
          }
        } catch {}
      }
      setHistory(items)
    } catch {
      setHistory([])
    } finally {
      setLoadingHistory(false)
    }
  }

  const loadChats = async () => {
    setLoadingChat(true)
    try {
      const [activeData, archivedData] = await Promise.all([
        listChatSessions(false),
        listChatSessions(false, true),
      ])
      setChatSessions(activeData.sessions || [])
      setArchivedChatSessions(archivedData.sessions || [])
    } catch {
      setChatSessions([])
      setArchivedChatSessions([])
    } finally {
      setLoadingChat(false)
    }
  }

  useEffect(() => {
    void loadHistory()
    void loadChats()
  }, [])

  useEffect(() => {
    const handleClose = () => {
      setActiveMenuRunId(null)
      setActiveMenuChatId(null)
    }
    window.addEventListener('click', handleClose)
    return () => window.removeEventListener('click', handleClose)
  }, [])

  useEffect(() => {
    const handleRefreshHistory = () => {
      void loadHistory()
    }
    const handleRefreshChat = () => {
      void loadChats()
    }
    const handleResearchStarted = (e: any) => {
      const pending = e?.detail as HistoryItem
      if (pending) {
        setHistory((prev) => [pending, ...prev.filter((it) => it.run_id !== pending.run_id)])
      } else {
        void loadHistory()
      }
    }

    window.addEventListener('research:created', handleRefreshHistory)
    window.addEventListener('research:started', handleResearchStarted as EventListener)
    window.addEventListener('chat:updated', handleRefreshChat)
    return () => {
      window.removeEventListener('research:created', handleRefreshHistory)
      window.removeEventListener('research:started', handleResearchStarted as EventListener)
      window.removeEventListener('chat:updated', handleRefreshChat)
    }
  }, [])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
        setSearchQuery('')
      }
      if (e.key === 'Escape') {
        setSearchOpen(false)
        setSearchQuery('')
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  useEffect(() => {
    if (searchOpen) setTimeout(() => searchInputRef.current?.focus(), 50)
  }, [searchOpen])

  const handleNewAction = () => {
    if (sidebarTab === 'chat' || location.pathname.startsWith('/chat')) {
      navigate('/chat')
    } else {
      navigate('/research')
      window.history.pushState({}, '', '/research')
      window.dispatchEvent(new Event('research:clear'))
    }
  }

  const activeRunId = new URLSearchParams(location.search).get('run')

  // --- Research Operations ---
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
    } catch {
      alert('Failed to delete research run.')
    }
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
    } catch {
      alert('Failed to rename research run.')
    }
  }

  // --- Chat Operations ---
  const confirmDeleteChat = async () => {
    if (!deleteTargetChatId) return
    const sId = deleteTargetChatId
    setDeleteTargetChatId(null)
    try {
      await deleteChatSession(sId)
      if (location.pathname === `/chat/${sId}`) {
        navigate('/chat')
      }
      void loadChats()
    } catch {
      alert('Failed to delete chat session.')
    }
  }

  const handleToggleArchiveChat = async (sId: string) => {
    try {
      await archiveChatSession(sId)
      window.dispatchEvent(new Event('chat:updated'))
      void loadChats()
    } catch {
      alert('Failed to update archive status.')
    }
  }

  const handleTogglePinChat = async (sId: string) => {
    try {
      await togglePinSession(sId)
      void loadChats()
    } catch {
      alert('Failed to update pin status.')
    }
  }

  const handleShareChat = async (sId: string) => {
    setShareChatSessionId(sId)
    setShareChatModalOpen(true)
    setShareChatLoading(true)
    try {
      const res = await createShareLink(sId)
      setShareChatUrl(`${window.location.origin}${res.share_url}`)
    } catch {
      alert('Failed to generate share link.')
    } finally {
      setShareChatLoading(false)
    }
  }

  const handleRevokeChatShare = async () => {
    if (!shareChatSessionId) return
    try {
      await revokeShareLink(shareChatSessionId)
      setShareChatUrl(null)
      setShareChatModalOpen(false)
      void loadChats()
    } catch {
      alert('Failed to revoke share link.')
    }
  }

  const handleCopyChatShareUrl = () => {
    if (!shareChatUrl) return
    void navigator.clipboard.writeText(shareChatUrl).then(() => {
      setShareChatCopied(true)
      setTimeout(() => setShareChatCopied(false), 2000)
    })
  }

  const confirmRenameChat = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!renameTargetChatId || !chatRenameValue.trim()) return
    const sId = renameTargetChatId
    const newTitle = chatRenameValue.trim()
    setRenameTargetChatId(null)
    try {
      await renameChatSession(sId, newTitle)
      void loadChats()
    } catch {
      alert('Failed to rename chat session.')
    }
  }

  const completedHistory = history.filter((item) => item.status === 'completed')
  const pinnedHistory = completedHistory.filter((item) => pinnedRunIds.includes(item.run_id))
  const regularHistory = completedHistory.filter((item) => !pinnedRunIds.includes(item.run_id))

  // --- Unified Search (Research Runs + Chat Sessions) ---
  const [searchFilter, setSearchFilter] = useState<'all' | 'research' | 'chat'>('all')

  const allSearchItems = useMemo(() => {
    const researchItems = completedHistory.map((item) => ({
      id: item.run_id,
      type: 'research' as const,
      title: item.query,
      date: item.created_at,
      isPinned: pinnedRunIds.includes(item.run_id),
      isArchived: false,
    }))

    const chatItems = [
      ...chatSessions.map((s) => ({
        id: s.id,
        type: 'chat' as const,
        title: s.title || 'Untitled Chat',
        date: s.updated_at || s.created_at,
        isPinned: s.is_pinned,
        isArchived: false,
      })),
      ...archivedChatSessions.map((s) => ({
        id: s.id,
        type: 'chat' as const,
        title: s.title || 'Untitled Chat',
        date: s.updated_at || s.created_at,
        isPinned: s.is_pinned,
        isArchived: true,
      })),
    ]

    return { researchItems, chatItems }
  }, [completedHistory, pinnedRunIds, chatSessions, archivedChatSessions])

  const filteredSearchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    let pool: Array<{
      id: string
      type: 'research' | 'chat'
      title: string
      date?: string
      isPinned?: boolean
      isArchived?: boolean
    }> = []

    if (searchFilter === 'all') {
      pool = [...allSearchItems.chatItems, ...allSearchItems.researchItems]
    } else if (searchFilter === 'research') {
      pool = allSearchItems.researchItems
    } else if (searchFilter === 'chat') {
      pool = allSearchItems.chatItems
    }

    if (q) {
      return pool.filter((item) => item.title.toLowerCase().includes(q))
    }

    if (searchFilter === 'all') {
      return [
        ...allSearchItems.chatItems.slice(0, 5),
        ...allSearchItems.researchItems.slice(0, 5),
      ]
    }
    return pool.slice(0, 10)
  }, [searchQuery, searchFilter, allSearchItems])

  const handleSearchNavigate = (item: { id: string; type: 'research' | 'chat' }) => {
    setSearchOpen(false)
    setSearchQuery('')
    if (item.type === 'research') {
      navigate(`/research?run=${item.id}`)
    } else {
      navigate(`/chat/${item.id}`)
    }
  }

  const handleStartNewChatFromSearch = () => {
    setSearchOpen(false)
    setSearchQuery('')
    navigate('/chat')
    window.dispatchEvent(new Event('chat:new'))
    window.dispatchEvent(new Event('chat:updated'))
  }

  const handleCreateChatFromHistory = async (item: HistoryItem) => {
    setActiveMenuRunId(null)
    try {
      const session = await createChatSession({
        title: item.query.length > 50 ? `${item.query.slice(0, 50)}...` : item.query,
        research_run_id: item.run_id,
      })
      window.dispatchEvent(new Event('chat:updated'))
      navigate(`/chat/${session.id}`)
    } catch {
      navigate('/chat')
    }
  }

  // Shared history item renderer
  const renderHistoryItem = (item: HistoryItem) => {
    const isPending = item.status === 'in_progress' || item.status === 'planning' || item.status === 'researching' || item.run_id.startsWith('pending-')

    return (
      <li key={item.run_id} className="relative group">
        <button
          onClick={() => {
            if (isLongPressRef.current) return
            if (isPending) {
              navigate('/research')
            } else {
              navigate(`/research?run=${item.run_id}`)
            }
          }}
          onTouchStart={(e) => handleTouchStart(e, item.run_id)}
          onTouchEnd={handleTouchEnd}
          onTouchMove={handleTouchMove}
          className={`flex w-full items-start gap-2 rounded-md pl-2 pr-14 py-2 text-left text-xs transition-all duration-200 hover:bg-[#111111] ${
            activeRunId === item.run_id
              ? 'bg-[#111111] text-white font-bold border-l-2 border-white'
              : isPending
              ? 'text-white/90 bg-white/5'
              : 'text-[#888888] hover:text-white'
          }`}
        >
          {isPending ? (
            <Loader2 size={11} className="mt-0.5 flex-shrink-0 animate-spin text-white" />
          ) : pinnedRunIds.includes(item.run_id) ? (
            <Pin size={10} className="mt-0.5 flex-shrink-0 opacity-50 text-white" />
          ) : (
            <Clock size={11} className="mt-0.5 flex-shrink-0 opacity-50" />
          )}
          <span className="line-clamp-2 leading-relaxed">
            {item.query}
            {isPending && <span className="ml-1 text-[10px] text-[#888888] font-mono">(Running...)</span>}
          </span>
        </button>

        {!isPending && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2 hidden group-hover:flex show-on-touch items-center gap-0.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                void handleCreateChatFromHistory(item)
              }}
              title="Chat about this research"
              className="flex items-center justify-center p-1 rounded hover:bg-[#222222] text-[#666666] hover:text-white transition-colors"
            >
              <MessageSquare size={12} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setActiveMenuRunId(activeMenuRunId === item.run_id ? null : item.run_id)
              }}
              title="More options"
              className="flex items-center justify-center p-1 rounded hover:bg-[#222222] text-[#666666] hover:text-white transition-colors"
            >
              <MoreVertical size={13} />
            </button>
          </div>
        )}
      {activeMenuRunId === item.run_id && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute right-2 top-8 z-50 w-44 bg-[#111111] border border-[#222222] rounded-xl py-1 shadow-2xl animate-fade-in text-xs"
        >
          <button
            onClick={() => void handleCreateChatFromHistory(item)}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[#cccccc] hover:bg-[#181818] hover:text-white"
          >
            <MessageSquare size={12} className="opacity-70" />
            <span>Chat about this</span>
          </button>
          <button
            onClick={() => {
              setShareTargetRunId(item.run_id)
              setShareGeneratedUrl(null)
              setShareCopied(false)
              setActiveMenuRunId(null)
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[#cccccc] hover:bg-[#181818] hover:text-white"
          >
            <Share2 size={12} className="opacity-70" />
            <span>Share conversation</span>
          </button>
          <button
            onClick={() => {
              togglePin(item.run_id)
              setActiveMenuRunId(null)
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[#cccccc] hover:bg-[#181818] hover:text-white"
          >
            {pinnedRunIds.includes(item.run_id) ? (
              <>
                <PinOff size={12} className="opacity-70" />
                <span>Unpin</span>
              </>
            ) : (
              <>
                <Pin size={12} className="opacity-70" />
                <span>Pin</span>
              </>
            )}
          </button>
          <button
            onClick={() => {
              setRenameTargetRunId(item.run_id)
              setRenameValue(item.query)
              setActiveMenuRunId(null)
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[#cccccc] hover:bg-[#181818] hover:text-white"
          >
            <Pencil size={12} className="opacity-70" />
            <span>Rename</span>
          </button>
          <hr className="border-[#222222] my-1" />
          <button
            onClick={() => {
              setDeleteTargetRunId(item.run_id)
              setActiveMenuRunId(null)
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[#ef4444] hover:bg-[#181818]"
          >
            <Trash2 size={12} className="opacity-70" />
            <span>Delete</span>
          </button>
        </div>
      )}
    </li>
    )
  }

  // Chat item renderer
  const renderChatItem = (item: ChatSession) => {
    const isChatActive = location.pathname === `/chat/${item.id}`
    return (
      <li key={item.id} className="relative group">
        <button
          onClick={() => navigate(`/chat/${item.id}`)}
          className={`flex w-full items-start gap-2 rounded-md pl-2 pr-8 py-2 text-left text-xs transition-all duration-200 hover:bg-[#111111] ${
            isChatActive
              ? 'bg-[#111111] text-white font-bold border-l-2 border-white'
              : 'text-[#888888] hover:text-white'
          }`}
        >
          {item.is_pinned ? (
            <Pin size={10} className="mt-0.5 flex-shrink-0 opacity-50 text-white" />
          ) : (
            <Clock size={11} className="mt-0.5 flex-shrink-0 opacity-50" />
          )}
          <span className="line-clamp-2 leading-relaxed">{item.title || 'New Chat'}</span>
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            setActiveMenuChatId(activeMenuChatId === item.id ? null : item.id)
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 hidden group-hover:flex show-on-touch items-center justify-center p-1 rounded hover:bg-[#222222] text-[#666666] hover:text-white transition-colors"
        >
          <MoreVertical size={13} />
        </button>
        {activeMenuChatId === item.id && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute right-2 top-8 z-50 w-44 bg-[#111111] border border-[#222222] rounded-xl py-1 shadow-2xl animate-fade-in text-xs"
          >
            <button
              onClick={() => {
                setActiveMenuChatId(null)
                void handleShareChat(item.id)
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[#cccccc] hover:bg-[#181818] hover:text-white"
            >
              <Share2 size={12} className="opacity-70" />
              <span>Share conversation</span>
            </button>
            <button
              onClick={() => {
                setActiveMenuChatId(null)
                void handleTogglePinChat(item.id)
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[#cccccc] hover:bg-[#181818] hover:text-white"
            >
              <Pin size={12} className={item.is_pinned ? 'fill-white text-white' : 'opacity-70'} />
              <span>{item.is_pinned ? 'Unpin' : 'Pin'}</span>
            </button>
            <button
              onClick={() => {
                setRenameTargetChatId(item.id)
                setChatRenameValue(item.title || '')
                setActiveMenuChatId(null)
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[#cccccc] hover:bg-[#181818] hover:text-white"
            >
              <Pencil size={12} className="opacity-70" />
              <span>Rename</span>
            </button>
            <button
              onClick={() => {
                setActiveMenuChatId(null)
                void handleToggleArchiveChat(item.id)
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[#cccccc] hover:bg-[#181818] hover:text-white"
            >
              <Archive size={12} className="opacity-70" />
              <span>Archive</span>
            </button>
            <hr className="border-[#222222] my-1" />
            <button
              onClick={() => {
                setDeleteTargetChatId(item.id)
                setActiveMenuChatId(null)
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[#ef4444] hover:bg-[#181818]"
            >
              <Trash2 size={12} className="opacity-70" />
              <span>Delete</span>
            </button>
          </div>
        )}
      </li>
    )
  }

  // Archived Chat item renderer
  const renderArchivedChatItem = (item: ChatSession) => {
    const isChatActive = location.pathname === `/chat/${item.id}`
    return (
      <li key={item.id} className="relative group">
        <button
          onClick={() => navigate(`/chat/${item.id}`)}
          className={`flex w-full items-start gap-2 rounded-md pl-2 pr-14 py-2 text-left text-xs transition-all duration-200 hover:bg-[#111111] opacity-75 hover:opacity-100 ${
            isChatActive
              ? 'bg-[#111111] text-white font-bold border-l-2 border-zinc-500'
              : 'text-[#888888] hover:text-white'
          }`}
        >
          <Archive size={11} className="mt-0.5 flex-shrink-0 opacity-50" />
          <span className="line-clamp-2 leading-relaxed">{item.title || 'New Chat'}</span>
        </button>

        <div className="absolute right-2 top-1/2 -translate-y-1/2 hidden group-hover:flex show-on-touch items-center gap-0.5">
          <button
            onClick={(e) => {
              e.stopPropagation()
              void handleToggleArchiveChat(item.id)
            }}
            title="Unarchive conversation"
            className="p-1 rounded hover:bg-[#222222] text-[#666666] hover:text-white transition-colors"
          >
            <ArchiveRestore size={13} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setActiveMenuChatId(activeMenuChatId === item.id ? null : item.id)
            }}
            className="p-1 rounded hover:bg-[#222222] text-[#666666] hover:text-white transition-colors"
          >
            <MoreVertical size={13} />
          </button>
        </div>

        {activeMenuChatId === item.id && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute right-2 top-8 z-50 w-44 bg-[#111111] border border-[#222222] rounded-xl py-1 shadow-2xl animate-fade-in text-xs"
          >
            <button
              onClick={() => {
                setActiveMenuChatId(null)
                void handleToggleArchiveChat(item.id)
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[#cccccc] hover:bg-[#181818] hover:text-emerald-400"
            >
              <ArchiveRestore size={12} className="opacity-70" />
              <span>Unarchive</span>
            </button>
            <button
              onClick={() => {
                setRenameTargetChatId(item.id)
                setChatRenameValue(item.title || '')
                setActiveMenuChatId(null)
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[#cccccc] hover:bg-[#181818] hover:text-white"
            >
              <Pencil size={12} className="opacity-70" />
              <span>Rename</span>
            </button>
            <hr className="border-[#222222] my-1" />
            <button
              onClick={() => {
                setDeleteTargetChatId(item.id)
                setActiveMenuChatId(null)
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[#ef4444] hover:bg-[#181818]"
            >
              <Trash2 size={12} className="opacity-70" />
              <span>Delete</span>
            </button>
          </div>
        )}
      </li>
    )
  }

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
        className={`fixed left-0 top-0 z-30 flex h-screen flex-col border-r border-[#181818] bg-black transition-all duration-300 md:translate-x-0 pb-16 md:pb-0 ${
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
            <Link to="/research" className="truncate text-xs font-bold tracking-[0.35em] text-white pl-12 md:pl-0">
              RESEARCHTUBE
            </Link>
          )}
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                setSearchOpen(true)
                setSearchQuery('')
              }}
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

        {/* New Action Button */}
        <div className="px-3 py-2">
          <button
            onClick={handleNewAction}
            title={sidebarTab === 'chat' ? 'New Chat' : 'New Research'}
            className="flex w-full items-center gap-2.5 rounded-md border border-[#222222] bg-[#111111] px-3 py-2.5 text-sm text-white transition-all duration-200 hover:border-[#444444] hover:bg-[#181818]"
            style={{ justifyContent: collapsed ? 'center' : 'flex-start' }}
          >
            <PenSquare size={15} className="flex-shrink-0 text-white" />
            {!collapsed && (
              <span className="truncate font-semibold">
                {sidebarTab === 'chat' ? 'New Chat' : 'New Research'}
              </span>
            )}
          </button>
        </div>

        {/* History List */}
        {!collapsed && (
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar px-3 py-3">
            {/* Tab Switcher */}
            <div className="flex items-center gap-1 rounded-lg bg-[#111111] p-1 mb-3 border border-[#222222]">
              <button
                onClick={() => setSidebarTab('research')}
                className={`flex-1 rounded-md py-1 text-[11px] font-semibold transition-all ${
                  sidebarTab === 'research'
                    ? 'bg-[#222222] text-white shadow-xs'
                    : 'text-[#666666] hover:text-white'
                }`}
              >
                Research ({completedHistory.length})
              </button>
              <button
                onClick={() => setSidebarTab('chat')}
                className={`flex-1 rounded-md py-1 text-[11px] font-semibold transition-all ${
                  sidebarTab === 'chat'
                    ? 'bg-[#222222] text-white shadow-xs'
                    : 'text-[#666666] hover:text-white'
                }`}
              >
                Chat ({chatSessions.length})
              </button>
            </div>

            {sidebarTab === 'research' ? (
              loadingHistory ? (
                <div className="flex items-center gap-2 px-2 py-2 text-[#555555]">
                  <Loader2 size={12} className="animate-spin" />
                  <span className="text-xs">Loading history...</span>
                </div>
              ) : completedHistory.length === 0 ? (
                <p className="px-2 py-2 text-xs text-[#555555]">No research runs yet.</p>
              ) : (
                <>
                  {pinnedHistory.length > 0 && (
                    <>
                      <p className="px-2 mb-1.5 text-[10px] font-bold uppercase tracking-widest text-[#555555] flex items-center gap-1.5">
                        <Pin size={10} className="text-white" /> Pinned
                      </p>
                      <ul className="space-y-0.5 mb-4">{pinnedHistory.map(renderHistoryItem)}</ul>
                    </>
                  )}

                  <p className="px-2 mb-1.5 text-[10px] font-bold uppercase tracking-widest text-[#555555]">
                    Recent
                  </p>
                  <ul className="space-y-0.5">{regularHistory.map(renderHistoryItem)}</ul>
                </>
              )
            ) : loadingChat ? (
              <div className="flex items-center gap-2 px-2 py-2 text-[#555555]">
                <Loader2 size={12} className="animate-spin text-white" />
                <span className="text-xs">Loading chats...</span>
              </div>
            ) : chatSessions.length === 0 ? (
              <div className="px-2 py-4 text-center">
                <p className="text-xs text-[#666666] mb-2">No chat sessions yet.</p>
                <button
                  onClick={() => navigate('/chat')}
                  className="text-xs text-white hover:underline font-medium"
                >
                  Start a conversation &rarr;
                </button>
              </div>
            ) : (
              <>
                {/* Pinned Chats Section */}
                {chatSessions.some((s) => s.is_pinned) && (
                  <>
                    <p className="px-2 mb-1.5 text-[10px] font-bold uppercase tracking-widest text-[#555555] flex items-center gap-1.5">
                      <Pin size={10} className="text-white" /> Pinned
                    </p>
                    <ul className="space-y-0.5 mb-4">
                      {chatSessions.filter((s) => s.is_pinned).map(renderChatItem)}
                    </ul>
                  </>
                )}

                {/* Recent Chats Section */}
                {chatSessions.some((s) => !s.is_pinned) && (
                  <>
                    <p className="px-2 mb-1.5 text-[10px] font-bold uppercase tracking-widest text-[#555555]">
                      Recent
                    </p>
                    <ul className="space-y-0.5">
                      {chatSessions.filter((s) => !s.is_pinned).map(renderChatItem)}
                    </ul>
                  </>
                )}

                {/* Archived Chats Collapsible Section */}
                {archivedChatSessions.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-[#181818]">
                    <button
                      onClick={() => setShowArchivedSection((prev) => !prev)}
                      className="flex w-full items-center justify-between px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest text-[#555555] hover:text-[#999999] hover:bg-[#111111] transition-colors"
                    >
                      <span className="flex items-center gap-1.5">
                        <Archive size={11} className="text-[#666666]" />
                        Archived ({archivedChatSessions.length})
                      </span>
                      {showArchivedSection ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    </button>
                    {showArchivedSection && (
                      <ul className="space-y-0.5 mt-1.5 animate-fade-in">
                        {archivedChatSessions.map(renderArchivedChatItem)}
                      </ul>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Footer profile menu */}
        <div className="flex-shrink-0 border-t border-[#181818] p-3">
          <UserMenu collapsed={collapsed} />
        </div>
      </aside>

      {/* Delete Research Run Modal */}
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

      {/* Share Chat Modal */}
      <ShareConversationModal
        isOpen={shareChatModalOpen}
        onClose={() => setShareChatModalOpen(false)}
        shareUrl={shareChatUrl}
        loading={shareChatLoading}
        copied={shareChatCopied}
        onCopy={handleCopyChatShareUrl}
        onRevoke={handleRevokeChatShare}
      />

      {/* Delete Chat Session Modal */}
      {deleteTargetChatId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 backdrop-blur-xs">
          <div className="w-full max-w-sm border border-[#222222] bg-[#111111] p-6 shadow-2xl animate-fade-in rounded-2xl space-y-4">
            <h3 className="text-base font-bold text-white">Delete Chat Session</h3>
            <p className="text-xs text-[#888888] leading-relaxed">
              Are you sure you want to delete this chat session and its complete message history?
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setDeleteTargetChatId(null)}
                className="px-4 py-2 text-xs font-bold text-[#888888] hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => void confirmDeleteChat()}
                className="px-4 py-2 text-xs font-bold bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Research Run Modal */}
      {renameTargetRunId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 backdrop-blur-xs">
          <form
            onSubmit={(e) => void confirmRename(e)}
            className="w-full max-w-sm border border-[#222222] bg-[#111111] p-6 shadow-2xl animate-fade-in rounded-2xl space-y-4"
          >
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

      {/* Rename Chat Session Modal */}
      {renameTargetChatId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 backdrop-blur-xs">
          <form
            onSubmit={(e) => void confirmRenameChat(e)}
            className="w-full max-w-sm border border-[#222222] bg-[#111111] p-6 shadow-2xl animate-fade-in rounded-2xl space-y-4"
          >
            <h3 className="text-base font-bold text-white">Rename Chat Session</h3>
            <input
              type="text"
              value={chatRenameValue}
              onChange={(e) => setChatRenameValue(e.target.value)}
              placeholder="Enter new conversation title..."
              className="w-full bg-[#181818] border border-[#333333] rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-white transition-colors"
              autoFocus
            />
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRenameTargetChatId(null)}
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
                <Share2 size={16} className="text-white" /> Share Research Report
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
                    className="flex-1 bg-transparent text-xs text-[#cccccc] outline-none font-mono truncate"
                  />
                  <button
                    onClick={() => void copyShareLink()}
                    className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-black hover:bg-zinc-200 transition-colors flex-shrink-0"
                  >
                    {shareCopied ? (<><Check size={13} className="text-emerald-600" /><span>Copied!</span></>) : (<><Copy size={13} /><span>Copy</span></>)}
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
            {/* Search Input Row */}
            <div className="flex items-center gap-3 border-b border-[#222222] px-4 py-3">
              <Search size={16} className="text-[#666666]" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search research runs & chat sessions..."
                className="w-full bg-transparent text-sm text-white outline-none placeholder:text-[#555555]"
              />
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                className="border border-[#222222] bg-black px-2 py-0.5 text-[10px] font-bold text-[#555555] rounded hover:text-white transition-colors cursor-pointer"
              >
                ESC
              </button>
            </div>

            {/* Filter Tags Bar & New Chat Quick Action */}
            <div className="flex items-center justify-between border-b border-[#1f1f1f] bg-[#0c0c0d] px-4 py-2 text-xs select-none">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setSearchFilter('all')}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-all ${
                    searchFilter === 'all'
                      ? 'bg-white text-black font-semibold shadow-sm'
                      : 'bg-[#161616] text-[#888888] hover:text-white hover:bg-[#202020]'
                  }`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setSearchFilter('research')}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-all ${
                    searchFilter === 'research'
                      ? 'bg-white text-black font-semibold shadow-sm'
                      : 'bg-[#161616] text-[#888888] hover:text-white hover:bg-[#202020]'
                  }`}
                >
                  Research
                </button>
                <button
                  type="button"
                  onClick={() => setSearchFilter('chat')}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-all ${
                    searchFilter === 'chat'
                      ? 'bg-white text-black font-semibold shadow-sm'
                      : 'bg-[#161616] text-[#888888] hover:text-white hover:bg-[#202020]'
                  }`}
                >
                  Chat
                </button>
              </div>

              {/* Quick Action: Start New Chat */}
              <button
                type="button"
                onClick={handleStartNewChatFromSearch}
                className="flex items-center gap-1.5 rounded-lg border border-[#2a2a2a] bg-[#161616] px-2.5 py-1 text-[11px] font-medium text-white hover:border-[#444444] hover:bg-[#222222] transition-all cursor-pointer group"
                title="Start a fresh new AI chat"
              >
                <Plus size={12} className="text-[#aaaaaa] group-hover:text-white transition-colors" />
                <span>New Chat</span>
              </button>
            </div>

            {/* Results List */}
            <div className="max-h-80 overflow-y-auto p-2 custom-scrollbar">
              {filteredSearchResults.length === 0 ? (
                <div className="py-8 px-4 text-center">
                  <p className="text-xs text-[#666666]">
                    No matching {searchFilter === 'all' ? 'research runs or chats' : searchFilter === 'research' ? 'research runs' : 'chat sessions'} found.
                  </p>
                  <button
                    onClick={handleStartNewChatFromSearch}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-[#333333] bg-[#161616] px-3 py-1.5 text-xs text-white hover:border-[#555555] hover:bg-[#222222] transition-all cursor-pointer"
                  >
                    <Plus size={13} />
                    <span>Start a New Chat</span>
                  </button>
                </div>
              ) : (
                <ul className="space-y-1">
                  {filteredSearchResults.map((item) => (
                    <li key={`${item.type}-${item.id}`}>
                      <button
                        onClick={() => handleSearchNavigate(item)}
                        className="flex w-full items-center justify-between rounded-xl p-2.5 text-left text-xs text-[#cccccc] hover:bg-[#181818] hover:text-white transition-all group cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 pr-3">
                          {/* Tag: Research vs Chat (Clean dark greyish-black, no icons) */}
                          {item.type === 'research' ? (
                            <span className="rounded-md bg-[#161616] border border-[#282828] px-2 py-0.5 text-[10px] font-medium text-[#8e8e8e] flex-shrink-0">
                              Research
                            </span>
                          ) : (
                            <span className="rounded-md bg-[#161616] border border-[#282828] px-2 py-0.5 text-[10px] font-medium text-[#8e8e8e] flex-shrink-0">
                              Chat
                            </span>
                          )}

                          {item.isPinned && (
                            <Pin size={10} className="text-white flex-shrink-0 opacity-70" />
                          )}

                          {item.isArchived && (
                            <span className="rounded bg-amber-500/10 border border-amber-500/20 px-1 py-0.2 text-[9px] text-amber-300 flex-shrink-0">
                              Archived
                            </span>
                          )}

                          <span className="truncate font-medium">{item.title}</span>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          {item.date && (
                            <span className="text-[10px] text-[#555555] font-mono group-hover:text-[#777777] transition-colors hidden sm:inline">
                              {new Date(item.date).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                              })}
                            </span>
                          )}
                          <ArrowUpRight size={13} className="text-[#555555] group-hover:text-white transition-colors" />
                        </div>
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





