import { useState, useRef, useEffect, useCallback } from 'react'
import { Globe, Sparkles, ChevronUp, Layers } from 'lucide-react'

interface ToolSelectorProps {
  webSearchActive: boolean
  onToggleWebSearch: (active: boolean) => void
  disabled?: boolean
  isOpen?: boolean
  onToggleOpen?: (open: boolean) => void
  onClose?: () => void
}

export function ToolSelector({
  webSearchActive,
  onToggleWebSearch,
  disabled = false,
  isOpen: controlledOpen,
  onToggleOpen,
  onClose,
}: ToolSelectorProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : internalOpen

  const menuRef = useRef<HTMLDivElement>(null)

  const handleToggle = () => {
    const next = !open
    if (onToggleOpen) {
      onToggleOpen(next)
    } else {
      setInternalOpen(next)
    }
  }

  const handleClose = useCallback(() => {
    if (onToggleOpen) {
      onToggleOpen(false)
    } else {
      setInternalOpen(false)
    }
    onClose?.()
  }, [onToggleOpen, onClose])

  useEffect(() => {
    if (!open) return

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        handleClose()
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, handleClose])

  return (
    <div className="relative inline-block flex-shrink-0" ref={menuRef}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={handleToggle}
        className={`flex items-center gap-1.5 rounded-xl border px-2 py-0.5 sm:px-2.5 sm:py-1 text-[11px] transition-all shadow-sm cursor-pointer select-none disabled:opacity-50 whitespace-nowrap flex-shrink-0 ${
          webSearchActive
            ? 'border-blue-500/40 bg-blue-950/40 text-blue-300 hover:border-blue-400 hover:bg-blue-950/60 shadow-blue-500/10'
            : 'border-[#2e2e2e] bg-[#161616] text-[#cccccc] hover:border-[#555555] hover:text-white'
        }`}
        title="Chat Tools"
      >
        {webSearchActive ? (
          <>
            <Globe size={12} className="text-blue-400 flex-shrink-0" />
            <span className="font-medium text-[11px] text-blue-300 whitespace-nowrap">Web Search</span>
            <span className="flex h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse ml-0.5 flex-shrink-0" />
          </>
        ) : (
          <>
            <Sparkles size={12} className="text-[#888888] flex-shrink-0" />
            <span className="text-[#aaaaaa] hover:text-white font-medium text-[11px] whitespace-nowrap">Tools</span>
            <ChevronUp size={11} className={`text-[#666666] transition-transform duration-200 flex-shrink-0 ${open ? 'rotate-180' : ''}`} />
          </>
        )}
      </button>

      {/* Floating Dialog (Centered on mobile, centered directly above trigger on desktop) */}
      {open && (
        <div
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          className="fixed left-1/2 -translate-x-1/2 bottom-[82px] w-[calc(100vw-2.5rem)] max-w-xs sm:max-w-none sm:absolute sm:bottom-full sm:mb-2.5 sm:left-1/2 sm:-translate-x-1/2 sm:right-auto sm:w-64 rounded-2xl border border-[#2a2a2a] bg-[#141414]/98 backdrop-blur-xl p-2 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="flex flex-col gap-1">
            {/* Tool 1: Web Search */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
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
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-white">Web Search</span>
                  <span className="text-[10px] text-[#777777]">Live web content and figures</span>
                </div>
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
            <div className="flex items-center justify-between w-full px-3 py-2.5 rounded-xl text-[#777777] select-none opacity-50">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#282828] bg-[#1a1a1a] text-[#555555]">
                  <Layers size={14} />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-medium">Deep Research</span>
                  <span className="text-[10px] text-[#555555]">Multi-source deep reasoning</span>
                </div>
              </div>
              <span className="text-[10px] text-[#666666] bg-[#1c1c1c] px-1.5 py-0.5 rounded border border-[#2a2a2a]">Soon</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
