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

    // 打开设置模态框
    console.log('[设置] 打开设置模态框...');
    const settingsBtn = await page.locator('button').filter({ hasText: /设置|Settings/ }).first();
    if (await settingsBtn.count() === 0) {
      // 尝试通过 title 属性找
      const btnByTitle = await page.$('[title*="设置"], [title*="Settings"]');
      if (btnByTitle) await btnByTitle.click();
    } else {
      await settingsBtn.click();
    }
    await page.waitForTimeout(1500);

    // 检查设置模态框的 tabs
    console.log('[设置] 检查设置 tabs...');
    const settingsTabs = await page.evaluate(() => {
      const modal = document.querySelector('[role="dialog"]');
      if (!modal) return [];
      const tabEls = modal.querySelectorAll('[role="tab"]');
      const result = [];
      for (const el of tabEls) {
        result.push(el.textContent?.trim());
      }
      return result;
    }).catch(() => []);
    console.log('  设置 tabs:', settingsTabs);

    // 点击插件 tab
    const pluginsTab = settingsTabs.findIndex(t => t?.includes('插件') || t?.includes('Plugin') || t?.includes('插件'));
    if (pluginsTab >= 0) {
      console.log(`[设置] 点击插件 tab (index ${pluginsTab})...`);
      const tabEls = await page.locator('[role="dialog"] [role="tab"]').all();
      if (tabEls[pluginsTab]) {
        await tabEls[pluginsTab].click();
        await page.waitForTimeout(1500);

        // 检查插件列表是否渲染
        const pluginsContent = await page.evaluate(() => {
          const modal = document.querySelector('[role="dialog"]');
          if (!modal) return { hasContent: false };
          // 查找插件列表元素
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
      console.log('  [警告] 未找到插件 tab');
    }

    await page.screenshot({ path: 'test-plugins-tab.png' });

    // 测试：文件树展开
    console.log('\n[文件树] 测试文件树展开...');
    await page.keyboard.press('Escape'); // 关闭设置
    await page.waitForTimeout(500);

    const fileTreeInfo = await page.evaluate(() => {
      // 查找文件树元素
      const tree = document.querySelector('[class*="tree"]');
      if (!tree) return { hasTree: false };
      // 查找可展开的项
      const expandBtns = tree.querySelectorAll('[class*="expand"], [class*="toggle"], svg');
      return {
        hasTree: true,
        treeClass: tree.className.slice(0, 80),
        expandBtnsCount: expandBtns.length
      };
    }).catch(() => ({ hasTree: false }));
    console.log('  文件树信息:', fileTreeInfo);

    // 测试：工作台面板展开
    console.log('\n[工作台] 测试工作台面板...');
    const deskInfo = await page.evaluate(() => {
      const desk = document.querySelector('[class*="desk"], [class*="Desk"]');
      if (!desk) return { hasDesk: false };
      return {
        hasDesk: true,
        deskClass: desk.className.slice(0, 80),
        deskVisible: desk.offsetParent !== null
      };
    }).catch(() => ({ hasDesk: false }));
    console.log('  工作台信息:', deskInfo);

    await page.screenshot({ path: 'test-final.png' });

    console.log('\n测试完成！截图已保存。');

  } catch (err) {
    console.error('测试出错:', err.message);
  } finally {
    await browser.close();
  }
})();
