import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Video, VideoOff, Search, Check, Layers, ChevronUp, X, MoreVertical } from 'lucide-react'
import type { AvailableVideo, VideoScopeMode } from '../../api/chat'
import { VideoScopePreviewCard } from './VideoScopePreviewCard'

interface VideoScopeSelectorProps {
  videos: AvailableVideo[]
  scopeMode?: VideoScopeMode
  selectedVideo: AvailableVideo | null
  onSelectScope?: (mode: VideoScopeMode, video: AvailableVideo | null) => void
  onSelect?: (video: AvailableVideo | null) => void
  disabled?: boolean
}

export function VideoScopeSelector({
  videos,
  scopeMode = 'none',
  selectedVideo,
  onSelectScope,
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

  const effectiveScopeMode: VideoScopeMode = scopeMode || (selectedVideo ? 'video' : 'none')

  const handleChooseScope = (mode: VideoScopeMode, video: AvailableVideo | null) => {
    if (onSelectScope) {
      onSelectScope(mode, video)
    } else if (onSelect) {
      onSelect(video)
    }
    setOpen(false)
    setHoveredVideo(null)
    setInspectedVideo(null)
    setShowSelectedPreview(false)
  }

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
    if (open || effectiveScopeMode !== 'video' || !selectedVideo || !isDesktop) return
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
      setHoveredVideo(v)
      setInspectedVideo(v)
    } else {
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
            title="Select video scope: No Video Scope, All Library, or specific video"
          >
            {effectiveScopeMode === 'video' && selectedVideo ? (
              <>
                <Video size={14} className="text-white flex-shrink-0" />
                <span className="max-w-[130px] sm:max-w-[220px] truncate font-medium text-white">
                  {selectedVideo.title || 'Selected Video'}
                </span>
              </>
            ) : effectiveScopeMode === 'all' ? (
              <>
                <Layers size={14} className="text-white flex-shrink-0" />
                <span className="font-medium text-white">
                  All Library Videos {videos.length > 0 ? `(${videos.length})` : ''}
                </span>
                <ChevronUp size={12} className="text-[#666666]" />
              </>
            ) : (
              <>
                <VideoOff size={14} className="text-[#888888] flex-shrink-0" />
                <span className="text-[#aaaaaa] hover:text-white font-medium">
                  No Video Scope
                </span>
                <ChevronUp size={12} className="text-[#666666]" />
              </>
            )}
          </button>

          {effectiveScopeMode === 'video' && selectedVideo && (
            <div className="flex items-center gap-0.5 border-l border-[#2e2e2e] pl-1.5 ml-1">
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
                title="View video details and stats"
                aria-label="View video stats"
              >
                <MoreVertical size={13} />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  handleChooseScope('none', null)
                  setShowSelectedPreview(false)
                }}
                className="rounded p-1 hover:bg-[#282828] text-[#888888] hover:text-white transition-colors cursor-pointer"
                title="Reset to No Video Scope"
                aria-label="Reset to No Video Scope"
              >
                <X size={12} />
              </button>
            </div>
          )}

          {effectiveScopeMode === 'all' && (
            <div className="flex items-center gap-0.5 border-l border-[#2e2e2e] pl-1.5 ml-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  handleChooseScope('none', null)
                }}
                className="rounded p-1 hover:bg-[#282828] text-[#888888] hover:text-white transition-colors cursor-pointer"
                title="Reset to No Video Scope"
                aria-label="Reset to No Video Scope"
              >
                <X size={12} />
              </button>
            </div>
          )}
        </div>

        {/* Floating Card for the currently selected video when dropdown is closed (desktop) */}
        {showSelectedPreview && !open && effectiveScopeMode === 'video' && selectedVideo && isDesktop && (
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
            {/* Option 1: No Video Scope (Default) */}
            <button
              type="button"
              onClick={() => handleChooseScope('none', null)}
              onMouseEnter={() => {
                if (isDesktop && !inspectedVideo) setHoveredVideo(null)
              }}
              className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left transition-colors cursor-pointer ${
                effectiveScopeMode === 'none'
                  ? 'bg-[#222222] text-white font-medium'
                  : 'text-[#aaaaaa] hover:bg-[#181818] hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <VideoOff size={15} className={effectiveScopeMode === 'none' ? 'text-white flex-shrink-0' : 'text-[#888888] flex-shrink-0'} />
                <div>
                  <div className="font-medium text-white flex items-center gap-1.5">
                    No Video Scope
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#2a2a2a] text-[#aaaaaa] font-normal">Default</span>
                  </div>
                  <div className="text-[10px] text-[#666666]">General AI assistant, skips video retrieval (fastest)</div>
                </div>
              </div>
              {effectiveScopeMode === 'none' && <Check size={14} className="text-white" />}
            </button>

            {/* Option 2: All Library Videos */}
            <button
              type="button"
              onClick={() => handleChooseScope('all', null)}
              onMouseEnter={() => {
                if (isDesktop && !inspectedVideo) setHoveredVideo(null)
              }}
              className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left transition-colors cursor-pointer ${
                effectiveScopeMode === 'all'
                  ? 'bg-[#222222] text-white font-medium'
                  : 'text-[#aaaaaa] hover:bg-[#181818] hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Layers size={15} className={effectiveScopeMode === 'all' ? 'text-white flex-shrink-0' : 'text-[#888888] flex-shrink-0'} />
                <div>
                  <div className="font-medium text-white">All Library Videos</div>
                  <div className="text-[10px] text-[#666666]">Query across all ingested transcripts</div>
                </div>
              </div>
              {effectiveScopeMode === 'all' && <Check size={14} className="text-white" />}
            </button>

            {/* Divider */}
            <div className="border-t border-[#1e1e1e] my-1 pt-1">
              <div className="px-2.5 py-1 text-[10px] font-semibold text-[#555555] uppercase tracking-wider">
                Individual Videos
              </div>
            </div>

            {/* Individual Researched Videos */}
            {filteredVideos.map((v) => {
              const isSelected = effectiveScopeMode === 'video' && selectedVideo?.db_id === v.db_id
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
                    onClick={() => handleChooseScope('video', v)}
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
                isSelected={effectiveScopeMode === 'video' && selectedVideo?.db_id === activeFloatingVideo.db_id}
                onClose={() => {
                  setHoveredVideo(null)
                  setInspectedVideo(null)
                }}
                onSelect={() => handleChooseScope('video', activeFloatingVideo)}
              />
            </div>
          )}
        </div>
      )}

      {/* Full-viewport Modal Preview Card (Mobile / Tablets < 768px) */}
      {!isDesktop && inspectedVideo && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
          onClick={() => setInspectedVideo(null)}
        >
          <div onClick={(e) => e.stopPropagation()} className="max-w-full">
            <VideoScopePreviewCard
              video={inspectedVideo}
              isSelected={effectiveScopeMode === 'video' && selectedVideo?.db_id === inspectedVideo.db_id}
              onClose={() => setInspectedVideo(null)}
              onSelect={() => {
                handleChooseScope('video', inspectedVideo)
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
