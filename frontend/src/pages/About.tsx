import { Link } from 'react-router-dom'
import {
  Sparkles,
  ArrowRight,
  Code,
  CheckCircle2,
  Database,
  BrainCircuit,
  MessageSquare,
  Network,
  Search,
  Zap,
  HelpCircle,
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
      <section className="mx-auto max-w-6xl px-6 pt-20 pb-16">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#282828] bg-[#111111] px-4 py-1.5 text-xs font-mono font-medium text-zinc-300 mb-8">
          <Sparkles className="h-3.5 w-3.5 text-white" />
          <span>PROJECT ARCHITECTURE & MISSION</span>
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight md:text-6xl text-white leading-tight">
          About ResearchTube
        </h1>
        <p className="mt-6 max-w-3xl text-lg sm:text-xl text-[#999999] leading-relaxed">
          YouTube is packed with world-class lectures, system tutorials, and conference talks, but sitting through hours of video just to find a single answer is exhausting. ResearchTube automatically watches, reads, connects, and evaluates technical videos for you in seconds.
        </p>
      </section>

      {/* Problem vs Solution (Spacious, Beautiful Cards) */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="grid gap-8 md:grid-cols-2">
          {/* The Problem */}
          <div className="rounded-3xl border border-[#222222] bg-[#0c0c0c] p-8 sm:p-10 md:p-12 flex flex-col justify-between hover:border-[#383838] transition-all group">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#282828] bg-[#141414] px-3 py-1 text-xs font-mono font-medium text-zinc-300 uppercase">
                <HelpCircle className="h-3.5 w-3.5 text-zinc-400" />
                The Problem
              </div>
              <h3 className="mt-5 text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Video Knowledge Is Trapped & Time-Consuming
              </h3>
              <p className="mt-4 text-sm sm:text-base leading-relaxed text-[#888888]">
                Technical tutorials are full of gold, but standard video platforms make learning slow and frustrating:
              </p>
              <ul className="mt-6 space-y-4 text-xs sm:text-sm text-zinc-300">
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 h-2 w-2 rounded-full bg-zinc-400 flex-shrink-0" />
                  <span>
                    <strong className="text-white">Wasted Hours:</strong> Scrubbing back and forth through 50-minute tutorials just to locate a 2-minute explanation.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 h-2 w-2 rounded-full bg-zinc-400 flex-shrink-0" />
                  <span>
                    <strong className="text-white">Misleading Search:</strong> Standard search algorithms reward clickbait, catchy titles, and long intros over actual technical depth.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 h-2 w-2 rounded-full bg-zinc-400 flex-shrink-0" />
                  <span>
                    <strong className="text-white">Zero Memory:</strong> Once you close a tab, there is no quick way to search what was said across multiple videos or compare different creators.
                  </span>
                </li>
              </ul>
            </div>
            <div className="mt-8 pt-6 border-t border-[#1c1c1c] text-xs text-zinc-400 font-mono">
              Challenge: Unsearchable audio streams with zero structured indexing.
            </div>
          </div>

          {/* The Solution */}
          <div className="rounded-3xl border border-[#333333] bg-[#121212] p-8 sm:p-10 md:p-12 flex flex-col justify-between hover:border-[#444444] transition-all group">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-mono font-medium text-white uppercase">
                <Sparkles className="h-3.5 w-3.5 text-white" />
                The Solution
              </div>
              <h3 className="mt-5 text-2xl sm:text-3xl font-bold text-white tracking-tight">
                AI Agents That Read, Grade, & Connect Videos
              </h3>
              <p className="mt-4 text-sm sm:text-base leading-relaxed text-[#999999]">
                ResearchTube deploys autonomous Gemini-powered agents coordinated via LangGraph to do the heavy reading for you:
              </p>
              <ul className="mt-6 space-y-4 text-xs sm:text-sm text-zinc-300">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-white flex-shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-white">Automated Transcript Reading:</strong> Pulls complete spoken words across proxy layers, even when manual captions are missing.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-white flex-shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-white">Hybrid Semantic Search (RRF):</strong> Stores 768-dim embeddings in PostgreSQL pgvector alongside full-text keyword indexing for zero-hallucination answers.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-white flex-shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-white">Interactive Concept Graph & Chat:</strong> Visually explore concept relationships and chat with any video transcript with exact timestamp citations.
                  </span>
                </li>
              </ul>
            </div>
            <div className="mt-8 pt-6 border-t border-[#222222] text-xs text-zinc-400 font-mono">
              Outcome: Publication-grade research reports, interactive graphs, and conversational video chat in ~15s.
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Under the Hood (4 Clean Stages in Simple Plain English) */}
      <section className="mx-auto max-w-6xl px-6 py-16 border-t border-[#181818]">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <span className="text-xs font-semibold tracking-[0.2em] text-zinc-400 uppercase">
            HOW IT WORKS UNDER THE HOOD
          </span>
          <h2 className="mt-2 text-3xl sm:text-4xl font-extrabold text-white">
            4-Stage Intelligent Pipeline
          </h2>
          <p className="mt-4 text-sm text-[#888888] leading-relaxed">
            Written in plain English so anyone can understand, paired with technical specifications for engineers and builders.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Stage 1 */}
          <div className="rounded-2xl border border-[#222222] bg-[#0c0c0c] p-8 sm:p-10 hover:border-[#383838] transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-4">
                <div className="rounded-xl border border-[#282828] bg-[#161616] p-3 text-white">
                  <Search className="h-6 w-6" />
                </div>
                <span className="rounded-full border border-[#282828] bg-[#141414] px-3 py-1 text-[11px] font-mono text-zinc-300">
                  STAGE 01
                </span>
              </div>
              <h3 className="mt-6 text-xl font-bold text-white">
                Smart Discovery & Transcript Ingestion
              </h3>
              <p className="mt-3 text-sm text-[#888888] leading-relaxed">
                You enter any technical topic or paste a YouTube video link. Our pipeline searches YouTube for the most relevant content and extracts the spoken words from transcripts automatically using proxy rotation so it never fails.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-[#181818] flex flex-wrap gap-2 text-[11px] font-mono text-zinc-400">
              <span className="bg-[#141414] px-2.5 py-1 rounded border border-[#222222]">YouTube Data API v3</span>
              <span className="bg-[#141414] px-2.5 py-1 rounded border border-[#222222]">3-Layer Proxy Scraper</span>
              <span className="bg-[#141414] px-2.5 py-1 rounded border border-[#222222]">Auto-Language Fallback</span>
            </div>
          </div>

          {/* Stage 2 */}
          <div className="rounded-2xl border border-[#222222] bg-[#0c0c0c] p-8 sm:p-10 hover:border-[#383838] transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-4">
                <div className="rounded-xl border border-[#282828] bg-[#161616] p-3 text-white">
                  <Database className="h-6 w-6" />
                </div>
                <span className="rounded-full border border-[#282828] bg-[#141414] px-3 py-1 text-[11px] font-mono text-zinc-300">
                  STAGE 02
                </span>
              </div>
              <h3 className="mt-6 text-xl font-bold text-white">
                Hybrid Memory & Vector Storage
              </h3>
              <p className="mt-3 text-sm text-[#888888] leading-relaxed">
                Long video transcripts are split into manageable chunks. We convert the text into numerical vectors that capture the true meaning of the content, while also keeping exact word matches using database full-text search.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-[#181818] flex flex-wrap gap-2 text-[11px] font-mono text-zinc-400">
              <span className="bg-[#141414] px-2.5 py-1 rounded border border-[#222222]">PostgreSQL pgvector</span>
              <span className="bg-[#141414] px-2.5 py-1 rounded border border-[#222222]">768d Dense Vectors</span>
              <span className="bg-[#141414] px-2.5 py-1 rounded border border-[#222222]">Reciprocal Rank Fusion (RRF)</span>
            </div>
          </div>

          {/* Stage 3 */}
          <div className="rounded-2xl border border-[#222222] bg-[#0c0c0c] p-8 sm:p-10 hover:border-[#383838] transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-4">
                <div className="rounded-xl border border-[#282828] bg-[#161616] p-3 text-white">
                  <BrainCircuit className="h-6 w-6" />
                </div>
                <span className="rounded-full border border-[#282828] bg-[#141414] px-3 py-1 text-[11px] font-mono text-zinc-300">
                  STAGE 03
                </span>
              </div>
              <h3 className="mt-6 text-xl font-bold text-white">
                Multi-Agent Evaluation & Synthesis
              </h3>
              <p className="mt-3 text-sm text-[#888888] leading-relaxed">
                Three specialized AI agents work together: one gathers the data, the second scores each video on technical depth and accuracy, and the third compiles an easy-to-read report with actionable steps and direct video links.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-[#181818] flex flex-wrap gap-2 text-[11px] font-mono text-zinc-400">
              <span className="bg-[#141414] px-2.5 py-1 rounded border border-[#222222]">7-Node LangGraph DAG</span>
              <span className="bg-[#141414] px-2.5 py-1 rounded border border-[#222222]">Gemini 2.5 Flash</span>
              <span className="bg-[#141414] px-2.5 py-1 rounded border border-[#222222]">Structured Pydantic Models</span>
            </div>
          </div>

          {/* Stage 4 */}
          <div className="rounded-2xl border border-[#222222] bg-[#0c0c0c] p-8 sm:p-10 hover:border-[#383838] transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-4">
                <div className="rounded-xl border border-[#282828] bg-[#161616] p-3 text-white">
                  <Network className="h-6 w-6" />
                </div>
                <span className="rounded-full border border-[#282828] bg-[#141414] px-3 py-1 text-[11px] font-mono text-zinc-300">
                  STAGE 04
                </span>
              </div>
              <h3 className="mt-6 text-xl font-bold text-white">
                Interactive Knowledge Graph & AI Chat
              </h3>
              <p className="mt-3 text-sm text-[#888888] leading-relaxed">
                See concepts come alive on an interactive radial map that shows which videos teach which ideas. You can zoom in, drag nodes, expand to fullscreen, and ask questions to an AI assistant that cites exact video timestamps.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-[#181818] flex flex-wrap gap-2 text-[11px] font-mono text-zinc-400">
              <span className="bg-[#141414] px-2.5 py-1 rounded border border-[#222222]">SVG Radial Visualizer</span>
              <span className="bg-[#141414] px-2.5 py-1 rounded border border-[#222222]">Portal Fullscreen View</span>
              <span className="bg-[#141414] px-2.5 py-1 rounded border border-[#222222]">Flexible Video Scope Chat</span>
            </div>
          </div>
        </div>
      </section>

      {/* Flexible Video Scope Showcase */}
      <section className="mx-auto max-w-6xl px-6 py-16 border-t border-[#181818]">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <span className="text-xs font-semibold tracking-[0.2em] text-zinc-400 uppercase">
            CONVERSATIONAL INTELLIGENCE
          </span>
          <h2 className="mt-2 text-3xl sm:text-4xl font-extrabold text-white">
            Ask Questions Your Way
          </h2>
          <p className="mt-4 text-sm text-[#888888] leading-relaxed">
            Choose how you want to chat with YouTube videos. Our scoping engine filters video transcripts to match your exact intent.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Scope 1 */}
          <div className="rounded-2xl border border-[#222222] bg-[#0c0c0c] p-8 hover:border-[#383838] transition-all flex flex-col justify-between">
            <div>
              <div className="h-10 w-10 rounded-xl bg-[#161616] border border-[#282828] flex items-center justify-center text-white mb-6">
                <MessageSquare size={20} />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Specific Video Scope</h3>
              <p className="text-sm text-[#888888] leading-relaxed">
                Talk directly with a single video. The AI searches only through that video transcript to answer specific questions, explain code snippets, and clarify tricky parts with exact timestamps.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-[#181818] text-xs font-mono text-zinc-400">
              Ideal for: Lecture summaries, step-by-step tutorial debugging.
            </div>
          </div>

          {/* Scope 2 */}
          <div className="rounded-2xl border border-[#222222] bg-[#0c0c0c] p-8 hover:border-[#383838] transition-all flex flex-col justify-between">
            <div>
              <div className="h-10 w-10 rounded-xl bg-[#161616] border border-[#282828] flex items-center justify-center text-white mb-6">
                <Database size={20} />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">All Library Videos Scope</h3>
              <p className="text-sm text-[#888888] leading-relaxed">
                Ask broad questions that compare multiple videos. The AI pulls transcript evidence from all videos in your research library to give you a comprehensive cross-author overview.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-[#181818] text-xs font-mono text-zinc-400">
              Ideal for: Architectural comparisons, finding consensus across experts.
            </div>
          </div>

          {/* Scope 3 */}
          <div className="rounded-2xl border border-[#222222] bg-[#0c0c0c] p-8 hover:border-[#383838] transition-all flex flex-col justify-between">
            <div>
              <div className="h-10 w-10 rounded-xl bg-[#161616] border border-[#282828] flex items-center justify-center text-white mb-6">
                <Zap size={20} />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Custom Video Linker</h3>
              <p className="text-sm text-[#888888] leading-relaxed">
                Found a niche video not in the search results? Just paste its YouTube URL or video ID directly into ResearchTube. The engine will ingest the transcript on the fly and let you chat with it.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-[#181818] text-xs font-mono text-zinc-400">
              Ideal for: Private research, custom conference talks, unlisted videos.
            </div>
          </div>
        </div>
      </section>

      {/* Author & Creator Spotlight + System Specifications */}
      <section className="mx-auto max-w-6xl px-6 py-16 border-t border-[#181818]">
        <div className="rounded-3xl border border-[#222222] bg-[#0d0d0d] p-8 sm:p-12 md:p-14 flex flex-col lg:flex-row items-stretch justify-between gap-10">
          <div className="space-y-5 max-w-xl flex flex-col justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#282828] bg-[#111111] px-3.5 py-1 text-xs font-mono font-medium text-zinc-300 mb-4">
                <Sparkles className="h-3.5 w-3.5 text-white" />
                CREATED BY SAKET JHA
              </div>
              <h3 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                Built for Developers, Students, and Curious Minds
              </h3>
              <p className="mt-4 text-sm sm:text-base leading-relaxed text-[#999999]">
                ResearchTube was engineered to solve a personal pain point: spending countless hours watching long technical YouTube videos to find small pieces of architectural knowledge. Built with modern multi-agent systems, pgvector RAG, and FastAPI.
              </p>
            </div>

            <div className="pt-4 flex flex-wrap items-center gap-4">
              <a
                href="https://github.com/saketjha34/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-5 py-3 text-xs font-bold text-white hover:border-[#444444] hover:bg-zinc-800 transition-all shadow-sm"
              >
                <GithubIcon className="h-4 w-4 text-white" /> Saket's GitHub
              </a>
              <a
                href="https://github.com/saketjha34/ResearchTube"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-zinc-400 underline hover:text-white transition-colors"
              >
                View Repository on GitHub
              </a>
            </div>
          </div>

          {/* System Specifications Card */}
          <div className="w-full lg:w-96 flex flex-col justify-between rounded-2xl border border-[#282828] bg-black p-6 sm:p-8 font-mono text-xs text-zinc-300">
            <div>
              <div className="flex items-center gap-2 text-white border-b border-[#222222] pb-3 mb-4 font-bold tracking-wider uppercase">
                <Code className="h-4 w-4" /> Technical Specifications
              </div>
              <div className="space-y-2.5">
                <p className="flex justify-between"><span className="text-[#666666]">Framework:</span> <span className="text-white">FastAPI / React 19</span></p>
                <p className="flex justify-between"><span className="text-[#666666]">LLM Core:</span> <span className="text-white font-semibold">Gemini 2.5 Flash</span></p>
                <p className="flex justify-between"><span className="text-[#666666]">Embeddings:</span> <span className="text-white">text-embedding-004</span></p>
                <p className="flex justify-between"><span className="text-[#666666]">Vector Store:</span> <span className="text-white">PostgreSQL pgvector</span></p>
                <p className="flex justify-between"><span className="text-[#666666]">Search Engine:</span> <span className="text-white">Hybrid RRF (Dense + FTS)</span></p>
                <p className="flex justify-between"><span className="text-[#666666]">Orchestrator:</span> <span className="text-white">7-Node LangGraph DAG</span></p>
                <p className="flex justify-between"><span className="text-[#666666]">Visualizer:</span> <span className="text-white">SVG Knowledge Graph</span></p>
                <p className="flex justify-between"><span className="text-[#666666]">Security:</span> <span className="text-white">Argon2 + slowapi</span></p>
                <p className="flex justify-between"><span className="text-[#666666]">License:</span> <span className="text-white">MIT Open Source</span></p>
              </div>
            </div>
            <div className="mt-6 pt-3 border-t border-[#1c1c1c] text-[10px] text-[#555555]">
              Docker Compose • Cloud Run Ready • PostgreSQL 16
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-[#181818] bg-black py-20">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white">
            Ready to research YouTube videos 10x faster?
          </h2>
          <p className="mt-4 text-sm sm:text-base text-[#888888] max-w-xl mx-auto leading-relaxed">
            Try ResearchTube today. Extract transcripts, generate actionable reports, explore visual concept graphs, and chat with video transcripts.
          </p>
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
