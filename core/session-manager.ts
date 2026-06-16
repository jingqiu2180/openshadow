import { SessionStore, type Session, type SessionMessage, sessionToChatMessages, estimateTokens } from './session-store.js'
import { SessionCompactor } from './session-compactor.js'
import { ChatEngine, type ChatMessage, type ChatResult } from './chat-engine.js'
import { addMemory } from './memory/store.js'

export class SessionManager {
  private readonly store: SessionStore
  private readonly compactor: SessionCompactor
  private readonly engine: ChatEngine
  private activeSessionId: string | null = null

  constructor(engine: ChatEngine, store?: SessionStore) {
    this.engine = engine
    this.store = store ?? new SessionStore()
    this.compactor = new SessionCompactor()
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
  }

  getSessionStore(): SessionStore {
    return this.store
  }
}

export function createSessionManager(engine: ChatEngine): SessionManager {
  return new SessionManager(engine)
}
