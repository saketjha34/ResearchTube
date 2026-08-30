import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { Sparkles } from 'lucide-react'
import {
  clearAuthSession,
  getAccessToken,
  getAuthSession,
  getCurrentUser,
  isAuthenticated,
  loginRequest,
  logoutRequest,
  persistAuthSession,
  registerRequest,
  type User,
} from '../api/auth'

type AuthContextValue = {
  user: User | null
  accessToken: string | null
  loading: boolean
  authActionLoading: string | null
  setAuthActionLoading: (msg: string | null) => void
  login: (email: string, password: string) => Promise<void>
  register: (fullName: string, username: string, email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  isAuthenticated: () => boolean
  getCurrentUser: () => User | null
  getAccessToken: () => string | null
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

const getFriendlyAuthError = (error: unknown): string => {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const maybeError = error as {
      response?: {
        status?: number
        data?: {
          detail?: string
        }
      }
    }

    if (maybeError.response?.status === 401) {
      return 'Invalid email or password.'
    }

    if (maybeError.response?.data?.detail) {
      return maybeError.response.data.detail
    }

    if (maybeError.response?.status === 0) {
      return 'Unable to connect to ResearchTube.'
    }
  }

  return 'Unable to connect to ResearchTube.'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [authActionLoading, setAuthActionLoading] = useState<string | null>(null)

  useEffect(() => {
    const session = getAuthSession()

    if (session) {
      setUser(session.user)
      setAccessToken(session.access_token)
    }

    setLoading(false)

    const syncFromStorage = () => {
      const next = getAuthSession()
      setUser(next?.user ?? null)
      setAccessToken(next?.access_token ?? null)
    }

    window.addEventListener('storage', syncFromStorage)
    window.addEventListener('auth:changed', syncFromStorage)

    return () => {
      window.removeEventListener('storage', syncFromStorage)
      window.removeEventListener('auth:changed', syncFromStorage)
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    setAuthActionLoading('Signing into ResearchTube...')
    try {
      const data = await loginRequest({ email, password })

      persistAuthSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        user: data.user,
      })

      setUser(data.user)
      setAccessToken(data.access_token)
    } catch (error) {
      throw new Error(getFriendlyAuthError(error))
    } finally {
      setTimeout(() => {
        setAuthActionLoading(null)
      }, 300)
    }
  }, [])

  const register = useCallback(
    async (fullName: string, username: string, email: string, password: string) => {
      setAuthActionLoading('Creating your ResearchTube account...')
      try {
        const data = await registerRequest({
          full_name: fullName,
          username,
          email,
          password,
        })

        persistAuthSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          user: data.user,
        })

        setUser(data.user)
        setAccessToken(data.access_token)
      } catch (error) {
        throw new Error(getFriendlyAuthError(error))
      } finally {
        setTimeout(() => {
          setAuthActionLoading(null)
        }, 300)
      }
    },
    [],
  )

  const logout = useCallback(async () => {
    setAuthActionLoading('Signing out of ResearchTube...')
    const refreshToken = getAuthSession()?.refresh_token

    try {
      if (refreshToken) {
        await logoutRequest(refreshToken)
      }
    } catch {
      // Local cleanup still happens even if the API logout fails.
    } finally {
      clearAuthSession()
      setUser(null)
      setAccessToken(null)
      setTimeout(() => {
        setAuthActionLoading(null)
      }, 300)
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      accessToken,
      loading,
      authActionLoading,
      setAuthActionLoading,
      login,
      register,
      logout,
      isAuthenticated,
      getCurrentUser,
      getAccessToken,
    }),
    [user, accessToken, loading, authActionLoading, login, register, logout],
  )

  return (
    <AuthContext.Provider value={value}>
      {children}

      {/* Global Full-Screen Auth Loading Overlay */}
      {authActionLoading && (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/90 backdrop-blur-md animate-fade-in text-white">
          <div className="relative flex items-center justify-center h-20 w-20 mb-6">
            <div className="absolute inset-0 rounded-full border border-white/10 animate-ping" />
            <div className="absolute inset-2 rounded-full border-t-2 border-r-2 border-white animate-spin [animation-duration:1s]" />
            <div className="h-10 w-10 rounded-full bg-white/10 border border-white/20 backdrop-blur-md flex items-center justify-center">
              <Sparkles size={16} className="text-amber-400 animate-pulse" />
            </div>
          </div>
          <h3 className="text-lg font-bold text-white tracking-wide" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            {authActionLoading}
          </h3>
          <p className="mt-2 text-xs font-semibold text-[#666666] tracking-[0.2em] uppercase">
            ResearchTube Security Engine
          </p>
        </div>
      )}
    </AuthContext.Provider>
  )
}

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider.')
  }

  return context
}
