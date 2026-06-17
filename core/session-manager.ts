import { SessionStore, type Session, sessionToChatMessages } from './session-store.js'
import { SessionCompactor } from './session-compactor.js'
import { ChatEngine, type ChatMessage, type ChatResult } from './chat-engine.js'
import { addMemory } from './memory/store.js'
import { MemoryManager } from './memory/memory-manager.js'
import { createClient } from './providers/index.js'
import { config } from './config.js'

export class SessionManager {
  private readonly store: SessionStore
  private readonly compactor: SessionCompactor
  private readonly engine: ChatEngine
  private activeSessionId: string | null = null
  private readonly memoryManager: MemoryManager

  constructor(engine: ChatEngine, store?: SessionStore) {
    this.engine = engine
    this.store = store ?? new SessionStore()
    this.compactor = new SessionCompactor()
    this.memoryManager = new MemoryManager()
  }

  createSession(title?: string): Session {
    const session = this.store.create(this.engine.getModel(), title)
    this.activeSessionId = session.id
    return session
  }

  getActiveSession(): Session | null {
    if (!this.activeSessionId) return null
    return this.store.load(this.activeSessionId)
  }

  setActiveSession(sessionId: string): Session | null {
    const session = this.store.load(sessionId)
    if (session) this.activeSessionId = sessionId
    return session
  }

  listSessions() {
    return this.store.list()
  }

  deleteSession(sessionId: string): boolean {
    if (this.activeSessionId === sessionId) {
      this.activeSessionId = null
    }

    // 通知 MemoryManager：session 即将删除，触发最终记忆编译
    setImmediate(async () => {
      try {
        const provider = config.getActiveProvider('small')
        if (provider) {
          const client = createClient(provider)
          await this.memoryManager.onSessionEnd(sessionId, client)
        }
      } catch (err) {
        console.error('[SessionManager] Failed to notify MemoryManager on session end:', (err as Error).message)
      }
    })

    return this.store.delete(sessionId)
  }

  async chat(content: string, onDelta?: (chunk: string) => void): Promise<ChatResult> {
    if (!this.activeSessionId) {
      this.createSession()
    }

    this.store.addMessage(this.activeSessionId!, { role: 'user', content })

    const session = this.getActiveSession()
    if (!session) throw new Error('Session not found')

    const messages = this.buildMessages(session)

    let result: ChatResult
    if (onDelta) {
      result = await this.engine.chatStream(messages, onDelta)
    } else {
      result = await this.engine.chat(messages)
    }

    this.store.addMessage(this.activeSessionId!, { role: 'assistant', content: result.content })

    if (result.toolCalls) {
      this.store.addMessage(this.activeSessionId!, {
        role: 'assistant',
        content: `[Tool calls: ${result.toolCalls.map(tc => tc.name).join(', ')}]`,
        toolCalls: result.toolCalls,
      })
    }

    addMemory(`User: ${content} | Rem: ${result.content}`, 2, 'conversation')

    if (this.store.needsCompaction(this.activeSessionId!)) {
      await this.runCompaction(this.activeSessionId!)
    }

    return result
  }

  private buildMessages(session: Session): ChatMessage[] {
    const messages: ChatMessage[] = []

    // 注入编译后的长期记忆（先于 session 摘要）
    try {
      const longtermMemory = this.memoryManager.getCompiledMemory('longterm')
      if (longtermMemory) {
        messages.push({
          role: 'system',
          content: `[Long-term Memory]\n${longtermMemory}`,
        })
      }
    } catch {
      // 记忆系统未初始化，跳过
    }

    if (session.summary) {
      messages.push({
        role: 'system',
        content: `[Previous conversation summary]\n${session.summary}`,
      })
    }

    const recentMessages = session.messages.slice(-50)
    messages.push(...sessionToChatMessages(recentMessages))

    return messages
  }

  async runCompaction(sessionId: string): Promise<void> {
    const session = this.store.load(sessionId)
    if (!session || session.messages.length < 10) return

    const summary = await this.compactor.compact(session)
    this.store.updateSummary(sessionId, summary)

    const keepCount = Math.floor(session.messages.length * 0.4)
    const trimmedSession: Session = {
      ...session,
      messages: session.messages.slice(-keepCount),
      summary,
    }
    this.store.save(trimmedSession)

    // 通知 MemoryManager：session 已压缩，保存摘要
    try {
      const provider = config.getActiveProvider('small')
      if (provider) {
        const client = createClient(provider)
        await this.memoryManager.onSessionCompact(sessionId, summary, client)
      }
    } catch (err) {
      console.error('[SessionManager] Failed to notify MemoryManager:', (err as Error).message)
    }
  }

  getSessionStore(): SessionStore {
    return this.store
  }
}

export function createSessionManager(engine: ChatEngine): SessionManager {
  return new SessionManager(engine)
}
