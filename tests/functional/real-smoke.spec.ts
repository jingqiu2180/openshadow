/**
 * tests/functional/real-smoke.spec.ts
 *
 * 真实功能冒烟测试 — 用真实的 minimax AI 模型，验证 openshadow 核心链路。
 *
 * 运行: npx playwright test --config=playwright.functional.config.ts
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

test.describe('AI Smoke', () => {
  test.beforeEach(async ({ page }) => {
    attachDebugListeners(page, 'real-smoke')
    await setupIPv4ApiProxy(page, 3000)
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await mockPlatform(page, { selectFolder: TEST_FOLDER })
    await page.waitForTimeout(2000)
  })

  async function sendMessage(page: any, text: string) {
    const editor = page.locator('.tiptap').first()
    await editor.click()
    await page.waitForTimeout(300)
    await page.keyboard.type(text)
    await page.waitForTimeout(300)
    await page.keyboard.press('Enter')
  }

  test('发"你好"获得 AI 回复', async ({ page }) => {
    const beforeMsgs = await page.locator('[data-message-id]').count()
    await sendMessage(page, '你好，用一句话介绍自己')

    // 等 AI 回复：消息数至少多一条
    await expect(async () => {
      const after = await page.locator('[data-message-id]').count()
      expect(after).toBeGreaterThan(beforeMsgs + 1)
    }).toPass({ timeout: AI_TIMEOUT, intervals: [5000] })

    await page.waitForTimeout(3000)
    const ps = await page.locator('[data-message-id] p').allTextContents()
    const full = ps.join(' ')
    expect(full.length).toBeGreaterThan(20)
    expect(full).not.toMatch(/error|错误|失败|抱歉.{0,5}无法|timeout|超时/)
  })

  test('发"1+1=?"获得 AI 回复', async ({ page }) => {
    const beforeMsgs = await page.locator('[data-message-id]').count()
    await sendMessage(page, '1+1=?')

    await expect(async () => {
      const after = await page.locator('[data-message-id]').count()
      expect(after).toBeGreaterThan(beforeMsgs + 1)
    }).toPass({ timeout: AI_TIMEOUT, intervals: [5000] })

    await page.waitForTimeout(3000)
    const ps = await page.locator('[data-message-id] p').allTextContents()
    const reply = ps.filter(t => t.trim().length > 1).join(' ')
    expect(reply).toMatch(/2|二|two/i)
  })

  test('空输入时发送按钮应为禁用态', async ({ page }) => {
    const sendBtn = page.locator('button:has-text("发送")').first()
    await expect(sendBtn).toBeVisible({ timeout: 10000 })
    expect(await sendBtn.isDisabled()).toBe(true)
  })
})
