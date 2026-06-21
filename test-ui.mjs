import { chromium } from 'playwright';

const TEST_TIMEOUT = 15000;

(async () => {
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  try {
    await page.goto('http://localhost:5173', { timeout: TEST_TIMEOUT });
    await page.waitForLoadState('networkidle', { timeout: TEST_TIMEOUT });
    await page.waitForTimeout(3000);

    // 1. 打开设置模态框
    console.log('[1] 打开设置模态框...');
    await page.locator('button[title="设置"]').click();
    await page.waitForTimeout(1500);

    // 2. 检查设置模态框的 tabs
    console.log('[2] 检查设置 tabs...');
    const settingsTabs = await page.evaluate(() => {
      const modal = document.querySelector('[role="dialog"]');
      if (!modal) return { hasModal: false };
      const tabEls = modal.querySelectorAll('[role="tab"]');
      const result = [];
      for (const el of tabEls) {
        result.push(el.textContent?.trim());
      }
      return { hasModal: true, tabs: result, tabCount: tabEls.length };
    }).catch(() => ({ hasModal: false }));
    console.log('  设置 tabs:', settingsTabs);

    // 3. 点击插件 tab
    if (settingsTabs.tabs && settingsTabs.tabs.length > 0) {
      const pluginsIdx = settingsTabs.tabs.findIndex(t => 
        t?.includes('插件') || t?.includes('Plugin')
      );
      if (pluginsIdx >= 0) {
        console.log(`[3] 点击插件 tab (index ${pluginsIdx})...`);
        const tabEls = await page.locator('[role="dialog"] [role="tab"]').all();
        if (tabEls[pluginsIdx]) {
          await tabEls[pluginsIdx].click();
          await page.waitForTimeout(1500);

          // 4. 检查插件列表
          console.log('[4] 检查插件列表...');
          const pluginsContent = await page.evaluate(() => {
            const modal = document.querySelector('[role="dialog"]');
            if (!modal) return { hasContent: false };
            const pluginsList = modal.querySelector('[class*="plugin"], [class*="Plugin"]');
            return {
              hasContent: true,
              pluginsHtmlLen: pluginsList ? pluginsList.innerHTML.length : 0,
              modalHtmlLen: modal.innerHTML.length
            };
          }).catch(() => ({ hasContent: false }));
          console.log('  插件 tab 内容:', pluginsContent);
        }
      } else {
        console.log('  [警告] 未找到插件 tab，可用的 tabs:', settingsTabs.tabs);
      }
    }

    await page.screenshot({ path: 'test-settings-plugins.png' });

    // 5. 测试侧边栏折叠
    console.log('\n[5] 测试侧边栏折叠...');
    await page.keyboard.press('Escape'); // 关闭设置
    await page.waitForTimeout(500);
    
    const sidebarInfo = await page.evaluate(() => {
      const sidebar = document.querySelector('[class*="sidebar"], [class*="Sidebar"]');
      if (!sidebar) return { hasSidebar: false };
      const rect = sidebar.getBoundingClientRect();
      return {
        hasSidebar: true,
        width: rect.width,
        visible: rect.width > 0
      };
    }).catch(() => ({ hasSidebar: false }));
    console.log('  侧边栏信息:', sidebarInfo);

    // 6. 测试"书桌"按钮（工作台面板）
    console.log('\n[6] 测试"书桌"按钮...');
    const deskBtn = await page.$('button[title="书桌"]');
    if (deskBtn) {
      await deskBtn.click();
      await page.waitForTimeout(1500);
      const deskInfo = await page.evaluate(() => {
        const desk = document.querySelector('[class*="desk"], [class*="Desk"]');
        if (!desk) return { hasDesk: false };
        return {
          hasDesk: true,
          deskClass: desk.className.slice(0, 80),
          deskVisible: (desk).offsetParent !== null
        };
      }).catch(() => ({ hasDesk: false }));
      console.log('  工作台信息:', deskInfo);
    } else {
      console.log('  [警告] 未找到"书桌"按钮');
    }

    await page.screenshot({ path: 'test-final-ui.png' });
    console.log('\n测试完成！截图已保存。');

  } catch (err) {
    console.error('测试出错:', err.message);
  } finally {
    await browser.close();
  }
})();
