export {}

export type LLMProvider = 'gemini' | 'openai' | 'anthropic' | 'ollama'
export type SidecarState = 'stopped' | 'ready' | 'recording' | 'error'

export interface AppSettings {
  llmProvider: LLMProvider
  ollamaBaseUrl: string
  ollamaModel: string
  inputDevice: string
  language: string
  activeProfile: string
  hotkeys: {
    toggleProtection: string
    toggleVisibility: string
    quit: string
    openSettings: string
  }
  contentProtectionDefault: boolean
  onboardingCompleted: boolean
  settingsVersion: number
}

export interface TranscriptionEvent {
  speaker: 'YOU' | 'OTHERS'
  text: string
  timestamp: number
  isFinal: boolean
}

export interface AudioLevelsEvent {
  you: number
  others: number
}

declare global {
  interface Window {
    api: {
      onProtectionState: (callback: (on: boolean) => void) => () => void

      settings: {
        getAll: () => Promise<AppSettings>
        set: (key: keyof AppSettings, value: unknown) => Promise<void>
        reset: () => Promise<void>
      }

      secrets: {
        hasKey: (provider: LLMProvider) => Promise<boolean>
        saveKey: (provider: LLMProvider, key: string) => Promise<void>
        deleteKey: (provider: LLMProvider) => Promise<void>
      }

      window: {
        openSettings: () => Promise<void>
        closeSettings: () => Promise<void>
        openTranscript: () => Promise<void>
        openAssistant: () => Promise<void>
      }

      audio: {
        start: () => Promise<void>
        stop: () => Promise<void>
        getStatus: () => Promise<SidecarState>
        onTranscription: (cb: (e: TranscriptionEvent) => void) => () => void
        onLevels: (cb: (e: AudioLevelsEvent) => void) => () => void
        onStatus: (cb: (state: SidecarState) => void) => () => void
        onError: (cb: (e: { code: string; message: string }) => void) => () => void
        onModelStatus: (cb: (e: { phase: 'downloading' | 'ready' | 'failed'; reason?: string }) => void) => () => void
      }

      analysis: {
        start: (lines: Array<{ speaker: string; text: string }>, mode?: 'suggest' | 'summarize') => Promise<void>
        stop:  () => Promise<void>
        onChunk: (cb: (text: string) => void) => () => void
        onDone:  (cb: () => void) => () => void
        onError: (cb: (msg: string) => void) => () => void
      }

      suggestion: {
        onChunk: (cb: (text: string) => void) => () => void
        onDone:  (cb: () => void) => () => void
        onError: (cb: (msg: string) => void) => () => void
        onClear: (cb: () => void) => () => void
      }
    }
  }
}
