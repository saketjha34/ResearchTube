import { Link } from 'react-router-dom'
import { Heart, ArrowUpRight } from 'lucide-react'
import GithubIcon from './GithubIcon'

export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="border-t border-[#181818] bg-black text-white">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-10 md:grid-cols-12">
          {/* Brand Info */}
          <div className="md:col-span-7 space-y-4">
            <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold tracking-[0.35em] text-white">
              RESEARCHTUBE
              <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] tracking-normal text-zinc-400">v1.0</span>
            </Link>
            <p className="max-w-md text-sm text-[#999999] leading-relaxed">
              Automated multi-agent YouTube research platform. Extracts transcripts, computes pgvector embeddings, and synthesizes publication-grade research reports.
            </p>
            <div className="flex items-center gap-3 pt-2">
              <a
                href="https://github.com/saketjha34/ResearchTube"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950 px-3.5 py-1.5 text-xs text-zinc-300 hover:border-zinc-700 hover:text-white transition-colors"
              >
                <GithubIcon className="h-3.5 w-3.5" />
                GitHub Repository
                <ArrowUpRight className="h-3 w-3 text-zinc-500" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div className="md:col-span-5 space-y-3 md:text-right">
            <p className="text-xs font-semibold tracking-[0.2em] text-[#999999]">NAVIGATION</p>
            <ul className="space-y-2 text-sm text-zinc-400 flex flex-col md:items-end">
              <li>
                <Link to="/" className="hover:text-white transition-colors">Home</Link>
              </li>
              <li>
                <Link to="/library" className="hover:text-white transition-colors">Feature Library</Link>
              </li>
              <li>
                <Link to="/about" className="hover:text-white transition-colors">About Project</Link>
              </li>
              <li>
                <Link to="/research" className="hover:text-white transition-colors">Research Dashboard</Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom copyright */}
        <div className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-[#181818] pt-8 text-xs text-[#777777] md:flex-row">
          <p>© {currentYear} ResearchTube. Built with <Heart className="inline h-3.5 w-3.5 text-red-500 fill-red-500/20" /> by <a href="https://github.com/saketjha34" target="_blank" rel="noreferrer" className="text-zinc-300 underline hover:text-white">Saket Jha</a>.</p>
          <p className="text-zinc-500">AI research platform</p>
        </div>
      </div>
    </footer>
  )
}
