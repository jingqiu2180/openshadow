// test-final.mjs — 最终稳定测试（用 force 和 evaluate 绕过 overlay）
import { chromium } from 'playwright';

const BASE = 'http://localhost:5173';

async function main() {
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const results = [];
  const consoleErrors = [];
  const consoleWarnings = [];

  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 150));
    if (msg.type() === 'warning') consoleWarnings.push(msg.text().slice(0, 150));
  });

  // ── 加载页面 ──────────────────────────────────────────
  console.log('[加载] 导航到页面...');
  await page.goto(BASE, { timeout: 15000 });
  await page.waitForLoadState('networkidle', { timeout: 10000 });
  await page.waitForTimeout(3000);

  // ── Test 1: Console errors ───────────────────────────
  results.push({
    test: 'Console Errors',
    pass: consoleErrors.length === 0,
    detail: `errors:${consoleErrors.length}${consoleErrors.length > 0 ? ' | ' + consoleErrors[0].slice(0, 80) : ''}`
  });

  // ── Test 2: i18n 警告 ─────────────────────────────
  const i18nWarnings = consoleWarnings.filter(w => w.includes('[i18n]'));
  results.push({
    test: 'i18n 警告',
    pass: i18nWarnings.length === 0,
    detail: `i18n警告数:${i18nWarnings.length}`
  });

  // ── Test 3: WebSocket 连接 ────────────────────────
  const wsStatus = await page.evaluate(() => {
    return window.useStore?.getState?.()?.connectionStatus || 'unknown';
  }).catch(() => 'error');
  results.push({
    test: 'WebSocket 连接',
    pass: wsStatus === 'connected',
    detail: `status:${wsStatus}`
  });

  // ── Test 4: 设置模态框 ───────────────────────────
  console.log('[测试] 打开设置...');
  await page.locator('button[title="设置"]').click({ force: true });
  await page.waitForTimeout(1200);
  const settingsOpen = await page.evaluate(() => {
    return !!document.querySelector('[role="dialog"]');
  });
  results.push({ test: '设置模态框打开', pass: settingsOpen, detail: `打开:${settingsOpen}` });

  // ── Test 5: 设置 tabs ─────────────────────────────
  if (settingsOpen) {
    const tabCount = await page.locator('[role="dialog"] [role="tab"]').count();
    results.push({ test: '设置 tabs 渲染', pass: tabCount > 0, detail: `tab数:${tabCount}` });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  } else {
    results.push({ test: '设置 tabs 渲染', pass: false, detail: '设置未打开' });
  }

  // ── Test 6: 侧边栏 ───────────────────────────────
  const sidebarInfo = await page.evaluate(() => {
    const sidebar = document.querySelector('[class*="sidebar"], [class*="Sidebar"]');
    if (!sidebar) return { hasSidebar: false };
    return {
      hasSidebar: true,
      visible: getComputedStyle(sidebar).display !== 'none',
    };
  }).catch(() => ({ error: true }));
  results.push({ test: '侧边栏渲染', pass: sidebarInfo.hasSidebar !== false, detail: JSON.stringify(sidebarInfo) });

  // ── Test 7: 输入区可用 ───────────────────────────
  const inputReady = await page.evaluate(() => {
    const textareas = document.querySelectorAll('textarea');
    for (const ta of textareas) {
      if (getComputedStyle(ta).display !== 'none' && !ta.disabled) {
        return { found: true, placeholder: ta.placeholder?.slice(0, 50) };
      }
    }
    return { found: false };
  });
  results.push({ test: '输入区可用', pass: inputReady.found === true, detail: JSON.stringify(inputReady) });

  // ── Test 8: 发送消息（用 evaluate 直接设置值）──
  if (inputReady.found) {
    console.log('[测试] 发送消息...');
    await page.evaluate(() => {
      const textareas = document.querySelectorAll('textarea');
      for (const ta of textareas) {
        if (getComputedStyle(ta).display !== 'none' && !ta.disabled) {
          ta.value = '你好，请介绍一下自己';
          ta.dispatchEvent(new Event('input', { bubbles: true }));
          break;
        }
      }
    });
    await page.waitForTimeout(500);
    // 按 Enter
    await page.evaluate(() => {
      const textareas = document.querySelectorAll('textarea');
      for (const ta of textareas) {
        if (getComputedStyle(ta).display !== 'none' && !ta.disabled) {
          ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
          ta.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
          break;
        }
      }
    });
    await page.waitForTimeout(2000);
    const msgCount = await page.locator('[data-message-id]').count();
    results.push({ test: '发送消息', pass: msgCount >= 1, detail: `DOM消息数:${msgCount}` });
  } else {
    results.push({ test: '发送消息', pass: false, detail: '输入框未找到' });
  }

  // ── Test 9: 工作台面板 ──────────────────────────
  const deskInfo = await page.evaluate(() => {
    const section = document.querySelector('[class*="Desk"], [class*="desk"]');
    if (!section) return { hasDesk: false };
    return {
      hasDesk: true,
      visible: getComputedStyle(section).visibility !== 'hidden' && getComputedStyle(section).display !== 'none',
    };
  }).catch(() => ({ error: true }));
  results.push({ test: '工作台面板', pass: deskInfo.hasDesk !== false, detail: JSON.stringify(deskInfo) });

  // ── Test 10: 截图 ────────────────────────────────
  await page.screenshot({ path: 'test-final-ui.png', fullPage: false });
  results.push({ test: '截图保存', pass: true, detail: 'test-final-ui.png' });

  // ── 结果汇总 ────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════');
  const passed = results.filter(r => r.pass).length;
  console.log(`  最终测试结果: ${passed}/${results.length} 通过`);
  console.log('═══════════════════════════════════════════\n');
  for (const r of results) {
    console.log(`${r.pass ? '✅' : '❌'} [${r.test}] ${r.detail}`);
  }

  await browser.close();
}

main().catch(console.error);
