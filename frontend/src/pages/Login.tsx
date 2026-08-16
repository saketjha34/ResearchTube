import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import Input from '../components/Input'
import Button from '../components/Button'
import { startGoogleLogin } from '../api/auth'
import { useAuth } from '../context/AuthContext'

function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login, isAuthenticated } = useAuth()

  const params = useMemo(() => new URLSearchParams(location.search), [location.search])
  const redirectTo = params.get('redirect') || '/dashboard'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isAuthenticated()) {
      navigate('/dashboard', { replace: true })
    }
  }, [isAuthenticated, navigate])

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')

    if (!email || !password) {
      setError('Please provide your email and password.')
      return
    }

    setLoading(true)

    try {
      await login(email, password)
      navigate(redirectTo, { replace: true })
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : 'Invalid email or password.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-4 py-10 text-white">
      <div className="w-full max-w-[500px] rounded-2xl border border-[#222222] bg-[#111111] p-7 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] sm:p-8">
        <div className="mb-8 flex items-center justify-between gap-3">
          <Link to="/" className="text-left text-xs tracking-[0.35em] text-white transition-colors hover:text-[#d9d9d9]">
            RESEARCHTUBE
          </Link>
          <span className="rounded-full border border-[#2b2b2b] bg-[#161616] px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] text-[#999999]">
            Secure access
          </span>
        </div>

        <h1 className="text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Welcome back</h1>
        <p className="mt-2 text-sm text-[#999999]">Continue building your research workspace.</p>

        {params.get('expired') === '1' ? (
          <p className="mt-4 border border-[#222222] bg-black px-3 py-2 text-xs text-[#cfcfcf]">
            Your session has expired. Please sign in again.
          </p>
        ) : null}

        {error ? (
          <p className="mt-4 border border-[#222222] bg-black px-3 py-2 text-xs text-[#cfcfcf]">
            {error}
          </p>
        ) : null}

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <Input
            label="Email"
            type="email"
            placeholder="you@example.com"
            helperText="Use the email linked to your ResearchTube account."
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <Input
            label="Password"
            type="password"
            placeholder="••••••••"
            helperText="Use your secure password for this workspace."
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />

          <div className="pt-1">
            <Button type="submit" fullWidth loading={loading}>
              {loading ? 'Signing in...' : 'Sign in'}
            </Button>
          </div>
        </form>

        <div className="my-6 flex items-center gap-3 text-[11px] uppercase tracking-[0.22em] text-[#666666]">
          <div className="h-px flex-1 bg-[#222222]" />
          Or
          <div className="h-px flex-1 bg-[#222222]" />
        </div>

        <Button variant="secondary" fullWidth onClick={startGoogleLogin} className="cursor-pointer">
          Continue with Google
        </Button>

        <p className="mt-6 text-sm text-[#999999]">
          Don't have an account?{' '}
          <Link className="font-medium text-white transition-colors hover:text-[#cfcfcf]" to="/register">
            Create one
          </Link>
        </p>
      </div>
    </div>
  )
}

export default Login
