import { describe, it, expect } from 'vitest'
import { ToolRegistry, createToolSpec } from '../../core/tool-registry.js'

describe('ToolRegistry', () => {
  it('should register and retrieve a tool', () => {
    const registry = new ToolRegistry()
    const spec = createToolSpec('test_tool', {
      description: 'A test tool',
      params: { input: { type: 'string', description: 'Input text' } },
    })
    const handler = async (args: { input: string }) => `Result: ${args.input}`

    registry.register('test_tool', spec, handler)

    expect(registry.has('test_tool')).toBe(true)
    expect(registry.get('test_tool')).toBeDefined()
    expect(registry.get('test_tool')!.spec).toBe(spec)
    expect(registry.get('test_tool')!.handler).toBe(handler)
  })

  it('should return undefined for non-existent tool', () => {
    const registry = new ToolRegistry()
    expect(registry.get('nonexistent')).toBeUndefined()
    expect(registry.has('nonexistent')).toBe(false)
  })

  it('should list all registered tool names', () => {
    const registry = new ToolRegistry()
    const spec = createToolSpec('tool_a', { description: 'A', params: {} })
    registry.register('tool_a', spec, async () => {})
    registry.register('tool_b', spec, async () => {})

    expect(registry.list()).toEqual(['tool_a', 'tool_b'])
  })

  it('should get all tool specs', () => {
    const registry = new ToolRegistry()
    const specA = createToolSpec('tool_a', { description: 'A', params: {} })
    const specB = createToolSpec('tool_b', { description: 'B', params: {} })
    registry.register('tool_a', specA, async () => {})
    registry.register('tool_b', specB, async () => {})

    const specs = registry.getSpecs()
    expect(specs.length).toBe(2)
    expect(specs).toContain(specA)
    expect(specs).toContain(specB)
  })

  it('should get handler by name', () => {
    const registry = new ToolRegistry()
    const handler = async () => 'done'
    const spec = createToolSpec('my_tool', { description: 'Test', params: {} })
    registry.register('my_tool', spec, handler)

    expect(registry.getHandler('my_tool')).toBe(handler)
    expect(registry.getHandler('nonexistent')).toBeUndefined()
  })

  it('should remove a tool', () => {
    const registry = new ToolRegistry()
    const spec = createToolSpec('temp', { description: 'Temp', params: {} })
    registry.register('temp', spec, async () => {})

    expect(registry.remove('temp')).toBe(true)
    expect(registry.has('temp')).toBe(false)
    expect(registry.remove('temp')).toBe(false)
  })

  it('should clear all tools', () => {
    const registry = new ToolRegistry()
    const spec = createToolSpec('a', { description: 'A', params: {} })
    registry.register('a', spec, async () => {})
    registry.register('b', spec, async () => {})

    registry.clear()
    expect(registry.size()).toBe(0)
    expect(registry.list()).toEqual([])
  })

  it('should merge another registry', () => {
    const r1 = new ToolRegistry()
    const r2 = new ToolRegistry()
    const spec = createToolSpec('shared', { description: 'Shared', params: {} })

    r1.register('tool1', spec, async () => '1')
    r2.register('tool2', spec, async () => '2')

    r1.merge(r2)
    expect(r1.has('tool1')).toBe(true)
    expect(r1.has('tool2')).toBe(true)
    expect(r1.size()).toBe(2)
  })

  it('should overwrite on merge conflict', async () => {
    const r1 = new ToolRegistry()
    const r2 = new ToolRegistry()
    const spec = createToolSpec('dup', { description: 'Dup', params: {} })

    r1.register('dup', spec, async () => 'original')
    r2.register('dup', spec, async () => 'overwritten')

    r1.merge(r2)
    const handler = r1.getHandler('dup')
    const result = await handler!({})
    expect(result).toBe('overwritten')
  })

  it('should register via registerEntry', () => {
    const registry = new ToolRegistry()
    const spec = createToolSpec('entry_tool', { description: 'Entry', params: {} })
    const handler = async () => 'entry'

    registry.registerEntry('entry_tool', { spec, handler })
    expect(registry.has('entry_tool')).toBe(true)
  })

  it('should report correct size', () => {
    const registry = new ToolRegistry()
    expect(registry.size()).toBe(0)

    const spec = createToolSpec('t', { description: 'T', params: {} })
    registry.register('t', spec, async () => {})
    expect(registry.size()).toBe(1)
  })
})

describe('createToolSpec', () => {
  it('should create a valid ToolSpec', () => {
    const spec = createToolSpec('my_func', {
      description: 'Does something',
      params: {
        name: { type: 'string', description: 'User name' },
        age: { type: 'number', description: 'User age', optional: true },
      },
    })

    expect(spec.type).toBe('function')
    expect(spec.function.name).toBe('my_func')
    expect(spec.function.description).toBe('Does something')
    expect(spec.function.parameters.type).toBe('object')
    expect(spec.function.parameters.properties).toHaveProperty('name')
    expect(spec.function.parameters.properties).toHaveProperty('age')
    expect(spec.function.parameters.required).toEqual(['name'])
  })

  it('should mark all params as required when no optional flag', () => {
    const spec = createToolSpec('func', {
      description: 'Test',
      params: {
        a: { type: 'string', description: 'A' },
        b: { type: 'string', description: 'B' },
      },
    })

    expect(spec.function.parameters.required).toEqual(['a', 'b'])
  })
})
