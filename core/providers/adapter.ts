import type { Provider } from '../config.js'
import type { ChatMessage, ChatResult } from '../chat-engine.js'

export interface ProviderAdapter {
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<ProviderChatResponse>
  chatStream(messages: ChatMessage[], onDelta: (chunk: string) => void, options?: ChatOptions): Promise<ProviderChatResponse>
  getModel(): string
  getProviderId(): string
}

export interface ChatOptions {
  model?: string
  maxTokens?: number
  temperature?: number
  tools?: any[]
  sessionId?: string
}

export interface ProviderChatResponse {
  content: string
  toolCalls?: Array<{ name: string; args: Record<string, unknown> }>
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  latencyMs: number
}

export function createProviderAdapter(provider: Provider, modelName?: string): ProviderAdapter {
  switch (provider.type) {
    case 'openai':
    case 'ollama':
    case 'custom':
      return new OpenAIAdapter(provider, modelName)
    case 'gemini':
      return new GeminiAdapter(provider, modelName)
    default:
      throw new Error(`Unsupported provider type: ${provider.type}`)
  }
}

import OpenAI from 'openai'
import { usageTracker } from './usage-tracker.js'

class OpenAIAdapter implements ProviderAdapter {
  private readonly client: OpenAI
  private readonly provider: Provider
  private readonly model: string

  constructor(provider: Provider, modelName?: string) {
    this.provider = provider
    this.client = new OpenAI({ apiKey: provider.apiKey, baseURL: provider.baseUrl })
    this.model = modelName ?? provider.models[0] ?? 'gpt-4'
  }

  getModel(): string { return this.model }
  getProviderId(): string { return this.provider.id }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<ProviderChatResponse> {
    const start = Date.now()
    const response = await this.client.chat.completions.create({
      model: options?.model ?? this.model,
      messages: messages as any,
      max_tokens: options?.maxTokens,
      temperature: options?.temperature,
      tools: options?.tools,
    })

    const latencyMs = Date.now() - start
    const choice = response.choices[0]
    const usage = response.usage

    this.trackUsage(usage, latencyMs, options?.sessionId)

    return {
      content: choice?.message?.content ?? '',
      toolCalls: choice?.message?.tool_calls?.map(tc => ({
        name: tc.function.name,
        args: JSON.parse(tc.function.arguments || '{}'),
      })),
      usage: usage ? {
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens,
      } : undefined,
      latencyMs,
    }
  }

  async chatStream(messages: ChatMessage[], onDelta: (chunk: string) => void, options?: ChatOptions): Promise<ProviderChatResponse> {
    const start = Date.now()
    const stream = await this.client.chat.completions.create({
      model: options?.model ?? this.model,
      messages: messages as any,
      max_tokens: options?.maxTokens,
      temperature: options?.temperature,
      tools: options?.tools,
      stream: true,
    })

    let content = ''
    let toolCalls: Array<{ name: string; args: Record<string, unknown> }> = []
    const toolCallMap = new Map<number, { name: string; args: string }>()

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta
      if (delta?.content) {
        content += delta.content
        onDelta(delta.content)
      }
      if (delta?.tool_calls) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index ?? 0
          if (!toolCallMap.has(idx)) {
            toolCallMap.set(idx, { name: '', args: '' })
          }
          const existing = toolCallMap.get(idx)!
          if (tc.function?.name) existing.name += tc.function.name
          if (tc.function?.arguments) existing.args += tc.function.arguments
        }
      }
    }

    for (const [, tc] of toolCallMap) {
      try {
        toolCalls.push({ name: tc.name, args: JSON.parse(tc.args || '{}') })
      } catch {
        toolCalls.push({ name: tc.name, args: {} })
      }
    }

    const latencyMs = Date.now() - start
    this.trackUsage(undefined, latencyMs, options?.sessionId)

    return {
      content,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      latencyMs,
    }
  }

  private trackUsage(usage: any, latencyMs: number, sessionId?: string): void {
    try {
      usageTracker.record({
        providerId: this.provider.id,
        model: this.model,
        promptTokens: usage?.prompt_tokens ?? 0,
        completionTokens: usage?.completion_tokens ?? 0,
        totalTokens: usage?.total_tokens ?? 0,
        latencyMs,
        sessionId: sessionId ?? '',
      })
    } catch {
      // usage tracking should never break the main flow
    }
  }
}

class GeminiAdapter implements ProviderAdapter {
  private readonly provider: Provider
  private readonly model: string

  constructor(provider: Provider, modelName?: string) {
    this.provider = provider
    this.model = modelName ?? provider.models[0] ?? 'gemini-2.0-flash'
  }

  getModel(): string { return this.model }
  getProviderId(): string { return this.provider.id }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<ProviderChatResponse> {
    const start = Date.now()
    const geminiMessages = this.toGeminiFormat(messages)

    const url = `${this.provider.baseUrl}/v1beta/models/${options?.model ?? this.model}:generateContent?key=${this.provider.apiKey}`

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: geminiMessages,
        generationConfig: {
          maxOutputTokens: options?.maxTokens,
          temperature: options?.temperature,
        },
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`Gemini API error: ${response.status} ${err}`)
    }

    const data = await response.json() as any
    const latencyMs = Date.now() - start

    const content = data.candidates?.[0]?.content?.parts
      ?.filter((p: any) => p.text)
      .map((p: any) => p.text)
      .join('') ?? ''

    const usage = data.usageMetadata
    this.trackUsage(usage, latencyMs, options?.sessionId)

    return {
      content,
      latencyMs,
      usage: usage ? {
        promptTokens: usage.promptTokenCount ?? 0,
        completionTokens: usage.candidatesTokenCount ?? 0,
        totalTokens: usage.totalTokenCount ?? 0,
      } : undefined,
    }
  }

  async chatStream(messages: ChatMessage[], onDelta: (chunk: string) => void, options?: ChatOptions): Promise<ProviderChatResponse> {
    const start = Date.now()
    const geminiMessages = this.toGeminiFormat(messages)

    const url = `${this.provider.baseUrl}/v1beta/models/${options?.model ?? this.model}:streamGenerateContent?alt=sse&key=${this.provider.apiKey}`

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: geminiMessages,
        generationConfig: {
          maxOutputTokens: options?.maxTokens,
          temperature: options?.temperature,
        },
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`Gemini API error: ${response.status} ${err}`)
    }

    let content = ''
    const reader = response.body?.getReader()
    if (!reader) throw new Error('No response body')

    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        try {
          const data = JSON.parse(line.slice(6))
          const text = data.candidates?.[0]?.content?.parts
            ?.filter((p: any) => p.text)
            .map((p: any) => p.text)
            .join('') ?? ''
          if (text) {
            content += text
            onDelta(text)
          }
        } catch {
          // skip malformed SSE lines
        }
      }
    }

    const latencyMs = Date.now() - start
    this.trackUsage(undefined, latencyMs, options?.sessionId)

    return { content, latencyMs }
  }

  private toGeminiFormat(messages: ChatMessage[]): any[] {
    const result: any[] = []
    for (const msg of messages) {
      if (msg.role === 'system') continue
      result.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      })
    }
    return result
  }

  private trackUsage(usage: any, latencyMs: number, sessionId?: string): void {
    try {
      usageTracker.record({
        providerId: this.provider.id,
        model: this.model,
        promptTokens: usage?.promptTokenCount ?? 0,
        completionTokens: usage?.candidatesTokenCount ?? 0,
        totalTokens: usage?.totalTokenCount ?? 0,
        latencyMs,
        sessionId: sessionId ?? '',
      })
    } catch {
      // usage tracking should never break the main flow
    }
  }
}
