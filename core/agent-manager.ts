import { Agent, type AgentOptions } from './agent.js'
import { ConfigCoordinator } from './config-coordinator.js'
import { ModelManager } from './model-manager.js'
import { EventBus } from './event-bus.js'
import type { ChatMessage, ChatResult } from './chat-engine.js'

export interface AgentMeta {
  agentId: string
  providerRole: 'main' | 'small' | 'large'
  providerId?: string
  allowedPaths: string[]
  createdAt: number
  status: 'idle' | 'running' | 'error'
  lastActiveAt?: number
}

export interface AgentStatus {
  agentId: string
  status: 'idle' | 'running' | 'error'
  model: string
  providerId: string
  sessionCount: number
  lastError?: string
}

export class AgentManager {
  private agents = new Map<string, Agent>()
  private meta = new Map<string, AgentMeta>()
  private activeAgentId: string | null = null
  private configCoordinator: ConfigCoordinator
  private modelManager: ModelManager
  private eventBus: EventBus

  constructor(
    configCoordinator?: ConfigCoordinator,
    modelManager?: ModelManager,
    eventBus?: EventBus,
  ) {
    this.configCoordinator = configCoordinator ?? new ConfigCoordinator()
    this.modelManager = modelManager ?? new ModelManager()
    this.eventBus = eventBus ?? new EventBus()
  }

  createAgent(options: AgentOptions): Agent {
    if (this.agents.has(options.agentId)) {
      throw new Error(`Agent '${options.agentId}' already exists`)
    }

    const agent = new Agent(options)
    this.agents.set(options.agentId, agent)

    const meta: AgentMeta = {
      agentId: options.agentId,
      providerRole: options.providerRole ?? 'main',
      providerId: options.providerId,
      allowedPaths: options.allowedPaths ?? [],
      createdAt: Date.now(),
      status: 'idle',
    }
    this.meta.set(options.agentId, meta)

    this.eventBus.emit('agent:start', { agentId: options.agentId })

    if (!this.activeAgentId) {
      this.activeAgentId = options.agentId
    }

    return agent
  }

  getOrCreate(options: AgentOptions): Agent {
    const existing = this.agents.get(options.agentId)
    if (existing) return existing
    return this.createAgent(options)
  }

  getAgent(agentId: string): Agent | null {
    return this.agents.get(agentId) ?? null
  }

  getActiveAgent(): Agent | null {
    if (!this.activeAgentId) return null
    return this.agents.get(this.activeAgentId) ?? null
  }

  setActiveAgent(agentId: string): boolean {
    const agent = this.agents.get(agentId)
    if (!agent) return false

    const prevId = this.activeAgentId
    this.activeAgentId = agentId

    if (prevId && prevId !== agentId) {
      this.eventBus.emit('session:switch', { sessionId: agentId })
    }

    const meta = this.meta.get(agentId)
    if (meta) {
      meta.lastActiveAt = Date.now()
    }

    return true
  }

  getActiveAgentId(): string | null {
    return this.activeAgentId
  }

  listAgents(): AgentMeta[] {
    return Array.from(this.meta.values())
  }

  getAgentMeta(agentId: string): AgentMeta | null {
    return this.meta.get(agentId) ?? null
  }

  getAgentStatus(agentId: string): AgentStatus | null {
    const agent = this.agents.get(agentId)
    const meta = this.meta.get(agentId)
    if (!agent || !meta) return null

    return {
      agentId,
      status: meta.status,
      model: agent.engine.getModel(),
      providerId: meta.providerId ?? 'default',
      sessionCount: 0,
    }
  }

  setAgentStatus(agentId: string, status: 'idle' | 'running' | 'error', error?: string): void {
    const meta = this.meta.get(agentId)
    if (meta) {
      meta.status = status
      if (status === 'error') {
        this.eventBus.emit('system:error', {
          error: new Error(error ?? 'Unknown error'),
          context: `agent:${agentId}`,
        })
      }
    }
  }

  removeAgent(agentId: string): boolean {
    const existed = this.agents.delete(agentId)
    this.meta.delete(agentId)

    if (this.activeAgentId === agentId) {
      this.activeAgentId = null
      const remaining = Array.from(this.agents.keys())
      if (remaining.length > 0) {
        this.activeAgentId = remaining[0]
      }
    }

    if (existed) {
      this.eventBus.emit('agent:stop', { agentId })
    }

    return existed
  }

  async chat(agentId: string, messages: ChatMessage[]): Promise<ChatResult> {
    const agent = this.agents.get(agentId)
    if (!agent) throw new Error(`Agent '${agentId}' not found`)

    this.setAgentStatus(agentId, 'running')
    try {
      const result = await agent.chat(messages)
      this.setAgentStatus(agentId, 'idle')
      return result
    } catch (e: any) {
      this.setAgentStatus(agentId, 'error', e.message)
      throw e
    }
  }

  async chatStream(
    agentId: string,
    messages: ChatMessage[],
    onDelta: (chunk: string) => void,
  ): Promise<ChatResult> {
    const agent = this.agents.get(agentId)
    if (!agent) throw new Error(`Agent '${agentId}' not found`)

    this.setAgentStatus(agentId, 'running')
    try {
      const result = await agent.chatStream(messages, onDelta)
      this.setAgentStatus(agentId, 'idle')
      return result
    } catch (e: any) {
      this.setAgentStatus(agentId, 'error', e.message)
      throw e
    }
  }

  addPendingImage(agentId: string, base64: string): void {
    const agent = this.agents.get(agentId)
    if (agent) {
      agent.addPendingImage(base64)
    }
  }

  getConfigCoordinator(): ConfigCoordinator {
    return this.configCoordinator
  }

  getModelManager(): ModelManager {
    return this.modelManager
  }

  getEventBus(): EventBus {
    return this.eventBus
  }
}

export function createAgentManager(
  configCoordinator?: ConfigCoordinator,
  modelManager?: ModelManager,
  eventBus?: EventBus,
): AgentManager {
  return new AgentManager(configCoordinator, modelManager, eventBus)
}

export const agentManager = createAgentManager()
