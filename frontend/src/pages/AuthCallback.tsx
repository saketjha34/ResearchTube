import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, AlertCircle } from 'lucide-react'
import { persistAuthSession, type User } from '../api/auth'

type CallbackPayload = {
  access_token: string
  refresh_token: string
  user: User
}

const parseAuthCallback = (): CallbackPayload => {
  const source = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : window.location.search.startsWith('?')
      ? window.location.search.slice(1)
      : ''

  const params = new URLSearchParams(source)
  const accessToken = params.get('access_token')
  const refreshToken = params.get('refresh_token')
  const rawUser = params.get('user')

  if (!accessToken || !refreshToken || !rawUser) {
    throw new Error('Missing authentication details from Google callback.')
  }

  let user: User

  try {
    user = JSON.parse(rawUser) as User
  } catch {
    throw new Error('Unable to parse Google profile payload.')
  }

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    user,
  }
}

function AuthCallback() {
  const navigate = useNavigate()
  const [error, setError] = useState('')

  useEffect(() => {
    try {
      const payload = parseAuthCallback()

      persistAuthSession({
        access_token: payload.access_token,
        refresh_token: payload.refresh_token,
        user: payload.user,
      })

      setTimeout(() => {
        navigate('/research', { replace: true })
      }, 500)
    } catch (callbackError) {
      setError(
        callbackError instanceof Error
          ? callbackError.message
          : 'Google authentication failed.',
      )
    }
  }, [navigate])

  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-4 text-white">
      {error ? (
        <div className="w-full max-w-md border border-red-955 bg-[#1a0505] p-6 rounded-xl space-y-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="text-red-500 flex-shrink-0" size={20} />
            <h2 className="text-base font-bold text-red-400">Authentication Failed</h2>
          </div>
          <p className="text-xs text-red-300">{error}</p>
          <button
            onClick={() => navigate('/login')}
            className="w-full bg-white text-black font-bold py-2 rounded-lg text-xs hover:bg-zinc-200 transition-colors"
          >
            Back to Sign In
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center text-center animate-fade-in">
          <div className="relative flex items-center justify-center h-20 w-20 mb-6">
            <div className="absolute inset-0 rounded-full border border-white/10 animate-ping" />
            <div className="absolute inset-2 rounded-full border-t-2 border-r-2 border-white animate-spin [animation-duration:1s]" />
            <div className="h-10 w-10 rounded-full bg-white/10 border border-white/20 backdrop-blur-md flex items-center justify-center">
              <Sparkles size={16} className="text-amber-400 animate-pulse" />
            </div>
          </div>
          <h2 className="text-xl font-bold text-white tracking-wide" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Finalizing Google Authentication
          </h2>
          <p className="mt-2 text-xs font-semibold text-[#666666] tracking-[0.2em] uppercase">
            Preparing your ResearchTube workspace...
          </p>
        </div>
      )}
    </div>
  )
}

export default AuthCallback
