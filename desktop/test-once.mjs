import { chromium } from 'playwright';
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG = fs.createWriteStream(path.join(__dirname, 'test-once.log'), { flags: 'w' });

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  process.stdout.write(line);
  LOG.write(line);
}

async function main() {
  log('=== 单次测试开始 ===');
  
  const browser = await chromium.launch({
    headless: false,
    args: ['--window-size=1400,900', '--no-sandbox']
  });
  
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 }
  });
  const page = await context.newPage();
  
  // 监听异常
  page.on('pageerror', err => log(`[PAGE ERROR] ${err.message}`));
  page.on('console', msg => {
    if (msg.type() === 'error') log(`[CONSOLE ERROR] ${msg.text()}`);
  });
  
  try {
    log('1. 打开应用...');
    await page.goto('http://localhost:5173/', { timeout: 15000 });
    await page.waitForTimeout(3000);
    log('   页面加载完成');
    
    // 截图
    await page.screenshot({ path: 'test-screenshot-01-home.png' });
    log('   截图已保存: test-screenshot-01-home.png');
    
    // 检查关键元素
    const hasInput = await page.$('[data-testid="chat-input"], textarea, [contenteditable="true"]');
    log(`   输入框存在: ${!!hasInput}`);
    
    const hasSendBtn = await page.$('[data-testid="send-button"], button[aria-label*="发送"], button[aria-label*="send"]');
    log(`   发送按钮存在: ${!!hasSendBtn}`);
    
    // 检查页面标题
    const title = await page.title();
    log(`   页面标题: ${title}`);
    
    // 检查是否有React根节点
    const rootHTML = await page.$eval('#root, #app, .app-container', el => el ? el.className || 'found' : 'not-found').catch(() => 'error');
    log(`   React根节点: ${rootHTML}`);
    
    log('2. 测试输入和发送...');
    
    // 尝试输入
    if (hasInput) {
      const inputSelector = '[data-testid="chat-input"], textarea, [contenteditable="true"]';
      await page.click(inputSelector).catch(() => {});
      await page.waitForTimeout(500);
      await page.keyboard.type('测试消息 123');
      await page.waitForTimeout(1000);
      
      // 截图
      await page.screenshot({ path: 'test-screenshot-02-input.png' });
      log('   已输入文本，截图: test-screenshot-02-input.png');
      
      // 尝试发送
      if (hasSendBtn) {
        await page.click('[data-testid="send-button"], button[aria-label*="发送"], button[aria-label*="send"]').catch(() => {});
        await page.waitForTimeout(3000);
        
        await page.screenshot({ path: 'test-screenshot-03-after-send.png' });
        log('   已点击发送，截图: test-screenshot-03-after-send.png');
      }
    }
    
    log('3. 检查会话列表...');
    const sessionList = await page.$('.session-list, [data-testid="session-list"], nav');
    log(`   会话列表存在: ${!!sessionList}`);
    
    log('4. 检查设置按钮...');
    const settingsBtn = await page.$('button[aria-label*="设置"], button[aria-label*="settings"], [data-testid="settings-button"]');
    log(`   设置按钮存在: ${!!settingsBtn}`);
    
    if (settingsBtn) {
      await page.click('button[aria-label*="设置"], button[aria-label*="settings"], [data-testid="settings-button"]').catch(() => {});
      await page.waitForTimeout(1500);
      await page.screenshot({ path: 'test-screenshot-04-settings.png' });
      log('   已打开设置，截图: test-screenshot-04-settings.png');
    }
    
    log('=== 测试完成 ===');
    log('浏览器保持打开，按Ctrl+C关闭');
    
    // 保持浏览器打开30秒，让人可以查看
    await page.waitForTimeout(30000);
    
  } catch (err) {
    log(`[ERROR] ${err.message}`);
    await page.screenshot({ path: 'test-screenshot-error.png' }).catch(() => {});
  } finally {
    await browser.close();
    LOG.end();
  }
}

main().catch(err => {
  log(`[FATAL] ${err.message}`);
  process.exit(1);
});
