import client from './client'
import { getAccessToken } from './auth'
import { buildApiUrl } from './config'


// --- Types ------------------------------------------------------------------

export interface ChatGreetingResponse {
  greeting: string
  user_name: string
  sentences: string[]
}

export interface AvailableVideo {
  db_id: string
  youtube_video_id: string
  title: string | null
  channel: string | null
  url: string | null
}

export interface SourceCitation {
  chunk_id: string
  video_title: string | null
  youtube_video_id: string | null
  start_time: number | null
  end_time: number | null
  similarity: number | null
  text_snippet: string | null
}

export interface ChatMessage {
  id: string
  session_id: string
  role: 'user' | 'assistant'
  content: string
  sources: SourceCitation[] | null
  created_at: string
}

export interface ChatSession {
  id: string
  title: string | null
  video_id: string | null
  research_run_id: string | null
  is_archived: boolean
  is_pinned: boolean
  is_shared: boolean
  share_token: string | null
  shared_at: string | null
  message_count: number
  created_at: string
  updated_at: string
}

export interface ChatSessionDetail extends ChatSession {
  messages: ChatMessage[]
}

export interface ChatSessionList {
  sessions: ChatSession[]
  total: number
}

export interface CreateSessionPayload {
  title?: string
  video_id?: string | null
  research_run_id?: string | null
}

export interface ShareChatResponse {
  session_id: string
  share_token: string
  share_url: string
  is_shared: boolean
  shared_at: string | null
}

export interface PublicSharedMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources: SourceCitation[] | null
  created_at: string
}

export interface PublicSharedChat {
  id: string
  title: string | null
  share_token: string
  created_at: string
  shared_at: string | null
  video_title: string | null
  youtube_video_id: string | null
  messages: PublicSharedMessage[]
}

export interface ForkChatResponse {
  new_session_id: string
  title: string
  message_count: number
  created_at: string
}

export interface SSEDoneEvent {
  id: string
  role: 'assistant'
  sources: SourceCitation[] | null
  created_at: string
}

export interface SSEUserEvent {
  id: string
  role: 'user'
  content: string
  created_at: string
}

export interface StreamCallbacks {
  onUser?: (event: SSEUserEvent) => void
  onDelta: (text: string) => void
  onDone: (event: SSEDoneEvent) => void
  onError?: (detail: string) => void
}

// --- REST API ----------------------------------------------------------------

export async function getAvailableVideos() {
  const res = await client.get<{ videos: AvailableVideo[]; total: number }>('/chat/available-videos')
  return res.data
}

export async function createChatSession(payload: CreateSessionPayload): Promise<ChatSession> {
  const res = await client.post<ChatSession>('/chat/sessions', payload)
  return res.data
}

export async function listChatSessions(includeArchived = false): Promise<{ sessions: ChatSession[]; total: number }> {
  const res = await client.get<{ sessions: ChatSession[]; total: number }>('/chat/sessions', {
    params: { include_archived: includeArchived },
  })
  return res.data
}

export async function getChatSession(sessionId: string): Promise<ChatSessionDetail> {
  const res = await client.get<ChatSessionDetail>(`/chat/sessions/${sessionId}`)
  return res.data
}

export async function deleteChatSession(sessionId: string): Promise<void> {
  await client.delete(`/chat/sessions/${sessionId}`)
}

export async function renameChatSession(sessionId: string, title: string): Promise<ChatSession> {
  const res = await client.patch<ChatSession>(`/chat/sessions/${sessionId}/rename`, { title })
  return res.data
}

export async function archiveChatSession(sessionId: string): Promise<ChatSession> {
  const res = await client.patch<ChatSession>(`/chat/sessions/${sessionId}/archive`)
  return res.data
}

export async function togglePinSession(sessionId: string): Promise<ChatSession> {
  const res = await client.patch<ChatSession>(`/chat/sessions/${sessionId}/pin`)
  return res.data
}

export async function createShareLink(sessionId: string): Promise<ShareChatResponse> {
  const res = await client.post<ShareChatResponse>(`/chat/sessions/${sessionId}/share`)
  return res.data
}

export async function revokeShareLink(sessionId: string): Promise<ChatSession> {
  const res = await client.delete<ChatSession>(`/chat/sessions/${sessionId}/share`)
  return res.data
}

export async function getPublicSharedChat(shareToken: string): Promise<PublicSharedChat> {
  const res = await client.get<PublicSharedChat>(`/chat/share/${shareToken}`)
  return res.data
}

export async function forkSharedChat(shareToken: string): Promise<ForkChatResponse> {
  const res = await client.post<ForkChatResponse>(`/chat/share/${shareToken}/fork`)
  return res.data
}

export async function getChatGreeting(name?: string): Promise<ChatGreetingResponse> {
  const res = await client.get<ChatGreetingResponse>('/chat/greeting', {
    params: name ? { name } : undefined,
  })
  return res.data
}

export async function sendMessageNonStream(sessionId: string, message: string) {
  const res = await client.post<{ user_message: ChatMessage; assistant_message: ChatMessage }>(
    `/chat/sessions/${sessionId}/messages`,
    { message },
  )
  return res.data
}

// --- SSE Streaming -----------------------------------------------------------

export async function streamMessage(
  sessionId: string,
  message: string,
  callbacks: StreamCallbacks,
): Promise<void> {
  const token = getAccessToken()
  const url = buildApiUrl(`/chat/sessions/${sessionId}/messages/stream`)

  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ message }),
    })
  } catch (err) {
    callbacks.onError?.(`Network error: ${String(err)}`)
    return
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => '')
    callbacks.onError?.(`HTTP ${response.status}: ${errText}`)
    return
  }

  const reader = response.body?.getReader()
  if (!reader) {
    callbacks.onError?.('No response body')
    return
  }

  const decoder = new TextDecoder()
  let buffer = ''
  let currentEvent = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (line.startsWith('event: ')) {
        currentEvent = line.slice(7).trim()
      } else if (line.startsWith('data: ')) {
        const raw = line.slice(6).trim()
        try {
          const parsed = JSON.parse(raw) as Record<string, unknown>
          switch (currentEvent) {
            case 'user':
              callbacks.onUser?.(parsed as unknown as SSEUserEvent)
              break
            case 'delta':
              callbacks.onDelta((parsed as { text: string }).text ?? '')
              break
            case 'done':
              callbacks.onDone(parsed as unknown as SSEDoneEvent)
              break
            case 'error':
              callbacks.onError?.((parsed as { detail: string }).detail ?? 'Unknown error')
              break
          }
        } catch { /* skip malformed */ }
        currentEvent = ''
      }
    }
  }
}
