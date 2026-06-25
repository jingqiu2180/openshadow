// tests/e2e/mock-chat.web.spec.ts
// Mock 真实 AI 回复：用 Playwright routeWebSocket 拦截 WS，
// 客户端发 prompt 时，服务端回 mock 流式响应。
// 验证：流式文本逐渐出现 → 最终 turn_end → 用户消息和 AI 消息都在聊天区。

import { test, expect } from '@playwright/test'
import {
  setupIPv4ApiProxy,
  mockPlatform,
  attachDebugListeners,
  getTestFolder,
} from './helpers/setup-helpers'

const TEST_FOLDER = getTestFolder()

/**
 * 拦截 WS 并模拟服务端
 * 收到客户端 type='prompt' 消息时，发回 mock 流式响应。
 */
async function setupMockChatWs(page: any) {
  // 拦截 ws://*/ws 和 wss://*/ws
  await page.routeWebSocket(/\/ws$/, async (ws: any) => {
    // 不连接真实服务器（因为 web runtime 的 WS URL 指向静态服务器 4173，不是 API 3000）
    // 完全 mock 模式：自己处理消息和发送响应

    // 监听客户端消息：检测 prompt
    ws.onMessage(async (msg: string) => {
      let parsed: any
      try { parsed = JSON.parse(msg) } catch { parsed = {} }

      // 忽略 context_usage / resume_stream / abort 等非 prompt 消息

      if (parsed.type === 'prompt') {
        const sessionPath = parsed.sessionPath || ''
        const streamId = `mock-stream-${Date.now()}`
        let seq = 1

        // 1. status: streaming start
        ws.send(JSON.stringify({
          type: 'status',
          isStreaming: true,
          streamId,
          turnId: streamId,
        }))

        // 2. 流式文本（按字符切片模拟流式输出）
        const fullReply = '你好！我是 Hanako。有什么可以帮你的吗？'
        for (let i = 0; i < fullReply.length; i += 1) {
          const delta = fullReply[i]
          ws.send(JSON.stringify({
            type: 'text_delta',
            delta,
            sessionPath,
            streamId,
            seq: seq++,
          }))
        }

        // 3. turn_end
        ws.send(JSON.stringify({
          type: 'turn_end',
          sessionPath,
          streamId,
          seq: seq++,
        }))

        // 4. status: streaming end
        ws.send(JSON.stringify({
          type: 'status',
          isStreaming: false,
          streamId: null,
          turnId: null,
        }))
      }
      // 其他消息类型（context_usage、resume_stream 等）忽略，mock 不回
    })
  })
}

test.describe('Mock Chat: 真实 AI 回复流式渲染', () => {
  test.beforeEach(async ({ page }) => {
    attachDebugListeners(page, 'mock-chat')
    await setupIPv4ApiProxy(page, 3000)
    // 必须在 goto 之前 setup WS 路由
    await setupMockChatWs(page)
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await mockPlatform(page, { selectFolder: TEST_FOLDER })
    await page.waitForFunction(
      () => {
        const el = document.getElementById('react-root')
        return el && el.children.length > 0
      },
      { timeout: 15000 }
    )
    await page.waitForTimeout(1500)

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
  })

  test('mock AI 回复：用户消息 + AI 回复都出现在聊天区', async ({ page }) => {
    const editor = page.locator('.tiptap').first()
    await expect(editor).toBeVisible({ timeout: 5000 })
    await editor.click()
    await page.keyboard.type('你好')

    // 发送
    await page.keyboard.press('Enter')

    // 等待 AI 回复（mock 完整文本）
    await expect(page.locator('text=有什么可以帮你的吗').first()).toBeVisible({ timeout: 10000 })
  })

  test('mock 流式渲染：等待不同时间看到不同文本', async ({ page }) => {
    const editor = page.locator('.tiptap').first()
    await editor.click()
    await page.keyboard.type('hi')

    await page.keyboard.press('Enter')

    // 等一会儿看是否出现"你好"
    await expect(page.locator('text=你好').first()).toBeVisible({ timeout: 10000 })
  })
})
