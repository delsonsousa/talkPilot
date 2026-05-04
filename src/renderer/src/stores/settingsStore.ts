import { create } from 'zustand'
import type { AppSettings, LLMProvider } from '../../../preload/index.d'

interface SettingsStore {
  settings: AppSettings | null
  init: () => Promise<void>
  setSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => Promise<void>
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: null,

  init: async () => {
    const settings = await window.api.settings.getAll()
    set({ settings })
  },

  setSetting: async (key, value) => {
    await window.api.settings.set(key, value)
    const current = get().settings
    if (current) {
      set({ settings: { ...current, [key]: value } })
    }
  }
}))
