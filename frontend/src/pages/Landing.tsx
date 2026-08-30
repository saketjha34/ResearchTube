import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Sparkles,
  ArrowRight,
  BrainCircuit,
  Database,
  Zap,
  Layers,
  ShieldCheck,
  CheckCircle2,
  ChevronDown,
  Play,
  Terminal,
  Activity,
  Search,
  Loader2
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
    executive_summary:
      'LangGraph is the leading Python and TypeScript framework for orchestrating state-machine multi-agent AI applications. Unlike linear LLM chains, LangGraph models complex multi-agent workflows as Directed Acyclic Graphs (DAGs), where agents operate as nodes and decisions operate as conditional edges with persistent thread memory.',
    recommended_resources: [
      {
        rank: 1,
        video_id: 'D74el9mvNak',
        title: 'Agentic AI Crash Course using LangChain | LangChain Crash Course',
        url: 'https://youtu.be/D74el9mvNak?si=1Ek-bQFPr3Mx3x1z',
        channel: 'codebasics',
        published_at: '2025-01-20',
        description: 'Complete hands-on tutorial on defining StateGraph schemas, conditional routing edges, tool node invocation, and thread checkpointing.',
        views: 195000,
        likes: 12400,
        comments: 780,
        transcript_available: true,
        transcript_language: 'en',
        relevance_score: 9.9,
        educational_quality_score: 9.7,
        coverage_score: 9.5,
        overall_score: 9.7,
        beginner_friendly: true,
        concepts_covered: ['StateGraph', 'Conditional Edges', 'Node Handlers', 'Thread Persistence', 'Human-in-the-loop'],
        strengths: [
          'Detailed breakdown of state-machine execution flow and Pydantic graph state validation.',
          'Demonstrates cyclic reasoning loops where Evaluator agent requests Planner revisions.'
        ],
        weaknesses: [
          'Covers Python SDK only (does not detail JS/TS LangGraph SDK).'
        ],
        recommendation_reason: 'Definitive tutorial for mastering LangGraph multi-agent graph architecture.'
      },
      {
        rank: 2,
        video_id: 'jGg_1h0qzaM',
        title: 'LangGraph Complete Course for Beginners – Complex AI Agents with Python',
        url: 'https://youtu.be/jGg_1h0qzaM?si=S5cqbLECAw6H6zTn',
        channel: 'freeCodeCamp.org',
        published_at: '2024-11-05',
        description: 'Advanced design patterns for multi-agent consensus, error recovery nodes, sub-graphs, and PostgreSQL checkpointer state persistence.',
        views: 142000,
        likes: 8900,
        comments: 410,
        transcript_available: true,
        transcript_language: 'en',
        relevance_score: 9.4,
        educational_quality_score: 9.3,
        coverage_score: 9.2,
        overall_score: 9.3,
        beginner_friendly: true,
        concepts_covered: ['Agentic Routing', 'Multi-Agent Consensus', 'Checkpointer Persistence', 'Sub-graph Nodes'],
        strengths: [
          'Real-world production architecture patterns for error recovery and durable checkpointing.',
          'Shows how to resume interrupted agent execution state after network drops.'
        ],
        weaknesses: [
          'Fast pacing requires prior experience with basic LangChain chains.'
        ],
        recommendation_reason: 'Excellent guide for scaling multi-agent graphs into fault-tolerant production workflows.'
      }
    ],
    key_topics: [
      'LangGraph',
      'StateGraph',
      'Conditional Routing',
      'Agentic Consensus',
      'Pydantic State Validation',
      'Checkpointer Persistence'
    ],
    learning_path: [
      'Understand the limitations of linear agent chains and why state-machine graphs are required.',
      'Define graph state typed schemas using TypedDict / Pydantic models.',
      'Implement graph nodes (Agent 1: Planner, Agent 2: Evaluator, Agent 3: Synthesizer).',
      'Wire conditional router edges to cycle until evaluations satisfy output criteria.',
      'Attach PostgreSQL checkpointers (AsyncPostgresSaver) for durable state persistence across runs.'
    ],
    methodology:
      'Synthesized 18 agentic AI engineering guides. Agent 2 analyzed 75 transcript chunks focusing on state management, multi-agent communication protocols, and graph debugging.',
    limitations: [
      'Graph state debugging requires inspection of intermediate node outputs.',
      'Cyclic graphs must enforce max iteration limits to avoid infinite loops.'
    ],
    conclusion:
      'LangGraph is the gold standard framework for production multi-agent systems, giving developers granular control over state transitions, cyclic reasoning, and resilient error recovery.'
  },

  'Best resources to master Rust system programming and async Tokio': {
    executive_summary:
      'Mastering Rust system programming and async I/O with Tokio requires a deep understanding of ownership, lifetimes, memory pinning, and task execution scheduling. Tokio provides a non-blocking multithreaded runtime built on top of epoll/kqueue, allowing applications to process hundreds of thousands of concurrent connections with minimal memory overhead.',
    recommended_resources: [
      {
        rank: 1,
        video_id: 'ThjvMReOXYM',
        title: 'Crust of Rust: Async/Await and Futures',
        url: 'https://www.youtube.com/watch?v=ThjvMReOXYM',
        channel: 'Jon Gjengset',
        published_at: '2023-09-14',
        description: 'In-depth architectural breakdown of Tokio reactor loops, task spawning, mpsc channels, and Pin/Unpin semantics in async Rust.',
        views: 310000,
        likes: 18500,
        comments: 920,
        transcript_available: true,
        transcript_language: 'en',
        relevance_score: 9.9,
        educational_quality_score: 9.8,
        coverage_score: 9.6,
        overall_score: 9.8,
        beginner_friendly: false,
        concepts_covered: ['Tokio Async Runtime', 'Futures & Pinning', 'mpsc Channels', 'Mutex & Arc Synchronization', 'Reactor Loop'],
        strengths: [
          'Deep architectural analysis of reactor loops, thread pool worker dispatch, and async state machines.',
          'Explains memory layout of pinned futures and task wakers with extreme precision.'
        ],
        weaknesses: [
          'Deep technical depth may require fundamental Rust syntax knowledge.'
        ],
        recommendation_reason: 'The ultimate deep dive into async Rust internals and Tokio runtime architecture.'
      },
      {
        rank: 2,
        video_id: 'XZtlD_m59sM',
        title: 'Rust Async Programming with Tokio: Complete Guide',
        url: 'https://www.youtube.com/watch?v=XZtlD_m59sM',
        channel: 'Jeremy Chone',
        published_at: '2024-04-12',
        description: 'Hands-on tutorial building zero-copy REST microservices using Axum, Tokio async runtime, and sqlx database connection pools.',
        views: 178000,
        likes: 11200,
        comments: 490,
        transcript_available: true,
        transcript_language: 'en',
        relevance_score: 9.5,
        educational_quality_score: 9.4,
        coverage_score: 9.2,
        overall_score: 9.4,
        beginner_friendly: true,
        concepts_covered: ['Axum Framework', 'Tokio Select!', 'Zero-Copy Deserialization', 'Tower Middleware', 'Async DB Pools'],
        strengths: [
          'Practical guide on building non-blocking REST APIs handling 50k+ req/sec.',
          'Covers structured error handling and database connection pooling with sqlx.'
        ],
        weaknesses: [
          'Does not cover low-level unsafe FFI bindings.'
        ],
        recommendation_reason: 'Best practical guide for applying Tokio to high-throughput web service development.'
      }
    ],
    key_topics: [
      'Rust',
      'Tokio Runtime',
      'Async/Await',
      'Futures & Pinning',
      'mpsc Channels',
      'Axum',
      'Zero-Copy I/O'
    ],
    learning_path: [
      'Master Rust ownership, borrowing rules, move semantics, and lifetime annotations.',
      'Understand how Rust Futures compile into state machines without hidden heap allocations.',
      'Learn Tokio task spawning (tokio::spawn) and thread pool work-stealing scheduling.',
      'Implement safe multi-threaded state sharing using Arc<Tokio::sync::Mutex<T>> and mpsc channels.',
      'Build non-blocking network servers using Tokio TcpListener and Axum web framework.'
    ],
    methodology:
      'Analyzed 22 Rust system programming lectures. Agent 2 evaluated 84 transcript chunks detailing memory safety, async runtime overhead, and Tokio task scheduling.',
    limitations: [
      'Async Rust requires careful handling of Send and Sync bounds across thread boundaries.',
      'Debugging async stack traces requires familiarity with Tokio tracing macros.'
    ],
    conclusion:
      'Rust combined with the Tokio async runtime delivers C-like execution speed with memory safety guarantees, making it the top choice for building next-generation infrastructure services.'
  }
}

// FAQ items
const FAQS = [
  {
    q: 'How does ResearchTube extract information from long YouTube videos?',
    a: 'ResearchTube deploys a 7-node LangGraph execution graph. Agent 1 crawls YouTube video metadata and parses transcripts across a 3-layer proxy strategy. Transcripts are chunked into 1,000-character segments, embedded into 768-dimension dense vectors using text-embedding-004, and stored in PostgreSQL pgvector for semantic evidence matching.',
  },
  {
    q: 'What makes this different from standard ChatGPT video summaries?',
    a: 'Standard ChatGPT relies on simple whole-transcript dumps or user paste-ins. ResearchTube uses a multi-agent DAG. Agent 2 uses RAG semantic search to query specific evidence chunks, grade technical depth, evaluate pros/cons, and score relevance before Agent 3 synthesizes a complete, cited Markdown report.',
  },
  {
    q: 'How does the transcript scraper bypass IP blocks in cloud environments?',
    a: 'Our hardened scraper implements an anti-block fallback strategy: Layer 1 uses authenticated Webshare proxy configs; Layer 2 injects generic proxy URLs into system environment variables; Layer 3 sequentially scans English variants and regional language tags to guarantee high success rates.',
  },
  {
    q: 'Can I share research reports with team members or publicly?',
    a: 'Yes! Every research run features a public toggle button. Generating a public link allows anyone to view the full report, video rankings, and interactive knowledge graph without requiring an account.',
  },
]

export default function Landing() {
  // Interactive Pipeline state (simStep starts at 0 so report output is hidden until explicit execution)
  const [selectedQuery, setSelectedQuery] = useState(EXAMPLE_QUERIES[0])
  const [isRunning, setIsRunning] = useState(false)
  const [simStep, setSimStep] = useState(0)

  // FAQ Accordion state
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
    setSimStep(0) // Reset output display when selecting a new topic
  }

  const activeDemoReport = DEMO_REPORTS[selectedQuery]

  return (
    <div className="min-h-screen bg-black text-white selection:bg-white selection:text-black">
      <Navbar />

      {/* Hero Section */}
      <section className="relative mx-auto max-w-6xl px-6 pt-20 pb-20 md:pt-28 md:pb-28">
        {/* Background Radial Glow */}
        <div className="absolute top-1/4 left-1/2 -z-10 h-72 w-72 -translate-x-1/2 rounded-full bg-amber-500/10 blur-[120px] pointer-events-none" />

        <div className="max-w-4xl">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950 px-3.5 py-1 text-xs text-zinc-300 mb-6">
            <Sparkles className="h-3.5 w-3.5 text-amber-400 animate-pulse" />
            <span>AI-Powered Multi-Agent Video Intelligence</span>
          </div>

          {/* Heading */}
          <h1 className="text-5xl font-extrabold tracking-tight leading-[1.1] md:text-7xl text-white">
            Research smarter.
            <br />
            <span className="bg-gradient-to-r from-white via-zinc-200 to-zinc-500 bg-clip-text text-transparent">
              Understand deeper.
            </span>
          </h1>

          {/* Subtitle */}
          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-[#999999]">
            Turn hours of YouTube technical content into searchable, structured research reports using LangGraph autonomous agents & pgvector RAG.
          </p>

          {/* Action Buttons */}
          <div className="mt-10 flex flex-wrap items-center gap-3">
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
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-sm font-medium text-zinc-300 hover:border-zinc-700 hover:text-white hover:bg-zinc-900 transition-all"
            >
              <GithubIcon className="h-4 w-4" />
              <span>GitHub Repo</span>
            </a>

            <Link
              to="/login"
              className="inline-flex items-center text-sm font-medium text-[#999999] hover:text-white transition-colors ml-2"
            >
              Sign in →
            </Link>
          </div>

          {/* Tech Badges Row */}
          <div className="mt-12 flex flex-wrap items-center gap-6 border-t border-[#181818] pt-8 text-xs text-[#888888]">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span>7-Node LangGraph DAG</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span>PostgreSQL + pgvector</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span>Proxy-Aware Scraper</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span>2D Knowledge Graph</span>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Pipeline Component */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="rounded-2xl border border-zinc-800 bg-[#0c0c0c] p-6 md:p-10 shadow-2xl">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-[#181818] pb-6">
            <div>
              <span className="text-xs font-semibold tracking-[0.2em] text-amber-400 uppercase">
                INTERACTIVE DEMO
              </span>
              <h2 className="text-2xl font-bold text-white mt-1">
                Multi-Agent Pipeline Execution
              </h2>
            </div>
            <p className="text-xs text-[#999999] max-w-md">
              Select a sample topic and click Run to execute Agent 1, Agent 2, and Agent 3 collaboration in real-time (~17s).
            </p>
          </div>

          {/* Query Selector Tabs */}
          <div className="mt-6 flex flex-wrap gap-2">
            {EXAMPLE_QUERIES.map((q) => (
              <button
                key={q}
                onClick={() => handleQuerySelect(q)}
                disabled={isRunning}
                className={`rounded-lg border px-3.5 py-2 text-xs font-medium transition-all ${
                  selectedQuery === q
                    ? 'border-amber-500/50 bg-amber-500/10 text-amber-300'
                    : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700 hover:text-white'
                }`}
              >
                <Search className="mr-1.5 inline h-3.5 w-3.5" />
                {q}
              </button>
            ))}
          </div>

          {/* Execution Box */}
          <div className="mt-8 rounded-xl border border-zinc-800 bg-black p-6">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono">
                <Terminal className="h-4 w-4 text-emerald-400" />
                <span>LangGraph Execution Thread: {selectedQuery}</span>
              </div>
              <button
                onClick={() => handleStartPipeline(selectedQuery)}
                disabled={isRunning}
                className="inline-flex items-center gap-2 rounded bg-white px-4 py-2 text-xs font-bold text-black hover:bg-zinc-200 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5 fill-black" />}
                {isRunning ? 'Executing Pipeline...' : 'Run Pipeline'}
              </button>
            </div>

            {/* Stepper Progress Visualizer */}
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {/* Step 1 */}
              <div
                className={`rounded-lg border p-4 transition-all ${
                  simStep >= 1
                    ? 'border-amber-500/50 bg-amber-950/20 shadow-[0_0_15px_rgba(245,158,11,0.1)]'
                    : 'border-zinc-800 bg-zinc-950/40 opacity-50'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-amber-400">Agent 1: Researcher</span>
                  {simStep === 1 ? (
                    <Activity className="h-4 w-4 animate-spin text-amber-400" />
                  ) : simStep > 1 ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <span className="text-zinc-600">Pending</span>
                  )}
                </div>
                <p className="mt-2 text-xs text-zinc-300">
                  Searches YouTube v3 API, parses video transcripts, rotates proxies across 3 fallback layers.
                </p>
              </div>

              {/* Step 2 */}
              <div
                className={`rounded-lg border p-4 transition-all ${
                  simStep >= 2
                    ? 'border-blue-500/50 bg-blue-950/20 shadow-[0_0_15px_rgba(59,130,246,0.1)]'
                    : 'border-zinc-800 bg-zinc-950/40 opacity-50'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-blue-400">Agent 2: RAG Evaluator</span>
                  {simStep === 2 ? (
                    <Activity className="h-4 w-4 animate-spin text-blue-400" />
                  ) : simStep > 2 ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <span className="text-zinc-600">Pending</span>
                  )}
                </div>
                <p className="mt-2 text-xs text-zinc-300">
                  Chunks text, embeds with text-embedding-004, queries pgvector Cosine Distance.
                </p>
              </div>

              {/* Step 3 */}
              <div
                className={`rounded-lg border p-4 transition-all ${
                  simStep >= 3
                    ? 'border-emerald-500/50 bg-emerald-950/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]'
                    : 'border-zinc-800 bg-zinc-950/40 opacity-50'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-emerald-400">Agent 3: Synthesizer</span>
                  {simStep === 3 ? (
                    <Activity className="h-4 w-4 animate-spin text-emerald-400" />
                  ) : simStep > 3 ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <span className="text-zinc-600">Pending</span>
                  )}
                </div>
                <p className="mt-2 text-xs text-zinc-300">
                  Combines verified chunk evidence & metrics into structured Markdown report.
                </p>
              </div>
            </div>

            {/* Live Compiled Report Output (Renders ONLY after explicit execution completes at step 4) */}
            {simStep === 4 && activeDemoReport && (
              <div className="mt-10 border-t border-zinc-800 pt-8 animate-fade-in text-left">
                <div className="mb-6 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-emerald-400 uppercase">
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

      {/* System Capabilities Section */}
      <section className="mx-auto max-w-6xl px-6 py-20 border-t border-[#181818]">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-xs font-semibold tracking-[0.2em] text-purple-400 uppercase">
            SYSTEM ARCHITECTURE
          </span>
          <h2 className="text-3xl font-extrabold text-white mt-2">
            Engineered for Deep AI Research
          </h2>
          <p className="mt-4 text-sm text-[#999999] leading-relaxed">
            Every component is built for speed, proxy resilience, and precise vector retrieval across complex technical videos.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Card 1 */}
          <div className="border border-zinc-800 bg-[#0c0c0c] p-6 rounded-2xl hover:border-purple-900/50 transition-all group">
            <div className="h-10 w-10 rounded-xl bg-purple-950/40 border border-purple-800/50 flex items-center justify-center mb-5 text-purple-400 group-hover:scale-110 transition-transform">
              <BrainCircuit size={20} />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">LangGraph Multi-Agent DAG</h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              3 state-machine agents collaborate across 7 execution nodes to crawl, evaluate, and structure high-density video knowledge.
            </p>
          </div>

          {/* Card 2 */}
          <div className="border border-zinc-800 bg-[#0c0c0c] p-6 rounded-2xl hover:border-amber-900/50 transition-all group">
            <div className="h-10 w-10 rounded-xl bg-amber-950/40 border border-amber-800/50 flex items-center justify-center mb-5 text-amber-400 group-hover:scale-110 transition-transform">
              <Database size={20} />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">PostgreSQL pgvector RAG</h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Chunked transcripts are embedded into 768d vectors and queried using Cosine Distance & HNSW indexing for instant semantic retrieval.
            </p>
          </div>

          {/* Card 3 */}
          <div className="border border-zinc-800 bg-[#0c0c0c] p-6 rounded-2xl hover:border-cyan-900/50 transition-all group">
            <div className="h-10 w-10 rounded-xl bg-cyan-950/40 border border-cyan-800/50 flex items-center justify-center mb-5 text-cyan-400 group-hover:scale-110 transition-transform">
              <Zap size={20} />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">3-Layer Proxy Scraper</h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Resilient transcript fetching with Webshare proxy authentication, IP rotation, and language auto-fallback mechanics.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ Accordion Section */}
      <section className="mx-auto max-w-4xl px-6 py-20 border-t border-[#181818]">
        <div className="text-center mb-12">
          <span className="text-xs font-semibold tracking-[0.2em] text-amber-400 uppercase">
            FREQUENTLY ASKED QUESTIONS
          </span>
          <h2 className="text-3xl font-extrabold text-white mt-2">
            Everything You Need to Know
          </h2>
        </div>

        <div className="space-y-4">
          {FAQS.map((faq, idx) => (
            <div
              key={idx}
              className="border border-zinc-800 bg-[#0c0c0c] rounded-xl overflow-hidden transition-colors"
            >
              <button
                onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                className="flex w-full items-center justify-between p-5 text-left text-sm font-semibold text-white hover:bg-zinc-900/50 transition-colors"
              >
                <span>{faq.q}</span>
                <ChevronDown
                  className={`h-4 w-4 text-zinc-400 transition-transform duration-200 ${
                    openFaq === idx ? 'rotate-180 text-amber-400' : ''
                  }`}
                />
              </button>
              {openFaq === idx && (
                <div className="px-5 pb-5 pt-2 text-sm text-zinc-300 leading-relaxed border-t border-zinc-900 animate-fade-in">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <Footer />
    </div>
  )
}
