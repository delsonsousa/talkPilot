import { useEffect, useRef, useState } from 'react'
import { AlertCircle, RefreshCcw, Sparkles } from 'lucide-react'

export default function SuggestionsPage(): JSX.Element {
  const [text, setText]           = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const scrollRef                 = useRef<HTMLDivElement>(null)

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
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [text])

  return (
    <div className="drag-region h-screen flex flex-col rounded-b-[18px] border border-white/10 bg-black/94 text-white select-none overflow-hidden shadow-[0_18px_60px_rgba(0,0,0,0.55)]">
      {/* Header */}
      <div className="shrink-0 flex items-center gap-2 px-4 pt-3 pb-1.5">
        {isStreaming ? (
          <RefreshCcw size={12} className="shrink-0 animate-spin text-white/55" />
        ) : (
          <Sparkles size={12} className="shrink-0 text-white/55" />
        )}
        <span className="text-[12px] text-white/62">
          {error ? 'IA indisponivel' : (isStreaming ? 'Generating insights...' : 'Monitorando conversa')}
        </span>
        <span className={`ml-auto inline-block h-1.5 w-1.5 rounded-full ${error ? 'bg-red-400/80' : 'bg-emerald-400/70'}`} />
      </div>

      {/* Content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 pb-3">
        {error ? (
          <div className="no-drag flex items-start gap-2 rounded-lg border border-red-400/15 bg-red-500/10 px-3 py-2 text-xs text-red-200">
            <AlertCircle size={12} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        ) : (
          <p className="text-xs text-white/78 leading-relaxed whitespace-pre-wrap">
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
