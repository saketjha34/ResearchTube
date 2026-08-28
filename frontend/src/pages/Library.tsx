import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BrainCircuit,
  Database,
  ShieldCheck,
  Zap,
  ArrowRight,
  Layers,
  Sparkles,
  Activity,
} from 'lucide-react'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import Button from '../components/Button'
import GithubIcon from '../components/GithubIcon'

interface Feature {
  id: string
  category: 'agent' | 'vector' | 'scraper' | 'security' | 'export'
  title: string
  subtitle: string
  description: string
  icon: any
  badge: string
  details: string[]
  codeSnippet?: string
}

const FEATURES: Feature[] = [
  {
    id: 'multi-agent',
    category: 'agent',
    title: '7-Node LangGraph Agent State Machine',
    subtitle: 'Autonomous Multi-Agent Workflow Orchestration',
    description:
      'Coordinates three specialized LLM agents across a 7-node directed acyclic state graph (DAG) to crawl, analyze, and synthesize YouTube video content.',
    icon: BrainCircuit,
    badge: 'LangGraph + Gemini',
    details: [
      'Agent 1 (Researcher): Generates search terms, queries YouTube API, and pulls transcript data',
      'Agent 2 (RAG Evaluator): Evaluates technical accuracy, pros/cons, and depth metrics per video',
      'Agent 3 (Synthesizer): Compiles publication-grade markdown research reports',
      'Persistent closures inject database sessions seamlessly across async node functions',
    ],
    codeSnippet: `START -> youtube_research -> persist_research -> ingest_transcripts -> context_analysis -> persist_analysis -> final_report -> persist_final_report -> END`,
  },
  {
    id: 'pgvector-rag',
    category: 'vector',
    title: 'PostgreSQL + pgvector Semantic Search',
    subtitle: 'RAG Architecture with 768-Dimension Dense Vectors',
    description:
      'Chunks long video transcripts into overlapping segments, computes dense embeddings, and executes fast Cosine Similarity queries to pull exact context blocks.',
    icon: Database,
    badge: 'pgvector + text-embedding-004',
    details: [
      'Sliding chunking window (1000 characters with 200 character overlap)',
      'High-dimensional vector storage natively in PostgreSQL via pgvector extension',
      'Cosine Distance ranking algorithm matches user queries to transcript evidence',
      'Mitigates LLM hallucinations by supplying verified video evidence snippets',
    ],
  },
  {
    id: 'hardened-scraper',
    category: 'scraper',
    title: 'Proxy-Aware Hardened Scraper Pipeline',
    subtitle: '3-Layer Rotation Strategy for Anti-Bot Resilience',
    description:
      'Bypasses Cloud Provider IP blocks and scraping limits by dynamically rotating proxy credentials and language variant fallbacks.',
    icon: Zap,
    badge: 'Anti-Block Engine',
    details: [
      'Layer 1: WebshareProxyConfig authenticated proxy connection',
      'Layer 2: Generic proxy URL injection into system HTTP/HTTPS environment variables',
      'Layer 3: Sequential language scanning (English -> Regional Variants -> Auto-generated tags)',
      'Prevents empty data returns even when running inside restricted cloud environments',
    ],
  },
  {
    id: 'knowledge-graph',
    category: 'agent',
    title: 'Interactive 2D Concept Knowledge Graph',
    subtitle: 'Visual Entity & Relation Mapping',
    description:
      'Extracts key technical concepts, architectures, and dependencies from video transcripts and renders a zoomable, interactive network graph.',
    icon: Layers,
    badge: 'Interactive Visualizer',
    details: [
      'Interactive node drag, zoom, and highlight controls',
      'Reveals hidden semantic connections between topics across multiple videos',
      'Click any node to explore key takeaways and technical relationships',
    ],
  },
  {
    id: 'rate-limiting-security',
    category: 'security',
    title: 'Token-Bucket Rate Limiting & Auth Protection',
    subtitle: 'Fair-Use Protection & Brute-Force Shield',
    description:
      'Implements slowapi token-bucket rate limits keyed on client IP and decoded JWT user IDs, paired with Argon2 credential hashing.',
    icon: ShieldCheck,
    badge: 'slowapi + Argon2',
    details: [
      'POST /youtube/research capped at 5 requests/min per user (prevents API abuse)',
      'POST /auth/login capped at 10 requests/min per IP (brute-force defense)',
      'Argon2 password hashing for state-of-the-art credential storage',
      'Sliding access/refresh token rotation interceptors on client side',
    ],
  },
  {
    id: 'observability-gzip',
    category: 'export',
    title: 'GZip Compression & Cloud Run Observability',
    subtitle: 'Low-Latency Payload Optimization & Structlog Tracing',
    description:
      'Cuts payload transit size by ~70% on large research runs using FastAPI GZip middleware, paired with JSON structured logs for GCP Cloud Logging.',
    icon: Activity,
    badge: 'structlog + GZip',
    details: [
      'Automatic response compression for JSON payloads > 1,000 bytes',
      'Structured JSON stdout logs with jsonPayload context (run_id, node, level)',
      'Filterable in Google Cloud Logging by specific run execution steps',
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
      <section className="mx-auto max-w-6xl px-6 pt-16 pb-12">
        <div className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950 px-3.5 py-1 text-xs text-zinc-400 mb-6">
          <Sparkles className="h-3.5 w-3.5 text-amber-400" />
          System Capabilities Registry
        </div>
        <h1 className="text-4xl font-bold tracking-tight md:text-6xl text-white">
          ResearchTube Feature Library
        </h1>
        <p className="mt-4 max-w-2xl text-base text-[#999999] leading-relaxed">
          Discover the complete technical architecture powering our multi-agent YouTube research engine—from state-machine orchestration to pgvector semantic search.
        </p>

        {/* Filter Pills */}
        <div className="mt-10 flex flex-wrap items-center gap-2 border-b border-[#181818] pb-6">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition-all ${
              selectedCategory === 'all'
                ? 'bg-white text-black font-semibold'
                : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white'
            }`}
          >
            All Features ({FEATURES.length})
          </button>
          <button
            onClick={() => setSelectedCategory('agent')}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition-all ${
              selectedCategory === 'agent'
                ? 'bg-white text-black font-semibold'
                : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white'
            }`}
          >
            Multi-Agent & Graph
          </button>
          <button
            onClick={() => setSelectedCategory('vector')}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition-all ${
              selectedCategory === 'vector'
                ? 'bg-white text-black font-semibold'
                : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white'
            }`}
          >
            pgvector & RAG
          </button>
          <button
            onClick={() => setSelectedCategory('scraper')}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition-all ${
              selectedCategory === 'scraper'
                ? 'bg-white text-black font-semibold'
                : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white'
            }`}
          >
            Proxy Scraper
          </button>
          <button
            onClick={() => setSelectedCategory('security')}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition-all ${
              selectedCategory === 'security'
                ? 'bg-white text-black font-semibold'
                : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white'
            }`}
          >
            Security & Protection
          </button>
          <button
            onClick={() => setSelectedCategory('export')}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition-all ${
              selectedCategory === 'export'
                ? 'bg-white text-black font-semibold'
                : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white'
            }`}
          >
            Observability & Export
          </button>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-8 md:grid-cols-2">
          {filteredFeatures.map((feature) => {
            const Icon = feature.icon
            return (
              <div
                key={feature.id}
                className="group relative flex flex-col justify-between rounded-2xl border border-[#181818] bg-[#0c0c0c] p-8 transition-all hover:border-zinc-700 hover:bg-[#111111]"
              >
                <div>
                  <div className="flex items-center justify-between gap-4">
                    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-white group-hover:border-zinc-700">
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <span className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 text-[11px] font-medium text-zinc-300">
                      {feature.badge}
                    </span>
                  </div>

                  <h3 className="mt-6 text-xl font-bold text-white tracking-tight">
                    {feature.title}
                  </h3>
                  <p className="mt-1 text-xs font-medium uppercase tracking-wider text-amber-400/90">
                    {feature.subtitle}
                  </p>
                  <p className="mt-4 text-sm leading-relaxed text-[#999999]">
                    {feature.description}
                  </p>

                  {/* Key details list */}
                  <ul className="mt-6 space-y-2.5">
                    {feature.details.map((detail, idx) => (
                      <li key={idx} className="flex items-start gap-2.5 text-xs text-zinc-300">
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-zinc-500 flex-shrink-0" />
                        <span>{detail}</span>
                      </li>
                    ))}
                  </ul>

                  {feature.codeSnippet && (
                    <div className="mt-6 rounded-lg border border-zinc-800 bg-black p-3.5 font-mono text-[11px] text-zinc-400 overflow-x-auto">
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
      <section className="border-t border-[#181818] bg-zinc-950/60 py-16">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
            Ready to experience multi-agent YouTube research?
          </h2>
          <p className="mt-4 text-sm text-[#999999]">
            Start researching topics in seconds with automated transcript parsing and pgvector RAG analysis.
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
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-5 py-2.5 text-sm text-zinc-300 hover:border-zinc-700 hover:text-white transition-all"
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
