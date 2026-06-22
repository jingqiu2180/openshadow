// ui-fine-audit.mjs — 精细化 UI 审查：提取关键元素 computed style
import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

const STORAGE = 'D:/screenshots/remu-ui-audit/storage.json';
const OUT = 'D:/screenshots/remu-ui-audit/fine-audit.json';

async function main() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ storageState: STORAGE });
  const page = await context.newPage();
  await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(2000);

  const results = { timestamp: new Date().toISOString(), elements: {} };

  // 在浏览器上下文里定义样式提取函数
  const extractStyle = async (page, selectors) => {
    const data = {};
    for (const [key, selector] of Object.entries(selectors)) {
      data[key] = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) return { error: `not found: ${sel}` };
        const cs = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return {
          selector: sel,
          textContent: el.textContent?.slice(0, 50),
          tag: el.tagName,
          className: el.className.slice(0, 100),
          // 布局
          width: rect.width,
          height: rect.height,
          top: rect.top,
          left: rect.left,
          // 盒模型
          padding: cs.padding,
          margin: cs.margin,
          borderWidth: cs.borderWidth,
          borderRadius: cs.borderRadius,
          // 颜色
          color: cs.color,
          backgroundColor: cs.backgroundColor,
          borderColor: cs.borderColor,
          // 字体
          fontSize: cs.fontSize,
          fontWeight: cs.fontWeight,
          fontFamily: cs.fontFamily?.slice(0, 50),
          lineHeight: cs.lineHeight,
          letterSpacing: cs.letterSpacing,
          // 阴影
          boxShadow: cs.boxShadow,
          // 过渡和动画
          transition: cs.transition,
          animationName: cs.animationName,
          animationDuration: cs.animationDuration,
          animationTimingFunction: cs.animationTimingFunction,
          // 其他
          opacity: cs.opacity,
          cursor: cs.cursor,
          display: cs.display,
          zIndex: cs.zIndex,
          position: cs.position,
        };
      }, selector);
    }
    return data;
  };

  // 1. Sidebar
  console.log('[audit] 提取 Sidebar 样式...');
  results.elements.sidebar = await extractStyle(page, {
    container: '.sidebar',
    header: '.sidebar-header',
    sessionList: '.session-list',
    newChatBtn: 'button[title="新对话"], button[aria-label="新对话"]',
  });

  // 2. InputArea
  console.log('[audit] 提取 InputArea 样式...');
  results.elements.inputArea = await extractStyle(page, {
    container: '.input-area',
    inputWrapper: '.input-wrapper',
    sendBtn: '.send-btn',
    modelSelector: '.model-selector',
  });

  // 3. ChatArea（需要先创建一个会话）
  console.log('[audit] 创建测试会话...');
  try {
    await page.locator('button[title="新对话"]').first().click();
    await page.waitForTimeout(1000);
  } catch {}
  
  results.elements.chatArea = await extractStyle(page, {
    container: '.chat-area',
    messagesContainer: '.messages-container, .chat-messages',
  });

  // 4. SettingsModal
  console.log('[audit] 打开设置面板...');
  try {
    await page.locator('button[title="设置"], button[aria-label="设置"]').first().click();
    await page.waitForTimeout(500);
    results.elements.settingsModal = await extractStyle(page, {
      overlay: '.settings-overlay, [class*="settings"][class*="overlay"]',
      panel: '.settings-panel, [class*="settings"][class*="panel"]',
    });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  } catch (e) {
    results.elements.settingsModal = { error: e.message };
  }

  await browser.close();

  writeFileSync(OUT, JSON.stringify(results, null, 2));
  console.log(`[audit] 完成！结果保存到 ${OUT}`);
  console.log(JSON.stringify(results, null, 2));
}

main().catch(e => { console.error(e); process.exit(1); });
