import { createPortal } from 'react-dom'
import { X, Share2, Loader2, Check, Copy, ArrowUpRight } from 'lucide-react'

interface ShareConversationModalProps {
  isOpen: boolean
  onClose: () => void
  shareUrl: string | null
  loading: boolean
  copied: boolean
  onCopy: () => void
  onRevoke?: () => void
}

export function ShareConversationModal({
  isOpen,
  onClose,
  shareUrl,
  loading,
  copied,
  onCopy,
  onRevoke,
}: ShareConversationModalProps) {
  if (!isOpen) return null

  const modalContent = (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 px-4 backdrop-blur-xs animate-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-[#262626] bg-[#111111] p-6 shadow-2xl space-y-4 relative animate-scale-in"
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-[#888888] hover:text-white transition-colors"
          title="Close modal"
        >
          <X size={16} />
        </button>

        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1a1a1a] border border-[#2a2a2a] text-white">
          <Share2 size={18} />
        </div>

        <div>
          <h3 className="text-base font-bold text-white tracking-tight">
            Share Conversation
          </h3>
          <p className="mt-1 text-xs text-[#888888] leading-relaxed">
            Anyone with this public link will be able to view this conversation and fork it into their own account to continue chatting.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-6 gap-2 text-xs text-[#888888]">
            <Loader2 size={16} className="animate-spin text-white" />
            <span>Generating share link...</span>
          </div>
        ) : (
          <div className="space-y-4 pt-1">
            <div className="flex items-center gap-2 rounded-xl border border-[#262626] bg-[#0d0d0d] p-1.5 pl-3">
              <input
                type="text"
                readOnly
                value={shareUrl || ''}
                className="flex-1 bg-transparent text-xs text-[#cccccc] font-mono select-all focus:outline-none truncate"
              />
              <button
                onClick={onCopy}
                className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-black hover:bg-zinc-200 transition-colors flex-shrink-0"
              >
                {copied ? (
                  <>
                    <Check size={13} className="text-emerald-600" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy size={13} />
                    <span>Copy link</span>
                  </>
                )}
              </button>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[#1a1a1a] text-xs">
              {shareUrl && (
                <a
                  href={shareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[#888888] hover:text-white transition-colors"
                >
                  <span>Open link in new tab</span>
                  <ArrowUpRight size={12} />
                </a>
              )}

              {onRevoke && (
                <button
                  onClick={onRevoke}
                  className="ml-auto text-xs text-red-400 hover:text-red-300 transition-colors"
                >
                  Revoke public link
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}
