// @ts-nocheck
import { Hono } from 'hono'
import { Agent } from '../core/agent'

export interface QQMessage {
  message: {
    channel_id: string
    message_id: string
    author: { id: string }
    content: string
  }
  schema: string
}

/**
 * QQ Channel - similar to Feishu.
 * Accepts webhook events from QQ Open Platform.
 */
export function createQQChannel(agent: Agent) {
  const app = new Hono()

  app.get('/health', c => c.json({ status: 'ok', channel: 'qq' }))

  app.post('/webhook', async c => {
    const body = await c.req.json() as QQMessage

    // Skip non-message events
    if (body.schema !== 'guilds.message' || !body.message) {
      return c.json({ code: 0 })
    }

    const { channel_id, message_id, author, content } = body.message
    void message_id // TODO: use for reply

    if (!content.trim()) {
      return c.json({ code: 0 })
    }

    try {
      const userId = author?.id ?? 'default'
      const result = await agent.chat([
        { role: 'user', content },
      ], userId)

      console.log(`[qq] channel=${channel_id} user=${author.id}`)
      console.log(`[qq] response: ${result.content.slice(0, 200)}`)

      return c.json({ code: 0, message: 'ok' })
    } catch (e: any) {
      console.error(`[qq] error:`, e.message)
      return c.json({ code: 500, message: e.message })
    }
  })

  return app
}

/**
 * Create standalone QQ server for local testing.
 */
export function createQQServer(agent: Agent, port: number = 3002) {
  const app = createQQChannel(agent)

  return {
    fetch: app.fetch,
    port,
    start() {
      console.log(`[qq] Server on http://localhost:${port}`)
    },
  }
}