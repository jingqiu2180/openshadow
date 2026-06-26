import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const SS_DIR = 'D:/screenshots/openshadow-ui-audit';
if (!fs.existsSync(SS_DIR)) fs.mkdirSync(SS_DIR, { recursive: true });

const log = (...a) => console.log(`[${new Date().toISOString()}]`, ...a);
const ss = async (page, name) => {
  const fp = path.join(SS_DIR, `${name}.png`);
  await page.screenshot({ path: fp, fullPage: false });
  return fp;
};

(async () => {
  const browser = await chromium.launch({ headless: false, args: ['--window-size=1600,1000'] });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await ctx.newPage();

  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);
  log('=== 产品级 UI 审计开始 ===');

  // 截图 01: 首屏整体
  await ss(page, '01-home');
  log('[01] 首屏整体 ✅');

  // 截图 02: 侧边栏 hover 状态（鼠标移到第一个会话项）
  await page.evaluate(() => {
    const items = document.querySelectorAll('[data-session-path]');
    if (items.length > 0) {
      const ev = new MouseEvent('mouseenter', { bubbles: true, cancelable: true });
      items[0].dispatchEvent(ev);
    }
  });
  await page.waitForTimeout(500);
  await ss(page, '02-sidebar-hover');
  log('[02] 侧边栏 hover 状态 ✅');

  // 截图 03: 右键菜单（上下文菜单）
  await page.evaluate(() => {
    const items = document.querySelectorAll('[data-session-path]');
    if (items.length > 0) {
      const rect = items[0].getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: rect.x + 10, clientY: rect.y + 10 });
        items[0].dispatchEvent(ev);
      }
    }
  });
  await page.waitForTimeout(800);
  await ss(page, '03-context-menu');
  log('[03] 右键菜单 ✅');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // 截图 04: 新建对话按钮 hover
  await page.evaluate(() => {
    const btn = document.querySelector('button[title="新对话"]');
    if (btn) btn.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
  });
  await page.waitForTimeout(500);
  await ss(page, '04-newchat-hover');
  log('[04] 新建对话按钮 hover ✅');

  // 截图 05: 设置面板打开
  await page.evaluate(() => {
    const btn = document.querySelector('button[title="设置"]');
    if (btn) btn.click();
  });
  await page.waitForTimeout(1000);
  await ss(page, '05-settings-open');
  log('[05] 设置面板打开 ✅');

  // 截图 06-15: 设置面板每个选项卡
  const tabs = ['通用', '界面', '模型', 'Agent', '渠道', '插件', 'MCP', '访问', '浏览器', '实验'];
  for (let i = 0; i < tabs.length; i++) {
    await page.evaluate((tabText) => {
      for (const el of document.querySelectorAll('[role="tab"], button, .tab')) {
        if (el.textContent.includes(tabText)) { el.click(); return; }
      }
    }, tabs[i]);
    await page.waitForTimeout(800);
    await ss(page, `06-settings-${i + 1}-${tabs[i]}`);
    log(`[06-${i + 1}] 设置选项卡: ${tabs[i]} ✅`);
  }

  // 关闭设置
  await page.evaluate(() => {
    const closeBtn = document.querySelector('[aria-label="关闭"], button[title="关闭"], .modal-close, [class*="close"]');
    if (closeBtn) closeBtn.click();
  });
  await page.waitForTimeout(500);

  // 截图 16: 模型选择器下拉
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('button, [role="button"]')) {
      if (el.textContent.includes('MiniMax') || el.textContent.includes('M3')) { el.click(); return; }
    }
  });
  await page.waitForTimeout(1200);
  await ss(page, '16-model-dropdown');
  log('[16] 模型选择器下拉 ✅');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // 截图 17: 输入框 focus 状态
  await page.evaluate(() => {
    const editor = document.querySelector('[data-tiptap-editor="true"], .tiptap, [contenteditable="true"]');
    if (editor) { editor.focus(); editor.dispatchEvent(new Event('focus', { bubbles: true })); }
  });
  await page.waitForTimeout(500);
  await ss(page, '17-input-focus');
  log('[17] 输入框 focus 状态 ✅');

  // 截图 18: 文件上传菜单（点击附件按钮）
  await page.evaluate(() => {
    for (const btn of document.querySelectorAll('button')) {
      const svg = btn.querySelector('svg');
      if (svg && btn.className.includes('attach')) { btn.click(); return; }
    }
    // 备选：查找 title 包含"附件"或"上传"的按钮
    for (const btn of document.querySelectorAll('button[title]')) {
      const t = btn.getAttribute('title');
      if (t.includes('附件') || t.includes('上传') || t.includes('文件')) { btn.click(); return; }
    }
  });
  await page.waitForTimeout(800);
  await ss(page, '18-attach-menu');
  log('[18] 附件/上传菜单 ✅');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // 截图 19: 工作区文件树
  await page.evaluate(() => {
    // 查找工作区切换按钮
    for (const btn of document.querySelectorAll('button, [role="button"]')) {
      const t = btn.textContent;
      if (t.includes('工作区') || t.includes('文件') || btn.getAttribute('title')?.includes('工作区')) { btn.click(); return; }
    }
  });
  await page.waitForTimeout(1000);
  await ss(page, '19-workspace');
  log('[19] 工作区文件树 ✅');

  // 截图 20: 渠道切换
  await page.evaluate(() => {
    for (const btn of document.querySelectorAll('button, [role="button"]')) {
      const t = btn.textContent;
      if (t.includes('渠道') || t.includes('频道') || btn.getAttribute('title')?.includes('渠道')) { btn.click(); return; }
    }
  });
  await page.waitForTimeout(1000);
  await ss(page, '20-channel-switcher');
  log('[20] 渠道切换 ✅');

  // 截图 21: 消息操作按钮 hover（鼠标移到第一条助手消息的操作按钮上）
  await page.evaluate(() => {
    const msg = document.querySelector('[data-role="assistant"], .message-assistant, [class*="assistant"]');
    if (msg) {
      const actions = msg.querySelectorAll('button');
      if (actions.length > 0) actions[0].dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    }
  });
  await page.waitForTimeout(500);
  await ss(page, '21-message-actions-hover');
  log('[21] 消息操作按钮 hover ✅');

  // 截图 22: 通知/Toast（触发一个通知）
  await page.evaluate(() => {
    // 尝试触发通知（例如点击一个会显示通知的操作）
    const ws = new WebSocket('ws://localhost:3000/ws');
    ws.onopen = () => ws.send(JSON.stringify({ type: 'ping' }));
  });
  await page.waitForTimeout(1000);
  await ss(page, '22-notification');
  log('[22] 通知/Toast ✅');

  // 截图 23: 滚动条样式
  await page.evaluate(() => window.scrollTo(0, 100));
  await page.waitForTimeout(300);
  await ss(page, '23-scrollbar');
  log('[23] 滚动条样式 ✅');

  // 截图 24: 深色模式（如果支持）
  await page.evaluate(() => {
    document.documentElement.setAttribute('data-theme', 'cool-night');
  });
  await page.waitForTimeout(800);
  await ss(page, '24-dark-mode');
  log('[24] 深色模式 ✅');

  // 恢复浅色模式
  await page.evaluate(() => {
    document.documentElement.setAttribute('data-theme', 'warm-paper');
  });
  await page.waitForTimeout(500);

  // 截图 25: 响应式 — 窄屏 (800px)
  await page.setViewportSize({ width: 800, height: 900 });
  await page.waitForTimeout(800);
  await ss(page, '25-responsive-800');
  log('[25] 响应式 800px ✅');

  // 截图 26: 响应式 — 宽屏 (1920px)
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.waitForTimeout(800);
  await ss(page, '26-responsive-1920');
  log('[26] 响应式 1920px ✅');

  // 恢复默认尺寸
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.waitForTimeout(500);

  await ss(page, '99-final');
  log('\n=== UI 审计完成 ===');
  log(`截图保存在: ${SS_DIR}`);
  log('请对比 openhanako 对应界面，找出差异并修复。');

  await page.waitForTimeout(3000);
  await browser.close();
})();
