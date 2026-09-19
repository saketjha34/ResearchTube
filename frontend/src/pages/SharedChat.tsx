import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  MessageSquare,
  Sparkles,
  GitFork,
  ArrowRight,
  Loader2,
  AlertCircle,
  Video,
  Copy,
  Check,
  LogIn,
  UserPlus,
  X,
} from 'lucide-react'
import { getPublicSharedChat, forkSharedChat, type PublicSharedChat } from '../api/chat'
import { getAccessToken } from '../api/auth'
import { ChatMessageItem } from '../components/chat/ChatMessageItem'

export default function SharedChat() {
  const { shareToken, id, runId } = useParams<{ shareToken?: string; id?: string; runId?: string }>()
  const token = shareToken || id || runId
  const navigate = useNavigate()

  const [chat, setChat] = useState<PublicSharedChat | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [forking, setForking] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)

  const isAuthenticated = Boolean(getAccessToken())

  useEffect(() => {
    if (!token) return

    const loadSharedChat = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await getPublicSharedChat(token)
        setChat(data)
      } catch (err: any) {
        setError(err.response?.data?.detail || 'This shared conversation does not exist or has been revoked.')
      } finally {
        setLoading(false)
      }
    }

    void loadSharedChat()
  }, [token])

  const handleFork = async () => {
    if (!token) return

    if (!isAuthenticated) {
      setShowAuthModal(true)
      return
    }

    setForking(true)
    try {
      const res = await forkSharedChat(token)
      navigate(`/chat/${res.new_session_id}`)
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to fork conversation. Please try again.')
      setForking(false)
    }
  }

  const handleCopyLink = () => {
    void navigator.clipboard.writeText(window.location.href).then(() => {
      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), 2000)
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-4">
        <Loader2 size={32} className="animate-spin text-white" />
        <p className="text-xs font-mono tracking-wider text-[#888888] uppercase">
          Loading shared conversation...
        </p>
      </div>
    )
  }

  if (error || !chat) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1a1a1a] border border-[#2a2a2a] text-zinc-400">
            <AlertCircle size={24} />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">Conversation Not Available</h1>
          <p className="text-sm text-[#888888] leading-relaxed">
            {error || 'This conversation link is invalid or has been made private by its author.'}
          </p>
          <div className="pt-4">
            <Link
              to="/chat"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-xs font-semibold text-black hover:bg-zinc-200 transition-colors"
            >
              <MessageSquare size={14} />
              <span>Go to Chat</span>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Top Header Bar */}
      <header className="sticky top-0 z-40 border-b border-[#1c1c1c] bg-black/90 backdrop-blur-md px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            to="/"
            className="flex items-center gap-2 text-xs font-bold tracking-wider text-white hover:text-zinc-300 transition-colors flex-shrink-0"
          >
            <span>ResearchTube AI</span>
          </Link>

          <span className="text-[#333333] hidden sm:inline">/</span>

          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-white truncate">
              {chat.title || 'Shared Conversation'}
            </h1>
            <p className="text-[10px] text-[#666666] truncate">
              Shared {new Date(chat.shared_at || chat.created_at).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })} &bull; {chat.messages.length} turns
            </p>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 rounded-lg border border-[#262626] bg-[#121212] px-3 py-1.5 text-xs font-medium text-[#aaaaaa] hover:border-[#444444] hover:text-white transition-all"
            title="Copy shared link"
          >
            {copiedLink ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
            <span className="hidden md:inline">{copiedLink ? 'Copied' : 'Copy link'}</span>
          </button>

          <button
            onClick={() => void handleFork()}
            disabled={forking}
            className="flex items-center gap-2 rounded-lg bg-white px-4 py-1.5 text-xs font-bold text-black hover:bg-zinc-200 transition-all disabled:opacity-50 shadow-md"
          >
            {forking ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <GitFork size={14} />
            )}
            <span>Continue conversation</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {/* Video scope pill (if scoped) */}
        {chat.video_title && (
          <div className="mb-6 flex items-center gap-2 rounded-xl border border-[#222222] bg-[#111111] px-4 py-2.5 text-xs text-[#cccccc]">
            <Video size={14} className="text-white flex-shrink-0" />
            <span className="text-[#888888]">Scoped to:</span>
            <span className="font-semibold text-white truncate">{chat.video_title}</span>
            {chat.youtube_video_id && (
              <a
                href={`https://www.youtube.com/watch?v=${chat.youtube_video_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto text-[11px] text-[#888888] hover:text-white underline underline-offset-2 flex-shrink-0"
              >
                Watch on YouTube &rarr;
              </a>
            )}
          </div>
        )}

        {/* Message Thread */}
        <div className="space-y-6 pb-24">
          {chat.messages.map((msg) => (
            <ChatMessageItem
              key={msg.id}
              message={{
                id: msg.id,
                session_id: chat.id,
                role: msg.role as 'user' | 'assistant',
                content: msg.content,
                sources: msg.sources,
                created_at: msg.created_at,
              }}
            />
          ))}
        </div>
      </main>

      {/* Bottom Floating Action Bar */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 w-full max-w-lg px-4">
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-[#2a2a2a] bg-[#141417]/95 px-5 py-3.5 shadow-2xl backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-black font-bold">
              <Sparkles size={16} />
            </div>
            <div>
              <p className="text-xs font-bold text-white">Continue this chat</p>
              <p className="text-[11px] text-[#888888]">Ask your own follow-up questions</p>
            </div>
          </div>

          <button
            onClick={() => void handleFork()}
            disabled={forking}
            className="flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-xs font-bold text-black hover:bg-zinc-200 transition-all disabled:opacity-50"
          >
            {forking ? <Loader2 size={13} className="animate-spin" /> : <span>Start chat</span>}
            <ArrowRight size={13} />
          </button>
        </div>
      </div>

      {/* Sign In / Sign Up Modal for Unauthenticated Users */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-sm rounded-2xl border border-[#262626] bg-[#111111] p-6 shadow-2xl space-y-4 relative">
            <button
              onClick={() => setShowAuthModal(false)}
              className="absolute right-4 top-4 text-[#888888] hover:text-white transition-colors"
            >
              <X size={16} />
            </button>

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1e1e1e] border border-[#2a2a2a] text-white">
              <GitFork size={20} />
            </div>

            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Continue This Conversation
              </h2>
              <p className="mt-1 text-xs text-[#888888] leading-relaxed">
                Sign in or create a free account to fork this conversation and explore follow-up questions with ResearchTube AI.
              </p>
            </div>

            <div className="pt-2 space-y-2">
              <button
                onClick={() => {
                  sessionStorage.setItem('rt_pending_fork', token || '')
                  navigate(`/login?redirect=${encodeURIComponent(`/share/chat/${token}`)}`)
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-2.5 text-xs font-bold text-black hover:bg-zinc-200 transition-colors"
              >
                <LogIn size={14} />
                <span>Log in</span>
              </button>

              <button
                onClick={() => {
                  sessionStorage.setItem('rt_pending_fork', token || '')
                  navigate(`/register?redirect=${encodeURIComponent(`/share/chat/${token}`)}`)
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] py-2.5 text-xs font-semibold text-white hover:bg-[#252525] transition-colors"
              >
                <UserPlus size={14} />
                <span>Sign up</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

