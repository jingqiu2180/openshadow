import { config, type Provider } from './config.js'
import { createClient, pickModel, isOpenAICompatible } from './providers/index.js'
import { EventBus } from './event-bus.js'
import type OpenAI from 'openai'

export interface ModelInfo {
  providerId: string
  modelName: string
  providerType: string
  contextWindow: number
  supportsVision: boolean
  supportsTools: boolean
  supportsStreaming: boolean
}

export interface ModelCapability {
  contextWindow: number
  supportsVision: boolean
  supportsTools: boolean
  supportsStreaming: boolean
  maxOutputTokens: number
}

export interface ProviderHealth {
  providerId: string
  healthy: boolean
  latencyMs: number
  error?: string
  checkedAt: number
}

const KNOWN_MODEL_CAPABILITIES: Record<string, ModelCapability> = {
  'gpt-4': { contextWindow: 8192, supportsVision: false, supportsTools: true, supportsStreaming: true, maxOutputTokens: 4096 },
  'gpt-4-turbo': { contextWindow: 128000, supportsVision: true, supportsTools: true, supportsStreaming: true, maxOutputTokens: 4096 },
  'gpt-4o': { contextWindow: 128000, supportsVision: true, supportsTools: true, supportsStreaming: true, maxOutputTokens: 16384 },
  'gpt-4o-mini': { contextWindow: 128000, supportsVision: true, supportsTools: true, supportsStreaming: true, maxOutputTokens: 16384 },
  'gpt-3.5-turbo': { contextWindow: 16385, supportsVision: false, supportsTools: true, supportsStreaming: true, maxOutputTokens: 4096 },
  'claude-3-opus': { contextWindow: 200000, supportsVision: true, supportsTools: true, supportsStreaming: true, maxOutputTokens: 4096 },
  'claude-3-sonnet': { contextWindow: 200000, supportsVision: true, supportsTools: true, supportsStreaming: true, maxOutputTokens: 4096 },
  'claude-3-haiku': { contextWindow: 200000, supportsVision: true, supportsTools: true, supportsStreaming: true, maxOutputTokens: 4096 },
  'claude-3.5-sonnet': { contextWindow: 200000, supportsVision: true, supportsTools: true, supportsStreaming: true, maxOutputTokens: 8192 },
  'gemini-2.0-flash': { contextWindow: 1048576, supportsVision: true, supportsTools: true, supportsStreaming: true, maxOutputTokens: 8192 },
  'gemini-1.5-pro': { contextWindow: 2097152, supportsVision: true, supportsTools: true, supportsStreaming: true, maxOutputTokens: 8192 },
  'gemini-1.5-flash': { contextWindow: 1048576, supportsVision: true, supportsTools: true, supportsStreaming: true, maxOutputTokens: 8192 },
  'deepseek-chat': { contextWindow: 65536, supportsVision: false, supportsTools: true, supportsStreaming: true, maxOutputTokens: 8192 },
  'deepseek-reasoner': { contextWindow: 65536, supportsVision: false, supportsTools: true, supportsStreaming: true, maxOutputTokens: 8192 },
  'abab6.5s-chat': { contextWindow: 245760, supportsVision: false, supportsTools: true, supportsStreaming: true, maxOutputTokens: 4096 },
  'qwen-turbo': { contextWindow: 131072, supportsVision: false, supportsTools: true, supportsStreaming: true, maxOutputTokens: 8192 },
  'qwen-plus': { contextWindow: 131072, supportsVision: false, supportsTools: true, supportsStreaming: true, maxOutputTokens: 8192 },
  'qwen-max': { contextWindow: 32768, supportsVision: false, supportsTools: true, supportsStreaming: true, maxOutputTokens: 8192 },
  'llama3.1:8b': { contextWindow: 131072, supportsVision: false, supportsTools: true, supportsStreaming: true, maxOutputTokens: 4096 },
  'llama3.1:70b': { contextWindow: 131072, supportsVision: false, supportsTools: true, supportsStreaming: true, maxOutputTokens: 4096 },
}

const DEFAULT_CAPABILITY: ModelCapability = {
  contextWindow: 8192,
  supportsVision: false,
  supportsTools: true,
  supportsStreaming: true,
  maxOutputTokens: 4096,
}

export class ModelManager {
  private clients = new Map<string, OpenAI>()
  private healthCache = new Map<string, ProviderHealth>()
  private eventBus: EventBus

  constructor(eventBus?: EventBus) {
    this.eventBus = eventBus ?? new EventBus()
  }

  listModels(): ModelInfo[] {
    const providers = config.getProviders()
    const models: ModelInfo[] = []

    for (const provider of providers) {
      for (const modelName of provider.models) {
        const cap = this.getCapability(modelName)
        models.push({
          providerId: provider.id,
          modelName,
          providerType: provider.type,
          contextWindow: cap.contextWindow,
          supportsVision: cap.supportsVision,
          supportsTools: cap.supportsTools,
          supportsStreaming: cap.supportsStreaming,
        })
      }
    }

    return models
  }

  getModelsForProvider(providerId: string): ModelInfo[] {
    const provider = config.getProviders().find(p => p.id === providerId)
    if (!provider) return []

    return provider.models.map(modelName => {
      const cap = this.getCapability(modelName)
      return {
        providerId: provider.id,
        modelName,
        providerType: provider.type,
        contextWindow: cap.contextWindow,
        supportsVision: cap.supportsVision,
        supportsTools: cap.supportsTools,
        supportsStreaming: cap.supportsStreaming,
      }
    })
  }

  getCapability(modelName: string): ModelCapability {
    const lowerName = modelName.toLowerCase()

    const sortedKeys = Object.keys(KNOWN_MODEL_CAPABILITIES).sort((a, b) => b.length - a.length)
    for (const key of sortedKeys) {
      if (lowerName.includes(key.toLowerCase())) {
        return KNOWN_MODEL_CAPABILITIES[key]
      }
    }

    return { ...DEFAULT_CAPABILITY }
  }

  resolveModel(role: 'main' | 'small' | 'large' = 'main'): { provider: Provider; modelName: string } {
    const provider = config.getActiveProvider(role)
    if (!provider) {
      throw new Error(`No provider configured for role '${role}'`)
    }
    const modelName = pickModel(provider)
    return { provider, modelName }
  }

  getClient(provider: Provider): OpenAI {
    const key = `${provider.id}::${provider.baseUrl}`
    if (!this.clients.has(key)) {
      this.clients.set(key, createClient(provider))
    }
    return this.clients.get(key)!
  }

  invalidateClient(providerId: string): void {
    for (const [key] of this.clients) {
      if (key.startsWith(providerId)) {
        this.clients.delete(key)
      }
    }
  }

  async healthCheck(providerId: string): Promise<ProviderHealth> {
    const provider = config.getProviders().find(p => p.id === providerId)
    if (!provider) {
      return {
        providerId,
        healthy: false,
        latencyMs: 0,
        error: `Provider '${providerId}' not found`,
        checkedAt: Date.now(),
      }
    }

    const start = Date.now()
    try {
      if (isOpenAICompatible(provider.type)) {
        const client = this.getClient(provider)
        const modelName = provider.models[0]
        if (!modelName) {
          throw new Error('No models configured')
        }
        await client.models.retrieve(modelName)
      }

      const latencyMs = Date.now() - start
      const health: ProviderHealth = {
        providerId,
        healthy: true,
        latencyMs,
        checkedAt: Date.now(),
      }
      this.healthCache.set(providerId, health)
      return health
    } catch (e: any) {
      const latencyMs = Date.now() - start
      const health: ProviderHealth = {
        providerId,
        healthy: false,
        latencyMs,
        error: e.message,
        checkedAt: Date.now(),
      }
      this.healthCache.set(providerId, health)
      return health
    }
  }

  async healthCheckAll(): Promise<ProviderHealth[]> {
    const providers = config.getProviders()
    const results = await Promise.all(
      providers.map(p => this.healthCheck(p.id)),
    )
    return results
  }

  getHealthCache(providerId: string): ProviderHealth | undefined {
    return this.healthCache.get(providerId)
  }

  getHealthyProviders(): Provider[] {
    const providers = config.getProviders()
    return providers.filter(p => {
      const health = this.healthCache.get(p.id)
      return health?.healthy ?? true
    })
  }

  switchModel(role: 'main' | 'small' | 'large', providerId: string, modelName: string): void {
    const ref = `${providerId}::${modelName}`
    const currentModels = config.get('models') ?? { main: '', small: '', large: '' }
    config.set('models', { ...currentModels, [role]: ref })
    this.eventBus.emit('provider:call', { providerId, model: modelName, latencyMs: 0 })
  }

  getEventBus(): EventBus {
    return this.eventBus
  }
}

export function createModelManager(eventBus?: EventBus): ModelManager {
  return new ModelManager(eventBus)
}

export const modelManager = createModelManager()
