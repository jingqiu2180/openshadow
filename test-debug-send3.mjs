import { chromium } from 'playwright';

const VITE_URL = 'http://localhost:5173';

async function test() {
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // 捕获 console 和网络请求
  const logs = [];
  const apiRequests = [];
  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warn') {
      logs.push(`[console.${msg.type()}] ${msg.text().slice(0, 200)}`);
    }
  });
  page.on('request', req => {
    if (req.url().includes('/api/') || req.url().includes(':3000')) {
      apiRequests.push({ url: req.url(), method: req.method() });
    }
  });
  page.on('response', res => {
    if (res.url().includes('/api/') || res.url().includes(':3000')) {
      apiRequests.push({ url: res.url(), status: res.status() });
    }
  });

  try {
    console.log('[DEBUG] 页面加载...');
    await page.goto(VITE_URL, { timeout: 15000 });
    await page.waitForLoadState('networkidle', { timeout: 10000 });
    await page.waitForTimeout(3000);

    // 点击 "选择工作台" 按钮
    console.log('[DEBUG] 查找工作台按钮...');
    const workbenchBtn = await page.$('button:has-text("选择工作台"), button:has-text("Select")');
    if (workbenchBtn) {
      console.log('[DEBUG] 点击选择工作台...');
      await workbenchBtn.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: 'debug-04-workbench-click.png', fullPage: false });
    }

    // 检查是否有对话框/下拉菜单出现
    const dialogVisible = await page.$('[role="dialog"], [role="listbox"], [class*="dropdown"], [class*="modal"]').then(el => el?.isVisible().catch(() => false)) || false;
    console.log('[DEBUG] 对话框可见:', dialogVisible);

    // 找输入框并输入
    const inputArea = await page.$('textarea, [contenteditable], input[type="text"]');
    console.log('[DEBUG] 输入框:', inputArea ? '找到' : '未找到');

    if (inputArea) {
      await inputArea.click();
      await page.waitForTimeout(500);
      await page.keyboard.type('你好，测试消息');
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'debug-05-after-type.png', fullPage: false });

      // 点击发送按钮
      const sendBtn = await page.$('button[type="submit"], [class*="send"], [class*="Send"]');
      console.log('[DEBUG] 发送按钮:', sendBtn ? '找到' : '未找到');

      if (sendBtn) {
        await sendBtn.click();
        console.log('[DEBUG] 已点击发送按钮');
      }

      await page.waitForTimeout(5000);
      await page.screenshot({ path: 'debug-06-after-send.png', fullPage: false });

      // 检查状态
      const state = await page.evaluate(() => {
        const store = window.__STORE__?.getState?.();
        return {
          currentPath: store?.currentSessionPath,
          sessions: store?.sessions?.length || 0,
          welcomeVisible: !!document.querySelector('#welcome')?.checkVisibility(),
        };
      });
      console.log('[DEBUG] 发送后状态:', JSON.stringify(state));
    }

    // 打印所有 console logs
    console.log('[DEBUG] Console logs:');
    logs.forEach(l => console.log(' ', l));

    // 打印 API 请求
    console.log('[DEBUG] API requests/responses:');
    apiRequests.forEach(r => console.log(' ', JSON.stringify(r)));

  } catch (e) {
    console.error('[DEBUG] 出错:', e.message);
    await page.screenshot({ path: 'debug-error.png', fullPage: false });
  } finally {
    await page.waitForTimeout(3000);
    await browser.close();
  }
}

test().catch(console.error);