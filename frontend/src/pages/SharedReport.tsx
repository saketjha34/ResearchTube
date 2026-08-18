import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getSharedEntry, type HistoryItem } from '../api/research'
import { ReportView } from './Research'
import { Loader2, AlertCircle } from 'lucide-react'

export function SharedReport() {
  const { runId } = useParams<{ runId: string }>()
  const [report, setReport] = useState<HistoryItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!runId) return
    const fetchReport = async () => {
      try {
        setLoading(true)
        const data = await getSharedEntry(runId)
        setReport(data)
      } catch (e: any) {
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
  }, [runId])

  return (
    <div className="min-h-screen bg-black text-white selection:bg-white selection:text-black">
      {/* Navbar */}
      <header className="border-b border-[#181818] bg-black/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="text-xs font-bold tracking-[0.35em] text-white hover:text-[#cccccc] transition-colors">
            RESEARCHTUBE
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-[10px] font-bold tracking-[0.2em] text-[#666666] uppercase bg-[#111111] px-3 py-1 rounded-full border border-[#222222]">
              Shared Report
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-12 md:py-20">
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
    </div>
  )
}
