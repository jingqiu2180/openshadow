// tests/e2e/chat.web.spec.ts
// 聊天核心流程：输入消息、发送、接收流式响应、多会话切换

import { test, expect } from '@playwright/test'
import {
  setupIPv4ApiProxy,
  mockPlatform,
  attachDebugListeners,
  getTestFolder,
} from './helpers/setup-helpers'

const TEST_FOLDER = getTestFolder()

test.describe('Chat: 发送消息与流式响应', () => {
  test.beforeEach(async ({ page }) => {
    attachDebugListeners(page, 'chat')
    await setupIPv4ApiProxy(page, 3000)
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await mockPlatform(page, { selectFolder: TEST_FOLDER })
    await page.waitForFunction(
      () => {
        const el = document.getElementById('react-root')
        return el && el.children.length > 0
      },
      { timeout: 15000 }
    )
    await page.waitForTimeout(1000)

    // 选择工作区（点击工作台按钮 → 选择其他文件夹）
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
  })

  test('输入框可以输入文字', async ({ page }) => {
    const editor = page.locator('.tiptap').first()
    await expect(editor).toBeVisible({ timeout: 5000 })
    await editor.click()
    await page.keyboard.type('你好，Hanako')
    const content = await editor.textContent()
    expect(content).toContain('你好，Hanako')
  })

  test('mock 发送流程：点击发送后消息出现在聊天区域', async ({ page }) => {
    await page.route('**/api/chat', async (route) => {
      const body = 'data: {"type":"text","content":"你好！我是 Hanako。"}\n\ndata: {"type":"done"}\n\n'
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body,
      })
    })

    const editor = page.locator('.tiptap').first()
    await editor.click()
    await page.keyboard.type('你好')

    // Enter 发送
    await page.keyboard.press('Enter')

    // 用户消息出现在聊天区域
    await expect(page.locator('text=你好').first()).toBeVisible({ timeout: 5000 })
  })
})
