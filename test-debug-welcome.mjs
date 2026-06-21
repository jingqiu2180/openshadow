/**
 * 调试脚本：检查欢迎屏幕的 DOM 结构
 */

import { chromium } from 'playwright';
import fs from 'fs';

const VITE_URL = 'http://localhost:5173';
const USER_DATA_DIR = 'D:/tmp/remu-test-user-data';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    storageState: fs.existsSync(`${USER_DATA_DIR}/state.json`)
      ? `${USER_DATA_DIR}/state.json`
      : undefined,
  });
  const page = await context.newPage();

  try {
    await page.goto(VITE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    console.log('[DEBUG] 检查欢迎屏幕...');

    // 1. 检查 welcomeVisible 状态
    const welcomeVisible = await page.evaluate(() => {
      const store = window.__STORE__?.getState?.();
      return store ? store.welcomeVisible : null;
    });

    console.log(`[DEBUG] welcomeVisible: ${welcomeVisible}`);

    // 2. 查找欢迎屏幕的 DOM 元素
    const welcomeInfo = await page.evaluate(() => {
      // 尝试多种选择器
      const selectors = [
        '#welcome',
        '[class*="welcome"]',
        '[class*="Welcome"]',
        'textarea[placeholder*="消息"]',
        'textarea[placeholder*="message"]',
        '.input-area textarea',
        '.welcome textarea',
      ];

      const results = {};
      selectors.forEach(selector => {
        const el = document.querySelector(selector);
        results[selector] = el ? {
          found: true,
          visible: el.checkVisibility(),
          className: el.className?.substring(0, 100),
          placeholder: el.placeholder || null,
        } : { found: false };
      });

      return results;
    });

    console.log('[DEBUG] 欢迎屏幕元素:', JSON.stringify(welcomeInfo, null, 2));

    // 3. 设置 welcomeVisible: true 并检查 UI 变化
    console.log('\n[DEBUG] 设置 welcomeVisible: true...');

    await page.evaluate(() => {
      window.__STORE__.setState({ welcomeVisible: true, currentSessionPath: null });
    });

    await page.waitForTimeout(2000);

    // 再次查找欢迎屏幕元素
    const welcomeInfoAfter = await page.evaluate(() => {
      const selectors = ['#welcome', '[class*="welcome"]', 'textarea'];
      const results = {};
      selectors.forEach(selector => {
        const el = document.querySelector(selector);
        results[selector] = el ? {
          found: true,
          visible: el.checkVisibility(),
          text: el.textContent?.substring(0, 50),
        } : { found: false };
      });
      return results;
    });

    console.log('[DEBUG] 设置后欢迎屏幕元素:', JSON.stringify(welcomeInfoAfter, null, 2));

    // 4. 检查 chat-area 的内容
    const chatAreaInfo = await page.evaluate(() => {
      const chatArea = document.querySelector('.chat-area');
      if (!chatArea) return { found: false };

      return {
        found: true,
        innerHTML: chatArea.innerHTML?.substring(0, 500),
        childCount: chatArea.children.length,
        hasWelcome: chatArea.innerHTML?.includes('welcome') || chatArea.innerHTML?.includes('Welcome'),
      };
    });

    console.log('[DEBUG] chat-area 信息:', JSON.stringify(chatAreaInfo, null, 2));

    // 5. 截图
    await page.screenshot({ path: 'D:/tmp/debug-welcome.png', fullPage: true });
    console.log('\n📷 截图保存到 D:/tmp/debug-welcome.png');

  } catch (error) {
    console.error('调试失败:', error);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
