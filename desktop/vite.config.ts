import { defineConfig, type Plugin, type ProxyOptions } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { cpSync, existsSync } from 'node:fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const PROJECT_ROOT = __dirname                // D:\src\aicoding\openshadow\desktop\
const ROOT = resolve(PROJECT_ROOT, 'src')     // dev server root
const OUT_DIR = resolve(PROJECT_ROOT, 'dist-renderer')

// Directories to search for @shared/* modules (in order)
const SHARED_DIRS = [
  resolve(PROJECT_ROOT, 'src', 'react', 'components', 'shared'),
  resolve(PROJECT_ROOT, 'src', 'shared'),
  resolve(PROJECT_ROOT, '..', 'shared'),   // openshadow/shared/
]

function tryResolve(subpath: string): string | undefined {
  const exts = ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx']
  for (const dir of SHARED_DIRS) {
    if (!existsSync(dir)) continue
    const base = resolve(dir, subpath)
    for (const ext of exts) {
      if (existsSync(base + ext)) return base + ext
    }
  }
  return undefined
}

function sharedResolverPlugin(): Plugin {
  return {
    name: 'openshadow-shared-resolver',
    resolveId(id: string) {
      if (id.startsWith('@shared/')) {
        const subpath = id.slice('@shared/'.length)
        const resolved = tryResolve(subpath)
        if (resolved) {
          console.error('[openshadow-resolver]', id, '->', resolved)
          return resolved
        }
      }
      if (id === '@/ui' || id.startsWith('@/ui/')) {
        const sub = id.startsWith('@/ui/') ? id.slice('@/ui/'.length) : ''
        const full = resolve(PROJECT_ROOT, 'src', 'react', 'ui', sub)
        for (const ext of ['.tsx', '.ts', '.js', '.jsx', '/index.tsx', '/index.ts']) {
          if (existsSync(full + ext)) {
            console.error('[openshadow-resolver]', id, '->', full + ext)
            return full + ext
          }
        }
      }
      return null
    },
  }
}

interface DevWebClientConfig {
  serverPort: string
  apiBaseUrl: string
}

/**
 * 读 dev-web 环境变量。
 * 由 scripts/dev-web.js 注入：
 *   HANA_DEV_WEB=1
 *   HANA_DEV_WEB_API_BASE_URL=http://127.0.0.1:5280
 *   HANA_DEV_WEB_CLIENT_PORT=5280
 *   HANA_DEV_WEB_SERVER_URL=http://127.0.0.1:3000
 *   HANA_DEV_WEB_SERVER_TOKEN=<loopback token>
 *
 * 与 openhanako 同源：
 *   https://github.com/jingqiu2188/openhanako
 */
function readDevWebClientConfig(): DevWebClientConfig | null {
  if (process.env.HANA_DEV_WEB !== '1') return null
  const apiBaseUrl = process.env.HANA_DEV_WEB_API_BASE_URL?.trim()
  if (!apiBaseUrl) {
    throw new Error('HANA_DEV_WEB requires HANA_DEV_WEB_API_BASE_URL')
  }
  const parsed = new URL(apiBaseUrl)
  const serverPort = process.env.HANA_DEV_WEB_CLIENT_PORT?.trim() || parsed.port
  if (!serverPort) {
    throw new Error('HANA_DEV_WEB requires HANA_DEV_WEB_CLIENT_PORT or a port in HANA_DEV_WEB_API_BASE_URL')
  }
  return { serverPort, apiBaseUrl }
}

/**
 * dev-web 模式：把 client config 注入到 index.html 的 window.__HANA_DEV_WEB__，
 * platform.js 读这个变量走 HTTP fallback。
 */
function injectDevWebConfig(): Plugin {
  return {
    name: 'openshadow-inject-dev-web-config',
    apply: 'serve',
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        // dev server root 是 desktop/src，所以 filename 是 'index.html' 之类的 basename
        if (!ctx.filename.endsWith('index.html')) return html
        const config = readDevWebClientConfig()
        if (!config) return html
        const payload = JSON.stringify(config).replace(/</g, '\\u003c')
        return html.replace(
          '</head>',
          `<script>window.__HANA_DEV_WEB__=${payload};</script>\n</head>`,
        )
      },
    },
  }
}

function createDevWebProxy(): Record<string, ProxyOptions> | undefined {
  if (process.env.HANA_DEV_WEB !== '1') return undefined
  const target = process.env.HANA_DEV_WEB_SERVER_URL?.trim()
  const token = process.env.HANA_DEV_WEB_SERVER_TOKEN?.trim()
  if (!target || !token) {
    throw new Error('HANA_DEV_WEB proxy requires HANA_DEV_WEB_SERVER_URL and HANA_DEV_WEB_SERVER_TOKEN')
  }
  const auth = `Bearer ${token}`
  const targetUrl = new URL(target)
  const wsTarget = `${targetUrl.protocol === 'https:' ? 'wss:' : 'ws:'}//${targetUrl.host}`

  const withAuth = (proxyTarget: string, extra: ProxyOptions = {}): ProxyOptions => ({
    target: proxyTarget,
    changeOrigin: true,
    ...extra,
    headers: {
      ...(extra.headers || {}),
      Authorization: auth,
    },
    configure(proxy, options) {
      proxy.on('proxyReq', (proxyReq) => {
        proxyReq.setHeader('Authorization', auth)
      })
      proxy.on('proxyReqWs', (proxyReq) => {
        proxyReq.setHeader('Authorization', auth)
      })
      extra.configure?.(proxy, options)
    },
  })

  return {
    '/api': withAuth(target),
    '/preview': withAuth(target),
    '/ws': withAuth(wsTarget, { ws: true }),
  }
}

/**
 * Build 后复制旧文件到 dist-renderer/（与 openhanako 对齐）。
 * lib/i18n.js, modules/, locales/ 等非模块资源不会被 Vite 自动处理，
 * 必须手动拷贝到输出目录。
 */
function copyLegacyFiles(): Plugin {
  return {
    name: 'openshadow-copy-legacy-files',
    closeBundle() {
      const srcDir = resolve(PROJECT_ROOT, 'src')
      const outDir = OUT_DIR

      const dirs = ['lib', 'modules', 'locales', 'themes']
      for (const dir of dirs) {
        const src = resolve(srcDir, dir)
        const dest = resolve(outDir, dir)
        if (existsSync(src)) {
          cpSync(src, dest, { recursive: true })
          console.log(`[copyLegacy] ${dir}/ → dist-renderer/${dir}/`)
        } else {
          console.warn(`[copyLegacy] ${src} not found, skipping`)
        }
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), sharedResolverPlugin(), injectDevWebConfig(), copyLegacyFiles()],
  root: ROOT,
  base: './',
  resolve: {
    tsconfigPaths: true,
    alias: {
      '@hana/plugin-protocol': resolve(PROJECT_ROOT, '..', 'packages', 'plugin-protocol', 'src', 'index.ts'),
    },
  },
  build: {
    outDir: OUT_DIR,
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: resolve(ROOT, 'index.html'),
        'quick-chat': resolve(ROOT, 'quick-chat.html'),
        'editor-window': resolve(ROOT, 'editor-window.html'),
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5280,
    strictPort: true,
    // dev-web 模式下：proxy 由 HANA_DEV_WEB_* 环境变量创建（带 token auth）
    // 否则：本地默认 3000（无 auth，handy for local debug only）
    proxy: process.env.HANA_DEV_WEB === '1'
      ? createDevWebProxy()
      : {
          '/api': {
            target: 'http://localhost:3000',
            changeOrigin: true,
          },
          '/ws': {
            target: 'http://localhost:3000',
            ws: true,
            changeOrigin: true,
          },
        },
  },
})
