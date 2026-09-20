import React, { useState, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { User, Copy, Check, ExternalLink, ChevronDown, ChevronUp, Sparkles, Video, Share } from 'lucide-react'
import type { ChatMessage, SourceCitation } from '../../api/chat'

interface ChatMessageItemProps {
  message: ChatMessage
  isStreaming?: boolean
  onShare?: () => void
}

/**
 * Preprocesses markdown text so that all mathematical equations:
 * 1. Display equations (\[ ... \], $$ ... $$, \begin{equation}, etc.)
 *    are given distinct block spacing so they ALWAYS render on a NEW LINE, CENTERED.
 * 2. Inline math \( ... \) is converted to $ ... $.
 * 3. Fenced code blocks and inline code are strictly preserved untouched.
 */
function formatLaTeX(content: string): string {
  if (!content) return ''

  // Split by code blocks (fenced ```...``` or inline `...`) so code is never touched
  const codeBlockRegex = /(```[\s\S]*?```|`[^`\n]*`)/g
  const parts = content.split(codeBlockRegex)

  return parts
    .map((part, index) => {
      // Code block chunks (odd indices) are returned completely unchanged
      if (index % 2 === 1) return part

      let text = part

      // 1. Replace standalone math environments (equation, align, gather, etc.) with display block $$
      text = text.replace(
        /\\begin\{(equation|align|gather|alignat|multline)\*?\}([\s\S]*?)\\end\{\1\*?\}/g,
        (_match, _env, math) => `\n\n$$\n${math.trim()}\n$$\n\n`
      )

      // 2. Replace display math \[ ... \] with display block $$
      text = text.replace(/\\\[([\s\S]*?)\\\]/g, (_match, math) => `\n\n$$\n${math.trim()}\n$$\n\n`)

      // 3. Normalize existing $$ ... $$ to ensure they are on their own lines as block math
      text = text.replace(/\$\$([\s\S]*?)\$\$/g, (_match, math) => `\n\n$$\n${math.trim()}\n$$\n\n`)

      // 4. Replace inline math \( ... \) with $ ... $ (or $$ if it spans newlines)
      text = text.replace(/\\\(([\s\S]*?)\\\)/g, (_match, math) => {
        const trimmed = math.trim()
        return trimmed.includes('\n') ? `\n\n$$\n${trimmed}\n$$\n\n` : `$${trimmed}$`
      })

      return text
    })
    .join('')
}

function formatTime(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || isNaN(seconds)) return '00:00'
  const s = Math.floor(seconds)
  const mins = Math.floor(s / 60)
  const secs = s % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

// Vibrant One Dark Pro / Tokyo Night inspired developer theme
const vibrantCodeTheme: Record<string, React.CSSProperties> = {
  ...oneDark,
  'pre[class*="language-"]': {
    ...oneDark['pre[class*="language-"]'],
    background: '#0a0a0c',
    margin: 0,
    padding: '1.15rem 1.35rem',
    fontSize: '0.825rem',
    lineHeight: '1.7',
    fontFamily: "'JetBrains Mono', 'Fira Code', 'SFMono-Regular', Consolas, Menlo, monospace",
  },
  'code[class*="language-"]': {
    ...oneDark['code[class*="language-"]'],
    background: '#0a0a0c',
    fontFamily: "'JetBrains Mono', 'Fira Code', 'SFMono-Regular', Consolas, Menlo, monospace",
  },
  comment: { color: '#727988', fontStyle: 'italic' },
  prolog: { color: '#727988', fontStyle: 'italic' },
  doctype: { color: '#727988', fontStyle: 'italic' },
  cdata: { color: '#727988', fontStyle: 'italic' },
  punctuation: { color: '#abb2bf' },
  property: { color: '#e06c75' },
  tag: { color: '#e06c75' },
  boolean: { color: '#d19a66', fontWeight: '600' },
  number: { color: '#e5c07b', fontWeight: '500' },
  constant: { color: '#d19a66', fontWeight: '600' },
  symbol: { color: '#61afef' },
  deleted: { color: '#e06c75' },
  selector: { color: '#c678dd' },
  'attr-name': { color: '#d19a66' },
  string: { color: '#98c379' },
  char: { color: '#98c379' },
  builtin: { color: '#e5c07b' },
  operator: { color: '#56b6c2' },
  entity: { color: '#56b6c2', cursor: 'help' },
  url: { color: '#61afef' },
  variable: { color: '#e06c75' },
  'class-name': { color: '#e5c07b', fontWeight: '600' },
  'maybe-class-name': { color: '#e5c07b' },
  function: { color: '#61afef', fontWeight: '500' },
  'function-variable': { color: '#61afef' },
  keyword: { color: '#c678dd', fontWeight: '600' },
  regex: { color: '#98c379' },
  important: { color: '#e06c75', fontWeight: 'bold' },
}

const languageMetadata: Record<string, { label: string; dotColor: string; canonical: string }> = {
  python: { label: 'Python', dotColor: '#3572A5', canonical: 'python' },
  py: { label: 'Python', dotColor: '#3572A5', canonical: 'python' },
  cpp: { label: 'C++', dotColor: '#f34b7d', canonical: 'cpp' },
  'c++': { label: 'C++', dotColor: '#f34b7d', canonical: 'cpp' },
  c: { label: 'C', dotColor: '#555555', canonical: 'c' },
  java: { label: 'Java', dotColor: '#b07219', canonical: 'java' },
  go: { label: 'Go', dotColor: '#00ADD8', canonical: 'go' },
  golang: { label: 'Go', dotColor: '#00ADD8', canonical: 'go' },
  rust: { label: 'Rust', dotColor: '#dea584', canonical: 'rust' },
  rs: { label: 'Rust', dotColor: '#dea584', canonical: 'rust' },
  typescript: { label: 'TypeScript', dotColor: '#3178c6', canonical: 'typescript' },
  ts: { label: 'TypeScript', dotColor: '#3178c6', canonical: 'typescript' },
  tsx: { label: 'TypeScript (TSX)', dotColor: '#3178c6', canonical: 'tsx' },
  javascript: { label: 'JavaScript', dotColor: '#f1e05a', canonical: 'javascript' },
  js: { label: 'JavaScript', dotColor: '#f1e05a', canonical: 'javascript' },
  jsx: { label: 'JavaScript (JSX)', dotColor: '#f1e05a', canonical: 'jsx' },
  csharp: { label: 'C#', dotColor: '#178600', canonical: 'csharp' },
  cs: { label: 'C#', dotColor: '#178600', canonical: 'csharp' },
  'c#': { label: 'C#', dotColor: '#178600', canonical: 'csharp' },
  sql: { label: 'SQL', dotColor: '#e38c00', canonical: 'sql' },
  bash: { label: 'Bash', dotColor: '#89e051', canonical: 'bash' },
  sh: { label: 'Shell', dotColor: '#89e051', canonical: 'bash' },
  shell: { label: 'Shell', dotColor: '#89e051', canonical: 'bash' },
  zsh: { label: 'Zsh', dotColor: '#89e051', canonical: 'bash' },
  json: { label: 'JSON', dotColor: '#cb171e', canonical: 'json' },
  yaml: { label: 'YAML', dotColor: '#cb171e', canonical: 'yaml' },
  yml: { label: 'YAML', dotColor: '#cb171e', canonical: 'yaml' },
  html: { label: 'HTML', dotColor: '#e34c26', canonical: 'html' },
  css: { label: 'CSS', dotColor: '#563d7c', canonical: 'css' },
  markdown: { label: 'Markdown', dotColor: '#083fa1', canonical: 'markdown' },
  md: { label: 'Markdown', dotColor: '#083fa1', canonical: 'markdown' },
}

const CodeBlock = React.memo(function CodeBlock({ children, className }: { children: React.ReactNode; className?: string }) {
  const [copied, setCopied] = useState(false)
  const match = /language-(\w+)/.exec(className || '')
  const rawLang = (match ? match[1] : '').toLowerCase()
  const codeText = String(children).replace(/\n$/, '')

  const meta = languageMetadata[rawLang] || {
    label: rawLang ? rawLang.toUpperCase() : 'CODE',
    dotColor: '#888888',
    canonical: rawLang || 'text',
  }

  const handleCopy = () => {
    void navigator.clipboard.writeText(codeText).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="relative group/code my-6 overflow-hidden rounded-xl border border-[#242426] bg-[#0a0a0c] shadow-2xl text-xs">
      {/* Modern Developer Code Header */}
      <div className="flex items-center justify-between border-b border-[#1f1f22] bg-[#141417] px-4 py-2.5 text-[#999999] select-none">
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-2 w-2 rounded-full shadow-sm"
            style={{ backgroundColor: meta.dotColor }}
          />
          <span className="font-mono text-[11px] font-semibold tracking-wider text-[#d0d0d4]">
            {meta.label}
          </span>
        </div>

        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium text-[#aaaaaa] hover:bg-[#26262b] hover:text-white transition-all"
          title="Copy code"
        >
          {copied ? (
            <>
              <Check size={13} className="text-emerald-400" />
              <span className="text-emerald-400 font-semibold">Copied!</span>
            </>
          ) : (
            <>
              <Copy size={13} />
              <span>Copy code</span>
            </>
          )}
        </button>
      </div>

      {/* Colorful Syntax-Highlighted Code Body */}
      <div className="overflow-x-auto text-[13.5px] leading-relaxed">
        <SyntaxHighlighter
          language={meta.canonical}
          style={vibrantCodeTheme}
          wrapLongLines={false}
          PreTag="div"
        >
          {codeText}
        </SyntaxHighlighter>
      </div>
    </div>
  )
})

const SourcesList = React.memo(function SourcesList({ sources }: { sources: SourceCitation[] }) {
  const [expanded, setExpanded] = useState(false)
  const topSources = sources.slice(0, 3)

  if (topSources.length === 0) return null

  return (
    <div className="mt-6 border-t border-[#222222] pt-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-xs font-semibold tracking-wider uppercase text-[#888888] hover:text-white transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <Sparkles size={13} className="text-white" />
          <span>Verified Sources ({topSources.length})</span>
        </span>
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {expanded && (
        <div className="mt-3 space-y-2.5">
          {topSources.map((src, idx) => {
            const ytUrl =
              src.youtube_video_id && src.start_time !== null
                ? `https://www.youtube.com/watch?v=${src.youtube_video_id}&t=${Math.floor(src.start_time)}s`
                : src.youtube_video_id
                ? `https://www.youtube.com/watch?v=${src.youtube_video_id}`
                : null

            return (
              <div
                key={src.chunk_id || idx}
                className="rounded-lg border border-[#222222] bg-[#121212] p-3.5 text-xs transition-all hover:border-[#333333]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 font-medium text-white line-clamp-1">
                    <Video size={14} className="text-white flex-shrink-0" />
                    <span>{src.video_title || 'YouTube Video'}</span>
                  </div>
                  {src.start_time !== null && (
                    <span className="flex-shrink-0 rounded bg-[#1e1e1e] border border-[#2a2a2a] px-1.5 py-0.5 font-mono text-[10px] text-zinc-300">
                      @{formatTime(src.start_time)}
                    </span>
                  )}
                </div>

                {src.text_snippet && (
                  <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-[#888888] italic">
                    "{src.text_snippet}"
                  </p>
                )}

                <div className="mt-2.5 flex items-center justify-between text-[10px] text-[#666666]">
                  {src.similarity !== null && (
                    <span>Relevance: {Math.round(src.similarity * 100)}%</span>
                  )}
                  {ytUrl && (
                    <a
                      href={ytUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[#aaaaaa] hover:text-white transition-colors"
                    >
                      <span>Watch clip</span>
                      <ExternalLink size={10} />
                    </a>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
})

export const ChatMessageItem = React.memo(
  function ChatMessageItem({ message, isStreaming = false, onShare }: ChatMessageItemProps) {
  const [copied, setCopied] = useState(false)
  const isUser = message.role === 'user'

  const formattedContent = useMemo(() => formatLaTeX(message.content), [message.content])

  const handleCopyText = () => {
    void navigator.clipboard.writeText(message.content).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const handleShareClick = () => {
    if (onShare) {
      onShare()
    } else {
      window.dispatchEvent(new CustomEvent('chat:open-share'))
    }
  }

  if (isUser) {
    return (
      <div className="flex w-full justify-end my-5 animate-fade-in">
        <div className="flex max-w-[85%] md:max-w-[75%] items-start gap-3">
          <div className="rounded-2xl rounded-tr-sm bg-[#1c1c1c] border border-[#2b2b2b] px-5 py-3.5 text-[15px] text-white shadow-lg leading-relaxed">
            <p className="whitespace-pre-wrap select-text">{message.content}</p>
          </div>
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#2a2a2a] text-[#aaaaaa]">
            <User size={15} />
          </div>
        </div>
      </div>
    )
  }

  // Assistant Message (Clean spacious layout, centered math, colorful code blocks)
  return (
    <div className="w-full my-5 animate-fade-in">
      <div className="rounded-2xl bg-[#111111] border border-[#222222] p-6 md:p-8 text-[15px] text-white shadow-xl relative group">
        {/* Top-Right Copy Button */}
        {!isStreaming && message.content && (
          <div className="absolute right-3.5 top-3.5 z-10 opacity-70 group-hover:opacity-100 hover:opacity-100 transition-opacity">
            <button
              onClick={handleCopyText}
              className="flex items-center gap-1.5 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] px-2.5 py-1 text-[11px] text-[#888888] hover:text-white hover:border-[#3a3a3a] transition-all shadow-sm"
              title="Copy markdown"
              aria-label="Copy entire response as markdown"
            >
              {copied ? (
                <>
                  <Check size={12} className="text-emerald-400" />
                  <span className="text-emerald-400 font-medium">Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={12} />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
        )}


        <div className="prose prose-invert max-w-none text-[15px] leading-[1.8] text-[#e5e5e5]">
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[[rehypeKatex, { throwOnError: false, errorColor: '#f87171' }]]}
            components={{
              p: ({ children }) => (
                <p className="mb-4 text-[15px] leading-[1.8] text-[#e2e2e2] last:mb-0">
                  {children}
                </p>
              ),
              h1: ({ children }) => (
                <h1 className="mb-4 mt-8 text-xl font-bold text-white tracking-tight border-b border-[#282828] pb-2.5">
                  {children}
                </h1>
              ),
              h2: ({ children }) => (
                <h2 className="mb-3.5 mt-7 text-lg font-bold text-white tracking-tight">
                  {children}
                </h2>
              ),
              h3: ({ children }) => (
                <h3 className="mb-2.5 mt-5 text-base font-semibold text-white tracking-tight">
                  {children}
                </h3>
              ),
              ul: ({ children }) => (
                <ul className="my-4 ml-6 list-disc space-y-2.5 text-[15px] leading-[1.75] marker:text-[#888888]">
                  {children}
                </ul>
              ),
              ol: ({ children }) => (
                <ol className="my-4 ml-6 list-decimal space-y-2.5 text-[15px] leading-[1.75] marker:text-[#888888]">
                  {children}
                </ol>
              ),
              li: ({ children }) => (
                <li className="text-[#dedede] pl-1 leading-[1.75]">
                  {children}
                </li>
              ),
              blockquote: ({ children }) => (
                <blockquote className="my-5 rounded-xl border-l-4 border-white/60 bg-[#161616] py-3.5 px-5 text-[14.5px] italic text-[#d4d4d4] leading-relaxed shadow-sm">
                  {children}
                </blockquote>
              ),
              strong: ({ children }) => (
                <strong className="font-semibold text-white">
                  {children}
                </strong>
              ),
              hr: () => <hr className="my-6 border-0 border-t border-[#262626]" />,
              table: ({ children }) => (
                <div className="my-5 overflow-x-auto rounded-xl border border-[#262626] bg-[#121212] shadow-sm">
                  <table className="w-full text-left text-sm text-[#e0e0e0] border-collapse">
                    {children}
                  </table>
                </div>
              ),
              th: ({ children }) => (
                <th className="border-b border-[#262626] bg-[#181818] px-4 py-3 font-semibold text-white text-xs tracking-wider uppercase">
                  {children}
                </th>
              ),
              td: ({ children }) => (
                <td className="border-b border-[#202020] px-4 py-3 text-xs leading-relaxed text-[#cccccc]">
                  {children}
                </td>
              ),
              a: ({ href, children }) => (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white underline underline-offset-4 decoration-[#666666] hover:decoration-white transition-colors"
                >
                  {children}
                </a>
              ),
              pre: ({ children }) => <>{children}</>,
              code: ({ className, children }) => {
                const codeText = String(children).replace(/\n$/, '')
                const isInline = !className && !codeText.includes('\n')
                if (isInline) {
                  return (
                    <code className="rounded bg-[#1f1f1f] border border-[#2c2c2c] px-1.5 py-0.5 font-mono text-[13px] text-zinc-200">
                      {children}
                    </code>
                  )
                }
                return <CodeBlock className={className}>{children}</CodeBlock>
              },
            }}
          >
            {formattedContent}
          </ReactMarkdown>

          {isStreaming && (
            <span
              aria-hidden="true"
              className={`inline-block w-2 h-4.5 ${formattedContent ? 'ml-1.5' : 'ml-0'} bg-white/95 rounded-xs animate-pulse align-middle shadow-[0_0_8px_rgba(255,255,255,0.7)]`}
            />
          )}
        </div>

        {message.sources && message.sources.length > 0 && (
          <SourcesList sources={message.sources} />
        )}

        {/* Bottom Actions: Copy Markdown & Share Entire Chat */}
        {!isStreaming && message.content && (
          <div className="mt-4 pt-3 flex items-center gap-1 border-t border-[#1a1a1a] text-[#888888]">
            <button
              onClick={handleCopyText}
              className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[#888888] hover:text-white hover:bg-[#1c1c1c] transition-colors"
              title="Copy markdown"
              aria-label="Copy entire response as markdown"
            >
              {copied ? (
                <>
                  <Check size={14} className="text-emerald-400" />
                  <span className="text-[11px] text-emerald-400 font-medium">Copied!</span>
                </>
              ) : (
                <Copy size={14} />
              )}
            </button>

            <button
              onClick={handleShareClick}
              className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[#888888] hover:text-white hover:bg-[#1c1c1c] transition-colors"
              title="Share entire conversation"
              aria-label="Share entire conversation"
            >
              <Share size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
},
  (prev, next) => {
    return (
      prev.isStreaming === next.isStreaming &&
      prev.message.id === next.message.id &&
      prev.message.content === next.message.content &&
      prev.message.sources === next.message.sources &&
      prev.onShare === next.onShare
    )
  }
)
