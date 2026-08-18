import { useEffect, useState } from 'react'
import { FlaskConical } from 'lucide-react'

const STEPS = [
  {
    emoji: '🔬',
    title: 'Welcome to ResearchTube',
    desc: 'Your AI-powered YouTube research pipeline. Find and rank the best learning resources on any topic — powered by a 3-agent AI system.',
  },
  {
    emoji: '🔍',
    title: 'Start a Research Run',
    desc: 'Type any topic in the search box and click RESEARCH. The pipeline searches YouTube, transcribes videos, and produces a ranked report in ~2 minutes.',
  },
  {
    emoji: '📚',
    title: 'Access Past Research',
    desc: 'All your completed runs appear in the sidebar. Click any item to instantly re-read the full report. Use the ⋯ menu to rename, pin, or delete.',
  },
  {
    emoji: '⌨️',
    title: 'Power User Tips',
    desc: 'Press Ctrl+K to search your history. Press Ctrl+F to search inside any report. Copy sections with the copy buttons. Pin important runs to the top.',
  },
]

const STORAGE_KEY = 'rt_onboarding_done'

export function Onboarding() {
  const [visible, setVisible] = useState(false)
  const [step, setStep] = useState(0)
  const [animating, setAnimating] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      // Small delay so page loads first
      setTimeout(() => setVisible(true), 800)
    }
  }, [])

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, '1')
    setVisible(false)
  }

  const goTo = (next: number) => {
    setAnimating(true)
    setTimeout(() => { setStep(next); setAnimating(false) }, 200)
  }

  if (!visible) return null

  const s = STEPS[step]

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
      <div
        className="bg-[#111111] border border-[#2a2a2a] rounded-2xl shadow-2xl w-full max-w-md p-8 space-y-6"
        style={{ transition: 'opacity 0.2s', opacity: animating ? 0 : 1 }}
      >
        {/* Step progress dots */}
        <div className="flex items-center gap-1.5">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className="h-1 rounded-full transition-all duration-300"
              style={{
                flex: i === step ? 2 : 1,
                background: i <= step ? '#ffffff' : '#2a2a2a',
              }}
            />
          ))}
        </div>

        {/* Icon */}
        <div className="flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#1a1a1a] border border-[#2a2a2a] text-4xl">
            {s.emoji}
          </div>
        </div>

        {/* Content */}
        <div className="text-center space-y-3">
          <h2
            className="text-xl font-bold text-white"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            {s.title}
          </h2>
          <p className="text-sm text-[#888888] leading-relaxed">{s.desc}</p>
        </div>

        {/* Step counter */}
        <p className="text-center text-[10px] font-bold tracking-[0.2em] text-[#444444] uppercase">
          {step + 1} of {STEPS.length}
        </p>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <button
            onClick={dismiss}
            className="text-xs text-[#444444] hover:text-[#888888] transition-colors font-medium"
          >
            Skip tour
          </button>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                onClick={() => goTo(step - 1)}
                className="px-4 py-2 text-xs font-bold text-[#888888] hover:text-white border border-[#222222] hover:border-[#444444] rounded-full transition-all"
              >
                Back
              </button>
            )}
            {step < STEPS.length - 1 ? (
              <button
                onClick={() => goTo(step + 1)}
                className="px-6 py-2 text-xs font-bold bg-white text-black hover:bg-[#e0e0e0] rounded-full transition-all"
              >
                Next
              </button>
            ) : (
              <button
                onClick={dismiss}
                className="flex items-center gap-2 px-6 py-2 text-xs font-bold bg-white text-black hover:bg-[#e0e0e0] rounded-full transition-all"
              >
                <FlaskConical size={12} />
                Let's Research!
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
