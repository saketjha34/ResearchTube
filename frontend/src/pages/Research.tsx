import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowUp, Loader2, Play, BookOpen, Target, TrendingUp, CheckCircle, AlertCircle, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'
import { runResearch, getHistoryEntry, type ResearchResponse, type HistoryItem } from '../api/research'
// useAuth removed

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

function ScoreBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round((value / 10) * 100)
  const color = pct >= 80 ? '#22c55e' : pct >= 60 ? '#eab308' : '#ef4444'
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[10px] tracking-[0.2em] font-bold text-[#555555]">{label.toUpperCase()}</span>
        <span className="text-xs font-bold text-white">{value.toFixed(1)}</span>
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
          <div className="min-w-0 flex-1">
            <a href={res.url} target="_blank" rel="noopener noreferrer" className="group flex items-start gap-2">
              <h3 className="text-lg font-bold text-white leading-snug group-hover:text-[#cccccc] transition-colors" style={{fontFamily:"'Space Grotesk',sans-serif"}}>{res.title}</h3>
              <ExternalLink size={14} className="mt-0.5 flex-shrink-0 text-[#555555] group-hover:text-white transition-colors" />
            </a>
            {res.channel && <p className="mt-1.5 text-xs font-bold tracking-[0.2em] text-[#555555]">{res.channel.toUpperCase()}</p>}
            {res.description && <p className="mt-3 text-sm text-[#888888] line-clamp-2 leading-relaxed">{res.description}</p>}
          </div>
          <div className="flex-shrink-0 text-right pl-4">
            <p className="text-3xl font-bold text-white" style={{fontFamily:"'Space Grotesk',sans-serif"}}>{res.overall_score.toFixed(1)}</p>
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
          {res.concepts_covered.length > 0 && (
            <div>
              <p className="mb-3 text-xs font-bold tracking-[0.25em] text-[#555555]">CONCEPTS COVERED</p>
              <div className="flex flex-wrap gap-2">
                {res.concepts_covered.map((c) => (
                  <span key={c} className="border border-[#222222] bg-black px-3.5 py-1 text-xs tracking-[0.1em] text-[#888888] font-medium">{c}</span>
                ))}
              </div>
            </div>
          )}
          {res.strengths.length > 0 && (
            <div>
              <p className="mb-3 text-xs font-bold tracking-[0.25em] text-green-700">STRENGTHS</p>
              <ul className="space-y-2">
                {res.strengths.map((s) => <li key={s} className="flex items-start gap-2.5 text-sm text-[#888888]"><span className="mt-0.5 text-green-500 font-extrabold">+</span>{s}</li>)}
              </ul>
            </div>
          )}
          {res.weaknesses.length > 0 && (
            <div>
              <p className="mb-3 text-xs font-bold tracking-[0.25em] text-red-700">WEAKNESSES</p>
              <ul className="space-y-2">
                {res.weaknesses.map((w) => <li key={w} className="flex items-start gap-2.5 text-sm text-[#888888]"><span className="mt-0.5 text-red-500 font-extrabold">−</span>{w}</li>)}
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
                <p className="mt-1 text-lg font-bold text-[#888888]">{v != null ? Number(v).toLocaleString() : '—'}</p>
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
  transcript_available: boolean; transcript_language: string | null
  relevance_score: number; educational_quality_score: number
  coverage_score: number; overall_score: number; beginner_friendly: boolean
  concepts_covered: string[]; strengths: string[]; weaknesses: string[]
  recommendation_reason: string; thumbnail_url?: string | null
}

function ReportView({ report, query }: { report: ResearchResponse['report'] | HistoryItem; query: string }) {
  const r = 'executive_summary' in report ? report : (report as HistoryItem)
  const exec = 'executive_summary' in r ? (r as ResearchResponse['report']).executive_summary : (r as HistoryItem).executive_summary ?? ''
  const resources = 'recommended_resources' in r ? r.recommended_resources : []
  const topics = 'key_topics' in r ? r.key_topics : []
  const path = 'learning_path' in r ? r.learning_path : []
  const conc = 'conclusion' in r ? (r as ResearchResponse['report']).conclusion : (r as HistoryItem).conclusion ?? ''
  const method = 'methodology' in r ? (r as ResearchResponse['report']).methodology : (r as HistoryItem).methodology ?? ''
  const limits = 'limitations' in r ? r.limitations : []

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
          <div className="mb-5 flex items-center gap-3">
            <BookOpen size={18} className="text-[#555555]" />
            <h2 className="text-xs font-bold tracking-[0.3em] text-[#999999]" style={{fontFamily:"'Space Grotesk',sans-serif"}}>EXECUTIVE SUMMARY</h2>
          </div>
          <p className="text-lg leading-8 text-[#cccccc] font-medium">{exec}</p>
        </div>
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
          <div className="mb-5 flex items-center gap-3">
            <TrendingUp size={18} className="text-[#555555]" />
            <h2 className="text-xs font-bold tracking-[0.3em] text-[#999999]" style={{fontFamily:"'Space Grotesk',sans-serif"}}>LEARNING PATH</h2>
          </div>
          <ol className="space-y-4">
            {path.map((step, i) => (
              <li key={i} className="flex items-start gap-4 text-base text-[#cccccc] font-medium">
                <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center border border-[#333333] bg-black text-xs font-bold text-[#666666]">{i + 1}</span>
                <span className="leading-relaxed mt-0.5">{step}</span>
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
          <p className="mb-4 text-xs font-bold tracking-[0.3em] text-[#555555]">CONCLUSION</p>
          <p className="text-lg leading-8 text-white font-bold">{conc}</p>
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
  const [result, setResult] = useState<ResearchResponse | null>(null)
  const [historyResult, setHistoryResult] = useState<HistoryItem | null>(null)
  const [historyQuery, setHistoryQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [showOptions, setShowOptions] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const typingPlaceholder = useTypingEffect(PLACEHOLDER_TOPICS)
  const greeting = GREETINGS[new Date().getHours() % GREETINGS.length]
  const activeRunId = searchParams.get('run')

  useEffect(() => {
    if (!activeRunId) { setHistoryResult(null); setHistoryQuery(''); return }
    setResult(null); setError(null)
    const load = async () => {
      try {
        const data = await getHistoryEntry(activeRunId)
        setHistoryResult(data); setHistoryQuery(data.query)
      } catch { setError('Could not load this research run.') }
    }
    void load()
  }, [activeRunId])

  useEffect(() => {
    const handleClear = () => {
      setResult(null)
      setHistoryResult(null)
      setError(null)
      setQuery('')
      setTimeout(() => inputRef.current?.focus(), 100)
    }
    window.addEventListener('research:clear', handleClear)
    return () => window.removeEventListener('research:clear', handleClear)
  }, [])

  const handleNew = () => {
    setSearchParams({}); setResult(null); setHistoryResult(null); setError(null); setQuery('')
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  const submit = useCallback(async () => {
    if (!query.trim() || loading) return
    setLoading(true); setError(null); setResult(null); setHistoryResult(null); setSearchParams({})
    try {
      const data = await runResearch(query.trim(), videoCount)
      setResult(data)
      window.dispatchEvent(new Event('research:created'))
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 200)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(msg ?? 'Research failed. Please try again.')
    } finally { setLoading(false) }
  }, [query, videoCount, loading, setSearchParams])

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void submit() }
  }

  const showHome = !loading && !result && !historyResult && !error
  const activeQuery = result ? query : historyQuery
  const activeReport = result?.report ?? historyResult ?? null

  return (
    <div className="flex flex-col min-h-[calc(100vh-140px)] space-y-10">
      {/* Header - Always left-aligned at top-left */}
      <header className="flex items-start justify-between flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">RESEARCH</h1>
          <p className="mt-1 text-xs font-semibold tracking-wide text-[#666666]">AI-powered YouTube research pipeline.</p>
        </div>
        {(result || historyResult) && (
          <button onClick={handleNew} className="border border-white bg-white px-5 py-2 text-xs font-bold tracking-[0.2em] text-black hover:bg-black hover:text-white transition-all">
            NEW RESEARCH
          </button>
        )}
      </header>

      {/* Empty State Centered Search Dialog */}
      {showHome ? (
        <div className="flex flex-col items-center justify-center flex-1 max-w-2xl mx-auto w-full space-y-5 animate-fade-in py-12">
          <h2 className="text-base md:text-lg font-bold tracking-tight text-center text-[#cccccc]" style={{fontFamily:"'Space Grotesk',sans-serif"}}>{greeting}</h2>
          <InputBox query={query} setQuery={setQuery} videoCount={videoCount} setVideoCount={setVideoCount} loading={loading} onSubmit={() => void submit()} onKeyDown={onKeyDown} inputRef={inputRef} placeholder={typingPlaceholder} showOptions={showOptions} setShowOptions={setShowOptions} />
        </div>
      ) : (
        <div className="space-y-10 flex-1">
          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center justify-center gap-6 py-20 animate-fade-in">
              <Loader2 size={36} className="animate-spin text-white" />
              <div className="text-center">
                <p className="text-lg font-bold tracking-[0.1em] text-white">RESEARCHING...</p>
                <p className="mt-2 text-xs font-semibold text-[#666666] tracking-wide">Running 3-agent pipeline · This takes ~2 minutes</p>
              </div>
              <div className="flex items-center gap-4 text-[10px] font-bold tracking-[0.2em] text-[#555555]">
                <span>AGENT 1: SEARCH</span>
                <span>→</span>
                <span>AGENT 2: RAG</span>
                <span>→</span>
                <span>AGENT 3: REPORT</span>
              </div>
            </div>
          )}

          {/* Error */}
          {error && !loading && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex items-center gap-3 border border-red-955 bg-[#1a0505] p-5">
                <AlertCircle size={18} className="flex-shrink-0 text-red-500" />
                <p className="text-sm font-bold text-red-400">{error}</p>
              </div>
              <InputBox query={query} setQuery={setQuery} videoCount={videoCount} setVideoCount={setVideoCount} loading={loading} onSubmit={() => void submit()} onKeyDown={onKeyDown} inputRef={inputRef} placeholder={typingPlaceholder} showOptions={showOptions} setShowOptions={setShowOptions} />
            </div>
          )}

          {/* Report */}
          {activeReport && !loading && (
            <div className="space-y-10">
              <ReportView report={activeReport} query={activeQuery} />
              <div ref={bottomRef} />
              <div className="border-t border-[#181818] pt-8">
                <p className="mb-4 text-xs font-bold tracking-[0.3em] text-[#555555]">NEW RESEARCH</p>
                <InputBox query={query} setQuery={setQuery} videoCount={videoCount} setVideoCount={setVideoCount} loading={loading} onSubmit={() => void submit()} onKeyDown={onKeyDown} inputRef={inputRef} placeholder={typingPlaceholder} showOptions={showOptions} setShowOptions={setShowOptions} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
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
            {videoCount} VIDEO{videoCount !== 1 ? 'S' : ''} ▾
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
          className="flex items-center gap-2 border border-white bg-white px-5 py-2 text-xs font-bold tracking-[0.25em] text-black transition-all hover:bg-black hover:text-white disabled:opacity-30 disabled:cursor-not-allowed">
          {loading ? <Loader2 size={13} className="animate-spin" /> : <ArrowUp size={13} />}
          {loading ? 'RESEARCHING...' : 'RESEARCH'}
        </button>
      </div>
    </div>
  )
}

export default Research
