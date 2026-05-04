import { useEffect, useState } from 'react'
import { FileText, Ghost, GripVertical, Home, Mic, Square } from 'lucide-react'
import type { AudioSession, SidecarState } from '../../../../preload/index.d'

export default function DockPage(): JSX.Element {
  const [audioState, setAudioState] = useState<SidecarState>('stopped')
  const [recordingStartedAt, setRecordingStartedAt] = useState<number | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [protectionOn, setProtectionOn] = useState(true)
  const isRecording = audioState === 'recording'

  useEffect(() => {
    document.body.classList.add('overlay')
    window.api.audio.getSession().then(applySession)
    window.api.window.getProtectionState().then(setProtectionOn)
    const unsub = window.api.audio.onStatus(() => {
      window.api.audio.getSession().then(applySession)
    })
    const unsubProtection = window.api.onProtectionState(setProtectionOn)
    return () => {
      document.body.classList.remove('overlay')
      unsub()
      unsubProtection()
    }
  }, [])

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

  function applySession(session: AudioSession): void {
    setAudioState(session.state)
    setRecordingStartedAt(session.state === 'recording' ? session.startedAt ?? Date.now() : null)
  }

  async function toggleListening(): Promise<void> {
    if (isRecording) {
      if (!window.confirm('Deseja finalizar a transcrição? O cronômetro será zerado.')) return
      await window.api.audio.stop()
      return
    }

    await window.api.window.openTranscript()
    await window.api.assistant.setEnabled(true)
    await window.api.audio.start()
  }

  async function toggleStealthMode(): Promise<void> {
    setProtectionOn(await window.api.window.toggleProtection())
  }

  return (
    <div className="h-screen w-screen bg-transparent text-white select-none">
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative">
          <div className="pointer-events-none absolute inset-x-2 top-3 h-12 rounded-[20px] bg-black/25 blur-[12px]" />
          <div className="pointer-events-none absolute inset-x-5 top-7 h-9 rounded-full bg-black/16 blur-[16px]" />
          <div className="relative flex h-[48px] items-center gap-2 rounded-[16px] border border-white/[0.09] bg-[rgba(8,8,10,0.96)] px-2.5 shadow-[0_7px_14px_rgba(0,0,0,0.30),0_2px_4px_rgba(0,0,0,0.26),inset_0_1px_0_rgba(255,255,255,0.10),inset_0_-1px_0_rgba(255,255,255,0.035)]">
          <div className="drag-region grid h-9 w-7 place-items-center rounded-lg text-white/35 hover:text-white/70">
            <GripVertical size={16} />
          </div>

          <button className="no-drag grid h-9 w-9 place-items-center rounded-full bg-white/[0.12] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] hover:bg-white/[0.17]">
            <Home size={17} />
          </button>

          <button
            onClick={() => window.api.window.openTranscript()}
            title="Abrir transcrição"
            className="no-drag grid h-9 w-9 place-items-center rounded-full text-white/60 hover:bg-white/[0.1] hover:text-white"
          >
            <FileText size={16} />
          </button>

          <button
            onClick={toggleStealthMode}
            title={protectionOn ? 'Stealth mode ativo' : 'Stealth mode desligado'}
            className={`no-drag grid h-9 w-9 place-items-center rounded-full transition ${
              protectionOn
                ? 'bg-emerald-400/[0.14] text-emerald-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                : 'text-white/45 hover:bg-white/[0.1] hover:text-white'
            }`}
          >
            <Ghost size={16} />
          </button>

          <div className="h-6 w-px bg-white/[0.1]" />

          <button
            onClick={toggleListening}
            title={isRecording ? 'Parar' : 'Começar a ouvir'}
            className={`no-drag flex h-9 min-w-[78px] items-center justify-center gap-1.5 rounded-[12px] px-3 text-[12px] font-medium tabular-nums transition ${
              isRecording
                ? 'border border-red-400/50 bg-red-500/[0.12] text-red-100 hover:bg-red-500/[0.18]'
                : 'border border-blue-300/40 bg-blue-500 text-white hover:bg-blue-400'
            }`}
          >
            {isRecording ? <><Square size={14} />{formatElapsed(elapsedSeconds)}</> : <Mic size={17} />}
          </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function formatElapsed(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}
