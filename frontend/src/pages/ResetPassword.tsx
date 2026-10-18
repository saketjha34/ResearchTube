import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AlertCircle, ArrowLeft, Loader2 } from 'lucide-react'
import Input from '../components/Input'
import Button from '../components/Button'
import { resetPasswordRequest, verifyResetTokenRequest } from '../api/auth'

function ResetPassword() {
  const navigate = useNavigate()
  const location = useLocation()

  const queryParams = new URLSearchParams(location.search)
  const token = queryParams.get('token') || ''

  const [verifying, setVerifying] = useState(true)
  const [tokenValid, setTokenValid] = useState(false)
  const [maskedEmail, setMaskedEmail] = useState<string | null>(null)
  const [tokenError, setTokenError] = useState('')

  const [identifier, setIdentifier] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Verify token validity on page mount
  useEffect(() => {
    if (!token) {
      setVerifying(false)
      setTokenValid(false)
      setTokenError('Missing password reset token. Please request a new link.')
      return
    }

    let isMounted = true

    const verify = async () => {
      try {
        const result = await verifyResetTokenRequest(token)
        if (isMounted) {
          setTokenValid(result.valid)
          setMaskedEmail(result.email_masked || null)
        }
      } catch (err: unknown) {
        if (isMounted) {
          setTokenValid(false)
          if (err && typeof err === 'object' && 'response' in err) {
            const axiosErr = err as { response?: { data?: { detail?: string } } }
            setTokenError(
              axiosErr.response?.data?.detail || 'This reset link is invalid or has expired.',
            )
          } else {
            setTokenError('This reset link is invalid or has expired.')
          }
        }
      } finally {
        if (isMounted) {
          setVerifying(false)
        }
      }
    }

    verify()

    return () => {
      isMounted = false
    }
  }, [token])

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')

    const cleanIdentifier = identifier.trim()
    if (!cleanIdentifier) {
      setError('Please provide your username or email address to confirm your identity.')
      return
    }

    if (!newPassword || !confirmPassword) {
      setError('Please fill in all password fields.')
      return
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long.')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)

    try {
      await resetPasswordRequest({
        token,
        identifier: cleanIdentifier,
        new_password: newPassword,
        confirm_password: confirmPassword,
      })

      // User requested: taken directly to the login page
      navigate('/login', {
        state: { resetSuccess: true },
        replace: true,
      })
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { detail?: string } } }
        setError(axiosErr.response?.data?.detail || 'Failed to update password. Please try again.')
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
            Security
          </span>
        </div>

        {verifying ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-[#666666]" />
            <p className="mt-4 text-sm text-[#888888]">Verifying reset token security...</p>
          </div>
        ) : !tokenValid ? (
          <div className="space-y-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#331111] bg-[#1a0a0a]">
              <AlertCircle className="h-6 w-6 text-[#ef4444]" />
            </div>

            <div>
              <h1 className="text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
                Link expired or invalid
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-[#999999]">
                {tokenError || 'This password reset link is invalid or has already expired.'}
              </p>
            </div>

            <div className="pt-2">
              <Link to="/forgot-password">
                <Button fullWidth>Request a New Link</Button>
              </Link>
            </div>

            <div className="border-t border-[#222222] pt-4">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 text-xs font-medium text-[#888888] transition-colors hover:text-white"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Return to Sign in
              </Link>
            </div>
          </div>
        ) : (
          <div>
            <h1 className="text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
              Choose new password
            </h1>
            <p className="mt-2 text-sm text-[#999999]">
              Confirm your account identity and choose a strong password for your workspace.
            </p>

            {maskedEmail ? (
              <div className="mt-4 rounded-xl border border-[#222222] bg-black px-3.5 py-2.5 text-xs text-[#888888]">
                Resetting credentials for account linked to{' '}
                <span className="font-medium text-white">{maskedEmail}</span>
              </div>
            ) : null}

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
                helperText="Enter the username or email linked to this account to verify ownership."
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                autoFocus
              />

              <Input
                label="New Password"
                type="password"
                placeholder="••••••••"
                helperText="Minimum 8 characters."
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />

              <Input
                label="Confirm Password"
                type="password"
                placeholder="••••••••"
                helperText="Re-enter your new password."
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />

              <div className="pt-2">
                <Button type="submit" fullWidth loading={loading}>
                  {loading ? 'Updating password...' : 'Apply Forgot Password'}
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

export default ResetPassword
