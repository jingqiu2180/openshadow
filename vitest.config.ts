// @ts-nocheck
import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

const electronMock = resolve(__dirname, 'tests/__mocks__/electron.cjs')

export default defineConfig({
  resolve: {
    alias: {
      // 在测试环境里把 'electron' 模块替换成 mock
      electron: electronMock,
    },
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
  },
})
