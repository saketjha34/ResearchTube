import React, { useRef, useEffect, useState } from 'react'
import { ArrowUp, Square } from 'lucide-react'
import { VideoScopeSelector } from './VideoScopeSelector'
import { ToolSelector } from './ToolSelector'
import type { AvailableVideo, VideoScopeMode } from '../../api/chat'

interface ChatInputProps {
  input: string
  setInput: (value: string) => void
  onSubmit: () => void
  isStreaming: boolean
  onStop?: () => void
  placeholder?: string
  disabled?: boolean
  videos: AvailableVideo[]
  scopeMode?: VideoScopeMode
  selectedVideo: AvailableVideo | null
  onSelectScope?: (mode: VideoScopeMode, video: AvailableVideo | null) => void
  onSelectVideo?: (video: AvailableVideo | null) => void
  webSearchActive?: boolean
  onToggleWebSearch?: (active: boolean) => void
}

export const ChatInput = React.memo(function ChatInput({
  input,
  setInput,
  onSubmit,
  isStreaming,
  onStop,
  placeholder = 'Ask anything about your researched videos, concepts, or code...',
  disabled = false,
  videos,
  scopeMode = 'none',
  selectedVideo,
  onSelectScope,
  onSelectVideo,
  webSearchActive = false,
  onToggleWebSearch,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [activePopup, setActivePopup] = useState<'scope' | 'tools' | null>(null)

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    const nextHeight = Math.min(Math.max(textarea.scrollHeight, 24), 180)
    textarea.style.height = `${nextHeight}px`
  }, [input])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      setActivePopup(null)
    }
    if (e.key === 'Escape' && isStreaming && onStop) {
      e.preventDefault()
      onStop()
      return
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!isStreaming && input.trim() && !disabled) {
        setActivePopup(null)
        onSubmit()
      }
    }
  }

  return (
    <div className="relative w-full rounded-2xl border border-[#2a2a2a] bg-[#111111] p-3 shadow-2xl transition-colors duration-200 focus-within:border-[#555555] focus-within:ring-1 focus-within:ring-white/10">
      <textarea
        ref={textareaRef}
        rows={1}
        value={input}
        disabled={disabled}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full resize-none bg-transparent pr-10 text-[13px] sm:text-sm leading-relaxed text-white placeholder:text-[#555555] focus:outline-none max-h-44 disabled:opacity-50"
      />

      <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#1a1a1a] mt-1.5">
        {/* Bottom Left: Video Transcript Scope Button & AI Tools */}
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
          <VideoScopeSelector
            videos={videos}
            scopeMode={scopeMode}
            selectedVideo={selectedVideo}
            onSelectScope={onSelectScope}
            onSelect={onSelectVideo}
            disabled={isStreaming || disabled}
            isOpen={activePopup === 'scope'}
            onToggleOpen={(open) => setActivePopup(open ? 'scope' : null)}
            onClose={() => setActivePopup(null)}
          />
          {onToggleWebSearch && (
            <ToolSelector
              webSearchActive={webSearchActive}
              onToggleWebSearch={onToggleWebSearch}
              disabled={isStreaming || disabled}
              isOpen={activePopup === 'tools'}
              onToggleOpen={(open) => setActivePopup(open ? 'tools' : null)}
              onClose={() => setActivePopup(null)}
            />
          )}
        </div>

        {/* Bottom Right: Shortcuts and Action */}
        <div className="flex items-center gap-2 sm:gap-2.5 flex-shrink-0 ml-auto">
          <span className="hidden sm:inline-flex items-center text-[10px] text-[#666666] whitespace-nowrap">
            <kbd className="rounded bg-[#1c1c1c] border border-[#2a2a2a] px-1 py-0.5 font-mono text-[9px] text-[#888888] mr-1">
              Enter
            </kbd>{' '}
            to send
          </span>

          {isStreaming ? (
            <button
              type="button"
              onClick={onStop}
              className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-xl bg-[#262626] text-white hover:bg-[#333333] transition-all cursor-pointer flex-shrink-0"
              title="Stop generation"
            >
              <Square size={12} fill="currentColor" />
            </button>
          ) : (
            <button
              type="button"
              disabled={!input.trim() || disabled}
              onClick={onSubmit}
              className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-xl bg-white text-black transition-all hover:bg-[#d4d4d4] disabled:opacity-20 disabled:hover:bg-white flex-shrink-0"
              title="Send message"
            >
              <ArrowUp size={15} strokeWidth={2.5} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
})
