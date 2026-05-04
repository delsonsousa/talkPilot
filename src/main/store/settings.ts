import Store from 'electron-store'

export type LLMProvider = 'gemini' | 'openai' | 'anthropic' | 'ollama'

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

const defaults: AppSettings = {
  llmProvider: 'ollama',
  ollamaBaseUrl: 'http://localhost:11434',
  ollamaModel: 'llama3.2',
  inputDevice: 'default',
  language: 'pt-BR',
  activeProfile: 'generic',
  hotkeys: {
    toggleProtection: 'CommandOrControl+Shift+P',
    toggleVisibility: 'CommandOrControl+Shift+H',
    quit: 'CommandOrControl+Shift+Q',
    openSettings: 'CommandOrControl+,'
  },
  contentProtectionDefault: true,
  onboardingCompleted: false,
  settingsVersion: 2
}

export const store = new Store<AppSettings>({ defaults })

export function getSettings(): AppSettings {
  migrateSettings()
  return store.store
}

export function setSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
  store.set(key, value)
}

export function resetSettings(): void {
  store.clear()
}

function migrateSettings(): void {
  const current = store.store
  if ((current.settingsVersion ?? 1) >= 2) return

  store.set('llmProvider', 'ollama')
  store.set('ollamaBaseUrl', current.ollamaBaseUrl || defaults.ollamaBaseUrl)
  store.set('ollamaModel', current.ollamaModel || defaults.ollamaModel)
  store.set('settingsVersion', 2)
}
