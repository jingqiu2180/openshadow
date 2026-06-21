import { chromium } from 'playwright';
import fs from 'fs';

const VITE_URL = 'http://localhost:5173';
const USER_DATA_DIR = 'D:/tmp/remu-test-user-data';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const statePath = USER_DATA_DIR + '/state.json';
  const contextOpts = {};
  if (fs.existsSync(statePath)) {
    contextOpts.storageState = statePath;
  }
  const context = await browser.newContext(contextOpts);
  const page = await context.newPage();
  await page.goto(VITE_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  // Get all class names that contain "message" or "chat"
  const classNames = await page.evaluate(() => {
    const allElements = document.querySelectorAll('[class]');
    const names = new Set();
    allElements.forEach(el => {
      el.classList.forEach(cls => {
        if (cls.toLowerCase().includes('message') || cls.toLowerCase().includes('chat')) {
          names.add(cls);
        }
      });
    });
    return [...names];
  });

  // Get data-* attributes count
  const dataAttrs = await page.evaluate(() => {
    return document.querySelectorAll('[data-testid], [data-message-id], [data-role]').length;
  });

  // Get chat area innerHTML (first 3000 chars)
  const chatAreaHtml = await page.evaluate(() => {
    const chatArea = document.querySelector('.chat-area');
    return chatArea ? chatArea.innerHTML.substring(0, 3000) : 'NOT_FOUND';
  });

  // Get panel/desk related class names
  const deskClassNames = await page.evaluate(() => {
    const allElements = document.querySelectorAll('[class]');
    const names = new Set();
    allElements.forEach(el => {
      el.classList.forEach(cls => {
        if (cls.toLowerCase().includes('desk') || cls.toLowerCase().includes('panel')) {
          names.add(cls);
        }
      });
    });
    return [...names];
  });

  const result = {
    classNames,
    deskClassNames,
    dataAttrsCount: dataAttrs,
    chatAreaHtml: chatAreaHtml.substring(0, 2000),
  };

  fs.writeFileSync('D:/tmp/dom-inspect.json', JSON.stringify(result, null, 2));
  console.log('✅ classNames:', JSON.stringify(classNames));
  console.log('✅ deskClassNames:', JSON.stringify(deskClassNames));
  console.log('✅ dataAttrs:', dataAttrs);
  await browser.close();
})();
