// @ts-nocheck
/**
 * SubagentRunStore — subagent 运行记录管理（简化版）
 *
 * 每个 run 记录一次 subagent 执行（对应一个 taskId）。
 * run 的状态：pending → resolved / failed / aborted
 */
import fs from 'fs'

function nowIso(): string {
  return new Date().toISOString()
}

export interface SubagentRun {
  taskId: string
  threadId: string | null
  threadKind: 'direct' | 'workflow_node' | null
  parentSessionPath: string | null
  childSessionPath: string | null
  agentId: string | null
  agentName: string | null
  label: string | null
  access: 'read' | 'write' | null
  status: 'pending' | 'resolved' | 'failed' | 'aborted'
  summary: string | null
  error: string | null
  createdAt: string
  resolvedAt: string | null
}

export class SubagentRunStore {
  private runs = new Map<string, SubagentRun>()
  private persistPath: string | null = null

  constructor(persistPath?: string) {
    this.persistPath = persistPath || null
    if (persistPath && fs.existsSync(persistPath)) {
      this._load()
    }
  }

  /**
   * 注册一个新 run（pending 状态）。
   */
  register(taskId: string, opts: {
    threadId?: string | null
    threadKind?: 'direct' | 'workflow_node' | null
    parentSessionPath?: string | null
    label?: string | null
    access?: 'read' | 'write' | null
    summary?: string | null
    agentId?: string | null
    agentName?: string | null
  }): SubagentRun {
    const now = nowIso()
    const run: SubagentRun = {
      taskId,
      threadId: opts.threadId ?? null,
      threadKind: opts.threadKind ?? null,
      parentSessionPath: opts.parentSessionPath ?? null,
      childSessionPath: null,
      agentId: opts.agentId ?? null,
      agentName: opts.agentName ?? null,
      label: opts.label ?? null,
      access: opts.access ?? null,
      status: 'pending',
      summary: opts.summary ?? null,
      error: null,
      createdAt: now,
      resolvedAt: null,
    }
    this.runs.set(taskId, run)
    this._persist()
    return run
  }

  /**
   * 标记 run 为 resolved。
   */
  resolve(taskId: string, opts: {
    childSessionPath?: string | null
    summary?: string | null
  }): boolean {
    const run = this.runs.get(taskId)
    if (!run) return false
    run.status = 'resolved'
    run.childSessionPath = opts.childSessionPath ?? run.childSessionPath
    run.summary = opts.summary ?? run.summary
    run.resolvedAt = nowIso()
    this.runs.set(taskId, run)
    this._persist()
    return true
  }

  /**
   * 标记 run 为 failed。
   */
  fail(taskId: string, opts: {
    error?: string | null
    childSessionPath?: string | null
  }): boolean {
    const run = this.runs.get(taskId)
    if (!run) return false
    run.status = 'failed'
    run.error = opts.error ?? null
    run.childSessionPath = opts.childSessionPath ?? run.childSessionPath
    run.resolvedAt = nowIso()
    this.runs.set(taskId, run)
    this._persist()
    return true
  }

  /**
   * 标记 run 为 aborted。
   */
  abort(taskId: string): boolean {
    const run = this.runs.get(taskId)
    if (!run) return false
    run.status = 'aborted'
    run.resolvedAt = nowIso()
    this.runs.set(taskId, run)
    this._persist()
    return true
  }

  /**
   * 按 taskId 获取 run。
   */
  get(taskId: string): SubagentRun | null {
    return this.runs.get(taskId) ?? null
  }

  /**
   * 列出某个 parentSession 的所有 runs。
   */
  listByParentSession(parentSessionPath: string): SubagentRun[] {
    return [...this.runs.values()].filter(r => r.parentSessionPath === parentSessionPath)
  }

  /**
   * 按 parentSession 中止所有还在 pending 的 runs。
   */
  abortByParentSession(parentSessionPath: string, reason?: string): void {
    for (const [, run] of this.runs) {
      if (run.parentSessionPath === parentSessionPath && run.status === 'pending') {
        run.status = 'aborted'
        run.error = reason ?? 'Parent session ended'
        run.resolvedAt = nowIso()
        this.runs.set(run.taskId, run)
      }
    }
    this._persist()
  }

  /**
   * 列出所有 runs。
   */
  listAll(): SubagentRun[] {
    return [...this.runs.values()]
  }

  private _load(): void {
    if (!this.persistPath || !fs.existsSync(this.persistPath)) return
    try {
      const data = JSON.parse(fs.readFileSync(this.persistPath, 'utf-8'))
      if (data?.runs && typeof data.runs === 'object') {
        for (const [, record] of Object.entries(data.runs)) {
          const r = record as any
          if (r?.taskId) {
            this.runs.set(r.taskId, r as SubagentRun)
          }
        }
      }
    } catch (err) {
      console.warn(`SubagentRunStore: failed to load ${this.persistPath}:`, err)
    }
  }

  private _persist(): void {
    if (!this.persistPath) return
    try {
      const obj: Record<string, SubagentRun> = {}
      for (const [id, run] of this.runs) {
        obj[id] = run
      }
      fs.mkdirSync(require('path').dirname(this.persistPath), { recursive: true })
      fs.writeFileSync(this.persistPath, JSON.stringify({ runs: obj }, null, 2), 'utf-8')
    } catch (err) {
      console.warn('SubagentRunStore: failed to persist:', err)
    }
  }
}
