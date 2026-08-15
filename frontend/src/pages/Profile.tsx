import { useEffect, useMemo, useState, type FormEvent } from 'react'
import client from '../api/client'
import Button from '../components/Button'
import Input from '../components/Input'
import { detectAuthProvider, getAuthSession, persistAuthSession } from '../api/auth'
import { useAuth } from '../context/AuthContext'

function Profile() {
  const { user } = useAuth()
  const provider = useMemo(() => detectAuthProvider(user), [user])

  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')

  const [profileLoading, setProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [profileMessage, setProfileMessage] = useState('')

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')

  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordMessage, setPasswordMessage] = useState('')

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

  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold">Profile</h1>
        <p className="mt-2 text-sm text-[#999999]">Your account and identity details.</p>
      </header>

      <div className="border border-[#222222] bg-[#111111] p-6">
        <dl className="grid gap-4 text-sm md:grid-cols-2">
          <div>
            <dt className="text-[#999999]">Full name</dt>
            <dd className="mt-1 text-white">{user?.full_name || 'Not set'}</dd>
          </div>
          <div>
            <dt className="text-[#999999]">Username</dt>
            <dd className="mt-1 text-white">{user?.username || 'Not set'}</dd>
          </div>
          <div>
            <dt className="text-[#999999]">Email</dt>
            <dd className="mt-1 text-white">{user?.email}</dd>
          </div>
          <div>
            <dt className="text-[#999999]">Status</dt>
            <dd className="mt-1 text-white">{user?.is_active ? 'Active' : 'Inactive'}</dd>
          </div>
          <div>
            <dt className="text-[#999999]">Provider</dt>
            <dd className="mt-1 text-white">{provider}</dd>
          </div>
        </dl>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <form className="space-y-4 border border-[#222222] bg-[#111111] p-6" onSubmit={handleProfileUpdate}>
          <h2 className="text-xl">Update Profile</h2>
          <p className="text-sm text-[#999999]">Update your public account information.</p>

          {profileError ? (
            <p className="border border-[#222222] bg-black px-3 py-2 text-xs text-[#cfcfcf]">
              {profileError}
            </p>
          ) : null}

          {profileMessage ? (
            <p className="border border-[#222222] bg-black px-3 py-2 text-xs text-[#cfcfcf]">
              {profileMessage}
            </p>
          ) : null}

          <Input
            label="Full name"
            type="text"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
          />

          <Input
            label="Username"
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Set a unique username"
          />

          <Button type="submit" loading={profileLoading}>
            {profileLoading ? 'Saving profile...' : 'Save profile'}
          </Button>
        </form>

        <form className="space-y-4 border border-[#222222] bg-[#111111] p-6" onSubmit={handlePasswordChange}>
          <h2 className="text-xl">Change Password</h2>
          <p className="text-sm text-[#999999]">Secure your account with a new password.</p>

          {passwordError ? (
            <p className="border border-[#222222] bg-black px-3 py-2 text-xs text-[#cfcfcf]">
              {passwordError}
            </p>
          ) : null}

          {passwordMessage ? (
            <p className="border border-[#222222] bg-black px-3 py-2 text-xs text-[#cfcfcf]">
              {passwordMessage}
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
            placeholder="Enter new password"
          />

          <Input
            label="Confirm new password"
            type="password"
            value={confirmNewPassword}
            onChange={(event) => setConfirmNewPassword(event.target.value)}
            placeholder="Confirm new password"
          />

          <Button type="submit" variant="secondary" loading={passwordLoading}>
            {passwordLoading ? 'Updating password...' : 'Update password'}
          </Button>
        </form>
      </div>
    </section>
  )
}

export default Profile
