/**
 * 调试脚本：检查 window.__STORE__ 对象
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

    console.log('[DEBUG] 检查 window.__STORE__ 对象...');

    // 1. 检查 window.__STORE__ 是否存在
    const storeExists = await page.evaluate(() => {
      return {
        hasStore: typeof window.__STORE__ !== 'undefined',
        storeType: typeof window.__STORE__,
      };
    });

    console.log('[DEBUG] store 存在性:', JSON.stringify(storeExists));

    if (!storeExists.hasStore) {
      console.log('[DEBUG] window.__STORE__ 不存在！');
      return;
    }

    // 2. 检查 store 对象的方法
    const storeMethods = await page.evaluate(() => {
      const store = window.__STORE__;
      if (!store) return { error: 'store is null' };

      const methods = {
        hasGetState: typeof store.getState === 'function',
        hasSetState: typeof store.setState === 'function',
        hasSubscribe: typeof store.subscribe === 'function',
        getStateType: typeof store.getState,
      };

      // 尝试调用 getState()
      try {
        const state = store.getState();
        methods.stateKeys = Object.keys(state).slice(0, 20); // 前20个键
        methods.hasToggleSidebar = typeof state.toggleSidebar === 'function';
        methods.hasCreateNewSession = typeof state.createNewSession === 'function';
        methods.hasOpenSettingsModal = typeof state.openSettingsModal === 'function';
      } catch (e) {
        methods.getStateError = e.message;
      }

      return methods;
    });

    console.log('[DEBUG] store 方法:', JSON.stringify(storeMethods, null, 2));

    // 3. 尝试直接调用 store 动作
    console.log('\n[DEBUG] 尝试直接调用 store 动作...');

    const actionResult = await page.evaluate(() => {
      const store = window.__STORE__;
      if (!store) return { error: 'store is null' };

      const results = {};

      // 调用 toggleSidebar
      try {
        if (store.getState().toggleSidebar) {
          store.getState().toggleSidebar();
          results.toggleSidebar = 'called';
          
          // 检查状态是否变化
          const state = store.getState();
          results.sidebarOpenAfterToggle = state.sidebarOpen;
        } else {
          results.toggleSidebar = 'function not found';
        }
      } catch (e) {
        results.toggleSidebar = `error: ${e.message}`;
      }

      return results;
    });

    console.log('[DEBUG] 动作调用结果:', JSON.stringify(actionResult, null, 2));

    // 4. 检查 React 是否正确挂载
    console.log('\n[DEBUG] 检查 React 挂载...');

    const reactInfo = await page.evaluate(() => {
      // 查找 React 根容器
      const root = document.getElementById('react-root');
      if (!root) return { error: 'react-root not found' };

      return {
        rootHTML: root.innerHTML.substring(0, 200),
        rootChildCount: root.children.length,
        hasReactComments: root.innerHTML.includes('$?') || root.innerHTML.includes('$!'),
      };
    });

    console.log('[DEBUG] React 挂载信息:', JSON.stringify(reactInfo, null, 2));

    // 5. 截图
    await page.screenshot({ path: 'D:/tmp/debug-store.png', fullPage: true });
    console.log('\n📸 截图保存到 D:/tmp/debug-store.png');

  } catch (error) {
    console.error('调试失败:', error);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
