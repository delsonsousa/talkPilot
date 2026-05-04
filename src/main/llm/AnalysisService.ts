import { streamText } from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { getSettings } from '../store/settings'
import { getApiKey } from '../store/secrets'
import { getProfile } from '../profiles/PromptProfiles'

export interface AnalysisLine {
  speaker: 'YOU' | 'OTHERS'
  text: string
}

function buildModel() {
  const settings = getSettings()
  const provider = settings.llmProvider
  const key = provider !== 'ollama' ? getApiKey(provider) : null

  if (provider !== 'ollama' && !key) {
    return { model: null, error: `Chave de API para "${provider}" não configurada. Abra Configurações → Modelos.` }
  }

  try {
    switch (provider) {
      case 'gemini': {
        const google = createGoogleGenerativeAI({ apiKey: key! })
        return { model: google('gemini-2.0-flash'), error: null }
      }
      case 'openai': {
        const openai = createOpenAI({ apiKey: key! })
        return { model: openai('gpt-4o-mini'), error: null }
      }
      case 'anthropic': {
        const anthropic = createAnthropic({ apiKey: key! })
        return { model: anthropic('claude-haiku-4-5-20251001'), error: null }
      }
      case 'ollama': {
        const base = (settings.ollamaBaseUrl || 'http://localhost:11434').replace(/\/$/, '') + '/v1'
        const openai = createOpenAI({ baseURL: base, apiKey: 'ollama' })
        return { model: openai(settings.ollamaModel || 'llama3.2'), error: null }
      }
      default:
        return { model: null, error: 'Provedor LLM desconhecido.' }
    }
  } catch (err) {
    return { model: null, error: err instanceof Error ? err.message : String(err) }
  }
}

export type AnalysisMode = 'suggest' | 'summarize'

function extractErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message
  if (typeof err === 'string') return err

  if (err && typeof err === 'object') {
    const record = err as Record<string, unknown>
    const nested = record.error

    if (nested && typeof nested === 'object') {
      const nestedRecord = nested as Record<string, unknown>
      const code = nestedRecord.code
      const message = nestedRecord.message
      if (typeof code === 'string' && typeof message === 'string') return `${code}: ${message}`
      if (typeof message === 'string') return message
    }

    const code = record.code
    const message = record.message
    if (typeof code === 'string' && typeof message === 'string') return `${code}: ${message}`
    if (typeof message === 'string') return message
  }

  return 'Erro desconhecido ao chamar o modelo de IA.'
}

function friendlyModelError(err: unknown): string {
  const settings = getSettings()
  const message = extractErrorMessage(err)
  const lower = message.toLowerCase()

  if (settings.llmProvider === 'ollama') {
    if (
      lower.includes('connection refused') ||
      lower.includes('fetch failed') ||
      lower.includes('econnrefused') ||
      lower.includes('failed to fetch') ||
      lower.includes('connect')
    ) {
      return `Ollama nao esta rodando em ${settings.ollamaBaseUrl}. Abra o Ollama ou rode "ollama serve" e baixe um modelo com "ollama pull ${settings.ollamaModel || 'llama3.2'}".`
    }

    if (lower.includes('model') && (lower.includes('not found') || lower.includes('404'))) {
      return `Modelo Ollama "${settings.ollamaModel}" nao encontrado. Rode "ollama pull ${settings.ollamaModel || 'llama3.2'}" ou altere o modelo em Configuracoes > Modelos.`
    }
  }

  if (lower.includes('insufficient_quota') || lower.includes('exceeded your current quota')) {
    return 'A IA nao respondeu porque a conta da OpenAI esta sem quota/credito. Verifique billing/plano ou troque o provedor em Configuracoes > Modelos.'
  }

  if (lower.includes('rate limit') || lower.includes('429')) {
    return 'A IA esta limitando requisicoes no momento. Aguarde alguns segundos ou troque o provedor em Configuracoes > Modelos.'
  }

  if (lower.includes('api key') || lower.includes('unauthorized') || lower.includes('401')) {
    return 'A chave de API do provedor de IA parece invalida ou ausente. Abra Configuracoes > Modelos e revise a chave.'
  }

  return message
}

function buildSummaryPrompt(transcript: string): string {
  return `Você é um assistente de reuniões. Analise a transcrição abaixo e gere um resumo estruturado. Responda no mesmo idioma da conversa.

TRANSCRIÇÃO:
${transcript}

Gere o seguinte (use markdown com negrito para os títulos):

**Resumo**
- [3-5 bullet points dos principais pontos discutidos]

**Decisões**
- [o que foi decidido — escreva "Nenhuma decisão registrada" se não houver]

**Próximos passos**
- [ações concretas identificadas, com responsável se mencionado — escreva "Nenhum" se não houver]`
}

export async function analyzeTranscript(
  lines: AnalysisLine[],
  signal: AbortSignal,
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (msg: string) => void,
  mode: AnalysisMode = 'suggest'
): Promise<void> {
  const { model, error } = buildModel()
  if (!model) {
    onError(error ?? 'Erro ao inicializar o modelo LLM.')
    return
  }

  const transcript = lines
    .map((l) => `${l.speaker === 'YOU' ? 'EU' : 'OUTRO'}: ${l.text}`)
    .join('\n')

  let prompt: string
  if (mode === 'summarize') {
    prompt = buildSummaryPrompt(transcript)
  } else {
    const settings = getSettings()
    const profile = getProfile(settings.activeProfile)
    prompt = profile.buildPrompt(transcript)
  }

  const maxTokens = mode === 'summarize' ? 700 : 400

  try {
    const result = await streamText({ model, prompt, maxOutputTokens: maxTokens, abortSignal: signal })
    for await (const chunk of result.textStream) {
      if (signal.aborted) break
      onChunk(chunk)
    }
    if (!signal.aborted) onDone()
  } catch (err) {
    if (signal.aborted) return
    onError(friendlyModelError(err))
  }
}
