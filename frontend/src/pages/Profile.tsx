import { useEffect, useMemo, useState, type FormEvent } from 'react'
import client from '../api/client'
import Button from '../components/Button'
import Input from '../components/Input'
import { detectAuthProvider, getAuthSession, persistAuthSession } from '../api/auth'
import { useAuth } from '../context/AuthContext'
import { 
  BarChart2, 
  Play, 
  Cpu, 
  BookOpen, 
  Hourglass, 
  Video, 
  Layers, 
  Award, 
  CheckCircle2, 
  XCircle, 
  Loader2,
  Sparkles,
  Compass,
  RefreshCw
} from 'lucide-react'

const STATS_CACHE_KEY = 'rt_user_analytics_stats'

function Profile() {
  const { user, logout } = useAuth()
  const provider = useMemo(() => detectAuthProvider(user), [user])

  // --- Research Analytics State ---
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
          // If parse fails, clear invalid cache and proceed to fetch
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
    } catch (err) {
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

  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')

  const [profileLoading, setProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [profileMessage, setProfileMessage] = useState('')

  const [passwordModalOpen, setPasswordModalOpen] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')

  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordMessage, setPasswordMessage] = useState('')

  useEffect(() => {
    setFullName(user?.full_name ?? '')
    setUsername(user?.username ?? '')
  }, [user])

  const handleProfileUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setProfileError('')
    setProfileMessage('')

    setProfileLoading(true)

    try {
      const response = await client.patch('/auth/me', {
        full_name: fullName,
        username,
      })

      const session = getAuthSession()

      if (session) {
        persistAuthSession({
          ...session,
          user: response.data,
        })
      }

      setProfileMessage('Profile updated successfully.')
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'response' in error) {
        const apiError = error as {
          response?: {
            data?: {
              detail?: string
            }
          }
        }

        setProfileError(apiError.response?.data?.detail || 'Unable to update profile.')
      } else {
        setProfileError('Unable to update profile.')
      }
    } finally {
      setProfileLoading(false)
    }
  }

  const handlePasswordChange = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPasswordError('')
    setPasswordMessage('')

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      setPasswordError('Please complete all password fields.')
      return
    }

    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long.')
      return
    }

    if (newPassword !== confirmNewPassword) {
      setPasswordError('New passwords do not match.')
      return
    }

    setPasswordLoading(true)

    try {
      await client.post('/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      })

      setCurrentPassword('')
      setNewPassword('')
      setConfirmNewPassword('')
      setPasswordMessage('Password updated successfully.')
      setPasswordModalOpen(false)
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'response' in error) {
        const apiError = error as {
          response?: {
            data?: {
              detail?: string
            }
          }
        }

        setPasswordError(apiError.response?.data?.detail || 'Unable to change password.')
      } else {
        setPasswordError('Unable to change password.')
      }
    } finally {
      setPasswordLoading(false)
    }
  }

  // --- Delete Account ---
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deleteAccountLoading, setDeleteAccountLoading] = useState(false)
  const [deleteAccountError, setDeleteAccountError] = useState('')

  const handleDeleteAccount = async () => {
    setDeleteAccountError('')
    setDeleteAccountLoading(true)
    try {
      await client.delete('/user/account')
      localStorage.removeItem(STATS_CACHE_KEY)
      setDeleteModalOpen(false)
      await logout()
    } catch (error) {
      setDeleteAccountError('Failed to delete account. Please try again later.')
    } finally {
      setDeleteAccountLoading(false)
    }
  }

  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold">Profile</h1>
        <p className="mt-2 text-sm text-[#999999]">Your account and identity details.</p>
      </header>

      <div className="border border-[#222222] bg-[#111111] p-6">
        <dl className="grid gap-4 text-sm md:grid-cols-2">
          <div>
            <dt className="text-[#999999]">Full name</dt>
            <dd className="mt-1 text-white">{user?.full_name || 'Not set'}</dd>
          </div>
          <div>
            <dt className="text-[#999999]">Username</dt>
            <dd className="mt-1 text-white">{user?.username || 'Not set'}</dd>
          </div>
          <div>
            <dt className="text-[#999999]">Email</dt>
            <dd className="mt-1 text-white">{user?.email}</dd>
          </div>
          <div>
            <dt className="text-[#999999]">Status</dt>
            <dd className="mt-1 text-white">{user?.is_active ? 'Active' : 'Inactive'}</dd>
          </div>
          <div>
            <dt className="text-[#999999]">Provider</dt>
            <dd className="mt-1 text-white">{provider}</dd>
          </div>
        </dl>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <form className="space-y-4 border border-[#222222] bg-[#111111] p-6" onSubmit={handleProfileUpdate}>
          <h2 className="text-xl">Update Profile</h2>
          <p className="text-sm text-[#999999]">Update your public account information.</p>

          {profileError ? (
            <p className="border border-[#222222] bg-black px-3 py-2 text-xs text-[#cfcfcf]">
              {profileError}
            </p>
          ) : null}

          {profileMessage ? (
            <p className="border border-[#222222] bg-black px-3 py-2 text-xs text-[#cfcfcf]">
              {profileMessage}
            </p>
          ) : null}

          <Input
            label="Full name"
            type="text"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
          />

          <Input
            label="Username"
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Set a unique username"
          />

          <Button type="submit" loading={profileLoading} className="cursor-pointer">
            {profileLoading ? 'Saving profile...' : 'Save profile'}
          </Button>
        </form>

        <div className="border border-[#222222] bg-[#111111] p-6">
          <h2 className="text-xl">Security</h2>
          <p className="mt-2 text-sm text-[#999999]">Keep your account protected.</p>

          {passwordMessage ? (
            <p className="mt-4 border border-[#222222] bg-black px-3 py-2 text-xs text-[#cfcfcf]">
              {passwordMessage}
            </p>
          ) : null}

          <div className="mt-6">
            <Button
              type="button"
              variant="secondary"
              className="cursor-pointer"
              onClick={() => setPasswordModalOpen(true)}
            >
              Change password
            </Button>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="border border-red-950/30 bg-[#111111] p-6 rounded-xl hover:border-red-900/40 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl text-red-500 font-semibold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Danger Zone</h2>
          <p className="text-sm text-[#999999] mt-1">Permanently delete your ResearchTube account and all research history. This is irreversible.</p>
        </div>
        <div>
          <button
            type="button"
            className="bg-red-600 hover:bg-red-700 text-white cursor-pointer px-6 py-2.5 font-semibold text-sm transition-all rounded-lg whitespace-nowrap"
            onClick={() => setDeleteModalOpen(true)}
          >
            Delete Account
          </button>
        </div>
      </div>

      {passwordModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-lg rounded-md border border-[#222222] bg-[#111111] p-6">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h3 className="text-2xl font-semibold">Change password</h3>
                <p className="mt-1 text-sm text-[#999999]">Update your account security.</p>
              </div>
              <button
                type="button"
                className="cursor-pointer rounded-md border border-[#222222] px-2 py-1 text-sm text-[#999999] hover:text-white"
                onClick={() => setPasswordModalOpen(false)}
              >
                Close
              </button>
            </div>

            <form className="space-y-4" onSubmit={handlePasswordChange}>
              {passwordError ? (
                <p className="border border-[#222222] bg-black px-3 py-2 text-xs text-[#cfcfcf]">
                  {passwordError}
                </p>
              ) : null}

              <Input
                label="Current password"
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                placeholder="Enter current password"
              />

              <Input
                label="New password"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="Enter new password"
              />

              <Input
                label="Confirm new password"
                type="password"
                value={confirmNewPassword}
                onChange={(event) => setConfirmNewPassword(event.target.value)}
                placeholder="Confirm new password"
              />

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  className="cursor-pointer rounded-md border border-[#222222] px-4 py-2.5 text-sm text-[#999999] hover:text-white"
                  onClick={() => setPasswordModalOpen(false)}
                >
                  Cancel
                </button>
                <Button type="submit" variant="primary" loading={passwordLoading} className="cursor-pointer">
                  {passwordLoading ? 'Updating password...' : 'Update password'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* --- Research Analytics Section --- */}
      <section className="space-y-6 pt-6 border-t border-[#222222]">
        <header className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-2xl font-semibold flex items-center gap-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              <BarChart2 className="text-purple-400" size={24} /> Research Analytics
            </h2>
            <p className="text-sm text-[#999999]">Aggregated insights compiled from your YouTube research runs.</p>
          </div>
          <button
            onClick={() => void fetchStats(true)}
            disabled={statsLoading || statsRefreshing}
            className="flex items-center gap-1.5 border border-[#222222] bg-[#111111] hover:border-[#444444] hover:text-white px-3.5 py-1.5 text-xs text-[#888888] font-bold rounded-lg transition-all disabled:opacity-50 cursor-pointer"
            title="Refresh Analytics Stats"
          >
            <RefreshCw size={13} className={statsRefreshing ? "animate-spin text-purple-400" : ""} />
            <span>{statsRefreshing ? 'REFRESHING...' : 'REFRESH'}</span>
          </button>
        </header>

        {statsLoading ? (
          <div className="border border-[#222222] bg-[#111111] p-12 flex flex-col items-center justify-center gap-3">
            <Loader2 className="animate-spin text-purple-400" size={32} />
            <p className="text-xs text-[#999999]">Calculating your research statistics...</p>
          </div>
        ) : statsError ? (
          <div className="border border-red-955 bg-red-950/10 p-6 flex items-center gap-3">
            <XCircle className="text-red-500" size={20} />
            <p className="text-sm text-red-200">{statsError}</p>
          </div>
        ) : stats ? (
          <div className="space-y-6">
            {/* Overview Stats Cards */}
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
              <div className="border border-[#222222] bg-[#111111] p-5 rounded-xl hover:border-purple-900/50 transition-all group">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-[#666666] uppercase tracking-wider">Total Queries</span>
                  <Sparkles size={16} className="text-[#666666] group-hover:text-purple-400 transition-colors" />
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-3xl font-semibold text-white">{stats.total_research_runs}</span>
                  <span className="text-xs text-[#555555]">runs</span>
                </div>
              </div>

              <div className="border border-[#222222] bg-[#111111] p-5 rounded-xl hover:border-green-950/50 transition-all group">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-[#666666] uppercase tracking-wider">Completed</span>
                  <CheckCircle2 size={16} className="text-[#666666] group-hover:text-green-400 transition-colors" />
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-3xl font-semibold text-white">{stats.completed_research_runs}</span>
                  <span className="text-xs text-[#555555]">success</span>
                </div>
              </div>

              <div className="border border-[#222222] bg-[#111111] p-5 rounded-xl hover:border-[#333333] transition-all group">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-[#666666] uppercase tracking-wider">Videos Analyzed</span>
                  <Video size={16} className="text-[#666666] group-hover:text-cyan-400 transition-colors" />
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-3xl font-semibold text-white">{stats.total_videos_analyzed}</span>
                  <span className="text-xs text-[#555555]">videos</span>
                </div>
              </div>

              <div className="border border-[#222222] bg-[#111111] p-5 rounded-xl hover:border-[#333333] transition-all group">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-[#666666] uppercase tracking-wider">Audience Reach</span>
                  <Layers size={16} className="text-[#666666] group-hover:text-yellow-500 transition-colors" />
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-3xl font-semibold text-white">{formatNumber(stats.total_views_analyzed)}</span>
                  <span className="text-xs text-[#555555]">views</span>
                </div>
              </div>
            </div>

            {/* Performance Metrics & Quality Scores */}
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="border border-[#222222] bg-[#111111] p-6 rounded-xl space-y-6">
                <h3 className="text-sm font-bold uppercase tracking-wider text-[#666666] flex items-center gap-1.5" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  <Compass size={14} className="text-purple-400" /> Pipeline Performance
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-black/60 p-4 rounded-lg border border-[#222222]">
                    <p className="text-[10px] font-bold text-[#555555] uppercase tracking-wider">Avg Videos / Run</p>
                    <p className="text-xl font-bold text-white mt-1">{stats.average_videos_per_run}</p>
                  </div>
                  <div className="bg-black/60 p-4 rounded-lg border border-[#222222]">
                    <p className="text-[10px] font-bold text-[#555555] uppercase tracking-wider">Channels Discovered</p>
                    <p className="text-xl font-bold text-white mt-1">{stats.total_channels_discovered}</p>
                  </div>
                  <div className="bg-black/60 p-4 rounded-lg border border-[#222222]">
                    <p className="text-[10px] font-bold text-[#555555] uppercase tracking-wider">Vector Chunks</p>
                    <p className="text-xl font-bold text-purple-400 mt-1">{stats.total_transcript_chunks}</p>
                  </div>
                  <div className="bg-black/60 p-4 rounded-lg border border-[#222222]">
                    <p className="text-[10px] font-bold text-[#555555] uppercase tracking-wider">Beginner Friendly</p>
                    <p className="text-xl font-bold text-green-400 mt-1">{stats.total_beginner_friendly_videos}</p>
                  </div>
                </div>

                {/* Score Averages Progress Bars */}
                <div className="space-y-4 border-t border-[#1a1a1a] pt-4">
                  <p className="text-[10px] font-bold text-[#555555] uppercase tracking-wider">Average RAG Metrics</p>
                  
                  {/* Relevance */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-[#999999]">Relevance Score</span>
                      <span className="text-white">{stats.average_relevance_score} / 10</span>
                    </div>
                    <div className="h-1.5 w-full bg-black rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all duration-1000" 
                        style={{ width: `${stats.average_relevance_score * 10}%` }}
                      />
                    </div>
                  </div>

                  {/* Educational Quality */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-[#999999]">Educational Quality</span>
                      <span className="text-white">{stats.average_educational_score} / 10</span>
                    </div>
                    <div className="h-1.5 w-full bg-black rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-1000" 
                        style={{ width: `${stats.average_educational_score * 10}%` }}
                      />
                    </div>
                  </div>

                  {/* Coverage */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-[#999999]">Topic Coverage</span>
                      <span className="text-white">{stats.average_coverage_score} / 10</span>
                    </div>
                    <div className="h-1.5 w-full bg-black rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-1000" 
                        style={{ width: `${stats.average_coverage_score * 10}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Insights Columns */}
              <div className="space-y-6">
                {/* Top Recommended Channels */}
                <div className="border border-[#222222] bg-[#111111] p-6 rounded-xl space-y-4 flex-1">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-[#666666] flex items-center gap-1.5" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                    <Award size={14} className="text-yellow-500" /> Top Recommended Channels
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
                            <div className="h-1.5 w-full bg-black rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-yellow-500/80 rounded-full" 
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
                <div className="border border-[#222222] bg-[#111111] p-6 rounded-xl space-y-4 flex-1">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-[#666666] flex items-center gap-1.5" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                    <BookOpen size={14} className="text-purple-400" /> Top Research Concepts
                  </h3>
                  {stats.top_concepts.length === 0 ? (
                    <p className="text-xs text-[#555555] py-4 text-center">No research reports analyzed yet.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {stats.top_concepts.map((concept) => (
                        <div 
                          key={concept.concept} 
                          className="flex items-center gap-2 bg-[#171717] border border-[#222222] hover:border-purple-900/50 hover:bg-purple-950/10 px-3 py-1.5 rounded-lg text-xs transition-colors"
                        >
                          <span className="text-[#cccccc] font-medium">{concept.concept}</span>
                          <span className="bg-[#222222] text-[10px] text-purple-400 font-bold px-1.5 py-0.5 rounded-md">
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

      {/* Delete Account Modal */}
      {deleteModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md rounded-xl border border-red-900 bg-[#111111] p-6 space-y-4">
            <h3 className="text-xl font-bold text-red-500" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Delete Account?</h3>
            <p className="text-sm text-[#888888] leading-relaxed">
              Are you absolutely sure you want to delete your account? This will permanently wipe out all your saved research runs, recommended summaries, and custom settings. This action cannot be undone.
            </p>
            {deleteAccountError ? (
              <p className="border border-red-955 bg-red-955/20 px-3 py-2 text-xs text-red-400 rounded-md">
                {deleteAccountError}
              </p>
            ) : null}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                className="cursor-pointer rounded-full bg-[#2a2a2a] text-white hover:bg-[#3a3a3a] px-5 py-2 text-xs font-bold tracking-wider uppercase transition-all"
                onClick={() => {
                  setDeleteModalOpen(false)
                  setDeleteAccountError('')
                }}
                disabled={deleteAccountLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="cursor-pointer rounded-full bg-red-600 text-white hover:bg-red-700 px-5 py-2 text-xs font-bold tracking-wider uppercase transition-all disabled:opacity-50"
                onClick={handleDeleteAccount}
                disabled={deleteAccountLoading}
              >
                {deleteAccountLoading ? 'Deleting...' : 'Delete permanently'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}

export default Profile
