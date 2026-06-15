import { app, BrowserWindow } from 'electron'
import { join } from 'path'

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

function createWindow() {
  const win = new BrowserWindow({
    width: 900,
    height: 680,
    title: 'Rem Agent',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
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
    // Dev mode: load desktop/index.html directly
    // __dirname is dist/desktop/, go up to project root then into desktop/
    win.loadFile(join(__dirname, '..', '..', 'desktop', 'index.html'))
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