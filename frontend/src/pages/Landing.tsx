import { Link } from 'react-router-dom'
import Button from '../components/Button'
import Navbar from '../components/Navbar'
import { startGoogleLogin } from '../api/auth'

function Landing() {
  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />

      <section className="mx-auto max-w-6xl px-6 pb-20 pt-24 md:pt-32">
        <div className="max-w-3xl animate-slide-up">
          <p className="mb-6 text-xs tracking-[0.32em] text-[#999999]">RESEARCHTUBE</p>
          <h1 className="text-5xl font-semibold leading-tight md:text-7xl">
            Research smarter.
            <br />
            Understand deeper.
          </h1>
          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-[#999999]">
            Turn YouTube content into searchable, structured research.
          </p>

          <div className="mt-12 flex flex-wrap gap-3">
            <Link to="/register">
              <Button>Get Started</Button>
            </Link>
            <Button variant="secondary" onClick={startGoogleLogin}>
              Continue with Google
            </Button>
            <Link to="/login" className="inline-flex items-center text-sm text-[#999999] hover:text-white transition-colors">
              Sign in
            </Link>
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto grid max-w-6xl gap-8 border-t border-[#181818] px-6 py-16 md:grid-cols-3">
        <article className="border border-[#181818] bg-[#111111] p-8">
          <p className="text-xs tracking-[0.28em] text-[#999999]">SEARCH</p>
          <p className="mt-4 text-sm leading-relaxed text-[#cfcfcf]">
            Find the exact information hidden inside hours of video.
          </p>
        </article>

        <article className="border border-[#181818] bg-[#111111] p-8">
          <p className="text-xs tracking-[0.28em] text-[#999999]">UNDERSTAND</p>
          <p className="mt-4 text-sm leading-relaxed text-[#cfcfcf]">
            Turn long-form content into structured research.
          </p>
        </article>

        <article className="border border-[#181818] bg-[#111111] p-8">
          <p className="text-xs tracking-[0.28em] text-[#999999]">RESEARCH</p>
          <p className="mt-4 text-sm leading-relaxed text-[#cfcfcf]">
            Build a personal knowledge base from the content you watch.
          </p>
        </article>
      </section>
    </div>
  )
}

export default Landing
