/**
 * 扩展 Playwright 测试 v8 - 使用 force click 和更简单的逻辑
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

    // ── Test 1: 检查基本 UI 元素 ─────────────────────────────────
    console.log('\n[TEST 1] 检查基本 UI 元素...');
    
    const uiElements = await page.evaluate(() => {
      const elements = {
        titlebar: !!document.querySelector('.titlebar'),
        sidebar: !!document.querySelector('.sidebar'),
        mainContent: !!document.querySelector('.main-content'),
        chatArea: !!document.querySelector('.chat-area'),
        inputArea: !!document.querySelector('.input-area'),
        tbLeft: !!document.querySelector('.tb-toggle-left'),
        tbRight: !!document.querySelector('.tb-toggle-right'),
        fileTree: !!document.querySelector('[class*="tree"]'),
      };
      return elements;
    });
    
    const allPresent = Object.values(uiElements).every(v => v);
    results.push({
      test: '基本 UI 元素',
      pass: allPresent,
      detail: JSON.stringify(uiElements)
    });

    // ── Test 2: 强制点击侧边栏 toggle ─────────────────────────────────
    console.log('\n[TEST 2] 侧边栏 toggle...');
    
    const sidebarInitial = await page.evaluate(() => {
      const sidebar = document.querySelector('.sidebar');
      return sidebar ? window.getComputedStyle(sidebar).display !== 'none' : false;
    });
    
    // 使用 force: true 强制点击
    await page.click('.tb-toggle-left', { force: true }).catch(e => {
      console.log('[TEST 2] 点击失败:', e.message);
    });
    await page.waitForTimeout(1000);
    
    const sidebarAfter = await page.evaluate(() => {
      const sidebar = document.querySelector('.sidebar');
      return sidebar ? window.getComputedStyle(sidebar).display !== 'none' : false;
    });
    
    const sidebarToggled = sidebarInitial !== sidebarAfter;
    results.push({
      test: '侧边栏 toggle',
      pass: sidebarToggled,
      detail: `初始:${sidebarInitial}, 点击后:${sidebarAfter}`
    });
    
    // 恢复侧边栏状态
    if (sidebarToggled) {
      await page.click('.tb-toggle-left', { force: true }).catch(() => {});
      await page.waitForTimeout(1000);
    }

    // ── Test 3: 强制点击工作台面板 toggle ─────────────────────────────────
    console.log('\n[TEST 3] 工作台面板 toggle...');
    
    const panelInitial = await page.evaluate(() => {
      const panel = document.querySelector('[class*="previewPanel"]');
      if (!panel) return false;
      return panel.className.includes('Collapsed');
    });
    
    await page.click('.tb-toggle-right', { force: true }).catch(e => {
      console.log('[TEST 3] 点击失败:', e.message);
    });
    await page.waitForTimeout(1000);
    
    const panelAfter = await page.evaluate(() => {
      const panel = document.querySelector('[class*="previewPanel"]');
      if (!panel) return false;
      return panel.className.includes('Collapsed');
    });
    
    const panelToggled = panelInitial !== panelAfter;
    results.push({
      test: '工作台面板 toggle',
      pass: panelToggled,
      detail: `初始Collapsed:${panelInitial}, 点击后Collapsed:${panelAfter}`
    });
    
    // 恢复面板状态
    if (panelToggled) {
      await page.click('.tb-toggle-right', { force: true }).catch(() => {});
      await page.waitForTimeout(1000);
    }

    // ── Test 4: 文件树可见性 ─────────────────────────────────
    console.log('\n[TEST 4] 文件树可见性...');
    
    // 确保面板是展开的
    const panelCollapsed = await page.evaluate(() => {
      const panel = document.querySelector('[class*="previewPanel"]');
      return panel ? panel.className.includes('Collapsed') : true;
    });
    
    if (panelCollapsed) {
      await page.click('.tb-toggle-right', { force: true }).catch(() => {});
      await page.waitForTimeout(1000);
    }
    
    const fileTreeVisible = await page.evaluate(() => {
      const tree = document.querySelector('[class*="tree"]');
      return tree ? tree.checkVisibility() : false;
    });
    
    results.push({
      test: '文件树可见',
      pass: fileTreeVisible,
      detail: `文件树可见:${fileTreeVisible}`
    });

    // ── Test 5: 设置按钮（使用 force） ─────────────────────────────────
    console.log('\n[TEST 5] 设置按钮...');
    
    // 先按 Escape 确保没有 modal 打开
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    
    // 查找设置按钮（可能有多个，找第一个可见的）
    const settingsBtn = await page.$('button[title*="设置"], button[title*="Settings"], .sidebar-action-btn');
    let settingsWorks = false;
    let settingsDetail = '';
    
    if (settingsBtn) {
      await settingsBtn.click({ force: true }).catch(e => {
        console.log('[TEST 5] 点击设置按钮失败:', e.message);
      });
      await page.waitForTimeout(1000);
      
      // 检查 modal 是否打开
      const modal = await page.$('[role="dialog"], [data-testid="settings-modal-overlay"]');
      if (modal) {
        const isOpen = await modal.isVisible().catch(() => false);
        settingsWorks = isOpen;
        settingsDetail = `点击了设置按钮, modal可见:${isOpen}`;
        
        // 关闭 modal
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      } else {
        settingsDetail = '点击了设置按钮, 但未找到 modal';
      }
    } else {
      settingsDetail = '未找到设置按钮';
    }
    
    results.push({
      test: '设置按钮',
      pass: settingsWorks,
      detail: settingsDetail
    });

    // ── Test 6: 多 Session 切换 ─────────────────────────────────
    console.log('\n[TEST 6] 多 Session 切换...');
    
    const sessionCount = await page.evaluate(() => {
      const store = window.__STORE__?.getState?.();
      return store ? Object.keys(store.chatSessions || {}).length : 0;
    }).catch(() => 0);
    
    let sessionSwitchWorks = false;
    let sessionSwitchDetail = '';
    
    if (sessionCount >= 2) {
      // 点击第一个 session
      const firstSession = await page.$('[class*="sessionItem"]');
      if (firstSession) {
        await firstSession.click({ force: true }).catch(e => {});
        await page.waitForTimeout(2000);
        
        const currentPath = await page.evaluate(() => {
          return window.__STORE__?.getState?.()?.currentSessionPath || null;
        }).catch(() => null);
        
        sessionSwitchWorks = currentPath !== null;
        sessionSwitchDetail = `session数:${sessionCount}, currentPath:${currentPath}`;
      } else {
        sessionSwitchDetail = `session数:${sessionCount}, 但未找到 session 元素`;
      }
    } else {
      sessionSwitchDetail = `session数:${sessionCount}, 不足2个`;
    }
    
    results.push({
      test: '多 Session 切换',
      pass: sessionSwitchWorks,
      detail: sessionSwitchDetail
    });

    // ── 截图 ────────────────────────────────
    await page.screenshot({ path: 'D:/tmp/test-v8.png', fullPage: true });
    console.log('\n📷 截图保存到 D:/tmp/test-v8.png');

  } catch (error) {
    console.error('测试执行失败:', error);
    results.push({ test: '测试执行', pass: false, detail: error.message });
  } finally {
    await browser.close();
  }

  // ── 输出结果 ────────────────────────────────
  console.log('\n' + '='.repeat(60));
  console.log('📊 扩展测试结果 v8');
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

  fs.writeFileSync('D:/tmp/test-v8-results.json', JSON.stringify(results, null, 2));
}

main().catch(console.error);
