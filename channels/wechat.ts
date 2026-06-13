import { Hono } from 'hono'
import { Agent } from '../core/agent.js'

export interface WechatMessage {
  msgtype: string
  fromUserName: string
  content: string
  createTime: number
}

export interface WechatResponse {
  type: 'text' | 'image' | 'voice'
  content: string
}

/**
 * WeChat Channel - for WeChat Official Account or Enterprise WeChat.
 * Note: Requires WeChat API credentials.
 */
export function createWechatChannel(agent: Agent) {
  const app = new Hono()

  app.get('/health', c => c.json({ status: 'ok', channel: 'wechat' }))

  // Webhook for WeChat messages
  app.post('/webhook', async c => {
    const body = await c.req.json() as WechatMessage

    // Verify message type
    if (body.msgtype !== 'text') {
      return c.json({ success: true })
    }

    const content = body.content
    const fromUser = body.fromUserName

    if (!content?.trim()) {
      return c.json({ success: true })
    }

    try {
      const result = await agent.chat([
        { role: 'user', content },
      ])

      console.log(`[wechat] from=${fromUser}`)
      console.log(`[wechat] response: ${result.content.slice(0, 200)}`)

      // WeChat response format
      return c.json({
        msgtype: 'text',
        text: { content: result.content },
      })
    } catch (e: any) {
      console.error(`[wechat] error:`, e.message)
      return c.json({
        msgtype: 'text',
        text: { content: '抱歉，出了点问题...' },
      })
    }
  })

  return app
}

/**
 * Create standalone WeChat server.
 */
export function createWechatServer(agent: Agent, port: number = 3003) {
  const app = createWechatChannel(agent)

  return {
    fetch: app.fetch,
    port,
    start() {
      console.log(`[wechat] Server on http://localhost:${port}`)
    },
  }
}