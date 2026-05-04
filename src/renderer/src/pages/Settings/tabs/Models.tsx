import { useEffect, useState } from 'react'
import { CheckCircle, KeyRound, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { useSettingsStore } from '@/stores/settingsStore'
import type { LLMProvider } from '../../../../../preload/index.d'

const PROVIDERS: { value: LLMProvider; label: string; needsKey: boolean }[] = [
  { value: 'gemini', label: 'Google Gemini (free tier)', needsKey: true },
  { value: 'openai', label: 'OpenAI GPT', needsKey: true },
  { value: 'anthropic', label: 'Anthropic Claude', needsKey: true },
  { value: 'ollama', label: 'Ollama (local, free)', needsKey: false }
]

export default function ModelsTab(): JSX.Element {
  const { settings, setSetting } = useSettingsStore()
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [hasKey, setHasKey] = useState(false)
  const [saving, setSaving] = useState(false)

  const provider = settings?.llmProvider ?? 'gemini'
  const currentProviderConfig = PROVIDERS.find((p) => p.value === provider)!

  useEffect(() => {
    window.api.secrets.hasKey(provider).then(setHasKey)
    setApiKeyInput('')
  }, [provider])

  async function handleSaveKey(): Promise<void> {
    if (!apiKeyInput.trim()) return
    setSaving(true)
    await window.api.secrets.saveKey(provider, apiKeyInput.trim())
    setHasKey(true)
    setApiKeyInput('')
    setSaving(false)
  }

  async function handleDeleteKey(): Promise<void> {
    await window.api.secrets.deleteKey(provider)
    setHasKey(false)
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold mb-1">LLM Provider</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Choose which AI model TalkPilot uses for analysis and suggestions.
        </p>

        <div className="space-y-2">
          <Label htmlFor="provider">Provider</Label>
          <Select
            id="provider"
            value={provider}
            onChange={(e) => setSetting('llmProvider', e.target.value as LLMProvider)}
            className="w-72"
          >
            {PROVIDERS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {currentProviderConfig.needsKey && (
        <div>
          <h3 className="text-sm font-semibold mb-1">API Key</h3>
          <p className="text-sm text-muted-foreground mb-3">
            Stored securely in macOS Keychain. Never saved to disk in plaintext.
          </p>

          {hasKey ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-sm text-emerald-400">
                <CheckCircle size={15} />
                <span>API key configured</span>
              </div>
              <Button variant="ghost" size="sm" onClick={handleDeleteKey}>
                <Trash2 size={13} className="mr-1.5" />
                Remove
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="relative w-80">
                <KeyRound
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  type="password"
                  placeholder="sk-..."
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveKey()}
                  className="pl-8"
                />
              </div>
              <Button onClick={handleSaveKey} disabled={!apiKeyInput.trim() || saving} size="sm">
                {saving ? 'Saving…' : 'Save'}
              </Button>
            </div>
          )}
        </div>
      )}

      {provider === 'ollama' && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Ollama Config</h3>
          <p className="max-w-xl text-sm text-muted-foreground">
            Roda localmente, sem API key e sem cobrança por token. O app espera o servidor do Ollama ativo.
          </p>
          <div className="space-y-2">
            <Label htmlFor="ollama-url">Base URL</Label>
            <Input
              id="ollama-url"
              value={settings?.ollamaBaseUrl ?? ''}
              onChange={(e) => setSetting('ollamaBaseUrl', e.target.value)}
              className="w-72"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ollama-model">Model</Label>
            <Input
              id="ollama-model"
              value={settings?.ollamaModel ?? ''}
              onChange={(e) => setSetting('ollamaModel', e.target.value)}
              className="w-72"
              placeholder="llama3.2"
            />
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-muted-foreground">
            <p className="mb-1 font-medium text-foreground/80">Setup rapido</p>
            <code className="block">ollama serve</code>
            <code className="block">ollama pull {settings?.ollamaModel || 'llama3.2'}</code>
          </div>
        </div>
      )}
    </div>
  )
}
