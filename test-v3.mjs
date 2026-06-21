// test-v3.mjs — 用 evaluate 直接操作 DOM
import { chromium } from 'playwright';

const BASE = 'http://localhost:5173';

async function main() {
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const results = [];

  // 监听错误
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text().slice(0, 120));
  });

  await page.goto(BASE, { timeout: 15000 });
  await page.waitForLoadState('networkidle', { timeout: 10000 });
  await page.waitForTimeout(3000);

  // ── Test 1: 无 Console Errors ───────────────────────
  results.push({
    test: 'Console Errors',
    pass: errors.length === 0,
    detail: `errors:${errors.length}`
  });

  // ── Test 2: i18n 翻译正确 ─────────────────────
  const translationOk = await page.evaluate(() => {
    const t = window.i18n?.t;
    if (typeof t !== 'function') return false;
    // 调用 t 函数
    try {
      const r = t('sidebar.toggle');
      return typeof r === 'string' && r !== 'sidebar.toggle';
    } catch(e) { return false; }
  });
  results.push({
    test: 'i18n 翻译',
    pass: translationOk,
    detail: `翻译正确:${translationOk}`
  });

  // ── Test 3: WebSocket 连接 ─────────────────────
  const wsOk = await page.evaluate(() => {
    const s = window.useStore?.getState?.();
    return s?.connected === true;
  });
  results.push({ test: 'WebSocket 连接', pass: wsOk, detail: `connected:${wsOk}` });

  // ── Test 4: 打开设置（用 evaluate 点击）─────────────
  await page.evaluate(() => {
    const btn = document.querySelector('button[title="设置"]');
    if (btn) btn.click();
  });
  await page.waitForTimeout(1000);
  const settingsOpen = await page.evaluate(() => !!document.querySelector('[role="dialog"]'));
  results.push({ test: '设置打开', pass: settingsOpen, detail: `打开:${settingsOpen}` });

  // ── Test 5: 设置 tabs ─────────────────────────
  if (settingsOpen) {
    const tabCount = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      return dialog ? dialog.querySelectorAll('[role="tab"]').length : 0;
    });
    results.push({ test: '设置 tabs', pass: tabCount > 0, detail: `tab数:${tabCount}` });
    // 关闭
    await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      if (dialog) {
        const closeBtn = dialog.querySelector('button[aria-label*="关闭"], button[title*="关闭"]');
        if (closeBtn) closeBtn.click();
      }
    });
    await page.waitForTimeout(500);
  } else {
    results.push({ test: '设置 tabs', pass: false, detail: '设置未打开' });
  }

  // ── Test 6: 侧边栏 ───────────────────────────
  const sidebarOk = await page.evaluate(() => {
    const el = document.querySelector('[class*="sidebar"], [class*="Sidebar"]');
    return el ? getComputedStyle(el).display !== 'none' : false;
  });
  results.push({ test: '侧边栏', pass: sidebarOk, detail: `渲染:${sidebarOk}` });

  // ── Test 7: 输入区可用 ───────────────────────
  const inputOk = await page.evaluate(() => {
    const ta = document.querySelector('textarea');
    return ta ? getComputedStyle(ta).display !== 'none' && !ta.disabled : false;
  });
  results.push({ test: '输入区', pass: inputOk, detail: `可用:${inputOk}` });

  // ── Test 8: 发送消息（用 evaluate）────────────────
  if (inputOk) {
    await page.evaluate(() => {
      const ta = document.querySelector('textarea');
      if (ta) {
        ta.value = '你好';
        ta.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    await page.waitForTimeout(500);
    // 找发送按钮并点击
    await page.evaluate(() => {
      const btns = document.querySelectorAll('button');
      for (const btn of btns) {
        if (btn.title?.includes('发送') || btn.textContent?.includes('发送')) {
          btn.click();
          break;
        }
      }
    });
    await page.waitForTimeout(3000);
    const msgCount = await page.locator('[data-message-id]').count();
    results.push({ test: '发送消息', pass: msgCount >= 1, detail: `消息数:${msgCount}` });
  } else {
    results.push({ test: '发送消息', pass: false, detail: '输入框不可用' });
  }

  // ── Test 9: 工作台面板 ───────────────────────
  const deskOk = await page.evaluate(() => {
    // 找 RightWorkspacePanel
    const el = document.querySelector('[class*="workspace"], [class*="Workspace"], [class*="desk"], [class*="Desk"]');
    if (!el) return false;
    const s = getComputedStyle(el);
    return s.display !== 'none' && s.visibility !== 'hidden';
  });
  results.push({ test: '工作台面板', pass: deskOk, detail: `可见:${deskOk}` });

  // ── Test 10: 截图 ───────────────────────────
  await page.screenshot({ path: 'test-v3-ui.png', fullPage: false });
  results.push({ test: '截图', pass: true, detail: 'test-v3-ui.png' });

  // ── 结果汇总 ──────────────────────────────────
  console.log('\n═══════════════════════════════════════');
  const passed = results.filter(r => r.pass).length;
  console.log(`  测试结果: ${passed}/${results.length} 通过`);
  console.log('═══════════════════════════════════════\n');
  for (const r of results) {
    console.log(`${r.pass ? '✅' : '❌'} [${r.test}] ${r.detail}`);
  }

  await browser.close();
}

main().catch(console.error);
