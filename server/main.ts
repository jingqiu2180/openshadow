import { serve } from '@hono/node-server'
import { Agent } from '../core/agent.js'
import { createScheduler } from '../core/scheduler.js'
import { createSummarizer } from '../core/memory/summarizer.js'
import { addCronJob, saveAgentConfig } from '../core/memory/store.js'
import { createFeishuChannel } from '../channels/feishu.js'
import { createWsServer } from '../server/ws.js'
import { config as configManager } from '../core/config.js'

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

  // Save agent config (for demo, use env vars)
  saveAgentConfig({
    id: agentId,
    name: 'Rem Agent',
    personality: 'default',
    model: process.env.AGENT_MODEL ?? 'abab6.5s-chat',
    apiKey: process.env.AGENT_API_KEY ?? '',
    baseUrl: process.env.AGENT_BASE_URL ?? 'https://api.openai.com/v1',
    allowedPaths: options.allowedPaths ?? ['/tmp', process.cwd()],
  })

  // Create agent
  const agent = new Agent({ agentId })

  // Create HTTP server (Hono)
  const httpApp = createFeishuChannel(agent)

  // ─── Config API (security settings) ───────────────────────────
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

  // ─── Config API: theme (Stage 1d) ─────────────────────────────
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

  // ─── Health ─────────────────────────────────────────────
  httpApp.get('/health', (c) => c.json({ ok: true }))
  httpApp.get('/', (c) => c.json({
    name: 'Rem Agent',
    version: '0.1.0',
    status: 'running',
  }))

  // Create WebSocket server
  const wsServer = createWsServer(agent, wsPort)

  // Create scheduler
  const scheduler = createScheduler()

  // Add a daily summarization job
  addCronJob(agentId, '0 2 * * *', 'memory_summarization')

  // Start cron jobs
  scheduler.startCronJobs(agentId, async () => {
    const summarizer = createSummarizer({ agentId })
    await summarizer.runCompaction()
  })

  // Start heartbeat (every 5 min)
  scheduler.startHeartbeat(5 * 60 * 1000, async () => {
    console.log('[heartbeat] Agent is alive')
  })

  // Start HTTP server
  serve({
    fetch: httpApp.fetch,
    port,
  })

  console.log(`
╔══════════════════════════════════════╗
║  🚀 Rem Agent v0.1.0              ║
╠══════════════════════════════════════╣
║  HTTP:  http://localhost:${port}            ║
║  WS:    ws://localhost:${wsPort}           ║
║  Agent: ${agentId.padEnd(30)}║
╚══════════════════════════════════════╝
  `)

  return {
    agent,
    scheduler,
    wsServer,
    port,
    wsPort,
  }
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const agentId = process.env.AGENT_ID ?? 'default'
  startServer({ agentId }).catch(console.error)
}
