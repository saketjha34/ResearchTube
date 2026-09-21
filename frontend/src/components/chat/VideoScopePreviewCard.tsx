import { Eye, ThumbsUp, MessageSquare, Calendar, ExternalLink, Play, Users, Check, X } from 'lucide-react'
import type { AvailableVideo } from '../../api/chat'

interface VideoScopePreviewCardProps {
  video: AvailableVideo
  onSelect?: () => void
  isSelected?: boolean
  className?: string
  onClose?: () => void
}

function formatCompact(num?: number | null): string {
  if (num === null || num === undefined) return 'N/A'
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}B`
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (num >= 1_000) return `${(num / 1_000).toFixed(1).replace(/\.0$/, '')}K`
  return num.toLocaleString()
}

function formatFull(num?: number | null): string {
  if (num === null || num === undefined) return '0'
  return num.toLocaleString()
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return 'N/A'
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return 'N/A'
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return 'N/A'
  }
}

export function VideoScopePreviewCard({
  video,
  onSelect,
  isSelected = false,
  className = '',
  onClose,
}: VideoScopePreviewCardProps) {
  const watchUrl = video.url || `https://www.youtube.com/watch?v=${video.youtube_video_id}`
  const thumbUrl =
    video.thumbnail_url || `https://i.ytimg.com/vi/${video.youtube_video_id}/mqdefault.jpg`

  return (
    <div
      className={`w-80 sm:w-88 max-w-[calc(100vw-2rem)] rounded-2xl border border-[#2a2a2a] bg-[#111111]/95 backdrop-blur-2xl p-4 shadow-2xl animate-fade-in text-white select-none ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* 16:9 Thumbnail Header with Play Overlay */}
      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-[#181818] border border-[#222222] group">
        {onClose && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onClose()
            }}
            className="absolute top-2 right-2 z-20 flex h-7 w-7 items-center justify-center rounded-full bg-black/80 hover:bg-black text-[#cccccc] hover:text-white backdrop-blur-md border border-white/20 transition-all cursor-pointer shadow-lg active:scale-95"
            title="Close preview"
            aria-label="Close preview"
          >
            <X size={14} />
          </button>
        )}
        <img
          src={thumbUrl}
          alt={video.title || 'Video preview'}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          onError={(e) => {
            // Fallback to hqdefault if mq fails
            const target = e.target as HTMLImageElement
            if (!target.src.includes('hqdefault')) {
              target.src = `https://i.ytimg.com/vi/${video.youtube_video_id}/hqdefault.jpg`
            }
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />

        {/* Play Overlay Button */}
        <a
          href={watchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute inset-0 flex items-center justify-center group-hover:bg-black/40 transition-colors"
          title="Watch on YouTube"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-red-600/90 text-white shadow-lg transition-transform group-hover:scale-110">
            <Play size={16} fill="white" className="ml-0.5" />
          </div>
        </a>

        {/* Watch on YouTube Pill */}
        <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1 rounded-md bg-black/80 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm border border-white/10 pointer-events-none">
          <span>YouTube</span>
          <ExternalLink size={9} />
        </div>
      </div>

      {/* Title */}
      <h4
        className="mt-3 text-xs sm:text-sm font-bold tracking-tight text-white line-clamp-2 leading-snug"
        style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        title={video.title || ''}
      >
        {video.title || 'Untitled Video'}
      </h4>

      {/* Channel Row & Subscribers */}
      <div className="mt-2.5 flex items-center justify-between border-b border-[#1f1f1f] pb-2.5 text-xs">
        <div className="flex items-center gap-2 min-w-0 pr-2">
          {video.channel_avatar ? (
            <img
              src={video.channel_avatar}
              alt={video.channel || 'Channel'}
              className="h-6 w-6 rounded-full border border-[#333333] object-cover flex-shrink-0"
            />
          ) : (
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#242424] border border-[#333333] text-[10px] font-bold text-white flex-shrink-0">
              {(video.channel || 'Y').charAt(0).toUpperCase()}
            </div>
          )}
          <span className="truncate font-semibold text-[#dddddd] text-xs" title={video.channel || ''}>
            {video.channel || 'YouTube Creator'}
          </span>
        </div>

        {video.subscribers && (
          <div
            className="flex items-center gap-1 rounded-full bg-[#1c1c1c] border border-[#2d2d2d] px-2.5 py-0.5 text-[10px] font-medium text-[#b5b5b5] flex-shrink-0"
            title={`${video.subscribers} YouTube subscribers`}
          >
            <Users size={10} className="text-[#888888]" />
            <span>{video.subscribers} subs</span>
          </div>
        )}
      </div>

      {/* Key YouTube Statistics Grid (4 items: Views, Likes, Comments, Published) */}
      <div className="mt-2.5 grid grid-cols-2 gap-1.5">
        {/* Views */}
        <div
          className="flex items-center gap-2 rounded-lg bg-[#161616] border border-[#222222] p-2"
          title={`${formatFull(video.views)} total views`}
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#202020] text-[#999999]">
            <Eye size={13} />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] text-[#777777] font-medium">Views</div>
            <div className="text-xs font-bold text-white truncate">{formatCompact(video.views)}</div>
          </div>
        </div>

        {/* Likes */}
        <div
          className="flex items-center gap-2 rounded-lg bg-[#161616] border border-[#222222] p-2"
          title={`${formatFull(video.likes)} likes`}
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#202020] text-[#999999]">
            <ThumbsUp size={12} />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] text-[#777777] font-medium">Likes</div>
            <div className="text-xs font-bold text-white truncate">{formatCompact(video.likes)}</div>
          </div>
        </div>

        {/* Comments */}
        <div
          className="flex items-center gap-2 rounded-lg bg-[#161616] border border-[#222222] p-2"
          title={`${formatFull(video.comments)} comments`}
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#202020] text-[#999999]">
            <MessageSquare size={12} />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] text-[#777777] font-medium">Comments</div>
            <div className="text-xs font-bold text-white truncate">{formatCompact(video.comments)}</div>
          </div>
        </div>

        {/* Published Date */}
        <div
          className="flex items-center gap-2 rounded-lg bg-[#161616] border border-[#222222] p-2"
          title={`Published: ${formatDate(video.published_at)}`}
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#202020] text-[#999999]">
            <Calendar size={12} />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] text-[#777777] font-medium">Published</div>
            <div className="text-[11px] font-semibold text-white truncate">{formatDate(video.published_at)}</div>
          </div>
        </div>
      </div>

      {/* Description Snippet (if available) */}
      {video.description && (
        <p className="mt-2.5 line-clamp-2 text-[10px] text-[#777777] leading-relaxed border-t border-[#1c1c1c] pt-2">
          {video.description}
        </p>
      )}

      {/* Action Footer */}
      <div className="mt-3.5 flex items-center gap-2">
        <a
          href={watchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-[#333333] bg-[#1a1a1a] hover:bg-[#252525] hover:border-[#555555] px-3 py-2 text-xs font-semibold text-white transition-all shadow-sm group"
        >
          <span>Watch on YouTube</span>
          <ExternalLink size={11} className="text-[#888888] group-hover:text-white transition-colors" />
        </a>

        {onSelect && (
          <button
            type="button"
            onClick={onSelect}
            className={`flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-all ${
              isSelected
                ? 'bg-[#222222] border border-[#444444] text-white cursor-default'
                : 'border border-white bg-white hover:bg-black hover:text-white text-black cursor-pointer'
            }`}
          >
            {isSelected ? (
              <>
                <Check size={12} />
                <span>Selected</span>
              </>
            ) : (
              <span>Scope to Video</span>
            )}
          </button>
        )}
      </div>
    </div>
  )
}
