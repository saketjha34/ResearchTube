import axios from 'axios'
import { clearAuthSession, getAccessToken } from './auth'

const client = axios.create({
  baseURL: import.meta.env.MODE === 'production' ? import.meta.env.VITE_API_URL_PROD : import.meta.env.VITE_API_URL_DEV,
  headers: {
    'Content-Type': 'application/json',
  },
})

client.interceptors.request.use((config) => {
  const token = getAccessToken()

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      clearAuthSession()

      if (window.location.pathname !== '/login') {
        const redirect = encodeURIComponent(
          `${window.location.pathname}${window.location.search}`,
        )
        window.location.href = `/login?expired=1&redirect=${redirect}`
      }
    }

    return Promise.reject(error)
  },
)

export default client
