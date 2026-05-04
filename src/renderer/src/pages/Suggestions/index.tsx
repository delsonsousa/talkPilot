import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AlertCircle, ChevronDown, RefreshCcw, Sparkles } from 'lucide-react'

export default function SuggestionsPage(): JSX.Element {
  const [text, setText]           = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError]         = useState<string | null>(null)
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
  }, [text, error, isStreaming])

  return (
    <div className="drag-region h-screen flex flex-col rounded-b-[18px] border border-white/[0.08] bg-[rgba(0,0,0,0.985)] text-white select-none overflow-hidden shadow-[0_16px_42px_rgba(0,0,0,0.46),inset_0_1px_0_rgba(255,255,255,0.04)]">
      {/* Header */}
      <div ref={headerRef} className="shrink-0 flex items-center gap-2 px-4 pt-3 pb-2">
        {isStreaming ? (
          <RefreshCcw size={12} className="shrink-0 animate-spin text-amber-300/90" />
        ) : (
          <Sparkles size={12} className="shrink-0 text-amber-300/90" />
        )}
        <span className="text-[12px] text-white/65">
          {error ? 'IA indisponivel' : (isStreaming ? 'Analisando conversa' : 'Realtime insights')}
        </span>
        <span className={`ml-auto inline-block h-1.5 w-1.5 rounded-full ${error ? 'bg-red-400/80' : 'bg-emerald-400/70'}`} />
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
          <div ref={setContentRef} className="no-drag flex items-start gap-2 rounded-lg border border-red-400/15 bg-red-500/10 px-3 py-2 text-xs text-red-200">
            <AlertCircle size={12} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        ) : (
          <p ref={setContentRef} className="text-xs text-white/85 leading-relaxed whitespace-pre-wrap">
            {text || 'A IA fica ativa enquanto a sessão está rodando e destaca respostas, perguntas e próximos passos.'}
            {isStreaming && (
              <span className="inline-block w-0.5 h-3 bg-white/70 ml-0.5 animate-pulse align-middle" />
            )}
          </p>
        )}
      </div>
    </div>
  )
}
