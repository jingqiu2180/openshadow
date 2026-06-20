// @ts-nocheck
import { app, BrowserWindow, dialog } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync } from 'fs'

const isDev = !app.isPackaged
const VITE_DEV_URL = process.env.VITE_DEV_URL ?? 'http://localhost:5173'

/**
 * First-run wizard: if no workspace roots configured, prompt user to select.
 */
async function runFirstRunWizard(): Promise<void> {
  const configPath = join(process.cwd(), 'config.json')

  let cfg: any = {}
  if (existsSync(configPath)) {
    try {
      cfg = JSON.parse(readFileSync(configPath, 'utf-8'))
    } catch {}
  }

  const sec = cfg.security ?? {}
  const roots: string[] = sec.workspaceRoots ?? []

  const hasWorkspace = roots.some((p: string) => p !== process.cwd())

  if (hasWorkspace) return

  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: '选择 Rem 的工作区目录',
    message: '请选择 Rem 可以读写的目录（可多选）。这些目录拥有完整权限（读/写/删）。',
    properties: ['openDirectory', 'multiSelections', 'createDirectory'],
  })

  if (canceled || filePaths.length === 0) {
    return
  }

  if (!cfg.security) cfg.security = {}
  cfg.security.workspaceRoots = [...new Set([...(cfg.security.workspaceRoots ?? []), ...filePaths])]
  cfg.security.allowExternalReads = true
  cfg.security.sandbox = true

  writeFileSync(configPath, JSON.stringify(cfg, null, 2), 'utf-8')
  console.log('First-run wizard: saved workspace roots:', filePaths)
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 900,
    minHeight: 600,
    title: 'Rem Agent',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      preload: join(__dirname, 'preload.cjs'),
    },
    frame: true,
    backgroundColor: '#faf8f5',
    show: false,
  })

  win.once('ready-to-show', () => {
    win.show()
    console.log('Window shown')
  })

  if (isDev && existsSync(join(process.cwd(), "desktop", "dist-renderer", "index.html"))) {
    console.log("Loading dist-renderer")
    win.loadFile(join(process.cwd(), "desktop", "dist-renderer", "index.html"))
  } else if (isDev) {
    // Dev: load Vite dev server
    console.log('Loading Vite dev server:', VITE_DEV_URL)
    win.loadURL(VITE_DEV_URL)
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    // Packaged: load built renderer
    const exePath = app.getAppPath()
    win.loadFile(join(exePath, 'desktop', 'dist-renderer', 'index.html'))
  }

  win.on('closed', () => {
    app.quit()
  })

  console.log('Electron window created (dev=%s)', isDev)
}

app.whenReady().then(async () => {
  await runFirstRunWizard()
  createWindow()
})

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

console.log('Electron starting...')
