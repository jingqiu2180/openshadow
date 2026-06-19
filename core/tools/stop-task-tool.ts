// @ts-nocheck
/**
 * stop-task-tool.ts — 终止后台任务工具
 *
 * 对标 openhanako 的 stop_task 工具（STANDARD 分类）。
 * 通过 TaskRegistry 终止后台任务（子代理、生图、生视频等）。
 *
 * 轻量实现：使用简单的内存注册表。
 * 完整实现需要集成 remu 的任务管理系统。
 */

export interface StopTaskArgs {
  task_id: string
}

// 简单的内存任务注册表（轻量实现）
class TaskRegistry {
  private tasks: Map<string, { status: string; abort: () => void }> = new Map()

  register(taskId: string, abortFn: () => void): void {
    this.tasks.set(taskId, { status: 'running', abort: abortFn })
  }

  abort(taskId: string): string {
    const task = this.tasks.get(taskId)
    if (!task) return 'not_found'
    if (task.status === 'aborted') return 'already_aborted'
    task.status = 'aborted'
    try {
      task.abort()
      return 'done'
    } catch {
      return 'no_handler'
    }
  }

  unregister(taskId: string): void {
    this.tasks.delete(taskId)
  }
}

let _registry: TaskRegistry | null = null

export function getTaskRegistry(): TaskRegistry {
  if (!_registry) _registry = new TaskRegistry()
  return _registry
}

export async function execute(args: StopTaskArgs): Promise<{ content: { type: 'text'; text: string }[] }> {
  const taskId = args.task_id?.trim()
  if (!taskId) {
    return { content: [{ type: 'text', text: 'Error: task_id is required' }] }
  }

  const registry = getTaskRegistry()
  const result = registry.abort(taskId)

  switch (result) {
    case 'not_found':
      return { content: [{ type: 'text', text: `Error: Task not found: ${taskId}` }] }
    case 'already_aborted':
      return { content: [{ type: 'text', text: `Task already stopped: ${taskId}` }] }
    case 'no_handler':
      return { content: [{ type: 'text', text: `Error: No abort handler for task: ${taskId}` }] }
    case 'done':
      return { content: [{ type: 'text', text: `Task stopped: ${taskId}` }] }
    default:
      return { content: [{ type: 'text', text: `Error: Unknown result: ${result}` }] }
  }
}
