import { app, BrowserWindow, desktopCapturer, dialog, ipcMain, Menu } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { homedir } from 'os'

const isDev = !app.isPackaged
const VITE_DEV_URL = process.env.VITE_DEV_URL ?? 'http://localhost:5173'
const WIZ_DEV_HTML = join(__dirname, 'wizard', 'index.html')

// ─── App icon (Stage 1j: Q 版雷姆) ─────────────────────────────
// PNG 是 dev 模式的 runtime icon（窗口左上角 + 任务栏运行时图标）
// 生产打包 (electron-builder) 需要 .ico 才能正确写入 EXE 资源
const APP_ICON_PATH = join(__dirname, 'assets', 'rem-avatar.png')

// Windows 任务栏需要 AppUserModelID 才能正确显示应用图标 + 独立分组
if (process.platform === 'win32') {
  app.setAppUserModelId('com.remu.app')
}

// ─── Self-contained config reader (no core/* dependency) ────────────
// desktop tsconfig is CommonJS scope, so we read config.json directly
// to avoid cross-project TS compilation.

const CONFIG_PATH = join(process.cwd(), 'config.json')

interface AppConfig {
  version: string
  agent?: any
  wizard?: { completed: boolean; completedAt?: string }
  ui?: { language?: string }
  user?: { name?: string }
  providers?: any[]
  models?: Record<string, string>
  theme?: 'warm-paper' | 'cool-night' | 'auto'
  security?: { workspaceRoots?: string[]; allowExternalReads?: boolean; sandbox?: boolean; writablePaths?: string[] }
  memory?: any
  channels?: any
  logging?: any
  mcpServers?: Record<string, any>
}

function readConfig(): AppConfig {
  if (!existsSync(CONFIG_PATH)) return { version: '0.1.0' }
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'))
  } catch {
    return { version: '0.1.0' }
  }
}

function writeConfig(cfg: AppConfig): void {
  mkdirSync(join(CONFIG_PATH, '..'), { recursive: true })
  writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf-8')
}

function isWizardCompleted(): boolean {
  return readConfig().wizard?.completed === true
}

// ─── Builtin provider metadata (mirror of core/providers/builtin.ts) ─
// Kept in sync with the main project. Updates must be made in both places.

const BUILTIN_PROVIDERS: Record<string, {
  type: 'openai' | 'gemini' | 'ollama' | 'custom'
  label: string
  baseUrl: string
  models: string[]
  requiresApiKey: boolean
  notes?: string
}> = {
  openai: {
    type: 'openai',
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o1-mini'],
    requiresApiKey: true,
  },
  anthropic: {
    type: 'openai',
    label: 'Anthropic (compatible)',
    baseUrl: 'https://api.anthropic.com/v1',
    models: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022'],
    requiresApiKey: true,
  },
  minimax: {
    type: 'openai',
    label: 'MiniMax',
    baseUrl: 'https://api.minimax.chat/v1',
    models: ['abab6.5s-chat', 'abab6.5g-chat', 'abab6.5t-chat'],
    requiresApiKey: true,
  },
  dashscope: {
    type: 'openai',
    label: '阿里云 DashScope (Qwen)',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: ['qwen-plus', 'qwen-turbo', 'qwen-max', 'qwen-vl-plus'],
    requiresApiKey: true,
  },
  deepseek: {
    type: 'openai',
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    models: ['deepseek-chat', 'deepseek-coder', 'deepseek-reasoner'],
    requiresApiKey: true,
  },
  gemini: {
    type: 'gemini',
    label: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    models: ['gemini-2.0-flash-exp', 'gemini-1.5-pro', 'gemini-1.5-flash'],
    requiresApiKey: true,
  },
  ollama: {
    type: 'ollama',
    label: 'Ollama (local)',
    baseUrl: 'http://localhost:11434/v1',
    models: ['llama3.1', 'qwen2.5', 'mistral', 'codellama'],
    requiresApiKey: false,
    notes: '本地运行,无需 API Key',
  },
}

/** Probe an OpenAI-compatible endpoint with minimal token usage. */
async function testOpenAICompatible(baseUrl: string, apiKey: string, model: string): Promise<{
  ok: boolean; latencyMs: number; modelUsed: string; error?: string
}> {
  const start = Date.now()
  try {
    const res = await fetch(`${baseUrl.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 1,
        stream: false,
      }),
    })
    const latencyMs = Date.now() - start
    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      return { ok: false, latencyMs, modelUsed: model, error: `${res.status} ${res.statusText}: ${errText.slice(0, 200)}` }
    }
    return { ok: true, latencyMs, modelUsed: model }
  } catch (e: any) {
    return { ok: false, latencyMs: Date.now() - start, modelUsed: model, error: e.message }
  }
}

let mainWindow: BrowserWindow | null = null
let wizardWindow: BrowserWindow | null = null

/**
 * First-run wizard: launch a dedicated BrowserWindow that loads
 * `desktop/wizard/index.html`. The wizard collects language / user name /
 * AI provider / model selection / workspace paths, then writes back to
 * config.json with `wizard.completed = true`.
 *
 * Stage 1b: replaced the previous native-dialog version. Stage 1e-1g: removed
 * core/* dependency in favor of direct config.json reads.
 */
async function runWizardWindow(): Promise<void> {
  if (isWizardCompleted()) return

  wizardWindow = new BrowserWindow({
    width: 760,
    height: 640,
    minWidth: 640,
    minHeight: 520,
    title: 'Rem 启动向导',
    icon: APP_ICON_PATH,
    resizable: false,
    minimizable: false,
    maximizable: false,
    webPreferences: {
      preload: join(__dirname, 'wizard', 'preload.js'),
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
    if (!isWizardCompleted()) {
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

// ─── IPC handlers ─────────────────────────────────────────────────────
function registerIpcHandlers() {
  ipcMain.handle('wizard:get-config', () => {
    const cfg = readConfig()
    return {
      providers: cfg.providers ?? [],
      user: { name: cfg.user?.name ?? '王帅' },
      ui: { language: cfg.ui?.language ?? 'zh-CN' },
      theme: cfg.theme ?? 'warm-paper',
      security: { workspaceRoots: cfg.security?.workspaceRoots ?? [] },
      builtins: BUILTIN_PROVIDERS,
    }
  })

  ipcMain.handle('wizard:save-config', (_e, payload: Partial<AppConfig>) => {
    try {
      const cfg = readConfig()
      // Merge payload into current config (preserves existing fields)
      const merged: AppConfig = { ...cfg, ...payload }
      if (payload.security?.workspaceRoots) {
        merged.security = { ...cfg.security, workspaceRoots: payload.security.workspaceRoots }
      }
      writeConfig(merged)
      return { ok: true }
    } catch (e: any) {
      return { ok: false, error: e.message }
    }
  })

  ipcMain.handle('wizard:test-connection', async (_e, providerInput: { id: string; apiKey: string; model?: string }) => {
    const spec = BUILTIN_PROVIDERS[providerInput.id]
    if (!spec) return { ok: false, error: `Unknown provider: ${providerInput.id}` }
    const model = providerInput.model ?? spec.models[0]
    const result = await testOpenAICompatible(spec.baseUrl, providerInput.apiKey, model)
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
      const source = sources[targetDisplay] ?? sources[0]
      if (!source) {
        return { success: false as const, error: `No screen source found (requested index ${targetDisplay}, available ${sources.length})` }
      }
      const thumbnail = source.thumbnail
      const size = thumbnail.getSize()
      const base64 = thumbnail.toPNG().toString('base64')
      return {
        success: true as const,
        base64,
        path: '',
        width: size.width,
        height: size.height,
        platform: process.platform,
      }
    } catch (e: any) {
      return { success: false as const, error: `desktopCapturer failed: ${e.message}` }
    }
  })

  ipcMain.handle('screenshot:capture-window', async (_e, windowId?: number) => {
    try {
      const win = windowId
        ? BrowserWindow.getAllWindows().find(w => w.id === windowId)
        : mainWindow
      if (!win || win.isDestroyed()) {
        return { success: false as const, error: 'Target window not found' }
      }
      const image = await win.webContents.capturePage()
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

  // ─── Browser webview IPC handlers (Stage 1f) ──────────────────────
  // Flow: core/tools/browser.ts (Node) → IPC invoke → main process
  //   → sends 'browser:command' to renderer's BrowserPanel
  //   → BrowserPanel executes on <webview> and sends 'browser:response' back
  //   → main process resolves the IPC invoke promise

  const pendingBrowserResponses = new Map<string, {
    resolve: (result: any) => void
    reject: (err: Error) => void
    timer: ReturnType<typeof setTimeout>
  }>()

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

  function sendBrowserCommand(cmd: { type: string; [k: string]: any }, timeoutMs = 30000): Promise<any> {
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

  ipcMain.handle('browser:create', async (_e, url?: string) =>
    sendBrowserCommand({ type: 'create', url: url ?? 'about:blank' }))
  ipcMain.handle('browser:navigate', async (_e, url: string) =>
    sendBrowserCommand({ type: 'navigate', url }))
  ipcMain.handle('browser:screenshot', async () =>
    sendBrowserCommand({ type: 'screenshot' }))
  ipcMain.handle('browser:click', async (_e, selector: string) =>
    sendBrowserCommand({ type: 'click', selector }))
  ipcMain.handle('browser:type', async (_e, selector: string, text: string) =>
    sendBrowserCommand({ type: 'type', selector, text }))
  ipcMain.handle('browser:press-key', async (_e, key: string) =>
    sendBrowserCommand({ type: 'pressKey', key }))
  ipcMain.handle('browser:get-text', async (_e, selector: string) =>
    sendBrowserCommand({ type: 'getText', selector }))
  ipcMain.handle('browser:get-html', async () =>
    sendBrowserCommand({ type: 'getHtml' }))
  ipcMain.handle('browser:wait-for', async (_e, selector: string, timeout?: number) =>
    sendBrowserCommand({ type: 'waitForSelector', selector, timeout: timeout ?? 10000 }))
  ipcMain.handle('browser:close', async () =>
    sendBrowserCommand({ type: 'close' }))
}

// ─── Main window ─────────────────────────────────────────────────────
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 900,
    minHeight: 600,
    title: 'Rem Agent',
    icon: APP_ICON_PATH,
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
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
// Clear default menu so wizard/main window don't show File/Edit/View menus
Menu.setApplicationMenu(null)

app.whenReady().then(async () => {
  registerIpcHandlers()
  await runWizardWindow()
  if (isWizardCompleted()) {
    createMainWindow()
  } else {
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
    if (isWizardCompleted()) {
      createMainWindow()
    } else {
      runWizardWindow()
    }
  }
})

console.log('Electron starting...')
