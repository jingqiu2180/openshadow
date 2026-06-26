// playwright.config.ts
// Playwright 配置：跑 Web E2E + Electron E2E

import { defineConfig, devices } from '@playwright/test'

const PORT_STATIC = 4173
const PORT_SERVER = 3000

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],

  use: {
    baseURL: `http://127.0.0.1:${PORT_STATIC}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  // 自动启动 API server + 静态文件服务器（构建后的前端）
  webServer: [
    {
      name: 'openshadow-api',
      command: 'node dist/server/index.js',
      url: `http://127.0.0.1:${PORT_SERVER}/api/studio/workspaces`,
      timeout: 15000,
      reuseExistingServer: true,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      name: 'static',
      command: 'node tests/e2e/static-server.js',
      url: `http://127.0.0.1:${PORT_STATIC}`,
      timeout: 10000,
      reuseExistingServer: true,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],

  projects: [
    // === Web E2E（连静态服务器，不需 Vite）===
    {
      name: 'web',
      testMatch: /.*\.web\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
      },
    },

    // === Electron E2E（启动 Electron 主进程）===
    {
      name: 'electron',
      testMatch: /.*\.electron\.spec\.ts/,
      use: {
        // Electron 用 _electron.launch() 而不是 browserType.launch()
      },
    },
  ],
})
