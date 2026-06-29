// @ts-nocheck
import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

const electronMock = resolve(__dirname, 'tests/__mocks__/electron.cjs')

export default defineConfig({
  resolve: {
    alias: {
      electron: electronMock,
    },
    // 让 vite 解析 .cjs 后缀
    extensions: ['.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json', '.cjs'],
  },
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
