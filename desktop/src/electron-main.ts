import { app, BrowserWindow, desktopCapturer, dialog, ipcMain, nativeImage } from 'electron'
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

  // ─── Screenshot via desktopCapturer ─────────────────────────────────
  ipcMain.handle('screenshot:capture', async (_e, displayId?: number) => {
    try {
      const targetDisplay = displayId ?? 0
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 1920, height: 1080 },
        fetchWindowIcons: false,
      })

      // Pick the requested screen (index into sources array)
      const source = sources[targetDisplay] ?? sources[0]
      if (!source) {
        return { success: false as const, error: `No screen source found (requested index ${targetDisplay}, available ${sources.length})` }
      }

      const thumbnail = source.thumbnail
      // thumbnail is a NativeImage; getSize returns {width, height}
      const size = thumbnail.getSize()
      const base64 = thumbnail.toPNG().toString('base64')

      return {
        success: true as const,
        base64,
        path: '',  // no file written — in-memory only
        width: size.width,
        height: size.height,
        platform: process.platform,
      }
    } catch (e: any) {
      return { success: false as const, error: `desktopCapturer failed: ${e.message}` }
    }
  })

  // ─── Capture a specific BrowserWindow by ID ─────────────────────────
  ipcMain.handle('screenshot:capture-window', async (_e, windowId?: number) => {
    try {
      const win = windowId
        ? BrowserWindow.getAllWindows().find(w => w.id === windowId)
        : mainWindow
      if (!win || win.isDestroyed()) {
        return { success: false as const, error: 'Target window not found' }
      }
      const image: Electron.NativeImage = await win.webContents.capturePage()
      const size = image.getSize()
      const base64 = image.toPNG().toString('base64')
      return {
        success: true as const,
        base64,
        path: '',
        width: size.width,
        height: size.height,
        platform: process.platform,
      }
    } catch (e: any) {
      return { success: false as const, error: `capturePage failed: ${e.message}` }
    }
  })

  // ─── Browser webview IPC handlers ───────────────────────────────────
  // The flow: core/tools/browser.ts (Node) → IPC invoke → main process
  //   → sends 'browser:command' to renderer's BrowserPanel
  //   → BrowserPanel executes on <webview> and sends 'browser:response' back
  //   → main process resolves the IPC invoke promise

  const pendingBrowserResponses = new Map<string, {
    resolve: (result: any) => void
    reject: (err: Error) => void
    timer: ReturnType<typeof setTimeout>
  }>()

  // Listen for responses from BrowserPanel (renderer → main)
  ipcMain.on('browser:response', (_event, response: { id: string; success: boolean; data?: any; error?: string }) => {
    const pending = pendingBrowserResponses.get(response.id)
    if (!pending) return
    clearTimeout(pending.timer)
    pendingBrowserResponses.delete(response.id)
    if (response.success) {
      pending.resolve({ success: true, ...response.data })
    } else {
      pending.resolve({ success: false, error: response.error ?? 'Unknown browser error' })
    }
  })

  /**
   * Send a command to the renderer's BrowserPanel and wait for response.
   * Falls back to a timeout if the renderer doesn't respond.
   */
  function sendBrowserCommand(cmd: Omit<any, 'id'> & { type: string }, timeoutMs = 30000): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const timer = setTimeout(() => {
        pendingBrowserResponses.delete(id)
        resolve({ success: false, error: `Browser command timed out: ${cmd.type}` })
      }, timeoutMs)

      pendingBrowserResponses.set(id, { resolve, reject, timer })

      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('browser:command', { id, ...cmd })
      } else {
        clearTimeout(timer)
        pendingBrowserResponses.delete(id)
        resolve({ success: false, error: 'Main window not available' })
      }
    })
  }

  ipcMain.handle('browser:create', async (_e, url?: string) => {
    // Tell BrowserPanel to show and optionally navigate
    return sendBrowserCommand({ type: 'create', url: url ?? 'about:blank' })
  })

  ipcMain.handle('browser:navigate', async (_e, url: string) => {
    return sendBrowserCommand({ type: 'navigate', url })
  })

  ipcMain.handle('browser:screenshot', async () => {
    return sendBrowserCommand({ type: 'screenshot' })
  })

  ipcMain.handle('browser:click', async (_e, selector: string) => {
    return sendBrowserCommand({ type: 'click', selector })
  })

  ipcMain.handle('browser:type', async (_e, selector: string, text: string) => {
    return sendBrowserCommand({ type: 'type', selector, text })
  })

  ipcMain.handle('browser:press-key', async (_e, key: string) => {
    return sendBrowserCommand({ type: 'pressKey', key })
  })

  ipcMain.handle('browser:get-text', async (_e, selector: string) => {
    return sendBrowserCommand({ type: 'getText', selector })
  })

  ipcMain.handle('browser:get-html', async () => {
    return sendBrowserCommand({ type: 'getHtml' })
  })

  ipcMain.handle('browser:wait-for', async (_e, selector: string, timeout?: number) => {
    return sendBrowserCommand({ type: 'waitForSelector', selector, timeout: timeout ?? 10000 })
  })

  ipcMain.handle('browser:close', async () => {
    return sendBrowserCommand({ type: 'close' })
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
      preload: join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      webviewTag: true,
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
