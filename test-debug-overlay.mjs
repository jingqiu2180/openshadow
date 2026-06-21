/**
 * 调试脚本 v3：检查遮挡元素和 DOM 结构
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

    console.log('[DEBUG] 检查遮挡元素...');

    // 1. 检查所有可见的 overlay/modal
    const overlays = await page.evaluate(() => {
      const selectors = [
        '[role="dialog"]',
        '[data-testid="settings-modal-overlay"]',
        '.overlay',
        '.modal',
        '[_emptyOverlay]',
        '[_emptyOverlay]',
      ];

      const results = [];
      selectors.forEach(selector => {
        const els = document.querySelectorAll(selector);
        if (els.length > 0) {
          for (let i = 0; i < Math.min(els.length, 3); i++) {
            const el = els[i];
            const style = window.getComputedStyle(el);
            if (style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') {
              results.push({
                selector,
                index: i,
                display: style.display,
                visibility: style.visibility,
                opacity: style.opacity,
                zIndex: style.zIndex,
                className: el.className?.substring(0, 100),
              });
            }
          }
        }
      });

      return results;
    });

    console.log(`[DEBUG] 找到 ${overlays.length} 个可能的遮挡元素:`);
    overlays.forEach((o, i) => {
      console.log(`  ${i + 1}. selector="${o.selector}", display=${o.display}, zIndex=${o.zIndex}`);
    });

    // 2. 检查 textarea 是否被遮挡
    console.log('\n[DEBUG] 检查 textarea...');
    
    const textareaInfo = await page.evaluate(() => {
      const textareas = document.querySelectorAll('textarea');
      const results = [];
      
      for (let i = 0; i < textareas.length; i++) {
        const ta = textareas[i];
        const style = window.getComputedStyle(ta);
        const rect = ta.getBoundingClientRect();
        
        // 检查是否有元素在 textarea 上面
        const point = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        const elAtPoint = document.elementFromPoint(point.x, point.y);
        
        results.push({
          index: i,
          value: ta.value?.substring(0, 30),
          placeholder: ta.placeholder,
          display: style.display,
          visibility: style.visibility,
          opacity: style.opacity,
          zIndex: style.zIndex,
          rect: `${Math.round(rect.left)},${Math.round(rect.top)} ${Math.round(rect.width)}x${Math.round(rect.height)}`,
          elementAtPoint: elAtPoint ? elAtPoint.tagName + (elAtPoint.className ? '.' + elAtPoint.className.substring(0, 50) : '') : 'null',
          isSameElement: elAtPoint === ta,
        });
      }
      
      return results;
    });

    console.log(`[DEBUG] 找到 ${textareaInfo.length} 个 textarea:`);
    textareaInfo.forEach(ta => {
      console.log(`  ${ta.index}. placeholder="${ta.placeholder}", visible=${ta.display !== 'none'}, atPoint="${ta.elementAtPoint}", same=${ta.isSameElement}`);
    });

    // 3. 确保 welcome 屏幕可见
    console.log('\n[DEBUG] 确保 welcome 屏幕可见...');
    
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

    // 4. 重新检查 textarea
    const textareaAfterWelcome = await page.$('textarea');
    if (textareaAfterWelcome) {
      const isVisible = await textareaAfterWelcome.isVisible().catch(() => false);
      console.log(`[DEBUG] textarea 可见: ${isVisible}`);
      
      if (isVisible) {
        // 尝试强制点击
        await textareaAfterWelcome.click({ force: true }).catch(e => {
          console.log('[DEBUG] 强制点击失败:', e.message);
        });
        await page.waitForTimeout(1000);
        console.log('[DEBUG] 已强制点击 textarea');
      }
    } else {
      console.log('[DEBUG] 未找到 textarea');
    }

    // 5. 截图
    await page.screenshot({ path: 'D:/tmp/debug-overlay.png', fullPage: true });
    console.log('\n📸 截图保存到 D:/tmp/debug-overlay.png');

  } catch (error) {
    console.error('调试失败:', error);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
