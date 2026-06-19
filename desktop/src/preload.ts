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
