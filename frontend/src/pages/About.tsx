import { Link } from 'react-router-dom'
import {
  Sparkles,
  ArrowRight,
  Code,
  CheckCircle2,
  Database,
  BrainCircuit,
  Terminal,
} from 'lucide-react'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import Button from '../components/Button'
import GithubIcon from '../components/GithubIcon'

export default function About() {
  return (
    <div className="min-h-screen bg-black text-white selection:bg-white selection:text-black">
      <Navbar />

      {/* Hero Banner */}
      <section className="mx-auto max-w-6xl px-6 pt-16 pb-12">
        <div className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950 px-3.5 py-1 text-xs text-zinc-400 mb-6">
          <Sparkles className="h-3.5 w-3.5 text-amber-400" />
          Project Architecture & Mission
        </div>
        <h1 className="text-4xl font-bold tracking-tight md:text-6xl text-white">
          About ResearchTube
        </h1>
        <p className="mt-4 max-w-3xl text-lg text-[#999999] leading-relaxed">
          ResearchTube is a multi-agent AI research pipeline designed to transform unsearchable YouTube video streams into structured, publication-grade technical intelligence.
        </p>
      </section>

      {/* Problem vs Solution */}
      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-8 md:grid-cols-2">
          {/* The Problem */}
          <div className="rounded-2xl border border-red-500/20 bg-red-950/10 p-8">
            <span className="text-xs font-semibold tracking-[0.2em] text-red-400 uppercase">
              THE PROBLEM
            </span>
            <h3 className="mt-3 text-2xl font-bold text-white">
              Video Information Is Trapped & Unsearchable
            </h3>
            <p className="mt-4 text-sm leading-relaxed text-zinc-400">
              Technical YouTube videos (tutorials, system design lectures, conference talks) contain invaluable knowledge. However:
            </p>
            <ul className="mt-4 space-y-3 text-xs text-zinc-300">
              <li className="flex items-start gap-2.5">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-red-400 flex-shrink-0" />
                <span>Watching 45-minute videos sequentially is extremely time inefficient.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-red-400 flex-shrink-0" />
                <span>Basic search can't filter out low-quality or inaccurate tutorial fluff.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-red-400 flex-shrink-0" />
                <span>Manual note-taking lacks persistent vector indexing for retrieval.</span>
              </li>
            </ul>
          </div>

          {/* The Solution */}
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/10 p-8">
            <span className="text-xs font-semibold tracking-[0.2em] text-emerald-400 uppercase">
              THE SOLUTION
            </span>
            <h3 className="mt-3 text-2xl font-bold text-white">
              Multi-Agent DAG + pgvector RAG Pipeline
            </h3>
            <p className="mt-4 text-sm leading-relaxed text-zinc-400">
              ResearchTube deploys autonomous Gemini-powered agents coordinated via LangGraph:
            </p>
            <ul className="mt-4 space-y-3 text-xs text-zinc-300">
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                <span>Automatically scrapes and parses transcripts across multiple proxy layers.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                <span>Generates 768-dim dense vectors in PostgreSQL pgvector for semantic evidence matching.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                <span>Synthesizes structured markdown research reports with video timestamp citations.</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* System Architecture Flow */}
      <section className="mx-auto max-w-6xl px-6 py-12 border-t border-[#181818]">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <p className="text-xs font-semibold tracking-[0.2em] text-[#999999] uppercase">
            HOW IT WORKS UNDER THE HOOD
          </p>
          <h2 className="mt-2 text-3xl font-bold text-white">
            7-Node Execution Graph
          </h2>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Agent 1 */}
          <div className="rounded-xl border border-zinc-800 bg-[#0c0c0c] p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-amber-500/10 p-2.5 text-amber-400">
                <BrainCircuit className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-widest">
                  AGENT 1
                </span>
                <h4 className="text-base font-bold text-white">YouTube Researcher</h4>
              </div>
            </div>
            <p className="mt-4 text-xs text-zinc-400 leading-relaxed">
              Plans search queries, calls YouTube v3 API, fetches video statistics, and executes proxy-aware transcript parsing.
            </p>
          </div>

          {/* Agent 2 */}
          <div className="rounded-xl border border-zinc-800 bg-[#0c0c0c] p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-500/10 p-2.5 text-blue-400">
                <Database className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] font-semibold text-blue-400 uppercase tracking-widest">
                  AGENT 2
                </span>
                <h4 className="text-base font-bold text-white">RAG Evaluator</h4>
              </div>
            </div>
            <p className="mt-4 text-xs text-zinc-400 leading-relaxed">
              Queries pgvector embeddings, evaluates chunk relevancy, grades technical depth, and scores pros/cons for each video.
            </p>
          </div>

          {/* Agent 3 */}
          <div className="rounded-xl border border-zinc-800 bg-[#0c0c0c] p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-emerald-500/10 p-2.5 text-emerald-400">
                <Terminal className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-widest">
                  AGENT 3
                </span>
                <h4 className="text-base font-bold text-white">Synthesizer</h4>
              </div>
            </div>
            <p className="mt-4 text-xs text-zinc-400 leading-relaxed">
              Combines retrieved transcript evidence and evaluation metrics into a publication-grade markdown research report.
            </p>
          </div>
        </div>
      </section>

      {/* Author & Creator Spotlight */}
      <section className="mx-auto max-w-6xl px-6 py-16 border-t border-[#181818]">
        <div className="rounded-2xl border border-zinc-800 bg-[#0d0d0d] p-8 md:p-12 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="space-y-4 max-w-xl">
            <span className="text-xs font-semibold tracking-[0.2em] text-amber-400 uppercase">
              CREATED BY
            </span>
            <h3 className="text-3xl font-bold text-white">
              Saket Jha
            </h3>
            <p className="text-sm leading-relaxed text-zinc-400">
              Designed and built as an advanced AI platform exploring state-of-the-art multi-agent systems, pgvector similarity search, and FastAPI enterprise architecture.
            </p>
            <div className="pt-2 flex flex-wrap items-center gap-4">
              <a
                href="https://github.com/saketjha34/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-xs font-semibold text-white hover:border-zinc-500 hover:bg-zinc-800 transition-all shadow-sm"
              >
                <GithubIcon className="h-4 w-4 text-white" /> Saket's GitHub
              </a>
              <a
                href="https://github.com/saketjha34/ResearchTube"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-zinc-400 underline hover:text-white"
              >
                View Repository Source
              </a>
            </div>
          </div>

          <div className="w-full md:w-auto flex flex-col gap-3 rounded-xl border border-zinc-800 bg-black p-6 font-mono text-xs text-zinc-300">
            <div className="flex items-center gap-2 text-zinc-500 border-b border-zinc-800 pb-2">
              <Code className="h-4 w-4 text-amber-400" /> System Specifications
            </div>
            <p><span className="text-zinc-500">Framework:</span> FastAPI / React 19</p>
            <p><span className="text-zinc-500">LLM Model:</span> Gemini 3.5 Flash</p>
            <p><span className="text-zinc-500">Vector Store:</span> PostgreSQL pgvector</p>
            <p><span className="text-zinc-500">Orchestrator:</span> LangGraph 7-Node</p>
            <p><span className="text-zinc-500">License:</span> MIT License</p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-[#181818] bg-zinc-950/60 py-16">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
            Start Researching YouTube Videos Smarter
          </h2>
          <div className="mt-8 flex justify-center gap-4">
            <Link to="/register">
              <Button>
                Get Started Free <ArrowRight className="ml-2 inline h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
