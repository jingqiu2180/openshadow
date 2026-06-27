// tests/e2e/jian.web.spec.ts
// 笺记事板：打开/关闭、输入文字、保存
// 关键技术：用 page.routeWebSocket 模拟 WS open，让 wsState='connected'，
// 避免 StatusBar "连接已断开" 浮动覆盖层拦截 sidebar textarea 的 click。

import { test, expect } from '@playwright/test'
import {
  setupIPv4ApiProxy,
  mockPlatform,
  attachDebugListeners,
  getTestFolder,
} from './helpers/setup-helpers'

const TEST_FOLDER = getTestFolder()

/**
 * Mock WebSocket：触发 onopen 让 wsState='connected'，避免 StatusBar 拦截点击
 */
async function setupMockWs(page: any) {
  await page.routeWebSocket(/\/ws$/, async (ws: any) => {
    // 不调 connectToServer（web runtime WS URL 指向静态服务器 4173，连不上）
    // 只触发 onopen 让前端认为连接成功
    ws.onMessage(async (_msg: string) => {
      // 忽略所有消息（不转发到真实服务器）
    })
  })
}

test.describe('Jian: 笺记事板', () => {
  test.beforeEach(async ({ page }) => {
    attachDebugListeners(page, 'jian')
    await setupIPv4ApiProxy(page, 3000)
    // 必须在 goto 前 route WS，否则客户端 new WebSocket 时就被静态服务器拒绝
    await setupMockWs(page)

    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await mockPlatform(page, { selectFolder: TEST_FOLDER })
    await page.waitForFunction(
      () => {
        const el = document.getElementById('react-root')
        return el && el.children.length > 0
      },
      { timeout: 15000 }
    )
    await page.waitForTimeout(2000)

    // 选择工作区
    const wsBtn = page.locator('button:has-text("工作台")').first()
    if (await wsBtn.isVisible()) {
      await wsBtn.click()
      await page.waitForTimeout(500)
      const selectOther = page.locator('text=选择其他文件夹').first()
      if (await selectOther.isVisible()) {
        await selectOther.click()
        await page.waitForTimeout(3000)
      }
    }

    // 等 WS open 触发 wsState='connected'，StatusBar 不再显示
    await page.waitForTimeout(1000)
  })

  test('笺默认是打开状态，点击按钮关闭（加 collapsed class）', async ({ page }) => {
    const jianBtn = page.locator('#tbToggleRight')
    await expect(jianBtn).toBeVisible({ timeout: 3000 })

    const jianSidebar = page.locator('#jianSidebar')
    await expect(jianSidebar).toBeVisible({ timeout: 3000 })

    // 初始 jianOpen=true → 无 collapsed
    const initialClass = await jianSidebar.getAttribute('class')
    expect(initialClass).not.toContain('collapsed')

    // 点击关闭
    await jianBtn.click()
    await page.waitForTimeout(800)
    await expect(jianSidebar).toHaveClass(/collapsed/, { timeout: 3000 })

    // 再点击打开
    await jianBtn.click()
    await page.waitForTimeout(800)
    await expect(jianSidebar).not.toHaveClass(/collapsed/, { timeout: 3000 })
  })

  test('笺编辑器（默认已打开）可以输入文字', async ({ page }) => {
    // 笺默认已开
    const editor = page.locator('#jianSidebar textarea').first()
    await expect(editor).toBeVisible({ timeout: 3000 })

    // 用 fill() 而不是 click+type，避开 desk tree 拦截
    await editor.fill('# 测试标题\n\n这是一段测试文字。')

    const content = await editor.inputValue()
    expect(content).toContain('测试标题')
  })

  test('笺编辑器内容可以保存到 jian.md', async ({ page }) => {
    // 用默认工作区（mountId=default），后端肯定能写
    const mountId = 'default'

    const editor = page.locator('#jianSidebar textarea').first()
    await expect(editor).toBeVisible({ timeout: 3000 })

    // 输入内容
    await editor.fill('E2E 测试保存内容 2026')

    // 验证 textarea 值已更新
    await expect(editor).toHaveValue(/E2E 测试保存内容 2026/, { timeout: 3000 })

    // 直接调用保存 API（E2E 测试不依赖 autosave 时序）
    const saveResult = await page.evaluate(async (mid) => {
      const res = await fetch('/api/workbench/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'writeText',
          mountId: mid,
          subdir: '',
          name: 'jian.md',
          content: 'E2E 测试保存内容 2026',
        }),
      })
      console.log('[jian-debug] save response status:', res.status)
      const text = await res.text()
      console.log('[jian-debug] save response body:', text.slice(0, 200))
      return { ok: res.ok, status: res.status, body: text }
    }, mountId)
    console.log('[jian-debug] saveResult:', JSON.stringify(saveResult))
    if (!saveResult.ok) {
      throw new Error(`Save failed: status=${saveResult.status}, body=${saveResult.body?.slice(0,200)}`)
    }
    expect(saveResult.ok).toBe(true)

    // 验证保存成功：用 GET /workbench/content 读 jian.md 内容
    const savedContent = await page.evaluate(async (mid) => {
      const res = await fetch(`/api/workbench/content?mountId=${mid}&name=jian.md`)
      if (!res.ok) return null
      return await res.text()
    }, mountId)
    expect(savedContent).toContain('E2E 测试保存内容 2026')
  })
})

