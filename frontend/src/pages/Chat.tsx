import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  Edit2,
  Check,
  X,
  AlertCircle,
  Loader2,
  ChevronDown,
  Archive,
  ArchiveRestore,
  Calendar,
} from 'lucide-react'
import {
  getAvailableVideos,
  getChatSession,
  createChatSession,
  renameChatSession,
  archiveChatSession,
  createShareLink,
  revokeShareLink,
  streamMessage,
  getChatGreeting,
  updateSessionScope,
  type AvailableVideo,
  type ChatMessage,
  type ChatSessionDetail,
} from '../api/chat'
import { ChatMessageItem } from '../components/chat/ChatMessageItem'
import { ChatInput } from '../components/chat/ChatInput'
import { ShareConversationModal } from '../components/chat/ShareConversationModal'



function formatChatCreationDate(dateString?: string | null): string {
  if (!dateString) return ''
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return ''
  const dateFormatted = date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  const timeFormatted = date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
  return `${dateFormatted} at ${timeFormatted}`
}

export default function Chat() {
  const { sessionId } = useParams<{ sessionId?: string }>()
  // Reset state on global 'chat:new' event
  useEffect(() => {
    const handleNew = () => {
      setSession(null)
      setMessages([])
      setInput('')
      setError(null)
      setSelectedVideo(null)
    }
    window.addEventListener('chat:new', handleNew)
    return () => window.removeEventListener('chat:new', handleNew)
  }, [])

  const navigate = useNavigate()
  const { user } = useAuth()

  const [greeting, setGreeting] = useState<string>('')

  const [availableVideos, setAvailableVideos] = useState<AvailableVideo[]>([])
  const [selectedVideo, setSelectedVideo] = useState<AvailableVideo | null>(null)
  const [session, setSession] = useState<ChatSessionDetail | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loadingSession, setLoadingSession] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Claude/ChatGPT-style personalized greeting from backend API
  const fetchGreeting = useCallback(async () => {
    try {
      const userFirst = user?.full_name?.split(' ')[0] || user?.username || undefined
      const data = await getChatGreeting(userFirst)
      if (data?.greeting) {
        setGreeting(data.greeting)
      }
    } catch (err) {
      console.debug('Failed to fetch chat greeting:', err)
    }
  }, [user])

  useEffect(() => {
    if (messages.length === 0 && !isStreaming) {
      void fetchGreeting()
    }
  }, [sessionId, messages.length, isStreaming, fetchGreeting])

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

  // User scroll position tracking (isAtBottom)
  const isAtBottomRef = useRef(true)
  const isStreamingRef = useRef(false)
  isStreamingRef.current = isStreaming
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false)

  // Token streaming animation buffer refs
  const rawStreamBufferRef = useRef('')
  const animatedTextRef = useRef('')
  const streamRafIdRef = useRef<number | null>(null)
  const isStreamActiveRef = useRef(false)
  const streamingStartTimeRef = useRef<string | null>(null)

  // Track window scroll position to determine if user is pinned near bottom
  useEffect(() => {
    const handleScroll = () => {
      const scrollBottom = window.innerHeight + window.scrollY
      const totalHeight = document.documentElement.scrollHeight
      const isNearBottom = totalHeight - scrollBottom <= 160
      isAtBottomRef.current = isNearBottom
      setShowScrollBottomBtn(!isNearBottom && (messages.length > 0 || isStreamingRef.current))
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [messages.length])

  // Scroll to bottom smoothly or instantly
  const scrollToBottom = useCallback((smooth = true) => {
    isAtBottomRef.current = true
    setShowScrollBottomBtn(false)
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: smooth ? 'smooth' : 'instant',
    })
  }, [])

  // Auto-scroll when messages change or session loads (not during token stream)
  useEffect(() => {
    if (!isStreaming) {
      scrollToBottom(false)
    }
  }, [sessionId, messages.length, isStreaming, scrollToBottom])

  // Cleanup animation frame on unmount
  useEffect(() => {
    return () => {
      if (streamRafIdRef.current) {
        cancelAnimationFrame(streamRafIdRef.current)
      }
    }
  }, [])

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



  // Toggle archive status
  const handleToggleArchive = async () => {
    if (!session) return
    try {
      const updated = await archiveChatSession(session.id)
      setSession((prev) => (prev ? { ...prev, is_archived: updated.is_archived } : null))
      window.dispatchEvent(new Event('chat:updated'))
    } catch {
      alert('Failed to update archive status.')
    }
  }

  // Open share modal & generate public link
  const handleOpenShare = useCallback(async () => {
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
  }, [session])

  useEffect(() => {
    const onOpenShare = () => {
      void handleOpenShare()
    }
    window.addEventListener('chat:open-share', onOpenShare)
    return () => window.removeEventListener('chat:open-share', onOpenShare)
  }, [handleOpenShare])

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

  // Update video scope: immediately persist to backend if session is active
  const handleSelectVideo = async (video: AvailableVideo | null) => {
    setSelectedVideo(video)
    const activeSessionId = sessionId || session?.id
    if (activeSessionId) {
      try {
        const updated = await updateSessionScope(activeSessionId, video ? video.db_id : null)
        setSession((prev) => prev ? { ...prev, video_id: updated.video_id } : null)
        window.dispatchEvent(new Event('chat:updated'))
      } catch (err) {
        console.error('Failed to update session scope:', err)
      }
    }
  }
  // Submit message and stream response
  const handleSubmit = async (customPrompt?: string) => {
    const textToSend = (customPrompt || input).trim()
    if (!textToSend || isStreaming) return

    setInput('')
    setError(null)

    if (session?.is_archived) {
      setSession((prev) => (prev ? { ...prev, is_archived: false } : null))
      window.dispatchEvent(new Event('chat:updated'))
    }

    let currentSessionId = sessionId || session?.id



    // Build the optimistic user message upfront so we can display it

    // immediately, even before navigate() triggers a re-render.

    const tempUserMsg: ChatMessage = {

      id: `temp-${Date.now()}`,

      session_id: currentSessionId ?? 'pending',

      role: 'user',

      content: textToSend,

      sources: null,

      created_at: streamingStartTimeRef.current || new Date().toISOString(),

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



        // Update the browser URL without unmounting the component or interrupting streaming
        window.history.replaceState(null, '', `/chat/${newSession.id}`)
        window.dispatchEvent(new Event('chat:updated'))

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



    // Initialize token stream buffer
    rawStreamBufferRef.current = ''
    animatedTextRef.current = ''
    isStreamActiveRef.current = true
    streamingStartTimeRef.current = new Date().toISOString()
    setIsStreaming(true)
    setStreamingText('')
    // Smooth scroll down to optimistic message
    setTimeout(() => scrollToBottom(true), 60)

    await streamMessage(currentSessionId, textToSend, {
      onUser: (userEvent) => {
        // Replace temp ID with actual DB ID
        setMessages((prev) =>
          prev.map((m) => (m.id === tempUserMsg.id ? { ...m, id: userEvent.id } : m))
        )
      },
      onDelta: (token) => {
        rawStreamBufferRef.current += token

        // Start RAF smooth token reveal loop if not active
        if (!streamRafIdRef.current) {
          const tick = () => {
            const target = rawStreamBufferRef.current
            const current = animatedTextRef.current

            if (current.length < target.length) {
              const remaining = target.length - current.length

              // Dynamic fluid pacing:
              // For small buffers, reveal 1-2 characters per frame for a gorgeous 60fps typewriter feel.
              // For bursts, scale up smoothly to prevent any lag.
              let step = 1
              if (remaining > 100) {
                step = Math.ceil(remaining / 3)
              } else if (remaining > 50) {
                step = Math.ceil(remaining / 5)
              } else if (remaining > 20) {
                step = 3
              } else if (remaining > 6) {
                step = 2
              } else {
                step = 1
              }

              const nextText = target.slice(0, current.length + step)
              animatedTextRef.current = nextText
              setStreamingText(nextText)

              // Pin to bottom with instant behavior — zero screen vibration or oscillation!
              if (isAtBottomRef.current) {
                window.scrollTo({
                  top: document.documentElement.scrollHeight,
                  behavior: 'instant',
                })
              }
            }

            if (isStreamActiveRef.current || animatedTextRef.current.length < rawStreamBufferRef.current.length) {
              streamRafIdRef.current = requestAnimationFrame(tick)
            } else {
              streamRafIdRef.current = null
            }
          }

          streamRafIdRef.current = requestAnimationFrame(tick)
        }
      },
      onDone: (doneEvent) => {
        isStreamActiveRef.current = false

        // Drain any remaining buffered tokens smoothly, then commit the message
        const finalize = () => {
          if (animatedTextRef.current.length < rawStreamBufferRef.current.length) {
            const step = Math.max(15, Math.ceil((rawStreamBufferRef.current.length - animatedTextRef.current.length) / 2))
            const nextText = rawStreamBufferRef.current.slice(0, animatedTextRef.current.length + step)
            animatedTextRef.current = nextText
            setStreamingText(nextText)
            if (isAtBottomRef.current) {
              window.scrollTo({
                top: document.documentElement.scrollHeight,
                behavior: 'instant',
              })
            }
            requestAnimationFrame(finalize)
            return
          }

          if (streamRafIdRef.current) {
            cancelAnimationFrame(streamRafIdRef.current)
            streamRafIdRef.current = null
          }

          const assistantMsg: ChatMessage = {
            id: doneEvent.id,
            session_id: currentSessionId!,
            role: 'assistant',
            content: rawStreamBufferRef.current,
            sources: doneEvent.sources,
            created_at: doneEvent.created_at,
          }
          setMessages((prev) => [...prev, assistantMsg])
          setIsStreaming(false)
          setStreamingText('')
          rawStreamBufferRef.current = ''
          animatedTextRef.current = ''
          streamingStartTimeRef.current = null
          justCreatedSessionRef.current = currentSessionId
          window.dispatchEvent(new Event('chat:updated'))
          navigate(`/chat/${currentSessionId}`, { replace: true })
        }

        requestAnimationFrame(finalize)
      },
      onError: (errMsg) => {
        isStreamActiveRef.current = false
        if (streamRafIdRef.current) {
          cancelAnimationFrame(streamRafIdRef.current)
          streamRafIdRef.current = null
        }
        console.error('Streaming error:', errMsg)
        setError(`Error: ${errMsg}`)
        setIsStreaming(false)
        setStreamingText('')
        rawStreamBufferRef.current = ''
        animatedTextRef.current = ''
        streamingStartTimeRef.current = null
        justCreatedSessionRef.current = null
      },
    }, selectedVideo ? selectedVideo.db_id : null)
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-8rem)] w-full">
      {/* Header Bar */}
      {Boolean(session?.title && session?.title !== 'Interactive AI Research Chat') && (
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-[#1c1c1c] pb-4">
          <div className="flex items-center gap-3">
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
                    {session?.title}
                  </h1>
                  <button
                    onClick={() => {
                      setTitleInput(session?.title || '')
                      setEditingTitle(true)
                    }}
                    className="text-[#666666] hover:text-white transition-colors"
                    title="Rename session"
                  >
                    <Edit2 size={12} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
      )}

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

      {/* Archived Notice Banner */}
      {session?.is_archived && (
        <div className="mb-3 flex items-center justify-between rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-300 backdrop-blur-xs">
          <div className="flex items-center gap-2">
            <Archive size={14} className="flex-shrink-0 text-amber-400" />
            <span>This conversation is archived. Sending a new message will automatically unarchive it.</span>
          </div>
          <button
            onClick={handleToggleArchive}
            className="flex items-center gap-1 font-semibold text-amber-200 hover:text-white transition-colors underline underline-offset-2 ml-3 flex-shrink-0 cursor-pointer"
          >
            <ArchiveRestore size={13} />
            <span>Unarchive</span>
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
          /* Empty / New Chat State: Chat box centered in viewport */
          <div className="flex flex-1 flex-col items-center justify-center min-h-[55vh] w-full max-w-3xl mx-auto px-2 animate-fade-in">
            {/* Claude & ChatGPT-style greeting headline — single line, elegant typography */}
            <div className="mb-6 w-full max-w-2xl text-center px-4 select-none animate-fade-in flex justify-center">
              <h1 className="text-lg sm:text-xl md:text-2xl font-medium tracking-tight text-white/90 whitespace-nowrap overflow-hidden text-ellipsis leading-normal">
                {greeting || `Hey ${user?.full_name?.split(' ')[0] || user?.username || 'there'}, what are we researching today?`}
              </h1>
            </div>

            <div className="w-full">
              <ChatInput
                input={input}
                setInput={setInput}
                onSubmit={() => void handleSubmit()}
                isStreaming={isStreaming}
                disabled={loadingSession}
                videos={availableVideos}
                selectedVideo={selectedVideo}
                onSelectVideo={handleSelectVideo}
              />
            </div>
          </div>
        ) : (
          /* Active Message Thread + Sticky Bottom Chat Box */
          <>
            <div className="flex-1 overflow-y-auto space-y-6 pb-8">
              {/* Chat Creation Date & Time Header (Marked in Green by user) */}
              {(session?.created_at || (messages.length > 0 && messages[0]?.created_at)) && (
                <div className="flex items-center justify-center pt-2 pb-1 select-none animate-fade-in">
                  <div className="inline-flex items-center gap-2 rounded-full border border-[#262626] bg-[#121212]/90 backdrop-blur-md px-4 py-1.5 text-xs text-[#8e8e8e] shadow-md hover:border-[#383838] transition-colors">
                    <Calendar size={13} className="text-[#888888]" />
                    <span className="font-medium tracking-wide">
                      Created {formatChatCreationDate(session?.created_at || messages[0]?.created_at)}
                    </span>
                  </div>
                </div>
              )}

              {messages.map((msg) => (
                <ChatMessageItem
                  key={msg.id}
                  message={msg}
                  onShare={handleOpenShare}
                />
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
                    created_at: streamingStartTimeRef.current || new Date().toISOString(),
                  }}
                  isStreaming={true}
                  onShare={handleOpenShare}
                />
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Jump to latest button when user scrolled up */}
            {showScrollBottomBtn && (
              <div className="fixed bottom-28 right-8 z-40 animate-fade-in">
                <button
                  onClick={() => scrollToBottom(true)}
                  className="flex items-center gap-1.5 rounded-full border border-[#2a2a2a] bg-[#141414]/95 backdrop-blur-md px-3.5 py-1.5 text-xs font-medium text-white shadow-2xl hover:border-[#444444] hover:bg-[#202020] transition-all duration-200 group"
                  title="Scroll to latest messages"
                >
                  <span>Jump to latest</span>
                  <ChevronDown size={14} className="text-[#888888] group-hover:text-white transition-colors" />
                </button>
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
                onSelectVideo={handleSelectVideo}
              />
            </div>
          </>
        )}
      </div>
      {/* Share Conversation Modal */}
      <ShareConversationModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        shareUrl={shareUrl}
        loading={shareLoading}
        copied={shareCopied}
        onCopy={handleCopyShareUrl}
        onRevoke={handleRevokeShare}
      />
    </div>
  )
}






