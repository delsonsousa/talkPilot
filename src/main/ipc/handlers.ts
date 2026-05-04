import { ipcMain, BrowserWindow, WebContents } from 'electron'
import { getSettings, setSetting, resetSettings, AppSettings } from '../store/settings'
import { hasApiKey, saveApiKey, deleteApiKey } from '../store/secrets'
import { sidecar } from '../audio/SidecarManager'
import { analyzeTranscript, type AnalysisLine, type AnalysisMode } from '../llm/AnalysisService'
import type { LLMProvider } from '../store/settings'

// ── Window references ──────────────────────────────────────────────────────────

let openSettingsFn: (() => void) | null = null
let openTranscriptFn: (() => void) | null = null
let openAssistantFn: (() => void) | null = null
let hideAssistantFn: (() => void) | null = null
let closeSessionWindowsFn: (() => void) | null = null
let resizeSuggestionWindowFn: ((height: number) => void) | null = null
let settingsWindowRef: (() => BrowserWindow | null) | null = null
let mainWindowContents: (() => WebContents | null) | null = null
let transcriptWindowContents: (() => WebContents | null) | null = null
let suggestionWindowContents: (() => WebContents | null) | null = null

export function setOpenSettings(fn: () => void): void { openSettingsFn = fn }
export function setOpenTranscript(fn: () => void): void { openTranscriptFn = fn }
export function setOpenAssistant(fn: () => void): void { openAssistantFn = fn }
export function setHideAssistant(fn: () => void): void { hideAssistantFn = fn }
export function setCloseSessionWindows(fn: () => void): void { closeSessionWindowsFn = fn }
export function setResizeSuggestionWindow(fn: (height: number) => void): void { resizeSuggestionWindowFn = fn }
export function setSettingsWindowRef(getter: () => BrowserWindow | null): void { settingsWindowRef = getter }
export function setMainWindowContents(getter: () => WebContents | null): void { mainWindowContents = getter }
export function setTranscriptWindowContents(getter: () => WebContents | null): void { transcriptWindowContents = getter }
export function setSuggestionWindowContents(getter: () => WebContents | null): void { suggestionWindowContents = getter }

function getMainContents(): WebContents | null { return mainWindowContents?.() ?? null }
function getTranscriptContents(): WebContents | null { return transcriptWindowContents?.() ?? null }
function getSuggestionContents(): WebContents | null { return suggestionWindowContents?.() ?? null }

function sendIfAlive(contents: WebContents | null, channel: string, ...args: unknown[]): void {
  if (!contents || contents.isDestroyed()) return
  contents.send(channel, ...args)
}

function sendAudioWindow(channel: string, ...args: unknown[]): void {
  sendIfAlive(getMainContents(), channel, ...args)
  sendIfAlive(getTranscriptContents(), channel, ...args)
}

// ── Analysis state ─────────────────────────────────────────────────────────────

let analysisController: AbortController | null = null
let assistantEnabled = false
let recordingStartedAt: number | null = null
let isFinishingSession = false

// ── Auto-trigger state ─────────────────────────────────────────────────────────

let autoBuffer: AnalysisLine[] = []
let autoDebounce: ReturnType<typeof setTimeout> | null = null
const AUTO_DEBOUNCE_MS = 1800
const AUTO_MIN_LINES   = 1
const AUTO_CONTEXT_LINES = 1

function looksLikeQuestion(text: string): boolean {
  const normalized = text.trim().toLowerCase()
  if (!normalized) return false
  if (/[?？]$/.test(normalized)) return true
  return /^(o que|qual|quais|quando|como|por que|porque|onde|quem|me fala|me explique|explica|pode me|voce pode|você pode|could you|can you|what|why|how|when|where|who)\b/.test(normalized)
}

function scheduleAutoAnalysis(immediate = false): void {
  if (!assistantEnabled) return
  if (autoDebounce) clearTimeout(autoDebounce)
  if (autoBuffer.length < AUTO_MIN_LINES) return
  if (immediate) {
    void runAutoAnalysis()
    return
  }
  autoDebounce = setTimeout(runAutoAnalysis, AUTO_DEBOUNCE_MS)
}

async function runAutoAnalysis(): Promise<void> {
  if (!assistantEnabled) return
  if (autoDebounce) {
    clearTimeout(autoDebounce)
    autoDebounce = null
  }

  openAssistantFn?.()
  const wc = getSuggestionContents()
  if (!wc || wc.isDestroyed()) return

  analysisController?.abort()
  analysisController = new AbortController()
  const signal = analysisController.signal

  wc.send('suggestion:clear')

  const linesForAnswer = autoBuffer.slice(-AUTO_CONTEXT_LINES)

  await analyzeTranscript(
    linesForAnswer,
    signal,
    (chunk) => { if (!wc.isDestroyed()) wc.send('suggestion:chunk', chunk) },
    ()      => { if (!wc.isDestroyed()) wc.send('suggestion:done') },
    (err)   => { if (!wc.isDestroyed()) wc.send('suggestion:error', err) },
    'suggest'
  )
}

export function setAssistantEnabled(enabled: boolean): void {
  assistantEnabled = enabled

  if (!enabled) {
    if (autoDebounce) {
      clearTimeout(autoDebounce)
      autoDebounce = null
    }
    analysisController?.abort()
    analysisController = null
    hideAssistantFn?.()
  } else {
    openAssistantFn?.()
  }

  sendAudioWindow('assistant:state', assistantEnabled)
}

export function finishSession(): void {
  isFinishingSession = true
  if (autoDebounce) {
    clearTimeout(autoDebounce)
    autoDebounce = null
  }
  autoBuffer = []
  analysisController?.abort()
  analysisController = null
  recordingStartedAt = null
  assistantEnabled = false
  sendAudioWindow('assistant:state', false)
  closeSessionWindowsFn?.()
  sidecar.stopRecording()
  sidecar.stopMonitoring()
}

// ── IPC Handlers ───────────────────────────────────────────────────────────────

export function registerIpcHandlers(): void {
  // ── Settings ──────────────────────────────────────────────
  ipcMain.handle('settings:get-all', () => getSettings())

  ipcMain.handle('settings:set', (_e, key: keyof AppSettings, value: AppSettings[typeof key]) => {
    setSetting(key, value)
  })

  ipcMain.handle('settings:reset', () => resetSettings())

  // ── Secrets ───────────────────────────────────────────────
  ipcMain.handle('secrets:has-key', (_e, provider: LLMProvider) => hasApiKey(provider))

  ipcMain.handle('secrets:save-key', async (_e, provider: LLMProvider, key: string) => {
    await saveApiKey(provider, key)
  })

  ipcMain.handle('secrets:delete-key', (_e, provider: LLMProvider) => deleteApiKey(provider))

  // ── Window ────────────────────────────────────────────────
  ipcMain.handle('window:open-settings', () => { openSettingsFn?.() })
  ipcMain.handle('window:open-transcript', () => { openTranscriptFn?.() })
  ipcMain.handle('window:open-assistant', () => { setAssistantEnabled(true) })
  ipcMain.handle('window:minimize-current', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win && !win.isDestroyed()) win.hide()
    sidecar.stopMonitoring()
  })
  ipcMain.handle('window:resize-suggestion', (_event, height: number) => {
    resizeSuggestionWindowFn?.(height)
  })

  ipcMain.handle('window:close-settings', () => {
    const win = settingsWindowRef?.()
    if (win && !win.isDestroyed()) win.close()
  })

  // ── Audio / Sidecar ───────────────────────────────────────
  ipcMain.handle('audio:start', () => {
    if (sidecar.getState() !== 'recording') recordingStartedAt = Date.now()
    sidecar.startRecording(getSettings().language || 'auto')
  })
  ipcMain.handle('audio:stop', () => { finishSession() })
  ipcMain.handle('audio:status', () => sidecar.getState())
  ipcMain.handle('audio:start-monitoring', () => { sidecar.startMonitoring() })
  ipcMain.handle('audio:stop-monitoring', () => { sidecar.stopMonitoring() })
  ipcMain.handle('audio:session', () => ({
    state: sidecar.getState(),
    startedAt: recordingStartedAt
  }))

  ipcMain.handle('assistant:get-enabled', () => assistantEnabled)
  ipcMain.handle('assistant:set-enabled', (_event, enabled: boolean) => {
    setAssistantEnabled(Boolean(enabled))
  })

  ipcMain.handle('audio:list-devices', () => {
    return new Promise<{ devices: unknown[]; selectedUID: string | null }>((resolve) => {
      const timeout = setTimeout(() => resolve({ devices: [], selectedUID: null }), 2000)
      sidecar.once('devices', (payload) => {
        clearTimeout(timeout)
        resolve(payload)
      })
      sidecar.listDevices()
    })
  })

  ipcMain.handle('audio:set-device', (_e, uid: string | null) => {
    sidecar.setDevice(uid)
  })

  let isMicMuted = false
  ipcMain.handle('audio:mute-mic', (_e, muted: boolean) => {
    isMicMuted = muted
  })

  sidecar.on('transcription', (event) => {
    if (isMicMuted && event.speaker === 'YOU') return
    sendIfAlive(getTranscriptContents(), 'transcription:append', event)

    if (assistantEnabled && event.isFinal) {
      autoBuffer.push({ speaker: event.speaker, text: event.text })
      if (autoBuffer.length > 6) autoBuffer = autoBuffer.slice(-6)
      scheduleAutoAnalysis(looksLikeQuestion(event.text))
    }
  })

  // sidecar transcription → renderer (with mute gate above)

  sidecar.on('levels', (event) => { sendIfAlive(getTranscriptContents(), 'audio:levels', event) })

  sidecar.on('status', (state) => {
    if (state === 'recording' && recordingStartedAt === null) recordingStartedAt = Date.now()
    if (state !== 'recording') recordingStartedAt = null
    sendAudioWindow('audio:status', state)
    if (state === 'stopped') {
      // Clear auto-trigger when recording stops
      if (autoDebounce) clearTimeout(autoDebounce)
      autoBuffer = []
      if (!isFinishingSession && getTranscriptContents()) sidecar.startMonitoring()
      isFinishingSession = false
    }
  })

  sidecar.on('error', (err) => { sendAudioWindow('audio:error', err) })

  sidecar.on('modelStatus', (event) => { sendAudioWindow('audio:model-status', event) })

  // ── LLM Analysis (manual, e.g. Resumir) ───────────────────
  // Results go to the suggestion window, not the overlay
  ipcMain.handle('analysis:start', async (_event, lines: AnalysisLine[], mode: AnalysisMode = 'suggest') => {
    if (!assistantEnabled) return
    if (autoDebounce) clearTimeout(autoDebounce) // cancel pending auto-trigger

    analysisController?.abort()
    analysisController = new AbortController()
    const signal = analysisController.signal

    const wc = getSuggestionContents()
    if (!wc || wc.isDestroyed()) return

    wc.send('suggestion:clear')

    await analyzeTranscript(
      lines,
      signal,
      (chunk) => { if (!wc.isDestroyed()) wc.send('suggestion:chunk', chunk) },
      ()      => { if (!wc.isDestroyed()) wc.send('suggestion:done') },
      (err)   => { if (!wc.isDestroyed()) wc.send('suggestion:error', err) },
      mode
    )
  })

  ipcMain.handle('analysis:stop', () => {
    analysisController?.abort()
    analysisController = null
  })

  console.log('[ipc] handlers registered')
}
