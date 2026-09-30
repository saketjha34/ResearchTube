import React, { useState, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { User, Copy, Check, ExternalLink, ChevronDown, ChevronUp, Sparkles, Video, Share, Clock, Globe, Play, Terminal, Loader2, Download, Maximize2, X, FileText, AlertCircle } from 'lucide-react'
import {
  executePythonCodeStream,
  executeCppCodeStream,
  type ChatMessage,
  type SourceCitation,
  type ExecutePythonResponse,
  type ExecuteCPPResponse,
} from '../../api/chat'

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

function formatMessageTime(dateString?: string | null): string {
  if (!dateString) return ''
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return ''
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()

  const timeFormatted = date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })

  if (isToday) {
    return `Today at ${timeFormatted}`
  }

  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) {
    return `Yesterday at ${timeFormatted}`
  }

  const isCurrentYear = date.getFullYear() === now.getFullYear()
  const dateFormatted = date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(isCurrentYear ? {} : { year: 'numeric' }),
  })
  return `${dateFormatted}, ${timeFormatted}`
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
  cc: { label: 'C++', dotColor: '#f34b7d', canonical: 'cpp' },
  cxx: { label: 'C++', dotColor: '#f34b7d', canonical: 'cpp' },
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
  const [isRunning, setIsRunning] = useState(false)
  const [runningStatus, setRunningStatus] = useState<string>('')
  const [liveStdout, setLiveStdout] = useState<string>('')
  const [liveStderr, setLiveStderr] = useState<string>('')
  const [liveFigures, setLiveFigures] = useState<string[]>([])
  const [liveDurationMs, setLiveDurationMs] = useState<number>(0)
  const [executionResult, setExecutionResult] = useState<ExecutePythonResponse | ExecuteCPPResponse | null>(null)
  const [showConsole, setShowConsole] = useState(false)
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null)


  const match = /language-([a-zA-Z0-9_+#-]+)/i.exec(className || '')
  let rawLang = (match ? match[1] : '').toLowerCase()
  const codeText = String(children).replace(/\n$/, '')

  // Auto-detect Python or C++ if code fence was untagged
  if (!rawLang) {
    if (
      codeText.includes('#include') ||
      codeText.includes('std::') ||
      codeText.includes('cout <<') ||
      codeText.includes('int main(') ||
      codeText.includes('cin >>')
    ) {
      rawLang = 'cpp'
    } else if (
      codeText.includes('def ') ||
      codeText.includes('import ') ||
      codeText.includes('print(') ||
      codeText.includes('class ')
    ) {
      rawLang = 'python'
    }
  }

  const meta = languageMetadata[rawLang] || {
    label: rawLang ? rawLang.toUpperCase() : 'CODE',
    dotColor: '#888888',
    canonical: rawLang || 'text',
  }

  const isPython = meta.canonical === 'python' || rawLang === 'py' || rawLang === 'python'
  const isCpp = meta.canonical === 'cpp' || rawLang === 'cpp' || rawLang === 'c++' || rawLang === 'c' || rawLang === 'cc' || rawLang === 'cxx'
  const isRunnable = isPython || isCpp

  const handleCopy = () => {
    void navigator.clipboard.writeText(codeText).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const handleRunCode = async () => {
    if (isRunning) return
    setIsRunning(true)
    setShowConsole(true)
    setExecutionResult(null)
    setLiveStdout('')
    setLiveStderr('')
    setLiveFigures([])
    setRunningStatus(
      isCpp
        ? 'The sandbox is running: Booting isolated micro-VM...'
        : 'The sandbox is running: Booting micro-VM...'
    )

    const startTime = Date.now()
    const timerInterval = setInterval(() => {
      setLiveDurationMs(Date.now() - startTime)
    }, 100)

    try {
      if (isCpp) {
        await executeCppCodeStream(
          {
            code: codeText,
          },
          {
            onStatus: (status) => {
              setRunningStatus(status.message)
            },
            onStdout: (text) => {
              setLiveStdout((prev) => prev + text)
            },
            onStderr: (text) => {
              setLiveStderr((prev) => prev + text)
            },
            onDone: (res) => {
              clearInterval(timerInterval)
              setLiveDurationMs(res.duration_ms)
              setExecutionResult(res)
              setIsRunning(false)
              setRunningStatus('')
            },
            onError: (err) => {
              clearInterval(timerInterval)
              setExecutionResult({
                success: false,
                stdout: liveStdout,
                stderr: liveStderr,
                error: err,
                compile_output: null,
                compile_time_ms: 0,
                execution_time_ms: 0,
                duration_ms: Date.now() - startTime,
                exit_code: 1,
                artifacts: [],
              })
              setIsRunning(false)
              setRunningStatus('')
            },
          }
        )
      } else {
        await executePythonCodeStream(
          codeText,
          {
            onStatus: (status) => {
              setRunningStatus(status.message)
            },
            onStdout: (text) => {
              setLiveStdout((prev) => prev + text)
            },
            onFigure: (img) => {
              setLiveFigures((prev) => (prev.includes(img) ? prev : [...prev, img]))
            },
            onDone: (res) => {
              clearInterval(timerInterval)
              setLiveDurationMs(res.duration_ms)
              setExecutionResult(res)
              setIsRunning(false)
              setRunningStatus('')
            },
            onError: (err) => {
              clearInterval(timerInterval)
              setExecutionResult({
                success: false,
                stdout: liveStdout,
                stderr: '',
                error: err,
                results: [],
                images: liveFigures,
                duration_ms: Date.now() - startTime,
                packages_installed: [],
              })
              setIsRunning(false)
              setRunningStatus('')
            },
          },

        )
      }
    } catch (err: any) {
      clearInterval(timerInterval)
      setExecutionResult({
        success: false,
        stdout: liveStdout,
        stderr: '',
        error: err?.message || 'Execution failed',
        duration_ms: Date.now() - startTime,
      } as any)
      setIsRunning(false)
      setRunningStatus('')
    }
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

        <div className="flex items-center gap-2">
          {isRunnable && (
            <button
              onClick={handleRunCode}
              disabled={isRunning}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-all ${
                isRunning
                  ? 'bg-zinc-800/80 text-zinc-400 border border-zinc-700/60 cursor-not-allowed'
                  : 'bg-[#27272a] hover:bg-[#38383e] text-zinc-100 hover:text-white border border-zinc-600/80 shadow-sm active:scale-95'
              }`}
              title={`Run ${isCpp ? 'C++20' : 'Python'} in cloud sandbox`}
            >
              {isRunning ? (
                <>
                  <Loader2 size={11} className="animate-spin text-zinc-300" />
                  <span>Run</span>
                </>
              ) : (
                <>
                  <Play size={11} className="fill-zinc-300 text-zinc-300" />
                  <span>Run</span>
                </>
              )}
            </button>
          )}

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

      {/* Interactive Sandbox Console Drawer */}
      {showConsole && (() => {
        const displayedImages = executionResult && 'images' in executionResult && executionResult.images.length > 0 ? executionResult.images : liveFigures
        const currentDurationMs = isRunning ? liveDurationMs : (executionResult?.duration_ms || liveDurationMs)
        const isCppResult = executionResult && 'compile_time_ms' in executionResult

        return (
          <div className="border-t border-[#1f1f22] bg-[#070709] p-4 text-xs font-mono">
            {/* Console Header */}
            <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-[#1b1b1e] text-[#8e8e93]">
              <div className="flex items-center gap-2 flex-wrap">
                <Terminal size={13} className="text-zinc-400" />
                <span className="font-semibold text-zinc-300 tracking-wide text-[11px]">
                  Console ({isCpp ? 'C++20' : 'Python 3'})
                </span>

                {!isRunning && executionResult && (
                  <>
                    {executionResult.exit_code !== undefined && executionResult.exit_code !== null && executionResult.exit_code !== 0 && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono text-rose-300 bg-rose-950/40 border border-rose-900/50">
                        Exit Code: {executionResult.exit_code}
                      </span>
                    )}

                    {executionResult.error && (!executionResult.exit_code || executionResult.exit_code === 0) && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono text-rose-300 bg-rose-950/40 border border-rose-900/50">
                        Error
                      </span>
                    )}

                  </>
                )}
              </div>

              <div className="flex items-center gap-3">
                {currentDurationMs > 0 && (
                  <span className="text-[11px] text-zinc-400 flex items-center gap-1 font-mono">
                    <Clock size={11} />
                    {isCppResult && (executionResult as ExecuteCPPResponse).compile_time_ms > 0
                      ? `Compile s | Exec ${((executionResult as ExecuteCPPResponse).execution_time_ms / 1000).toFixed(2)}s`
                      : `${(currentDurationMs / 1000).toFixed(2)}s`}
                  </span>
                )}
                <button
                  onClick={() => setShowConsole(false)}
                  className="text-zinc-400 hover:text-zinc-200 p-0.5 transition-colors"
                  title="Collapse console"
                >
                  <ChevronUp size={14} />
                </button>
              </div>
            </div>

            {/* Live Running State */}
            {isRunning && (
              <div className="flex items-center gap-2 py-2 text-zinc-300 font-mono text-xs">
                <Loader2 size={13} className="text-zinc-400 animate-spin" />
                <span>{runningStatus || 'The sandbox is running...'}</span>
              </div>
            )}

            {/* Compiler Diagnostic Output (C++ errors) */}
            {executionResult && 'compile_output' in executionResult && (executionResult as ExecuteCPPResponse).compile_output && !executionResult.success && (
              <div className="whitespace-pre-wrap text-amber-300 font-mono text-[12px] leading-relaxed mb-3 bg-amber-950/25 p-3 rounded-lg border border-amber-800/40">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-400 mb-1.5">
                  <AlertCircle size={12} />
                  <span>g++ Compiler Diagnostic</span>
                </div>
                {(executionResult as ExecuteCPPResponse).compile_output}
              </div>
            )}

            {/* Stdout Output (live or complete) */}
            {(executionResult?.stdout || liveStdout) && (
              <div className="whitespace-pre-wrap text-zinc-200 font-mono text-[12px] leading-relaxed mb-3 bg-[#0d0d12] p-3 rounded-lg border border-[#1a1a22] shadow-inner">
                {executionResult ? executionResult.stdout : liveStdout}
              </div>
            )}

            {/* Stderr / Error Output */}
            {executionResult?.error && (!('compile_output' in executionResult) || (executionResult as ExecuteCPPResponse).error !== 'Compilation Error') && (
              <div className="whitespace-pre-wrap text-rose-400 font-mono text-[12px] leading-relaxed mb-3 bg-rose-950/20 p-3 rounded-lg border border-rose-900/35">
                {executionResult.error}
              </div>
            )}

            {/* Stderr stream output if any */}
            {!executionResult && liveStderr && (
              <div className="whitespace-pre-wrap text-amber-400 font-mono text-[12px] leading-relaxed mb-3 bg-amber-950/20 p-3 rounded-lg border border-amber-900/35">
                {liveStderr}
              </div>
            )}

            {/* Empty Output notice */}
            {executionResult && !executionResult.stdout && !executionResult.error && (!('compile_output' in executionResult) || !(executionResult as ExecuteCPPResponse).compile_output) && displayedImages.length === 0 && (
              <div className="text-zinc-400 italic py-1">
                Program executed with return code 0 (no output printed).
              </div>
            )}

            {/* Generated File Artifacts (PDFs, CSVs, Excel, etc.) */}
            {executionResult?.artifacts && executionResult.artifacts.length > 0 && (
              <div className="mt-3 space-y-2">
                <div className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText size={12} className="text-zinc-400" />
                  Generated Files & Downloads ({executionResult.artifacts.length})
                </div>
                <div className="flex flex-wrap gap-2">
                  {executionResult.artifacts.map((art, idx) => (
                    <a
                      key={idx}
                      href={art.data_url}
                      download={art.filename}
                      className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-100 border border-zinc-700 hover:border-zinc-500 text-xs font-medium transition-all shadow-sm group hover:scale-[1.02] cursor-pointer"
                    >
                      <FileText size={14} className="text-zinc-300 group-hover:text-white group-hover:scale-110 transition-transform" />
                      <span className="font-mono">{art.filename}</span>
                      <span className="text-[10px] text-zinc-300 bg-zinc-900/90 px-1.5 py-0.5 rounded border border-zinc-700/80">
                        {art.size_bytes >= 1024 ? `${(art.size_bytes / 1024).toFixed(1)} KB` : `${art.size_bytes} B`}
                      </span>
                      <Download size={13} className="ml-0.5 text-zinc-400 group-hover:text-zinc-200" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Generated Charts & Figures */}
            {displayedImages.length > 0 && (
              <div className="mt-3 space-y-3">
                <div className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles size={12} className="text-zinc-400" />
                  Generated Figures ({displayedImages.length})
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {displayedImages.map((imgUrl, idx) => (
                    <div key={idx} className="relative group/img rounded-xl overflow-hidden border border-[#232328] bg-black/70 p-2">
                      <img
                        src={imgUrl}
                        alt={`Figure ${idx + 1}`}
                        className="w-full max-h-[420px] object-contain rounded-lg cursor-pointer hover:opacity-95 transition-opacity"
                        onClick={() => setFullScreenImage(imgUrl)}
                      />
                      <div className="absolute top-4 right-4 flex items-center gap-1.5 opacity-0 group-hover/img:opacity-100 transition-opacity bg-black/80 backdrop-blur-md rounded-lg p-1 border border-white/15 shadow-xl">
                        <button
                          onClick={() => setFullScreenImage(imgUrl)}
                          className="p-1.5 rounded-md hover:bg-white/10 text-zinc-300 hover:text-white transition-colors"
                          title="View fullscreen"
                        >
                          <Maximize2 size={13} />
                        </button>
                        <a
                          href={imgUrl}
                          download={`figure-${idx + 1}.png`}
                          className="p-1.5 rounded-md hover:bg-white/10 text-zinc-300 hover:text-white transition-colors"
                          title="Download figure"
                        >
                          <Download size={13} />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })()}

      {/* Fullscreen Image Modal */}
      {fullScreenImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
          onClick={() => setFullScreenImage(null)}
        >
          <div className="relative max-w-5xl max-h-[90vh] bg-[#101014] border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-3 border-b border-zinc-800 text-zinc-300 text-xs">
              <span className="font-mono">Generated Plot</span>
              <div className="flex items-center gap-2">
                <a
                  href={fullScreenImage}
                  download="plot.png"
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-white transition-colors"
                >
                  <Download size={13} />
                  Download
                </a>
                <button
                  onClick={() => setFullScreenImage(null)}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="overflow-auto flex items-center justify-center p-2">
              <img src={fullScreenImage} alt="Full plot" className="max-h-[78vh] w-auto object-contain rounded-lg" />
            </div>
          </div>
        </div>
      )}
    </div>
  )
})

function extractDomain(url?: string | null): string | null {
  if (!url) return null
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

function cleanDisplaySnippet(snippet?: string | null): string {
  if (!snippet) return ''
  return snippet
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/\\n/g, ' ')
    .replace(/\\r/g, ' ')
    .replace(/\\/g, '')
    .replace(/#{1,6}\s*/g, '')
    .replace(/[*_~`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

const SourceCard = React.memo(function SourceCard({
  src,
  idx,
  total,
}: {
  src: SourceCitation
  idx: number
  total: number
}) {
  const [isHovered, setIsHovered] = useState(false)

  const ytUrl =
    src.youtube_video_id && src.start_time != null
      ? `https://www.youtube.com/watch?v=${src.youtube_video_id}&t=${Math.floor(src.start_time)}s`
      : src.youtube_video_id
      ? `https://www.youtube.com/watch?v=${src.youtube_video_id}`
      : null

  const targetUrl = src.url || ytUrl
  const domain = extractDomain(src.url)
  const snippetText = cleanDisplaySnippet(src.text_snippet)

  const displayTitle =
    src.title ||
    src.video_title ||
    (src.source_type === 'web'
      ? (domain || 'Web Source')
      : (src.youtube_video_id ? `Video ${src.youtube_video_id}` : 'YouTube Video'))

  const isRightEdge = idx >= total - 2

  return (
    <div
      className="relative flex-shrink-0"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <a
        href={targetUrl || '#'}
        target={targetUrl ? '_blank' : undefined}
        rel="noopener noreferrer"
        className="group flex flex-col justify-between w-[205px] h-[92px] p-2.5 rounded-xl border border-[#232328] bg-[#111114]/90 hover:bg-[#16161f] hover:border-sky-500/40 transition-all duration-200 shadow-sm hover:shadow-lg hover:shadow-black/60 hover:-translate-y-0.5 select-none cursor-pointer"
        title={displayTitle}
      >
        {/* Top: Icon + Domain/Channel + External Arrow */}
        <div className="flex items-center justify-between gap-1.5 text-[11px] text-zinc-400">
          <div className="flex items-center gap-1.5 min-w-0">
            {src.source_type === 'web' || (src.url && !src.youtube_video_id) ? (
              <Globe size={13} className="text-sky-400 flex-shrink-0" />
            ) : (
              <Video size={13} className="text-rose-400 flex-shrink-0" />
            )}
            <span className="font-mono text-[10.5px] text-zinc-400 truncate">
              {domain || (src.source_type === 'web' ? 'Web' : 'YouTube')}
            </span>
          </div>
          <ExternalLink size={11} className="text-zinc-500 group-hover:text-sky-400 transition-colors flex-shrink-0" />
        </div>

        {/* Middle: Shortened Title */}
        <p className="line-clamp-2 text-[12px] font-medium leading-snug text-zinc-200 group-hover:text-white transition-colors">
          {displayTitle}
        </p>

        {/* Bottom meta: Time / Source # */}
        <div className="flex items-center justify-between text-[10px] text-zinc-500">
          <span className="font-mono text-zinc-500">#{src.index || idx + 1}</span>
          {src.start_time != null && (
            <span className="font-mono text-zinc-400">@{formatTime(src.start_time)}</span>
          )}
        </div>
      </a>

      {/* Rich Hover Preview Tooltip / Popover */}
      {isHovered && (
        <div
          className={`absolute bottom-[calc(100%+8px)] ${
            isRightEdge ? 'right-0' : 'left-0'
          } z-50 w-[290px] p-3 rounded-xl border border-[#2f2f38] bg-[#141418] shadow-2xl shadow-black/90 text-xs backdrop-blur-md animate-in fade-in zoom-in-95 duration-150 pointer-events-none`}
        >
          {/* Popover Header */}
          <div className="flex items-center justify-between gap-2 border-b border-[#22222a] pb-2 mb-2 text-[11px]">
            <div className="flex items-center gap-1.5 text-zinc-400">
              {src.source_type === 'web' || (src.url && !src.youtube_video_id) ? (
                <Globe size={12} className="text-sky-400" />
              ) : (
                <Video size={12} className="text-rose-400" />
              )}
              <span className="font-mono text-zinc-300 font-medium truncate max-w-[170px]">
                {domain || 'Source'}
              </span>
            </div>
            <span className="text-[10px] text-sky-400 flex items-center gap-1 font-medium">
              Click to open <ExternalLink size={10} />
            </span>
          </div>

          {/* Full Title */}
          <p className="font-semibold text-zinc-100 text-[12px] leading-snug">
            {displayTitle}
          </p>

          {/* Text Snippet if available */}
          {snippetText && (
            <p className="mt-2 text-[11px] leading-relaxed text-zinc-400 italic line-clamp-3 bg-[#0a0a0d]/70 rounded-md p-2 border border-[#1e1e24]">
              "{snippetText}"
            </p>
          )}

          {/* Timestamp / Relevance */}
          <div className="mt-2 flex items-center justify-between text-[10px] text-zinc-500">
            {src.similarity != null ? (
              <span>Relevance: {Math.round(src.similarity * 100)}%</span>
            ) : <span />}
            {src.start_time != null && (
              <span className="font-mono text-zinc-400">Timestamp: @{formatTime(src.start_time)}</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
})

const SourcesList = React.memo(function SourcesList({ sources }: { sources: SourceCitation[] }) {
  const [expanded, setExpanded] = useState(true)

  if (!sources || sources.length === 0) return null

  return (
    <div className="mt-6 border-t border-[#222222] pt-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-xs font-semibold tracking-wider uppercase text-[#888888] hover:text-white transition-colors cursor-pointer select-none"
      >
        <span className="flex items-center gap-1.5">
          <Sparkles size={13} className="text-white" />
          <span>Verified Sources ({sources.length})</span>
        </span>
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {expanded && (
        <div className="mt-3 flex items-center gap-2.5 overflow-x-auto pb-2 pt-1 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
          {sources.map((src, idx) => (
            <SourceCard
              key={src.chunk_id || idx}
              src={src}
              idx={idx}
              total={sources.length}
            />
          ))}
        </div>
      )}
    </div>
  )
})

/**
 * Custom Rehype plugin that places an inline streaming cursor element
 * inside the very last text container node of the AST (inline with the last token).
 */
function rehypeStreamingCursor() {
  return (tree: any) => {
    function findAndAppend(node: any): boolean {
      if (!node.children || node.children.length === 0) return false

      let lastIdx = node.children.length - 1
      while (lastIdx >= 0) {
        const child = node.children[lastIdx]
        if (child.type === 'text' && child.value.trim() === '' && lastIdx > 0) {
          lastIdx--
        } else {
          break
        }
      }

      if (lastIdx < 0) return false
      const targetChild = node.children[lastIdx]

      // If fenced code block (pre), append cursor after the pre block
      if (targetChild.type === 'element' && targetChild.tagName === 'pre') {
        node.children.splice(lastIdx + 1, 0, {
          type: 'element',
          tagName: 'span',
          properties: { className: 'streaming-cursor' },
          children: [],
        })
        return true
      }

      // If KaTeX math element, append right after the math block
      const isKatex =
        targetChild.type === 'element' &&
        targetChild.properties &&
        ((Array.isArray(targetChild.properties.className) &&
          targetChild.properties.className.some((c: any) => String(c).includes('katex'))) ||
          (typeof targetChild.properties.className === 'string' &&
            targetChild.properties.className.includes('katex')))

      if (isKatex) {
        node.children.splice(lastIdx + 1, 0, {
          type: 'element',
          tagName: 'span',
          properties: { className: 'streaming-cursor' },
          children: [],
        })
        return true
      }

      // If text node, append cursor directly after it inside this parent
      if (targetChild.type === 'text') {
        node.children.splice(lastIdx + 1, 0, {
          type: 'element',
          tagName: 'span',
          properties: { className: 'streaming-cursor' },
          children: [],
        })
        return true
      }

      // If element container, recurse to find deepest child
      if (targetChild.type === 'element') {
        const ok = findAndAppend(targetChild)
        if (ok) return true

        targetChild.children = targetChild.children || []
        targetChild.children.push({
          type: 'element',
          tagName: 'span',
          properties: { className: 'streaming-cursor' },
          children: [],
        })
        return true
      }

      return false
    }

    const success = findAndAppend(tree)
    if (!success) {
      tree.children = tree.children || []
      tree.children.push({
        type: 'element',
        tagName: 'span',
        properties: { className: 'streaming-cursor' },
        children: [],
      })
    }
  }
}

export const ChatMessageItem = React.memo(
  function ChatMessageItem({ message, isStreaming = false, onShare }: ChatMessageItemProps) {
  const [copied, setCopied] = useState(false)
  const [lightboxImage, setLightboxImage] = useState<string | null>(null)
  const isUser = message.role === 'user'

  const formattedContent = useMemo(() => formatLaTeX(message.content), [message.content])
  const rehypePlugins = useMemo(() => {
    const plugins: any[] = [[rehypeKatex, { throwOnError: false, errorColor: '#f87171' }]]
    if (isStreaming) {
      plugins.push(rehypeStreamingCursor)
    }
    return plugins
  }, [isStreaming])

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
        <div className="flex flex-col items-end max-w-[85%] md:max-w-[75%]">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl rounded-tr-sm bg-[#1c1c1c] border border-[#2b2b2b] px-5 py-3.5 text-[15px] text-white shadow-lg leading-relaxed">
              <p className="whitespace-pre-wrap select-text">{message.content}</p>
            </div>
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#2a2a2a] text-[#aaaaaa]">
              <User size={15} />
            </div>
          </div>
          {message.created_at && (
            <div className="mt-1 mr-11 flex items-center gap-1 text-[11px] text-[#666666] font-mono select-none">
              <Clock size={10} className="opacity-60 text-[#888888]" />
              <span>{formatMessageTime(message.created_at)}</span>
            </div>
          )}
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
            rehypePlugins={rehypePlugins}
            components={{
              span: ({ className, children, ...props }) => {
                if (className === 'streaming-cursor') {
                  return (
                    <span
                      aria-hidden="true"
                      className="inline-block w-2 h-4.5 ml-1 bg-white/95 rounded-xs animate-pulse align-middle shadow-[0_0_8px_rgba(255,255,255,0.7)]"
                    />
                  )
                }
                return (
                  <span className={className} {...props}>
                    {children}
                  </span>
                )
              },
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
              a: ({ href, children }) => {
                const isDataUrl = Boolean(href?.startsWith('data:'))
                const isExternal = Boolean(href?.startsWith('http://') || href?.startsWith('https://') || href?.startsWith('mailto:'))
                const isRelativeFile = Boolean(
                  href && !isDataUrl && !isExternal && (
                    href.endsWith('.pdf') ||
                    href.endsWith('.csv') ||
                    href.endsWith('.xlsx') ||
                    href.endsWith('.txt') ||
                    href.endsWith('.png') ||
                    href.endsWith('.jpg')
                  )
                )

                // If real data URL from sandbox execution, download directly
                if (isDataUrl) {
                  return (
                    <a
                      href={href}
                      download={true}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 my-1 rounded-xl bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-100 border border-zinc-700 hover:border-zinc-500 text-xs font-medium transition-all shadow-sm no-underline cursor-pointer hover:scale-[1.02]"
                    >
                      <Download size={13} className="text-zinc-300" />
                      {children}
                    </a>
                  )
                }

                // If relative filename (e.g. random_text_report.pdf) or empty/dummy link, prevent page reload!
                if (!isExternal || isRelativeFile || !href || href === '#' || href === '') {
                  return (
                    <span
                      onClick={(e) => {
                        e.preventDefault()
                        // Scroll to the code block Run button above
                        const buttons = document.querySelectorAll('button')
                        for (const btn of buttons) {
                          if (btn.textContent?.includes('Run') || btn.querySelector('svg.lucide-play')) {
                            btn.scrollIntoView({ behavior: 'smooth', block: 'center' })
                            btn.classList.add('ring-2', 'ring-zinc-400', 'ring-offset-2', 'ring-offset-black')
                            setTimeout(() => btn.classList.remove('ring-2', 'ring-zinc-400', 'ring-offset-2', 'ring-offset-black'), 2000)
                            break
                          }
                        }
                      }}
                      title="Click 'Run' on the Python code block above to execute and generate this file"
                      className="inline-flex items-center gap-2 px-3 py-1.5 my-1 rounded-xl bg-[#1c1c22] hover:bg-[#25252c] text-zinc-300 border border-[#2e2e38] text-xs font-medium transition-all shadow-sm cursor-pointer select-none group"
                    >
                      <Terminal size={13} className="text-zinc-400 group-hover:scale-110 transition-transform" />
                      <span>{children}</span>
                      <span className="text-[10px] text-zinc-300 font-mono bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-700/80">
                        Click 'Run' above
                      </span>
                    </span>
                  )
                }

                return (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white underline underline-offset-4 decoration-[#666666] hover:decoration-white transition-colors"
                  >
                    {children}
                  </a>
                )
              },
              img: ({ src, alt }) => (
                <div className="my-3 rounded-xl overflow-hidden border border-[#232328] bg-black/60 p-2 inline-block max-w-full">
                  <img
                    src={src}
                    alt={alt || 'Generated Chart'}
                    className="max-h-[460px] w-auto max-w-full object-contain rounded-lg cursor-pointer hover:opacity-95 transition-opacity"
                    onClick={() => src && setLightboxImage(src)}
                  />
                </div>
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
        </div>

        {message.sources && message.sources.length > 0 && (
          <SourcesList sources={message.sources} />
        )}

        {/* Bottom Actions & AI Response Timestamp */}
        {(message.content || message.created_at) && (
          <div className="mt-4 pt-3 flex items-center justify-between border-t border-[#1a1a1a] text-[#888888]">
            <div className="flex items-center gap-1">
              {!isStreaming && message.content && (
                <>
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
                </>
              )}
              {isStreaming && (
                <span className="flex items-center gap-2 text-[11px] text-[#888888]">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                  <span>Generating response...</span>
                </span>
              )}
            </div>



            {/* AI Response Timestamp */}
            {message.created_at && (
              <div className="flex items-center gap-1.5 text-[11px] text-[#71717a] font-mono select-none">
                <Clock size={11} className="text-[#52525b]" />
                <span>{formatMessageTime(message.created_at)}</span>
              </div>
            )}
          </div>
        )}

        {lightboxImage && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-fade-in"
            onClick={() => setLightboxImage(null)}
          >
            <div
              className="relative max-w-5xl max-h-[92vh] bg-[#121215] border border-[#282830] rounded-2xl p-4 shadow-2xl flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-3 mb-2 border-b border-[#202028]">
                <span className="text-xs font-semibold text-zinc-300 font-mono">Chart Preview</span>
                <div className="flex items-center gap-2">
                  <a
                    href={lightboxImage}
                    download="chart.png"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-colors"
                  >
                    <Download size={13} />
                    Download
                  </a>
                  <button
                    onClick={() => setLightboxImage(null)}
                    className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
              <div className="overflow-auto flex items-center justify-center p-2">
                <img src={lightboxImage} alt="Chart full view" className="max-h-[78vh] w-auto object-contain rounded-lg" />
              </div>
            </div>
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
      prev.message.created_at === next.message.created_at &&
      prev.onShare === next.onShare
    )
  }
)
