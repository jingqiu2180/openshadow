/**
 * 扩展 Playwright 测试 v9 - 使用正确的选择器和方法
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

    // ── Test 1: 点击设置按钮 ────────────────────────────────
    console.log('\n[TEST 1] 点击设置按钮...');
    
    // 先确保没有 modal 打开
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    
    // 使用正确的选择器
    const settingsBtn = await page.$('button[title="设置"]');
    let settingsWorks = false;
    let settingsDetail = '';
    
    if (settingsBtn) {
      // 滚动到按钮位置
      await settingsBtn.scrollIntoViewIfNeeded().catch(() => {});
      await page.waitForTimeout(500);
      
      // 正常点击（不使用 force）
      await settingsBtn.click().catch(e => {
        console.log('[TEST 1] 点击失败:', e.message);
      });
      await page.waitForTimeout(1500);
      
      // 检查 modal 是否打开
      const modal = await page.$('[data-testid="settings-modal-overlay"], [role="dialog"]');
      if (modal) {
        const isOpen = await modal.isVisible().catch(() => false);
        settingsWorks = isOpen;
        settingsDetail = `点击了设置按钮, modal可见:${isOpen}`;
      } else {
        settingsDetail = '点击了设置按钮, 但未找到 modal';
      }
    } else {
      settingsDetail = '未找到 button[title="设置"]';
    }
    
    results.push({
      test: '设置按钮',
      pass: settingsWorks,
      detail: settingsDetail
    });

    // ── Test 2: 点击侧边栏 toggle ────────────────────────────────
    console.log('\n[TEST 2] 侧边栏 toggle...');
    
    // 关闭可能打开的 modal
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    
    const sidebarInitial = await page.evaluate(() => {
      const sidebar = document.querySelector('.sidebar');
      if (!sidebar) return null;
      return {
        display: window.getComputedStyle(sidebar).display,
        visible: sidebar.checkVisibility(),
      };
    });
    
    const leftToggle = await page.$('button.tb-toggle-left');
    if (leftToggle) {
      await leftToggle.scrollIntoViewIfNeeded().catch(() => {});
      await page.waitForTimeout(500);
      await leftToggle.click().catch(e => {
        console.log('[TEST 2] 点击失败:', e.message);
      });
      await page.waitForTimeout(1500);
    }
    
    const sidebarAfter = await page.evaluate(() => {
      const sidebar = document.querySelector('.sidebar');
      if (!sidebar) return null;
      return {
        display: window.getComputedStyle(sidebar).display,
        visible: sidebar.checkVisibility(),
      };
    });
    
    const sidebarToggled = JSON.stringify(sidebarInitial) !== JSON.stringify(sidebarAfter);
    results.push({
      test: '侧边栏 toggle',
      pass: sidebarToggled,
      detail: `初始:${JSON.stringify(sidebarInitial)}, 点击后:${JSON.stringify(sidebarAfter)}`
    });

    // ── Test 3: 点击书桌面板 toggle ────────────────────────────────
    console.log('\n[TEST 3] 书桌面板 toggle...');
    
    const panelInitial = await page.evaluate(() => {
      const panel = document.querySelector('[class*="previewPanel"]');
      if (!panel) return null;
      return {
        className: panel.className.substring(0, 100),
        collapsed: panel.className.includes('Collapsed'),
      };
    });
    
    const rightToggle = await page.$('button.tb-toggle-right');
    if (rightToggle) {
      await rightToggle.scrollIntoViewIfNeeded().catch(() => {});
      await page.waitForTimeout(500);
      await rightToggle.click().catch(e => {
        console.log('[TEST 3] 点击失败:', e.message);
      });
      await page.waitForTimeout(1500);
    }
    
    const panelAfter = await page.evaluate(() => {
      const panel = document.querySelector('[class*="previewPanel"]');
      if (!panel) return null;
      return {
        className: panel.className.substring(0, 100),
        collapsed: panel.className.includes('Collapsed'),
      };
    });
    
    const panelToggled = JSON.stringify(panelInitial) !== JSON.stringify(panelAfter);
    results.push({
      test: '书桌面板 toggle',
      pass: panelToggled,
      detail: `初始:${JSON.stringify(panelInitial)}, 点击后:${JSON.stringify(panelAfter)}`
    });

    // ── Test 4: 文件树交互 ────────────────────────────────
    console.log('\n[TEST 4] 文件树交互...');
    
    // 确保书桌面板是展开的
    const panelCollapsed = await page.evaluate(() => {
      const panel = document.querySelector('[class*="previewPanel"]');
      return panel ? panel.className.includes('Collapsed') : true;
    });
    
    if (panelCollapsed && rightToggle) {
      await rightToggle.click().catch(() => {});
      await page.waitForTimeout(1500);
    }
    
    const fileTree = await page.$('[class*="tree"]');
    let fileTreeWorks = false;
    let fileTreeDetail = '';
    
    if (fileTree) {
      const isVisible = await fileTree.isVisible().catch(() => false);
      if (isVisible) {
        // 尝试点击第一个文件夹
        const firstFolder = await fileTree.$('[class*="folder"], [class*="directory"]');
        if (firstFolder) {
          await firstFolder.click().catch(e => {});
          await page.waitForTimeout(500);
          fileTreeWorks = true;
          fileTreeDetail = '找到文件树, 已点击文件夹';
        } else {
          fileTreeWorks = true;
          fileTreeDetail = '找到文件树, 但未找到文件夹元素';
        }
      } else {
        fileTreeDetail = '文件树不可见';
      }
    } else {
      fileTreeDetail = '未找到文件树元素';
    }
    
    results.push({
      test: '文件树交互',
      pass: fileTreeWorks,
      detail: fileTreeDetail
    });

    // ── Test 5: 创建第二个 session ────────────────────────────────
    console.log('\n[TEST 5] 创建第二个 session...');
    
    // 点击"新对话"按钮
    const newChatBtn = await page.$('button[title="新对话"]');
    let sessionCreated = false;
    let sessionDetail = '';
    
    if (newChatBtn) {
      await newChatBtn.click().catch(e => {});
      await page.waitForTimeout(2000);
      
      // 检查 session 数量是否增加
      const newCount = await page.evaluate(() => {
        const store = window.__STORE__?.getState?.();
        return store ? Object.keys(store.chatSessions || {}).length : 0;
      }).catch(() => 0);
      
      sessionCreated = newCount >= 2;
      sessionDetail = `新session数:${newCount}`;
    } else {
      sessionDetail = '未找到"新对话"按钮';
    }
    
    results.push({
      test: '创建第二个 session',
      pass: sessionCreated,
      detail: sessionDetail
    });

    // ── Test 6: Session 切换 ────────────────────────────────
    console.log('\n[TEST 6] Session 切换...');
    
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
      test: 'Session 切换',
      pass: sessionSwitchWorks,
      detail: sessionSwitchDetail
    });

    // ── 截图 ────────────────────────────────
    await page.screenshot({ path: 'D:/tmp/test-v9.png', fullPage: true });
    console.log('\n📷 截图保存到 D:/tmp/test-v9.png');

  } catch (error) {
    console.error('测试执行失败:', error);
    results.push({ test: '测试执行', pass: false, detail: error.message });
  } finally {
    await browser.close();
  }

  // ── 输出结果 ────────────────────────────────
  console.log('\n' + '='.repeat(60));
  console.log('📊 扩展测试结果 v9');
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

  fs.writeFileSync('D:/tmp/test-v9-results.json', JSON.stringify(results, null, 2));
}

main().catch(console.error);
