// verify-render.mjs — 快速验证 openshadow UI 是否渲染正常
import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  
  try {
    await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(3000);

    // 截图全页
    await page.screenshot({ path: 'D:/screenshots/openshadow-ui-audit/verify-render.png', fullPage: true });
    console.log('[verify] 截图已保存到 verify-render.png');

    // 检查关键元素是否存在
    const info = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button')).map(b => ({
        text: b.textContent.trim().slice(0, 20),
        disabled: b.disabled,
        title: b.title || '',
        ariaLabel: b.getAttribute('aria-label') || '',
      }));
      const inputs = document.querySelectorAll('.tiptap-editor, .ProseMirror, [contenteditable="true"]').length;
      return { buttonCount: buttons.length, buttons: buttons.slice(0, 15), hasInput: inputs > 0 };
    });
    
    console.log('\n[verify] 页面按钮数:', info.buttonCount);
    console.log('[verify] 按钮列表:');
    info.buttons.forEach((b, i) => console.log(`  [${i+1}] "${b.text}" disabled=${b.disabled} title="${b.title}" aria-label="${b.ariaLabel}"`));
    console.log('\n[verify] 输入框存在:', info.hasInput);
    
    // 检查是否有可见的会话列表
    const sidebarInfo = await page.evaluate(() => {
      const sidebar = document.querySelector('.sidebar, [class*="sidebar"], [class*="Sidebar"]');
      if (!sidebar) return { hasSidebar: false };
      const items = sidebar.querySelectorAll('[class*="session"], [class*="Session"], li, [role="button"]');
      return { 
        hasSidebar: true, 
        sidebarText: sidebar.textContent.slice(0, 200),
        possibleSessionItems: items.length 
      };
    });
    console.log('\n[verify] Sidebar 信息:', JSON.stringify(sidebarInfo, null, 2));

  } finally {
    await browser.close();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
