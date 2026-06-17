import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import { createPluginContext, PluginContext, PluginRouteDef, PluginToolDef } from "./plugin-context.js";
import { normalizePluginConfigSchema, PluginConfigSchema } from "./plugin-config.js";

// ── 类型定义 ─────────────────────────────────────────────────────────

export type PluginSource = "builtin" | "dev" | "community";

export interface PluginManifest {
  id: string;
  name?: string;
  version?: string;
  description?: string;
  author?: string;
  trust?: "restricted" | "full-access";
  minAppVersion?: string;
  contributes?: {
    configuration?: Record<string, unknown>;
  };
}

export interface PluginEntry {
  id: string;
  name: string;
  version: string;
  description: string;
  source: PluginSource;
  pluginKey: string; // `${source}:${id}`
  pluginDir: string;
  dataDir: string;
  manifest: PluginManifest | null;
  status: "loading" | "loaded" | "failed" | "disabled" | "unloaded";
  error: string | null;
  contributions: string[]; // 已注册的贡献点名称列表
  configSchema: PluginConfigSchema;
  ctx: PluginContext | null;
  instance: PluginInstance | null;
}

interface PluginInstance {
  onLoad?(): Promise<void> | void;
  onUnload?(): Promise<void> | void;
}

// ── 工具贡献 ─────────────────────────────────────────────────────────

export interface LoadedPluginTool {
  pluginId: string;
  pluginKey: string;
  name: string; // 完整名称：`plugin.<pluginId>.<toolName>`
  description: string;
  parameters: Record<string, unknown>;
  execute: (params: Record<string, unknown>) => Promise<unknown>;
}

// ── 路由贡献 ─────────────────────────────────────────────────────────

export interface LoadedPluginRoute {
  pluginId: string;
  pluginKey: string;
  method: string;
  path: string; // 完整路径：`/plugins/<pluginId>/<routePath>`
  /** 路径正则表达式（用于匹配带参数的路径） */
  pathRegex?: RegExp;
  /** 路径参数名列表（从 path 中解析，如 ["id"] 对于 "/users/:id"） */
  paramNames?: string[];
  description?: string;
  handler: (params: { body: unknown; query: Record<string, string>; headers: Record<string, string>; params: Record<string, string> }) => Promise<unknown> | unknown;
}

// ── PluginManager ─────────────────────────────────────────────────────

const PLUGIN_SOURCE_EXTS = [".ts", ".js"];
const KNOWN_CONTRIBUTION_DIRS = ["tools", "skills", "commands", "routes"];

export class PluginManager {
  private pluginsDirs: string[];
  private dataDir: string;
  private plugins: Map<string, PluginEntry> = new Map();
  private loadedTools: LoadedPluginTool[] = [];
  private loadedRoutes: LoadedPluginRoute[] = [];

  constructor(opts: { pluginsDirs: string[]; dataDir: string }) {
    this.pluginsDirs = opts.pluginsDirs;
    this.dataDir = opts.dataDir;
  }

  // ── 公开属性 ─────────────────────────────────────────────────────

  getPlugins(): PluginEntry[] {
    return [...this.plugins.values()];
  }

  getPlugin(pluginKey: string): PluginEntry | undefined {
    return this.plugins.get(pluginKey);
  }

  getLoadedTools(): LoadedPluginTool[] {
    return [...this.loadedTools];
  }

  getLoadedRoutes(): LoadedPluginRoute[] {
    return [...this.loadedRoutes];
  }

  // ── 扫描插件 ─────────────────────────────────────────────────────

  scan(): PluginEntry[] {
    const results: PluginEntry[] = [];
    const seen = new Set<string>();

    for (let i = 0; i < this.pluginsDirs.length; i++) {
      const dir = this.pluginsDirs[i];
      const source: PluginSource = i === 0 ? "builtin" : "community";
      if (!fs.existsSync(dir)) continue;

      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
        const dirKey = `${source}:${entry.name}`;
        if (seen.has(dirKey)) continue;
        seen.add(dirKey);

        const pluginDir = path.join(dir, entry.name);
        try {
          const desc = this._readPluginDescriptor(pluginDir, entry.name, source);
          results.push(desc);
        } catch (err: unknown) {
          console.warn(`Failed to read plugin "${entry.name}":`, (err as Error).message);
        }
      }
    }

    for (const desc of results) {
      this.plugins.set(desc.pluginKey, desc);
    }
    return results;
  }

  private _readPluginDescriptor(
    pluginDir: string,
    dirName: string,
    source: PluginSource
  ): PluginEntry {
    const manifestPath = path.join(pluginDir, "manifest.json");
    let manifest: PluginManifest | null = null;
    if (fs.existsSync(manifestPath)) {
      manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as PluginManifest;
    }

    const id = manifest?.id || dirName;
    const name = manifest?.name || dirName;
    const version = manifest?.version || "0.0.0";
    const description = manifest?.description || "";
    const pluginKey = `${source}:${id}`;
    const dataDir = this._pluginDataDir(source, id);

    const contributions: string[] = [];
    for (const dir of KNOWN_CONTRIBUTION_DIRS) {
      if (fs.existsSync(path.join(pluginDir, dir))) {
        contributions.push(dir);
      }
    }
    if (this._resolvePluginEntryPoint(pluginDir)) {
      contributions.push("lifecycle");
    }

    const configSchema = manifest?.contributes?.configuration
      ? normalizePluginConfigSchema(id, manifest.contributes.configuration)
      : normalizePluginConfigSchema(id, {});

    return {
      id,
      name,
      version,
      description,
      source,
      pluginKey,
      pluginDir,
      dataDir,
      manifest,
      status: "unloaded",
      error: null,
      contributions,
      configSchema,
      ctx: null,
      instance: null,
    };
  }

  private _pluginDataDir(source: PluginSource, pluginId: string): string {
    if (source === "dev") return path.join(this.dataDir, "dev", pluginId);
    return path.join(this.dataDir, pluginId);
  }

  private _resolvePluginEntryPoint(pluginDir: string): string | null {
    for (const ext of PLUGIN_SOURCE_EXTS) {
      const p = path.join(pluginDir, `index${ext}`);
      if (fs.existsSync(p)) return p;
    }
    return null;
  }

  // ── 加载插件 ─────────────────────────────────────────────────────

  async loadAll(): Promise<void> {
    const entries = this.scan();
    for (const entry of entries) {
      try {
        await this._loadPlugin(entry);
        entry.status = "loaded";
        entry.error = null;
      } catch (err: unknown) {
        entry.status = "failed";
        entry.error = (err as Error).message;
        console.error(`Plugin "${entry.id}" failed to load:`, (err as Error).message);
      }
    }
  }

  private async _loadPlugin(entry: PluginEntry): Promise<void> {
    const ctx = createPluginContext({
      pluginId: entry.id,
      pluginKey: entry.pluginKey,
      source: entry.source,
      pluginDir: entry.pluginDir,
      dataDir: entry.dataDir,
      schema: entry.configSchema,
      onRegisterTool: (toolDef: PluginToolDef) => this._handleDynamicTool(entry, toolDef),
      onRegisterRoute: (routeDef: PluginRouteDef) => this._handleDynamicRoute(entry, routeDef),
      logSink: (_entry: { pluginId: string; level: string; args: unknown[]; ts: string }) => {},
    });
    entry.ctx = ctx;

    if (entry.contributions.includes("tools")) {
      await this._loadTools(entry);
    }
    if (entry.contributions.includes("skills")) {
      await this._loadSkillPaths(entry);
    }
      if (entry.contributions.includes("commands")) {
        await this._loadCommands(entry);
      }
      if (entry.contributions.includes("routes")) {
        await this._loadRoutes(entry);
      }

      if (entry.contributions.includes("lifecycle")) {
      const entryPoint = this._resolvePluginEntryPoint(entry.pluginDir)!;
      const mod = await this._importModule(entryPoint) as Record<string, unknown>;
      const PluginClass = mod.default as new () => PluginInstance;
      if (PluginClass && typeof PluginClass === "function") {
        const instance = new PluginClass();
        entry.instance = instance;
        if (instance.onLoad) {
          await instance.onLoad();
        }
      } else if (typeof mod.onLoad === "function") {
        await (mod.onLoad as (ctx: PluginContext) => Promise<void> | void)(ctx);
      }
    }
  }

  // ── 工具加载 ─────────────────────────────────────────────────────

  private async _loadTools(entry: PluginEntry): Promise<void> {
    const toolsDir = path.join(entry.pluginDir, "tools");
    if (!fs.existsSync(toolsDir)) return;

    const files = fs.readdirSync(toolsDir).filter((f) => PLUGIN_SOURCE_EXTS.some((ext) => f.endsWith(ext)));
    for (const file of files) {
      const filePath = path.join(toolsDir, file);
      try {
        const mod = await this._importModule(filePath) as Record<string, unknown>;
        if (!mod.name || typeof mod.name !== "string") continue;
        const execute = mod.execute;
        if (!execute || typeof execute !== "function") {
          console.warn(`Plugin "${entry.id}" tool "${file}" missing execute`);
          continue;
        }
        const toolName = `plugin.${entry.id}.${mod.name}`;
        this.loadedTools.push({
          pluginId: entry.id,
          pluginKey: entry.pluginKey,
          name: toolName,
          description: typeof mod.description === "string" ? mod.description : "",
          parameters: (mod.parameters && typeof mod.parameters === "object" && !Array.isArray(mod.parameters))
            ? mod.parameters as Record<string, unknown>
            : { type: "object", properties: {} },
          execute: async (params: Record<string, unknown>) => {
            return await (execute as (params: Record<string, unknown>, ctx: PluginContext | null) => Promise<unknown>)(params, entry.ctx);
          },
        });
      } catch (err: unknown) {
        console.error(`Plugin "${entry.id}" failed to load tool "${file}":`, (err as Error).message);
      }
    }
  }

  private _handleDynamicTool(entry: PluginEntry, toolDef: PluginToolDef): () => void {
    const toolName = `plugin.${entry.id}.${toolDef.name}`;
    const tool: LoadedPluginTool = {
      pluginId: entry.id,
      pluginKey: entry.pluginKey,
      name: toolName,
      description: toolDef.description,
      parameters: toolDef.parameters || { type: "object", properties: {} },
      execute: async (params: Record<string, unknown>) => {
        return await toolDef.execute(params, entry.ctx!);
      },
    };
    this.loadedTools.push(tool);
    return () => {
      const idx = this.loadedTools.indexOf(tool);
      if (idx !== -1) this.loadedTools.splice(idx, 1);
    };
  }

  // ── 技能路径加载 ─────────────────────────────────────────────────

  private async _loadSkillPaths(_entry: PluginEntry): Promise<void> {
    const skillsDir = path.join(_entry.pluginDir, "skills");
    if (!fs.existsSync(skillsDir)) return;
    console.log(`Plugin "${_entry.id}" provides skills at ${skillsDir}`);
  }

  // ── 命令加载 ─────────────────────────────────────────────────────

  private async _loadCommands(_entry: PluginEntry): Promise<void> {
    const cmdsDir = path.join(_entry.pluginDir, "commands");
    if (!fs.existsSync(cmdsDir)) return;
    const files = fs.readdirSync(cmdsDir).filter((f) => PLUGIN_SOURCE_EXTS.some((ext) => f.endsWith(ext)));
    for (const file of files) {
      const filePath = path.join(cmdsDir, file);
      try {
        const mod = await this._importModule(filePath) as Record<string, unknown>;
        if (mod.name && typeof mod.name === "string" && typeof mod.execute === "function") {
          console.log(`Plugin "${_entry.id}" provides command "${mod.name}"`);
        }
      } catch (err: unknown) {
        console.error(`Plugin "${_entry.id}" failed to load command "${file}":`, (err as Error).message);
      }
    }
  }

  // ── 路由加载 ─────────────────────────────────────────────────────

  /**
   * 从路径中提取参数名列表
   * 如 "/users/:id/:name" → ["id", "name"]
   */
  private _extractParamNames(pathStr: string): string[] {
    const paramNames: string[] = [];
    const regex = /:([a-zA-Z_][a-zA-Z0-9_]*)/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(pathStr)) !== null) {
      paramNames.push(match[1]);
    }
    return paramNames;
  }

  /**
   * 将路径模式转换为正则表达式
   * 如 "/users/:id" → /^\/users\/([^/]+)$/
   */
  private _pathToRegex(pathStr: string): RegExp {
    const escaped = pathStr.replace(/:[a-zA-Z_][a-zA-Z0-9_]*/g, '([^/]+)');
    return new RegExp(`^${escaped}$`);
  }

  private async _loadRoutes(entry: PluginEntry): Promise<void> {
    const routesDir = path.join(entry.pluginDir, "routes");
    if (!fs.existsSync(routesDir)) return;

    const files = fs.readdirSync(routesDir).filter((f) => PLUGIN_SOURCE_EXTS.some((ext) => f.endsWith(ext)));
    for (const file of files) {
      const filePath = path.join(routesDir, file);
      try {
        const mod = await this._importModule(filePath) as Record<string, unknown>;
        if (!mod.path || typeof mod.path !== "string") continue;
        if (!mod.method || typeof mod.method !== "string") continue;
        if (!mod.handler || typeof mod.handler !== "function") {
          console.warn(`Plugin "${entry.id}" route "${file}" missing handler`);
          continue;
        }

        const routePath = mod.path as string;
        const fullPath = `/plugins/${entry.id}${routePath}`;
        const paramNames = this._extractParamNames(routePath);
        const pathRegex = this._pathToRegex(fullPath);

        this.loadedRoutes.push({
          pluginId: entry.id,
          pluginKey: entry.pluginKey,
          method: mod.method as string,
          path: fullPath,
          pathRegex,
          paramNames,
          description: typeof mod.description === "string" ? mod.description : undefined,
          handler: async (params: { body: unknown; query: Record<string, string>; headers: Record<string, string>; params: Record<string, string> }) => {
            return await (mod.handler as (params: { body: unknown; query: Record<string, string>; headers: Record<string, string>; params: Record<string, string> }) => Promise<unknown>)(params);
          },
        });
      } catch (err: unknown) {
        console.error(`Plugin "${entry.id}" failed to load route "${file}":`, (err as Error).message);
      }
    }
  }

  private _handleDynamicRoute(entry: PluginEntry, routeDef: PluginRouteDef): () => void {
    const fullPath = `/plugins/${entry.id}${routeDef.path}`;
    const route: LoadedPluginRoute = {
      pluginId: entry.id,
      pluginKey: entry.pluginKey,
      method: routeDef.method,
      path: fullPath,
      description: routeDef.description,
      handler: routeDef.handler,
    };
    this.loadedRoutes.push(route);
    return () => {
      const idx = this.loadedRoutes.indexOf(route);
      if (idx !== -1) this.loadedRoutes.splice(idx, 1);
    };
  }

  // ── 卸载插件 ─────────────────────────────────────────────────────

  async unloadPlugin(pluginKey: string): Promise<void> {
    const entry = this.plugins.get(pluginKey);
    if (!entry) throw new Error(`Plugin "${pluginKey}" not found`);
    if (entry.status !== "loaded") return;

    if (entry.instance?.onUnload) {
      try {
        await entry.instance.onUnload();
      } catch (err: unknown) {
        console.error(`Plugin "${entry.id}" onUnload error:`, (err as Error).message);
      }
    }

    this.loadedTools = this.loadedTools.filter((t) => t.pluginKey !== pluginKey);
    this.loadedRoutes = this.loadedRoutes.filter((r) => r.pluginKey !== pluginKey);
    entry.ctx = null;
    entry.instance = null;
    entry.status = "unloaded";
  }

  // ── 动态 import ─────────────────────────────────────────────────

  private async _importModule(filePath: string): Promise<Record<string, unknown>> {
    const url = pathToFileURL(filePath).href;
    const cacheBuster = `${url}?t=${Date.now()}`;
    return await import(cacheBuster) as Record<string, unknown>;
  }
}
