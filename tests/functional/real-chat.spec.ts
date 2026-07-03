/**
 * tests/functional/real-chat.spec.ts
 *
 * 真实多轮对话测试 — 验证 AI 能保持上下文。
 */

import { test, expect } from '@playwright/test'
import {
  setupIPv4ApiProxy,
  mockPlatform,
  attachDebugListeners,
  getTestFolder,
} from '../e2e/helpers/setup-helpers'

const TEST_FOLDER = getTestFolder()
const AI_TIMEOUT = 120_000

test.describe('🔁 Real Multi-turn: 真实多轮对话', () => {
  test.beforeEach(async ({ page }) => {
    attachDebugListeners(page, 'real-multiturn')
    await setupIPv4ApiProxy(page, 3000)
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await mockPlatform(page, { selectFolder: TEST_FOLDER })
    await page.waitForTimeout(2000)
  })

  async function sendMessage(page: any, text: string) {
    const editor = page.locator('.tiptap').first()
    await editor.click()
    await editor.fill(text)
    const sendBtn = page.locator('button:has-text("发送")').first()
    await sendBtn.click()
    // 等 AI 开始回复
    await expect(page.locator('.assistant-message, [class*="assistant"]').first()).toBeVisible({ timeout: AI_TIMEOUT })
    // 等流式完成
    await page.waitForTimeout(5000)
  }

  async function getLastReply(page: any): Promise<string> {
    const msgs = page.locator('.assistant-message, [class*="assistant"]')
    return (await msgs.last().textContent()) || ''
  }

  test('多轮对话：自我介绍后能被记住', async ({ page }) => {
    // Turn 1: tell the AI your name
    await sendMessage(page, '我叫王帅，记住这个名字')

    // Turn 2: ask who you are
    await sendMessage(page, '我叫什么名字？')

    const reply = await getLastReply(page)
    expect(reply.toLowerCase()).toMatch(/王帅/)
  })

  test('连续两轮不报错不中断', async ({ page }) => {
    await sendMessage(page, '你好')
    await sendMessage(page, '说一个笑话')
    await sendMessage(page, '谢谢')

    // 三轮后页面不应崩溃
    const editor = page.locator('.tiptap').first()
    await expect(editor).toBeVisible({ timeout: 5000 })
  })
})
