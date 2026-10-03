import axios, { type InternalAxiosRequestConfig } from 'axios'
import {
  clearAuthSession,
  getAccessToken,
  getAuthSession,
  persistAuthSession,
  refreshTokenRequest,
} from './auth'

import { apiBaseUrl, buildApiUrl } from './config'
export { apiBaseUrl, buildApiUrl }

const client = axios.create({
  baseURL: apiBaseUrl,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Attach current access token to outbound requests
client.interceptors.request.use((config) => {
  const token = getAccessToken()

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

// Concurrency-safe automatic refresh queue for multi-requests and multi-tabs
let isRefreshing = false
let failedQueue: Array<{
  resolve: (value: unknown) => void
  reject: (reason?: unknown) => void
}> = []

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve(token)
    }
  })

  failedQueue = []
}

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error?.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined

    // If 401 Unauthorized and request has not already retried
    if (error?.response?.status === 401 && originalRequest && !originalRequest._retry) {
      const session = getAuthSession()
      const refreshToken = session?.refresh_token

      // If no refresh token exists in storage, user is genuinely unauthenticated
      if (!refreshToken) {
        clearAuthSession()
        if (window.location.pathname !== '/login') {
          const redirect = encodeURIComponent(
            `${window.location.pathname}${window.location.search}`,
          )
          window.location.href = `/login?expired=1&redirect=${redirect}`
        }
        return Promise.reject(error)
      }

      if (isRefreshing) {
        // Another refresh call is in flight; queue this request until it finishes
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        })
          .then((newToken) => {
            if (newToken && originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${newToken}`
            }
            return client(originalRequest)
          })
          .catch((err) => Promise.reject(err))
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const data = await refreshTokenRequest(refreshToken)

        persistAuthSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          user: data.user,
        })

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${data.access_token}`
        }

        processQueue(null, data.access_token)
        return client(originalRequest)
      } catch (refreshErr) {
        processQueue(refreshErr, null)
        clearAuthSession()

        if (window.location.pathname !== '/login') {
          const redirect = encodeURIComponent(
            `${window.location.pathname}${window.location.search}`,
          )
          window.location.href = `/login?expired=1&redirect=${redirect}`
        }

        return Promise.reject(refreshErr)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  },
)

export default client
