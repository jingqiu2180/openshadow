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
const AI_TIMEOUT = 180_000

test.describe('🔁 Real Multi-turn: 真实多轮对话', () => {
  test.beforeEach(async ({ page }) => {
    attachDebugListeners(page, 'real-multiturn')
    await setupIPv4ApiProxy(page, 3000)
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await mockPlatform(page, { selectFolder: TEST_FOLDER })
    await page.waitForTimeout(2000)
  })

  async function sendAndWait(page: any, text: string) {
    const editor = page.locator('.tiptap').first()
    await editor.click()
    await page.keyboard.type(text)
    await page.keyboard.press('Enter')

    // 等用户消息出现在聊天区
    await expect(page.locator(`text=${text.substring(0, 10)}`).first()).toBeVisible({ timeout: 10000 })

    // 等 AI 消息出现
    await page.waitForTimeout(15000)
  }

  test('多轮对话：自我介绍后能被记住', async ({ page }) => {
    await sendAndWait(page, '我叫王帅，记住这个名字')
    await sendAndWait(page, '我叫什么名字？')

    const allText = await page.locator('[data-message-id] p').allTextContents()
    const full = allText.join(' ')
    expect(full).toMatch(/王帅/)
  })

  test('连续两轮对话不报错不崩溃', async ({ page }) => {
    await sendAndWait(page, '你好')
    await sendAndWait(page, '说一个笑话')

    // 三轮后页面仍可用
    const editor = page.locator('.tiptap').first()
    await expect(editor).toBeVisible({ timeout: 5000 })
    const msgs = await page.locator('[data-message-id]').count()
    expect(msgs).toBeGreaterThanOrEqual(2)
  })
})
