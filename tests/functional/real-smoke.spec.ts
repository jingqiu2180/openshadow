/**
 * tests/functional/real-smoke.spec.ts
 *
 * 真实功能冒烟测试 — 用真实的 minimax AI 模型，验证 openshadow 核心链路。
 *
 * 跟现有 E2E 的区别：不 mock WebSocket，不 mock API 响应。
 * 每个测试连接真实的 AI backend，验证用户真正会遇到的场景。
 *
 * 运行: npx playwright test --config=playwright.config.ts tests/functional/
 *       或单独: npx playwright test tests/functional/real-smoke.spec.ts
 */

import { test, expect } from '@playwright/test'
import {
  setupIPv4ApiProxy,
  mockPlatform,
  attachDebugListeners,
  getTestFolder,
} from '../e2e/helpers/setup-helpers'

const TEST_FOLDER = getTestFolder()
const AI_TIMEOUT = 120_000  // AI 回复最大等待 2 分钟
const SETUP_TIMEOUT = 30_000

test.describe('🔥 Real Smoke: 真实 AI 冒烟测试', () => {
  test.beforeEach(async ({ page }) => {
    attachDebugListeners(page, 'real-smoke')
    await setupIPv4ApiProxy(page, 3000)
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await mockPlatform(page, { selectFolder: TEST_FOLDER })
    await page.waitForTimeout(2000)
  })

  test('发"你好，用一句话介绍自己"，AI 回复非空且有内容', async ({ page }) => {
    // 定位输入框并输入
    const editor = page.locator('.tiptap').first()
    await editor.click()
    await editor.fill('你好，用一句话介绍自己')

    // 点击发送
    const sendBtn = page.locator('button:has-text("发送")').first()
    await expect(sendBtn).toBeVisible({ timeout: SETUP_TIMEOUT })
    await sendBtn.click()

    // 等待 AI 回复出现（流式渲染）
    const assistantMsg = page.locator('.assistant-message, .message.assistant, [class*="assistant"]').first()
    await expect(assistantMsg).toBeVisible({ timeout: AI_TIMEOUT })

    // 等流式完成（不再显示 streaming 状态）
    await page.waitForTimeout(3000)

    // 验证回复有意义
    const allText = await page.locator('.assistant-message, [class*="assistant"]').allTextContents()
    const reply = allText.join(' ')
    expect(reply.length).toBeGreaterThan(10)
    // 不能是错误信息
    expect(reply).not.toMatch(/error|错误|失败|抱歉.{0,5}无法/)
  })

  test('发"1+1=?"，AI 回复包含正确答案', async ({ page }) => {
    const editor = page.locator('.tiptap').first()
    await editor.click()
    await editor.fill('1+1=?')

    const sendBtn = page.locator('button:has-text("发送")').first()
    await sendBtn.click()

    const assistantMsg = page.locator('.assistant-message, .message.assistant, [class*="assistant"]').first()
    await expect(assistantMsg).toBeVisible({ timeout: AI_TIMEOUT })
    await page.waitForTimeout(3000)

    const allText = await page.locator('.assistant-message, [class*="assistant"]').allTextContents()
    const reply = allText.join(' ')
    expect(reply).toMatch(/2|二|two/i)
  })

  test('发送空消息不应触发发送', async ({ page }) => {
    const sendBtn = page.locator('button:has-text("发送")').first()
    const isDisabled = await sendBtn.isDisabled()
    // 空输入时发送按钮应禁用或不可点击
    expect(isDisabled).toBe(true)
  })
})
