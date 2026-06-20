"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
// @ts-nocheck
var electron_1 = require("electron");
var path_1 = require("path");
var fs_1 = require("fs");
var isDev = !electron_1.app.isPackaged;
var VITE_DEV_URL = (_a = process.env.VITE_DEV_URL) !== null && _a !== void 0 ? _a : 'http://localhost:5173';
var WIZ_DEV_HTML = (0, path_1.join)(__dirname, 'wizard', 'index.html');
// ─── App icon (Stage 1j: Q 版雷姆) ─────────────────────────────
// PNG 是 dev 模式的 runtime icon（窗口左上角 + 任务栏运行时图标）
// 生产打包 (electron-builder) 需要 .ico 才能正确写入 EXE 资源
var APP_ICON_PATH = (0, path_1.join)(__dirname, 'assets', 'rem-avatar.png');
// Windows 任务栏需要 AppUserModelID 才能正确显示应用图标 + 独立分组
if (process.platform === 'win32') {
    electron_1.app.setAppUserModelId('com.remu.app');
}
// ─── Self-contained config reader (no core/* dependency) ────────────
// desktop tsconfig is CommonJS scope, so we read config.json directly
// to avoid cross-project TS compilation.
var CONFIG_PATH = (0, path_1.join)(process.cwd(), 'config.json');
function readConfig() {
    if (!(0, fs_1.existsSync)(CONFIG_PATH))
        return { version: '0.1.0' };
    try {
        return JSON.parse((0, fs_1.readFileSync)(CONFIG_PATH, 'utf-8'));
    }
    catch (_a) {
        return { version: '0.1.0' };
    }
}
function writeConfig(cfg) {
    (0, fs_1.mkdirSync)((0, path_1.join)(CONFIG_PATH, '..'), { recursive: true });
    (0, fs_1.writeFileSync)(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf-8');
}
function isWizardCompleted() {
    var _a;
    return ((_a = readConfig().wizard) === null || _a === void 0 ? void 0 : _a.completed) === true;
}
// ─── Builtin provider metadata (mirror of core/providers/builtin.ts) ─
// Kept in sync with the main project. Updates must be made in both places.
var BUILTIN_PROVIDERS = {
    openai: {
        type: 'openai',
        label: 'OpenAI',
        baseUrl: 'https://api.openai.com/v1',
        models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o1-mini'],
        requiresApiKey: true,
    },
    anthropic: {
        type: 'openai',
        label: 'Anthropic (compatible)',
        baseUrl: 'https://api.anthropic.com/v1',
        models: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022'],
        requiresApiKey: true,
    },
    minimax: {
        type: 'openai',
        label: 'MiniMax',
        baseUrl: 'https://api.minimax.chat/v1',
        models: ['abab6.5s-chat', 'abab6.5g-chat', 'abab6.5t-chat'],
        requiresApiKey: true,
    },
    dashscope: {
        type: 'openai',
        label: '阿里云 DashScope (Qwen)',
        baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        models: ['qwen-plus', 'qwen-turbo', 'qwen-max', 'qwen-vl-plus'],
        requiresApiKey: true,
    },
    deepseek: {
        type: 'openai',
        label: 'DeepSeek',
        baseUrl: 'https://api.deepseek.com/v1',
        models: ['deepseek-chat', 'deepseek-coder', 'deepseek-reasoner'],
        requiresApiKey: true,
    },
    gemini: {
        type: 'gemini',
        label: 'Google Gemini',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
        models: ['gemini-2.0-flash-exp', 'gemini-1.5-pro', 'gemini-1.5-flash'],
        requiresApiKey: true,
    },
    ollama: {
        type: 'ollama',
        label: 'Ollama (local)',
        baseUrl: 'http://localhost:11434/v1',
        models: ['llama3.1', 'qwen2.5', 'mistral', 'codellama'],
        requiresApiKey: false,
        notes: '本地运行,无需 API Key',
    },
};
/** Probe an OpenAI-compatible endpoint with minimal token usage. */
function testOpenAICompatible(baseUrl, apiKey, model) {
    return __awaiter(this, void 0, void 0, function () {
        var start, res, latencyMs, errText, e_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    start = Date.now();
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 5, , 6]);
                    return [4 /*yield*/, fetch("".concat(baseUrl.replace(/\/+$/, ''), "/chat/completions"), {
                            method: 'POST',
                            headers: __assign({ 'Content-Type': 'application/json' }, (apiKey ? { Authorization: "Bearer ".concat(apiKey) } : {})),
                            body: JSON.stringify({
                                model: model,
                                messages: [{ role: 'user', content: 'hi' }],
                                max_tokens: 1,
                                stream: false,
                            }),
                        })];
                case 2:
                    res = _a.sent();
                    latencyMs = Date.now() - start;
                    if (!!res.ok) return [3 /*break*/, 4];
                    return [4 /*yield*/, res.text().catch(function () { return ''; })];
                case 3:
                    errText = _a.sent();
                    return [2 /*return*/, { ok: false, latencyMs: latencyMs, modelUsed: model, error: "".concat(res.status, " ").concat(res.statusText, ": ").concat(errText.slice(0, 200)) }];
                case 4: return [2 /*return*/, { ok: true, latencyMs: latencyMs, modelUsed: model }];
                case 5:
                    e_1 = _a.sent();
                    return [2 /*return*/, { ok: false, latencyMs: Date.now() - start, modelUsed: model, error: e_1.message }];
                case 6: return [2 /*return*/];
            }
        });
    });
}
var mainWindow = null;
var wizardWindow = null;
/**
 * First-run wizard: launch a dedicated BrowserWindow that loads
 * `desktop/wizard/index.html`. The wizard collects language / user name /
 * AI provider / model selection / workspace paths, then writes back to
 * config.json with `wizard.completed = true`.
 *
 * Stage 1b: replaced the previous native-dialog version. Stage 1e-1g: removed
 * core/* dependency in favor of direct config.json reads.
 */
function runWizardWindow() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (isWizardCompleted())
                        return [2 /*return*/];
                    wizardWindow = new electron_1.BrowserWindow({
                        width: 760,
                        height: 640,
                        minWidth: 640,
                        minHeight: 520,
                        title: 'Rem 启动向导',
                        icon: APP_ICON_PATH,
                        resizable: false,
                        minimizable: false,
                        maximizable: false,
                        webPreferences: {
                            preload: (0, path_1.join)(__dirname, 'wizard', 'preload.js'),
                            nodeIntegration: false,
                            contextIsolation: true,
                            sandbox: false,
                            webSecurity: false,
                        },
                        backgroundColor: '#faf8f5',
                        show: false,
                    });
                    wizardWindow.once('ready-to-show', function () {
                        wizardWindow === null || wizardWindow === void 0 ? void 0 : wizardWindow.show();
                        console.log('[wizard] window shown');
                    });
                    return [4 /*yield*/, wizardWindow.loadFile(WIZ_DEV_HTML)];
                case 1:
                    _a.sent();
                    console.log('[wizard] loaded HTML from', WIZ_DEV_HTML);
                    // Block close until wizard.completed is set
                    wizardWindow.on('close', function (e) {
                        if (!isWizardCompleted()) {
                            var choice = electron_1.dialog.showMessageBoxSync(wizardWindow, {
                                type: 'question',
                                buttons: ['继续设置', '退出'],
                                defaultId: 0,
                                cancelId: 1,
                                title: 'Rem 还没配置完',
                                message: 'Rem 还没配置完,现在退出将无法使用。确定要退出吗?',
                            });
                            if (choice === 1) {
                                electron_1.app.quit();
                            }
                            else {
                                e.preventDefault();
                            }
                        }
                        else {
                            wizardWindow = null;
                        }
                    });
                    return [2 /*return*/];
            }
        });
    });
}
// ─── IPC handlers ─────────────────────────────────────────────────────
function registerIpcHandlers() {
    var _this = this;
    electron_1.ipcMain.handle('wizard:get-config', function () {
        var _a, _b, _c, _d, _f, _g, _h, _j;
        var cfg = readConfig();
        return {
            providers: (_a = cfg.providers) !== null && _a !== void 0 ? _a : [],
            user: { name: (_c = (_b = cfg.user) === null || _b === void 0 ? void 0 : _b.name) !== null && _c !== void 0 ? _c : '王帅' },
            ui: { language: (_f = (_d = cfg.ui) === null || _d === void 0 ? void 0 : _d.language) !== null && _f !== void 0 ? _f : 'zh-CN' },
            theme: (_g = cfg.theme) !== null && _g !== void 0 ? _g : 'warm-paper',
            security: { workspaceRoots: (_j = (_h = cfg.security) === null || _h === void 0 ? void 0 : _h.workspaceRoots) !== null && _j !== void 0 ? _j : [] },
            builtins: BUILTIN_PROVIDERS,
        };
    });
    electron_1.ipcMain.handle('wizard:save-config', function (_e, payload) {
        var _a;
        try {
            var cfg = readConfig();
            // Merge payload into current config (preserves existing fields)
            var merged = __assign(__assign({}, cfg), payload);
            if ((_a = payload.security) === null || _a === void 0 ? void 0 : _a.workspaceRoots) {
                merged.security = __assign(__assign({}, cfg.security), { workspaceRoots: payload.security.workspaceRoots });
            }
            writeConfig(merged);
            return { ok: true };
        }
        catch (e) {
            return { ok: false, error: e.message };
        }
    });
    electron_1.ipcMain.handle('wizard:test-connection', function (_e, providerInput) { return __awaiter(_this, void 0, void 0, function () {
        var spec, model, result;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    spec = BUILTIN_PROVIDERS[providerInput.id];
                    if (!spec)
                        return [2 /*return*/, { ok: false, error: "Unknown provider: ".concat(providerInput.id) }];
                    model = (_a = providerInput.model) !== null && _a !== void 0 ? _a : spec.models[0];
                    return [4 /*yield*/, testOpenAICompatible(spec.baseUrl, providerInput.apiKey, model)];
                case 1:
                    result = _b.sent();
                    return [2 /*return*/, { ok: result.ok, latencyMs: result.latencyMs, error: result.error, modelUsed: result.modelUsed }];
            }
        });
    }); });
    electron_1.ipcMain.handle('wizard:pick-folder', function () { return __awaiter(_this, void 0, void 0, function () {
        var _a, canceled, filePaths;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, electron_1.dialog.showOpenDialog({
                        title: '选择 Rem 的工作区目录',
                        message: '请选择 Rem 可以读写的目录(可多选)。这些目录拥有完整权限(读/写/删)。',
                        properties: ['openDirectory', 'multiSelections', 'createDirectory'],
                    })];
                case 1:
                    _a = _b.sent(), canceled = _a.canceled, filePaths = _a.filePaths;
                    return [2 /*return*/, canceled ? [] : filePaths];
            }
        });
    }); });
    // ─── Screenshot via desktopCapturer ─────────────────────────────────
    electron_1.ipcMain.handle('screenshot:capture', function (_e, displayId) { return __awaiter(_this, void 0, void 0, function () {
        var targetDisplay, sources, source, thumbnail, size, base64, e_2;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    targetDisplay = displayId !== null && displayId !== void 0 ? displayId : 0;
                    return [4 /*yield*/, electron_1.desktopCapturer.getSources({
                            types: ['screen'],
                            thumbnailSize: { width: 1920, height: 1080 },
                            fetchWindowIcons: false,
                        })];
                case 1:
                    sources = _b.sent();
                    source = (_a = sources[targetDisplay]) !== null && _a !== void 0 ? _a : sources[0];
                    if (!source) {
                        return [2 /*return*/, { success: false, error: "No screen source found (requested index ".concat(targetDisplay, ", available ").concat(sources.length, ")") }];
                    }
                    thumbnail = source.thumbnail;
                    size = thumbnail.getSize();
                    base64 = thumbnail.toPNG().toString('base64');
                    return [2 /*return*/, {
                            success: true,
                            base64: base64,
                            path: '',
                            width: size.width,
                            height: size.height,
                            platform: process.platform,
                        }];
                case 2:
                    e_2 = _b.sent();
                    return [2 /*return*/, { success: false, error: "desktopCapturer failed: ".concat(e_2.message) }];
                case 3: return [2 /*return*/];
            }
        });
    }); });
    electron_1.ipcMain.handle('screenshot:capture-window', function (_e, windowId) { return __awaiter(_this, void 0, void 0, function () {
        var win, image, size, base64, e_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    win = windowId
                        ? electron_1.BrowserWindow.getAllWindows().find(function (w) { return w.id === windowId; })
                        : mainWindow;
                    if (!win || win.isDestroyed()) {
                        return [2 /*return*/, { success: false, error: 'Target window not found' }];
                    }
                    return [4 /*yield*/, win.webContents.capturePage()];
                case 1:
                    image = _a.sent();
                    size = image.getSize();
                    base64 = image.toPNG().toString('base64');
                    return [2 /*return*/, {
                            success: true,
                            base64: base64,
                            path: '',
                            width: size.width,
                            height: size.height,
                            platform: process.platform,
                        }];
                case 2:
                    e_3 = _a.sent();
                    return [2 /*return*/, { success: false, error: "capturePage failed: ".concat(e_3.message) }];
                case 3: return [2 /*return*/];
            }
        });
    }); });
    // ─── Browser webview IPC handlers (Stage 1f) ──────────────────────
    // Flow: core/tools/browser.ts (Node) → IPC invoke → main process
    //   → sends 'browser:command' to renderer's BrowserPanel
    //   → BrowserPanel executes on <webview> and sends 'browser:response' back
    //   → main process resolves the IPC invoke promise
    var pendingBrowserResponses = new Map();
    electron_1.ipcMain.on('browser:response', function (_event, response) {
        var _a;
        var pending = pendingBrowserResponses.get(response.id);
        if (!pending)
            return;
        clearTimeout(pending.timer);
        pendingBrowserResponses.delete(response.id);
        if (response.success) {
            pending.resolve(__assign({ success: true }, response.data));
        }
        else {
            pending.resolve({ success: false, error: (_a = response.error) !== null && _a !== void 0 ? _a : 'Unknown browser error' });
        }
    });
    function sendBrowserCommand(cmd, timeoutMs) {
        if (timeoutMs === void 0) { timeoutMs = 30000; }
        return new Promise(function (resolve, reject) {
            var id = "cmd-".concat(Date.now(), "-").concat(Math.random().toString(36).slice(2, 8));
            var timer = setTimeout(function () {
                pendingBrowserResponses.delete(id);
                resolve({ success: false, error: "Browser command timed out: ".concat(cmd.type) });
            }, timeoutMs);
            pendingBrowserResponses.set(id, { resolve: resolve, reject: reject, timer: timer });
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('browser:command', __assign({ id: id }, cmd));
            }
            else {
                clearTimeout(timer);
                pendingBrowserResponses.delete(id);
                resolve({ success: false, error: 'Main window not available' });
            }
        });
    }
    electron_1.ipcMain.handle('browser:create', function (_e, url) { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
        return [2 /*return*/, sendBrowserCommand({ type: 'create', url: url !== null && url !== void 0 ? url : 'about:blank' })];
    }); }); });
    electron_1.ipcMain.handle('browser:navigate', function (_e, url) { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
        return [2 /*return*/, sendBrowserCommand({ type: 'navigate', url: url })];
    }); }); });
    electron_1.ipcMain.handle('browser:screenshot', function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
        return [2 /*return*/, sendBrowserCommand({ type: 'screenshot' })];
    }); }); });
    electron_1.ipcMain.handle('browser:click', function (_e, selector) { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
        return [2 /*return*/, sendBrowserCommand({ type: 'click', selector: selector })];
    }); }); });
    electron_1.ipcMain.handle('browser:type', function (_e, selector, text) { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
        return [2 /*return*/, sendBrowserCommand({ type: 'type', selector: selector, text: text })];
    }); }); });
    electron_1.ipcMain.handle('browser:press-key', function (_e, key) { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
        return [2 /*return*/, sendBrowserCommand({ type: 'pressKey', key: key })];
    }); }); });
    electron_1.ipcMain.handle('browser:get-text', function (_e, selector) { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
        return [2 /*return*/, sendBrowserCommand({ type: 'getText', selector: selector })];
    }); }); });
    electron_1.ipcMain.handle('browser:get-html', function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
        return [2 /*return*/, sendBrowserCommand({ type: 'getHtml' })];
    }); }); });
    electron_1.ipcMain.handle('browser:wait-for', function (_e, selector, timeout) { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
        return [2 /*return*/, sendBrowserCommand({ type: 'waitForSelector', selector: selector, timeout: timeout !== null && timeout !== void 0 ? timeout : 10000 })];
    }); }); });
    electron_1.ipcMain.handle('browser:close', function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
        return [2 /*return*/, sendBrowserCommand({ type: 'close' })];
    }); }); });
}
// ─── Main window ─────────────────────────────────────────────────────
function createMainWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1180,
        height: 760,
        minWidth: 900,
        minHeight: 600,
        title: 'Rem Agent',
        icon: APP_ICON_PATH,
        webPreferences: {
            preload: (0, path_1.join)(__dirname, 'preload.cjs'),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false,
            webSecurity: false,
            webviewTag: true,
        },
        frame: true,
        backgroundColor: '#faf8f5',
        show: false,
    });
    mainWindow.once('ready-to-show', function () {
        mainWindow === null || mainWindow === void 0 ? void 0 : mainWindow.show();
        console.log('Main window shown');
    });
    if (isDev) {
        console.log('Loading Vite dev server:', VITE_DEV_URL);
        mainWindow.loadURL(VITE_DEV_URL);
        mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
    else {
        var exePath = electron_1.app.getAppPath();
        mainWindow.loadFile((0, path_1.join)(exePath, 'desktop', 'dist-renderer', 'index.html'));
    }
    mainWindow.on('closed', function () {
        mainWindow = null;
        if (process.platform !== 'darwin')
            electron_1.app.quit();
    });
    console.log('Main window created (dev=%s)', isDev);
}
// ─── App lifecycle ───────────────────────────────────────────────────
// Clear default menu so wizard/main window don't show File/Edit/View menus
electron_1.Menu.setApplicationMenu(null);
electron_1.app.whenReady().then(function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                registerIpcHandlers();
                return [4 /*yield*/, runWizardWindow()];
            case 1:
                _a.sent();
                if (isWizardCompleted()) {
                    createMainWindow();
                }
                else {
                    console.log('[main] waiting for wizard to complete…');
                    electron_1.ipcMain.on('wizard:done-signal', function () {
                        console.log('[main] wizard done, opening main window');
                        wizardWindow === null || wizardWindow === void 0 ? void 0 : wizardWindow.close();
                        wizardWindow = null;
                        createMainWindow();
                    });
                }
                return [2 /*return*/];
        }
    });
}); });
electron_1.app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
electron_1.app.on('activate', function () {
    if (electron_1.BrowserWindow.getAllWindows().length === 0) {
        if (isWizardCompleted()) {
            createMainWindow();
        }
        else {
            runWizardWindow();
        }
    }
});
console.log('Electron starting...');
