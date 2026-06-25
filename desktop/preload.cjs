// desktop/preload.cjs
// Preload script for the Rem main window (CJS).
// Exposes safe IPC bridges to the renderer via contextBridge.
//
// Bridges exposed on window.hana and window.__REM_API__:
//   - screenshotCapture / screenshotCaptureWindow
//   - browserCreate / browserNavigate / browserScreenshot / etc.
//   - selectFolder / selectFiles / readFile / writeFile
//   - windowMinimize / windowMaximize / windowClose

const { contextBridge, ipcRenderer, shell } = require('electron')

// platform API (兼容 platform.js 的检查)
const platformApi = {
  // 服务器连接
  getServerPort: async () => 3000,
  getServerToken: async () => null,
  onServerRestarted: (callback) => {
    const handler = (_event, data) => callback(data)
    ipcRenderer.on('server-restarted', handler)
    return () => { ipcRenderer.removeListener('server-restarted', handler) }
  },
  appReady: async () => {},

  // 文件 I/O
  readFile: (p) => ipcRenderer.invoke('fs:read', p),
  writeFile: (p, content) => ipcRenderer.invoke('fs:write', p, content),
  selectFolder: async () => ipcRenderer.invoke('dialog:selectFolder'),
  selectFiles: async () => ipcRenderer.invoke('dialog:selectFiles'),

  // OS 集成
  openExternal: (url) => { try { shell.openExternal(url) } catch {} },

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

// 注入 window.__REM_API__
contextBridge.exposeInMainWorld('__REM_API__', {
  // Screenshot
  screenshotCapture: (displayId) => ipcRenderer.invoke('screenshot:capture', displayId),
  screenshotCaptureWindow: (windowId) => ipcRenderer.invoke('screenshot:capture-window', windowId),

  // Browser (webview)
  browserCreate: (url) => ipcRenderer.invoke('browser:create', url),
  browserNavigate: (url) => ipcRenderer.invoke('browser:navigate', url),
  browserScreenshot: () => ipcRenderer.invoke('browser:screenshot'),
  browserClick: (selector) => ipcRenderer.invoke('browser:click', selector),
  browserType: (selector, text) => ipcRenderer.invoke('browser:type', selector, text),
  browserPressKey: (key) => ipcRenderer.invoke('browser:press-key', key),
  browserGetText: (selector) => ipcRenderer.invoke('browser:get-text', selector),
  browserGetHtml: () => ipcRenderer.invoke('browser:get-html'),
  browserWaitFor: (selector, timeout) => ipcRenderer.invoke('browser:wait-for', selector, timeout),
  browserClose: () => ipcRenderer.invoke('browser:close'),

  // Browser command channel (main → renderer for webview control)
  onBrowserCommand: (callback) => {
    const handler = (_event, cmd) => callback(cmd)
    ipcRenderer.on('browser:command', handler)
    return () => { ipcRenderer.removeListener('browser:command', handler) }
  },
  sendBrowserResponse: (response) => ipcRenderer.send('browser:response', response),

  // Meta
  isElectron: true,
  platform: process.platform,
})

// Flag for core code to detect Electron without going through the API object
contextBridge.exposeInMainWorld('__ELECTRON__', true)
