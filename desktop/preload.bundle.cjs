"use strict";
const require$$0 = require("electron");
function getDefaultExportFromCjs(x) {
  return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, "default") ? x["default"] : x;
}
var preload$1 = {};
var hasRequiredPreload;
function requirePreload() {
  if (hasRequiredPreload) return preload$1;
  hasRequiredPreload = 1;
  const { contextBridge, ipcRenderer, shell } = require$$0;
  const platformApi = {
    // 服务器连接（通过 IPC 从主进程获取真实端口和 token）
    getServerPort: async () => {
      try { const info = await ipcRenderer.invoke("server:get-info"); return info?.port || null; }
      catch { return null; }
    },
    getServerToken: async () => {
      try { const info = await ipcRenderer.invoke("server:get-info"); return info?.token || null; }
      catch { return null; }
    },
    onServerRestarted: (callback) => {
      const handler = (_event, data) => callback(data);
      ipcRenderer.on("server-restarted", handler);
      return () => {
        ipcRenderer.removeListener("server-restarted", handler);
      };
    },
    appReady: async () => {
    },
    // 文件 I/O
    readFile: (p) => ipcRenderer.invoke("fs:read", p),
    writeFile: (p, content) => ipcRenderer.invoke("fs:write", p, content),
    selectFolder: async () => ipcRenderer.invoke("dialog:selectFolder"),
    selectFiles: async () => ipcRenderer.invoke("dialog:selectFiles"),
    // OS 集成
    openExternal: (url) => {
      try {
        shell.openExternal(url);
      } catch {
      }
    },
    // 窗口控制
    windowMinimize: () => ipcRenderer.send("window:minimize"),
    windowMaximize: () => ipcRenderer.send("window:maximize"),
    windowClose: () => ipcRenderer.send("window:close"),
    windowIsMaximized: () => ipcRenderer.invoke("window:is-maximized"),
    onMaximizeChange: (callback) => {
      const handler = (_event, isMax) => callback(isMax);
      ipcRenderer.on("window:maximize-change", handler);
      return () => {
        ipcRenderer.removeListener("window:maximize-change", handler);
      };
    },
    getPlatform: async () => process.platform
  };
  contextBridge.exposeInMainWorld("hana", platformApi);
  contextBridge.exposeInMainWorld("__REM_API__", {
    // Screenshot
    screenshotCapture: (displayId) => ipcRenderer.invoke("screenshot:capture", displayId),
    screenshotCaptureWindow: (windowId) => ipcRenderer.invoke("screenshot:capture-window", windowId),
    // Browser (webview)
    browserCreate: (url) => ipcRenderer.invoke("browser:create", url),
    browserNavigate: (url) => ipcRenderer.invoke("browser:navigate", url),
    browserScreenshot: () => ipcRenderer.invoke("browser:screenshot"),
    browserClick: (selector) => ipcRenderer.invoke("browser:click", selector),
    browserType: (selector, text) => ipcRenderer.invoke("browser:type", selector, text),
    browserPressKey: (key) => ipcRenderer.invoke("browser:press-key", key),
    browserGetText: (selector) => ipcRenderer.invoke("browser:get-text", selector),
    browserGetHtml: () => ipcRenderer.invoke("browser:get-html"),
    browserWaitFor: (selector, timeout) => ipcRenderer.invoke("browser:wait-for", selector, timeout),
    browserClose: () => ipcRenderer.invoke("browser:close"),
    // Browser command channel (main → renderer for webview control)
    onBrowserCommand: (callback) => {
      const handler = (_event, cmd) => callback(cmd);
      ipcRenderer.on("browser:command", handler);
      return () => {
        ipcRenderer.removeListener("browser:command", handler);
      };
    },
    sendBrowserResponse: (response) => ipcRenderer.send("browser:response", response),
    // Meta
    isElectron: true,
    platform: process.platform
  });
  contextBridge.exposeInMainWorld("__ELECTRON__", true);
  return preload$1;
}
var preloadExports = requirePreload();
const preload = /* @__PURE__ */ getDefaultExportFromCjs(preloadExports);
module.exports = preload;
