import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import client from '../api/client'
import { useAuth } from '../context/AuthContext'
import { 
  BarChart2, 
  BookOpen, 
  Video, 
  Layers, 
  Award, 
  CheckCircle2, 
  Loader2,
  Sparkles,
  Compass,
  RefreshCw,
  Settings as SettingsIcon
} from 'lucide-react'

const STATS_CACHE_KEY = 'rt_user_analytics_stats'

interface ChannelStat {
  channel: string
  count: number
}

interface ConceptStat {
  concept: string
  count: number
}

interface UserStats {
  total_research_runs: number
  completed_research_runs: number
  failed_research_runs: number
  total_videos_analyzed: number
  total_views_analyzed: number
  average_videos_per_run: number
  total_channels_discovered: number
  average_run_duration_seconds: number
  average_relevance_score: number
  average_educational_score: number
  average_coverage_score: number
  total_beginner_friendly_videos: number
  total_transcript_chunks: number
  top_channels: ChannelStat[]
  top_concepts: ConceptStat[]
}

const initialsFromName = (name?: string | null) => {
  if (!name) return 'RT'
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

function Profile() {
  const { user } = useAuth()
  const [imageFailed, setImageFailed] = useState(false)

  const initials = useMemo(() => initialsFromName(user?.full_name || user?.username), [user])
  const shouldShowImage = Boolean(user?.profile_picture_url && !imageFailed)

  const [stats, setStats] = useState<UserStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [statsRefreshing, setStatsRefreshing] = useState(false)
  const [statsError, setStatsError] = useState('')

  // Load stats: check browser cache first, fallback to backend API
  const fetchStats = async (isManualRefresh = false) => {
    if (!isManualRefresh) {
      const cached = localStorage.getItem(STATS_CACHE_KEY)
      if (cached) {
        try {
          const parsed: UserStats = JSON.parse(cached)
          setStats(parsed)
          setStatsLoading(false)
          return
        } catch {
          localStorage.removeItem(STATS_CACHE_KEY)
        }
      }
    }

    if (isManualRefresh) {
      setStatsRefreshing(true)
    } else {
      setStatsLoading(true)
    }
    setStatsError('')

    try {
      const response = await client.get<UserStats>('/user/stats')
      setStats(response.data)
      localStorage.setItem(STATS_CACHE_KEY, JSON.stringify(response.data))
    } catch {
      setStatsError('Unable to load research activity stats.')
    } finally {
      setStatsLoading(false)
      setStatsRefreshing(false)
    }
  }

  // Initial mount: load cached stats or fetch once
  useEffect(() => {
    void fetchStats(false)
  }, [])

  // Invalidate cache when a new research run completes
  useEffect(() => {
    const handleResearchCreated = () => {
      localStorage.removeItem(STATS_CACHE_KEY)
    }
    window.addEventListener('research:created', handleResearchCreated)
    return () => window.removeEventListener('research:created', handleResearchCreated)
  }, [])

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M'
    if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K'
    return num.toString()
  }

  return (
    <section className="space-y-8 pb-12 animate-fade-in">
      {/* Top User Identity Header (User Name and Icon) */}
      <header className="border border-[#222222] bg-[#111111] p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          {shouldShowImage ? (
            <img
              src={user?.profile_picture_url ?? ''}
              alt="User profile"
              className="h-16 w-16 rounded-full border border-[#333333] object-cover"
              referrerPolicy="no-referrer"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-[#333333] bg-[#1a1a1a] text-lg font-bold text-white shadow-inner">
              {initials}
            </div>
          )}

          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-bold text-white tracking-tight">
                {user?.full_name || user?.username || 'Researcher'}
              </h1>
            </div>
            <p className="text-sm text-[#888888] mt-0.5 font-mono">
              {user?.username ? `@${user.username}` : user?.email}
            </p>
          </div>
        </div>

        {/* Quick link to Settings */}
        <div className="flex items-center gap-3">
          <Link
            to="/settings"
            className="flex items-center gap-2 rounded-xl border border-[#2a2a2a] bg-[#161616] px-4 py-2 text-xs font-medium text-[#cccccc] hover:border-[#444444] hover:text-white hover:bg-[#202020] transition-all cursor-pointer"
          >
            <SettingsIcon size={14} className="text-[#888888]" />
            <span>Account Settings</span>
          </Link>
        </div>
      </header>

      {/* --- Research Analytics Section (Dark Monochrome, Non-Colorful) --- */}
      <section className="space-y-6">
        <header className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2 text-white" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              <BarChart2 className="text-[#888888]" size={20} /> Research Analytics
            </h2>
            <p className="text-xs text-[#777777] mt-0.5">Aggregated insights compiled from your YouTube research runs.</p>
          </div>
          <button
            onClick={() => void fetchStats(true)}
            disabled={statsLoading || statsRefreshing}
            className="flex items-center gap-1.5 border border-[#282828] bg-[#141414] hover:border-[#444444] hover:text-white px-3.5 py-1.5 text-xs text-[#999999] font-medium rounded-lg transition-all disabled:opacity-50 cursor-pointer"
            title="Refresh Analytics Stats"
          >
            <RefreshCw size={13} className={statsRefreshing ? "animate-spin text-white" : "text-[#777777]"} />
            <span>{statsRefreshing ? 'REFRESHING...' : 'REFRESH'}</span>
          </button>
        </header>

        {statsLoading ? (
          <div className="border border-[#222222] bg-[#111111] p-12 rounded-xl flex flex-col items-center justify-center gap-3">
            <Loader2 className="animate-spin text-[#888888]" size={28} />
            <p className="text-xs text-[#777777]">Calculating your research statistics...</p>
          </div>
        ) : statsError ? (
          <div className="border border-[#282828] bg-[#111111] p-6 rounded-xl text-center space-y-2">
            <p className="text-xs text-[#999999]">{statsError}</p>
            <button
              onClick={() => void fetchStats(true)}
              className="text-xs text-white underline hover:text-[#cccccc] cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : stats ? (
          <div className="space-y-6">
            {/* Overview Stats Cards (Top 4 Cards - Sleek Monochrome) */}
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
              {/* Card 1: TOTAL QUERIES */}
              <div className="border border-[#222222] bg-[#111111] p-5 rounded-xl hover:border-[#3a3a3a] transition-all group">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-[#666666] uppercase tracking-wider">Total Queries</span>
                  <Sparkles size={16} className="text-[#555555] group-hover:text-white transition-colors" />
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-3xl font-semibold text-white">{stats.total_research_runs}</span>
                  <span className="text-xs text-[#666666]">runs</span>
                </div>
              </div>

              {/* Card 2: COMPLETED */}
              <div className="border border-[#222222] bg-[#111111] p-5 rounded-xl hover:border-[#3a3a3a] transition-all group">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-[#666666] uppercase tracking-wider">Completed</span>
                  <CheckCircle2 size={16} className="text-[#555555] group-hover:text-white transition-colors" />
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-3xl font-semibold text-white">{stats.completed_research_runs}</span>
                  <span className="text-xs text-[#666666]">success</span>
                </div>
              </div>

              {/* Card 3: VIDEOS ANALYZED */}
              <div className="border border-[#222222] bg-[#111111] p-5 rounded-xl hover:border-[#3a3a3a] transition-all group">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-[#666666] uppercase tracking-wider">Videos Analyzed</span>
                  <Video size={16} className="text-[#555555] group-hover:text-white transition-colors" />
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-3xl font-semibold text-white">{stats.total_videos_analyzed}</span>
                  <span className="text-xs text-[#666666]">videos</span>
                </div>
              </div>

              {/* Card 4: AUDIENCE REACH */}
              <div className="border border-[#222222] bg-[#111111] p-5 rounded-xl hover:border-[#3a3a3a] transition-all group">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-[#666666] uppercase tracking-wider">Audience Reach</span>
                  <Layers size={16} className="text-[#555555] group-hover:text-white transition-colors" />
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-3xl font-semibold text-white">{formatNumber(stats.total_views_analyzed)}</span>
                  <span className="text-xs text-[#666666]">views</span>
                </div>
              </div>
            </div>

            {/* Performance Metrics & Insights Split Section */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Left Column: PIPELINE PERFORMANCE */}
              <div className="border border-[#222222] bg-[#111111] p-6 rounded-xl space-y-6">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#777777] flex items-center gap-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  <Compass size={14} className="text-[#888888]" /> Pipeline Performance
                </h3>

                {/* Sub-stats 6-Card Grid (Monochrome) */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="bg-[#161616] p-3.5 rounded-lg border border-[#222222]">
                    <p className="text-[10px] font-bold text-[#666666] uppercase tracking-wider">Avg Videos / Run</p>
                    <p className="text-xl font-bold text-white mt-1">{stats.average_videos_per_run}</p>
                  </div>

                  <div className="bg-[#161616] p-3.5 rounded-lg border border-[#222222]">
                    <p className="text-[10px] font-bold text-[#666666] uppercase tracking-wider">Avg Run Duration</p>
                    <p className="text-xl font-bold text-white mt-1">
                      {stats.average_run_duration_seconds ? `${stats.average_run_duration_seconds.toFixed(1)}s` : '0.0s'}
                    </p>
                  </div>

                  <div className="bg-[#161616] p-3.5 rounded-lg border border-[#222222]">
                    <p className="text-[10px] font-bold text-[#666666] uppercase tracking-wider">Channels Discovered</p>
                    <p className="text-xl font-bold text-white mt-1">{stats.total_channels_discovered}</p>
                  </div>

                  <div className="bg-[#161616] p-3.5 rounded-lg border border-[#222222]">
                    <p className="text-[10px] font-bold text-[#666666] uppercase tracking-wider">Vector Embeddings</p>
                    <p className="text-xl font-bold text-white mt-1">{stats.total_transcript_chunks}</p>
                  </div>

                  <div className="bg-[#161616] p-3.5 rounded-lg border border-[#222222]">
                    <p className="text-[10px] font-bold text-[#666666] uppercase tracking-wider">Beginner Friendly</p>
                    <p className="text-xl font-bold text-white mt-1">{stats.total_beginner_friendly_videos}</p>
                  </div>

                  <div className="bg-[#161616] p-3.5 rounded-lg border border-[#222222]">
                    <p className="text-[10px] font-bold text-[#666666] uppercase tracking-wider">Failed Runs</p>
                    <p className="text-xl font-bold text-[#999999] mt-1">{stats.failed_research_runs}</p>
                  </div>
                </div>

                {/* Score Averages Progress Bars (Monochrome - No Gradients) */}
                <div className="space-y-4 border-t border-[#1a1a1a] pt-4">
                  <p className="text-[10px] font-bold text-[#666666] uppercase tracking-wider">Average RAG Metrics</p>
                  
                  {/* Relevance */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-[#888888]">Relevance Score</span>
                      <span className="text-white">{stats.average_relevance_score} / 10</span>
                    </div>
                    <div className="h-1.5 w-full bg-[#1e1e1e] rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-white rounded-full transition-all duration-1000" 
                        style={{ width: `${stats.average_relevance_score * 10}%` }}
                      />
                    </div>
                  </div>

                  {/* Educational Quality */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-[#888888]">Educational Quality</span>
                      <span className="text-white">{stats.average_educational_score} / 10</span>
                    </div>
                    <div className="h-1.5 w-full bg-[#1e1e1e] rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-[#cccccc] rounded-full transition-all duration-1000" 
                        style={{ width: `${stats.average_educational_score * 10}%` }}
                      />
                    </div>
                  </div>

                  {/* Coverage */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-[#888888]">Topic Coverage</span>
                      <span className="text-white">{stats.average_coverage_score} / 10</span>
                    </div>
                    <div className="h-1.5 w-full bg-[#1e1e1e] rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-[#999999] rounded-full transition-all duration-1000" 
                        style={{ width: `${stats.average_coverage_score * 10}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Insights Columns (Monochrome) */}
              <div className="space-y-6 flex flex-col justify-between">
                {/* Top Recommended Channels */}
                <div className="border border-[#222222] bg-[#111111] p-6 rounded-xl space-y-4 flex-1">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#777777] flex items-center gap-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                    <Award size={14} className="text-[#888888]" /> Top Recommended Channels
                  </h3>
                  {stats.top_channels.length === 0 ? (
                    <p className="text-xs text-[#555555] py-4 text-center">No video recommendations generated yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {(() => {
                        const maxCount = stats.top_channels.reduce((max, c) => Math.max(max, c.count), 1)
                        return stats.top_channels.map((ch, idx) => (
                          <div key={ch.channel} className="space-y-1">
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-[#cccccc] font-medium truncate flex items-center gap-1.5">
                                <span className="text-[#555555] font-bold">#{idx + 1}</span> {ch.channel}
                              </span>
                              <span className="text-[#888888] font-bold">{ch.count} {ch.count === 1 ? 'time' : 'times'}</span>
                            </div>
                            <div className="h-1.5 w-full bg-[#1e1e1e] rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-[#aaaaaa] rounded-full" 
                                style={{ width: `${(ch.count / maxCount) * 100}%` }}
                              />
                            </div>
                          </div>
                        ))
                      })()}
                    </div>
                  )}
                </div>

                {/* Top Key Concepts Map (Monochrome Badges) */}
                <div className="border border-[#222222] bg-[#111111] p-6 rounded-xl space-y-4 flex-1">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#777777] flex items-center gap-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                    <BookOpen size={14} className="text-[#888888]" /> Top Research Concepts
                  </h3>
                  {stats.top_concepts.length === 0 ? (
                    <p className="text-xs text-[#555555] py-4 text-center">No research reports analyzed yet.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {stats.top_concepts.map((concept) => (
                        <div 
                          key={concept.concept} 
                          className="flex items-center gap-2 bg-[#161616] border border-[#282828] hover:border-[#444444] hover:bg-[#202020] px-3 py-1.5 rounded-lg text-xs transition-colors"
                        >
                          <span className="text-[#cccccc] font-medium">{concept.concept}</span>
                          <span className="bg-[#242424] text-[10px] text-white font-bold px-1.5 py-0.5 rounded-md">
                            {concept.count}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </section>
  )
}

export default Profile
