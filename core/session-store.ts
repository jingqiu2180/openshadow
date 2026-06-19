// @ts-nocheck
import { randomUUID } from 'crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from 'fs'
import { join, dirname } from 'path'
import type { ChatMessage } from './chat-engine'

export interface SessionMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  timestamp: number
  toolCalls?: Array<{ name: string; args: Record<string, unknown> }>
}

export interface SessionMeta {
  id: string
  title: string
  model: string
  createdAt: number
  updatedAt: number
  messageCount: number
  tokenEstimate: number
  summary?: string
}

export interface Session {
  id: string
  title: string
  model: string
  messages: SessionMessage[]
  createdAt: number
  updatedAt: number
  summary?: string
}

const SESSIONS_DIR = join(process.cwd(), 'data', 'sessions')
const MAX_MESSAGES = 200
const COMPACT_THRESHOLD = 0.85

export class SessionStore {
  private readonly dir: string

  constructor(dir?: string) {
    this.dir = dir ?? SESSIONS_DIR
    if (!existsSync(this.dir)) {
      mkdirSync(this.dir, { recursive: true })
    }
  }

  create(model: string, title?: string): Session {
    const session: Session = {
      id: randomUUID(),
      title: title ?? 'New Session',
      model,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    this.save(session)
    return session
  }

  load(id: string): Session | null {
    const filePath = this.sessionPath(id)
    if (!existsSync(filePath)) return null
    try {
      const data = JSON.parse(readFileSync(filePath, 'utf-8'))
      return {
        id: data.id,
        title: data.title ?? 'New Session',
        model: data.model,
        messages: data.messages ?? [],
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        summary: data.summary,
      }
    } catch {
      return null
    }
  }

  save(session: Session): void {
    session.updatedAt = Date.now()
    const filePath = this.sessionPath(session.id)
    const dir = dirname(filePath)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    writeFileSync(filePath, JSON.stringify(session, null, 2), 'utf-8')
  }

  delete(id: string): boolean {
    const filePath = this.sessionPath(id)
    if (!existsSync(filePath)) return false
    unlinkSync(filePath)
    return true
  }

  list(): SessionMeta[] {
    if (!existsSync(this.dir)) return []
    const entries = readdirSync(this.dir).filter(f => f.endsWith('.json'))
    const sessions: SessionMeta[] = []

    for (const entry of entries) {
      try {
        const data = JSON.parse(readFileSync(join(this.dir, entry), 'utf-8'))
        sessions.push({
          id: data.id,
          title: data.title ?? 'New Session',
          model: data.model,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          messageCount: data.messages?.length ?? 0,
          tokenEstimate: estimateTokens(data.messages ?? []),
          summary: data.summary,
        })
      } catch {
        // skip corrupted files
      }
    }

    return sessions.sort((a, b) => b.updatedAt - a.updatedAt)
  }

  addMessage(sessionId: string, message: Omit<SessionMessage, 'timestamp'>): Session | null {
    const session = this.load(sessionId)
    if (!session) return null

    session.messages.push({
      ...message,
      timestamp: Date.now(),
    })

    if (session.messages.length > MAX_MESSAGES) {
      session.messages = session.messages.slice(-MAX_MESSAGES)
    }

    this.save(session)
    return session
  }

  getMessages(sessionId: string, limit?: number): SessionMessage[] {
    const session = this.load(sessionId)
    if (!session) return []
    const msgs = session.messages
    return limit ? msgs.slice(-limit) : msgs
  }

  needsCompaction(sessionId: string): boolean {
    const session = this.load(sessionId)
    if (!session) return false
    const tokens = estimateTokens(session.messages)
    const maxContext = 128000
    return tokens > maxContext * COMPACT_THRESHOLD
  }

  updateSummary(sessionId: string, summary: string): void {
    const session = this.load(sessionId)
    if (!session) return
    session.summary = summary
    this.save(session)
  }

  private sessionPath(id: string): string {
    return join(this.dir, `${id}.json`)
  }
}

export function estimateTokens(messages: SessionMessage[]): number {
  let total = 0
  for (const msg of messages) {
    total += Math.ceil(msg.content.length / 4)
    if (msg.toolCalls) {
      total += Math.ceil(JSON.stringify(msg.toolCalls).length / 4)
    }
    total += 4
  }
  return total
}

export function sessionToChatMessages(messages: SessionMessage[]): ChatMessage[] {
  return messages
    .filter(m => m.role === 'user' || m.role === 'assistant' || m.role === 'system')
    .map(m => ({ role: m.role as 'system' | 'user' | 'assistant', content: m.content }))
}
