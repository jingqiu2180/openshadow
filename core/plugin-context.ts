import { createPluginConfigStore, PluginConfigSchema } from "./plugin-config.js";

/**
 * 插件路由定义 —— 插件通过此接口注册 HTTP 端点。
 *
 * 路径参数支持：在 path 中使用 `:paramName` 语法，如 `/users/:id`。
 * 参数会通过 `params.params` 传递给 handler。
 */
export interface PluginRouteDef {
  /** HTTP 方法 */
  method: "get" | "post" | "put" | "delete" | "patch";
  /** 路径（相对于插件前缀，如 "/status" 会挂载到 "/plugins/<pluginId>/status"）
   *  支持路径参数：如 "/users/:id"
   */
  path: string;
  /** 路由描述（用于生成 OpenAPI 文档） */
  description?: string;
  /** 请求参数 Schema（可选，用于验证） */
  requestSchema?: Record<string, unknown>;
  /** 处理函数 */
  handler: (params: { body: unknown; query: Record<string, string>; headers: Record<string, string>; params: Record<string, string> }) => Promise<unknown> | unknown;
}

/**
 * 插件上下文 —— 插件开发者通过此对象访问 remu 运行时。
 */
export interface PluginContext {
  pluginId: string;
  pluginKey: string;
  source: "builtin" | "dev" | "community";
  pluginDir: string;
  dataDir: string;

  /** 插件私有配置 */
  config: PluginContextConfig;

  /** 日志（带插件前缀） */
  log: PluginLogger;

  /**
   * 动态注册工具（供插件 onLoad 中调用）。
   * 返回 dispose 函数，调用即移除该工具。
   */
  registerTool(toolDef: PluginToolDef): () => void;

  /** 运行时只读信息 */
  runtime: PluginRuntimeInfo;

  /**
   * 注册 HTTP 路由（供插件 onLoad 中调用）。
   * 路由会挂载到 `/plugins/<pluginId>/<path>`。
   * 返回 dispose 函数，调用即移除该路由。
   */
  registerRoute(routeDef: PluginRouteDef): () => void;
}

export interface PluginContextConfig {
  get(key?: string): unknown;
  getAll(options?: { redacted?: boolean }): Record<string, unknown>;
  set(key: string, value: unknown): void;
  setMany(values: Record<string, unknown>): Record<string, unknown>;
  getSchema(): PluginConfigSchema;
}

export interface PluginLogger {
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
  debug(...args: unknown[]): void;
}

export interface PluginToolDef {
  name: string;
  description: string;
  parameters?: Record<string, unknown>;
  execute: (params: Record<string, unknown>, ctx: PluginContext) => Promise<unknown> | unknown;
}

export interface PluginRuntimeInfo {
  version: string;
  pluginApiVersion: string;
}

// ── 实现 ────────────────────────────────────────────────────────────────

export interface CreatePluginContextOpts {
  pluginId: string;
  pluginKey: string;
  source: "builtin" | "dev" | "community";
  pluginDir: string;
  dataDir: string;
  schema?: PluginConfigSchema;
  /** PluginManager 注入：动态注册工具 */
  onRegisterTool?: (toolDef: PluginToolDef) => () => void;
  /** PluginManager 注入：动态注册路由 */
  onRegisterRoute?: (routeDef: PluginRouteDef) => () => void;
  logSink?: (entry: { pluginId: string; level: string; args: unknown[]; ts: string }) => void;
}

export function createPluginContext(opts: CreatePluginContextOpts): PluginContext {
  const { pluginId, pluginKey, source, pluginDir, dataDir, schema, onRegisterTool, onRegisterRoute, logSink } = opts;

  // 1. 配置存储
  const configStore = createPluginConfigStore({ dataDir, schema: schema ?? { pluginId, type: "object", properties: {} } });

  const config: PluginContextConfig = {
    get(key?: string): unknown {
      return key ? configStore.get(key) : configStore.getAll();
    },
    getAll(options?: { redacted?: boolean }): Record<string, unknown> {
      return configStore.getAll(options);
    },
    set(key: string, value: unknown): void {
      configStore.set(key, value);
    },
    setMany(values: Record<string, unknown>): Record<string, unknown> {
      return configStore.setMany(values);
    },
    getSchema(): PluginConfigSchema {
      return configStore.getSchema();
    },
  };

  // 2. 日志
  const prefix = `[plugin:${pluginId}]`;
  const log: PluginLogger = {
    info(...args: unknown[]): void {
      console.log(prefix, ...args);
      logSink?.({ pluginId, level: "info", args, ts: new Date().toISOString() });
    },
    warn(...args: unknown[]): void {
      console.warn(prefix, ...args);
      logSink?.({ pluginId, level: "warn", args, ts: new Date().toISOString() });
    },
    error(...args: unknown[]): void {
      console.error(prefix, ...args);
      logSink?.({ pluginId, level: "error", args, ts: new Date().toISOString() });
    },
    debug(...args: unknown[]): void {
      if (process.env.DEBUG_PLUGINS) {
        console.debug(prefix, ...args);
        logSink?.({ pluginId, level: "debug", args, ts: new Date().toISOString() });
      }
    },
  };

  // 3. 上下文对象
  const ctx: PluginContext = {
    pluginId,
    pluginKey,
    source,
    pluginDir,
    dataDir,
    config,
    log,
    registerTool(toolDef: PluginToolDef): () => void {
      if (!onRegisterTool) {
        log.warn("registerTool called but no handler is registered in PluginManager");
        return () => {};
      }
      return onRegisterTool(toolDef);
    },
    registerRoute(routeDef: PluginRouteDef): () => void {
      if (!onRegisterRoute) {
        log.warn("registerRoute called but no handler is registered in PluginManager");
        return () => {};
      }
      return onRegisterRoute(routeDef);
    },
    runtime: {
      version: "0.1.0",
      pluginApiVersion: "1.0.0",
    },
  };

  return ctx;
}
