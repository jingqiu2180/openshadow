import { readFileSync, writeFileSync, existsSync, mkdirSync, accessSync } from 'fs'
import { join, dirname } from 'path'
import { homedir } from 'os'

export interface Config {
  version: string
  agent: {
    id: string
    name: string
    model: string
    apiKey: string
    baseUrl: string
  }
  channels: {
    feishu?: { appId: string; appSecret: string; webhook?: string }
    qq?: { appId: string; appSecret: string }
    wechat?: { corpId: string; secret: string }
  }
  storage: {
    path: string
    allowedPaths: string[]
  }
  security: {
    /** Enable OS-level sandbox (when available) */
    sandbox: boolean
    /** Workspace roots — FULL access (read/write/delete) */
    workspaceRoots: string[]
    /** Allow reading files outside workspace (read-only) */
    allowExternalReads: boolean
    /** Explicitly allowed writable paths (READ_WRITE access) */
    writablePaths: string[]
    allowedCommands: string[]
    blockedCommands: string[]
  }
  scheduler: {
    heartbeatInterval: number
    cleanupInterval: number
    summarizationInterval: number
  }
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error'
    file?: string
  }
  // ─── 7-step wizard fields (added in Stage 1a) ─────────────────────
  wizard?: {
    /** Whether the user has completed the first-launch wizard. */
    completed: boolean
    completedAt?: string
  }
  ui?: {
    language: 'zh-CN' | 'en' | 'ja' | 'ko'
  }
  user?: {
    name: string
  }
  memory?: {
    enabled: boolean
  }
  /** Multi-provider registry (replaces single agent.apiKey/baseUrl when present) */
  providers?: Provider[]
  /** Per-role model selection; each is a `${providerId}::${modelName}` ref */
  models?: {
    main: string
    small: string
    large: string
  }
  /** UI theme for the desktop renderer */
  theme?: 'warm-paper' | 'cool-night' | 'auto'
}

/**
 * Provider: a single LLM backend configuration.
 * - id: user-given alias (e.g. 'openai', 'minimax', 'local-ollama')
 * - type: protocol variant — 'openai' for OpenAI-compatible, 'gemini' for Google, 'ollama' for local
 * - apiKey/baseUrl: connection params
 * - models: curated list of model names available from this provider
 */
export interface Provider {
  id: string
  type: 'openai' | 'gemini' | 'ollama' | 'custom' | 'anthropic'
  apiKey: string
  baseUrl: string
  models: string[]
  isDefault?: boolean
}

const _home = homedir()
const _platform = process.platform
const _cwd = process.cwd()

function defaultWorkspaceRoots(): string[] {
  const roots: string[] = []
  // Always add CWD
  roots.push(_cwd)
  // Add common work directories if they exist
  const candidates = [
    _cwd,
    join(_home, 'Documents'),
    join(_home, 'Desktop'),
  ]
  for (const p of candidates) {
    try { accessSync(p); roots.push(p) } catch {}
  }
  // Windows: add D:\src if exists
  if (_platform === 'win32') {
    try { accessSync('D:\\src'); roots.push('D:\\src') } catch {}
  }
  return [...new Set(roots)] // deduplicate
}

const DEFAULT_CONFIG: Config = {
  version: '0.1.0',
  agent: {
    id: 'default',
    name: 'Rem',
    model: process.env.AGENT_MODEL ?? 'abab6.5s-chat',
    apiKey: '',
    baseUrl: 'https://api.openai.com/v1',
  },
  channels: {},
  storage: {
    path: './data',
    allowedPaths: [
      _cwd,
      _home,
      _platform === 'win32' ? undefined : '/tmp',
      ...(process.env.ALLOWED_PATHS?.split(',').map(p => p.trim()).filter(Boolean) ?? []),
    ].filter(Boolean) as string[],
  },
  security: {
    sandbox: true,
    workspaceRoots: defaultWorkspaceRoots(),
    allowExternalReads: true,
    writablePaths: [],
    allowedCommands: ['ls', 'cat', 'echo', 'mkdir', 'cd', 'node', 'npm', 'git', 'python', 'npx'],
    blockedCommands: ['rm -rf /', 'mkfs', 'dd if=/dev/zero'],
  },
  scheduler: {
    heartbeatInterval: 5 * 60 * 1000,
    cleanupInterval: 24 * 60 * 60 * 1000,
    summarizationInterval: 24 * 60 * 60 * 1000,
  },
  logging: {
    level: 'info',
  },
  // ─── Wizard defaults (Stage 1a) ─────────────────────────────
  // Note: providers/models/user/ui/theme are intentionally NOT in defaults.
  // They're populated by the wizard OR fall back to env vars (see getActiveProvider).
  wizard: {
    completed: false,
  },
  ui: {
    language: 'zh-CN' as const,
  },
  user: {
    name: '王帅',
  },
  memory: {
    enabled: true,
  },
  theme: 'warm-paper' as const,
}

/**
 * Config manager — loads config.json with defaults merge.
 *
 * To add workspace roots: edit config.json → security.workspaceRoots
 * First run: if config.json missing, a default with auto-detected paths is created.
 */
export class ConfigManager {
  private config: Config
  private configPath: string
  private isFirstRun: boolean = false

  constructor(configPath?: string) {
    this.configPath = configPath ?? join(process.cwd(), 'config.json')
    this.isFirstRun = !existsSync(this.configPath)
    this.config = this.load()
  }

  isFirstRunDetected(): boolean {
    return this.isFirstRun
  }

  private load(): Config {
    if (existsSync(this.configPath)) {
      try {
        const content = readFileSync(this.configPath, 'utf-8')
        const parsed = JSON.parse(content)
        // Merge deeply: defaults < saved config
        return this.mergeConfig(DEFAULT_CONFIG, parsed)
      } catch {
        return { ...DEFAULT_CONFIG }
      }
    }
    // First run: create default config with auto-detected paths
    const cfg = { ...DEFAULT_CONFIG }
    this.save(cfg)
    return cfg
  }

  private mergeConfig(base: Config, override: any): Config {
    return {
      ...base,
      ...override,
      agent: { ...base.agent, ...override.agent },
      channels: { ...base.channels, ...override.channels },
      storage: { ...base.storage, ...override.storage },
      security: { ...base.security, ...override.security },
      scheduler: { ...base.scheduler, ...override.scheduler },
      logging: { ...base.logging, ...override.logging },
      // New wizard fields (Stage 1a) — deep merge where shape is object
      wizard: { ...base.wizard, ...override.wizard },
      ui: { ...base.ui, ...override.ui },
      user: { ...base.user, ...override.user },
      memory: { ...base.memory, ...override.memory },
      models: { ...base.models, ...override.models },
      // providers is an array — override fully (no merge)
      providers: override.providers ?? base.providers,
      // theme is a string — override fully
      theme: override.theme ?? base.theme,
    }
  }

  save(cfg?: Config): void {
    const dir = dirname(this.configPath)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    const toSave = cfg ?? this.config
    writeFileSync(this.configPath, JSON.stringify(toSave, null, 2), 'utf-8')
    if (cfg) this.config = cfg
  }

  get<K extends keyof Config>(key: K): Config[K] {
    return this.config[key]
  }

  set<K extends keyof Config>(key: K, value: Config[K]): void {
    this.config[key] = value
    this.save()
  }

  getAgent() {
    return this.config.agent
  }

  setApiKey(key: string): void {
    this.config.agent.apiKey = key
    this.save()
  }

  // ─── Wizard / multi-provider helpers (Stage 1a) ────────────
  getProviders(): Provider[] {
    return this.config.providers ?? []
  }

  /**
   * Resolve the active provider for a given role.
   *
   * Selection priority:
   *   1. If `models[role]` is set (e.g. 'openai::gpt-4o'), split on '::' and find provider by id
   *   2. If `providers[].isDefault === true`, use that
   *   3. Fallback: synthesize a provider from `agent.{apiKey,baseUrl,model}` (the legacy single-provider path)
   *   4. Last resort: env vars AGENT_API_KEY / AGENT_BASE_URL / AGENT_MODEL
   *
   * Returns null only if absolutely nothing is configured.
   */
  getActiveProvider(role: 'main' | 'small' | 'large' = 'main'): Provider | null {
    const providers = this.getProviders()
    const roleRef = this.config.models?.[role]

    // 1. Explicit role reference
    if (roleRef) {
      const [pid, mname] = roleRef.split('::')
      const p = providers.find(x => x.id === pid)
      if (p) {
        return mname ? { ...p, models: [mname, ...p.models] } : p
      }
    }

    // 2. isDefault flag
    const def = providers.find(p => p.isDefault)
    if (def) return def

    // 3. Legacy single-provider (agent.* fields)
    const a = this.config.agent
    if (a.apiKey || a.baseUrl) {
      return {
        id: 'default',
        type: 'openai',
        apiKey: a.apiKey,
        baseUrl: a.baseUrl,
        models: [a.model],
        isDefault: true,
      }
    }

    // 4. Env vars
    if (process.env.AGENT_API_KEY) {
      return {
        id: 'env',
        type: 'openai',
        apiKey: process.env.AGENT_API_KEY,
        baseUrl: process.env.AGENT_BASE_URL ?? 'https://api.openai.com/v1',
        models: [process.env.AGENT_MODEL ?? 'gpt-4'],
        isDefault: true,
      }
    }

    return null
  }

  getUserName(): string {
    return this.config.user?.name ?? '王帅'
  }

  isMemoryEnabled(): boolean {
    return this.config.memory?.enabled ?? true
  }

  getLanguage(): 'zh-CN' | 'en' | 'ja' | 'ko' {
    return this.config.ui?.language ?? 'zh-CN'
  }

  getTheme(): 'warm-paper' | 'cool-night' | 'auto' {
    return this.config.theme ?? 'warm-paper'
  }

  isWizardCompleted(): boolean {
    return this.config.wizard?.completed ?? false
  }

  markWizardCompleted(): void {
    if (!this.config.wizard) this.config.wizard = { completed: false }
    this.config.wizard.completed = true
    this.config.wizard.completedAt = new Date().toISOString()
    this.save()
  }

  getChannels() {
    return this.config.channels
  }

  getStorage() {
    return this.config.storage
  }

  getSecurity() {
    return this.config.security
  }

  getLogging() {
    return this.config.logging
  }

  /** Get PathGuard policy from current config */
  getPathGuardPolicy(remuHome: string, agentDir: string) {
    const sec = this.config.security
    return {
      mode: sec.sandbox ? 'restricted' as const : 'full-access' as const,
      remuHome,
      agentDir,
      workspaceRoots: sec.workspaceRoots,
      writablePaths: sec.writablePaths,
      allowExternalReads: sec.allowExternalReads,
    }
  }

  reset(): void {
    this.config = { ...DEFAULT_CONFIG }
    this.save()
  }
}

export function createConfigManager(configPath?: string): ConfigManager {
  return new ConfigManager(configPath)
}

export const config = createConfigManager()
