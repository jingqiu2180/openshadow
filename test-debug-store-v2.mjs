/**
 * 调试脚本 v2：直接检查 store state 的关键属性
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

    console.log('[DEBUG] 直接检查 store state 的关键属性...');

    // 1. 检查关键属性是否存在
    const keyProps = await page.evaluate(() => {
      const store = window.__STORE__;
      if (!store || !store.getState) return { error: 'store not found' };
      
      const state = store.getState();
      return {
        hasSidebarOpen: 'sidebarOpen' in state,
        hasToggleSidebar: typeof state.toggleSidebar === 'function',
        hasCreateNewSession: typeof state.createNewSession === 'function',
        hasOpenSettingsModal: typeof state.openSettingsModal === 'function',
        hasWelcomeVisible: 'welcomeVisible' in state,
        hasChatSessions: 'chatSessions' in state,
        // 直接读取值
        sidebarOpen: state.sidebarOpen,
        welcomeVisible: state.welcomeVisible,
        chatSessionsCount: state.chatSessions ? Object.keys(state.chatSessions).length : 'N/A',
      };
    });

    console.log('[DEBUG] 关键属性:', JSON.stringify(keyProps, null, 2));

    // 2. 调用 toggleSidebar 并检查效果
    console.log('\n[DEBUG] 测试 toggleSidebar...');
    
    const toggleResult = await page.evaluate(() => {
      const store = window.__STORE__;
      if (!store || !store.getState) return { error: 'store not found' };
      
      const before = store.getState().sidebarOpen;
      
      // 调用 toggleSidebar
      if (typeof store.getState().toggleSidebar === 'function') {
        store.getState().toggleSidebar();
      } else {
        return { error: 'toggleSidebar not found' };
      }
      
      // 等待一下让 React 重新渲染
      return new Promise(resolve => {
        setTimeout(() => {
          const after = store.getState().sidebarOpen;
          const sidebar = document.querySelector('.sidebar');
          const sidebarDisplay = sidebar ? window.getComputedStyle(sidebar).display : 'not found';
          resolve({
            before,
            after,
            sidebarDisplay,
            toggled: before !== after,
          });
        }, 500);
      });
    });

    console.log('[DEBUG] toggleSidebar 结果:', JSON.stringify(toggleResult, null, 2));

    // 3. 检查侧边栏的 CSS
    console.log('\n[DEBUG] 检查侧边栏 CSS...');
    
    const sidebarCss = await page.evaluate(() => {
      const sidebar = document.querySelector('.sidebar');
      if (!sidebar) return { error: 'sidebar not found' };
      
      const style = window.getComputedStyle(sidebar);
      return {
        display: style.display,
        visibility: style.visibility,
        opacity: style.opacity,
        width: style.width,
        className: sidebar.className.substring(0, 100),
      };
    });

    console.log('[DEBUG] 侧边栏 CSS:', JSON.stringify(sidebarCss, null, 2));

    // 4. 检查 .collapsed 类名的 CSS 规则
    console.log('\n[DEBUG] 检查 .collapsed 类名...');
    
    const collapsedCss = await page.evaluate(() => {
      // 查找所有包含 "collapsed" 类名的元素
      const elements = document.querySelectorAll('[class*="collapsed"]');
      const results = [];
      for (let i = 0; i < Math.min(elements.length, 5); i++) {
        const el = elements[i];
        const style = window.getComputedStyle(el);
        results.push({
          tag: el.tagName,
          className: el.className.substring(0, 80),
          display: style.display,
          visibility: style.visibility,
        });
      }
      return { count: elements.length, samples: results };
    });

    console.log('[DEBUG] collapsed 元素:', JSON.stringify(collapsedCss, null, 2));

    // 5. 截图
    await page.screenshot({ path: 'D:/tmp/debug-store-v2.png', fullPage: true });
    console.log('\n📸 截图保存到 D:/tmp/debug-store-v2.png');

  } catch (error) {
    console.error('调试失败:', error);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
