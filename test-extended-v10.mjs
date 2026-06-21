/**
 * 扩展 Playwright 测试 v10 - 直接调用 store 动作
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

  const results = [];

  try {
    await page.goto(VITE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    // ── Test 1: 直接调用 toggleSidebar ─────────────────────────────────
    console.log('\n[TEST 1] 直接调用 toggleSidebar...');
    
    const sidebarInitial = await page.evaluate(() => {
      const sidebar = document.querySelector('.sidebar');
      return sidebar ? window.getComputedStyle(sidebar).display : 'not found';
    });
    
    // 直接调用 store 动作
    await page.evaluate(() => {
      const store = window.__STORE__;
      if (store && store.getState && store.getState().toggleSidebar) {
        store.getState().toggleSidebar();
      }
    });
    await page.waitForTimeout(1500);
    
    const sidebarAfter = await page.evaluate(() => {
      const sidebar = document.querySelector('.sidebar');
      return sidebar ? window.getComputedStyle(sidebar).display : 'not found';
    });
    
    const sidebarToggled = sidebarInitial !== sidebarAfter;
    results.push({
      test: 'toggleSidebar (store)',
      pass: sidebarToggled,
      detail: `初始:${sidebarInitial}, 点击后:${sidebarAfter}`
    });
    
    // 恢复状态
    if (sidebarToggled) {
      await page.evaluate(() => {
        window.__STORE__.getState().toggleSidebar();
      });
      await page.waitForTimeout(1500);
    }

    // ── Test 2: 直接调用 createNewSession ─────────────────────────────────
    console.log('\n[TEST 2] 直接调用 createNewSession...');
    
    const sessionCountBefore = await page.evaluate(() => {
      const store = window.__STORE__?.getState?.();
      return store ? Object.keys(store.chatSessions || {}).length : 0;
    });
    
    // 直接调用 store 动作
    await page.evaluate(() => {
      const store = window.__STORE__;
      if (store && store.getState && store.getState().createNewSession) {
        store.getState().createNewSession();
      }
    });
    await page.waitForTimeout(2000);
    
    const sessionCountAfter = await page.evaluate(() => {
      const store = window.__STORE__?.getState?.();
      return store ? Object.keys(store.chatSessions || {}).length : 0;
    });
    
    const sessionCreated = sessionCountAfter > sessionCountBefore;
    results.push({
      test: 'createNewSession (store)',
      pass: sessionCreated,
      detail: `前:${sessionCountBefore}, 后:${sessionCountAfter}`
    });

    // ── Test 3: 直接调用 openSettingsModal ─────────────────────────────────
    console.log('\n[TEST 3] 直接调用 openSettingsModal...');
    
    // 直接调用 store 动作
    await page.evaluate(() => {
      const store = window.__STORE__;
      if (store && store.getState && store.getState().openSettingsModal) {
        store.getState().openSettingsModal();
      }
    });
    await page.waitForTimeout(1500);
    
    // 检查 modal 是否打开
    const modal = await page.$('[data-testid="settings-modal-overlay"], [role="dialog"]');
    let settingsWorks = false;
    let settingsDetail = '';
    
    if (modal) {
      const isOpen = await modal.isVisible().catch(() => false);
      settingsWorks = isOpen;
      settingsDetail = `modal可见:${isOpen}`;
    } else {
      settingsDetail = '未找到 modal';
    }
    
    results.push({
      test: 'openSettingsModal (store)',
      pass: settingsWorks,
      detail: settingsDetail
    });
    
    // 关闭 modal
    if (settingsWorks) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }

    // ── Test 4: 检查 welcomeVisible 状态 ─────────────────────────────────
    console.log('\n[TEST 4] 检查 welcomeVisible 状态...');
    
    const welcomeVisible = await page.evaluate(() => {
      const store = window.__STORE__?.getState?.();
      return store ? store.welcomeVisible : null;
    });
    
    results.push({
      test: 'welcomeVisible 状态',
      pass: welcomeVisible === true,
      detail: `welcomeVisible:${welcomeVisible}`
    });

    // ── Test 5: 发送消息创建 session ─────────────────────────────────
    console.log('\n[TEST 5] 发送消息创建 session...');
    
    // 确保 welcome 屏幕可见
    const welcomeScreen = await page.$('#welcome');
    if (welcomeScreen) {
      const isVisible = await welcomeScreen.isVisible().catch(() => false);
      if (isVisible) {
        // 查找输入框
        const textarea = await page.$('textarea[placeholder*="消息"], textarea[placeholder*="message"], .input-area textarea');
        if (textarea) {
          await textarea.click();
          await page.waitForTimeout(500);
          await page.keyboard.type('测试消息');
          await page.waitForTimeout(500);
          await page.keyboard.press('Enter');
          await page.waitForTimeout(5000);
          
          // 检查 session 是否创建
          const sessionCountAfterMsg = await page.evaluate(() => {
            const store = window.__STORE__?.getState?.();
            return store ? Object.keys(store.chatSessions || {}).length : 0;
          });
          
          const msgSessionCreated = sessionCountAfterMsg > sessionCountBefore;
          results.push({
            test: '发送消息创建 session',
            pass: msgSessionCreated,
            detail: `发送消息后 session数:${sessionCountAfterMsg}`
          });
        } else {
          results.push({
            test: '发送消息创建 session',
            pass: false,
            detail: '未找到输入框'
          });
        }
      } else {
        results.push({
          test: '发送消息创建 session',
          pass: false,
          detail: 'welcome 屏幕不可见'
        });
      }
    } else {
      results.push({
        test: '发送消息创建 session',
        pass: false,
        detail: '未找到 welcome 屏幕'
      });
    }

    // ── 截图 ─────────────────────────────────
    await page.screenshot({ path: 'D:/tmp/test-v10.png', fullPage: true });
    console.log('\n📷 截图保存到 D:/tmp/test-v10.png');

  } catch (error) {
    console.error('测试执行失败:', error);
    results.push({ test: '测试执行', pass: false, detail: error.message });
  } finally {
    await browser.close();
  }

  // ── 输出结果 ─────────────────────────────────
  console.log('\n' + '='.repeat(60));
  console.log('📊 扩展测试结果 v10');
  console.log('='.repeat(60));

  let passCount = 0;
  results.forEach(r => {
    const icon = r.pass ? '✅' : '❌';
    console.log(`${icon} [${r.test}] ${r.detail}`);
    if (r.pass) passCount++;
  });

  console.log('='.repeat(60));
  console.log(`总计: ${results.length}, 通过: ${passCount}, 失败: ${results.length - passCount}`);
  console.log('='.repeat(60));

  fs.writeFileSync('D:/tmp/test-v10-results.json', JSON.stringify(results, null, 2));
}

main().catch(console.error);
