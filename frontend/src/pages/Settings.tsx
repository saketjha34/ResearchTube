import { useState, useMemo, useEffect, type FormEvent } from 'react'
import client from '../api/client'
import Button from '../components/Button'
import Input from '../components/Input'
import { detectAuthProvider, getAuthSession, persistAuthSession } from '../api/auth'
import { useAuth } from '../context/AuthContext'
import { Shield, UserCheck, AlertTriangle, KeyRound, Lock } from 'lucide-react'

const STATS_CACHE_KEY = 'rt_user_analytics_stats'

function Settings() {
  const { user, logout } = useAuth()
  const provider = useMemo(() => detectAuthProvider(user), [user])

  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [profileMessage, setProfileMessage] = useState('')

  const [passwordModalOpen, setPasswordModalOpen] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordMessage, setPasswordMessage] = useState('')

  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deleteAccountLoading, setDeleteAccountLoading] = useState(false)
  const [deleteAccountError, setDeleteAccountError] = useState('')

  useEffect(() => {
    setFullName(user?.full_name ?? '')
    setUsername(user?.username ?? '')
  }, [user])

  const handleProfileUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setProfileError('')
    setProfileMessage('')
    setProfileLoading(true)

    try {
      const response = await client.patch('/auth/me', {
        full_name: fullName,
        username,
      })

      const session = getAuthSession()
      if (session) {
        persistAuthSession({
          ...session,
          user: response.data,
        })
      }

      setProfileMessage('Profile updated successfully.')
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'response' in error) {
        const apiError = error as {
          response?: {
            data?: {
              detail?: string
            }
          }
        }
        setProfileError(apiError.response?.data?.detail || 'Unable to update profile.')
      } else {
        setProfileError('Unable to update profile.')
      }
    } finally {
      setProfileLoading(false)
    }
  }

  const handlePasswordChange = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPasswordError('')
    setPasswordMessage('')

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      setPasswordError('Please complete all password fields.')
      return
    }

    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long.')
      return
    }

    if (newPassword !== confirmNewPassword) {
      setPasswordError('New passwords do not match.')
      return
    }

    setPasswordLoading(true)

    try {
      await client.post('/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      })

      setCurrentPassword('')
      setNewPassword('')
      setConfirmNewPassword('')
      setPasswordMessage('Password updated successfully.')
      setPasswordModalOpen(false)
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'response' in error) {
        const apiError = error as {
          response?: {
            data?: {
              detail?: string
            }
          }
        }
        setPasswordError(apiError.response?.data?.detail || 'Unable to change password.')
      } else {
        setPasswordError('Unable to change password.')
      }
    } finally {
      setPasswordLoading(false)
    }
  }

  const handleDeleteAccount = async () => {
    setDeleteAccountError('')
    setDeleteAccountLoading(true)
    try {
      await client.delete('/user/account')
      localStorage.removeItem(STATS_CACHE_KEY)
      setDeleteModalOpen(false)
      await logout()
    } catch {
      setDeleteAccountError('Failed to delete account. Please try again later.')
    } finally {
      setDeleteAccountLoading(false)
    }
  }

  return (
    <section className="space-y-8 pb-12 animate-fade-in">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-[#888888]">Your account and identity details.</p>
      </header>

      {/* Identity Details Card */}
      <div className="border border-[#222222] bg-[#111111] p-6 rounded-2xl shadow-xs">
        <dl className="grid gap-6 text-sm grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          <div>
            <dt className="text-[10px] font-bold text-[#666666] uppercase tracking-wider">Full name</dt>
            <dd className="mt-1.5 text-white font-medium truncate">{user?.full_name || 'Not set'}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-bold text-[#666666] uppercase tracking-wider">Username</dt>
            <dd className="mt-1.5 text-white font-medium truncate">{user?.username || 'Not set'}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-bold text-[#666666] uppercase tracking-wider">Email</dt>
            <dd className="mt-1.5 text-white font-medium truncate">{user?.email}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-bold text-[#666666] uppercase tracking-wider">Status</dt>
            <dd className="mt-1.5 flex items-center gap-1.5 text-white font-medium">
              <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-xs"></span>
              <span>{user?.is_active ? 'Active' : 'Inactive'}</span>
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-bold text-[#666666] uppercase tracking-wider">Provider</dt>
            <dd className="mt-1.5">
              <span className="inline-block rounded-md border border-[#282828] bg-[#161616] px-2 py-0.5 text-xs text-[#cccccc] uppercase font-mono">
                {provider}
              </span>
            </dd>
          </div>
        </dl>
      </div>

      {/* Main Settings Grid */}
      <div className="grid gap-6 lg:grid-cols-2 items-start">
        {/* Update Profile Form */}
        <form className="space-y-5 border border-[#222222] bg-[#111111] p-6 rounded-2xl" onSubmit={handleProfileUpdate}>
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2 text-white">
              <UserCheck size={18} className="text-[#888888]" /> Update Profile
            </h2>
            <p className="text-xs text-[#888888] mt-1">Update your public account information.</p>
          </div>

          {profileError ? (
            <p className="border border-red-900/50 bg-red-950/20 px-3 py-2 text-xs text-red-400 rounded-lg">
              {profileError}
            </p>
          ) : null}

          {profileMessage ? (
            <p className="border border-[#333333] bg-black px-3 py-2 text-xs text-[#cccccc] rounded-lg">
              {profileMessage}
            </p>
          ) : null}

          <div className="space-y-4">
            <Input
              label="Full name"
              type="text"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Your full name"
            />

            <Input
              label="Username"
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Set a unique username"
            />
          </div>

          <div className="pt-1">
            <Button type="submit" loading={profileLoading} className="cursor-pointer">
              {profileLoading ? 'Saving profile...' : 'Save profile'}
            </Button>
          </div>
        </form>

        {/* Security / Password Card (Revamped - No awkward empty gap) */}
        <div className="space-y-5 border border-[#222222] bg-[#111111] p-6 rounded-2xl">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2 text-white">
              <Shield size={18} className="text-[#888888]" /> Security
            </h2>
            <p className="text-xs text-[#888888] mt-1">Keep your account protected.</p>

            {passwordMessage ? (
              <p className="mt-3 border border-[#333333] bg-black px-3 py-2 text-xs text-[#cccccc] rounded-lg">
                {passwordMessage}
              </p>
            ) : null}
          </div>

          {/* Password Action Box */}
          <div className="rounded-xl border border-[#222222] bg-[#161616] p-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <KeyRound size={15} className="text-[#888888]" />
                <span className="text-xs font-semibold text-white">Password</span>
              </div>
              <p className="text-xs text-[#666666] mt-1 font-mono tracking-widest">
                ••••••••••••••••
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPasswordModalOpen(true)}
              className="flex-shrink-0 rounded-lg border border-[#2e2e2e] bg-[#222222] hover:bg-[#2c2c2c] hover:border-[#444444] px-3.5 py-2 text-xs font-medium text-white transition-all cursor-pointer"
            >
              Change password
            </button>
          </div>

          {/* Security Features & Recommendations */}
          <div className="rounded-xl border border-[#1f1f1f] bg-[#141414] p-4 space-y-2.5">
            <div className="flex items-center gap-2 text-xs text-[#aaaaaa]">
              <Lock size={13} className="text-[#666666]" />
              <span className="font-medium text-[#cccccc]">Account Security Details</span>
            </div>
            <div className="grid gap-2 text-[11px] text-[#777777] pt-1">
              <div className="flex items-center justify-between">
                <span>Authentication Method</span>
                <span className="text-[#aaaaaa] font-medium capitalize">{provider} Authentication</span>
              </div>
              <div className="flex items-center justify-between border-t border-[#1c1c1c] pt-2">
                <span>Password Requirements</span>
                <span className="text-[#aaaaaa]">At least 8 characters</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="border border-red-950/40 bg-[#120a0a] p-6 rounded-2xl hover:border-red-900/60 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg text-red-500 font-semibold flex items-center gap-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            <AlertTriangle size={18} /> Danger Zone
          </h2>
          <p className="text-xs text-[#888888] mt-1">
            Permanently delete your ResearchTube account and all research history. This is irreversible.
          </p>
        </div>
        <div>
          <button
            type="button"
            className="bg-red-600 hover:bg-red-700 text-white cursor-pointer px-5 py-2 font-semibold text-xs transition-all rounded-lg whitespace-nowrap shadow-xs"
            onClick={() => setDeleteModalOpen(true)}
          >
            Delete Account
          </button>
        </div>
      </div>

      {/* Change Password Modal */}
      {passwordModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-[#242424] bg-[#111111] p-6 shadow-2xl animate-fade-in">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-white">Change password</h3>
                <p className="mt-1 text-xs text-[#888888]">Update your account security.</p>
              </div>
              <button
                type="button"
                className="cursor-pointer rounded-lg border border-[#222222] px-2 py-1 text-xs text-[#888888] hover:text-white"
                onClick={() => setPasswordModalOpen(false)}
              >
                Close
              </button>
            </div>

            <form className="space-y-4" onSubmit={handlePasswordChange}>
              {passwordError ? (
                <p className="border border-red-900/50 bg-red-950/20 px-3 py-2 text-xs text-red-400 rounded-lg">
                  {passwordError}
                </p>
              ) : null}

              <Input
                label="Current password"
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                placeholder="Enter current password"
              />

              <Input
                label="New password"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="Enter new password (at least 8 characters)"
              />

              <Input
                label="Confirm new password"
                type="password"
                value={confirmNewPassword}
                onChange={(event) => setConfirmNewPassword(event.target.value)}
                placeholder="Confirm new password"
              />

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  className="cursor-pointer rounded-lg border border-[#222222] px-4 py-2 text-xs text-[#888888] hover:text-white"
                  onClick={() => setPasswordModalOpen(false)}
                >
                  Cancel
                </button>
                <Button type="submit" variant="primary" loading={passwordLoading} className="cursor-pointer">
                  {passwordLoading ? 'Updating password...' : 'Update password'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Delete Account Modal */}
      {deleteModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-red-900/60 bg-[#111111] p-6 space-y-4 shadow-2xl animate-fade-in">
            <h3 className="text-lg font-bold text-red-500" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Delete Account?</h3>
            <p className="text-xs text-[#888888] leading-relaxed">
              Are you absolutely sure you want to delete your account? This will permanently wipe out all your saved research runs, chat sessions, and custom settings. This action cannot be undone.
            </p>
            {deleteAccountError ? (
              <p className="border border-red-900 bg-red-950/20 px-3 py-2 text-xs text-red-400 rounded-md">
                {deleteAccountError}
              </p>
            ) : null}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                className="cursor-pointer rounded-lg bg-[#222222] text-white hover:bg-[#333333] px-4 py-2 text-xs font-semibold tracking-wider uppercase transition-all"
                onClick={() => {
                  setDeleteModalOpen(false)
                  setDeleteAccountError('')
                }}
                disabled={deleteAccountLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="cursor-pointer rounded-lg bg-red-600 text-white hover:bg-red-700 px-4 py-2 text-xs font-semibold tracking-wider uppercase transition-all disabled:opacity-50"
                onClick={handleDeleteAccount}
                disabled={deleteAccountLoading}
              >
                {deleteAccountLoading ? 'Deleting...' : 'Delete permanently'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}

export default Settings
