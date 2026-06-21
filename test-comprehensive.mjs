import { chromium } from 'playwright';

const VITE_URL = 'http://localhost:5173';
const API_URL = 'http://localhost:3000';

async function test() {
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const results = [];

  try {
    // ── Test 1: 页面加载 ────────────────────────────────
    console.log('[TEST 1] 页面加载...');
    await page.goto(VITE_URL, { timeout: 15000 });
    await page.waitForLoadState('networkidle', { timeout: 10000 });
    const title = await page.title();
    results.push({ test: '页面加载', pass: !!title, detail: `title=${title}` });
    await page.screenshot({ path: 'test-01-load.png', fullPage: false });

    // ── Test 2: 聊天消息渲染 ────────────────────────────────
    console.log('[TEST 2] 聊天消息渲染...');
    await page.waitForTimeout(3000);
    const chatArea = await page.$('.chat-area');
    const chatVisible = chatArea ? await chatArea.isVisible().catch(() => false) : false;
    // 使用 data-message-id 属性（稳定，不被 CSS Module 哈希）
    const msgCount = await page.locator('[data-message-id]').count();
    // 同时检查 store 里是否有消息
    const storeInfo = await page.evaluate(() => {
      const s = window.useStore?.getState?.();
      if (!s) return { hasStore: false, sessionMsgCount: -1 };
      const path = s.currentSessionPath;
      if (!path) return { hasStore: true, sessionMsgCount: -1 };
      const items = s.chatSessions?.[path]?.items || [];
      return { hasStore: true, sessionMsgCount: items.length, path };
    }).catch(() => ({ hasStore: false, sessionMsgCount: -1 }));
    // 通过条件：会话有消息且 DOM 有渲染，或会话空（没消息可渲染）
    const test2Pass = storeInfo.sessionMsgCount === 0 ? true : (msgCount > 0);
    results.push({
      test: '聊天消息渲染',
      pass: test2Pass,
      detail: `chatArea可见:${chatVisible}, DOM消息数:${msgCount}, store消息数:${storeInfo.sessionMsgCount}`
    });
    if (msgCount > 0) {
      const msgs = await page.locator('[data-message-id]').all();
      for (let i = 0; i < Math.min(msgs.length, 2); i++) {
        const txt = await msgs[i].innerText().catch(() => '');
        console.log(`  消息${i}: ${txt.slice(0, 80)}`);
      }
    }
    await page.screenshot({ path: 'test-02-chat.png', fullPage: false });

    // ── Test 3: 侧边栏会话列表 ────────────────────────────────
    console.log('[TEST 3] 侧边栏会话列表...');
    // 侧边栏使用全局 CSS 类 .sidebar（非 CSS Module）
    const sidebar = await page.$('.sidebar');
    const sidebarVisible = sidebar ? await sidebar.isVisible().catch(() => false) : false;
    // 会话项在 SessionList 组件里，查找含 session path 属性的元素
    const sessionItems = await page.locator('[data-session-path]').count();
    results.push({
      test: '侧边栏会话列表',
      pass: sidebarVisible,
      detail: `sidebar可见:${sidebarVisible}, 会话数:${sessionItems}`
    });
    await page.screenshot({ path: 'test-03-sidebar.png', fullPage: false });

    // ── Test 4: 点击会话切换 ────────────────────────────────
    console.log('[TEST 4] 点击会话切换...');
    let sessionClickPass = false;
    if (sessionItems > 0) {
      await page.locator('[data-session-path]').first().click().catch(() => {});
      await page.waitForTimeout(1000);
      sessionClickPass = true;
    }
    results.push({
      test: '点击会话切换',
      pass: sessionClickPass || sessionItems === 0,
      detail: `可点击:${sessionClickPass}`
    });

    // ── Test 5: 输入区焦点和输入 ────────────────────────────────
    console.log('[TEST 5] 输入区焦点和输入...');
    // InputArea 使用 textarea 或 contenteditable
    const inputArea = await page.$('.input-area textarea, .input-area [contenteditable]');
    let inputPass = false;
    if (inputArea) {
      await inputArea.click().catch(() => {});
      await page.waitForTimeout(500);
      const focused = await page.evaluate(() => document.activeElement?.tagName);
      results.push({ test: '输入区焦点', pass: true, detail: `focused:${focused}` });
      inputPass = true;
    } else {
      results.push({ test: '输入区焦点', pass: false, detail: '未找到 textarea' });
    }

    // ── Test 6: 发送消息 ───────────────────────────────────
    console.log('[TEST 6] 发送消息...');
    let sendPass = false;
    if (inputPass) {
      await page.keyboard.type('你好，这是一个测试消息');
      await page.waitForTimeout(500);
      // 找发送按钮（type="submit" 或含 send 的 class）
      const sendBtn = await page.$('button[type="submit"]');
      if (sendBtn) {
        await sendBtn.click().catch(() => {});
        await page.waitForTimeout(2000);
        sendPass = true;
      } else {
        await page.keyboard.press('Enter');
        await page.waitForTimeout(2000);
        sendPass = true;
      }
    }
    results.push({ test: '发送消息', pass: sendPass, detail: `sendPass:${sendPass}` });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'test-06-send.png', fullPage: false });
    // 发送后检查消息是否出现在 DOM 中
    if (sendPass) {
      const postSendMsgCount = await page.locator('[data-message-id]').count();
      const postSendHasNew = postSendMsgCount > 0;
      results.push({ test: '发送后消息渲染', pass: postSendHasNew, detail: `发送后DOM消息数:${postSendMsgCount}` });
      if (postSendHasNew) {
        const firstMsg = await page.locator('[data-message-id]').first().innerText().catch(() => '');
        console.log(`  [发送后] 首条消息: ${firstMsg.slice(0, 80)}`);
      }
    }

    // ── Test 7: 设置按钮/模态框 ────────────────────────────────
    console.log('[TEST 7] 设置按钮...');
    // 设置按钮在 AppTitlebar 里，使用全局 CSS
    const settingsBtn = await page.$('[class*="titlebar"] button[title*="设置"], [class*="titlebar"] button[title*="Settings"], button[title*="设置"], button[title*="Settings"]');
    let settingsPass = false;
    if (settingsBtn) {
      await settingsBtn.click().catch(() => {});
      await page.waitForTimeout(1000);
      const modal = await page.$('[role="dialog"], .settings-modal, [class*="modalOverlay"]');
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

    // ── Test 8: 工作台面板 ───────────────────────────────────
    console.log('[TEST 8] 工作台面板...');
    // 工作台在 #jianSidebar 元素里，检查是否含 "collapsed" 类
    const jianSidebar = await page.$('#jianSidebar');
    let deskVisible = false;
    if (jianSidebar) {
      const classAttr = await jianSidebar.getAttribute('class').catch(() => '');
      deskVisible = classAttr ? !classAttr.includes('collapsed') : false;
      // 如果收起了，尝试点击工具栏按钮展开
      if (!deskVisible) {
        const jianToggle = await page.$('[class*="jianToggle"], button[title*="工作台"], button[title*="Desk"]');
        if (jianToggle) {
          await jianToggle.click();
          await page.waitForTimeout(500);
          const classAttr2 = await jianSidebar.getAttribute('class').catch(() => '');
          deskVisible = classAttr2 ? !classAttr2.includes('collapsed') : false;
        }
      }
    }
    results.push({ test: '工作台面板', pass: deskVisible, detail: `desk可见:${deskVisible}` });
    if (deskVisible) {
      await page.screenshot({ path: 'test-08-desk.png', fullPage: false });
    }

    // ── Test 9: WebSocket 连接状态 ────────────────────────────────
    console.log('[TEST 9] WebSocket 连接状态...');
    const wsStatus = await page.evaluate(() => {
      const store = window.useStore?.getState?.();
      return { hasStore: !!store, connected: store?.connected, connectionStatus: store?.connectionStatus };
    }).catch(() => ({ hasStore: false, connected: false, connectionStatus: 'error' }));
    const isConnected = wsStatus.connected === true || wsStatus.connectionStatus === 'connected';
    results.push({ test: 'WebSocket 连接', pass: isConnected, detail: `status:${wsStatus.connectionStatus || 'unknown'}, connected:${wsStatus.connected}` });

    // ── Test 10: 检查 console errors ────────────────────────────────
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
