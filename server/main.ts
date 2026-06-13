import { serve } from '@hono/node-server'
import { Agent } from '../core/agent.js'
import { createScheduler } from '../core/scheduler.js'
import { createSummarizer } from '../core/memory/summarizer.js'
import { addCronJob, saveAgentConfig } from '../core/memory/store.js'
import { createFeishuChannel } from '../channels/feishu.js'
import { createWsServer } from '../server/ws.js'

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
    name: '小Hanako',
    personality: 'default',
    model: process.env.AGENT_MODEL ?? 'gpt-4',
    apiKey: process.env.AGENT_API_KEY ?? '',
    baseUrl: process.env.AGENT_BASE_URL ?? 'https://api.openai.com/v1',
    allowedPaths: options.allowedPaths ?? ['/tmp', process.cwd()],
  })

  // Create agent
  const agent = new Agent({ agentId })

  // Create HTTP server (Hono)
  const httpApp = createFeishuChannel(agent)

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
╔══════════════════════════════════════════╗
║  🚀 OpenHanako-Inspired Agent v0.1.0   ║
╠══════════════════════════════════════════╣
║  HTTP:  http://localhost:${port}            ║
║  WS:    ws://localhost:${wsPort}           ║
║  Agent: ${agentId.padEnd(30)}║
╚══════════════════════════════════════════╝
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