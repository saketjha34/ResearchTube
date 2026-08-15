import axios from 'axios'

export type User = {
  id: string
  email: string
  username: string | null
  full_name: string | null
  profile_picture_url: string | null
  is_active: boolean
  is_verified: boolean
}

export type AuthResponse = {
  access_token: string
  refresh_token: string
  token_type: string
  user: User
}

type RegisterPayload = {
  full_name: string
  username: string
  email: string
  password: string
}

type LoginPayload = {
  email: string
  password: string
}

export type AuthSession = {
  access_token: string
  refresh_token: string
  user: User
}

const authClient = axios.create({
  baseURL: 'http://localhost:8000',
  headers: {
    'Content-Type': 'application/json',
  },
})

const AUTH_STORAGE_KEY = 'researchtube_auth'

export const getAuthSession = (): AuthSession | null => {
  const raw = localStorage.getItem(AUTH_STORAGE_KEY)

  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw) as AuthSession
  } catch {
    localStorage.removeItem(AUTH_STORAGE_KEY)
    return null
  }
}

export const persistAuthSession = (session: AuthSession): void => {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session))
  window.dispatchEvent(new Event('auth:changed'))
}

export const clearAuthSession = (): void => {
  localStorage.removeItem(AUTH_STORAGE_KEY)
  window.dispatchEvent(new Event('auth:changed'))
}

export const getAccessToken = (): string | null => {
  return getAuthSession()?.access_token ?? null
}

export const getCurrentUser = (): User | null => {
  return getAuthSession()?.user ?? null
}

export const isAuthenticated = (): boolean => {
  const session = getAuthSession()
  return Boolean(session?.access_token && session?.user)
}

export const detectAuthProvider = (user: User | null): string => {
  if (!user) {
    return 'Unknown'
  }

  if (user.profile_picture_url) {
    return 'Google'
  }

  return 'Local'
}

export const loginRequest = async (payload: LoginPayload): Promise<AuthResponse> => {
  const form = new URLSearchParams()
  form.append('username', payload.email)
  form.append('password', payload.password)

  const response = await authClient.post<AuthResponse>('/auth/login', form, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  })

  return response.data
}

export const registerRequest = async (payload: RegisterPayload): Promise<AuthResponse> => {
  const response = await authClient.post<AuthResponse>('/auth/register', payload)
  return response.data
}

export const logoutRequest = async (refreshToken: string): Promise<void> => {
  await authClient.post('/auth/logout', { refresh_token: refreshToken })
}

export const startGoogleLogin = (): void => {
  window.location.href = 'http://localhost:8000/auth/google'
}
