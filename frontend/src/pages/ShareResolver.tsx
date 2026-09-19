import { useParams, Navigate } from 'react-router-dom'
import { SharedReport } from './SharedReport'
import SharedChat from './SharedChat'

// UUID regex matches standard 36-character UUIDs (used by research runs)
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default function ShareResolver() {
  const { id, runId, shareToken } = useParams<{ id?: string; runId?: string; shareToken?: string }>()
  const token = id || runId || shareToken

  if (!token) {
    return <Navigate to="/" replace />
  }

  // If it matches a UUID format, it is a Research Report run ID
  if (UUID_REGEX.test(token)) {
    return <SharedReport />
  }

  // Otherwise (e.g. 22-character urlsafe token), it is a Chat share
  return <SharedChat />
}
