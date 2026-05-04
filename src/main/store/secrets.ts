import { safeStorage, app } from 'electron'
import Store from 'electron-store'
import type { LLMProvider } from './settings'

// Encrypted API keys stored on disk via safeStorage (OS-backed encryption)
// getApiKey intentionally not exported — keys never leave the main process
const secretStore = new Store<Record<string, string>>({ name: 'secrets' })

function storageKey(provider: LLMProvider): string {
  return `apiKey.${provider}`
}

export async function saveApiKey(provider: LLMProvider, key: string): Promise<void> {
  await app.whenReady()
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('[secrets] safeStorage not available on this platform')
  }
  const encrypted = safeStorage.encryptString(key)
  secretStore.set(storageKey(provider), encrypted.toString('base64'))
}

export function hasApiKey(provider: LLMProvider): boolean {
  return secretStore.has(storageKey(provider))
}

export function deleteApiKey(provider: LLMProvider): void {
  secretStore.delete(storageKey(provider))
}

// Only used internally by the main process (LLM analysis service, Sprint 5)
export function getApiKey(provider: LLMProvider): string | null {
  const encoded = secretStore.get(storageKey(provider))
  if (!encoded || !safeStorage.isEncryptionAvailable()) return null
  try {
    return safeStorage.decryptString(Buffer.from(encoded, 'base64'))
  } catch {
    return null
  }
}
