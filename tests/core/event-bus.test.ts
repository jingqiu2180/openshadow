import { describe, it, expect, vi } from 'vitest'
import { EventBus } from '../../core/event-bus.js'

describe('EventBus', () => {
  it('should subscribe and receive events', async () => {
    const bus = new EventBus()
    const handler = vi.fn()
    bus.on('chat:message', handler)

    await bus.emit('chat:message', { sessionId: 's1', role: 'user', content: 'hello' })

    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenCalledWith({ sessionId: 's1', role: 'user', content: 'hello' })
  })

  it('should support multiple subscribers for same event', async () => {
    const bus = new EventBus()
    const h1 = vi.fn()
    const h2 = vi.fn()
    bus.on('tool:call', h1)
    bus.on('tool:call', h2)

    await bus.emit('tool:call', { name: 'bash', args: { cmd: 'ls' }, sessionId: 's1' })

    expect(h1).toHaveBeenCalledTimes(1)
    expect(h2).toHaveBeenCalledTimes(1)
  })

  it('should not call handlers for different events', async () => {
    const bus = new EventBus()
    const handler = vi.fn()
    bus.on('chat:message', handler)

    await bus.emit('tool:call', { name: 'bash', args: {}, sessionId: 's1' })

    expect(handler).not.toHaveBeenCalled()
  })

  it('should support once() - handler called only once', async () => {
    const bus = new EventBus()
    const handler = vi.fn()
    bus.once('chat:complete', handler)

    await bus.emit('chat:complete', { sessionId: 's1', content: 'done', latencyMs: 100 })
    await bus.emit('chat:complete', { sessionId: 's1', content: 'done2', latencyMs: 200 })

    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('should support unsubscribe via returned function', async () => {
    const bus = new EventBus()
    const handler = vi.fn()
    const unsub = bus.on('chat:message', handler)

    unsub()
    await bus.emit('chat:message', { sessionId: 's1', role: 'user', content: 'hello' })

    expect(handler).not.toHaveBeenCalled()
  })

  it('should support wildcard handlers via onAny', async () => {
    const bus = new EventBus()
    const handler = vi.fn()
    bus.onAny(handler)

    await bus.emit('chat:message', { sessionId: 's1', role: 'user', content: 'hello' })
    await bus.emit('tool:call', { name: 'bash', args: {}, sessionId: 's1' })

    expect(handler).toHaveBeenCalledTimes(2)
    expect(handler).toHaveBeenCalledWith({ event: 'chat:message', data: { sessionId: 's1', role: 'user', content: 'hello' } })
    expect(handler).toHaveBeenCalledWith({ event: 'tool:call', data: { name: 'bash', args: {}, sessionId: 's1' } })
  })

  it('should count listeners correctly', () => {
    const bus = new EventBus()
    expect(bus.listenerCount()).toBe(0)

    bus.on('chat:message', vi.fn())
    bus.on('chat:message', vi.fn())
    bus.on('tool:call', vi.fn())

    expect(bus.listenerCount('chat:message')).toBe(2)
    expect(bus.listenerCount('tool:call')).toBe(1)
    expect(bus.listenerCount()).toBe(3)
  })

  it('should remove all listeners for a specific event', async () => {
    const bus = new EventBus()
    const h1 = vi.fn()
    const h2 = vi.fn()
    bus.on('chat:message', h1)
    bus.on('tool:call', h2)

    bus.removeAllListeners('chat:message')
    await bus.emit('chat:message', { sessionId: 's1', role: 'user', content: 'hello' })
    await bus.emit('tool:call', { name: 'bash', args: {}, sessionId: 's1' })

    expect(h1).not.toHaveBeenCalled()
    expect(h2).toHaveBeenCalledTimes(1)
  })

  it('should remove all listeners', async () => {
    const bus = new EventBus()
    const h1 = vi.fn()
    const h2 = vi.fn()
    bus.on('chat:message', h1)
    bus.on('tool:call', h2)

    bus.removeAllListeners()
    await bus.emit('chat:message', { sessionId: 's1', role: 'user', content: 'hello' })
    await bus.emit('tool:call', { name: 'bash', args: {}, sessionId: 's1' })

    expect(h1).not.toHaveBeenCalled()
    expect(h2).not.toHaveBeenCalled()
  })

  it('should handle errors in handlers gracefully', async () => {
    const bus = new EventBus()
    const badHandler = vi.fn().mockRejectedValue(new Error('boom'))
    const goodHandler = vi.fn()
    bus.on('chat:message', badHandler)
    bus.on('chat:message', goodHandler)

    await bus.emit('chat:message', { sessionId: 's1', role: 'user', content: 'hello' })

    expect(badHandler).toHaveBeenCalledTimes(1)
    expect(goodHandler).toHaveBeenCalledTimes(1)
  })

  it('should support off by id', async () => {
    const bus = new EventBus()
    const handler = vi.fn()
    const sub = bus.on('chat:message', handler)

    bus.off('sub_1')
    await bus.emit('chat:message', { sessionId: 's1', role: 'user', content: 'hello' })

    expect(handler).not.toHaveBeenCalled()
  })
})
