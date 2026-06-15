import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'

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
  scheduler: {
    heartbeatInterval: number
    cleanupInterval: number
    summarizationInterval: number
  }
  security: {
    allowedCommands: string[]
    blockedCommands: string[]
  }
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error'
    file?: string
  }
}

const DEFAULT_CONFIG: Config = {
  version: '0.1.0',
  agent: {
    id: 'default',
    name: 'Rem',
    model: 'gpt-4',
    apiKey: '',
    baseUrl: 'https://api.openai.com/v1',
  },
  channels: {},
  storage: {
    path: './data',
    allowedPaths: ['/tmp', process.cwd()],
  },
  scheduler: {
    heartbeatInterval: 5 * 60 * 1000,
    cleanupInterval: 24 * 60 * 60 * 1000,
    summarizationInterval: 24 * 60 * 60 * 1000,
  },
  security: {
    allowedCommands: ['ls', 'cat', 'echo', 'mkdir', 'cd'],
    blockedCommands: ['rm -rf /', 'mkfs', 'dd if=/dev/zero'],
  },
  logging: {
    level: 'info',
  },
}

/**
 * Config manager - load/save config from JSON file.
 */
export class ConfigManager {
  private config: Config
  private configPath: string

  constructor(configPath?: string) {
    this.configPath = configPath ?? join(process.cwd(), 'config.json')
    this.config = this.load()
  }

  private load(): Config {
    if (existsSync(this.configPath)) {
      try {
        const content = readFileSync(this.configPath, 'utf-8')
        return { ...DEFAULT_CONFIG, ...JSON.parse(content) }
      } catch {
        return { ...DEFAULT_CONFIG }
      }
    }
    return { ...DEFAULT_CONFIG }
  }

  save(): void {
    const dir = dirname(this.configPath)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8')
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

  getChannels() {
    return this.config.channels
  }

  getStorage() {
    return this.config.storage
  }

  getLogging() {
    return this.config.logging
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