// tests/e2e/settings.web.spec.ts
// 设置面板：打开/关闭、主题切换

import { test, expect } from '@playwright/test'
import {
  setupIPv4ApiProxy,
  mockPlatform,
  attachDebugListeners,
  getTestFolder,
} from './helpers/setup-helpers'

const TEST_FOLDER = getTestFolder()

test.describe('Settings: 设置面板与主题切换', () => {
  test.beforeEach(async ({ page }) => {
    attachDebugListeners(page, 'settings')
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
  })

  test('打开设置面板', async ({ page }) => {
    // 点击侧边栏设置按钮（title 包含 "设置" 或 "settings"）
    const settingsBtn = page.locator('button[title*="设置"], button[title*="settings" i]').first()
    await settingsBtn.click()
    await page.waitForTimeout(1000)

    // 设置面板应该出现（检查 .settings 或 [class*="settings"] 元素）
    const settingsPanel = page.locator('[class*="settings"], [class*="Settings"]').first()
    await expect(settingsPanel).toBeVisible({ timeout: 3000 })
  })

  test('切换主题（深色/浅色）', async ({ page }) => {
    // 打开设置
    const settingsBtn = page.locator('button[title*="设置"], button[title*="settings" i]').first()
    await settingsBtn.click()
    await page.waitForTimeout(1000)

    // 找主题切换按钮（可能是一个 select 或 radio group）
    // 先检查当前主题
    const initialTheme = await page.evaluate(() => {
      return document.documentElement.getAttribute('data-theme')
    })

    // 点击主题选项（假设有 "深色" 或 "dark" 选项）
    const darkOption = page.locator('text=深色, text=dark, [value="dark"]').first()
    if (await darkOption.isVisible({ timeout: 2000 })) {
      await darkOption.click()
      await page.waitForTimeout(500)

      // 验证主题已切换
      const newTheme = await page.evaluate(() => {
        return document.documentElement.getAttribute('data-theme')
      })
      expect(newTheme).not.toBe(initialTheme)
    }
  })
})
