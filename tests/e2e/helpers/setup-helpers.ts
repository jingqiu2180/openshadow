// tests/e2e/helpers/setup-helpers.ts
// Playwright 共享工具：绕过 Vite 代理 IPv6 限制 + mock window.platform

import type { Page } from '@playwright/test'

/**
 * 获取测试工作区路径（跨平台）
 * 优先级：环境变量 TEST_FOLDER → 平台默认路径
 */
export function getTestFolder(): string {
  if (process.env.TEST_FOLDER) return process.env.TEST_FOLDER
  if (process.platform === 'win32') return 'D:\\test\\workspace-fixture'
  return '/tmp/remu-test-workspace'
}

/**
 * 获取当前已挂载工作区的 mountId
 * 调用 GET /api/studio/workspaces，返回第一个 local_fs 类型的 mountId
 */
export async function getMountId(page: Page): Promise<string | null> {
  try {
    const res = await page.request.get('/api/studio/workspaces')
    if (!res.ok()) return null
    const data = await res.json()
    // 格式：{ workspaces: [{ mountId, type, ... } ] }
    const ws = data?.workspaces?.find((w: any) => w.mountId?.startsWith('local_fs_'))
    return ws?.mountId || null
  } catch {
    return null
  }
}

/**
 * 解决 Vite 在 Windows 下只 listen [::1]:5173（IPv6），
 * 但 Chromium 默认走 IPv4 localhost，导致 /api 代理失败。
 * 解决方案：劫持浏览器请求，把 /api/* 重写到 IPv4 127.0.0.1:3000
 */
export async function setupIPv4ApiProxy(page: Page, serverPort = 3000) {
  await page.route('**/api/**', async (route) => {
    const origUrl = route.request().url()
    // 替换 host 为 IPv4 127.0.0.1:serverPort
    const newUrl = origUrl.replace(/^https?:\/\/[^/]+/, `http://127.0.0.1:${serverPort}`)
    try {
      const response = await route.fetch({ url: newUrl })
      await route.fulfill({ response })
    } catch (e: any) {
      console.error(`[setupIPv4ApiProxy] failed: ${newUrl} → ${e.message?.split('\n')[0]}`)
      await route.abort()
    }
  })
}

/**
 * Mock window.platform 让 selectFolder/selectFiles 返回固定值
 * Web 环境下 platform.js 的 selectFolder 是 null，需要 mock
 * 注意：必须在 page.goto 之后调用（否则 platform.js 会覆盖）
 */
export async function mockPlatform(page: Page, options: {
  selectFolder?: string | null
  selectFiles?: string[]
} = {}) {
  await page.evaluate((opts) => {
    (window as any).__MOCKED_PLATFORM__ = true
    const original = (window as any).platform || {}
    ;(window as any).platform = {
      ...original,
      selectFolder: async () => opts.selectFolder ?? null,
      selectFiles: async () => opts.selectFiles ?? [],
      selectSkill: async () => null,
      selectPlugin: async () => null,
      openExternal: (url: string) => {
        try { window.open(url, '_blank') } catch {}
      },
      getPlatform: async () => 'web',
      getServerPort: async () => 3000,
      getServerToken: async () => null,
    }
    console.log('[mockPlatform] platform overridden:', (window as any).platform)
  }, options)
}

/**
 * 等待 Vite + Server 都启动
 */
export async function waitForServers(page: Page, viteUrl: string, serverPort = 3000) {
  // 测试 Vite
  for (let i = 0; i < 30; i++) {
    try {
      const res = await page.request.get(viteUrl)
      if (res.ok()) break
    } catch {}
    await page.waitForTimeout(1000)
  }
  // 测试 server
  for (let i = 0; i < 30; i++) {
    try {
      const res = await page.request.get(`http://127.0.0.1:${serverPort}/api/studio/workspaces`)
      if (res.ok()) return
    } catch {}
    await page.waitForTimeout(1000)
  }
}

/**
 * 收集 console + page error + network 错误
 */
export function attachDebugListeners(page: Page, label = '') {
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      console.log(`[${label} console.${msg.type()}]`, msg.text().slice(0, 200))
    }
  })
  page.on('pageerror', (err) => {
    console.log(`[${label} pageerror]`, err.message.slice(0, 200))
  })
  page.on('requestfailed', (req) => {
    if (!req.url().includes('/__vite_ping') && !req.url().includes('/@vite/')) {
      console.log(`[${label} requestfailed]`, req.url(), req.failure()?.errorText)
    }
  })
}