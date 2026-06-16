import { existsSync, mkdirSync, unlinkSync, appendFileSync, writeFileSync, createReadStream } from 'fs'
import { join, dirname } from 'path'
import { createInterface } from 'readline'
import { SessionStore, type Session, type SessionMessage, type SessionMeta, sessionToChatMessages, estimateTokens } from './session-store.js'
import { SessionCompactor } from './session-compactor.js'
import { ChatEngine, type ChatMessage, type ChatResult } from './chat-engine.js'
import { addMemory } from './memory/store.js'
import { EventBus } from './event-bus.js'
import { modelManager } from './model-manager.js'

export type PermissionMode = 'auto' | 'operate' | 'ask' | 'read_only'

export interface CapabilityFingerprint {
  model: string
  providerId: string
  contextWindow: number
  supportsVision: boolean
  supportsTools: boolean
  supportsStreaming: boolean
  maxOutputTokens: number
  permissionMode: PermissionMode
  createdAt: number
}

export interface SessionHealth {
  sessionId: string
  messageCount: number
  tokenEstimate: number
  contextUsagePercent: number
  needsCompaction: boolean
  hasSummary: boolean
  age: number
  lastActiveAt: number
}

export interface SessionSnapshot {
  sessionId: string
  title: string
  model: string
  messageCount: number
  summary?: string
  fingerprint: CapabilityFingerprint
  createdAt: number
  snapshotAt: number
}

export interface SessionCoordinatorOptions {
  engine: ChatEngine
  store?: SessionStore
  eventBus?: EventBus
  jsonlDir?: string
}

const JSONL_DIR = join(process.cwd(), 'data', 'sessions_jsonl')

export class SessionCoordinator {
  private readonly store: SessionStore
  private readonly compactor: SessionCompactor
  private readonly engine: ChatEngine
  private readonly eventBus: EventBus
  private readonly jsonlDir: string
  private activeSessionId: string | null = null
  private permissionMode: PermissionMode = 'auto'
  private fingerprint: CapabilityFingerprint | null = null

  constructor(options: SessionCoordinatorOptions) {
    this.engine = options.engine
    this.store = options.store ?? new SessionStore()
    this.compactor = new SessionCompactor()
    this.eventBus = options.eventBus ?? new EventBus()
    this.jsonlDir = options.jsonlDir ?? JSONL_DIR

    if (!existsSync(this.jsonlDir)) {
      mkdirSync(this.jsonlDir, { recursive: true })
    }
  }

  createSession(title?: string): Session {
    const session = this.store.create(this.engine.getModel(), title)
    this.activeSessionId = session.id
    this.buildFingerprint()

    this.eventBus.emit('session:create', {
      sessionId: session.id,
      title: session.title,
    })

    return session
  }

  getActiveSession(): Session | null {
    if (!this.activeSessionId) return null
    return this.store.load(this.activeSessionId)
  }

  getActiveSessionId(): string | null {
    return this.activeSessionId
  }

  setActiveSession(sessionId: string): Session | null {
    const session = this.store.load(sessionId)
    if (session) {
      const prevId = this.activeSessionId
      this.activeSessionId = sessionId
      this.buildFingerprint()

      if (prevId && prevId !== sessionId) {
        this.eventBus.emit('session:switch', { sessionId })
      }
    }
    return session
  }

  listSessions(): SessionMeta[] {
    return this.store.list()
  }

  deleteSession(sessionId: string): boolean {
    if (this.activeSessionId === sessionId) {
      this.activeSessionId = null
    }

    const jsonlPath = this.jsonlPath(sessionId)
    if (existsSync(jsonlPath)) {
      try { unlinkSync(jsonlPath) } catch {}
    }

    const deleted = this.store.delete(sessionId)
    if (deleted) {
      this.eventBus.emit('session:delete', { sessionId })
    }
    return deleted
  }

  async chat(content: string, onDelta?: (chunk: string) => void): Promise<ChatResult> {
    if (!this.activeSessionId) {
      this.createSession()
    }

    const sessionId = this.activeSessionId!

    const userMsg: SessionMessage = {
      role: 'user',
      content,
      timestamp: Date.now(),
    }
    this.store.addMessage(sessionId, userMsg)
    this.appendJsonl(sessionId, userMsg)

    const session = this.getActiveSession()
    if (!session) throw new Error('Session not found')

    const messages = this.buildMessages(session)

    let result: ChatResult
    if (onDelta) {
      result = await this.engine.chatStream(messages, onDelta)
    } else {
      result = await this.engine.chat(messages)
    }

    const assistantMsg: SessionMessage = {
      role: 'assistant',
      content: result.content,
      timestamp: Date.now(),
      toolCalls: result.toolCalls,
    }
    this.store.addMessage(sessionId, assistantMsg)
    this.appendJsonl(sessionId, assistantMsg)

    if (result.toolCalls && result.toolCalls.length > 0) {
      const toolMsg: SessionMessage = {
        role: 'tool',
        content: `[Tool calls: ${result.toolCalls.map(tc => tc.name).join(', ')}]`,
        timestamp: Date.now(),
        toolCalls: result.toolCalls,
      }
      this.store.addMessage(sessionId, toolMsg)
      this.appendJsonl(sessionId, toolMsg)
    }

    addMemory(`User: ${content} | Rem: ${result.content}`, 2, 'conversation')

    if (this.store.needsCompaction(sessionId)) {
      await this.runCompaction(sessionId)
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

    const beforeCount = session.messages.length
    const summary = await this.compactor.compact(session)
    this.store.updateSummary(sessionId, summary)

    const keepCount = Math.floor(session.messages.length * 0.4)
    const trimmedSession: Session = {
      ...session,
      messages: session.messages.slice(-keepCount),
      summary,
    }
    this.store.save(trimmedSession)

    this.eventBus.emit('memory:compact', {
      sessionId,
      beforeCount,
      afterCount: trimmedSession.messages.length,
    })
  }

  getHealth(sessionId?: string): SessionHealth | null {
    const sid = sessionId ?? this.activeSessionId
    if (!sid) return null

    const session = this.store.load(sid)
    if (!session) return null

    const tokens = estimateTokens(session.messages)
    const cap = this.fingerprint?.contextWindow ?? 128000

    return {
      sessionId: sid,
      messageCount: session.messages.length,
      tokenEstimate: tokens,
      contextUsagePercent: Math.round((tokens / cap) * 100),
      needsCompaction: this.store.needsCompaction(sid),
      hasSummary: !!session.summary,
      age: Date.now() - session.createdAt,
      lastActiveAt: session.updatedAt,
    }
  }

  buildFingerprint(): void {
    const model = this.engine.getModel()
    const cap = modelManager.getCapability(model)

    this.fingerprint = {
      model,
      providerId: 'default',
      contextWindow: cap.contextWindow,
      supportsVision: cap.supportsVision,
      supportsTools: cap.supportsTools,
      supportsStreaming: cap.supportsStreaming,
      maxOutputTokens: cap.maxOutputTokens,
      permissionMode: this.permissionMode,
      createdAt: Date.now(),
    }
  }

  getFingerprint(): CapabilityFingerprint | null {
    return this.fingerprint
  }

  checkCapabilityDrift(): { drifted: boolean; changes: string[] } {
    if (!this.fingerprint) {
      return { drifted: false, changes: [] }
    }

    const currentModel = this.engine.getModel()
    const currentCap = modelManager.getCapability(currentModel)
    const changes: string[] = []

    if (this.fingerprint.model !== currentModel) {
      changes.push(`Model changed: ${this.fingerprint.model} → ${currentModel}`)
    }
    if (this.fingerprint.contextWindow !== currentCap.contextWindow) {
      changes.push(`Context window: ${this.fingerprint.contextWindow} → ${currentCap.contextWindow}`)
    }
    if (this.fingerprint.supportsVision !== currentCap.supportsVision) {
      changes.push(`Vision: ${this.fingerprint.supportsVision} → ${currentCap.supportsVision}`)
    }
    if (this.fingerprint.supportsTools !== currentCap.supportsTools) {
      changes.push(`Tools: ${this.fingerprint.supportsTools} → ${currentCap.supportsTools}`)
    }
    if (this.fingerprint.permissionMode !== this.permissionMode) {
      changes.push(`Permission mode: ${this.fingerprint.permissionMode} → ${this.permissionMode}`)
    }

    return { drifted: changes.length > 0, changes }
  }

  setPermissionMode(mode: PermissionMode): void {
    this.permissionMode = mode
    if (this.fingerprint) {
      this.fingerprint.permissionMode = mode
    }
  }

  getPermissionMode(): PermissionMode {
    return this.permissionMode
  }

  createSnapshot(sessionId?: string): SessionSnapshot | null {
    const sid = sessionId ?? this.activeSessionId
    if (!sid) return null

    const session = this.store.load(sid)
    if (!session) return null

    this.buildFingerprint()

    return {
      sessionId: sid,
      title: session.title,
      model: session.model,
      messageCount: session.messages.length,
      summary: session.summary,
      fingerprint: { ...this.fingerprint! },
      createdAt: session.createdAt,
      snapshotAt: Date.now(),
    }
  }

  async restoreFromSnapshot(snapshot: SessionSnapshot): Promise<Session | null> {
    const session = this.store.load(snapshot.sessionId)
    if (!session) return null

    if (snapshot.fingerprint) {
      this.fingerprint = snapshot.fingerprint
      this.permissionMode = snapshot.fingerprint.permissionMode
    }

    this.activeSessionId = snapshot.sessionId
    return session
  }

  private jsonlPath(sessionId: string): string {
    return join(this.jsonlDir, `${sessionId}.jsonl`)
  }

  private appendJsonl(sessionId: string, message: SessionMessage): void {
    try {
      appendFileSync(
        this.jsonlPath(sessionId),
        JSON.stringify(message) + '\n',
        'utf-8',
      )
    } catch {}
  }

  async importFromJsonl(sessionId: string): Promise<SessionMessage[]> {
    const path = this.jsonlPath(sessionId)
    if (!existsSync(path)) return []

    const messages: SessionMessage[] = []
    const rl = createInterface({
      input: createReadStream(path, 'utf-8'),
      crlfDelay: Infinity,
    })

    for await (const line of rl) {
      try {
        messages.push(JSON.parse(line))
      } catch {}
    }

    return messages
  }

  exportToJsonl(sessionId: string): string {
    const session = this.store.load(sessionId)
    if (!session) return ''

    const path = this.jsonlPath(sessionId)
    const dir = dirname(path)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

    const lines = session.messages.map(msg => JSON.stringify(msg)).join('\n') + '\n'
    writeFileSync(path, lines, 'utf-8')

    return path
  }

  getSessionStore(): SessionStore {
    return this.store
  }

  getEventBus(): EventBus {
    return this.eventBus
  }
}

export function createSessionCoordinator(options: SessionCoordinatorOptions): SessionCoordinator {
  return new SessionCoordinator(options)
}
