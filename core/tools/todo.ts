/**
 * todo.ts — 替换式 todo 工具（对标 Claude Code TodoWrite）
 *
 * 每次调用传入完整 todos 数组，替换之前整个列表。
 * 三态状态机：pending / in_progress / completed
 * 双文本：content（静态描述）+ activeForm（进行中显示文本）
 *
 * 用法：复杂多步骤任务时调用，简单单步任务不需要。
 */

export interface TodoItem {
  content: string
  activeForm: string
  status: 'pending' | 'in_progress' | 'completed'
}

export interface TodoToolResult {
  todos: TodoItem[]
  summary: string
  warning?: string
}

const TODO_STATUS_VALUES = ['pending', 'in_progress', 'completed'] as const

function buildSummary(todos: TodoItem[]): string {
  if (todos.length === 0) return '待办列表已清空。'
  const counts = { pending: 0, in_progress: 0, completed: 0 }
  for (const td of todos) counts[td.status] = (counts[td.status] || 0) + 1
  return `待办列表（共 ${todos.length} 项）：✅ 完成 ${counts.completed} / 🔄 进行中 ${counts.in_progress} / ⏔ 待处理 ${counts.pending}`
}

function detectMultiInProgress(todos: TodoItem[]): string | null {
  const count = todos.filter(td => td.status === 'in_progress').length
  if (count > 1) {
    return `警告：有 ${count} 个任务同时进行（建议一次只做一个）。`
  }
  return null
}

// ── 工具注册 ─────────────────────────────────────────────

export function registerTodoTool(registry: any): void {
  registry.register({
    name: 'todo',
    description: '管理会话待办列表，用于多步骤复杂任务。将复杂任务分解为子任务，跟踪进度。简单单步任务不需要使用此工具。每次调用会替换整个列表（替换式协议）。',
    parameters: {
      type: 'object',
      properties: {
        todos: {
          type: 'array',
          description: '完整待办列表；每次调用替换之前的整个列表。',
          items: {
            type: 'object',
            properties: {
              content: { type: 'string', description: '任务静态描述（用于已完成/待处理状态显示）' },
              activeForm: { type: 'string', description: '任务进行中时的显示文本（如"正在搜索资料"）' },
              status: {
                type: 'string',
                enum: ['pending', 'in_progress', 'completed'],
                description: '状态：pending（待处理）/ in_progress（进行中）/ completed（已完成）',
              },
            },
            required: ['content', 'activeForm', 'status'],
          },
        },
      },
      required: ['todos'],
    },
    execute: async (args: any) => {
      const todos: TodoItem[] = (args.todos || []).map((td: any) => ({
        content: String(td.content || ''),
        activeForm: String(td.activeForm || td.content || ''),
        status: TODO_STATUS_VALUES.includes(td.status) ? td.status : 'pending',
      }))

      const warning = detectMultiInProgress(todos)
      const summary = buildSummary(todos)

      // 格式化输出
      const lines = todos.map((td) => {
        const icon = td.status === 'completed' ? '✅' : td.status === 'in_progress' ? '🔄' : '⏔'
        const form = td.status === 'in_progress' ? ` — ${td.activeForm}` : ''
        return `  ${icon} ${td.content}${form}`
      })

      const text = [
        summary,
        ...lines,
        warning ? `\n⚠️ ${warning}` : '',
      ].filter(Boolean).join('\n')

      return {
        content: [{ type: 'text', text }],
        details: { todos, summary, warning },
      }
    },
  })
}
