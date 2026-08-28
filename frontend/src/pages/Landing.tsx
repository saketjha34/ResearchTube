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
} from 'lucide-react'
import Button from '../components/Button'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import GithubIcon from '../components/GithubIcon'
import { startGoogleLogin } from '../api/auth'

// Example queries for interactive simulator
const EXAMPLE_QUERIES = [
  'Designing Distributed Caching with Redis & FastAPI',
  'PostgreSQL pgvector vs Pinecone Vector Search',
  'Building Multi-Agent Workflows with LangGraph',
]

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
  // Interactive Simulator state
  const [selectedQuery, setSelectedQuery] = useState(EXAMPLE_QUERIES[0])
  const [isSimulating, setIsSimulating] = useState(false)
  const [simStep, setSimStep] = useState(0)

  // FAQ Accordion state
  const [openFaq, setOpenFaq] = useState<number | null>(0)

  const handleStartSimulation = (query: string) => {
    setSelectedQuery(query)
    setIsSimulating(true)
    setSimStep(1)

    setTimeout(() => setSimStep(2), 1200)
    setTimeout(() => setSimStep(3), 2400)
    setTimeout(() => {
      setSimStep(4)
      setIsSimulating(false)
    }, 3600)
  }

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

      {/* Interactive Simulator Component */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="rounded-2xl border border-zinc-800 bg-[#0c0c0c] p-6 md:p-10 shadow-2xl">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-[#181818] pb-6">
            <div>
              <span className="text-xs font-semibold tracking-[0.2em] text-amber-400 uppercase">
                INTERACTIVE DEMO
              </span>
              <h2 className="text-2xl font-bold text-white mt-1">
                Simulate Multi-Agent Pipeline Execution
              </h2>
            </div>
            <p className="text-xs text-[#999999] max-w-md">
              Select a sample topic to test how Agent 1, Agent 2, and Agent 3 collaborate in real-time.
            </p>
          </div>

          {/* Query Selector Tabs */}
          <div className="mt-6 flex flex-wrap gap-2">
            {EXAMPLE_QUERIES.map((q) => (
              <button
                key={q}
                onClick={() => handleStartSimulation(q)}
                disabled={isSimulating}
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

          {/* Execution Simulation Box */}
          <div className="mt-8 rounded-xl border border-zinc-800 bg-black p-6">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono">
                <Terminal className="h-4 w-4 text-emerald-400" />
                <span>LangGraph Execution Thread: {selectedQuery}</span>
              </div>
              <button
                onClick={() => handleStartSimulation(selectedQuery)}
                disabled={isSimulating}
                className="inline-flex items-center gap-1.5 rounded bg-white px-3 py-1 text-xs font-semibold text-black hover:bg-zinc-200 transition-colors disabled:opacity-50"
              >
                <Play className="h-3 w-3 fill-black" />
                {isSimulating ? 'Running Graph...' : 'Run Simulation'}
              </button>
            </div>

            {/* Stepper Progress Visualizer */}
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {/* Step 1 */}
              <div
                className={`rounded-lg border p-4 transition-all ${
                  simStep >= 1
                    ? 'border-amber-500/50 bg-amber-950/20'
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
                  Searches YouTube v3 API, parses 3 video transcripts, rotatings proxies.
                </p>
              </div>

              {/* Step 2 */}
              <div
                className={`rounded-lg border p-4 transition-all ${
                  simStep >= 2
                    ? 'border-blue-500/50 bg-blue-950/20'
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
                    ? 'border-emerald-500/50 bg-emerald-950/20'
                    : 'border-zinc-800 bg-zinc-950/40 opacity-50'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-emerald-400">Agent 3: Synthesizer</span>
                  {simStep === 3 ? (
                    <Activity className="h-4 w-4 animate-spin text-emerald-400" />
                  ) : simStep >= 4 ? (
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

            {/* Output log */}
            {simStep >= 4 && (
              <div className="mt-6 rounded-lg border border-emerald-500/30 bg-emerald-950/10 p-4 font-mono text-xs text-emerald-300 animate-fadeIn">
                <p className="font-semibold text-emerald-400">✓ Execution Completed (Run ID: 3d42a305-3d7f-4240)</p>
                <p className="mt-1 text-zinc-300">
                  Generated publication-grade markdown research report with video evidence citations & 2D concept knowledge graph.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Feature Showcase Grid */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-16 border-t border-[#181818]">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <p className="text-xs font-semibold tracking-[0.2em] text-[#999999] uppercase">
            PLATFORM CAPABILITIES
          </p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-white md:text-5xl">
            Everything you need for video research
          </h2>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          <article className="group rounded-2xl border border-[#181818] bg-[#0d0d0d] p-8 transition-all hover:border-zinc-700 hover:bg-[#111111]">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 w-fit text-amber-400">
              <BrainCircuit className="h-6 w-6" />
            </div>
            <p className="mt-6 text-xs tracking-[0.28em] text-[#999999] uppercase font-semibold">
              LANGGRAPH DAG
            </p>
            <h3 className="mt-2 text-lg font-bold text-white">Multi-Agent Workflow</h3>
            <p className="mt-3 text-sm leading-relaxed text-[#cfcfcf]">
              7-node state machine segregating query planning, video metadata extraction, chunk vectorization, RAG scoring, and report synthesis.
            </p>
          </article>

          <article className="group rounded-2xl border border-[#181818] bg-[#0d0d0d] p-8 transition-all hover:border-zinc-700 hover:bg-[#111111]">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 w-fit text-blue-400">
              <Database className="h-6 w-6" />
            </div>
            <p className="mt-6 text-xs tracking-[0.28em] text-[#999999] uppercase font-semibold">
              VECTOR RAG
            </p>
            <h3 className="mt-2 text-lg font-bold text-white">PostgreSQL + pgvector</h3>
            <p className="mt-3 text-sm leading-relaxed text-[#cfcfcf]">
              Transcripts chunked into 1000-character windows, embedded into 768-dimension vectors, and queried using Cosine Distance metric.
            </p>
          </article>

          <article className="group rounded-2xl border border-[#181818] bg-[#0d0d0d] p-8 transition-all hover:border-zinc-700 hover:bg-[#111111]">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 w-fit text-emerald-400">
              <Zap className="h-6 w-6" />
            </div>
            <p className="mt-6 text-xs tracking-[0.28em] text-[#999999] uppercase font-semibold">
              ANTI-BLOCK ENGINE
            </p>
            <h3 className="mt-2 text-lg font-bold text-white">Hardened Proxy Scraper</h3>
            <p className="mt-3 text-sm leading-relaxed text-[#cfcfcf]">
              3-layer anti-bot strategy combining Webshare proxy configs, generic environment injection, and sequential language tag scanning.
            </p>
          </article>

          <article className="group rounded-2xl border border-[#181818] bg-[#0d0d0d] p-8 transition-all hover:border-zinc-700 hover:bg-[#111111]">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 w-fit text-purple-400">
              <Layers className="h-6 w-6" />
            </div>
            <p className="mt-6 text-xs tracking-[0.28em] text-[#999999] uppercase font-semibold">
              VISUAL GRAPH
            </p>
            <h3 className="mt-2 text-lg font-bold text-white">2D Knowledge Graph</h3>
            <p className="mt-3 text-sm leading-relaxed text-[#cfcfcf]">
              Renders interactive 2D node-edge diagrams mapping key concepts, tools, and technical relations extracted across videos.
            </p>
          </article>

          <article className="group rounded-2xl border border-[#181818] bg-[#0d0d0d] p-8 transition-all hover:border-zinc-700 hover:bg-[#111111]">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 w-fit text-rose-400">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <p className="mt-6 text-xs tracking-[0.28em] text-[#999999] uppercase font-semibold">
              SECURITY & RATE LIMITS
            </p>
            <h3 className="mt-2 text-lg font-bold text-white">slowapi + Argon2 Auth</h3>
            <p className="mt-3 text-sm leading-relaxed text-[#cfcfcf]">
              Token-bucket rate limits keyed on JWT sub & client IP, state-of-the-art Argon2 password hashing, and token rotation interceptors.
            </p>
          </article>

          <article className="group rounded-2xl border border-[#181818] bg-[#0d0d0d] p-8 transition-all hover:border-zinc-700 hover:bg-[#111111]">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 w-fit text-amber-400">
              <Activity className="h-6 w-6" />
            </div>
            <p className="mt-6 text-xs tracking-[0.28em] text-[#999999] uppercase font-semibold">
              OBSERVABILITY
            </p>
            <h3 className="mt-2 text-lg font-bold text-white">structlog & GZip</h3>
            <p className="mt-3 text-sm leading-relaxed text-[#cfcfcf]">
              JSON standard output logs parsed natively by Google Cloud Logging, paired with GZip response compression cutting payloads by 70%.
            </p>
          </article>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="mx-auto max-w-4xl px-6 py-16 border-t border-[#181818]">
        <div className="text-center mb-12">
          <p className="text-xs font-semibold tracking-[0.2em] text-[#999999] uppercase">
            FREQUENTLY ASKED QUESTIONS
          </p>
          <h2 className="mt-2 text-3xl font-bold text-white">
            Got questions? We've got answers.
          </h2>
        </div>

        <div className="space-y-4">
          {FAQS.map((faq, idx) => {
            const isOpen = openFaq === idx
            return (
              <div
                key={idx}
                className="rounded-xl border border-zinc-800 bg-[#0c0c0c] overflow-hidden transition-colors hover:border-zinc-700"
              >
                <button
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  className="flex w-full items-center justify-between p-6 text-left text-sm font-semibold text-white"
                >
                  <span>{faq.q}</span>
                  <ChevronDown
                    className={`h-4 w-4 text-zinc-400 transition-transform ${
                      isOpen ? 'rotate-180 text-white' : ''
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-6 pb-6 text-xs leading-relaxed text-[#999999] border-t border-zinc-900 pt-4">
                    {faq.a}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* Bottom CTA Banner */}
      <section className="border-t border-[#181818] bg-zinc-950/80 py-20">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-white md:text-5xl">
            Transform how you learn from YouTube
          </h2>
          <p className="mt-4 text-sm text-[#999999]">
            Join ResearchTube today and turn long technical videos into searchable structured intelligence.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link to="/register">
              <Button>
                Get Started Free <ArrowRight className="ml-2 inline h-4 w-4" />
              </Button>
            </Link>
            <a
              href="https://github.com/saketjha34/ResearchTube"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-5 py-2.5 text-sm font-medium text-zinc-300 hover:border-zinc-700 hover:text-white transition-all"
            >
              <GithubIcon className="h-4 w-4" /> Star on GitHub
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
