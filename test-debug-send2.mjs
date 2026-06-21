import { chromium } from 'playwright';

const VITE_URL = 'http://localhost:5173';

async function test() {
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  try {
    console.log('[DEBUG] 页面加载...');
    await page.goto(VITE_URL, { timeout: 15000 });
    await page.waitForLoadState('networkidle', { timeout: 10000 });
    await page.waitForTimeout(3000);

    // 检查欢迎屏幕
    const welcomeVisible = await page.$('#welcome').then(el => el?.isVisible().catch(() => false) || false);
    console.log('[DEBUG] 欢迎屏幕可见:', welcomeVisible);

    // 找输入框
    const inputArea = await page.$('textarea, [contenteditable], input[type="text"]');
    console.log('[DEBUG] 输入框:', inputArea ? '找到' : '未找到');

    if (inputArea) {
      await inputArea.click();
      await page.waitForTimeout(500);
      await page.keyboard.type('你好，测试消息');
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'debug-02-after-typing.png', fullPage: false });

      // 找发送按钮并点击
      const sendBtn = await page.$('button[type="submit"], button:has(svg), [class*="send"], [class*="Send"]');
      console.log('[DEBUG] 发送按钮:', sendBtn ? '找到' : '未找到');

      if (sendBtn) {
        await sendBtn.click();
        console.log('[DEBUG] 已点击发送按钮');
      } else {
        // 尝试按 Enter
        console.log('[DEBUG] 尝试按 Enter...');
        await page.keyboard.press('Enter');
      }

      await page.waitForTimeout(5000);
      await page.screenshot({ path: 'debug-03-after-send.png', fullPage: false });

      // 检查状态
      const state1 = await page.evaluate(() => {
        const store = window.__STORE__?.getState?.();
        return {
          currentPath: store?.currentSessionPath,
          sessions: store?.sessions?.map(s => ({ path: s.path, title: s.title })) || [],
          chatSessionsKeys: Object.keys(store?.chatSessions || {}),
          welcomeStillVisible: !!document.querySelector('#welcome')?.checkVisibility(),
        };
      });
      console.log('[DEBUG] 发送后状态:', JSON.stringify(state1));

      // 如果仍然在欢迎屏幕，尝试点击 new chat 按钮
      if (state1.welcomeStillVisible) {
        console.log('[DEBUG] 仍在欢迎屏幕，尝试找新建会话按钮...');
        const newChatBtn = await page.$('button:has-text("New"), button:has-text("新建"), button:has-text("开始")');
        if (newChatBtn) {
          console.log('[DEBUG] 点击新建会话按钮...');
          await newChatBtn.click();
          await page.waitForTimeout(2000);
        }

        // 再次检查
        const state2 = await page.evaluate(() => {
          const store = window.__STORE__?.getState?.();
          return {
            currentPath: store?.currentSessionPath,
            sessions: store?.sessions?.length || 0,
          };
        });
        console.log('[DEBUG] 点击后状态:', JSON.stringify(state2));
      }
    }

  } catch (e) {
    console.error('[DEBUG] 出错:', e.message);
    await page.screenshot({ path: 'debug-error.png', fullPage: false });
  } finally {
    await page.waitForTimeout(5000);
    await browser.close();
  }
}

test().catch(console.error);