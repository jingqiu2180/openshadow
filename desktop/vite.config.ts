// @ts-nocheck
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, sep } from 'node:path'
import { existsSync } from 'node:fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const PROJECT_ROOT = __dirname                // D:\src\aicoding\openshadow\desktop\
const ROOT = resolve(PROJECT_ROOT, 'src')   // D:\src\aicoding\openshadow\desktop\src\  (dev server root)
const OUT_DIR = resolve(PROJECT_ROOT, 'dist-renderer')

// Directories to search for @shared/* modules (in order)
// These are ABSOLUTE paths, computed from PROJECT_ROOT (desktop/)
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

// Vite plugin: resolveId hook handles @shared/* and @/ui/*
function sharedResolverPlugin() {
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

export default defineConfig({
  plugins: [react(), sharedResolverPlugin()],
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
      input: resolve(ROOT, 'index.html'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5280,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/api/ws': {
        target: 'ws://localhost:3000/ws',
        ws: true,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      '/ws': {
        target: 'ws://localhost:3000/ws',
        ws: true,
        changeOrigin: true,
      },
    },
  },
})
