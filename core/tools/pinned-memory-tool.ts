// @ts-nocheck
/**
 * Pinned Memory 工具（对齐 openhanako）
 * 管理固定记忆，支持 pin / unpin / list / search / clear
 */

import { getPinnedMemoryStore } from '../pinned-memory-store'
import { createToolSpec } from '../tool-registry'
import type { ToolRegistry } from '../tool-registry'

export function registerPinnedMemoryTool(registry: ToolRegistry): void {
  const store = getPinnedMemoryStore()

  // ─── pin：固定一条记忆 ─────────────────────────────
  registry.register(
    'pinned_memory_pin',
    createToolSpec('pinned_memory_pin', {
      description: '固定一条重要记忆，使其在会话中持续可用。支持重要性评分（0-1）。',
      params: {
        content: { type: 'string', description: '要固定的记忆内容' },
        keywords: { type: 'array', items: { type: 'string' }, description: '关键词列表，用于搜索（可选）' },
        importance: { type: 'number', description: '重要性评分（0-1），默认 0.5' },
      },
    }),
    async (args: any) => {
      const keywords = args.keywords ? JSON.stringify(args.keywords) : '[]'
      store.upsert({
        id: '', // 自动生成
        content: args.content,
        keywords,
        importance: args.importance ?? 0.5,
      })
      const memories = store.listAll(1)
      const lastId = memories.length > 0 ? memories[0].id : 'unknown'
      return {
        content: [{ type: 'text', text: `已固定记忆 #${lastId.slice(0, 8)}：${args.content.slice(0, 50)}...` }],
      }
    }
  )

  // ─── unpin：取消固定 ─────────────────────────────
  registry.register(
    'pinned_memory_unpin',
    createToolSpec('pinned_memory_unpin', {
      description: '取消固定一条记忆。',
      params: {
        id: { type: 'string', description: '要取消固定的记忆 ID' },
      },
    }),
    async (args: any) => {
      const ok = store.delete(args.id)
      if (!ok) {
        return { content: [{ type: 'text', text: `未找到记忆 #${args.id}` }] }
      }
      return { content: [{ type: 'text', text: `已取消固定 #${args.id}` }] }
    }
  )

  // ─── list：列出所有固定记忆 ─────────────────────────────
  registry.register(
    'pinned_memory_list',
    createToolSpec('pinned_memory_list', {
      description: '列出所有固定记忆，按重要性排序。',
      params: {
        limit: { type: 'number', description: '返回数量上限，默认 20' },
      },
    }),
    async (args: any) => {
      const memories = store.listAll(args.limit ?? 20)
      if (memories.length === 0) {
        return { content: [{ type: 'text', text: '当前没有固定记忆。' }] }
      }
      const lines = memories.map((m, i) => {
        const kw = JSON.parse(m.keywords).join(', ')
        return `${i + 1}. #${m.id.slice(0, 8)} [重要性:${m.importance.toFixed(2)}] ${m.content.slice(0, 60)}... (关键词: ${kw})`
      })
      return { content: [{ type: 'text', text: `固定记忆列表（共 ${memories.length} 条）：\n${lines.join('\n')}` }] }
    }
  )

  // ─── search：搜索固定记忆 ─────────────────────────────
  registry.register(
    'pinned_memory_search',
    createToolSpec('pinned_memory_search', {
      description: '根据关键词搜索固定记忆。',
      params: {
        keyword: { type: 'string', description: '搜索关键词' },
        limit: { type: 'number', description: '返回数量上限，默认 5' },
      },
    }),
    async (args: any) => {
      const memories = store.search(args.keyword, args.limit ?? 5)
      if (memories.length === 0) {
        return { content: [{ type: 'text', text: `未找到包含"${args.keyword}"的固定记忆。` }] }
      }
      const lines = memories.map((m, i) => {
        return `${i + 1}. #${m.id.slice(0, 8)} ${m.content.slice(0, 80)}...`
      })
      return { content: [{ type: 'text', text: `搜索结果（共 ${memories.length} 条）：\n${lines.join('\n')}` }] }
    }
  )

  // ─── clear：清空所有固定记忆 ─────────────────────────────
  registry.register(
    'pinned_memory_clear',
    createToolSpec('pinned_memory_clear', {
      description: '清空所有固定记忆（谨慎使用）。',
      params: {},
    }),
    async () => {
      const count = store.clear()
      return { content: [{ type: 'text', text: `已清空 ${count} 条固定记忆。` }] }
    }
  )
}
