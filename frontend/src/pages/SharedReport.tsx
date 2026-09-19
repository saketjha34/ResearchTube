import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { getSharedEntry, type HistoryItem } from '../api/research'
import { getPublicSharedChat } from '../api/chat'
import { getAccessToken } from '../api/auth'
import { ReportView } from './Research'
import {
  Loader2,
  AlertCircle,
  Sparkles,
  ArrowRight,
  Copy,
  Check,
  LogIn,
  UserPlus,
  X,
} from 'lucide-react'

export function SharedReport() {
  const { runId, id } = useParams<{ runId?: string; id?: string }>()
  const targetId = runId || id
  const navigate = useNavigate()

  const [report, setReport] = useState<HistoryItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copiedLink, setCopiedLink] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)

  const isAuthenticated = Boolean(getAccessToken())

  useEffect(() => {
    if (!targetId) return
    const fetchReport = async () => {
      try {
        setLoading(true)
        const data = await getSharedEntry(targetId)
        setReport(data)
      } catch (e: any) {
        // Fallback: Check if this token belongs to a shared chat
        try {
          const chatData = await getPublicSharedChat(targetId)
          if (chatData?.id) {
            navigate(`/share/chat/${targetId}`, { replace: true })
            return
          }
        } catch {
          // Not a shared chat either
        }

        if (e.response?.status === 404 || e.response?.status === 403) {
          setError("This report is either private or doesn't exist.")
        } else {
          setError("Failed to load the shared report.")
        }
      } finally {
        setLoading(false)
      }
    }
    void fetchReport()
  }, [targetId, navigate])

  const handleStartResearch = () => {
    if (!report) return

    if (!isAuthenticated) {
      setShowAuthModal(true)
      return
    }

    navigate(`/research?q=${encodeURIComponent(report.query)}`)
  }

  const handleCopyLink = () => {
    void navigator.clipboard.writeText(window.location.href).then(() => {
      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), 2000)
    })
  }

  return (
    <div className="min-h-screen bg-black text-white selection:bg-white selection:text-black flex flex-col">
      {/* Top Header Bar */}
      <header className="sticky top-0 z-40 border-b border-[#1c1c1c] bg-black/90 backdrop-blur-md px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            to="/"
            className="flex items-center gap-2 text-xs font-bold tracking-wider text-white hover:text-zinc-300 transition-colors flex-shrink-0"
          >
            <span>ResearchTube AI</span>
          </Link>

          {report && (
            <>
              <span className="text-[#333333] hidden sm:inline">/</span>
              <div className="min-w-0">
                <h1 className="text-sm font-semibold text-white truncate max-w-xs sm:max-w-md">
                  {report.query}
                </h1>
                <p className="text-[10px] text-[#666666] truncate">
                  Shared {new Date(report.completed_at || report.created_at).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })} &bull; {report.video_count} videos analyzed
                </p>
              </div>
            </>
          )}
        </div>

        {/* Header Actions */}
        {report && (
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 rounded-lg border border-[#262626] bg-[#121212] px-3 py-1.5 text-xs font-medium text-[#aaaaaa] hover:border-[#444444] hover:text-white transition-all"
              title="Copy shared link"
            >
              {copiedLink ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
              <span className="hidden md:inline">{copiedLink ? 'Copied' : 'Copy link'}</span>
            </button>

            <button
              onClick={handleStartResearch}
              className="flex items-center gap-2 rounded-lg bg-white px-4 py-1.5 text-xs font-bold text-black hover:bg-zinc-200 transition-all shadow-md"
            >
              <Sparkles size={14} />
              <span>Start your own research</span>
            </button>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 md:py-12 pb-32">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-[#666666] space-y-4 animate-pulse">
            <Loader2 size={32} className="animate-spin text-[#888888]" />
            <p className="text-sm font-medium tracking-wide uppercase">Loading Report...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-6">
            <div className="h-16 w-16 bg-[#1a1a1a] rounded-full flex items-center justify-center border border-[#333333]">
              <AlertCircle size={24} className="text-[#ff4444]" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Access Denied</h2>
              <p className="text-[#888888] text-sm max-w-sm">{error}</p>
            </div>
            <Link to="/" className="px-6 py-2.5 bg-white text-black text-xs font-bold uppercase tracking-wider rounded-full hover:bg-[#e0e0e0] transition-colors mt-4">
              Go to Home
            </Link>
          </div>
        ) : report ? (
          <div className="space-y-12 animate-fade-in">
            {/* Header section */}
            <div className="space-y-6 text-center border-b border-[#222222] pb-12">
              <h1 className="text-3xl md:text-5xl font-bold leading-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                {report.query}
              </h1>
              <div className="flex items-center justify-center gap-4 text-xs font-bold text-[#666666] uppercase tracking-wider">
                <span>{new Date(report.completed_at || report.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                <span className="w-1 h-1 rounded-full bg-[#333333]" />
                <span>{report.video_count} videos analyzed</span>
              </div>
            </div>

            {/* Re-use ReportView */}
            <ReportView report={report} query={report.query} />
          </div>
        ) : null}
      </main>

      {/* Bottom Floating Action Bar */}
      {report && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 w-full max-w-lg px-4">
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-[#2a2a2a] bg-[#141417]/95 px-5 py-3.5 shadow-2xl backdrop-blur-md">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-black font-bold">
                <Sparkles size={16} />
              </div>
              <div>
                <p className="text-xs font-bold text-white">Start your own research</p>
                <p className="text-[11px] text-[#888888]">Run deep AI research across YouTube videos</p>
              </div>
            </div>

            <button
              onClick={handleStartResearch}
              className="flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-xs font-bold text-black hover:bg-zinc-200 transition-all shadow-md"
            >
              <span>Start research</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </div>
      )}

      {/* Sign In / Sign Up Modal for Unauthenticated Users */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-sm rounded-2xl border border-[#262626] bg-[#111111] p-6 shadow-2xl space-y-4 relative">
            <button
              onClick={() => setShowAuthModal(false)}
              className="absolute right-4 top-4 text-[#888888] hover:text-white transition-colors"
            >
              <X size={16} />
            </button>

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1e1e1e] border border-[#2a2a2a] text-white">
              <Sparkles size={20} />
            </div>

            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Start Your Own Research
              </h2>
              <p className="mt-1 text-xs text-[#888888] leading-relaxed">
                Sign in or create a free account to explore deep YouTube research with AI-powered synthesis, learning paths, and video transcripts.
              </p>
            </div>

            <div className="pt-2 space-y-2">
              <button
                onClick={() => {
                  navigate(`/login?redirect=${encodeURIComponent(`/research?q=${encodeURIComponent(report?.query || '')}`)}`)
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-2.5 text-xs font-bold text-black hover:bg-zinc-200 transition-colors"
              >
                <LogIn size={14} />
                <span>Log in</span>
              </button>

              <button
                onClick={() => {
                  navigate(`/register?redirect=${encodeURIComponent(`/research?q=${encodeURIComponent(report?.query || '')}`)}`)
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] py-2.5 text-xs font-semibold text-white hover:bg-[#252525] transition-colors"
              >
                <UserPlus size={14} />
                <span>Sign up</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
