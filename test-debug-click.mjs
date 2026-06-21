/**
 * 调试脚本：手动触发按钮的点击事件
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

    console.log('[DEBUG] 手动触发点击事件...');

    // 1. 测试侧边栏 toggle 按钮
    console.log('\n[DEBUG] 测试侧边栏 toggle...');
    
    const leftToggleResult = await page.evaluate(() => {
      const btn = document.querySelector('button.tb-toggle-left');
      if (!btn) return { error: 'button not found' };
      
      // 方法1：直接调用 click() 方法
      try {
        btn.click();
        return { method: 'btn.click()', success: true };
      } catch (e) {
        return { method: 'btn.click()', error: e.message };
      }
    });

    console.log('[DEBUG] 左侧 toggle (方法1):', JSON.stringify(leftToggleResult));
    await page.waitForTimeout(1500);

    // 检查侧边栏状态
    const sidebarAfterClick1 = await page.evaluate(() => {
      const sidebar = document.querySelector('.sidebar');
      return sidebar ? window.getComputedStyle(sidebar).display : 'not found';
    });

    console.log(`[DEBUG] 点击后侧边栏 display: ${sidebarAfterClick1}`);

    // 方法2：dispatchEvent
    const leftToggleResult2 = await page.evaluate(() => {
      const btn = document.querySelector('button.tb-toggle-left');
      if (!btn) return { error: 'button not found' };
      
      // 创建并分发 click 事件
      const event = new MouseEvent('click', {
        view: window,
        bubbles: true,
        cancelable: true,
      });
      
      try {
        btn.dispatchEvent(event);
        return { method: 'dispatchEvent', success: true };
      } catch (e) {
        return { method: 'dispatchEvent', error: e.message };
      }
    });

    console.log('[DEBUG] 左侧 toggle (方法2):', JSON.stringify(leftToggleResult2));
    await page.waitForTimeout(1500);

    // 检查侧边栏状态
    const sidebarAfterClick2 = await page.evaluate(() => {
      const sidebar = document.querySelector('.sidebar');
      return sidebar ? window.getComputedStyle(sidebar).display : 'not found';
    });

    console.log(`[DEBUG] 点击后侧边栏 display: ${sidebarAfterClick2}`);

    // 2. 测试"新对话"按钮
    console.log('\n[DEBUG] 测试"新对话"按钮...');
    
    const newChatResult = await page.evaluate(() => {
      const btn = document.querySelector('button[title="新对话"]');
      if (!btn) return { error: 'button not found' };
      
      // 方法1：直接调用 click() 方法
      try {
        btn.click();
        return { method: 'btn.click()', success: true };
      } catch (e) {
        return { method: 'btn.click()', error: e.message };
      }
    });

    console.log('[DEBUG] "新对话"按钮 (方法1):', JSON.stringify(newChatResult));
    await page.waitForTimeout(2000);

    // 检查 session 数量
    const sessionCountAfterClick = await page.evaluate(() => {
      const store = window.__STORE__?.getState?.();
      return store ? Object.keys(store.chatSessions || {}).length : 0;
    }).catch(() => 0);

    console.log(`[DEBUG] 点击后 session 数: ${sessionCountAfterClick}`);

    // 3. 检查按钮的 onclick 属性
    console.log('\n[DEBUG] 检查按钮的 onclick 属性...');
    
    const buttonOnClickInfo = await page.evaluate(() => {
      const buttons = {
        leftToggle: document.querySelector('button.tb-toggle-left')?.onclick,
        rightToggle: document.querySelector('button.tb-toggle-right')?.onclick,
        newChat: document.querySelector('button[title="新对话"]')?.onclick,
        settings: document.querySelector('button[title="设置"]')?.onclick,
      };
      
      const result = {};
      for (const [key, value] of Object.entries(buttons)) {
        result[key] = {
          hasOnClick: !!value,
          onClickType: typeof value,
        };
      }
      
      return result;
    });

    console.log('[DEBUG] 按钮 onclick 属性:', JSON.stringify(buttonOnClickInfo, null, 2));

    // 4. 检查 React 事件监听器
    console.log('\n[DEBUG] 检查 React 事件监听器...');
    
    const reactEventListenerInfo = await page.evaluate(() => {
      const btn = document.querySelector('button.tb-toggle-left');
      if (!btn) return { error: 'button not found' };
      
      // 查看 React 内部属性
      const reactKey = Object.keys(btn).find(key => key.startsWith('__react'));
      if (!reactKey) return { hasReact: false };
      
      const reactFiber = btn[reactKey];
      if (!reactFiber) return { hasReact: true, hasFiber: false };
      
      // 查找事件监听器
      let currentFiber = reactFiber;
      const events = [];
      
      // 遍历 fiber 树
      for (let i = 0; i < 10 && currentFiber; i++) {
        if (currentFiber.memoizedProps) {
          const props = currentFiber.memoizedProps;
          if (props.onClick) events.push('onClick');
          if (props.onMouseDown) events.push('onMouseDown');
          if (props.onMouseUp) events.push('onMouseUp');
        }
        
        if (events.length > 0) break;
        currentFiber = currentFiber.return;
      }
      
      return {
        hasReact: true,
        hasFiber: true,
        events: events.length > 0 ? events : 'no events found',
      };
    });

    console.log('[DEBUG] React 事件监听器:', JSON.stringify(reactEventListenerInfo, null, 2));

    // 5. 截图
    await page.screenshot({ path: 'D:/tmp/debug-click.png', fullPage: true });
    console.log('\n📸 截图保存到 D:/tmp/debug-click.png');

  } catch (error) {
    console.error('调试失败:', error);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
