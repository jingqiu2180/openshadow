// @ts-nocheck
/**
 * Preload script for the OpenShadow main window.
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
const { contextBridge, ipcRenderer } = require('electron');
// 构建 platform API 对象（兼容 platform.js 的检查）
const platformApi = {
    // 服务器连接
    getServerPort: async () => 3000,
    getServerToken: async () => null,
    onServerRestarted: (callback) => {
        ipcRenderer.on('server-restarted', (_event, data) => callback(data));
        return () => { ipcRenderer.removeListener('server-restarted', callback); };
    },
    appReady: async () => { },
    // 文件 I/O
    readFile: (p) => ipcRenderer.invoke('fs:read', p),
    writeFile: (p, content) => ipcRenderer.invoke('fs:write', p, content),
    selectFolder: async () => ipcRenderer.invoke('dialog:selectFolder'),
    selectFiles: async () => ipcRenderer.invoke('dialog:selectFiles'),
    // OS 集成
    openExternal: (url) => { try {
        require('electron').shell.openExternal(url);
    }
    catch { } },
    // 窗口控制
    windowMinimize: () => ipcRenderer.send('window:minimize'),
    windowMaximize: () => ipcRenderer.send('window:maximize'),
    windowClose: () => ipcRenderer.send('window:close'),
    getPlatform: async () => process.platform,
};
// 注入 window.openshadow（兼容 platform.js）
contextBridge.exposeInMainWorld('openshadow', platformApi);
// 注入 window.__REM_API__（现有功能）
contextBridge.exposeInMainWorld('__REM_API__', {
    // ─── Screenshot ──────────────────────────────────────────────────────
    screenshotCapture: (displayId) => ipcRenderer.invoke('screenshot:capture', displayId),
    screenshotCaptureWindow: (windowId) => ipcRenderer.invoke('screenshot:capture-window', windowId),
    // ─── Browser (webview) ───────────────────────────────────────────────
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
    // ─── Browser command channel (main → renderer for webview control) ───
    onBrowserCommand: (callback) => {
        const handler = (_event, cmd) => callback(cmd);
        ipcRenderer.on('browser:command', handler);
        return () => { ipcRenderer.removeListener('browser:command', handler); };
    },
    sendBrowserResponse: (response) => ipcRenderer.send('browser:response', response),
    // ─── Meta ────────────────────────────────────────────────────────────
    isElectron: true,
    platform: process.platform,
});
window.__ELECTRON__ = true;
