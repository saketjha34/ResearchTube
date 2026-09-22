import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowUp, Loader2, Play, BookOpen, Target, TrendingUp, CheckCircle, AlertCircle, ChevronDown, ChevronUp, Copy, Check, Search, X as XIcon, Calendar, Clock, Archive, ArchiveRestore } from 'lucide-react'
import { runResearch, getHistory, getHistoryEntry, archiveHistoryEntry, type ResearchResponse, type HistoryItem } from '../api/research'
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


function YoutubeIcon({ className = 'h-3.5 w-3.5', size = 14 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  )
}

export interface AttachedVideo {
  id: string
  url: string
}

const YOUTUBE_REGEX = /(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:[^ \n\t\r"'<]*&)?v=|embed\/|v\/|shorts\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/

function extractYoutubeId(input: string): string | null {
  if (!input) return null
  const trimmed = input.trim()
  const match = trimmed.match(YOUTUBE_REGEX)
  if (match && match[1]) return match[1]
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed
  return null
}

function extractAllYoutubeIds(text: string): string[] {
  if (!text) return []
  const globalRegex = /(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:[^ \n\t\r"'<]*&)?v=|embed\/|v\/|shorts\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/g
  const matches = [...text.matchAll(globalRegex)]
  const ids = matches.map((m) => m[1]).filter(Boolean)
  return Array.from(new Set(ids))
}


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

function formatChatCreationDate(dateString?: string | null): string {
  if (!dateString) return ''
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return ''
  const dateFormatted = date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  const timeFormatted = date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
  return `${dateFormatted} at ${timeFormatted}`
}

function formatMessageTime(dateString?: string | null): string {
  if (!dateString) return ''
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return ''
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()

  const timeFormatted = date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })

  if (isToday) {
    return `Today at ${timeFormatted}`
  }

  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) {
    return `Yesterday at ${timeFormatted}`
  }

  const isCurrentYear = date.getFullYear() === now.getFullYear()
  const dateFormatted = date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(isCurrentYear ? {} : { year: 'numeric' }),
  })
  return `${dateFormatted}, ${timeFormatted}`
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

export function ReportView({
  report,
  query,
  searchQuery = '',
  createdAt,
  completedAt,
}: {
  report: ResearchResponse['report'] | HistoryItem
  query: string
  searchQuery?: string
  createdAt?: string | null
  completedAt?: string | null
}) {
  const r = 'executive_summary' in report ? report : (report as HistoryItem)
  const exec = 'executive_summary' in r ? (r as ResearchResponse['report']).executive_summary : (r as HistoryItem).executive_summary ?? ''
  const resources: RecommendedResource[] = ('recommended_resources' in r ? ((r as any).recommended_resources ?? []) : [])
  const topics: string[] = ('key_topics' in r ? ((r as any).key_topics ?? []) : [])
  const path: string[] = ('learning_path' in r ? ((r as any).learning_path ?? []) : [])
  const conc = 'conclusion' in r ? (r as ResearchResponse['report']).conclusion : (r as HistoryItem).conclusion ?? ''
  const method = 'methodology' in r ? (r as ResearchResponse['report']).methodology : (r as HistoryItem).methodology ?? ''
  const limits: string[] = ('limitations' in r ? ((r as any).limitations ?? []) : [])

  const effectiveCreatedAt = createdAt || ('created_at' in report ? (report as HistoryItem).created_at : null)
  const effectiveCompletedAt = completedAt || ('completed_at' in report ? (report as HistoryItem).completed_at : null)

  return (
    <div className="space-y-10 animate-slide-up">
      {/* Research Creation Date & Time Header (Centered, matching Chat interface) */}
      {effectiveCreatedAt && (
        <div className="flex items-center justify-center pt-2 pb-1 select-none animate-fade-in">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#262626] bg-[#121212]/90 backdrop-blur-md px-4 py-1.5 text-xs text-[#8e8e8e] shadow-md hover:border-[#383838] transition-colors">
            <Calendar size={13} className="text-[#888888]" />
            <span className="font-medium tracking-wide">
              Created {formatChatCreationDate(effectiveCreatedAt)}
            </span>
          </div>
        </div>
      )}

      {/* User query bubble */}
      <div className="flex flex-col items-end">
        <div className="max-w-2xl border border-[#222222] bg-[#111111] px-6 py-5">
          <p className="text-base font-bold tracking-wide text-white whitespace-pre-wrap">
            {query || (report as any)?.research_question || (report as any)?.query || 'Research Query'}
          </p>
        </div>
        {effectiveCreatedAt && (
          <div className="mt-1.5 mr-1 flex items-center gap-1.5 text-[11px] text-[#666666] font-mono select-none">
            <Clock size={10} className="opacity-60 text-[#888888]" />
            <span>{formatMessageTime(effectiveCreatedAt)}</span>
          </div>
        )}
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

          {/* Date and time below the response */}
          {(effectiveCompletedAt || effectiveCreatedAt) && (
            <div className="mt-6 pt-4 border-t border-[#1c1c1c] flex items-center justify-between text-[#888888] text-xs">
              <span className="text-[11px] text-[#666666]">Research Report</span>
              <div className="flex items-center gap-1.5 text-[11px] text-[#71717a] font-mono select-none">
                <Clock size={11} className="text-[#52525b]" />
                <span>{formatMessageTime(effectiveCompletedAt || effectiveCreatedAt)}</span>
              </div>
            </div>
          )}
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
  const [lastSubmittedQuery, setLastSubmittedQuery] = useState('')
  const freshRunTimestampRef = useRef<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showOptions, setShowOptions] = useState(false)
  const [attachedVideos, setAttachedVideos] = useState<AttachedVideo[]>([])
  const [videoInputOpen, setVideoInputOpen] = useState(false)
  const [videoUrlInput, setVideoUrlInput] = useState('')
  const [videoInputError, setVideoInputError] = useState('')
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

  // Pre-fill search query if arrived from a shared report (e.g. /research?q=...)
  useEffect(() => {
    const qParam = searchParams.get('q')
    if (qParam && !activeRunId) {
      setQuery(qParam)
      setSearchParams({})
      setTimeout(() => inputRef.current?.focus(), 150)
    }
  }, [searchParams, activeRunId, setSearchParams])

  // Restore active research run on browser refresh
  useEffect(() => {
    const stored = localStorage.getItem('rt_active_research')
    if (!stored) return

    try {
      const parsed = JSON.parse(stored)
      const age = Date.now() - (parsed.timestamp || 0)
      if (age < 240000) {
        setLoading(true)
        setLastSubmittedQuery(parsed.query || '')
        if (parsed.videoCount) setVideoCount(parsed.videoCount)

        const interval = setInterval(async () => {
          try {
            const historyData = await getHistory(1, 10)
            const match = historyData.items.find(
              (it) =>
                (it.query === parsed.query || it.research_question === parsed.query) &&
                it.status === 'completed' &&
                Boolean(it.executive_summary)
            )

            if (match) {
              clearInterval(interval)
              const fullEntry = await getHistoryEntry(match.run_id)
              setHistoryResult(fullEntry)
              setHistoryQuery(fullEntry.query)
              setLastSubmittedQuery(fullEntry.query)
              setLoading(false)
              localStorage.removeItem('rt_active_research')
              window.dispatchEvent(new CustomEvent('research:created'))
              toast('Research compiled successfully!', 'success')
            } else {
              const failed = historyData.items.find(
                (it) =>
                  (it.query === parsed.query || it.research_question === parsed.query) &&
                  it.status === 'failed'
              )
              if (failed) {
                clearInterval(interval)
                setError('Research pipeline failed. Please try again.')
                setLoading(false)
                localStorage.removeItem('rt_active_research')
                window.dispatchEvent(new CustomEvent('research:created'))
              }
            }
          } catch {
            // Keep polling
          }
        }, 3500)

        const timeout = setTimeout(() => {
          clearInterval(interval)
          localStorage.removeItem('rt_active_research')
          setLoading(false)
        }, 180000)

        return () => {
          clearInterval(interval)
          clearTimeout(timeout)
        }
      } else {
        localStorage.removeItem('rt_active_research')
      }
    } catch {
      localStorage.removeItem('rt_active_research')
    }
  }, [])

  // Clear state on custom research:clear event
  useEffect(() => {
    const handleClear = () => {
      freshRunTimestampRef.current = null
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

  const submit = async () => {
    const trimmed = query.trim()
    if (!trimmed && attachedVideos.length === 0) return
    if (loading) return

    // Build final query payload: direct video URLs + user prompt
    let finalQuery = trimmed
    if (attachedVideos.length > 0) {
      const urls = attachedVideos.map((v) => v.url).join(' ')
      if (trimmed) {
        finalQuery = `${urls}\n${trimmed}`
      } else {
        finalQuery = urls
      }
    }

    const finalVideoCount = Math.max(videoCount, attachedVideos.length)

    setError(null)
    setResult(null)
    setHistoryResult(null)
    setHistoryQuery('')
    setSearchParams({})
    setLastSubmittedQuery(finalQuery)
    setLoading(true)

    // 1. Toast immediately when research run is created
    toast('Research run created! Analyzing videos...', 'info')

    // 2. Optimistic pending run for sidebar & refresh resilience
    const pendingId = 'pending-' + Date.now()
    const pendingItem: HistoryItem = {
      run_id: pendingId,
      query: finalQuery,
      status: 'in_progress',
      video_count: finalVideoCount,
      created_at: new Date().toISOString(),
      completed_at: null,
      research_question: finalQuery,
      executive_summary: null,
      conclusion: null,
      methodology: null,
      learning_path: [],
      key_topics: [],
      limitations: [],
      recommended_resources: [],
      analysis_evaluations: [],
      ranking_summary: null,
      videos: [],
    }

    localStorage.setItem(
      'rt_active_research',
      JSON.stringify({
        pendingId,
        query: finalQuery,
        videoCount: finalVideoCount,
        timestamp: Date.now(),
      })
    )

    // Notify sidebar to immediately show recent pending research run
    window.dispatchEvent(new CustomEvent('research:started', { detail: pendingItem }))

    try {
      const data = await runResearch(finalQuery, finalVideoCount)
      freshRunTimestampRef.current = new Date().toISOString()
      setResult(data)
      setLastSubmittedQuery(finalQuery)
      setQuery('')
      setAttachedVideos([])
      setVideoInputOpen(false)
      setVideoUrlInput('')
      setVideoInputError('')
      localStorage.removeItem('rt_active_research')
      toast('Research compiled successfully!', 'success')
      // Invalidate user analytics stats cache so fresh profile stats fetch next time
      localStorage.removeItem('rt_user_analytics_stats')
      window.dispatchEvent(new CustomEvent('research:created'))
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 200)
    } catch (err: any) {
      localStorage.removeItem('rt_active_research')
      window.dispatchEvent(new CustomEvent('research:created'))
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
  const activeQuery =
    historyQuery ||
    lastSubmittedQuery ||
    (activeReport && 'research_question' in activeReport && activeReport.research_question
      ? (activeReport.research_question as string)
      : '') ||
    (activeReport && 'query' in activeReport && (activeReport as any).query
      ? (activeReport as any).query
      : '') ||
    query
  const showHome = !activeRunId && !activeReport && !loading && !historyLoading && !error

  return (
    <>
    <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-4xl flex-col px-6 pb-16 pt-8 text-white selection:bg-white selection:text-black">
      {/* Header Bar */}
      <header className="mb-10 flex items-center justify-between border-b border-[#181818] pb-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white" style={{fontFamily:"'Space Grotesk',sans-serif"}}>RESEARCHTUBE AI</h1>
          <p className="mt-1 text-xs font-semibold tracking-[0.2em] text-[#555555]">DEEP TECHNICAL RESEARCH ENGINE</p>
        </div>
      </header>

      {/* Archived Notice Banner */}
      {historyResult?.is_archived && (
        <div className="mb-6 flex items-center justify-between rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-300 backdrop-blur-xs animate-fade-in">
          <div className="flex items-center gap-2">
            <Archive size={14} className="flex-shrink-0 text-amber-400" />
            <span>This research run is archived.</span>
          </div>
          <button
            type="button"
            onClick={async () => {
              if (!activeRunId) return
              try {
                const res = await archiveHistoryEntry(activeRunId)
                setHistoryResult((prev) => (prev ? { ...prev, is_archived: res.is_archived } : null))
              } catch {
                alert('Failed to unarchive research run.')
              }
            }}
            className="flex items-center gap-1 font-semibold text-amber-200 hover:text-white transition-colors underline underline-offset-2 ml-3 flex-shrink-0 cursor-pointer"
          >
            <ArchiveRestore size={13} />
            <span>Unarchive</span>
          </button>
        </div>
      )}

      {/* Background research in progress banner when viewing a past report */}
      {loading && activeRunId && (
        <div className="mb-6 flex items-center justify-between rounded-xl border border-[#2a2a2a] bg-[#121212] px-4 py-2.5 text-xs text-[#cccccc] shadow-lg animate-fade-in">
          <div className="flex items-center gap-2.5 min-w-0 pr-2">
            <Loader2 size={14} className="animate-spin text-white flex-shrink-0" />
            <span className="truncate">
              Your research <span className="font-semibold text-white">"{lastSubmittedQuery || 'in progress'}"</span> is compiling in background...
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setSearchParams({})
              setHistoryResult(null)
              setHistoryQuery('')
            }}
            className="rounded-lg border border-[#333333] bg-[#1e1e1e] hover:bg-[#282828] hover:text-white px-3 py-1 text-[11px] font-semibold text-[#cccccc] transition-all cursor-pointer flex-shrink-0"
          >
            View Live Progress
          </button>
        </div>
      )}

      {/* Empty State Centered Search Dialog (only when no run is active and not loading) */}
      {showHome ? (
        <div className="flex flex-col justify-center flex-1 max-w-2xl mx-auto w-full animate-fade-in py-12">
          <div className="w-full flex flex-col items-start">
            <h2 className="text-base md:text-lg font-bold tracking-tight text-left text-[#cccccc] mb-6" style={{fontFamily:"'Space Grotesk',sans-serif"}}>{greeting}</h2>
            <InputBox query={query} setQuery={setQuery} videoCount={videoCount} setVideoCount={setVideoCount} loading={loading} onSubmit={() => void submit()} onKeyDown={onKeyDown} inputRef={inputRef} placeholder={typingPlaceholder} showOptions={showOptions} setShowOptions={setShowOptions} attachedVideos={attachedVideos} setAttachedVideos={setAttachedVideos} videoInputOpen={videoInputOpen} setVideoInputOpen={setVideoInputOpen} videoUrlInput={videoUrlInput} setVideoUrlInput={setVideoUrlInput} videoInputError={videoInputError} setVideoInputError={setVideoInputError} />
          </div>
        </div>
      ) : (
        <div className="space-y-10 flex-1">
          {/* History Run Skeleton Loader */}
          {historyLoading && <ReportSkeletonLoader />}

          {/* Full Screen Live Loading Animation (when activeRunId is NOT set) */}
          {!activeRunId && loading && !historyLoading && (
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

          {/* Error display */}
          {error && !loading && !historyLoading && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex items-center gap-3 border border-red-955 bg-[#1a0505] p-5">
                <AlertCircle size={18} className="flex-shrink-0 text-red-500" />
                <p className="text-sm font-bold text-red-400">{error}</p>
              </div>
              <InputBox query={query} setQuery={setQuery} videoCount={videoCount} setVideoCount={setVideoCount} loading={loading} onSubmit={() => void submit()} onKeyDown={onKeyDown} inputRef={inputRef} placeholder={typingPlaceholder} showOptions={showOptions} setShowOptions={setShowOptions} attachedVideos={attachedVideos} setAttachedVideos={setAttachedVideos} videoInputOpen={videoInputOpen} setVideoInputOpen={setVideoInputOpen} videoUrlInput={videoUrlInput} setVideoUrlInput={setVideoUrlInput} videoInputError={videoInputError} setVideoInputError={setVideoInputError} />
            </div>
          )}

          {/* Report View (renders whenever activeReport is present and not currently loading history) */}
          {activeReport && !historyLoading && (
            <div className="space-y-10">
              <ReportView
                report={activeReport}
                query={activeQuery}
                searchQuery={reportSearch}
                createdAt={historyResult?.created_at ?? freshRunTimestampRef.current ?? null}
                completedAt={historyResult?.completed_at ?? freshRunTimestampRef.current ?? null}
              />

              <div ref={bottomRef} />
              {!activeRunId && (
                <div className="border-t border-[#181818] pt-8 max-w-2xl mx-auto w-full">
                  <p className="mb-4 text-xs font-bold tracking-[0.3em] text-[#555555] text-left">NEW RESEARCH</p>
                  <InputBox query={query} setQuery={setQuery} videoCount={videoCount} setVideoCount={setVideoCount} loading={loading} onSubmit={() => void submit()} onKeyDown={onKeyDown} inputRef={inputRef} placeholder={typingPlaceholder} showOptions={showOptions} setShowOptions={setShowOptions} attachedVideos={attachedVideos} setAttachedVideos={setAttachedVideos} videoInputOpen={videoInputOpen} setVideoInputOpen={setVideoInputOpen} videoUrlInput={videoUrlInput} setVideoUrlInput={setVideoUrlInput} videoInputError={videoInputError} setVideoInputError={setVideoInputError} />
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
  query: string
  setQuery: (v: string) => void
  videoCount: number
  setVideoCount: (v: number | ((prev: number) => number)) => void
  loading: boolean
  onSubmit: () => void
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  inputRef: React.RefObject<HTMLTextAreaElement | null>
  placeholder: string
  showOptions: boolean
  setShowOptions: (v: boolean) => void
  attachedVideos: AttachedVideo[]
  setAttachedVideos: React.Dispatch<React.SetStateAction<AttachedVideo[]>>
  videoInputOpen: boolean
  setVideoInputOpen: (v: boolean) => void
  videoUrlInput: string
  setVideoUrlInput: (v: string) => void
  videoInputError: string
  setVideoInputError: (v: string) => void
}

function InputBox({
  query,
  setQuery,
  videoCount,
  setVideoCount,
  loading,
  onSubmit,
  onKeyDown,
  inputRef,
  placeholder,
  showOptions,
  setShowOptions,
  attachedVideos,
  setAttachedVideos,
  videoInputOpen,
  setVideoInputOpen,
  videoUrlInput,
  setVideoUrlInput,
  videoInputError,
  setVideoInputError,
}: InputBoxProps) {
  const handleAddVideo = () => {
    const raw = videoUrlInput.trim()
    if (!raw) return
    const ids = extractAllYoutubeIds(raw)
    const singleId = extractYoutubeId(raw)
    const combinedIds = Array.from(new Set([...ids, ...(singleId ? [singleId] : [])]))

    if (combinedIds.length === 0) {
      setVideoInputError('Please enter a valid YouTube video URL or ID.')
      return
    }

    const newVideos = combinedIds
      .filter((id) => !attachedVideos.some((v) => v.id === id))
      .map((id) => ({
        id,
        url: `https://www.youtube.com/watch?v=${id}`,
      }))

    if (newVideos.length === 0) {
      setVideoInputError('Video(s) already added.')
      return
    }

    const next = [...attachedVideos, ...newVideos]
    setAttachedVideos(next)
    setVideoCount((prev: number) => Math.max(prev, next.length))
    setVideoUrlInput('')
    setVideoInputError('')
  }

  const handleRemoveVideo = (idToRemove: string) => {
    setAttachedVideos((prev) => prev.filter((v) => v.id !== idToRemove))
  }

  const handleTextareaPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pastedText = e.clipboardData.getData('text')
    const detectedIds = extractAllYoutubeIds(pastedText)
    if (detectedIds.length > 0) {
      const newVideos = detectedIds
        .filter((id) => !attachedVideos.some((v) => v.id === id))
        .map((id) => ({
          id,
          url: `https://www.youtube.com/watch?v=${id}`,
        }))

      if (newVideos.length > 0) {
        const next = [...attachedVideos, ...newVideos]
        setAttachedVideos(next)
        setVideoCount((prev: number) => Math.max(prev, next.length))

        // If the pasted content was solely a YouTube link, avoid duplicating in textarea
        if (extractYoutubeId(pastedText.trim()) === pastedText.trim() || pastedText.trim().match(YOUTUBE_REGEX)?.[0] === pastedText.trim()) {
          e.preventDefault()
        }
      }
    }
  }

  return (
    <div className="w-full border border-[#222222] bg-[#111111] transition-all focus-within:border-[#444444] rounded-2xl shadow-xl overflow-hidden">
      {/* Attached Video Chips (Rendered when videos are linked) */}
      {attachedVideos.length > 0 && (
        <div className="px-5 pt-4 pb-2 flex flex-wrap items-center gap-2 border-b border-[#1c1c1c] bg-[#0c0c0d]">
          {attachedVideos.map((v) => (
            <div
              key={v.id}
              className="flex items-center gap-2 bg-[#161616] border border-[#2c2c2c] hover:border-[#444444] rounded-lg px-2.5 py-1 text-xs text-white transition-all group"
            >
              <img
                src={`https://img.youtube.com/vi/${v.id}/default.jpg`}
                alt="Thumbnail"
                className="h-4 w-6 rounded object-cover border border-[#333333] flex-shrink-0"
                onError={(e) => { (e.target as HTMLElement).style.display = 'none' }}
              />
              <span className="font-mono text-[11px] text-[#cccccc] max-w-[140px] truncate">
                {v.id}
              </span>
              <button
                type="button"
                onClick={() => handleRemoveVideo(v.id)}
                className="text-[#666666] hover:text-white transition-colors cursor-pointer p-0.5"
                title="Remove video"
              >
                <XIcon size={12} />
              </button>
            </div>
          ))}
          <span className="text-[10px] text-[#777777] font-semibold tracking-wider uppercase">
            {attachedVideos.length} custom video{attachedVideos.length > 1 ? 's' : ''} detected
          </span>
        </div>
      )}

      {/* Main Textarea */}
      <div className="px-5 pt-4">
        <textarea
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          onPaste={handleTextareaPaste}
          rows={3}
          placeholder={
            attachedVideos.length > 0
              ? 'Enter inquiry or research prompt for these videos (e.g. Compare architectural patterns, key insights)...'
              : placeholder || 'Research best resources to learn...'
          }
          disabled={loading}
          className="w-full resize-none bg-transparent text-base font-semibold tracking-wide text-white outline-none placeholder:text-[#444444] disabled:opacity-50"
          style={{ fontFamily: "'Manrope',sans-serif" }}
        />
      </div>

      {/* Video URL Input Dropdown / Expansion */}
      {videoInputOpen && (
        <div className="px-5 pb-3 animate-fade-in space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 flex items-center border border-[#2b2b2b] bg-[#0c0c0d] px-3 py-1.5 focus-within:border-[#555555] transition-colors rounded-lg">
              <YoutubeIcon size={14} className="text-[#777777] mr-2 flex-shrink-0" />
              <input
                type="text"
                value={videoUrlInput}
                onChange={(e) => {
                  setVideoUrlInput(e.target.value)
                  setVideoInputError('')
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddVideo()
                  }
                }}
                placeholder="Paste YouTube link or video ID (e.g. youtube.com/watch?v=...)"
                className="w-full bg-transparent text-xs text-white outline-none placeholder:text-[#555555]"
                autoFocus
              />
              {Boolean(extractYoutubeId(videoUrlInput)) && (
                <span className="text-[10px] text-emerald-400 font-semibold px-1.5 py-0.5 rounded bg-emerald-500/10 flex-shrink-0 border border-emerald-500/20">
                  Detected
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={handleAddVideo}
              className="border border-white bg-white text-black hover:bg-black hover:text-white px-3.5 py-1.5 text-xs font-bold tracking-wider uppercase transition-all cursor-pointer rounded-lg flex-shrink-0"
            >
              + Add
            </button>
          </div>
          {videoInputError ? (
            <p className="text-[11px] text-red-400 font-medium pl-1">
              {videoInputError}
            </p>
          ) : null}
        </div>
      )}

      {/* Bottom Action Bar */}
      <div className="flex items-center justify-between px-5 pb-4 pt-1 flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {/* 1 Video? Option Button */}
          <button
            type="button"
            onClick={() => setShowOptions(!showOptions)}
            className="px-3 py-1.5 text-xs font-bold tracking-[0.2em] text-[#666666] border border-[#222222] hover:border-[#444444] hover:text-white transition-all cursor-pointer rounded-lg"
          >
            {videoCount} VIDEO{videoCount !== 1 ? 'S' : ''} ?
          </button>
          {showOptions && (
            <div className="flex items-center gap-1">
              {[1, 2, 3, 5, 7].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => {
                    setVideoCount(Math.max(n, attachedVideos.length))
                    setShowOptions(false)
                  }}
                  className={
                    'border px-3 py-1.5 text-xs font-bold tracking-[0.15em] transition-all rounded-lg cursor-pointer ' +
                    (videoCount === n
                      ? 'border-white bg-white text-black'
                      : 'border-[#222222] text-[#666666] hover:border-[#444444] hover:text-white')
                  }
                >
                  {n}
                </button>
              ))}
            </div>
          )}

          {/* Beside the Video? button: Link Custom Videos Button */}
          <button
            type="button"
            onClick={() => {
              setVideoInputOpen(!videoInputOpen)
              setVideoInputError('')
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold tracking-[0.15em] border transition-all cursor-pointer rounded-lg ${
              videoInputOpen || attachedVideos.length > 0
                ? 'border-white text-white bg-[#1a1a1a]'
                : 'border-[#222222] text-[#666666] hover:border-[#444444] hover:text-white'
            }`}
            title="Paste specific YouTube video URLs to research"
          >
            <YoutubeIcon
              size={13}
              className={attachedVideos.length > 0 ? 'text-red-500 fill-red-500/20' : 'text-[#888888]'}
            />
            <span>
              {attachedVideos.length > 0
                ? `${attachedVideos.length} VIDEO${attachedVideos.length > 1 ? 'S' : ''} LINKED`
                : '+ LINK VIDEOS'}
            </span>
          </button>
        </div>

        {/* Submit Research Button */}
        <button
          type="button"
          onClick={onSubmit}
          disabled={loading || (!query.trim() && attachedVideos.length === 0)}
          className="flex items-center gap-2 border border-white bg-white px-5 py-2 text-xs font-bold tracking-[0.25em] text-[#000000] transition-all hover:bg-black hover:text-white disabled:opacity-30 disabled:cursor-not-allowed rounded-lg cursor-pointer shadow-sm"
        >
          {loading ? <Loader2 size={13} className="animate-spin" /> : <ArrowUp size={13} />}
          {loading ? 'RESEARCHING...' : 'RESEARCH'}
        </button>
      </div>
    </div>
  )
}

export default Research
