/**
 * platform.js — 平台适配层
 *
 * Electron 环境：直接转发给 preload 注入的 window.hana（IPC）
 * Web 环境：降级到 HTTP API + 浏览器原生 API
 *
 * 使用方式：所有前端代码调 platform.xxx()，不再直接碰 window.hana。
 */
(function () {
  // Electron 环境：检查 window.__REM_API__ 或 window.hana
  if (window.__REM_API__ || window.hana) {
    // 使用 Electron IPC 或默认配置
    const isElectron = window.__REM_API__?.isElectron || window.hana?.isElectron || true;
    const platform = window.__REM_API__?.platform || window.hana?.platform || 'win32';

    window.platform = {
      // 服务器连接（从 preload 注入的 window.hana 获取真实 port/token）
      getServerPort: async () => {
        try { return await window.hana?.getServerPort?.() || null; }
        catch { return null; }
      },
      getServerToken: async () => {
        try { return await window.hana?.getServerToken?.() || null; }
        catch { return null; }
      },
      onServerRestarted: (callback) => {
        // Electron IPC 监听服务器重启
        if (window.__REM_API__?.onServerRestarted) {
          return window.__REM_API__.onServerRestarted(callback);
        }
        return () => {};
      },
      onServerReady: (callback) => {
        // Electron IPC 监听服务器就绪
        if (window.__REM_API__?.onServerReady) {
          return window.__REM_API__.onServerReady(callback);
        }
        return () => {};
      },
      onSettingsChanged: (callback) => {
        if (window.__REM_API__?.onSettingsChanged) {
          return window.__REM_API__.onSettingsChanged(callback);
        }
        if (window.hana?.onSettingsChanged) {
          return window.hana.onSettingsChanged(callback);
        }
        return () => {};
      },
      settingsChanged: (type, data) => {
        try {
          if (typeof window.__REM_API__?.settingsChanged === 'function') {
            window.__REM_API__.settingsChanged(type, data);
            return;
          }
          if (typeof window.hana?.settingsChanged === 'function') {
            window.hana.settingsChanged(type, data);
          }
        } catch (e) {
          console.warn('[platform] settingsChanged failed:', e);
        }
      },
      onMenuAction: (callback) => {
        return () => {}; // no-op unsubscribe
      },
      appReady: async () => {},
      syncWindowTheme: () => {},
      runEditCommand: async () => false,

      // 文件 I/O
      readFile: (p) => fetch(`/api/fs/read?path=${encodeURIComponent(p)}`).then(r => r.ok ? r.text() : null),
      writeFile: async () => false,
      // openshadow 修复：转发到 preload 注入的 IPC（之前硬编码返回 null 导致选择文件夹按钮不可用）
      selectFolder: async () => {
        try {
          if (typeof window.__REM_API__?.selectFolder === 'function') {
            return await window.__REM_API__.selectFolder();
          }
          if (typeof window.hana?.selectFolder === 'function') {
            return await window.hana.selectFolder();
          }
          // 兼容旧版 hana.platform
          if (typeof window.hana?.platform?.selectFolder === 'function') {
            return await window.hana.platform.selectFolder();
          }
          return null;
        } catch (e) {
          console.warn('[platform] selectFolder failed:', e);
          return null;
        }
      },
      selectFiles: async () => {
        try {
          if (typeof window.__REM_API__?.selectFiles === 'function') {
            return await window.__REM_API__.selectFiles();
          }
          if (typeof window.hana?.selectFiles === 'function') {
            return await window.hana.selectFiles();
          }
          if (typeof window.hana?.platform?.selectFiles === 'function') {
            return await window.hana.platform.selectFiles();
          }
          return [];
        } catch (e) {
          console.warn('[platform] selectFiles failed:', e);
          return [];
        }
      },

      // OS 集成
      openExternal: (url) => { try { window.open(url, "_blank"); } catch {} },

      // 窗口控制 — 转发到 window.hana（preload 注入的 IPC 桥接）
      windowMinimize: () => { try { window.hana?.windowMinimize?.(); } catch {} },
      windowMaximize: () => { try { window.hana?.windowMaximize?.(); } catch {} },
      windowClose: () => { try { window.hana?.windowClose?.(); } catch {} },
      windowIsMaximized: async () => {
        try { return await window.hana?.windowIsMaximized?.() ?? false; } catch (e) { return false; }
      },
      onMaximizeChange: (callback) => {
        try {
          const unsub = window.hana?.onMaximizeChange?.(callback);
          return unsub ?? (() => {});
        } catch (e) { return () => {}; }
      },
      getPlatform: async () => platform,
    };
    return;
  }

  // Web / 非 Electron 环境 — HTTP fallback
  const params = new URLSearchParams(location.search);
  const devWeb = normalizeDevWebConfig(window.__HANA_DEV_WEB__);
  const token = params.get("token") || localStorage.getItem("hana-token") || "";
  const baseUrl = devWeb.apiBaseUrl || `${location.protocol}//${location.host}`;
  const serverPort = devWeb.serverPort || safePortFromBaseUrl(baseUrl) || location.port || "3000";

  function normalizeDevWebConfig(value) {
    if (!value || typeof value !== "object") {
      return { serverPort: "", apiBaseUrl: "" };
    }
    const serverPort = typeof value.serverPort === "number" || typeof value.serverPort === "string"
      ? String(value.serverPort).trim()
      : "";
    const apiBaseUrl = typeof value.apiBaseUrl === "string"
      ? value.apiBaseUrl.replace(/\/+$/, "")
      : "";
    return { serverPort, apiBaseUrl };
  }

  function safePortFromBaseUrl(value) {
    try {
      return new URL(value).port;
    } catch {
      return "";
    }
  }

  function apiFetch(path, opts = {}) {
    const headers = { ...opts.headers };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return fetch(`${baseUrl}${path}`, { ...opts, headers });
  }

  window.platform = {
    // 服务器连接
    getServerPort: async () => serverPort,
    getServerToken: async () => token,
    onServerRestarted: (callback) => {
      // Web 环境不支持服务器重启事件，返回 no-op unsubscribe
      return () => {};
    },
    onMenuAction: (callback) => {
      return () => {}; // Web 无原生菜单
    },
    appReady: async () => {},
    syncWindowTheme: () => {},
    runEditCommand: async () => false,

    // 文件 I/O → server HTTP
    readFile: (p) => apiFetch(`/api/fs/read?path=${encodeURIComponent(p)}`).then(r => r.ok ? r.text() : null),
    readFileSnapshot: async () => null,
    readFileBase64: (p) => apiFetch(`/api/fs/read-base64?path=${encodeURIComponent(p)}`).then(r => r.ok ? r.text() : null),
    readDocxHtml: (p) => apiFetch(`/api/fs/docx-html?path=${encodeURIComponent(p)}`).then(r => r.ok ? r.text() : null),
    readXlsxHtml: (p) => apiFetch(`/api/fs/xlsx-html?path=${encodeURIComponent(p)}`).then(r => r.ok ? r.text() : null),

    // 文件写入 / 监听 / 派生 viewer 窗口 → Web 不支持
    writeFile: async () => false,
    writeFileBinary: async () => false,
    copyFile: async () => false,
    writeFileIfUnchanged: async () => ({ ok: false }),
    watchFile: async () => false,
    unwatchFile: async () => false,
    onFileChanged: () => {},
    watchWorkspace: async () => false,
    unwatchWorkspace: async () => false,
    onWorkspaceChanged: () => {},
    spawnViewer: async () => null,
    onViewerLoad: () => {},
    viewerClose: () => {},
    onViewerClosed: () => {},

    // 文件路径（Web 不支持系统路径）
    getFilePath: () => null,
    getAvatarPath: () => null,
    getSplashInfo: async () => ({}),

    // 系统对话框 → Web 降级
    selectFolder: async () => null,
    selectFiles: async () => [],
    selectSkill: async () => null,
    selectPlugin: async () => null,

    // OS 集成 → 静默降级
    openFolder: () => {},
    openFile: () => {},
    openExternal: (url) => { try { window.open(url, "_blank"); } catch {} },
    showInFinder: () => {},
    startDrag: () => {},

    // 窗口管理 → 单页降级
    openSettings: () => {},
    reloadMainWindow: () => location.reload(),

    // 设置通信 → Web 环境暂不支持跨窗口
    settingsChanged: () => {},
    onSettingsChanged: () => {},
    onOpenSettingsModal: () => {},

    // 浏览器查看器 → Web 环境暂不支持
    openBrowserViewer: () => {},
    closeBrowserViewer: () => {},
    onBrowserUpdate: () => {},
    browserGoBack: () => {},
    browserGoForward: () => {},
    browserReload: () => {},
    browserNewTab: () => {},
    browserSwitchTab: () => {},
    browserCloseTab: () => {},
    browserEmergencyStop: () => {},

    // Skill 查看器 → Web 环境暂不支持
    openSkillViewer: () => {},
    listSkillFiles: async () => [],
    readSkillFile: async () => null,
    onSkillViewerLoad: () => {},
    closeSkillViewer: () => {},

    // Onboarding
    onboardingComplete: async () => {},
    debugOpenOnboarding: async () => {},
    debugOpenOnboardingPreview: async () => {},

    // 窗口控制（Web 不需要）
    getPlatform: async () => "web",
    windowMinimize: () => {},
    windowMaximize: () => {},
    windowClose: () => {},
    windowIsMaximized: async () => false,
    onMaximizeChange: () => {},
  };
})();

// ── 平台检测 ──
(async function initPlatform() {
  const p = window.platform;
  if (!p?.getPlatform) return;
  const plat = await p.getPlatform();
  document.documentElement.setAttribute("data-platform", plat);
  // Windows/Linux 窗口控制按钮已迁移到 React (App.tsx WindowControls)
})();
