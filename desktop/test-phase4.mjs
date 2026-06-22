import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const SS_DIR = 'D:/screenshots/remu-phase4';
if (!fs.existsSync(SS_DIR)) fs.mkdirSync(SS_DIR, { recursive: true });

const log = (...a) => console.log(`[${new Date().toISOString()}]`, ...a);
const ok = (m) => log('  ✅', m);
const fail = (m) => log('  ❌', m);
const warn = (m) => log('  ⚠️', m);
const ss = async (page, name) => {
  const fp = path.join(SS_DIR, `${name}.png`);
  await page.screenshot({ path: fp, fullPage: false });
  return fp;
};

(async () => {
  const browser = await chromium.launch({ headless: false, args: ['--window-size=1400,900'] });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();

  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  await ss(page, '01-start');

  log('\n===== PHASE 4: 深度测试（遗漏模块） =====');

  // ===== TEST 27: 搜索功能 =====
  log('\n--- [TEST-27] 搜索功能 ---');
  const searchBtn = await page.evaluate(() => {
    // 查找搜索按钮（通常是 Ctrl+K 触发或搜索图标）
    for (const btn of document.querySelectorAll('button, [role="button"]')) {
      const text = btn.textContent.toLowerCase();
      const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
      const title = (btn.getAttribute('title') || '').toLowerCase();
      if (text.includes('搜索') || text.includes('search') || 
          ariaLabel.includes('搜索') || ariaLabel.includes('search') ||
          title.includes('搜索') || title.includes('search')) {
        btn.click();
        return { found: true, method: 'direct', text: text.substring(0, 30) };
      }
    }
    return { found: false };
  });
  
  if (searchBtn.found) {
    ok(`搜索按钮: ${searchBtn.text}`);
    await page.waitForTimeout(800);
    await ss(page, '27-search');
    
    // 检查是否出现搜索面板
    const searchPanel = await page.evaluate(() => {
      return document.querySelectorAll('[role="search"], [class*="search"], [placeholder*="搜索"]').length;
    });
    if (searchPanel > 0) ok(`搜索面板出现: ${searchPanel}个元素`);
    else warn('搜索面板未出现');
    
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  } else {
    // 尝试 Ctrl+K 快捷键
    await page.keyboard.press('Control+K');
    await page.waitForTimeout(800);
    await ss(page, '27-search-ctrlk');
    
    const searchPanel2 = await page.evaluate(() => {
      return document.querySelectorAll('[role="search"], [class*="search"], input[placeholder*="搜索"]').length;
    });
    
    if (searchPanel2 > 0) ok('搜索面板（Ctrl+K）');
    else warn('未找到搜索功能（可能未实现）');
  }

  // ===== TEST 28: 主题切换 =====
  log('\n--- [TEST-28] 主题切换 ---');
  // 先打开设置面板
  await page.evaluate(() => {
    const btn = document.querySelector('button[title="设置"]');
    if (btn) btn.click();
  });
  await page.waitForTimeout(1000);
  
  const themeTab = await page.evaluate(() => {
    // 查找主题选项卡
    for (const tab of document.querySelectorAll('[role="tab"], .tab, button')) {
      const text = tab.textContent.toLowerCase();
      if (text.includes('主题') || text.includes('theme') || text.includes('外观')) {
        tab.click();
        return { found: true, text: text.substring(0, 30) };
      }
    }
    return { found: false };
  });
  
  if (themeTab.found) {
    ok(`主题选项卡: ${themeTab.text}`);
    await page.waitForTimeout(800);
    await ss(page, '28-theme');
    
    // 检查主题选项
    const themeOptions = await page.evaluate(() => {
      return document.querySelectorAll('[class*="theme"], [data-theme], select').length;
    });
    if (themeOptions > 0) ok(`主题选项: ${themeOptions}个`);
    else warn('未找到主题选项');
  } else {
    warn('未找到主题选项卡（可能在其他位置）');
  }
  
  // 关闭设置面板
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  // ===== TEST 29: 导出对话 =====
  log('\n--- [TEST-29] 导出对话 ---');
  // 右键点击会话项，查看是否有导出选项
  const exportFound = await page.evaluate(() => {
    const items = document.querySelectorAll('[data-session-path]');
    if (items.length === 0) return { found: false, reason: 'no session items' };
    
    const firstItem = items[0];
    const rect = firstItem.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return { found: false, reason: 'not visible' };
    
    // 触发右键菜单
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    firstItem.dispatchEvent(event);
    
    return { found: true };
  });
  
  if (exportFound.found) {
    await page.waitForTimeout(800);
    await ss(page, '29-export-menu');
    
    // 检查上下文菜单中是否有导出选项
    const exportOption = await page.evaluate(() => {
      for (const el of document.querySelectorAll('[role="menu"] li, .context-menu li, [class*="menu"] li')) {
        const text = el.textContent.toLowerCase();
        if (text.includes('导出') || text.includes('export') || text.includes('下载') || text.includes('download')) {
          return { found: true, text: text.substring(0, 30) };
        }
      }
      return { found: false };
    });
    
    if (exportOption.found) {
      ok(`导出选项: ${exportOption.text}`);
    } else {
      warn('右键菜单中未找到导出选项');
    }
    
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  } else {
    warn(`未找到会话项: ${exportFound.reason}`);
  }

  // ===== TEST 30: Markdown 渲染 =====
  log('\n--- [TEST-30] Markdown 渲染 ---');
  // 发送包含 Markdown 格式的消
  const mdSent = await page.evaluate(() => {
    const editor = document.querySelector('[data-tiptap-editor]');
    if (!editor) return false;
    
    // 点击编辑器
    editor.click();
    
    // 输入 Markdown 文本
    const text = '**粗体** *斜体* `代码` [链接](https://example.com)';
    const inputEvent = new InputEvent('input', { inputType: 'insertText', data: text });
    editor.dispatchEvent(inputEvent);
    
    return true;
  });
  
  if (mdSent) {
    await page.waitForTimeout(500);
    // 发送消息
    await page.evaluate(() => {
      for (const btn of document.querySelectorAll('button')) {
        if (btn.textContent.includes('发送') || btn.title === '发送' || btn.getAttribute('aria-label')?.includes('发送')) {
          btn.click();
          return true;
        }
      }
      return false;
    });
    
    await page.waitForTimeout(3000);
    await ss(page, '30-markdown');
    
    // 检查 Markdown 渲染
    const mdRendered = await page.evaluate(() => {
      const messages = document.querySelectorAll('[class*="message"], [class*="chat"]');
      if (messages.length === 0) return { rendered: false };
      
      const lastMsg = messages[messages.length - 1];
      const hasBold = lastMsg.querySelectorAll('strong, b').length > 0;
      const hasItalic = lastMsg.querySelectorAll('em, i').length > 0;
      const hasCode = lastMsg.querySelectorAll('code').length > 0;
      const hasLink = lastMsg.querySelectorAll('a').length > 0;
      
      return { rendered: true, hasBold, hasItalic, hasCode, hasLink };
    });
    
    if (mdRendered.rendered) {
      ok(`Markdown 渲染: bold=${mdRendered.hasBold}, italic=${mdRendered.hasItalic}, code=${mdRendered.hasCode}, link=${mdRendered.hasLink}`);
    } else {
      warn('未找到消息元素');
    }
  } else {
    warn('无法输入 Markdown 文本');
  }

  // ===== TEST 31: 代码高亮 =====
  log('\n--- [TEST-31] 代码高亮 ---');
  const codeSent = await page.evaluate(() => {
    const editor = document.querySelector('[data-tiptap-editor]');
    if (!editor) return false;
    
    editor.click();
    
    // 输入代码块
    const text = '```javascript\nconst hello = "world";\nconsole.log(hello);\n```';
    const inputEvent = new InputEvent('input', { inputType: 'insertText', data: text });
    editor.dispatchEvent(inputEvent);
    
    return true;
  });
  
  if (codeSent) {
    await page.waitForTimeout(500);
    // 发送消息
    await page.evaluate(() => {
      for (const btn of document.querySelectorAll('button')) {
        if (btn.textContent.includes('发送') || btn.title === '发送') {
          btn.click();
          return true;
        }
      }
      return false;
    });
    
    await page.waitForTimeout(3000);
    await ss(page, '31-code-highlight');
    
    // 检查代码高亮
    const codeHighlight = await page.evaluate(() => {
      const messages = document.querySelectorAll('[class*="message"], [class*="chat"]');
      if (messages.length === 0) return { highlighted: false };
      
      const lastMsg = messages[messages.length - 1];
      const codeBlocks = lastMsg.querySelectorAll('pre, code, [class*="code"], [class*="highlight"]');
      
      return { highlighted: codeBlocks.length > 0, count: codeBlocks.length };
    });
    
    if (codeHighlight.highlighted) {
      ok(`代码高亮: ${codeHighlight.count}个代码块`);
    } else {
      warn('未找到代码高亮');
    }
  } else {
    warn('无法输入代码块');
  }

  // ===== TEST 32: 表格渲染 =====
  log('\n--- [TEST-32] 表格渲染 ---');
  const tableSent = await page.evaluate(() => {
    const editor = document.querySelector('[data-tiptap-editor]');
    if (!editor) return false;
    
    editor.click();
    
    // 输入表格 Markdown
    const text = '| 列1 | 列2 | 列3 |\n| --- | --- | --- |\n| A | B | C |\n| D | E | F |';
    const inputEvent = new InputEvent('input', { inputType: 'insertText', data: text });
    editor.dispatchEvent(inputEvent);
    
    return true;
  });
  
  if (tableSent) {
    await page.waitForTimeout(500);
    // 发送消息
    await page.evaluate(() => {
      for (const btn of document.querySelectorAll('button')) {
        if (btn.textContent.includes('发送') || btn.title === '发送') {
          btn.click();
          return true;
        }
      }
      return false;
    });
    
    await page.waitForTimeout(3000);
    await ss(page, '32-table');
    
    // 检查表格渲染
    const tableRendered = await page.evaluate(() => {
      const messages = document.querySelectorAll('[class*="message"], [class*="chat"]');
      if (messages.length === 0) return { rendered: false };
      
      const lastMsg = messages[messages.length - 1];
      const tables = lastMsg.querySelectorAll('table');
      const hasTable = tables.length > 0;
      
      return { rendered: hasTable, count: tables.length };
    });
    
    if (tableRendered.rendered) {
      ok(`表格渲染: ${tableRendered.count}个表格`);
    } else {
      warn('未找到表格渲染（可能不支持）');
    }
  } else {
    warn('无法输入表格');
  }

  // ===== TEST 33: 数学公式 =====
  log('\n--- [TEST-33] 数学公式 ---');
  const mathSent = await page.evaluate(() => {
    const editor = document.querySelector('[data-tiptap-editor]');
    if (!editor) return false;
    
    editor.click();
    
    // 输入数学公式
    const text = '行内公式: $E = mc^2$\n\n块级公式:\n$$\n\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}\n$$';
    const inputEvent = new InputEvent('input', { inputType: 'insertText', data: text });
    editor.dispatchEvent(inputEvent);
    
    return true;
  });
  
  if (mathSent) {
    await page.waitForTimeout(500);
    // 发送消息
    await page.evaluate(() => {
      for (const btn of document.querySelectorAll('button')) {
        if (btn.textContent.includes('发送') || btn.title === '发送') {
          btn.click();
          return true;
        }
      }
      return false;
    });
    
    await page.waitForTimeout(3000);
    await ss(page, '33-math');
    
    // 检查数学公式渲染
    const mathRendered = await page.evaluate(() => {
      const messages = document.querySelectorAll('[class*="message"], [class*="chat"]');
      if (messages.length === 0) return { rendered: false };
      
      const lastMsg = messages[messages.length - 1];
      const hasMath = lastMsg.querySelectorAll('[class*="math"], [class*="katex"], [class*="equation"]').length > 0;
      
      return { rendered: hasMath };
    });
    
    if (mathRendered.rendered) {
      ok('数学公式渲染: 支持');
    } else {
      warn('未找到数学公式渲染（可能不支持）');
    }
  } else {
    warn('无法输入数学公式');
  }

  // ===== TEST 34: Mermaid 图表 =====
  log('\n--- [TEST-34] Mermaid 图表 ---');
  const mermaidSent = await page.evaluate(() => {
    const editor = document.querySelector('[data-tiptap-editor]');
    if (!editor) return false;
    
    editor.click();
    
    // 输入 Mermaid 图表
    const text = '```mermaid\ngraph TD;\n    A-->B;\n    A-->C;\n    B-->D;\n    C-->D;\n```';
    const inputEvent = new InputEvent('input', { inputType: 'insertText', data: text });
    editor.dispatchEvent(inputEvent);
    
    return true;
  });
  
  if (mermaidSent) {
    await page.waitForTimeout(500);
    // 发送消息
    await page.evaluate(() => {
      for (const btn of document.querySelectorAll('button')) {
        if (btn.textContent.includes('发送') || btn.title === '发送') {
          btn.click();
          return true;
        }
      }
      return false;
    });
    
    await page.waitForTimeout(3000);
    await ss(page, '34-mermaid');
    
    // 检查 Mermaid 图表渲染
    const mermaidRendered = await page.evaluate(() => {
      const messages = document.querySelectorAll('[class*="message"], [class*="chat"]');
      if (messages.length === 0) return { rendered: false };
      
      const lastMsg = messages[messages.length - 1];
      const hasMermaid = lastMsg.querySelectorAll('[class*="mermaid"], svg, [class*="diagram"]').length > 0;
      
      return { rendered: hasMermaid };
    });
    
    if (mermaidRendered.rendered) {
      ok('Mermaid 图表渲染: 支持');
    } else {
      warn('未找到 Mermaid 图表渲染（可能不支持）');
    }
  } else {
    warn('无法输入 Mermaid 图表');
  }

  // ===== TEST 35: 语音输入 =====
  log('\n--- [TEST-35] 语音输入 ---');
  const voiceBtn = await page.evaluate(() => {
    for (const btn of document.querySelectorAll('button, [role="button"]')) {
      const text = btn.textContent.toLowerCase();
      const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
      const title = (btn.getAttribute('title') || '').toLowerCase();
      if (text.includes('语音') || text.includes('voice') || text.includes('麦克风') || 
          ariaLabel.includes('语音') || ariaLabel.includes('voice') || ariaLabel.includes('microphone') ||
          title.includes('语音') || title.includes('voice')) {
        btn.click();
        return { found: true, text: text.substring(0, 30) };
      }
    }
    return { found: false };
  });
  
  if (voiceBtn.found) {
    ok(`语音输入按钮: ${voiceBtn.text}`);
    await page.waitForTimeout(800);
    await ss(page, '35-voice');
    warn('语音输入功能需要麦克风权限（无法自动测试）');
    
    // 关闭语音输入
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  } else {
    warn('未找到语音输入功能（可能未实现）');
  }

  // ===== TEST 36: 拖拽上传 =====
  log('\n--- [TEST-36] 拖拽上传 ---');
  // 创建一个测试文件
  const testFilePath = 'D:/src/aicoding/remu/desktop/test-upload.txt';
  fs.writeFileSync(testFilePath, 'This is a test file for drag-and-drop upload.');
  
  const dropZone = await page.evaluate(() => {
    // 查找拖拽区域（通常是整个聊天区域或专门的拖拽区）
    const chatArea = document.querySelector('[class*="chat"], [class*="input"], [data-tiptap-editor]');
    if (chatArea) {
      // 模拟拖拽事件
      const dragOverEvent = new DragEvent('dragover', { bubbles: true, cancelable: true });
      chatArea.dispatchEvent(dragOverEvent);
      
      const dropEvent = new DragEvent('drop', { bubbles: true, cancelable: true });
      chatArea.dispatchEvent(dropEvent);
      
      return { found: true, selector: chatArea.className };
    }
    return { found: false };
  });
  
  if (dropZone.found) {
    ok(`拖拽区域: ${dropZone.selector}`);
    await page.waitForTimeout(800);
    await ss(page, '36-drag-drop');
    warn('拖拽上传需要实际文件对象（无法完全模拟）');
  } else {
    warn('未找到拖拽区域');
  }
  
  // 清理测试文件
  try { fs.unlinkSync(testFilePath); } catch (e) {}

  // ===== TEST 37: 键盘导航 =====
  log('\n--- [TEST-37] 键盘导航 ---');
  // 测试 Tab 键导航
  await page.keyboard.press('Tab');
  await page.waitForTimeout(200);
  await page.keyboard.press('Tab');
  await page.waitForTimeout(200);
  await page.keyboard.press('Tab');
  await page.waitForTimeout(200);
  
  const focusedElement = await page.evaluate(() => {
    const focused = document.activeElement;
    if (!focused) return { focused: false };
    
    return {
      focused: true,
      tag: focused.tagName,
      type: focused.getAttribute('type'),
      role: focused.getAttribute('role'),
      text: focused.textContent.substring(0, 50)
    };
  });
  
  if (focusedElement.focused) {
    ok(`键盘导航: focused on ${focusedElement.tag}${focusedElement.role ? ` [role=${focusedElement.role}]` : ''}`);
  } else {
    warn('键盘导航可能有问题');
  }
  await ss(page, '37-keyboard-nav');

  // ===== TEST 38: 无障碍功能 =====
  log('\n--- [TEST-38] 无障碍功能 ---');
  const a11y = await page.evaluate(() => {
    const issues = [];
    
    // 检查图片是否有 alt 属性
    const images = document.querySelectorAll('img');
    let missingAlt = 0;
    for (const img of images) {
      if (!img.getAttribute('alt') && !img.getAttribute('aria-label')) {
        missingAlt++;
      }
    }
    if (missingAlt > 0) issues.push(`图片缺少 alt: ${missingAlt}个`);
    
    // 检查按钮是否有 aria-label 或文本
    const buttons = document.querySelectorAll('button');
    let missingLabel = 0;
    for (const btn of buttons) {
      if (!btn.getAttribute('aria-label') && !btn.textContent.trim() && !btn.getAttribute('title')) {
        missingLabel++;
      }
    }
    if (missingLabel > 0) issues.push(`按钮缺少标签: ${missingLabel}个`);
    
    // 检查表单元素是否有 label
    const inputs = document.querySelectorAll('input, textarea, select');
    let missingInputLabel = 0;
    for (const input of inputs) {
      const id = input.getAttribute('id');
      if (id) {
        const label = document.querySelector(`label[for="${id}"]`);
        if (!label) missingInputLabel++;
      } else {
        const ariaLabel = input.getAttribute('aria-label');
        if (!ariaLabel) missingInputLabel++;
      }
    }
    if (missingInputLabel > 0) issues.push(`输入元素缺少 label: ${missingInputLabel}个`);
    
    return { issues, stats: { images: images.length, buttons: buttons.length, inputs: inputs.length } };
  });
  
  if (a11y.issues.length === 0) {
    ok(`无障碍功能: 通过（${a11y.stats.buttons}个按钮, ${a11y.stats.inputs}个输入）`);
  } else {
    warn(`无障碍问题: ${a11y.issues.join('; ')}`);
  }

  // ===== TEST 39: 性能检查 =====
  log('\n--- [TEST-39] 性能检查 ---');
  const performance = await page.evaluate(() => {
    const timing = performance.timing;
    const loadTime = timing.loadEventEnd - timing.navigationStart;
    const domReady = timing.domContentLoadedEventEnd - timing.navigationStart;
    
    return { loadTime, domReady, resources: performance.getEntriesByType('resource').length };
  });
  
  ok(`性能: 加载=${performance.loadTime}ms, DOM就绪=${performance.domReady}ms, 资源=${performance.resources}个`);
  if (performance.loadTime > 5000) warn('页面加载时间超过 5 秒');
  if (performance.resources > 100) warn('资源数量超过 100 个');

  // ===== TEST 40: 错误处理 =====
  log('\n--- [TEST-40] 错误处理 ---');
  // 检查是否有全局错误处理器
  const errorHandler = await page.evaluate(() => {
    return {
      hasOnError: typeof window.onerror === 'function',
      hasUnhandledRejection: typeof window.onunhandledrejection === 'function',
      hasConsoleError: typeof console.error === 'function'
    };
  });
  
  if (errorHandler.hasOnError || errorHandler.hasUnhandledRejection) {
    ok(`错误处理: onerror=${errorHandler.hasOnError}, onunhandledrejection=${errorHandler.hasUnhandledRejection}`);
  } else {
    warn('未找到全局错误处理器');
  }

  await ss(page, '99-final');
  
  log('\n===== PHASE 4 完成 =====');
  log('截图保存在:', SS_DIR);
  
  await page.waitForTimeout(5000);
  await browser.close();
})();
