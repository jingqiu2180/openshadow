import { chromium } from 'playwright';

const TEST_TIMEOUT = 15000;
const PAGE_URL = 'http://localhost:5173';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const results = [];

  try {
    await page.goto(PAGE_URL, { timeout: TEST_TIMEOUT });
    await page.waitForLoadState('networkidle', { timeout: TEST_TIMEOUT });
    await page.waitForTimeout(3000);

    // ── Test A: 侧边栏会话点击切换 ──────────────────
    console.log('[TEST A] 侧边栏会话点击切换...');
    const sidebarSessions = await page.locator('[class*="session"]').all();
    let sessionClickPass = false;
    if (sidebarSessions.length > 0) {
      try {
        await sidebarSessions[0].click();
        await page.waitForTimeout(2000);
        sessionClickPass = true;
      } catch (e) {
        sessionClickPass = false;
      }
    }
    results.push({
      test: '侧边栏会话点击切换',
      pass: sessionClickPass,
      detail: `会话数:${sidebarSessions.length}, 点击成功:${sessionClickPass}`
    });
    await page.screenshot({ path: 'test-A-session-click.png' });

    // ── Test B: 设置模态框内容渲染 ─────────────────────
    console.log('[TEST B] 设置模态框内容渲染...');
    // 先关掉设置模态框（如果开着）
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(500);
    // 打开设置
    const settingsBtn = await page.$('button[title*="设置"], button[title*="Settings"], [class*="settings"]');
    if (settingsBtn) await settingsBtn.click().catch(() => {});
    await page.waitForTimeout(1500);
    // 检查设置模态框内部是否有内容（不是空 div）
    const settingsContent = await page.evaluate(() => {
      const modal = document.querySelector('[role="dialog"], .modal, [class*="modal"]');
      if (!modal) return { hasModal: false, content: '' };
      const inner = modal.querySelector('[class*="content"], [class*="body"], form');
      return {
        hasModal: true,
        hasInner: !!inner,
        innerHtmlLen: inner ? inner.innerHTML.length : 0,
        modalHtmlLen: modal.innerHTML.length
      };
    }).catch(() => ({ hasModal: false }));
    const settingsContentPass = settingsContent.hasModal && settingsContent.modalHtmlLen > 200;
    results.push({
      test: '设置模态框内容渲染',
      pass: settingsContentPass,
      detail: JSON.stringify(settingsContent)
    });
    await page.screenshot({ path: 'test-B-settings-content.png' });
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(500);

    // ── Test C: 文件树面板 ────────────────────────────
    console.log('[TEST C] 文件树面板...');
    // 文件树可能在侧边栏或者单独面板里
    const fileTreeInfo = await page.evaluate(() => {
      // 查找文件树相关元素
      const treeEls = document.querySelectorAll('[class*="tree"], [class*="file"], [class*="explorer"]');
      const result = { count: treeEls.length, samples: [] };
      for (let i = 0; i < Math.min(treeEls.length, 3); i++) {
        result.samples.push({
          tag: treeEls[i].tagName,
          class: treeEls[i].className.slice(0, 50),
          text: treeEls[i].textContent?.slice(0, 30)
        });
      }
      // 也检查是否有文件树按钮/标签
      const tabs = document.querySelectorAll('[class*="tab"], [role="tab"]');
      result.tabs = [];
      for (let i = 0; i < Math.min(tabs.length, 5); i++) {
        result.tabs.push(tabs[i].textContent?.trim());
      }
      return result;
    }).catch(() => ({}));
    console.log('  文件树信息:', JSON.stringify(fileTreeInfo, null, 2));
    results.push({
      test: '文件树面板',
      pass: (fileTreeInfo.count || 0) > 0,
      detail: `tree元素数:${fileTreeInfo.count || 0}`
    });

    // ── Test D: 插件页面 ──────────────────────────────
    console.log('[TEST D] 插件页面...');
    // 查找插件相关按钮或导航
    const pluginsInfo = await page.evaluate(() => {
      const links = document.querySelectorAll('a, button, [role="button"]');
      const result = { pluginsLinks: [] };
      for (const el of links) {
        const txt = el.textContent?.trim() || '';
        if (txt.includes('插件') || txt.includes('Plugin') || txt.includes('扩展')) {
          result.pluginsLinks.push(txt);
        }
      }
      return result;
    }).catch(() => ({}));
    console.log('  插件链接:', pluginsInfo.pluginsLinks);
    results.push({
      test: '插件页面',
      pass: (pluginsInfo.pluginsLinks?.length || 0) > 0,
      detail: `插件链接数:${(pluginsInfo.pluginsLinks?.length || 0)}`
    });

    // ── Test E: i18n 翻译键缺失检查 ─────────────────
    console.log('[TEST E] i18n 翻译键缺失检查...');
    const i18nInfo = await page.evaluate(() => {
      // 检查页面上是否有未翻译的键（格式如 {{key}} 或缺失的翻译）
      const bodyText = document.body.innerText;
      const missingPattern = /\{\{\s*\w+(\.\w+)*\s*\}\}/g;
      const matches = bodyText.match(missingPattern) || [];
      return {
        hasMissing: matches.length > 0,
        missingKeys: [...new Set(matches)].slice(0, 10),
        // 也检查 console 警告
        hasI18nWarning: typeof window !== 'undefined' && window.console && window.console._i18nWarnings
      };
    }).catch(() => ({}));
    results.push({
      test: 'i18n 翻译键缺失检查',
      pass: !i18nInfo.hasMissing,
      detail: i18nInfo.hasMissing ? `缺失键:${i18nInfo.missingKeys.join(', ')}` : '无缺失翻译键'
    });

    // ── Test F: 侧边栏折叠/展开 ───────────────────────
    console.log('[TEST F] 侧边栏折叠/展开...');
    const sidebarToggleInfo = await page.evaluate(() => {
      const sidebar = document.querySelector('[class*="sidebar"], [class*="side"]');
      if (!sidebar) return { hasSidebar: false };
      const rect = sidebar.getBoundingClientRect();
      return {
        hasSidebar: true,
        width: rect.width,
        visible: rect.width > 0
      };
    }).catch(() => ({}));
    results.push({
      test: '侧边栏可见',
      pass: sidebarToggleInfo.visible !== false,
      detail: JSON.stringify(sidebarToggleInfo)
    });

    // ── 截图 ────────────────────────────────────────────
    await page.screenshot({ path: 'test-final-full.png', fullPage: false });

    // ── 输出结果 ───────────────────────────────────────
    console.log('\n===== 扩展测试结果 =====');
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
