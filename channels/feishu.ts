// @ts-nocheck
import { Hono } from 'hono'
import { Agent } from '../core/agent.js'

export interface FeishuMessage {
  event: {
    message: {
      chat_id: string
      message_id: string
      sender_id: { open_id: string }
    }
    text: string
  }
  schema: string
}

export function createFeishuChannel(agent: Agent) {
  const app = new Hono()

  // Health check
  app.get('/health', c => c.json({ status: 'ok', channel: 'feishu' }))

  // Webhook endpoint for Feishu events
  app.post('/webhook', async c => {
    const body = await c.req.json() as FeishuMessage

    // Skip non-message events
    if (body.schema !== 'im.message' || !body.event?.message) {
      return c.json({ code: 0 })
    }

    const { chat_id, message_id } = body.event.message
    const senderOpenId = body.event.message.sender_id?.open_id
    void senderOpenId // TODO: use for user identification
    const text = body.event.text

    // Skip empty messages
    if (!text.trim()) {
      return c.json({ code: 0 })
    }

    try {
      // Chat with agent
      const userId = senderOpenId ?? 'default'
      const result = await agent.chat([
        { role: 'user', content: text },
      ], userId)

      // TODO: Send message back to Feishu via API
      // For now, just log
      console.log(`[feishu] chat_id=${chat_id} message_id=${message_id}`)
      console.log(`[feishu] response: ${result.content.slice(0, 200)}`)

      return c.json({ code: 0, message: 'ok' })
    } catch (e: any) {
      console.error(`[feishu] error:`, e.message)
      return c.json({ code: 500, message: e.message })
    }
  })

  return app
}

/**
 * Create a standalone Feishu server for local testing.
 * In production, use Feishu's webhook URL.
 */
export function createFeishuServer(agent: Agent, port: number = 3001) {
  const app = createFeishuChannel(agent)

  return {
    fetch: app.fetch,
    port,
    start() {
      console.log(`[feishu] Server listening on http://localhost:${port}`)
    },
  }
}