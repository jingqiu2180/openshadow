import { chromium } from 'playwright';

const BASE = 'http://localhost:5173';
const shots = 'test-screenshots';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });

  console.log('=== remu UI Test v4 ===\n');

  // 1. 首页加载
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${shots}/v4-01-home.png`, fullPage: false });
  console.log('✅ 1. 页面加载成功');

  // 2. 检查 Beta 标签
  const betaText = await page.evaluate(() => {
    const spans = Array.from(document.querySelectorAll('span'));
    const found = spans.find(s => s.textContent?.includes('Beta') || s.textContent?.includes('测试版'));
    return found?.textContent || '';
  });
  
  if (betaText) {
    if (betaText.includes('测试版')) {
      console.log('✅ 2. Beta标签已翻译为: ' + betaText);
    } else {
      console.log('⚠️ 2. Beta标签仍为英文: ' + betaText);
    }
  } else {
    console.log('⚠️ 2. 未找到Beta标签');
  }

  // 3. 检查聊天输入框
  const chatInput = await page.$('textarea, [contenteditable="true"]');
  console.log(chatInput ? '✅ 3. 聊天输入框存在' : '❌ 3. 聊天输入框不存在');

  // 4. 点击新对话
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const newChat = btns.find(b => 
      b.textContent?.includes('新对话') || 
      b.textContent?.includes('New Chat')
    );
    newChat?.click();
  });
  await page.waitForTimeout(800);
  console.log('✅ 4. 点击新对话按钮');

  // 5. 打开设置
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const settings = btns.find(b => 
      b.title?.includes('设置') || 
      b.getAttribute('aria-label')?.includes('设置')
    );
    settings?.click();
  });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${shots}/v4-02-settings.png`, fullPage: false });
  console.log('✅ 5. 打开设置面板');

  // 6. 关闭设置
  await page.evaluate(() => {
    const overlay = document.querySelector('[data-testid="settings-modal-overlay"]');
    if (overlay) {
      overlay.click();
    }
  });
  await page.waitForTimeout(500);

  // 7. 最终截图
  await page.screenshot({ path: `${shots}/v4-03-final.png`, fullPage: false });
  console.log('✅ 6. 测试完成，截图已保存');

  await browser.close();
  
  console.log('\n=== 测试完成 ===');
  console.log(`截图目录: ${shots}`);
}

main().catch(e => {
  console.error('测试失败:', e.message);
  process.exit(1);
});
