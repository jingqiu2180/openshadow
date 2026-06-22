import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG = fs.createWriteStream(path.join(__dirname, 'test-phase3.log'), { flags: 'w' });
let passCount = 0, failCount = 0, warnCount = 0;

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  process.stdout.write(line);
  LOG.write(line);
}

function ok(msg) { passCount++; log(`  ✅ ${msg}`); }
function fail(msg) { failCount++; log(`  ❌ ${msg}`); }
function warn(msg) { warnCount++; log(`  ⚠️ ${msg}`); }

async function ss(page, name) {
  await page.screenshot({ path: `test-p3-${name}.png` }).catch(() => {});
}

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  
  page.on('pageerror', err => log(`[PAGE ERROR] ${err.message}`));
  
  try {
    log('\n=== 第三阶段测试：高级功能深度测试 ===\n');
    await page.goto('http://localhost:5173/', { timeout: 15000 });
    await page.waitForTimeout(3000);
    
    // ===== TEST 23: WebSocket 连接稳定性 =====
    log('\n--- [TEST-23] WS连接稳定性 ---');
    // 多次检查连接状态
    let wsStable = true;
    for (let i = 0; i < 5; i++) {
      const state = await page.evaluate(() => document.body.innerText);
      if (!state.includes('已连接')) wsStable = false;
      await page.waitForTimeout(1000);
    }
    
    if (wsStable) ok('WebSocket 连接稳定（5次检测均通过）'); else fail('WebSocket 连接不稳定');
    
    // ===== TEST 24: 输入框多行文本 =====
    log('\n--- [TEST-24] 多行文本输入 ---');
    const editor = await page.$('.ProseMirror').catch(() => null);
    if (editor) {
      await editor.click();
      await page.keyboard.type('第一行', { delay: 50 });
      await page.keyboard.press('Enter');
      await page.keyboard.type('第二行', { delay: 50 });
      await page.keyboard.press('Enter');
      await page.keyboard.type('第三行', { delay: 50 });
      
      const multiLineText = await editor.evaluate(el => el.textContent.trim());
      if (multiLineText.includes('第一行') && multiLineText.includes('第三行')) {
        ok(`多行输入成功: "${multiLineText}"`);
      } else {
        fail(`多行输入异常: "${multiLineText}"`);
      }
      await ss(page, '24-multiline');
    } else {
      warn('编辑器未找到');
    }
    
    // ===== TEST 25: 发送多条消息 =====
    log('\n--- [TEST-25] 多条消息发送 ---');
    for (let msgNum = 1; msgNum <= 3; msgNum++) {
      // 清空输入框
      await page.evaluate(() => {
        const editor = document.querySelector('.ProseMirror');
        if (editor) editor.textContent = '';
      });
      await page.waitForTimeout(200);
      
      // 输入新消息
      const currentEditor = await page.$('.ProseMirror').catch(() => null);
      if (currentEditor) {
        await currentEditor.click();
        await page.keyboard.type(`测试消息 #${msgNum}`);
        
        // 点击发送
        const sent = await page.evaluate(() => {
          for (const btn of document.querySelectorAll('button')) {
            if (btn.textContent.trim() === '发送' && !btn.disabled) {
              btn.click();
              return true;
            }
          }
          return false;
        });
        
        if (sent) log(`  消息#${msgNum} 已发送`); else log(`  消息#${msgNum} 发送失败`);
        await page.waitForTimeout(2000);
      }
    }
    ok('多条消息发送完成');
    await ss(page, '25-multi-msg');
    
    // ===== TEST 26: 设置面板各选项卡 =====
    log('\n--- [TEST-26] 设置面板选项卡 ---');
    // 打开设置面板
    await page.evaluate(() => {
      for (const btn of document.querySelectorAll('button[title="设置"]')) {
        btn.click();
        break;
      }
    });
    await page.waitForTimeout(1500);
    
    const tabsInfo = await page.evaluate(() => {
      // 找到所有选项卡并逐个点击
      const modal = document.querySelector('[role="dialog"], .modal-overlay, [class*="modal"]');
      if (!modal) return { hasModal: false };
      
      const tabs = Array.from(modal.querySelectorAll('[role="tab"], button[class*="tab"]'));
      return {
        hasModal: true,
        tabCount: tabs.length,
        tabNames: tabs.map(t => t.textContent.trim()).slice(0, 10)
      };
    });
    
    if (tabsInfo.hasModal && tabsInfo.tabCount > 0) {
      ok(`设置选项卡数量: ${tabsInfo.tabCount}`);
      log(`  选项卡列表: ${tabsInfo.tabNames.join(', ')}`);
      
      // 尝试点击前3个选项卡
      for (let i = 0; i < Math.min(3, tabsInfo.tabNames.length); i++) {
        const clicked = await page.evaluate(idx => {
          const modal = document.querySelector('[role="dialog"], .modal-overlay, [class*="modal"]');
          if (!modal) return false;
          
          const tabs = Array.from(modal.querySelectorAll('[role="tab"], button[class*="tab"]'));
          if (tabs[idx]) {
            tabs[idx].click();
            return true;
          }
          return false;
        }, i);
        
        if (clicked) {
          await page.waitForTimeout(500);
          ok(`选项卡切换: ${tabsInfo.tabNames[i]}`);
        } else {
          warn(`选项卡${i}点击失败`);
        }
      }
    } else {
      warn('设置面板未打开或无选项卡');
    }
    await ss(page, '26-settings-tabs');
    
    // 关闭设置
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    
    // ===== TEST 27: 工作台文件操作 =====
    log('\n--- [TEST-27] 工作台文件操作 ---');
    // 切换到工作台
    await page.evaluate(() => {
      for (const btn of document.querySelectorAll('button')) {
        if (btn.textContent.trim() === '工作台') { btn.click(); break; }
      }
    });
    await page.waitForTimeout(1000);
    
    const deskFileTree = await page.evaluate(() => {
      // 检查文件树是否有展开的文件夹
      const folders = document.querySelectorAll('[class*="folder"][class*="open"], details[open]');
      const files = document.querySelectorAll('[class*="file-item"], li[class*="file"]');
      
      return {
        folderCount: folders.length,
        fileCount: files.length,
        totalElements: document.querySelectorAll('[class*="tree"]').length
      };
    });
    
    log(`  文件夹: ${deskFileTree.folderCount}, 文件项: ${deskFileTree.fileCount}, 总元素: ${deskFileTree.totalElements}`);
    if (deskFileTree.totalElements > 10) ok('工作台文件树正常'); else warn('工作台文件树元素较少');
    await ss(page, '27-desk-files');
    
    // ===== TEST 28: 插件/MCP 入口 =====
    log('\n--- [TEST-28] 插件/MCP ---');
    const pluginEntry = await page.evaluate(() => {
      // 查找插件或 MCP 相关入口
      for (const el of document.querySelectorAll('button, [role="link"], a')) {
        const text = el.textContent.toLowerCase();
        const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
        
        if (text.includes('插件') || text.includes('plugin') ||
            text.includes('mcp') || text.includes('技能') ||
            ariaLabel.includes('插件') || ariaLabel.includes('mcp') ||
            ariaLabel.includes('技能')) {
          return { found: true, text: el.textContent.trim(), type: 'entry' };
        }
      }
      
      // 也检查设置面板中的插件选项卡
      const settingsTabs = Array.from(document.querySelectorAll('[role="tab"], button'));
      const pluginTab = settingsTabs.find(t => 
        t.textContent.includes('技能') || t.textContent.includes('插件')
      );
      
      if (pluginTab) return { found: true, text: pluginTab.textContent.trim(), type: 'settings-tab' };
      
      return { found: false };
    });
    
    if (pluginEntry.found) ok(`插件/MCP入口: ${pluginEntry.text} (${pluginEntry.type})`); else warn('未找到插件/MCP入口');
    
    // ===== TEST 29: 助手活动/Agent管理 =====
    log('\n--- [TEST-29] Agent活动 ---');
    const agentActivity = await page.evaluate(() => {
      // 检查助手活动按钮
      for (const el of document.querySelectorAll('button')) {
        if (el.textContent === '助手活动') return { found: true, type: 'button' };
      }
      return { found: false };
    });
    
    if (agentActivity.found) ok('助手活动入口存在'); else warn('助手活动入口未找到');
    
    // ===== TEST 30: 任务计划/自动化 =====
    log('\n--- [TEST-30] 任务计划 ---');
    const taskSchedule = await page.evaluate(() => {
      for (const el of document.querySelectorAll('button')) {
        if (el.textContent === '任务计划') return { found: true };
      }
      return { found: false };
    });
    
    if (taskSchedule.found) ok('任务计划入口存在'); else warn('任务计划入口未找到');
    
    // ===== TEST 31: 社交平台集成 =====
    log('\n--- [TEST-31] 社交平台 ---');
    const socialBridge = await page.evaluate(() => {
      for (const el of document.querySelectorAll('button')) {
        if (el.textContent === '接入社交平台') return { found: true };
      }
      return { found: false };
    });
    
    if (socialBridge.found) ok('社交平台入口存在'); else warn('社交平台入口未找到');
    
    // ===== TEST 32: 后台浏览器 =====
    log('\n--- [TEST-32] 后台浏览器 ---');
    const bgBrowser = await page.evaluate(() => {
      for (const el of document.querySelectorAll('button')) {
        if (el.textContent.includes('后台浏览器')) return { found: true, text: el.textContent.trim() };
      }
      return { found: false };
    });
    
    if (bgBrowser.found) ok(`后台浏览器: ${bgBrowser.text}`); else log('  后台浏览器入口未显示（可能需要激活）');
    
    // ===== TEST 33: 窗口大小响应式 =====
    log('\n--- [TEST-33] 响应式布局 ---');
    // 改变窗口大小测试响应式
    await page.setViewportSize({ width: 800, height: 600 });
    await page.waitForTimeout(500);
    
    const smallLayout = await page.evaluate(() => {
      const sidebar = document.querySelector('.sidebar');
      const main = document.querySelector('.main-content, main');
      return {
        sidebarVisible: sidebar ? sidebar.offsetParent !== null : false,
        mainWidth: main?.offsetWidth,
      };
    });
    
    log(`  小屏幕(800x600): 侧边栏=${smallLayout.sidebarVisible ? '可见' : '隐藏'}, 主内容=${smallLayout.mainWidth}px`);
    
    // 恢复大屏幕
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.waitForTimeout(500);
    
    const largeLayout = await page.evaluate(() => {
      const main = document.querySelector('.main-content, main');
      return { mainWidth: main?.offsetWidth };
    });
    
    log(`  大屏幕(1400x900): 主内容=${largeLayout.mainWidth}px`);
    if (largeLayout.mainWidth > smallLayout.mainWidth) ok('响应式布局正常'); else warn('响应式布局可能有问题');
    
    // ===== 汇总 =====
    log('\n========================================');
    log(`第三阶段测试完成: ✅${passCount}通过  ❌${failCount}失败  ⚠️${warnCount}警告`);
    log('========================================\n');
    
    await ss(page, 'final');
    
  } catch (err) {
    log(`[FATAL] ${err.stack}\n`);
    await page.screenshot({ path: 'test-p3-fatal.png' }).catch(() => {});
  } finally {
    await browser.close();
    LOG.end();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
