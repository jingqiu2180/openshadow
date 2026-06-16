import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { existsSync, mkdirSync, rmSync } from 'fs'
import { join } from 'path'
import { SessionStore, estimateTokens } from '../../core/session-store.js'

const TEST_DIR = join(process.cwd(), 'data', 'test-sessions')

describe('SessionStore', () => {
  let store: SessionStore

  beforeEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true })
    mkdirSync(TEST_DIR, { recursive: true })
    store = new SessionStore(TEST_DIR)
  })

  afterEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true })
  })

  it('should create a session', () => {
    const session = store.create('gpt-4', 'Test Session')
    expect(session.id).toBeDefined()
    expect(session.title).toBe('Test Session')
    expect(session.model).toBe('gpt-4')
    expect(session.messages).toEqual([])
    expect(session.createdAt).toBeGreaterThan(0)
  })

  it('should load a saved session', () => {
    const created = store.create('gpt-4', 'Test')
    const loaded = store.load(created.id)
    expect(loaded).not.toBeNull()
    expect(loaded!.id).toBe(created.id)
    expect(loaded!.title).toBe('Test')
  })

  it('should return null for non-existent session', () => {
    expect(store.load('nonexistent')).toBeNull()
  })

  it('should delete a session', () => {
    const session = store.create('gpt-4', 'To Delete')
    expect(store.delete(session.id)).toBe(true)
    expect(store.load(session.id)).toBeNull()
  })

  it('should return false when deleting non-existent session', () => {
    expect(store.delete('nonexistent')).toBe(false)
  })

  it('should list sessions sorted by updatedAt', () => {
    const s1 = store.create('gpt-4', 'First')
    const s2 = store.create('gpt-4', 'Second')
    store.addMessage(s1.id, { role: 'user', content: 'hello' })

    const list = store.list()
    expect(list.length).toBe(2)
    expect(list[0].id).toBe(s1.id)
  })

  it('should add messages to a session', () => {
    const session = store.create('gpt-4', 'Chat')
    const updated = store.addMessage(session.id, { role: 'user', content: 'Hello' })
    expect(updated).not.toBeNull()
    expect(updated!.messages.length).toBe(1)
    expect(updated!.messages[0].role).toBe('user')
    expect(updated!.messages[0].content).toBe('Hello')
    expect(updated!.messages[0].timestamp).toBeGreaterThan(0)
  })

  it('should return null when adding message to non-existent session', () => {
    expect(store.addMessage('nonexistent', { role: 'user', content: 'hi' })).toBeNull()
  })

  it('should get messages with limit', () => {
    const session = store.create('gpt-4', 'Chat')
    store.addMessage(session.id, { role: 'user', content: '1' })
    store.addMessage(session.id, { role: 'assistant', content: '2' })
    store.addMessage(session.id, { role: 'user', content: '3' })

    const msgs = store.getMessages(session.id, 2)
    expect(msgs.length).toBe(2)
    expect(msgs[0].content).toBe('2')
    expect(msgs[1].content).toBe('3')
  })

  it('should return empty array for non-existent session messages', () => {
    expect(store.getMessages('nonexistent')).toEqual([])
  })

  it('should detect when compaction is needed', () => {
    const session = store.create('gpt-4', 'Chat')
    const longContent = 'x'.repeat(150000)
    store.addMessage(session.id, { role: 'user', content: longContent })
    store.addMessage(session.id, { role: 'assistant', content: longContent })
    store.addMessage(session.id, { role: 'user', content: longContent })

    expect(store.needsCompaction(session.id)).toBe(true)
  })

  it('should detect when compaction is not needed', () => {
    const session = store.create('gpt-4', 'Chat')
    store.addMessage(session.id, { role: 'user', content: 'Hello' })
    expect(store.needsCompaction(session.id)).toBe(false)
  })

  it('should return false for needsCompaction on non-existent session', () => {
    expect(store.needsCompaction('nonexistent')).toBe(false)
  })

  it('should update summary', () => {
    const session = store.create('gpt-4', 'Chat')
    store.updateSummary(session.id, 'This is a summary')
    const loaded = store.load(session.id)
    expect(loaded!.summary).toBe('This is a summary')
  })

  it('should cap messages at MAX_MESSAGES', () => {
    const session = store.create('gpt-4', 'Chat')
    for (let i = 0; i < 250; i++) {
      store.addMessage(session.id, { role: 'user', content: `msg ${i}` })
    }
    const loaded = store.load(session.id)
    expect(loaded!.messages.length).toBeLessThanOrEqual(200)
  })
})

describe('estimateTokens', () => {
  it('should estimate tokens for messages', () => {
    const tokens = estimateTokens([
      { role: 'user', content: 'Hello world', timestamp: Date.now() },
    ])
    expect(tokens).toBeGreaterThan(0)
  })

  it('should include tool call tokens', () => {
    const tokens = estimateTokens([
      {
        role: 'assistant',
        content: 'Let me check',
        timestamp: Date.now(),
        toolCalls: [{ name: 'bash', args: { cmd: 'ls -la' } }],
      },
    ])
    expect(tokens).toBeGreaterThan(0)
  })

  it('should return 0 for empty messages', () => {
    expect(estimateTokens([])).toBe(0)
  })
})
