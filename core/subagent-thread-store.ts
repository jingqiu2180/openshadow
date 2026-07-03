/**
 * SubagentThreadStore — subagent 线程生命周期管理（简化版）
 *
 * Thread 记录一个 child session 的身份与生命周期。
 * 每个 thread 有一个 threadId，关联到 parentSessionPath 和 childSessionPath。
 */
import fs from 'fs'
import path from 'path'

const VALID_KINDS = new Set(['direct', 'workflow_node'])
const VALID_THREAD_STATUSES = new Set(['open', 'closed'])

function nowIso(): string {
  return new Date().toISOString()
}

function normalizeKind(kind: string, fallback = 'direct'): string {
  return VALID_KINDS.has(kind) ? kind : fallback
}

function normalizeThreadStatus(status: string, fallback = 'open'): string {
  return VALID_THREAD_STATUSES.has(status) ? status : fallback
}

export interface SubagentThread {
  threadId: string
  kind: 'direct' | 'workflow_node'
  status: 'open' | 'closed'
  parentSessionPath: string | null
  agentId: string | null
  agentName: string | null
  childSessionPath: string | null
  label: string | null
  access: 'read' | 'write' | null
  summary: string | null
  runCount: number
  createdAt: string
  lastRunAt: string | null
  closedAt: string | null
}

export class SubagentThreadStore {
  private threads = new Map<string, SubagentThread>()
  private persistPath: string | null = null

  constructor(persistPath?: string) {
    this.persistPath = persistPath || null
    if (persistPath && fs.existsSync(persistPath)) {
      this._load()
    }
  }

  /**
   * 创建或更新一个 thread。
   */
  upsert(threadId: string, record: Partial<SubagentThread> & { kind?: string; status?: string }): SubagentThread {
    const existing = this.threads.get(threadId)
    const now = nowIso()
    const updated: SubagentThread = {
      threadId,
      kind: normalizeKind(record.kind ?? existing?.kind ?? 'direct') as 'direct' | 'workflow_node',
      status: normalizeThreadStatus(record.status ?? existing?.status ?? 'open') as 'open' | 'closed',
      parentSessionPath: record.parentSessionPath ?? existing?.parentSessionPath ?? null,
      agentId: record.agentId ?? existing?.agentId ?? null,
      agentName: record.agentName ?? existing?.agentName ?? null,
      childSessionPath: record.childSessionPath ?? existing?.childSessionPath ?? null,
      label: record.label ?? existing?.label ?? null,
      access: record.access ?? existing?.access ?? null,
      summary: record.summary ?? existing?.summary ?? null,
      runCount: record.runCount ?? existing?.runCount ?? 0,
      createdAt: existing?.createdAt ?? now,
      lastRunAt: record.lastRunAt ?? existing?.lastRunAt ?? null,
      closedAt: record.status === 'closed' ? now : (existing?.closedAt ?? null),
    }
    this.threads.set(threadId, updated)
    this._persist()
    return updated
  }

  /**
   * 按 threadId 获取 thread。
   */
  get(threadId: string): SubagentThread | null {
    return this.threads.get(threadId) ?? null
  }

  /**
   * 关闭一个 thread。
   */
  close(threadId: string): boolean {
    const thread = this.threads.get(threadId)
    if (!thread) return false
    thread.status = 'closed'
    thread.closedAt = nowIso()
    this.threads.set(threadId, thread)
    this._persist()
    return true
  }

  /**
   * 列出某个 session 打开的 threads。
   */
  listOpenBySession(sessionPath: string): SubagentThread[] {
    return [...this.threads.values()].filter(
      t => t.parentSessionPath === sessionPath && t.status === 'open'
    )
  }

  /**
   * 删除某个 session 的所有 threads。
   */
  removeBySession(sessionPath: string): void {
    for (const [id, thread] of this.threads) {
      if (thread.parentSessionPath === sessionPath) {
        this.threads.delete(id)
      }
    }
    this._persist()
  }

  /**
   * 列出所有 threads。
   */
  listAll(): SubagentThread[] {
    return [...this.threads.values()]
  }

  private _load(): void {
    if (!this.persistPath || !fs.existsSync(this.persistPath)) return
    try {
      const data = JSON.parse(fs.readFileSync(this.persistPath, 'utf-8'))
      if (data?.threads && typeof data.threads === 'object') {
        for (const [id, record] of Object.entries(data.threads)) {
          this.threads.set(id, record as SubagentThread)
        }
      }
    } catch (err) {
      console.warn(`SubagentThreadStore: failed to load ${this.persistPath}:`, err)
    }
  }

  private _persist(): void {
    if (!this.persistPath) return
    try {
      const obj: Record<string, SubagentThread> = {}
      for (const [id, thread] of this.threads) {
        obj[id] = thread
      }
      fs.mkdirSync(path.dirname(this.persistPath), { recursive: true })
      fs.writeFileSync(this.persistPath, JSON.stringify({ threads: obj }, null, 2), 'utf-8')
    } catch (err) {
      console.warn(`SubagentThreadStore: failed to persist:`, err)
    }
  }
}
