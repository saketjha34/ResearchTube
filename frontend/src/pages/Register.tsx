import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Input from '../components/Input'
import Button from '../components/Button'
import { startGoogleLogin } from '../api/auth'
import { useAuth } from '../context/AuthContext'

function Register() {
  const navigate = useNavigate()
  const { register, setAuthActionLoading } = useAuth()

  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')

    if (!fullName || !username || !email || !password) {
      setError('Please fill in all required fields.')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.')
      return
    }

    setLoading(true)

    try {
      await register(fullName, username, email, password)
      navigate('/research', { replace: true })
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Unable to create your account. Please try again.',
      )
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = () => {
    setAuthActionLoading('Connecting to Google Security...')
    setTimeout(() => {
      startGoogleLogin()
    }, 200)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-4 py-10 text-white">
      <div className="w-full max-w-[500px] rounded-2xl border border-[#222222] bg-[#111111] p-7 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] sm:p-8">
        <div className="mb-8 flex items-center justify-between gap-3">
          <Link to="/" className="text-left text-xs tracking-[0.35em] text-white transition-colors hover:text-[#d9d9d9]">
            RESEARCHTUBE
          </Link>
          <span className="rounded-full border border-[#2b2b2b] bg-[#161616] px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] text-[#999999]">
            Create account
          </span>
        </div>

        <h1 className="text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Create your account</h1>
        <p className="mt-2 text-sm text-[#999999]">Start building your research workspace.</p>

        {error ? (
          <p className="mt-4 border border-[#222222] bg-black px-3 py-2 text-xs text-[#cfcfcf]">
            {error}
          </p>
        ) : null}

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <Input
            label="Full name"
            type="text"
            placeholder="Your full name"
            helperText="This is how your workspace will identify you."
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
          />
          <Input
            label="Username"
            type="text"
            placeholder="researcher_01"
            helperText="Choose a unique username for your profile."
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
          <Input
            label="Email"
            type="email"
            placeholder="you@example.com"
            helperText="Use a valid email for account recovery and updates."
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <Input
            label="Password"
            type="password"
            placeholder="At least 8 characters"
            helperText="Use 8 or more characters for better security."
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />

          <div className="pt-1">
            <Button type="submit" fullWidth loading={loading}>
              {loading ? 'Creating account...' : 'Create account'}
            </Button>
          </div>
        </form>

        <div className="my-6 flex items-center gap-3 text-[11px] uppercase tracking-[0.22em] text-[#666666]">
          <div className="h-px flex-1 bg-[#222222]" />
          Or
          <div className="h-px flex-1 bg-[#222222]" />
        </div>

        <Button variant="secondary" fullWidth onClick={handleGoogleLogin} className="cursor-pointer">
          Continue with Google
        </Button>

        <p className="mt-6 text-sm text-[#999999]">
          Already have an account?{' '}
          <Link className="font-medium text-white transition-colors hover:text-[#cfcfcf]" to="/login">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}

export default Register
