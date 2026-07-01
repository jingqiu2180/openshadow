// 浏览器模式冒烟测试
// 验证 Vite dev server + proxy 链路是否工作正常
import { chromium } from 'playwright'

const BASE = 'http://localhost:5280'

async function run() {
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext()
  const page = await ctx.newPage()

  const consoleMessages = []
  const pageErrors = []
  const requestFailures = []
  const wsConnections = []

  page.on('console', (msg) => {
    consoleMessages.push({ type: msg.type(), text: msg.text() })
  })
  page.on('pageerror', (err) => {
    pageErrors.push({ message: err.message, stack: err.stack })
  })
  page.on('requestfailed', (req) => {
    requestFailures.push({ url: req.url(), failure: req.failure()?.errorText })
  })
  page.on('websocket', (ws) => {
    wsConnections.push(ws.url())
    ws.on('close', () => {})
  })

  console.log('=== Step 1: 访问首页 ===')
  const resp = await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 15000 })
  console.log('HTTP status:', resp?.status())

  console.log('=== Step 2: 等待 React 挂载 ===')
  // 等待 #react-root 有内容
  try {
    await page.waitForFunction(
      () => document.querySelector('#react-root')?.children.length > 0,
      { timeout: 15000 }
    )
    console.log('React 已挂载')
  } catch (e) {
    console.log('React 未挂载:', e.message)
  }

  console.log('=== Step 3: 等待 5s 收集日志 ===')
  await page.waitForTimeout(5000)

  console.log('=== Step 4: 检查关键 DOM 元素 ===')
  const checks = await page.evaluate(() => {
    return {
      hasReactRoot: !!document.querySelector('#react-root'),
      reactRootChildren: document.querySelector('#react-root')?.children.length ?? 0,
      bodyText: document.body.innerText.slice(0, 500),
      title: document.title,
      platformAttr: document.documentElement.getAttribute('data-platform'),
      hasWindowPlatform: typeof window.platform !== 'undefined',
      windowPlatformKeys: window.platform ? Object.keys(window.platform).slice(0, 20) : null,
    }
  })
  console.log(JSON.stringify(checks, null, 2))

  console.log('=== Step 5: console 输出 ===')
  for (const m of consoleMessages) {
    console.log(`[${m.type}]`, m.text.slice(0, 300))
  }

  console.log('=== Step 6: page error ===')
  for (const e of pageErrors) {
    console.log('ERROR:', e.message)
  }

  console.log('=== Step 7: 请求失败 ===')
  for (const f of requestFailures) {
    console.log('FAIL:', f.url, '->', f.failure)
  }

  console.log('=== Step 8: WebSocket 连接 ===')
  for (const w of wsConnections) {
    console.log('WS:', w)
  }

  console.log('=== Step 9: 截图 ===')
  await page.screenshot({ path: 'web-smoke-test.png', fullPage: true })
  console.log('截图保存: web-smoke-test.png')

  await browser.close()
  console.log('=== 完成 ===')
  console.log('总结:')
  console.log('  console:', consoleMessages.length)
  console.log('  pageErrors:', pageErrors.length)
  console.log('  requestFailures:', requestFailures.length)
  console.log('  wsConnections:', wsConnections.length)
}

run().catch((e) => {
  console.error('测试失败:', e)
  process.exit(1)
})
