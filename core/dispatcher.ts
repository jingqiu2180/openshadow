// @ts-nocheck
import { Hono } from 'hono'
import { Agent } from './agent.js'

export interface SubAgent {
  id: string
  name: string
  role: string
  systemPrompt: string
}

export interface DispatchOptions {
  agents: SubAgent[]
  defaultAgent?: string
}

export class Dispatcher {
  private readonly agents: Map<string, SubAgent> = new Map()
  private readonly mainAgent: Agent
  private readonly _defaultAgent: string

  constructor(mainAgent: Agent, options: DispatchOptions) {
    this.mainAgent = mainAgent
    this._defaultAgent = options.defaultAgent ?? options.agents[0]?.id ?? 'default'

    for (const agent of options.agents) {
      this.agents.set(agent.id, agent)
    }
  }

  getDefaultAgent(): string {
    return this._defaultAgent
  }

  async dispatch(agentId: string, message: string): Promise<string> {
    const agent = this.agents.get(agentId)
    if (!agent) {
      return `未知 Agent: ${agentId}，可用: ${[...this.agents.keys()].join(', ')}`
    }

    const response = await this.mainAgent.chat([
      { role: 'system', content: agent.systemPrompt },
      { role: 'user', content: message },
    ])

    return response.content
  }

  async autoDispatch(message: string): Promise<string> {
    const lower = message.toLowerCase()

    if (lower.includes('code') || lower.includes('implement') || lower.includes('写代码')) {
      return this.dispatch('coder', message)
    }
    if (lower.includes('review') || lower.includes('检查') || lower.includes('审视')) {
      return this.dispatch('qa', message)
    }
    if (lower.includes('plan') || lower.includes('设计') || lower.includes('需求')) {
      return this.dispatch('pm', message)
    }
    if (lower.includes('deploy') || lower.includes('部署') || lower.includes('运维')) {
      return this.dispatch('ops', message)
    }

    const response = await this.mainAgent.chat([
      { role: 'user', content: message },
    ])

    return response.content
  }

  createApp(): Hono {
    const app = new Hono()

    app.get('/agents', c => c.json({
      agents: [...this.agents.values()].map(a => ({ id: a.id, name: a.name, role: a.role }))
    }))

    app.post('/dispatch/:agentId', async c => {
      const agentId = c.req.param('agentId')
      const { message } = await c.req.json<{ message: string }>()
      const response = await this.dispatch(agentId, message)
      return c.json({ response })
    })

    app.post('/auto-dispatch', async c => {
      const { message } = await c.req.json<{ message: string }>()
      const response = await this.autoDispatch(message)
      return c.json({ response })
    })

    return app
  }
}

export const DEFAULT_AGENTS: SubAgent[] = [
  { id: 'coder', name: 'Coder', role: '开发', systemPrompt: '你是资深开发者，擅长实现功能、调试代码、编写测试。保持代码简洁、可读、符合最佳实践。' },
  { id: 'pm', name: 'PM', role: '产品', systemPrompt: '你是产品经理，擅长分析需求、规划功能、优先级排序。以用户价值为导向。' },
  { id: 'qa', name: 'QA', role: '测试', systemPrompt: '你是 QA 工程师，擅长测试用例设计、找 bug、保证质量。关注边界条件和异常情况。' },
  { id: 'ops', name: 'Ops', role: '运维', systemPrompt: '你是运维工程师，擅长部署、监控、故障排查、自动化。确保系统稳定、高效、安全。' },
  { id: 'writer', name: 'Writer', role: '文档', systemPrompt: '你是技术文档专家，擅长编写清晰、准确、有价值的文档。' },
]

export function createDispatcher(mainAgent: Agent, options?: Partial<DispatchOptions>): Dispatcher {
  return new Dispatcher(mainAgent, {
    agents: options?.agents ?? DEFAULT_AGENTS,
    defaultAgent: options?.defaultAgent,
  })
}