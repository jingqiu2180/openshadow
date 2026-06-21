/**
 * 调试脚本 v4：检查 welcome 屏幕的输入元素
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

    console.log('[DEBUG] 检查 welcome 屏幕的输入元素...');

    // 1. 确保 welcome 屏幕可见
    await page.evaluate(() => {
      const store = window.__STORE__;
      if (store && store.getState) {
        store.setState({
          welcomeVisible: true,
          currentSessionPath: null,
          pendingNewSession: true,
        });
      }
    });
    await page.waitForTimeout(2000);

    // 2. 获取 #welcome 内的所有元素
    const welcomeElements = await page.evaluate(() => {
      const welcome = document.getElementById('welcome');
      if (!welcome) return { error: 'welcome not found' };

      const allElements = welcome.querySelectorAll('*');
      const results = [];
      for (let i = 0; i < allElements.length; i++) {
        const el = allElements[i];
        const style = window.getComputedStyle(el);
        if (style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') {
          results.push({
            tag: el.tagName,
            className: String(el.className || '').substring(0, 80),
            textContent: el.textContent?.substring(0, 50),
            isVisible: el.checkVisibility(),
            hasPlaceholder: el.placeholder ? true : false,
            placeholder: el.placeholder || null,
            contentEditable: el.contentEditable || null,
            isTextArea: el.tagName === 'TEXTAREA',
            isInput: el.tagName === 'INPUT',
          });
        }
      }
      return {
        welcomeHTML: welcome.innerHTML?.substring(0, 500),
        elements: results.slice(0, 30), // 前30个可见元素
      };
    });

    console.log('[DEBUG] welcome 元素:');
    console.log(JSON.stringify(welcomeElements, null, 2));

    // 3. 查找可能的输入元素
    console.log('\n[DEBUG] 查找输入元素...');
    
    const inputElements = await page.evaluate(() => {
      const welcome = document.getElementById('welcome');
      if (!welcome) return { error: 'welcome not found' };

      // 查找 textarea
      const textareas = welcome.querySelectorAll('textarea');
      const textareaInfo = Array.from(textareas).map(ta => ({
        placeholder: ta.placeholder,
        value: ta.value?.substring(0, 30),
        visible: ta.checkVisibility(),
        rect: ta.getBoundingClientRect(),
      }));

      // 查找 contenteditable
      const editable = welcome.querySelectorAll('[contenteditable]');
      const editableInfo = Array.from(editable).map(el => ({
        tag: el.tagName,
        className: el.className?.substring(0, 80),
        textContent: el.textContent?.substring(0, 50),
        visible: el.checkVisibility(),
        rect: el.getBoundingClientRect(),
      }));

      // 查找 input
      const inputs = welcome.querySelectorAll('input');
      const inputInfo = Array.from(inputs).map(inp => ({
        type: inp.type,
        placeholder: inp.placeholder,
        value: inp.value?.substring(0, 30),
        visible: inp.checkVisibility(),
      }));

      return {
        textareas: textareaInfo,
        editable: editableInfo,
        inputs: inputInfo,
      };
    });

    console.log('[DEBUG] 输入元素:');
    console.log(JSON.stringify(inputElements, null, 2));

    // 4. 尝试直接设置 textarea 的值
    console.log('\n[DEBUG] 尝试设置 textarea 的值...');
    
    const setValueResult = await page.evaluate(() => {
      const textarea = document.querySelector('#welcome textarea');
      if (!textarea) return { error: 'textarea not found' };

      // 方法1：直接设置 value
      textarea.value = '测试消息';
      
      // 方法2：触发 input 事件
      const inputEvent = new Event('input', { bubbles: true });
      textarea.dispatchEvent(inputEvent);
      
      // 方法3：触发 change 事件
      const changeEvent = new Event('change', { bubbles: true });
      textarea.dispatchEvent(changeEvent);
      
      return {
        success: true,
        value: textarea.value,
      };
    });

    console.log('[DEBUG] 设置值结果:', JSON.stringify(setValueResult));

    await page.waitForTimeout(1000);

    // 5. 尝试按 Enter 发送
    console.log('\n[DEBUG] 尝试按 Enter...');
    
    const textarea = await page.$('#welcome textarea');
    if (textarea) {
      await textarea.focus();
      await page.waitForTimeout(500);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(5000);
    }

    // 6. 检查 session 是否创建
    const sessionCountAfter = await page.evaluate(() => {
      const store = window.__STORE__?.getState?.();
      return store ? Object.keys(store.chatSessions || {}).length : 0;
    }).catch(() => 0);

    console.log(`[DEBUG] 按 Enter 后 session 数: ${sessionCountAfter}`);

    // 7. 截图
    await page.screenshot({ path: 'D:/tmp/debug-input.png', fullPage: true });
    console.log('\n📷 截图保存到 D:/tmp/debug-input.png');

  } catch (error) {
    console.error('调试失败:', error);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
