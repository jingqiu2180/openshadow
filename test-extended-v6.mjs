/**
 * 扩展 Playwright 测试 v6 - 覆盖更多功能
 * 测试：文件树、插件页面、i18n、设置模态框标签页、侧边栏切换
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

    // ── Test 1: 文件树功能 ──────────────────────────────────
    console.log('\n[TEST 1] 文件树功能...');
    let fileTreeVisible = false;
    let fileTreeDetail = '';
    
    // 先确保工作台面板是展开的（不是折叠的）
    const collapsedPanel = await page.$('[class*="previewPanelCollapsed"]');
    if (collapsedPanel) {
      console.log('[TEST 1] 展开工作台面板...');
      await collapsedPanel.click();
      await page.waitForTimeout(1000);
    }
    
    // 查找文件树容器
    const fileTree = await page.$('[class*="fileTree"], [class*="tree"], [data-testid="file-tree"]');
    if (fileTree) {
      fileTreeVisible = await fileTree.isVisible().catch(() => false);
      fileTreeDetail = `找到文件树元素, visible:${fileTreeVisible}`;
      
      if (fileTreeVisible) {
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
      pass: fileTreeVisible,
      detail: fileTreeDetail
    });

    // ── Test 2: 插件页面 ──────────────────────────────────
    console.log('\n[TEST 2] 插件页面...');
    let pluginPageAccessible = false;
    let pluginDetail = '';
    
    // 尝试导航到插件页面（可能通过侧边栏或菜单）
    const pluginLink = await page.$('a[href*="plugin"], button:has-text("插件"), button:has-text("Plugin")');
    if (pluginLink) {
      await pluginLink.click();
      await page.waitForTimeout(2000);
      const url = page.url();
      pluginPageAccessible = url.includes('plugin');
      pluginDetail = `点击插件链接, URL:${url}`;
    } else {
      // 尝试直接访问插件页面
      await page.goto(`${VITE_URL}/plugins`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      const content = await page.content();
      pluginPageAccessible = content.includes('plugin') || content.includes('插件');
      pluginDetail = `直接访问 /plugins, 可访问:${pluginPageAccessible}`;
    }
    
    results.push({
      test: '插件页面',
      pass: pluginPageAccessible,
      detail: pluginDetail
    });

    // ── Test 3: i18n 中英文切换 ──────────────────────────────────
    console.log('\n[TEST 3] i18n 中英文切换...');
    let i18nWorks = false;
    let i18nDetail = '';
    
    // 打开设置模态框
    const settingsBtn = await page.$('button[class*="settings"], button:has-text("设置"), button:has-text("Settings")');
    if (settingsBtn) {
      await settingsBtn.click();
      await page.waitForTimeout(1000);
      
      // 查找语言选择器
      const langSelector = await page.$('select[name*="lang"], select[name*="locale"], button:has-text("中文"), button:has-text("English")');
      if (langSelector) {
        i18nWorks = true;
        i18nDetail = '找到语言选择器';
        
        // 尝试切换语言
        if (langSelector.tagName === 'SELECT') {
          await langSelector.selectOption('en').catch(e => {});
        } else {
          await langSelector.click().catch(e => {});
        }
        await page.waitForTimeout(1000);
        i18nDetail += ', 已尝试切换语言';
      } else {
        i18nDetail = '未找到语言选择器';
      }
      
      // 关闭设置模态框
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    } else {
      i18nDetail = '未找到设置按钮';
    }
    
    results.push({
      test: 'i18n 中英文切换',
      pass: i18nWorks,
      detail: i18nDetail
    });

    // ── Test 4: 设置模态框标签页切换 ──────────────────────────────────
    console.log('\n[TEST 4] 设置模态框标签页...');
    let settingsTabsWork = false;
    let settingsTabsDetail = '';
    
    // 重新打开设置模态框
    const settingsBtn2 = await page.$('button[class*="settings"], button:has-text("设置"), button:has-text("Settings")');
    if (settingsBtn2) {
      await settingsBtn2.click();
      await page.waitForTimeout(1000);
      
      // 查找标签页按钮
      const tabButtons = await page.$$('[role="tab"], button[class*="tab"]');
      if (tabButtons.length > 0) {
        settingsTabsWork = true;
        settingsTabsDetail = `找到 ${tabButtons.length} 个标签页按钮`;
        
        // 尝试点击第二个标签页
        if (tabButtons.length > 1) {
          await tabButtons[1].click().catch(e => {});
          await page.waitForTimeout(500);
          settingsTabsDetail += ', 已点击第二个标签页';
        }
      } else {
        settingsTabsDetail = '未找到标签页按钮';
      }
      
      // 关闭设置模态框
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    } else {
      settingsTabsDetail = '未找到设置按钮';
    }
    
    results.push({
      test: '设置模态框标签页',
      pass: settingsTabsWork,
      detail: settingsTabsDetail
    });

    // ── Test 5: 侧边栏切换 ──────────────────────────────────
    console.log('\n[TEST 5] 侧边栏切换...');
    let sidebarToggleWorks = false;
    let sidebarDetail = '';
    
    // 查找侧边栏切换按钮
    const sidebarToggleBtn = await page.$('button[class*="sidebar"][class*="toggle"], button[aria-label*="sidebar"], button:has-text("侧边栏")');
    if (sidebarToggleBtn) {
      // 获取初始状态
      const initialSidebar = await page.$('[class*="sidebar"][class*="open"], [class*="sidebar"][class*="visible"]');
      const initialVisible = initialSidebar ? await initialSidebar.isVisible().catch(() => false) : false;
      
      // 点击切换
      await sidebarToggleBtn.click();
      await page.waitForTimeout(1000);
      
      // 检查状态是否改变
      const afterSidebar = await page.$('[class*="sidebar"][class*="open"], [class*="sidebar"][class*="visible"]');
      const afterVisible = afterSidebar ? await afterSidebar.isVisible().catch(() => false) : false;
      
      sidebarToggleWorks = initialVisible !== afterVisible;
      sidebarDetail = `初始:${initialVisible}, 点击后:${afterVisible}`;
      
      // 恢复状态
      if (initialVisible !== afterVisible) {
        await sidebarToggleBtn.click();
        await page.waitForTimeout(1000);
      }
    } else {
      sidebarDetail = '未找到侧边栏切换按钮';
    }
    
    results.push({
      test: '侧边栏切换',
      pass: sidebarToggleWorks,
      detail: sidebarDetail
    });

    // ── Test 6: 工作台面板功能 ──────────────────────────────────
    console.log('\n[TEST 6] 工作台面板功能...');
    let deskPanelWorks = false;
    let deskDetail = '';
    
    // 查找工作台面板中的可交互元素
    const deskPanel = await page.$('[class*="previewPanel"], [class*="desk"]');
    if (deskPanel) {
      const isVisible = await deskPanel.isVisible().catch(() => false);
      if (isVisible) {
        // 查找面板中的按钮或链接
        const panelButtons = await deskPanel.$$('button, a');
        deskPanelWorks = panelButtons.length > 0;
        deskDetail = `面板可见, 找到 ${panelButtons.length} 个可交互元素`;
        
        // 尝试点击第一个按钮
        if (panelButtons.length > 0) {
          await panelButtons[0].click().catch(e => {});
          await page.waitForTimeout(500);
          deskDetail += ', 已点击第一个按钮';
        }
      } else {
        deskDetail = '面板不可见';
      }
    } else {
      deskDetail = '未找到工作台面板';
    }
    
    results.push({
      test: '工作台面板功能',
      pass: deskPanelWorks,
      detail: deskDetail
    });

    // ── Test 7: 多 Session 切换 ──────────────────────────────────
    console.log('\n[TEST 7] 多 Session 切换...');
    let sessionSwitchWorks = false;
    let sessionSwitchDetail = '';
    
    // 获取当前 session 数量
    const sessionCount = await page.evaluate(() => {
      const store = window.__STORE__?.getState?.();
      return store ? Object.keys(store.chatSessions || {}).length : 0;
    }).catch(() => 0);
    
    if (sessionCount >= 2) {
      // 查找侧边栏中的 session 列表
      const sessionItems = await page.$$('[class*="session"], [class*="chat-item"]');
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

    // ── 截图 ──────────────────────────────────
    await page.screenshot({ path: 'D:/tmp/test-extended.png' });
    console.log('\n📷 截图保存到 D:/tmp/test-extended.png');

  } catch (error) {
    console.error('测试执行失败:', error);
    results.push({ test: '测试执行', pass: false, detail: error.message });
  } finally {
    await browser.close();
  }

  // ── 输出结果 ──────────────────────────────────
  console.log('\n' + '='.repeat(60));
  console.log('📊 扩展测试结果');
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

  fs.writeFileSync('D:/tmp/test-extended-results.json', JSON.stringify(results, null, 2));
}

main().catch(console.error);
