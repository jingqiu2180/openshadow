/**
 * 调试脚本：查看按钮 onclick 函数的源代码
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

    console.log('[DEBUG] 查看按钮 onclick 函数的源代码...');

    // 1. 获取左侧 toggle 按钮的 onclick 函数源代码
    const leftToggleOnClick = await page.evaluate(() => {
      const btn = document.querySelector('button.tb-toggle-left');
      if (!btn || !btn.onclick) return { found: false };
      
      return {
        found: true,
        functionSource: btn.onclick.toString().substring(0, 500),
        functionLength: btn.onclick.length,
        functionName: btn.onclick.name,
      };
    });

    console.log('[DEBUG] 左侧 toggle onclick:');
    console.log(JSON.stringify(leftToggleOnClick, null, 2));

    // 2. 获取"新对话"按钮的 onclick 函数源代码
    const newChatOnClick = await page.evaluate(() => {
      const btn = document.querySelector('button[title="新对话"]');
      if (!btn || !btn.onclick) return { found: false };
      
      return {
        found: true,
        functionSource: btn.onclick.toString().substring(0, 500),
        functionLength: btn.onclick.length,
        functionName: btn.onclick.name,
      };
    });

    console.log('\n[DEBUG] "新对话"按钮 onclick:');
    console.log(JSON.stringify(newChatOnClick, null, 2));

    // 3. 尝试通过 React fiber 直接调用事件处理器
    console.log('\n[DEBUG] 尝试通过 React fiber 调用事件处理器...');

    const reactCallResult = await page.evaluate(() => {
      const btn = document.querySelector('button.tb-toggle-left');
      if (!btn) return { error: 'button not found' };
      
      // 查找 React fiber
      const reactKey = Object.keys(btn).find(key => key.startsWith('__react'));
      if (!reactKey) return { error: 'no React fiber key found' };
      
      const fiber = btn[reactKey];
      if (!fiber) return { error: 'no fiber found' };
      
      // 遍历 fiber 树，找到有 onClick 处理器的 fiber
      let currentFiber = fiber;
      let onClickHandler = null;
      
      for (let i = 0; i < 20 && currentFiber; i++) {
        if (currentFiber.memoizedProps && currentFiber.memoizedProps.onClick) {
          onClickHandler = currentFiber.memoizedProps.onClick;
          break;
        }
        currentFiber = currentFiber.return;
      }
      
      if (!onClickHandler) return { error: 'no onClick handler found in fiber' };
      
      // 尝试调用 onClick 处理器
      try {
        // 创建一个合成事件对象
        const syntheticEvent = {
          currentTarget: btn,
          target: btn,
          preventDefault: () => {},
          stopPropagation: () => {},
          bubbles: true,
          cancelable: true,
          type: 'click',
        };
        
        onClickHandler(syntheticEvent);
        return { success: true, message: 'onClick handler called' };
      } catch (e) {
        return { success: false, error: e.message };
      }
    });

    console.log('[DEBUG] React fiber 调用结果:', JSON.stringify(reactCallResult, null, 2));

    await page.waitForTimeout(1500);

    // 检查侧边栏状态
    const sidebarAfterReactCall = await page.evaluate(() => {
      const sidebar = document.querySelector('.sidebar');
      return sidebar ? window.getComputedStyle(sidebar).display : 'not found';
    });

    console.log(`[DEBUG] React fiber 调用后侧边栏 display: ${sidebarAfterReactCall}`);

    // 4. 检查是否有 CSS pointer-events 问题
    console.log('\n[DEBUG] 检查 CSS pointer-events...');

    const pointerEventsInfo = await page.evaluate(() => {
      const buttons = [
        document.querySelector('button.tb-toggle-left'),
        document.querySelector('button.tb-toggle-right'),
        document.querySelector('button[title="新对话"]'),
        document.querySelector('button[title="设置"]'),
      ];

      return buttons.map((btn, i) => {
        if (!btn) return { index: i, found: false };
        
        const style = window.getComputedStyle(btn);
        return {
          index: i,
          found: true,
          pointerEvents: style.pointerEvents,
          display: style.display,
          visibility: style.visibility,
          opacity: style.opacity,
          zIndex: style.zIndex,
        };
      });
    });

    console.log('[DEBUG] CSS pointer-events:', JSON.stringify(pointerEventsInfo, null, 2));

    // 5. 截图
    await page.screenshot({ path: 'D:/tmp/debug-onclick.png', fullPage: true });
    console.log('\n📸 截图保存到 D:/tmp/debug-onclick.png');

  } catch (error) {
    console.error('调试失败:', error);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
