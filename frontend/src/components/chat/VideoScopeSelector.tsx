import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Video, Search, Check, Layers, ChevronUp, X, MoreVertical } from 'lucide-react'
import type { AvailableVideo } from '../../api/chat'
import { VideoScopePreviewCard } from './VideoScopePreviewCard'

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
  const [hoveredVideo, setHoveredVideo] = useState<AvailableVideo | null>(null)
  const [showSelectedPreview, setShowSelectedPreview] = useState(false)
  const [previewSide, setPreviewSide] = useState<'right' | 'left'>('right')
  const [inspectedVideo, setInspectedVideo] = useState<AvailableVideo | null>(null)
  const [isDesktop, setIsDesktop] = useState(
    typeof window !== 'undefined' ? window.innerWidth >= 768 : true
  )

  const dropdownRef = useRef<HTMLDivElement>(null)
  const hoverTimeoutRef = useRef<any>(null)
  const triggerHoverTimeoutRef = useRef<any>(null)

  // Determine if preview should dock to left or right based on screen edge
  const updatePreviewPosition = useCallback(() => {
    if (!dropdownRef.current) return
    const rect = dropdownRef.current.getBoundingClientRect()
    const spaceOnRight = window.innerWidth - rect.right
    if (spaceOnRight < 370) {
      setPreviewSide('left')
    } else {
      setPreviewSide('right')
    }
  }, [])

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 768)
      updatePreviewPosition()
    }
    updatePreviewPosition()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [updatePreviewPosition])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
        setHoveredVideo(null)
        setInspectedVideo(null)
        setShowSelectedPreview(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleMouseEnterVideo = (v: AvailableVideo) => {
    if (!isDesktop) return
    clearTimeout(hoverTimeoutRef.current)
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredVideo(v)
    }, 100)
  }

  const handleMouseLeaveVideo = () => {
    if (!isDesktop) return
    clearTimeout(hoverTimeoutRef.current)
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredVideo(null)
    }, 200)
  }

  const handleTriggerMouseEnter = () => {
    if (open || !selectedVideo || !isDesktop) return
    clearTimeout(triggerHoverTimeoutRef.current)
    triggerHoverTimeoutRef.current = setTimeout(() => {
      setShowSelectedPreview(true)
    }, 250)
  }

  const handleTriggerMouseLeave = () => {
    clearTimeout(triggerHoverTimeoutRef.current)
    triggerHoverTimeoutRef.current = setTimeout(() => {
      setShowSelectedPreview(false)
    }, 200)
  }

  const handleThreeDotsClick = (e: React.MouseEvent, v: AvailableVideo) => {
    e.stopPropagation()
    if (isDesktop) {
      // On desktop: dock right beside the menu as the floating preview card!
      setHoveredVideo(v)
      setInspectedVideo(v)
    } else {
      // On mobile / tablet: open full-viewport modal via Portal
      setInspectedVideo(v)
    }
  }

  const filteredVideos = videos.filter((v) => {
    const term = filter.toLowerCase()
    return (
      (v.title && v.title.toLowerCase().includes(term)) ||
      (v.channel && v.channel.toLowerCase().includes(term))
    )
  })

  // The active floating video displayed beside the dropdown menu on desktop
  const activeFloatingVideo = isDesktop ? (inspectedVideo || hoveredVideo) : null

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      {/* Trigger Button (Bottom-Left Chat Box) */}
      <div
        onMouseEnter={handleTriggerMouseEnter}
        onMouseLeave={handleTriggerMouseLeave}
        className="relative"
      >
        <div className="flex items-center gap-1 rounded-xl border border-[#2e2e2e] bg-[#161616] px-2.5 py-1 text-xs text-[#cccccc] hover:border-[#555555] hover:text-white transition-all shadow-sm">
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              setOpen(!open)
              setShowSelectedPreview(false)
              setInspectedVideo(null)
              setHoveredVideo(null)
            }}
            className="flex items-center gap-2 text-left disabled:opacity-50 select-none cursor-pointer py-0.5"
            title="Select transcript video scope or tap 3-dots to view YouTube stats"
          >
            {selectedVideo ? (
              <>
                <Video size={14} className="text-white flex-shrink-0" />
                <span className="max-w-[130px] sm:max-w-[220px] truncate font-medium text-white">
                  {selectedVideo.title || 'Selected Video'}
                </span>
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

          {selectedVideo && (
            <div className="flex items-center gap-0.5 border-l border-[#2e2e2e] pl-1.5 ml-1">
              {/* 3-dot button to inspect selected video */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  if (isDesktop) {
                    setShowSelectedPreview((prev) => !prev)
                  } else {
                    setInspectedVideo(selectedVideo)
                  }
                }}
                className="rounded p-1 hover:bg-[#282828] text-[#888888] hover:text-white transition-colors cursor-pointer"
                title="View video details & YouTube stats"
                aria-label="View video stats"
              >
                <MoreVertical size={13} />
              </button>
              {/* Clear selection button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onSelect(null)
                  setShowSelectedPreview(false)
                }}
                className="rounded p-1 hover:bg-[#282828] text-[#888888] hover:text-white transition-colors cursor-pointer"
                title="Clear selection"
                aria-label="Clear selection"
              >
                <X size={12} />
              </button>
            </div>
          )}
        </div>

        {/* Floating Card for the currently selected video when dropdown is closed (desktop) */}
        {showSelectedPreview && !open && selectedVideo && isDesktop && (
          <div
            className="absolute left-0 bottom-full mb-3 z-[110] animate-fade-in"
            onMouseEnter={() => clearTimeout(triggerHoverTimeoutRef.current)}
            onMouseLeave={handleTriggerMouseLeave}
          >
            <VideoScopePreviewCard
              video={selectedVideo}
              isSelected={true}
              onClose={() => setShowSelectedPreview(false)}
            />
          </div>
        )}
      </div>

      {/* Upward Dropdown Popover */}
      {open && (
        <div className="absolute left-0 bottom-full mb-2.5 z-50 w-[calc(100vw-2rem)] sm:w-96 max-w-sm rounded-2xl border border-[#2a2a2a] bg-[#111111] p-3 shadow-2xl animate-fade-in text-xs">
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

          <div className="max-h-64 overflow-y-auto space-y-1 custom-scrollbar">
            {/* All Library Option */}
            <button
              type="button"
              onClick={() => {
                onSelect(null)
                setOpen(false)
                setHoveredVideo(null)
                setInspectedVideo(null)
              }}
              onMouseEnter={() => {
                if (isDesktop && !inspectedVideo) setHoveredVideo(null)
              }}
              className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left transition-colors cursor-pointer ${
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
              const isCurrentlyInspected = activeFloatingVideo?.db_id === v.db_id

              return (
                <div
                  key={v.db_id}
                  onMouseEnter={() => handleMouseEnterVideo(v)}
                  onMouseLeave={handleMouseLeaveVideo}
                  className={`group flex items-center justify-between rounded-lg pr-1.5 transition-all ${
                    isSelected ? 'bg-[#222222]' : isCurrentlyInspected ? 'bg-[#1c1c1c]' : 'hover:bg-[#181818]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(v)
                      setOpen(false)
                      setHoveredVideo(null)
                      setInspectedVideo(null)
                    }}
                    className="flex flex-1 items-start gap-2.5 px-2.5 py-2 text-left transition-all cursor-pointer min-w-0"
                  >
                    {v.thumbnail_url ? (
                      <img
                        src={v.thumbnail_url}
                        alt={v.title || 'thumb'}
                        className="mt-0.5 h-8 w-12 rounded object-cover border border-[#2a2a2a] flex-shrink-0"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none'
                        }}
                      />
                    ) : (
                      <Video size={14} className="mt-0.5 text-white flex-shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className={`line-clamp-1 font-medium ${isSelected ? 'text-white' : 'text-[#dddddd] group-hover:text-white'}`}>
                        {v.title || 'Untitled Video'}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-[#666666] mt-0.5">
                        <span className="truncate max-w-[100px] sm:max-w-[140px]">{v.channel || 'YouTube'}</span>
                        {v.views !== null && v.views !== undefined && (
                          <>
                            <span>•</span>
                            <span>{v.views >= 1000 ? `${(v.views / 1000).toFixed(0)}K views` : `${v.views} views`}</span>
                          </>
                        )}
                      </div>
                    </div>
                    {isSelected && <Check size={14} className="text-white flex-shrink-0 ml-1.5 self-center" />}
                  </button>

                  {/* 3-dot action button */}
                  <button
                    type="button"
                    onClick={(e) => handleThreeDotsClick(e, v)}
                    className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors cursor-pointer flex-shrink-0 ${
                      isCurrentlyInspected
                        ? 'text-white bg-[#2e2e2e]'
                        : 'text-[#666666] hover:text-white hover:bg-[#282828] active:bg-[#333333]'
                    }`}
                    title="View YouTube statistics"
                    aria-label="View YouTube statistics"
                  >
                    <MoreVertical size={14} />
                  </button>
                </div>
              )
            })}

            {filteredVideos.length === 0 && (
              <div className="py-4 text-center text-xs text-[#666666]">
                No researched videos found matching search.
              </div>
            )}
          </div>

          {/* Floating YouTube Stats Preview Card docked beside the menu (Desktop) */}
          {activeFloatingVideo && (
            <div
              className={`absolute bottom-0 z-[120] ${
                previewSide === 'right' ? 'left-full ml-3' : 'right-full mr-3'
              }`}
              onMouseEnter={() => clearTimeout(hoverTimeoutRef.current)}
              onMouseLeave={handleMouseLeaveVideo}
            >
              <VideoScopePreviewCard
                video={activeFloatingVideo}
                isSelected={selectedVideo?.db_id === activeFloatingVideo.db_id}
                onClose={() => {
                  setHoveredVideo(null)
                  setInspectedVideo(null)
                }}
                onSelect={() => {
                  onSelect(activeFloatingVideo)
                  setOpen(false)
                  setHoveredVideo(null)
                  setInspectedVideo(null)
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* Full-viewport Modal Preview Card (Only on Mobile / Tablets < 768px, portaled directly to document.body to avoid stacking context & scrolling bugs) */}
      {!isDesktop && inspectedVideo && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
          onClick={() => setInspectedVideo(null)}
        >
          <div onClick={(e) => e.stopPropagation()} className="max-w-full">
            <VideoScopePreviewCard
              video={inspectedVideo}
              isSelected={selectedVideo?.db_id === inspectedVideo.db_id}
              onClose={() => setInspectedVideo(null)}
              onSelect={() => {
                onSelect(inspectedVideo)
                setInspectedVideo(null)
                setOpen(false)
              }}
            />
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
