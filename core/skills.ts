// @ts-nocheck
import { readdir, readFile, stat, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import { ToolRegistry } from './tool-registry.js'
import { eventBus } from './event-bus.js'

export interface SkillTool {
  name: string
  description: string
  params: Record<string, {
    type: string
    description: string
    optional?: boolean
    default?: unknown
  }>
}

export interface SkillManifest {
  name: string
  description: string
  version: string
  author?: string
  tags?: string[]
  tools: SkillTool[]
  dependencies?: string[]
  readme?: string
}

export interface Skill {
  manifest: SkillManifest
  rootDir: string
  handler: (toolName: string, args: Record<string, unknown>) => Promise<unknown>
}

export interface SkillResult {
  success: boolean
  result?: unknown
  error?: string
}

export interface PluginContribution {
  tools?: Array<{
    name: string
    description: string
    params: SkillTool['params']
    handler: (args: Record<string, unknown>) => Promise<unknown>
  }>
  routes?: Array<{
    path: string
    method: 'GET' | 'POST' | 'PUT' | 'DELETE'
    handler: (req: any, res: any) => void | Promise<void>
  }>
  skills?: Skill[]
  hooks?: Record<string, (...args: any[]) => void | Promise<void>>
}

export interface PluginManifest {
  id: string
  name: string
  version: string
  description: string
  author?: string
  contributions: PluginContribution
}

function parseManifest(content: string, name: string): SkillManifest {
  const manifest: SkillManifest = {
    name,
    description: '',
    version: '1.0.0',
    tools: [],
  }

  let currentTool: SkillTool | null = null

  for (const line of content.split('\n')) {
    const metaMatch = line.match(/^\*\*([a-zA-Z]+):\*\*\s*(.+)$/)
    if (metaMatch) {
      const [, key, value] = metaMatch
      if (key === 'name') manifest.name = value
      else if (key === 'description') manifest.description = value
      else if (key === 'version') manifest.version = value
      else if (key === 'author') manifest.author = value
      else if (key === 'tags') manifest.tags = value.split(',').map(t => t.trim())
    }

    const skillMatch = line.match(/^## Skill:\s*(.+)$/)
    if (skillMatch) {
      if (currentTool) manifest.tools.push(currentTool)
      currentTool = { name: skillMatch[1].trim(), description: '', params: {} }
    }

    const paramMatch = line.match(/^- \*\*(\w+)\*\* \(([^)]+)\)(?:\s*-\s*(.+))?$/)
    if (paramMatch && currentTool) {
      const [, pname, ptype, pdesc] = paramMatch
      currentTool.params[pname] = {
        type: ptype.trim(),
        description: (pdesc ?? '').trim(),
      }
    }
  }

  if (currentTool) manifest.tools.push(currentTool)
  return manifest
}

export class SkillStore {
  private _skills = new Map<string, Skill>()
  private _plugins = new Map<string, PluginManifest>()

  async loadFrom(dir: string): Promise<{ loaded: string[]; failed: string[] }> {
    const loaded: string[] = []
    const failed: string[] = []

    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true })
      return { loaded, failed }
    }

    let entries: string[] = []
    try {
      entries = await readdir(dir)
    } catch {
      return { loaded, failed }
    }

    for (const entry of entries) {
      const skillDir = join(dir, entry)
      try {
        const info = await stat(skillDir)
        if (!info.isDirectory()) continue

        const manifestPath = join(skillDir, 'SKILL.md')
        const content = await readFile(manifestPath, 'utf-8')
        const manifest = parseManifest(content, entry)

        this._skills.set(manifest.name, {
          manifest,
          rootDir: skillDir,
          handler: async () => ({ result: `Skill "${manifest.name}" executed` }),
        })

        loaded.push(manifest.name)
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        failed.push(entry + ': ' + msg)
      }
    }

    return { loaded, failed }
  }

  register(skill: Skill): void {
    this._skills.set(skill.manifest.name, skill)
  }

  get(name: string): Skill | undefined {
    return this._skills.get(name)
  }

  list(): SkillManifest[] {
    return [...this._skills.values()].map(s => s.manifest)
  }

  findByTag(tag: string): SkillManifest[] {
    return this.list().filter(s => s.tags?.includes(tag))
  }

  search(query: string): SkillManifest[] {
    const q = query.toLowerCase()
    return this.list().filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.tags?.some(t => t.toLowerCase().includes(q))
    )
  }

  async execute(skillName: string, toolName: string, args: Record<string, unknown> = {}): Promise<SkillResult> {
    const skill = this._skills.get(skillName)
    if (!skill) return { success: false, error: `Skill not found: ${skillName}` }

    try {
      const result = await skill.handler(toolName, args)
      return { success: true, result }
    } catch (e: unknown) {
      return { success: false, error: e instanceof Error ? e.message : String(e) }
    }
  }

  registerPlugin(plugin: PluginManifest): void {
    this._plugins.set(plugin.id, plugin)
    eventBus.emit('plugin:load', { pluginId: plugin.id })
  }

  getPlugin(id: string): PluginManifest | undefined {
    return this._plugins.get(id)
  }

  listPlugins(): PluginManifest[] {
    return [...this._plugins.values()]
  }

  unregisterPlugin(id: string): void {
    this._plugins.delete(id)
  }

  contributeToRegistry(registry: ToolRegistry): void {
    for (const plugin of this._plugins.values()) {
      const tools = plugin.contributions.tools ?? []
      for (const tool of tools) {
        registry.register(tool.name, {
          type: 'function',
          function: {
            name: tool.name,
            description: tool.description,
            parameters: {
              type: 'object',
              properties: Object.fromEntries(
                Object.entries(tool.params).map(([k, v]) => [k, { type: v.type, description: v.description }])
              ),
              required: Object.entries(tool.params).filter(([, v]) => !v.optional).map(([k]) => k),
            },
          },
        }, tool.handler)
      }
    }

    for (const skill of this._skills.values()) {
      for (const tool of skill.manifest.tools) {
        if (!registry.get(tool.name)) {
          registry.register(tool.name, {
            type: 'function',
            function: {
              name: tool.name,
              description: tool.description,
              parameters: {
                type: 'object',
                properties: Object.fromEntries(
                  Object.entries(tool.params).map(([k, v]) => [k, { type: v.type, description: v.description }])
                ),
                required: Object.entries(tool.params).filter(([, v]) => !v.optional).map(([k]) => k),
              },
            },
          }, async (args) => skill.handler(tool.name, args))
        }
      }
    }
  }
}

export const BUILTIN_SKILLS: Skill[] = [
  {
    manifest: {
      name: 'memory-management',
      description: '记忆管理：读取、写入、搜索长期记忆',
      version: '1.0.0',
      tags: ['memory', 'core'],
      tools: [
        {
          name: 'read_memories',
          description: '读取最近的记忆',
          params: { limit: { type: 'number', description: '最大条数', optional: true, default: 10 } },
        },
        {
          name: 'write_memory',
          description: '写入新记忆',
          params: { content: { type: 'string', description: '记忆内容' }, importance: { type: 'number', description: '重要性 1-5', optional: true } },
        },
        {
          name: 'search_memory',
          description: '搜索记忆',
          params: { query: { type: 'string', description: '搜索关键词' } },
        },
      ],
    },
    rootDir: '',
    handler: async (_tool: string, _args: Record<string, unknown>) => ({ result: 'memory-management skill' }),
  },
  {
    manifest: {
      name: 'web-search',
      description: '网络搜索：查找信息、新闻、文档',
      version: '1.0.0',
      tags: ['web', 'search'],
      tools: [
        { name: 'search', description: '搜索网络', params: { query: { type: 'string', description: '搜索词' }, count: { type: 'number', description: '结果数量', optional: true } } },
        { name: 'fetch_page', description: '获取网页内容', params: { url: { type: 'string', description: '网页URL' } } },
      ],
    },
    rootDir: '',
    handler: async (_tool: string, _args: Record<string, unknown>) => ({ result: 'web-search skill placeholder' }),
  },
  {
    manifest: {
      name: 'file-manager',
      description: '文件管理：浏览、复制、移动、压缩文件',
      version: '1.0.0',
      tags: ['file', 'tools'],
      tools: [
        { name: 'list_files', description: '列出目录文件', params: { path: { type: 'string', description: '目录路径' } } },
        { name: 'copy_file', description: '复制文件', params: { src: { type: 'string', description: '源路径' }, dest: { type: 'string', description: '目标路径' } } },
        { name: 'delete_file', description: '删除文件', params: { path: { type: 'string', description: '文件路径' } } },
      ],
    },
    rootDir: '',
    handler: async (_tool: string, _args: Record<string, unknown>) => ({ result: 'file-manager skill placeholder' }),
  },
  {
    manifest: {
      name: 'code-helper',
      description: '代码助手：生成、检查、重构代码',
      version: '1.0.0',
      tags: ['code', 'development'],
      tools: [
        { name: 'generate', description: '生成代码', params: { spec: { type: 'string', description: '需求描述' }, language: { type: 'string', description: '编程语言', optional: true } } },
        { name: 'review', description: '代码审查', params: { code: { type: 'string', description: '代码内容' } } },
        { name: 'refactor', description: '代码重构', params: { code: { type: 'string', description: '待重构代码' }, goal: { type: 'string', description: '重构目标' } } },
      ],
    },
    rootDir: '',
    handler: async (_tool: string, _args: Record<string, unknown>) => ({ result: 'code-helper skill placeholder' }),
  },
  {
    manifest: {
      name: 'calculator',
      description: '计算器：数学运算、汇率换算、单位转换',
      version: '1.0.0',
      tags: ['utility'],
      tools: [
        { name: 'calc', description: '计算数学表达式', params: { expression: { type: 'string', description: '表达式如 2+3*4' } } },
        { name: 'convert', description: '单位换算', params: { value: { type: 'number', description: '数值' }, from: { type: 'string', description: '源单位' }, to: { type: 'string', description: '目标单位' } } },
      ],
    },
    rootDir: '',
    handler: async (tool: string, args: Record<string, unknown>) => {
      if (tool === 'calc') {
        try {
          const result = Function('"use strict"; return (' + String(args.expression) + ')')()
          return { expression: args.expression, result }
        } catch {
          return { error: 'Invalid expression' }
        }
      }
      return { result: 'calculator skill' }
    },
  },
  {
    manifest: {
      name: 'scheduler',
      description: '任务调度：创建定时任务、查看计划、管理 Cron',
      version: '1.0.0',
      tags: ['scheduler', 'tasks'],
      tools: [
        { name: 'schedule', description: '创建定时任务', params: { cron: { type: 'string', description: 'Cron 表达式' }, task: { type: 'string', description: '任务内容' } } },
        { name: 'list_scheduled', description: '列出所有定时任务', params: {} },
        { name: 'cancel', description: '取消定时任务', params: { jobId: { type: 'string', description: '任务ID' } } },
      ],
    },
    rootDir: '',
    handler: async (_tool: string, _args: Record<string, unknown>) => ({ result: 'scheduler skill placeholder' }),
  },
]

export function createSkillStore(skillsDir?: string): SkillStore {
  const store = new SkillStore()
  for (const skill of BUILTIN_SKILLS) {
    store.register(skill)
  }
  if (skillsDir) {
    store.loadFrom(skillsDir).catch(() => {})
  }
  return store
}
