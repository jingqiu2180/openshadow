// @ts-nocheck
/**
 * Terminal 工具（对齐 openhanako）
 * 管理持久化终端会话，支持 start / write / read / close / list
 */

import { getTerminalSessionManager } from '../terminal/terminal-session-manager'
import { createToolSpec } from '../tool-registry'
import type { ToolRegistry } from '../tool-registry'

const DEFAULT_SESSION = 'default'

export function registerTerminalTool(registry: ToolRegistry): void {
  const manager = getTerminalSessionManager()

  // ─── start：创建终端会话 ─────────────────────────────
  registry.register(
    'terminal_start',
    createToolSpec('terminal_start', {
      description: '创建持久化终端会话（类似 tmux/screen）。会话保持运行，可多次读写。',
      params: {
        cwd: { type: 'string', description: '工作目录（绝对路径）' },
        command: { type: 'string', description: '初始命令（可选）' },
        label: { type: 'string', description: '会话标签（可选）' },
      },
    }),
    async (args: any) => {
      try {
        const result = await manager.start({
          sessionPath: DEFAULT_SESSION,
          cwd: args.cwd,
          command: args.command || '',
          label: args.label || '',
        })
        return {
          content: [{ type: 'text', text: `终端会话已创建：#${result.terminalId}\n状态：${result.status}` }],
        }
      } catch (err: any) {
        return { content: [{ type: 'text', text: `创建终端会话失败：${err.message}` }] }
      }
    }
  )

  // ─── write：写入命令 ─────────────────────────────
  registry.register(
    'terminal_write',
    createToolSpec('terminal_write', {
      description: '向终端会话写入命令或文本。',
      params: {
        terminalId: { type: 'string', description: '终端会话 ID' },
        chars: { type: 'string', description: '要写入的文本或命令' },
      },
    }),
    async (args: any) => {
      try {
        const result = manager.write({
          sessionPath: DEFAULT_SESSION,
          terminalId: args.terminalId,
          chars: args.chars,
        })
        return {
          content: [{ type: 'text', text: `输出：\n${result.output}` }],
        }
      } catch (err: any) {
        return { content: [{ type: 'text', text: `写入失败：${err.message}` }] }
      }
    }
  )

  // ─── read：读取输出 ─────────────────────────────
  registry.register(
    'terminal_read',
    createToolSpec('terminal_read', {
      description: '读取终端会话的输出。',
      params: {
        terminalId: { type: 'string', description: '终端会话 ID' },
        sinceSeq: { type: 'number', description: '从第几条输出开始读（可选）' },
      },
    }),
    async (args: any) => {
      try {
        const result = manager.read({
          sessionPath: DEFAULT_SESSION,
          terminalId: args.terminalId,
          sinceSeq: args.sinceSeq,
        })
        if (!result.output) {
          return { content: [{ type: 'text', text: '暂无新输出。' }] }
        }
        return {
          content: [{ type: 'text', text: `输出：\n${result.output}` }],
        }
      } catch (err: any) {
        return { content: [{ type: 'text', text: `读取失败：${err.message}` }] }
      }
    }
  )

  // ─── close：关闭会话 ─────────────────────────────
  registry.register(
    'terminal_close',
    createToolSpec('terminal_close', {
      description: '关闭终端会话。',
      params: {
        terminalId: { type: 'string', description: '终端会话 ID' },
      },
    }),
    async (args: any) => {
      try {
        const result = manager.close({
          sessionPath: DEFAULT_SESSION,
          terminalId: args.terminalId,
        })
        return {
          content: [{ type: 'text', text: `终端会话 #${args.terminalId} 已关闭，状态：${result.status}` }],
        }
      } catch (err: any) {
        return { content: [{ type: 'text', text: `关闭失败：${err.message}` }] }
      }
    }
  )

  // ─── list：列出会话 ─────────────────────────────
  registry.register(
    'terminal_list',
    createToolSpec('terminal_list', {
      description: '列出当前会话的所有终端。',
      params: {},
    }),
    async () => {
      try {
        const result = manager.list(DEFAULT_SESSION)
        if (result.terminals.length === 0) {
          return { content: [{ type: 'text', text: '当前没有终端会话。' }] }
        }
        const lines = result.terminals.map((t: any, i: number) => {
          return `${i + 1}. #${t.terminalId} [${t.status}] ${t.label || '(无标签)'} (创建于 ${new Date(t.createdAt).toLocaleString()})`
        })
        return { content: [{ type: 'text', text: `终端会话列表（共 ${result.terminals.length} 个）：\n${lines.join('\n')}` }] }
      } catch (err: any) {
        return { content: [{ type: 'text', text: `列出失败：${err.message}` }] }
      }
    }
  )
}
