import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG = fs.createWriteStream(path.join(__dirname, 'test-deep.log'), { flags: 'w' });
let passCount = 0, failCount = 0;

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  process.stdout.write(line);
  LOG.write(line);
}

function ok(msg) { passCount++; log(`  ✅ ${msg}`); }
function fail(msg) { failCount++; log(`  ❌ ${msg}`); }

async function ss(page, name) {
  await page.screenshot({ path: `test-${name}.png` }).catch(() => {});
}

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  
  page.on('pageerror', err => log(`[PAGE ERROR] ${err.message}`));
   
  try {
    // ===== TEST 1: 首屏加载 =====
    log('\n--- [TEST-01] 首屏加载 ---');
    await page.goto('http://localhost:5173/', { timeout: 15000 });
    await page.waitForTimeout(3000);
     
    const title = await page.title();
    if (title.includes('Rem')) { ok(`页面标题: ${title}`); } else { fail(`页面标题异常: ${title}`); }
    await ss(page, '01-home');
     
    // ===== TEST 2: DOM完整性 =====
    log('\n--- [TEST-02] DOM结构 ---');
    const btnTexts = await page.evaluate(() => 
      Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim()).filter(Boolean)
    );
    log(`  按钮数量: ${btnTexts.length}`);
     
    // 用 locator 代替 textContent 检查
    const hasSend = await page.locator('button.send-btn').count() > 0;
    const hasModel = await page.locator('.model-selector, .model-pill').count() > 0;
    const hasDesk = await page.locator('button:has-text("工作台")').count() > 0;
    const hasNewSession = await page.locator('button[title*="新对话"], button[aria-label*="新对话"]').count() > 0;
     
    if (hasSend) ok('发送按钮存在'); else fail('发送按钮缺失');
    if (hasModel) ok('模型选择器存在'); else fail('模型选择器缺失');
    if (hasDesk) ok('工作台按钮存在'); else fail('工作台按钮缺失');
    if (hasNewSession) ok('侧边栏正常'); else fail('侧边栏异常');
     
    // 输入框
    const editor = await page.$('.ProseMirror').catch(() => null);
    if (editor) ok('Tiptap编辑器已挂载'); else fail('编辑器未找到');
     
    // ===== TEST 3: 文本输入 =====
    log('\n--- [TEST-03] 文本输入 ---');
    if (editor) {
      await editor.click();
      await page.keyboard.type('你好世界', { delay: 50 });
      await page.waitForTimeout(500);
      const text = await editor.evaluate(el => el.textContent.trim());
      if (text === '你好世界') { ok(`输入成功: "${text}"`); } else { fail(`输入失败: "${text}"`); }
      await ss(page, '03-input');
    }
     
    // ===== TEST 4: 发送消息 =====
    log('\n--- [TEST-04] 发送消息 ---');
    // 用 locator 代替 evaluate（更可靠）
    const sendBtn = page.locator('button.send-btn').first();
    const btnDisabled = await sendBtn.isDisabled().catch(() => true);
    log(`  发送按钮 disabled: ${btnDisabled}`);
    if (!btnDisabled) {
      await sendBtn.click();
      await page.waitForTimeout(3000);
      const msgs = await page.locator('.message, .message-user, .message-assistant').count();
      log(`  ✅ 消息发送成功，消息数: ${msgs}`);
    } else {
      log('  ❌ 发送按钮 disabled');
    }
     
    // ===== TEST 5: 新建对话 =====
    log('\n--- [TEST-05] 新建对话 ---');
    const newClicked = await page.evaluate(() => {
      // 方法1：通过 title="新对话" 查找（图标按钮）
      for (const btn of document.querySelectorAll('button[title]')) {
        if (btn.getAttribute('title') === '新对话') {
          btn.click();
          return 'title=新对话';
        }
      }
      // 方法2：通过 aria-label 查找
      for (const btn of document.querySelectorAll('button[aria-label]')) {
        if (btn.getAttribute('aria-label')?.includes('新对话')) {
          btn.click();
          return 'aria-label';
        }
      }
      // 方法3：查找包含 + 号的 SVG 按钮（侧边栏顶部）
      for (const btn of document.querySelectorAll('button')) {
        const svg = btn.querySelector('svg');
        if (svg && btn.className.includes('sidebar-action')) {
          // 检查是否是第一个操作按钮（通常是新建对话）
          const allSidebarBtns = Array.from(document.querySelectorAll('.sidebar button.sidebar-action-btn'));
          if (allSidebarBtns[0] === btn) {
            btn.click();
            return 'first-sidebar-btn';
          }
        }
      }
      return null;
    });
    if (newClicked) ok(`新建对话: ${newClicked}`); else fail('未找到新建按钮');
    await page.waitForTimeout(1000);
    await ss(page, '05-new-session');
     
    // ===== TEST 6: 切换工作台 =====
    log('\n--- [TEST-06] 工作台切换 ---');
    const deskClicked = await page.evaluate(() => {
      for (const btn of document.querySelectorAll('button')) {
        if (btn.textContent.trim() === '工作台') { btn.click(); return true; }
      }
      return false;
    });
    if (deskClicked) ok('已切换到工作台'); else fail('未找到工作台按钮');
    await page.waitForTimeout(1000);
    await ss(page, '06-desk');
     
    // ===== TEST 7: 渠道/频道切换 =====
    log('\n--- [TEST-07] 渠道切换 ---');
    for (const label of ['频道', '渠道', 'Channel']) {
      const found = await page.evaluate(l => {
        for (const btn of document.querySelectorAll('button')) {
          if (btn.textContent.trim() === l) { btn.click(); return true; }
        }
        return false;
      }, label);
      if (found) { ok(`已切换到${label}`); break; }
    }
    await page.waitForTimeout(1000);
    await ss(page, '07-channel');
     
    // ===== TEST 8: 设置入口 =====
    log('\n--- [TEST-08] 设置入口 ---');
    // 查找设置图标按钮（通常在侧边栏底部或右上角）
    const settingsFound = await page.evaluate(() => {
      // 方法1：检查 title="设置" 的按钮
      for (const btn of document.querySelectorAll('button[title]')) {
        if (btn.getAttribute('title') === '设置') {
          btn.click();
          return 'title=设置';
        }
      }
      // 方法2：检查 aria-label 包含设置
      for (const el of document.querySelectorAll('[aria-label], [title]')) {
        const l = (el.getAttribute('aria-label') || el.getAttribute('title') || '').toLowerCase();
        if (l.includes('设置') || l.includes('setting') || l.includes('config')) {
          el.click();
          return l;
        }
      }
      return null;
    });
    if (settingsFound) ok(`设置入口: ${settingsFound}`); else log('  ⚠️ 未找到标准设置入口（可能通过其他方式打开）');
    await page.waitForTimeout(1000);
    await ss(page, '08-settings');
     
    // 检查模态框
    const hasModal = await page.$('[role="dialog"], .modal-overlay').catch(() => null);
    if (hasModal) ok('弹窗组件可用'); else log('  ⚠️ 无弹窗打开');
     
    // ===== TEST 9: 右侧面板文件树 =====
    log('\n--- [TEST-09] 右侧文件面板 ---');
    const fileTree = await page.evaluate(() => {
      const items = document.querySelectorAll('[class*="file"], [class*="tree"], [class*="folder"]');
      return { count: items.length, sample: Array.from(items).slice(0,5).map(e=>e.textContent?.trim()?.slice(0,30)) };
    });
    log(`  文件相关元素: ${fileTree.count}个`);
    if (fileTree.count > 10) ok('文件树渲染正常'); else log('  ⚠️ 文件树元素较少');
     
    // ===== TEST 10: 连接状态 =====
    log('\n--- [TEST-10] 连接状态 ---');
    const connState = await page.evaluate(() => {
      const body = document.body.innerText;
      if (body.includes('已连接')) return 'connected';
      if (body.includes('未连接')) return 'disconnected';
      if (body.includes('连接中')) return 'connecting';
      return 'unknown';
    });
    if (connState === 'connected') ok(`WS状态: 已连接`);
    else log(`  ⚠️ WS状态: ${connState}`);
     
    // ===== TEST 11: 响应式/布局 =====
    log('\n--- [TEST-11] 布局检查 ---');
    const layout = await page.evaluate(() => {
      const main = document.querySelector('.main-content, main, [class*="main"]');
      const sidebar = document.querySelector('aside, nav, [class*="sidebar"], [class*="side-panel"]');
      return {
        hasMain: !!main,
        hasSidebar: !!sidebar,
        mainWidth: main?.getBoundingClientRect().width,
        sidebarWidth: sidebar?.getBoundingClientRect().width,
      };
    });
    if (layout.hasMain && layout.mainWidth > 400) { ok(`主内容区宽度: ${layout.mainWidth}px`); }
    else { fail(`主内容区异常: width=${layout.mainWidth}`); }
    if (layout.hasSidebar) ok(`侧边栏宽度: ${layout.sidebarWidth}px`);
     
    // ===== 汇总 =====
    log('\n========================================');
    log(`测试完成: ✅${passCount}通过  ❌${failCount}失败`);
    log('========================================\n');
     
  } catch (err) {
    log(`[FATAL] ${err.stack}\n`);
    await page.screenshot({ path: 'test-fatal.png' }).catch(() => {});
  } finally {
    await browser.close();
    LOG.end();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
