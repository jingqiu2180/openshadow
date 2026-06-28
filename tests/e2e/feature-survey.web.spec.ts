// tests/e2e/feature-survey.web.spec.ts
// 全量功能清单：系统化点击每个 UI 元素，记录功能 + 状态

import { test } from '@playwright/test'
import { setupIPv4ApiProxy, mockPlatform, attachDebugListeners } from './helpers/setup-helpers'

const TEST_FOLDER = 'D:\\test\\workspace-fixture'

interface FeatureResult {
  area: string
  name: string
  status: 'ok' | 'broken' | 'partial' | 'skip'
  details: string
}

const results: FeatureResult[] = []
function record(area: string, name: string, status: FeatureResult['status'], details: string) {
  results.push({ area, name, status, details })
}

async function bootApp(page: any, label: string) {
  attachDebugListeners(page, label)
  await setupIPv4ApiProxy(page, 3000)
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await mockPlatform(page, { selectFolder: TEST_FOLDER })
  await page.waitForFunction(
    () => document.getElementById('react-root')?.children.length > 0,
    { timeout: 15000 }
  )
  await page.waitForTimeout(1500)
  const wsBtn = page.locator('button:has-text("工作台")').first()
  if (await wsBtn.isVisible().catch(() => false)) {
    await wsBtn.click()
    await page.waitForTimeout(500)
    const selectOther = page.locator('text=选择其他文件夹').first()
    if (await selectOther.isVisible().catch(() => false)) {
      await selectOther.click()
      await page.waitForTimeout(3000)
    }
  }
}

async function safeClick(page: any, locator: any, label: string, area: string, waitMs = 300): Promise<boolean> {
  try {
    if (await locator.isVisible({ timeout: 1000 }).catch(() => false)) {
      await locator.click({ timeout: 3000 })
      await page.waitForTimeout(waitMs)
      record(area, label, 'ok', '点击成功')
      return true
    } else {
      record(area, label, 'skip', '不可见')
      return false
    }
  } catch (e: any) {
    record(area, label, 'broken', `失败: ${(e.message || '').split('\n')[0].slice(0, 80)}`)
    return false
  }
}

test.setTimeout(180_000)
test('全量功能清单 - 系统化点击所有按钮', async ({ page }) => {
  await bootApp(page, 'feature-survey')

  // === 主页面所有按钮枚举 ===
  const allButtons = await page.locator('button:visible').all()
  console.log(`\n=== 主页面可见按钮: ${allButtons.length} ===`)

  const buttonInfo: { text: string; ariaLabel: string; title: string }[] = []
  for (const btn of allButtons) {
    const text = ((await btn.textContent().catch(() => '')) || '').trim()
    const ariaLabel = (await btn.getAttribute('aria-label').catch(() => '') || '').trim()
    const title = (await btn.getAttribute('title').catch(() => '') || '').trim()
    buttonInfo.push({ text, ariaLabel, title })
  }

  // 过滤掉会话列表项（不算功能按钮）
  const functionalButtons = buttonInfo.filter(b => {
    const combined = (b.text + ' ' + b.ariaLabel + ' ' + b.title).trim()
    if (combined.length === 0) return false
    if (combined.includes('rem-default · workspace')) return false
    if (combined.includes('rem-default · openshadow')) return false
    return true
  })
  console.log(`功能按钮: ${functionalButtons.length}`)

  // 按 label 去重列出
  const seenLabels = new Set<string>()
  const uniqueLabels: string[] = []
  for (const b of functionalButtons) {
    const label = (b.text || b.ariaLabel || b.title).slice(0, 30)
    if (!seenLabels.has(label)) {
      seenLabels.add(label)
      uniqueLabels.push(label)
    }
  }
  console.log('唯一按钮标签:')
  uniqueLabels.forEach((l, i) => console.log(`  ${i + 1}. ${l}`))

  // === 第 1 步：侧边栏主菜单（聊天/频道/书桌） ===
  console.log('\n=== 顶栏主菜单 ===')
  await safeClick(page, page.locator('button:has-text("聊天")').first(), '聊天 tab', '顶栏', 500)
  await safeClick(page, page.locator('button:has-text("频道")').first(), '频道 tab', '顶栏', 500)
  await safeClick(page, page.locator('button:has-text("书桌")').first(), '书桌 tab', '顶栏', 500)
  await safeClick(page, page.locator('button:has-text("聊天")').first(), '聊天 tab (返回)', '顶栏', 500)

  // === 第 2 步：侧边栏功能按钮 ===
  console.log('\n=== 侧边栏功能 ===')
  await safeClick(page, page.locator('button:has-text("新对话")').first(), '新对话', '侧边栏', 500)
  await safeClick(page, page.locator('button:has-text("接入社交平台")').first(), '接入社交平台', '侧边栏', 500)
  await safeClick(page, page.locator('button:has-text("活动")').first(), '活动', '侧边栏', 500)
  await safeClick(page, page.locator('button:has-text("任务计划")').first(), '任务计划', '侧边栏', 500)
  await safeClick(page, page.locator('button:has-text("收起侧边栏")').first(), '收起侧边栏', '侧边栏', 500)
  await safeClick(page, page.locator('button[aria-label*="展开"], button:has-text("展开对话")').first(), '展开侧边栏', '侧边栏', 500)

  // === 第 3 步：设置面板 ===
  console.log('\n=== 设置面板 ===')
  // 多种方式找设置入口
  let settingsOpened = false
  const settingsSelectors = [
    'aside button[aria-label="设置"]',
    'button[title="设置"]',
    'button[aria-label*="Settings"]',
    'aside button:has-text("设置")',
    'button:has(svg[viewBox]):has-text("设置")',
  ]
  for (const sel of settingsSelectors) {
    const btn = page.locator(sel).first()
    if (await btn.isVisible({ timeout: 500 }).catch(() => false)) {
      try {
        await btn.click({ timeout: 2000 })
        await page.waitForTimeout(1500)
        // 验证面板打开了（找设置 dialog）
        const dialog = page.locator('[role="dialog"]').first()
        if (await dialog.isVisible({ timeout: 1000 }).catch(() => false)) {
          settingsOpened = true
          record('设置面板', '打开设置', 'ok', '面板已显示')
          break
        }
      } catch {}
    }
  }
  if (!settingsOpened) {
    record('设置面板', '打开设置', 'broken', '找不到入口或点击无响应')
  }

  if (settingsOpened) {
    // 枚举设置内的所有可点击导航项
    const navItems = await page.locator('[role="dialog"] [role="tab"], [role="dialog"] aside button, [role="dialog"] nav button, [role="dialog"] aside a').all()
    const navTexts: string[] = []
    for (const item of navItems) {
      const txt = ((await item.textContent().catch(() => '')) || '').trim()
      if (txt && txt.length < 20 && !navTexts.includes(txt)) navTexts.push(txt)
    }
    console.log(`  设置导航项 (${navItems.length} 个): ${navTexts.slice(0, 30).join(' | ')}`)

    // 点击每个导航项
    for (const txt of navTexts.slice(0, 30)) {
      const item = page.locator(`[role="dialog"] [role="tab"]:has-text("${txt}"), [role="dialog"] aside button:has-text("${txt}"), [role="dialog"] nav button:has-text("${txt}"), [role="dialog"] aside a:has-text("${txt}")`).first()
      try {
        if (await item.isVisible({ timeout: 500 }).catch(() => false)) {
          await item.click({ timeout: 2000 })
          await page.waitForTimeout(500)
          const headings = await page.locator('[role="dialog"] h1, [role="dialog"] h2, [role="dialog"] h3, [role="dialog"] h4').allTextContents()
          const filtered = headings.filter(h => h.length > 0 && h.length < 50).slice(0, 4)
          record('设置面板', `Nav "${txt}"`, 'ok', filtered.join(' | ') || '(空)')
        }
      } catch (e: any) {
        record('设置面板', `Nav "${txt}"`, 'broken', '点击失败')
      }
    }

    // 关闭设置
    const closeSettings = page.locator('[role="dialog"] button[aria-label*="关闭"], [role="dialog"] button:has-text("返回"), [role="dialog"] button:has-text("取消")').first()
    if (await closeSettings.isVisible({ timeout: 500 }).catch(() => false)) {
      await closeSettings.click().catch(() => {})
      await page.waitForTimeout(500)
    } else {
      // 兜底：按 Escape 关闭
      await page.keyboard.press('Escape')
      await page.waitForTimeout(500)
    }
    // 再点 overlay 外部关闭
    const overlay = page.locator('[data-testid="settings-modal-overlay"]').first()
    if (await overlay.isVisible({ timeout: 500 }).catch(() => false)) {
      // 点 overlay 边缘（不是 modal 内部）
      await page.mouse.click(50, 50)
      await page.waitForTimeout(500)
    }
  }

  // === 第 4 步：聊天区操作 ===
  console.log('\n=== 聊天区操作 ===')
  const editor = page.locator('.tiptap').first()
  if (await editor.isVisible({ timeout: 1000 }).catch(() => false)) {
    await editor.click()
    await page.keyboard.type('功能清单测试消息')
    record('聊天区', '输入框', 'ok', '可输入')

    await safeClick(page, page.locator('button:has-text("发送")').first(), '发送消息', '聊天区', 500)
    await page.waitForTimeout(8000) // 等 AI 回复

    const aiReplies = await page.locator('[class*="assistant"], [class*="Assistant"]').count()
    record('聊天区', 'AI 回复', aiReplies > 0 ? 'ok' : 'partial', `${aiReplies} 条`)

    // 上下文按钮
    await safeClick(page, page.locator('button:has-text("上下文"), button[aria-label*="上下文"]').first(), '上下文操作', '聊天区', 500)

    // 模型选择
    const modelBtn = page.locator('button:has-text("MiniMax"), button[class*="Model"]').first()
    if (await modelBtn.isVisible({ timeout: 500 }).catch(() => false)) {
      await modelBtn.click()
      await page.waitForTimeout(500)
      const modelItems = await page.locator('[role="menuitem"], [role="option"]').allTextContents()
      const models = modelItems.filter(t => t && t.length < 50 && !t.includes('读写') && !t.includes('文件')).slice(0, 10)
      record('聊天区', '打开模型选择器', 'ok', models.length > 0 ? `选项: ${models.join(', ')}` : '(无选项)')
      await page.keyboard.press('Escape')
      await page.waitForTimeout(300)
    }

    // 命令菜单
    const cmdBtn = page.locator('button[aria-label*="命令"]').first()
    if (await cmdBtn.isVisible({ timeout: 500 }).catch(() => false)) {
      await cmdBtn.click()
      await page.waitForTimeout(500)
      const items = await page.locator('[role="menuitem"]').allTextContents()
      const cmds = items.filter(t => t.startsWith('/')).slice(0, 10)
      record('聊天区', '命令菜单', cmds.length > 0 ? 'ok' : 'partial', cmds.join(', '))
      await page.keyboard.press('Escape')
      await page.waitForTimeout(300)
    }
  }

  // === 第 5 步：工作区/笺 ===
  console.log('\n=== 工作区/笺 ===')
  const wsTree = page.locator('[role="tree"]').first()
  if (await wsTree.isVisible({ timeout: 500 }).catch(() => false)) {
    const items = await page.locator('[role="treeitem"]').count()
    record('工作区', '文件树', 'ok', `${items} 项`)
    if (items > 0) {
      await safeClick(page, page.locator('[role="treeitem"]').first(), '点击文件', '工作区', 300)
    }
  }

  const jianEditor = page.locator('textarea[placeholder*="写点什么"], [placeholder*="笺"]').first()
  if (await jianEditor.isVisible({ timeout: 500 }).catch(() => false)) {
    record('笺', '笺编辑器', 'ok', '可见')
  }

  // === 第 6 步：会话操作 ===
  console.log('\n=== 会话操作 ===')
  const firstSession = page.locator('aside button').filter({ hasText: /rem-default/ }).first()
  if (await firstSession.isVisible({ timeout: 500 }).catch(() => false)) {
    try {
      await firstSession.click({ button: 'right', timeout: 1000 }).catch(() => {})
      await page.waitForTimeout(300)
      const ctxMenuItems = await page.locator('[role="menu"], [class*="context"], [class*="Context"]').allTextContents()
      record('会话', '右键菜单', ctxMenuItems.length > 0 ? 'ok' : 'skip', ctxMenuItems.slice(0, 5).join(' | '))
      await page.keyboard.press('Escape')
    } catch (e: any) {
      record('会话', '右键菜单', 'broken', '失败')
    }
  }

  // === 第 7 步：搜索 ===
  const search = page.locator('input[placeholder*="搜索对话"]').first()
  if (await search.isVisible({ timeout: 500 }).catch(() => false)) {
    await search.fill('hi')
    await page.waitForTimeout(500)
    record('搜索', '会话搜索', 'ok', '可输入')
    await search.fill('')
  }

  // === 总结 ===
  console.log('\n========== 全量功能清单报告 ==========')
  const byArea: Record<string, FeatureResult[]> = {}
  for (const r of results) {
    if (!byArea[r.area]) byArea[r.area] = []
    byArea[r.area].push(r)
  }
  for (const [area, items] of Object.entries(byArea)) {
    const okN = items.filter(i => i.status === 'ok').length
    const partialN = items.filter(i => i.status === 'partial').length
    const brokenN = items.filter(i => i.status === 'broken').length
    const skipN = items.filter(i => i.status === 'skip').length
    console.log(`\n### ${area} — ${items.length} 项 (ok:${okN} partial:${partialN} broken:${brokenN} skip:${skipN})`)
    for (const item of items) {
      console.log(`  [${item.status}] ${item.name}${item.details ? ' — ' + item.details : ''}`)
    }
  }

  const ok = results.filter(r => r.status === 'ok').length
  const partial = results.filter(r => r.status === 'partial').length
  const broken = results.filter(r => r.status === 'broken').length
  const skip = results.filter(r => r.status === 'skip').length
  console.log(`\n========== 总计 ==========`)
  console.log(`OK: ${ok} / Partial: ${partial} / Broken: ${broken} / Skip: ${skip} / Total: ${results.length}`)
})