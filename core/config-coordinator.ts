import { ConfigManager, config, type Provider } from './config.js'
import { EventBus } from './event-bus.js'
import { modelManager } from './model-manager.js'

export interface ConfigValidationError {
  field: string
  message: string
}

export interface ConfigSnapshot {
  version: string
  providerCount: number
  modelCount: number
  rolesConfigured: string[]
  sandboxEnabled: boolean
  memoryEnabled: boolean
  language: string
  theme: string
  wizardCompleted: boolean
}

export class ConfigCoordinator {
  private manager: ConfigManager
  private eventBus: EventBus

  constructor(manager?: ConfigManager, eventBus?: EventBus) {
    this.manager = manager ?? config
    this.eventBus = eventBus ?? new EventBus()
  }

  getManager(): ConfigManager {
    return this.manager
  }

  validate(): ConfigValidationError[] {
    const errors: ConfigValidationError[] = []
    const providers = this.manager.getProviders()

    if (providers.length === 0) {
      const agent = this.manager.getAgent()
      if (!agent.apiKey) {
        errors.push({
          field: 'providers',
          message: 'No providers configured and no legacy API key set. Run the wizard or add a provider.',
        })
      }
    }

    for (const provider of providers) {
      if (!provider.apiKey) {
        errors.push({
          field: `providers.${provider.id}.apiKey`,
          message: `Provider '${provider.id}' has no API key`,
        })
      }
      if (provider.models.length === 0) {
        errors.push({
          field: `providers.${provider.id}.models`,
          message: `Provider '${provider.id}' has no models configured`,
        })
      }
    }

    const models = this.manager.get('models')
    if (models) {
      for (const [role, ref] of Object.entries(models)) {
        if (!ref) continue
        const [pid] = ref.split('::')
        if (!providers.find(p => p.id === pid)) {
          errors.push({
            field: `models.${role}`,
            message: `Role '${role}' references provider '${pid}' which does not exist`,
          })
        }
      }
    }

    const sec = this.manager.getSecurity()
    if (sec.sandbox && sec.workspaceRoots.length === 0) {
      errors.push({
        field: 'security.workspaceRoots',
        message: 'Sandbox is enabled but no workspace roots are configured',
      })
    }

    return errors
  }

  snapshot(): ConfigSnapshot {
    const providers = this.manager.getProviders()
    const models = this.manager.get('models')

    return {
      version: this.manager.get('version'),
      providerCount: providers.length,
      modelCount: providers.reduce((sum, p) => sum + p.models.length, 0),
      rolesConfigured: models
        ? Object.entries(models).filter(([, v]) => !!v).map(([k]) => k)
        : [],
      sandboxEnabled: this.manager.getSecurity().sandbox,
      memoryEnabled: this.manager.isMemoryEnabled(),
      language: this.manager.getLanguage(),
      theme: this.manager.getTheme(),
      wizardCompleted: this.manager.isWizardCompleted(),
    }
  }

  resolveModelForRole(role: 'main' | 'small' | 'large'): { provider: Provider; modelName: string } {
    return modelManager.resolveModel(role)
  }

  addProvider(provider: Provider): void {
    const providers = [...this.manager.getProviders()]
    const existing = providers.findIndex(p => p.id === provider.id)
    if (existing >= 0) {
      providers[existing] = provider
    } else {
      providers.push(provider)
    }
    this.manager.set('providers', providers)
    this.eventBus.emit('plugin:load', { pluginId: `provider:${provider.id}` })
  }

  removeProvider(providerId: string): boolean {
    const providers = this.manager.getProviders()
    const filtered = providers.filter(p => p.id !== providerId)
    if (filtered.length === providers.length) return false
    this.manager.set('providers', filtered)
    modelManager.invalidateClient(providerId)
    return true
  }

  setModelForRole(role: 'main' | 'small' | 'large', providerId: string, modelName: string): void {
    modelManager.switchModel(role, providerId, modelName)
  }

  setTheme(theme: 'warm-paper' | 'cool-night' | 'auto'): void {
    this.manager.set('theme', theme)
  }

  setLanguage(lang: 'zh-CN' | 'en' | 'ja' | 'ko'): void {
    this.manager.set('ui', { ...this.manager.get('ui'), language: lang })
  }

  setUserName(name: string): void {
    this.manager.set('user', { ...this.manager.get('user'), name })
  }

  getUserName(): string {
    return this.manager.getUserName()
  }

  isFirstRun(): boolean {
    return this.manager.isFirstRunDetected()
  }

  markWizardCompleted(): void {
    this.manager.markWizardCompleted()
  }

  getEventBus(): EventBus {
    return this.eventBus
  }
}

export function createConfigCoordinator(manager?: ConfigManager, eventBus?: EventBus): ConfigCoordinator {
  return new ConfigCoordinator(manager, eventBus)
}

export const configCoordinator = createConfigCoordinator()
