import { contextBridge, ipcRenderer } from 'electron'

function on<T>(channel: string, callback: (data: T) => void): () => void {
  const handler = (_: Electron.IpcRendererEvent, data: T): void => callback(data)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

const api = {
  onProtectionState: (cb: (on: boolean) => void) => on<boolean>('protection:state', cb),

  settings: {
    getAll: () => ipcRenderer.invoke('settings:get-all'),
    set: (key: string, value: unknown) => ipcRenderer.invoke('settings:set', key, value),
    reset: () => ipcRenderer.invoke('settings:reset')
  },

  secrets: {
    hasKey: (provider: string) => ipcRenderer.invoke('secrets:has-key', provider),
    saveKey: (provider: string, key: string) => ipcRenderer.invoke('secrets:save-key', provider, key),
    deleteKey: (provider: string) => ipcRenderer.invoke('secrets:delete-key', provider)
  },

  window: {
    openSettings: () => ipcRenderer.invoke('window:open-settings'),
    closeSettings: () => ipcRenderer.invoke('window:close-settings'),
    openTranscript: () => ipcRenderer.invoke('window:open-transcript'),
    openAssistant: () => ipcRenderer.invoke('window:open-assistant'),
    minimizeCurrent: () => ipcRenderer.invoke('window:minimize-current'),
    resizeSuggestion: (height: number) => ipcRenderer.invoke('window:resize-suggestion', height)
  },

  audio: {
    start: () => ipcRenderer.invoke('audio:start'),
    stop: () => ipcRenderer.invoke('audio:stop'),
    getStatus: () => ipcRenderer.invoke('audio:status'),
    startMonitoring: () => ipcRenderer.invoke('audio:start-monitoring'),
    stopMonitoring: () => ipcRenderer.invoke('audio:stop-monitoring'),
    getSession: (): Promise<AudioSession> => ipcRenderer.invoke('audio:session'),
    listDevices: (): Promise<{ devices: AudioDevice[]; selectedUID: string | null }> =>
      ipcRenderer.invoke('audio:list-devices'),
    setDevice: (uid: string | null) => ipcRenderer.invoke('audio:set-device', uid),
    muteMic: (muted: boolean) => ipcRenderer.invoke('audio:mute-mic', muted),
    onTranscription: (cb: (e: TranscriptionEvent) => void) => on<TranscriptionEvent>('transcription:append', cb),
    onLevels: (cb: (e: AudioLevelsEvent) => void) => on<AudioLevelsEvent>('audio:levels', cb),
    onStatus: (cb: (state: string) => void) => on<string>('audio:status', cb),
    onError: (cb: (e: { code: string; message: string }) => void) => on('audio:error', cb),
    onModelStatus: (cb: (e: { phase: string; reason?: string }) => void) => on('audio:model-status', cb)
  },

  assistant: {
    getEnabled: (): Promise<boolean> => ipcRenderer.invoke('assistant:get-enabled'),
    setEnabled: (enabled: boolean) => ipcRenderer.invoke('assistant:set-enabled', enabled),
    onState: (cb: (enabled: boolean) => void) => on<boolean>('assistant:state', cb)
  },

  analysis: {
    start: (lines: Array<{ speaker: string; text: string }>, mode?: 'suggest' | 'summarize') =>
      ipcRenderer.invoke('analysis:start', lines, mode),
    stop: () => ipcRenderer.invoke('analysis:stop'),
    onChunk: (cb: (text: string) => void) => on<string>('analysis:chunk', cb),
    onDone:  (cb: () => void) => on<void>('analysis:done', cb),
    onError: (cb: (msg: string) => void) => on<string>('analysis:error', cb)
  },

  suggestion: {
    onChunk: (cb: (text: string) => void) => on<string>('suggestion:chunk', cb),
    onDone:  (cb: () => void) => on<void>('suggestion:done', cb),
    onError: (cb: (msg: string) => void) => on<string>('suggestion:error', cb),
    onClear: (cb: () => void) => on<void>('suggestion:clear', cb),
  }
}

contextBridge.exposeInMainWorld('api', api)
console.log('[preload] window.api exposed:', Object.keys(api))

// Type re-exports consumed by index.d.ts
interface AudioDevice {
  uid: string
  name: string
}

interface TranscriptionEvent {
  speaker: 'YOU' | 'OTHERS'
  text: string
  timestamp: number
  isFinal: boolean
}

interface AudioLevelsEvent {
  you: number
  others: number
}

interface AudioSession {
  state: 'stopped' | 'ready' | 'monitoring' | 'recording' | 'error'
  startedAt: number | null
}
