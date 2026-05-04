import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AlertCircle, ChevronDown, Sparkles } from 'lucide-react'

export default function SuggestionsPage(): JSX.Element {
  const [text, setText]           = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [fontSize, setFontSize]   = useState(12)
  const scrollRef                 = useRef<HTMLDivElement>(null)
  const headerRef                 = useRef<HTMLDivElement>(null)
  const contentRef                = useRef<HTMLElement | null>(null)
  const setContentRef             = (node: HTMLElement | null): void => {
    contentRef.current = node
  }

  useEffect(() => {
    document.body.classList.add('overlay')
    return () => document.body.classList.remove('overlay')
  }, [])

  useEffect(() => {
    const unsubs = [
      window.api.suggestion.onClear(() => {
        setText('')
        setError(null)
        setIsStreaming(true)
      }),
      window.api.suggestion.onChunk((chunk) => {
        setText((prev) => prev + chunk)
        setIsStreaming(true)
      }),
      window.api.suggestion.onDone(() => setIsStreaming(false)),
      window.api.suggestion.onError((msg) => {
        setError(msg)
        setIsStreaming(false)
      }),
    ]
    return () => unsubs.forEach((u) => u())
  }, [])

  useEffect(() => {
    const scrollEl = scrollRef.current
    if (!scrollEl) return

    const distanceFromBottom = scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight
    if (distanceFromBottom < 48) scrollEl.scrollTop = scrollEl.scrollHeight
  }, [text])

  useLayoutEffect(() => {
    const header = headerRef.current
    const content = contentRef.current
    if (!header || !content) return

    const frame = window.requestAnimationFrame(() => {
      const nextHeight = header.offsetHeight + content.scrollHeight + 14
      window.api.window.resizeSuggestion(nextHeight)
    })

    return () => window.cancelAnimationFrame(frame)
  }, [text, error, isStreaming, fontSize])

  function decreaseFontSize(): void {
    setFontSize((size) => Math.max(10, size - 1))
  }

  function increaseFontSize(): void {
    setFontSize((size) => Math.min(18, size + 1))
  }

  return (
    <div className="drag-region h-screen flex flex-col rounded-b-[18px] border border-white/[0.08] bg-[rgba(0,0,0,0.985)] text-white select-none overflow-hidden shadow-[0_16px_42px_rgba(0,0,0,0.46),inset_0_1px_0_rgba(255,255,255,0.04)]">
      {/* Header */}
      <div ref={headerRef} className="shrink-0 flex items-center gap-2 px-4 pt-3 pb-2">
        <TalkPilotLogo />
        <span className={`ml-auto inline-block h-1.5 w-1.5 rounded-full ${error ? 'bg-red-400/80' : 'bg-emerald-400/70'}`} />
        <button
          onClick={decreaseFontSize}
          title="Diminuir fonte"
          className="no-drag grid h-6 w-6 place-items-center rounded-md text-[11px] font-semibold text-white/45 hover:bg-white/[0.08] hover:text-white disabled:opacity-25"
          disabled={fontSize <= 10}
        >
          A
        </button>
        <button
          onClick={increaseFontSize}
          title="Aumentar fonte"
          className="no-drag grid h-6 w-6 place-items-center rounded-md text-[15px] font-semibold text-white/55 hover:bg-white/[0.08] hover:text-white disabled:opacity-25"
          disabled={fontSize >= 18}
        >
          A
        </button>
        <button
          onClick={() => window.api.assistant.setEnabled(false)}
          title="Recolher"
          className="no-drag grid h-6 w-6 place-items-center rounded-full border border-white/[0.1] text-white/45 hover:bg-white/[0.08] hover:text-white"
        >
          <ChevronDown size={13} />
        </button>
      </div>

      {/* Content */}
      <div ref={scrollRef} className="no-drag scroll-area min-h-0 flex-1 px-4 pb-3">
        {error ? (
          <div
            ref={setContentRef}
            className="no-drag flex items-start gap-2 rounded-lg border border-red-400/15 bg-red-500/10 px-3 py-2 text-red-200"
            style={{ fontSize }}
          >
            <AlertCircle size={12} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        ) : (
          <div
            ref={setContentRef}
            className="text-white/85 leading-relaxed whitespace-pre-wrap"
            style={{ fontSize }}
          >
            {text ? (
              <p>
                {text}
                {isStreaming && (
                  <span className="inline-block w-0.5 h-3 bg-white/70 ml-0.5 animate-pulse align-middle" />
                )}
              </p>
            ) : (
              <RealtimeIdle />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function RealtimeIdle(): JSX.Element {
  return (
    <div className="flex items-center gap-2 py-1 text-white/45">
      <span className="relative grid h-5 w-5 place-items-center">
        <span className="absolute h-4 w-4 rounded-full bg-amber-300/10 blur-sm animate-pulse" />
        <Sparkles size={14} className="relative text-amber-300/90 animate-pulse" />
      </span>
      <span className="relative overflow-hidden text-[12px] leading-none">
        <span>Realtime insights</span>
        <span className="pointer-events-none absolute inset-y-0 -left-8 w-8 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-[shine_2.4s_ease-in-out_infinite]" />
      </span>
      <style>
        {`@keyframes shine {
          0% { transform: translateX(0); opacity: 0; }
          30% { opacity: 1; }
          70% { opacity: 1; }
          100% { transform: translateX(130px); opacity: 0; }
        }`}
      </style>
    </div>
  )
}

function TalkPilotLogo(): JSX.Element {
  return (
    <div className="flex items-center gap-2">
      <svg width="16" height="20" viewBox="0 0 30 40" aria-hidden="true" className="shrink-0">
        {/* left bar — shortest */}
        <rect x="0"  y="15" width="8" height="25" rx="4" fill="#00F0A8" />
        {/* center bar — tallest */}
        <rect x="11" y="0"  width="8" height="40" rx="4" fill="#00F0A8" />
        {/* right bar — medium */}
        <rect x="22" y="8"  width="8" height="32" rx="4" fill="#00F0A8" />
      </svg>
      <span className="text-[13px] font-semibold leading-none text-white">TalkPilot</span>
    </div>
  )
}
