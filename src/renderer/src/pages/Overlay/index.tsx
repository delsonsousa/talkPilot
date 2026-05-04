import { useEffect, useRef, useState } from 'react'
import { Settings, Mic, Square, AlertCircle, Loader2, CheckCircle2, X, ClipboardList } from 'lucide-react'
import type { TranscriptionEvent, SidecarState } from '../../../../preload/index.d'

interface TranscriptLine {
  id: number
  speaker: 'YOU' | 'OTHERS'
  text: string
  isFinal: boolean
}

type ModelPhase = 'downloading' | 'ready' | 'failed' | null

let lineId = 0
type Speaker = TranscriptLine['speaker']

export default function OverlayPage(): JSX.Element {
  const [protectionOn, setProtectionOn]   = useState(true)
  const [audioState, setAudioState]       = useState<SidecarState>('stopped')
  const [lines, setLines]                 = useState<TranscriptLine[]>([])
  const [error, setError]                 = useState<string | null>(null)
  const [modelPhase, setModelPhase]       = useState<ModelPhase>(null)
  const [showModelInfo, setShowModelInfo] = useState(false)
  const [isSummarizing, setIsSummarizing] = useState(false)

  const scrollRef   = useRef<HTMLDivElement>(null)
  const activeLineIdsRef = useRef<Record<Speaker, number | null>>({ YOU: null, OTHERS: null })
  const isRecording = audioState === 'recording'

  useEffect(() => {
    document.body.classList.add('overlay')
    return () => document.body.classList.remove('overlay')
  }, [])

  useEffect(() => {
    const unsubs = [
      window.api.onProtectionState(setProtectionOn),

      window.api.audio.onStatus((state) => {
        setAudioState(state as SidecarState)
        if (state === 'recording') setError(null)
        if (state === 'stopped') activeLineIdsRef.current = { YOU: null, OTHERS: null }
      }),

      window.api.audio.onTranscription((event: TranscriptionEvent) => {
        setError(null)
        setLines((prev) => {
          const text = event.text.trim()
          if (!text) return prev

          const activeLineId = activeLineIdsRef.current[event.speaker]
          const activeIndex = activeLineId === null
            ? -1
            : prev.findIndex((line) => line.id === activeLineId)
          const fallbackIndex = activeIndex >= 0
            ? activeIndex
            : findLastOpenLineIndex(prev, event.speaker)

          if (fallbackIndex >= 0) {
            const next = [...prev]
            next[fallbackIndex] = { ...next[fallbackIndex], text, isFinal: event.isFinal }
            if (event.isFinal) activeLineIdsRef.current[event.speaker] = null
            return next
          }

          if (event.isFinal && prev.some((line) => (
            line.isFinal && line.speaker === event.speaker && line.text === text
          ))) {
            return prev
          }

          const line: TranscriptLine = {
            id: lineId++,
            speaker: event.speaker,
            text,
            isFinal: event.isFinal
          }

          if (event.isFinal) {
            activeLineIdsRef.current[event.speaker] = null
          } else {
            activeLineIdsRef.current[event.speaker] = line.id
          }

          return [...prev, line].slice(-59)
        })
      }),

      window.api.audio.onError((e) => setError(e.message)),

      window.api.audio.onModelStatus((e) => {
        setModelPhase(e.phase as ModelPhase)
        setShowModelInfo(false)
        if (e.phase === 'ready') setTimeout(() => setModelPhase(null), 4000)
      }),

      // Track summarize state via the suggestion channel
      window.api.suggestion.onClear(() => setIsSummarizing(true)),
      window.api.suggestion.onDone(() => setIsSummarizing(false)),
      window.api.suggestion.onError(() => setIsSummarizing(false)),
    ]
    return () => unsubs.forEach((u) => u())
  }, [])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [lines])

  function toggleRecording(): void {
    if (isRecording) {
      window.api.audio.stop()
    } else {
      setError(null)
      window.api.audio.start()
    }
  }

  function startSummary(): void {
    const finalLines = lines.filter((l) => l.isFinal)
    if (finalLines.length === 0) return
    window.api.analysis.start(
      finalLines.map((l) => ({ speaker: l.speaker, text: l.text })),
      'summarize'
    )
  }

  const finalLineCount = lines.filter((l) => l.isFinal).length

  return (
    <div className="drag-region h-screen flex flex-col rounded-2xl border border-white/10 bg-[rgba(14,14,22,0.95)] text-white select-none overflow-hidden">

      {/* ── Top bar ── */}
      <div className="no-drag flex items-center justify-between px-3 pt-2.5 pb-2 shrink-0 border-b border-white/5">
        <span className="text-[10px] uppercase tracking-widest text-white/30 pl-1">TalkPilot</span>
        <button
          onClick={() => window.api.window.openSettings()}
          className="no-drag flex items-center gap-1.5 px-2.5 py-1 rounded-md text-white/40 hover:text-white/80 hover:bg-white/8 transition-colors text-xs"
        >
          <Settings size={12} />
          <span>Configurações</span>
        </button>
      </div>

      {/* ── Transcript ── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-300">
            <AlertCircle size={13} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        {lines.length === 0 && !error && (
          <div className="h-full flex items-center justify-center py-8">
            <p className="text-xs text-white/20 text-center leading-relaxed">
              {isRecording ? 'Ouvindo… fale normalmente' : 'Clique em Iniciar para começar a transcrição'}
            </p>
          </div>
        )}
        {lines.map((line) => (
          <div
            key={line.id}
            className={`flex ${line.speaker === 'YOU' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[82%] px-3 py-1.5 text-xs leading-relaxed rounded-2xl ${
              line.speaker === 'YOU'
                ? `bg-blue-500/25 text-blue-50 rounded-br-sm ${line.isFinal ? '' : 'opacity-50 italic'}`
                : `bg-white/10 text-white/80 rounded-bl-sm ${line.isFinal ? '' : 'opacity-50 italic'}`
            }`}>
              {line.text}
            </div>
          </div>
        ))}
      </div>

      {/* ── Bottom bar ── */}
      <div className="no-drag shrink-0 px-3 pb-3 pt-2 border-t border-white/5 flex flex-col gap-2">

        {/* Model download banner */}
        {modelPhase === 'downloading' && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 rounded-lg bg-blue-500/10 border border-blue-500/20 px-3 py-2 text-xs text-blue-300">
              <Loader2 size={12} className="shrink-0 animate-spin" />
              <span className="flex-1 leading-tight">Preparando transcrição simultânea…</span>
              <button
                onClick={() => setShowModelInfo((v) => !v)}
                className="shrink-0 w-4 h-4 rounded-full border border-blue-400/50 text-blue-400 hover:border-blue-300 flex items-center justify-center text-[9px] font-bold transition-colors"
              >i</button>
            </div>
            {showModelInfo && (
              <div className="relative rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 text-[10px] text-white/55 leading-relaxed">
                <button onClick={() => setShowModelInfo(false)} className="absolute top-1.5 right-1.5 text-white/30 hover:text-white/60"><X size={10} /></button>
                <p className="font-medium text-white/70 mb-1">Por que o download?</p>
                <p>O TalkPilot precisa do modelo de fala offline da Apple para transcrever <strong className="text-white/70">sua voz e o áudio do sistema ao mesmo tempo</strong>. Download único (~150 MB). Enquanto isso, transcreve um canal por vez.</p>
              </div>
            )}
          </div>
        )}

        {modelPhase === 'ready' && (
          <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-xs text-emerald-300">
            <CheckCircle2 size={12} className="shrink-0" />
            <span>Transcrição simultânea ativada</span>
          </div>
        )}

        {modelPhase === 'failed' && (
          <>
            <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs text-amber-300">
              <AlertCircle size={12} className="shrink-0" />
              <span className="flex-1 leading-tight">Modo compatível — um canal por vez</span>
              <button onClick={() => setShowModelInfo((v) => !v)} className="shrink-0 w-4 h-4 rounded-full border border-amber-400/50 text-amber-400 hover:border-amber-300 flex items-center justify-center text-[9px] font-bold transition-colors">i</button>
            </div>
            {showModelInfo && (
              <div className="relative rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 text-[10px] text-white/55 leading-relaxed">
                <button onClick={() => setShowModelInfo(false)} className="absolute top-1.5 right-1.5 text-white/30 hover:text-white/60"><X size={10} /></button>
                <p className="font-medium text-white/70 mb-1">Por que o modo compatível?</p>
                <p>O download do modelo falhou. O app tenta novamente na próxima gravação. Por enquanto, alterna automaticamente entre os canais conforme quem está falando.</p>
              </div>
            )}
          </>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            onClick={toggleRecording}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-medium text-sm transition-all ${
              isRecording
                ? 'bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/30'
                : 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30'
            }`}
          >
            {isRecording ? <><Square size={14} />Parar</> : <><Mic size={14} />Iniciar</>}
          </button>

          {finalLineCount > 0 && (
            <button
              onClick={startSummary}
              disabled={isSummarizing}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl font-medium text-sm transition-all bg-blue-500/20 border border-blue-500/40 text-blue-300 hover:bg-blue-500/30 disabled:opacity-50"
            >
              <ClipboardList size={14} />
              Resumir
            </button>
          )}
        </div>

        {!protectionOn && (
          <p className="text-[9px] text-center text-red-400/60">
            ⚠ visível no compartilhamento de tela
          </p>
        )}
      </div>
    </div>
  )
}

function findLastOpenLineIndex(lines: TranscriptLine[], speaker: Speaker): number {
  for (let index = lines.length - 1; index >= 0; index--) {
    if (lines[index].speaker === speaker && !lines[index].isFinal) return index
  }
  return -1
}
