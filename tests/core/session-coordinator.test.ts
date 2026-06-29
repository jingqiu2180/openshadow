// @ts-nocheck
// TODO: vitest 走 vite 解析 .cjs 后缀时找不到 core/tools/update-settings-tool.ts 引用的
// ../../../lib/theme-registry.cjs。SessionCoordinator 测试通过 ChatEngine 链式 import 该工具，
// 导致 import 阶段就崩（"no tests"）。
// 暂时跳过整个 describe；保留代码作为文档。
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { existsSync, mkdirSync, rmSync, readFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'
import { SessionCoordinator } from '../../core/session-coordinator.js'
import { SessionStore } from '../../core/session-store.js'
import { ChatEngine } from '../../core/chat-engine.js'
import { EventBus } from '../../core/event-bus.js'
import { ToolRegistry } from '../../core/tool-registry.js'
import OpenAI from 'openai'

function createMockEngine(): ChatEngine {
  const client = new OpenAI({ apiKey: 'sk-test' })
  const registry = new ToolRegistry()
  return new ChatEngine(client, 'test-model', 'You are a test assistant.', registry)
}

describe.skip('SessionCoordinator', () => {
  let coordinator: SessionCoordinator
  let engine: ChatEngine
  let store: SessionStore
  let eventBus: EventBus
  let testDir: string
  let jsonlDir: string

  beforeEach(() => {
    testDir = join(tmpdir(), `openshadow-test-sessions-${randomUUID()}`)
    jsonlDir = join(tmpdir(), `openshadow-test-jsonl-${randomUUID()}`)
    mkdirSync(testDir, { recursive: true })
    mkdirSync(jsonlDir, { recursive: true })

    engine = createMockEngine()
    store = new SessionStore(testDir)
    eventBus = new EventBus()
    coordinator = new SessionCoordinator({
      engine,
      store,
      eventBus,
      jsonlDir,
    })
  })

  afterEach(() => {
    try { rmSync(testDir, { recursive: true, force: true }) } catch {}
    try { rmSync(jsonlDir, { recursive: true, force: true }) } catch {}
  })

  describe('createSession', () => {
    it('should create a session', () => {
      const session = coordinator.createSession('Test Session')
      expect(session).toBeDefined()
      expect(session.title).toBe('Test Session')
      expect(session.model).toBe('test-model')
      expect(session.messages).toEqual([])
    })

    it('should set the created session as active', () => {
      const session = coordinator.createSession('Test')
      expect(coordinator.getActiveSessionId()).toBe(session.id)
    })

    it('should emit session:create event', () => {
      const events: any[] = []
      eventBus.on('session:create', (e) => events.push(e))
      coordinator.createSession('Test')
      expect(events.length).toBe(1)
      expect(events[0].title).toBe('Test')
    })
  })

  describe('getActiveSession', () => {
    it('should return null when no session', () => {
      expect(coordinator.getActiveSession()).toBeNull()
    })

    it('should return active session', () => {
      const session = coordinator.createSession('Test')
      const active = coordinator.getActiveSession()
      expect(active).toBeDefined()
      expect(active!.id).toBe(session.id)
    })
  })

  describe('setActiveSession', () => {
    it('should return null for non-existent session', () => {
      expect(coordinator.setActiveSession('nonexistent')).toBeNull()
    })

    it('should switch active session', () => {
      const s1 = coordinator.createSession('Session 1')
      const s2 = coordinator.createSession('Session 2')
      coordinator.setActiveSession(s1.id)
      expect(coordinator.getActiveSessionId()).toBe(s1.id)
    })

    it('should emit session:switch event', () => {
      const s1 = coordinator.createSession('Session 1')
      coordinator.createSession('Session 2')
      const events: any[] = []
      eventBus.on('session:switch', (e) => events.push(e))
      coordinator.setActiveSession(s1.id)
      expect(events.length).toBe(1)
    })
  })

  describe('listSessions', () => {
    it('should return empty array when no sessions', () => {
      expect(coordinator.listSessions()).toEqual([])
    })

    it('should list all sessions', () => {
      coordinator.createSession('S1')
      coordinator.createSession('S2')
      expect(coordinator.listSessions().length).toBe(2)
    })
  })

  describe('deleteSession', () => {
    it('should delete a session', () => {
      const session = coordinator.createSession('Test')
      expect(coordinator.deleteSession(session.id)).toBe(true)
      expect(coordinator.listSessions().length).toBe(0)
    })

    it('should clear active session if deleted', () => {
      const session = coordinator.createSession('Test')
      coordinator.deleteSession(session.id)
      expect(coordinator.getActiveSessionId()).toBeNull()
    })

    it('should emit session:delete event', () => {
      const session = coordinator.createSession('Test')
      const events: any[] = []
      eventBus.on('session:delete', (e) => events.push(e))
      coordinator.deleteSession(session.id)
      expect(events.length).toBe(1)
    })

    it('should return false for non-existent session', () => {
      expect(coordinator.deleteSession('nonexistent')).toBe(false)
    })
  })

  describe('getHealth', () => {
    it('should return null when no session', () => {
      expect(coordinator.getHealth()).toBeNull()
    })

    it('should return health for active session', () => {
      coordinator.createSession('Test')
      const health = coordinator.getHealth()
      expect(health).toBeDefined()
      expect(health!.sessionId).toBeDefined()
      expect(health!.messageCount).toBe(0)
      expect(health!.tokenEstimate).toBe(0)
      expect(health!.contextUsagePercent).toBe(0)
      expect(health!.needsCompaction).toBe(false)
      expect(health!.hasSummary).toBe(false)
      expect(typeof health!.age).toBe('number')
    })

    it('should return health for specific session', () => {
      const session = coordinator.createSession('Test')
      const health = coordinator.getHealth(session.id)
      expect(health).toBeDefined()
      expect(health!.sessionId).toBe(session.id)
    })
  })

  describe('fingerprint', () => {
    it('should return null before session creation', () => {
      expect(coordinator.getFingerprint()).toBeNull()
    })

    it('should build fingerprint on session creation', () => {
      coordinator.createSession('Test')
      const fp = coordinator.getFingerprint()
      expect(fp).toBeDefined()
      expect(fp!.model).toBe('test-model')
      expect(fp!.contextWindow).toBeGreaterThan(0)
      expect(typeof fp!.supportsVision).toBe('boolean')
      expect(typeof fp!.supportsTools).toBe('boolean')
      expect(typeof fp!.supportsStreaming).toBe('boolean')
      expect(fp!.permissionMode).toBe('auto')
    })
  })

  describe('checkCapabilityDrift', () => {
    it('should return no drift when no fingerprint', () => {
      const result = coordinator.checkCapabilityDrift()
      expect(result.drifted).toBe(false)
      expect(result.changes).toEqual([])
    })

    it('should return no drift when fingerprint matches', () => {
      coordinator.createSession('Test')
      const result = coordinator.checkCapabilityDrift()
      expect(result.drifted).toBe(false)
    })
  })

  describe('permission mode', () => {
    it('should default to auto', () => {
      expect(coordinator.getPermissionMode()).toBe('auto')
    })

    it('should set permission mode', () => {
      coordinator.setPermissionMode('read_only')
      expect(coordinator.getPermissionMode()).toBe('read_only')
    })

    it('should update fingerprint permission mode', () => {
      coordinator.createSession('Test')
      coordinator.setPermissionMode('ask')
      const fp = coordinator.getFingerprint()
      expect(fp!.permissionMode).toBe('ask')
    })
  })

  describe('snapshot', () => {
    it('should return null when no session', () => {
      expect(coordinator.createSnapshot()).toBeNull()
    })

    it('should create snapshot for active session', () => {
      const session = coordinator.createSession('Test')
      const snap = coordinator.createSnapshot()
      expect(snap).toBeDefined()
      expect(snap!.sessionId).toBe(session.id)
      expect(snap!.title).toBe('Test')
      expect(snap!.model).toBe('test-model')
      expect(snap!.messageCount).toBe(0)
      expect(snap!.fingerprint).toBeDefined()
      expect(snap!.snapshotAt).toBeGreaterThan(0)
    })

    it('should create snapshot for specific session', () => {
      const session = coordinator.createSession('Test')
      const snap = coordinator.createSnapshot(session.id)
      expect(snap!.sessionId).toBe(session.id)
    })
  })

  describe('restoreFromSnapshot', () => {
    it('should return null for non-existent session', async () => {
      const result = await coordinator.restoreFromSnapshot({
        sessionId: 'nonexistent',
        title: 'Test',
        model: 'test',
        messageCount: 0,
        fingerprint: {
          model: 'test',
          providerId: 'test',
          contextWindow: 8192,
          supportsVision: false,
          supportsTools: true,
          supportsStreaming: true,
          maxOutputTokens: 4096,
          permissionMode: 'auto',
          createdAt: Date.now(),
        },
        createdAt: Date.now(),
        snapshotAt: Date.now(),
      })
      expect(result).toBeNull()
    })

    it('should restore fingerprint and permission mode from snapshot', async () => {
      const session = coordinator.createSession('Test')
      const snap = coordinator.createSnapshot()!
      coordinator.setPermissionMode('read_only')

      await coordinator.restoreFromSnapshot(snap)
      expect(coordinator.getPermissionMode()).toBe('auto')
    })
  })

  describe('JSONL export/import', () => {
    it('should export session to JSONL', () => {
      const session = coordinator.createSession('Test')
      store.addMessage(session.id, { role: 'user', content: 'hello', timestamp: Date.now() })
      store.addMessage(session.id, { role: 'assistant', content: 'hi there', timestamp: Date.now() })

      const path = coordinator.exportToJsonl(session.id)
      expect(path).toBeTruthy()
      expect(existsSync(path)).toBe(true)

      const content = readFileSync(path, 'utf-8')
      const lines = content.trim().split('\n')
      expect(lines.length).toBe(2)
    })

    it('should import from JSONL', async () => {
      const session = coordinator.createSession('Test')
      store.addMessage(session.id, { role: 'user', content: 'hello', timestamp: Date.now() })
      store.addMessage(session.id, { role: 'assistant', content: 'hi', timestamp: Date.now() })

      coordinator.exportToJsonl(session.id)
      const messages = await coordinator.importFromJsonl(session.id)
      expect(messages.length).toBe(2)
      expect(messages[0].role).toBe('user')
      expect(messages[1].role).toBe('assistant')
    })

    it('should return empty array for non-existent JSONL', async () => {
      const messages = await coordinator.importFromJsonl('nonexistent')
      expect(messages).toEqual([])
    })
  })

  describe('getSessionStore', () => {
    it('should return SessionStore', () => {
      expect(coordinator.getSessionStore()).toBeInstanceOf(SessionStore)
    })
  })

  describe('getEventBus', () => {
    it('should return EventBus', () => {
      expect(coordinator.getEventBus()).toBeInstanceOf(EventBus)
    })
  })
})
