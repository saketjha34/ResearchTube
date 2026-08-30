import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowUp, Loader2, Play, BookOpen, Target, TrendingUp, CheckCircle, AlertCircle, ChevronDown, ChevronUp, ExternalLink, Copy, Check, Search, X as XIcon } from 'lucide-react'
import { runResearch, getHistoryEntry, type ResearchResponse, type HistoryItem } from '../api/research'
import { useToast, ToastContainer } from '../components/Toast'
import KnowledgeGraph from '../components/KnowledgeGraph'
import { Onboarding } from '../components/Onboarding'

const GREETINGS = [
  "What rabbit hole are we exploring today?",
  "Ready to level up your tech stack?",
  "What are we re-engineering today?",
  "Fire up the compiler. What are we building?",
  "What's on your deep-dive radar?",
];

const PLACEHOLDER_TOPICS = [
  "Best resources to master low-level Rust systems",
  "Building multi-agent workflows with LangGraph & LangChain",
  "Designing high-throughput distributed systems",
  "Fine-tuning open-source LLMs locally on consumer GPUs",
  "Breaking down real-world Zero-Knowledge proof implementations",
  "Optimizing CUDA kernels for deep learning inference",
  "Best roadmaps to transition into AI engineering",
  "Cracking large-scale system design interviews",
];

function useTypingEffect(items: string[], speed = 55, pause = 2200) {
  const [text, setText] = useState('')
  const [idx, setIdx] = useState(0)
  const [phase, setPhase] = useState<'typing' | 'erasing'>('typing')
  const charRef = useRef(0)
  useEffect(() => {
    const current = items[idx % items.length]
    if (phase === 'typing') {
      if (charRef.current < current.length) {
        const t = setTimeout(() => { charRef.current++; setText(current.slice(0, charRef.current)) }, speed)
        return () => clearTimeout(t)
      } else {
        const t = setTimeout(() => setPhase('erasing'), pause)
        return () => clearTimeout(t)
      }
    }
    if (phase === 'erasing') {
      if (charRef.current > 0) {
        const t = setTimeout(() => { charRef.current--; setText(current.slice(0, charRef.current)) }, speed / 2)
        return () => clearTimeout(t)
      } else { setIdx((i) => i + 1); setPhase('typing') }
    }
  }, [text, phase, idx, items, speed, pause])
  return text
}

const LOADING_STATUSES = [
  "Firing up the pipeline agents...",
  "Searching YouTube for the best video matches...",
  "Filtering videos by relevance and quality metrics...",
  "Extracting audio transcripts from matches...",
  "Chunking transcripts and parsing timestamp metadata...",
  "Generating dense embeddings using AI models...",
  "Structuring vector databases for deep context retrieval...",
  "Running multi-agent RAG queries on video content...",
  "Evaluating educational quality and coverage scores...",
  "Structuring beginner-friendly recommendations...",
  "Synthesizing the executive summary and key takeaways...",
  "Mapping out step-by-step learning paths...",
  "Compiling strengths, weaknesses, and key concepts...",
  "Finalizing formatting and rendering report..."
]

function useLoadingStatus(statuses: string[], interval = 3500) {
  const [index, setIndex] = useState(0)
  const [fade, setFade] = useState(true)
  useEffect(() => {
    const t = setInterval(() => {
      setFade(false)
      setTimeout(() => {
        setIndex((prev) => (prev + 1) % statuses.length)
        setFade(true)
      }, 300)
    }, interval)
    return () => clearInterval(t)
  }, [statuses, interval])
  return { status: statuses[index], fade }
}

// Copy Button
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        })
      }}
      title="Copy to clipboard"
      className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold tracking-[0.15em] border border-[#222222] text-[#555555] hover:border-[#444444] hover:text-white transition-all rounded-md flex-shrink-0"
    >
      {copied ? <Check size={10} /> : <Copy size={10} />}
      {copied ? 'COPIED' : 'COPY'}
    </button>
  )
}

// Text Highlighter
function Highlight({ text, query }: { text: string; query: string }) {
  if (!query.trim() || !text) return <>{text}</>
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'))
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} style={{ background: 'rgba(250,204,21,0.25)', color: '#fde68a', borderRadius: '2px', padding: '0 2px' }}>{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  )
}

// Pulsing Gray Skeleton Box Loader for Toggling Past Research Runs
function ReportSkeletonLoader() {
  return (
    <div className="space-y-10 animate-fade-in">
      {/* Top right user query pill skeleton */}
      <div className="flex justify-end">
        <div className="w-72 h-14 border border-[#222222] bg-[#111111] animate-pulse flex items-center px-6">
          <div className="h-4 w-48 bg-zinc-800/80 rounded" />
        </div>
      </div>

      {/* Executive Summary Skeleton */}
      <div className="border border-[#222222] bg-[#111111] p-8 space-y-4 animate-pulse">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-5 w-5 bg-zinc-800/80 rounded" />
          <div className="h-3 w-40 bg-zinc-800/80 rounded" />
        </div>
        <div className="h-4 w-full bg-zinc-800/60 rounded" />
        <div className="h-4 w-11/12 bg-zinc-800/60 rounded" />
        <div className="h-4 w-4/5 bg-zinc-800/60 rounded" />
        <div className="h-4 w-2/3 bg-zinc-800/60 rounded" />
      </div>

      {/* Interactive Knowledge Graph Skeleton */}
      <div className="border border-[#222222] bg-[#111111] p-8 space-y-4 animate-pulse">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-5 w-5 bg-zinc-800/80 rounded" />
          <div className="h-3 w-48 bg-zinc-800/80 rounded" />
        </div>
        <div className="h-64 w-full border border-dashed border-zinc-800 bg-zinc-950/50 rounded-xl flex items-center justify-center relative overflow-hidden">
          <div className="h-16 w-16 rounded-full bg-zinc-800/70 border border-zinc-700 animate-pulse" />
          <div className="absolute top-1/4 left-1/4 h-12 w-12 rounded-full bg-zinc-800/50 border border-zinc-800 animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 h-12 w-12 rounded-full bg-zinc-800/50 border border-zinc-800 animate-pulse" />
        </div>
      </div>

      {/* Recommended Resources Skeleton Cards */}
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 bg-zinc-800/80 rounded" />
          <div className="h-3 w-52 bg-zinc-800/80 rounded" />
        </div>
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="border border-[#222222] bg-[#111111] p-6 space-y-4 animate-pulse">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <div className="h-5 w-3/4 bg-zinc-800/80 rounded" />
                  <div className="h-3 w-1/4 bg-zinc-800/50 rounded" />
                  <div className="h-4 w-full bg-zinc-800/40 rounded mt-2" />
                </div>
                <div className="h-10 w-14 bg-zinc-800/80 rounded" />
              </div>
              <div className="grid grid-cols-3 gap-6 pt-4 border-t border-[#1a1a1a]">
                <div className="h-3 bg-zinc-800/60 rounded" />
                <div className="h-3 bg-zinc-800/60 rounded" />
                <div className="h-3 bg-zinc-800/60 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ScoreBar({ label, value }: { label: string; value: number | null | undefined }) {
  const v = value ?? 0
  const pct = Math.round((v / 10) * 100)
  const color = pct >= 80 ? '#22c55e' : pct >= 60 ? '#eab308' : '#ef4444'
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[10px] tracking-[0.2em] font-bold text-[#555555]">{label.toUpperCase()}</span>
        <span className="text-xs font-bold text-white">{v.toFixed(1)}</span>
      </div>
      <div className="h-1 rounded-full bg-[#222222] overflow-hidden">
        <div className="h-full rounded-full" style={{ width: pct + '%', backgroundColor: color, transition: 'width 0.7s ease' }} />
      </div>
    </div>
  )
}

function ResourceCard({ res, rank }: { res: RecommendedResource; rank: number }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border border-[#222222] bg-[#111111] overflow-hidden transition-all hover:border-[#333333]">
      <div className="p-6">
        <div className="flex items-start gap-4">
          <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center border border-[#333333] bg-black text-sm font-bold text-[#666666]">
            {rank}
          </span>
          <div className="flex-1 min-w-0">
            <a href={res.url} target="_blank" rel="noreferrer" className="text-base font-bold text-white hover:text-[#cccccc] transition-colors line-clamp-2 leading-snug">
              {res.title}
            </a>
            {res.channel && <p className="mt-1.5 text-xs font-bold tracking-[0.2em] text-[#555555]">{res.channel.toUpperCase()}</p>}
            {res.description && <p className="mt-3 text-sm text-[#888888] line-clamp-2 leading-relaxed">{res.description}</p>}
          </div>
          <div className="flex-shrink-0 text-right pl-4">
            <p className="text-3xl font-bold text-white" style={{fontFamily:"'Space Grotesk',sans-serif"}}>{(res.overall_score ?? 0).toFixed(1)}</p>
            <p className="text-[10px] font-bold tracking-[0.2em] text-[#555555]">/ 10</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-6">
          <ScoreBar label="Relevance" value={res.relevance_score} />
          <ScoreBar label="Education" value={res.educational_quality_score} />
          <ScoreBar label="Coverage" value={res.coverage_score} />
        </div>

        <div className="mt-5 flex items-center gap-3">
          {res.beginner_friendly && (
            <span className="inline-flex items-center gap-1.5 border border-[#1a3a1a] bg-[#0a1a0a] px-3 py-1 text-xs font-bold tracking-[0.15em] text-green-400">
              <CheckCircle size={11} /> BEGINNER FRIENDLY
            </span>
          )}
          {res.transcript_available !== undefined && (
            <span className={`inline-flex items-center gap-1.5 border px-3 py-1 text-xs font-bold tracking-[0.15em] ${res.transcript_available ? 'border-[#1a2a3a] bg-[#0a0f1a] text-blue-400' : 'border-[#222222] text-[#555555]'}`}>
              {res.transcript_available ? 'TRANSCRIPT AVAILABLE' : 'NO TRANSCRIPT'}
            </span>
          )}
        </div>
      </div>

      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between border-t border-[#1a1a1a] px-6 py-3.5 text-xs font-bold tracking-[0.2em] text-[#555555] hover:bg-[#181818] hover:text-white transition-all">
        <span>{open ? 'HIDE DETAILS' : 'SHOW DETAILS'}</span>
        {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
      </button>

      {open && (
        <div className="border-t border-[#1a1a1a] p-6 space-y-6 animate-fade-in">
          {(res.concepts_covered ?? []).length > 0 && (
            <div>
              <p className="mb-3 text-xs font-bold tracking-[0.25em] text-[#555555]">CONCEPTS COVERED</p>
              <div className="flex flex-wrap gap-2">
                {(res.concepts_covered ?? []).map((c) => (
                  <span key={c} className="border border-[#222222] bg-black px-3.5 py-1 text-xs tracking-[0.1em] text-[#888888] font-medium">{c}</span>
                ))}
              </div>
            </div>
          )}
          {(res.strengths ?? []).length > 0 && (
            <div>
              <p className="mb-3 text-xs font-bold tracking-[0.25em] text-green-700">STRENGTHS</p>
              <ul className="space-y-2">
                {(res.strengths ?? []).map((s) => <li key={s} className="flex items-start gap-2.5 text-sm text-[#888888]"><span className="mt-0.5 text-green-500 font-extrabold">+</span>{s}</li>)}
              </ul>
            </div>
          )}
          {(res.weaknesses ?? []).length > 0 && (
            <div>
              <p className="mb-3 text-xs font-bold tracking-[0.25em] text-red-700">WEAKNESSES</p>
              <ul className="space-y-2">
                {(res.weaknesses ?? []).map((w) => <li key={w} className="flex items-start gap-2.5 text-sm text-[#888888]"><span className="mt-0.5 text-red-500 font-extrabold">-</span>{w}</li>)}
              </ul>
            </div>
          )}
          {res.recommendation_reason && (
            <div>
              <p className="mb-2 text-xs font-bold tracking-[0.25em] text-[#555555]">WHY RECOMMENDED</p>
              <p className="text-sm leading-relaxed text-[#888888]">{res.recommendation_reason}</p>
            </div>
          )}
          <div className="grid grid-cols-3 gap-6 border-t border-[#1a1a1a] pt-5 text-center">
            {[['VIEWS', res.views], ['LIKES', res.likes], ['COMMENTS', res.comments]].map(([k, v]) => (
              <div key={k as string}>
                <p className="text-xs font-bold tracking-[0.2em] text-[#555555]">{k as string}</p>
                <p className="mt-1 text-lg font-bold text-[#888888]">{v != null ? Number(v).toLocaleString() : '-'}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

interface RecommendedResource {
  rank: number; video_id: string; title: string; url: string
  channel: string | null; published_at: string | null; description: string | null
  views: number | null; likes: number | null; comments: number | null
  transcript_available: boolean | null; transcript_language: string | null
  relevance_score: number | null; educational_quality_score: number | null
  coverage_score: number | null; overall_score: number | null; beginner_friendly: boolean | null
  concepts_covered: string[] | null; strengths: string[] | null; weaknesses: string[] | null
  recommendation_reason: string | null; thumbnail_url?: string | null
}

export function ReportView({ report, query, searchQuery = '' }: { report: ResearchResponse['report'] | HistoryItem; query: string; searchQuery?: string }) {
  const r = 'executive_summary' in report ? report : (report as HistoryItem)
  const exec = 'executive_summary' in r ? (r as ResearchResponse['report']).executive_summary : (r as HistoryItem).executive_summary ?? ''
  const resources: RecommendedResource[] = ('recommended_resources' in r ? ((r as any).recommended_resources ?? []) : [])
  const topics: string[] = ('key_topics' in r ? ((r as any).key_topics ?? []) : [])
  const path: string[] = ('learning_path' in r ? ((r as any).learning_path ?? []) : [])
  const conc = 'conclusion' in r ? (r as ResearchResponse['report']).conclusion : (r as HistoryItem).conclusion ?? ''
  const method = 'methodology' in r ? (r as ResearchResponse['report']).methodology : (r as HistoryItem).methodology ?? ''
  const limits: string[] = ('limitations' in r ? ((r as any).limitations ?? []) : [])

  return (
    <div className="space-y-10 animate-slide-up">
      {/* User query bubble */}
      <div className="flex justify-end">
        <div className="max-w-2xl border border-[#222222] bg-[#111111] px-6 py-5">
          <p className="text-base font-bold tracking-wide text-white">{query}</p>
        </div>
      </div>

      {/* Executive Summary */}
      {exec && (
        <div className="border border-[#222222] bg-[#111111] p-8">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <BookOpen size={18} className="text-[#555555]" />
              <h2 className="text-xs font-bold tracking-[0.3em] text-[#999999]" style={{fontFamily:"'Space Grotesk',sans-serif"}}>EXECUTIVE SUMMARY</h2>
            </div>
            <CopyButton text={exec} />
          </div>
          <p className="text-lg leading-8 text-[#cccccc] font-medium"><Highlight text={exec} query={searchQuery} /></p>
        </div>
      )}

      {/* Interactive Knowledge Graph */}
      {resources.length > 0 && (
        <KnowledgeGraph query={query} resources={resources} topics={topics} />
      )}

      {/* Recommended Resources */}
      {resources.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <Play size={18} className="text-[#555555]" />
            <h2 className="text-xs font-bold tracking-[0.3em] text-[#999999]" style={{fontFamily:"'Space Grotesk',sans-serif"}}>RECOMMENDED RESOURCES</h2>
            <span className="border border-[#222222] bg-[#111111] px-3 py-0.5 text-xs font-bold tracking-[0.15em] text-[#666666]">{resources.length}</span>
          </div>
          <div className="space-y-4">
            {resources.map((res, i) => <ResourceCard key={res.video_id} res={res} rank={i + 1} />)}
          </div>
        </div>
      )}

      {/* Key Topics */}
      {topics.length > 0 && (
        <div className="border border-[#222222] bg-[#111111] p-8">
          <div className="mb-5 flex items-center gap-3">
            <Target size={18} className="text-[#555555]" />
            <h2 className="text-xs font-bold tracking-[0.3em] text-[#999999]" style={{fontFamily:"'Space Grotesk',sans-serif"}}>KEY TOPICS</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {topics.map((t) => (
              <span key={t} className="border border-[#222222] bg-black px-4 py-2.5 text-sm font-bold tracking-[0.1em] text-[#cccccc]">{t}</span>
            ))}
          </div>
        </div>
      )}

      {/* Learning Path */}
      {path.length > 0 && (
        <div className="border border-[#222222] bg-[#111111] p-8">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <TrendingUp size={18} className="text-[#555555]" />
              <h2 className="text-xs font-bold tracking-[0.3em] text-[#999999]" style={{fontFamily:"'Space Grotesk',sans-serif"}}>LEARNING PATH</h2>
            </div>
            <CopyButton text={path.map((s, i) => `${i + 1}. ${s}`).join('\n')} />
          </div>
          <ol className="space-y-4">
            {path.map((step, i) => (
              <li key={i} className="flex items-start gap-4 text-base text-[#cccccc] font-medium">
                <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center border border-[#333333] bg-black text-xs font-bold text-[#666666]">{i + 1}</span>
                <span className="leading-relaxed mt-0.5"><Highlight text={step} query={searchQuery} /></span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Methodology + Limitations */}
      {(method || limits.length > 0) && (
        <div className="grid gap-6 md:grid-cols-2">
          {method && (
            <div className="border border-[#222222] bg-[#111111] p-8">
              <p className="mb-4 text-xs font-bold tracking-[0.3em] text-[#555555]">METHODOLOGY</p>
              <p className="text-base leading-8 text-[#888888] font-medium">{method}</p>
            </div>
          )}
          {limits.length > 0 && (
            <div className="border border-[#222222] bg-[#111111] p-8">
              <p className="mb-4 text-xs font-bold tracking-[0.3em] text-[#555555]">LIMITATIONS</p>
              <ul className="space-y-3">
                {limits.map((l) => <li key={l} className="flex items-start gap-3 text-base text-[#888888] font-medium"><span className="mt-2.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#555555]" />{l}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Conclusion */}
      {conc && (
        <div className="border border-white bg-black p-8">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-xs font-bold tracking-[0.3em] text-[#555555]">CONCLUSION</p>
            <CopyButton text={conc} />
          </div>
          <p className="text-lg leading-8 text-white font-bold"><Highlight text={conc} query={searchQuery} /></p>
        </div>
      )}
    </div>
  )
}

function Research() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const [videoCount, setVideoCount] = useState(1)
  const [loading, setLoading] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [result, setResult] = useState<ResearchResponse | null>(null)
  const [historyResult, setHistoryResult] = useState<HistoryItem | null>(null)
  const [historyQuery, setHistoryQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [showOptions, setShowOptions] = useState(false)
  const { toasts, toast, dismiss } = useToast()
  const [reportSearch, setReportSearch] = useState('')
  const [reportSearchOpen, setReportSearchOpen] = useState(false)
  const reportSearchRef = useRef<HTMLInputElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const typingPlaceholder = useTypingEffect(PLACEHOLDER_TOPICS)
  const greeting = GREETINGS[new Date().getHours() % GREETINGS.length]
  const { status: loadingStatus, fade: loadingFade } = useLoadingStatus(LOADING_STATUSES)
  const activeRunId = searchParams.get('run')

  // Load past history run when URL search param activeRunId changes
  useEffect(() => {
    if (!activeRunId) {
      setHistoryResult(null)
      setHistoryQuery('')
      return
    }
    setResult(null)
    setError(null)
    const load = async () => {
      try {
        setHistoryLoading(true)
        const data = await getHistoryEntry(activeRunId)
        setHistoryResult(data)
        setHistoryQuery(data.query)
      } catch {
        setError('Could not load this research run.')
      } finally {
        setHistoryLoading(false)
      }
    }
    void load()
  }, [activeRunId])

  // Clear state on custom research:clear event
  useEffect(() => {
    const handleClear = () => {
      setResult(null)
      setHistoryResult(null)
      setHistoryQuery('')
      setError(null)
      setQuery('')
      setTimeout(() => inputRef.current?.focus(), 100)
    }
    window.addEventListener('research:clear', handleClear)
    return () => window.removeEventListener('research:clear', handleClear)
  }, [])

  // Ctrl+F to search within active report
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        if (result || historyResult) {
          e.preventDefault()
          setReportSearchOpen(true)
          setTimeout(() => reportSearchRef.current?.focus(), 50)
        }
      }
      if (e.key === 'Escape' && reportSearchOpen) {
        setReportSearchOpen(false)
        setReportSearch('')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [result, historyResult, reportSearchOpen])

  const reportMatchCount = useMemo(() => {
    if (!reportSearch.trim()) return 0
    const text = JSON.stringify(result || historyResult || '')
    const escaped = reportSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const matches = text.match(new RegExp(escaped, 'gi'))
    return matches ? matches.length : 0
  }, [reportSearch, result, historyResult])

  const handleNew = () => {
    setSearchParams({})
    setResult(null)
    setHistoryResult(null)
    setHistoryQuery('')
    setError(null)
    setQuery('')
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const submit = async () => {
    const trimmed = query.trim()
    if (!trimmed || loading) return
    setError(null)
    setResult(null)
    setHistoryResult(null)
    setHistoryQuery('')
    setSearchParams({})
    setLoading(true)

    try {
      const data = await runResearch(trimmed, videoCount)
      setResult(data)
      setQuery('')
      toast('Research compiled successfully!', 'success')
      // Invalidate user analytics stats cache so fresh profile stats fetch next time
      localStorage.removeItem('rt_user_analytics_stats')
      window.dispatchEvent(new CustomEvent('research:created'))
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 200)
    } catch (err: any) {
      const msg = err?.response?.data?.detail || (err instanceof Error ? err.message : 'Research pipeline failed. Please try again.')
      setError(msg)
      toast(msg, 'error')
    } finally {
      setLoading(false)
    }
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void submit()
    }
  }

  const activeReport = historyResult ?? result?.report ?? null
  const activeQuery = historyQuery || query
  const showHome = !loading && !historyLoading && !activeReport && !error

  return (
    <>
    <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-4xl flex-col px-6 pb-16 pt-8 text-white selection:bg-white selection:text-black">
      {/* Header Bar */}
      <header className="mb-10 flex items-center justify-between border-b border-[#181818] pb-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white" style={{fontFamily:"'Space Grotesk',sans-serif"}}>RESEARCHTUBE AI</h1>
          <p className="mt-1 text-xs font-semibold tracking-[0.2em] text-[#555555]">DEEP TECHNICAL RESEARCH ENGINE</p>
        </div>
        {(result || historyResult) && (
          <button onClick={handleNew} className="border border-white bg-white px-5 py-2 text-xs font-bold tracking-[0.2em] text-black hover:bg-black hover:text-white transition-all">
            NEW RESEARCH
          </button>
        )}
      </header>

      {/* Empty State Centered Search Dialog */}
      {showHome ? (
        <div className="flex flex-col justify-center flex-1 max-w-2xl mx-auto w-full animate-fade-in py-12">
          <div className="w-full flex flex-col items-start">
            <h2 className="text-base md:text-lg font-bold tracking-tight text-left text-[#cccccc] mb-6" style={{fontFamily:"'Space Grotesk',sans-serif"}}>{greeting}</h2>
            <InputBox query={query} setQuery={setQuery} videoCount={videoCount} setVideoCount={setVideoCount} loading={loading} onSubmit={() => void submit()} onKeyDown={onKeyDown} inputRef={inputRef} placeholder={typingPlaceholder} showOptions={showOptions} setShowOptions={setShowOptions} />
          </div>
        </div>
      ) : (
        <div className="space-y-10 flex-1">
          {/* History Run Toggle Skeleton Loader */}
          {historyLoading && <ReportSkeletonLoader />}

          {/* Loading */}
          {loading && !historyLoading && (
            <div className="flex flex-col items-center justify-center gap-8 py-24 animate-fade-in flex-1">
              <div className="relative flex items-center justify-center h-24 w-24">
                <div className="absolute inset-0 rounded-full border border-white/10 animate-ping" />
                <div className="absolute inset-2 rounded-full border-t-2 border-r-2 border-white/80 animate-spin [animation-duration:1.2s]" />
                <div className="h-10 w-10 rounded-full bg-white/5 backdrop-blur-md border border-white/20 animate-pulse flex items-center justify-center">
                  <Play size={10} className="text-white fill-white ml-0.5" />
                </div>
              </div>
              <div className="text-center space-y-3 min-h-[5rem] flex flex-col justify-center max-w-lg">
                <p className={"text-base font-semibold tracking-wide text-white transition-opacity duration-300 " + (loadingFade ? "opacity-100" : "opacity-0")}>
                  {loadingStatus.toUpperCase()}
                </p>
                <p className="text-[10px] font-bold text-[#555555] tracking-[0.2em] uppercase">
                  Synthesizing video knowledge graph • Please wait ~2 minutes
                </p>
              </div>
            </div>
          )}

          {/* Error */}
          {error && !loading && !historyLoading && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex items-center gap-3 border border-red-955 bg-[#1a0505] p-5">
                <AlertCircle size={18} className="flex-shrink-0 text-red-500" />
                <p className="text-sm font-bold text-red-400">{error}</p>
              </div>
              <InputBox query={query} setQuery={setQuery} videoCount={videoCount} setVideoCount={setVideoCount} loading={loading} onSubmit={() => void submit()} onKeyDown={onKeyDown} inputRef={inputRef} placeholder={typingPlaceholder} showOptions={showOptions} setShowOptions={setShowOptions} />
            </div>
          )}

          {/* Report */}
          {activeReport && !loading && !historyLoading && (
            <div className="space-y-10">
              <ReportView report={activeReport} query={activeQuery} searchQuery={reportSearch} />
              <div ref={bottomRef} />
              {!activeRunId && (
                <div className="border-t border-[#181818] pt-8 max-w-2xl mx-auto w-full">
                  <p className="mb-4 text-xs font-bold tracking-[0.3em] text-[#555555] text-left">NEW RESEARCH</p>
                  <InputBox query={query} setQuery={setQuery} videoCount={videoCount} setVideoCount={setVideoCount} loading={loading} onSubmit={() => void submit()} onKeyDown={onKeyDown} inputRef={inputRef} placeholder={typingPlaceholder} showOptions={showOptions} setShowOptions={setShowOptions} />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
    {/* Report Search Bar */}
    {reportSearchOpen && (
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[150] bg-[#111111] border border-[#2a2a2a] rounded-2xl shadow-2xl flex items-center gap-3 px-4 py-3 w-80">
        <Search size={14} className="flex-shrink-0 text-[#555555]" />
        <input
          ref={reportSearchRef}
          type="text"
          value={reportSearch}
          onChange={(e) => setReportSearch(e.target.value)}
          placeholder="Search in report..."
          className="flex-1 bg-transparent text-sm text-[#ffffff] outline-none placeholder:text-[#444444] font-medium"
        />
        {reportSearch && (
          <span className="text-[10px] font-bold text-[#555555] flex-shrink-0">
            {reportMatchCount} match{reportMatchCount !== 1 ? 'es' : ''}
          </span>
        )}
        <button
          onClick={() => { setReportSearchOpen(false); setReportSearch('') }}
          className="flex-shrink-0 text-[#444444] hover:text-white transition-colors"
        >
          <XIcon size={13} />
        </button>
      </div>
    )}
    <Onboarding />
    <ToastContainer toasts={toasts} dismiss={dismiss} />
    </>
  )
}

interface InputBoxProps {
  query: string; setQuery: (v: string) => void
  videoCount: number; setVideoCount: (v: number) => void
  loading: boolean; onSubmit: () => void
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  inputRef: React.RefObject<HTMLTextAreaElement | null>
  placeholder: string; showOptions: boolean; setShowOptions: (v: boolean) => void
}

function InputBox({ query, setQuery, videoCount, setVideoCount, loading, onSubmit, onKeyDown, inputRef, placeholder, showOptions, setShowOptions }: InputBoxProps) {
  return (
    <div className="w-full border border-[#222222] bg-[#111111] transition-all focus-within:border-[#444444]">
      <div className="px-5 pt-5">
        <textarea ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={onKeyDown} rows={3}
          placeholder={placeholder || 'Research best resources to learn...'}
          disabled={loading}
          className="w-full resize-none bg-transparent text-base font-semibold tracking-wide text-white outline-none placeholder:text-[#444444] disabled:opacity-50"
          style={{fontFamily:"'Manrope',sans-serif"}} />
      </div>
      <div className="flex items-center justify-between px-4 pb-4">
        <div className="flex items-center gap-2">
          <button onClick={() => setShowOptions(!showOptions)} className="px-3 py-1.5 text-xs font-bold tracking-[0.2em] text-[#666666] border border-[#222222] hover:border-[#444444] hover:text-white transition-all">
            {videoCount} VIDEO{videoCount !== 1 ? 'S' : ''} ?
          </button>
          {showOptions && (
            <div className="flex items-center gap-1">
              {[1, 2, 3, 5, 7].map((n) => (
                <button key={n} onClick={() => { setVideoCount(n); setShowOptions(false) }}
                  className={'border px-3 py-1.5 text-xs font-bold tracking-[0.15em] transition-all ' + (videoCount === n ? 'border-white bg-white text-black' : 'border-[#222222] text-[#666666] hover:border-[#444444] hover:text-white')}>
                  {n}
                </button>
              ))}
            </div>
          )}
        </div>
        <button onClick={onSubmit} disabled={loading || !query.trim()}
          className="flex items-center gap-2 border border-white bg-white px-5 py-2 text-xs font-bold tracking-[0.25em] text-[#000000] transition-all hover:bg-black hover:text-white disabled:opacity-30 disabled:cursor-not-allowed">
          {loading ? <Loader2 size={13} className="animate-spin" /> : <ArrowUp size={13} />}
          {loading ? 'RESEARCHING...' : 'RESEARCH'}
        </button>
      </div>
    </div>
  )
}

export default Research
