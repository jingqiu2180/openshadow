// Smoke test static server with /api proxy to localhost:3000
// Uses native http module (no external deps)
import express from 'express'
import http from 'http'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const PORT = 4173
const API_TARGET = '127.0.0.1:3000'

const app = express()

// /api proxy using native http — must keep /api prefix in forwarded path
app.use('/api', (req, res) => {
  const options = {
    hostname: '127.0.0.1',
    port: 3000,
    path: '/api' + req.url,
    method: req.method,
    headers: { ...req.headers, host: '127.0.0.1:3000' },
  }
  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers)
    proxyRes.pipe(res)
  })
  proxyReq.on('error', (err) => {
    console.error('[api proxy] error:', err.message)
    res.writeHead(502, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'API proxy failed: ' + err.message }))
  })
  req.pipe(proxyReq)
})

// Static files (desktop/dist-renderer)
app.use(express.static(join(__dirname, '../../desktop/dist-renderer'), {
  setHeaders(res, filePath) {
    if (filePath.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css')
    } else if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript')
    } else if (filePath.endsWith('.html')) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
    }
  }
}))

// SPA fallback
app.use((_req, res) => {
  res.sendFile(join(__dirname, '../../desktop/dist-renderer/index.html'))
})

app.listen(PORT, '127.0.0.1', () => {
  console.log(`[smoke-static-server] http://127.0.0.1:${PORT}`)
})
