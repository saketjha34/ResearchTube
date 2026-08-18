import { useCallback, useEffect, useRef, useState } from 'react'
import { CheckCircle, XCircle, Info, X } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

export type ToastVariant = 'info' | 'success' | 'error'

export interface ToastMessage {
  id: string
  message: string
  variant: ToastVariant
  duration?: number
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const toast = useCallback(
    (message: string, variant: ToastVariant = 'info', duration = 4000) => {
      const id = Math.random().toString(36).slice(2)
      setToasts((prev) => [...prev, { id, message, variant, duration }])
    },
    []
  )

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return { toasts, toast, dismiss }
}

// ── Single Toast Item ─────────────────────────────────────────────────────────

function ToastItem({
  toast: t,
  onDismiss,
}: {
  toast: ToastMessage
  onDismiss: (id: string) => void
}) {
  const [visible, setVisible] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      setVisible(false)
      setTimeout(() => onDismiss(t.id), 350)
    }, t.duration ?? 4000)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [t.id, t.duration, onDismiss])

  type Cfg = { icon: React.ReactNode; border: string; bg: string; text: string; iconColor: string }
  const config: Record<ToastVariant, Cfg> = {
    info: {
      icon: <Info size={15} />,
      border: 'border-[#2a2a2a]',
      bg: 'bg-[#111111]',
      text: 'text-[#cccccc]',
      iconColor: 'text-[#888888]',
    },
    success: {
      icon: <CheckCircle size={15} />,
      border: 'border-[#1a3a1a]',
      bg: 'bg-[#0a160a]',
      text: 'text-[#bbddbb]',
      iconColor: 'text-green-400',
    },
    error: {
      icon: <XCircle size={15} />,
      border: 'border-[#3a1a1a]',
      bg: 'bg-[#160a0a]',
      text: 'text-[#ddbbbb]',
      iconColor: 'text-red-400',
    },
  }

  const c = config[t.variant]

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 border rounded-xl shadow-2xl max-w-sm w-full pointer-events-auto transition-all duration-300 ${c.bg} ${c.border}`}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.97)',
      }}
    >
      <span className={`flex-shrink-0 mt-0.5 ${c.iconColor}`}>{c.icon}</span>
      <p className={`flex-1 text-sm font-medium leading-snug ${c.text}`}>{t.message}</p>
      <button
        onClick={() => { setVisible(false); setTimeout(() => onDismiss(t.id), 350) }}
        className="flex-shrink-0 text-[#444444] hover:text-[#888888] transition-colors mt-0.5"
        aria-label="Dismiss"
      >
        <X size={13} />
      </button>
    </div>
  )
}

// ── Toast Container ───────────────────────────────────────────────────────────

export function ToastContainer({
  toasts,
  dismiss,
}: {
  toasts: ToastMessage[]
  dismiss: (id: string) => void
}) {
  if (toasts.length === 0) return null
  return (
    <div className="fixed bottom-6 right-6 z-[300] flex flex-col gap-2.5 pointer-events-none">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
      ))}
    </div>
  )
}
