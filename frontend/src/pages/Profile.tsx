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
  MessageSquare,
  Activity,
  Film,
  Settings as SettingsIcon
} from 'lucide-react'

// Versioned cache key to prevent stale cache deserialization crashes
const STATS_CACHE_KEY = 'rt_user_analytics_stats_v3'

interface ChannelStat {
  channel: string
  count: number
}

interface ConceptStat {
  concept: string
  count: number
}

interface ChatVideoStat {
  title: string
  channel?: string | null
  chat_count: number
}

interface ChatScopeStat {
  scope: string
  count: number
}

interface UserStats {
  // Research stats
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

  // Conversational AI & Chat stats
  total_chat_sessions: number
  total_chat_messages: number
  total_user_messages: number
  total_assistant_messages: number
  average_messages_per_session: number
  total_video_scoped_sessions: number
  total_rag_grounded_messages: number
  rag_grounding_rate: number
  pinned_chat_sessions: number
  shared_chat_sessions: number
  top_discussed_videos: ChatVideoStat[]
  chat_scope_distribution: ChatScopeStat[]
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
  const [activeTab, setActiveTab] = useState<'all' | 'research' | 'chat'>('all')

  const initials = useMemo(() => initialsFromName(user?.full_name || user?.username), [user])
  const shouldShowImage = Boolean(user?.profile_picture_url && !imageFailed)

  const [stats, setStats] = useState<UserStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [statsRefreshing, setStatsRefreshing] = useState(false)
  const [statsError, setStatsError] = useState('')

  // Clean up any legacy unversioned caches
  useEffect(() => {
    try {
      localStorage.removeItem('rt_user_analytics_stats')
      localStorage.removeItem('rt_user_analytics_stats_v2')
    } catch {
      // ignore
    }
  }, [])

  // Load stats: check browser cache first, fallback to backend API
  const fetchStats = async (isManualRefresh = false) => {
    if (!isManualRefresh) {
      try {
        const cached = localStorage.getItem(STATS_CACHE_KEY)
        if (cached) {
          const parsed = JSON.parse(cached)
          // Validate required fields exist in cached object
          if (
            parsed &&
            typeof parsed.total_research_runs === 'number' &&
            Array.isArray(parsed.top_discussed_videos) &&
            Array.isArray(parsed.chat_scope_distribution)
          ) {
            setStats(parsed)
            setStatsLoading(false)
            return
          } else {
            localStorage.removeItem(STATS_CACHE_KEY)
          }
        }
      } catch {
        localStorage.removeItem(STATS_CACHE_KEY)
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
      if (response && response.data) {
        setStats(response.data)
        try {
          localStorage.setItem(STATS_CACHE_KEY, JSON.stringify(response.data))
        } catch {
          // ignore localStorage quota errors
        }
      }
    } catch (err: any) {
      setStatsError(err?.response?.data?.detail || 'Unable to load user activity stats.')
    } finally {
      setStatsLoading(false)
      setStatsRefreshing(false)
    }
  }

  // Initial mount: load cached stats or fetch once
  useEffect(() => {
    void fetchStats(false)
  }, [])

  // Invalidate cache when research or chat runs complete
  useEffect(() => {
    const handleInvalidate = () => {
      try {
        localStorage.removeItem(STATS_CACHE_KEY)
      } catch {}
    }
    window.addEventListener('research:created', handleInvalidate)
    window.addEventListener('chat:created', handleInvalidate)
    window.addEventListener('chat:updated', handleInvalidate)
    return () => {
      window.removeEventListener('research:created', handleInvalidate)
      window.removeEventListener('chat:created', handleInvalidate)
      window.removeEventListener('chat:updated', handleInvalidate)
    }
  }, [])

  const formatNumber = (num?: number | null): string => {
    const val = typeof num === 'number' && !isNaN(num) ? num : 0
    if (val >= 1000000) return (val / 1000000).toFixed(1).replace(/\.0$/, '') + 'M'
    if (val >= 1000) return (val / 1000).toFixed(1).replace(/\.0$/, '') + 'K'
    return val.toString()
  }

  const scopeLabel = (scope: string): string => {
    if (scope === 'video') return 'Single Video Scope'
    if (scope === 'library' || scope === 'all') return 'Research Library Scope'
    return 'General AI Assistant'
  }

  // Safe array extractions
  const topChannels = Array.isArray(stats?.top_channels) ? stats!.top_channels : []
  const topConcepts = Array.isArray(stats?.top_concepts) ? stats!.top_concepts : []
  const topDiscussedVideos = Array.isArray(stats?.top_discussed_videos) ? stats!.top_discussed_videos : []
  const chatScopeDistribution = Array.isArray(stats?.chat_scope_distribution) ? stats!.chat_scope_distribution : []

  return (
    <section className="space-y-6 sm:space-y-8 pb-16 animate-fade-in w-full max-w-7xl mx-auto min-w-0">
      {/* Top User Identity Header */}
      <header className="border border-[#222222] bg-[#111111] p-4 sm:p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6 shadow-sm min-w-0">
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
        <div className="flex items-center gap-2.5 flex-wrap">
          <Link
            to="/settings"
            className="flex items-center gap-2 rounded-xl border border-[#2a2a2a] bg-[#161616] px-4 py-2 text-xs font-medium text-[#cccccc] hover:border-[#444444] hover:text-white hover:bg-[#202020] transition-all cursor-pointer"
          >
            <SettingsIcon size={14} className="text-[#888888]" />
            <span>Account Settings</span>
          </Link>
        </div>
      </header>

      {/* Analytics Category Tabs Bar & Global Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1c1c1c] pb-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              activeTab === 'all'
                ? 'bg-white text-black font-semibold shadow-sm'
                : 'text-[#888888] hover:text-white hover:bg-[#141414]'
            }`}
          >
            <BarChart2 size={13} />
            <span>All Analytics</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('research')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              activeTab === 'research'
                ? 'bg-white text-black font-semibold shadow-sm'
                : 'text-[#888888] hover:text-white hover:bg-[#141414]'
            }`}
          >
            <Compass size={13} />
            <span>Research Pipeline</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('chat')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              activeTab === 'chat'
                ? 'bg-white text-black font-semibold shadow-sm'
                : 'text-[#888888] hover:text-white hover:bg-[#141414]'
            }`}
          >
            <MessageSquare size={13} />
            <span>Chat</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => void fetchStats(true)}
          disabled={statsLoading || statsRefreshing}
          className="self-start sm:self-auto flex items-center gap-1.5 border border-[#282828] bg-[#141414] hover:border-[#444444] hover:text-white px-3.5 py-1.5 text-xs text-[#999999] font-medium rounded-lg transition-all disabled:opacity-50 cursor-pointer"
          title="Refresh Analytics Stats"
        >
          <RefreshCw size={13} className={statsRefreshing ? "animate-spin text-white" : "text-[#777777]"} />
          <span>{statsRefreshing ? 'REFRESHING...' : 'REFRESH'}</span>
        </button>
      </div>

      {statsLoading ? (
        <div className="border border-[#222222] bg-[#111111] p-12 rounded-xl flex flex-col items-center justify-center gap-3">
          <Loader2 className="animate-spin text-[#888888]" size={28} />
          <p className="text-xs text-[#777777]">Calculating your research and chat analytics...</p>
        </div>
      ) : statsError ? (
        <div className="border border-[#282828] bg-[#111111] p-6 rounded-xl text-center space-y-2">
          <p className="text-xs text-[#999999]">{statsError}</p>
          <button
            type="button"
            onClick={() => void fetchStats(true)}
            className="text-xs text-white underline hover:text-[#cccccc] cursor-pointer"
          >
            Retry
          </button>
        </div>
      ) : stats ? (
        <div className="space-y-10">
          {/* ============================================================ */}
          {/* SECTION 1: RESEARCH ANALYTICS                                */}
          {/* ============================================================ */}
          {(activeTab === 'all' || activeTab === 'research') && (
            <section className="space-y-6">
              <header>
                <h2 className="text-xl font-semibold flex items-center gap-2 text-white" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  <Compass className="text-[#888888]" size={20} /> Research Analytics
                </h2>
                <p className="text-xs text-[#777777] mt-0.5">Aggregated insights compiled from your YouTube autonomous research runs.</p>
              </header>

              {/* Research Overview Stats Cards (Top 4 Cards) */}
              <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                {/* Card 1: TOTAL QUERIES */}
                <div className="border border-[#222222] bg-[#111111] p-5 rounded-xl hover:border-[#3a3a3a] transition-all group">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-[#666666] uppercase tracking-wider">Total Queries</span>
                    <Sparkles size={16} className="text-[#555555] group-hover:text-white transition-colors" />
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-3xl font-semibold text-white">{stats.total_research_runs ?? 0}</span>
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
                    <span className="text-3xl font-semibold text-white">{stats.completed_research_runs ?? 0}</span>
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
                    <span className="text-3xl font-semibold text-white">{stats.total_videos_analyzed ?? 0}</span>
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

              {/* Research Performance Metrics & Insights Split Section */}
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Left Column: PIPELINE PERFORMANCE */}
                <div className="border border-[#222222] bg-[#111111] p-6 rounded-xl space-y-6">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#777777] flex items-center gap-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                    <Compass size={14} className="text-[#888888]" /> Pipeline Performance
                  </h3>

                  {/* Sub-stats 6-Card Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="bg-[#161616] p-3.5 rounded-lg border border-[#222222]">
                      <p className="text-[10px] font-bold text-[#666666] uppercase tracking-wider">Avg Videos / Run</p>
                      <p className="text-xl font-bold text-white mt-1">{stats.average_videos_per_run ?? 0}</p>
                    </div>

                    <div className="bg-[#161616] p-3.5 rounded-lg border border-[#222222]">
                      <p className="text-[10px] font-bold text-[#666666] uppercase tracking-wider">Avg Run Duration</p>
                      <p className="text-xl font-bold text-white mt-1">
                        {stats.average_run_duration_seconds ? `${stats.average_run_duration_seconds.toFixed(1)}s` : '0.0s'}
                      </p>
                    </div>

                    <div className="bg-[#161616] p-3.5 rounded-lg border border-[#222222]">
                      <p className="text-[10px] font-bold text-[#666666] uppercase tracking-wider">Channels Discovered</p>
                      <p className="text-xl font-bold text-white mt-1">{stats.total_channels_discovered ?? 0}</p>
                    </div>

                    <div className="bg-[#161616] p-3.5 rounded-lg border border-[#222222]">
                      <p className="text-[10px] font-bold text-[#666666] uppercase tracking-wider">Vector Embeddings</p>
                      <p className="text-xl font-bold text-white mt-1">{stats.total_transcript_chunks ?? 0}</p>
                    </div>

                    <div className="bg-[#161616] p-3.5 rounded-lg border border-[#222222]">
                      <p className="text-[10px] font-bold text-[#666666] uppercase tracking-wider">Beginner Friendly</p>
                      <p className="text-xl font-bold text-white mt-1">{stats.total_beginner_friendly_videos ?? 0}</p>
                    </div>

                    <div className="bg-[#161616] p-3.5 rounded-lg border border-[#222222]">
                      <p className="text-[10px] font-bold text-[#666666] uppercase tracking-wider">Failed Runs</p>
                      <p className="text-xl font-bold text-[#999999] mt-1">{stats.failed_research_runs ?? 0}</p>
                    </div>
                  </div>

                  {/* Score Averages Progress Bars */}
                  <div className="space-y-4 border-t border-[#1a1a1a] pt-4">
                    <p className="text-[10px] font-bold text-[#666666] uppercase tracking-wider">Average RAG Metrics</p>
                    
                    {/* Relevance */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-[#888888]">Relevance Score</span>
                        <span className="text-white">{stats.average_relevance_score ?? 0} / 10</span>
                      </div>
                      <div className="h-1.5 w-full bg-[#1e1e1e] rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-white rounded-full transition-all duration-1000" 
                          style={{ width: `${Math.min((stats.average_relevance_score ?? 0) * 10, 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Educational Quality */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-[#888888]">Educational Quality</span>
                        <span className="text-white">{stats.average_educational_score ?? 0} / 10</span>
                      </div>
                      <div className="h-1.5 w-full bg-[#1e1e1e] rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-[#cccccc] rounded-full transition-all duration-1000" 
                          style={{ width: `${Math.min((stats.average_educational_score ?? 0) * 10, 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Coverage */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-[#888888]">Topic Coverage</span>
                        <span className="text-white">{stats.average_coverage_score ?? 0} / 10</span>
                      </div>
                      <div className="h-1.5 w-full bg-[#1e1e1e] rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-[#999999] rounded-full transition-all duration-1000" 
                          style={{ width: `${Math.min((stats.average_coverage_score ?? 0) * 10, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column: Channels & Concepts */}
                <div className="space-y-6 flex flex-col justify-between">
                  {/* Top Recommended Channels */}
                  <div className="border border-[#222222] bg-[#111111] p-6 rounded-xl space-y-4 flex-1">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#777777] flex items-center gap-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                      <Award size={14} className="text-[#888888]" /> Top Recommended Channels
                    </h3>
                    {topChannels.length === 0 ? (
                      <p className="text-xs text-[#555555] py-4 text-center">No video recommendations generated yet.</p>
                    ) : (
                      <div className="space-y-3">
                        {(() => {
                          const maxCount = topChannels.reduce((max, c) => Math.max(max, c.count), 1)
                          return topChannels.map((ch, idx) => (
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

                  {/* Top Key Concepts Map */}
                  <div className="border border-[#222222] bg-[#111111] p-4 sm:p-6 rounded-xl space-y-4 flex-1 min-w-0">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#777777] flex items-center gap-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                      <BookOpen size={14} className="text-[#888888]" /> Top Research Concepts
                    </h3>
                    {topConcepts.length === 0 ? (
                      <p className="text-xs text-[#555555] py-4 text-center">No research reports analyzed yet.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5 sm:gap-2">
                        {topConcepts.map((concept) => (
                          <div 
                            key={concept.concept} 
                            className="flex items-center gap-1.5 sm:gap-2 bg-[#161616] border border-[#282828] hover:border-[#444444] hover:bg-[#202020] px-2.5 sm:px-3 py-1.5 rounded-lg text-xs transition-colors max-w-full min-w-0"
                          >
                            <span className="text-[#cccccc] font-medium truncate max-w-[180px] xs:max-w-[260px] sm:max-w-none" title={concept.concept}>{concept.concept}</span>
                            <span className="bg-[#242424] text-[10px] text-white font-bold px-1.5 py-0.5 rounded-md flex-shrink-0">
                              {concept.count}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ============================================================ */}
          {/* SECTION 2: CHAT & CONVERSATIONAL AI INTELLIGENCE             */}
          {/* ============================================================ */}
          {(activeTab === 'all' || activeTab === 'chat') && (
            <section className="space-y-6 pt-2 min-w-0">
              <header className="min-w-0">
                <h2 className="text-lg sm:text-xl font-semibold flex items-center gap-2 text-white" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  <MessageSquare className="text-[#888888]" size={18} /> Chat
                </h2>
                <p className="text-xs text-[#777777] mt-0.5">Conversational history and video discussion insights.</p>
              </header>

              {/* Chat Overview Top 4 KPI Cards */}
              <div className="grid gap-2.5 sm:gap-4 grid-cols-2 lg:grid-cols-4">
                {/* Card 1: TOTAL CONVERSATIONS */}
                <div className="border border-[#222222] bg-[#111111] p-3 sm:p-4 md:p-5 rounded-xl hover:border-[#3a3a3a] transition-all group flex flex-col justify-between min-w-0 overflow-hidden">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] sm:text-[10px] font-bold text-[#666666] uppercase tracking-wider truncate">Conversations</span>
                    <MessageSquare size={15} className="text-[#555555] group-hover:text-white transition-colors flex-shrink-0" />
                  </div>
                  <div className="mt-2 flex items-baseline gap-1.5 sm:gap-2">
                    <span className="text-2xl sm:text-3xl font-semibold text-white">{stats.total_chat_sessions ?? 0}</span>
                    <span className="text-xs text-[#666666]">threads</span>
                  </div>
                  <p className="text-[10px] sm:text-[11px] text-[#666666] mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 leading-tight">
                    <span><span className="text-[#888888] font-medium">{stats.pinned_chat_sessions ?? 0}</span> pinned</span>
                    <span>•</span>
                    <span><span className="text-[#888888] font-medium">{stats.shared_chat_sessions ?? 0}</span> shared</span>
                  </p>
                </div>

                {/* Card 2: MESSAGES EXCHANGED */}
                <div className="border border-[#222222] bg-[#111111] p-3 sm:p-4 md:p-5 rounded-xl hover:border-[#3a3a3a] transition-all group flex flex-col justify-between min-w-0 overflow-hidden">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] sm:text-[10px] font-bold text-[#666666] uppercase tracking-wider truncate">Messages</span>
                    <Activity size={15} className="text-[#555555] group-hover:text-white transition-colors flex-shrink-0" />
                  </div>
                  <div className="mt-2 flex items-baseline gap-1.5 sm:gap-2">
                    <span className="text-2xl sm:text-3xl font-semibold text-white">{stats.total_chat_messages ?? 0}</span>
                    <span className="text-xs text-[#666666]">turns</span>
                  </div>
                  <p className="text-[10px] sm:text-[11px] text-[#666666] mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 leading-tight">
                    <span><span className="text-[#888888] font-medium">{stats.total_user_messages ?? 0}</span> queries</span>
                    <span>•</span>
                    <span><span className="text-[#888888] font-medium">{stats.total_assistant_messages ?? 0}</span> AI</span>
                  </p>
                </div>

                {/* Card 3: VIDEO DISCUSSIONS */}
                <div className="border border-[#222222] bg-[#111111] p-3 sm:p-4 md:p-5 rounded-xl hover:border-[#3a3a3a] transition-all group flex flex-col justify-between min-w-0 overflow-hidden">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] sm:text-[10px] font-bold text-[#666666] uppercase tracking-wider truncate">Video Discussions</span>
                    <Film size={15} className="text-[#555555] group-hover:text-white transition-colors flex-shrink-0" />
                  </div>
                  <div className="mt-2 flex items-baseline gap-1.5 sm:gap-2">
                    <span className="text-2xl sm:text-3xl font-semibold text-white">{stats.total_video_scoped_sessions ?? 0}</span>
                    <span className="text-xs text-[#666666]">scoped</span>
                  </div>
                  <p className="text-[10px] sm:text-[11px] text-[#666666] mt-1.5 leading-tight line-clamp-2" title={(stats.total_chat_sessions ?? 0) > 0 ? `${Math.round(((stats.total_video_scoped_sessions ?? 0) / stats.total_chat_sessions) * 100)}% of conversations focused on specific videos` : 'No video-scoped chats yet'}>
                    {(stats.total_chat_sessions ?? 0) > 0
                      ? `${Math.round(((stats.total_video_scoped_sessions ?? 0) / stats.total_chat_sessions) * 100)}% focused on videos`
                      : 'No video-scoped chats'}
                  </p>
                </div>

                {/* Card 4: VIDEO-LINKED ANSWERS */}
                <div className="border border-[#222222] bg-[#111111] p-3 sm:p-4 md:p-5 rounded-xl hover:border-[#3a3a3a] transition-all group flex flex-col justify-between min-w-0 overflow-hidden">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] sm:text-[10px] font-bold text-[#666666] uppercase tracking-wider truncate">Video-Linked</span>
                    <Sparkles size={15} className="text-[#555555] group-hover:text-white transition-colors flex-shrink-0" />
                  </div>
                  <div className="mt-2 flex items-baseline gap-1.5 sm:gap-2">
                    <span className="text-2xl sm:text-3xl font-semibold text-white">{stats.total_rag_grounded_messages ?? 0}</span>
                    <span className="text-xs text-[#666666]">answers</span>
                  </div>
                  <p className="text-[10px] sm:text-[11px] text-[#666666] mt-1.5 leading-tight line-clamp-2">
                    {stats.rag_grounding_rate ?? 0}% with timestamps
                  </p>
                </div>
              </div>

              {/* Chat Split Details Grid */}
              <div className="grid gap-4 sm:gap-6 lg:grid-cols-2 min-w-0">
                {/* Left Column: Conversational Dynamics */}
                <div className="border border-[#222222] bg-[#111111] p-3.5 sm:p-5 md:p-6 rounded-xl space-y-5 sm:space-y-6 min-w-0 overflow-hidden">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#777777] flex items-center gap-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                    <Activity size={14} className="text-[#888888]" /> Conversational Dynamics
                  </h3>

                  {/* 6 Sub-metric Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                    <div className="bg-[#161616] p-2.5 sm:p-3.5 rounded-lg border border-[#222222] min-w-0 overflow-hidden">
                      <p className="text-[9px] sm:text-[10px] font-bold text-[#666666] uppercase tracking-wider truncate">Avg Msgs / Thread</p>
                      <p className="text-lg sm:text-xl font-bold text-white mt-1">{stats.average_messages_per_session ?? 0}</p>
                    </div>

                    <div className="bg-[#161616] p-2.5 sm:p-3.5 rounded-lg border border-[#222222] min-w-0 overflow-hidden">
                      <p className="text-[9px] sm:text-[10px] font-bold text-[#666666] uppercase tracking-wider truncate">Video Link Rate</p>
                      <p className="text-lg sm:text-xl font-bold text-white mt-1">{stats.rag_grounding_rate ?? 0}%</p>
                    </div>

                    <div className="bg-[#161616] p-2.5 sm:p-3.5 rounded-lg border border-[#222222] min-w-0 overflow-hidden">
                      <p className="text-[9px] sm:text-[10px] font-bold text-[#666666] uppercase tracking-wider truncate">User Questions</p>
                      <p className="text-lg sm:text-xl font-bold text-white mt-1">{stats.total_user_messages ?? 0}</p>
                    </div>

                    <div className="bg-[#161616] p-2.5 sm:p-3.5 rounded-lg border border-[#222222] min-w-0 overflow-hidden">
                      <p className="text-[9px] sm:text-[10px] font-bold text-[#666666] uppercase tracking-wider truncate">AI Responses</p>
                      <p className="text-lg sm:text-xl font-bold text-white mt-1">{stats.total_assistant_messages ?? 0}</p>
                    </div>

                    <div className="bg-[#161616] p-2.5 sm:p-3.5 rounded-lg border border-[#222222] min-w-0 overflow-hidden">
                      <p className="text-[9px] sm:text-[10px] font-bold text-[#666666] uppercase tracking-wider truncate">Pinned Threads</p>
                      <p className="text-lg sm:text-xl font-bold text-white mt-1">{stats.pinned_chat_sessions ?? 0}</p>
                    </div>

                    <div className="bg-[#161616] p-2.5 sm:p-3.5 rounded-lg border border-[#222222] min-w-0 overflow-hidden">
                      <p className="text-[9px] sm:text-[10px] font-bold text-[#666666] uppercase tracking-wider truncate">Shared Threads</p>
                      <p className="text-lg sm:text-xl font-bold text-[#999999] mt-1">{stats.shared_chat_sessions ?? 0}</p>
                    </div>
                  </div>

                  {/* Progress Meters for Activity & Turn Balance */}
                  <div className="space-y-4 border-t border-[#1a1a1a] pt-4 min-w-0">
                    <p className="text-[10px] font-bold text-[#666666] uppercase tracking-wider">Activity & Turn Balance</p>

                    {/* Video Evidence Progress Bar */}
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex justify-between items-center text-xs font-semibold gap-2">
                        <span className="text-[#888888] truncate">Answers with Video References</span>
                        <span className="text-white font-mono text-xs flex-shrink-0">{stats.rag_grounding_rate ?? 0}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-[#1e1e1e] rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-white rounded-full transition-all duration-1000" 
                          style={{ width: `${Math.min(stats.rag_grounding_rate ?? 0, 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Query vs Answer Ratio */}
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex justify-between items-center text-xs font-semibold gap-2">
                        <span className="text-[#888888] truncate">User Questions vs AI Turns</span>
                        <span className="text-white font-mono text-xs flex-shrink-0">
                          {stats.total_user_messages ?? 0} : {stats.total_assistant_messages ?? 0}
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-[#1e1e1e] rounded-full overflow-hidden flex">
                        <div 
                          className="h-full bg-[#999999] transition-all duration-1000" 
                          style={{ 
                            width: (stats.total_chat_messages ?? 0) > 0 
                              ? `${((stats.total_user_messages ?? 0) / stats.total_chat_messages) * 100}%` 
                              : '50%' 
                          }}
                          title="User queries"
                        />
                        <div 
                          className="h-full bg-[#444444] transition-all duration-1000" 
                          style={{ 
                            width: (stats.total_chat_messages ?? 0) > 0 
                              ? `${((stats.total_assistant_messages ?? 0) / stats.total_chat_messages) * 100}%` 
                              : '50%' 
                          }}
                          title="AI responses"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column: Top Discussed Videos & Scope Distribution */}
                <div className="space-y-5 sm:space-y-6 flex flex-col justify-between min-w-0">
                  {/* Top Discussed Videos */}
                  <div className="border border-[#222222] bg-[#111111] p-5 sm:p-6 rounded-2xl space-y-4 flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-[#888888] flex items-center gap-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                        <Film size={15} className="text-white" /> Top Discussed Videos in Chat
                      </h3>
                      {topDiscussedVideos.length > 0 && (
                        <span className="text-[10px] font-mono text-[#555555]">
                          {topDiscussedVideos.length} {topDiscussedVideos.length === 1 ? 'video' : 'videos'}
                        </span>
                      )}
                    </div>
                    {topDiscussedVideos.length === 0 ? (
                      <p className="text-xs text-[#555555] py-4 text-center">No video-scoped chats created yet.</p>
                    ) : (
                      <div className="space-y-3.5 min-w-0">
                        {(() => {
                          const maxCount = topDiscussedVideos.reduce((max, v) => Math.max(max, v.chat_count), 1)
                          return topDiscussedVideos.map((vid, idx) => (
                            <div 
                              key={`${vid.title}-${idx}`} 
                              className="rounded-xl border border-[#222222] bg-[#141414] p-3.5 sm:p-4 hover:border-[#383838] transition-all space-y-3 min-w-0 group"
                            >
                              <div className="flex items-start justify-between gap-3 min-w-0">
                                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                                  <span className="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-lg text-xs font-mono font-bold flex-shrink-0 mt-0.5 bg-[#181818] text-white border border-[#2c2c2c]">
                                    #{idx + 1}
                                  </span>
                                  <div className="min-w-0 flex-1 space-y-1">
                                    <h4 className="text-xs sm:text-sm font-semibold text-white truncate leading-snug" title={vid.title}>
                                      {vid.title}
                                    </h4>
                                    {vid.channel && (
                                      <p className="text-[11px] text-[#777777] font-medium flex items-center gap-1.5 truncate">
                                        <Film size={11} className="text-[#555555] flex-shrink-0" />
                                        <span className="truncate">{vid.channel}</span>
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <span className="flex-shrink-0 rounded-md bg-[#181818] border border-[#2a2a2a] px-2.5 py-1 text-[11px] font-mono font-bold text-white">
                                  {vid.chat_count} {vid.chat_count === 1 ? 'chat' : 'chats'}
                                </span>
                              </div>

                              {/* Visual Progress Bar (Black and White) */}
                              <div className="h-1.5 w-full bg-[#1e1e1e] rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-white rounded-full transition-all duration-700" 
                                  style={{ width: `${(vid.chat_count / maxCount) * 100}%` }}
                                />
                              </div>
                            </div>
                          ))
                        })()}
                      </div>
                    )}
                  </div>

                  {/* Scope Mode Breakdown */}
                  <div className="border border-[#222222] bg-[#111111] p-5 sm:p-6 rounded-2xl space-y-4 min-w-0">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#888888] flex items-center gap-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                      <Layers size={15} className="text-white" /> Conversation Scope Breakdown
                    </h3>
                    {chatScopeDistribution.length === 0 ? (
                      <p className="text-xs text-[#555555] py-4 text-center">No chat scopes recorded yet.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2 min-w-0">
                        {chatScopeDistribution.map((scopeItem) => (
                          <div 
                            key={scopeItem.scope} 
                            className="flex items-center gap-2 bg-[#161616] border border-[#282828] hover:border-[#444444] hover:bg-[#202020] px-3 py-2 rounded-xl text-xs transition-colors max-w-full min-w-0"
                          >
                            <span className="text-[#cccccc] font-medium truncate max-w-[150px] xs:max-w-[220px] sm:max-w-none">{scopeLabel(scopeItem.scope)}</span>
                            <span className="bg-[#242424] text-[10px] text-white font-mono font-bold px-2 py-0.5 rounded-md flex-shrink-0 border border-[#333333]">
                              {scopeItem.count} {scopeItem.count === 1 ? 'thread' : 'threads'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>
      ) : null}
    </section>
  )
}

export default Profile
