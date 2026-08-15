import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
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
    }
  }, [])

  const register = useCallback(
    async (fullName: string, username: string, email: string, password: string) => {
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
      }
    },
    [],
  )

  const logout = useCallback(async () => {
    const refreshToken = getAuthSession()?.refresh_token

    if (refreshToken) {
      try {
        await logoutRequest(refreshToken)
      } catch {
        // Local cleanup still happens even if the API logout fails.
      }
    }

    clearAuthSession()
    setUser(null)
    setAccessToken(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      accessToken,
      loading,
      login,
      register,
      logout,
      isAuthenticated,
      getCurrentUser,
      getAccessToken,
    }),
    [user, accessToken, loading, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider.')
  }

  return context
}
