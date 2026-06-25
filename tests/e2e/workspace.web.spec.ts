// tests/e2e/workspace.web.spec.ts
// 关键流程：选择文件夹 → 工作区切换 → WelcomeScreen 隐藏 → 文件树加载
// 这是上几轮调试的核心场景，必须保证不退化

import { test, expect } from '@playwright/test'
import {
  setupIPv4ApiProxy,
  mockPlatform,
  attachDebugListeners,
  getTestFolder,
} from './helpers/setup-helpers'

const TEST_FOLDER = getTestFolder()

test.describe('Workspace: 选择文件夹并切换', () => {
  test('完整流程：选择其他文件夹 → 工作区切换 → WelcomeScreen 隐藏', async ({ page }) => {
    attachDebugListeners(page, 'workspace')

    // 1. 先 setup（必须在 page.goto 之前，否则 /api 请求会打到静态服务器返回 HTML）
    await setupIPv4ApiProxy(page, 3000)

    // 2. 打开页面（baseURL 已配置，直接用 /）
    await page.goto('/', { waitUntil: 'domcontentloaded' })

    // 3. mock platform（必须在 page.goto 之后，否则 platform.js 会覆盖）
    await mockPlatform(page, { selectFolder: TEST_FOLDER })

    // 验证 mock 是否注入
    const mockCheck = await page.evaluate(() => {
      return typeof (window as any).platform?.selectFolder === 'function'
    })
    console.log('[debug] platform.selectFolder is function:', mockCheck)

    // 4. 等 React 挂载（react-root 有子节点）
    await page.waitForFunction(
      () => {
        const el = document.getElementById('react-root')
        return el && el.children.length > 0
      },
      { timeout: 15000 }
    )
    await page.waitForTimeout(1000)

    // 4. 验证初始：WelcomeScreen 可见
    const welcomeInitial = await page.evaluate(() => {
      const el = document.getElementById('welcome')
      return el ? !el.classList.contains('hidden') : null
    })
    expect(welcomeInitial).toBe(true)

    // 5. 找 "工作台" 按钮并点击
    const wsBtn = page.locator('button:has-text("工作台")').first()
    await expect(wsBtn).toBeVisible({ timeout: 5000 })
    await wsBtn.click()
    await page.waitForTimeout(500)

    // 6. 找 "选择其他文件夹" 并点击
    const selectOther = page.locator('text=选择其他文件夹').first()
    await expect(selectOther).toBeVisible({ timeout: 5000 })
    await selectOther.click()

    // 7. 等待 applyStudioWorkspace 完成（WelcomeScreen 隐藏 = 成功）
    await page.waitForFunction(
      () => {
        const el = document.getElementById('welcome')
        return el && el.classList.contains('hidden')
      },
      { timeout: 10000 }
    )

    // 8. 核心断言：WelcomeScreen 已隐藏（workspace 切换成功）
    const welcomeHidden = await page.evaluate(() => {
      const el = document.getElementById('welcome')
      return el?.classList?.contains('hidden') ?? null
    })
    expect(welcomeHidden).toBe(true)
  })

  test('点击工作台按钮打开下拉菜单', async ({ page }) => {
    attachDebugListeners(page, 'dropdown')
    await setupIPv4ApiProxy(page, 3000)

    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(
      () => {
        const el = document.getElementById('react-root')
        return el && el.children.length > 0
      },
      { timeout: 15000 }
    )
    await page.waitForTimeout(1000)

    // 点击工作台按钮
    const wsBtn = page.locator('button:has-text("工作台")').first()
    await expect(wsBtn).toBeVisible({ timeout: 5000 })
    await wsBtn.click()
    await page.waitForTimeout(500)

    // 下拉菜单应该出现
    await expect(page.locator('text=选择其他文件夹')).toBeVisible({ timeout: 3000 })
    await expect(page.locator('text=添加工作台以外的文件夹')).toBeVisible({ timeout: 3000 })
  })

  test('取消 selectFolder (mock 返回 null) 不切换工作区', async ({ page }) => {
    attachDebugListeners(page, 'cancel')
    // mock 返回 null = 用户取消

    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(
      () => {
        const el = document.getElementById('react-root')
        return el && el.children.length > 0
      },
      { timeout: 15000 }
    )
    await page.waitForTimeout(1000)

    // 必须在 page.goto 之后调用（否则 platform.js 会覆盖）
    await mockPlatform(page, { selectFolder: null })
    await setupIPv4ApiProxy(page, 3000)

    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(
      () => {
        const el = document.getElementById('react-root')
        return el && el.children.length > 0
      },
      { timeout: 15000 }
    )
    await page.waitForTimeout(1000)

    const wsBtn = page.locator('button:has-text("工作台")').first()
    await wsBtn.click()
    await page.waitForTimeout(500)

    const selectOther = page.locator('text=选择其他文件夹').first()
    await selectOther.click()
    await page.waitForTimeout(2000)

    // 取消后 WelcomeScreen 应该仍然可见
    const stillVisible = await page.evaluate(() => {
      const el = document.getElementById('welcome')
      return el ? !el.classList.contains('hidden') : null
    })
    expect(stillVisible).toBe(true)
  })
})