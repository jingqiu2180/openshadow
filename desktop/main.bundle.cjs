"use strict";
const require$$1 = require("electron");
const require$$1$2 = require("path");
const require$$2 = require("fs");
const require$$1$1 = require("child_process");
const require$$3 = require("os");
const require$$0 = require("constants");
const require$$0$1 = require("stream");
const require$$4 = require("util");
const require$$5$1 = require("assert");
const require$$0$2 = require("events");
const require$$0$3 = require("crypto");
const require$$1$3 = require("tty");
const require$$2$1 = require("url");
const require$$14 = require("zlib");
const require$$4$1 = require("http");
const node_events = require("node:events");
const node_fs = require("node:fs");
const promises = require("node:fs/promises");
const sp = require("node:path");
const node_stream = require("node:stream");
const node_os = require("node:os");
function _interopNamespaceDefault(e) {
  const n = Object.create(null, { [Symbol.toStringTag]: { value: "Module" } });
  if (e) {
    for (const k in e) {
      if (k !== "default") {
        const d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: () => e[k]
        });
      }
    }
  }
  n.default = e;
  return Object.freeze(n);
}
const sp__namespace = /* @__PURE__ */ _interopNamespaceDefault(sp);
var commonjsGlobal = typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : {};
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
var themeController;
var hasRequiredThemeController;
function requireThemeController() {
  if (hasRequiredThemeController) return themeController;
  hasRequiredThemeController = 1;
  const THEME_BG = {
    "warm-paper": "#F8F5ED",
    "midnight": "#2D4356",
    "high-contrast": "#FAF9F6",
    "grass-aroma": "#F5F8F3",
    "contemplation": "#F3F5F7",
    "deep-think": "#1A1A1A",
    "absolutely": "#FFFFFF",
    "delve": "#262624",
    "new-warm-paper": "#FAF7F0"
  };
  function bgFor(themeName) {
    return THEME_BG[themeName] || "#F8F5ED";
  }
  function createThemeController({ BrowserWindow, nativeTheme, getMainWindow, getSettingsWindow, getBrowserViewer }) {
    let currentTheme = "warm-paper";
    function resolveAuto() {
      return nativeTheme?.shouldUseDarkColors ? "midnight" : "warm-paper";
    }
    function applyToWindow(win, themeName) {
      if (!win || win.isDestroyed()) return;
      win.setBackgroundColor(bgFor(themeName));
    }
    function applyToAll(themeName) {
      const resolved = themeName === "auto" ? resolveAuto() : themeName;
      currentTheme = resolved;
      const wins = [getMainWindow && getMainWindow(), getSettingsWindow && getSettingsWindow()];
      for (const w of wins) applyToWindow(w, resolved);
      const viewer = getBrowserViewer && getBrowserViewer();
      if (viewer && typeof viewer.setTheme === "function") viewer.setTheme(resolved);
    }
    function getTheme() {
      return currentTheme;
    }
    function attachIpc({ ipcMain, wrapIpcOn }) {
      wrapIpcOn("settings-changed", (_event, type, data) => {
        if (type === "theme-changed" && data && data.theme) {
          applyToAll(data.theme);
        }
      });
    }
    return {
      applyToAll,
      applyToWindow,
      getTheme,
      bgFor,
      attachIpc
    };
  }
  themeController = { createThemeController, THEME_BG, bgFor };
  return themeController;
}
var ipcWrapper;
var hasRequiredIpcWrapper;
function requireIpcWrapper() {
  if (hasRequiredIpcWrapper) return ipcWrapper;
  hasRequiredIpcWrapper = 1;
  const { ipcMain } = require$$1;
  let senderValidator = null;
  function setIpcSenderValidator(validator) {
    senderValidator = typeof validator === "function" ? validator : null;
  }
  function isSenderAllowed(channel, event) {
    if (!senderValidator) return true;
    try {
      return senderValidator(channel, event) !== false;
    } catch (err) {
      console.error(`[IPC][${channel}] sender validator failed: ${err?.message || err}`);
      return false;
    }
  }
  function wrapIpcHandler(channel, handler) {
    ipcMain.handle(channel, async (event, ...args) => {
      if (!isSenderAllowed(channel, event)) {
        console.warn(`[IPC][${channel}] rejected untrusted sender`);
        return void 0;
      }
      try {
        return await handler(event, ...args);
      } catch (err) {
        const traceId = Math.random().toString(16).slice(2, 10);
        console.error(`[IPC][${channel}][${traceId}] ${err?.message || err}`);
        console.error(`[IPC][${traceId}] ${err?.stack || ""}`);
        return void 0;
      }
    });
  }
  function wrapIpcOn(channel, handler) {
    ipcMain.on(channel, (event, ...args) => {
      if (!isSenderAllowed(channel, event)) {
        console.warn(`[IPC][${channel}] rejected untrusted sender`);
        return;
      }
      try {
        const result = handler(event, ...args);
        if (result && typeof result.catch === "function") {
          result.catch((err) => {
            console.error(`[IPC][${channel}] async: ${err?.message || err}`);
          });
        }
      } catch (err) {
        console.error(`[IPC][${channel}] ${err?.message || err}`);
      }
    });
  }
  ipcWrapper = { setIpcSenderValidator, wrapIpcHandler, wrapIpcOn };
  return ipcWrapper;
}
var serverManager;
var hasRequiredServerManager;
function requireServerManager() {
  if (hasRequiredServerManager) return serverManager;
  hasRequiredServerManager = 1;
  const fs2 = require$$2;
  const path = require$$1$2;
  const { spawn } = require$$1$1;
  const SERVER_HEARTBEAT_INTERVAL_MS = 1e4;
  const SERVER_HEARTBEAT_TIMEOUT_MS = 5e3;
  const SERVER_HEARTBEAT_MAX_FAILURES = 3;
  const SERVER_STARTUP_TIMEOUT_MS = 9e4;
  function isPidAlive(pid) {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }
  function pollServerInfo(infoPath, { timeout = SERVER_STARTUP_TIMEOUT_MS, interval = 200, proc, logs } = {}) {
    return new Promise((resolve, reject) => {
      const deadline = Date.now() + timeout;
      let exited = false;
      function tailLogs(n) {
        if (!logs || logs.length === 0) return "";
        const tail = logs.slice(-20);
        return "\n[server stderr] " + tail.join("").replace(/\n/g, "\n[server stderr] ");
      }
      if (proc) {
        proc.on("exit", (code, signal) => {
          exited = true;
          const tail = tailLogs();
          reject(new Error(
            (signal ? `Server killed by signal ${signal}` : `Server exited with code ${code}`) + tail
          ));
        });
      }
      const check = () => {
        if (exited) return;
        if (Date.now() > deadline) {
          const tail = tailLogs();
          reject(new Error("Server start timed out after " + timeout / 1e3 + "s" + tail));
          return;
        }
        try {
          const info = JSON.parse(fs2.readFileSync(infoPath, "utf-8"));
          if (info.pid && isPidAlive(info.pid)) {
            resolve(info);
          } else {
            setTimeout(check, interval);
          }
        } catch {
          setTimeout(check, interval);
        }
      };
      check();
    });
  }
  function createServerManager(deps) {
    const {
      app,
      lynnHome,
      dirname,
      execPath,
      platform,
      env,
      resourcesPath,
      fetch: fetch2,
      onServerReady = () => {
      },
      onServerCrashed = () => {
      },
      onServerRestarted = () => {
      },
      writeCrashLog = () => {
      }
    } = deps;
    const state = {
      process: null,
      port: null,
      token: null,
      reusedPid: null,
      logs: [],
      startedAt: 0,
      restartAttempts: 0,
      heartbeatTimer: null,
      heartbeatFailures: 0,
      heartbeatChecking: false,
      heartbeatRestarting: false,
      isQuitting: false
    };
    function resolveServerLaunch() {
      const bundledServerDir = path.join(resourcesPath || "", "server");
      const bundledExe = path.join(bundledServerDir, "openshadow-server.exe");
      const bundledBootstrap = path.join(bundledServerDir, "bootstrap.js");
      const BUNDLED_JS_LEGACY = path.join(resourcesPath || "", "server-bundle", "index.js");
      const BUNDLED_JS = path.join(bundledServerDir, "bundle", "index.js");
      if (platform === "win32" && fs2.existsSync(bundledExe)) {
        const bootstrap = fs2.existsSync(bundledBootstrap) ? bundledBootstrap : path.join(bundledServerDir, "bundle", "index.js");
        return { mode: "bundled", serverBin: bundledExe, serverArgs: [bootstrap], env: {} };
      }
      if (fs2.existsSync(BUNDLED_JS)) {
        return {
          mode: "bundled",
          serverBin: execPath,
          serverArgs: [BUNDLED_JS],
          env: { ELECTRON_RUN_AS_NODE: "1" }
        };
      }
      if (fs2.existsSync(BUNDLED_JS_LEGACY)) {
        return {
          mode: "bundled",
          serverBin: execPath,
          serverArgs: [BUNDLED_JS_LEGACY],
          env: { ELECTRON_RUN_AS_NODE: "1" }
        };
      }
      const appRoot = path.join(dirname, "..");
      const bundledDevEntry = path.join(appRoot, "dist-server-bundle", "index.js");
      if (fs2.existsSync(bundledDevEntry)) {
        return {
          mode: "dev",
          serverBin: execPath,
          serverArgs: [bundledDevEntry],
          env: { ELECTRON_RUN_AS_NODE: "1" }
        };
      }
      return {
        mode: "dev",
        serverBin: execPath,
        serverArgs: [path.join(appRoot, "server", "index.js")],
        env: { ELECTRON_RUN_AS_NODE: "1" }
      };
    }
    async function start() {
      const serverInfoPath = path.join(lynnHome || path.join(require$$3.homedir(), ".openshadow"), "server-info.json");
      let existingInfo = null;
      try {
        existingInfo = JSON.parse(fs2.readFileSync(serverInfoPath, "utf-8"));
      } catch {
      }
      if (existingInfo && existingInfo.pid && isPidAlive(existingInfo.pid)) {
        try {
          const res = await fetch2(`http://127.0.0.1:${existingInfo.port}/api/health`, {
            headers: { Authorization: `Bearer ${existingInfo.token}` },
            signal: AbortSignal.timeout(2e3)
          });
          if (res.ok) {
            console.log(`[server] Reusing existing server on port ${existingInfo.port}`);
            state.port = existingInfo.port;
            state.token = existingInfo.token;
            state.reusedPid = existingInfo.pid;
            onServerReady({ port: state.port, token: state.token, reused: true });
            return;
          }
        } catch {
          console.log(`[server] Old server (PID ${existingInfo.pid}) not responding, killing...`);
          try {
            process.kill(existingInfo.pid, 0);
          } catch {
          }
          try {
            fs2.unlinkSync(serverInfoPath);
          } catch {
          }
        }
      }
      state.reusedPid = null;
      state.logs.length = 0;
      const shadowHome = lynnHome || path.join(require$$3.homedir(), ".openshadow");
      const serverEnv = {
        ...env,
        OPENSHADOW_HOME: shadowHome,
        SHADOW_HOME: shadowHome
        // P0: server 端读的是 SHADOW_HOME，必须同步设置
      };
      const launch = resolveServerLaunch();
      const serverBin = launch.serverBin;
      const serverArgs = launch.serverArgs;
      Object.assign(serverEnv, launch.env);
      try {
        fs2.unlinkSync(serverInfoPath);
      } catch {
      }
      console.log(`[server] Starting server: ${serverBin} ${serverArgs.join(" ")}`);
      console.log(`[server] SHADOW_HOME=${shadowHome}`);
      const proc = spawn(serverBin, serverArgs, {
        detached: true,
        windowsHide: true,
        env: serverEnv,
        stdio: ["pipe", "pipe", "pipe"]
      });
      state.process = proc;
      proc.on("error", (err) => {
        console.error(`[server] spawn error: ${err.message}`);
        state.logs.push("[stderr] spawn error: " + err.message);
      });
      proc.stdout?.on("data", (chunk) => {
        const text = chunk.toString();
        console.log(`[server] ${text.trim()}`);
        state.logs.push(text);
        if (state.logs.length > 500) state.logs.splice(0, state.logs.length - 500);
      });
      proc.stderr?.on("data", (chunk) => {
        const text = chunk.toString();
        console.error(`[server] ${text.trim()}`);
        state.logs.push("[stderr] " + text);
        if (state.logs.length > 500) state.logs.splice(0, state.logs.length - 500);
      });
      const info = await pollServerInfo(serverInfoPath, {
        timeout: SERVER_STARTUP_TIMEOUT_MS,
        proc,
        logs: state.logs
      });
      state.port = info.port;
      state.token = info.token;
      state.startedAt = Date.now();
      proc.unref();
      console.log(`[server] Server ready on port ${state.port}`);
      onServerReady({ port: state.port, token: state.token, reused: false });
    }
    function monitor() {
      if (!state.process) return;
      state.process.on("exit", async (code, signal) => {
        if (state.isQuitting) return;
        if (state.heartbeatRestarting) return;
        const reason = signal ? `signal ${signal}` : `code ${code}`;
        console.error(`[server] Server exited unexpectedly (${reason})`);
        if (state.restartAttempts < 1) {
          state.restartAttempts++;
          console.log("[server] Attempting auto-restart...");
          try {
            await start();
            console.log("[server] Server restarted successfully");
            monitor();
            onServerRestarted({ port: state.port, token: state.token });
          } catch (err) {
            console.error("[server] Server restart failed:", err.message);
            writeCrashLog(`Server restart failed: ${err.message}`);
            onServerCrashed(err);
          }
        } else {
          writeCrashLog(`Server crashed multiple times (${reason}), giving up`);
          onServerCrashed(new Error(`Server crashed: ${reason}`));
        }
      });
    }
    async function checkHeartbeat() {
      if (state.isQuitting || state.heartbeatRestarting || state.heartbeatChecking) return;
      if (!state.port || !state.token) return;
      if (state.startedAt && Date.now() - state.startedAt < 4 * 60 * 1e3) return;
      state.heartbeatChecking = true;
      try {
        const res = await fetch2(`http://127.0.0.1:${state.port}/api/health`, {
          headers: { Authorization: `Bearer ${state.token}` },
          signal: AbortSignal.timeout(SERVER_HEARTBEAT_TIMEOUT_MS)
        });
        if (res.ok) {
          state.heartbeatFailures = 0;
          return;
        }
        state.heartbeatFailures++;
      } catch {
        state.heartbeatFailures++;
      } finally {
        state.heartbeatChecking = false;
      }
      if (state.heartbeatFailures < SERVER_HEARTBEAT_MAX_FAILURES || state.heartbeatRestarting || state.isQuitting) return;
      state.heartbeatRestarting = true;
      console.warn("[server] Heartbeat failed multiple times, restarting...");
      try {
        state.heartbeatFailures = 0;
        await start();
        monitor();
        onServerRestarted({ port: state.port, token: state.token });
        console.log("[server] Server heartbeat restart succeeded");
      } catch (err) {
        console.error("[server] Server heartbeat restart failed:", err?.message || err);
        writeCrashLog(`Server heartbeat restart failed: ${err?.message || err}`);
      } finally {
        state.heartbeatRestarting = false;
      }
    }
    function startHeartbeat() {
      if (state.heartbeatTimer) clearInterval(state.heartbeatTimer);
      state.heartbeatTimer = setInterval(() => {
        void checkHeartbeat();
      }, SERVER_HEARTBEAT_INTERVAL_MS);
      if (typeof state.heartbeatTimer.unref === "function") {
        state.heartbeatTimer.unref();
      }
    }
    function stopHeartbeat() {
      if (state.heartbeatTimer) clearInterval(state.heartbeatTimer);
      state.heartbeatTimer = null;
      state.heartbeatFailures = 0;
      state.heartbeatChecking = false;
      state.heartbeatRestarting = false;
    }
    async function shutdown() {
      stopHeartbeat();
      state.isQuitting = true;
      if (state.process && !state.process.killed) {
        const proc = state.process;
        console.log("[server] Shutting down server...");
        if (state.port && state.token) {
          try {
            await fetch2(`http://127.0.0.1:${state.port}/api/shutdown`, {
              method: "POST",
              headers: { Authorization: `Bearer ${state.token}` },
              signal: AbortSignal.timeout(5e3)
            });
          } catch {
          }
        }
        await new Promise((resolve) => {
          const timeout = setTimeout(() => {
            try {
              if (!proc.killed) proc.kill();
            } catch {
            }
            resolve();
          }, 5e3);
          proc.on("exit", () => {
            clearTimeout(timeout);
            resolve();
          });
        });
        if (state.process === proc) state.process = null;
        return true;
      }
      if (state.reusedPid) {
        const pid = state.reusedPid;
        console.log(`[server] Shutting down reused server (PID ${pid})...`);
        try {
          if (state.port && state.token) {
            await fetch2(`http://127.0.0.1:${state.port}/api/shutdown`, {
              method: "POST",
              headers: { Authorization: `Bearer ${state.token}` },
              signal: AbortSignal.timeout(2e3)
            });
          }
        } catch {
          try {
            process.kill(pid, 0);
          } catch {
          }
        }
        state.reusedPid = null;
        return true;
      }
      return false;
    }
    return {
      start,
      monitor,
      startHeartbeat,
      stopHeartbeat,
      shutdown,
      getPort: () => state.port,
      getToken: () => state.token,
      getLogs: () => state.logs,
      hasServer: () => !!(state.process && !state.process.killed) || !!state.reusedPid,
      setIsQuitting: (v) => {
        state.isQuitting = v;
      }
    };
  }
  serverManager = {
    createServerManager,
    isPidAlive,
    pollServerInfo
  };
  return serverManager;
}
var settingsWindowController;
var hasRequiredSettingsWindowController;
function requireSettingsWindowController() {
  if (hasRequiredSettingsWindowController) return settingsWindowController;
  hasRequiredSettingsWindowController = 1;
  const { BrowserWindow } = require$$1;
  const { join } = require$$1$2;
  const { existsSync } = require$$2;
  let settingsWindow = null;
  function createSettingsWindow({ mainWindow, preloadPath, iconPath, isDev, viteDevUrl }) {
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.focus();
      return settingsWindow;
    }
    settingsWindow = new BrowserWindow({
      width: 900,
      height: 700,
      minWidth: 700,
      minHeight: 500,
      title: "OpenShadow 设置",
      icon: iconPath,
      show: false,
      minimizable: true,
      maximizable: true,
      webPreferences: {
        preload: preloadPath,
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
        webSecurity: false
      },
      parent: mainWindow,
      modal: false
    });
    settingsWindow.once("ready-to-show", () => {
      if (settingsWindow) {
        settingsWindow.show();
      }
    });
    if (isDev) {
      settingsWindow.loadURL(viteDevUrl + "/settings");
    } else {
      const htmlPath = join(process.cwd(), "desktop", "dist-renderer", "index.html");
      settingsWindow.loadFile(htmlPath, { hash: "settings" });
    }
    settingsWindow.on("closed", () => {
      settingsWindow = null;
    });
    return settingsWindow;
  }
  function getSettingsWindow() {
    return settingsWindow && !settingsWindow.isDestroyed() ? settingsWindow : null;
  }
  function closeSettingsWindow() {
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.close();
      settingsWindow = null;
    }
  }
  settingsWindowController = {
    createSettingsWindow,
    getSettingsWindow,
    closeSettingsWindow
  };
  return settingsWindowController;
}
var main$3 = {};
var fs = {};
var universalify = {};
var hasRequiredUniversalify;
function requireUniversalify() {
  if (hasRequiredUniversalify) return universalify;
  hasRequiredUniversalify = 1;
  universalify.fromCallback = function(fn) {
    return Object.defineProperty(function(...args) {
      if (typeof args[args.length - 1] === "function") fn.apply(this, args);
      else {
        return new Promise((resolve, reject) => {
          args.push((err, res) => err != null ? reject(err) : resolve(res));
          fn.apply(this, args);
        });
      }
    }, "name", { value: fn.name });
  };
  universalify.fromPromise = function(fn) {
    return Object.defineProperty(function(...args) {
      const cb = args[args.length - 1];
      if (typeof cb !== "function") return fn.apply(this, args);
      else {
        args.pop();
        fn.apply(this, args).then((r) => cb(null, r), cb);
      }
    }, "name", { value: fn.name });
  };
  return universalify;
}
var polyfills;
var hasRequiredPolyfills;
function requirePolyfills() {
  if (hasRequiredPolyfills) return polyfills;
  hasRequiredPolyfills = 1;
  var constants2 = require$$0;
  var origCwd = process.cwd;
  var cwd = null;
  var platform = process.env.GRACEFUL_FS_PLATFORM || process.platform;
  process.cwd = function() {
    if (!cwd)
      cwd = origCwd.call(process);
    return cwd;
  };
  try {
    process.cwd();
  } catch (er) {
  }
  if (typeof process.chdir === "function") {
    var chdir = process.chdir;
    process.chdir = function(d) {
      cwd = null;
      chdir.call(process, d);
    };
    if (Object.setPrototypeOf) Object.setPrototypeOf(process.chdir, chdir);
  }
  polyfills = patch;
  function patch(fs2) {
    if (constants2.hasOwnProperty("O_SYMLINK") && process.version.match(/^v0\.6\.[0-2]|^v0\.5\./)) {
      patchLchmod(fs2);
    }
    if (!fs2.lutimes) {
      patchLutimes(fs2);
    }
    fs2.chown = chownFix(fs2.chown);
    fs2.fchown = chownFix(fs2.fchown);
    fs2.lchown = chownFix(fs2.lchown);
    fs2.chmod = chmodFix(fs2.chmod);
    fs2.fchmod = chmodFix(fs2.fchmod);
    fs2.lchmod = chmodFix(fs2.lchmod);
    fs2.chownSync = chownFixSync(fs2.chownSync);
    fs2.fchownSync = chownFixSync(fs2.fchownSync);
    fs2.lchownSync = chownFixSync(fs2.lchownSync);
    fs2.chmodSync = chmodFixSync(fs2.chmodSync);
    fs2.fchmodSync = chmodFixSync(fs2.fchmodSync);
    fs2.lchmodSync = chmodFixSync(fs2.lchmodSync);
    fs2.stat = statFix(fs2.stat);
    fs2.fstat = statFix(fs2.fstat);
    fs2.lstat = statFix(fs2.lstat);
    fs2.statSync = statFixSync(fs2.statSync);
    fs2.fstatSync = statFixSync(fs2.fstatSync);
    fs2.lstatSync = statFixSync(fs2.lstatSync);
    if (fs2.chmod && !fs2.lchmod) {
      fs2.lchmod = function(path, mode, cb) {
        if (cb) process.nextTick(cb);
      };
      fs2.lchmodSync = function() {
      };
    }
    if (fs2.chown && !fs2.lchown) {
      fs2.lchown = function(path, uid, gid, cb) {
        if (cb) process.nextTick(cb);
      };
      fs2.lchownSync = function() {
      };
    }
    if (platform === "win32") {
      fs2.rename = typeof fs2.rename !== "function" ? fs2.rename : (function(fs$rename) {
        function rename(from, to, cb) {
          var start = Date.now();
          var backoff = 0;
          fs$rename(from, to, function CB(er) {
            if (er && (er.code === "EACCES" || er.code === "EPERM" || er.code === "EBUSY") && Date.now() - start < 6e4) {
              setTimeout(function() {
                fs2.stat(to, function(stater, st) {
                  if (stater && stater.code === "ENOENT")
                    fs$rename(from, to, CB);
                  else
                    cb(er);
                });
              }, backoff);
              if (backoff < 100)
                backoff += 10;
              return;
            }
            if (cb) cb(er);
          });
        }
        if (Object.setPrototypeOf) Object.setPrototypeOf(rename, fs$rename);
        return rename;
      })(fs2.rename);
    }
    fs2.read = typeof fs2.read !== "function" ? fs2.read : (function(fs$read) {
      function read(fd, buffer, offset, length, position, callback_) {
        var callback;
        if (callback_ && typeof callback_ === "function") {
          var eagCounter = 0;
          callback = function(er, _, __) {
            if (er && er.code === "EAGAIN" && eagCounter < 10) {
              eagCounter++;
              return fs$read.call(fs2, fd, buffer, offset, length, position, callback);
            }
            callback_.apply(this, arguments);
          };
        }
        return fs$read.call(fs2, fd, buffer, offset, length, position, callback);
      }
      if (Object.setPrototypeOf) Object.setPrototypeOf(read, fs$read);
      return read;
    })(fs2.read);
    fs2.readSync = typeof fs2.readSync !== "function" ? fs2.readSync : /* @__PURE__ */ (function(fs$readSync) {
      return function(fd, buffer, offset, length, position) {
        var eagCounter = 0;
        while (true) {
          try {
            return fs$readSync.call(fs2, fd, buffer, offset, length, position);
          } catch (er) {
            if (er.code === "EAGAIN" && eagCounter < 10) {
              eagCounter++;
              continue;
            }
            throw er;
          }
        }
      };
    })(fs2.readSync);
    function patchLchmod(fs3) {
      fs3.lchmod = function(path, mode, callback) {
        fs3.open(
          path,
          constants2.O_WRONLY | constants2.O_SYMLINK,
          mode,
          function(err, fd) {
            if (err) {
              if (callback) callback(err);
              return;
            }
            fs3.fchmod(fd, mode, function(err2) {
              fs3.close(fd, function(err22) {
                if (callback) callback(err2 || err22);
              });
            });
          }
        );
      };
      fs3.lchmodSync = function(path, mode) {
        var fd = fs3.openSync(path, constants2.O_WRONLY | constants2.O_SYMLINK, mode);
        var threw = true;
        var ret;
        try {
          ret = fs3.fchmodSync(fd, mode);
          threw = false;
        } finally {
          if (threw) {
            try {
              fs3.closeSync(fd);
            } catch (er) {
            }
          } else {
            fs3.closeSync(fd);
          }
        }
        return ret;
      };
    }
    function patchLutimes(fs3) {
      if (constants2.hasOwnProperty("O_SYMLINK") && fs3.futimes) {
        fs3.lutimes = function(path, at, mt, cb) {
          fs3.open(path, constants2.O_SYMLINK, function(er, fd) {
            if (er) {
              if (cb) cb(er);
              return;
            }
            fs3.futimes(fd, at, mt, function(er2) {
              fs3.close(fd, function(er22) {
                if (cb) cb(er2 || er22);
              });
            });
          });
        };
        fs3.lutimesSync = function(path, at, mt) {
          var fd = fs3.openSync(path, constants2.O_SYMLINK);
          var ret;
          var threw = true;
          try {
            ret = fs3.futimesSync(fd, at, mt);
            threw = false;
          } finally {
            if (threw) {
              try {
                fs3.closeSync(fd);
              } catch (er) {
              }
            } else {
              fs3.closeSync(fd);
            }
          }
          return ret;
        };
      } else if (fs3.futimes) {
        fs3.lutimes = function(_a, _b, _c, cb) {
          if (cb) process.nextTick(cb);
        };
        fs3.lutimesSync = function() {
        };
      }
    }
    function chmodFix(orig) {
      if (!orig) return orig;
      return function(target, mode, cb) {
        return orig.call(fs2, target, mode, function(er) {
          if (chownErOk(er)) er = null;
          if (cb) cb.apply(this, arguments);
        });
      };
    }
    function chmodFixSync(orig) {
      if (!orig) return orig;
      return function(target, mode) {
        try {
          return orig.call(fs2, target, mode);
        } catch (er) {
          if (!chownErOk(er)) throw er;
        }
      };
    }
    function chownFix(orig) {
      if (!orig) return orig;
      return function(target, uid, gid, cb) {
        return orig.call(fs2, target, uid, gid, function(er) {
          if (chownErOk(er)) er = null;
          if (cb) cb.apply(this, arguments);
        });
      };
    }
    function chownFixSync(orig) {
      if (!orig) return orig;
      return function(target, uid, gid) {
        try {
          return orig.call(fs2, target, uid, gid);
        } catch (er) {
          if (!chownErOk(er)) throw er;
        }
      };
    }
    function statFix(orig) {
      if (!orig) return orig;
      return function(target, options, cb) {
        if (typeof options === "function") {
          cb = options;
          options = null;
        }
        function callback(er, stats) {
          if (stats) {
            if (stats.uid < 0) stats.uid += 4294967296;
            if (stats.gid < 0) stats.gid += 4294967296;
          }
          if (cb) cb.apply(this, arguments);
        }
        return options ? orig.call(fs2, target, options, callback) : orig.call(fs2, target, callback);
      };
    }
    function statFixSync(orig) {
      if (!orig) return orig;
      return function(target, options) {
        var stats = options ? orig.call(fs2, target, options) : orig.call(fs2, target);
        if (stats) {
          if (stats.uid < 0) stats.uid += 4294967296;
          if (stats.gid < 0) stats.gid += 4294967296;
        }
        return stats;
      };
    }
    function chownErOk(er) {
      if (!er)
        return true;
      if (er.code === "ENOSYS")
        return true;
      var nonroot = !process.getuid || process.getuid() !== 0;
      if (nonroot) {
        if (er.code === "EINVAL" || er.code === "EPERM")
          return true;
      }
      return false;
    }
  }
  return polyfills;
}
var legacyStreams;
var hasRequiredLegacyStreams;
function requireLegacyStreams() {
  if (hasRequiredLegacyStreams) return legacyStreams;
  hasRequiredLegacyStreams = 1;
  var Stream = require$$0$1.Stream;
  legacyStreams = legacy;
  function legacy(fs2) {
    return {
      ReadStream,
      WriteStream
    };
    function ReadStream(path, options) {
      if (!(this instanceof ReadStream)) return new ReadStream(path, options);
      Stream.call(this);
      var self2 = this;
      this.path = path;
      this.fd = null;
      this.readable = true;
      this.paused = false;
      this.flags = "r";
      this.mode = 438;
      this.bufferSize = 64 * 1024;
      options = options || {};
      var keys = Object.keys(options);
      for (var index2 = 0, length = keys.length; index2 < length; index2++) {
        var key = keys[index2];
        this[key] = options[key];
      }
      if (this.encoding) this.setEncoding(this.encoding);
      if (this.start !== void 0) {
        if ("number" !== typeof this.start) {
          throw TypeError("start must be a Number");
        }
        if (this.end === void 0) {
          this.end = Infinity;
        } else if ("number" !== typeof this.end) {
          throw TypeError("end must be a Number");
        }
        if (this.start > this.end) {
          throw new Error("start must be <= end");
        }
        this.pos = this.start;
      }
      if (this.fd !== null) {
        process.nextTick(function() {
          self2._read();
        });
        return;
      }
      fs2.open(this.path, this.flags, this.mode, function(err, fd) {
        if (err) {
          self2.emit("error", err);
          self2.readable = false;
          return;
        }
        self2.fd = fd;
        self2.emit("open", fd);
        self2._read();
      });
    }
    function WriteStream(path, options) {
      if (!(this instanceof WriteStream)) return new WriteStream(path, options);
      Stream.call(this);
      this.path = path;
      this.fd = null;
      this.writable = true;
      this.flags = "w";
      this.encoding = "binary";
      this.mode = 438;
      this.bytesWritten = 0;
      options = options || {};
      var keys = Object.keys(options);
      for (var index2 = 0, length = keys.length; index2 < length; index2++) {
        var key = keys[index2];
        this[key] = options[key];
      }
      if (this.start !== void 0) {
        if ("number" !== typeof this.start) {
          throw TypeError("start must be a Number");
        }
        if (this.start < 0) {
          throw new Error("start must be >= zero");
        }
        this.pos = this.start;
      }
      this.busy = false;
      this._queue = [];
      if (this.fd === null) {
        this._open = fs2.open;
        this._queue.push([this._open, this.path, this.flags, this.mode, void 0]);
        this.flush();
      }
    }
  }
  return legacyStreams;
}
var clone_1;
var hasRequiredClone;
function requireClone() {
  if (hasRequiredClone) return clone_1;
  hasRequiredClone = 1;
  clone_1 = clone;
  var getPrototypeOf = Object.getPrototypeOf || function(obj) {
    return obj.__proto__;
  };
  function clone(obj) {
    if (obj === null || typeof obj !== "object")
      return obj;
    if (obj instanceof Object)
      var copy2 = { __proto__: getPrototypeOf(obj) };
    else
      var copy2 = /* @__PURE__ */ Object.create(null);
    Object.getOwnPropertyNames(obj).forEach(function(key) {
      Object.defineProperty(copy2, key, Object.getOwnPropertyDescriptor(obj, key));
    });
    return copy2;
  }
  return clone_1;
}
var gracefulFs;
var hasRequiredGracefulFs;
function requireGracefulFs() {
  if (hasRequiredGracefulFs) return gracefulFs;
  hasRequiredGracefulFs = 1;
  var fs2 = require$$2;
  var polyfills2 = requirePolyfills();
  var legacy = requireLegacyStreams();
  var clone = requireClone();
  var util2 = require$$4;
  var gracefulQueue;
  var previousSymbol;
  if (typeof Symbol === "function" && typeof Symbol.for === "function") {
    gracefulQueue = /* @__PURE__ */ Symbol.for("graceful-fs.queue");
    previousSymbol = /* @__PURE__ */ Symbol.for("graceful-fs.previous");
  } else {
    gracefulQueue = "___graceful-fs.queue";
    previousSymbol = "___graceful-fs.previous";
  }
  function noop() {
  }
  function publishQueue(context, queue2) {
    Object.defineProperty(context, gracefulQueue, {
      get: function() {
        return queue2;
      }
    });
  }
  var debug = noop;
  if (util2.debuglog)
    debug = util2.debuglog("gfs4");
  else if (/\bgfs4\b/i.test(process.env.NODE_DEBUG || ""))
    debug = function() {
      var m = util2.format.apply(util2, arguments);
      m = "GFS4: " + m.split(/\n/).join("\nGFS4: ");
      console.error(m);
    };
  if (!fs2[gracefulQueue]) {
    var queue = commonjsGlobal[gracefulQueue] || [];
    publishQueue(fs2, queue);
    fs2.close = (function(fs$close) {
      function close(fd, cb) {
        return fs$close.call(fs2, fd, function(err) {
          if (!err) {
            resetQueue();
          }
          if (typeof cb === "function")
            cb.apply(this, arguments);
        });
      }
      Object.defineProperty(close, previousSymbol, {
        value: fs$close
      });
      return close;
    })(fs2.close);
    fs2.closeSync = (function(fs$closeSync) {
      function closeSync(fd) {
        fs$closeSync.apply(fs2, arguments);
        resetQueue();
      }
      Object.defineProperty(closeSync, previousSymbol, {
        value: fs$closeSync
      });
      return closeSync;
    })(fs2.closeSync);
    if (/\bgfs4\b/i.test(process.env.NODE_DEBUG || "")) {
      process.on("exit", function() {
        debug(fs2[gracefulQueue]);
        require$$5$1.equal(fs2[gracefulQueue].length, 0);
      });
    }
  }
  if (!commonjsGlobal[gracefulQueue]) {
    publishQueue(commonjsGlobal, fs2[gracefulQueue]);
  }
  gracefulFs = patch(clone(fs2));
  if (process.env.TEST_GRACEFUL_FS_GLOBAL_PATCH && !fs2.__patched) {
    gracefulFs = patch(fs2);
    fs2.__patched = true;
  }
  function patch(fs3) {
    polyfills2(fs3);
    fs3.gracefulify = patch;
    fs3.createReadStream = createReadStream;
    fs3.createWriteStream = createWriteStream;
    var fs$readFile = fs3.readFile;
    fs3.readFile = readFile;
    function readFile(path, options, cb) {
      if (typeof options === "function")
        cb = options, options = null;
      return go$readFile(path, options, cb);
      function go$readFile(path2, options2, cb2, startTime) {
        return fs$readFile(path2, options2, function(err) {
          if (err && (err.code === "EMFILE" || err.code === "ENFILE"))
            enqueue([go$readFile, [path2, options2, cb2], err, startTime || Date.now(), Date.now()]);
          else {
            if (typeof cb2 === "function")
              cb2.apply(this, arguments);
          }
        });
      }
    }
    var fs$writeFile = fs3.writeFile;
    fs3.writeFile = writeFile;
    function writeFile(path, data, options, cb) {
      if (typeof options === "function")
        cb = options, options = null;
      return go$writeFile(path, data, options, cb);
      function go$writeFile(path2, data2, options2, cb2, startTime) {
        return fs$writeFile(path2, data2, options2, function(err) {
          if (err && (err.code === "EMFILE" || err.code === "ENFILE"))
            enqueue([go$writeFile, [path2, data2, options2, cb2], err, startTime || Date.now(), Date.now()]);
          else {
            if (typeof cb2 === "function")
              cb2.apply(this, arguments);
          }
        });
      }
    }
    var fs$appendFile = fs3.appendFile;
    if (fs$appendFile)
      fs3.appendFile = appendFile;
    function appendFile(path, data, options, cb) {
      if (typeof options === "function")
        cb = options, options = null;
      return go$appendFile(path, data, options, cb);
      function go$appendFile(path2, data2, options2, cb2, startTime) {
        return fs$appendFile(path2, data2, options2, function(err) {
          if (err && (err.code === "EMFILE" || err.code === "ENFILE"))
            enqueue([go$appendFile, [path2, data2, options2, cb2], err, startTime || Date.now(), Date.now()]);
          else {
            if (typeof cb2 === "function")
              cb2.apply(this, arguments);
          }
        });
      }
    }
    var fs$copyFile = fs3.copyFile;
    if (fs$copyFile)
      fs3.copyFile = copyFile;
    function copyFile(src2, dest, flags, cb) {
      if (typeof flags === "function") {
        cb = flags;
        flags = 0;
      }
      return go$copyFile(src2, dest, flags, cb);
      function go$copyFile(src3, dest2, flags2, cb2, startTime) {
        return fs$copyFile(src3, dest2, flags2, function(err) {
          if (err && (err.code === "EMFILE" || err.code === "ENFILE"))
            enqueue([go$copyFile, [src3, dest2, flags2, cb2], err, startTime || Date.now(), Date.now()]);
          else {
            if (typeof cb2 === "function")
              cb2.apply(this, arguments);
          }
        });
      }
    }
    var fs$readdir = fs3.readdir;
    fs3.readdir = readdir;
    var noReaddirOptionVersions = /^v[0-5]\./;
    function readdir(path, options, cb) {
      if (typeof options === "function")
        cb = options, options = null;
      var go$readdir = noReaddirOptionVersions.test(process.version) ? function go$readdir2(path2, options2, cb2, startTime) {
        return fs$readdir(path2, fs$readdirCallback(
          path2,
          options2,
          cb2,
          startTime
        ));
      } : function go$readdir2(path2, options2, cb2, startTime) {
        return fs$readdir(path2, options2, fs$readdirCallback(
          path2,
          options2,
          cb2,
          startTime
        ));
      };
      return go$readdir(path, options, cb);
      function fs$readdirCallback(path2, options2, cb2, startTime) {
        return function(err, files) {
          if (err && (err.code === "EMFILE" || err.code === "ENFILE"))
            enqueue([
              go$readdir,
              [path2, options2, cb2],
              err,
              startTime || Date.now(),
              Date.now()
            ]);
          else {
            if (files && files.sort)
              files.sort();
            if (typeof cb2 === "function")
              cb2.call(this, err, files);
          }
        };
      }
    }
    if (process.version.substr(0, 4) === "v0.8") {
      var legStreams = legacy(fs3);
      ReadStream = legStreams.ReadStream;
      WriteStream = legStreams.WriteStream;
    }
    var fs$ReadStream = fs3.ReadStream;
    if (fs$ReadStream) {
      ReadStream.prototype = Object.create(fs$ReadStream.prototype);
      ReadStream.prototype.open = ReadStream$open;
    }
    var fs$WriteStream = fs3.WriteStream;
    if (fs$WriteStream) {
      WriteStream.prototype = Object.create(fs$WriteStream.prototype);
      WriteStream.prototype.open = WriteStream$open;
    }
    Object.defineProperty(fs3, "ReadStream", {
      get: function() {
        return ReadStream;
      },
      set: function(val) {
        ReadStream = val;
      },
      enumerable: true,
      configurable: true
    });
    Object.defineProperty(fs3, "WriteStream", {
      get: function() {
        return WriteStream;
      },
      set: function(val) {
        WriteStream = val;
      },
      enumerable: true,
      configurable: true
    });
    var FileReadStream = ReadStream;
    Object.defineProperty(fs3, "FileReadStream", {
      get: function() {
        return FileReadStream;
      },
      set: function(val) {
        FileReadStream = val;
      },
      enumerable: true,
      configurable: true
    });
    var FileWriteStream = WriteStream;
    Object.defineProperty(fs3, "FileWriteStream", {
      get: function() {
        return FileWriteStream;
      },
      set: function(val) {
        FileWriteStream = val;
      },
      enumerable: true,
      configurable: true
    });
    function ReadStream(path, options) {
      if (this instanceof ReadStream)
        return fs$ReadStream.apply(this, arguments), this;
      else
        return ReadStream.apply(Object.create(ReadStream.prototype), arguments);
    }
    function ReadStream$open() {
      var that = this;
      open(that.path, that.flags, that.mode, function(err, fd) {
        if (err) {
          if (that.autoClose)
            that.destroy();
          that.emit("error", err);
        } else {
          that.fd = fd;
          that.emit("open", fd);
          that.read();
        }
      });
    }
    function WriteStream(path, options) {
      if (this instanceof WriteStream)
        return fs$WriteStream.apply(this, arguments), this;
      else
        return WriteStream.apply(Object.create(WriteStream.prototype), arguments);
    }
    function WriteStream$open() {
      var that = this;
      open(that.path, that.flags, that.mode, function(err, fd) {
        if (err) {
          that.destroy();
          that.emit("error", err);
        } else {
          that.fd = fd;
          that.emit("open", fd);
        }
      });
    }
    function createReadStream(path, options) {
      return new fs3.ReadStream(path, options);
    }
    function createWriteStream(path, options) {
      return new fs3.WriteStream(path, options);
    }
    var fs$open = fs3.open;
    fs3.open = open;
    function open(path, flags, mode, cb) {
      if (typeof mode === "function")
        cb = mode, mode = null;
      return go$open(path, flags, mode, cb);
      function go$open(path2, flags2, mode2, cb2, startTime) {
        return fs$open(path2, flags2, mode2, function(err, fd) {
          if (err && (err.code === "EMFILE" || err.code === "ENFILE"))
            enqueue([go$open, [path2, flags2, mode2, cb2], err, startTime || Date.now(), Date.now()]);
          else {
            if (typeof cb2 === "function")
              cb2.apply(this, arguments);
          }
        });
      }
    }
    return fs3;
  }
  function enqueue(elem) {
    debug("ENQUEUE", elem[0].name, elem[1]);
    fs2[gracefulQueue].push(elem);
    retry2();
  }
  var retryTimer;
  function resetQueue() {
    var now = Date.now();
    for (var i = 0; i < fs2[gracefulQueue].length; ++i) {
      if (fs2[gracefulQueue][i].length > 2) {
        fs2[gracefulQueue][i][3] = now;
        fs2[gracefulQueue][i][4] = now;
      }
    }
    retry2();
  }
  function retry2() {
    clearTimeout(retryTimer);
    retryTimer = void 0;
    if (fs2[gracefulQueue].length === 0)
      return;
    var elem = fs2[gracefulQueue].shift();
    var fn = elem[0];
    var args = elem[1];
    var err = elem[2];
    var startTime = elem[3];
    var lastTime = elem[4];
    if (startTime === void 0) {
      debug("RETRY", fn.name, args);
      fn.apply(null, args);
    } else if (Date.now() - startTime >= 6e4) {
      debug("TIMEOUT", fn.name, args);
      var cb = args.pop();
      if (typeof cb === "function")
        cb.call(null, err);
    } else {
      var sinceAttempt = Date.now() - lastTime;
      var sinceStart = Math.max(lastTime - startTime, 1);
      var desiredDelay = Math.min(sinceStart * 1.2, 100);
      if (sinceAttempt >= desiredDelay) {
        debug("RETRY", fn.name, args);
        fn.apply(null, args.concat([startTime]));
      } else {
        fs2[gracefulQueue].push(elem);
      }
    }
    if (retryTimer === void 0) {
      retryTimer = setTimeout(retry2, 0);
    }
  }
  return gracefulFs;
}
var hasRequiredFs;
function requireFs() {
  if (hasRequiredFs) return fs;
  hasRequiredFs = 1;
  (function(exports2) {
    const u = requireUniversalify().fromCallback;
    const fs2 = requireGracefulFs();
    const api = [
      "access",
      "appendFile",
      "chmod",
      "chown",
      "close",
      "copyFile",
      "fchmod",
      "fchown",
      "fdatasync",
      "fstat",
      "fsync",
      "ftruncate",
      "futimes",
      "lchmod",
      "lchown",
      "link",
      "lstat",
      "mkdir",
      "mkdtemp",
      "open",
      "opendir",
      "readdir",
      "readFile",
      "readlink",
      "realpath",
      "rename",
      "rm",
      "rmdir",
      "stat",
      "symlink",
      "truncate",
      "unlink",
      "utimes",
      "writeFile"
    ].filter((key) => {
      return typeof fs2[key] === "function";
    });
    Object.assign(exports2, fs2);
    api.forEach((method) => {
      exports2[method] = u(fs2[method]);
    });
    exports2.exists = function(filename, callback) {
      if (typeof callback === "function") {
        return fs2.exists(filename, callback);
      }
      return new Promise((resolve) => {
        return fs2.exists(filename, resolve);
      });
    };
    exports2.read = function(fd, buffer, offset, length, position, callback) {
      if (typeof callback === "function") {
        return fs2.read(fd, buffer, offset, length, position, callback);
      }
      return new Promise((resolve, reject) => {
        fs2.read(fd, buffer, offset, length, position, (err, bytesRead, buffer2) => {
          if (err) return reject(err);
          resolve({ bytesRead, buffer: buffer2 });
        });
      });
    };
    exports2.write = function(fd, buffer, ...args) {
      if (typeof args[args.length - 1] === "function") {
        return fs2.write(fd, buffer, ...args);
      }
      return new Promise((resolve, reject) => {
        fs2.write(fd, buffer, ...args, (err, bytesWritten, buffer2) => {
          if (err) return reject(err);
          resolve({ bytesWritten, buffer: buffer2 });
        });
      });
    };
    if (typeof fs2.writev === "function") {
      exports2.writev = function(fd, buffers, ...args) {
        if (typeof args[args.length - 1] === "function") {
          return fs2.writev(fd, buffers, ...args);
        }
        return new Promise((resolve, reject) => {
          fs2.writev(fd, buffers, ...args, (err, bytesWritten, buffers2) => {
            if (err) return reject(err);
            resolve({ bytesWritten, buffers: buffers2 });
          });
        });
      };
    }
    if (typeof fs2.realpath.native === "function") {
      exports2.realpath.native = u(fs2.realpath.native);
    } else {
      process.emitWarning(
        "fs.realpath.native is not a function. Is fs being monkey-patched?",
        "Warning",
        "fs-extra-WARN0003"
      );
    }
  })(fs);
  return fs;
}
var makeDir = {};
var utils$1 = {};
var hasRequiredUtils$1;
function requireUtils$1() {
  if (hasRequiredUtils$1) return utils$1;
  hasRequiredUtils$1 = 1;
  const path = require$$1$2;
  utils$1.checkPath = function checkPath(pth) {
    if (process.platform === "win32") {
      const pathHasInvalidWinCharacters = /[<>:"|?*]/.test(pth.replace(path.parse(pth).root, ""));
      if (pathHasInvalidWinCharacters) {
        const error2 = new Error(`Path contains invalid characters: ${pth}`);
        error2.code = "EINVAL";
        throw error2;
      }
    }
  };
  return utils$1;
}
var hasRequiredMakeDir;
function requireMakeDir() {
  if (hasRequiredMakeDir) return makeDir;
  hasRequiredMakeDir = 1;
  const fs2 = /* @__PURE__ */ requireFs();
  const { checkPath } = /* @__PURE__ */ requireUtils$1();
  const getMode = (options) => {
    const defaults = { mode: 511 };
    if (typeof options === "number") return options;
    return { ...defaults, ...options }.mode;
  };
  makeDir.makeDir = async (dir, options) => {
    checkPath(dir);
    return fs2.mkdir(dir, {
      mode: getMode(options),
      recursive: true
    });
  };
  makeDir.makeDirSync = (dir, options) => {
    checkPath(dir);
    return fs2.mkdirSync(dir, {
      mode: getMode(options),
      recursive: true
    });
  };
  return makeDir;
}
var mkdirs;
var hasRequiredMkdirs;
function requireMkdirs() {
  if (hasRequiredMkdirs) return mkdirs;
  hasRequiredMkdirs = 1;
  const u = requireUniversalify().fromPromise;
  const { makeDir: _makeDir, makeDirSync } = /* @__PURE__ */ requireMakeDir();
  const makeDir2 = u(_makeDir);
  mkdirs = {
    mkdirs: makeDir2,
    mkdirsSync: makeDirSync,
    // alias
    mkdirp: makeDir2,
    mkdirpSync: makeDirSync,
    ensureDir: makeDir2,
    ensureDirSync: makeDirSync
  };
  return mkdirs;
}
var pathExists_1;
var hasRequiredPathExists;
function requirePathExists() {
  if (hasRequiredPathExists) return pathExists_1;
  hasRequiredPathExists = 1;
  const u = requireUniversalify().fromPromise;
  const fs2 = /* @__PURE__ */ requireFs();
  function pathExists(path) {
    return fs2.access(path).then(() => true).catch(() => false);
  }
  pathExists_1 = {
    pathExists: u(pathExists),
    pathExistsSync: fs2.existsSync
  };
  return pathExists_1;
}
var utimes;
var hasRequiredUtimes;
function requireUtimes() {
  if (hasRequiredUtimes) return utimes;
  hasRequiredUtimes = 1;
  const fs2 = requireGracefulFs();
  function utimesMillis(path, atime, mtime, callback) {
    fs2.open(path, "r+", (err, fd) => {
      if (err) return callback(err);
      fs2.futimes(fd, atime, mtime, (futimesErr) => {
        fs2.close(fd, (closeErr) => {
          if (callback) callback(futimesErr || closeErr);
        });
      });
    });
  }
  function utimesMillisSync(path, atime, mtime) {
    const fd = fs2.openSync(path, "r+");
    fs2.futimesSync(fd, atime, mtime);
    return fs2.closeSync(fd);
  }
  utimes = {
    utimesMillis,
    utimesMillisSync
  };
  return utimes;
}
var stat;
var hasRequiredStat;
function requireStat() {
  if (hasRequiredStat) return stat;
  hasRequiredStat = 1;
  const fs2 = /* @__PURE__ */ requireFs();
  const path = require$$1$2;
  const util2 = require$$4;
  function getStats(src2, dest, opts) {
    const statFunc = opts.dereference ? (file2) => fs2.stat(file2, { bigint: true }) : (file2) => fs2.lstat(file2, { bigint: true });
    return Promise.all([
      statFunc(src2),
      statFunc(dest).catch((err) => {
        if (err.code === "ENOENT") return null;
        throw err;
      })
    ]).then(([srcStat, destStat]) => ({ srcStat, destStat }));
  }
  function getStatsSync(src2, dest, opts) {
    let destStat;
    const statFunc = opts.dereference ? (file2) => fs2.statSync(file2, { bigint: true }) : (file2) => fs2.lstatSync(file2, { bigint: true });
    const srcStat = statFunc(src2);
    try {
      destStat = statFunc(dest);
    } catch (err) {
      if (err.code === "ENOENT") return { srcStat, destStat: null };
      throw err;
    }
    return { srcStat, destStat };
  }
  function checkPaths(src2, dest, funcName, opts, cb) {
    util2.callbackify(getStats)(src2, dest, opts, (err, stats) => {
      if (err) return cb(err);
      const { srcStat, destStat } = stats;
      if (destStat) {
        if (areIdentical(srcStat, destStat)) {
          const srcBaseName = path.basename(src2);
          const destBaseName = path.basename(dest);
          if (funcName === "move" && srcBaseName !== destBaseName && srcBaseName.toLowerCase() === destBaseName.toLowerCase()) {
            return cb(null, { srcStat, destStat, isChangingCase: true });
          }
          return cb(new Error("Source and destination must not be the same."));
        }
        if (srcStat.isDirectory() && !destStat.isDirectory()) {
          return cb(new Error(`Cannot overwrite non-directory '${dest}' with directory '${src2}'.`));
        }
        if (!srcStat.isDirectory() && destStat.isDirectory()) {
          return cb(new Error(`Cannot overwrite directory '${dest}' with non-directory '${src2}'.`));
        }
      }
      if (srcStat.isDirectory() && isSrcSubdir(src2, dest)) {
        return cb(new Error(errMsg(src2, dest, funcName)));
      }
      return cb(null, { srcStat, destStat });
    });
  }
  function checkPathsSync(src2, dest, funcName, opts) {
    const { srcStat, destStat } = getStatsSync(src2, dest, opts);
    if (destStat) {
      if (areIdentical(srcStat, destStat)) {
        const srcBaseName = path.basename(src2);
        const destBaseName = path.basename(dest);
        if (funcName === "move" && srcBaseName !== destBaseName && srcBaseName.toLowerCase() === destBaseName.toLowerCase()) {
          return { srcStat, destStat, isChangingCase: true };
        }
        throw new Error("Source and destination must not be the same.");
      }
      if (srcStat.isDirectory() && !destStat.isDirectory()) {
        throw new Error(`Cannot overwrite non-directory '${dest}' with directory '${src2}'.`);
      }
      if (!srcStat.isDirectory() && destStat.isDirectory()) {
        throw new Error(`Cannot overwrite directory '${dest}' with non-directory '${src2}'.`);
      }
    }
    if (srcStat.isDirectory() && isSrcSubdir(src2, dest)) {
      throw new Error(errMsg(src2, dest, funcName));
    }
    return { srcStat, destStat };
  }
  function checkParentPaths(src2, srcStat, dest, funcName, cb) {
    const srcParent = path.resolve(path.dirname(src2));
    const destParent = path.resolve(path.dirname(dest));
    if (destParent === srcParent || destParent === path.parse(destParent).root) return cb();
    fs2.stat(destParent, { bigint: true }, (err, destStat) => {
      if (err) {
        if (err.code === "ENOENT") return cb();
        return cb(err);
      }
      if (areIdentical(srcStat, destStat)) {
        return cb(new Error(errMsg(src2, dest, funcName)));
      }
      return checkParentPaths(src2, srcStat, destParent, funcName, cb);
    });
  }
  function checkParentPathsSync(src2, srcStat, dest, funcName) {
    const srcParent = path.resolve(path.dirname(src2));
    const destParent = path.resolve(path.dirname(dest));
    if (destParent === srcParent || destParent === path.parse(destParent).root) return;
    let destStat;
    try {
      destStat = fs2.statSync(destParent, { bigint: true });
    } catch (err) {
      if (err.code === "ENOENT") return;
      throw err;
    }
    if (areIdentical(srcStat, destStat)) {
      throw new Error(errMsg(src2, dest, funcName));
    }
    return checkParentPathsSync(src2, srcStat, destParent, funcName);
  }
  function areIdentical(srcStat, destStat) {
    return destStat.ino && destStat.dev && destStat.ino === srcStat.ino && destStat.dev === srcStat.dev;
  }
  function isSrcSubdir(src2, dest) {
    const srcArr = path.resolve(src2).split(path.sep).filter((i) => i);
    const destArr = path.resolve(dest).split(path.sep).filter((i) => i);
    return srcArr.reduce((acc, cur, i) => acc && destArr[i] === cur, true);
  }
  function errMsg(src2, dest, funcName) {
    return `Cannot ${funcName} '${src2}' to a subdirectory of itself, '${dest}'.`;
  }
  stat = {
    checkPaths,
    checkPathsSync,
    checkParentPaths,
    checkParentPathsSync,
    isSrcSubdir,
    areIdentical
  };
  return stat;
}
var copy_1;
var hasRequiredCopy$1;
function requireCopy$1() {
  if (hasRequiredCopy$1) return copy_1;
  hasRequiredCopy$1 = 1;
  const fs2 = requireGracefulFs();
  const path = require$$1$2;
  const mkdirs2 = requireMkdirs().mkdirs;
  const pathExists = requirePathExists().pathExists;
  const utimesMillis = requireUtimes().utimesMillis;
  const stat2 = /* @__PURE__ */ requireStat();
  function copy2(src2, dest, opts, cb) {
    if (typeof opts === "function" && !cb) {
      cb = opts;
      opts = {};
    } else if (typeof opts === "function") {
      opts = { filter: opts };
    }
    cb = cb || function() {
    };
    opts = opts || {};
    opts.clobber = "clobber" in opts ? !!opts.clobber : true;
    opts.overwrite = "overwrite" in opts ? !!opts.overwrite : opts.clobber;
    if (opts.preserveTimestamps && process.arch === "ia32") {
      process.emitWarning(
        "Using the preserveTimestamps option in 32-bit node is not recommended;\n\n	see https://github.com/jprichardson/node-fs-extra/issues/269",
        "Warning",
        "fs-extra-WARN0001"
      );
    }
    stat2.checkPaths(src2, dest, "copy", opts, (err, stats) => {
      if (err) return cb(err);
      const { srcStat, destStat } = stats;
      stat2.checkParentPaths(src2, srcStat, dest, "copy", (err2) => {
        if (err2) return cb(err2);
        if (opts.filter) return handleFilter(checkParentDir, destStat, src2, dest, opts, cb);
        return checkParentDir(destStat, src2, dest, opts, cb);
      });
    });
  }
  function checkParentDir(destStat, src2, dest, opts, cb) {
    const destParent = path.dirname(dest);
    pathExists(destParent, (err, dirExists) => {
      if (err) return cb(err);
      if (dirExists) return getStats(destStat, src2, dest, opts, cb);
      mkdirs2(destParent, (err2) => {
        if (err2) return cb(err2);
        return getStats(destStat, src2, dest, opts, cb);
      });
    });
  }
  function handleFilter(onInclude, destStat, src2, dest, opts, cb) {
    Promise.resolve(opts.filter(src2, dest)).then((include) => {
      if (include) return onInclude(destStat, src2, dest, opts, cb);
      return cb();
    }, (error2) => cb(error2));
  }
  function startCopy(destStat, src2, dest, opts, cb) {
    if (opts.filter) return handleFilter(getStats, destStat, src2, dest, opts, cb);
    return getStats(destStat, src2, dest, opts, cb);
  }
  function getStats(destStat, src2, dest, opts, cb) {
    const stat3 = opts.dereference ? fs2.stat : fs2.lstat;
    stat3(src2, (err, srcStat) => {
      if (err) return cb(err);
      if (srcStat.isDirectory()) return onDir(srcStat, destStat, src2, dest, opts, cb);
      else if (srcStat.isFile() || srcStat.isCharacterDevice() || srcStat.isBlockDevice()) return onFile(srcStat, destStat, src2, dest, opts, cb);
      else if (srcStat.isSymbolicLink()) return onLink(destStat, src2, dest, opts, cb);
      else if (srcStat.isSocket()) return cb(new Error(`Cannot copy a socket file: ${src2}`));
      else if (srcStat.isFIFO()) return cb(new Error(`Cannot copy a FIFO pipe: ${src2}`));
      return cb(new Error(`Unknown file: ${src2}`));
    });
  }
  function onFile(srcStat, destStat, src2, dest, opts, cb) {
    if (!destStat) return copyFile(srcStat, src2, dest, opts, cb);
    return mayCopyFile(srcStat, src2, dest, opts, cb);
  }
  function mayCopyFile(srcStat, src2, dest, opts, cb) {
    if (opts.overwrite) {
      fs2.unlink(dest, (err) => {
        if (err) return cb(err);
        return copyFile(srcStat, src2, dest, opts, cb);
      });
    } else if (opts.errorOnExist) {
      return cb(new Error(`'${dest}' already exists`));
    } else return cb();
  }
  function copyFile(srcStat, src2, dest, opts, cb) {
    fs2.copyFile(src2, dest, (err) => {
      if (err) return cb(err);
      if (opts.preserveTimestamps) return handleTimestampsAndMode(srcStat.mode, src2, dest, cb);
      return setDestMode(dest, srcStat.mode, cb);
    });
  }
  function handleTimestampsAndMode(srcMode, src2, dest, cb) {
    if (fileIsNotWritable(srcMode)) {
      return makeFileWritable(dest, srcMode, (err) => {
        if (err) return cb(err);
        return setDestTimestampsAndMode(srcMode, src2, dest, cb);
      });
    }
    return setDestTimestampsAndMode(srcMode, src2, dest, cb);
  }
  function fileIsNotWritable(srcMode) {
    return (srcMode & 128) === 0;
  }
  function makeFileWritable(dest, srcMode, cb) {
    return setDestMode(dest, srcMode | 128, cb);
  }
  function setDestTimestampsAndMode(srcMode, src2, dest, cb) {
    setDestTimestamps(src2, dest, (err) => {
      if (err) return cb(err);
      return setDestMode(dest, srcMode, cb);
    });
  }
  function setDestMode(dest, srcMode, cb) {
    return fs2.chmod(dest, srcMode, cb);
  }
  function setDestTimestamps(src2, dest, cb) {
    fs2.stat(src2, (err, updatedSrcStat) => {
      if (err) return cb(err);
      return utimesMillis(dest, updatedSrcStat.atime, updatedSrcStat.mtime, cb);
    });
  }
  function onDir(srcStat, destStat, src2, dest, opts, cb) {
    if (!destStat) return mkDirAndCopy(srcStat.mode, src2, dest, opts, cb);
    return copyDir(src2, dest, opts, cb);
  }
  function mkDirAndCopy(srcMode, src2, dest, opts, cb) {
    fs2.mkdir(dest, (err) => {
      if (err) return cb(err);
      copyDir(src2, dest, opts, (err2) => {
        if (err2) return cb(err2);
        return setDestMode(dest, srcMode, cb);
      });
    });
  }
  function copyDir(src2, dest, opts, cb) {
    fs2.readdir(src2, (err, items) => {
      if (err) return cb(err);
      return copyDirItems(items, src2, dest, opts, cb);
    });
  }
  function copyDirItems(items, src2, dest, opts, cb) {
    const item = items.pop();
    if (!item) return cb();
    return copyDirItem(items, item, src2, dest, opts, cb);
  }
  function copyDirItem(items, item, src2, dest, opts, cb) {
    const srcItem = path.join(src2, item);
    const destItem = path.join(dest, item);
    stat2.checkPaths(srcItem, destItem, "copy", opts, (err, stats) => {
      if (err) return cb(err);
      const { destStat } = stats;
      startCopy(destStat, srcItem, destItem, opts, (err2) => {
        if (err2) return cb(err2);
        return copyDirItems(items, src2, dest, opts, cb);
      });
    });
  }
  function onLink(destStat, src2, dest, opts, cb) {
    fs2.readlink(src2, (err, resolvedSrc) => {
      if (err) return cb(err);
      if (opts.dereference) {
        resolvedSrc = path.resolve(process.cwd(), resolvedSrc);
      }
      if (!destStat) {
        return fs2.symlink(resolvedSrc, dest, cb);
      } else {
        fs2.readlink(dest, (err2, resolvedDest) => {
          if (err2) {
            if (err2.code === "EINVAL" || err2.code === "UNKNOWN") return fs2.symlink(resolvedSrc, dest, cb);
            return cb(err2);
          }
          if (opts.dereference) {
            resolvedDest = path.resolve(process.cwd(), resolvedDest);
          }
          if (stat2.isSrcSubdir(resolvedSrc, resolvedDest)) {
            return cb(new Error(`Cannot copy '${resolvedSrc}' to a subdirectory of itself, '${resolvedDest}'.`));
          }
          if (destStat.isDirectory() && stat2.isSrcSubdir(resolvedDest, resolvedSrc)) {
            return cb(new Error(`Cannot overwrite '${resolvedDest}' with '${resolvedSrc}'.`));
          }
          return copyLink(resolvedSrc, dest, cb);
        });
      }
    });
  }
  function copyLink(resolvedSrc, dest, cb) {
    fs2.unlink(dest, (err) => {
      if (err) return cb(err);
      return fs2.symlink(resolvedSrc, dest, cb);
    });
  }
  copy_1 = copy2;
  return copy_1;
}
var copySync_1;
var hasRequiredCopySync;
function requireCopySync() {
  if (hasRequiredCopySync) return copySync_1;
  hasRequiredCopySync = 1;
  const fs2 = requireGracefulFs();
  const path = require$$1$2;
  const mkdirsSync = requireMkdirs().mkdirsSync;
  const utimesMillisSync = requireUtimes().utimesMillisSync;
  const stat2 = /* @__PURE__ */ requireStat();
  function copySync(src2, dest, opts) {
    if (typeof opts === "function") {
      opts = { filter: opts };
    }
    opts = opts || {};
    opts.clobber = "clobber" in opts ? !!opts.clobber : true;
    opts.overwrite = "overwrite" in opts ? !!opts.overwrite : opts.clobber;
    if (opts.preserveTimestamps && process.arch === "ia32") {
      process.emitWarning(
        "Using the preserveTimestamps option in 32-bit node is not recommended;\n\n	see https://github.com/jprichardson/node-fs-extra/issues/269",
        "Warning",
        "fs-extra-WARN0002"
      );
    }
    const { srcStat, destStat } = stat2.checkPathsSync(src2, dest, "copy", opts);
    stat2.checkParentPathsSync(src2, srcStat, dest, "copy");
    return handleFilterAndCopy(destStat, src2, dest, opts);
  }
  function handleFilterAndCopy(destStat, src2, dest, opts) {
    if (opts.filter && !opts.filter(src2, dest)) return;
    const destParent = path.dirname(dest);
    if (!fs2.existsSync(destParent)) mkdirsSync(destParent);
    return getStats(destStat, src2, dest, opts);
  }
  function startCopy(destStat, src2, dest, opts) {
    if (opts.filter && !opts.filter(src2, dest)) return;
    return getStats(destStat, src2, dest, opts);
  }
  function getStats(destStat, src2, dest, opts) {
    const statSync = opts.dereference ? fs2.statSync : fs2.lstatSync;
    const srcStat = statSync(src2);
    if (srcStat.isDirectory()) return onDir(srcStat, destStat, src2, dest, opts);
    else if (srcStat.isFile() || srcStat.isCharacterDevice() || srcStat.isBlockDevice()) return onFile(srcStat, destStat, src2, dest, opts);
    else if (srcStat.isSymbolicLink()) return onLink(destStat, src2, dest, opts);
    else if (srcStat.isSocket()) throw new Error(`Cannot copy a socket file: ${src2}`);
    else if (srcStat.isFIFO()) throw new Error(`Cannot copy a FIFO pipe: ${src2}`);
    throw new Error(`Unknown file: ${src2}`);
  }
  function onFile(srcStat, destStat, src2, dest, opts) {
    if (!destStat) return copyFile(srcStat, src2, dest, opts);
    return mayCopyFile(srcStat, src2, dest, opts);
  }
  function mayCopyFile(srcStat, src2, dest, opts) {
    if (opts.overwrite) {
      fs2.unlinkSync(dest);
      return copyFile(srcStat, src2, dest, opts);
    } else if (opts.errorOnExist) {
      throw new Error(`'${dest}' already exists`);
    }
  }
  function copyFile(srcStat, src2, dest, opts) {
    fs2.copyFileSync(src2, dest);
    if (opts.preserveTimestamps) handleTimestamps(srcStat.mode, src2, dest);
    return setDestMode(dest, srcStat.mode);
  }
  function handleTimestamps(srcMode, src2, dest) {
    if (fileIsNotWritable(srcMode)) makeFileWritable(dest, srcMode);
    return setDestTimestamps(src2, dest);
  }
  function fileIsNotWritable(srcMode) {
    return (srcMode & 128) === 0;
  }
  function makeFileWritable(dest, srcMode) {
    return setDestMode(dest, srcMode | 128);
  }
  function setDestMode(dest, srcMode) {
    return fs2.chmodSync(dest, srcMode);
  }
  function setDestTimestamps(src2, dest) {
    const updatedSrcStat = fs2.statSync(src2);
    return utimesMillisSync(dest, updatedSrcStat.atime, updatedSrcStat.mtime);
  }
  function onDir(srcStat, destStat, src2, dest, opts) {
    if (!destStat) return mkDirAndCopy(srcStat.mode, src2, dest, opts);
    return copyDir(src2, dest, opts);
  }
  function mkDirAndCopy(srcMode, src2, dest, opts) {
    fs2.mkdirSync(dest);
    copyDir(src2, dest, opts);
    return setDestMode(dest, srcMode);
  }
  function copyDir(src2, dest, opts) {
    fs2.readdirSync(src2).forEach((item) => copyDirItem(item, src2, dest, opts));
  }
  function copyDirItem(item, src2, dest, opts) {
    const srcItem = path.join(src2, item);
    const destItem = path.join(dest, item);
    const { destStat } = stat2.checkPathsSync(srcItem, destItem, "copy", opts);
    return startCopy(destStat, srcItem, destItem, opts);
  }
  function onLink(destStat, src2, dest, opts) {
    let resolvedSrc = fs2.readlinkSync(src2);
    if (opts.dereference) {
      resolvedSrc = path.resolve(process.cwd(), resolvedSrc);
    }
    if (!destStat) {
      return fs2.symlinkSync(resolvedSrc, dest);
    } else {
      let resolvedDest;
      try {
        resolvedDest = fs2.readlinkSync(dest);
      } catch (err) {
        if (err.code === "EINVAL" || err.code === "UNKNOWN") return fs2.symlinkSync(resolvedSrc, dest);
        throw err;
      }
      if (opts.dereference) {
        resolvedDest = path.resolve(process.cwd(), resolvedDest);
      }
      if (stat2.isSrcSubdir(resolvedSrc, resolvedDest)) {
        throw new Error(`Cannot copy '${resolvedSrc}' to a subdirectory of itself, '${resolvedDest}'.`);
      }
      if (fs2.statSync(dest).isDirectory() && stat2.isSrcSubdir(resolvedDest, resolvedSrc)) {
        throw new Error(`Cannot overwrite '${resolvedDest}' with '${resolvedSrc}'.`);
      }
      return copyLink(resolvedSrc, dest);
    }
  }
  function copyLink(resolvedSrc, dest) {
    fs2.unlinkSync(dest);
    return fs2.symlinkSync(resolvedSrc, dest);
  }
  copySync_1 = copySync;
  return copySync_1;
}
var copy;
var hasRequiredCopy;
function requireCopy() {
  if (hasRequiredCopy) return copy;
  hasRequiredCopy = 1;
  const u = requireUniversalify().fromCallback;
  copy = {
    copy: u(/* @__PURE__ */ requireCopy$1()),
    copySync: /* @__PURE__ */ requireCopySync()
  };
  return copy;
}
var rimraf_1;
var hasRequiredRimraf;
function requireRimraf() {
  if (hasRequiredRimraf) return rimraf_1;
  hasRequiredRimraf = 1;
  const fs2 = requireGracefulFs();
  const path = require$$1$2;
  const assert = require$$5$1;
  const isWindows2 = process.platform === "win32";
  function defaults(options) {
    const methods = [
      "unlink",
      "chmod",
      "stat",
      "lstat",
      "rmdir",
      "readdir"
    ];
    methods.forEach((m) => {
      options[m] = options[m] || fs2[m];
      m = m + "Sync";
      options[m] = options[m] || fs2[m];
    });
    options.maxBusyTries = options.maxBusyTries || 3;
  }
  function rimraf(p, options, cb) {
    let busyTries = 0;
    if (typeof options === "function") {
      cb = options;
      options = {};
    }
    assert(p, "rimraf: missing path");
    assert.strictEqual(typeof p, "string", "rimraf: path should be a string");
    assert.strictEqual(typeof cb, "function", "rimraf: callback function required");
    assert(options, "rimraf: invalid options argument provided");
    assert.strictEqual(typeof options, "object", "rimraf: options should be object");
    defaults(options);
    rimraf_(p, options, function CB(er) {
      if (er) {
        if ((er.code === "EBUSY" || er.code === "ENOTEMPTY" || er.code === "EPERM") && busyTries < options.maxBusyTries) {
          busyTries++;
          const time = busyTries * 100;
          return setTimeout(() => rimraf_(p, options, CB), time);
        }
        if (er.code === "ENOENT") er = null;
      }
      cb(er);
    });
  }
  function rimraf_(p, options, cb) {
    assert(p);
    assert(options);
    assert(typeof cb === "function");
    options.lstat(p, (er, st) => {
      if (er && er.code === "ENOENT") {
        return cb(null);
      }
      if (er && er.code === "EPERM" && isWindows2) {
        return fixWinEPERM(p, options, er, cb);
      }
      if (st && st.isDirectory()) {
        return rmdir(p, options, er, cb);
      }
      options.unlink(p, (er2) => {
        if (er2) {
          if (er2.code === "ENOENT") {
            return cb(null);
          }
          if (er2.code === "EPERM") {
            return isWindows2 ? fixWinEPERM(p, options, er2, cb) : rmdir(p, options, er2, cb);
          }
          if (er2.code === "EISDIR") {
            return rmdir(p, options, er2, cb);
          }
        }
        return cb(er2);
      });
    });
  }
  function fixWinEPERM(p, options, er, cb) {
    assert(p);
    assert(options);
    assert(typeof cb === "function");
    options.chmod(p, 438, (er2) => {
      if (er2) {
        cb(er2.code === "ENOENT" ? null : er);
      } else {
        options.stat(p, (er3, stats) => {
          if (er3) {
            cb(er3.code === "ENOENT" ? null : er);
          } else if (stats.isDirectory()) {
            rmdir(p, options, er, cb);
          } else {
            options.unlink(p, cb);
          }
        });
      }
    });
  }
  function fixWinEPERMSync(p, options, er) {
    let stats;
    assert(p);
    assert(options);
    try {
      options.chmodSync(p, 438);
    } catch (er2) {
      if (er2.code === "ENOENT") {
        return;
      } else {
        throw er;
      }
    }
    try {
      stats = options.statSync(p);
    } catch (er3) {
      if (er3.code === "ENOENT") {
        return;
      } else {
        throw er;
      }
    }
    if (stats.isDirectory()) {
      rmdirSync(p, options, er);
    } else {
      options.unlinkSync(p);
    }
  }
  function rmdir(p, options, originalEr, cb) {
    assert(p);
    assert(options);
    assert(typeof cb === "function");
    options.rmdir(p, (er) => {
      if (er && (er.code === "ENOTEMPTY" || er.code === "EEXIST" || er.code === "EPERM")) {
        rmkids(p, options, cb);
      } else if (er && er.code === "ENOTDIR") {
        cb(originalEr);
      } else {
        cb(er);
      }
    });
  }
  function rmkids(p, options, cb) {
    assert(p);
    assert(options);
    assert(typeof cb === "function");
    options.readdir(p, (er, files) => {
      if (er) return cb(er);
      let n = files.length;
      let errState;
      if (n === 0) return options.rmdir(p, cb);
      files.forEach((f) => {
        rimraf(path.join(p, f), options, (er2) => {
          if (errState) {
            return;
          }
          if (er2) return cb(errState = er2);
          if (--n === 0) {
            options.rmdir(p, cb);
          }
        });
      });
    });
  }
  function rimrafSync(p, options) {
    let st;
    options = options || {};
    defaults(options);
    assert(p, "rimraf: missing path");
    assert.strictEqual(typeof p, "string", "rimraf: path should be a string");
    assert(options, "rimraf: missing options");
    assert.strictEqual(typeof options, "object", "rimraf: options should be object");
    try {
      st = options.lstatSync(p);
    } catch (er) {
      if (er.code === "ENOENT") {
        return;
      }
      if (er.code === "EPERM" && isWindows2) {
        fixWinEPERMSync(p, options, er);
      }
    }
    try {
      if (st && st.isDirectory()) {
        rmdirSync(p, options, null);
      } else {
        options.unlinkSync(p);
      }
    } catch (er) {
      if (er.code === "ENOENT") {
        return;
      } else if (er.code === "EPERM") {
        return isWindows2 ? fixWinEPERMSync(p, options, er) : rmdirSync(p, options, er);
      } else if (er.code !== "EISDIR") {
        throw er;
      }
      rmdirSync(p, options, er);
    }
  }
  function rmdirSync(p, options, originalEr) {
    assert(p);
    assert(options);
    try {
      options.rmdirSync(p);
    } catch (er) {
      if (er.code === "ENOTDIR") {
        throw originalEr;
      } else if (er.code === "ENOTEMPTY" || er.code === "EEXIST" || er.code === "EPERM") {
        rmkidsSync(p, options);
      } else if (er.code !== "ENOENT") {
        throw er;
      }
    }
  }
  function rmkidsSync(p, options) {
    assert(p);
    assert(options);
    options.readdirSync(p).forEach((f) => rimrafSync(path.join(p, f), options));
    if (isWindows2) {
      const startTime = Date.now();
      do {
        try {
          const ret = options.rmdirSync(p, options);
          return ret;
        } catch {
        }
      } while (Date.now() - startTime < 500);
    } else {
      const ret = options.rmdirSync(p, options);
      return ret;
    }
  }
  rimraf_1 = rimraf;
  rimraf.sync = rimrafSync;
  return rimraf_1;
}
var remove_1;
var hasRequiredRemove;
function requireRemove() {
  if (hasRequiredRemove) return remove_1;
  hasRequiredRemove = 1;
  const fs2 = requireGracefulFs();
  const u = requireUniversalify().fromCallback;
  const rimraf = /* @__PURE__ */ requireRimraf();
  function remove(path, callback) {
    if (fs2.rm) return fs2.rm(path, { recursive: true, force: true }, callback);
    rimraf(path, callback);
  }
  function removeSync(path) {
    if (fs2.rmSync) return fs2.rmSync(path, { recursive: true, force: true });
    rimraf.sync(path);
  }
  remove_1 = {
    remove: u(remove),
    removeSync
  };
  return remove_1;
}
var empty;
var hasRequiredEmpty;
function requireEmpty() {
  if (hasRequiredEmpty) return empty;
  hasRequiredEmpty = 1;
  const u = requireUniversalify().fromPromise;
  const fs2 = /* @__PURE__ */ requireFs();
  const path = require$$1$2;
  const mkdir = /* @__PURE__ */ requireMkdirs();
  const remove = /* @__PURE__ */ requireRemove();
  const emptyDir = u(async function emptyDir2(dir) {
    let items;
    try {
      items = await fs2.readdir(dir);
    } catch {
      return mkdir.mkdirs(dir);
    }
    return Promise.all(items.map((item) => remove.remove(path.join(dir, item))));
  });
  function emptyDirSync(dir) {
    let items;
    try {
      items = fs2.readdirSync(dir);
    } catch {
      return mkdir.mkdirsSync(dir);
    }
    items.forEach((item) => {
      item = path.join(dir, item);
      remove.removeSync(item);
    });
  }
  empty = {
    emptyDirSync,
    emptydirSync: emptyDirSync,
    emptyDir,
    emptydir: emptyDir
  };
  return empty;
}
var file;
var hasRequiredFile;
function requireFile() {
  if (hasRequiredFile) return file;
  hasRequiredFile = 1;
  const u = requireUniversalify().fromCallback;
  const path = require$$1$2;
  const fs2 = requireGracefulFs();
  const mkdir = /* @__PURE__ */ requireMkdirs();
  function createFile(file2, callback) {
    function makeFile() {
      fs2.writeFile(file2, "", (err) => {
        if (err) return callback(err);
        callback();
      });
    }
    fs2.stat(file2, (err, stats) => {
      if (!err && stats.isFile()) return callback();
      const dir = path.dirname(file2);
      fs2.stat(dir, (err2, stats2) => {
        if (err2) {
          if (err2.code === "ENOENT") {
            return mkdir.mkdirs(dir, (err3) => {
              if (err3) return callback(err3);
              makeFile();
            });
          }
          return callback(err2);
        }
        if (stats2.isDirectory()) makeFile();
        else {
          fs2.readdir(dir, (err3) => {
            if (err3) return callback(err3);
          });
        }
      });
    });
  }
  function createFileSync(file2) {
    let stats;
    try {
      stats = fs2.statSync(file2);
    } catch {
    }
    if (stats && stats.isFile()) return;
    const dir = path.dirname(file2);
    try {
      if (!fs2.statSync(dir).isDirectory()) {
        fs2.readdirSync(dir);
      }
    } catch (err) {
      if (err && err.code === "ENOENT") mkdir.mkdirsSync(dir);
      else throw err;
    }
    fs2.writeFileSync(file2, "");
  }
  file = {
    createFile: u(createFile),
    createFileSync
  };
  return file;
}
var link;
var hasRequiredLink;
function requireLink() {
  if (hasRequiredLink) return link;
  hasRequiredLink = 1;
  const u = requireUniversalify().fromCallback;
  const path = require$$1$2;
  const fs2 = requireGracefulFs();
  const mkdir = /* @__PURE__ */ requireMkdirs();
  const pathExists = requirePathExists().pathExists;
  const { areIdentical } = /* @__PURE__ */ requireStat();
  function createLink(srcpath, dstpath, callback) {
    function makeLink(srcpath2, dstpath2) {
      fs2.link(srcpath2, dstpath2, (err) => {
        if (err) return callback(err);
        callback(null);
      });
    }
    fs2.lstat(dstpath, (_, dstStat) => {
      fs2.lstat(srcpath, (err, srcStat) => {
        if (err) {
          err.message = err.message.replace("lstat", "ensureLink");
          return callback(err);
        }
        if (dstStat && areIdentical(srcStat, dstStat)) return callback(null);
        const dir = path.dirname(dstpath);
        pathExists(dir, (err2, dirExists) => {
          if (err2) return callback(err2);
          if (dirExists) return makeLink(srcpath, dstpath);
          mkdir.mkdirs(dir, (err3) => {
            if (err3) return callback(err3);
            makeLink(srcpath, dstpath);
          });
        });
      });
    });
  }
  function createLinkSync(srcpath, dstpath) {
    let dstStat;
    try {
      dstStat = fs2.lstatSync(dstpath);
    } catch {
    }
    try {
      const srcStat = fs2.lstatSync(srcpath);
      if (dstStat && areIdentical(srcStat, dstStat)) return;
    } catch (err) {
      err.message = err.message.replace("lstat", "ensureLink");
      throw err;
    }
    const dir = path.dirname(dstpath);
    const dirExists = fs2.existsSync(dir);
    if (dirExists) return fs2.linkSync(srcpath, dstpath);
    mkdir.mkdirsSync(dir);
    return fs2.linkSync(srcpath, dstpath);
  }
  link = {
    createLink: u(createLink),
    createLinkSync
  };
  return link;
}
var symlinkPaths_1;
var hasRequiredSymlinkPaths;
function requireSymlinkPaths() {
  if (hasRequiredSymlinkPaths) return symlinkPaths_1;
  hasRequiredSymlinkPaths = 1;
  const path = require$$1$2;
  const fs2 = requireGracefulFs();
  const pathExists = requirePathExists().pathExists;
  function symlinkPaths(srcpath, dstpath, callback) {
    if (path.isAbsolute(srcpath)) {
      return fs2.lstat(srcpath, (err) => {
        if (err) {
          err.message = err.message.replace("lstat", "ensureSymlink");
          return callback(err);
        }
        return callback(null, {
          toCwd: srcpath,
          toDst: srcpath
        });
      });
    } else {
      const dstdir = path.dirname(dstpath);
      const relativeToDst = path.join(dstdir, srcpath);
      return pathExists(relativeToDst, (err, exists) => {
        if (err) return callback(err);
        if (exists) {
          return callback(null, {
            toCwd: relativeToDst,
            toDst: srcpath
          });
        } else {
          return fs2.lstat(srcpath, (err2) => {
            if (err2) {
              err2.message = err2.message.replace("lstat", "ensureSymlink");
              return callback(err2);
            }
            return callback(null, {
              toCwd: srcpath,
              toDst: path.relative(dstdir, srcpath)
            });
          });
        }
      });
    }
  }
  function symlinkPathsSync(srcpath, dstpath) {
    let exists;
    if (path.isAbsolute(srcpath)) {
      exists = fs2.existsSync(srcpath);
      if (!exists) throw new Error("absolute srcpath does not exist");
      return {
        toCwd: srcpath,
        toDst: srcpath
      };
    } else {
      const dstdir = path.dirname(dstpath);
      const relativeToDst = path.join(dstdir, srcpath);
      exists = fs2.existsSync(relativeToDst);
      if (exists) {
        return {
          toCwd: relativeToDst,
          toDst: srcpath
        };
      } else {
        exists = fs2.existsSync(srcpath);
        if (!exists) throw new Error("relative srcpath does not exist");
        return {
          toCwd: srcpath,
          toDst: path.relative(dstdir, srcpath)
        };
      }
    }
  }
  symlinkPaths_1 = {
    symlinkPaths,
    symlinkPathsSync
  };
  return symlinkPaths_1;
}
var symlinkType_1;
var hasRequiredSymlinkType;
function requireSymlinkType() {
  if (hasRequiredSymlinkType) return symlinkType_1;
  hasRequiredSymlinkType = 1;
  const fs2 = requireGracefulFs();
  function symlinkType(srcpath, type, callback) {
    callback = typeof type === "function" ? type : callback;
    type = typeof type === "function" ? false : type;
    if (type) return callback(null, type);
    fs2.lstat(srcpath, (err, stats) => {
      if (err) return callback(null, "file");
      type = stats && stats.isDirectory() ? "dir" : "file";
      callback(null, type);
    });
  }
  function symlinkTypeSync(srcpath, type) {
    let stats;
    if (type) return type;
    try {
      stats = fs2.lstatSync(srcpath);
    } catch {
      return "file";
    }
    return stats && stats.isDirectory() ? "dir" : "file";
  }
  symlinkType_1 = {
    symlinkType,
    symlinkTypeSync
  };
  return symlinkType_1;
}
var symlink;
var hasRequiredSymlink;
function requireSymlink() {
  if (hasRequiredSymlink) return symlink;
  hasRequiredSymlink = 1;
  const u = requireUniversalify().fromCallback;
  const path = require$$1$2;
  const fs2 = /* @__PURE__ */ requireFs();
  const _mkdirs = /* @__PURE__ */ requireMkdirs();
  const mkdirs2 = _mkdirs.mkdirs;
  const mkdirsSync = _mkdirs.mkdirsSync;
  const _symlinkPaths = /* @__PURE__ */ requireSymlinkPaths();
  const symlinkPaths = _symlinkPaths.symlinkPaths;
  const symlinkPathsSync = _symlinkPaths.symlinkPathsSync;
  const _symlinkType = /* @__PURE__ */ requireSymlinkType();
  const symlinkType = _symlinkType.symlinkType;
  const symlinkTypeSync = _symlinkType.symlinkTypeSync;
  const pathExists = requirePathExists().pathExists;
  const { areIdentical } = /* @__PURE__ */ requireStat();
  function createSymlink(srcpath, dstpath, type, callback) {
    callback = typeof type === "function" ? type : callback;
    type = typeof type === "function" ? false : type;
    fs2.lstat(dstpath, (err, stats) => {
      if (!err && stats.isSymbolicLink()) {
        Promise.all([
          fs2.stat(srcpath),
          fs2.stat(dstpath)
        ]).then(([srcStat, dstStat]) => {
          if (areIdentical(srcStat, dstStat)) return callback(null);
          _createSymlink(srcpath, dstpath, type, callback);
        });
      } else _createSymlink(srcpath, dstpath, type, callback);
    });
  }
  function _createSymlink(srcpath, dstpath, type, callback) {
    symlinkPaths(srcpath, dstpath, (err, relative) => {
      if (err) return callback(err);
      srcpath = relative.toDst;
      symlinkType(relative.toCwd, type, (err2, type2) => {
        if (err2) return callback(err2);
        const dir = path.dirname(dstpath);
        pathExists(dir, (err3, dirExists) => {
          if (err3) return callback(err3);
          if (dirExists) return fs2.symlink(srcpath, dstpath, type2, callback);
          mkdirs2(dir, (err4) => {
            if (err4) return callback(err4);
            fs2.symlink(srcpath, dstpath, type2, callback);
          });
        });
      });
    });
  }
  function createSymlinkSync(srcpath, dstpath, type) {
    let stats;
    try {
      stats = fs2.lstatSync(dstpath);
    } catch {
    }
    if (stats && stats.isSymbolicLink()) {
      const srcStat = fs2.statSync(srcpath);
      const dstStat = fs2.statSync(dstpath);
      if (areIdentical(srcStat, dstStat)) return;
    }
    const relative = symlinkPathsSync(srcpath, dstpath);
    srcpath = relative.toDst;
    type = symlinkTypeSync(relative.toCwd, type);
    const dir = path.dirname(dstpath);
    const exists = fs2.existsSync(dir);
    if (exists) return fs2.symlinkSync(srcpath, dstpath, type);
    mkdirsSync(dir);
    return fs2.symlinkSync(srcpath, dstpath, type);
  }
  symlink = {
    createSymlink: u(createSymlink),
    createSymlinkSync
  };
  return symlink;
}
var ensure;
var hasRequiredEnsure;
function requireEnsure() {
  if (hasRequiredEnsure) return ensure;
  hasRequiredEnsure = 1;
  const { createFile, createFileSync } = /* @__PURE__ */ requireFile();
  const { createLink, createLinkSync } = /* @__PURE__ */ requireLink();
  const { createSymlink, createSymlinkSync } = /* @__PURE__ */ requireSymlink();
  ensure = {
    // file
    createFile,
    createFileSync,
    ensureFile: createFile,
    ensureFileSync: createFileSync,
    // link
    createLink,
    createLinkSync,
    ensureLink: createLink,
    ensureLinkSync: createLinkSync,
    // symlink
    createSymlink,
    createSymlinkSync,
    ensureSymlink: createSymlink,
    ensureSymlinkSync: createSymlinkSync
  };
  return ensure;
}
var utils;
var hasRequiredUtils;
function requireUtils() {
  if (hasRequiredUtils) return utils;
  hasRequiredUtils = 1;
  function stringify(obj, { EOL = "\n", finalEOL = true, replacer = null, spaces } = {}) {
    const EOF = finalEOL ? EOL : "";
    const str = JSON.stringify(obj, replacer, spaces);
    if (str === void 0) {
      throw new TypeError(`Converting ${typeof obj} value to JSON is not supported`);
    }
    return str.replace(/\n/g, EOL) + EOF;
  }
  function stripBom(content) {
    if (Buffer.isBuffer(content)) content = content.toString("utf8");
    return content.replace(/^\uFEFF/, "");
  }
  utils = { stringify, stripBom };
  return utils;
}
var jsonfile$1;
var hasRequiredJsonfile$1;
function requireJsonfile$1() {
  if (hasRequiredJsonfile$1) return jsonfile$1;
  hasRequiredJsonfile$1 = 1;
  let _fs;
  try {
    _fs = requireGracefulFs();
  } catch (_) {
    _fs = require$$2;
  }
  const universalify2 = requireUniversalify();
  const { stringify, stripBom } = requireUtils();
  async function _readFile(file2, options = {}) {
    if (typeof options === "string") {
      options = { encoding: options };
    }
    const fs2 = options.fs || _fs;
    const shouldThrow = "throws" in options ? options.throws : true;
    let data = await universalify2.fromCallback(fs2.readFile)(file2, options);
    data = stripBom(data);
    let obj;
    try {
      obj = JSON.parse(data, options ? options.reviver : null);
    } catch (err) {
      if (shouldThrow) {
        err.message = `${file2}: ${err.message}`;
        throw err;
      } else {
        return null;
      }
    }
    return obj;
  }
  const readFile = universalify2.fromPromise(_readFile);
  function readFileSync(file2, options = {}) {
    if (typeof options === "string") {
      options = { encoding: options };
    }
    const fs2 = options.fs || _fs;
    const shouldThrow = "throws" in options ? options.throws : true;
    try {
      let content = fs2.readFileSync(file2, options);
      content = stripBom(content);
      return JSON.parse(content, options.reviver);
    } catch (err) {
      if (shouldThrow) {
        err.message = `${file2}: ${err.message}`;
        throw err;
      } else {
        return null;
      }
    }
  }
  async function _writeFile(file2, obj, options = {}) {
    const fs2 = options.fs || _fs;
    const str = stringify(obj, options);
    await universalify2.fromCallback(fs2.writeFile)(file2, str, options);
  }
  const writeFile = universalify2.fromPromise(_writeFile);
  function writeFileSync(file2, obj, options = {}) {
    const fs2 = options.fs || _fs;
    const str = stringify(obj, options);
    return fs2.writeFileSync(file2, str, options);
  }
  jsonfile$1 = {
    readFile,
    readFileSync,
    writeFile,
    writeFileSync
  };
  return jsonfile$1;
}
var jsonfile;
var hasRequiredJsonfile;
function requireJsonfile() {
  if (hasRequiredJsonfile) return jsonfile;
  hasRequiredJsonfile = 1;
  const jsonFile = requireJsonfile$1();
  jsonfile = {
    // jsonfile exports
    readJson: jsonFile.readFile,
    readJsonSync: jsonFile.readFileSync,
    writeJson: jsonFile.writeFile,
    writeJsonSync: jsonFile.writeFileSync
  };
  return jsonfile;
}
var outputFile_1;
var hasRequiredOutputFile;
function requireOutputFile() {
  if (hasRequiredOutputFile) return outputFile_1;
  hasRequiredOutputFile = 1;
  const u = requireUniversalify().fromCallback;
  const fs2 = requireGracefulFs();
  const path = require$$1$2;
  const mkdir = /* @__PURE__ */ requireMkdirs();
  const pathExists = requirePathExists().pathExists;
  function outputFile(file2, data, encoding, callback) {
    if (typeof encoding === "function") {
      callback = encoding;
      encoding = "utf8";
    }
    const dir = path.dirname(file2);
    pathExists(dir, (err, itDoes) => {
      if (err) return callback(err);
      if (itDoes) return fs2.writeFile(file2, data, encoding, callback);
      mkdir.mkdirs(dir, (err2) => {
        if (err2) return callback(err2);
        fs2.writeFile(file2, data, encoding, callback);
      });
    });
  }
  function outputFileSync(file2, ...args) {
    const dir = path.dirname(file2);
    if (fs2.existsSync(dir)) {
      return fs2.writeFileSync(file2, ...args);
    }
    mkdir.mkdirsSync(dir);
    fs2.writeFileSync(file2, ...args);
  }
  outputFile_1 = {
    outputFile: u(outputFile),
    outputFileSync
  };
  return outputFile_1;
}
var outputJson_1;
var hasRequiredOutputJson;
function requireOutputJson() {
  if (hasRequiredOutputJson) return outputJson_1;
  hasRequiredOutputJson = 1;
  const { stringify } = requireUtils();
  const { outputFile } = /* @__PURE__ */ requireOutputFile();
  async function outputJson(file2, data, options = {}) {
    const str = stringify(data, options);
    await outputFile(file2, str, options);
  }
  outputJson_1 = outputJson;
  return outputJson_1;
}
var outputJsonSync_1;
var hasRequiredOutputJsonSync;
function requireOutputJsonSync() {
  if (hasRequiredOutputJsonSync) return outputJsonSync_1;
  hasRequiredOutputJsonSync = 1;
  const { stringify } = requireUtils();
  const { outputFileSync } = /* @__PURE__ */ requireOutputFile();
  function outputJsonSync(file2, data, options) {
    const str = stringify(data, options);
    outputFileSync(file2, str, options);
  }
  outputJsonSync_1 = outputJsonSync;
  return outputJsonSync_1;
}
var json;
var hasRequiredJson;
function requireJson() {
  if (hasRequiredJson) return json;
  hasRequiredJson = 1;
  const u = requireUniversalify().fromPromise;
  const jsonFile = /* @__PURE__ */ requireJsonfile();
  jsonFile.outputJson = u(/* @__PURE__ */ requireOutputJson());
  jsonFile.outputJsonSync = /* @__PURE__ */ requireOutputJsonSync();
  jsonFile.outputJSON = jsonFile.outputJson;
  jsonFile.outputJSONSync = jsonFile.outputJsonSync;
  jsonFile.writeJSON = jsonFile.writeJson;
  jsonFile.writeJSONSync = jsonFile.writeJsonSync;
  jsonFile.readJSON = jsonFile.readJson;
  jsonFile.readJSONSync = jsonFile.readJsonSync;
  json = jsonFile;
  return json;
}
var move_1;
var hasRequiredMove$1;
function requireMove$1() {
  if (hasRequiredMove$1) return move_1;
  hasRequiredMove$1 = 1;
  const fs2 = requireGracefulFs();
  const path = require$$1$2;
  const copy2 = requireCopy().copy;
  const remove = requireRemove().remove;
  const mkdirp = requireMkdirs().mkdirp;
  const pathExists = requirePathExists().pathExists;
  const stat2 = /* @__PURE__ */ requireStat();
  function move2(src2, dest, opts, cb) {
    if (typeof opts === "function") {
      cb = opts;
      opts = {};
    }
    opts = opts || {};
    const overwrite = opts.overwrite || opts.clobber || false;
    stat2.checkPaths(src2, dest, "move", opts, (err, stats) => {
      if (err) return cb(err);
      const { srcStat, isChangingCase = false } = stats;
      stat2.checkParentPaths(src2, srcStat, dest, "move", (err2) => {
        if (err2) return cb(err2);
        if (isParentRoot(dest)) return doRename(src2, dest, overwrite, isChangingCase, cb);
        mkdirp(path.dirname(dest), (err3) => {
          if (err3) return cb(err3);
          return doRename(src2, dest, overwrite, isChangingCase, cb);
        });
      });
    });
  }
  function isParentRoot(dest) {
    const parent = path.dirname(dest);
    const parsedPath = path.parse(parent);
    return parsedPath.root === parent;
  }
  function doRename(src2, dest, overwrite, isChangingCase, cb) {
    if (isChangingCase) return rename(src2, dest, overwrite, cb);
    if (overwrite) {
      return remove(dest, (err) => {
        if (err) return cb(err);
        return rename(src2, dest, overwrite, cb);
      });
    }
    pathExists(dest, (err, destExists) => {
      if (err) return cb(err);
      if (destExists) return cb(new Error("dest already exists."));
      return rename(src2, dest, overwrite, cb);
    });
  }
  function rename(src2, dest, overwrite, cb) {
    fs2.rename(src2, dest, (err) => {
      if (!err) return cb();
      if (err.code !== "EXDEV") return cb(err);
      return moveAcrossDevice(src2, dest, overwrite, cb);
    });
  }
  function moveAcrossDevice(src2, dest, overwrite, cb) {
    const opts = {
      overwrite,
      errorOnExist: true
    };
    copy2(src2, dest, opts, (err) => {
      if (err) return cb(err);
      return remove(src2, cb);
    });
  }
  move_1 = move2;
  return move_1;
}
var moveSync_1;
var hasRequiredMoveSync;
function requireMoveSync() {
  if (hasRequiredMoveSync) return moveSync_1;
  hasRequiredMoveSync = 1;
  const fs2 = requireGracefulFs();
  const path = require$$1$2;
  const copySync = requireCopy().copySync;
  const removeSync = requireRemove().removeSync;
  const mkdirpSync = requireMkdirs().mkdirpSync;
  const stat2 = /* @__PURE__ */ requireStat();
  function moveSync(src2, dest, opts) {
    opts = opts || {};
    const overwrite = opts.overwrite || opts.clobber || false;
    const { srcStat, isChangingCase = false } = stat2.checkPathsSync(src2, dest, "move", opts);
    stat2.checkParentPathsSync(src2, srcStat, dest, "move");
    if (!isParentRoot(dest)) mkdirpSync(path.dirname(dest));
    return doRename(src2, dest, overwrite, isChangingCase);
  }
  function isParentRoot(dest) {
    const parent = path.dirname(dest);
    const parsedPath = path.parse(parent);
    return parsedPath.root === parent;
  }
  function doRename(src2, dest, overwrite, isChangingCase) {
    if (isChangingCase) return rename(src2, dest, overwrite);
    if (overwrite) {
      removeSync(dest);
      return rename(src2, dest, overwrite);
    }
    if (fs2.existsSync(dest)) throw new Error("dest already exists.");
    return rename(src2, dest, overwrite);
  }
  function rename(src2, dest, overwrite) {
    try {
      fs2.renameSync(src2, dest);
    } catch (err) {
      if (err.code !== "EXDEV") throw err;
      return moveAcrossDevice(src2, dest, overwrite);
    }
  }
  function moveAcrossDevice(src2, dest, overwrite) {
    const opts = {
      overwrite,
      errorOnExist: true
    };
    copySync(src2, dest, opts);
    return removeSync(src2);
  }
  moveSync_1 = moveSync;
  return moveSync_1;
}
var move;
var hasRequiredMove;
function requireMove() {
  if (hasRequiredMove) return move;
  hasRequiredMove = 1;
  const u = requireUniversalify().fromCallback;
  move = {
    move: u(/* @__PURE__ */ requireMove$1()),
    moveSync: /* @__PURE__ */ requireMoveSync()
  };
  return move;
}
var lib;
var hasRequiredLib;
function requireLib() {
  if (hasRequiredLib) return lib;
  hasRequiredLib = 1;
  lib = {
    // Export promiseified graceful-fs:
    .../* @__PURE__ */ requireFs(),
    // Export extra methods:
    .../* @__PURE__ */ requireCopy(),
    .../* @__PURE__ */ requireEmpty(),
    .../* @__PURE__ */ requireEnsure(),
    .../* @__PURE__ */ requireJson(),
    .../* @__PURE__ */ requireMkdirs(),
    .../* @__PURE__ */ requireMove(),
    .../* @__PURE__ */ requireOutputFile(),
    .../* @__PURE__ */ requirePathExists(),
    .../* @__PURE__ */ requireRemove()
  };
  return lib;
}
var BaseUpdater = {};
var AppUpdater = {};
var out = {};
var CancellationToken = {};
var hasRequiredCancellationToken;
function requireCancellationToken() {
  if (hasRequiredCancellationToken) return CancellationToken;
  hasRequiredCancellationToken = 1;
  Object.defineProperty(CancellationToken, "__esModule", { value: true });
  CancellationToken.CancellationError = CancellationToken.CancellationToken = void 0;
  const events_1 = require$$0$2;
  let CancellationToken$1 = class CancellationToken extends events_1.EventEmitter {
    get cancelled() {
      return this._cancelled || this._parent != null && this._parent.cancelled;
    }
    set parent(value) {
      this.removeParentCancelHandler();
      this._parent = value;
      this.parentCancelHandler = () => this.cancel();
      this._parent.onCancel(this.parentCancelHandler);
    }
    // babel cannot compile ... correctly for super calls
    constructor(parent) {
      super();
      this.parentCancelHandler = null;
      this._parent = null;
      this._cancelled = false;
      if (parent != null) {
        this.parent = parent;
      }
    }
    cancel() {
      this._cancelled = true;
      this.emit("cancel");
    }
    onCancel(handler) {
      if (this.cancelled) {
        handler();
      } else {
        this.once("cancel", handler);
      }
    }
    createPromise(callback) {
      if (this.cancelled) {
        return Promise.reject(new CancellationError());
      }
      const finallyHandler = () => {
        if (cancelHandler != null) {
          try {
            this.removeListener("cancel", cancelHandler);
            cancelHandler = null;
          } catch (_ignore) {
          }
        }
      };
      let cancelHandler = null;
      return new Promise((resolve, reject) => {
        let addedCancelHandler = null;
        cancelHandler = () => {
          try {
            if (addedCancelHandler != null) {
              addedCancelHandler();
              addedCancelHandler = null;
            }
          } finally {
            reject(new CancellationError());
          }
        };
        if (this.cancelled) {
          cancelHandler();
          return;
        }
        this.onCancel(cancelHandler);
        callback(resolve, reject, (callback2) => {
          addedCancelHandler = callback2;
        });
      }).then((it) => {
        finallyHandler();
        return it;
      }).catch((e) => {
        finallyHandler();
        throw e;
      });
    }
    removeParentCancelHandler() {
      const parent = this._parent;
      if (parent != null && this.parentCancelHandler != null) {
        parent.removeListener("cancel", this.parentCancelHandler);
        this.parentCancelHandler = null;
      }
    }
    dispose() {
      try {
        this.removeParentCancelHandler();
      } finally {
        this.removeAllListeners();
        this._parent = null;
      }
    }
  };
  CancellationToken.CancellationToken = CancellationToken$1;
  class CancellationError extends Error {
    constructor() {
      super("cancelled");
    }
  }
  CancellationToken.CancellationError = CancellationError;
  return CancellationToken;
}
var error = {};
var hasRequiredError;
function requireError() {
  if (hasRequiredError) return error;
  hasRequiredError = 1;
  Object.defineProperty(error, "__esModule", { value: true });
  error.newError = newError;
  function newError(message, code) {
    const error2 = new Error(message);
    error2.code = code;
    return error2;
  }
  return error;
}
var httpExecutor = {};
var src = { exports: {} };
var browser = { exports: {} };
var ms;
var hasRequiredMs;
function requireMs() {
  if (hasRequiredMs) return ms;
  hasRequiredMs = 1;
  var s = 1e3;
  var m = s * 60;
  var h = m * 60;
  var d = h * 24;
  var w = d * 7;
  var y = d * 365.25;
  ms = function(val, options) {
    options = options || {};
    var type = typeof val;
    if (type === "string" && val.length > 0) {
      return parse(val);
    } else if (type === "number" && isFinite(val)) {
      return options.long ? fmtLong(val) : fmtShort(val);
    }
    throw new Error(
      "val is not a non-empty string or a valid number. val=" + JSON.stringify(val)
    );
  };
  function parse(str) {
    str = String(str);
    if (str.length > 100) {
      return;
    }
    var match = /^(-?(?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)?$/i.exec(
      str
    );
    if (!match) {
      return;
    }
    var n = parseFloat(match[1]);
    var type = (match[2] || "ms").toLowerCase();
    switch (type) {
      case "years":
      case "year":
      case "yrs":
      case "yr":
      case "y":
        return n * y;
      case "weeks":
      case "week":
      case "w":
        return n * w;
      case "days":
      case "day":
      case "d":
        return n * d;
      case "hours":
      case "hour":
      case "hrs":
      case "hr":
      case "h":
        return n * h;
      case "minutes":
      case "minute":
      case "mins":
      case "min":
      case "m":
        return n * m;
      case "seconds":
      case "second":
      case "secs":
      case "sec":
      case "s":
        return n * s;
      case "milliseconds":
      case "millisecond":
      case "msecs":
      case "msec":
      case "ms":
        return n;
      default:
        return void 0;
    }
  }
  function fmtShort(ms2) {
    var msAbs = Math.abs(ms2);
    if (msAbs >= d) {
      return Math.round(ms2 / d) + "d";
    }
    if (msAbs >= h) {
      return Math.round(ms2 / h) + "h";
    }
    if (msAbs >= m) {
      return Math.round(ms2 / m) + "m";
    }
    if (msAbs >= s) {
      return Math.round(ms2 / s) + "s";
    }
    return ms2 + "ms";
  }
  function fmtLong(ms2) {
    var msAbs = Math.abs(ms2);
    if (msAbs >= d) {
      return plural(ms2, msAbs, d, "day");
    }
    if (msAbs >= h) {
      return plural(ms2, msAbs, h, "hour");
    }
    if (msAbs >= m) {
      return plural(ms2, msAbs, m, "minute");
    }
    if (msAbs >= s) {
      return plural(ms2, msAbs, s, "second");
    }
    return ms2 + " ms";
  }
  function plural(ms2, msAbs, n, name) {
    var isPlural = msAbs >= n * 1.5;
    return Math.round(ms2 / n) + " " + name + (isPlural ? "s" : "");
  }
  return ms;
}
var common;
var hasRequiredCommon;
function requireCommon() {
  if (hasRequiredCommon) return common;
  hasRequiredCommon = 1;
  function setup(env) {
    createDebug.debug = createDebug;
    createDebug.default = createDebug;
    createDebug.coerce = coerce;
    createDebug.disable = disable;
    createDebug.enable = enable;
    createDebug.enabled = enabled;
    createDebug.humanize = requireMs();
    createDebug.destroy = destroy;
    Object.keys(env).forEach((key) => {
      createDebug[key] = env[key];
    });
    createDebug.names = [];
    createDebug.skips = [];
    createDebug.formatters = {};
    function selectColor(namespace) {
      let hash = 0;
      for (let i = 0; i < namespace.length; i++) {
        hash = (hash << 5) - hash + namespace.charCodeAt(i);
        hash |= 0;
      }
      return createDebug.colors[Math.abs(hash) % createDebug.colors.length];
    }
    createDebug.selectColor = selectColor;
    function createDebug(namespace) {
      let prevTime;
      let enableOverride = null;
      let namespacesCache;
      let enabledCache;
      function debug(...args) {
        if (!debug.enabled) {
          return;
        }
        const self2 = debug;
        const curr = Number(/* @__PURE__ */ new Date());
        const ms2 = curr - (prevTime || curr);
        self2.diff = ms2;
        self2.prev = prevTime;
        self2.curr = curr;
        prevTime = curr;
        args[0] = createDebug.coerce(args[0]);
        if (typeof args[0] !== "string") {
          args.unshift("%O");
        }
        let index2 = 0;
        args[0] = args[0].replace(/%([a-zA-Z%])/g, (match, format) => {
          if (match === "%%") {
            return "%";
          }
          index2++;
          const formatter = createDebug.formatters[format];
          if (typeof formatter === "function") {
            const val = args[index2];
            match = formatter.call(self2, val);
            args.splice(index2, 1);
            index2--;
          }
          return match;
        });
        createDebug.formatArgs.call(self2, args);
        const logFn = self2.log || createDebug.log;
        logFn.apply(self2, args);
      }
      debug.namespace = namespace;
      debug.useColors = createDebug.useColors();
      debug.color = createDebug.selectColor(namespace);
      debug.extend = extend;
      debug.destroy = createDebug.destroy;
      Object.defineProperty(debug, "enabled", {
        enumerable: true,
        configurable: false,
        get: () => {
          if (enableOverride !== null) {
            return enableOverride;
          }
          if (namespacesCache !== createDebug.namespaces) {
            namespacesCache = createDebug.namespaces;
            enabledCache = createDebug.enabled(namespace);
          }
          return enabledCache;
        },
        set: (v) => {
          enableOverride = v;
        }
      });
      if (typeof createDebug.init === "function") {
        createDebug.init(debug);
      }
      return debug;
    }
    function extend(namespace, delimiter) {
      const newDebug = createDebug(this.namespace + (typeof delimiter === "undefined" ? ":" : delimiter) + namespace);
      newDebug.log = this.log;
      return newDebug;
    }
    function enable(namespaces) {
      createDebug.save(namespaces);
      createDebug.namespaces = namespaces;
      createDebug.names = [];
      createDebug.skips = [];
      const split = (typeof namespaces === "string" ? namespaces : "").trim().replace(/\s+/g, ",").split(",").filter(Boolean);
      for (const ns of split) {
        if (ns[0] === "-") {
          createDebug.skips.push(ns.slice(1));
        } else {
          createDebug.names.push(ns);
        }
      }
    }
    function matchesTemplate(search, template) {
      let searchIndex = 0;
      let templateIndex = 0;
      let starIndex = -1;
      let matchIndex = 0;
      while (searchIndex < search.length) {
        if (templateIndex < template.length && (template[templateIndex] === search[searchIndex] || template[templateIndex] === "*")) {
          if (template[templateIndex] === "*") {
            starIndex = templateIndex;
            matchIndex = searchIndex;
            templateIndex++;
          } else {
            searchIndex++;
            templateIndex++;
          }
        } else if (starIndex !== -1) {
          templateIndex = starIndex + 1;
          matchIndex++;
          searchIndex = matchIndex;
        } else {
          return false;
        }
      }
      while (templateIndex < template.length && template[templateIndex] === "*") {
        templateIndex++;
      }
      return templateIndex === template.length;
    }
    function disable() {
      const namespaces = [
        ...createDebug.names,
        ...createDebug.skips.map((namespace) => "-" + namespace)
      ].join(",");
      createDebug.enable("");
      return namespaces;
    }
    function enabled(name) {
      for (const skip of createDebug.skips) {
        if (matchesTemplate(name, skip)) {
          return false;
        }
      }
      for (const ns of createDebug.names) {
        if (matchesTemplate(name, ns)) {
          return true;
        }
      }
      return false;
    }
    function coerce(val) {
      if (val instanceof Error) {
        return val.stack || val.message;
      }
      return val;
    }
    function destroy() {
      console.warn("Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.");
    }
    createDebug.enable(createDebug.load());
    return createDebug;
  }
  common = setup;
  return common;
}
var hasRequiredBrowser;
function requireBrowser() {
  if (hasRequiredBrowser) return browser.exports;
  hasRequiredBrowser = 1;
  (function(module2, exports2) {
    exports2.formatArgs = formatArgs;
    exports2.save = save;
    exports2.load = load2;
    exports2.useColors = useColors;
    exports2.storage = localstorage();
    exports2.destroy = /* @__PURE__ */ (() => {
      let warned = false;
      return () => {
        if (!warned) {
          warned = true;
          console.warn("Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.");
        }
      };
    })();
    exports2.colors = [
      "#0000CC",
      "#0000FF",
      "#0033CC",
      "#0033FF",
      "#0066CC",
      "#0066FF",
      "#0099CC",
      "#0099FF",
      "#00CC00",
      "#00CC33",
      "#00CC66",
      "#00CC99",
      "#00CCCC",
      "#00CCFF",
      "#3300CC",
      "#3300FF",
      "#3333CC",
      "#3333FF",
      "#3366CC",
      "#3366FF",
      "#3399CC",
      "#3399FF",
      "#33CC00",
      "#33CC33",
      "#33CC66",
      "#33CC99",
      "#33CCCC",
      "#33CCFF",
      "#6600CC",
      "#6600FF",
      "#6633CC",
      "#6633FF",
      "#66CC00",
      "#66CC33",
      "#9900CC",
      "#9900FF",
      "#9933CC",
      "#9933FF",
      "#99CC00",
      "#99CC33",
      "#CC0000",
      "#CC0033",
      "#CC0066",
      "#CC0099",
      "#CC00CC",
      "#CC00FF",
      "#CC3300",
      "#CC3333",
      "#CC3366",
      "#CC3399",
      "#CC33CC",
      "#CC33FF",
      "#CC6600",
      "#CC6633",
      "#CC9900",
      "#CC9933",
      "#CCCC00",
      "#CCCC33",
      "#FF0000",
      "#FF0033",
      "#FF0066",
      "#FF0099",
      "#FF00CC",
      "#FF00FF",
      "#FF3300",
      "#FF3333",
      "#FF3366",
      "#FF3399",
      "#FF33CC",
      "#FF33FF",
      "#FF6600",
      "#FF6633",
      "#FF9900",
      "#FF9933",
      "#FFCC00",
      "#FFCC33"
    ];
    function useColors() {
      if (typeof window !== "undefined" && window.process && (window.process.type === "renderer" || window.process.__nwjs)) {
        return true;
      }
      if (typeof navigator !== "undefined" && navigator.userAgent && navigator.userAgent.toLowerCase().match(/(edge|trident)\/(\d+)/)) {
        return false;
      }
      let m;
      return typeof document !== "undefined" && document.documentElement && document.documentElement.style && document.documentElement.style.WebkitAppearance || // Is firebug? http://stackoverflow.com/a/398120/376773
      typeof window !== "undefined" && window.console && (window.console.firebug || window.console.exception && window.console.table) || // Is firefox >= v31?
      // https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
      typeof navigator !== "undefined" && navigator.userAgent && (m = navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/)) && parseInt(m[1], 10) >= 31 || // Double check webkit in userAgent just in case we are in a worker
      typeof navigator !== "undefined" && navigator.userAgent && navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/);
    }
    function formatArgs(args) {
      args[0] = (this.useColors ? "%c" : "") + this.namespace + (this.useColors ? " %c" : " ") + args[0] + (this.useColors ? "%c " : " ") + "+" + module2.exports.humanize(this.diff);
      if (!this.useColors) {
        return;
      }
      const c = "color: " + this.color;
      args.splice(1, 0, c, "color: inherit");
      let index2 = 0;
      let lastC = 0;
      args[0].replace(/%[a-zA-Z%]/g, (match) => {
        if (match === "%%") {
          return;
        }
        index2++;
        if (match === "%c") {
          lastC = index2;
        }
      });
      args.splice(lastC, 0, c);
    }
    exports2.log = console.debug || console.log || (() => {
    });
    function save(namespaces) {
      try {
        if (namespaces) {
          exports2.storage.setItem("debug", namespaces);
        } else {
          exports2.storage.removeItem("debug");
        }
      } catch (error2) {
      }
    }
    function load2() {
      let r;
      try {
        r = exports2.storage.getItem("debug") || exports2.storage.getItem("DEBUG");
      } catch (error2) {
      }
      if (!r && typeof process !== "undefined" && "env" in process) {
        r = process.env.DEBUG;
      }
      return r;
    }
    function localstorage() {
      try {
        return localStorage;
      } catch (error2) {
      }
    }
    module2.exports = requireCommon()(exports2);
    const { formatters } = module2.exports;
    formatters.j = function(v) {
      try {
        return JSON.stringify(v);
      } catch (error2) {
        return "[UnexpectedJSONParseError]: " + error2.message;
      }
    };
  })(browser, browser.exports);
  return browser.exports;
}
var node = { exports: {} };
var hasFlag;
var hasRequiredHasFlag;
function requireHasFlag() {
  if (hasRequiredHasFlag) return hasFlag;
  hasRequiredHasFlag = 1;
  hasFlag = (flag, argv = process.argv) => {
    const prefix = flag.startsWith("-") ? "" : flag.length === 1 ? "-" : "--";
    const position = argv.indexOf(prefix + flag);
    const terminatorPosition = argv.indexOf("--");
    return position !== -1 && (terminatorPosition === -1 || position < terminatorPosition);
  };
  return hasFlag;
}
var supportsColor_1;
var hasRequiredSupportsColor;
function requireSupportsColor() {
  if (hasRequiredSupportsColor) return supportsColor_1;
  hasRequiredSupportsColor = 1;
  const os = require$$3;
  const tty = require$$1$3;
  const hasFlag2 = requireHasFlag();
  const { env } = process;
  let forceColor;
  if (hasFlag2("no-color") || hasFlag2("no-colors") || hasFlag2("color=false") || hasFlag2("color=never")) {
    forceColor = 0;
  } else if (hasFlag2("color") || hasFlag2("colors") || hasFlag2("color=true") || hasFlag2("color=always")) {
    forceColor = 1;
  }
  if ("FORCE_COLOR" in env) {
    if (env.FORCE_COLOR === "true") {
      forceColor = 1;
    } else if (env.FORCE_COLOR === "false") {
      forceColor = 0;
    } else {
      forceColor = env.FORCE_COLOR.length === 0 ? 1 : Math.min(parseInt(env.FORCE_COLOR, 10), 3);
    }
  }
  function translateLevel(level) {
    if (level === 0) {
      return false;
    }
    return {
      level,
      hasBasic: true,
      has256: level >= 2,
      has16m: level >= 3
    };
  }
  function supportsColor(haveStream, streamIsTTY) {
    if (forceColor === 0) {
      return 0;
    }
    if (hasFlag2("color=16m") || hasFlag2("color=full") || hasFlag2("color=truecolor")) {
      return 3;
    }
    if (hasFlag2("color=256")) {
      return 2;
    }
    if (haveStream && !streamIsTTY && forceColor === void 0) {
      return 0;
    }
    const min = forceColor || 0;
    if (env.TERM === "dumb") {
      return min;
    }
    if (process.platform === "win32") {
      const osRelease = os.release().split(".");
      if (Number(osRelease[0]) >= 10 && Number(osRelease[2]) >= 10586) {
        return Number(osRelease[2]) >= 14931 ? 3 : 2;
      }
      return 1;
    }
    if ("CI" in env) {
      if (["TRAVIS", "CIRCLECI", "APPVEYOR", "GITLAB_CI", "GITHUB_ACTIONS", "BUILDKITE"].some((sign) => sign in env) || env.CI_NAME === "codeship") {
        return 1;
      }
      return min;
    }
    if ("TEAMCITY_VERSION" in env) {
      return /^(9\.(0*[1-9]\d*)\.|\d{2,}\.)/.test(env.TEAMCITY_VERSION) ? 1 : 0;
    }
    if (env.COLORTERM === "truecolor") {
      return 3;
    }
    if ("TERM_PROGRAM" in env) {
      const version = parseInt((env.TERM_PROGRAM_VERSION || "").split(".")[0], 10);
      switch (env.TERM_PROGRAM) {
        case "iTerm.app":
          return version >= 3 ? 3 : 2;
        case "Apple_Terminal":
          return 2;
      }
    }
    if (/-256(color)?$/i.test(env.TERM)) {
      return 2;
    }
    if (/^screen|^xterm|^vt100|^vt220|^rxvt|color|ansi|cygwin|linux/i.test(env.TERM)) {
      return 1;
    }
    if ("COLORTERM" in env) {
      return 1;
    }
    return min;
  }
  function getSupportLevel(stream) {
    const level = supportsColor(stream, stream && stream.isTTY);
    return translateLevel(level);
  }
  supportsColor_1 = {
    supportsColor: getSupportLevel,
    stdout: translateLevel(supportsColor(true, tty.isatty(1))),
    stderr: translateLevel(supportsColor(true, tty.isatty(2)))
  };
  return supportsColor_1;
}
var hasRequiredNode;
function requireNode() {
  if (hasRequiredNode) return node.exports;
  hasRequiredNode = 1;
  (function(module2, exports2) {
    const tty = require$$1$3;
    const util2 = require$$4;
    exports2.init = init;
    exports2.log = log;
    exports2.formatArgs = formatArgs;
    exports2.save = save;
    exports2.load = load2;
    exports2.useColors = useColors;
    exports2.destroy = util2.deprecate(
      () => {
      },
      "Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`."
    );
    exports2.colors = [6, 2, 3, 4, 5, 1];
    try {
      const supportsColor = requireSupportsColor();
      if (supportsColor && (supportsColor.stderr || supportsColor).level >= 2) {
        exports2.colors = [
          20,
          21,
          26,
          27,
          32,
          33,
          38,
          39,
          40,
          41,
          42,
          43,
          44,
          45,
          56,
          57,
          62,
          63,
          68,
          69,
          74,
          75,
          76,
          77,
          78,
          79,
          80,
          81,
          92,
          93,
          98,
          99,
          112,
          113,
          128,
          129,
          134,
          135,
          148,
          149,
          160,
          161,
          162,
          163,
          164,
          165,
          166,
          167,
          168,
          169,
          170,
          171,
          172,
          173,
          178,
          179,
          184,
          185,
          196,
          197,
          198,
          199,
          200,
          201,
          202,
          203,
          204,
          205,
          206,
          207,
          208,
          209,
          214,
          215,
          220,
          221
        ];
      }
    } catch (error2) {
    }
    exports2.inspectOpts = Object.keys(process.env).filter((key) => {
      return /^debug_/i.test(key);
    }).reduce((obj, key) => {
      const prop = key.substring(6).toLowerCase().replace(/_([a-z])/g, (_, k) => {
        return k.toUpperCase();
      });
      let val = process.env[key];
      if (/^(yes|on|true|enabled)$/i.test(val)) {
        val = true;
      } else if (/^(no|off|false|disabled)$/i.test(val)) {
        val = false;
      } else if (val === "null") {
        val = null;
      } else {
        val = Number(val);
      }
      obj[prop] = val;
      return obj;
    }, {});
    function useColors() {
      return "colors" in exports2.inspectOpts ? Boolean(exports2.inspectOpts.colors) : tty.isatty(process.stderr.fd);
    }
    function formatArgs(args) {
      const { namespace: name, useColors: useColors2 } = this;
      if (useColors2) {
        const c = this.color;
        const colorCode = "\x1B[3" + (c < 8 ? c : "8;5;" + c);
        const prefix = `  ${colorCode};1m${name} \x1B[0m`;
        args[0] = prefix + args[0].split("\n").join("\n" + prefix);
        args.push(colorCode + "m+" + module2.exports.humanize(this.diff) + "\x1B[0m");
      } else {
        args[0] = getDate() + name + " " + args[0];
      }
    }
    function getDate() {
      if (exports2.inspectOpts.hideDate) {
        return "";
      }
      return (/* @__PURE__ */ new Date()).toISOString() + " ";
    }
    function log(...args) {
      return process.stderr.write(util2.formatWithOptions(exports2.inspectOpts, ...args) + "\n");
    }
    function save(namespaces) {
      if (namespaces) {
        process.env.DEBUG = namespaces;
      } else {
        delete process.env.DEBUG;
      }
    }
    function load2() {
      return process.env.DEBUG;
    }
    function init(debug) {
      debug.inspectOpts = {};
      const keys = Object.keys(exports2.inspectOpts);
      for (let i = 0; i < keys.length; i++) {
        debug.inspectOpts[keys[i]] = exports2.inspectOpts[keys[i]];
      }
    }
    module2.exports = requireCommon()(exports2);
    const { formatters } = module2.exports;
    formatters.o = function(v) {
      this.inspectOpts.colors = this.useColors;
      return util2.inspect(v, this.inspectOpts).split("\n").map((str) => str.trim()).join(" ");
    };
    formatters.O = function(v) {
      this.inspectOpts.colors = this.useColors;
      return util2.inspect(v, this.inspectOpts);
    };
  })(node, node.exports);
  return node.exports;
}
var hasRequiredSrc;
function requireSrc() {
  if (hasRequiredSrc) return src.exports;
  hasRequiredSrc = 1;
  if (typeof process === "undefined" || process.type === "renderer" || process.browser === true || process.__nwjs) {
    src.exports = requireBrowser();
  } else {
    src.exports = requireNode();
  }
  return src.exports;
}
var ProgressCallbackTransform = {};
var hasRequiredProgressCallbackTransform;
function requireProgressCallbackTransform() {
  if (hasRequiredProgressCallbackTransform) return ProgressCallbackTransform;
  hasRequiredProgressCallbackTransform = 1;
  Object.defineProperty(ProgressCallbackTransform, "__esModule", { value: true });
  ProgressCallbackTransform.ProgressCallbackTransform = void 0;
  const stream_1 = require$$0$1;
  let ProgressCallbackTransform$1 = class ProgressCallbackTransform extends stream_1.Transform {
    constructor(total, cancellationToken, onProgress) {
      super();
      this.total = total;
      this.cancellationToken = cancellationToken;
      this.onProgress = onProgress;
      this.start = Date.now();
      this.transferred = 0;
      this.delta = 0;
      this.nextUpdate = this.start + 1e3;
    }
    _transform(chunk, encoding, callback) {
      if (this.cancellationToken.cancelled) {
        callback(new Error("cancelled"), null);
        return;
      }
      this.transferred += chunk.length;
      this.delta += chunk.length;
      const now = Date.now();
      if (now >= this.nextUpdate && this.transferred !== this.total) {
        this.nextUpdate = now + 1e3;
        this.onProgress({
          total: this.total,
          delta: this.delta,
          transferred: this.transferred,
          percent: this.transferred / this.total * 100,
          bytesPerSecond: Math.round(this.transferred / ((now - this.start) / 1e3))
        });
        this.delta = 0;
      }
      callback(null, chunk);
    }
    _flush(callback) {
      if (this.cancellationToken.cancelled) {
        callback(new Error("cancelled"));
        return;
      }
      this.onProgress({
        total: this.total,
        delta: this.delta,
        transferred: this.total,
        percent: 100,
        bytesPerSecond: Math.round(this.transferred / ((Date.now() - this.start) / 1e3))
      });
      this.delta = 0;
      callback(null);
    }
  };
  ProgressCallbackTransform.ProgressCallbackTransform = ProgressCallbackTransform$1;
  return ProgressCallbackTransform;
}
var hasRequiredHttpExecutor;
function requireHttpExecutor() {
  if (hasRequiredHttpExecutor) return httpExecutor;
  hasRequiredHttpExecutor = 1;
  Object.defineProperty(httpExecutor, "__esModule", { value: true });
  httpExecutor.DigestTransform = httpExecutor.HttpExecutor = httpExecutor.HttpError = void 0;
  httpExecutor.addSensitiveRedirectHeader = addSensitiveRedirectHeader;
  httpExecutor.addSensitiveFieldPattern = addSensitiveFieldPattern;
  httpExecutor.createHttpError = createHttpError;
  httpExecutor.parseJson = parseJson;
  httpExecutor.configureRequestOptionsFromUrl = configureRequestOptionsFromUrl;
  httpExecutor.configureRequestUrl = configureRequestUrl;
  httpExecutor.safeGetHeader = safeGetHeader;
  httpExecutor.configureRequestOptions = configureRequestOptions;
  httpExecutor.isSensitiveFieldName = isSensitiveFieldName;
  httpExecutor.hashSensitiveValue = hashSensitiveValue;
  httpExecutor.safeStringifyJson = safeStringifyJson;
  const crypto_1 = require$$0$3;
  const debug_12 = requireSrc();
  const fs_1 = require$$2;
  const stream_1 = require$$0$1;
  const url_1 = require$$2$1;
  const CancellationToken_1 = requireCancellationToken();
  const error_1 = requireError();
  const ProgressCallbackTransform_1 = requireProgressCallbackTransform();
  const debug = (0, debug_12.default)("electron-builder");
  const normalizeName = (name) => name.toLowerCase().replace(/[-_]/g, "");
  const SENSITIVE_REDIRECT_HEADERS = /* @__PURE__ */ new Set(["authorization", "proxyauthorization", "privatetoken", "xapikey", "xauthtoken", "xaccesstoken", "xgitlabtoken", "cookie", "xcsrftoken"]);
  const SENSITIVE_FIELD_PATTERNS = ["token", "password", "secret", "authorization", "credential", "apikey", "passphrase", "auth"];
  const SENSITIVE_FIELD_SUFFIXES = ["key"];
  function addSensitiveRedirectHeader(header) {
    SENSITIVE_REDIRECT_HEADERS.add(normalizeName(header));
  }
  function addSensitiveFieldPattern(pattern) {
    SENSITIVE_FIELD_PATTERNS.push(pattern.toLowerCase().replace(/[-_]/g, ""));
  }
  function createHttpError(response, description = null) {
    return new HttpError(response.statusCode || -1, `${response.statusCode} ${response.statusMessage}` + (description == null ? "" : "\n" + JSON.stringify(description, null, "  ")) + "\nHeaders: " + safeStringifyJson(response.headers), description);
  }
  const HTTP_STATUS_CODES = /* @__PURE__ */ new Map([
    [429, "Too many requests"],
    [400, "Bad request"],
    [403, "Forbidden"],
    [404, "Not found"],
    [405, "Method not allowed"],
    [406, "Not acceptable"],
    [408, "Request timeout"],
    [413, "Request entity too large"],
    [500, "Internal server error"],
    [502, "Bad gateway"],
    [503, "Service unavailable"],
    [504, "Gateway timeout"],
    [505, "HTTP version not supported"]
  ]);
  class HttpError extends Error {
    constructor(statusCode, message = `HTTP error: ${HTTP_STATUS_CODES.get(statusCode) || statusCode}`, description = null) {
      super(message);
      this.statusCode = statusCode;
      this.description = description;
      this.name = "HttpError";
      this.code = `HTTP_ERROR_${statusCode}`;
    }
    isServerError() {
      return this.statusCode >= 500 && this.statusCode <= 599;
    }
  }
  httpExecutor.HttpError = HttpError;
  function parseJson(result) {
    return result.then((it) => it == null || it.length === 0 ? null : JSON.parse(it));
  }
  class HttpExecutor {
    constructor() {
      this.maxRedirects = 10;
    }
    request(options, cancellationToken = new CancellationToken_1.CancellationToken(), data) {
      configureRequestOptions(options);
      const json2 = data == null ? void 0 : JSON.stringify(data);
      const encodedData = json2 ? Buffer.from(json2) : void 0;
      if (encodedData != null) {
        if (debug.enabled) {
          debug(safeStringifyJson(data));
        }
        const { headers, ...opts } = options;
        options = {
          method: "post",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": encodedData.length,
            ...headers
          },
          ...opts
        };
      }
      return this.doApiRequest(options, cancellationToken, (it) => it.end(encodedData));
    }
    doApiRequest(options, cancellationToken, requestProcessor, redirectCount = 0) {
      if (debug.enabled) {
        const { headers: _headers, auth: _auth, ...safeOptions } = options;
        debug(`Request: ${safeStringifyJson(safeOptions)}`);
      }
      return cancellationToken.createPromise((resolve, reject, onCancel) => {
        const request = this.createRequest(options, (response) => {
          try {
            this.handleResponse(response, options, cancellationToken, resolve, reject, redirectCount, requestProcessor);
          } catch (e) {
            reject(e);
          }
        });
        this.addErrorAndTimeoutHandlers(request, reject, options.timeout);
        this.addRedirectHandlers(request, options, reject, redirectCount, (options2) => {
          this.doApiRequest(options2, cancellationToken, requestProcessor, redirectCount).then(resolve).catch(reject);
        });
        requestProcessor(request, reject);
        onCancel(() => request.abort());
      });
    }
    // noinspection JSUnusedLocalSymbols
    // eslint-disable-next-line
    addRedirectHandlers(request, options, reject, redirectCount, handler) {
    }
    addErrorAndTimeoutHandlers(request, reject, timeout = 60 * 1e3) {
      this.addTimeOutHandler(request, reject, timeout);
      request.on("error", reject);
      request.on("aborted", () => {
        reject(new Error("Request has been aborted by the server"));
      });
    }
    handleResponse(response, options, cancellationToken, resolve, reject, redirectCount, requestProcessor) {
      var _a;
      if (debug.enabled) {
        const { headers: _headers, auth: _auth, ...safeOptions } = options;
        debug(`Response: ${response.statusCode} ${response.statusMessage}, request options: ${safeStringifyJson(safeOptions)}`);
      }
      if (response.statusCode === 404) {
        reject(createHttpError(response, `method: ${options.method || "GET"} url: ${options.protocol || "https:"}//${options.hostname}${options.port ? `:${options.port}` : ""}${options.path}

Please double check that your authentication token is correct. Due to security reasons, actual status maybe not reported, but 404.
`));
        return;
      } else if (response.statusCode === 204) {
        resolve();
        return;
      }
      const code = (_a = response.statusCode) !== null && _a !== void 0 ? _a : 0;
      const shouldRedirect = code >= 300 && code < 400;
      const redirectUrl = safeGetHeader(response, "location");
      if (shouldRedirect && redirectUrl != null) {
        if (redirectCount > this.maxRedirects) {
          reject(this.createMaxRedirectError());
          return;
        }
        this.doApiRequest(HttpExecutor.prepareRedirectUrlOptions(redirectUrl, options), cancellationToken, requestProcessor, redirectCount).then(resolve).catch(reject);
        return;
      }
      response.setEncoding("utf8");
      let data = "";
      response.on("error", reject);
      response.on("data", (chunk) => data += chunk);
      response.on("end", () => {
        try {
          if (response.statusCode != null && response.statusCode >= 400) {
            const contentType = safeGetHeader(response, "content-type");
            const isJson = contentType != null && (Array.isArray(contentType) ? contentType.find((it) => it.includes("json")) != null : contentType.includes("json"));
            reject(createHttpError(response, `method: ${options.method || "GET"} url: ${options.protocol || "https:"}//${options.hostname}${options.port ? `:${options.port}` : ""}${options.path}

          Data:
          ${isJson ? safeStringifyJson(JSON.parse(data)) : data}
          `));
          } else {
            resolve(data.length === 0 ? null : data);
          }
        } catch (e) {
          reject(e);
        }
      });
    }
    async downloadToBuffer(url, options) {
      return await options.cancellationToken.createPromise((resolve, reject, onCancel) => {
        const responseChunks = [];
        const requestOptions = {
          headers: options.headers || void 0,
          // because PrivateGitHubProvider requires HttpExecutor.prepareRedirectUrlOptions logic, so, we need to redirect manually
          redirect: "manual"
        };
        configureRequestUrl(url, requestOptions);
        configureRequestOptions(requestOptions);
        this.doDownload(requestOptions, {
          destination: null,
          options,
          onCancel,
          callback: (error2) => {
            if (error2 == null) {
              resolve(Buffer.concat(responseChunks));
            } else {
              reject(error2);
            }
          },
          responseHandler: (response, callback) => {
            let receivedLength = 0;
            response.on("data", (chunk) => {
              receivedLength += chunk.length;
              if (receivedLength > 524288e3) {
                callback(new Error("Maximum allowed size is 500 MB"));
                return;
              }
              responseChunks.push(chunk);
            });
            response.on("end", () => {
              callback(null);
            });
          }
        }, 0);
      });
    }
    doDownload(requestOptions, options, redirectCount) {
      const request = this.createRequest(requestOptions, (response) => {
        if (response.statusCode >= 400) {
          options.callback(new Error(`Cannot download "${requestOptions.protocol || "https:"}//${requestOptions.hostname}${requestOptions.path}", status ${response.statusCode}: ${response.statusMessage}`));
          return;
        }
        response.on("error", options.callback);
        const redirectUrl = safeGetHeader(response, "location");
        if (redirectUrl != null) {
          if (redirectCount < this.maxRedirects) {
            this.doDownload(HttpExecutor.prepareRedirectUrlOptions(redirectUrl, requestOptions), options, redirectCount++);
          } else {
            options.callback(this.createMaxRedirectError());
          }
          return;
        }
        if (options.responseHandler == null) {
          configurePipes(options, response);
        } else {
          options.responseHandler(response, options.callback);
        }
      });
      this.addErrorAndTimeoutHandlers(request, options.callback, requestOptions.timeout);
      this.addRedirectHandlers(request, requestOptions, options.callback, redirectCount, (requestOptions2) => {
        this.doDownload(requestOptions2, options, redirectCount++);
      });
      request.end();
    }
    createMaxRedirectError() {
      return new Error(`Too many redirects (> ${this.maxRedirects})`);
    }
    addTimeOutHandler(request, callback, timeout) {
      request.on("socket", (socket) => {
        socket.setTimeout(timeout, () => {
          request.abort();
          callback(new Error("Request timed out"));
        });
      });
    }
    static prepareRedirectUrlOptions(redirectUrl, options) {
      const newOptions = configureRequestOptionsFromUrl(redirectUrl, { ...options });
      const headers = newOptions.headers;
      if (headers == null) {
        return newOptions;
      }
      const originalUrl = HttpExecutor.reconstructOriginalUrl(options);
      const parsedRedirectUrl = parseUrl(redirectUrl, options);
      if (HttpExecutor.isCrossOriginRedirect(originalUrl, parsedRedirectUrl)) {
        if (debug.enabled) {
          debug(`Cross-origin redirect (${originalUrl.host} → ${parsedRedirectUrl.host}): stripping sensitive headers`);
        }
        for (const key of Object.keys(headers)) {
          if (SENSITIVE_REDIRECT_HEADERS.has(normalizeName(key))) {
            delete headers[key];
          }
        }
      }
      return newOptions;
    }
    static reconstructOriginalUrl(options) {
      const protocol = options.protocol || "https:";
      if (!options.hostname) {
        throw new Error("Missing hostname in request options");
      }
      const hostname = options.hostname;
      const port = options.port ? `:${options.port}` : "";
      const path = options.path || "/";
      return new url_1.URL(`${protocol}//${hostname}${port}${path}`);
    }
    static isCrossOriginRedirect(originalUrl, redirectUrl) {
      if (originalUrl.hostname.toLowerCase() !== redirectUrl.hostname.toLowerCase()) {
        return true;
      }
      if (originalUrl.protocol === "http:" && // This can be replaced with `!originalUrl.port`, but for the sake of clarity.
      ["80", ""].includes(originalUrl.port) && redirectUrl.protocol === "https:" && // This can be replaced with `!redirectUrl.port`, but for the sake of clarity.
      ["443", ""].includes(redirectUrl.port)) {
        return false;
      }
      if (originalUrl.protocol !== redirectUrl.protocol) {
        return true;
      }
      const originalPort = originalUrl.port;
      const redirectPort = redirectUrl.port;
      return originalPort !== redirectPort;
    }
    static async retryOnServerError(task, maxRetries = 3) {
      for (let attemptNumber = 0; ; attemptNumber++) {
        try {
          return await task();
        } catch (e) {
          if (attemptNumber < maxRetries && (e instanceof HttpError && e.isServerError() || e.code === "EPIPE")) {
            await new Promise((r) => setTimeout(r, 1e3 * (attemptNumber + 1)));
            continue;
          }
          throw e;
        }
      }
    }
  }
  httpExecutor.HttpExecutor = HttpExecutor;
  function parseUrl(url, options) {
    try {
      return new url_1.URL(url);
    } catch {
      const hostname = options.hostname;
      const protocol = options.protocol || "https:";
      const port = options.port ? `:${options.port}` : "";
      const baseUrl = `${protocol}//${hostname}${port}`;
      return new url_1.URL(url, baseUrl);
    }
  }
  function configureRequestOptionsFromUrl(url, options) {
    const result = configureRequestOptions(options);
    const parsedUrl = parseUrl(url, options);
    configureRequestUrl(parsedUrl, result);
    return result;
  }
  function configureRequestUrl(url, options) {
    options.protocol = url.protocol;
    options.hostname = url.hostname;
    if (url.port) {
      options.port = url.port;
    } else if (options.port) {
      delete options.port;
    }
    options.path = url.pathname + url.search;
  }
  class DigestTransform extends stream_1.Transform {
    // noinspection JSUnusedGlobalSymbols
    get actual() {
      return this._actual;
    }
    constructor(expected, algorithm = "sha512", encoding = "base64") {
      super();
      this.expected = expected;
      this.algorithm = algorithm;
      this.encoding = encoding;
      this._actual = null;
      this.isValidateOnEnd = true;
      this.digester = (0, crypto_1.createHash)(algorithm);
    }
    // noinspection JSUnusedGlobalSymbols
    _transform(chunk, encoding, callback) {
      this.digester.update(chunk);
      callback(null, chunk);
    }
    // noinspection JSUnusedGlobalSymbols
    _flush(callback) {
      this._actual = this.digester.digest(this.encoding);
      if (this.isValidateOnEnd) {
        try {
          this.validate();
        } catch (e) {
          callback(e);
          return;
        }
      }
      callback(null);
    }
    validate() {
      if (this._actual == null) {
        throw (0, error_1.newError)("Not finished yet", "ERR_STREAM_NOT_FINISHED");
      }
      if (this._actual !== this.expected) {
        throw (0, error_1.newError)(`${this.algorithm} checksum mismatch, expected ${this.expected}, got ${this._actual}`, "ERR_CHECKSUM_MISMATCH");
      }
      return null;
    }
  }
  httpExecutor.DigestTransform = DigestTransform;
  function checkSha2(sha2Header, sha2, callback) {
    if (sha2Header != null && sha2 != null && sha2Header !== sha2) {
      callback(new Error(`checksum mismatch: expected ${sha2} but got ${sha2Header} (X-Checksum-Sha2 header)`));
      return false;
    }
    return true;
  }
  function safeGetHeader(response, headerKey) {
    const value = response.headers[headerKey];
    if (value == null) {
      return null;
    } else if (Array.isArray(value)) {
      return value.length === 0 ? null : value[value.length - 1];
    } else {
      return value;
    }
  }
  function configurePipes(options, response) {
    if (!checkSha2(safeGetHeader(response, "X-Checksum-Sha2"), options.options.sha2, options.callback)) {
      return;
    }
    const streams = [];
    if (options.options.onProgress != null) {
      const contentLength = safeGetHeader(response, "content-length");
      if (contentLength != null) {
        streams.push(new ProgressCallbackTransform_1.ProgressCallbackTransform(parseInt(contentLength, 10), options.options.cancellationToken, options.options.onProgress));
      }
    }
    const sha512 = options.options.sha512;
    if (sha512 != null) {
      streams.push(new DigestTransform(sha512, "sha512", sha512.length === 128 && !sha512.includes("+") && !sha512.includes("Z") && !sha512.includes("=") ? "hex" : "base64"));
    } else if (options.options.sha2 != null) {
      streams.push(new DigestTransform(options.options.sha2, "sha256", "hex"));
    }
    const fileOut = (0, fs_1.createWriteStream)(options.destination);
    streams.push(fileOut);
    let lastStream = response;
    for (const stream of streams) {
      stream.on("error", (error2) => {
        fileOut.close();
        if (!options.options.cancellationToken.cancelled) {
          options.callback(error2);
        }
      });
      lastStream = lastStream.pipe(stream);
    }
    fileOut.on("finish", () => {
      fileOut.close(options.callback);
    });
  }
  function configureRequestOptions(options, token, method) {
    if (method != null) {
      options.method = method;
    }
    options.headers = { ...options.headers };
    const headers = options.headers;
    if (token != null) {
      headers.authorization = token.startsWith("Basic") || token.startsWith("Bearer") ? token : `token ${token}`;
    }
    if (headers["User-Agent"] == null) {
      headers["User-Agent"] = "electron-builder";
    }
    if (method == null || method === "GET" || headers["Cache-Control"] == null) {
      headers["Cache-Control"] = "no-cache";
    }
    if (options.protocol == null && process.versions.electron != null) {
      options.protocol = "https:";
    }
    return options;
  }
  function isSensitiveFieldName(name) {
    const normalized = normalizeName(name);
    return SENSITIVE_FIELD_PATTERNS.some((p) => normalized.includes(p)) || SENSITIVE_FIELD_SUFFIXES.some((s) => normalized.endsWith(s));
  }
  function hashSensitiveValue(value) {
    return `${(0, crypto_1.createHash)("sha256").update(value).digest("hex")} (sha256 hash)`;
  }
  function safeStringifyJson(data, skippedNames) {
    return JSON.stringify(data, (name, value) => {
      if (isSensitiveFieldName(name) || skippedNames != null && skippedNames.has(name)) {
        return typeof value === "string" ? hashSensitiveValue(value) : "<stripped sensitive data>";
      }
      return value;
    }, 2);
  }
  return httpExecutor;
}
var MemoLazy = {};
var hasRequiredMemoLazy;
function requireMemoLazy() {
  if (hasRequiredMemoLazy) return MemoLazy;
  hasRequiredMemoLazy = 1;
  Object.defineProperty(MemoLazy, "__esModule", { value: true });
  MemoLazy.MemoLazy = void 0;
  let MemoLazy$1 = class MemoLazy {
    constructor(selector, creator) {
      this.selector = selector;
      this.creator = creator;
      this.selected = void 0;
      this._value = void 0;
    }
    get hasValue() {
      return this._value !== void 0;
    }
    get value() {
      const selected = this.selector();
      if (this._value !== void 0 && equals(this.selected, selected)) {
        return this._value;
      }
      this.selected = selected;
      const result = this.creator(selected);
      this.value = result;
      return result;
    }
    set value(value) {
      this._value = value;
    }
  };
  MemoLazy.MemoLazy = MemoLazy$1;
  function equals(firstValue, secondValue) {
    const isFirstObject = typeof firstValue === "object" && firstValue !== null;
    const isSecondObject = typeof secondValue === "object" && secondValue !== null;
    if (isFirstObject && isSecondObject) {
      const keys1 = Object.keys(firstValue);
      const keys2 = Object.keys(secondValue);
      return keys1.length === keys2.length && keys1.every((key) => equals(firstValue[key], secondValue[key]));
    }
    return firstValue === secondValue;
  }
  return MemoLazy;
}
var publishOptions = {};
var hasRequiredPublishOptions;
function requirePublishOptions() {
  if (hasRequiredPublishOptions) return publishOptions;
  hasRequiredPublishOptions = 1;
  Object.defineProperty(publishOptions, "__esModule", { value: true });
  publishOptions.githubUrl = githubUrl;
  publishOptions.githubTagPrefix = githubTagPrefix;
  publishOptions.getS3LikeProviderBaseUrl = getS3LikeProviderBaseUrl;
  function githubUrl(options, defaultHost = "github.com") {
    return `${options.protocol || "https"}://${options.host || defaultHost}`;
  }
  function githubTagPrefix(options) {
    var _a;
    if (options.tagNamePrefix) {
      return options.tagNamePrefix;
    }
    if ((_a = options.vPrefixedTagName) !== null && _a !== void 0 ? _a : true) {
      return "v";
    }
    return "";
  }
  function getS3LikeProviderBaseUrl(configuration) {
    const provider = configuration.provider;
    if (provider === "s3") {
      return s3Url(configuration);
    }
    if (provider === "spaces") {
      return spacesUrl(configuration);
    }
    throw new Error(`Not supported provider: ${provider}`);
  }
  function s3Url(options) {
    let url;
    if (options.accelerate == true) {
      url = `https://${options.bucket}.s3-accelerate.amazonaws.com`;
    } else if (options.endpoint != null) {
      url = `${options.endpoint}/${options.bucket}`;
    } else if (options.bucket.includes(".")) {
      if (options.region == null) {
        throw new Error(`Bucket name "${options.bucket}" includes a dot, but S3 region is missing`);
      }
      if (options.region === "us-east-1") {
        url = `https://s3.amazonaws.com/${options.bucket}`;
      } else {
        url = `https://s3-${options.region}.amazonaws.com/${options.bucket}`;
      }
    } else if (options.region === "cn-north-1") {
      url = `https://${options.bucket}.s3.${options.region}.amazonaws.com.cn`;
    } else {
      url = `https://${options.bucket}.s3.amazonaws.com`;
    }
    return appendPath(url, options.path);
  }
  function appendPath(url, p) {
    if (p != null && p.length > 0) {
      if (!p.startsWith("/")) {
        url += "/";
      }
      url += p;
    }
    return url;
  }
  function spacesUrl(options) {
    if (options.name == null) {
      throw new Error(`name is missing`);
    }
    if (options.region == null) {
      throw new Error(`region is missing`);
    }
    return appendPath(`https://${options.name}.${options.region}.digitaloceanspaces.com`, options.path);
  }
  return publishOptions;
}
var retry = {};
var hasRequiredRetry;
function requireRetry() {
  if (hasRequiredRetry) return retry;
  hasRequiredRetry = 1;
  Object.defineProperty(retry, "__esModule", { value: true });
  retry.retry = retry$1;
  const CancellationToken_1 = requireCancellationToken();
  async function retry$1(task, options) {
    var _a;
    const { retries: retryCount, interval, backoff = 0, attempt = 0, shouldRetry, cancellationToken = new CancellationToken_1.CancellationToken() } = options;
    try {
      return await task();
    } catch (error2) {
      if (await Promise.resolve((_a = shouldRetry === null || shouldRetry === void 0 ? void 0 : shouldRetry(error2)) !== null && _a !== void 0 ? _a : true) && retryCount > 0 && !cancellationToken.cancelled) {
        await new Promise((resolve) => setTimeout(resolve, interval + backoff * attempt));
        return await retry$1(task, { ...options, retries: retryCount - 1, attempt: attempt + 1 });
      } else {
        throw error2;
      }
    }
  }
  return retry;
}
var rfc2253Parser = {};
var hasRequiredRfc2253Parser;
function requireRfc2253Parser() {
  if (hasRequiredRfc2253Parser) return rfc2253Parser;
  hasRequiredRfc2253Parser = 1;
  Object.defineProperty(rfc2253Parser, "__esModule", { value: true });
  rfc2253Parser.parseDn = parseDn;
  function parseDn(seq) {
    let quoted = false;
    let key = null;
    let token = "";
    let nextNonSpace = 0;
    seq = seq.trim();
    const result = /* @__PURE__ */ new Map();
    for (let i = 0; i <= seq.length; i++) {
      if (i === seq.length) {
        if (key !== null) {
          result.set(key, token);
        }
        break;
      }
      const ch = seq[i];
      if (quoted) {
        if (ch === '"') {
          quoted = false;
          continue;
        }
      } else {
        if (ch === '"') {
          quoted = true;
          continue;
        }
        if (ch === "\\") {
          i++;
          const ord = parseInt(seq.slice(i, i + 2), 16);
          if (Number.isNaN(ord)) {
            token += seq[i];
          } else {
            i++;
            token += String.fromCharCode(ord);
          }
          continue;
        }
        if (key === null && ch === "=") {
          key = token;
          token = "";
          continue;
        }
        if (ch === "," || ch === ";" || ch === "+") {
          if (key !== null) {
            result.set(key, token);
          }
          key = null;
          token = "";
          continue;
        }
      }
      if (ch === " " && !quoted) {
        if (token.length === 0) {
          continue;
        }
        if (i > nextNonSpace) {
          let j = i;
          while (seq[j] === " ") {
            j++;
          }
          nextNonSpace = j;
        }
        if (nextNonSpace >= seq.length || seq[nextNonSpace] === "," || seq[nextNonSpace] === ";" || key === null && seq[nextNonSpace] === "=" || key !== null && seq[nextNonSpace] === "+") {
          i = nextNonSpace - 1;
          continue;
        }
      }
      token += ch;
    }
    return result;
  }
  return rfc2253Parser;
}
var uuid = {};
var hasRequiredUuid;
function requireUuid() {
  if (hasRequiredUuid) return uuid;
  hasRequiredUuid = 1;
  Object.defineProperty(uuid, "__esModule", { value: true });
  uuid.nil = uuid.UUID = void 0;
  const crypto_1 = require$$0$3;
  const error_1 = requireError();
  const invalidName = "options.name must be either a string or a Buffer";
  const randomHost = (0, crypto_1.randomBytes)(16);
  randomHost[0] = randomHost[0] | 1;
  const hex2byte = {};
  const byte2hex = [];
  for (let i = 0; i < 256; i++) {
    const hex = (i + 256).toString(16).substr(1);
    hex2byte[hex] = i;
    byte2hex[i] = hex;
  }
  class UUID {
    constructor(uuid2) {
      this.ascii = null;
      this.binary = null;
      const check = UUID.check(uuid2);
      if (!check) {
        throw new Error("not a UUID");
      }
      this.version = check.version;
      if (check.format === "ascii") {
        this.ascii = uuid2;
      } else {
        this.binary = uuid2;
      }
    }
    static v5(name, namespace) {
      return uuidNamed(name, "sha1", 80, namespace);
    }
    toString() {
      if (this.ascii == null) {
        this.ascii = stringify(this.binary);
      }
      return this.ascii;
    }
    inspect() {
      return `UUID v${this.version} ${this.toString()}`;
    }
    static check(uuid2, offset = 0) {
      if (typeof uuid2 === "string") {
        uuid2 = uuid2.toLowerCase();
        if (!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-([a-f0-9]{12})$/.test(uuid2)) {
          return false;
        }
        if (uuid2 === "00000000-0000-0000-0000-000000000000") {
          return { version: void 0, variant: "nil", format: "ascii" };
        }
        return {
          version: (hex2byte[uuid2[14] + uuid2[15]] & 240) >> 4,
          variant: getVariant((hex2byte[uuid2[19] + uuid2[20]] & 224) >> 5),
          format: "ascii"
        };
      }
      if (Buffer.isBuffer(uuid2)) {
        if (uuid2.length < offset + 16) {
          return false;
        }
        let i = 0;
        for (; i < 16; i++) {
          if (uuid2[offset + i] !== 0) {
            break;
          }
        }
        if (i === 16) {
          return { version: void 0, variant: "nil", format: "binary" };
        }
        return {
          version: (uuid2[offset + 6] & 240) >> 4,
          variant: getVariant((uuid2[offset + 8] & 224) >> 5),
          format: "binary"
        };
      }
      throw (0, error_1.newError)("Unknown type of uuid", "ERR_UNKNOWN_UUID_TYPE");
    }
    // read stringified uuid into a Buffer
    static parse(input) {
      const buffer = Buffer.allocUnsafe(16);
      let j = 0;
      for (let i = 0; i < 16; i++) {
        buffer[i] = hex2byte[input[j++] + input[j++]];
        if (i === 3 || i === 5 || i === 7 || i === 9) {
          j += 1;
        }
      }
      return buffer;
    }
  }
  uuid.UUID = UUID;
  UUID.OID = UUID.parse("6ba7b812-9dad-11d1-80b4-00c04fd430c8");
  function getVariant(bits) {
    switch (bits) {
      case 0:
      case 1:
      case 3:
        return "ncs";
      case 4:
      case 5:
        return "rfc4122";
      case 6:
        return "microsoft";
      default:
        return "future";
    }
  }
  var UuidEncoding;
  (function(UuidEncoding2) {
    UuidEncoding2[UuidEncoding2["ASCII"] = 0] = "ASCII";
    UuidEncoding2[UuidEncoding2["BINARY"] = 1] = "BINARY";
    UuidEncoding2[UuidEncoding2["OBJECT"] = 2] = "OBJECT";
  })(UuidEncoding || (UuidEncoding = {}));
  function uuidNamed(name, hashMethod, version, namespace, encoding = UuidEncoding.ASCII) {
    const hash = (0, crypto_1.createHash)(hashMethod);
    const nameIsNotAString = typeof name !== "string";
    if (nameIsNotAString && !Buffer.isBuffer(name)) {
      throw (0, error_1.newError)(invalidName, "ERR_INVALID_UUID_NAME");
    }
    hash.update(namespace);
    hash.update(name);
    const buffer = hash.digest();
    let result;
    switch (encoding) {
      case UuidEncoding.BINARY:
        buffer[6] = buffer[6] & 15 | version;
        buffer[8] = buffer[8] & 63 | 128;
        result = buffer;
        break;
      case UuidEncoding.OBJECT:
        buffer[6] = buffer[6] & 15 | version;
        buffer[8] = buffer[8] & 63 | 128;
        result = new UUID(buffer);
        break;
      default:
        result = byte2hex[buffer[0]] + byte2hex[buffer[1]] + byte2hex[buffer[2]] + byte2hex[buffer[3]] + "-" + byte2hex[buffer[4]] + byte2hex[buffer[5]] + "-" + byte2hex[buffer[6] & 15 | version] + byte2hex[buffer[7]] + "-" + byte2hex[buffer[8] & 63 | 128] + byte2hex[buffer[9]] + "-" + byte2hex[buffer[10]] + byte2hex[buffer[11]] + byte2hex[buffer[12]] + byte2hex[buffer[13]] + byte2hex[buffer[14]] + byte2hex[buffer[15]];
        break;
    }
    return result;
  }
  function stringify(buffer) {
    return byte2hex[buffer[0]] + byte2hex[buffer[1]] + byte2hex[buffer[2]] + byte2hex[buffer[3]] + "-" + byte2hex[buffer[4]] + byte2hex[buffer[5]] + "-" + byte2hex[buffer[6]] + byte2hex[buffer[7]] + "-" + byte2hex[buffer[8]] + byte2hex[buffer[9]] + "-" + byte2hex[buffer[10]] + byte2hex[buffer[11]] + byte2hex[buffer[12]] + byte2hex[buffer[13]] + byte2hex[buffer[14]] + byte2hex[buffer[15]];
  }
  uuid.nil = new UUID("00000000-0000-0000-0000-000000000000");
  return uuid;
}
var xml = {};
var sax = {};
var hasRequiredSax;
function requireSax() {
  if (hasRequiredSax) return sax;
  hasRequiredSax = 1;
  (function(exports2) {
    (function(sax2) {
      sax2.parser = function(strict, opt) {
        return new SAXParser(strict, opt);
      };
      sax2.SAXParser = SAXParser;
      sax2.SAXStream = SAXStream;
      sax2.createStream = createStream;
      sax2.MAX_BUFFER_LENGTH = 64 * 1024;
      var buffers = [
        "comment",
        "sgmlDecl",
        "textNode",
        "tagName",
        "doctype",
        "procInstName",
        "procInstBody",
        "entity",
        "attribName",
        "attribValue",
        "cdata",
        "script"
      ];
      sax2.EVENTS = [
        "text",
        "processinginstruction",
        "sgmldeclaration",
        "doctype",
        "comment",
        "opentagstart",
        "attribute",
        "opentag",
        "closetag",
        "opencdata",
        "cdata",
        "closecdata",
        "error",
        "end",
        "ready",
        "script",
        "opennamespace",
        "closenamespace"
      ];
      function SAXParser(strict, opt) {
        if (!(this instanceof SAXParser)) {
          return new SAXParser(strict, opt);
        }
        var parser = this;
        clearBuffers(parser);
        parser.q = parser.c = "";
        parser.bufferCheckPosition = sax2.MAX_BUFFER_LENGTH;
        parser.encoding = null;
        parser.opt = opt || {};
        parser.opt.lowercase = parser.opt.lowercase || parser.opt.lowercasetags;
        parser.looseCase = parser.opt.lowercase ? "toLowerCase" : "toUpperCase";
        parser.opt.maxEntityCount = parser.opt.maxEntityCount || 512;
        parser.opt.maxEntityDepth = parser.opt.maxEntityDepth || 4;
        parser.entityCount = parser.entityDepth = 0;
        parser.tags = [];
        parser.closed = parser.closedRoot = parser.sawRoot = false;
        parser.tag = parser.error = null;
        parser.strict = !!strict;
        parser.noscript = !!(strict || parser.opt.noscript);
        parser.state = S.BEGIN;
        parser.strictEntities = parser.opt.strictEntities;
        parser.ENTITIES = parser.strictEntities ? Object.create(sax2.XML_ENTITIES) : Object.create(sax2.ENTITIES);
        parser.attribList = [];
        if (parser.opt.xmlns) {
          parser.ns = Object.create(rootNS);
        }
        if (parser.opt.unquotedAttributeValues === void 0) {
          parser.opt.unquotedAttributeValues = !strict;
        }
        parser.trackPosition = parser.opt.position !== false;
        if (parser.trackPosition) {
          parser.position = parser.line = parser.column = 0;
        }
        emit(parser, "onready");
      }
      if (!Object.create) {
        Object.create = function(o) {
          function F() {
          }
          F.prototype = o;
          var newf = new F();
          return newf;
        };
      }
      if (!Object.keys) {
        Object.keys = function(o) {
          var a = [];
          for (var i in o) if (o.hasOwnProperty(i)) a.push(i);
          return a;
        };
      }
      function checkBufferLength(parser) {
        var maxAllowed = Math.max(sax2.MAX_BUFFER_LENGTH, 10);
        var maxActual = 0;
        for (var i = 0, l = buffers.length; i < l; i++) {
          var len = parser[buffers[i]].length;
          if (len > maxAllowed) {
            switch (buffers[i]) {
              case "textNode":
                closeText(parser);
                break;
              case "cdata":
                emitNode(parser, "oncdata", parser.cdata);
                parser.cdata = "";
                break;
              case "script":
                emitNode(parser, "onscript", parser.script);
                parser.script = "";
                break;
              default:
                error2(parser, "Max buffer length exceeded: " + buffers[i]);
            }
          }
          maxActual = Math.max(maxActual, len);
        }
        var m = sax2.MAX_BUFFER_LENGTH - maxActual;
        parser.bufferCheckPosition = m + parser.position;
      }
      function clearBuffers(parser) {
        for (var i = 0, l = buffers.length; i < l; i++) {
          parser[buffers[i]] = "";
        }
      }
      function flushBuffers(parser) {
        closeText(parser);
        if (parser.cdata !== "") {
          emitNode(parser, "oncdata", parser.cdata);
          parser.cdata = "";
        }
        if (parser.script !== "") {
          emitNode(parser, "onscript", parser.script);
          parser.script = "";
        }
      }
      SAXParser.prototype = {
        end: function() {
          end(this);
        },
        write,
        resume: function() {
          this.error = null;
          return this;
        },
        close: function() {
          return this.write(null);
        },
        flush: function() {
          flushBuffers(this);
        }
      };
      var Stream;
      try {
        Stream = require("stream").Stream;
      } catch (ex) {
        Stream = function() {
        };
      }
      if (!Stream) Stream = function() {
      };
      var streamWraps = sax2.EVENTS.filter(function(ev) {
        return ev !== "error" && ev !== "end";
      });
      function createStream(strict, opt) {
        return new SAXStream(strict, opt);
      }
      function determineBufferEncoding(data, isEnd) {
        if (data.length >= 2) {
          if (data[0] === 255 && data[1] === 254) {
            return "utf-16le";
          }
          if (data[0] === 254 && data[1] === 255) {
            return "utf-16be";
          }
        }
        if (data.length >= 3 && data[0] === 239 && data[1] === 187 && data[2] === 191) {
          return "utf8";
        }
        if (data.length >= 4) {
          if (data[0] === 60 && data[1] === 0 && data[2] === 63 && data[3] === 0) {
            return "utf-16le";
          }
          if (data[0] === 0 && data[1] === 60 && data[2] === 0 && data[3] === 63) {
            return "utf-16be";
          }
          return "utf8";
        }
        return isEnd ? "utf8" : null;
      }
      function SAXStream(strict, opt) {
        if (!(this instanceof SAXStream)) {
          return new SAXStream(strict, opt);
        }
        Stream.apply(this);
        this._parser = new SAXParser(strict, opt);
        this.writable = true;
        this.readable = true;
        var me = this;
        this._parser.onend = function() {
          me.emit("end");
        };
        this._parser.onerror = function(er) {
          me.emit("error", er);
          me._parser.error = null;
        };
        this._decoder = null;
        this._decoderBuffer = null;
        streamWraps.forEach(function(ev) {
          Object.defineProperty(me, "on" + ev, {
            get: function() {
              return me._parser["on" + ev];
            },
            set: function(h) {
              if (!h) {
                me.removeAllListeners(ev);
                me._parser["on" + ev] = h;
                return h;
              }
              me.on(ev, h);
            },
            enumerable: true,
            configurable: false
          });
        });
      }
      SAXStream.prototype = Object.create(Stream.prototype, {
        constructor: {
          value: SAXStream
        }
      });
      SAXStream.prototype._decodeBuffer = function(data, isEnd) {
        if (this._decoderBuffer) {
          data = Buffer.concat([this._decoderBuffer, data]);
          this._decoderBuffer = null;
        }
        if (!this._decoder) {
          var encoding = determineBufferEncoding(data, isEnd);
          if (!encoding) {
            this._decoderBuffer = data;
            return "";
          }
          this._parser.encoding = encoding;
          this._decoder = new TextDecoder(encoding);
        }
        return this._decoder.decode(data, { stream: !isEnd });
      };
      SAXStream.prototype.write = function(data) {
        if (typeof Buffer === "function" && typeof Buffer.isBuffer === "function" && Buffer.isBuffer(data)) {
          data = this._decodeBuffer(data, false);
        } else if (this._decoderBuffer) {
          var remaining = this._decodeBuffer(Buffer.alloc(0), true);
          if (remaining) {
            this._parser.write(remaining);
            this.emit("data", remaining);
          }
        }
        this._parser.write(data.toString());
        this.emit("data", data);
        return true;
      };
      SAXStream.prototype.end = function(chunk) {
        if (chunk && chunk.length) {
          this.write(chunk);
        }
        if (this._decoderBuffer) {
          var finalChunk = this._decodeBuffer(Buffer.alloc(0), true);
          if (finalChunk) {
            this._parser.write(finalChunk);
            this.emit("data", finalChunk);
          }
        } else if (this._decoder) {
          var remaining = this._decoder.decode();
          if (remaining) {
            this._parser.write(remaining);
            this.emit("data", remaining);
          }
        }
        this._parser.end();
        return true;
      };
      SAXStream.prototype.on = function(ev, handler) {
        var me = this;
        if (!me._parser["on" + ev] && streamWraps.indexOf(ev) !== -1) {
          me._parser["on" + ev] = function() {
            var args = arguments.length === 1 ? [arguments[0]] : Array.apply(null, arguments);
            args.splice(0, 0, ev);
            me.emit.apply(me, args);
          };
        }
        return Stream.prototype.on.call(me, ev, handler);
      };
      var CDATA = "[CDATA[";
      var DOCTYPE = "DOCTYPE";
      var XML_NAMESPACE = "http://www.w3.org/XML/1998/namespace";
      var XMLNS_NAMESPACE = "http://www.w3.org/2000/xmlns/";
      var rootNS = { xml: XML_NAMESPACE, xmlns: XMLNS_NAMESPACE };
      var nameStart = /[:_A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD]/;
      var nameBody = /[:_A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\u00B7\u0300-\u036F\u203F-\u2040.\d-]/;
      var entityStart = /[#:_A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD]/;
      var entityBody = /[#:_A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\u00B7\u0300-\u036F\u203F-\u2040.\d-]/;
      function isWhitespace(c) {
        return c === " " || c === "\n" || c === "\r" || c === "	";
      }
      function isQuote(c) {
        return c === '"' || c === "'";
      }
      function isAttribEnd(c) {
        return c === ">" || isWhitespace(c);
      }
      function isMatch(regex, c) {
        return regex.test(c);
      }
      function notMatch(regex, c) {
        return !isMatch(regex, c);
      }
      var S = 0;
      sax2.STATE = {
        BEGIN: S++,
        // leading byte order mark or whitespace
        BEGIN_WHITESPACE: S++,
        // leading whitespace
        TEXT: S++,
        // general stuff
        TEXT_ENTITY: S++,
        // &amp and such.
        OPEN_WAKA: S++,
        // <
        SGML_DECL: S++,
        // <!BLARG
        SGML_DECL_QUOTED: S++,
        // <!BLARG foo "bar
        DOCTYPE: S++,
        // <!DOCTYPE
        DOCTYPE_QUOTED: S++,
        // <!DOCTYPE "//blah
        DOCTYPE_DTD: S++,
        // <!DOCTYPE "//blah" [ ...
        DOCTYPE_DTD_QUOTED: S++,
        // <!DOCTYPE "//blah" [ "foo
        COMMENT_STARTING: S++,
        // <!-
        COMMENT: S++,
        // <!--
        COMMENT_ENDING: S++,
        // <!-- blah -
        COMMENT_ENDED: S++,
        // <!-- blah --
        CDATA: S++,
        // <![CDATA[ something
        CDATA_ENDING: S++,
        // ]
        CDATA_ENDING_2: S++,
        // ]]
        PROC_INST: S++,
        // <?hi
        PROC_INST_BODY: S++,
        // <?hi there
        PROC_INST_ENDING: S++,
        // <?hi "there" ?
        OPEN_TAG: S++,
        // <strong
        OPEN_TAG_SLASH: S++,
        // <strong /
        ATTRIB: S++,
        // <a
        ATTRIB_NAME: S++,
        // <a foo
        ATTRIB_NAME_SAW_WHITE: S++,
        // <a foo _
        ATTRIB_VALUE: S++,
        // <a foo=
        ATTRIB_VALUE_QUOTED: S++,
        // <a foo="bar
        ATTRIB_VALUE_CLOSED: S++,
        // <a foo="bar"
        ATTRIB_VALUE_UNQUOTED: S++,
        // <a foo=bar
        ATTRIB_VALUE_ENTITY_Q: S++,
        // <foo bar="&quot;"
        ATTRIB_VALUE_ENTITY_U: S++,
        // <foo bar=&quot
        CLOSE_TAG: S++,
        // </a
        CLOSE_TAG_SAW_WHITE: S++,
        // </a   >
        SCRIPT: S++,
        // <script> ...
        SCRIPT_ENDING: S++
        // <script> ... <
      };
      sax2.XML_ENTITIES = {
        amp: "&",
        gt: ">",
        lt: "<",
        quot: '"',
        apos: "'"
      };
      sax2.ENTITIES = {
        amp: "&",
        gt: ">",
        lt: "<",
        quot: '"',
        apos: "'",
        AElig: 198,
        Aacute: 193,
        Acirc: 194,
        Agrave: 192,
        Aring: 197,
        Atilde: 195,
        Auml: 196,
        Ccedil: 199,
        ETH: 208,
        Eacute: 201,
        Ecirc: 202,
        Egrave: 200,
        Euml: 203,
        Iacute: 205,
        Icirc: 206,
        Igrave: 204,
        Iuml: 207,
        Ntilde: 209,
        Oacute: 211,
        Ocirc: 212,
        Ograve: 210,
        Oslash: 216,
        Otilde: 213,
        Ouml: 214,
        THORN: 222,
        Uacute: 218,
        Ucirc: 219,
        Ugrave: 217,
        Uuml: 220,
        Yacute: 221,
        aacute: 225,
        acirc: 226,
        aelig: 230,
        agrave: 224,
        aring: 229,
        atilde: 227,
        auml: 228,
        ccedil: 231,
        eacute: 233,
        ecirc: 234,
        egrave: 232,
        eth: 240,
        euml: 235,
        iacute: 237,
        icirc: 238,
        igrave: 236,
        iuml: 239,
        ntilde: 241,
        oacute: 243,
        ocirc: 244,
        ograve: 242,
        oslash: 248,
        otilde: 245,
        ouml: 246,
        szlig: 223,
        thorn: 254,
        uacute: 250,
        ucirc: 251,
        ugrave: 249,
        uuml: 252,
        yacute: 253,
        yuml: 255,
        copy: 169,
        reg: 174,
        nbsp: 160,
        iexcl: 161,
        cent: 162,
        pound: 163,
        curren: 164,
        yen: 165,
        brvbar: 166,
        sect: 167,
        uml: 168,
        ordf: 170,
        laquo: 171,
        not: 172,
        shy: 173,
        macr: 175,
        deg: 176,
        plusmn: 177,
        sup1: 185,
        sup2: 178,
        sup3: 179,
        acute: 180,
        micro: 181,
        para: 182,
        middot: 183,
        cedil: 184,
        ordm: 186,
        raquo: 187,
        frac14: 188,
        frac12: 189,
        frac34: 190,
        iquest: 191,
        times: 215,
        divide: 247,
        OElig: 338,
        oelig: 339,
        Scaron: 352,
        scaron: 353,
        Yuml: 376,
        fnof: 402,
        circ: 710,
        tilde: 732,
        Alpha: 913,
        Beta: 914,
        Gamma: 915,
        Delta: 916,
        Epsilon: 917,
        Zeta: 918,
        Eta: 919,
        Theta: 920,
        Iota: 921,
        Kappa: 922,
        Lambda: 923,
        Mu: 924,
        Nu: 925,
        Xi: 926,
        Omicron: 927,
        Pi: 928,
        Rho: 929,
        Sigma: 931,
        Tau: 932,
        Upsilon: 933,
        Phi: 934,
        Chi: 935,
        Psi: 936,
        Omega: 937,
        alpha: 945,
        beta: 946,
        gamma: 947,
        delta: 948,
        epsilon: 949,
        zeta: 950,
        eta: 951,
        theta: 952,
        iota: 953,
        kappa: 954,
        lambda: 955,
        mu: 956,
        nu: 957,
        xi: 958,
        omicron: 959,
        pi: 960,
        rho: 961,
        sigmaf: 962,
        sigma: 963,
        tau: 964,
        upsilon: 965,
        phi: 966,
        chi: 967,
        psi: 968,
        omega: 969,
        thetasym: 977,
        upsih: 978,
        piv: 982,
        ensp: 8194,
        emsp: 8195,
        thinsp: 8201,
        zwnj: 8204,
        zwj: 8205,
        lrm: 8206,
        rlm: 8207,
        ndash: 8211,
        mdash: 8212,
        lsquo: 8216,
        rsquo: 8217,
        sbquo: 8218,
        ldquo: 8220,
        rdquo: 8221,
        bdquo: 8222,
        dagger: 8224,
        Dagger: 8225,
        bull: 8226,
        hellip: 8230,
        permil: 8240,
        prime: 8242,
        Prime: 8243,
        lsaquo: 8249,
        rsaquo: 8250,
        oline: 8254,
        frasl: 8260,
        euro: 8364,
        image: 8465,
        weierp: 8472,
        real: 8476,
        trade: 8482,
        alefsym: 8501,
        larr: 8592,
        uarr: 8593,
        rarr: 8594,
        darr: 8595,
        harr: 8596,
        crarr: 8629,
        lArr: 8656,
        uArr: 8657,
        rArr: 8658,
        dArr: 8659,
        hArr: 8660,
        forall: 8704,
        part: 8706,
        exist: 8707,
        empty: 8709,
        nabla: 8711,
        isin: 8712,
        notin: 8713,
        ni: 8715,
        prod: 8719,
        sum: 8721,
        minus: 8722,
        lowast: 8727,
        radic: 8730,
        prop: 8733,
        infin: 8734,
        ang: 8736,
        and: 8743,
        or: 8744,
        cap: 8745,
        cup: 8746,
        int: 8747,
        there4: 8756,
        sim: 8764,
        cong: 8773,
        asymp: 8776,
        ne: 8800,
        equiv: 8801,
        le: 8804,
        ge: 8805,
        sub: 8834,
        sup: 8835,
        nsub: 8836,
        sube: 8838,
        supe: 8839,
        oplus: 8853,
        otimes: 8855,
        perp: 8869,
        sdot: 8901,
        lceil: 8968,
        rceil: 8969,
        lfloor: 8970,
        rfloor: 8971,
        lang: 9001,
        rang: 9002,
        loz: 9674,
        spades: 9824,
        clubs: 9827,
        hearts: 9829,
        diams: 9830
      };
      Object.keys(sax2.ENTITIES).forEach(function(key) {
        var e = sax2.ENTITIES[key];
        var s2 = typeof e === "number" ? String.fromCharCode(e) : e;
        sax2.ENTITIES[key] = s2;
      });
      for (var s in sax2.STATE) {
        sax2.STATE[sax2.STATE[s]] = s;
      }
      S = sax2.STATE;
      function emit(parser, event, data) {
        parser[event] && parser[event](data);
      }
      function getDeclaredEncoding(body) {
        var match = body && body.match(/(?:^|\s)encoding\s*=\s*(['"])([^'"]+)\1/i);
        return match ? match[2] : null;
      }
      function normalizeEncodingName(encoding) {
        if (!encoding) {
          return null;
        }
        return encoding.toLowerCase().replace(/[^a-z0-9]/g, "");
      }
      function encodingsMatch(detectedEncoding, declaredEncoding) {
        const detected = normalizeEncodingName(detectedEncoding);
        const declared = normalizeEncodingName(declaredEncoding);
        if (!detected || !declared) {
          return true;
        }
        if (declared === "utf16") {
          return detected === "utf16le" || detected === "utf16be";
        }
        return detected === declared;
      }
      function validateXmlDeclarationEncoding(parser, data) {
        if (!parser.strict || !parser.encoding || !data || data.name !== "xml") {
          return;
        }
        var declaredEncoding = getDeclaredEncoding(data.body);
        if (declaredEncoding && !encodingsMatch(parser.encoding, declaredEncoding)) {
          strictFail(
            parser,
            "XML declaration encoding " + declaredEncoding + " does not match detected stream encoding " + parser.encoding.toUpperCase()
          );
        }
      }
      function emitNode(parser, nodeType, data) {
        if (parser.textNode) closeText(parser);
        emit(parser, nodeType, data);
      }
      function closeText(parser) {
        parser.textNode = textopts(parser.opt, parser.textNode);
        if (parser.textNode) emit(parser, "ontext", parser.textNode);
        parser.textNode = "";
      }
      function textopts(opt, text) {
        if (opt.trim) text = text.trim();
        if (opt.normalize) text = text.replace(/\s+/g, " ");
        return text;
      }
      function error2(parser, er) {
        closeText(parser);
        if (parser.trackPosition) {
          er += "\nLine: " + parser.line + "\nColumn: " + parser.column + "\nChar: " + parser.c;
        }
        er = new Error(er);
        parser.error = er;
        emit(parser, "onerror", er);
        return parser;
      }
      function end(parser) {
        if (parser.sawRoot && !parser.closedRoot)
          strictFail(parser, "Unclosed root tag");
        if (parser.state !== S.BEGIN && parser.state !== S.BEGIN_WHITESPACE && parser.state !== S.TEXT) {
          error2(parser, "Unexpected end");
        }
        closeText(parser);
        parser.c = "";
        parser.closed = true;
        emit(parser, "onend");
        SAXParser.call(parser, parser.strict, parser.opt);
        return parser;
      }
      function strictFail(parser, message) {
        if (typeof parser !== "object" || !(parser instanceof SAXParser)) {
          throw new Error("bad call to strictFail");
        }
        if (parser.strict) {
          error2(parser, message);
        }
      }
      function newTag(parser) {
        if (!parser.strict) parser.tagName = parser.tagName[parser.looseCase]();
        var parent = parser.tags[parser.tags.length - 1] || parser;
        var tag = parser.tag = { name: parser.tagName, attributes: {} };
        if (parser.opt.xmlns) {
          tag.ns = parent.ns;
        }
        parser.attribList.length = 0;
        emitNode(parser, "onopentagstart", tag);
      }
      function qname(name, attribute) {
        var i = name.indexOf(":");
        var qualName = i < 0 ? ["", name] : name.split(":");
        var prefix = qualName[0];
        var local = qualName[1];
        if (attribute && name === "xmlns") {
          prefix = "xmlns";
          local = "";
        }
        return { prefix, local };
      }
      function attrib(parser) {
        if (!parser.strict) {
          parser.attribName = parser.attribName[parser.looseCase]();
        }
        if (parser.attribList.indexOf(parser.attribName) !== -1 || parser.tag.attributes.hasOwnProperty(parser.attribName)) {
          parser.attribName = parser.attribValue = "";
          return;
        }
        if (parser.opt.xmlns) {
          var qn = qname(parser.attribName, true);
          var prefix = qn.prefix;
          var local = qn.local;
          if (prefix === "xmlns") {
            if (local === "xml" && parser.attribValue !== XML_NAMESPACE) {
              strictFail(
                parser,
                "xml: prefix must be bound to " + XML_NAMESPACE + "\nActual: " + parser.attribValue
              );
            } else if (local === "xmlns" && parser.attribValue !== XMLNS_NAMESPACE) {
              strictFail(
                parser,
                "xmlns: prefix must be bound to " + XMLNS_NAMESPACE + "\nActual: " + parser.attribValue
              );
            } else {
              var tag = parser.tag;
              var parent = parser.tags[parser.tags.length - 1] || parser;
              if (tag.ns === parent.ns) {
                tag.ns = Object.create(parent.ns);
              }
              tag.ns[local] = parser.attribValue;
            }
          }
          parser.attribList.push([parser.attribName, parser.attribValue]);
        } else {
          parser.tag.attributes[parser.attribName] = parser.attribValue;
          emitNode(parser, "onattribute", {
            name: parser.attribName,
            value: parser.attribValue
          });
        }
        parser.attribName = parser.attribValue = "";
      }
      function openTag(parser, selfClosing) {
        if (parser.opt.xmlns) {
          var tag = parser.tag;
          var qn = qname(parser.tagName);
          tag.prefix = qn.prefix;
          tag.local = qn.local;
          tag.uri = tag.ns[qn.prefix] || "";
          if (tag.prefix && !tag.uri) {
            strictFail(
              parser,
              "Unbound namespace prefix: " + JSON.stringify(parser.tagName)
            );
            tag.uri = qn.prefix;
          }
          var parent = parser.tags[parser.tags.length - 1] || parser;
          if (tag.ns && parent.ns !== tag.ns) {
            Object.keys(tag.ns).forEach(function(p) {
              emitNode(parser, "onopennamespace", {
                prefix: p,
                uri: tag.ns[p]
              });
            });
          }
          for (var i = 0, l = parser.attribList.length; i < l; i++) {
            var nv = parser.attribList[i];
            var name = nv[0];
            var value = nv[1];
            var qualName = qname(name, true);
            var prefix = qualName.prefix;
            var local = qualName.local;
            var uri = prefix === "" ? "" : tag.ns[prefix] || "";
            var a = {
              name,
              value,
              prefix,
              local,
              uri
            };
            if (prefix && prefix !== "xmlns" && !uri) {
              strictFail(
                parser,
                "Unbound namespace prefix: " + JSON.stringify(prefix)
              );
              a.uri = prefix;
            }
            parser.tag.attributes[name] = a;
            emitNode(parser, "onattribute", a);
          }
          parser.attribList.length = 0;
        }
        parser.tag.isSelfClosing = !!selfClosing;
        parser.sawRoot = true;
        parser.tags.push(parser.tag);
        emitNode(parser, "onopentag", parser.tag);
        if (!selfClosing) {
          if (!parser.noscript && parser.tagName.toLowerCase() === "script") {
            parser.state = S.SCRIPT;
          } else {
            parser.state = S.TEXT;
          }
          parser.tag = null;
          parser.tagName = "";
        }
        parser.attribName = parser.attribValue = "";
        parser.attribList.length = 0;
      }
      function closeTag(parser) {
        if (!parser.tagName) {
          strictFail(parser, "Weird empty close tag.");
          parser.textNode += "</>";
          parser.state = S.TEXT;
          return;
        }
        if (parser.script) {
          if (parser.tagName !== "script") {
            parser.script += "</" + parser.tagName + ">";
            parser.tagName = "";
            parser.state = S.SCRIPT;
            return;
          }
          emitNode(parser, "onscript", parser.script);
          parser.script = "";
        }
        var t = parser.tags.length;
        var tagName = parser.tagName;
        if (!parser.strict) {
          tagName = tagName[parser.looseCase]();
        }
        var closeTo = tagName;
        while (t--) {
          var close = parser.tags[t];
          if (close.name !== closeTo) {
            strictFail(parser, "Unexpected close tag");
          } else {
            break;
          }
        }
        if (t < 0) {
          strictFail(parser, "Unmatched closing tag: " + parser.tagName);
          parser.textNode += "</" + parser.tagName + ">";
          parser.state = S.TEXT;
          return;
        }
        parser.tagName = tagName;
        var s2 = parser.tags.length;
        while (s2-- > t) {
          var tag = parser.tag = parser.tags.pop();
          parser.tagName = parser.tag.name;
          emitNode(parser, "onclosetag", parser.tagName);
          var x = {};
          for (var i in tag.ns) {
            x[i] = tag.ns[i];
          }
          var parent = parser.tags[parser.tags.length - 1] || parser;
          if (parser.opt.xmlns && tag.ns !== parent.ns) {
            Object.keys(tag.ns).forEach(function(p) {
              var n = tag.ns[p];
              emitNode(parser, "onclosenamespace", { prefix: p, uri: n });
            });
          }
        }
        if (t === 0) parser.closedRoot = true;
        parser.tagName = parser.attribValue = parser.attribName = "";
        parser.attribList.length = 0;
        parser.state = S.TEXT;
      }
      function parseEntity(parser) {
        var entity = parser.entity;
        var entityLC = entity.toLowerCase();
        var num;
        var numStr = "";
        if (parser.ENTITIES[entity]) {
          return parser.ENTITIES[entity];
        }
        if (parser.ENTITIES[entityLC]) {
          return parser.ENTITIES[entityLC];
        }
        entity = entityLC;
        if (entity.charAt(0) === "#") {
          if (entity.charAt(1) === "x") {
            entity = entity.slice(2);
            num = parseInt(entity, 16);
            numStr = num.toString(16);
          } else {
            entity = entity.slice(1);
            num = parseInt(entity, 10);
            numStr = num.toString(10);
          }
        }
        entity = entity.replace(/^0+/, "");
        if (isNaN(num) || numStr.toLowerCase() !== entity || num < 0 || num > 1114111) {
          strictFail(parser, "Invalid character entity");
          return "&" + parser.entity + ";";
        }
        return String.fromCodePoint(num);
      }
      function beginWhiteSpace(parser, c) {
        if (c === "<") {
          parser.state = S.OPEN_WAKA;
          parser.startTagPosition = parser.position;
        } else if (!isWhitespace(c)) {
          strictFail(parser, "Non-whitespace before first tag.");
          parser.textNode = c;
          parser.state = S.TEXT;
        }
      }
      function charAt(chunk, i) {
        var result = "";
        if (i < chunk.length) {
          result = chunk.charAt(i);
        }
        return result;
      }
      function write(chunk) {
        var parser = this;
        if (this.error) {
          throw this.error;
        }
        if (parser.closed) {
          return error2(
            parser,
            "Cannot write after close. Assign an onready handler."
          );
        }
        if (chunk === null) {
          return end(parser);
        }
        if (typeof chunk === "object") {
          chunk = chunk.toString();
        }
        var i = 0;
        var c = "";
        while (true) {
          c = charAt(chunk, i++);
          parser.c = c;
          if (!c) {
            break;
          }
          if (parser.trackPosition) {
            parser.position++;
            if (c === "\n") {
              parser.line++;
              parser.column = 0;
            } else {
              parser.column++;
            }
          }
          switch (parser.state) {
            case S.BEGIN:
              parser.state = S.BEGIN_WHITESPACE;
              if (c === "\uFEFF") {
                continue;
              }
              beginWhiteSpace(parser, c);
              continue;
            case S.BEGIN_WHITESPACE:
              beginWhiteSpace(parser, c);
              continue;
            case S.TEXT:
              if (parser.sawRoot && !parser.closedRoot) {
                var starti = i - 1;
                while (c && c !== "<" && c !== "&") {
                  c = charAt(chunk, i++);
                  if (c && parser.trackPosition) {
                    parser.position++;
                    if (c === "\n") {
                      parser.line++;
                      parser.column = 0;
                    } else {
                      parser.column++;
                    }
                  }
                }
                parser.textNode += chunk.substring(starti, i - 1);
              }
              if (c === "<" && !(parser.sawRoot && parser.closedRoot && !parser.strict)) {
                parser.state = S.OPEN_WAKA;
                parser.startTagPosition = parser.position;
              } else {
                if (!isWhitespace(c) && (!parser.sawRoot || parser.closedRoot)) {
                  strictFail(parser, "Text data outside of root node.");
                }
                if (c === "&") {
                  parser.state = S.TEXT_ENTITY;
                } else {
                  parser.textNode += c;
                }
              }
              continue;
            case S.SCRIPT:
              if (c === "<") {
                parser.state = S.SCRIPT_ENDING;
              } else {
                parser.script += c;
              }
              continue;
            case S.SCRIPT_ENDING:
              if (c === "/") {
                parser.state = S.CLOSE_TAG;
              } else {
                parser.script += "<" + c;
                parser.state = S.SCRIPT;
              }
              continue;
            case S.OPEN_WAKA:
              if (c === "!") {
                parser.state = S.SGML_DECL;
                parser.sgmlDecl = "";
              } else if (isWhitespace(c)) ;
              else if (isMatch(nameStart, c)) {
                parser.state = S.OPEN_TAG;
                parser.tagName = c;
              } else if (c === "/") {
                parser.state = S.CLOSE_TAG;
                parser.tagName = "";
              } else if (c === "?") {
                parser.state = S.PROC_INST;
                parser.procInstName = parser.procInstBody = "";
              } else {
                strictFail(parser, "Unencoded <");
                if (parser.startTagPosition + 1 < parser.position) {
                  var pad = parser.position - parser.startTagPosition;
                  c = new Array(pad).join(" ") + c;
                }
                parser.textNode += "<" + c;
                parser.state = S.TEXT;
              }
              continue;
            case S.SGML_DECL:
              if (parser.sgmlDecl + c === "--") {
                parser.state = S.COMMENT;
                parser.comment = "";
                parser.sgmlDecl = "";
                continue;
              }
              if (parser.doctype && parser.doctype !== true && parser.sgmlDecl) {
                parser.state = S.DOCTYPE_DTD;
                parser.doctype += "<!" + parser.sgmlDecl + c;
                parser.sgmlDecl = "";
              } else if ((parser.sgmlDecl + c).toUpperCase() === CDATA) {
                emitNode(parser, "onopencdata");
                parser.state = S.CDATA;
                parser.sgmlDecl = "";
                parser.cdata = "";
              } else if ((parser.sgmlDecl + c).toUpperCase() === DOCTYPE) {
                parser.state = S.DOCTYPE;
                if (parser.doctype || parser.sawRoot) {
                  strictFail(
                    parser,
                    "Inappropriately located doctype declaration"
                  );
                }
                parser.doctype = "";
                parser.sgmlDecl = "";
              } else if (c === ">") {
                emitNode(parser, "onsgmldeclaration", parser.sgmlDecl);
                parser.sgmlDecl = "";
                parser.state = S.TEXT;
              } else if (isQuote(c)) {
                parser.state = S.SGML_DECL_QUOTED;
                parser.sgmlDecl += c;
              } else {
                parser.sgmlDecl += c;
              }
              continue;
            case S.SGML_DECL_QUOTED:
              if (c === parser.q) {
                parser.state = S.SGML_DECL;
                parser.q = "";
              }
              parser.sgmlDecl += c;
              continue;
            case S.DOCTYPE:
              if (c === ">") {
                parser.state = S.TEXT;
                emitNode(parser, "ondoctype", parser.doctype);
                parser.doctype = true;
              } else {
                parser.doctype += c;
                if (c === "[") {
                  parser.state = S.DOCTYPE_DTD;
                } else if (isQuote(c)) {
                  parser.state = S.DOCTYPE_QUOTED;
                  parser.q = c;
                }
              }
              continue;
            case S.DOCTYPE_QUOTED:
              parser.doctype += c;
              if (c === parser.q) {
                parser.q = "";
                parser.state = S.DOCTYPE;
              }
              continue;
            case S.DOCTYPE_DTD:
              if (c === "]") {
                parser.doctype += c;
                parser.state = S.DOCTYPE;
              } else if (c === "<") {
                parser.state = S.OPEN_WAKA;
                parser.startTagPosition = parser.position;
              } else if (isQuote(c)) {
                parser.doctype += c;
                parser.state = S.DOCTYPE_DTD_QUOTED;
                parser.q = c;
              } else {
                parser.doctype += c;
              }
              continue;
            case S.DOCTYPE_DTD_QUOTED:
              parser.doctype += c;
              if (c === parser.q) {
                parser.state = S.DOCTYPE_DTD;
                parser.q = "";
              }
              continue;
            case S.COMMENT:
              if (c === "-") {
                parser.state = S.COMMENT_ENDING;
              } else {
                parser.comment += c;
              }
              continue;
            case S.COMMENT_ENDING:
              if (c === "-") {
                parser.state = S.COMMENT_ENDED;
                parser.comment = textopts(parser.opt, parser.comment);
                if (parser.comment) {
                  emitNode(parser, "oncomment", parser.comment);
                }
                parser.comment = "";
              } else {
                parser.comment += "-" + c;
                parser.state = S.COMMENT;
              }
              continue;
            case S.COMMENT_ENDED:
              if (c !== ">") {
                strictFail(parser, "Malformed comment");
                parser.comment += "--" + c;
                parser.state = S.COMMENT;
              } else if (parser.doctype && parser.doctype !== true) {
                parser.state = S.DOCTYPE_DTD;
              } else {
                parser.state = S.TEXT;
              }
              continue;
            case S.CDATA:
              var starti = i - 1;
              while (c && c !== "]") {
                c = charAt(chunk, i++);
                if (c && parser.trackPosition) {
                  parser.position++;
                  if (c === "\n") {
                    parser.line++;
                    parser.column = 0;
                  } else {
                    parser.column++;
                  }
                }
              }
              parser.cdata += chunk.substring(starti, i - 1);
              if (c === "]") {
                parser.state = S.CDATA_ENDING;
              }
              continue;
            case S.CDATA_ENDING:
              if (c === "]") {
                parser.state = S.CDATA_ENDING_2;
              } else {
                parser.cdata += "]" + c;
                parser.state = S.CDATA;
              }
              continue;
            case S.CDATA_ENDING_2:
              if (c === ">") {
                if (parser.cdata) {
                  emitNode(parser, "oncdata", parser.cdata);
                }
                emitNode(parser, "onclosecdata");
                parser.cdata = "";
                parser.state = S.TEXT;
              } else if (c === "]") {
                parser.cdata += "]";
              } else {
                parser.cdata += "]]" + c;
                parser.state = S.CDATA;
              }
              continue;
            case S.PROC_INST:
              if (c === "?") {
                parser.state = S.PROC_INST_ENDING;
              } else if (isWhitespace(c)) {
                parser.state = S.PROC_INST_BODY;
              } else {
                parser.procInstName += c;
              }
              continue;
            case S.PROC_INST_BODY:
              if (!parser.procInstBody && isWhitespace(c)) {
                continue;
              } else if (c === "?") {
                parser.state = S.PROC_INST_ENDING;
              } else {
                parser.procInstBody += c;
              }
              continue;
            case S.PROC_INST_ENDING:
              if (c === ">") {
                const procInstEndData = {
                  name: parser.procInstName,
                  body: parser.procInstBody
                };
                validateXmlDeclarationEncoding(parser, procInstEndData);
                emitNode(parser, "onprocessinginstruction", procInstEndData);
                parser.procInstName = parser.procInstBody = "";
                parser.state = S.TEXT;
              } else {
                parser.procInstBody += "?" + c;
                parser.state = S.PROC_INST_BODY;
              }
              continue;
            case S.OPEN_TAG:
              if (isMatch(nameBody, c)) {
                parser.tagName += c;
              } else {
                newTag(parser);
                if (c === ">") {
                  openTag(parser);
                } else if (c === "/") {
                  parser.state = S.OPEN_TAG_SLASH;
                } else {
                  if (!isWhitespace(c)) {
                    strictFail(parser, "Invalid character in tag name");
                  }
                  parser.state = S.ATTRIB;
                }
              }
              continue;
            case S.OPEN_TAG_SLASH:
              if (c === ">") {
                openTag(parser, true);
                closeTag(parser);
              } else {
                strictFail(
                  parser,
                  "Forward-slash in opening tag not followed by >"
                );
                parser.state = S.ATTRIB;
              }
              continue;
            case S.ATTRIB:
              if (isWhitespace(c)) {
                continue;
              } else if (c === ">") {
                openTag(parser);
              } else if (c === "/") {
                parser.state = S.OPEN_TAG_SLASH;
              } else if (isMatch(nameStart, c)) {
                parser.attribName = c;
                parser.attribValue = "";
                parser.state = S.ATTRIB_NAME;
              } else {
                strictFail(parser, "Invalid attribute name");
              }
              continue;
            case S.ATTRIB_NAME:
              if (c === "=") {
                parser.state = S.ATTRIB_VALUE;
              } else if (c === ">") {
                strictFail(parser, "Attribute without value");
                parser.attribValue = parser.attribName;
                attrib(parser);
                openTag(parser);
              } else if (isWhitespace(c)) {
                parser.state = S.ATTRIB_NAME_SAW_WHITE;
              } else if (isMatch(nameBody, c)) {
                parser.attribName += c;
              } else {
                strictFail(parser, "Invalid attribute name");
              }
              continue;
            case S.ATTRIB_NAME_SAW_WHITE:
              if (c === "=") {
                parser.state = S.ATTRIB_VALUE;
              } else if (isWhitespace(c)) {
                continue;
              } else {
                strictFail(parser, "Attribute without value");
                parser.tag.attributes[parser.attribName] = "";
                parser.attribValue = "";
                emitNode(parser, "onattribute", {
                  name: parser.attribName,
                  value: ""
                });
                parser.attribName = "";
                if (c === ">") {
                  openTag(parser);
                } else if (isMatch(nameStart, c)) {
                  parser.attribName = c;
                  parser.state = S.ATTRIB_NAME;
                } else {
                  strictFail(parser, "Invalid attribute name");
                  parser.state = S.ATTRIB;
                }
              }
              continue;
            case S.ATTRIB_VALUE:
              if (isWhitespace(c)) {
                continue;
              } else if (isQuote(c)) {
                parser.q = c;
                parser.state = S.ATTRIB_VALUE_QUOTED;
              } else {
                if (!parser.opt.unquotedAttributeValues) {
                  error2(parser, "Unquoted attribute value");
                }
                parser.state = S.ATTRIB_VALUE_UNQUOTED;
                parser.attribValue = c;
              }
              continue;
            case S.ATTRIB_VALUE_QUOTED:
              if (c !== parser.q) {
                if (c === "&") {
                  parser.state = S.ATTRIB_VALUE_ENTITY_Q;
                } else {
                  parser.attribValue += c;
                }
                continue;
              }
              attrib(parser);
              parser.q = "";
              parser.state = S.ATTRIB_VALUE_CLOSED;
              continue;
            case S.ATTRIB_VALUE_CLOSED:
              if (isWhitespace(c)) {
                parser.state = S.ATTRIB;
              } else if (c === ">") {
                openTag(parser);
              } else if (c === "/") {
                parser.state = S.OPEN_TAG_SLASH;
              } else if (isMatch(nameStart, c)) {
                strictFail(parser, "No whitespace between attributes");
                parser.attribName = c;
                parser.attribValue = "";
                parser.state = S.ATTRIB_NAME;
              } else {
                strictFail(parser, "Invalid attribute name");
              }
              continue;
            case S.ATTRIB_VALUE_UNQUOTED:
              if (!isAttribEnd(c)) {
                if (c === "&") {
                  parser.state = S.ATTRIB_VALUE_ENTITY_U;
                } else {
                  parser.attribValue += c;
                }
                continue;
              }
              attrib(parser);
              if (c === ">") {
                openTag(parser);
              } else {
                parser.state = S.ATTRIB;
              }
              continue;
            case S.CLOSE_TAG:
              if (!parser.tagName) {
                if (isWhitespace(c)) {
                  continue;
                } else if (notMatch(nameStart, c)) {
                  if (parser.script) {
                    parser.script += "</" + c;
                    parser.state = S.SCRIPT;
                  } else {
                    strictFail(parser, "Invalid tagname in closing tag.");
                  }
                } else {
                  parser.tagName = c;
                }
              } else if (c === ">") {
                closeTag(parser);
              } else if (isMatch(nameBody, c)) {
                parser.tagName += c;
              } else if (parser.script) {
                parser.script += "</" + parser.tagName + c;
                parser.tagName = "";
                parser.state = S.SCRIPT;
              } else {
                if (!isWhitespace(c)) {
                  strictFail(parser, "Invalid tagname in closing tag");
                }
                parser.state = S.CLOSE_TAG_SAW_WHITE;
              }
              continue;
            case S.CLOSE_TAG_SAW_WHITE:
              if (isWhitespace(c)) {
                continue;
              }
              if (c === ">") {
                closeTag(parser);
              } else {
                strictFail(parser, "Invalid characters in closing tag");
              }
              continue;
            case S.TEXT_ENTITY:
            case S.ATTRIB_VALUE_ENTITY_Q:
            case S.ATTRIB_VALUE_ENTITY_U:
              var returnState;
              var buffer;
              switch (parser.state) {
                case S.TEXT_ENTITY:
                  returnState = S.TEXT;
                  buffer = "textNode";
                  break;
                case S.ATTRIB_VALUE_ENTITY_Q:
                  returnState = S.ATTRIB_VALUE_QUOTED;
                  buffer = "attribValue";
                  break;
                case S.ATTRIB_VALUE_ENTITY_U:
                  returnState = S.ATTRIB_VALUE_UNQUOTED;
                  buffer = "attribValue";
                  break;
              }
              if (c === ";") {
                var parsedEntity = parseEntity(parser);
                if (parser.opt.unparsedEntities && !Object.values(sax2.XML_ENTITIES).includes(parsedEntity)) {
                  if ((parser.entityCount += 1) > parser.opt.maxEntityCount) {
                    error2(
                      parser,
                      "Parsed entity count exceeds max entity count"
                    );
                  }
                  if ((parser.entityDepth += 1) > parser.opt.maxEntityDepth) {
                    error2(
                      parser,
                      "Parsed entity depth exceeds max entity depth"
                    );
                  }
                  parser.entity = "";
                  parser.state = returnState;
                  parser.write(parsedEntity);
                  parser.entityDepth -= 1;
                } else {
                  parser[buffer] += parsedEntity;
                  parser.entity = "";
                  parser.state = returnState;
                }
              } else if (isMatch(parser.entity.length ? entityBody : entityStart, c)) {
                parser.entity += c;
              } else {
                strictFail(parser, "Invalid character in entity name");
                parser[buffer] += "&" + parser.entity + c;
                parser.entity = "";
                parser.state = returnState;
              }
              continue;
            default: {
              throw new Error(parser, "Unknown state: " + parser.state);
            }
          }
        }
        if (parser.position >= parser.bufferCheckPosition) {
          checkBufferLength(parser);
        }
        return parser;
      }
      if (!String.fromCodePoint) {
        (function() {
          var stringFromCharCode = String.fromCharCode;
          var floor = Math.floor;
          var fromCodePoint = function() {
            var MAX_SIZE = 16384;
            var codeUnits = [];
            var highSurrogate;
            var lowSurrogate;
            var index2 = -1;
            var length = arguments.length;
            if (!length) {
              return "";
            }
            var result = "";
            while (++index2 < length) {
              var codePoint = Number(arguments[index2]);
              if (!isFinite(codePoint) || // `NaN`, `+Infinity`, or `-Infinity`
              codePoint < 0 || // not a valid Unicode code point
              codePoint > 1114111 || // not a valid Unicode code point
              floor(codePoint) !== codePoint) {
                throw RangeError("Invalid code point: " + codePoint);
              }
              if (codePoint <= 65535) {
                codeUnits.push(codePoint);
              } else {
                codePoint -= 65536;
                highSurrogate = (codePoint >> 10) + 55296;
                lowSurrogate = codePoint % 1024 + 56320;
                codeUnits.push(highSurrogate, lowSurrogate);
              }
              if (index2 + 1 === length || codeUnits.length > MAX_SIZE) {
                result += stringFromCharCode.apply(null, codeUnits);
                codeUnits.length = 0;
              }
            }
            return result;
          };
          if (Object.defineProperty) {
            Object.defineProperty(String, "fromCodePoint", {
              value: fromCodePoint,
              configurable: true,
              writable: true
            });
          } else {
            String.fromCodePoint = fromCodePoint;
          }
        })();
      }
    })(exports2);
  })(sax);
  return sax;
}
var hasRequiredXml;
function requireXml() {
  if (hasRequiredXml) return xml;
  hasRequiredXml = 1;
  Object.defineProperty(xml, "__esModule", { value: true });
  xml.XElement = void 0;
  xml.parseXml = parseXml;
  const sax2 = requireSax();
  const error_1 = requireError();
  class XElement {
    constructor(name) {
      this.name = name;
      this.value = "";
      this.attributes = null;
      this.isCData = false;
      this.elements = null;
      if (!name) {
        throw (0, error_1.newError)("Element name cannot be empty", "ERR_XML_ELEMENT_NAME_EMPTY");
      }
      if (!isValidName(name)) {
        throw (0, error_1.newError)(`Invalid element name: ${name}`, "ERR_XML_ELEMENT_INVALID_NAME");
      }
    }
    attribute(name) {
      const result = this.attributes === null ? null : this.attributes[name];
      if (result == null) {
        throw (0, error_1.newError)(`No attribute "${name}"`, "ERR_XML_MISSED_ATTRIBUTE");
      }
      return result;
    }
    removeAttribute(name) {
      if (this.attributes !== null) {
        delete this.attributes[name];
      }
    }
    element(name, ignoreCase = false, errorIfMissed = null) {
      const result = this.elementOrNull(name, ignoreCase);
      if (result === null) {
        throw (0, error_1.newError)(errorIfMissed || `No element "${name}"`, "ERR_XML_MISSED_ELEMENT");
      }
      return result;
    }
    elementOrNull(name, ignoreCase = false) {
      if (this.elements === null) {
        return null;
      }
      for (const element of this.elements) {
        if (isNameEquals(element, name, ignoreCase)) {
          return element;
        }
      }
      return null;
    }
    getElements(name, ignoreCase = false) {
      if (this.elements === null) {
        return [];
      }
      return this.elements.filter((it) => isNameEquals(it, name, ignoreCase));
    }
    elementValueOrEmpty(name, ignoreCase = false) {
      const element = this.elementOrNull(name, ignoreCase);
      return element === null ? "" : element.value;
    }
  }
  xml.XElement = XElement;
  const NAME_REG_EXP = new RegExp(/^[A-Za-z_][:A-Za-z0-9_-]*$/i);
  function isValidName(name) {
    return NAME_REG_EXP.test(name);
  }
  function isNameEquals(element, name, ignoreCase) {
    const elementName = element.name;
    return elementName === name || ignoreCase === true && elementName.length === name.length && elementName.toLowerCase() === name.toLowerCase();
  }
  function parseXml(data) {
    let rootElement = null;
    const parser = sax2.parser(true, {});
    const elements = [];
    parser.onopentag = (saxElement) => {
      const element = new XElement(saxElement.name);
      element.attributes = saxElement.attributes;
      if (rootElement === null) {
        rootElement = element;
      } else {
        const parent = elements[elements.length - 1];
        if (parent.elements == null) {
          parent.elements = [];
        }
        parent.elements.push(element);
      }
      elements.push(element);
    };
    parser.onclosetag = () => {
      elements.pop();
    };
    parser.ontext = (text) => {
      if (elements.length > 0) {
        elements[elements.length - 1].value = text;
      }
    };
    parser.oncdata = (cdata) => {
      const element = elements[elements.length - 1];
      element.value = cdata;
      element.isCData = true;
    };
    parser.onerror = (err) => {
      throw err;
    };
    parser.write(data);
    return rootElement;
  }
  return xml;
}
var objects = {};
var hasRequiredObjects;
function requireObjects() {
  if (hasRequiredObjects) return objects;
  hasRequiredObjects = 1;
  Object.defineProperty(objects, "__esModule", { value: true });
  objects.mapToObject = mapToObject;
  objects.isValidKey = isValidKey;
  objects.asArray = asArray;
  objects.deepAssign = deepAssign;
  objects.objectToArgs = objectToArgs;
  function mapToObject(map) {
    const obj = {};
    for (const [key, value] of map) {
      if (!isValidKey(key)) {
        continue;
      }
      if (value instanceof Map) {
        obj[key] = mapToObject(value);
      } else {
        obj[key] = value;
      }
    }
    return obj;
  }
  function isValidKey(key) {
    const protectedProperties = ["__proto__", "prototype", "constructor"];
    if (protectedProperties.includes(key)) {
      return false;
    }
    return ["string", "number", "symbol", "boolean"].includes(typeof key) || key === null;
  }
  function asArray(v) {
    if (v == null) {
      return [];
    } else if (Array.isArray(v)) {
      return v;
    } else {
      return [v];
    }
  }
  function isObject(x) {
    if (Array.isArray(x)) {
      return false;
    }
    const type = typeof x;
    return type === "object" || type === "function";
  }
  function assignKey(target, from, key) {
    const value = from[key];
    if (value === void 0) {
      return;
    }
    const prevValue = target[key];
    if (prevValue == null || value == null || !isObject(prevValue) || !isObject(value)) {
      if (Array.isArray(prevValue) && Array.isArray(value)) {
        target[key] = Array.from(new Set(prevValue.concat(value)));
      } else {
        target[key] = value;
      }
    } else {
      target[key] = assign(prevValue, value);
    }
  }
  function assign(to, from) {
    if (to !== from) {
      for (const key of Object.getOwnPropertyNames(from)) {
        if (isValidKey(key)) {
          assignKey(to, from, key);
        }
      }
    }
    return to;
  }
  function deepAssign(target, ...objects2) {
    for (const o of objects2) {
      if (o != null) {
        assign(target, o);
      }
    }
    return target;
  }
  const SAFE_FLAG_NAME_RE = /^[a-zA-Z][a-zA-Z0-9-]*$/;
  const UNSAFE_VALUE_RE = /[\0\r\n]/;
  function objectToArgs(obj) {
    const args = Object.entries(obj).reduce((args2, [name, value]) => {
      if (!isValidKey(name) || value == null) {
        return args2;
      }
      if (!SAFE_FLAG_NAME_RE.test(name)) {
        throw new Error(`objectToArgs: unsafe flag name rejected: ${JSON.stringify(name)}`);
      }
      if (UNSAFE_VALUE_RE.test(value)) {
        throw new Error(`objectToArgs: value for --${name} contains a null byte or newline`);
      }
      return args2.concat([`--${name}`, value]);
    }, []);
    return Object.freeze(args);
  }
  return objects;
}
var hasRequiredOut;
function requireOut() {
  if (hasRequiredOut) return out;
  hasRequiredOut = 1;
  (function(exports2) {
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.CURRENT_APP_PACKAGE_FILE_NAME = exports2.CURRENT_APP_INSTALLER_FILE_NAME = exports2.objectToArgs = exports2.deepAssign = exports2.asArray = exports2.mapToObject = exports2.isValidKey = exports2.XElement = exports2.parseXml = exports2.UUID = exports2.parseDn = exports2.retry = exports2.githubTagPrefix = exports2.githubUrl = exports2.getS3LikeProviderBaseUrl = exports2.ProgressCallbackTransform = exports2.MemoLazy = exports2.safeStringifyJson = exports2.safeGetHeader = exports2.parseJson = exports2.isSensitiveFieldName = exports2.HttpExecutor = exports2.hashSensitiveValue = exports2.HttpError = exports2.DigestTransform = exports2.createHttpError = exports2.configureRequestUrl = exports2.configureRequestOptionsFromUrl = exports2.configureRequestOptions = exports2.newError = exports2.CancellationToken = exports2.CancellationError = void 0;
    var CancellationToken_1 = requireCancellationToken();
    Object.defineProperty(exports2, "CancellationError", { enumerable: true, get: function() {
      return CancellationToken_1.CancellationError;
    } });
    Object.defineProperty(exports2, "CancellationToken", { enumerable: true, get: function() {
      return CancellationToken_1.CancellationToken;
    } });
    var error_1 = requireError();
    Object.defineProperty(exports2, "newError", { enumerable: true, get: function() {
      return error_1.newError;
    } });
    var httpExecutor_1 = requireHttpExecutor();
    Object.defineProperty(exports2, "configureRequestOptions", { enumerable: true, get: function() {
      return httpExecutor_1.configureRequestOptions;
    } });
    Object.defineProperty(exports2, "configureRequestOptionsFromUrl", { enumerable: true, get: function() {
      return httpExecutor_1.configureRequestOptionsFromUrl;
    } });
    Object.defineProperty(exports2, "configureRequestUrl", { enumerable: true, get: function() {
      return httpExecutor_1.configureRequestUrl;
    } });
    Object.defineProperty(exports2, "createHttpError", { enumerable: true, get: function() {
      return httpExecutor_1.createHttpError;
    } });
    Object.defineProperty(exports2, "DigestTransform", { enumerable: true, get: function() {
      return httpExecutor_1.DigestTransform;
    } });
    Object.defineProperty(exports2, "HttpError", { enumerable: true, get: function() {
      return httpExecutor_1.HttpError;
    } });
    Object.defineProperty(exports2, "hashSensitiveValue", { enumerable: true, get: function() {
      return httpExecutor_1.hashSensitiveValue;
    } });
    Object.defineProperty(exports2, "HttpExecutor", { enumerable: true, get: function() {
      return httpExecutor_1.HttpExecutor;
    } });
    Object.defineProperty(exports2, "isSensitiveFieldName", { enumerable: true, get: function() {
      return httpExecutor_1.isSensitiveFieldName;
    } });
    Object.defineProperty(exports2, "parseJson", { enumerable: true, get: function() {
      return httpExecutor_1.parseJson;
    } });
    Object.defineProperty(exports2, "safeGetHeader", { enumerable: true, get: function() {
      return httpExecutor_1.safeGetHeader;
    } });
    Object.defineProperty(exports2, "safeStringifyJson", { enumerable: true, get: function() {
      return httpExecutor_1.safeStringifyJson;
    } });
    var MemoLazy_1 = requireMemoLazy();
    Object.defineProperty(exports2, "MemoLazy", { enumerable: true, get: function() {
      return MemoLazy_1.MemoLazy;
    } });
    var ProgressCallbackTransform_1 = requireProgressCallbackTransform();
    Object.defineProperty(exports2, "ProgressCallbackTransform", { enumerable: true, get: function() {
      return ProgressCallbackTransform_1.ProgressCallbackTransform;
    } });
    var publishOptions_1 = requirePublishOptions();
    Object.defineProperty(exports2, "getS3LikeProviderBaseUrl", { enumerable: true, get: function() {
      return publishOptions_1.getS3LikeProviderBaseUrl;
    } });
    Object.defineProperty(exports2, "githubUrl", { enumerable: true, get: function() {
      return publishOptions_1.githubUrl;
    } });
    Object.defineProperty(exports2, "githubTagPrefix", { enumerable: true, get: function() {
      return publishOptions_1.githubTagPrefix;
    } });
    var retry_1 = requireRetry();
    Object.defineProperty(exports2, "retry", { enumerable: true, get: function() {
      return retry_1.retry;
    } });
    var rfc2253Parser_1 = requireRfc2253Parser();
    Object.defineProperty(exports2, "parseDn", { enumerable: true, get: function() {
      return rfc2253Parser_1.parseDn;
    } });
    var uuid_1 = requireUuid();
    Object.defineProperty(exports2, "UUID", { enumerable: true, get: function() {
      return uuid_1.UUID;
    } });
    var xml_1 = requireXml();
    Object.defineProperty(exports2, "parseXml", { enumerable: true, get: function() {
      return xml_1.parseXml;
    } });
    Object.defineProperty(exports2, "XElement", { enumerable: true, get: function() {
      return xml_1.XElement;
    } });
    var objects_1 = requireObjects();
    Object.defineProperty(exports2, "isValidKey", { enumerable: true, get: function() {
      return objects_1.isValidKey;
    } });
    Object.defineProperty(exports2, "mapToObject", { enumerable: true, get: function() {
      return objects_1.mapToObject;
    } });
    Object.defineProperty(exports2, "asArray", { enumerable: true, get: function() {
      return objects_1.asArray;
    } });
    Object.defineProperty(exports2, "deepAssign", { enumerable: true, get: function() {
      return objects_1.deepAssign;
    } });
    Object.defineProperty(exports2, "objectToArgs", { enumerable: true, get: function() {
      return objects_1.objectToArgs;
    } });
    exports2.CURRENT_APP_INSTALLER_FILE_NAME = "installer.exe";
    exports2.CURRENT_APP_PACKAGE_FILE_NAME = "package.7z";
  })(out);
  return out;
}
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJSMin = (cb, mod) => () => (mod || (cb((mod = { exports: {} }).exports, mod), cb = null), mod.exports);
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
    key = keys[i];
    if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
      get: ((k) => from[k]).bind(null, key),
      enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
    });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(__defProp(target, "default", {
  value: mod,
  enumerable: true
}), mod));
var require_common = /* @__PURE__ */ __commonJSMin(((exports2, module2) => {
  function isNothing(subject) {
    return typeof subject === "undefined" || subject === null;
  }
  function isObject(subject) {
    return typeof subject === "object" && subject !== null;
  }
  function toArray(sequence) {
    if (Array.isArray(sequence)) return sequence;
    else if (isNothing(sequence)) return [];
    return [sequence];
  }
  function extend(target, source) {
    if (source) {
      const sourceKeys = Object.keys(source);
      for (let index2 = 0, length = sourceKeys.length; index2 < length; index2 += 1) {
        const key = sourceKeys[index2];
        target[key] = source[key];
      }
    }
    return target;
  }
  function repeat(string, count) {
    let result = "";
    for (let cycle = 0; cycle < count; cycle += 1) result += string;
    return result;
  }
  function isNegativeZero(number) {
    return number === 0 && Number.NEGATIVE_INFINITY === 1 / number;
  }
  module2.exports.isNothing = isNothing;
  module2.exports.isObject = isObject;
  module2.exports.toArray = toArray;
  module2.exports.repeat = repeat;
  module2.exports.isNegativeZero = isNegativeZero;
  module2.exports.extend = extend;
}));
var require_exception = /* @__PURE__ */ __commonJSMin(((exports2, module2) => {
  function formatError(exception, compact) {
    let where = "";
    const message = exception.reason || "(unknown reason)";
    if (!exception.mark) return message;
    if (exception.mark.name) where += 'in "' + exception.mark.name + '" ';
    where += "(" + (exception.mark.line + 1) + ":" + (exception.mark.column + 1) + ")";
    if (!compact && exception.mark.snippet) where += "\n\n" + exception.mark.snippet;
    return message + " " + where;
  }
  function YAMLException2(reason, mark) {
    Error.call(this);
    this.name = "YAMLException";
    this.reason = reason;
    this.mark = mark;
    this.message = formatError(this, false);
    if (Error.captureStackTrace) Error.captureStackTrace(this, this.constructor);
    else this.stack = (/* @__PURE__ */ new Error()).stack || "";
  }
  YAMLException2.prototype = Object.create(Error.prototype);
  YAMLException2.prototype.constructor = YAMLException2;
  YAMLException2.prototype.toString = function toString(compact) {
    return this.name + ": " + formatError(this, compact);
  };
  module2.exports = YAMLException2;
}));
var require_snippet = /* @__PURE__ */ __commonJSMin(((exports2, module2) => {
  var common2 = require_common();
  function getLine(buffer, lineStart, lineEnd, position, maxLineLength) {
    let head = "";
    let tail = "";
    const maxHalfLength = Math.floor(maxLineLength / 2) - 1;
    if (position - lineStart > maxHalfLength) {
      head = " ... ";
      lineStart = position - maxHalfLength + head.length;
    }
    if (lineEnd - position > maxHalfLength) {
      tail = " ...";
      lineEnd = position + maxHalfLength - tail.length;
    }
    return {
      str: head + buffer.slice(lineStart, lineEnd).replace(/\t/g, "→") + tail,
      pos: position - lineStart + head.length
    };
  }
  function padStart(string, max) {
    return common2.repeat(" ", max - string.length) + string;
  }
  function makeSnippet(mark, options) {
    options = Object.create(options || null);
    if (!mark.buffer) return null;
    if (!options.maxLength) options.maxLength = 79;
    if (typeof options.indent !== "number") options.indent = 1;
    if (typeof options.linesBefore !== "number") options.linesBefore = 3;
    if (typeof options.linesAfter !== "number") options.linesAfter = 2;
    const re2 = /\r?\n|\r|\0/g;
    const lineStarts = [0];
    const lineEnds = [];
    let match;
    let foundLineNo = -1;
    while (match = re2.exec(mark.buffer)) {
      lineEnds.push(match.index);
      lineStarts.push(match.index + match[0].length);
      if (mark.position <= match.index && foundLineNo < 0) foundLineNo = lineStarts.length - 2;
    }
    if (foundLineNo < 0) foundLineNo = lineStarts.length - 1;
    let result = "";
    const lineNoLength = Math.min(mark.line + options.linesAfter, lineEnds.length).toString().length;
    const maxLineLength = options.maxLength - (options.indent + lineNoLength + 3);
    for (let i = 1; i <= options.linesBefore; i++) {
      if (foundLineNo - i < 0) break;
      const line2 = getLine(mark.buffer, lineStarts[foundLineNo - i], lineEnds[foundLineNo - i], mark.position - (lineStarts[foundLineNo] - lineStarts[foundLineNo - i]), maxLineLength);
      result = common2.repeat(" ", options.indent) + padStart((mark.line - i + 1).toString(), lineNoLength) + " | " + line2.str + "\n" + result;
    }
    const line = getLine(mark.buffer, lineStarts[foundLineNo], lineEnds[foundLineNo], mark.position, maxLineLength);
    result += common2.repeat(" ", options.indent) + padStart((mark.line + 1).toString(), lineNoLength) + " | " + line.str + "\n";
    result += common2.repeat("-", options.indent + lineNoLength + 3 + line.pos) + "^\n";
    for (let i = 1; i <= options.linesAfter; i++) {
      if (foundLineNo + i >= lineEnds.length) break;
      const line2 = getLine(mark.buffer, lineStarts[foundLineNo + i], lineEnds[foundLineNo + i], mark.position - (lineStarts[foundLineNo] - lineStarts[foundLineNo + i]), maxLineLength);
      result += common2.repeat(" ", options.indent) + padStart((mark.line + i + 1).toString(), lineNoLength) + " | " + line2.str + "\n";
    }
    return result.replace(/\n$/, "");
  }
  module2.exports = makeSnippet;
}));
var require_type = /* @__PURE__ */ __commonJSMin(((exports2, module2) => {
  var YAMLException2 = require_exception();
  var TYPE_CONSTRUCTOR_OPTIONS = [
    "kind",
    "multi",
    "resolve",
    "construct",
    "instanceOf",
    "predicate",
    "represent",
    "representName",
    "defaultStyle",
    "styleAliases"
  ];
  var YAML_NODE_KINDS = [
    "scalar",
    "sequence",
    "mapping"
  ];
  function compileStyleAliases(map) {
    const result = {};
    if (map !== null) Object.keys(map).forEach(function(style) {
      map[style].forEach(function(alias) {
        result[String(alias)] = style;
      });
    });
    return result;
  }
  function Type2(tag, options) {
    options = options || {};
    Object.keys(options).forEach(function(name) {
      if (TYPE_CONSTRUCTOR_OPTIONS.indexOf(name) === -1) throw new YAMLException2('Unknown option "' + name + '" is met in definition of "' + tag + '" YAML type.');
    });
    this.options = options;
    this.tag = tag;
    this.kind = options["kind"] || null;
    this.resolve = options["resolve"] || function() {
      return true;
    };
    this.construct = options["construct"] || function(data) {
      return data;
    };
    this.instanceOf = options["instanceOf"] || null;
    this.predicate = options["predicate"] || null;
    this.represent = options["represent"] || null;
    this.representName = options["representName"] || null;
    this.defaultStyle = options["defaultStyle"] || null;
    this.multi = options["multi"] || false;
    this.styleAliases = compileStyleAliases(options["styleAliases"] || null);
    if (YAML_NODE_KINDS.indexOf(this.kind) === -1) throw new YAMLException2('Unknown kind "' + this.kind + '" is specified for "' + tag + '" YAML type.');
  }
  module2.exports = Type2;
}));
var require_schema = /* @__PURE__ */ __commonJSMin(((exports2, module2) => {
  var YAMLException2 = require_exception();
  var Type2 = require_type();
  function compileList(schema, name) {
    const result = [];
    schema[name].forEach(function(currentType) {
      let newIndex = result.length;
      result.forEach(function(previousType, previousIndex) {
        if (previousType.tag === currentType.tag && previousType.kind === currentType.kind && previousType.multi === currentType.multi) newIndex = previousIndex;
      });
      result[newIndex] = currentType;
    });
    return result;
  }
  function compileMap() {
    const result = {
      scalar: {},
      sequence: {},
      mapping: {},
      fallback: {},
      multi: {
        scalar: [],
        sequence: [],
        mapping: [],
        fallback: []
      }
    };
    function collectType(type) {
      if (type.multi) {
        result.multi[type.kind].push(type);
        result.multi["fallback"].push(type);
      } else result[type.kind][type.tag] = result["fallback"][type.tag] = type;
    }
    for (let index2 = 0, length = arguments.length; index2 < length; index2 += 1) arguments[index2].forEach(collectType);
    return result;
  }
  function Schema2(definition) {
    return this.extend(definition);
  }
  Schema2.prototype.extend = function extend(definition) {
    let implicit = [];
    let explicit = [];
    if (definition instanceof Type2) explicit.push(definition);
    else if (Array.isArray(definition)) explicit = explicit.concat(definition);
    else if (definition && (Array.isArray(definition.implicit) || Array.isArray(definition.explicit))) {
      if (definition.implicit) implicit = implicit.concat(definition.implicit);
      if (definition.explicit) explicit = explicit.concat(definition.explicit);
    } else throw new YAMLException2("Schema.extend argument should be a Type, [ Type ], or a schema definition ({ implicit: [...], explicit: [...] })");
    implicit.forEach(function(type) {
      if (!(type instanceof Type2)) throw new YAMLException2("Specified list of YAML types (or a single Type object) contains a non-Type object.");
      if (type.loadKind && type.loadKind !== "scalar") throw new YAMLException2("There is a non-scalar type in the implicit list of a schema. Implicit resolving of such types is not supported.");
      if (type.multi) throw new YAMLException2("There is a multi type in the implicit list of a schema. Multi tags can only be listed as explicit.");
    });
    explicit.forEach(function(type) {
      if (!(type instanceof Type2)) throw new YAMLException2("Specified list of YAML types (or a single Type object) contains a non-Type object.");
    });
    const result = Object.create(Schema2.prototype);
    result.implicit = (this.implicit || []).concat(implicit);
    result.explicit = (this.explicit || []).concat(explicit);
    result.compiledImplicit = compileList(result, "implicit");
    result.compiledExplicit = compileList(result, "explicit");
    result.compiledTypeMap = compileMap(result.compiledImplicit, result.compiledExplicit);
    return result;
  };
  module2.exports = Schema2;
}));
var require_str = /* @__PURE__ */ __commonJSMin(((exports2, module2) => {
  module2.exports = new (require_type())("tag:yaml.org,2002:str", {
    kind: "scalar",
    construct: function(data) {
      return data !== null ? data : "";
    }
  });
}));
var require_seq = /* @__PURE__ */ __commonJSMin(((exports2, module2) => {
  module2.exports = new (require_type())("tag:yaml.org,2002:seq", {
    kind: "sequence",
    construct: function(data) {
      return data !== null ? data : [];
    }
  });
}));
var require_map = /* @__PURE__ */ __commonJSMin(((exports2, module2) => {
  module2.exports = new (require_type())("tag:yaml.org,2002:map", {
    kind: "mapping",
    construct: function(data) {
      return data !== null ? data : {};
    }
  });
}));
var require_failsafe = /* @__PURE__ */ __commonJSMin(((exports2, module2) => {
  module2.exports = new (require_schema())({ explicit: [
    require_str(),
    require_seq(),
    require_map()
  ] });
}));
var require_null = /* @__PURE__ */ __commonJSMin(((exports2, module2) => {
  var Type2 = require_type();
  function resolveYamlNull(data) {
    if (data === null) return true;
    const max = data.length;
    return max === 1 && data === "~" || max === 4 && (data === "null" || data === "Null" || data === "NULL");
  }
  function constructYamlNull() {
    return null;
  }
  function isNull(object) {
    return object === null;
  }
  module2.exports = new Type2("tag:yaml.org,2002:null", {
    kind: "scalar",
    resolve: resolveYamlNull,
    construct: constructYamlNull,
    predicate: isNull,
    represent: {
      canonical: function() {
        return "~";
      },
      lowercase: function() {
        return "null";
      },
      uppercase: function() {
        return "NULL";
      },
      camelcase: function() {
        return "Null";
      },
      empty: function() {
        return "";
      }
    },
    defaultStyle: "lowercase"
  });
}));
var require_bool = /* @__PURE__ */ __commonJSMin(((exports2, module2) => {
  var Type2 = require_type();
  function resolveYamlBoolean(data) {
    if (data === null) return false;
    const max = data.length;
    return max === 4 && (data === "true" || data === "True" || data === "TRUE") || max === 5 && (data === "false" || data === "False" || data === "FALSE");
  }
  function constructYamlBoolean(data) {
    return data === "true" || data === "True" || data === "TRUE";
  }
  function isBoolean(object) {
    return Object.prototype.toString.call(object) === "[object Boolean]";
  }
  module2.exports = new Type2("tag:yaml.org,2002:bool", {
    kind: "scalar",
    resolve: resolveYamlBoolean,
    construct: constructYamlBoolean,
    predicate: isBoolean,
    represent: {
      lowercase: function(object) {
        return object ? "true" : "false";
      },
      uppercase: function(object) {
        return object ? "TRUE" : "FALSE";
      },
      camelcase: function(object) {
        return object ? "True" : "False";
      }
    },
    defaultStyle: "lowercase"
  });
}));
var require_int = /* @__PURE__ */ __commonJSMin(((exports2, module2) => {
  var common2 = require_common();
  var Type2 = require_type();
  function isHexCode(c) {
    return c >= 48 && c <= 57 || c >= 65 && c <= 70 || c >= 97 && c <= 102;
  }
  function isOctCode(c) {
    return c >= 48 && c <= 55;
  }
  function isDecCode(c) {
    return c >= 48 && c <= 57;
  }
  function resolveYamlInteger(data) {
    if (data === null) return false;
    const max = data.length;
    let index2 = 0;
    let hasDigits = false;
    if (!max) return false;
    let ch = data[index2];
    if (ch === "-" || ch === "+") ch = data[++index2];
    if (ch === "0") {
      if (index2 + 1 === max) return true;
      ch = data[++index2];
      if (ch === "b") {
        index2++;
        for (; index2 < max; index2++) {
          ch = data[index2];
          if (ch !== "0" && ch !== "1") return false;
          hasDigits = true;
        }
        return hasDigits && Number.isFinite(parseYamlInteger(data));
      }
      if (ch === "x") {
        index2++;
        for (; index2 < max; index2++) {
          if (!isHexCode(data.charCodeAt(index2))) return false;
          hasDigits = true;
        }
        return hasDigits && Number.isFinite(parseYamlInteger(data));
      }
      if (ch === "o") {
        index2++;
        for (; index2 < max; index2++) {
          if (!isOctCode(data.charCodeAt(index2))) return false;
          hasDigits = true;
        }
        return hasDigits && Number.isFinite(parseYamlInteger(data));
      }
    }
    for (; index2 < max; index2++) {
      if (!isDecCode(data.charCodeAt(index2))) return false;
      hasDigits = true;
    }
    if (!hasDigits) return false;
    return Number.isFinite(parseYamlInteger(data));
  }
  function parseYamlInteger(data) {
    let value = data;
    let sign = 1;
    let ch = value[0];
    if (ch === "-" || ch === "+") {
      if (ch === "-") sign = -1;
      value = value.slice(1);
      ch = value[0];
    }
    if (value === "0") return 0;
    if (ch === "0") {
      if (value[1] === "b") return sign * parseInt(value.slice(2), 2);
      if (value[1] === "x") return sign * parseInt(value.slice(2), 16);
      if (value[1] === "o") return sign * parseInt(value.slice(2), 8);
    }
    return sign * parseInt(value, 10);
  }
  function constructYamlInteger(data) {
    return parseYamlInteger(data);
  }
  function isInteger(object) {
    return Object.prototype.toString.call(object) === "[object Number]" && object % 1 === 0 && !common2.isNegativeZero(object);
  }
  module2.exports = new Type2("tag:yaml.org,2002:int", {
    kind: "scalar",
    resolve: resolveYamlInteger,
    construct: constructYamlInteger,
    predicate: isInteger,
    represent: {
      binary: function(obj) {
        return obj >= 0 ? "0b" + obj.toString(2) : "-0b" + obj.toString(2).slice(1);
      },
      octal: function(obj) {
        return obj >= 0 ? "0o" + obj.toString(8) : "-0o" + obj.toString(8).slice(1);
      },
      decimal: function(obj) {
        return obj.toString(10);
      },
      hexadecimal: function(obj) {
        return obj >= 0 ? "0x" + obj.toString(16).toUpperCase() : "-0x" + obj.toString(16).toUpperCase().slice(1);
      }
    },
    defaultStyle: "decimal",
    styleAliases: {
      binary: [2, "bin"],
      octal: [8, "oct"],
      decimal: [10, "dec"],
      hexadecimal: [16, "hex"]
    }
  });
}));
var require_float = /* @__PURE__ */ __commonJSMin(((exports2, module2) => {
  var common2 = require_common();
  var Type2 = require_type();
  var YAML_FLOAT_PATTERN = /* @__PURE__ */ new RegExp("^(?:[-+]?(?:[0-9]+)(?:\\.[0-9]*)?(?:[eE][-+]?[0-9]+)?|\\.[0-9]+(?:[eE][-+]?[0-9]+)?|[-+]?\\.(?:inf|Inf|INF)|\\.(?:nan|NaN|NAN))$");
  var YAML_FLOAT_SPECIAL_PATTERN = /* @__PURE__ */ new RegExp("^(?:[-+]?\\.(?:inf|Inf|INF)|\\.(?:nan|NaN|NAN))$");
  function resolveYamlFloat(data) {
    if (data === null) return false;
    if (!YAML_FLOAT_PATTERN.test(data)) return false;
    if (Number.isFinite(parseFloat(data, 10))) return true;
    return YAML_FLOAT_SPECIAL_PATTERN.test(data);
  }
  function constructYamlFloat(data) {
    let value = data.toLowerCase();
    const sign = value[0] === "-" ? -1 : 1;
    if ("+-".indexOf(value[0]) >= 0) value = value.slice(1);
    if (value === ".inf") return sign === 1 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
    else if (value === ".nan") return NaN;
    return sign * parseFloat(value, 10);
  }
  var SCIENTIFIC_WITHOUT_DOT = /^[-+]?[0-9]+e/;
  function representYamlFloat(object, style) {
    if (isNaN(object)) switch (style) {
      case "lowercase":
        return ".nan";
      case "uppercase":
        return ".NAN";
      case "camelcase":
        return ".NaN";
    }
    else if (Number.POSITIVE_INFINITY === object) switch (style) {
      case "lowercase":
        return ".inf";
      case "uppercase":
        return ".INF";
      case "camelcase":
        return ".Inf";
    }
    else if (Number.NEGATIVE_INFINITY === object) switch (style) {
      case "lowercase":
        return "-.inf";
      case "uppercase":
        return "-.INF";
      case "camelcase":
        return "-.Inf";
    }
    else if (common2.isNegativeZero(object)) return "-0.0";
    const res = object.toString(10);
    return SCIENTIFIC_WITHOUT_DOT.test(res) ? res.replace("e", ".e") : res;
  }
  function isFloat(object) {
    return Object.prototype.toString.call(object) === "[object Number]" && (object % 1 !== 0 || common2.isNegativeZero(object));
  }
  module2.exports = new Type2("tag:yaml.org,2002:float", {
    kind: "scalar",
    resolve: resolveYamlFloat,
    construct: constructYamlFloat,
    predicate: isFloat,
    represent: representYamlFloat,
    defaultStyle: "lowercase"
  });
}));
var require_json = /* @__PURE__ */ __commonJSMin(((exports2, module2) => {
  module2.exports = require_failsafe().extend({ implicit: [
    require_null(),
    require_bool(),
    require_int(),
    require_float()
  ] });
}));
var require_core = /* @__PURE__ */ __commonJSMin(((exports2, module2) => {
  module2.exports = require_json();
}));
var require_timestamp = /* @__PURE__ */ __commonJSMin(((exports2, module2) => {
  var Type2 = require_type();
  var YAML_DATE_REGEXP = /* @__PURE__ */ new RegExp("^([0-9][0-9][0-9][0-9])-([0-9][0-9])-([0-9][0-9])$");
  var YAML_TIMESTAMP_REGEXP = /* @__PURE__ */ new RegExp("^([0-9][0-9][0-9][0-9])-([0-9][0-9]?)-([0-9][0-9]?)(?:[Tt]|[ \\t]+)([0-9][0-9]?):([0-9][0-9]):([0-9][0-9])(?:\\.([0-9]*))?(?:[ \\t]*(Z|([-+])([0-9][0-9]?)(?::([0-9][0-9]))?))?$");
  function resolveYamlTimestamp(data) {
    if (data === null) return false;
    if (YAML_DATE_REGEXP.exec(data) !== null) return true;
    if (YAML_TIMESTAMP_REGEXP.exec(data) !== null) return true;
    return false;
  }
  function constructYamlTimestamp(data) {
    let fraction = 0;
    let delta = null;
    let match = YAML_DATE_REGEXP.exec(data);
    if (match === null) match = YAML_TIMESTAMP_REGEXP.exec(data);
    if (match === null) throw new Error("Date resolve error");
    const year = +match[1];
    const month = +match[2] - 1;
    const day = +match[3];
    if (!match[4]) return new Date(Date.UTC(year, month, day));
    const hour = +match[4];
    const minute = +match[5];
    const second = +match[6];
    if (match[7]) {
      fraction = match[7].slice(0, 3);
      while (fraction.length < 3) fraction += "0";
      fraction = +fraction;
    }
    if (match[9]) {
      const tzHour = +match[10];
      const tzMinute = +(match[11] || 0);
      delta = (tzHour * 60 + tzMinute) * 6e4;
      if (match[9] === "-") delta = -delta;
    }
    const date = new Date(Date.UTC(year, month, day, hour, minute, second, fraction));
    if (delta) date.setTime(date.getTime() - delta);
    return date;
  }
  function representYamlTimestamp(object) {
    return object.toISOString();
  }
  module2.exports = new Type2("tag:yaml.org,2002:timestamp", {
    kind: "scalar",
    resolve: resolveYamlTimestamp,
    construct: constructYamlTimestamp,
    instanceOf: Date,
    represent: representYamlTimestamp
  });
}));
var require_merge = /* @__PURE__ */ __commonJSMin(((exports2, module2) => {
  var Type2 = require_type();
  function resolveYamlMerge(data) {
    return data === "<<" || data === null;
  }
  module2.exports = new Type2("tag:yaml.org,2002:merge", {
    kind: "scalar",
    resolve: resolveYamlMerge
  });
}));
var require_binary = /* @__PURE__ */ __commonJSMin(((exports2, module2) => {
  var Type2 = require_type();
  var BASE64_MAP = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=\n\r";
  function resolveYamlBinary(data) {
    if (data === null) return false;
    let bitlen = 0;
    const max = data.length;
    const map = BASE64_MAP;
    for (let idx = 0; idx < max; idx++) {
      const code = map.indexOf(data.charAt(idx));
      if (code > 64) continue;
      if (code < 0) return false;
      bitlen += 6;
    }
    return bitlen % 8 === 0;
  }
  function constructYamlBinary(data) {
    const input = data.replace(/[\r\n=]/g, "");
    const max = input.length;
    const map = BASE64_MAP;
    let bits = 0;
    const result = [];
    for (let idx = 0; idx < max; idx++) {
      if (idx % 4 === 0 && idx) {
        result.push(bits >> 16 & 255);
        result.push(bits >> 8 & 255);
        result.push(bits & 255);
      }
      bits = bits << 6 | map.indexOf(input.charAt(idx));
    }
    const tailbits = max % 4 * 6;
    if (tailbits === 0) {
      result.push(bits >> 16 & 255);
      result.push(bits >> 8 & 255);
      result.push(bits & 255);
    } else if (tailbits === 18) {
      result.push(bits >> 10 & 255);
      result.push(bits >> 2 & 255);
    } else if (tailbits === 12) result.push(bits >> 4 & 255);
    return new Uint8Array(result);
  }
  function representYamlBinary(object) {
    let result = "";
    let bits = 0;
    const max = object.length;
    const map = BASE64_MAP;
    for (let idx = 0; idx < max; idx++) {
      if (idx % 3 === 0 && idx) {
        result += map[bits >> 18 & 63];
        result += map[bits >> 12 & 63];
        result += map[bits >> 6 & 63];
        result += map[bits & 63];
      }
      bits = (bits << 8) + object[idx];
    }
    const tail = max % 3;
    if (tail === 0) {
      result += map[bits >> 18 & 63];
      result += map[bits >> 12 & 63];
      result += map[bits >> 6 & 63];
      result += map[bits & 63];
    } else if (tail === 2) {
      result += map[bits >> 10 & 63];
      result += map[bits >> 4 & 63];
      result += map[bits << 2 & 63];
      result += map[64];
    } else if (tail === 1) {
      result += map[bits >> 2 & 63];
      result += map[bits << 4 & 63];
      result += map[64];
      result += map[64];
    }
    return result;
  }
  function isBinary(obj) {
    return Object.prototype.toString.call(obj) === "[object Uint8Array]";
  }
  module2.exports = new Type2("tag:yaml.org,2002:binary", {
    kind: "scalar",
    resolve: resolveYamlBinary,
    construct: constructYamlBinary,
    predicate: isBinary,
    represent: representYamlBinary
  });
}));
var require_omap = /* @__PURE__ */ __commonJSMin(((exports2, module2) => {
  var Type2 = require_type();
  var _hasOwnProperty = Object.prototype.hasOwnProperty;
  var _toString = Object.prototype.toString;
  function resolveYamlOmap(data) {
    if (data === null) return true;
    const objectKeys = [];
    const object = data;
    for (let index2 = 0, length = object.length; index2 < length; index2 += 1) {
      const pair = object[index2];
      let pairHasKey = false;
      if (_toString.call(pair) !== "[object Object]") return false;
      let pairKey;
      for (pairKey in pair) if (_hasOwnProperty.call(pair, pairKey)) if (!pairHasKey) pairHasKey = true;
      else return false;
      if (!pairHasKey) return false;
      if (objectKeys.indexOf(pairKey) === -1) objectKeys.push(pairKey);
      else return false;
    }
    return true;
  }
  function constructYamlOmap(data) {
    return data !== null ? data : [];
  }
  module2.exports = new Type2("tag:yaml.org,2002:omap", {
    kind: "sequence",
    resolve: resolveYamlOmap,
    construct: constructYamlOmap
  });
}));
var require_pairs = /* @__PURE__ */ __commonJSMin(((exports2, module2) => {
  var Type2 = require_type();
  var _toString = Object.prototype.toString;
  function resolveYamlPairs(data) {
    if (data === null) return true;
    const object = data;
    const result = new Array(object.length);
    for (let index2 = 0, length = object.length; index2 < length; index2 += 1) {
      const pair = object[index2];
      if (_toString.call(pair) !== "[object Object]") return false;
      const keys = Object.keys(pair);
      if (keys.length !== 1) return false;
      result[index2] = [keys[0], pair[keys[0]]];
    }
    return true;
  }
  function constructYamlPairs(data) {
    if (data === null) return [];
    const object = data;
    const result = new Array(object.length);
    for (let index2 = 0, length = object.length; index2 < length; index2 += 1) {
      const pair = object[index2];
      const keys = Object.keys(pair);
      result[index2] = [keys[0], pair[keys[0]]];
    }
    return result;
  }
  module2.exports = new Type2("tag:yaml.org,2002:pairs", {
    kind: "sequence",
    resolve: resolveYamlPairs,
    construct: constructYamlPairs
  });
}));
var require_set = /* @__PURE__ */ __commonJSMin(((exports2, module2) => {
  var Type2 = require_type();
  var _hasOwnProperty = Object.prototype.hasOwnProperty;
  function resolveYamlSet(data) {
    if (data === null) return true;
    const object = data;
    for (const key in object) if (_hasOwnProperty.call(object, key)) {
      if (object[key] !== null) return false;
    }
    return true;
  }
  function constructYamlSet(data) {
    return data !== null ? data : {};
  }
  module2.exports = new Type2("tag:yaml.org,2002:set", {
    kind: "mapping",
    resolve: resolveYamlSet,
    construct: constructYamlSet
  });
}));
var require_default = /* @__PURE__ */ __commonJSMin(((exports2, module2) => {
  module2.exports = require_core().extend({
    implicit: [require_timestamp(), require_merge()],
    explicit: [
      require_binary(),
      require_omap(),
      require_pairs(),
      require_set()
    ]
  });
}));
var require_loader = /* @__PURE__ */ __commonJSMin(((exports2, module2) => {
  var common2 = require_common();
  var YAMLException2 = require_exception();
  var makeSnippet = require_snippet();
  var DEFAULT_SCHEMA2 = require_default();
  var _hasOwnProperty = Object.prototype.hasOwnProperty;
  var CONTEXT_FLOW_IN = 1;
  var CONTEXT_FLOW_OUT = 2;
  var CONTEXT_BLOCK_IN = 3;
  var CONTEXT_BLOCK_OUT = 4;
  var CHOMPING_CLIP = 1;
  var CHOMPING_STRIP = 2;
  var CHOMPING_KEEP = 3;
  var PATTERN_NON_PRINTABLE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x84\x86-\x9F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/;
  var PATTERN_NON_ASCII_LINE_BREAKS = /[\x85\u2028\u2029]/;
  var PATTERN_FLOW_INDICATORS = /[,\[\]{}]/;
  var PATTERN_TAG_HANDLE = /^(?:!|!!|![0-9A-Za-z-]+!)$/;
  var PATTERN_TAG_URI = /^(?:!|[^,\[\]{}])(?:%[0-9a-f]{2}|[0-9a-z\-#;/?:@&=+$,_.!~*'()\[\]])*$/i;
  function _class(obj) {
    return Object.prototype.toString.call(obj);
  }
  function isEol(c) {
    return c === 10 || c === 13;
  }
  function isWhiteSpace(c) {
    return c === 9 || c === 32;
  }
  function isWsOrEol(c) {
    return c === 9 || c === 32 || c === 10 || c === 13;
  }
  function isFlowIndicator(c) {
    return c === 44 || c === 91 || c === 93 || c === 123 || c === 125;
  }
  function fromHexCode(c) {
    if (c >= 48 && c <= 57) return c - 48;
    const lc = c | 32;
    if (lc >= 97 && lc <= 102) return lc - 97 + 10;
    return -1;
  }
  function escapedHexLen(c) {
    if (c === 120) return 2;
    if (c === 117) return 4;
    if (c === 85) return 8;
    return 0;
  }
  function fromDecimalCode(c) {
    if (c >= 48 && c <= 57) return c - 48;
    return -1;
  }
  function simpleEscapeSequence(c) {
    switch (c) {
      case 48:
        return "\0";
      case 97:
        return "\x07";
      case 98:
        return "\b";
      case 116:
        return "	";
      case 9:
        return "	";
      case 110:
        return "\n";
      case 118:
        return "\v";
      case 102:
        return "\f";
      case 114:
        return "\r";
      case 101:
        return "\x1B";
      case 32:
        return " ";
      case 34:
        return '"';
      case 47:
        return "/";
      case 92:
        return "\\";
      case 78:
        return "";
      case 95:
        return " ";
      case 76:
        return "\u2028";
      case 80:
        return "\u2029";
      default:
        return "";
    }
  }
  function charFromCodepoint(c) {
    if (c <= 65535) return String.fromCharCode(c);
    return String.fromCharCode((c - 65536 >> 10) + 55296, (c - 65536 & 1023) + 56320);
  }
  function setProperty(object, key, value) {
    if (key === "__proto__") Object.defineProperty(object, key, {
      configurable: true,
      enumerable: true,
      writable: true,
      value
    });
    else object[key] = value;
  }
  var simpleEscapeCheck = new Array(256);
  var simpleEscapeMap = new Array(256);
  for (let i = 0; i < 256; i++) {
    simpleEscapeCheck[i] = simpleEscapeSequence(i) ? 1 : 0;
    simpleEscapeMap[i] = simpleEscapeSequence(i);
  }
  function State(input, options) {
    this.input = input;
    this.filename = options["filename"] || null;
    this.schema = options["schema"] || DEFAULT_SCHEMA2;
    this.onWarning = options["onWarning"] || null;
    this.legacy = options["legacy"] || false;
    this.json = options["json"] || false;
    this.listener = options["listener"] || null;
    this.maxDepth = typeof options["maxDepth"] === "number" ? options["maxDepth"] : 100;
    this.maxMergeSeqLength = typeof options["maxMergeSeqLength"] === "number" ? options["maxMergeSeqLength"] : 20;
    this.implicitTypes = this.schema.compiledImplicit;
    this.typeMap = this.schema.compiledTypeMap;
    this.length = input.length;
    this.position = 0;
    this.line = 0;
    this.lineStart = 0;
    this.lineIndent = 0;
    this.depth = 0;
    this.firstTabInLine = -1;
    this.documents = [];
    this.anchorMapTransactions = [];
  }
  function generateError(state, message) {
    const mark = {
      name: state.filename,
      buffer: state.input.slice(0, -1),
      position: state.position,
      line: state.line,
      column: state.position - state.lineStart
    };
    mark.snippet = makeSnippet(mark);
    return new YAMLException2(message, mark);
  }
  function throwError(state, message) {
    throw generateError(state, message);
  }
  function throwWarning(state, message) {
    if (state.onWarning) state.onWarning.call(null, generateError(state, message));
  }
  function storeAnchor(state, name, value) {
    const transactions = state.anchorMapTransactions;
    if (transactions.length !== 0) {
      const transaction = transactions[transactions.length - 1];
      if (!_hasOwnProperty.call(transaction, name)) transaction[name] = {
        existed: _hasOwnProperty.call(state.anchorMap, name),
        value: state.anchorMap[name]
      };
    }
    state.anchorMap[name] = value;
  }
  function beginAnchorTransaction(state) {
    state.anchorMapTransactions.push(/* @__PURE__ */ Object.create(null));
  }
  function commitAnchorTransaction(state) {
    const transaction = state.anchorMapTransactions.pop();
    const transactions = state.anchorMapTransactions;
    if (transactions.length === 0) return;
    const parent = transactions[transactions.length - 1];
    const names = Object.keys(transaction);
    for (let index2 = 0, length = names.length; index2 < length; index2 += 1) {
      const name = names[index2];
      if (!_hasOwnProperty.call(parent, name)) parent[name] = transaction[name];
    }
  }
  function rollbackAnchorTransaction(state) {
    const transaction = state.anchorMapTransactions.pop();
    const names = Object.keys(transaction);
    for (let index2 = names.length - 1; index2 >= 0; index2 -= 1) {
      const entry = transaction[names[index2]];
      if (entry.existed) state.anchorMap[names[index2]] = entry.value;
      else delete state.anchorMap[names[index2]];
    }
  }
  function snapshotState(state) {
    return {
      position: state.position,
      line: state.line,
      lineStart: state.lineStart,
      lineIndent: state.lineIndent,
      firstTabInLine: state.firstTabInLine,
      tag: state.tag,
      anchor: state.anchor,
      kind: state.kind,
      result: state.result
    };
  }
  function restoreState(state, snapshot) {
    state.position = snapshot.position;
    state.line = snapshot.line;
    state.lineStart = snapshot.lineStart;
    state.lineIndent = snapshot.lineIndent;
    state.firstTabInLine = snapshot.firstTabInLine;
    state.tag = snapshot.tag;
    state.anchor = snapshot.anchor;
    state.kind = snapshot.kind;
    state.result = snapshot.result;
  }
  var directiveHandlers = {
    YAML: function handleYamlDirective(state, name, args) {
      if (state.version !== null) throwError(state, "duplication of %YAML directive");
      if (args.length !== 1) throwError(state, "YAML directive accepts exactly one argument");
      const match = /^([0-9]+)\.([0-9]+)$/.exec(args[0]);
      if (match === null) throwError(state, "ill-formed argument of the YAML directive");
      const major = parseInt(match[1], 10);
      const minor = parseInt(match[2], 10);
      if (major !== 1) throwError(state, "unacceptable YAML version of the document");
      state.version = args[0];
      state.checkLineBreaks = minor < 2;
      if (minor !== 1 && minor !== 2) throwWarning(state, "unsupported YAML version of the document");
    },
    TAG: function handleTagDirective(state, name, args) {
      let prefix;
      if (args.length !== 2) throwError(state, "TAG directive accepts exactly two arguments");
      const handle = args[0];
      prefix = args[1];
      if (!PATTERN_TAG_HANDLE.test(handle)) throwError(state, "ill-formed tag handle (first argument) of the TAG directive");
      if (_hasOwnProperty.call(state.tagMap, handle)) throwError(state, 'there is a previously declared suffix for "' + handle + '" tag handle');
      if (!PATTERN_TAG_URI.test(prefix)) throwError(state, "ill-formed tag prefix (second argument) of the TAG directive");
      try {
        prefix = decodeURIComponent(prefix);
      } catch (err) {
        throwError(state, "tag prefix is malformed: " + prefix);
      }
      state.tagMap[handle] = prefix;
    }
  };
  function captureSegment(state, start, end, checkJson) {
    if (start < end) {
      const _result = state.input.slice(start, end);
      if (checkJson) for (let _position = 0, _length = _result.length; _position < _length; _position += 1) {
        const _character = _result.charCodeAt(_position);
        if (!(_character === 9 || _character >= 32 && _character <= 1114111)) throwError(state, "expected valid JSON character");
      }
      else if (PATTERN_NON_PRINTABLE.test(_result)) throwError(state, "the stream contains non-printable characters");
      state.result += _result;
    }
  }
  function mergeMappings(state, destination, source, overridableKeys) {
    if (!common2.isObject(source)) throwError(state, "cannot merge mappings; the provided source object is unacceptable");
    const sourceKeys = Object.keys(source);
    for (let index2 = 0, quantity = sourceKeys.length; index2 < quantity; index2 += 1) {
      const key = sourceKeys[index2];
      if (!_hasOwnProperty.call(destination, key)) {
        setProperty(destination, key, source[key]);
        overridableKeys[key] = true;
      }
    }
  }
  function storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode, startLine, startLineStart, startPos) {
    if (Array.isArray(keyNode)) {
      keyNode = Array.prototype.slice.call(keyNode);
      for (let index2 = 0, quantity = keyNode.length; index2 < quantity; index2 += 1) {
        if (Array.isArray(keyNode[index2])) throwError(state, "nested arrays are not supported inside keys");
        if (typeof keyNode === "object" && _class(keyNode[index2]) === "[object Object]") keyNode[index2] = "[object Object]";
      }
    }
    if (typeof keyNode === "object" && _class(keyNode) === "[object Object]") keyNode = "[object Object]";
    keyNode = String(keyNode);
    if (_result === null) _result = {};
    if (keyTag === "tag:yaml.org,2002:merge") if (Array.isArray(valueNode)) {
      if (valueNode.length > state.maxMergeSeqLength) throwError(state, "merge sequence length exceeded maxMergeSeqLength (" + state.maxMergeSeqLength + ")");
      const seen = /* @__PURE__ */ new Set();
      for (let index2 = 0, quantity = valueNode.length; index2 < quantity; index2 += 1) {
        const src2 = valueNode[index2];
        if (seen.has(src2)) continue;
        seen.add(src2);
        mergeMappings(state, _result, src2, overridableKeys);
      }
    } else mergeMappings(state, _result, valueNode, overridableKeys);
    else {
      if (!state.json && !_hasOwnProperty.call(overridableKeys, keyNode) && _hasOwnProperty.call(_result, keyNode)) {
        state.line = startLine || state.line;
        state.lineStart = startLineStart || state.lineStart;
        state.position = startPos || state.position;
        throwError(state, "duplicated mapping key");
      }
      setProperty(_result, keyNode, valueNode);
      delete overridableKeys[keyNode];
    }
    return _result;
  }
  function readLineBreak(state) {
    const ch = state.input.charCodeAt(state.position);
    if (ch === 10) state.position++;
    else if (ch === 13) {
      state.position++;
      if (state.input.charCodeAt(state.position) === 10) state.position++;
    } else throwError(state, "a line break is expected");
    state.line += 1;
    state.lineStart = state.position;
    state.firstTabInLine = -1;
  }
  function skipSeparationSpace(state, allowComments, checkIndent) {
    let lineBreaks = 0;
    let ch = state.input.charCodeAt(state.position);
    while (ch !== 0) {
      while (isWhiteSpace(ch)) {
        if (ch === 9 && state.firstTabInLine === -1) state.firstTabInLine = state.position;
        ch = state.input.charCodeAt(++state.position);
      }
      if (allowComments && ch === 35) do
        ch = state.input.charCodeAt(++state.position);
      while (ch !== 10 && ch !== 13 && ch !== 0);
      if (isEol(ch)) {
        readLineBreak(state);
        ch = state.input.charCodeAt(state.position);
        lineBreaks++;
        state.lineIndent = 0;
        while (ch === 32) {
          state.lineIndent++;
          ch = state.input.charCodeAt(++state.position);
        }
      } else break;
    }
    if (checkIndent !== -1 && lineBreaks !== 0 && state.lineIndent < checkIndent) throwWarning(state, "deficient indentation");
    return lineBreaks;
  }
  function testDocumentSeparator(state) {
    let _position = state.position;
    let ch = state.input.charCodeAt(_position);
    if ((ch === 45 || ch === 46) && ch === state.input.charCodeAt(_position + 1) && ch === state.input.charCodeAt(_position + 2)) {
      _position += 3;
      ch = state.input.charCodeAt(_position);
      if (ch === 0 || isWsOrEol(ch)) return true;
    }
    return false;
  }
  function writeFoldedLines(state, count) {
    if (count === 1) state.result += " ";
    else if (count > 1) state.result += common2.repeat("\n", count - 1);
  }
  function readPlainScalar(state, nodeIndent, withinFlowCollection) {
    let captureStart;
    let captureEnd;
    let hasPendingContent;
    let _line;
    let _lineStart;
    let _lineIndent;
    const _kind = state.kind;
    const _result = state.result;
    let ch = state.input.charCodeAt(state.position);
    if (isWsOrEol(ch) || isFlowIndicator(ch) || ch === 35 || ch === 38 || ch === 42 || ch === 33 || ch === 124 || ch === 62 || ch === 39 || ch === 34 || ch === 37 || ch === 64 || ch === 96) return false;
    if (ch === 63 || ch === 45) {
      const following = state.input.charCodeAt(state.position + 1);
      if (isWsOrEol(following) || withinFlowCollection && isFlowIndicator(following)) return false;
    }
    state.kind = "scalar";
    state.result = "";
    captureStart = captureEnd = state.position;
    hasPendingContent = false;
    while (ch !== 0) {
      if (ch === 58) {
        const following = state.input.charCodeAt(state.position + 1);
        if (isWsOrEol(following) || withinFlowCollection && isFlowIndicator(following)) break;
      } else if (ch === 35) {
        if (isWsOrEol(state.input.charCodeAt(state.position - 1))) break;
      } else if (state.position === state.lineStart && testDocumentSeparator(state) || withinFlowCollection && isFlowIndicator(ch)) break;
      else if (isEol(ch)) {
        _line = state.line;
        _lineStart = state.lineStart;
        _lineIndent = state.lineIndent;
        skipSeparationSpace(state, false, -1);
        if (state.lineIndent >= nodeIndent) {
          hasPendingContent = true;
          ch = state.input.charCodeAt(state.position);
          continue;
        } else {
          state.position = captureEnd;
          state.line = _line;
          state.lineStart = _lineStart;
          state.lineIndent = _lineIndent;
          break;
        }
      }
      if (hasPendingContent) {
        captureSegment(state, captureStart, captureEnd, false);
        writeFoldedLines(state, state.line - _line);
        captureStart = captureEnd = state.position;
        hasPendingContent = false;
      }
      if (!isWhiteSpace(ch)) captureEnd = state.position + 1;
      ch = state.input.charCodeAt(++state.position);
    }
    captureSegment(state, captureStart, captureEnd, false);
    if (state.result) return true;
    state.kind = _kind;
    state.result = _result;
    return false;
  }
  function readSingleQuotedScalar(state, nodeIndent) {
    let captureStart;
    let captureEnd;
    let ch = state.input.charCodeAt(state.position);
    if (ch !== 39) return false;
    state.kind = "scalar";
    state.result = "";
    state.position++;
    captureStart = captureEnd = state.position;
    while ((ch = state.input.charCodeAt(state.position)) !== 0) if (ch === 39) {
      captureSegment(state, captureStart, state.position, true);
      ch = state.input.charCodeAt(++state.position);
      if (ch === 39) {
        captureStart = state.position;
        state.position++;
        captureEnd = state.position;
      } else return true;
    } else if (isEol(ch)) {
      captureSegment(state, captureStart, captureEnd, true);
      writeFoldedLines(state, skipSeparationSpace(state, false, nodeIndent));
      captureStart = captureEnd = state.position;
    } else if (state.position === state.lineStart && testDocumentSeparator(state)) throwError(state, "unexpected end of the document within a single quoted scalar");
    else {
      state.position++;
      if (!isWhiteSpace(ch)) captureEnd = state.position;
    }
    throwError(state, "unexpected end of the stream within a single quoted scalar");
  }
  function readDoubleQuotedScalar(state, nodeIndent) {
    let captureStart;
    let captureEnd;
    let tmp;
    let ch = state.input.charCodeAt(state.position);
    if (ch !== 34) return false;
    state.kind = "scalar";
    state.result = "";
    state.position++;
    captureStart = captureEnd = state.position;
    while ((ch = state.input.charCodeAt(state.position)) !== 0) if (ch === 34) {
      captureSegment(state, captureStart, state.position, true);
      state.position++;
      return true;
    } else if (ch === 92) {
      captureSegment(state, captureStart, state.position, true);
      ch = state.input.charCodeAt(++state.position);
      if (isEol(ch)) skipSeparationSpace(state, false, nodeIndent);
      else if (ch < 256 && simpleEscapeCheck[ch]) {
        state.result += simpleEscapeMap[ch];
        state.position++;
      } else if ((tmp = escapedHexLen(ch)) > 0) {
        let hexLength = tmp;
        let hexResult = 0;
        for (; hexLength > 0; hexLength--) {
          ch = state.input.charCodeAt(++state.position);
          if ((tmp = fromHexCode(ch)) >= 0) hexResult = (hexResult << 4) + tmp;
          else throwError(state, "expected hexadecimal character");
        }
        state.result += charFromCodepoint(hexResult);
        state.position++;
      } else throwError(state, "unknown escape sequence");
      captureStart = captureEnd = state.position;
    } else if (isEol(ch)) {
      captureSegment(state, captureStart, captureEnd, true);
      writeFoldedLines(state, skipSeparationSpace(state, false, nodeIndent));
      captureStart = captureEnd = state.position;
    } else if (state.position === state.lineStart && testDocumentSeparator(state)) throwError(state, "unexpected end of the document within a double quoted scalar");
    else {
      state.position++;
      if (!isWhiteSpace(ch)) captureEnd = state.position;
    }
    throwError(state, "unexpected end of the stream within a double quoted scalar");
  }
  function readFlowCollection(state, nodeIndent) {
    let readNext = true;
    let _line;
    let _lineStart;
    let _pos;
    const _tag = state.tag;
    let _result;
    const _anchor = state.anchor;
    let terminator;
    let isPair;
    let isExplicitPair;
    let isMapping;
    const overridableKeys = /* @__PURE__ */ Object.create(null);
    let keyNode;
    let keyTag;
    let valueNode;
    let ch = state.input.charCodeAt(state.position);
    if (ch === 91) {
      terminator = 93;
      isMapping = false;
      _result = [];
    } else if (ch === 123) {
      terminator = 125;
      isMapping = true;
      _result = {};
    } else return false;
    if (state.anchor !== null) storeAnchor(state, state.anchor, _result);
    ch = state.input.charCodeAt(++state.position);
    while (ch !== 0) {
      skipSeparationSpace(state, true, nodeIndent);
      ch = state.input.charCodeAt(state.position);
      if (ch === terminator) {
        state.position++;
        state.tag = _tag;
        state.anchor = _anchor;
        state.kind = isMapping ? "mapping" : "sequence";
        state.result = _result;
        return true;
      } else if (!readNext) throwError(state, "missed comma between flow collection entries");
      else if (ch === 44) throwError(state, "expected the node content, but found ','");
      keyTag = keyNode = valueNode = null;
      isPair = isExplicitPair = false;
      if (ch === 63) {
        if (isWsOrEol(state.input.charCodeAt(state.position + 1))) {
          isPair = isExplicitPair = true;
          state.position++;
          skipSeparationSpace(state, true, nodeIndent);
        }
      }
      _line = state.line;
      _lineStart = state.lineStart;
      _pos = state.position;
      composeNode(state, nodeIndent, CONTEXT_FLOW_IN, false, true);
      keyTag = state.tag;
      keyNode = state.result;
      skipSeparationSpace(state, true, nodeIndent);
      ch = state.input.charCodeAt(state.position);
      if ((isExplicitPair || state.line === _line) && ch === 58) {
        isPair = true;
        ch = state.input.charCodeAt(++state.position);
        skipSeparationSpace(state, true, nodeIndent);
        composeNode(state, nodeIndent, CONTEXT_FLOW_IN, false, true);
        valueNode = state.result;
      }
      if (isMapping) storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode, _line, _lineStart, _pos);
      else if (isPair) _result.push(storeMappingPair(state, null, overridableKeys, keyTag, keyNode, valueNode, _line, _lineStart, _pos));
      else _result.push(keyNode);
      skipSeparationSpace(state, true, nodeIndent);
      ch = state.input.charCodeAt(state.position);
      if (ch === 44) {
        readNext = true;
        ch = state.input.charCodeAt(++state.position);
      } else readNext = false;
    }
    throwError(state, "unexpected end of the stream within a flow collection");
  }
  function readBlockScalar(state, nodeIndent) {
    let folding;
    let chomping = CHOMPING_CLIP;
    let didReadContent = false;
    let detectedIndent = false;
    let textIndent = nodeIndent;
    let emptyLines = 0;
    let atMoreIndented = false;
    let tmp;
    let ch = state.input.charCodeAt(state.position);
    if (ch === 124) folding = false;
    else if (ch === 62) folding = true;
    else return false;
    state.kind = "scalar";
    state.result = "";
    while (ch !== 0) {
      ch = state.input.charCodeAt(++state.position);
      if (ch === 43 || ch === 45) if (CHOMPING_CLIP === chomping) chomping = ch === 43 ? CHOMPING_KEEP : CHOMPING_STRIP;
      else throwError(state, "repeat of a chomping mode identifier");
      else if ((tmp = fromDecimalCode(ch)) >= 0) if (tmp === 0) throwError(state, "bad explicit indentation width of a block scalar; it cannot be less than one");
      else if (!detectedIndent) {
        textIndent = nodeIndent + tmp - 1;
        detectedIndent = true;
      } else throwError(state, "repeat of an indentation width identifier");
      else break;
    }
    if (isWhiteSpace(ch)) {
      do
        ch = state.input.charCodeAt(++state.position);
      while (isWhiteSpace(ch));
      if (ch === 35) do
        ch = state.input.charCodeAt(++state.position);
      while (!isEol(ch) && ch !== 0);
    }
    while (ch !== 0) {
      readLineBreak(state);
      state.lineIndent = 0;
      ch = state.input.charCodeAt(state.position);
      while ((!detectedIndent || state.lineIndent < textIndent) && ch === 32) {
        state.lineIndent++;
        ch = state.input.charCodeAt(++state.position);
      }
      if (!detectedIndent && state.lineIndent > textIndent) textIndent = state.lineIndent;
      if (isEol(ch)) {
        emptyLines++;
        continue;
      }
      if (!detectedIndent && textIndent === 0) throwError(state, "missing indentation for block scalar");
      if (state.lineIndent < textIndent) {
        if (chomping === CHOMPING_KEEP) state.result += common2.repeat("\n", didReadContent ? 1 + emptyLines : emptyLines);
        else if (chomping === CHOMPING_CLIP) {
          if (didReadContent) state.result += "\n";
        }
        break;
      }
      if (folding) if (isWhiteSpace(ch)) {
        atMoreIndented = true;
        state.result += common2.repeat("\n", didReadContent ? 1 + emptyLines : emptyLines);
      } else if (atMoreIndented) {
        atMoreIndented = false;
        state.result += common2.repeat("\n", emptyLines + 1);
      } else if (emptyLines === 0) {
        if (didReadContent) state.result += " ";
      } else state.result += common2.repeat("\n", emptyLines);
      else state.result += common2.repeat("\n", didReadContent ? 1 + emptyLines : emptyLines);
      didReadContent = true;
      detectedIndent = true;
      emptyLines = 0;
      const captureStart = state.position;
      while (!isEol(ch) && ch !== 0) ch = state.input.charCodeAt(++state.position);
      captureSegment(state, captureStart, state.position, false);
    }
    return true;
  }
  function readBlockSequence(state, nodeIndent) {
    const _tag = state.tag;
    const _anchor = state.anchor;
    const _result = [];
    let detected = false;
    if (state.firstTabInLine !== -1) return false;
    if (state.anchor !== null) storeAnchor(state, state.anchor, _result);
    let ch = state.input.charCodeAt(state.position);
    while (ch !== 0) {
      if (state.firstTabInLine !== -1) {
        state.position = state.firstTabInLine;
        throwError(state, "tab characters must not be used in indentation");
      }
      if (ch !== 45) break;
      if (!isWsOrEol(state.input.charCodeAt(state.position + 1))) break;
      detected = true;
      state.position++;
      if (skipSeparationSpace(state, true, -1)) {
        if (state.lineIndent <= nodeIndent) {
          _result.push(null);
          ch = state.input.charCodeAt(state.position);
          continue;
        }
      }
      const _line = state.line;
      composeNode(state, nodeIndent, CONTEXT_BLOCK_IN, false, true);
      _result.push(state.result);
      skipSeparationSpace(state, true, -1);
      ch = state.input.charCodeAt(state.position);
      if ((state.line === _line || state.lineIndent > nodeIndent) && ch !== 0) throwError(state, "bad indentation of a sequence entry");
      else if (state.lineIndent < nodeIndent) break;
    }
    if (detected) {
      state.tag = _tag;
      state.anchor = _anchor;
      state.kind = "sequence";
      state.result = _result;
      return true;
    }
    return false;
  }
  function readBlockMapping(state, nodeIndent, flowIndent) {
    let allowCompact;
    let _keyLine;
    let _keyLineStart;
    let _keyPos;
    const _tag = state.tag;
    const _anchor = state.anchor;
    const _result = {};
    const overridableKeys = /* @__PURE__ */ Object.create(null);
    let keyTag = null;
    let keyNode = null;
    let valueNode = null;
    let atExplicitKey = false;
    let detected = false;
    if (state.firstTabInLine !== -1) return false;
    if (state.anchor !== null) storeAnchor(state, state.anchor, _result);
    let ch = state.input.charCodeAt(state.position);
    while (ch !== 0) {
      if (!atExplicitKey && state.firstTabInLine !== -1) {
        state.position = state.firstTabInLine;
        throwError(state, "tab characters must not be used in indentation");
      }
      const following = state.input.charCodeAt(state.position + 1);
      const _line = state.line;
      if ((ch === 63 || ch === 58) && isWsOrEol(following)) {
        if (ch === 63) {
          if (atExplicitKey) {
            storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null, _keyLine, _keyLineStart, _keyPos);
            keyTag = keyNode = valueNode = null;
          }
          detected = true;
          atExplicitKey = true;
          allowCompact = true;
        } else if (atExplicitKey) {
          atExplicitKey = false;
          allowCompact = true;
        } else throwError(state, "incomplete explicit mapping pair; a key node is missed; or followed by a non-tabulated empty line");
        state.position += 1;
        ch = following;
      } else {
        _keyLine = state.line;
        _keyLineStart = state.lineStart;
        _keyPos = state.position;
        if (!composeNode(state, flowIndent, CONTEXT_FLOW_OUT, false, true)) break;
        if (state.line === _line) {
          ch = state.input.charCodeAt(state.position);
          while (isWhiteSpace(ch)) ch = state.input.charCodeAt(++state.position);
          if (ch === 58) {
            ch = state.input.charCodeAt(++state.position);
            if (!isWsOrEol(ch)) throwError(state, "a whitespace character is expected after the key-value separator within a block mapping");
            if (atExplicitKey) {
              storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null, _keyLine, _keyLineStart, _keyPos);
              keyTag = keyNode = valueNode = null;
            }
            detected = true;
            atExplicitKey = false;
            allowCompact = false;
            keyTag = state.tag;
            keyNode = state.result;
          } else if (detected) throwError(state, "can not read an implicit mapping pair; a colon is missed");
          else {
            state.tag = _tag;
            state.anchor = _anchor;
            return true;
          }
        } else if (detected) throwError(state, "can not read a block mapping entry; a multiline key may not be an implicit key");
        else {
          state.tag = _tag;
          state.anchor = _anchor;
          return true;
        }
      }
      if (state.line === _line || state.lineIndent > nodeIndent) {
        if (atExplicitKey) {
          _keyLine = state.line;
          _keyLineStart = state.lineStart;
          _keyPos = state.position;
        }
        if (composeNode(state, nodeIndent, CONTEXT_BLOCK_OUT, true, allowCompact)) if (atExplicitKey) keyNode = state.result;
        else valueNode = state.result;
        if (!atExplicitKey) {
          storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode, _keyLine, _keyLineStart, _keyPos);
          keyTag = keyNode = valueNode = null;
        }
        skipSeparationSpace(state, true, -1);
        ch = state.input.charCodeAt(state.position);
      }
      if ((state.line === _line || state.lineIndent > nodeIndent) && ch !== 0) throwError(state, "bad indentation of a mapping entry");
      else if (state.lineIndent < nodeIndent) break;
    }
    if (atExplicitKey) storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null, _keyLine, _keyLineStart, _keyPos);
    if (detected) {
      state.tag = _tag;
      state.anchor = _anchor;
      state.kind = "mapping";
      state.result = _result;
    }
    return detected;
  }
  function readTagProperty(state) {
    let isVerbatim = false;
    let isNamed = false;
    let tagHandle;
    let tagName;
    let ch = state.input.charCodeAt(state.position);
    if (ch !== 33) return false;
    if (state.tag !== null) throwError(state, "duplication of a tag property");
    ch = state.input.charCodeAt(++state.position);
    if (ch === 60) {
      isVerbatim = true;
      ch = state.input.charCodeAt(++state.position);
    } else if (ch === 33) {
      isNamed = true;
      tagHandle = "!!";
      ch = state.input.charCodeAt(++state.position);
    } else tagHandle = "!";
    let _position = state.position;
    if (isVerbatim) {
      do
        ch = state.input.charCodeAt(++state.position);
      while (ch !== 0 && ch !== 62);
      if (state.position < state.length) {
        tagName = state.input.slice(_position, state.position);
        ch = state.input.charCodeAt(++state.position);
      } else throwError(state, "unexpected end of the stream within a verbatim tag");
    } else {
      while (ch !== 0 && !isWsOrEol(ch)) {
        if (ch === 33) if (!isNamed) {
          tagHandle = state.input.slice(_position - 1, state.position + 1);
          if (!PATTERN_TAG_HANDLE.test(tagHandle)) throwError(state, "named tag handle cannot contain such characters");
          isNamed = true;
          _position = state.position + 1;
        } else throwError(state, "tag suffix cannot contain exclamation marks");
        ch = state.input.charCodeAt(++state.position);
      }
      tagName = state.input.slice(_position, state.position);
      if (PATTERN_FLOW_INDICATORS.test(tagName)) throwError(state, "tag suffix cannot contain flow indicator characters");
    }
    if (tagName && !PATTERN_TAG_URI.test(tagName)) throwError(state, "tag name cannot contain such characters: " + tagName);
    try {
      tagName = decodeURIComponent(tagName);
    } catch (err) {
      throwError(state, "tag name is malformed: " + tagName);
    }
    if (isVerbatim) state.tag = tagName;
    else if (_hasOwnProperty.call(state.tagMap, tagHandle)) state.tag = state.tagMap[tagHandle] + tagName;
    else if (tagHandle === "!") state.tag = "!" + tagName;
    else if (tagHandle === "!!") state.tag = "tag:yaml.org,2002:" + tagName;
    else throwError(state, 'undeclared tag handle "' + tagHandle + '"');
    return true;
  }
  function readAnchorProperty(state) {
    let ch = state.input.charCodeAt(state.position);
    if (ch !== 38) return false;
    if (state.anchor !== null) throwError(state, "duplication of an anchor property");
    ch = state.input.charCodeAt(++state.position);
    const _position = state.position;
    while (ch !== 0 && !isWsOrEol(ch) && !isFlowIndicator(ch)) ch = state.input.charCodeAt(++state.position);
    if (state.position === _position) throwError(state, "name of an anchor node must contain at least one character");
    state.anchor = state.input.slice(_position, state.position);
    return true;
  }
  function readAlias(state) {
    let ch = state.input.charCodeAt(state.position);
    if (ch !== 42) return false;
    ch = state.input.charCodeAt(++state.position);
    const _position = state.position;
    while (ch !== 0 && !isWsOrEol(ch) && !isFlowIndicator(ch)) ch = state.input.charCodeAt(++state.position);
    if (state.position === _position) throwError(state, "name of an alias node must contain at least one character");
    const alias = state.input.slice(_position, state.position);
    if (!_hasOwnProperty.call(state.anchorMap, alias)) throwError(state, 'unidentified alias "' + alias + '"');
    state.result = state.anchorMap[alias];
    skipSeparationSpace(state, true, -1);
    return true;
  }
  function tryReadBlockMappingFromProperty(state, propertyStart, nodeIndent, flowIndent) {
    const fallbackState = snapshotState(state);
    beginAnchorTransaction(state);
    restoreState(state, propertyStart);
    state.tag = null;
    state.anchor = null;
    state.kind = null;
    state.result = null;
    if (readBlockMapping(state, nodeIndent, flowIndent) && state.kind === "mapping") {
      commitAnchorTransaction(state);
      return true;
    }
    rollbackAnchorTransaction(state);
    restoreState(state, fallbackState);
    return false;
  }
  function composeNode(state, parentIndent, nodeContext, allowToSeek, allowCompact) {
    let allowBlockScalars;
    let allowBlockCollections;
    let indentStatus = 1;
    let atNewLine = false;
    let hasContent = false;
    let propertyStart = null;
    let type;
    let flowIndent;
    let blockIndent;
    if (state.depth >= state.maxDepth) throwError(state, "nesting exceeded maxDepth (" + state.maxDepth + ")");
    state.depth += 1;
    if (state.listener !== null) state.listener("open", state);
    state.tag = null;
    state.anchor = null;
    state.kind = null;
    state.result = null;
    const allowBlockStyles = allowBlockScalars = allowBlockCollections = CONTEXT_BLOCK_OUT === nodeContext || CONTEXT_BLOCK_IN === nodeContext;
    if (allowToSeek) {
      if (skipSeparationSpace(state, true, -1)) {
        atNewLine = true;
        if (state.lineIndent > parentIndent) indentStatus = 1;
        else if (state.lineIndent === parentIndent) indentStatus = 0;
        else if (state.lineIndent < parentIndent) indentStatus = -1;
      }
    }
    if (indentStatus === 1) while (true) {
      const ch = state.input.charCodeAt(state.position);
      const propertyState = snapshotState(state);
      if (atNewLine && (ch === 33 && state.tag !== null || ch === 38 && state.anchor !== null)) break;
      if (!readTagProperty(state) && !readAnchorProperty(state)) break;
      if (propertyStart === null) propertyStart = propertyState;
      if (skipSeparationSpace(state, true, -1)) {
        atNewLine = true;
        allowBlockCollections = allowBlockStyles;
        if (state.lineIndent > parentIndent) indentStatus = 1;
        else if (state.lineIndent === parentIndent) indentStatus = 0;
        else if (state.lineIndent < parentIndent) indentStatus = -1;
      } else allowBlockCollections = false;
    }
    if (allowBlockCollections) allowBlockCollections = atNewLine || allowCompact;
    if (indentStatus === 1 || CONTEXT_BLOCK_OUT === nodeContext) {
      if (CONTEXT_FLOW_IN === nodeContext || CONTEXT_FLOW_OUT === nodeContext) flowIndent = parentIndent;
      else flowIndent = parentIndent + 1;
      blockIndent = state.position - state.lineStart;
      if (indentStatus === 1) if (allowBlockCollections && (readBlockSequence(state, blockIndent) || readBlockMapping(state, blockIndent, flowIndent)) || readFlowCollection(state, flowIndent)) hasContent = true;
      else {
        const ch = state.input.charCodeAt(state.position);
        if (propertyStart !== null && allowBlockStyles && !allowBlockCollections && ch !== 124 && ch !== 62 && tryReadBlockMappingFromProperty(state, propertyStart, propertyStart.position - propertyStart.lineStart, flowIndent)) hasContent = true;
        else if (allowBlockScalars && readBlockScalar(state, flowIndent) || readSingleQuotedScalar(state, flowIndent) || readDoubleQuotedScalar(state, flowIndent)) hasContent = true;
        else if (readAlias(state)) {
          hasContent = true;
          if (state.tag !== null || state.anchor !== null) throwError(state, "alias node should not have any properties");
        } else if (readPlainScalar(state, flowIndent, CONTEXT_FLOW_IN === nodeContext)) {
          hasContent = true;
          if (state.tag === null) state.tag = "?";
        }
        if (state.anchor !== null) storeAnchor(state, state.anchor, state.result);
      }
      else if (indentStatus === 0) hasContent = allowBlockCollections && readBlockSequence(state, blockIndent);
    }
    if (state.tag === null) {
      if (state.anchor !== null) storeAnchor(state, state.anchor, state.result);
    } else if (state.tag === "?") {
      if (state.result !== null && state.kind !== "scalar") throwError(state, 'unacceptable node kind for !<?> tag; it should be "scalar", not "' + state.kind + '"');
      for (let typeIndex = 0, typeQuantity = state.implicitTypes.length; typeIndex < typeQuantity; typeIndex += 1) {
        type = state.implicitTypes[typeIndex];
        if (type.resolve(state.result)) {
          state.result = type.construct(state.result);
          state.tag = type.tag;
          if (state.anchor !== null) storeAnchor(state, state.anchor, state.result);
          break;
        }
      }
    } else if (state.tag !== "!") {
      if (_hasOwnProperty.call(state.typeMap[state.kind || "fallback"], state.tag)) type = state.typeMap[state.kind || "fallback"][state.tag];
      else {
        type = null;
        const typeList = state.typeMap.multi[state.kind || "fallback"];
        for (let typeIndex = 0, typeQuantity = typeList.length; typeIndex < typeQuantity; typeIndex += 1) if (state.tag.slice(0, typeList[typeIndex].tag.length) === typeList[typeIndex].tag) {
          type = typeList[typeIndex];
          break;
        }
      }
      if (!type) throwError(state, "unknown tag !<" + state.tag + ">");
      if (state.result !== null && type.kind !== state.kind) throwError(state, "unacceptable node kind for !<" + state.tag + '> tag; it should be "' + type.kind + '", not "' + state.kind + '"');
      if (!type.resolve(state.result, state.tag)) throwError(state, "cannot resolve a node with !<" + state.tag + "> explicit tag");
      else {
        state.result = type.construct(state.result, state.tag);
        if (state.anchor !== null) storeAnchor(state, state.anchor, state.result);
      }
    }
    if (state.listener !== null) state.listener("close", state);
    state.depth -= 1;
    return state.tag !== null || state.anchor !== null || hasContent;
  }
  function readDocument(state) {
    const documentStart = state.position;
    let hasDirectives = false;
    let ch;
    state.version = null;
    state.checkLineBreaks = state.legacy;
    state.tagMap = /* @__PURE__ */ Object.create(null);
    state.anchorMap = /* @__PURE__ */ Object.create(null);
    while ((ch = state.input.charCodeAt(state.position)) !== 0) {
      skipSeparationSpace(state, true, -1);
      ch = state.input.charCodeAt(state.position);
      if (state.lineIndent > 0 || ch !== 37) break;
      hasDirectives = true;
      ch = state.input.charCodeAt(++state.position);
      let _position = state.position;
      while (ch !== 0 && !isWsOrEol(ch)) ch = state.input.charCodeAt(++state.position);
      const directiveName = state.input.slice(_position, state.position);
      const directiveArgs = [];
      if (directiveName.length < 1) throwError(state, "directive name must not be less than one character in length");
      while (ch !== 0) {
        while (isWhiteSpace(ch)) ch = state.input.charCodeAt(++state.position);
        if (ch === 35) {
          do
            ch = state.input.charCodeAt(++state.position);
          while (ch !== 0 && !isEol(ch));
          break;
        }
        if (isEol(ch)) break;
        _position = state.position;
        while (ch !== 0 && !isWsOrEol(ch)) ch = state.input.charCodeAt(++state.position);
        directiveArgs.push(state.input.slice(_position, state.position));
      }
      if (ch !== 0) readLineBreak(state);
      if (_hasOwnProperty.call(directiveHandlers, directiveName)) directiveHandlers[directiveName](state, directiveName, directiveArgs);
      else throwWarning(state, 'unknown document directive "' + directiveName + '"');
    }
    skipSeparationSpace(state, true, -1);
    if (state.lineIndent === 0 && state.input.charCodeAt(state.position) === 45 && state.input.charCodeAt(state.position + 1) === 45 && state.input.charCodeAt(state.position + 2) === 45) {
      state.position += 3;
      skipSeparationSpace(state, true, -1);
    } else if (hasDirectives) throwError(state, "directives end mark is expected");
    composeNode(state, state.lineIndent - 1, CONTEXT_BLOCK_OUT, false, true);
    skipSeparationSpace(state, true, -1);
    if (state.checkLineBreaks && PATTERN_NON_ASCII_LINE_BREAKS.test(state.input.slice(documentStart, state.position))) throwWarning(state, "non-ASCII line breaks are interpreted as content");
    state.documents.push(state.result);
    if (state.position === state.lineStart && testDocumentSeparator(state)) {
      if (state.input.charCodeAt(state.position) === 46) {
        state.position += 3;
        skipSeparationSpace(state, true, -1);
      }
      return;
    }
    if (state.position < state.length - 1) throwError(state, "end of the stream or a document separator is expected");
  }
  function loadDocuments(input, options) {
    input = String(input);
    options = options || {};
    if (input.length !== 0) {
      if (input.charCodeAt(input.length - 1) !== 10 && input.charCodeAt(input.length - 1) !== 13) input += "\n";
      if (input.charCodeAt(0) === 65279) input = input.slice(1);
    }
    const state = new State(input, options);
    const nullpos = input.indexOf("\0");
    if (nullpos !== -1) {
      state.position = nullpos;
      throwError(state, "null byte is not allowed in input");
    }
    state.input += "\0";
    while (state.input.charCodeAt(state.position) === 32) {
      state.lineIndent += 1;
      state.position += 1;
    }
    while (state.position < state.length - 1) readDocument(state);
    return state.documents;
  }
  function loadAll2(input, iterator, options) {
    if (iterator !== null && typeof iterator === "object" && typeof options === "undefined") {
      options = iterator;
      iterator = null;
    }
    const documents = loadDocuments(input, options);
    if (typeof iterator !== "function") return documents;
    for (let index2 = 0, length = documents.length; index2 < length; index2 += 1) iterator(documents[index2]);
  }
  function load2(input, options) {
    const documents = loadDocuments(input, options);
    if (documents.length === 0) return;
    else if (documents.length === 1) return documents[0];
    throw new YAMLException2("expected a single document in the stream, but found more");
  }
  module2.exports.loadAll = loadAll2;
  module2.exports.load = load2;
}));
var require_dumper = /* @__PURE__ */ __commonJSMin(((exports2, module2) => {
  var common2 = require_common();
  var YAMLException2 = require_exception();
  var DEFAULT_SCHEMA2 = require_default();
  var _toString = Object.prototype.toString;
  var _hasOwnProperty = Object.prototype.hasOwnProperty;
  var CHAR_BOM = 65279;
  var CHAR_TAB = 9;
  var CHAR_LINE_FEED = 10;
  var CHAR_CARRIAGE_RETURN = 13;
  var CHAR_SPACE = 32;
  var CHAR_EXCLAMATION = 33;
  var CHAR_DOUBLE_QUOTE = 34;
  var CHAR_SHARP = 35;
  var CHAR_PERCENT = 37;
  var CHAR_AMPERSAND = 38;
  var CHAR_SINGLE_QUOTE = 39;
  var CHAR_ASTERISK = 42;
  var CHAR_COMMA = 44;
  var CHAR_MINUS = 45;
  var CHAR_COLON = 58;
  var CHAR_EQUALS = 61;
  var CHAR_GREATER_THAN = 62;
  var CHAR_QUESTION = 63;
  var CHAR_COMMERCIAL_AT = 64;
  var CHAR_LEFT_SQUARE_BRACKET = 91;
  var CHAR_RIGHT_SQUARE_BRACKET = 93;
  var CHAR_GRAVE_ACCENT = 96;
  var CHAR_LEFT_CURLY_BRACKET = 123;
  var CHAR_VERTICAL_LINE = 124;
  var CHAR_RIGHT_CURLY_BRACKET = 125;
  var ESCAPE_SEQUENCES = {};
  ESCAPE_SEQUENCES[0] = "\\0";
  ESCAPE_SEQUENCES[7] = "\\a";
  ESCAPE_SEQUENCES[8] = "\\b";
  ESCAPE_SEQUENCES[9] = "\\t";
  ESCAPE_SEQUENCES[10] = "\\n";
  ESCAPE_SEQUENCES[11] = "\\v";
  ESCAPE_SEQUENCES[12] = "\\f";
  ESCAPE_SEQUENCES[13] = "\\r";
  ESCAPE_SEQUENCES[27] = "\\e";
  ESCAPE_SEQUENCES[34] = '\\"';
  ESCAPE_SEQUENCES[92] = "\\\\";
  ESCAPE_SEQUENCES[133] = "\\N";
  ESCAPE_SEQUENCES[160] = "\\_";
  ESCAPE_SEQUENCES[8232] = "\\L";
  ESCAPE_SEQUENCES[8233] = "\\P";
  var DEPRECATED_BOOLEANS_SYNTAX = [
    "y",
    "Y",
    "yes",
    "Yes",
    "YES",
    "on",
    "On",
    "ON",
    "n",
    "N",
    "no",
    "No",
    "NO",
    "off",
    "Off",
    "OFF"
  ];
  var DEPRECATED_BASE60_SYNTAX = /^[-+]?[0-9_]+(?::[0-9_]+)+(?:\.[0-9_]*)?$/;
  function compileStyleMap(schema, map) {
    if (map === null) return {};
    const result = {};
    const keys = Object.keys(map);
    for (let index2 = 0, length = keys.length; index2 < length; index2 += 1) {
      let tag = keys[index2];
      let style = String(map[tag]);
      if (tag.slice(0, 2) === "!!") tag = "tag:yaml.org,2002:" + tag.slice(2);
      const type = schema.compiledTypeMap["fallback"][tag];
      if (type && _hasOwnProperty.call(type.styleAliases, style)) style = type.styleAliases[style];
      result[tag] = style;
    }
    return result;
  }
  function encodeHex(character) {
    let handle;
    let length;
    const string = character.toString(16).toUpperCase();
    if (character <= 255) {
      handle = "x";
      length = 2;
    } else if (character <= 65535) {
      handle = "u";
      length = 4;
    } else if (character <= 4294967295) {
      handle = "U";
      length = 8;
    } else throw new YAMLException2("code point within a string may not be greater than 0xFFFFFFFF");
    return "\\" + handle + common2.repeat("0", length - string.length) + string;
  }
  var QUOTING_TYPE_SINGLE = 1;
  var QUOTING_TYPE_DOUBLE = 2;
  function State(options) {
    this.schema = options["schema"] || DEFAULT_SCHEMA2;
    this.indent = Math.max(1, options["indent"] || 2);
    this.noArrayIndent = options["noArrayIndent"] || false;
    this.skipInvalid = options["skipInvalid"] || false;
    this.flowLevel = common2.isNothing(options["flowLevel"]) ? -1 : options["flowLevel"];
    this.styleMap = compileStyleMap(this.schema, options["styles"] || null);
    this.sortKeys = options["sortKeys"] || false;
    this.lineWidth = options["lineWidth"] || 80;
    this.noRefs = options["noRefs"] || false;
    this.noCompatMode = options["noCompatMode"] || false;
    this.condenseFlow = options["condenseFlow"] || false;
    this.quotingType = options["quotingType"] === '"' ? QUOTING_TYPE_DOUBLE : QUOTING_TYPE_SINGLE;
    this.forceQuotes = options["forceQuotes"] || false;
    this.replacer = typeof options["replacer"] === "function" ? options["replacer"] : null;
    this.implicitTypes = this.schema.compiledImplicit;
    this.explicitTypes = this.schema.compiledExplicit;
    this.tag = null;
    this.result = "";
    this.duplicates = [];
    this.usedDuplicates = null;
  }
  function indentString(string, spaces) {
    const ind = common2.repeat(" ", spaces);
    let position = 0;
    let result = "";
    const length = string.length;
    while (position < length) {
      let line;
      const next = string.indexOf("\n", position);
      if (next === -1) {
        line = string.slice(position);
        position = length;
      } else {
        line = string.slice(position, next + 1);
        position = next + 1;
      }
      if (line.length && line !== "\n") result += ind;
      result += line;
    }
    return result;
  }
  function generateNextLine(state, level) {
    return "\n" + common2.repeat(" ", state.indent * level);
  }
  function testImplicitResolving(state, str) {
    for (let index2 = 0, length = state.implicitTypes.length; index2 < length; index2 += 1) if (state.implicitTypes[index2].resolve(str)) return true;
    return false;
  }
  function isWhitespace(c) {
    return c === CHAR_SPACE || c === CHAR_TAB;
  }
  function isPrintable(c) {
    return c >= 32 && c <= 126 || c >= 161 && c <= 55295 && c !== 8232 && c !== 8233 || c >= 57344 && c <= 65533 && c !== CHAR_BOM || c >= 65536 && c <= 1114111;
  }
  function isNsCharOrWhitespace(c) {
    return isPrintable(c) && c !== CHAR_BOM && c !== CHAR_CARRIAGE_RETURN && c !== CHAR_LINE_FEED;
  }
  function isPlainSafe(c, prev, inblock) {
    const cIsNsCharOrWhitespace = isNsCharOrWhitespace(c);
    const cIsNsChar = cIsNsCharOrWhitespace && !isWhitespace(c);
    return (inblock ? cIsNsCharOrWhitespace : cIsNsCharOrWhitespace && c !== CHAR_COMMA && c !== CHAR_LEFT_SQUARE_BRACKET && c !== CHAR_RIGHT_SQUARE_BRACKET && c !== CHAR_LEFT_CURLY_BRACKET && c !== CHAR_RIGHT_CURLY_BRACKET) && c !== CHAR_SHARP && !(prev === CHAR_COLON && !cIsNsChar) || isNsCharOrWhitespace(prev) && !isWhitespace(prev) && c === CHAR_SHARP || prev === CHAR_COLON && cIsNsChar;
  }
  function isPlainSafeFirst(c) {
    return isPrintable(c) && c !== CHAR_BOM && !isWhitespace(c) && c !== CHAR_MINUS && c !== CHAR_QUESTION && c !== CHAR_COLON && c !== CHAR_COMMA && c !== CHAR_LEFT_SQUARE_BRACKET && c !== CHAR_RIGHT_SQUARE_BRACKET && c !== CHAR_LEFT_CURLY_BRACKET && c !== CHAR_RIGHT_CURLY_BRACKET && c !== CHAR_SHARP && c !== CHAR_AMPERSAND && c !== CHAR_ASTERISK && c !== CHAR_EXCLAMATION && c !== CHAR_VERTICAL_LINE && c !== CHAR_EQUALS && c !== CHAR_GREATER_THAN && c !== CHAR_SINGLE_QUOTE && c !== CHAR_DOUBLE_QUOTE && c !== CHAR_PERCENT && c !== CHAR_COMMERCIAL_AT && c !== CHAR_GRAVE_ACCENT;
  }
  function isPlainSafeLast(c) {
    return !isWhitespace(c) && c !== CHAR_COLON;
  }
  function codePointAt(string, pos) {
    const first = string.charCodeAt(pos);
    let second;
    if (first >= 55296 && first <= 56319 && pos + 1 < string.length) {
      second = string.charCodeAt(pos + 1);
      if (second >= 56320 && second <= 57343) return (first - 55296) * 1024 + second - 56320 + 65536;
    }
    return first;
  }
  function needIndentIndicator(string) {
    return /^\n* /.test(string);
  }
  var STYLE_PLAIN = 1;
  var STYLE_SINGLE = 2;
  var STYLE_LITERAL = 3;
  var STYLE_FOLDED = 4;
  var STYLE_DOUBLE = 5;
  function chooseScalarStyle(string, singleLineOnly, indentPerLevel, lineWidth, testAmbiguousType, quotingType, forceQuotes, inblock) {
    let i;
    let char = 0;
    let prevChar = null;
    let hasLineBreak = false;
    let hasFoldableLine = false;
    const shouldTrackWidth = lineWidth !== -1;
    let previousLineBreak = -1;
    let plain = isPlainSafeFirst(codePointAt(string, 0)) && isPlainSafeLast(codePointAt(string, string.length - 1));
    if (singleLineOnly || forceQuotes) for (i = 0; i < string.length; char >= 65536 ? i += 2 : i++) {
      char = codePointAt(string, i);
      if (!isPrintable(char)) return STYLE_DOUBLE;
      plain = plain && isPlainSafe(char, prevChar, inblock);
      prevChar = char;
    }
    else {
      for (i = 0; i < string.length; char >= 65536 ? i += 2 : i++) {
        char = codePointAt(string, i);
        if (char === CHAR_LINE_FEED) {
          hasLineBreak = true;
          if (shouldTrackWidth) {
            hasFoldableLine = hasFoldableLine || i - previousLineBreak - 1 > lineWidth && string[previousLineBreak + 1] !== " ";
            previousLineBreak = i;
          }
        } else if (!isPrintable(char)) return STYLE_DOUBLE;
        plain = plain && isPlainSafe(char, prevChar, inblock);
        prevChar = char;
      }
      hasFoldableLine = hasFoldableLine || shouldTrackWidth && i - previousLineBreak - 1 > lineWidth && string[previousLineBreak + 1] !== " ";
    }
    if (!hasLineBreak && !hasFoldableLine) {
      if (plain && !forceQuotes && !testAmbiguousType(string)) return STYLE_PLAIN;
      return quotingType === QUOTING_TYPE_DOUBLE ? STYLE_DOUBLE : STYLE_SINGLE;
    }
    if (indentPerLevel > 9 && needIndentIndicator(string)) return STYLE_DOUBLE;
    if (!forceQuotes) return hasFoldableLine ? STYLE_FOLDED : STYLE_LITERAL;
    return quotingType === QUOTING_TYPE_DOUBLE ? STYLE_DOUBLE : STYLE_SINGLE;
  }
  function writeScalar(state, string, level, iskey, inblock) {
    state.dump = (function() {
      if (string.length === 0) return state.quotingType === QUOTING_TYPE_DOUBLE ? '""' : "''";
      if (!state.noCompatMode) {
        if (DEPRECATED_BOOLEANS_SYNTAX.indexOf(string) !== -1 || DEPRECATED_BASE60_SYNTAX.test(string)) return state.quotingType === QUOTING_TYPE_DOUBLE ? '"' + string + '"' : "'" + string + "'";
      }
      const indent = state.indent * Math.max(1, level);
      const lineWidth = state.lineWidth === -1 ? -1 : Math.max(Math.min(state.lineWidth, 40), state.lineWidth - indent);
      const singleLineOnly = iskey || state.flowLevel > -1 && level >= state.flowLevel;
      function testAmbiguity(string2) {
        return testImplicitResolving(state, string2);
      }
      switch (chooseScalarStyle(string, singleLineOnly, state.indent, lineWidth, testAmbiguity, state.quotingType, state.forceQuotes && !iskey, inblock)) {
        case STYLE_PLAIN:
          return string;
        case STYLE_SINGLE:
          return "'" + string.replace(/'/g, "''") + "'";
        case STYLE_LITERAL:
          return "|" + blockHeader(string, state.indent) + dropEndingNewline(indentString(string, indent));
        case STYLE_FOLDED:
          return ">" + blockHeader(string, state.indent) + dropEndingNewline(indentString(foldString(string, lineWidth), indent));
        case STYLE_DOUBLE:
          return '"' + escapeString(string) + '"';
        default:
          throw new YAMLException2("impossible error: invalid scalar style");
      }
    })();
  }
  function blockHeader(string, indentPerLevel) {
    const indentIndicator = needIndentIndicator(string) ? String(indentPerLevel) : "";
    const clip = string[string.length - 1] === "\n";
    return indentIndicator + (clip && (string[string.length - 2] === "\n" || string === "\n") ? "+" : clip ? "" : "-") + "\n";
  }
  function dropEndingNewline(string) {
    return string[string.length - 1] === "\n" ? string.slice(0, -1) : string;
  }
  function foldString(string, width) {
    const lineRe = /(\n+)([^\n]*)/g;
    let result = (function() {
      let nextLF = string.indexOf("\n");
      nextLF = nextLF !== -1 ? nextLF : string.length;
      lineRe.lastIndex = nextLF;
      return foldLine(string.slice(0, nextLF), width);
    })();
    let prevMoreIndented = string[0] === "\n" || string[0] === " ";
    let moreIndented;
    let match;
    while (match = lineRe.exec(string)) {
      const prefix = match[1];
      const line = match[2];
      moreIndented = line[0] === " ";
      result += prefix + (!prevMoreIndented && !moreIndented && line !== "" ? "\n" : "") + foldLine(line, width);
      prevMoreIndented = moreIndented;
    }
    return result;
  }
  function foldLine(line, width) {
    if (line === "" || line[0] === " ") return line;
    const breakRe = / [^ ]/g;
    let match;
    let start = 0;
    let end;
    let curr = 0;
    let next = 0;
    let result = "";
    while (match = breakRe.exec(line)) {
      next = match.index;
      if (next - start > width) {
        end = curr > start ? curr : next;
        result += "\n" + line.slice(start, end);
        start = end + 1;
      }
      curr = next;
    }
    result += "\n";
    if (line.length - start > width && curr > start) result += line.slice(start, curr) + "\n" + line.slice(curr + 1);
    else result += line.slice(start);
    return result.slice(1);
  }
  function escapeString(string) {
    let result = "";
    let char = 0;
    for (let i = 0; i < string.length; char >= 65536 ? i += 2 : i++) {
      char = codePointAt(string, i);
      const escapeSeq = ESCAPE_SEQUENCES[char];
      if (!escapeSeq && isPrintable(char)) {
        result += string[i];
        if (char >= 65536) result += string[i + 1];
      } else result += escapeSeq || encodeHex(char);
    }
    return result;
  }
  function writeFlowSequence(state, level, object) {
    let _result = "";
    const _tag = state.tag;
    for (let index2 = 0, length = object.length; index2 < length; index2 += 1) {
      let value = object[index2];
      if (state.replacer) value = state.replacer.call(object, String(index2), value);
      if (writeNode(state, level, value, false, false) || typeof value === "undefined" && writeNode(state, level, null, false, false)) {
        if (_result !== "") _result += "," + (!state.condenseFlow ? " " : "");
        _result += state.dump;
      }
    }
    state.tag = _tag;
    state.dump = "[" + _result + "]";
  }
  function writeBlockSequence(state, level, object, compact) {
    let _result = "";
    const _tag = state.tag;
    for (let index2 = 0, length = object.length; index2 < length; index2 += 1) {
      let value = object[index2];
      if (state.replacer) value = state.replacer.call(object, String(index2), value);
      if (writeNode(state, level + 1, value, true, true, false, true) || typeof value === "undefined" && writeNode(state, level + 1, null, true, true, false, true)) {
        if (!compact || _result !== "") _result += generateNextLine(state, level);
        if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) _result += "-";
        else _result += "- ";
        _result += state.dump;
      }
    }
    state.tag = _tag;
    state.dump = _result || "[]";
  }
  function writeFlowMapping(state, level, object) {
    let _result = "";
    const _tag = state.tag;
    const objectKeyList = Object.keys(object);
    for (let index2 = 0, length = objectKeyList.length; index2 < length; index2 += 1) {
      let pairBuffer = "";
      if (_result !== "") pairBuffer += ", ";
      if (state.condenseFlow) pairBuffer += '"';
      const objectKey = objectKeyList[index2];
      let objectValue = object[objectKey];
      if (state.replacer) objectValue = state.replacer.call(object, objectKey, objectValue);
      if (!writeNode(state, level, objectKey, false, false)) continue;
      if (state.dump.length > 1024) pairBuffer += "? ";
      pairBuffer += state.dump + (state.condenseFlow ? '"' : "") + ":" + (state.condenseFlow ? "" : " ");
      if (!writeNode(state, level, objectValue, false, false)) continue;
      pairBuffer += state.dump;
      _result += pairBuffer;
    }
    state.tag = _tag;
    state.dump = "{" + _result + "}";
  }
  function writeBlockMapping(state, level, object, compact) {
    let _result = "";
    const _tag = state.tag;
    const objectKeyList = Object.keys(object);
    if (state.sortKeys === true) objectKeyList.sort();
    else if (typeof state.sortKeys === "function") objectKeyList.sort(state.sortKeys);
    else if (state.sortKeys) throw new YAMLException2("sortKeys must be a boolean or a function");
    for (let index2 = 0, length = objectKeyList.length; index2 < length; index2 += 1) {
      let pairBuffer = "";
      if (!compact || _result !== "") pairBuffer += generateNextLine(state, level);
      const objectKey = objectKeyList[index2];
      let objectValue = object[objectKey];
      if (state.replacer) objectValue = state.replacer.call(object, objectKey, objectValue);
      if (!writeNode(state, level + 1, objectKey, true, true, true)) continue;
      const explicitPair = state.tag !== null && state.tag !== "?" || state.dump && state.dump.length > 1024;
      if (explicitPair) if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) pairBuffer += "?";
      else pairBuffer += "? ";
      pairBuffer += state.dump;
      if (explicitPair) pairBuffer += generateNextLine(state, level);
      if (!writeNode(state, level + 1, objectValue, true, explicitPair)) continue;
      if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) pairBuffer += ":";
      else pairBuffer += ": ";
      pairBuffer += state.dump;
      _result += pairBuffer;
    }
    state.tag = _tag;
    state.dump = _result || "{}";
  }
  function detectType(state, object, explicit) {
    const typeList = explicit ? state.explicitTypes : state.implicitTypes;
    for (let index2 = 0, length = typeList.length; index2 < length; index2 += 1) {
      const type = typeList[index2];
      if ((type.instanceOf || type.predicate) && (!type.instanceOf || typeof object === "object" && object instanceof type.instanceOf) && (!type.predicate || type.predicate(object))) {
        if (explicit) if (type.multi && type.representName) state.tag = type.representName(object);
        else state.tag = type.tag;
        else state.tag = "?";
        if (type.represent) {
          const style = state.styleMap[type.tag] || type.defaultStyle;
          let _result;
          if (_toString.call(type.represent) === "[object Function]") _result = type.represent(object, style);
          else if (_hasOwnProperty.call(type.represent, style)) _result = type.represent[style](object, style);
          else throw new YAMLException2("!<" + type.tag + '> tag resolver accepts not "' + style + '" style');
          state.dump = _result;
        }
        return true;
      }
    }
    return false;
  }
  function writeNode(state, level, object, block, compact, iskey, isblockseq) {
    state.tag = null;
    state.dump = object;
    if (!detectType(state, object, false)) detectType(state, object, true);
    const type = _toString.call(state.dump);
    const inblock = block;
    if (block) block = state.flowLevel < 0 || state.flowLevel > level;
    const objectOrArray = type === "[object Object]" || type === "[object Array]";
    let duplicateIndex;
    let duplicate;
    if (objectOrArray) {
      duplicateIndex = state.duplicates.indexOf(object);
      duplicate = duplicateIndex !== -1;
    }
    if (state.tag !== null && state.tag !== "?" || duplicate || state.indent !== 2 && level > 0) compact = false;
    if (duplicate && state.usedDuplicates[duplicateIndex]) state.dump = "*ref_" + duplicateIndex;
    else {
      if (objectOrArray && duplicate && !state.usedDuplicates[duplicateIndex]) state.usedDuplicates[duplicateIndex] = true;
      if (type === "[object Object]") if (block && Object.keys(state.dump).length !== 0) {
        writeBlockMapping(state, level, state.dump, compact);
        if (duplicate) state.dump = "&ref_" + duplicateIndex + state.dump;
      } else {
        writeFlowMapping(state, level, state.dump);
        if (duplicate) state.dump = "&ref_" + duplicateIndex + " " + state.dump;
      }
      else if (type === "[object Array]") if (block && state.dump.length !== 0) {
        if (state.noArrayIndent && !isblockseq && level > 0) writeBlockSequence(state, level - 1, state.dump, compact);
        else writeBlockSequence(state, level, state.dump, compact);
        if (duplicate) state.dump = "&ref_" + duplicateIndex + state.dump;
      } else {
        writeFlowSequence(state, level, state.dump);
        if (duplicate) state.dump = "&ref_" + duplicateIndex + " " + state.dump;
      }
      else if (type === "[object String]") {
        if (state.tag !== "?") writeScalar(state, state.dump, level, iskey, inblock);
      } else if (type === "[object Undefined]") return false;
      else {
        if (state.skipInvalid) return false;
        throw new YAMLException2("unacceptable kind of an object to dump " + type);
      }
      if (state.tag !== null && state.tag !== "?") {
        let tagStr = encodeURI(state.tag[0] === "!" ? state.tag.slice(1) : state.tag).replace(/!/g, "%21");
        if (state.tag[0] === "!") tagStr = "!" + tagStr;
        else if (tagStr.slice(0, 18) === "tag:yaml.org,2002:") tagStr = "!!" + tagStr.slice(18);
        else tagStr = "!<" + tagStr + ">";
        state.dump = tagStr + " " + state.dump;
      }
    }
    return true;
  }
  function getDuplicateReferences(object, state) {
    const objects2 = [];
    const duplicatesIndexes = [];
    inspectNode(object, objects2, duplicatesIndexes);
    const length = duplicatesIndexes.length;
    for (let index2 = 0; index2 < length; index2 += 1) state.duplicates.push(objects2[duplicatesIndexes[index2]]);
    state.usedDuplicates = new Array(length);
  }
  function inspectNode(object, objects2, duplicatesIndexes) {
    if (object !== null && typeof object === "object") {
      const index2 = objects2.indexOf(object);
      if (index2 !== -1) {
        if (duplicatesIndexes.indexOf(index2) === -1) duplicatesIndexes.push(index2);
      } else {
        objects2.push(object);
        if (Array.isArray(object)) for (let i = 0, length = object.length; i < length; i += 1) inspectNode(object[i], objects2, duplicatesIndexes);
        else {
          const objectKeyList = Object.keys(object);
          for (let i = 0, length = objectKeyList.length; i < length; i += 1) inspectNode(object[objectKeyList[i]], objects2, duplicatesIndexes);
        }
      }
    }
  }
  function dump2(input, options) {
    options = options || {};
    const state = new State(options);
    if (!state.noRefs) getDuplicateReferences(input, state);
    let value = input;
    if (state.replacer) value = state.replacer.call({ "": value }, "", value);
    if (writeNode(state, 0, value, true, true)) return state.dump + "\n";
    return "";
  }
  module2.exports.dump = dump2;
}));
var import_js_yaml = /* @__PURE__ */ __toESM((/* @__PURE__ */ __commonJSMin(((exports2, module2) => {
  var loader = require_loader();
  var dumper = require_dumper();
  function renamed(from, to) {
    return function() {
      throw new Error("Function yaml." + from + " is removed in js-yaml 4. Use yaml." + to + " instead, which is now safe by default.");
    };
  }
  module2.exports.Type = require_type();
  module2.exports.Schema = require_schema();
  module2.exports.FAILSAFE_SCHEMA = require_failsafe();
  module2.exports.JSON_SCHEMA = require_json();
  module2.exports.CORE_SCHEMA = require_core();
  module2.exports.DEFAULT_SCHEMA = require_default();
  module2.exports.load = loader.load;
  module2.exports.loadAll = loader.loadAll;
  module2.exports.dump = dumper.dump;
  module2.exports.YAMLException = require_exception();
  module2.exports.types = {
    binary: require_binary(),
    float: require_float(),
    map: require_map(),
    null: require_null(),
    pairs: require_pairs(),
    set: require_set(),
    timestamp: require_timestamp(),
    bool: require_bool(),
    int: require_int(),
    merge: require_merge(),
    omap: require_omap(),
    seq: require_seq(),
    str: require_str()
  };
  module2.exports.safeLoad = renamed("safeLoad", "load");
  module2.exports.safeLoadAll = renamed("safeLoadAll", "loadAll");
  module2.exports.safeDump = renamed("safeDump", "dump");
})))());
var { Type, Schema, FAILSAFE_SCHEMA, JSON_SCHEMA, CORE_SCHEMA, DEFAULT_SCHEMA, load, loadAll, dump, YAMLException, types: types$1, safeLoad, safeLoadAll, safeDump } = import_js_yaml.default;
var index_vite_proxy_tmp_default = import_js_yaml.default;
const jsYaml = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  CORE_SCHEMA,
  DEFAULT_SCHEMA,
  FAILSAFE_SCHEMA,
  JSON_SCHEMA,
  Schema,
  Type,
  YAMLException,
  default: index_vite_proxy_tmp_default,
  dump,
  load,
  loadAll,
  safeDump,
  safeLoad,
  safeLoadAll,
  types: types$1
}, Symbol.toStringTag, { value: "Module" }));
const require$$5 = /* @__PURE__ */ getAugmentedNamespace(jsYaml);
var main$2 = {};
var hasRequiredMain$2;
function requireMain$2() {
  if (hasRequiredMain$2) return main$2;
  hasRequiredMain$2 = 1;
  Object.defineProperty(main$2, "__esModule", { value: true });
  main$2.Lazy = void 0;
  class Lazy {
    constructor(creator) {
      this._value = null;
      this.creator = creator;
    }
    get hasValue() {
      return this.creator == null;
    }
    get value() {
      if (this.creator == null) {
        return this._value;
      }
      const result = this.creator();
      this.value = result;
      return result;
    }
    set value(value) {
      this._value = value;
      this.creator = null;
    }
  }
  main$2.Lazy = Lazy;
  return main$2;
}
var re = { exports: {} };
var constants;
var hasRequiredConstants;
function requireConstants() {
  if (hasRequiredConstants) return constants;
  hasRequiredConstants = 1;
  const SEMVER_SPEC_VERSION = "2.0.0";
  const MAX_LENGTH = 256;
  const MAX_SAFE_INTEGER = Number.MAX_SAFE_INTEGER || /* istanbul ignore next */
  9007199254740991;
  const MAX_SAFE_COMPONENT_LENGTH = 16;
  const MAX_SAFE_BUILD_LENGTH = MAX_LENGTH - 6;
  const RELEASE_TYPES = [
    "major",
    "premajor",
    "minor",
    "preminor",
    "patch",
    "prepatch",
    "prerelease"
  ];
  constants = {
    MAX_LENGTH,
    MAX_SAFE_COMPONENT_LENGTH,
    MAX_SAFE_BUILD_LENGTH,
    MAX_SAFE_INTEGER,
    RELEASE_TYPES,
    SEMVER_SPEC_VERSION,
    FLAG_INCLUDE_PRERELEASE: 1,
    FLAG_LOOSE: 2
  };
  return constants;
}
var debug_1;
var hasRequiredDebug;
function requireDebug() {
  if (hasRequiredDebug) return debug_1;
  hasRequiredDebug = 1;
  const debug = typeof process === "object" && process.env && process.env.NODE_DEBUG && /\bsemver\b/i.test(process.env.NODE_DEBUG) ? (...args) => console.error("SEMVER", ...args) : () => {
  };
  debug_1 = debug;
  return debug_1;
}
var hasRequiredRe;
function requireRe() {
  if (hasRequiredRe) return re.exports;
  hasRequiredRe = 1;
  (function(module2, exports2) {
    const {
      MAX_SAFE_COMPONENT_LENGTH,
      MAX_SAFE_BUILD_LENGTH,
      MAX_LENGTH
    } = requireConstants();
    const debug = requireDebug();
    exports2 = module2.exports = {};
    const re2 = exports2.re = [];
    const safeRe = exports2.safeRe = [];
    const src2 = exports2.src = [];
    const safeSrc = exports2.safeSrc = [];
    const t = exports2.t = {};
    let R = 0;
    const LETTERDASHNUMBER = "[a-zA-Z0-9-]";
    const safeRegexReplacements = [
      ["\\s", 1],
      ["\\d", MAX_LENGTH],
      [LETTERDASHNUMBER, MAX_SAFE_BUILD_LENGTH]
    ];
    const makeSafeRegex = (value) => {
      for (const [token, max] of safeRegexReplacements) {
        value = value.split(`${token}*`).join(`${token}{0,${max}}`).split(`${token}+`).join(`${token}{1,${max}}`);
      }
      return value;
    };
    const createToken = (name, value, isGlobal) => {
      const safe = makeSafeRegex(value);
      const index2 = R++;
      debug(name, index2, value);
      t[name] = index2;
      src2[index2] = value;
      safeSrc[index2] = safe;
      re2[index2] = new RegExp(value, isGlobal ? "g" : void 0);
      safeRe[index2] = new RegExp(safe, isGlobal ? "g" : void 0);
    };
    createToken("NUMERICIDENTIFIER", "0|[1-9]\\d*");
    createToken("NUMERICIDENTIFIERLOOSE", "\\d+");
    createToken("NONNUMERICIDENTIFIER", `\\d*[a-zA-Z-]${LETTERDASHNUMBER}*`);
    createToken("MAINVERSION", `(${src2[t.NUMERICIDENTIFIER]})\\.(${src2[t.NUMERICIDENTIFIER]})\\.(${src2[t.NUMERICIDENTIFIER]})`);
    createToken("MAINVERSIONLOOSE", `(${src2[t.NUMERICIDENTIFIERLOOSE]})\\.(${src2[t.NUMERICIDENTIFIERLOOSE]})\\.(${src2[t.NUMERICIDENTIFIERLOOSE]})`);
    createToken("PRERELEASEIDENTIFIER", `(?:${src2[t.NONNUMERICIDENTIFIER]}|${src2[t.NUMERICIDENTIFIER]})`);
    createToken("PRERELEASEIDENTIFIERLOOSE", `(?:${src2[t.NONNUMERICIDENTIFIER]}|${src2[t.NUMERICIDENTIFIERLOOSE]})`);
    createToken("PRERELEASE", `(?:-(${src2[t.PRERELEASEIDENTIFIER]}(?:\\.${src2[t.PRERELEASEIDENTIFIER]})*))`);
    createToken("PRERELEASELOOSE", `(?:-?(${src2[t.PRERELEASEIDENTIFIERLOOSE]}(?:\\.${src2[t.PRERELEASEIDENTIFIERLOOSE]})*))`);
    createToken("BUILDIDENTIFIER", `${LETTERDASHNUMBER}+`);
    createToken("BUILD", `(?:\\+(${src2[t.BUILDIDENTIFIER]}(?:\\.${src2[t.BUILDIDENTIFIER]})*))`);
    createToken("FULLPLAIN", `v?${src2[t.MAINVERSION]}${src2[t.PRERELEASE]}?${src2[t.BUILD]}?`);
    createToken("FULL", `^${src2[t.FULLPLAIN]}$`);
    createToken("LOOSEPLAIN", `[v=\\s]*${src2[t.MAINVERSIONLOOSE]}${src2[t.PRERELEASELOOSE]}?${src2[t.BUILD]}?`);
    createToken("LOOSE", `^${src2[t.LOOSEPLAIN]}$`);
    createToken("GTLT", "((?:<|>)?=?)");
    createToken("XRANGEIDENTIFIERLOOSE", `${src2[t.NUMERICIDENTIFIERLOOSE]}|x|X|\\*`);
    createToken("XRANGEIDENTIFIER", `${src2[t.NUMERICIDENTIFIER]}|x|X|\\*`);
    createToken("XRANGEPLAIN", `[v=\\s]*(${src2[t.XRANGEIDENTIFIER]})(?:\\.(${src2[t.XRANGEIDENTIFIER]})(?:\\.(${src2[t.XRANGEIDENTIFIER]})(?:${src2[t.PRERELEASE]})?${src2[t.BUILD]}?)?)?`);
    createToken("XRANGEPLAINLOOSE", `[v=\\s]*(${src2[t.XRANGEIDENTIFIERLOOSE]})(?:\\.(${src2[t.XRANGEIDENTIFIERLOOSE]})(?:\\.(${src2[t.XRANGEIDENTIFIERLOOSE]})(?:${src2[t.PRERELEASELOOSE]})?${src2[t.BUILD]}?)?)?`);
    createToken("XRANGE", `^${src2[t.GTLT]}\\s*${src2[t.XRANGEPLAIN]}$`);
    createToken("XRANGELOOSE", `^${src2[t.GTLT]}\\s*${src2[t.XRANGEPLAINLOOSE]}$`);
    createToken("COERCEPLAIN", `${"(^|[^\\d])(\\d{1,"}${MAX_SAFE_COMPONENT_LENGTH}})(?:\\.(\\d{1,${MAX_SAFE_COMPONENT_LENGTH}}))?(?:\\.(\\d{1,${MAX_SAFE_COMPONENT_LENGTH}}))?`);
    createToken("COERCE", `${src2[t.COERCEPLAIN]}(?:$|[^\\d])`);
    createToken("COERCEFULL", src2[t.COERCEPLAIN] + `(?:${src2[t.PRERELEASE]})?(?:${src2[t.BUILD]})?(?:$|[^\\d])`);
    createToken("COERCERTL", src2[t.COERCE], true);
    createToken("COERCERTLFULL", src2[t.COERCEFULL], true);
    createToken("LONETILDE", "(?:~>?)");
    createToken("TILDETRIM", `(\\s*)${src2[t.LONETILDE]}\\s+`, true);
    exports2.tildeTrimReplace = "$1~";
    createToken("TILDE", `^${src2[t.LONETILDE]}${src2[t.XRANGEPLAIN]}$`);
    createToken("TILDELOOSE", `^${src2[t.LONETILDE]}${src2[t.XRANGEPLAINLOOSE]}$`);
    createToken("LONECARET", "(?:\\^)");
    createToken("CARETTRIM", `(\\s*)${src2[t.LONECARET]}\\s+`, true);
    exports2.caretTrimReplace = "$1^";
    createToken("CARET", `^${src2[t.LONECARET]}${src2[t.XRANGEPLAIN]}$`);
    createToken("CARETLOOSE", `^${src2[t.LONECARET]}${src2[t.XRANGEPLAINLOOSE]}$`);
    createToken("COMPARATORLOOSE", `^${src2[t.GTLT]}\\s*(${src2[t.LOOSEPLAIN]})$|^$`);
    createToken("COMPARATOR", `^${src2[t.GTLT]}\\s*(${src2[t.FULLPLAIN]})$|^$`);
    createToken("COMPARATORTRIM", `(\\s*)${src2[t.GTLT]}\\s*(${src2[t.LOOSEPLAIN]}|${src2[t.XRANGEPLAIN]})`, true);
    exports2.comparatorTrimReplace = "$1$2$3";
    createToken("HYPHENRANGE", `^\\s*(${src2[t.XRANGEPLAIN]})\\s+-\\s+(${src2[t.XRANGEPLAIN]})\\s*$`);
    createToken("HYPHENRANGELOOSE", `^\\s*(${src2[t.XRANGEPLAINLOOSE]})\\s+-\\s+(${src2[t.XRANGEPLAINLOOSE]})\\s*$`);
    createToken("STAR", "(<|>)?=?\\s*\\*");
    createToken("GTE0", "^\\s*>=\\s*0\\.0\\.0\\s*$");
    createToken("GTE0PRE", "^\\s*>=\\s*0\\.0\\.0-0\\s*$");
  })(re, re.exports);
  return re.exports;
}
var parseOptions_1;
var hasRequiredParseOptions;
function requireParseOptions() {
  if (hasRequiredParseOptions) return parseOptions_1;
  hasRequiredParseOptions = 1;
  const looseOption = Object.freeze({ loose: true });
  const emptyOpts = Object.freeze({});
  const parseOptions = (options) => {
    if (!options) {
      return emptyOpts;
    }
    if (typeof options !== "object") {
      return looseOption;
    }
    return options;
  };
  parseOptions_1 = parseOptions;
  return parseOptions_1;
}
var identifiers;
var hasRequiredIdentifiers;
function requireIdentifiers() {
  if (hasRequiredIdentifiers) return identifiers;
  hasRequiredIdentifiers = 1;
  const numeric = /^[0-9]+$/;
  const compareIdentifiers = (a, b) => {
    if (typeof a === "number" && typeof b === "number") {
      return a === b ? 0 : a < b ? -1 : 1;
    }
    const anum = numeric.test(a);
    const bnum = numeric.test(b);
    if (anum && bnum) {
      a = +a;
      b = +b;
    }
    return a === b ? 0 : anum && !bnum ? -1 : bnum && !anum ? 1 : a < b ? -1 : 1;
  };
  const rcompareIdentifiers = (a, b) => compareIdentifiers(b, a);
  identifiers = {
    compareIdentifiers,
    rcompareIdentifiers
  };
  return identifiers;
}
var semver$1;
var hasRequiredSemver$1;
function requireSemver$1() {
  if (hasRequiredSemver$1) return semver$1;
  hasRequiredSemver$1 = 1;
  const debug = requireDebug();
  const { MAX_LENGTH, MAX_SAFE_INTEGER } = requireConstants();
  const { safeRe: re2, t } = requireRe();
  const parseOptions = requireParseOptions();
  const { compareIdentifiers } = requireIdentifiers();
  class SemVer {
    constructor(version, options) {
      options = parseOptions(options);
      if (version instanceof SemVer) {
        if (version.loose === !!options.loose && version.includePrerelease === !!options.includePrerelease) {
          return version;
        } else {
          version = version.version;
        }
      } else if (typeof version !== "string") {
        throw new TypeError(`Invalid version. Must be a string. Got type "${typeof version}".`);
      }
      if (version.length > MAX_LENGTH) {
        throw new TypeError(
          `version is longer than ${MAX_LENGTH} characters`
        );
      }
      debug("SemVer", version, options);
      this.options = options;
      this.loose = !!options.loose;
      this.includePrerelease = !!options.includePrerelease;
      const m = version.trim().match(options.loose ? re2[t.LOOSE] : re2[t.FULL]);
      if (!m) {
        throw new TypeError(`Invalid Version: ${version}`);
      }
      this.raw = version;
      this.major = +m[1];
      this.minor = +m[2];
      this.patch = +m[3];
      if (this.major > MAX_SAFE_INTEGER || this.major < 0) {
        throw new TypeError("Invalid major version");
      }
      if (this.minor > MAX_SAFE_INTEGER || this.minor < 0) {
        throw new TypeError("Invalid minor version");
      }
      if (this.patch > MAX_SAFE_INTEGER || this.patch < 0) {
        throw new TypeError("Invalid patch version");
      }
      if (!m[4]) {
        this.prerelease = [];
      } else {
        this.prerelease = m[4].split(".").map((id) => {
          if (/^[0-9]+$/.test(id)) {
            const num = +id;
            if (num >= 0 && num < MAX_SAFE_INTEGER) {
              return num;
            }
          }
          return id;
        });
      }
      this.build = m[5] ? m[5].split(".") : [];
      this.format();
    }
    format() {
      this.version = `${this.major}.${this.minor}.${this.patch}`;
      if (this.prerelease.length) {
        this.version += `-${this.prerelease.join(".")}`;
      }
      return this.version;
    }
    toString() {
      return this.version;
    }
    compare(other) {
      debug("SemVer.compare", this.version, this.options, other);
      if (!(other instanceof SemVer)) {
        if (typeof other === "string" && other === this.version) {
          return 0;
        }
        other = new SemVer(other, this.options);
      }
      if (other.version === this.version) {
        return 0;
      }
      return this.compareMain(other) || this.comparePre(other);
    }
    compareMain(other) {
      if (!(other instanceof SemVer)) {
        other = new SemVer(other, this.options);
      }
      if (this.major < other.major) {
        return -1;
      }
      if (this.major > other.major) {
        return 1;
      }
      if (this.minor < other.minor) {
        return -1;
      }
      if (this.minor > other.minor) {
        return 1;
      }
      if (this.patch < other.patch) {
        return -1;
      }
      if (this.patch > other.patch) {
        return 1;
      }
      return 0;
    }
    comparePre(other) {
      if (!(other instanceof SemVer)) {
        other = new SemVer(other, this.options);
      }
      if (this.prerelease.length && !other.prerelease.length) {
        return -1;
      } else if (!this.prerelease.length && other.prerelease.length) {
        return 1;
      } else if (!this.prerelease.length && !other.prerelease.length) {
        return 0;
      }
      let i = 0;
      do {
        const a = this.prerelease[i];
        const b = other.prerelease[i];
        debug("prerelease compare", i, a, b);
        if (a === void 0 && b === void 0) {
          return 0;
        } else if (b === void 0) {
          return 1;
        } else if (a === void 0) {
          return -1;
        } else if (a === b) {
          continue;
        } else {
          return compareIdentifiers(a, b);
        }
      } while (++i);
    }
    compareBuild(other) {
      if (!(other instanceof SemVer)) {
        other = new SemVer(other, this.options);
      }
      let i = 0;
      do {
        const a = this.build[i];
        const b = other.build[i];
        debug("build compare", i, a, b);
        if (a === void 0 && b === void 0) {
          return 0;
        } else if (b === void 0) {
          return 1;
        } else if (a === void 0) {
          return -1;
        } else if (a === b) {
          continue;
        } else {
          return compareIdentifiers(a, b);
        }
      } while (++i);
    }
    // preminor will bump the version up to the next minor release, and immediately
    // down to pre-release. premajor and prepatch work the same way.
    inc(release, identifier, identifierBase) {
      if (release.startsWith("pre")) {
        if (!identifier && identifierBase === false) {
          throw new Error("invalid increment argument: identifier is empty");
        }
        if (identifier) {
          const match = `-${identifier}`.match(this.options.loose ? re2[t.PRERELEASELOOSE] : re2[t.PRERELEASE]);
          if (!match || match[1] !== identifier) {
            throw new Error(`invalid identifier: ${identifier}`);
          }
        }
      }
      switch (release) {
        case "premajor":
          this.prerelease.length = 0;
          this.patch = 0;
          this.minor = 0;
          this.major++;
          this.inc("pre", identifier, identifierBase);
          break;
        case "preminor":
          this.prerelease.length = 0;
          this.patch = 0;
          this.minor++;
          this.inc("pre", identifier, identifierBase);
          break;
        case "prepatch":
          this.prerelease.length = 0;
          this.inc("patch", identifier, identifierBase);
          this.inc("pre", identifier, identifierBase);
          break;
        // If the input is a non-prerelease version, this acts the same as
        // prepatch.
        case "prerelease":
          if (this.prerelease.length === 0) {
            this.inc("patch", identifier, identifierBase);
          }
          this.inc("pre", identifier, identifierBase);
          break;
        case "release":
          if (this.prerelease.length === 0) {
            throw new Error(`version ${this.raw} is not a prerelease`);
          }
          this.prerelease.length = 0;
          break;
        case "major":
          if (this.minor !== 0 || this.patch !== 0 || this.prerelease.length === 0) {
            this.major++;
          }
          this.minor = 0;
          this.patch = 0;
          this.prerelease = [];
          break;
        case "minor":
          if (this.patch !== 0 || this.prerelease.length === 0) {
            this.minor++;
          }
          this.patch = 0;
          this.prerelease = [];
          break;
        case "patch":
          if (this.prerelease.length === 0) {
            this.patch++;
          }
          this.prerelease = [];
          break;
        // This probably shouldn't be used publicly.
        // 1.0.0 'pre' would become 1.0.0-0 which is the wrong direction.
        case "pre": {
          const base = Number(identifierBase) ? 1 : 0;
          if (this.prerelease.length === 0) {
            this.prerelease = [base];
          } else {
            let i = this.prerelease.length;
            while (--i >= 0) {
              if (typeof this.prerelease[i] === "number") {
                this.prerelease[i]++;
                i = -2;
              }
            }
            if (i === -1) {
              if (identifier === this.prerelease.join(".") && identifierBase === false) {
                throw new Error("invalid increment argument: identifier already exists");
              }
              this.prerelease.push(base);
            }
          }
          if (identifier) {
            let prerelease = [identifier, base];
            if (identifierBase === false) {
              prerelease = [identifier];
            }
            if (compareIdentifiers(this.prerelease[0], identifier) === 0) {
              if (isNaN(this.prerelease[1])) {
                this.prerelease = prerelease;
              }
            } else {
              this.prerelease = prerelease;
            }
          }
          break;
        }
        default:
          throw new Error(`invalid increment argument: ${release}`);
      }
      this.raw = this.format();
      if (this.build.length) {
        this.raw += `+${this.build.join(".")}`;
      }
      return this;
    }
  }
  semver$1 = SemVer;
  return semver$1;
}
var parse_1;
var hasRequiredParse;
function requireParse() {
  if (hasRequiredParse) return parse_1;
  hasRequiredParse = 1;
  const SemVer = requireSemver$1();
  const parse = (version, options, throwErrors = false) => {
    if (version instanceof SemVer) {
      return version;
    }
    try {
      return new SemVer(version, options);
    } catch (er) {
      if (!throwErrors) {
        return null;
      }
      throw er;
    }
  };
  parse_1 = parse;
  return parse_1;
}
var valid_1;
var hasRequiredValid$1;
function requireValid$1() {
  if (hasRequiredValid$1) return valid_1;
  hasRequiredValid$1 = 1;
  const parse = requireParse();
  const valid2 = (version, options) => {
    const v = parse(version, options);
    return v ? v.version : null;
  };
  valid_1 = valid2;
  return valid_1;
}
var clean_1;
var hasRequiredClean;
function requireClean() {
  if (hasRequiredClean) return clean_1;
  hasRequiredClean = 1;
  const parse = requireParse();
  const clean = (version, options) => {
    const s = parse(version.trim().replace(/^[=v]+/, ""), options);
    return s ? s.version : null;
  };
  clean_1 = clean;
  return clean_1;
}
var inc_1;
var hasRequiredInc;
function requireInc() {
  if (hasRequiredInc) return inc_1;
  hasRequiredInc = 1;
  const SemVer = requireSemver$1();
  const inc = (version, release, options, identifier, identifierBase) => {
    if (typeof options === "string") {
      identifierBase = identifier;
      identifier = options;
      options = void 0;
    }
    try {
      return new SemVer(
        version instanceof SemVer ? version.version : version,
        options
      ).inc(release, identifier, identifierBase).version;
    } catch (er) {
      return null;
    }
  };
  inc_1 = inc;
  return inc_1;
}
var diff_1;
var hasRequiredDiff;
function requireDiff() {
  if (hasRequiredDiff) return diff_1;
  hasRequiredDiff = 1;
  const parse = requireParse();
  const diff = (version1, version2) => {
    const v1 = parse(version1, null, true);
    const v2 = parse(version2, null, true);
    const comparison = v1.compare(v2);
    if (comparison === 0) {
      return null;
    }
    const v1Higher = comparison > 0;
    const highVersion = v1Higher ? v1 : v2;
    const lowVersion = v1Higher ? v2 : v1;
    const highHasPre = !!highVersion.prerelease.length;
    const lowHasPre = !!lowVersion.prerelease.length;
    if (lowHasPre && !highHasPre) {
      if (!lowVersion.patch && !lowVersion.minor) {
        return "major";
      }
      if (lowVersion.compareMain(highVersion) === 0) {
        if (lowVersion.minor && !lowVersion.patch) {
          return "minor";
        }
        return "patch";
      }
    }
    const prefix = highHasPre ? "pre" : "";
    if (v1.major !== v2.major) {
      return prefix + "major";
    }
    if (v1.minor !== v2.minor) {
      return prefix + "minor";
    }
    if (v1.patch !== v2.patch) {
      return prefix + "patch";
    }
    return "prerelease";
  };
  diff_1 = diff;
  return diff_1;
}
var major_1;
var hasRequiredMajor;
function requireMajor() {
  if (hasRequiredMajor) return major_1;
  hasRequiredMajor = 1;
  const SemVer = requireSemver$1();
  const major = (a, loose) => new SemVer(a, loose).major;
  major_1 = major;
  return major_1;
}
var minor_1;
var hasRequiredMinor;
function requireMinor() {
  if (hasRequiredMinor) return minor_1;
  hasRequiredMinor = 1;
  const SemVer = requireSemver$1();
  const minor = (a, loose) => new SemVer(a, loose).minor;
  minor_1 = minor;
  return minor_1;
}
var patch_1;
var hasRequiredPatch;
function requirePatch() {
  if (hasRequiredPatch) return patch_1;
  hasRequiredPatch = 1;
  const SemVer = requireSemver$1();
  const patch = (a, loose) => new SemVer(a, loose).patch;
  patch_1 = patch;
  return patch_1;
}
var prerelease_1;
var hasRequiredPrerelease;
function requirePrerelease() {
  if (hasRequiredPrerelease) return prerelease_1;
  hasRequiredPrerelease = 1;
  const parse = requireParse();
  const prerelease = (version, options) => {
    const parsed = parse(version, options);
    return parsed && parsed.prerelease.length ? parsed.prerelease : null;
  };
  prerelease_1 = prerelease;
  return prerelease_1;
}
var compare_1;
var hasRequiredCompare;
function requireCompare() {
  if (hasRequiredCompare) return compare_1;
  hasRequiredCompare = 1;
  const SemVer = requireSemver$1();
  const compare = (a, b, loose) => new SemVer(a, loose).compare(new SemVer(b, loose));
  compare_1 = compare;
  return compare_1;
}
var rcompare_1;
var hasRequiredRcompare;
function requireRcompare() {
  if (hasRequiredRcompare) return rcompare_1;
  hasRequiredRcompare = 1;
  const compare = requireCompare();
  const rcompare = (a, b, loose) => compare(b, a, loose);
  rcompare_1 = rcompare;
  return rcompare_1;
}
var compareLoose_1;
var hasRequiredCompareLoose;
function requireCompareLoose() {
  if (hasRequiredCompareLoose) return compareLoose_1;
  hasRequiredCompareLoose = 1;
  const compare = requireCompare();
  const compareLoose = (a, b) => compare(a, b, true);
  compareLoose_1 = compareLoose;
  return compareLoose_1;
}
var compareBuild_1;
var hasRequiredCompareBuild;
function requireCompareBuild() {
  if (hasRequiredCompareBuild) return compareBuild_1;
  hasRequiredCompareBuild = 1;
  const SemVer = requireSemver$1();
  const compareBuild = (a, b, loose) => {
    const versionA = new SemVer(a, loose);
    const versionB = new SemVer(b, loose);
    return versionA.compare(versionB) || versionA.compareBuild(versionB);
  };
  compareBuild_1 = compareBuild;
  return compareBuild_1;
}
var sort_1;
var hasRequiredSort;
function requireSort() {
  if (hasRequiredSort) return sort_1;
  hasRequiredSort = 1;
  const compareBuild = requireCompareBuild();
  const sort = (list, loose) => list.sort((a, b) => compareBuild(a, b, loose));
  sort_1 = sort;
  return sort_1;
}
var rsort_1;
var hasRequiredRsort;
function requireRsort() {
  if (hasRequiredRsort) return rsort_1;
  hasRequiredRsort = 1;
  const compareBuild = requireCompareBuild();
  const rsort = (list, loose) => list.sort((a, b) => compareBuild(b, a, loose));
  rsort_1 = rsort;
  return rsort_1;
}
var gt_1;
var hasRequiredGt;
function requireGt() {
  if (hasRequiredGt) return gt_1;
  hasRequiredGt = 1;
  const compare = requireCompare();
  const gt = (a, b, loose) => compare(a, b, loose) > 0;
  gt_1 = gt;
  return gt_1;
}
var lt_1;
var hasRequiredLt;
function requireLt() {
  if (hasRequiredLt) return lt_1;
  hasRequiredLt = 1;
  const compare = requireCompare();
  const lt = (a, b, loose) => compare(a, b, loose) < 0;
  lt_1 = lt;
  return lt_1;
}
var eq_1;
var hasRequiredEq;
function requireEq() {
  if (hasRequiredEq) return eq_1;
  hasRequiredEq = 1;
  const compare = requireCompare();
  const eq = (a, b, loose) => compare(a, b, loose) === 0;
  eq_1 = eq;
  return eq_1;
}
var neq_1;
var hasRequiredNeq;
function requireNeq() {
  if (hasRequiredNeq) return neq_1;
  hasRequiredNeq = 1;
  const compare = requireCompare();
  const neq = (a, b, loose) => compare(a, b, loose) !== 0;
  neq_1 = neq;
  return neq_1;
}
var gte_1;
var hasRequiredGte;
function requireGte() {
  if (hasRequiredGte) return gte_1;
  hasRequiredGte = 1;
  const compare = requireCompare();
  const gte = (a, b, loose) => compare(a, b, loose) >= 0;
  gte_1 = gte;
  return gte_1;
}
var lte_1;
var hasRequiredLte;
function requireLte() {
  if (hasRequiredLte) return lte_1;
  hasRequiredLte = 1;
  const compare = requireCompare();
  const lte = (a, b, loose) => compare(a, b, loose) <= 0;
  lte_1 = lte;
  return lte_1;
}
var cmp_1;
var hasRequiredCmp;
function requireCmp() {
  if (hasRequiredCmp) return cmp_1;
  hasRequiredCmp = 1;
  const eq = requireEq();
  const neq = requireNeq();
  const gt = requireGt();
  const gte = requireGte();
  const lt = requireLt();
  const lte = requireLte();
  const cmp = (a, op, b, loose) => {
    switch (op) {
      case "===":
        if (typeof a === "object") {
          a = a.version;
        }
        if (typeof b === "object") {
          b = b.version;
        }
        return a === b;
      case "!==":
        if (typeof a === "object") {
          a = a.version;
        }
        if (typeof b === "object") {
          b = b.version;
        }
        return a !== b;
      case "":
      case "=":
      case "==":
        return eq(a, b, loose);
      case "!=":
        return neq(a, b, loose);
      case ">":
        return gt(a, b, loose);
      case ">=":
        return gte(a, b, loose);
      case "<":
        return lt(a, b, loose);
      case "<=":
        return lte(a, b, loose);
      default:
        throw new TypeError(`Invalid operator: ${op}`);
    }
  };
  cmp_1 = cmp;
  return cmp_1;
}
var coerce_1;
var hasRequiredCoerce;
function requireCoerce() {
  if (hasRequiredCoerce) return coerce_1;
  hasRequiredCoerce = 1;
  const SemVer = requireSemver$1();
  const parse = requireParse();
  const { safeRe: re2, t } = requireRe();
  const coerce = (version, options) => {
    if (version instanceof SemVer) {
      return version;
    }
    if (typeof version === "number") {
      version = String(version);
    }
    if (typeof version !== "string") {
      return null;
    }
    options = options || {};
    let match = null;
    if (!options.rtl) {
      match = version.match(options.includePrerelease ? re2[t.COERCEFULL] : re2[t.COERCE]);
    } else {
      const coerceRtlRegex = options.includePrerelease ? re2[t.COERCERTLFULL] : re2[t.COERCERTL];
      let next;
      while ((next = coerceRtlRegex.exec(version)) && (!match || match.index + match[0].length !== version.length)) {
        if (!match || next.index + next[0].length !== match.index + match[0].length) {
          match = next;
        }
        coerceRtlRegex.lastIndex = next.index + next[1].length + next[2].length;
      }
      coerceRtlRegex.lastIndex = -1;
    }
    if (match === null) {
      return null;
    }
    const major = match[2];
    const minor = match[3] || "0";
    const patch = match[4] || "0";
    const prerelease = options.includePrerelease && match[5] ? `-${match[5]}` : "";
    const build = options.includePrerelease && match[6] ? `+${match[6]}` : "";
    return parse(`${major}.${minor}.${patch}${prerelease}${build}`, options);
  };
  coerce_1 = coerce;
  return coerce_1;
}
var lrucache;
var hasRequiredLrucache;
function requireLrucache() {
  if (hasRequiredLrucache) return lrucache;
  hasRequiredLrucache = 1;
  class LRUCache {
    constructor() {
      this.max = 1e3;
      this.map = /* @__PURE__ */ new Map();
    }
    get(key) {
      const value = this.map.get(key);
      if (value === void 0) {
        return void 0;
      } else {
        this.map.delete(key);
        this.map.set(key, value);
        return value;
      }
    }
    delete(key) {
      return this.map.delete(key);
    }
    set(key, value) {
      const deleted = this.delete(key);
      if (!deleted && value !== void 0) {
        if (this.map.size >= this.max) {
          const firstKey = this.map.keys().next().value;
          this.delete(firstKey);
        }
        this.map.set(key, value);
      }
      return this;
    }
  }
  lrucache = LRUCache;
  return lrucache;
}
var range;
var hasRequiredRange;
function requireRange() {
  if (hasRequiredRange) return range;
  hasRequiredRange = 1;
  const SPACE_CHARACTERS = /\s+/g;
  class Range {
    constructor(range2, options) {
      options = parseOptions(options);
      if (range2 instanceof Range) {
        if (range2.loose === !!options.loose && range2.includePrerelease === !!options.includePrerelease) {
          return range2;
        } else {
          return new Range(range2.raw, options);
        }
      }
      if (range2 instanceof Comparator) {
        this.raw = range2.value;
        this.set = [[range2]];
        this.formatted = void 0;
        return this;
      }
      this.options = options;
      this.loose = !!options.loose;
      this.includePrerelease = !!options.includePrerelease;
      this.raw = range2.trim().replace(SPACE_CHARACTERS, " ");
      this.set = this.raw.split("||").map((r) => this.parseRange(r.trim())).filter((c) => c.length);
      if (!this.set.length) {
        throw new TypeError(`Invalid SemVer Range: ${this.raw}`);
      }
      if (this.set.length > 1) {
        const first = this.set[0];
        this.set = this.set.filter((c) => !isNullSet(c[0]));
        if (this.set.length === 0) {
          this.set = [first];
        } else if (this.set.length > 1) {
          for (const c of this.set) {
            if (c.length === 1 && isAny(c[0])) {
              this.set = [c];
              break;
            }
          }
        }
      }
      this.formatted = void 0;
    }
    get range() {
      if (this.formatted === void 0) {
        this.formatted = "";
        for (let i = 0; i < this.set.length; i++) {
          if (i > 0) {
            this.formatted += "||";
          }
          const comps = this.set[i];
          for (let k = 0; k < comps.length; k++) {
            if (k > 0) {
              this.formatted += " ";
            }
            this.formatted += comps[k].toString().trim();
          }
        }
      }
      return this.formatted;
    }
    format() {
      return this.range;
    }
    toString() {
      return this.range;
    }
    parseRange(range2) {
      const memoOpts = (this.options.includePrerelease && FLAG_INCLUDE_PRERELEASE) | (this.options.loose && FLAG_LOOSE);
      const memoKey = memoOpts + ":" + range2;
      const cached = cache.get(memoKey);
      if (cached) {
        return cached;
      }
      const loose = this.options.loose;
      const hr = loose ? re2[t.HYPHENRANGELOOSE] : re2[t.HYPHENRANGE];
      range2 = range2.replace(hr, hyphenReplace(this.options.includePrerelease));
      debug("hyphen replace", range2);
      range2 = range2.replace(re2[t.COMPARATORTRIM], comparatorTrimReplace);
      debug("comparator trim", range2);
      range2 = range2.replace(re2[t.TILDETRIM], tildeTrimReplace);
      debug("tilde trim", range2);
      range2 = range2.replace(re2[t.CARETTRIM], caretTrimReplace);
      debug("caret trim", range2);
      let rangeList = range2.split(" ").map((comp) => parseComparator(comp, this.options)).join(" ").split(/\s+/).map((comp) => replaceGTE0(comp, this.options));
      if (loose) {
        rangeList = rangeList.filter((comp) => {
          debug("loose invalid filter", comp, this.options);
          return !!comp.match(re2[t.COMPARATORLOOSE]);
        });
      }
      debug("range list", rangeList);
      const rangeMap = /* @__PURE__ */ new Map();
      const comparators = rangeList.map((comp) => new Comparator(comp, this.options));
      for (const comp of comparators) {
        if (isNullSet(comp)) {
          return [comp];
        }
        rangeMap.set(comp.value, comp);
      }
      if (rangeMap.size > 1 && rangeMap.has("")) {
        rangeMap.delete("");
      }
      const result = [...rangeMap.values()];
      cache.set(memoKey, result);
      return result;
    }
    intersects(range2, options) {
      if (!(range2 instanceof Range)) {
        throw new TypeError("a Range is required");
      }
      return this.set.some((thisComparators) => {
        return isSatisfiable(thisComparators, options) && range2.set.some((rangeComparators) => {
          return isSatisfiable(rangeComparators, options) && thisComparators.every((thisComparator) => {
            return rangeComparators.every((rangeComparator) => {
              return thisComparator.intersects(rangeComparator, options);
            });
          });
        });
      });
    }
    // if ANY of the sets match ALL of its comparators, then pass
    test(version) {
      if (!version) {
        return false;
      }
      if (typeof version === "string") {
        try {
          version = new SemVer(version, this.options);
        } catch (er) {
          return false;
        }
      }
      for (let i = 0; i < this.set.length; i++) {
        if (testSet(this.set[i], version, this.options)) {
          return true;
        }
      }
      return false;
    }
  }
  range = Range;
  const LRU = requireLrucache();
  const cache = new LRU();
  const parseOptions = requireParseOptions();
  const Comparator = requireComparator();
  const debug = requireDebug();
  const SemVer = requireSemver$1();
  const {
    safeRe: re2,
    t,
    comparatorTrimReplace,
    tildeTrimReplace,
    caretTrimReplace
  } = requireRe();
  const { FLAG_INCLUDE_PRERELEASE, FLAG_LOOSE } = requireConstants();
  const isNullSet = (c) => c.value === "<0.0.0-0";
  const isAny = (c) => c.value === "";
  const isSatisfiable = (comparators, options) => {
    let result = true;
    const remainingComparators = comparators.slice();
    let testComparator = remainingComparators.pop();
    while (result && remainingComparators.length) {
      result = remainingComparators.every((otherComparator) => {
        return testComparator.intersects(otherComparator, options);
      });
      testComparator = remainingComparators.pop();
    }
    return result;
  };
  const parseComparator = (comp, options) => {
    comp = comp.replace(re2[t.BUILD], "");
    debug("comp", comp, options);
    comp = replaceCarets(comp, options);
    debug("caret", comp);
    comp = replaceTildes(comp, options);
    debug("tildes", comp);
    comp = replaceXRanges(comp, options);
    debug("xrange", comp);
    comp = replaceStars(comp, options);
    debug("stars", comp);
    return comp;
  };
  const isX = (id) => !id || id.toLowerCase() === "x" || id === "*";
  const replaceTildes = (comp, options) => {
    return comp.trim().split(/\s+/).map((c) => replaceTilde(c, options)).join(" ");
  };
  const replaceTilde = (comp, options) => {
    const r = options.loose ? re2[t.TILDELOOSE] : re2[t.TILDE];
    return comp.replace(r, (_, M, m, p, pr) => {
      debug("tilde", comp, _, M, m, p, pr);
      let ret;
      if (isX(M)) {
        ret = "";
      } else if (isX(m)) {
        ret = `>=${M}.0.0 <${+M + 1}.0.0-0`;
      } else if (isX(p)) {
        ret = `>=${M}.${m}.0 <${M}.${+m + 1}.0-0`;
      } else if (pr) {
        debug("replaceTilde pr", pr);
        ret = `>=${M}.${m}.${p}-${pr} <${M}.${+m + 1}.0-0`;
      } else {
        ret = `>=${M}.${m}.${p} <${M}.${+m + 1}.0-0`;
      }
      debug("tilde return", ret);
      return ret;
    });
  };
  const replaceCarets = (comp, options) => {
    return comp.trim().split(/\s+/).map((c) => replaceCaret(c, options)).join(" ");
  };
  const replaceCaret = (comp, options) => {
    debug("caret", comp, options);
    const r = options.loose ? re2[t.CARETLOOSE] : re2[t.CARET];
    const z = options.includePrerelease ? "-0" : "";
    return comp.replace(r, (_, M, m, p, pr) => {
      debug("caret", comp, _, M, m, p, pr);
      let ret;
      if (isX(M)) {
        ret = "";
      } else if (isX(m)) {
        ret = `>=${M}.0.0${z} <${+M + 1}.0.0-0`;
      } else if (isX(p)) {
        if (M === "0") {
          ret = `>=${M}.${m}.0${z} <${M}.${+m + 1}.0-0`;
        } else {
          ret = `>=${M}.${m}.0${z} <${+M + 1}.0.0-0`;
        }
      } else if (pr) {
        debug("replaceCaret pr", pr);
        if (M === "0") {
          if (m === "0") {
            ret = `>=${M}.${m}.${p}-${pr} <${M}.${m}.${+p + 1}-0`;
          } else {
            ret = `>=${M}.${m}.${p}-${pr} <${M}.${+m + 1}.0-0`;
          }
        } else {
          ret = `>=${M}.${m}.${p}-${pr} <${+M + 1}.0.0-0`;
        }
      } else {
        debug("no pr");
        if (M === "0") {
          if (m === "0") {
            ret = `>=${M}.${m}.${p}${z} <${M}.${m}.${+p + 1}-0`;
          } else {
            ret = `>=${M}.${m}.${p}${z} <${M}.${+m + 1}.0-0`;
          }
        } else {
          ret = `>=${M}.${m}.${p} <${+M + 1}.0.0-0`;
        }
      }
      debug("caret return", ret);
      return ret;
    });
  };
  const replaceXRanges = (comp, options) => {
    debug("replaceXRanges", comp, options);
    return comp.split(/\s+/).map((c) => replaceXRange(c, options)).join(" ");
  };
  const replaceXRange = (comp, options) => {
    comp = comp.trim();
    const r = options.loose ? re2[t.XRANGELOOSE] : re2[t.XRANGE];
    return comp.replace(r, (ret, gtlt, M, m, p, pr) => {
      debug("xRange", comp, ret, gtlt, M, m, p, pr);
      const xM = isX(M);
      const xm = xM || isX(m);
      const xp = xm || isX(p);
      const anyX = xp;
      if (gtlt === "=" && anyX) {
        gtlt = "";
      }
      pr = options.includePrerelease ? "-0" : "";
      if (xM) {
        if (gtlt === ">" || gtlt === "<") {
          ret = "<0.0.0-0";
        } else {
          ret = "*";
        }
      } else if (gtlt && anyX) {
        if (xm) {
          m = 0;
        }
        p = 0;
        if (gtlt === ">") {
          gtlt = ">=";
          if (xm) {
            M = +M + 1;
            m = 0;
            p = 0;
          } else {
            m = +m + 1;
            p = 0;
          }
        } else if (gtlt === "<=") {
          gtlt = "<";
          if (xm) {
            M = +M + 1;
          } else {
            m = +m + 1;
          }
        }
        if (gtlt === "<") {
          pr = "-0";
        }
        ret = `${gtlt + M}.${m}.${p}${pr}`;
      } else if (xm) {
        ret = `>=${M}.0.0${pr} <${+M + 1}.0.0-0`;
      } else if (xp) {
        ret = `>=${M}.${m}.0${pr} <${M}.${+m + 1}.0-0`;
      }
      debug("xRange return", ret);
      return ret;
    });
  };
  const replaceStars = (comp, options) => {
    debug("replaceStars", comp, options);
    return comp.trim().replace(re2[t.STAR], "");
  };
  const replaceGTE0 = (comp, options) => {
    debug("replaceGTE0", comp, options);
    return comp.trim().replace(re2[options.includePrerelease ? t.GTE0PRE : t.GTE0], "");
  };
  const hyphenReplace = (incPr) => ($0, from, fM, fm, fp, fpr, fb, to, tM, tm, tp, tpr) => {
    if (isX(fM)) {
      from = "";
    } else if (isX(fm)) {
      from = `>=${fM}.0.0${incPr ? "-0" : ""}`;
    } else if (isX(fp)) {
      from = `>=${fM}.${fm}.0${incPr ? "-0" : ""}`;
    } else if (fpr) {
      from = `>=${from}`;
    } else {
      from = `>=${from}${incPr ? "-0" : ""}`;
    }
    if (isX(tM)) {
      to = "";
    } else if (isX(tm)) {
      to = `<${+tM + 1}.0.0-0`;
    } else if (isX(tp)) {
      to = `<${tM}.${+tm + 1}.0-0`;
    } else if (tpr) {
      to = `<=${tM}.${tm}.${tp}-${tpr}`;
    } else if (incPr) {
      to = `<${tM}.${tm}.${+tp + 1}-0`;
    } else {
      to = `<=${to}`;
    }
    return `${from} ${to}`.trim();
  };
  const testSet = (set, version, options) => {
    for (let i = 0; i < set.length; i++) {
      if (!set[i].test(version)) {
        return false;
      }
    }
    if (version.prerelease.length && !options.includePrerelease) {
      for (let i = 0; i < set.length; i++) {
        debug(set[i].semver);
        if (set[i].semver === Comparator.ANY) {
          continue;
        }
        if (set[i].semver.prerelease.length > 0) {
          const allowed = set[i].semver;
          if (allowed.major === version.major && allowed.minor === version.minor && allowed.patch === version.patch) {
            return true;
          }
        }
      }
      return false;
    }
    return true;
  };
  return range;
}
var comparator;
var hasRequiredComparator;
function requireComparator() {
  if (hasRequiredComparator) return comparator;
  hasRequiredComparator = 1;
  const ANY = /* @__PURE__ */ Symbol("SemVer ANY");
  class Comparator {
    static get ANY() {
      return ANY;
    }
    constructor(comp, options) {
      options = parseOptions(options);
      if (comp instanceof Comparator) {
        if (comp.loose === !!options.loose) {
          return comp;
        } else {
          comp = comp.value;
        }
      }
      comp = comp.trim().split(/\s+/).join(" ");
      debug("comparator", comp, options);
      this.options = options;
      this.loose = !!options.loose;
      this.parse(comp);
      if (this.semver === ANY) {
        this.value = "";
      } else {
        this.value = this.operator + this.semver.version;
      }
      debug("comp", this);
    }
    parse(comp) {
      const r = this.options.loose ? re2[t.COMPARATORLOOSE] : re2[t.COMPARATOR];
      const m = comp.match(r);
      if (!m) {
        throw new TypeError(`Invalid comparator: ${comp}`);
      }
      this.operator = m[1] !== void 0 ? m[1] : "";
      if (this.operator === "=") {
        this.operator = "";
      }
      if (!m[2]) {
        this.semver = ANY;
      } else {
        this.semver = new SemVer(m[2], this.options.loose);
      }
    }
    toString() {
      return this.value;
    }
    test(version) {
      debug("Comparator.test", version, this.options.loose);
      if (this.semver === ANY || version === ANY) {
        return true;
      }
      if (typeof version === "string") {
        try {
          version = new SemVer(version, this.options);
        } catch (er) {
          return false;
        }
      }
      return cmp(version, this.operator, this.semver, this.options);
    }
    intersects(comp, options) {
      if (!(comp instanceof Comparator)) {
        throw new TypeError("a Comparator is required");
      }
      if (this.operator === "") {
        if (this.value === "") {
          return true;
        }
        return new Range(comp.value, options).test(this.value);
      } else if (comp.operator === "") {
        if (comp.value === "") {
          return true;
        }
        return new Range(this.value, options).test(comp.semver);
      }
      options = parseOptions(options);
      if (options.includePrerelease && (this.value === "<0.0.0-0" || comp.value === "<0.0.0-0")) {
        return false;
      }
      if (!options.includePrerelease && (this.value.startsWith("<0.0.0") || comp.value.startsWith("<0.0.0"))) {
        return false;
      }
      if (this.operator.startsWith(">") && comp.operator.startsWith(">")) {
        return true;
      }
      if (this.operator.startsWith("<") && comp.operator.startsWith("<")) {
        return true;
      }
      if (this.semver.version === comp.semver.version && this.operator.includes("=") && comp.operator.includes("=")) {
        return true;
      }
      if (cmp(this.semver, "<", comp.semver, options) && this.operator.startsWith(">") && comp.operator.startsWith("<")) {
        return true;
      }
      if (cmp(this.semver, ">", comp.semver, options) && this.operator.startsWith("<") && comp.operator.startsWith(">")) {
        return true;
      }
      return false;
    }
  }
  comparator = Comparator;
  const parseOptions = requireParseOptions();
  const { safeRe: re2, t } = requireRe();
  const cmp = requireCmp();
  const debug = requireDebug();
  const SemVer = requireSemver$1();
  const Range = requireRange();
  return comparator;
}
var satisfies_1;
var hasRequiredSatisfies;
function requireSatisfies() {
  if (hasRequiredSatisfies) return satisfies_1;
  hasRequiredSatisfies = 1;
  const Range = requireRange();
  const satisfies = (version, range2, options) => {
    try {
      range2 = new Range(range2, options);
    } catch (er) {
      return false;
    }
    return range2.test(version);
  };
  satisfies_1 = satisfies;
  return satisfies_1;
}
var toComparators_1;
var hasRequiredToComparators;
function requireToComparators() {
  if (hasRequiredToComparators) return toComparators_1;
  hasRequiredToComparators = 1;
  const Range = requireRange();
  const toComparators = (range2, options) => new Range(range2, options).set.map((comp) => comp.map((c) => c.value).join(" ").trim().split(" "));
  toComparators_1 = toComparators;
  return toComparators_1;
}
var maxSatisfying_1;
var hasRequiredMaxSatisfying;
function requireMaxSatisfying() {
  if (hasRequiredMaxSatisfying) return maxSatisfying_1;
  hasRequiredMaxSatisfying = 1;
  const SemVer = requireSemver$1();
  const Range = requireRange();
  const maxSatisfying = (versions, range2, options) => {
    let max = null;
    let maxSV = null;
    let rangeObj = null;
    try {
      rangeObj = new Range(range2, options);
    } catch (er) {
      return null;
    }
    versions.forEach((v) => {
      if (rangeObj.test(v)) {
        if (!max || maxSV.compare(v) === -1) {
          max = v;
          maxSV = new SemVer(max, options);
        }
      }
    });
    return max;
  };
  maxSatisfying_1 = maxSatisfying;
  return maxSatisfying_1;
}
var minSatisfying_1;
var hasRequiredMinSatisfying;
function requireMinSatisfying() {
  if (hasRequiredMinSatisfying) return minSatisfying_1;
  hasRequiredMinSatisfying = 1;
  const SemVer = requireSemver$1();
  const Range = requireRange();
  const minSatisfying = (versions, range2, options) => {
    let min = null;
    let minSV = null;
    let rangeObj = null;
    try {
      rangeObj = new Range(range2, options);
    } catch (er) {
      return null;
    }
    versions.forEach((v) => {
      if (rangeObj.test(v)) {
        if (!min || minSV.compare(v) === 1) {
          min = v;
          minSV = new SemVer(min, options);
        }
      }
    });
    return min;
  };
  minSatisfying_1 = minSatisfying;
  return minSatisfying_1;
}
var minVersion_1;
var hasRequiredMinVersion;
function requireMinVersion() {
  if (hasRequiredMinVersion) return minVersion_1;
  hasRequiredMinVersion = 1;
  const SemVer = requireSemver$1();
  const Range = requireRange();
  const gt = requireGt();
  const minVersion = (range2, loose) => {
    range2 = new Range(range2, loose);
    let minver = new SemVer("0.0.0");
    if (range2.test(minver)) {
      return minver;
    }
    minver = new SemVer("0.0.0-0");
    if (range2.test(minver)) {
      return minver;
    }
    minver = null;
    for (let i = 0; i < range2.set.length; ++i) {
      const comparators = range2.set[i];
      let setMin = null;
      comparators.forEach((comparator2) => {
        const compver = new SemVer(comparator2.semver.version);
        switch (comparator2.operator) {
          case ">":
            if (compver.prerelease.length === 0) {
              compver.patch++;
            } else {
              compver.prerelease.push(0);
            }
            compver.raw = compver.format();
          /* fallthrough */
          case "":
          case ">=":
            if (!setMin || gt(compver, setMin)) {
              setMin = compver;
            }
            break;
          case "<":
          case "<=":
            break;
          /* istanbul ignore next */
          default:
            throw new Error(`Unexpected operation: ${comparator2.operator}`);
        }
      });
      if (setMin && (!minver || gt(minver, setMin))) {
        minver = setMin;
      }
    }
    if (minver && range2.test(minver)) {
      return minver;
    }
    return null;
  };
  minVersion_1 = minVersion;
  return minVersion_1;
}
var valid;
var hasRequiredValid;
function requireValid() {
  if (hasRequiredValid) return valid;
  hasRequiredValid = 1;
  const Range = requireRange();
  const validRange = (range2, options) => {
    try {
      return new Range(range2, options).range || "*";
    } catch (er) {
      return null;
    }
  };
  valid = validRange;
  return valid;
}
var outside_1;
var hasRequiredOutside;
function requireOutside() {
  if (hasRequiredOutside) return outside_1;
  hasRequiredOutside = 1;
  const SemVer = requireSemver$1();
  const Comparator = requireComparator();
  const { ANY } = Comparator;
  const Range = requireRange();
  const satisfies = requireSatisfies();
  const gt = requireGt();
  const lt = requireLt();
  const lte = requireLte();
  const gte = requireGte();
  const outside = (version, range2, hilo, options) => {
    version = new SemVer(version, options);
    range2 = new Range(range2, options);
    let gtfn, ltefn, ltfn, comp, ecomp;
    switch (hilo) {
      case ">":
        gtfn = gt;
        ltefn = lte;
        ltfn = lt;
        comp = ">";
        ecomp = ">=";
        break;
      case "<":
        gtfn = lt;
        ltefn = gte;
        ltfn = gt;
        comp = "<";
        ecomp = "<=";
        break;
      default:
        throw new TypeError('Must provide a hilo val of "<" or ">"');
    }
    if (satisfies(version, range2, options)) {
      return false;
    }
    for (let i = 0; i < range2.set.length; ++i) {
      const comparators = range2.set[i];
      let high = null;
      let low = null;
      comparators.forEach((comparator2) => {
        if (comparator2.semver === ANY) {
          comparator2 = new Comparator(">=0.0.0");
        }
        high = high || comparator2;
        low = low || comparator2;
        if (gtfn(comparator2.semver, high.semver, options)) {
          high = comparator2;
        } else if (ltfn(comparator2.semver, low.semver, options)) {
          low = comparator2;
        }
      });
      if (high.operator === comp || high.operator === ecomp) {
        return false;
      }
      if ((!low.operator || low.operator === comp) && ltefn(version, low.semver)) {
        return false;
      } else if (low.operator === ecomp && ltfn(version, low.semver)) {
        return false;
      }
    }
    return true;
  };
  outside_1 = outside;
  return outside_1;
}
var gtr_1;
var hasRequiredGtr;
function requireGtr() {
  if (hasRequiredGtr) return gtr_1;
  hasRequiredGtr = 1;
  const outside = requireOutside();
  const gtr = (version, range2, options) => outside(version, range2, ">", options);
  gtr_1 = gtr;
  return gtr_1;
}
var ltr_1;
var hasRequiredLtr;
function requireLtr() {
  if (hasRequiredLtr) return ltr_1;
  hasRequiredLtr = 1;
  const outside = requireOutside();
  const ltr = (version, range2, options) => outside(version, range2, "<", options);
  ltr_1 = ltr;
  return ltr_1;
}
var intersects_1;
var hasRequiredIntersects;
function requireIntersects() {
  if (hasRequiredIntersects) return intersects_1;
  hasRequiredIntersects = 1;
  const Range = requireRange();
  const intersects = (r1, r2, options) => {
    r1 = new Range(r1, options);
    r2 = new Range(r2, options);
    return r1.intersects(r2, options);
  };
  intersects_1 = intersects;
  return intersects_1;
}
var simplify;
var hasRequiredSimplify;
function requireSimplify() {
  if (hasRequiredSimplify) return simplify;
  hasRequiredSimplify = 1;
  const satisfies = requireSatisfies();
  const compare = requireCompare();
  simplify = (versions, range2, options) => {
    const set = [];
    let first = null;
    let prev = null;
    const v = versions.sort((a, b) => compare(a, b, options));
    for (const version of v) {
      const included = satisfies(version, range2, options);
      if (included) {
        prev = version;
        if (!first) {
          first = version;
        }
      } else {
        if (prev) {
          set.push([first, prev]);
        }
        prev = null;
        first = null;
      }
    }
    if (first) {
      set.push([first, null]);
    }
    const ranges = [];
    for (const [min, max] of set) {
      if (min === max) {
        ranges.push(min);
      } else if (!max && min === v[0]) {
        ranges.push("*");
      } else if (!max) {
        ranges.push(`>=${min}`);
      } else if (min === v[0]) {
        ranges.push(`<=${max}`);
      } else {
        ranges.push(`${min} - ${max}`);
      }
    }
    const simplified = ranges.join(" || ");
    const original = typeof range2.raw === "string" ? range2.raw : String(range2);
    return simplified.length < original.length ? simplified : range2;
  };
  return simplify;
}
var subset_1;
var hasRequiredSubset;
function requireSubset() {
  if (hasRequiredSubset) return subset_1;
  hasRequiredSubset = 1;
  const Range = requireRange();
  const Comparator = requireComparator();
  const { ANY } = Comparator;
  const satisfies = requireSatisfies();
  const compare = requireCompare();
  const subset = (sub, dom, options = {}) => {
    if (sub === dom) {
      return true;
    }
    sub = new Range(sub, options);
    dom = new Range(dom, options);
    let sawNonNull = false;
    OUTER: for (const simpleSub of sub.set) {
      for (const simpleDom of dom.set) {
        const isSub = simpleSubset(simpleSub, simpleDom, options);
        sawNonNull = sawNonNull || isSub !== null;
        if (isSub) {
          continue OUTER;
        }
      }
      if (sawNonNull) {
        return false;
      }
    }
    return true;
  };
  const minimumVersionWithPreRelease = [new Comparator(">=0.0.0-0")];
  const minimumVersion = [new Comparator(">=0.0.0")];
  const simpleSubset = (sub, dom, options) => {
    if (sub === dom) {
      return true;
    }
    if (sub.length === 1 && sub[0].semver === ANY) {
      if (dom.length === 1 && dom[0].semver === ANY) {
        return true;
      } else if (options.includePrerelease) {
        sub = minimumVersionWithPreRelease;
      } else {
        sub = minimumVersion;
      }
    }
    if (dom.length === 1 && dom[0].semver === ANY) {
      if (options.includePrerelease) {
        return true;
      } else {
        dom = minimumVersion;
      }
    }
    const eqSet = /* @__PURE__ */ new Set();
    let gt, lt;
    for (const c of sub) {
      if (c.operator === ">" || c.operator === ">=") {
        gt = higherGT(gt, c, options);
      } else if (c.operator === "<" || c.operator === "<=") {
        lt = lowerLT(lt, c, options);
      } else {
        eqSet.add(c.semver);
      }
    }
    if (eqSet.size > 1) {
      return null;
    }
    let gtltComp;
    if (gt && lt) {
      gtltComp = compare(gt.semver, lt.semver, options);
      if (gtltComp > 0) {
        return null;
      } else if (gtltComp === 0 && (gt.operator !== ">=" || lt.operator !== "<=")) {
        return null;
      }
    }
    for (const eq of eqSet) {
      if (gt && !satisfies(eq, String(gt), options)) {
        return null;
      }
      if (lt && !satisfies(eq, String(lt), options)) {
        return null;
      }
      for (const c of dom) {
        if (!satisfies(eq, String(c), options)) {
          return false;
        }
      }
      return true;
    }
    let higher, lower;
    let hasDomLT, hasDomGT;
    let needDomLTPre = lt && !options.includePrerelease && lt.semver.prerelease.length ? lt.semver : false;
    let needDomGTPre = gt && !options.includePrerelease && gt.semver.prerelease.length ? gt.semver : false;
    if (needDomLTPre && needDomLTPre.prerelease.length === 1 && lt.operator === "<" && needDomLTPre.prerelease[0] === 0) {
      needDomLTPre = false;
    }
    for (const c of dom) {
      hasDomGT = hasDomGT || c.operator === ">" || c.operator === ">=";
      hasDomLT = hasDomLT || c.operator === "<" || c.operator === "<=";
      if (gt) {
        if (needDomGTPre) {
          if (c.semver.prerelease && c.semver.prerelease.length && c.semver.major === needDomGTPre.major && c.semver.minor === needDomGTPre.minor && c.semver.patch === needDomGTPre.patch) {
            needDomGTPre = false;
          }
        }
        if (c.operator === ">" || c.operator === ">=") {
          higher = higherGT(gt, c, options);
          if (higher === c && higher !== gt) {
            return false;
          }
        } else if (gt.operator === ">=" && !satisfies(gt.semver, String(c), options)) {
          return false;
        }
      }
      if (lt) {
        if (needDomLTPre) {
          if (c.semver.prerelease && c.semver.prerelease.length && c.semver.major === needDomLTPre.major && c.semver.minor === needDomLTPre.minor && c.semver.patch === needDomLTPre.patch) {
            needDomLTPre = false;
          }
        }
        if (c.operator === "<" || c.operator === "<=") {
          lower = lowerLT(lt, c, options);
          if (lower === c && lower !== lt) {
            return false;
          }
        } else if (lt.operator === "<=" && !satisfies(lt.semver, String(c), options)) {
          return false;
        }
      }
      if (!c.operator && (lt || gt) && gtltComp !== 0) {
        return false;
      }
    }
    if (gt && hasDomLT && !lt && gtltComp !== 0) {
      return false;
    }
    if (lt && hasDomGT && !gt && gtltComp !== 0) {
      return false;
    }
    if (needDomGTPre || needDomLTPre) {
      return false;
    }
    return true;
  };
  const higherGT = (a, b, options) => {
    if (!a) {
      return b;
    }
    const comp = compare(a.semver, b.semver, options);
    return comp > 0 ? a : comp < 0 ? b : b.operator === ">" && a.operator === ">=" ? b : a;
  };
  const lowerLT = (a, b, options) => {
    if (!a) {
      return b;
    }
    const comp = compare(a.semver, b.semver, options);
    return comp < 0 ? a : comp > 0 ? b : b.operator === "<" && a.operator === "<=" ? b : a;
  };
  subset_1 = subset;
  return subset_1;
}
var semver;
var hasRequiredSemver;
function requireSemver() {
  if (hasRequiredSemver) return semver;
  hasRequiredSemver = 1;
  const internalRe = requireRe();
  const constants2 = requireConstants();
  const SemVer = requireSemver$1();
  const identifiers2 = requireIdentifiers();
  const parse = requireParse();
  const valid2 = requireValid$1();
  const clean = requireClean();
  const inc = requireInc();
  const diff = requireDiff();
  const major = requireMajor();
  const minor = requireMinor();
  const patch = requirePatch();
  const prerelease = requirePrerelease();
  const compare = requireCompare();
  const rcompare = requireRcompare();
  const compareLoose = requireCompareLoose();
  const compareBuild = requireCompareBuild();
  const sort = requireSort();
  const rsort = requireRsort();
  const gt = requireGt();
  const lt = requireLt();
  const eq = requireEq();
  const neq = requireNeq();
  const gte = requireGte();
  const lte = requireLte();
  const cmp = requireCmp();
  const coerce = requireCoerce();
  const Comparator = requireComparator();
  const Range = requireRange();
  const satisfies = requireSatisfies();
  const toComparators = requireToComparators();
  const maxSatisfying = requireMaxSatisfying();
  const minSatisfying = requireMinSatisfying();
  const minVersion = requireMinVersion();
  const validRange = requireValid();
  const outside = requireOutside();
  const gtr = requireGtr();
  const ltr = requireLtr();
  const intersects = requireIntersects();
  const simplifyRange = requireSimplify();
  const subset = requireSubset();
  semver = {
    parse,
    valid: valid2,
    clean,
    inc,
    diff,
    major,
    minor,
    patch,
    prerelease,
    compare,
    rcompare,
    compareLoose,
    compareBuild,
    sort,
    rsort,
    gt,
    lt,
    eq,
    neq,
    gte,
    lte,
    cmp,
    coerce,
    Comparator,
    Range,
    satisfies,
    toComparators,
    maxSatisfying,
    minSatisfying,
    minVersion,
    validRange,
    outside,
    gtr,
    ltr,
    intersects,
    simplifyRange,
    subset,
    SemVer,
    re: internalRe.re,
    src: internalRe.src,
    tokens: internalRe.t,
    SEMVER_SPEC_VERSION: constants2.SEMVER_SPEC_VERSION,
    RELEASE_TYPES: constants2.RELEASE_TYPES,
    compareIdentifiers: identifiers2.compareIdentifiers,
    rcompareIdentifiers: identifiers2.rcompareIdentifiers
  };
  return semver;
}
var DownloadedUpdateHelper = {};
var lodash_isequal = { exports: {} };
lodash_isequal.exports;
var hasRequiredLodash_isequal;
function requireLodash_isequal() {
  if (hasRequiredLodash_isequal) return lodash_isequal.exports;
  hasRequiredLodash_isequal = 1;
  (function(module2, exports2) {
    var LARGE_ARRAY_SIZE = 200;
    var HASH_UNDEFINED = "__lodash_hash_undefined__";
    var COMPARE_PARTIAL_FLAG = 1, COMPARE_UNORDERED_FLAG = 2;
    var MAX_SAFE_INTEGER = 9007199254740991;
    var argsTag = "[object Arguments]", arrayTag = "[object Array]", asyncTag = "[object AsyncFunction]", boolTag = "[object Boolean]", dateTag = "[object Date]", errorTag = "[object Error]", funcTag = "[object Function]", genTag = "[object GeneratorFunction]", mapTag = "[object Map]", numberTag = "[object Number]", nullTag = "[object Null]", objectTag = "[object Object]", promiseTag = "[object Promise]", proxyTag = "[object Proxy]", regexpTag = "[object RegExp]", setTag = "[object Set]", stringTag = "[object String]", symbolTag = "[object Symbol]", undefinedTag = "[object Undefined]", weakMapTag = "[object WeakMap]";
    var arrayBufferTag = "[object ArrayBuffer]", dataViewTag = "[object DataView]", float32Tag = "[object Float32Array]", float64Tag = "[object Float64Array]", int8Tag = "[object Int8Array]", int16Tag = "[object Int16Array]", int32Tag = "[object Int32Array]", uint8Tag = "[object Uint8Array]", uint8ClampedTag = "[object Uint8ClampedArray]", uint16Tag = "[object Uint16Array]", uint32Tag = "[object Uint32Array]";
    var reRegExpChar = /[\\^$.*+?()[\]{}|]/g;
    var reIsHostCtor = /^\[object .+?Constructor\]$/;
    var reIsUint = /^(?:0|[1-9]\d*)$/;
    var typedArrayTags = {};
    typedArrayTags[float32Tag] = typedArrayTags[float64Tag] = typedArrayTags[int8Tag] = typedArrayTags[int16Tag] = typedArrayTags[int32Tag] = typedArrayTags[uint8Tag] = typedArrayTags[uint8ClampedTag] = typedArrayTags[uint16Tag] = typedArrayTags[uint32Tag] = true;
    typedArrayTags[argsTag] = typedArrayTags[arrayTag] = typedArrayTags[arrayBufferTag] = typedArrayTags[boolTag] = typedArrayTags[dataViewTag] = typedArrayTags[dateTag] = typedArrayTags[errorTag] = typedArrayTags[funcTag] = typedArrayTags[mapTag] = typedArrayTags[numberTag] = typedArrayTags[objectTag] = typedArrayTags[regexpTag] = typedArrayTags[setTag] = typedArrayTags[stringTag] = typedArrayTags[weakMapTag] = false;
    var freeGlobal = typeof commonjsGlobal == "object" && commonjsGlobal && commonjsGlobal.Object === Object && commonjsGlobal;
    var freeSelf = typeof self == "object" && self && self.Object === Object && self;
    var root = freeGlobal || freeSelf || Function("return this")();
    var freeExports = exports2 && !exports2.nodeType && exports2;
    var freeModule = freeExports && true && module2 && !module2.nodeType && module2;
    var moduleExports = freeModule && freeModule.exports === freeExports;
    var freeProcess = moduleExports && freeGlobal.process;
    var nodeUtil = (function() {
      try {
        return freeProcess && freeProcess.binding && freeProcess.binding("util");
      } catch (e) {
      }
    })();
    var nodeIsTypedArray = nodeUtil && nodeUtil.isTypedArray;
    function arrayFilter(array, predicate) {
      var index2 = -1, length = array == null ? 0 : array.length, resIndex = 0, result = [];
      while (++index2 < length) {
        var value = array[index2];
        if (predicate(value, index2, array)) {
          result[resIndex++] = value;
        }
      }
      return result;
    }
    function arrayPush(array, values) {
      var index2 = -1, length = values.length, offset = array.length;
      while (++index2 < length) {
        array[offset + index2] = values[index2];
      }
      return array;
    }
    function arraySome(array, predicate) {
      var index2 = -1, length = array == null ? 0 : array.length;
      while (++index2 < length) {
        if (predicate(array[index2], index2, array)) {
          return true;
        }
      }
      return false;
    }
    function baseTimes(n, iteratee) {
      var index2 = -1, result = Array(n);
      while (++index2 < n) {
        result[index2] = iteratee(index2);
      }
      return result;
    }
    function baseUnary(func) {
      return function(value) {
        return func(value);
      };
    }
    function cacheHas(cache, key) {
      return cache.has(key);
    }
    function getValue(object, key) {
      return object == null ? void 0 : object[key];
    }
    function mapToArray(map) {
      var index2 = -1, result = Array(map.size);
      map.forEach(function(value, key) {
        result[++index2] = [key, value];
      });
      return result;
    }
    function overArg(func, transform) {
      return function(arg) {
        return func(transform(arg));
      };
    }
    function setToArray(set) {
      var index2 = -1, result = Array(set.size);
      set.forEach(function(value) {
        result[++index2] = value;
      });
      return result;
    }
    var arrayProto = Array.prototype, funcProto = Function.prototype, objectProto = Object.prototype;
    var coreJsData = root["__core-js_shared__"];
    var funcToString = funcProto.toString;
    var hasOwnProperty = objectProto.hasOwnProperty;
    var maskSrcKey = (function() {
      var uid = /[^.]+$/.exec(coreJsData && coreJsData.keys && coreJsData.keys.IE_PROTO || "");
      return uid ? "Symbol(src)_1." + uid : "";
    })();
    var nativeObjectToString = objectProto.toString;
    var reIsNative = RegExp(
      "^" + funcToString.call(hasOwnProperty).replace(reRegExpChar, "\\$&").replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, "$1.*?") + "$"
    );
    var Buffer2 = moduleExports ? root.Buffer : void 0, Symbol2 = root.Symbol, Uint8Array2 = root.Uint8Array, propertyIsEnumerable = objectProto.propertyIsEnumerable, splice = arrayProto.splice, symToStringTag = Symbol2 ? Symbol2.toStringTag : void 0;
    var nativeGetSymbols = Object.getOwnPropertySymbols, nativeIsBuffer = Buffer2 ? Buffer2.isBuffer : void 0, nativeKeys = overArg(Object.keys, Object);
    var DataView = getNative(root, "DataView"), Map2 = getNative(root, "Map"), Promise2 = getNative(root, "Promise"), Set2 = getNative(root, "Set"), WeakMap = getNative(root, "WeakMap"), nativeCreate = getNative(Object, "create");
    var dataViewCtorString = toSource(DataView), mapCtorString = toSource(Map2), promiseCtorString = toSource(Promise2), setCtorString = toSource(Set2), weakMapCtorString = toSource(WeakMap);
    var symbolProto = Symbol2 ? Symbol2.prototype : void 0, symbolValueOf = symbolProto ? symbolProto.valueOf : void 0;
    function Hash(entries) {
      var index2 = -1, length = entries == null ? 0 : entries.length;
      this.clear();
      while (++index2 < length) {
        var entry = entries[index2];
        this.set(entry[0], entry[1]);
      }
    }
    function hashClear() {
      this.__data__ = nativeCreate ? nativeCreate(null) : {};
      this.size = 0;
    }
    function hashDelete(key) {
      var result = this.has(key) && delete this.__data__[key];
      this.size -= result ? 1 : 0;
      return result;
    }
    function hashGet(key) {
      var data = this.__data__;
      if (nativeCreate) {
        var result = data[key];
        return result === HASH_UNDEFINED ? void 0 : result;
      }
      return hasOwnProperty.call(data, key) ? data[key] : void 0;
    }
    function hashHas(key) {
      var data = this.__data__;
      return nativeCreate ? data[key] !== void 0 : hasOwnProperty.call(data, key);
    }
    function hashSet(key, value) {
      var data = this.__data__;
      this.size += this.has(key) ? 0 : 1;
      data[key] = nativeCreate && value === void 0 ? HASH_UNDEFINED : value;
      return this;
    }
    Hash.prototype.clear = hashClear;
    Hash.prototype["delete"] = hashDelete;
    Hash.prototype.get = hashGet;
    Hash.prototype.has = hashHas;
    Hash.prototype.set = hashSet;
    function ListCache(entries) {
      var index2 = -1, length = entries == null ? 0 : entries.length;
      this.clear();
      while (++index2 < length) {
        var entry = entries[index2];
        this.set(entry[0], entry[1]);
      }
    }
    function listCacheClear() {
      this.__data__ = [];
      this.size = 0;
    }
    function listCacheDelete(key) {
      var data = this.__data__, index2 = assocIndexOf(data, key);
      if (index2 < 0) {
        return false;
      }
      var lastIndex = data.length - 1;
      if (index2 == lastIndex) {
        data.pop();
      } else {
        splice.call(data, index2, 1);
      }
      --this.size;
      return true;
    }
    function listCacheGet(key) {
      var data = this.__data__, index2 = assocIndexOf(data, key);
      return index2 < 0 ? void 0 : data[index2][1];
    }
    function listCacheHas(key) {
      return assocIndexOf(this.__data__, key) > -1;
    }
    function listCacheSet(key, value) {
      var data = this.__data__, index2 = assocIndexOf(data, key);
      if (index2 < 0) {
        ++this.size;
        data.push([key, value]);
      } else {
        data[index2][1] = value;
      }
      return this;
    }
    ListCache.prototype.clear = listCacheClear;
    ListCache.prototype["delete"] = listCacheDelete;
    ListCache.prototype.get = listCacheGet;
    ListCache.prototype.has = listCacheHas;
    ListCache.prototype.set = listCacheSet;
    function MapCache(entries) {
      var index2 = -1, length = entries == null ? 0 : entries.length;
      this.clear();
      while (++index2 < length) {
        var entry = entries[index2];
        this.set(entry[0], entry[1]);
      }
    }
    function mapCacheClear() {
      this.size = 0;
      this.__data__ = {
        "hash": new Hash(),
        "map": new (Map2 || ListCache)(),
        "string": new Hash()
      };
    }
    function mapCacheDelete(key) {
      var result = getMapData(this, key)["delete"](key);
      this.size -= result ? 1 : 0;
      return result;
    }
    function mapCacheGet(key) {
      return getMapData(this, key).get(key);
    }
    function mapCacheHas(key) {
      return getMapData(this, key).has(key);
    }
    function mapCacheSet(key, value) {
      var data = getMapData(this, key), size = data.size;
      data.set(key, value);
      this.size += data.size == size ? 0 : 1;
      return this;
    }
    MapCache.prototype.clear = mapCacheClear;
    MapCache.prototype["delete"] = mapCacheDelete;
    MapCache.prototype.get = mapCacheGet;
    MapCache.prototype.has = mapCacheHas;
    MapCache.prototype.set = mapCacheSet;
    function SetCache(values) {
      var index2 = -1, length = values == null ? 0 : values.length;
      this.__data__ = new MapCache();
      while (++index2 < length) {
        this.add(values[index2]);
      }
    }
    function setCacheAdd(value) {
      this.__data__.set(value, HASH_UNDEFINED);
      return this;
    }
    function setCacheHas(value) {
      return this.__data__.has(value);
    }
    SetCache.prototype.add = SetCache.prototype.push = setCacheAdd;
    SetCache.prototype.has = setCacheHas;
    function Stack(entries) {
      var data = this.__data__ = new ListCache(entries);
      this.size = data.size;
    }
    function stackClear() {
      this.__data__ = new ListCache();
      this.size = 0;
    }
    function stackDelete(key) {
      var data = this.__data__, result = data["delete"](key);
      this.size = data.size;
      return result;
    }
    function stackGet(key) {
      return this.__data__.get(key);
    }
    function stackHas(key) {
      return this.__data__.has(key);
    }
    function stackSet(key, value) {
      var data = this.__data__;
      if (data instanceof ListCache) {
        var pairs = data.__data__;
        if (!Map2 || pairs.length < LARGE_ARRAY_SIZE - 1) {
          pairs.push([key, value]);
          this.size = ++data.size;
          return this;
        }
        data = this.__data__ = new MapCache(pairs);
      }
      data.set(key, value);
      this.size = data.size;
      return this;
    }
    Stack.prototype.clear = stackClear;
    Stack.prototype["delete"] = stackDelete;
    Stack.prototype.get = stackGet;
    Stack.prototype.has = stackHas;
    Stack.prototype.set = stackSet;
    function arrayLikeKeys(value, inherited) {
      var isArr = isArray(value), isArg = !isArr && isArguments(value), isBuff = !isArr && !isArg && isBuffer(value), isType = !isArr && !isArg && !isBuff && isTypedArray(value), skipIndexes = isArr || isArg || isBuff || isType, result = skipIndexes ? baseTimes(value.length, String) : [], length = result.length;
      for (var key in value) {
        if (hasOwnProperty.call(value, key) && !(skipIndexes && // Safari 9 has enumerable `arguments.length` in strict mode.
        (key == "length" || // Node.js 0.10 has enumerable non-index properties on buffers.
        isBuff && (key == "offset" || key == "parent") || // PhantomJS 2 has enumerable non-index properties on typed arrays.
        isType && (key == "buffer" || key == "byteLength" || key == "byteOffset") || // Skip index properties.
        isIndex(key, length)))) {
          result.push(key);
        }
      }
      return result;
    }
    function assocIndexOf(array, key) {
      var length = array.length;
      while (length--) {
        if (eq(array[length][0], key)) {
          return length;
        }
      }
      return -1;
    }
    function baseGetAllKeys(object, keysFunc, symbolsFunc) {
      var result = keysFunc(object);
      return isArray(object) ? result : arrayPush(result, symbolsFunc(object));
    }
    function baseGetTag(value) {
      if (value == null) {
        return value === void 0 ? undefinedTag : nullTag;
      }
      return symToStringTag && symToStringTag in Object(value) ? getRawTag(value) : objectToString(value);
    }
    function baseIsArguments(value) {
      return isObjectLike(value) && baseGetTag(value) == argsTag;
    }
    function baseIsEqual(value, other, bitmask, customizer, stack) {
      if (value === other) {
        return true;
      }
      if (value == null || other == null || !isObjectLike(value) && !isObjectLike(other)) {
        return value !== value && other !== other;
      }
      return baseIsEqualDeep(value, other, bitmask, customizer, baseIsEqual, stack);
    }
    function baseIsEqualDeep(object, other, bitmask, customizer, equalFunc, stack) {
      var objIsArr = isArray(object), othIsArr = isArray(other), objTag = objIsArr ? arrayTag : getTag(object), othTag = othIsArr ? arrayTag : getTag(other);
      objTag = objTag == argsTag ? objectTag : objTag;
      othTag = othTag == argsTag ? objectTag : othTag;
      var objIsObj = objTag == objectTag, othIsObj = othTag == objectTag, isSameTag = objTag == othTag;
      if (isSameTag && isBuffer(object)) {
        if (!isBuffer(other)) {
          return false;
        }
        objIsArr = true;
        objIsObj = false;
      }
      if (isSameTag && !objIsObj) {
        stack || (stack = new Stack());
        return objIsArr || isTypedArray(object) ? equalArrays(object, other, bitmask, customizer, equalFunc, stack) : equalByTag(object, other, objTag, bitmask, customizer, equalFunc, stack);
      }
      if (!(bitmask & COMPARE_PARTIAL_FLAG)) {
        var objIsWrapped = objIsObj && hasOwnProperty.call(object, "__wrapped__"), othIsWrapped = othIsObj && hasOwnProperty.call(other, "__wrapped__");
        if (objIsWrapped || othIsWrapped) {
          var objUnwrapped = objIsWrapped ? object.value() : object, othUnwrapped = othIsWrapped ? other.value() : other;
          stack || (stack = new Stack());
          return equalFunc(objUnwrapped, othUnwrapped, bitmask, customizer, stack);
        }
      }
      if (!isSameTag) {
        return false;
      }
      stack || (stack = new Stack());
      return equalObjects(object, other, bitmask, customizer, equalFunc, stack);
    }
    function baseIsNative(value) {
      if (!isObject(value) || isMasked(value)) {
        return false;
      }
      var pattern = isFunction(value) ? reIsNative : reIsHostCtor;
      return pattern.test(toSource(value));
    }
    function baseIsTypedArray(value) {
      return isObjectLike(value) && isLength(value.length) && !!typedArrayTags[baseGetTag(value)];
    }
    function baseKeys(object) {
      if (!isPrototype(object)) {
        return nativeKeys(object);
      }
      var result = [];
      for (var key in Object(object)) {
        if (hasOwnProperty.call(object, key) && key != "constructor") {
          result.push(key);
        }
      }
      return result;
    }
    function equalArrays(array, other, bitmask, customizer, equalFunc, stack) {
      var isPartial = bitmask & COMPARE_PARTIAL_FLAG, arrLength = array.length, othLength = other.length;
      if (arrLength != othLength && !(isPartial && othLength > arrLength)) {
        return false;
      }
      var stacked = stack.get(array);
      if (stacked && stack.get(other)) {
        return stacked == other;
      }
      var index2 = -1, result = true, seen = bitmask & COMPARE_UNORDERED_FLAG ? new SetCache() : void 0;
      stack.set(array, other);
      stack.set(other, array);
      while (++index2 < arrLength) {
        var arrValue = array[index2], othValue = other[index2];
        if (customizer) {
          var compared = isPartial ? customizer(othValue, arrValue, index2, other, array, stack) : customizer(arrValue, othValue, index2, array, other, stack);
        }
        if (compared !== void 0) {
          if (compared) {
            continue;
          }
          result = false;
          break;
        }
        if (seen) {
          if (!arraySome(other, function(othValue2, othIndex) {
            if (!cacheHas(seen, othIndex) && (arrValue === othValue2 || equalFunc(arrValue, othValue2, bitmask, customizer, stack))) {
              return seen.push(othIndex);
            }
          })) {
            result = false;
            break;
          }
        } else if (!(arrValue === othValue || equalFunc(arrValue, othValue, bitmask, customizer, stack))) {
          result = false;
          break;
        }
      }
      stack["delete"](array);
      stack["delete"](other);
      return result;
    }
    function equalByTag(object, other, tag, bitmask, customizer, equalFunc, stack) {
      switch (tag) {
        case dataViewTag:
          if (object.byteLength != other.byteLength || object.byteOffset != other.byteOffset) {
            return false;
          }
          object = object.buffer;
          other = other.buffer;
        case arrayBufferTag:
          if (object.byteLength != other.byteLength || !equalFunc(new Uint8Array2(object), new Uint8Array2(other))) {
            return false;
          }
          return true;
        case boolTag:
        case dateTag:
        case numberTag:
          return eq(+object, +other);
        case errorTag:
          return object.name == other.name && object.message == other.message;
        case regexpTag:
        case stringTag:
          return object == other + "";
        case mapTag:
          var convert = mapToArray;
        case setTag:
          var isPartial = bitmask & COMPARE_PARTIAL_FLAG;
          convert || (convert = setToArray);
          if (object.size != other.size && !isPartial) {
            return false;
          }
          var stacked = stack.get(object);
          if (stacked) {
            return stacked == other;
          }
          bitmask |= COMPARE_UNORDERED_FLAG;
          stack.set(object, other);
          var result = equalArrays(convert(object), convert(other), bitmask, customizer, equalFunc, stack);
          stack["delete"](object);
          return result;
        case symbolTag:
          if (symbolValueOf) {
            return symbolValueOf.call(object) == symbolValueOf.call(other);
          }
      }
      return false;
    }
    function equalObjects(object, other, bitmask, customizer, equalFunc, stack) {
      var isPartial = bitmask & COMPARE_PARTIAL_FLAG, objProps = getAllKeys(object), objLength = objProps.length, othProps = getAllKeys(other), othLength = othProps.length;
      if (objLength != othLength && !isPartial) {
        return false;
      }
      var index2 = objLength;
      while (index2--) {
        var key = objProps[index2];
        if (!(isPartial ? key in other : hasOwnProperty.call(other, key))) {
          return false;
        }
      }
      var stacked = stack.get(object);
      if (stacked && stack.get(other)) {
        return stacked == other;
      }
      var result = true;
      stack.set(object, other);
      stack.set(other, object);
      var skipCtor = isPartial;
      while (++index2 < objLength) {
        key = objProps[index2];
        var objValue = object[key], othValue = other[key];
        if (customizer) {
          var compared = isPartial ? customizer(othValue, objValue, key, other, object, stack) : customizer(objValue, othValue, key, object, other, stack);
        }
        if (!(compared === void 0 ? objValue === othValue || equalFunc(objValue, othValue, bitmask, customizer, stack) : compared)) {
          result = false;
          break;
        }
        skipCtor || (skipCtor = key == "constructor");
      }
      if (result && !skipCtor) {
        var objCtor = object.constructor, othCtor = other.constructor;
        if (objCtor != othCtor && ("constructor" in object && "constructor" in other) && !(typeof objCtor == "function" && objCtor instanceof objCtor && typeof othCtor == "function" && othCtor instanceof othCtor)) {
          result = false;
        }
      }
      stack["delete"](object);
      stack["delete"](other);
      return result;
    }
    function getAllKeys(object) {
      return baseGetAllKeys(object, keys, getSymbols);
    }
    function getMapData(map, key) {
      var data = map.__data__;
      return isKeyable(key) ? data[typeof key == "string" ? "string" : "hash"] : data.map;
    }
    function getNative(object, key) {
      var value = getValue(object, key);
      return baseIsNative(value) ? value : void 0;
    }
    function getRawTag(value) {
      var isOwn = hasOwnProperty.call(value, symToStringTag), tag = value[symToStringTag];
      try {
        value[symToStringTag] = void 0;
        var unmasked = true;
      } catch (e) {
      }
      var result = nativeObjectToString.call(value);
      if (unmasked) {
        if (isOwn) {
          value[symToStringTag] = tag;
        } else {
          delete value[symToStringTag];
        }
      }
      return result;
    }
    var getSymbols = !nativeGetSymbols ? stubArray : function(object) {
      if (object == null) {
        return [];
      }
      object = Object(object);
      return arrayFilter(nativeGetSymbols(object), function(symbol) {
        return propertyIsEnumerable.call(object, symbol);
      });
    };
    var getTag = baseGetTag;
    if (DataView && getTag(new DataView(new ArrayBuffer(1))) != dataViewTag || Map2 && getTag(new Map2()) != mapTag || Promise2 && getTag(Promise2.resolve()) != promiseTag || Set2 && getTag(new Set2()) != setTag || WeakMap && getTag(new WeakMap()) != weakMapTag) {
      getTag = function(value) {
        var result = baseGetTag(value), Ctor = result == objectTag ? value.constructor : void 0, ctorString = Ctor ? toSource(Ctor) : "";
        if (ctorString) {
          switch (ctorString) {
            case dataViewCtorString:
              return dataViewTag;
            case mapCtorString:
              return mapTag;
            case promiseCtorString:
              return promiseTag;
            case setCtorString:
              return setTag;
            case weakMapCtorString:
              return weakMapTag;
          }
        }
        return result;
      };
    }
    function isIndex(value, length) {
      length = length == null ? MAX_SAFE_INTEGER : length;
      return !!length && (typeof value == "number" || reIsUint.test(value)) && (value > -1 && value % 1 == 0 && value < length);
    }
    function isKeyable(value) {
      var type = typeof value;
      return type == "string" || type == "number" || type == "symbol" || type == "boolean" ? value !== "__proto__" : value === null;
    }
    function isMasked(func) {
      return !!maskSrcKey && maskSrcKey in func;
    }
    function isPrototype(value) {
      var Ctor = value && value.constructor, proto = typeof Ctor == "function" && Ctor.prototype || objectProto;
      return value === proto;
    }
    function objectToString(value) {
      return nativeObjectToString.call(value);
    }
    function toSource(func) {
      if (func != null) {
        try {
          return funcToString.call(func);
        } catch (e) {
        }
        try {
          return func + "";
        } catch (e) {
        }
      }
      return "";
    }
    function eq(value, other) {
      return value === other || value !== value && other !== other;
    }
    var isArguments = baseIsArguments(/* @__PURE__ */ (function() {
      return arguments;
    })()) ? baseIsArguments : function(value) {
      return isObjectLike(value) && hasOwnProperty.call(value, "callee") && !propertyIsEnumerable.call(value, "callee");
    };
    var isArray = Array.isArray;
    function isArrayLike(value) {
      return value != null && isLength(value.length) && !isFunction(value);
    }
    var isBuffer = nativeIsBuffer || stubFalse;
    function isEqual(value, other) {
      return baseIsEqual(value, other);
    }
    function isFunction(value) {
      if (!isObject(value)) {
        return false;
      }
      var tag = baseGetTag(value);
      return tag == funcTag || tag == genTag || tag == asyncTag || tag == proxyTag;
    }
    function isLength(value) {
      return typeof value == "number" && value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
    }
    function isObject(value) {
      var type = typeof value;
      return value != null && (type == "object" || type == "function");
    }
    function isObjectLike(value) {
      return value != null && typeof value == "object";
    }
    var isTypedArray = nodeIsTypedArray ? baseUnary(nodeIsTypedArray) : baseIsTypedArray;
    function keys(object) {
      return isArrayLike(object) ? arrayLikeKeys(object) : baseKeys(object);
    }
    function stubArray() {
      return [];
    }
    function stubFalse() {
      return false;
    }
    module2.exports = isEqual;
  })(lodash_isequal, lodash_isequal.exports);
  return lodash_isequal.exports;
}
var hasRequiredDownloadedUpdateHelper;
function requireDownloadedUpdateHelper() {
  if (hasRequiredDownloadedUpdateHelper) return DownloadedUpdateHelper;
  hasRequiredDownloadedUpdateHelper = 1;
  Object.defineProperty(DownloadedUpdateHelper, "__esModule", { value: true });
  DownloadedUpdateHelper.DownloadedUpdateHelper = void 0;
  DownloadedUpdateHelper.createTempUpdateFile = createTempUpdateFile;
  const crypto_1 = require$$0$3;
  const fs_1 = require$$2;
  const isEqual = requireLodash_isequal();
  const fs_extra_1 = /* @__PURE__ */ requireLib();
  const path = require$$1$2;
  let DownloadedUpdateHelper$1 = class DownloadedUpdateHelper {
    constructor(cacheDir) {
      this.cacheDir = cacheDir;
      this._file = null;
      this._packageFile = null;
      this.versionInfo = null;
      this.fileInfo = null;
      this._downloadedFileInfo = null;
    }
    get downloadedFileInfo() {
      return this._downloadedFileInfo;
    }
    get file() {
      return this._file;
    }
    get packageFile() {
      return this._packageFile;
    }
    get cacheDirForPendingUpdate() {
      return path.join(this.cacheDir, "pending");
    }
    async validateDownloadedPath(updateFile, updateInfo, fileInfo, logger) {
      if (this.versionInfo != null && this.file === updateFile && this.fileInfo != null) {
        if (isEqual(this.versionInfo, updateInfo) && isEqual(this.fileInfo.info, fileInfo.info) && await (0, fs_extra_1.pathExists)(updateFile)) {
          return updateFile;
        } else {
          return null;
        }
      }
      const cachedUpdateFile = await this.getValidCachedUpdateFile(fileInfo, logger);
      if (cachedUpdateFile === null) {
        return null;
      }
      logger.info(`Update has already been downloaded to ${updateFile}).`);
      this._file = cachedUpdateFile;
      return cachedUpdateFile;
    }
    async setDownloadedFile(downloadedFile, packageFile, versionInfo, fileInfo, updateFileName, isSaveCache) {
      this._file = downloadedFile;
      this._packageFile = packageFile;
      this.versionInfo = versionInfo;
      this.fileInfo = fileInfo;
      this._downloadedFileInfo = {
        fileName: updateFileName,
        sha512: fileInfo.info.sha512,
        isAdminRightsRequired: fileInfo.info.isAdminRightsRequired === true
      };
      if (isSaveCache) {
        await (0, fs_extra_1.outputJson)(this.getUpdateInfoFile(), this._downloadedFileInfo);
      }
    }
    async clear() {
      this._file = null;
      this._packageFile = null;
      this.versionInfo = null;
      this.fileInfo = null;
      await this.cleanCacheDirForPendingUpdate();
    }
    async cleanCacheDirForPendingUpdate() {
      try {
        await (0, fs_extra_1.emptyDir)(this.cacheDirForPendingUpdate);
      } catch (_ignore) {
      }
    }
    /**
     * Returns "update-info.json" which is created in the update cache directory's "pending" subfolder after the first update is downloaded.  If the update file does not exist then the cache is cleared and recreated.  If the update file exists then its properties are validated.
     * @param fileInfo
     * @param logger
     */
    async getValidCachedUpdateFile(fileInfo, logger) {
      const updateInfoFilePath = this.getUpdateInfoFile();
      const doesUpdateInfoFileExist = await (0, fs_extra_1.pathExists)(updateInfoFilePath);
      if (!doesUpdateInfoFileExist) {
        return null;
      }
      let cachedInfo;
      try {
        cachedInfo = await (0, fs_extra_1.readJson)(updateInfoFilePath);
      } catch (error2) {
        let message = `No cached update info available`;
        if (error2.code !== "ENOENT") {
          await this.cleanCacheDirForPendingUpdate();
          message += ` (error on read: ${error2.message})`;
        }
        logger.info(message);
        return null;
      }
      const isCachedInfoFileNameValid = (cachedInfo === null || cachedInfo === void 0 ? void 0 : cachedInfo.fileName) !== null;
      if (!isCachedInfoFileNameValid) {
        logger.warn(`Cached update info is corrupted: no fileName, directory for cached update will be cleaned`);
        await this.cleanCacheDirForPendingUpdate();
        return null;
      }
      if (fileInfo.info.sha512 !== cachedInfo.sha512) {
        logger.info(`Cached update sha512 checksum doesn't match the latest available update. New update must be downloaded. Cached: ${cachedInfo.sha512}, expected: ${fileInfo.info.sha512}. Directory for cached update will be cleaned`);
        await this.cleanCacheDirForPendingUpdate();
        return null;
      }
      const updateFile = path.join(this.cacheDirForPendingUpdate, cachedInfo.fileName);
      if (!await (0, fs_extra_1.pathExists)(updateFile)) {
        logger.info("Cached update file doesn't exist");
        return null;
      }
      const sha512 = await hashFile(updateFile);
      if (fileInfo.info.sha512 !== sha512) {
        logger.warn(`Sha512 checksum doesn't match the latest available update. New update must be downloaded. Cached: ${sha512}, expected: ${fileInfo.info.sha512}`);
        await this.cleanCacheDirForPendingUpdate();
        return null;
      }
      this._downloadedFileInfo = cachedInfo;
      return updateFile;
    }
    getUpdateInfoFile() {
      return path.join(this.cacheDirForPendingUpdate, "update-info.json");
    }
  };
  DownloadedUpdateHelper.DownloadedUpdateHelper = DownloadedUpdateHelper$1;
  function hashFile(file2, algorithm = "sha512", encoding = "base64", options) {
    return new Promise((resolve, reject) => {
      const hash = (0, crypto_1.createHash)(algorithm);
      hash.on("error", reject).setEncoding(encoding);
      (0, fs_1.createReadStream)(file2, {
        ...options,
        highWaterMark: 1024 * 1024
        /* better to use more memory but hash faster */
      }).on("error", reject).on("end", () => {
        hash.end();
        resolve(hash.read());
      }).pipe(hash, { end: false });
    });
  }
  async function createTempUpdateFile(name, cacheDir, log) {
    let nameCounter = 0;
    let result = path.join(cacheDir, name);
    for (let i = 0; i < 3; i++) {
      try {
        await (0, fs_extra_1.unlink)(result);
        return result;
      } catch (e) {
        if (e.code === "ENOENT") {
          return result;
        }
        log.warn(`Error on remove temp update file: ${e}`);
        result = path.join(cacheDir, `${nameCounter++}-${name}`);
      }
    }
    return result;
  }
  return DownloadedUpdateHelper;
}
var ElectronAppAdapter = {};
var AppAdapter = {};
var hasRequiredAppAdapter;
function requireAppAdapter() {
  if (hasRequiredAppAdapter) return AppAdapter;
  hasRequiredAppAdapter = 1;
  Object.defineProperty(AppAdapter, "__esModule", { value: true });
  AppAdapter.getAppCacheDir = getAppCacheDir;
  const path = require$$1$2;
  const os_1 = require$$3;
  function getAppCacheDir() {
    const homedir = (0, os_1.homedir)();
    let result;
    if (process.platform === "win32") {
      result = process.env["LOCALAPPDATA"] || path.join(homedir, "AppData", "Local");
    } else if (process.platform === "darwin") {
      result = path.join(homedir, "Library", "Caches");
    } else {
      result = process.env["XDG_CACHE_HOME"] || path.join(homedir, ".cache");
    }
    return result;
  }
  return AppAdapter;
}
var hasRequiredElectronAppAdapter;
function requireElectronAppAdapter() {
  if (hasRequiredElectronAppAdapter) return ElectronAppAdapter;
  hasRequiredElectronAppAdapter = 1;
  Object.defineProperty(ElectronAppAdapter, "__esModule", { value: true });
  ElectronAppAdapter.ElectronAppAdapter = void 0;
  const path = require$$1$2;
  const AppAdapter_1 = requireAppAdapter();
  let ElectronAppAdapter$1 = class ElectronAppAdapter {
    constructor(app = require$$1.app) {
      this.app = app;
    }
    whenReady() {
      return this.app.whenReady();
    }
    get version() {
      return this.app.getVersion();
    }
    get name() {
      return this.app.getName();
    }
    get isPackaged() {
      return this.app.isPackaged === true;
    }
    get appUpdateConfigPath() {
      return this.isPackaged ? path.join(process.resourcesPath, "app-update.yml") : path.join(this.app.getAppPath(), "dev-app-update.yml");
    }
    get userDataPath() {
      return this.app.getPath("userData");
    }
    get baseCachePath() {
      return (0, AppAdapter_1.getAppCacheDir)();
    }
    quit() {
      this.app.quit();
    }
    relaunch() {
      this.app.relaunch();
    }
    onQuit(handler) {
      this.app.once("quit", (_, exitCode) => handler(exitCode));
    }
  };
  ElectronAppAdapter.ElectronAppAdapter = ElectronAppAdapter$1;
  return ElectronAppAdapter;
}
var electronHttpExecutor = {};
var hasRequiredElectronHttpExecutor;
function requireElectronHttpExecutor() {
  if (hasRequiredElectronHttpExecutor) return electronHttpExecutor;
  hasRequiredElectronHttpExecutor = 1;
  (function(exports2) {
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.ElectronHttpExecutor = exports2.NET_SESSION_NAME = void 0;
    exports2.getNetSession = getNetSession;
    const builder_util_runtime_1 = requireOut();
    exports2.NET_SESSION_NAME = "electron-updater";
    function getNetSession() {
      return require$$1.session.fromPartition(exports2.NET_SESSION_NAME, {
        cache: false
      });
    }
    class ElectronHttpExecutor extends builder_util_runtime_1.HttpExecutor {
      constructor(proxyLoginCallback) {
        super();
        this.proxyLoginCallback = proxyLoginCallback;
        this.cachedSession = null;
      }
      async download(url, destination, options) {
        return await options.cancellationToken.createPromise((resolve, reject, onCancel) => {
          const requestOptions = {
            headers: options.headers || void 0,
            redirect: "manual"
          };
          (0, builder_util_runtime_1.configureRequestUrl)(url, requestOptions);
          (0, builder_util_runtime_1.configureRequestOptions)(requestOptions);
          this.doDownload(requestOptions, {
            destination,
            options,
            onCancel,
            callback: (error2) => {
              if (error2 == null) {
                resolve(destination);
              } else {
                reject(error2);
              }
            },
            responseHandler: null
          }, 0);
        });
      }
      createRequest(options, callback) {
        if (options.headers && options.headers.Host) {
          options.host = options.headers.Host;
          delete options.headers.Host;
        }
        if (this.cachedSession == null) {
          this.cachedSession = getNetSession();
        }
        const request = require$$1.net.request({
          ...options,
          session: this.cachedSession
        });
        request.on("response", callback);
        if (this.proxyLoginCallback != null) {
          request.on("login", this.proxyLoginCallback);
        }
        return request;
      }
      addRedirectHandlers(request, options, reject, redirectCount, handler) {
        request.on("redirect", (statusCode, method, redirectUrl) => {
          request.abort();
          if (redirectCount > this.maxRedirects) {
            reject(this.createMaxRedirectError());
          } else {
            handler(builder_util_runtime_1.HttpExecutor.prepareRedirectUrlOptions(redirectUrl, options));
          }
        });
      }
    }
    exports2.ElectronHttpExecutor = ElectronHttpExecutor;
  })(electronHttpExecutor);
  return electronHttpExecutor;
}
var GenericProvider = {};
var util = {};
var hasRequiredUtil;
function requireUtil() {
  if (hasRequiredUtil) return util;
  hasRequiredUtil = 1;
  Object.defineProperty(util, "__esModule", { value: true });
  util.newBaseUrl = newBaseUrl;
  util.newUrlFromBase = newUrlFromBase;
  util.getChannelFilename = getChannelFilename;
  const url_1 = require$$2$1;
  function newBaseUrl(url) {
    const result = new url_1.URL(url);
    if (!result.pathname.endsWith("/")) {
      result.pathname += "/";
    }
    return result;
  }
  function newUrlFromBase(pathname, baseUrl, addRandomQueryToAvoidCaching = false) {
    const result = new url_1.URL(pathname, baseUrl);
    const search = baseUrl.search;
    if (search != null && search.length !== 0) {
      result.search = search;
    } else if (addRandomQueryToAvoidCaching) {
      result.search = `noCache=${Date.now().toString(32)}`;
    }
    return result;
  }
  function getChannelFilename(channel) {
    return `${channel}.yml`;
  }
  return util;
}
var Provider = {};
var lodash_escaperegexp;
var hasRequiredLodash_escaperegexp;
function requireLodash_escaperegexp() {
  if (hasRequiredLodash_escaperegexp) return lodash_escaperegexp;
  hasRequiredLodash_escaperegexp = 1;
  var symbolTag = "[object Symbol]";
  var reRegExpChar = /[\\^$.*+?()[\]{}|]/g, reHasRegExpChar = RegExp(reRegExpChar.source);
  var freeGlobal = typeof commonjsGlobal == "object" && commonjsGlobal && commonjsGlobal.Object === Object && commonjsGlobal;
  var freeSelf = typeof self == "object" && self && self.Object === Object && self;
  var root = freeGlobal || freeSelf || Function("return this")();
  var objectProto = Object.prototype;
  var objectToString = objectProto.toString;
  var Symbol2 = root.Symbol;
  var symbolProto = Symbol2 ? Symbol2.prototype : void 0, symbolToString = symbolProto ? symbolProto.toString : void 0;
  function baseToString(value) {
    if (typeof value == "string") {
      return value;
    }
    if (isSymbol(value)) {
      return symbolToString ? symbolToString.call(value) : "";
    }
    var result = value + "";
    return result == "0" && 1 / value == -Infinity ? "-0" : result;
  }
  function isObjectLike(value) {
    return !!value && typeof value == "object";
  }
  function isSymbol(value) {
    return typeof value == "symbol" || isObjectLike(value) && objectToString.call(value) == symbolTag;
  }
  function toString(value) {
    return value == null ? "" : baseToString(value);
  }
  function escapeRegExp(string) {
    string = toString(string);
    return string && reHasRegExpChar.test(string) ? string.replace(reRegExpChar, "\\$&") : string;
  }
  lodash_escaperegexp = escapeRegExp;
  return lodash_escaperegexp;
}
var hasRequiredProvider;
function requireProvider() {
  if (hasRequiredProvider) return Provider;
  hasRequiredProvider = 1;
  Object.defineProperty(Provider, "__esModule", { value: true });
  Provider.Provider = void 0;
  Provider.findFile = findFile;
  Provider.parseUpdateInfo = parseUpdateInfo;
  Provider.getFileList = getFileList;
  Provider.resolveFiles = resolveFiles;
  const builder_util_runtime_1 = requireOut();
  const js_yaml_1 = require$$5;
  const url_1 = require$$2$1;
  const util_1 = requireUtil();
  const escapeRegExp = requireLodash_escaperegexp();
  let Provider$1 = class Provider {
    constructor(runtimeOptions) {
      this.runtimeOptions = runtimeOptions;
      this.requestHeaders = null;
      this.executor = runtimeOptions.executor;
    }
    // By default, the blockmap file is in the same directory as the main file
    // But some providers may have a different blockmap file, so we need to override this method
    getBlockMapFiles(baseUrl, oldVersion, newVersion, oldBlockMapFileBaseUrl = null) {
      const newBlockMapUrl = (0, util_1.newUrlFromBase)(`${baseUrl.pathname}.blockmap`, baseUrl);
      const oldBlockMapUrl = (0, util_1.newUrlFromBase)(`${baseUrl.pathname.replace(new RegExp(escapeRegExp(newVersion), "g"), oldVersion)}.blockmap`, oldBlockMapFileBaseUrl ? new url_1.URL(oldBlockMapFileBaseUrl) : baseUrl);
      return [oldBlockMapUrl, newBlockMapUrl];
    }
    get isUseMultipleRangeRequest() {
      return this.runtimeOptions.isUseMultipleRangeRequest !== false;
    }
    getChannelFilePrefix() {
      if (this.runtimeOptions.platform === "linux") {
        const arch = process.env["TEST_UPDATER_ARCH"] || process.arch;
        const archSuffix = arch === "x64" ? "" : `-${arch}`;
        return "-linux" + archSuffix;
      } else {
        return this.runtimeOptions.platform === "darwin" ? "-mac" : "";
      }
    }
    // due to historical reasons for windows we use channel name without platform specifier
    getDefaultChannelName() {
      return this.getCustomChannelName("latest");
    }
    getCustomChannelName(channel) {
      return `${channel}${this.getChannelFilePrefix()}`;
    }
    get fileExtraDownloadHeaders() {
      return null;
    }
    setRequestHeaders(value) {
      this.requestHeaders = value;
    }
    /**
     * Method to perform API request only to resolve update info, but not to download update.
     */
    httpRequest(url, headers, cancellationToken) {
      return this.executor.request(this.createRequestOptions(url, headers), cancellationToken);
    }
    createRequestOptions(url, headers) {
      const result = {};
      if (this.requestHeaders == null) {
        if (headers != null) {
          result.headers = headers;
        }
      } else {
        result.headers = headers == null ? this.requestHeaders : { ...this.requestHeaders, ...headers };
      }
      (0, builder_util_runtime_1.configureRequestUrl)(url, result);
      return result;
    }
  };
  Provider.Provider = Provider$1;
  function findFile(files, extension, not) {
    var _a;
    if (files.length === 0) {
      throw (0, builder_util_runtime_1.newError)("No files provided", "ERR_UPDATER_NO_FILES_PROVIDED");
    }
    const filteredFiles = files.filter((it) => it.url.pathname.toLowerCase().endsWith(`.${extension.toLowerCase()}`));
    const result = (_a = filteredFiles.find((it) => [it.url.pathname, it.info.url].some((n) => n.includes(process.arch)))) !== null && _a !== void 0 ? _a : filteredFiles.shift();
    if (result) {
      return result;
    } else if (not == null) {
      return files[0];
    } else {
      return files.find((fileInfo) => !not.some((ext) => fileInfo.url.pathname.toLowerCase().endsWith(`.${ext.toLowerCase()}`)));
    }
  }
  function parseUpdateInfo(rawData, channelFile, channelFileUrl) {
    if (rawData == null) {
      throw (0, builder_util_runtime_1.newError)(`Cannot parse update info from ${channelFile} in the latest release artifacts (${channelFileUrl}): rawData: null`, "ERR_UPDATER_INVALID_UPDATE_INFO");
    }
    let result;
    try {
      result = (0, js_yaml_1.load)(rawData);
    } catch (e) {
      throw (0, builder_util_runtime_1.newError)(`Cannot parse update info from ${channelFile} in the latest release artifacts (${channelFileUrl}): ${e.stack || e.message}, rawData: ${rawData}`, "ERR_UPDATER_INVALID_UPDATE_INFO");
    }
    return result;
  }
  function getFileList(updateInfo) {
    const files = updateInfo.files;
    if (files != null && files.length > 0) {
      return files;
    }
    if (updateInfo.path != null) {
      return [
        {
          url: updateInfo.path,
          sha2: updateInfo.sha2,
          sha512: updateInfo.sha512
        }
      ];
    } else {
      throw (0, builder_util_runtime_1.newError)(`No files provided: ${(0, builder_util_runtime_1.safeStringifyJson)(updateInfo)}`, "ERR_UPDATER_NO_FILES_PROVIDED");
    }
  }
  function resolveFiles(updateInfo, baseUrl, pathTransformer = (p) => p) {
    const files = getFileList(updateInfo);
    const result = files.map((fileInfo) => {
      if (fileInfo.sha2 == null && fileInfo.sha512 == null) {
        throw (0, builder_util_runtime_1.newError)(`Update info doesn't contain nor sha256 neither sha512 checksum: ${(0, builder_util_runtime_1.safeStringifyJson)(fileInfo)}`, "ERR_UPDATER_NO_CHECKSUM");
      }
      return {
        url: (0, util_1.newUrlFromBase)(pathTransformer(fileInfo.url), baseUrl),
        info: fileInfo
      };
    });
    const packages = updateInfo.packages;
    const packageInfo = packages == null ? null : packages[process.arch] || packages.ia32;
    if (packageInfo != null) {
      result[0].packageInfo = {
        ...packageInfo,
        path: (0, util_1.newUrlFromBase)(pathTransformer(packageInfo.path), baseUrl).href
      };
    }
    return result;
  }
  return Provider;
}
var hasRequiredGenericProvider;
function requireGenericProvider() {
  if (hasRequiredGenericProvider) return GenericProvider;
  hasRequiredGenericProvider = 1;
  Object.defineProperty(GenericProvider, "__esModule", { value: true });
  GenericProvider.GenericProvider = void 0;
  const builder_util_runtime_1 = requireOut();
  const util_1 = requireUtil();
  const Provider_1 = requireProvider();
  let GenericProvider$1 = class GenericProvider extends Provider_1.Provider {
    constructor(configuration, updater, runtimeOptions) {
      super(runtimeOptions);
      this.configuration = configuration;
      this.updater = updater;
      this.baseUrl = (0, util_1.newBaseUrl)(this.configuration.url);
    }
    get channel() {
      const result = this.updater.channel || this.configuration.channel;
      return result == null ? this.getDefaultChannelName() : this.getCustomChannelName(result);
    }
    async getLatestVersion() {
      const channelFile = (0, util_1.getChannelFilename)(this.channel);
      const channelUrl = (0, util_1.newUrlFromBase)(channelFile, this.baseUrl, this.updater.isAddNoCacheQuery);
      for (let attemptNumber = 0; ; attemptNumber++) {
        try {
          return (0, Provider_1.parseUpdateInfo)(await this.httpRequest(channelUrl), channelFile, channelUrl);
        } catch (e) {
          if (e instanceof builder_util_runtime_1.HttpError && e.statusCode === 404) {
            throw (0, builder_util_runtime_1.newError)(`Cannot find channel "${channelFile}" update info: ${e.stack || e.message}`, "ERR_UPDATER_CHANNEL_FILE_NOT_FOUND");
          } else if (e.code === "ECONNREFUSED") {
            if (attemptNumber < 3) {
              await new Promise((resolve, reject) => {
                try {
                  setTimeout(resolve, 1e3 * attemptNumber);
                } catch (e2) {
                  reject(e2);
                }
              });
              continue;
            }
          }
          throw e;
        }
      }
    }
    resolveFiles(updateInfo) {
      return (0, Provider_1.resolveFiles)(updateInfo, this.baseUrl);
    }
  };
  GenericProvider.GenericProvider = GenericProvider$1;
  return GenericProvider;
}
var providerFactory = {};
var BitbucketProvider = {};
var hasRequiredBitbucketProvider;
function requireBitbucketProvider() {
  if (hasRequiredBitbucketProvider) return BitbucketProvider;
  hasRequiredBitbucketProvider = 1;
  Object.defineProperty(BitbucketProvider, "__esModule", { value: true });
  BitbucketProvider.BitbucketProvider = void 0;
  const builder_util_runtime_1 = requireOut();
  const util_1 = requireUtil();
  const Provider_1 = requireProvider();
  let BitbucketProvider$1 = class BitbucketProvider extends Provider_1.Provider {
    constructor(configuration, updater, runtimeOptions) {
      super({
        ...runtimeOptions,
        isUseMultipleRangeRequest: false
      });
      this.configuration = configuration;
      this.updater = updater;
      const { owner, slug } = configuration;
      this.baseUrl = (0, util_1.newBaseUrl)(`https://api.bitbucket.org/2.0/repositories/${owner}/${slug}/downloads`);
    }
    get channel() {
      return this.updater.channel || this.configuration.channel || "latest";
    }
    async getLatestVersion() {
      const cancellationToken = new builder_util_runtime_1.CancellationToken();
      const channelFile = (0, util_1.getChannelFilename)(this.getCustomChannelName(this.channel));
      const channelUrl = (0, util_1.newUrlFromBase)(channelFile, this.baseUrl, this.updater.isAddNoCacheQuery);
      try {
        const updateInfo = await this.httpRequest(channelUrl, void 0, cancellationToken);
        return (0, Provider_1.parseUpdateInfo)(updateInfo, channelFile, channelUrl);
      } catch (e) {
        throw (0, builder_util_runtime_1.newError)(`Unable to find latest version on ${this.toString()}, please ensure release exists: ${e.stack || e.message}`, "ERR_UPDATER_LATEST_VERSION_NOT_FOUND");
      }
    }
    resolveFiles(updateInfo) {
      return (0, Provider_1.resolveFiles)(updateInfo, this.baseUrl);
    }
    toString() {
      const { owner, slug } = this.configuration;
      return `Bitbucket (owner: ${owner}, slug: ${slug}, channel: ${this.channel})`;
    }
  };
  BitbucketProvider.BitbucketProvider = BitbucketProvider$1;
  return BitbucketProvider;
}
var GitHubProvider = {};
var hasRequiredGitHubProvider;
function requireGitHubProvider() {
  if (hasRequiredGitHubProvider) return GitHubProvider;
  hasRequiredGitHubProvider = 1;
  Object.defineProperty(GitHubProvider, "__esModule", { value: true });
  GitHubProvider.GitHubProvider = GitHubProvider.BaseGitHubProvider = void 0;
  GitHubProvider.computeReleaseNotes = computeReleaseNotes;
  const builder_util_runtime_1 = requireOut();
  const semver2 = requireSemver();
  const url_1 = require$$2$1;
  const util_1 = requireUtil();
  const Provider_1 = requireProvider();
  const hrefRegExp = /\/tag\/(v?[^/]+)$/;
  class BaseGitHubProvider extends Provider_1.Provider {
    constructor(options, defaultHost, runtimeOptions) {
      super({
        ...runtimeOptions,
        /* because GitHib uses S3 */
        isUseMultipleRangeRequest: false
      });
      this.options = options;
      this.baseUrl = (0, util_1.newBaseUrl)((0, builder_util_runtime_1.githubUrl)(options, defaultHost));
      const apiHost = defaultHost === "github.com" ? "api.github.com" : defaultHost;
      this.baseApiUrl = (0, util_1.newBaseUrl)((0, builder_util_runtime_1.githubUrl)(options, apiHost));
    }
    computeGithubBasePath(result) {
      const host = this.options.host;
      return host && !["github.com", "api.github.com"].includes(host) ? `/api/v3${result}` : result;
    }
  }
  GitHubProvider.BaseGitHubProvider = BaseGitHubProvider;
  let GitHubProvider$1 = class GitHubProvider extends BaseGitHubProvider {
    constructor(options, updater, runtimeOptions) {
      super(options, "github.com", runtimeOptions);
      this.options = options;
      this.updater = updater;
    }
    get channel() {
      const result = this.updater.channel || this.options.channel;
      return result == null ? this.getDefaultChannelName() : this.getCustomChannelName(result);
    }
    async getLatestVersion() {
      var _a, _b, _c, _d, _e;
      const cancellationToken = new builder_util_runtime_1.CancellationToken();
      const feedXml = await this.httpRequest((0, util_1.newUrlFromBase)(`${this.basePath}.atom`, this.baseUrl), {
        accept: "application/xml, application/atom+xml, text/xml, */*"
      }, cancellationToken);
      const feed = (0, builder_util_runtime_1.parseXml)(feedXml);
      let latestRelease = feed.element("entry", false, `No published versions on GitHub`);
      let tag = null;
      try {
        if (this.updater.allowPrerelease) {
          const currentChannel = ((_a = this.updater) === null || _a === void 0 ? void 0 : _a.channel) || ((_b = semver2.prerelease(this.updater.currentVersion)) === null || _b === void 0 ? void 0 : _b[0]) || null;
          if (currentChannel === null) {
            tag = hrefRegExp.exec(latestRelease.element("link").attribute("href"))[1];
          } else {
            for (const element of feed.getElements("entry")) {
              const hrefElement = hrefRegExp.exec(element.element("link").attribute("href"));
              if (hrefElement === null) {
                continue;
              }
              const hrefTag = hrefElement[1];
              if (!semver2.valid(hrefTag)) {
                continue;
              }
              const hrefChannel = ((_c = semver2.prerelease(hrefTag)) === null || _c === void 0 ? void 0 : _c[0]) || null;
              const shouldFetchVersion = !currentChannel || ["alpha", "beta"].includes(currentChannel);
              const isCustomChannel = hrefChannel !== null && !["alpha", "beta"].includes(String(hrefChannel));
              const channelMismatch = currentChannel === "beta" && hrefChannel === "alpha";
              if (shouldFetchVersion && !isCustomChannel && !channelMismatch) {
                tag = hrefTag;
                latestRelease = element;
                break;
              }
              const isNextPreRelease = hrefChannel && hrefChannel === currentChannel;
              if (isNextPreRelease) {
                tag = hrefTag;
                latestRelease = element;
                break;
              }
            }
          }
        } else {
          tag = await this.getLatestTagName(cancellationToken);
          for (const element of feed.getElements("entry")) {
            const hrefMatch = hrefRegExp.exec(element.element("link").attribute("href"));
            if (hrefMatch == null) {
              continue;
            }
            if (hrefMatch[1] === tag) {
              latestRelease = element;
              break;
            }
          }
        }
      } catch (e) {
        throw (0, builder_util_runtime_1.newError)(`Cannot parse releases feed: ${e.stack || e.message},
XML:
${feedXml}`, "ERR_UPDATER_INVALID_RELEASE_FEED");
      }
      if (tag == null) {
        throw (0, builder_util_runtime_1.newError)(`No published versions on GitHub`, "ERR_UPDATER_NO_PUBLISHED_VERSIONS");
      }
      let rawData;
      let channelFile = "";
      let channelFileUrl = "";
      const fetchData = async (channelName) => {
        channelFile = (0, util_1.getChannelFilename)(channelName);
        channelFileUrl = (0, util_1.newUrlFromBase)(this.getBaseDownloadPath(String(tag), channelFile), this.baseUrl);
        const requestOptions = this.createRequestOptions(channelFileUrl);
        try {
          return await this.executor.request(requestOptions, cancellationToken);
        } catch (e) {
          if (e instanceof builder_util_runtime_1.HttpError && e.statusCode === 404) {
            throw (0, builder_util_runtime_1.newError)(`Cannot find ${channelFile} in the latest release artifacts (${channelFileUrl}): ${e.stack || e.message}`, "ERR_UPDATER_CHANNEL_FILE_NOT_FOUND");
          }
          throw e;
        }
      };
      try {
        let channel = this.channel;
        if (this.updater.allowPrerelease && ((_d = semver2.prerelease(tag)) === null || _d === void 0 ? void 0 : _d[0])) {
          channel = this.getCustomChannelName(String((_e = semver2.prerelease(tag)) === null || _e === void 0 ? void 0 : _e[0]));
        }
        rawData = await fetchData(channel);
      } catch (e) {
        if (this.updater.allowPrerelease) {
          rawData = await fetchData(this.getDefaultChannelName());
        } else {
          throw e;
        }
      }
      const result = (0, Provider_1.parseUpdateInfo)(rawData, channelFile, channelFileUrl);
      if (result.releaseName == null) {
        result.releaseName = latestRelease.elementValueOrEmpty("title");
      }
      if (result.releaseNotes == null) {
        result.releaseNotes = computeReleaseNotes(this.updater.currentVersion, this.updater.fullChangelog, feed, latestRelease);
      }
      return {
        tag,
        ...result
      };
    }
    async getLatestTagName(cancellationToken) {
      const options = this.options;
      const url = options.host == null || options.host === "github.com" ? (0, util_1.newUrlFromBase)(`${this.basePath}/latest`, this.baseUrl) : new url_1.URL(`${this.computeGithubBasePath(`/repos/${options.owner}/${options.repo}/releases`)}/latest`, this.baseApiUrl);
      try {
        const rawData = await this.httpRequest(url, { Accept: "application/json" }, cancellationToken);
        if (rawData == null) {
          return null;
        }
        const releaseInfo = JSON.parse(rawData);
        return releaseInfo.tag_name;
      } catch (e) {
        throw (0, builder_util_runtime_1.newError)(`Unable to find latest version on GitHub (${url}), please ensure a production release exists: ${e.stack || e.message}`, "ERR_UPDATER_LATEST_VERSION_NOT_FOUND");
      }
    }
    get basePath() {
      return `/${this.options.owner}/${this.options.repo}/releases`;
    }
    resolveFiles(updateInfo) {
      return (0, Provider_1.resolveFiles)(updateInfo, this.baseUrl, (p) => this.getBaseDownloadPath(updateInfo.tag, p.replace(/ /g, "-")));
    }
    getBaseDownloadPath(tag, fileName) {
      return `${this.basePath}/download/${tag}/${fileName}`;
    }
  };
  GitHubProvider.GitHubProvider = GitHubProvider$1;
  function getNoteValue(parent) {
    const result = parent.elementValueOrEmpty("content");
    return result === "No content." ? "" : result;
  }
  function computeReleaseNotes(currentVersion, isFullChangelog, feed, latestRelease) {
    if (!isFullChangelog) {
      return getNoteValue(latestRelease);
    }
    const releaseVersionRegExp = /\/tag\/v?([^/]+)$/;
    let latestVersion = void 0;
    try {
      latestVersion = releaseVersionRegExp.exec(latestRelease.element("link").attribute("href"))[1];
      latestVersion = semver2.valid(latestVersion) ? latestVersion : void 0;
    } catch {
    }
    if (latestVersion == null) {
      return null;
    }
    const releaseNotes = [];
    for (const release of feed.getElements("entry")) {
      let versionRelease;
      try {
        const match = releaseVersionRegExp.exec(release.element("link").attribute("href"));
        if (!match) {
          continue;
        }
        versionRelease = match[1];
      } catch {
        continue;
      }
      if (!semver2.valid(versionRelease)) {
        continue;
      }
      const isGreaterThanCurrent = semver2.gt(versionRelease, currentVersion.raw);
      const isLessOrEqualThanLatest = semver2.lte(versionRelease, latestVersion);
      if (isGreaterThanCurrent && isLessOrEqualThanLatest) {
        releaseNotes.push({
          version: versionRelease,
          note: getNoteValue(release)
        });
      }
    }
    return releaseNotes.sort((a, b) => semver2.rcompare(a.version, b.version));
  }
  return GitHubProvider;
}
var GitLabProvider = {};
var hasRequiredGitLabProvider;
function requireGitLabProvider() {
  if (hasRequiredGitLabProvider) return GitLabProvider;
  hasRequiredGitLabProvider = 1;
  Object.defineProperty(GitLabProvider, "__esModule", { value: true });
  GitLabProvider.GitLabProvider = void 0;
  const builder_util_runtime_1 = requireOut();
  const url_1 = require$$2$1;
  const escapeRegExp = requireLodash_escaperegexp();
  const util_1 = requireUtil();
  const Provider_1 = requireProvider();
  let GitLabProvider$1 = class GitLabProvider extends Provider_1.Provider {
    /**
     * Normalizes filenames by replacing spaces and underscores with dashes.
     *
     * This is a workaround to handle filename formatting differences between tools:
     * - electron-builder formats filenames like "test file.txt" as "test-file.txt"
     * - GitLab may provide asset URLs using underscores, such as "test_file.txt"
     *
     * Because of this mismatch, we can't reliably extract the correct filename from
     * the asset path without normalization. This function ensures consistent matching
     * across different filename formats by converting all spaces and underscores to dashes.
     *
     * @param filename The filename to normalize
     * @returns The normalized filename with spaces and underscores replaced by dashes
     */
    normalizeFilename(filename) {
      return filename.replace(/ |_/g, "-");
    }
    constructor(options, updater, runtimeOptions) {
      super({
        ...runtimeOptions,
        // GitLab might not support multiple range requests efficiently
        isUseMultipleRangeRequest: false
      });
      this.options = options;
      this.updater = updater;
      this.cachedLatestVersion = null;
      const defaultHost = "gitlab.com";
      const host = options.host || defaultHost;
      this.baseApiUrl = (0, util_1.newBaseUrl)(`https://${host}/api/v4`);
    }
    createRequestOptions(url, headers) {
      const result = super.createRequestOptions(url, headers);
      result.redirect = "manual";
      return result;
    }
    get channel() {
      const result = this.updater.channel || this.options.channel;
      return result == null ? this.getDefaultChannelName() : this.getCustomChannelName(result);
    }
    async getLatestVersion() {
      const cancellationToken = new builder_util_runtime_1.CancellationToken();
      const latestReleaseUrl = (0, util_1.newUrlFromBase)(`projects/${this.options.projectId}/releases/permalink/latest`, this.baseApiUrl);
      const header = { Accept: "application/json", ...this.setAuthHeaderForToken(this.options.token || null) };
      let releaseResponse;
      try {
        releaseResponse = await this.httpRequest(latestReleaseUrl, header, cancellationToken);
      } catch (e) {
        throw (0, builder_util_runtime_1.newError)(`Unable to find latest release on GitLab (${latestReleaseUrl}): ${e.stack || e.message}`, "ERR_UPDATER_LATEST_VERSION_NOT_FOUND");
      }
      if (!releaseResponse) {
        throw (0, builder_util_runtime_1.newError)("No published releases on GitLab", "ERR_UPDATER_NO_PUBLISHED_VERSIONS");
      }
      let latestRelease;
      try {
        latestRelease = JSON.parse(releaseResponse);
      } catch (e) {
        throw (0, builder_util_runtime_1.newError)(`Unable to parse latest release response from GitLab (${latestReleaseUrl}): response was not valid JSON: ${e.stack || e.message}`, "ERR_UPDATER_LATEST_VERSION_NOT_FOUND");
      }
      if (latestRelease.upcoming_release) {
        throw (0, builder_util_runtime_1.newError)("Latest GitLab release is scheduled but not yet published", "ERR_UPDATER_LATEST_VERSION_NOT_FOUND");
      }
      const tag = latestRelease.tag_name;
      let rawData = null;
      let channelFile = "";
      let channelFileUrl = null;
      const fetchChannelData = async (channelName) => {
        channelFile = (0, util_1.getChannelFilename)(channelName);
        const channelAsset = latestRelease.assets.links.find((asset) => asset.name === channelFile);
        if (!channelAsset) {
          throw (0, builder_util_runtime_1.newError)(`Cannot find ${channelFile} in the latest release assets`, "ERR_UPDATER_CHANNEL_FILE_NOT_FOUND");
        }
        channelFileUrl = new url_1.URL(channelAsset.direct_asset_url);
        const authHeaders = this.setAuthHeaderForToken(this.options.token || null);
        const headers = Object.keys(authHeaders).length ? authHeaders : void 0;
        try {
          const result2 = await this.httpRequest(channelFileUrl, headers, cancellationToken);
          if (!result2) {
            throw (0, builder_util_runtime_1.newError)(`Empty response from ${channelFileUrl}`, "ERR_UPDATER_CHANNEL_FILE_NOT_FOUND");
          }
          return result2;
        } catch (e) {
          if (e instanceof builder_util_runtime_1.HttpError && e.statusCode === 404) {
            throw (0, builder_util_runtime_1.newError)(`Cannot find ${channelFile} in the latest release artifacts (${channelFileUrl}): ${e.stack || e.message}`, "ERR_UPDATER_CHANNEL_FILE_NOT_FOUND");
          }
          throw e;
        }
      };
      try {
        rawData = await fetchChannelData(this.channel);
      } catch (e) {
        if (this.channel !== this.getDefaultChannelName()) {
          rawData = await fetchChannelData(this.getDefaultChannelName());
        } else {
          throw e;
        }
      }
      if (!rawData) {
        throw (0, builder_util_runtime_1.newError)(`Unable to parse channel data from ${channelFile}`, "ERR_UPDATER_INVALID_UPDATE_INFO");
      }
      const result = (0, Provider_1.parseUpdateInfo)(rawData, channelFile, channelFileUrl);
      if (result.releaseName == null) {
        result.releaseName = latestRelease.name;
      }
      if (result.releaseNotes == null) {
        result.releaseNotes = latestRelease.description || null;
      }
      const gitlabUpdateInfo = {
        tag,
        assets: this.convertAssetsToMap(latestRelease.assets),
        ...result
      };
      this.cachedLatestVersion = gitlabUpdateInfo;
      return gitlabUpdateInfo;
    }
    /**
     * Utility function to convert GitlabReleaseAsset to Map<string, string>
     * Maps asset names to their download URLs
     */
    convertAssetsToMap(assets) {
      const assetsMap = /* @__PURE__ */ new Map();
      for (const asset of assets.links) {
        assetsMap.set(this.normalizeFilename(asset.name), asset.direct_asset_url);
      }
      return assetsMap;
    }
    /**
     * Find blockmap file URL in assets map for a specific filename
     */
    findBlockMapInAssets(assets, filename) {
      const possibleBlockMapNames = [`${filename}.blockmap`, `${this.normalizeFilename(filename)}.blockmap`];
      for (const blockMapName of possibleBlockMapNames) {
        const assetUrl = assets.get(blockMapName);
        if (assetUrl) {
          return new url_1.URL(assetUrl);
        }
      }
      return null;
    }
    async fetchReleaseInfoByVersion(version) {
      const cancellationToken = new builder_util_runtime_1.CancellationToken();
      const possibleReleaseIds = [`v${version}`, version];
      for (const releaseId of possibleReleaseIds) {
        const releaseUrl = (0, util_1.newUrlFromBase)(`projects/${this.options.projectId}/releases/${encodeURIComponent(releaseId)}`, this.baseApiUrl);
        try {
          const header = { Accept: "application/json", ...this.setAuthHeaderForToken(this.options.token || null) };
          const releaseResponse = await this.httpRequest(releaseUrl, header, cancellationToken);
          if (releaseResponse) {
            const release = JSON.parse(releaseResponse);
            return release;
          }
        } catch (e) {
          if (e instanceof builder_util_runtime_1.HttpError && e.statusCode === 404) {
            continue;
          }
          throw (0, builder_util_runtime_1.newError)(`Unable to find release ${releaseId} on GitLab (${releaseUrl}): ${e.stack || e.message}`, "ERR_UPDATER_RELEASE_NOT_FOUND");
        }
      }
      throw (0, builder_util_runtime_1.newError)(`Unable to find release with version ${version} (tried: ${possibleReleaseIds.join(", ")}) on GitLab`, "ERR_UPDATER_RELEASE_NOT_FOUND");
    }
    setAuthHeaderForToken(token) {
      const headers = {};
      if (token != null) {
        if (token.startsWith("Bearer")) {
          headers.authorization = token;
        } else {
          headers["PRIVATE-TOKEN"] = token;
        }
      }
      return headers;
    }
    /**
     * Get version info for blockmap files, using cache when possible
     */
    async getVersionInfoForBlockMap(version) {
      if (this.cachedLatestVersion && this.cachedLatestVersion.version === version) {
        return this.cachedLatestVersion.assets;
      }
      const versionInfo = await this.fetchReleaseInfoByVersion(version);
      if (versionInfo && versionInfo.assets) {
        return this.convertAssetsToMap(versionInfo.assets);
      }
      return null;
    }
    /**
     * Find blockmap URLs from version assets
     */
    async findBlockMapUrlsFromAssets(oldVersion, newVersion, baseFilename) {
      let newBlockMapUrl = null;
      let oldBlockMapUrl = null;
      const newVersionAssets = await this.getVersionInfoForBlockMap(newVersion);
      if (newVersionAssets) {
        newBlockMapUrl = this.findBlockMapInAssets(newVersionAssets, baseFilename);
      }
      const oldVersionAssets = await this.getVersionInfoForBlockMap(oldVersion);
      if (oldVersionAssets) {
        const oldFilename = baseFilename.replace(new RegExp(escapeRegExp(newVersion), "g"), oldVersion);
        oldBlockMapUrl = this.findBlockMapInAssets(oldVersionAssets, oldFilename);
      }
      return [oldBlockMapUrl, newBlockMapUrl];
    }
    async getBlockMapFiles(baseUrl, oldVersion, newVersion, oldBlockMapFileBaseUrl = null) {
      if (this.options.uploadTarget === "project_upload") {
        const baseFilename = baseUrl.pathname.split("/").pop() || "";
        const [oldBlockMapUrl, newBlockMapUrl] = await this.findBlockMapUrlsFromAssets(oldVersion, newVersion, baseFilename);
        if (!newBlockMapUrl) {
          throw (0, builder_util_runtime_1.newError)(`Cannot find blockmap file for ${newVersion} in GitLab assets`, "ERR_UPDATER_BLOCKMAP_FILE_NOT_FOUND");
        }
        if (!oldBlockMapUrl) {
          throw (0, builder_util_runtime_1.newError)(`Cannot find blockmap file for ${oldVersion} in GitLab assets`, "ERR_UPDATER_BLOCKMAP_FILE_NOT_FOUND");
        }
        return [oldBlockMapUrl, newBlockMapUrl];
      } else {
        return super.getBlockMapFiles(baseUrl, oldVersion, newVersion, oldBlockMapFileBaseUrl);
      }
    }
    resolveFiles(updateInfo) {
      return (0, Provider_1.getFileList)(updateInfo).map((fileInfo) => {
        const possibleNames = [
          fileInfo.url,
          // Original filename
          this.normalizeFilename(fileInfo.url)
          // Normalized filename (spaces/underscores → dashes)
        ];
        const matchingAssetName = possibleNames.find((name) => updateInfo.assets.has(name));
        const assetUrl = matchingAssetName ? updateInfo.assets.get(matchingAssetName) : void 0;
        if (!assetUrl) {
          throw (0, builder_util_runtime_1.newError)(`Cannot find asset "${fileInfo.url}" in GitLab release assets. Available assets: ${Array.from(updateInfo.assets.keys()).join(", ")}`, "ERR_UPDATER_ASSET_NOT_FOUND");
        }
        return {
          url: new url_1.URL(assetUrl),
          info: fileInfo
        };
      });
    }
    toString() {
      return `GitLab (projectId: ${this.options.projectId}, channel: ${this.channel})`;
    }
  };
  GitLabProvider.GitLabProvider = GitLabProvider$1;
  return GitLabProvider;
}
var KeygenProvider = {};
var hasRequiredKeygenProvider;
function requireKeygenProvider() {
  if (hasRequiredKeygenProvider) return KeygenProvider;
  hasRequiredKeygenProvider = 1;
  Object.defineProperty(KeygenProvider, "__esModule", { value: true });
  KeygenProvider.KeygenProvider = void 0;
  const builder_util_runtime_1 = requireOut();
  const util_1 = requireUtil();
  const Provider_1 = requireProvider();
  let KeygenProvider$1 = class KeygenProvider extends Provider_1.Provider {
    constructor(configuration, updater, runtimeOptions) {
      super({
        ...runtimeOptions,
        isUseMultipleRangeRequest: false
      });
      this.configuration = configuration;
      this.updater = updater;
      this.defaultHostname = "api.keygen.sh";
      const host = this.configuration.host || this.defaultHostname;
      this.baseUrl = (0, util_1.newBaseUrl)(`https://${host}/v1/accounts/${this.configuration.account}/artifacts?product=${this.configuration.product}`);
    }
    get channel() {
      return this.updater.channel || this.configuration.channel || "stable";
    }
    async getLatestVersion() {
      const cancellationToken = new builder_util_runtime_1.CancellationToken();
      const channelFile = (0, util_1.getChannelFilename)(this.getCustomChannelName(this.channel));
      const channelUrl = (0, util_1.newUrlFromBase)(channelFile, this.baseUrl, this.updater.isAddNoCacheQuery);
      try {
        const updateInfo = await this.httpRequest(channelUrl, {
          Accept: "application/vnd.api+json",
          "Keygen-Version": "1.1"
        }, cancellationToken);
        return (0, Provider_1.parseUpdateInfo)(updateInfo, channelFile, channelUrl);
      } catch (e) {
        throw (0, builder_util_runtime_1.newError)(`Unable to find latest version on ${this.toString()}, please ensure release exists: ${e.stack || e.message}`, "ERR_UPDATER_LATEST_VERSION_NOT_FOUND");
      }
    }
    resolveFiles(updateInfo) {
      return (0, Provider_1.resolveFiles)(updateInfo, this.baseUrl);
    }
    toString() {
      const { account, product, platform } = this.configuration;
      return `Keygen (account: ${account}, product: ${product}, platform: ${platform}, channel: ${this.channel})`;
    }
  };
  KeygenProvider.KeygenProvider = KeygenProvider$1;
  return KeygenProvider;
}
var PrivateGitHubProvider = {};
var hasRequiredPrivateGitHubProvider;
function requirePrivateGitHubProvider() {
  if (hasRequiredPrivateGitHubProvider) return PrivateGitHubProvider;
  hasRequiredPrivateGitHubProvider = 1;
  Object.defineProperty(PrivateGitHubProvider, "__esModule", { value: true });
  PrivateGitHubProvider.PrivateGitHubProvider = void 0;
  const builder_util_runtime_1 = requireOut();
  const js_yaml_1 = require$$5;
  const path = require$$1$2;
  const url_1 = require$$2$1;
  const util_1 = requireUtil();
  const GitHubProvider_1 = requireGitHubProvider();
  const Provider_1 = requireProvider();
  let PrivateGitHubProvider$1 = class PrivateGitHubProvider extends GitHubProvider_1.BaseGitHubProvider {
    constructor(options, updater, token, runtimeOptions) {
      super(options, "api.github.com", runtimeOptions);
      this.updater = updater;
      this.token = token;
    }
    createRequestOptions(url, headers) {
      const result = super.createRequestOptions(url, headers);
      result.redirect = "manual";
      return result;
    }
    async getLatestVersion() {
      const cancellationToken = new builder_util_runtime_1.CancellationToken();
      const channelFile = (0, util_1.getChannelFilename)(this.getDefaultChannelName());
      const releaseInfo = await this.getLatestVersionInfo(cancellationToken);
      const asset = releaseInfo.assets.find((it) => it.name === channelFile);
      if (asset == null) {
        throw (0, builder_util_runtime_1.newError)(`Cannot find ${channelFile} in the release ${releaseInfo.html_url || releaseInfo.name}`, "ERR_UPDATER_CHANNEL_FILE_NOT_FOUND");
      }
      const url = new url_1.URL(asset.url);
      let result;
      try {
        result = (0, js_yaml_1.load)(await this.httpRequest(url, this.configureHeaders("application/octet-stream"), cancellationToken));
      } catch (e) {
        if (e instanceof builder_util_runtime_1.HttpError && e.statusCode === 404) {
          throw (0, builder_util_runtime_1.newError)(`Cannot find ${channelFile} in the latest release artifacts (${url}): ${e.stack || e.message}`, "ERR_UPDATER_CHANNEL_FILE_NOT_FOUND");
        }
        throw e;
      }
      result.assets = releaseInfo.assets;
      return result;
    }
    get fileExtraDownloadHeaders() {
      return this.configureHeaders("application/octet-stream");
    }
    configureHeaders(accept) {
      return {
        accept,
        authorization: `token ${this.token}`
      };
    }
    async getLatestVersionInfo(cancellationToken) {
      const allowPrerelease = this.updater.allowPrerelease;
      let basePath = this.basePath;
      if (!allowPrerelease) {
        basePath = `${basePath}/latest`;
      }
      const url = (0, util_1.newUrlFromBase)(basePath, this.baseUrl);
      try {
        const version = JSON.parse(await this.httpRequest(url, this.configureHeaders("application/vnd.github.v3+json"), cancellationToken));
        if (allowPrerelease) {
          const candidates = version.filter((it) => !it.draft);
          return candidates.find((it) => it.prerelease) || candidates[0];
        } else {
          return version;
        }
      } catch (e) {
        throw (0, builder_util_runtime_1.newError)(`Unable to find latest version on GitHub (${url}), please ensure a production release exists: ${e.stack || e.message}`, "ERR_UPDATER_LATEST_VERSION_NOT_FOUND");
      }
    }
    get basePath() {
      return this.computeGithubBasePath(`/repos/${this.options.owner}/${this.options.repo}/releases`);
    }
    resolveFiles(updateInfo) {
      return (0, Provider_1.getFileList)(updateInfo).map((it) => {
        const name = path.posix.basename(it.url).replace(/ /g, "-");
        const asset = updateInfo.assets.find((it2) => it2 != null && it2.name === name);
        if (asset == null) {
          throw (0, builder_util_runtime_1.newError)(`Cannot find asset "${name}" in: ${JSON.stringify(updateInfo.assets, null, 2)}`, "ERR_UPDATER_ASSET_NOT_FOUND");
        }
        return {
          url: new url_1.URL(asset.url),
          info: it
        };
      });
    }
  };
  PrivateGitHubProvider.PrivateGitHubProvider = PrivateGitHubProvider$1;
  return PrivateGitHubProvider;
}
var hasRequiredProviderFactory;
function requireProviderFactory() {
  if (hasRequiredProviderFactory) return providerFactory;
  hasRequiredProviderFactory = 1;
  Object.defineProperty(providerFactory, "__esModule", { value: true });
  providerFactory.isUrlProbablySupportMultiRangeRequests = isUrlProbablySupportMultiRangeRequests;
  providerFactory.createClient = createClient;
  const builder_util_runtime_1 = requireOut();
  const BitbucketProvider_1 = requireBitbucketProvider();
  const GenericProvider_1 = requireGenericProvider();
  const GitHubProvider_1 = requireGitHubProvider();
  const GitLabProvider_1 = requireGitLabProvider();
  const KeygenProvider_1 = requireKeygenProvider();
  const PrivateGitHubProvider_1 = requirePrivateGitHubProvider();
  function isUrlProbablySupportMultiRangeRequests(url) {
    return !url.includes("s3.amazonaws.com");
  }
  function createClient(data, updater, runtimeOptions) {
    if (typeof data === "string") {
      throw (0, builder_util_runtime_1.newError)("Please pass PublishConfiguration object", "ERR_UPDATER_INVALID_PROVIDER_CONFIGURATION");
    }
    const provider = data.provider;
    switch (provider) {
      case "github": {
        const githubOptions = data;
        const token = (githubOptions.private ? process.env["GH_TOKEN"] || process.env["GITHUB_TOKEN"] : null) || githubOptions.token;
        if (token == null) {
          return new GitHubProvider_1.GitHubProvider(githubOptions, updater, runtimeOptions);
        } else {
          return new PrivateGitHubProvider_1.PrivateGitHubProvider(githubOptions, updater, token, runtimeOptions);
        }
      }
      case "bitbucket":
        return new BitbucketProvider_1.BitbucketProvider(data, updater, runtimeOptions);
      case "gitlab":
        return new GitLabProvider_1.GitLabProvider(data, updater, runtimeOptions);
      case "keygen":
        return new KeygenProvider_1.KeygenProvider(data, updater, runtimeOptions);
      case "s3":
      case "spaces":
        return new GenericProvider_1.GenericProvider({
          provider: "generic",
          url: (0, builder_util_runtime_1.getS3LikeProviderBaseUrl)(data),
          channel: data.channel || null
        }, updater, {
          ...runtimeOptions,
          // https://github.com/minio/minio/issues/5285#issuecomment-350428955
          isUseMultipleRangeRequest: false
        });
      case "generic": {
        const options = data;
        return new GenericProvider_1.GenericProvider(options, updater, {
          ...runtimeOptions,
          isUseMultipleRangeRequest: options.useMultipleRangeRequest !== false && isUrlProbablySupportMultiRangeRequests(options.url)
        });
      }
      case "custom": {
        const options = data;
        const constructor = options.updateProvider;
        if (!constructor) {
          throw (0, builder_util_runtime_1.newError)("Custom provider not specified", "ERR_UPDATER_INVALID_PROVIDER_CONFIGURATION");
        }
        return new constructor(options, updater, runtimeOptions);
      }
      default:
        throw (0, builder_util_runtime_1.newError)(`Unsupported provider: ${provider}`, "ERR_UPDATER_UNSUPPORTED_PROVIDER");
    }
  }
  return providerFactory;
}
var GenericDifferentialDownloader = {};
var DifferentialDownloader = {};
var DataSplitter = {};
var downloadPlanBuilder = {};
var hasRequiredDownloadPlanBuilder;
function requireDownloadPlanBuilder() {
  if (hasRequiredDownloadPlanBuilder) return downloadPlanBuilder;
  hasRequiredDownloadPlanBuilder = 1;
  Object.defineProperty(downloadPlanBuilder, "__esModule", { value: true });
  downloadPlanBuilder.OperationKind = void 0;
  downloadPlanBuilder.computeOperations = computeOperations;
  var OperationKind;
  (function(OperationKind2) {
    OperationKind2[OperationKind2["COPY"] = 0] = "COPY";
    OperationKind2[OperationKind2["DOWNLOAD"] = 1] = "DOWNLOAD";
  })(OperationKind || (downloadPlanBuilder.OperationKind = OperationKind = {}));
  function computeOperations(oldBlockMap, newBlockMap, logger) {
    const nameToOldBlocks = buildBlockFileMap(oldBlockMap.files);
    const nameToNewBlocks = buildBlockFileMap(newBlockMap.files);
    let lastOperation = null;
    const blockMapFile = newBlockMap.files[0];
    const operations = [];
    const name = blockMapFile.name;
    const oldEntry = nameToOldBlocks.get(name);
    if (oldEntry == null) {
      throw new Error(`no file ${name} in old blockmap`);
    }
    const newFile = nameToNewBlocks.get(name);
    let changedBlockCount = 0;
    const { checksumToOffset: checksumToOldOffset, checksumToOldSize } = buildChecksumMap(nameToOldBlocks.get(name), oldEntry.offset, logger);
    let newOffset = blockMapFile.offset;
    for (let i = 0; i < newFile.checksums.length; newOffset += newFile.sizes[i], i++) {
      const blockSize = newFile.sizes[i];
      const checksum = newFile.checksums[i];
      let oldOffset = checksumToOldOffset.get(checksum);
      if (oldOffset != null && checksumToOldSize.get(checksum) !== blockSize) {
        logger.warn(`Checksum ("${checksum}") matches, but size differs (old: ${checksumToOldSize.get(checksum)}, new: ${blockSize})`);
        oldOffset = void 0;
      }
      if (oldOffset === void 0) {
        changedBlockCount++;
        if (lastOperation != null && lastOperation.kind === OperationKind.DOWNLOAD && lastOperation.end === newOffset) {
          lastOperation.end += blockSize;
        } else {
          lastOperation = {
            kind: OperationKind.DOWNLOAD,
            start: newOffset,
            end: newOffset + blockSize
            // oldBlocks: null,
          };
          validateAndAdd(lastOperation, operations, checksum, i);
        }
      } else {
        if (lastOperation != null && lastOperation.kind === OperationKind.COPY && lastOperation.end === oldOffset) {
          lastOperation.end += blockSize;
        } else {
          lastOperation = {
            kind: OperationKind.COPY,
            start: oldOffset,
            end: oldOffset + blockSize
            // oldBlocks: [checksum]
          };
          validateAndAdd(lastOperation, operations, checksum, i);
        }
      }
    }
    if (changedBlockCount > 0) {
      logger.info(`File${blockMapFile.name === "file" ? "" : " " + blockMapFile.name} has ${changedBlockCount} changed blocks`);
    }
    return operations;
  }
  const isValidateOperationRange = process.env["DIFFERENTIAL_DOWNLOAD_PLAN_BUILDER_VALIDATE_RANGES"] === "true";
  function validateAndAdd(operation, operations, checksum, index2) {
    if (isValidateOperationRange && operations.length !== 0) {
      const lastOperation = operations[operations.length - 1];
      if (lastOperation.kind === operation.kind && operation.start < lastOperation.end && operation.start > lastOperation.start) {
        const min = [lastOperation.start, lastOperation.end, operation.start, operation.end].reduce((p, v) => p < v ? p : v);
        throw new Error(`operation (block index: ${index2}, checksum: ${checksum}, kind: ${OperationKind[operation.kind]}) overlaps previous operation (checksum: ${checksum}):
abs: ${lastOperation.start} until ${lastOperation.end} and ${operation.start} until ${operation.end}
rel: ${lastOperation.start - min} until ${lastOperation.end - min} and ${operation.start - min} until ${operation.end - min}`);
      }
    }
    operations.push(operation);
  }
  function buildChecksumMap(file2, fileOffset, logger) {
    const checksumToOffset = /* @__PURE__ */ new Map();
    const checksumToSize = /* @__PURE__ */ new Map();
    let offset = fileOffset;
    for (let i = 0; i < file2.checksums.length; i++) {
      const checksum = file2.checksums[i];
      const size = file2.sizes[i];
      const existing = checksumToSize.get(checksum);
      if (existing === void 0) {
        checksumToOffset.set(checksum, offset);
        checksumToSize.set(checksum, size);
      } else if (logger.debug != null) {
        const sizeExplanation = existing === size ? "(same size)" : `(size: ${existing}, this size: ${size})`;
        logger.debug(`${checksum} duplicated in blockmap ${sizeExplanation}, it doesn't lead to broken differential downloader, just corresponding block will be skipped)`);
      }
      offset += size;
    }
    return { checksumToOffset, checksumToOldSize: checksumToSize };
  }
  function buildBlockFileMap(list) {
    const result = /* @__PURE__ */ new Map();
    for (const item of list) {
      result.set(item.name, item);
    }
    return result;
  }
  return downloadPlanBuilder;
}
var hasRequiredDataSplitter;
function requireDataSplitter() {
  if (hasRequiredDataSplitter) return DataSplitter;
  hasRequiredDataSplitter = 1;
  Object.defineProperty(DataSplitter, "__esModule", { value: true });
  DataSplitter.DataSplitter = void 0;
  DataSplitter.copyData = copyData;
  const builder_util_runtime_1 = requireOut();
  const fs_1 = require$$2;
  const stream_1 = require$$0$1;
  const downloadPlanBuilder_1 = requireDownloadPlanBuilder();
  const DOUBLE_CRLF = Buffer.from("\r\n\r\n");
  var ReadState;
  (function(ReadState2) {
    ReadState2[ReadState2["INIT"] = 0] = "INIT";
    ReadState2[ReadState2["HEADER"] = 1] = "HEADER";
    ReadState2[ReadState2["BODY"] = 2] = "BODY";
  })(ReadState || (ReadState = {}));
  function copyData(task, out2, oldFileFd, reject, resolve) {
    const readStream = (0, fs_1.createReadStream)("", {
      fd: oldFileFd,
      autoClose: false,
      start: task.start,
      // end is inclusive
      end: task.end - 1
    });
    readStream.on("error", reject);
    readStream.once("end", resolve);
    readStream.pipe(out2, {
      end: false
    });
  }
  let DataSplitter$1 = class DataSplitter extends stream_1.Writable {
    constructor(out2, options, partIndexToTaskIndex, boundary, partIndexToLength, finishHandler, grandTotalBytes, onProgress) {
      super();
      this.out = out2;
      this.options = options;
      this.partIndexToTaskIndex = partIndexToTaskIndex;
      this.partIndexToLength = partIndexToLength;
      this.finishHandler = finishHandler;
      this.grandTotalBytes = grandTotalBytes;
      this.onProgress = onProgress;
      this.start = Date.now();
      this.nextUpdate = this.start + 1e3;
      this.transferred = 0;
      this.delta = 0;
      this.partIndex = -1;
      this.headerListBuffer = null;
      this.readState = ReadState.INIT;
      this.ignoreByteCount = 0;
      this.remainingPartDataCount = 0;
      this.actualPartLength = 0;
      this.boundaryLength = boundary.length + 4;
      this.ignoreByteCount = this.boundaryLength - 2;
    }
    get isFinished() {
      return this.partIndex === this.partIndexToLength.length;
    }
    // noinspection JSUnusedGlobalSymbols
    _write(data, encoding, callback) {
      if (this.isFinished) {
        console.error(`Trailing ignored data: ${data.length} bytes`);
        return;
      }
      this.handleData(data).then(() => {
        if (this.onProgress) {
          const now = Date.now();
          if ((now >= this.nextUpdate || this.transferred === this.grandTotalBytes) && this.grandTotalBytes && (now - this.start) / 1e3) {
            this.nextUpdate = now + 1e3;
            this.onProgress({
              total: this.grandTotalBytes,
              delta: this.delta,
              transferred: this.transferred,
              percent: this.transferred / this.grandTotalBytes * 100,
              bytesPerSecond: Math.round(this.transferred / ((now - this.start) / 1e3))
            });
            this.delta = 0;
          }
        }
        callback();
      }).catch(callback);
    }
    async handleData(chunk) {
      let start = 0;
      if (this.ignoreByteCount !== 0 && this.remainingPartDataCount !== 0) {
        throw (0, builder_util_runtime_1.newError)("Internal error", "ERR_DATA_SPLITTER_BYTE_COUNT_MISMATCH");
      }
      if (this.ignoreByteCount > 0) {
        const toIgnore = Math.min(this.ignoreByteCount, chunk.length);
        this.ignoreByteCount -= toIgnore;
        start = toIgnore;
      } else if (this.remainingPartDataCount > 0) {
        const toRead = Math.min(this.remainingPartDataCount, chunk.length);
        this.remainingPartDataCount -= toRead;
        await this.processPartData(chunk, 0, toRead);
        start = toRead;
      }
      if (start === chunk.length) {
        return;
      }
      if (this.readState === ReadState.HEADER) {
        const headerListEnd = this.searchHeaderListEnd(chunk, start);
        if (headerListEnd === -1) {
          return;
        }
        start = headerListEnd;
        this.readState = ReadState.BODY;
        this.headerListBuffer = null;
      }
      while (true) {
        if (this.readState === ReadState.BODY) {
          this.readState = ReadState.INIT;
        } else {
          this.partIndex++;
          let taskIndex = this.partIndexToTaskIndex.get(this.partIndex);
          if (taskIndex == null) {
            if (this.isFinished) {
              taskIndex = this.options.end;
            } else {
              throw (0, builder_util_runtime_1.newError)("taskIndex is null", "ERR_DATA_SPLITTER_TASK_INDEX_IS_NULL");
            }
          }
          const prevTaskIndex = this.partIndex === 0 ? this.options.start : this.partIndexToTaskIndex.get(this.partIndex - 1) + 1;
          if (prevTaskIndex < taskIndex) {
            await this.copyExistingData(prevTaskIndex, taskIndex);
          } else if (prevTaskIndex > taskIndex) {
            throw (0, builder_util_runtime_1.newError)("prevTaskIndex must be < taskIndex", "ERR_DATA_SPLITTER_TASK_INDEX_ASSERT_FAILED");
          }
          if (this.isFinished) {
            this.onPartEnd();
            this.finishHandler();
            return;
          }
          start = this.searchHeaderListEnd(chunk, start);
          if (start === -1) {
            this.readState = ReadState.HEADER;
            return;
          }
        }
        const partLength = this.partIndexToLength[this.partIndex];
        const end = start + partLength;
        const effectiveEnd = Math.min(end, chunk.length);
        await this.processPartStarted(chunk, start, effectiveEnd);
        this.remainingPartDataCount = partLength - (effectiveEnd - start);
        if (this.remainingPartDataCount > 0) {
          return;
        }
        start = end + this.boundaryLength;
        if (start >= chunk.length) {
          this.ignoreByteCount = this.boundaryLength - (chunk.length - end);
          return;
        }
      }
    }
    copyExistingData(index2, end) {
      return new Promise((resolve, reject) => {
        const w = () => {
          if (index2 === end) {
            resolve();
            return;
          }
          const task = this.options.tasks[index2];
          if (task.kind !== downloadPlanBuilder_1.OperationKind.COPY) {
            reject(new Error("Task kind must be COPY"));
            return;
          }
          copyData(task, this.out, this.options.oldFileFd, reject, () => {
            index2++;
            w();
          });
        };
        w();
      });
    }
    searchHeaderListEnd(chunk, readOffset) {
      const headerListEnd = chunk.indexOf(DOUBLE_CRLF, readOffset);
      if (headerListEnd !== -1) {
        return headerListEnd + DOUBLE_CRLF.length;
      }
      const partialChunk = readOffset === 0 ? chunk : chunk.slice(readOffset);
      if (this.headerListBuffer == null) {
        this.headerListBuffer = partialChunk;
      } else {
        this.headerListBuffer = Buffer.concat([this.headerListBuffer, partialChunk]);
      }
      return -1;
    }
    onPartEnd() {
      const expectedLength = this.partIndexToLength[this.partIndex - 1];
      if (this.actualPartLength !== expectedLength) {
        throw (0, builder_util_runtime_1.newError)(`Expected length: ${expectedLength} differs from actual: ${this.actualPartLength}`, "ERR_DATA_SPLITTER_LENGTH_MISMATCH");
      }
      this.actualPartLength = 0;
    }
    processPartStarted(data, start, end) {
      if (this.partIndex !== 0) {
        this.onPartEnd();
      }
      return this.processPartData(data, start, end);
    }
    processPartData(data, start, end) {
      this.actualPartLength += end - start;
      this.transferred += end - start;
      this.delta += end - start;
      const out2 = this.out;
      if (out2.write(start === 0 && data.length === end ? data : data.slice(start, end))) {
        return Promise.resolve();
      } else {
        return new Promise((resolve, reject) => {
          out2.on("error", reject);
          out2.once("drain", () => {
            out2.removeListener("error", reject);
            resolve();
          });
        });
      }
    }
  };
  DataSplitter.DataSplitter = DataSplitter$1;
  return DataSplitter;
}
var multipleRangeDownloader = {};
var hasRequiredMultipleRangeDownloader;
function requireMultipleRangeDownloader() {
  if (hasRequiredMultipleRangeDownloader) return multipleRangeDownloader;
  hasRequiredMultipleRangeDownloader = 1;
  Object.defineProperty(multipleRangeDownloader, "__esModule", { value: true });
  multipleRangeDownloader.executeTasksUsingMultipleRangeRequests = executeTasksUsingMultipleRangeRequests;
  multipleRangeDownloader.checkIsRangesSupported = checkIsRangesSupported;
  const builder_util_runtime_1 = requireOut();
  const DataSplitter_1 = requireDataSplitter();
  const downloadPlanBuilder_1 = requireDownloadPlanBuilder();
  function executeTasksUsingMultipleRangeRequests(differentialDownloader, tasks, out2, oldFileFd, reject) {
    const w = (taskOffset) => {
      if (taskOffset >= tasks.length) {
        if (differentialDownloader.fileMetadataBuffer != null) {
          out2.write(differentialDownloader.fileMetadataBuffer);
        }
        out2.end();
        return;
      }
      const nextOffset = taskOffset + 1e3;
      doExecuteTasks(differentialDownloader, {
        tasks,
        start: taskOffset,
        end: Math.min(tasks.length, nextOffset),
        oldFileFd
      }, out2, () => w(nextOffset), reject);
    };
    return w;
  }
  function doExecuteTasks(differentialDownloader, options, out2, resolve, reject) {
    let ranges = "bytes=";
    let partCount = 0;
    let grandTotalBytes = 0;
    const partIndexToTaskIndex = /* @__PURE__ */ new Map();
    const partIndexToLength = [];
    for (let i = options.start; i < options.end; i++) {
      const task = options.tasks[i];
      if (task.kind === downloadPlanBuilder_1.OperationKind.DOWNLOAD) {
        ranges += `${task.start}-${task.end - 1}, `;
        partIndexToTaskIndex.set(partCount, i);
        partCount++;
        partIndexToLength.push(task.end - task.start);
        grandTotalBytes += task.end - task.start;
      }
    }
    if (partCount <= 1) {
      const w = (index2) => {
        if (index2 >= options.end) {
          resolve();
          return;
        }
        const task = options.tasks[index2++];
        if (task.kind === downloadPlanBuilder_1.OperationKind.COPY) {
          (0, DataSplitter_1.copyData)(task, out2, options.oldFileFd, reject, () => w(index2));
        } else {
          const requestOptions2 = differentialDownloader.createRequestOptions();
          requestOptions2.headers.Range = `bytes=${task.start}-${task.end - 1}`;
          const request2 = differentialDownloader.httpExecutor.createRequest(requestOptions2, (response) => {
            response.on("error", reject);
            if (!checkIsRangesSupported(response, reject)) {
              return;
            }
            response.pipe(out2, {
              end: false
            });
            response.once("end", () => w(index2));
          });
          differentialDownloader.httpExecutor.addErrorAndTimeoutHandlers(request2, reject);
          request2.end();
        }
      };
      w(options.start);
      return;
    }
    const requestOptions = differentialDownloader.createRequestOptions();
    requestOptions.headers.Range = ranges.substring(0, ranges.length - 2);
    const request = differentialDownloader.httpExecutor.createRequest(requestOptions, (response) => {
      if (!checkIsRangesSupported(response, reject)) {
        return;
      }
      const contentType = (0, builder_util_runtime_1.safeGetHeader)(response, "content-type");
      const m = /^multipart\/.+?\s*;\s*boundary=(?:"([^"]+)"|([^\s";]+))\s*$/i.exec(contentType);
      if (m == null) {
        reject(new Error(`Content-Type "multipart/byteranges" is expected, but got "${contentType}"`));
        return;
      }
      const dicer = new DataSplitter_1.DataSplitter(out2, options, partIndexToTaskIndex, m[1] || m[2], partIndexToLength, resolve, grandTotalBytes, differentialDownloader.options.onProgress);
      dicer.on("error", reject);
      response.pipe(dicer);
      response.on("end", () => {
        setTimeout(() => {
          request.abort();
          reject(new Error("Response ends without calling any handlers"));
        }, 1e4);
      });
    });
    differentialDownloader.httpExecutor.addErrorAndTimeoutHandlers(request, reject);
    request.end();
  }
  function checkIsRangesSupported(response, reject) {
    if (response.statusCode >= 400) {
      reject((0, builder_util_runtime_1.createHttpError)(response));
      return false;
    }
    if (response.statusCode !== 206) {
      const acceptRanges = (0, builder_util_runtime_1.safeGetHeader)(response, "accept-ranges");
      if (acceptRanges == null || acceptRanges === "none") {
        reject(new Error(`Server doesn't support Accept-Ranges (response code ${response.statusCode})`));
        return false;
      }
    }
    return true;
  }
  return multipleRangeDownloader;
}
var ProgressDifferentialDownloadCallbackTransform = {};
var hasRequiredProgressDifferentialDownloadCallbackTransform;
function requireProgressDifferentialDownloadCallbackTransform() {
  if (hasRequiredProgressDifferentialDownloadCallbackTransform) return ProgressDifferentialDownloadCallbackTransform;
  hasRequiredProgressDifferentialDownloadCallbackTransform = 1;
  Object.defineProperty(ProgressDifferentialDownloadCallbackTransform, "__esModule", { value: true });
  ProgressDifferentialDownloadCallbackTransform.ProgressDifferentialDownloadCallbackTransform = void 0;
  const stream_1 = require$$0$1;
  var OperationKind;
  (function(OperationKind2) {
    OperationKind2[OperationKind2["COPY"] = 0] = "COPY";
    OperationKind2[OperationKind2["DOWNLOAD"] = 1] = "DOWNLOAD";
  })(OperationKind || (OperationKind = {}));
  let ProgressDifferentialDownloadCallbackTransform$1 = class ProgressDifferentialDownloadCallbackTransform extends stream_1.Transform {
    constructor(progressDifferentialDownloadInfo, cancellationToken, onProgress) {
      super();
      this.progressDifferentialDownloadInfo = progressDifferentialDownloadInfo;
      this.cancellationToken = cancellationToken;
      this.onProgress = onProgress;
      this.start = Date.now();
      this.transferred = 0;
      this.delta = 0;
      this.expectedBytes = 0;
      this.index = 0;
      this.operationType = OperationKind.COPY;
      this.nextUpdate = this.start + 1e3;
    }
    _transform(chunk, encoding, callback) {
      if (this.cancellationToken.cancelled) {
        callback(new Error("cancelled"), null);
        return;
      }
      if (this.operationType == OperationKind.COPY) {
        callback(null, chunk);
        return;
      }
      this.transferred += chunk.length;
      this.delta += chunk.length;
      const now = Date.now();
      if (now >= this.nextUpdate && this.transferred !== this.expectedBytes && this.transferred !== this.progressDifferentialDownloadInfo.grandTotal) {
        this.nextUpdate = now + 1e3;
        this.onProgress({
          total: this.progressDifferentialDownloadInfo.grandTotal,
          delta: this.delta,
          transferred: this.transferred,
          percent: this.transferred / this.progressDifferentialDownloadInfo.grandTotal * 100,
          bytesPerSecond: Math.round(this.transferred / ((now - this.start) / 1e3))
        });
        this.delta = 0;
      }
      callback(null, chunk);
    }
    beginFileCopy() {
      this.operationType = OperationKind.COPY;
    }
    beginRangeDownload() {
      this.operationType = OperationKind.DOWNLOAD;
      this.expectedBytes += this.progressDifferentialDownloadInfo.expectedByteCounts[this.index++];
    }
    endRangeDownload() {
      if (this.transferred !== this.progressDifferentialDownloadInfo.grandTotal) {
        this.onProgress({
          total: this.progressDifferentialDownloadInfo.grandTotal,
          delta: this.delta,
          transferred: this.transferred,
          percent: this.transferred / this.progressDifferentialDownloadInfo.grandTotal * 100,
          bytesPerSecond: Math.round(this.transferred / ((Date.now() - this.start) / 1e3))
        });
      }
    }
    // Called when we are 100% done with the connection/download
    _flush(callback) {
      if (this.cancellationToken.cancelled) {
        callback(new Error("cancelled"));
        return;
      }
      this.onProgress({
        total: this.progressDifferentialDownloadInfo.grandTotal,
        delta: this.delta,
        transferred: this.transferred,
        percent: 100,
        bytesPerSecond: Math.round(this.transferred / ((Date.now() - this.start) / 1e3))
      });
      this.delta = 0;
      this.transferred = 0;
      callback(null);
    }
  };
  ProgressDifferentialDownloadCallbackTransform.ProgressDifferentialDownloadCallbackTransform = ProgressDifferentialDownloadCallbackTransform$1;
  return ProgressDifferentialDownloadCallbackTransform;
}
var hasRequiredDifferentialDownloader;
function requireDifferentialDownloader() {
  if (hasRequiredDifferentialDownloader) return DifferentialDownloader;
  hasRequiredDifferentialDownloader = 1;
  Object.defineProperty(DifferentialDownloader, "__esModule", { value: true });
  DifferentialDownloader.DifferentialDownloader = void 0;
  const builder_util_runtime_1 = requireOut();
  const fs_extra_1 = /* @__PURE__ */ requireLib();
  const fs_1 = require$$2;
  const DataSplitter_1 = requireDataSplitter();
  const url_1 = require$$2$1;
  const downloadPlanBuilder_1 = requireDownloadPlanBuilder();
  const multipleRangeDownloader_1 = requireMultipleRangeDownloader();
  const ProgressDifferentialDownloadCallbackTransform_1 = requireProgressDifferentialDownloadCallbackTransform();
  let DifferentialDownloader$1 = class DifferentialDownloader {
    // noinspection TypeScriptAbstractClassConstructorCanBeMadeProtected
    constructor(blockAwareFileInfo, httpExecutor2, options) {
      this.blockAwareFileInfo = blockAwareFileInfo;
      this.httpExecutor = httpExecutor2;
      this.options = options;
      this.fileMetadataBuffer = null;
      this.logger = options.logger;
    }
    createRequestOptions() {
      const result = {
        headers: {
          ...this.options.requestHeaders,
          accept: "*/*"
        }
      };
      (0, builder_util_runtime_1.configureRequestUrl)(this.options.newUrl, result);
      (0, builder_util_runtime_1.configureRequestOptions)(result);
      return result;
    }
    doDownload(oldBlockMap, newBlockMap) {
      if (oldBlockMap.version !== newBlockMap.version) {
        throw new Error(`version is different (${oldBlockMap.version} - ${newBlockMap.version}), full download is required`);
      }
      const logger = this.logger;
      const operations = (0, downloadPlanBuilder_1.computeOperations)(oldBlockMap, newBlockMap, logger);
      if (logger.debug != null) {
        logger.debug(JSON.stringify(operations, null, 2));
      }
      let downloadSize = 0;
      let copySize = 0;
      for (const operation of operations) {
        const length = operation.end - operation.start;
        if (operation.kind === downloadPlanBuilder_1.OperationKind.DOWNLOAD) {
          downloadSize += length;
        } else {
          copySize += length;
        }
      }
      const newSize = this.blockAwareFileInfo.size;
      if (downloadSize + copySize + (this.fileMetadataBuffer == null ? 0 : this.fileMetadataBuffer.length) !== newSize) {
        throw new Error(`Internal error, size mismatch: downloadSize: ${downloadSize}, copySize: ${copySize}, newSize: ${newSize}`);
      }
      logger.info(`Full: ${formatBytes(newSize)}, To download: ${formatBytes(downloadSize)} (${Math.round(downloadSize / (newSize / 100))}%)`);
      return this.downloadFile(operations);
    }
    downloadFile(tasks) {
      const fdList = [];
      const closeFiles = () => {
        return Promise.all(fdList.map((openedFile) => {
          return (0, fs_extra_1.close)(openedFile.descriptor).catch((e) => {
            this.logger.error(`cannot close file "${openedFile.path}": ${e}`);
          });
        }));
      };
      return this.doDownloadFile(tasks, fdList).then(closeFiles).catch((e) => {
        return closeFiles().catch((closeFilesError) => {
          try {
            this.logger.error(`cannot close files: ${closeFilesError}`);
          } catch (errorOnLog) {
            try {
              console.error(errorOnLog);
            } catch (_ignored) {
            }
          }
          throw e;
        }).then(() => {
          throw e;
        });
      });
    }
    async doDownloadFile(tasks, fdList) {
      const oldFileFd = await (0, fs_extra_1.open)(this.options.oldFile, "r");
      fdList.push({ descriptor: oldFileFd, path: this.options.oldFile });
      const newFileFd = await (0, fs_extra_1.open)(this.options.newFile, "w");
      fdList.push({ descriptor: newFileFd, path: this.options.newFile });
      const fileOut = (0, fs_1.createWriteStream)(this.options.newFile, { fd: newFileFd });
      await new Promise((resolve, reject) => {
        const streams = [];
        let downloadInfoTransform = void 0;
        if (!this.options.isUseMultipleRangeRequest && this.options.onProgress) {
          const expectedByteCounts = [];
          let grandTotalBytes = 0;
          for (const task of tasks) {
            if (task.kind === downloadPlanBuilder_1.OperationKind.DOWNLOAD) {
              expectedByteCounts.push(task.end - task.start);
              grandTotalBytes += task.end - task.start;
            }
          }
          const progressDifferentialDownloadInfo = {
            expectedByteCounts,
            grandTotal: grandTotalBytes
          };
          downloadInfoTransform = new ProgressDifferentialDownloadCallbackTransform_1.ProgressDifferentialDownloadCallbackTransform(progressDifferentialDownloadInfo, this.options.cancellationToken, this.options.onProgress);
          streams.push(downloadInfoTransform);
        }
        const digestTransform = new builder_util_runtime_1.DigestTransform(this.blockAwareFileInfo.sha512);
        digestTransform.isValidateOnEnd = false;
        streams.push(digestTransform);
        fileOut.on("finish", () => {
          fileOut.close(() => {
            fdList.splice(1, 1);
            try {
              digestTransform.validate();
            } catch (e) {
              reject(e);
              return;
            }
            resolve(void 0);
          });
        });
        streams.push(fileOut);
        let lastStream = null;
        for (const stream of streams) {
          stream.on("error", reject);
          if (lastStream == null) {
            lastStream = stream;
          } else {
            lastStream = lastStream.pipe(stream);
          }
        }
        const firstStream = streams[0];
        let w;
        if (this.options.isUseMultipleRangeRequest) {
          w = (0, multipleRangeDownloader_1.executeTasksUsingMultipleRangeRequests)(this, tasks, firstStream, oldFileFd, reject);
          w(0);
          return;
        }
        let downloadOperationCount = 0;
        let actualUrl = null;
        this.logger.info(`Differential download: ${this.options.newUrl}`);
        const requestOptions = this.createRequestOptions();
        requestOptions.redirect = "manual";
        w = (index2) => {
          var _a, _b;
          if (index2 >= tasks.length) {
            if (this.fileMetadataBuffer != null) {
              firstStream.write(this.fileMetadataBuffer);
            }
            firstStream.end();
            return;
          }
          const operation = tasks[index2++];
          if (operation.kind === downloadPlanBuilder_1.OperationKind.COPY) {
            if (downloadInfoTransform) {
              downloadInfoTransform.beginFileCopy();
            }
            (0, DataSplitter_1.copyData)(operation, firstStream, oldFileFd, reject, () => w(index2));
            return;
          }
          const range2 = `bytes=${operation.start}-${operation.end - 1}`;
          requestOptions.headers.range = range2;
          (_b = (_a = this.logger) === null || _a === void 0 ? void 0 : _a.debug) === null || _b === void 0 ? void 0 : _b.call(_a, `download range: ${range2}`);
          if (downloadInfoTransform) {
            downloadInfoTransform.beginRangeDownload();
          }
          const request = this.httpExecutor.createRequest(requestOptions, (response) => {
            response.on("error", reject);
            response.on("aborted", () => {
              reject(new Error("response has been aborted by the server"));
            });
            if (response.statusCode >= 400) {
              reject((0, builder_util_runtime_1.createHttpError)(response));
            }
            response.pipe(firstStream, {
              end: false
            });
            response.once("end", () => {
              if (downloadInfoTransform) {
                downloadInfoTransform.endRangeDownload();
              }
              if (++downloadOperationCount === 100) {
                downloadOperationCount = 0;
                setTimeout(() => w(index2), 1e3);
              } else {
                w(index2);
              }
            });
          });
          request.on("redirect", (statusCode, method, redirectUrl) => {
            this.logger.info(`Redirect to ${removeQuery(redirectUrl)}`);
            actualUrl = redirectUrl;
            (0, builder_util_runtime_1.configureRequestUrl)(new url_1.URL(actualUrl), requestOptions);
            request.followRedirect();
          });
          this.httpExecutor.addErrorAndTimeoutHandlers(request, reject);
          request.end();
        };
        w(0);
      });
    }
    async readRemoteBytes(start, endInclusive) {
      const buffer = Buffer.allocUnsafe(endInclusive + 1 - start);
      const requestOptions = this.createRequestOptions();
      requestOptions.headers.range = `bytes=${start}-${endInclusive}`;
      let position = 0;
      await this.request(requestOptions, (chunk) => {
        chunk.copy(buffer, position);
        position += chunk.length;
      });
      if (position !== buffer.length) {
        throw new Error(`Received data length ${position} is not equal to expected ${buffer.length}`);
      }
      return buffer;
    }
    request(requestOptions, dataHandler) {
      return new Promise((resolve, reject) => {
        const request = this.httpExecutor.createRequest(requestOptions, (response) => {
          if (!(0, multipleRangeDownloader_1.checkIsRangesSupported)(response, reject)) {
            return;
          }
          response.on("error", reject);
          response.on("aborted", () => {
            reject(new Error("response has been aborted by the server"));
          });
          response.on("data", dataHandler);
          response.on("end", () => resolve());
        });
        this.httpExecutor.addErrorAndTimeoutHandlers(request, reject);
        request.end();
      });
    }
  };
  DifferentialDownloader.DifferentialDownloader = DifferentialDownloader$1;
  function formatBytes(value, symbol = " KB") {
    return new Intl.NumberFormat("en").format((value / 1024).toFixed(2)) + symbol;
  }
  function removeQuery(url) {
    const index2 = url.indexOf("?");
    return index2 < 0 ? url : url.substring(0, index2);
  }
  return DifferentialDownloader;
}
var hasRequiredGenericDifferentialDownloader;
function requireGenericDifferentialDownloader() {
  if (hasRequiredGenericDifferentialDownloader) return GenericDifferentialDownloader;
  hasRequiredGenericDifferentialDownloader = 1;
  Object.defineProperty(GenericDifferentialDownloader, "__esModule", { value: true });
  GenericDifferentialDownloader.GenericDifferentialDownloader = void 0;
  const DifferentialDownloader_1 = requireDifferentialDownloader();
  let GenericDifferentialDownloader$1 = class GenericDifferentialDownloader extends DifferentialDownloader_1.DifferentialDownloader {
    download(oldBlockMap, newBlockMap) {
      return this.doDownload(oldBlockMap, newBlockMap);
    }
  };
  GenericDifferentialDownloader.GenericDifferentialDownloader = GenericDifferentialDownloader$1;
  return GenericDifferentialDownloader;
}
var types = {};
var hasRequiredTypes;
function requireTypes() {
  if (hasRequiredTypes) return types;
  hasRequiredTypes = 1;
  (function(exports2) {
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.UpdaterSignal = exports2.UPDATE_DOWNLOADED = exports2.DOWNLOAD_PROGRESS = exports2.CancellationToken = void 0;
    exports2.addHandler = addHandler;
    const builder_util_runtime_1 = requireOut();
    Object.defineProperty(exports2, "CancellationToken", { enumerable: true, get: function() {
      return builder_util_runtime_1.CancellationToken;
    } });
    exports2.DOWNLOAD_PROGRESS = "download-progress";
    exports2.UPDATE_DOWNLOADED = "update-downloaded";
    class UpdaterSignal {
      constructor(emitter) {
        this.emitter = emitter;
      }
      /**
       * Emitted when an authenticating proxy is [asking for user credentials](https://github.com/electron/electron/blob/master/docs/api/client-request.md#event-login).
       */
      login(handler) {
        addHandler(this.emitter, "login", handler);
      }
      progress(handler) {
        addHandler(this.emitter, exports2.DOWNLOAD_PROGRESS, handler);
      }
      updateDownloaded(handler) {
        addHandler(this.emitter, exports2.UPDATE_DOWNLOADED, handler);
      }
      updateCancelled(handler) {
        addHandler(this.emitter, "update-cancelled", handler);
      }
    }
    exports2.UpdaterSignal = UpdaterSignal;
    function addHandler(emitter, event, handler) {
      {
        emitter.on(event, handler);
      }
    }
  })(types);
  return types;
}
var hasRequiredAppUpdater;
function requireAppUpdater() {
  if (hasRequiredAppUpdater) return AppUpdater;
  hasRequiredAppUpdater = 1;
  Object.defineProperty(AppUpdater, "__esModule", { value: true });
  AppUpdater.NoOpLogger = AppUpdater.AppUpdater = void 0;
  const builder_util_runtime_1 = requireOut();
  const crypto_1 = require$$0$3;
  const os_1 = require$$3;
  const events_1 = require$$0$2;
  const fs_extra_1 = /* @__PURE__ */ requireLib();
  const js_yaml_1 = require$$5;
  const lazy_val_1 = requireMain$2();
  const path = require$$1$2;
  const semver_1 = requireSemver();
  const DownloadedUpdateHelper_1 = requireDownloadedUpdateHelper();
  const ElectronAppAdapter_1 = requireElectronAppAdapter();
  const electronHttpExecutor_1 = requireElectronHttpExecutor();
  const GenericProvider_1 = requireGenericProvider();
  const providerFactory_1 = requireProviderFactory();
  const zlib_1 = require$$14;
  const GenericDifferentialDownloader_1 = requireGenericDifferentialDownloader();
  const types_1 = requireTypes();
  let AppUpdater$1 = class AppUpdater2 extends events_1.EventEmitter {
    /**
     * Get the update channel. Doesn't return `channel` from the update configuration, only if was previously set.
     */
    get channel() {
      return this._channel;
    }
    /**
     * Set the update channel. Overrides `channel` in the update configuration.
     *
     * `allowDowngrade` will be automatically set to `true`. If this behavior is not suitable for you, simple set `allowDowngrade` explicitly after.
     */
    set channel(value) {
      if (this._channel != null) {
        if (typeof value !== "string") {
          throw (0, builder_util_runtime_1.newError)(`Channel must be a string, but got: ${value}`, "ERR_UPDATER_INVALID_CHANNEL");
        } else if (value.length === 0) {
          throw (0, builder_util_runtime_1.newError)(`Channel must be not an empty string`, "ERR_UPDATER_INVALID_CHANNEL");
        }
      }
      this._channel = value;
      this.allowDowngrade = true;
    }
    /**
     *  Shortcut for explicitly adding auth tokens to request headers
     */
    addAuthHeader(token) {
      this.requestHeaders = Object.assign({}, this.requestHeaders, {
        authorization: token
      });
    }
    // noinspection JSMethodCanBeStatic,JSUnusedGlobalSymbols
    get netSession() {
      return (0, electronHttpExecutor_1.getNetSession)();
    }
    /**
     * The logger. You can pass [electron-log](https://github.com/megahertz/electron-log), [winston](https://github.com/winstonjs/winston) or another logger with the following interface: `{ info(), warn(), error() }`.
     * Set it to `null` if you would like to disable a logging feature.
     */
    get logger() {
      return this._logger;
    }
    set logger(value) {
      this._logger = value == null ? new NoOpLogger() : value;
    }
    // noinspection JSUnusedGlobalSymbols
    /**
     * test only
     * @private
     */
    set updateConfigPath(value) {
      this.clientPromise = null;
      this._appUpdateConfigPath = value;
      this.configOnDisk = new lazy_val_1.Lazy(() => this.loadUpdateConfig());
    }
    /**
     * Allows developer to override default logic for determining if an update is supported.
     * The default logic compares the `UpdateInfo` minimum system version against the `os.release()` with `semver` package
     */
    get isUpdateSupported() {
      return this._isUpdateSupported;
    }
    set isUpdateSupported(value) {
      if (value) {
        this._isUpdateSupported = value;
      }
    }
    /**
     * Allows developer to override default logic for determining if the user is below the rollout threshold.
     * The default logic compares the staging percentage with numerical representation of user ID.
     * An override can define custom logic, or bypass it if needed.
     */
    get isUserWithinRollout() {
      return this._isUserWithinRollout;
    }
    set isUserWithinRollout(value) {
      if (value) {
        this._isUserWithinRollout = value;
      }
    }
    constructor(options, app) {
      super();
      this.autoDownload = true;
      this.autoInstallOnAppQuit = true;
      this.autoRunAppAfterInstall = true;
      this.allowPrerelease = false;
      this.fullChangelog = false;
      this.allowDowngrade = false;
      this.disableWebInstaller = false;
      this.disableDifferentialDownload = false;
      this.forceDevUpdateConfig = false;
      this.previousBlockmapBaseUrlOverride = null;
      this._channel = null;
      this.downloadedUpdateHelper = null;
      this.requestHeaders = null;
      this._logger = console;
      this.signals = new types_1.UpdaterSignal(this);
      this._appUpdateConfigPath = null;
      this._isUpdateSupported = (updateInfo) => this.checkIfUpdateSupported(updateInfo);
      this._isUserWithinRollout = (updateInfo) => this.isStagingMatch(updateInfo);
      this.clientPromise = null;
      this.stagingUserIdPromise = new lazy_val_1.Lazy(() => this.getOrCreateStagingUserId());
      this.configOnDisk = new lazy_val_1.Lazy(() => this.loadUpdateConfig());
      this.checkForUpdatesPromise = null;
      this.downloadPromise = null;
      this.updateInfoAndProvider = null;
      this._testOnlyOptions = null;
      this.on("error", (error2) => {
        this._logger.error(`Error: ${error2.stack || error2.message}`);
      });
      if (app == null) {
        this.app = new ElectronAppAdapter_1.ElectronAppAdapter();
        this.httpExecutor = new electronHttpExecutor_1.ElectronHttpExecutor((authInfo, callback) => this.emit("login", authInfo, callback));
      } else {
        this.app = app;
        this.httpExecutor = null;
      }
      const currentVersionString = this.app.version;
      const currentVersion = (0, semver_1.parse)(currentVersionString);
      if (currentVersion == null) {
        throw (0, builder_util_runtime_1.newError)(`App version is not a valid semver version: "${currentVersionString}"`, "ERR_UPDATER_INVALID_VERSION");
      }
      this.currentVersion = currentVersion;
      this.allowPrerelease = hasPrereleaseComponents(currentVersion);
      if (options != null) {
        this.setFeedURL(options);
        if (typeof options !== "string" && options.requestHeaders) {
          this.requestHeaders = options.requestHeaders;
        }
      }
    }
    //noinspection JSMethodCanBeStatic,JSUnusedGlobalSymbols
    getFeedURL() {
      return "Deprecated. Do not use it.";
    }
    /**
     * Configure update provider. If value is `string`, [GenericServerOptions](https://www.electron.build/publish#genericserveroptions) will be set with value as `url`.
     * @param options If you want to override configuration in the `app-update.yml`.
     */
    setFeedURL(options) {
      const runtimeOptions = this.createProviderRuntimeOptions();
      let provider;
      if (typeof options === "string") {
        provider = new GenericProvider_1.GenericProvider({ provider: "generic", url: options }, this, {
          ...runtimeOptions,
          isUseMultipleRangeRequest: (0, providerFactory_1.isUrlProbablySupportMultiRangeRequests)(options)
        });
      } else {
        provider = (0, providerFactory_1.createClient)(options, this, runtimeOptions);
      }
      this.clientPromise = Promise.resolve(provider);
    }
    /**
     * Asks the server whether there is an update.
     * @returns null if the updater is disabled, otherwise info about the latest version
     */
    checkForUpdates() {
      if (!this.isUpdaterActive()) {
        return Promise.resolve(null);
      }
      let checkForUpdatesPromise = this.checkForUpdatesPromise;
      if (checkForUpdatesPromise != null) {
        this._logger.info("Checking for update (already in progress)");
        return checkForUpdatesPromise;
      }
      const nullizePromise = () => this.checkForUpdatesPromise = null;
      this._logger.info("Checking for update");
      checkForUpdatesPromise = this.doCheckForUpdates().then((it) => {
        nullizePromise();
        return it;
      }).catch((e) => {
        nullizePromise();
        this.emit("error", e, `Cannot check for updates: ${(e.stack || e).toString()}`);
        throw e;
      });
      this.checkForUpdatesPromise = checkForUpdatesPromise;
      return checkForUpdatesPromise;
    }
    isUpdaterActive() {
      const isEnabled = this.app.isPackaged || this.forceDevUpdateConfig;
      if (!isEnabled) {
        this._logger.info("Skip checkForUpdates because application is not packed and dev update config is not forced");
        return false;
      }
      return true;
    }
    // noinspection JSUnusedGlobalSymbols
    checkForUpdatesAndNotify(downloadNotification) {
      return this.checkForUpdates().then((it) => {
        if (!(it === null || it === void 0 ? void 0 : it.downloadPromise)) {
          if (this._logger.debug != null) {
            this._logger.debug("checkForUpdatesAndNotify called, downloadPromise is null");
          }
          return it;
        }
        void it.downloadPromise.then(() => {
          const notificationContent = AppUpdater2.formatDownloadNotification(it.updateInfo.version, this.app.name, downloadNotification);
          new require$$1.Notification(notificationContent).show();
        });
        return it;
      });
    }
    static formatDownloadNotification(version, appName, downloadNotification) {
      if (downloadNotification == null) {
        downloadNotification = {
          title: "A new update is ready to install",
          body: `{appName} version {version} has been downloaded and will be automatically installed on exit`
        };
      }
      downloadNotification = {
        title: downloadNotification.title.replace("{appName}", appName).replace("{version}", version),
        body: downloadNotification.body.replace("{appName}", appName).replace("{version}", version)
      };
      return downloadNotification;
    }
    async isStagingMatch(updateInfo) {
      const rawStagingPercentage = updateInfo.stagingPercentage;
      let stagingPercentage = rawStagingPercentage;
      if (stagingPercentage == null) {
        return true;
      }
      stagingPercentage = parseInt(stagingPercentage, 10);
      if (isNaN(stagingPercentage)) {
        this._logger.warn(`Staging percentage is NaN: ${rawStagingPercentage}`);
        return true;
      }
      stagingPercentage = stagingPercentage / 100;
      const stagingUserId = await this.stagingUserIdPromise.value;
      const val = builder_util_runtime_1.UUID.parse(stagingUserId).readUInt32BE(12);
      const percentage = val / 4294967295;
      this._logger.info(`Staging percentage: ${stagingPercentage}, percentage: ${percentage}, user id: ${stagingUserId}`);
      return percentage < stagingPercentage;
    }
    computeFinalHeaders(headers) {
      if (this.requestHeaders != null) {
        Object.assign(headers, this.requestHeaders);
      }
      return headers;
    }
    async isUpdateAvailable(updateInfo) {
      const latestVersion = (0, semver_1.parse)(updateInfo.version);
      if (latestVersion == null) {
        throw (0, builder_util_runtime_1.newError)(`This file could not be downloaded, or the latest version (from update server) does not have a valid semver version: "${updateInfo.version}"`, "ERR_UPDATER_INVALID_VERSION");
      }
      const currentVersion = this.currentVersion;
      if ((0, semver_1.eq)(latestVersion, currentVersion)) {
        return false;
      }
      if (!await Promise.resolve(this.isUpdateSupported(updateInfo))) {
        return false;
      }
      const isUserWithinRollout = await Promise.resolve(this.isUserWithinRollout(updateInfo));
      if (!isUserWithinRollout) {
        return false;
      }
      const isLatestVersionNewer = (0, semver_1.gt)(latestVersion, currentVersion);
      const isLatestVersionOlder = (0, semver_1.lt)(latestVersion, currentVersion);
      if (isLatestVersionNewer) {
        return true;
      }
      return this.allowDowngrade && isLatestVersionOlder;
    }
    checkIfUpdateSupported(updateInfo) {
      const minimumSystemVersion = updateInfo === null || updateInfo === void 0 ? void 0 : updateInfo.minimumSystemVersion;
      const currentOSVersion = (0, os_1.release)();
      if (minimumSystemVersion) {
        try {
          if ((0, semver_1.lt)(currentOSVersion, minimumSystemVersion)) {
            this._logger.info(`Current OS version ${currentOSVersion} is less than the minimum OS version required ${minimumSystemVersion} for version ${currentOSVersion}`);
            return false;
          }
        } catch (e) {
          this._logger.warn(`Failed to compare current OS version(${currentOSVersion}) with minimum OS version(${minimumSystemVersion}): ${(e.message || e).toString()}`);
        }
      }
      return true;
    }
    async getUpdateInfoAndProvider() {
      await this.app.whenReady();
      if (this.clientPromise == null) {
        this.clientPromise = this.configOnDisk.value.then((it) => (0, providerFactory_1.createClient)(it, this, this.createProviderRuntimeOptions()));
      }
      const client = await this.clientPromise;
      const stagingUserId = await this.stagingUserIdPromise.value;
      client.setRequestHeaders(this.computeFinalHeaders({ "x-user-staging-id": stagingUserId }));
      return {
        info: await client.getLatestVersion(),
        provider: client
      };
    }
    createProviderRuntimeOptions() {
      return {
        isUseMultipleRangeRequest: true,
        platform: this._testOnlyOptions == null ? process.platform : this._testOnlyOptions.platform,
        executor: this.httpExecutor
      };
    }
    async doCheckForUpdates() {
      this.emit("checking-for-update");
      const result = await this.getUpdateInfoAndProvider();
      const updateInfo = result.info;
      if (!await this.isUpdateAvailable(updateInfo)) {
        this._logger.info(`Update for version ${this.currentVersion.format()} is not available (latest version: ${updateInfo.version}, downgrade is ${this.allowDowngrade ? "allowed" : "disallowed"}).`);
        this.emit("update-not-available", updateInfo);
        return {
          isUpdateAvailable: false,
          versionInfo: updateInfo,
          updateInfo
        };
      }
      this.updateInfoAndProvider = result;
      this.onUpdateAvailable(updateInfo);
      const cancellationToken = new builder_util_runtime_1.CancellationToken();
      return {
        isUpdateAvailable: true,
        versionInfo: updateInfo,
        updateInfo,
        cancellationToken,
        downloadPromise: this.autoDownload ? this.downloadUpdate(cancellationToken) : null
      };
    }
    onUpdateAvailable(updateInfo) {
      this._logger.info(`Found version ${updateInfo.version} (url: ${(0, builder_util_runtime_1.asArray)(updateInfo.files).map((it) => it.url).join(", ")})`);
      this.emit("update-available", updateInfo);
    }
    /**
     * Start downloading update manually. You can use this method if `autoDownload` option is set to `false`.
     * @returns {Promise<Array<string>>} Paths to downloaded files.
     */
    downloadUpdate(cancellationToken = new builder_util_runtime_1.CancellationToken()) {
      const updateInfoAndProvider = this.updateInfoAndProvider;
      if (updateInfoAndProvider == null) {
        const error2 = new Error("Please check update first");
        this.dispatchError(error2);
        return Promise.reject(error2);
      }
      if (this.downloadPromise != null) {
        this._logger.info("Downloading update (already in progress)");
        return this.downloadPromise;
      }
      this._logger.info(`Downloading update from ${(0, builder_util_runtime_1.asArray)(updateInfoAndProvider.info.files).map((it) => it.url).join(", ")}`);
      const errorHandler = (e) => {
        if (!(e instanceof builder_util_runtime_1.CancellationError)) {
          try {
            this.dispatchError(e);
          } catch (nestedError) {
            this._logger.warn(`Cannot dispatch error event: ${nestedError.stack || nestedError}`);
          }
        }
        return e;
      };
      this.downloadPromise = this.doDownloadUpdate({
        updateInfoAndProvider,
        requestHeaders: this.computeRequestHeaders(updateInfoAndProvider.provider),
        cancellationToken,
        disableWebInstaller: this.disableWebInstaller,
        disableDifferentialDownload: this.disableDifferentialDownload
      }).catch((e) => {
        throw errorHandler(e);
      }).finally(() => {
        this.downloadPromise = null;
      });
      return this.downloadPromise;
    }
    dispatchError(e) {
      this.emit("error", e, (e.stack || e).toString());
    }
    dispatchUpdateDownloaded(event) {
      this.emit(types_1.UPDATE_DOWNLOADED, event);
    }
    async loadUpdateConfig() {
      if (this._appUpdateConfigPath == null) {
        this._appUpdateConfigPath = this.app.appUpdateConfigPath;
      }
      return (0, js_yaml_1.load)(await (0, fs_extra_1.readFile)(this._appUpdateConfigPath, "utf-8"));
    }
    computeRequestHeaders(provider) {
      const fileExtraDownloadHeaders = provider.fileExtraDownloadHeaders;
      if (fileExtraDownloadHeaders != null) {
        const requestHeaders = this.requestHeaders;
        return requestHeaders == null ? fileExtraDownloadHeaders : {
          ...fileExtraDownloadHeaders,
          ...requestHeaders
        };
      }
      return this.computeFinalHeaders({ accept: "*/*" });
    }
    async getOrCreateStagingUserId() {
      const file2 = path.join(this.app.userDataPath, ".updaterId");
      try {
        const id2 = await (0, fs_extra_1.readFile)(file2, "utf-8");
        if (builder_util_runtime_1.UUID.check(id2)) {
          return id2;
        } else {
          this._logger.warn(`Staging user id file exists, but content was invalid: ${id2}`);
        }
      } catch (e) {
        if (e.code !== "ENOENT") {
          this._logger.warn(`Couldn't read staging user ID, creating a blank one: ${e}`);
        }
      }
      const id = builder_util_runtime_1.UUID.v5((0, crypto_1.randomBytes)(4096), builder_util_runtime_1.UUID.OID);
      this._logger.info(`Generated new staging user ID: ${id}`);
      try {
        await (0, fs_extra_1.outputFile)(file2, id);
      } catch (e) {
        this._logger.warn(`Couldn't write out staging user ID: ${e}`);
      }
      return id;
    }
    /** @internal */
    get isAddNoCacheQuery() {
      const headers = this.requestHeaders;
      if (headers == null) {
        return true;
      }
      for (const headerName of Object.keys(headers)) {
        const s = headerName.toLowerCase();
        if (s === "authorization" || s === "private-token") {
          return false;
        }
      }
      return true;
    }
    async getOrCreateDownloadHelper() {
      let result = this.downloadedUpdateHelper;
      if (result == null) {
        const dirName = (await this.configOnDisk.value).updaterCacheDirName;
        const logger = this._logger;
        if (dirName == null) {
          logger.error("updaterCacheDirName is not specified in app-update.yml Was app build using at least electron-builder 20.34.0?");
        }
        const cacheDir = path.join(this.app.baseCachePath, dirName || this.app.name);
        if (logger.debug != null) {
          logger.debug(`updater cache dir: ${cacheDir}`);
        }
        result = new DownloadedUpdateHelper_1.DownloadedUpdateHelper(cacheDir);
        this.downloadedUpdateHelper = result;
      }
      return result;
    }
    async executeDownload(taskOptions) {
      const fileInfo = taskOptions.fileInfo;
      const downloadOptions = {
        headers: taskOptions.downloadUpdateOptions.requestHeaders,
        cancellationToken: taskOptions.downloadUpdateOptions.cancellationToken,
        sha2: fileInfo.info.sha2,
        sha512: fileInfo.info.sha512
      };
      if (this.listenerCount(types_1.DOWNLOAD_PROGRESS) > 0) {
        downloadOptions.onProgress = (it) => this.emit(types_1.DOWNLOAD_PROGRESS, it);
      }
      const updateInfo = taskOptions.downloadUpdateOptions.updateInfoAndProvider.info;
      const version = updateInfo.version;
      const packageInfo = fileInfo.packageInfo;
      function getCacheUpdateFileName() {
        const urlPath = decodeURIComponent(taskOptions.fileInfo.url.pathname);
        if (urlPath.toLowerCase().endsWith(`.${taskOptions.fileExtension.toLowerCase()}`)) {
          return path.basename(urlPath);
        } else {
          return path.basename(taskOptions.fileInfo.info.url);
        }
      }
      const downloadedUpdateHelper = await this.getOrCreateDownloadHelper();
      const cacheDir = downloadedUpdateHelper.cacheDirForPendingUpdate;
      await (0, fs_extra_1.mkdir)(cacheDir, { recursive: true });
      const updateFileName = getCacheUpdateFileName();
      let updateFile = path.join(cacheDir, updateFileName);
      const packageFile = packageInfo == null ? null : path.join(cacheDir, `package-${version}${path.extname(packageInfo.path) || ".7z"}`);
      const done = async (isSaveCache) => {
        await downloadedUpdateHelper.setDownloadedFile(updateFile, packageFile, updateInfo, fileInfo, updateFileName, isSaveCache);
        await taskOptions.done({
          ...updateInfo,
          downloadedFile: updateFile
        });
        const currentBlockMapFile = path.join(cacheDir, "current.blockmap");
        if (await (0, fs_extra_1.pathExists)(currentBlockMapFile)) {
          await (0, fs_extra_1.copyFile)(currentBlockMapFile, path.join(downloadedUpdateHelper.cacheDir, "current.blockmap"));
        }
        return packageFile == null ? [updateFile] : [updateFile, packageFile];
      };
      const log = this._logger;
      const cachedUpdateFile = await downloadedUpdateHelper.validateDownloadedPath(updateFile, updateInfo, fileInfo, log);
      if (cachedUpdateFile != null) {
        updateFile = cachedUpdateFile;
        return await done(false);
      }
      const removeFileIfAny = async () => {
        await downloadedUpdateHelper.clear().catch(() => {
        });
        return await (0, fs_extra_1.unlink)(updateFile).catch(() => {
        });
      };
      const tempUpdateFile = await (0, DownloadedUpdateHelper_1.createTempUpdateFile)(`temp-${updateFileName}`, cacheDir, log);
      try {
        await taskOptions.task(tempUpdateFile, downloadOptions, packageFile, removeFileIfAny);
        await (0, builder_util_runtime_1.retry)(() => (0, fs_extra_1.rename)(tempUpdateFile, updateFile), {
          retries: 60,
          interval: 500,
          shouldRetry: (error2) => {
            if (error2 instanceof Error && /^EBUSY:/.test(error2.message)) {
              return true;
            }
            log.warn(`Cannot rename temp file to final file: ${error2.message || error2.stack}`);
            return false;
          }
        });
      } catch (e) {
        await removeFileIfAny();
        if (e instanceof builder_util_runtime_1.CancellationError) {
          log.info("cancelled");
          this.emit("update-cancelled", updateInfo);
        }
        throw e;
      }
      log.info(`New version ${version} has been downloaded to ${updateFile}`);
      return await done(true);
    }
    async differentialDownloadInstaller(fileInfo, downloadUpdateOptions, installerPath, provider, oldInstallerFileName) {
      try {
        if (this._testOnlyOptions != null && !this._testOnlyOptions.isUseDifferentialDownload) {
          return true;
        }
        const provider2 = downloadUpdateOptions.updateInfoAndProvider.provider;
        const blockmapFileUrls = await provider2.getBlockMapFiles(fileInfo.url, this.app.version, downloadUpdateOptions.updateInfoAndProvider.info.version, this.previousBlockmapBaseUrlOverride);
        this._logger.info(`Download block maps (old: "${blockmapFileUrls[0]}", new: ${blockmapFileUrls[1]})`);
        const downloadBlockMap = async (url) => {
          const data = await this.httpExecutor.downloadToBuffer(url, {
            headers: downloadUpdateOptions.requestHeaders,
            cancellationToken: downloadUpdateOptions.cancellationToken
          });
          if (data == null || data.length === 0) {
            throw new Error(`Blockmap "${url.href}" is empty`);
          }
          try {
            return JSON.parse((0, zlib_1.gunzipSync)(data).toString());
          } catch (e) {
            throw new Error(`Cannot parse blockmap "${url.href}", error: ${e}`);
          }
        };
        const downloadOptions = {
          newUrl: fileInfo.url,
          oldFile: path.join(this.downloadedUpdateHelper.cacheDir, oldInstallerFileName),
          logger: this._logger,
          newFile: installerPath,
          isUseMultipleRangeRequest: provider2.isUseMultipleRangeRequest,
          requestHeaders: downloadUpdateOptions.requestHeaders,
          cancellationToken: downloadUpdateOptions.cancellationToken
        };
        if (this.listenerCount(types_1.DOWNLOAD_PROGRESS) > 0) {
          downloadOptions.onProgress = (it) => this.emit(types_1.DOWNLOAD_PROGRESS, it);
        }
        const saveBlockMapToCacheDir = async (blockMapData, cacheDir) => {
          const blockMapFile = path.join(cacheDir, "current.blockmap");
          await (0, fs_extra_1.outputFile)(blockMapFile, (0, zlib_1.gzipSync)(JSON.stringify(blockMapData)));
        };
        const getBlockMapFromCacheDir = async (cacheDir) => {
          const blockMapFile = path.join(cacheDir, "current.blockmap");
          try {
            if (await (0, fs_extra_1.pathExists)(blockMapFile)) {
              return JSON.parse((0, zlib_1.gunzipSync)(await (0, fs_extra_1.readFile)(blockMapFile)).toString());
            }
          } catch (e) {
            this._logger.warn(`Cannot parse blockmap "${blockMapFile}", error: ${e}`);
          }
          return null;
        };
        const newBlockMapData = await downloadBlockMap(blockmapFileUrls[1]);
        await saveBlockMapToCacheDir(newBlockMapData, this.downloadedUpdateHelper.cacheDirForPendingUpdate);
        let oldBlockMapData = await getBlockMapFromCacheDir(this.downloadedUpdateHelper.cacheDir);
        if (oldBlockMapData == null) {
          oldBlockMapData = await downloadBlockMap(blockmapFileUrls[0]);
        }
        await new GenericDifferentialDownloader_1.GenericDifferentialDownloader(fileInfo.info, this.httpExecutor, downloadOptions).download(oldBlockMapData, newBlockMapData);
        return false;
      } catch (e) {
        this._logger.error(`Cannot download differentially, fallback to full download: ${e.stack || e}`);
        if (this._testOnlyOptions != null) {
          throw e;
        }
        return true;
      }
    }
  };
  AppUpdater.AppUpdater = AppUpdater$1;
  function hasPrereleaseComponents(version) {
    const versionPrereleaseComponent = (0, semver_1.prerelease)(version);
    return versionPrereleaseComponent != null && versionPrereleaseComponent.length > 0;
  }
  class NoOpLogger {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    info(message) {
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    warn(message) {
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    error(message) {
    }
  }
  AppUpdater.NoOpLogger = NoOpLogger;
  return AppUpdater;
}
var hasRequiredBaseUpdater;
function requireBaseUpdater() {
  if (hasRequiredBaseUpdater) return BaseUpdater;
  hasRequiredBaseUpdater = 1;
  Object.defineProperty(BaseUpdater, "__esModule", { value: true });
  BaseUpdater.BaseUpdater = void 0;
  const child_process_1 = require$$1$1;
  const path = require$$1$2;
  const AppUpdater_1 = requireAppUpdater();
  let BaseUpdater$1 = class BaseUpdater extends AppUpdater_1.AppUpdater {
    constructor(options, app) {
      super(options, app);
      this.quitAndInstallCalled = false;
      this.quitHandlerAdded = false;
    }
    quitAndInstall(isSilent = false, isForceRunAfter = false) {
      this._logger.info(`Install on explicit quitAndInstall`);
      const isInstalled = this.install(isSilent, isSilent ? isForceRunAfter : this.autoRunAppAfterInstall);
      if (isInstalled) {
        setImmediate(() => {
          require$$1.autoUpdater.emit("before-quit-for-update");
          this.app.quit();
        });
      } else {
        this.quitAndInstallCalled = false;
      }
    }
    executeDownload(taskOptions) {
      return super.executeDownload({
        ...taskOptions,
        done: (event) => {
          this.dispatchUpdateDownloaded(event);
          this.addQuitHandler();
          return Promise.resolve();
        }
      });
    }
    get installerPath() {
      return this.downloadedUpdateHelper == null ? null : this.downloadedUpdateHelper.file;
    }
    // must be sync (because quit even handler is not async)
    install(isSilent = false, isForceRunAfter = false) {
      if (this.quitAndInstallCalled) {
        this._logger.warn("install call ignored: quitAndInstallCalled is set to true");
        return false;
      }
      const downloadedUpdateHelper = this.downloadedUpdateHelper;
      const installerPath = this.installerPath;
      const downloadedFileInfo = downloadedUpdateHelper == null ? null : downloadedUpdateHelper.downloadedFileInfo;
      if (installerPath == null || downloadedFileInfo == null) {
        this.dispatchError(new Error("No update filepath provided, can't quit and install"));
        return false;
      }
      this.quitAndInstallCalled = true;
      try {
        this._logger.info(`Install: isSilent: ${isSilent}, isForceRunAfter: ${isForceRunAfter}`);
        return this.doInstall({
          isSilent,
          isForceRunAfter,
          isAdminRightsRequired: downloadedFileInfo.isAdminRightsRequired
        });
      } catch (e) {
        this.dispatchError(e);
        return false;
      }
    }
    addQuitHandler() {
      if (this.quitHandlerAdded || !this.autoInstallOnAppQuit) {
        return;
      }
      this.quitHandlerAdded = true;
      this.app.onQuit((exitCode) => {
        if (this.quitAndInstallCalled) {
          this._logger.info("Update installer has already been triggered. Quitting application.");
          return;
        }
        if (!this.autoInstallOnAppQuit) {
          this._logger.info("Update will not be installed on quit because autoInstallOnAppQuit is set to false.");
          return;
        }
        if (exitCode !== 0) {
          this._logger.info(`Update will be not installed on quit because application is quitting with exit code ${exitCode}`);
          return;
        }
        this._logger.info("Auto install update on quit");
        this.install(true, false);
      });
    }
    /**
     * Strips relative-path entries from a PATH string.
     * Prevents PATH-poisoning where a writable directory earlier in PATH shadows
     * a trusted package manager binary.
     */
    sanitizeEnvPath(envPath) {
      return envPath.split(path.delimiter).filter((dir) => path.isAbsolute(dir)).join(path.delimiter);
    }
    spawnSyncLog(cmd, args = [], env = {}) {
      var _a;
      this._logger.info(`Executing: ${cmd} with args: ${args}`);
      const mergedEnv = { ...process.env, ...env };
      const response = (0, child_process_1.spawnSync)(cmd, args, {
        env: { ...mergedEnv, PATH: this.sanitizeEnvPath((_a = mergedEnv.PATH) !== null && _a !== void 0 ? _a : "") },
        encoding: "utf-8",
        shell: true
      });
      const { error: error2, status, stdout, stderr } = response;
      if (error2 != null) {
        this._logger.error(stderr);
        throw error2;
      } else if (status != null && status !== 0) {
        this._logger.error(stderr);
        throw new Error(`Command ${cmd} exited with code ${status}`);
      }
      return stdout.trim();
    }
    /**
     * This handles both node 8 and node 10 way of emitting error when spawning a process
     *   - node 8: Throws the error
     *   - node 10: Emit the error(Need to listen with on)
     */
    // https://github.com/electron-userland/electron-builder/issues/1129
    // Node 8 sends errors: https://nodejs.org/dist/latest-v8.x/docs/api/errors.html#errors_common_system_errors
    async spawnLog(cmd, args = [], env = void 0, stdio = "ignore") {
      this._logger.info(`Executing: ${cmd} with args: ${args}`);
      return new Promise((resolve, reject) => {
        try {
          const params = { stdio, env, detached: true };
          const p = (0, child_process_1.spawn)(cmd, args, params);
          p.on("error", (error2) => {
            reject(error2);
          });
          p.unref();
          if (p.pid !== void 0) {
            resolve(true);
          }
        } catch (error2) {
          reject(error2);
        }
      });
    }
  };
  BaseUpdater.BaseUpdater = BaseUpdater$1;
  return BaseUpdater;
}
var AppImageUpdater = {};
var FileWithEmbeddedBlockMapDifferentialDownloader = {};
var hasRequiredFileWithEmbeddedBlockMapDifferentialDownloader;
function requireFileWithEmbeddedBlockMapDifferentialDownloader() {
  if (hasRequiredFileWithEmbeddedBlockMapDifferentialDownloader) return FileWithEmbeddedBlockMapDifferentialDownloader;
  hasRequiredFileWithEmbeddedBlockMapDifferentialDownloader = 1;
  Object.defineProperty(FileWithEmbeddedBlockMapDifferentialDownloader, "__esModule", { value: true });
  FileWithEmbeddedBlockMapDifferentialDownloader.FileWithEmbeddedBlockMapDifferentialDownloader = void 0;
  const fs_extra_1 = /* @__PURE__ */ requireLib();
  const DifferentialDownloader_1 = requireDifferentialDownloader();
  const zlib_1 = require$$14;
  let FileWithEmbeddedBlockMapDifferentialDownloader$1 = class FileWithEmbeddedBlockMapDifferentialDownloader extends DifferentialDownloader_1.DifferentialDownloader {
    async download() {
      const packageInfo = this.blockAwareFileInfo;
      const fileSize = packageInfo.size;
      const offset = fileSize - (packageInfo.blockMapSize + 4);
      this.fileMetadataBuffer = await this.readRemoteBytes(offset, fileSize - 1);
      const newBlockMap = readBlockMap(this.fileMetadataBuffer.slice(0, this.fileMetadataBuffer.length - 4));
      await this.doDownload(await readEmbeddedBlockMapData(this.options.oldFile), newBlockMap);
    }
  };
  FileWithEmbeddedBlockMapDifferentialDownloader.FileWithEmbeddedBlockMapDifferentialDownloader = FileWithEmbeddedBlockMapDifferentialDownloader$1;
  function readBlockMap(data) {
    return JSON.parse((0, zlib_1.inflateRawSync)(data).toString());
  }
  async function readEmbeddedBlockMapData(file2) {
    const fd = await (0, fs_extra_1.open)(file2, "r");
    try {
      const fileSize = (await (0, fs_extra_1.fstat)(fd)).size;
      const sizeBuffer = Buffer.allocUnsafe(4);
      await (0, fs_extra_1.read)(fd, sizeBuffer, 0, sizeBuffer.length, fileSize - sizeBuffer.length);
      const dataBuffer = Buffer.allocUnsafe(sizeBuffer.readUInt32BE(0));
      await (0, fs_extra_1.read)(fd, dataBuffer, 0, dataBuffer.length, fileSize - sizeBuffer.length - dataBuffer.length);
      await (0, fs_extra_1.close)(fd);
      return readBlockMap(dataBuffer);
    } catch (e) {
      await (0, fs_extra_1.close)(fd);
      throw e;
    }
  }
  return FileWithEmbeddedBlockMapDifferentialDownloader;
}
var hasRequiredAppImageUpdater;
function requireAppImageUpdater() {
  if (hasRequiredAppImageUpdater) return AppImageUpdater;
  hasRequiredAppImageUpdater = 1;
  Object.defineProperty(AppImageUpdater, "__esModule", { value: true });
  AppImageUpdater.AppImageUpdater = void 0;
  const builder_util_runtime_1 = requireOut();
  const child_process_1 = require$$1$1;
  const fs_extra_1 = /* @__PURE__ */ requireLib();
  const fs_1 = require$$2;
  const path = require$$1$2;
  const BaseUpdater_1 = requireBaseUpdater();
  const FileWithEmbeddedBlockMapDifferentialDownloader_1 = requireFileWithEmbeddedBlockMapDifferentialDownloader();
  const Provider_1 = requireProvider();
  const types_1 = requireTypes();
  let AppImageUpdater$1 = class AppImageUpdater extends BaseUpdater_1.BaseUpdater {
    constructor(options, app) {
      super(options, app);
    }
    isUpdaterActive() {
      if (process.env["APPIMAGE"] == null && !this.forceDevUpdateConfig) {
        if (process.env["SNAP"] == null) {
          this._logger.warn("APPIMAGE env is not defined, current application is not an AppImage");
        } else {
          this._logger.info("SNAP env is defined, updater is disabled");
        }
        return false;
      }
      return super.isUpdaterActive();
    }
    /*** @private */
    doDownloadUpdate(downloadUpdateOptions) {
      const provider = downloadUpdateOptions.updateInfoAndProvider.provider;
      const fileInfo = (0, Provider_1.findFile)(provider.resolveFiles(downloadUpdateOptions.updateInfoAndProvider.info), "AppImage", ["rpm", "deb", "pacman"]);
      return this.executeDownload({
        fileExtension: "AppImage",
        fileInfo,
        downloadUpdateOptions,
        task: async (updateFile, downloadOptions) => {
          const oldFile = process.env["APPIMAGE"];
          if (oldFile == null) {
            throw (0, builder_util_runtime_1.newError)("APPIMAGE env is not defined", "ERR_UPDATER_OLD_FILE_NOT_FOUND");
          }
          if (downloadUpdateOptions.disableDifferentialDownload || await this.downloadDifferential(fileInfo, oldFile, updateFile, provider, downloadUpdateOptions)) {
            await this.httpExecutor.download(fileInfo.url, updateFile, downloadOptions);
          }
          await (0, fs_extra_1.chmod)(updateFile, 493);
        }
      });
    }
    async downloadDifferential(fileInfo, oldFile, updateFile, provider, downloadUpdateOptions) {
      try {
        const downloadOptions = {
          newUrl: fileInfo.url,
          oldFile,
          logger: this._logger,
          newFile: updateFile,
          isUseMultipleRangeRequest: provider.isUseMultipleRangeRequest,
          requestHeaders: downloadUpdateOptions.requestHeaders,
          cancellationToken: downloadUpdateOptions.cancellationToken
        };
        if (this.listenerCount(types_1.DOWNLOAD_PROGRESS) > 0) {
          downloadOptions.onProgress = (it) => this.emit(types_1.DOWNLOAD_PROGRESS, it);
        }
        await new FileWithEmbeddedBlockMapDifferentialDownloader_1.FileWithEmbeddedBlockMapDifferentialDownloader(fileInfo.info, this.httpExecutor, downloadOptions).download();
        return false;
      } catch (e) {
        this._logger.error(`Cannot download differentially, fallback to full download: ${e.stack || e}`);
        return process.platform === "linux";
      }
    }
    doInstall(options) {
      const appImageFile = process.env["APPIMAGE"];
      if (appImageFile == null) {
        throw (0, builder_util_runtime_1.newError)("APPIMAGE env is not defined", "ERR_UPDATER_OLD_FILE_NOT_FOUND");
      }
      if (!path.isAbsolute(appImageFile) || appImageFile.includes("\0")) {
        throw (0, builder_util_runtime_1.newError)(`APPIMAGE env is not a valid absolute path: "${appImageFile}"`, "ERR_UPDATER_OLD_FILE_NOT_FOUND");
      }
      (0, fs_1.unlinkSync)(appImageFile);
      let destination;
      const existingBaseName = path.basename(appImageFile);
      const installerPath = this.installerPath;
      if (installerPath == null) {
        this.dispatchError(new Error("No update filepath provided, can't quit and install"));
        return false;
      }
      if (path.basename(installerPath) === existingBaseName || !/\d+\.\d+\.\d+/.test(existingBaseName)) {
        destination = appImageFile;
      } else {
        destination = path.join(path.dirname(appImageFile), path.basename(installerPath));
      }
      (0, child_process_1.execFileSync)("mv", ["-f", installerPath, destination]);
      if (destination !== appImageFile) {
        this.emit("appimage-filename-updated", destination);
      }
      const env = {
        ...process.env,
        APPIMAGE_SILENT_INSTALL: "true"
      };
      if (options.isForceRunAfter) {
        this.spawnLog(destination, [], env);
      } else {
        env.APPIMAGE_EXIT_AFTER_INSTALL = "true";
        (0, child_process_1.execFileSync)(destination, [], { env });
      }
      return true;
    }
  };
  AppImageUpdater.AppImageUpdater = AppImageUpdater$1;
  return AppImageUpdater;
}
var DebUpdater = {};
var LinuxUpdater = {};
var hasRequiredLinuxUpdater;
function requireLinuxUpdater() {
  if (hasRequiredLinuxUpdater) return LinuxUpdater;
  hasRequiredLinuxUpdater = 1;
  Object.defineProperty(LinuxUpdater, "__esModule", { value: true });
  LinuxUpdater.LinuxUpdater = void 0;
  const BaseUpdater_1 = requireBaseUpdater();
  const SAFE_PM_REGEX = /^[a-zA-Z0-9_-]+$/;
  let LinuxUpdater$1 = class LinuxUpdater extends BaseUpdater_1.BaseUpdater {
    constructor(options, app) {
      super(options, app);
    }
    /**
     * Returns true if the current process is running as root.
     */
    isRunningAsRoot() {
      var _a;
      return ((_a = process.getuid) === null || _a === void 0 ? void 0 : _a.call(process)) === 0;
    }
    /**
     * Sanitizes the installer path for use with shell:true spawn calls.
     * Backslash-escapes metacharacters that have special meaning in POSIX shell.
     * Note: paths containing single-quotes (') are not supported.
     */
    get installerPath() {
      const raw = super.installerPath;
      if (raw == null) {
        return null;
      }
      return raw.replace(/\\/g, "\\\\").replace(/([`$!" ;|&()<>])/g, "\\$1").replace(/[\n\r]/g, "");
    }
    runCommandWithSudoIfNeeded(commandWithArgs) {
      if (this.isRunningAsRoot()) {
        this._logger.info("Running as root, no need to use sudo");
        return this.spawnSyncLog(commandWithArgs[0], commandWithArgs.slice(1));
      }
      const { name } = this.app;
      const safeName = name.replace(/["`$\\!\n\r;|&<>(){}*?[\]#~]/g, "");
      const installComment = `"${safeName} would like to update"`;
      const sudo = this.sudoWithArgs(installComment);
      this._logger.info(`Running as non-root user, using sudo to install: ${sudo}`);
      let wrapper = `"`;
      if (/pkexec/i.test(sudo[0]) || sudo[0] === "sudo") {
        wrapper = "";
      }
      return this.spawnSyncLog(sudo[0], [...sudo.length > 1 ? sudo.slice(1) : [], `${wrapper}/bin/bash`, "-c", `'${commandWithArgs.join(" ")}'${wrapper}`]);
    }
    sudoWithArgs(installComment) {
      const sudo = this.determineSudoCommand();
      const command = [sudo];
      if (/kdesudo/i.test(sudo)) {
        command.push("--comment", installComment);
        command.push("-c");
      } else if (/gksudo/i.test(sudo)) {
        command.push("--message", installComment);
      } else if (/pkexec/i.test(sudo)) {
        command.push("--disable-internal-agent");
      }
      return command;
    }
    hasCommand(cmd) {
      try {
        this.spawnSyncLog(`command`, ["-v", cmd]);
        return true;
      } catch {
        return false;
      }
    }
    determineSudoCommand() {
      const sudos = ["gksudo", "kdesudo", "pkexec", "beesu"];
      for (const sudo of sudos) {
        if (this.hasCommand(sudo)) {
          return sudo;
        }
      }
      return "sudo";
    }
    /**
     * Detects the package manager to use based on the available commands.
     * Allows overriding the default behavior by setting the ELECTRON_BUILDER_LINUX_PACKAGE_MANAGER environment variable.
     * If the environment variable is set, it will be used directly. (This is useful for testing each package manager logic path.)
     * Otherwise, it checks for the presence of the specified package manager commands in the order provided.
     * @param pms - An array of package manager commands to check for, in priority order.
     * @returns The detected package manager command or "unknown" if none are found.
     */
    detectPackageManager(pms) {
      var _a;
      let availablePMs = pms;
      const pmOverride = (_a = process.env.ELECTRON_BUILDER_LINUX_PACKAGE_MANAGER) === null || _a === void 0 ? void 0 : _a.trim();
      if (pmOverride) {
        if (!SAFE_PM_REGEX.test(pmOverride)) {
          this._logger.warn(`ELECTRON_BUILDER_LINUX_PACKAGE_MANAGER "${pmOverride}" contains unsafe characters. Ignoring override.`);
        } else {
          availablePMs = [pmOverride];
        }
      }
      for (const pm of availablePMs) {
        if (this.hasCommand(pm)) {
          return pm;
        }
      }
      const searchList = pmOverride ? `ELECTRON_BUILDER_LINUX_PACKAGE_MANAGER override "${pmOverride}", ` : "";
      const defaultPM = pms[0];
      this._logger.warn(`No package manager found in the list: ${searchList}${pms.join(", ")}. Utilizing default: ${defaultPM}`);
      return defaultPM;
    }
  };
  LinuxUpdater.LinuxUpdater = LinuxUpdater$1;
  return LinuxUpdater;
}
var hasRequiredDebUpdater;
function requireDebUpdater() {
  if (hasRequiredDebUpdater) return DebUpdater;
  hasRequiredDebUpdater = 1;
  Object.defineProperty(DebUpdater, "__esModule", { value: true });
  DebUpdater.DebUpdater = void 0;
  const Provider_1 = requireProvider();
  const types_1 = requireTypes();
  const LinuxUpdater_1 = requireLinuxUpdater();
  let DebUpdater$1 = class DebUpdater2 extends LinuxUpdater_1.LinuxUpdater {
    constructor(options, app) {
      super(options, app);
    }
    /*** @private */
    doDownloadUpdate(downloadUpdateOptions) {
      const provider = downloadUpdateOptions.updateInfoAndProvider.provider;
      const fileInfo = (0, Provider_1.findFile)(provider.resolveFiles(downloadUpdateOptions.updateInfoAndProvider.info), "deb", ["AppImage", "rpm", "pacman"]);
      return this.executeDownload({
        fileExtension: "deb",
        fileInfo,
        downloadUpdateOptions,
        task: async (updateFile, downloadOptions) => {
          if (this.listenerCount(types_1.DOWNLOAD_PROGRESS) > 0) {
            downloadOptions.onProgress = (it) => this.emit(types_1.DOWNLOAD_PROGRESS, it);
          }
          await this.httpExecutor.download(fileInfo.url, updateFile, downloadOptions);
        }
      });
    }
    doInstall(options) {
      const installerPath = this.installerPath;
      if (installerPath == null) {
        this.dispatchError(new Error("No update filepath provided, can't quit and install"));
        return false;
      }
      if (!this.hasCommand("dpkg") && !this.hasCommand("apt")) {
        this.dispatchError(new Error("Neither dpkg nor apt command found. Cannot install .deb package."));
        return false;
      }
      const priorityList = ["dpkg", "apt"];
      const packageManager = this.detectPackageManager(priorityList);
      try {
        DebUpdater2.installWithCommandRunner(packageManager, installerPath, this.runCommandWithSudoIfNeeded.bind(this), this._logger);
      } catch (error2) {
        this.dispatchError(error2);
        return false;
      }
      if (options.isForceRunAfter) {
        this.app.relaunch();
      }
      return true;
    }
    static installWithCommandRunner(packageManager, installerPath, commandRunner, logger) {
      var _a;
      if (packageManager === "dpkg") {
        try {
          commandRunner(["dpkg", "-i", installerPath]);
        } catch (error2) {
          logger.warn((_a = error2.message) !== null && _a !== void 0 ? _a : error2);
          logger.warn("dpkg installation failed, trying to fix broken dependencies with apt-get");
          commandRunner(["apt-get", "install", "-f", "-y"]);
        }
      } else if (packageManager === "apt") {
        logger.warn("Using apt to install a local .deb. This may fail for unsigned packages unless properly configured.");
        commandRunner([
          "apt",
          "install",
          "-y",
          "--allow-unauthenticated",
          // needed for unsigned .debs
          "--allow-downgrades",
          // allow lower version installs
          "--allow-change-held-packages",
          installerPath
        ]);
      } else {
        throw new Error(`Package manager ${packageManager} not supported`);
      }
    }
  };
  DebUpdater.DebUpdater = DebUpdater$1;
  return DebUpdater;
}
var PacmanUpdater = {};
var hasRequiredPacmanUpdater;
function requirePacmanUpdater() {
  if (hasRequiredPacmanUpdater) return PacmanUpdater;
  hasRequiredPacmanUpdater = 1;
  Object.defineProperty(PacmanUpdater, "__esModule", { value: true });
  PacmanUpdater.PacmanUpdater = void 0;
  const types_1 = requireTypes();
  const Provider_1 = requireProvider();
  const LinuxUpdater_1 = requireLinuxUpdater();
  let PacmanUpdater$1 = class PacmanUpdater2 extends LinuxUpdater_1.LinuxUpdater {
    constructor(options, app) {
      super(options, app);
    }
    /*** @private */
    doDownloadUpdate(downloadUpdateOptions) {
      const provider = downloadUpdateOptions.updateInfoAndProvider.provider;
      const fileInfo = (0, Provider_1.findFile)(provider.resolveFiles(downloadUpdateOptions.updateInfoAndProvider.info), "pacman", ["AppImage", "deb", "rpm"]);
      return this.executeDownload({
        fileExtension: "pacman",
        fileInfo,
        downloadUpdateOptions,
        task: async (updateFile, downloadOptions) => {
          if (this.listenerCount(types_1.DOWNLOAD_PROGRESS) > 0) {
            downloadOptions.onProgress = (it) => this.emit(types_1.DOWNLOAD_PROGRESS, it);
          }
          await this.httpExecutor.download(fileInfo.url, updateFile, downloadOptions);
        }
      });
    }
    doInstall(options) {
      const installerPath = this.installerPath;
      if (installerPath == null) {
        this.dispatchError(new Error("No update filepath provided, can't quit and install"));
        return false;
      }
      try {
        PacmanUpdater2.installWithCommandRunner(installerPath, this.runCommandWithSudoIfNeeded.bind(this), this._logger);
      } catch (error2) {
        this.dispatchError(error2);
        return false;
      }
      if (options.isForceRunAfter) {
        this.app.relaunch();
      }
      return true;
    }
    static installWithCommandRunner(installerPath, commandRunner, logger) {
      var _a;
      try {
        commandRunner(["pacman", "-U", "--noconfirm", installerPath]);
      } catch (error2) {
        logger.warn((_a = error2.message) !== null && _a !== void 0 ? _a : error2);
        logger.warn("pacman installation failed, attempting to update package database and retry");
        try {
          commandRunner(["pacman", "-Sy", "--noconfirm"]);
          commandRunner(["pacman", "-U", "--noconfirm", installerPath]);
        } catch (retryError) {
          logger.error("Retry after pacman -Sy failed");
          throw retryError;
        }
      }
    }
  };
  PacmanUpdater.PacmanUpdater = PacmanUpdater$1;
  return PacmanUpdater;
}
var RpmUpdater = {};
var hasRequiredRpmUpdater;
function requireRpmUpdater() {
  if (hasRequiredRpmUpdater) return RpmUpdater;
  hasRequiredRpmUpdater = 1;
  Object.defineProperty(RpmUpdater, "__esModule", { value: true });
  RpmUpdater.RpmUpdater = void 0;
  const types_1 = requireTypes();
  const Provider_1 = requireProvider();
  const LinuxUpdater_1 = requireLinuxUpdater();
  let RpmUpdater$1 = class RpmUpdater2 extends LinuxUpdater_1.LinuxUpdater {
    constructor(options, app) {
      super(options, app);
    }
    /*** @private */
    doDownloadUpdate(downloadUpdateOptions) {
      const provider = downloadUpdateOptions.updateInfoAndProvider.provider;
      const fileInfo = (0, Provider_1.findFile)(provider.resolveFiles(downloadUpdateOptions.updateInfoAndProvider.info), "rpm", ["AppImage", "deb", "pacman"]);
      return this.executeDownload({
        fileExtension: "rpm",
        fileInfo,
        downloadUpdateOptions,
        task: async (updateFile, downloadOptions) => {
          if (this.listenerCount(types_1.DOWNLOAD_PROGRESS) > 0) {
            downloadOptions.onProgress = (it) => this.emit(types_1.DOWNLOAD_PROGRESS, it);
          }
          await this.httpExecutor.download(fileInfo.url, updateFile, downloadOptions);
        }
      });
    }
    doInstall(options) {
      const installerPath = this.installerPath;
      if (installerPath == null) {
        this.dispatchError(new Error("No update filepath provided, can't quit and install"));
        return false;
      }
      const priorityList = ["zypper", "dnf", "yum", "rpm"];
      const packageManager = this.detectPackageManager(priorityList);
      try {
        RpmUpdater2.installWithCommandRunner(packageManager, installerPath, this.runCommandWithSudoIfNeeded.bind(this), this._logger);
      } catch (error2) {
        this.dispatchError(error2);
        return false;
      }
      if (options.isForceRunAfter) {
        this.app.relaunch();
      }
      return true;
    }
    static installWithCommandRunner(packageManager, installerPath, commandRunner, logger) {
      if (packageManager === "zypper") {
        return commandRunner(["zypper", "--non-interactive", "--no-refresh", "install", "--allow-unsigned-rpm", "-f", installerPath]);
      }
      if (packageManager === "dnf") {
        return commandRunner(["dnf", "install", "--nogpgcheck", "-y", installerPath]);
      }
      if (packageManager === "yum") {
        return commandRunner(["yum", "install", "--nogpgcheck", "-y", installerPath]);
      }
      if (packageManager === "rpm") {
        logger.warn("Installing with rpm only (no dependency resolution).");
        return commandRunner(["rpm", "-Uvh", "--replacepkgs", "--replacefiles", "--nodeps", installerPath]);
      }
      throw new Error(`Package manager ${packageManager} not supported`);
    }
  };
  RpmUpdater.RpmUpdater = RpmUpdater$1;
  return RpmUpdater;
}
var MacUpdater = {};
var hasRequiredMacUpdater;
function requireMacUpdater() {
  if (hasRequiredMacUpdater) return MacUpdater;
  hasRequiredMacUpdater = 1;
  Object.defineProperty(MacUpdater, "__esModule", { value: true });
  MacUpdater.MacUpdater = void 0;
  const builder_util_runtime_1 = requireOut();
  const fs_extra_1 = /* @__PURE__ */ requireLib();
  const fs_1 = require$$2;
  const path = require$$1$2;
  const http_1 = require$$4$1;
  const AppUpdater_1 = requireAppUpdater();
  const Provider_1 = requireProvider();
  const child_process_1 = require$$1$1;
  const crypto_1 = require$$0$3;
  let MacUpdater$1 = class MacUpdater2 extends AppUpdater_1.AppUpdater {
    constructor(options, app) {
      super(options, app);
      this.nativeUpdater = require$$1.autoUpdater;
      this.squirrelDownloadedUpdate = false;
      this.nativeUpdater.on("error", (it) => {
        this._logger.warn(it);
        this.emit("error", it);
      });
      this.nativeUpdater.on("update-downloaded", () => {
        this.squirrelDownloadedUpdate = true;
        this.debug("nativeUpdater.update-downloaded");
      });
    }
    /** Filters update files to the appropriate architecture.
     * On arm64 Macs (including Rosetta), arm64 files are preferred when available.
     * On x64 Macs, arm64 files are excluded. */
    static filterFilesForArch(files, isArm64Mac) {
      const isArm64File = (file2) => {
        var _a;
        return file2.url.pathname.includes("arm64") || ((_a = file2.info.url) === null || _a === void 0 ? void 0 : _a.includes("arm64"));
      };
      if (isArm64Mac && files.some(isArm64File)) {
        return files.filter((file2) => isArm64Mac === isArm64File(file2));
      }
      return files.filter((file2) => !isArm64File(file2));
    }
    debug(message) {
      if (this._logger.debug != null) {
        this._logger.debug(message);
      }
    }
    closeServerIfExists() {
      if (this.server) {
        this.debug("Closing proxy server");
        this.server.close((err) => {
          if (err) {
            this.debug("proxy server wasn't already open, probably attempted closing again as a safety check before quit");
          }
        });
      }
    }
    async doDownloadUpdate(downloadUpdateOptions) {
      let files = downloadUpdateOptions.updateInfoAndProvider.provider.resolveFiles(downloadUpdateOptions.updateInfoAndProvider.info);
      const log = this._logger;
      const sysctlRosettaInfoKey = "sysctl.proc_translated";
      let isRosetta = false;
      try {
        this.debug("Checking for macOS Rosetta environment");
        const result = (0, child_process_1.execFileSync)("sysctl", [sysctlRosettaInfoKey], { encoding: "utf8" });
        isRosetta = result.includes(`${sysctlRosettaInfoKey}: 1`);
        log.info(`Checked for macOS Rosetta environment (isRosetta=${isRosetta})`);
      } catch (e) {
        log.warn(`sysctl shell command to check for macOS Rosetta environment failed: ${e}`);
      }
      let isArm64Mac = false;
      try {
        this.debug("Checking for arm64 in uname");
        const result = (0, child_process_1.execFileSync)("uname", ["-a"], { encoding: "utf8" });
        const isArm = result.includes("ARM");
        log.info(`Checked 'uname -a': arm64=${isArm}`);
        isArm64Mac = isArm64Mac || isArm;
      } catch (e) {
        log.warn(`uname shell command to check for arm64 failed: ${e}`);
      }
      isArm64Mac = isArm64Mac || process.arch === "arm64" || isRosetta;
      files = MacUpdater2.filterFilesForArch(files, isArm64Mac);
      const zipFileInfo = (0, Provider_1.findFile)(files, "zip", ["pkg", "dmg"]);
      if (zipFileInfo == null) {
        throw (0, builder_util_runtime_1.newError)(`ZIP file not provided: ${(0, builder_util_runtime_1.safeStringifyJson)(files)}`, "ERR_UPDATER_ZIP_FILE_NOT_FOUND");
      }
      const provider = downloadUpdateOptions.updateInfoAndProvider.provider;
      const CURRENT_MAC_APP_ZIP_FILE_NAME = "update.zip";
      return this.executeDownload({
        fileExtension: "zip",
        fileInfo: zipFileInfo,
        downloadUpdateOptions,
        task: async (destinationFile, downloadOptions) => {
          const cachedUpdateFilePath = path.join(this.downloadedUpdateHelper.cacheDir, CURRENT_MAC_APP_ZIP_FILE_NAME);
          const canDifferentialDownload = () => {
            if (!(0, fs_extra_1.pathExistsSync)(cachedUpdateFilePath)) {
              log.info("Unable to locate previous update.zip for differential download (is this first install?), falling back to full download");
              return false;
            }
            return !downloadUpdateOptions.disableDifferentialDownload;
          };
          let differentialDownloadFailed = true;
          if (canDifferentialDownload()) {
            differentialDownloadFailed = await this.differentialDownloadInstaller(zipFileInfo, downloadUpdateOptions, destinationFile, provider, CURRENT_MAC_APP_ZIP_FILE_NAME);
          }
          if (differentialDownloadFailed) {
            await this.httpExecutor.download(zipFileInfo.url, destinationFile, downloadOptions);
          }
        },
        done: async (event) => {
          if (!downloadUpdateOptions.disableDifferentialDownload) {
            try {
              const cachedUpdateFilePath = path.join(this.downloadedUpdateHelper.cacheDir, CURRENT_MAC_APP_ZIP_FILE_NAME);
              await (0, fs_extra_1.copyFile)(event.downloadedFile, cachedUpdateFilePath);
            } catch (error2) {
              this._logger.warn(`Unable to copy file for caching for future differential downloads: ${error2.message}`);
            }
          }
          return this.updateDownloaded(zipFileInfo, event);
        }
      });
    }
    async updateDownloaded(zipFileInfo, event) {
      var _a;
      const downloadedFile = event.downloadedFile;
      const updateFileSize = (_a = zipFileInfo.info.size) !== null && _a !== void 0 ? _a : (await (0, fs_extra_1.stat)(downloadedFile)).size;
      const log = this._logger;
      const logContext = `fileToProxy=${zipFileInfo.url.href}`;
      this.closeServerIfExists();
      this.debug(`Creating proxy server for native Squirrel.Mac (${logContext})`);
      this.server = (0, http_1.createServer)();
      this.debug(`Proxy server for native Squirrel.Mac is created (${logContext})`);
      this.server.on("close", () => {
        log.info(`Proxy server for native Squirrel.Mac is closed (${logContext})`);
      });
      const getServerUrl = (s) => {
        const address = s.address();
        if (typeof address === "string") {
          return address;
        }
        return `http://127.0.0.1:${address === null || address === void 0 ? void 0 : address.port}`;
      };
      return await new Promise((resolve, reject) => {
        const pass = (0, crypto_1.randomBytes)(64).toString("base64").replace(/\//g, "_").replace(/\+/g, "-");
        const authInfo = Buffer.from(`autoupdater:${pass}`, "ascii");
        const fileUrl = `/${(0, crypto_1.randomBytes)(64).toString("hex")}.zip`;
        this.server.on("request", (request, response) => {
          const requestUrl = request.url;
          log.info(`${requestUrl} requested`);
          if (requestUrl === "/") {
            if (!request.headers.authorization || request.headers.authorization.indexOf("Basic ") === -1) {
              response.statusCode = 401;
              response.statusMessage = "Invalid Authentication Credentials";
              response.end();
              log.warn("No authenthication info");
              return;
            }
            const base64Credentials = request.headers.authorization.split(" ")[1];
            const credentials = Buffer.from(base64Credentials, "base64").toString("ascii");
            const [username, password] = credentials.split(":");
            if (username !== "autoupdater" || password !== pass) {
              response.statusCode = 401;
              response.statusMessage = "Invalid Authentication Credentials";
              response.end();
              log.warn("Invalid authenthication credentials");
              return;
            }
            const data = Buffer.from(`{ "url": "${getServerUrl(this.server)}${fileUrl}" }`);
            response.writeHead(200, { "Content-Type": "application/json", "Content-Length": data.length });
            response.end(data);
            return;
          }
          if (!requestUrl.startsWith(fileUrl)) {
            log.warn(`${requestUrl} requested, but not supported`);
            response.writeHead(404);
            response.end();
            return;
          }
          log.info(`${fileUrl} requested by Squirrel.Mac, pipe ${downloadedFile}`);
          let errorOccurred = false;
          response.on("finish", () => {
            if (!errorOccurred) {
              this.nativeUpdater.removeListener("error", reject);
              resolve([]);
            }
          });
          const readStream = (0, fs_1.createReadStream)(downloadedFile);
          readStream.on("error", (error2) => {
            try {
              response.end();
            } catch (e) {
              log.warn(`cannot end response: ${e}`);
            }
            errorOccurred = true;
            this.nativeUpdater.removeListener("error", reject);
            reject(new Error(`Cannot pipe "${downloadedFile}": ${error2}`));
          });
          response.writeHead(200, {
            "Content-Type": "application/zip",
            "Content-Length": updateFileSize
          });
          readStream.pipe(response);
        });
        this.debug(`Proxy server for native Squirrel.Mac is starting to listen (${logContext})`);
        this.server.listen(0, "127.0.0.1", () => {
          this.debug(`Proxy server for native Squirrel.Mac is listening (address=${getServerUrl(this.server)}, ${logContext})`);
          this.nativeUpdater.setFeedURL({
            url: getServerUrl(this.server),
            headers: {
              "Cache-Control": "no-cache",
              Authorization: `Basic ${authInfo.toString("base64")}`
            }
          });
          this.dispatchUpdateDownloaded(event);
          if (this.autoInstallOnAppQuit) {
            this.nativeUpdater.once("error", reject);
            this.nativeUpdater.checkForUpdates();
          } else {
            resolve([]);
          }
        });
      });
    }
    handleUpdateDownloaded() {
      if (this.autoRunAppAfterInstall) {
        this.nativeUpdater.quitAndInstall();
      } else {
        this.app.quit();
      }
      this.closeServerIfExists();
    }
    quitAndInstall() {
      if (this.squirrelDownloadedUpdate) {
        this.handleUpdateDownloaded();
      } else {
        this.nativeUpdater.on("update-downloaded", () => this.handleUpdateDownloaded());
        if (!this.autoInstallOnAppQuit) {
          this.nativeUpdater.checkForUpdates();
        }
      }
    }
  };
  MacUpdater.MacUpdater = MacUpdater$1;
  return MacUpdater;
}
var NsisUpdater = {};
var windowsExecutableCodeSignatureVerifier = {};
var hasRequiredWindowsExecutableCodeSignatureVerifier;
function requireWindowsExecutableCodeSignatureVerifier() {
  if (hasRequiredWindowsExecutableCodeSignatureVerifier) return windowsExecutableCodeSignatureVerifier;
  hasRequiredWindowsExecutableCodeSignatureVerifier = 1;
  Object.defineProperty(windowsExecutableCodeSignatureVerifier, "__esModule", { value: true });
  windowsExecutableCodeSignatureVerifier.verifySignature = verifySignature;
  const builder_util_runtime_1 = requireOut();
  const child_process_1 = require$$1$1;
  const os = require$$3;
  const path = require$$1$2;
  function preparePowerShellExec(command, timeout) {
    const executable = `set "PSModulePath=" & chcp 65001 >NUL & powershell.exe`;
    const args = ["-NoProfile", "-NonInteractive", "-InputFormat", "None", "-Command", command];
    const options = {
      shell: true,
      timeout
    };
    return [executable, args, options];
  }
  function verifySignature(publisherNames, unescapedTempUpdateFile, logger) {
    return new Promise((resolve, reject) => {
      const tempUpdateFile = unescapedTempUpdateFile.replace(/'/g, "''");
      logger.info(`Verifying signature ${tempUpdateFile}`);
      (0, child_process_1.execFile)(...preparePowerShellExec(`"Get-AuthenticodeSignature -LiteralPath '${tempUpdateFile}' | ConvertTo-Json -Compress"`, 20 * 1e3), (error2, stdout, stderr) => {
        var _a;
        try {
          if (error2 != null || stderr) {
            handleError(logger, error2, stderr, reject);
            resolve(null);
            return;
          }
          const data = parseOut(stdout);
          if (data.Status === 0) {
            try {
              const normlaizedUpdateFilePath = path.normalize(data.Path);
              const normalizedTempUpdateFile = path.normalize(unescapedTempUpdateFile);
              logger.info(`LiteralPath: ${normlaizedUpdateFilePath}. Update Path: ${normalizedTempUpdateFile}`);
              if (normlaizedUpdateFilePath !== normalizedTempUpdateFile) {
                handleError(logger, new Error(`LiteralPath of ${normlaizedUpdateFilePath} is different than ${normalizedTempUpdateFile}`), stderr, reject);
                resolve(null);
                return;
              }
            } catch (error3) {
              logger.warn(`Unable to verify LiteralPath of update asset due to missing data.Path. Skipping this step of validation. Message: ${(_a = error3.message) !== null && _a !== void 0 ? _a : error3.stack}`);
            }
            const subject = (0, builder_util_runtime_1.parseDn)(data.SignerCertificate.Subject);
            let match = false;
            for (const name of publisherNames) {
              const dn = (0, builder_util_runtime_1.parseDn)(name);
              if (dn.size) {
                const allKeys = Array.from(dn.keys());
                match = allKeys.every((key) => {
                  return dn.get(key) === subject.get(key);
                });
              } else if (name === subject.get("CN")) {
                logger.warn(`Signature validated using only CN ${name}. Please add your full Distinguished Name (DN) to publisherNames configuration`);
                match = true;
              }
              if (match) {
                resolve(null);
                return;
              }
            }
          }
          const result = `publisherNames: ${publisherNames.join(" | ")}, raw info: ` + JSON.stringify(data, (name, value) => name === "RawData" ? void 0 : value, 2);
          logger.warn(`Sign verification failed, installer signed with incorrect certificate: ${result}`);
          resolve(result);
        } catch (e) {
          handleError(logger, e, null, reject);
          resolve(null);
          return;
        }
      });
    });
  }
  function parseOut(out2) {
    const data = JSON.parse(out2);
    delete data.PrivateKey;
    delete data.IsOSBinary;
    delete data.SignatureType;
    const signerCertificate = data.SignerCertificate;
    if (signerCertificate != null) {
      delete signerCertificate.Archived;
      delete signerCertificate.Extensions;
      delete signerCertificate.Handle;
      delete signerCertificate.HasPrivateKey;
      delete signerCertificate.SubjectName;
    }
    return data;
  }
  function handleError(logger, error2, stderr, reject) {
    if (isOldWin6()) {
      logger.warn(`Cannot execute Get-AuthenticodeSignature: ${error2 || stderr}. Ignoring signature validation due to unsupported powershell version. Please upgrade to powershell 3 or higher.`);
      return;
    }
    try {
      (0, child_process_1.execFileSync)(...preparePowerShellExec("ConvertTo-Json test", 10 * 1e3));
    } catch (testError) {
      logger.warn(`Cannot execute ConvertTo-Json: ${testError.message}. Ignoring signature validation due to unsupported powershell version. Please upgrade to powershell 3 or higher.`);
      return;
    }
    if (error2 != null) {
      reject(error2);
    }
    if (stderr) {
      reject(new Error(`Cannot execute Get-AuthenticodeSignature, stderr: ${stderr}. Failing signature validation due to unknown stderr.`));
    }
  }
  function isOldWin6() {
    const winVersion = os.release();
    return winVersion.startsWith("6.") && !winVersion.startsWith("6.3");
  }
  return windowsExecutableCodeSignatureVerifier;
}
var hasRequiredNsisUpdater;
function requireNsisUpdater() {
  if (hasRequiredNsisUpdater) return NsisUpdater;
  hasRequiredNsisUpdater = 1;
  Object.defineProperty(NsisUpdater, "__esModule", { value: true });
  NsisUpdater.NsisUpdater = void 0;
  const builder_util_runtime_1 = requireOut();
  const path = require$$1$2;
  const BaseUpdater_1 = requireBaseUpdater();
  const FileWithEmbeddedBlockMapDifferentialDownloader_1 = requireFileWithEmbeddedBlockMapDifferentialDownloader();
  const types_1 = requireTypes();
  const Provider_1 = requireProvider();
  const fs_extra_1 = /* @__PURE__ */ requireLib();
  const windowsExecutableCodeSignatureVerifier_1 = requireWindowsExecutableCodeSignatureVerifier();
  const url_1 = require$$2$1;
  let NsisUpdater$1 = class NsisUpdater extends BaseUpdater_1.BaseUpdater {
    constructor(options, app) {
      super(options, app);
      this._verifyUpdateCodeSignature = (publisherNames, unescapedTempUpdateFile) => (0, windowsExecutableCodeSignatureVerifier_1.verifySignature)(publisherNames, unescapedTempUpdateFile, this._logger);
    }
    /**
     * The verifyUpdateCodeSignature. You can pass [win-verify-signature](https://github.com/beyondkmp/win-verify-trust) or another custom verify function: ` (publisherName: string[], path: string) => Promise<string | null>`.
     * The default verify function uses [windowsExecutableCodeSignatureVerifier](https://github.com/electron-userland/electron-builder/blob/master/packages/electron-updater/src/windowsExecutableCodeSignatureVerifier.ts)
     */
    get verifyUpdateCodeSignature() {
      return this._verifyUpdateCodeSignature;
    }
    set verifyUpdateCodeSignature(value) {
      if (value) {
        this._verifyUpdateCodeSignature = value;
      }
    }
    /*** @private */
    doDownloadUpdate(downloadUpdateOptions) {
      const provider = downloadUpdateOptions.updateInfoAndProvider.provider;
      const fileInfo = (0, Provider_1.findFile)(provider.resolveFiles(downloadUpdateOptions.updateInfoAndProvider.info), "exe");
      return this.executeDownload({
        fileExtension: "exe",
        downloadUpdateOptions,
        fileInfo,
        task: async (destinationFile, downloadOptions, packageFile, removeTempDirIfAny) => {
          const packageInfo = fileInfo.packageInfo;
          const isWebInstaller = packageInfo != null && packageFile != null;
          if (isWebInstaller && downloadUpdateOptions.disableWebInstaller) {
            throw (0, builder_util_runtime_1.newError)(`Unable to download new version ${downloadUpdateOptions.updateInfoAndProvider.info.version}. Web Installers are disabled`, "ERR_UPDATER_WEB_INSTALLER_DISABLED");
          }
          if (!isWebInstaller && !downloadUpdateOptions.disableWebInstaller) {
            this._logger.warn("disableWebInstaller is set to false, you should set it to true if you do not plan on using a web installer. This will default to true in a future version.");
          }
          if (isWebInstaller || downloadUpdateOptions.disableDifferentialDownload || await this.differentialDownloadInstaller(fileInfo, downloadUpdateOptions, destinationFile, provider, builder_util_runtime_1.CURRENT_APP_INSTALLER_FILE_NAME)) {
            await this.httpExecutor.download(fileInfo.url, destinationFile, downloadOptions);
          }
          const signatureVerificationStatus = await this.verifySignature(destinationFile);
          if (signatureVerificationStatus != null) {
            await removeTempDirIfAny();
            throw (0, builder_util_runtime_1.newError)(`New version ${downloadUpdateOptions.updateInfoAndProvider.info.version} is not signed by the application owner: ${signatureVerificationStatus}`, "ERR_UPDATER_INVALID_SIGNATURE");
          }
          if (isWebInstaller) {
            if (await this.differentialDownloadWebPackage(downloadUpdateOptions, packageInfo, packageFile, provider)) {
              try {
                await this.httpExecutor.download(new url_1.URL(packageInfo.path), packageFile, {
                  headers: downloadUpdateOptions.requestHeaders,
                  cancellationToken: downloadUpdateOptions.cancellationToken,
                  sha512: packageInfo.sha512
                });
              } catch (e) {
                try {
                  await (0, fs_extra_1.unlink)(packageFile);
                } catch (_ignored) {
                }
                throw e;
              }
            }
          }
        }
      });
    }
    // $certificateInfo = (Get-AuthenticodeSignature 'xxx\yyy.exe'
    // | where {$_.Status.Equals([System.Management.Automation.SignatureStatus]::Valid) -and $_.SignerCertificate.Subject.Contains("CN=siemens.com")})
    // | Out-String ; if ($certificateInfo) { exit 0 } else { exit 1 }
    async verifySignature(tempUpdateFile) {
      let publisherName;
      try {
        publisherName = (await this.configOnDisk.value).publisherName;
        if (publisherName == null) {
          return null;
        }
      } catch (e) {
        if (e.code === "ENOENT") {
          return null;
        }
        throw e;
      }
      return await this._verifyUpdateCodeSignature(Array.isArray(publisherName) ? publisherName : [publisherName], tempUpdateFile);
    }
    doInstall(options) {
      const installerPath = this.installerPath;
      if (installerPath == null) {
        this.dispatchError(new Error("No update filepath provided, can't quit and install"));
        return false;
      }
      const args = ["--updated"];
      if (options.isSilent) {
        args.push("/S");
      }
      if (options.isForceRunAfter) {
        args.push("--force-run");
      }
      if (this.installDirectory) {
        args.push(`/D=${this.installDirectory}`);
      }
      const packagePath = this.downloadedUpdateHelper == null ? null : this.downloadedUpdateHelper.packageFile;
      if (packagePath != null) {
        args.push(`--package-file=${packagePath}`);
      }
      const callUsingElevation = () => {
        this.spawnLog(path.join(process.resourcesPath, "elevate.exe"), [installerPath].concat(args)).catch((e) => this.dispatchError(e));
      };
      if (options.isAdminRightsRequired) {
        this._logger.info("isAdminRightsRequired is set to true, run installer using elevate.exe");
        callUsingElevation();
        return true;
      }
      this.spawnLog(installerPath, args).catch((e) => {
        const errorCode = e.code;
        this._logger.info(`Cannot run installer: error code: ${errorCode}, error message: "${e.message}", will be executed again using elevate if EACCES, and will try to use electron.shell.openItem if ENOENT`);
        if (errorCode === "UNKNOWN" || errorCode === "EACCES") {
          callUsingElevation();
        } else if (errorCode === "ENOENT") {
          require$$1.shell.openPath(installerPath).catch((err) => this.dispatchError(err));
        } else {
          this.dispatchError(e);
        }
      });
      return true;
    }
    async differentialDownloadWebPackage(downloadUpdateOptions, packageInfo, packagePath, provider) {
      if (packageInfo.blockMapSize == null) {
        return true;
      }
      try {
        const downloadOptions = {
          newUrl: new url_1.URL(packageInfo.path),
          oldFile: path.join(this.downloadedUpdateHelper.cacheDir, builder_util_runtime_1.CURRENT_APP_PACKAGE_FILE_NAME),
          logger: this._logger,
          newFile: packagePath,
          requestHeaders: this.requestHeaders,
          isUseMultipleRangeRequest: provider.isUseMultipleRangeRequest,
          cancellationToken: downloadUpdateOptions.cancellationToken
        };
        if (this.listenerCount(types_1.DOWNLOAD_PROGRESS) > 0) {
          downloadOptions.onProgress = (it) => this.emit(types_1.DOWNLOAD_PROGRESS, it);
        }
        await new FileWithEmbeddedBlockMapDifferentialDownloader_1.FileWithEmbeddedBlockMapDifferentialDownloader(packageInfo, this.httpExecutor, downloadOptions).download();
      } catch (e) {
        this._logger.error(`Cannot download differentially, fallback to full download: ${e.stack || e}`);
        return process.platform === "win32";
      }
      return false;
    }
  };
  NsisUpdater.NsisUpdater = NsisUpdater$1;
  return NsisUpdater;
}
var hasRequiredMain$1;
function requireMain$1() {
  if (hasRequiredMain$1) return main$3;
  hasRequiredMain$1 = 1;
  (function(exports2) {
    var __createBinding = main$3 && main$3.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function() {
          return m[k];
        } };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __exportStar = main$3 && main$3.__exportStar || function(m, exports3) {
      for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports3, p)) __createBinding(exports3, m, p);
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.NsisUpdater = exports2.MacUpdater = exports2.RpmUpdater = exports2.PacmanUpdater = exports2.DebUpdater = exports2.AppImageUpdater = exports2.Provider = exports2.NoOpLogger = exports2.AppUpdater = exports2.BaseUpdater = void 0;
    const fs_extra_1 = /* @__PURE__ */ requireLib();
    const path = require$$1$2;
    var BaseUpdater_1 = requireBaseUpdater();
    Object.defineProperty(exports2, "BaseUpdater", { enumerable: true, get: function() {
      return BaseUpdater_1.BaseUpdater;
    } });
    var AppUpdater_1 = requireAppUpdater();
    Object.defineProperty(exports2, "AppUpdater", { enumerable: true, get: function() {
      return AppUpdater_1.AppUpdater;
    } });
    Object.defineProperty(exports2, "NoOpLogger", { enumerable: true, get: function() {
      return AppUpdater_1.NoOpLogger;
    } });
    var Provider_1 = requireProvider();
    Object.defineProperty(exports2, "Provider", { enumerable: true, get: function() {
      return Provider_1.Provider;
    } });
    var AppImageUpdater_1 = requireAppImageUpdater();
    Object.defineProperty(exports2, "AppImageUpdater", { enumerable: true, get: function() {
      return AppImageUpdater_1.AppImageUpdater;
    } });
    var DebUpdater_1 = requireDebUpdater();
    Object.defineProperty(exports2, "DebUpdater", { enumerable: true, get: function() {
      return DebUpdater_1.DebUpdater;
    } });
    var PacmanUpdater_1 = requirePacmanUpdater();
    Object.defineProperty(exports2, "PacmanUpdater", { enumerable: true, get: function() {
      return PacmanUpdater_1.PacmanUpdater;
    } });
    var RpmUpdater_1 = requireRpmUpdater();
    Object.defineProperty(exports2, "RpmUpdater", { enumerable: true, get: function() {
      return RpmUpdater_1.RpmUpdater;
    } });
    var MacUpdater_1 = requireMacUpdater();
    Object.defineProperty(exports2, "MacUpdater", { enumerable: true, get: function() {
      return MacUpdater_1.MacUpdater;
    } });
    var NsisUpdater_1 = requireNsisUpdater();
    Object.defineProperty(exports2, "NsisUpdater", { enumerable: true, get: function() {
      return NsisUpdater_1.NsisUpdater;
    } });
    __exportStar(requireTypes(), exports2);
    let _autoUpdater;
    function doLoadAutoUpdater() {
      if (process.platform === "win32") {
        _autoUpdater = new (requireNsisUpdater()).NsisUpdater();
      } else if (process.platform === "darwin") {
        _autoUpdater = new (requireMacUpdater()).MacUpdater();
      } else {
        _autoUpdater = new (requireAppImageUpdater()).AppImageUpdater();
        try {
          const identity = path.join(process.resourcesPath, "package-type");
          if (!(0, fs_extra_1.existsSync)(identity)) {
            return _autoUpdater;
          }
          const fileType = (0, fs_extra_1.readFileSync)(identity).toString().trim();
          switch (fileType) {
            case "deb":
              _autoUpdater = new (requireDebUpdater()).DebUpdater();
              break;
            case "rpm":
              _autoUpdater = new (requireRpmUpdater()).RpmUpdater();
              break;
            case "pacman":
              _autoUpdater = new (requirePacmanUpdater()).PacmanUpdater();
              break;
            default:
              break;
          }
        } catch (error2) {
          console.warn("Unable to detect 'package-type' for autoUpdater (rpm/deb/pacman support). If you'd like to expand support, please consider contributing to electron-builder", error2.message);
        }
      }
      return _autoUpdater;
    }
    Object.defineProperty(exports2, "autoUpdater", {
      enumerable: true,
      get: () => {
        return _autoUpdater || doLoadAutoUpdater();
      }
    });
  })(main$3);
  return main$3;
}
var autoUpdater_1;
var hasRequiredAutoUpdater;
function requireAutoUpdater() {
  if (hasRequiredAutoUpdater) return autoUpdater_1;
  hasRequiredAutoUpdater = 1;
  const { ipcMain, app, BrowserWindow } = require$$1;
  const { autoUpdater } = requireMain$1();
  const path = require$$1$2;
  const fs2 = require$$2;
  const CHECK_INTERVAL = 4 * 60 * 60 * 1e3;
  let _mainWindow = null;
  let _setIsUpdating = null;
  let _hanakoHome = null;
  let _checkTimer = null;
  let _ipcHandlersRegistered = false;
  let _updaterConfigured = false;
  let _installPromise = null;
  function isAutoCheckEnabled() {
    try {
      const prefsPath = path.join(_hanakoHome || "", "user", "preferences.json");
      const prefs = JSON.parse(fs2.readFileSync(prefsPath, "utf-8"));
      return prefs.auto_check_updates !== false;
    } catch {
      return true;
    }
  }
  let _updateState = {
    status: "idle",
    // idle | checking | available | downloading | downloaded | installing | error | latest
    version: null,
    releaseNotes: null,
    releaseUrl: null,
    downloadUrl: null,
    progress: null,
    error: null
  };
  function getState() {
    return { ..._updateState };
  }
  function logUpdate(message) {
    const line = `[${(/* @__PURE__ */ new Date()).toISOString()}] ${message}`;
    try {
      console.log(`[auto-updater] ${message}`);
    } catch {
    }
    if (!_hanakoHome) return;
    try {
      const logDir = path.join(_hanakoHome, "logs");
      fs2.mkdirSync(logDir, { recursive: true });
      fs2.appendFileSync(path.join(logDir, "auto-update.log"), line + "\n", "utf-8");
    } catch {
    }
  }
  function isMissingLatestMetadataError(err) {
    const message = err?.message || String(err || "");
    return /\blatest(?:-mac)?\.ya?ml\b/i.test(message) && /(cannot find|not found|missing|404)/i.test(message);
  }
  function getRendererWindows() {
    const windows = [];
    try {
      if (BrowserWindow?.getAllWindows) windows.push(...BrowserWindow.getAllWindows());
    } catch {
    }
    if (windows.length === 0 && _mainWindow) windows.push(_mainWindow);
    return [...new Set(windows)].filter((win) => {
      try {
        return win && !win.isDestroyed?.();
      } catch {
        return false;
      }
    });
  }
  function sendToRenderer(channel, data) {
    for (const win of getRendererWindows()) {
      try {
        win.webContents?.send?.(channel, data);
      } catch {
      }
    }
  }
  function setState(patch) {
    Object.assign(_updateState, patch);
    sendToRenderer("auto-update-state", getState());
  }
  function resetState() {
    _updateState = {
      status: "idle",
      version: null,
      releaseNotes: null,
      releaseUrl: null,
      downloadUrl: null,
      progress: null,
      error: null
    };
  }
  function getQuitAndInstallOptions() {
    return {
      isSilent: process.platform !== "win32",
      isForceRunAfter: true
    };
  }
  function invokeQuitAndInstallSoon() {
    return new Promise((resolve) => {
      setImmediate(() => {
        try {
          const { isSilent, isForceRunAfter } = getQuitAndInstallOptions();
          logUpdate(`quitAndInstall invoked: silent=${isSilent}, forceRunAfter=${isForceRunAfter}`);
          autoUpdater.quitAndInstall(isSilent, isForceRunAfter);
          resolve(true);
        } catch (err) {
          const msg = err?.message || String(err);
          logUpdate(`install failed before quitAndInstall: ${msg}`);
          if (_setIsUpdating) _setIsUpdating(false);
          setState({ status: "error", error: msg });
          resolve(false);
        }
      });
    });
  }
  async function installDownloadedUpdate(source = "manual") {
    if (_updateState.status === "installing") return true;
    if (_updateState.status !== "downloaded") {
      logUpdate(`install ignored: status=${_updateState.status}, source=${source}`);
      return false;
    }
    if (_installPromise) return _installPromise;
    _installPromise = (async () => {
      const version = _updateState.version;
      logUpdate(`install requested: source=${source}, version=${version || "unknown"}`);
      if (_setIsUpdating) _setIsUpdating(true);
      setState({ status: "installing", version, progress: null, error: null });
      try {
        return await invokeQuitAndInstallSoon();
      } finally {
        _installPromise = null;
      }
    })();
    return _installPromise;
  }
  async function hasSufficientDiskSpace(checkPath, minMB) {
    try {
      const stats = await fs2.promises.statfs(checkPath);
      const availableBytes = stats.bavail * stats.bsize;
      return availableBytes >= minMB * 1024 * 1024;
    } catch {
      return true;
    }
  }
  function isRunningFromDmg() {
    if (process.platform !== "darwin") return false;
    return app.getPath("exe").startsWith("/Volumes/");
  }
  async function cleanUpdateCache() {
    const dataDir = _hanakoHome;
    const versionFile = path.join(dataDir, "last-update-version");
    try {
      const wrongDir = path.join(require("os").homedir(), ".hanako-dev");
      if (wrongDir !== dataDir) {
        const wrongFile = path.join(wrongDir, "last-update-version");
        if (fs2.existsSync(wrongFile)) {
          if (!fs2.existsSync(versionFile)) {
            fs2.mkdirSync(path.dirname(versionFile), { recursive: true });
            fs2.renameSync(wrongFile, versionFile);
          } else {
            fs2.unlinkSync(wrongFile);
          }
          try {
            fs2.rmdirSync(wrongDir);
          } catch {
          }
          console.log("[auto-updater] 已清理旧版误写的 ~/.hanako-dev/last-update-version");
        }
      }
    } catch {
    }
    const currentVersion = app.getVersion();
    let shouldClean = false;
    try {
      const lastVersion = fs2.readFileSync(versionFile, "utf-8").trim();
      if (lastVersion !== currentVersion) shouldClean = true;
    } catch {
    }
    try {
      fs2.mkdirSync(path.dirname(versionFile), { recursive: true });
      fs2.writeFileSync(versionFile, currentVersion);
    } catch {
    }
    if (!shouldClean) {
      const cacheDir = path.join(app.getPath("userData"), "pending");
      try {
        const size = await dirSize(cacheDir);
        if (size > 500 * 1024 * 1024) shouldClean = true;
      } catch {
      }
    }
    if (shouldClean) {
      const cacheDir = path.join(app.getPath("userData"), "pending");
      try {
        await fs2.promises.rm(cacheDir, { recursive: true, force: true });
        console.log("[auto-updater] 已清理更新缓存");
      } catch {
      }
    }
  }
  async function dirSize(dir) {
    let total = 0;
    try {
      const entries = await fs2.promises.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isFile()) {
          const stat2 = await fs2.promises.stat(full);
          total += stat2.size;
        } else if (entry.isDirectory()) {
          total += await dirSize(full);
        }
      }
    } catch {
    }
    return total;
  }
  function setupAutoUpdater() {
    autoUpdater.setFeedURL({
      provider: "github",
      owner: "jingqiu2180",
      repo: "openshadow"
    });
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;
    autoUpdater.allowPrerelease = false;
    autoUpdater.disableDifferentialDownload = true;
    if (process.platform === "win32") {
      autoUpdater.installDirectory = path.dirname(app.getPath("exe"));
    }
    autoUpdater.on("checking-for-update", () => {
      logUpdate("checking for update");
      setState({ status: "checking", progress: null, error: null });
    });
    autoUpdater.on("update-available", async (info) => {
      logUpdate(`update available: version=${info.version || "unknown"}`);
      setState({
        status: "available",
        version: info.version,
        progress: null,
        error: null,
        releaseNotes: typeof info.releaseNotes === "string" ? info.releaseNotes : Array.isArray(info.releaseNotes) ? info.releaseNotes.map((n) => n.note || n).join("\n") : null
      });
      const ok = await hasSufficientDiskSpace(app.getPath("userData"), 500);
      if (!ok) {
        logUpdate(`download blocked: insufficient disk space, version=${info.version || "unknown"}`);
        setState({ status: "error", error: "disk_space_insufficient", version: info.version });
        return;
      }
      autoUpdater.downloadUpdate().catch((err) => {
        logUpdate(`download failed: ${err?.message || String(err)}`);
        setState({ status: "error", error: err?.message || String(err) });
      });
    });
    autoUpdater.on("download-progress", (progress) => {
      setState({
        status: "downloading",
        progress: {
          percent: Math.round(progress.percent),
          bytesPerSecond: progress.bytesPerSecond,
          transferred: progress.transferred,
          total: progress.total
        }
      });
    });
    autoUpdater.on("update-downloaded", (info) => {
      logUpdate(`update downloaded: version=${info.version || "unknown"}`);
      setState({
        status: "downloaded",
        version: info.version,
        progress: null
      });
    });
    autoUpdater.on("update-not-available", () => {
      logUpdate("update not available");
      setState({ status: "latest" });
    });
    autoUpdater.on("error", (err) => {
      if (isMissingLatestMetadataError(err)) {
        logUpdate(`update metadata not ready; treating as no update available: ${err?.message || String(err)}`);
        if (_updateState.status === "installing" && _setIsUpdating) _setIsUpdating(false);
        setState({ status: "latest", error: null, progress: null });
        return;
      }
      if (_updateState.status !== "idle" && _updateState.status !== "latest") {
        logUpdate(`error: ${err?.message || String(err)}`);
        if (_updateState.status === "installing" && _setIsUpdating) _setIsUpdating(false);
        setState({ status: "error", error: err?.message || String(err) });
      }
    });
  }
  function registerIpcHandlers() {
    if (_ipcHandlersRegistered) return;
    _ipcHandlersRegistered = true;
    ipcMain.handle("auto-update-check", async () => {
      if (_updateState.status === "installing") return getState();
      resetState();
      try {
        await autoUpdater.checkForUpdates();
      } catch (err) {
        if (isMissingLatestMetadataError(err)) {
          setState({ status: "latest", error: null, progress: null });
        } else {
          setState({ status: "error", error: err?.message || String(err) });
        }
      }
    });
    ipcMain.handle("auto-update-download", async () => true);
    ipcMain.handle("auto-update-install", async () => {
      return installDownloadedUpdate("manual");
    });
    ipcMain.handle("auto-update-state", () => getState());
    ipcMain.handle("auto-update-set-channel", (_event, channel) => {
      autoUpdater.allowPrerelease = channel === "beta";
    });
  }
  function startPolling() {
    if (_checkTimer) return;
    _checkTimer = setInterval(() => {
      if (!isAutoCheckEnabled()) return;
      autoUpdater.checkForUpdates().catch(() => {
      });
    }, CHECK_INTERVAL);
  }
  function initAutoUpdater(mainWindow, {
    setIsUpdating,
    hanakoHome
  } = {}) {
    _mainWindow = mainWindow;
    _setIsUpdating = setIsUpdating;
    _hanakoHome = hanakoHome;
    registerIpcHandlers();
    if (!app.isPackaged) return;
    if (isRunningFromDmg()) {
      setState({ status: "error", error: "running_from_dmg" });
      return;
    }
    if (_updaterConfigured) return;
    _updaterConfigured = true;
    cleanUpdateCache().catch(() => {
    });
    setupAutoUpdater();
    startPolling();
  }
  async function checkForUpdatesAuto() {
    if (!app.isPackaged || isRunningFromDmg()) return;
    if (!isAutoCheckEnabled()) return;
    try {
      await autoUpdater.checkForUpdates();
    } catch {
    }
  }
  function setUpdateChannel(channel) {
    autoUpdater.allowPrerelease = channel === "beta";
  }
  function setMainWindow(win) {
    _mainWindow = win;
  }
  autoUpdater_1 = { initAutoUpdater, checkForUpdatesAuto, setMainWindow, setUpdateChannel, getState, installDownloadedUpdate };
  return autoUpdater_1;
}
var fileWatchPath;
var hasRequiredFileWatchPath;
function requireFileWatchPath() {
  if (hasRequiredFileWatchPath) return fileWatchPath;
  hasRequiredFileWatchPath = 1;
  const path = require$$1$2;
  function normalizeFileWatchPath(filePath) {
    const resolved = path.resolve(filePath);
    return process.platform === "win32" ? resolved.toLowerCase() : resolved;
  }
  fileWatchPath = {
    normalizeFileWatchPath
  };
  return fileWatchPath;
}
var fileWatchRegistry;
var hasRequiredFileWatchRegistry;
function requireFileWatchRegistry() {
  if (hasRequiredFileWatchRegistry) return fileWatchRegistry;
  hasRequiredFileWatchRegistry = 1;
  const path = require$$1$2;
  const { normalizeFileWatchPath } = requireFileWatchPath();
  function createFileWatchRegistry({ watch: watch2, notifySubscriber, debounceMs = 50 } = {}) {
    if (typeof watch2 !== "function") {
      throw new Error("createFileWatchRegistry: watch function required");
    }
    if (typeof notifySubscriber !== "function") {
      throw new Error("createFileWatchRegistry: notifySubscriber function required");
    }
    const entries = /* @__PURE__ */ new Map();
    const filesBySubscriber = /* @__PURE__ */ new Map();
    function bindSubscriber(fileKey, subscriberId) {
      let files = filesBySubscriber.get(subscriberId);
      if (!files) {
        files = /* @__PURE__ */ new Set();
        filesBySubscriber.set(subscriberId, files);
      }
      files.add(fileKey);
    }
    function unbindSubscriber(fileKey, subscriberId) {
      const files = filesBySubscriber.get(subscriberId);
      if (!files) return;
      files.delete(fileKey);
      if (files.size === 0) filesBySubscriber.delete(subscriberId);
    }
    function closeEntry(fileKey, entry) {
      if (entry.debounceTimer) clearTimeout(entry.debounceTimer);
      try {
        entry.watcher?.close?.();
      } catch {
      }
      entries.delete(fileKey);
    }
    function ensureEntry(filePath) {
      const resolvedPath = path.resolve(filePath);
      const fileKey = normalizeFileWatchPath(resolvedPath);
      let entry = entries.get(fileKey);
      if (entry) return entry;
      const watcher = watch2(resolvedPath, { persistent: false }, (eventType, changedPath) => {
        if (eventType !== "change" && eventType !== "rename" && eventType !== "add" && eventType !== "unlink") {
          return;
        }
        const current = entries.get(fileKey);
        if (!current) return;
        const changed = changedPath ? path.resolve(changedPath) : current.filePath;
        if (normalizeFileWatchPath(changed) !== current.fileKey) return;
        if (current.debounceTimer) clearTimeout(current.debounceTimer);
        current.debounceTimer = setTimeout(() => {
          current.debounceTimer = null;
          const latest = entries.get(fileKey);
          if (!latest) return;
          for (const subscriberId of [...latest.subscribers]) {
            notifySubscriber(subscriberId, latest.filePath);
          }
        }, debounceMs);
      });
      entry = { fileKey, filePath: resolvedPath, watcher, subscribers: /* @__PURE__ */ new Set(), debounceTimer: null };
      entries.set(fileKey, entry);
      return entry;
    }
    function watchFile(filePath, subscriberId) {
      try {
        const entry = ensureEntry(filePath);
        entry.subscribers.add(subscriberId);
        bindSubscriber(entry.fileKey, subscriberId);
        return true;
      } catch {
        return false;
      }
    }
    function unwatchFile(filePath, subscriberId) {
      const fileKey = normalizeFileWatchPath(filePath);
      const entry = entries.get(fileKey);
      if (!entry) {
        unbindSubscriber(fileKey, subscriberId);
        return true;
      }
      entry.subscribers.delete(subscriberId);
      unbindSubscriber(fileKey, subscriberId);
      if (entry.subscribers.size === 0) {
        closeEntry(fileKey, entry);
      }
      return true;
    }
    function unwatchAllForSubscriber(subscriberId) {
      const files = filesBySubscriber.get(subscriberId);
      if (!files) return;
      for (const fileKey of [...files]) {
        const entry = entries.get(fileKey);
        if (entry) unwatchFile(entry.filePath, subscriberId);
        else unbindSubscriber(fileKey, subscriberId);
      }
    }
    return {
      watchFile,
      unwatchFile,
      unwatchAllForSubscriber
    };
  }
  fileWatchRegistry = { createFileWatchRegistry };
  return fileWatchRegistry;
}
var workspaceWatchRegistry;
var hasRequiredWorkspaceWatchRegistry;
function requireWorkspaceWatchRegistry() {
  if (hasRequiredWorkspaceWatchRegistry) return workspaceWatchRegistry;
  hasRequiredWorkspaceWatchRegistry = 1;
  const path = require$$1$2;
  const DEFAULT_IGNORED_SEGMENTS = /* @__PURE__ */ new Set([
    ".git",
    ".hg",
    ".svn",
    "node_modules",
    ".next",
    ".turbo",
    "dist",
    "build",
    "coverage"
  ]);
  function normalizeWatchPath(filePath) {
    const normalized = path.resolve(filePath);
    return process.platform === "win32" ? normalized.toLowerCase() : normalized;
  }
  function isInsidePath(targetPath, rootPath) {
    const rel = path.relative(rootPath, targetPath);
    return rel === "" || !rel.startsWith("..") && !path.isAbsolute(rel);
  }
  function shouldIgnoreWorkspacePath(rootPath, filePath) {
    if (!filePath || typeof filePath !== "string") return false;
    const resolvedRoot = path.resolve(rootPath);
    const resolvedPath = path.resolve(filePath);
    if (!isInsidePath(resolvedPath, resolvedRoot)) return false;
    const rel = path.relative(resolvedRoot, resolvedPath);
    if (!rel) return false;
    const segments = rel.split(path.sep).filter(Boolean);
    return segments.some((segment) => segment.startsWith(".") || DEFAULT_IGNORED_SEGMENTS.has(segment));
  }
  function affectedDirectory(rootPath, eventType, changedPath) {
    const resolvedRoot = path.resolve(rootPath);
    const resolvedChanged = path.resolve(changedPath);
    if (normalizeWatchPath(resolvedChanged) === normalizeWatchPath(resolvedRoot)) return resolvedRoot;
    if (eventType === "addDir" || eventType === "unlinkDir") {
      return path.dirname(resolvedChanged);
    }
    return path.dirname(resolvedChanged);
  }
  function safeCloseWatcher(watcher) {
    try {
      const result = watcher?.close?.();
      if (result && typeof result.catch === "function") {
        result.catch(() => {
        });
      }
    } catch {
    }
  }
  function createWorkspaceWatchRegistry({
    watch: watch2,
    notifySubscriber,
    debounceMs = 80,
    onError
  } = {}) {
    if (typeof watch2 !== "function") {
      throw new Error("createWorkspaceWatchRegistry: watch function required");
    }
    if (typeof notifySubscriber !== "function") {
      throw new Error("createWorkspaceWatchRegistry: notifySubscriber function required");
    }
    const entries = /* @__PURE__ */ new Map();
    const rootsBySubscriber = /* @__PURE__ */ new Map();
    function bindSubscriber(rootKey, subscriberId) {
      let roots = rootsBySubscriber.get(subscriberId);
      if (!roots) {
        roots = /* @__PURE__ */ new Set();
        rootsBySubscriber.set(subscriberId, roots);
      }
      roots.add(rootKey);
    }
    function unbindSubscriber(rootKey, subscriberId) {
      const roots = rootsBySubscriber.get(subscriberId);
      if (!roots) return;
      roots.delete(rootKey);
      if (roots.size === 0) rootsBySubscriber.delete(subscriberId);
    }
    function closeEntry(rootKey, entry) {
      for (const timer of entry.debounceTimers.values()) clearTimeout(timer);
      entry.debounceTimers.clear();
      safeCloseWatcher(entry.watcher);
      entries.delete(rootKey);
    }
    function scheduleNotify(entry, eventType, changedPath) {
      if (!changedPath || shouldIgnoreWorkspacePath(entry.rootPath, changedPath)) return;
      const affectedDir = affectedDirectory(entry.rootPath, eventType, changedPath);
      const affectedKey = normalizeWatchPath(affectedDir);
      const previous = entry.debounceTimers.get(affectedKey);
      if (previous) clearTimeout(previous);
      const payload = {
        rootPath: entry.rootPath,
        changedPath: path.resolve(changedPath),
        affectedDir,
        eventType
      };
      const timer = setTimeout(() => {
        entry.debounceTimers.delete(affectedKey);
        const current = entries.get(entry.rootKey);
        if (!current) return;
        for (const subscriberId of [...current.subscribers]) {
          notifySubscriber(subscriberId, payload);
        }
      }, debounceMs);
      entry.debounceTimers.set(affectedKey, timer);
    }
    function ensureEntry(rootPath) {
      const resolvedRoot = path.resolve(rootPath);
      const rootKey = normalizeWatchPath(resolvedRoot);
      let entry = entries.get(rootKey);
      if (entry) return entry;
      const watcher = watch2(resolvedRoot, {
        ignoreInitial: true,
        persistent: false,
        atomic: true,
        depth: 0,
        awaitWriteFinish: false,
        ignorePermissionErrors: true,
        ignored: (filePath) => shouldIgnoreWorkspacePath(resolvedRoot, filePath)
      });
      entry = {
        rootKey,
        rootPath: resolvedRoot,
        watcher,
        subscribers: /* @__PURE__ */ new Set(),
        debounceTimers: /* @__PURE__ */ new Map()
      };
      watcher.on("all", (eventType, changedPath) => {
        if (eventType !== "add" && eventType !== "change" && eventType !== "unlink" && eventType !== "addDir" && eventType !== "unlinkDir") {
          return;
        }
        scheduleNotify(entry, eventType, changedPath);
      });
      watcher.on("error", (err) => {
        if (typeof onError === "function") onError(err, resolvedRoot);
      });
      entries.set(rootKey, entry);
      return entry;
    }
    function watchWorkspace(rootPath, subscriberId) {
      try {
        const entry = ensureEntry(rootPath);
        entry.subscribers.add(subscriberId);
        bindSubscriber(entry.rootKey, subscriberId);
        return true;
      } catch {
        return false;
      }
    }
    function unwatchWorkspace(rootPath, subscriberId) {
      const rootKey = normalizeWatchPath(rootPath);
      const entry = entries.get(rootKey);
      if (!entry) {
        unbindSubscriber(rootKey, subscriberId);
        return true;
      }
      entry.subscribers.delete(subscriberId);
      unbindSubscriber(rootKey, subscriberId);
      if (entry.subscribers.size === 0) {
        closeEntry(rootKey, entry);
      }
      return true;
    }
    function unwatchAllForSubscriber(subscriberId) {
      const roots = rootsBySubscriber.get(subscriberId);
      if (!roots) return;
      for (const rootKey of [...roots]) {
        const entry = entries.get(rootKey);
        if (entry) unwatchWorkspace(entry.rootPath, subscriberId);
        else unbindSubscriber(rootKey, subscriberId);
      }
    }
    return {
      watchWorkspace,
      unwatchWorkspace,
      unwatchAllForSubscriber
    };
  }
  workspaceWatchRegistry = {
    createWorkspaceWatchRegistry,
    shouldIgnoreWorkspacePath
  };
  return workspaceWatchRegistry;
}
var gpuStartupPolicy;
var hasRequiredGpuStartupPolicy;
function requireGpuStartupPolicy() {
  if (hasRequiredGpuStartupPolicy) return gpuStartupPolicy;
  hasRequiredGpuStartupPolicy = 1;
  const fs2 = require$$2;
  const path = require$$1$2;
  const STATE_VERSION = 2;
  const STATE_FILE = path.join("user", "gpu-startup.json");
  const PREFERENCES_FILE = path.join("user", "preferences.json");
  const GPU_MODE_HARDWARE = "hardware";
  const GPU_MODE_GPU_SANDBOX_COMPAT = "gpu-sandbox-compat";
  const GPU_MODE_GPU_BACKEND_COMPAT = "gpu-backend-compat";
  const GPU_MODE_SOFTWARE_SAFE = "software-safe";
  const GPU_MODE_DEEP_COMPAT = "deep-compat";
  const GPU_MODE_DIAGNOSTIC_FAILED = "diagnostic-failed";
  const GPU_SANDBOX_COMPAT_DISABLE_FEATURES = ["GpuSandbox"];
  const GPU_BACKEND_COMPAT_DISABLE_FEATURES = ["GpuSandbox", "Vulkan", "SkiaGraphite"];
  const GPU_RECOVERY_STARTUP_PHASES = /* @__PURE__ */ new Set([
    "electron-starting",
    "launching-splash",
    "splash-ready",
    "main-window-created",
    "onboarding-window-created"
  ]);
  const NON_GPU_STARTUP_PHASES = /* @__PURE__ */ new Set([
    "server-starting",
    "server-ready"
  ]);
  const LEGACY_AUTO_SAFE_MODE_REASONS = /* @__PURE__ */ new Set([
    "previous-startup-incomplete"
  ]);
  const GPU_FAILURE_REASONS = /* @__PURE__ */ new Set([
    "abnormal-exit",
    "crashed",
    "integrity-failure",
    "launch-failed",
    "oom"
  ]);
  function nowIso(now) {
    if (now instanceof Date) return now.toISOString();
    if (typeof now === "string" && now) return now;
    return (/* @__PURE__ */ new Date()).toISOString();
  }
  function readJson(filePath, fallback = {}) {
    try {
      const parsed = JSON.parse(fs2.readFileSync(filePath, "utf-8"));
      return parsed && typeof parsed === "object" ? parsed : fallback;
    } catch {
      return fallback;
    }
  }
  function writeJson(filePath, value) {
    fs2.mkdirSync(path.dirname(filePath), { recursive: true });
    const tmpPath = `${filePath}.${process.pid}.tmp`;
    fs2.writeFileSync(tmpPath, JSON.stringify(value, null, 2) + "\n", "utf-8");
    fs2.renameSync(tmpPath, filePath);
  }
  function getGpuStartupStatePath(hanakoHome) {
    return path.join(hanakoHome, STATE_FILE);
  }
  function getPreferencesPath(hanakoHome) {
    return path.join(hanakoHome, PREFERENCES_FILE);
  }
  function readState(hanakoHome) {
    return readJson(getGpuStartupStatePath(hanakoHome), { version: STATE_VERSION });
  }
  function writeState(hanakoHome, state) {
    writeJson(getGpuStartupStatePath(hanakoHome), {
      ...state,
      version: STATE_VERSION
    });
  }
  function readPreferences(hanakoHome) {
    return readJson(getPreferencesPath(hanakoHome), {});
  }
  function writePreferences(hanakoHome, prefs) {
    writeJson(getPreferencesPath(hanakoHome), prefs);
  }
  function boolFromSetting(value, defaultValue) {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (["false", "0", "off", "no", "disabled"].includes(normalized)) return false;
      if (["true", "1", "on", "yes", "enabled"].includes(normalized)) return true;
    }
    return defaultValue;
  }
  function hasArg(argv, name) {
    const prefix = `--${name}`;
    return (argv || []).some((arg) => arg === prefix || String(arg).startsWith(`${prefix}=`));
  }
  function isExplicitSafeMode(argv, env) {
    if (boolFromSetting(env?.HANA_GPU_SAFE_MODE, false)) return true;
    if (boolFromSetting(env?.HANA_DISABLE_HARDWARE_ACCELERATION, false)) return true;
    return hasArg(argv, "hana-gpu-safe-mode") || hasArg(argv, "hana-disable-hardware-acceleration");
  }
  function isExplicitGpuSandboxCompatibility(argv, env) {
    if (boolFromSetting(env?.HANA_GPU_SANDBOX_COMPAT, false)) return true;
    return hasArg(argv, "hana-gpu-sandbox-compat");
  }
  function isExplicitGpuBackendCompatibility(argv, env) {
    if (boolFromSetting(env?.HANA_GPU_BACKEND_COMPAT, false)) return true;
    return hasArg(argv, "hana-gpu-backend-compat");
  }
  function isExplicitUnsafeNoSandbox(argv, env) {
    if (boolFromSetting(env?.HANA_GPU_UNSAFE_NO_SANDBOX, false)) return true;
    return hasArg(argv, "hana-gpu-unsafe-no-sandbox");
  }
  function policyForMode(mode, reason, extra = {}) {
    const normalizedMode = mode || GPU_MODE_HARDWARE;
    const shouldDisableHardwareAcceleration = normalizedMode === GPU_MODE_SOFTWARE_SAFE || normalizedMode === GPU_MODE_DEEP_COMPAT || normalizedMode === GPU_MODE_DIAGNOSTIC_FAILED;
    return {
      mode: normalizedMode,
      hardwareAccelerationEnabled: !shouldDisableHardwareAcceleration,
      shouldDisableHardwareAcceleration,
      shouldApplyGpuSandboxCompatSwitches: normalizedMode === GPU_MODE_GPU_SANDBOX_COMPAT,
      shouldApplyGpuBackendCompatSwitches: normalizedMode === GPU_MODE_GPU_BACKEND_COMPAT,
      shouldApplyDeepCompatSwitches: normalizedMode === GPU_MODE_DEEP_COMPAT || normalizedMode === GPU_MODE_DIAGNOSTIC_FAILED,
      shouldApplyUnsafeNoSandboxSwitch: false,
      reason: reason || "default",
      ...extra
    };
  }
  function writeAutoGpuMode(hanakoHome, mode, {
    reason,
    previousMode,
    previousStartup,
    now
  } = {}) {
    const timestamp = nowIso(now);
    const state = readState(hanakoHome);
    writeState(hanakoHome, {
      ...state,
      autoGpuMode: {
        mode,
        reason: reason || "unknown",
        previousMode: previousMode || null,
        previousStartup: previousStartup || null,
        updatedAt: timestamp
      }
    });
  }
  function migrateLegacyAutoSafeModePreference(hanakoHome, prefs, state, now) {
    if (prefs?.hardware_acceleration !== false) return null;
    const safeMode = state?.safeMode;
    if (!safeMode?.enabled) return null;
    if (!LEGACY_AUTO_SAFE_MODE_REASONS.has(safeMode.reason || "")) return null;
    const nextPrefs = { ...prefs };
    delete nextPrefs.hardware_acceleration;
    writePreferences(hanakoHome, nextPrefs);
    writeAutoGpuMode(hanakoHome, GPU_MODE_GPU_SANDBOX_COMPAT, {
      reason: "legacy-auto-safe-mode-migration",
      previousMode: GPU_MODE_SOFTWARE_SAFE,
      previousStartup: safeMode.previousStartup || null,
      now
    });
    return policyForMode(GPU_MODE_GPU_SANDBOX_COMPAT, "legacy-auto-safe-mode-migration", {
      autoGpuMode: {
        mode: GPU_MODE_GPU_SANDBOX_COMPAT,
        reason: "legacy-auto-safe-mode-migration",
        previousMode: GPU_MODE_SOFTWARE_SAFE,
        previousStartup: safeMode.previousStartup || null,
        updatedAt: nowIso(now)
      }
    });
  }
  function resolveStoredAutoGpuMode(state) {
    const mode = state?.autoGpuMode?.mode;
    if (mode === GPU_MODE_GPU_SANDBOX_COMPAT || mode === GPU_MODE_GPU_BACKEND_COMPAT || mode === GPU_MODE_SOFTWARE_SAFE || mode === GPU_MODE_DEEP_COMPAT || mode === GPU_MODE_DIAGNOSTIC_FAILED) {
      return state.autoGpuMode;
    }
    if (state?.safeMode?.enabled) {
      return {
        mode: GPU_MODE_SOFTWARE_SAFE,
        reason: state.safeMode.reason || "legacy-safe-mode",
        previousMode: null,
        previousStartup: state.safeMode.previousStartup || null,
        updatedAt: state.safeMode.updatedAt || null
      };
    }
    return null;
  }
  function currentPolicyMode(policy, prefs) {
    if (policy?.mode) return policy.mode;
    if (policy?.shouldApplyGpuBackendCompatSwitches) return GPU_MODE_GPU_BACKEND_COMPAT;
    if (policy?.shouldApplyGpuSandboxCompatSwitches) return GPU_MODE_GPU_SANDBOX_COMPAT;
    if (policy?.shouldApplyDeepCompatSwitches) return GPU_MODE_DEEP_COMPAT;
    if (policy?.shouldDisableHardwareAcceleration) return GPU_MODE_SOFTWARE_SAFE;
    if (!boolFromSetting(prefs?.hardware_acceleration, true)) return GPU_MODE_SOFTWARE_SAFE;
    return GPU_MODE_HARDWARE;
  }
  function nextModeAfterGpuFailure(mode) {
    if (mode === GPU_MODE_DEEP_COMPAT || mode === GPU_MODE_DIAGNOSTIC_FAILED) {
      return GPU_MODE_DIAGNOSTIC_FAILED;
    }
    if (mode === GPU_MODE_GPU_BACKEND_COMPAT) return GPU_MODE_SOFTWARE_SAFE;
    if (mode === GPU_MODE_GPU_SANDBOX_COMPAT) return GPU_MODE_GPU_BACKEND_COMPAT;
    if (mode === GPU_MODE_SOFTWARE_SAFE) return GPU_MODE_DEEP_COMPAT;
    return GPU_MODE_GPU_SANDBOX_COMPAT;
  }
  function sanitizeStartupPolicy(policy) {
    if (!policy || typeof policy !== "object") return null;
    return {
      mode: currentPolicyMode(policy, {}),
      reason: policy.reason || "unknown",
      hardwareAccelerationEnabled: policy.hardwareAccelerationEnabled !== false,
      shouldDisableHardwareAcceleration: policy.shouldDisableHardwareAcceleration === true,
      shouldApplyGpuSandboxCompatSwitches: policy.shouldApplyGpuSandboxCompatSwitches === true,
      shouldApplyGpuBackendCompatSwitches: policy.shouldApplyGpuBackendCompatSwitches === true,
      shouldApplyDeepCompatSwitches: policy.shouldApplyDeepCompatSwitches === true,
      shouldApplyUnsafeNoSandboxSwitch: policy.shouldApplyUnsafeNoSandboxSwitch === true
    };
  }
  function startupPolicyMode(startup, autoMode, fallbackMode = GPU_MODE_HARDWARE) {
    const mode = startup?.policy?.mode;
    if (mode === GPU_MODE_HARDWARE || mode === GPU_MODE_GPU_SANDBOX_COMPAT || mode === GPU_MODE_GPU_BACKEND_COMPAT || mode === GPU_MODE_SOFTWARE_SAFE || mode === GPU_MODE_DEEP_COMPAT || mode === GPU_MODE_DIAGNOSTIC_FAILED) {
      return mode;
    }
    if (autoMode?.mode) return autoMode.mode;
    return fallbackMode;
  }
  function normalizeGpuRecoveryState(value) {
    if (!value || typeof value !== "object" || typeof value.eligible !== "boolean") return null;
    return {
      eligible: value.eligible === true,
      phase: typeof value.phase === "string" ? value.phase : null,
      updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : null
    };
  }
  function buildGpuRecoveryState(phase, previousGpuRecovery, timestamp) {
    const previous = normalizeGpuRecoveryState(previousGpuRecovery);
    if (GPU_RECOVERY_STARTUP_PHASES.has(phase)) {
      return {
        eligible: true,
        phase,
        updatedAt: timestamp
      };
    }
    if (NON_GPU_STARTUP_PHASES.has(phase)) {
      if (previous?.eligible && previous.phase && previous.phase !== "electron-starting") {
        return previous;
      }
      return {
        eligible: false,
        phase: null,
        updatedAt: timestamp
      };
    }
    if (previous?.eligible) return previous;
    return null;
  }
  function classifyIncompleteStartup(state) {
    const startup = state?.startup;
    if (!startup || startup.status !== "pending") return "none";
    const recovery = normalizeGpuRecoveryState(startup.gpuRecovery);
    if (recovery?.eligible) return "gpu-recovery";
    if (recovery && recovery.eligible === false) return "non-gpu";
    const phase = startup.phase || "electron-starting";
    if (NON_GPU_STARTUP_PHASES.has(phase)) return "non-gpu";
    if (GPU_RECOVERY_STARTUP_PHASES.has(phase)) return "gpu-recovery";
    return "unknown";
  }
  function isGpuRecoveryIncompleteStartup(state) {
    return classifyIncompleteStartup(state) === "gpu-recovery";
  }
  function classifyGpuSandboxDiagnostic(state, policy) {
    if (policy?.shouldApplyUnsafeNoSandboxSwitch === true) return "explicit-unsafe-no-sandbox";
    const mode = policy?.mode || state?.autoGpuMode?.mode || null;
    if (mode === GPU_MODE_DIAGNOSTIC_FAILED || state?.autoGpuMode?.mode === GPU_MODE_DIAGNOSTIC_FAILED) {
      return "sandbox-init-failure-suspected";
    }
    return "none";
  }
  function resolveGpuStartupPolicy({
    hanakoHome,
    platform = process.platform,
    argv = process.argv,
    env = process.env,
    now
  } = {}) {
    if (!hanakoHome) throw new Error("resolveGpuStartupPolicy requires hanakoHome");
    const prefs = readPreferences(hanakoHome);
    const explicitSafeMode = isExplicitSafeMode(argv, env);
    if (explicitSafeMode) {
      return policyForMode(GPU_MODE_SOFTWARE_SAFE, "explicit");
    }
    const explicitUnsafeNoSandbox = isExplicitUnsafeNoSandbox(argv, env);
    if (explicitUnsafeNoSandbox) {
      return policyForMode(GPU_MODE_GPU_SANDBOX_COMPAT, "explicit-unsafe-no-sandbox", {
        shouldApplyUnsafeNoSandboxSwitch: true
      });
    }
    const explicitGpuBackendCompatibility = isExplicitGpuBackendCompatibility(argv, env);
    if (explicitGpuBackendCompatibility) {
      return policyForMode(GPU_MODE_GPU_BACKEND_COMPAT, "explicit");
    }
    const explicitGpuSandboxCompatibility = isExplicitGpuSandboxCompatibility(argv, env);
    if (explicitGpuSandboxCompatibility) {
      return policyForMode(GPU_MODE_GPU_SANDBOX_COMPAT, "explicit");
    }
    const preferenceEnabled = boolFromSetting(prefs.hardware_acceleration, true);
    const state = readState(hanakoHome);
    const migratedLegacyPolicy = platform === "win32" ? migrateLegacyAutoSafeModePreference(hanakoHome, prefs, state, now) : null;
    if (migratedLegacyPolicy) return migratedLegacyPolicy;
    const autoMode = platform === "win32" ? resolveStoredAutoGpuMode(state) : null;
    if (platform === "win32" && isGpuRecoveryIncompleteStartup(state)) {
      const fallbackMode = preferenceEnabled ? GPU_MODE_HARDWARE : GPU_MODE_SOFTWARE_SAFE;
      const previousMode = startupPolicyMode(state.startup, autoMode, fallbackMode);
      const nextMode = nextModeAfterGpuFailure(previousMode);
      writeAutoGpuMode(hanakoHome, nextMode, {
        reason: "previous-startup-incomplete",
        previousMode,
        previousStartup: state.startup,
        now
      });
      return policyForMode(nextMode, "previous-startup-incomplete");
    }
    if (autoMode?.mode === GPU_MODE_DEEP_COMPAT || autoMode?.mode === GPU_MODE_DIAGNOSTIC_FAILED) {
      return policyForMode(autoMode.mode, autoMode.reason || "gpu-child-process-gone", {
        autoGpuMode: autoMode
      });
    }
    if (!preferenceEnabled) {
      return policyForMode(GPU_MODE_SOFTWARE_SAFE, "preference");
    }
    if (autoMode?.mode === GPU_MODE_GPU_SANDBOX_COMPAT || autoMode?.mode === GPU_MODE_GPU_BACKEND_COMPAT || autoMode?.mode === GPU_MODE_SOFTWARE_SAFE) {
      return policyForMode(autoMode.mode, autoMode.reason || "gpu-child-process-gone", {
        autoGpuMode: autoMode
      });
    }
    return policyForMode(GPU_MODE_HARDWARE, "default");
  }
  function featureList(value) {
    return String(value || "").split(",").map((feature) => feature.trim()).filter(Boolean);
  }
  function appendMergedFeatureSwitch(app, switchName, features) {
    const commandLine = app?.commandLine;
    if (!commandLine?.appendSwitch) return false;
    let existing = "";
    try {
      if (typeof commandLine.hasSwitch === "function" && commandLine.hasSwitch(switchName)) {
        existing = typeof commandLine.getSwitchValue === "function" ? commandLine.getSwitchValue(switchName) : "";
      }
    } catch {
    }
    const merged = [];
    const seen = /* @__PURE__ */ new Set();
    for (const feature of [...featureList(existing), ...features]) {
      if (seen.has(feature)) continue;
      seen.add(feature);
      merged.push(feature);
    }
    commandLine.appendSwitch(switchName, merged.join(","));
    return true;
  }
  function applyGpuSandboxCompatibilitySwitches(app, policy) {
    const commandLine = app?.commandLine;
    if (!commandLine?.appendSwitch) return { applied: false, unsafeNoSandbox: false };
    commandLine.appendSwitch("disable-gpu-sandbox");
    appendMergedFeatureSwitch(app, "disable-features", GPU_SANDBOX_COMPAT_DISABLE_FEATURES);
    if (policy?.shouldApplyUnsafeNoSandboxSwitch) {
      commandLine.appendSwitch("no-sandbox");
      return { applied: true, unsafeNoSandbox: true };
    }
    return { applied: true, unsafeNoSandbox: false };
  }
  function applyGpuBackendCompatibilitySwitches(app) {
    const commandLine = app?.commandLine;
    if (!commandLine?.appendSwitch) return { applied: false };
    commandLine.appendSwitch("disable-gpu-sandbox");
    appendMergedFeatureSwitch(app, "disable-features", GPU_BACKEND_COMPAT_DISABLE_FEATURES);
    commandLine.appendSwitch("use-angle", "d3d11");
    commandLine.appendSwitch("disable-direct-composition");
    return { applied: true };
  }
  function applyGpuStartupPolicy(app, policy) {
    const gpuBackendCompat = policy?.shouldApplyGpuBackendCompatSwitches ? applyGpuBackendCompatibilitySwitches(app) : { applied: false };
    const gpuSandboxCompat = !gpuBackendCompat.applied && policy?.shouldApplyGpuSandboxCompatSwitches ? applyGpuSandboxCompatibilitySwitches(app, policy) : { applied: false, unsafeNoSandbox: false };
    if (policy?.shouldDisableHardwareAcceleration && typeof app?.disableHardwareAcceleration === "function") {
      app.disableHardwareAcceleration();
      if (policy?.shouldApplyDeepCompatSwitches && app?.commandLine?.appendSwitch) {
        app.commandLine.appendSwitch("disable-gpu");
        app.commandLine.appendSwitch("disable-gpu-compositing");
        app.commandLine.appendSwitch("disable-gpu-rasterization");
        return {
          applied: true,
          deepCompat: true,
          gpuBackendCompat: gpuBackendCompat.applied,
          gpuSandboxCompat: gpuSandboxCompat.applied,
          unsafeNoSandbox: gpuSandboxCompat.unsafeNoSandbox
        };
      }
      return {
        applied: true,
        deepCompat: false,
        gpuBackendCompat: gpuBackendCompat.applied,
        gpuSandboxCompat: gpuSandboxCompat.applied,
        unsafeNoSandbox: gpuSandboxCompat.unsafeNoSandbox
      };
    }
    return {
      applied: gpuBackendCompat.applied || gpuSandboxCompat.applied,
      gpuBackendCompat: gpuBackendCompat.applied,
      gpuSandboxCompat: gpuSandboxCompat.applied,
      unsafeNoSandbox: gpuSandboxCompat.unsafeNoSandbox
    };
  }
  function markGpuStartupPending({
    hanakoHome,
    platform = process.platform,
    phase = "electron-starting",
    startupId = `${Date.now()}-${process.pid}`,
    policy = null,
    now
  } = {}) {
    if (!hanakoHome) throw new Error("markGpuStartupPending requires hanakoHome");
    const timestamp = nowIso(now);
    const state = readState(hanakoHome);
    const startupPolicy = sanitizeStartupPolicy(policy);
    const gpuRecovery = buildGpuRecoveryState(phase, null, timestamp);
    const next = {
      ...state,
      startup: {
        status: "pending",
        startupId,
        phase,
        platform,
        startedAt: timestamp,
        updatedAt: timestamp,
        ...startupPolicy ? { policy: startupPolicy } : {},
        ...gpuRecovery ? { gpuRecovery } : {}
      }
    };
    writeState(hanakoHome, next);
    return next.startup;
  }
  function markGpuStartupPhase({
    hanakoHome,
    platform = process.platform,
    phase,
    startupId,
    now
  } = {}) {
    if (!hanakoHome || !phase) return null;
    const state = readState(hanakoHome);
    if (!state.startup || state.startup.status !== "pending") return null;
    if (startupId && state.startup.startupId && state.startup.startupId !== startupId) return null;
    const timestamp = nowIso(now);
    const gpuRecovery = buildGpuRecoveryState(phase, state.startup.gpuRecovery, timestamp);
    state.startup = {
      ...state.startup,
      startupId: startupId || state.startup.startupId,
      platform,
      phase,
      updatedAt: timestamp
    };
    if (gpuRecovery) {
      state.startup.gpuRecovery = gpuRecovery;
    } else {
      delete state.startup.gpuRecovery;
    }
    writeState(hanakoHome, state);
    return state.startup;
  }
  function markGpuStartupReady({
    hanakoHome,
    platform = process.platform,
    phase = "app-ready",
    startupId,
    now
  } = {}) {
    if (!hanakoHome) throw new Error("markGpuStartupReady requires hanakoHome");
    const state = readState(hanakoHome);
    const timestamp = nowIso(now);
    state.startup = {
      ...state.startup || {},
      status: "ready",
      startupId: startupId || state.startup?.startupId,
      phase,
      platform,
      readyAt: timestamp,
      updatedAt: timestamp
    };
    writeState(hanakoHome, state);
    return state.startup;
  }
  function markGpuStartupFailed({
    hanakoHome,
    platform = process.platform,
    reason,
    startupId,
    now
  } = {}) {
    if (!hanakoHome) throw new Error("markGpuStartupFailed requires hanakoHome");
    const state = readState(hanakoHome);
    const timestamp = nowIso(now);
    state.startup = {
      ...state.startup || {},
      status: "failed",
      startupId: startupId || state.startup?.startupId,
      platform,
      reason: reason || "startup-failed",
      failedAt: timestamp,
      updatedAt: timestamp
    };
    writeState(hanakoHome, state);
    return state.startup;
  }
  function sanitizeGpuDetails(details = {}) {
    return {
      type: details.type || "Unknown",
      reason: details.reason || "unknown",
      exitCode: typeof details.exitCode === "number" ? details.exitCode : null,
      serviceName: details.serviceName || "",
      name: details.name || ""
    };
  }
  function isGpuChildProcessFailure(details = {}) {
    return details.type === "GPU" && GPU_FAILURE_REASONS.has(details.reason || "unknown");
  }
  function recordGpuChildProcessGone({
    hanakoHome,
    platform = process.platform,
    policy = null,
    details,
    now
  } = {}) {
    if (!hanakoHome || !isGpuChildProcessFailure(details)) return false;
    const timestamp = nowIso(now);
    const crash = {
      ...sanitizeGpuDetails(details),
      platform,
      at: timestamp
    };
    const state = readState(hanakoHome);
    const prefs = readPreferences(hanakoHome);
    const previousMode = currentPolicyMode(policy, prefs);
    const nextMode = nextModeAfterGpuFailure(previousMode);
    writeState(hanakoHome, {
      ...state,
      autoGpuMode: {
        mode: nextMode,
        reason: "gpu-child-process-gone",
        previousMode,
        updatedAt: timestamp
      },
      lastGpuCrash: crash
    });
    return true;
  }
  function recordGpuInfoUpdate({
    hanakoHome,
    platform = process.platform,
    featureStatus,
    now
  } = {}) {
    if (!hanakoHome || !featureStatus || typeof featureStatus !== "object") return false;
    const state = readState(hanakoHome);
    writeState(hanakoHome, {
      ...state,
      lastGpuFeatureStatus: {
        platform,
        at: nowIso(now),
        featureStatus
      }
    });
    return true;
  }
  function buildGpuStartupDiagnostics({ hanakoHome, policy, app } = {}) {
    const items = [
      ``,
      `--- GPU Startup ---`,
      `Hardware acceleration preference: ${readPreferences(hanakoHome).hardware_acceleration ?? "default"}`,
      `Startup policy: ${policy?.reason || "unknown"}`,
      `Startup policy mode: ${policy?.mode || "unknown"}`,
      `GPU sandbox compatibility switches enabled: ${policy?.shouldApplyGpuSandboxCompatSwitches === true}`,
      `GPU backend compatibility switches enabled: ${policy?.shouldApplyGpuBackendCompatSwitches === true}`,
      `GPU sandbox disabled by policy: ${policy?.shouldApplyGpuSandboxCompatSwitches === true || policy?.shouldApplyGpuBackendCompatSwitches === true}`,
      `Deep compatibility switches enabled: ${policy?.shouldApplyDeepCompatSwitches === true}`,
      `Unsafe no-sandbox diagnostic enabled: ${policy?.shouldApplyUnsafeNoSandboxSwitch === true}`,
      `Hardware acceleration enabled by policy: ${policy?.hardwareAccelerationEnabled !== false}`
    ];
    try {
      if (app && typeof app.isHardwareAccelerationEnabled === "function") {
        items.push(`Electron hardware acceleration enabled: ${app.isHardwareAccelerationEnabled()}`);
      }
    } catch {
    }
    try {
      if (app && typeof app.getGPUFeatureStatus === "function") {
        items.push(`GPU feature status: ${JSON.stringify(app.getGPUFeatureStatus())}`);
      }
    } catch {
    }
    const state = readState(hanakoHome);
    items.push(`Incomplete startup classification: ${classifyIncompleteStartup(state)}`);
    items.push(`GPU sandbox diagnostic classification: ${classifyGpuSandboxDiagnostic(state, policy)}`);
    items.push(`Unsafe no-sandbox note: only enabled by --hana-gpu-unsafe-no-sandbox for one diagnostic launch`);
    if (state.startup) items.push(`GPU startup marker: ${JSON.stringify(state.startup)}`);
    if (state.autoGpuMode) items.push(`GPU auto mode: ${JSON.stringify(state.autoGpuMode)}`);
    if (state.safeMode) items.push(`GPU safe mode: ${JSON.stringify(state.safeMode)}`);
    if (state.lastGpuCrash) items.push(`Last GPU crash: ${JSON.stringify(state.lastGpuCrash)}`);
    if (state.lastGpuFeatureStatus) {
      items.push(`Last GPU feature status: ${JSON.stringify(state.lastGpuFeatureStatus)}`);
    }
    return items.join("\n");
  }
  gpuStartupPolicy = {
    applyGpuStartupPolicy,
    buildGpuStartupDiagnostics,
    getGpuStartupStatePath,
    getPreferencesPath,
    markGpuStartupFailed,
    markGpuStartupPending,
    markGpuStartupPhase,
    markGpuStartupReady,
    recordGpuChildProcessGone,
    recordGpuInfoUpdate,
    resolveGpuStartupPolicy
  };
  return gpuStartupPolicy;
}
var networkProxy;
var hasRequiredNetworkProxy;
function requireNetworkProxy() {
  if (hasRequiredNetworkProxy) return networkProxy;
  hasRequiredNetworkProxy = 1;
  const NETWORK_PROXY_MODES = ["system", "manual", "direct"];
  const DEFAULT_NO_PROXY = "localhost, 127.0.0.1, ::1";
  const FORCED_LOCAL_PROXY_BYPASS = Object.freeze(["localhost", "127.0.0.1", "::1"]);
  const DEFAULT_NETWORK_PROXY_CONFIG = Object.freeze({
    mode: "system",
    httpProxy: "",
    httpsProxy: "",
    wsProxy: "",
    wssProxy: "",
    noProxy: DEFAULT_NO_PROXY
  });
  const ALLOWED_PROXY_PROTOCOLS = /* @__PURE__ */ new Set(["http:", "https:", "socks:", "socks5:"]);
  function hasOwn(obj, key) {
    return !!obj && typeof obj === "object" && Object.prototype.hasOwnProperty.call(obj, key);
  }
  function normalizeMode(value, strict) {
    if (NETWORK_PROXY_MODES.includes(value)) return value;
    if (strict && value !== void 0) {
      throw new Error("network proxy mode must be system, manual, or direct");
    }
    return DEFAULT_NETWORK_PROXY_CONFIG.mode;
  }
  function normalizeProxyUrl(value, field, strict) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    let parsed;
    try {
      parsed = new URL(raw);
    } catch {
      if (strict) throw new Error(`${field} must be a valid proxy URL`);
      return "";
    }
    if (!ALLOWED_PROXY_PROTOCOLS.has(parsed.protocol)) {
      if (strict) throw new Error(`${field} must use http, https, socks, or socks5`);
      return "";
    }
    if (!parsed.hostname) {
      if (strict) throw new Error(`${field} must include a host`);
      return "";
    }
    if (parsed.pathname && parsed.pathname !== "/") {
      if (strict) throw new Error(`${field} must not include a path`);
      parsed.pathname = "/";
    }
    parsed.search = "";
    parsed.hash = "";
    return parsed.href.replace(/\/$/, "");
  }
  function normalizeNoProxy(value) {
    if (Array.isArray(value)) {
      return value.map((v) => String(v || "").trim()).filter(Boolean).join(", ");
    }
    return String(value ?? DEFAULT_NO_PROXY).split(/[\s,]+/).map((v) => v.trim()).filter(Boolean).join(", ");
  }
  function normalizeNetworkProxyConfig(value, options = {}) {
    const strict = options.strict === true;
    const input = value && typeof value === "object" ? value : {};
    const mode = normalizeMode(input.mode, strict);
    const noProxy = hasOwn(input, "noProxy") ? normalizeNoProxy(input.noProxy) : DEFAULT_NO_PROXY;
    if (mode !== "manual") {
      return {
        ...DEFAULT_NETWORK_PROXY_CONFIG,
        mode,
        noProxy
      };
    }
    const normalized = {
      ...DEFAULT_NETWORK_PROXY_CONFIG,
      mode,
      httpProxy: normalizeProxyUrl(input.httpProxy, "httpProxy", strict),
      httpsProxy: normalizeProxyUrl(input.httpsProxy, "httpsProxy", strict),
      wsProxy: normalizeProxyUrl(input.wsProxy, "wsProxy", strict),
      wssProxy: normalizeProxyUrl(input.wssProxy, "wssProxy", strict),
      noProxy
    };
    const hasAnyProxy = normalized.httpProxy || normalized.httpsProxy || normalized.wsProxy || normalized.wssProxy;
    if (!hasAnyProxy) {
      if (!strict) return { ...DEFAULT_NETWORK_PROXY_CONFIG };
      throw new Error("manual network proxy requires at least one proxy URL");
    }
    return normalized;
  }
  function noProxyEntries(noProxy) {
    return String(noProxy || "").split(/[\s,]+/).map((v) => v.trim()).filter(Boolean);
  }
  function withForcedLocalProxyBypass(noProxy, options = {}) {
    const entries = noProxyEntries(noProxy);
    const seen = new Set(entries.map((entry) => entry.toLowerCase()));
    for (const entry of FORCED_LOCAL_PROXY_BYPASS) {
      if (seen.has(entry.toLowerCase())) continue;
      entries.push(entry);
      seen.add(entry.toLowerCase());
    }
    if (options.electron === true && !seen.has("<local>")) {
      entries.push("<local>");
    }
    return entries.join(", ");
  }
  function stripHostBrackets(host) {
    return String(host || "").replace(/^\[/, "").replace(/\]$/, "").toLowerCase();
  }
  function isForcedLocalHost(host) {
    const normalized = stripHostBrackets(host);
    if (normalized === "localhost" || normalized === "::1") return true;
    return /^127(?:\.\d{1,3}){3}$/.test(normalized);
  }
  function splitNoProxyEntry(entry) {
    const raw = String(entry || "").trim();
    if (!raw) return null;
    if (raw === "*") return { host: "*", port: "" };
    if (raw.startsWith("[")) {
      const end = raw.indexOf("]");
      if (end >= 0) {
        const host = raw.slice(1, end).toLowerCase();
        const rest = raw.slice(end + 1);
        const port = rest.startsWith(":") ? rest.slice(1) : "";
        return { host, port };
      }
    }
    const colonCount = (raw.match(/:/g) || []).length;
    if (colonCount === 1) {
      const idx = raw.lastIndexOf(":");
      return {
        host: stripHostBrackets(raw.slice(0, idx)),
        port: raw.slice(idx + 1)
      };
    }
    return { host: stripHostBrackets(raw), port: "" };
  }
  function hostMatchesNoProxy(host, pattern) {
    if (pattern === "*") return true;
    if (!host || !pattern) return false;
    if (pattern.startsWith("*.")) {
      const suffix = pattern.slice(1);
      return host.endsWith(suffix);
    }
    if (pattern.startsWith(".")) {
      return host === pattern.slice(1) || host.endsWith(pattern);
    }
    return host === pattern;
  }
  function effectiveUrlPort(parsed) {
    if (parsed.port) return parsed.port;
    if (parsed.protocol === "http:" || parsed.protocol === "ws:") return "80";
    if (parsed.protocol === "https:" || parsed.protocol === "wss:") return "443";
    return "";
  }
  function isNoProxyMatch(targetUrl, noProxy) {
    let parsed;
    try {
      parsed = targetUrl instanceof URL ? targetUrl : new URL(String(targetUrl));
    } catch {
      return false;
    }
    const host = stripHostBrackets(parsed.hostname);
    const port = effectiveUrlPort(parsed);
    if (isForcedLocalHost(host)) return true;
    if (!noProxy) return false;
    for (const entry of noProxyEntries(noProxy)) {
      const rule = splitNoProxyEntry(entry);
      if (!rule) continue;
      if (rule.port && rule.port !== port) continue;
      if (hostMatchesNoProxy(host, rule.host)) return true;
    }
    return false;
  }
  function envValue(env, keys) {
    for (const key of keys) {
      if (env?.[key]) return String(env[key]).trim();
    }
    return "";
  }
  function proxyConfigFromEnvironment(env = process.env) {
    const httpProxy = envValue(env, ["HTTP_PROXY", "http_proxy", "ALL_PROXY", "all_proxy"]);
    const httpsProxy = envValue(env, [
      "HTTPS_PROXY",
      "https_proxy",
      "HTTP_PROXY",
      "http_proxy",
      "ALL_PROXY",
      "all_proxy"
    ]);
    const wsProxy = envValue(env, ["WS_PROXY", "ws_proxy", "HTTP_PROXY", "http_proxy", "ALL_PROXY", "all_proxy"]);
    const wssProxy = envValue(env, [
      "WSS_PROXY",
      "wss_proxy",
      "HTTPS_PROXY",
      "https_proxy",
      "HTTP_PROXY",
      "http_proxy",
      "ALL_PROXY",
      "all_proxy"
    ]);
    const noProxy = envValue(env, ["NO_PROXY", "no_proxy"]);
    return normalizeNetworkProxyConfig({
      mode: httpProxy || httpsProxy || wsProxy || wssProxy ? "manual" : "direct",
      httpProxy,
      httpsProxy,
      wsProxy,
      wssProxy,
      noProxy: noProxy || ""
    });
  }
  function resolveProxyForUrl(targetUrl, config, env = process.env) {
    const base = normalizeNetworkProxyConfig(config);
    if (base.mode === "direct") return "";
    const effective = base.mode === "system" ? proxyConfigFromEnvironment(env) : base;
    if (effective.mode === "direct") return "";
    let parsed;
    try {
      parsed = targetUrl instanceof URL ? targetUrl : new URL(String(targetUrl));
    } catch {
      return "";
    }
    if (isNoProxyMatch(parsed, effective.noProxy)) return "";
    switch (parsed.protocol) {
      case "http:":
        return effective.httpProxy || effective.httpsProxy || "";
      case "https:":
        return effective.httpsProxy || effective.httpProxy || "";
      case "ws:":
        return effective.wsProxy || effective.httpProxy || effective.httpsProxy || "";
      case "wss:":
        return effective.wssProxy || effective.httpsProxy || effective.httpProxy || effective.wsProxy || "";
      default:
        return "";
    }
  }
  function proxyConfigToEnvironment(config, baseEnv = process.env) {
    const normalized = normalizeNetworkProxyConfig(config);
    const env = { ...baseEnv || {} };
    for (const key of [
      "HTTP_PROXY",
      "http_proxy",
      "HTTPS_PROXY",
      "https_proxy",
      "WS_PROXY",
      "ws_proxy",
      "WSS_PROXY",
      "wss_proxy",
      "NO_PROXY",
      "no_proxy",
      "ALL_PROXY",
      "all_proxy"
    ]) {
      delete env[key];
    }
    if (normalized.mode === "system") return { ...baseEnv || {} };
    if (normalized.mode === "direct") return env;
    const httpProxy = normalized.httpProxy || normalized.httpsProxy || "";
    const httpsProxy = normalized.httpsProxy || normalized.httpProxy || "";
    const wsProxy = normalized.wsProxy || httpProxy || httpsProxy || "";
    const wssProxy = normalized.wssProxy || httpsProxy || httpProxy || wsProxy || "";
    if (httpProxy) env.HTTP_PROXY = env.http_proxy = httpProxy;
    if (httpsProxy) env.HTTPS_PROXY = env.https_proxy = httpsProxy;
    if (wsProxy) env.WS_PROXY = env.ws_proxy = wsProxy;
    if (wssProxy) env.WSS_PROXY = env.wss_proxy = wssProxy;
    const noProxy = withForcedLocalProxyBypass(normalized.noProxy);
    if (noProxy) env.NO_PROXY = env.no_proxy = noProxy;
    return env;
  }
  function formatElectronProxyServer(proxyUrl) {
    if (!proxyUrl) return "";
    const parsed = new URL(proxyUrl);
    const auth = parsed.username ? `${decodeURIComponent(parsed.username)}${parsed.password ? `:${decodeURIComponent(parsed.password)}` : ""}@` : "";
    return `${parsed.protocol}//${auth}${parsed.host}`;
  }
  function electronProxyRulesForConfig(config) {
    const normalized = normalizeNetworkProxyConfig(config);
    if (normalized.mode !== "manual") return "";
    const rules = [];
    const httpProxy = normalized.httpProxy || normalized.httpsProxy || "";
    const httpsProxy = normalized.httpsProxy || normalized.httpProxy || "";
    const wsProxy = normalized.wsProxy || httpProxy || httpsProxy || "";
    const wssProxy = normalized.wssProxy || httpsProxy || httpProxy || wsProxy || "";
    if (httpProxy) rules.push(`http=${formatElectronProxyServer(httpProxy)}`);
    if (httpsProxy) rules.push(`https=${formatElectronProxyServer(httpsProxy)}`);
    if (wsProxy) rules.push(`ws=${formatElectronProxyServer(wsProxy)}`);
    if (wssProxy) rules.push(`wss=${formatElectronProxyServer(wssProxy)}`);
    return rules.join(";");
  }
  function electronProxyBypassRulesForConfig(config) {
    const normalized = normalizeNetworkProxyConfig(config);
    return noProxyEntries(withForcedLocalProxyBypass(normalized.noProxy, { electron: true })).join(",");
  }
  networkProxy = {
    NETWORK_PROXY_MODES,
    DEFAULT_NO_PROXY,
    FORCED_LOCAL_PROXY_BYPASS,
    DEFAULT_NETWORK_PROXY_CONFIG,
    normalizeNetworkProxyConfig,
    noProxyEntries,
    withForcedLocalProxyBypass,
    isNoProxyMatch,
    proxyConfigFromEnvironment,
    resolveProxyForUrl,
    proxyConfigToEnvironment,
    formatElectronProxyServer,
    electronProxyRulesForConfig,
    electronProxyBypassRulesForConfig
  };
  return networkProxy;
}
var desktopAccessPolicy;
var hasRequiredDesktopAccessPolicy;
function requireDesktopAccessPolicy() {
  if (hasRequiredDesktopAccessPolicy) return desktopAccessPolicy;
  hasRequiredDesktopAccessPolicy = 1;
  const path = require$$1$2;
  const fs2 = require$$2;
  const CONFIG_PATH = process.env.OPENSHADOW_HOME ? path.join(process.env.OPENSHADOW_HOME, "config.json") : path.join(process.env.APPDATA || process.env.HOME || "", ".openshadow", "config.json");
  function resolveCanonicalPath(rawPath) {
    if (typeof rawPath !== "string" || !rawPath.trim()) return null;
    try {
      return path.resolve(rawPath.trim().replace(/^~(?=$|[\\/])/, require("os").homedir()));
    } catch {
      return null;
    }
  }
  function isPathInsideRoot(canonicalPath, root) {
    if (!canonicalPath || !root) return false;
    const normPath = canonicalPath.endsWith(path.sep) ? canonicalPath : canonicalPath + path.sep;
    const normRoot = root.endsWith(path.sep) ? root : root + path.sep;
    return normPath.startsWith(normRoot) || canonicalPath === root;
  }
  function readConfig() {
    try {
      if (fs2.existsSync(CONFIG_PATH)) {
        return JSON.parse(fs2.readFileSync(CONFIG_PATH, "utf-8"));
      }
    } catch {
    }
    return {};
  }
  function getWorkspaceRoots() {
    const cfg = readConfig();
    const roots = cfg.security && cfg.security.workspaceRoots || [];
    const normalized = [];
    const seen = /* @__PURE__ */ new Set();
    for (const r of roots) {
      const canon = resolveCanonicalPath(r);
      if (canon && !seen.has(canon)) {
        seen.add(canon);
        normalized.push(canon);
      }
    }
    return normalized;
  }
  const fileAccessGrants = /* @__PURE__ */ new Map();
  function grantWebContentsAccess(target, rawPath, level = "read") {
    const canonical = resolveCanonicalPath(rawPath);
    if (!canonical) return null;
    const webContents = target && target.send ? target.webContents || target : null;
    if (!webContents || !webContents.id) return null;
    let bucket = fileAccessGrants.get(webContents.id);
    if (!bucket) {
      bucket = { read: /* @__PURE__ */ new Set(), write: /* @__PURE__ */ new Set() };
      fileAccessGrants.set(webContents.id, bucket);
      webContents.once("destroyed", () => {
        fileAccessGrants.delete(webContents.id);
      });
    }
    bucket.read.add(canonical);
    if (level === "write" || level === "readwrite") bucket.write.add(canonical);
    return canonical;
  }
  function canAccessPath(target, rawPath, mode = "read") {
    const canonical = resolveCanonicalPath(rawPath);
    if (!canonical) return { allowed: false, canonical: null };
    const roots = getWorkspaceRoots();
    const hasTrusted = roots.some((root) => isPathInsideRoot(canonical, root));
    if (hasTrusted) return { allowed: true, canonical };
    const webContents = target && target.send ? target.webContents || target : null;
    if (webContents && webContents.id) {
      const bucket = fileAccessGrants.get(webContents.id);
      if (bucket) {
        const candidates = mode === "write" ? [...bucket.write] : [...bucket.read, ...bucket.write];
        const hasGrant = candidates.some((root) => isPathInsideRoot(canonical, root));
        if (hasGrant) return { allowed: true, canonical };
      }
    }
    return { allowed: false, canonical };
  }
  function canReadPath(target, rawPath) {
    return canAccessPath(target, rawPath, "read").allowed;
  }
  function canWritePath(target, rawPath) {
    return canAccessPath(target, rawPath, "write").allowed;
  }
  function isSetupComplete() {
    const cfg = readConfig();
    return !!(cfg.wizard && cfg.wizard.completed === true);
  }
  desktopAccessPolicy = {
    resolveCanonicalPath,
    isPathInsideRoot,
    readConfig,
    getWorkspaceRoots,
    grantWebContentsAccess,
    canReadPath,
    canWritePath,
    canAccessPath,
    isSetupComplete
  };
  return desktopAccessPolicy;
}
var editorWindowController;
var hasRequiredEditorWindowController;
function requireEditorWindowController() {
  if (hasRequiredEditorWindowController) return editorWindowController;
  hasRequiredEditorWindowController = 1;
  const path = require$$1$2;
  const { BrowserWindow } = require$$1;
  function createEditorWindowController({
    wrapIpcHandler,
    isDev,
    viteDevUrl,
    preloadPath,
    getMainWindow,
    canWritePath,
    grantWebContentsAccess
  }) {
    let editorWindow = null;
    let editorFileData = null;
    function getWindow() {
      return editorWindow;
    }
    function hide() {
      if (editorWindow && !editorWindow.isDestroyed()) editorWindow.hide();
    }
    function destroy() {
      if (editorWindow && !editorWindow.isDestroyed()) editorWindow.destroy();
      editorWindow = null;
      editorFileData = null;
    }
    function notifyDocked(data = editorFileData) {
      const mainWindow = getMainWindow();
      if (!mainWindow || mainWindow.isDestroyed()) return;
      mainWindow.webContents.send("editor-detached", false);
      if (data) mainWindow.webContents.send("editor-dock-file", data);
    }
    function register() {
      wrapIpcHandler("open-editor-window", (event, data) => {
        if (!data || !data.filePath) return { ok: false, error: "no file path" };
        if (!canWritePath || !canWritePath(event.sender, data.filePath)) {
          return { ok: false, error: "access denied: " + data.filePath };
        }
        editorFileData = data;
        if (editorWindow && !editorWindow.isDestroyed()) {
          if (grantWebContentsAccess) grantWebContentsAccess(editorWindow, data.filePath, "readwrite");
          editorWindow.show();
          editorWindow.focus();
          editorWindow.webContents.send("editor-load", data);
          return { ok: true, reused: true };
        }
        editorWindow = new BrowserWindow({
          width: 720,
          height: 800,
          minWidth: 400,
          minHeight: 300,
          title: data.title || "OpenShadow Editor",
          frame: false,
          backgroundColor: "#F8F5ED",
          hasShadow: true,
          show: true,
          acceptFirstMouse: true,
          webPreferences: {
            preload: preloadPath,
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false
          }
        });
        if (grantWebContentsAccess) grantWebContentsAccess(editorWindow, data.filePath, "readwrite");
        if (isDev) {
          editorWindow.loadURL(viteDevUrl + "/editor").catch((err) => {
            console.error("[editor] failed to load editor page:", err.message);
          });
        } else {
          const exePath = require$$1.app.getAppPath();
          const editorHtml = path.join(exePath, "desktop", "dist-renderer", "editor.html");
          editorWindow.loadFile(editorHtml).catch((err) => {
            const indexHtml = path.join(exePath, "desktop", "dist-renderer", "index.html");
            editorWindow.loadFile(indexHtml).catch((e) => {
              console.error("[editor] failed to load editor page:", e.message);
            });
          });
        }
        editorWindow.webContents.on("did-finish-load", () => {
          if (editorFileData && editorWindow && !editorWindow.isDestroyed()) {
            editorWindow.webContents.send("editor-load", editorFileData);
          }
        });
        editorWindow.on("close", (event2) => {
          if (editorWindow && !editorWindow.isDestroyed()) {
            event2.preventDefault();
            editorWindow.hide();
            notifyDocked(null);
          }
        });
        editorWindow.on("closed", () => {
          editorWindow = null;
          editorFileData = null;
        });
        return { ok: true, reused: false };
      });
      wrapIpcHandler("editor-dock", () => {
        notifyDocked();
        hide();
        return { ok: true };
      });
      wrapIpcHandler("editor-close", () => {
        notifyDocked(null);
        hide();
        return { ok: true };
      });
    }
    return { register, getWindow, hide, destroy };
  }
  editorWindowController = { createEditorWindowController };
  return editorWindowController;
}
var browserUrlGuard;
var hasRequiredBrowserUrlGuard;
function requireBrowserUrlGuard() {
  if (hasRequiredBrowserUrlGuard) return browserUrlGuard;
  hasRequiredBrowserUrlGuard = 1;
  function isBlockedBrowserHost(hostname) {
    const h = String(hostname || "").toLowerCase().replace(/^\[|\]$/g, "");
    if (!h || h === "localhost" || h.endsWith(".localhost") || h === "0.0.0.0" || h === "::1" || h === "::") return true;
    if (h === "169.254.169.254" || h === "metadata.google.internal") return true;
    const v4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (v4) {
      const a = Number(v4[1]);
      const b = Number(v4[2]);
      if (a === 127 || a === 10 || a === 0) return true;
      if (a === 169 && b === 254) return true;
      if (a === 192 && b === 168) return true;
      if (a === 172 && b >= 16 && b <= 31) return true;
    }
    if (h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe80") || h.startsWith("::ffff:127") || h.startsWith("::ffff:10")) return true;
    return false;
  }
  function isAllowedBrowserUrl(url, env) {
    const e = env || process.env;
    try {
      const p = new URL(url);
      if (p.protocol !== "http:" && p.protocol !== "https:") return false;
      if (e.OPENSHADOW_BROWSER_ALLOW_PRIVATE !== "1" && isBlockedBrowserHost(p.hostname)) return false;
      return true;
    } catch {
      return false;
    }
  }
  browserUrlGuard = { isBlockedBrowserHost, isAllowedBrowserUrl };
  return browserUrlGuard;
}
var browserAgent;
var hasRequiredBrowserAgent;
function requireBrowserAgent() {
  if (hasRequiredBrowserAgent) return browserAgent;
  hasRequiredBrowserAgent = 1;
  const path = require$$1$2;
  const { BrowserWindow, WebContentsView, session: electronSession } = require$$1;
  const { isAllowedBrowserUrl } = requireBrowserUrlGuard();
  function createBrowserAgentController({
    isDev,
    viteDevUrl,
    preloadPath,
    getMainWindow
  }) {
    let browserViewerWindow = null;
    let browserWebView = null;
    const browserViews = /* @__PURE__ */ new Map();
    let currentBrowserSession = null;
    let commandSocket = null;
    const delay = (ms2) => new Promise((resolve) => setTimeout(resolve, ms2));
    function getWindow() {
      return browserViewerWindow;
    }
    function getWebView() {
      return browserWebView;
    }
    function notifyViewerUrl(url) {
      if (browserViewerWindow && !browserViewerWindow.isDestroyed() && browserWebView) {
        browserViewerWindow.webContents.send("browser-update", {
          url,
          title: browserWebView.webContents.getTitle(),
          canGoBack: browserWebView.webContents.canGoBack(),
          canGoForward: browserWebView.webContents.canGoForward()
        });
      }
    }
    function updateBrowserViewBounds() {
      if (!browserWebView || !browserViewerWindow || browserViewerWindow.isDestroyed()) return;
      const [width, height] = browserViewerWindow.getContentSize();
      const titlebarHeight = 44;
      const mx = 8;
      const mt = 4;
      const mb = 8;
      const bounds = {
        x: mx,
        y: titlebarHeight + mt,
        width: Math.max(0, width - mx * 2),
        height: Math.max(0, height - titlebarHeight - mt - mb)
      };
      browserWebView.setBounds(bounds);
    }
    function createWindow(opts = {}) {
      const shouldShow = opts.show !== false;
      if (browserViewerWindow && !browserViewerWindow.isDestroyed()) {
        if (shouldShow) {
          browserViewerWindow.show();
          browserViewerWindow.focus();
          updateBrowserViewBounds();
          if (browserWebView) {
            delay(50).then(() => {
              if (browserWebView) browserWebView.webContents.focus();
            });
          }
        }
        return;
      }
      browserViewerWindow = new BrowserWindow({
        width: 1200,
        height: 1080,
        minWidth: 480,
        minHeight: 360,
        title: "OpenShadow Browser",
        frame: false,
        backgroundColor: "#F8F5ED",
        hasShadow: true,
        show: shouldShow,
        acceptFirstMouse: true,
        webPreferences: {
          preload: preloadPath,
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: false
        }
      });
      if (isDev) {
        browserViewerWindow.loadURL(viteDevUrl + "/browser-viewer").catch((err) => {
          console.error("[browser] failed to load browser-viewer:", err.message);
        });
      } else {
        const exePath = require$$1.app.getAppPath();
        const viewerHtml = path.join(exePath, "desktop", "dist-renderer", "browser-viewer.html");
        browserViewerWindow.loadFile(viewerHtml).catch((err) => {
          console.error("[browser] failed to load browser-viewer.html:", err.message);
        });
      }
      browserViewerWindow.webContents.on("did-finish-load", () => {
        if (browserWebView && browserViewerWindow && !browserViewerWindow.isDestroyed()) {
          try {
            browserViewerWindow.contentView.removeChildView(browserWebView);
          } catch {
          }
          browserViewerWindow.contentView.addChildView(browserWebView);
          updateBrowserViewBounds();
          const url = browserWebView.webContents.getURL();
          if (url) notifyViewerUrl(url);
        }
      });
      browserViewerWindow.on("resize", () => updateBrowserViewBounds());
      browserViewerWindow.on("show", () => updateBrowserViewBounds());
      browserViewerWindow.on("close", (event) => {
        if (browserViewerWindow && !browserViewerWindow.isDestroyed()) {
          event.preventDefault();
          browserViewerWindow.hide();
        }
      });
      browserViewerWindow.on("closed", () => {
        browserViewerWindow = null;
      });
    }
    function show() {
      createWindow();
    }
    function hideWindow() {
      if (browserViewerWindow && !browserViewerWindow.isDestroyed()) browserViewerWindow.hide();
    }
    function closeViewer() {
      if (browserViewerWindow && !browserViewerWindow.isDestroyed()) browserViewerWindow.close();
    }
    function goBack() {
      if (browserWebView) browserWebView.webContents.goBack();
    }
    function goForward() {
      if (browserWebView) browserWebView.webContents.goForward();
    }
    function reload() {
      if (browserWebView) browserWebView.webContents.reload();
    }
    function emergencyStop() {
      if (browserWebView) {
        if (browserViewerWindow && !browserViewerWindow.isDestroyed()) {
          try {
            browserViewerWindow.contentView.removeChildView(browserWebView);
          } catch {
          }
        }
        browserWebView.webContents.close();
        if (currentBrowserSession) browserViews.delete(currentBrowserSession);
        browserWebView = null;
        currentBrowserSession = null;
      }
      if (browserViewerWindow && !browserViewerWindow.isDestroyed()) {
        browserViewerWindow.webContents.send("browser-update", { running: false });
      }
    }
    async function handleCommand(cmd, params = {}) {
      switch (cmd) {
        case "launch": {
          if (browserWebView) return { ok: true, reused: true };
          const ses = electronSession.fromPartition("persist:openshadow-browser");
          const view = new WebContentsView({
            webPreferences: {
              session: ses,
              contextIsolation: true,
              nodeIntegration: false,
              sandbox: true
            }
          });
          view.webContents.on("did-navigate", (_event, url) => {
            if (isAllowedBrowserUrl(url)) {
              notifyViewerUrl(url);
            } else {
              console.warn("[browser] blocked navigation to:", url);
              view.webContents.loadURL("about:blank");
            }
          });
          view.webContents.on("did-navigate-in-page", (_event, url) => notifyViewerUrl(url));
          view.webContents.setWindowOpenHandler(({ url }) => {
            if (isAllowedBrowserUrl(url)) view.webContents.loadURL(url);
            return { action: "deny" };
          });
          view.setBorderRadius(10);
          browserWebView = view;
          currentBrowserSession = params.sessionPath || null;
          if (currentBrowserSession) browserViews.set(currentBrowserSession, view);
          createWindow({ show: false });
          if (browserViewerWindow && !browserViewerWindow.isDestroyed()) {
            try {
              browserViewerWindow.contentView.removeChildView(browserWebView);
            } catch {
            }
            browserViewerWindow.contentView.addChildView(browserWebView);
            updateBrowserViewBounds();
            delay(300).then(() => {
              if (browserWebView) browserWebView.webContents.focus();
            });
          }
          if (params.url && isAllowedBrowserUrl(params.url)) {
            view.webContents.loadURL(params.url);
          }
          return { ok: true };
        }
        case "close": {
          emergencyStop();
          return { ok: true };
        }
        case "navigate": {
          if (!browserWebView) return { ok: false, error: "no browser running" };
          if (params.url && isAllowedBrowserUrl(params.url)) {
            browserWebView.webContents.loadURL(params.url);
            return { ok: true };
          }
          return { ok: false, error: "invalid or blocked URL" };
        }
        case "back": {
          if (browserWebView) browserWebView.webContents.goBack();
          return { ok: true };
        }
        case "forward": {
          if (browserWebView) browserWebView.webContents.goForward();
          return { ok: true };
        }
        case "reload": {
          if (browserWebView) browserWebView.webContents.reload();
          return { ok: true };
        }
        case "screenshot": {
          if (!browserWebView) return { ok: false, error: "no browser running" };
          try {
            const image = browserWebView.webContents.capturePage();
            const size = image.getSize();
            const base64 = image.toPNG().toString("base64");
            return { ok: true, base64, width: size.width, height: size.height };
          } catch (err) {
            return { ok: false, error: err.message };
          }
        }
        case "get-html": {
          if (!browserWebView) return { ok: false, error: "no browser running" };
          return new Promise((resolve) => {
            browserWebView.webContents.executeJavaScript("document.documentElement.outerHTML").then((html) => {
              resolve({ ok: true, html });
            }).catch((err) => resolve({ ok: false, error: err.message }));
          });
        }
        case "click": {
          if (!browserWebView || !params.selector) return { ok: false, error: "no browser or no selector" };
          const script = `
          (function() {
            const el = document.querySelector(${JSON.stringify(params.selector)});
            if (el) { el.click(); return true; }
            return false;
          })()
        `;
          return browserWebView.webContents.executeJavaScript(script).then((result) => ({
            ok: true,
            clicked: result
          })).catch((err) => ({ ok: false, error: err.message }));
        }
        case "type": {
          if (!browserWebView || !params.selector || !params.text) return { ok: false, error: "missing params" };
          const script = `
          (function() {
            const el = document.querySelector(${JSON.stringify(params.selector)});
            if (el) { el.value = ${JSON.stringify(params.text)}; return true; }
            return false;
          })()
        `;
          return browserWebView.webContents.executeJavaScript(script).then((result) => ({
            ok: true,
            typed: result
          })).catch((err) => ({ ok: false, error: err.message }));
        }
        default:
          return { ok: false, error: "unknown command: " + cmd };
      }
    }
    function setupCommands(serverPort, serverToken) {
      if (!serverPort || !serverToken) {
        console.log("[browser] no server port/token, skipping WebSocket setup");
        return;
      }
      try {
        let connect = function() {
          commandSocket = new WebSocket(url, protocols);
          commandSocket.on("open", () => {
            console.log("[browser] WebSocket connected to server");
          });
          commandSocket.on("message", async (data) => {
            let msg;
            try {
              msg = JSON.parse(data);
            } catch {
              return;
            }
            if (msg?.type !== "browser-cmd") return;
            const { id, cmd, params } = msg;
            try {
              const result = await handleCommand(cmd, params || {});
              if (commandSocket && commandSocket.readyState === 1) {
                commandSocket.send(JSON.stringify({ type: "browser-result", id, result }));
              }
            } catch (err) {
              if (commandSocket && commandSocket.readyState === 1) {
                commandSocket.send(JSON.stringify({ type: "browser-result", id, error: err.message }));
              }
            }
          });
          commandSocket.on("close", () => {
            setTimeout(connect, 2e3);
          });
          commandSocket.on("error", () => {
          });
        };
        const WebSocket = require("ws");
        const url = `ws://127.0.0.1:${serverPort}/internal/browser`;
        const protocols = serverToken ? ["openshadow-browser", `token.${serverToken}`] : ["openshadow-browser"];
        connect();
      } catch (err) {
        console.warn("[browser] failed to setup WebSocket:", err.message);
      }
    }
    function shutdown() {
      for (const [, view] of browserViews) {
        try {
          view.webContents.close();
        } catch {
        }
      }
      browserViews.clear();
      browserWebView = null;
      currentBrowserSession = null;
      try {
        commandSocket?.close?.();
      } catch {
      }
      commandSocket = null;
    }
    function registerIpc(wrapIpcHandler) {
      wrapIpcHandler("browser:launch", async (_event, params) => {
        return await handleCommand("launch", params || {});
      });
      wrapIpcHandler("browser:navigate", async (_event, url) => {
        return await handleCommand("navigate", { url });
      });
      wrapIpcHandler("browser:close", async () => {
        return await handleCommand("close");
      });
      wrapIpcHandler("browser:back", async () => {
        return await handleCommand("back");
      });
      wrapIpcHandler("browser:forward", async () => {
        return await handleCommand("forward");
      });
      wrapIpcHandler("browser:reload", async () => {
        return await handleCommand("reload");
      });
      wrapIpcHandler("browser:screenshot", async () => {
        return await handleCommand("screenshot");
      });
      wrapIpcHandler("browser:show", () => {
        show();
        return { ok: true };
      });
      wrapIpcHandler("browser:hide", () => {
        hideWindow();
        return { ok: true };
      });
    }
    return {
      getWindow,
      getWebView,
      show,
      hideWindow,
      closeViewer,
      goBack,
      goForward,
      reload,
      emergencyStop,
      handleCommand,
      setupCommands,
      shutdown,
      registerIpc
    };
  }
  browserAgent = { createBrowserAgentController };
  return browserAgent;
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
const require$$15 = /* @__PURE__ */ getAugmentedNamespace(providerPresets);
const EntryTypes = {
  FILE_TYPE: "files",
  DIR_TYPE: "directories",
  FILE_DIR_TYPE: "files_directories",
  EVERYTHING_TYPE: "all"
};
const defaultOptions = {
  root: ".",
  fileFilter: (_entryInfo) => true,
  directoryFilter: (_entryInfo) => true,
  type: EntryTypes.FILE_TYPE,
  lstat: false,
  depth: 2147483648,
  alwaysStat: false,
  highWaterMark: 4096
};
Object.freeze(defaultOptions);
const RECURSIVE_ERROR_CODE = "READDIRP_RECURSIVE_ERROR";
const NORMAL_FLOW_ERRORS = /* @__PURE__ */ new Set(["ENOENT", "EPERM", "EACCES", "ELOOP", RECURSIVE_ERROR_CODE]);
const ALL_TYPES = [
  EntryTypes.DIR_TYPE,
  EntryTypes.EVERYTHING_TYPE,
  EntryTypes.FILE_DIR_TYPE,
  EntryTypes.FILE_TYPE
];
const DIR_TYPES = /* @__PURE__ */ new Set([
  EntryTypes.DIR_TYPE,
  EntryTypes.EVERYTHING_TYPE,
  EntryTypes.FILE_DIR_TYPE
]);
const FILE_TYPES = /* @__PURE__ */ new Set([
  EntryTypes.EVERYTHING_TYPE,
  EntryTypes.FILE_DIR_TYPE,
  EntryTypes.FILE_TYPE
]);
const isNormalFlowError = (error2) => NORMAL_FLOW_ERRORS.has(error2.code);
const wantBigintFsStats = process.platform === "win32";
const emptyFn = (_entryInfo) => true;
const normalizeFilter = (filter) => {
  if (filter === void 0)
    return emptyFn;
  if (typeof filter === "function")
    return filter;
  if (typeof filter === "string") {
    const fl = filter.trim();
    return (entry) => entry.basename === fl;
  }
  if (Array.isArray(filter)) {
    const trItems = filter.map((item) => item.trim());
    return (entry) => trItems.some((f) => entry.basename === f);
  }
  return emptyFn;
};
class ReaddirpStream extends node_stream.Readable {
  parents;
  reading;
  parent;
  _stat;
  _maxDepth;
  _wantsDir;
  _wantsFile;
  _wantsEverything;
  _root;
  _isDirent;
  _statsProp;
  _rdOptions;
  _fileFilter;
  _directoryFilter;
  constructor(options = {}) {
    super({
      objectMode: true,
      autoDestroy: true,
      highWaterMark: options.highWaterMark
    });
    const opts = { ...defaultOptions, ...options };
    const { root, type } = opts;
    this._fileFilter = normalizeFilter(opts.fileFilter);
    this._directoryFilter = normalizeFilter(opts.directoryFilter);
    const statMethod = opts.lstat ? promises.lstat : promises.stat;
    if (wantBigintFsStats) {
      this._stat = (path) => statMethod(path, { bigint: true });
    } else {
      this._stat = statMethod;
    }
    this._maxDepth = opts.depth != null && Number.isSafeInteger(opts.depth) ? opts.depth : defaultOptions.depth;
    this._wantsDir = type ? DIR_TYPES.has(type) : false;
    this._wantsFile = type ? FILE_TYPES.has(type) : false;
    this._wantsEverything = type === EntryTypes.EVERYTHING_TYPE;
    this._root = sp.resolve(root);
    this._isDirent = !opts.alwaysStat;
    this._statsProp = this._isDirent ? "dirent" : "stats";
    this._rdOptions = { encoding: "utf8", withFileTypes: this._isDirent };
    this.parents = [this._exploreDir(root, 1)];
    this.reading = false;
    this.parent = void 0;
  }
  async _read(batch) {
    if (this.reading)
      return;
    this.reading = true;
    try {
      while (!this.destroyed && batch > 0) {
        const par = this.parent;
        const fil = par && par.files;
        if (fil && fil.length > 0) {
          const { path, depth } = par;
          const slice = fil.splice(0, batch).map((dirent) => this._formatEntry(dirent, path));
          const awaited = await Promise.all(slice);
          for (const entry of awaited) {
            if (!entry)
              continue;
            if (this.destroyed)
              return;
            const entryType = await this._getEntryType(entry);
            if (entryType === "directory" && this._directoryFilter(entry)) {
              if (depth <= this._maxDepth) {
                this.parents.push(this._exploreDir(entry.fullPath, depth + 1));
              }
              if (this._wantsDir) {
                this.push(entry);
                batch--;
              }
            } else if ((entryType === "file" || this._includeAsFile(entry)) && this._fileFilter(entry)) {
              if (this._wantsFile) {
                this.push(entry);
                batch--;
              }
            }
          }
        } else {
          const parent = this.parents.pop();
          if (!parent) {
            this.push(null);
            break;
          }
          this.parent = await parent;
          if (this.destroyed)
            return;
        }
      }
    } catch (error2) {
      this.destroy(error2);
    } finally {
      this.reading = false;
    }
  }
  async _exploreDir(path, depth) {
    let files;
    try {
      files = await promises.readdir(path, this._rdOptions);
    } catch (error2) {
      this._onError(error2);
    }
    return { files, depth, path };
  }
  async _formatEntry(dirent, path) {
    let entry;
    const basename = this._isDirent ? dirent.name : dirent;
    try {
      const fullPath = sp.resolve(sp.join(path, basename));
      entry = { path: sp.relative(this._root, fullPath), fullPath, basename };
      entry[this._statsProp] = this._isDirent ? dirent : await this._stat(fullPath);
    } catch (err) {
      this._onError(err);
      return;
    }
    return entry;
  }
  _onError(err) {
    if (isNormalFlowError(err) && !this.destroyed) {
      this.emit("warn", err);
    } else {
      this.destroy(err);
    }
  }
  async _getEntryType(entry) {
    if (!entry && this._statsProp in entry) {
      return "";
    }
    const stats = entry[this._statsProp];
    if (stats.isFile())
      return "file";
    if (stats.isDirectory())
      return "directory";
    if (stats && stats.isSymbolicLink()) {
      const full = entry.fullPath;
      try {
        const entryRealPath = await promises.realpath(full);
        const entryRealPathStats = await promises.lstat(entryRealPath);
        if (entryRealPathStats.isFile()) {
          return "file";
        }
        if (entryRealPathStats.isDirectory()) {
          const len = entryRealPath.length;
          if (full.startsWith(entryRealPath) && full.substr(len, 1) === sp.sep) {
            const recursiveError = new Error(`Circular symlink detected: "${full}" points to "${entryRealPath}"`);
            recursiveError.code = RECURSIVE_ERROR_CODE;
            return this._onError(recursiveError);
          }
          return "directory";
        }
      } catch (error2) {
        this._onError(error2);
        return "";
      }
    }
  }
  _includeAsFile(entry) {
    const stats = entry && entry[this._statsProp];
    return stats && this._wantsEverything && !stats.isDirectory();
  }
}
function readdirp(root, options = {}) {
  let type = options.entryType || options.type;
  if (type === "both")
    type = EntryTypes.FILE_DIR_TYPE;
  if (type)
    options.type = type;
  if (!root) {
    throw new Error("readdirp: root argument is required. Usage: readdirp(root, options)");
  } else if (typeof root !== "string") {
    throw new TypeError("readdirp: root argument must be a string. Usage: readdirp(root, options)");
  } else if (type && !ALL_TYPES.includes(type)) {
    throw new Error(`readdirp: Invalid type passed. Use one of ${ALL_TYPES.join(", ")}`);
  }
  options.root = root;
  return new ReaddirpStream(options);
}
const STR_DATA = "data";
const STR_END = "end";
const STR_CLOSE = "close";
const EMPTY_FN = () => {
};
const pl = process.platform;
const isWindows = pl === "win32";
const isMacos = pl === "darwin";
const isLinux = pl === "linux";
const isFreeBSD = pl === "freebsd";
const isIBMi = node_os.type() === "OS400";
const EVENTS = {
  ALL: "all",
  READY: "ready",
  ADD: "add",
  CHANGE: "change",
  ADD_DIR: "addDir",
  UNLINK: "unlink",
  UNLINK_DIR: "unlinkDir",
  RAW: "raw",
  ERROR: "error"
};
const EV = EVENTS;
const THROTTLE_MODE_WATCH = "watch";
const statMethods = { lstat: promises.lstat, stat: promises.stat };
const KEY_LISTENERS = "listeners";
const KEY_ERR = "errHandlers";
const KEY_RAW = "rawEmitters";
const HANDLER_KEYS = [KEY_LISTENERS, KEY_ERR, KEY_RAW];
const binaryExtensions = /* @__PURE__ */ new Set([
  "3dm",
  "3ds",
  "3g2",
  "3gp",
  "7z",
  "a",
  "aac",
  "adp",
  "afdesign",
  "afphoto",
  "afpub",
  "ai",
  "aif",
  "aiff",
  "alz",
  "ape",
  "apk",
  "appimage",
  "ar",
  "arj",
  "asf",
  "au",
  "avi",
  "bak",
  "baml",
  "bh",
  "bin",
  "bk",
  "bmp",
  "btif",
  "bz2",
  "bzip2",
  "cab",
  "caf",
  "cgm",
  "class",
  "cmx",
  "cpio",
  "cr2",
  "cur",
  "dat",
  "dcm",
  "deb",
  "dex",
  "djvu",
  "dll",
  "dmg",
  "dng",
  "doc",
  "docm",
  "docx",
  "dot",
  "dotm",
  "dra",
  "DS_Store",
  "dsk",
  "dts",
  "dtshd",
  "dvb",
  "dwg",
  "dxf",
  "ecelp4800",
  "ecelp7470",
  "ecelp9600",
  "egg",
  "eol",
  "eot",
  "epub",
  "exe",
  "f4v",
  "fbs",
  "fh",
  "fla",
  "flac",
  "flatpak",
  "fli",
  "flv",
  "fpx",
  "fst",
  "fvt",
  "g3",
  "gh",
  "gif",
  "graffle",
  "gz",
  "gzip",
  "h261",
  "h263",
  "h264",
  "icns",
  "ico",
  "ief",
  "img",
  "ipa",
  "iso",
  "jar",
  "jpeg",
  "jpg",
  "jpgv",
  "jpm",
  "jxr",
  "key",
  "ktx",
  "lha",
  "lib",
  "lvp",
  "lz",
  "lzh",
  "lzma",
  "lzo",
  "m3u",
  "m4a",
  "m4v",
  "mar",
  "mdi",
  "mht",
  "mid",
  "midi",
  "mj2",
  "mka",
  "mkv",
  "mmr",
  "mng",
  "mobi",
  "mov",
  "movie",
  "mp3",
  "mp4",
  "mp4a",
  "mpeg",
  "mpg",
  "mpga",
  "mxu",
  "nef",
  "npx",
  "numbers",
  "nupkg",
  "o",
  "odp",
  "ods",
  "odt",
  "oga",
  "ogg",
  "ogv",
  "otf",
  "ott",
  "pages",
  "pbm",
  "pcx",
  "pdb",
  "pdf",
  "pea",
  "pgm",
  "pic",
  "png",
  "pnm",
  "pot",
  "potm",
  "potx",
  "ppa",
  "ppam",
  "ppm",
  "pps",
  "ppsm",
  "ppsx",
  "ppt",
  "pptm",
  "pptx",
  "psd",
  "pya",
  "pyc",
  "pyo",
  "pyv",
  "qt",
  "rar",
  "ras",
  "raw",
  "resources",
  "rgb",
  "rip",
  "rlc",
  "rmf",
  "rmvb",
  "rpm",
  "rtf",
  "rz",
  "s3m",
  "s7z",
  "scpt",
  "sgi",
  "shar",
  "snap",
  "sil",
  "sketch",
  "slk",
  "smv",
  "snk",
  "so",
  "stl",
  "suo",
  "sub",
  "swf",
  "tar",
  "tbz",
  "tbz2",
  "tga",
  "tgz",
  "thmx",
  "tif",
  "tiff",
  "tlz",
  "ttc",
  "ttf",
  "txz",
  "udf",
  "uvh",
  "uvi",
  "uvm",
  "uvp",
  "uvs",
  "uvu",
  "viv",
  "vob",
  "war",
  "wav",
  "wax",
  "wbmp",
  "wdp",
  "weba",
  "webm",
  "webp",
  "whl",
  "wim",
  "wm",
  "wma",
  "wmv",
  "wmx",
  "woff",
  "woff2",
  "wrm",
  "wvx",
  "xbm",
  "xif",
  "xla",
  "xlam",
  "xls",
  "xlsb",
  "xlsm",
  "xlsx",
  "xlt",
  "xltm",
  "xltx",
  "xm",
  "xmind",
  "xpi",
  "xpm",
  "xwd",
  "xz",
  "z",
  "zip",
  "zipx"
]);
const isBinaryPath = (filePath) => binaryExtensions.has(sp__namespace.extname(filePath).slice(1).toLowerCase());
const foreach = (val, fn) => {
  if (val instanceof Set) {
    val.forEach(fn);
  } else {
    fn(val);
  }
};
const addAndConvert = (main2, prop, item) => {
  let container = main2[prop];
  if (!(container instanceof Set)) {
    main2[prop] = container = /* @__PURE__ */ new Set([container]);
  }
  container.add(item);
};
const clearItem = (cont) => (key) => {
  const set = cont[key];
  if (set instanceof Set) {
    set.clear();
  } else {
    delete cont[key];
  }
};
const delFromSet = (main2, prop, item) => {
  const container = main2[prop];
  if (container instanceof Set) {
    container.delete(item);
  } else if (container === item) {
    delete main2[prop];
  }
};
const isEmptySet = (val) => val instanceof Set ? val.size === 0 : !val;
const FsWatchInstances = /* @__PURE__ */ new Map();
function createFsWatchInstance(path, options, listener, errHandler, emitRaw) {
  const handleEvent = (rawEvent, evPath) => {
    listener(path);
    emitRaw(rawEvent, evPath, { watchedPath: path });
    if (evPath && path !== evPath) {
      fsWatchBroadcast(sp__namespace.resolve(path, evPath), KEY_LISTENERS, sp__namespace.join(path, evPath));
    }
  };
  try {
    return node_fs.watch(path, {
      persistent: options.persistent
    }, handleEvent);
  } catch (error2) {
    errHandler(error2);
    return void 0;
  }
}
const fsWatchBroadcast = (fullPath, listenerType, val1, val2, val3) => {
  const cont = FsWatchInstances.get(fullPath);
  if (!cont)
    return;
  foreach(cont[listenerType], (listener) => {
    listener(val1, val2, val3);
  });
};
const setFsWatchListener = (path, fullPath, options, handlers) => {
  const { listener, errHandler, rawEmitter } = handlers;
  let cont = FsWatchInstances.get(fullPath);
  let watcher;
  if (!options.persistent) {
    watcher = createFsWatchInstance(path, options, listener, errHandler, rawEmitter);
    if (!watcher)
      return;
    return watcher.close.bind(watcher);
  }
  if (cont) {
    addAndConvert(cont, KEY_LISTENERS, listener);
    addAndConvert(cont, KEY_ERR, errHandler);
    addAndConvert(cont, KEY_RAW, rawEmitter);
  } else {
    watcher = createFsWatchInstance(
      path,
      options,
      fsWatchBroadcast.bind(null, fullPath, KEY_LISTENERS),
      errHandler,
      // no need to use broadcast here
      fsWatchBroadcast.bind(null, fullPath, KEY_RAW)
    );
    if (!watcher)
      return;
    watcher.on(EV.ERROR, async (error2) => {
      const broadcastErr = fsWatchBroadcast.bind(null, fullPath, KEY_ERR);
      if (cont)
        cont.watcherUnusable = true;
      if (isWindows && error2.code === "EPERM") {
        try {
          const fd = await promises.open(path, "r");
          await fd.close();
          broadcastErr(error2);
        } catch (err) {
        }
      } else {
        broadcastErr(error2);
      }
    });
    cont = {
      listeners: listener,
      errHandlers: errHandler,
      rawEmitters: rawEmitter,
      watcher
    };
    FsWatchInstances.set(fullPath, cont);
  }
  return () => {
    delFromSet(cont, KEY_LISTENERS, listener);
    delFromSet(cont, KEY_ERR, errHandler);
    delFromSet(cont, KEY_RAW, rawEmitter);
    if (isEmptySet(cont.listeners)) {
      cont.watcher.close();
      FsWatchInstances.delete(fullPath);
      HANDLER_KEYS.forEach(clearItem(cont));
      cont.watcher = void 0;
      Object.freeze(cont);
    }
  };
};
const FsWatchFileInstances = /* @__PURE__ */ new Map();
const setFsWatchFileListener = (path, fullPath, options, handlers) => {
  const { listener, rawEmitter } = handlers;
  let cont = FsWatchFileInstances.get(fullPath);
  const copts = cont && cont.options;
  if (copts && (copts.persistent < options.persistent || copts.interval > options.interval)) {
    node_fs.unwatchFile(fullPath);
    cont = void 0;
  }
  if (cont) {
    addAndConvert(cont, KEY_LISTENERS, listener);
    addAndConvert(cont, KEY_RAW, rawEmitter);
  } else {
    cont = {
      listeners: listener,
      rawEmitters: rawEmitter,
      options,
      watcher: node_fs.watchFile(fullPath, options, (curr, prev) => {
        foreach(cont.rawEmitters, (rawEmitter2) => {
          rawEmitter2(EV.CHANGE, fullPath, { curr, prev });
        });
        const currmtime = curr.mtimeMs;
        if (curr.size !== prev.size || currmtime > prev.mtimeMs || currmtime === 0) {
          foreach(cont.listeners, (listener2) => listener2(path, curr));
        }
      })
    };
    FsWatchFileInstances.set(fullPath, cont);
  }
  return () => {
    delFromSet(cont, KEY_LISTENERS, listener);
    delFromSet(cont, KEY_RAW, rawEmitter);
    if (isEmptySet(cont.listeners)) {
      FsWatchFileInstances.delete(fullPath);
      node_fs.unwatchFile(fullPath);
      cont.options = cont.watcher = void 0;
      Object.freeze(cont);
    }
  };
};
class NodeFsHandler {
  fsw;
  _boundHandleError;
  constructor(fsW) {
    this.fsw = fsW;
    this._boundHandleError = (error2) => fsW._handleError(error2);
  }
  /**
   * Watch file for changes with fs_watchFile or fs_watch.
   * @param path to file or dir
   * @param listener on fs change
   * @returns closer for the watcher instance
   */
  _watchWithNodeFs(path, listener) {
    const opts = this.fsw.options;
    const directory = sp__namespace.dirname(path);
    const basename = sp__namespace.basename(path);
    const parent = this.fsw._getWatchedDir(directory);
    parent.add(basename);
    const absolutePath = sp__namespace.resolve(path);
    const options = {
      persistent: opts.persistent
    };
    if (!listener)
      listener = EMPTY_FN;
    let closer;
    if (opts.usePolling) {
      const enableBin = opts.interval !== opts.binaryInterval;
      options.interval = enableBin && isBinaryPath(basename) ? opts.binaryInterval : opts.interval;
      closer = setFsWatchFileListener(path, absolutePath, options, {
        listener,
        rawEmitter: this.fsw._emitRaw
      });
    } else {
      closer = setFsWatchListener(path, absolutePath, options, {
        listener,
        errHandler: this._boundHandleError,
        rawEmitter: this.fsw._emitRaw
      });
    }
    return closer;
  }
  /**
   * Watch a file and emit add event if warranted.
   * @returns closer for the watcher instance
   */
  _handleFile(file2, stats, initialAdd) {
    if (this.fsw.closed) {
      return;
    }
    const dirname = sp__namespace.dirname(file2);
    const basename = sp__namespace.basename(file2);
    const parent = this.fsw._getWatchedDir(dirname);
    let prevStats = stats;
    if (parent.has(basename))
      return;
    const listener = async (path, newStats) => {
      if (!this.fsw._throttle(THROTTLE_MODE_WATCH, file2, 5))
        return;
      if (!newStats || newStats.mtimeMs === 0) {
        try {
          const newStats2 = await promises.stat(file2);
          if (this.fsw.closed)
            return;
          const at = newStats2.atimeMs;
          const mt = newStats2.mtimeMs;
          if (!at || at <= mt || mt !== prevStats.mtimeMs) {
            this.fsw._emit(EV.CHANGE, file2, newStats2);
          }
          if ((isMacos || isLinux || isFreeBSD) && prevStats.ino !== newStats2.ino) {
            this.fsw._closeFile(path);
            prevStats = newStats2;
            const closer2 = this._watchWithNodeFs(file2, listener);
            if (closer2)
              this.fsw._addPathCloser(path, closer2);
          } else {
            prevStats = newStats2;
          }
        } catch (error2) {
          this.fsw._remove(dirname, basename);
        }
      } else if (parent.has(basename)) {
        const at = newStats.atimeMs;
        const mt = newStats.mtimeMs;
        if (!at || at <= mt || mt !== prevStats.mtimeMs) {
          this.fsw._emit(EV.CHANGE, file2, newStats);
        }
        prevStats = newStats;
      }
    };
    const closer = this._watchWithNodeFs(file2, listener);
    if (!(initialAdd && this.fsw.options.ignoreInitial) && this.fsw._isntIgnored(file2)) {
      if (!this.fsw._throttle(EV.ADD, file2, 0))
        return;
      this.fsw._emit(EV.ADD, file2, stats);
    }
    return closer;
  }
  /**
   * Handle symlinks encountered while reading a dir.
   * @param entry returned by readdirp
   * @param directory path of dir being read
   * @param path of this item
   * @param item basename of this item
   * @returns true if no more processing is needed for this entry.
   */
  async _handleSymlink(entry, directory, path, item) {
    if (this.fsw.closed) {
      return;
    }
    const full = entry.fullPath;
    const dir = this.fsw._getWatchedDir(directory);
    if (!this.fsw.options.followSymlinks) {
      this.fsw._incrReadyCount();
      let linkPath;
      try {
        linkPath = await promises.realpath(path);
      } catch (e) {
        this.fsw._emitReady();
        return true;
      }
      if (this.fsw.closed)
        return;
      if (dir.has(item)) {
        if (this.fsw._symlinkPaths.get(full) !== linkPath) {
          this.fsw._symlinkPaths.set(full, linkPath);
          this.fsw._emit(EV.CHANGE, path, entry.stats);
        }
      } else {
        dir.add(item);
        this.fsw._symlinkPaths.set(full, linkPath);
        this.fsw._emit(EV.ADD, path, entry.stats);
      }
      this.fsw._emitReady();
      return true;
    }
    if (this.fsw._symlinkPaths.has(full)) {
      return true;
    }
    this.fsw._symlinkPaths.set(full, true);
  }
  _handleRead(directory, initialAdd, wh, target, dir, depth, throttler) {
    directory = sp__namespace.join(directory, "");
    const throttleKey = target ? `${directory}:${target}` : directory;
    throttler = this.fsw._throttle("readdir", throttleKey, 1e3);
    if (!throttler)
      return;
    const previous = this.fsw._getWatchedDir(wh.path);
    const current = /* @__PURE__ */ new Set();
    let stream = this.fsw._readdirp(directory, {
      fileFilter: (entry) => wh.filterPath(entry),
      directoryFilter: (entry) => wh.filterDir(entry)
    });
    if (!stream)
      return;
    stream.on(STR_DATA, async (entry) => {
      if (this.fsw.closed) {
        stream = void 0;
        return;
      }
      const item = entry.path;
      let path = sp__namespace.join(directory, item);
      current.add(item);
      if (entry.stats.isSymbolicLink() && await this._handleSymlink(entry, directory, path, item)) {
        return;
      }
      if (this.fsw.closed) {
        stream = void 0;
        return;
      }
      if (item === target || !target && !previous.has(item)) {
        this.fsw._incrReadyCount();
        path = sp__namespace.join(dir, sp__namespace.relative(dir, path));
        this._addToNodeFs(path, initialAdd, wh, depth + 1);
      }
    }).on(EV.ERROR, this._boundHandleError);
    return new Promise((resolve, reject) => {
      if (!stream)
        return reject();
      stream.once(STR_END, () => {
        if (this.fsw.closed) {
          stream = void 0;
          return;
        }
        const wasThrottled = throttler ? throttler.clear() : false;
        resolve(void 0);
        previous.getChildren().filter((item) => {
          return item !== directory && !current.has(item);
        }).forEach((item) => {
          this.fsw._remove(directory, item);
        });
        stream = void 0;
        if (wasThrottled)
          this._handleRead(directory, false, wh, target, dir, depth, throttler);
      });
    });
  }
  /**
   * Read directory to add / remove files from `@watched` list and re-read it on change.
   * @param dir fs path
   * @param stats
   * @param initialAdd
   * @param depth relative to user-supplied path
   * @param target child path targeted for watch
   * @param wh Common watch helpers for this path
   * @param realpath
   * @returns closer for the watcher instance.
   */
  async _handleDir(dir, stats, initialAdd, depth, target, wh, realpath) {
    const parentDir = this.fsw._getWatchedDir(sp__namespace.dirname(dir));
    const tracked = parentDir.has(sp__namespace.basename(dir));
    if (!(initialAdd && this.fsw.options.ignoreInitial) && !target && !tracked) {
      this.fsw._emit(EV.ADD_DIR, dir, stats);
    }
    parentDir.add(sp__namespace.basename(dir));
    this.fsw._getWatchedDir(dir);
    let throttler;
    let closer;
    const oDepth = this.fsw.options.depth;
    if ((oDepth == null || depth <= oDepth) && !this.fsw._symlinkPaths.has(realpath)) {
      if (!target) {
        await this._handleRead(dir, initialAdd, wh, target, dir, depth, throttler);
        if (this.fsw.closed)
          return;
      }
      closer = this._watchWithNodeFs(dir, (dirPath, stats2) => {
        if (stats2 && stats2.mtimeMs === 0)
          return;
        this._handleRead(dirPath, false, wh, target, dir, depth, throttler);
      });
    }
    return closer;
  }
  /**
   * Handle added file, directory, or glob pattern.
   * Delegates call to _handleFile / _handleDir after checks.
   * @param path to file or ir
   * @param initialAdd was the file added at watch instantiation?
   * @param priorWh depth relative to user-supplied path
   * @param depth Child path actually targeted for watch
   * @param target Child path actually targeted for watch
   */
  async _addToNodeFs(path, initialAdd, priorWh, depth, target) {
    const ready = this.fsw._emitReady;
    if (this.fsw._isIgnored(path) || this.fsw.closed) {
      ready();
      return false;
    }
    const wh = this.fsw._getWatchHelpers(path);
    if (priorWh) {
      wh.filterPath = (entry) => priorWh.filterPath(entry);
      wh.filterDir = (entry) => priorWh.filterDir(entry);
    }
    try {
      const stats = await statMethods[wh.statMethod](wh.watchPath);
      if (this.fsw.closed)
        return;
      if (this.fsw._isIgnored(wh.watchPath, stats)) {
        ready();
        return false;
      }
      const follow = this.fsw.options.followSymlinks;
      let closer;
      if (stats.isDirectory()) {
        const absPath = sp__namespace.resolve(path);
        const targetPath = follow ? await promises.realpath(path) : path;
        if (this.fsw.closed)
          return;
        closer = await this._handleDir(wh.watchPath, stats, initialAdd, depth, target, wh, targetPath);
        if (this.fsw.closed)
          return;
        if (absPath !== targetPath && targetPath !== void 0) {
          this.fsw._symlinkPaths.set(absPath, targetPath);
        }
      } else if (stats.isSymbolicLink()) {
        const targetPath = follow ? await promises.realpath(path) : path;
        if (this.fsw.closed)
          return;
        const parent = sp__namespace.dirname(wh.watchPath);
        this.fsw._getWatchedDir(parent).add(wh.watchPath);
        this.fsw._emit(EV.ADD, wh.watchPath, stats);
        closer = await this._handleDir(parent, stats, initialAdd, depth, path, wh, targetPath);
        if (this.fsw.closed)
          return;
        if (targetPath !== void 0) {
          this.fsw._symlinkPaths.set(sp__namespace.resolve(path), targetPath);
        }
      } else {
        closer = this._handleFile(wh.watchPath, stats, initialAdd);
      }
      ready();
      if (closer)
        this.fsw._addPathCloser(path, closer);
      return false;
    } catch (error2) {
      if (this.fsw._handleError(error2)) {
        ready();
        return path;
      }
    }
  }
}
const SLASH = "/";
const SLASH_SLASH = "//";
const ONE_DOT = ".";
const TWO_DOTS = "..";
const STRING_TYPE = "string";
const BACK_SLASH_RE = /\\/g;
const DOUBLE_SLASH_RE = /\/\//g;
const DOT_RE = /\..*\.(sw[px])$|~$|\.subl.*\.tmp/;
const REPLACER_RE = /^\.[/\\]/;
function arrify(item) {
  return Array.isArray(item) ? item : [item];
}
const isMatcherObject = (matcher) => typeof matcher === "object" && matcher !== null && !(matcher instanceof RegExp);
function createPattern(matcher) {
  if (typeof matcher === "function")
    return matcher;
  if (typeof matcher === "string")
    return (string) => matcher === string;
  if (matcher instanceof RegExp)
    return (string) => matcher.test(string);
  if (typeof matcher === "object" && matcher !== null) {
    return (string) => {
      if (matcher.path === string)
        return true;
      if (matcher.recursive) {
        const relative = sp__namespace.relative(matcher.path, string);
        if (!relative) {
          return false;
        }
        return !relative.startsWith("..") && !sp__namespace.isAbsolute(relative);
      }
      return false;
    };
  }
  return () => false;
}
function normalizePath(path) {
  if (typeof path !== "string")
    throw new Error("string expected");
  path = sp__namespace.normalize(path);
  path = path.replace(/\\/g, "/");
  let prepend = false;
  if (path.startsWith("//"))
    prepend = true;
  path = path.replace(DOUBLE_SLASH_RE, "/");
  if (prepend)
    path = "/" + path;
  return path;
}
function matchPatterns(patterns, testString, stats) {
  const path = normalizePath(testString);
  for (let index2 = 0; index2 < patterns.length; index2++) {
    const pattern = patterns[index2];
    if (pattern(path, stats)) {
      return true;
    }
  }
  return false;
}
function anymatch(matchers, testString) {
  if (matchers == null) {
    throw new TypeError("anymatch: specify first argument");
  }
  const matchersArray = arrify(matchers);
  const patterns = matchersArray.map((matcher) => createPattern(matcher));
  {
    return (testString2, stats) => {
      return matchPatterns(patterns, testString2, stats);
    };
  }
}
const unifyPaths = (paths_) => {
  const paths = arrify(paths_).flat();
  if (!paths.every((p) => typeof p === STRING_TYPE)) {
    throw new TypeError(`Non-string provided as watch path: ${paths}`);
  }
  return paths.map(normalizePathToUnix);
};
const toUnix = (string) => {
  let str = string.replace(BACK_SLASH_RE, SLASH);
  let prepend = false;
  if (str.startsWith(SLASH_SLASH)) {
    prepend = true;
  }
  str = str.replace(DOUBLE_SLASH_RE, SLASH);
  if (prepend) {
    str = SLASH + str;
  }
  return str;
};
const normalizePathToUnix = (path) => toUnix(sp__namespace.normalize(toUnix(path)));
const normalizeIgnored = (cwd = "") => (path) => {
  if (typeof path === "string") {
    return normalizePathToUnix(sp__namespace.isAbsolute(path) ? path : sp__namespace.join(cwd, path));
  } else {
    return path;
  }
};
const getAbsolutePath = (path, cwd) => {
  if (sp__namespace.isAbsolute(path)) {
    return path;
  }
  return sp__namespace.join(cwd, path);
};
const EMPTY_SET = Object.freeze(/* @__PURE__ */ new Set());
class DirEntry {
  path;
  _removeWatcher;
  items;
  constructor(dir, removeWatcher) {
    this.path = dir;
    this._removeWatcher = removeWatcher;
    this.items = /* @__PURE__ */ new Set();
  }
  add(item) {
    const { items } = this;
    if (!items)
      return;
    if (item !== ONE_DOT && item !== TWO_DOTS)
      items.add(item);
  }
  async remove(item) {
    const { items } = this;
    if (!items)
      return;
    items.delete(item);
    if (items.size > 0)
      return;
    const dir = this.path;
    try {
      await promises.readdir(dir);
    } catch (err) {
      if (this._removeWatcher) {
        this._removeWatcher(sp__namespace.dirname(dir), sp__namespace.basename(dir));
      }
    }
  }
  has(item) {
    const { items } = this;
    if (!items)
      return;
    return items.has(item);
  }
  getChildren() {
    const { items } = this;
    if (!items)
      return [];
    return [...items.values()];
  }
  dispose() {
    this.items.clear();
    this.path = "";
    this._removeWatcher = EMPTY_FN;
    this.items = EMPTY_SET;
    Object.freeze(this);
  }
}
const STAT_METHOD_F = "stat";
const STAT_METHOD_L = "lstat";
class WatchHelper {
  fsw;
  path;
  watchPath;
  fullWatchPath;
  dirParts;
  followSymlinks;
  statMethod;
  constructor(path, follow, fsw) {
    this.fsw = fsw;
    const watchPath = path;
    this.path = path = path.replace(REPLACER_RE, "");
    this.watchPath = watchPath;
    this.fullWatchPath = sp__namespace.resolve(watchPath);
    this.dirParts = [];
    this.dirParts.forEach((parts) => {
      if (parts.length > 1)
        parts.pop();
    });
    this.followSymlinks = follow;
    this.statMethod = follow ? STAT_METHOD_F : STAT_METHOD_L;
  }
  entryPath(entry) {
    return sp__namespace.join(this.watchPath, sp__namespace.relative(this.watchPath, entry.fullPath));
  }
  filterPath(entry) {
    const { stats } = entry;
    if (stats && stats.isSymbolicLink())
      return this.filterDir(entry);
    const resolvedPath = this.entryPath(entry);
    return this.fsw._isntIgnored(resolvedPath, stats) && this.fsw._hasReadPermissions(stats);
  }
  filterDir(entry) {
    return this.fsw._isntIgnored(this.entryPath(entry), entry.stats);
  }
}
class FSWatcher extends node_events.EventEmitter {
  closed;
  options;
  _closers;
  _ignoredPaths;
  _throttled;
  _streams;
  _symlinkPaths;
  _watched;
  _pendingWrites;
  _pendingUnlinks;
  _readyCount;
  _emitReady;
  _closePromise;
  _userIgnored;
  _readyEmitted;
  _emitRaw;
  _boundRemove;
  _nodeFsHandler;
  // Not indenting methods for history sake; for now.
  constructor(_opts = {}) {
    super();
    this.closed = false;
    this._closers = /* @__PURE__ */ new Map();
    this._ignoredPaths = /* @__PURE__ */ new Set();
    this._throttled = /* @__PURE__ */ new Map();
    this._streams = /* @__PURE__ */ new Set();
    this._symlinkPaths = /* @__PURE__ */ new Map();
    this._watched = /* @__PURE__ */ new Map();
    this._pendingWrites = /* @__PURE__ */ new Map();
    this._pendingUnlinks = /* @__PURE__ */ new Map();
    this._readyCount = 0;
    this._readyEmitted = false;
    const awf = _opts.awaitWriteFinish;
    const DEF_AWF = { stabilityThreshold: 2e3, pollInterval: 100 };
    const opts = {
      // Defaults
      persistent: true,
      ignoreInitial: false,
      ignorePermissionErrors: false,
      interval: 100,
      binaryInterval: 300,
      followSymlinks: true,
      usePolling: false,
      // useAsync: false,
      atomic: true,
      // NOTE: overwritten later (depends on usePolling)
      ..._opts,
      // Change format
      ignored: _opts.ignored ? arrify(_opts.ignored) : arrify([]),
      awaitWriteFinish: awf === true ? DEF_AWF : typeof awf === "object" ? { ...DEF_AWF, ...awf } : false
    };
    if (isIBMi)
      opts.usePolling = true;
    if (opts.atomic === void 0)
      opts.atomic = !opts.usePolling;
    const envPoll = process.env.CHOKIDAR_USEPOLLING;
    if (envPoll !== void 0) {
      const envLower = envPoll.toLowerCase();
      if (envLower === "false" || envLower === "0")
        opts.usePolling = false;
      else if (envLower === "true" || envLower === "1")
        opts.usePolling = true;
      else
        opts.usePolling = !!envLower;
    }
    const envInterval = process.env.CHOKIDAR_INTERVAL;
    if (envInterval)
      opts.interval = Number.parseInt(envInterval, 10);
    let readyCalls = 0;
    this._emitReady = () => {
      readyCalls++;
      if (readyCalls >= this._readyCount) {
        this._emitReady = EMPTY_FN;
        this._readyEmitted = true;
        process.nextTick(() => this.emit(EVENTS.READY));
      }
    };
    this._emitRaw = (...args) => this.emit(EVENTS.RAW, ...args);
    this._boundRemove = this._remove.bind(this);
    this.options = opts;
    this._nodeFsHandler = new NodeFsHandler(this);
    Object.freeze(opts);
  }
  _addIgnoredPath(matcher) {
    if (isMatcherObject(matcher)) {
      for (const ignored of this._ignoredPaths) {
        if (isMatcherObject(ignored) && ignored.path === matcher.path && ignored.recursive === matcher.recursive) {
          return;
        }
      }
    }
    this._ignoredPaths.add(matcher);
  }
  _removeIgnoredPath(matcher) {
    this._ignoredPaths.delete(matcher);
    if (typeof matcher === "string") {
      for (const ignored of this._ignoredPaths) {
        if (isMatcherObject(ignored) && ignored.path === matcher) {
          this._ignoredPaths.delete(ignored);
        }
      }
    }
  }
  // Public methods
  /**
   * Adds paths to be watched on an existing FSWatcher instance.
   * @param paths_ file or file list. Other arguments are unused
   */
  add(paths_, _origAdd, _internal) {
    const { cwd } = this.options;
    this.closed = false;
    this._closePromise = void 0;
    let paths = unifyPaths(paths_);
    if (cwd) {
      paths = paths.map((path) => {
        const absPath = getAbsolutePath(path, cwd);
        return absPath;
      });
    }
    paths.forEach((path) => {
      this._removeIgnoredPath(path);
    });
    this._userIgnored = void 0;
    if (!this._readyCount)
      this._readyCount = 0;
    this._readyCount += paths.length;
    Promise.all(paths.map(async (path) => {
      const res = await this._nodeFsHandler._addToNodeFs(path, !_internal, void 0, 0, _origAdd);
      if (res)
        this._emitReady();
      return res;
    })).then((results) => {
      if (this.closed)
        return;
      results.forEach((item) => {
        if (item)
          this.add(sp__namespace.dirname(item), sp__namespace.basename(_origAdd || item));
      });
    });
    return this;
  }
  /**
   * Close watchers or start ignoring events from specified paths.
   */
  unwatch(paths_) {
    if (this.closed)
      return this;
    const paths = unifyPaths(paths_);
    const { cwd } = this.options;
    paths.forEach((path) => {
      if (!sp__namespace.isAbsolute(path) && !this._closers.has(path)) {
        if (cwd)
          path = sp__namespace.join(cwd, path);
        path = sp__namespace.resolve(path);
      }
      this._closePath(path);
      this._addIgnoredPath(path);
      if (this._watched.has(path)) {
        this._addIgnoredPath({
          path,
          recursive: true
        });
      }
      this._userIgnored = void 0;
    });
    return this;
  }
  /**
   * Close watchers and remove all listeners from watched paths.
   */
  close() {
    if (this._closePromise) {
      return this._closePromise;
    }
    this.closed = true;
    this.removeAllListeners();
    const closers = [];
    this._closers.forEach((closerList) => closerList.forEach((closer) => {
      const promise = closer();
      if (promise instanceof Promise)
        closers.push(promise);
    }));
    this._streams.forEach((stream) => stream.destroy());
    this._userIgnored = void 0;
    this._readyCount = 0;
    this._readyEmitted = false;
    this._watched.forEach((dirent) => dirent.dispose());
    this._closers.clear();
    this._watched.clear();
    this._streams.clear();
    this._symlinkPaths.clear();
    this._throttled.clear();
    this._closePromise = closers.length ? Promise.all(closers).then(() => void 0) : Promise.resolve();
    return this._closePromise;
  }
  /**
   * Expose list of watched paths
   * @returns for chaining
   */
  getWatched() {
    const watchList = {};
    this._watched.forEach((entry, dir) => {
      const key = this.options.cwd ? sp__namespace.relative(this.options.cwd, dir) : dir;
      const index2 = key || ONE_DOT;
      watchList[index2] = entry.getChildren().sort();
    });
    return watchList;
  }
  emitWithAll(event, args) {
    this.emit(event, ...args);
    if (event !== EVENTS.ERROR)
      this.emit(EVENTS.ALL, event, ...args);
  }
  // Common helpers
  // --------------
  /**
   * Normalize and emit events.
   * Calling _emit DOES NOT MEAN emit() would be called!
   * @param event Type of event
   * @param path File or directory path
   * @param stats arguments to be passed with event
   * @returns the error if defined, otherwise the value of the FSWatcher instance's `closed` flag
   */
  async _emit(event, path, stats) {
    if (this.closed)
      return;
    const opts = this.options;
    if (isWindows)
      path = sp__namespace.normalize(path);
    if (opts.cwd)
      path = sp__namespace.relative(opts.cwd, path);
    const args = [path];
    if (stats != null)
      args.push(stats);
    const awf = opts.awaitWriteFinish;
    let pw;
    if (awf && (pw = this._pendingWrites.get(path))) {
      pw.lastChange = /* @__PURE__ */ new Date();
      return this;
    }
    if (opts.atomic) {
      if (event === EVENTS.UNLINK) {
        this._pendingUnlinks.set(path, [event, ...args]);
        setTimeout(() => {
          this._pendingUnlinks.forEach((entry, path2) => {
            this.emit(...entry);
            this.emit(EVENTS.ALL, ...entry);
            this._pendingUnlinks.delete(path2);
          });
        }, typeof opts.atomic === "number" ? opts.atomic : 100);
        return this;
      }
      if (event === EVENTS.ADD && this._pendingUnlinks.has(path)) {
        event = EVENTS.CHANGE;
        this._pendingUnlinks.delete(path);
      }
    }
    if (awf && (event === EVENTS.ADD || event === EVENTS.CHANGE) && this._readyEmitted) {
      const awfEmit = (err, stats2) => {
        if (err) {
          event = EVENTS.ERROR;
          args[0] = err;
          this.emitWithAll(event, args);
        } else if (stats2) {
          if (args.length > 1) {
            args[1] = stats2;
          } else {
            args.push(stats2);
          }
          this.emitWithAll(event, args);
        }
      };
      this._awaitWriteFinish(path, awf.stabilityThreshold, event, awfEmit);
      return this;
    }
    if (event === EVENTS.CHANGE) {
      const isThrottled = !this._throttle(EVENTS.CHANGE, path, 50);
      if (isThrottled)
        return this;
    }
    if (opts.alwaysStat && stats === void 0 && (event === EVENTS.ADD || event === EVENTS.ADD_DIR || event === EVENTS.CHANGE)) {
      const fullPath = opts.cwd ? sp__namespace.join(opts.cwd, path) : path;
      let stats2;
      try {
        stats2 = await promises.stat(fullPath);
      } catch (err) {
      }
      if (!stats2 || this.closed)
        return;
      args.push(stats2);
    }
    this.emitWithAll(event, args);
    return this;
  }
  /**
   * Common handler for errors
   * @returns The error if defined, otherwise the value of the FSWatcher instance's `closed` flag
   */
  _handleError(error2) {
    const code = error2 && error2.code;
    if (error2 && code !== "ENOENT" && code !== "ENOTDIR" && (!this.options.ignorePermissionErrors || code !== "EPERM" && code !== "EACCES")) {
      this.emit(EVENTS.ERROR, error2);
    }
    return error2 || this.closed;
  }
  /**
   * Helper utility for throttling
   * @param actionType type being throttled
   * @param path being acted upon
   * @param timeout duration of time to suppress duplicate actions
   * @returns tracking object or false if action should be suppressed
   */
  _throttle(actionType, path, timeout) {
    if (!this._throttled.has(actionType)) {
      this._throttled.set(actionType, /* @__PURE__ */ new Map());
    }
    const action = this._throttled.get(actionType);
    if (!action)
      throw new Error("invalid throttle");
    const actionPath = action.get(path);
    if (actionPath) {
      actionPath.count++;
      return false;
    }
    let timeoutObject;
    const clear = () => {
      const item = action.get(path);
      const count = item ? item.count : 0;
      action.delete(path);
      clearTimeout(timeoutObject);
      if (item)
        clearTimeout(item.timeoutObject);
      return count;
    };
    timeoutObject = setTimeout(clear, timeout);
    const thr = { timeoutObject, clear, count: 0 };
    action.set(path, thr);
    return thr;
  }
  _incrReadyCount() {
    return this._readyCount++;
  }
  /**
   * Awaits write operation to finish.
   * Polls a newly created file for size variations. When files size does not change for 'threshold' milliseconds calls callback.
   * @param path being acted upon
   * @param threshold Time in milliseconds a file size must be fixed before acknowledging write OP is finished
   * @param event
   * @param awfEmit Callback to be called when ready for event to be emitted.
   */
  _awaitWriteFinish(path, threshold, event, awfEmit) {
    const awf = this.options.awaitWriteFinish;
    if (typeof awf !== "object")
      return;
    const pollInterval = awf.pollInterval;
    let timeoutHandler;
    let fullPath = path;
    if (this.options.cwd && !sp__namespace.isAbsolute(path)) {
      fullPath = sp__namespace.join(this.options.cwd, path);
    }
    const now = /* @__PURE__ */ new Date();
    const writes = this._pendingWrites;
    function awaitWriteFinishFn(prevStat) {
      node_fs.stat(fullPath, (err, curStat) => {
        if (err || !writes.has(path)) {
          if (err && err.code !== "ENOENT")
            awfEmit(err);
          return;
        }
        const now2 = Number(/* @__PURE__ */ new Date());
        if (prevStat && curStat.size !== prevStat.size) {
          writes.get(path).lastChange = now2;
        }
        const pw = writes.get(path);
        const df = now2 - pw.lastChange;
        if (df >= threshold) {
          writes.delete(path);
          awfEmit(void 0, curStat);
        } else {
          timeoutHandler = setTimeout(awaitWriteFinishFn, pollInterval, curStat);
        }
      });
    }
    if (!writes.has(path)) {
      writes.set(path, {
        lastChange: now,
        cancelWait: () => {
          writes.delete(path);
          clearTimeout(timeoutHandler);
          return event;
        }
      });
      timeoutHandler = setTimeout(awaitWriteFinishFn, pollInterval);
    }
  }
  /**
   * Determines whether user has asked to ignore this path.
   */
  _isIgnored(path, stats) {
    if (this.options.atomic && DOT_RE.test(path))
      return true;
    if (!this._userIgnored) {
      const { cwd } = this.options;
      const ign = this.options.ignored;
      const ignored = (ign || []).map(normalizeIgnored(cwd));
      const ignoredPaths = [...this._ignoredPaths];
      const list = [...ignoredPaths.map(normalizeIgnored(cwd)), ...ignored];
      this._userIgnored = anymatch(list);
    }
    return this._userIgnored(path, stats);
  }
  _isntIgnored(path, stat2) {
    return !this._isIgnored(path, stat2);
  }
  /**
   * Provides a set of common helpers and properties relating to symlink handling.
   * @param path file or directory pattern being watched
   */
  _getWatchHelpers(path) {
    return new WatchHelper(path, this.options.followSymlinks, this);
  }
  // Directory helpers
  // -----------------
  /**
   * Provides directory tracking objects
   * @param directory path of the directory
   */
  _getWatchedDir(directory) {
    const dir = sp__namespace.resolve(directory);
    if (!this._watched.has(dir))
      this._watched.set(dir, new DirEntry(dir, this._boundRemove));
    return this._watched.get(dir);
  }
  // File helpers
  // ------------
  /**
   * Check for read permissions: https://stackoverflow.com/a/11781404/1358405
   */
  _hasReadPermissions(stats) {
    if (this.options.ignorePermissionErrors)
      return true;
    return Boolean(Number(stats.mode) & 256);
  }
  /**
   * Handles emitting unlink events for
   * files and directories, and via recursion, for
   * files and directories within directories that are unlinked
   * @param directory within which the following item is located
   * @param item      base path of item/directory
   */
  _remove(directory, item, isDirectory) {
    const path = sp__namespace.join(directory, item);
    const fullPath = sp__namespace.resolve(path);
    isDirectory = isDirectory != null ? isDirectory : this._watched.has(path) || this._watched.has(fullPath);
    if (!this._throttle("remove", path, 100))
      return;
    if (!isDirectory && this._watched.size === 1) {
      this.add(directory, item, true);
    }
    const wp = this._getWatchedDir(path);
    const nestedDirectoryChildren = wp.getChildren();
    nestedDirectoryChildren.forEach((nested) => this._remove(path, nested));
    const parent = this._getWatchedDir(directory);
    const wasTracked = parent.has(item);
    parent.remove(item);
    if (this._symlinkPaths.has(fullPath)) {
      this._symlinkPaths.delete(fullPath);
    }
    let relPath = path;
    if (this.options.cwd)
      relPath = sp__namespace.relative(this.options.cwd, path);
    if (this.options.awaitWriteFinish && this._pendingWrites.has(relPath)) {
      const event = this._pendingWrites.get(relPath).cancelWait();
      if (event === EVENTS.ADD)
        return;
    }
    this._watched.delete(path);
    this._watched.delete(fullPath);
    const eventName = isDirectory ? EVENTS.UNLINK_DIR : EVENTS.UNLINK;
    if (wasTracked && !this._isIgnored(path))
      this._emit(eventName, path);
    this._closePath(path);
  }
  /**
   * Closes all watchers for a path
   */
  _closePath(path) {
    this._closeFile(path);
    const dir = sp__namespace.dirname(path);
    this._getWatchedDir(dir).remove(sp__namespace.basename(path));
  }
  /**
   * Closes only file-specific watchers
   */
  _closeFile(path) {
    const closers = this._closers.get(path);
    if (!closers)
      return;
    closers.forEach((closer) => closer());
    this._closers.delete(path);
  }
  _addPathCloser(path, closer) {
    if (!closer)
      return;
    let list = this._closers.get(path);
    if (!list) {
      list = [];
      this._closers.set(path, list);
    }
    list.push(closer);
  }
  _readdirp(root, opts) {
    if (this.closed)
      return;
    const options = { type: EVENTS.ALL, alwaysStat: true, lstat: true, ...opts, depth: 0 };
    let stream = readdirp(root, options);
    this._streams.add(stream);
    stream.once(STR_CLOSE, () => {
      stream = void 0;
    });
    stream.once(STR_END, () => {
      if (stream) {
        this._streams.delete(stream);
        stream = void 0;
      }
    });
    return stream;
  }
}
function watch(paths, options = {}) {
  const watcher = new FSWatcher(options);
  watcher.add(paths);
  return watcher;
}
const index = { watch, FSWatcher };
const chokidar = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  FSWatcher,
  WatchHelper,
  default: index,
  watch
}, Symbol.toStringTag, { value: "Module" }));
const require$$17 = /* @__PURE__ */ getAugmentedNamespace(chokidar);
var mainI18n;
var hasRequiredMainI18n;
function requireMainI18n() {
  if (hasRequiredMainI18n) return mainI18n;
  hasRequiredMainI18n = 1;
  const fs2 = require$$2;
  const path = require$$1$2;
  function createMainI18n({ hanakoHome, localesDir }) {
    let locale = "zh-CN";
    let dict = {};
    function load2() {
      try {
        const configPath = path.join(hanakoHome, "config.json");
        if (fs2.existsSync(configPath)) {
          const cfg = JSON.parse(fs2.readFileSync(configPath, "utf-8"));
          locale = cfg.ui && cfg.ui.language || process.env.LC_MESSAGES || "zh-CN";
        }
      } catch {
      }
      const filePath = path.join(localesDir, locale + ".json");
      try {
        if (fs2.existsSync(filePath)) {
          const raw = JSON.parse(fs2.readFileSync(filePath, "utf-8"));
          dict = raw.main || raw || {};
        }
      } catch {
      }
      console.log(`[main-i18n] locale=${locale}, keys=${Object.keys(dict).length}`);
    }
    load2();
    function mt(key, defaultValue) {
      const val = dict[key];
      if (val !== void 0) return val;
      return defaultValue !== void 0 ? defaultValue : key;
    }
    function reset() {
      dict = {};
      load2();
    }
    return { mt, reset };
  }
  mainI18n = { createMainI18n };
  return mainI18n;
}
var appMenu;
var hasRequiredAppMenu;
function requireAppMenu() {
  if (hasRequiredAppMenu) return appMenu;
  hasRequiredAppMenu = 1;
  function installAppMenu({ Menu, app, platform = process.platform, mt }) {
    const _ = mt || ((key, d) => d || key);
    const appName = app.name || "OpenShadow";
    const template = [
      ...platform === "darwin" ? [
        {
          label: appName,
          submenu: [
            { role: "about", label: _("appmenu.about", `关于 ${appName}`) },
            { type: "separator" },
            { role: "hide", label: _("appmenu.hide", `隐藏 ${appName}`) },
            { role: "hideOthers", label: _("appmenu.hideOthers", "隐藏其他") },
            { role: "unhide", label: _("appmenu.unhide", "显示全部") },
            { type: "separator" },
            { role: "quit", label: _("appmenu.quit", `退出 ${appName}`) }
          ]
        }
      ] : [],
      {
        label: _("appmenu.edit", "Edit"),
        submenu: [
          { role: "undo", label: _("appmenu.undo", "撤销") },
          { role: "redo", label: _("appmenu.redo", "重做") },
          { type: "separator" },
          { role: "cut", label: _("appmenu.cut", "剪切") },
          { role: "copy", label: _("appmenu.copy", "复制") },
          { role: "paste", label: _("appmenu.paste", "粘贴") },
          { role: "delete", label: _("appmenu.delete", "删除") },
          { type: "separator" },
          { role: "selectAll", label: _("appmenu.selectAll", "全选") }
        ]
      },
      {
        label: _("appmenu.window", "Window"),
        submenu: [
          { role: "minimize", label: _("appmenu.minimize", "最小化") },
          ...platform === "darwin" ? [{ role: "zoom", label: _("appmenu.zoom", "缩放") }, { type: "separator" }, { role: "front", label: _("appmenu.front", "前置全部窗口") }] : [{ role: "close", label: _("appmenu.close", "关闭") }]
        ]
      }
    ];
    const appMenu2 = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(appMenu2);
  }
  appMenu = { installAppMenu };
  return appMenu;
}
var notificationController;
var hasRequiredNotificationController;
function requireNotificationController() {
  if (hasRequiredNotificationController) return notificationController;
  hasRequiredNotificationController = 1;
  function createNotificationController({
    app,
    Notification: Notification2,
    systemPreferences: systemPreferences2,
    wrapIpcHandler,
    getMainWindow
  }) {
    let pendingNotificationCount = 0;
    function getPermissionStatus() {
      if (!Notification2.isSupported()) return "unsupported";
      if (process.platform !== "darwin") return "granted";
      try {
        const settings = systemPreferences2.getNotificationSettings?.();
        const status = settings?.authorizationStatus;
        if (status === "authorized" || status === "provisional") return "granted";
        if (status === "denied") return "denied";
        return "not-determined";
      } catch {
        return "granted";
      }
    }
    function show(title, body) {
      if (!Notification2.isSupported()) return;
      const notif = new Notification2({
        title: title || "OpenShadow",
        body: body || "",
        silent: false
      });
      notif.on("click", () => {
        const mainWindow2 = getMainWindow();
        if (mainWindow2 && !mainWindow2.isDestroyed()) {
          if (mainWindow2.isMinimized()) mainWindow2.restore();
          mainWindow2.show();
          mainWindow2.focus();
        }
      });
      notif.show();
      const mainWindow = getMainWindow();
      if (process.platform === "darwin" && mainWindow && (!mainWindow.isVisible() || !mainWindow.isFocused())) {
        pendingNotificationCount++;
        app.dock?.setBadge(String(pendingNotificationCount));
      }
    }
    function clearDockBadge() {
      if (process.platform !== "darwin") return;
      pendingNotificationCount = 0;
      app.dock?.setBadge("");
    }
    function register() {
      wrapIpcHandler("get-notification-permission-status", () => getPermissionStatus());
      wrapIpcHandler("request-notification-permission", () => {
        if (getPermissionStatus() !== "not-determined") return getPermissionStatus();
        try {
          const notif = new Notification2({ title: "OpenShadow", body: "Notifications enabled", silent: true });
          notif.show();
        } catch {
        }
        return getPermissionStatus();
      });
      wrapIpcHandler("show-notification", (_event, title, body) => {
        show(title, body);
        return { ok: true };
      });
    }
    return { clearDockBadge, getPermissionStatus, register, show };
  }
  notificationController = { createNotificationController };
  return notificationController;
}
var main$1;
var hasRequiredMain;
function requireMain() {
  if (hasRequiredMain) return main$1;
  hasRequiredMain = 1;
  const { app, BrowserWindow, desktopCapturer, dialog, ipcMain, Menu, nativeTheme, Tray, Menu: TrayMenu, globalShortcut, powerSaveBlocker, shell } = require$$1;
  const { join, dirname, resolve } = require$$1$2;
  const { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } = require$$2;
  const { createThemeController } = requireThemeController();
  const { setIpcSenderValidator, wrapIpcHandler, wrapIpcOn } = requireIpcWrapper();
  const { createServerManager } = requireServerManager();
  const { createSettingsWindow, getSettingsWindow } = requireSettingsWindowController();
  const { initAutoUpdater, checkForUpdatesAuto } = requireAutoUpdater();
  const { createFileWatchRegistry } = requireFileWatchRegistry();
  const { createWorkspaceWatchRegistry } = requireWorkspaceWatchRegistry();
  const { resolveGpuStartupPolicy, applyGpuStartupPolicy, markGpuStartupPending, markGpuStartupPhase, markGpuStartupReady } = requireGpuStartupPolicy();
  const { readNetworkProxyConfig, applyNetworkProxy } = requireNetworkProxy();
  const { grantWebContentsAccess, canReadPath, canWritePath, isSetupComplete } = requireDesktopAccessPolicy();
  const { createEditorWindowController } = requireEditorWindowController();
  const { createBrowserAgentController } = requireBrowserAgent();
  const isDev = !app.isPackaged;
  const VITE_DEV_URL = process.env.VITE_DEV_URL || "http://localhost:5280";
  const APP_ICON_PATH = join(__dirname, "assets", "rem-avatar.png");
  if (process.platform === "win32") {
    app.setAppUserModelId("com.openshadow.app");
  }
  app.commandLine.appendSwitch("high-dpi-support", "1");
  (function applyGpuPolicy() {
    const hanakoHome = process.env.OPENSHADOW_HOME || join(process.env.APPDATA || process.env.HOME || "", ".openshadow");
    try {
      const policy = resolveGpuStartupPolicy({ hanakoHome, platform: process.platform });
      console.log(`[gpu-policy] mode=${policy.mode}, reason=${policy.reason}`);
      applyGpuStartupPolicy(app, policy);
      try {
        markGpuStartupPending({ hanakoHome, phase: "electron-starting" });
      } catch {
      }
    } catch (err) {
      console.warn("[gpu-policy] failed to apply:", err.message);
    }
  })();
  (function applyProxy() {
    try {
      const hanakoHome = process.env.OPENSHADOW_HOME || join(process.env.APPDATA || process.env.HOME || "", ".openshadow");
      const config = readNetworkProxyConfig({ hanakoHome });
      if (config.mode !== "direct") {
        console.log(`[network-proxy] mode=${config.mode}`);
        applyNetworkProxy(app, config);
      }
    } catch (err) {
      console.warn("[network-proxy] failed to apply:", err.message);
    }
  })();
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
  function readServerInfo() {
    try {
      const hanakoHome = process.env.OPENSHADOW_HOME || join(process.cwd(), ".openshadow");
      const p = join(hanakoHome, "server-info.json");
      if (!existsSync(p)) {
        return { port: 3e3, token: null };
      }
      const info = JSON.parse(readFileSync(p, "utf-8"));
      if (!info || !info.port) {
        return { port: 3e3, token: null };
      }
      return info;
    } catch {
      return { port: 3e3, token: null };
    }
  }
  function isWizardCompleted() {
    return readConfig().wizard && readConfig().wizard.completed === true;
  }
  const { API_PROVIDER_PRESETS: API_PROVIDER_PRESETS2 } = require$$15;
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
  let settingsWindow = null;
  let editorController = null;
  let browserAgent2 = null;
  function isTrustedAppWebContents(webContents, channel) {
    if (!webContents || webContents.isDestroyed && webContents.isDestroyed()) return false;
    const owner = BrowserWindow.fromWebContents(webContents);
    if (owner === mainWindow || owner === wizardWindow || owner === settingsWindow) return true;
    if (editorController && owner === editorController.getWindow()) return true;
    if (browserAgent2 && owner === browserAgent2.getWindow()) return true;
    try {
      const url = webContents.getURL && webContents.getURL();
      if (url && url.startsWith("file://")) return true;
      if (/^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?\//.test(url)) return true;
    } catch {
    }
    console.warn(`[IPC][${channel}] untrusted sender rejected`);
    return false;
  }
  setIpcSenderValidator((channel, event) => isTrustedAppWebContents(event?.sender, channel));
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
    wrapIpcHandler("server:get-info", () => {
      const info = readServerInfo();
      return { port: info?.port || null, token: info?.token || null };
    });
    wrapIpcHandler("wizard:get-config", () => {
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
    wrapIpcHandler("wizard:save-config", (_e, payload) => {
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
        try {
          const allWins = BrowserWindow.getAllWindows();
          for (const win of allWins) {
            if (!win.isDestroyed()) {
              win.webContents.send("config:updated", { source: "wizard" });
            }
          }
        } catch (e) {
          console.warn("[wizard] broadcast config:updated failed:", e.message);
        }
        return { ok: true };
      } catch (e) {
        console.error("[wizard] save-config error:", e.message);
        return { ok: false, error: e.message };
      }
    });
    wrapIpcHandler("wizard:test-connection", async (_e, providerInput) => {
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
    wrapIpcHandler("wizard:pick-folder", async () => {
      const { canceled, filePaths } = await dialog.showOpenDialog({
        title: "选择 OpenShadow 的工作区目录",
        message: "请选择 OpenShadow 可以读写的目录(可多选)。这些目录拥有完整权限(读/写/删)。",
        properties: ["openDirectory", "multiSelections", "createDirectory"]
      });
      return canceled ? [] : filePaths;
    });
    wrapIpcHandler("dialog:selectFolder", async (_e, opts) => {
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
    wrapIpcHandler("dialog:selectFiles", async (_e, opts) => {
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
    wrapIpcHandler("screenshot:capture", async (_e, displayId) => {
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
    wrapIpcHandler("screenshot:capture-window", async (_e, windowId) => {
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
    wrapIpcOn("browser:response", (_event, response) => {
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
      return new Promise((resolve2, reject) => {
        const id = "cmd-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
        const timer = setTimeout(() => {
          pendingBrowserResponses.delete(id);
          resolve2({ success: false, error: "Browser command timed out: " + cmd.type });
        }, timeoutMs);
        pendingBrowserResponses.set(id, { resolve: resolve2, reject, timer });
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("browser:command", Object.assign({ id }, cmd));
        } else {
          clearTimeout(timer);
          pendingBrowserResponses.delete(id);
          resolve2({ success: false, error: "Main window not available" });
        }
      });
    }
    wrapIpcHandler("browser:create", async (_e, url) => sendBrowserCommand({ type: "create", url: url || "about:blank" }));
    wrapIpcHandler("browser:navigate", async (_e, url) => sendBrowserCommand({ type: "navigate", url }));
    wrapIpcHandler("browser:screenshot", async () => sendBrowserCommand({ type: "screenshot" }));
    wrapIpcHandler("browser:click", async (_e, selector) => sendBrowserCommand({ type: "click", selector }));
    wrapIpcHandler("browser:type", async (_e, selector, text) => sendBrowserCommand({ type: "type", selector, text }));
    wrapIpcHandler("browser:press-key", async (_e, key) => sendBrowserCommand({ type: "pressKey", key }));
    wrapIpcHandler("browser:get-text", async (_e, selector) => sendBrowserCommand({ type: "getText", selector }));
    wrapIpcHandler("browser:get-html", async () => sendBrowserCommand({ type: "getHtml" }));
    wrapIpcHandler("browser:wait-for", async (_e, selector, timeout) => sendBrowserCommand({ type: "waitForSelector", selector, timeout: timeout || 1e4 }));
    wrapIpcHandler("browser:close", async () => sendBrowserCommand({ type: "close" }));
    wrapIpcOn("window:minimize", (event) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (win) win.minimize();
    });
    wrapIpcOn("window:maximize", (event) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (!win) return;
      if (win.isMaximized()) {
        win.unmaximize();
      } else {
        win.maximize();
      }
    });
    wrapIpcOn("window:close", (event) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (win) win.close();
    });
    wrapIpcHandler("window:is-maximized", (event) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      return win ? win.isMaximized() : false;
    });
    wrapIpcHandler("wizard:set-login-item", (_e, enable) => {
      app.setLoginItemSettings({
        openAtLogin: enable,
        name: "OpenShadow"
      });
      console.log("[main] login item auto-start:", enable ? "enabled" : "disabled");
      return { ok: true };
    });
    wrapIpcHandler("wizard:get-login-item", () => {
      const settings = app.getLoginItemSettings();
      return { enabled: settings.openAtLogin };
    });
    wrapIpcHandler("window:open-settings", () => {
      const win = createSettingsWindow({
        mainWindow,
        preloadPath: join(__dirname, "preload.bundle.cjs"),
        iconPath: APP_ICON_PATH,
        isDev,
        viteDevUrl: VITE_DEV_URL
      });
      return { ok: true, id: win?.id };
    });
    wrapIpcHandler("file-watch:subscribe", (event, filePath) => {
      const subscriberId = event.sender.getId();
      fileWatchRegistry2.subscribe(filePath, subscriberId);
      return { ok: true };
    });
    wrapIpcHandler("file-watch:unsubscribe", (event, filePath) => {
      const subscriberId = event.sender.getId();
      fileWatchRegistry2.unsubscribe(filePath, subscriberId);
      return { ok: true };
    });
    wrapIpcHandler("file-watch:unsubscribe-all", (event) => {
      const subscriberId = event.sender.getId();
      fileWatchRegistry2.unsubscribeAll(subscriberId);
      return { ok: true };
    });
    wrapIpcHandler("workspace-watch:subscribe", (event, rootPath) => {
      const subscriberId = event.sender.getId();
      workspaceWatchRegistry2.subscribe(rootPath, subscriberId);
      return { ok: true };
    });
    wrapIpcHandler("workspace-watch:unsubscribe", (event, rootPath) => {
      const subscriberId = event.sender.getId();
      workspaceWatchRegistry2.unsubscribe(rootPath, subscriberId);
      return { ok: true };
    });
    wrapIpcHandler("workspace-watch:unsubscribe-all", (event) => {
      const subscriberId = event.sender.getId();
      workspaceWatchRegistry2.unsubscribeAll(subscriberId);
      return { ok: true };
    });
    wrapIpcHandler("quick-chat:show", () => {
      showQuickChatWindow();
      return { ok: true };
    });
    wrapIpcHandler("quick-chat:hide", () => {
      hideQuickChatWindow();
      return { ok: true };
    });
    wrapIpcHandler("quick-chat:toggle", () => {
      toggleQuickChatWindow();
      return { ok: true };
    });
    wrapIpcHandler("quick-chat:resize", (_event, mode) => {
      if (mode !== "compact" && mode !== "chat") return { ok: false, error: "invalid mode" };
      quickChatMode = mode;
      if (quickChatWindow && !quickChatWindow.isDestroyed()) {
        const bounds = getQuickChatBounds();
        quickChatWindow.setResizable(mode === "chat");
        quickChatWindow.setBounds(bounds, true);
      }
      return { ok: true };
    });
    wrapIpcHandler("quick-chat:shortcut-status", () => {
      return {
        shortcut: registeredQuickChatShortcut || "Alt+Space",
        registered: !!registeredQuickChatShortcut
      };
    });
    wrapIpcHandler("quick-chat:reload-shortcut", () => {
      try {
        const cfg = readConfig();
        const shortcut = cfg?.quickChat?.shortcut || "Alt+Space";
        registerQuickChatShortcut(shortcut);
        return { ok: true, shortcut };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    });
  }
  function createMainWindow() {
    if (mainWindow && !mainWindow.isDestroyed()) return mainWindow;
    const saved = loadWindowState();
    mainWindow = new BrowserWindow({
      width: saved && saved.width || 1180,
      height: saved && saved.height || 760,
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
      backgroundColor: themeController2.bgFor(themeController2.getTheme()),
      show: false
    });
    if (saved && saved.x != null && saved.y != null) {
      try {
        mainWindow.setPosition(saved.x, saved.y);
      } catch {
      }
    }
    if (saved && saved.isMaximized) {
      mainWindow.maximize();
    }
    mainWindow.once("ready-to-show", () => {
      if (mainWindow) {
        themeController2.applyToWindow(mainWindow, themeController2.getTheme());
        mainWindow.show();
        console.log("Main window shown");
      }
    });
    if (isDev) {
      const http = require$$4$1;
      const devUrl = new URL(VITE_DEV_URL);
      const req = http.get(devUrl.origin, { timeout: 2e3 }, (res) => {
        res.destroy();
        console.log("Loading Vite dev server:", VITE_DEV_URL);
        mainWindow.loadURL(VITE_DEV_URL);
        mainWindow.webContents.openDevTools({ mode: "detach" });
      });
      req.on("error", () => {
        console.log("[main] Vite dev server not available, falling back to dist-renderer");
        const exePath = app.getAppPath();
        mainWindow.loadFile(join(exePath, "desktop", "dist-renderer", "index.html"));
      });
      req.on("timeout", () => {
        req.destroy();
        console.log("[main] Vite dev server timeout, falling back to dist-renderer");
        const exePath = app.getAppPath();
        mainWindow.loadFile(join(exePath, "desktop", "dist-renderer", "index.html"));
      });
    } else {
      const exePath = app.getAppPath();
      mainWindow.loadFile(join(exePath, "desktop", "dist-renderer", "index.html"));
    }
    mainWindow.on("closed", () => {
      mainWindow = null;
      if (process.platform !== "darwin") app.quit();
    });
    mainWindow.webContents.on("render-process-gone", (_event, details) => {
      console.error(`[main] renderer crashed: ${details.reason} (exitCode: ${details.exitCode})`);
      if (mainWindow && !mainWindow.isDestroyed()) {
        setTimeout(() => {
          try {
            mainWindow.reload();
          } catch {
          }
        }, 1e3);
      }
    });
    mainWindow.webContents.on("will-navigate", (event, url) => {
      try {
        const parsed = new URL(url);
        if (parsed.protocol === "https:" || parsed.protocol === "http:") {
          event.preventDefault();
          shell.openExternal(url);
        }
      } catch {
      }
    });
    const broadcastMaximizeChange = () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("window:maximize-change", mainWindow.isMaximized());
      }
    };
    mainWindow.on("maximize", broadcastMaximizeChange);
    mainWindow.on("unmaximize", broadcastMaximizeChange);
    mainWindow.on("resize", () => saveWindowStateSoon(mainWindow));
    mainWindow.on("move", () => saveWindowStateSoon(mainWindow));
    mainWindow.on("close", () => saveWindowState(mainWindow));
    console.log("Main window created (dev=" + isDev + ")");
  }
  Menu.setApplicationMenu(null);
  const gotSingleInstanceLock = app.requestSingleInstanceLock();
  if (!gotSingleInstanceLock) {
    console.log("[main] another instance is running, quitting");
    app.quit();
  }
  app.on("second-instance", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
  let wakeLockId = null;
  const WINDOW_STATE_PATH = join(process.cwd(), "window-state.json");
  function setWakeLock(active) {
    if (active) {
      if (wakeLockId === null) {
        wakeLockId = powerSaveBlocker.start("prevent-app-suspension");
        console.log("[main] wakeLock started, id:", wakeLockId);
      }
    } else {
      if (wakeLockId !== null && powerSaveBlocker.isStarted(wakeLockId)) {
        powerSaveBlocker.stop(wakeLockId);
        wakeLockId = null;
        console.log("[main] wakeLock stopped");
      }
    }
  }
  function loadWindowState() {
    try {
      if (existsSync(WINDOW_STATE_PATH)) {
        return JSON.parse(readFileSync(WINDOW_STATE_PATH, "utf-8"));
      }
    } catch {
    }
    return null;
  }
  function saveWindowState(win) {
    if (!win || win.isDestroyed()) return;
    try {
      const bounds = win.getBounds();
      const state = {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        isMaximized: win.isMaximized()
      };
      writeFileSync(WINDOW_STATE_PATH, JSON.stringify(state, null, 2), "utf-8");
    } catch {
    }
  }
  let saveWindowStateTimer = null;
  function saveWindowStateSoon(win) {
    if (saveWindowStateTimer) clearTimeout(saveWindowStateTimer);
    saveWindowStateTimer = setTimeout(() => {
      saveWindowState(win);
      saveWindowStateTimer = null;
    }, 1e3);
  }
  const serverManager2 = createServerManager({
    app,
    lynnHome: process.env.OPENSHADOW_HOME || join(process.cwd(), ".openshadow"),
    dirname: __dirname,
    execPath: process.execPath,
    platform: process.platform,
    env: process.env,
    resourcesPath: process.resourcesPath || "",
    fetch: globalThis.fetch,
    onServerReady: ({ port, token, reused }) => {
      console.log(`[main] Server ${reused ? "reused" : "started"} on port ${port}`);
    },
    onServerCrashed: (err) => {
      console.error("[main] Server crashed:", err.message);
      dialog.showErrorBox("OpenShadow Server", "服务器崩溃: " + err.message);
    },
    onServerRestarted: ({ port, token }) => {
      console.log("[main] Server restarted on port", port);
    },
    writeCrashLog: (msg) => {
      try {
        const logPath = join(process.cwd(), "crash.log");
        appendFileSync(logPath, `[${(/* @__PURE__ */ new Date()).toISOString()}] ${msg}
`, "utf-8");
      } catch {
      }
    }
  });
  const fileWatchRegistry2 = createFileWatchRegistry({
    watch: (filePath, callback) => {
      const watcher = require$$17.watch(filePath, {
        ignoreInitial: true,
        atomic: true,
        awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 }
      });
      watcher.on("all", (eventType, changedPath) => {
        callback(eventType, changedPath);
      });
      return watcher;
    },
    notifySubscriber: (subscriberId, eventType, filePath) => {
      const win = BrowserWindow.fromId(subscriberId);
      if (win && !win.isDestroyed()) {
        win.webContents.send("file-watch:change", { eventType, filePath });
      }
    }
  });
  function shouldIgnoreWorkspacePath(rootPath, filePath) {
    const relative = filePath.replace(rootPath, "").replace(/\\/g, "/");
    const ignoredPatterns = [
      "/node_modules/",
      "/.git/",
      "/.openshadow/",
      "/dist/",
      "/out/",
      "/.DS_Store",
      "~",
      ".swp",
      ".swo",
      ".tmp",
      ".temp",
      ".log",
      "crash.log",
      "server-info.json"
    ];
    return ignoredPatterns.some((p) => relative.includes(p));
  }
  const workspaceWatchRegistry2 = createWorkspaceWatchRegistry({
    watch: (rootPath, callback) => {
      const watcher = require$$17.watch(rootPath, {
        ignoreInitial: true,
        atomic: true,
        awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
        ignored: (path) => {
          return shouldIgnoreWorkspacePath(rootPath, path);
        }
      });
      watcher.on("all", (eventType, changedPath) => {
        callback(eventType, changedPath);
      });
      return watcher;
    },
    notifySubscriber: (subscriberId, eventType, rootPath, changedPath) => {
      const win = BrowserWindow.fromId(subscriberId);
      if (win && !win.isDestroyed()) {
        win.webContents.send("workspace-watch:change", { eventType, rootPath, changedPath });
      }
    }
  });
  const themeController2 = createThemeController({
    BrowserWindow,
    nativeTheme,
    getMainWindow: () => mainWindow,
    getSettingsWindow: () => settingsWindow,
    getBrowserViewer: () => null
    // 浏览器 viewer 不在 openshadow 路线里
  });
  themeController2.attachIpc({ ipcMain, wrapIpcOn });
  app.whenReady().then(async () => {
    registerIpcHandlers();
    void (async () => {
      try {
        await serverManager2.start();
        serverManager2.monitor();
        serverManager2.startHeartbeat();
        if (browserAgent2 && serverManager2.getPort()) {
          browserAgent2.setupCommands(serverManager2.getPort(), serverManager2.getToken());
          console.log("[main] browser agent WebSocket setup complete");
        }
        const port = serverManager2.getPort();
        const token = serverManager2.getToken();
        if (port) {
          console.log(`[main] Notifying renderer: server ready on port ${port}`);
          for (const win of BrowserWindow.getAllWindows()) {
            if (!win.isDestroyed()) {
              win.webContents.send("server:ready", { port, token });
            }
          }
        }
      } catch (err) {
        console.error("[main] Failed to start server:", err.message);
        try {
          const logPath = join(process.cwd(), "crash.log");
          appendFileSync(logPath, `[${(/* @__PURE__ */ new Date()).toISOString()}] Server start failed: ${err.message}
`, "utf-8");
        } catch {
        }
      }
    })();
    createTray();
    registerGlobalShortcut();
    try {
      editorController = createEditorWindowController({
        wrapIpcHandler,
        isDev,
        viteDevUrl: VITE_DEV_URL,
        preloadPath: join(__dirname, "preload.bundle.cjs"),
        getMainWindow: () => mainWindow,
        canWritePath,
        grantWebContentsAccess
      });
      editorController.register();
      console.log("[main] editor window controller registered");
    } catch (err) {
      console.warn("[main] failed to init editor controller:", err.message);
    }
    try {
      browserAgent2 = createBrowserAgentController({
        isDev,
        viteDevUrl: VITE_DEV_URL,
        preloadPath: join(__dirname, "preload.bundle.cjs"),
        getMainWindow: () => mainWindow
      });
      browserAgent2.registerIpc(wrapIpcHandler);
      console.log("[main] browser agent controller registered");
    } catch (err) {
      console.warn("[main] failed to init browser agent:", err.message);
    }
    try {
      const { createMainI18n } = requireMainI18n();
      const hanakoHome = process.env.OPENSHADOW_HOME || join(process.env.APPDATA || process.env.HOME || "", ".openshadow");
      const localesDir = join(__dirname, "src", "locales");
      const { mt, reset: resetI18n } = createMainI18n({ hanakoHome, localesDir });
      globalThis.__mainI18nMt = mt;
      console.log("[main] i18n initialized");
    } catch (err) {
      console.warn("[main] failed to init i18n:", err.message);
      globalThis.__mainI18nMt = (key, d) => d || key;
    }
    try {
      const { installAppMenu } = requireAppMenu();
      const mt = globalThis.__mainI18nMt || ((key, d) => d || key);
      installAppMenu({ Menu, app, platform: process.platform, mt });
    } catch (err) {
      console.warn("[main] failed to install app menu:", err.message);
    }
    try {
      const { session } = require("electron");
      session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
        if (permission === "media") {
          const details = arguments[3] || {};
          const mediaTypes = Array.isArray(details.mediaTypes) ? details.mediaTypes : [];
          const wantsAudio = mediaTypes.length === 0 || mediaTypes.includes("audio");
          const trusted = webContents.getURL().startsWith("http://localhost:") || webContents.getURL().startsWith("file://");
          callback(Boolean(wantsAudio && trusted));
          return;
        }
        callback(false);
      });
      session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
        if (permission !== "media") return false;
        const trusted = webContents.getURL().startsWith("http://localhost:") || webContents.getURL().startsWith("file://");
        return Boolean(trusted);
      });
      console.log("[main] media permission handler installed");
    } catch (err) {
      console.warn("[main] failed to install media permission handler:", err.message);
    }
    await runWizardWindow();
    if (isWizardCompleted()) {
      createMainWindow();
      try {
        const hanakoHome2 = process.env.OPENSHADOW_HOME || join(process.cwd(), ".openshadow");
        markGpuStartupReady({ hanakoHome: hanakoHome2, phase: "main-window-created" });
      } catch {
      }
      const hanakoHome = process.env.OPENSHADOW_HOME || join(process.cwd(), ".openshadow");
      initAutoUpdater(mainWindow, { hanakoHome });
      checkForUpdatesAuto();
      initQuickChat();
      try {
        const { createNotificationController } = requireNotificationController();
        const notificationController2 = createNotificationController({
          app,
          Notification,
          systemPreferences,
          wrapIpcHandler,
          getMainWindow: () => mainWindow
        });
        notificationController2.register();
        console.log("[main] notification controller registered");
      } catch (err) {
        console.warn("[main] failed to init notification controller:", err.message);
      }
    } else {
      console.log("[main] waiting for wizard to complete…");
      wrapIpcOn("wizard:done-signal", async () => {
        console.log("[main] wizard done");
        if (wizardWindow) wizardWindow.close();
        wizardWindow = null;
        try {
          const cfg = readConfig();
          const info = readServerInfo();
          if (info && info.port) {
            const providersObj = {};
            if (Array.isArray(cfg.providers)) {
              for (const p of cfg.providers) {
                if (!p || !p.id) continue;
                providersObj[p.id] = {
                  base_url: p.baseUrl || p.base_url || p.url || "",
                  api_key: p.apiKey || p.api_key || "",
                  api: p.api || p.type === "anthropic" ? "anthropic-messages" : p.type === "gemini" ? "google-generative-ai" : "openai-completions",
                  models: Array.isArray(p.models) ? p.models : [],
                  display_name: p.name || p.display_name || p.id
                };
              }
            }
            const url = `http://127.0.0.1:${info.port}/api/config`;
            const headers = { "Content-Type": "application/json" };
            if (info.token) headers["Authorization"] = `Bearer ${info.token}`;
            const res = await fetch(url, {
              method: "PUT",
              headers,
              body: JSON.stringify({
                providers: Object.keys(providersObj).length > 0 ? providersObj : cfg.providers,
                models: cfg.models,
                wizard: cfg.wizard,
                ui: cfg.ui,
                user: cfg.user,
                memory: cfg.memory,
                theme: cfg.theme,
                security: cfg.security
              })
            });
            if (!res.ok) {
              console.warn("[main] PUT /api/config failed:", res.status);
            } else {
              console.log("[main] PUT /api/config succeeded, server models ready");
            }
          } else {
            console.warn("[main] server-info.json not available, skipping config push");
          }
        } catch (e) {
          console.warn("[main] PUT /api/config error:", e.message);
        }
        createMainWindow();
        try {
          const hanakoHome2 = process.env.OPENSHADOW_HOME || join(process.cwd(), ".openshadow");
          markGpuStartupReady({ hanakoHome: hanakoHome2, phase: "main-window-created" });
        } catch {
        }
        const hanakoHome = process.env.OPENSHADOW_HOME || join(process.cwd(), ".openshadow");
        initAutoUpdater(mainWindow, { hanakoHome });
        checkForUpdatesAuto();
        initQuickChat();
      });
    }
  });
  app.on("window-all-closed", () => {
    if (!trayIcon) {
      app.quit();
    }
  });
  let trayIcon = null;
  function createTray() {
    if (trayIcon) return;
    try {
      const { nativeImage } = require("electron");
      const trayIconPath = join(__dirname, "src", "assets", "rem-avatar.png");
      const icon = nativeImage.createFromPath(trayIconPath);
      icon.resize({ width: 16, height: 16 });
      trayIcon = new Tray(icon);
      const contextMenu = TrayMenu.buildFromTemplate([
        {
          label: "显示主窗口",
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.show();
              mainWindow.focus();
            }
          }
        },
        {
          label: "设置",
          click: () => {
            const win = createSettingsWindow({
              mainWindow,
              preloadPath: join(__dirname, "preload.bundle.cjs"),
              iconPath: APP_ICON_PATH,
              isDev,
              viteDevUrl: VITE_DEV_URL
            });
            if (win) win.show();
          }
        },
        { type: "separator" },
        {
          label: "退出",
          click: () => {
            app.quit();
          }
        }
      ]);
      trayIcon.setToolTip("OpenShadow");
      trayIcon.setContextMenu(contextMenu);
      trayIcon.on("click", () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          if (mainWindow.isVisible()) {
            mainWindow.hide();
          } else {
            mainWindow.show();
            mainWindow.focus();
          }
        }
      });
      console.log("[main] tray icon created");
    } catch (err) {
      console.error("[main] failed to create tray icon:", err.message);
    }
  }
  function destroyTray() {
    if (trayIcon) {
      trayIcon.destroy();
      trayIcon = null;
    }
  }
  function registerGlobalShortcut() {
    const shortcut = "Alt+Space";
    const success = globalShortcut.register(shortcut, () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        if (mainWindow.isVisible()) {
          mainWindow.hide();
        } else {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    });
    if (success) {
      console.log("[main] global shortcut registered:", shortcut);
    } else {
      console.warn("[main] failed to register global shortcut:", shortcut);
    }
  }
  function unregisterGlobalShortcut() {
    globalShortcut.unregisterAll();
  }
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      if (isWizardCompleted()) {
        createMainWindow();
      } else {
        runWizardWindow();
      }
    }
  });
  app.on("before-quit", async (event) => {
    console.log("[main] before-quit");
    event.preventDefault();
    destroyTray();
    unregisterGlobalShortcut();
    if (wakeLockId !== null && powerSaveBlocker.isStarted(wakeLockId)) {
      powerSaveBlocker.stop(wakeLockId);
      wakeLockId = null;
    }
    try {
      if (browserAgent2 && browserAgent2.shutdown) {
        browserAgent2.shutdown();
        console.log("[main] browser agent shutdown complete");
      }
    } catch (err) {
      console.warn("[main] browser agent shutdown error:", err.message);
    }
    try {
      if (editorController && editorController.destroy) {
        editorController.destroy();
        console.log("[main] editor controller destroyed");
      }
    } catch (err) {
      console.warn("[main] editor controller destroy error:", err.message);
    }
    serverManager2.setIsQuitting(true);
    await serverManager2.shutdown();
    app.exit(0);
  });
  function writeCrashLog(err) {
    try {
      const logPath = join(process.cwd(), "crash.log");
      const timestamp = (/* @__PURE__ */ new Date()).toISOString();
      const entry = `[${timestamp}] ${err.message || err}
${err.stack || ""}

`;
      appendFileSync(logPath, entry, "utf-8");
      console.log("[main] crash log written to", logPath);
    } catch {
    }
  }
  process.on("uncaughtException", (err) => {
    if (err.code === "EPIPE" || err.code === "ERR_IPC_CHANNEL_CLOSED") return;
    const traceId = Math.random().toString(16).slice(2, 10);
    console.error(`[ErrorBus][${err.code || "UNKNOWN"}][${traceId}] uncaughtException: ${err.message}`);
    console.error(`[ErrorBus][${traceId}] ${err.stack || err.message}`);
    writeCrashLog(err);
  });
  process.on("unhandledRejection", (reason) => {
    const err = reason instanceof Error ? reason : new Error(String(reason));
    const traceId = Math.random().toString(16).slice(2, 10);
    console.error(`[ErrorBus][${err.code || "UNKNOWN"}][${traceId}] unhandledRejection: ${err.message}`);
    console.error(`[ErrorBus][${traceId}] ${err.stack || err.message}`);
    writeCrashLog(err);
  });
  let splashWindow = null;
  function createSplashWindow() {
    if (splashWindow) return splashWindow;
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
          sandbox: false
        },
        backgroundColor: "#F8F5ED",
        show: false,
        ...windowIconOpts()
      });
      const splashHtml = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>OpenShadow</title></head>
<body style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;background:#F8F5ED;font-family:sans-serif;">
  <h2 style="color:#333;margin-bottom:8px;">OpenShadow</h2>
  <p style="color:#666;margin:0;">正在启动...</p>
</body>
</html>`;
      splashWindow.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(splashHtml));
      splashWindow.once("ready-to-show", () => {
        splashWindow.show();
      });
      splashWindow.once("closed", () => {
        splashWindow = null;
      });
      console.log("[main] splash window created");
    } catch (err) {
      console.warn("[main] failed to create splash window:", err.message);
    }
    return splashWindow;
  }
  function destroySplashWindow() {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
      splashWindow = null;
    }
  }
  let quickChatWindow = null;
  let quickChatMode = "compact";
  let registeredQuickChatShortcut = null;
  const QUICK_CHAT_STATE_PATH = join(
    process.env.OPENSHADOW_HOME || join(process.env.APPDATA || process.env.HOME || "", ".openshadow"),
    "user",
    "quick-chat-window-state.json"
  );
  function loadQuickChatWindowState() {
    try {
      return JSON.parse(readFileSync(QUICK_CHAT_STATE_PATH, "utf-8"));
    } catch {
      return null;
    }
  }
  function saveQuickChatWindowState() {
    if (!quickChatWindow || quickChatWindow.isDestroyed()) return;
    try {
      const bounds = quickChatWindow.getBounds();
      const state = { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height, mode: quickChatMode };
      mkdirSync(join(QUICK_CHAT_STATE_PATH, ".."), { recursive: true });
      writeFileSync(QUICK_CHAT_STATE_PATH, JSON.stringify(state, null, 2), "utf-8");
    } catch {
    }
  }
  function getQuickChatBounds() {
    const state = loadQuickChatWindowState();
    const { screen } = require$$1;
    const primary = screen.getPrimaryDisplay().workAreaSize;
    const width = 420;
    const height = quickChatMode === "chat" ? 600 : 120;
    const x = state?.x ?? Math.round((primary.width - width) / 2);
    const y = state?.y ?? Math.round(primary.height - height - 40);
    return { x, y, width, height };
  }
  function createQuickChatWindow() {
    if (quickChatWindow && !quickChatWindow.isDestroyed()) return quickChatWindow;
    const bounds = getQuickChatBounds();
    quickChatWindow = new BrowserWindow({
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      minWidth: 320,
      minHeight: 80,
      maxWidth: quickChatMode === "compact" ? 520 : void 0,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: quickChatMode === "chat",
      show: false,
      webPreferences: {
        preload: join(__dirname, "preload.bundle.cjs"),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false
      },
      ...windowIconOpts()
    });
    if (isDev) {
      quickChatWindow.loadURL(VITE_DEV_URL.replace(/\/?$/, "") + "/quick-chat.html").catch((err) => {
        console.error("[quick-chat] failed to load dev URL:", err.message);
      });
    } else {
      const htmlPath = join(__dirname, "dist-renderer", "quick-chat.html");
      quickChatWindow.loadFile(htmlPath).catch((err) => {
        console.error("[quick-chat] failed to load file:", err.message);
      });
    }
    quickChatWindow.once("ready-to-show", () => {
      if (quickChatWindow && !quickChatWindow.isDestroyed()) {
        quickChatWindow.show();
      }
    });
    quickChatWindow.on("closed", () => {
      quickChatWindow = null;
    });
    console.log("[main] quick chat window created, mode=", quickChatMode);
    return quickChatWindow;
  }
  function showQuickChatWindow() {
    const win = createQuickChatWindow();
    if (win && !win.isVisible()) {
      win.show();
      win.focus();
    } else if (win && win.isVisible() && !win.isFocused()) {
      win.focus();
    }
  }
  function hideQuickChatWindow() {
    if (quickChatWindow && !quickChatWindow.isDestroyed()) {
      saveQuickChatWindowState();
      quickChatWindow.hide();
    }
  }
  function toggleQuickChatWindow() {
    if (quickChatWindow && !quickChatWindow.isDestroyed() && quickChatWindow.isVisible()) {
      if (quickChatWindow.isFocused()) {
        hideQuickChatWindow();
      } else {
        quickChatWindow.focus();
      }
    } else {
      showQuickChatWindow();
    }
  }
  function registerQuickChatShortcut(shortcut) {
    shortcut = shortcut || "Alt+Space";
    if (registeredQuickChatShortcut) {
      globalShortcut.unregister(registeredQuickChatShortcut);
      registeredQuickChatShortcut = null;
    }
    const ok = globalShortcut.register(shortcut, toggleQuickChatWindow);
    if (ok) {
      registeredQuickChatShortcut = shortcut;
      console.log("[quick-chat] global shortcut registered:", shortcut);
    } else {
      console.warn("[quick-chat] failed to register shortcut:", shortcut);
    }
  }
  function initQuickChat() {
    try {
      const cfg = readConfig();
      const shortcut = cfg?.quickChat?.shortcut || "Alt+Space";
      registerQuickChatShortcut(shortcut);
    } catch {
      registerQuickChatShortcut("Alt+Space");
    }
  }
  const MAIN_PROCESS_LOCALE = "zh-CN";
  function t(mainKey, locale) {
    locale = locale || MAIN_PROCESS_LOCALE;
    const dict = {
      "zh-CN": {
        "app.name": "OpenShadow",
        "app.quitting": "正在退出...",
        "app.server-crashed": "服务器崩溃",
        "app.server-start-failed": "服务器启动失败",
        "tray.show": "显示主窗口",
        "tray.settings": "设置",
        "tray.quit": "退出"
      },
      "en": {
        "app.name": "OpenShadow",
        "app.quitting": "Quitting...",
        "app.server-crashed": "Server Crashed",
        "app.server-start-failed": "Server start failed",
        "tray.show": "Show Main Window",
        "tray.settings": "Settings",
        "tray.quit": "Quit"
      }
    };
    return dict[locale] && dict[locale][mainKey] || mainKey;
  }
  console.log("Electron starting...");
  main$1 = { registerIpcHandlers, isWizardCompleted, readConfig, setWakeLock, createSplashWindow, destroySplashWindow, t };
  return main$1;
}
var mainExports = requireMain();
const main = /* @__PURE__ */ getDefaultExportFromCjs(mainExports);
module.exports = main;
