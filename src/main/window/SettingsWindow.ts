import { BrowserWindow, shell } from 'electron'
import { join } from 'path'

export function createSettingsWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 800,
    height: 580,
    show: false,
    transparent: false,
    alwaysOnTop: false,
    skipTaskbar: false,
    resizable: true,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 14, y: 12 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  win.setContentProtection(false)

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  win.on('ready-to-show', () => {
    win.show()
  })

  const query = { window: 'settings' }

  if (process.env.ELECTRON_RENDERER_URL) {
    const url = new URL(process.env.ELECTRON_RENDERER_URL)
    url.searchParams.set('window', 'settings')
    win.loadURL(url.toString())
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'), { query })
  }

  return win
}
