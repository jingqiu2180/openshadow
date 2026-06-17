import { serve } from '@hono/node-server'
import { Agent } from '../core/agent.js'
import { createScheduler } from '../core/scheduler.js'
import { createSummarizer } from '../core/memory/summarizer.js'
import { addCronJob, saveAgentConfig, cleanupOldMemories } from '../core/memory/store.js'
import { createFeishuChannel } from '../channels/feishu.js'
import { createWsServer } from '../server/ws.js'
import { config as configManager } from '../core/config.js'
import { modelManager } from '../core/model-manager.js'
import { SessionManager } from '../core/session-manager.js'
import { eventBus } from '../core/event-bus.js'
import { usageTracker } from '../core/providers/usage-tracker.js'
import { createDeepMemoryProcessor } from '../core/memory/deep-memory.js'
import { createSkillStore } from '../core/skills.js'
import { promises as fs } from 'fs'
import { join, sep, resolve } from 'path'

export interface MainOptions {
  port?: number
  wsPort?: number
  agentId: string
  allowedPaths?: string[]
}

export async function startServer(options: MainOptions) {
  const port = options.port ?? 3000
  const wsPort = options.wsPort ?? 8080
  const agentId = options.agentId

  saveAgentConfig({
    id: agentId,
    name: 'Rem Agent',
    personality: 'default',
    model: process.env.AGENT_MODEL ?? 'abab6.5s-chat',
    apiKey: process.env.AGENT_API_KEY ?? '',
    baseUrl: process.env.AGENT_BASE_URL ?? 'https://api.openai.com/v1',
    allowedPaths: options.allowedPaths ?? ['/tmp', process.cwd()],
  })

  const agent = new Agent({ agentId })
  const sessionManager = new SessionManager(agent.engine)
  const skillStore = createSkillStore()

  skillStore.contributeToRegistry(agent.engine.getToolRegistry())

  const httpApp = createFeishuChannel(agent)

  httpApp.get('/api/config/security', async (c) => {
    const sec = configManager.getSecurity()
    return c.json({
      workspaceRoots: sec.workspaceRoots ?? [],
      allowExternalReads: sec.allowExternalReads ?? true,
      sandbox: sec.sandbox ?? true,
      writablePaths: sec.writablePaths ?? [],
    })
  })

  httpApp.post('/api/config/security', async (c) => {
    try {
      const body = await c.req.json()
      const sec = configManager.getSecurity()
      if (body.workspaceRoots !== undefined) sec.workspaceRoots = body.workspaceRoots
      if (body.allowExternalReads !== undefined) sec.allowExternalReads = body.allowExternalReads
      if (body.sandbox !== undefined) sec.sandbox = body.sandbox
      if (body.writablePaths !== undefined) sec.writablePaths = body.writablePaths
      configManager.set('security', sec)
      return c.json({ ok: true })
    } catch (e: any) {
      return c.json({ ok: false, error: e.message }, 400)
    }
  })

  httpApp.get('/api/config/theme', (c) => {
    return c.json({ theme: configManager.getTheme() })
  })

  httpApp.post('/api/config/theme', async (c) => {
    try {
      const body = await c.req.json()
      const theme = body.theme
      if (theme !== 'warm-paper' && theme !== 'cool-night' && theme !== 'auto') {
        return c.json({ ok: false, error: `Invalid theme: ${theme}` }, 400)
      }
      configManager.set('theme', theme)
      return c.json({ ok: true, theme: configManager.getTheme() })
    } catch (e: any) {
      return c.json({ ok: false, error: e.message }, 400)
    }
  })

  // ─── 2.1 /api/config — 完整配置 ─────────────────────────────
  httpApp.get('/api/config', (c) => {
    const sec = configManager.getSecurity()
    const memory = configManager.get('memory') ?? { enabled: true }
    const models = configManager.get('models') ?? {}
    return c.json({
      providers: configManager.getProviders(),
      security: sec,
      theme: configManager.getTheme(),
      memory,
      models,
      permissionMode: (sec as any).permissionMode ?? 'ask',
    })
  })

  // ─── 2.2 /api/fs/tree — 工作区目录树 ────────────────────────
  httpApp.get('/api/fs/tree', async (c) => {
    try {
      const reqPath = c.req.query('path') ?? ''
      const depth = Math.max(1, Math.min(8, parseInt(c.req.query('depth') ?? '3', 10)))
      if (!reqPath) return c.json({ tree: [] })

      // 安全检查：路径必须在 workspaceRoots 内
      const sec = configManager.getSecurity()
      const roots: string[] = sec.workspaceRoots ?? []
      const abs = resolve(reqPath)
      const ok = roots.some(r => {
        const rr = resolve(r)
        return abs === rr || abs.startsWith(rr + sep) || abs.startsWith(rr + '/')
      })
      if (!ok) return c.json({ ok: false, error: 'Path outside workspace roots' }, 403)

      const tree = await buildTree(abs, depth, 0)
      return c.json({ tree })
    } catch (e: any) {
      return c.json({ ok: false, error: e.message }, 500)
    }
  })

  // ─── 2.6 /api/fs/read — 读文件内容 ────────────────────────
  httpApp.get('/api/fs/read', async (c) => {
    try {
      const reqPath = c.req.query('path') ?? ''
      if (!reqPath) return c.json({ ok: false, error: 'path required' }, 400)
      const sec = configManager.getSecurity()
      const roots: string[] = sec.workspaceRoots ?? []
      const abs = resolve(reqPath)
      const ok = roots.some(r => {
        const rr = resolve(r)
        return abs === rr || abs.startsWith(rr + sep) || abs.startsWith(rr + '/')
      })
      if (!ok) return c.json({ ok: false, error: 'Path outside workspace roots' }, 403)
      const stat = await fs.stat(abs)
      if (stat.isDirectory()) return c.json({ ok: false, error: 'Is a directory' }, 400)
      if (stat.size > 2 * 1024 * 1024) return c.json({ ok: false, error: 'File too large (>2MB)' }, 413)
      const content = await fs.readFile(abs, 'utf-8')
      return c.json({ ok: true, content, size: stat.size, mtime: stat.mtimeMs })
    } catch (e: any) {
      return c.json({ ok: false, error: e.message }, 500)
    }
  })

  // ─── 2.7 /api/fs/write — 写文件内容 ────────────────────────
  httpApp.post('/api/fs/write', async (c) => {
    try {
      const body = await c.req.json() as { path?: string; content?: string }
      if (!body.path) return c.json({ ok: false, error: 'path required' }, 400)
      const sec = configManager.getSecurity()
      const roots: string[] = sec.workspaceRoots ?? []
      const abs = resolve(body.path)
      const ok = roots.some(r => {
        const rr = resolve(r)
        return abs === rr || abs.startsWith(rr + sep) || abs.startsWith(rr + '/')
      })
      if (!ok) return c.json({ ok: false, error: 'Path outside workspace roots' }, 403)
      await fs.writeFile(abs, body.content ?? '', 'utf-8')
      return c.json({ ok: true })
    } catch (e: any) {
      return c.json({ ok: false, error: e.message }, 500)
    }
  })

  async function buildTree(absPath: string, maxDepth: number, curDepth: number): Promise<any[]> {
    let entries: any[]
    try {
      const list = await fs.readdir(absPath, { withFileTypes: true })
      entries = list
        .filter(e => !e.name.startsWith('.') && e.name !== 'node_modules')
        .sort((a, b) => {
          // 目录在前,文件在后,按名字排
          if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1
          return a.name.localeCompare(b.name)
        })
    } catch {
      return []
    }
    const out: any[] = []
    for (const e of entries) {
      const full = join(absPath, e.name)
      let size = 0
      let children: any[] | undefined = undefined
      if (e.isDirectory()) {
        if (curDepth < maxDepth) {
          children = await buildTree(full, maxDepth, curDepth + 1)
        }
      } else {
        try {
          const st = await fs.stat(full)
          size = st.size
        } catch {}
      }
      out.push({
        name: e.name,
        path: full,
        isDirectory: e.isDirectory(),
        size,
        children,
      })
    }
    return out
  }

  // ─── 1.4 文件操作（DeskPanel 右键菜单用）────────────────────
  httpApp.post('/api/fs/file', async (c) => {
    try {
      const { parentPath, name } = await c.req.json()
      if (!parentPath || !name) return c.json({ ok: false, error: 'parentPath/name required' }, 400)
      if (!isInWorkspace(parentPath)) return c.json({ ok: false, error: 'outside workspace' }, 403)
      const full = join(parentPath, name)
      await fs.writeFile(full, '', 'utf-8')
      return c.json({ ok: true, path: full })
    } catch (e: any) {
      return c.json({ ok: false, error: e.message }, 500)
    }
  })

  httpApp.post('/api/fs/folder', async (c) => {
    try {
      const { parentPath, name } = await c.req.json()
      if (!parentPath || !name) return c.json({ ok: false, error: 'parentPath/name required' }, 400)
      if (!isInWorkspace(parentPath)) return c.json({ ok: false, error: 'outside workspace' }, 403)
      const full = join(parentPath, name)
      await fs.mkdir(full, { recursive: false })
      return c.json({ ok: true, path: full })
    } catch (e: any) {
      return c.json({ ok: false, error: e.message }, 500)
    }
  })

  httpApp.put('/api/fs/rename', async (c) => {
    try {
      const { oldPath, newName } = await c.req.json()
      if (!oldPath || !newName) return c.json({ ok: false, error: 'oldPath/newName required' }, 400)
      if (!isInWorkspace(oldPath)) return c.json({ ok: false, error: 'outside workspace' }, 403)
      const parent = oldPath.split(/[\\/]/).slice(0, -1).join(sep === '/' ? '/' : '\\')
      const newPath = join(parent, newName)
      await fs.rename(oldPath, newPath)
      return c.json({ ok: true, path: newPath })
    } catch (e: any) {
      return c.json({ ok: false, error: e.message }, 500)
    }
  })

  httpApp.delete('/api/fs', async (c) => {
    try {
      const path = c.req.query('path') ?? ''
      if (!path) return c.json({ ok: false, error: 'path required' }, 400)
      if (!isInWorkspace(path)) return c.json({ ok: false, error: 'outside workspace' }, 403)
      const stat = await fs.stat(path)
      if (stat.isDirectory()) {
        await fs.rm(path, { recursive: true, force: true })
      } else {
        await fs.unlink(path)
      }
      return c.json({ ok: true })
    } catch (e: any) {
      return c.json({ ok: false, error: e.message }, 500)
    }
  })

  function isInWorkspace(p: string): boolean {
    const sec = configManager.getSecurity()
    const roots: string[] = sec.workspaceRoots ?? []
    const abs = resolve(p)
    return roots.some(r => {
      const rr = resolve(r)
      return abs === rr || abs.startsWith(rr + sep) || abs.startsWith(rr + '/')
    })
  }

  // ─── 2.3 /api/models/set — 切换当前模型 ────────────────────
  httpApp.post('/api/models/set', async (c) => {
    try {
      const { provider, model, role } = await c.req.json()
      if (!provider || !model) return c.json({ ok: false, error: 'provider/model required' }, 400)
      const r = role ?? 'main'
      modelManager.switchModel(r, provider, model)
      // 同步写回 config.models[role] = 'provider::model'
      const models = configManager.get('models') ?? {}
      ;(models as any)[r] = `${provider}::${model}`
      ;(configManager as any).set('models', models)
      return c.json({ ok: true, model: { provider, model, role: r } })
    } catch (e: any) {
      return c.json({ ok: false, error: e.message }, 500)
    }
  })

  // ─── 2.4 /api/config/memory — 记忆开关 ───────────────────────
  httpApp.post('/api/config/memory', async (c) => {
    try {
      const { enabled } = await c.req.json()
      const memory = configManager.get('memory') ?? { enabled: true }
      ;(memory as any).enabled = !!enabled
      configManager.set('memory', memory)
      return c.json({ ok: true, enabled: (memory as any).enabled })
    } catch (e: any) {
      return c.json({ ok: false, error: e.message }, 500)
    }
  })

  // ─── 2.5 /api/permissions/set — Plan mode 切换 ──────────────
  httpApp.post('/api/permissions/set', async (c) => {
    try {
      const { mode } = await c.req.json()
      const valid = ['auto', 'ask', 'read_only', 'operate']
      if (!valid.includes(mode)) return c.json({ ok: false, error: 'invalid mode' }, 400)
      const sec = configManager.getSecurity() as any
      sec.permissionMode = mode
      configManager.set('security', sec)
      return c.json({ ok: true, mode })
    } catch (e: any) {
      return c.json({ ok: false, error: e.message }, 500)
    }
  })

  httpApp.get('/api/sessions', (c) => {
    return c.json(sessionManager.listSessions())
  })

  httpApp.post('/api/sessions', async (c) => {
    try {
      const body = await c.req.json()
      const session = sessionManager.createSession(body.title)
      return c.json({ ok: true, session })
    } catch (e: any) {
      return c.json({ ok: false, error: e.message }, 400)
    }
  })

  httpApp.get('/api/sessions/:id', (c) => {
    const session = sessionManager.getSessionStore().load(c.req.param('id'))
    return session ? c.json(session) : c.json({ error: 'Not found' }, 404)
  })

  httpApp.delete('/api/sessions/:id', (c) => {
    const ok = sessionManager.deleteSession(c.req.param('id'))
    return c.json({ ok })
  })

  httpApp.get('/api/usage', (c) => {
    const period = c.req.query('period') as 'hour' | 'day' | 'week' | 'month' ?? 'day'
    return c.json(usageTracker.getSummary(period))
  })

  httpApp.get('/api/skills', (c) => {
    return c.json(skillStore.list())
  })

  httpApp.get('/api/plugins', (c) => {
    return c.json(skillStore.listPlugins())
  })

  httpApp.get('/health', (c) => c.json({ ok: true }))
  httpApp.get('/', (c) => c.json({
    name: 'Rem Agent',
    version: '0.2.0',
    status: 'running',
  }))

  const wsServer = createWsServer(agent, sessionManager, wsPort)

  const scheduler = createScheduler()

  addCronJob(agentId, '0 2 * * *', 'memory_summarization')
  addCronJob(agentId, '0 3 * * *', 'deep_memory_extraction')
  addCronJob(agentId, '0 4 * * *', 'usage_cleanup')

  scheduler.startCronJobs(agentId, async () => {
    const summarizer = createSummarizer({ agentId })
    await summarizer.runCompaction()
  })

  scheduler.startHeartbeat(5 * 60 * 1000, async () => {
    console.log('[heartbeat] Agent is alive')
  })

  eventBus.on('chat:error', ({ sessionId, error }) => {
    console.error(`[event] Chat error in session ${sessionId}:`, error.message)
  })

  eventBus.on('sandbox:violation', ({ path, operation, agentId: aid }) => {
    console.warn(`[event] Sandbox violation by ${aid}: ${operation} on ${path}`)
  })

  const deepMemory = createDeepMemoryProcessor()
  const dayMs = 24 * 60 * 60 * 1000
  setInterval(async () => {
    try {
      const result = await deepMemory.runDaily()
      if (result.factsAdded > 0) {
        console.log(`[deep-memory] Added ${result.factsAdded} facts from ${result.processed} memories`)
      }
    } catch (e: any) {
      console.warn('[deep-memory] Daily run failed:', e.message)
    }
  }, dayMs)

  setInterval(() => {
    const removed = cleanupOldMemories()
    if (removed > 0) console.log(`[memory-cleanup] Removed ${removed} old memories`)
  }, 7 * dayMs)

  setInterval(() => {
    const removed = usageTracker.cleanupOldLogs()
    if (removed > 0) console.log(`[usage-cleanup] Removed ${removed} old usage logs`)
  }, 90 * dayMs)

  serve({
    fetch: httpApp.fetch,
    port,
  })

  console.log(`
╔══════════════════════════════════════╗
║  🚀 Rem Agent v0.2.0              ║
╠══════════════════════════════════════╣
║  HTTP:  http://localhost:${port}            ║
║  WS:    ws://localhost:${wsPort}           ║
║  Agent: ${agentId.padEnd(30)}║
╚══════════════════════════════════════╝
  `)

  return {
    agent,
    sessionManager,
    skillStore,
    scheduler,
    wsServer,
    port,
    wsPort,
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const agentId = process.env.AGENT_ID ?? 'default'
  startServer({ agentId }).catch(console.error)
}
