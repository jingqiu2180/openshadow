// test-stable.mjs — 稳定版功能测试
import { chromium } from 'playwright';

const BASE = 'http://localhost:5173';

async function main() {
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const results = [];

  // ── 启动监听 ────────────────────────────────────────
  const consoleErrors = [];
  const consoleWarnings = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 150));
    if (msg.type() === 'warning') consoleWarnings.push(msg.text().slice(0, 150));
  });

  const httpErrors = [];
  page.on('response', res => {
    if (res.status() >= 400) {
      httpErrors.push({ url: res.url(), status: res.status() });
    }
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

  // ── Test 2: Console warnings (i18n) ───────────────
  const i18nWarnings = consoleWarnings.filter(w => w.includes('[i18n]'));
  results.push({
    test: 'i18n 警告',
    pass: i18nWarnings.length === 0,
    detail: `i18n警告数:${i18nWarnings.length}`
  });

  // ── Test 3: HTTP 错误 ──────────────────────────────
  results.push({
    test: 'HTTP 错误',
    pass: httpErrors.length === 0,
    detail: `错误数:${httpErrors.length}${httpErrors.length > 0 ? ' | ' + JSON.stringify(httpErrors[0]) : ''}`
  });

  // ── Test 4: WebSocket 连接 ─────────────────────────
  const wsStatus = await page.evaluate(() => {
    return window.useStore?.getState?.()?.connectionStatus || 'unknown';
  }).catch(() => 'error');
  results.push({
    test: 'WebSocket 连接',
    pass: wsStatus === 'connected',
    detail: `status:${wsStatus}`
  });

  // ── Test 5: 设置模态框打开 ───────────────────────
  console.log('[测试] 打开设置...');
  await page.locator('button[title="设置"]').click();
  await page.waitForTimeout(1200);
  const settingsOpen = await page.evaluate(() => {
    return !!document.querySelector('[role="dialog"]');
  });
  results.push({
    test: '设置模态框打开',
    pass: settingsOpen,
    detail: `打开:${settingsOpen}`
  });

  // ── Test 6: 设置 tabs 渲染 ──────────────────────
  if (settingsOpen) {
    const tabCount = await page.locator('[role="dialog"] [role="tab"]').count();
    results.push({
      test: '设置 tabs 渲染',
      pass: tabCount > 0,
      detail: `tab数:${tabCount}`
    });
    // 关闭设置
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  } else {
    results.push({ test: '设置 tabs 渲染', pass: false, detail: '设置未打开' });
  }

  // ── Test 7: 侧边栏会话列表 ─────────────────────
  const sidebarInfo = await page.evaluate(() => {
    const sidebar = document.querySelector('[class*="sidebar"], [class*="Sidebar"]');
    if (!sidebar) return { hasSidebar: false };
    const items = sidebar.querySelectorAll('[class*="session"], [class*="Session"]');
    return {
      hasSidebar: true,
      itemCount: items.length,
      sidebarVisible: getComputedStyle(sidebar).display !== 'none',
    };
  }).catch(() => ({ error: true }));
  results.push({
    test: '侧边栏会话列表',
    pass: sidebarInfo.hasSidebar !== false,
    detail: JSON.stringify(sidebarInfo)
  });

  // ── Test 8: 输入区可用 ───────────────────────────
  const inputInfo = await page.evaluate(() => {
    const textareas = document.querySelectorAll('textarea');
    const inputs = document.querySelectorAll('input[type="text"]');
    const all = [...textareas, ...inputs];
    for (const el of all) {
      if (getComputedStyle(el).display !== 'none' && !el.disabled) {
        return { found: true, tag: el.tagName, enabled: !el.disabled };
      }
    }
    return { found: false };
  });
  results.push({
    test: '输入区可用',
    pass: inputInfo.found === true,
    detail: JSON.stringify(inputInfo)
  });

  // ── Test 9: 发送消息（不等待 AI 回复）────────────
  if (inputInfo.found) {
    console.log('[测试] 发送消息...');
    await page.locator('textarea, input[type="text"]').first().click();
    await page.waitForTimeout(300);
    await page.keyboard.type('你好', { delay: 30 });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);
    const msgCount = await page.locator('[data-message-id]').count();
    results.push({
      test: '发送消息',
      pass: msgCount >= 1,
      detail: `DOM消息数:${msgCount}`
    });
  } else {
    results.push({ test: '发送消息', pass: false, detail: '输入框未找到' });
  }

  // ── Test 10: 工作台面板 ──────────────────────────
  const deskInfo = await page.evaluate(() => {
    const section = document.querySelector('[class*="Desk"], [class*="desk"]');
    if (!section) return { hasDesk: false };
    const visible = getComputedStyle(section).visibility !== 'hidden' && getComputedStyle(section).display !== 'none';
    return { hasDesk: true, visible, class: section.className.slice(0, 60) };
  }).catch(() => ({ error: true }));
  results.push({
    test: '工作台面板',
    pass: deskInfo.hasDesk !== false,
    detail: JSON.stringify(deskInfo)
  });

  // ── 结果汇总 ────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════');
  const passed = results.filter(r => r.pass).length;
  console.log(`  稳定测试结果: ${passed}/${results.length} 通过`);
  console.log('═══════════════════════════════════════════\n');
  for (const r of results) {
    console.log(`${r.pass ? '✅' : '❌'} [${r.test}] ${r.detail}`);
  }

  await browser.close();
}

main().catch(console.error);
