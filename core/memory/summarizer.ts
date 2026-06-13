import OpenAI from 'openai'
import { getRecentMemories, addMemory, getAgentConfig, type Memory } from '../memory/store.js'

export interface SummarizerOptions {
  agentId: string
  model?: string
  maxTokens?: number
}

/**
 * Summarizer: compresses old memories using LLM.
 * Keeps the agent's memory efficient over time.
 */
export class Summarizer {
  private readonly client: OpenAI
  private readonly model: string
  private readonly maxTokens: number

  constructor(options: SummarizerOptions) {
    const config = getAgentConfig(options.agentId)
    if (!config) {
      throw new Error(`Agent config not found: ${options.agentId}`)
    }

    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
    })
    this.model = options.model ?? 'gpt-4'
    this.maxTokens = options.maxTokens ?? 500
  }

  /**
   * Summarize old memories into a compact form.
   * @param memories - array of memory content strings
   * @returns summarized content
   */
  async summarize(memories: string[]): Promise<string> {
    if (memories.length <= 5) {
      return memories.join('\n')
    }

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

    return response.choices[0]?.message.content ?? '摘要失败'
  }

  /**
   * Run compaction: summarize old, low-access memories.
   * @param threshold - age threshold in ms (default 7 days)
   */
  async runCompaction(threshold: number = 7 * 24 * 60 * 60 * 1000): Promise<number> {
    const memories = getRecentMemories(100)
    const cutoff = Date.now() - threshold

    // Filter old, rarely accessed memories
    const oldMemories = memories.filter(
      (m: Memory) => m.created_at < cutoff && m.access_count < 3 && m.memory_type === 'conversation'
    )

    if (oldMemories.length < 5) {
      return 0
    }

    // Summarize
    const summary = await this.summarize(oldMemories.map((m: Memory) => m.content))

    // Save as new fact memory
    addMemory(summary, 4, 'fact')

    console.log(`[summarizer] Compacted ${oldMemories.length} memories -> ${summary.length} chars`)
    return oldMemories.length
  }
}

/**
 * Create a summarizer for an agent.
 */
export function createSummarizer(options: SummarizerOptions): Summarizer {
  return new Summarizer(options)
}