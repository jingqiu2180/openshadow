import { app, BrowserWindow } from 'electron'
import { join } from 'path'

const isDev = process.env.NODE_ENV === 'development'

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    title: '小Hanako',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    frame: true,
    backgroundColor: '#667eea',
  })

  if (isDev) {
    win.loadURL('http://localhost:5173')
  } else {
    win.loadFile(join(__dirname, '../dist/index.html'))
  }

  win.on('closed', () => {
    app.quit()
  })

  console.log('🪟 Window created')
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  app.quit()
})

console.log('🥕 Electron starting...')