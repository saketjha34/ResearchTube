import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  MessageSquare,
  Sparkles,
  Plus,
  Edit2,
  Check,
  X,
  AlertCircle,
  Loader2,
  ArrowRight,
  Share2,
  Pin,
  Copy,
  ArrowUpRight,
} from 'lucide-react'
import {
  getAvailableVideos,
  getChatSession,
  createChatSession,
  renameChatSession,
  togglePinSession,
  createShareLink,
  revokeShareLink,
  streamMessage,
  type AvailableVideo,
  type ChatMessage,
  type ChatSessionDetail,
} from '../api/chat'
import { ChatMessageItem } from '../components/chat/ChatMessageItem'
import { ChatInput } from '../components/chat/ChatInput'

const STARTER_PROMPTS = [
  {
    title: 'Executive Summary',
    description: 'Break down the core insights and takeaways',
    prompt: 'Summarize the core takeaways and key technical insights from the researched video content.',
  },
  {
    title: 'Architecture & Design',
    description: 'Analyze systems and patterns discussed',
    prompt: 'Explain the technical architecture and core engineering patterns covered in this material.',
  },
  {
    title: 'Step-by-Step Guide',
    description: 'Actionable implementation roadmap',
    prompt: 'Provide a structured step-by-step guide to implement the concepts taught in this topic.',
  },
  {
    title: 'Technical Q&A',
    description: 'Test your understanding with practice questions',
    prompt: 'Generate 3 high-yield technical interview questions and detailed answers based on these concepts.',
  },
]

export default function Chat() {
  const { sessionId } = useParams<{ sessionId?: string }>()
  const navigate = useNavigate()

  const [availableVideos, setAvailableVideos] = useState<AvailableVideo[]>([])
  const [selectedVideo, setSelectedVideo] = useState<AvailableVideo | null>(null)
  const [session, setSession] = useState<ChatSessionDetail | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loadingSession, setLoadingSession] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Title editing state
  const [editingTitle, setEditingTitle] = useState(false)
  const [shareModalOpen, setShareModalOpen] = useState(false)
  const [shareLoading, setShareLoading] = useState(false)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [shareCopied, setShareCopied] = useState(false)
  const [titleInput, setTitleInput] = useState('')

  const messagesEndRef = useRef<HTMLDivElement>(null)
  // Set to the new session ID when we create a session ourselves to prevent
  // the load-session effect from clearing our optimistic messages mid-stream.
  const justCreatedSessionRef = useRef<string | null>(null)

  // Scroll to bottom smoothly
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, streamingText])

  // Load available researched videos
  useEffect(() => {
    const fetchVideos = async () => {
      try {
        const res = await getAvailableVideos()
        setAvailableVideos(res.videos)
      } catch (err) {
        console.error('Failed to load available videos:', err)
      }
    }
    void fetchVideos()
  }, [])

  // Load active session
  useEffect(() => {
    if (!sessionId) {
      setSession(null)
      setMessages([])
      return
    }


    // If we just created this session ourselves (during handleSubmit), skip the
    // re-fetch entirely so we do not clear the optimistic messages or interrupt
    // the ongoing stream. The ref is cleared once streaming completes.
    if (justCreatedSessionRef.current === sessionId) {
      return
    }

    const load = async () => {
      setLoadingSession(true)
      setError(null)
      try {
        const data = await getChatSession(sessionId)
        setSession(data)
        setMessages(data.messages || [])
        setTitleInput(data.title || 'Chat Session')

        // Resolve selected video if scoped
        if (data.video_id && availableVideos.length > 0) {
          const match = availableVideos.find((v) => v.db_id === data.video_id)
          if (match) setSelectedVideo(match)
        }
      } catch (err) {
        console.error('Failed to fetch session:', err)
        setError('Failed to load this chat session. It may have been deleted.')
      } finally {
        setLoadingSession(false)
      }
    }

    void load()
  }, [sessionId, availableVideos])

  // Start new chat
  const handleNewChat = () => {
    navigate('/chat')
    setSession(null)
    setMessages([])
    setInput('')
    setError(null)
    setSelectedVideo(null)
  }

  // Toggle pin status
  const handleTogglePin = async () => {
    if (!session) return
    try {
      const updated = await togglePinSession(session.id)
      setSession((prev) => (prev ? { ...prev, is_pinned: updated.is_pinned } : null))
      window.dispatchEvent(new Event('chat:updated'))
    } catch {
      alert('Failed to update pin status.')
    }
  }

  // Open share modal & generate public link
  const handleOpenShare = async () => {
    if (!session) return
    setShareModalOpen(true)
    setShareLoading(true)
    try {
      const res = await createShareLink(session.id)
      const fullUrl = `${window.location.origin}${res.share_url}`
      setShareUrl(fullUrl)
      setSession((prev) => (prev ? { ...prev, is_shared: true, share_token: res.share_token } : null))
      window.dispatchEvent(new Event('chat:updated'))
    } catch {
      alert('Failed to generate share link.')
    } finally {
      setShareLoading(false)
    }
  }

  // Copy share URL
  const handleCopyShareUrl = () => {
    if (!shareUrl) return
    void navigator.clipboard.writeText(shareUrl).then(() => {
      setShareCopied(true)
      setTimeout(() => setShareCopied(false), 2000)
    })
  }

  // Revoke share link
  const handleRevokeShare = async () => {
    if (!session) return
    try {
      await revokeShareLink(session.id)
      setSession((prev) => (prev ? { ...prev, is_shared: false } : null))
      setShareUrl(null)
      setShareModalOpen(false)
      window.dispatchEvent(new Event('chat:updated'))
    } catch {
      alert('Failed to revoke share link.')
    }
  }

  // Rename current chat
  const handleRename = async () => {
    if (!session || !titleInput.trim()) return
    try {
      const updated = await renameChatSession(session.id, titleInput.trim())
      setSession((prev) => (prev ? { ...prev, title: updated.title } : null))
      setEditingTitle(false)
      window.dispatchEvent(new Event('chat:updated'))
    } catch {
      alert('Failed to rename session.')
    }
  }

  // Submit message and stream response
  const handleSubmit = async (customPrompt?: string) => {
    const textToSend = (customPrompt || input).trim()
    if (!textToSend || isStreaming) return

    setInput('')
    setError(null)

    let currentSessionId = sessionId

    // Build the optimistic user message upfront so we can display it
    // immediately, even before navigate() triggers a re-render.
    const tempUserMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      session_id: currentSessionId ?? 'pending',
      role: 'user',
      content: textToSend,
      sources: null,
      created_at: new Date().toISOString(),
    }

    // If no session exists yet, create one
    if (!currentSessionId) {
      try {
        const titleGen = textToSend.length > 45 ? `${textToSend.slice(0, 45)}...` : textToSend
        const newSession = await createChatSession({
          title: titleGen,
          video_id: selectedVideo?.db_id || null,
        })
        currentSessionId = newSession.id
        tempUserMsg.session_id = newSession.id

        // Mark as freshly-created so the session-load useEffect does NOT
        // clear our optimistic messages or interrupt the ongoing stream.
        justCreatedSessionRef.current = newSession.id
        setSession({ ...newSession, messages: [] })

        // Set streaming state + optimistic message BEFORE navigate() so that
        // when React re-renders due to the URL change, isStreaming=true and
        // messages is non-empty - shows the message thread instead of the
        // empty welcome screen.
        setMessages([tempUserMsg])
        setIsStreaming(true)
        setStreamingText('')

        window.dispatchEvent(new Event('chat:updated'))
        navigate(`/chat/${newSession.id}`, { replace: true })
      } catch (err) {
        setError('Failed to initialize chat session. Please try again.')
        return
      }
    } else {
      // Existing session - append message and start streaming
      setMessages((prev) => [...prev, tempUserMsg])
      setIsStreaming(true)
      setStreamingText('')
    }

    let accumulated = ''

    await streamMessage(currentSessionId, textToSend, {
      onUser: (userEvent) => {
        // Replace temp ID with actual DB ID
        setMessages((prev) =>
          prev.map((m) => (m.id === tempUserMsg.id ? { ...m, id: userEvent.id } : m))
        )
      },
      onDelta: (token) => {
        accumulated += token
        setStreamingText(accumulated)
      },
      onDone: (doneEvent) => {
        const assistantMsg: ChatMessage = {
          id: doneEvent.id,
          session_id: currentSessionId!,
          role: 'assistant',
          content: accumulated,
          sources: doneEvent.sources,
          created_at: doneEvent.created_at,
        }
        setMessages((prev) => [...prev, assistantMsg])
        setIsStreaming(false)
        setStreamingText('')
        justCreatedSessionRef.current = null
        window.dispatchEvent(new Event('chat:updated'))
      },
      onError: (errMsg) => {
        console.error('Streaming error:', errMsg)
        setError(`Error: ${errMsg}`)
        setIsStreaming(false)
        setStreamingText('')
        justCreatedSessionRef.current = null
      },
    })
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-8rem)] w-full">
      {/* Header Bar */}
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-[#1c1c1c] pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#181818] border border-[#2a2a2a] text-white">
            <MessageSquare size={18} />
          </div>

          <div>
            {editingTitle ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && void handleRename()}
                  className="rounded bg-[#1a1a1a] border border-[#333333] px-2 py-1 text-sm font-semibold text-white focus:border-[#555555] focus:outline-none"
                  autoFocus
                />
                <button
                  onClick={() => void handleRename()}
                  className="p-1 text-emerald-400 hover:text-emerald-300"
                >
                  <Check size={14} />
                </button>
                <button
                  onClick={() => setEditingTitle(false)}
                  className="p-1 text-[#888888] hover:text-white"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-white line-clamp-1">
                  {session?.title || 'Interactive AI Research Chat'}
                </h1>
                {session && (
                  <button
                    onClick={() => {
                      setTitleInput(session.title || '')
                      setEditingTitle(true)
                    }}
                    className="text-[#666666] hover:text-white transition-colors"
                    title="Rename session"
                  >
                    <Edit2 size={12} />
                  </button>
                )}
              </div>
            )}

            <p className="text-[11px] font-semibold tracking-wider text-[#666666]">
              REAL-TIME RAG CONVERSATIONAL ENGINE
            </p>
          </div>
        </div>

        {/* Header Right: Pin, Share & New Chat */}
        <div className="flex items-center gap-2">
          {session && (
            <>
              {/* Pin Toggle */}
              <button
                onClick={handleTogglePin}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                  session.is_pinned
                    ? 'border-white/40 bg-white/10 text-white'
                    : 'border-[#2a2a2a] bg-[#121212] text-[#888888] hover:border-[#444444] hover:text-white'
                }`}
                title={session.is_pinned ? 'Unpin conversation' : 'Pin conversation to top'}
              >
                <Pin size={13} className={session.is_pinned ? 'fill-white text-white' : ''} />
                <span className="hidden sm:inline">{session.is_pinned ? 'Pinned' : 'Pin'}</span>
              </button>

              {/* Share Button */}
              <button
                onClick={handleOpenShare}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                  session.is_shared
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                    : 'border-[#2a2a2a] bg-[#121212] text-[#888888] hover:border-[#444444] hover:text-white'
                }`}
                title="Share conversation"
              >
                <Share2 size={13} />
                <span className="hidden sm:inline">Share</span>
              </button>
            </>
          )}

          <button
            onClick={handleNewChat}
            className="flex items-center gap-1.5 rounded-lg border border-[#333333] bg-[#141414] px-3.5 py-1.5 text-xs font-semibold text-white hover:border-[#666666] hover:bg-[#202020] transition-all"
          >
            <Plus size={14} />
            <span>New Chat</span>
          </button>
        </div>
      </header>

      {/* Error alert */}
      {error && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-300">
          <div className="flex items-center gap-2">
            <AlertCircle size={15} className="flex-shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="p-1 hover:text-white">
            <X size={13} />
          </button>
        </div>
      )}

      {/* Main Conversation Container */}
      <div className="flex-1 flex flex-col justify-between">
        {loadingSession ? (
          <div className="flex flex-1 items-center justify-center py-20 text-[#666666]">
            <Loader2 size={24} className="animate-spin text-white mr-2" />
            <span className="text-xs">Loading conversation...</span>
          </div>
        ) : messages.length === 0 && !isStreaming ? (
          /* Empty / Welcome State */
          <div className="flex flex-1 flex-col items-center justify-center py-10 text-center animate-fade-in">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#141414] border border-[#262626] text-white shadow-xl">
              <Sparkles size={28} />
            </div>

            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white mb-2 font-display">
              Chat with Video Intelligence
            </h2>
            <p className="max-w-md text-xs sm:text-sm text-[#888888] leading-relaxed mb-8">
              Ask deep technical questions, synthesize concepts across ingested transcripts, or verify exact timestamps with streaming AI citations.
            </p>

            {/* Prompt Starter Cards */}
            <div className="grid w-full max-w-2xl grid-cols-1 sm:grid-cols-2 gap-3 text-left mb-8">
              {STARTER_PROMPTS.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => void handleSubmit(item.prompt)}
                  className="group flex flex-col justify-between rounded-xl border border-[#222222] bg-[#0e0e0e] p-3.5 text-xs transition-all hover:border-[#444444] hover:bg-[#141414]"
                >
                  <div>
                    <div className="flex items-center justify-between font-semibold text-white mb-1">
                      <span>{item.title}</span>
                      <ArrowRight size={13} className="text-[#555555] group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                    </div>
                    <p className="text-[11px] text-[#777777] leading-relaxed">{item.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Message Thread */
          <div className="flex-1 overflow-y-auto space-y-6 pb-8">
            {messages.map((msg) => (
              <ChatMessageItem key={msg.id} message={msg} />
            ))}

            {/* In-flight streaming message */}
            {isStreaming && (
              <ChatMessageItem
                key="streaming"
                message={{
                  id: 'streaming',
                  session_id: session?.id || '',
                  role: 'assistant',
                  content: streamingText,
                  sources: null,
                  created_at: new Date().toISOString(),
                }}
                isStreaming={true}
              />
            )}

            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Input Bar with Bottom-Left Video Selector */}
        <div className="sticky bottom-0 pt-3 bg-gradient-to-t from-black via-black to-transparent">
          <ChatInput
            input={input}
            setInput={setInput}
            onSubmit={() => void handleSubmit()}
            isStreaming={isStreaming}
            disabled={loadingSession}
            videos={availableVideos}
            selectedVideo={selectedVideo}
            onSelectVideo={setSelectedVideo}
          />
        </div>
      </div>
      {/* Share Modal */}
      {shareModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-md rounded-2xl border border-[#262626] bg-[#111111] p-6 shadow-2xl space-y-4 relative">
            <button
              onClick={() => setShareModalOpen(false)}
              className="absolute right-4 top-4 text-[#888888] hover:text-white transition-colors"
            >
              <X size={16} />
            </button>

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1a1a1a] border border-[#2a2a2a] text-white">
              <Share2 size={18} />
            </div>

            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                Share Conversation
              </h3>
              <p className="mt-1 text-xs text-[#888888] leading-relaxed">
                Anyone with this public link will be able to view this conversation and fork it into their own account to continue chatting.
              </p>
            </div>

            {shareLoading ? (
              <div className="flex items-center justify-center py-6 gap-2 text-xs text-[#888888]">
                <Loader2 size={16} className="animate-spin text-white" />
                <span>Generating share link...</span>
              </div>
            ) : (
              <div className="space-y-4 pt-1">
                <div className="flex items-center gap-2 rounded-xl border border-[#262626] bg-[#0d0d0d] p-1.5 pl-3">
                  <input
                    type="text"
                    readOnly
                    value={shareUrl || ''}
                    className="flex-1 bg-transparent text-xs text-[#cccccc] font-mono select-all focus:outline-none truncate"
                  />
                  <button
                    onClick={handleCopyShareUrl}
                    className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-black hover:bg-zinc-200 transition-colors flex-shrink-0"
                  >
                    {shareCopied ? (
                      <>
                        <Check size={13} className="text-emerald-600" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={13} />
                        <span>Copy link</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[#1a1a1a] text-xs">
                  {shareUrl && (
                    <a
                      href={shareUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[#888888] hover:text-white transition-colors"
                    >
                      <span>Open link in new tab</span>
                      <ArrowUpRight size={12} />
                    </a>
                  )}

                  <button
                    onClick={handleRevokeShare}
                    className="ml-auto text-xs text-red-400 hover:text-red-300 transition-colors"
                  >
                    Revoke public link
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}




