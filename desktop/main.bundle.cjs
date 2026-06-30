"use strict";
const require$$0 = require("electron");
const require$$1 = require("path");
const require$$2 = require("fs");
function getDefaultExportFromCjs(x) {
  return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, "default") ? x["default"] : x;
}
var main$1;
var hasRequiredMain;
function requireMain() {
  if (hasRequiredMain) return main$1;
  hasRequiredMain = 1;
  const { app, BrowserWindow, desktopCapturer, dialog, ipcMain, Menu } = require$$0;
  const { join, dirname } = require$$1;
  const { readFileSync, writeFileSync, existsSync, mkdirSync } = require$$2;
  const isDev = !app.isPackaged;
  const VITE_DEV_URL = process.env.VITE_DEV_URL || "http://localhost:5280";
  const APP_ICON_PATH = join(__dirname, "assets", "rem-avatar.png");
  if (process.platform === "win32") {
    app.setAppUserModelId("com.openshadow.app");
  }
  app.commandLine.appendSwitch("high-dpi-support", "1");
  function windowIconOpts() {
    if (process.platform === "win32") {
      return { icon: APP_ICON_PATH };
    }
    return {};
  }
  function framelessWindowOpts() {
    return { frame: false, ...windowIconOpts() };
  }
  function titleBarOpts(trafficLight) {
    trafficLight = trafficLight || { x: 16, y: 16 };
    if (process.platform === "darwin") {
      return {
        titleBarStyle: "hiddenInset",
        trafficLightPosition: trafficLight
      };
    }
    return framelessWindowOpts();
  }
  const CONFIG_PATH = join(process.cwd(), "config.json");
  function readConfig() {
    if (!existsSync(CONFIG_PATH)) return { version: "0.1.0" };
    try {
      return JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
    } catch {
      return { version: "0.1.0" };
    }
  }
  function writeConfig(cfg) {
    mkdirSync(join(CONFIG_PATH, ".."), { recursive: true });
    writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), "utf-8");
  }
  function isWizardCompleted() {
    return readConfig().wizard && readConfig().wizard.completed === true;
  }
  const BUILTIN_PROVIDERS = {
    openai: {
      type: "openai",
      label: "OpenAI",
      baseUrl: "https://api.openai.com/v1",
      models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "o1-mini"],
      requiresApiKey: true
    },
    anthropic: {
      type: "openai",
      label: "Anthropic (compatible)",
      baseUrl: "https://api.anthropic.com/v1",
      models: ["claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022"],
      requiresApiKey: true
    },
    minimax: {
      type: "openai",
      label: "MiniMax",
      baseUrl: "https://api.minimax.chat/v1",
      models: ["abab6.5s-chat", "abab6.5g-chat", "abab6.5t-chat"],
      requiresApiKey: true
    },
    dashscope: {
      type: "openai",
      label: "阿里云 DashScope (Qwen)",
      baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      models: ["qwen-plus", "qwen-turbo", "qwen-max", "qwen-vl-plus"],
      requiresApiKey: true
    },
    deepseek: {
      type: "openai",
      label: "DeepSeek",
      baseUrl: "https://api.deepseek.com/v1",
      models: ["deepseek-chat", "deepseek-coder", "deepseek-reasoner"],
      requiresApiKey: true
    },
    gemini: {
      type: "gemini",
      label: "Google Gemini",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta",
      models: ["gemini-2.0-flash-exp", "gemini-1.5-pro", "gemini-1.5-flash"],
      requiresApiKey: true
    },
    ollama: {
      type: "ollama",
      label: "Ollama (local)",
      baseUrl: "http://localhost:11434/v1",
      models: ["llama3.1", "qwen2.5", "mistral", "codellama"],
      requiresApiKey: false,
      notes: "本地运行,无需 API Key"
    }
  };
  async function testOpenAICompatible(baseUrl, apiKey, model) {
    const start = Date.now();
    try {
      const res = await fetch(baseUrl.replace(/\/+$/, "") + "/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...apiKey ? { Authorization: "Bearer " + apiKey } : {}
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: "hi" }],
          max_tokens: 1,
          stream: false
        })
      });
      const latencyMs = Date.now() - start;
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        return { ok: false, latencyMs, modelUsed: model, error: res.status + " " + res.statusText + ": " + errText.slice(0, 200) };
      }
      return { ok: true, latencyMs, modelUsed: model };
    } catch (e) {
      return { ok: false, latencyMs: Date.now() - start, modelUsed: model, error: e.message };
    }
  }
  let mainWindow = null;
  let wizardWindow = null;
  async function runWizardWindow() {
    if (isWizardCompleted()) return;
    const preloadPath = app.isPackaged ? join(dirname(app.getAppPath()), "app.asar.unpacked", "desktop", "wizard", "preload.js") : join(app.getAppPath(), "desktop", "wizard", "preload.js");
    console.log("[wizard] preload path:", preloadPath, "| exists:", existsSync(preloadPath));
    wizardWindow = new BrowserWindow({
      width: 760,
      height: 640,
      minWidth: 640,
      minHeight: 520,
      title: "OpenShadow 启动向导",
      resizable: false,
      minimizable: false,
      maximizable: false,
      webPreferences: {
        preload: preloadPath,
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
        webSecurity: false
      },
      backgroundColor: "#faf8f5",
      show: false
    });
    wizardWindow.once("ready-to-show", () => {
      wizardWindow && wizardWindow.show();
      console.log("[wizard] window shown");
    });
    const htmlPath = app.isPackaged ? join(app.getAppPath(), "wizard", "index.html") : join(__dirname, "wizard", "index.html");
    console.log("[wizard] html path:", htmlPath);
    await wizardWindow.loadFile(htmlPath);
    console.log("[wizard] loaded HTML from", htmlPath);
    wizardWindow.on("close", (e) => {
      if (!isWizardCompleted()) {
        const choice = dialog.showMessageBoxSync(wizardWindow, {
          type: "question",
          buttons: ["继续设置", "退出"],
          defaultId: 0,
          cancelId: 1,
          title: "OpenShadow 还没配置完",
          message: "OpenShadow 还没配置完,现在退出将无法使用。确定要退出吗?"
        });
        if (choice === 1) {
          app.quit();
        } else {
          e.preventDefault();
        }
      } else {
        wizardWindow = null;
      }
    });
  }
  function registerIpcHandlers() {
    ipcMain.handle("wizard:get-config", () => {
      const cfg = readConfig();
      return {
        providers: cfg.providers || [],
        user: { name: cfg.user && cfg.user.name || "王帅" },
        ui: { language: cfg.ui && cfg.ui.language || "zh-CN" },
        theme: cfg.theme || "warm-paper",
        security: { workspaceRoots: cfg.security && cfg.security.workspaceRoots || [] },
        builtins: BUILTIN_PROVIDERS
      };
    });
    ipcMain.handle("wizard:save-config", (_e, payload) => {
      console.log("[wizard] save-config called");
      try {
        const cfg = readConfig();
        const merged = Object.assign({}, cfg, payload);
        if (payload.security && payload.security.workspaceRoots) {
          merged.security = Object.assign({}, cfg.security || {}, { workspaceRoots: payload.security.workspaceRoots });
        }
        writeConfig(merged);
        console.log("[wizard] config saved to", CONFIG_PATH);
        return { ok: true };
      } catch (e) {
        console.error("[wizard] save-config error:", e.message);
        return { ok: false, error: e.message };
      }
    });
    ipcMain.handle("wizard:test-connection", async (_e, providerInput) => {
      const spec = BUILTIN_PROVIDERS[providerInput.id];
      if (!spec) return { ok: false, error: "Unknown provider: " + providerInput.id };
      const model = providerInput.model || spec.models[0];
      const result = await testOpenAICompatible(spec.baseUrl, providerInput.apiKey, model);
      return { ok: result.ok, latencyMs: result.latencyMs, error: result.error, modelUsed: result.modelUsed };
    });
    ipcMain.handle("wizard:pick-folder", async () => {
      const { canceled, filePaths } = await dialog.showOpenDialog({
        title: "选择 OpenShadow 的工作区目录",
        message: "请选择 OpenShadow 可以读写的目录(可多选)。这些目录拥有完整权限(读/写/删)。",
        properties: ["openDirectory", "multiSelections", "createDirectory"]
      });
      return canceled ? [] : filePaths;
    });
    ipcMain.handle("dialog:selectFolder", async (_e, opts) => {
      opts = opts || {};
      const properties = ["openDirectory"];
      if (opts.multi) properties.push("multiSelections");
      properties.push("createDirectory");
      const { canceled, filePaths } = await dialog.showOpenDialog({
        title: opts.title || "选择文件夹",
        message: opts.message || "请选择一个文件夹",
        properties
      });
      return canceled ? null : filePaths[0] || null;
    });
    ipcMain.handle("dialog:selectFiles", async (_e, opts) => {
      opts = opts || {};
      const properties = ["openFile"];
      if (opts.multi) properties.push("multiSelections");
      const { canceled, filePaths } = await dialog.showOpenDialog({
        title: opts.title || "选择文件",
        properties,
        filters: opts.filters || []
      });
      return canceled ? [] : filePaths;
    });
    ipcMain.handle("screenshot:capture", async (_e, displayId) => {
      try {
        const targetDisplay = displayId !== void 0 ? displayId : 0;
        const sources = await desktopCapturer.getSources({
          types: ["screen"],
          thumbnailSize: { width: 1920, height: 1080 },
          fetchWindowIcons: false
        });
        const source = sources[targetDisplay] || sources[0];
        if (!source) {
          return { success: false, error: "No screen source found (requested index " + targetDisplay + ", available " + sources.length + ")" };
        }
        const thumbnail = source.thumbnail;
        const size = thumbnail.getSize();
        const base64 = thumbnail.toPNG().toString("base64");
        return {
          success: true,
          base64,
          path: "",
          width: size.width,
          height: size.height,
          platform: process.platform
        };
      } catch (e) {
        return { success: false, error: "desktopCapturer failed: " + e.message };
      }
    });
    ipcMain.handle("screenshot:capture-window", async (_e, windowId) => {
      try {
        const win = windowId ? BrowserWindow.getAllWindows().find((w) => w.id === windowId) : mainWindow;
        if (!win || win.isDestroyed()) {
          return { success: false, error: "Target window not found" };
        }
        const image = await win.webContents.capturePage();
        const size = image.getSize();
        const base64 = image.toPNG().toString("base64");
        return {
          success: true,
          base64,
          path: "",
          width: size.width,
          height: size.height,
          platform: process.platform
        };
      } catch (e) {
        return { success: false, error: "capturePage failed: " + e.message };
      }
    });
    const pendingBrowserResponses = /* @__PURE__ */ new Map();
    ipcMain.on("browser:response", (_event, response) => {
      const pending = pendingBrowserResponses.get(response.id);
      if (!pending) return;
      clearTimeout(pending.timer);
      pendingBrowserResponses.delete(response.id);
      if (response.success) {
        pending.resolve({ success: true, ...response.data });
      } else {
        pending.resolve({ success: false, error: response.error || "Unknown browser error" });
      }
    });
    function sendBrowserCommand(cmd, timeoutMs) {
      timeoutMs = timeoutMs || 3e4;
      return new Promise((resolve, reject) => {
        const id = "cmd-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
        const timer = setTimeout(() => {
          pendingBrowserResponses.delete(id);
          resolve({ success: false, error: "Browser command timed out: " + cmd.type });
        }, timeoutMs);
        pendingBrowserResponses.set(id, { resolve, reject, timer });
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("browser:command", Object.assign({ id }, cmd));
        } else {
          clearTimeout(timer);
          pendingBrowserResponses.delete(id);
          resolve({ success: false, error: "Main window not available" });
        }
      });
    }
    ipcMain.handle("browser:create", async (_e, url) => sendBrowserCommand({ type: "create", url: url || "about:blank" }));
    ipcMain.handle("browser:navigate", async (_e, url) => sendBrowserCommand({ type: "navigate", url }));
    ipcMain.handle("browser:screenshot", async () => sendBrowserCommand({ type: "screenshot" }));
    ipcMain.handle("browser:click", async (_e, selector) => sendBrowserCommand({ type: "click", selector }));
    ipcMain.handle("browser:type", async (_e, selector, text) => sendBrowserCommand({ type: "type", selector, text }));
    ipcMain.handle("browser:press-key", async (_e, key) => sendBrowserCommand({ type: "pressKey", key }));
    ipcMain.handle("browser:get-text", async (_e, selector) => sendBrowserCommand({ type: "getText", selector }));
    ipcMain.handle("browser:get-html", async () => sendBrowserCommand({ type: "getHtml" }));
    ipcMain.handle("browser:wait-for", async (_e, selector, timeout) => sendBrowserCommand({ type: "waitForSelector", selector, timeout: timeout || 1e4 }));
    ipcMain.handle("browser:close", async () => sendBrowserCommand({ type: "close" }));
    ipcMain.on("window:minimize", (event) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (win) win.minimize();
    });
    ipcMain.on("window:maximize", (event) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (!win) return;
      if (win.isMaximized()) {
        win.unmaximize();
      } else {
        win.maximize();
      }
    });
    ipcMain.on("window:close", (event) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (win) win.close();
    });
    ipcMain.handle("window:is-maximized", (event) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      return win ? win.isMaximized() : false;
    });
  }
  function createMainWindow() {
    mainWindow = new BrowserWindow({
      width: 1180,
      height: 760,
      minWidth: 900,
      minHeight: 600,
      title: "OpenShadow Agent",
      icon: APP_ICON_PATH,
      webPreferences: {
        preload: join(__dirname, "preload.bundle.cjs"),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
        webSecurity: false,
        webviewTag: true
      },
      ...titleBarOpts(),
      backgroundColor: "#faf8f5",
      show: false
    });
    mainWindow.once("ready-to-show", () => {
      if (mainWindow) mainWindow.show();
      console.log("Main window shown");
    });
    if (isDev) {
      console.log("Loading Vite dev server:", VITE_DEV_URL);
      mainWindow.loadURL(VITE_DEV_URL);
      mainWindow.webContents.openDevTools({ mode: "detach" });
    } else {
      const exePath = app.getAppPath();
      mainWindow.loadFile(join(exePath, "desktop", "dist-renderer", "index.html"));
    }
    mainWindow.on("closed", () => {
      mainWindow = null;
      if (process.platform !== "darwin") app.quit();
    });
    const broadcastMaximizeChange = () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("window:maximize-change", mainWindow.isMaximized());
      }
    };
    mainWindow.on("maximize", broadcastMaximizeChange);
    mainWindow.on("unmaximize", broadcastMaximizeChange);
    console.log("Main window created (dev=" + isDev + ")");
  }
  Menu.setApplicationMenu(null);
  app.whenReady().then(async () => {
    registerIpcHandlers();
    await runWizardWindow();
    if (isWizardCompleted()) {
      createMainWindow();
    } else {
      console.log("[main] waiting for wizard to complete…");
      ipcMain.on("wizard:done-signal", () => {
        console.log("[main] wizard done, opening main window");
        if (wizardWindow) wizardWindow.close();
        wizardWindow = null;
        createMainWindow();
      });
    }
  });
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      if (isWizardCompleted()) {
        createMainWindow();
      } else {
        runWizardWindow();
      }
    }
  });
  console.log("Electron starting...");
  main$1 = { registerIpcHandlers, isWizardCompleted, readConfig };
  return main$1;
}
var mainExports = requireMain();
const main = /* @__PURE__ */ getDefaultExportFromCjs(mainExports);
module.exports = main;
