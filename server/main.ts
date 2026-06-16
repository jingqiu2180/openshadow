import { serve } from '@hono/node-server'
import { Agent } from '../core/agent.js'
import { createScheduler } from '../core/scheduler.js'
import { createSummarizer } from '../core/memory/summarizer.js'
import { addCronJob, saveAgentConfig, cleanupOldMemories } from '../core/memory/store.js'
import { createFeishuChannel } from '../channels/feishu.js'
import { createWsServer } from '../server/ws.js'
import { config as configManager } from '../core/config.js'
import { SessionManager } from '../core/session-manager.js'
import { eventBus } from '../core/event-bus.js'
import { usageTracker } from '../core/providers/usage-tracker.js'
import { createDeepMemoryProcessor } from '../core/memory/deep-memory.js'
import { createSkillStore } from '../core/skills.js'

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
