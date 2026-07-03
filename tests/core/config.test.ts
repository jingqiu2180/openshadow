// @ts-nocheck
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { existsSync, writeFileSync, unlinkSync, mkdirSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { ConfigManager } from '../../core/config.js'

describe('ConfigManager', () => {
  let configPath: string

  beforeEach(() => {
    configPath = join(tmpdir(), `openshadow-test-config-${Date.now()}.json`)
    if (existsSync(configPath)) unlinkSync(configPath)
  })

  afterEach(() => {
    if (existsSync(configPath)) unlinkSync(configPath)
  })

  it('should create default config on first run', () => {
    const mgr = new ConfigManager(configPath)
    expect(mgr.isFirstRunDetected()).toBe(true)
    expect(existsSync(configPath)).toBe(true)

    const agent = mgr.getAgent()
    expect(agent.id).toBe('default')
    expect(agent.name).toBe('Shadow')
  })

  it('should load existing config', () => {
    writeFileSync(configPath, JSON.stringify({
      version: '0.2.0',
      agent: { id: 'custom', name: 'TestBot', model: 'gpt-4', apiKey: 'sk-test', baseUrl: 'https://test.api' },
    }), 'utf-8')

    const mgr = new ConfigManager(configPath)
    expect(mgr.isFirstRunDetected()).toBe(false)
    expect(mgr.getAgent().id).toBe('custom')
    expect(mgr.getAgent().name).toBe('TestBot')
  })

  it('should merge with defaults for missing fields', () => {
    writeFileSync(configPath, JSON.stringify({
      agent: { id: 'partial' },
    }), 'utf-8')

    const mgr = new ConfigManager(configPath)
    expect(mgr.getAgent().id).toBe('partial')
    expect(mgr.getAgent().name).toBe('Shadow')
    expect(mgr.getAgent().model).toBe('abab6.5s-chat')
  })

  it('should get and set config values', () => {
    const mgr = new ConfigManager(configPath)

    mgr.set('version', '1.0.0')
    expect(mgr.get('version')).toBe('1.0.0')

    mgr.setApiKey('sk-new-key')
    expect(mgr.getAgent().apiKey).toBe('sk-new-key')
  })

  it('should get security config', () => {
    const mgr = new ConfigManager(configPath)
    const sec = mgr.getSecurity()
    expect(sec.sandbox).toBe(true)
    expect(sec.allowedCommands).toContain('ls')
    expect(sec.blockedCommands).toContain('rm -rf /')
  })

  it('should get storage config', () => {
    const mgr = new ConfigManager(configPath)
    const storage = mgr.getStorage()
    expect(storage.path).toBe('./data')
    expect(Array.isArray(storage.allowedPaths)).toBe(true)
  })

  it('should get logging config', () => {
    const mgr = new ConfigManager(configPath)
    const logging = mgr.getLogging()
    expect(logging.level).toBe('info')
  })

  it('should get channels config', () => {
    const mgr = new ConfigManager(configPath)
    const channels = mgr.getChannels()
    expect(channels).toBeDefined()
  })

  it('should get user name', () => {
    const mgr = new ConfigManager(configPath)
    expect(mgr.getUserName()).toBe('王帅')
  })

  it('should get language', () => {
    const mgr = new ConfigManager(configPath)
    expect(mgr.getLanguage()).toBe('zh-CN')
  })

  it('should get theme', () => {
    const mgr = new ConfigManager(configPath)
    expect(mgr.getTheme()).toBe('warm-paper')
  })

  it('should check memory enabled', () => {
    const mgr = new ConfigManager(configPath)
    expect(mgr.isMemoryEnabled()).toBe(true)
  })

  it('should check wizard not completed by default', () => {
    const mgr = new ConfigManager(configPath)
    expect(mgr.isWizardCompleted()).toBe(false)
  })

  it('should mark wizard completed', () => {
    const mgr = new ConfigManager(configPath)
    mgr.markWizardCompleted()
    expect(mgr.isWizardCompleted()).toBe(true)
  })

  it('should get providers', () => {
    const mgr = new ConfigManager(configPath)
    const providers = mgr.getProviders()
    expect(Array.isArray(providers)).toBe(true)
  })

  it('should get active provider from legacy config', () => {
    writeFileSync(configPath, JSON.stringify({
      agent: { apiKey: 'sk-legacy', baseUrl: 'https://legacy.api', model: 'legacy-model' },
    }), 'utf-8')

    const mgr = new ConfigManager(configPath)
    const provider = mgr.getActiveProvider('main')
    expect(provider).not.toBeNull()
    expect(provider!.id).toBe('default')
    expect(provider!.apiKey).toBe('sk-legacy')
    expect(provider!.models).toContain('legacy-model')
  })

  it('should get active provider from providers list', () => {
    writeFileSync(configPath, JSON.stringify({
      providers: [
        { id: 'openai', type: 'openai', apiKey: 'sk-openai', baseUrl: 'https://api.openai.com/v1', models: ['gpt-4'], isDefault: true },
        { id: 'gemini', type: 'gemini', apiKey: 'ai-gemini', baseUrl: 'https://generativelanguage.googleapis.com', models: ['gemini-pro'] },
      ],
    }), 'utf-8')

    const mgr = new ConfigManager(configPath)
    const provider = mgr.getActiveProvider('main')
    expect(provider).not.toBeNull()
    expect(provider!.id).toBe('openai')
    expect(provider!.isDefault).toBe(true)
  })

  it('should get active provider by role reference', () => {
    writeFileSync(configPath, JSON.stringify({
      providers: [
        { id: 'openai', type: 'openai', apiKey: 'sk-openai', baseUrl: 'https://api.openai.com/v1', models: ['gpt-4'] },
        { id: 'gemini', type: 'gemini', apiKey: 'ai-gemini', baseUrl: 'https://generativelanguage.googleapis.com', models: ['gemini-pro'] },
      ],
      models: { main: 'gemini::gemini-pro', small: 'openai::gpt-4', large: 'openai::gpt-4' },
    }), 'utf-8')

    const mgr = new ConfigManager(configPath)
    const mainProvider = mgr.getActiveProvider('main')
    expect(mainProvider!.id).toBe('gemini')

    const smallProvider = mgr.getActiveProvider('small')
    expect(smallProvider!.id).toBe('openai')
  })

  it('should return null when no provider configured', () => {
    writeFileSync(configPath, JSON.stringify({
      agent: { apiKey: '', baseUrl: '' },
    }), 'utf-8')

    const mgr = new ConfigManager(configPath)
    const provider = mgr.getActiveProvider('main')
    expect(provider).toBeNull()
  })

  it('should get path guard policy', () => {
    const mgr = new ConfigManager(configPath)
    const policy = mgr.getPathGuardPolicy('/home/openshadow', '/home/openshadow/agents/test')
    expect(policy.mode).toBe('restricted')
    expect(policy.openshadowHome).toBe('/home/openshadow')
    expect(policy.agentDir).toBe('/home/openshadow/agents/test')
    expect(Array.isArray(policy.workspaceRoots)).toBe(true)
  })

  it('should reset config', () => {
    const mgr = new ConfigManager(configPath)
    mgr.set('version', '9.9.9')
    mgr.reset()
    expect(mgr.get('version')).toBe('0.1.0')
  })

  it('should handle corrupted config file gracefully', () => {
    writeFileSync(configPath, 'not valid json {{{', 'utf-8')
    const mgr = new ConfigManager(configPath)
    expect(mgr.getAgent().id).toBe('default')
  })
})
