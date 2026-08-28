import { useState, useEffect } from 'react'
import { ArrowUp } from 'lucide-react'

export default function ScrollToTop() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const toggleVisibility = () => {
      if (window.scrollY > 300) {
        setIsVisible(true)
      } else {
        setIsVisible(false)
      }
    }

    window.addEventListener('scroll', toggleVisibility)
    return () => window.removeEventListener('scroll', toggleVisibility)
  }, [])

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
  }

  if (!isVisible) return null

  return (
    <button
      onClick={scrollToTop}
      aria-label="Scroll to top"
      className="fixed bottom-6 right-6 z-50 flex h-11 w-11 items-center justify-center rounded-full border border-zinc-700 bg-zinc-950/90 text-zinc-300 shadow-xl backdrop-blur-md transition-all duration-300 hover:scale-110 hover:border-zinc-500 hover:bg-zinc-900 hover:text-white hover:shadow-amber-500/10 active:scale-95 animate-fade-in"
      title="Back to top"
    >
      <ArrowUp className="h-5 w-5 text-white" />
    </button>
  )
}
