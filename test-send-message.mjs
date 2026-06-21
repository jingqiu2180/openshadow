import { chromium } from 'playwright';

const VITE_URL = 'http://localhost:5173';

async function test() {
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  try {
    console.log('[TEST] 页面加载...');
    await page.goto(VITE_URL, { timeout: 15000 });
    await page.waitForLoadState('networkidle', { timeout: 10000 });
    await page.waitForTimeout(5000);
    await page.screenshot({ path: 'test-01-after-load.png', fullPage: false });

    // 检查是否有 session 列表
    const sessionCount = await page.locator('[class*="sessionItem"]').count();
    console.log('[TEST] session 数:', sessionCount);

    if (sessionCount > 0) {
      // 点击第一个 session
      console.log('[TEST] 点击第一个 session...');
      await page.locator('[class*="sessionItem"]').first().click();
      await page.waitForTimeout(3000);
      await page.screenshot({ path: 'test-02-session-clicked.png', fullPage: false });

      // 检查是否离开欢迎屏幕
      const welcomeVisible = await page.$('#welcome').then(el => el?.isVisible().catch(() => false)) || false;
      console.log('[TEST] 欢迎屏幕可见:', welcomeVisible);

      if (!welcomeVisible) {
        // 输入消息
        const inputArea = await page.$('textarea, [contenteditable], input[type="text"]');
        if (inputArea) {
          console.log('[TEST] 输入消息...');
          await inputArea.click();
          await page.waitForTimeout(500);
          await page.keyboard.type('你好，这是一个测试消息');
          await page.waitForTimeout(1000);
          await page.screenshot({ path: 'test-03-after-type.png', fullPage: false });

          // 点击发送按钮
          const sendBtn = await page.$('button[type="submit"], [class*="send"], [class*="Send"]');
          if (sendBtn) {
            console.log('[TEST] 点击发送按钮...');
            await sendBtn.click();
            await page.waitForTimeout(5000);
            await page.screenshot({ path: 'test-04-after-send.png', fullPage: false });
          } else {
            console.log('[TEST] 按 Enter...');
            await page.keyboard.press('Enter');
            await page.waitForTimeout(5000);
            await page.screenshot({ path: 'test-04-after-enter.png', fullPage: false });
          }

          // 检查 store 中是否有消息
          const storeInfo = await page.evaluate(() => {
            const store = window.__STORE__?.getState?.();
            if (!store) return { hasStore: false };
            const currentPath = store.currentSessionPath;
            if (!currentPath || !store.chatSessions?.[currentPath]) {
              return { hasStore: true, currentPath, sessionKeys: Object.keys(store.chatSessions || {}) };
            }
            const items = store.chatSessions[currentPath]?.items || [];
            return { hasStore: true, msgCount: items.length, types: items.map(i => i.type), currentPath };
          }).catch(e => ({ error: e.message }));
          console.log('[TEST] store 信息:', JSON.stringify(storeInfo));
        }
      }
    } else {
      console.log('[TEST] 没有 session，尝试创建...');
      // 通过 API 创建 session（已经在前面创建了）
      // 刷新页面
      await page.reload();
      await page.waitForTimeout(5000);
      const newCount = await page.locator('[class*="sessionItem"]').count();
      console.log('[TEST] 刷新后 session 数:', newCount);
    }

  } catch (e) {
    console.error('[TEST] 出错:', e.message);
    await page.screenshot({ path: 'test-error.png', fullPage: false });
  } finally {
    await page.waitForTimeout(3000);
    await browser.close();
  }
}

test().catch(console.error);