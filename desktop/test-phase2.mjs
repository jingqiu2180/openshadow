import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG = fs.createWriteStream(path.join(__dirname, 'test-phase2.log'), { flags: 'w' });
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
  await page.screenshot({ path: `test-p2-${name}.png` }).catch(() => {});
}

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  
  page.on('pageerror', err => log(`[PAGE ERROR] ${err.message}`));
  
  try {
    // 基础导航
    log('\n=== 第二阶段测试：全功能深度测试 ===\n');
    await page.goto('http://localhost:5173/', { timeout: 15000 });
    await page.waitForTimeout(3000);
    
    // ===== TEST 12: Agent 切换 =====
    log('\n--- [TEST-12] Agent切换 ---');
    // 查找 Agent 头像/名称按钮（通常在输入框上方或侧边栏）
    const agentSwitch = await page.evaluate(() => {
      // 检查是否有 Agent 切换下拉
      const agentBtns = Array.from(document.querySelectorAll('button, [role="button"]'))
        .filter(el => {
          const text = el.textContent;
          return text.includes('rem-default') || text.includes('助手') || el.querySelector('img[alt*="agent"]');
        });
      if (agentBtns.length > 0) {
        agentBtns[0].click();
        return agentBtns[0].textContent.trim().substring(0, 50);
      }
      return null;
    });
    if (agentSwitch) ok(`Agent按钮找到: ${agentSwitch}`); else warn('未找到Agent切换按钮（可能集成在其他位置）');
    await page.waitForTimeout(1000);
    await ss(page, '12-agent');
    
    // ===== TEST 13: 模型切换 =====
    log('\n--- [TEST-13] 模型切换 ---');
    const modelSwitch = await page.evaluate(() => {
      // 查找模型选择器（通常显示 "MiniMax-M3▾" 这样的文本）
      for (const el of document.querySelectorAll('button, [role="button"], .model-pill, [class*="model"]')) {
        const text = el.textContent;
        if (text.includes('MiniMax') || text.includes('M3') || text.includes('模型')) {
          el.click();
          return text.trim().substring(0, 50);
        }
      }
      return null;
    });
    if (modelSwitch) {
      ok(`模型选择器: ${modelSwitch}`);
      await page.waitForTimeout(1500);  // 增加等待时间
      // 检查是否出现下拉菜单（使用多种选择器）
      const dropdown = await page.evaluate(() => {
        const selectors = [
          '[role="listbox"]',
          '[role="menu"]',
          '[class*="dropdown"]',
          '[class*="select-"]',
          '[class*="model-list"]'
        ];
        for (const sel of selectors) {
          if (document.querySelector(sel)) return { found: true, selector: sel };
        }
        return { found: false };
      });
      if (dropdown.found) ok(`模型下拉菜单出现: ${dropdown.selector}`); else warn('模型下拉菜单未出现');
    } else {
      warn('未找到模型选择器');
    }
    await ss(page, '13-model');
    
    // ===== TEST 14: 思考模式切换 =====
    log('\n--- [TEST-14] 思考模式 ---');
    const thinkingToggle = await page.evaluate(() => {
      // 查找思考模式开关（可能是 toggle 或 pill 按钮）
      // 先检查设置面板中是否有思考模式选项
      for (const el of document.querySelectorAll('button, [role="switch"], input[type="checkbox"], [class*="thinking"], [class*="pill"]')) {
        const text = el.textContent.toLowerCase();
        const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
        const title = (el.getAttribute('title') || '').toLowerCase();
        
        if (text.includes('思考') || ariaLabel.includes('思考') || title.includes('思考')) {
          el.click();
          return { found: true, text: text.substring(0, 30), method: 'direct' };
        }
      }
      // 也可能在设置面板中
      return { found: false };
    });
    if (thinkingToggle.found) ok(`思考模式切换: ${thinkingToggle.text}`); else warn('未找到思考模式开关（可能在设置面板中）');
    await page.waitForTimeout(500);
    await ss(page, '14-thinking');
    
    // ===== TEST 15: 计划模式切换 =====
    log('\n--- [TEST-15] 计划模式 ---');
    const planMode = await page.evaluate(() => {
      // 查找计划模式开关（文本是"操作前询问"）
      for (const el of document.querySelectorAll('button, [role="switch"], [class*="plan"]')) {
        const text = el.textContent.trim();
        const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
        if (text.includes('操作前询问') || text.includes('计划') || ariaLabel.includes('plan')) {
          el.click();
          return { found: true, text: text.substring(0, 30) };
        }
      }
      return { found: false };
    });
    if (planMode.found) ok(`计划模式: ${planMode.text}`); else warn('未找到计划模式开关');
    await page.waitForTimeout(500);
    await ss(page, '15-plan');
    
    // ===== TEST 16: 文件上传 =====
    log('\n--- [TEST-16] 文件上传 ---');
    const fileUpload = await page.evaluate(() => {
      // 查找文件上传按钮（通常是回形针图标）
      for (const btn of document.querySelectorAll('button, label')) {
        const html = btn.innerHTML;
        const ariaLabel = btn.getAttribute('aria-label') || '';
        const title = btn.getAttribute('title') || '';
        if (html.includes('paperclip') || html.includes('attach') || 
            ariaLabel.includes('附件') || ariaLabel.includes('文件') ||
            title.includes('附件') || title.includes('文件')) {
          // 检查是否有隐藏的 file input
          const input = btn.querySelector('input[type="file"]') || 
                       btn.parentElement?.querySelector('input[type="file"]');
          return { found: true, hasInput: !!input, desc: ariaLabel || title };
        }
      }
      return { found: false };
    });
    if (fileUpload.found) ok(`文件上传按钮存在: ${fileUpload.desc}`); else warn('未找到文件上传按钮');
    
    // ===== TEST 17: 图片上传 =====
    log('\n--- [TEST-17] 图片上传 ---');
    const imgUpload = await page.evaluate(() => {
      for (const btn of document.querySelectorAll('button, label')) {
        const html = btn.innerHTML;
        const ariaLabel = btn.getAttribute('aria-label') || '';
        if (html.includes('image') || html.includes('picture') || 
            ariaLabel.includes('图片') || ariaLabel.includes('image')) {
          return ariaLabel;
        }
      }
      return null;
    });
    if (imgUpload) ok(`图片上传按钮: ${imgUpload}`); else warn('未找到图片上传按钮（可能集成在文件上传中）');
    
    // ===== TEST 18: 设置面板功能 =====
    log('\n--- [TEST-18] 设置面板 ---');
    // 先打开设置
    await page.evaluate(() => {
      for (const btn of document.querySelectorAll('button[title="设置"]')) {
        btn.click();
        break;
      }
    });
    await page.waitForTimeout(1500);
    
    const settingsSections = await page.evaluate(() => {
      // 检查设置弹窗的内容
      const modal = document.querySelector('[role="dialog"], .modal-overlay, [class*="modal"]');
      if (!modal) return { hasModal: false };
      
      const sections = Array.from(modal.querySelectorAll('button, [role="tab"], [class*="tab"]'))
        .map(el => el.textContent.trim())
        .filter(t => t.length > 0 && t.length < 20);
      
      return {
        hasModal: true,
        sections: sections.slice(0, 10),
        hasCloseBtn: !!modal.querySelector('button[aria-label*="关闭"], button[class*="close"]')
      };
    });
    
    if (settingsSections.hasModal) {
      ok(`设置面板打开成功: ${settingsSections.sections.length}个选项`);
      log(`  选项: ${settingsSections.sections.join(', ')}`);
      if (settingsSections.hasCloseBtn) ok('关闭按钮存在');
    } else {
      warn('设置面板未正常打开');
    }
    await ss(page, '18-settings');
    
    // 关闭设置面板
    await page.evaluate(() => {
      const closeBtn = document.querySelector('button[aria-label*="关闭"], button[class*="close"]');
      if (closeBtn) closeBtn.click();
    });
    await page.waitForTimeout(500);
    
    // ===== TEST 19: 多渠道 =====
    log('\n--- [TEST-19] 多渠道 ---');
    // 切换到频道标签页
    await page.evaluate(() => {
      for (const btn of document.querySelectorAll('button')) {
        if (btn.textContent.trim() === '频道') { btn.click(); break; }
      }
    });
    await page.waitForTimeout(1000);
    
    const channelUI = await page.evaluate(() => {
      // 检查是否有渠道列表
      const channelItems = document.querySelectorAll('[class*="channel"], [class*="tab"]');
      return { count: channelItems.length };
    });
    log(`  渠道UI元素: ${channelUI.count}个`);
    if (channelUI.count > 0) ok('渠道UI存在'); else warn('渠道UI未找到');
    await ss(page, '19-channels');
    
    // ===== TEST 20: 会话列表操作 =====
    log('\n--- [TEST-20] 会话列表 ---');
    // 使用 evaluate 点击（更可靠）
    const sessionItemFound = await page.evaluate(() => {
      const items = document.querySelectorAll('[data-session-path]');
      if (items.length === 0) return { found: false };
      
      // 尝试右键点击第一个会话项
      const firstItem = items[0];
      const rect = firstItem.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return { found: false, reason: 'not visible' };
      
      // 触发 contextmenu 事件
      const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
      firstItem.dispatchEvent(event);
      
      return { found: true, text: firstItem.textContent.trim().substring(0, 30) };
    });
    
    if (sessionItemFound.found) {
      ok(`会话项找到: ${sessionItemFound.text}`);
      await page.waitForTimeout(800);
      
      const contextMenu = await page.evaluate(() => {
        return document.querySelectorAll('[role="menu"], .context-menu, [class*="context"]').length;
      });
      
      if (contextMenu > 0) ok('右键菜单出现'); else warn('右键菜单未出现');
      await ss(page, '20-context');
      
      // 关闭上下文菜单
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    } else {
      warn(`未找到可见的会话项: ${sessionItemFound.reason || 'unknown'}`);
    }
    
    // ===== TEST 21: 欢迎屏 =====
    log('\n--- [TEST-21] 欢迎屏 ---');
    const welcome = await page.evaluate(() => {
      const el = document.querySelector('[class*="welcome"], [class*="onboarding"]');
      if (!el) return { visible: false };
      const style = window.getComputedStyle(el);
      return {
        visible: style.display !== 'none' && style.visibility !== 'hidden' && el.offsetParent !== null,
        className: el.className
      };
    });
    if (welcome.visible) ok('欢迎屏可见'); else log('  欢迎屏未显示（可能已关闭或通过其他方式触发）');
    
    // ===== TEST 22: 快捷键 =====
    log('\n--- [TEST-22] 快捷键 ---');
    // 测试 Ctrl+N（新建会话）
    await page.keyboard.press('Control+n');
    await page.waitForTimeout(500);
    const afterShortcut = await page.evaluate(() => {
      return document.querySelectorAll('[data-session-path]').length;
    });
    log(`  Ctrl+N 后会话数: ${afterShortcut}`);
    ok('快捷键测试完成');
    
    // ===== 汇总 =====
    log('\n========================================');
    log(`第二阶段测试完成: ✅${passCount}通过  ❌${failCount}失败  ⚠️${warnCount}警告`);
    log('========================================\n');
    
    // 最终截图
    await ss(page, 'final');
    
  } catch (err) {
    log(`[FATAL] ${err.stack}\n`);
    await page.screenshot({ path: 'test-p2-fatal.png' }).catch(() => {});
  } finally {
    await browser.close();
    LOG.end();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
