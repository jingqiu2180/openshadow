// test-v2.mjs — 修正版测试（正确属性名 + 稳定选择器）
import { chromium } from 'playwright';

const BASE = 'http://localhost:5173';

async function main() {
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const results = [];
  const consoleErrors = [];
  const i18nWarnings = [];

  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 150));
    if (msg.type() === 'warning' && msg.text().includes('[i18n]')) {
      i18nWarnings.push(msg.text().slice(0, 150));
    }
  });

  await page.goto(BASE, { timeout: 15000 });
  await page.waitForLoadState('networkidle', { timeout: 10000 });
  await page.waitForTimeout(3000);

  // ── Test 1: Console errors ───────────────────────────
  results.push({
    test: 'Console Errors',
    pass: consoleErrors.length === 0,
    detail: `errors:${consoleErrors.length}`
  });

  // ── Test 2: i18n 翻译 ───────────────────────────
  // 验证 t() 返回值（之前已验证翻译正确）
  const translationOk = await page.evaluate(() => {
    const t = window.i18n?.t;
    if (!t) return false;
    const result = t('sidebar.toggle');
    return typeof result === 'string' && result !== 'sidebar.toggle';
  });
  results.push({
    test: 'i18n 翻译',
    pass: translationOk,
    detail: `t('sidebar.toggle')=${await page.evaluate(() => window.i18n?.t?.('sidebar.toggle'))}`
  });

  // ── Test 3: WebSocket 连接 ──────────────────────
  const wsOk = await page.evaluate(() => {
    const s = window.useStore?.getState?.();
    return s?.connected === true || s?.wsState === 'connected';
  });
  results.push({
    test: 'WebSocket 连接',
    pass: wsOk,
    detail: `connected:${wsOk}`
  });

  // ── Test 4: 设置模态框 ─────────────────────────
  await page.locator('button[title="设置"]').click({ force: true });
  await page.waitForTimeout(1200);
  const settingsOpen = await page.evaluate(() => {
    return !!document.querySelector('[role="dialog"]');
  });
  results.push({
    test: '设置模态框打开',
    pass: settingsOpen,
    detail: `打开:${settingsOpen}`
  });

  // ── Test 5: 设置 tabs ───────────────────────────
  if (settingsOpen) {
    // 检查 dialog 内所有含 tab 的 selector
    const tabInfo = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      if (!dialog) return { hasDialog: false };
      // 尝试多种选择器
      const selectors = [
        '[role="tab"]',
        '[class*="tab"]',
        'button[role="tab"]',
      ];
      for (const sel of selectors) {
        const els = dialog.querySelectorAll(sel);
        if (els.length > 0) {
          return {
            hasDialog: true,
            selector: sel,
            count: els.length,
            texts: Array.from(els).slice(0, 5).map(el => el.textContent?.trim())
          };
        }
      }
      return { hasDialog: true, count: 0 };
    });
    results.push({
      test: '设置 tabs 渲染',
      pass: tabInfo.count > 0,
      detail: JSON.stringify(tabInfo)
    });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  } else {
    results.push({ test: '设置 tabs 渲染', pass: false, detail: '设置未打开' });
  }

  // ── Test 6: 侧边栏 ─────────────────────────────
  const sidebarOk = await page.evaluate(() => {
    const els = document.querySelectorAll('[class*="sidebar"], [class*="Sidebar"]');
    for (const el of els) {
      if (getComputedStyle(el).display !== 'none') {
        return { found: true, class: el.className.slice(0, 50) };
      }
    }
    return { found: false };
  });
  results.push({
    test: '侧边栏渲染',
    pass: sidebarOk.found,
    detail: JSON.stringify(sidebarOk)
  });

  // ── Test 7: 输入区 ──────────────────────────────
  const inputOk = await page.evaluate(() => {
    const textareas = document.querySelectorAll('textarea');
    for (const ta of textareas) {
      if (getComputedStyle(ta).display !== 'none' && !ta.disabled) {
        return { found: true, placeholder: ta.placeholder?.slice(0, 50) };
      }
    }
    return { found: false };
  });
  results.push({
    test: '输入区可用',
    pass: inputOk.found,
    detail: JSON.stringify(inputOk)
  });

  // ── Test 8: 发送消息 ─────────────────────────────
  if (inputOk.found) {
    await page.evaluate(() => {
      const textareas = document.querySelectorAll('textarea');
      for (const ta of textareas) {
        if (getComputedStyle(ta).display !== 'none' && !ta.disabled) {
          ta.value = '你好';
          ta.dispatchEvent(new Event('input', { bubbles: true }));
          break;
        }
      }
    });
    await page.waitForTimeout(500);
    // 按 Enter（用 evaluate 触发）
    await page.evaluate(() => {
      const textareas = document.querySelectorAll('textarea');
      for (const ta of textareas) {
        if (getComputedStyle(ta).display !== 'none' && !ta.disabled) {
          ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
          break;
        }
      }
    });
    await page.waitForTimeout(3000);
    const msgCount = await page.locator('[data-message-id]').count();
    results.push({
      test: '发送消息',
      pass: msgCount >= 1,
      detail: `DOM消息数:${msgCount}`
    });
  } else {
    results.push({ test: '发送消息', pass: false, detail: '输入框未找到' });
  }

  // ── Test 9: 工作台面板 ──────────────────────────
  const deskOk = await page.evaluate(() => {
    // 检查 RightWorkspacePanel 是否存在
    const panels = document.querySelectorAll('[class*="workspace"], [class*="Workspace"], [class*="desk"], [class*="Desk"]');
    const result = { found: false, count: panels.length };
    for (const p of panels) {
      const visible = getComputedStyle(p).display !== 'none' && getComputedStyle(p).visibility !== 'hidden';
      if (visible) {
        result.found = true;
        result.class = p.className.slice(0, 60);
        break;
      }
    }
    return result;
  });
  results.push({
    test: '工作台面板',
    pass: deskOk.found,
    detail: JSON.stringify(deskOk)
  });

  // ── Test 10: 截图 ─────────────────────────────
  await page.screenshot({ path: 'test-v2-ui.png', fullPage: false });
  results.push({ test: '截图保存', pass: true, detail: 'test-v2-ui.png' });

  // ── 结果汇总 ──────────────────────────────────
  console.log('\n═══════════════════════════════════════');
  const passed = results.filter(r => r.pass).length;
  console.log(`  最终测试结果: ${passed}/${results.length} 通过`);
  console.log('═══════════════════════════════════════\n');
  for (const r of results) {
    console.log(`${r.pass ? '✅' : '❌'} [${r.test}] ${r.detail}`);
  }

  await browser.close();
}

main().catch(console.error);
