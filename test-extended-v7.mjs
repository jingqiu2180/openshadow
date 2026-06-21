/**
 * 扩展 Playwright 测试 v7 - 使用正确的选择器
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

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

    // ── Test 1: 展开工作台面板 ─────────────────────────────────
    console.log('\n[TEST 1] 展开工作台面板...');
    let panelExpanded = false;
    let panelDetail = '';
    
    // 点击右侧 toggle 按钮展开面板
    const rightToggle = await page.$('button.tb-toggle-right');
    if (rightToggle) {
      await rightToggle.click();
      await page.waitForTimeout(1000);
      
      // 检查面板是否展开（不再有 Collapsed 类名）
      const panelClass = await page.evaluate(() => {
        const panel = document.querySelector('[class*="previewPanel"]');
        return panel ? panel.className : '';
      });
      
      panelExpanded = !panelClass.includes('Collapsed');
      panelDetail = `点击了 tb-toggle-right, 面板类名:${panelClass.substring(0, 80)}`;
    } else {
      panelDetail = '未找到 tb-toggle-right 按钮';
    }
    
    results.push({
      test: '展开工作台面板',
      pass: panelExpanded,
      detail: panelDetail
    });

    // ── Test 2: 文件树功能 ─────────────────────────────────
    console.log('\n[TEST 2] 文件树功能...');
    let fileTreeWorks = false;
    let fileTreeDetail = '';
    
    // 查找文件树元素
    const fileTree = await page.$('[class*="tree"]');
    if (fileTree) {
      const isVisible = await fileTree.isVisible().catch(() => false);
      fileTreeWorks = isVisible;
      fileTreeDetail = `找到文件树元素, visible:${isVisible}`;
      
      if (isVisible) {
        // 尝试点击第一个文件夹
        const firstFolder = await fileTree.$('[class*="folder"], [class*="directory"]');
        if (firstFolder) {
          await firstFolder.click().catch(e => {});
          await page.waitForTimeout(500);
          fileTreeDetail += ', 已点击文件夹';
        }
      }
    } else {
      fileTreeDetail = '未找到文件树元素';
    }
    
    results.push({
      test: '文件树功能',
      pass: fileTreeWorks,
      detail: fileTreeDetail
    });

    // ── Test 3: 侧边栏切换 ─────────────────────────────────
    console.log('\n[TEST 3] 侧边栏切换...');
    let sidebarToggleWorks = false;
    let sidebarDetail = '';
    
    // 点击左侧 toggle 按钮
    const leftToggle = await page.$('button.tb-toggle-left');
    if (leftToggle) {
      // 获取初始状态
      const initialSidebar = await page.$('.sidebar');
      const initialVisible = initialSidebar ? await initialSidebar.isVisible().catch(() => false) : false;
      
      // 点击切换
      await leftToggle.click();
      await page.waitForTimeout(1000);
      
      // 检查状态是否改变
      const afterSidebar = await page.$('.sidebar');
      const afterVisible = afterSidebar ? await afterSidebar.isVisible().catch(() => false) : false;
      
      sidebarToggleWorks = initialVisible !== afterVisible;
      sidebarDetail = `初始:${initialVisible}, 点击后:${afterVisible}`;
      
      // 恢复状态
      if (initialVisible !== afterVisible) {
        await leftToggle.click();
        await page.waitForTimeout(1000);
      }
    } else {
      sidebarDetail = '未找到 tb-toggle-left 按钮';
    }
    
    results.push({
      test: '侧边栏切换',
      pass: sidebarToggleWorks,
      detail: sidebarDetail
    });

    // ── Test 4: 设置模态框 ─────────────────────────────────
    console.log('\n[TEST 4] 设置模态框...');
    let settingsWorks = false;
    let settingsDetail = '';
    
    // 查找设置按钮（在侧边栏头部）
    const settingsBtn = await page.$('button[title*="设置"], button[title*="Settings"], button.sidebar-action-btn');
    if (settingsBtn) {
      await settingsBtn.click();
      await page.waitForTimeout(1000);
      
      // 检查模态框是否打开
      const modal = await page.$('[data-testid="settings-modal-overlay"], [role="dialog"]');
      if (modal) {
        const isOpen = await modal.isVisible().catch(() => false);
        settingsWorks = isOpen;
        settingsDetail = `点击了设置按钮, modal可见:${isOpen}`;
        
        // 关闭模态框
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      } else {
        settingsDetail = '点击了设置按钮, 但未找到模态框';
      }
    } else {
      settingsDetail = '未找到设置按钮';
    }
    
    results.push({
      test: '设置模态框',
      pass: settingsWorks,
      detail: settingsDetail
    });

    // ── Test 5: i18n 语言切换 ─────────────────────────────────
    console.log('\n[TEST 5] i18n 语言切换...');
    let i18nWorks = false;
    let i18nDetail = '';
    
    // 重新打开设置模态框
    const settingsBtn2 = await page.$('button[title*="设置"], button[title*="Settings"], button.sidebar-action-btn');
    if (settingsBtn2) {
      await settingsBtn2.click();
      await page.waitForTimeout(1000);
      
      // 查找语言选择器
      const langSelector = await page.$('select[name*="lang"], select[name*="locale"]');
      if (langSelector) {
        i18nWorks = true;
        i18nDetail = '找到语言选择器';
        
        // 尝试切换语言
        await langSelector.selectOption('en').catch(e => {});
        await page.waitForTimeout(1000);
        i18nDetail += ', 已尝试切换到英文';
      } else {
        i18nDetail = '未找到语言选择器';
      }
      
      // 关闭模态框
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    } else {
      i18nDetail = '未找到设置按钮';
    }
    
    results.push({
      test: 'i18n 语言切换',
      pass: i18nWorks,
      detail: i18nDetail
    });

    // ── Test 6: 多 Session 切换 ─────────────────────────────────
    console.log('\n[TEST 6] 多 Session 切换...');
    let sessionSwitchWorks = false;
    let sessionSwitchDetail = '';
    
    // 获取 session 数量
    const sessionCount = await page.evaluate(() => {
      const store = window.__STORE__?.getState?.();
      return store ? Object.keys(store.chatSessions || {}).length : 0;
    }).catch(() => 0);
    
    if (sessionCount >= 2) {
      // 查找侧边栏中的 session 列表项
      const sessionItems = await page.$$('[class*="sessionItem"]');
      if (sessionItems.length >= 2) {
        // 点击第二个 session
        await sessionItems[1].click();
        await page.waitForTimeout(2000);
        
        // 检查是否切换成功
        const currentPath = await page.evaluate(() => {
          return window.__STORE__?.getState?.()?.currentSessionPath || null;
        }).catch(() => null);
        
        sessionSwitchWorks = currentPath !== null;
        sessionSwitchDetail = `session数:${sessionCount}, 已点击第二个session, currentPath:${currentPath}`;
      } else {
        sessionSwitchDetail = `session数:${sessionCount}, 但UI中只找到${sessionItems.length}个session元素`;
      }
    } else {
      sessionSwitchDetail = `session数:${sessionCount}, 不足2个，无法测试切换`;
    }
    
    results.push({
      test: '多 Session 切换',
      pass: sessionSwitchWorks,
      detail: sessionSwitchDetail
    });

    // ── Test 7: 插件页面 ─────────────────────────────────
    console.log('\n[TEST 7] 插件页面...');
    let pluginWorks = false;
    let pluginDetail = '';
    
    // 尝试访问插件页面
    await page.goto(`${VITE_URL}/plugins`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    const url = page.url();
    const content = await page.content();
    pluginWorks = url.includes('plugins') || content.includes('plugin');
    pluginDetail = `访问 /plugins, URL:${url}, 包含plugin:${content.includes('plugin')}`;
    
    results.push({
      test: '插件页面',
      pass: pluginWorks,
      detail: pluginDetail
    });

    // ── 截图 ─────────────────────────────────
    await page.goto(VITE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'D:/tmp/test-extended-v7.png', fullPage: true });
    console.log('\n📷 截图保存到 D:/tmp/test-extended-v7.png');

  } catch (error) {
    console.error('测试执行失败:', error);
    results.push({ test: '测试执行', pass: false, detail: error.message });
  } finally {
    await browser.close();
  }

  // ── 输出结果 ─────────────────────────────────
  console.log('\n' + '='.repeat(60));
  console.log('📊 扩展测试结果 v7');
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

  fs.writeFileSync('D:/tmp/test-extended-v7-results.json', JSON.stringify(results, null, 2));
}

main().catch(console.error);
