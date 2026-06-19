// @ts-nocheck
import OpenAI from 'openai'
import { getRecentMemories, addMemory, addFact, getAgentConfig, type Memory } from './store'
import { config } from '../config'
import { createClient as createProviderClient, pickModel } from '../providers/index'

export interface SummarizerOptions {
  agentId: string
  model?: string
  maxTokens?: number
}

export class Summarizer {
  private readonly client: OpenAI
  private readonly model: string
  private readonly maxTokens: number

  constructor(options: SummarizerOptions) {
    const provider = config.getActiveProvider('small')
    if (provider) {
      this.client = createProviderClient(provider)
      this.model = options.model ?? pickModel(provider)
    } else {
      const agentConfig = getAgentConfig(options.agentId)
      if (!agentConfig) throw new Error(`Agent config not found: ${options.agentId}`)
      this.client = new OpenAI({ apiKey: agentConfig.apiKey, baseURL: agentConfig.baseUrl })
      this.model = options.model ?? agentConfig.model
    }
    this.maxTokens = options.maxTokens ?? 500
  }

  async summarize(memories: string[]): Promise<string> {
    if (memories.length <= 5) return memories.join('\n')

    const prompt = `请将以下对话或信息压缩成简洁的摘要，保留关键信息：

${memories.map((m, i) => `${i + 1}. ${m}`).join('\n')}

要求：
- 保留关键事实、偏好、重要约定
- 用第一人称叙述
- 不超过 ${this.maxTokens} 字`

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: this.maxTokens,
    })

    return response.choices[0]?.message?.content ?? '摘要失败'
  }

  async runCompaction(threshold: number = 7 * 24 * 60 * 60 * 1000): Promise<number> {
    const memories = getRecentMemories(100)
    const cutoff = Date.now() - threshold

    const oldMemories = memories.filter(
      (m: Memory) => m.created_at < cutoff && m.access_count < 3 && m.memory_type === 'conversation'
    )

    if (oldMemories.length < 5) return 0

    const summary = await this.summarize(oldMemories.map((m: Memory) => m.content))

    addFact(summary, ['summary', 'auto-compaction'], '', 'system', 4)
    addMemory(summary, 4, 'fact', ['summary', 'auto-compaction'])

    console.log(`[summarizer] Compacted ${oldMemories.length} memories -> ${summary.length} chars`)
    return oldMemories.length
  }
}

export function createSummarizer(options: SummarizerOptions): Summarizer {
  return new Summarizer(options)
}
