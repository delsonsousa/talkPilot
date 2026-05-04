import { useEffect, useState } from 'react'
import { GripVertical, Home, Mic, Square } from 'lucide-react'
import type { SidecarState } from '../../../../preload/index.d'

export default function DockPage(): JSX.Element {
  const [audioState, setAudioState] = useState<SidecarState>('stopped')
  const isRecording = audioState === 'recording'

  useEffect(() => {
    document.body.classList.add('overlay')
    window.api.audio.getStatus().then(setAudioState)
    const unsub = window.api.audio.onStatus(setAudioState)
    return () => {
      document.body.classList.remove('overlay')
      unsub()
    }
  }, [])

  async function toggleListening(): Promise<void> {
    if (isRecording) {
      await window.api.audio.stop()
      return
    }

    await window.api.window.openTranscript()
    await window.api.window.openAssistant()
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

          <div className="h-6 w-px bg-white/[0.1]" />

          <button
            onClick={toggleListening}
            title={isRecording ? 'Parar' : 'Começar a ouvir'}
            className={`no-drag grid h-9 w-12 place-items-center rounded-[12px] transition ${
              isRecording
                ? 'border border-red-400/50 bg-red-500/[0.12] text-red-100 hover:bg-red-500/[0.18]'
                : 'border border-blue-300/40 bg-blue-500 text-white hover:bg-blue-400'
            }`}
          >
            {isRecording ? <Square size={16} /> : <Mic size={17} />}
          </button>
        </div>
      </div>
    </div>
  )
}
