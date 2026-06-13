import { describe, it, expect, beforeEach } from 'vitest'
import { randomUUID } from 'crypto'

// We'll import from the built dist or directly from source
// For now, test the module structure

describe('Memory Store', () => {
  it('should export the correct API', async () => {
    const store = await import('../../../core/memory/store.js')
    expect(typeof store.addMemory).toBe('function')
    expect(typeof store.getRecentMemories).toBe('function')
    expect(typeof store.getMemoriesByType).toBe('function')
    expect(typeof store.accessMemory).toBe('function')
    expect(typeof store.getContextMemories).toBe('function')
    expect(typeof store.cleanupOldMemories).toBe('function')
  })

  it('should add and retrieve a memory', async () => {
    const { addMemory, getRecentMemories, getDb } = await import('../../../core/memory/store.js')

    // Clear test db
    const db = getDb()
    db.exec("DELETE FROM memories WHERE content LIKE '%test-memory-uuid%'")

    const mem = addMemory('test-memory-uuid-' + randomUUID(), 3, 'fact')
    expect(mem.id).toBeDefined()
    expect(mem.content).toContain('test-memory-uuid')
    expect(mem.importance).toBe(3)
    expect(mem.memory_type).toBe('fact')

    const recent = getRecentMemories(10)
    const found = recent.find(m => m.content === mem.content)
    expect(found).toBeDefined()
  })

  it('should filter memories by type', async () => {
    const { addMemory, getMemoriesByType, getDb } = await import('../../../core/memory/store.js')

    const db = getDb()
    db.exec("DELETE FROM memories WHERE content LIKE '%test-type-filter%'")

    addMemory('test-type-filter-conversation', 1, 'conversation')
    addMemory('test-type-filter-fact', 2, 'fact')
    addMemory('test-type-filter-preference', 3, 'preference')

    const facts = getMemoriesByType('fact', 10)
    const found = facts.find(m => m.content === 'test-type-filter-fact')
    expect(found).toBeDefined()
    expect(found?.memory_type).toBe('fact')
  })
})
