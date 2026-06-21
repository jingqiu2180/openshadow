/**
 * 调试脚本：检查工作台面板和文件树的 DOM 结构
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

  try {
    await page.goto(VITE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    console.log('[DEBUG] 检查工作台面板...');

    // 1. 查找所有包含 "previewPanel" 或 "desk" 或 "fileTree" 的元素
    const panelInfo = await page.evaluate(() => {
      const allElements = document.querySelectorAll('*');
      const results = [];
      
      allElements.forEach(el => {
        if (el.className && typeof el.className === 'string') {
          const cls = el.className;
          if (cls.includes('previewPanel') || cls.includes('desk') || cls.includes('fileTree') || cls.includes('tree')) {
            results.push({
              tag: el.tagName,
              class: cls.substring(0, 100),
              visible: el.checkVisibility(),
              text: el.textContent?.substring(0, 50)
            });
          }
        }
      });
      
      return results;
    });

    console.log(`[DEBUG] 找到 ${panelInfo.length} 个相关元素:`);
    panelInfo.forEach((info, i) => {
      console.log(`  ${i + 1}. <${info.tag}> class="${info.class}" visible=${info.visible} text="${info.text}"`);
    });

    // 2. 查找所有 button 元素
    const buttons = await page.evaluate(() => {
      const allButtons = document.querySelectorAll('button');
      return Array.from(allButtons).map((btn, i) => ({
        index: i,
        text: btn.textContent?.substring(0, 30),
        class: btn.className?.substring(0, 80),
        visible: btn.checkVisibility()
      }));
    });

    console.log(`\n[DEBUG] 找到 ${buttons.length} 个 button 元素 (前20个):`);
    buttons.slice(0, 20).forEach(btn => {
      console.log(`  ${btn.index}. "${btn.text}" class="${btn.class}" visible=${btn.visible}`);
    });

    // 3. 查找侧边栏
    const sidebarInfo = await page.evaluate(() => {
      const sidebar = document.querySelector('[class*="sidebar"]');
      if (!sidebar) return { found: false };
      
      return {
        found: true,
        class: sidebar.className?.substring(0, 100),
        visible: sidebar.checkVisibility(),
        childCount: sidebar.children.length,
        html: sidebar.innerHTML?.substring(0, 200)
      };
    });

    console.log(`\n[DEBUG] 侧边栏:`, JSON.stringify(sidebarInfo, null, 2));

    // 4. 截图
    await page.screenshot({ path: 'D:/tmp/debug-panel.png', fullPage: true });
    console.log('\n📷 截图保存到 D:/tmp/debug-panel.png');

  } catch (error) {
    console.error('调试失败:', error);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
