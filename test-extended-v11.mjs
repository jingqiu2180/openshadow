/**
 * 扩展 Playwright 测试 v11 - 修复检查逻辑 + 正确调用函数
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

    // ── Test 1: 侧边栏 toggle（检查 width 或类名）────────────────────────────
    console.log('\n[TEST 1] 侧边栏 toggle...');
    
    const sidebarBefore = await page.evaluate(() => {
      const sidebar = document.querySelector('.sidebar');
      if (!sidebar) return null;
      return {
        width: window.getComputedStyle(sidebar).width,
        className: sidebar.className,
        hasCollapsed: sidebar.className.includes('collapsed'),
      };
    });
    
    // 点击左侧 toggle 按钮
    await page.evaluate(() => {
      const store = window.__STORE__;
      if (store && store.getState && store.getState().toggleSidebar) {
        store.getState().toggleSidebar();
      }
    });
    await page.waitForTimeout(1500);
    
    const sidebarAfter = await page.evaluate(() => {
      const sidebar = document.querySelector('.sidebar');
      if (!sidebar) return null;
      return {
        width: window.getComputedStyle(sidebar).width,
        className: sidebar.className,
        hasCollapsed: sidebar.className.includes('collapsed'),
      };
    });
    
    const sidebarToggled = JSON.stringify(sidebarBefore) !== JSON.stringify(sidebarAfter);
    results.push({
      test: '侧边栏 toggle',
      pass: sidebarToggled,
      detail: `前:${JSON.stringify(sidebarBefore)}, 后:${JSON.stringify(sidebarAfter)}`
    });
    
    // 恢复状态
    if (sidebarToggled) {
      await page.evaluate(() => {
        window.__STORE__.getState().toggleSidebar();
      });
      await page.waitForTimeout(1500);
    }

    // ── Test 2: 创建新 Session ─────────────────────────────
    console.log('\n[TEST 2] 创建新 Session...');
    
    const sessionCountBefore = await page.evaluate(() => {
      const store = window.__STORE__?.getState?.();
      return store ? Object.keys(store.chatSessions || {}).length : 0;
    });
    
    // 调用 createNewSession（从 session-actions 模块）
    // 注意：这个函数不会立即创建 session，只是设置 pendingNewSession: true
    await page.evaluate(() => {
      // 尝试调用 window 上的函数（如果有的话）
      if (typeof window.createNewSession === 'function') {
        window.createNewSession();
      } else {
        // 否则直接调用 store 动作（如果挂载了的话）
        const store = window.__STORE__;
        if (store && store.getState && store.getState().createNewSession) {
          store.getState().createNewSession();
        }
      }
    });
    await page.waitForTimeout(2000);
    
    const pendingNewSession = await page.evaluate(() => {
      const store = window.__STORE__?.getState?.();
      return store ? store.pendingNewSession : null;
    });
    
    // createNewSession() 应该设置 pendingNewSession: true
    // 但不会立即创建 session（需要发送第一条消息时才会创建）
    results.push({
      test: '创建新 Session (pending)',
      pass: pendingNewSession === true,
      detail: `前session数:${sessionCountBefore}, pendingNewSession:${pendingNewSession}`
    });

    // ── Test 3: 设置模态框 ─────────────────────────────
    console.log('\n[TEST 3] 设置模态框...');
    
    // 直接调用 store 动作
    await page.evaluate(() => {
      const store = window.__STORE__;
      if (store && store.getState && store.getState().openSettingsModal) {
        store.getState().openSettingsModal();
      }
    });
    await page.waitForTimeout(1500);
    
    // 检查模态框是否打开
    const modal = await page.$('[data-testid="settings-modal-overlay"], [role="dialog"]');
    let settingsWorks = false;
    let settingsDetail = '';
    
    if (modal) {
      const isOpen = await modal.isVisible().catch(() => false);
      settingsWorks = isOpen;
      settingsDetail = `modal可见:${isOpen}`;
    } else {
      // 检查 store 状态
      const settingsModalState = await page.evaluate(() => {
        const store = window.__STORE__?.getState?.();
        return store ? store.settingsModal : null;
      });
      settingsDetail = `未找到modal, store状态:${JSON.stringify(settingsModalState)}`;
    }
    
    results.push({
      test: '设置模态框',
      pass: settingsWorks,
      detail: settingsDetail
    });
    
    // 关闭模态框
    if (settingsWorks) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }

    // ── Test 4: 文件树可见性 ─────────────────────────────
    console.log('\n[TEST 4] 文件树可见性...');
    
    // 确保工作台面板是展开的（点击右侧 toggle 按钮）
    await page.evaluate(() => {
      const store = window.__STORE__;
      if (store && store.getState && store.getState().togglePreview) {
        // 如果面板是折叠的，展开它
        const state = store.getState();
        if (!state.previewOpen) {
          store.getState().togglePreview();
        }
      }
    });
    await page.waitForTimeout(1000);
    
    const fileTree = await page.$('[class*="tree"]');
    let fileTreeWorks = false;
    let fileTreeDetail = '';
    
    if (fileTree) {
      const isVisible = await fileTree.isVisible().catch(() => false);
      fileTreeWorks = isVisible;
      fileTreeDetail = `找到文件树, visible:${isVisible}`;
    } else {
      fileTreeDetail = '未找到文件树元素';
    }
    
    results.push({
      test: '文件树可见',
      pass: fileTreeWorks,
      detail: fileTreeDetail
    });

    // ── Test 5: 多 Session 切换 ─────────────────────────────
    console.log('\n[TEST 5] 多 Session 切换...');
    
    const sessionCount = await page.evaluate(() => {
      const store = window.__STORE__?.getState?.();
      return store ? Object.keys(store.chatSessions || {}).length : 0;
    });
    
    let sessionSwitchWorks = false;
    let sessionSwitchDetail = '';
    
    if (sessionCount >= 2) {
      // 点击第一个 session
      const firstSession = await page.$('[class*="sessionItem"]');
      if (firstSession) {
        await firstSession.click().catch(e => {});
        await page.waitForTimeout(2000);
        
        const currentPath = await page.evaluate(() => {
          return window.__STORE__?.getState?.()?.currentSessionPath || null;
        }).catch(() => null);
        
        sessionSwitchWorks = currentPath !== null;
        sessionSwitchDetail = `session数:${sessionCount}, currentPath:${currentPath}`;
      } else {
        sessionSwitchDetail = `session数:${sessionCount}, 但未找到session元素`;
      }
    } else {
      sessionSwitchDetail = `session数:${sessionCount}, 不足2个`;
    }
    
    results.push({
      test: '多 Session 切换',
      pass: sessionSwitchWorks,
      detail: sessionSwitchDetail
    });

    // ── 截图 ─────────────────────────────
    await page.screenshot({ path: 'D:/tmp/test-v11.png', fullPage: true });
    console.log('\n📷 截图保存到 D:/tmp/test-v11.png');

  } catch (error) {
    console.error('测试执行失败:', error);
    results.push({ test: '测试执行', pass: false, detail: error.message });
  } finally {
    await browser.close();
  }

  // ── 输出结果 ─────────────────────────────
  console.log('\n' + '='.repeat(60));
  console.log('📊 扩展测试结果 v11');
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

  fs.writeFileSync('D:/tmp/test-v11-results.json', JSON.stringify(results, null, 2));
}

main().catch(console.error);
