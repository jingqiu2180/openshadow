/**
 * 调试脚本：检查 toggle 按钮和设置按钮的实际功能
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

    console.log('[DEBUG] 检查 toggle 按钮...');

    // 1. 检查 tb-toggle-left 按钮
    const leftToggleInfo = await page.evaluate(() => {
      const btn = document.querySelector('.tb-toggle-left');
      if (!btn) return { found: false };
      
      return {
        found: true,
        title: btn.getAttribute('title'),
        ariaLabel: btn.getAttribute('aria-label'),
        className: btn.className,
        disabled: btn.hasAttribute('disabled'),
        onClick: btn.onclick ? 'has onclick' : 'no onclick',
        children: btn.children.length,
        innerHTML: btn.innerHTML.substring(0, 100)
      };
    });

    console.log('[DEBUG] tb-toggle-left:', JSON.stringify(leftToggleInfo, null, 2));

    // 2. 检查 tb-toggle-right 按钮
    const rightToggleInfo = await page.evaluate(() => {
      const btn = document.querySelector('.tb-toggle-right');
      if (!btn) return { found: false };
      
      return {
        found: true,
        title: btn.getAttribute('title'),
        ariaLabel: btn.getAttribute('aria-label'),
        className: btn.className,
        disabled: btn.hasAttribute('disabled'),
        onClick: btn.onclick ? 'has onclick' : 'no onclick',
        children: btn.children.length,
        innerHTML: btn.innerHTML.substring(0, 100)
      };
    });

    console.log('[DEBUG] tb-toggle-right:', JSON.stringify(rightToggleInfo, null, 2));

    // 3. 检查所有 sidebar-action-btn 按钮
    const actionButtons = await page.evaluate(() => {
      const buttons = document.querySelectorAll('.sidebar-action-btn');
      return Array.from(buttons).map((btn, i) => ({
        index: i,
        title: btn.getAttribute('title'),
        ariaLabel: btn.getAttribute('aria-label'),
        className: btn.className,
        visible: btn.checkVisibility(),
        innerHTML: btn.innerHTML.substring(0, 50)
      }));
    });

    console.log(`[DEBUG] 找到 ${actionButtons.length} 个 sidebar-action-btn 按钮:`);
    actionButtons.forEach(btn => {
      console.log(`  ${btn.index}. title="${btn.title}" aria-label="${btn.ariaLabel}" visible=${btn.visible}`);
    });

    // 4. 检查设置模态框的触发方式
    console.log('\n[DEBUG] 查找设置模态框的触发方式...');
    
    const settingsTrigger = await page.evaluate(() => {
      // 查找可能触发设置的元素
      const triggers = {
        settingsModalOverlay: !!document.querySelector('[data-testid="settings-modal-overlay"]'),
        dialog: !!document.querySelector('[role="dialog"]'),
        settingsButton: !!document.querySelector('button[title*="设置"], button[title*="Settings"]'),
        settingsLink: !!document.querySelector('a[href*="settings"]'),
      };
      
      // 检查 store 中的 settingsModal 状态
      const store = window.__STORE__?.getState?.();
      if (store) {
        triggers.storeSettingsModal = store.settingsModal;
      }
      
      return triggers;
    });

    console.log('[DEBUG] 设置触发器:', JSON.stringify(settingsTrigger, null, 2));

    // 5. 尝试直接调用 store 动作来打开设置模态框
    console.log('\n[DEBUG] 尝试直接调用 store 动作...');
    
    const storeActionResult = await page.evaluate(() => {
      const store = window.__STORE__;
      if (!store) return { error: 'no store' };
      
      const actions = {
        openSettingsModal: typeof store.openSettingsModal,
        toggleSettingsModal: typeof store.toggleSettingsModal,
        setSettingsModal: typeof store.setSettingsModal,
      };
      
      // 尝试调用 openSettingsModal
      try {
        if (typeof store.openSettingsModal === 'function') {
          store.openSettingsModal();
          return { success: true, actions, called: 'openSettingsModal' };
        } else if (store.getState && typeof store.getState().openSettingsModal === 'function') {
          store.getState().openSettingsModal();
          return { success: true, actions, called: 'getState().openSettingsModal' };
        } else {
          return { success: false, actions, error: 'no openSettingsModal function found' };
        }
      } catch (e) {
        return { success: false, actions, error: e.message };
      }
    });

    console.log('[DEBUG] Store 动作结果:', JSON.stringify(storeActionResult, null, 2));

    // 6. 等待并检查设置模态框是否打开
    await page.waitForTimeout(1000);
    
    const modalAfterStoreAction = await page.$('[data-testid="settings-modal-overlay"], [role="dialog"]');
    if (modalAfterStoreAction) {
      const isOpen = await modalAfterStoreAction.isVisible().catch(() => false);
      console.log(`[DEBUG] 调用 store 动作后，modal 可见: ${isOpen}`);
    } else {
      console.log('[DEBUG] 调用 store 动作后，未找到 modal');
    }

    // 7. 截图
    await page.screenshot({ path: 'D:/tmp/debug-buttons.png', fullPage: true });
    console.log('\n📸 截图保存到 D:/tmp/debug-buttons.png');

  } catch (error) {
    console.error('调试失败:', error);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
