import { describe, it, expect, beforeEach } from 'vitest'
import { ConfigCoordinator, createConfigCoordinator } from '../../core/config-coordinator.js'
import { ConfigManager } from '../../core/config.js'
import { EventBus } from '../../core/event-bus.js'

describe('ConfigCoordinator', () => {
  let coordinator: ConfigCoordinator

  beforeEach(() => {
    coordinator = createConfigCoordinator()
  })

  describe('getManager', () => {
    it('should return a ConfigManager instance', () => {
      expect(coordinator.getManager()).toBeInstanceOf(ConfigManager)
    })
  })

  describe('validate', () => {
    it('should return validation errors array', () => {
      const errors = coordinator.validate()
      expect(Array.isArray(errors)).toBe(true)
    })
  })

  describe('snapshot', () => {
    it('should return a config snapshot', () => {
      const snap = coordinator.snapshot()
      expect(snap).toHaveProperty('version')
      expect(snap).toHaveProperty('providerCount')
      expect(snap).toHaveProperty('modelCount')
      expect(snap).toHaveProperty('rolesConfigured')
      expect(snap).toHaveProperty('sandboxEnabled')
      expect(snap).toHaveProperty('memoryEnabled')
      expect(snap).toHaveProperty('language')
      expect(snap).toHaveProperty('theme')
      expect(snap).toHaveProperty('wizardCompleted')
    })

    it('should have correct types for snapshot fields', () => {
      const snap = coordinator.snapshot()
      expect(typeof snap.version).toBe('string')
      expect(typeof snap.providerCount).toBe('number')
      expect(typeof snap.modelCount).toBe('number')
      expect(Array.isArray(snap.rolesConfigured)).toBe(true)
      expect(typeof snap.sandboxEnabled).toBe('boolean')
      expect(typeof snap.memoryEnabled).toBe('boolean')
      expect(typeof snap.language).toBe('string')
      expect(typeof snap.theme).toBe('string')
      expect(typeof snap.wizardCompleted).toBe('boolean')
    })
  })

  describe('addProvider / removeProvider', () => {
    it('should add a provider', () => {
      coordinator.addProvider({
        id: 'test-provider',
        type: 'openai',
        apiKey: 'sk-test',
        baseUrl: 'https://api.test.com/v1',
        models: ['test-model'],
      })

      const providers = coordinator.getManager().getProviders()
      expect(providers.some(p => p.id === 'test-provider')).toBe(true)
    })

    it('should update existing provider', () => {
      coordinator.addProvider({
        id: 'test-provider',
        type: 'openai',
        apiKey: 'sk-test',
        baseUrl: 'https://api.test.com/v1',
        models: ['test-model'],
      })

      coordinator.addProvider({
        id: 'test-provider',
        type: 'openai',
        apiKey: 'sk-updated',
        baseUrl: 'https://api.test.com/v1',
        models: ['test-model', 'test-model-2'],
      })

      const providers = coordinator.getManager().getProviders()
      const p = providers.find(p => p.id === 'test-provider')
      expect(p?.apiKey).toBe('sk-updated')
      expect(p?.models.length).toBe(2)
    })

    it('should remove a provider', () => {
      coordinator.addProvider({
        id: 'test-provider',
        type: 'openai',
        apiKey: 'sk-test',
        baseUrl: 'https://api.test.com/v1',
        models: ['test-model'],
      })

      const removed = coordinator.removeProvider('test-provider')
      expect(removed).toBe(true)

      const providers = coordinator.getManager().getProviders()
      expect(providers.some(p => p.id === 'test-provider')).toBe(false)
    })

    it('should return false when removing non-existent provider', () => {
      expect(coordinator.removeProvider('nonexistent')).toBe(false)
    })
  })

  describe('setModelForRole', () => {
    it('should set model for a role', () => {
      coordinator.addProvider({
        id: 'test-provider',
        type: 'openai',
        apiKey: 'sk-test',
        baseUrl: 'https://api.test.com/v1',
        models: ['test-model'],
      })

      expect(() => coordinator.setModelForRole('main', 'test-provider', 'test-model')).not.toThrow()
    })
  })

  describe('setTheme', () => {
    it('should set theme', () => {
      coordinator.setTheme('cool-night')
      expect(coordinator.getManager().getTheme()).toBe('cool-night')
    })
  })

  describe('setLanguage', () => {
    it('should set language', () => {
      coordinator.setLanguage('en')
      expect(coordinator.getManager().getLanguage()).toBe('en')
    })
  })

  describe('setUserName / getUserName', () => {
    it('should set and get user name', () => {
      coordinator.setUserName('TestUser')
      expect(coordinator.getUserName()).toBe('TestUser')
    })
  })

  describe('isFirstRun', () => {
    it('should return boolean', () => {
      expect(typeof coordinator.isFirstRun()).toBe('boolean')
    })
  })

  describe('markWizardCompleted', () => {
    it('should mark wizard as completed', () => {
      coordinator.markWizardCompleted()
      expect(coordinator.getManager().isWizardCompleted()).toBe(true)
    })
  })

  describe('getEventBus', () => {
    it('should return an EventBus instance', () => {
      expect(coordinator.getEventBus()).toBeInstanceOf(EventBus)
    })
  })

  describe('custom EventBus injection', () => {
    it('should use provided EventBus', () => {
      const bus = new EventBus()
      const coord = new ConfigCoordinator(undefined, bus)
      expect(coord.getEventBus()).toBe(bus)
    })
  })
})
