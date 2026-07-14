// desktop/main.cjs
// OpenShadow Desktop — Electron 主进程（CJS）
// 用 CJS 写，Vite 编译为 main.bundle.cjs
// 任务：
// 1. 创建启动窗口（splash / wizard）
// 2. 处理 IPC 路由
// 3. 创建主窗口加载 Vite dev server 或 dist 资源

const { app, BrowserWindow, desktopCapturer, dialog, ipcMain, Menu, nativeTheme, Tray, Menu: TrayMenu, globalShortcut, powerSaveBlocker, shell } = require('electron')
const { join, dirname, resolve } = require('path')
const { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } = require('fs')
const os = require('os')

// ─── 统一数据目录（对齐 server 的 resolveShadowHome）──────────
// Windows 上 process.env.APPDATA 指向 AppData\Roaming，与 server 的 os.homedir() 不一致。
// 必须在所有项目 require() 和 hanakoHome / _hanakoHome 使用之前设置，确保桌面和服务器读写同一目录。
// 注意：desktop-access-policy.cjs 等模块在 require() 时即读取此 env，因此该块必须先于任何项目 require() 执行。
if (!process.env.OPENSHADOW_HOME) {
  process.env.OPENSHADOW_HOME = join(os.homedir(), '.openshadow')
}
if (!process.env.SHADOW_HOME) {
  process.env.SHADOW_HOME = process.env.OPENSHADOW_HOME
}
mkdirSync(process.env.OPENSHADOW_HOME, { recursive: true })

const { createThemeController } = require('./theme-controller.cjs')
const { setIpcSenderValidator, wrapIpcHandler, wrapIpcOn } = require('./ipc-wrapper.cjs')
const { createServerManager } = require('./server-manager.cjs')
const { createSettingsWindow, getSettingsWindow } = require('./settings-window-controller.cjs')
const { initAutoUpdater, checkForUpdatesAuto } = require('./auto-updater.cjs')
const { createFileWatchRegistry } = require('./file-watch-registry.cjs')
const { createWorkspaceWatchRegistry } = require('./workspace-watch-registry.cjs')
const { resolveGpuStartupPolicy, applyGpuStartupPolicy, markGpuStartupPending, markGpuStartupPhase, markGpuStartupReady } = require('./src/shared/gpu-startup-policy.cjs')
const { readNetworkProxyConfig, applyNetworkProxy } = require('./src/shared/network-proxy.cjs')
// Desktop Access Policy (path sandbox)
const { grantWebContentsAccess, canReadPath, canWritePath, isSetupComplete } = require('./desktop-access-policy.cjs')
// Editor Window Controller
const { createEditorWindowController } = require('./editor-window-controller.cjs')
// Browser Agent Controller (WebContentsView)
const { createBrowserAgentController } = require('./browser-agent.cjs')
// Onboarding 完成桥接（React 向导 → 标记 wizard.completed + 打开主窗口）
const { completeOnboardingAndOpenMain } = require('./src/shared/onboarding-completion.cjs')

const isDev = !app.isPackaged
const VITE_DEV_URL = process.env.VITE_DEV_URL || 'http://localhost:5280'
// App icon
const APP_ICON_PATH = join(__dirname, 'assets', 'rem-avatar.png')

// Windows 任务栏需要 AppUserModelID
if (process.platform === 'win32') {
  app.setAppUserModelId('com.openshadow.app')
}

// High-DPI 支持
app.commandLine.appendSwitch('high-dpi-support', '1')

// ─── GPU 启动策略（Windows 安全模式）──────────────────────────
// 必须在 app.whenReady() 之前调用
;(function applyGpuPolicy() {
  const hanakoHome = process.env.OPENSHADOW_HOME || join(process.env.APPDATA || process.env.HOME || '', '.openshadow')
  try {
    const policy = resolveGpuStartupPolicy({ hanakoHome, platform: process.platform })
    console.log(`[gpu-policy] mode=${policy.mode}, reason=${policy.reason}`)
    applyGpuStartupPolicy(app, policy)
    try { markGpuStartupPending({ hanakoHome, phase: 'electron-starting' }) } catch {}
  } catch (err) {
    console.warn('[gpu-policy] failed to apply:', err.message)
  }
})()

// ─── Network Proxy 设置 ─────────────────────────────────────
;(function applyProxy() {
  try {
    const hanakoHome = process.env.OPENSHADOW_HOME || join(process.env.APPDATA || process.env.HOME || '', '.openshadow')
    const config = readNetworkProxyConfig({ hanakoHome })
    if (config.mode !== 'direct') {
      console.log(`[network-proxy] mode=${config.mode}`)
      applyNetworkProxy(app, config)
    }
  } catch (err) {
    console.warn('[network-proxy] failed to apply:', err.message)
  }
})()

// ─── 窗口装饰选项 ─────────────────────────────────────
function windowIconOpts() {
  if (process.platform === 'win32') {
    return { icon: APP_ICON_PATH }
  }
  return {}
}

function framelessWindowOpts() {
  return { frame: false, ...windowIconOpts() }
}

function titleBarOpts(trafficLight) {
  trafficLight = trafficLight || { x: 16, y: 16 }
  if (process.platform === 'darwin') {
    return {
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: trafficLight,
    }
  }
  return framelessWindowOpts()
}

// ─── Wizard completion flag ────────────────────────────────────
// 当 wizard:done-signal 触发时设为 true，让 close 事件跳过 "还没配置完" 对话框
let wizardCompleting = false
// 防止 wizard→main 切换时 window-all-closed 误退出
let suppressWindowAllClosed = false

// ─── Self-contained config reader ────────────────────────────
// 对齐 openhanako：配置写到用户数据目录，不写安装目录（避免 Program Files EPERM）
const _hanakoHome = process.env.OPENSHADOW_HOME || join(process.env.APPDATA || process.env.HOME || '', '.openshadow')
const CONFIG_PATH = join(_hanakoHome, 'config.json')

function readConfig() {
  if (!existsSync(CONFIG_PATH)) return { version: '0.1.0' }
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'))
  } catch {
    return { version: '0.1.0' }
  }
}

function writeConfig(cfg) {
  mkdirSync(join(CONFIG_PATH, '..'), { recursive: true })
  writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf-8')
}

// 读取 server 进程的 server-info.json（包含 port/token），用于主进程 → server HTTP 调用
// 如果文件不存在，返回默认值 { port: 3000, token: null }
function readServerInfo() {
  try {
    const hanakoHome = process.env.OPENSHADOW_HOME || join(process.cwd(), '.openshadow')
    const p = join(hanakoHome, 'server-info.json')
    if (!existsSync(p)) {
      // 文件不存在 = server 还没就绪。返回 null 端口，让渲染进程进入等待/轮询逻辑，
      // 而不是错误地用 3000（server 实际端口是动态的，3000 被占用时会换端口）。
      // 否则渲染进程在启动竞态里拿到 3000 就跳过等待 → 永远连不上真实 server。
      return { port: null, token: null }
    }
    const info = JSON.parse(readFileSync(p, 'utf-8'))
    // 确保 port 有效
    if (!info || !info.port) {
      return { port: null, token: null }
    }
    return { port: info.port, token: info.token || null }
  } catch {
    return { port: null, token: null }
  }
}

function isWizardCompleted() {
  return readConfig().wizard && readConfig().wizard.completed === true
}

// ─── Builtin provider metadata — single source of truth: provider-presets.ts ───
const { API_PROVIDER_PRESETS } = require('./src/react/utils/provider-presets')

// Model defaults for wizard step 4 (server may not be running yet during setup)
const PROVIDER_MODELS = {
  openai:    ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o1-mini', 'o3-mini'],
  anthropic: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-sonnet-4-20250514'],
  minimax:   ['abab6.5s-chat', 'abab6.5g-chat', 'abab6.5t-chat'],
  'minimax-token-plan': ['MiniMax-M3'],
  dashscope: ['qwen-plus', 'qwen-turbo', 'qwen-max', 'qwen-vl-plus', 'qwen3-235b-a22b'],
  deepseek:  ['deepseek-chat', 'deepseek-reasoner'],
  zhipu:     ['glm-4-plus', 'glm-4-flash', 'glm-4-air', 'glm-4-airx'],
  moonshot:  ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
  'kimi-coding': ['kimi-coding'],
  volcengine:['doubao-pro-32k', 'doubao-lite-32k', 'deepseek-r1-2501', 'deepseek-v3-250324'],
  siliconflow: ['Qwen/Qwen2.5-7B-Instruct', 'deepseek-ai/DeepSeek-V2.5', 'Pro/Qwen/Qwen2.5-7B-Instruct'],
  gemini:    ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
  groq:      ['llama-3.3-70b-versatile', 'mixtral-8x7b-32768', 'qwen-2.5-32b'],
  mistral:   ['mistral-large-latest', 'mistral-small-latest', 'codestral-latest'],
  openrouter: [],
  ollama:    [],
  mimo:      ['mimo-chat'],
  'mimo-token-plan': ['mimo-chat'],
}

// Map provider-presets api string → wizard type string
const API_TO_TYPE = {
  'openai-completions': 'openai',
  'anthropic-messages': 'anthropic',
  'google-generative-ai': 'gemini',
}

const BUILTIN_PROVIDERS = {}
for (const p of API_PROVIDER_PRESETS) {
  BUILTIN_PROVIDERS[p.value] = {
    type: API_TO_TYPE[p.api] || 'openai',
    label: p.labelZh || p.label,
    baseUrl: p.url,
    models: PROVIDER_MODELS[p.value] || [],
    requiresApiKey: !p.local,
    ...(p.local ? { notes: '本地运行，无需 API Key' } : {}),
  }
}

async function testOpenAICompatible(baseUrl, apiKey, model) {
  const start = Date.now()
  try {
    const res = await fetch(baseUrl.replace(/\/+$/, '') + '/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: 'Bearer ' + apiKey } : {}),
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
      return { ok: false, latencyMs: latencyMs, modelUsed: model, error: res.status + ' ' + res.statusText + ': ' + errText.slice(0, 200) }
    }
    return { ok: true, latencyMs: latencyMs, modelUsed: model }
  } catch (e) {
    return { ok: false, latencyMs: Date.now() - start, modelUsed: model, error: e.message }
  }
}

async function testAnthropicCompatible(baseUrl, apiKey, model) {
  const start = Date.now()
  try {
    const res = await fetch(baseUrl.replace(/\/+$/, '') + '/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      }),
    })
    const latencyMs = Date.now() - start
    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      return { ok: false, latencyMs, modelUsed: model, error: res.status + ' ' + res.statusText + ': ' + errText.slice(0, 200) }
    }
    return { ok: true, latencyMs, modelUsed: model }
  } catch (e) {
    return { ok: false, latencyMs: Date.now() - start, modelUsed: model, error: e.message }
  }
}

let mainWindow = null
let wizardWindow = null
let settingsWindow = null
let editorController = null
let browserAgent = null

// ─── IPC 安全：验证调用来源 ─────────────────────────────────────
// 仅允许来自可信 WebContents 的 IPC 调用（主窗口、向导窗口、设置窗口）
function isTrustedAppWebContents(webContents, channel) {
  if (!webContents || webContents.isDestroyed && webContents.isDestroyed()) return false
  const owner = BrowserWindow.fromWebContents(webContents)
  if (owner === mainWindow || owner === wizardWindow || owner === settingsWindow) return true
  // 允许 Editor Window 和 Browser Viewer Window
  if (editorController && owner === editorController.getWindow()) return true
  if (browserAgent && owner === browserAgent.getWindow()) return true
  // 允许 file:// 协议（本地 HTML）
  try {
    const url = webContents.getURL && webContents.getURL()
    if (url && url.startsWith('file://')) return true
    // 允许 localhost dev server
    if (/^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?\//.test(url)) return true
  } catch {}
  console.warn(`[IPC][${channel}] untrusted sender rejected`)
  return false
}

setIpcSenderValidator((channel, event) => isTrustedAppWebContents(event?.sender, channel))

async function runWizardWindow() {
  if (isWizardCompleted()) return

  // React Onboarding 入口用标准 preload（暴露 window.hana / window.platform 桥接）
  const preloadPath = join(__dirname, 'preload.bundle.cjs')
  console.log('[onboarding] preload path:', preloadPath, '| exists:', existsSync(preloadPath))

  wizardWindow = new BrowserWindow({
    width: 560,
    height: 780,
    resizable: false,
    minimizable: false,
    maximizable: false,
    title: 'OpenShadow 启动向导',
    backgroundColor: '#F8F4ED', // warm-paper 浅色，避免白屏闪烁
    show: false,
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: false,
    },
    ...titleBarOpts({ x: 16, y: 16 }),
  })

  wizardWindow.once('ready-to-show', () => {
    wizardWindow && wizardWindow.show()
    console.log('[onboarding] window shown')
  })

  // 加载 React Onboarding（vite 构建产物 dist-renderer/onboarding.html）
  if (!app.isPackaged && process.env.VITE_DEV_URL) {
    await wizardWindow.loadURL(`${process.env.VITE_DEV_URL}/onboarding.html`)
    console.log('[onboarding] loaded from Vite dev server')
  } else {
    const exePath = app.getAppPath()
    const htmlPath = join(exePath, 'desktop', 'dist-renderer', 'onboarding.html')
    console.log('[onboarding] html path:', htmlPath, '| exists:', existsSync(htmlPath))
    await wizardWindow.loadFile(htmlPath)
    console.log('[onboarding] loaded HTML from', htmlPath)
  }

  wizardWindow.on('close', (e) => {
    // wizardCompleting=true 表示 onboarding-complete 主动关闭，不弹对话框
    if (wizardCompleting) {
      wizardWindow = null
      return
    }
    if (!isWizardCompleted()) {
      const choice = dialog.showMessageBoxSync(wizardWindow, {
        type: 'question',
        buttons: ['继续设置', '退出'],
        defaultId: 0,
        cancelId: 1,
        title: 'OpenShadow 还没配置完',
        message: 'OpenShadow 还没配置完,现在退出将无法使用。确定要退出吗?',
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

// ─── IPC handlers ───────────────────────────────────
function registerIpcHandlers() {
  wrapIpcHandler('server:get-info', () => {
    const info = readServerInfo()
    return { port: info?.port || null, token: info?.token || null }
  })

  // 热重启 server（渲染进程触发）
  wrapIpcHandler('server:restart', async () => {
    await serverManager.restart('ipc')
    return { ok: true, port: serverManager.getPort() }
  })

  // ─── React Onboarding 桥接 ───────────────────────────────
  // 向导完成：标记 wizard.completed 并打开主窗口（与 vanilla wizard:done-signal 等效）
  wrapIpcHandler('onboarding-complete', async () => {
    console.log('[onboarding] complete signal received')
    wizardCompleting = true
    suppressWindowAllClosed = true
    try {
      if (wizardWindow && !wizardWindow.isDestroyed()) {
        wizardWindow.close()
      }
      wizardWindow = null
      const port = serverManager.getPort()
      const token = serverManager.getToken()
      await completeOnboardingAndOpenMain({
        serverPort: port,
        serverToken: token,
        createMainWindow,
      })
      // 持久化 wizard.completed，避免下次启动重复弹向导
      // （React 向导只调 preferences/setup-complete 写 preferences.setupComplete，不碰 wizard.completed）
      const cfg = readConfig()
      cfg.wizard = cfg.wizard || {}
      cfg.wizard.completed = true
      cfg.wizard.completedAt = new Date().toISOString()
      writeConfig(cfg)
      console.log('[onboarding] wizard.completed = true persisted')
    } catch (e) {
      console.error('[onboarding] complete failed:', e.message)
    } finally {
      suppressWindowAllClosed = false
    }
  })

  // 欢迎页预填信息：语言 / 助手名（失败回落默认）
  wrapIpcHandler('get-splash-info', () => {
    try {
      const cfg = readConfig()
      const user = (cfg.user && cfg.user.name) || 'Shadow'
      const locale = (cfg.ui && cfg.ui.language) || 'zh-CN'
      return { agentName: user, locale, yuan: 'hanako' }
    } catch {
      return { agentName: 'Shadow', locale: 'zh-CN', yuan: 'hanako' }
    }
  })

  // 欢迎页头像本地路径（agent 角色），用于显示默认助手头像
  wrapIpcHandler('get-avatar-path', (_event, role) => {
    if (role !== 'agent' && role !== 'user') return null
    try {
      const candidates = [
        join(process.resourcesPath, 'assets', 'Hanako.png'),
        join(process.resourcesPath, 'assets', 'hanako.png'),
      ]
      for (const p of candidates) {
        if (existsSync(p)) return p
      }
      return null
    } catch {
      return null
    }
  })

  wrapIpcHandler('wizard:get-config', () => {
    const cfg = readConfig()
    return {
      providers: cfg.providers || [],
      user: { name: (cfg.user && cfg.user.name) || '王帅' },
      ui: { language: (cfg.ui && cfg.ui.language) || 'zh-CN' },
      theme: cfg.theme || 'warm-paper',
      security: { workspaceRoots: (cfg.security && cfg.security.workspaceRoots) || [] },
      builtins: BUILTIN_PROVIDERS,
    }
  })

  wrapIpcHandler('wizard:save-config', (_e, payload) => {
    console.log('[wizard] save-config called')
    try {
      const cfg = readConfig()
      const merged = Object.assign({}, cfg, payload)
      if (merged.providers && Array.isArray(merged.providers)) {
        for (const p of merged.providers) {
          if (!p.baseUrl && BUILTIN_PROVIDERS[p.id]) {
            p.baseUrl = BUILTIN_PROVIDERS[p.id].baseUrl
          }
        }
      }
      if (payload.security && payload.security.workspaceRoots) {
        merged.security = Object.assign({}, cfg.security || {}, { workspaceRoots: payload.security.workspaceRoots })
      }
      if (payload.desk && payload.desk.home_folder) {
        merged.desk = Object.assign({}, cfg.desk || {}, { home_folder: payload.desk.home_folder })
      }
      writeConfig(merged)
      console.log('[wizard] config saved to', CONFIG_PATH)
      // 通知所有 BrowserWindow（main + wizard）配置已更新
      try {
        const allWins = BrowserWindow.getAllWindows()
        for (const win of allWins) {
          if (!win.isDestroyed()) {
            win.webContents.send('config:updated', { source: 'wizard' })
          }
        }
      } catch (e) {
        console.warn('[wizard] broadcast config:updated failed:', e.message)
      }
      return { ok: true }
    } catch (e) {
      console.error('[wizard] save-config error:', e.message)
      return { ok: false, error: e.message }
    }
  })

  wrapIpcHandler('wizard:test-connection', async (_e, providerInput) => {
    const spec = BUILTIN_PROVIDERS[providerInput.id]
    if (!spec) return { ok: false, error: 'Unknown provider: ' + providerInput.id }
    const model = providerInput.model || spec.models[0]
    let result
    if (spec.type === 'anthropic') {
      result = await testAnthropicCompatible(spec.baseUrl, providerInput.apiKey, model)
    } else if (spec.type === 'gemini') {
      result = { ok: false, error: 'Gemini 测试暂未支持' }
    } else {
      result = await testOpenAICompatible(spec.baseUrl, providerInput.apiKey, model)
    }
    return { ok: result.ok, latencyMs: result.latencyMs, error: result.error, modelUsed: result.modelUsed }
  })

  wrapIpcHandler('wizard:pick-folder', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: '选择 OpenShadow 的工作区目录',
      message: '请选择 OpenShadow 可以读写的目录(可多选)。这些目录拥有完整权限(读/写/删)。',
      properties: ['openDirectory', 'multiSelections', 'createDirectory'],
    })
    return canceled ? [] : filePaths
  })

  wrapIpcHandler('dialog:selectFolder', async (_e, opts) => {
    opts = opts || {}
    const properties = ['openDirectory']
    if (opts.multi) properties.push('multiSelections')
    properties.push('createDirectory')
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: opts.title || '选择文件夹',
      message: opts.message || '请选择一个文件夹',
      properties: properties,
    })
    return canceled ? null : (filePaths[0] || null)
  })

  wrapIpcHandler('dialog:selectFiles', async (_e, opts) => {
    opts = opts || {}
    const properties = ['openFile']
    if (opts.multi) properties.push('multiSelections')
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: opts.title || '选择文件',
      properties: properties,
      filters: opts.filters || [],
    })
    return canceled ? [] : filePaths
  })

  // Screenshot
  wrapIpcHandler('screenshot:capture', async (_e, displayId) => {
    try {
      const targetDisplay = displayId !== undefined ? displayId : 0
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 1920, height: 1080 },
        fetchWindowIcons: false,
      })
      const source = sources[targetDisplay] || sources[0]
      if (!source) {
        return { success: false, error: 'No screen source found (requested index ' + targetDisplay + ', available ' + sources.length + ')' }
      }
      const thumbnail = source.thumbnail
      const size = thumbnail.getSize()
      const base64 = thumbnail.toPNG().toString('base64')
      return {
        success: true,
        base64: base64,
        path: '',
        width: size.width,
        height: size.height,
        platform: process.platform,
      }
    } catch (e) {
      return { success: false, error: 'desktopCapturer failed: ' + e.message }
    }
  })

  wrapIpcHandler('screenshot:capture-window', async (_e, windowId) => {
    try {
      const win = windowId
        ? BrowserWindow.getAllWindows().find(w => w.id === windowId)
        : mainWindow
      if (!win || win.isDestroyed()) {
        return { success: false, error: 'Target window not found' }
      }
      const image = await win.webContents.capturePage()
      const size = image.getSize()
      const base64 = image.toPNG().toString('base64')
      return {
        success: true,
        base64: base64,
        path: '',
        width: size.width,
        height: size.height,
        platform: process.platform,
      }
    } catch (e) {
      return { success: false, error: 'capturePage failed: ' + e.message }
    }
  })

  // Browser webview IPC
  const pendingBrowserResponses = new Map()

  wrapIpcOn('browser:response', (_event, response) => {
    const pending = pendingBrowserResponses.get(response.id)
    if (!pending) return
    clearTimeout(pending.timer)
    pendingBrowserResponses.delete(response.id)
    if (response.success) {
      pending.resolve({ success: true, ...response.data })
    } else {
      pending.resolve({ success: false, error: response.error || 'Unknown browser error' })
    }
  })

  function sendBrowserCommand(cmd, timeoutMs) {
    timeoutMs = timeoutMs || 30000
    return new Promise((resolve, reject) => {
      const id = 'cmd-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8)
      const timer = setTimeout(() => {
        pendingBrowserResponses.delete(id)
        resolve({ success: false, error: 'Browser command timed out: ' + cmd.type })
      }, timeoutMs)
      pendingBrowserResponses.set(id, { resolve, reject, timer })
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('browser:command', Object.assign({ id: id }, cmd))
      } else {
        clearTimeout(timer)
        pendingBrowserResponses.delete(id)
        resolve({ success: false, error: 'Main window not available' })
      }
    })
  }

  wrapIpcHandler('browser:create', async (_e, url) => sendBrowserCommand({ type: 'create', url: url || 'about:blank' }))
  wrapIpcHandler('browser:navigate', async (_e, url) => sendBrowserCommand({ type: 'navigate', url: url }))
  wrapIpcHandler('browser:screenshot', async () => sendBrowserCommand({ type: 'screenshot' }))
  wrapIpcHandler('browser:click', async (_e, selector) => sendBrowserCommand({ type: 'click', selector: selector }))
  wrapIpcHandler('browser:type', async (_e, selector, text) => sendBrowserCommand({ type: 'type', selector: selector, text: text }))
  wrapIpcHandler('browser:press-key', async (_e, key) => sendBrowserCommand({ type: 'pressKey', key: key }))
  wrapIpcHandler('browser:get-text', async (_e, selector) => sendBrowserCommand({ type: 'getText', selector: selector }))
  wrapIpcHandler('browser:get-html', async () => sendBrowserCommand({ type: 'getHtml' }))
  wrapIpcHandler('browser:wait-for', async (_e, selector, timeout) => sendBrowserCommand({ type: 'waitForSelector', selector: selector, timeout: timeout || 10000 }))
  wrapIpcHandler('browser:close', async () => sendBrowserCommand({ type: 'close' }))

  // 窗口控制
  wrapIpcOn('window:minimize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) win.minimize()
  })

  wrapIpcOn('window:maximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return
    if (win.isMaximized()) {
      win.unmaximize()
    } else {
      win.maximize()
    }
  })

  wrapIpcOn('window:close', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) win.close()
  })

  wrapIpcHandler('window:is-maximized', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    return win ? win.isMaximized() : false
  })

  // 登录项自启动（开机自启）
  wrapIpcHandler('wizard:set-login-item', (_e, enable) => {
    app.setLoginItemSettings({
      openAtLogin: enable,
      name: 'OpenShadow',
    })
    console.log('[main] login item auto-start:', enable ? 'enabled' : 'disabled')
    return { ok: true }
  })

  wrapIpcHandler('wizard:get-login-item', () => {
    const settings = app.getLoginItemSettings()
    return { enabled: settings.openAtLogin }
  })

  // 打开设置窗口
  wrapIpcHandler('window:open-settings', () => {
    const win = createSettingsWindow({
      mainWindow,
      preloadPath: join(__dirname, 'preload.bundle.cjs'),
      iconPath: APP_ICON_PATH,
      isDev,
      viteDevUrl: VITE_DEV_URL,
    })
    return { ok: true, id: win?.id }
  })

  // ─── File Watch IPC ───
  wrapIpcHandler('file-watch:subscribe', (event, filePath) => {
    const subscriberId = event.sender.getId()
    fileWatchRegistry.subscribe(filePath, subscriberId)
    return { ok: true }
  })

  wrapIpcHandler('file-watch:unsubscribe', (event, filePath) => {
    const subscriberId = event.sender.getId()
    fileWatchRegistry.unsubscribe(filePath, subscriberId)
    return { ok: true }
  })

  wrapIpcHandler('file-watch:unsubscribe-all', (event) => {
    const subscriberId = event.sender.getId()
    fileWatchRegistry.unsubscribeAll(subscriberId)
    return { ok: true }
  })

  // ─── Workspace Watch IPC ───
  wrapIpcHandler('workspace-watch:subscribe', (event, rootPath) => {
    const subscriberId = event.sender.getId()
    workspaceWatchRegistry.subscribe(rootPath, subscriberId)
    return { ok: true }
  })

  wrapIpcHandler('workspace-watch:unsubscribe', (event, rootPath) => {
    const subscriberId = event.sender.getId()
    workspaceWatchRegistry.unsubscribe(rootPath, subscriberId)
    return { ok: true }
  })

  wrapIpcHandler('workspace-watch:unsubscribe-all', (event) => {
    const subscriberId = event.sender.getId()
    workspaceWatchRegistry.unsubscribeAll(subscriberId)
    return { ok: true }
  })

  // ─── Quick Chat IPC ─────────────────────────────────────
  wrapIpcHandler('quick-chat:show', () => {
    showQuickChatWindow()
    return { ok: true }
  })

  wrapIpcHandler('quick-chat:hide', () => {
    hideQuickChatWindow()
    return { ok: true }
  })

  wrapIpcHandler('quick-chat:toggle', () => {
    toggleQuickChatWindow()
    return { ok: true }
  })

  wrapIpcHandler('quick-chat:resize', (_event, mode) => {
    // mode: 'compact' | 'chat'
    if (mode !== 'compact' && mode !== 'chat') return { ok: false, error: 'invalid mode' }
    quickChatMode = mode
    if (quickChatWindow && !quickChatWindow.isDestroyed()) {
      const bounds = getQuickChatBounds()
      quickChatWindow.setResizable(mode === 'chat')
      quickChatWindow.setBounds(bounds, true)
    }
    return { ok: true }
  })

  wrapIpcHandler('quick-chat:shortcut-status', () => {
    return {
      shortcut: registeredQuickChatShortcut || 'Alt+Space',
      registered: !!registeredQuickChatShortcut,
    }
  })

  wrapIpcHandler('quick-chat:reload-shortcut', () => {
    try {
      const cfg = readConfig()
      const shortcut = cfg?.quickChat?.shortcut || 'Alt+Space'
      registerQuickChatShortcut(shortcut)
      return { ok: true, shortcut }
    } catch (e) {
      return { ok: false, error: e.message }
    }
  })
}

// ─── Main window ─────────────────────────────────────
// 把 config.json 里的 providers/models 推送给 server（向导完成 / 启动已标记完成时都调用）。
// 抽成独立函数，避免「已完成」分支与 done-signal 重复实现推送逻辑。
async function pushWizardConfigToServer() {
  // ⚠️ 关键：等 server 就绪后发 config（包括 providers/models），再开主窗口
  // 等待 serverManager 就绪（最多 15s）
  let port = serverManager.getPort()
  let token = serverManager.getToken()
  if (!port) {
    console.log('[main] waiting for server to be ready...')
    for (let i = 0; i < 75 && !port; i++) {
      await new Promise(r => setTimeout(r, 200))
      port = serverManager.getPort()
      token = serverManager.getToken()
    }
  }
  if (port) {
    console.log(`[main] server ready on port ${port}, pushing config`)
    const cfg = readConfig()
    const providersObj = {}
    if (Array.isArray(cfg.providers)) {
      for (const p of cfg.providers) {
        if (!p || !p.id) continue
        providersObj[p.id] = {
          base_url: p.baseUrl || p.base_url || p.url || '',
          api_key: p.apiKey || p.api_key || '',
          api: p.api || (p.type === 'anthropic' ? 'anthropic-messages' :
                   p.type === 'gemini' ? 'google-generative-ai' :
                   'openai-completions'),
          models: Array.isArray(p.models) ? p.models : [],
          display_name: p.name || p.display_name || p.id,
        }
      }
    }

    // Convert wizard model format {main: "provider::model"} to engine format {chat: {id, provider}}
    // The wizard saves {main, small, large} as "providerId::modelId" strings.
    // The engine expects {chat: {id, provider}, utility: {id, provider}, utility_large: {id, provider}}.
    const engineModels = {}
    if (cfg.models && typeof cfg.models === 'object') {
      for (const [role, ref] of Object.entries(cfg.models)) {
        if (typeof ref === 'string' && ref.includes('::')) {
          const sepIdx = ref.indexOf('::')
          const provider = ref.slice(0, sepIdx)
          const id = ref.slice(sepIdx + 2)
          const engineRole = role === 'main' ? 'chat'
            : role === 'small' ? 'utility'
            : role === 'large' ? 'utility_large'
            : role
          engineModels[engineRole] = { id, provider }
        } else if (typeof ref === 'object' && ref !== null && ref.id) {
          // Already in {id, provider} format — pass through
          engineModels[role] = ref
        }
      }
    }
    console.log('[main] converted models:', JSON.stringify(engineModels))

    const url = `http://127.0.0.1:${port}/api/config`
    const headers = { 'Content-Type': 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`
    const putBody = {
      providers: Object.keys(providersObj).length > 0 ? providersObj : cfg.providers,
      models: Object.keys(engineModels).length > 0 ? engineModels : cfg.models,
      wizard: cfg.wizard,
      ui: cfg.ui,
      user: cfg.user,
      memory: cfg.memory,
      theme: cfg.theme,
      security: cfg.security,
    }

    // 自愈推送：最多重试 3 次；每次 PUT 后校验模型是否生效，
    // 若未生效（availableModels 尚未就绪 / 瞬态失败）则兜底 POST /api/models/set。
    let pushedOk = false
    for (let attempt = 1; attempt <= 3 && !pushedOk; attempt++) {
      try {
        const res = await fetch(url, {
          method: 'PUT',
          headers,
          body: JSON.stringify(putBody),
          signal: AbortSignal.timeout(10000),
        })
        console.log(`[main] PUT /api/config → ${res.status} (attempt ${attempt})`)
        if (res.ok) pushedOk = true
      } catch (e) {
        console.warn(`[main] PUT /api/config failed (attempt ${attempt}):`, e.message)
      }
      if (!pushedOk && attempt < 3) {
        await new Promise(r => setTimeout(r, 800))
        continue
      }
      // 校验：模型是否已在 availableModels 且为 current
      try {
        const mRes = await fetch(`http://127.0.0.1:${port}/api/models`, { headers, signal: AbortSignal.timeout(10000) })
        const mData = await mRes.json().catch(() => ({}))
        const models = Array.isArray(mData) ? mData : (mData.models || [])
        const chatModel = engineModels.chat
        const currentModel = models.find(m => m.isCurrent)
        const targetHit = chatModel && models.some(m => m.id === chatModel.id && m.provider === chatModel.provider)
        if (chatModel && (!targetHit || !currentModel || currentModel.id !== chatModel.id || currentModel.provider !== chatModel.provider)) {
          // 兜底：直接调用 set 端点把目标模型设为 current
          console.warn(`[main] model not effective after push (attempt ${attempt}), falling back to POST /api/models/set`)
          const setRes = await fetch(`http://127.0.0.1:${port}/api/models/set`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ modelId: chatModel.id, provider: chatModel.provider }),
            signal: AbortSignal.timeout(10000),
          })
          console.log(`[main] POST /api/models/set → ${setRes.status}`)
          if (setRes.ok) pushedOk = true
        } else if (chatModel) {
          pushedOk = true
        }
      } catch (e) {
        console.warn(`[main] verify models failed (attempt ${attempt}):`, e.message)
      }
    }
    if (!pushedOk) console.error('[main] config push did NOT take effect after retries — model may not be configured')

    // Mark setup as complete so the engine knows the wizard is done
    try {
      const setupRes = await fetch(`http://127.0.0.1:${port}/api/preferences/setup-complete`, {
        method: 'POST',
        headers,
        signal: AbortSignal.timeout(10000),
      })
      console.log(`[main] POST /api/preferences/setup-complete → ${setupRes.status}`)
      const setupBody = await setupRes.json().catch(() => ({}))
      if (!setupBody.setupComplete) {
        console.warn('[main] setup-complete response did not confirm setupComplete=true')
      }
    } catch (e) {
      console.warn('[main] setup-complete error:', e.message)
    }
  } else {
    console.warn('[main] server not ready after 15s, config push skipped')
  }
}

function createMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) return mainWindow
  const saved = loadWindowState()

  mainWindow = new BrowserWindow({
    width: (saved && saved.width) || 1180,
    height: (saved && saved.height) || 760,
    minWidth: 900,
    minHeight: 600,
    title: 'OpenShadow Agent',
    icon: APP_ICON_PATH,
    webPreferences: {
      preload: join(__dirname, 'preload.bundle.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: false,
      webviewTag: true,
    },
    ...titleBarOpts(),
    backgroundColor: themeController.bgFor(themeController.getTheme()),
    show: false,
  })

  // 恢复位置
  if (saved && saved.x != null && saved.y != null) {
    try { mainWindow.setPosition(saved.x, saved.y) } catch {}
  }
  if (saved && saved.isMaximized) {
    mainWindow.maximize()
  }

  mainWindow.once('ready-to-show', () => {
    if (mainWindow) {
      // 应用当前主题的背景色（避免主题切换后重启时窗口背景跟不上）
      themeController.applyToWindow(mainWindow, themeController.getTheme())
      mainWindow.show()
      console.log('Main window shown')
    }
  })

  // Fallback: force-show window if ready-to-show doesn't fire within 8s
  setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      mainWindow.show()
      console.warn('[main] window force-shown (ready-to-show fallback after 8s)')
    }
  }, 8000)

  if (isDev) {
    // 开发模式：优先尝试 Vite dev server，不可用时回退到 dist-renderer
    const http = require('http')
    const devUrl = new URL(VITE_DEV_URL)
    // 快速检测 Vite dev server 是否在运行
    const req = http.get(devUrl.origin, { timeout: 2000 }, (res) => {
      res.destroy()
      console.log('Loading Vite dev server:', VITE_DEV_URL)
      mainWindow.loadURL(VITE_DEV_URL)
      mainWindow.webContents.openDevTools({ mode: 'detach' })
    })
    req.on('error', () => {
      console.log('[main] Vite dev server not available, falling back to dist-renderer')
      const exePath = app.getAppPath()
      mainWindow.loadFile(join(exePath, 'desktop', 'dist-renderer', 'index.html'))
    })
    req.on('timeout', () => {
      req.destroy()
      console.log('[main] Vite dev server timeout, falling back to dist-renderer')
      const exePath = app.getAppPath()
      mainWindow.loadFile(join(exePath, 'desktop', 'dist-renderer', 'index.html'))
    })
  } else {
    const exePath = app.getAppPath()
    mainWindow.loadFile(join(exePath, 'desktop', 'dist-renderer', 'index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
    if (process.platform !== 'darwin') app.quit()
  })

  // Renderer 崩溃自动恢复
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error(`[main] renderer crashed: ${details.reason} (exitCode: ${details.exitCode})`)
    if (mainWindow && !mainWindow.isDestroyed()) {
      setTimeout(() => {
        try { mainWindow.reload() } catch {}
      }, 1000)
    }
  })

  // 拦截外部 URL 导航，用系统浏览器打开
  mainWindow.webContents.on('will-navigate', (event, url) => {
    try {
      const parsed = new URL(url)
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
        event.preventDefault()
        shell.openExternal(url)
      }
    } catch {}
  })

  const broadcastMaximizeChange = () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('window:maximize-change', mainWindow.isMaximized())
    }
  }
  mainWindow.on('maximize', broadcastMaximizeChange)
  mainWindow.on('unmaximize', broadcastMaximizeChange)

  // 窗口状态持久化
  mainWindow.on('resize', () => saveWindowStateSoon(mainWindow))
  mainWindow.on('move', () => saveWindowStateSoon(mainWindow))
  mainWindow.on('close', () => saveWindowState(mainWindow))

  console.log('Main window created (dev=' + isDev + ')')
}

// ─── App lifecycle ───────────────────────────────────
Menu.setApplicationMenu(null)

// ─── 单实例锁：防止多开 ─────────────────────────────────────
const gotSingleInstanceLock = app.requestSingleInstanceLock()
if (!gotSingleInstanceLock) {
  console.log('[main] another instance is running, quitting')
  app.quit()
}
app.on('second-instance', () => {
  // 有人试图运行第二个实例，聚焦到现有窗口
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  }
})

// ─── 注入版本号（供 server-info.json 版本字段 + 版本复用比对）───
if (!process.env.SHADOW_VERSION) {
  process.env.SHADOW_VERSION = app.getVersion()
}

// ─── Power Save Blocker ─────────────────────────────────────
let wakeLockId = null
const WINDOW_STATE_PATH = join(process.cwd(), 'window-state.json')

function setWakeLock(active) {
  if (active) {
    if (wakeLockId === null) {
      wakeLockId = powerSaveBlocker.start('prevent-app-suspension')
      console.log('[main] wakeLock started, id:', wakeLockId)
    }
  } else {
    if (wakeLockId !== null && powerSaveBlocker.isStarted(wakeLockId)) {
      powerSaveBlocker.stop(wakeLockId)
      wakeLockId = null
      console.log('[main] wakeLock stopped')
    }
  }
}

// ─── 窗口状态持久化 ─────────────────────────────────────
function loadWindowState() {
  try {
    if (existsSync(WINDOW_STATE_PATH)) {
      return JSON.parse(readFileSync(WINDOW_STATE_PATH, 'utf-8'))
    }
  } catch {}
  return null
}

function saveWindowState(win) {
  if (!win || win.isDestroyed()) return
  try {
    const bounds = win.getBounds()
    const state = {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      isMaximized: win.isMaximized(),
    }
    writeFileSync(WINDOW_STATE_PATH, JSON.stringify(state, null, 2), 'utf-8')
  } catch {}
}

let saveWindowStateTimer = null
function saveWindowStateSoon(win) {
  if (saveWindowStateTimer) clearTimeout(saveWindowStateTimer)
  saveWindowStateTimer = setTimeout(() => {
    saveWindowState(win)
    saveWindowStateTimer = null
  }, 1000)
}

// ─── Server Process Manager ─────────────────────────────────────
// 管理 server 进程：启动、监控心跳、崩溃重启、优雅关闭
const serverManager = createServerManager({
  app,
  lynnHome: process.env.OPENSHADOW_HOME || join((process.env.APPDATA || os.homedir()), '.openshadow'),
  dirname: __dirname,
  execPath: process.execPath,
  platform: process.platform,
  env: process.env,
  resourcesPath: process.resourcesPath || '',
  fetch: globalThis.fetch,
  onServerReady: ({ port, token, reused }) => {
    console.log(`[main] Server ${reused ? 'reused' : 'started'} on port ${port}`)
  },
  onServerCrashed: (err) => {
    console.error('[main] Server crashed:', err.message)
    dialog.showErrorBox('OpenShadow Server', '服务器崩溃: ' + err.message)
  },
  onServerRestarted: ({ port, token }) => {
    console.log('[main] Server restarted on port', port)
    // 通知渲染进程重新连接（preload 暴露 onServerRestarted 监听 'server-restarted'）
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('server-restarted', { port, token })
      }
    }
  },
  writeCrashLog: (msg) => {
    try {
      const logPath = join(process.cwd(), 'crash.log')
      appendFileSync(logPath, `[${new Date().toISOString()}] ${msg}\n`, 'utf-8')
    } catch {}
  },
})

// ─── File Watch Registry ─────────────────────────────────────
// 文件监控注册表：同一文件只创建一个 fs.watch，多个订阅者共享
const fileWatchRegistry = createFileWatchRegistry({
  watch: (filePath, callback) => {
    // 使用 chokidar 监控文件
    const watcher = require('chokidar').watch(filePath, {
      ignoreInitial: true,
      atomic: true,
      awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
    })
    watcher.on('all', (eventType, changedPath) => {
      callback(eventType, changedPath)
    })
    return watcher
  },
  notifySubscriber: (subscriberId, eventType, filePath) => {
    const win = BrowserWindow.fromId(subscriberId)
    if (win && !win.isDestroyed()) {
      win.webContents.send('file-watch:change', { eventType, filePath })
    }
  },
})

// ─── Workspace Watch Registry ─────────────────────────────────────
// 工作区监控注册表：监控整个工作区的文件变化
// 忽略常见非用户文件
function shouldIgnoreWorkspacePath(rootPath, filePath) {
  const relative = filePath.replace(rootPath, '').replace(/\\/g, '/')
  const ignoredPatterns = [
    '/node_modules/', '/.git/', '/.openshadow/', '/dist/', '/out/',
    '/.DS_Store', '~', '.swp', '.swo', '.tmp', '.temp',
    '.log', 'crash.log', 'server-info.json',
  ]
  return ignoredPatterns.some(p => relative.includes(p))
}

const workspaceWatchRegistry = createWorkspaceWatchRegistry({
  watch: (rootPath, callback) => {
    const watcher = require('chokidar').watch(rootPath, {
      ignoreInitial: true,
      atomic: true,
      awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
      ignored: (path) => {
        return shouldIgnoreWorkspacePath(rootPath, path)
      },
    })
    watcher.on('all', (eventType, changedPath) => {
      callback(eventType, changedPath)
    })
    return watcher
  },
  notifySubscriber: (subscriberId, eventType, rootPath, changedPath) => {
    const win = BrowserWindow.fromId(subscriberId)
    if (win && !win.isDestroyed()) {
      win.webContents.send('workspace-watch:change', { eventType, rootPath, changedPath })
    }
  },
})
const themeController = createThemeController({
  BrowserWindow,
  nativeTheme,
  getMainWindow: () => mainWindow,
  getSettingsWindow: () => settingsWindow,
  getBrowserViewer: () => null,  // 浏览器 viewer 不在 openshadow 路线里
})
themeController.attachIpc({ ipcMain, wrapIpcOn })

app.whenReady().then(async () => {
  registerIpcHandlers()

  // 启动 server（不阻塞 wizard 窗口；后台启动 + 心跳监控）
  void (async () => {
    try {
      await serverManager.start()
      serverManager.monitor()
      serverManager.startHeartbeat()

      // ─── 连接 Browser Agent 到 Server WebSocket ─────────────
      if (browserAgent && serverManager.getPort()) {
        browserAgent.setupCommands(serverManager.getPort(), serverManager.getToken())
        console.log('[main] browser agent WebSocket setup complete')
      }

      // ─── 通知渲染进程 server 已就绪 ─────────────────────
      const port = serverManager.getPort()
      const token = serverManager.getToken()
      if (port) {
        console.log(`[main] Notifying renderer: server ready on port ${port}`)
        // 通知所有窗口
        for (const win of BrowserWindow.getAllWindows()) {
          if (!win.isDestroyed()) {
            win.webContents.send('server:ready', { port, token })
          }
        }
      }
    } catch (err) {
      console.error('[main] Failed to start server:', err.message)
      // 不弹错误对话框阻塞主流程；只写 crash log
      try {
        const logPath = join(process.cwd(), 'crash.log')
        appendFileSync(logPath, `[${new Date().toISOString()}] Server start failed: ${err.message}\n`, 'utf-8')
      } catch {}
    }
  })()

  createTray()
  registerGlobalShortcut()

  // ─── 初始化 Editor Window Controller ─────────────────────
  try {
    editorController = createEditorWindowController({
      wrapIpcHandler,
      isDev,
      viteDevUrl: VITE_DEV_URL,
      preloadPath: join(__dirname, 'preload.bundle.cjs'),
      getMainWindow: () => mainWindow,
      canWritePath,
      grantWebContentsAccess,
    })
    editorController.register()
    console.log('[main] editor window controller registered')
  } catch (err) {
    console.warn('[main] failed to init editor controller:', err.message)
  }

  // ─── 初始化 Browser Agent Controller（WebContentsView）───
  try {
    browserAgent = createBrowserAgentController({
      isDev,
      viteDevUrl: VITE_DEV_URL,
      preloadPath: join(__dirname, 'preload.bundle.cjs'),
      getMainWindow: () => mainWindow,
    })
    browserAgent.registerIpc(wrapIpcHandler)
    console.log('[main] browser agent controller registered')
  } catch (err) {
    console.warn('[main] failed to init browser agent:', err.message)
  }

  // 安装应用菜单（macOS 必需，Windows 提供编辑菜单）
  // 先初始化主进程 i18n（菜单项需要翻译）
  try {
    const { createMainI18n } = require('./main-i18n.cjs')
    const hanakoHome = process.env.OPENSHADOW_HOME || join(process.env.APPDATA || process.env.HOME || '', '.openshadow')
    const localesDir = join(__dirname, 'src', 'locales')
    const { mt, reset: resetI18n } = createMainI18n({ hanakoHome, localesDir })
    globalThis.__mainI18nMt = mt
    console.log('[main] i18n initialized')
  } catch (err) {
    console.warn('[main] failed to init i18n:', err.message)
    globalThis.__mainI18nMt = (key, d) => d || key
  }

  try {
    const { installAppMenu } = require('./app-menu.cjs')
    const mt = globalThis.__mainI18nMt || ((key, d) => d || key)
    installAppMenu({ Menu, app, platform: process.platform, mt })
  } catch (err) {
    console.warn('[main] failed to install app menu:', err.message)
  }

  // 安装媒体权限处理器（麦克风/摄像头）
  try {
    const { session } = require('electron')
    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
      if (permission === 'media') {
        // 只允许麦克风（audio），拒绝摄像头
        const details = arguments[3] || {}
        const mediaTypes = Array.isArray(details.mediaTypes) ? details.mediaTypes : []
        const wantsAudio = mediaTypes.length === 0 || mediaTypes.includes('audio')
        // 只给可信的 webContents 授权
        const trusted = webContents.getURL().startsWith('http://localhost:') ||
          webContents.getURL().startsWith('file://')
        callback(Boolean(wantsAudio && trusted))
        return
      }
      callback(false)
    })

    session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
      if (permission !== 'media') return false
      const trusted = webContents.getURL().startsWith('http://localhost:') ||
        webContents.getURL().startsWith('file://')
      return Boolean(trusted)
    })
    console.log('[main] media permission handler installed')
  } catch (err) {
    console.warn('[main] failed to install media permission handler:', err.message)
  }

  if (isWizardCompleted()) {
    createMainWindow()
    // 标记 GPU 启动完成
    try {
      const hanakoHome = process.env.OPENSHADOW_HOME || join(process.cwd(), '.openshadow')
      markGpuStartupReady({ hanakoHome, phase: 'main-window-created' })
    } catch {}
    // 初始化 Auto Updater（需要在 mainWindow 创建后）
    const hanakoHome = process.env.OPENSHADOW_HOME || join(process.cwd(), '.openshadow')
    initAutoUpdater(mainWindow, { hanakoHome })
    checkForUpdatesAuto()
    // 初始化 Quick Chat 全局快捷键
    initQuickChat()
    // 初始化通知控制器
    try {
      const { createNotificationController } = require('./notification-controller.cjs')
      const notificationController = createNotificationController({
        app,
        Notification,
        systemPreferences,
        wrapIpcHandler,
        getMainWindow: () => mainWindow,
      })
      notificationController.register()
      console.log('[main] notification controller registered')
    } catch (err) {
      console.warn('[main] failed to init notification controller:', err.message)
    }
    // ⚠️ 即使 wizard 已标记 completed（旧版可能残留 completed:true 但 server 没真正拿到配置），
    // 也把 config.json 的 providers/models 推送给 server，确保主窗口模型可用。
    pushWizardConfigToServer().catch(e => console.warn('[main] startup config push failed:', e.message))
  } else {
    console.log('[main] waiting for wizard to complete…')
    await runWizardWindow()
  }
  // ⚠️ done-signal 必须【始终】注册：旧版把 wizard.completed 写进 config.json 后，
  // 若结构判断走到「已完成」分支会跳过注册，导致向导「启动」按钮点了无反应、
  // 看门狗 10s 后复位（保存中 → 回到启动）。这里无条件注册，保证任何情况下都能关闭向导并开主窗口。
  wrapIpcOn('wizard:done-signal', async () => {
      console.log('[main] wizard done')
      wizardCompleting = true
      suppressWindowAllClosed = true   // 防止 wizard 关闭后 app.quit()
      if (wizardWindow) wizardWindow.close()
      wizardWindow = null
      // 推送 config（providers/models）→ server，确保模型生效（逻辑已抽到 pushWizardConfigToServer）
      try {
        await pushWizardConfigToServer()
      } catch (e) {
        console.warn('[main] PUT /api/config error:', e.message)
      }
      // 现在 server 已有 providers，可以安全开主窗口
      try {
        createMainWindow()
      } catch (e) {
        console.error('[main] createMainWindow failed after wizard:', e.message)
      } finally {
        suppressWindowAllClosed = false   // 恢复正常退出行为
      }
      // 标记 GPU 启动完成
      try {
        const hanakoHome = process.env.OPENSHADOW_HOME || join(process.cwd(), '.openshadow')
        markGpuStartupReady({ hanakoHome, phase: 'main-window-created' })
      } catch {}
      // 初始化 Auto Updater
      const hanakoHome = process.env.OPENSHADOW_HOME || join(process.cwd(), '.openshadow')
      initAutoUpdater(mainWindow, { hanakoHome })
      checkForUpdatesAuto()
      // 初始化 Quick Chat 全局快捷键
      initQuickChat()
    })
})

app.on('window-all-closed', () => {
  // wizard→main 切换期间不退出
  if (suppressWindowAllClosed) return
  // 有托盘时保持常驻（macOS 通过 dock 重新打开，Windows 通过托盘双击）
  // 托盘不存在时直接退出，避免幽灵进程
  if (!trayIcon) {
    app.quit()
  }
})

// ─── Tray 图标 ───────────────────────────────────────
let trayIcon = null

function createTray() {
  if (trayIcon) return
  try {
    const { nativeImage } = require('electron')
    const trayIconPath = join(__dirname, 'src', 'assets', 'rem-avatar.png')
    const icon = nativeImage.createFromPath(trayIconPath)
    icon.resize({ width: 16, height: 16 })
    trayIcon = new Tray(icon)
    const contextMenu = TrayMenu.buildFromTemplate([
      {
        label: '显示主窗口',
        click: () => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.show()
            mainWindow.focus()
          }
        },
      },
      {
        label: '设置',
        click: () => {
          const win = createSettingsWindow({
            mainWindow,
            preloadPath: join(__dirname, 'preload.bundle.cjs'),
            iconPath: APP_ICON_PATH,
            isDev,
            viteDevUrl: VITE_DEV_URL,
          })
          if (win) win.show()
        },
      },
      {
        label: '重启服务',
        click: () => {
          void serverManager.restart('tray-menu')
        },
      },
      { type: 'separator' },
      {
        label: '退出',
        click: () => {
          app.quit()
        },
      },
    ])
    trayIcon.setToolTip('OpenShadow')
    trayIcon.setContextMenu(contextMenu)
    trayIcon.on('click', () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        if (mainWindow.isVisible()) {
          mainWindow.hide()
        } else {
          mainWindow.show()
          mainWindow.focus()
        }
      }
    })
    console.log('[main] tray icon created')
  } catch (err) {
    console.error('[main] failed to create tray icon:', err.message)
  }
}

function destroyTray() {
  if (trayIcon) {
    trayIcon.destroy()
    trayIcon = null
  }
}

// ─── 全局快捷键（唤醒窗口）─────────────────────────────────────
function registerGlobalShortcut() {
  // 默认 Alt+Space 唤醒（用户可在设置里改）
  const shortcut = 'Alt+Space'
  const success = globalShortcut.register(shortcut, () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isVisible()) {
        mainWindow.hide()
      } else {
        mainWindow.show()
        mainWindow.focus()
      }
    }
  })
  if (success) {
    console.log('[main] global shortcut registered:', shortcut)
  } else {
    console.warn('[main] failed to register global shortcut:', shortcut)
  }
}

function unregisterGlobalShortcut() {
  globalShortcut.unregisterAll()
}

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    if (isWizardCompleted()) {
      createMainWindow()
    } else {
      runWizardWindow()
    }
  }
})

// ─── 优雅关闭 ───────────────────────────────────
app.on('before-quit', async (event) => {
  console.log('[main] before-quit')
  // 阻止默认退出，等 server 关闭后再退出
  event.preventDefault()
  destroyTray()
  unregisterGlobalShortcut()
  if (wakeLockId !== null && powerSaveBlocker.isStarted(wakeLockId)) {
    powerSaveBlocker.stop(wakeLockId)
    wakeLockId = null
  }

  // ─── 清理 Browser Agent 和 Editor Controller ─────
  try {
    if (browserAgent && browserAgent.shutdown) {
      browserAgent.shutdown()
      console.log('[main] browser agent shutdown complete')
    }
  } catch (err) {
    console.warn('[main] browser agent shutdown error:', err.message)
  }
  try {
    if (editorController && editorController.destroy) {
      editorController.destroy()
      console.log('[main] editor controller destroyed')
    }
  } catch (err) {
    console.warn('[main] editor controller destroy error:', err.message)
  }

  // 优雅关闭 server
  serverManager.setIsQuitting(true)
  await serverManager.shutdown()
  // 关闭完成后真正退出
  app.exit(0)
})

// ─── Crash Log 写入 ───────────────────────────────────
function writeCrashLog(err) {
  try {
    const logPath = join(process.cwd(), 'crash.log')
    const timestamp = new Date().toISOString()
    const entry = `[${timestamp}] ${err.message || err}\n${err.stack || ''}\n\n`
    appendFileSync(logPath, entry, 'utf-8')
    console.log('[main] crash log written to', logPath)
  } catch {}
}

// ─── 全局错误兜底 ───────────────────────────────────
process.on('uncaughtException', (err) => {
  if (err.code === 'EPIPE' || err.code === 'ERR_IPC_CHANNEL_CLOSED') return
  const traceId = Math.random().toString(16).slice(2, 10)
  console.error(`[ErrorBus][${err.code || 'UNKNOWN'}][${traceId}] uncaughtException: ${err.message}`)
  console.error(`[ErrorBus][${traceId}] ${err.stack || err.message}`)
  writeCrashLog(err)
})

process.on('unhandledRejection', (reason) => {
  const err = reason instanceof Error ? reason : new Error(String(reason))
  const traceId = Math.random().toString(16).slice(2, 10)
  console.error(`[ErrorBus][${err.code || 'UNKNOWN'}][${traceId}] unhandledRejection: ${err.message}`)
  console.error(`[ErrorBus][${traceId}] ${err.stack || err.message}`)
  writeCrashLog(err)
})


// ─── Splash 启动窗口 ─────────────────────────────────────
// 启动时显示的启动画面（暂时用简单实现，后续可换完整 HTML）
let splashWindow = null

function createSplashWindow() {
  if (splashWindow) return splashWindow
  try {
    splashWindow = new BrowserWindow({
      width: 400,
      height: 250,
      frame: false,
      alwaysOnTop: true,
      center: true,
      skipTaskbar: true,
      resizable: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
      },
      backgroundColor: '#F8F5ED',
      show: false,
      ...windowIconOpts(),
    })
    // 简单的 splash HTML
    const splashHtml = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>OpenShadow</title></head>
<body style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;background:#F8F5ED;font-family:sans-serif;">
  <h2 style="color:#333;margin-bottom:8px;">OpenShadow</h2>
  <p style="color:#666;margin:0;">正在启动...</p>
</body>
</html>`
    splashWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(splashHtml))
    splashWindow.once('ready-to-show', () => {
      splashWindow.show()
    })
    splashWindow.once('closed', () => {
      splashWindow = null
    })
    console.log('[main] splash window created')
  } catch (err) {
    console.warn('[main] failed to create splash window:', err.message)
  }
  return splashWindow
}

function destroySplashWindow() {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.close()
    splashWindow = null
  }
}

// ─── Quick Chat 全局悬浮小窗 ─────────────────────────────────────
// 全局快捷键唤醒的快捷对话窗口（compact 模式 / chat 模式）
let quickChatWindow = null
let quickChatMode = 'compact'
let registeredQuickChatShortcut = null

const QUICK_CHAT_STATE_PATH = join(
  process.env.OPENSHADOW_HOME || join(process.env.APPDATA || process.env.HOME || '', '.openshadow'),
  'user', 'quick-chat-window-state.json'
)

function loadQuickChatWindowState() {
  try {
    return JSON.parse(readFileSync(QUICK_CHAT_STATE_PATH, 'utf-8'))
  } catch {
    return null
  }
}

function saveQuickChatWindowState() {
  if (!quickChatWindow || quickChatWindow.isDestroyed()) return
  try {
    const bounds = quickChatWindow.getBounds()
    const state = { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height, mode: quickChatMode }
    mkdirSync(join(QUICK_CHAT_STATE_PATH, '..'), { recursive: true })
    writeFileSync(QUICK_CHAT_STATE_PATH, JSON.stringify(state, null, 2), 'utf-8')
  } catch {}
}

function getQuickChatBounds() {
  const state = loadQuickChatWindowState()
  const { screen } = require('electron')
  const primary = screen.getPrimaryDisplay().workAreaSize
  const width = 420
  const height = quickChatMode === 'chat' ? 600 : 120
  const x = state?.x ?? Math.round((primary.width - width) / 2)
  const y = state?.y ?? Math.round((primary.height - height) - 40)
  return { x, y, width, height }
}

function createQuickChatWindow() {
  if (quickChatWindow && !quickChatWindow.isDestroyed()) return quickChatWindow
  const bounds = getQuickChatBounds()
  quickChatWindow = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    minWidth: 320,
    minHeight: 80,
    maxWidth: quickChatMode === 'compact' ? 520 : undefined,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: quickChatMode === 'chat',
    show: false,
    webPreferences: {
      preload: join(__dirname, 'preload.bundle.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
    ...windowIconOpts(),
  })

  // 加载 quick-chat.html
  if (isDev) {
    quickChatWindow.loadURL(VITE_DEV_URL.replace(/\/?$/, '') + '/quick-chat.html').catch(err => {
      console.error('[quick-chat] failed to load dev URL:', err.message)
    })
  } else {
    const htmlPath = join(__dirname, 'dist-renderer', 'quick-chat.html')
    quickChatWindow.loadFile(htmlPath).catch(err => {
      console.error('[quick-chat] failed to load file:', err.message)
    })
  }

  quickChatWindow.once('ready-to-show', () => {
    if (quickChatWindow && !quickChatWindow.isDestroyed()) {
      quickChatWindow.show()
    }
  })

  quickChatWindow.on('closed', () => {
    quickChatWindow = null
  })

  // 失去焦点时隐藏（可选，注释掉则不会自动隐藏）
  // quickChatWindow.on('blur', () => {
  //   if (quickChatWindow && !quickChatWindow.isDestroyed()) {
  //     hideQuickChatWindow()
  //   }
  // })

  console.log('[main] quick chat window created, mode=', quickChatMode)
  return quickChatWindow
}

function showQuickChatWindow() {
  const win = createQuickChatWindow()
  if (win && !win.isVisible()) {
    win.show()
    win.focus()
  } else if (win && win.isVisible() && !win.isFocused()) {
    win.focus()
  }
}

function hideQuickChatWindow() {
  if (quickChatWindow && !quickChatWindow.isDestroyed()) {
    saveQuickChatWindowState()
    quickChatWindow.hide()
  }
}

function toggleQuickChatWindow() {
  if (quickChatWindow && !quickChatWindow.isDestroyed() && quickChatWindow.isVisible()) {
    if (quickChatWindow.isFocused()) {
      hideQuickChatWindow()
    } else {
      quickChatWindow.focus()
    }
  } else {
    showQuickChatWindow()
  }
}

function registerQuickChatShortcut(shortcut) {
  shortcut = shortcut || 'Alt+Space'
  if (registeredQuickChatShortcut) {
    globalShortcut.unregister(registeredQuickChatShortcut)
    registeredQuickChatShortcut = null
  }
  const ok = globalShortcut.register(shortcut, toggleQuickChatWindow)
  if (ok) {
    registeredQuickChatShortcut = shortcut
    console.log('[quick-chat] global shortcut registered:', shortcut)
  } else {
    console.warn('[quick-chat] failed to register shortcut:', shortcut)
  }
}

// 在 app.whenReady() 之后调用（需要 mainWindow 存在）
function initQuickChat() {
  // 从配置读取快捷键（默认 Alt+Space）
  try {
    const cfg = readConfig()
    const shortcut = cfg?.quickChat?.shortcut || 'Alt+Space'
    registerQuickChatShortcut(shortcut)
  } catch {
    registerQuickChatShortcut('Alt+Space')
  }
}

// ─── 主进程 i18n（占位，后续实现）───────────────────────────────
// 主进程中的国际化支持（当前仅英文/中文，后续扩展）
const MAIN_PROCESS_LOCALE = 'zh-CN' // 可从配置读取

function t(mainKey, locale) {
  locale = locale || MAIN_PROCESS_LOCALE
  const dict = {
    'zh-CN': {
      'app.name': 'OpenShadow',
      'app.quitting': '正在退出...',
      'app.server-crashed': '服务器崩溃',
      'app.server-start-failed': '服务器启动失败',
      'tray.show': '显示主窗口',
      'tray.settings': '设置',
      'tray.quit': '退出',
    },
    'en': {
      'app.name': 'OpenShadow',
      'app.quitting': 'Quitting...',
      'app.server-crashed': 'Server Crashed',
      'app.server-start-failed': 'Server start failed',
      'tray.show': 'Show Main Window',
      'tray.settings': 'Settings',
      'tray.quit': 'Quit',
    },
  }
  return (dict[locale] && dict[locale][mainKey]) || mainKey
}

console.log('Electron starting...')

// Exported for unit testing
module.exports = { registerIpcHandlers, isWizardCompleted, readConfig, setWakeLock, createSplashWindow, destroySplashWindow, t }

