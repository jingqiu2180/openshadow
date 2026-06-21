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
    await page.screenshot({ path: 'debug-01-welcome.png', fullPage: false });

    // 检查当前状态
    const state0 = await page.evaluate(() => {
      const store = window.__STORE__?.getState?.();
      return {
        currentPath: store?.currentSessionPath,
        sessions: store?.sessions?.length || 0,
        chatSessionsKeys: Object.keys(store?.chatSessions || {}),
      };
    });
    console.log('[DEBUG] 初始状态:', JSON.stringify(state0));

    // 找输入框并输入
    console.log('[DEBUG] 查找输入框...');
    const inputArea = await page.$('textarea, [contenteditable], input[type="text"]');
    console.log('[DEBUG] inputArea:', inputArea ? '找到' : '未找到');

    if (inputArea) {
      await inputArea.click();
      await page.waitForTimeout(500);
      await page.keyboard.type('你好，测试消息');
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'debug-02-after-typing.png', fullPage: false });

      // 检查输入框内容
      const inputText = await page.evaluate(() => {
        const el = document.querySelector('textarea, [contenteditable]');
        if (!el) return 'no-el';
        if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') return el.value;
        return el.innerText;
      });
      console.log('[DEBUG] 输入内容:', inputText);

      // 找发送按钮
      const sendBtn = await page.$('button[type="submit"], button:has(svg), [class*="send"], [class*="Send"]');
      console.log('[DEBUG] sendBtn:', sendBtn ? '找到' : '未找到');

      // 按 Enter
      console.log('[DEBUG] 按 Enter...');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(5000);
      await page.screenshot({ path: 'debug-03-after-enter.png', fullPage: false });

      // 检查状态
      const state1 = await page.evaluate(() => {
        const store = window.__STORE__?.getState?.();
        return {
          currentPath: store?.currentSessionPath,
          sessions: store?.sessions?.map(s => ({ path: s.path, title: s.title })) || [],
          chatSessionsKeys: Object.keys(store?.chatSessions || {}),
          streamingSessions: store?.streamingSessions || [],
        };
      });
      console.log('[DEBUG] 发送后状态:', JSON.stringify(state1));

      // 检查 DOM 中是否有消息
      const domInfo = await page.evaluate(() => {
        const chatArea = document.querySelector('.chat-area');
        if (!chatArea) return 'no-chat-area';
        const allDivs = chatArea.querySelectorAll('div');
        return {
          chatAreaHtml: chatArea.innerHTML.substring(0, 500),
          divCount: allDivs.length,
        };
      });
      console.log('[DEBUG] DOM 信息:', JSON.stringify(domInfo).substring(0, 500));
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
