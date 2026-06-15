import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { cors } from 'hono/cors'

const app = new Hono()

// Middleware
app.use('*', cors())

// Health check
app.get('/', (c) => c.json({
  name: 'Rem Agent',
  version: '0.1.0',
  status: 'running'
}))

app.get('/health', (c) => c.json({ ok: true }))

// WebSocket endpoint - redirect to ws server
app.get('/ws', (c) => c.text('Use WebSocket server on port 8080'))

// API routes placeholder
app.get('/api/agent/status', (c) => c.json({ connected: false }))

const port = 3000

console.log(`🚀 Server starting on http://localhost:${port}`)

serve({
  fetch: app.fetch,
  port,
})

export default app
