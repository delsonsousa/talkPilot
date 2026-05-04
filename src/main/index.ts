import { app, BrowserWindow, globalShortcut, WebContents } from 'electron'
import { createStealthWindow } from './window/StealthWindow'
import { createSettingsWindow } from './window/SettingsWindow'
import { createSuggestionWindow } from './window/SuggestionWindow'
import { createTranscriptWindow } from './window/TranscriptWindow'
import {
  registerIpcHandlers,
  setSettingsWindowRef,
  setMainWindowContents,
  setOpenSettings,
  setOpenTranscript,
  setOpenAssistant,
  setSuggestionWindowContents,
  setTranscriptWindowContents
} from './ipc/handlers'
import { getSettings } from './store/settings'
import { sidecar } from './audio/SidecarManager'

let mainWindow: BrowserWindow | null = null
let settingsWindow: BrowserWindow | null = null
let suggestionWindow: BrowserWindow | null = null
let transcriptWindow: BrowserWindow | null = null
let protectionOn = true
let isProcessExiting = false

function getSettingsWindow(): BrowserWindow | null {
  return settingsWindow
}

function getWindowContents(win: BrowserWindow | null): WebContents | null {
  if (!win || win.isDestroyed()) return null
  const contents = win.webContents
  return contents.isDestroyed() ? null : contents
}

function openSettings(): void {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus()
    return
  }
  settingsWindow = createSettingsWindow()
  settingsWindow.on('closed', () => { settingsWindow = null })
}

function openTranscript(): void {
  if (transcriptWindow && !transcriptWindow.isDestroyed()) {
    transcriptWindow.show()
    transcriptWindow.focus()
    return
  }

  transcriptWindow = createTranscriptWindow()
  transcriptWindow.on('closed', () => { transcriptWindow = null })
}

function openAssistant(): void {
  if (suggestionWindow && !suggestionWindow.isDestroyed()) {
    suggestionWindow.show()
    return
  }

  suggestionWindow = createSuggestionWindow()
  suggestionWindow.setContentProtection(protectionOn)
  setSuggestionWindowContents(() => getWindowContents(suggestionWindow))
  suggestionWindow.on('ready-to-show', () => suggestionWindow?.show())
  suggestionWindow.on('closed', () => { suggestionWindow = null })
}

app.whenReady().then(() => {
  const settings = getSettings()
  protectionOn = settings.contentProtectionDefault

  registerIpcHandlers()
  setSettingsWindowRef(getSettingsWindow)
  setOpenSettings(openSettings)
  setOpenTranscript(openTranscript)
  setOpenAssistant(openAssistant)
  setMainWindowContents(() => getWindowContents(mainWindow))
  setTranscriptWindowContents(() => getWindowContents(transcriptWindow))

  mainWindow = createStealthWindow()
  mainWindow.setContentProtection(protectionOn)

  setSuggestionWindowContents(() => getWindowContents(suggestionWindow))

  // Start the sidecar process on launch (not recording yet — waits for audio:start)
  sidecar.start()

  // ⌘⇧P — toggle content protection
  globalShortcut.register(settings.hotkeys.toggleProtection, () => {
    protectionOn = !protectionOn
    mainWindow?.setContentProtection(protectionOn)
    transcriptWindow?.setContentProtection(protectionOn)
    suggestionWindow?.setContentProtection(protectionOn)
    getWindowContents(mainWindow)?.send('protection:state', protectionOn)
    getWindowContents(transcriptWindow)?.send('protection:state', protectionOn)
    console.log(`[stealth] protection ${protectionOn ? 'ON' : 'OFF'}`)
  })

  // ⌘⇧H — hide/show overlay
  globalShortcut.register(settings.hotkeys.toggleVisibility, () => {
    if (mainWindow?.isVisible()) {
      mainWindow.hide()
    } else {
      mainWindow?.show()
    }
  })

  // ⌘⇧Q — quit
  globalShortcut.register(settings.hotkeys.quit, () => {
    app.quit()
  })

  // ⌘, — open settings
  globalShortcut.register(settings.hotkeys.openSettings, () => {
    openSettings()
  })

  // ⌘⇧R — toggle recording (start/stop transcription)
  globalShortcut.register('CommandOrControl+Shift+R', () => {
    const state = sidecar.getState()
    if (state === 'recording') {
      sidecar.stopRecording()
      console.log('[audio] stopped recording')
    } else {
      openTranscript()
      openAssistant()
      sidecar.startRecording()
      console.log('[audio] started recording')
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  sidecar.stop({ quiet: isProcessExiting, force: isProcessExiting })
})

function exitFromSignal(): void {
  if (isProcessExiting) return
  isProcessExiting = true
  globalShortcut.unregisterAll()
  sidecar.stop({ quiet: true, force: true })
  app.exit(0)
  setTimeout(() => process.exit(0), 50).unref()
}

process.once('SIGINT', exitFromSignal)
process.once('SIGTERM', exitFromSignal)
