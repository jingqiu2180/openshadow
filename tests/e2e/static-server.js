// tests/e2e/static-server.js
// 简单的静态文件服务器，正确设置 MIME 类型
// 代理 /api 到 openshadow API server（由测试的 setupIPv4ApiProxy 处理）
import express from 'express'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const PORT = 4173

const app = express()

// 静态文件（desktop/dist-renderer）
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

// SPA fallback（必须用正则或 wildcard，不能用裸 '*'）
app.use((_req, res) => {
  res.sendFile(join(__dirname, '../../desktop/dist-renderer/index.html'))
})

app.listen(PORT, '127.0.0.1', () => {
  console.log(`[static-server] http://127.0.0.1:${PORT}`)
})
