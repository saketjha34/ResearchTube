import { useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import Button from './Button'

const initialsFromName = (name?: string | null) => {
  if (!name) {
    return 'RT'
  }

  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

function UserMenu() {
  const { user, logout } = useAuth()
  const [imageFailed, setImageFailed] = useState(false)

  const initials = useMemo(() => initialsFromName(user?.full_name || user?.username), [user])
  const shouldShowImage = Boolean(user?.profile_picture_url && !imageFailed)

  return (
    <div className="border-t border-[#181818] px-4 py-4">
      <div className="mb-3 flex items-center gap-3">
        {shouldShowImage ? (
          <img
            src={user?.profile_picture_url ?? ''}
            alt="User profile"
            className="h-10 w-10 rounded-full border border-[#222222] object-cover"
            referrerPolicy="no-referrer"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#222222] bg-[#111111] text-xs text-white">
            {initials}
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm text-white">{user?.full_name || user?.username || 'Research User'}</p>
          <p className="truncate text-xs text-[#999999]">{user?.email}</p>
        </div>
      </div>

      <Button variant="secondary" fullWidth onClick={() => void logout()}>
        Logout
      </Button>
    </div>
  )
}

export default UserMenu
