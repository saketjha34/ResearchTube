import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'
import Input from '../components/Input'
import Button from '../components/Button'
import { forgotPasswordRequest } from '../api/auth'

function ForgotPassword() {
  const [identifier, setIdentifier] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')

    const cleanIdentifier = identifier.trim()
    if (!cleanIdentifier) {
      setError('Please provide your username or email address.')
      return
    }

    setLoading(true)

    try {
      await forgotPasswordRequest(cleanIdentifier)
      setSubmitted(true)
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { detail?: string } } }
        setError(axiosErr.response?.data?.detail || 'Failed to send password reset request.')
      } else {
        setError('An unexpected error occurred. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-4 py-10 text-white">
      <div className="w-full max-w-[500px] rounded-2xl border border-[#222222] bg-[#111111] p-7 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] sm:p-8">
        <div className="mb-8 flex items-center justify-between gap-3">
          <Link
            to="/"
            className="text-left text-xs tracking-[0.35em] text-white transition-colors hover:text-[#d9d9d9]"
          >
            RESEARCHTUBE
          </Link>
          <span className="rounded-full border border-[#2b2b2b] bg-[#161616] px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] text-[#999999]">
            Account Recovery
          </span>
        </div>

        {submitted ? (
          <div className="space-y-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#2b2b2b] bg-[#161616]">
              <CheckCircle2 className="h-6 w-6 text-white" />
            </div>

            <div>
              <h1 className="text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
                Check your inbox
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-[#999999]">
                If an account matches <span className="font-medium text-white">{identifier}</span>, we have dispatched a password reset link to its registered email address.
              </p>
            </div>

            <div className="rounded-xl border border-[#222222] bg-black p-4 text-xs leading-relaxed text-[#888888]">
              The link will expire in <span className="text-[#cccccc]">15 minutes</span>. If you do not see the email, make sure to check your spam or junk folder.
            </div>

            <div className="pt-2">
              <Link to="/login">
                <Button fullWidth>Return to Sign in</Button>
              </Link>
            </div>
          </div>
        ) : (
          <div>
            <h1 className="text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
              Forgot password?
            </h1>
            <p className="mt-2 text-sm text-[#999999]">
              Enter your username or email address and we'll send you a link to reset your password.
            </p>

            {error ? (
              <p className="mt-4 border border-[#222222] bg-black px-3 py-2 text-xs text-[#cfcfcf]">
                {error}
              </p>
            ) : null}

            <form className="mt-6 space-y-4" onSubmit={onSubmit}>
              <Input
                label="Username or Email"
                type="text"
                placeholder="your_username or you@example.com"
                helperText="Enter the username or email linked to your ResearchTube workspace."
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                autoFocus
              />

              <div className="pt-2">
                <Button type="submit" fullWidth loading={loading}>
                  {loading ? 'Sending link...' : 'Send Reset Link'}
                </Button>
              </div>
            </form>

            <div className="mt-6 border-t border-[#222222] pt-4">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 text-xs font-medium text-[#888888] transition-colors hover:text-white"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Sign in
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ForgotPassword
