import { useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  FileText,
  Globe2,
  Languages,
  Loader2,
  MessageSquare,
  Mic,
  MicOff,
  Minus,
  Monitor,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Square,
  X
} from 'lucide-react'
import type { TranscriptionEvent, SidecarState, AudioDevice, AudioSession } from '../../../../preload/index.d'


interface TranscriptLine {
  id: number
  speaker: 'YOU' | 'OTHERS'
  text: string
  isFinal: boolean
}

type ModelPhase = 'downloading' | 'ready' | 'failed' | null
type LanguageValue = 'auto' | 'pt-BR' | 'en-US'

const LANGUAGE_OPTIONS: Array<{
  value: LanguageValue
  label: string
  detail: string
  flag: string
}> = [
  { value: 'auto', label: 'Auto', detail: 'PT + EN', flag: '🌐' },
  { value: 'pt-BR', label: 'Português', detail: 'Brasil', flag: '🇧🇷' },
  { value: 'en-US', label: 'English', detail: 'US', flag: '🇺🇸' }
]

let lineId = 0
type Speaker = TranscriptLine['speaker']

export default function OverlayPage(): JSX.Element {
  const [protectionOn, setProtectionOn]       = useState(true)
  const [audioState, setAudioState]           = useState<SidecarState>('stopped')
  const [lines, setLines]                     = useState<TranscriptLine[]>([])
  const [error, setError]                     = useState<string | null>(null)
  const [modelPhase, setModelPhase]           = useState<ModelPhase>(null)
  const [showModelInfo, setShowModelInfo]     = useState(false)
  const [isSummarizing, setIsSummarizing]     = useState(false)
  const [showDevicePanel, setShowDevicePanel] = useState(false)
  const [devices, setDevices]                 = useState<AudioDevice[]>([])
  const [selectedDevice, setSelectedDevice]   = useState<string | null>(null)
  const [loadingDevices, setLoadingDevices]   = useState(false)
  const [showDevicePicker, setShowDevicePicker] = useState(false)
  const [youLevel, setYouLevel]               = useState(0)
  const [othersLevel, setOthersLevel]         = useState(0)
  const [isMuted, setIsMuted]                 = useState(false)
  const [assistantEnabled, setAssistantEnabled] = useState(false)
  const [recordingStartedAt, setRecordingStartedAt] = useState<number | null>(null)
  const [elapsedSeconds, setElapsedSeconds]   = useState(0)
  const [language, setLanguage]               = useState<LanguageValue>('auto')
  const [showLanguageMenu, setShowLanguageMenu] = useState(false)

  const scrollRef   = useRef<HTMLDivElement>(null)
  const activeLineIdsRef = useRef<Record<Speaker, number | null>>({ YOU: null, OTHERS: null })
  const isRecording = audioState === 'recording'
  const isMonitoring = audioState === 'monitoring'

  useEffect(() => {
    document.body.classList.add('overlay')
    return () => document.body.classList.remove('overlay')
  }, [])

  useEffect(() => {
    const unsubs = [
      window.api.onProtectionState(setProtectionOn),

      window.api.assistant.onState((enabled) => {
        setAssistantEnabled(enabled)
        if (!enabled) setIsSummarizing(false)
      }),

      window.api.audio.onStatus((state) => {
        window.api.audio.getSession().then(applySession)
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

      window.api.audio.onLevels((e) => {
        setYouLevel(e.you)
        setOthersLevel(e.others)
      }),

      // Track summarize state via the suggestion channel
      window.api.suggestion.onClear(() => setIsSummarizing(true)),
      window.api.suggestion.onDone(() => setIsSummarizing(false)),
      window.api.suggestion.onError(() => setIsSummarizing(false)),
    ]
    window.api.audio.getSession().then(applySession)
    window.api.assistant.getEnabled().then(setAssistantEnabled)
    window.api.settings.getAll().then((settings) => {
      setLanguage(normalizeLanguage(settings.language))
    })
    return () => unsubs.forEach((u) => u())
  }, [])

  useEffect(() => {
    if (isRecording) setShowLanguageMenu(false)
  }, [isRecording])

  useEffect(() => {
    if (!recordingStartedAt) {
      setElapsedSeconds(0)
      return
    }

    const tick = (): void => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - recordingStartedAt) / 1000)))
    }
    tick()
    const timer = window.setInterval(tick, 1000)
    return () => window.clearInterval(timer)
  }, [recordingStartedAt])

  useEffect(() => {
    const scrollEl = scrollRef.current
    if (!scrollEl) return

    const distanceFromBottom = scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight
    if (distanceFromBottom < 48) scrollEl.scrollTop = scrollEl.scrollHeight
  }, [lines])

  async function toggleRecording(): Promise<void> {
    if (isRecording) {
      if (!window.confirm('Deseja finalizar a transcrição? O cronômetro será zerado.')) return
      await window.api.audio.stop()
    } else {
      setError(null)
      await window.api.assistant.setEnabled(true)
      await window.api.audio.start()
    }
  }

  function startSummary(): void {
    if (!assistantEnabled) return
    const finalLines = lines.filter((l) => l.isFinal)
    if (finalLines.length === 0) return
    window.api.window.openAssistant()
    window.api.analysis.start(
      finalLines.map((l) => ({ speaker: l.speaker, text: l.text })),
      'summarize'
    )
  }

  async function toggleDevicePanel(): Promise<void> {
    if (showDevicePanel) {
      setShowDevicePanel(false)
      setShowDevicePicker(false)
      return
    }
    setShowDevicePanel(true)
    setLoadingDevices(true)
    const result = await window.api.audio.listDevices()
    setDevices(result.devices)
    setSelectedDevice(result.selectedUID)
    setLoadingDevices(false)
  }

  async function selectDevice(uid: string): Promise<void> {
    setSelectedDevice(uid)
    setShowDevicePicker(false)
    await window.api.audio.setDevice(uid)
  }

  async function selectLanguage(value: LanguageValue): Promise<void> {
    setLanguage(value)
    setShowLanguageMenu(false)
    await window.api.settings.set('language', value)
  }

  async function toggleMute(): Promise<void> {
    const next = !isMuted
    setIsMuted(next)
    await window.api.audio.muteMic(next)
  }

  async function toggleAssistant(): Promise<void> {
    const next = !assistantEnabled
    setAssistantEnabled(next)
    if (!next) setIsSummarizing(false)
    await window.api.assistant.setEnabled(next)
  }

  async function showAssistant(): Promise<void> {
    setAssistantEnabled(true)
    await window.api.assistant.setEnabled(true)
  }

  function applySession(session: AudioSession): void {
    setAudioState(session.state)
    setRecordingStartedAt(session.state === 'recording' ? session.startedAt ?? Date.now() : null)
  }

  const finalLineCount = lines.filter((l) => l.isFinal).length
  const selectedLanguage = LANGUAGE_OPTIONS.find((option) => option.value === language) ?? LANGUAGE_OPTIONS[0]

  return (
    <div className="drag-region h-screen flex flex-col rounded-[14px] border border-white/[0.09] bg-[rgba(2,3,6,0.975)] text-white select-none overflow-hidden shadow-[0_18px_48px_rgba(0,0,0,0.46),inset_0_1px_0_rgba(255,255,255,0.045)]">

      {/* ── Top bar ── */}
      <div className="drag-region flex h-11 shrink-0 items-center justify-between border-b border-white/[0.075] px-3">
        <div className="flex items-center rounded-full border border-white/[0.085] bg-white/[0.035] p-0.5 text-[12px] text-white/70">
          <button className="no-drag flex h-7 items-center gap-1.5 rounded-full bg-white/[0.12] px-3 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
            <Mic size={12} />
            <span>Transcrição</span>
          </button>
          <button
            onClick={showAssistant}
            className="no-drag flex h-7 items-center gap-1.5 rounded-full px-3 hover:bg-white/[0.075] hover:text-white"
          >
            <MessageSquare size={12} />
            <span>Sessão</span>
          </button>
          <button
            onClick={startSummary}
            disabled={finalLineCount === 0 || isSummarizing || !assistantEnabled}
            className="no-drag flex h-7 items-center gap-1.5 rounded-full px-3 hover:bg-white/[0.075] hover:text-white disabled:cursor-default disabled:opacity-45"
          >
            <FileText size={12} />
            <span>Resumo</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5 text-white/60">
          <button
            onClick={toggleAssistant}
            title={assistantEnabled ? 'Ocultar IA e pausar tokens' : 'Exibir IA'}
            className={`no-drag flex h-7 items-center gap-1.5 rounded-md px-2 text-[11px] transition hover:bg-white/[0.08] hover:text-white ${assistantEnabled ? 'text-amber-200/90' : 'text-white/35'}`}
          >
            <Sparkles size={12} />
            <span>IA</span>
            <span className={`relative h-3.5 w-6 rounded-full transition ${assistantEnabled ? 'bg-emerald-400/45' : 'bg-white/[0.12]'}`}>
              <span className={`absolute top-0.5 h-2.5 w-2.5 rounded-full bg-white transition ${assistantEnabled ? 'left-3' : 'left-0.5'}`} />
            </span>
          </button>
          <button
            onClick={() => window.api.window.openSettings()}
            title="Configurações"
            className="no-drag grid h-7 w-7 place-items-center rounded-md hover:bg-white/[0.08] hover:text-white"
          >
            <Settings size={13} />
          </button>
          <button
            onClick={() => window.api.window.minimizeCurrent()}
            title="Minimizar"
            className="no-drag grid h-7 w-7 place-items-center rounded-md hover:bg-white/[0.08] hover:text-white"
          >
            <Minus size={13} />
          </button>
          <span className="h-4 w-px bg-white/[0.12]" />
          <button
            onClick={toggleDevicePanel}
            title="Dispositivo de entrada"
            className={`no-drag grid h-7 w-7 place-items-center rounded-md hover:bg-white/[0.08] hover:text-white transition ${showDevicePanel ? 'bg-white/[0.1] text-white' : 'text-white/45'}`}
          >
            <SlidersHorizontal size={13} />
          </button>
        </div>
      </div>

      {/* ── Transcript ── */}
      <div ref={scrollRef} className="no-drag scroll-area min-h-0 flex-1 px-3 py-3 space-y-1.5">
        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-300">
            <AlertCircle size={13} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        {lines.length === 0 && !error && (
          <div className="h-full flex items-center justify-center py-8">
            <p className="text-xs text-white/35 text-center leading-relaxed">
              {isRecording
                ? 'Ouvindo… fale normalmente'
                : (isMonitoring ? 'Monitorando níveis de áudio' : 'Escolha o idioma e inicie pela barra inferior')}
            </p>
          </div>
        )}
        {lines.map((line) => (
          <div
            key={line.id}
            className={`flex ${line.speaker === 'YOU' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[82%] px-3 py-2 text-xs leading-relaxed rounded-[14px] ${
              line.speaker === 'YOU'
                ? `bg-[#1b4f9f] text-white rounded-br ${line.isFinal ? '' : 'opacity-70 italic'}`
                : `bg-[#2b2d32] text-white/90 rounded-bl ${line.isFinal ? '' : 'opacity-70 italic'}`
            }`}>
              {line.text}
            </div>
          </div>
        ))}
      </div>

      {/* ── Bottom bar ── */}
      <div className="no-drag shrink-0 border-t border-white/[0.075] px-3 py-2.5">

        {/* Model download banner */}
        {modelPhase === 'downloading' && (
          <div className="mb-2 flex flex-col gap-1.5">
            <div className="flex items-center gap-2 rounded-lg bg-blue-500/10 border border-blue-500/20 px-3 py-2 text-xs text-blue-200">
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
          <div className="mb-2 flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-xs text-emerald-200">
            <CheckCircle2 size={12} className="shrink-0" />
            <span>Transcrição simultânea ativada</span>
          </div>
        )}

        {modelPhase === 'failed' && (
          <>
            <div className="mb-2 flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs text-amber-200">
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

        {/* Device panel */}
        {showDevicePanel && (
          <div className="mb-2 rounded-xl border border-white/[0.09] bg-[rgba(8,10,16,0.97)] overflow-hidden">

            {/* ── MIC row ── */}
            <div className="px-3 pt-2.5 pb-2 border-b border-white/[0.06]">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Mic size={11} className="text-white/45" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-white/45">Você</span>
                  <span className={`h-1.5 w-1.5 rounded-full transition-colors ${!isMuted && youLevel > 0.03 ? 'bg-emerald-400' : 'bg-white/15'}`} />
                </div>
                <button
                  onClick={toggleMute}
                  title={isMuted ? 'Desmutar' : 'Mutar microfone'}
                  className={`grid h-6 w-6 place-items-center rounded-md transition ${isMuted ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'text-white/35 hover:bg-white/[0.08] hover:text-white/70'}`}
                >
                  {isMuted ? <MicOff size={11} /> : <Mic size={11} />}
                </button>
              </div>

              {/* Level bar */}
              <div className="h-1 w-full rounded-full bg-white/[0.07] overflow-hidden mb-2">
                <div
                  className="h-full rounded-full bg-blue-400 transition-all duration-75"
                  style={{ width: `${isMuted ? 0 : Math.min(youLevel * 100, 100)}%` }}
                />
              </div>

              {/* Device selector */}
              {loadingDevices ? (
                <div className="flex items-center gap-1.5 text-[10px] text-white/30">
                  <Loader2 size={10} className="animate-spin" />
                  <span>Buscando…</span>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => setShowDevicePicker((v) => !v)}
                    className="flex items-center gap-1 text-[10px] text-white/40 hover:text-white/70 transition max-w-full"
                  >
                    <span className="truncate">{devices.find((d) => d.uid === selectedDevice)?.name ?? 'Padrão do sistema'}</span>
                    {showDevicePicker ? <ChevronUp size={10} className="shrink-0" /> : <ChevronDown size={10} className="shrink-0" />}
                  </button>
                  {showDevicePicker && (
                    <div className="mt-1.5 rounded-lg border border-white/[0.07] overflow-hidden">
                      {devices.map((d) => (
                        <button
                          key={d.uid}
                          onClick={() => selectDevice(d.uid)}
                          className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-[10px] hover:bg-white/[0.06] transition ${selectedDevice === d.uid ? 'text-white' : 'text-white/45'}`}
                        >
                          <span className={`h-2 w-2 rounded-full border shrink-0 flex items-center justify-center ${selectedDevice === d.uid ? 'border-blue-400 bg-blue-500' : 'border-white/20'}`}>
                            {selectedDevice === d.uid && <span className="h-1 w-1 rounded-full bg-white" />}
                          </span>
                          <span className="truncate">{d.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* ── SYSTEM AUDIO row ── */}
            <div className="px-3 pt-2.5 pb-2.5">
              <div className="flex items-center gap-1.5 mb-2">
                <Monitor size={11} className="text-white/45" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-white/45">Sistema</span>
                <span className={`h-1.5 w-1.5 rounded-full transition-colors ${othersLevel > 0.03 ? 'bg-emerald-400' : 'bg-white/15'}`} />
              </div>

              {/* Level bar */}
              <div className="h-1 w-full rounded-full bg-white/[0.07] overflow-hidden mb-2">
                <div
                  className="h-full rounded-full bg-violet-400 transition-all duration-75"
                  style={{ width: `${Math.min(othersLevel * 100, 100)}%` }}
                />
              </div>

              <span className="text-[10px] text-white/25">ScreenCaptureKit · áudio do computador</span>
            </div>

          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2 rounded-full border border-white/[0.09] bg-black/50 p-1.5">
          {isRecording ? (
            <button
              onClick={toggleRecording}
              className="flex h-9 min-w-[144px] items-center justify-center gap-2 rounded-full border border-red-400/50 bg-red-500/[0.12] px-4 text-sm font-medium tabular-nums text-red-100 transition hover:bg-red-500/[0.18]"
            >
              <Square size={14} />
              Parar {formatElapsed(elapsedSeconds)}
            </button>
          ) : (
            <div className="relative">
              <button
                onClick={() => setShowLanguageMenu((value) => !value)}
                className="flex h-9 min-w-[178px] items-center justify-center gap-2 rounded-full border border-white/[0.1] bg-white/[0.055] px-3.5 text-xs font-medium text-white/85 transition hover:bg-white/[0.085] hover:text-white"
              >
                <Languages size={14} className="text-emerald-300/85" />
                <span className="text-sm leading-none">{selectedLanguage.flag}</span>
                <span>{selectedLanguage.label}</span>
                <span className="text-[10px] font-medium text-white/35">{selectedLanguage.detail}</span>
                <ChevronDown size={12} className={`text-white/40 transition ${showLanguageMenu ? 'rotate-180' : ''}`} />
              </button>

              {showLanguageMenu && (
                <div className="absolute bottom-full left-0 z-20 mb-2 w-[218px] overflow-hidden rounded-xl border border-white/[0.1] bg-[rgba(10,12,18,0.98)] p-1 shadow-[0_16px_36px_rgba(0,0,0,0.42)]">
                  {LANGUAGE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => selectLanguage(option.value)}
                      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition hover:bg-white/[0.07] ${
                        language === option.value ? 'text-white' : 'text-white/55'
                      }`}
                    >
                      <span className="grid h-6 w-6 place-items-center rounded-md bg-white/[0.06] text-sm">
                        {option.value === 'auto' ? <Globe2 size={14} className="text-emerald-300/85" /> : option.flag}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-medium">{option.label}</span>
                        <span className="block text-[10px] text-white/35">{option.detail}</span>
                      </span>
                      {language === option.value && <Check size={13} className="text-emerald-300" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {finalLineCount > 0 && (
            <>
              <div className="h-5 w-px bg-white/[0.1]" />
              <button
                onClick={startSummary}
                disabled={isSummarizing || !assistantEnabled}
                className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full bg-blue-600 px-4 text-sm font-medium text-white transition hover:bg-blue-500 disabled:opacity-50"
              >
                <ClipboardList size={14} />
                Resumir
              </button>
            </>
          )}
        </div>

        {!protectionOn && (
          <p className="mt-1.5 text-center text-[9px] text-red-300/60">
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

function formatElapsed(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function normalizeLanguage(value: string | null | undefined): LanguageValue {
  if (value === 'pt-BR' || value === 'en-US') return value
  return 'auto'
}
