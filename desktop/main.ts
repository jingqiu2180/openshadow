import { app, BrowserWindow } from 'electron'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

function createWindow() {
  const win = new BrowserWindow({
    width: 900,
    height: 680,
    title: '小Hanako',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    frame: true,
    backgroundColor: '#667eea',
    show: false,
  })

  win.once('ready-to-show', () => {
    win.show()
    console.log('🪟 Window shown')
  })

  if (isDev) {
    // Direct run: load the Vite dev server
    win.loadURL('http://localhost:3000')
    win.webContents.openDevTools()
  } else {
    // Packaged: load from dist/desktop/index.html
    const exePath = app.getAppPath()
    win.loadFile(join(exePath, 'dist', 'desktop', 'index.html'))
  }

  win.on('closed', () => {
    app.quit()
  })

  console.log('🥕 Electron window created (dev=%s)', isDev)
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

console.log('🥕 Electron starting...')