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

    // ── Test 2: 会话列表加载 ─────────────────────────────────
    console.log('[TEST 2] 会话列表加载...');
    await page.waitForTimeout(5000);
    const sessionCount = await page.locator('[class*="sessionItem"]').count();
    const hasSessions = sessionCount > 0;
    results.push({ test: '会话列表加载', pass: hasSessions, detail: `session数:${sessionCount}` });
    await page.screenshot({ path: 'test-02-sessions.png', fullPage: false });

    // ── Test 3: 点击会话进入聊天 ──────────────────────────────
    console.log('[TEST 3] 点击会话进入聊天...');
    let chatReady = false;
    if (hasSessions) {
      await page.locator('[class*="sessionItem"]').first().click();
      await page.waitForTimeout(3000);
      const welcomeVisible = await page.$('#welcome').then(el => el?.isVisible().catch(() => false)) || false;
      chatReady = !welcomeVisible;
      console.log(`  欢迎屏幕可见: ${welcomeVisible}, chatReady: ${chatReady}`);
    }
    results.push({ test: '点击会话进入聊天', pass: chatReady || !hasSessions, detail: `chatReady:${chatReady}` });
    await page.screenshot({ path: 'test-03-chat-ready.png', fullPage: false });

    // ── Test 4: 输入区焦点 ──────────────────────────────────────
    console.log('[TEST 4] 输入区焦点...');
    const inputArea = await page.$('textarea, [contenteditable], input[type="text"]');
    let inputPass = false;
    if (inputArea) {
      await inputArea.click();
      await page.waitForTimeout(500);
      const focused = await page.evaluate(() => document.activeElement?.tagName);
      inputPass = focused === 'TEXTAREA' || focused === 'INPUT' || focused === 'DIV';
      results.push({ test: '输入区焦点', pass: inputPass, detail: `focused:${focused}` });
    } else {
      results.push({ test: '输入区焦点', pass: false, detail: '未找到输入区' });
    }

    // ── Test 5: 发送消息 ─────────────────────────────────────────
    console.log('[TEST 5] 发送消息...');
    let msgCountBefore = 0;
    if (chatReady && inputPass) {
      // 获取发送前的消息数
      const before = await page.evaluate(() => {
        const store = window.__STORE__?.getState?.();
        if (!store || !store.currentSessionPath) return { msgCount: 0 };
        const items = store.chatSessions?.[store.currentSessionPath]?.items || [];
        return { msgCount: items.length, currentPath: store.currentSessionPath };
      }).catch(() => ({ msgCount: 0 }));
      msgCountBefore = before.msgCount || 0;
      console.log(`  发送前消息数: ${msgCountBefore}`);

      // 输入并发送
      await page.keyboard.press('Control+A');
      await page.keyboard.press('Delete');
      await page.keyboard.type('你好，这是一条测试消息');
      await page.waitForTimeout(500);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(8000);

      // 获取发送后的消息数
      const after = await page.evaluate(() => {
        const store = window.__STORE__?.getState?.();
        if (!store || !store.currentSessionPath) return { msgCount: 0 };
        const items = store.chatSessions?.[store.currentSessionPath]?.items || [];
        return { msgCount: items.length, types: items.map(i => i.type) };
      }).catch(() => ({ msgCount: 0 }));
      const msgCountAfter = after.msgCount || 0;
      console.log(`  发送后消息数: ${msgCountAfter}, types: ${JSON.stringify(after.types)}`);

      results.push({
        test: '发送消息',
        pass: msgCountAfter > msgCountBefore,
        detail: `前:${msgCountBefore}, 后:${msgCountAfter}`
      });
    } else {
      results.push({ test: '发送消息', pass: false, detail: `chatReady:${chatReady}, inputPass:${inputPass}` });
    }
    await page.screenshot({ path: 'test-05-after-send.png', fullPage: false });

    // ── Test 6: 设置模态框 ──────────────────────────────────────
    console.log('[TEST 6] 设置按钮...');
    const settingsBtn = await page.$('button[class*="settings"], button:has-text("设置"), button:has-text("Settings")');
    let settingsPass = false;
    if (settingsBtn) {
      await settingsBtn.click();
      await page.waitForTimeout(1000);
      const modal = await page.$('[role="dialog"], [class*="modal"]');
      const modalVisible = modal ? await modal.isVisible().catch(() => false) : false;
      results.push({ test: '设置模态框', pass: modalVisible, detail: `modal可见:${modalVisible}` });
      settingsPass = true;
      if (modalVisible) {
        await page.screenshot({ path: 'test-06-settings.png', fullPage: false });
        const closeBtn = await page.$('[role="dialog"] button:last-child, [class*="modal"] button[class*="close"]');
        if (closeBtn) await closeBtn.click();
        await page.waitForTimeout(500);
      }
    } else {
      results.push({ test: '设置按钮', pass: false, detail: '未找到设置按钮' });
    }

    // ── Test 7: 工作台面板 ──────────────────────────────────────
    console.log('[TEST 7] 工作台面板...');
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
    results.push({ test: '工作台面板', pass: deskVisible, detail: `panel数:${deskInfo.panelCount}` });
    await page.screenshot({ path: 'test-07-desk.png', fullPage: false });

    // ── Test 8: WebSocket 连接状态 ──────────────────────────────
    console.log('[TEST 8] WebSocket 连接状态...');
    const wsStatus = await page.evaluate(() => {
      const store = window.__STORE__?.getState?.();
      if (!store) return { hasStore: false };
      return {
        hasStore: true,
        wsState: store.wsState || 'unknown',
        connected: store.connected
      };
    }).catch(() => ({ hasStore: false }));
    const wsPass = wsStatus.wsState === 'connected' || wsStatus.connected === true;
    results.push({ test: 'WebSocket 连接', pass: wsPass, detail: `wsState:${wsStatus.wsState}, connected:${wsStatus.connected}` });
    console.log('  WS状态:', JSON.stringify(wsStatus));

    // ── Test 9: Console Errors ───────────────────────────────────
    console.log('[TEST 9] 检查 console errors...');
    const logs = [];
    page.on('console', msg => {
      if (msg.type() === 'error') logs.push(msg.text().slice(0, 120));
    });
    await page.waitForTimeout(1000);
    results.push({ test: 'Console Errors', pass: logs.length === 0, detail: `errors:${logs.length}`, extra: logs.slice(0, 5) });

    // ── Test 10: 侧边栏切换 ──────────────────────────────────
    console.log('[TEST 10] 侧边栏切换...');
    const sidebarToggle = await page.$('button[class*="sidebar"], button[class*="toggle"], [class*="sidebar-toggle"]');
    let sidebarPass = false;
    if (sidebarToggle) {
      await sidebarToggle.click();
      await page.waitForTimeout(1000);
      sidebarPass = true;
    }
    results.push({ test: '侧边栏切换', pass: sidebarPass, detail: `sidebarToggle:${sidebarPass}` });

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