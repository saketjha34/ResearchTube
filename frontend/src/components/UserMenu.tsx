import { useMemo, useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { 
  User as UserIcon, 
  Settings as SettingsIcon, 
  LogOut, 
  ChevronRight,
  MoreVertical
} from 'lucide-react'

const initialsFromName = (name?: string | null) => {
  if (!name) return 'RT'
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
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)
  const [imageFailed, setImageFailed] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const initials = useMemo(() => initialsFromName(user?.full_name || user?.username), [user])
  const shouldShowImage = Boolean(user?.profile_picture_url && !imageFailed)

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleKeyDown)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const handleNavigate = (path: string) => {
    setIsOpen(false)
    navigate(path)
  }

  const handleLogout = async () => {
    setIsOpen(false)
    await logout()
  }

  return (
    <div ref={menuRef} className="relative w-full">
      {/* Popover Menu Dialog (matching Image 1) */}
      {isOpen && (
        <div
          className={`absolute z-50 rounded-2xl border border-[#2e2e2e] bg-[#212121] p-1.5 shadow-2xl animate-fade-in text-white backdrop-blur-md select-none ${
            collapsed 
              ? 'left-14 bottom-0 w-64' 
              : 'bottom-full mb-2 left-0 right-0 w-full'
          }`}
          style={{ minWidth: '240px' }}
        >
          {/* Top User Card Header */}
          <button
            type="button"
            onClick={() => handleNavigate('/profile')}
            className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-[#2c2c2c] transition-colors cursor-pointer text-left group"
          >
            <div className="flex items-center gap-3 min-w-0">
              {shouldShowImage ? (
                <img
                  src={user?.profile_picture_url ?? ''}
                  alt="User"
                  className="h-9 w-9 rounded-full border border-[#3a3a3a] object-cover flex-shrink-0"
                  referrerPolicy="no-referrer"
                  onError={() => setImageFailed(true)}
                />
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#3a3a3a] bg-[#333333] text-xs font-bold text-white flex-shrink-0">
                  {initials}
                </div>
              )}
              <div className="min-w-0 pr-1">
                <p className="truncate text-sm font-semibold text-white group-hover:text-white">
                  {user?.full_name || user?.username || 'User'}
                </p>
                <p className="truncate text-xs text-[#999999]">
                  {user?.username ? `@${user.username}` : user?.email || 'Account'}
                </p>
              </div>
            </div>
            <ChevronRight size={16} className="text-[#777777] group-hover:text-white group-hover:translate-x-0.5 transition-all flex-shrink-0" />
          </button>

          {/* Divider */}
          <div className="my-1 border-t border-[#2e2e2e]" />

          {/* Profile Action */}
          <button
            type="button"
            onClick={() => handleNavigate('/profile')}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-[#cccccc] hover:bg-[#2c2c2c] hover:text-white transition-colors cursor-pointer"
          >
            <UserIcon size={16} className="text-[#999999]" />
            <span>Profile</span>
          </button>

          {/* Settings Action */}
          <button
            type="button"
            onClick={() => handleNavigate('/settings')}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-[#cccccc] hover:bg-[#2c2c2c] hover:text-white transition-colors cursor-pointer"
          >
            <SettingsIcon size={16} className="text-[#999999]" />
            <span>Settings</span>
          </button>

          {/* Divider */}
          <div className="my-1 border-t border-[#2e2e2e]" />

          {/* Log Out Action */}
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-[#cccccc] hover:bg-[#2c2c2c] hover:text-white transition-colors cursor-pointer"
          >
            <LogOut size={16} className="text-[#999999]" />
            <span>Log out</span>
          </button>
        </div>
      )}

      {/* Trigger Card (Collapsed vs Expanded) */}
      {collapsed ? (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            title={user?.full_name || user?.username || 'Account'}
            className="relative cursor-pointer rounded-full p-0.5 hover:ring-2 hover:ring-[#444444] transition-all"
          >
            {shouldShowImage ? (
              <img
                src={user?.profile_picture_url ?? ''}
                alt="User profile"
                className="h-8 w-8 rounded-full border border-[#222222] object-cover"
                referrerPolicy="no-referrer"
                onError={() => setImageFailed(true)}
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[#222222] bg-[#1a1a1a] text-[10px] font-bold text-white">
                {initials}
              </div>
            )}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full flex items-center justify-between p-2 rounded-xl transition-all cursor-pointer text-left ${
            isOpen ? 'bg-[#1e1e1e]' : 'hover:bg-[#151515]'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            {shouldShowImage ? (
              <img
                src={user?.profile_picture_url ?? ''}
                alt="User profile"
                className="h-9 w-9 rounded-full border border-[#282828] object-cover flex-shrink-0"
                referrerPolicy="no-referrer"
                onError={() => setImageFailed(true)}
              />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#282828] bg-[#1a1a1a] text-xs font-bold text-white flex-shrink-0">
                {initials}
              </div>
            )}
            <div className="min-w-0 pr-1">
              <p className="truncate text-sm font-medium text-white">
                {user?.full_name || user?.username || 'Research User'}
              </p>
              <p className="truncate text-xs text-[#777777]">
                {user?.username ? `@${user.username}` : user?.email || 'Account'}
              </p>
            </div>
          </div>

          <MoreVertical size={16} className="text-[#555555] flex-shrink-0 hover:text-white transition-colors" />
        </button>
      )}
    </div>
  )
}

export default UserMenu
