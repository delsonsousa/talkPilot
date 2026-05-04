import { useEffect, useState } from 'react'
import { FileText, GripVertical, Home, Mic, Square } from 'lucide-react'
import type { AudioSession, SidecarState } from '../../../../preload/index.d'

export default function DockPage(): JSX.Element {
  const [audioState, setAudioState] = useState<SidecarState>('stopped')
  const [recordingStartedAt, setRecordingStartedAt] = useState<number | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const isRecording = audioState === 'recording'

  useEffect(() => {
    document.body.classList.add('overlay')
    window.api.audio.getSession().then(applySession)
    const unsub = window.api.audio.onStatus(() => {
      window.api.audio.getSession().then(applySession)
    })
    return () => {
      document.body.classList.remove('overlay')
      unsub()
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

  return (
    <div className="h-screen w-screen bg-transparent text-white select-none">
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex h-[48px] items-center gap-2 rounded-[16px] border border-white/[0.08] bg-[rgba(0,0,0,0.94)] px-2.5 shadow-[0_12px_30px_rgba(0,0,0,0.38),inset_0_1px_0_rgba(255,255,255,0.045)] backdrop-blur-xl">
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
  )
}

function formatElapsed(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}
