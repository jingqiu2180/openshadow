// @ts-nocheck
import * as WS from 'ws'
import type { Agent } from '../core/agent.js'
import type { SessionManager } from '../core/session-manager.js'
import { eventBus } from '../core/event-bus.js'

export interface WsMessage {
  type: 'chat' | 'typing' | 'session:create' | 'session:switch' | 'session:list'
  content?: string
  messageId?: string
  stream?: boolean
  sessionId?: string
  title?: string
}

export interface WsResponse {
  type: 'response' | 'error' | 'typing' | 'delta' | 'done' | 'session' | 'sessions'
  content?: string
  delta?: string
  messageId?: string
  sessionId?: string
  sessions?: any[]
}

export function createWsServer(_agent: Agent, sessionManager: SessionManager, port: number = 8080) {
  const wss = new WS.WebSocketServer({ port })

  wss.on('connection', async (ws: WS.WebSocket, _req: any) => {
    console.log('[ws] Client connected')

    sessionManager.getActiveSession() ?? sessionManager.createSession()

    ws.on('message', async (data: WS.RawData) => {
      try {
        const msg = JSON.parse(data.toString()) as WsMessage

        switch (msg.type) {
          case 'session:create': {
            const session = sessionManager.createSession(msg.title)
            ws.send(JSON.stringify({
              type: 'session',
              sessionId: session.id,
              content: JSON.stringify(session),
            } as WsResponse))
            break
          }

          case 'session:switch': {
            if (msg.sessionId) {
              const session = sessionManager.setActiveSession(msg.sessionId)
              ws.send(JSON.stringify({
                type: 'session',
                sessionId: session?.id,
                content: session ? JSON.stringify(session) : undefined,
              } as WsResponse))
            }
            break
          }

          case 'session:list': {
            const sessions = sessionManager.listSessions()
            ws.send(JSON.stringify({
              type: 'sessions',
              sessions,
            } as WsResponse))
            break
          }

          case 'chat': {
            if (!msg.content) break

            ws.send(JSON.stringify({ type: 'typing', messageId: msg.messageId } as WsResponse))

            try {
              await sessionManager.chat(msg.content, (chunk) => {
                ws.send(JSON.stringify({
                  type: 'delta',
                  delta: chunk,
                  messageId: msg.messageId,
                } as WsResponse))
              })

              ws.send(JSON.stringify({ type: 'done', messageId: msg.messageId } as WsResponse))

              eventBus.emit('chat:complete', {
                sessionId: sessionManager.getActiveSession()?.id ?? '',
                content: msg.content,
                latencyMs: 0,
              })
            } catch (e: any) {
              ws.send(JSON.stringify({
                type: 'error',
                content: e.message,
                messageId: msg.messageId,
              } as WsResponse))

              eventBus.emit('chat:error', {
                sessionId: sessionManager.getActiveSession()?.id ?? '',
                error: e,
              })
            }
            break
          }
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
      ws.send(JSON.stringify({ type: 'chat', content, messageId, stream: true }))
    },

    createSession(title?: string) {
      if (!ws) throw new Error('Not connected')
      ws.send(JSON.stringify({ type: 'session:create', title }))
    },

    switchSession(sessionId: string) {
      if (!ws) throw new Error('Not connected')
      ws.send(JSON.stringify({ type: 'session:switch', sessionId }))
    },

    listSessions() {
      if (!ws) throw new Error('Not connected')
      ws.send(JSON.stringify({ type: 'session:list' }))
    },

    onMessage(handler: (msg: WsResponse) => void) {
      messageHandler = handler
    },

    close() {
      ws?.close()
    },
  }
}
