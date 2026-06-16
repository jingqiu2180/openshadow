import OpenAI from 'openai'
import { config } from '../config.js'
import { createClient as createProviderClient, pickModel } from '../providers/index.js'
import { getRecentMemories, addFact, searchFacts, type Memory } from './store.js'

const EXTRACTION_PROMPT = `分析以下对话内容，提取其中的元事实（meta-facts）。

规则：
1. 每个事实必须是一条独立的、可验证的信息
2. 去除上下文依赖，让事实可以独立理解
3. 为每个事实打上相关标签（2-5个）
4. 只提取有价值的事实，忽略寒暄和无关内容

输出格式（JSON数组）：
[
  { "content": "事实内容", "tags": ["标签1", "标签2"], "importance": 3 }
]

重要性等级：1=琐碎, 2=一般, 3=重要, 4=非常重要, 5=关键

对话内容：
`

export class DeepMemoryProcessor {
  private readonly client: OpenAI
  private readonly model: string

  constructor() {
    const provider = config.getActiveProvider('small')
    if (provider) {
      this.client = createProviderClient(provider)
      this.model = pickModel(provider)
    } else {
      const agent = config.getAgent()
      this.client = new OpenAI({ apiKey: agent.apiKey, baseURL: agent.baseUrl })
      this.model = agent.model
    }
  }

  async processSessionMemories(memories: Memory[]): Promise<number> {
    if (memories.length < 3) return 0

    const conversationText = memories
      .map(m => `[${m.memory_type}] ${m.content}`)
      .join('\n')

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: EXTRACTION_PROMPT + conversationText }],
        max_tokens: 2000,
      })

      const text = response.choices[0]?.message?.content ?? ''
      const facts = this.parseFacts(text)

      let added = 0
      for (const fact of facts) {
        const existing = searchFacts(fact.content, 1)
        if (existing.length === 0 || this.isDifferentFact(existing[0].content, fact.content)) {
          addFact(fact.content, fact.tags, '', 'extraction', fact.importance)
          added++
        }
      }

      return added
    } catch (e: any) {
      console.warn('[deep-memory] Extraction failed:', e.message)
      return 0
    }
  }

  async runDaily(): Promise<{ processed: number; factsAdded: number }> {
    const memories = getRecentMemories(100)
    const conversationMemories = memories.filter(m => m.memory_type === 'conversation')

    if (conversationMemories.length < 5) {
      return { processed: 0, factsAdded: 0 }
    }

    const factsAdded = await this.processSessionMemories(conversationMemories)
    return { processed: conversationMemories.length, factsAdded }
  }

  private parseFacts(text: string): Array<{ content: string; tags: string[]; importance: number }> {
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) return []

    try {
      const parsed = JSON.parse(jsonMatch[0])
      if (!Array.isArray(parsed)) return []

      return parsed
        .filter((f: any) => typeof f.content === 'string' && f.content.trim())
        .map((f: any) => ({
          content: String(f.content).trim(),
          tags: Array.isArray(f.tags) ? f.tags.filter((t: unknown) => typeof t === 'string') : [],
          importance: typeof f.importance === 'number' ? Math.min(5, Math.max(1, f.importance)) : 3,
        }))
    } catch {
      return []
    }
  }

  private isDifferentFact(existing: string, newFact: string): boolean {
    const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()
    const e = normalize(existing)
    const n = normalize(newFact)
    if (e === n) return false
    if (e.length > 20 && n.length > 20 && e.includes(n.slice(0, 20))) return false
    return true
  }
}

export function createDeepMemoryProcessor(): DeepMemoryProcessor {
  return new DeepMemoryProcessor()
}
