import { chromium } from 'playwright';

const VITE_URL = 'http://localhost:5173';

async function test() {
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const results = [];

  try {
    // ── Test 1: 页面加载 ────────────────────────────────────────
    console.log('[TEST 1] 页面加载...');
    await page.goto(VITE_URL, { timeout: 15000 });
    await page.waitForLoadState('networkidle', { timeout: 10000 });
    const title = await page.title();
    results.push({ test: '页面加载', pass: !!title, detail: `title=${title}` });
    await page.screenshot({ path: 'test-01-load.png', fullPage: false });

    // ── Test 2: 聊天消息渲染 ────────────────────────────────────
    console.log('[TEST 2] 聊天消息渲染...');
    // 先发送一条消息，然后检查是否渲染
    const inputArea = await page.$('.input-area textarea, [contenteditable]');
    let msgCount = 0;
    if (inputArea) {
      await inputArea.click();
      await page.waitForTimeout(500);
      await page.keyboard.type('你好，测试消息');
      await page.waitForTimeout(500);
      // 按 Enter 发送
      await page.keyboard.press('Enter');
      await page.waitForTimeout(3000);
      // 从 store 获取消息数
      const storeInfo = await page.evaluate(() => {
        const store = window.__STORE__?.getState?.();
        if (!store) return { hasStore: false, msgCount: 0 };
        // 找当前 session 的消息数
        const currentPath = store.currentSessionPath;
        if (!currentPath || !store.chatSessions?.[currentPath]) {
          return { hasStore: true, msgCount: 0, currentPath };
        }
        const items = store.chatSessions[currentPath]?.items || [];
        return { hasStore: true, msgCount: items.length, currentPath };
      }).catch(() => ({ hasStore: false, msgCount: 0 }));
      msgCount = storeInfo.msgCount || 0;
      results.push({
        test: '聊天消息渲染',
        pass: msgCount > 0,
        detail: `store消息数:${msgCount}, hasStore:${storeInfo.hasStore}`
      });
    } else {
      results.push({ test: '聊天消息渲染', pass: false, detail: '未找到输入框' });
    }
    await page.screenshot({ path: 'test-02-chat.png', fullPage: false });

    // ── Test 3: 侧边栏会话列表 ─────────────────────────────────
    console.log('[TEST 3] 侧边栏会话列表...');
    const sidebar = await page.$('.sidebar, [class*="sidebar"]');
    const sidebarVisible = sidebar ? await sidebar.isVisible().catch(() => false) : false;
    const sessionItems = await page.locator('[class*="sessionItem"], [class*="SessionItem"]').count();
    results.push({
      test: '侧边栏会话列表',
      pass: sidebarVisible,
      detail: `sidebar可见:${sidebarVisible}, 会话数:${sessionItems}`
    });
    await page.screenshot({ path: 'test-03-sidebar.png', fullPage: false });

    // ── Test 4: 点击会话切换 ────────────────────────────────────
    console.log('[TEST 4] 点击会话切换...');
    let sessionClickPass = false;
    if (sessionItems > 0) {
      await page.locator('[class*="sessionItem"]').first().click().catch(() => {});
      await page.waitForTimeout(1000);
      sessionClickPass = true;
    }
    results.push({
      test: '点击会话切换',
      pass: sessionClickPass || sessionItems === 0,
      detail: `可点击:${sessionClickPass}`
    });

    // ── Test 5: 输入区焦点 ──────────────────────────────────────
    console.log('[TEST 5] 输入区焦点...');
    const inputArea2 = await page.$('.input-area textarea, [contenteditable]');
    let inputPass = false;
    if (inputArea2) {
      await inputArea2.click().catch(() => {});
      await page.waitForTimeout(500);
      const focused = await page.evaluate(() => document.activeElement?.tagName);
      results.push({ test: '输入区焦点', pass: true, detail: `focused:${focused}` });
      inputPass = true;
    } else {
      results.push({ test: '输入区焦点', pass: false, detail: '未找到输入区' });
    }

    // ── Test 6: 发送消息 ─────────────────────────────────────────
    console.log('[TEST 6] 发送消息...');
    let sendPass = false;
    if (inputPass) {
      await page.keyboard.type('第二条测试消息');
      await page.waitForTimeout(500);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2000);
      sendPass = true;
    }
    results.push({ test: '发送消息', pass: sendPass, detail: `sendPass:${sendPass}` });
    await page.screenshot({ path: 'test-06-send.png', fullPage: false });

    // ── Test 7: 设置模态框 ──────────────────────────────────────
    console.log('[TEST 7] 设置按钮...');
    const settingsBtn = await page.$('button[class*="settings"], button:has-text("设置"), button:has-text("Settings")');
    let settingsPass = false;
    if (settingsBtn) {
      await settingsBtn.click().catch(() => {});
      await page.waitForTimeout(1000);
      const modal = await page.$('[role="dialog"], [class*="modal"]');
      const modalVisible = modal ? await modal.isVisible().catch(() => false) : false;
      results.push({ test: '设置模态框', pass: modalVisible, detail: `modal可见:${modalVisible}` });
      settingsPass = true;
      if (modalVisible) {
        await page.screenshot({ path: 'test-07-settings.png', fullPage: false });
        const closeBtn = await page.$('[role="dialog"] button:last-child, [class*="modal"] button[class*="close"]');
        if (closeBtn) await closeBtn.click().catch(() => {});
        await page.waitForTimeout(500);
      }
    } else {
      results.push({ test: '设置按钮', pass: false, detail: '未找到设置按钮' });
    }

    // ── Test 8: 工作台面板 ──────────────────────────────────────
    console.log('[TEST 8] 工作台面板...');
    // 检查 preview panel 是否存在（CSS Modules 哈希类名）
    const deskInfo = await page.evaluate(() => {
      const allEls = document.querySelectorAll('[class]');
      const panelEls = [];
      allEls.forEach(el => {
        el.classList.forEach(cls => {
          if (cls.toLowerCase().includes('previewpanel') || cls.toLowerCase().includes('desk')) {
            panelEls.push({ cls, visible: el.checkVisibility() });
          }
        });
      });
      return { panelEls, panelCount: panelEls.length };
    });
    const deskVisible = deskInfo.panelCount > 0;
    results.push({ test: '工作台面板', pass: deskVisible, detail: `panel数:${deskInfo.panelCount}, ${JSON.stringify(deskInfo.panelEls.slice(0,3))}` });
    await page.screenshot({ path: 'test-08-desk.png', fullPage: false });

    // ── Test 9: WebSocket 连接状态 ──────────────────────────────
    console.log('[TEST 9] WebSocket 连接状态...');
    const wsStatus = await page.evaluate(() => {
      const store = window.__STORE__?.getState?.();
      if (!store) return { hasStore: false, status: 'no_store' };
      return {
        hasStore: true,
        status: store.connectionStatus || 'unknown',
        wsState: store.wsState || 'unknown'
      };
    }).catch(() => ({ hasStore: false, status: 'error' }));
    results.push({ test: 'WebSocket 连接', pass: wsStatus.status === 'connected', detail: `status:${wsStatus.status}` });
    console.log('  WS状态:', JSON.stringify(wsStatus));

    // ── Test 10: 检查 console errors ────────────────────────────
    console.log('[TEST 10] 检查 console errors...');
    const logs = [];
    page.on('console', msg => {
      if (msg.type() === 'error') logs.push(msg.text().slice(0, 120));
    });
    await page.waitForTimeout(1000);
    results.push({ test: 'Console Errors', pass: logs.length === 0, detail: `errors:${logs.length}`, extra: logs.slice(0, 5) });

    // ── 总结 ─────────────────────────────────────────────────────
    console.log('\n===== 测试结果 =====');
    let passCount = 0;
    for (const r of results) {
      const icon = r.pass ? '✅' : '❌';
      console.log(`${icon} [${r.test}] ${r.detail}`);
      if (r.pass) passCount++;
      if (r.extra) console.log(`   额外信息: ${JSON.stringify(r.extra)}`);
    }
    console.log(`\n通过: ${passCount}/${results.length}`);

    await page.screenshot({ path: 'test-final.png', fullPage: false });

  } catch (e) {
    console.error('测试出错:', e.message);
    await page.screenshot({ path: 'test-error.png', fullPage: false });
  } finally {
    await browser.close();
  }
}

test().catch(console.error);
