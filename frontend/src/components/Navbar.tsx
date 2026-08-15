import { Link } from 'react-router-dom'
import Button from './Button'

function Navbar() {
  return (
    <header className="border-b border-[#181818]">
      <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <Link to="/" className="text-sm tracking-[0.35em] text-white">
          RESEARCHTUBE
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          <a href="#features" className="text-sm text-[#999999] hover:text-white transition-colors">
            Research
          </a>
          <a href="#features" className="text-sm text-[#999999] hover:text-white transition-colors">
            Library
          </a>
          <a href="#features" className="text-sm text-[#999999] hover:text-white transition-colors">
            About
          </a>
        </div>

        <div className="flex items-center gap-3">
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
