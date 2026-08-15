import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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

      navigate('/dashboard', { replace: true })
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
      <div className="w-full max-w-md border border-[#222222] bg-[#111111] p-8">
        <h1 className="text-2xl font-semibold">Finalizing sign-in</h1>
        <p className="mt-2 text-sm text-[#999999]">
          {error || 'Please wait while we prepare your research workspace.'}
        </p>
      </div>
    </div>
  )
}

export default AuthCallback
