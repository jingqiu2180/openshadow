// playwright.functional.config.ts
// 功能测试专用配置 — 用真实 AI 模型，不 mock 任何 API 响应
// 运行: npx playwright test --config=playwright.functional.config.ts

import { defineConfig, devices } from '@playwright/test'

const PORT_STATIC = 5280
const PORT_SERVER = 3000

export default defineConfig({
  testDir: './tests/functional',
  fullyParallel: false,
  workers: 1,
  timeout: 180_000,  // 单测最大 3 分钟（AI 回复可能慢）
  expect: { timeout: 120_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report-functional' }]],
  retries: 0,

  use: {
    baseURL: `http://127.0.0.1:${PORT_STATIC}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    userDataDir: '.playwright-data',
  },

  webServer: [
    {
      name: 'openshadow-api',
      command: 'node dist/server/index.js',
      url: `http://127.0.0.1:${PORT_SERVER}/api/studio/workspaces`,
      timeout: 15000,
      reuseExistingServer: true,
    },
    {
      name: 'vite',
      command: 'npx vite --config desktop/vite.config.ts',
      url: `http://127.0.0.1:${PORT_STATIC}`,
      timeout: 30000,
      reuseExistingServer: true,
    },
  ],

  projects: [
    {
      name: 'functional',
      testMatch: /.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
