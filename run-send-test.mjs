// run-send-test.mjs — 触发发送，然后 dump 浏览器 console 日志
import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: false }); // 有头模式，可以直接看 console
  const page = await browser.newPage();

  const logs = [];
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[DIAG]')) {
      logs.push(`[${msg.type()}] ${text}`);
      console.log(`BROWSER LOG: ${text}`);
    }
  });

  console.log('打开页面...');
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(3000);
  await page.click('text=rem-default').catch(() => {});
  await page.waitForTimeout(2000);

  console.log('输入消息...');
  const input = await page.$('[contenteditable="true"]');
  if (input) {
    await input.click();
    await page.waitForTimeout(300);
    await page.keyboard.type('test', { delay: 50 });
    await page.waitForTimeout(500);

    console.log('点击发送按钮...');
    const sendBtn = await page.$('[class*="send-btn"]');
    if (sendBtn) {
      await sendBtn.click();
      await page.waitForTimeout(5000); // 等 5 秒，看 console 日志
    }
  }

  console.log('\n=== 捕获的 DIAG 日志 ===');
  logs.forEach(l => console.log(l));

  if (logs.length === 0) {
    console.log('未捕获到 DIAG 日志！检查：');
    console.log('  1. 源码日志语句是否正确');
    console.log('  2. dist/ 文件是否真的更新了');
    console.log('  3. 浏览器是否缓存了旧 JS');
  }

  await browser.close();
})();
