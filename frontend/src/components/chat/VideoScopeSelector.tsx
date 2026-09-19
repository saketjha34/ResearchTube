import { useState, useRef, useEffect } from 'react'
import { Video, Search, Check, Layers, ChevronUp, X } from 'lucide-react'
import type { AvailableVideo } from '../../api/chat'

interface VideoScopeSelectorProps {
  videos: AvailableVideo[]
  selectedVideo: AvailableVideo | null
  onSelect: (video: AvailableVideo | null) => void
  disabled?: boolean
}

export function VideoScopeSelector({
  videos,
  selectedVideo,
  onSelect,
  disabled = false,
}: VideoScopeSelectorProps) {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filteredVideos = videos.filter((v) => {
    const term = filter.toLowerCase()
    return (
      (v.title && v.title.toLowerCase().includes(term)) ||
      (v.channel && v.channel.toLowerCase().includes(term))
    )
  })

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      {/* Trigger Button (Bottom-Left Chat Box) */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-xl border border-[#2e2e2e] bg-[#161616] px-3 py-1.5 text-xs text-[#cccccc] hover:border-[#555555] hover:text-white transition-all disabled:opacity-50 select-none shadow-sm"
        title="Select transcript video scope"
      >
        {selectedVideo ? (
          <>
            <Video size={14} className="text-white flex-shrink-0" />
            <span className="max-w-[170px] sm:max-w-[240px] truncate font-medium text-white">
              {selectedVideo.title || 'Selected Video'}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onSelect(null)
              }}
              className="ml-0.5 rounded p-0.5 hover:bg-[#282828] text-[#888888] hover:text-white transition-colors"
              title="Clear selection"
            >
              <X size={12} />
            </button>
          </>
        ) : (
          <>
            <Video size={14} className="text-[#999999] flex-shrink-0" />
            <span className="text-[#aaaaaa] hover:text-white">
              Video Scope {videos.length > 0 ? `(${videos.length})` : ''}
            </span>
            <ChevronUp size={12} className="text-[#666666]" />
          </>
        )}
      </button>

      {/* Upward Dropdown Popover */}
      {open && (
        <div className="absolute left-0 bottom-full mb-2.5 z-50 w-80 sm:w-96 rounded-2xl border border-[#2a2a2a] bg-[#111111] p-3 shadow-2xl animate-fade-in text-xs">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#1e1e1e]">
            <span className="font-semibold text-white tracking-wide">Select Video Scope</span>
            <span className="text-[10px] text-[#666666]">{videos.length} videos available</span>
          </div>

          <div className="relative mb-2">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#666666]" />
            <input
              type="text"
              placeholder="Search researched videos..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full rounded-lg border border-[#222222] bg-[#0c0c0c] py-1.5 pl-8 pr-3 text-xs text-white placeholder:text-[#555555] focus:border-[#555555] focus:outline-none"
              autoFocus
            />
          </div>

          <div className="max-h-60 overflow-y-auto space-y-1 custom-scrollbar">
            {/* All Library Option */}
            <button
              type="button"
              onClick={() => {
                onSelect(null)
                setOpen(false)
              }}
              className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left transition-colors ${
                !selectedVideo ? 'bg-[#222222] text-white font-medium' : 'text-[#aaaaaa] hover:bg-[#181818] hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2">
                <Layers size={14} className="text-white flex-shrink-0" />
                <div>
                  <div className="font-medium text-white">All Library Videos</div>
                  <div className="text-[10px] text-[#666666]">Query across all ingested transcripts</div>
                </div>
              </div>
              {!selectedVideo && <Check size={14} className="text-white" />}
            </button>

            {/* Individual Researched Videos */}
            {filteredVideos.map((v) => {
              const isSelected = selectedVideo?.db_id === v.db_id
              return (
                <button
                  key={v.db_id}
                  type="button"
                  onClick={() => {
                    onSelect(v)
                    setOpen(false)
                  }}
                  className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left transition-colors ${
                    isSelected ? 'bg-[#222222] text-white font-medium' : 'text-[#aaaaaa] hover:bg-[#181818] hover:text-white'
                  }`}
                >
                  <div className="flex items-start gap-2 max-w-[85%]">
                    <Video size={14} className="mt-0.5 text-white flex-shrink-0" />
                    <div>
                      <div className="line-clamp-1 font-medium text-white">{v.title || 'Untitled Video'}</div>
                      <div className="text-[10px] text-[#666666]">{v.channel || 'YouTube'}</div>
                    </div>
                  </div>
                  {isSelected && <Check size={14} className="text-white flex-shrink-0" />}
                </button>
              )
            })}

            {filteredVideos.length === 0 && (
              <div className="py-4 text-center text-xs text-[#666666]">
                No researched videos found matching search.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
