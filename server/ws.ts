import * as WS from 'ws'
import type { Agent } from '../core/agent.js'

export interface WsMessage {
  type: 'chat' | 'typing'
  content?: string
  messageId?: string
}

export interface WsResponse {
  type: 'response' | 'error' | 'typing'
  content?: string
  messageId?: string
}

export function createWsServer(agent: Agent, port: number = 8080) {
  const wss = new WS.WebSocketServer({ port })

  wss.on('connection', async (ws: WS.WebSocket, _req: any) => {
    console.log('[ws] Client connected')

    ws.on('message', async (data: WS.RawData) => {
      try {
        const msg = JSON.parse(data.toString()) as WsMessage

        if (msg.type === 'chat' && msg.content) {
          ws.send(JSON.stringify({ type: 'typing' } as WsResponse))

          const result = await agent.chat([
            { role: 'user', content: msg.content },
          ])

          ws.send(JSON.stringify({
            type: 'response',
            content: result.content,
            messageId: msg.messageId,
          } as WsResponse))
        }
      } catch (e: any) {
        ws.send(JSON.stringify({
          type: 'error',
          content: e.message,
        } as WsResponse))
      }
    })

    ws.on('close', () => console.log('[ws] Client disconnected'))
    ws.on('error', (e: Error) => console.error('[ws] Error:', e.message))
  })

  wss.on('listening', () => console.log(`[ws] WebSocket on ws://localhost:${port}`))
  return wss
}

export function createWsClient(url: string = 'ws://localhost:8080') {
  let ws: WS.WebSocket | null = null
  let messageHandler: ((msg: WsResponse) => void) | null = null

  return {
    connect() {
      return new Promise<void>((resolve, reject) => {
        ws = new WS.WebSocket(url)

        ws.on('open', () => {
          console.log('[ws] Connected')
          resolve()
        })

        ws.on('message', (data: WS.RawData) => {
          const msg = JSON.parse(data.toString()) as WsResponse
          if (messageHandler) messageHandler(msg)
        })

        ws.on('error', (e: Error) => {
          console.error('[ws] Error:', e)
          reject(e)
        })

        ws.on('close', () => console.log('[ws] Disconnected'))
      })
    },

    sendChat(content: string, messageId?: string) {
      if (!ws) throw new Error('Not connected')
      ws.send(JSON.stringify({ type: 'chat', content, messageId }))
    },

    onMessage(handler: (msg: WsResponse) => void) {
      messageHandler = handler
    },

    close() {
      ws?.close()
    },
  }
}