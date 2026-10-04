import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BrainCircuit,
  Database,
  ShieldCheck,
  Zap,
  ArrowRight,
  Sparkles,
  Activity,
  Network,
  MessageSquare,
  Link as LinkIcon,
  BarChart3,
} from 'lucide-react'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import Button from '../components/Button'
import GithubIcon from '../components/GithubIcon'

interface Feature {
  id: string
  category: 'agent' | 'vector' | 'chat' | 'scraper' | 'security' | 'observability'
  title: string
  subtitle: string
  plainEnglish: string
  badge: string
  techSpecs: string[]
  codeSnippet?: string
}

const FEATURES: Feature[] = [
  {
    id: 'multi-agent-dag',
    category: 'agent',
    title: '7-Node LangGraph Multi-Agent Engine',
    subtitle: 'Autonomous Agent Workflow Orchestration',
    plainEnglish:
      'Instead of asking a single AI to do everything, ResearchTube divides the job among three specialized AI agents that check each other\'s work. One discovers the best YouTube videos, one reads the transcripts and grades technical accuracy, and one compiles a clear, actionable summary with direct links.',
    badge: 'LangGraph + Gemini 2.5 Flash',
    techSpecs: [
      'Agent 1 (Researcher): Generates search terms, queries YouTube API, and pulls transcript data',
      'Agent 2 (RAG Evaluator): Evaluates technical accuracy, pros/cons, and depth metrics per video',
      'Agent 3 (Synthesizer): Compiles publication-grade markdown research reports',
      'Persistent closures inject database sessions seamlessly across async node functions',
    ],
    codeSnippet: 'START -> youtube_research -> persist_research -> ingest_transcripts -> context_analysis -> persist_analysis -> final_report -> persist_final_report -> END',
  },
  {
    id: 'hybrid-search-rrf',
    category: 'vector',
    title: 'Hybrid Semantic & Keyword Search',
    subtitle: 'pgvector Dense Vectors + GIN Full-Text Search (RRF)',
    plainEnglish:
      'Standard keyword search misses concepts when different words are used, while pure AI vector search can miss exact code names or tool flags. Our hybrid engine runs both at the same time: it understands the conceptual meaning and matches exact technical words, combining the results using Reciprocal Rank Fusion (RRF) for pinpoint accuracy.',
    badge: 'pgvector + GIN tsvector (RRF)',
    techSpecs: [
      'Sliding transcript chunking (1,000 characters with 200 character overlap)',
      '768-dimensional dense vectors generated via text-embedding-004 in PostgreSQL pgvector',
      'PostgreSQL Full-Text Search (tsvector) with GIN indexing for exact keyword queries',
      'Reciprocal Rank Fusion (RRF, k=60) fuses dense and sparse rankings without score bias',
    ],
    codeSnippet: 'RRF_Score(doc) = (1 / (60 + rank_dense)) + (1 / (60 + rank_sparse))',
  },
  {
    id: 'knowledge-graph',
    category: 'agent',
    title: 'Interactive 2D Concept Knowledge Graph',
    subtitle: 'Visual Entity, Topic, & Curriculum Network',
    plainEnglish:
      'A visual radial map that links your search topic to every recommended video and the key technical concepts they cover. You can zoom in, pan across topics, click any concept to see which videos cover it, and expand into a distraction-free fullscreen view.',
    badge: 'Stationary Radial Network + Portal Fullscreen',
    techSpecs: [
      'Stationary radial layout with zero physics jitter for instant, stable visual comprehension',
      'Scalable glow SVG filters with dynamic font and node hit-area scaling',
      'React Portal mounting directly to document.body for true full-window expansion',
      'Native multi-touch pinch-to-zoom and one-finger canvas panning for mobile devices',
    ],
  },
  {
    id: 'multi-scope-chat',
    category: 'chat',
    title: 'Conversational Video Scope AI Chat',
    subtitle: 'Flexible Scoping: Single Video, All Videos, or General Research',
    plainEnglish:
      'Chat directly with YouTube video content. You can talk to a single video to get exact answers with clickable timestamps, ask broad questions across your entire saved video collection to compare different creators, or explore general technical topics.',
    badge: 'Multi-Scope Scoping Engine',
    techSpecs: [
      'Single-Video Scope: In-depth Q&A restricted to a specific video transcript',
      'All-Videos Scope: Cross-video transcript fusion for synthesizing diverse viewpoints',
      'Direct YouTube timestamp linking: Click any cited timestamp to jump straight to that moment',
      'Context-aware conversation history with sliding window token memory',
    ],
  },
  {
    id: 'custom-url-linker',
    category: 'chat',
    title: 'Custom YouTube URL & Video ID Linker',
    subtitle: 'Instant On-Demand Video Ingestion',
    plainEnglish:
      'You are never limited to automatic search results. Paste any YouTube video URL or ID into ResearchTube to automatically extract its spoken words, analyze its concepts on the knowledge graph, and chat with it in seconds.',
    badge: 'Dynamic URL Ingestion Engine',
    techSpecs: [
      'Extracts standard, shortened (youtu.be), and embed URL patterns automatically',
      'Runs transcript extraction pipeline on the fly with proxy safety fallbacks',
      'Seamlessly integrates custom videos into your library, knowledge graph, and chat scopes',
      'Immediate validation with instant thumbnail preview and error handling',
    ],
  },
  {
    id: 'hardened-scraper',
    category: 'scraper',
    title: 'Hardened 3-Layer Proxy Scraper Pipeline',
    subtitle: '3-Tier Rotation Strategy for Anti-Bot Resilience',
    plainEnglish:
      'Extracting transcripts from video platforms often fails due to rate limits or cloud IP blocks. ResearchTube uses a three-tier safety net with authenticated proxy rotation and language fallbacks to ensure video transcripts load reliably every time.',
    badge: 'Anti-Block Engine',
    techSpecs: [
      'Layer 1: Webshare authenticated proxy connection with dynamic credential rotation',
      'Layer 2: Generic proxy URL injection into system HTTP/HTTPS environment variables',
      'Layer 3: Sequential language scanning (English -> Regional Variants -> Auto-generated tags)',
      'Prevents empty data returns even when running inside restricted cloud container environments',
    ],
  },
  {
    id: 'chat-analytics',
    category: 'observability',
    title: 'Chat Analytics & Concept Mastery Tracking',
    subtitle: 'Learning Progress & Productivity Metrics',
    plainEnglish:
      'Track your learning milestones over time. View your research activity, total questions asked, estimated hours of video watching saved, and your mastery of technical concepts across all your research sessions.',
    badge: 'Productivity & Mastery Analytics',
    techSpecs: [
      'Live metric tracking: Total research runs, active chat threads, and questions answered',
      'Research time saved calculation based on 45-minute average video playback baseline',
      'Concept frequency counter tracking technical terms mastered across research runs',
      'Responsive data presentation with horizontal scrolling safeguards for mobile devices',
    ],
  },
  {
    id: 'rate-limiting-security',
    category: 'security',
    title: 'Token-Bucket Rate Limiting & Auth Protection',
    subtitle: 'Fair-Use Protection & Brute-Force Shield',
    plainEnglish:
      'Protects the system from spam, malicious bots, and brute-force attacks so that real users always have fast, uninterrupted access to research.',
    badge: 'slowapi + Argon2 Hashing',
    techSpecs: [
      'POST /youtube/research capped at 5 requests/min per user (prevents API abuse)',
      'POST /auth/login capped at 10 requests/min per IP (brute-force defense)',
      'Argon2 password hashing for state-of-the-art credential storage',
      'Sliding access and refresh token rotation interceptors on client side',
    ],
  },
  {
    id: 'observability-gzip',
    category: 'observability',
    title: 'GZip Compression & Structured Cloud Logging',
    subtitle: 'Low-Latency Payload Optimization & structlog Tracing',
    plainEnglish:
      'Cuts research report data transit size by up to 70% before sending it to your browser for fast page loads, paired with clean JSON logs for monitoring system health and execution speed.',
    badge: 'structlog + GZip Middleware',
    techSpecs: [
      'Automatic response compression for JSON payloads greater than 1,000 bytes',
      'Structured JSON stdout logs with jsonPayload context (run_id, node, level)',
      'Filterable in Google Cloud Logging by specific agent execution steps',
      'Low memory footprint optimized for Docker and Google Cloud Run deployment',
    ],
  },
]

export default function Library() {
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  const filteredFeatures =
    selectedCategory === 'all'
      ? FEATURES
      : FEATURES.filter((f) => f.category === selectedCategory)

  return (
    <div className="min-h-screen bg-black text-white selection:bg-white selection:text-black">
      <Navbar />

      {/* Header Banner */}
      <section className="mx-auto max-w-6xl px-6 pt-20 pb-14">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#282828] bg-[#111111] px-4 py-1.5 text-xs font-mono font-medium text-zinc-300 mb-8">
          <Sparkles className="h-3.5 w-3.5 text-white" />
          <span>CAPABILITIES & ARCHITECTURE REGISTRY</span>
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight md:text-6xl text-white">
          System Capabilities Library
        </h1>
        <p className="mt-6 max-w-3xl text-lg sm:text-xl text-[#999999] leading-relaxed">
          Explore the complete technical architecture powering ResearchTube. Explained in plain, simple English with detailed technical specifications for engineers.
        </p>

        {/* Filter Pills (Clean Minimalist Monochrome) */}
        <div className="mt-10 flex flex-wrap items-center gap-2 border-b border-[#1c1c1c] pb-6">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`rounded-xl px-4 py-2 text-xs font-semibold transition-all cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-white text-black shadow-md'
                : 'bg-[#121212] text-zinc-400 hover:bg-[#1a1a1a] hover:text-white border border-[#222222]'
            }`}
          >
            All Capabilities ({FEATURES.length})
          </button>
          <button
            onClick={() => setSelectedCategory('agent')}
            className={`rounded-xl px-4 py-2 text-xs font-semibold transition-all cursor-pointer ${
              selectedCategory === 'agent'
                ? 'bg-white text-black shadow-md'
                : 'bg-[#121212] text-zinc-400 hover:bg-[#1a1a1a] hover:text-white border border-[#222222]'
            }`}
          >
            Multi-Agent & Graph
          </button>
          <button
            onClick={() => setSelectedCategory('vector')}
            className={`rounded-xl px-4 py-2 text-xs font-semibold transition-all cursor-pointer ${
              selectedCategory === 'vector'
                ? 'bg-white text-black shadow-md'
                : 'bg-[#121212] text-zinc-400 hover:bg-[#1a1a1a] hover:text-white border border-[#222222]'
            }`}
          >
            pgvector & Hybrid Search
          </button>
          <button
            onClick={() => setSelectedCategory('chat')}
            className={`rounded-xl px-4 py-2 text-xs font-semibold transition-all cursor-pointer ${
              selectedCategory === 'chat'
                ? 'bg-white text-black shadow-md'
                : 'bg-[#121212] text-zinc-400 hover:bg-[#1a1a1a] hover:text-white border border-[#222222]'
            }`}
          >
            Video Chat & Custom Links
          </button>
          <button
            onClick={() => setSelectedCategory('scraper')}
            className={`rounded-xl px-4 py-2 text-xs font-semibold transition-all cursor-pointer ${
              selectedCategory === 'scraper'
                ? 'bg-white text-black shadow-md'
                : 'bg-[#121212] text-zinc-400 hover:bg-[#1a1a1a] hover:text-white border border-[#222222]'
            }`}
          >
            Proxy Scraper Pipeline
          </button>
          <button
            onClick={() => setSelectedCategory('security')}
            className={`rounded-xl px-4 py-2 text-xs font-semibold transition-all cursor-pointer ${
              selectedCategory === 'security'
                ? 'bg-white text-black shadow-md'
                : 'bg-[#121212] text-zinc-400 hover:bg-[#1a1a1a] hover:text-white border border-[#222222]'
            }`}
          >
            Security & Auth
          </button>
          <button
            onClick={() => setSelectedCategory('observability')}
            className={`rounded-xl px-4 py-2 text-xs font-semibold transition-all cursor-pointer ${
              selectedCategory === 'observability'
                ? 'bg-white text-black shadow-md'
                : 'bg-[#121212] text-zinc-400 hover:bg-[#1a1a1a] hover:text-white border border-[#222222]'
            }`}
          >
            Analytics & Performance
          </button>
        </div>
      </section>

      {/* Feature Grid (Spacious Cards with Generous Padding) */}
      <section className="mx-auto max-w-6xl px-6 pb-28">
        <div className="grid gap-8 md:grid-cols-2">
          {filteredFeatures.map((feature) => {
            return (
              <div
                key={feature.id}
                className="group relative flex flex-col justify-between rounded-3xl border border-[#222222] bg-[#0c0c0c] p-8 sm:p-10 transition-all hover:border-[#383838] hover:bg-[#101010]"
              >
                <div>
                  {/* Top Badge & Icon */}
                  <div className="flex items-center justify-between gap-4">
                    <div className="rounded-2xl border border-[#282828] bg-[#161616] p-3.5 text-white transition-transform group-hover:scale-105">
                      {feature.id === 'multi-agent-dag' && <BrainCircuit className="h-6 w-6" />}
                      {feature.id === 'hybrid-search-rrf' && <Database className="h-6 w-6" />}
                      {feature.id === 'knowledge-graph' && <Network className="h-6 w-6" />}
                      {feature.id === 'multi-scope-chat' && <MessageSquare className="h-6 w-6" />}
                      {feature.id === 'custom-url-linker' && <LinkIcon className="h-6 w-6" />}
                      {feature.id === 'hardened-scraper' && <Zap className="h-6 w-6" />}
                      {feature.id === 'chat-analytics' && <BarChart3 className="h-6 w-6" />}
                      {feature.id === 'rate-limiting-security' && <ShieldCheck className="h-6 w-6" />}
                      {feature.id === 'observability-gzip' && <Activity className="h-6 w-6" />}
                    </div>

                    <span className="rounded-full border border-[#282828] bg-[#141414] px-3.5 py-1 text-[11px] font-mono font-medium text-zinc-300">
                      {feature.badge}
                    </span>
                  </div>

                  {/* Title & Subtitle */}
                  <h3 className="mt-6 text-xl sm:text-2xl font-bold text-white tracking-tight">
                    {feature.title}
                  </h3>
                  <p className="mt-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    {feature.subtitle}
                  </p>

                  {/* Plain English Explanation */}
                  <div className="mt-4 rounded-xl border border-[#1a1a1a] bg-[#080808] p-4 text-sm leading-relaxed text-[#aaaaaa]">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
                      Plain English Overview
                    </span>
                    {feature.plainEnglish}
                  </div>

                  {/* Technical Specifications List */}
                  <div className="mt-6">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#666666] block mb-2.5">
                      Technical Specifications
                    </span>
                    <ul className="space-y-2.5">
                      {feature.techSpecs.map((spec, idx) => (
                        <li key={idx} className="flex items-start gap-2.5 text-xs text-zinc-300">
                          <span className="mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0 bg-white" />
                          <span>{spec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Code Snippet / Flow */}
                  {feature.codeSnippet && (
                    <div className="mt-6 rounded-xl border border-[#1c1c1c] bg-black p-4 font-mono text-[11px] text-zinc-400 overflow-x-auto">
                      <code>{feature.codeSnippet}</code>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="border-t border-[#181818] bg-[#0c0c0c] py-20">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            Experience Multi-Agent Video Research
          </h2>
          <p className="mt-4 text-sm sm:text-base text-[#888888] max-w-xl mx-auto leading-relaxed">
            Start researching complex topics in seconds with automated transcript parsing, hybrid search, and interactive concept graphs.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <Link to="/register">
              <Button>
                Get Started Free <ArrowRight className="ml-2 inline h-4 w-4" />
              </Button>
            </Link>
            <a
              href="https://github.com/saketjha34/ResearchTube"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-[#222222] bg-[#141414] px-5 py-3 text-sm font-semibold text-zinc-300 hover:border-[#444444] hover:text-white transition-all shadow-sm"
            >
              <GithubIcon className="h-4 w-4" /> View GitHub
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
