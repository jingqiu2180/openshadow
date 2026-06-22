// @ts-nocheck
/**
 * Preload script for the Rem main window.
 * Exposes safe IPC bridges to the renderer via contextBridge.
 *
 * Bridges exposed on window.__REM_API__:
 *   - screenshotCapture(displayId?) → ScreenshotOutput
 *   - screenshotCaptureWindow(windowId?) → ScreenshotOutput
 *   - browserCreate(url?) → { id, url, title }
 *   - browserNavigate(url) → { url, title }
 *   - browserScreenshot() → { base64, width, height }
 *   - browserClick(selector) → { selector }
 *   - browserType(selector, text) → { text }
 *   - browserPressKey(key) → {}
 *   - browserGetText(selector) → { text }
 *   - browserGetHtml() → { html }
 *   - browserWaitFor(selector, timeout?) → {}
 *   - browserClose() → {}
 *   - onBrowserCommand(callback) → unsubscribe fn
 *   - sendBrowserResponse(response) → void
 *   - isElectron: true
 *   - platform: string
 */

const { contextBridge, ipcRenderer } = require('electron')

// 构建 platform API 对象（兼容 platform.js 的检查）
const platformApi = {
  // 服务器连接
  getServerPort: async () => 3000,
  getServerToken: async () => null,
  onServerRestarted: (callback: (data: { port: number; token?: string | null }) => void) => {
    ipcRenderer.on('server-restarted', (_event: any, data: any) => callback(data))
    return () => { ipcRenderer.removeListener('server-restarted', callback as any) }
  },
  appReady: async () => {},

  // 文件 I/O
  readFile: (p: string) => ipcRenderer.invoke('fs:read', p),
  writeFile: (p: string, content: string) => ipcRenderer.invoke('fs:write', p, content),
  selectFolder: async () => ipcRenderer.invoke('dialog:selectFolder'),
  selectFiles: async () => ipcRenderer.invoke('dialog:selectFiles'),

  // OS 集成
  openExternal: (url: string) => { try { require('electron').shell.openExternal(url) } catch {} },

  // 窗口控制
  windowMinimize: () => ipcRenderer.send('window:minimize'),
  windowMaximize: () => ipcRenderer.send('window:maximize'),
  windowClose: () => ipcRenderer.send('window:close'),
  windowIsMaximized: () => ipcRenderer.invoke('window:is-maximized'),
  onMaximizeChange: (callback) => {
    const handler = (_event, isMax) => callback(isMax)
    ipcRenderer.on('window:maximize-change', handler)
    return () => { ipcRenderer.removeListener('window:maximize-change', handler) }
  },
  getPlatform: async () => process.platform,
}

// 注入 window.hana（兼容 platform.js）
contextBridge.exposeInMainWorld('hana', platformApi)

// 注入 window.__REM_API__（现有功能）
contextBridge.exposeInMainWorld('__REM_API__', {
  // ─── Screenshot ──────────────────────────────────────────────────────
  screenshotCapture: (displayId?: number) => ipcRenderer.invoke('screenshot:capture', displayId),
  screenshotCaptureWindow: (windowId?: number) => ipcRenderer.invoke('screenshot:capture-window', windowId),

  // ─── Browser (webview) ───────────────────────────────────────────────
  browserCreate: (url?: string) => ipcRenderer.invoke('browser:create', url),
  browserNavigate: (url: string) => ipcRenderer.invoke('browser:navigate', url),
  browserScreenshot: () => ipcRenderer.invoke('browser:screenshot'),
  browserClick: (selector: string) => ipcRenderer.invoke('browser:click', selector),
  browserType: (selector: string, text: string) => ipcRenderer.invoke('browser:type', selector, text),
  browserPressKey: (key: string) => ipcRenderer.invoke('browser:press-key', key),
  browserGetText: (selector: string) => ipcRenderer.invoke('browser:get-text', selector),
  browserGetHtml: () => ipcRenderer.invoke('browser:get-html'),
  browserWaitFor: (selector: string, timeout?: number) => ipcRenderer.invoke('browser:wait-for', selector, timeout),
  browserClose: () => ipcRenderer.invoke('browser:close'),

  // ─── Browser command channel (main → renderer for webview control) ───
  onBrowserCommand: (callback: (cmd: any) => void) => {
    const handler = (_event: any, cmd: any) => callback(cmd)
    ipcRenderer.on('browser:command', handler)
    return () => { ipcRenderer.removeListener('browser:command', handler) }
  },
  sendBrowserResponse: (response: any) => ipcRenderer.send('browser:response', response),

  // ─── Meta ────────────────────────────────────────────────────────────
  isElectron: true,
  platform: process.platform,
})

// Also set a flag that core code can check without going through the API object.
;(window as any).__ELECTRON__ = true
