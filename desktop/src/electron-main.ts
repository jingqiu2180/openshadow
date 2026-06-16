import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { join } from 'path'
import { config as configManager } from '../core/config.js'
import { testConnection } from '../core/providers/tester.js'
import { BUILTIN_PROVIDERS } from '../core/providers/builtin.js'

const isDev = !app.isPackaged
const VITE_DEV_URL = process.env.VITE_DEV_URL ?? 'http://localhost:5173'
const WIZ_DEV_HTML = join(__dirname, '..', 'wizard', 'index.html')

let mainWindow: BrowserWindow | null = null
let wizardWindow: BrowserWindow | null = null

/**
 * First-run wizard: launch a dedicated BrowserWindow that loads
 * `desktop/wizard/index.html`. The wizard collects language / user name /
 * AI provider / model selection / workspace paths, then writes back to
 * config.json with `wizard.completed = true`.
 *
 * Stage 1b: replaced the previous native-dialog version (which only asked
 * for workspace roots). The new wizard is web-based and supports 5 steps.
 */
async function runWizardWindow(): Promise<void> {
  if (configManager.isWizardCompleted()) return

  wizardWindow = new BrowserWindow({
    width: 760,
    height: 640,
    minWidth: 640,
    minHeight: 520,
    title: 'Rem 启动向导',
    resizable: false,
    minimizable: false,
    maximizable: false,
    webPreferences: {
      preload: join(__dirname, '..', 'wizard', 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
    },
    backgroundColor: '#faf8f5',
    show: false,
  })

  wizardWindow.once('ready-to-show', () => {
    wizardWindow?.show()
    console.log('[wizard] window shown')
  })

  await wizardWindow.loadFile(WIZ_DEV_HTML)
  console.log('[wizard] loaded HTML from', WIZ_DEV_HTML)

  // Block close until wizard.completed is set
  wizardWindow.on('close', (e) => {
    if (!configManager.isWizardCompleted()) {
      const choice = dialog.showMessageBoxSync(wizardWindow!, {
        type: 'question',
        buttons: ['继续设置', '退出'],
        defaultId: 0,
        cancelId: 1,
        title: 'Rem 还没配置完',
        message: 'Rem 还没配置完,现在退出将无法使用。确定要退出吗?',
      })
      if (choice === 1) {
        app.quit()
      } else {
        e.preventDefault()
      }
    } else {
      wizardWindow = null
    }
  })
}

// ─── IPC handlers (wizard only) ──────────────────────────────────────
function registerIpcHandlers() {
  ipcMain.handle('wizard:get-config', () => {
    return {
      providers: configManager.getProviders(),
      user: { name: configManager.getUserName() },
      ui: { language: configManager.getLanguage() },
      theme: configManager.getTheme(),
      security: { workspaceRoots: configManager.getSecurity().workspaceRoots },
    }
  })

  ipcMain.handle('wizard:save-config', (_e, cfg: any) => {
    try {
      // Merge wizard payload into current config (preserves existing fields)
      const cur = configManager as any
      if (cfg.wizard) cur.config.wizard = cfg.wizard
      if (cfg.ui) cur.config.ui = cfg.ui
      if (cfg.user) cur.config.user = cfg.user
      if (cfg.memory) cur.config.memory = cfg.memory
      if (cfg.providers) cur.config.providers = cfg.providers
      if (cfg.models) cur.config.models = cfg.models
      if (cfg.theme) cur.config.theme = cfg.theme
      if (cfg.security?.workspaceRoots) {
        cur.config.security.workspaceRoots = cfg.security.workspaceRoots
      }
      configManager.save()
      return { ok: true }
    } catch (e: any) {
      return { ok: false, error: e.message }
    }
  })

  ipcMain.handle('wizard:test-connection', async (_e, providerInput: any) => {
    // Fill baseUrl from builtin spec if not supplied
    const spec = BUILTIN_PROVIDERS[providerInput.id]
    if (!spec) return { ok: false, error: `Unknown provider: ${providerInput.id}` }
    const fullProvider = {
      id: providerInput.id,
      type: spec.type,
      apiKey: providerInput.apiKey,
      baseUrl: spec.baseUrl,
      models: spec.models,
    }
    const result = await testConnection(fullProvider)
    return { ok: result.ok, latencyMs: result.latencyMs, error: result.error, modelUsed: result.modelUsed }
  })

  ipcMain.handle('wizard:pick-folder', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: '选择 Rem 的工作区目录',
      message: '请选择 Rem 可以读写的目录(可多选)。这些目录拥有完整权限(读/写/删)。',
      properties: ['openDirectory', 'multiSelections', 'createDirectory'],
    })
    return canceled ? [] : filePaths
  })
}

// ─── Main window ─────────────────────────────────────────────────────
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 900,
    minHeight: 600,
    title: 'Rem Agent',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
    },
    frame: true,
    backgroundColor: '#faf8f5',
    show: false,
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
    console.log('Main window shown')
  })

  if (isDev) {
    console.log('Loading Vite dev server:', VITE_DEV_URL)
    mainWindow.loadURL(VITE_DEV_URL)
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    const exePath = app.getAppPath()
    mainWindow.loadFile(join(exePath, 'desktop', 'dist-renderer', 'index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
    if (process.platform !== 'darwin') app.quit()
  })

  console.log('Main window created (dev=%s)', isDev)
}

// ─── App lifecycle ───────────────────────────────────────────────────
app.whenReady().then(async () => {
  registerIpcHandlers()

  await runWizardWindow()

  // After wizard finishes (or was already done), open main window
  if (configManager.isWizardCompleted()) {
    createMainWindow()
  } else {
    // Wizard not completed yet — wait for it to signal completion
    console.log('[main] waiting for wizard to complete…')
    ipcMain.on('wizard:done-signal', () => {
      console.log('[main] wizard done, opening main window')
      wizardWindow?.close()
      wizardWindow = null
      createMainWindow()
    })
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    if (configManager.isWizardCompleted()) {
      createMainWindow()
    } else {
      runWizardWindow()
    }
  }
})

console.log('Electron starting...')
