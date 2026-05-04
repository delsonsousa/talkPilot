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
        <div className="flex h-[58px] items-center gap-3 rounded-[18px] border border-white/[0.08] bg-[#171923]/88 px-3 shadow-[0_10px_24px_rgba(0,0,0,0.28)] backdrop-blur-xl">
          <div className="drag-region grid h-10 w-7 place-items-center rounded-lg text-white/35 hover:text-white/70">
            <GripVertical size={16} />
          </div>

          <button className="no-drag grid h-10 w-10 place-items-center rounded-full border border-white/12 bg-white/10 text-white shadow-inner shadow-white/5 hover:bg-white/15">
            <Home size={17} />
          </button>

          <div className="h-8 w-px bg-white/10" />

          <button
            onClick={toggleListening}
            title={isRecording ? 'Parar' : 'Começar a ouvir'}
            className={`no-drag grid h-11 w-12 place-items-center rounded-xl shadow-[0_6px_16px_rgba(0,0,0,0.26)] transition ${
              isRecording
                ? 'border border-red-400/50 bg-red-500/18 text-red-200 hover:bg-red-500/25'
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
