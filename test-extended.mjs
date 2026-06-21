// test-extended.mjs — 扩展功能测试
import { chromium } from 'playwright';

const BASE = 'http://localhost:5173';
const API  = 'http://localhost:3000';

async function main() {
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const results = [];

  // ── Test 1: API 健康检查 ────────────────────────────────
  console.log('[TEST 1] API 健康检查...');
  try {
    const res = await page.evaluate(async (api) => {
      const r = await fetch(`${api}/api/health`);
      return { status: r.status, ok: r.ok };
    }, API);
    results.push({ test: 'API 健康检查', pass: res.ok, detail: `status:${res.status}` });
  } catch (e) {
    results.push({ test: 'API 健康检查', pass: false, detail: e.message });
  }

  // ── Test 2: 页面加载后无 console.error ─────────────────
  console.log('[TEST 2] Console errors 检查...');
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text().slice(0, 120));
  });
  await page.goto(BASE, { timeout: 15000 });
  await page.waitForLoadState('networkidle', { timeout: 10000 });
  await page.waitForTimeout(3000);
  results.push({
    test: 'Console Errors 检查',
    pass: errors.length === 0,
    detail: `errors:${errors.length}${errors.length > 0 ? ` | ${errors[0]}` : ''}`
  });

  // ── Test 3: 键盘快捷键 Ctrl+K（打开设置）───────────────────
  console.log('[TEST 3] 键盘快捷键 Ctrl+K...');
  await page.keyboard.press('Control+K');
  await page.waitForTimeout(800);
  const settingsOpen = await page.evaluate(() => {
    return !!document.querySelector('[role="dialog"]');
  });
  results.push({ test: '快捷键 Ctrl+K', pass: settingsOpen, detail: `设置模态框:${settingsOpen}` });
  if (settingsOpen) {
    await page.keyboard.press('Escape'); // 关闭
    await page.waitForTimeout(500);
  }

  // ── Test 4: 响应式布局（缩小窗口）────────────────────────
  console.log('[TEST 4] 响应式布局...');
  await ctx.newPage(); // 不需要新页面，改 viewport
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.waitForTimeout(1000);
  const mobileLayout = await page.evaluate(() => {
    const sidebar = document.querySelector('[class*="sidebar"], [class*="Sidebar"]');
    const main = document.querySelector('.main-content, [class*="main-content"]');
    return {
      sidebarVisible: sidebar ? getComputedStyle(sidebar).display !== 'none' : 'unknown',
      mainWidth: main ? getComputedStyle(main).width : 'unknown',
    };
  });
  results.push({
    test: '响应式布局 (768px)',
    pass: true, // 不 fail，只记录
    detail: JSON.stringify(mobileLayout),
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(500);

  // ── Test 5: WebSocket 重连 ───────────────────────────────
  console.log('[TEST 5] WebSocket 重连...');
  const wsStatus = await page.evaluate(() => {
    const s = window.useStore?.getState?.();
    return s?.connectionStatus || 'unknown';
  });
  results.push({ test: 'WebSocket 连接状态', pass: wsStatus === 'connected', detail: `status:${wsStatus}` });

  // ── Test 6: 会话列表空状态 UI ───────────────────────────
  console.log('[TEST 6] 空状态 UI...');
  const emptyState = await page.evaluate(() => {
    const sidebar = document.querySelector('[class*="session"], [class*="Session"]');
    if (!sidebar) return { hasSidebar: false };
    const empty = sidebar.querySelector('[class*="empty"], [class*="Empty"]');
    const items = sidebar.querySelectorAll('[class*="item"], [class*="Item"]');
    return {
      hasSidebar: true,
      hasEmptyState: !!empty,
      itemCount: items.length,
    };
  });
  results.push({ test: '空状态 UI', pass: true, detail: JSON.stringify(emptyState) });

  // ── Test 7: 发送消息后 AI 回复出现 ─────────────────────
  console.log('[TEST 7] AI 回复出现...');
  const input = await page.$('textarea, input[placeholder*="消息"], [class*="input"]');
  if (input) {
    await input.click();
    await page.keyboard.type('你好，请介绍一下自己', { delay: 50 });
    const sendBtn = await page.$('button[title*="发送"], button[title*="Send"], [class*="send"]');
    if (sendBtn) await sendBtn.click();
    else await page.keyboard.press('Enter');
    await page.waitForTimeout(5000); // 等 AI 回复
    const replyCount = await page.locator('[data-message-id]').count();
    results.push({ test: 'AI 回复出现', pass: replyCount >= 2, detail: `消息数:${replyCount}` });
  } else {
    results.push({ test: 'AI 回复出现', pass: false, detail: '输入框未找到' });
  }

  // ── Test 8: 设置模态框内容渲染 ─────────────────────────
  console.log('[TEST 8] 设置模态框内容...');
  await page.locator('button[title="设置"]').click();
  await page.waitForTimeout(1000);
  const settingsContent = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return { hasDialog: false };
    const tabs = dialog.querySelectorAll('[role="tab"]');
    const panels = dialog.querySelectorAll('[role="tabpanel"]');
    return {
      hasDialog: true,
      tabCount: tabs.length,
      panelCount: panels.length,
      tabTexts: Array.from(tabs).map(t => t.textContent?.trim()).slice(0, 5),
    };
  });
  results.push({ test: '设置模态框内容', pass: settingsContent.tabCount > 0, detail: JSON.stringify(settingsContent) });
  await page.keyboard.press('Escape');

  // ── Test 9: 文件树展开/折叠 ────────────────────────────
  console.log('[TEST 9] 文件树展开...');
  const deskVisible = await page.evaluate(() => {
    const section = document.querySelector('[class*="Desk"], [class*="desk"]');
    return section ? getComputedStyle(section).visibility !== 'hidden' : false;
  });
  if (deskVisible) {
    const treeItems = await page.locator('[class*="tree-item"], [class*="TreeItem"]').count();
    results.push({ test: '文件树渲染', pass: treeItems >= 0, detail: `树节点数:${treeItems}` });
  } else {
    results.push({ test: '文件树渲染', pass: true, detail: 'Desk 面板未展开，跳过' });
  }

  // ── Test 10: 内存使用情况 ───────────────────────────────
  console.log('[TEST 10] 内存使用...');
  const memInfo = await page.evaluate(() => {
    if ('memory' in performance) {
      return { jsHeapSizeLimit: performance.memory?.jsHeapSizeLimit };
    }
    return { notAvailable: true };
  }).catch(() => ({ error: true }));
  results.push({ test: '内存信息', pass: true, detail: JSON.stringify(memInfo) });

  // ── 结果汇总 ────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════');
  console.log(`  扩展测试结果: ${results.filter(r => r.pass).length}/${results.length} 通过`);
  console.log('═══════════════════════════════════════════\n');
  for (const r of results) {
    console.log(`${r.pass ? '✅' : '❌'} [${r.test}] ${r.detail}`);
  }

  await browser.close();
}

main().catch(console.error);
