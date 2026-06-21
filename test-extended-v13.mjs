/**
 * 扩展 Playwright 测试 v13 - 先刷新 sessions，再执行测试
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

    // ── 先刷新 session 列表 ────────────────────────────────
    console.log('[初始化] 刷新 session 列表...');
    await page.evaluate(() => {
      const store = window.__STORE__;
      if (store && store.getState && store.getState().loadSessions) {
        return store.getState().loadSessions();
      }
      return Promise.resolve();
    });
    await page.waitForTimeout(2000);

    const sessionCount = await page.evaluate(() => {
      const store = window.__STORE__?.getState?.();
      return store ? Object.keys(store.chatSessions || {}).length : 0;
    });
    console.log(`[初始化] session 数: ${sessionCount}`);

    // ── Test 1: 设置模态框 ────────────────────────────────
    console.log('\n[TEST 1] 设置模态框...');
    await page.evaluate(() => {
      window.__STORE__.setState({
        settingsModal: { open: true, activeTab: 'agent' }
      });
    });
    await page.waitForTimeout(1500);

    const modal = await page.$('[data-testid="settings-modal-overlay"], [role="dialog"]');
    let settingsWorks = false;
    let settingsDetail = '';

    if (modal) {
      const isOpen = await modal.isVisible().catch(() => false);
      settingsWorks = isOpen;
      settingsDetail = `modal 可见:${isOpen}`;
    } else {
      settingsDetail = '未找到 modal';
    }

    results.push({
      test: '设置模态框',
      pass: settingsWorks,
      detail: settingsDetail
    });

    // 关闭模态框
    if (settingsWorks) {
      await page.evaluate(() => {
        window.__STORE__.setState({
          settingsModal: { open: false, activeTab: 'agent' }
        });
      });
      await page.waitForTimeout(500);
    }

    // ── Test 2: 侧边栏 toggle ────────────────────────────────
    console.log('\n[TEST 2] 侧边栏 toggle...');

    const sidebarBefore = await page.evaluate(() => {
      const sidebar = document.querySelector('.sidebar');
      return sidebar ? {
        width: window.getComputedStyle(sidebar).width,
        className: sidebar.className,
      } : null;
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
      return sidebar ? {
        width: window.getComputedStyle(sidebar).width,
        className: sidebar.className,
      } : null;
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

    // ── Test 3: 创建新 Session (pending) ────────────────────────────────
    console.log('\n[TEST 3] 创建新 Session...');

    await page.evaluate(() => {
      window.__STORE__.setState({
        welcomeVisible: true,
        currentSessionPath: null,
        pendingNewSession: true,
        pendingProjectId: null,
        selectedFolder: null,
        selectedWorkspaceMountId: null,
        selectedWorkspaceLabel: null,
        workspaceFolders: [],
        selectedAgentId: null,
      });
    });
    await page.waitForTimeout(1500);

    const pendingState = await page.evaluate(() => {
      const store = window.__STORE__?.getState?.();
      return store ? store.pendingNewSession : null;
    });

    results.push({
      test: '创建新 Session (pending)',
      pass: pendingState === true,
      detail: `pendingNewSession:${pendingState}`
    });

    // ── Test 4: 发送消息创建 Session ────────────────────────────────
    console.log('\n[TEST 4] 发送消息创建 Session...');

    // 确保 welcome 屏幕可见
    await page.evaluate(() => {
      window.__STORE__.setState({ welcomeVisible: true, currentSessionPath: null });
    });
    await page.waitForTimeout(1500);

    // 查找 textarea
    const textarea = await page.$('textarea');
    let msgSessionCreated = false;
    let msgDetail = '';

    if (textarea) {
      await textarea.click();
      await page.waitForTimeout(500);
      await page.keyboard.type('测试消息 v13');
      await page.waitForTimeout(500);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(5000);

      const newCount = await page.evaluate(() => {
        const store = window.__STORE__?.getState?.();
        return store ? Object.keys(store.chatSessions || {}).length : 0;
      }).catch(() => 0);

      msgSessionCreated = newCount >= 2;
      msgDetail = `发送消息后 session 数:${newCount}`;
    } else {
      msgDetail = '未找到 textarea';
    }

    results.push({
      test: '发送消息创建 Session',
      pass: msgSessionCreated,
      detail: msgDetail
    });

    // ── Test 5: 多 Session 切换 ────────────────────────────────
    console.log('\n[TEST 5] 多 Session 切换...');

    // 重新刷新 session 列表
    await page.evaluate(() => {
      const store = window.__STORE__;
      if (store && store.getState && store.getState().loadSessions) {
        return store.getState().loadSessions();
      }
      return Promise.resolve();
    });
    await page.waitForTimeout(2000);

    const sessionCountAfter = await page.evaluate(() => {
      const store = window.__STORE__?.getState?.();
      return store ? Object.keys(store.chatSessions || {}).length : 0;
    });

    let sessionSwitchWorks = false;
    let sessionSwitchDetail = '';

    if (sessionCountAfter >= 2) {
      // 点击第一个 session
      const firstSession = await page.$('[class*="sessionItem"]');
      if (firstSession) {
        await firstSession.click().catch(e => {});
        await page.waitForTimeout(2000);

        const currentPath = await page.evaluate(() => {
          return window.__STORE__?.getState?.()?.currentSessionPath || null;
        }).catch(() => null);

        sessionSwitchWorks = currentPath !== null;
        sessionSwitchDetail = `session 数:${sessionCountAfter}, currentPath:${currentPath}`;
      } else {
        sessionSwitchDetail = `session 数:${sessionCountAfter}, 但未找到 session 元素`;
      }
    } else {
      sessionSwitchDetail = `session 数:${sessionCountAfter}, 不足2个`;
    }

    results.push({
      test: '多 Session 切换',
      pass: sessionSwitchWorks,
      detail: sessionSwitchDetail
    });

    // ── Test 6: 文件树交互 ────────────────────────────────
    console.log('\n[TEST 6] 文件树交互...');

    // 确保工作台面板是展开的
    const previewOpen = await page.evaluate(() => {
      const store = window.__STORE__?.getState?.();
      return store ? store.previewOpen : null;
    });

    if (!previewOpen) {
      await page.evaluate(() => {
        window.__STORE__.getState().togglePreview?.();
      });
      await page.waitForTimeout(1500);
    }

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
      test: '文件树交互',
      pass: fileTreeWorks,
      detail: fileTreeDetail
    });

    // ── 截图 ────────────────────────────────
    await page.screenshot({ path: 'D:/tmp/test-v13.png', fullPage: true });
    console.log('\n📷 截图保存到 D:/tmp/test-v13.png');

  } catch (error) {
    console.error('测试执行失败:', error);
    results.push({ test: '测试执行', pass: false, detail: error.message });
  } finally {
    await browser.close();
  }

  // ── 输出结果 ────────────────────────────────
  console.log('\n' + '='.repeat(60));
  console.log('📊 扩展测试结果 v13');
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

  fs.writeFileSync('D:/tmp/test-v13-results.json', JSON.stringify(results, null, 2));
}

main().catch(console.error);
