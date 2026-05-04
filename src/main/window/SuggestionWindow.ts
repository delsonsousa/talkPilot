import { BrowserWindow, screen } from 'electron'
import { join } from 'path'

export function createSuggestionWindow(): BrowserWindow {
  const { width } = screen.getPrimaryDisplay().workAreaSize

  const win = new BrowserWindow({
    width: 480,
    height: 110,
    x: Math.round((width - 480) / 2),
    y: 28,
    show: false,
    frame: false,
    transparent: true,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    movable: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  win.setContentProtection(true)
  win.setAlwaysOnTop(true, 'screen-saver')
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(`${process.env.ELECTRON_RENDERER_URL}?window=suggestions`)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'), {
      query: { window: 'suggestions' }
    })
  }

  return win
}
