import { ChatEngine, type ChatMessage, type ChatResult } from './chat-engine.js'
import { addMemory } from './memory/store.js'

export interface AgentOptions {
  agentId: string
  allowedPaths?: string[]
  providerRole?: 'main' | 'small' | 'large'
  providerId?: string
}

export class Agent {
  readonly agentId: string
  readonly engine: ChatEngine

  constructor(options: AgentOptions) {
    this.agentId = options.agentId
    this.engine = ChatEngine.createFromConfig(
      options.agentId,
      options.providerRole,
      options.providerId,
    )
    this.engine.registerLazyTools(this)
  }

  async chat(messages: ChatMessage[]): Promise<ChatResult> {
    const result = await this.engine.chat(messages)
    this.remember(messages, result.content)
    return result
  }

  async chatStream(
    messages: ChatMessage[],
    onDelta: (chunk: string) => void,
  ): Promise<ChatResult> {
    const result = await this.engine.chatStream(messages, onDelta)
    this.remember(messages, result.content)
    return result
  }

  addPendingImage(base64: string): void {
    this.engine.addPendingImage(base64)
  }

  private remember(messages: ChatMessage[], response: string): void {
    const userMsg = messages[messages.length - 1]?.content
    if (userMsg) {
      addMemory(`User: ${userMsg} | Rem: ${response}`, 2, 'conversation')
    }
  }
}
