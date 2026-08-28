import { Link } from 'react-router-dom'
import GithubIcon from './GithubIcon'
import Button from './Button'

function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-[#181818] bg-black/80 backdrop-blur-md">
      <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        <Link to="/" className="text-sm font-bold tracking-[0.35em] text-white hover:text-zinc-300 transition-colors">
          RESEARCHTUBE
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          <Link to="/" className="text-sm text-[#999999] hover:text-white transition-colors">
            Research
          </Link>
          <Link to="/library" className="text-sm text-[#999999] hover:text-white transition-colors">
            Library
          </Link>
          <Link to="/about" className="text-sm text-[#999999] hover:text-white transition-colors">
            About
          </Link>
        </div>

        <div className="flex items-center gap-3">
          {/* GitHub Button before signup */}
          <a
            href="https://github.com/saketjha34/ResearchTube"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950 px-3.5 py-1.5 text-xs text-zinc-300 hover:border-zinc-700 hover:text-white hover:bg-zinc-900 transition-all"
            title="View ResearchTube on GitHub"
          >
            <GithubIcon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">GitHub</span>
          </a>

          <Link to="/login" className="text-sm text-[#999999] hover:text-white transition-colors">
            Sign In
          </Link>
          <Link to="/register">
            <Button variant="ghost">Get Started</Button>
          </Link>
        </div>
      </nav>
    </header>
  )
}

export default Navbar
