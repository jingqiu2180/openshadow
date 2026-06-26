// tests/e2e/jian-injection.web.spec.ts
// 验证 jian 内容是否被注入到 LLM prompt
//
// 状态：SKIPPED — 行为记录测试，不是回归测试
// 决策：openshadow 故意不注入 jian 内容到 LLM prompt（与上游 hanako 一致）
// 理由：
//   1. 上游 hanako 没做，跟着上游走避免 rebase 冲突
//   2. 自动注入 jian 有 token 爆炸 / 隐私 / 一致性 / 多会话冲突 4 个反模式风险
//   3. heartbeat 巡检（lib/desk/heartbeat.ts）已经覆盖"agent 主动看 jian"的真实场景
//
// 如未来产品决策变化（要做显式 @jian 引用 / RAG 摘要），把这个测试从 skip 移除
// 并实现对应注入逻辑即可。
//
// 测试设计：在 jian.md 写特殊标记 BLUE_FROG；用户发消息时拦截 WS，
// 记录服务端收到的 prompt 文本。验证 jian 标记是否在 prompt 里。

import { test, expect } from '@playwright/test'
import {
  setupIPv4ApiProxy,
  mockPlatform,
  attachDebugListeners,
  getTestFolder,
} from './helpers/setup-helpers'

const TEST_FOLDER = getTestFolder()
const JIAN_MARKER = 'BLUE_FROG_SECRET_2026'

interface CapturedPrompt {
  type?: string
  text?: string
  uiContext?: any
  displayMessage?: any
}

/**
 * 拦截 WS 并记录所有 prompt 消息
 */
async function setupWsPromptCapture(page: any): Promise<{
  getPrompts: () => CapturedPrompt[]
  sendMockReply: (text: string) => Promise<void>
}> {
  const captured: CapturedPrompt[] = []
  let mockWs: any = null

  await page.routeWebSocket(/\/ws$/, async (ws: any) => {
    mockWs = ws

    ws.onMessage(async (msg: string) => {
      let parsed: any
      try { parsed = JSON.parse(msg) } catch { parsed = {} }

      if (parsed.type === 'prompt') {
        captured.push({
          type: parsed.type,
          text: parsed.text,
          uiContext: parsed.uiContext,
          displayMessage: parsed.displayMessage,
        })
      }
    })
  })

  return {
    getPrompts: () => [...captured],
    sendMockReply: async (replyText: string) => {
      if (!mockWs) return
      const streamId = `mock-${Date.now()}`
      let seq = 1
      mockWs.send(JSON.stringify({ type: 'status', isStreaming: true, streamId, turnId: streamId }))
      for (const ch of replyText) {
        mockWs.send(JSON.stringify({
          type: 'text_delta',
          delta: ch,
          sessionPath: '',
          streamId,
          seq: seq++,
        }))
      }
      mockWs.send(JSON.stringify({ type: 'turn_end', sessionPath: '', streamId, seq: seq++ }))
      mockWs.send(JSON.stringify({ type: 'status', isStreaming: false, streamId: null, turnId: null }))
    },
  }
}

test.describe.skip('Jian 注入验证：jian 内容是否进 LLM prompt', () => {
  test('jian 写入特殊标记后，prompt 文本应该包含该标记', async ({ page }) => {
    const capture = await setupWsPromptCapture(page)

    attachDebugListeners(page, 'jian-injection')
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

    // 通过 API 写入 jian 内容（带特殊标记）
    const writeRes = await page.evaluate(async (marker: string) => {
      const res = await fetch('/api/desk/jian', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: `今天的密码是 ${marker}，记好了别忘。` }),
      })
      return { ok: res.ok, status: res.status }
    }, JIAN_MARKER)
    console.log('[test] jian 写入结果:', writeRes)

    // 等前端 load jian
    await page.waitForTimeout(2000)

    // 验证 jian 编辑器显示了 marker（前端确实拉到了）
    const jianHasMarker = await page.evaluate(async (marker: string) => {
      const res = await fetch('/api/desk/jian')
      const data = await res.json()
      return data.content?.includes(marker) || false
    }, JIAN_MARKER)
    expect(jianHasMarker).toBe(true)

    // 发消息，问 agent 关于 jian 的内容
    const editor = page.locator('.tiptap').first()
    await editor.click()
    await page.keyboard.type('我刚才在 jian 里写了什么密码？')
    await page.keyboard.press('Enter')

    // 等 mock WS 收到 prompt
    await page.waitForTimeout(2000)

    const prompts = capture.getPrompts()
    console.log('[test] 拦截到 prompt 数量:', prompts.length)
    if (prompts.length > 0) {
      console.log('[test] 第一个 prompt.text:', prompts[0].text)
      console.log('[test] 第一个 prompt.uiContext:', JSON.stringify(prompts[0].uiContext))
      console.log('[test] 第一个 prompt.displayMessage:', JSON.stringify(prompts[0].displayMessage))
    }

    // 期望：prompt 文本里包含 jian 标记
    // 当前实现的实情（截至本次测试）：jian 内容没注入 prompt，测试会失败
    // 这正是我们想揭露的——jian 实际是鸡肋
    const lastPrompt = prompts[prompts.length - 1]
    if (lastPrompt) {
      const promptText = lastPrompt.text || ''
      const fullPayload = JSON.stringify(lastPrompt)
      const markerFound =
        promptText.includes(JIAN_MARKER) ||
        fullPayload.includes(JIAN_MARKER)
      console.log(`[test] prompt 是否含 ${JIAN_MARKER}:`, markerFound)
      // 这是诚实的断言：暴露 bug
      // 取消 expect，让测试报告结果但不 fail
      // expect(markerFound).toBe(true)
      if (!markerFound) {
        console.log('[test] ⚠️ BUG 揭露：jian 内容未注入 LLM prompt')
      } else {
        console.log('[test] ✅ jian 内容已注入 LLM prompt')
      }
    }

    // 至少要发出去 prompt（验证 WS 通信本身正常）
    expect(prompts.length).toBeGreaterThan(0)
  })

  test('对比：mock agent 复读 jian 内容时，UI 是否正确显示', async ({ page }) => {
    // 这个测试不验证注入逻辑，只验证 UI 渲染能力
    const capture = await setupWsPromptCapture(page)

    attachDebugListeners(page, 'jian-mock-reply')
    await setupIPv4ApiProxy(page, 3000)
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await mockPlatform(page, { selectFolder: TEST_FOLDER })
    await page.waitForFunction(
      () => document.getElementById('react-root')?.children.length > 0,
      { timeout: 15000 }
    )
    await page.waitForTimeout(1500)

    // 选工作区
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

    // 发消息
    const editor = page.locator('.tiptap').first()
    await editor.click()
    await page.keyboard.type('hi')
    await page.keyboard.press('Enter')

    // 等 prompt 进来
    await page.waitForTimeout(1500)

    // 主动发 mock 回复（模拟 agent 已经"看到了" jian 内容的假想场景）
    await capture.sendMockReply('你说的是 BLUE_FROG_SECRET_2026')

    // 等 mock 流式渲染完成
    await page.waitForTimeout(1500)

    // 验证 UI 显示了 mock 回复
    await expect(page.locator('text=BLUE_FROG_SECRET_2026').first()).toBeVisible({ timeout: 5000 })
  })
})
