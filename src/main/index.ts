import { app, BrowserWindow, globalShortcut, Menu, nativeImage, Tray, WebContents } from 'electron'
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
  setHideAssistant,
  setAssistantEnabled,
  setCloseSessionWindows,
  setSuggestionWindowContents,
  setTranscriptWindowContents,
  setResizeSuggestionWindow,
  setToggleProtection,
  setGetProtectionState,
  finishSession
} from './ipc/handlers'
import { getSettings } from './store/settings'
import { sidecar } from './audio/SidecarManager'
import trayIconPath from './assets/talkpilot-menubar.png?asset'
import trayIcon2xPath from './assets/talkpilot-menubar@2x.png?asset'
import appIconSvg from './assets/talkpilot-app-icon.svg?raw'
import { existsSync } from 'fs'
import { join } from 'path'

let mainWindow: BrowserWindow | null = null
let settingsWindow: BrowserWindow | null = null
let suggestionWindow: BrowserWindow | null = null
let transcriptWindow: BrowserWindow | null = null
let tray: Tray | null = null
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
    sidecar.startMonitoring()
    return
  }

  transcriptWindow = createTranscriptWindow()
  sidecar.startMonitoring()
  transcriptWindow.on('closed', () => {
    transcriptWindow = null
    sidecar.stopMonitoring()
  })
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

function hideAssistant(): void {
  if (suggestionWindow && !suggestionWindow.isDestroyed()) suggestionWindow.hide()
}

function closeSessionWindows(): void {
  if (suggestionWindow && !suggestionWindow.isDestroyed()) suggestionWindow.close()
  if (transcriptWindow && !transcriptWindow.isDestroyed()) transcriptWindow.close()
}

function resizeSuggestionWindow(height: number): void {
  if (!suggestionWindow || suggestionWindow.isDestroyed()) return
  const current = suggestionWindow.getBounds()
  const nextHeight = Math.round(Math.max(82, Math.min(height, 360)))
  suggestionWindow.setBounds({ ...current, height: nextHeight }, true)
}

function applyProtectionState(): void {
  mainWindow?.setContentProtection(protectionOn)
  transcriptWindow?.setContentProtection(protectionOn)
  suggestionWindow?.setContentProtection(protectionOn)
  getWindowContents(mainWindow)?.send('protection:state', protectionOn)
  getWindowContents(transcriptWindow)?.send('protection:state', protectionOn)
  getWindowContents(suggestionWindow)?.send('protection:state', protectionOn)
}

function toggleProtection(): boolean {
  protectionOn = !protectionOn
  applyProtectionState()
  console.log(`[stealth] protection ${protectionOn ? 'ON' : 'OFF'}`)
  return protectionOn
}

function startTranscription(): void {
  openTranscript()
  setAssistantEnabled(true)
  sidecar.startRecording()
  console.log('[audio] started recording')
}

function toggleTranscription(): void {
  if (sidecar.getState() === 'recording') {
    finishSession()
    console.log('[audio] stopped recording')
    return
  }

  startTranscription()
}

function toggleTopBar(): void {
  if (mainWindow?.isVisible()) {
    mainWindow.hide()
  } else {
    mainWindow?.show()
  }
  updateTrayMenu()
}

function createTrayIcon(): Electron.NativeImage {
  const devDir = join(app.getAppPath(), 'src/main/assets')
  const dev1x = join(devDir, 'talkpilot-menubar.png')
  const dev2x = join(devDir, 'talkpilot-menubar@2x.png')

  const path1x = existsSync(dev1x) ? dev1x : trayIconPath
  const path2x = existsSync(dev2x) ? dev2x : trayIcon2xPath

  const image = nativeImage.createFromPath(path1x)
  if (image.isEmpty()) return nativeImage.createEmpty()

  const buf2x = require('fs').readFileSync(path2x)
  image.addRepresentation({ scaleFactor: 2, buffer: buf2x })

  image.setTemplateImage(true)
  return image
}

function createAppIcon(): Electron.NativeImage {
  return nativeImage.createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(appIconSvg).toString('base64')}`)
}

function updateTrayMenu(): void {
  if (!tray) return
  const isRecording = sidecar.getState() === 'recording'
  const isTopBarVisible = mainWindow?.isVisible() ?? false
  const menu = Menu.buildFromTemplate([
    {
      label: isRecording ? 'Stop Transcription' : 'Start Transcription',
      click: toggleTranscription
    },
    {
      label: isTopBarVisible ? 'Hide Top Bar' : 'Show Top Bar',
      click: toggleTopBar
    },
    { type: 'separator' },
    {
      label: 'Settings',
      click: openSettings
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => app.quit()
    }
  ])
  tray.setContextMenu(menu)
  tray.setToolTip('TalkPilot')
}

function createMenuBarTray(): void {
  const icon = createTrayIcon()
  tray = new Tray(icon)
  tray.setTitle('')
  updateTrayMenu()
  tray.on('click', () => tray?.popUpContextMenu())
  console.log('[tray] menu bar item created')
}

app.whenReady().then(() => {
  const settings = getSettings()
  protectionOn = settings.contentProtectionDefault
  const appIcon = createAppIcon()
  if (!appIcon.isEmpty()) app.dock?.setIcon(appIcon)

  registerIpcHandlers()
  setSettingsWindowRef(getSettingsWindow)
  setOpenSettings(openSettings)
  setOpenTranscript(openTranscript)
  setOpenAssistant(openAssistant)
  setHideAssistant(hideAssistant)
  setCloseSessionWindows(closeSessionWindows)
  setResizeSuggestionWindow(resizeSuggestionWindow)
  setToggleProtection(toggleProtection)
  setGetProtectionState(() => protectionOn)
  setMainWindowContents(() => getWindowContents(mainWindow))
  setTranscriptWindowContents(() => getWindowContents(transcriptWindow))

  mainWindow = createStealthWindow()
  mainWindow.setContentProtection(protectionOn)
  mainWindow.on('show', updateTrayMenu)
  mainWindow.on('hide', updateTrayMenu)

  setSuggestionWindowContents(() => getWindowContents(suggestionWindow))

  // Start the sidecar process on launch (not recording yet — waits for audio:start)
  sidecar.start()
  createMenuBarTray()
  sidecar.on('status', updateTrayMenu)

  // ⌘⇧P — toggle content protection
  globalShortcut.register(settings.hotkeys.toggleProtection, () => {
    toggleProtection()
  })

  // ⌘⇧H — hide/show overlay
  globalShortcut.register(settings.hotkeys.toggleVisibility, () => {
    toggleTopBar()
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
    toggleTranscription()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('will-quit', () => {
  isProcessExiting = true
  globalShortcut.unregisterAll()
  sidecar.stop({ quiet: true, force: true })
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
