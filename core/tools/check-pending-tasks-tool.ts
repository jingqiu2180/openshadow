// @ts-nocheck
/**
 * check-pending-tasks-tool.ts — 查询后台异步任务状态
 *
 * 轻量实现：使用简单内存存储。
 */

export interface DeferredTask {
  taskId: string
  status: 'pending' | 'resolved' | 'failed'
  type: string
  deferredAt: number
  result?: any
  reason?: string
  meta?: Record<string, any>
}

// 简单内存存储（轻量实现）
class DeferredResultStore {
  private tasks: Map<string, DeferredTask[]> = new Map()

  listBySession(sessionPath: string): DeferredTask[] {
    return this.tasks.get(sessionPath) || []
  }

  add(sessionPath: string, task: DeferredTask): void {
    const list = this.tasks.get(sessionPath) || []
    list.push(task)
    this.tasks.set(sessionPath, list)
  }

  update(sessionPath: string, taskId: string, updates: Partial<DeferredTask>): void {
    const list = this.tasks.get(sessionPath) || []
    const task = list.find(t => t.taskId === taskId)
    if (task) Object.assign(task, updates)
  }

  remove(sessionPath: string, taskId: string): void {
    const list = this.tasks.get(sessionPath) || []
    this.tasks.set(sessionPath, list.filter(t => t.taskId !== taskId))
  }
}

let _store: DeferredResultStore | null = null

export function getDeferredStore(): DeferredResultStore {
  if (!_store) _store = new DeferredResultStore()
  return _store
}

export interface CheckPendingTasksArgs {
  status?: string
}

export async function execute(args: CheckPendingTasksArgs, ctx?: any): Promise<{ content: { type: 'text'; text: string }[] }> {
  const store = getDeferredStore()
  // 轻量实现：使用 cwd 作为 sessionPath
  const sessionPath = ctx?.sessionPath || process.cwd()

  if (!sessionPath) {
    return { content: [{ type: 'text', text: 'Error: No active session path' }] }
  }

  let all: DeferredTask[] = []
  try {
    all = store.listBySession(sessionPath)
  } catch {
    return { content: [{ type: 'text', text: 'Error: Deferred store unavailable' }] }
  }

  const filtered = args.status ? all.filter(t => t.status === args.status) : all

  if (filtered.length === 0) {
    const qualifier = args.status ? ` (status=${args.status})` : ''
    return { content: [{ type: 'text', text: `No pending tasks found${qualifier}` }] }
  }

  const summary = filtered.map(t => ({
    taskId: t.taskId,
    status: t.status,
    type: t.type || 'unknown',
    deferredAt: new Date(t.deferredAt).toISOString(),
    ...(t.result != null ? { result: t.result } : {}),
    ...(t.reason != null ? { reason: t.reason } : {}),
  }))

  return { content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }] }
}
