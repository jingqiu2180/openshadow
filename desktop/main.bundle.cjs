"use strict";
const require$$0 = require("electron");
const require$$1 = require("path");
const require$$2 = require("fs");
function getDefaultExportFromCjs(x) {
  return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, "default") ? x["default"] : x;
}
function getAugmentedNamespace(n) {
  if (Object.prototype.hasOwnProperty.call(n, "__esModule")) return n;
  var f = n.default;
  if (typeof f == "function") {
    var a = function a2() {
      var isInstance = false;
      try {
        isInstance = this instanceof a2;
      } catch {
      }
      if (isInstance) {
        return Reflect.construct(f, arguments, this.constructor);
      }
      return f.apply(this, arguments);
    };
    a.prototype = f.prototype;
  } else a = {};
  Object.defineProperty(a, "__esModule", { value: true });
  Object.keys(n).forEach(function(k) {
    var d = Object.getOwnPropertyDescriptor(n, k);
    Object.defineProperty(a, k, d.get ? d : {
      enumerable: true,
      get: function() {
        return n[k];
      }
    });
  });
  return a;
}
const API_PROVIDER_PRESETS = [
  { value: "ollama", label: "Ollama (Local)", labelZh: "Ollama (本地)", url: "http://localhost:11434/v1", api: "openai-completions", local: true },
  { value: "dashscope", label: "DashScope (Qwen)", url: "https://dashscope.aliyuncs.com/compatible-mode/v1", api: "openai-completions" },
  { value: "openai", label: "OpenAI", url: "https://api.openai.com/v1", api: "openai-completions" },
  { value: "gemini", label: "Google Gemini", url: "https://generativelanguage.googleapis.com/v1beta", api: "google-generative-ai" },
  { value: "deepseek", label: "DeepSeek", url: "https://api.deepseek.com", api: "openai-completions" },
  { value: "volcengine", label: "Volcengine (Doubao)", labelZh: "Volcengine (豆包)", url: "https://ark.cn-beijing.volces.com/api/v3", api: "openai-completions" },
  { value: "moonshot", label: "Moonshot (Kimi)", url: "https://api.moonshot.cn/v1", api: "openai-completions" },
  { value: "kimi-coding", label: "Kimi Coding Plan", url: "https://api.kimi.com/coding/", api: "anthropic-messages" },
  { value: "zhipu", label: "Zhipu (GLM)", url: "https://open.bigmodel.cn/api/paas/v4", api: "openai-completions" },
  { value: "siliconflow", label: "SiliconFlow", url: "https://api.siliconflow.cn/v1", api: "openai-completions" },
  { value: "groq", label: "Groq", url: "https://api.groq.com/openai/v1", api: "openai-completions" },
  { value: "mistral", label: "Mistral", url: "https://api.mistral.ai/v1", api: "openai-completions" },
  { value: "minimax", label: "MiniMax", url: "https://api.minimaxi.com/anthropic", api: "anthropic-messages" },
  { value: "minimax-token-plan", label: "MiniMax Token Plan", url: "https://api.minimaxi.com/anthropic", api: "anthropic-messages" },
  { value: "openrouter", label: "OpenRouter", url: "https://openrouter.ai/api/v1", api: "openai-completions" },
  { value: "mimo", label: "Xiaomi (MiMo)", url: "https://api.xiaomimimo.com/v1", api: "openai-completions" },
  { value: "mimo-token-plan", label: "Xiaomi MiMo Token Plan", url: "https://token-plan-cn.xiaomimimo.com/v1", api: "openai-completions" }
];
function currentLocale() {
  return typeof window === "undefined" ? void 0 : window.i18n?.locale;
}
function getProviderPresetLabel(preset, locale = currentLocale()) {
  return locale?.startsWith("zh") && preset.labelZh ? preset.labelZh : preset.label;
}
const providerPresets = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  API_PROVIDER_PRESETS,
  getProviderPresetLabel
}, Symbol.toStringTag, { value: "Module" }));
const require$$3 = /* @__PURE__ */ getAugmentedNamespace(providerPresets);
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
  const { API_PROVIDER_PRESETS: API_PROVIDER_PRESETS2 } = require$$3;
  const PROVIDER_MODELS = {
    openai: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "o1-mini", "o3-mini"],
    anthropic: ["claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022", "claude-sonnet-4-20250514"],
    minimax: ["abab6.5s-chat", "abab6.5g-chat", "abab6.5t-chat"],
    "minimax-token-plan": ["MiniMax-M3"],
    dashscope: ["qwen-plus", "qwen-turbo", "qwen-max", "qwen-vl-plus", "qwen3-235b-a22b"],
    deepseek: ["deepseek-chat", "deepseek-reasoner"],
    zhipu: ["glm-4-plus", "glm-4-flash", "glm-4-air", "glm-4-airx"],
    moonshot: ["moonshot-v1-8k", "moonshot-v1-32k", "moonshot-v1-128k"],
    "kimi-coding": ["kimi-coding"],
    volcengine: ["doubao-pro-32k", "doubao-lite-32k", "deepseek-r1-2501", "deepseek-v3-250324"],
    siliconflow: ["Qwen/Qwen2.5-7B-Instruct", "deepseek-ai/DeepSeek-V2.5", "Pro/Qwen/Qwen2.5-7B-Instruct"],
    gemini: ["gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash"],
    groq: ["llama-3.3-70b-versatile", "mixtral-8x7b-32768", "qwen-2.5-32b"],
    mistral: ["mistral-large-latest", "mistral-small-latest", "codestral-latest"],
    openrouter: [],
    ollama: [],
    mimo: ["mimo-chat"],
    "mimo-token-plan": ["mimo-chat"]
  };
  const API_TO_TYPE = {
    "openai-completions": "openai",
    "anthropic-messages": "anthropic",
    "google-generative-ai": "gemini"
  };
  const BUILTIN_PROVIDERS = {};
  for (const p of API_PROVIDER_PRESETS2) {
    BUILTIN_PROVIDERS[p.value] = {
      type: API_TO_TYPE[p.api] || "openai",
      label: p.labelZh || p.label,
      baseUrl: p.url,
      models: PROVIDER_MODELS[p.value] || [],
      requiresApiKey: !p.local,
      ...p.local ? { notes: "本地运行，无需 API Key" } : {}
    };
  }
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
  async function testAnthropicCompatible(baseUrl, apiKey, model) {
    const start = Date.now();
    try {
      const res = await fetch(baseUrl.replace(/\/+$/, "") + "/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model,
          max_tokens: 1,
          messages: [{ role: "user", content: "hi" }]
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
    const htmlPath = app.isPackaged ? join(app.getAppPath(), "desktop", "wizard", "index.html") : join(__dirname, "wizard", "index.html");
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
        if (merged.providers && Array.isArray(merged.providers)) {
          for (const p of merged.providers) {
            if (!p.baseUrl && BUILTIN_PROVIDERS[p.id]) {
              p.baseUrl = BUILTIN_PROVIDERS[p.id].baseUrl;
            }
          }
        }
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
      let result;
      if (spec.type === "anthropic") {
        result = await testAnthropicCompatible(spec.baseUrl, providerInput.apiKey, model);
      } else if (spec.type === "gemini") {
        result = { ok: false, error: "Gemini 测试暂未支持" };
      } else {
        result = await testOpenAICompatible(spec.baseUrl, providerInput.apiKey, model);
      }
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
