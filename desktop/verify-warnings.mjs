import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: false, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);

console.log('=== 手动验证：检查警告项 ===\n');

// 1. 验证模型下拉菜单
console.log('[1] 验证模型下拉菜单...');
await page.evaluate(() => {
  for (const el of document.querySelectorAll('button, [role="button"]')) {
    if (el.textContent.includes('MiniMax') || el.textContent.includes('M3')) {
      el.click();
      break;
    }
  }
});
await page.waitForTimeout(1500);

const dropdownVisible = await page.evaluate(() => {
  const listbox = document.querySelector('[role="listbox"]');
  if (!listbox) return { visible: false, reason: 'no listbox' };
  
  const style = window.getComputedStyle(listbox);
  const visible = style.display !== 'none' && style.visibility !== 'hidden' && listbox.offsetParent !== null;
  
  return {
    visible,
    display: style.display,
    visibility: style.visibility,
    offsetParent: listbox.offsetParent !== null,
    innerHTML: listbox.innerHTML.substring(0, 300)
  };
});

console.log('模型下拉菜单状态:', JSON.stringify(dropdownVisible, null, 2));
if (dropdownVisible.visible) {
  console.log('✅ 模型下拉菜单正常显示');
} else {
  console.log('❌ 模型下拉菜单不可见:', dropdownVisible.reason);
}

await page.screenshot({ path: 'verify-model-dropdown.png' });
console.log('截图已保存: verify-model-dropdown.png\n');

// 2. 验证思考模式
console.log('[2] 验证思考模式...');
const thinkingInfo = await page.evaluate(() => {
  // 检查所有可能的思考模式开关位置
  const locations = [
    { name: '输入框区域', el: document.querySelector('.input-area, [class*="input"]') },
    { name: '工具栏', el: document.querySelector('.toolbar, [class*="toolbar"]') },
    { name: '设置面板', el: null }  // 需要打开设置
  ];
  
  const results = [];
  for (const loc of locations) {
    if (loc.el) {
      const hasThinking = loc.el.textContent.includes('思考') || 
                          loc.el.querySelector('[aria-label*="思考"]');
      results.push({ location: loc.name, hasThinking: !!hasThinking });
    }
  }
  
  // 全局搜索
  const allElements = document.querySelectorAll('*');
  let found = false;
  for (const el of allElements) {
    if (el.textContent.includes('思考模式') || el.getAttribute('aria-label')?.includes('思考')) {
      found = true;
      results.push({ 
        location: 'global', 
        tag: el.tagName, 
        text: el.textContent.trim().substring(0, 30),
        className: el.className.substring(0, 50)
      });
      break;
    }
  }
  
  return { results, found };
});

console.log('思考模式检测结果:');
console.log(JSON.stringify(thinkingInfo, null, 2));
if (thinkingInfo.found) {
  console.log('✅ 找到思考模式开关');
} else {
  console.log('⚠️ 未找到思考模式开关（可能未实现）');
}

// 3. 验证图片上传
console.log('\n[3] 验证图片上传...');
const imgUploadInfo = await page.evaluate(() => {
  // 检查文件上传按钮是否支持图片
  const fileInputs = document.querySelectorAll('input[type="file"]');
  const results = [];
  
  for (const input of fileInputs) {
    const accept = input.getAttribute('accept') || '';
    results.push({
      accept,
      multiple: input.multiple,
      parentClass: input.parentElement?.className?.substring(0, 50)
    });
  }
  
  return { count: fileInputs.length, results };
});

console.log('文件上传输入框:');
console.log(JSON.stringify(imgUploadInfo, null, 2));
if (imgUploadInfo.results.some(r => r.accept.includes('image') || r.accept === '')) {
  console.log('✅ 图片上传支持（通过文件上传）');
} else {
  console.log('⚠️ 图片上传可能不支持');
}

// 4. 验证会话列表右键菜单
console.log('\n[4] 验证会话列表右键菜单...');
// 先确保侧边栏可见
await page.evaluate(() => {
  const firstSession = document.querySelector('[data-session-path]');
  if (firstSession) {
    // 滚动到可见
    firstSession.scrollIntoView();
  }
});
await page.waitForTimeout(500);

const contextMenuInfo = await page.evaluate(() => {
  const sessionItems = document.querySelectorAll('[data-session-path]');
  if (sessionItems.length === 0) return { found: false, reason: 'no session items' };
  
  const firstItem = sessionItems[0];
  const rect = firstItem.getBoundingClientRect();
  
  // 尝试触发 contextmenu
  const event = new MouseEvent('contextmenu', { 
    bubbles: true, 
    cancelable: true,
    clientX: rect.left + rect.width / 2,
    clientY: rect.top + rect.height / 2
  });
  firstItem.dispatchEvent(event);
  
  return {
    found: true,
    visible: rect.width > 0 && rect.height > 0,
    rect: { width: rect.width, height: rect.height },
    text: firstItem.textContent.trim().substring(0, 30)
  };
});

console.log('会话项信息:');
console.log(JSON.stringify(contextMenuInfo, null, 2));

if (contextMenuInfo.found && contextMenuInfo.visible) {
  console.log('✅ 会话项可见，可以测试右键菜单');
  
  await page.waitForTimeout(800);
  
  const menuAfterContext = await page.evaluate(() => {
    return document.querySelectorAll('[role="menu"], .context-menu, [class*="context"]').length;
  });
  
  if (menuAfterContext > 0) {
    console.log('✅ 右键菜单出现');
  } else {
    console.log('⚠️ 右键菜单未出现（可能未实现）');
  }
} else {
  console.log('❌ 会话项不可见');
}

console.log('\n=== 保持浏览器打开 90 秒用于手动检查 ===');
await page.waitForTimeout(90000);
await browser.close();
