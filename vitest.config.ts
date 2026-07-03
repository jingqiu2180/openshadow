// @ts-nocheck
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { existsSync } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const PROJECT_ROOT = __dirname
const DESKTOP_ROOT = resolve(PROJECT_ROOT, 'desktop')

const electronMock = resolve(__dirname, 'tests/__mocks__/electron.cjs')

// Directories to search for @shared/* modules (in order)
const SHARED_DIRS = [
  resolve(DESKTOP_ROOT, 'src', 'react', 'components', 'shared'),
  resolve(DESKTOP_ROOT, 'src', 'shared'),
  resolve(PROJECT_ROOT, 'shared'),
]

function tryResolve(subpath: string): string | undefined {
  const exts = ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx']
  for (const dir of SHARED_DIRS) {
    const base = resolve(dir, subpath)
    for (const ext of exts) {
      const full = base + ext
      if (existsSync(full)) return full
    }
  }
  return undefined
}

export default defineConfig({
  resolve: {
    alias: {
      electron: electronMock,
      // @/ui -> desktop/src/react/ui/
      '@/ui': resolve(DESKTOP_ROOT, 'src', 'react', 'ui'),
      '@/ui/': resolve(DESKTOP_ROOT, 'src', 'react', 'ui') + '/',
      // @hana/plugin-protocol -> packages/plugin-protocol/src/index.ts
      '@hana/plugin-protocol': resolve(PROJECT_ROOT, 'packages', 'plugin-protocol', 'src', 'index.ts'),
    },
    // 让 vite 解析 .cjs 后缀
    extensions: ['.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json', '.cjs'],
  },
  plugins: [
    // React plugin with automatic JSX runtime
    react({
      jsxRuntime: 'automatic',
    }),
    // Custom plugin to resolve @shared/* imports and .cjs files
    {
      name: 'openshadow-shared-resolver-vitest',
      resolveId(id: string) {
        // 0. theme-registry: .cjs stub is CJS-only, redirect to real ESM version
        if (id.endsWith('/theme-registry.js') || id.endsWith('/theme-registry.cjs')) {
          const real = resolve(PROJECT_ROOT, 'desktop', 'src', 'shared', 'theme-registry.ts')
          if (existsSync(real)) return real
        }
        // 1. @shared/* alias
        if (id.startsWith('@shared/')) {
          const subpath = id.slice('@shared/'.length)
          const resolved = tryResolve(subpath)
          if (resolved) return resolved
        }
        // 2. .cjs files: try replacing .cjs with .ts / .js
        if (id.endsWith('.cjs')) {
          const base = id.slice(0, -4) // remove .cjs
          for (const ext of ['.ts', '.js', '.cjs']) {
            const full = base + ext
            try { if (existsSync(full)) return full } catch {}
          }
        }
        return null
      },
    },
  ],
  test: {
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    include: [
      'tests/**/*.test.{ts,js}',
      'desktop/src/react/__tests__/**/*.test.{ts,tsx,js}',
    ],
    exclude: ['node_modules', 'dist'],
    // React/TiPTap 测试用 jsdom
    environmentMatchGlobs: [
      ['desktop/src/react/__tests__/**', 'jsdom'],
    ],
  },
})
