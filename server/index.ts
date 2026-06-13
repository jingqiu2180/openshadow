import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { cors } from 'hono/cors'
import { wsHandler } from './ws.js'

const app = new Hono()

// Middleware
app.use('*', cors())

// Health check
app.get('/', (c) => c.json({
  name: 'OpenHanako-Inspired Agent',
  version: '0.1.0',
  status: 'running'
}))

app.get('/health', (c) => c.json({ ok: true }))

// WebSocket upgrade endpoint
app.get('/ws', wsHandler)

// API routes placeholder
app.get('/api/agent/status', (c) => c.json({ connected: false }))

const port = 3000

console.log(`🚀 Server starting on http://localhost:${port}`)

serve({
  fetch: app.fetch,
  port,
})

export default app
