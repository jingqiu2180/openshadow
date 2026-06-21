import { chromium } from 'playwright';

const TEST_TIMEOUT = 15000;

(async () => {
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const results = [];

  try {
    // 监听 console errors
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    // 监听网络请求
    const apiRequests = [];
    const wsConnections = [];
    page.on('request', req => {
      const url = req.url();
      if (url.includes('/api/') || url.includes(':3000')) {
        apiRequests.push({ url: url.replace('http://localhost:3000', ''), method: req.method() });
      }
      if (url.startsWith('ws://') || url.startsWith('wss://')) {
        wsConnections.push(url);
      }
    });

    await page.goto('http://localhost:5173', { timeout: TEST_TIMEOUT });
    await page.waitForLoadState('networkidle', { timeout: TEST_TIMEOUT });
    await page.waitForTimeout(3000);

    // Test 1: 检查 API 请求是否正常
    console.log('[网络] 检查 API 请求...');
    const apiReqSummary = apiRequests.slice(0, 10);
    results.push({
      test: 'API 请求',
      pass: apiRequests.length > 0,
      detail: `请求数:${apiRequests.length}, 示例:${JSON.stringify(apiReqSummary)}`
    });

    // Test 2: 检查 WebSocket 连接
    console.log('[网络] 检查 WebSocket 连接...');
    const wsUrl = 'ws://localhost:3000';
    const wsCheck = await page.evaluate((wsUrl) => {
      // 检查是否有 WebSocket 连接
      const hasWs = typeof WebSocket !== 'undefined';
      // 尝试检查 window 上的 ws 相关属性
      const store = window.useStore?.getState?.();
      return {
        hasWs,
        connected: store?.connected || false,
        status: store?.status || 'unknown'
      };
    }, wsUrl).catch(() => ({}));
    results.push({
      test: 'WebSocket 连接',
      pass: wsCheck.connected === true,
      detail: JSON.stringify(wsCheck)
    });

    // Test 3: 发送消息并检查网络请求
    console.log('[聊天] 发送消息并检查网络...');
    const input = await page.$('[contenteditable="true"], textarea, input[type="text"]');
    let sendOk = false;
    if (input) {
      await input.click();
      await page.waitForTimeout(300);
      await input.fill('测试消息 2');
      await page.waitForTimeout(300);
      const sendBtn = await page.$('button[type="submit"], button:has(svg), [class*="send"]');
      if (sendBtn) {
        await sendBtn.click();
        await page.waitForTimeout(3000);
        sendOk = true;
      }
    }
    results.push({
      test: '发送消息（网络）',
      pass: sendOk,
      detail: `sendOk:${sendOk}, API请求数:${apiRequests.length}`
    });

    // Test 4: 检查文件树
    console.log('[文件树] 检查文件树...');
    const fileTreeInfo = await page.evaluate(() => {
      const tree = document.querySelector('[class*="tree"]');
      if (!tree) return { hasTree: false };
      const items = tree.querySelectorAll('[class*="item"], [class*="node"]');
      return {
        hasTree: true,
        itemCount: items.length,
        treeClass: tree.className.slice(0, 80)
      };
    }).catch(() => ({ hasTree: false }));
    results.push({
      test: '文件树',
      pass: fileTreeInfo.hasTree === true,
      detail: JSON.stringify(fileTreeInfo)
    });

    // Test 5: Console errors
    console.log('[Console] 检查 console errors...');
    results.push({
      test: 'Console Errors',
      pass: consoleErrors.length === 0,
      detail: `errors:${consoleErrors.length}, 示例:${consoleErrors.slice(0, 2).join('; ')}`
    });

    // 截图
    await page.screenshot({ path: 'test-network.png' });

    // 输出结果
    console.log('\n===== 网络+功能测试结果 =====');
    let passCount = 0;
    for (const r of results) {
      const icon = r.pass ? '✅' : '❌';
      console.log(`${icon} [${r.test}] ${r.detail}`);
      if (r.pass) passCount++;
    }
    console.log(`\n通过: ${passCount}/${results.length}`);

  } catch (err) {
    console.error('测试出错:', err.message);
  } finally {
    await browser.close();
  }
})();
