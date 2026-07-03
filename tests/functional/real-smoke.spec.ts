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

test.describe('🔥 Real Smoke: 真实 AI 冒烟测试', () => {
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
    await page.keyboard.type(text)
    await page.keyboard.press('Enter')
  }

  test('发"你好，用一句话介绍自己"，AI 回复非空', async ({ page }) => {
    // 记录发送前的消息数
    const before = await page.locator('[data-message-id]').count()
    await sendMessage(page, '你好，用一句话介绍自己')

    // 等待侧边栏出现本次会话（说明消息已发送并被服务器接受）
    await expect(page.locator(`text=用一句话介绍自己`).first()).toBeVisible({ timeout: 15000 })

    // 等待 AI 消息出现：消息数增加
    await expect(async () => {
      const after = await page.locator('[data-message-id]').count()
      expect(after).toBeGreaterThan(before + 1)  // 至少多了 AI 回复
    }).toPass({ timeout: AI_TIMEOUT, intervals: [5000] })

    // 等流式完成
    await page.waitForTimeout(5000)

    // 验证所有段落文本包含有意义的回复
    const allParagraphs = await page.locator('[data-message-id] p').allTextContents()
    const full = allParagraphs.join(' ')
    expect(full.length).toBeGreaterThan(20)
    expect(full).not.toMatch(/error|错误|失败|抱歉.{0,5}无法/)
    expect(full).not.toMatch(/timeout|超时|异常/)
  })

  test('发"1+1=?"，AI 回复正确', async ({ page }) => {
    const before = await page.locator('[data-message-id]').count()
    await sendMessage(page, '1+1=?')

    await expect(page.locator('text=1\\+1=').first()).toBeVisible({ timeout: 15000 })

    await expect(async () => {
      const after = await page.locator('[data-message-id]').count()
      expect(after).toBeGreaterThan(before + 1)
    }).toPass({ timeout: AI_TIMEOUT, intervals: [5000] })

    await page.waitForTimeout(5000)

    const allParagraphs = await page.locator('[data-message-id] p').allTextContents()
    const reply = allParagraphs.filter(t => t.trim().length > 1).join(' ')
    expect(reply).toMatch(/2|二|two/i)
  })

  test('空输入时发送按钮应为禁用态', async ({ page }) => {
    const sendBtn = page.locator('button:has-text("发送")').first()
    await expect(sendBtn).toBeVisible({ timeout: 10000 })
    const isDisabled = await sendBtn.isDisabled()
    expect(isDisabled).toBe(true)
  })
})
