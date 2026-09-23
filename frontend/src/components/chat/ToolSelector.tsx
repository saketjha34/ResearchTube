import { useState, useRef, useEffect } from 'react'
import { Globe, Sparkles, ChevronUp, Layers } from 'lucide-react'

interface ToolSelectorProps {
  webSearchActive: boolean
  onToggleWebSearch: (active: boolean) => void
  disabled?: boolean
}

export function ToolSelector({
  webSearchActive,
  onToggleWebSearch,
  disabled = false,
}: ToolSelectorProps) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  return (
    <div className="relative inline-block" ref={menuRef}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-xs transition-all shadow-sm cursor-pointer select-none disabled:opacity-50 ${
          webSearchActive
            ? 'border-blue-500/40 bg-blue-950/40 text-blue-300 hover:border-blue-400 hover:bg-blue-950/60 shadow-blue-500/10'
            : 'border-[#2e2e2e] bg-[#161616] text-[#cccccc] hover:border-[#555555] hover:text-white'
        }`}
        title="Chat Tools"
      >
        {webSearchActive ? (
          <>
            <Globe size={13} className="text-blue-400 flex-shrink-0" />
            <span className="font-medium text-blue-300">Web Search</span>
            <span className="flex h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse ml-0.5" />
          </>
        ) : (
          <>
            <Sparkles size={13} className="text-[#888888] flex-shrink-0" />
            <span className="text-[#aaaaaa] hover:text-white">Tools</span>
            <ChevronUp size={12} className={`text-[#666666] transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
          </>
        )}
      </button>

      {/* Floating Dialog (Opens Upward) */}
      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-full mb-2 left-0 sm:left-auto w-64 rounded-2xl border border-[#2a2a2a] bg-[#141414]/98 backdrop-blur-xl p-1.5 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-100"
        >
          <div className="flex flex-col gap-1">
            {/* Tool 1: Web Search */}
            <button
              type="button"
              onClick={() => {
                onToggleWebSearch(!webSearchActive)
              }}
              className={`flex items-center justify-between w-full px-3 py-2.5 rounded-xl transition-all cursor-pointer select-none text-left ${
                webSearchActive
                  ? 'bg-blue-950/30 text-white hover:bg-blue-950/50'
                  : 'text-[#cccccc] hover:bg-[#202020] hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-lg border transition-colors ${
                    webSearchActive
                      ? 'border-blue-500/40 bg-blue-500/20 text-blue-400'
                      : 'border-[#333333] bg-[#222222] text-[#888888]'
                  }`}
                >
                  <Globe size={14} />
                </div>
                <span className="text-xs font-medium">Web Search</span>
              </div>

              {/* Toggle Switch */}
              <div
                className={`flex h-4 w-7 items-center rounded-full p-0.5 transition-colors ${
                  webSearchActive ? 'bg-blue-500' : 'bg-[#333333]'
                }`}
              >
                <div
                  className={`h-3 w-3 rounded-full bg-white transition-transform ${
                    webSearchActive ? 'translate-x-3' : 'translate-x-0'
                  }`}
                />
              </div>
            </button>

            {/* Tool 2: Deep Research */}
            <div className="flex items-center justify-between w-full px-3 py-2.5 rounded-xl text-[#777777] select-none opacity-60">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#282828] bg-[#1a1a1a] text-[#555555]">
                  <Layers size={14} />
                </div>
                <span className="text-xs font-medium">Deep Research</span>
              </div>
              <span className="text-[10px] text-[#666666]">Soon</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
