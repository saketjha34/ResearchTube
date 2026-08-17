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

interface UserMenuProps {
  collapsed?: boolean
}

function UserMenu({ collapsed = false }: UserMenuProps) {
  const { user, logout } = useAuth()
  const [imageFailed, setImageFailed] = useState(false)

  const initials = useMemo(() => initialsFromName(user?.full_name || user?.username), [user])
  const shouldShowImage = Boolean(user?.profile_picture_url && !imageFailed)

  if (collapsed) {
    return (
      <div className="border-t border-[#181818] py-4 flex justify-center">
        <button
          onClick={() => void logout()}
          title="Logout"
          className="relative group cursor-pointer"
        >
          {shouldShowImage ? (
            <img
              src={user?.profile_picture_url ?? ''}
              alt="User profile"
              className="h-8 w-8 rounded-full border border-[#222222] object-cover group-hover:opacity-40 transition-opacity"
              referrerPolicy="no-referrer"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[#222222] bg-[#111111] text-[10px] font-bold text-white group-hover:bg-[#222222] transition-colors">
              {initials}
            </div>
          )}
          <span className="absolute left-12 top-1/2 -translate-y-1/2 bg-[#111111] border border-[#222222] text-xs text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
            Logout
          </span>
        </button>
      </div>
    )
  }

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