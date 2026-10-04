import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  FlaskConical,
  MessageSquare,
  UserRound,
  Search,
  ArrowRight,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  X,
  History,
} from 'lucide-react'

function YoutubeIcon({ size = 20, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  )
}

interface OnboardingStep {
  id: string
  badge: string
  title: string
  subtitle: string
  desc: string
  targetSelector: string
  targetLabel: string
  preferredPlacement: 'top' | 'bottom' | 'left' | 'right'
  route?: string
  icon: React.ElementType
  tips: string[]
}

const STEPS: OnboardingStep[] = [
  {
    id: 'research-run',
    badge: 'STEP 1 OF 6 // RESEARCH RUNS',
    title: 'Automated Research Runs',
    subtitle: '7-Node Multi-Agent YouTube Pipeline',
    desc: 'Enter any technical inquiry here (e.g. "Build Postgres pgvector RAG" or "Master LangGraph Agents"). The 7-node pipeline searches YouTube, ingests spoken audio transcripts, evaluates educational accuracy, and generates structured reports.',
    targetSelector: '[data-tour="research-input"]',
    targetLabel: 'RESEARCH INQUIRY INPUT',
    preferredPlacement: 'bottom',
    route: '/research',
    icon: FlaskConical,
    tips: [
      'Type any technical topic and click Research or press Enter',
      'Gemini 2.5 Flash ranks videos with objective educational scores',
      'Generates interactive radial knowledge graphs and curriculum maps',
    ],
  },
  {
    id: 'custom-videos',
    badge: 'STEP 2 OF 6 // CUSTOM INGESTION',
    title: 'Link Specific YouTube Videos',
    subtitle: 'On-Demand Transcript Extraction',
    desc: 'Have an unlisted lecture, specific workshop, or tutorial? Click "+ LINK VIDEOS" or paste any YouTube URL directly into the prompt. The system ingests transcripts on the fly without manual scrubbing.',
    targetSelector: '[data-tour="link-videos"]',
    targetLabel: 'CUSTOM VIDEO LINKER',
    preferredPlacement: 'bottom',
    route: '/research',
    icon: YoutubeIcon,
    tips: [
      'Supports full URLs, youtu.be shortlinks, and 11-character video IDs',
      'Extracts and indexes video transcripts with proxy resilience',
      'Integrates seamlessly into active library and video chat scope',
    ],
  },
  {
    id: 'video-chat',
    badge: 'STEP 3 OF 6 // CHAT SESSIONS',
    title: 'Chat with Video Transcripts',
    subtitle: 'Interactive Grounded Conversations',
    desc: 'Select Chat in the sidebar to talk with your video library. Query specific video timestamps or conduct cross-video synthesis across multiple tutorials to compare implementations and architectural trade-offs.',
    targetSelector: '[data-tour="nav-chat"]',
    targetLabel: 'CHAT SESSIONS',
    preferredPlacement: 'right',
    icon: MessageSquare,
    tips: [
      'Specific Video Scope: Answers grounded strictly in one video',
      'All Videos Scope: Cross-video comparative synthesis',
      'Clickable YouTube timestamps take you directly to the spoken moment',
    ],
  },
  {
    id: 'workspace-history',
    badge: 'STEP 4 OF 6 // SESSIONS & HISTORY',
    title: 'Research & Chat History',
    subtitle: 'Instant Session Persistence',
    desc: 'Use the tab switcher in the sidebar to flip between completed Research reports and active Chat conversations. All past runs, citations, and analyses are preserved for instant retrieval.',
    targetSelector: '[data-tour="sidebar-history"]',
    targetLabel: 'HISTORY & SESSIONS',
    preferredPlacement: 'right',
    icon: History,
    tips: [
      'Toggle between Research runs and Chat sessions with one click',
      'Pin essential research runs to keep them at the top of your sidebar',
      'Rename, archive, or generate public shareable links for teammates',
    ],
  },
  {
    id: 'profile-metrics',
    badge: 'STEP 5 OF 6 // PROFILE & METRICS',
    title: 'Profile & Productivity Analytics',
    subtitle: 'Track Time Saved & Concepts Mastered',
    desc: 'Visit Profile in the sidebar to monitor your research productivity. Track estimated hours of manual video scrubbing saved, total questions answered, and technical topics mastered.',
    targetSelector: '[data-tour="nav-profile"]',
    targetLabel: 'PROFILE SECTION',
    preferredPlacement: 'right',
    icon: UserRound,
    tips: [
      'Productivity tracker measures hours saved vs manual video watching',
      'Concept frequency metrics show your most explored technical topics',
      'Manage account credentials and restart this guided tour anytime',
    ],
  },
  {
    id: 'global-search',
    badge: 'STEP 6 OF 6 // GLOBAL SEARCH',
    title: 'Universal Quick Search',
    subtitle: 'Instant Retrieval Across All Sessions',
    desc: 'Click the search icon or press Ctrl+K (Cmd+K on macOS) from anywhere in ResearchTube to instantly search through all your past research runs, chat messages, and saved videos.',
    targetSelector: '[data-tour="quick-search"]',
    targetLabel: 'QUICK SEARCH (CTRL+K)',
    preferredPlacement: 'right',
    icon: Search,
    tips: [
      'Press Ctrl + K from anywhere to open global search modal',
      'Filter results by Research Runs, Chat Sessions, or All content',
      'Keyboard navigable with instant jump-to-session',
    ],
  },
]

const STORAGE_KEY = 'rt_onboarding_done'

export function Onboarding() {
  const [visible, setVisible] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
  const [popoverPos, setPopoverPos] = useState<{
    top: number
    left: number
    placement: 'top' | 'bottom' | 'left' | 'right' | 'center'
    arrowOffset: number
  }>({
    top: 100,
    left: 100,
    placement: 'bottom',
    arrowOffset: 50,
  })

  const popoverRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const location = useLocation()

  // Initial display check
  useEffect(() => {
    const forceShow = localStorage.getItem('rt_force_onboarding')
    const done = localStorage.getItem(STORAGE_KEY)

    if (forceShow || !done) {
      if (forceShow) {
        localStorage.removeItem('rt_force_onboarding')
      }
      const timer = setTimeout(() => {
        setVisible(true)
        setStepIndex(0)
      }, 600)
      return () => clearTimeout(timer)
    }
  }, [])

  // Allow re-opening via custom event from Profile or Settings
  useEffect(() => {
    const handleOpen = () => {
      setStepIndex(0)
      setVisible(true)
    }
    window.addEventListener('rt:open_onboarding', handleOpen)
    return () => window.removeEventListener('rt:open_onboarding', handleOpen)
  }, [])

  // Auto-route if the step specifies a route requirement (e.g. /research)
  useEffect(() => {
    if (!visible) return
    const currentStep = STEPS[stepIndex]
    if (currentStep.route && location.pathname !== currentStep.route) {
      navigate(currentStep.route)
    }
  }, [visible, stepIndex, location.pathname, navigate])

  // Recalculate spotlight and popover arrow coordinates
  const updatePosition = useCallback(() => {
    if (!visible) return
    const currentStep = STEPS[stepIndex]
    const el = document.querySelector(currentStep.targetSelector)

    const cardWidth = Math.min(window.innerWidth - 32, 420)
    const cardHeight = popoverRef.current?.offsetHeight || 380

    if (!el) {
      // Graceful fallback: center card
      setTargetRect(null)
      setPopoverPos({
        top: Math.max(20, (window.innerHeight - cardHeight) / 2),
        left: Math.max(16, (window.innerWidth - cardWidth) / 2),
        placement: 'center',
        arrowOffset: cardWidth / 2,
      })
      return
    }

    const rect = el.getBoundingClientRect()
    // Check if element is hidden
    if (rect.width === 0 && rect.height === 0) {
      setTargetRect(null)
      setPopoverPos({
        top: Math.max(20, (window.innerHeight - cardHeight) / 2),
        left: Math.max(16, (window.innerWidth - cardWidth) / 2),
        placement: 'center',
        arrowOffset: cardWidth / 2,
      })
      return
    }

    setTargetRect(rect)

    let placement = currentStep.preferredPlacement
    let top = 0
    let left = 0
    let arrowOffset = 50

    // Check bounds & flip if needed
    if (placement === 'bottom') {
      if (rect.bottom + 18 + cardHeight > window.innerHeight && rect.top - 18 - cardHeight > 0) {
        placement = 'top'
      }
    } else if (placement === 'top') {
      if (rect.top - 18 - cardHeight < 0 && rect.bottom + 18 + cardHeight < window.innerHeight) {
        placement = 'bottom'
      }
    } else if (placement === 'right') {
      if (rect.right + 20 + cardWidth > window.innerWidth) {
        placement = rect.left - 20 - cardWidth > 0 ? 'left' : 'bottom'
      }
    } else if (placement === 'left') {
      if (rect.left - 20 - cardWidth < 0) {
        placement = rect.right + 20 + cardWidth < window.innerWidth ? 'right' : 'bottom'
      }
    }

    if (placement === 'bottom') {
      top = rect.bottom + 18
      left = rect.left + rect.width / 2 - cardWidth / 2
      arrowOffset = (rect.left + rect.width / 2) - left
    } else if (placement === 'top') {
      top = rect.top - cardHeight - 18
      left = rect.left + rect.width / 2 - cardWidth / 2
      arrowOffset = (rect.left + rect.width / 2) - left
    } else if (placement === 'right') {
      left = rect.right + 20
      top = rect.top + rect.height / 2 - cardHeight / 2
      arrowOffset = (rect.top + rect.height / 2) - top
    } else if (placement === 'left') {
      left = rect.left - cardWidth - 20
      top = rect.top + rect.height / 2 - cardHeight / 2
      arrowOffset = (rect.top + rect.height / 2) - top
    }

    // Clamp coordinates within visible screen
    const clampedLeft = Math.max(16, Math.min(window.innerWidth - cardWidth - 16, left))
    const clampedTop = Math.max(16, Math.min(window.innerHeight - cardHeight - 16, top))

    // Re-adjust arrow offset relative to clamped coordinates
    if (placement === 'bottom' || placement === 'top') {
      const targetCenter = rect.left + rect.width / 2
      arrowOffset = Math.max(30, Math.min(cardWidth - 30, targetCenter - clampedLeft))
    } else if (placement === 'left' || placement === 'right') {
      const targetCenter = rect.top + rect.height / 2
      arrowOffset = Math.max(30, Math.min(cardHeight - 30, targetCenter - clampedTop))
    }

    setPopoverPos({
      top: clampedTop,
      left: clampedLeft,
      placement,
      arrowOffset,
    })
  }, [visible, stepIndex])

  // Scroll into view & update position on change/resize
  useEffect(() => {
    if (!visible) return

    const timer = setTimeout(() => {
      const currentStep = STEPS[stepIndex]
      const el = document.querySelector(currentStep.targetSelector)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
      }
      updatePosition()
    }, 120)

    const handleScrollOrResize = () => {
      requestAnimationFrame(updatePosition)
    }

    window.addEventListener('resize', handleScrollOrResize)
    window.addEventListener('scroll', handleScrollOrResize, true)

    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', handleScrollOrResize)
      window.removeEventListener('scroll', handleScrollOrResize, true)
    }
  }, [visible, stepIndex, updatePosition])

  // Keyboard navigation
  useEffect(() => {
    if (!visible) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        dismiss()
      } else if (e.key === 'ArrowRight' && stepIndex < STEPS.length - 1) {
        setStepIndex((i) => i + 1)
      } else if (e.key === 'ArrowLeft' && stepIndex > 0) {
        setStepIndex((i) => i - 1)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [visible, stepIndex])

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, '1')
    setVisible(false)
  }

  const nextStep = () => {
    if (stepIndex < STEPS.length - 1) {
      setStepIndex((i) => i + 1)
    } else {
      dismiss()
    }
  }

  const prevStep = () => {
    if (stepIndex > 0) {
      setStepIndex((i) => i - 1)
    }
  }

  if (!visible) return null

  const s = STEPS[stepIndex]
  const Icon = s.icon

  return (
    <div className="fixed inset-0 z-[9998] pointer-events-auto select-none">
      {/* 1. Spotlight Cutout Overlay */}
      {targetRect && popoverPos.placement !== 'center' ? (
        <div
          className="fixed pointer-events-none transition-all duration-300 ease-out"
          style={{
            top: targetRect.top - 6,
            left: targetRect.left - 6,
            width: targetRect.width + 12,
            height: targetRect.height + 12,
            borderRadius: '12px',
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.82)',
          }}
        >
          {/* Crisp White Spotlight Frame */}
          <div className="absolute inset-0 rounded-xl border-2 border-white shadow-[0_0_20px_rgba(255,255,255,0.2)] animate-pulse" />

          {/* Pinpoint Target Beacon Tag */}
          <div className="absolute -top-3.5 left-3 flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-widest uppercase border border-zinc-700 bg-white text-black shadow-xl">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-black" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-black" />
            </span>
            <span>{s.targetLabel}</span>
          </div>
        </div>
      ) : (
        /* Fallback Backdrop when target is not attached to DOM */
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm pointer-events-none" />
      )}

      {/* 2. Interactive Popover Card with Directional Arrow */}
      <div
        ref={popoverRef}
        className="fixed z-[9999] bg-[#0d0d0d] border border-[#2a2a2a] rounded-2xl shadow-[0_25px_70px_rgba(0,0,0,0.95)] p-5 sm:p-6 space-y-4 max-w-[420px] w-[calc(100vw-32px)] transition-all duration-200"
        style={{
          top: popoverPos.top,
          left: popoverPos.left,
        }}
      >
        {/* Directional Pointing Arrow Pointer */}
        {popoverPos.placement === 'bottom' && (
          <>
            <div
              className="absolute -top-3 w-0 h-0 border-x-[10px] border-x-transparent border-b-[12px] border-b-white"
              style={{
                left: popoverPos.arrowOffset,
                transform: 'translateX(-50%)',
              }}
            />
            <div
              className="absolute -top-2 w-0 h-0 border-x-[8px] border-x-transparent border-b-[10px] border-b-[#0d0d0d]"
              style={{
                left: popoverPos.arrowOffset,
                transform: 'translateX(-50%)',
              }}
            />
          </>
        )}

        {popoverPos.placement === 'top' && (
          <>
            <div
              className="absolute -bottom-3 w-0 h-0 border-x-[10px] border-x-transparent border-t-[12px] border-t-white"
              style={{
                left: popoverPos.arrowOffset,
                transform: 'translateX(-50%)',
              }}
            />
            <div
              className="absolute -bottom-2 w-0 h-0 border-x-[8px] border-x-transparent border-t-[10px] border-t-[#0d0d0d]"
              style={{
                left: popoverPos.arrowOffset,
                transform: 'translateX(-50%)',
              }}
            />
          </>
        )}

        {popoverPos.placement === 'right' && (
          <>
            <div
              className="absolute -left-3 w-0 h-0 border-y-[10px] border-y-transparent border-r-[12px] border-r-white"
              style={{
                top: popoverPos.arrowOffset,
                transform: 'translateY(-50%)',
              }}
            />
            <div
              className="absolute -left-2 w-0 h-0 border-y-[8px] border-y-transparent border-r-[10px] border-r-[#0d0d0d]"
              style={{
                top: popoverPos.arrowOffset,
                transform: 'translateY(-50%)',
              }}
            />
          </>
        )}

        {popoverPos.placement === 'left' && (
          <>
            <div
              className="absolute -right-3 w-0 h-0 border-y-[10px] border-y-transparent border-l-[12px] border-l-white"
              style={{
                top: popoverPos.arrowOffset,
                transform: 'translateY(-50%)',
              }}
            />
            <div
              className="absolute -right-2 w-0 h-0 border-y-[8px] border-y-transparent border-l-[10px] border-l-[#0d0d0d]"
              style={{
                top: popoverPos.arrowOffset,
                transform: 'translateY(-50%)',
              }}
            />
          </>
        )}

        {/* Top Header: Badge, Arrow Indicator & Close */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-[#282828] bg-[#141414] px-2.5 py-0.5 text-[9px] font-mono font-bold tracking-widest uppercase text-zinc-300">
              {s.badge}
            </span>

            {/* Micro Arrow Indicator showing direction of targeted element */}
            <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold uppercase text-white">
              {popoverPos.placement === 'bottom' && (
                <>
                  <ArrowUp size={11} className="animate-bounce text-white" />
                  <span>Above</span>
                </>
              )}
              {popoverPos.placement === 'top' && (
                <>
                  <ArrowDown size={11} className="animate-bounce text-white" />
                  <span>Below</span>
                </>
              )}
              {popoverPos.placement === 'right' && (
                <>
                  <ArrowLeft size={11} className="animate-bounce text-white" />
                  <span>Left</span>
                </>
              )}
              {popoverPos.placement === 'left' && (
                <>
                  <ArrowRight size={11} className="animate-bounce text-white" />
                  <span>Right</span>
                </>
              )}
            </span>
          </div>

          <button
            onClick={dismiss}
            title="Close tour (Esc)"
            className="text-[#666666] hover:text-white p-1 rounded-md transition-colors cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>

        {/* Step Progress Indicators */}
        <div className="flex items-center gap-1.5 pt-0.5">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStepIndex(i)}
              title={`Jump to step ${i + 1}`}
              className="h-1 rounded-full transition-all duration-300 cursor-pointer"
              style={{
                flex: i === stepIndex ? 3 : 1,
                background:
                  i === stepIndex
                    ? '#ffffff'
                    : i < stepIndex
                    ? '#777777'
                    : '#222222',
              }}
            />
          ))}
        </div>

        {/* Title & Icon Header */}
        <div className="flex items-start gap-3.5 pt-1">
          <div className="h-11 w-11 rounded-xl border border-[#282828] bg-[#161616] text-white flex items-center justify-center flex-shrink-0 shadow-sm">
            <Icon size={20} />
          </div>
          <div className="min-w-0 space-y-0.5">
            <h3
              className="text-lg font-bold text-white tracking-tight leading-snug"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              {s.title}
            </h3>
            <p className="text-[11px] font-mono text-zinc-400 truncate">
              {s.subtitle}
            </p>
          </div>
        </div>

        {/* Description Body */}
        <div className="rounded-xl border border-[#1c1c1c] bg-[#121212] p-3 text-xs text-[#b0b0b0] leading-relaxed">
          {s.desc}
        </div>

        {/* Key Takeaways */}
        <div className="space-y-1.5 pt-0.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#666666]">
            Key Specifications
          </p>
          <ul className="space-y-1.5 text-[11px] text-zinc-300">
            {s.tips.map((tip, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-white" />
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer Navigation Controls */}
        <div className="flex items-center justify-between pt-3 border-t border-[#1c1c1c]">
          <div className="flex items-center gap-2">
            <button
              onClick={dismiss}
              className="text-xs text-[#666666] hover:text-[#cccccc] transition-colors font-medium cursor-pointer"
            >
              Skip
            </button>
            <span className="text-[10px] font-mono text-[#444444]">
              {stepIndex + 1}/{STEPS.length}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {stepIndex > 0 && (
              <button
                onClick={prevStep}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-[#888888] hover:text-white border border-[#262626] hover:border-[#444444] rounded-lg transition-all cursor-pointer"
              >
                <ArrowLeft size={12} />
                <span>Back</span>
              </button>
            )}

            {stepIndex < STEPS.length - 1 ? (
              <button
                onClick={nextStep}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer shadow-md bg-white text-black hover:bg-[#e0e0e0]"
              >
                <span>Next</span>
                <ArrowRight size={12} />
              </button>
            ) : (
              <button
                onClick={dismiss}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-black rounded-lg transition-all cursor-pointer shadow-md bg-white hover:bg-zinc-200"
              >
                <span>Finish</span>
                <CheckCircle2 size={12} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
