export type EventHandler<T = any> = (event: T) => void | Promise<void>

export interface EventMap {
  'chat:message': { sessionId: string; role: string; content: string }
  'chat:stream-delta': { sessionId: string; chunk: string }
  'chat:complete': { sessionId: string; content: string; latencyMs: number }
  'chat:error': { sessionId: string; error: Error }
  'tool:call': { name: string; args: Record<string, unknown>; sessionId: string }
  'tool:result': { name: string; result: any; durationMs: number }
  'tool:error': { name: string; error: Error }
  'memory:add': { id: string; content: string; type: string }
  'memory:search': { query: string; resultCount: number }
  'memory:compact': { sessionId: string; beforeCount: number; afterCount: number }
  'session:create': { sessionId: string; title: string }
  'session:delete': { sessionId: string }
  'session:switch': { sessionId: string }
  'provider:call': { providerId: string; model: string; latencyMs: number }
  'provider:error': { providerId: string; error: Error }
  'sandbox:violation': { path: string; operation: string; agentId: string }
  'agent:start': { agentId: string }
  'agent:stop': { agentId: string }
  'plugin:load': { pluginId: string }
  'plugin:error': { pluginId: string; error: Error }
  'system:error': { error: Error; context?: string }
}

type EventKey = keyof EventMap

interface Subscription {
  id: string
  event: string
  handler: EventHandler
  once: boolean
}

export class EventBus {
  private subscriptions = new Map<string, Subscription>()
  private wildcardHandlers: Array<{ id: string; handler: EventHandler; once: boolean }> = []
  private idCounter = 0

  on<K extends EventKey>(event: K, handler: EventHandler<EventMap[K]>): () => void {
    const id = this.nextId()
    this.subscriptions.set(id, { id, event, handler, once: false })
    return () => this.subscriptions.delete(id)
  }

  once<K extends EventKey>(event: K, handler: EventHandler<EventMap[K]>): () => void {
    const id = this.nextId()
    this.subscriptions.set(id, { id, event, handler, once: true })
    return () => this.subscriptions.delete(id)
  }

  onAny(handler: EventHandler): () => void {
    const id = this.nextId()
    this.wildcardHandlers.push({ id, handler, once: false })
    return () => {
      this.wildcardHandlers = this.wildcardHandlers.filter(h => h.id !== id)
    }
  }

  off(id: string): void {
    this.subscriptions.delete(id)
    this.wildcardHandlers = this.wildcardHandlers.filter(h => h.id !== id)
  }

  async emit<K extends EventKey>(event: K, data: EventMap[K]): Promise<void> {
    const toRemove: string[] = []

    for (const [id, sub] of this.subscriptions) {
      if (sub.event !== event) continue
      try {
        await sub.handler(data)
      } catch (e) {
        console.error(`[event-bus] Error in handler for '${event}':`, e)
      }
      if (sub.once) toRemove.push(id)
    }

    for (const id of toRemove) {
      this.subscriptions.delete(id)
    }

    const wildcardToRemove: string[] = []
    for (const wh of this.wildcardHandlers) {
      try {
        await wh.handler({ event, data })
      } catch (e) {
        console.error(`[event-bus] Error in wildcard handler:`, e)
      }
      if (wh.once) wildcardToRemove.push(wh.id)
    }
    this.wildcardHandlers = this.wildcardHandlers.filter(h => !wildcardToRemove.includes(h.id))
  }

  listenerCount(event?: EventKey): number {
    if (!event) return this.subscriptions.size + this.wildcardHandlers.length
    let count = 0
    for (const sub of this.subscriptions.values()) {
      if (sub.event === event) count++
    }
    return count
  }

  removeAllListeners(event?: EventKey): void {
    if (!event) {
      this.subscriptions.clear()
      this.wildcardHandlers = []
      return
    }
    for (const [id, sub] of this.subscriptions) {
      if (sub.event === event) this.subscriptions.delete(id)
    }
  }

  private nextId(): string {
    return `sub_${++this.idCounter}`
  }
}

export const eventBus = new EventBus()
