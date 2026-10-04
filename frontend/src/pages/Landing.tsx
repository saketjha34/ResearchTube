import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Sparkles,
  ArrowRight,
  BrainCircuit,
  Database,
  Network,
  MessageSquare,
  CheckCircle2,
  ChevronDown,
  Play,
  Terminal,
  Activity,
  Search,
  Loader2,
  Link as LinkIcon,
  BarChart3,
} from 'lucide-react'
import Button from '../components/Button'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import GithubIcon from '../components/GithubIcon'
import { startGoogleLogin } from '../api/auth'
import { ReportView } from './Research'
import type { ResearchResponse } from '../api/research'

// Sample queries for interactive pipeline
const EXAMPLE_QUERIES = [
  'Tell me the best resources to learn Postgres and pgvector for RAG',
  'Best resources to learn building multi-agent AI systems with LangGraph',
  'Best resources to master Rust system programming and async Tokio',
]

// Authentic Technical Reports with Real YouTube Video URLs & Exact Creator Channel Metadata
const DEMO_REPORTS: Record<string, ResearchResponse['report']> = {
  'Tell me the best resources to learn Postgres and pgvector for RAG': {
    research_question: 'Tell me the best resources to learn Postgres and pgvector for RAG',
    executive_summary:
      'Using PostgreSQL with the pgvector extension is the leading architectural pattern for building production Retrieval-Augmented Generation (RAG) pipelines. It enables storing 768d to 1536d vector embeddings directly alongside relational database tables, executing Cosine Distance vector similarity queries, and eliminating the complexity of managing a separate vector database like Pinecone or Milvus.',
    recommended_resources: [
      {
        rank: 1,
        video_id: 'hAdEuDBN57g',
        title: 'Build high-performance RAG using just PostgreSQL (Full Tutorial)',
        url: 'https://www.youtube.com/watch?v=hAdEuDBN57g',
        channel: 'Dave Ebbelaar',
        published_at: '2024-11-10',
        description: 'Complete hands-on tutorial building a full-stack RAG pipeline with PostgreSQL and pgvector, embedding data chunks and querying vector cosine similarity directly in SQL.',
        views: 42500,
        likes: 1840,
        comments: 125,
        transcript_available: true,
        transcript_language: 'en',
        relevance_score: 9.8,
        educational_quality_score: 9.7,
        coverage_score: 9.5,
        overall_score: 9.7,
        beginner_friendly: true,
        concepts_covered: ['pgvector Extension', 'PostgreSQL RAG', 'Vector Embeddings', 'Cosine Similarity', 'SQL Hybrid Queries'],
        strengths: [
          'Step-by-step SQL schema setup and pgvector index construction.',
          'Demonstrates real-world hybrid queries combining traditional SQL filtering with vector similarity distance.'
        ],
        weaknesses: [
          'Focuses on local PostgreSQL Docker setups rather than managed cloud deployments.'
        ],
        recommendation_reason: 'Top recommended resource for developers building production-grade RAG using pure PostgreSQL.'
      },
      {
        rank: 2,
        video_id: 'j1QcPSLj7u0',
        title: 'PGVector: Turn PostgreSQL Into A Vector Database',
        url: 'https://www.youtube.com/watch?v=j1QcPSLj7u0',
        channel: 'NeuralNine',
        published_at: '2024-08-15',
        description: 'In-depth guide on transforming PostgreSQL into a high-performance vector database using pgvector, HNSW indexing, and Python integration.',
        views: 85200,
        likes: 4210,
        comments: 265,
        transcript_available: true,
        transcript_language: 'en',
        relevance_score: 9.5,
        educational_quality_score: 9.4,
        coverage_score: 9.2,
        overall_score: 9.4,
        beginner_friendly: true,
        concepts_covered: ['HNSW Indexing', 'IVFFlat Lists', 'psycopg3 Python Driver', 'Vector Distance Metrics'],
        strengths: [
          'Clear Python code generating text embeddings and querying pgvector via psycopg3.',
          'In-depth performance comparisons between HNSW and IVFFlat index types.'
        ],
        weaknesses: [
          'Does not cover multi-tenant database partitioning.'
        ],
        recommendation_reason: 'Best foundational guide for understanding vector database indexing parameters in Postgres.'
      }
    ],
    key_topics: [
      'PostgreSQL',
      'pgvector',
      'HNSW Indexing',
      'IVFFlat Index',
      'Cosine Distance',
      'Hybrid RAG Search',
      'Vector Similarity'
    ],
    learning_path: [
      'Understand vector embeddings, dot product, cosine similarity, and Euclidean distance metrics.',
      'Install pgvector extension on PostgreSQL (CREATE EXTENSION vector).',
      'Benchmark HNSW (m=16, ef_construction=64) vs IVFFlat indexing speed and search recall.',
      'Build hybrid search queries combining full-text SQL search (tsvector) with pgvector similarity.',
      'Tune PostgreSQL work_mem and maintenance_work_mem parameters for fast index building.'
    ],
    methodology:
      'Evaluated top 15 database and RAG implementation tutorials on YouTube. Agent 2 analyzed 68 transcript chunks covering pgvector installation, SQL schema design, HNSW indexing performance, and query execution plans.',
    limitations: [
      'pgvector HNSW index builds require significant RAM during initial construction.',
      'Requires PostgreSQL 15+ for optimal memory efficiency and index build speeds.'
    ],
    conclusion:
      'For most software applications requiring vector search, PostgreSQL pgvector is the best choice because it provides ACID compliance, relational SQL joins, and zero additional cloud infrastructure costs.'
  },
  'Best resources to learn building multi-agent AI systems with LangGraph': {
    research_question: 'Best resources to learn building multi-agent AI systems with LangGraph',
    executive_summary:
      'LangGraph represents a state-of-the-art framework for constructing cyclic, stateful multi-agent architectures using LangChain abstractions. It replaces brittle, linear chaining with resilient Directed Acyclic Graphs (DAGs) and state machines, making it the industry standard for production agentic coding, automated research, and human-in-the-loop workflows.',
    recommended_resources: [
      {
        rank: 1,
        video_id: 'hvAPNPsfSGo',
        title: 'LangGraph Tutorial: Build Stateful Multi-Agent AI Systems',
        url: 'https://www.youtube.com/watch?v=hvAPNPsfSGo',
        channel: 'Prompt Engineering',
        published_at: '2024-09-02',
        description: 'Comprehensive guide covering LangGraph state schemas, node functions, conditional edge routing, and checkpointing for persistence.',
        views: 68400,
        likes: 3120,
        comments: 184,
        transcript_available: true,
        transcript_language: 'en',
        relevance_score: 9.9,
        educational_quality_score: 9.8,
        coverage_score: 9.7,
        overall_score: 9.8,
        beginner_friendly: true,
        concepts_covered: ['LangGraph StateGraph', 'State Schemas', 'Conditional Edges', 'Tool Nodes', 'MemorySaver'],
        strengths: [
          'Excellent explanation of TypedDict state schemas and message reducers.',
          'Full code breakdown of conditional edge routing logic between supervisor and worker agents.'
        ],
        weaknesses: [
          'Brief coverage of production deployment patterns on containerized infrastructure.'
        ],
        recommendation_reason: 'The single best tutorial for grasping how LangGraph state flows between autonomous agents.'
      }
    ],
    key_topics: [
      'LangGraph',
      'Multi-Agent Systems',
      'StateGraph',
      'Conditional Routing',
      'MemorySaver Checkpointers',
      'Agentic Workflows'
    ],
    learning_path: [
      'Master core concepts of state graphs: nodes as functions, edges as transitions, state as shared memory.',
      'Define clear Pydantic or TypedDict state schemas with message-appending operators.',
      'Implement supervisor agent architectures that delegate tasks to specialized sub-agents.',
      'Add human-in-the-loop validation using LangGraph interrupts and persistent checkpointers.'
    ],
    methodology:
      'Synthesized insights across 12 LangGraph and agentic framework courses on YouTube. Evaluated architectural robustness, error handling patterns, and real-world utility.',
    limitations: [
      'LangGraph APIs evolve rapidly across minor version updates.',
      'Requires understanding of async Python and LangChain message formatting.'
    ],
    conclusion:
      'LangGraph is uniquely qualified for complex multi-agent workflows because it handles persistence, conditional branching, and cycles out of the box.'
  },
  'Best resources to master Rust system programming and async Tokio': {
    research_question: 'Best resources to master Rust system programming and async Tokio',
    executive_summary:
      'Mastering system programming in Rust requires understanding memory ownership, borrowing, lifetimes, and zero-cost abstractions, followed by asynchronous concurrency with the Tokio runtime. Rust provides C-level speed and deterministic memory management without the vulnerability of manual memory deallocation.',
    recommended_resources: [
      {
        rank: 1,
        video_id: 'MSi3E5Z8nKw',
        title: 'Rust Crash Course: Memory Ownership, Lifetimes & Tokio Async',
        url: 'https://www.youtube.com/watch?v=MSi3E5Z8nKw',
        channel: 'Jon Gjengset',
        published_at: '2024-05-18',
        description: 'Deep dive into Rust memory internals, borrow checker nuances, multi-threaded channels, and async task scheduling with Tokio.',
        views: 112000,
        likes: 6700,
        comments: 412,
        transcript_available: true,
        transcript_language: 'en',
        relevance_score: 9.9,
        educational_quality_score: 9.9,
        coverage_score: 9.8,
        overall_score: 9.9,
        beginner_friendly: false,
        concepts_covered: ['Ownership & Borrowing', 'Lifetimes', 'Tokio Async Runtime', 'mpsc Channels', 'Mutex & Arc'],
        strengths: [
          'Incomparable depth into Rust standard library internals and memory layout.',
          'Demonstrates real-world multi-threaded concurrent programming without data races.'
        ],
        weaknesses: [
          'Intended for intermediate-to-advanced programmers; not suitable for complete beginners.'
        ],
        recommendation_reason: 'Gold standard for deep technical comprehension of systems-level Rust programming.'
      }
    ],
    key_topics: [
      'Rust Systems Programming',
      'Ownership & Lifetimes',
      'Tokio Async Runtime',
      'Concurrency without Data Races',
      'Zero-Cost Abstractions'
    ],
    learning_path: [
      'Internalize the borrow checker rules: one mutable reference OR multiple immutable references.',
      'Master smart pointers: Box<T>, Rc<T>, Arc<T>, and interior mutability with RefCell<T> / Mutex<T>.',
      'Understand async Rust: Futures, pin projection, and the Tokio event-driven multi-threaded runtime.',
      'Build a concurrent network server using tokio::net::TcpListener and async channels.'
    ],
    methodology:
      'Evaluated 20+ advanced systems programming videos, focusing on memory safety guarantees, concurrency benchmarks, and compiler diagnostics analysis.',
    limitations: [
      'Steep initial learning curve for engineers accustomed to garbage-collected languages.'
    ],
    conclusion:
      'Rust combined with Tokio provides the most reliable foundation for high-throughput, memory-safe backend infrastructure.'
  }
}

const FAQS = [
  {
    q: 'How does ResearchTube understand YouTube videos?',
    a: 'Instead of making you watch 45-minute videos, ResearchTube automatically extracts the complete spoken words from video transcripts across resilient proxy layers. It then analyzes the text using Gemini 2.5 Flash, evaluates technical accuracy, extracts key concepts, and produces a structured research report with direct video links in seconds.',
  },
  {
    q: 'What is Hybrid Search and why does it give better answers?',
    a: 'Traditional keyword search misses related ideas when the wording differs, while pure AI vector search can miss exact code names or specific tools. ResearchTube combines both: PostgreSQL pgvector handles 768-dimensional dense semantic vectors, and PostgreSQL full-text search indexes exact words. We fuse the results using Reciprocal Rank Fusion (RRF) for pinpoint accuracy.',
  },
  {
    q: 'Can I paste my own YouTube video links to analyze?',
    a: 'Yes! You are not limited to automatic search results. In both the Research and Chat sections, you can paste any YouTube URL or video ID (e.g. https://youtube.com/watch?v=...) to instantly ingest its transcript, explore its concepts on the knowledge graph, and chat with it.',
  },
  {
    q: 'How does the Video Scope AI Chat work?',
    a: 'You have three flexible ways to chat: (1) Specific Video Scope to interrogate a single video transcript with exact timestamp citations; (2) All Library Videos Scope to ask broad questions comparing all videos in your library; and (3) General Inquiry to brainstorm and explore technical concepts with the AI.',
  },
  {
    q: 'What is the Interactive Video Knowledge Graph?',
    a: 'The Knowledge Graph is a visual radial map that links your topic to every recommended video and the key technical concepts they teach. You can pan, zoom, click any concept to see which videos cover it, and expand into a distraction-free fullscreen view via a clean modal portal.',
  },
  {
    q: 'Can I share research reports publicly with others?',
    a: 'Yes! Every research run includes a public toggle. Enabling it gives you a clean shareable link that anyone can open in their browser to read the full report, browse ranked videos, and interact with the knowledge graph without needing an account.',
  },
]

export default function Landing() {
  const [selectedQuery, setSelectedQuery] = useState(EXAMPLE_QUERIES[0])
  const [isRunning, setIsRunning] = useState(false)
  const [simStep, setSimStep] = useState(0)
  const [openFaq, setOpenFaq] = useState<number | null>(0)

  // 17.5-second realistic pipeline run execution (Agent 1: 5.5s, Agent 2: 6.0s, Agent 3: 6.0s)
  const handleStartPipeline = (query: string) => {
    setSelectedQuery(query)
    setIsRunning(true)
    setSimStep(1)

    setTimeout(() => setSimStep(2), 5500)
    setTimeout(() => setSimStep(3), 11500)
    setTimeout(() => {
      setSimStep(4)
      setIsRunning(false)
    }, 17500)
  }

  const handleQuerySelect = (query: string) => {
    if (isRunning) return
    setSelectedQuery(query)
    setSimStep(0)
  }

  const activeDemoReport = DEMO_REPORTS[selectedQuery]

  return (
    <div className="min-h-screen bg-black text-white selection:bg-white selection:text-black">
      <Navbar />

      {/* Hero Section */}
      <section className="relative mx-auto max-w-6xl px-6 pt-16 pb-20 md:pt-24 md:pb-24">
        {/* Subtle Ambient Background Light */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -z-10 h-96 w-96 rounded-full bg-white/[0.02] blur-[140px] pointer-events-none" />

        <div className="max-w-4xl">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-[#282828] bg-[#111111] px-3.5 py-1.5 text-[11px] font-mono font-medium text-zinc-300 mb-6">
            <Sparkles className="h-3 w-3 text-white" />
            <span>AI-POWERED MULTI-AGENT VIDEO INTELLIGENCE</span>
          </div>

          {/* Heading */}
          <h1 className="text-4xl sm:text-6xl lg:text-[70px] font-extrabold tracking-tight leading-[1.06] text-white">
            Skip the fluff.
            <br />
            <span className="text-zinc-400">
              Research YouTube 10x faster.
            </span>
          </h1>

          {/* Subtitle */}
          <p className="mt-6 max-w-2xl text-base sm:text-lg leading-relaxed text-[#999999]">
            Turn hours of long technical YouTube videos into structured research reports, interactive concept maps, and conversational video chat in seconds.
          </p>

          {/* Action Buttons */}
          <div className="mt-8 flex flex-wrap items-center gap-3.5">
            <Link to="/register">
              <Button>
                Get Started Free <ArrowRight className="ml-2 inline h-4 w-4" />
              </Button>
            </Link>

            <Button variant="secondary" onClick={startGoogleLogin}>
              Continue with Google
            </Button>

            {/* GitHub Button */}
            <a
              href="https://github.com/saketjha34/ResearchTube"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-[#222222] bg-[#0c0c0c] px-4 py-2.5 text-sm font-semibold text-zinc-300 hover:border-[#444444] hover:text-white hover:bg-[#141414] transition-all shadow-sm"
            >
              <GithubIcon className="h-4 w-4 text-white" />
              <span>GitHub Repo</span>
            </a>

            <Link
              to="/login"
              className="inline-flex items-center text-sm font-semibold text-[#888888] hover:text-white transition-colors ml-1"
            >
              Sign in →
            </Link>
          </div>

          {/* Tech Highlights Row (Clean Minimalist Monochrome) */}
          <div className="mt-10 flex flex-wrap items-center gap-6 border-t border-[#181818] pt-6 text-xs text-[#888888]">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
              <span className="text-zinc-300 font-medium">7-Node LangGraph Multi-Agent</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
              <span className="text-zinc-300 font-medium">PostgreSQL pgvector + Hybrid RRF</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
              <span className="text-zinc-300 font-medium">Interactive Knowledge Graph</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
              <span className="text-zinc-300 font-medium">Conversational AI Video Chat</span>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Pipeline Demo Component */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="rounded-3xl border border-[#222222] bg-[#0c0c0c] p-8 sm:p-12 md:p-14 shadow-2xl">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border-b border-[#181818] pb-8">
            <div>
              <span className="text-xs font-semibold tracking-[0.2em] text-zinc-400 uppercase">
                INTERACTIVE DEMO
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
                Multi-Agent Pipeline in Action
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-[#888888] max-w-md leading-relaxed">
              Select a sample topic and click Run Pipeline to watch Agent 1, Agent 2, and Agent 3 collaborate in real time.
            </p>
          </div>

          {/* Query Selector Tabs */}
          <div className="mt-8 flex flex-wrap gap-2.5">
            {EXAMPLE_QUERIES.map((q) => (
              <button
                key={q}
                onClick={() => handleQuerySelect(q)}
                disabled={isRunning}
                className={`rounded-xl border px-4 py-2.5 text-xs font-medium transition-all cursor-pointer ${
                  selectedQuery === q
                    ? 'border-white bg-[#222222] text-white shadow-sm'
                    : 'border-[#222222] bg-[#141414] text-zinc-400 hover:border-[#444444] hover:text-white'
                }`}
              >
                <Search className="mr-2 inline h-3.5 w-3.5 text-zinc-300" />
                {q}
              </button>
            ))}
          </div>

          {/* Execution Box */}
          <div className="mt-8 rounded-2xl border border-[#222222] bg-black p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1c1c1c] pb-5">
              <div className="flex items-center gap-2.5 text-xs text-zinc-400 font-mono">
                <Terminal className="h-4 w-4 text-zinc-300" />
                <span className="truncate max-w-xs sm:max-w-md">LangGraph Thread: {selectedQuery}</span>
              </div>
              <button
                onClick={() => handleStartPipeline(selectedQuery)}
                disabled={isRunning}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-2.5 text-xs font-bold text-black hover:bg-zinc-200 transition-colors disabled:opacity-50 cursor-pointer shadow-md"
              >
                {isRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5 fill-black" />}
                {isRunning ? 'Executing Agents...' : 'Run Pipeline'}
              </button>
            </div>

            {/* Stepper Progress Visualizer (Clean Soothing Monochrome) */}
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {/* Step 1: Agent 1 */}
              <div
                className={`rounded-xl border p-5 transition-all ${
                  simStep >= 1
                    ? 'border-white/30 bg-[#161616] shadow-sm'
                    : 'border-[#1c1c1c] bg-[#0c0c0c] opacity-50'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-white font-bold">Agent 1: YouTube Researcher</span>
                  {simStep === 1 ? (
                    <Activity className="h-4 w-4 animate-spin text-white" />
                  ) : simStep > 1 ? (
                    <CheckCircle2 className="h-4 w-4 text-white" />
                  ) : (
                    <span className="text-zinc-600">Pending</span>
                  )}
                </div>
                <p className="mt-3 text-xs text-zinc-300 leading-relaxed">
                  Queries YouTube v3 API, extracts transcripts, rotates proxies across 3 fallback layers.
                </p>
              </div>

              {/* Step 2: Agent 2 */}
              <div
                className={`rounded-xl border p-5 transition-all ${
                  simStep >= 2
                    ? 'border-white/30 bg-[#161616] shadow-sm'
                    : 'border-[#1c1c1c] bg-[#0c0c0c] opacity-50'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-white font-bold">Agent 2: RAG Evaluator</span>
                  {simStep === 2 ? (
                    <Activity className="h-4 w-4 animate-spin text-white" />
                  ) : simStep > 2 ? (
                    <CheckCircle2 className="h-4 w-4 text-white" />
                  ) : (
                    <span className="text-zinc-600">Pending</span>
                  )}
                </div>
                <p className="mt-3 text-xs text-zinc-300 leading-relaxed">
                  Chunks text, computes 768d embeddings, queries pgvector Cosine Distance and full-text index.
                </p>
              </div>

              {/* Step 3: Agent 3 */}
              <div
                className={`rounded-xl border p-5 transition-all ${
                  simStep >= 3
                    ? 'border-white/30 bg-[#161616] shadow-sm'
                    : 'border-[#1c1c1c] bg-[#0c0c0c] opacity-50'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-white font-bold">Agent 3: Synthesizer</span>
                  {simStep === 3 ? (
                    <Activity className="h-4 w-4 animate-spin text-white" />
                  ) : simStep > 3 ? (
                    <CheckCircle2 className="h-4 w-4 text-white" />
                  ) : (
                    <span className="text-zinc-600">Pending</span>
                  )}
                </div>
                <p className="mt-3 text-xs text-zinc-300 leading-relaxed">
                  Combines verified chunk evidence & metrics into a publication-ready research report.
                </p>
              </div>
            </div>

            {/* Live Compiled Report Output */}
            {simStep === 4 && activeDemoReport && (
              <div className="mt-10 border-t border-[#1c1c1c] pt-8 animate-fade-in text-left">
                <div className="mb-6 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold tracking-wider text-white uppercase">
                    <CheckCircle2 size={16} /> Compiled Research Output
                  </div>
                  <span className="text-[10px] font-mono text-zinc-500 uppercase">Live Execution Result</span>
                </div>
                <ReportView report={activeDemoReport} query={selectedQuery} />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Core Platform Capabilities Section (6 Spacious Cards) */}
      <section className="border-t border-[#181818] py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-semibold tracking-[0.2em] text-zinc-400 uppercase">
              POWERFUL FEATURES
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white mt-2">
              Engineered for Serious Research
            </h2>
            <p className="mt-4 text-sm text-[#888888] leading-relaxed">
              Everything you need to turn unsearchable YouTube videos into structured intelligence you can review, explore, and query.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {/* Card 1 */}
            <div className="border border-[#222222] bg-[#0c0c0c] p-8 rounded-2xl hover:border-[#383838] transition-all group flex flex-col justify-between">
              <div>
                <div className="h-10 w-10 rounded-xl bg-[#161616] border border-[#262626] flex items-center justify-center mb-6 text-white group-hover:scale-110 transition-transform">
                  <BrainCircuit size={20} />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">7-Node LangGraph Multi-Agent</h3>
                <p className="text-sm text-[#888888] leading-relaxed">
                  Three specialized AI agents execute in sequence to search, evaluate video quality, and synthesize concise reports with learning paths.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-[#181818] text-xs font-mono text-zinc-400">
                Tech: LangGraph DAG • Gemini 2.5 Flash
              </div>
            </div>

            {/* Card 2 */}
            <div className="border border-[#222222] bg-[#0c0c0c] p-8 rounded-2xl hover:border-[#383838] transition-all group flex flex-col justify-between">
              <div>
                <div className="h-10 w-10 rounded-xl bg-[#161616] border border-[#262626] flex items-center justify-center mb-6 text-white group-hover:scale-110 transition-transform">
                  <Database size={20} />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Hybrid Semantic & Keyword Search</h3>
                <p className="text-sm text-[#888888] leading-relaxed">
                  Finds answers both by concept meaning (dense vectors) and exact technical terms (full-text search) fused via Reciprocal Rank Fusion.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-[#181818] text-xs font-mono text-zinc-400">
                Tech: PostgreSQL pgvector + GIN tsvector (RRF)
              </div>
            </div>

            {/* Card 3 */}
            <div className="border border-[#222222] bg-[#0c0c0c] p-8 rounded-2xl hover:border-[#383838] transition-all group flex flex-col justify-between">
              <div>
                <div className="h-10 w-10 rounded-xl bg-[#161616] border border-[#262626] flex items-center justify-center mb-6 text-white group-hover:scale-110 transition-transform">
                  <Network size={20} />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Interactive Knowledge Graph</h3>
                <p className="text-sm text-[#888888] leading-relaxed">
                  Visual radial graph connecting topics, videos, and key curriculum concepts with smooth pan, zoom, and a portal-based fullscreen mode.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-[#181818] text-xs font-mono text-zinc-400">
                Tech: SVG Radial Layout • React Portal Fullscreen
              </div>
            </div>

            {/* Card 4 */}
            <div className="border border-[#222222] bg-[#0c0c0c] p-8 rounded-2xl hover:border-[#383838] transition-all group flex flex-col justify-between">
              <div>
                <div className="h-10 w-10 rounded-xl bg-[#161616] border border-[#262626] flex items-center justify-center mb-6 text-white group-hover:scale-110 transition-transform">
                  <MessageSquare size={20} />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Multi-Scope AI Video Chat</h3>
                <p className="text-sm text-[#888888] leading-relaxed">
                  Ask questions about a specific video transcript, compare insights across all videos in your library, or explore general inquiries.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-[#181818] text-xs font-mono text-zinc-400">
                Tech: Flexible Scope Selector • Timestamp Citations
              </div>
            </div>

            {/* Card 5 */}
            <div className="border border-[#222222] bg-[#0c0c0c] p-8 rounded-2xl hover:border-[#383838] transition-all group flex flex-col justify-between">
              <div>
                <div className="h-10 w-10 rounded-xl bg-[#161616] border border-[#262626] flex items-center justify-center mb-6 text-white group-hover:scale-110 transition-transform">
                  <LinkIcon size={20} />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Custom YouTube URL Linker</h3>
                <p className="text-sm text-[#888888] leading-relaxed">
                  Paste any YouTube video link or ID directly into ResearchTube to analyze private, unlisted, or niche tutorials on the fly.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-[#181818] text-xs font-mono text-zinc-400">
                Tech: Dynamic URL Ingestion • Video ID Parser
              </div>
            </div>

            {/* Card 6 */}
            <div className="border border-[#222222] bg-[#0c0c0c] p-8 rounded-2xl hover:border-[#383838] transition-all group flex flex-col justify-between">
              <div>
                <div className="h-10 w-10 rounded-xl bg-[#161616] border border-[#262626] flex items-center justify-center mb-6 text-white group-hover:scale-110 transition-transform">
                  <BarChart3 size={20} />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Chat Analytics & Mastery Tracking</h3>
                <p className="text-sm text-[#888888] leading-relaxed">
                  Track your learning milestones with metrics on research time saved, questions asked, token efficiency, and key concepts mastered.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-[#181818] text-xs font-mono text-zinc-400">
                Tech: Profile Analytics • Concept Aggregator
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Comparison Section (Old Way vs ResearchTube) */}
      <section className="border-t border-[#181818] py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-semibold tracking-[0.2em] text-zinc-400 uppercase">
              THE DIFFERENCE
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white mt-2">
              Why Switch to ResearchTube?
            </h2>
            <p className="mt-4 text-sm text-[#888888] leading-relaxed">
              Stop losing hours to YouTube playback speed tricks and manual scrubbing. Let intelligent agents do the reading.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2">
            {/* Old Way */}
            <div className="rounded-3xl border border-[#222222] bg-[#0c0c0c] p-8 sm:p-10 md:p-12">
              <div className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-[#141414] px-3.5 py-1 text-xs font-semibold text-zinc-400 mb-6">
                Watching YouTube the Old Way
              </div>
              <ul className="space-y-5 text-sm text-[#888888]">
                <li className="flex items-start gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-zinc-600 flex-shrink-0" />
                  <span>Watching 45-minute videos at 2x speed hoping the creator eventually gets to the code.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-zinc-600 flex-shrink-0" />
                  <span>Relying on clickbait video titles that leave out critical architectural limitations.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-zinc-600 flex-shrink-0" />
                  <span>Taking messy handwritten notes with zero way to search across multiple videos later.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-zinc-600 flex-shrink-0" />
                  <span>No way to ask follow-up questions without leaving a comment and waiting days for a reply.</span>
                </li>
              </ul>
            </div>

            {/* ResearchTube Way */}
            <div className="rounded-3xl border border-[#333333] bg-[#121212] p-8 sm:p-10 md:p-12">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1 text-xs font-semibold text-white mb-6">
                Researching with ResearchTube
              </div>
              <ul className="space-y-5 text-sm text-zinc-200">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-white flex-shrink-0 mt-0.5" />
                  <span>Get a structured research report with strengths, limitations, and learning paths in ~15s.</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-white flex-shrink-0 mt-0.5" />
                  <span>Objective AI evaluation scores videos on technical depth and educational quality from 1 to 10.</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-white flex-shrink-0 mt-0.5" />
                  <span>Explore concepts visually on a 2D knowledge graph to discover connections between topics.</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-white flex-shrink-0 mt-0.5" />
                  <span>Chat directly with video transcripts and get immediate answers with exact clickable timestamps.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Accordion Section */}
      <section className="border-t border-[#181818] py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs font-semibold tracking-[0.2em] text-zinc-400 uppercase">
              FREQUENTLY ASKED QUESTIONS
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white mt-2">
              Everything You Need to Know
            </h2>
            <p className="mt-4 text-sm text-[#888888] leading-relaxed">
              Straightforward answers to the most common questions about ResearchTube.
            </p>
          </div>

          <div className="max-w-3xl mx-auto space-y-4">
            {FAQS.map((faq, idx) => (
              <div
                key={idx}
                className="border border-[#222222] bg-[#0c0c0c] rounded-2xl overflow-hidden transition-colors"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="flex w-full items-center justify-between p-6 text-left text-sm font-semibold text-white hover:bg-[#141414] transition-colors cursor-pointer"
                >
                  <span>{faq.q}</span>
                  <ChevronDown
                    className={`h-4 w-4 text-zinc-400 transition-transform duration-200 ${
                      openFaq === idx ? 'rotate-180 text-white' : ''
                    }`}
                  />
                </button>
                {openFaq === idx && (
                  <div className="px-6 pb-6 pt-2 text-sm text-[#999999] leading-relaxed border-t border-[#181818] animate-fade-in">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t border-[#181818] bg-black py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-6 text-center">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
              Transform how you learn from YouTube.
            </h2>
            <p className="mt-4 text-sm sm:text-base text-[#888888] leading-relaxed">
              Join developers, students, and engineers using ResearchTube to master complex technical subjects in a fraction of the time.
            </p>
            <div className="mt-8 flex justify-center gap-4">
              <Link to="/register">
                <Button>
                  Get Started Free <ArrowRight className="ml-2 inline h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
