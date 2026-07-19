"use strict";
const require$$0 = require("electron");
const require$$1 = require("url");
function getDefaultExportFromCjs(x) {
  return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, "default") ? x["default"] : x;
}
var preload$1 = {};
var hasRequiredPreload;
function requirePreload() {
  if (hasRequiredPreload) return preload$1;
  hasRequiredPreload = 1;
  const { contextBridge, ipcRenderer, shell } = require$$0;
  const { pathToFileURL } = require$$1;
  const platformApi = {
    // 服务器连接 — 从主进程读取真实 port/token（server-info.json），不再硬编码 3000
    // 主进程 server-manager 启动真实 server 后写入 server-info.json 并发送 server:ready 事件
    getServerPort: async () => {
      try {
        const info = await ipcRenderer.invoke("server:get-info");
        return info?.port ?? null;
      } catch {
        return null;
      }
    },
    getServerToken: async () => {
      try {
        const info = await ipcRenderer.invoke("server:get-info");
        return info?.token ?? null;
      } catch {
        return null;
      }
    },
    // 桥接主进程发来的 server:ready 事件（preload.bundle.cjs 之前缺失此桥接，导致渲染进程永远收不到就绪信号）
    onServerReady: (callback) => {
      const handler = (_event, data) => callback(data);
      ipcRenderer.on("server:ready", handler);
      return () => {
        ipcRenderer.removeListener("server:ready", handler);
      };
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
    getPlatform: async () => process.platform,
    // 设置通信 → 通知 main 进程（主题、语言等）
    settingsChanged: (type, data) => ipcRenderer.send("settings-changed", type, data),
    onSettingsChanged: (callback) => {
      const handler = (_event, type, data) => callback(type, data);
      ipcRenderer.on("settings-changed", handler);
      return () => {
        ipcRenderer.removeListener("settings-changed", handler);
      };
    },
    // ─── Onboarding（React 向导）桥接 ───────────────────────
    // 向导完成：主进程标记 wizard.completed 并打开主窗口
    onboardingComplete: () => ipcRenderer.invoke("onboarding-complete"),
    // 欢迎页预填：语言 / 助手名
    getSplashInfo: () => ipcRenderer.invoke("get-splash-info"),
    // 欢迎页头像本地路径（agent 角色）
    getAvatarPath: (role) => ipcRenderer.invoke("get-avatar-path", role),
    // 本地文件路径 → file:// URL（OnboardingApp 用 window.platform.getFileUrl 显示头像）
    getFileUrl: (filePath) => {
      try {
        return pathToFileURL(filePath).toString();
      } catch {
        return "";
      }
    },
    // ─── 应用版本 ────────────────────────────────────────────
    getAppVersion: () => ipcRenderer.invoke("app:get-version"),
    // ─── 自动更新（electron-updater 桥接）────────────────────
    autoUpdateCheck: () => ipcRenderer.invoke("auto-update-check"),
    autoUpdateInstall: () => ipcRenderer.invoke("auto-update-install"),
    autoUpdateState: () => ipcRenderer.invoke("auto-update-state"),
    autoUpdateSetChannel: (channel) => ipcRenderer.invoke("auto-update-set-channel", channel),
    onAutoUpdateState: (callback) => {
      const handler = (_event, state) => callback(state);
      ipcRenderer.on("auto-update-state", handler);
      return () => {
        ipcRenderer.removeListener("auto-update-state", handler);
      };
    },
    // ─── 一键反馈/报错导出（diagnostics-export.cjs）─────────
    exportDiagnostics: () => ipcRenderer.invoke("diagnostics:export")
  };
  contextBridge.exposeInMainWorld("shadow", platformApi);
  contextBridge.exposeInMainWorld("platform", platformApi);
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
