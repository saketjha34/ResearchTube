import { useState } from 'react'
import client from '../api/client'
import { detectAuthProvider } from '../api/auth'
import Button from '../components/Button'
import { useAuth } from '../context/AuthContext'

function AuthTest() {
  const { user, logout } = useAuth()
  const [result, setResult] = useState<unknown>(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const testProtectedApi = async () => {
    setLoading(true)
    setMessage('')

    try {
      const response = await client.get('/test/protected')
      setResult(response.data)
      setMessage('Protected API access successful.')
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'response' in error) {
        const err = error as { response?: { status?: number } }

        if (err.response?.status === 401) {
          setMessage('Authentication failed.')
        } else {
          setMessage('Unable to connect to ResearchTube.')
        }
      } else {
        setMessage('Unable to connect to ResearchTube.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold">AUTHENTICATION STATUS</h1>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2 border border-[#222222] bg-[#111111] p-6 text-sm">
          <p>
            Authenticated <span className="text-white">✓</span>
          </p>
          <p>
            User: <span className="text-white">{user?.full_name || user?.username || 'Unknown'}</span>
          </p>
          <p>
            Email: <span className="text-white">{user?.email}</span>
          </p>
          <p>
            Provider: <span className="text-white">{detectAuthProvider(user)}</span>
          </p>
          <p>
            JWT: <span className="text-white">Active</span>
          </p>
          <p>
            Protected Route: <span className="text-white">Working</span>
          </p>

          <div className="mt-4 flex flex-wrap gap-3">
            <Button onClick={() => void testProtectedApi()} loading={loading}>
              {loading ? 'Testing connection...' : 'Test Protected API'}
            </Button>
            <Button variant="secondary" onClick={() => void logout()}>
              Logout
            </Button>
          </div>

          {message ? <p className="pt-3 text-[#cfcfcf]">{message}</p> : null}
        </div>

        <div className="border border-[#222222] bg-[#111111] p-6">
          <p className="mb-3 text-xs tracking-[0.28em] text-[#999999]">RESULT</p>
          <pre className="overflow-x-auto text-xs leading-relaxed text-[#cfcfcf]">
            {JSON.stringify(result ?? { status: 'idle', message: 'No request made yet.' }, null, 2)}
          </pre>
        </div>
      </div>
    </section>
  )
}

export default AuthTest
